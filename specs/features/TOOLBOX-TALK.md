# TOOLBOX-TALK.md — Toolbox Talk Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026

> **This is the canonical source for all prompt text, content selection logic, and delivery rules for the toolbox talk feature.** The prompt lab loads from this file. If prompt text elsewhere conflicts, this file wins.

---

## What This Feature Is

The toolbox talk is the platform's primary broadcast output — the mechanism by which intelligence from the field reaches frontline crews. A supervisor requests a talk for today's work type; a deterministic algorithm selects the most relevant available intelligence (max 3 items); AI assembles it into a cohesive spoken narrative; the supervisor reads it to their crew and logs attendance.

The feature has three stages plus a post-delivery consideration:

```
Stage 1 — Content selection algorithm     (synchronous, server-side, no AI)
Stage 2 — Talk assembly                   toolbox_talk.generate    (synchronous AI)
Stage 3 — Presenter review and delivery   (human-driven, mobile app)
Post-delivery — Atrophy score update      (algorithm, async)
```

**This feature is strictly pull-based.** The system does not schedule or push talks. The supervisor requests when needed. See TALK-01.

---

## Global References Used

Talk assembly operates on pre-classified content (approved insights, closed investigations, enriched observations) and does not reference any taxonomy global. Rule 1 does not apply because no taxonomy global is referenced; only behavioural rules apply, inline. The `Role` column is diagnostic — see `HOW-TO-READ-THIS.md §Global Injection Rules`.

| Global | File | Used for | Role |
|---|---|---|---|
| Anonymisation rules | `globals/anonymisation-rules.md` | Content items scrubbed before assembly prompt | behavioural |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, token limits (1500), audit logging | behavioural |

No taxonomy globals needed — this prompt operates on pre-classified content, not raw observations.

---

## Sim Reference

- `simulators/workflow-sim.html` — all three scenarios include a talk assembly step in scripted form with mock content. The sim does not make live AI calls for talk generation.
- **Prompt lab** — loads Stage 2 (`toolbox_talk.generate`) from this file.

---

## Stage 1 — Content Selection Algorithm

**No AI call.** Runs synchronously server-side on `POST /api/v1/toolbox-talks/generate`.

### Input

```json
{
  "worksite_id": "uuid",
  "work_type_id": "uuid",
  "presenter_id": "uuid"
}
```

### Selection logic

```
GIVEN: worksite_id, work_type_id, presenter_id

candidates = []

-- 1. Critical Insights (highest priority)
ADD critical_insight WHERE:
  cleared_for_toolbox = true
  AND sharing_scope covers this worksite's org path
  AND (work_type_id = input.work_type_id OR work_type_id IS NULL)
  AND NOT (legal_hold = true via any source_investigation_id)
  ORDER BY created_at DESC
  LIMIT 2

-- 2. Closed Investigations with narratives
ADD investigation WHERE:
  status = 'closed'
  AND cleared_for_sharing = true
  AND legal_hold = false
  AND sharing_scope covers this worksite's org path
  AND incident.work_type_id = input.work_type_id
  AND toolbox_narrative IS NOT NULL
  ORDER BY closed_at DESC
  LIMIT 2

-- 3. Recent observations from this site (last 7 days)
ADD observation WHERE:
  worksite_id = input.worksite_id
  AND cleared_for_sharing = true
  AND ai_signal_type IN ('at_risk_condition', 'unwanted_energy_event', 'barrier_failure')
  AND work_type_id = input.work_type_id
  AND observed_at >= now() - INTERVAL '7 days'
  ORDER BY observed_at DESC
  LIMIT 3

-- 4. Older observations from this site (8–30 days)
ADD observation WHERE:
  worksite_id = input.worksite_id
  AND cleared_for_sharing = true
  AND ai_signal_type IN ('at_risk_condition', 'unwanted_energy_event', 'barrier_failure')
  AND work_type_id = input.work_type_id
  AND observed_at BETWEEN now() - INTERVAL '30 days' AND now() - INTERVAL '7 days'
  ORDER BY observed_at DESC
  LIMIT 3

-- De-duplication: remove observations already used in selected insights
REMOVE observation WHERE observation.id IN (
  SELECT unnest(source_observation_ids::uuid[])
  FROM critical_insight
  WHERE critical_insight.id IN [selected critical insight ids]
)

-- Final cap — hard limit (TALK-02)
RETURN candidates[0..2]   -- max 3 items, priority order maintained
```

