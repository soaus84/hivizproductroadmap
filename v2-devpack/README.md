# SafetyPlatform — V2 Design-Ahead Pack

**For:** Development team — read this before finishing V1
**Purpose:** Not a build guide yet. Design-ahead so V1 decisions don't create V2 friction.
**V2 builds on:** V1 Core Loop (E1–E8). Everything here assumes V1 complete and in pilot.
**V2 trigger:** Validation conversations confirm which features convert pilot customers to annual contracts.

---

## What V2 delivers

Six epics that add intelligence depth to the working V1 loop:

| Epic | Feature | Build size |
|------|---------|-----------|
| E8b | Talk delivery obligations | Small — query + UI over V1 data |
| E9 | Structured enquiry — full question types | Medium — extends V1 enquiry tables |
| E10 | Manual & external critical insight entry | Small — new creation path on existing entity |
| E11 | Visit briefing pack | Medium — new entity, new job, new mobile view |
| E12 | Forge Works Map® analytics — full view | Small — new views over V1 classification data |
| E13 | Situational briefs & leadership digest | Medium — new entity, new job, new workbench item |

---

## What V1 must have before V2 starts

- [ ] `fw_classify` job running reliably — `fw_factors[]` parallel arrays accumulating in `critical_insight` and `enquiry`
- [ ] `enquiry_question` and `enquiry_response` tables clean with nullable V2 columns already present
- [ ] `critical_insight.trigger_source` CHECK constraint updated to include `manual | external_alert | external_investigation`
- [ ] `critical_insight.pipeline_stage` column solid — V2 workbench reads from it
- [ ] `worksite_role_slot` and `worksite_slot_assignment` populated for pilot sites
- [ ] `visit_plan.briefing_generated_at` nullable column present (added in V1)
- [ ] `ai_prompt_config` seeded with all V1 prompts — V2 updates prompts via config not code
- [ ] Atrophy score running daily
- [ ] At least 5 classified insights in pilot org — needed to unlock Forge Works analytics view
- [ ] `synthesiseEnquiryResponses(enquiry_id)` written as a named function — V2 extends it

---

## V2 schema additions — delta only

Nothing in V1 is removed or renamed. All changes are additive.

### 1. enquiry_question — activate question type (nullable in V1)

```sql
-- V1 added these columns as nullable. V2 populates them for new questions.
-- V1 questions with question_type = null are treated as free-text throughout V2.
-- Do NOT add NOT NULL constraint — backward compat required.

-- These columns already exist from V1:
-- question_type VARCHAR(30)
-- response_options JSONB
-- requires_note_if VARCHAR(30)
-- allow_photo BOOLEAN DEFAULT false
-- gap_category_options JSONB

-- Valid question_type values (V2):
-- assurance_check        — Is this control/practice in place? Yes/Partially/No
-- likelihood_assessment  — How likely is this condition to occur? Low/Moderate/High
-- prevalence_check       — How common is this across your site? Rare/Sometimes/Often
-- evidence_request       — Please provide evidence (photo, document reference)
-- work_as_done           — Describe what actually happens (free text)
-- gap_identification     — What would need to change? (free text + category tag)
-- comparative_check      — Exists & works / Has gaps / Doesn't exist
```

### 2. enquiry_response — activate structured fields (nullable in V1)

```sql
-- These columns already exist from V1 as nullable:
-- structured_value VARCHAR(50)
-- gap_category VARCHAR(30)
-- photo_url TEXT
-- note TEXT
-- No ALTER TABLE needed in V2.
```

### 3. visit_briefing — new entity

```sql
CREATE TABLE safety_intelligence.visit_briefing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_plan_id   UUID NOT NULL REFERENCES safety_intelligence.visit_plan(id),
  worksite_id     UUID NOT NULL REFERENCES worksite(id),
  manager_id      UUID NOT NULL REFERENCES users(id),

  -- AI-generated content
  headline        TEXT,
  site_reading    TEXT,
  focus_areas     JSONB,      -- [{ topic, rationale, source, evidence }]
  watch_for       TEXT,
  open_items      TEXT,
  fw_context      TEXT,       -- null if < 5 classified findings at site

  -- Point-in-time snapshots
  site_snapshot       JSONB,
  active_insights     JSONB,
  open_actions        JSONB,
  open_investigations JSONB,

  -- State
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at           TIMESTAMPTZ,
  visit_started_at    TIMESTAMPTZ,
  snapshot_expires_at TIMESTAMPTZ,

  CONSTRAINT uniq_visit_briefing UNIQUE (visit_plan_id)
);

CREATE INDEX idx_visit_briefing_manager ON safety_intelligence.visit_briefing(manager_id);
```

