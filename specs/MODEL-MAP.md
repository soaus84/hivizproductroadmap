# MODEL-MAP.md — Hiviz Holistic AI Model Map

**Forge Works · Hiviz SafetyPlatform — Working Resource**
Version: 1.0 — May 2026

> **Purpose.** This is the central reference for the holistic AI layer that drives Hiviz's value proposition. It names every stream, records its current state, lists its dependencies, and points to the Live Sim that exercises it. Read this file first when you want to understand what's connected to what, what's working, what's dormant, and where to go to test a branch.

---

## How To Read This

The Hiviz AI layer is a **single complete model** — every stage is specified, every prompt is canonical, every contract is defined. What varies is **what's active right now**. Activation is granular: capability gates, workspace toggles, and the natural data-flow conditions of the pipeline.

This file has three layers:

1. **Stream catalogue** — every coherent end-to-end flow, with state and Live Sim link
2. **Capability gates** — the on/off toggles that change what fires
3. **Cross-stream dependencies** — the graph of who consumes whom

Streams come from spec, not aspiration. If a stream is listed here, every stage in it has canonical prompt text and contract in `specs/features/` or `specs/globals/`.

---

## State Vocabulary

Every stream and every stage carries one of these states:

| State | Meaning |
|---|---|
| **working** | Spec complete, code/UI in place, exercisable end-to-end with live data or in a Live Sim |
| **dormant** | Spec complete, code/UI in place, but not yet active — waiting on a trigger, workspace activation, or upstream data |
| **spec-only** | Canonical spec exists; no implementation yet. Reads from spec but cannot run |
| **broken** | Was working; regression — needs fixing before depending on it |

State is **independent of version**. There is no V1/V2/V3 here. "Dormant" means built but not firing — flip a gate and it lights up.

---

## Workspace Tags

Several streams depend on workspaces being enabled for the organisation. Workspace tags surface that dependency:

| Tag | Workspace | What it provides |
|---|---|---|
| `core` | always-on core safety platform | Observation capture, incident capture, FW classification, talk delivery |
| `risk` | Risk workspace | Critical control register, control verification, control-failure attribution |
| `ms` | Management System workspace | Document ingestion, requirement extraction, applicable-document context injection |
| `analytics` | Analytics workspace | Trend surfacing UI, FW capacity profile dashboard, leading indicator views |
| `communities` | Communities workspace | CoP threading, peer learning surfaces |

A stream tagged `core + ms` means "this stream exists in the core platform but produces richer output when the MS workspace is enabled."

---

## Stream Catalogue

### 1 · observation-to-insight

**Path:** observation capture → enrichment → routing → critical insight generation → human review → FW classification

**Triggers:**
- Single critical observation (`barrier_failure` or `unwanted_energy_event` with confidence ≥ 0.70) → direct route
- Trend threshold crossed in observation pool → algorithm trigger (Worksite Trend or Cross-site Pattern variant)

**Consumes:** raw observation text (from supervisor capture)
**Produces:** approved Critical Insight + FW classification
**Spec authority:** `features/OBSERVATION-CAPTURE.md`, `features/CRITICAL-INSIGHT.md`, `globals/fw-classify-job.md`
**Workspace:** `core`
**Downstream consumers:** insight-to-broadcast, insight-to-pull, systemic-causes

| Stage | State |
|---|---|
| capture.observation | working |
| observation.enrich | working |
| trend detection | spec-only — algorithm in `SPEC.md §7.2`, no live trigger yet |
| critical_insight.generate (critical_observation trigger) | working |
| critical_insight.generate (solo_critical trigger) | dormant — needs incident-to-investigation to fire |
| critical_insight.generate (Worksite Trend trigger) | spec-only — needs trend detection live |
| critical_insight.generate (Cross-site Pattern trigger) | spec-only — needs trend detection live |
| human review gate | working |
| fw_classify (insight path) | working |

**Live Sim:** `simulators/observation-to-insight.html` ✓ working

---

### 2 · incident-to-investigation

**Path:** incident capture (or auto-triage routed to incident) → server triage algorithm → investigation assistance → human framework completion → investigation close → toolbox narrative + FW classification

