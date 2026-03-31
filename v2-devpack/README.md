# SafetyPlatform — V2 Design-Ahead Pack

**For:** Development team — read this before finishing V1  
**Purpose:** Not a build guide yet. A design-ahead document so V1 architecture decisions don't create V2 friction.  
**V2 builds on:** V1 Core Loop (E1–E8). Everything here assumes V1 is complete and in pilot.  
**V2 trigger:** Validation conversations confirm which features convert pilot customers to annual contracts.

---

## What V2 delivers

Six epics that add intelligence depth to the working V1 loop:

| Epic | Feature | Build size |
|------|---------|-----------|
| E8b | Talk delivery obligations | Small — query + UI layer over V1 data |
| E9  | Structured enquiry — full question types | Medium — extends V1 enquiry tables |
| E10 | Manual & external critical insight entry | Small — new creation path on existing entity |
| E11 | Visit briefing pack | Medium — new entity, new job, new mobile view |
| E12 | Forge Works Map® analytics — full view | Small — new views over V1 classification data |
| E13 | Situational briefs & leadership digest | Medium — new entity, new job, new workbench item |

---

## What V1 must have in place before V2 starts

This is the checklist. If any of these aren't solid in V1, V2 will be painful.

- [ ] `fw_classify` job running reliably after insight approval — classifications accumulating in `fw_factors[]` arrays
- [ ] `enquiry_question` and `enquiry_response` tables clean — V2 adds columns, not restructures
- [ ] `critical_insight.trigger_source` enum correct — V2 adds `manual` and `external_alert` and `external_investigation`
- [ ] `worksite_role_slot` and `worksite_slot_assignment` populated for pilot sites — V2 assignment UI depends on this
- [ ] `visit_plan` status lifecycle solid — V2 briefing pack reads from it
- [ ] `ai_prompt_config` table seeded with all V1 prompts — V2 updates prompts via config, not code
- [ ] Atrophy score running daily — V2 briefing pack reads the latest score
- [ ] At least 5 classified insights in pilot org — needed to unlock Forge Works analytics view

---

## V2 schema additions — delta only

These are additions to V1 tables and new tables. Nothing in V1 is removed or renamed.

### 1. enquiry_question — add question type

```sql
-- Add to existing enquiry_question table
ALTER TABLE safety_intelligence.enquiry_question
  ADD COLUMN question_type VARCHAR(30)
    CHECK (question_type IN (
      'assurance_check',      -- Is this control/practice in place? Yes/Partially/No
      'likelihood_assessment',-- How likely is this condition to occur? Low/Moderate/High
      'prevalence_check',     -- How common is this across your site? Rare/Sometimes/Often
      'evidence_request',     -- Please provide evidence (photo, document reference)
      'work_as_done',         -- Free text — describe what actually happens
      'gap_identification',   -- What would need to change? Free text + category tag
      'comparative_check'     -- Exists & works / Has gaps / Doesn't exist
    )),
  ADD COLUMN response_options JSONB,
  -- For structured types: [{ value: 'yes', label: 'Yes', is_concern: false }, ...]
  -- NULL for free-text types (work_as_done, gap_identification)
  ADD COLUMN requires_note_if VARCHAR(30),
  -- Value that triggers mandatory note: e.g. 'no' or 'partially'
  -- NULL if no conditional note required
  ADD COLUMN allow_photo BOOLEAN DEFAULT false,
  ADD COLUMN gap_category_options JSONB;
  -- For gap_identification: category tags supervisor can select
  -- e.g. ["People", "Process", "Equipment", "Environment"]
```

### 2. enquiry_response — add structured response fields

```sql
-- Add to existing enquiry_response table
ALTER TABLE safety_intelligence.enquiry_response
  ADD COLUMN structured_value VARCHAR(50),
  -- The selected option value for structured question types
  -- NULL for free-text responses
  ADD COLUMN gap_category VARCHAR(30),
  -- For gap_identification questions: which category the supervisor tagged
  ADD COLUMN photo_url TEXT,
  -- For evidence_request questions or optional photo on assurance failures
  ADD COLUMN note TEXT;
  -- Mandatory note (if requires_note_if triggered) or optional additional context
```

