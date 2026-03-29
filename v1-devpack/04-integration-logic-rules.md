# Integration & Logic Rules

**Safety Platform — Toolbox Talk Intelligence Module**  
Version: 0.1-draft  
Status: For architect review

---

## 1. Integration Points with Existing Platform

This document defines how the new module integrates with your existing platform — what it reads, what it writes, and what boundaries it must not cross.

### 1.1 Read-Only References (Existing Platform → Module)

The module reads these existing entities but never writes to them.

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

### 1.2 Notification Service Integration

The module emits notification events via your existing notification infrastructure. It does not implement its own notification delivery.

| Event | Recipient | Trigger |
|-------|-----------|---------|
| `critical_insight.review_required` | Safety manager (region or division) | CriticalInsight generated |
| `investigation.assigned` | Assigned investigator | Investigation created by triage |
| `investigation.overdue` | Assigned investigator + manager | Investigation open > N days (configurable) |
| `toolbox_talk.ready` | Presenter (supervisor) | Talk generated and ready |

These map to existing notification event types — extend the enum, do not create a parallel system.

### 1.3 Authentication & Authorisation

The module uses existing platform auth middleware. No new auth system.

Role-based access rules for new endpoints:

| Role | Observations | Incidents | Investigations | Insights (Review) | Talk Generate | Talk Deliver |
|------|-------------|-----------|----------------|-------------------|---------------|--------------|
| Supervisor | Create (own site) | Create (own site) | Read (own site) | — | Own site | Own site |
| Manager | Create (any site in scope) | Create | Read | — | Any in scope | — |
| Safety Manager | Read all in scope | Read all | Read + Close + Share | Approve/Reject | Any in scope | — |
| Platform Admin | All | All | All | All | All | All |

Scope boundaries follow the existing org hierarchy access model — a regional safety manager sees all sites in their region.

---

## 2. Logic Rules Reference

This section is the single source of truth for all business logic decisions. When in doubt, the rules here take precedence over any behaviour described in other documents.

### 2.1 Observation Rules

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
Observations with observation_type = 'safe' are NOT included in the toolbox
content selection pool by default.
Exception: if presenter explicitly requests recognition content, safe observations
from own worksite in last 7 days may be included as an optional 4th item.
```

---

### 2.2 Incident & Investigation Rules

**INC-01: Investigation triage is deterministic**
```
The requires_investigation flag is set by algorithm only, based on rules in
03-system-architecture.md section 4.1.
No human can override requires_investigation = false if the algorithm sets it true.
(They can close the investigation quickly, but cannot delete the requirement.)
```

**INC-02: AI suggestions are never authoritative**
```
Fields populated by AI investigation assistance (ai_suggested_*) are advisory only.
The authoritative investigation fields (immediate_cause, root_cause, etc.) must be
explicitly set by the assigned investigator.
The system must make the distinction visually clear in the UI: "AI suggested — confirm to accept"
```

**INC-03: Investigation sharing defaults**
```
cleared_for_sharing defaults to false for all investigations.
It must be explicitly set to true by the investigation closer.
The UI must not pre-select or default-suggest true — the question must be asked
neutrally: "Share findings in toolbox talks? Yes / No"
```

**INC-04: Legal hold is permanent until explicitly removed**
```
When legal_hold = true:
  - Investigation is excluded from ALL toolbox content queries
  - Any CriticalInsight that includes this investigation's ID in source_investigation_ids
    is also blocked from toolbox content
  - legal_hold can only be set or removed by a Safety Manager or Platform Admin role
  - Every change to legal_hold is audit-logged with user, timestamp, and reason
```

**INC-05: Narrative generation timing**
```
AI toolbox narrative generation (investigation.generate_narrative job) is queued only when:
  status = 'closed'
  AND cleared_for_sharing = true
  AND legal_hold = false

If legal_hold is set true after narrative generation:
  - toolbox_narrative field is not deleted (preserve audit trail)
  - but the investigation is excluded from content selection by the legal_hold gate
