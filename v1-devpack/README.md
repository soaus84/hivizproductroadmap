# SafetyPlatform — V1 Build Pack

**For:** Two full-stack developers  
**Scope:** V1 — Core Loop (Epic E1–E8)  
**Stack:** Next.js 14, TypeScript, PostgreSQL, Anthropic API  
**Status:** Ready to build

---

## What V1 delivers

The complete intelligence loop:

```
Supervisor logs observation
  → AI enriches (async)
    → Trend algorithm detects pattern
      → AI drafts Critical Insight
        → Safety Manager approves
          → AI generates Toolbox Talk
            → Supervisor delivers to crew
              → Corrective actions assigned
                → Supervisor checks off on mobile
```

Plus the manager visit workflow (atrophy → plan → observe → close) feeding the same pipeline.

And the V1 enquiry system: safety manager sends a list of plain questions to targeted supervisors → supervisors answer in free text on mobile → AI synthesises responses.

---

## What V1 does NOT include

These are explicitly deferred. Do not build them.

- Incident module (investigation, injury classification, regulatory reporting)
- Structured enquiry question types (V2)
- Visit briefing pack AI generation (V2)
- Manual / external critical insight entry (V2)
- Situational briefs (V2)
- CoP thread seeding (V3)
- Board report / export (V3)
- Forge Works Map® analytics full view (V2 — placeholder only in V1)
- SSO / SAML (V3)
- Offline observation capture (defer unless pilot sites flag it)

---

## Tech stack decisions

| Concern | Decision | Reason |
|---------|----------|--------|
| Framework | Next.js 14 App Router | SSR for desktop, RSC where useful, API routes for BFF layer |
| Language | TypeScript throughout | No exceptions — safety-critical domain |
| Database | PostgreSQL 15+ | JSONB for AI output fields, strong indexing, existing platform likely PostgreSQL |
| ORM | Prisma | Schema migration tracking, type safety, good DX for two devs |
| Job queue | BullMQ (Redis) | All AI calls are async jobs. BullMQ is battle-tested, good visibility tooling |
| AI | Anthropic SDK (claude-sonnet-4-5) | Direct SDK, not wrapped. Job queue consumer calls Anthropic. |
| Mobile | Responsive Next.js — no separate app | Fully responsive. Mobile-primary for supervisor/manager routes. No React Native in V1. |
| Auth | NextAuth v5 + existing platform session | Extend existing auth, do not build new |
| Notifications | Extend existing notification service | Emit events, do not build parallel delivery |
| Styling | Minimal UI kit (existing) | Already licensed, already in repo |
| File storage | S3-compatible (photo_url) | Optional in V1 — only needed if photo upload is built |

---

## Repository structure

```
/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (supervisor)/             # Route group — mobile-primary
│   │   │   ├── home/page.tsx
│   │   │   ├── capture/page.tsx
│   │   │   ├── talk/[id]/page.tsx
│   │   │   ├── actions/page.tsx
│   │   │   └── records/page.tsx
│   │   ├── (manager)/                # Route group — mobile-primary
│   │   │   ├── visits/page.tsx
│   │   │   └── visit/[id]/page.tsx
│   │   ├── (safety)/                 # Route group — desktop-primary
│   │   │   ├── workbench/page.tsx
│   │   │   ├── insights/[id]/page.tsx
│   │   │   ├── enquiries/page.tsx
│   │   │   ├── enquiry/[id]/page.tsx
│   │   │   ├── actions/page.tsx
│   │   │   └── analytics/page.tsx
│   │   └── api/                      # API routes (BFF + internal)
│   │       ├── observations/
│   │       ├── insights/
│   │       ├── talks/
│   │       ├── visits/
│   │       ├── enquiries/
│   │       └── actions/
│   ├── lib/
│   │   ├── db/                       # Prisma client, query helpers
│   │   ├── ai/                       # Anthropic client, prompt templates, job handlers
│   │   ├── jobs/                     # BullMQ job definitions and consumers
│   │   ├── algorithm/                # Trend detection, atrophy, triage logic
│   │   └── notifications/            # Notification event emitter
│   ├── types/                        # Shared TypeScript types (mirror DB schema)
│   └── components/                   # Shared UI components
├── prisma/
│   ├── schema.prisma                 # Full V1 schema
│   └── migrations/
├── jobs/
│   └── worker.ts                     # BullMQ worker process (runs separately)
└── docs/                             # This pack lives here after setup
```

---

## Database schema — V1 entities only

All new tables live in the `safety_intelligence` schema to avoid collision with existing platform tables.

