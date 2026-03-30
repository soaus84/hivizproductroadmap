# Data Model & API Specification

**Hiviz — Toolbox Talk Intelligence Module**  
Version: 0.4-draft  
Status: For architect review

---

## 1. Design Principles

- **Existing taxonomies are referenced, never duplicated.** `work_type_id` and `practice_id` are foreign keys into your existing taxonomy tables.
- **Org hierarchy is inherited.** All entities resolve their org context via `worksite_id` traversal up through region → division → organisation.
- **Minimal fields only.** Every field must justify its presence by driving a communication, learning, or improvement outcome.
- **Separation of capture and sharing.** `cleared_for_sharing` is an explicit flag — never inferred. Investigations default to `false`; observations default to `true`.
- **Legal hold is a hard override.** `legal_hold = true` blocks all sharing pipelines regardless of other flags.
- **Every AI suggestion has a companion reason.** No AI output field exists without a corresponding rationale field stored alongside it. `ai_suggested_x` always has `ai_suggested_x_rationale`. This is a trust and liability principle: the platform surfaces AI outputs as suggestions with visible reasoning, never as recommendations or directives. The human reviewer sees the why, engages with it, and owns the decision. AI fields named `ai_suggested_*` are suggestions. Fields without that prefix are human-confirmed. This distinction must be preserved in the UI — suggestion framing language throughout, reasoning always visible inline, never buried.
- **AI suggestion language standard.** Across all UI surfaces: use "suggested" not "recommended", "AI has identified" not "AI determined", "based on" not "because", "for your review" not as a directive. The safety professional makes the call — the AI makes the case.

---

## 2. Existing Entities (Referenced, Not Modified)

These entities already exist in your platform. The new module references them via foreign key only.

```
Organisation
  └── Division
        └── SubDivision (BusinessUnit)
              └── Region
                    └── Worksite               ← primary anchor for all new entities

WorkType                                        ← high-risk work taxonomy (Hot Work, Blasting, etc.)
                                                  V5 note: add has_critical_controls BOOLEAN DEFAULT false
                                                  to WorkType in V1 migration. Costs nothing now, avoids
                                                  schema changes when the Risk Assurance module ships.
SafetyPractice                                  ← safety practice taxonomy (PTW, Incident Investigation, etc.)
User                                            ← existing user/identity model
```

---

## 3. New Entities

### 3.0 Worksite Personnel — Role Slots & Assignments

Defines which users are associated with a worksite in which capacity. Drives notification routing, enquiry assignment, corrective action assignment, and (V5) control verification scheduling. Slots are platform-defined. Assignments are managed by safety managers or division managers in site settings.

```sql
CREATE TABLE safety_intelligence.worksite_role_slot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksite_id UUID NOT NULL REFERENCES worksite(id),
  role        VARCHAR(30) NOT NULL
              CHECK (role IN (
                'supervisor',           -- delivers talks, logs observations, responds to enquiries, checks off actions
                'manager',              -- visit workflow, atrophy oversight, can be assigned actions
                'safety_professional',  -- higher-level enquiries, safety expertise actions, investigation support
                'control_verifier'      -- V5: assigned critical controls to verify on clockwork schedule
                                        -- may be supervisor, safety professional, or a dedicated assurance role
                                        -- separate slot because verification accountability is distinct
              )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (worksite_id, role)  -- one slot per role per worksite
);

CREATE TABLE safety_intelligence.worksite_slot_assignment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       UUID NOT NULL REFERENCES safety_intelligence.worksite_role_slot(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  assigned_by   UUID NOT NULL REFERENCES users(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        VARCHAR(10) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  -- inactive when person leaves role or site — history preserved, not deleted
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES users(id),

  UNIQUE (slot_id, user_id, status)  -- one active assignment per user per slot
);

-- V5 note: control_verifier slot drives verification assignment and scheduling.
-- When a critical control has a verification due, the platform routes it to the
-- user(s) in the control_verifier slot for that worksite. If no control_verifier
-- is assigned, falls back to safety_professional slot, then supervisor slot.
-- A user can be in the control_verifier slot at multiple worksites — their
-- verification queue spans all assigned sites, each item clearly site-labelled.
-- Verification clockwork (shift_start | daily | weekly | monthly | one_off |
-- event_triggered) is defined on the control record and scheduled against the
-- assigned verifier(s) at each worksite.

CREATE INDEX idx_slot_worksite ON safety_intelligence.worksite_role_slot(worksite_id);
CREATE INDEX idx_assignment_slot ON safety_intelligence.worksite_slot_assignment(slot_id, status);
CREATE INDEX idx_assignment_user ON safety_intelligence.worksite_slot_assignment(user_id, status);
```

**What each slot drives:**

| Slot | Notification routing | Assignment eligibility | V5 |
|------|---------------------|----------------------|-----|
| supervisor | Talk ready, enquiry assigned, action assigned | Enquiry response, corrective action check-off | Tier 1 verification fallback |
| manager | Atrophy alert, visit briefing | Corrective actions (management level) | — |
| safety_professional | Insight notifications (site scope), notifiable incident flag | Higher-level enquiries, investigation support actions | Tier 2/3 verification fallback |
| control_verifier | Verification due (V5), overdue verification alert (V5) | Critical control verification assignment (V5) | Primary verifier |

**A user can be assigned to the same slot at multiple worksites.** Their obligation queue (talks, enquiries, actions, verifications) spans all sites they're assigned to. Every item is clearly labelled with its worksite so the cross-site picture is always readable.

