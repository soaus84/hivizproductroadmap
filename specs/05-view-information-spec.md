# View Information Specification

**Hiviz — Critical Information Needs Per View**  
Version: 0.4 — March 2026

This document defines what each view **reads**, **writes**, **requires from the user**, and **communicates to the user**. It is the primary reference for frontend development. Design decisions are excluded — see design files separately.

---

## 0. AI Suggestion Display Standard

Applied consistently across every view that surfaces AI output. Non-negotiable — trust and liability principle.

**Framing language:**
- "AI has suggested" — not "AI recommends"
- "Based on [evidence]" — not "because"
- "For your review" — not as a directive
- "AI identified this pattern" — not "AI determined"

**Rationale visibility:**
- Every AI suggestion is displayed with its rationale inline — not in a tooltip, not behind a tap
- The reviewer reads the why before they can act on the suggestion
- Rationale is the same size and weight as the suggestion itself — not a footnote

**Visual distinction:**
- AI-generated content is visually distinguished from human-confirmed content at all times
- `ai_suggested_*` fields shown with an AI badge and suggestion framing
- Human-confirmed fields shown without badge — they are now the record, not the suggestion
- Once a human confirms, edits, or rejects an AI suggestion, the AI badge is removed from that field

**What this means in practice:**
- Investigation framework: each AI-suggested contributing factor shows its per-factor rationale inline. Investigator reads the rationale, then confirms or dismisses. Confirmed fields become the investigation record.
- Insight workbench: AI draft shows pattern_summary_basis alongside the summary. Safety manager sees what evidence drove the draft before approving.
- Enquiry builder: each AI-suggested question shows its ai_rationale. Safety manager can edit or remove with the rationale in view.
- Visit briefing: each focus area shows its evidence field alongside the topic. Manager walks in knowing exactly what data put this on the list.
- Corrective actions from enquiry: each suggested action shows which finding it addresses. Safety manager creates with that context visible.

---

---

## 1. Mobile Views — Supervisor Role

### 1.1 Supervisor Home

**Purpose:** Morning entry point. Surface the most important action (pending talk) and recent site activity.

**Reads:**
- `toolbox_talk` WHERE `worksite_id = user.worksite_id AND delivered_at IS NULL` — pending talk count and work type
- `observation` WHERE `worksite_id = user.worksite_id` — last 5, ordered by `observed_at DESC`
- `toolbox_talk` WHERE `worksite_id = user.worksite_id AND delivered_at IS NOT NULL` — last delivered talk
- `critical_insight` WHERE `cleared_for_toolbox = true AND scope covers worksite` — any new approved insights
- Aggregate counts: talks delivered this week, crew reached this week

**Displays:**
- Greeting with supervisor name and site name
- Talk Ready card — work type, time since generated, estimated crew count — **most prominent element**
- 2 stat tiles: talks this week, crew reached this week
- Activity feed: last 3 significant events (near-miss logged, talk delivered, insight approved) with timestamps and work type chips
- Two action shortcuts: Log Observation, Report Incident

**Navigation:**
- Talk Ready card → Talk Delivery view
- Log Observation → Capture (observation path)
- Report Incident → Capture (incident path)
- Bottom nav: Home (active), Talk, Capture, Records

**Writes:** Nothing on this view.

---

### 1.2 Capture — Observation & Incident

**Purpose:** Primary data entry. Single form that adapts based on whether anyone was hurt.

**Reads:**
- `work_type` WHERE `active = true` — filtered to work types active at user's worksite if available
- `safety_practice` — full list for optional secondary classification
- `visit_plan` WHERE `manager_id = user.id AND status = 'active' AND worksite_id = user.worksite_id` — active visit plan for topic prompts
- `enquiry` WHERE user is a recipient and status = active — any pending enquiry questions as prompts

**Displays — Observation path (NO to fork):**
- Work type selector (required)
- Safety practice selector (optional)
- Observation type: Safe / At-risk / Near-miss (required)
- What was observed (required, min 20 chars — free text)
- Immediate action taken (optional free text)
- "Did you stop the work?" — Yes / No toggle (optional, one tap — feeds `stop_work_called`)
- People involved: count stepper + role selector (Employee / Operator / Subcontractor / Visitor) — both optional
- Photo (optional)
- If active visit plan: topic prompts shown above text field as reference — not locked

