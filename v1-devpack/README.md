# Hiviz — V1 Build Pack

**For:** Two full-stack developers
**Scope:** V1 — Core Loop (Epic E1–E8)
**Stack:** Next.js 14, TypeScript, PostgreSQL, Anthropic API
**Status:** Ready to build

---

## What V1 delivers

The complete intelligence loop:

```
Supervisor logs observation (type-agnostic — no category selected)
  → AI enriches async (signal type, energy, barrier, FW factor hint)
    → Context request fires if confidence < 0.70 (supervisor gets follow-up question)
      → Trend algorithm detects pattern
        → AI drafts Critical Insight
          → Safety Manager approves (Prioritise column)
            → AI generates Toolbox Talk + Enquiry questions
              → Supervisor delivers talk / responds to enquiry
                → Corrective actions assigned → checked off
```

Plus the manager visit workflow (atrophy → plan → observe → close) feeding the same pipeline.

And the V1 enquiry system: free-text questions dispatched to targeted supervisors → supervisors answer on mobile → AI synthesises responses.

---

## What V1 does NOT include

These are explicitly deferred. Do not build them.

- Incident module UI (data model ready, UI deferred to V2+)
- Structured enquiry question types (V2)
- Visit briefing pack AI generation (V2)
- Manual / external critical insight entry (V2)
- Situational briefs (V2)
- CoP thread seeding (V3)
- Board report / export (V3)
- Forge Works Map® analytics full view (V2 — placeholder only in V1)
- SSO / SAML (V3)
- Maturity-aware toolbox talk framing (V2 prompt update — classification data captured in V1)

---

## Key design decisions

**Observation capture is type-agnostic.** The supervisor never selects safe / at-risk / near-miss. They describe what they saw. The AI determines the signal type asynchronously after submission. `observation_type` does not exist as a user-facing field.

**AI output principle.** Every AI output is a suggestion with a visible reason — never a recommendation or directive. Every `ai_suggested_*` field has a companion rationale field. Fields without the `ai_suggested_` prefix are human-confirmed. This distinction must be preserved in the UI.

**Offline-first capture.** Observations are written locally first — before any network call. Enrichment is async and eventually consistent. The supervisor never waits. See the offline architecture doc.

**Endorsement is social, not a gate.** Safety managers can endorse an insight to signal agreement and lend weight. Endorsement does NOT block pipeline progression. Moving an insight from Prioritise → Learn is always a manual action by the safety manager who owns it. Endorsers are notified when the insight is resolved.

**Pipeline stages are explicit.** The insight Kanban has four columns: `prioritise | learn | improve | resolved`. `pipeline_stage` is a column on `critical_insight`.

---

## Tech stack decisions

| Concern | Decision | Reason |
|---------|----------|--------|
| Framework | Next.js 14 App Router | SSR for desktop, RSC where useful, API routes for BFF layer |
| Language | TypeScript throughout | No exceptions — safety-critical domain |
| Database | PostgreSQL 15+ | JSONB for AI output fields, strong indexing |
| ORM | Prisma | Schema migration tracking, type safety, good DX |
| Job queue | BullMQ (Redis) | All AI calls are async jobs. BullMQ is battle-tested. |
| AI | Anthropic SDK — `claude-sonnet-4-6` | Direct SDK, not wrapped. Job queue consumer calls Anthropic. |
| Mobile | Responsive Next.js + Capacitor wrapper | One codebase. Phone-first for supervisor/manager routes. |
| Auth | NextAuth v5 + existing platform session | Extend existing auth, do not build new |
| Notifications | Extend existing notification service | Emit events, do not build parallel delivery |
| Styling | Minimal UI kit (existing) | Already licensed, already in repo |
| File storage | S3-compatible (ObservationPhoto model) | Photos are a separate upload lifecycle — observation record not blocked |
| Local storage | Capacitor SQLite | Offline queue + sync lifecycle |

---

## Database schema — V1 entities

All new tables live in the `safety_intelligence` schema.

```sql
CREATE SCHEMA IF NOT EXISTS safety_intelligence;
```

### Entity relationship summary

