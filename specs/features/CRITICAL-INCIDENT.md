# CRITICAL-INCIDENT.md — Critical Incident Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for all prompt text, schemas, and pipeline logic related to CriticalIncident generation and review.** This file is the incident pipeline's structural parallel to `CRITICAL-INSIGHT.md`. The pattern is the same: AI drafts the entity, a safety manager reviews it, and on approval an investigation opens. The only sanctioned bridge from this pipeline to the insight pipeline is through the systemic cause phase of the resulting investigation — see `INVESTIGATION.md` Stage 3.

---

## What This Feature Is

A CriticalIncident is the incident pipeline's primary intelligence entity — a pattern-level or severity-level finding that surfaces a condition requiring formal investigation. It sits between incident capture and investigation, providing a human review gate that ensures investigations are opened deliberately rather than automatically.

Two paths produce a CriticalIncident:

- **Trend / pool path** — low-severity incidents accumulate across a work type until a threshold is crossed. The platform detects the pattern and drafts a CriticalIncident for review.
- **Direct path** — a single incident of critical severity bypasses the pool. A CriticalIncident is drafted immediately.

Both paths are structurally identical from generation onwards. The feature has two stages:

```
Stage 1 — CriticalIncident generation   critical_incident.generate   (async AI — two prompt variants)
Stage 2 — Human review                  (safety manager — workbench UI — investigation opens on approval)
```

---

## Trigger Sources

| `trigger_source` | What fires it | Cooldown | Input to Stage 1 |
|---|---|---|---|
| `algorithm` | Incident trend threshold crossed — pool of moderate/minor severity incidents for same `work_type_id` at an org level | Applies | Cluster of incident records (scrubbed) |
| `critical_incident` | Single incident with `severity_class = 'critical'` — triage algorithm fires direct path | Bypasses | Single incident record |
| `manual` | Safety manager or investigator creates directly | Bypasses | Manager-authored content — Stage 1 skipped |

**Manual trigger bypasses Stage 1 entirely.** Content is authored by the safety manager directly. An investigation record is created immediately on manual submission — there is no AI draft and no review step. `fw_classify` queues immediately. These sources are not documented further in this spec — their pipeline starts at Stage 2 approval.

**Severity threshold for direct path:** `severity_class = 'critical'` only — fatality, permanent disability, or catastrophic equipment/environmental loss. This mirrors the `critical_observation` threshold in the observation pipeline (barrier_failure or unwanted_energy_event with confidence >= 0.70). Serious, moderate, and minor incidents enter the pool — they do not fire the direct path.

---

## Card Label Derivation

Pipeline cards display a human-readable label derived from `generated_at_level` and `trigger_source`. No separate `card_type` field — this is a UI derivation.

| `trigger_source` | `generated_at_level` | Card label | Badge style |
|---|---|---|---|
| `algorithm` | `site` | Site incident pattern | `badge-site` |
| `algorithm` | `region` / `division` / `organisation` | Cross-site incident pattern | `badge-cross-site` |
| `critical_incident` | `site` (always) | Critical incident | `badge-critical` |
| `manual` | any | Manual escalation | `badge-manual` |

---

## Global References Used

| Global | File | Used for | Role |
|---|---|---|---|
| Energy type taxonomy | `globals/energy-type-taxonomy.md` | `energy_type` values pass through from incident capture hints — not re-classified | pass-through (Stage 1) |
| Barrier assessment values | `globals/barrier-assessment-values.md` | `barrier_assessment` values pass through — not re-classified | pass-through (Stage 1) |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, rationale standard, draft status, audit logging | behavioural |
| Anonymisation rules | `globals/anonymisation-rules.md` | Incident descriptions scrubbed before Stage 1 prompt | behavioural |

FW Map® classification does not run on CriticalIncident entities directly. Classification runs on the resulting Investigation record — see `INVESTIGATION.md` Stage 5.

---

## Sim Reference

No sim exists yet. When built: a `critical-incident-sim.html` should exercise both trigger paths using static mock data, mirroring the structure of `observation-to-insight.html`.

