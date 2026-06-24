# CRITICAL-INSIGHT.md — Critical Insight Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.2 — May 2026

> **This is the canonical source for all prompt text, schemas, and pipeline logic related to critical insight generation, review, and FW Map® classification.** Simulators and the prompt lab load from this file.

---

## What This Feature Is

A Critical Insight is the platform's primary intelligence output — a pattern-level finding that surfaces systemic safety conditions across one or more sites. It can be triggered five ways, but the pipeline is the same regardless of source: AI drafts the insight, a safety manager reviews it, and on approval it becomes available for toolbox talk assembly, FW Map® classification, situational briefs, and community threads.

The feature has four stages:

```
Stage 1 — Insight generation       critical_insight.generate   (async AI — four prompt variants)
Stage 2 — Human review             (safety manager — workbench UI)
Stage 3 — FW Map® classification   fw_classify (insight path)  (async AI — on approval)
Stage 4 — Downstream dispatch      (situational brief, CoP thread seed — see their feature specs)
```

---

## Trigger Sources

| `trigger_source` | What fires it | Input to Stage 1 |
|---|---|---|
| `algorithm` | Trend detection threshold crossed | Cluster of anonymised enriched observations |
| `critical_observation` | Single `barrier_failure` or `unwanted_energy_event` observation with `signal_type_confidence >= 0.70` | Single enriched observation record |
| `atrophy_pattern` | ≥ 3 worksites within a region or division transition to `elevated` or `critical` atrophy state within a 14-day window | Org level scope, affected site names + atrophy states, window |
| `platform_pattern` | Pattern detected across platform-derived signals (atrophy, corrective action debt, verification gaps, talk delivery failures) — V2 | Cluster of platform activity signals across sites in scope |
| `manual` | Safety manager creates directly | Manager-authored content — Stage 1 skipped |
| `external_alert` | Regulator / industry body / client alert | External content — Stage 1 skipped |
| `external_investigation` | Finding from another system | External content — Stage 1 skipped |


**External investigation trigger:** A CriticalInsight created via `external_investigation` originates from the systemic cause phase of a completed investigation — see `INVESTIGATION.md` Stage 3. This is the only sanctioned bridge between the incident pipeline and the insight pipeline. The safety manager authors the content directly; Stage 1 (AI generation) is skipped. `cleared_for_toolbox = true` is set immediately on creation. `fw_classify` queues immediately.

**Manual and external trigger sources bypass Stage 1 entirely.** Content is authored by the safety manager directly. `cleared_for_toolbox = true` is set immediately on creation — there is no AI draft and no review step. `fw_classify` queues immediately on creation. These sources are not documented further in this spec — their pipeline starts at Stage 3.

---

## Card Label Derivation

Pipeline cards display a human-readable label derived from `generated_at_level`. This is a UI derivation — there is no separate `card_type` or `insight_type` field in the database.

| `generated_at_level` | Card label | Badge style |
|---|---|---|
| `site` | Worksite Trend | `badge-worksite` |
| `region` | Cross-site Pattern | `badge-cross-site` |
| `division` | Cross-site Pattern | `badge-cross-site` |
| `organisation` | Cross-site Pattern | `badge-cross-site` |

This derivation applies in the pipeline Kanban, the worksite dashboard open insights strip, and any other surface that renders an insight card. The label must always reflect `generated_at_level` at render time — it is not stored.

The distinction maps directly to how the algorithm generates the insight: a site-level trigger means the threshold was crossed within a single worksite's observation pool. A region, division, or organisation-level trigger means the threshold was crossed across the aggregated pool for that scope — meaning multiple sites contributed observations.

---

## Global References Used

Critical insight generation receives already-classified upstream values (cluster signal type breakdown, enriched observation fields, incident severity) and uses them to frame and contextualise the generated narrative — it does not re-classify. Under Rule 1, every taxonomy reference still injects its `SUMMARY-REFERENCE` block at runtime — the Summary descriptions ground accurate pass-through framing. The full Blueprint reaches the pipeline only at Stage 3 (`fw_classify`), which loads it under Rule 2. The `Role` column is diagnostic — see `HOW-TO-READ-THIS.md §Global Injection Rules`.

