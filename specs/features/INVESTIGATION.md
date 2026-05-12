# INVESTIGATION.md — Investigation Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for investigation prompt text, schemas, and pipeline logic — from the point an investigation is open through to FW Map® classification.** Note: the `investigation.assist` job that runs immediately after investigation creation is documented in `INCIDENT-CAPTURE.md` Stage 3, because it fires as part of the incident triage pipeline. This file covers everything from that point forward: investigator workflow, close, toolbox narrative generation, and FW classification.

---

## What This Feature Is

An investigation is the structured human-and-AI process that follows a significant incident. It begins when triage creates an investigation record and fires `investigation.assist`. It ends when the investigator closes it with confirmed framework fields and a sharing decision. On close, two async jobs queue: a toolbox narrative generator and the FW Map® classifier.

The feature has four stages:

```
Stage 1 — Investigator framework completion   (human-driven, AI-assisted — from INCIDENT-CAPTURE.md Stage 3)
Stage 2 — Witness enquiry (optional)          (human-triggered — delegates to ENQUIRY.md)
Stage 3 — Toolbox narrative generation        investigation.generate_narrative   (async AI, on close)
Stage 4 — FW Map® classification              fw_classify (investigation path)   (async AI, on close)
```

Stage 1 is listed here for completeness but its prompt lives in `INCIDENT-CAPTURE.md` Stage 3. Stages 3 and 4 are the canonical prompts owned by this file.

---

## Global References Used

| Global | File | Used for |
|---|---|---|
| Anonymisation rules | `globals/anonymisation-rules.md` | Incident text scrubbed before all AI prompts in this feature |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, rationale standard, draft status, audit logging |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | Injected in full into `fw_classify` system prompt at runtime |
| Energy type taxonomy | `globals/energy-type-taxonomy.md` | Referenced in toolbox narrative context |

---

## Sim Reference

- `simulators/workflow-sim.html` — Scenario 1 ("Incident → Investigation → Talk") exercises the investigation pipeline in scripted form. The sim does not make live AI calls for investigation stages; it uses static mock data to illustrate the pipeline. When live investigation AI testing is needed, use the prompt lab.
- **Prompt lab** — loads Stage 3 (`investigation.generate_narrative`) and Stage 4 (`fw_classify` investigation path) from this file.

---

## Investigation Lifecycle States

```
open        ← created by triage algorithm; investigation.assist fires immediately
closed      ← investigator confirms framework fields and signs off
escalated   ← safety manager escalates to systemic investigation (sets escalate_to_systemic = true)
```

`legal_hold` is a separate boolean flag. When `legal_hold = true`, the investigation is blocked from all sharing pipelines regardless of `cleared_for_sharing`. Enforced at SQL query level — not application code.

---

## Stage 1 — Investigator Framework Completion

**Human-driven with AI suggestions from `investigation.assist` (see `INCIDENT-CAPTURE.md` Stage 3).**

The investigator works through the investigation record in the workbench UI. AI-suggested fields are presented inline with their rationale. The investigator confirms, modifies, or replaces each suggestion. Confirmed fields are stored without the `ai_suggested_` prefix.

**Fields the investigator confirms:**

| Field | Type | Source |
|---|---|---|
| `immediate_cause` | TEXT | Confirmed from AI suggestion or written by investigator |
| `contributing_factors` | JSONB | Array of `{ factor, rationale }` — confirmed from AI or added manually |
| `root_cause` | TEXT | Confirmed from AI suggestion or written by investigator |
| `corrective_actions` | JSONB | Array of `{ action, rationale, owner_id, due_date }` — confirmed from AI or added |
| `cleared_for_sharing` | BOOLEAN | Investigator explicit decision — default false |
| `sharing_scope` | ENUM | `site|region|division|organisation` — investigator selects |
| `legal_hold` | BOOLEAN | Set by investigator or safety manager — hard block |

**Close gate rules (enforced server-side before accepting `POST /investigations/:id/close`):**

