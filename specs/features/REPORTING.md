# REPORTING.md — Periodic Intelligence Reports Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — June 2026

> **This is the canonical source for all periodic report jobs, data modules, AI summary contracts, and notification events related to scheduled reporting.** The reporting system is workspace-aware and additive — report content expands automatically as more workspaces are activated for an organisation.

---

## What This Feature Is

Periodic intelligence reports are scheduled, AI-assisted documents delivered to managers on a regular cadence. They are not dashboards — they are narrative summaries of what the safety intelligence pipeline produced over a defined period, written in plain English and designed to be read quickly.

The system is built around two concepts:

**Data modules** — discrete query units, each scoped to a single domain (insights, visits & observations, corrective actions, etc.). Each module is gated to a workspace. A module is only included in a report if its workspace is active for that organisation. Modules are composable — a report is assembled from whichever modules are relevant.

**Report schedules** — define what fires, when, at what org scope, and for which audience. A schedule declares which modules to assemble. The AI summary job runs over the assembled payload and produces the narrative.

This means adding a new data domain means writing a new module — not modifying existing reports. And a new report type is just a new schedule with a different module combination.

---

## Architecture Overview

```
Report Schedule fires (cron)
  │
  ├── For each org in scope:
  │     ├── Determine active workspaces
  │     ├── Assemble modules gated to active workspaces
  │     ├── Query each module → collect data payload
  │     ├── Write report record (status: data_ready, executive_summary: null)
  │     ├── Emit notification to recipients
  │     └── Queue AI summary job (async, non-blocking)
  │
  └── AI summary job (async):
        ├── Load report_data payload
        ├── Load prior period summary (if exists — for directional language)
        ├── Build prompt from active module sections
        ├── Call claude-sonnet-4-6
        └── Update report record (executive_summary, status: complete)
```

The report record is available to the UI as soon as `status = data_ready`. The `executive_summary` field is null until the async AI job completes — the UI renders `report_data` immediately and updates when the summary arrives.

---

## Data Modules

Each module defines: what it queries, what it returns, and which workspace gates it.

Field names below are illustrative — devs reconcile against the actual Hiviz schema at implementation time.

---

### Module: `insight_pipeline`

**Workspace gate:** `workspace.core` (always included)
**What it covers:** Critical insight volume, trigger source breakdown, pipeline stage distribution, top FW Map® factors, escalation activity.

**Data shape:**
```
insight_pipeline:
  generated:              integer   -- insights generated in period
  approved:               integer
  rejected:               integer
  resolved_this_period:   integer   -- moved to resolved state within period

  by_trigger_source:
    algorithm:                integer  -- trend threshold crossed
    critical_observation:     integer  -- single high-potential observation
    atrophy_pattern:          integer  -- multiple sites degrading simultaneously
    external_investigation:   integer  -- finding from closed investigation
    manual:                   integer
    external_alert:           integer

  pipeline_stage_snapshot:           -- count of approved insights at each stage (current state, not period-only)
    prioritise:             integer
    learn:                  integer
    improve:                integer
    resolved:               integer

  top_fw_factors:                    -- top 5 FW Map® factors across approved insights in period
    - factor:               string
      count:                integer

  escalated_to_systemic:  integer   -- insights where escalate_to_systemic = true
```

**Prompt section label:** `INSIGHT PIPELINE`

---

### Module: `visits_observations`

**Workspace gate:** `workspace.core` (always included)
**What it covers:** Field observation volume, visit activity, signal type breakdown, stop-work events.

**Data shape:**
```
visits_observations:
  observations_submitted:   integer  -- total observations in period
  visits_conducted:         integer  -- manager site visits completed in period
  sites_visited:            integer  -- distinct sites visited

  by_signal_type:
    at_risk_condition:      integer
    barrier_failure:        integer
    unwanted_energy_event:  integer
    positive_practice:      integer

  stop_work_called:         integer  -- observations where stop_work_called = true
  stop_work_ai_warranted:   integer  -- observations where ai flagged stop work warranted
  stop_work_divergence:     integer  -- ai warranted but not called (V2 leading indicator)

  sites_with_no_observations_this_period:  integer  -- zero observation activity
```