```sql
-- Run this first
CREATE SCHEMA IF NOT EXISTS safety_intelligence;
```

### Entity relationship summary

```
worksite (existing)
  ├── observation ──────────────────────────────────────────┐
  │     └── [AI enrichment fields]                          │
  ├── incident (data model ready, UI deferred to V2+)        │
  ├── visit_plan                                             │
  │     └── [observation.visit_id → visit_plan.id]           │
  ├── critical_insight ←── fires from: trend algorithm       │
  │     └── [fw_* classification fields — async]            │◄─ feeds
  ├── toolbox_talk ←── generated from: critical_insight      │
  │     └── talk_delivery_record                            │
  ├── enquiry ←── triggered by: insight approval            │
  │     ├── enquiry_question                                │
  │     └── enquiry_response                                │
  └── corrective_action ←── created from: insight / enquiry │
        └── [completed by supervisor]                        │
                                                             │
ai_prompt_config (prompt versioning)                         │
atrophy_score_log (daily snapshots)  ───────────────────────┘
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
// These models map to existing tables. Do not run migrations against them.
// Use @@map to point at the real table names in your existing schema.

model User {
  id    String @id @default(uuid())
  // ... existing fields
  
  observations       Observation[]
  visits             VisitPlan[]
  insights_reviewed  CriticalInsight[] @relation("ReviewedBy")
  talks_delivered    ToolboxTalk[]
  actions_assigned   CorrectiveAction[] @relation("AssignedTo")
  actions_completed  CorrectiveAction[] @relation("CompletedBy")
  enquiry_responses  EnquiryResponse[]

  @@map("users") // map to existing table
}

model Worksite {
  id         String @id @default(uuid())
  name       String
  region_id  String
  // ... existing fields

  observations      Observation[]
  incidents         Incident[]
  visits            VisitPlan[]
  insights          CriticalInsight[]
  talks             ToolboxTalk[]
  enquiries         Enquiry[]
  corrective_actions CorrectiveAction[]
  atrophy_logs      AtrophyScoreLog[]

  @@map("worksite") // map to existing table
}

model WorkType {
  id    String @id @default(uuid())
  label String
  
  observations Observation[]
  incidents    Incident[]
  insights     CriticalInsight[]
  talks        ToolboxTalk[]

  @@map("work_type")
}

// ─── NEW ENTITIES ─────────────────────────────────────────────────────────────

model Observation {
  id            String   @id @default(uuid())
  observer_id   String
  observer_role String   // supervisor | manager
  worksite_id   String
  work_type_id  String?
  practice_id   String?
  observed_at   DateTime @default(now())
  visit_id      String?

  // Content
  observation_type       String  // safe | at-risk | near-miss
  what_was_observed      String
  immediate_action_taken String?
  people_involved_count  Int     @default(0)
  stop_work_called       Boolean @default(false)
  involved_role          String? // employee | operator | subcontractor | visitor | unknown
  photo_url              String?

  // AI enrichment (all nullable — populated async)
  ai_failure_type            String?   // systemic | behavioural | environmental | unclear
  ai_severity_signal         String?
  ai_key_hazard              String?
  ai_stop_work_warranted     Boolean?  // AI's independent assessment
  ai_enrichment_confidence   Decimal?  @db.Decimal(3, 2)
  ai_anonymisation_flags     Json?     // string[]
  ai_inferred_work_type_ids  Json?     // string[]
  ai_inferred_practice_ids   Json?     // string[]
  ai_enriched_at             DateTime?

  // Sharing
  cleared_for_sharing Boolean @default(true)
  sharing_scope       String  @default("site")

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  observer  User     @relation(fields: [observer_id], references: [id])
  worksite  Worksite @relation(fields: [worksite_id], references: [id])
  work_type WorkType? @relation(fields: [work_type_id], references: [id])
  visit     VisitPlan? @relation(fields: [visit_id], references: [id])

  // Source for insights
  source_insights CriticalInsight[] @relation("SourceObservations")

  @@map("safety_intelligence.observation")
  @@index([worksite_id])
  @@index([work_type_id])
  @@index([observation_type, observed_at])
  @@index([stop_work_called])
}

model Incident {
  id              String   @id @default(uuid())
  reported_by_id  String
  worksite_id     String
  work_type_id    String?
  occurred_at     DateTime
  reported_at     DateTime @default(now())
  discovered_at   DateTime?

  incident_type  String  // near-miss | injury | property-damage | environmental
  description    String

  // Injury classification (conditional on incident_type = injury)
  injury_classification String? // first_aid | medical_treatment | restricted_work | lost_time | fatality
  body_part_affected    String?
  nature_of_injury      String?
  mechanism_of_injury   String?
  site_location_type    String?
  people_involved_count Int     @default(0)

  // Regulatory
  notifiable_flag          Boolean  @default(false)
  notifiable_confirmed_at  DateTime?
  notifiable_confirmed_by  String?
  notifiable_dismissed     Boolean  @default(false)

  // Routing (investigation deferred to V2+)
  requires_investigation Boolean @default(false)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite   Worksite @relation(fields: [worksite_id], references: [id])
  work_type  WorkType? @relation(fields: [work_type_id], references: [id])

  @@map("safety_intelligence.incident")
  @@index([worksite_id])
  @@index([incident_type, occurred_at])
}

model VisitPlan {
  id          String   @id @default(uuid())
  manager_id  String
  worksite_id String
  
  status           String   @default("planned") // planned | active | completed | cancelled
  planned_date     DateTime
  started_at       DateTime?
  completed_at     DateTime?
  
  // AI recommended topics (stored as JSONB)
  recommended_topics Json?  // { topic: string, source: string, sourceType: string }[]
  selected_topics    Json?  // string[]
  
  // Context snapshot at plan time
  atrophy_score_at_plan Int?
  
  // Visit notes
  visit_notes String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  manager      User     @relation(fields: [manager_id], references: [id])
  worksite     Worksite @relation(fields: [worksite_id], references: [id])
  observations Observation[]

  @@map("safety_intelligence.visit_plan")
  @@index([worksite_id])
  @@index([manager_id, status])
}

model AtrophyScoreLog {
  id          String   @id @default(uuid())
  worksite_id String
  score       Int
  calculated_at DateTime @default(now())
  
  // Component breakdown
  days_since_last_obs   Int
  days_since_last_talk  Int
  open_investigations   Int
  near_miss_30d         Int

  worksite Worksite @relation(fields: [worksite_id], references: [id])

  @@map("safety_intelligence.atrophy_score_log")
  @@index([worksite_id, calculated_at])
}

model CriticalInsight {
  id String @id @default(uuid())

  // Trigger
  trigger_source String @default("algorithm")
  // algorithm | manual | external_alert | external_investigation
  
  source_metadata          Json?   // varies by trigger_source — see README
  source_observation_ids   Json?   // string[] — algorithm-triggered only
  trigger_event            Json?   // threshold metadata — algorithm-triggered only

  // Scope
  generated_at_level String  // site | region | division | organisation
  scope_ref_id       String  // FK to relevant level entity
  worksite_id        String
  work_type_id       String?
  practice_id        String?

  // Content (AI-generated draft, human-editable)
  pattern_summary       String?
  likely_systemic_cause String?
  recommended_action    String?
  toolbox_narrative     String?
  escalate_to_systemic  Boolean  @default(false)
  escalation_rationale  String?
  ai_generated_at       DateTime?

  // Human review
  reviewed_by_id  String?
  reviewed_at     DateTime?
  review_action   String?   // approved | edited | rejected
  reviewer_notes  String?

  // Sharing
  cleared_for_toolbox Boolean @default(false)
  sharing_scope       String?

  // Forge Works Map® classification (async, confidence-gated at 0.70)
  fw_factor              String?
  fw_domain              String?   // guide | enable | execute
  fw_maturity_signal     String?   // compliant | leading | resilient
  fw_confidence          Decimal?  @db.Decimal(3, 2)
  fw_rationale           String?
  fw_classification_basis String?
  fw_classified_at       DateTime?

  // Escalation
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

  @@map("safety_intelligence.critical_insight")
  @@index([worksite_id])
  @@index([work_type_id])
  @@index([cleared_for_toolbox])
  @@index([trigger_source])
  @@index([fw_factor])
}

model ToolboxTalk {
  id           String @id @default(uuid())
  worksite_id  String
  presenter_id String
  work_type_id String?

  // Sources
  insight_id String?
  
  // Generated content
  generated_content Json?
  // {
  //   hazard_intro: string
  //   main_content: string
  //   key_actions: string[]
  //   discussion_questions: string[]
  //   closing_line: string
  // }

  // Delivery
  status        String   @default("generated") // generated | delivered | cancelled
  scheduled_for DateTime?
  delivered_at  DateTime?
  
  // Attendance (array of user IDs or names)
  attendee_ids   Json?   // string[]
  attendee_count Int     @default(0)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite   Worksite        @relation(fields: [worksite_id], references: [id])
  presenter  User            @relation(fields: [presenter_id], references: [id])
  work_type  WorkType?       @relation(fields: [work_type_id], references: [id])
  insight    CriticalInsight? @relation(fields: [insight_id], references: [id])

  @@map("safety_intelligence.toolbox_talk")
  @@index([worksite_id])
  @@index([presenter_id, status])
}

model Enquiry {
  id          String @id @default(uuid())
  created_by  String
  worksite_id String?
  insight_id  String?

  trigger_source String // insight | manual
  
  title       String
  deadline    DateTime
  
  // Targeting
  target_scope     String  // site | region | division
  target_scope_ids Json?   // string[] of scope entity IDs
  
  // Status lifecycle
  status String @default("draft")
  // draft | dispatched | active | closed

  // AI synthesis (updated per response, finalised on close)
  synthesis_findings Json?   // { icon: string, text: string }[]
  summary_narrative  String?
  recommended_actions Json?  // string[]

  // Response tracking
  recipient_count  Int @default(0)
  response_count   Int @default(0)

  dispatched_at DateTime?
  closed_at     DateTime?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite   Worksite?        @relation(fields: [worksite_id], references: [id])
  insight    CriticalInsight? @relation(fields: [insight_id], references: [id])
  questions  EnquiryQuestion[]
  responses  EnquiryResponse[]
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
  
  // V1: free text only. V2 adds type enum and structured options.
  question_text String
  ai_rationale  String?  // why this question was suggested

  created_at DateTime @default(now())

  enquiry   Enquiry           @relation(fields: [enquiry_id], references: [id], onDelete: Cascade)
  responses EnquiryResponse[]

  @@map("safety_intelligence.enquiry_question")
  @@index([enquiry_id])
}

model EnquiryResponse {
  id          String @id @default(uuid())
  enquiry_id  String
  question_id String
  responder_id String

  // V1: free text only
  free_text_answer String?
  
  submitted_at DateTime @default(now())

  enquiry  Enquiry         @relation(fields: [enquiry_id], references: [id])
  question EnquiryQuestion @relation(fields: [question_id], references: [id])
  responder User           @relation(fields: [responder_id], references: [id])

  @@unique([question_id, responder_id]) // one response per question per person
  @@map("safety_intelligence.enquiry_response")
  @@index([enquiry_id])
}

model CorrectiveAction {
  id          String @id @default(uuid())
  worksite_id String
  
  // Source
  source_type  String  // insight | enquiry
  insight_id   String?
  enquiry_id   String?

  // Content
  description  String
  
  // Assignment
  assigned_to_id String
  due_date       DateTime
  
  // Status
  status       String   @default("open") // open | in_progress | complete | overdue
  completed_at DateTime?
  completed_by String?
  
  // Optional evidence
  completion_note  String?
  completion_photo String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  worksite     Worksite         @relation(fields: [worksite_id], references: [id])
  insight      CriticalInsight? @relation(fields: [insight_id], references: [id])
  enquiry      Enquiry?         @relation(fields: [enquiry_id], references: [id])
  assigned_to  User             @relation("AssignedTo", fields: [assigned_to_id], references: [id])
  completed_by_user User?       @relation("CompletedBy", fields: [completed_by], references: [id])

  @@map("safety_intelligence.corrective_action")
  @@index([worksite_id, status])
  @@index([assigned_to_id, status])
  @@index([due_date, status])
}

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
  status         String    @default("active") // active | inactive
  deactivated_at DateTime?
  deactivated_by String?

  slot   WorksiteRoleSlot @relation(fields: [slot_id], references: [id])
  user   User             @relation(fields: [user_id], references: [id])

  // One active assignment per user per slot
  @@unique([slot_id, user_id, status])
  @@map("safety_intelligence.worksite_slot_assignment")
  @@index([user_id, status])
}

// V5 note: control_verifier slot drives critical control verification scheduling.
// Fallback chain if no verifier assigned: safety_professional → supervisor.
// Verifier can be assigned to multiple worksites — queue spans all sites, each labelled.

model AiPromptConfig {
  id                   String   @id @default(uuid())
  prompt_key           String
  version              Int
  system_prompt        String
  user_prompt_template String
  model                String
  max_tokens           Int      @default(1000)
  is_active            Boolean  @default(false)
  created_at           DateTime @default(now())

  @@unique([prompt_key, version])
  @@map("safety_intelligence.ai_prompt_config")
}
```

