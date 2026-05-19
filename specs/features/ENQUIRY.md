# ENQUIRY.md — Enquiry Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for all enquiry prompt text, question types, synthesis logic, and FW classification.** The enquiry sim and prompt lab load from this file.

---

## What This Feature Is

The Enquiry is the intelligence-gathering counterpart to the toolbox talk's broadcast. Where a talk pushes findings to crews, an enquiry pulls intelligence from sites — asking supervisors and managers whether a risk condition exists at their location and what is actually happening in practice.

Enquiries are always triggered by the intelligence pipeline, never created from scratch by users. They have three trigger sources, four AI stages, and one human review gate (before dispatch).

```
Stage 1 — Question generation    enquiry.generate_questions   (async AI — three input variants)
Stage 2 — Human review           (safety manager — before dispatch)
Stage 3 — Live synthesis         enquiry.synthesise           (async AI — after each response, debounced)
Stage 4 — Final summary          enquiry.summarise            (async AI — on close or manual trigger)
Stage 5 — FW classification      fw_classify (enquiry path)   (async AI — after final summary)
```

---

## Trigger Sources

| `trigger_source` | What fires it | Default targeting | Legal hold check |
|---|---|---|---|
| `critical_insight` | Insight approved by safety manager | Source sites, supervisors | N/A |
| `investigation_mid` | Investigator flags suspected cross-site condition | Same-region sites | Hard block if `legal_hold = true` |
| `investigation_witness` | Investigator names individual witnesses | Named individuals only | Hard block if `legal_hold = true` |

**Legal hold:** If `investigation.legal_hold = true`, the enquiry cannot be created or dispatched from that investigation. Enforced at the API layer — no override exists.

---

## Global References Used

Enquiry AI stages (question generation, live synthesis, final summary) operate on already-classified insight/investigation context and the responses they elicit. No signal/energy/barrier classification is done by these prompts. The Blueprint reaches the pipeline only at Stage 5 (`fw_classify`), which loads it in **Full** per its own job spec.

| Global | File | Used for | Injection level |
|---|---|---|---|
| Anonymisation rules | `globals/anonymisation-rules.md` | Observation summaries and incident text scrubbed before Stage 1 | Spec-only |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, rationale standard, confidence thresholds | Spec-only |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | Injected into `fw_classify` at runtime (Stage 5) | **Full** (Stage 5 only — via `fw-classify-job.md`) |

---

## Sim Reference

- `simulators/enquiry-sim.html` — exercises all three trigger source paths in scripted form using static mock questions and responses. Does not make live AI calls.
- **Prompt lab** — loads Stages 1, 3, 4 from this file.

---

## Question Type Reference

Seven types. AI selects the most appropriate combination. Safety manager can remove, add, or reorder before dispatch.

| Type | Purpose | Response format |
|---|---|---|
| `assurance` | Verify a specific control is in place right now | Yes / Partially / No + mandatory note if Partially or No + optional photo |
| `likelihood` | Understand perceived risk before asking about controls | Low / Moderate / High + optional brief reason |
| `prevalence` | Understand frequency when observation pool data is thin | Never / Sometimes / Always + optional note |
| `evidence` | Get visual proof of a physical condition — not just attestation | Required photo + description |
| `work_as_done` | Understand actual practice vs documented procedure | Free text — prompt shown: "Describe what actually happens, not what the procedure says" |
| `gap_identification` | Ask supervisors to name what's missing | Free text + category tag (People / Process / Equipment / Environment) |
| `comparative` | Know both whether a system exists AND whether it's working | Exists & works / Has gaps / Doesn't exist + description |

**Selection rules:**
- Build on each other: Likelihood → Assurance → Work as Done → Gap
- Always include at least one `work_as_done` — it captures what no other type can
- Never recommend `prevalence` if observation pool data already provides prevalence for this work type and site
- 3–6 questions maximum — more questions = lower completion rate
- Each question must have a single, clear answer — no compound questions

---

## Stage 1 — Question Generation

**Job:** `enquiry.generate_questions`
**Triggered:** Enquiry created (from any trigger source)
**Input:** Trigger source context — varies by source (see templates below)
**Output:** JSON array of question objects — stored as `ai_suggested = true` on `enquiry_question`
**Human gate:** Safety manager reviews before dispatch — can remove, add, or reorder
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are a safety intelligence analyst generating field enquiry questions for a
construction and industrial safety platform.

