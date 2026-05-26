# INSIGHT.md — Insight Workspace Spec

**Code ID:** `workspace.core`
**Status:** Always on — every Hiviz organisation
**Version:** 1.0 — May 2026

> The field-to-intelligence loop. Captures what is happening on site, generates pattern-level findings, routes them through human review, and broadcasts learning back to crews. Runs independently of incident data — the loop is complete without it.

---

## Standalone value

An organisation running on the Insight workspace alone gets the core safety learning loop:

Supervisors capture observations in the field (conversational AI, seconds to complete). Near-misses, at-risk conditions, and barrier failures are enriched automatically, pooled, and analysed for patterns. When a pattern or critical signal is detected, a Critical Insight is generated and surfaced for safety manager review. Approved insights become toolbox talks delivered to crews. The whole loop — field signal to crew learning — without any formal incident machinery.

**How it could be sold standalone:** "Replace the safety observation form with a conversation. Replace the weekly safety meeting with a talk generated from what your own sites reported this week." No investigation workflow, no regulatory reporting, no complex onboarding. Just the learning loop.

---

## What activating this workspace turns on

- Observation capture — conversational AI (mobile), offline fallback
- AI enrichment of observations — signal type, energy type, barrier assessment, confidence scoring
- Critical Insight generation — from single high-confidence signals and from pooled trend detection
- Human review gate — safety manager approves, edits, or rejects each insight
- Insight improve step — safety manager creates corrective actions from approved insights and disseminates to one or many sites
- Toolbox talk assembly — content selected from approved insights and enriched observations
- Toolbox talk delivery — presenter view, attendance lock, atrophy update
- Enquiry generation — questions derived from an approved insight, dispatched to sites
- Enquiry live synthesis — responses synthesised as they arrive
- Enquiry final summary with recommended actions
- Corrective actions — worksite-scoped task list, owned by named onsite personnel, tracked to closure
- FW Map® classification — on every approved intelligence entity (insight, enquiry)
- Offline observation fallback — queues to local storage, syncs on reconnect

---

## Feature inventory

| Feature | User role(s) | Spec authority | State |
|---|---|---|---|
| Observation capture conversation (`capture.observation`) | Supervisor | `features/OBSERVATION-CAPTURE.md` Stage 1 | working |
| Observation AI enrichment (`observation.enrich`) | System (async) | `features/OBSERVATION-CAPTURE.md` Stage 2 | working |
| Trend detection algorithm | System | `SPEC.md §7.2` | spec-only |
| Critical Insight generation — critical_observation trigger | System (async) | `features/CRITICAL-INSIGHT.md` Stage 1 | working |
| Critical Insight generation — Worksite Trend trigger | System (async) | `features/CRITICAL-INSIGHT.md` Stage 1 | spec-only |
| Critical Insight generation — Cross-site Pattern trigger | System (async) | `features/CRITICAL-INSIGHT.md` Stage 1 | spec-only |
| Insight human review gate | Safety manager | `features/CRITICAL-INSIGHT.md` §Review | working |
| Insight improve step — corrective action creation + dissemination | Safety manager | `features/CORRECTIVE-ACTIONS.md` §3.1 | spec-only |
| Corrective action tracking — worksite task list | Supervisor / safety slot | `features/CORRECTIVE-ACTIONS.md` §5.1 | spec-only |
| Corrective action dashboard — SM view | Safety manager | `features/CORRECTIVE-ACTIONS.md` §5.2 | spec-only |
| Toolbox talk assembly (`toolbox_talk.generate`) | System (async) | `features/TOOLBOX-TALK.md` | spec-only |
| Toolbox talk delivery — presenter view | Supervisor | `features/TOOLBOX-TALK.md` | spec-only |
| Toolbox talk attendance lock | Supervisor | `features/TOOLBOX-TALK.md` | spec-only |
| Enquiry question generation (`enquiry.generate_questions`) | System (async) | `features/ENQUIRY.md` Stage 1 | spec-only |
| Enquiry dispatch — human review + send | Safety manager | `features/ENQUIRY.md` Stage 2 | spec-only |
| Enquiry live synthesis (`enquiry.synthesise`) | System (per response) | `features/ENQUIRY.md` Stage 3 | spec-only |
| Enquiry final summary (`enquiry.summarise`) | System (on close) | `features/ENQUIRY.md` Stage 4 | spec-only |
| FW Map® classification — insight path (`fw_classify`) | System (async) | `globals/fw-classify-job.md` | working |
| Context request — low-confidence follow-up | System | `features/OBSERVATION-CAPTURE.md` Stage 3 | spec-only |

