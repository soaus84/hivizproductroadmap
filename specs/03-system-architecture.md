# System Architecture

**Hiviz — Toolbox Talk Intelligence Module**  
Version: 0.1-draft  
Status: For architect review

---

## 1. Architecture Overview

The module follows an **event-driven, layered architecture** that separates:
- **Capture layer** — minimal human input via existing platform patterns
- **Processing layer** — deterministic algorithms + async AI enrichment
- **Intelligence layer** — generated entities (CriticalInsight, narratives)
- **Delivery layer** — toolbox talk assembly and presentation

The module integrates into your existing platform as a set of new services that reference existing org hierarchy and taxonomy entities. No existing tables are modified.

---

## 2. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXISTING PLATFORM                            │
│                                                                     │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│   │  Auth / IAM  │   │ Org Hierarchy│   │  Taxonomy Service    │  │
│   │              │   │ Org→Div→     │   │  WorkType            │  │
│   │  (existing)  │   │ Region→Site  │   │  SafetyPractice      │  │
│   └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘  │
└──────────┼────────────────────┼─────────────────────┼──────────────┘
           │                    │  referenced via FK   │
           ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TOOLBOX TALK MODULE                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                     API LAYER (REST)                          │ │
│  │                                                               │ │
│  │  /observations   /incidents   /investigations                 │ │
│  │  /critical-insights           /toolbox-talks                  │ │
│  └──────────────────────────┬────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐ │
│  │                   SERVICE LAYER                               │ │
│  │                                                               │ │
│  │  ObservationService    IncidentService    InvestigationService│ │
│  │  CriticalInsightService               ToolboxTalkService      │ │
│  └──────┬──────────────────────────────────────┬────────────────┘ │
│         │                                       │                  │
│  ┌──────▼───────────┐              ┌────────────▼───────────────┐ │
│  │  ALGORITHM ENGINE │              │    AI ORCHESTRATION        │ │
│  │                   │              │                            │ │
│  │  • Triage rules   │              │  • Job queue consumer      │ │
│  │  • Trend detection│              │  • Prompt template engine  │ │
│  │  • Content select │   ──fires──► │  • Anthropic API client    │ │
│  │  • Sharing gates  │              │  • Response parser/        │ │
│  │  • Legal hold     │              │    validator               │ │
│  └──────┬────────────┘              └────────────┬───────────────┘ │
│         │                                         │                 │
│  ┌──────▼─────────────────────────────────────────▼─────────────┐ │
│  │                      DATA LAYER                               │ │
│  │                                                               │ │
│  │  PostgreSQL                                                   │ │
│  │  observation | incident | investigation                       │ │
│  │  critical_insight | toolbox_talk | ai_prompt_config           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   NOTIFICATION SERVICE                       │  │
│  │   (existing platform notification infra — extend only)       │  │
│  │   • Reviewer alert on CriticalInsight created                │  │
│  │   • Investigator assignment                                  │  │
│  │   • Talk ready for delivery                                  │  │
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

---

## 3. Event Flow Diagrams

### 3.1 Observation → Toolbox Content (Happy Path)

```
Supervisor                API              Algorithm         AI Jobs         Reviewer
    │                      │                   │                │                │
    │  POST /observations  │                   │                │                │
    │─────────────────────►│                   │                │                │
    │                      │  auto-tag         │                │                │
    │                      │  (worksite, role, │                │                │
    │                      │   timestamp)      │                │                │
    │  201 Created         │                   │                │                │
    │◄─────────────────────│                   │                │                │
    │                      │                   │                │                │
    │                      │  queue job ───────────────────────►│                │
    │                      │  observation.enrich                │                │
    │                      │                   │                │                │
    │                      │                   │   enrich obs   │                │
    │                      │                   │   (AI call 1) ─┤                │
    │                      │                   │                │                │
    │                      │                   │   store ai_*   │                │
    │                      │                   │   fields ◄─────┤                │
    │                      │                   │                │                │
    │                      │  evaluate trend   │                │                │
    │                      │  threshold ───────►                │                │
    │                      │                   │                │                │
    │                      │  [if threshold    │                │                │
    │                      │   NOT crossed]    │                │                │
    │                      │   no action       │                │                │
    │                      │                   │                │                │
    │                      │  [if threshold    │                │                │
    │                      │   CROSSED]        │                │                │
    │                      │                   │  queue job ────►                │
    │                      │                   │  insight.gen   │                │
    │                      │                   │                │                │
    │                      │                   │   gen insight  │                │
    │                      │                   │   (AI call 2) ─┤                │
    │                      │                   │                │                │
    │                      │                   │   store draft  │                │
    │                      │                   │   cleared=false◄┤               │
    │                      │                   │                │                │
    │                      │                   │   notify ──────────────────────►│
    │                      │                   │   reviewer     │                │
    │                      │                   │                │                │
    │                      │                   │                │  POST /review  │
    │                      │◄──────────────────────────────────────────────────  │
    │                      │                   │                │                │
    │                      │  cleared=true      │                │                │
    │                      │  (now available   │                │                │
    │                      │   for toolbox)    │                │                │
```