Your role is to generate the minimum set of questions that will give the safety
manager the clearest possible picture of whether a risk condition exists at
multiple sites — and what is actually happening in practice.

Rules:
- Generate 3-6 questions maximum. More questions = lower completion rate.
- Select question types that build on each other: start with perception
  (likelihood), then control verification (assurance), then practice
  (work as done), then gap (identification).
- Never recommend a Prevalence Check if you are told prevalence data exists.
- Always include at least one Work as Done question — it captures what
  no other question type can.
- Write questions in plain language a site supervisor can answer in 2 minutes.
- Do not use safety jargon.
- Each question must have a clear, single answer — no compound questions.
- Output ONLY valid JSON, no preamble.
```

### User Prompt Template — Critical Insight Trigger

```
Trigger source: critical_insight

Insight pattern: {{pattern_summary}}
Likely systemic cause: {{likely_systemic_cause}}
Work type: {{work_type_label}}
Source observation count: {{observation_count}}
Sample observations (anonymised): {{observation_summaries_json}}
Prevalence data available from existing observations: {{prevalence_available}}

Generate a field enquiry question set.

Return JSON array:
[
  {
    "position": 1,
    "question_type": "likelihood|assurance|prevalence|evidence|work_as_done|gap_identification|comparative",
    "question_text": "Plain language question",
    "response_options": ["Option A", "Option B", "Option C"] | null,
    "allow_photo": true | false,
    "require_note_if": ["Option B", "Option C"] | null,
    "ai_rationale": "Why this question, why this position, what it adds to the set",
    "default_target_scope": "source_sites|region|division",
    "default_target_role": "supervisor|manager|both"
  }
]
```

### User Prompt Template — Investigation Mid-Enquiry

```
Trigger source: investigation_mid

Incident narrative: {{incident_description}}
Suspected cross-site condition: {{contributing_factors_json}}
Work type: {{work_type_label}}

These questions will be sent to sites across the region — not to the incident site.
The context narrative shown to recipients: "We are investigating an incident at one
of our sites. We need to check whether a related condition exists at yours."
Questions must make sense without knowing the specific incident details.

Generate a field enquiry question set. Return the same JSON array schema as above.
```

### User Prompt Template — Investigation Witness

```
Trigger source: investigation_witness

Incident narrative: {{incident_description}}
Immediate cause (provisional): {{immediate_cause}}
Contributing factors (provisional): {{contributing_factors_json}}

These questions go to named individuals only — not site-wide.
They are witnesses or participants in the incident.
Questions should help clarify ambiguity in the investigation framework
without leading the witness or assuming conclusions.
Tone must be respectful and non-accusatory.

Generate a field enquiry question set. Return the same JSON array schema as above.
```

### Validation Rules

- 3–6 questions — enforced before storing
- Every question must have a non-null `ai_rationale`
- `question_type` must be one of the 7 valid values
- `default_target_scope` must be one of `source_sites | region | division`
- `require_note_if` values must be a subset of `response_options` values
- At least one `work_as_done` question per set — validation warning raised if absent, not a hard block (safety manager may add one manually)

---

## Stage 2 — Human Review and Dispatch

**Human-driven.** No AI call. Safety manager reviews the question set, adjusts targeting, sets deadline, and dispatches.

### Review actions available

- Remove a question (soft delete — `removed_by_user = true`)
- Add a custom question (stored with `ai_suggested = false`)
- Reorder questions (update `position` values)
- Adjust per-question targeting scope and role
- Set deadline (`deadline_at`)
- Write optional context narrative shown to recipients

### Dispatch — `POST /api/v1/enquiries/:id/dispatch`

Dispatch locks the question set. No further edits to questions after dispatch. Creates `enquiry_response` records for all targeted recipients. Fires push notifications (N-ENQ-DISPATCH).

For witness enquiries, notification uses sensitive wording (N25) — "We'd like to ask you a few questions about an incident. Your responses are confidential to the investigation team."

---

## Stage 3 — Live Synthesis

**Job:** `enquiry.synthesise`
**Triggered:** Each time a response is submitted — debounced 30 seconds (batches rapid submissions)
**Input:** All responses received so far + original question set
**Output:** JSON synthesis object stored in `enquiry.ai_synthesis` — replaces previous synthesis
**Human gate:** None — updates in real time, displayed in workbench as responses arrive
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-3

```
You are synthesising field responses to a safety enquiry in real time.
Responses are still arriving — your analysis should reflect what is known now,
not wait for completeness.

