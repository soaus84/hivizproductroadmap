# CORRECTIVE-ACTIONS.md — Corrective Action Lifecycle Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026
Workspace: `workspace.core`

> **Spec authority for:** the `CorrectiveAction` entity, creation from four sources (insight improve step, investigation close, enquiry summary, control verification gap), lifecycle from creation to closure, worksite visibility, and relationship to the atrophy score.
>
> Corrective actions are the **operational layer** of the platform — the mechanism by which intelligence findings become site-level change. They are distinct from the intelligence pipeline (which operates on an async, manager-reviewed clock) because they run on a local, human clock: a named person at a specific worksite, with a due date, who marks it complete.

---

## 1 · Two Modes of the Platform

The Hiviz platform operates in two distinct modes that complement each other:

**Intelligence mode** — async, manager-reviewed, hours to days.
An observation is captured → enriched → pools with others → a CriticalInsight is generated and reviewed → FW Map® classified → broadcast via toolbox talk → safety manager understands systemic conditions. This mode produces understanding.

**Operational mode** — local, named-owner, minutes to weeks.
A control verification fails → work holds immediately → a manager creates a corrective action → a supervisor at that site is assigned it → they act → they close it. Or: an insight produces not just understanding but a specific task — put something in place, change a practice, complete a check. This mode produces change.

Both modes are necessary. Understanding without action doesn't change outcomes. Action without understanding fixes symptoms, not causes. Corrective actions are the bridge between the two.

**What makes corrective actions distinct:**
- They are always worksite-scoped — owned by a named person at a specific site
- They are closed by onsite personnel (supervisor, safety slot member) — not by the safety manager who created them
- They are visible in the app as a persistent task list — not a report, not a notification that disappears
- Their completion (or overdue status) contributes to the site's atrophy score — stale actions are as much a signal as stale observations

---

## 2 · CorrectiveAction Entity

