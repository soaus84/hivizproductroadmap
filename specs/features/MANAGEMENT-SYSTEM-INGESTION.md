# MANAGEMENT-SYSTEM-INGESTION.md — Management System Ingestion Feature Spec

**Forge Works · Hiviz SafetyPlatform — Feature Spec**
Version: 1.0 — May 2026 (V6 feature)

> **This is the canonical source for the document ingestion prompt and pipeline logic.** `simulators/ms-sim.html` loads its prompt from this file. Previously, the prompt existed only as a hardcoded constant in the sim — this file resolves that. If prompt text elsewhere conflicts, this file wins.

---

## What This Feature Is

The Management System workspace allows organisations to upload safety documents — procedures, SWMS, standards, PTW frameworks — and have the platform extract structured `DocumentRequirement` records from them. Once ingested, these requirements become queryable context for every AI call in the platform. An observation about a hot work task gains procedure-specific gap detection. An investigation retrieves the documents that applied at the incident date. Talk generation can reference specific clauses.

The feature is V6 and ships in three phases. This spec covers the AI ingestion job (Phase 3 capability, but the job pattern and prompt are the foundation for all phases).

```
Stage 1 — Document upload and serving      (synchronous, no AI — non-blocking)
Stage 2 — Ingestion job                    document.ingest    (async AI)
Stage 3 — Requirement serving to consumers (query-time, no AI — other features inject context)
```

---

## Global References Used

Document ingestion operates on raw document text and emits a new taxonomy (DocumentRequirement records) — it does not classify against signal, energy, barrier, or FW Map® taxonomies.

| Global | File | Used for | Injection level |
|---|---|---|---|
| AI output standards | `globals/ai-output-standards.md` | JSON-only, token limits, audit logging, retry policy | Spec-only |

No taxonomy globals — the ingestion prompt works from raw document text. The extracted requirements become the taxonomy for downstream prompts.

---

## Sim Reference

- `simulators/ms-sim.html` — live AI sim. Loads the ingestion prompt from Stage 2 of this file. The sim supports both exemplar documents (predefined test cases) and real file uploads (PDF or text). This is the only sim in the project that processes user-uploaded files through the Anthropic API directly in the browser.

**Sim loader pattern:**
```javascript
const systemPrompt = await fetch('/specs/features/MANAGEMENT-SYSTEM-INGESTION.md')
  .then(r => r.text())
  .then(md => extractSection(md, 'CANONICAL-SYSTEM-PROMPT-STAGE-2'))
```

---

## Document Types

```
Procedure                 — step-by-step operational process
Safe Work Method Statement (SWMS) — task-specific hazard and control record
Standard                  — performance or design standard
Regulatory Requirement    — extracted from legislation or codes of practice
Site Rule                 — site-specific operational requirement
Technical Specification   — equipment or materials specification
```

Document type is declared by the uploader and confirmed by the ingestion job.

---

## Stage 1 — Document Upload and Serving

**No AI call.** Synchronous. Document is available immediately — ingestion is non-blocking.

### Upload flow

1. Safety manager uploads PDF or authors content inline in the management system library
2. Document record created with `ai_ingested = false`
3. `WorksiteDocument` records pushed to applicable sites (same push/inherit/override model as critical controls in V5 Risk workspace)
4. Document immediately available for serving — supervisors can access the current version before ingestion completes
5. `document.ingest` BullMQ job queued

### Document entity (key fields)

```sql
-- From v6-discovery.html data model
Document {
  id                  UUID
  organisation_id     UUID
  code                String        -- e.g. "HW-PTW-001"
  title               String
  document_type       String        -- procedure | swms | standard | regulatory | site_rule | technical_spec
  work_type_id        UUID          -- primary work type this document applies to
  work_type_ids       UUID[]        -- all work types (multi-select)
  scope               String        -- global | regional | site
  ai_ingested         Boolean       -- false until ingestion completes
  ai_summary          String?       -- extracted by ingestion job
  current_version_id  UUID
  review_date         Date
}

DocumentVersion {
  id                  UUID
  document_id         UUID
  version_number      String
  content_url         String        -- S3/R2 path
  published_at        DateTime
  change_summary      String?
}

DocumentRequirement {
  id                  UUID
  document_id         UUID
  version_id          UUID          -- linked to version, not document — enables point-in-time queries
  requirement_text    String        -- rewritten in plain language for field use
  obligation          String        -- shall | must | should | may
  clause_reference    String?       -- e.g. "3.1", "Clause 4.1.1"
  condition           String?       -- when this requirement applies; null if always
  verification_signal String?       -- one concrete, observable field evidence item
  discussion_prompt   String?       -- toolbox talk question; null if not suitable
  requirement_type    String        -- mirrors obligation — for query convenience
  linked_control_id   UUID?         -- if this requirement maps to a critical control (V5 link)
}

WorksiteDocument {
  document_id         UUID
  worksite_id         UUID
  status              String        -- accepted | locally_modified | locally_added | inapplicable | pending_review
  active_version_id   UUID          -- may differ from global current version
  local_override_notes String?
  last_acknowledged_at DateTime?
}
```