### Zero-content fallback

If no eligible content exists after selection:

```
Generate talk using only work type taxonomy context:
  - PPE requirements for this work type
  - Standard controls for this work type
  - Emergency procedures
  - No observation-derived content
```

This always produces a usable talk but marks `generated_content.source_type = 'taxonomy_only'` so it can be identified in analytics.

### Sharing eligibility gate

Runs on every candidate before it enters the pool. Hard blocks:

| Condition | Block |
|---|---|
| `legal_hold = true` | Block — checked at query time, not stored flag |
| `observation.cleared_for_sharing = false` | Block |
| `investigation.status != 'closed'` | Block |
| `investigation.cleared_for_sharing = false` | Block |
| `critical_insight.cleared_for_toolbox = false` | Block |
| `critical_insight` has source_investigation with `legal_hold = true` | Block — INS-05 |

### Content item shape passed to Stage 2

Each selected item is serialised into a content item object for the assembly prompt:

```json
{
  "type": "critical_insight | investigation | observation",
  "source_label": "human-readable source identifier — e.g. 'Regional pattern, last 30 days'",
  "work_type": "work type label",
  "narrative": "the text content — scrubbed per anonymisation-rules.md",
  "signal_type": "at_risk_condition | barrier_failure | ...",
  "practice": "practice label if available | null"
}
```

**Anonymisation:** all `narrative` fields must have `ai_anonymisation_flags` applied before serialisation. See `globals/anonymisation-rules.md`.

---

## Stage 2 — Talk Assembly

**Job:** `toolbox_talk.generate`
**Triggered:** Synchronously on `POST /api/v1/toolbox-talks/generate`, after Stage 1
**Input:** Algorithm-selected content set (max 3 items) + worksite context
**Output:** Complete structured talk stored in `toolbox_talk.generated_content`
**Human gate:** Supervisor reviews before delivery; can add personal notes or edit any section
**Max tokens:** 1500 — the highest token budget of any prompt; talk content is the most verbose output
**Target latency:** P95 < 8s — this is a synchronous call on the supervisor's device

### CANONICAL-SYSTEM-PROMPT-STAGE-2

```
You produce toolbox talks for frontline construction and industrial crews.

Your voice:
- A 20-year site veteran: plain English, no corporate speak, no moralising, no filler
- Assumes the crew are experienced professionals who do not need to be lectured
- Writes as if the supervisor is speaking directly to their team
- Every sentence earns its place — no padding, no repetition
- Discussion questions feel fresh and specific, not recycled from a template

Rules:
- Never reference specific names of individuals
- Never reproduce identifying details from investigation or observation source materials
- Weave the content items into a single cohesive narrative — do not list them separately
- The closing line should sound like something a real person would say, not a safety slogan

You output only valid JSON with no preamble, explanation, or markdown formatting.
```

### User Prompt Template

```
Today's context:
Worksite: {{worksite_name}}
Work scheduled: {{work_type_label}}
Presenter first name: {{presenter_first_name}}

Content items (in priority order, algorithm-selected):
{{content_items_json}}

Assemble a complete toolbox talk from these content items.

Return JSON:
{
  "hazard_intro": "2-3 sentences. What today's work is and the single most important hazard to keep in mind.",
  "main_content": "6-10 sentences. Cohesive narrative weaving all content items together. Written to be spoken aloud. Present tense.",
  "key_actions": [
    "Action 1 — specific, behaviourally concrete, relevant to today's work",
    "Action 2",
    "Action 3",
    "Action 4"
  ],
  "discussion_questions": [
    "Question 1 — specific to today's work and the hazard",
    "Question 2 — prompts crew to reflect on their own practice",
    "Question 3 — identifies a gap or condition the crew can act on today"
  ],
  "closing_line": "1 sentence. Something a real supervisor would say to close. Not a slogan."
}
```

