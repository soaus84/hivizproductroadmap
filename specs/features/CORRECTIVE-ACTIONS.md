# CORRECTIVE-ACTIONS.md — Corrective Action Lifecycle Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 2.0 — May 2026
Workspace: `workspace.core`

> **Spec authority for:** the `ActionDissemination` and `CorrectiveAction` entities, the shared dissemination model, creation from four sources (insight improve step, investigation close, enquiry summary, control verification gap), per-site lifecycle from assignment to closure, aggregate progress against the parent source, and relationship to the atrophy score.
>
> Corrective actions are the **operational layer** of the platform — the mechanism by which intelligence findings become site-level change. They are distinct from the intelligence pipeline (which operates on an async, manager-reviewed clock) because they run on a local, human clock: a named person at a specific worksite, with a due date, who marks it complete.

---

## 1 · Two Modes of the Platform

**Intelligence mode** — async, manager-reviewed, hours to days.
An observation is captured → enriched → pools with others → a CriticalInsight is generated and reviewed → FW Map® classified → broadcast via toolbox talk → safety manager understands systemic conditions. This mode produces understanding.

**Operational mode** — local, named-owner, minutes to weeks.
A control verification fails → work holds immediately → a manager creates a corrective action → a supervisor at that site is assigned it → they act → they close it. This mode produces change.

Both modes are necessary. Understanding without action doesn't change outcomes. Action without understanding fixes symptoms, not causes. Corrective actions are the bridge between the two.

**What makes corrective actions distinct:**
- They are always worksite-scoped — owned by a named person at a specific site
- They are closed by onsite personnel (supervisor, safety slot member) — not by the safety manager who created them
- They are visible in the app as a persistent task list — not a notification that disappears
- Their completion (or overdue status) contributes to the site's atrophy score
- Progress against the parent source (insight, investigation, enquiry) is visible in aggregate — how many sites have completed, how many are open, how many are overdue

---

## 2 · Entities

Corrective actions have two layers: the **dissemination** (the shared action definition, targeting, and source link) and the **instance** (the per-site record owned and closed by worksite personnel).

### 2.1 · ActionDissemination

The parent record. Created once when actions are disseminated. Holds the shared definition and links back to the source entity.