```

---

### 2.3 Critical Insight Rules

**INS-01: Generated insights are always drafts**
```
CriticalInsights are created with cleared_for_toolbox = false.
They cannot become available for toolbox use without a human review action.
The system must not provide any default approval path or timed auto-approval.
```

**INS-02: Cooldown period prevents duplicate insights**
```
After a CriticalInsight is generated for a given work_type_id + org_level:
  - No new CriticalInsight is generated for the same combination
    for org.trend_cooldown_days (default: 30 days)
  - This prevents flooding reviewers with near-duplicate insights
  - The cooldown resets if the reviewer rejects an insight
    (rejection signals the threshold was a false positive)
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
reviewer as a recommendation only.
The reviewer decides whether to escalate — it is not automatic.
Reviewer can approve for toolbox without escalating to systemic investigation.
```

**INS-05: Inherited legal hold**
```
If any source_investigation_id in a CriticalInsight has legal_hold = true:
  - The CriticalInsight is blocked from toolbox content selection
  - This is checked at query time, not stored as a field on the insight
  - Reason: legal_hold status can change; the block must reflect current state
```

---

### 2.4 Toolbox Talk Rules

**TALK-01: Talk is generated per worksite per work_type per day**
```
A new talk is generated on demand by the presenter.
The system does not automatically schedule or push talks.
If a talk has been generated for the same worksite + work_type today,
offer to reuse or regenerate (regeneration pulls fresher content).
```

**TALK-02: Content max 3 items**
```
The content selection algorithm returns a maximum of 3 items.
This is a hard limit — additional content degrades attention and talk length.
If fewer than 3 eligible items exist, generate the talk with what is available.
If 0 eligible items exist, generate the talk using only work type taxonomy context
(PPE, controls, emergency — no observation-derived content).
```

**TALK-03: Presenter edit is always available**
```
Before marking a talk as delivered, the presenter can edit:
  - presenter_notes (add site-specific context)
  - Any section of the generated content (mark content_edited = true)
Edits are stored; original generated content is preserved separately for audit.
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
The platform does not mandate a method — site conditions vary.
'digital' is preferred (in-app). 'signature' and 'verbal' are valid fallbacks.
```

---

### 2.5 Sharing Scope Resolution

Sharing scope defines which worksites can access a given piece of content. Resolution follows the org hierarchy.

```
Given: content.sharing_scope, content.worksite_id, request.worksite_id

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

  RETURN false  -- unknown scope, deny