### Validation Rules

- `hazard_intro` must be 2–3 sentences — not a single sentence
- `main_content` must be 6–10 sentences — validated on storage
- `key_actions` must have 3–5 items — hard range, enforced before storage
- `discussion_questions` must have exactly 3 items
- `closing_line` must be exactly 1 sentence
- No names or identifying details — content items must be pre-scrubbed before prompt construction

### Storage

```sql
-- stored in toolbox_talk table
toolbox_talk.generated_content    JSONB    -- full structured talk object
toolbox_talk.observation_ids      JSONB    -- source observation UUIDs used
toolbox_talk.investigation_ids    JSONB    -- source investigation UUIDs used
toolbox_talk.critical_insight_ids JSONB    -- source insight UUIDs used
toolbox_talk.generated_at         TIMESTAMPTZ
toolbox_talk.attendee_count       INT      -- number of crew present at delivery
```

`generated_content` structure mirrors the output JSON exactly. The presenter's edits overwrite sections in place; `content_edited = true` is flagged and the original is preserved in `generated_content_original` for audit.

---

## Stage 3 — Presenter Review and Delivery

**Human-driven.** No AI call.

### Presenter can:
- Read the assembled talk in full on their phone
- Add `presenter_notes` (site-specific context not in the generated content)
- Edit any section of generated content — `content_edited = true` flagged
- Regenerate entirely with `POST /api/v1/toolbox-talks/generate` (new record created)

### Delivery — `PATCH /api/v1/toolbox-talks/:id/deliver`

```json
{
  "attendee_count": 12,
  "delivered_at": "2026-05-13T07:45:00Z"
}
```

**Once delivered, the record is locked (TALK-04):**
- `delivered_at` is set and locked — cannot be changed
- `attendee_ids` is locked
- Content cannot be modified after delivery
- This provides a defensible attendance and content record for regulatory purposes

### API endpoints

```
POST   /api/v1/toolbox-talks/generate     — creates new talk (content selection + assembly)
GET    /api/v1/toolbox-talks/:id          — retrieve talk with generated content
PATCH  /api/v1/toolbox-talks/:id          — edit presenter_notes or generated_content sections
PATCH  /api/v1/toolbox-talks/:id/deliver  — mark as delivered, lock record
```

---

## Business Rules Reference

The authoritative source for all toolbox talk rules is `SPEC.md` §8.4. Reproduced here for convenience — if they conflict with SPEC.md, SPEC.md wins.

**TALK-01: Talk is generated on demand**
The system does not schedule or push talks. A new talk is generated when the supervisor requests one. If a talk has already been generated for the same worksite + work type today, the system offers to reuse or regenerate.

**TALK-02: Content max 3 items (hard limit)**
Content selection returns a maximum of 3 items. Additional content degrades attention and talk length. If zero eligible items exist, generate from work type taxonomy context only.

**TALK-03: Presenter edit is always available**
The presenter can edit any section before delivery. Edits are flagged; original generated content is preserved for audit.

**TALK-04: Delivery record is final**
Once delivered, content and delivery data are locked. This is a regulatory record.

**TALK-05: Delivery confirmation**
The supervisor marks the talk as delivered. `attendee_count` records how many crew were present. No individual sign-off is required — the supervisor's confirmation is the accountable record.

---

## Post-Delivery — Atrophy Score Update

After `delivered_at` is set, the `toolbox_talk_recency` signal in the worksite's atrophy score resets to 0. This reduces the composite atrophy score and may transition the worksite from `elevated` to `active` state if other signals are also healthy.

Atrophy state: `active` (0–39) / `elevated` (40–69) / `critical` (70–100). State is used for visit wizard prioritisation — no push notification fires on transition. Full model and composite formula in `SYSTEMIC-CAUSES.md` §Atrophy Score.

---

## Talk Dissemination — Safety Manager Broadcast

