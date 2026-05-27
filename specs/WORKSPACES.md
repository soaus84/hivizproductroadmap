# WORKSPACES.md — Workspace Capability Layers

**Forge Works · Hiviz SafetyPlatform — Reference**
Version: 2.1 — May 2026

> **Navigation document.** Defines the workspace model and maps the six workspaces to their spec files. Capability detail — what each workspace delivers, who uses it, feature inventory, UX surfaces — lives in the individual workspace docs listed below.

---

## What a Workspace Is

A workspace is a capability layer that an organisation activates. Workspaces are additive — each one extends the platform without replacing anything below it.

Workspaces are **not product tiers in the pricing sense** — they are activation decisions. An organisation decides what they need; what they activate reflects their maturity and operational context.

**`workspace.core` is always on.** Every other workspace is an activation decision. An organisation can run indefinitely on core alone. Each additional workspace compounds the intelligence value of those already active.

---

## The Six Workspaces

| # | Name | Code ID | One line | Spec doc |
|---|---|---|---|---|
| 1 | Insight Workspace | `workspace.core` | Always-on field intelligence loop — observation capture through to toolbox talk and corrective action. | `workspaces/INSIGHT.md` |
| 2 | Incident Workspace | `workspace.incident` | Formal incident pipeline — AI-assisted capture, investigation, regulatory compliance, and the systemic cause bridge back into the insight loop. | `workspaces/INCIDENT.md` |
| 3 | Management System Workspace | `workspace.ms` | Safety documents brought live into the AI layer — procedures, SWMSs, and standards injected as context into every AI job across every active workspace. | `workspaces/MANAGEMENT-SYSTEM.md` |
| 4 | Risk Workspace | `workspace.risk` | Critical control register — specific controls verified in the field, attributed in investigations, and tracked for health across every site. | `workspaces/RISK.md` |
| 5 | Systemic Map Workspace | `workspace.analytics` | Aggregate intelligence layer — FW capacity profile, worksite atrophy scoring, and intelligence decoration consumed by visit planning, briefings, and alerts. | `workspaces/SYSTEMIC-MAP.md` |
| 6 | Communities Workspace | `workspace.communities` | Peer learning layer — intelligence pipeline events seed discussion threads to practice communities; engagement signals feed the FW capacity profile. | `workspaces/COMMUNITIES.md` |

---

## Workspace Dependency Map

```
workspace.core  (always on — the Insight loop)
    │
    ├── workspace.incident    (adds: formal incident pipeline, investigation, regulatory reporting)
    │       │
    │       └── workspace.risk   (adds: control attribution into incident investigation)
    │           (risk is most valuable when incident is also active — the control
    │            attribution layer needs investigation records to attribute against)
    │
    ├── workspace.ms          (adds: document context into every AI job across all streams)
    │
    ├── workspace.analytics   (adds: aggregated FW profile, worksite decoration, atrophy)
    │       │
    │       └── workspace.communities   (adds: CoP threading, peer learning)
    │           (communities is most meaningful when analytics is also active —
    │            thread seeds are richer when the FW capacity profile is available)
```

**Reading the map:**
- `workspace.risk` activates independently of `workspace.incident` — control verification runs with core alone. Its highest-value capability (investigation control attribution) requires incident to also be active.
- `workspace.ms` is a horizontal layer — it enriches every stream across every active workspace.
- `workspace.analytics` is the aggregation point — more workspaces active means more evidence types feeding the FW capacity profile and richer worksite decoration.

The combination that gives the most complete intelligence picture: `core + incident + ms + risk + analytics`. Every event is captured, every procedure is known, every control is tracked, and the aggregate is visible.

---

## What Is Not a Workspace

The following are **capability gates** — configuration decisions within an active workspace, not activation decisions.

| Gate | What it controls |
|---|---|
| `fw_classify.multi_factor` | Up to 3 FW factors per classification vs single dominant factor |
| `insight.cross_site_pattern` | Cross-site pattern variant for algorithm-triggered insights |
| `enquiry.factor_aware_question_types` | Question types selected per FW factor classification |
| `talk.maturity_aware_framing` | Talk register adapts to maturity level of classified factors |
| `endorsement.feedback_loop` | Peer endorsements feed FW classification confidence weighting |
| `observation.offline_fallback` | Observation capture queues locally when offline |

Documented fully in `MODEL-MAP.md §Capability Gates`.

---

## V2 Notes

**Workspace onboarding flow** — each workspace activation should have a guided onboarding step: for `ms`, uploading initial documents; for `risk`, seeding the critical control register; for `communities`, creating initial CoP rooms. Not specced — V2 product design scope.

---

*Update this file when: a workspace is added or renamed; a workspace's spec doc path changes; the dependency map changes; a capability gate is added or removed. Capability detail belongs in the individual workspace docs — not here.*
