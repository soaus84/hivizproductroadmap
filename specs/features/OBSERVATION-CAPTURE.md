# OBSERVATION-CAPTURE.md — Observation Capture Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for all prompt text, schemas, and pipeline logic related to observation capture.** Simulators and the prompt lab load from this file — they do not contain their own copies. If prompt text elsewhere conflicts with this file, this file wins.

---

## What This Feature Is

Observation capture is the entry point of the entire intelligence pipeline. A supervisor or manager logs a field observation from their phone — either through a conversational AI capture or a fallback form. The observation is stored, then asynchronously enriched with structured metadata. High-confidence enrichment results trigger immediate downstream routing; lower-confidence results accumulate in the pool for trend detection.

The feature has three sequential stages:

```
Stage 1 — Capture conversation   capture.observation  (user-facing, real-time)
Stage 2 — Enrichment job         observation.enrich   (async, server-side)
Stage 3 — Context request        observation.context_request  (conditional, async)
```

---

## Global References Used

Both stages independently classify `signal_type`, `energy_type`, `barrier_assessment`, and `fw_factor_hint` from raw observation text — each is a first-time determination at this stage. Per the governing rule (first-time classification never gets Enum), all four taxonomy globals are injected at **Summary** level. The Summary blocks are extracted at runtime — e.g. `extractSection(md, 'SUMMARY-REFERENCE — signal-type-taxonomy')`.

| Global | File | Used for | Injection level |
|---|---|---|---|
| Signal type taxonomy | `globals/signal-type-taxonomy.md` | `signal_type` field — 5 values + routing rules | **Summary** (Stage 1, Stage 2) |
| Energy type taxonomy | `globals/energy-type-taxonomy.md` | `energy_type` field — 8 values + definitions; `energy_release_potential` scale used in Stage 2 | **Summary** (Stage 1, Stage 2) |
| Barrier assessment values | `globals/barrier-assessment-values.md` | `barrier_assessment` field — 5 states + definitions | **Summary** (Stage 1, Stage 2) |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, confidence thresholds, rationale standard, audit logging | Spec-only |
| Anonymisation rules | `globals/anonymisation-rules.md` | PII flagging in enrichment; scrubbing for all downstream prompts | Spec-only |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | `fw_factor_hint` selection — first-time determination at this stage; uses the lightweight `SUMMARY-REFERENCE — fw-map-blueprint` block, not the full per-factor content | **Summary** (Stage 1, Stage 2) — `fw_factor_hint` is selected for the first time here |

---

## Sim Reference

- `simulators/capture-sim.html` — exercises observation, incident, and auto capture. Loads `OBSERVATION_SYSTEM` from this file, Stage 1.
- `simulators/capture-sim-offline.html` — exercises observation capture across 4 states (online, offline, API unavailable, degraded). Loads `OBSERVATION_SYSTEM` from this file, Stage 1.

**Sim loader pattern:**
```javascript
// Sims fetch canonical prompt from this file at runtime
const OBSERVATION_SYSTEM = await fetch('/specs/features/OBSERVATION-CAPTURE.md')
  .then(r => r.text())
  .then(md => extractSection(md, 'CANONICAL-SYSTEM-PROMPT-STAGE-1'))
```

The prompt lab (P6 `capture.observation`) also loads from Stage 1 of this file.

---

## Stage 1 — Capture Conversation

**Job:** `capture.observation`
**Triggered:** User taps "Log an Observation" in the Hiviz app
**Interface:** Conversational chat — user's phone
**Max tokens:** 600
**Human gate:** None — this IS the human. The AI is assisting capture, not generating content for review.

### What the conversation must achieve

In the minimum number of exchanges (maximum 4), the AI must gather:
- What was observed — the physical event or condition
- What work was being done (work type)
- Whether anyone was exposed or at risk
- Whether any immediate action was taken
- Enough to make a confident `signal_type` and `energy_type` assessment

If the user's first message contains enough information, the AI must summarise immediately — it must not ask unnecessary questions.

### Opening message

The AI opens with a single, warm, direct question. The exact wording is contextual — the app passes the observer's first name. Canonical opening:

```
"Hey [first_name] — what did you see out there?"
```

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are Hiviz, a friendly safety intelligence assistant for a construction and mining safety platform. A supervisor or manager is logging a field observation from their phone.

Your job is to have a short, natural conversation to get the key information — like asking a knowledgeable colleague, not filling out a form.

