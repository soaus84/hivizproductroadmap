# RISK-CONTROLS.md — Risk Workspace Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026
Workspace: `workspace.risk`

> **Spec authority for:** `workspace.risk` — the critical control register, verification clockwork, defeating factors, push/accept model, control health signals, and investigation control attribution.
>
> **Depends on:** `workspace.core` (always-on baseline). When `workspace.ms` is also active, controls can be linked to specific procedure requirement clauses. When both are active, the investigation workspace gains a complete evidential picture: what the control required, which requirement it references, and whether it was verified before the incident.

---

## 1 · Overview

The Risk workspace brings the organisation's critical control register live into the platform. A critical control is a specific, verifiable measure that prevents or mitigates an unwanted energy event for a given work type. The register defines what those controls are. The clockwork ensures they are verified. The attribution layer connects control failures to investigations.

**What this workspace adds:**
- Structured bowtie register per work type: hazard → prevention controls + mitigation controls
- Push/accept model: controls authored globally, accepted (and optionally modified) at worksite level
- Lifecycle tracking per control per site: implementing → active → not required → superseded
- Defeating factors: time-limited conditions that erode a control's effectiveness — tracked separately from presence/absence
- Verification clockwork: scheduled checks with verifier assignment, SLA, and escalation
- Control not-in-place routing: operational alert → manager rectification → intelligence escalation if overdue
- Investigation control attribution: confirmed control failures linked to `CriticalIncident` / investigation records
- Control health signals on the worksite dashboard (when Risk is active)

**What it does not replace:** The verification clockwork is an operational layer, not an intelligence layer. A failed verification becomes an observation only if it is not rectified within SLA. The intelligence pipeline continues to depend on observations and incidents — the Risk workspace extends what can be known about those events, not the events themselves.

---

## 2 · Core Concepts

### 2.1 · The Bowtie Structure

Every critical control lives inside a bowtie:

```
PREVENTION controls ◀──── HAZARD / UNWANTED EVENT ────▶ MITIGATION controls
(stop the event happening)                              (limit consequences if it happens)
```

The hierarchy is:

```
work_type
  └── hazard (unwanted energy event — can be multiple per work type)
        ├── prevention_control (one or many — stop it happening)
        └── mitigation_control (one or many — limit consequences)
```

Examples:
- **Work type:** Hot Work
- **Hazard:** Uncontrolled fire — hot work ignition
- **Prevention:** Fire watch confirmed in position; PTW signed and present at work location; Area clear of flammables within 5m
- **Mitigation:** Fire extinguisher accessible within 5m; Fire blanket rated for welding temperature

A work type can have multiple hazards. Each hazard has its own bowtie. Controls do not span hazards — they are specific to the event they prevent or mitigate.

### 2.2 · Push/Accept Model

Controls exist at two levels: **global** and **worksite**.

- **Global (CriticalControl):** Authored by safety managers at the organisation level. Defines the standard. Pushed to relevant worksites when the work type is active there.
- **Worksite (WorksiteControl):** The local instance. Created when a worksite accepts a pushed control. Can be modified (stricter standard only — not weaker) or marked not required.

A worksite can never hold active high-risk work without having reviewed and accepted or rejected each pushed control. The acceptance decision is logged with actor and date.

### 2.3 · Defeating Factors

A defeating factor is a condition that erodes a control's effectiveness over time or under specific circumstances — independently of whether the control is present.

Examples:
- Fire blanket UV degradation and heat cycle fatigue — rated service life 24 months
- Anchor rated service life approaching
- Gas detector calibration drift
- Filter saturation rate

Defeating factors have a clockwork component: an alert fires at a configurable lead time before the defeating condition triggers. If not resolved by expiry, the control status transitions from `active` to `active_degraded`.

**MVP note:** Defeating factor authoring and the full clockwork alert system is a V2 capability. The data schema must carry the concept from day one — a control record created today needs to be able to store a defeating factor without migration. But the clockwork execution and UI for managing defeating factors is not required in MVP. See §10.

---

## 3 · Data Entities

### 3.1 · CriticalControl (global register)

