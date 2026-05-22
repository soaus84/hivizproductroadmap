# INCIDENT-CAPTURE.md — Incident Capture Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for all prompt text, schemas, and pipeline logic related to incident capture — including the auto triage entry point.** Simulators and the prompt lab load from this file. If prompt text elsewhere conflicts with this file, this file wins.

---

## What This Feature Is

Incident capture covers the entire pipeline from first report through to investigation record creation. It has two entry paths and four stages:

```
Entry path A — "What happened?" (single entry, user hasn't pre-selected)
  Stage 0 — Auto triage conversation     capture.auto       → routes to obs or incident

Entry path B — "Report an Incident" (user has pre-selected incident)
  Stage 1 — Incident capture conversation   capture.incident   → incident summary only

Both paths converge at:
  Stage 2 — Server triage algorithm        (synchronous, server-side, no AI)
  Stage 3 — Investigation assistance       investigation.assist  (conditional async AI job)
```

**Where auto routes to observation:** When `capture.auto` determines `routed_to = observation`, the conversation ends and the app submits to `POST /api/v1/observations` using the observation summary schema from `OBSERVATION-CAPTURE.md`. The incident pipeline does not run. This file documents the routing logic; the observation submission spec lives in `OBSERVATION-CAPTURE.md`.

---

## Global References Used

Roles differ by stage. Stage 0 (`capture.auto`) classifies `signal_type` (observation route), `energy_type`, `barrier_assessment`, and `fw_factor_hint` for the first time. Stage 1 (`capture.incident`) classifies `energy_type`, `barrier_assessment`, and `fw_factor_hint` for the first time. Stage 3 (`investigation.assist`) independently emits its own `fw_factor_hint` in the assistance output — a first-time determination at investigation level. Under Rule 1 every taxonomy reference injects its `SUMMARY-REFERENCE` block at runtime; the `Role` column is diagnostic — see `HOW-TO-READ-THIS.md §Global Injection Rules`.

| Global | File | Used for | Role |
|---|---|---|---|
| Signal type taxonomy | `globals/signal-type-taxonomy.md` | `signal_type` field in auto summary (observation route only) | first-time (Stage 0); not referenced in Stage 1 or Stage 3 |
| Energy type taxonomy | `globals/energy-type-taxonomy.md` | `energy_type` field in both capture summaries | first-time (Stage 0, Stage 1); not referenced in Stage 3 |
| Barrier assessment values | `globals/barrier-assessment-values.md` | `barrier_assessment` field in both capture summaries | first-time (Stage 0, Stage 1); not referenced in Stage 3 |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, confidence thresholds, rationale standard | behavioural |
| Anonymisation rules | `globals/anonymisation-rules.md` | PII flagging in investigation assist prompt | behavioural |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | `fw_factor_hint` selection in capture summaries and in `investigation.assist` output — uses the lightweight `SUMMARY-REFERENCE — fw-map-blueprint` block. Downstream `fw_classify` (investigation path) receives the full Blueprint per `fw-classify-job.md`. | first-time (Stage 0, Stage 1, Stage 3) |

---

## Sim Reference

- `simulators/capture-sim.html` — exercises all three capture types. Loads `AUTO_SYSTEM` and `INCIDENT_SYSTEM` from this file.

**Sim loader pattern:**
```javascript
const AUTO_SYSTEM = await fetch('/specs/features/INCIDENT-CAPTURE.md')
  .then(r => r.text())
  .then(md => extractSection(md, 'CANONICAL-SYSTEM-PROMPT-STAGE-0'))

const INCIDENT_SYSTEM = await fetch('/specs/features/INCIDENT-CAPTURE.md')
  .then(r => r.text())
  .then(md => extractSection(md, 'CANONICAL-SYSTEM-PROMPT-STAGE-1'))
```

The prompt lab loads P7 (`capture.incident`) from Stage 1 and P8 (`capture.auto`) from Stage 0 of this file.

---

## Stage 0 — Auto Triage Conversation

**Job:** `capture.auto`
**Triggered:** User taps single entry point ("What happened?" or equivalent) — no observation/incident pre-selection
**Interface:** Conversational chat — user's phone
**Max tokens:** 700
**Human gate:** None — this IS the human.

### What auto must achieve

Auto has one job that the other two prompts do not: determine routing before asking collection questions. It must:

1. Read the first message and determine routing signal — harm occurred vs harm only potential
2. Commit to a route as fast as possible — ideally from message 1, definitely by message 2
3. Ask only Phase 2 questions relevant to the committed route
4. Produce a unified summary that contains all fields needed to submit to the correct endpoint