| Global | File | Used for | Role |
|---|---|---|---|
| Signal type taxonomy | `globals/signal-type-taxonomy.md` | Signal type breakdown in algorithm trigger input — values pass through, no re-classification | pass-through (Stage 1) |
| Energy type taxonomy | `globals/energy-type-taxonomy.md` | `energy_type` and `energy_release_potential` values consumed in critical_observation trigger user prompt to frame the toolbox narrative; not re-classified | pass-through (Stage 1) |
| Barrier assessment values | `globals/barrier-assessment-values.md` | Barrier state in observation summaries passed to prompt; not re-classified | pass-through (Stage 1) |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, rationale standard, draft status, audit logging | behavioural |
| Anonymisation rules | `globals/anonymisation-rules.md` | Observation summaries scrubbed before Stage 1 prompt | behavioural |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | Full Blueprint injected into `fw_classify` (Stage 3) under Rule 2 — Stage 1 of this file does not reference the Blueprint | Rule 2 — Full (Stage 3 only — via `fw-classify-job.md`) |

---

## Sim Reference

- `simulators/workflow-sim.html` — Scenario 0 ("Near-miss → Toolbox Talk") exercises the full insight pipeline in scripted form using static mock data. The sim does not make live AI calls for insight generation.
- **Prompt lab** — loads Stage 1 (all four variants: Worksite Trend, Cross-site Pattern, Critical Observation, and Atrophy Pattern) and Stage 3 from this file.

---

## Stage 1 — Insight Generation

**Job:** `critical_insight.generate`
**Triggered:** Trend threshold crossed (algorithm) OR single critical observation (critical_observation)
**Input:** Varies by trigger source — see prompt variants below
**Output:** Draft CriticalInsight with `cleared_for_toolbox = false`
**Human gate:** Safety manager review required before `cleared_for_toolbox` is set
**Max tokens:** 1000

### Prompt variant selection

| `trigger_source` | `generated_at_level` | Prompt variant |
|---|---|---|
| `algorithm` | `site` | `CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-WORKSITE-TREND` |
| `algorithm` | `region` / `division` / `organisation` | `CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-CROSS-SITE-PATTERN` |
| `critical_observation` | `site` (always) | `CANONICAL-USER-PROMPT-STAGE-1-CRITICAL-OBSERVATION` |
| `atrophy_pattern` | `region` / `division` (always) | `CANONICAL-USER-PROMPT-STAGE-1-ATROPHY-PATTERN` |

---

### CANONICAL-SYSTEM-PROMPT-STAGE-1

Single system prompt used for all Stage 1 variants:

```
You are a senior safety advisor drafting internal safety intelligence for a construction
and resource industry platform.

Your writing voice:
- Direct and plain-spoken — no corporate safety jargon
- Experienced and measured — not alarmist
- Focused on systemic causes, never individual blame
- Written as if speaking to safety managers who are experienced professionals

You do not name individuals, specific dates, or identify specific worksites beyond
what the org level scope permits.

You output only valid JSON with no preamble, explanation, or markdown formatting.
```

---

### CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-WORKSITE-TREND

Used when `trigger_source = algorithm` AND `generated_at_level = 'site'`. Observation summaries must be scrubbed per `globals/anonymisation-rules.md` before inclusion.