**Displays — Incident path (YES to fork):**
- Work type selector (required)
- Incident type: Near-miss / Injury / Property damage / Environmental (required)
- Occurred at datetime picker (required) + "I'm not sure of the exact time" checkbox → sets `discovered_at` instead
- What happened (required, min 20 chars — free text)
- Immediate action taken (optional free text)
- People involved: count stepper + role selector — both optional
- Photo (optional)

*If incident_type = Injury — additional fields appear:*
- Injury classification (required): First Aid / Medical Treatment / Restricted Work / Lost Time / Fatality
  — Fatality triggers a confirmation step before submit
- Body part affected (required if Medical Treatment or above): selector — Head & Neck / Upper Limb / Lower Limb / Trunk / Multiple
- Nature of injury (required if Medical Treatment or above): selector — Laceration / Fracture / Strain or Sprain / Burn / Crush / Exposure / Concussion / Other
- Mechanism of injury (required if Medical Treatment or above): selector — Fall from Height / Fall Same Level / Struck by Object / Caught in Equipment / Manual Handling / Vehicle Contact / Exposure / Other
- Location on site (optional): Ground Level / Elevated / Confined Space / Vehicle / Plant Room / Perimeter / Other

**Regulatory notification:**
- Not shown to user at capture — assessed by triage algorithm post-submission
- If `notifiable_flag = true`: safety manager receives notification N09 with regulatory action item
- Supervisor sees no additional fields — notification logic is invisible to them

**Writes:**
- `observation` OR `incident` record
- Auto-sets: `observer_id`, `worksite_id`, `observed_at`, `observer_role`, `cleared_for_sharing = true`, `visit_id` if active visit
- Post-write: queues `observation.enrich` AI job OR runs incident triage synchronously (sets `notifiable_flag` if applicable)

**Validation:**
- Work type: required
- Observation type / incident type: required
- What was observed / happened: required, min 20 chars
- Occurred at: required for incident path, must be in past
- Injury classification: required if incident_type = injury
- Body part, nature, mechanism: required if injury_classification >= medical_treatment

**Future scope note:**
Regulatory report generation (WHS incident notification forms, jurisdiction-specific formats) is not in current scope. The data captured here is structured to support it when built. The `notifiable_flag` and injury classification fields provide the minimum required inputs for most regulatory frameworks.

---

### 1.3 Talk Delivery

**Purpose:** Full-screen delivery surface. Supervisor reads talk to crew, manages attendance, delivers.

**Reads:**
- `toolbox_talk` by ID — full generated content: `hazard_intro`, `main_content`, `key_actions[]`, `discussion_questions[]`, `closing_line`
- `toolbox_talk.translated_content[lang_code]` — if previously translated for selected language
- `users` WHERE `worksite_id = user.worksite_id AND active = true` — crew list for attendance

**Displays:**
- Back navigation (exits to home — confirms if unsaved changes)
- Language selector — 10 languages (triggers translation if non-English selected)
- Read Aloud control — plays translated or original content via Web Speech API
- Talk sections in order: Hazard intro, Main narrative, Key actions list, Discussion questions
- Presenter note input — optional free text appended before delivery
- Crew attendance list — scrollable, tap to acknowledge, manual add for unregistered workers
- Deliver button — prominent, shows current attendee count — locked until at least 1 acknowledgement

**Writes on Deliver:**
- `toolbox_talk`: `delivered_at = now()`, `attendee_ids[]`, `attendee_count`, `acknowledgement_method = 'digital'`, `presenter_notes`
- If translation was used: `toolbox_talk.translated_content[lang_code]` cached
- Record is locked after delivery — no further edits

**Key behaviour:** Full screen, no bottom navigation visible. Single focus: deliver the talk.

---

### 1.4 Delivery Record

**Purpose:** Confirmation receipt. Locked record of what was delivered to whom.

**Reads:**
- `toolbox_talk` by ID (just delivered) — reference number, site, time, crew count, work type, content summary