Be direct. Name patterns clearly. Use signal language:
- 🔴 Confirmed risk condition / control not in place
- 🟠 Likely condition / inconsistent control
- 🟡 Perceived risk / partial visibility
- 💡 Actionable insight / convergent suggestion

Do not hedge unnecessarily. Output ONLY valid JSON, no preamble.
```

### User Prompt Template

```
Enquiry context:
Trigger source: {{trigger_source}}
Work type: {{work_type_label}}
Questions asked: {{questions_json}}

Responses received so far ({{response_count}} of {{recipient_count}} recipients):
{{responses_json}}

Synthesise what the responses show so far.

Return JSON:
{
  "response_count": {{response_count}},
  "recipient_count": {{recipient_count}},
  "findings": [
    {
      "signal": "🔴 | 🟠 | 🟡 | 💡",
      "finding": "Plain language finding — specific, evidence-based, names the pattern",
      "evidence_basis": "What in the responses supports this finding"
    }
  ],
  "emerging_pattern": "1-2 sentences. What is becoming clear across the responses so far. Null if too few responses to draw any conclusion.",
  "questions_needing_more_responses": ["question_text of any question where pattern is still unclear"],
  "generated_at_response_count": {{response_count}}
}
```

### Storage

```sql
enquiry.ai_synthesis          JSONB    -- replaced on each synthesis run
enquiry.ai_synthesis_at       TIMESTAMPTZ
```

The synthesis is always labelled in the UI with `generated_at_response_count` so the safety manager knows how many responses were available when it was generated.

---

## Stage 4 — Final Summary

**Job:** `enquiry.summarise`
**Triggered:** Enquiry closed (`POST /api/v1/enquiries/:id/close`) OR manually triggered by safety manager before deadline
**Input:** All responses + original question set + final synthesis
**Output:** Summary narrative + recommended actions stored on the enquiry record
**Human gate:** None at generation — safety manager reviews output and creates corrective actions from workbench
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-4

```
You are writing a final summary of a completed safety enquiry for construction
and industrial safety managers.

Your summary:
- States clearly what was found — evidence-based, no hedging
- Names the pattern explicitly — across how many sites, how many respondents,
  what the key condition is, what the field said
- Recommends 2-3 specific actions that address what was found
- Is written for a safety manager who needs to act, not read an essay
- Never mentions names or identifying details

You output only valid JSON. No preamble, no markdown.
```

### User Prompt Template

```
Enquiry context:
Trigger source: {{trigger_source}}
Work type: {{work_type_label}}
Questions asked: {{questions_json}}
Total responses: {{response_count}} of {{recipient_count}} recipients ({{response_rate}}%)

All responses:
{{responses_json}}

Live synthesis (generated at {{synthesis_response_count}} responses):
{{ai_synthesis_json}}