**Triggers:** supervisor reports an incident; auto-triage commits to the incident route

**Consumes:** raw incident text (from supervisor capture)
**Produces:** closed investigation + toolbox narrative + FW classification + (for critical severity) trigger into observation-to-insight stream as solo_critical
**Spec authority:** `features/INCIDENT-CAPTURE.md`, `features/INVESTIGATION.md`
**Workspace:** `core` (+ `ms` for document context, + `risk` for control attribution)
**Downstream consumers:** insight-to-broadcast (via toolbox narrative), systemic-causes, observation-to-insight (solo_critical bridge)

| Stage | State |
|---|---|
| capture.incident | spec-only |
| capture.auto | spec-only |
| server triage algorithm | spec-only |
| investigation.assist | spec-only |
| investigator workbench (framework completion) | spec-only |
| investigation close gate | spec-only |
| investigation.generate_narrative | spec-only |
| fw_classify (investigation path) | spec-only — runs when invoked |

**Live Sim:** `simulators/incident-to-investigation.html` — to build

---

### 3 · insight-to-broadcast

**Path:** approved Critical Insight (or closed Investigation with toolbox narrative) → content selection algorithm → talk assembly → presenter review → delivery → atrophy update

**Triggers:** supervisor requests a toolbox talk for today's work type

**Consumes:** approved insights, closed investigations with `toolbox_narrative`, recent enriched observations
**Produces:** delivered toolbox talk, attendance record, atrophy score update
**Spec authority:** `features/TOOLBOX-TALK.md`
**Workspace:** `core`
**Downstream consumers:** none (terminal — broadcast to crew)

| Stage | State |
|---|---|
| content selection algorithm | spec-only |
| toolbox_talk.generate | spec-only |
| presenter review + edit | spec-only |
| delivery + attendance lock | spec-only |
| atrophy score update | spec-only |

**Live Sim:** `simulators/insight-to-broadcast.html` — to build

---

### 4 · insight-to-pull

**Path:** approved Critical Insight (or open Investigation flagging cross-site condition) → enquiry question generation → human review and dispatch → live response synthesis → final summary → recommended actions → FW classification

**Triggers:** safety manager approves an insight and chooses to launch an enquiry; investigator dispatches a mid-investigation cross-site enquiry; investigator names witnesses

**Consumes:** approved insight pattern + cause, or investigation contributing factors
**Produces:** enquiry responses synthesised into findings + actions + (optionally) toolbox narrative feeding broadcast
**Spec authority:** `features/ENQUIRY.md`
**Workspace:** `core`
**Downstream consumers:** insight-to-broadcast (via enquiry-derived toolbox narrative), systemic-causes

| Stage | State |
|---|---|
| enquiry.generate_questions (critical_insight trigger) | spec-only |
| enquiry.generate_questions (investigation_mid trigger) | dormant — needs investigation workbench |
| enquiry.generate_questions (investigation_witness trigger) | dormant — needs investigation workbench |
| human review and dispatch | spec-only |
| enquiry.synthesise (live, per response) | spec-only |
| enquiry.summarise (on close) | spec-only |
| fw_classify (enquiry path) | spec-only |

**Live Sim:** `simulators/insight-to-pull.html` — to build

---

### 5 · systemic-causes

**Path:** classified Insights + classified Investigations + classified Enquiries → FW factor aggregation → manager-layer outputs (situational brief, CoP thread, visit briefing)

**Triggers:** classified items reaching manager-level sharing scope; visit plan creation; atrophy alert; community-rooted discussion seeding

**Consumes:** any classified item with `fw_factors[]` populated
**Produces:** situational briefs (manager comms), CoP thread seeds (peer discussion), visit briefings (manager pre-visit packs)
**Spec authority:** `features/SITUATIONAL-BRIEF.md`, `features/COMMUNITIES.md`, `features/VISIT-BRIEFING.md`
**Workspace:** `core` (+ `communities` for CoP threading, + `analytics` for FW capacity profile views)
**Downstream consumers:** none (terminal — distributed to managers, communities, visit plans)