### 3. visit_briefing — new entity

```sql
CREATE TABLE safety_intelligence.visit_briefing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_plan_id   UUID NOT NULL REFERENCES safety_intelligence.visit_plan(id),
  worksite_id     UUID NOT NULL REFERENCES worksite(id),
  manager_id      UUID NOT NULL REFERENCES users(id),

  -- AI-generated content
  headline        TEXT,         -- single most important thing before arriving
  site_reading    TEXT,         -- honest interpretation of what the data shows
  focus_areas     JSONB,        -- [{ topic, rationale, source, evidence }]
  watch_for       TEXT,         -- weak signals worth testing on site
  open_items      TEXT,         -- open actions and investigations summary
  fw_context      TEXT,         -- FW Map signal at this site (nullable if insufficient data)

  -- Snapshots at generation time
  site_snapshot   JSONB,        -- atrophy score, key metrics
  active_insights JSONB,        -- relevant insight summaries
  open_actions    JSONB,        -- corrective action list
  open_investigations JSONB,

  -- State
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at           TIMESTAMPTZ,           -- first open by manager
  visit_started_at    TIMESTAMPTZ,           -- Start Visit tapped
  snapshot_expires_at TIMESTAMPTZ,           -- flag stale after this

  CONSTRAINT fk_visit UNIQUE (visit_plan_id)
  -- one briefing per visit plan
);

CREATE INDEX idx_visit_briefing_manager ON safety_intelligence.visit_briefing(manager_id);
```

### 4. situational_brief — new entity

```sql
CREATE TABLE safety_intelligence.situational_brief (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  trigger_source  VARCHAR(20) NOT NULL
                  CHECK (trigger_source IN ('critical_insight', 'investigation')),
  trigger_id      UUID NOT NULL,

  -- AI-generated content (human-reviewed before distribution)
  title           TEXT,
  what_happened   TEXT,
  what_it_means   TEXT,
  what_is_being_done TEXT,
  key_questions   JSONB,        -- [{ question: string }] — 2-3 max

  -- Forge Works Map® (inherited from trigger entity's classification)
  fw_factors      VARCHAR(40)[],
  fw_domains      VARCHAR(10)[],
  fw_maturity_signals VARCHAR(12)[],
  fw_rationales   TEXT[],

  -- Workflow
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'distributed', 'cancelled')),
  reviewed_by_id  UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  distributed_at  TIMESTAMPTZ,
  sharing_scope   VARCHAR(20),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_situational_brief_trigger ON safety_intelligence.situational_brief(trigger_source, trigger_id);
```

### 5. talk_delivery_obligation — new entity (E8b, lower priority)

```sql
CREATE TABLE safety_intelligence.talk_delivery_obligation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id    UUID NOT NULL REFERENCES safety_intelligence.critical_insight(id),
  worksite_id   UUID NOT NULL REFERENCES worksite(id),
  work_type_id  UUID REFERENCES work_type(id),

  -- Deadline
  due_by        TIMESTAMPTZ NOT NULL,
  -- Set on insight approval: now() + configured window (48h / 7 days based on severity)

  -- Status
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'delivered', 'not_applicable', 'overdue')),
  fulfilled_by_talk_id UUID REFERENCES safety_intelligence.toolbox_talk(id),
  fulfilled_at  TIMESTAMPTZ,
  not_applicable_reason TEXT,
  not_applicable_set_by UUID REFERENCES users(id),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (insight_id, worksite_id)
);

CREATE INDEX idx_obligation_worksite_status
  ON safety_intelligence.talk_delivery_obligation(worksite_id, status);
CREATE INDEX idx_obligation_due
  ON safety_intelligence.talk_delivery_obligation(due_by, status);
```

### 6. critical_insight — add trigger_source values

```sql
-- V1 has: 'algorithm'
-- V2 adds: 'manual' | 'external_alert' | 'external_investigation'
-- No migration needed — CHECK constraint update only

ALTER TABLE safety_intelligence.critical_insight
  DROP CONSTRAINT IF EXISTS critical_insight_trigger_source_check;

ALTER TABLE safety_intelligence.critical_insight
  ADD CONSTRAINT critical_insight_trigger_source_check
  CHECK (trigger_source IN (
    'algorithm',
    'manual',
    'external_alert',
    'external_investigation'
  ));
```

