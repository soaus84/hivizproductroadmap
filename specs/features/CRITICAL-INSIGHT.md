# CRITICAL-INSIGHT.md — Critical Insight Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for all prompt text, schemas, and pipeline logic related to critical insight generation, review, and FW Map® classification.** Simulators and the prompt lab load from this file.

---

## What This Feature Is

A Critical Insight is the platform's primary intelligence output — a pattern-level finding that surfaces systemic safety conditions across one or more sites. It can be triggered four ways, but the pipeline is the same regardless of source: AI drafts the insight, a safety manager reviews it, and on approval it becomes available for toolbox talk assembly, FW Map® classification, situational briefs, and community threads.

The feature has four stages:

```
Stage 1 — Insight generation       critical_insight.generate   (async AI — two prompt variants)
Stage 2 — Human review             (safety manager — workbench UI)
Stage 3 — FW Map® classification   fw_classify (insight path)  (async AI — on approval)
Stage 4 — Downstream dispatch      (situational brief, CoP thread seed — see their feature specs)
```

---

## Trigger Sources

| `trigger_source` | What fires it | Input to Stage 1 |
|---|---|---|
| `algorithm` | Trend detection threshold crossed | Cluster of anonymised enriched observations |
| `solo_critical` | Single critical-severity incident | Single incident record |
| `critical_observation` | Single `barrier_failure` or `unwanted_energy_event` observation with `signal_type_confidence >= 0.70` | Single enriched observation record |
| `manual` | Safety manager creates directly | Manager-authored content — Stage 1 skipped |
| `external_alert` | Regulator / industry body / client alert | External content — Stage 1 skipped |
| `external_investigation` | Finding from another system | External content — Stage 1 skipped |

**Manual and external trigger sources bypass Stage 1 entirely.** Content is authored by the safety manager directly. `cleared_for_toolbox = true` is set immediately on creation — there is no AI draft and no review step. `fw_classify` queues immediately on creation. These sources are not documented further in this spec — their pipeline starts at Stage 3.

---

## Global References Used

Critical insight generation receives already-classified upstream values (cluster signal type breakdown, enriched observation fields, incident severity) and uses them to frame and contextualise the generated narrative — it does not re-classify. Taxonomy globals are therefore injected at **Enum** level for validation and pass-through framing. The Blueprint reaches the pipeline only at Stage 3 (`fw_classify`), which loads it in **Full** per its own job spec — Stage 1 of this file does not receive Blueprint content.

| Global | File | Used for | Injection level |
|---|---|---|---|
| Signal type taxonomy | `globals/signal-type-taxonomy.md` | Signal type breakdown in algorithm trigger input — values pass through, no re-classification | **Enum** (Stage 1) |
| Energy type taxonomy | `globals/energy-type-taxonomy.md` | `energy_type` and `energy_release_potential` values consumed in critical_observation trigger user prompt to frame the toolbox narrative; not re-classified | **Enum** (Stage 1) |
| Barrier assessment values | `globals/barrier-assessment-values.md` | Barrier state in observation summaries passed to prompt; not re-classified | **Enum** (Stage 1) |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, rationale standard, draft status, audit logging | Spec-only |
| Anonymisation rules | `globals/anonymisation-rules.md` | Observation summaries scrubbed before Stage 1 prompt | Spec-only |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | Injected in full into `fw_classify` (Stage 3) system prompt at runtime — Stage 1 does not receive Blueprint content | **Full** (Stage 3 only — via `fw-classify-job.md`) |

---

## Sim Reference

- `simulators/workflow-sim.html` — Scenario 0 ("Near-miss → Toolbox Talk") exercises the full insight pipeline in scripted form using static mock data. The sim does not make live AI calls for insight generation.
- **Prompt lab** — loads Stage 1 (both variants) and Stage 3 from this file.

---

## Stage 1 — Insight Generation

**Job:** `critical_insight.generate`
**Triggered:** Trend threshold crossed (algorithm) OR critical incident created (solo_critical) OR single critical observation (critical_observation)
**Input:** Varies by trigger source — see prompt variants below
**Output:** Draft CriticalInsight with `cleared_for_toolbox = false`
**Human gate:** Safety manager review required before `cleared_for_toolbox` is set
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-1

Single system prompt used for both algorithm and solo_critical variants:

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

### User Prompt Template — Algorithm Trigger

Used when `trigger_source = algorithm`. Observation summaries must be scrubbed per `globals/anonymisation-rules.md` before inclusion.

```
A trend threshold has been crossed.

Trigger source: algorithm

Work type: {{work_type_label}}
Org level: {{level}} — {{level_name}}
Time window: {{window_days}} days
Signal types in cluster: {{signal_type_breakdown_json}}
Observation count: {{count}} (threshold: {{threshold}})

Anonymised observation summaries:
{{observation_summaries_json}}
// Each item: { "summary": "...", "signal_type": "at_risk_condition", "energy_type": "kinetic",
//              "barrier_assessment": "barrier_degraded", "key_hazard_rationale": "..." }

Return JSON:
{
  "pattern_summary": "2-3 sentences. What the pattern is and why it matters operationally.",
  "pattern_summary_basis": "1 sentence. Which observations most strongly evidence this pattern.",
  "likely_systemic_cause": "1 sentence. The underlying condition probably driving this pattern.",
  "likely_systemic_cause_rationale": "1 sentence. What points to this cause rather than others.",
  "recommended_action": "1 sentence. The change that would most directly address the cause.",
  "recommended_action_rationale": "1 sentence. Why this addresses the root cause, not a symptom.",
  "toolbox_narrative": "4-6 sentences. Written so a supervisor can read it aloud to their crew. Plain English. Present tense. No jargon. No blame. Opens with what the crew needs to know today.",
  "escalate_to_systemic": false,
  "escalation_rationale": null
}
```