**Prompt section label:** `VISITS & OBSERVATIONS`

---

### Module: `visibility`

**Workspace gate:** `workspace.core` (always included)
**What it covers:** How visible the organisation is into what is happening at its worksites. In Hiviz, visibility is derived from two signals that already exist in core: time since last manager site visit, and observation activity. A site that hasn't been visited and has no recent observations is a blind spot. This module surfaces that picture across the org.

**Data shape:**
```
visibility:
  sites_total:                   integer  -- total active worksites in org
  sites_visited_this_period:     integer  -- sites with at least one manager visit in period
  sites_not_visited_30d:         integer  -- sites with no visit in 30+ days at period end
  sites_not_visited_60d:         integer  -- sites with no visit in 60+ days at period end
  avg_days_since_last_visit:     decimal  -- average across all sites at period end

  sites_with_observations:       integer  -- sites with at least one obs submitted in period
  sites_with_no_observations:    integer  -- sites with zero obs submitted in period

  low_visibility_sites:                   -- sites where both visit AND obs activity are low
    - site_name:            string
      days_since_last_visit: integer
      obs_count_this_period: integer
```

**Note:** Low visibility is a derived classification — devs define the threshold at implementation (e.g. no visit in 30d AND fewer than 3 obs). The threshold should be configurable per org. The AI receives the derived list, not the raw threshold.

**Prompt section label:** `SITE VISIBILITY`

---

### Module: `incident_activity`

**Workspace gate:** `workspace.incident`
**What it covers:** Incident volume, severity breakdown, investigation status.

**Data shape:**
```
incident_activity:
  reported:               integer  -- incidents reported in period
  by_severity:
    critical:             integer
    serious:              integer
    moderate:             integer
    minor:                integer

  investigations_opened:  integer
  investigations_closed:  integer
  investigations_overdue: integer  -- open investigations past their target close date
```

**Prompt section label:** `INCIDENT ACTIVITY`

---

---

## Resilience and Null Handling

The report must generate successfully regardless of which modules are active or how much data exists within them. MVP deployments will typically have fewer active workspaces and sparser data than a mature deployment.

### Module-level resilience

A module that is not included (its workspace is inactive) is **omitted entirely** — not passed to the AI as a zero-value section. The AI prompt only receives sections for modules that were actually assembled. A report with two active modules is as valid as one with six.

### Field-level resilience

Within an active module, individual fields may be zero or null if:
- The feature generating that data is not yet implemented in this deployment
- The period had genuinely no activity of that type

Zero and null are handled differently:
- **Zero** — the feature is active but produced no events. Include in payload. AI rules apply (see below).
- **Null** — the field is not yet available from this deployment. Omit from the prompt section for that module — do not pass `null` values to the AI.

Each module definition should note which fields may be null in early deployments. Devs populating the payload should omit null fields rather than passing them explicitly.

### AI handling of sparse data

The system prompt instructs the AI:
- If a module section shows all-zero values, acknowledge it briefly but do not speculate about causes or treat absence as a finding.
- Do not reference fields that are absent from the prompt.
- A report assembled from fewer modules is still a complete report — write confidently from what is present. Do not apologise for missing sections.
- Do not fabricate trend language if no prior month summary is available. Write from the current period only.

This means an MVP report with only `insight_pipeline` and `visits_observations` active — and with zero corrective actions because that feature isn't built yet — will still produce a coherent, useful summary. It will not mention corrective actions at all.

### Practical MVP scenario

For an early Hiviz deployment with only `workspace.core` active and corrective actions not yet implemented:

- Modules assembled: `insight_pipeline`, `visits_observations`, `visibility`
- `incident_activity` module: omitted (workspace.incident not active)
- `enquiry_activity`, `corrective_actions` modules: not yet implemented — absent from assembly entirely

The report generates, the AI summary covers what is present, and no errors or empty sections appear.

---

## Report Schedules

### `report.manager_monthly`