---

## Prisma schema additions

```prisma
// Add to existing EnquiryQuestion model
model EnquiryQuestion {
  // ... existing V1 fields ...

  // V2 additions
  question_type         String?   // assurance_check | likelihood_assessment | etc.
  response_options      Json?     // structured options array
  requires_note_if      String?   // value that triggers mandatory note
  allow_photo           Boolean   @default(false)
  gap_category_options  Json?
}

// Add to existing EnquiryResponse model
model EnquiryResponse {
  // ... existing V1 fields ...

  // V2 additions
  structured_value  String?   // selected option for structured types
  gap_category      String?   // tagged category for gap_identification
  photo_url         String?
  note              String?
}

// New V2 models
model VisitBriefing {
  id              String   @id @default(uuid())
  visit_plan_id   String   @unique
  worksite_id     String
  manager_id      String
  headline        String?
  site_reading    String?
  focus_areas     Json?
  watch_for       String?
  open_items      String?
  fw_context      String?
  site_snapshot   Json?
  active_insights Json?
  open_actions    Json?
  open_investigations Json?
  generated_at    DateTime @default(now())
  viewed_at       DateTime?
  visit_started_at DateTime?
  snapshot_expires_at DateTime?

  visit_plan VisitPlan @relation(fields: [visit_plan_id], references: [id])
  manager    User      @relation(fields: [manager_id], references: [id])
  worksite   Worksite  @relation(fields: [worksite_id], references: [id])

  @@map("safety_intelligence.visit_briefing")
}

model SituationalBrief {
  id                 String    @id @default(uuid())
  trigger_source     String    // critical_insight | investigation
  trigger_id         String
  title              String?
  what_happened      String?
  what_it_means      String?
  what_is_being_done String?
  key_questions      Json?
  fw_factors         String[]
  fw_domains         String[]
  fw_maturity_signals String[]
  fw_rationales      String[]
  status             String    @default("draft")
  reviewed_by_id     String?
  reviewed_at        DateTime?
  distributed_at     DateTime?
  sharing_scope      String?
  created_at         DateTime  @default(now())

  reviewed_by User? @relation(fields: [reviewed_by_id], references: [id])

  @@map("safety_intelligence.situational_brief")
  @@index([trigger_source, trigger_id])
}

model TalkDeliveryObligation {
  id                    String    @id @default(uuid())
  insight_id            String
  worksite_id           String
  work_type_id          String?
  due_by                DateTime
  status                String    @default("pending")
  fulfilled_by_talk_id  String?
  fulfilled_at          DateTime?
  not_applicable_reason String?
  not_applicable_set_by String?
  created_at            DateTime  @default(now())

  insight   CriticalInsight @relation(fields: [insight_id], references: [id])
  worksite  Worksite        @relation(fields: [worksite_id], references: [id])

  @@unique([insight_id, worksite_id])
  @@map("safety_intelligence.talk_delivery_obligation")
  @@index([worksite_id, status])
}
```

---

## Updated async job queue — V2 additions

| Job | Trigger | Target latency | New in V2 |
|-----|---------|----------------|-----------|
| `observation.enrich` | Observation created | < 5s | — |
| `investigation.assist` | Investigation created | < 10s | — |
| `investigation.generate_narrative` | Investigation closed + cleared | < 10s | — |
| `critical_insight.generate` | Trend threshold crossed | < 15s | — |
| `critical_insight.notify_reviewer` | Insight generated | immediate | — |
| `enquiry.generate_questions` | Enquiry created | < 15s | Updated: receives fw_factors |
| `enquiry.synthesise` | Response submitted (debounced 30s) | < 5s | Updated: handles structured responses |
| `enquiry.notify_recipients` | Enquiry dispatched | immediate | — |
| `enquiry.reminder` | 24h before deadline | scheduled | — |
| `enquiry.generate_summary` | Enquiry closed | < 20s | — |
| `enquiry.notify_completion` | Summary generated | immediate | — |
| `fw_classify` | Insight approved / Investigation closed / Enquiry summary | < 10s | — |
| `situational_brief.generate` | Insight approved / Investigation closed | < 15s | **NEW** |
| `situational_brief.distribute` | Brief approved | immediate | **NEW** |
| `visit_briefing.generate` | Visit plan created / Atrophy assigned | < 20s | **NEW** |
| `visit_briefing.notify` | Briefing generated | immediate | **NEW** |
| `talk_obligation.set` | Insight approved with sharing_scope | < 5s | **NEW** (E8b) |
| `talk_obligation.overdue_check` | Daily 02:00 UTC | scheduled | **NEW** (E8b) |