**Assignment is managed by safety managers or division managers** in worksite settings — not by the users themselves. Status is set inactive when someone leaves a role or site; a new assignment is created for their replacement. History is preserved.

---

### 3.1 Observation

Captures supervisor and manager field observations.

```sql
CREATE TABLE observation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  observer_id           UUID NOT NULL REFERENCES users(id),
  observer_role         VARCHAR(20) NOT NULL CHECK (observer_role IN ('supervisor', 'manager')),
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  observed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Classification (existing taxonomy refs)
  work_type_id          UUID REFERENCES work_type(id),
  practice_id           UUID REFERENCES safety_practice(id),          -- nullable
  observation_type      VARCHAR(20) NOT NULL CHECK (observation_type IN ('safe', 'at-risk', 'near-miss')),

  -- Content
  what_was_observed     TEXT NOT NULL,
  immediate_action_taken TEXT,                                         -- nullable
  people_involved_count INTEGER DEFAULT 0,
  stop_work_called      BOOLEAN DEFAULT false,                         -- "Did you stop the work?"
  involved_role         VARCHAR(20)                                    -- role of person(s) involved
                          CHECK (involved_role IN (
                            'employee','operator','subcontractor','visitor','unknown'
                          )),
  photo_url             TEXT,                                          -- optional evidence photo

  -- AI enrichment (populated async after submission)
  ai_failure_type       VARCHAR(30) CHECK (ai_failure_type IN ('systemic', 'behavioural', 'environmental', 'unclear')),
  ai_severity_signal    VARCHAR(20),
  ai_key_hazard         TEXT,
  ai_enrichment_confidence DECIMAL(3,2),
  ai_anonymisation_flags JSONB,                                        -- array of flagged phrases
  ai_inferred_work_type_ids JSONB,                                     -- array of UUIDs
  ai_inferred_practice_ids  JSONB,                                     -- array of UUIDs
  ai_enriched_at        TIMESTAMPTZ,

  -- Sharing controls
  cleared_for_sharing   BOOLEAN NOT NULL DEFAULT true,
  sharing_scope         VARCHAR(20) NOT NULL DEFAULT 'site'
                          CHECK (sharing_scope IN ('site', 'region', 'division', 'organisation')),

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_observation_worksite ON observation(worksite_id);
CREATE INDEX idx_observation_work_type ON observation(work_type_id);
CREATE INDEX idx_observation_type_observed ON observation(observation_type, observed_at);
```

---

### 3.2 Incident

Records incidents at worksite level.

```sql
CREATE TABLE incident (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  reported_by_id        UUID NOT NULL REFERENCES users(id),
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  occurred_at           TIMESTAMPTZ NOT NULL,
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Classification
  work_type_id          UUID REFERENCES work_type(id),
  practice_id           UUID REFERENCES safety_practice(id),          -- nullable
  incident_type         VARCHAR(30) NOT NULL
                          CHECK (incident_type IN ('near-miss', 'injury', 'property-damage', 'environmental')),

  -- Content
  description           TEXT NOT NULL,
  people_involved_count INTEGER DEFAULT 0,

  -- Injury classification (conditional — shown when incident_type = 'injury')
  injury_classification VARCHAR(20)
                          CHECK (injury_classification IN (
                            'first_aid',          -- treated on site, returned to normal duties
                            'medical_treatment',  -- required treatment beyond first aid
                            'restricted_work',    -- modified duties only
                            'lost_time',          -- cannot perform normal duties
                            'fatality'            -- requires confirmation flow in UI
                          )),
  body_part_affected    VARCHAR(30),              -- conditional on injury_classification >= medical_treatment
  nature_of_injury      VARCHAR(30)               -- laceration / fracture / strain / burn / crush / exposure / other
                          CHECK (nature_of_injury IN (
                            'laceration','fracture','strain_sprain','burn',
                            'crush','exposure','concussion','other'
                          )),
  mechanism_of_injury   VARCHAR(30)               -- how the injury occurred
                          CHECK (mechanism_of_injury IN (
                            'fall_from_height','fall_same_level','struck_by_object',
                            'caught_in_equipment','manual_handling','vehicle_contact',
                            'exposure_substance','exposure_environment','other'
                          )),
  site_location_type    VARCHAR(20)               -- where on site
                          CHECK (site_location_type IN (
                            'ground_level','elevated','confined_space',
                            'vehicle','plant_room','perimeter','other'
                          )),

  -- Timing
  discovered_at         TIMESTAMPTZ,              -- nullable; if different from occurred_at
                                                   -- "I don't know exactly when" sets a flag instead

  -- Regulatory notification
  -- Assessed by triage logic post-submission based on injury_classification and incident_type
  -- Jurisdiction-specific rules configured at org level
  notifiable_flag       BOOLEAN DEFAULT false,    -- set by triage if potentially notifiable
  notifiable_confirmed_at TIMESTAMPTZ,            -- when safety manager reviewed the flag
  notifiable_confirmed_by UUID REFERENCES users(id),
  notifiable_dismissed  BOOLEAN DEFAULT false,    -- true if safety manager determined not notifiable

  -- Future: regulatory_report_id FK when report module is built
  -- regulatory_report_id UUID REFERENCES regulatory_report(id)

  -- Investigation routing
  requires_investigation BOOLEAN NOT NULL DEFAULT false,              -- set by triage algorithm
  investigation_id      UUID REFERENCES investigation(id),            -- nullable; set when investigation created

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_worksite ON incident(worksite_id);
CREATE INDEX idx_incident_type ON incident(incident_type, occurred_at);
```

