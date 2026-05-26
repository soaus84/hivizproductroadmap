# RISK.md — Risk Workspace Spec

**Code ID:** `workspace.risk`
**Status:** Activation decision
**Version:** 1.0 — May 2026

> The critical control register — what specific measures prevent catastrophic energy events for each work type — brought live and verifiable. Supervisors check controls before work starts. Safety managers see control health across every site in real time. Investigators know which controls were in place at the time of an incident.

---

## Standalone value

The Risk workspace has a distinct sellable product inside it that requires nothing else from the platform: **verification checklists**.

An organisation activates the Risk workspace, seeds their critical control register (work types → hazards → controls), and immediately supervisors have a checklist to complete before high-risk work starts. A fire watch isn't present? Alert fires to the manager in seconds. Work holds. The manager tracks resolution. The register shows control health across every site on a single screen.

This is a complete, self-contained safety assurance loop — independent of the observation pipeline, independent of investigation. You don't need AI enrichment or insight generation to get value from it. The value is: the right control is either in place or it isn't, someone is checking, and the organisation knows.

**The compound value with `workspace.incident`:** When an incident occurs and an investigation opens, the platform can show which controls were verified at that site on the day. The investigator attributes which controls were present, absent, or degraded. Those attributions feed FW Map® classification with higher confidence than general observations. Without the Incident workspace, the attribution step doesn't exist — verification history still has value, but the investigation link is missing.

**Dependency:** Requires `workspace.core` (Insight). Works independently of `workspace.incident` for verification; fullest investigation attribution value requires it.

---

## What activating this workspace turns on

- Critical control register — global register of controls per work type per hazard (bowtie structure)
- Push/accept model — controls authored globally, pushed to worksites for acceptance, site-level modification (stricter only)
- Control lifecycle — implementing → active → active_defeating → active_degraded → not_required → superseded
- Defeating factors — time-limited conditions eroding control effectiveness; clockwork alerts before expiry (V2)
- Verification clockwork — scheduled checks by assigned verifier; frequencies: shift start, daily, before ignition, event-triggered
- Supervisor verification checklist — in-app checklist of controls due for this work type; one tap per passing check
- Control not-in-place routing — immediate alert to responsible manager; SLA escalation to intelligence pipeline on breach
- Cross-site control health — safety manager view of verification status across all sites per control
- Corrective actions from control gaps — manager creates action from not-in-place alert; tracked through corrective actions (`features/CORRECTIVE-ACTIONS.md` §3.4)
- Control failure attribution in investigations — active when `workspace.incident` also on
- FW classification signal from control failures — confirmed absences as high-confidence FW factor evidence

---

## Feature inventory

| Feature | User role(s) | Spec authority | State |
|---|---|---|---|
| Work type register — author and manage | Safety manager | `features/RISK-CONTROLS.md` §3.1 | spec-only |
| Hazard definition (bowtie centre) | Safety manager | `features/RISK-CONTROLS.md` §2.1 | spec-only |
| Prevention / mitigation control authoring | Safety manager | `features/RISK-CONTROLS.md` §3.1 | spec-only |
| Push to worksites | Safety manager | `features/RISK-CONTROLS.md` §4 | spec-only |
| Site acceptance — review pending controls | Worksite manager | `features/RISK-CONTROLS.md` §4.1 | spec-only |
| Site acceptance — accept / modify / reject | Worksite manager | `features/RISK-CONTROLS.md` §4.1 | spec-only |
| Verifier assignment per control per site | Worksite manager | `features/RISK-CONTROLS.md` §6.2 | spec-only |
| Supervisor verification checklist | Supervisor / verifier | `features/RISK-CONTROLS.md` §9 | spec-only |
| Control not-in-place — SLA routing and escalation | System / manager | `features/RISK-CONTROLS.md` §6.4 | spec-only |
| Corrective action from control gap | Worksite manager / safety manager | `features/CORRECTIVE-ACTIONS.md` §3.4 | spec-only |
| Cross-site control health dashboard | Safety manager | `features/RISK-CONTROLS.md` §7 | spec-only |
| Defeating factor tracking (V2) | System / safety manager | `features/RISK-CONTROLS.md` §3.4, §5 | spec-only (V2 clockwork) |
| Investigation control attribution | Investigator | `features/RISK-CONTROLS.md` §8 | spec-only |
| FW classification — control failure signal | System (async) | `features/RISK-CONTROLS.md` §8.3 | spec-only |

---

## UX surfaces

| View | Role(s) | Access path | Purpose | Design state |
|---|---|---|---|---|
| Work type register | Safety manager | Risk tab → register | List of active work types with control health bars and not-in-place alerts | wireframe: `wireframes/control-register.html` (mobile), `wireframes/control-register-desktop.html` |
| Bowtie view | Safety manager / worksite manager | Tap work type | Hazard at centre; prevention controls left, mitigation controls right; status per control | wireframe: both control-register files |
| Control detail | Safety manager | Tap control in bowtie | Lifecycle, verification prompt, defeating factor warning, site distribution table | wireframe: both control-register files |
| Site acceptance — pending controls | Worksite manager | Notifications / site controls tab | Review controls pushed from global register; accept, modify, or mark not required | wireframe: both control-register files |
| Verifier assignment | Worksite manager | From site controls view | Assign named verifier per active control; set fallback | to design |
| Supervisor verification checklist | Supervisor / verifier | Verify tab or notification | Controls due now for active work type; one-tap pass; notes on failure; work hold prompt on not-in-place | to design — referenced in `features/RISK-CONTROLS.md` §9 |
| Cross-site alert | Safety manager | Alert from register / notification | Specific control: which sites not in place / not verified; stat summary; insight panel; push reminder | wireframe: both control-register files |
| Investigation control attribution | Investigator | From investigation workbench | List active controls at time of incident; confirm present / absent / degraded per control | to design (part of investigation workbench) |

---

## Capability gates

No standalone gates. `workspace.risk` is itself a gate in the MODEL-MAP capability table.

The defeating factor clockwork — while part of the data schema — is treated as V2 functionality until the schedule execution layer is built.

---

## Workspace connections

**Built on:** `workspace.core` (Insight) — required.

**Most valuable with:** `workspace.incident` — investigation control attribution only exists when incident workspace is active.

**Also enriched by:** `workspace.ms` — controls can be linked to specific procedure requirement clauses; verification prompts can be derived from documented requirements.

**Produces for downstream:**
- SLA-breach barrier_failure observations → `workspace.core` observation pool (intelligence escalation)
- Overdue verification signals → atrophy score (worksite health)
- Confirmed control failures + FW signals → `workspace.analytics` (when incident also active)
- Controls not in place + defeating factors at target site → visit briefing pack (`workspace.analytics`)

---

## V2 Notes

**Defeating factor clockwork** — schema defined; alert execution (scheduled transition from `active` → `active_defeating` → `active_degraded`) is V2.

**Verification schedule auto-generation** — MVP: push notification at configured time. V2: auto-generated from shift schedule; `scheduled_for` vs `verified_at` lateness detection live.

**Control version history** — point-in-time queries (which version was active at incident date) is V2.

**Risk workspace seeding / onboarding** — import existing register via CSV or manual entry. Not specced.

*Wireframes exist for: work type register, bowtie view, control detail, site acceptance, cross-site alert. Supervisor verification checklist and investigation attribution are to design.*