---

## UX surfaces

| View | Role(s) | Access path | Purpose | Design state |
|---|---|---|---|---|
| Supervisor home | Supervisor | App open / home tab | Active verifications due, pending corrective actions, recent observations, quick-capture entry point | to design |
| Observation capture | Supervisor | "Log observation" tap | Conversational AI capture — near-miss, at-risk, barrier failure | simulator: `simulators/observation-to-insight.html` |
| Observation feed | Safety manager | Insights tab → observations | List of enriched observations, filterable by type / site / date | to design |
| Insight pipeline | Safety manager | Insights tab | Kanban or list: draft → review → approved → classified. Primary SM workspace. | wireframe: `wireframes/pipeline.html` |
| Insight detail + review | Safety manager | Tap insight in pipeline | Read AI draft; approve / edit / reject; trigger improve step | wireframe: `wireframes/pipeline.html` |
| Improve step — action creation | Safety manager | From insight review | Create corrective actions, select target sites, set owner and due date | to design |
| Corrective actions — worksite view | Supervisor / safety slot | Actions tab (worksite) | Open actions for this site, sorted by due date; tap to start / close | to design |
| Corrective actions — SM dashboard | Safety manager | Actions tab (SM) | All sites: open, overdue, completion rate | to design |
| Enquiry management | Safety manager | Enquiry tab | Review generated questions, edit, dispatch to sites | to design |
| Enquiry response feed | Safety manager | Open enquiry | Live synthesis panel as responses arrive | to design |
| Enquiry summary + actions | Safety manager | Closed enquiry | Final summary, recommended actions, convert to corrective actions | to design |
| Toolbox talk — presenter view | Supervisor | Talks tab → today's talk | Present talk to crew; advance through sections; lock attendance | to design |
| Toolbox talk — attendance | Supervisor | From presenter view | Crew sign-on or name-tick; attendance locked on submit | to design |
| Toolbox talk library | Safety manager | Talks tab | History of delivered talks, filtered by site / date / work type | to design |

---

## Capability gates

| Gate | Default | What it controls |
|---|---|---|
| `fw_classify.multi_factor` | on | Up to 3 FW factors per classification vs single |
| `insight.cross_site_pattern` | off | Cross-site Pattern variant for algorithm-triggered insights |
| `enquiry.factor_aware_question_types` | off | Question types selected per classified FW factor |
| `talk.maturity_aware_framing` | off | Talk register adapts to FW maturity level of classified factors |
| `endorsement.feedback_loop` | off | Peer endorsements feed fw_classify confidence weighting |
| `observation.offline_fallback` | on | Observation queues to local SQLite when offline |

---

## Workspace connections

**Built on:** Nothing — this is the always-on baseline.

**Produces for downstream:**
- Approved + classified CriticalInsights → `workspace.analytics` (FW factor aggregation)
- Corrective actions → atrophy score signal (open/overdue)
- Enquiry toolbox narratives → talk pool (self-contained)

**Enriched by:**
- `workspace.incident` — closed investigations inject investigation-derived insights and toolbox narratives; systemic cause bridge creates CriticalInsights from confirmed root causes
- `workspace.ms` — observation enrichment gains procedure-gap detection; insight generation gains applicable document context
- `workspace.analytics` — atrophy score and FW capacity profile surfaces appear when Systemic Map is active

---

*Wireframes exist for: observation capture (simulator), insight pipeline (pipeline.html). Most other views are to design.*
