# SYSTEMIC-MAP.md — Systemic Map Workspace Spec

**Code ID:** `workspace.analytics`
**Status:** Activation decision
**Version:** 1.0 — May 2026

> The aggregate intelligence layer. Where the Insight workspace produces individual intelligence events, the Systemic Map workspace surfaces the pattern across all of them — what the organisation's FW Map® capacity looks like over time, where the gaps are, and where the platform has no data at all.

---

## Standalone value

The Insight workspace tells you what happened. The Systemic Map workspace tells you what kind of organisation you are.

Every classified insight, investigation, and enquiry contains evidence of an organisational capacity factor — a specific dimension of how safety management works (or doesn't) at this organisation. Individually, these are signals. The Systemic Map aggregates them across time and organisational scope into a profile: this organisation has a systemic gap in `operational_management` showing up across multiple work types and sites; this other factor has zero classified evidence — not because it's healthy, but because nobody has ever looked.

That picture drives three things:
1. **Situational briefs** to managers and divisional leadership — what the pattern shows and why it matters
2. **Visit planning** — which sites need a manager visit most urgently, with an intelligence-driven briefing before they arrive
3. **Atrophy scoring** — a per-worksite measure of how stale the safety intelligence loop has become, with alerts when a site goes dark

**Why it needs workspace.core first:** The Systemic Map has nothing to aggregate until the intelligence pipeline is running. Without classified insights, enquiries, or investigations, the FW capacity profile is empty. The value scales with the volume and breadth of the upstream pipeline — the more workspaces active, the richer the systemic picture.

**The compound effect:** When `workspace.incident` is also active, investigations contribute with 3× the weight of insights (confirmed root cause vs detected pattern). When `workspace.risk` is active, control failure signals add high-confidence evidence. When `workspace.ms` is active, document coverage and atrophy appear as a layer. The Systemic Map is the aggregation point — more feeds in, sharper the picture.

---

## What activating this workspace turns on

- FW capacity profile — per-org-level, per-time-window aggregation of all classified entities into a factor-by-factor picture of organisational capacity; blind spots surfaced where no evidence has been gathered
- Atrophy score per worksite — composite of observation recency, toolbox talk recency, manager visit recency, and overdue corrective actions; alerts at threshold ≥ 60
- Situational briefs — AI-generated narrative summaries of the systemic picture for managers and divisional leadership; human review gate before distribution
- Visit planning — manager declares a visit intent; site prioritisation driven by atrophy, open insights, blind spots, and incident recency; 2–5 focus areas selected
- Visit briefing pack — generated 48h before visit; focus areas become observation prompts during execution; observations captured on-visit enter normal enrichment pipeline
- Visit summary generation — AI summary of completed visit: what was found, which focus areas were covered, what needs follow-up
- Leading indicator surfaces — FW factor trends visible before they become incidents; blind spot alerts when a factor has no recent evidence

---

## Feature inventory

| Feature | User role(s) | Spec authority | State |
|---|---|---|---|
| FW capacity profile computation | System (on demand) | `features/SYSTEMIC-CAUSES.md` §FW Factor Aggregation | spec-only |
| Blind spot detection | System | `features/SYSTEMIC-CAUSES.md` §Profile Thresholds | spec-only |
| Atrophy score calculation | System (scheduled) | `features/SYSTEMIC-CAUSES.md` §Atrophy Score | spec-only |
| Atrophy alert — threshold crossing | System | `features/SYSTEMIC-CAUSES.md` §Atrophy Score | spec-only |
| Situational brief generation (`situational_brief.generate`) | System (async) | `features/SITUATIONAL-BRIEF.md` | spec-only |
| Situational brief human review gate | Safety manager | `features/SITUATIONAL-BRIEF.md` | spec-only |
| Visit wizard — site prioritisation | Safety manager / divisional manager | `features/SYSTEMIC-CAUSES.md` §Visit Plan | spec-only |
| Visit wizard — focus area selection | Safety manager / divisional manager | `features/SYSTEMIC-CAUSES.md` §Visit Wizard Flow | spec-only |
| Visit briefing pack generation (`visit_briefing.generate`) | System (async) | `features/VISIT-BRIEFING.md` | spec-only |
| Visit execution mode | Safety manager / divisional manager | `features/SYSTEMIC-CAUSES.md` §Visit Execution | spec-only |
| Visit completion + summary generation (`visit_plan.summarise`) | System (on complete) | `features/SYSTEMIC-CAUSES.md` §Visit Summary | spec-only |
| FW capacity dashboard — safety manager view | Safety manager | `features/SYSTEMIC-CAUSES.md` | spec-only |
| FW capacity dashboard — leadership view | Divisional manager / leadership | `features/SYSTEMIC-CAUSES.md` | spec-only |
| Document coverage layer (when `workspace.ms` also active) | Safety manager | `features/MANAGEMENT-SYSTEM-INGESTION.md` | spec-only |

---

## UX surfaces

| View | Role(s) | Purpose | Design state |
|---|---|---|---|
| FW capacity profile dashboard | Safety manager | Factor-by-factor picture: active factors, dominant maturity, blind spots; time window selector | to design |
| Worksite atrophy overview | Safety manager | All sites: atrophy score, last observation date, last visit date, open actions; alert indicators | to design |
| Situational brief review | Safety manager | Read AI draft brief; approve or edit before distribution to leadership | to design |
| Visit planning — site selection | Safety manager / manager | Prioritised site list; atrophy, blind spots, open insights per site | wireframe: `wireframes/visit-wizard.html` |
| Visit planning — focus area selection | Safety manager / manager | AI-curated focus areas with source badges; select 2–5 | wireframe: `wireframes/visit-wizard.html` |
| Visit briefing — pre-visit | Safety manager / manager | Full briefing: focus area prompts, open actions, last visit summary, relevant insights | to design |
| Visit execution mode | Safety manager / manager | Active visit: focus areas as observation prompts; in-visit observation capture | to design |
| Visit summary | Safety manager / manager | Post-visit AI summary; links to observations captured; follow-up items | to design |

---

## Capability gates

| Gate | Default | What it controls |
|---|---|---|
| `workspace.analytics` | off | This workspace — FW capacity profile, atrophy, visit planning, situational briefs |
| `systemic_causes.profile_window_days` | 90 | Time window for FW capacity profile computation (org-configurable) |
| `systemic_causes.profile_threshold` | 3.0 | Composite score threshold for a factor to enter the active profile |

---

## Workspace connections

**Built on:** `workspace.core` (Insight) — required. Needs classified intelligence events to aggregate.

**Richer when combined with:**
- `workspace.incident` — investigations contribute with 3× base weight vs insights; confirmed root causes are the highest-value input to the capacity profile
- `workspace.risk` — control failure signals add high-confidence FW factor evidence; overdue verifications contribute to atrophy score
- `workspace.ms` — document coverage and atrophy appear as a layer on the worksite dashboard; document review signals surface in visit briefing focus areas

**Produces for downstream:**
- FW capacity profile → `workspace.communities` (thread seeds are richer when profile is available; document atrophy signals seed MS workspace discussions)
- Visit planning activity → atrophy score reset (`manager_visit_recency` signal)
- Situational briefs → distributed to divisional managers and leadership (terminal output)

---

## V2 Notes

**Org hierarchy views** — V1 computes the profile at site level. V2: regional and divisional aggregation; leadership views that roll up across the hierarchy. The schema supports org_level as a parameter; the UX for hierarchy navigation is V2.

**Configurable atrophy weights** — atrophy score composite currently uses equal weights. V2: org-configurable weighting (e.g. high-risk sites weight `high_signal_observation_recency` more heavily).

**Profile threshold per factor** — V1 uses a single org-wide threshold. V2: per-factor sensitivity (some factors are more significant at lower scores).

**Visit scheduling integration** — V1 visit planning is intent-only (planned_date). V2: calendar integration so planned visits appear in the manager's work calendar and briefing delivery is auto-timed.

**Situational brief distribution** — V1 brief is reviewed and manually shared. V2: configurable auto-distribution list per org level; read receipts; re-brief when profile changes materially.

*Wireframes exist for: visit wizard flow (`wireframes/visit-wizard.html`). All other views are to design.*