---

## Job queue — all 8 V1 jobs

All AI calls are async jobs. No AI call is made synchronously in an API route.

```typescript
// src/lib/jobs/index.ts

export const JOB_NAMES = {
  OBSERVATION_ENRICH:          'observation.enrich',
  INSIGHT_GENERATE:            'critical_insight.generate',
  INSIGHT_NOTIFY_REVIEWER:     'critical_insight.notify_reviewer',
  FW_CLASSIFY:                 'fw_classify',
  TALK_GENERATE:               'toolbox_talk.generate',
  ENQUIRY_GENERATE_QUESTIONS:  'enquiry.generate_questions',
  ENQUIRY_SYNTHESISE:          'enquiry.synthesise',
  ENQUIRY_NOTIFY_RECIPIENTS:   'enquiry.notify_recipients',
  ENQUIRY_REMINDER:            'enquiry.reminder',
  ATROPHY_CALCULATE:           'atrophy.calculate',        // scheduled daily
  ACTION_OVERDUE_CHECK:        'action.overdue_check',     // scheduled daily
} as const

// All jobs are idempotent. Use jobId = `${jobName}:${entityId}` to prevent duplicates.
// Failed jobs retry 3 times with exponential backoff before dead-lettering.
```

### Job trigger map

| Event | Jobs fired | Notes |
|-------|-----------|-------|
| Observation created | `observation.enrich` | Always |
| Observation.enrich completes | Trend detection runs synchronously | In-process, not a job |
| Trend threshold crossed | `critical_insight.generate` | Fires once per threshold cross |
| CriticalInsight created | `critical_insight.notify_reviewer`, `fw_classify` | Both fire |
| CriticalInsight approved | `toolbox_talk.generate`, `enquiry.generate_questions` | Both fire |
| Enquiry dispatched | `enquiry.notify_recipients` | One per recipient |
| EnquiryResponse submitted | `enquiry.synthesise` | Debounced 30s |
| 24h before enquiry deadline | `enquiry.reminder` | Scheduled, targets non-responders |
| Daily 02:00 UTC | `atrophy.calculate`, `action.overdue_check` | Scheduled |