The safety manager can generate a talk from an approved insight, review and edit it, and broadcast it to targeted worksites. This is distinct from the supervisor-pull path (§Stage 1–3) — it is a push from the safety manager to sites.

### Flow

```
Insight approved
  → Safety manager triggers talk generation from insight
  → toolbox_talk.generate runs with insight narrative as primary content item
  → Safety manager reviews assembled talk — edits any section if needed
  → Selects dissemination scope (same targeting model as corrective actions)
  → Broadcasts — TalkDissemination record created, per-site instances created
  → Supervisors at targeted sites see the talk in their queue
  → Supervisor delivers to crew, marks complete
  → Aggregate progress updates: N / N sites delivered
```

### Entities

**TalkDissemination** — parent record, created once when the safety manager broadcasts.

```sql
talk_dissemination.id                 UUID
talk_dissemination.org_id             UUID
talk_dissemination.source_insight_id  UUID  -- the insight this talk was generated from
talk_dissemination.toolbox_talk_id    UUID  -- the assembled talk record
talk_dissemination.dissemination_scope VARCHAR(30)
                                      -- CHECK IN ('affected_sites', 'work_type_in_scope', 'full_scope')
talk_dissemination.target_worksite_ids UUID[]  -- resolved at broadcast time
talk_dissemination.created_by_id      UUID
talk_dissemination.created_at         TIMESTAMPTZ
```

**TalkDelivery** — per-site instance, one per targeted worksite.

```sql
talk_delivery.id                  UUID
talk_delivery.dissemination_id    UUID
talk_delivery.worksite_id         UUID
talk_delivery.status              VARCHAR(20)
                                  -- CHECK IN ('pending', 'delivered')
talk_delivery.delivered_by_id     UUID   -- supervisor who marked it done
talk_delivery.attendee_count      INT
talk_delivery.delivered_at        TIMESTAMPTZ
UNIQUE (dissemination_id, worksite_id)
```

### Aggregate progress

```sql
SELECT
  COUNT(*)                                      AS total_sites,
  COUNT(*) FILTER (WHERE status = 'delivered')  AS delivered,
  COUNT(*) FILTER (WHERE status = 'pending')    AS pending
FROM talk_delivery
WHERE dissemination_id = :id;
```

Visible against the insight as: **5 / 10 sites delivered (50%)**

### Duplicate prevention

A site already with a `pending` or `delivered` instance for this dissemination will not receive a second instance if the safety manager re-runs or adjusts scope. The `UNIQUE (dissemination_id, worksite_id)` constraint enforces this at the database level.

---

## V2/V3 Cascade Notes

**Maturity-aware framing (V2)**
In V1 the talk voice is fixed: veteran site supervisor, plain-spoken, systemic focus. In V2, pass `fw_maturity_signals[]` from the approved insight into the assembly prompt so the narrative register adapts:
- `compliant` → frame around procedure gaps and what the system should specify
- `leading` → frame around leadership signals and what managers should be noticing
- `resilient` → frame around adaptive practice and anticipating emergent conditions

The system prompt `CANONICAL-SYSTEM-PROMPT-STAGE-2` will gain a maturity framing section in V2. That update belongs in this file.

**Translation (V2 — already partially specified)**
`product-spec.html` references a translation prompt (Prompt 9) that takes the full talk text and a target language and returns plain translated text. This runs on demand when a supervisor changes language in the talk view. No human gate — translation output is immediately displayed. The translation prompt is simple (one sentence system prompt, full talk as input) and will be added to this spec as Stage 2b when implemented.

**Safe observation recognition (V2)**
In V1, positive performance observations (`signal_type = positive_performance`) are excluded from content selection. In V2, if the presenter explicitly requests recognition content, safe observations from their own worksite in the last 7 days may be added as an optional 4th item. This extends the selection algorithm at Step 3 — the change belongs in Stage 1 of this file.

---

*Last updated: May 2026. Update this file when: prompt text changes; content selection logic changes; delivery payload changes; business rules change. After updating, verify prompt lab P5 loads the updated system prompt correctly.*