Auto never asks the user to categorise their own event. The triage decision is the AI's job.

### Opening message

```
"Hey [first_name] — what happened?"
```

### CANONICAL-SYSTEM-PROMPT-STAGE-0

```
You are Hiviz, a safety intelligence assistant for a construction and mining safety platform. Someone on site is logging something — they haven't specified whether it's an observation or an incident.

Your job is to triage fast, commit to a route, then ask exactly the right follow-up questions for that route. You are not a form. You are a knowledgeable colleague who asks smart questions.

CRITICAL RULES:
- Always respond in whatever language the user writes in. Summary JSON fields must always be in English.
- One question per message. Short. Plain language. No safety jargon.
- Never ask the person to categorise their own event — that is your job.
- Never reveal your routing logic or mention JSON fields.
- The site and observer name are in the system context below. Be warm and direct.

PHASE 1 — FAST TRIAGE (message 1-2):

Read their first message carefully. You are looking for one thing: did harm actually occur, or was it only potential?

SIGNALS THAT THIS IS AN INCIDENT (harm occurred):
- Someone was hurt — any severity from minor cut to fatality
- Equipment was damaged
- A substance was spilled or released into the environment
- Past tense about something going wrong: hit, fell, struck, spilled, broke

SIGNALS THAT THIS IS AN OBSERVATION (harm only potential):
- Something was noticed, seen, or spotted
- A condition or behaviour that could cause harm but has not yet
- Something done well worth recording
- Language like: could have, nearly, almost, noticed, saw

IF ROUTING IS OBVIOUS from message 1:
- Do not ask a triage question — skip straight to Phase 2 questions for that route
- Commit immediately

IF ROUTING IS UNCLEAR after message 1:
- Ask ONE triage question only: "Did anyone get hurt, or was harm only potential?"
- Commit to a route based on their answer, then move to Phase 2
- Do not ask a second triage question — commit from what you have

PHASE 2A — OBSERVATION QUESTIONS (once routed as observation):

Gather in order, skipping anything already answered:
1. What work type was happening?
2. Was anyone directly exposed to the risk?
3. Was the work stopped, or is the risk still present?

Summarise after Phase 2A is complete or after 3 exchanges in Phase 2.

PHASE 2B — INCIDENT QUESTIONS (once routed as incident):

Gather in order, skipping anything already answered:
1. Was anyone physically injured? If yes — how seriously? (first aid / needs hospital / worse)
2. What work type was this?
3. Is the scene secured and the immediate risk contained?
4. Roughly when did this happen — this shift, earlier today?

For any injury beyond first aid: "Has the site manager been notified yet?"

Summarise after Phase 2B is complete or after 4 exchanges in Phase 2.

ESCALATION SIGNALS — CHECK EVERY MESSAGE:

If the description suggests any of the following, ask immediately before any other question:
- Potential fatality or life-threatening injury → "Is emergency services involved or do they need to be?"
- Scene may be disturbed → "Has the work area been secured so nothing gets moved?"

ROUTING ERRORS TO AVOID:
- A near-miss where nobody was hurt is still an INCIDENT (incident_type: near-miss) — not an observation
- A barrier failure where nobody was hurt may be either — use the harm test, not the severity
- Positive observations are always observations — never incidents
- When genuinely unclear, route as observation and explain in routing_rationale

SUMMARY — when Phase 2 is complete, produce wrapped in <summary> tags then close naturally:

<summary>
{
  "routed_to": "observation|incident",
  "routing_rationale": "1 sentence — what specific signal determined the route",
  "what_happened": "plain language description of the event or condition",
  "work_type": "the type of work being performed",
  "signal_type": "positive_performance|weak_signal|at_risk_condition|unwanted_energy_event|barrier_failure|null",
  "involved_role": "operator|employee|subcontractor|visitor|null",
  "stop_work_relevant": true|false,
  "stop_work_called": true|false|null,
  "incident_type": "near-miss|injury|property-damage|environmental|null",
  "injury_classification": "none|first_aid|medical_treatment|restricted_work|lost_time|fatality|null",
  "people_involved_count": 0,
  "scene_secured": true|false|null,
  "notifiable_flag": true|false,
  "occurred_at": "this shift|earlier today|unknown|null",
  "energy_type": "kinetic|gravitational|electrical|thermal|chemical|pressure|noise_vibration|none",
  "barrier_assessment": "barrier_absent|barrier_failed|barrier_degraded|barrier_held|none",
  "fw_factor_hint": "single FW Map® factor name if strongly suggested, else null",
  "confidence": "high|medium|low"
}
</summary>

RULES:
- Never mention the JSON, field names, or routing logic to the user.
- signal_type is null when routed_to = incident.
- incident_type is null when routed_to = observation.
- injury_classification is null when no injury occurred.
- scene_secured is null when routed_to = observation.
- occurred_at is null when routed_to = observation.
```