Note: `visit_plan.briefing_generated_at` is set when this job completes. That column was added in V1.

### 4. situational_brief — new entity

```sql
CREATE TABLE safety_intelligence.situational_brief (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source  VARCHAR(20) NOT NULL
                  CHECK (trigger_source IN ('critical_insight', 'investigation')),
  trigger_id      UUID NOT NULL,

  -- AI-generated content (human-reviewed before distribution)
  title           TEXT,
  what_happened   TEXT,
  what_it_means   TEXT,
  what_is_being_done TEXT,
  key_questions   JSONB,  -- [{ question: string }] — 2-3 max

  -- Forge Works Map® — inherited from trigger entity's classification arrays
  fw_factors          VARCHAR(40)[],
  fw_domains          VARCHAR(10)[],
  fw_maturity_signals VARCHAR(12)[],
  fw_rationales       TEXT[],

  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'distributed', 'cancelled')),
  reviewed_by_id  UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  distributed_at  TIMESTAMPTZ,
  sharing_scope   VARCHAR(20),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_situational_brief_trigger
  ON safety_intelligence.situational_brief(trigger_source, trigger_id);
```

### 5. talk_delivery_obligation — new entity (E8b)

```sql
CREATE TABLE safety_intelligence.talk_delivery_obligation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id    UUID NOT NULL REFERENCES safety_intelligence.critical_insight(id),
  worksite_id   UUID NOT NULL REFERENCES worksite(id),
  work_type_id  UUID REFERENCES work_type(id),

  due_by        TIMESTAMPTZ NOT NULL,
  -- Set on insight approval: now() + configured window (48h or 7d based on signal severity)

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

### 6. critical_insight — update trigger_source CHECK

```sql
-- V1 has: 'algorithm'
-- V2 adds: 'manual' | 'external_alert' | 'external_investigation'

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

## Prisma schema additions (V2 delta)

```prisma
// Additions to existing V1 models

model VisitPlan {
  // ... existing V1 fields ...
  // briefing_generated_at already added in V1
  briefing VisitBriefing?
}

model EnquiryQuestion {
  // All V2 fields already present as nullable from V1 schema.
  // No Prisma changes needed — just populate the fields.
}

model EnquiryResponse {
  // All V2 fields already present as nullable from V1 schema.
  // No Prisma changes needed.
}

// New V2 models

model VisitBriefing {
  id                  String   @id @default(uuid())
  visit_plan_id       String   @unique
  worksite_id         String
  manager_id          String
  headline            String?
  site_reading        String?
  focus_areas         Json?
  watch_for           String?
  open_items          String?
  fw_context          String?
  site_snapshot       Json?
  active_insights     Json?
  open_actions        Json?
  open_investigations Json?
  generated_at        DateTime @default(now())
  viewed_at           DateTime?
  visit_started_at    DateTime?
  snapshot_expires_at DateTime?

  visit_plan VisitPlan @relation(fields: [visit_plan_id], references: [id])
  manager    User      @relation(fields: [manager_id], references: [id])
  worksite   Worksite  @relation(fields: [worksite_id], references: [id])

  @@map("safety_intelligence.visit_briefing")
}

model SituationalBrief {
  id                 String    @id @default(uuid())
  trigger_source     String
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

  insight  CriticalInsight @relation(fields: [insight_id], references: [id])
  worksite Worksite        @relation(fields: [worksite_id], references: [id])

  @@unique([insight_id, worksite_id])
  @@map("safety_intelligence.talk_delivery_obligation")
  @@index([worksite_id, status])
}
```

---

## Updated async job queue — V2 additions