---

### 3.3 Investigation

Opinionated investigation framework. Created automatically when triage algorithm fires.

```sql
CREATE TABLE investigation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           UUID NOT NULL REFERENCES incident(id),

  -- Workflow state
  status                VARCHAR(20) NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'closed', 'escalated')),
  assigned_to_id        UUID REFERENCES users(id),
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ,

  -- Framework fields (AI-assisted, human-confirmed)
  immediate_cause       TEXT,
  contributing_factors  JSONB,                                        -- array of strings
  root_cause            TEXT,
  corrective_actions    JSONB,                                        -- array of strings

  -- AI assistance metadata
  -- Each suggestion field has a companion rationale field — see design principle 6.
  -- Rationale fields store why the AI suggested each item, surfaced inline in the UI.
  ai_suggested_contributing_factors          JSONB,   -- [{ factor: string, rationale: string }]
  ai_suggested_contributing_factors_rationale TEXT,   -- overall basis for the contributing factor set
  ai_suggested_root_cause                    TEXT,
  ai_suggested_root_cause_rationale          TEXT,    -- what in the narrative led to this root cause
  ai_suggested_corrective_actions            JSONB,   -- [{ action: string, rationale: string }]
  ai_suggested_interview_questions           JSONB,   -- [{ question: string, rationale: string }]
  ai_assisted_at                             TIMESTAMPTZ,

  -- AI-generated toolbox narrative (populated after closed + cleared)
  toolbox_narrative     TEXT,
  toolbox_narrative_generated_at TIMESTAMPTZ,

  -- Sharing controls
  cleared_for_sharing   BOOLEAN NOT NULL DEFAULT false,               -- must be explicitly set
  sharing_scope         VARCHAR(20) CHECK (sharing_scope IN ('site', 'region', 'division', 'organisation')),
  legal_hold            BOOLEAN NOT NULL DEFAULT false,               -- hard block on all sharing

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by_id          UUID REFERENCES users(id)
);

CREATE INDEX idx_investigation_incident ON investigation(incident_id);
CREATE INDEX idx_investigation_status ON investigation(status);
```

---

### 3.4 CriticalInsight

Generated entity. Created by the trend detection algorithm + AI synthesis. Not directly captured by humans.

```sql
CREATE TABLE critical_insight (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trigger source — one shape, source-aware field population
  trigger_source        VARCHAR(30) NOT NULL DEFAULT 'algorithm'
                          CHECK (trigger_source IN (
                            'algorithm',            -- trend detection crossed threshold (default)
                            'manual',               -- safety manager entered directly
                            'external_alert',       -- regulator / industry body / client alert
                            'external_investigation'-- finding from investigation in another system
                          )),

  -- Source data (populated for algorithm-triggered; null for manual/external)
  source_observation_ids   JSONB,                  -- array of observation UUIDs
  source_investigation_ids JSONB,                  -- array of investigation UUIDs
  trigger_event            JSONB,                  -- algorithm trigger metadata (threshold, window etc)

  -- Source metadata (populated for manual/external; null for algorithm)
  -- Structure varies by trigger_source — see source_metadata shapes below
  source_metadata          JSONB,

  -- Org scope
  generated_at_level    VARCHAR(20) NOT NULL
                          CHECK (generated_at_level IN ('site', 'region', 'division', 'organisation')),
  scope_ref_id          UUID NOT NULL,

  -- Taxonomy context
  work_type_id          UUID REFERENCES work_type(id),
  practice_id           UUID REFERENCES safety_practice(id),

  -- Content — same fields regardless of trigger_source
  -- For algorithm: AI-drafted then human-reviewed
  -- For manual/external: human-authored directly (AI can assist structuring)
  pattern_summary       TEXT,
  likely_systemic_cause TEXT,
  recommended_action    TEXT,
  toolbox_narrative     TEXT,
  escalate_to_systemic  BOOLEAN DEFAULT false,
  escalation_rationale  TEXT,
  ai_generated_at       TIMESTAMPTZ,              -- null if human-authored directly

  -- Human review
  -- For algorithm: required gate before cleared_for_toolbox
  -- For manual/external: creation IS review — reviewed_by = creator, review_action = 'approved' on save
  reviewed_by_id        UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  review_action         VARCHAR(20) CHECK (review_action IN ('approved', 'edited', 'rejected')),
  reviewer_notes        TEXT,

  -- Sharing controls
  cleared_for_toolbox   BOOLEAN NOT NULL DEFAULT false,
  sharing_scope         VARCHAR(20) CHECK (sharing_scope IN ('site', 'region', 'division', 'organisation')),

  -- Systemic escalation
  systemic_investigation_id UUID,

  -- Forge Works Map® Classification (same for all trigger sources)
  fw_factor              VARCHAR(40),
  fw_domain              VARCHAR(10)    CHECK (fw_domain IN ('guide','enable','execute')),
  fw_maturity_signal     VARCHAR(12)    CHECK (fw_maturity_signal IN ('compliant','leading','resilient')),
  fw_confidence          DECIMAL(3,2),
  fw_rationale           TEXT,
  fw_classification_basis TEXT,
  fw_classified_at       TIMESTAMPTZ,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- source_metadata shapes by trigger_source:
--
-- algorithm:
--   { "observation_count": 6, "site_count": 4, "threshold": 5, "window_days": 30 }
--
-- manual:
--   { "authored_by_role": "Safety Manager",
--     "context": "Observed during leadership walkthrough — below threshold but warranted" }
--
-- external_alert:
--   { "alert_title": "...", "alert_url": "https://...",
--     "issuing_body": "Safe Work Australia", "alert_date": "2026-03-15" }
--
-- external_investigation:
--   { "investigation_ref": "INC-2026-047", "source_org": "Client Org Name",
--     "system": "Cintellate", "summary_provided_by": "J. Smith" }

CREATE INDEX idx_critical_insight_level ON critical_insight(generated_at_level, scope_ref_id);
CREATE INDEX idx_critical_insight_work_type ON critical_insight(work_type_id);
CREATE INDEX idx_critical_insight_cleared ON critical_insight(cleared_for_toolbox);
```