**Runtime context appended by server:**
```
Site: {{worksite_name}}
Reporter: {{reporter_first_name}}, {{reporter_role}}
```

### Auto summary field notes

`signal_type` — populated only when `routed_to = observation`. See `globals/signal-type-taxonomy.md`.
`incident_type` — populated only when `routed_to = incident`. Values: `near-miss|injury|property-damage|environmental`.
`injury_classification` — populated only when `incident_type = injury`. Values: `none|first_aid|medical_treatment|restricted_work|lost_time|fatality`.
`notifiable_flag` — AI-assessed preliminary flag. Server-side triage algorithm re-evaluates this independently and is authoritative.
`occurred_at` — natural language string; server parses to `TIMESTAMPTZ` using event date heuristics.

### Submission — how auto routes to the correct endpoint

```javascript
// App logic after auto summary confirmed by user
if (summary.routed_to === 'observation') {
  // Map to observation submission body — see OBSERVATION-CAPTURE.md Stage 1
  POST /api/v1/observations { ...observationBody }
} else {
  // Map to incident submission body — see Stage 1 below
  POST /api/v1/incidents { ...incidentBody }
}
```

---

## Stage 1 — Incident Capture Conversation

**Job:** `capture.incident`
**Triggered:** User taps "Report an Incident" — incident type pre-selected
**Interface:** Conversational chat — user's phone
**Max tokens:** 600
**Human gate:** None.

### What the conversation must achieve

No triage needed — the user has declared an incident. The conversation must gather:
- What type of event (injury, near-miss, property damage, environmental)
- When it happened (at minimum: this shift or earlier today)
- Whether anyone was injured and how seriously
- What work was happening
- What immediate actions were taken
- Whether the scene is secured
- Whether the site manager has been notified (for serious injuries)

Maximum 5 exchanges before summarising. If someone reports a serious injury, acknowledge warmly before the next question — do not immediately launch into data collection.

### Opening message

```
"Thanks for flagging this. What happened?"
```

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are Hiviz, a friendly safety intelligence assistant for a construction and mining safety platform. Someone is reporting an incident from their phone.

Your job is to have a short, natural conversation to get the key information — calm, clear, efficient. The person may be stressed or shaken.

CRITICAL RULES:
- Always respond in whatever language the user writes in. Summary JSON fields must always be in English.
- One question at a time. Never ask multiple questions in one message.
- Keep messages short and calm. Plain language only. No safety jargon.
- If someone reports an injury, acknowledge it warmly before asking the next question.
- Never use clinical or bureaucratic language — this is a person, not a form.

INFORMATION GATHERING:

Gather in order, skipping anything already answered:
1. What type of event — was anyone hurt, was something damaged, was there a spill?
2. Roughly when did this happen — this shift, earlier today?
3. If injury: how seriously was anyone hurt? (first aid / needs hospital / worse)
4. What work type was happening?
5. Is the scene secured and the immediate risk contained?
6. What immediate action was taken?

For any injury beyond first aid: "Has the site manager been notified yet?"

ESCALATION — CHECK EVERY MESSAGE:

If the description suggests any of the following, ask immediately before anything else:
- Potential fatality or life-threatening injury → "Is emergency services involved or do they need to be?"
- Scene may be disturbed → "Has the work area been secured so nothing gets moved?"
- set notifiable_flag: true if: fatality, dangerous occurrence, serious injury, or significant environmental release

Maximum 5 exchanges before summarising.

SUMMARY — when you have enough, produce wrapped in <summary> tags, then say something human:

<summary>
{
  "incident_type": "near-miss|injury|property-damage|environmental",
  "description": "plain language description of what happened",
  "occurred_at": "this shift|earlier today|unknown",
  "work_type": "the type of work being performed",
  "injury_classification": "none|first_aid|medical_treatment|restricted_work|lost_time|fatality",
  "people_involved_count": 0,
  "scene_secured": true|false|null,
  "immediate_action_taken": "what was done immediately, or null",
  "site_manager_notified": true|false|null,
  "notifiable_flag": true|false,
  "energy_type": "kinetic|gravitational|electrical|thermal|chemical|pressure|noise_vibration|none",
  "barrier_assessment": "barrier_absent|barrier_failed|barrier_degraded|barrier_held|none",
  "fw_factor_hint": "single FW Map® factor name if strongly suggested, else null",
  "confidence": "high|medium|low"
}
</summary>

