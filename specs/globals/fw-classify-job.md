# fw-classify-job.md — FW Map® Classification Job Spec

**Forge Works · Hiviz SafetyPlatform — Global Job Spec**
Version: 1.0 — May 2026

> **This is the canonical source for the `fw_classify` job** — base system prompt, all three user prompt variants, output schema, validation rules, and triggering conditions. Feature specs (`CRITICAL-INSIGHT.md`, `INVESTIGATION.md`, `ENQUIRY.md`) reference this file by name. They do not contain their own copies of this prompt.

---

## What This Job Does

`fw_classify` takes a richly-narrated safety finding — a critical insight, a closed investigation, or a completed enquiry — and classifies it against the 15 Forge Works Map® factors. It identifies which organisational capacity gaps the evidence supports, at which maturity level each gap operates, and with what confidence.

It does not run at observation level. Individual observations are too thin for reliable FW classification. They emit a `fw_factor_hint` (lightweight pointer) that downstream jobs may use as context — they do not trigger `fw_classify` directly.

---

## Runtime Assembly

The system prompt is assembled at runtime:

```
[CANONICAL-FW-CLASSIFY-BASE-SYSTEM-PROMPT — defined below]
+
[Full text of globals/fw-map-blueprint.md injected here]
```

The Blueprint is injected in full — not summarised or excerpted. This is the only prompt in the system where the full Blueprint is injected.

**Max tokens:** 2000

---

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

---

## User Prompt Templates

Three path-specific variants. Each passes different source fields — the classification rules and output schema are identical across all three.

### CANONICAL-FW-CLASSIFY-USER-PROMPT-INSIGHT

```
Source type: critical_insight
Work type: {{work_type_label}}
Trigger source: {{trigger_source}}
Pattern summary: {{pattern_summary}}
Likely systemic cause: {{likely_systemic_cause}}
Toolbox narrative: {{toolbox_narrative}}

{{#if trigger_source == 'solo_critical'}}
Note: This is a single critical incident — not an accumulated trend.
Severity class: critical
Incident type: {{incident_type}}
Weight classification evidence accordingly — a single event can still evidence systemic
organisational factors when the narrative is specific and the cause chain is clear.
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
      "fw_rationale": "1 sentence — why THIS factor based on THIS specific evidence from the insight"
    }
  ],
  "fw_classification_basis": "1 sentence — what specific evidence in the insight narrative made classification possible",
  "attempted": true
}
```

### CANONICAL-FW-CLASSIFY-USER-PROMPT-INVESTIGATION

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

### CANONICAL-FW-CLASSIFY-USER-PROMPT-ENQUIRY

```
Source type: enquiry_summary
Work type: {{work_type_label}}
Trigger source: {{trigger_source}}

Summary narrative: {{summary_narrative}}
Synthesis findings: {{findings_json}}
Work as Done responses (anonymised): {{work_as_done_responses_json}}

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
      "fw_rationale": "1 sentence — why THIS factor based on THIS specific evidence from the enquiry"
    }
  ],
  "fw_classification_basis": "1 sentence — what specific evidence made classification possible",
  "attempted": true
}
```

**Note on the enquiry path:** Work as Done responses are the richest signal source for `work_understanding` and `goal_conflict_tradeoffs`. Pass them in full (anonymised). The Blueprint affinity table in `globals/fw-map-blueprint.md` confirms enquiry summaries are a strong source for these two factors specifically.

---

## Output Schema

All three paths return the same JSON structure:

| Field | Type | Rules |
|---|---|---|
| `classifications` | array | Max 3 items, ordered by `fw_confidence` descending. Empty array if nothing meets threshold. |
| `classifications[].fw_factor` | string | Must be one of the 15 enumerated values from `globals/fw-map-blueprint.md` |
| `classifications[].fw_domain` | string | `guide` \| `enable` \| `execute` — must be consistent with `fw_factor` |
| `classifications[].fw_maturity_signal` | string | `compliant` \| `leading` \| `resilient` |
| `classifications[].fw_confidence` | decimal | 0.0–1.0. Minimum 0.70 to include in response. |
| `classifications[].fw_rationale` | string | 1 sentence — specific evidence from the source narrative. Required — never store without it. |
| `fw_classification_basis` | string | 1 sentence — overall evidence basis for the classification run |
| `attempted` | boolean | `true` if the job ran and the model had enough to assess. `false` only if input was too thin to attempt. |

---

## Validation Rules

- `fw_confidence >= 0.70` required — reject below-threshold items before storing
- `fw_factor` must be one of the 15 enumerated values from `globals/fw-map-blueprint.md`
- `fw_domain` must be consistent with `fw_factor` — validate against the domain-factor mapping in `globals/fw-map-blueprint.md`
- `classifications = []` + `attempted = true` → store empty arrays, set `fw_classified_at` — do not retry
- `attempted = false` → store nothing, do not set `fw_classified_at` — re-queue when more context is available (rare)
- Rationale is mandatory for every stored classification — it is the defence in any review

---

## Storage Pattern

All three entities use the same parallel array pattern. Arrays are parallel by index — `fw_factors[0]` matches `fw_domains[0]`, `fw_confidences[0]`, and `fw_rationales[0]`.

```sql
-- Entity is critical_insight | investigation | enquiry
{entity}.fw_factors[]             TEXT[]
{entity}.fw_domains[]             TEXT[]
{entity}.fw_maturity_signals[]    TEXT[]
{entity}.fw_confidences[]         DECIMAL(3,2)[]
{entity}.fw_rationales[]          TEXT[]
{entity}.fw_classification_basis  TEXT
{entity}.fw_classified_at         TIMESTAMPTZ
```

Entity-specific field declarations are in each feature spec.

---

## Triggering Conditions

| Path | Job trigger | Condition |
|---|---|---|
| Insight | `critical_insight.generate` approval | `cleared_for_toolbox = true` set by safety manager |
| Insight (manual) | Manual insight creation | `cleared_for_toolbox = true` set immediately on creation |
| Investigation | Investigation closed | `cleared_for_sharing = true` + `legal_hold = false` |
| Enquiry | Final summary generated | `enquiry.summarise` completes |

`fw_classify` queues alongside other async jobs triggered at the same moment (e.g. `investigation.generate_narrative` queues at the same time as the investigation path — they run in parallel).

---

## Retry and Error Handling

See `globals/ai-output-standards.md` for retry rules. For `fw_classify` specifically:
- `attempted = false` → re-queue (rare — only if input was structurally incomplete)
- `attempted = true`, `classifications = []` → store and do not retry — no-classification is a valid result
- Parse failure → retry per standard retry schedule, then mark `fw_classified_at` with error state

---

## Consumer Reference

| Feature spec | Path | Stage |
|---|---|---|
| `features/CRITICAL-INSIGHT.md` | Insight path | Stage 3 |
| `features/INVESTIGATION.md` | Investigation path | Stage 4 |
| `features/ENQUIRY.md` | Enquiry path | Stage 5 |