---

### 3.5 ToolboxTalk

The assembled talk. Content is resolved at generation time and stored for the record.

```sql
CREATE TABLE toolbox_talk (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  presenter_id          UUID NOT NULL REFERENCES users(id),
  work_type_id          UUID REFERENCES work_type(id),               -- today's primary work type
  scheduled_for         TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,

  -- Content sources (resolved by algorithm at generation time)
  observation_ids       JSONB,                                        -- array of UUIDs
  investigation_ids     JSONB,                                        -- array of UUIDs
  critical_insight_ids  JSONB,                                        -- array of UUIDs

  -- AI-generated content
  generated_content     JSONB,                                        -- full structured talk output
  -- structure: { hazard_intro, main_content, key_actions[], discussion_questions[], closing_line }
  generated_at          TIMESTAMPTZ,

  -- Presenter edits (optional)
  presenter_notes       TEXT,
  content_edited        BOOLEAN DEFAULT false,

  -- Delivery record
  attendee_ids          JSONB,                                        -- array of user UUIDs
  attendee_count        INTEGER,
  acknowledgement_method VARCHAR(20) CHECK (acknowledgement_method IN ('digital', 'signature', 'verbal')),

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_toolbox_talk_worksite ON toolbox_talk(worksite_id, delivered_at);
CREATE INDEX idx_toolbox_talk_work_type ON toolbox_talk(work_type_id);
```

---

## 4. API Endpoints

All endpoints follow REST conventions. Authentication via existing platform auth middleware.

### 4.1 Observations

```
POST   /api/v1/observations
GET    /api/v1/observations/:id
GET    /api/v1/worksites/:worksite_id/observations
PATCH  /api/v1/observations/:id/sharing          -- toggle cleared_for_sharing
```

**POST /api/v1/observations** — Request body:
```json
{
  "worksite_id": "uuid",
  "work_type_id": "uuid",
  "practice_id": "uuid | null",
  "observation_type": "near-miss | at-risk | safe",
  "what_was_observed": "string",
  "immediate_action_taken": "string | null",
  "people_involved_count": 0
}
```

On creation: system auto-sets `observer_id` from auth token, `observed_at` to now, `cleared_for_sharing` to true. Async AI enrichment job is queued immediately.

---

### 4.2 Incidents

```
POST   /api/v1/incidents
GET    /api/v1/incidents/:id
GET    /api/v1/worksites/:worksite_id/incidents
```

**POST /api/v1/incidents** — On creation: triage algorithm runs synchronously. If `requires_investigation = true`, an `Investigation` record is created and assignee notified. AI investigation assistance job is queued.

---

### 4.3 Investigations

```
GET    /api/v1/investigations/:id
PATCH  /api/v1/investigations/:id                -- update framework fields
POST   /api/v1/investigations/:id/close          -- sets status=closed, triggers narrative generation
```

**POST /api/v1/investigations/:id/close** — Request body:
```json
{
  "cleared_for_sharing": true,
  "sharing_scope": "site | region | division | organisation",
  "legal_hold": false
}
```

On close: if `cleared_for_sharing = true` and `legal_hold = false`, AI toolbox narrative generation job is queued.

---

### 4.4 Critical Insights

```
GET    /api/v1/critical-insights/:id
GET    /api/v1/critical-insights?level=region&scope_ref_id=uuid
POST   /api/v1/critical-insights/:id/review      -- human approval action
```

**POST /api/v1/critical-insights** — Manual creation. Request body:
```json
{
  "trigger_source": "manual | external_alert | external_investigation",
  "work_type_id": "uuid",
  "generated_at_level": "site | region | division | organisation",
  "scope_ref_id": "uuid",
  "pattern_summary": "string",
  "likely_systemic_cause": "string",
  "recommended_action": "string",
  "toolbox_narrative": "string",
  "sharing_scope": "region",
  "escalate_to_systemic": false,
  "source_metadata": { }    -- shape varies by trigger_source, see schema comments
}
```

On manual creation: `cleared_for_toolbox = true` immediately (creator IS the reviewer). `reviewed_by_id = creator`, `review_action = 'approved'`, `reviewed_at = now()`. AI structuring assist available before submit — see Prompt 2 note below. `fw_classify` job queued immediately.

**Optional AI structuring assist (manual/external only):**
Safety manager can paste unstructured source material (alert text, investigation summary) and request AI assistance to structure it into the standard fields before saving. This is a separate interactive call, not a background job — the manager reviews and edits the AI output before submitting.

**POST /api/v1/critical-insights/:id/review** — Algorithm-triggered insights only. Request body:
```json
{
  "action": "approved | edited | rejected",
  "edited_content": { ... },                     -- if action = edited
  "sharing_scope": "region",
  "reviewer_notes": "string | null"
}
```

On approval: `cleared_for_toolbox = true`. If `escalate_to_systemic = true`, systemic investigation workflow is triggered.