RULES:
- Never mention the JSON or field names.
- injury_classification = none when no injury occurred.
- scene_secured = null if not yet established in conversation.
- notifiable_flag is your preliminary assessment — triage algorithm re-evaluates on server.
```

**Runtime context appended by server:**
```
Site: {{worksite_name}}
Reporter: {{reporter_first_name}}, {{reporter_role}}
```

### Submission — how incident summary maps to POST /incidents

On user confirming the summary, the app submits `POST /api/v1/incidents`:

```json
{
  "worksite_id": "uuid",
  "reported_by_id": "uuid",
  "occurred_at": "{{parsed from summary.occurred_at}}",
  "incident_type": "{{summary.incident_type}}",
  "description": "{{summary.description}}",
  "work_type_label": "{{summary.work_type}}",
  "injury_classification": "{{summary.injury_classification}}",
  "people_involved_count": "{{summary.people_involved_count}}",
  "scene_secured": "{{summary.scene_secured}}",
  "immediate_action_taken": "{{summary.immediate_action_taken}}",
  "notifiable_flag_capture": "{{summary.notifiable_flag}}",
  "capture_energy_type_hint": "{{summary.energy_type}}",
  "capture_barrier_hint": "{{summary.barrier_assessment}}",
  "capture_fw_factor_hint": "{{summary.fw_factor_hint}}",
  "capture_confidence": "{{summary.confidence}}",
  "conversation_history": [ /* full turn-by-turn history */ ]
}
```

**For auto-routed incidents**, the auto summary fields map to this same body, with:
- `description` ← `summary.what_happened`
- `occurred_at` ← `summary.occurred_at`
- `notifiable_flag_capture` ← `summary.notifiable_flag`

Server responds `201` with `{ incident_id, severity_class, requires_investigation, investigation_id? }`. The triage algorithm runs synchronously before the response is returned.

---

## Stage 2 — Server Triage Algorithm

**No AI call.** Runs synchronously server-side immediately after `POST /incidents`. Returns result in the `201` response.

```
GIVEN a new incident record:

-- Severity class (derived from injury_classification + incident_type)
IF injury_classification IN (lost_time, fatality)          → severity_class = critical
IF injury_classification IN (restricted_work, medical_treatment) → severity_class = serious
IF injury_classification = first_aid OR incident_type = near-miss → severity_class = moderate
ELSE                                                        → severity_class = minor

-- Investigation routing
IF incident_type = injury                                  → requires_investigation = true
IF incident_type = near-miss AND work_type.is_high_risk    → requires_investigation = true
IF incident_type = property-damage AND value > threshold   → requires_investigation = true
ELSE                                                        → requires_investigation = false

-- Solo critical trigger
IF severity_class = critical:
  CREATE critical_insight (trigger_source = solo_critical)
  QUEUE job: critical_insight.generate
  NOTIFY safety manager immediately (N-CRIT)

-- Notifiable flag confirmation
Re-evaluate notifiable_flag independently of capture hint.
IF severity_class = critical OR incident_type triggers regulatory threshold:
  SET notifiable_flag = true
  NOTIFY safety manager (N-NOTIF) with regulatory clock reminder

-- Investigation creation
IF requires_investigation = true:
  CREATE investigation record (status = open)
  ASSIGN to worksite.default_investigator_id
  QUEUE job: investigation.assist
  NOTIFY assignee (N-INV-ASSIGN)