```
A trend threshold has been crossed at a single worksite.

Trigger source: algorithm
Card label: Worksite Trend

Work type: {{work_type_label}}
Org level: site — {{level_name}}
Time window: {{window_days}} days
Signal types in cluster: {{signal_type_breakdown_json}}
Observation count: {{count}} (threshold: {{threshold}})
Sites affected: 1

Anonymised observation summaries:
{{observation_summaries_json}}
// Each item: { "summary": "...", "signal_type": "at_risk_condition", "energy_type": "kinetic",
//              "barrier_assessment": "barrier_degraded", "key_hazard_rationale": "..." }

This pattern is contained to a single site. Your output should:
- Frame the intelligence around what conditions at this site are producing this trend
- Not imply or speculate about conditions at other sites
- Focus on what needs to change at site level to break the pattern
- Write the toolbox narrative for the crew at this site

Return JSON:
{
  "title": "5-10 words. A plain-English headline for this insight — written as a finding, not a label. Specific enough to distinguish this insight from others of the same trigger type. No jargon.",
  "pattern_summary": "2-3 sentences. What the pattern is and why it matters operationally.",
  "pattern_summary_basis": "1 sentence. Which observations most strongly evidence this pattern.",
  "likely_systemic_cause": "1 sentence. The underlying condition probably driving this pattern.",
  "likely_systemic_cause_rationale": "1 sentence. What points to this cause rather than others.",
  "recommended_actions": [
    {"step": 1, "action": "Most immediate action — what must happen first."},
    {"step": 2, "action": "Follow-up action — only include if genuinely sequential, not parallel."}
  ],
  "recommended_actions_note": "1-3 steps maximum. Steps must be genuinely sequential — each depends on or follows the previous. Do not split one action into sub-tasks. Do not list parallel actions as separate steps.",
  "recommended_action_rationale": "1 sentence. Why these steps address the root cause rather than a symptom.",
  "recommended_questions": [
    "Question to send to worksites to probe this finding — specific and answerable in the field.",
    "Second question — only include if it probes a genuinely distinct aspect of the finding."
  ],
  "recommended_questions_note": "1-3 questions maximum. Each question must be specific enough that a supervisor can answer it from direct observation. Do not ask questions that can only be answered by reviewing records or by management.",
  "toolbox_narrative": "4-6 sentences. Written so a supervisor can read it aloud to their crew. Plain English. Present tense. No jargon. No blame. Opens with what the crew needs to know today.",
  "recommended_dissemination_scope": "affected_sites | work_type_in_scope | full_scope. This is a site-level pattern — default to affected_sites unless the cause is structural to this work type at any site, in which case recommend work_type_in_scope.",
  "recommended_dissemination_rationale": "1 sentence. Why this scope is the right target for the corrective action.",
  "escalate_to_systemic": false,
  "escalation_rationale": null
}
```

---

### CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-CROSS-SITE-PATTERN

Used when `trigger_source = algorithm` AND `generated_at_level IN ('region', 'division', 'organisation')`. Observation summaries must be scrubbed per `globals/anonymisation-rules.md` before inclusion.

```
A trend threshold has been crossed across multiple sites at {{level}} level.

Trigger source: algorithm
Card label: Cross-site Pattern

Work type: {{work_type_label}}
Org level: {{level}} — {{level_name}}
Time window: {{window_days}} days
Signal types in cluster: {{signal_type_breakdown_json}}
Observation count: {{count}} (threshold: {{threshold}})
Sites affected: {{sites_affected_count}}

Anonymised observation summaries:
{{observation_summaries_json}}
// Each item: { "summary": "...", "signal_type": "at_risk_condition", "energy_type": "kinetic",
//              "barrier_assessment": "barrier_degraded", "key_hazard_rationale": "..." }

This is a cross-site pattern — observations have been drawn from {{sites_affected_count}} sites
within the {{level}} scope. Your output should:
- Frame the intelligence as a shared systemic condition, not a local site problem
- Acknowledge the cross-site spread explicitly in pattern_summary
- Identify the underlying systemic cause that could be present across sites
- Write the toolbox narrative so it is relevant to any crew in this work type — not site-specific
- Consider whether the pattern warrants systemic escalation given its breadth

Return JSON:
{
  "title": "5-10 words. A plain-English headline for this insight — written as a finding, not a label. Should convey the cross-site nature of the pattern. No jargon.",
  "pattern_summary": "2-3 sentences. What the pattern is, that it spans multiple sites, and why this breadth matters operationally.",
  "pattern_summary_basis": "1 sentence. Which observations or signal types most strongly evidence this as a systemic rather than local pattern.",
  "likely_systemic_cause": "1 sentence. The shared underlying condition that probably explains why this is appearing across sites.",
  "likely_systemic_cause_rationale": "1 sentence. What points to a shared cause rather than coincidental local factors.",
  "recommended_actions": [
    {"step": 1, "action": "Most immediate action — what must happen first across all affected sites."},
    {"step": 2, "action": "Follow-up action — only include if genuinely sequential, not parallel."}
  ],
  "recommended_actions_note": "1-3 steps maximum. Steps must be genuinely sequential — each depends on or follows the previous. Do not split one action into sub-tasks. Do not list parallel actions as separate steps.",
  "recommended_action_rationale": "1 sentence. Why these steps address the root cause rather than a symptom.",
  "recommended_questions": [
    "Question to send to worksites to probe this finding — specific and answerable in the field.",
    "Second question — only include if it probes a genuinely distinct aspect of the finding."
  ],
  "recommended_questions_note": "1-3 questions maximum. Each question must be specific enough that a supervisor can answer it from direct observation. Do not ask questions that can only be answered by reviewing records or by management.",
  "toolbox_narrative": "4-6 sentences. Written so a supervisor can read it aloud to any crew doing this work type. Plain English. Present tense. No jargon. No blame. Opens with what crews across the region need to know today.",
  "recommended_dissemination_scope": "affected_sites | work_type_in_scope | full_scope. This is a cross-site pattern — default to work_type_in_scope since the pattern has already crossed sites for this work type. Use full_scope only if the cause is role or practice based rather than work-type specific.",
  "recommended_dissemination_rationale": "1 sentence. Why this scope is the right target for the corrective action.",
  "escalate_to_systemic": false,
  "escalation_rationale": null
}
```