---

## AI implementation — all 4 V1 prompts

### Client setup

```typescript
// src/lib/ai/client.ts
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const AI_MODEL = 'claude-sonnet-4-20250514'

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000
): Promise<unknown> {
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  const clean = rawText.replace(/```json|```/g, '').trim()

  return JSON.parse(clean)
}
```

### Prompt 1 — Observation Enrichment

**Job:** `observation.enrich`  
**Input:** Observation record after creation  
**Output:** Updates `ai_*` columns on observation  
**Gate:** None — stored as suggestions, never overwrites original text

```typescript
// src/lib/ai/prompts/observation-enrich.ts

const SYSTEM = `
You are a safety classification assistant for a construction and industrial safety platform.
Read field observations written by supervisors and enrich them with structured metadata.
Never change or rewrite the original text.
Flag phrases that could identify specific individuals for anonymisation.
Output only valid JSON. No preamble, no markdown.
If uncertain, reflect that in enrichment_confidence.
`

export function buildObservationEnrichPrompt(obs: {
  what_was_observed: string
  work_type_label: string
  observation_type: string
  stop_work_called: boolean
  involved_role: string | null
}): string {
  return `
Observation text: "${obs.what_was_observed}"
Work type declared: ${obs.work_type_label}
Observation type declared: ${obs.observation_type}
Stop work called by supervisor: ${obs.stop_work_called}
Involved role: ${obs.involved_role ?? 'not specified'}