### 3.2 Toolbox Talk Generation

```
Supervisor               API             Algorithm         AI Jobs
    │                     │                  │                │
    │  POST /toolbox-talks│                  │                │
    │  /generate          │                  │                │
    │────────────────────►│                  │                │
    │                     │                  │                │
    │                     │  content         │                │
    │                     │  selection ──────►                │
    │                     │  algorithm       │                │
    │                     │                  │                │
    │                     │  apply filters:  │                │
    │                     │  scope match     │                │
    │                     │  work_type match │                │
    │                     │  cleared check   │                │
    │                     │  legal_hold check│                │
    │                     │  recency rank    │                │
    │                     │  dedup           │                │
    │                     │  max 3 items     │                │
    │                     │                  │                │
    │                     │  ranked content  │                │
    │                     │  set ◄───────────│                │
    │                     │                  │                │
    │                     │  assemble talk ──────────────────►│
    │                     │  (AI call 5)     │                │
    │                     │                  │                │
    │                     │  structured talk ◄────────────────┤
    │                     │  JSON            │                │
    │                     │                  │                │
    │  200 OK             │                  │                │
    │  { talk content }  ◄│                  │                │
    │                     │                  │                │
    │  [review + deliver] │                  │                │
    │                     │                  │                │
    │  PATCH /deliver     │                  │                │
    │────────────────────►│                  │                │
    │                     │  log attendees   │                │
    │                     │  record delivery │                │
    │  204 No Content    ◄│                  │                │
```

---

## 4. Algorithm Engine — Detailed Logic

### 4.1 Incident Triage Rules

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

IF requires_investigation = true:
  CREATE investigation record
  SET investigation.status = 'open'
  ASSIGN to worksite.default_investigator_id (or fallback to region safety manager)
  QUEUE job: investigation.assist
  TRIGGER notification to assignee
```

### 4.2 Trend Detection Rules

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
              ?? 5  -- platform default

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

### 4.3 Content Selection Rules

```
GIVEN: worksite_id, work_type_id, presenter_id

-- Build candidate pool

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
REMOVE observation FROM candidates WHERE:
  observation.id IN (
    SELECT unnest(source_observation_ids::uuid[])
    FROM critical_insight
    WHERE critical_insight.id IN [selected critical insight ids]
  )

-- Final selection
RETURN candidates[0..2]  -- max 3 items, priority order maintained
```

### 4.4 Sharing Eligibility Gate

This runs on every content item before it enters the selection pool. Hard stops:

```
BLOCK if: legal_hold = true                          -- hard override, no exceptions
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

## 5. Infrastructure Requirements

### 5.1 New Infrastructure Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| Job Queue | Async AI jobs | Redis + BullMQ, or your existing queue infra |
| Anthropic API client | AI calls | Server-side only — API key never exposed to client |
| Prompt config store | Versioned prompts | PostgreSQL table (see prompt library doc) |

### 5.2 Anthropic API

- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Auth:** `x-api-key` header — server-side env var only
- **Rate limits:** Monitor via response headers; implement exponential backoff on 529
- **Latency budget:** Target P95 < 8s per AI call for synchronous paths (talk assembly)
- **Retry policy:** 3 attempts with exponential backoff for async jobs; 1 retry for sync paths

### 5.3 Database

- PostgreSQL 14+
- All new tables in a dedicated schema (e.g. `safety_intelligence`)
- Existing taxonomy and org tables accessed via cross-schema foreign keys
- Row-level security should mirror existing platform access patterns

### 5.4 No New Frontend Infrastructure Required

The module delivers data via API. All new UI surfaces (observation form, insight review, toolbox talk view) are implemented in the existing frontend application consuming these endpoints.

---

## 6. Security & Compliance Considerations

| Concern | Approach |
|---------|----------|
| API key exposure | Anthropic API key stored as server-side env var; never in client code or responses |
| PII in AI prompts | `ai_anonymisation_flags` from enrichment used to scrub subsequent prompts referencing same observation |
| Legal hold enforcement | Hard block at data layer, not application layer — enforced in SQL query, not service code |
| Audit trail | All AI calls logged with `prompt_key`, `prompt_version`, `input_hash`, `output_hash`, `latency_ms` |
| Data retention | AI-generated content follows same retention rules as source records |
| AI output liability | All AI outputs stored as `draft` or `suggested`; human confirmation required before any field becomes authoritative |