**Purpose:** Monthly executive summary for managers — what the safety intelligence pipeline produced last month, written as a narrative a manager can read in two minutes.

**Cadence:** Monthly — fires on the 1st of each month, covering the prior full calendar month.

**Scope:** Organisation — one report generated per organisation per month.

**Recipients:** All users holding `manager` or `safety_manager` role within the organisation.

**Modules assembled (by active workspace):**

| Module | Workspace gate | Status |
|---|---|---|
| `insight_pipeline` | `workspace.core` | Always included |
| `visits_observations` | `workspace.core` | Always included |
| `visibility` | `workspace.core` | Always included — derived from visit + obs data |
| `incident_activity` | `workspace.incident` | Only if active |
| `enquiry_activity` | `workspace.enquiry` | V2 — not yet implemented |
| `corrective_actions` | `workspace.core` | V2 — not yet implemented |

**Deduplication:** One report per org per calendar month. If a report already exists for the period, the job does not re-run.

**Prior period context:** The AI summary job fetches the prior month's `executive_summary` (if one exists for this org) and passes it into the prompt to enable directional language ("up from last month", "continuing the pattern seen in April").

---

## Storage

A `report` record is created per schedule firing per organisation. Field names are illustrative.

```
report:
  id                    UUID
  org_id                UUID
  report_type           VARCHAR    -- 'manager_monthly' (extensible as new schedules are added)
  period_start          DATE       -- first day of the covered period
  period_end            DATE       -- last day of the covered period
  period_label          VARCHAR    -- human-readable label, e.g. 'May 2026'
  modules_included      TEXT[]     -- which modules were assembled (reflects active workspaces at generation time)
  report_data           JSONB      -- assembled module payload
  executive_summary     TEXT       -- AI-generated narrative; null until async job completes
  prior_summary_used    BOOLEAN    -- whether a prior period summary was passed to the AI job
  ai_generated_at       TIMESTAMPTZ
  status                VARCHAR    -- 'generating' | 'data_ready' | 'complete'
  created_at            TIMESTAMPTZ
  updated_at            TIMESTAMPTZ
```

---

## Stage 1 — AI Summary Job

**Job:** `report.generate_summary`
**Triggered:** After report record is written with `status = data_ready`
**Input:** Assembled `report_data` payload + prior period `executive_summary` (if exists)
**Output:** `executive_summary` TEXT — 4–6 sentences, plain English
**Max tokens:** 600

### CANONICAL-SYSTEM-PROMPT

```
You are a safety intelligence analyst writing a monthly executive summary for site managers.

Your role is to interpret pipeline activity across the organisation and write a short,
plain-English narrative that tells managers what happened this month and whether
the direction of travel is positive, concerning, or mixed.

Rules:
- 4–6 sentences. No lists, no headers, no bullet points.
- Plain English. Do not repeat metric labels verbatim from the data.
- Directional: is the pipeline healthy, improving, or needs attention?
- If a specific FW Map® factor, atrophy signal, or pipeline bottleneck is
  notable, name it specifically.
- If prior month data is provided, use it for trend language
  ("up from last month", "the pattern seen in April continues").
- Do not tell managers what to do. This is observational, not prescriptive.
- Do not fabricate or extrapolate beyond the provided data.
- Do not name individuals or specific incidents.
- If a section shows all-zero values, note it briefly — do not speculate about causes.
- Do not reference fields that are absent from this prompt.
- If no prior month summary is provided, write from this period only — do not invent trend language.
- A prompt with fewer active sections is still complete. Write confidently from what is present.

You output only the summary text — no JSON, no preamble, no formatting.
```

### CANONICAL-USER-PROMPT

The user prompt is assembled from whichever modules were included in the report. Each active module contributes one labeled section. Sections appear in a fixed order; inactive modules are omitted entirely.