Return JSON:
{
  "failure_type": "systemic | behavioural | environmental | unclear",
  "severity_signal": "safe | at-risk | near-miss",
  "key_hazard": "specific hazard in plain language — not a category",
  "stop_work_warranted": true,
  "anonymisation_flags": ["phrase that could identify a specific person"],
  "enrichment_confidence": 0.0,
  "enrichment_notes": "1 sentence if context was thin, null otherwise"
}
`
}
```

### Prompt 2 — Critical Insight Draft

**Job:** `critical_insight.generate`  
**Input:** Cluster of enriched observations (anonymised)  
**Output:** Draft CriticalInsight record (`cleared_for_toolbox = false`)  
**Gate:** Safety manager review required before any downstream use

```typescript
// src/lib/ai/prompts/insight-generate.ts

const SYSTEM = `
You are a senior safety advisor drafting internal safety intelligence.
Voice: direct, plain-spoken, experienced, never alarmist, focused on systemic causes not individuals.
Written for safety managers who are experienced professionals.
Never name individuals, specific dates, or identify worksites beyond scope level.
Output only valid JSON. No preamble, no markdown.
`

export function buildInsightGeneratePrompt(data: {
  work_type_label: string
  org_level: string
  level_name: string
  window_days: number
  count: number
  threshold: number
  observation_summaries: Array<{
    summary: string
    failure_type: string
    key_hazard: string
  }>
}): string {
  return `