Write a final summary. Return JSON:
{
  "summary_narrative": "3-5 sentences. What was found, across how many sites and
    respondents, what the key condition is, what the field said. Evidence-based.
    No hedging.",
  "recommended_actions": [
    "Specific implementable action 1 — addresses the primary risk condition found",
    "Specific implementable action 2 — addresses a contributing gap identified",
    "Specific implementable action 3 — closes the loop with respondents"
  ],
  "toolbox_narrative": "2-3 sentences. Written so a supervisor can say:
    'We asked [N] supervisors across [M] sites. Here's what we found.
    Here's what we're doing.' Crew-facing language.",
  "escalate_to_systemic": true | false,
  "escalation_rationale": "1 sentence if true, null if false"
}
```

### Validation Rules

- `summary_narrative` must be 3–5 sentences
- `recommended_actions` must have 2–4 items
- `toolbox_narrative` must be 2–3 sentences — this feeds toolbox talk content selection
- `escalation_rationale` must be non-null if `escalate_to_systemic = true`
- No names or identifying details

### Storage

```sql
enquiry.summary                TEXT      -- summary_narrative
enquiry.recommended_actions    JSONB     -- array of action strings
enquiry.summary_generated_at   TIMESTAMPTZ
```

The `toolbox_narrative` is stored separately and becomes available to toolbox talk content selection — an enquiry with a clear finding can generate a talk, just as an investigation does.

---

## Stage 5 — FW Map® Classification

**Job:** `fw_classify` (enquiry path)
**Triggered:** After final summary is generated
**Input:** Summary narrative + Work as Done responses (anonymised) + synthesis findings
**Output:** FW Map® classification stored as parallel arrays on the enquiry record
**Human gate:** None — displayed alongside enquiry results in workbench

> **Canonical spec:** `globals/fw-classify-job.md` — system prompt, user prompt template (`CANONICAL-FW-CLASSIFY-USER-PROMPT-ENQUIRY`), output schema, validation rules, and retry behaviour are all defined there. This section covers triggering, storage fields, and downstream effects specific to the enquiry entity.

**Note on Work as Done responses:** These are the richest signal source for `work_understanding` and `goal_conflict_tradeoffs` classification. Pass them in full (anonymised). See the enquiry path note in `globals/fw-classify-job.md`.

### Storage — parallel arrays on the enquiry record

```sql
enquiry.fw_factors[]             TEXT[]
enquiry.fw_domains[]             TEXT[]
enquiry.fw_maturity_signals[]    TEXT[]
enquiry.fw_confidences[]         DECIMAL(3,2)[]
enquiry.fw_rationales[]          TEXT[]
enquiry.fw_classification_basis  TEXT
enquiry.fw_classified_at         TIMESTAMPTZ
```

---

## API Reference

```
POST   /api/v1/enquiries                      — create enquiry (draft, with questions)
GET    /api/v1/enquiries/:id                  — retrieve with questions
GET    /api/v1/enquiries?trigger_source=...&status=active
PATCH  /api/v1/enquiries/:id                  — edit questions before dispatch
POST   /api/v1/enquiries/:id/dispatch         — lock and send
GET    /api/v1/enquiries/:id/results          — live results + synthesis
POST   /api/v1/enquiries/:id/close            — trigger final summary + fw_classify
```

**GET results** returns:
```json
{
  "response_count": 9,
  "recipient_count": 12,
  "response_rate": 0.75,
  "per_question_results": [],
  "live_feed": [],
  "ai_synthesis": { "findings": [], "generated_at_response_count": 9 },
  "summary": null
}
```

---

## Notification Events

| Trigger | Notification | Recipients |
|---|---|---|
| Enquiry draft created | N-ENQ-DRAFT | Safety manager |
| Enquiry dispatched | N-ENQ-DISPATCH | All targeted recipients |
| Witness enquiry dispatched | N25 (sensitive wording) | Named witnesses only |
| Response received (digest) | N-ENQ-RESPONSE | Safety manager (debounced — not per-response) |
| Deadline approaching (< 48h) | N-ENQ-DEADLINE | Safety manager |
| Final summary generated | N-ENQ-SUMMARY | Safety manager |

See `SPEC.md` §11 for full notification event details.

---

## Legal and Privacy Rules

- **Witness responses** are visible only to the investigation team — separate access control required; not included in organisation-wide analytics
- **Investigation mid-enquiry** responses are accessible to the investigation assignee and safety managers in scope
- **Legal hold** blocks enquiry creation and dispatch entirely — no override
- Enquiry responses are **never attributed by name** in synthesis or summary outputs — only role and site level

---

## V2/V3 Cascade Notes

**Factor-aware question type selection (V2)**
In V1, question types are selected based on the insight pattern and cause only. In V2, pass `fw_factors[]`, `fw_domains[]`, and `fw_rationales[]` from the classified insight into the question generation prompt. Each classified factor drives question type selection:
- `management_systems` → Work as Done + Gap Identification
- `work_understanding` → Work as Done + Comparative
- `operational_management` → Likelihood + Assurance
- `frontline_workers` → Assurance + Prevalence
- `goal_conflict_tradeoffs` → Likelihood + Gap Identification
- `monitoring_metrics` → Comparative + Evidence Request

**Toolbox narrative from enquiry summary (V2)**
In V1, `enquiry.summary.toolbox_narrative` is generated but not yet explicitly wired into content selection. V2: include `enquiry.toolbox_narrative` as a content source in the content selection algorithm (Stage 1 of `TOOLBOX-TALK.md`), ranked below investigations but above raw observations.

**Poll crossover (future — deferred)**
Polls are deferred to a future crossover with the enquiry model. When implemented, the poll response schema will share the enquiry synthesis infrastructure. See V7 discovery notes.

---

*Last updated: May 2026. Update this file when: any prompt text changes; question type set changes; synthesis or summary schema changes; FW classification schema changes. After updating, verify prompt lab loads Stage 1/3/4 correctly and enquiry-sim.html scenario descriptions remain accurate.*