```
Monthly safety intelligence summary for {{period_label}} — {{org_name}}.

{{#if insight_pipeline}}
INSIGHT PIPELINE
Generated: {{insight_pipeline.generated}} | Approved: {{insight_pipeline.approved}} | Rejected: {{insight_pipeline.rejected}} | Resolved this month: {{insight_pipeline.resolved_this_period}}
Sources — algorithm: {{insight_pipeline.by_trigger_source.algorithm}}, critical observation: {{insight_pipeline.by_trigger_source.critical_observation}}, atrophy pattern: {{insight_pipeline.by_trigger_source.atrophy_pattern}}, from investigation: {{insight_pipeline.by_trigger_source.external_investigation}}
Pipeline (current) — prioritise: {{insight_pipeline.pipeline_stage_snapshot.prioritise}}, learn: {{insight_pipeline.pipeline_stage_snapshot.learn}}, improve: {{insight_pipeline.pipeline_stage_snapshot.improve}}, resolved: {{insight_pipeline.pipeline_stage_snapshot.resolved}}
Top FW factors: {{insight_pipeline.top_fw_factors | format_list}}
Escalated to systemic: {{insight_pipeline.escalated_to_systemic}}
{{/if}}

{{#if visits_observations}}
VISITS & OBSERVATIONS
Observations submitted: {{visits_observations.observations_submitted}}
Visits conducted: {{visits_observations.visits_conducted}} across {{visits_observations.sites_visited}} sites
Signal types — at-risk: {{visits_observations.by_signal_type.at_risk_condition}}, barrier failure: {{visits_observations.by_signal_type.barrier_failure}}, unwanted energy event: {{visits_observations.by_signal_type.unwanted_energy_event}}, positive: {{visits_observations.by_signal_type.positive_practice}}
Stop work called: {{visits_observations.stop_work_called}}
Sites with no observations this month: {{visits_observations.sites_with_no_observations_this_period}}
{{/if}}

{{#if corrective_actions}}
CORRECTIVE ACTIONS
Created: {{corrective_actions.created}} | Closed: {{corrective_actions.closed}} | Overdue: {{corrective_actions.overdue}} | Completion rate: {{corrective_actions.completion_rate}}%
{{/if}}

{{#if visibility}}
SITE VISIBILITY
Total sites: {{visibility.sites_total}} | Visited this month: {{visibility.sites_visited_this_period}} | Avg days since last visit: {{visibility.avg_days_since_last_visit}}
Not visited in 30+ days: {{visibility.sites_not_visited_30d}} | Not visited in 60+ days: {{visibility.sites_not_visited_60d}}
Sites with observations: {{visibility.sites_with_observations}} | Sites with no observations: {{visibility.sites_with_no_observations}}
{{#if visibility.low_visibility_sites}}Low visibility sites: {{visibility.low_visibility_sites | format_list}}{{/if}}
{{/if}}

{{#if incident_activity}}
INCIDENT ACTIVITY
Reported: {{incident_activity.reported}} (critical: {{incident_activity.by_severity.critical}}, serious: {{incident_activity.by_severity.serious}}, moderate: {{incident_activity.by_severity.moderate}})
Investigations — opened: {{incident_activity.investigations_opened}}, closed: {{incident_activity.investigations_closed}}, overdue: {{incident_activity.investigations_overdue}}
{{/if}}

{{#if prior_summary}}
PRIOR MONTH SUMMARY (for directional context)
{{prior_summary}}
{{/if}}

Write a 4–6 sentence executive summary. What does this month's pipeline tell managers? What is the direction of travel? Name anything specific worth calling out.
```

---

## Notification Events

| Event | Trigger | Recipients | Delivery |
|---|---|---|---|
| `report.manager_monthly.ready` | Report `status` reaches `data_ready` | All managers + safety managers in org | Push + email |
| `report.manager_monthly.summary_ready` | `executive_summary` populated | Same recipients | In-app update only (no second push) |

Notification copy for `report.manager_monthly.ready`:
- Title: `Monthly safety report — {{period_label}}`
- Body: `Your {{period_label}} intelligence summary is ready.`

---

## Example Output