- `immediate_cause` must be non-null and non-empty
- `root_cause` must be non-null and non-empty
- At least one `corrective_action` must be confirmed
- `cleared_for_sharing` must be explicitly set (true or false — not null)
- `legal_hold = true` blocks close unless overridden by safety manager role

---

## Stage 2 — Witness Enquiry (Optional)

**Human-triggered. Delegates entirely to `ENQUIRY.md`.**

During an active investigation, the investigator can dispatch a witness enquiry to named individuals. This uses the full enquiry infrastructure (`trigger_source = investigation_witness`). AI question generation for witness enquiries is documented in `ENQUIRY.md` Stage 1 (investigation_witness path).

The pre-populated interview questions from `investigation.assist` (see `INCIDENT-CAPTURE.md` Stage 3) are the starting point for witness enquiry question generation. They pass through to the enquiry question generation prompt as seed questions.

**Legal hold check:** If `investigation.legal_hold = true`, the witness enquiry cannot be dispatched. Enforced at the API layer.

---

## Stage 3 — Toolbox Narrative Generation

**Job:** `investigation.generate_narrative`
**Triggered:** Investigation closed + `cleared_for_sharing = true` + `legal_hold = false`
**Input:** Confirmed investigation framework fields
**Output:** Plain-language toolbox narrative stored in `investigation.toolbox_narrative`
**Human gate:** None at generation — content was human-confirmed at investigation sign-off. Supervisor can still edit before delivery in the talk assembly step.
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-3

```
You are a safety communicator translating closed incident investigation findings into
toolbox talk content for frontline construction and industrial crews.

Your writing voice:
- That of a veteran site supervisor — someone who has seen things go wrong and wants
  to make sure it does not happen again
- Present tense — more immediate and direct than past tense
- Plain English — no acronyms, no corporate safety language
- Never references names, specific dates, or worksite identifiers
- Focuses entirely on the systemic cause and what crews can do differently today
- Does not moralise or lecture — treats crew as experienced professionals

You output only valid JSON with no preamble, explanation, or markdown formatting.
```

### User Prompt Template

```
Confirmed investigation findings:
Work type: {{work_type_label}}
Immediate cause: {{immediate_cause}}
Contributing factors: {{contributing_factors_json}}
Root cause: {{root_cause}}
Corrective actions: {{corrective_actions_json}}
Approved sharing scope: {{sharing_scope}}

Generate toolbox content from these confirmed findings.

Return JSON:
{
  "incident_story": "3-4 sentences. What happened and how. Present tense. No names, no specific dates or locations beyond work type context.",
  "root_cause_plain": "1-2 sentences. The real reason this happened. Systemic framing — not personal blame.",
  "what_we_do_now": [
    "Action 1 — specific and behaviourally concrete",
    "Action 2",
    "Action 3"
  ],
  "discussion_questions": [
    "Question 1 — prompts crew to reflect on their own work context",
    "Question 2 — prompts crew to identify gaps in current practice",
    "Question 3 — prompts crew to name a specific action they can take today"
  ]
}
```

### Validation Rules

- `incident_story` must be 3–4 sentences — not shorter (too thin for toolbox use), not longer
- `what_we_do_now` must have 2–4 items — not a single action, not a laundry list
- `discussion_questions` must have exactly 3 items
- No names, role identifiers specific enough to identify an individual, or identifying location details — see `globals/anonymisation-rules.md`
- Apply `ai_anonymisation_flags` from the source incident before building this prompt — scrub the `description` field

### Storage

```sql
-- Stored on the investigation record
investigation.toolbox_narrative     TEXT    -- the full JSON object, stored as text
investigation.toolbox_narrative_generated_at  TIMESTAMPTZ
```

### Downstream use

`investigation.toolbox_narrative` is consumed by the toolbox talk content selection algorithm. When a talk is assembled for the relevant work type, the investigation narrative is available as a content candidate. See `TOOLBOX-TALK.md` for content selection and assembly.

---

## Stage 4 — FW Map® Classification