```sql
CREATE TABLE safety_intelligence.action_dissemination (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organisation(id),

  -- Source linkage — exactly one will be populated
  source_type           VARCHAR(30) NOT NULL
                        CHECK (source_type IN (
                          'critical_insight',
                          'investigation',
                          'enquiry',
                          'control_verification'
                        )),
  source_insight_id     UUID REFERENCES safety_intelligence.critical_insight(id),
  source_incident_id    UUID REFERENCES safety_intelligence.critical_incident(id),
  source_enquiry_id     UUID REFERENCES safety_intelligence.enquiry(id),
  source_control_id     UUID REFERENCES safety_risk.worksite_control(id),

  -- The action steps — shared across all targeted sites, applied in order
  actions               JSONB NOT NULL,
  -- Ordered array of steps:
  --   [{"step": 1, "action": "Brief all supervisors on pre-start requirements at shift handover."},
  --    {"step": 2, "action": "Verify compliance at first shift this week and report back."}]
  -- Minimum one step. Steps must be genuinely sequential — each depends on or follows the previous.
  -- Pre-populated from source entity's recommended_actions field; safety manager edits before disseminating.
  rationale             TEXT,
  -- Why these steps address the root cause — carried from the source

  -- Work type context — used for work_type_in_scope targeting
  work_type_id          UUID REFERENCES work_type(id),
  -- Populated from the source entity's work_type_id where available

  -- Targeting
  dissemination_scope   VARCHAR(30) NOT NULL
                        CHECK (dissemination_scope IN (
                          'affected_sites',       -- sites that contributed to the source finding
                          'work_type_in_scope',   -- all sites in org scope doing this work type
                          'full_scope'            -- all sites at the source's org level
                        )),
  target_worksite_ids   UUID[] NOT NULL,
  -- The resolved list of worksite IDs after scope was applied.
  -- Populated at dissemination time — a snapshot of which sites were targeted.

  -- Assignment defaults (can be overridden per site on CorrectiveAction)
  due_date              DATE NOT NULL,
  priority              VARCHAR(20) NOT NULL DEFAULT 'moderate'
                        CHECK (priority IN ('critical', 'serious', 'moderate')),

  -- Created by
  created_by_id         UUID NOT NULL REFERENCES users(id),
  -- Safety manager who ran the improve step / closed the investigation / etc.
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2 · CorrectiveAction

The per-site instance. One record per targeted worksite per dissemination. Owned and closed by worksite personnel.

```sql
CREATE TABLE safety_intelligence.corrective_action (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dissemination_id      UUID NOT NULL REFERENCES safety_intelligence.action_dissemination(id),
  worksite_id           UUID NOT NULL REFERENCES worksite(id),
  org_id                UUID NOT NULL REFERENCES organisation(id),

  -- Assignment (per-site — may differ across instances of the same dissemination)
  assigned_to_id        UUID REFERENCES users(id),
  -- Named worksite person (supervisor, safety slot member, etc.)
  -- Nullable — worksite manager can assign after dissemination
  assigned_by_id        UUID NOT NULL REFERENCES users(id),
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lifecycle
  status                VARCHAR(20) NOT NULL DEFAULT 'open'
                        CHECK (status IN (
                          'open',         -- assigned, not yet started
                          'in_progress',  -- assignee has marked as started
                          'complete',     -- closed by onsite personnel
                          'overdue'       -- past due_date, not complete (computed)
                        )),

  -- Closure (by onsite personnel — supervisor or safety slot member)
  closed_by_id          UUID REFERENCES users(id),
  closed_at             TIMESTAMPTZ,
  closure_notes         TEXT NOT NULL,
  -- What was actually done. Required on close — the record is incomplete without it.

  -- Escalation
  escalated             BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_at          TIMESTAMPTZ,
  -- Set TRUE when instance transitions to 'overdue' and safety manager is alerted

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (dissemination_id, worksite_id)
  -- One instance per site per dissemination
);
```

### 2.3 · Aggregate progress

Progress against the parent source is derived from the `CorrectiveAction` instances for a given `dissemination_id`:

```sql
SELECT
  COUNT(*)                                    AS total_sites,
  COUNT(*) FILTER (WHERE status = 'complete') AS complete,
  COUNT(*) FILTER (WHERE status = 'overdue')  AS overdue,
  COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) AS open
