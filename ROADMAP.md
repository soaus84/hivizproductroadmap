# Hiviz — Product Roadmap

**Forge Works** | Field Intelligence Platform  
**Status:** V1 ready to build · V2–V3 designed · V4–V5 discovery  
**Last updated:** March 2026  
**Rendered version:** [hivizroadmap.vercel.app](https://hivizroadmap.vercel.app)

---

## Product Overview

Hiviz is a field intelligence module added to the existing Forge Works platform. It turns field observations into crew learning through an AI-powered intelligence pipeline, closing the loop from what supervisors see on site to what crews hear in toolbox talks.

**Core loop:**
```
Supervisor logs observation
  → AI enriches (async)
    → Trend algorithm detects pattern
      → AI drafts Critical Insight
        → Safety Manager approves
          → AI generates Toolbox Talk
            → Supervisor delivers to crew
              → Corrective actions assigned & checked off
```

**Symmetric pull mechanism:** Enquiries collect field intelligence from supervisors at scale, AI synthesises responses, Safety Manager acts on findings.

**Forge Works Map® integration:** Every insight, investigation, and enquiry summary is classified against the proprietary 15-factor organisational capacity framework (Guide / Enable / Execute × Compliant / Leading / Resilient). Classification is confidence-gated at 0.70, multi-factor (max 3), with per-factor rationale stored and displayed.

---

## Design Principles

1. **Every AI suggestion has a visible reason** — trust and liability. "AI has suggested" not "AI recommends". Rationale shown inline, not in a tooltip.
2. **Forge Works Map® classification** — multi-factor parallel arrays, confidence threshold 0.70, per-factor rationale required. No suggestion without a reason.
3. **Worksite targeting vs person targeting** — toolbox talks, enquiries, and corrective actions are worksite obligations. Briefs, polls, huddles, and CoP discussions use existing person-targeted platform tools.
4. **Capacitor-wrapped responsive Next.js** — one codebase, mobile-first, no native app in V1.
5. **AI suggestion framing** — every AI output is a suggestion with visible reasoning, never a recommendation or directive. The safety professional makes the call, the AI makes the case.
6. **Every AI suggestion field has a companion rationale field** — `ai_suggested_x` always has `ai_suggested_x_rationale`. No exceptions.

---

## Roles

| Role | Primary device | Primary function on platform |
|------|---------------|------------------------------|
| Supervisor | Mobile | Delivers talks, logs observations, responds to enquiries, checks off actions |
| Manager (site / regional) | Mobile | Visit workflow — plan, observe, close. Feeds trend pipeline. |
| Safety Manager | Desktop | Approves insights, builds enquiries, creates actions, reads analytics |
| Division Manager | Desktop | Receives digests and board reports |

**Worksite personnel slots** — each worksite has defined role slots: `supervisor`, `manager`, `safety_professional`, `control_verifier` (V5). One or more users per slot. Assignment managed by Safety Manager in site settings. Drives notification routing and obligation assignment.

---

## Targeting Model

| Type | Targets | Examples |
|------|---------|---------|
| Worksite-targeted | The site, regardless of who is rostered | Toolbox talks, corrective actions, enquiry obligations, control verifications |
| Person-targeted | Individual users by role and expertise | Briefs, polls, huddles, CoP discussions (existing platform tools) |

Enquiries are dispatched to worksites — the Safety Manager assigns to a named person from the site's slot assignments. A worksite queue model ensures obligations are met even when personnel change.

---

## Forge Works Map® — 15 Factors

```
GUIDE (direction & context)
  1.  senior_leadership
  2.  strategy
  3.  risk_management
  4.  safety_organisation
  5.  work_understanding

ENABLE (resources & systems)
  6.  operational_management
  7.  resource_allocation
  8.  management_systems
  9.  goal_conflict_tradeoffs
  10. learning_development

EXECUTE (frontline & operations)
  11. frontline_workers
  12. communications_coordination
  13. decision_making
  14. contractor_management
  15. monitoring_metrics
```

**Maturity levels:** `compliant` (Systemic Management) → `leading` (Cultural Management) → `resilient` (Integrated Management)

**Classification rule:** All factors independently assessed. Only those ≥ 0.70 confidence stored. Max 3 per finding. Each has its own rationale. The threshold is the defence — if a factor meets it, it's tagged, no ranking required.

---

## V1 — Core Loop
> **Purpose:** Pilot version. 90-day fixed-fee entry. Every role has enough to use the platform. The loop closes.

### E1 — Foundation
Auth, org model, navigation shell, async job queue, push notification infrastructure, work type and safety practice taxonomy.

- `worksite_role_slot` and `worksite_slot_assignment` tables built from V1 — used for routing, assignment, and (V5) verification scheduling
- Role slots: `supervisor` | `manager` | `safety_professional` | `control_verifier`
- WorkType gets `has_critical_controls BOOLEAN DEFAULT false` — costs nothing in V1, required for V5

### E2 — Observation Capture
Supervisor mobile. Safe / At-risk / Near-miss. Observation and incident fork. AI enrichment.

**Key fields:**
- `stop_work_called` — "Did you stop the work?" (one tap)
- `involved_role` — Employee / Operator / Subcontractor / Visitor
- `photo_url` — optional evidence

**Incident path** (data model complete, UI V2+):
- `injury_classification` — first_aid | medical_treatment | restricted_work | lost_time | fatality
- `body_part_affected`, `nature_of_injury`, `mechanism_of_injury`, `site_location_type`
- `notifiable_flag` — set by triage logic, routes to Safety Manager for confirmation

**AI Prompt 1 — Observation Enrichment:**
- Returns: `failure_type`, `key_hazard`, `key_hazard_rationale`, `stop_work_warranted`, `stop_work_warranted_rationale`, `anonymisation_flags`, `enrichment_confidence`
- Stored in `ai_*` columns — never overwrites original text

### E3 — Intelligence Pipeline
Trend detection algorithm → Critical Insight generation → Forge Works Map® classification → Safety Manager workbench.

**Trend detection:** Near-miss count by work_type × org_level × time_window vs configurable threshold.

**AI Prompt 2 — Critical Insight Draft:**
- Returns: `pattern_summary` + `pattern_summary_basis`, `likely_systemic_cause` + `rationale`, `recommended_action` + `rationale`, `toolbox_narrative`, `escalate_to_systemic`
- Stored as draft — `cleared_for_toolbox = false` until human approval

**AI Prompt 8 — Forge Works Map® Classification (fw_classify job):**
- Runs after insight approval, investigation close, enquiry summary
- Returns: `classifications[]` — each with `fw_factor`, `fw_domain`, `fw_maturity_signal`, `fw_confidence`, `fw_rationale`
- Only factors ≥ 0.70 stored. Max 3. Empty array = attempted, none met threshold.
- `fw_classification_basis` — overall evidence narrative (single field)

**V2 cascade — fw_classify into question generation:** In V2 pass `fw_factors` + `fw_rationales` into Prompt 4 (enquiry question generation) so question types are selected per classified factor.

**V2 cascade — maturity-aware talk framing:** In V2 pass `fw_maturity_signals` into Prompt 3 so narrative register adapts — Compliant talks about procedures, Leading about leadership, Resilient about adaptive capacity.

**V2 consideration — Insight lead assignment:** After discussion and endorsement, assign a named lead ("who is taking ownership?"). Useful when two Safety Managers with overlapping scope both receive the notification.

### E4 — Toolbox Talk Generation & Delivery
AI assembles talk from approved insight. Supervisor delivers on mobile. Crew attendance recorded.

**AI Prompt 3 — Talk Assembly:**
- Inputs: worksite, work type, presenter name, pattern summary, likely cause, toolbox narrative
- Returns: `hazard_intro`, `main_content`, `key_actions[]`, `discussion_questions[]`, `closing_line`
- Voice: 20-year site veteran — plain English, no jargon, no moralising

**Provenance badge** on every talk — "Based on: 6 field observations across 4 sites" or "Based on: External Alert — Safe Work Australia"

### E5 — Manager Visit Workflow
Atrophy detection → visit planning → AI recommended topics → active visit → close.

**Atrophy formula:**
```
score = MIN(100,
  days_since_last_obs   × 1.8 +
  days_since_last_talk  × 1.2 +
  open_investigations   × 8   +
  near_miss_30d         × 3
)
```
Red ≥70 | Amber 40–69 | Green <40

**Visit plan status:** `planned` → `active` → `completed` | `cancelled`

On `completed`: atrophy recalculated, observations tagged to visit enter trend pipeline.

**V2 — Visit Briefing Pack:** AI-generated 48h before visit. Headline, site reading, focus areas with evidence, open actions, Forge Works signal. Transitions to active guide on Start Visit.

### E6 — Enquiry System (V1 — Free Text)
Safety Manager creates question list (AI-assisted or manual). Dispatched to targeted supervisors. Free text responses. AI synthesises.

**V1 scope:** `question_text` (plain string) + `free_text_answer` only. No question types, no structured options.

**AI Prompt 4 — Question Generation:**
- V1: generates 3–5 plain questions from pattern summary and likely cause
- V2 cascade: receives `fw_factors` + `fw_rationales`, selects question types per factor

**AI Prompt 5 — Response Synthesis:**
- Runs after each response (debounced 30s)
- Returns: `synthesis_findings[]` with signal icons (🔴🟠🟡💡), `summary_narrative`, `recommended_actions[]` each with `rationale`

**Unique constraint:** `(question_id, responder_id)` — one response per question per person.

### E7 — Corrective Actions
Safety Manager creates actions from insights and enquiry results. Assigns via worksite slot. Supervisor checks off on mobile.

**Status lifecycle:** `open` → `in_progress` → `complete` | `overdue`

**Assignment:** Safety Manager selects from users in relevant worksite slot. Assigned person notified. All slot users retain visibility.

**Source link:** Each action has `source_type` (insight | enquiry) and `insight_id` or `enquiry_id` FK.

### E8 — Analytics (V1)
Pipeline health, leading indicators, atrophy heatmap, Forge Works placeholder.

**4 stat tiles:** Near-miss rate % | Stop-work events | Sites atrophy >50 | Visit coverage %

**Pipeline funnel:** observations → enriched → near-miss → insights generated → approved → talks generated → delivered → crew reached

**Forge Works placeholder:** Shows "N of 5 classified findings needed" until threshold met. Full view in V2.

**V2 — Talk Delivery Obligations (E8b, lower priority):**
When insight approved with sharing scope, set delivery expectation per site in scope. Track: reach %, delivery latency, overdue by site. Not applicable override available. Feeds visit briefing ("This site has 2 talks overdue").

---

## V2 — Intelligence Depth
> **Purpose:** Converts pilot customers to annual contracts. The loop works — add depth.

### E9 — Structured Enquiry
Seven question types: Assurance Check | Likelihood Assessment | Prevalence Check | Evidence Request | Work as Done | Gap Identification | Comparative Check.

Factor-aware question generation using `fw_factors` from classification. Live synthesis with signal icons and bar charts. Legal hold enforcement (hard block at data layer).

### E10 — Manual & External Critical Insight Entry
Safety Manager enters insights directly — external alerts, foreign investigations, leadership judgement calls.

**trigger_source enum:** `algorithm` | `manual` | `external_alert` | `external_investigation`

**One shape, source-aware field population.** Creator is reviewer — `cleared_for_toolbox = true` on save. All downstream jobs fire identically. Source badge shown on insight and talk provenance.

**AI structuring assist:** Safety Manager pastes unstructured source text → AI populates standard fields → Manager edits before save. Synchronous call, not a background job.

### E11 — Visit Briefing Pack
AI-generated 48h pre-visit briefing on manager's phone. Transitions to active guide on Start Visit. Focus areas become capture prompts. Stale flag if >48h old.

### E12 — Forge Works Map® Analytics
Domain summary (Guide/Enable/Execute) → factor detail (15 factors ranked by frequency) → maturity signal trend table (factor × current level × 90-day trend arrow). Minimum 5 classified findings to show. Factor drill-down shows per-factor rationale inline for each tagged finding.

### E13 — Situational Briefs & Leadership Digest
Auto-generated brief when insight approved or investigation closes. Safety Manager reviews before distribution. Periodic digest for division managers.

---

## V3 — Integration & Enterprise
> **Purpose:** Platform becomes embedded in organisational workflow.

### E14 — Incident Module
Full investigation framework, AI-assisted, regulatory notification workflow, TRIFR calculation. External investigation insight path (trigger_source = `external_investigation`).

### E15 — Community of Practice Thread Seeding
AI-generated discussion thread seeded to CoP rooms on insight/investigation approval. Transparently AI-attributed — UVP. Platform-agnostic integration adapter (Viva Engage, Slack).

### E16 — Board Report & Governance Export
AI-generated board narrative, Safety Culture Index, export formats (PPTX, PDF, CSV). Periodic auto-generation. Org-unit owned — any Safety Manager whose scope includes the unit can see it.

**Reporting design principle:** Reports are periodic, not ad hoc. Org-unit owned, not user-owned. Both Safety Managers with overlapping scope receive notification — best they discuss it. Report can prompt manual insight entry from the period being reviewed.

### E17 — Enterprise Integration
SSO/SAML, webhook events, public API documentation.

---

## V4 — Organisational Diagnostic
> **Purpose:** Closes the loop on Guide and Enable factors the field observation pipeline cannot reach.

Periodic role-targeted anonymous surveys probing the top half of the Forge Works Map®. Same enquiry infrastructure, different trigger model and anonymisation rules.

**Key design decisions:**
- `responder_id` NOT stored — hard anonymisation at data layer, not a UI toggle
- Safety Manager configures survey set; AI generates questions per factor per role
- Results produce `survey_factor_signal` records per period — maturity position per factor over time
- Survey signal feeds Forge Works capacity analytics alongside field intelligence (source-badged separately)
- AI assesses whether factor signal warrants a Critical Insight entering the improvement pipeline

**Who answers what:**

| Platform role | Best positioned for |
|--------------|-------------------|
| Supervisor | Execute domain — Frontline Workers, Communications, Decision-making |
| Manager | Enable domain — Operational Management, Goal Conflict, Resource Allocation |
| Safety Manager | Guide domain — Safety Organisation, Risk Management (as observer) |
| Division Manager | Not a respondent — subject of Senior Leadership questions answered by others |

**Dependency:** Requires V2 structured enquiry. Can bring forward to V3 if E9 ships early.

---

## V5 — Risk Assurance
> **Purpose:** Critical control verification. Discovery phase — consult internal experts before designing.**

### Concept
Global critical control register scoped to work type taxonomy (aligned to ICMM CCM practice). Controls pushed to worksites, accepted or locally overridden. Supervisors verify controls before high-risk work begins. Results feed intelligence pipeline.

### Register model
- Global register owned by Safety team — 5–10 critical controls per work type maximum
- Push model: new/updated control pushed to all active worksites for that work type
- Local override states: `accepted` | `locally_added` | `inapplicable` (requires reason + sign-off) | `locally_modified` (stricter only — never weaker)
- Frequency types: `shift_start` | `daily` | `weekly` | `monthly` | `one_off` | `event_triggered`

### Verification tiers
- **Tier 1 (Supervisor, shift-start):** Existence check. Binary — in place / not in place / not applicable. Fast, mobile. Routes to `control_verifier` slot, fallback to `safety_professional` → `supervisor`.
- **Tier 2/3 (Manager/Safety Professional, periodic):** Effectiveness check. Can reuse enquiry infrastructure for structured effectiveness questions.

### Integration with intelligence pipeline
- Failed verifications enter trend detection — same pipeline as near-miss observations, more precise signal
- Overdue verifications contribute to atrophy score
- Investigation framework surfaces recent control failures as candidate contributing factors
- Control failure tally across investigations → effectiveness signal → register review trigger

### Discovery discussion notes (for expert consultation)

**1. Register structure — work type vs MUE**
Options: A) Work-type scoping (simpler, consistent with platform); B) MUE first-class entity with bowtie model (mining standard, more complex); C) Start with A, add B as optional enhancement. *Consult: Is target customer base using MUE/bowtie language?*