**Note on `escalate_to_systemic` for cross-site patterns:** The AI should set this to `true` if `sites_affected_count` is high relative to total sites in scope, or if barrier assessments across the cluster show systemic failure rather than isolated events. The human review gate still applies; the reviewer can downgrade to `false` if they disagree.

---


### CANONICAL-USER-PROMPT-STAGE-1-CRITICAL-OBSERVATION

Used when `trigger_source = critical_observation`. Observation text scrubbed per `globals/anonymisation-rules.md` before inclusion.

```
A single field observation has been classified as a critical signal — one event is sufficient to warrant intelligence generation.

Trigger source: critical_observation

Work type: {{work_type_label}}
Org level: site — {{worksite_name}}
Signal type: {{signal_type}}
Energy type: {{energy_type}}
Energy release potential: {{energy_release_potential}}
Barrier assessment: {{barrier_assessment}}
Key hazard: {{key_hazard}}
Key hazard rationale: {{key_hazard_rationale}}
Stop work warranted (AI): {{stop_work_warranted}}
Stop work called (observer): {{stop_work_called}}
Observation: {{what_was_observed}}

This is a single field observation, not a confirmed incident and not an accumulated pattern.
Your output should:
- Frame the intelligence around what this observation reveals about control adequacy at this site
- Be direct about the control failure without speculation beyond what the observation describes
- Acknowledge the single-observation basis — do not imply a pattern unless one is evidenced
- Focus on what other crews and sites need to check or know immediately
- If stop_work_warranted is true and stop_work_called is false, note the divergence as relevant context

Return JSON:
{
  "title": "5-10 words. A plain-English headline for this insight — written as a finding, not a label. Specific to this observation's hazard or control failure. No jargon.",
  "pattern_summary": "2-3 sentences. What this observation reveals about the state of controls for this work type. Acknowledge the single-observation basis without hedging the risk.",
  "pattern_summary_basis": "1 sentence. Which specific details of the observation most strongly support this framing.",
  "likely_systemic_cause": "1 sentence. The underlying control gap this observation most likely reflects.",
  "likely_systemic_cause_rationale": "1 sentence. What in the observation points to this cause rather than a one-off error.",
  "recommended_actions": [
    {"step": 1, "action": "Most urgent action — immediate check or intervention for crews doing this work now."},
    {"step": 2, "action": "Follow-up action — only include if genuinely sequential, not parallel."}
  ],
  "recommended_actions_note": "1-3 steps maximum. Steps must be genuinely sequential — each depends on or follows the previous. A single critical observation often warrants only one step. Do not list parallel actions as separate steps.",
  "recommended_action_rationale": "1 sentence. Why these steps directly address the identified control gap.",
  "recommended_questions": [
    "Question to send to worksites to probe this finding — specific and answerable in the field.",
    "Second question — only include if it probes a genuinely distinct aspect of the finding."
  ],
  "recommended_questions_note": "1-3 questions maximum. Each question must be specific enough that a supervisor can answer it from direct observation. Do not ask questions that can only be answered by reviewing records or by management.",
  "toolbox_narrative": "4-6 sentences. Written for a supervisor to read aloud to their crew. Plain English. Present tense. No jargon. No blame. Opens with what crews need to know and check today.",
  "recommended_dissemination_scope": "affected_sites | work_type_in_scope | full_scope. This is a single critical observation — default to affected_sites for immediate action. Recommend work_type_in_scope if the control gap is structural to this work type (i.e. likely present wherever this work runs, not just where it was observed).",
  "recommended_dissemination_rationale": "1 sentence. Why this scope is the right target for the corrective action.",
  "escalate_to_systemic": false,
  "escalation_rationale": null
}
```