---

### 4.5 Toolbox Talks

```
POST   /api/v1/toolbox-talks/generate            -- triggers content selection + AI assembly
GET    /api/v1/toolbox-talks/:id
PATCH  /api/v1/toolbox-talks/:id/deliver         -- record delivery + attendees
```

**POST /api/v1/toolbox-talks/generate** — Request body:
```json
{
  "worksite_id": "uuid",
  "work_type_id": "uuid",
  "presenter_id": "uuid"
}
```

Returns fully assembled talk. Content selection algorithm runs synchronously; AI assembly runs synchronously (target < 8s).

---

### 4.6 Enquiries

```
POST   /api/v1/enquiries                          -- create enquiry (draft)
GET    /api/v1/enquiries/:id
GET    /api/v1/enquiries?trigger_source=critical_insight&status=active
PATCH  /api/v1/enquiries/:id                      -- update questions / targeting before dispatch
POST   /api/v1/enquiries/:id/dispatch             -- send to recipients, locks question set
POST   /api/v1/enquiries/:id/close                -- manually close before deadline, triggers summary
GET    /api/v1/enquiries/:id/results              -- real-time results with AI synthesis
```

**POST /api/v1/enquiries** — Request body:
```json
{
  "trigger_source": "critical_insight | investigation_mid | investigation_witness",
  "trigger_id": "uuid",
  "title": "string",
  "questions": [
    {
      "question_text": "string",
      "question_type": "assurance | likelihood | prevalence | evidence | work_as_done | gap_identification | comparative",
      "response_options": ["Yes", "Partially", "No"],
      "allow_photo": true,
      "require_note_if": ["No", "Partially"],
      "target_type": "site_role | named_individuals | site_scope",
      "target_scope": "source_sites | region | division | organisation | custom",
      "target_ids": ["uuid"],
      "target_role": "supervisor | manager | both"
    }
  ],
  "deadline_at": "timestamptz",
  "notify_message": "string"
}
```

**POST /api/v1/enquiries/:id/dispatch** — Locks question set. Creates `enquiry_response` records for each recipient. Fires push notifications. No further edits to questions after dispatch.

**GET /api/v1/enquiries/:id/results** — Returns:
```json
{
  "enquiry_id": "uuid",
  "response_count": 9,
  "recipient_count": 12,
  "response_rate": 0.75,
  "per_question_results": [ ... ],
  "live_feed": [ ... ],
  "ai_synthesis": {
    "findings": [ ... ],
    "generated_at": "timestamptz",
    "response_count_at_generation": 9
  },
  "summary": null
}
```

`ai_synthesis` updates automatically every time a new response is submitted (job: `enquiry.synthesise`). `summary` is null until the safety manager triggers generation or the enquiry closes.

---

## 5. New Entity Schemas — Enquiry Module

### 5.1 enquiry

```sql
CREATE TABLE safety_intelligence.enquiry (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trigger linkage
  trigger_source    VARCHAR(30) NOT NULL
                    CHECK (trigger_source IN (
                      'critical_insight',
                      'investigation_mid',
                      'investigation_witness'
                    )),
  trigger_id        UUID        NOT NULL,   -- FK to critical_insight.id OR investigation.id

  -- Content
  title             TEXT        NOT NULL,
  context_narrative TEXT,                  -- shown to recipients — excerpt from insight or investigation
  work_type_id      UUID        REFERENCES public.work_type(id),

  -- Workflow state
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'closed', 'cancelled')),
  created_by_id     UUID        NOT NULL REFERENCES public.users(id),
  dispatched_at     TIMESTAMPTZ,
  deadline_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  closed_by_id      UUID        REFERENCES public.users(id),

  -- Targeting defaults (per-question targeting overrides these)
  default_target_type   VARCHAR(20) CHECK (default_target_type IN ('site_role', 'named_individuals', 'site_scope')),
  default_target_scope  VARCHAR(20) CHECK (default_target_scope IN ('source_sites', 'region', 'division', 'organisation', 'custom')),
  default_target_role   VARCHAR(20) CHECK (default_target_role IN ('supervisor', 'manager', 'both')),

  -- AI synthesis (updated per response, stored as JSONB snapshot)
  ai_synthesis          JSONB,
  ai_synthesis_at       TIMESTAMPTZ,

  -- Final summary (generated on close or manual trigger)
  summary               TEXT,
  summary_generated_at  TIMESTAMPTZ,
  recommended_actions   JSONB,            -- array of action strings

  -- Notify
  notify_message        TEXT,

  -- Forge Works Map® Classification (populated by fw_classify job, NULL until classified)
  -- Arrays: all parallel by index. factor[0] has domain[0], confidence[0], rationale[0].
  -- Only factors that independently meet fw_confidence >= 0.70 are stored. Max 3.
  -- Empty array = attempted but no factor met threshold. NULL = not yet attempted.
  fw_factors             VARCHAR(40)[],  -- e.g. {management_systems, operational_management}
  fw_domains             VARCHAR(10)[],  -- e.g. {enable, enable}
  fw_maturity_signals    VARCHAR(12)[],  -- e.g. {compliant, leading}
  fw_confidences         DECIMAL(3,2)[], -- e.g. {0.86, 0.73} — per factor
  fw_rationales          TEXT[],         -- 1 sentence per factor explaining the classification
  fw_classification_basis TEXT,          -- overall evidence that drove the session (single field)
  fw_classified_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enquiry_trigger    ON safety_intelligence.enquiry(trigger_source, trigger_id);
CREATE INDEX idx_enquiry_status     ON safety_intelligence.enquiry(status);
CREATE INDEX idx_enquiry_created_by ON safety_intelligence.enquiry(created_by_id);
```