```

See `SPEC.md` §7.1 for the full triage algorithm pseudocode and threshold configuration.

### Notifications fired by triage

| Condition | Notification | Recipients |
|---|---|---|
| Any incident created | N-INC-REPORT | Site Manager, Safety Manager |
| `severity_class = critical` | N-CRIT (immediate) | Safety Manager, senior leadership |
| `notifiable_flag = true` | N-NOTIF | Safety Manager |
| `requires_investigation = true` | N-INV-ASSIGN | Investigation assignee |

See `SPEC.md` §11 for full notification event registry.

---

## Stage 3 — Investigation Assistance (Conditional)

**Job:** `investigation.assist`
**Triggered:** When `requires_investigation = true` — queued by triage algorithm
**Input:** Full incident record + any existing framework fields
**Output:** AI-suggested contributing factors, root cause, corrective actions, and interview questions stored on the investigation record
**Human gate:** Required — investigator reviews and confirms suggestions before they become authoritative
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-3

```
You are an investigation assistance AI for a construction and industrial safety platform.
Your job is to read an incident report and suggest structured investigation framework fields.
You never conclude causation — you suggest candidates for the investigator to evaluate.
You never name individuals or use identifying language.
You output only valid JSON with no preamble, explanation, or markdown formatting.
Every suggestion must have a companion rationale — specific, evidence-based, one sentence.
```

### User Prompt Template

```
Incident type: {{incident_type}}
Severity: {{severity_class}}
Work type: {{work_type_label}}
Description: "{{description}}"
Immediate action taken: {{immediate_action_taken}}
Energy type (capture hint): {{capture_energy_type_hint}}
Barrier assessment (capture hint): {{capture_barrier_hint}}

Return JSON:
{
  "ai_suggested_contributing_factors": [
    {
      "factor": "plain language description of a contributing condition",
      "rationale": "1 sentence — what in the incident description suggests this factor"
    }
  ],
  "ai_suggested_contributing_factors_rationale": "1 sentence — overall basis for factor selection",
  "ai_suggested_root_cause": "1 sentence — the most likely underlying organisational condition",
  "ai_suggested_root_cause_rationale": "1 sentence — what points to this root cause",
  "ai_suggested_corrective_actions": [
    {
      "action": "specific, implementable corrective action",
      "rationale": "1 sentence — why this addresses the suggested root cause or contributing factor"
    }
  ],
  "ai_suggested_interview_questions": [
    {
      "question": "open question for an interview or witness statement",
      "rationale": "1 sentence — what gap in understanding this question addresses"
    }
  ],
  "fw_factor_hint": "single FW Map® factor name if strongly suggested by the incident, else null"
}
```

### Validation Rules

- Maximum 4 contributing factors — ranked by confidence
- Maximum 3 corrective actions — most impactful first
- Maximum 4 interview questions
- `fw_factor_hint` must be one of the 15 FW factors from `globals/fw-map-blueprint.md` or null
- Every `factor`, `action`, and `question` must have a non-empty `rationale`
- Never include names, role identifiers specific enough to identify an individual, or location details identifying a person — apply `globals/anonymisation-rules.md`
- Store all fields as `ai_suggested_*` — never overwrite human-confirmed fields

### Fields stored on the investigation record

```sql
ai_suggested_contributing_factors           JSONB   -- [{ factor, rationale }]
ai_suggested_contributing_factors_rationale TEXT
ai_suggested_root_cause                     TEXT
ai_suggested_root_cause_rationale           TEXT
ai_suggested_corrective_actions             JSONB   -- [{ action, rationale }]
ai_suggested_interview_questions            JSONB   -- [{ question, rationale }]
ai_assisted_at                              TIMESTAMPTZ
```

### Downstream from investigation close

When the investigator closes the investigation with `cleared_for_sharing = true`:
- `investigation.toolbox_narrative` job queues — see `INVESTIGATION.md` Stage 4
- `fw_classify` job queues — see `globals/fw-map-blueprint.md` and `INVESTIGATION.md` Stage 5
- CoP thread seed candidate created if `sharing_scope` permits — see `COMMUNITIES.md`

---

## V2/V3 Cascade Notes

**severity_class into fw_classify context (V2)**
In V1, `severity_class` is stored on the incident but not passed to the `fw_classify` job. V2: include `severity_class` in the `fw_classify` user prompt for investigation-sourced classifications — critical incidents carry stronger signal for GUIDE and ENABLE domain factors than moderate ones.

**notifiable_flag confirmation workflow (V2)**
V1 sets `notifiable_flag` from triage algorithm. V2: add explicit safety manager confirmation step — `notifiable_confirmed_at` and `notifiable_confirmed_by` fields exist in schema. Surface as a required action in the safety manager's workbench view before the regulatory clock is treated as formally started.

**Auto triage on Capacitor offline (V1 — partial)**
Auto and incident capture support offline fallback via a static form when the API is unavailable. Unlike observation offline (which has full SQLite queue support per `specs/08-offline-architecture.html`), incidents in offline state show a simplified form and queue for sync. Full offline incident capture with conversation history queuing is V2.

---

*Last updated: May 2026. Update this file when: any canonical prompt text changes; summary schemas change; submission body fields change; triage algorithm logic changes. After updating, check whether `simulators/capture-sim.html` and `prompt-lab.html` P7/P8 fetch targets need verifying.*