---

## Updated AI prompts — V2 changes only

### Prompt 4 — Enquiry Question Generation (V2 update)

**What changes:** Receives `fw_factors`, `fw_domains`, `fw_maturity_signals`, `fw_rationales` from the classified insight. Question types now selected per classified factor.

**Factor → question type mapping:**

| FW Factor (examples) | Suggested question types |
|---------------------|------------------------|
| `management_systems` | Assurance Check, Work as Done, Gap Identification |
| `work_understanding` | Work as Done, Comparative Check |
| `operational_management` | Likelihood Assessment, Assurance Check |
| `frontline_workers` | Assurance Check, Prevalence Check |
| `goal_conflict_tradeoffs` | Likelihood Assessment, Gap Identification |
| `monitoring_metrics` | Comparative Check, Evidence Request |

**Updated user prompt template addition:**
```
Forge Works Map® classifications for this insight:
{{fw_factors_json}}
// [{ factor, domain, maturity_signal, rationale }]

For each classified factor, select the most appropriate question type
and write a question that probes that specific organisational capacity gap
at the observed maturity level.

Compliant maturity → questions about procedure existence and content
Leading maturity → questions about leadership behaviour and culture
Resilient maturity → questions about adaptation and work-as-done
```

### Prompt 3 — Toolbox Talk Assembly (V2 update)

**What changes:** Receives `fw_maturity_signals` — narrative register adapts to maturity level.

**Updated user prompt template addition:**
```
Forge Works Map® maturity signals for this insight:
{{fw_maturity_signals_json}}
// e.g. ["compliant", "compliant"]

Adapt the narrative register to the maturity level:
- compliant → frame around procedure gaps and what the system should specify
- leading → frame around what managers and supervisors should be noticing
- resilient → frame around adaptive capacity and anticipating emergent risk
```

### Prompt 10 — Situational Brief (V2 — multi-factor aware)

**What changes:** Receives full `fw_factors[]` array with rationales instead of single factor.

**Updated system prompt addition:**
```
You receive a Forge Works Map® classification array — potentially multiple factors.
In the 'what_it_means' section name each classified factor with its rationale:
"This pattern reflects gaps in two organisational capacities: [Factor 1]
([rationale]) and [Factor 2] ([rationale])."
This makes the brief useful to a division manager or board — not just a label.
```

### Prompt 12 — Visit Briefing Pack (V2 — multi-factor aware)

**What changes:** `fw_context` field now references all factors appearing at a site across recent intelligence.

**Updated user prompt template addition:**
```
Forge Works Map® signal across recent intelligence at this site:
{{fw_signal_json}}
// Aggregated from fw_factors arrays of all relevant insights and investigations
// [{ factor, domain, maturity_signal, frequency, last_seen }]

Generate fw_context to help the manager understand what the capacity signal
tells them about what to look for on site — specific, not generic.
"Recent intelligence at this site consistently points to [Factor] and [Factor]
gaps — look for [specific observable condition], not just whether controls exist."
```

---

## V2 API additions — delta only