---

### 5.2 enquiry_question

```sql
CREATE TABLE safety_intelligence.enquiry_question (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id       UUID        NOT NULL REFERENCES safety_intelligence.enquiry(id),
  position         INTEGER     NOT NULL,   -- display order

  -- Content
  question_text    TEXT        NOT NULL,
  question_type    VARCHAR(30) NOT NULL
                   CHECK (question_type IN (
                     'assurance',
                     'likelihood',
                     'prevalence',
                     'evidence',
                     'work_as_done',
                     'gap_identification',
                     'comparative'
                   )),

  -- Response configuration
  response_options JSONB,                 -- e.g. ["Yes","Partially","No"] — null for free text types
  allow_photo      BOOLEAN     DEFAULT false,
  require_note_if  JSONB,                 -- response values that mandate a note e.g. ["No","Partially"]
  ai_rationale     TEXT,                  -- why AI recommended this question

  -- Per-question targeting (overrides enquiry defaults if set)
  target_type      VARCHAR(20) CHECK (target_type IN ('site_role', 'named_individuals', 'site_scope')),
  target_scope     VARCHAR(20) CHECK (target_scope IN ('source_sites', 'region', 'division', 'organisation', 'custom')),
  target_ids       JSONB,                 -- UUID[] of sites or users depending on target_type
  target_role      VARCHAR(20) CHECK (target_role IN ('supervisor', 'manager', 'both')),

  -- AI-suggested flag
  ai_suggested     BOOLEAN     DEFAULT true,
  removed_by_user  BOOLEAN     DEFAULT false,   -- soft delete — keep for audit

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eq_question_enquiry ON safety_intelligence.enquiry_question(enquiry_id, position);
```

---

### 5.3 enquiry_response

One record per recipient per question. Created in bulk on dispatch.

```sql
CREATE TABLE safety_intelligence.enquiry_response (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id        UUID        NOT NULL REFERENCES safety_intelligence.enquiry(id),
  question_id       UUID        NOT NULL REFERENCES safety_intelligence.enquiry_question(id),
  respondent_id     UUID        NOT NULL REFERENCES public.users(id),
  worksite_id       UUID        NOT NULL REFERENCES public.worksite(id),

  -- Response state
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'answered', 'skipped')),
  answered_at       TIMESTAMPTZ,

  -- Response values
  selected_option   TEXT,                 -- for structured types (assurance, likelihood, etc.)
  note_text         TEXT,                 -- for free text or mandatory note
  photo_url         TEXT,                 -- if photo evidence submitted
  gap_category      VARCHAR(20)           -- for gap_identification: 'people'|'process'|'equipment'|'environment'
                    CHECK (gap_category IN ('people', 'process', 'equipment', 'environment')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (question_id, respondent_id)     -- one response per person per question
);

CREATE INDEX idx_eq_response_enquiry  ON safety_intelligence.enquiry_response(enquiry_id);
CREATE INDEX idx_eq_response_question ON safety_intelligence.enquiry_response(question_id);
CREATE INDEX idx_eq_response_status   ON safety_intelligence.enquiry_response(status);
```

---

### 5.4 enquiry_endorsement (insight discussion thread)

```sql
CREATE TABLE safety_intelligence.insight_endorsement (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id    UUID        NOT NULL REFERENCES safety_intelligence.critical_insight(id),
  user_id       UUID        NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insight_id, user_id)
);

CREATE TABLE safety_intelligence.insight_comment (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id          UUID        NOT NULL REFERENCES safety_intelligence.critical_insight(id),
  user_id             UUID        NOT NULL REFERENCES public.users(id),
  body                TEXT        NOT NULL,
  is_approval_comment BOOLEAN     DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 6. Enquiry Pipeline — Trigger Rules

### 6.1 Critical Insight → Enquiry (post-approval)

```
ON critical_insight.review_action = 'approved':
  CREATE enquiry (
    trigger_source = 'critical_insight',
    trigger_id     = critical_insight.id,
    status         = 'draft',
    title          = AI-generated from insight pattern_summary,
    context_narrative = insight.toolbox_narrative (truncated),
    work_type_id   = insight.work_type_id
  )
  QUEUE job: enquiry.generate_questions
    -- AI reads insight, observation cluster, checks observation pool
    -- for existing prevalence signal before recommending question set
  NOTIFY safety manager: "Enquiry draft ready for CI-[id]"
```

### 6.2 Investigation Mid-Enquiry (during open investigation)

```
TRIGGER: Investigator manually initiates from Investigation workbench panel
  OR: AI investigation assistant flags a suspected cross-site condition
      (e.g. root_cause references a procedure gap or equipment type
       that exists across multiple sites)

ON trigger:
  CREATE enquiry (
    trigger_source = 'investigation_mid',
    trigger_id     = investigation.id,
    status         = 'draft',
    context_narrative = excerpt from investigation + "We are investigating
                        an incident at [site]. We need to understand whether
                        this condition exists at your site."
  )
  LEGAL CHECK: IF investigation.legal_hold = true
    THEN block enquiry creation entirely
    -- Active legal hold means no information gathering outside the investigation

  DEFAULT targeting: sites in same region as incident worksite
    -- Investigator can narrow or expand
  NOTIFY investigator: "Enquiry draft created — review questions before dispatching"