A trend threshold has been crossed.
Work type: ${data.work_type_label}
Org level: ${data.org_level} — ${data.level_name}
Time window: ${data.window_days} days
Near-miss count: ${data.count} (threshold: ${data.threshold})

Anonymised observation summaries:
${JSON.stringify(data.observation_summaries, null, 2)}

Return JSON:
{
  "pattern_summary": "2-3 sentences. What is the pattern and why does it matter operationally.",
  "likely_systemic_cause": "1 sentence. The underlying condition probably driving this pattern.",
  "recommended_action": "1 sentence. The change that would most directly address the cause.",
  "toolbox_narrative": "4-6 sentences. Written so a supervisor can read it aloud to their crew. Plain English. Present tense. No jargon. No blame. Opens with what the crew needs to know today.",
  "escalate_to_systemic": false,
  "escalation_rationale": "1 sentence if escalate_to_systemic is true, null if false"
}
`
}
```

### Prompt 3 — Toolbox Talk Assembly

**Job:** `toolbox_talk.generate`  
**Input:** Approved CriticalInsight  
**Output:** Complete talk stored in `toolbox_talk.generated_content`  
**Gate:** None at generation — content was human-approved at insight sign-off

```typescript
// src/lib/ai/prompts/talk-generate.ts

const SYSTEM = `
You produce toolbox talks for frontline construction and industrial crews.
Voice: a 20-year site veteran — plain English, no corporate speak, no moralising, no filler.
Assumes the crew are experienced professionals who don't need lecturing.
Every sentence earns its place.
Never reference specific names of individuals.
Output only valid JSON. No preamble, no markdown.
`

export function buildTalkGeneratePrompt(data: {
  worksite_name: string
  work_type_label: string
  presenter_first_name: string
  pattern_summary: string
  likely_systemic_cause: string
  toolbox_narrative: string
}): string {
  return `
Worksite: ${data.worksite_name}
Work scheduled: ${data.work_type_label}
Presenter: ${data.presenter_first_name}

Intelligence:
Pattern: ${data.pattern_summary}
Cause: ${data.likely_systemic_cause}
Narrative: ${data.toolbox_narrative}

Return JSON:
{
  "hazard_intro": "2-3 sentences. Today's work and the single most important hazard.",
  "main_content": "6-10 sentences. Cohesive narrative. Written to be spoken aloud.",
  "key_actions": [
    "Action 1 — specific, behaviourally concrete",
    "Action 2",
    "Action 3",
    "Action 4"
  ],
  "discussion_questions": [
    "Question 1 — specific to today's work",
    "Question 2 — prompts reflection on own practice",
    "Question 3 — identifies a gap crew can act on today"
  ],
  "closing_line": "1 sentence. Something a real supervisor would say. Not a slogan."
}
`
}
```

### Prompt 4 — Enquiry Question Generation (V1 free-text)

**Job:** `enquiry.generate_questions`  
**Input:** Approved CriticalInsight  
**Output:** 3–5 plain questions, no type classification in V1  
**Gate:** Safety manager reviews before dispatch

```typescript
// src/lib/ai/prompts/enquiry-generate.ts

const SYSTEM = `
You generate field enquiry questions for safety managers to send to site supervisors.
Questions should invite genuine field experience — not opinions, not compliance checks.
Written at the level of a 15-year site supervisor receiving them on their phone.
V1: plain questions only, free text answers. No structured options.
Output only valid JSON. No preamble, no markdown.
`

export function buildEnquiryGeneratePrompt(data: {
  pattern_summary: string
  likely_systemic_cause: string
  work_type_label: string
}): string {
  return `
Pattern identified: ${data.pattern_summary}
Likely cause: ${data.likely_systemic_cause}
Work type: ${data.work_type_label}

Generate 3-5 questions to send to supervisors at affected sites.
Each question should invite a real, specific answer based on what supervisors actually see and do.
Questions should progress from "what is happening" to "what would need to change".

Return JSON:
{
  "questions": [
    {
      "question_text": "The question as it will appear on the supervisor's phone",
      "ai_rationale": "1 sentence on why this question was selected"
    }
  ]
}
`
}
```

### Prompt 5 — Enquiry Response Synthesis

**Job:** `enquiry.synthesise` (runs after each response, debounced 30s)  
**Input:** All responses so far  
**Output:** Updates `enquiry.synthesis_findings` and on close `summary_narrative`