**Job:** `fw_classify` (investigation path)
**Triggered:** Investigation closed + `cleared_for_sharing = true` + `legal_hold = false` — queues alongside Stage 3, runs in parallel
**Input:** Confirmed investigation framework fields + severity class
**Output:** FW Map® classification stored as parallel arrays on the investigation record
**Human gate:** None at classification — output displayed alongside investigation content in the workbench UI with rationale
**Max tokens:** 2000 — system prompt includes full Blueprint reference injected at runtime

### System Prompt

The system prompt for `fw_classify` is shared across all three classification sources (insights, investigations, enquiries). It is assembled at runtime by injecting the full content of `globals/fw-map-blueprint.md`.

**Pattern:**
```
[fw_classify base system prompt]
+
[full text of globals/fw-map-blueprint.md injected here]
```

### CANONICAL-FW-CLASSIFY-BASE-SYSTEM-PROMPT

```
You are a safety management analyst trained in the Forge Works Map® — a 15-factor
organisational capacity framework grounded in Safety II, Resilience Engineering,
and Human and Organisational Performance (HOP) theory.

Your job is to identify every Forge Works Map® factor the narrative independently
supports at sufficient confidence — and at which maturity level each gap operates.

CLASSIFICATION RULES:
- Only classify factors where you can write a specific, evidence-based rationale
- Never classify on vague association — the narrative must provide direct evidence
- Maximum 3 factors per classification run, ordered by confidence descending
- If nothing meets 0.70 confidence, return an empty classifications array
- Classify at the maturity level where the GAP operates — not where the organisation aspires to be
- Maturity levels are sequential: do not classify resilient if the compliant gap has not been addressed
- Output only valid JSON. No preamble, no markdown.

[Full per-factor definitions injected from globals/fw-map-blueprint.md at runtime]
```

### User Prompt Template — Investigation Path

```
Source type: investigation
Work type: {{work_type_label}}
Severity class: {{severity_class}}
Immediate cause: {{immediate_cause}}
Contributing factors: {{contributing_factors_json}}
Root cause: {{root_cause}}
Corrective actions: {{corrective_actions_json}}

{{#if trigger_source == 'solo_critical'}}
Note: This investigation stems from a single critical incident — not an accumulated trend.
Weight your classification evidence accordingly. A single critical event can still evidence
systemic organisational factors when the narrative is rich enough.
{{/if}}

Classify against the 15 Forge Works Map® factors.

GUIDE: senior_leadership, strategy, risk_management, safety_organisation, work_understanding
ENABLE: operational_management, resource_allocation, management_systems, goal_conflict_tradeoffs, learning_development
EXECUTE: frontline_workers, communications_coordination, decision_making, contractor_management, monitoring_metrics

Maturity: compliant | leading | resilient

Return JSON:
{
  "classifications": [
    {
      "fw_factor": "factor_name",
      "fw_domain": "guide|enable|execute",
      "fw_maturity_signal": "compliant|leading|resilient",
      "fw_confidence": 0.86,
      "fw_rationale": "1 sentence — why THIS factor based on THIS specific evidence from the investigation"
    }
  ],
  "fw_classification_basis": "1 sentence — what specific evidence in the investigation narrative made classification possible",
  "attempted": true
}
```

### Validation Rules

- `fw_confidence >= 0.70` required for each classification — reject below-threshold items before storing
- `fw_factor` must be one of the 15 enumerated values from `globals/fw-map-blueprint.md`
- `fw_domain` must be consistent with `fw_factor` — validate against the domain-factor mapping in `globals/fw-map-blueprint.md`
- `classifications = []` + `attempted = true` → store empty arrays, set `fw_classified_at` — do not retry
- `attempted = false` → store nothing, do not set `fw_classified_at` — re-queue when more context available (rare for closed investigations)
- Maximum 3 classifications per run, ordered by `fw_confidence` descending
- Never store a classification without its rationale — rationale is the defence in any review

### Storage — parallel arrays on the investigation record