| Job | Trigger | V2 change |
|-----|---------|-----------|
| `observation.enrich` | Observation synced | — |
| `observation.context_request` | Enrichment confidence < 0.70 | — |
| `observation.context_enrich` | Observer responds to context question | — |
| `critical_insight.generate` | Trend threshold crossed | — |
| `critical_insight.notify_reviewer` | Insight generated | — |
| `critical_insight.notify_endorsers` | pipeline_stage → resolved | — |
| `fw_classify` | Insight approved / Enquiry closed | — |
| `toolbox_talk.generate` | Insight approved | Updated: receives fw_maturity_signals for register |
| `enquiry.generate_questions` | Enquiry created | Updated: receives fw_factors[], fw_rationales[] |
| `enquiry.synthesise` | Response submitted (debounced 30s) | Updated: handles structured responses |
| `enquiry.notify_recipients` | Enquiry dispatched | — |
| `enquiry.reminder` | 24h before deadline | — |
| `enquiry.generate_summary` | Enquiry closed | — |
| `situational_brief.generate` | Insight approved / Investigation closed | **NEW** |
| `situational_brief.distribute` | Brief approved | **NEW** |
| `visit_briefing.generate` | Visit plan created / Atrophy assigned | **NEW** |
| `visit_briefing.notify` | Briefing generated | **NEW** |
| `talk_obligation.set` | Insight approved with sharing_scope | **NEW** (E8b) |
| `talk_obligation.overdue_check` | Daily 02:00 UTC | **NEW** (E8b) |

---

## V2 AI prompt updates

### Prompt 5 — Toolbox Talk Assembly (V2 update)

**What changes:** Receives `fw_maturity_signals[]` from the classified insight.
Narrative register adapts to observed maturity level.

**Addition to user prompt template:**
```
Forge Works Map® maturity signals for this insight:
{{fw_maturity_signals_json}}
// e.g. ["compliant", "compliant"]

Adapt the narrative register:
- compliant → frame around procedure gaps and what the system should specify
- leading   → frame around what managers and supervisors should be noticing
- resilient → frame around adaptive capacity and work-as-done
```

### Prompt 6 — Enquiry Question Generation (V2 update)

**What changes:** Receives `fw_factors[]` array with rationales.
Question types selected per classified factor.

**Factor → question type mapping:**

| FW Factor | Suggested question types |
|-----------|-------------------------|
| `management_systems` | Work as Done, Gap Identification |
| `work_understanding` | Work as Done, Comparative Check |
| `operational_management` | Likelihood Assessment, Assurance Check |
| `frontline_workers` | Assurance Check, Prevalence Check |
| `goal_conflict_tradeoffs` | Likelihood Assessment, Gap Identification |
| `monitoring_metrics` | Comparative Check, Evidence Request |
| `communications_coordination` | Work as Done, Prevalence Check |
| `decision_making` | Likelihood Assessment, Work as Done |
| `contractor_management` | Assurance Check, Comparative Check |
| `learning_development` | Gap Identification, Work as Done |
| `resource_allocation` | Gap Identification, Comparative Check |
| `senior_leadership` | Evidence Request, Work as Done |
| `risk_management` | Assurance Check, Comparative Check |
| `safety_organisation` | Gap Identification, Comparative Check |
| `strategy` | Work as Done, Comparative Check |

**Addition to user prompt template:**
```
Forge Works Map® classifications for this insight:
{{fw_factors_json}}
// [{ factor, domain, maturity_signal, rationale }, ...]

For each classified factor, select the most appropriate question type
and write a question probing that specific organisational capacity gap
at the observed maturity level.

compliant → questions about procedure existence and content gaps
leading   → questions about leadership behaviour and culture
resilient → questions about adaptation, work-as-done, emergent scenarios
```

### Prompt 10 — Situational Brief Generation (V2)

**What changes from V1 cascade note:** The full `fw_factors[]` array is always passed — not a single value. This was already the case in V1 (classifications are always arrays). No special V2 framing needed — just use the arrays.

**Addition to `what_it_means` generation:**
```
For each classified factor in fw_factors[], name it with its rationale:
"This pattern reflects gaps in two organisational capacities: Management Systems
([rationale]) and Operational Management ([rationale])."
Reference both the factor name and the specific evidence — that's what makes
the brief useful to a division manager or board.
```

### Prompt 12 — Visit Briefing Pack Generation (V2)

**Receives:** `fw_signal_json` — aggregated factor frequency from recent site intelligence.

```
Forge Works Map® signal across recent intelligence at this site:
{{fw_signal_json}}
// Aggregated from fw_factors arrays of all relevant insights and enquiries
// [{ factor, domain, maturity_signal, frequency, last_seen }]

Generate fw_context to help the manager understand what to look for:
"Recent intelligence at this site consistently points to [Factor] and [Factor]
gaps — look for [specific observable condition], not just whether controls exist."
```

---