| Stage | State |
|---|---|
| situational_brief.generate | spec-only |
| safety manager brief approval | spec-only |
| brief distribution to sharing scope | spec-only |
| cop_thread.generate | dormant — needs `communities` workspace active |
| safety manager thread approval | dormant |
| CoP platform seeding | dormant |
| visit_briefing.generate | spec-only |
| visit consumption (pre-visit + active visit modes) | spec-only |

**Live Sim:** `simulators/systemic-causes.html` — to build

---

### 6 · management-system-ingestion

**Path:** document upload → ingestion job → requirement extraction → injection into downstream prompts as context

**Triggers:** safety manager uploads a document, or document version updated

**Consumes:** raw document text + document type + applicability metadata
**Produces:** `DocumentRequirement` records; context injection into observation enrichment, investigation assistance, talk assembly, insight generation, enquiry generation when `ms` workspace is active for the consuming stream
**Spec authority:** `features/MANAGEMENT-SYSTEM-INGESTION.md`
**Workspace:** `ms`
**Downstream consumers:** every other stream (as context, when `ms` is enabled)

| Stage | State |
|---|---|
| document upload | spec-only |
| document.ingest | working in Live Sim — production wiring spec-only |
| requirement serving (query-time context injection) | spec-only across all consumers — needs per-stream wiring |
| document review workflow (enquiry-based) | spec-only |

**Live Sim:** `simulators/management-system.html` — convert from current `ms-sim.html`

---

### 7 · fw-classify (cross-cutting)

**Note:** `fw_classify` is not its own stream — it runs as the terminal stage of observation-to-insight (insight path), incident-to-investigation (investigation path), and insight-to-pull (enquiry path). It is listed here because it is the only job receiving **Full** injection of the Blueprint, and because its output (the `fw_factors[]` arrays) is what makes systemic-causes possible.

**Spec authority:** `globals/fw-classify-job.md`
**Workspace:** `core`
**Used by:** observation-to-insight, incident-to-investigation, insight-to-pull
**Feeds:** systemic-causes

State: working when invoked by any of the three parent streams.

---

## Capability Gates

Capability gates are the activation mechanism. They control what fires without changing the spec. The defaults below reflect current state; flipping a gate changes behaviour without a deploy where possible.

| Gate | Default | Affects | What changes when enabled |
|---|---|---|---|
| `workspace.core` | on | every stream | baseline platform |
| `workspace.risk` | off | incident-to-investigation, systemic-causes | control-failure attribution; critical control linkage in investigation framework |
| `workspace.ms` | off | every stream | applicable `DocumentRequirement` records injected as context; observation enrichment gains procedure-gap detection; investigation gains procedure-specific contributing factor suggestions |
| `workspace.analytics` | off | systemic-causes | FW capacity profile dashboard; leading indicator surfaces |
| `workspace.communities` | off | systemic-causes | `cop_thread.generate` lights up; CoP platform seeding lights up |
| `fw_classify.multi_factor` | on | observation-to-insight, incident-to-investigation, insight-to-pull | up to 3 factors per classification vs single dominant factor |
| `insight.cross_site_pattern` | off | observation-to-insight | algorithm-trigger insights at region/division/organisation level produce the Cross-site Pattern variant; site-level remains Worksite Trend |
| `enquiry.factor_aware_question_types` | off | insight-to-pull | question types selected per classified factor (e.g. `management_systems` → Assurance + Gap; `work_understanding` → Work as Done + Comparative) |
| `talk.maturity_aware_framing` | off | insight-to-broadcast | talk register adapts to `fw_maturity_signals[]` (compliant/leading/resilient) |
| `endorsement.feedback_loop` | off | observation-to-insight, systemic-causes | peer endorsements feed `fw_classify` confidence weighting; high endorsement count triggers escalation recommendation |
| `observation.offline_fallback` | on | observation-to-insight | observation capture queues to local SQLite when offline; sync flushes on reconnect |
| `incident.offline_fallback` | partial | incident-to-investigation | static form fallback; full conversation history queuing dormant |