---

## Stage 1 — CriticalIncident Generation

**Job:** `critical_incident.generate`
**Triggered:** Incident trend threshold crossed (algorithm) OR critical severity incident triage (critical_incident)
**Input:** Varies by trigger source — see prompt variants below
**Output:** Draft CriticalIncident record stored, pending human review
**Human gate:** Safety manager review required before investigation opens
**Max tokens:** 1000

### Prompt variant selection

| `trigger_source` | `generated_at_level` | Prompt variant |
|---|---|---|
| `algorithm` | `site` | `CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-SITE` |
| `algorithm` | `region` / `division` / `organisation` | `CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-CROSS-SITE` |
| `critical_incident` | `site` (always) | `CANONICAL-USER-PROMPT-STAGE-1-CRITICAL-INCIDENT` |

---

### CANONICAL-SYSTEM-PROMPT-STAGE-1

Single system prompt used for all Stage 1 variants:

```
You are a senior safety advisor drafting internal safety intelligence for a construction
and resource industry platform.

Your writing voice:
- Direct and plain-spoken — no corporate safety jargon
- Experienced and measured — not alarmist
- Focused on systemic conditions, never individual blame
- Written as if speaking to safety managers who are experienced professionals

You do not name individuals, specific dates, or identify specific worksites beyond
what the org level scope permits.

You output only valid JSON with no preamble, explanation, or markdown formatting.
```

---

### CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-SITE

Used when `trigger_source = algorithm` AND `generated_at_level = 'site'`. Incident descriptions must be scrubbed per `globals/anonymisation-rules.md` before inclusion.

```
An incident pattern threshold has been crossed at a single worksite.

Trigger source: algorithm
Card label: Site incident pattern

Work type: {{work_type_label}}
Org level: site — {{level_name}}
Time window: {{window_days}} days
Incident count: {{count}} (threshold: {{threshold}})
Severity distribution: {{severity_distribution_json}}
// e.g. { "moderate": 4, "minor": 2 }

Anonymised incident summaries:
{{incident_summaries_json}}
// Each item: { "incident_type": "near-miss", "description": "...", "energy_type": "kinetic",
//              "barrier_assessment": "barrier_degraded", "immediate_action_taken": "..." }

This pattern is contained to a single site. Your output should:
- Frame the intelligence around what conditions at this site are producing repeated incidents
- Not imply or speculate about conditions at other sites
- Identify the likely systemic condition — not individual failures
- Recommend an investigation scope that is proportionate to the pattern

Return JSON:
{
  "pattern_summary": "2-3 sentences. What the pattern is and why it warrants investigation.",
  "pattern_summary_rationale": "1 sentence. Which incidents most strongly evidence this pattern.",
  "likely_systemic_cause": "1 sentence. The underlying condition probably driving repeated incidents.",
  "likely_systemic_cause_rationale": "1 sentence. What points to this cause.",
  "recommended_investigation_scope": "1 sentence. What the investigation should focus on and why.",
  "recommended_investigation_scope_rationale": "1 sentence. Why this scope rather than a narrower or broader one."
}
```

---

### CANONICAL-USER-PROMPT-STAGE-1-ALGORITHM-CROSS-SITE

Used when `trigger_source = algorithm` AND `generated_at_level IN ('region', 'division', 'organisation')`. Incident descriptions must be scrubbed per `globals/anonymisation-rules.md` before inclusion.