## V2 API additions — delta only

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/insights` | Manual insight creation |
| GET | `/api/visit-briefings/:visit_plan_id` | Briefing for a visit |
| GET | `/api/situational-briefs` | List briefs in scope |
| GET | `/api/situational-briefs/:id` | Brief detail |
| POST | `/api/situational-briefs/:id/approve` | Approve and distribute |
| GET | `/api/obligations` | Talk delivery obligations |
| PATCH | `/api/obligations/:id/not-applicable` | Mark inapplicable |
| GET | `/api/analytics/fw-capacity` | FW Map capacity view (now populated) |
| GET | `/api/analytics/fw-factors/:factor` | Factor drill-down |

---

## What V1 devs should build with V2 in mind

These specific V1 decisions create the least friction for V2:

**1. Enquiry question table — no NOT NULL on question_type**
All V2 columns are already present as nullable in V1. Do not add NOT NULL constraints.
V1 questions have `question_type = null` — treated as free-text throughout V2.

**2. Synthesis job — named function**
Write as `synthesiseEnquiryResponses(enquiry_id)`. V2 extends it for structured response
aggregation and per-question bar chart data. Named function means V2 just extends, not rewrites.

**3. Insight approval job chain — abstract it**
On insight approval: `toolbox_talk.generate` + `enquiry.generate_questions` + `fw_classify` all fire.
V2 adds `situational_brief.generate` + `talk_obligation.set`.
Abstract as `fireInsightApprovalJobs(insight_id)` in V1 — V2 adds to the array.

**4. visit_plan.briefing_generated_at — add in V1**
One nullable column, added in V1 schema. V2 sets it when `visit_briefing.generate` runs.
Already in the V1 Prisma schema — just make sure it's in the migration.

**5. FW analytics endpoint — wire it in V1**
`GET /api/analytics/fw-capacity` returns an empty state in V1 (< 5 classifications).
Build the endpoint in V1 returning empty state data. V2 just populates it.
Don't hardcode the placeholder in the frontend component.

**6. Insight source badge component — build in V1**
`InsightSourceBadge` accepts `trigger_source` and renders the badge.
V1 only shows `algorithm`. V2 passes `manual | external_alert | external_investigation`.
Build the component generic in V1.

**7. Pipeline stage rendering — use pipeline_stage column**
The Kanban board reads `pipeline_stage` directly. Do not derive stage from other fields.
`PATCH /api/insights/:id/stage` writes to this column. Clean and explicit.

**8. Endorser notification — wire it in V1**
`critical_insight.notify_endorsers` fires when `pipeline_stage → resolved`.
The endorsement model and job are V1 features. Make sure the stage transition
correctly enqueues this job.

---

## V2 build sequence (when ready)

Two devs, ~12 weeks post-V1:

**Weeks 1–2:** Schema migrations (ALTER TABLE + new tables), Prisma update, new job definitions.

**Weeks 3–5:** Structured enquiry (E9) — most complex V2 build. Question type model,
updated builder UI, structured response mobile UI, updated synthesis job.

**Weeks 6–7:** Manual insight entry (E10) + AI structuring assist + source badge propagation.

**Weeks 8–9:** Visit briefing pack (E11) — new job, new mobile view, two-state transition
(pre-visit read-only → active visit with capture prompts).

**Weeks 10–11:** Forge Works analytics full view (E12) + situational briefs (E13).

**Week 12:** Talk delivery obligations (E8b) + polish + analytics source breakdown.

---

## Notes for the team

**On structured enquiry:** V1 free-text and V2 structured enquiry share the same tables.
V2 is additive — nullable columns on existing tables. `question_type = null` means free-text.
No breaking changes, no data loss.

**On manual insights:** Creation path is new but the entity is identical. The AI structuring
assist (paste unstructured text → AI structures into fields) is a synchronous call from the
creation form — the manager sees output before saving. Do not make it a background job.

**On FW analytics:** Empty for the first weeks of a pilot — correct behaviour.
The 5-finding threshold is a quality gate. Show the building state clearly:
"2 of 5 classified findings needed to unlock this view."

**On situational briefs:** They appear in the workbench queue as a new item type.
V1 queue handles `insight` and `action` types. V2 adds `situational_brief`.
Build the queue item renderer in V1 to accept a `type` prop generically.
V2 passes a new value — no component rewrite needed.

**On fw_factors arrays — always arrays, never single values:**
Both V1 and V2 use the parallel array structure throughout.
There is no single-value `fw_factor` field anywhere in the current schema.
If you see a scalar `fw_factor` field, it is from an outdated document.