```
worksite (existing)
  ├── observation ─────────────────────────────────────────┐
  │     ├── ai enrichment fields (signal, energy, barrier)  │
  │     ├── sync_status / enrichment_status lifecycle       │
  │     └── ObservationPhoto[]                              │
  ├── incident (schema ready, UI deferred)                  │
  ├── visit_plan                                            │
  ├── critical_insight ←── trend algorithm                  │
  │     ├── fw_factors[] parallel arrays                    │◄─ feeds
  │     ├── pipeline_stage                                  │
  │     └── insight_endorsement[]                           │
  ├── toolbox_talk ←── insight approval                     │
  ├── enquiry ←── insight approval                          │
  │     ├── enquiry_question (free text V1)                 │
  │     └── enquiry_response                                │
  └── corrective_action                                     │
                                                            │
worksite_role_slot / worksite_slot_assignment               │
ai_prompt_config                                            │
atrophy_score_log ─────────────────────────────────────────┘
```

### Full Prisma schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── EXISTING PLATFORM REFS ──────────────────────────────────────────────────

model User {
  id    String @id @default(uuid())
  // ... existing fields

  observations         Observation[]
  visits               VisitPlan[]
  insights_reviewed    CriticalInsight[]    @relation("ReviewedBy")
  talks_delivered      ToolboxTalk[]
  actions_assigned     CorrectiveAction[]   @relation("AssignedTo")
  actions_completed    CorrectiveAction[]   @relation("CompletedBy")
  enquiry_responses    EnquiryResponse[]
  endorsements         InsightEndorsement[]

  @@map("users")
}

model Worksite {
  id        String @id @default(uuid())
  name      String
  region_id String
  // ... existing fields

  observations       Observation[]
  incidents          Incident[]
  visits             VisitPlan[]
  insights           CriticalInsight[]
  talks              ToolboxTalk[]
  enquiries          Enquiry[]
  corrective_actions CorrectiveAction[]
  atrophy_logs       AtrophyScoreLog[]
  role_slots         WorksiteRoleSlot[]

  @@map("worksite")
}

model WorkType {
  id                   String  @id @default(uuid())
  label                String
  has_critical_controls Boolean @default(false)
  // V5: has_critical_controls drives the Risk Assurance module.
  // Add this column in V1 migration — costs nothing now, avoids
  // schema changes when the Risk Assurance module ships.

  observations Observation[]
  incidents    Incident[]
  insights     CriticalInsight[]
  talks        ToolboxTalk[]

  @@map("work_type")
}

// ─── OBSERVATION ─────────────────────────────────────────────────────────────

model Observation {
  id           String   @id @default(uuid())
  observer_id  String
  observer_role String  // supervisor | manager
  worksite_id  String
  work_type_id String?
  observed_at  DateTime @default(now())
  visit_id     String?

  // Content — type-agnostic capture
  // observation_type does NOT exist — supervisor never categorises.
  // Signal type is AI-determined (ai_signal_type below).
  what_was_observed      String
  immediate_action_taken String?
  people_involved_count  Int      @default(0)
  stop_work_called       Boolean  @default(false)
  // stop_work_called: only shown in UI when observation involves
  // an active work task — not for positive practice or procedural obs.
  involved_role          String?
  // employee | operator | subcontractor | visitor | unknown

  // ── SYNC LIFECYCLE ──────────────────────────────────────────────
  // Observations are written locally first. sync_status tracks the
  // device → server journey. enrichment_status tracks AI classification.
  sync_status          String   @default("queued")
  // queued | syncing | synced | failed
  sync_queued_at       DateTime?
  sync_completed_at    DateTime?
  sync_attempts        Int      @default(0)

  // ── ENRICHMENT LIFECYCLE ────────────────────────────────────────
  enrichment_status    String   @default("not_started")
  // not_started | pending | processing | complete | failed
  enrichment_queued_at     DateTime?
  enrichment_completed_at  DateTime?
  enrichment_attempts      Int      @default(0)
  enrichment_last_error    String?

  // ── AI ENRICHMENT FIELDS ────────────────────────────────────────
  // All nullable — populated async after submission.
  // Confidence threshold: 0.70. Below threshold the field stays null.

  // Signal type
  ai_signal_type           String?
  // positive_performance | weak_signal | at_risk_condition |
  // unwanted_energy_event | barrier_failure
  // Note: emerging_pattern is system-generated by trend algorithm,
  // never assigned by single-observation enrichment.
  ai_signal_confidence     Decimal?  @db.Decimal(3, 2)
  ai_signal_rationale      String?

  // Energy classification
  ai_energy_type           String?
  // kinetic | gravitational | electrical | thermal | chemical |
  // pressure | noise_vibration | none
  ai_energy_type_confidence  Decimal? @db.Decimal(3, 2)
  ai_energy_release_potential String?
  // catastrophic | high | moderate | low | none

  // Barrier assessment
  ai_barrier_assessment    String?
  // barrier_absent | barrier_failed | barrier_degraded |
  // barrier_held | none
  ai_barrier_confidence    Decimal?  @db.Decimal(3, 2)
  ai_barrier_rationale     String?

  // Stop work independent assessment
  ai_stop_work_warranted   Boolean?
  // AI's independent assessment — compare with stop_work_called
  // for warranted-but-not-called analytics signal (V2 cascade).

  // FW factor hint — low-confidence signal at observation level
  // NOT a full FW classification — that runs on richer context (insight/investigation).
  // Stored as a hint only; never displayed as a classification.
  ai_fw_factor_hint        String?
  ai_fw_factor_hint_confidence Decimal? @db.Decimal(3, 2)

  // Context request — fires when enrichment confidence < 0.70
  context_request_question String?
  // Targeted follow-up question sent to supervisor.
  // Populated by observation.context_request job.
  context_response         String?
  // Supervisor's response — triggers enrichment re-run.

  // Anonymisation
  ai_anonymisation_flags   Json?    // string[]

  // Sharing
  cleared_for_sharing Boolean @default(true)
  sharing_scope       String  @default("site")

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  observer  User      @relation(fields: [observer_id], references: [id])
  worksite  Worksite  @relation(fields: [worksite_id], references: [id])
  work_type WorkType? @relation(fields: [work_type_id], references: [id])
  visit     VisitPlan? @relation(fields: [visit_id], references: [id])
  photos    ObservationPhoto[]
  source_insights CriticalInsight[] @relation("SourceObservations")

  @@map("safety_intelligence.observation")
  @@index([worksite_id])
  @@index([work_type_id])
  @@index([ai_signal_type, observed_at])
  @@index([sync_status])
  @@index([enrichment_status])
  @@index([stop_work_called])
}

