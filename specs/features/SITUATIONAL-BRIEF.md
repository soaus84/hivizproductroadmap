# SITUATIONAL-BRIEF.md — Situational Brief Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026 (V2 feature)

> **This is the canonical source for the situational brief prompt and distribution pipeline.** No sim exists yet. Prompt lab loads from this file.

---

## What This Feature Is

The situational brief is the platform's management-layer communication output — the structured document a safety manager would otherwise write ad hoc after approving an insight or closing an investigation. It replaces informal emails to divisional leadership with a consistent, intelligence-grounded brief that is reviewed before distribution and never auto-sent.

Audience: managers and safety professionals within the approved sharing scope. Not crew-facing.

```
Stage 1 — Brief generation    situational_brief.generate    (async AI)
Stage 2 — Human review        (safety manager approves before distribution)
Stage 3 — Distribution        (to sharing scope — human-confirmed)
```

---

## Global References Used

Brief generation receives the FW classification produced upstream (factor, domain, maturity signal, rationale) and references the factor by name in `what_it_means`. No classification is performed here.

| Global | File | Used for | Injection level |
|---|---|---|---|
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | Factor-level framing in `what_it_means` — factor name passes through from upstream classification | **Enum** — 15 factor names only |
| Anonymisation rules | `globals/anonymisation-rules.md` | Source narratives scrubbed before prompt | Spec-only |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, max tokens, draft status | Spec-only |

---

## Sim Reference

No sim yet. Prompt lab loads Stage 1 from this file.

---

## Stage 1 — Brief Generation

**Job:** `situational_brief.generate`
**Triggered:** After Critical Insight approval OR investigation close (when sharing scope reaches manager level)
**Input:** Source insight or investigation + FW classification if available
**Output:** Draft brief stored as `situational_brief` with `status = draft`
**Human gate:** Safety manager reviews before distribution — never auto-sent
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are writing a situational brief for safety managers and divisional leadership.
This brief replaces the ad-hoc email a safety manager would otherwise write after
approving an insight or closing an investigation.

Voice:
- Professional, clear, direct
- Written for experienced safety managers and operational leaders
- No jargon, no passive voice
- Evidence-based — cites what the data shows, not what you suspect
- References Forge Works Map® classification if available — name the factor,
  not just the domain

You output only valid JSON. No preamble, no markdown.
```

### User Prompt Template — Critical Insight Source

```
Source type: critical_insight
Pattern summary: {{pattern_summary}}
Likely systemic cause: {{likely_systemic_cause}}
Recommended action: {{recommended_action}}
Toolbox narrative: {{toolbox_narrative}}
Source observation count: {{observation_count}}
Site count: {{source_site_count}}
Enquiry drafted: {{enquiry_drafted}}

Forge Works Map® classification:
Factor: {{fw_factor | "Not yet classified"}}
Domain: {{fw_domain | null}}
Maturity signal: {{fw_maturity_signal | null}}
Rationale: {{fw_rationale | null}}

Generate a situational brief.

Return JSON:
{
  "title": "Plain-language title. Not a safety slogan. What this is about.",
  "what_happened": "2-3 sentences. The pattern or incident in plain language. What the data shows, not just what one event involved.",
  "what_it_means": "2-3 sentences. The organisational interpretation. What this tells us about how we manage work. Reference Forge Works Map® factor if classified — name the factor, explain the gap.",
  "what_is_being_done": "2-3 sentences. Corrective actions, enquiry launched, toolbox talk generated — what's already in motion.",
  "key_questions": [
    "A question for managers to reflect on or investigate at their sites",
    "A second question — optional, include only if genuinely adds value"
  ]
}
```

### User Prompt Template — Investigation Source

```
Source type: investigation
Work type: {{work_type_label}}
Incident type: {{incident_type}}
Immediate cause: {{immediate_cause}}
Root cause: {{root_cause}}
Corrective actions: {{corrective_actions_json}}
Cleared for sharing: {{cleared_for_sharing}}

Forge Works Map® classification:
Factor: {{fw_factor | "Not yet classified"}}
Domain: {{fw_domain | null}}
Maturity signal: {{fw_maturity_signal | null}}
Rationale: {{fw_rationale | null}}

Generate a situational brief. Return the same JSON schema.
```

### Validation Rules

- `what_happened` must be 2–3 sentences
- `what_it_means` must be 2–3 sentences — must reference FW factor by name if classified, not just domain
- `what_is_being_done` must be 2–3 sentences — must be specific about what is actually in motion, not aspirational
- `key_questions` must have 1–2 items — second is optional and should only be included if it adds genuine value
- No names or identifying details — apply anonymisation before prompt construction
- Do not reference specific sites, dates, or individuals — `what_happened` must be abstracted to work type and org level

### Storage

```sql
situational_brief.title              TEXT
situational_brief.what_happened      TEXT
situational_brief.what_it_means      TEXT
situational_brief.what_is_being_done TEXT
situational_brief.key_questions      JSONB    -- array of 1-2 strings
situational_brief.fw_factors[]       TEXT[]   -- from source entity classification
situational_brief.fw_domains[]       TEXT[]
situational_brief.fw_maturity_signals[] TEXT[]
situational_brief.fw_confidences[]   DECIMAL(3,2)[]
situational_brief.fw_rationales[]    TEXT[]
situational_brief.status             TEXT     -- draft | approved | distributed | cancelled
situational_brief.created_at         TIMESTAMPTZ
```

---

## Stage 2 — Human Review

**Human-driven.** Safety manager reviews draft and decides whether to distribute.

**Review actions:**
- Read and edit any section
- Confirm sharing scope
- Approve for distribution or cancel

**API:**
```
GET    /api/v1/situational-briefs/:id           — view draft
POST   /api/v1/situational-briefs/:id/approve   — approve with final sharing scope
POST   /api/v1/situational-briefs/:id/distribute — trigger distribution
```

---

## Stage 3 — Distribution

On `POST /api/v1/situational-briefs/:id/distribute`:
- Brief distributed to all users within `sharing_scope` who hold manager or safety manager roles
- Delivered as a push notification with in-app deep link
- `distributed_at` set, `status = distributed`
- Brief never auto-distributed — always requires the explicit distribute call

---

## V2/V3 Cascade Notes

**Multi-factor fw_factors array (V2)**
In V1 this prompt receives `fw_factor` as a single value (or null). In V2 pass the full `fw_factors[]` arrays with `fw_rationales[]` so `what_it_means` can name each factor with its rationale: "This pattern reflects gaps in two organisational capacities: Management Systems (the PTW doesn't cover spotter continuity) and Operational Management (visiting managers haven't identified or actioned the absence of a handover protocol)." That framing is what makes the brief genuinely useful to a division manager.

---

*Last updated: May 2026. Update when prompt text changes; output schema changes; distribution mechanism changes. No sim to update — verify prompt lab loads correctly after changes.*
