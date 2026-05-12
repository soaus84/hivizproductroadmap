# ai-output-standards.md — AI Output Standards

**Forge Works · Hiviz SafetyPlatform — Global Reference**
Version: 1.0

> **Scope:** Rules that apply to every AI prompt in the platform. Feature specs reference these standards — they do not repeat them. If a standard appears in a feature spec, the version here is the authority.

---

## Output Format

**All prompts output valid JSON only.** No preamble, no markdown formatting, no explanation before or after the JSON object. The only exception is the capture conversation prompts (P6 `capture.observation`, P7 `capture.incident`, P8 `capture.auto`) which output conversational messages and wrap structured output in `<summary>` tags.

**Parse with try/catch on every AI call.** Log raw text on parse failure. Retry once before alerting. Do not surface raw AI output to any user.

**Null over omission.** If a field cannot be determined, return `null` for that field. Never omit a field from the schema — the consumer expects a complete object shape.

---

## Model

**All prompts use `claude-sonnet-4-20250514`.**

Read from `ai_prompt_config.model` — never hardcoded in application code. Do not substitute Haiku — safety-critical outputs require the highest reliability model available.

---

## Token Limits

| Prompt type | max_tokens |
|---|---|
| Default (all prompts) | 1000 |
| Full toolbox talk assembly (P6 talks) | 1500 |
| FW Map® classification (P10 `fw_classify`) | 2000 |
| Capture conversation turns | 600 |

---

## Rationale Standard

**Every actionable AI output field has a companion rationale field.**

Rationale is surfaced inline in the UI — not in a tooltip, not on a detail page. The human makes the decision; the AI makes the case. This is non-negotiable.

Examples of required rationale pairings:
- `signal_type` → `signal_type_rationale`
- `fw_factor` → `fw_rationale` (per classification)
- `stop_work_warranted` → `stop_work_warranted_rationale`
- `key_hazard` → `key_hazard_rationale`
- `barrier_assessment` → `barrier_rationale`

Rationale fields must be:
- One sentence — specific and evidence-based
- Grounded in the actual observation text, not a generic statement
- Written as: *"[what in the text] suggests [the classification]"* — not *"this observation shows..."*

---

## Suggestion Language Standard

Enforced at the UI layer — prompts do not replicate this in their output. Documented here so feature spec authors understand the intent.

| Do not use | Use instead |
|---|---|
| "AI recommends" | "AI has suggested" |
| "because" | "based on" |
| "you should" | "for your review" |
| "the analysis shows" | "based on the observation" |

AI output is always a suggestion with a visible reason. It is never a directive.

---

## Confidence Thresholds

| Field | Threshold | Effect below threshold |
|---|---|---|
| `enrichment_confidence` | 0.50 | Discard enrichment — queue `observation.context_request` |
| `signal_type_confidence` | 0.70 | Store but do not use for pipeline routing decisions |
| `energy_type_confidence` | 0.70 | Store but flag as low confidence in UI |
| `barrier_confidence` | 0.70 | Store but do not use for pipeline routing decisions |
| `fw_confidence` (per classification) | 0.70 | Do not store — below threshold classifications are dropped |

**Store all fields regardless of confidence.** Confidence values are stored alongside the classified value. Below-threshold values are visible to safety managers but not acted on automatically.

---

## Draft Status

**All AI outputs are draft only until a human acts.**

- `cleared_for_toolbox = false` until safety manager approves
- `cleared_for_sharing = false` on investigations until explicitly set
- `ai_suggested_*` fields never overwrite human-confirmed fields
- No AI output reaches crew without passing through a human review gate

This applies without exception. There is no "auto-approve" path for any content type.

---

## Prompt Storage

**System prompts are stored in `ai_prompt_config`, not in application code.**

User prompts are parameterised templates filled at runtime with live data. Both are versioned — `prompt_key` and `prompt_version` are logged with every AI call.

Canonical prompt text lives in `specs/features/` — the `ai_prompt_config` database table is populated from those files, not the other way around.

---

## Audit Logging

Every AI call must be logged with:
- `prompt_key` — the job identifier (e.g. `observation.enrich`)
- `prompt_version` — the version from `ai_prompt_config`
- `input_hash` — SHA-256 of the full prompt sent
- `output_hash` — SHA-256 of the raw response received
- `latency_ms` — end-to-end call duration
- `model` — model identifier actually used

See `SPEC.md` §13 for the full audit log schema.

---

## Photo Handling

Photos can be passed to enrichment prompts as base64 image blocks where relevant. The capture conversation supports multimodal input — photos attached during the conversation are included in the conversation history sent to the API.

Format:
```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/jpeg",
    "data": "<base64-encoded-data>"
  }
}
```

Token cost with photos: ~2,000–4,000 tokens depending on image count and size. Budget accordingly.

---

## Retry Policy

| Path | Retries | Backoff |
|---|---|---|
| Async jobs (enrichment, fw_classify, etc.) | 3 attempts | Exponential |
| Synchronous paths (talk assembly) | 1 retry | Immediate |

On persistent failure: store `enrichment_status = failed`, log error, do not block the observation record. Failed enrichment observations still appear in lists — just without AI tags.

---

## Consumed By

All feature specs in `specs/features/`. This document is the authority for all standards listed above — feature specs reference by name, do not repeat.