### User Prompt Template — Solo Critical Trigger

Used when `trigger_source = solo_critical`. Incident description scrubbed per `globals/anonymisation-rules.md`.

```
A critical incident has been reported that warrants immediate intelligence generation
without waiting for trend accumulation.

Trigger source: solo_critical

Work type: {{work_type_label}}
Org level: site — {{worksite_name}}
Incident type: {{incident_type}}
Severity class: critical
Injury classification: {{injury_classification}}
Incident description: {{incident_description}}
Immediate actions taken: {{immediate_action_taken | "None recorded"}}

This is a single event, not a pattern. Your output should:
- Frame the intelligence around what this event reveals about systemic conditions
- Not speculate beyond what the evidence supports
- Acknowledge it is a single event while being direct about the risk it represents
- Focus on what other sites need to know and check immediately

Return JSON:
{
  "pattern_summary": "2-3 sentences. What this incident reveals about conditions that may exist more broadly. Acknowledge the single-event basis without hedging the risk.",
  "pattern_summary_basis": "1 sentence. Which specific elements of the incident description support this framing.",
  "likely_systemic_cause": "1 sentence. The underlying condition this incident most likely reflects.",
  "likely_systemic_cause_rationale": "1 sentence. What in the incident description points to this cause.",
  "recommended_action": "1 sentence. The most important immediate check or action for other sites.",
  "recommended_action_rationale": "1 sentence. Why this action directly addresses the likely cause.",
  "toolbox_narrative": "4-6 sentences. Written for a supervisor to read aloud. Plain English. Present tense. Opens with the reality of what happened and what crews need to know and do today.",
  "escalate_to_systemic": true,
  "escalation_rationale": "1 sentence. A critical incident warrants systemic investigation to understand whether these conditions are present elsewhere."
}
```

**Note on `escalate_to_systemic` for solo_critical:** Defaults to `true` — a critical severity incident is presumed to warrant systemic investigation. The human review gate still applies; the reviewer can downgrade to `false` if they disagree.

### User Prompt Template — Critical Observation Trigger

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
  "pattern_summary": "2-3 sentences. What this observation reveals about the state of controls for this work type. Acknowledge the single-observation basis without hedging the risk.",
  "pattern_summary_basis": "1 sentence. Which specific elements of the observation support this framing.",
  "likely_systemic_cause": "1 sentence. The underlying condition this observation most likely reflects.",
  "likely_systemic_cause_rationale": "1 sentence. What in the observation points to this cause.",
  "recommended_action": "1 sentence. The most important immediate check or action for this and other sites.",
  "recommended_action_rationale": "1 sentence. Why this action directly addresses the likely cause.",
  "toolbox_narrative": "4-6 sentences. Written for a supervisor to read aloud to their crew. Plain English. Present tense. No jargon. No blame. Opens with what the crew needs to know and check today.",
  "escalate_to_systemic": false,
  "escalation_rationale": null
}
```

**Note on `escalate_to_systemic` for critical_observation:** Defaults to `false` — a critical observation indicates a control failure, not confirmed harm. The reviewer can escalate to `true` if the observation warrants systemic investigation, but it is not the presumption. Contrast with `solo_critical` (incident) which defaults to `true`.

**Note on `energy_release_potential`:** AI-derived by `observation.enrich` — not collected during capture. Values: `catastrophic|high|moderate|low|none`. See `globals/energy-type-taxonomy.md` §Energy Release Potential for definitions. A `catastrophic` value combined with `barrier_failure` or `unwanted_energy_event` represents the highest-severity critical observation the pipeline can receive.

### Validation Rules

- `pattern_summary` must be 2–3 sentences — not a single sentence (too thin), not a paragraph
- `toolbox_narrative` must be 4–6 sentences — validated on storage
- `likely_systemic_cause` must be a single sentence
- `recommended_action` must be a single, implementable action — not a list
- `escalation_rationale` must be non-null when `escalate_to_systemic = true`; must be null when false
- Observation summaries passed in must have `ai_anonymisation_flags` applied before prompt construction

### Storage

```sql
-- Fields written by critical_insight.generate
critical_insight.pattern_summary         TEXT
critical_insight.pattern_summary_basis   TEXT      -- stored but not shown in UI — internal evidence trail
critical_insight.likely_systemic_cause   TEXT
critical_insight.likely_systemic_cause_rationale TEXT
critical_insight.recommended_action      TEXT
critical_insight.recommended_action_rationale    TEXT
critical_insight.toolbox_narrative       TEXT
critical_insight.escalate_to_systemic    BOOLEAN
critical_insight.escalation_rationale    TEXT
critical_insight.ai_generated_at         TIMESTAMPTZ
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
- Safety manager edits `pattern_summary`, `likely_systemic_cause`, `recommended_action`, or `toolbox_narrative`
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

Solo_critical bypasses the cooldown — a critical incident always generates an insight regardless of recent history.

Critical_observation bypasses the cooldown — a single critical observation (barrier_failure or unwanted_energy_event) always generates an insight regardless of recent history for that work type.

---

## Notification Events

| Trigger | Notification | Recipients |
|---|---|---|
| Insight draft created (algorithm/solo_critical) | N-INSIGHT-DRAFT | Safety manager |
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

**Multi-factor fw_factors into situational brief (V2)**
V1 situational brief generation receives a single `fw_factor`. V2: pass full arrays. See `SITUATIONAL-BRIEF.md`.

---

*Last updated: May 2026. Update this file when: prompt text changes; output schema changes; review action payload changes; FW classification schema changes. After updating, verify prompt lab P entries load correctly and that workflow-sim.html scenario descriptions remain accurate.*