model ObservationPhoto {
  id             String   @id @default(uuid())
  observation_id String
  url            String?  // null until uploaded
  local_path     String?  // device path when offline
  upload_status  String   @default("queued")
  // queued | uploading | complete | failed
  uploaded_at    DateTime?
  created_at     DateTime @default(now())

  observation Observation @relation(fields: [observation_id], references: [id])

  @@map("safety_intelligence.observation_photo")
  @@index([observation_id])
}

// ─── INCIDENT ────────────────────────────────────────────────────────────────
// Schema ready. UI deferred to V2+.

model Incident {
  id             String   @id @default(uuid())
  reported_by_id String
  worksite_id    String
  work_type_id   String?
  occurred_at    DateTime
  reported_at    DateTime @default(now())
  discovered_at  DateTime?

  incident_type  String
  // near-miss | injury | property-damage | environmental
  description    String
  people_involved_count Int @default(0)

  injury_classification String?
  // none | first_aid | medical_treatment | restricted_work |
  // lost_time | fatality
  body_part_affected   String?
  nature_of_injury     String?
  mechanism_of_injury  String?
  site_location_type   String?

  notifiable_flag         Boolean  @default(false)
  notifiable_confirmed_at DateTime?
  notifiable_confirmed_by String?
  notifiable_dismissed    Boolean  @default(false)
  requires_investigation  Boolean  @default(false)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite  Worksite  @relation(fields: [worksite_id], references: [id])
  work_type WorkType? @relation(fields: [work_type_id], references: [id])

  @@map("safety_intelligence.incident")
  @@index([worksite_id])
  @@index([incident_type, occurred_at])
}

// ─── VISIT PLAN ──────────────────────────────────────────────────────────────

model VisitPlan {
  id          String   @id @default(uuid())
  manager_id  String
  worksite_id String

  status           String   @default("planned")
  // planned | active | completed | cancelled
  planned_date     DateTime
  started_at       DateTime?
  completed_at     DateTime?

  recommended_topics Json?
  selected_topics    Json?
  atrophy_score_at_plan Int?
  visit_notes        String?
  briefing_generated_at DateTime?
  // V2: populated when visit_briefing.generate job runs.
  // Add now — costs nothing, avoids V2 migration.

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  manager      User     @relation(fields: [manager_id], references: [id])
  worksite     Worksite @relation(fields: [worksite_id], references: [id])
  observations Observation[]

  @@map("safety_intelligence.visit_plan")
  @@index([worksite_id])
  @@index([manager_id, status])
}