CRITICAL RULES:
- Always respond in whatever language the user writes in. If they switch language mid-conversation, follow them. Summary JSON fields must always be in English regardless of conversation language.
- One question at a time. Never ask multiple questions in one message.
- Keep messages short — this is a phone conversation, not a report.
- Be warm and direct. Plain language only. No safety jargon.
- No bullet points or lists in your messages.

INFORMATION GATHERING:
- Start by asking what they saw.
- You need: what happened, what work was being done, whether anyone was exposed, whether action was taken.
- Assess confidence as you go. If the very first message gives you enough — summarise immediately.
- Maximum 4 exchanges before summarising regardless of confidence.

SUMMARY — when you have enough information, produce a summary wrapped in <summary> tags, then say something natural to close:

<summary>
{
  "what_was_observed": "Plain language description of what happened or was seen.",
  "work_type": "The type of work being performed.",
  "signal_type": "positive_performance|weak_signal|at_risk_condition|unwanted_energy_event|barrier_failure",
  "involved_role": "operator|supervisor|employee|subcontractor|visitor|null",
  "stop_work_called": true|false,
  "immediate_action_taken": "What was done immediately, or null if nothing.",
  "energy_type": "kinetic|gravitational|electrical|thermal|chemical|pressure|noise_vibration|none",
  "barrier_assessment": "barrier_absent|barrier_failed|barrier_degraded|barrier_held|none",
  "fw_factor_hint": "single FW Map® factor name if strongly suggested by the observation, else null",
  "confidence": "high|medium|low"
}
</summary>

RULES:
- Never mention the JSON, field names, or any technical terms to the user.
- Never ask the user to categorise their own observation — that is your job.
- The site name and observer name are passed in the system context below.
```

**Runtime context appended by server:**
```
Site: {{worksite_name}}
Observer: {{observer_first_name}}, {{observer_role}}
```

### Summary JSON field definitions

| Field | Type | Values | Notes |
|---|---|---|---|
| `what_was_observed` | string | Free text | Plain language, 1–3 sentences |
| `work_type` | string | Free text | As described — enrichment maps to taxonomy UUID |
| `signal_type` | enum | See `globals/signal-type-taxonomy.md` | AI-assessed from conversation |
| `involved_role` | enum | `operator\|supervisor\|employee\|subcontractor\|visitor\|null` | Role of person involved — not the observer |
| `stop_work_called` | boolean | `true\|false` | Whether a work stop was called |
| `immediate_action_taken` | string\|null | Free text or null | What was done immediately |
| `energy_type` | enum | See `globals/energy-type-taxonomy.md` | Primary energy mechanism |
| `barrier_assessment` | enum | See `globals/barrier-assessment-values.md` | State of the relevant control |
| `fw_factor_hint` | string\|null | One of the 15 FW factors or null | Lightweight hint only — not a classification |
| `confidence` | enum | `high\|medium\|low` | AI's confidence in the summary |

### Submission — how summary maps to POST /observations

On user confirming the summary, the app submits `POST /api/v1/observations` with this body:

```json
{
  "worksite_id": "uuid",
  "observer_id": "uuid",
  "what_was_observed": "{{summary.what_was_observed}}",
  "work_type_label": "{{summary.work_type}}",
  "stop_work_called": "{{summary.stop_work_called}}",
  "immediate_action_taken": "{{summary.immediate_action_taken}}",
  "capture_signal_type_hint": "{{summary.signal_type}}",
  "capture_energy_type_hint": "{{summary.energy_type}}",
  "capture_barrier_hint": "{{summary.barrier_assessment}}",
  "capture_fw_factor_hint": "{{summary.fw_factor_hint}}",
  "capture_confidence": "{{summary.confidence}}",
  "capture_involved_role": "{{summary.involved_role}}",
  "conversation_history": [ /* full turn-by-turn history */ ]
}
```

The `capture_*` hint fields are stored as-is — they are inputs to the enrichment job, not final classification values. The enrichment job independently classifies all fields; hints are used only to initialise confidence assessment.

On `POST /observations` success: server responds `201` with `{ observation_id, enrichment_status: "queued" }`. App shows confirmation and queues the `observation.enrich` BullMQ job.

### Offline behaviour

If the device is offline at submission time:
- Observation is stored locally in SQLite via Capacitor
- Added to the local `sync_queue` table with `status = pending`
- Summary card shows "Saved — will sync when reconnected"
- On reconnect, sync queue flushes in FIFO order
- Enrichment job runs server-side after sync completes

See `specs/08-offline-architecture.html` for full offline implementation detail.

### Fallback form

If the AI is unavailable (`capture_type = form`), a static form collects the minimum fields directly: `what_was_observed`, `work_type`, `stop_work_called`, `immediate_action_taken`. These submit to the same `POST /observations` endpoint with `capture_confidence = null` and no hint fields. Enrichment still runs after submission.

---

## Stage 2 — Enrichment Job

**Job:** `observation.enrich`
**Triggered:** Immediately after `POST /observations` — queued as BullMQ job
**Input:** Free-text observation + work type + available taxonomy
**Output:** Structured enrichment metadata stored in `observation` AI fields
**Human gate:** None — auto-stored as suggestions, never overwrites original text
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-2

```
You are a safety classification assistant for a construction and industrial safety platform.
Your job is to read field observations written by supervisors and enrich them with structured metadata.
You never change or rewrite the original text.
You identify phrases that could identify specific individuals and flag them for anonymisation.
You output only valid JSON with no preamble, explanation, or markdown formatting.
You do not hallucinate taxonomy values — only use IDs explicitly provided to you.
If you are uncertain, reflect that in enrichment_confidence.
```

### User Prompt Template

```
Observation text: "{{what_was_observed}}"