FROM corrective_action
WHERE dissemination_id = :id;
```

This query drives the aggregate progress view on the parent insight, investigation, or enquiry — e.g. "6 of 8 sites complete · 2 overdue." No separate counter fields are stored; progress is always live from instance records.

---

## 3 · Dissemination Model

### 3.0 · Common dissemination model (all sources)

All four creation sources share the same dissemination flow. Each source provides `work_type_id` and a set of contributing entities; the targeting model and instance creation are identical regardless of source.

**Three targeting modes:**

| Mode | What it targets | Query |
|---|---|---|
| `affected_sites` | Sites directly linked to the source finding | Resolved from source entity (contributing_worksite_ids, incident worksite, enquiry sites, control site) |
| `work_type_in_scope` | All sites within the org level scope that have this work type active | `WHERE org_level = source.generated_at_level AND work_type_id = source.work_type_id AND status = active` |
| `full_scope` | All sites at the source's org level regardless of work type | `WHERE org_level = source.generated_at_level` |

**Recommended scope:** Each source provides a `recommended_dissemination_scope` — either AI-generated (insights) or rule-based (other sources). The improve step opens with this pre-selected. The safety manager accepts or changes it before dissemination runs.

**Instance creation:** For each worksite in `target_worksite_ids`, one `CorrectiveAction` record is created. The `ActionDissemination` record is created first; instances are created in a single batch operation. Each instance inherits `due_date` and `priority` from the dissemination. `assigned_to_id` can be set per site at creation time or left for the worksite manager to assign.

---

### 3.1 · Insight improve step

**Source:** `source_type = 'critical_insight'`

Triggered after a safety manager approves or edits a CriticalInsight. The platform prompts: "What actions does this insight require?"

**What the insight provides to the dissemination model:**
- `work_type_id` — first-class FK on the insight
- `contributing_worksite_ids[]` — sites whose observations triggered the insight; resolves `affected_sites` mode
- `generated_at_level` — org scope for `work_type_in_scope` and `full_scope` queries
- `recommended_dissemination_scope` — AI recommendation from Stage 1 (see `CRITICAL-INSIGHT.md §Stage 1 Output Storage`)
- `recommended_action` — pre-populates the action title field
- `recommended_action_rationale` — pre-populates the rationale field

**Default recommendations by insight type:**
- Worksite Trend (`generated_at_level = site`) → `affected_sites` unless the cause is structural to the work type
- Cross-site Pattern (`generated_at_level = region/division/org`) → `work_type_in_scope` — pattern already crossed sites for this work type
- Critical observation → `affected_sites`; consider `work_type_in_scope` if control gap is structural

**Example:** Pre-start check pattern across hot work sites (cross-site pattern) → AI recommends `work_type_in_scope` → improve step targets all sites in the region running hot work, not just the three that contributed observations.

**Optionality:** An insight without corrective actions can still be approved — actions are encouraged but not mandatory for `signal_type = 'near_miss'` or where the recommended action is systemic (e.g. a procedure change the safety manager handles directly).

---

### 3.2 · Investigation close gate

**Source:** `source_type = 'investigation'`

At investigation close (INVESTIGATION.md Stage 2), at least one confirmed corrective action is required before the investigation can close. The investigation's actions become `ActionDissemination` records on close.

**What the investigation provides:**
- `work_type_id` — from the incident record
- `worksite_id` — the investigation site; resolves `affected_sites` as a single site
- Safety manager can expand to `work_type_in_scope` if investigation findings suggest the condition is present elsewhere

**Default recommendation:** `affected_sites` — a confirmed incident at a specific site. Safety manager escalates scope if the investigation identified systemic conditions across the work type.

---

### 3.3 · Enquiry summary

**Source:** `source_type = 'enquiry'`

When an enquiry is summarised (`enquiry.summarise`), the output includes `recommended_actions[]` — 2–3 specific, implementable actions from the enquiry findings. These appear as action candidates in the safety manager's workbench. The safety manager converts any they accept into `ActionDissemination` records.

**What the enquiry provides:**
- `work_type_id` — enquiries are work-type scoped
- Responding site IDs — sites that submitted enquiry responses; resolves `affected_sites`
- `generated_at_level` — enquiry scope for broader targeting

**Default recommendation:** `work_type_in_scope` — enquiries are designed to surface conditions across a work type, and findings typically apply wherever that work runs.

**Note:** Enquiry actions are not automatically created — the safety manager's conversion step is required.

---

### 3.4 · Control verification gap

**Source:** `source_type = 'control_verification'`

When a `WorksiteControl` verification returns `not_in_place` and escalates (manager alert or SLA breach), the responsible manager can directly create an action from the alert screen.

**What the control gap provides:**
- `work_type_id` — control register is per work type
- `worksite_id` — the site where the control gap was detected; resolves `affected_sites`

**Default recommendation:** `affected_sites` — a specific control at a specific site. Manager can escalate to `work_type_in_scope` if the gap likely exists at other sites running the same work type.

---

## 4 · Lifecycle

```
open ──────────────────────────────────────────► complete
  │                                                    ▲
  ▼                                                    │
in_progress ──────────────────────────────────────────┘
  │
  ▼ (if due_date passes without completion)