```typescript
// src/lib/ai/prompts/enquiry-synthesise.ts

const SYSTEM = `
You synthesise free-text survey responses from field supervisors for safety managers.
Be direct about what the responses show. Patterns that appear in 3+ responses are findings.
Signal icons: 🔴 critical gap, 🟠 consistent concern, 🟡 mixed signal, 💡 actionable insight.
Output only valid JSON. No preamble, no markdown.
`

export function buildEnquirySynthesisePrompt(data: {
  questions: Array<{ question_text: string }>
  responses: Array<{
    question_text: string
    answers: string[]
  }>
  response_count: number
  recipient_count: number
}): string {
  return `
Enquiry: ${data.response_count} of ${data.recipient_count} responses received.

Questions and answers:
${JSON.stringify(data.responses, null, 2)}

Return JSON:
{
  "synthesis_findings": [
    { "icon": "🔴 | 🟠 | 🟡 | 💡", "text": "Finding in plain language. Specific. References response evidence." }
  ],
  "summary_narrative": "2-3 sentences. Overall picture from the responses. What this tells us about the organisation.",
  "recommended_actions": [
    "Action 1 — specific and implementable",
    "Action 2",
    "Action 3"
  ]
}
`
}
```

### Prompt 6 — Forge Works Map® Classification

**Job:** `fw_classify`  
**Input:** Rich narrative context (insight, investigation, or enquiry summary)  
**Output:** `fw_*` fields on parent entity  
**Confidence gate:** Only stored if `fw_confidence >= 0.70`

```typescript
// src/lib/ai/prompts/fw-classify.ts

const SYSTEM = `
You are a safety management analyst trained in the Forge Works Map® — a 15-factor 
organisational capacity framework.

CRITICAL RULES:
- Only classify if the narrative provides sufficient ORGANISATIONAL context.
- A physical condition description is NOT enough. A pattern with an identified systemic cause IS enough.
- If signal is insufficient, return null for all fw_ fields and confidence = 0.0.
- A null classification is better than a wrong one.
- Classify the ORGANISATIONAL FACTOR — not the task or the hazard.
- One primary factor only.

The 15 factors:
GUIDE: senior_leadership, strategy, risk_management, safety_organisation, work_understanding
ENABLE: operational_management, resource_allocation, management_systems, goal_conflict_tradeoffs, learning_development
EXECUTE: frontline_workers, communications_coordination, decision_making, contractor_management, monitoring_metrics

Maturity levels: compliant | leading | resilient
Output only valid JSON. No preamble, no markdown.
`

export function buildFwClassifyPrompt(data: {
  source_type: 'critical_insight' | 'enquiry_summary'
  pattern_summary?: string
  likely_systemic_cause?: string
  toolbox_narrative?: string
  synthesis_findings?: string
  summary_narrative?: string
  work_type_label: string
}): string {
  return `
Source type: ${data.source_type}
Work type: ${data.work_type_label}

${data.pattern_summary ? `Pattern: ${data.pattern_summary}` : ''}
${data.likely_systemic_cause ? `Likely cause: ${data.likely_systemic_cause}` : ''}
${data.toolbox_narrative ? `Narrative: ${data.toolbox_narrative}` : ''}
${data.synthesis_findings ? `Synthesis: ${data.synthesis_findings}` : ''}
${data.summary_narrative ? `Summary: ${data.summary_narrative}` : ''}

Return JSON:
{
  "fw_factor": "factor_name | null",
  "fw_domain": "guide | enable | execute | null",
  "fw_maturity_signal": "compliant | leading | resilient | null",
  "fw_confidence": 0.0,
  "fw_rationale": "1 sentence explaining the classification, or null",
  "fw_classification_basis": "what specific evidence drove this, or null"
}
`
}

export const FW_CONFIDENCE_THRESHOLD = 0.70
```

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