// ─── ATROPHY SCORE ───────────────────────────────────────────────────────────

model AtrophyScoreLog {
  id          String   @id @default(uuid())
  worksite_id String
  score       Int
  calculated_at DateTime @default(now())

  days_since_last_obs   Int
  days_since_last_talk  Int
  open_investigations   Int
  near_miss_30d         Int

  worksite Worksite @relation(fields: [worksite_id], references: [id])

  @@map("safety_intelligence.atrophy_score_log")
  @@index([worksite_id, calculated_at])
}

// ─── CRITICAL INSIGHT ────────────────────────────────────────────────────────

model CriticalInsight {
  id String @id @default(uuid())

  trigger_source String @default("algorithm")
  // algorithm | manual (V2) | external_alert (V2) | external_investigation (V2)

  source_observation_ids Json?   // string[]
  source_metadata        Json?
  trigger_event          Json?

  generated_at_level String  // site | region | division | organisation
  scope_ref_id       String
  worksite_id        String
  work_type_id       String?
  practice_id        String?

  // Content
  pattern_summary       String?
  likely_systemic_cause String?
  recommended_action    String?
  toolbox_narrative     String?
  escalate_to_systemic  Boolean  @default(false)
  escalation_rationale  String?
  ai_generated_at       DateTime?

  // Pipeline stage — explicit Kanban column
  pipeline_stage String @default("prioritise")
  // prioritise | learn | improve | resolved
  stage_updated_at DateTime?
  stage_updated_by String?

  // Human review
  reviewed_by_id  String?
  reviewed_at     DateTime?
  review_action   String?
  // approved | edited | rejected
  reviewer_notes  String?

  // Sharing
  cleared_for_toolbox Boolean @default(false)
  sharing_scope       String?

  // Forge Works Map® Classification — multi-factor parallel arrays
  // Each index corresponds: factor[i], domain[i], confidence[i], rationale[i]
  // Only factors independently meeting fw_confidence >= 0.70 are stored.
  // Max 3 factors. Empty array = attempted, nothing met threshold.
  // NULL arrays = not yet attempted.
  fw_factors           String[]  // e.g. ["management_systems", "operational_management"]
  fw_domains           String[]  // e.g. ["enable", "enable"]
  fw_maturity_signals  String[]  // e.g. ["compliant", "leading"]
  fw_confidences       Decimal[] @db.Decimal(3, 2)
  fw_rationales        String[]  // rationale[i] defends factor[i] — shown inline, not in tooltip
  fw_classification_basis String?
  fw_classified_at     DateTime?

  systemic_investigation_id String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite       Worksite  @relation(fields: [worksite_id], references: [id])
  work_type      WorkType? @relation(fields: [work_type_id], references: [id])
  reviewed_by    User?     @relation("ReviewedBy", fields: [reviewed_by_id], references: [id])
  source_obs     Observation[] @relation("SourceObservations")
  toolbox_talks  ToolboxTalk[]
  enquiries      Enquiry[]
  corrective_actions CorrectiveAction[]
  endorsements   InsightEndorsement[]

  @@map("safety_intelligence.critical_insight")
  @@index([worksite_id])
  @@index([pipeline_stage])
  @@index([work_type_id])
  @@index([cleared_for_toolbox])
  @@index([trigger_source])
}

// ─── INSIGHT ENDORSEMENT ─────────────────────────────────────────────────────
// Social signal — not a gate. Endorsers notified on resolution.

model InsightEndorsement {
  id         String   @id @default(uuid())
  insight_id String
  user_id    String
  note       String?  // optional comment with endorsement
  created_at DateTime @default(now())

  insight CriticalInsight @relation(fields: [insight_id], references: [id])
  user    User            @relation(fields: [user_id], references: [id])

  @@unique([insight_id, user_id])
  @@map("safety_intelligence.insight_endorsement")
}

// ─── TOOLBOX TALK ────────────────────────────────────────────────────────────

model ToolboxTalk {
  id           String @id @default(uuid())
  worksite_id  String
  presenter_id String
  work_type_id String?
  insight_id   String?

  generated_content Json?
  // { hazard_intro, main_content, key_actions[], discussion_questions[], closing_line }

  status        String   @default("generated")
  // generated | delivered | cancelled
  scheduled_for DateTime?
  delivered_at  DateTime?

  attendee_ids   Json?
  attendee_count Int    @default(0)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite  Worksite        @relation(fields: [worksite_id], references: [id])
  presenter User            @relation(fields: [presenter_id], references: [id])
  work_type WorkType?       @relation(fields: [work_type_id], references: [id])
  insight   CriticalInsight? @relation(fields: [insight_id], references: [id])

  @@map("safety_intelligence.toolbox_talk")
  @@index([worksite_id])
  @@index([presenter_id, status])
}