overdue ──── escalation alert fires to safety manager
```

### 4.1 · Status transitions

| Transition | Actor | Notes |
|---|---|---|
| `open` → `in_progress` | Assignee | Signals intent, not completion |
| `in_progress` → `complete` | Assignee or any onsite role | Requires `closure_notes` |
| `open` or `in_progress` → `overdue` | System | Auto-computed when `due_date` passes |
| `overdue` → `complete` | Assignee or any onsite role | Late closure — `closed_at > due_date` — still closeable |

**Closure is by onsite personnel, not the safety manager.** The safety manager created the dissemination and is accountable for whether sites acted. Each site's instance is theirs to close. Safety manager is notified on closure and sees aggregate progress — they do not confirm closure (no second gate).

### 4.2 · Overdue escalation

When an instance transitions to `overdue`:
- `escalated = TRUE`, `escalated_at = NOW()`
- Alert fires to safety manager: "[Action title] at [Worksite] is overdue — due [date], [N] days ago"
- Instance surfaces prominently in the worksite dashboard and in any visit briefing pack for that site
- Contributes to atrophy score immediately (see §5)

---

## 5 · Visibility and Tracking

### 5.1 · Worksite view (supervisor / safety slot member)

The worksite app surfaces a dedicated **Actions** section showing:
- All open instances assigned to this worksite, sorted by due date (soonest first)
- Overdue instances pinned at top with visual alert
- Each action card: step count, due date, source (which insight or investigation it came from), assigned person
- Tap opens the ordered step list and rationale from the parent `ActionDissemination`
- Assignee marks `in_progress` then `complete` — any onsite person with the relevant role can close if assignee is unavailable

### 5.2 · Safety manager view — aggregate progress

Against each parent source (insight, investigation, enquiry), each disseminated action shows a single progress bar:

**"Brief supervisors on pre-start requirements · 5 / 10 sites complete (50%)"**

That's the full insight-level view. Overdue and escalation signals (§4.2) already surface attention items through their own channels — the insight level does not duplicate them. A per-site breakdown (which sites are complete, which are open, which are overdue) is available as a drill-down but is not the primary surface.

### 5.3 · Visit briefing context

Open instances at a worksite surface in the visit briefing pack as a focus area. The briefing shows:
- How many open instances at this site
- Which are overdue
- Which are from high-priority insights or investigations
- Suggested follow-up: verify the action is genuinely in progress, not just marked so

---

## 6 · Relationship to Atrophy Score

The `corrective_action_overdue` signal in the atrophy score is computed from `CorrectiveAction` instances:

| Condition | Atrophy contribution |
|---|---|
| All open instances at this site within due date | 0 |
| Critical instance overdue > 7 days | Maximum contribution |
| Serious instance overdue > 14 days | High contribution |
| Moderate instance overdue > 30 days | Moderate contribution |

Closure — even late — stops the atrophy contribution. A site with no open instances contributes 0. Having actions is not an atrophy signal — having stale, uncompleted ones is.

---

## 7 · V2 Notes

**Per-step progress tracking**
V1: `actions JSONB` stores ordered steps on the `ActionDissemination`; one `CorrectiveAction` instance per site covers the full step set. Closure notes capture what was done across all steps. V2: step-level tracking — each step generates its own per-site instance, progress is visible per step, and partial completion (steps 1 done, step 2 open) is a first-class state.

**Cross-site action visibility for managers**
V1: managers see aggregate progress per dissemination. V2: a manager responsible for a subset of the targeted sites sees only their sites' instances — scoped to their purview — while the safety manager sees all.

**Action analytics**
Completion rate, average days-to-close, overdue rate by source type, work type, and site — feed into `workspace.analytics` as leading indicators of organisational response capability. Not specced in V1.

---

*Last updated: May 2026 — v2.0. Restructured from single entity to ActionDissemination + CorrectiveAction per-site instance model. Added shared dissemination model (§3.0), work-type targeting, aggregate progress. Update this file when: a new source type is added; targeting modes change; the atrophy threshold values change; closure rules change.*
