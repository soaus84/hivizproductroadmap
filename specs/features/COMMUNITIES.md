# COMMUNITIES.md — Communities Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026 (V7 feature)

> **This is the canonical source for the CoP thread generation prompt and community seeding pipeline.** No sim exists yet. Prompt lab loads from this file.

---

## What This Feature Is

The Communities workspace (V7) introduces a native communities-of-practice layer where supervisors, managers, and safety professionals share experience across sites. When a significant intelligence event occurs — a critical insight is approved, an investigation closes — the platform generates a discussion thread seeded to the relevant community. The safety manager reviews and approves before it appears.

The defining constraint: AI doesn't summarise the event and ask for comment. It reframes the event as the best possible prompt for meaningful practitioner discussion. The opening question is the deliverable. See framing principles in `globals/fw-map-blueprint.md` — Community Discussion Framing Principles section.

```
Stage 1 — Thread generation    cop_thread.generate    (async AI)
Stage 2 — Human review         (safety manager — approves content and room targeting)
Stage 3 — Seeding              (API call to CoP platform — human-confirmed)
```

---

## Global References Used

| Global | File | Used for |
|---|---|---|
| FW Map® Blueprint | `globals/fw-map-blueprint.md` | Community framing principles; factor-aware question framing |
| Anonymisation rules | `globals/anonymisation-rules.md` | Source narratives scrubbed before prompt |
| AI output standards | `globals/ai-output-standards.md` | JSON-only, max tokens, rationale standard |

---

## Sim Reference

No sim yet. Prompt lab loads Stage 1 from this file.

---

## Community Classes

Four classes (V7 architecture):

| Class | Membership | Purpose |
|---|---|---|
| Organisational | Affiliation (automatic by org membership) | Cross-org safety intelligence sharing |
| Practice | Affiliation (automatic by role/practice) | Discipline-specific discussion |
| Work type | Affiliation (automatic by work type at site) | Task-specific experience sharing |
| Working group | Invite-only, time-bounded, output-oriented | Structured collaborative work |

Thread seeds from the intelligence pipeline are targeted to Organisational, Practice, or Work type communities — never Working groups (which are purpose-specific and invite-only).

---

## Stage 1 — Thread Generation

**Job:** `cop_thread.generate`
**Triggered:** After Critical Insight approval OR investigation close (when `cleared_for_sharing = true`)
**Input:** Source insight or investigation + FW classification if available
**Output:** Draft thread — stored as `cop_thread_seed` with `status = draft`
**Human gate:** Safety manager reviews content and room targeting before seeding
**Max tokens:** 1000

### CANONICAL-SYSTEM-PROMPT-STAGE-1

```
You are generating discussion thread content for a safety community of practice —
a peer forum where supervisors, managers, and safety professionals share experience
across sites.

Your threads:
- Open with the substance, not a preamble or announcement
- Are conversational and direct — written as a practitioner talking to practitioners,
  not an organisation broadcasting to employees
- Ask one genuinely open question that invites real field experience
- Do not moralize, lecture, or reference compliance
- Are transparent that they originate from a field intelligence event —
  this is a feature, not a disclosure
- Feel like something worth reading and responding to

The thread will be attributed: "Generated from [insight/investigation reference],
approved by [safety manager name]." Do not include this in your output — it is
added automatically.

You output only valid JSON with no preamble, explanation, or markdown.
```

### User Prompt Template — Critical Insight Source

```
Source type: critical_insight
Work type: {{work_type_label}}
Practice type: {{practice_type_label | null}}

Pattern: {{pattern_summary}}
Likely cause: {{likely_systemic_cause}}
Toolbox narrative: {{toolbox_narrative}}
Endorsement context: {{endorsement_count}} managers across {{source_site_count}} sites confirmed this pattern

Forge Works Map® factor: {{fw_factor | null}}
Forge Works Map® domain: {{fw_domain | null}}

Generate a community of practice discussion thread. Return JSON:
{
  "thread_title": "A plain-language title that makes a practitioner want to read it. Not a safety slogan.",
  "thread_body": "3-5 sentences. Open with the substance — what happened or what the pattern shows. Written practitioner-to-practitioner. No announcement tone. No jargon.",
  "opening_question": "One open question inviting field experience. Specific enough to prompt a real answer. Not rhetorical."
}
```