// ─── ENQUIRY ─────────────────────────────────────────────────────────────────
// V1: free text only. V2 adds structured question types.

model Enquiry {
  id          String @id @default(uuid())
  created_by  String
  worksite_id String?
  insight_id  String?

  trigger_source String // insight | manual
  title          String
  deadline       DateTime

  target_scope     String
  target_scope_ids Json?

  status String @default("draft")
  // draft | dispatched | active | closed

  synthesis_findings  Json?
  summary_narrative   String?
  recommended_actions Json?

  recipient_count Int @default(0)
  response_count  Int @default(0)

  // Forge Works Map® — populated by fw_classify job after enquiry closes
  fw_factors          String[]
  fw_domains          String[]
  fw_maturity_signals String[]
  fw_confidences      Decimal[] @db.Decimal(3, 2)
  fw_rationales       String[]
  fw_classification_basis String?
  fw_classified_at    DateTime?

  dispatched_at DateTime?
  closed_at     DateTime?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite           Worksite?        @relation(fields: [worksite_id], references: [id])
  insight            CriticalInsight? @relation(fields: [insight_id], references: [id])
  questions          EnquiryQuestion[]
  responses          EnquiryResponse[]
  corrective_actions CorrectiveAction[]

  @@map("safety_intelligence.enquiry")
  @@index([worksite_id])
  @@index([insight_id])
  @@index([status])
}

model EnquiryQuestion {
  id         String @id @default(uuid())
  enquiry_id String
  position   Int

  // V1: free text only. question_type left nullable — V2 populates it.
  // Do NOT add NOT NULL constraint here.
  question_text  String
  question_type  String?
  // V2 values: assurance_check | likelihood_assessment | prevalence_check |
  // evidence_request | work_as_done | gap_identification | comparative_check
  ai_rationale   String?

  // V2 additions — nullable in V1
  response_options      Json?
  requires_note_if      String?
  allow_photo           Boolean  @default(false)
  gap_category_options  Json?

  created_at DateTime @default(now())

  enquiry   Enquiry           @relation(fields: [enquiry_id], references: [id], onDelete: Cascade)
  responses EnquiryResponse[]

  @@map("safety_intelligence.enquiry_question")
  @@index([enquiry_id])
}

model EnquiryResponse {
  id           String @id @default(uuid())
  enquiry_id   String
  question_id  String
  responder_id String

  free_text_answer String?

  // V2 additions — nullable in V1
  structured_value String?
  gap_category     String?
  photo_url        String?
  note             String?

  submitted_at DateTime @default(now())

  enquiry   Enquiry         @relation(fields: [enquiry_id], references: [id])
  question  EnquiryQuestion @relation(fields: [question_id], references: [id])
  responder User            @relation(fields: [responder_id], references: [id])

  @@unique([question_id, responder_id])
  @@map("safety_intelligence.enquiry_response")
  @@index([enquiry_id])
}

// ─── CORRECTIVE ACTION ───────────────────────────────────────────────────────

model CorrectiveAction {
  id          String @id @default(uuid())
  worksite_id String

  source_type String  // insight | enquiry
  insight_id  String?
  enquiry_id  String?

  description    String
  assigned_to_id String
  due_date       DateTime

  status       String   @default("open")
  // open | in_progress | complete | overdue
  completed_at DateTime?
  completed_by String?

  completion_note  String?
  completion_photo String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite    Worksite         @relation(fields: [worksite_id], references: [id])
  insight     CriticalInsight? @relation(fields: [insight_id], references: [id])
  enquiry     Enquiry?         @relation(fields: [enquiry_id], references: [id])
  assigned_to User             @relation("AssignedTo", fields: [assigned_to_id], references: [id])

  @@map("safety_intelligence.corrective_action")
  @@index([worksite_id, status])
  @@index([assigned_to_id, status])
  @@index([due_date, status])
}

// ─── WORKSITE PERSONNEL ──────────────────────────────────────────────────────