```

CriticalInsights generated at a level (e.g. `region`) inherit `sharing_scope = 'region'` from the level at which the trend was detected. This is set automatically at generation time.

---

## 3. Configuration Reference

All threshold and behavioural values are configurable per organisation via an `org_config` table. Defaults are listed here.

| Config Key | Default | Description |
|-----------|---------|-------------|
| `trend.window_days` | 30 | Rolling window for trend detection |
| `trend.threshold.site.default` | 3 | Near-miss count to trigger insight at site level |
| `trend.threshold.region.default` | 5 | Near-miss count to trigger insight at region level |
| `trend.threshold.division.default` | 10 | Near-miss count at division level |
| `trend.cooldown_days` | 30 | Days before same work_type + level triggers another insight |
| `observation.sharing_window_days` | 30 | Max age of observation to include in toolbox selection |
| `investigation.overdue_days` | 14 | Days before open investigation triggers overdue notification |
| `toolbox.content_max_items` | 3 | Max content items per talk |
| `toolbox.recent_window_days` | 7 | "Recent" observation window for priority ranking |
| `ai.model` | `claude-sonnet-4-20250514` | AI model for all prompts |
| `ai.max_tokens.default` | 1000 | Default token limit |
| `ai.max_tokens.talk_assembly` | 1500 | Token limit for Prompt 5 |

---

## 4. Audit Logging Requirements

The following events must be logged to the platform audit log (existing audit infrastructure):

| Event | Required Fields |
|-------|----------------|
| Observation created | `observation_id`, `observer_id`, `worksite_id`, `observation_type` |
| Observation sharing toggled | `observation_id`, `actor_id`, `old_value`, `new_value` |
| Incident created | `incident_id`, `reporter_id`, `incident_type`, `requires_investigation` |
| Investigation created (by triage) | `investigation_id`, `incident_id`, `assigned_to_id`, `trigger_rule` |
| Investigation closed | `investigation_id`, `closed_by_id`, `cleared_for_sharing`, `legal_hold` |
| Legal hold changed | `investigation_id`, `actor_id`, `old_value`, `new_value`, `reason` |
| CriticalInsight generated | `insight_id`, `source_type`, `generated_at_level`, `work_type_id`, `source_count` |
| CriticalInsight reviewed | `insight_id`, `reviewer_id`, `action`, `reviewer_notes` |
| AI call made | `prompt_key`, `prompt_version`, `entity_id`, `latency_ms`, `success` |
| Toolbox talk generated | `talk_id`, `worksite_id`, `work_type_id`, `content_item_ids` |
| Toolbox talk delivered | `talk_id`, `presenter_id`, `attendee_count`, `acknowledgement_method` |

---

## 5. Rollout Phases

A phased approach is recommended to validate each layer before adding AI complexity.

### Phase 1 — Capture & Compliance (No AI)
- Observation and Incident capture forms
- Investigation framework (manual, no AI assistance)
- Toolbox talk manual assembly (supervisor writes free text)
- Attendance recording
- Basic filtering rules for content sharing

**Validates:** Data model, org integration, auth, basic workflow

### Phase 2 — Algorithm Layer
- Incident triage algorithm
- Trend detection algorithm
- Content selection algorithm
- Sharing gate logic
- Notification events

**Validates:** Algorithm correctness, threshold tuning, notification reliability

### Phase 3 — AI Enrichment
- Observation enrichment (Prompt 1)
- Investigation assistance (Prompt 3)
- Prompt versioning infrastructure

**Validates:** AI integration, prompt reliability, latency, parse error rates

### Phase 4 — AI Generation
- Critical Insight draft generation (Prompt 2)
- Investigation toolbox narrative (Prompt 4)
- Full toolbox talk assembly (Prompt 5)
- Human review UI for Critical Insights

**Validates:** Generated content quality, reviewer workflow, end-to-end pipeline

### Phase 5 — Intelligence & Optimisation
- Threshold tuning per org based on real data
- Cross-site insight patterns
- Systemic investigation escalation workflow
- Analytics: talk delivery rates, content engagement, incident trends


---

## V2/V3 Cascade Notes

Fields and data captured in V1 that are not yet fully consumed downstream. These are latent opportunities that should be implemented in V2 or V3 as noted. Do not re-design these fields — they are already in the schema waiting to be used.

### stop_work_warranted divergence signal (V2)

`observation.ai_stop_work_warranted` is set by the enrichment job independently of `observation.stop_work_called`.

**V1 gap:** Both fields are stored but the divergence between them is not surfaced anywhere.

**V2 implementation:** Add a divergence check in analytics. If `ai_stop_work_warranted = true` AND `stop_work_called = false`, flag this observation in the Leading Indicators view. A pattern of warranted-but-not-called stop works is a Frontline Workers signal (workers not empowered to stop) or an Operational Management signal (culture doesn't support it). Pass divergence count to the fw_classify job as additional context when classifying insights.

### involved_role in trend detection (V2)

`observation.involved_role` is captured but trend detection currently groups only by `work_type_id` and org scope.

**V2 implementation:** Add `involved_role` as a secondary grouping dimension in trend detection. Subcontractor near-misses clustering separately from employee near-misses is a Contractor Management signal. Pass `involved_role` distribution to the fw_classify job — if subcontractors are over-represented in a near-miss cluster, that context should push the classifier toward `contractor_management` as a candidate factor.

### fw_factors array into question generation (V2)

`critical_insight.fw_factors` is populated by the fw_classify job but the enquiry question generation prompt (Prompt 4) does not receive it.

**V2 implementation:** Pass `fw_factors`, `fw_domains`, `fw_maturity_signals`, and `fw_rationales` into Prompt 4. Question types should be selected per classified factor — Assurance Check for management_systems gaps, Work as Done for work_understanding gaps, Likelihood Assessment for operational_management gaps. See Prompt 4 V2 note in ai-prompt-library.md.

### fw_maturity_signals into talk generation (V2)

`critical_insight.fw_maturity_signals` is populated but Prompt 3 (talk assembly) uses a fixed veteran voice regardless of maturity level.

**V2 implementation:** Pass `fw_maturity_signals` into Prompt 3. Adapt narrative register to maturity level — Compliant framing focuses on procedure content gaps, Leading framing focuses on what leaders and managers should be noticing, Resilient framing focuses on adaptive capacity. See Prompt 3 V2 note in ai-prompt-library.md.

### fw_factors arrays into situational briefs and visit briefings (V2)

Prompts 10 and 12 currently receive single fw_factor values. With multi-factor classification, the arrays are richer.

**V2 implementation:** Pass full fw_factors arrays with fw_rationales into Prompts 10 and 12 so both outputs can name multiple factors with their evidence. "This pattern reflects gaps in Management Systems AND Operational Management" is more useful to a manager or board than a single factor. See Prompt 10 and 12 V2 notes in ai-prompt-library.md.