| Method | Route | Description | New in V2 |
|--------|-------|-------------|-----------|
| POST | `/api/insights` | Manual insight creation | **NEW** |
| GET | `/api/visit-briefings/:visit_plan_id` | Briefing for a visit | **NEW** |
| GET | `/api/situational-briefs` | List briefs in scope | **NEW** |
| GET | `/api/situational-briefs/:id` | Brief detail | **NEW** |
| POST | `/api/situational-briefs/:id/approve` | Approve and distribute | **NEW** |
| GET | `/api/obligations` | Talk delivery obligations | **NEW** (E8b) |
| PATCH | `/api/obligations/:id/not-applicable` | Mark inapplicable | **NEW** (E8b) |
| GET | `/api/analytics/fw-capacity` | FW Map capacity view data | **NEW** |
| GET | `/api/analytics/fw-factors/:factor` | Factor drill-down | **NEW** |

---

## V2 wireframe pages

### Enquiry Builder — structured questions

**What changes from V1:** Question cards now show type badge, response options preview, per-question scope targeting. AI rationale shown inline under each question.

**Key data displayed per question card:**
```typescript
{
  position: number
  question_type: string           // badge — Assurance Check, Work as Done etc.
  question_text: string
  ai_rationale: string            // why this question — shown inline, not in tooltip
  response_options: Option[]      // shown as preview chips: Yes / Partially / No
  requires_note_if: string        // "mandatory note if: No"
  allow_photo: boolean
  target_scope: string            // which sites/roles
}
```

**Reads:** `GET /api/enquiries/:id/questions` (with full V2 fields)  
**Writes:** `POST /api/enquiries/:id/dispatch`

---

### Visit Briefing — mobile, two states

**Pre-visit state reads:**
```typescript
VisitBriefing {
  headline           // shown at top — most important thing before arriving
  site_reading       // honest data interpretation
  focus_areas[]      // { topic, rationale, source, evidence } with source badge
  watch_for          // weak signals section
  open_items         // actions and investigations summary
  fw_context         // capacity signal (null if < 5 classified findings)
  site_snapshot      // atrophy score, days since last obs, near-miss count
  active_insights[]  // insight cards — tap to expand
  open_actions[]     // { description, assigned_to, due_date, days_overdue }
  snapshot_expires_at // stale flag threshold
}
```

**Active state (after Start Visit):**
- `focus_areas` → become capture prompts above observation text field
- All other sections → collapse to quick-reference accordion
- `visit_started_at` written on transition

---

### Situational Brief — workbench review

**Appears in workbench queue** after insight approval or investigation close.

**Key display:**
```typescript
SituationalBrief {
  title            // editable
  what_happened    // editable — pattern or incident in plain language
  what_it_means    // editable — FW factor names + rationales shown here
  what_is_being_done // editable — corrective actions, enquiry launched
  key_questions[]  // 2-3 questions for managers to reflect on
  fw_factors[]     // each shown with domain badge + rationale inline
  sharing_scope    // selector bounded by safety manager's own scope
}
```

**Actions:** Approve & Distribute | Save Draft | Cancel

---

### Forge Works Map® Analytics — full view

**Domain summary (pie/proportional bar):**
- Source: `SELECT fw_domains, COUNT(*) FROM critical_insight WHERE fw_classified_at IS NOT NULL GROUP BY unnest(fw_domains)`
- Only shown if ≥ 5 classified findings

**Factor detail table:**
```typescript
{
  factor: string           // e.g. "management_systems"
  domain: string           // enable
  appearance_count: number // across all classified insights + investigations
  current_maturity: string // most recent fw_maturity_signal for this factor
  trend_90d: string        // improving | stable | declining
}
```

**Factor drill-down (tap any factor row):**
- List of insights and investigations tagged to this factor
- Each showing: title, date, fw_confidence, fw_rationale inline
- The rationale is the defence — this is where "why was this tagged?" gets answered

**Insight source breakdown (below analytics):**
```typescript
{
  algorithm: number
  manual: number
  external_alert: number
  external_investigation: number
  manual_pct: number  // amber flag if >= 40%
}
```

---

### Manual Insight Creation — desktop form

**Source type selector drives which metadata fields appear:**

```typescript
// All source types share:
{
  work_type_id: string
  sharing_scope: string
  pattern_summary: string        // + ai_structuring_assist button
  likely_systemic_cause: string
  recommended_action: string
  toolbox_narrative: string
  escalate_to_systemic: boolean
}

// external_alert adds:
{
  alert_title: string
  issuing_body: string
  alert_date: Date
  source_url?: string
}

// external_investigation adds:
{
  investigation_ref: string
  source_org: string
  source_system?: string
  summary_provided_by: string
}

// manual adds:
{
  context_note?: string  // "observed during leadership walkthrough"
}
```