model WorksiteRoleSlot {
  id          String   @id @default(uuid())
  worksite_id String
  role        String
  // supervisor | manager | safety_professional | control_verifier (V5)
  created_at  DateTime @default(now())

  worksite    Worksite @relation(fields: [worksite_id], references: [id])
  assignments WorksiteSlotAssignment[]

  @@unique([worksite_id, role])
  @@map("safety_intelligence.worksite_role_slot")
}

model WorksiteSlotAssignment {
  id             String    @id @default(uuid())
  slot_id        String
  user_id        String
  assigned_by    String
  assigned_at    DateTime  @default(now())
  status         String    @default("active")
  // active | inactive
  deactivated_at DateTime?
  deactivated_by String?

  slot WorksiteRoleSlot @relation(fields: [slot_id], references: [id])
  user User             @relation(fields: [user_id], references: [id])

  @@unique([slot_id, user_id, status])
  @@map("safety_intelligence.worksite_slot_assignment")
  @@index([user_id, status])
}

// ─── AI PROMPT CONFIG ────────────────────────────────────────────────────────

model AiPromptConfig {
  id                   String   @id @default(uuid())
  prompt_key           String
  version              Int
  system_prompt        String
  user_prompt_template String
  model                String   @default("claude-sonnet-4-6")
  max_tokens           Int      @default(1000)
  is_active            Boolean  @default(false)
  created_at           DateTime @default(now())

  @@unique([prompt_key, version])
  @@map("safety_intelligence.ai_prompt_config")
}
```

---

## Job queue — all V1 jobs

All AI calls are async jobs. No AI call is made synchronously in an API route.

```typescript
// src/lib/jobs/index.ts

export const JOB_NAMES = {
  // Observation lifecycle
  OBSERVATION_ENRICH:           'observation.enrich',
  OBSERVATION_CONTEXT_REQUEST:  'observation.context_request',
  // Fires when enrichment confidence < 0.70 on key fields.
  // Generates one targeted follow-up question, delivers via
  // notification to observer. Observer response triggers re-enrichment.
  OBSERVATION_CONTEXT_ENRICH:   'observation.context_enrich',
  // Re-runs enrichment after observer responds to context question.

  // Insight pipeline
  INSIGHT_GENERATE:             'critical_insight.generate',
  INSIGHT_NOTIFY_REVIEWER:      'critical_insight.notify_reviewer',
  INSIGHT_ENDORSER_NOTIFY:      'critical_insight.notify_endorsers',
  // Fires when pipeline_stage → 'resolved'. Notifies all endorsers.
  FW_CLASSIFY:                  'fw_classify',

  // Toolbox talk
  TALK_GENERATE:                'toolbox_talk.generate',

  // Enquiry
  ENQUIRY_GENERATE_QUESTIONS:   'enquiry.generate_questions',
  ENQUIRY_SYNTHESISE:           'enquiry.synthesise',
  ENQUIRY_NOTIFY_RECIPIENTS:    'enquiry.notify_recipients',
  ENQUIRY_REMINDER:             'enquiry.reminder',

  // Scheduled
  ATROPHY_CALCULATE:            'atrophy.calculate',      // daily 02:00 UTC
  ACTION_OVERDUE_CHECK:         'action.overdue_check',   // daily 02:00 UTC
} as const