```sql
CREATE TABLE safety_intelligence.corrective_action (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisation(id),
  worksite_id         UUID NOT NULL REFERENCES worksite(id),
  -- Always site-scoped. Cross-site issues create parallel actions per site.

  -- Source linkage — exactly one will be populated
  source_type         VARCHAR(30) NOT NULL
                      CHECK (source_type IN (
                        'critical_insight',       -- from insight improve step
                        'investigation',          -- from investigation close gate
                        'enquiry',                -- converted from enquiry recommended action
                        'control_verification'    -- from control not-in-place SLA breach or direct
                      )),
  source_insight_id   UUID REFERENCES safety_intelligence.critical_insight(id),
  source_incident_id  UUID REFERENCES safety_intelligence.critical_incident(id),
  source_enquiry_id   UUID REFERENCES safety_intelligence.enquiry(id),
  source_control_id   UUID REFERENCES safety_risk.worksite_control(id),

  -- The action itself
  title               TEXT NOT NULL,
  -- Short imperative: "Assign a dedicated fire watch for all hot work on this site"
  description         TEXT,
  -- Detail: what specifically needs to happen, any constraints or dependencies
  rationale           TEXT,
  -- Why this action addresses the finding — carried from the source

  -- Assignment
  assigned_to_id      UUID REFERENCES users(id),
  -- Named worksite person (supervisor, safety slot member, etc.)
  assigned_by_id      UUID NOT NULL REFERENCES users(id),
  -- Safety manager who created/disseminated the action
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date            DATE NOT NULL,

  -- Priority — informs display order and atrophy weighting
  priority            VARCHAR(20) NOT NULL DEFAULT 'moderate'
                      CHECK (priority IN ('critical', 'serious', 'moderate')),

  -- Lifecycle
  status              VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN (
                        'open',         -- assigned, not yet started
                        'in_progress',  -- assignee has marked as started
                        'complete',     -- closed by onsite personnel
                        'overdue'       -- past due_date, still not complete (computed)
                      )),

  -- Closure (by onsite personnel — supervisor or safety slot member)
  closed_by_id        UUID REFERENCES users(id),
  closed_at           TIMESTAMPTZ,
  closure_notes       TEXT,
  -- What was actually done. Not optional — the record is incomplete without it.

  -- Escalation
  escalated           BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_at        TIMESTAMPTZ,
  -- Set TRUE when action transitions to 'overdue' and safety manager is alerted

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3 · Creation Sources

### 3.1 · Insight improve step

The insight pipeline has a dedicated improve step between human review and FW classification. After a safety manager approves or edits a CriticalInsight, the platform prompts: "What actions does this insight require?" The safety manager can create one or more corrective actions, each assigned to one or more worksites.

For each selected worksite, a separate `CorrectiveAction` record is created with `source_type = 'critical_insight'`. This is how a single insight drives parallel actions across multiple sites simultaneously.

**Dissemination model:**
- Safety manager selects which sites are affected by this insight
- For each site, they can use the AI-suggested `recommended_action` from the insight, or write their own
- They assign a due date and priority
- Assigned worksite personnel are notified immediately

**UI placement:** The improve step sits between the review gate and `cleared_for_toolbox` in the insight card. An insight without any corrective actions can still be approved — actions are encouraged but not mandatory for insights with `signal_type = 'near_miss'` or where the recommended action is systemic (e.g. a procedure change that the safety manager handles directly).

**Relationship to CRITICAL-INSIGHT.md:** The improve step is not currently documented in CRITICAL-INSIGHT.md — it appears here as the primary spec authority for corrective action creation from insights. CRITICAL-INSIGHT.md should reference this file for the action creation step. See §7 V2 notes for the proposed CRITICAL-INSIGHT.md update.

---

### 3.2 · Investigation close gate

At investigation close (INVESTIGATION.md Stage 2 close gate), the `corrective_actions` field on the investigation record must contain at least one confirmed action before the investigation can be closed. Those actions are converted to `CorrectiveAction` records.

The investigation's `worksite_id` is the default scope. If the investigation identified that the same condition likely exists at other sites, the safety manager can disseminate the same actions to those sites (same pattern as §3.1 — one `CorrectiveAction` record per site).

**Source:** `source_type = 'investigation'`, `source_incident_id` FK populated.

---

### 3.3 · Enquiry summary

When an enquiry is summarised (`enquiry.summarise` job), the output includes `recommended_actions[]` — 2–3 specific, implementable actions derived from the enquiry findings. These are AI-generated and appear in the safety manager's workbench as action candidates.

The safety manager reviews them and converts any they accept into `CorrectiveAction` records using the same dissemination flow as §3.1. Enquiry actions are not automatically created — the safety manager's conversion step is required.

**Source:** `source_type = 'enquiry'`, `source_enquiry_id` FK populated.

---

### 3.4 · Control verification gap

When a `WorksiteControl` verification returns `not_in_place` and is escalated (manager alert or SLA breach), the responsible manager can directly create a corrective action from the alert screen: "Put [control name] in place."

This is the most direct path — the gap is identified, the action is created in the same moment, assigned to a named worksite person, with a due date. The action is tightly scoped: get this specific control back in place.

If the SLA is breached and a `barrier_failure` observation is auto-created (see RISK-CONTROLS.md §6.4), a corrective action can be created alongside the observation — or the safety manager creates it manually from the alert view.

**Source:** `source_type = 'control_verification'`, `source_control_id` FK populated.

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
| `open` → `in_progress` | Assignee | Taps "Start" on the action in the app — signals intent, not completion |
| `in_progress` → `complete` | Assignee or any onsite role (supervisor, safety slot member) | Requires `closure_notes` — what was actually done |
| `open` or `in_progress` → `overdue` | System | Auto-computed when `due_date` passes and status is not `complete` |
| `overdue` → `complete` | Assignee or any onsite role | Late closure — `closed_at` > `due_date` — still closeable, records the lateness |

**Closure is by onsite personnel, not the safety manager.** The safety manager created the action and is accountable for whether the site acted. The action itself is the site's to close. Safety manager is notified on closure and can see all closed actions in the site dashboard — they do not confirm closure (no second gate).

### 4.2 · Overdue escalation

When an action transitions to `overdue`:
- `escalated = TRUE`, `escalated_at = NOW()`
- Alert fires to the safety manager: "[Action title] at [Worksite] is overdue — due [date], [N] days ago"
- Action surfaces prominently in the worksite dashboard and in any visit briefing pack for that site
- Contributes to atrophy score immediately (see §5)

---

## 5 · Visibility and Tracking

### 5.1 · Worksite view (supervisor / safety slot member)

The worksite app surfaces a dedicated **Actions** section showing:
- All open actions assigned to this worksite, sorted by due date (soonest first)
- Overdue actions pinned at the top with a visual alert
- Completed actions accessible but de-emphasised (recent history, not task list)

Each action card shows: title, due date, source (which insight or investigation it came from), assigned person. A tap opens the full description and rationale.

The person assigned taps to mark `in_progress` then `complete`. Any onsite person with the relevant role can close it if the assignee is unavailable.

### 5.2 · Safety manager view

The safety manager sees:
- All open actions across all worksites — filterable by site, source, due date, priority
- Overdue actions flagged prominently
- Completion rate per site (percentage of actions closed on time vs late vs still open)
- Open action count per site feeds into visit briefing priority

### 5.3 · Visit briefing context

When a `visit_plan` is created for a worksite (see SYSTEMIC-CAUSES.md), open corrective actions at that site appear as a focus area source (`open_corrective_action` type). The visit briefing pack surfaces:
- How many open actions at this site
- Which are overdue
- Which are from high-priority insights or investigations
- Suggested follow-up: verify the action is in progress, not just marked so

---

## 6 · Relationship to Atrophy Score

The `corrective_action_overdue` signal in the atrophy score (SYSTEMIC-CAUSES.md §3) is computed from `CorrectiveAction` records:

| Condition | Atrophy contribution |
|---|---|
| All open actions at this site are within their due date | 0 (no atrophy from actions) |
| One or more actions are overdue by ≤ `priority` threshold | Partial contribution |
| Critical action overdue > 7 days | Maximum contribution from this signal |
| Serious action overdue > 14 days | High contribution |
| Moderate action overdue > 30 days | Moderate contribution |

An action closed late (past due_date) still contributes to the atrophy signal until it is closed. Closure — even late — stops the contribution.

A worksite with no open actions at all contributes 0 to this signal. Having actions is not itself an atrophy signal — having stale, uncompleted actions is.

---

## 7 · V2 Notes

**CRITICAL-INSIGHT.md improve step (V2 update needed)**
The improve step described in §3.1 is not currently documented in CRITICAL-INSIGHT.md. In the current spec, the insight review gate outputs `cleared_for_toolbox` and `fw_classify` fires. The improve step sits between review and classification. A V2 update to CRITICAL-INSIGHT.md should document:
- The improve step UI placement
- That actions are optional (encouraged but not blocking for most signal types)
- That `recommended_action` and `recommended_action_rationale` fields on the insight are the source for pre-populated action text
- The dissemination selector (which sites)

This spec is the authority until CRITICAL-INSIGHT.md is updated.

**Cross-site action visibility**
A safety manager disseminates the same insight-derived action to multiple sites. Currently the data model creates separate `CorrectiveAction` records per site. V2: add a `parent_action_id` FK linking related site actions to the originating dissemination event — allowing the safety manager to see aggregate completion status across all sites for the same action, not just per-site counts.

**Action analytics**
Completion rate, average days-to-close, overdue rate by source type and site — feed into the Systemic Map workspace (analytics) as leading indicators of organisational response capability. Not specced in V1.

---

*Last updated: May 2026 — v1.0 initial spec. Corrective actions were previously scattered as JSONB fields across investigation, enquiry, and insight records without a first-class entity. This spec consolidates them. Update this file when: closure rules change; a new source type is added; the atrophy threshold values change; the insight improve step is formally documented in CRITICAL-INSIGHT.md.*