---

## Stage 2 — Ingestion Job

**Job:** `document.ingest`
**Triggered:** After document upload, queued in BullMQ — same queue infrastructure as `observation.enrich`
**Input:** Document title, type, optional summary, and raw content text
**Output:** Array of `DocumentRequirement` records stored in database
**Human gate:** None at extraction — safety manager reviews extracted requirements in the library UI and can flag, correct, or remove individual requirements
**Max tokens:** 2000 — documents can be long and requirement lists need to be comprehensive
**Content limit:** Document text is truncated at 8,000 characters before sending — for longer documents, the most safety-critical content is typically in the first portion. V2: chunked ingestion for long documents.

### CANONICAL-SYSTEM-PROMPT-STAGE-2

```
You are an AI document ingestion engine for a safety management platform. Your job
is to read safety documents and extract structured requirements.

For each distinct requirement, control, or obligation in the document, extract:
- requirement_text: the requirement rewritten in clear, plain language (not quoted
  verbatim — simplified for field use)
- obligation: "shall" | "must" | "should" | "may" (extract from the original language)
- clause_reference: the section or clause number if present, otherwise infer a logical
  reference based on document structure
- condition: when this requirement applies (e.g. "Before ignition", "During descent",
  "When conditions change") — null if always applicable
- verification_signal: what field evidence would confirm this requirement is met —
  one concrete, observable thing a supervisor could check
- discussion_prompt: one open question a supervisor could ask their crew about this
  requirement during a toolbox talk — or null if not suitable for discussion

Return ONLY a valid JSON array of requirement objects. No preamble, no markdown.
Return at minimum 4 and maximum 12 requirements — select the most safety-critical ones.
Requirements must be independently meaningful — not sub-steps of the same requirement.
```

### User Prompt Template

```
Document: "{{document_title}}"
Type: {{document_type}}
{{#if document_summary}}Summary: {{document_summary}}
{{/if}}
Content:
{{document_content_truncated_8000_chars}}

Extract the key safety requirements from this document as a JSON array:
[
  {
    "requirement_text": "Plain language requirement — rewritten for field use, not verbatim",
    "obligation": "shall|must|should|may",
    "clause_reference": "3.1",
    "condition": "Before work commences|null",
    "verification_signal": "One concrete, observable thing confirming this requirement is met",
    "discussion_prompt": "Question a supervisor could ask their crew during a toolbox talk|null"
  }
]
```

### Validation Rules

- 4–12 requirements — enforced on storage. If fewer than 4 can be extracted, log a warning and store what exists; do not block
- `obligation` must be one of `shall | must | should | may`
- `requirement_text` must be non-empty and must not be a verbatim quote from the source document — the extraction should rewrite for field clarity
- `verification_signal` must describe a single, concrete, observable thing — not a general statement like "ensure compliance"
- `clause_reference` must be a string — if no clause number exists in the document, the AI should infer a logical reference like "Section 3" or "Introduction"
- `discussion_prompt` is null when the requirement is purely technical or administrative (e.g. record-keeping obligations)
- Requirements must be independently meaningful — a requirement that only makes sense in context of another requirement should be merged or excluded

### Storage

```sql
-- On completion, update the document record
document.ai_ingested = true
document.ai_summary = "AI-extracted summary of the document's purpose and scope"

-- Create DocumentRequirement records (one per extracted requirement)
-- All linked to the current version_id for point-in-time query support
INSERT INTO document_requirement (
  document_id, version_id, requirement_text, obligation,
  clause_reference, condition, verification_signal,
  discussion_prompt, requirement_type
) VALUES (...)
```

### Retry behaviour

On parse failure: retry once with a simplified prompt requesting only `requirement_text` and `obligation` (minimum viable extraction). On second failure: set `ai_ingested = false`, log error, alert safety manager. The document remains usable — just without extracted requirements.

---

## Stage 3 — Requirement Serving to Consumers

**No AI call.** Requirements are injected as context into other AI jobs at query time.

### How downstream AI prompts consume requirements

When a downstream AI job runs for a given `work_type_id`, the server queries applicable `DocumentRequirement` records and injects them into the user prompt:

```
Applicable procedure requirements for this work type (from DocumentRequirement):
{{#each applicable_requirements}}
[{{this.obligation.toUpperCase()}}] {{this.clause_reference}}: {{this.requirement_text}}
{{#if this.condition}}Applies when: {{this.condition}}{{/if}}
{{/each}}
```

### Consumers by feature

| Consumer | How requirements are used |
|---|---|
| `observation.enrich` (V6) | Injected as context — enrichment can detect gap between observation and applicable requirements; `barrier_assessment` gains procedure-grounded precision |
| `investigation.assist` (V6) | Documents active at the incident date retrieved by `version_id` and `work_type_id`; requirements injected as contributing factor candidates |
| `toolbox_talk.generate` (V6) | `discussion_prompt` fields from mandatory requirements available as additional discussion question candidates |
| `critical_insight.generate` (V6) | Pattern summary can reference specific requirement gaps if present |
| `enquiry.generate_questions` (V6) | Requirement gaps can generate targeted Assurance Check questions |

### Point-in-time query pattern

For investigations, the applicable document version at the incident date is retrieved by:

```sql
SELECT dr.*
FROM document_requirement dr
JOIN document_version dv ON dr.version_id = dv.id
WHERE dv.document_id IN (
  SELECT document_id FROM worksite_document
  WHERE worksite_id = [incident.worksite_id]
)
AND dv.published_at <= [incident.occurred_at]
AND dv.id = (
  SELECT id FROM document_version
  WHERE document_id = dv.document_id
  AND published_at <= [incident.occurred_at]
  ORDER BY published_at DESC
  LIMIT 1
)
AND dr.work_type_id = [incident.work_type_id]
```

This ensures investigations always see the requirements that were active at the time of the incident — not the current version.

---

## Document Ingestion Pipeline — Visual Reference

```
01 Document uploaded
   └─ PDF or authored content stored
   └─ document.ai_ingested = false
   └─ WorksiteDocument records pushed to sites
   └─ Document immediately available for serving

02 Ingestion queued
   └─ document.ingest BullMQ job created
   └─ Same queue infrastructure as observation.enrich
   └─ Non-blocking — document usable before ingestion

03 AI extraction (Stage 2 above)
   └─ AI reads document, extracts requirements
   └─ Returns JSON array of DocumentRequirement objects

04 Requirements stored
   └─ DocumentRequirement records created
   └─ Linked to version_id for point-in-time queries
   └─ document.ai_ingested = true

05 Knowledge available
   └─ All AI prompts can query requirements for this work type
   └─ Observation enrichment, investigation assist,
      talk generation, insight generation all benefit
```

---

## Document Review Workflow (Phase 2)

Phase 2 introduces an enquiry-based document review loop. When a document approaches its `review_date`, an enquiry is dispatched to supervisors asking whether the procedure reflects current practice. This uses the standard enquiry infrastructure (`trigger_source = document_review` — a Phase 2 addition to the enquiry trigger source enum).

The review enquiry questions are generated from the document's own `discussion_prompt` fields — closing a loop between ingestion and review.

---

## V2/V3 Cascade Notes

**Chunked ingestion for long documents (V2)**
In V1, document content is truncated at 8,000 characters. V2: split long documents into overlapping chunks, run ingestion on each, deduplicate requirements across chunks by clause reference similarity. The `document.ingest` job gains a multi-pass mode flag.

**Procedure gap detection in observation enrichment (V6 — wired in this version)**
When the MS workspace is active, `observation.enrich` receives applicable `DocumentRequirement` records as additional context. The enrichment output gains an `ai_requirement_gap_hint` field pointing to the most likely requirement being violated. This field is stored but not yet surfaced in V1 UI — V2 surfaces it as a badge in the observation detail view.

**Investigation document retrieval (V6 — wired in this version)**
`investigation.assist` retrieves documents using the point-in-time query pattern above. The contributing factor suggestions gain procedure-grounded specificity: instead of "PTW process not followed", the AI can say "Section 3.2 of HW-PTW-001 requires confirmation of fire watch position — this was not evidenced."

**Control linkage (V5 + V6 compound)**
`DocumentRequirement.linked_control_id` exists in the schema from V6 but is only populated when V5 Risk workspace is also active. When both are enabled, requirements can be linked to specific critical controls — creating a traceable chain from procedure clause to field control to observation to insight.

---

*Last updated: May 2026. Update this file when: prompt text changes; output schema changes; content truncation limit changes; downstream consumer list changes. After updating, verify ms-sim.html loads the updated system prompt correctly and that exemplar document test cases still produce valid extraction results.*