**2. Verification tier model**
Options: A) Two tiers (supervisor + manager/safety professional); B) Full three tiers (Tier 3 reuses enquiry infrastructure); C) Single configurable tier per control. *Consult: Do target organisations have formal tier structures today or is this aspirational?*

**3. TARPs — Trigger Action Response Plans**
Options: A) Notification + work hold recommendation, human decides; B) Pre-defined TARP attached to each control; C) Optional TARP — platform supports it if org has them. *Consult: Do target organisations already have TARPs documented?*

**4. Control health score vs composite risk score**
Options: A) Control health score only (defensible, directly actionable); B) Composite site risk score (powerful for leadership, risk of gaming); C) Both scores kept visually separate. *Consult: What does leadership currently use to communicate site risk?*

**5. Failed controls in investigation tally**
Options: A) Simple tally — surface count in register; B) Effectiveness signal — combine tally with verification pass rate (the gap is the insight); C) Automatic register review trigger at threshold. *Note: Most defensible differentiator from existing CCM tools.*

**6. Register governance**
Options: A) Safety Manager owns register; B) Separate Register Owner role; C) Change request model — anyone proposes, owner approves, investigation corrective actions auto-propose. *Consult: Do target organisations have existing critical control registers?*

---

## Deferred — Not in V1

| Feature | Deferred to |
|---------|------------|
| Incident module UI | V2+ |
| Structured enquiry question types | V2 |
| Manual / external insight entry | V2 |
| Visit briefing pack | V2 |
| Forge Works Map® full analytics | V2 |
| Situational briefs | V2 |
| Talk delivery obligations tracking | V2 (lower priority) |
| CoP thread seeding | V3 |
| Board report / export | V3 |
| SSO / SAML | V3 |
| Regulatory report generation | V3+ |
| Diagnostic survey | V4 |
| Risk assurance / critical controls | V5 |
| Offline observation capture | V1.1 if pilot sites flag it |