```
An incident pattern threshold has been crossed across multiple sites at {{level}} level.

Trigger source: algorithm
Card label: Cross-site incident pattern

Work type: {{work_type_label}}
Org level: {{level}} — {{level_name}}
Time window: {{window_days}} days
Incident count: {{count}} (threshold: {{threshold}})
Sites affected: {{sites_affected_count}}
Severity distribution: {{severity_distribution_json}}

Anonymised incident summaries:
{{incident_summaries_json}}
// Each item: { "incident_type": "near-miss", "description": "...", "energy_type": "kinetic",
//              "barrier_assessment": "barrier_degraded", "immediate_action_taken": "..." }

This is a cross-site pattern — incidents have been drawn from {{sites_affected_count}} sites
within the {{level}} scope. Your output should:
- Frame the intelligence as a shared systemic condition, not a local site problem
- Acknowledge the cross-site spread explicitly in pattern_summary
- Identify the shared underlying condition that could explain incidents across sites
- Recommend an investigation scope appropriate to the cross-site breadth

Return JSON:
{
  "pattern_summary": "2-3 sentences. What the pattern is, that it spans multiple sites, and why this warrants investigation.",
  "pattern_summary_rationale": "1 sentence. Which incidents or site distributions most strongly evidence this as systemic.",
  "likely_systemic_cause": "1 sentence. The shared underlying condition probably driving incidents across sites.",
  "likely_systemic_cause_rationale": "1 sentence. What points to a shared cause rather than coincidental local factors.",
  "recommended_investigation_scope": "1 sentence. What the investigation should focus on — likely requires cross-site reach.",
  "recommended_investigation_scope_rationale": "1 sentence. Why this scope given the breadth of the pattern."
}
```

---

### CANONICAL-USER-PROMPT-STAGE-1-CRITICAL-INCIDENT

Used when `trigger_source = critical_incident`. Incident description scrubbed per `globals/anonymisation-rules.md`.

```
A critical-severity incident has been reported. A single event is sufficient to warrant
immediate intelligence generation and investigation without waiting for trend accumulation.

Trigger source: critical_incident

Work type: {{work_type_label}}
Org level: site — {{worksite_name}}
Incident type: {{incident_type}}
Severity class: critical
Injury classification: {{injury_classification}}
Incident description: {{description}}
Immediate actions taken: {{immediate_action_taken | "None recorded"}}
Energy type (capture hint): {{capture_energy_type_hint}}
Barrier assessment (capture hint): {{capture_barrier_hint}}

This is a single event of critical severity. Your output should:
- Frame the intelligence around what this event reveals about systemic conditions
- Be direct about the severity without speculation beyond what the evidence supports
- Acknowledge the single-event basis while being clear about the investigation imperative
- Recommend an investigation scope proportionate to a critical event

Return JSON:
{
  "pattern_summary": "2-3 sentences. What this incident reveals about systemic conditions. Acknowledge the single-event basis without hedging the severity.",
  "pattern_summary_rationale": "1 sentence. Which specific elements of the incident most strongly support this framing.",
  "likely_systemic_cause": "1 sentence. The underlying condition this incident most likely reflects.",
  "likely_systemic_cause_rationale": "1 sentence. What in the incident description points to this cause.",
  "recommended_investigation_scope": "1 sentence. What the investigation must establish — given critical severity, scope should be thorough.",
  "recommended_investigation_scope_rationale": "1 sentence. Why this scope is proportionate to the event."
}
```

---

### Stage 1 Output Storage

```sql
-- Stored on the critical_incident record
critical_incident.pattern_summary                   TEXT
critical_incident.pattern_summary_rationale         TEXT
critical_incident.likely_systemic_cause             TEXT
critical_incident.likely_systemic_cause_rationale   TEXT
critical_incident.recommended_investigation_scope   TEXT
critical_incident.recommended_investigation_scope_rationale TEXT
critical_incident.ai_generated_at                   TIMESTAMPTZ
-- review fields remain null until Stage 2
```

---

## Stage 2 — Human Review

**Actor:** Safety manager (workbench UI)
**Human gate:** Required — investigation record is not created without explicit review action

### Review actions

`POST /api/v1/critical-incidents/:id/review` with body:
```json
{
  "action": "approved | edited | rejected",
  "edited_content": { /* optional — subset of content fields if edited */ },
  "reviewer_notes": "string | null"
}
```

**On approval:**
- `reviewed_by_id`, `reviewed_at`, `review_action` set
- Investigation record created: `status = open`, assigned to `worksite.default_investigator_id`
- `investigation_id` set on the CriticalIncident record
- `investigation.assist` job queued — see `INCIDENT-CAPTURE.md` Stage 3
- Notification N-CRIT-INC-APPROVED fired to investigation assignee and safety manager

