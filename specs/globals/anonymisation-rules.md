# anonymisation-rules.md — Anonymisation Rules

**Forge Works · Hiviz SafetyPlatform — Global Reference**
Version: 1.0

> **Scope:** PII handling rules for all AI prompts that process observation or incident text. Feature specs reference these rules — they do not repeat them.

---

## Why This Exists

Observations and incident reports are written by supervisors in their own words. They frequently contain names, role identifiers that could identify individuals in small teams, and location details specific enough to identify a person. Before this text is passed to downstream prompts — or shared across org levels — identifying phrases must be flagged and scrubbed.

This is handled in two steps:
1. **Enrichment flags** — `observation.enrich` identifies phrases that could identify individuals and stores them in `ai_anonymisation_flags`
2. **Downstream scrubbing** — any subsequent prompt that references the same observation text uses `ai_anonymisation_flags` to replace identified phrases before including text in the prompt

---

## What Counts as Identifying

Flag any phrase in observation or incident text that could, on its own or in combination with other context, identify a specific individual.

**Names — always flag:**
- First names: *"John was operating the excavator"* → flag `John`
- Full names: always flag
- Nicknames or handles commonly used on site

**Role + context combinations — flag when specific enough to identify:**
- *"the afternoon shift supervisor"* in a small team where there is only one → flag
- *"the new operator"* when context makes them identifiable → flag
- *"the apprentice"* when only one apprentice is on site → flag
- Generic roles alone (e.g. *"the operator"*, *"the crew"*) → do not flag

**Location specifics that identify a person:**
- *"the operator on Level 3 bench"* if only one person works that bench → flag
- Equipment identifiers that are person-assigned: *"Unit 47"* if one person always operates Unit 47 → flag where the link is made explicit in the text

**Do not flag:**
- Generic role references: *"the supervisor"*, *"an operator"*, *"the crew"*
- Location references that don't identify a person: *"the northern pit"*, *"Level 3"*
- Work type or task descriptions: *"during the reversing operation"*, *"while completing the permit"*

---

## Flagging Format

The enrichment prompt returns identified phrases in the `ai_anonymisation_flags` array:

```json
{
  "ai_anonymisation_flags": [
    "John",
    "the afternoon shift supervisor",
    "Unit 47 operator"
  ]
}
```

Each entry is the exact phrase as it appears in the original text — not a category label. This allows downstream prompts to do exact-string replacement.

---

## Downstream Scrubbing

Before any prompt passes observation text to the AI for a downstream purpose (insight generation, enquiry seeding, toolbox narrative, community thread, situational brief), the server-side prompt builder must:

1. Retrieve `ai_anonymisation_flags` for the source observation(s)
2. Replace each flagged phrase in the observation text with a neutral descriptor

**Replacement convention:**

| Flagged phrase type | Replace with |
|---|---|
| Personal name | `[a worker]` |
| Role + identifying context | `[a supervisor]` / `[an operator]` / `[a crew member]` |
| Equipment identifier that identifies a person | `[a plant operator]` |

**Example:**
- Original: *"John was operating excavator Unit 47 on Level 3 bench. The afternoon shift supervisor had confirmed the spotter was in position."*
- After scrubbing: *"[a worker] was operating [plant] on Level 3 bench. [a supervisor] had confirmed the spotter was in position."*

**Rule:** When in doubt, scrub. A false positive (scrubbing a non-identifying phrase) is always preferable to a false negative (passing an identifying phrase to a shared context).

---

## What Is Never Shared

Regardless of `ai_anonymisation_flags`:

- The name of the observer (the person who logged the observation) is never included in any prompt passed to the AI — it is stored separately and only visible to authorised users in the platform UI
- `injury_description` from incident records is never passed to insight or toolbox narrative prompts
- Investigation records under `legal_hold = true` are never passed to any AI prompt for any purpose

---

## Storage

`ai_anonymisation_flags` is a `TEXT[]` array on the `observation` table, written by the enrichment job. It is never displayed in the UI — it is server-side infrastructure only.

Scrubbing happens at the prompt-building layer on the server — the database always retains the original text. Anonymised versions only appear in AI prompt inputs, never in stored records.

---

## Consumed By

| Feature | File | How used |
|---|---|---|
| Observation enrichment | `features/OBSERVATION-CAPTURE.md` | Enrichment prompt flags identifying phrases |
| Critical insight generation | `features/CRITICAL-INSIGHT.md` | Observation summaries are scrubbed before passing |
| Investigation assistance | `features/INVESTIGATION.md` | Incident text scrubbed before AI assistance prompt |
| Enquiry generation | `features/ENQUIRY.md` | Source observations scrubbed before question generation |
| Communities thread | `features/COMMUNITIES.md` | Source narrative scrubbed before thread generation |
| Situational brief | `features/SITUATIONAL-BRIEF.md` | All source content scrubbed |
| Visit briefing | `features/VISIT-BRIEFING.md` | Observation summaries scrubbed |
