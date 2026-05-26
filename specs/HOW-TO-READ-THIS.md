# HOW-TO-READ-THIS.md — Hiviz Developer Guide

**Forge Works · Hiviz SafetyPlatform**
Version: 2.0 — DRY documentation architecture

This document is the starting point for any developer or Claude Code session working on the Hiviz SafetyPlatform. Read this before reading anything else.

---

## What This Project Is

Hiviz SafetyPlatform is a field safety intelligence platform for construction and industrial environments. Its purpose is to deliver **operationally significant safety intelligence** to field workers and managers — content that drives a communication, learning, or improvement outcome. Not dashboards. Not metrics. Actionable intelligence.

The platform is built by **Forge Works** and is the product of Stephen's design.

---

## The Core Loop (Read This First)

```
Field Signal
(observation / incident)
        │
        ▼
Intelligence Pipeline
  ├── Trend detection ──► CriticalInsight ──► Toolbox Talk (broadcast to crew)
  │                              │
  │                              └──► Enquiry (pull intelligence from sites)
  │
  └── Investigation ──► Toolbox narrative ──► Situational Brief (to managers)
                │
                └──► CoP Thread (discussion seeding)
```

Everything in the system flows from a field signal. Supervisors observe or report. The system detects patterns or triggers. AI drafts content. Humans review. Content reaches crew.

The **human review gate** is non-negotiable. No AI output reaches crew without a human approving it.

---

## Documentation Architecture — How This Project Is Organised