**`report_data` payload (all modules active):**
```json
{
  "period": { "start": "2026-05-01", "end": "2026-05-31", "label": "May 2026" },
  "insight_pipeline": {
    "generated": 14, "approved": 9, "rejected": 2, "resolved_this_period": 4,
    "by_trigger_source": { "algorithm": 5, "critical_observation": 6, "atrophy_pattern": 2, "external_investigation": 1, "manual": 0, "external_alert": 0 },
    "pipeline_stage_snapshot": { "prioritise": 3, "learn": 4, "improve": 7, "resolved": 11 },
    "top_fw_factors": [
      { "factor": "Supervisor Capability", "count": 4 },
      { "factor": "Worksite Conditions", "count": 3 },
      { "factor": "Procedure Compliance", "count": 3 }
    ],
    "escalated_to_systemic": 1
  },
  "visits_observations": {
    "observations_submitted": 47, "visits_conducted": 11, "sites_visited": 8,
    "by_signal_type": { "at_risk_condition": 29, "barrier_failure": 9, "unwanted_energy_event": 3, "positive_practice": 6 },
    "stop_work_called": 2, "stop_work_ai_warranted": 4, "stop_work_divergence": 2,
    "sites_with_no_observations_this_period": 2
  },
  "visibility": {
    "sites_total": 10, "sites_visited_this_period": 8, "avg_days_since_last_visit": 18,
    "sites_not_visited_30d": 2, "sites_not_visited_60d": 0,
    "sites_with_observations": 8, "sites_with_no_observations": 2,
    "low_visibility_sites": [
      { "site_name": "Northside Civil Works", "days_since_last_visit": 38, "obs_count_this_period": 1 },
      { "site_name": "Harbour Precinct Stage 2", "days_since_last_visit": 31, "obs_count_this_period": 0 }
    ]
  },
  "incident_activity": {
    "reported": 3,
    "by_severity": { "critical": 0, "serious": 1, "moderate": 2, "minor": 0 },
    "investigations_opened": 1, "investigations_closed": 1, "investigations_overdue": 0
  }
}
```

**`executive_summary` (AI generated):**

> May saw solid insight activity — 9 approvals from 14 generated and 4 insights resolved, continuing the improvement trend from April. The pipeline is carrying healthy volume across the Learn and Improve stages, though Supervisor Capability and Worksite Conditions are the most frequently flagged FW Map® factors for the second consecutive month, which points to a systemic pattern rather than isolated events. Visibility is the area to watch: two sites — Northside Civil Works and Harbour Precinct Stage 2 — have had no manager visit in over 30 days, and Harbour Precinct submitted zero observations this month, which means the organisation has very limited line-of-sight into what is happening there. The stop-work divergence (AI warranted on 4 occasions, called on 2) is also worth monitoring — it may indicate crews are identifying risk but not feeling confident to act. On the incident side, 3 incidents were reported including one serious, and the investigation opened this period has already been closed, which is a positive sign.

---

## V2 / Future Report Types

The schedule + module architecture is designed to accommodate additional report types without changing the core pattern. Candidates:

- **`report.board_quarterly`** — Quarterly, higher scope, executive audience. Likely draws from the same modules but at division or organisation level with a different AI voice (more strategic, less operational detail).
- **`report.site_manager_weekly`** — Weekly, site-scoped, site manager audience. Lighter payload — observations and actions only, no cross-site context.
- **`report.regulatory_monthly`** — Incident workspace only. TRIFR, notifiable incidents, investigation status. Structured output rather than narrative — likely not AI-summarised.
- **`report.enquiry_digest`** — Triggered on enquiry close rather than on a fixed schedule. Scoped to the enquiry's originating insight. Audience: the safety manager who dispatched it.

**V2 modules to add to `report.manager_monthly`:**
- **`corrective_actions`** — Created, closed, overdue, completion rate. Gates on corrective action tracking being implemented in Hiviz.
- **`enquiry_activity`** — Enquiries dispatched, response rate, synthesised. Gates on enquiry feature being implemented.

New modules can be added independently as features are built out. Each module is registered, declares its gate, and becomes available to any schedule that references it.

---

*Last updated: June 2026 — v1.0. Update when: a new module is added; a schedule is added or changed; the AI prompt changes; the output schema changes; a new report type graduates from V2 to specced.*