---

## Cascade Notes — V1 data captured, consumed in V2+

| V1 captures | V1 gap | V2 fix |
|-------------|--------|--------|
| `fw_factors[]` + `fw_rationales[]` | Enquiry question generation ignores classified factors | Question types selected per factor (E9) |
| `fw_maturity_signals[]` | Talk voice fixed regardless of maturity | Narrative register adapts to maturity level (E9) |
| `fw_factors[]` multi-factor | Situational brief receives single factor | Brief names each factor with rationale (E13) |
| `fw_factors[]` multi-factor | Visit briefing references single factor | Briefing names all factors at site (E11) |
| `stop_work_warranted` vs `stop_work_called` | Divergence not surfaced | Analytics flags warranted-but-not-called as Frontline Workers / Operational Management signal |
| `involved_role` | Not used in trend grouping or classification | Subcontractor clustering → Contractor Management signal; passed to fw_classify as context |

---

## Commercial Model

**Pricing unit:** Active worksites (not users) — no anxiety when supervisors are added or changed.

**Entry:** 90-day fixed-fee pilot. Low enough to skip procurement committee, high enough to signal serious. Includes onboarding support. Converts at 90 days or walks away.

**User pricing:** Unlimited users within worksite licence. One or two extra supervisors joining doesn't trigger a conversation.