Work type declared by supervisor: {{work_type_label}}

Available work type taxonomy:
{{work_type_taxonomy_json}}
// format: [{ "id": "uuid", "label": "Hot Work" }, ...]

Available safety practice taxonomy:
{{practice_taxonomy_json}}
// format: [{ "id": "uuid", "label": "Permit to Work" }, ...]

Capture-stage hints (from conversation — use to initialise confidence, not as final values):
signal_type_hint: {{capture_signal_type_hint | null}}
energy_type_hint: {{capture_energy_type_hint | null}}
barrier_hint: {{capture_barrier_hint | null}}
fw_factor_hint: {{capture_fw_factor_hint | null}}

Return JSON matching this exact schema:
{
  "inferred_work_type_ids": ["uuid"],
  "inferred_practice_ids": ["uuid"],
  "signal_type": "positive_performance|weak_signal|at_risk_condition|unwanted_energy_event|barrier_failure",
  "signal_type_confidence": 0.0,
  "signal_type_rationale": "1 sentence — what in the text identified this signal type",
  "energy_type": "kinetic|gravitational|electrical|thermal|chemical|pressure|noise_vibration|none",
  "energy_type_confidence": 0.0,
  "energy_release_potential": "catastrophic|high|moderate|low|none",
  "barrier_assessment": "barrier_absent|barrier_failed|barrier_degraded|barrier_held|none",
  "barrier_confidence": 0.0,
  "barrier_rationale": "1 sentence — what in the text identified this barrier state",
  "failure_type": "systemic|behavioural|environmental|unclear",
  "key_hazard": "short plain-language string",
  "key_hazard_rationale": "1 sentence — what in the text identified this hazard",
  "stop_work_warranted": true|false,
  "stop_work_warranted_rationale": "1 sentence — why or why not",
  "ai_anonymisation_flags": ["exact phrase from text that could identify a specific individual"],
  "fw_factor_hint": "single FW Map® factor name if strongly suggested — else null",
  "context_questions_needed": false,
  "context_question": null,
  "enrichment_confidence": 0.0
}
```

Note: `failure_type` is a lightweight triage signal only. FW Map® classification runs separately via `fw_classify` (Prompt 10) on richer context — never attempt FW classification at individual observation level.

### Validation Rules

- `signal_type` must be one of the 5 enum values from `globals/signal-type-taxonomy.md`
- `energy_type` must be one of the 8 enum values from `globals/energy-type-taxonomy.md`
- `energy_release_potential` must be one of `catastrophic|high|moderate|low|none` — see `globals/energy-type-taxonomy.md` §Energy Release Potential. Must be `none` when `energy_type = none`. AI-derived from energy type + work type context — not passed from capture.
- `barrier_assessment` must be one of the 5 values from `globals/barrier-assessment-values.md`
- `signal_type_confidence`, `energy_type_confidence`, `barrier_confidence`, `enrichment_confidence` must be 0.0–1.0
- `enrichment_confidence < 0.5`: do not store enrichment fields — set `enrichment_status = low_confidence`, queue `observation.context_request`
- `inferred_work_type_ids` must only contain UUIDs present in the provided taxonomy
- `fw_factor_hint` must be one of the 15 FW factor names from `globals/fw-map-blueprint.md` or null — not a freeform string
- If `context_questions_needed = true`: queue `observation.context_request` job
- Store all fields regardless of confidence — confidence values are stored alongside

### Downstream routing (from validation)

| Condition | Action |
|---|---|
| `signal_type_confidence >= 0.70` AND `signal_type` is `barrier_failure` or `unwanted_energy_event` | Queue `critical_insight.generate` with `trigger_source = critical_observation` — single observation record as input, no threshold required |
| `signal_type_confidence >= 0.70` AND `signal_type` is `at_risk_condition` or `weak_signal` | Add to pool — trend detection algorithm runs on schedule |
| `signal_type` is `positive_performance` | Add to analytics pool only — does not contribute to trend detection |
| `enrichment_confidence < 0.50` | Queue `observation.context_request` — do not store enrichment fields |
| `context_questions_needed = true` | Queue `observation.context_request` regardless of confidence |

### Fields stored on the observation record

```sql
-- Enrichment outputs stored in safety_intelligence.observation
ai_signal_type              TEXT          -- enriched signal_type
ai_signal_type_confidence   DECIMAL(3,2)
ai_signal_type_rationale    TEXT
ai_energy_type              TEXT
ai_energy_type_confidence   DECIMAL(3,2)
ai_energy_release_potential TEXT          -- catastrophic|high|moderate|low|none — AI-derived, not captured
ai_barrier_assessment       TEXT
ai_barrier_confidence       DECIMAL(3,2)
ai_barrier_rationale        TEXT
ai_failure_type             TEXT
ai_key_hazard               TEXT
ai_key_hazard_rationale     TEXT
ai_stop_work_warranted      BOOLEAN
ai_stop_work_warranted_rationale TEXT
ai_anonymisation_flags      TEXT[]
ai_fw_factor_hint           TEXT
ai_inferred_work_type_ids   UUID[]
ai_inferred_practice_ids    UUID[]
enrichment_confidence       DECIMAL(3,2)
enrichment_status           TEXT          -- queued | complete | low_confidence | failed
enriched_at                 TIMESTAMPTZ
```

---

## Stage 3 — Context Request (Conditional)

**Job:** `observation.context_request`
**Triggered:** When `enrichment_confidence < 0.50` OR `context_questions_needed = true`
**This is not an AI call.** The context question is already generated by Stage 2. This job formats it for delivery and sends the notification.

### Notification format

```
"Hey [first_name] — quick question about the observation you logged.
[context_question]
Tap to reply."
```

Delivered as push notification (N03). See `SPEC.md` §11 for full notification spec.

### On response

When the observer replies, `observation.context_enrich` re-runs Stage 2 with the original observation text plus the context response appended:

```
Observation text: "{{what_was_observed}}"