**AI structuring assist:** Synchronous call — not a background job. Manager pastes unstructured text, AI returns populated fields, manager edits before save.

**On save:** `cleared_for_toolbox = true` immediately (creator = reviewer). Queues `fw_classify`, `toolbox_talk.generate`, `enquiry.generate_questions`, `situational_brief.generate`.

---

## What V1 devs should build with V2 in mind

These are the specific V1 decisions that create the least friction for V2:

**1. Enquiry question table — no type enforcement in V1, but leave the column**
Don't add a NOT NULL constraint to `question_type` in V1. Leave it nullable. V2 will populate it for all new questions — V1 questions will have `question_type = null` which is handled gracefully.

**2. Enquiry synthesis job — write it as a function, not inline**
The synthesis logic gets more complex in V2 (structured response aggregation, bar chart data per question type). Write it as a named function in V1 — `synthesiseEnquiryResponses(enquiry_id)` — so V2 can extend it cleanly.

**3. Critical insight creation — abstract the post-approval job chain**
On insight approval, multiple jobs fire: `toolbox_talk.generate`, `enquiry.generate_questions`, `fw_classify`. V2 adds `situational_brief.generate` and `talk_obligation.set` to that chain. Abstract the chain into `fireInsightApprovalJobs(insight_id)` in V1 so V2 just adds to the array.

**4. Visit plan — add `briefing_generated_at` nullable column in V1**
One column, no cost. V2 sets it when the briefing job runs. V1 leaves it null. No migration needed in V2.

**5. FW analytics placeholder — wire up the real query endpoint in V1**
The V1 analytics page shows a placeholder when < 5 classified findings. Wire the actual API endpoint `GET /api/analytics/fw-capacity` in V1 returning an empty state — V2 just populates it. Don't hardcode the placeholder in the frontend.

**6. Insight source badge — build the component in V1**
The source badge (algorithm / manual / external alert / external investigation) is needed in V2 but the algorithm type is all V1 will show. Build the `InsightSourceBadge` component in V1 that accepts `trigger_source` and renders the right badge. V2 just passes different values.

---

## V2 build sequence (when ready)

Two devs, ~12 weeks post-V1:

**Weeks 1–2:** Schema migrations (ALTER TABLE statements above), Prisma schema update, new job definitions added to queue.

**Weeks 3–5:** Structured enquiry (E9) — most complex V2 build. Question type model, updated builder UI, structured response mobile UI, updated synthesis job.

**Weeks 6–7:** Manual insight entry (E10) + AI structuring assist + source badge propagation.

**Weeks 8–9:** Visit briefing pack (E11) — new job, new mobile view, two-state transition.

**Weeks 10–11:** Forge Works analytics full view (E12) + situational briefs (E13).

**Week 12:** Talk delivery obligations (E8b, if prioritised) + polish + analytics source breakdown.

---

## Notes for the team

**On structured enquiry:** The V1 free-text enquiry and the V2 structured enquiry share the same tables. V2 is additive — nullable columns on existing tables, no data loss, no breaking API changes. V1 questions with `question_type = null` are treated as free-text throughout V2.

**On manual insights:** The creation path is new but the entity is identical. The most important constraint: the AI structuring assist is a synchronous call from the creation form — the manager sees the output before it saves. Do not make it a background job. The manager needs to review and edit the AI output before the insight enters the pipeline.

**On the FW analytics view:** It will be empty for the first weeks of a pilot. That's correct. The 5-finding threshold is a quality gate, not an arbitrary number. Below it the data isn't reliable enough to show trends. Show the building state clearly — "2 of 5 classified findings" — so safety managers understand what's accumulating.

**On situational briefs:** They appear in the workbench queue as a new item type. The queue in V1 only has `insight` and `action` types. V2 adds `situational_brief`. Build the queue item renderer in V1 to accept a `type` prop and render generically — V2 just passes a new type value.