**Displays:**
- Confirmation state: reference number, site, datetime, attendee count, work type
- Attendee list (all acknowledged)
- Content summary: which insight/investigation/observation fed this talk (provenance)
- What happens next: brief explanation of how this feeds the pipeline
- Return to Home button

**Writes:** Nothing. Read-only receipt.

---

### 1.5 Enquiry Response

**Purpose:** Supervisor responds to a field enquiry dispatched by safety manager.

**Reads:**
- `enquiry` by ID — title, context narrative, deadline
- `enquiry_question` WHERE `enquiry_id = $id` — ordered by position, filtered to questions targeted at this user
- `enquiry_response` WHERE `respondent_id = user.id AND enquiry_id = $id` — previously submitted answers (for resuming)

**Displays:**
- Enquiry context header: title, who sent it, why (context narrative from insight or investigation), deadline, progress bar (questions answered / total)
- One question at a time — current question prominent, previous shown as answered (collapsed), upcoming shown as locked
- Per question type:
  - **Assurance:** 3 large tap targets (Yes / Partially / No) + optional photo button + mandatory note if Partially or No
  - **Likelihood:** 3 tap targets (Low / Moderate / High) + optional brief reason
  - **Work as Done:** text area with prompt ("describe what actually happens, not the procedure"), min 3 sentences encouraged
  - **Gap Identification:** text area + category selector (People / Process / Equipment / Environment)
  - **Comparative:** 3 tap targets (Exists & works / Has gaps / Doesn't exist) + description field
  - **Evidence:** photo required + description of what it shows
  - **Prevalence:** 3 tap targets (Never / Sometimes / Always) + optional note
- Navigation: previous / next / submit on final question

**Writes:**
- `enquiry_response` per question: `selected_option`, `note_text`, `photo_url`, `gap_category`, `answered_at`, `status = 'answered'`
- On final submit: all responses locked, `enquiry.synthesise` job queued

---

## 2. Mobile Views — Manager / Regional Manager Role

### 2.1 Visit Planning — Site List

**Purpose:** Manager's home. Shows portfolio of sites ranked by atrophy so they know where to go.

**Reads (atrophy score query — see 01-data-model-api-spec.md Section 4):**
- `worksite` — all sites in manager's scope
- `observation` — most recent per site, count in last 30 days
- `toolbox_talk` — most recent delivered per site
- `investigation` — open count per site
- `observation` — near-miss count last 30 days per site
- `visit_plan` — last completed visit per site
- Calculated: `atrophy_score` per site (composite)

**Displays:**
- Summary: sites needing attention count (atrophy > 70), sites visited this month
- Warning banner if 3+ sites at high atrophy
- Site cards ranked by atrophy score DESC:
  - Site name, subtitle, worker count, active work types
  - Atrophy score with colour coding (red >70, amber 40-70, green <40)
  - Signal chips: days since last observation, open investigations, near-miss trend
  - Atrophy progress bar
  - Last visit date
  - Plan Visit button
- Filter: All / High atrophy / Unvisited / Has open investigations

**Writes:** Nothing on this view.

**Navigation:**
- Plan Visit → Visit Plan Detail for that site
- Bottom nav: Visits (active), Capture, Insights, Records

---

### 2.2 Visit Plan Detail

**Purpose:** Manager prepares for a field visit — reviews site context, selects observation topics, starts visit.

**Reads:**
- `worksite` by ID — name, subtitle, worker count
- Site context metrics (same as atrophy query above, for this site)
- `critical_insight` WHERE `scope covers site AND cleared_for_toolbox = true` — recent relevant insights
- `investigation` WHERE `worksite_id = $site AND status = 'open'` — open investigations
- AI-generated topic recommendations (cached 24h per site): `visit_plan.recommended_topics` if recent, else triggers `visit.generate_topics` job
- `visit_plan` WHERE `manager_id = user.id AND worksite_id = $site AND status IN ('planned','active')` — existing plan if any

**Displays:**
- Site header: name, planned visit date/time selector
- 4 metric tiles: last observation age, open investigations count, near-miss count (30d), last talk age — all colour-coded
- Recommended topics list (4-6 items):
  - Topic text
  - Source badge: Trend / Investigation / AI / Practice atrophy
  - Source detail: which observation cluster, which investigation, why AI suggested it
  - Checkbox (tap to select/deselect)
  - Add custom topic option
- Site context card: key-value list of site signals
- Start Visit button (primary) — locks plan, navigates to Capture

**Writes on Start Visit:**
- `visit_plan`: `manager_id`, `worksite_id`, `planned_at`, `topics_planned[]`, `status = 'active'`, `atrophy_score_at_plan`

---

### 2.3 Insight Discussion Thread

**Purpose:** Manager reads an approved or pending critical insight, endorses it, adds field context comment.

**Reads:**
- `critical_insight` by ID — full content, pattern summary, toolbox narrative
- `insight_endorsement` WHERE `insight_id = $id` — count and whether current user has endorsed
- `insight_comment` WHERE `insight_id = $id` — ordered by `created_at ASC`
- `observation` WHERE `id IN insight.source_observation_ids` — source observations (anonymised)

**Displays:**
- Insight header: type badge, scope, age, overdue flag if pending review
- Insight title
- AI narrative in italic bordered block
- Signal chips: observation count, site count, failure type, escalation recommendation
- Social row: Endorse button (with active state if already endorsed), endorsement count, comment count, escalate badge if recommended
- Discussion thread: all comments with avatar, name, role, timestamp, comment text, endorsed badge if commenter endorsed
- Add comment input with send button
- For safety managers: Approve / Edit / Reject action buttons
- For managers: Endorse button only (no approve/reject)

**Writes:**
- `insight_endorsement` on endorse (or delete on un-endorse)
- `insight_comment` on comment submit
- For safety managers: `critical_insight` fields on approve/reject (see Workbench spec)

---

## 3. Desktop Views — Safety Manager Role

### 3.1 Workbench — Queue

**Purpose:** Safety manager's morning surface. Prioritised list of items requiring action.

**Reads (union query — see 01-data-model-api-spec.md Section 4):**
- `critical_insight` WHERE `cleared_for_toolbox = false AND review_action IS NULL AND scope in user scope`
- `investigation` WHERE `status = 'open' AND worksite in user scope`
- `corrective_action` WHERE `status NOT IN (completed, cancelled) AND worksite in user scope`
- `site_atrophy_view` WHERE `score > threshold AND no active visit plan`
- `enquiry` WHERE `status = 'draft' AND created_by_id = user.id` — draft enquiries needing dispatch

**Displays (queue column):**
- Date, total item count, overdue count
- Filter tabs: All / Insights / Investigations / Actions / Atrophy / Enquiries
- Group labels: Overdue / Due This Week / Upcoming
- Per item: type badge (colour-coded), age/urgency, title, meta, endorsement count (insights only)
- Selected item highlighted

**Displays (work panel — based on selected item type):**

*Critical Insight selected:*
- Breadcrumb, title, overdue flag
- Action buttons: Skip / Reject / Edit / Approve & Share
- Source observations block (anonymised)
- AI draft card: pattern summary, toolbox narrative
- Discussion thread (same as mobile thread view)
- Scope selector: Site / Region / Division / Organisation
- Escalation toggle with AI recommendation
- Legal hold is never shown here — it belongs to investigation sign-off only

*Investigation selected:*
- Incident reference, type, site, occurred at
- Framework fields: immediate cause, contributing factors, root cause, corrective actions — each shows AI suggestion alongside confirmed value
- Sign-off section: cleared_for_sharing toggle, sharing scope, legal hold toggle
- Close & Sign Off button
- "Dispatch Mid-Enquiry" button (if no legal hold)

*Corrective Action selected:*
- Action text, owner, due date, days overdue
- Status update: Mark Complete / Re-assign / Extend deadline
- Note field
- Source investigation reference

*Atrophy Alert selected:*
- Site name, atrophy score, days since last observation
- Assign Manager dropdown
- Dismiss option (with reason)

*Enquiry Draft selected:*
- Question list (preview)
- Dispatch button → navigates to Enquiry Builder

**Displays (context column):**
- Site/region metrics: 2×2 metric tiles
- Event timeline: last 5-6 events related to the selected item
- Related items list: linked observations, investigations, actions, visits

**Writes:**
- `critical_insight`: approve/reject/edit fields
- `investigation`: close + sharing fields
- `corrective_action`: status updates
- `visit_plan`: manager assignment for atrophy alerts

---

### 3.2 Enquiry Builder

**Purpose:** Safety manager reviews AI-recommended questions, adjusts, targets, and dispatches an enquiry.

**Reads:**
- `enquiry` by ID — draft state
- `enquiry_question` WHERE `enquiry_id = $id` — AI-suggested questions ordered by position
- `critical_insight` OR `investigation` by `trigger_id` — source context for the banner
- Site scope options based on trigger: source sites, region sites, division sites

**Displays:**
- Page header: "Enquiry Builder"
- Source context banner (plum): insight or investigation title, narrative excerpt, signal chips
- AI strip: what AI checked before suggesting questions (e.g. "prevalence data already exists from observations — Q3 not needed")
- Question cards (one per question):
  - Position number, question type badge
  - Question text (editable)
  - AI rationale (collapsible)
  - Response preview: option pills showing what supervisors will see
  - Per-question target scope selector: source sites / region / division / org
  - Remove button
- Add custom question card (dashed, tap to expand inline form)
- Right sidebar:
  - Default targeting scope (4 radio options with site count estimates)
  - Response deadline date/time picker
  - Notification preview: exact message supervisors will receive
  - Preview count: "Dispatching N questions to M supervisors across P sites"
  - Dispatch button (primary)
  - Save Draft button

**Writes on Dispatch:**
- `enquiry`: `status = 'active'`, `dispatched_at`, `deadline_at`, `notify_message`
- `enquiry_question`: position, targeting per question
- `enquiry_response` records created for each recipient/question combination
- Queues `enquiry.notify_recipients` job

---

### 3.3 Enquiry Results

**Purpose:** Real-time aggregation of supervisor responses. Safety manager reads synthesis, generates summary, creates actions.

**Reads (polled every 30s while view is open):**
- `enquiry` by ID — status, response count, deadline
- `enquiry_response` WHERE `enquiry_id = $id` — all responses grouped by question
- `enquiry.ai_synthesis` — current AI synthesis snapshot
- `enquiry.summary` — final summary if generated

**Displays:**
- Page header with enquiry title, dispatch date, target summary, live indicator
- 4 stat tiles: response count (of total), critical finding count, process gap count, response rate %
- AI Synthesis card (updates live):
  - Pulse indicator showing it's live
  - 3-4 bulleted findings with signal colour (red/amber/yellow/green)
  - Timestamp of last update and response count at generation
- Per-question result cards:
  - Question text, response count
  - For structured questions (assurance, likelihood, comparative): horizontal bar chart showing distribution
  - For free text questions: AI-extracted themes as chips + response count
- Live response feed:
  - Last 5-10 individual responses as they arrive
  - Per response: avatar, name, site, role, answer summary, timestamp
- Generated Summary card (shown when summary exists or after "Generate Summary" button):
  - Purple header with "What We Learned" title and response count badge
  - Narrative paragraph (AI generated)
  - Recommended actions list
  - Three action buttons: Create Corrective Actions / Generate Toolbox Talk / Export Summary

**Writes:**
- "Generate Summary" button → queues `enquiry.generate_summary` job, polls for result
- "Create Corrective Actions" → creates `corrective_action` records from recommended actions, navigates to workbench
- "Close Enquiry" → `enquiry.status = 'closed'`, `closed_at`, triggers summary generation if not done

---

### 3.4 Analytics — Leading Indicators

**Purpose:** Safety manager and division manager view of leading risk signals. Not for executives.

**Reads:**
- `observation` aggregated: count by week/work_type/observation_type, stop_work_called count, involved_role distribution
- `visit_plan` aggregated: visit coverage % by manager, sites unvisited 30d+
- `site_atrophy_view`: scores per site per week for heatmap
- `critical_insight` aggregated: pending review count, approval rate, avg review latency, trigger_source distribution, fw_domain distribution where classified
- `investigation` aggregated: fw_factor distribution where classified, fw_maturity_signal distribution
- All scoped to `user.scope` and selected period

**Displays:**
- Global controls: scope selector (org/division/region/site), period selector (7d/30d/90d/12m)
- Alert banner if active critical signal (pending insight, high atrophy cluster, near-miss spike)

- 4 stat tiles:
  - Near-miss rate % of all observations (with trend arrow)
  - Stop-work events count (new — sourced from `stop_work_called = true`)
  - Sites atrophy >50 count
  - Manager visit coverage %

- Atrophy heatmap: sites (rows) × weeks (columns), cell colour = observation activity — unchanged

- Forge Works Map® capacity signal (replaces generic failure type donut):
  - Summary view: Guide / Enable / Execute domain distribution — each finding can contribute to multiple domains if multi-factor tagged
  - Detail view (tap/click to expand): which of the 15 factors appear most, ranked by frequency of appearance across all classified findings
  - Per factor: count of appearances, most recent maturity signal, 90-day trend arrow
  - Factor drill-down: tap any factor to see the insights and investigations tagged to it, each showing its per-factor rationale inline — this is the defence view
  - Maturity signal table: for each factor with sufficient data — current predominant maturity signal + trend
  - Only shown when ≥5 classified findings exist — below threshold show "Insufficient data — [N] of 5 needed"

- Work type risk table: incidents, observation volume, talk coverage, insight status, trend, signal per work type — unchanged

- Insight source breakdown (new — small stat below work type table):
  - Of [N] insights this period: [N] algorithm-generated, [N] manual, [N] external alert, [N] external investigation
  - If manual ≥ 40% of total: amber flag "High proportion of manual insights — check observation capture adoption"

**Key:** This view shows what is building — not what already happened. TRIFR and incident counts belong on the Lagging Indicators view. The Forge Works capacity signal requires classified data to accumulate — it improves over time as more insights and investigations are classified.

---

### 3.5 Analytics — Pipeline Health

**Purpose:** Is the intelligence loop actually working? Where do observations get stuck?

**Reads:**
- Pipeline stage counts: observations > enriched > near-miss > insights generated > insights approved > talks generated > talks delivered > crew reached
- Latency per stage: avg time between events
- Drop-off rates per stage
- `critical_insight.trigger_source` distribution for selected period
- `fw_classified_at` coverage: what % of eligible insights/investigations have been classified
- Corrective action close rate

**Displays:**
- Pipeline funnel visualisation: 7 stages, count + conversion rate at each -- unchanged
- Drop-off table: stage, volume in, volume out, drop rate, avg latency, status chip -- unchanged
- Insight source breakdown (new): of [N] insights this period -- algorithm / manual / external alert / external investigation. Amber flag if manual >= 40% -- signals observation capture adoption issue, not a platform failure
- Forge Works Map classification coverage (new): % of closed insights and investigations classified with sufficient confidence. Low coverage means thin narratives or insufficient context -- surfaces that the capacity analysis is still building
- Corrective action summary: open count, overdue count, close rate % -- unchanged

**This is an operational health view -- it answers "is the platform working?" not "is the site safe?"**

---

### 3.6 Board Report / Export

**Purpose:** Generate governance-ready outputs. Not a daily view — used for periodic reporting.

**Reads:**
- Aggregated metrics for selected scope + period
- `enquiry` summaries
- `investigation` closed findings
- `toolbox_talk` delivery records
- Calculated: Safety Culture Index (near-miss rate 40% + talk delivery rate 40% + manager visit coverage 20%)

**Displays:**
- Export format options: Board Slide Deck / Safety Report PDF / Raw Data CSV / Regulatory Package
- AI-generated board narrative (triggers on demand, not pre-generated)
- 3 governance stat tiles: Safety Culture Index, TRIFR, Intelligence Loop Health %
- Key findings from period
- Recommended actions from critical insights and enquiries

**Writes:**
- Export jobs queued on button press
- Board narrative: triggers `report.generate_narrative` AI job

---

## 4. Information Architecture — What Lives Where

### Data that must be available on first load (no interaction required)
- User identity, role, scope — from auth token
- Current site name — from user profile
- Pending talk count — drives home screen badge
- Atrophy scores — drives manager home ordering

### Data loaded on navigation to a view
- Full list data (observations feed, queue items, site list)
- Loaded when the view mounts, not before

### Data loaded on item selection
- Full item detail (insight content, investigation framework, talk content)
- Loaded when user selects an item, not when list loads

### Data that polls
- Enquiry results — polls every 30s while results view is open
- AI synthesis on enquiry results — updates on each new response submission
- Queue item count — polls every 60s (badge count on workbench nav item)

---

## 5. Scope Filtering — How Every Query Is Scoped

Every query that returns data must be filtered to the authenticated user's organisational scope. Scope is resolved server-side from the user record — never from a client-supplied parameter.

```
Supervisor        → worksite_id = user.worksite_id
Manager           → worksite_id IN user.assigned_worksite_ids
Regional Manager  → worksite.region_id = user.region_id
Safety Manager    → resolved recursively from user.scope_type + user.scope_ref_id
Division Manager  → all sites under user.division_id
```

The function `get_user_site_ids(user_id)` resolves this for any user. Every scoped query calls it. See `01-data-model-api-spec.md` Section 4.3.

---

## 6. Open Questions for Architect

1. **Job queue:** What async infrastructure does the platform use? (Redis/BullMQ, SQS, etc.)
2. **Notifications:** What payload format does the existing notification service accept?
3. **Schema:** Dedicated `safety_intelligence` schema or integrate into main?
4. **Auth middleware:** Confirm the role/scope enforcement pattern for new endpoints.
5. **API key management:** Confirm secret management approach for Anthropic API key.
6. **Threshold config:** Should org-level thresholds live in existing settings module or new `org_threshold_config` table?
7. **Hours worked for TRIFR:** Payroll integration or manual input per period?
8. **Photo storage:** What object storage is in use? Enquiry evidence photos need a URL.
9. **Offline support:** What connectivity conditions exist on sites? Offline capture queue required?
10. **Enquiry legal review:** Does the witness enquiry notification require legal team sign-off on wording?

---

## 7. Extended Output Views

### 7.1 Situational Brief — Safety Manager Desktop

**Purpose:** Review and approve an AI-generated brief before it goes to managers. Replaces the manual email a safety manager would otherwise write.

**Reads:**
- `situational_brief` by ID — full generated content
- Source `critical_insight` or `investigation` — for context and verification
- `fw_*` classification fields if available

**Displays:**
- Source reference: insight or investigation that triggered this brief
- Title (editable)
- Four content sections (each editable): What Happened, What It Means, What Is Being Done, Key Questions
- Forge Works Map® classification block if fw_classified_at is set and fw_factors is non-empty:
  - One row per factor in fw_factors array: factor name, domain badge, maturity badge, confidence score
  - Rationale shown inline under each factor tag — fw_rationales[i] under fw_factors[i]
  - fw_classification_basis shown as a single footer note across all tags
  - "No factors met confidence threshold" state if fw_classified_at set but fw_factors empty
- Sharing scope selector (inherits from source, can narrow)
- Approve & Distribute action
- Save Draft / Cancel actions

**Writes on Approve:**
- `situational_brief.status = 'approved'`, `reviewed_by_id`, `reviewed_at`
- Queues `situational_brief.distribute` job

**Location:** Workbench queue — appears as a queue item type after insight approval or investigation close

---

### 7.2 CoP Thread Review — Safety Manager Desktop

**Purpose:** Review AI-generated thread content and room targeting before seeding to the CoP platform.

**Reads:**
- `cop_thread_seed` by ID — generated thread title, body, opening question, suggested tags
- Source insight or investigation for context
- Available CoP rooms (from platform configuration) for targeting

**Displays:**
- Source reference
- Thread preview: title, body, opening question as it will appear in the CoP platform
- Attribution line (auto-generated, not editable): "Generated from CI-042, approved by [name] · [date]"
- Room selector: primary room (pre-selected based on work type), optional secondary room
- Approve & Seed action
- Edit Thread option (opens inline editor for title, body, question)
- Cancel action

**Writes on Approve:**
- `cop_thread_seed.status = 'approved'`, `seeded_by_id`
- Queues `cop_thread.seed` job which calls CoP platform API

---

### 7.3 Visit Briefing Pack — Manager Mobile

**Purpose:** Pre-visit intelligence delivered to the manager's phone. Available from the moment the visit is planned. Transitions to active guide when visit starts.

**Reads:**
- `visit_briefing` by `visit_plan_id` — full generated briefing
- `visit_plan` — planned date, selected topics
- Live update check: if `generated_at` > 48h and `visit_started_at IS NULL`, show stale flag

**Displays — Pre-visit state:**
- Headline (most important thing to know)
- Site reading (honest data interpretation)
- Atrophy score and key metrics tile row
- Focus areas list with source badges and rationale
- Watch for section
- Active Critical Insights relevant to site (brief cards, tap to expand)
- Open corrective actions (owner, due date, days overdue)
- Open investigations (reference, type, age)
- Forge Works Map® signal (capacity factor distribution if data available)
- Last visit summary
- Start Visit button → transitions to active state

**Displays — Active state (after Start Visit tapped):**
- Focus areas become observation prompts in the capture form
- Other sections collapse to quick-reference accordion
- Stale data warning hidden (visit is now underway)
- Active for duration of visit

**Writes:**
- `visit_briefing.viewed_at` on first open (passive — no user action)
- `visit_briefing.visit_started_at` when Start Visit tapped

**Key behaviour:** The briefing is a snapshot. If new intelligence arrives after generation (new near-miss, new insight) the stale flag shows. Manager can pull-to-refresh to regenerate, or proceed with existing briefing. Regeneration runs the same job — < 20s — and the push notification updates.


---

### 7.4 Manual Critical Insight Creation — Safety Manager Desktop

**Purpose:** Safety manager adds an insight directly into the pipeline from an external source or their own field judgement. One shape, source-aware field display.

**Reads:**
- `work_type` — for selector
- `safety_practice` — for selector
- Org scope options based on user's scope

**Displays:**

*Source type selector — shown first, controls what follows:*
- Manual (leadership observation / judgement call)
- External Alert (regulator, industry body, client)
- External Investigation (finding from another system)

*Fields — same for all source types:*
- Work type selector (required)
- Sharing scope selector (required)
- Pattern summary — what is the pattern or finding (required, free text)
- Likely systemic cause — what organisational condition is driving this (required)
- Recommended action — what should change (required)
- Toolbox narrative — what crews need to hear (required; AI assist button available)
- Escalate to systemic toggle

*Source metadata fields — shown based on source type:*

External Alert only:
- Alert title
- Issuing body (regulator, industry body, client name)
- Alert date
- Source URL (optional)

External Investigation only:
- Investigation reference (from source system)
- Source organisation name
- Source system name (optional)
- Summary provided by (name of person who shared it)

Manual only:
- Context note (optional — what prompted this, e.g. "observed during leadership walkthrough")

*AI structuring assist (optional, available for all source types):*
- "Paste source material" input — safety manager pastes raw text (alert content, investigation summary, their own notes)
- "Structure with AI" button — AI reads the pasted text and populates pattern_summary, likely_systemic_cause, recommended_action, and toolbox_narrative fields
- Manager reviews and edits before saving
- This is interactive, not a background job — manager sees the output immediately

**Writes on Save:**
- `critical_insight` record with `trigger_source` set, `cleared_for_toolbox = true`
- `reviewed_by_id = creator`, `review_action = 'approved'`, `reviewed_at = now()`
- Queues `fw_classify` job
- Queues all downstream jobs (talk generation eligibility, situational brief, CoP thread, enquiry draft)

**UI treatment:**
- Manual/external insights show a source badge in the workbench queue and on the toolbox talk provenance line
- Badge text: "External Alert — Safe Work Australia" or "Manual Insight — S. Reyes" or "External Investigation — Client Org"
- Downstream outputs are identical to algorithm-triggered insights — the pipeline doesn't care about trigger source