---

## Tech Stack (V1)

| Concern | Decision |
|---------|----------|
| Framework | Next.js 14 App Router |
| Language | TypeScript throughout |
| Database | PostgreSQL 15+ |
| ORM | Prisma |
| Job queue | BullMQ (Redis) |
| AI | Anthropic SDK — claude-sonnet-4-20250514 |
| Mobile | Capacitor-wrapped responsive Next.js |
| Auth | NextAuth v5 + existing platform session |
| UI kit | Minimal UI (existing, licensed) |

**All AI calls are async jobs — never synchronous in an API route.**

---

## Key Entity Relationships

```
worksite (existing)
  ├── worksite_role_slot → worksite_slot_assignment (personnel)
  ├── observation → [ai_enrichment fields]
  ├── incident (schema ready, UI V2+)
  ├── visit_plan → observation (via visit_id)
  ├── critical_insight → [fw_* classification arrays]
  │     ├── toolbox_talk → talk_delivery_record
  │     ├── enquiry → enquiry_question → enquiry_response
  │     └── corrective_action
  └── atrophy_score_log

ai_prompt_config (prompt versioning — update prompts without code deploys)
```

---

## Repository

```
/
├── ROADMAP.md              ← this file (AI/dev readable)
├── mvp-scope.html          ← visual roadmap (browser / shareable URL)
├── vercel.json
├── specs/                  ← full specification set
│   ├── 01-data-model-api-spec.md
│   ├── 02-ai-prompt-library.md
│   ├── 03-system-architecture.md
│   ├── 04-integration-logic-rules.md
│   ├── 05-view-information-spec.md
│   ├── 06-notification-events.md
│   └── 07-enquiry-module-spec.md
├── simulators/
│   ├── workflow-sim.html
│   └── enquiry-sim.html
├── product-docs/
└── v1-devpack/
    ├── README.md           ← full build guide for dev team
    └── src/
```