// Called synchronously after observation.enrich completes
// Returns true if threshold crossed (insight generation should fire)
export async function checkTrendThreshold(
  observation_id: string,
  config: TrendConfig
): Promise<{ crossed: boolean; count: number; observations: string[] }> {
  
  const since = new Date()
  since.setDate(since.getDate() - config.window_days)

  // Count near-misses matching work_type within org scope and time window
  const observations = await prisma.observation.findMany({
    where: {
      work_type_id: config.work_type_id,
      observation_type: 'near-miss',
      observed_at: { gte: since },
      cleared_for_sharing: true,
      // Scope filter: resolve worksite_id list for scope_ref_id at org_level
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

All routes use Next.js App Router API routes. Auth middleware applied via wrapper.

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/observations` | List, scoped to user | supervisor+ |
| POST | `/api/observations` | Create + queue enrich | supervisor+ |
| GET | `/api/insights` | List, filtered by status/scope | safety_manager |
| GET | `/api/insights/:id` | Insight detail with source obs | safety_manager |
| POST | `/api/insights/:id/review` | Approve/edit/reject | safety_manager |
| GET | `/api/talks` | List talks (pending/delivered) | supervisor+ |
| GET | `/api/talks/:id` | Talk detail with full content | supervisor+ |
| POST | `/api/talks/:id/deliver` | Record delivery + attendance | supervisor |
| GET | `/api/visits` | List visits scoped to manager | manager+ |
| POST | `/api/visits` | Create visit plan | manager+ |
| PATCH | `/api/visits/:id` | Update status (start/close) | manager+ |
| GET | `/api/enquiries` | List enquiries | safety_manager |
| POST | `/api/enquiries` | Create + queue question gen | safety_manager |
| POST | `/api/enquiries/:id/dispatch` | Dispatch to recipients | safety_manager |
| GET | `/api/enquiries/:id/questions` | Questions for a supervisor | supervisor+ |
| POST | `/api/enquiries/:id/respond` | Submit response batch | supervisor |
| GET | `/api/actions` | List actions (scoped) | supervisor+ |
| POST | `/api/actions` | Create corrective actions (batch) | safety_manager |
| PATCH | `/api/actions/:id/complete` | Check off completion | supervisor |
| GET | `/api/analytics/atrophy` | Site atrophy scores | manager+ |
| GET | `/api/analytics/pipeline` | Pipeline health metrics | safety_manager |

---

## Environment variables

```env
# .env.local
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Feature flags (set false to disable in dev)
FF_FW_CLASSIFY=true       # Forge Works classification (can disable to reduce AI calls in dev)
FF_ATROPHY_ALERTS=true    # Atrophy alert notifications
```

---

## Development sequence — recommended build order

Two devs, parallel where possible.

### Week 1–2 — Foundation (E1, both devs)

Dev A: Database schema, Prisma setup, migrations, seed data  
Dev B: Auth integration, Next.js shell, route groups, navigation  
Together: Agree on API response shapes and error handling patterns

### Week 3–4 — Capture & Pipeline core (E2, E3)

Dev A: Observation API, incident data model (schema only, no UI), AI enrichment job, trend detection  
Dev B: Supervisor capture form (mobile), supervisor home screen, observation records view

### Week 5–6 — Intelligence & Delivery (E3 cont., E4)

Dev A: CriticalInsight generation job, approval API, Forge Works classification job  
Dev B: Safety manager workbench (insight queue + review panel), toolbox talk generation job, supervisor talk delivery view

### Week 7–8 — Manager Visit Flow (E5)

Dev A: Atrophy calculation job, visit plan API, visit topic recommendation  
Dev B: Manager visits list, visit plan create, active visit observation capture, visit close

### Week 9–10 — Enquiry & Actions (E6, E7)

Dev A: Enquiry data model, question generation job, synthesis job, dispatch logic  
Dev B: Enquiry builder (desktop), supervisor response view (mobile), corrective action create, mobile check-off

### Week 11–12 — Analytics & Polish (E8)

Dev A: Analytics API endpoints (pipeline health, atrophy, leading indicators)  
Dev B: Safety manager analytics views, Forge Works placeholder, notification wiring end-to-end

---

## Notes for the team

**On the AI calls:**  
Never call the Anthropic API synchronously in an API route. Every AI call goes through the job queue. If a job fails, the user's action has already succeeded — the enrichment just won't be there until the job completes or retries. This is intentional.

**On the Forge Works classification:**  
The `fw_classify` job runs after insight generation and enquiry close. If confidence is below 0.70, all `fw_*` fields stay NULL. This is correct behaviour — a null classification is better than a wrong one. The analytics placeholder in V1 shows "N of 5 classifications needed" until there's enough data. Don't try to force it.

**On the incident module:**  
The incident table schema is in Prisma and migrations will run. The UI is not built in V1. The data model is ready so that if a site logs an incident (they can't in V1 UI, but the data structure exists), it won't cause schema issues when the UI ships in V2+.

**On mobile:**  
Supervisor and manager routes are mobile-first. Test at 375px width. The kit's breakpoint system handles responsive layout — don't add phone frame wrappers or fixed-bottom buttons that fight the kit.

**On the enquiry system:**  
V1 is free text only. No question type enum, no structured response options, no per-question targeting. The data model has `question_text` as a plain string and `free_text_answer` as the response. V2 adds the type system. Build V1 clean without trying to scaffold V2 structures in.