---

### CANONICAL-USER-PROMPT-STAGE-1-ATROPHY-PATTERN

Used when `trigger_source = atrophy_pattern`. Always generated at `region` or `division` level. No observation summaries are passed — this trigger fires on platform activity signals, not field observations. Site names within the org level scope are included as context; no personal data scrubbing applies.

```
The safety intelligence loop has degraded simultaneously across multiple worksites within a {{org_level}} scope.

Trigger source: atrophy_pattern
Card label: Cross-site Pattern

Org level: {{org_level}} — {{level_name}}
Window: {{window_days}} days
Worksites that have transitioned to elevated or critical atrophy state within this window:
{{sites_affected_json}}
// Each item: { "site_name": "...", "atrophy_state": "elevated" | "critical" }

Atrophy state reference:
- elevated: signals are ageing — observations, toolbox talks, or manager visits are significantly overdue
- critical: the intelligence loop is severely stale — the organisation has very low visibility into conditions at this site

This trigger fires when multiple worksites within the same {{org_level}} reach elevated or critical state within the same window. This is not a field observation pattern — there is no cluster of field observations to analyse. The signal is that multiple sites have gone quiet simultaneously, which points to a shared organisational condition rather than isolated local factors at each site.

Your output should:
- Frame the finding as an organisational capacity signal: the problem is not what is happening in the field, but that the organisation is losing visibility across multiple sites at once
- Name the scale and simultaneity — multiple sites degrading in the same short window is what distinguishes this from individual site management tasks
- Identify what is most likely driving simultaneous loop failure — common causes include management capacity, competing operational pressures, insufficient visit cadence, or an environment where intelligence activities are treated as discretionary
- Write the toolbox narrative to help crews understand why their active participation in the safety intelligence loop matters to their own safety — not as a compliance prompt
- Set escalate_to_systemic to true if any affected sites are in critical atrophy state

Return JSON:
{
  "title": "5-10 words. A plain-English headline for this insight — written as a finding, not a label. Should convey the visibility loss or organisational capacity angle. No jargon.",
  "pattern_summary": "2-3 sentences. What the degradation pattern is, across how many sites within the {{org_level}}, and why this matters — frame it as lost organisational visibility, not a process compliance issue.",
  "pattern_summary_basis": "1 sentence. What about the scale, timing, or distribution of atrophy states most strongly points to a shared cause rather than coincidental local factors.",
  "likely_systemic_cause": "1 sentence. The underlying organisational condition most likely driving simultaneous loop degradation across these sites.",
  "likely_systemic_cause_rationale": "1 sentence. What about the pattern — number of sites, window, or mix of atrophy states — points to this cause rather than independent local issues.",
  "recommended_actions": [
    {"step": 1, "action": "Most immediate action — what must happen first to restore visibility across these sites."},
    {"step": 2, "action": "Follow-up action — only include if genuinely sequential, not parallel."}
  ],
  "recommended_actions_note": "1-3 steps maximum. Steps must be genuinely sequential — each depends on or follows the previous. Do not split one action into sub-tasks. Do not list parallel actions as separate steps.",
  "recommended_action_rationale": "1 sentence. Why these steps address the root cause of loop failure rather than a surface symptom.",
  "recommended_questions": [
    "Question to send to sites to probe why the loop has degraded — specific and answerable by a site supervisor.",
    "Second question — only include if it probes a genuinely distinct dimension of the degradation."
  ],
  "recommended_questions_note": "1-3 questions maximum. Each question must be specific enough that a supervisor can answer it from their current working conditions and workload. Do not ask questions that can only be answered by reviewing management records or systems.",
  "toolbox_narrative": "4-6 sentences. Written for a supervisor to read aloud to their crew. Plain English. Present tense. No jargon. No blame. Explains what the safety intelligence loop is, why it matters to the crew — not a compliance reminder — and what the crew can actively do to keep it healthy. Opens with what the crew needs to understand today.",
  "recommended_dissemination_scope": "affected_sites | work_type_in_scope | full_scope. This is an organisational capacity signal, not a work-type-specific finding — default to full_scope within the {{org_level}}. Use affected_sites only if the pattern is narrowly concentrated and clearly does not indicate a broader organisational condition.",
  "recommended_dissemination_rationale": "1 sentence. Why this scope reflects the nature of the signal — organisational capacity gap rather than a work-type-specific hazard.",
  "escalate_to_systemic": false,
  "escalation_rationale": null
}
```