```

### 6.3 Investigation Witness Enquiry (named individuals)

```
TRIGGER: Investigator adds named individuals to investigation record

ON trigger:
  CREATE enquiry (
    trigger_source      = 'investigation_witness',
    trigger_id          = investigation.id,
    default_target_type = 'named_individuals',
    target_ids          = [named_user_ids]
  )
  LEGAL CHECK: same as 6.2 — blocked if legal_hold = true
  Questions pre-populated with AI-suggested interview framework
    from investigation.assist output (Prompt 3)
  NOTIFY named individuals: specific, sensitive wording —
    "You have been identified as a witness or participant in an investigation
     at [site]. Your input will help us understand what happened.
     Responses are confidential within the investigation."
```

---

## 7. Updated Async Job Queue

| Job | Trigger | Target Latency |
|-----|---------|----------------|
| `observation.enrich` | Observation created | < 5s |
| `investigation.assist` | Investigation created | < 10s |
| `investigation.generate_narrative` | Investigation closed + cleared | < 10s |
| `critical_insight.generate` | Trend threshold crossed | < 15s |
| `critical_insight.notify_reviewer` | Insight generated | immediate |
| `enquiry.generate_questions` | Enquiry created from insight | < 15s |
| `enquiry.synthesise` | Response submitted | < 5s |
| `enquiry.notify_recipients` | Enquiry dispatched | immediate |
| `enquiry.reminder` | 24h before deadline | scheduled |
| `enquiry.generate_summary` | Enquiry closed OR manual trigger | < 20s |
| `enquiry.notify_completion` | Summary generated | immediate |

All jobs are idempotent and retryable. Failed jobs should not block the primary user action.

---

## 8. Extended Output Types

### 8.1 Situational Brief

A short, auto-generated learning report triggered when a Critical Insight is approved or an investigation closes. Replaces the ad-hoc email a safety manager would otherwise write. Reviewed before distribution — never auto-sent.

**Triggers:**
- Critical Insight approved (`cleared_for_toolbox = true`)
- Investigation closed (`cleared_for_sharing = true`)

**Audience:** Managers and safety professionals within the approved sharing scope. Not crew-facing.

```sql
CREATE TABLE safety_intelligence.situational_brief (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  trigger_source    VARCHAR(20) NOT NULL CHECK (trigger_source IN ('critical_insight','investigation')),
  trigger_id        UUID        NOT NULL,

  -- Content (AI generated, human reviewed before send)
  title             TEXT        NOT NULL,
  what_happened     TEXT,       -- pattern or incident in plain language
  what_it_means     TEXT,       -- organisational interpretation
  -- Forge Works Map® — parallel arrays, same spec as critical_insight
  fw_factors         VARCHAR(40)[],
  fw_domains         VARCHAR(10)[],
  fw_maturity_signals VARCHAR(12)[],
  fw_confidences     DECIMAL(3,2)[],
  fw_rationales      TEXT[],
  fw_classification_basis TEXT,
  what_is_being_done TEXT,      -- corrective actions, enquiry launched, etc.
  key_questions     JSONB,      -- 2-3 questions for managers to consider

  -- Workflow
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','distributed','cancelled')),
  reviewed_by_id    UUID        REFERENCES public.users(id),
  reviewed_at       TIMESTAMPTZ,
  distributed_at    TIMESTAMPTZ,
  sharing_scope     VARCHAR(20),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**API:**
```
GET    /api/v1/situational-briefs/:id
POST   /api/v1/situational-briefs/:id/approve    -- human review gate
POST   /api/v1/situational-briefs/:id/distribute -- sends to scope
```

**Async jobs:**
- `situational_brief.generate` — triggered after insight approval or investigation close. Target latency < 15s.
- `situational_brief.distribute` — on approval. Sends to relevant managers via push + email.

---

### 8.2 Community of Practice Thread Seeding

When a Critical Insight is approved or an investigation closes, an AI-generated discussion thread is seeded into the relevant CoP room on the existing platform. The thread is transparently AI-generated — this is a product differentiator, not a disclosure. The attribution shows clearly: generated from a real field intelligence event.

**Triggers:**
- Critical Insight approved — seeds thread in the work type room and/or practice type room
- Investigation closed and cleared — seeds thread in the relevant work type room

**Thread structure:**
1. Header attribution: "Generated from Critical Insight CI-042, approved by [Safety Manager name] · [date]"
2. Opening: the pattern or finding in plain language — not a link, the actual substance
3. An open question inviting field experience: what's your experience with this, what's worked?
4. Forge Works Map® factor tag (if classified with sufficient confidence)
5. Link to full insight/investigation for those who want the detail

**CoP room targeting:**
- Primary room: work type (e.g. Heavy Vehicle Operations)
- Secondary room: practice type if applicable (e.g. Traffic Management)
- Safety manager can override room selection before seeding

```sql
CREATE TABLE safety_intelligence.cop_thread_seed (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  trigger_source    VARCHAR(20) NOT NULL CHECK (trigger_source IN ('critical_insight','investigation')),
  trigger_id        UUID        NOT NULL,

  -- Content
  thread_title      TEXT        NOT NULL,
  thread_body       TEXT        NOT NULL,   -- full AI-generated post
  opening_question  TEXT        NOT NULL,   -- the discussion prompt
  fw_factor         VARCHAR(40),
  fw_domain         VARCHAR(10),

  -- Targeting
  primary_room_id   VARCHAR(100) NOT NULL,  -- CoP room ID from external platform
  secondary_room_id VARCHAR(100),
  seeded_by_id      UUID        REFERENCES public.users(id),  -- safety manager who approved

  -- State
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','seeded','cancelled')),
  seeded_at         TIMESTAMPTZ,
  external_thread_id VARCHAR(200), -- ID returned by CoP platform API on seed

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**API:**
```
GET    /api/v1/cop-seeds/:id
POST   /api/v1/cop-seeds/:id/approve    -- safety manager reviews thread before seeding
POST   /api/v1/cop-seeds/:id/seed       -- posts to CoP platform via integration
```

**Integration note:** CoP platform API credentials and room ID mapping are org-level configuration. The `cop_thread_seed` table is platform-agnostic — seeding is handled by an integration adapter per CoP platform (Viva Engage, Slack, custom, etc.).

**Async jobs:**
- `cop_thread.generate` — triggered after insight approval or investigation close. Target < 15s.
- `cop_thread.seed` — on safety manager approval. Calls CoP platform API.

---

### 8.3 Visit Briefing Pack

A digital briefing generated 48 hours before a planned manager visit. Delivered to the manager's phone as part of the visit workflow. Transitions from planning reference to active visit guide when the manager taps Start Visit.

**Trigger:** Visit plan created OR atrophy alert assigned to a manager.

**Timing:** Generated immediately on visit plan creation. Push notification sent to manager: "Your visit briefing for [site] is ready. Visit in 2 days."

**Content:**

| Section | Source | Notes |
|---------|--------|-------|
| Site health snapshot | Atrophy score calculation | Atrophy score, days since last obs, open investigations, near-miss trend |
| Active Critical Insights | `critical_insight` WHERE scope covers site AND cleared | Brief narrative, work type, Forge Works classification if available |
| Open corrective actions | `corrective_action` WHERE worksite and status open | Owner, due date, days overdue |
| Investigation status | `investigation` WHERE worksite and status open | Reference, type, age, assigned investigator |
| AI-recommended focus areas | Visit planning AI | Work type topics with source badges |
| Last visit summary | Previous `visit_plan` WHERE same site, completed | What was observed, what was noted |
| Forge Works signal | Aggregated `fw_factor` from recent insights/investigations at site | Which capacity factors are showing in site intelligence |

```sql
CREATE TABLE safety_intelligence.visit_briefing (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_plan_id     UUID        NOT NULL REFERENCES safety_intelligence.visit_plan(id),
  worksite_id       UUID        NOT NULL REFERENCES public.worksite(id),
  manager_id        UUID        NOT NULL REFERENCES public.users(id),

  -- Generated content
  site_snapshot     JSONB,      -- atrophy score, key metrics at generation time
  active_insights   JSONB,      -- array of relevant insight summaries
  open_actions      JSONB,      -- array of corrective actions
  open_investigations JSONB,
  focus_areas       JSONB,      -- AI-recommended observation topics (same as visit plan topics)
  last_visit_summary TEXT,
  fw_signal         JSONB,      -- capacity factor distribution from recent site intelligence

  -- State
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at         TIMESTAMPTZ,          -- when manager first opened it
  visit_started_at  TIMESTAMPTZ,          -- when Start Visit tapped — briefing transitions to active

  -- Snapshot integrity
  snapshot_expires_at TIMESTAMPTZ         -- briefing data is a point-in-time snapshot; flag if stale
);
```

**API:**
```
GET    /api/v1/visit-briefings/:visit_plan_id    -- returns briefing for this visit
```

**Mobile behaviour:**
- Available in the Visit Plan Detail screen from the moment it's generated
- Pre-visit state: read-only briefing with all sections expanded
- Active state (after Start Visit): focus areas become capture prompts; other sections collapse to quick-reference
- Stale flag shown if briefing is >48h old and visit hasn't started — "Some information may have changed. Tap to refresh."

**Async jobs:**
- `visit_briefing.generate` — triggered on visit plan creation or atrophy assignment. Target < 20s.
- `visit_briefing.notify` — push notification to manager on generation. Immediate.

---

## 9. Updated Async Job Queue (complete)

| Job | Trigger | Target Latency |
|-----|---------|----------------|
| `observation.enrich` | Observation created | < 5s |
| `investigation.assist` | Investigation created | < 10s |
| `investigation.generate_narrative` | Investigation closed + cleared | < 10s |
| `critical_insight.generate` | Trend threshold crossed | < 15s |
| `critical_insight.notify_reviewer` | Insight generated | immediate |
| `enquiry.generate_questions` | Enquiry created from insight | < 15s |
| `enquiry.synthesise` | Response submitted | < 5s |
| `enquiry.notify_recipients` | Enquiry dispatched | immediate |
| `enquiry.reminder` | 24h before deadline | scheduled |
| `enquiry.generate_summary` | Enquiry closed OR manual trigger | < 20s |
| `enquiry.notify_completion` | Summary generated | immediate |
| `fw_classify` | Insight approved / Investigation closed / Enquiry summary generated | < 10s |
| `situational_brief.generate` | Insight approved / Investigation closed | < 15s |
| `situational_brief.distribute` | Brief approved by safety manager | immediate |
| `cop_thread.generate` | Insight approved / Investigation closed | < 15s |
| `cop_thread.seed` | Thread approved by safety manager | immediate |
| `visit_briefing.generate` | Visit plan created / Atrophy alert assigned | < 20s |
| `visit_briefing.notify` | Briefing generated | immediate |

All jobs are idempotent and retryable. Failed jobs should not block the primary user action.
