# WORKSPACES.md — Workspace Capability Layers

**Forge Works · Hiviz SafetyPlatform — Reference**
Version: 1.0 — May 2026

> **This is the canonical reference for Hiviz's workspace model.** It defines what each workspace is, what it delivers to users, what it activates in the platform, and how workspaces relate to each other. Code-level workspace IDs (e.g. `workspace.ms`) map to named capability layers. The names here are the user-facing framing — the code IDs do not change.

---

## What a Workspace Is

A workspace is a capability layer that an organisation activates. Workspaces are additive — each one extends the platform without replacing anything below it. An organisation can run on `core` alone indefinitely. Each additional workspace turns on more of the model.

Workspaces are **not product tiers in the pricing sense** — they are activation decisions. An organisation decides what they need; what they activate reflects their maturity and operational context.

---

## The Five Workspaces

### 1 · Insight Workspace (`workspace.core`)

**What it is:** The baseline intelligence pipeline. Every Hiviz organisation has this. It is the field-to-intelligence loop — capturing what is happening on site, generating pattern-level findings, routing them through human review, and broadcasting learning to crews.

**What it delivers:**
- Observation capture and AI enrichment (enriched near-miss, at-risk, barrier failure records)
- Incident capture, triage, and investigation (AI-assisted framework completion, toolbox narrative)
- Critical Insight generation and review (the platform's primary intelligence output)
- Toolbox talk assembly and delivery (intelligence broadcast to crews)
- Enquiry generation and synthesis (intelligence pulled from sites)
- FW Map® classification on all approved intelligence entities
- Offline observation fallback

**Who uses it:** Supervisors (capture), safety managers (review and approve), investigators (investigation workbench), all crew (toolbox talk recipients).

**Spec authority:** `features/OBSERVATION-CAPTURE.md`, `features/CRITICAL-INSIGHT.md`, `features/INCIDENT-CAPTURE.md`, `features/CRITICAL-INCIDENT.md`, `features/INVESTIGATION.md`, `features/TOOLBOX-TALK.md`, `features/ENQUIRY.md`, `globals/fw-classify-job.md`

**Code ID:** `workspace.core`

---

### 2 · Management System Workspace (`workspace.ms`)

**What it is:** The organisation's safety management system documents — procedures, standards, safe work method statements, legislative requirements — brought live into the AI layer. When active, every AI job that processes a field event can ask: "Is there a procedure, standard, or requirement that applies here?"

**What it delivers:**
- Document ingestion and requirement extraction (procedures, SWMSs, standards uploaded once, queried continuously)
- Procedure-gap detection in observation enrichment (AI flags when observed practice diverges from documented procedure)
- Procedure-specific contributing factor suggestions in investigation assistance
- Applicable document context in insight generation and enquiry question generation
- Document review workflow — an enquiry can be triggered to ask whether a document reflects current work as actually done

**Who uses it:** Safety managers (document management), all AI jobs (context injection at query time).

**The key difference it makes:** Without the MS workspace, AI operates on field signals alone — what people observe and report. With it, AI can see the gap between what the organisation says should happen and what is actually happening. That gap is often where systemic causes live.

**Spec authority:** `features/MANAGEMENT-SYSTEM-INGESTION.md`

**Code ID:** `workspace.ms`

---

### 3 · Risk Workspace (`workspace.risk`)

**What it is:** The organisation's critical control register — the specific controls that prevent catastrophic energy releases for each work type. When active, the platform can attribute whether a control was present, degraded, or absent in every incident and near-miss, and track control verification in the field.

**What it delivers:**
- Critical control register (per work type, per energy type — the controls that matter most)
- Control failure attribution in incident triage and investigation (was the relevant control in place?)
- Control verification capture (supervisors can verify critical controls are in place before work starts)
- Control-failure signal in FW classification (a confirmed control failure is strong evidence for specific FW factors)

**Who uses it:** Safety managers (control register maintenance), supervisors (control verification), investigators (attribution).

**The key difference it makes:** Without the Risk workspace, the platform knows *that* incidents happen and can classify *why* at an organisational level. With it, it knows *which specific control failed* — the most actionable level of systemic understanding for high-energy work environments.

**Spec authority:** `features/RISK-CONTROLS.md`

**Code ID:** `workspace.risk`

---

### 4 · Systemic Map Workspace (`workspace.analytics`)

**What it is:** The aggregate intelligence layer. Where the Insight workspace produces individual intelligence events (insights, investigations, enquiries), the Systemic Map workspace surfaces the pattern across all of them — what the organisation's FW Map® capacity looks like over time, where the gaps are, and where the platform has no data at all.

**What it delivers:**
- FW capacity profile — the aggregated picture of which organisational capacity factors have evidence of gaps, at which maturity level, with what confidence
- Blueprint blind spots — FW factors with no classified evidence at this org level (unmeasured, not necessarily absent)
- Systemic-causes outputs: situational briefs, visit briefings, CoP thread seeds triggered by profile threshold crossings
- Visit planning with intelligence-driven site prioritisation (atrophy score, open insights, blind spots, recent incidents)
- Atrophy score per worksite — composite measure of how stale the intelligence loop has become

**Who uses it:** Safety managers (systemic picture, brief review), divisional managers and leadership (situational briefs), managers planning site visits.

**The key difference it makes:** Without the Systemic Map workspace, the platform surfaces individual findings. With it, the platform tells you what kind of organisation you are — where your management system is strong and where it is structurally weak, based on evidence from your own field.

**Spec authority:** `features/SYSTEMIC-CAUSES.md`, `features/SITUATIONAL-BRIEF.md`, `features/VISIT-BRIEFING.md`

**Code ID:** `workspace.analytics`

---

### 5 · Communities Workspace (`workspace.communities`)

**What it is:** The peer learning layer. Where the Insight workspace broadcasts from the intelligence pipeline to crews, the Communities workspace creates a conversation — supervisors and safety professionals sharing experience across sites in the same context where they log observations, review insights, and plan visits.

**What it delivers:**
- CoP thread generation — when an insight is approved or investigation closes, AI generates a discussion thread seeded to the relevant community (safety manager approves before it appears)
- Community rooms by work type and practice area (not just org units)
- Practitioner-initiated discussions surfaced to safety managers as potential intelligence signals
- Community engagement signals feeding FW Map® `communications_coordination` factor over time
- Document atrophy discussions — when a procedure hasn't been updated but the work around it has changed, AI seeds a discussion: "Is this procedure still accurate?"

**Who uses it:** Supervisors and safety professionals (community participants), safety managers (thread approval and moderation).

**The key difference it makes:** The intelligence pipeline produces learning content. Communities determine whether that learning actually changes how people think about their work. Engagement patterns are themselves a signal about the organisation's learning capacity.

**Spec authority:** `features/COMMUNITIES.md`

**Code ID:** `workspace.communities`

---

## Workspace Dependency Map

```
workspace.core  (always on — the baseline)
    │
    ├── workspace.ms          (adds: document context into every AI job)
    │
    ├── workspace.risk        (adds: control attribution into incident pipeline)
    │
    ├── workspace.analytics   (adds: aggregated FW profile, visit planning, atrophy)
    │       │
    │       └── workspace.communities   (adds: CoP threading, peer learning)
    │           (communities is most meaningful when analytics is also active —
    │            the thread seeds are richer when the FW profile is available)
```

Communities technically activates independently of analytics, but the combination is where the full value is: the systemic picture drives the community discussions, and the community discussions feed signal back into the systemic picture.

---

## What Is Not a Workspace

The following are **capability gates** — toggles within a workspace that can be switched on or off without a workspace decision:

| Gate | What it controls |
|---|---|
| `fw_classify.multi_factor` | Up to 3 FW factors per classification vs single dominant factor |
| `insight.cross_site_pattern` | Cross-site pattern variant for algorithm-triggered insights |
| `enquiry.factor_aware_question_types` | Question types selected per FW factor classification |
| `talk.maturity_aware_framing` | Talk register adapts to maturity level of classified factors |
| `endorsement.feedback_loop` | Peer endorsements feed FW classification confidence weighting |
| `observation.offline_fallback` | Observation capture queues locally when offline |

These are not workspace decisions — they are configuration decisions within an active workspace. They are documented in `MODEL-MAP.md §Capability Gates`.

---

## V2 Notes

**Workspace onboarding flow**
Each workspace activation should have a guided onboarding step: for `ms`, uploading initial documents; for `risk`, seeding the critical control register; for `communities`, creating initial CoP rooms. Not specced — V2 product design scope.

---

*Last updated: May 2026. Update this file when: a workspace is added or renamed; the user-facing framing of a workspace changes; a new capability gate is added; a workspace's spec authority changes. This file is the navigation document — the feature specs are the detail.*
