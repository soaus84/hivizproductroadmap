# HOW-TO-READ-THIS.md — Hiviz Developer Guide

**Forge Works · Hiviz SafetyPlatform**  
Version: 1.0

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

## Document Map

| File | What it contains | When to read it |
|------|-----------------|-----------------|
| `SPEC.md` | Data model, API, algorithms, logic rules, notifications, enquiry module | Always — this is the source of truth |
| `views.md` | UI/UX view specifications, screen flows, component behaviour | When building or understanding any UI surface |
| `prompts.md` | All AI prompt templates with system prompts and user prompt templates | When working on any AI job or prompt modification |
| `HOW-TO-READ-THIS.md` | This file | Once, at the start |
| `ROADMAP.md` | Feature roadmap, what's built, what's next | For prioritisation context |
| `claude.md` | Claude Code session brief — constraints, conventions, what to build | At the start of every Claude Code session |

**Deleted from repo (content consolidated into SPEC.md):**
- `specs/01-data-model-api-spec.md` → schema and API now in SPEC.md §3–6
- `specs/03-system-architecture.md` → diagrams and infra now in SPEC.md §14; algorithm logic in §7
- `specs/04-integration-logic-rules.md` → logic rules in SPEC.md §8; configuration in §10.3; V2/V3 notes in §16
- `specs/06-notification-events.md` → full notification registry now in SPEC.md §11
- `specs/07-enquiry-module-spec.md` → enquiry module now in SPEC.md §9

---

## Key Concepts

### safety_intelligence schema
All new Hiviz tables live in the `safety_intelligence` PostgreSQL schema. Existing platform tables (Organisation, Worksite, WorkType, User, etc.) are in `public` and are referenced via FK only — **never modified**.

### trigger_source
Almost every entity in Hiviz has a `trigger_source` field. It tells you how the entity was created. This matters for:
- What fields are populated (algorithm-triggered insights have `source_observation_ids`; manual/external ones have `source_metadata`)
- What review flow applies (algorithm-triggered insights require human review; manual creation IS review)
- What notifications fire

### cleared_for_* flags
There are two sharing gates. Both must be checked before content reaches crew:
- `cleared_for_sharing` on observations and investigations
- `cleared_for_toolbox` on critical insights

Neither is inferred. Both must be explicitly set by a human.

### legal_hold
`investigation.legal_hold = true` is a **hard block** enforced at the SQL query level, not application code. It blocks:
- The investigation from content selection
- Any CriticalInsight that references this investigation
- Any enquiry created from this investigation
- Notification events N24 and N25

### AI suggestion fields
Any field prefixed `ai_suggested_` is advisory. The authoritative version of that field (without the prefix) must be set by a human. The UI must make this visually clear. See SPEC.md §1 (Design Principles).

### FW Map® (Forge Works Map®)
The fw_classify job runs after significant intelligence events and classifies findings against the Forge Works Map® capacity factors. Fields are stored as parallel arrays on each entity:
```
fw_factors[]         VARCHAR(40)   — e.g. ['management_systems', 'operational_management']
fw_domains[]         VARCHAR(10)   — e.g. ['enable', 'enable']
fw_maturity_signals[] VARCHAR(12)  — e.g. ['compliant', 'leading']
fw_confidences[]     DECIMAL(3,2)  — e.g. [0.86, 0.73]
fw_rationales[]      TEXT          — one sentence per factor
fw_classification_basis TEXT       — overall evidence basis
fw_classified_at     TIMESTAMPTZ
```
Arrays are parallel by index. Factor[0] has domain[0], confidence[0], rationale[0]. Only factors that independently meet `fw_confidence >= 0.70` are stored. Maximum 3 per entity.

### Atrophy Score
Calculated per worksite. Rises when no observations are logged. Drives manager visit recommendations and atrophy alerts (N17). Score >70 triggers alert.

---

## Entity Relationships (Quick Reference)

```
Worksite
  ├── worksite_role_slot (supervisor / manager / safety_professional / control_verifier)
  │     └── worksite_slot_assignment (user assignments to slots)
  │
  ├── observation ──► AI enrichment ──► trend detection ──► critical_insight
  │                                                               │
  ├── incident ──► triage ──► investigation                      │
  │                    │             │                            │
  │            (solo critical)       └──────────────────────────►│
  │                    │                                          │
  │                    └──► critical_insight (solo_critical)      │
  │                                                               ▼
  │                                                          enquiry ──► enquiry_question
  │                                                                           └── enquiry_response
  │
  ├── toolbox_talk (assembled from observations + investigations + critical_insights)
  │
  └── visit_plan ──► visit_briefing

critical_insight ──► situational_brief
critical_insight ──► cop_thread_seed
investigation ──► situational_brief
investigation ──► cop_thread_seed
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

---

## How to Navigate SPEC.md

SPEC.md is long. Don't read it front-to-back. Navigate by what you're building:

**Building a new entity?** Go to §3 (Core Entities) or §4 (Enquiry Entities) or §5 (Output Entities). Each section has the full SQL schema with indexes.

**Building an API endpoint?** Go to §6. All endpoints are listed with request/response shapes.

**Building algorithm logic?** Go to §7 (Algorithm Engine). The pseudocode is definitive — if it's not there, it shouldn't exist.

**Understanding a business rule?** Go to §8 (Logic Rules). Every rule has a code identifier (OBS-01, INC-04, etc.) for easy reference in PRs and discussions.

**Building the enquiry module?** Go to §9. Everything about enquiries — triggers, question types, targeting, AI prompts, legal rules — is in one place.

**Building notification handling?** Go to §11 (Notification Events Registry). Every event has a number (N01–N30), trigger, recipients, channels, tone, timing, and message.

**Adding an async job?** Go to §12. The full job queue is listed with target latencies.

**Worried about what to audit log?** Go to §13.

**Checking infrastructure config?** §14 has the component diagram, Anthropic API details, and DB requirements.

---

## Devpacks

When you're in a Claude Code session building a specific feature, use the relevant devpack rather than navigating all of SPEC.md. Devpacks are scoped extracts — schema, endpoints, algorithms, notifications, and acceptance criteria for one feature only.

See SPEC.md §17 for the devpack index.

Current devpacks: `observations`, `incidents`, `intelligence`, `toolbox`, `visits`, `management-systems`, `risk`

> Devpack files do not yet exist. They will be created when each feature enters the build queue. The index in SPEC.md §17 defines their intended scope.

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

*Last updated: May 2026 — reflects V7 Communities architecture and consolidated SPEC.md.*
