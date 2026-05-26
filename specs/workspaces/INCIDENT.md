# INCIDENT.md — Incident Workspace Spec

**Code ID:** `workspace.incident`
**Status:** Activation decision
**Version:** 1.0 — May 2026

> The formal incident pipeline — from first report through investigation close, regulatory compliance, and the optional systemic cause bridge back into the insight loop. Isolates the complexity of incident reporting, regulatory obligations, and formal investigation from the observation/insight learning cycle.

---

## Standalone value

An organisation activating the Incident workspace gets a structured, AI-assisted incident pipeline that does what spreadsheets and paper forms cannot: guides supervisors through capture in conversational language, triages automatically, generates investigation frameworks, and produces a formal closed record with root cause and corrective actions — with a full audit trail.

Critically, the regulatory complexity lives here and not in the Insight workspace. Notifiable incident thresholds, external reporting timelines, TRIFR methodology, legally defensible investigation records — this is where that machinery runs.

**How it could be sold alongside Insight:** "The observation/insight loop is your learning system. The incident workspace is your compliance system. Run them separately or together — but when they're together, the platform knows when an investigation has produced findings that need to be broadcast as learning, and routes them automatically."

**Dependency:** Requires `workspace.core` (Insight) to be active. The Incident workspace extends the platform; it does not replace it.

---

## What activating this workspace turns on

- Incident capture — conversational AI report with auto-triage entry point
- Server triage algorithm — classifies severity, routes to direct path or pool
- CriticalIncident entity — the intelligence gate between triage and investigation; AI draft requiring human review
- CriticalIncident generation — two trigger paths: direct (critical severity) and algorithm (pool threshold)
- CriticalIncident human review gate — safety manager approves before investigation opens
- Investigation assistance (`investigation.assist`) — AI-generated contributing factors, root cause, corrective actions, interview questions
- Investigation workbench — investigator completes framework, confirms or adds factors, assigns corrective actions
- Investigation close gate — mandatory fields before close; at least one corrective action required
- Investigation narrative (`investigation.generate_narrative`) — AI-generated toolbox narrative from closed investigation
- FW Map® classification — investigation path (`fw_classify`)
- Systemic cause phase (optional) — human-initiated bridge to insight pipeline via `external_investigation` trigger; creates a CriticalInsight from confirmed root cause
- Corrective actions from investigation — tracked through `features/CORRECTIVE-ACTIONS.md`
- Regulatory reporting layer — notifiable flag confirmation, TRIFR contribution, external report record (partially specced — see V2 notes)

---

## Feature inventory

| Feature | User role(s) | Spec authority | State |
|---|---|---|---|
| Incident capture conversation (`capture.incident`) | Supervisor | `features/INCIDENT-CAPTURE.md` Stage 1 | working |
| Auto-triage entry point (`capture.auto`) | Supervisor | `features/INCIDENT-CAPTURE.md` Stage 0 | spec-only |
| Server triage algorithm | System (sync) | `features/INCIDENT-CAPTURE.md` Stage 2, `SPEC.md §7.1` | working |
| CriticalIncident generation — direct path (`critical_incident.generate`) | System (async) | `features/CRITICAL-INCIDENT.md` Stage 1 | spec-only |
| CriticalIncident generation — algorithm trigger | System (async) | `features/CRITICAL-INCIDENT.md` Stage 1 | spec-only |
| CriticalIncident human review gate | Safety manager | `features/CRITICAL-INCIDENT.md` §Review | spec-only |
| Investigation assistance (`investigation.assist`) | System (async) | `features/INVESTIGATION.md` Stage 1, `features/INCIDENT-CAPTURE.md` Stage 3 | working |
| Investigation workbench — framework completion | Investigator | `features/INVESTIGATION.md` Stage 2 | working (sim only) |
| Investigation close gate | Investigator / safety manager | `features/INVESTIGATION.md` Stage 2 | working (sim only) |
| Investigation narrative (`investigation.generate_narrative`) | System (async) | `features/INVESTIGATION.md` Stage 4 | working |
| FW classification — investigation path (`fw_classify`) | System (async) | `globals/fw-classify-job.md` | working |
| Systemic cause phase (optional bridge) | Investigator / safety manager | `features/INVESTIGATION.md` Stage 3 | spec-only |
| Corrective actions from investigation close | Investigator | `features/CORRECTIVE-ACTIONS.md` §3.2 | spec-only |
| Notifiable flag confirmation | Safety manager | `features/INCIDENT-CAPTURE.md` §V2 | spec-only |
| Regulatory reporting record | Safety manager / compliance | not yet specced — V2 | not specced |
| TRIFR contribution | System | not yet specced — V2 | not specced |

---

## UX surfaces

| View | Role(s) | Access path | Purpose | Design state |
|---|---|---|---|---|
| Incident capture | Supervisor | "Report incident" tap | Conversational AI capture; auto-triage decision visible at end | simulator: `simulators/incident-to-investigation.html` |
| Incident feed | Safety manager | Incidents tab → list | All incident records by site / severity / date; open investigations flagged | to design |
| CriticalIncident review | Safety manager | Notifications / incident feed | Read AI draft; approve (opens investigation) or reject with reason | to design |
| Investigation workbench | Investigator | From approved CriticalIncident | Framework completion: contributing factors, root cause, corrective actions, interview questions | to design (simulator covers flow) |
| Systemic cause phase | Investigator / safety manager | From closed investigation | Confirm systemic implications; bridge to insight pipeline | to design |
| Investigation close gate | Investigator | From workbench | Confirm mandatory fields are complete; close triggers narrative generation | simulator covers this step |
| Closed investigation detail | Safety manager | Investigation list | Full record: framework, root cause, actions, toolbox narrative, FW classification | to design |
| Regulatory reporting | Safety manager / compliance | Incident detail → report | Notifiable confirmation, regulator notification log, external report record | to design (V2) |

---

## Capability gates

| Gate | Default | What it controls |
|---|---|---|
| `incident.offline_fallback` | partial | Static form fallback when offline; full conversation queuing dormant |

---

## Workspace connections

**Built on:** `workspace.core` (Insight) — required.

**Enriched by:**
- `workspace.ms` — investigation assistance gains procedure-specific contributing factor suggestions; applicable document context at incident date is retrievable
- `workspace.risk` — investigation gains control attribution step; confirmed control failures are high-confidence FW signals

**Produces for downstream:**
- Closed investigation + FW classification → `workspace.analytics` (FW factor aggregation, higher evidence weight than insights)
- Investigation toolbox narrative → `workspace.core` insight-to-broadcast pool
- Corrective actions from investigation → atrophy score signal
- CriticalInsight via systemic cause bridge → `workspace.core` insight pipeline

---

## V2 Notes

**Regulatory reporting layer** — notifiable incident workflow, TRIFR methodology, external report format, regulator notification timeline. Referenced in WORKSPACES.md but not specced. Jurisdiction-specific. This is the most significant unspecced area in the Incident workspace.

**Incident pool algorithm** — the moderate/minor incident pool threshold detection (algorithm trigger for CriticalIncident) is spec-only. The direct path (critical severity → CriticalIncident immediately) is specced but not live.

**CriticalIncident human review gate** — the sim proceeds directly to investigation without the review gate. V2: gate is live, safety manager approves before investigation opens.

*Wireframes exist for: incident capture and investigation flow (simulator). All other views are to design.*