**Note on `escalate_to_systemic` for atrophy patterns:** The AI should set this to `true` if any affected sites are in `critical` atrophy state, or if the number of degraded sites is large relative to total sites in scope. The human review gate still applies; the reviewer can downgrade to `false` if they disagree.

---

### Stage 1 Output Storage

```sql
critical_insight.title                              TEXT    -- 5-10 word headline; used as card title and list view label
critical_insight.pattern_summary                    TEXT
critical_insight.pattern_summary_basis              TEXT    -- rationale fields stored separately; not surfaced in UI by default
critical_insight.likely_systemic_cause              TEXT
critical_insight.likely_systemic_cause_rationale    TEXT
critical_insight.toolbox_narrative                  TEXT
critical_insight.escalate_to_systemic               BOOLEAN
critical_insight.escalation_rationale               TEXT
critical_insight.recommended_actions                JSONB
                                                    -- Ordered array of action steps from AI:
                                                    -- [{"step": 1, "action": "..."}, {"step": 2, "action": "..."}]
                                                    -- 1-3 steps; each step pre-populates one row in the improve step UI
critical_insight.recommended_action_rationale       TEXT
                                                    -- Why the recommended steps address the root cause
critical_insight.recommended_questions              JSONB
                                                    -- Array of enquiry questions generated from the same insight context:
                                                    -- ["Question 1...", "Question 2..."]
                                                    -- 1-3 questions; pre-populates the enquiry dispatch step
critical_insight.recommended_dissemination_scope    VARCHAR(30)
                                                    -- AI recommendation for improve step targeting
                                                    -- CHECK IN ('affected_sites', 'work_type_in_scope', 'full_scope')
critical_insight.recommended_dissemination_rationale TEXT
                                                    -- 1 sentence explaining the recommendation
critical_insight.ai_generated_at                    TIMESTAMPTZ
-- cleared_for_toolbox remains false until human approval
```

---

## Stage 2 — Human Review

**Actor:** Safety manager (workbench UI)
**Human gate:** Required — `cleared_for_toolbox` cannot be set without explicit review action

### Review actions

`POST /api/v1/critical-insights/:id/review` with body:
```json
{
  "action": "approved | edited | rejected",
  "edited_content": { /* optional — subset of content fields if edited */ },
  "sharing_scope": "site | region | division | organisation",
  "reviewer_notes": "string | null"
}
```

**On approval:**
- `cleared_for_toolbox = true`
- `reviewed_by_id`, `reviewed_at`, `review_action` set
- `sharing_scope` set
- `fw_classify` job queued (Stage 3)
- Toolbox talk content selection pool updated
- If `escalate_to_systemic = true`: systemic investigation workflow triggered, safety manager notified
- Notification N-INSIGHT-APPROVED fired to safety manager confirming

**On rejection:**
- `cleared_for_toolbox` remains false
- `status` set to `archived`
- Reviewer notes stored
- No further jobs queue

**On edit + approve:**
- Safety manager edits `pattern_summary`, `likely_systemic_cause`, `recommended_actions`, or `toolbox_narrative`
- Edited content stored as authoritative (replaces AI draft)
- `review_action = edited`
- Same downstream as approval

---

## Stage 3 — FW Map® Classification