```sql
-- Written by fw_classify job
investigation.fw_factors[]          TEXT[]        -- e.g. ['management_systems', 'operational_management']
investigation.fw_domains[]          TEXT[]        -- e.g. ['enable', 'enable']
investigation.fw_maturity_signals[] TEXT[]        -- e.g. ['compliant', 'leading']
investigation.fw_confidences[]      DECIMAL(3,2)[] -- e.g. [0.86, 0.73]
investigation.fw_rationales[]       TEXT[]        -- one sentence per factor
investigation.fw_classification_basis TEXT
investigation.fw_classified_at      TIMESTAMPTZ
```

Arrays are parallel by index — `fw_factors[0]` matches `fw_domains[0]`, `fw_confidences[0]`, `fw_rationales[0]`.

### Downstream from FW classification

Once `fw_classified_at` is set on the investigation:
- The workbench UI displays FW factor tags alongside the investigation, each with its rationale inline
- The organisation's FW Map® capacity profile is updated — contributing to the live diagnostic picture
- If `sharing_scope` permits, the classification informs situational brief generation for managers — see `SITUATIONAL-BRIEF.md`
- A CoP thread seed candidate is created if `cleared_for_sharing = true` and `sharing_scope` allows peer learning — see `COMMUNITIES.md`

---

## Notification Events

| Trigger | Notification | Recipients |
|---|---|---|
| Investigation opened (from triage) | N-INV-ASSIGN | Investigation assignee |
| Investigation closed | N-INV-CLOSED | Safety manager, reporter |
| Toolbox narrative generated | N-INV-NARRATIVE | Safety manager (queued for review) |
| `notifiable_flag = true` | N-NOTIF | Safety manager (regulatory clock reminder) |
| `legal_hold` set | N-LEGAL-HOLD | Investigation assignee, safety manager |

See `SPEC.md` §11 for full notification event details.

---

## Legal Hold Rules

`legal_hold = true` on an investigation is a hard block enforced at the data layer:

- Stage 3 (`investigation.generate_narrative`) does not run — job is dropped, not queued
- Stage 4 (`fw_classify`) does not run — same
- `cleared_for_sharing` cannot be set to true while `legal_hold = true`
- The investigation cannot contribute as a source to any CriticalInsight
- Any enquiry `trigger_source = investigation_mid` or `investigation_witness` is blocked
- Notifications N24 and N25 are suppressed

Legal hold is released by a user with safety manager role via `PATCH /api/v1/investigations/:id` with `{ legal_hold: false }`. Release fires N-LEGAL-HOLD-RELEASED to assignee.

---

## V2/V3 Cascade Notes

**severity_class into fw_classify (V2 — partially implemented)**
`severity_class` is stored on the incident and passed to `investigation.generate_narrative` in V1. It is also passed to `fw_classify` in the user prompt template above. The cascade note in `SPEC.md` §16 references that this was not implemented in V1 — the template above resolves that by including it from the start.

**fw_factors arrays into situational briefs (V2)**
`investigation.fw_factors` is populated but situational brief generation in V1 receives only a single `fw_factor` value. V2: pass full `fw_factors[]` arrays with `fw_rationales[]` into the situational brief prompt for richer multi-factor outputs. See `SITUATIONAL-BRIEF.md`.

**MS workspace document linkage (V6)**
When the Management System workspace is active, the investigation workbench gains a document retrieval step: documents applicable to the work type at the incident date are fetched and displayed alongside the investigation framework. AI investigation assistance (`investigation.assist`) receives relevant `DocumentRequirement` records as additional context for contributing factor generation. See `MANAGEMENT-SYSTEM-INGESTION.md`.

**Risk workspace control attribution (V5)**
When the Risk workspace is active, investigation contributing factors can be linked to specific critical controls. `corrective_actions` can reference control modifications. The FW classification receives control failure context as additional evidence.

---

*Last updated: May 2026. Update this file when: prompt text changes; framework field set changes; close gate rules change; FW classification output schema changes. After updating, verify the prompt lab loads the updated text correctly and that `workflow-sim.html` scenario descriptions remain accurate.*