This project uses a **DRY (Don't Repeat Yourself) documentation model**. Every piece of information has exactly one authoritative home. Everything else points to it — it does not copy it.

There are three tiers:

```
specs/globals/          ← Tier 1: Cross-cutting definitions, taxonomies, rules
specs/features/         ← Tier 2: Feature-by-feature pipeline specs (canonical prompt text lives here)
specs/ (root)           ← Tier 3: Platform-wide data model, API, architecture
simulators/             ← Test harnesses — inject prompts from Tier 2, contain no canonical content
prompt-lab.html         ← Prompt tuning UI — loads prompts from Tier 2, contains no canonical content
```

### The Rule

> **If prompt text, a taxonomy definition, or a cross-cutting rule exists in more than one place, the copy in `specs/globals/` or `specs/features/` is the authority. Everything else is a reference implementation. If they conflict, the spec wins.**

This is enforced in `claude.md` and applies to all Claude Code sessions.

---

## Tier 1 — Global References `specs/globals/`

Definitions and rules that are not owned by any single feature but consumed by many. Globals contain definitions only — never prompt text.

| File | What it contains | Consumed by |
|------|-----------------|-------------|
| `fw-map-blueprint.md` | The 15 Forge Works Map® factors, 3 domains, 3 maturity levels, per-factor classification guidance | `fw_classify` job, `cop_thread.generate`, `visit_briefing.generate`, `situational_brief.generate` |
| `signal-type-taxonomy.md` | The 5 signal types, their definitions, and pipeline routing rules | Observation capture, enrichment, trend detection |
| `energy-type-taxonomy.md` | The 8 energy types and their definitions | Observation capture, incident capture, enrichment |
| `barrier-assessment-values.md` | The 5 barrier assessment states and their meanings | Observation capture, enrichment, insight generation |
| `ai-output-standards.md` | JSON-only output rules, rationale standard, suggestion language, confidence thresholds | All AI prompts |
| `anonymisation-rules.md` | PII handling rules — what to flag, how to scrub for downstream prompts | All prompts that reference observation text |

**How globals are used:** A feature spec says *"the `fw_factor_hint` must be one of the 15 factors defined in `globals/fw-map-blueprint.md`"* — it does not copy the list. A sim that needs the signal type taxonomy links to `globals/signal-type-taxonomy.md` — it does not inline the definitions.

The Blueprint (`fw-map-blueprint.md`) is injected in full at runtime into `fw_classify` (Prompt 10). All other consumers reference it for validation only.

### Global Injection Rules

Two rules govern how globals reach prompts at runtime:

> **Rule 1 — When a global taxonomy is referenced in a prompt, inject its `SUMMARY-REFERENCE` block.**
> Whether the stage is classifying for the first time or passing the value through downstream, Summary is what gets injected. The Summary block is one line per value: item label plus single-sentence description, enough to ground both classification and pass-through framing.

> **Rule 2 — `fw_classify` receives the full `fw-map-blueprint.md` Blueprint.**
> Full injection is reserved for this one job. Every other consumer of the Blueprint (including `fw_factor_hint` selection at capture, enrichment, and investigation assist) gets the Summary block.

Behavioural rules (`ai-output-standards.md`, `anonymisation-rules.md`) are not injected as reference material — the AI's discipline is conveyed by inline instructions in each prompt's CANONICAL-SYSTEM-PROMPT, and the global is the canonical authority for those instructions.

Summary blocks are extracted at runtime using the same `extractSection()` pattern as canonical prompts — e.g. `extractSection(md, 'SUMMARY-REFERENCE — signal-type-taxonomy')`.

### Role — a diagnostic column, not an injection control

Each feature spec's **Global References Used** table carries a `Role` column. Role describes the stage's relationship to the value, not what gets injected:

- **first-time** — this stage is where the field is initially determined. The AI is producing the value from raw text or context.
- **pass-through** — this stage receives the value already classified upstream and uses it for framing or output language.
- **behavioural** — the rule (output standards, anonymisation) is referenced by spec and applied inline in the prompt; nothing is injected as a Summary block.

Role does not change what is injected — Rule 1 still applies to every taxonomy reference regardless of role. The column exists so a reader can see at a glance which stage owns which classification. When a stage's role changes (e.g. a downstream consumer becomes a re-classifier), update the Role column — no injection-mechanism rewiring is required.

---

## Tier 2 — Feature Specs `specs/features/`

One file per feature. Each file owns the **complete pipeline** for that feature in sequential order. This is where canonical prompt text lives. Sims and the prompt lab load from here — they do not contain their own copies.

| File | Feature | Prompts owned | Sim(s) that use it |
|------|---------|--------------|-------------------|
| `OBSERVATION-CAPTURE.md` | Observation capture conversation + enrichment + context request | P6 `capture.observation`, P1 `observation.enrich`, P2 `observation.context_request` | `capture-sim.html`, `capture-sim-offline.html` |
| `INCIDENT-CAPTURE.md` | Incident capture conversation + triage | P7 `capture.incident`, P8 `capture.auto` | `capture-sim.html` |
| `CRITICAL-INSIGHT.md` | Insight generation, review, FW classification | P3 `critical_insight.generate`, P10 `fw_classify` (insight path) | `workflow-sim.html` |
| `INVESTIGATION.md` | Investigation assistance, toolbox narrative, FW classification | P4 `investigation.assist`, P5 `investigation.toolbox_narrative`, P10 `fw_classify` (investigation path) | `workflow-sim.html` |
| `TOOLBOX-TALK.md` | Talk assembly and content selection | P6 `toolbox_talk.assemble` | `workflow-sim.html` |
| `ENQUIRY.md` | Enquiry question generation, live synthesis, final summary, FW classification | P7 `enquiry.generate`, P8 `enquiry.synthesise`, P9 `enquiry.summarise`, P10 `fw_classify` (enquiry path) | `enquiry-sim.html` |
| `MANAGEMENT-SYSTEM-INGESTION.md` | Document ingestion, requirement extraction | `document.ingest` AI prompt | `ms-sim.html` |
| `VISIT-BRIEFING.md` | Visit briefing pack generation, focus area prompts | P13 `visit_briefing.generate` | None yet |
| `COMMUNITIES.md` | CoP thread generation, framing rules | P12 `cop_thread.generate` | None yet |
| `SITUATIONAL-BRIEF.md` | Situational brief generation | P11 `situational_brief.generate` | None yet |

### What each feature file contains

Every feature spec follows this structure:

1. **What this feature is** — one paragraph, operational purpose
2. **Pipeline stages** — ordered. Each stage covers:
   - Trigger (what starts it)
   - Input (what data is passed in)
   - The canonical prompt (system prompt + user prompt template)
   - Output schema with field-level validation rules
   - Downstream effects (what jobs or notifications fire next)
3. **Global references used** — explicit list of which globals apply and how
4. **Sim reference** — which sim exercises this feature; note that the sim injects its prompt from this file
5. **V2/V3 cascade notes** — fields captured now that are not yet fully consumed downstream

---

## Tier 3 — Platform Specs `specs/` (root)

Platform-wide documentation that feature specs reference for schema, API, and architecture. These files do not contain prompt text — they point to `specs/features/` for that.

| File | What it contains | When to read it |
|------|-----------------|-----------------|
| `SPEC.md` | Data model (full Prisma schema), API endpoints, algorithm engine, logic rules, notification events registry, async job queue, infrastructure | Always — source of truth for data and API |
| `MODEL-MAP.md` | Holistic AI layer reference: streams, states, dependencies, capability gates, Live Sim catalogue. The dashboard for what's connected to what and what's working right now | Always — start here when orienting to the AI layer |
| `views.md` | All UI/UX view specifications, screen flows, component behaviour | When building or understanding any UI surface |
| `prompts.md` | Prompt index only — one-liner per prompt pointing to its feature file. No prompt text. | When you need to find which feature owns a prompt |
| `HOW-TO-READ-THIS.md` | This file | Once, at the start of every session |
| `claude.md` | Claude Code session brief — constraints, conventions, authority rules | At the start of every Claude Code session |

### How `prompts.md` works under the new architecture

`prompts.md` is now an **index only**. Each entry looks like:

```
Prompt 1 — Observation Enrichment (observation.enrich)
→ Canonical prompt: specs/features/OBSERVATION-CAPTURE.md, Stage 2
→ Global references: fw-map-blueprint.md (fw_factor_hint validation), signal-type-taxonomy.md, barrier-assessment-values.md, anonymisation-rules.md
```

Prompt text is not duplicated into `prompts.md`. If you need to read or modify a prompt, go to the feature file directly.

---

## How Simulators Work Under This Architecture

Simulators are **test harnesses**, not sources of truth. Each sim loads its system prompt from the relevant feature spec file at runtime via `fetch()`, rather than containing a hardcoded copy.

```javascript
// What a sim script block now looks like
const OBSERVATION_SYSTEM = await fetch('/specs/features/OBSERVATION-CAPTURE.md')
  .then(r => r.text())
  .then(md => extractSection(md, 'CANONICAL-SYSTEM-PROMPT'))
```

This means:
- Updating the prompt in the feature spec immediately updates what the sim tests
- The sim never drifts from the spec
- A comment at the top of each sim identifies its source file

The prompt lab works the same way — each prompt entry loads from the feature file rather than hardcoding text in the JS array.

### Live Sim Class

A **Live Sim** is the canonical sim class for exercising a stream end-to-end. The catalogue of streams and their Live Sims lives in `MODEL-MAP.md`. To qualify as a Live Sim, a simulator must meet all six criteria:

1. **Live AI** — calls Anthropic at runtime using the user's API key. No scripted output.
2. **Spec-loaded prompts** — every prompt (system prompt + user prompt templates) is fetched from `specs/features/*.md` or `specs/globals/*.md` via `extractSection()`. Zero prompt text inlined in the sim file. If a prompt is missing a `CANONICAL-*` marker that makes it extractable, fix the spec — do not inline.
3. **Stream-scoped** — exercises one coherent stream end-to-end, from entry trigger to terminal output. Not a single-stage harness; not a multi-stream demo.
4. **References surfaced** — each stage shows its applicable globals as a REFS strip, tagged by injection level (SUMMARY / FULL / BEHAVIOURAL) and Role (first-time / pass-through / behavioural). Fetched from the relevant feature spec's `## Global References Used` table.
5. **State badge** — the header carries the stream's current state (working / dormant / spec-only / broken) and its workspace tags (`core`, `risk`, `ms`, `analytics`, `communities`). Pulled from `MODEL-MAP.md` so it stays accurate as state changes.
6. **No fixtures masquerading as taxonomy** — any taxonomy data displayed in the sim either comes from the relevant globals file or from a single shared fixture in `simulators/hiviz-prompt-loader.js`. No sim-local copies of enum lists.

`simulators/observation-to-insight.html` is the exemplar — read it first when building a new Live Sim.

Live Sims also expose **capability gates** in the UI where they affect the stage being exercised (per the gates table in `MODEL-MAP.md`). Toggling a gate changes the stream's behaviour live, so a Live Sim doubles as an empirical optimisation surface — "what does this branch produce with gate X on vs off?"

**Tuning tools** (e.g. `prompt-lab.html`) are a separate class: they target prompt-by-prompt tuning rather than stream-by-stream exercise. They share the spec-loading discipline but are not stream-scoped.

### Wet Sims — non-authoritative

Several simulators predate the Live Sim class: `capture-sim.html`, `capture-sim-offline.html`, `workflow-sim.html`, `enquiry-sim.html`. These are kept available for historical demo purposes but they are **not authoritative**. They may contain inlined prompt text, hardcoded enum values, or schemas that have drifted from the current spec.

> **Rule.** Wet sims must not be used as a reference for prompts, contracts, or behaviour. AI and developers consulting the spec must go to `specs/features/`, `specs/globals/`, and `MODEL-MAP.md` — never to a wet sim. If a wet sim disagrees with the spec, the spec wins; the wet sim is stale.

Each wet sim file carries a banner comment stating this and pointing to the corresponding Live Sim (or "to build" if the replacement doesn't exist yet).

---

## How to Navigate — What Are You Building?

**A new feature from scratch?**
Start at the relevant `specs/features/` file. If it doesn't exist yet, create it before writing any code. Read `SPEC.md` §3–6 for the schema and API shape.

**Modifying a prompt?**
Find it in `prompts.md` (index), follow the pointer to `specs/features/`, edit it there. The sim and prompt lab pick it up automatically.

**Adding a taxonomy value or classification rule?**
Edit the relevant file in `specs/globals/`. Search for all feature files that reference it and verify the validation rules are still consistent.

**Building a sim or prompt lab entry?**
The sim is a harness. Write the UI. Point it at the feature file. Do not write prompt text into the sim.

**Checking a data schema or API endpoint?**
`SPEC.md` §3–6. Always.

**Checking a business rule?**
`SPEC.md` §8. Rules have identifiers (OBS-01, INC-04, etc.) for PR reference.

**Building the enquiry module?**
`SPEC.md` §9 for the module spec, `specs/features/ENQUIRY.md` for the prompts.

**Checking notification behaviour?**
`SPEC.md` §11 (Notification Events Registry, N01–N30).

**Adding an async job?**
`SPEC.md` §12.

---

## Devpacks

When you're in a Claude Code session building a specific feature, use the relevant devpack rather than navigating all of SPEC.md. Devpacks are scoped extracts — schema, endpoints, algorithms, notifications, and acceptance criteria for one feature only.

See `SPEC.md` §17 for the devpack index.

Current devpacks: `observations`, `incidents`, `intelligence`, `toolbox`, `visits`, `management-systems`, `risk`

> Devpack files do not yet exist. They will be created when each feature enters the build queue. The index in SPEC.md §17 defines their intended scope. Each devpack will reference the relevant `specs/features/` file rather than copying prompt content.

---

## Key Concepts

### safety_intelligence schema
All new Hiviz tables live in the `safety_intelligence` PostgreSQL schema. Existing platform tables (Organisation, Worksite, WorkType, User, etc.) live in the existing schema and are referenced via foreign keys — never modified or duplicated.

### FW Map® field conventions
```sql
fw_factors[]         TEXT[]        -- e.g. ['management_systems', 'operational_management']
fw_domains[]         TEXT[]        -- e.g. ['enable', 'enable']
fw_maturity_signals[] TEXT[]       -- e.g. ['compliant', 'leading']
fw_confidences[]     DECIMAL(3,2)  -- e.g. [0.86, 0.73]
fw_rationales[]      TEXT[]        -- one sentence per factor
fw_classification_basis TEXT       -- overall evidence basis
fw_classified_at     TIMESTAMPTZ
```
Arrays are parallel by index. Only factors that independently meet `fw_confidence >= 0.70` are stored. Maximum 3 per entity. Full factor definitions in `specs/globals/fw-map-blueprint.md`.

### Atrophy Score
Calculated per worksite. Rises when no observations are logged. Drives manager visit recommendations and atrophy alerts (N17). Score >70 triggers alert. Formula in `SPEC.md` §7.

---

## Entity Relationships (Quick Reference)

```
Worksite
  ├── worksite_role_slot (supervisor / manager / safety_professional / control_verifier)
  │     └── worksite_slot_assignment (user assignments to slots)
  │
  ├── observation ──► AI enrichment ──► trend detection ──────────────────────────► critical_insight
  │                         │                                                              ▲
  │              (barrier_failure / unwanted_energy_event,                                │
  │               confidence ≥ 0.70) ────────────────────────────────────────────────────┤
  │                                                                                       │
  ├── incident ──► triage ──► critical_incident ──► human review ──► investigation        │
  │                                                                       │                │
  │                                              (systemic cause phase,   │                │
  │                                               optional, human-        └──────────────►┘
  │                                               initiated)                external_investigation
  │                                                                                       │
  │                                                                                       ▼
  │                                                                                 enquiry ──► enquiry_question
  │                                                                                                 └── enquiry_response
  │
  ├── toolbox_talk (assembled from observations + investigations + critical_insights)
  │
  └── visit_plan ──► visit_briefing

critical_insight ──► situational_brief
critical_insight ──► cop_thread_seed
investigation    ──► situational_brief
investigation    ──► cop_thread_seed
```

---

## Rules Developers Must Not Break

1. **Never modify existing platform tables.** All new data in `safety_intelligence` schema.
2. **Never auto-approve AI output.** `cleared_for_toolbox` and `cleared_for_sharing` require explicit human action.
3. **Never bypass legal_hold at the application layer.** Enforce in SQL.
4. **Never expose the Anthropic API key to the client.** Server-side env var only.
5. **Never send AI-generated content directly to crew.** Always goes through the human review gate first.
6. **Never delete records.** Use status fields (`inactive`, `cancelled`, `archived`). Investigation rejection archives, not deletes.
7. **Delivery record is final.** Once `delivered_at` is set on a toolbox talk, content is locked.
8. **Never omit closure notifications.** N05, N12, N13, N21, N28, N29 are the loop-close events that drive re-engagement. Omitting them breaks the product promise.
9. **Never write prompt text into a sim or the prompt lab.** Prompts live in `specs/features/`. Sims and the prompt lab load from there.
10. **Never copy a global definition into a feature file.** Reference it by name and path. One definition, one location.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14, TypeScript |
| Database | PostgreSQL 14+ (`safety_intelligence` schema) |
| AI | Anthropic claude-sonnet-4-20250514 via `/v1/messages` |
| Async jobs | BullMQ + Redis |
| Mobile | Capacitor |
| Hosting | Vercel |
| Repo | github.com/soaus84/hivizproductroadmap |

---

## Conventions

- Field naming: `snake_case` throughout (SQL and JSON API responses)
- UUIDs: all primary keys use `gen_random_uuid()`
- Timestamps: `TIMESTAMPTZ` throughout, always UTC
- AI fields: prefixed `ai_` for enrichment fields, `ai_suggested_` for suggestion fields that require human confirmation
- Soft deletes: use `status` fields, never `DELETE` from safety tables
- Schema prefix: all new tables in `safety_intelligence.` — never in `public.`
- API versioning: `/api/v1/` prefix on all new endpoints

---

## Document Lineage (What Was Superseded)

| Old location | Content now lives in |
|---|---|
| `specs/01-data-model-api-spec.md` | `SPEC.md` §3–6 |
| `specs/02-ai-prompt-library.md` | `specs/features/` (prompt text) + `prompts.md` (index) |
| `specs/03-system-architecture.md` | `SPEC.md` §14 (infra), §7 (algorithms) |
| `specs/04-integration-logic-rules.md` | `SPEC.md` §8 (logic), §10.3 (config), §16 (V2/V3) |
| `specs/06-notification-events.md` | `SPEC.md` §11 |
| `specs/07-enquiry-module-spec.md` | `SPEC.md` §9 |
| `specs/fw-map-classification-reference-v1.md` | `specs/globals/fw-map-blueprint.md` |
| Prompt text in `capture-sim.html` | `specs/features/OBSERVATION-CAPTURE.md`, `INCIDENT-CAPTURE.md` |
| Prompt text in `capture-sim-offline.html` | `specs/features/OBSERVATION-CAPTURE.md` |
| Prompt text in `ms-sim.html` | `specs/features/MANAGEMENT-SYSTEM-INGESTION.md` |
| Prompt text in `prompt-lab.html` | Respective `specs/features/` files |

---

*Last updated: May 2026 — V2.0 DRY documentation architecture. Reflects V7 Communities design.*