**Job:** `fw_classify` (insight path)
**Triggered:** On approval — queues immediately after `cleared_for_toolbox = true` is set
**Input:** Approved insight content + trigger source context
**Output:** FW Map® classification stored as parallel arrays on the critical insight record
**Human gate:** None at classification — output displayed alongside insight in workbench UI with rationale

> **Canonical spec:** `globals/fw-classify-job.md` — system prompt, user prompt template (`CANONICAL-FW-CLASSIFY-USER-PROMPT-INSIGHT`), output schema, validation rules, and retry behaviour are all defined there. This section covers triggering, storage fields, and downstream effects specific to the critical insight entity.

### Storage — parallel arrays on the critical insight record

```sql
critical_insight.fw_factors[]          TEXT[]
critical_insight.fw_domains[]          TEXT[]
critical_insight.fw_maturity_signals[] TEXT[]
critical_insight.fw_confidences[]      DECIMAL(3,2)[]
critical_insight.fw_rationales[]       TEXT[]
critical_insight.fw_classification_basis TEXT
critical_insight.fw_classified_at      TIMESTAMPTZ
```

---

## Stage 4 — Downstream Dispatch

On `cleared_for_toolbox = true` and `fw_classified_at` set, the insight is available for:

- **Toolbox talk content selection** — insight enters the pool for the relevant work type. See `TOOLBOX-TALK.md`.
- **Situational brief generation** — `situational_brief.generate` queues if `sharing_scope` reaches manager level. See `SITUATIONAL-BRIEF.md`.
- **CoP thread seed candidate** — created for safety manager to review and seed. See `COMMUNITIES.md`.
- **Enquiry generation** — safety manager can trigger an enquiry directly from the insight workbench view. See `ENQUIRY.md` (trigger_source = critical_insight).

---

## Schema Notes

### First-class fields on the `critical_insight` entity

```sql
critical_insight.work_type_id               UUID REFERENCES work_type(id)
-- Always populated for algorithm and critical_observation triggers.
-- The work type the pattern was detected in — used to scope improve step targeting.
-- Null for manual, external_alert, and external_investigation triggers
-- (those are not work-type-specific by default).

critical_insight.contributing_worksite_ids  UUID[]
-- IDs of worksites whose observations contributed to this insight.
-- Populated from the observation pool query at trigger time.
-- For critical_observation: single worksite_id.
-- For algorithm triggers: all distinct worksite_ids in the cluster.
-- Used by the improve step to pre-populate the affected_sites targeting option.
-- Null for manual, external_alert, and external_investigation triggers.
```

### `trigger_event` JSONB shape by trigger source

```sql
-- algorithm (site-level / Worksite Trend):
--   { threshold, window_days, count, sites_affected_count: 1 }

-- algorithm (region/division/organisation-level / Cross-site Pattern):
--   { threshold, window_days, count, sites_affected_count: N }
--   sites_affected_count: number of distinct worksites contributing observations
--   to the cluster at trigger time. Populated from the observation pool query.
--   Note: actual worksite IDs are stored in contributing_worksite_ids[] above —
--   sites_affected_count here is retained for audit/display convenience.

-- critical_observation:
--   { observation_id, signal_type, barrier_assessment, energy_release_potential }

-- atrophy_pattern:
--   { org_level, window_days, sites_affected: [{ worksite_id, atrophy_state }] }
--   sites_affected: worksites that triggered the threshold crossing — same IDs as contributing_worksite_ids[]
--   site names are resolved from worksite table at prompt-build time; not stored in trigger_event

-- external_investigation:
--   { investigation_id, investigation_ref, systemic_cause_summary }
--   investigation_id: UUID of the source investigation
--   investigation_ref: human-readable reference (e.g. INV-0042)
--   systemic_cause_summary: 1-2 sentence summary authored at systemic cause phase initiation
```

`sites_affected_count` is available to the Stage 1 prompt for algorithm triggers and is used in `CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-CROSS-SITE-PATTERN` to give the AI concrete cross-site breadth context.

---

## Cooldown and Deduplication

The trend detection algorithm enforces a cooldown window to prevent duplicate insights:

```
IF critical_insight already exists WHERE:
  work_type_id = this.work_type_id
  AND generated_at_level = this level
  AND created_at >= now() - INTERVAL '{{org.trend_cooldown_days}} days'
THEN
  do not create a new insight — do not queue critical_insight.generate
```

