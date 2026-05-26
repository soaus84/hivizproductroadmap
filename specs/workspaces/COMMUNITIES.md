# COMMUNITIES.md — Communities Workspace Spec

**Code ID:** `workspace.communities`
**Status:** Activation decision
**Version:** 1.0 — May 2026

> The peer learning layer. Where the Insight workspace broadcasts intelligence to crews, Communities creates a conversation — supervisors and safety professionals sharing experience across sites, in the same platform where they log observations and review insights.

---

## Standalone value

The intelligence pipeline produces learning content. Communities determines whether that learning actually changes how people think about their work.

When a Critical Insight is approved or an investigation closes, the platform generates a discussion thread — reframed not as an announcement but as the best possible prompt for practitioner conversation. A safety manager approves it before it appears. The thread lands in the right community room, attributed to the source, with an opening question that invites genuine field experience rather than compliance confirmation.

The defining constraint: AI doesn't summarise and ask for comment. It writes the opening question as the deliverable — specific, open, worth answering. The thread has to feel like something a 15-year experienced supervisor would want to respond to. If it doesn't, the safety manager edits it before it goes out.

**The compound effect with `workspace.analytics`:** Without the Systemic Map, thread seeds are generated from individual events. With it, the thread can be contextualised against the organisation's known capacity profile — seeded with the awareness that this is a recurring pattern, not a one-off event. Communities is most meaningful when the analytics layer is also active.

**Document atrophy discussions:** When `workspace.ms` is active, a second source of thread seeds appears — procedures that haven't been updated but where field signals suggest practice has drifted. The thread question becomes: "Is this procedure still accurate?" Practitioners who do the work answer. That answer is a review signal.

**Community engagement as a signal:** Engagement patterns across community rooms (response rates, reaction counts, discussion depth) are a long-run signal about the organisation's learning capacity — specifically the FW `communications_coordination` factor. This is measured but not acted on in MVP; V2 closes the loop.

---

## What activating this workspace turns on

- CoP thread generation — when a Critical Insight is approved or investigation closes (with `cleared_for_sharing = true`), AI generates a draft discussion thread: title, body, opening question
- Safety manager review gate — thread content and room targeting reviewed and approved before seeding; editable
- Community room seeding — approved thread pushed to the selected community room(s) via CoP platform integration
- Four community classes: Organisational (all org members), Practice (by role/discipline), Work type (automatic by work type at site), Working group (invite-only, time-bounded)
- Document atrophy thread seeding — when `workspace.ms` also active, stale procedure signals trigger discussion threads asking if the procedure reflects current practice
- Community engagement signals — response and reaction counts recorded against thread seeds; feed `communications_coordination` FW factor over time (measurement only in MVP)
- Reciprocal signal path — high-engagement discussions can be flagged to safety manager as potential insight candidates (V2)

---

## Feature inventory

| Feature | User role(s) | Spec authority | State |
|---|---|---|---|
| CoP thread generation (`cop_thread.generate`) — insight source | System (async) | `features/COMMUNITIES.md` Stage 1 | spec-only |
| CoP thread generation (`cop_thread.generate`) — investigation source | System (async) | `features/COMMUNITIES.md` Stage 1 | spec-only |
| Thread framing quality test | System (sync) | `features/COMMUNITIES.md` §Framing Quality Test | spec-only |
| Safety manager thread review gate | Safety manager | `features/COMMUNITIES.md` Stage 2 | spec-only |
| Room targeting — safety manager selects room(s) | Safety manager | `features/COMMUNITIES.md` Stage 2 | spec-only |
| CoP platform seeding | System (on approve) | `features/COMMUNITIES.md` Stage 3 | spec-only |
| Community room management | Safety manager | `features/COMMUNITIES.md` §Community Classes | spec-only |
| Document atrophy thread seeding (when `workspace.ms` active) | System (async) | `features/COMMUNITIES.md` + `features/MANAGEMENT-SYSTEM-INGESTION.md` | spec-only |
| Engagement signal recording | System | `features/COMMUNITIES.md` §V2 | spec-only |
| Working group creation and management | Safety manager | `features/COMMUNITIES.md` §Community Classes | spec-only (V2 architecture) |

---

## UX surfaces

| View | Role(s) | Purpose | Design state |
|---|---|---|---|
| Thread review queue | Safety manager | Pending thread seeds awaiting approval; edit content, select rooms, approve or cancel | to design |
| Community room index | All platform users | Available rooms by class; join/leave; recent activity | to design |
| Thread view | All platform users | Discussion thread, responses, reactions; attribution header | to design |
| Room management | Safety manager | Create rooms, manage classes, configure org-level CoP platform integration | to design |

---

## Capability gates

| Gate | Default | What it controls |
|---|---|---|
| `workspace.communities` | off | This workspace — `cop_thread.generate` lights up; CoP platform seeding lights up |

---

## Workspace connections

**Built on:** `workspace.core` (Insight) — required. Thread seeds originate from the insight pipeline.

**Most valuable with:** `workspace.analytics` — thread seeds are contextualised against the FW capacity profile; thread generation knows whether this is a one-off signal or a recurring pattern.

**Also enriched by:** `workspace.ms` — document atrophy signals generate a second category of thread seeds (procedure currency discussions).

**Receives from:**
- `workspace.core` — approved Critical Insights trigger `cop_thread.generate`
- `workspace.incident` — closed investigations with `cleared_for_sharing = true` trigger `cop_thread.generate`
- `workspace.ms` — document atrophy signals trigger document-review thread seeds

**Produces for downstream:**
- Community engagement signals → `communications_coordination` FW factor evidence (measurement; V2 for acting on it)
- High-engagement threads → flagged as potential insight candidates for safety manager (V2)

---

## V2 Notes

**Reciprocal intelligence loop** — when a thread reaches a configurable engagement threshold (responses + reactions), the platform flags it to the safety manager as a potential insight source. This closes the loop: community discussion becomes intelligence input. The flagging logic and conversion prompt are V2 additions to `features/COMMUNITIES.md`.

**Working group outputs** — working groups produce documents, recommendations, and decisions. When a working group closes, its output can seed a discussion thread to a broader community. V2 architecture.

**Engagement-weighted FW signals** — MVP records engagement counts. V2: threshold-crossing engagement events contribute weighted scores to the `communications_coordination` FW factor in the capacity profile, making community health a leading indicator.

**Poll crossover** — polls were deferred from V7 to a future crossover with the enquiry model. When implemented, a poll thread type is added here.

**CoP platform agnosticism** — MVP: single integration adapter (org-configured). V2: multi-platform support; adapter registry; org-level platform selection.

*No wireframes. All views are to design.*