Additional context from observer: "{{context_response}}"
```

This re-run replaces the previous enrichment fields if confidence improves above threshold. Maximum one context request per observation.

---

## V2/V3 Cascade Notes

**stop_work_warranted divergence signal (V2)**
`observation.ai_stop_work_warranted` is set by enrichment independently of `observation.stop_work_called` (set by the supervisor during capture). V2: add divergence check in analytics. If `ai_stop_work_warranted = true` AND `stop_work_called = false`, flag in Leading Indicators view. Pass divergence count to `fw_classify` as additional context.

**Observation-to-document linkage (V6 MS integration)**
When the Management System workspace is active, the enrichment job gains a fourth step: query `DocumentRequirement` records for the relevant work type and check whether the observation text suggests a requirement gap. If detected, store `ai_requirement_gap_hint` with the linked `document_requirement_id`. See `features/MANAGEMENT-SYSTEM-INGESTION.md` for the document side of this linkage.

**Photo enrichment (V1 — already supported)**
Photos attached during the capture conversation are passed as base64 image blocks in the enrichment prompt. The enrichment prompt should use visual evidence to improve confidence on `barrier_assessment` and `energy_type`. Token budget for photo enrichment: ~2,000–4,000 tokens.

---

*Last updated: May 2026. Update this file when: the canonical prompt text changes; the summary schema changes; submission body fields change; downstream routing rules change. After updating, check whether `simulators/capture-sim.html`, `simulators/capture-sim-offline.html`, and `prompt-lab.html` P6 need their fetch targets verified.*