Cooldown is configurable per organisation. Default: 30 days at site level, 14 days at region and above.

Critical_observation bypasses the cooldown — a single critical observation (barrier_failure or unwanted_energy_event with signal_type_confidence >= 0.70) always generates an insight regardless of recent history for that work type.

External_investigation bypasses the cooldown — a systemic cause finding from a closed investigation is always entered regardless of recent history. The safety manager's judgement is the quality gate.

Manual and external_alert also bypass cooldown.

---

## Notification Events

| Trigger | Notification | Recipients |
|---|---|---|
| Insight draft created (algorithm/critical_observation) | N-INSIGHT-DRAFT | Safety manager |
| Insight approved | N-INSIGHT-APPROVED | Safety manager confirmation |
| Insight rejected | N-INSIGHT-REJECTED | Safety manager confirmation |
| `escalate_to_systemic = true` on approval | N-INSIGHT-ESCALATE | Safety manager, senior leadership |
| Endorsed by peer manager | N-INSIGHT-ENDORSED | Originating safety manager |

See `SPEC.md` §11 for full notification event details.

---

## V2/V3 Cascade Notes

**fw_factors arrays into enquiry question generation (V2)**
In V1, enquiry question generation receives the insight's `likely_systemic_cause` but not the FW classification. V2: pass `fw_factors`, `fw_domains`, `fw_maturity_signals`, and `fw_rationales` into the question generation prompt. Question types are then selected per classified factor — Assurance Check for `management_systems` gaps, Work as Done for `work_understanding` gaps. See `ENQUIRY.md`.

**fw_maturity_signals into toolbox talk assembly (V2)**
In V1, the talk assembly prompt uses a fixed veteran supervisor voice. V2: pass `fw_maturity_signals` into talk assembly to adapt register — `compliant` framing focuses on procedure gaps, `leading` on what leaders should be noticing, `resilient` on adaptive practice. See `TOOLBOX-TALK.md`.

**Endorsement model (V2)**
`insight_endorsement` and `insight_comment` tables exist in the schema (V1). In V2, endorsements from peer managers at other sites feed back into the confidence weighting for `fw_classify` re-runs and surface in the CoP thread if seeded. High endorsement count is also a trigger signal for escalation recommendation.

**Cross-site pattern targeting for enquiry (V2)**
In V1, enquiry targeting defaults to source sites only regardless of insight level. V2: for Cross-site Pattern insights (`generated_at_level` = region/division/organisation), default targeting expands to all sites within that scope — not just the sites that contributed observations to the cluster. See `ENQUIRY.md`.

**Multi-factor fw_factors into situational brief (V2)**
V1 situational brief generation receives a single `fw_factor`. V2: pass full `fw_factors[]`, `fw_domains[]`, `fw_maturity_signals[]`, and `fw_rationales[]` arrays so the brief can name each factor with its rationale rather than naming only the top one. See `SITUATIONAL-BRIEF.md`.

**Platform-pattern trigger class (V2)**
A new `trigger_source = 'platform_pattern'` that mirrors the existing `algorithm` trigger but operates on platform-derived signals rather than field observations. Where the algorithm trigger pools field observations and detects trends, the platform_pattern trigger pools activity signals from the platform itself — persistent atrophy across multiple sites, corrective actions consistently going overdue, toolbox talks generated but not delivered, verification gaps accumulating — and fires a Critical Insight when a pattern threshold is crossed.

The insight generated follows the same pipeline: AI draft → human review → FW classification → toolbox / enquiry / CoP. Because it's a pattern-level finding (not a single event), it would likely classify against `operational_management`, `learning_systems`, or `communications_coordination` factors.

**Workspace gating for platform signals:** Each signal type is only valid once the workspace providing it is active. Atrophy signals require `workspace.analytics`. Verification gap signals require `workspace.risk`. Talk delivery signals require `workspace.core` (always available). A site with no verifications because `workspace.risk` is not active must not be treated as a verification gap — absence of data from an inactive workspace is not a signal. The platform_pattern algorithm must only pool signals from workspaces confirmed active for that organisation.
