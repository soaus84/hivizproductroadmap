# SYSTEMIC-CAUSES.md — Systemic Causes Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for the FW factor aggregation engine, atrophy score, visit plan entity, and the triggering logic for all systemic-causes outputs.** It is the spec authority for stream 5 in `MODEL-MAP.md`. The three output feature specs (`SITUATIONAL-BRIEF.md`, `COMMUNITIES.md`, `VISIT-BRIEFING.md`) own their prompts and schemas — this file owns what triggers them and how the aggregated intelligence picture is built.

---

## What This Stream Is

The systemic causes stream is what transforms individual classified safety events into an organisation-level picture of capacity. Each classified insight, investigation, and enquiry contains `fw_factors[]` arrays — evidence of organisational capacity gaps at specific maturity levels. Individually, they are signals. Aggregated across time and org scope, they become a pattern: this organisation has a systemic gap in `operational_management` at the compliant maturity level that is showing up across multiple work types and sites.

That aggregated picture drives three actions:
- A situational brief to managers and divisional leadership (what's happening and why it matters)
- A CoP thread seed to the relevant practice community (what do practitioners know about this?)
- A visit briefing pack for the next manager visiting the affected site (what to look for, what to ask, what's overdue)

The stream also maintains an **atrophy score** per worksite — a measure of how stale the safety intelligence loop has become — which is the other primary driver of visit plan creation and visit briefing generation.

---

## Core Concepts

### FW Capacity Profile

The FW capacity profile is a per-org-level, per-time-window view of which Forge Works Map® factors have accumulated enough classified evidence to constitute a systemic signal. It is not stored as a flat record — it is computed on demand from the classified entities in scope.

The profile has two parts:

**Active factors** — factors that have appeared in classified entities within the time window, above threshold.

**Blind spots** — factors that have never been classified at this org level within the time window. A blind spot does not mean no gap exists — it means no evidence has been gathered that would detect a gap. Blind spots are as important as active factors: they identify where the organisation is flying blind.

### Atrophy Score

The atrophy score measures how stale the safety intelligence loop has become at a worksite. A site with active observations, recent toolbox talks, and completed corrective actions has a low score. A site where nothing has happened in weeks is accumulating atrophy — the organisation is losing visibility into what is actually happening there.

**Baseline prerequisite.** Atrophy scoring does not activate until the first `visit_plan` is completed at a worksite. Before that point the worksite is in `atrophy_state: null` — unscored. A site that has never been visited cannot be considered atrophied; it has no established baseline to degrade from. The first completed visit initialises the loop.

Once baseline is set, atrophy is a composite of five signals, each measured in days since last event, normalised to a 0–100 scale per signal, then averaged:

| Signal | What triggers a reset | Max age before full atrophy | Notes |
|---|---|---|---|
| `observation_recency` | Any observation submitted (any type) | 21 days | Scored from first observation |
| `high_signal_observation_recency` | Near-miss, at-risk, barrier_failure, or unwanted_energy_event | 14 days | Scored from first high-signal observation |
| `toolbox_talk_recency` | Any toolbox talk delivered at this worksite | 21 days | Scored from first toolbox talk |
| `manager_visit_recency` | Any visit_plan completed at this worksite | 90 days | Clock starts from first completed visit — not from site creation date |
| `corrective_action_overdue` | All open corrective actions are within their due date | Severity-weighted — critical: 7 days; serious: 14 days; moderate: 30 days | Only scored once corrective actions have been assigned |

**Composite score:** average of the active signals. Signals not yet initialised (no event ever recorded) are excluded from the average rather than treated as fully atrophied.

**Atrophy state** is derived from the composite score and drives visit wizard prioritisation and worksite decoration:

| State | Score | Meaning |
|---|---|---|
| `null` | — | Pre-baseline. No visit completed yet. Not scored. |
| `active` | 0–39 | Loop is healthy. Site is generating intelligence. |
| `elevated` | 40–69 | Signals are ageing. Worth scheduling a visit. |
| `critical` | 70–100 | Loop is significantly stale. Visit is overdue. |

State transitions update the worksite's decoration in the visit wizard and site list — they do not fire push notifications. Managers see atrophy state as a persistent signal when they open the visit wizard, not as an interrupt demanding immediate action.

**Atrophy as an aggregate signal.** When multiple worksites within the same org level transition to `elevated` or `critical` within a short window, that is itself a systemic signal — the intelligence loop is degrading at scale. This pattern is a V1 trigger for `critical_insight.generate` at the regional level. See Trigger Logic — Critical Insight below.

---

## Visit Plan

A visit plan is a manager's declared intent to visit a worksite. It is the entry point for visit briefing generation. The plan is created through the visit wizard — a guided flow that prioritises sites by need, selects a date, and curates focus areas from intelligence signals.

### Schema

```sql
CREATE TABLE safety_intelligence.visit_plan (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id        UUID        NOT NULL REFERENCES users(id),
  worksite_id       UUID        NOT NULL REFERENCES worksite(id),
  planned_date      DATE        NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','active','complete','cancelled')),

  -- Focus areas — selected in visit wizard, used to shape briefing
  focus_areas       JSONB,
  -- Array of: { type: 'fw_factor'|'work_type'|'corrective_action'|'blind_spot'|'ai_suggested',
  --             label: string, evidence: string, source: string }

  -- Visit execution
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,

  -- On complete: AI-generated summary of the visit
  visit_summary     TEXT,
  visit_summary_generated_at TIMESTAMPTZ,

  -- Child observations captured during the visit
  -- Linked via observation.visit_plan_id (FK on observation table)

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Visit Wizard Flow

**Step 1 — Site selection.** Sites are presented in two groups, ordered within each group by priority.

**Group 1 — First visit needed** (`atrophy_state: null`): Sites with no completed visit. Not scored against atrophy — surfaced here because the intelligence baseline has not been set. The site card shows work types active at the site and any observations or insights already in the system. Selecting one of these sites makes clear that establishing a baseline is the purpose of the visit.

**Group 2 — Baseline established** (`atrophy_state: active | elevated | critical`): Sites ordered by:
1. Atrophy state (critical first, then elevated, then active)
2. Open unactioned CriticalInsights in scope for this manager
3. Recent critical-severity incidents
4. FW blind spots (factors unmeasured — no data, not just no gaps found)
5. Days since last manager visit

Each site card shows: atrophy state badge, dominant FW signal, blind spot count, open insight count.

**Step 2 — Date selection.** Manager selects visit date. Briefing pack is generated 48h before the selected date.

**Step 3 — Focus area selection.** AI presents a curated list of suggested focus areas, each sourced from live intelligence:

| Focus source | What it means | Badge |
|---|---|---|
| `cross_site_trend` | Work type or risk type trending across multiple sites in the observation pool | ↑ Cross-site trend |
| `fw_factor_signal` | FW factor with classified evidence from insights, investigations, or enquiries | Blueprint signal |
| `fw_blind_spot` | FW factor with zero classifications for this site — unmeasured capacity | Blueprint blind spot |
| `open_corrective_action` | Open corrective action assigned to this worksite — progress or completion to verify | Open action |
| `practice_atrophy` | A work type or control type with no recent observations — practice going dark | Practice atrophy |
| `ai_suggested` | AI synthesis of patterns not covered by the above — general signal worth attention | AI suggested |

Manager selects 2–5 focus areas. These are embedded in the visit briefing as observation prompts.

**Step 4 — Confirm.** Summary of site, date, and selected focus areas. Confirms briefing generation.

### Visit Execution

When the manager taps **Start Visit** on the briefing:
- `visit_plan.status` → `active`
- `visit_plan.started_at` set
- Briefing transitions to active mode: focus areas become observation capture prompts; other sections collapse to quick-reference

Observations captured during the visit are linked via `observation.visit_plan_id`. These are standard platform observations — they enter the normal enrichment and routing pipeline.

### Visit Completion

When the manager closes the visit:
- `visit_plan.status` → `complete`
- `visit_plan.completed_at` set
- `visit_summary` generation queues — AI summarises the visit based on linked observations, focus area coverage, and any notes the manager added
- **If this is the first completed visit at this worksite:** `atrophy_state` transitions `null` → `active`; scoring begins from this point. The `manager_visit_recency` clock starts here.
- **If baseline already set:** `manager_visit_recency` signal resets to 0.

### Visit Summary Generation

**Job:** `visit_plan.summarise`
**Triggered:** `visit_plan.status` set to `complete`
**Max tokens:** 600

### CANONICAL-SYSTEM-PROMPT-VISIT-SUMMARY

```
You are summarising a completed manager safety visit to a worksite.

The summary will be stored as a visit record and may be referenced in future
visit briefings as "last visit summary." Write for a safety professional who
will read this in 6 months.

Voice: factual, specific, brief. No padding.
Output only valid JSON. No preamble.
```

### CANONICAL-USER-PROMPT-VISIT-SUMMARY

```
Worksite: {{worksite_name}}
Visit date: {{planned_date}}
Manager: {{manager_name}}
Focus areas selected: {{focus_areas_json}}

Observations captured during visit: {{visit_observations_json}}
// Each: { work_type, observation_type, description, signal_type, energy_type }

Summarise the visit.

Return JSON:
{
  "headline": "1 sentence. What was the most significant finding or outcome of this visit.",
  "coverage": "1-2 sentences. Which focus areas were examined and what was found.",
  "observations_summary": "1-2 sentences. What field observations revealed — be specific about work types and conditions.",
  "follow_up": "1 sentence. What needs follow-up action or a future visit to verify. Null if nothing specific."
}
```

---

## FW Factor Aggregation Algorithm

The aggregation algorithm computes the FW capacity profile for an org level (site, region, division, or organisation) within a configurable time window.

### Inputs

All classified entities within the org level scope and time window:
- `critical_insight` where `cleared_for_toolbox = true` AND `fw_classified_at IS NOT NULL`
- `investigation` where `status = 'closed'` AND `cleared_for_sharing = true` AND `fw_classified_at IS NOT NULL`
- `enquiry` where `status = 'complete'` AND `fw_classified_at IS NOT NULL`

### Weighting Model

Each classification event contributes a weighted score to its `fw_factor`:

```
base_weight:
  investigation  → 3.0   (confirmed root cause — highest signal value)
  critical_insight → 2.0 (approved pattern — strong signal)
  enquiry          → 1.0 (field intelligence — corroborating signal)

severity_multiplier (investigations only):
  critical  → 1.5
  serious   → 1.2
  moderate  → 1.0
  minor     → 0.8

confidence_multiplier:
  fw_confidence (0.70–1.00) applied directly

recency_multiplier:
  linear decay over the time window
  days_old = 0   → 1.0
  days_old = window_days → 0.0

score per classification event =
  base_weight × severity_multiplier × fw_confidence × recency_multiplier
```

The composite score for a factor is the **sum** of scores across all classification events for that factor in scope.

### Profile Thresholds

A factor enters the **active** profile when:
- Composite score ≥ `org.fw_profile_threshold` (default: 3.0)
- AND appears in ≥ 2 distinct classified entities (single-event signal = direct path, not systemic pattern)

A factor is a **blind spot** when:
- Zero classifications for this factor at this org level within the time window
- AND at least one other factor has been classified (the pipeline is running — absence is meaningful)

### Output

```
fw_profile = {
  org_level:     'site' | 'region' | 'division' | 'organisation',
  scope_ref_id:  uuid,
  window_days:   90,
  computed_at:   timestamp,

  active_factors: [
    {
      fw_factor:        'operational_management',
      fw_domain:        'enable',
      composite_score:  8.4,
      entity_count:     3,    -- number of distinct entities contributing
      dominant_maturity: 'compliant',  -- most common maturity_signal weighted by score
      top_rationale:    string,  -- highest-confidence rationale from contributing entities
    },
    ...  -- ordered by composite_score descending
  ],

  blind_spots: [
    { fw_factor: 'senior_leadership', fw_domain: 'guide' },
    ...
  ]
}
```

### Time Window

Default: 90 days. Org-configurable via `org.fw_profile_window_days`. Shorter windows (30 days) for high-volume sites; longer (180 days) for low-volume or new sites where signal is sparse.

---

## Trigger Logic — When Outputs Fire

### Critical Insight — Atrophy Pattern

**Trigger — Atrophy pattern crossing threshold:**
When ≥ 3 worksites within the same region or division transition to `elevated` or `critical` within a 14-day window, AND this pattern has not triggered an insight at this org level within the past 90 days:
- Queue `critical_insight.generate` with `trigger_source: 'atrophy_pattern'`
- Insight enters the normal pipeline: AI draft → human review gate → if approved, generates corrective actions, toolbox talks, FW classification

**Threshold:** ≥ 3 sites in scope (configurable via `org.atrophy_pattern_threshold`). A single site in critical state is a visit prioritisation signal only — not an insight trigger.

*Rationale: a single site going quiet is a management task handled by the visit wizard. Multiple sites going quiet simultaneously is a systemic finding — the safety intelligence loop is failing at scale, which is an organisational capacity gap, not a site-level one. It warrants the same insight pipeline as any other cross-site pattern.*

**Prompt variant required:** `CANONICAL-USER-PROMPT-STAGE-1-ATROPHY-PATTERN` in `CRITICAL-INSIGHT.md` — to be added. Until then this trigger is spec-only.

---

### Situational Brief + CoP Thread

Both fire from the same trigger events, evaluated against the FW capacity profile:

**Trigger 1 — Intelligence event with manager-scope sharing:**
When a `critical_insight` is approved OR an `investigation` closes with `cleared_for_sharing = true`, AND the entity's `sharing_scope IN ('region', 'division', 'organisation')`:
- Queue `situational_brief.generate`
- Queue `cop_thread.generate` (if `workspace.communities` active)

*Rationale: site-scoped events are handled at site level — managers see them in their site feed. It's region/division/org-level events that require the formal brief-and-thread pipeline.*

**Trigger 2 — FW profile threshold crossing:**
When the recomputed FW capacity profile shows a factor crossing from below threshold to above threshold (i.e., a factor newly becoming systemic):
- Queue `situational_brief.generate` with `trigger_source = 'fw_profile'`
- Queue `cop_thread.generate` with the factor as the framing anchor

*This is the algorithmic trigger — it fires when the aggregate picture changes, not just when individual events happen.*

### Visit Briefing

**Trigger — Visit plan created:**
When `visit_plan` is created with a `planned_date` in the future:
- Queue `visit_briefing.generate` immediately (briefing available for manager review at any time)
- Re-generate if significant new intelligence arrives before the visit date: new approved insight in scope, new investigation closed, or worksite atrophy state transitions to `critical`

The atrophy state does not independently trigger briefing generation. It influences which site the manager decides to visit — that decision (visit_plan creation) is what queues the briefing. Atrophy state is an input to the site intelligence snapshot the briefing receives, not a separate trigger.

---

## Notifications

| Event | Code | Recipient |
|---|---|---|
| Situational brief ready for review | N-BRIEF-DRAFT | Safety manager (sharing scope) |
| CoP thread ready for approval | N-COP-DRAFT | Safety manager |
| Visit briefing generated | N-VISIT-BRIEF | Manager (visit plan creator) |
| Visit summary generated | N-VISIT-SUMMARY | Manager (visit plan creator) |

Atrophy state changes do not generate push notifications. Elevated and critical sites are surfaced passively in the visit wizard and the manager's site list. A low-frequency digest (V2) may summarise atrophy state across a manager's portfolio — see V2 Notes.

---

## Sim Reference

No sim exists yet. When built: `simulators/systemic-causes.html` should exercise the FW profile computation with mock classified entity data, demonstrate the atrophy score calculation across scenarios, and walk through the visit wizard flow. It cannot be a Live Sim in the full sense (no real-time AI needed for aggregation) — it should be a tool for verifying the algorithm against known inputs.

---

## Spec Authority Cross-Reference

| Output | Prompts + schema owned by |
|---|---|
| Situational brief | `features/SITUATIONAL-BRIEF.md` |
| CoP thread seed | `features/COMMUNITIES.md` |
| Visit briefing | `features/VISIT-BRIEFING.md` |
| Visit summary (on complete) | This file (Stage: `visit_plan.summarise`) |
| FW classify job | `globals/fw-classify-job.md` |

The aggregation algorithm, atrophy score, visit_plan entity, and trigger logic are owned by this file. The output feature specs do not re-document triggers — they reference this file.

---

## V2 Notes

**Systemic pattern insight (V2)**
When the FW capacity profile crosses threshold for a factor that has never previously triggered a brief at this org level, the system could generate a `CriticalInsight` with `trigger_source = 'systemic_pattern'` — a macro-level synthesis insight distinct from the individual observation and incident pipeline. This would enter the insight pipeline at Stage 1 (AI generation), framing the systemic condition for safety manager review. V2 scope — requires a new trigger_source value, a new prompt variant in `CRITICAL-INSIGHT.md`, and a new Stage 1 prompt (`CANONICAL-USER-PROMPT-STAGE-1-SYSTEMIC-PATTERN`).

**Multi-factor visit briefing (V2)**
Visit briefing currently receives a single dominant fw_factor. V2: pass the full active_factors array and blind_spots list so the briefing can frame the site's full capacity picture, not just the top factor. See `VISIT-BRIEFING.md` V2 notes.

**Atrophy score per work type (V2)**
Currently atrophy is computed per worksite. V2: compute per worksite × work_type combination. A site may be active in civil work but atrophied in electrical — the work-type-level score allows focus area suggestion to be more precise.

**Atrophy digest notification (V2)**
A low-frequency digest (weekly or configurable) summarising atrophy state across a manager's portfolio: "3 of your 8 sites are elevated, 1 is critical." Replaces the per-site push model entirely. Not a V1 feature — V1 relies on passive surfacing in the visit wizard.

---

*Last updated: May 2026. Update this file when: atrophy signal definitions change; visit_plan schema changes; FW aggregation thresholds or weights change; trigger conditions for outputs change. After updating, verify SITUATIONAL-BRIEF.md, COMMUNITIES.md, and VISIT-BRIEFING.md trigger references remain consistent with this file.*