```sql
CREATE TABLE safety_risk.critical_control (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organisation(id),
  work_type_id           UUID NOT NULL REFERENCES work_type(id),
  hazard_id              UUID NOT NULL REFERENCES control_hazard(id),
  control_type           VARCHAR(20) NOT NULL CHECK (control_type IN ('prevention', 'mitigation')),
  name                   TEXT NOT NULL,
  description            TEXT,
  verification_prompt    TEXT NOT NULL,
  -- "Is the fire watch confirmed in position at the work location?"
  failure_consequence    TEXT NOT NULL,
  -- Consequence description if this control is absent or fails
  verification_frequency VARCHAR(30) NOT NULL
                         CHECK (verification_frequency IN (
                           'shift_start',    -- verified at the start of each shift
                           'daily',          -- verified once per calendar day
                           'before_ignition',-- verified before the hazardous activity begins
                           'event_triggered',-- verified when a specific condition occurs
                           'weekly'          -- low-frequency controls
                         )),
  verification_frequency_note TEXT,
  -- Free text clarifying the trigger for event_triggered frequency
  lifecycle_status       VARCHAR(20) NOT NULL DEFAULT 'active'
                         CHECK (lifecycle_status IN (
                           'implementing',   -- being rolled out, verification schedule not yet live
                           'active',         -- full clockwork running
                           'not_required',   -- valid state — work type inactive or condition absent
                           'superseded'      -- replaced by newer version, history preserved
                         )),
  linked_document_requirement_id UUID REFERENCES document_requirement(id),
  -- Risk + MS workspace compound: links to specific requirement clause
  -- Null when MS workspace not active or not yet linked
  rectification_sla_hours INT NOT NULL DEFAULT 4,
  -- Hours after a not-in-place event before escalation to intelligence pipeline
  created_by             UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE safety_risk.control_hazard (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organisation(id),
  work_type_id           UUID NOT NULL REFERENCES work_type(id),
  name                   TEXT NOT NULL,
  -- e.g. "Uncontrolled fire — hot work ignition"
  hazard_type            VARCHAR(30) NOT NULL,
  -- maps to energy_type taxonomy for cross-reference with observations/incidents
  description            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 · WorksiteControl (local instance)

```sql
CREATE TABLE safety_risk.worksite_control (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_control_id    UUID NOT NULL REFERENCES safety_risk.critical_control(id),
  worksite_id            UUID NOT NULL REFERENCES worksite(id),
  local_status           VARCHAR(20) NOT NULL DEFAULT 'pending_review'
                         CHECK (local_status IN (
                           'pending_review',  -- pushed but not yet reviewed by site
                           'implementing',    -- accepted, rollout in progress
                           'active',          -- full clockwork running at this site
                           'active_defeating',-- active but a defeating factor is approaching expiry
                           'active_degraded', -- defeating factor past expiry, effectiveness compromised
                           'not_required',    -- site manager judged not applicable at this site
                           'superseded'       -- global control superseded, this instance retired
                         )),
  accepted_by            UUID REFERENCES users(id),
  accepted_at            TIMESTAMPTZ,
  local_override_text    TEXT,
  -- If the site applies a stricter standard, describe it here
  -- e.g. "within 3m" vs global "within 5m"
  is_locally_modified    BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason       TEXT,
  -- If not_required, record why
  assigned_verifier_id   UUID REFERENCES users(id),
  -- The person responsible for verifying this control at this site
  -- Null = unassigned; an unassigned active control cannot run its schedule
  last_verified_at       TIMESTAMPTZ,
  last_verification_id   UUID REFERENCES safety_risk.control_verification(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (critical_control_id, worksite_id)
);
```

### 3.3 · ControlVerification (verification event)

```sql
CREATE TABLE safety_risk.control_verification (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksite_control_id    UUID NOT NULL REFERENCES safety_risk.worksite_control(id),
  verified_by            UUID NOT NULL REFERENCES users(id),
  verified_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  result                 VARCHAR(20) NOT NULL
                         CHECK (result IN (
                           'in_place',         -- control present and effective
                           'not_in_place',      -- control absent or non-functional
                           'not_required',      -- triggering condition did not apply this period
                           'defeating_noted'    -- present but defeating condition identified
                         )),
  notes                  TEXT,
  defeating_factor_note  TEXT,
  -- Populated when result = 'defeating_noted'
  shift_id               UUID REFERENCES shift(id),
  -- Links to shift record when verification_frequency = 'shift_start'
  scheduled_for          TIMESTAMPTZ,
  -- The scheduled time this verification was due
  -- Allows late detection: verified_at vs scheduled_for
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.4 · ControlDefeatingFactor

```sql
CREATE TABLE safety_risk.control_defeating_factor (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_control_id        UUID NOT NULL REFERENCES safety_risk.critical_control(id),
  name                       TEXT NOT NULL,
  -- e.g. "UV and heat degradation — rated service life"
  description                TEXT NOT NULL,
  -- Full description of how this condition erodes control effectiveness
  trigger_type               VARCHAR(20) NOT NULL
                             CHECK (trigger_type IN (
                               'date_from_manufacture',  -- n months from item manufacture/installation date
                               'date_from_last_service', -- n months from last service date
                               'use_count',              -- n uses before replacement required
                               'calendar_date'           -- fixed calendar date for batch replacement
                             )),
  alert_lead_days            INT NOT NULL DEFAULT 30,
  -- Days before trigger threshold to fire the clockwork alert
  -- Default: 30 days (visible in wireframe: "23 days" = within alert window)
  degraded_threshold_note    TEXT,
  -- Human description of when control transitions to 'active_degraded'
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instance per worksite_control, tracking actual expiry date
CREATE TABLE safety_risk.worksite_control_defeating_factor (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksite_control_id        UUID NOT NULL REFERENCES safety_risk.worksite_control(id),
  defeating_factor_id        UUID NOT NULL REFERENCES safety_risk.control_defeating_factor(id),
  trigger_date               DATE,
  -- Computed or manually entered: the date this defeating condition fires
  resolved_at                TIMESTAMPTZ,
  resolved_notes             TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.5 · InvestigationContributingControl

```sql
CREATE TABLE safety_risk.investigation_contributing_control (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_incident_id   UUID NOT NULL REFERENCES safety_intelligence.critical_incident(id),
  critical_control_id    UUID NOT NULL REFERENCES safety_risk.critical_control(id),
  worksite_control_id    UUID REFERENCES safety_risk.worksite_control(id),
  -- Null if control existed globally but was not_required at this site
  control_status_at_incident VARCHAR(30),
  -- Snapshot of worksite_control.local_status at incident datetime
  control_presence       VARCHAR(20) NOT NULL
                         CHECK (control_presence IN (
                           'confirmed_present',  -- investigator confirmed control was in place
                           'confirmed_absent',   -- investigator confirmed control was not in place
                           'degraded',           -- present but defeating factor was active
                           'unknown'             -- cannot be determined from available evidence
                         )),
  attributed_by          UUID NOT NULL REFERENCES users(id),
  -- The investigator who made the attribution call
  attribution_notes      TEXT,
  is_primary_failure     BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE when this control's failure is the primary contributing factor
  -- (influences FW classification weighting)
  linked_document_requirement_id UUID REFERENCES document_requirement(id),
  -- When MS workspace active: the specific requirement this control references
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4 · Push/Accept Model

### 4.1 · How a control reaches a worksite

1. **Author** — Safety manager creates a `CriticalControl` at the global (org) level, associated with a work type and hazard.
2. **Push** — When a worksite activates a work type (or manually triggered by safety manager), a `WorksiteControl` record is created with `local_status = 'pending_review'` for each active `CriticalControl` for that work type.
3. **Notification** — The worksite manager receives a notification: "N new controls require review for [Work Type]."
4. **Review decision** — For each pending control, the worksite manager:
   - **Accept** — applies the global standard as-is → `local_status = 'implementing'`
   - **Modify** — applies a stricter local version → `is_locally_modified = TRUE`, local override documented; `local_status = 'implementing'`
   - **Mark not required** — records reason → `local_status = 'not_required'`
5. **Implementing → Active** — When the worksite manager confirms the control is in place and a verifier is assigned → `local_status = 'active'`. Verification schedule begins.

### 4.2 · Modification bounds

A worksite may only modify a control to be **stricter** than the global standard, never weaker. This is enforced at the UI level and recorded in `local_override_text`. A worksite that attempts to apply a weaker standard must mark the control not required and record a reason — this creates a compliance signal.

### 4.3 · Global control updated

When a `CriticalControl` record is updated globally (verification prompt changed, failure consequence updated, etc.):
- Existing `WorksiteControl` records in `active` status are notified of the update
- If the update is material (e.g., verification frequency changed, consequence description changed), worksite managers are prompted to re-acknowledge
- `WorksiteControl` records in `is_locally_modified = TRUE` receive a specific notification: the global standard they diverged from has changed

---

## 5 · Lifecycle States

| State | Description | Verification schedule |
|---|---|---|
| `pending_review` | Pushed from global register, not yet reviewed by worksite | No schedule |
| `implementing` | Accepted; rollout in progress (acquiring equipment, training verifier) | No schedule — safety manager sets target active date |
| `active` | Full clockwork running | Schedule live |
| `active_defeating` | Present but defeating factor within alert window | Schedule live; clockwork also tracks defeating resolution |
| `active_degraded` | Defeating factor past trigger threshold; effectiveness compromised | Schedule live; control flagged in dashboard as degraded |
| `not_required` | Valid at this site — work type not active, condition doesn't apply | No schedule; reason logged |
| `superseded` | Global control replaced by newer version; history preserved | No schedule; history retained |

State transitions:
- `pending_review` → `implementing` (on accept/modify) or `not_required` (on rejection)
- `implementing` → `active` (on site manager confirmation + verifier assigned)
- `active` → `active_defeating` (system: when defeating factor enters alert window)
- `active_defeating` → `active` (on defeating factor resolved) or `active_degraded` (on trigger date passed)
- `active_degraded` → `active` (on defeating factor resolved)
- `active` | `active_defeating` | `active_degraded` → `not_required` (site manager decision) or `superseded` (global update)

---

## 6 · Verification Clockwork

### 6.1 · Schedule execution

For each `WorksiteControl` with `local_status = 'active'`:
1. The system generates a verification schedule based on `verification_frequency` of the parent `CriticalControl`
2. At the scheduled time, the assigned verifier (`assigned_verifier_id`) receives a notification: "Verify [Control Name] — [work type] at [site]"
3. The verifier opens the verification prompt and records a result
4. The `WorksiteControl.last_verified_at` and `last_verification_id` are updated

**Frequency types and schedule logic:**

| Frequency | When schedule fires |
|---|---|
| `shift_start` | At the recorded start time of each scheduled shift at that site |
| `daily` | Once per calendar day — configurable time (default: start of first shift) |
| `before_ignition` | Event-triggered — not a calendar schedule; supervisor initiates before hazardous activity |
| `event_triggered` | Event-triggered as defined in `verification_frequency_note` |
| `weekly` | Once per 7-day period — configurable day of week |

### 6.2 · Verifier assignment

Each `WorksiteControl` carries an `assigned_verifier_id`. If this is null, the verification schedule cannot run. The dashboard surfaces "No verifier assigned" as a structural warning — this is not a one-off failure, it is a scheduling gap that will repeat every period until resolved.

Fallback: if a site manager sets a fallback verifier at the site level, unassigned controls inherit the fallback for schedule purposes.

### 6.3 · Verification outcomes

When a verifier records a result:

| Result | System action |
|---|---|
| `in_place` | Log verification event; update `last_verified_at`; no alert |
| `not_in_place` | Log verification event; start rectification SLA clock; alert manager responsible for this control |
| `not_required` | Log as valid skip — triggering condition did not apply (e.g., no hot work this shift) |
| `defeating_noted` | Log verification event; create/update `worksite_control_defeating_factor` record; alert safety manager |

### 6.4 · Not-in-place SLA and escalation

When a verification returns `not_in_place`:

1. **Immediate action** — Alert fires to the manager responsible for this control at this site. Detail includes: which control, which site, who flagged it, recommended action (work hold if relevant).
2. **Rectification window** — Manager has `rectification_sla_hours` to confirm rectification. Default: 4 hours for `shift_start` frequency; 1 hour for `before_ignition` or `event_triggered`.
3. **Resolved** — Manager confirms rectification → new verification event recorded with `result = 'in_place'`; SLA clock stops; alert resolved.
4. **SLA breach** — If not resolved within SLA → the platform creates an `observation` record with `signal_type = 'barrier_failure'` and routes it into the observation intelligence pipeline. The observation carries: control name, site, work type, hazard type mapped to `energy_type`, verifier name, and duration of non-rectification. This closes the loop between operational control failure and intelligence signal without a separate escalation model.

The observation created by SLA breach enters the standard `observation.enrich` pipeline and may trigger a `CriticalInsight` via the standard `barrier_failure` + confidence threshold route. No special path is required.

---

## 7 · Control Health Signals

Control health appears as a layer on the worksite dashboard and register views when `workspace.risk` is active.

### 7.1 · Per control

| Signal | When surfaced |
|---|---|
| `not_in_place` count | Number of sites where this control is currently flagged not in place |
| `not_verified` | Sites where the scheduled verification is overdue |
| `active_defeating` | Sites where a defeating factor is within the alert window |
| `active_degraded` | Sites where the defeating factor has passed its trigger date |
| Site distribution bar | Sites in place / sites with issue — visual ratio per control |

### 7.2 · Per work type

A health bar per work type shows the aggregate health of all controls for that work type. Each segment represents one control. Segment colour:
- Green = active, all sites in place
- Red = one or more sites not in place
- Amber = defeating factor active
- Blue = implementing

### 7.3 · Cross-site alert view

When a safety manager selects a specific control, they see the full cross-site table:
- Sites verified this period vs not verified vs not in place vs resolved
- Statistical summary: N sites not in place, N resolved, N in place, N total active
- Insight panel: structural issues surfaced (no verifier assigned, repeated pattern across sites)

### 7.4 · Atrophy contribution

Overdue control verifications contribute to the worksite atrophy score (defined in `features/SYSTEMIC-CAUSES.md`). Specifically, an active `WorksiteControl` with no verification event within 2× its expected verification window is treated as a practice_atrophy signal. This surfaces in visit briefing packs and the systemic map view when `workspace.analytics` is also active.

---

## 8 · Investigation Control Attribution

When `workspace.risk` is active and an investigation opens for a `CriticalIncident`, the investigation workspace gains a control attribution step.

### 8.1 · Attribution in `investigation.assist`

The `investigation.assist` job receives additional context when the Risk workspace is active:
- The `work_type` of the incident
- The list of `WorksiteControl` records that were `active` or `active_defeating` at the incident site on the incident date
- The `local_status` snapshot of each control at the incident datetime (point-in-time query against audit log)
- The `last_verified_at` for each control relative to the incident time

The system prompt includes a conditional block (similar to the `{{#if severity_class == 'critical'}}` pattern in fw-classify-job.md) that:
- Instructs the AI to surface the relevant controls for the investigator to consider
- Prompts the investigator to confirm which controls were present, absent, degraded, or unknown
- Notes the verification history gap if any control's last verification was >24h before the incident

### 8.2 · Attribution record

For each control the investigator considers, they record a `control_presence` value. This creates an `InvestigationContributingControl` record. The investigator can flag one or more as `is_primary_failure = TRUE`.

### 8.3 · Attribution in FW classification

When `fw_classify` runs for an investigation path item:
- If `InvestigationContributingControl` records exist with `control_presence IN ('confirmed_absent', 'degraded')`, these are included as evidence in the user prompt template
- A confirmed control absence for a prevention control is strong evidence for FW factors such as `control_of_work`, `monitoring_review`, or `risk_management` depending on the control type
- A confirmed control absence for a mitigation control is strong evidence for `emergency_preparedness` or `physical_resources` depending on control category
- The AI is instructed to treat confirmed control failures as high-confidence FW factor signals, not merely as supporting indicators

The prompt template addition (injected when Risk workspace active):

```
{{#if confirmed_control_failures}}
CONFIRMED CONTROL ATTRIBUTION FROM INVESTIGATION:
The investigator has confirmed the following control failures:
{{#each confirmed_control_failures}}
- {{control_type | upcase}} control "{{control_name}}" — {{control_presence}}
  Failure consequence: {{failure_consequence}}
  {{#if is_primary_failure}}PRIMARY FAILURE — treat as high-confidence FW signal{{/if}}
{{/each}}
Use confirmed control failures as high-confidence evidence when selecting FW factors. A confirmed prevention control absence strongly implicates control_of_work, monitoring_review, or risk_management. A confirmed mitigation control failure strongly implicates physical_resources or emergency_preparedness.
{{/if}}
```

### 8.4 · Risk + MS workspace compound

When both `workspace.risk` and `workspace.ms` are active, investigation attribution gains the version-controlled procedure layer:

- Each `InvestigationContributingControl` with a `linked_document_requirement_id` surfaces the specific requirement clause that the control satisfies
- The investigation record gains: "this control failed; the governing procedure active on [incident date] required [specific clause]; the platform has the version that was in force"
- This is the most evidentially precise output available from the platform — what was supposed to happen, what prevented it, and that the standard was documented

---

## 9 · Downstream Consumers

| Stream | What it receives from Risk workspace | When |
|---|---|---|
| `incident-to-investigation` | Active WorksiteControl records for work type + site; point-in-time status | At investigation.assist stage |
| `observation-to-insight` | SLA-breach observations injected into pool | On failed rectification |
| `fw_classify` (investigation path) | Confirmed control failures as high-confidence FW signals | At fw_classify stage when attribution complete |
| `systemic-causes` | Overdue verification signals contributing to atrophy score; control health layer on worksite dashboard | Continuous |
| `visit_briefing.generate` | Controls not in place at target site; defeating factors approaching at target site | When visit_plan created for site |

---

## 10 · V2 Notes

**Defeating factor clockwork (V2)**
The defeating factor schema is defined in this spec and must be carried in the data model from MVP. The clockwork execution — generating alerts at `alert_lead_days` before trigger date, transitioning `local_status` to `active_defeating`, and then `active_degraded` — is V2 scope. MVP: schema present, status transitions manual.

**Verification schedule generation (V2)**
Automated schedule generation from `verification_frequency` requires shift data integration or a standalone schedule table. MVP: verification is prompted via notification but the schedule is not auto-generated from shift times. A verifier receives a push notification daily/per-shift based on site configuration. The formal clockwork (verified_at vs scheduled_for lateness detection) is V2.

**Control version history**
When a `CriticalControl` is updated, the version active at a given date needs to be queryable for investigation purposes. Point-in-time queries against a version log are V2 — MVP retains a single current version. V2 adds: `control_version` table with `valid_from` / `valid_to`, enabling investigation AI to retrieve the exact control definition active on the incident date.

**Per-work-type atrophy score**
The current atrophy score (see SYSTEMIC-CAUSES.md) is per worksite. V2 breaks atrophy down per work type — a site doing hot work daily but not verifying hot work controls scores differently than a site where that work type is inactive.

**Risk workspace onboarding**
When a client activates `workspace.risk`, they need a seeding step: importing existing work types, hazards, and controls from their existing register (CSV or manual entry). Onboarding design is not specced — V2 product scope.

**Control register seeding from management system**
When `workspace.ms` is also active, `DocumentRequirement` records can seed control suggestions — the AI can propose critical controls from extracted requirements. This is V2 compound intelligence, not MVP.

---

## 11 · Spec Gaps — Design Decisions Needed Before Build

The following require explicit design decisions before implementation begins. They are not deferred as V2 — they affect MVP architecture.

| Decision | Question | Impact |
|---|---|---|
| **Observation-route for SLA breach** | The signal-flow.html documents the SLA escalation proposal but marks it as undefined. This spec adopts it. Confirm: yes, create a `barrier_failure` observation on SLA breach? Or use a separate `control_not_in_place` signal type that feeds the pipeline differently? | Observation schema, intelligence pipeline trigger logic |
| **Work type entity** | `work_type` is referenced throughout but not specced as an entity. Does work type live in core (used by observation capture for energy_type context) or in the risk workspace schema? | Core schema vs workspace schema boundary |
| **Regional hierarchy** | The discovery doc mentions "regional libraries" for the push model. Does the push go global → region → worksite, or global → worksite directly? The wireframe shows "Global register" as the source. | Push model depth, notification routing |
| **Verifier role** | Is `control_verifier` a named role in the platform RBAC, or is any user with supervisor access eligible? The wireframe shows a dedicated verifier concept with assignment per control per site. | RBAC model, notification targeting |
| **Rectification SLA defaults** | This spec sets 4h for shift_start and 1h for event_triggered as defaults. Are these configurable per control? Per org? | Schema (add sla_hours column or org-level config) |

---

*Last updated: May 2026 — v1.0 initial spec. Written from wireframes/control-register.html, wireframes/control-register-desktop.html, and v6-discovery.html. Update this file when: a schema field is added or changed; the push/accept model changes; defeating factor clockwork moves from V2 to active spec; investigation attribution prompt is finalized; any spec gap above is resolved.*
