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
| `critical_insight.generate` | Critical insight draft (algorithm — Worksite Trend) | `specs/features/CRITICAL-INSIGHT.md` | Stage 1 |
| `critical_insight.generate` | Critical insight draft (algorithm — Cross-site Pattern) | `specs/features/CRITICAL-INSIGHT.md` | Stage 1 |
| `critical_insight.generate` | Critical insight draft (critical_observation trigger) | `specs/features/CRITICAL-INSIGHT.md` | Stage 1 |

### Incident intelligence pipeline

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `critical_incident.generate` | CriticalIncident draft (critical_incident trigger — direct path) | `specs/features/CRITICAL-INCIDENT.md` | Stage 1 |
| `critical_incident.generate` | CriticalIncident draft (algorithm trigger — site) | `specs/features/CRITICAL-INCIDENT.md` | Stage 1 |
| `critical_incident.generate` | CriticalIncident draft (algorithm trigger — cross-site) | `specs/features/CRITICAL-INCIDENT.md` | Stage 1 |

### Investigation pipeline

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `investigation.assist` | Investigation framework assistance | `specs/features/INCIDENT-CAPTURE.md` | Stage 3 |
| `investigation.generate_narrative` | Investigation toolbox narrative | `specs/features/INVESTIGATION.md` | Stage 4 |

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

| Job | Label | Spec file | Section |
|---|---|---|---|
| `fw_classify` | FW classification — insight path | `specs/globals/fw-classify-job.md` | `CANONICAL-FW-CLASSIFY-USER-PROMPT-INSIGHT` |
| `fw_classify` | FW classification — investigation path | `specs/globals/fw-classify-job.md` | `CANONICAL-FW-CLASSIFY-USER-PROMPT-INVESTIGATION` |
| `fw_classify` | FW classification — enquiry path | `specs/globals/fw-classify-job.md` | `CANONICAL-FW-CLASSIFY-USER-PROMPT-ENQUIRY` |

> `fw_classify` is a shared job. Base system prompt, all three user prompt variants, output schema, validation rules, and triggering conditions are defined in `specs/globals/fw-classify-job.md`. Feature specs reference this file — they do not contain prompt copies. The full Forge Works Map® Blueprint (`specs/globals/fw-map-blueprint.md`) is injected at runtime.

### Output generation

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `situational_brief.generate` | Situational brief | `specs/features/SITUATIONAL-BRIEF.md` | Stage 1 |
| `cop_thread.generate` | Community of practice thread | `specs/features/COMMUNITIES.md` | Stage 1 |
| `visit_briefing.generate` | Visit briefing pack | `specs/features/VISIT-BRIEFING.md` | Stage 1 |
| `visit_plan.summarise` | Visit summary (on complete) | `specs/features/SYSTEMIC-CAUSES.md` | Visit Completion |

### Management system

| Job | Label | Feature file | Stage |
|---|---|---|---|
| `document.ingest` | Document requirement extraction | `specs/features/MANAGEMENT-SYSTEM-INGESTION.md` | Stage 2 |

---

## Global references used across multiple prompts

Globals reach prompts under two rules — see `HOW-TO-READ-THIS.md §Global Injection Rules`:

- **Rule 1** — when a global taxonomy is referenced in a prompt, inject its `SUMMARY-REFERENCE` block at runtime. This applies whether the stage is classifying for the first time or passing the value through downstream.
- **Rule 2** — `fw_classify` receives the full `fw-map-blueprint.md` Blueprint.

The `Role` column below is diagnostic: it records which jobs determine each value for the first time versus which consume it downstream. Role does not change what gets injected.

| Reference | File | Used by — first-time roles | Used by — pass-through roles | Injection |
|---|---|---|---|---|
| Forge Works Map® Blueprint | `specs/globals/fw-map-blueprint.md` | `capture.observation`, `observation.enrich`, `capture.incident`, `capture.auto`, `investigation.assist` — each selects `fw_factor_hint` for the first time at its stage | `cop_thread.generate`, `situational_brief.generate`, `visit_briefing.generate`, `critical_insight.generate`, `investigation.generate_narrative` — receive factor names from upstream classification | Rule 1 Summary at every taxonomy reference; Rule 2 Full at `fw_classify` only |
| Signal type taxonomy | `specs/globals/signal-type-taxonomy.md` | `capture.observation`, `observation.enrich`, `capture.auto` — classify `signal_type` from raw text | `critical_insight.generate` — receives the cluster signal type breakdown | Rule 1 Summary at every reference |
| Energy type taxonomy | `specs/globals/energy-type-taxonomy.md` | `capture.observation`, `observation.enrich`, `capture.incident`, `capture.auto` — classify `energy_type` from raw text | `critical_insight.generate`, `investigation.generate_narrative` — receive `energy_type` and `energy_release_potential` from upstream | Rule 1 Summary at every reference |
| Barrier assessment values | `specs/globals/barrier-assessment-values.md` | `capture.observation`, `observation.enrich`, `capture.incident`, `capture.auto` — classify `barrier_assessment` from raw text | Other consumers receive the value via observation summaries | Rule 1 Summary at every reference |
| AI output standards | `specs/globals/ai-output-standards.md` | All prompts apply the rules inline | — | behavioural — referenced via spec, not injected |
| Anonymisation rules | `specs/globals/anonymisation-rules.md` | `observation.enrich` flags identifying phrases; all downstream prompts scrub before passing observation text | — | behavioural — referenced via spec, not injected |

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