Gates are the unit of optimisation. Test a branch by flipping a gate; observe how the affected stream behaves; decide whether to flip the default.

---

## Cross-Stream Dependencies

The full graph as a table. Read as "row produces something the column consumes":

| ↓ produces / consumes → | obs-to-insight | inc-to-inv | insight-to-broadcast | insight-to-pull | systemic-causes |
|---|:-:|:-:|:-:|:-:|:-:|
| **obs-to-insight** | — | bridge: critical observation if also incident | ✓ approved insight feeds talk content selection | ✓ approved insight triggers enquiry | ✓ classified insight feeds factor aggregation |
| **inc-to-inv** | ✓ solo_critical bridges into insight gen | — | ✓ toolbox narrative feeds talk content selection | ✓ investigator dispatches cross-site enquiry | ✓ classified investigation feeds factor aggregation |
| **insight-to-broadcast** | — | — | — | — | — |
| **insight-to-pull** | — | — | ✓ enquiry toolbox narrative feeds talk content selection | — | ✓ classified enquiry feeds factor aggregation |
| **systemic-causes** | — | — | — | — | — |
| **management-system-ingestion** | ✓ procedure-gap context (when `ms` on) | ✓ procedure-specific context (when `ms` on) | ✓ requirement discussion prompts (when `ms` on) | ✓ requirement-gap question seeds (when `ms` on) | — |

Terminal streams (broadcast, systemic-causes) have no outbound consumers — they emit to the field or to managers.

The cross-stream bridges are the architecturally interesting points:
- **solo_critical bridge** — a critical incident produces an insight without waiting for a trend
- **investigation toolbox narrative bridge** — a closed investigation feeds the same talk-assembly pool as approved insights
- **enquiry toolbox narrative bridge** — a completed enquiry can produce its own talk content
- **MS workspace context bridges** — when active, requirement context flows into every classification and generation stage

---

## Live Sims

Live Sims are the empirical optimisation surface. One Live Sim per stream. Each one exercises a coherent end-to-end flow with live AI, prompts loaded from spec, references and capability gates surfaced.

The Live Sim contract is defined in `HOW-TO-READ-THIS.md §Live Sim Class`.

| Stream | Live Sim | State |
|---|---|---|
| observation-to-insight | `simulators/observation-to-insight.html` | working |
| incident-to-investigation | `simulators/incident-to-investigation.html` | to build |
| insight-to-broadcast | `simulators/insight-to-broadcast.html` | to build |
| insight-to-pull | `simulators/insight-to-pull.html` | to build |
| systemic-causes | `simulators/systemic-causes.html` | to build |
| management-system-ingestion | `simulators/management-system.html` | to build (convert from `ms-sim.html`) |

Retired wet sims (superseded by Live Sims):
- `simulators/capture-sim.html` — covered by observation-to-insight (capture stage)
- `simulators/capture-sim-offline.html` — offline fallback becomes a capability gate inside observation-to-insight
- `simulators/workflow-sim.html` — scripted; each scenario becomes a Live Sim
- `simulators/enquiry-sim.html` — scripted; superseded by insight-to-pull

---

## How To Use This File

**Reading the system.** Start here. Find the stream you're interested in. See its state. Follow the spec authority links for canonical prompt text. Follow the Live Sim link to exercise it.

**Optimising a branch.** Find the relevant capability gate. Flip it in the Live Sim. Compare outputs. Decide whether to flip the default.

**Adding a feature.** Identify which stream it belongs to. If it's a new stage, add it to the stream's stage list with state `spec-only`. If it's a cross-stream link, add it to the dependency graph. If it's a toggle, add it as a capability gate. Specify the canonical prompt/contract in the relevant `features/` file.

**Onboarding a developer.** This is the orientation document. Read it, then read `HOW-TO-READ-THIS.md` for documentation architecture, then read the spec file for whichever stream they're building.

---

*Update this file when: a stream's state changes; a new stage is added or retired; a capability gate is added or its default flips; a new Live Sim ships or an old one retires; a cross-stream dependency is created or broken. This file is the dashboard.*