// All jobs are idempotent. Use jobId = `${jobName}:${entityId}`.
// Failed jobs retry 3 times with exponential backoff before dead-lettering.
// enrichment_attempts / sync_attempts are incremented on each retry.
```

### Job trigger map

| Event | Jobs fired | Notes |
|-------|-----------|-------|
| Observation created (synced) | `observation.enrich` | Always |
| Observation.enrich completes, confidence < 0.70 on signal_type or energy | `observation.context_request` | Conditional |
| Observer responds to context question | `observation.context_enrich` | Triggers re-enrichment |
| Observation.enrich completes, signal_type = barrier_failure or unwanted_energy_event | Trend check runs synchronously | In-process. If threshold crossed → `critical_insight.generate` |
| at_risk_condition / weak_signal pooled | Trend detection runs on schedule | Configurable window, default 30d |
| CriticalInsight created | `critical_insight.notify_reviewer`, `fw_classify` | Both fire |
| CriticalInsight pipeline_stage → 'resolved' | `critical_insight.notify_endorsers` | Notifies all who endorsed |
| CriticalInsight approved | `toolbox_talk.generate`, `enquiry.generate_questions` | Both fire |
| Enquiry dispatched | `enquiry.notify_recipients` | One per recipient |
| EnquiryResponse submitted | `enquiry.synthesise` | Debounced 30s |
| 24h before enquiry deadline | `enquiry.reminder` | Targets non-responders |
| Daily 02:00 UTC | `atrophy.calculate`, `action.overdue_check` | Scheduled |

---

## AI implementation

### Client setup

```typescript
// src/lib/ai/client.ts
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Model is read from ai_prompt_config, not hardcoded.
// Default for new configs:
export const AI_MODEL_DEFAULT = 'claude-sonnet-4-6'

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000,
  imageBlocks?: Array<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } }>
): Promise<unknown> {
  const content = imageBlocks
    ? [...imageBlocks, { type: 'text' as const, text: userPrompt }]
    : userPrompt

  const response = await anthropic.messages.create({
    model: AI_MODEL_DEFAULT,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  })

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  const clean = rawText.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
```

### Observation enrichment — signal type taxonomy

The enrichment job classifies observations into signal types. These are the only valid values:

| Signal type | Routing | Threshold needed |
|-------------|---------|-----------------|
| `positive_performance` | Pool → analytics only | No pipeline |
| `weak_signal` | Pool → trend detection | Configurable (default 5 in 30d) |
| `at_risk_condition` | Pool → trend detection | Configurable |
| `unwanted_energy_event` | **Pipeline direct** | One event sufficient |
| `barrier_failure` | **Pipeline direct** | One event sufficient |
| `emerging_pattern` | **Pipeline direct** | System-generated only — never assigned by enrichment |

---

## Trend detection algorithm

```typescript
// src/lib/algorithm/trend-detection.ts

interface TrendConfig {
  work_type_id: string
  org_level: 'site' | 'region' | 'division' | 'organisation'
  scope_ref_id: string
  threshold: number    // default 5
  window_days: number  // default 30
}

// Called synchronously after observation.enrich completes.
// Only runs for at_risk_condition, weak_signal.
// barrier_failure and unwanted_energy_event go to pipeline direct — no threshold.
export async function checkTrendThreshold(
  observation_id: string,
  config: TrendConfig
): Promise<{ crossed: boolean; count: number; observations: string[] }> {

  const since = new Date()
  since.setDate(since.getDate() - config.window_days)

  const observations = await prisma.observation.findMany({
    where: {
      work_type_id: config.work_type_id,
      // Pool signal types only — direct-route types never reach this check
      ai_signal_type: { in: ['at_risk_condition', 'weak_signal'] },
      observed_at: { gte: since },
      cleared_for_sharing: true,
      enrichment_status: 'complete',
      worksite_id: { in: await resolveWorksiteIds(config.org_level, config.scope_ref_id) }
    },
    select: { id: true }
  })

  return {
    crossed: observations.length >= config.threshold,
    count: observations.length,
    observations: observations.map(o => o.id)
  }
}
```

---

## Atrophy score formula

```typescript
// src/lib/algorithm/atrophy.ts

export function calculateAtrophyScore(data: {
  days_since_last_obs: number
  days_since_last_talk: number
  open_investigations: number
  near_miss_30d: number
}): number {
  const raw =
    data.days_since_last_obs   * 1.8 +
    data.days_since_last_talk  * 1.2 +
    data.open_investigations   * 8   +
    data.near_miss_30d         * 3

  return Math.min(100, Math.round(raw))
}

export function atrophyLevel(score: number): 'green' | 'amber' | 'red' {
  if (score >= 70) return 'red'
  if (score >= 40) return 'amber'
  return 'green'
}
```

---

## API routes — V1 surface

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/observations` | List, scoped to user | supervisor+ |
| POST | `/api/observations` | Create + queue enrich | supervisor+ |
| POST | `/api/observations/:id/context-response` | Submit context question answer → re-enrich | supervisor+ |
| GET | `/api/insights` | List, filtered by pipeline_stage/scope | safety_manager |
| GET | `/api/insights/:id` | Insight detail with source obs | safety_manager |
| POST | `/api/insights/:id/review` | Approve/edit/reject | safety_manager |
| PATCH | `/api/insights/:id/stage` | Move pipeline stage | safety_manager |
| POST | `/api/insights/:id/endorse` | Add/remove endorsement | safety_manager+ |
| GET | `/api/talks` | List talks | supervisor+ |
| GET | `/api/talks/:id` | Talk detail | supervisor+ |
| POST | `/api/talks/:id/deliver` | Record delivery + attendance | supervisor |
| GET | `/api/visits` | List visits | manager+ |
| POST | `/api/visits` | Create visit plan | manager+ |
| PATCH | `/api/visits/:id` | Update status | manager+ |
| GET | `/api/enquiries` | List enquiries | safety_manager |
| POST | `/api/enquiries` | Create + queue question gen | safety_manager |
| POST | `/api/enquiries/:id/dispatch` | Dispatch | safety_manager |
| GET | `/api/enquiries/:id/questions` | Questions for supervisor | supervisor+ |
| POST | `/api/enquiries/:id/respond` | Submit responses | supervisor |
| GET | `/api/actions` | List actions | supervisor+ |
| POST | `/api/actions` | Create (batch) | safety_manager |
| PATCH | `/api/actions/:id/complete` | Check off | supervisor |
| GET | `/api/analytics/atrophy` | Site atrophy scores | manager+ |
| GET | `/api/analytics/pipeline` | Pipeline health | safety_manager |
| GET | `/api/analytics/fw-capacity` | FW capacity data (empty state V1) | safety_manager |

---

## Environment variables

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Feature flags
FF_FW_CLASSIFY=true
FF_ATROPHY_ALERTS=true
FF_CONTEXT_REQUESTS=true   # observation.context_request job
```

---

## Development sequence

Two devs, parallel where possible.

### Week 1–2 — Foundation (E1)
Dev A: Database schema, Prisma, migrations, seed data, sync/enrichment status enums
Dev B: Auth, Next.js shell, route groups, navigation, offline queue skeleton (Capacitor SQLite)

### Week 3–4 — Capture & Pipeline (E2, E3)
Dev A: Observation API, AI enrichment job, context request job, trend detection
Dev B: Supervisor capture form (type-agnostic, FAB modal + full page), mobile home

### Week 5–6 — Intelligence & Delivery (E3 cont., E4)
Dev A: CriticalInsight generation, approval API, pipeline stage management, endorsement, FW classification job
Dev B: Safety manager pipeline Kanban (Prioritise/Learn/Improve/Resolved), detail panel state-based view, toolbox talk generation job, supervisor talk delivery view

### Week 7–8 — Manager Visit Flow (E5)
Dev A: Atrophy job, visit plan API, visit topic recommendation
Dev B: Plan a Visit wizard (3 steps: Site → When → Focus), active visit, visit close

### Week 9–10 — Enquiry & Actions (E6, E7)
Dev A: Enquiry data model, question generation job, synthesis job, dispatch
Dev B: Enquiry builder (desktop), supervisor response mobile view, corrective action create + mobile check-off

### Week 11–12 — Analytics & Polish (E8)
Dev A: Analytics API endpoints (atrophy, pipeline health, FW capacity empty state)
Dev B: Analytics views, FW Map placeholder ("N of 5 classifications needed"), notification wiring

---

## Notes for the team

**On observation capture:** There is no `observation_type` field. The supervisor describes what they saw. The AI determines the signal type. If a dev sees any reference to `safe | at-risk | near-miss` as a user-selected field, that is outdated.

**On the offline queue:** Observations must be writable when there's no network. Sync via Capacitor SQLite + background sync job. `sync_status` and `enrichment_status` are separate lifecycles — an observation can be synced but not yet enriched.

**On the context request loop:** When enrichment confidence is below 0.70 on the signal type or energy fields, the job fires a targeted follow-up question to the supervisor (one question, mobile notification). The supervisor's response triggers a re-enrichment run. This is a V1 feature — build it in Week 3.

**On pipeline stages:** `pipeline_stage` is an explicit column. Moving a card between Kanban columns writes to this column via PATCH `/api/insights/:id/stage`. Do not derive stage from other fields.

**On endorsements:** Endorsement is social, not a gate. Moving an insight from Prioritise → Learn does not require endorsements. When `pipeline_stage` is set to `resolved`, the `critical_insight.notify_endorsers` job fires and notifies everyone who endorsed.

**On FW classification:** Multi-factor parallel arrays. If `fw_factors` is an empty array and `fw_classified_at` is set, classification was attempted but nothing met the 0.70 threshold — this is correct behaviour. If `fw_factors` is null and `fw_classified_at` is null, classification hasn't run yet.

**On the AI model:** Read from `ai_prompt_config.model`. Default is `claude-sonnet-4-6`. Do not hardcode model strings in job handlers.

**On photos:** `ObservationPhoto` is a separate model. The observation record is created immediately — photo upload is a separate async lifecycle. Enrichment can optionally include photos if they're available within a short window, but should not wait for them.
