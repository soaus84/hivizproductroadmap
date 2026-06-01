# VISIT-BRIEFING.md — Visit Briefing Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026 (V2 feature)

> **This is the canonical source for the visit briefing prompt and pipeline logic.** No sim exists yet. The prompt lab loads from this file.

---

## What This Feature Is

The visit briefing pack is a pre-generated intelligence document for a safety manager visiting a site. It is generated when a visit plan is created. It replaces the informal preparation a manager would otherwise do — pulling up observations, checking open investigations, remembering what happened last time — with a structured, AI-authored briefing available immediately on their phone.

The briefing has two operational states: a reading document before the visit, and an active guide once the manager taps Start Visit (focus areas become observation capture prompts; other sections collapse to quick-reference).

```
Stage 1 — Briefing generation    visit_briefing.generate    (async AI — one prompt)
Stage 2 — Briefing consumed      (human-driven — mobile app)
```

---

## Global References Used

Visit briefing generation receives `fw_factor` from upstream site classification and uses the name to phrase `fw_context`. No classification is performed here. Under Rule 1, the `SUMMARY-REFERENCE — fw-map-blueprint` block injects at runtime so the briefing can frame the factor with its one-sentence sense. The `Role` column is diagnostic — see `HOW-TO-READ-THIS.md §Global Injection Rules`.

| Global | File | Used for | Role |
|---|---|---|---|
| AI output standards | `globals/ai-output-standards.md` | JSON-only, max tokens, audit logging | behavioural |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | `fw_factor` validation; V2 multi-factor context | pass-through (factor names) |

---

## Sim Reference

`simulators/visit-briefing-sim.html` — exercises both jobs (`visit_briefing.generate` and `visit_plan.summarise`) across three scenarios that test the workspace-gating and sparse-data resilience of the briefing prompt:

| Scenario | Workspaces active | Data state |
|---|---|---|
| New client | core only | First visit — no obs, no previous visit, no analytics |
| Core + Analytics | core + analytics | Established site with elevated atrophy state, FW factor classified |
| Full stack | core + incident + analytics | Active site — open investigations, near-misses, full FW signal |

---

## Stage 1 — Briefing Generation

**Job:** `visit_briefing.generate`
**Triggered:** Visit plan created (see `SYSTEMIC-CAUSES.md` §Trigger Logic — Visit Briefing)
**Input:** Site intelligence snapshot at generation time — workspace-gated fields omitted when workspace not active
**Output:** Structured briefing stored in `visit_briefing` — available immediately on manager's phone
**Human gate:** None — briefing is a generated reference document, not a published output
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are generating a pre-visit intelligence briefing for a safety manager visiting
a construction or industrial worksite.

The briefing is an executive summary — brief, specific, and directly actionable.
It is not a report. Every sentence must earn its place.

Your job is to generate 2–4 focus areas — specific things for the manager to look
for or ask about during this visit. Focus areas must be grounded in the data
provided. Do not invent signals not present in the input.

Rules for handling sparse or missing data:
- Fields absent from the prompt are not available at this site — do not reference
  them or treat their absence as a finding. Workspace-gated data (investigations,
  atrophy score, FW signal) is simply omitted if that workspace is not active.
- Null or zero values for available fields ARE signals. No observations in 30 days
  is a finding. No previous visit on record means establishing a baseline is the
  purpose of this visit.
- When data is sparse (new site, new client), frame focus areas as baseline
  establishment — what to observe and document so that future visits have something
  to compare against. Use source: "baseline".
- A briefing with 2 strong, grounded focus areas is better than 4 thin ones.

You output only valid JSON. No preamble, no markdown.
```

### CANONICAL-USER-PROMPT-STAGE-1

Fields marked `[workspace.analytics]` or `[workspace.incident]` are only included
in the rendered prompt when that workspace is active. Omit the field entirely if
the workspace is not active — do not pass null.

```
Site: {{worksite_name}}
Manager: {{manager_first_name}}
Visit date: {{visit_date}}

Site intelligence snapshot:
Days since last observation: {{days_since_last_obs | "No observations on record"}}
Near-misses (last 30 days): {{near_miss_30d}}
Open corrective actions: {{open_action_count}}

