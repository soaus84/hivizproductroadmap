# SPEC.md — Hiviz SafetyPlatform

**Forge Works · Hiviz SafetyPlatform**  
Version: 1.0  
Status: Consolidated spec — supersedes specs/01, 03, 04, 06, 07

> **Scope of this document:** Data model, API, algorithms, integration rules, notification events, enquiry module. For view/UI specifications see `views.md`. For AI prompt library see `prompts.md`.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Existing Entities (Referenced, Not Modified)](#2-existing-entities-referenced-not-modified)
3. [Schema — Core Entities](#3-schema--core-entities)
   - 3.0 Worksite Role Slots
   - 3.1 Observation
   - 3.2 Incident
   - 3.3 Investigation
   - 3.4 CriticalInsight
   - 3.5 ToolboxTalk
4. [Schema — Enquiry Module](#4-schema--enquiry-module)
   - 4.1 enquiry
   - 4.2 enquiry_question
   - 4.3 enquiry_response
   - 4.4 insight_endorsement & insight_comment
5. [Schema — Output Entities](#5-schema--output-entities)
   - 5.1 situational_brief
   - 5.2 cop_thread_seed
   - 5.3 visit_briefing
6. [API Endpoints](#6-api-endpoints)
7. [Algorithm Engine](#7-algorithm-engine)
   - 7.1 Incident Triage
   - 7.2 Trend Detection
   - 7.3 Content Selection
   - 7.4 Sharing Eligibility Gate
8. [Logic Rules Reference](#8-logic-rules-reference)
   - 8.1 Observation Rules
   - 8.2 Incident & Investigation Rules
   - 8.3 Critical Insight Rules
   - 8.4 Toolbox Talk Rules
   - 8.5 Sharing Scope Resolution
9. [Enquiry Module](#9-enquiry-module)
   - 9.1 What the Enquiry System Is
   - 9.2 Trigger Sources
   - 9.3 Question Types
   - 9.4 Targeting Model
   - 9.5 AI Prompts
   - 9.6 Legal & Privacy Rules
10. [Integration Points](#10-integration-points)
    - 10.1 Read-Only References
    - 10.2 Authentication & Authorisation
    - 10.3 Configuration Reference
11. [Notification Events Registry](#11-notification-events-registry)
12. [Async Job Queue](#12-async-job-queue)
13. [Audit Logging](#13-audit-logging)
14. [Infrastructure Requirements](#14-infrastructure-requirements)
15. [Security & Compliance](#15-security--compliance)
16. [V2/V3 Cascade Notes](#16-v2v3-cascade-notes)
17. [Devpack Index](#17-devpack-index)

---

## 1. Design Principles

- **Existing taxonomies are referenced, never duplicated.** `work_type_id` and `practice_id` are foreign keys into existing taxonomy tables.
- **Org hierarchy is inherited.** All entities resolve their org context via `worksite_id` traversal up through region → division → organisation.
- **Minimal fields only.** Every field must justify its presence by driving a communication, learning, or improvement outcome.
- **Separation of capture and sharing.** `cleared_for_sharing` is an explicit flag — never inferred. Investigations default to `false`; observations default to `true`.
- **Legal hold is a hard override.** `legal_hold = true` blocks all sharing pipelines regardless of other flags.
- **Every AI suggestion has a companion reason.** No AI output field exists without a corresponding rationale field stored alongside it. `ai_suggested_x` always has `ai_suggested_x_rationale`. This is a trust and liability principle: the platform surfaces AI outputs as suggestions with visible reasoning, never as recommendations or directives. The human reviewer sees the why, engages with it, and owns the decision.
- **AI suggestion language standard.** Across all UI surfaces: use "suggested" not "recommended", "AI has identified" not "AI determined", "based on" not "because", "for your review" not as a directive. The safety professional makes the call — the AI makes the case.
- **Operationally significant content only.** Hiviz surfaces only content that drives a communication, learning, or improvement outcome. No vanity metrics, no informational noise.

---

## 2. Existing Entities (Referenced, Not Modified)

These entities already exist in the platform. The module references them via foreign key only. No existing tables are modified.

```
Organisation
  └── Division
        └── SubDivision (BusinessUnit)
              └── Region
                    └── Worksite               ← primary anchor for all new entities

WorkType                                        ← high-risk work taxonomy
                                                  V5 note: add has_critical_controls BOOLEAN DEFAULT false
SafetyPractice                                  ← safety practice taxonomy
User                                            ← existing user/identity model
```

---

## 3. Schema — Core Entities

All new tables live in the `safety_intelligence` PostgreSQL schema unless otherwise noted. Existing taxonomy and org tables are accessed via cross-schema foreign keys.

---

### 3.0 Worksite Role Slots & Assignments

Defines which users are associated with a worksite in which capacity. Drives notification routing, enquiry assignment, corrective action assignment, and (V5) control verification scheduling.

```sql
CREATE TABLE safety_intelligence.worksite_role_slot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksite_id UUID NOT NULL REFERENCES worksite(id),
  role        VARCHAR(30) NOT NULL
              CHECK (role IN (
                'supervisor',           -- delivers talks, logs observations, responds to enquiries
                'manager',              -- visit workflow, atrophy oversight, action assignment
                'safety_professional',  -- insight notifications, investigation support
                'control_verifier'      -- V5: critical control verification scheduling
              )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (worksite_id, role)
);

CREATE TABLE safety_intelligence.worksite_slot_assignment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       UUID NOT NULL REFERENCES safety_intelligence.worksite_role_slot(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  assigned_by   UUID NOT NULL REFERENCES users(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        VARCHAR(10) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES users(id),
  UNIQUE (slot_id, user_id, status)
);

CREATE INDEX idx_slot_worksite ON safety_intelligence.worksite_role_slot(worksite_id);
CREATE INDEX idx_assignment_slot ON safety_intelligence.worksite_slot_assignment(slot_id, status);
CREATE INDEX idx_assignment_user ON safety_intelligence.worksite_slot_assignment(user_id, status);
```

**Slot responsibilities:**

| Slot | Notification routing | Assignment eligibility | V5 |
|------|---------------------|----------------------|----|
| supervisor | Talk ready, enquiry assigned, action assigned | Enquiry response, action check-off | Tier 1 verification fallback |
| manager | Atrophy alert, visit briefing | Corrective actions (management level) | — |
| safety_professional | Insight notifications (site scope), notifiable incident flag | Higher-level enquiries, investigation support | Tier 2/3 verification fallback |
| control_verifier | Verification due (V5), overdue verification alert (V5) | Critical control verification (V5) | Primary verifier |

A user can be assigned to the same slot at multiple worksites. Their obligation queue spans all assigned sites. Assignment is managed by safety managers or division managers in worksite settings, not by the users themselves. Status is set `inactive` when someone leaves a role — history is preserved, not deleted.

---

### 3.1 Observation

```sql
CREATE TABLE safety_intelligence.observation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  observer_id           UUID NOT NULL REFERENCES users(id),
  observer_role         VARCHAR(20) NOT NULL CHECK (observer_role IN ('supervisor', 'manager')),
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  observed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Classification
  work_type_id          UUID REFERENCES work_type(id),
  practice_id           UUID REFERENCES safety_practice(id),
  observation_type      VARCHAR(20) NOT NULL CHECK (observation_type IN ('safe', 'at-risk', 'near-miss')),

  -- Content
  what_was_observed     TEXT NOT NULL,
  immediate_action_taken TEXT,
  people_involved_count INTEGER DEFAULT 0,
  stop_work_called      BOOLEAN DEFAULT false,
  involved_role         VARCHAR(20)
                          CHECK (involved_role IN ('employee','operator','subcontractor','visitor','unknown')),
  photo_url             TEXT,

  -- AI enrichment (populated async after submission)
  ai_failure_type       VARCHAR(30) CHECK (ai_failure_type IN ('systemic','behavioural','environmental','unclear')),
  ai_severity_signal    VARCHAR(20),
  ai_key_hazard         TEXT,
  ai_enrichment_confidence DECIMAL(3,2),
  ai_anonymisation_flags JSONB,
  ai_inferred_work_type_ids JSONB,
  ai_inferred_practice_ids  JSONB,
  ai_enriched_at        TIMESTAMPTZ,

  -- Sharing controls
  cleared_for_sharing   BOOLEAN NOT NULL DEFAULT true,
  sharing_scope         VARCHAR(20) NOT NULL DEFAULT 'site'
                          CHECK (sharing_scope IN ('site','region','division','organisation')),

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_observation_worksite ON safety_intelligence.observation(worksite_id);
CREATE INDEX idx_observation_work_type ON safety_intelligence.observation(work_type_id);
CREATE INDEX idx_observation_type_observed ON safety_intelligence.observation(observation_type, observed_at);
```

---

### 3.2 Incident

```sql
CREATE TABLE safety_intelligence.incident (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  reported_by_id        UUID NOT NULL REFERENCES users(id),
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  occurred_at           TIMESTAMPTZ NOT NULL,
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Classification
  work_type_id          UUID REFERENCES work_type(id),
  practice_id           UUID REFERENCES safety_practice(id),
  incident_type         VARCHAR(30) NOT NULL
                          CHECK (incident_type IN ('near-miss','injury','property-damage','environmental')),
  severity_class        VARCHAR(20)
                          CHECK (severity_class IN (
                            'critical',   -- fatality, permanent disability, catastrophic loss
                            'serious',    -- lost time, hospitalisation, major damage
                            'moderate',   -- medical treatment, restricted work, significant damage
                            'minor'       -- first aid, near-miss, minor property damage
                          )),

  -- Content
  description           TEXT NOT NULL,
  people_involved_count INTEGER DEFAULT 0,

  -- Injury classification (conditional on incident_type = 'injury')
  injury_classification VARCHAR(20)
                          CHECK (injury_classification IN (
                            'first_aid','medical_treatment','restricted_work','lost_time','fatality'
                          )),
  body_part_affected    VARCHAR(30),
  nature_of_injury      VARCHAR(30)
                          CHECK (nature_of_injury IN (
                            'laceration','fracture','strain_sprain','burn',
                            'crush','exposure','concussion','other'
                          )),
  mechanism_of_injury   VARCHAR(30)
                          CHECK (mechanism_of_injury IN (
                            'fall_from_height','fall_same_level','struck_by_object',
                            'caught_in_equipment','manual_handling','vehicle_contact',
                            'exposure_substance','exposure_environment','other'
                          )),
  site_location_type    VARCHAR(20)
                          CHECK (site_location_type IN (
                            'ground_level','elevated','confined_space',
                            'vehicle','plant_room','perimeter','other'
                          )),

  -- Timing
  discovered_at         TIMESTAMPTZ,

  -- Regulatory notification
  notifiable_flag       BOOLEAN DEFAULT false,
  notifiable_confirmed_at TIMESTAMPTZ,
  notifiable_confirmed_by UUID REFERENCES users(id),
  notifiable_dismissed  BOOLEAN DEFAULT false,

  -- Investigation routing
  requires_investigation BOOLEAN NOT NULL DEFAULT false,
  investigation_id      UUID REFERENCES safety_intelligence.investigation(id),

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_worksite ON safety_intelligence.incident(worksite_id);
CREATE INDEX idx_incident_type ON safety_intelligence.incident(incident_type, occurred_at);
CREATE INDEX idx_incident_severity ON safety_intelligence.incident(severity_class);
```

**`severity_class` field note:** Set at submission time by the reporter or triage algorithm based on `injury_classification` and `incident_type`. Drives notification urgency, regulatory flag logic, and V2 FW Map® classification context. Values:
- `critical` — fatality, permanent disability, catastrophic equipment/environmental loss
- `serious` — lost time injury, hospitalisation, major structural or equipment damage
- `moderate` — medical treatment, restricted work, significant damage
- `minor` — first aid only, near-miss, minor property damage

---

### 3.3 Investigation

```sql
CREATE TABLE safety_intelligence.investigation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           UUID NOT NULL REFERENCES safety_intelligence.incident(id),

  -- Workflow state
  status                VARCHAR(20) NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','closed','escalated')),
  assigned_to_id        UUID REFERENCES users(id),
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ,

  -- Framework fields (AI-assisted, human-confirmed)
  immediate_cause       TEXT,
  contributing_factors  JSONB,
  root_cause            TEXT,
  corrective_actions    JSONB,

  -- AI assistance metadata
  ai_suggested_contributing_factors          JSONB,   -- [{ factor, rationale }]
  ai_suggested_contributing_factors_rationale TEXT,
  ai_suggested_root_cause                    TEXT,
  ai_suggested_root_cause_rationale          TEXT,
  ai_suggested_corrective_actions            JSONB,   -- [{ action, rationale }]
  ai_suggested_interview_questions           JSONB,   -- [{ question, rationale }]
  ai_assisted_at                             TIMESTAMPTZ,

  -- AI-generated toolbox narrative
  toolbox_narrative     TEXT,
  toolbox_narrative_generated_at TIMESTAMPTZ,

  -- Sharing controls
  cleared_for_sharing   BOOLEAN NOT NULL DEFAULT false,
  sharing_scope         VARCHAR(20) CHECK (sharing_scope IN ('site','region','division','organisation')),
  legal_hold            BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by_id          UUID REFERENCES users(id)
);

CREATE INDEX idx_investigation_incident ON safety_intelligence.investigation(incident_id);
CREATE INDEX idx_investigation_status ON safety_intelligence.investigation(status);
```

---

### 3.4 CriticalInsight

Generated entity. Not directly captured by humans (except for manual and external trigger sources).

```sql
CREATE TABLE safety_intelligence.critical_insight (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trigger source
  trigger_source        VARCHAR(30) NOT NULL DEFAULT 'algorithm'
                          CHECK (trigger_source IN (
                            'algorithm',              -- trend detection crossed threshold (default)
                            'manual',                 -- safety manager entered directly
                            'solo_critical',          -- single high-severity incident bypasses trend threshold
                            'external_alert',         -- regulator / industry body / client alert
                            'external_investigation'  -- finding from investigation in another system
                          )),

  -- Source data (algorithm / solo_critical triggers)
  source_observation_ids   JSONB,
  source_investigation_ids JSONB,
  trigger_event            JSONB,   -- algorithm: { threshold, window_days, count }
                                    -- solo_critical: { incident_id, severity_class, rationale }

  -- Source metadata (manual / external triggers)
  source_metadata          JSONB,
  -- Shapes by trigger_source:
  -- manual:               { authored_by_role, context }
  -- external_alert:       { alert_title, alert_url, issuing_body, alert_date }
  -- external_investigation: { investigation_ref, source_org, system, summary_provided_by }
  -- solo_critical:        (use trigger_event instead)

  -- Org scope
  generated_at_level    VARCHAR(20) NOT NULL
                          CHECK (generated_at_level IN ('site','region','division','organisation')),
  scope_ref_id          UUID NOT NULL,

  -- Taxonomy context
  work_type_id          UUID REFERENCES work_type(id),
  practice_id           UUID REFERENCES safety_practice(id),

  -- Content
  pattern_summary       TEXT,
  likely_systemic_cause TEXT,
  recommended_action    TEXT,
  toolbox_narrative     TEXT,
  escalate_to_systemic  BOOLEAN DEFAULT false,
  escalation_rationale  TEXT,
  ai_generated_at       TIMESTAMPTZ,

  -- Human review
  reviewed_by_id        UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  review_action         VARCHAR(20) CHECK (review_action IN ('approved','edited','rejected')),
  reviewer_notes        TEXT,

  -- Sharing controls
  cleared_for_toolbox   BOOLEAN NOT NULL DEFAULT false,
  sharing_scope         VARCHAR(20) CHECK (sharing_scope IN ('site','region','division','organisation')),

  -- Systemic escalation
  systemic_investigation_id UUID,

  -- Forge Works Map® Classification
  fw_factors             VARCHAR(40)[],
  fw_domains             VARCHAR(10)[],
  fw_maturity_signals    VARCHAR(12)[],
  fw_confidences         DECIMAL(3,2)[],
  fw_rationales          TEXT[],
  fw_classification_basis TEXT,
  fw_classified_at       TIMESTAMPTZ,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_critical_insight_level ON safety_intelligence.critical_insight(generated_at_level, scope_ref_id);
CREATE INDEX idx_critical_insight_work_type ON safety_intelligence.critical_insight(work_type_id);
CREATE INDEX idx_critical_insight_cleared ON safety_intelligence.critical_insight(cleared_for_toolbox);
CREATE INDEX idx_critical_insight_trigger ON safety_intelligence.critical_insight(trigger_source);
```

**Solo critical trigger:** When an incident with `severity_class = 'critical'` is created, the triage algorithm may generate a CriticalInsight immediately without waiting for trend threshold. This bypasses the cooldown period. The `trigger_event` JSONB records `{ incident_id, severity_class, rationale }`. The human review gate still applies — solo_critical insights are not auto-approved.

---

### 3.5 ToolboxTalk

```sql
CREATE TABLE safety_intelligence.toolbox_talk (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  presenter_id          UUID NOT NULL REFERENCES users(id),
  work_type_id          UUID REFERENCES work_type(id),
  scheduled_for         TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,

  -- Content sources
  observation_ids       JSONB,
  investigation_ids     JSONB,
  critical_insight_ids  JSONB,

  -- AI-generated content
  generated_content     JSONB,
  -- structure: { hazard_intro, main_content, key_actions[], discussion_questions[], closing_line }
  generated_at          TIMESTAMPTZ,

  -- Presenter edits
  presenter_notes       TEXT,
  content_edited        BOOLEAN DEFAULT false,

  -- Delivery record
  attendee_ids          JSONB,
  attendee_count        INTEGER,
  acknowledgement_method VARCHAR(20) CHECK (acknowledgement_method IN ('digital','signature','verbal')),

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_toolbox_talk_worksite ON safety_intelligence.toolbox_talk(worksite_id, delivered_at);
CREATE INDEX idx_toolbox_talk_work_type ON safety_intelligence.toolbox_talk(work_type_id);
```

---

## 4. Schema — Enquiry Module

### 4.1 enquiry

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
  trigger_id        UUID        NOT NULL,

  -- Content
  title             TEXT        NOT NULL,
  context_narrative TEXT,
  work_type_id      UUID        REFERENCES work_type(id),

  -- Workflow state
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','closed','cancelled')),
  created_by_id     UUID        NOT NULL REFERENCES users(id),
  dispatched_at     TIMESTAMPTZ,
  deadline_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  closed_by_id      UUID        REFERENCES users(id),

  -- Targeting defaults (per-question targeting overrides)
  default_target_type   VARCHAR(20) CHECK (default_target_type IN ('site_role','named_individuals','site_scope')),
  default_target_scope  VARCHAR(20) CHECK (default_target_scope IN ('source_sites','region','division','organisation','custom')),
  default_target_role   VARCHAR(20) CHECK (default_target_role IN ('supervisor','manager','both')),

  -- AI synthesis (updated per response)
  ai_synthesis          JSONB,
  ai_synthesis_at       TIMESTAMPTZ,

  -- Final summary
  summary               TEXT,
  summary_generated_at  TIMESTAMPTZ,
  recommended_actions   JSONB,

  -- Notify
  notify_message        TEXT,

  -- Forge Works Map® Classification
  fw_factors             VARCHAR(40)[],
  fw_domains             VARCHAR(10)[],
  fw_maturity_signals    VARCHAR(12)[],
  fw_confidences         DECIMAL(3,2)[],
  fw_rationales          TEXT[],
  fw_classification_basis TEXT,
  fw_classified_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enquiry_trigger    ON safety_intelligence.enquiry(trigger_source, trigger_id);
CREATE INDEX idx_enquiry_status     ON safety_intelligence.enquiry(status);
CREATE INDEX idx_enquiry_created_by ON safety_intelligence.enquiry(created_by_id);
```

---

### 4.2 enquiry_question

```sql
CREATE TABLE safety_intelligence.enquiry_question (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id       UUID        NOT NULL REFERENCES safety_intelligence.enquiry(id),
  position         INTEGER     NOT NULL,

  -- Content
  question_text    TEXT        NOT NULL,
  question_type    VARCHAR(30) NOT NULL
                   CHECK (question_type IN (
                     'assurance','likelihood','prevalence',
                     'evidence','work_as_done','gap_identification','comparative'
                   )),

  -- Response configuration
  response_options JSONB,
  allow_photo      BOOLEAN     DEFAULT false,
  require_note_if  JSONB,
  ai_rationale     TEXT,

  -- Per-question targeting
  target_type      VARCHAR(20) CHECK (target_type IN ('site_role','named_individuals','site_scope')),
  target_scope     VARCHAR(20) CHECK (target_scope IN ('source_sites','region','division','organisation','custom')),
  target_ids       JSONB,
  target_role      VARCHAR(20) CHECK (target_role IN ('supervisor','manager','both')),

  -- AI-suggested flag
  ai_suggested     BOOLEAN     DEFAULT true,
  removed_by_user  BOOLEAN     DEFAULT false,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eq_question_enquiry ON safety_intelligence.enquiry_question(enquiry_id, position);
```

---

### 4.3 enquiry_response

One record per recipient per question. Created in bulk on dispatch.

```sql
CREATE TABLE safety_intelligence.enquiry_response (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id        UUID        NOT NULL REFERENCES safety_intelligence.enquiry(id),
  question_id       UUID        NOT NULL REFERENCES safety_intelligence.enquiry_question(id),
  respondent_id     UUID        NOT NULL REFERENCES users(id),
  worksite_id       UUID        NOT NULL REFERENCES worksite(id),

  -- Response state
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','answered','skipped')),
  answered_at       TIMESTAMPTZ,

  -- Response values
  selected_option   TEXT,
  note_text         TEXT,
  photo_url         TEXT,
  gap_category      VARCHAR(20)
                    CHECK (gap_category IN ('people','process','equipment','environment')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (question_id, respondent_id)
);

CREATE INDEX idx_eq_response_enquiry  ON safety_intelligence.enquiry_response(enquiry_id);
CREATE INDEX idx_eq_response_question ON safety_intelligence.enquiry_response(question_id);
CREATE INDEX idx_eq_response_status   ON safety_intelligence.enquiry_response(status);
```

---

### 4.4 insight_endorsement & insight_comment

```sql
CREATE TABLE safety_intelligence.insight_endorsement (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id    UUID        NOT NULL REFERENCES safety_intelligence.critical_insight(id),
  user_id       UUID        NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insight_id, user_id)
);

CREATE TABLE safety_intelligence.insight_comment (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id          UUID        NOT NULL REFERENCES safety_intelligence.critical_insight(id),
  user_id             UUID        NOT NULL REFERENCES users(id),
  body                TEXT        NOT NULL,
  is_approval_comment BOOLEAN     DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. Schema — Output Entities

### 5.1 situational_brief

Auto-generated learning report triggered when a Critical Insight is approved or investigation closes. Reviewed before distribution — never auto-sent. Audience: managers and safety professionals within the approved sharing scope. Not crew-facing.

```sql
CREATE TABLE safety_intelligence.situational_brief (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source    VARCHAR(20) NOT NULL CHECK (trigger_source IN ('critical_insight','investigation')),
  trigger_id        UUID        NOT NULL,

  -- Content (AI generated, human reviewed)
  title             TEXT        NOT NULL,
  what_happened     TEXT,
  what_it_means     TEXT,
  fw_factors         VARCHAR(40)[],
  fw_domains         VARCHAR(10)[],
  fw_maturity_signals VARCHAR(12)[],
  fw_confidences     DECIMAL(3,2)[],
  fw_rationales      TEXT[],
  fw_classification_basis TEXT,
  what_is_being_done TEXT,
  key_questions     JSONB,

  -- Workflow
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','distributed','cancelled')),
  reviewed_by_id    UUID        REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  distributed_at    TIMESTAMPTZ,
  sharing_scope     VARCHAR(20),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### 5.2 cop_thread_seed

AI-generated discussion thread seeded into the relevant CoP room when a Critical Insight is approved or investigation closes.

```sql
CREATE TABLE safety_intelligence.cop_thread_seed (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source    VARCHAR(20) NOT NULL CHECK (trigger_source IN ('critical_insight','investigation')),
  trigger_id        UUID        NOT NULL,

  -- Content
  thread_title      TEXT        NOT NULL,
  thread_body       TEXT        NOT NULL,
  opening_question  TEXT        NOT NULL,
  fw_factor         VARCHAR(40),
  fw_domain         VARCHAR(10),

  -- Targeting
  primary_room_id   VARCHAR(100) NOT NULL,
  secondary_room_id VARCHAR(100),
  seeded_by_id      UUID        REFERENCES users(id),

  -- State
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','seeded','cancelled')),
  seeded_at         TIMESTAMPTZ,
  external_thread_id VARCHAR(200),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Thread structure:**
1. Header attribution: "Generated from Critical Insight CI-042, approved by [Safety Manager] · [date]"
2. Opening: the pattern or finding in plain language — the actual substance, not a link
3. Open question inviting field experience
4. FW Map® factor tag (if classified with sufficient confidence)
5. Link to full insight/investigation

**Integration note:** CoP platform API credentials and room ID mapping are org-level config. The table is platform-agnostic — seeding is handled by an integration adapter per CoP platform (Viva Engage, Slack, custom, etc.).

---

### 5.3 visit_briefing

Digital briefing generated 48 hours before a planned manager visit. Transitions from planning reference to active visit guide when the manager taps Start Visit.

```sql
CREATE TABLE safety_intelligence.visit_briefing (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_plan_id     UUID        NOT NULL REFERENCES safety_intelligence.visit_plan(id),
  worksite_id       UUID        NOT NULL REFERENCES worksite(id),
  manager_id        UUID        NOT NULL REFERENCES users(id),

  -- Generated content
  site_snapshot     JSONB,        -- atrophy score, key metrics at generation time
  active_insights   JSONB,
  open_actions      JSONB,
  open_investigations JSONB,
  focus_areas       JSONB,
  last_visit_summary TEXT,
  fw_signal         JSONB,

  -- State
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at         TIMESTAMPTZ,
  visit_started_at  TIMESTAMPTZ,
  snapshot_expires_at TIMESTAMPTZ
);
```

**Mobile behaviour:**
- Available in Visit Plan Detail from generation moment
- Pre-visit: read-only briefing with all sections expanded
- Active (after Start Visit): focus areas become capture prompts; other sections collapse to quick-reference
- Stale flag shown if briefing >48h old and visit hasn't started

---

## 6. API Endpoints

All endpoints follow REST conventions. Authentication via existing platform auth middleware.

### 6.1 Observations

```
POST   /api/v1/observations
GET    /api/v1/observations/:id
GET    /api/v1/worksites/:worksite_id/observations
PATCH  /api/v1/observations/:id/sharing
```

**POST body:**
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
On creation: `observer_id` set from auth token, `observed_at` to now, `cleared_for_sharing` to true. Async AI enrichment job queued immediately.

---

### 6.2 Incidents

```
POST   /api/v1/incidents
GET    /api/v1/incidents/:id
GET    /api/v1/worksites/:worksite_id/incidents
```

On creation: triage algorithm runs synchronously. If `requires_investigation = true`, an Investigation record is created and assignee notified. AI investigation assistance job queued.

---

### 6.3 Investigations

```
GET    /api/v1/investigations/:id
PATCH  /api/v1/investigations/:id
POST   /api/v1/investigations/:id/close
```

**POST close body:**
```json
{
  "cleared_for_sharing": true,
  "sharing_scope": "site | region | division | organisation",
  "legal_hold": false
}
```
On close: if `cleared_for_sharing = true` and `legal_hold = false`, AI toolbox narrative generation queued.

---

### 6.4 Critical Insights

```
GET    /api/v1/critical-insights/:id
GET    /api/v1/critical-insights?level=region&scope_ref_id=uuid
POST   /api/v1/critical-insights                -- manual/external creation
POST   /api/v1/critical-insights/:id/review     -- human approval action
```

**POST (manual/external) body:**
```json
{
  "trigger_source": "manual | external_alert | external_investigation | solo_critical",
  "work_type_id": "uuid",
  "generated_at_level": "site | region | division | organisation",
  "scope_ref_id": "uuid",
  "pattern_summary": "string",
  "likely_systemic_cause": "string",
  "recommended_action": "string",
  "toolbox_narrative": "string",
  "sharing_scope": "region",
  "escalate_to_systemic": false,
  "source_metadata": {}
}
```
On manual creation: `cleared_for_toolbox = true` immediately. `reviewed_by_id = creator`, `review_action = 'approved'`, `reviewed_at = now()`. `fw_classify` job queued immediately.

**POST review body (algorithm-triggered insights):**
```json
{
  "action": "approved | edited | rejected",
  "edited_content": {},
  "sharing_scope": "region",
  "reviewer_notes": "string | null"
}
```
On approval: `cleared_for_toolbox = true`. If `escalate_to_systemic = true`, systemic investigation workflow triggered.

---

### 6.5 Toolbox Talks

```
POST   /api/v1/toolbox-talks/generate
GET    /api/v1/toolbox-talks/:id
PATCH  /api/v1/toolbox-talks/:id/deliver
```

**POST generate body:**
```json
{
  "worksite_id": "uuid",
  "work_type_id": "uuid",
  "presenter_id": "uuid"
}
```
Returns fully assembled talk. Content selection synchronous; AI assembly synchronous (target < 8s).

---

### 6.6 Enquiries

```
POST   /api/v1/enquiries
GET    /api/v1/enquiries/:id
GET    /api/v1/enquiries?trigger_source=critical_insight&status=active
PATCH  /api/v1/enquiries/:id
POST   /api/v1/enquiries/:id/dispatch
POST   /api/v1/enquiries/:id/close
GET    /api/v1/enquiries/:id/results
```

**POST body:**
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

**POST dispatch** — Locks question set. Creates `enquiry_response` records. Fires push notifications. No further edits to questions after dispatch.

**GET results** — Returns:
```json
{
  "enquiry_id": "uuid",
  "response_count": 9,
  "recipient_count": 12,
  "response_rate": 0.75,
  "per_question_results": [],
  "live_feed": [],
  "ai_synthesis": {
    "findings": [],
    "generated_at": "timestamptz",
    "response_count_at_generation": 9
  },
  "summary": null
}
```
`ai_synthesis` updates every time a new response is submitted. `summary` is null until close or manual trigger.

---

### 6.7 Output Entity APIs

**Situational Briefs:**
```
GET    /api/v1/situational-briefs/:id
POST   /api/v1/situational-briefs/:id/approve
POST   /api/v1/situational-briefs/:id/distribute
```

**CoP Thread Seeds:**
```
GET    /api/v1/cop-seeds/:id
POST   /api/v1/cop-seeds/:id/approve
POST   /api/v1/cop-seeds/:id/seed
```

**Visit Briefings:**
```
GET    /api/v1/visit-briefings/:visit_plan_id
```

---

## 7. Algorithm Engine

### 7.1 Incident Triage Rules

```
GIVEN a new incident record:

IF incident_type = 'injury'
  THEN requires_investigation = true

ELSE IF incident_type = 'near-miss'
  AND work_type.is_high_risk = true
  THEN requires_investigation = true

ELSE IF incident_type = 'property-damage'
  AND estimated_value > org.investigation_threshold_value
  THEN requires_investigation = true

ELSE
  requires_investigation = false

-- Solo critical trigger
IF severity_class = 'critical':
  CREATE critical_insight (
    trigger_source = 'solo_critical',
    trigger_event = { incident_id, severity_class, rationale },
    generated_at_level = 'site',
    cleared_for_toolbox = false  -- review gate still applies
  )
  QUEUE job: critical_insight.generate
  NOTIFY safety manager immediately

IF requires_investigation = true:
  CREATE investigation record
  SET investigation.status = 'open'
  ASSIGN to worksite.default_investigator_id (fallback: region safety manager)
  QUEUE job: investigation.assist
  TRIGGER notification to assignee
```

---

### 7.2 Trend Detection Rules

```
ON observation created (or enriched):

FOR EACH org level (site → region → division → organisation):

  count = COUNT observations WHERE:
    work_type_id = this.work_type_id
    AND observation_type IN ('near-miss', 'at-risk')
    AND cleared_for_sharing = true
    AND observed_at >= now() - INTERVAL '{{org.trend_window_days}} days'
    AND [scope matches this org level]

  threshold = org_threshold_config[level][work_type_id]
              ?? org_threshold_config[level]['default']
              ?? 5

  IF count >= threshold
    AND NOT EXISTS critical_insight WHERE:
      work_type_id = this.work_type_id
      AND generated_at_level = level
      AND created_at >= now() - INTERVAL '{{org.trend_cooldown_days}} days'
    THEN
      CREATE critical_insight (status: draft, cleared_for_toolbox: false)
      QUEUE job: critical_insight.generate
```

Threshold and cooldown values are configurable per organisation per level per work type.

---

### 7.3 Content Selection Rules

```
GIVEN: worksite_id, work_type_id, presenter_id

candidates = []

-- 1. Critical Insights (highest priority)
ADD critical_insight WHERE:
  cleared_for_toolbox = true
  AND sharing_scope covers this worksite's org path
  AND (work_type_id = input.work_type_id OR work_type_id IS NULL)
  AND NOT (legal_hold via any source_investigation_id)
  ORDER BY created_at DESC
  LIMIT 2

-- 2. Closed Investigations
ADD investigation WHERE:
  status = 'closed'
  AND cleared_for_sharing = true
  AND legal_hold = false
  AND sharing_scope covers this worksite's org path
  AND incident.work_type_id = input.work_type_id
  AND toolbox_narrative IS NOT NULL
  ORDER BY closed_at DESC
  LIMIT 2

-- 3. Recent Observations (last 7 days, same site)
ADD observation WHERE:
  worksite_id = input.worksite_id
  AND cleared_for_sharing = true
  AND observation_type IN ('near-miss', 'at-risk')
  AND work_type_id = input.work_type_id
  AND observed_at >= now() - INTERVAL '7 days'
  ORDER BY observed_at DESC
  LIMIT 3

-- 4. Older Observations (8–30 days)
ADD observation WHERE:
  worksite_id = input.worksite_id
  AND cleared_for_sharing = true
  AND observation_type IN ('near-miss', 'at-risk')
  AND work_type_id = input.work_type_id
  AND observed_at BETWEEN now() - INTERVAL '30 days' AND now() - INTERVAL '7 days'
  ORDER BY observed_at DESC
  LIMIT 3

-- De-duplication
REMOVE observation WHERE observation.id IN (
  SELECT unnest(source_observation_ids::uuid[])
  FROM critical_insight
  WHERE critical_insight.id IN [selected critical insight ids]
)

-- Final selection
RETURN candidates[0..2]  -- max 3 items, priority order maintained
```

---

### 7.4 Sharing Eligibility Gate

Runs on every content item before it enters the selection pool. Hard stops:

```
BLOCK if: legal_hold = true
BLOCK if: observation.cleared_for_sharing = false
BLOCK if: investigation.status != 'closed'
BLOCK if: investigation.cleared_for_sharing = false
BLOCK if: critical_insight.cleared_for_toolbox = false
BLOCK if: critical_insight has source_investigation with legal_hold = true

SCOPE CHECK:
  'site'         → content.worksite_id = request.worksite_id
  'region'       → content.worksite.region_id = request.worksite.region_id
  'division'     → content.worksite.division_id = request.worksite.division_id
  'organisation' → content.worksite.organisation_id = request.worksite.organisation_id
```

---

## 8. Logic Rules Reference

This section is the single source of truth for all business logic decisions. Rules here take precedence over any behaviour described elsewhere.

### 8.1 Observation Rules

**OBS-01: Default sharing**
```
New observations default to cleared_for_sharing = true.
Supervisor can set cleared_for_sharing = false at creation or any time before
the observation is used in a toolbox talk.
Once an observation has been included in a delivered toolbox talk, the sharing
flag is locked (cannot be changed).
```

**OBS-02: Anonymisation before AI processing**
```
Before any observation text is sent to an AI prompt:
  1. Run anonymisation_flags check (from prior enrichment if available)
  2. Strip any phrases matching anonymisation_flags
  3. Replace with generic descriptor (e.g. "a worker", "a vehicle operator")
  4. Log original and scrubbed versions separately (original never sent to AI)
```

**OBS-03: Safe observations in toolbox**
```
Observations with observation_type = 'safe' are NOT included in toolbox
content selection by default.
Exception: if presenter explicitly requests recognition content, safe observations
from own worksite in last 7 days may be included as an optional 4th item.
```

---

### 8.2 Incident & Investigation Rules

**INC-01: Investigation triage is deterministic**
```
The requires_investigation flag is set by algorithm only.
No human can override requires_investigation = false if the algorithm sets it true.
(They can close the investigation quickly, but cannot delete the requirement.)
```

**INC-02: AI suggestions are never authoritative**
```
Fields populated by AI investigation assistance (ai_suggested_*) are advisory only.
The authoritative fields (immediate_cause, root_cause, etc.) must be explicitly set
by the assigned investigator. The UI must make this visually clear.
```

**INC-03: Investigation sharing defaults**
```
cleared_for_sharing defaults to false for all investigations.
Must be explicitly set to true by the investigation closer.
The UI must not pre-select or default-suggest true.
```

**INC-04: Legal hold is permanent until explicitly removed**
```
When legal_hold = true:
  - Investigation excluded from ALL toolbox content queries
  - Any CriticalInsight including this investigation in source_investigation_ids is blocked
  - legal_hold can only be set or removed by Safety Manager or Platform Admin
  - Every change is audit-logged with user, timestamp, and reason
```

**INC-05: Narrative generation timing**
```
investigation.generate_narrative queued only when:
  status = 'closed'
  AND cleared_for_sharing = true
  AND legal_hold = false

If legal_hold set true after narrative generation:
  - toolbox_narrative is not deleted (preserve audit trail)
  - but investigation is excluded from content selection by legal_hold gate
```

---

### 8.3 Critical Insight Rules

**INS-01: Generated insights are always drafts**
```
CriticalInsights are created with cleared_for_toolbox = false.
Cannot become available for toolbox use without a human review action.
No default approval path or timed auto-approval.
```

**INS-02: Cooldown period prevents duplicate insights**
```
After a CriticalInsight is generated for a given work_type_id + org_level:
  - No new CriticalInsight generated for same combination for org.trend_cooldown_days (default: 30 days)
  - Cooldown resets if the reviewer rejects an insight
  - Solo_critical trigger bypasses cooldown
```

**INS-03: Rejection handling**
```
If reviewer action = 'rejected':
  - cleared_for_toolbox remains false
  - Insight is archived (not deleted)
  - Cooldown is reset for this work_type + org_level combination
  - Threshold config for this combination may be reviewed (flag for safety manager)
```

**INS-04: Systemic escalation is non-blocking**
```
If AI sets escalate_to_systemic = true in the draft, this is surfaced to the
reviewer as a recommendation only. The reviewer decides — not automatic.
Reviewer can approve for toolbox without escalating to systemic investigation.
```

**INS-05: Inherited legal hold**
```
If any source_investigation_id in a CriticalInsight has legal_hold = true:
  - CriticalInsight is blocked from toolbox content selection
  - Checked at query time, not stored on the insight
  - Reason: legal_hold status can change; the block must reflect current state
```

---

### 8.4 Toolbox Talk Rules

**TALK-01: Talk is generated on demand**
```
A new talk is generated on demand by the presenter.
The system does not automatically schedule or push talks.
If a talk has been generated for the same worksite + work_type today,
offer to reuse or regenerate.
```

**TALK-02: Content max 3 items (hard limit)**
```
Content selection returns a maximum of 3 items.
This is hard — additional content degrades attention and talk length.
If fewer than 3 eligible items exist, generate with what is available.
If 0 eligible items exist, generate using only work type taxonomy context
(PPE, controls, emergency — no observation-derived content).
```

**TALK-03: Presenter edit is always available**
```
Before marking a talk as delivered, the presenter can edit:
  - presenter_notes (site-specific context)
  - Any section of generated content (mark content_edited = true)
Edits stored; original generated content preserved separately for audit.
```

**TALK-04: Delivery record is final**
```
Once PATCH /toolbox-talks/:id/deliver is called:
  - delivered_at is set and locked
  - attendee_ids is locked
  - Content cannot be modified after delivery
This provides a defensible record for regulatory purposes.
```

**TALK-05: Attendance acknowledgement**
```
acknowledgement_method captures how attendance was confirmed.
Platform does not mandate a method — site conditions vary.
'digital' is preferred. 'signature' and 'verbal' are valid fallbacks.
```

---

### 8.5 Sharing Scope Resolution

```
FUNCTION can_share(content, requesting_worksite):

  IF content.sharing_scope = 'site':
    RETURN content.worksite_id = requesting_worksite.id

  IF content.sharing_scope = 'region':
    RETURN content.worksite.region_id = requesting_worksite.region_id

  IF content.sharing_scope = 'division':
    RETURN content.worksite.division_id = requesting_worksite.division_id
      OR content.worksite.sub_division_id = requesting_worksite.sub_division_id

  IF content.sharing_scope = 'organisation':
    RETURN content.worksite.organisation_id = requesting_worksite.organisation_id

  RETURN false
```

CriticalInsights generated at a level (e.g. `region`) inherit `sharing_scope = 'region'` automatically at generation time.

---

## 9. Enquiry Module

### 9.1 What the Enquiry System Is

The Enquiry is the pull counterpart to the Toolbox Talk push. The Toolbox Talk broadcasts learning to crews. The Enquiry gathers intelligence from sites. Both are triggered by the same intelligence pipeline.

```
Field Signal (observation / incident)
  │
  ▼
Intelligence Layer
  ├── Trend Detection ─────────────────────────────────┐
  │                                                    │
  └── Investigation (open)                             │
        ├── Mid-investigation cross-site check ── ENQUIRY ◄── Critical Insight (approved)
        └── Witness / participant questions             │
                                                       │
                              ┌────────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │                     │
             TOOLBOX TALK           ENQUIRY DISPATCH
             (broadcast)            (pull / learn)
                   │                     │
                   └──────────┬──────────┘
                              ▼
                       CORRECTIVE ACTIONS
                       (verified, owned, dated)
                              │
                              ▼
                         Loop Closed ✓
```

---

### 9.2 Trigger Sources

**Trigger 1 — Critical Insight Approved**

```
ON critical_insight.review_action = 'approved':
  CREATE enquiry (trigger_source = 'critical_insight', status = 'draft')
  QUEUE job: enquiry.generate_questions
  NOTIFY Safety Manager: "Enquiry draft ready"
```

AI generates questions by reading the insight's `pattern_summary`, `likely_systemic_cause`, and `toolbox_narrative`, plus the source observation cluster (anonymised) and existing observation pool (if prevalence data exists, prevalence question is not recommended). Default targeting: source sites only, supervisors.

**Trigger 2 — Investigation Mid-Enquiry**

```
TRIGGER: Investigator manually initiates
  OR: AI investigation assist flags suspected cross-site condition

LEGAL CHECK: IF investigation.legal_hold = true → BLOCK ENTIRELY (no override)

ON trigger (if clear):
  CREATE enquiry (trigger_source = 'investigation_mid', status = 'draft')
  context_narrative = "We are investigating an incident at one of our sites.
                       We need to check whether a related condition exists at yours."
  DEFAULT targeting: same-region sites
```

**Trigger 3 — Investigation Witness**

```
TRIGGER: Investigator adds named individuals to investigation record

LEGAL CHECK: IF investigation.legal_hold = true → BLOCK ENTIRELY

ON trigger (if clear):
  CREATE enquiry (
    trigger_source = 'investigation_witness',
    default_target_type = 'named_individuals',
    target_ids = [named_user_ids]
  )
```

Notification uses sensitive wording (N25). Witness responses are visible only to the investigation team — separate access control required.

---

### 9.3 Question Types

Seven types. AI selects the most appropriate. Safety manager can remove, add, or reorder.

**Assurance Check** — Use when you need to know if a specific control is in place right now. Response: Yes / Partially / No + mandatory note if Partially or No + optional photo.  
*Example: "Is a designated spotter assigned and confirmed in position before any heavy vehicle reversing operation begins on your site?"*

**Likelihood Assessment** — Use when you want to understand how supervisors perceive the risk before asking about controls. Response: Low / Moderate / High + optional brief reason.  
*Example: "How likely is it that a spotter could leave their position during a reversing operation without the operator knowing?"*

**Prevalence Check** — Use when observation pool data is thin and you need to understand frequency. AI will NOT recommend this type if sufficient prevalence data already exists in recent observations for this work type and site. Response: Never / Sometimes / Always + optional note.  
*Example: "How often do you see the PTW conditions being read before work starts?"*

**Evidence Request** — Use when visual proof of a physical condition is needed — not just attestation. Response: Required photo + description.  
*Example: "Take a photo of your current site traffic management plan showing how spotter positions are documented."*

**Work as Done** — Use when you need to understand actual practice vs documented procedure. Response: Free text (min 3 sentences encouraged). Prompt shown to supervisor: "Describe what actually happens, not what the procedure says." Always include at least one Work as Done question per enquiry — it captures what no other type can.  
*Example: "Describe how spotter assignment actually works on your site — from when the task starts to when it's complete."*

**Gap Identification** — Use when you want supervisors to name what's missing. Response: Free text + category tag (People / Process / Equipment / Environment).  
*Example: "What would need to change on your site for spotter management to work reliably every single time?"*

**Comparative Check** — Use when you need to know both whether a system exists AND whether it's working. Response: Exists & works / Has gaps / Doesn't exist + description.  
*Example: "Does your site have a process for handing over spotter responsibility — and is it working reliably?"*

---

### 9.4 Targeting Model

**Target Type:**
- `site_role` — all users of a given role at targeted sites (most common)
- `named_individuals` — specific named users (witness enquiries only)
- `site_scope` — all supervisors at specific sites regardless of role nuance

**Target Scope (for site_role and site_scope):**
- `source_sites` — only the sites whose observations triggered the insight
- `region` — all sites in the same region
- `division` — all sites in the division
- `organisation` — all sites organisation-wide
- `custom` — safety manager manually selects specific sites

**Target Role (for site_role):**
- `supervisor` — default for most questions
- `manager` — when the question is about management systems
- `both` — when both perspectives are needed

Per-question targeting overrides enquiry-level defaults. A single enquiry can have Q1 targeting source sites (supervisors) and Q2 targeting the full region (managers).

---

### 9.5 AI Prompts

#### Question Generation Prompt

**Job:** `enquiry.generate_questions` | **Model:** `claude-sonnet-4-20250514` | **Returns:** JSON array of question objects

**System prompt:**
```
You are a safety intelligence analyst generating field enquiry questions for a 
construction and industrial safety platform.

Your role is to generate the minimum set of questions that will give the safety 
manager the clearest possible picture of whether a risk condition exists at 
multiple sites — and what is actually happening in practice.

Rules:
- Generate 3-6 questions maximum. More questions = lower completion rate.
- Select question types that build on each other: start with perception 
  (likelihood), then control verification (assurance), then practice 
  (work as done), then gap (identification).
- Never recommend a Prevalence Check if you are told prevalence data exists.
- Always include at least one Work as Done question.
- Write questions in plain language a site supervisor can answer in 2 minutes.
- Do not use safety jargon.
- Each question must have a clear, single answer — no compound questions.
- Output ONLY valid JSON, no preamble.
```

**User prompt template:**
```
Trigger source: {{trigger_source}}

{{#if trigger_source == 'critical_insight'}}
Insight pattern: {{pattern_summary}}
Likely systemic cause: {{likely_systemic_cause}}
Work type: {{work_type_label}}
Source observation count: {{observation_count}}
Sample observations (anonymised): {{observation_summaries}}
Prevalence data available from existing observations: {{prevalence_available}}
{{/if}}

{{#if trigger_source == 'investigation_mid'}}
Incident narrative: {{incident_description}}
Suspected cross-site condition: {{contributing_factors}}
Work type: {{work_type_label}}
{{/if}}

{{#if trigger_source == 'investigation_witness'}}
Incident narrative: {{incident_description}}
Immediate cause (provisional): {{immediate_cause}}
Contributing factors (provisional): {{contributing_factors}}
These questions go to named witnesses — not site-wide.
{{/if}}

Generate a field enquiry question set. Return JSON array:
[
  {
    "position": 1,
    "question_type": "likelihood|assurance|prevalence|evidence|work_as_done|gap_identification|comparative",
    "question_text": "Plain language question",
    "response_options": ["Option A", "Option B", "Option C"] | null,
    "allow_photo": true | false,
    "require_note_if": ["Option B", "Option C"] | null,
    "ai_rationale": "Why this question, why this position, what it adds",
    "default_target_scope": "source_sites|region|division",
    "default_target_role": "supervisor|manager|both"
  }
]
```

---

#### Live Synthesis Prompt

**Job:** `enquiry.synthesise` (runs after every response) | **Model:** `claude-sonnet-4-20250514` | **Returns:** JSON stored in `enquiry.ai_synthesis`

**System prompt:**
```
You are synthesising field responses to a safety enquiry in real time. 
Responses are still arriving — your analysis should reflect what is 
known now, not wait for completeness.

Be direct. Name patterns clearly. Use colour-coded signal language:
- 🔴 Confirmed risk condition / control not in place
- 🟠 Likely condition / inconsistent control
- 🟡 Perceived risk / partial visibility  
- 💡 Actionable insight / convergent suggestion

Do not hedge unnecessarily. Output ONLY valid JSON.
```

**User prompt template:**
```
Enquiry: {{enquiry_title}}
Trigger: {{trigger_source}} — {{trigger_context}}
Responses received: {{response_count}} of {{total_recipients}}

Structured response distributions:
{{per_question_distributions}}

Free text response excerpts (anonymised by question):
{{free_text_excerpts}}

Generate a synthesis. Return JSON:
{
  "findings": [
    {
      "signal": "🔴|🟠|🟡|💡",
      "text": "Finding in plain language, specific, direct. Reference response counts."
    }
  ],
  "response_count": {{response_count}},
  "generated_at": "{{now}}"
}
```

---

#### Final Summary Prompt

**Job:** `enquiry.generate_summary` (on close or manual trigger) | **Model:** `claude-sonnet-4-20250514` | **Returns:** JSON stored in `enquiry.summary` + `enquiry.recommended_actions`

**System prompt:**
```
You are writing the final summary of a completed safety field enquiry. 
This summary will be read by safety managers, possibly shared with 
division leadership, and used to generate corrective actions and 
toolbox talk content.

Voice: Direct, evidence-based, no hedging. Name what was found.
Recommended actions must be specific and implementable — not generic 
safety advice. Output ONLY valid JSON.
```

**User prompt template:**
```
Enquiry: {{enquiry_title}}
Trigger: {{trigger_context}}
Total responses: {{response_count}} of {{total_recipients}}
Response rate: {{response_rate}}%

Final distributions:
{{per_question_final_distributions}}

All free text responses (anonymised):
{{all_free_text_responses}}

AI synthesis at close:
{{final_synthesis}}

Generate the final summary. Return JSON:
{
  "narrative": "3-5 sentences. What was found, across how many sites/responses, what the key condition is, what the field said.",
  "recommended_actions": [
    "Specific implementable action 1",
    "Specific implementable action 2",
    "Specific implementable action 3"
  ],
  "toolbox_narrative": "2-3 sentences suitable for a toolbox talk. Crew-facing language.",
  "escalate_to_systemic": true | false,
  "escalation_rationale": "If true: why this warrants escalation. If false: null."
}
```

---

### 9.6 Legal & Privacy Rules

1. **Legal hold hard block.** `investigation.legal_hold = true` prevents ANY enquiry creation from that investigation. Enforced at data layer. No override.
2. **Witness notification wording.** The N25 notification template requires approval from the organisation's legal and HR team before go-live. The platform provides the template — the org approves.
3. **Anonymisation.** No names, specific dates, or identifying worksite details in enquiry context narratives sent to supervisors. Context explains why without disclosing investigation specifics.
4. **Witness response confidentiality.** Witness responses visible only to the investigation team. They do not appear in the live feed or general enquiry results view. Separate access control required.
5. **Enquiry responses are not anonymous.** Supervisors know their responses are attributed. This is intentional — it enables follow-up and maintains accountability. Make this clear in the UI.

---

## 10. Integration Points

### 10.1 Read-Only References

| Existing Entity | Used For | Access Pattern |
|----------------|---------|----------------|
| `Organisation` | Org hierarchy traversal, sharing scope resolution | FK reference |
| `Division` / `SubDivision` | Hierarchy traversal | FK reference |
| `Region` | Sharing scope boundary | FK reference |
| `Worksite` | Primary anchor for all module entities | FK reference |
| `WorkType` | Hazard classification, content matching, trend grouping | FK reference |
| `SafetyPractice` | Secondary classification context | FK reference |
| `User` | Observer identity, reviewer identity, presenter identity | FK reference |

**Rule:** The module never modifies existing tables. All new data lives in new tables.

---

### 10.2 Authentication & Authorisation

The module uses existing platform auth middleware. No new auth system.

| Role | Observations | Incidents | Investigations | Insights (Review) | Talk Generate | Talk Deliver |
|------|-------------|-----------|----------------|-------------------|---------------|--------------|
| Supervisor | Create (own site) | Create (own site) | Read (own site) | — | Own site | Own site |
| Manager | Create (any site in scope) | Create | Read | — | Any in scope | — |
| Safety Manager | Read all in scope | Read all | Read + Close + Share | Approve/Reject | Any in scope | — |
| Platform Admin | All | All | All | All | All | All |

Scope boundaries follow the existing org hierarchy access model.

---

### 10.3 Configuration Reference

All threshold and behavioural values are configurable per organisation via `org_config`.

| Config Key | Default | Description |
|-----------|---------|-------------|
| `trend.window_days` | 30 | Rolling window for trend detection |
| `trend.threshold.site.default` | 3 | Near-miss count to trigger insight at site level |
| `trend.threshold.region.default` | 5 | Near-miss count to trigger insight at region level |
| `trend.threshold.division.default` | 10 | Near-miss count at division level |
| `trend.cooldown_days` | 30 | Days before same work_type + level triggers another insight |
| `observation.sharing_window_days` | 30 | Max age of observation for toolbox selection |
| `investigation.overdue_days` | 14 | Days before open investigation triggers overdue notification |
| `toolbox.content_max_items` | 3 | Max content items per talk |
| `toolbox.recent_window_days` | 7 | "Recent" observation window for priority ranking |
| `ai.model` | `claude-sonnet-4-20250514` | AI model for all prompts |
| `ai.max_tokens.default` | 1000 | Default token limit |
| `ai.max_tokens.talk_assembly` | 1500 | Token limit for talk assembly prompt |

---

## 11. Notification Events Registry

### Channels

| Channel | Description | When to use |
|---------|-------------|-------------|
| `push` | Mobile push notification | Immediate action required, urgent alerts |
| `inbox` | In-app workbench inbox item | Desktop action queue items |
| `feed` | In-app activity feed (non-urgent) | Informational updates, loop closure |
| `email` | Email | High-stakes events, overdue escalations |

**Tone types:** `action` (requires attention), `info` (no action needed), `social` (someone responded), `closure` (loop closes), `sensitive` (witness invitation)

---

### Observation Pipeline

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N01 | Threshold crossed | Algorithm detects N near-misses | Safety Manager (scope) | push, inbox | action | Immediate | "A pattern has been detected in [work type] at [scope]. An insight is being drafted for your review." |
| N02 | Critical Insight draft ready | AI generation complete | Safety Manager (scope) | push, inbox | action | Immediate | "A new Critical Insight is ready for your review: [insight title]. [N] endorsements from field managers." |
| N03 | Managers invited to endorse | Insight draft generated | Managers (affected sites) | push, feed | social | Immediate | "We've detected a pattern at your sites. Does this match what you're seeing? [insight title]" |

---

### Insight Review

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N04 | Endorsement added | Manager endorses insight | Safety Manager, prior commenters | feed | social | Batched (max 1/hr per insight) | "[Name] endorsed the insight and commented: [preview]" |
| N05 | Insight approved | Safety Manager approves | All endorsers, supervisors (scope) | push, feed | closure | Immediate | Endorsers: "The insight you endorsed has been approved." Supervisors: "New safety insight approved for your next toolbox talk." |
| N06 | Insight escalated | Safety Manager escalates | Division Safety Manager, Regional Manager | push, email | action | Immediate | "A systemic safety investigation has been initiated: [title]. Action required." |
| N07 | Insight review overdue | No action >48h | Safety Manager | push, email | action | 48h then daily | "Critical Insight [title] has been waiting [N] days for review. Action required." |
| N08 | Insight rejected | Safety Manager rejects | — | — | — | — | Silent. Cooldown resets internally. |

---

### Incident & Investigation

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N09 | Incident reported | Supervisor submits | Site Manager, Safety Manager | push, email | action | Immediate | "Incident reported at [site]. Type: [type]. [Investigation initiated / No investigation required]." |
| N10 | Investigation assigned | Triage auto-creates | Assigned Investigator | push, email | action | Immediate | "You've been assigned to investigate [INC-ref] at [site]. AI framework suggestions are ready." |
| N11 | Investigation overdue | Open >N days | Assigned Investigator, Site Manager | push, inbox | action | Daily until resolved | "Investigation [INC-ref] has been open [N] days. Please update or close." |
| N12 | Investigation closed | Safety Manager closes | Site Manager, Reporting Supervisor | feed | closure | Immediate | "Investigation [INC-ref] has been closed. [Findings will / will not] be included in toolbox talks." |

---

### Toolbox Talks

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N13 | Talk delivered | Supervisor delivers | Site Manager, Safety Manager, Endorsers (of insight used) | feed, inbox | closure | Immediate | Safety Manager/Manager: "Talk delivered at [site] — [N] crew reached." Endorsers: "The insight you endorsed has reached [N] crew members across [M] sites." |
| N14 | Talk undelivered — site alert | Talk generated but not delivered >24h | Site Supervisor, Site Manager | push | action | 24h after generation | "A toolbox talk for [work type] at [site] has been ready for [N] hours. Deliver it before the next shift." |

---

### Manager Visits

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N15 | Manager visit started | Manager taps Start Visit | Site Supervisor, Safety Manager | push | info | Immediate | "[Manager name] has started a field visit at your site." |
| N16 | Visit completed | Manager closes visit | Safety Manager | feed | info | Immediate | "Visit complete — [N] observations logged at [site]. Atrophy score updated." |
| N17 | Atrophy alert | Daily cron, score >70 | Assigned Manager, Safety Manager | push, inbox | action | Daily 8am | "[Site] hasn't had an observation in [N] days. A visit is recommended." |

---

### Corrective Actions

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N18 | Action assigned | Safety Manager creates action | Action Owner | push, email | action | Immediate | "You've been assigned a corrective action due [date]: [action text]. From investigation [INC-ref]." |
| N19 | Action due reminder | 3 days before due_date | Action Owner | push | action | 3 days prior | "Corrective action due in 3 days: [action text]." |
| N20 | Action overdue | Past due_date | Action Owner, Safety Manager | push, inbox | action | Daily until resolved | "Corrective action is [N] days overdue: [action text]. Owner: [name]." |
| N21 | Action verified | Safety Manager verifies | Site Supervisor, Action Owner | feed | closure | Immediate | "Corrective action completed and verified: [action text]. This closes the loop on [INC-ref]." |

---

### Enquiry Pipeline

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N22 | Enquiry draft ready | AI generates questions post-insight approval | Safety Manager | push, inbox | action | Immediate | "An enquiry has been drafted for CI-[id]. Review and dispatch to gather field intelligence." |
| N23 | Enquiry dispatched | Safety Manager dispatches | Targeted Supervisors | push, feed | action | Immediate | "A safety enquiry has been sent to your site. Your input helps us understand what's actually happening on the ground. Due: [deadline]." |
| N24 | Investigation mid-enquiry dispatched | Investigator dispatches | Targeted Supervisors | push, feed | action | Immediate | "We're currently investigating an incident at one of our sites. We need to check whether a related condition exists at your site. This will take about 3 minutes. Due: [deadline]." |
| N25 | Witness enquiry invitation | Investigator adds named individuals | Named Individuals | push, email | sensitive | Immediate | "You have been identified as a witness or participant in a safety investigation at [site]. Your input helps us understand what happened and prevent it happening again. Responses are confidential within the investigation team." |
| N26 | Enquiry response received | Supervisor submits | Safety Manager | feed | info | Batched per 3 responses | "[N] new responses received for enquiry EQ-[id]. Response rate: [%]." |
| N27 | Enquiry deadline reminder | 24h before deadline | Non-respondent supervisors | push | action | 24h before deadline | "Your response is needed for the safety enquiry at [site]. Closes in 24 hours." |
| N28 | Enquiry summary generated | Enquiry closed or manually triggered | Safety Manager, All respondents | push, feed | closure | Immediate | Safety Manager: "Enquiry EQ-[id] summary is ready. [N] responses across [M] sites." Respondents: "The enquiry you contributed to is closed. Here's what we found: [summary excerpt]." |
| N29 | Witness response acknowledged | Named individual submits | Named Individual | in-app only | closure | Immediate | "Your input has been recorded. The investigation team will use it to understand what happened and make the site safer." |
| N30 | Enquiry-informed talk generated | Enquiry summary feeds toolbox talk | Site Supervisors (scope) | feed | info | Immediate | "A new toolbox talk is available, informed by responses from [N] supervisors across [M] sites." |

---

### Notification Design Rules

1. **Push notifications should be rare and meaningful.** Action-required and sensitive events only. If everything is push, nothing gets attention.
2. **Feed is for information, not action.** If a user needs to do something, it's push + inbox. If they just need to know, it's feed.
3. **Closure notifications are the most important.** Telling a supervisor their near-miss observation reached 200 crew members is what makes people keep observing. Never omit closure events.
4. **Sensitive tone for witness invitations.** N25 wording must be approved by the organisation's legal and HR team before go-live.
5. **Batching prevents fatigue.** Endorsements (N04) and response receipts (N26) are batched. Immediate events (incident, assignment, overdue) are never batched.
6. **No notification for rejected insights.** Rejection is silent to field users. The corrective signal goes only to the internal system (reset cooldown).
7. **Legal hold blocks all enquiry notifications.** If `investigation.legal_hold = true`, N24 and N25 are blocked entirely.

---

## 12. Async Job Queue

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

All jobs are idempotent and retryable. Failed jobs must not block the primary user action.

---

## 13. Audit Logging

The following events must be logged to the platform audit log:

| Event | Required Fields |
|-------|----------------|
| Observation created | `observation_id`, `observer_id`, `worksite_id`, `observation_type` |
| Observation sharing toggled | `observation_id`, `actor_id`, `old_value`, `new_value` |
| Incident created | `incident_id`, `reporter_id`, `incident_type`, `severity_class`, `requires_investigation` |
| Investigation created (by triage) | `investigation_id`, `incident_id`, `assigned_to_id`, `trigger_rule` |
| Investigation closed | `investigation_id`, `closed_by_id`, `cleared_for_sharing`, `legal_hold` |
| Legal hold changed | `investigation_id`, `actor_id`, `old_value`, `new_value`, `reason` |
| CriticalInsight generated | `insight_id`, `trigger_source`, `generated_at_level`, `work_type_id`, `source_count` |
| CriticalInsight reviewed | `insight_id`, `reviewer_id`, `action`, `reviewer_notes` |
| AI call made | `prompt_key`, `prompt_version`, `entity_id`, `latency_ms`, `success` |
| Toolbox talk generated | `talk_id`, `worksite_id`, `work_type_id`, `content_item_ids` |
| Toolbox talk delivered | `talk_id`, `presenter_id`, `attendee_count`, `acknowledgement_method` |

---

## 14. Infrastructure Requirements

### 14.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXISTING PLATFORM                            │
│                                                                     │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│   │  Auth / IAM  │   │ Org Hierarchy│   │  Taxonomy Service    │  │
│   │  (existing)  │   │ Org→Div→     │   │  WorkType            │  │
│   │              │   │ Region→Site  │   │  SafetyPractice      │  │
│   └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘  │
└──────────┼────────────────────┼─────────────────────┼──────────────┘
           │                    │  referenced via FK   │
           ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       HIVIZ MODULE                                  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                     API LAYER (REST)                          │ │
│  │  /observations   /incidents   /investigations                 │ │
│  │  /critical-insights  /toolbox-talks  /enquiries               │ │
│  └──────────────────────────┬────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐ │
│  │                   SERVICE LAYER                               │ │
│  │  ObservationService  IncidentService  InvestigationService    │ │
│  │  CriticalInsightService  ToolboxTalkService  EnquiryService   │ │
│  └──────┬──────────────────────────────────────┬────────────────┘ │
│         │                                       │                  │
│  ┌──────▼───────────┐              ┌────────────▼───────────────┐ │
│  │  ALGORITHM ENGINE │              │    AI ORCHESTRATION        │ │
│  │  • Triage rules   │              │  • Job queue consumer      │ │
│  │  • Trend detection│              │  • Prompt template engine  │ │
│  │  • Content select │   ──fires──► │  • Anthropic API client    │ │
│  │  • Sharing gates  │              │  • Response parser/        │ │
│  │  • Legal hold     │              │    validator               │ │
│  └──────┬────────────┘              └────────────┬───────────────┘ │
│         │                                         │                 │
│  ┌──────▼─────────────────────────────────────────▼─────────────┐ │
│  │                      DATA LAYER                               │ │
│  │  PostgreSQL — safety_intelligence schema                      │ │
│  │  observation | incident | investigation | critical_insight    │ │
│  │  toolbox_talk | enquiry | enquiry_question | enquiry_response │ │
│  │  situational_brief | cop_thread_seed | visit_briefing         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   NOTIFICATION SERVICE                       │  │
│  │   (existing platform notification infra — extend only)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   ANTHROPIC API             │
│   /v1/messages              │
│   claude-sonnet-4-20250514  │
└─────────────────────────────┘
```

### 14.2 New Infrastructure Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| Job Queue | Async AI jobs | Redis + BullMQ, or existing queue infra |
| Anthropic API client | AI calls | Server-side only — API key never exposed to client |
| Prompt config store | Versioned prompts | PostgreSQL table (see prompts.md) |

### 14.3 Anthropic API

- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Auth:** `x-api-key` header — server-side env var only
- **Rate limits:** Monitor via response headers; implement exponential backoff on 529
- **Latency budget:** Target P95 < 8s per AI call for synchronous paths (talk assembly)
- **Retry policy:** 3 attempts with exponential backoff for async jobs; 1 retry for sync paths

### 14.4 Database

- PostgreSQL 14+
- All new tables in `safety_intelligence` schema
- Existing taxonomy and org tables accessed via cross-schema foreign keys
- Row-level security should mirror existing platform access patterns

---

## 15. Security & Compliance

| Concern | Approach |
|---------|----------|
| API key exposure | Anthropic API key stored as server-side env var; never in client code or responses |
| PII in AI prompts | `ai_anonymisation_flags` from enrichment used to scrub subsequent prompts referencing same observation |
| Legal hold enforcement | Hard block at data layer, not application layer — enforced in SQL query, not service code |
| Audit trail | All AI calls logged with `prompt_key`, `prompt_version`, `input_hash`, `output_hash`, `latency_ms` |
| Data retention | AI-generated content follows same retention rules as source records |
| AI output liability | All AI outputs stored as `draft` or `suggested`; human confirmation required before any field becomes authoritative |

---

## 16. V2/V3 Cascade Notes

Fields captured in V1 that are not yet fully consumed downstream. Do not re-design these fields — they are in the schema waiting to be used.

**stop_work_warranted divergence signal (V2)**
`observation.ai_stop_work_warranted` is set by enrichment independently of `observation.stop_work_called`. V2: Add divergence check in analytics. If `ai_stop_work_warranted = true` AND `stop_work_called = false`, flag in Leading Indicators view. Pass divergence count to `fw_classify` job as additional context.

**involved_role in trend detection (V2)**
`observation.involved_role` is captured but trend detection currently groups only by `work_type_id` and org scope. V2: Add `involved_role` as a secondary grouping dimension. Subcontractor near-misses clustering separately is a Contractor Management signal. Pass `involved_role` distribution to `fw_classify` job.

**fw_factors array into question generation (V2)**
`critical_insight.fw_factors` is populated but enquiry question generation (see Section 9.5) does not receive it. V2: Pass `fw_factors`, `fw_domains`, `fw_maturity_signals`, and `fw_rationales` into the question generation prompt. Question types should be selected per classified factor — Assurance Check for management_systems gaps, Work as Done for work_understanding gaps. See prompts.md Prompt 4 V2 note.

**fw_maturity_signals into talk generation (V2)**
`critical_insight.fw_maturity_signals` is populated but the talk assembly prompt uses fixed veteran voice. V2: Pass `fw_maturity_signals` into talk assembly. Adapt register — Compliant framing focuses on procedure gaps, Leading on what leaders should be noticing, Resilient on adaptive capacity. See prompts.md Prompt 3 V2 note.

**fw_factors arrays into situational briefs and visit briefings (V2)**
Prompts for situational briefs and visit briefings currently receive single fw_factor values. V2: Pass full `fw_factors` arrays with `fw_rationales` into both prompts for richer multi-factor outputs. See prompts.md Prompts 10 and 12 V2 notes.

**severity_class into fw_classify context (V2)**
`incident.severity_class` is stored but not yet passed to the `fw_classify` job. V2: Pass severity_class into the fw_classify job for CriticalInsights with `trigger_source = 'solo_critical'`. A critical severity incident is stronger evidence of a systemic factor than a trend of minor near-misses.

---

## 17. Devpack Index

Devpacks are per-feature build guides for Claude Code sessions. Each devpack contains the relevant schema slices, API endpoints, algorithm logic, notification events, and acceptance criteria for its feature. Build one feature at a time.

| Devpack | Feature | Key entities |
|---------|---------|--------------|
| `devpack/observations.md` | Observation capture, AI enrichment, sharing controls | `observation`, `worksite_role_slot` |
| `devpack/incidents.md` | Incident reporting, triage algorithm, regulatory flag | `incident`, `investigation` (stub) |
| `devpack/intelligence.md` | Trend detection, CriticalInsight generation & review, solo critical trigger | `critical_insight`, `insight_endorsement`, `insight_comment` |
| `devpack/toolbox.md` | Content selection, AI talk assembly, delivery recording | `toolbox_talk`, content selection algorithm |
| `devpack/visits.md` | Manager visit workflow, visit briefing, atrophy score | `visit_briefing`, `visit_plan` |
| `devpack/management-systems.md` | Corrective actions, investigation framework, audit trail | `investigation`, corrective action entities |
| `devpack/risk.md` | FW Map® classification, fw_classify job, risk reporting | `fw_*` fields across entities |

> Devpacks do not yet exist as files. This index defines the intended structure. Each devpack file will be created as its feature enters the build queue.