**On rejection:**
- `review_action = 'rejected'`
- No investigation created
- Cooldown resets for this `work_type_id` + org level combination
- Silent to field users — N-CRIT-INC-REJECTED is internal only

**On edit + approve:**
- Safety manager edits `pattern_summary`, `likely_systemic_cause`, or `recommended_investigation_scope`
- Edited content stored as authoritative
- `review_action = 'edited'`
- Same downstream as approval

### What the reviewer sees

The workbench surfaces the CriticalIncident card with:
- Card label (Site incident pattern / Cross-site incident pattern / Critical incident)
- `pattern_summary` — the AI-drafted finding
- `likely_systemic_cause` — with `rationale` shown inline
- `recommended_investigation_scope` — with `rationale` shown inline
- Source incident count and links (algorithm) or source incident link (critical_incident)
- Approve / Edit / Reject actions

For `critical_incident` trigger: the source incident record is shown in full alongside the draft — the reviewer has complete context before acting.

---

## Cooldown and Deduplication

```
IF critical_incident already exists WHERE:
  work_type_id = this.work_type_id
  AND generated_at_level = this level
  AND created_at >= now() - INTERVAL '{{org.incident_trend_cooldown_days}} days'
THEN
  do not create a new critical_incident — do not queue critical_incident.generate
```

Cooldown is configurable per organisation. Default: 30 days at site level, 14 days at region and above.

`critical_incident` trigger bypasses cooldown — a critical severity incident always generates a CriticalIncident regardless of recent history for that work type.

`manual` trigger bypasses cooldown.

---

## Notification Events

| Trigger | Notification | Recipients |
|---|---|---|
| CriticalIncident draft created (algorithm) | N-CRIT-INC-DRAFT | Safety manager (scope) |
| CriticalIncident draft created (critical_incident) | N-CRIT-INC-DRAFT | Safety manager — immediate push |
| CriticalIncident approved | N-CRIT-INC-APPROVED | Investigation assignee (push + email), Safety manager (push) |
| CriticalIncident rejected | N-CRIT-INC-REJECTED | Safety manager confirmation only — silent to field |
| CriticalIncident review overdue | N-CRIT-INC-OVERDUE | Safety manager | 48h then daily |

See `SPEC.md` §11 for full notification event registry.

---

## API Endpoints

```
GET    /api/v1/critical-incidents/:id
GET    /api/v1/critical-incidents?level=site&scope_ref_id=uuid&status=draft
POST   /api/v1/critical-incidents                -- manual creation only
POST   /api/v1/critical-incidents/:id/review
```

---

## V2/V3 Cascade Notes

**Cross-site pattern investigation scope (V2)**
In V1, cross-site CriticalIncidents generate a single investigation anchored to the triggering region/division scope. V2: when `sites_affected_count > 3`, recommend a distributed investigation with site-level sub-investigations feeding a central synthesis. Investigation UI does not yet support this structure — V2 scope.

**Investigation mid-enquiry from CriticalIncident (V2)**
In V1, the `investigation_mid` enquiry trigger fires from the investigator inside the resulting investigation. V2: surface a shortcut from the CriticalIncident review view — safety manager can dispatch a preliminary enquiry before the investigation even opens, using `recommended_investigation_scope` as the context narrative. Requires a new `trigger_source` value on the enquiry entity: `critical_incident_pre_investigation`.

**FW factor hint into investigation assist (V2)**
In V1, `investigation.assist` receives the incident's `capture_fw_factor_hint`. V2: also pass the CriticalIncident's `likely_systemic_cause` as additional context to improve contributing factor suggestions — the pattern-level framing often contains more signal than the individual incident description.

---

*Last updated: May 2026. This file is the canonical source for CriticalIncident generation and review. Update this file when: prompt text changes; trigger source criteria change; review workflow changes; notification events change. After updating, verify that `SPEC.md` §3.2a schema, §7.1 triage algorithm, and §7.3 incident trend detection remain consistent with this file.*