[workspace.analytics only]
Atrophy score: {{atrophy_score}} ({{atrophy_band}})

[workspace.incident only]
Open investigations: {{open_investigation_count}}

Active Critical Insights at this site:
{{active_insights_json | "None"}}
// [{ insight_id, pattern_summary, work_type, days_since_approved }]

Last visit summary: {{last_visit_summary | "No previous visit recorded"}}

[workspace.analytics only]
Forge Works Map® signal: {{fw_factor | "Not yet classified for this site"}}

Generate focus areas for this visit.

Return JSON:
{
  "focus_areas": [
    {
      "topic": "Plain language topic label",
      "prompt": "One sentence. Specific thing to look for or ask — written as an observation direction, not a checklist item.",
      "source": "trend | investigation | atrophy | insight | fw_signal | baseline",
      "source_label": "Human-readable source — e.g. '3 near-misses in 14 days' or 'No observations on record'"
    }
  ],
  "site_reading": "1–2 sentences. What the available data says about this site — direct, evidence-based, no hedging. If data is sparse, say so plainly.",
  "fw_context": "1–2 sentences. What the FW Map® signal suggests to look for. Null if no fw_factor in prompt."
}
```

### Validation Rules

- `focus_areas` must have 2–4 items
- `prompt` must be one sentence written as an observation direction ("Look for...", "Ask whether...", "Check if...") — not a checklist item ("Ensure that...")
- `source` must be one of the 6 enum values — `baseline` is valid when data is sparse
- `site_reading` must be 1–2 sentences — evidence-based, not generic; plainly acknowledges sparse data when present
- `fw_context` is null if `fw_factor` was not in the prompt (workspace not active or not yet classified)
- Never reference data types not present in the prompt (e.g. do not mention investigations if `open_investigation_count` was omitted)

### Storage

```sql
visit_briefing.focus_areas          JSONB    -- the structured focus areas
visit_briefing.site_snapshot        JSONB    -- atrophy score + key metrics at generation time
visit_briefing.active_insights      JSONB    -- insights active at generation time
visit_briefing.open_actions         JSONB
visit_briefing.open_investigations  JSONB
visit_briefing.fw_signal            JSONB
visit_briefing.generated_at         TIMESTAMPTZ
visit_briefing.snapshot_expires_at  TIMESTAMPTZ    -- briefing marked stale if >48h before visit starts
```

### Staleness

If the visit hasn't started and the briefing is more than 48 hours old, the app shows a stale flag and offers to regenerate. Regeneration creates a new `visit_briefing` record — the old one is preserved for audit.

---

## Stage 2 — Briefing Consumption

**Human-driven, no AI call.**

**Pre-visit state:** All sections expanded. Manager reads briefing, reviews focus areas, sees site snapshot.

**Active visit state (after Start Visit):**
- Focus areas rendered as observation capture prompts — tapping one opens capture with the topic pre-populated
- Site snapshot, insights, and actions collapse to quick-reference accordion
- Manager observations captured during the visit are tagged with `visit_id`

**Post-visit:** Visit plan updated with `topics_covered`, `observations_logged_ids[]`, `completed_at`.

---

## V2/V3 Cascade Notes

**Multi-factor fw_signal context (V2)**
In V1 this prompt receives `fw_factor` as a single value or null (omitted if `workspace.analytics` not active). In V2 pass the full aggregated `fw_signal_json` — factor frequency across recent site intelligence — so the `fw_context` section can name multiple factors with evidence: "Recent intelligence at this site consistently points to Management Systems and Operational Management gaps — look for whether procedures cover the specific operational conditions crews are working in, not just whether a procedure exists."

**Visit observations back to pipeline (V1 — already supported)**
Manager observations captured during a visit feed the same observation pipeline as supervisor observations. No extra configuration required — `observer_role = manager` is set from auth, `visit_id` tagged automatically.

---

*Last updated: May 2026. Update when prompt text changes or output schema changes. No sim to update — verify prompt lab loads correctly after changes.*