### User Prompt Template — Investigation Source

```
Source type: investigation
Work type: {{work_type_label}}
Practice type: {{practice_type_label | null}}

Incident type: {{incident_type}}
Plain-language incident story: {{incident_story}}
Root cause (plain language): {{root_cause_plain}}
What we're doing: {{what_we_do_now_json}}

Forge Works Map® factor: {{fw_factor | null}}
Forge Works Map® domain: {{fw_domain | null}}

Generate a community of practice discussion thread. Return the same JSON schema.
```

### Framing Quality Test

Before storing the generated thread, the server checks the opening question against this test — the question should pass all three:

1. **Specific enough** — can a practitioner answer it from their own site experience without needing to know policy?
2. **Genuinely open** — does it invite a range of experience, not just yes/no?
3. **Worth answering** — would a supervisor with 15 years experience find something to say?

If the question fails (detectable by being purely rhetorical or requiring knowledge of the specific incident), log a warning and allow safety manager review to catch it.

### Validation Rules

- `thread_body` must be 3–5 sentences
- `opening_question` must be a question (ends with `?`) and must be a single question — not compound
- No names, identifying details, or specific site references — apply `globals/anonymisation-rules.md` to source narratives before prompt construction
- Factor language (`fw_factor` names, maturity labels) must never appear in any output field — it is for the platform layer only

---

## Stage 2 — Human Review and Targeting

**Human-driven.** Safety manager reviews draft thread and selects which community rooms to seed into.

**Review actions:**
- Edit `thread_title`, `thread_body`, or `opening_question`
- Select primary and optional secondary room from available community rooms
- Approve or cancel

**API:**
```
GET    /api/v1/cop-seeds/:id          — view draft
POST   /api/v1/cop-seeds/:id/approve  — approve with room selection
POST   /api/v1/cop-seeds/:id/seed     — trigger seeding to CoP platform
```

Approve sets `status = approved`. Seed triggers the CoP platform API call and sets `status = seeded`, `seeded_at`, `external_thread_id`.

---

## Stage 3 — Seeding

**API call to CoP platform.** Org-level configuration maps room IDs to CoP platform rooms.

The seeded thread structure:
```
1. Attribution header (added automatically, not in AI output):
   "Generated from [source reference], approved by [manager name] · [date]"

2. thread_body — the substantive context

3. opening_question — the discussion prompt

4. FW Map® factor tag — if classified (displayed as a platform badge, not text)

5. Link to full insight or investigation (if sharing_scope permits)
```

**Platform-agnostic:** The `cop_thread_seed` table stores the content. The integration adapter (per CoP platform — Viva Engage, Slack, custom) handles the API call format. Room ID mapping is org-level config.

---

## V2/V3 Cascade Notes

**Reciprocal intelligence loop (V7 design intent)**
High-engagement community discussions can surface as Critical Insight candidates. When a thread reaches a configurable engagement threshold (responses + reactions), the platform flags it to the safety manager as a potential insight source. This closes the loop between the intelligence pipeline and the community layer. The flagging logic is V7 infrastructure — the prompt for converting a community discussion into an insight candidate is a future addition to this file.

**Working group output seeding (future)**
Working groups produce structured outputs (documents, recommendations, decisions). When a working group closes, its output can optionally seed a discussion thread to a broader community. The prompt for working group output threading will be added here when working groups are built.

**Poll crossover (deferred)**
Polls were deferred from V7 to a future crossover with the enquiry model. When implemented, a poll thread type will be added here.

---

*Last updated: May 2026. Update when prompt text changes; output schema changes; community class model changes; framing principles in the Blueprint are updated. After updating, verify prompt lab loads Stage 1 correctly.*
