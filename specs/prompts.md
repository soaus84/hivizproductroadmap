# prompts.md — Hiviz AI Prompt Index

**Forge Works · Hiviz SafetyPlatform**
Version: 2.0 — Index only
Status: Supersedes v1.0 prompt library

> **This file is an index.** Canonical prompt text, schemas, validation rules, and V2 cascade notes now live in `specs/features/`. If you need to read or modify a prompt, go to the feature file directly. Do not add prompt text to this file.

---

## How to find a prompt

1. Find the job name in the index below
2. Follow the pointer to the feature file
3. Read the canonical prompt in the `CANONICAL-SYSTEM-PROMPT` section for that stage

---

## Prompt Index

### Capture prompts (front-end, conversational)

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `capture.observation` | Observation capture conversation | `specs/features/OBSERVATION-CAPTURE.md` | Stage 1 |
| `capture.incident` | Incident capture conversation | `specs/features/INCIDENT-CAPTURE.md` | Stage 1 |
| `capture.auto` | Auto triage conversation | `specs/features/INCIDENT-CAPTURE.md` | Stage 0 |

### Observation pipeline (back-end, async)

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `observation.enrich` | Observation enrichment & classification | `specs/features/OBSERVATION-CAPTURE.md` | Stage 2 |
| `observation.context_request` | Context request (low-confidence follow-up) | `specs/features/OBSERVATION-CAPTURE.md` | Stage 3 |

### Intelligence generation

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `critical_insight.generate` | Critical insight draft (algorithm trigger) | `specs/features/CRITICAL-INSIGHT.md` | Stage 1 |
| `critical_insight.generate` | Critical insight draft (solo_critical trigger) | `specs/features/CRITICAL-INSIGHT.md` | Stage 1 |

### Investigation pipeline

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `investigation.assist` | Investigation framework assistance | `specs/features/INCIDENT-CAPTURE.md` | Stage 3 |
| `investigation.generate_narrative` | Investigation toolbox narrative | `specs/features/INVESTIGATION.md` | Stage 3 |

### Toolbox talk

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `toolbox_talk.generate` | Full toolbox talk assembly | `specs/features/TOOLBOX-TALK.md` | Stage 2 |

### Enquiry

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `enquiry.generate_questions` | Enquiry question generation (3 trigger variants) | `specs/features/ENQUIRY.md` | Stage 1 |
| `enquiry.synthesise` | Enquiry live synthesis | `specs/features/ENQUIRY.md` | Stage 3 |
| `enquiry.summarise` | Enquiry final summary | `specs/features/ENQUIRY.md` | Stage 4 |

### FW Map® classification

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `fw_classify` | FW classification — insight path | `specs/features/CRITICAL-INSIGHT.md` | Stage 3 |
| `fw_classify` | FW classification — investigation path | `specs/features/INVESTIGATION.md` | Stage 4 |
| `fw_classify` | FW classification — enquiry path | `specs/features/ENQUIRY.md` | Stage 5 |

> Note: `fw_classify` uses the same base system prompt across all three paths — defined once in `specs/features/INVESTIGATION.md` Stage 4 (`CANONICAL-FW-CLASSIFY-BASE-SYSTEM-PROMPT`). The full Forge Works Map® Blueprint is injected from `specs/globals/fw-map-blueprint.md` at runtime.

### Output generation

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `situational_brief.generate` | Situational brief | `specs/features/SITUATIONAL-BRIEF.md` | Stage 1 |
| `cop_thread.generate` | Community of practice thread | `specs/features/COMMUNITIES.md` | Stage 1 |
| `visit_briefing.generate` | Visit briefing pack | `specs/features/VISIT-BRIEFING.md` | Stage 1 |

### Management system

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `document.ingest` | Document requirement extraction | `specs/features/MANAGEMENT-SYSTEM-INGESTION.md` | Stage 2 |

---

## Global references used across multiple prompts

| Reference | File | Used by |
|---|---|---|
| Forge Works Map® Blueprint | `specs/globals/fw-map-blueprint.md` | `fw_classify`, `cop_thread.generate`, `visit_briefing.generate`, `situational_brief.generate` |
| Signal type taxonomy | `specs/globals/signal-type-taxonomy.md` | `capture.observation`, `observation.enrich`, `capture.auto` |
| Energy type taxonomy | `specs/globals/energy-type-taxonomy.md` | All capture and enrichment prompts |
| Barrier assessment values | `specs/globals/barrier-assessment-values.md` | All capture and enrichment prompts |
| AI output standards | `specs/globals/ai-output-standards.md` | All prompts |
| Anonymisation rules | `specs/globals/anonymisation-rules.md` | `observation.enrich` and all downstream prompts that reference observation text |

---

## Prompt versioning

Prompts are versioned in `ai_prompt_config` (database table). The canonical text in `specs/features/` is the source; `ai_prompt_config` is populated from those files, not the other way around.

```sql
-- Prompt key registry (for ai_prompt_config)
observation.enrich              max_tokens: 1000
observation.context_request     (no AI call — notification format only)
critical_insight.generate       max_tokens: 1000
investigation.assist            max_tokens: 1000
investigation.generate_narrative max_tokens: 1000
toolbox_talk.generate           max_tokens: 1500
enquiry.generate_questions      max_tokens: 1000
enquiry.synthesise              max_tokens: 1000
enquiry.summarise               max_tokens: 1000
fw_classify                     max_tokens: 2000
situational_brief.generate      max_tokens: 1000
cop_thread.generate             max_tokens: 1000
visit_briefing.generate         max_tokens: 1000
document.ingest                 max_tokens: 2000

-- Capture prompts (front-end only — not stored in ai_prompt_config)
capture.observation             max_tokens: 600
capture.incident                max_tokens: 600
capture.auto                    max_tokens: 700
```

Capture prompts (`capture.*`) are front-end conversational prompts used directly in the app. They are not stored in `ai_prompt_config` — they are loaded from feature spec files at runtime by the app and sim loader.

---

*Last updated: May 2026 — v2.0 index-only format. Prompt text moved to `specs/features/`. To restore historical prompt text, see git history for prompts.md v1.0.*
