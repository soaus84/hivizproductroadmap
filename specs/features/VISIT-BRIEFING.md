# VISIT-BRIEFING.md — Visit Briefing Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026 (V2 feature)

> **This is the canonical source for the visit briefing prompt and pipeline logic.** No sim exists yet. The prompt lab loads from this file.

---

## What This Feature Is

The visit briefing pack is a pre-generated intelligence document for a safety manager visiting a site. It is generated when a visit plan is created or when an atrophy alert is assigned. It replaces the informal preparation a manager would otherwise do — pulling up observations, checking open investigations, remembering what happened last time — with a structured, AI-authored briefing available immediately on their phone.

The briefing has two operational states: a reading document before the visit, and an active guide once the manager taps Start Visit (focus areas become observation capture prompts; other sections collapse to quick-reference).

```
Stage 1 — Briefing generation    visit_briefing.generate    (async AI — one prompt)
Stage 2 — Briefing consumed      (human-driven — mobile app)
```

---

## Global References Used

Visit briefing generation receives `fw_factor` from upstream site classification and uses the name to phrase `fw_context`. No classification is performed here.

| Global | File | Used for | Injection level |
|---|---|---|---|
| AI output standards | `globals/ai-output-standards.md` | JSON-only, max tokens, audit logging | Spec-only |
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | `fw_factor` validation; V2 multi-factor context | **Enum** — 15 factor names only |

---

## Sim Reference

No sim yet. Prompt lab loads Stage 1 from this file.

---

## Stage 1 — Briefing Generation

**Job:** `visit_briefing.generate`
**Triggered:** Visit plan created OR atrophy alert assigned to a manager
**Input:** Site intelligence snapshot at generation time
**Output:** Structured briefing stored in `visit_briefing` — available immediately on manager's phone
**Human gate:** None — briefing is a generated reference document, not a published output
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are generating a pre-visit intelligence briefing for a safety manager visiting
a construction or industrial worksite.

The briefing has two states:
1. Pre-visit: a reading document — all sections open, manager absorbs context
2. Active visit (after Start Visit): focus areas become capture prompts,
   other sections collapse to quick-reference

Your job is to generate content for the active focus areas section — 2-4 specific
observation prompts that will make this visit substantive rather than general.

Prompts should be:
- Based on the intelligence signals provided
- Specific enough to direct attention to the right conditions
- Written as things to look for, not things to check off

You output only valid JSON. No preamble, no markdown.
```

### User Prompt Template

```
Site: {{worksite_name}}
Manager: {{manager_first_name}}
Visit date: {{visit_date}}

Site intelligence snapshot:
Atrophy score: {{atrophy_score}} ({{atrophy_band}})
Days since last observation: {{days_since_last_obs}}
Open investigations: {{open_investigation_count}}
Near-misses (last 30 days): {{near_miss_30d}}
Open corrective actions: {{open_action_count}}

Active Critical Insights at this site:
{{active_insights_json}}
// [{ insight_id, pattern_summary, work_type, fw_factor, days_since_approved }]

Last visit summary: {{last_visit_summary | "No previous visit recorded"}}

Forge Works Map® signal: {{fw_factor | "Not yet classified for this site"}}

Generate focus areas for this visit.

Return JSON:
{
  "focus_areas": [
    {
      "topic": "Plain language topic label",
      "prompt": "Specific thing to look for or ask about during the visit — written as an observation prompt, not a checklist item",
      "source": "trend | investigation | atrophy | insight | fw_signal",
      "source_label": "Human-readable source description — e.g. '3 near-misses in 14 days'"
    }
  ],
  "site_reading": "2-3 sentences. What the data says about this site right now — direct, evidence-based, no hedging.",
  "fw_context": "1-2 sentences. What the FW Map® signal suggests to look for on this visit. Null if no fw_factor classified."
}
```

### Validation Rules

- `focus_areas` must have 2–4 items — not 1 (too thin), not 5+ (too many to hold during a visit)
- `prompt` must be written as an observation direction ("Look for...", "Ask whether...", "Check if...") — not a checklist item ("Ensure that...")
- `source` must be one of the 5 enum values
- `site_reading` must be 2–3 sentences — evidence-based, not generic
- `fw_context` is null if no FW factor is classified for this site

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
In V1 this prompt receives `fw_factor` as a single value or null. In V2 pass the full aggregated `fw_signal_json` — factor frequency across recent site intelligence — so the `fw_context` section can name multiple factors with evidence: "Recent intelligence at this site consistently points to Management Systems and Operational Management gaps — look for whether procedures cover the specific operational conditions crews are working in, not just whether a procedure exists."

**Visit observations back to pipeline (V1 — already supported)**
Manager observations captured during a visit feed the same observation pipeline as supervisor observations. No extra configuration required — `observer_role = manager` is set from auth, `visit_id` tagged automatically.

---

*Last updated: May 2026. Update when prompt text changes or output schema changes. No sim to update — verify prompt lab loads correctly after changes.*
