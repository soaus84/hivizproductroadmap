# MANAGEMENT-SYSTEM.md — Management System Workspace Spec

**Code ID:** `workspace.ms`
**Status:** Activation decision
**Version:** 1.0 — May 2026

> The organisation's safety documents — procedures, SWMSs, standards, legislative requirements — brought live into the AI layer. When active, every AI job that processes a field event can ask: "Is there a procedure, standard, or requirement that applies here?"

---

## Standalone value

In most organisations, safety procedures live in a SharePoint folder nobody opens. They're written once, reviewed annually if lucky, and have no connection to what supervisors actually do in the field.

The Management System workspace changes that relationship. Documents are uploaded once and ingested by AI. The platform now knows what every procedure requires — clause by clause. From that point, every observation capture, every investigation, every insight generation can ask: does what happened match what the procedure says should happen?

**How it could be sold as Phase 1 (no AI yet):** "Upload your procedures and SWMSs. The right document appears on a supervisor's phone before they start high-risk work. No searching, no SharePoint. The procedure comes to them." Document delivery alone, before ingestion, has value.

**Phase 2:** Documents surface contextually at the moment they're relevant — in a visit briefing, in an investigation, in an insight. The platform retrieves by work type and date, so an investigation always gets the version that was in force on the day.

**Phase 3 (compound):** AI ingestion runs against all documents. Now the platform knows what the procedures require. Observation enrichment detects gaps between observed practice and documented standard. Investigation assistance suggests which specific clause the contributing factor relates to. This is where the full value lands.

**Dependency:** Requires `workspace.core` (Insight). Enriches every other workspace — the knowledge layer sits under everything.

---

## What activating this workspace turns on

- Document upload and version control — the organisation maintains the source of truth in Hiviz
- Work type mapping — documents linked to the work types they govern
- Push/accept model for documents — same governance as controls: global → worksite active document set
- Supervisor document access — before high-risk work starts, the relevant procedure appears on their phone (AI-summarised key points + full document on tap)
- Document ingestion and requirement extraction — AI reads each document and extracts structured requirements with clause references, obligation levels, conditions, and verification signals
- Requirement serving — at query time, relevant requirements are injected into AI job context
- Procedure-gap detection in observation enrichment — AI flags when observed practice diverges from a documented requirement
- Procedure-specific contributing factor suggestions in investigation assistance
- Applicable document context in insight generation and enquiry question generation
- Version-controlled retrieval — investigations retrieve the exact document version active on the incident date
- Document review workflow — enquiry-based; when a procedure is due for review or a field signal suggests it's out of date, an enquiry is triggered

---

## Feature inventory

| Feature | User role(s) | Spec authority | State |
|---|---|---|---|
| Document upload and version control | Safety manager / document controller | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 1 | working (Live Sim) |
| Work type mapping | Safety manager | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 1 | working (Live Sim) |
| Document push to worksites | Safety manager | `features/MANAGEMENT-SYSTEM-INGESTION.md` §Push model | spec-only |
| Worksite document acceptance | Worksite manager | `features/MANAGEMENT-SYSTEM-INGESTION.md` §Push model | spec-only |
| AI document ingestion (`document.ingest`) | System (async) | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 2 | working (Live Sim) |
| Requirement extraction and storage | System | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 2 | working (Live Sim) |
| Requirement serving at query time | System | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 3 | spec-only |
| Procedure-gap detection in observation enrichment | System | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 3 | spec-only |
| Procedure-specific investigation context | System | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 3 | spec-only |
| Supervisor document access — AI key points | Supervisor | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 3 | spec-only |
| Version-controlled retrieval for investigations | System | `features/MANAGEMENT-SYSTEM-INGESTION.md` §Version control | spec-only |
| Document review workflow (enquiry-based) | Safety manager | `features/MANAGEMENT-SYSTEM-INGESTION.md` Stage 3 | spec-only |
| Control → requirement clause linkage | Safety manager / system | `features/RISK-CONTROLS.md` §3.1 + `features/MANAGEMENT-SYSTEM-INGESTION.md` | spec-only |

---

## UX surfaces

| View | Role(s) | Access path | Purpose | Design state |
|---|---|---|---|---|
| Document library | Safety manager | Management System tab | All documents by type and work type; version history; ingestion status; review due indicators | to design |
| Document upload | Safety manager | Library → upload | Upload PDF or author in platform; set type, work type mapping, effective date | to design |
| Document detail + requirements | Safety manager | Tap document | Extracted requirements list with clause references; confidence ratings; link to controls; version history | to design |
| Worksite document set | Worksite manager | Site controls → documents | Active documents for this site by work type; pending acceptance; locally modified | to design |
| Supervisor document access | Supervisor | Before work start / from verification checklist | AI-summarised key points for this work type; full document one tap away | to design |
| Document review workflow | Safety manager | From alert or review due indicator | Enquiry triggered to ask if procedure reflects current practice; responses and summary | to design (uses enquiry UX) |
| Management System layer — worksite dashboard | Safety manager | Site dashboard | Document coverage for active work types; review status; ingestion ratio | to design |

---

## Capability gates

No standalone capability gates. The MS workspace is itself a gate, and its effect is horizontal — it enriches every other AI job when active.

---

## Workspace connections

**Built on:** `workspace.core` (Insight) — required.

**Enriches (when active, flows into):**
- `workspace.core` — observation enrichment gains procedure-gap detection
- `workspace.incident` — investigation assistance gains applicable document context and version-controlled retrieval
- `workspace.risk` — controls can be linked to specific requirement clauses
- `workspace.analytics` — document coverage appears as a layer on the worksite dashboard; document atrophy signals
- `workspace.communities` — document atrophy discussions seeded when procedure hasn't been updated but field signals suggest it's out of date

**Produces for downstream:**
- `DocumentRequirement` records — queryable by any AI job at runtime
- Procedure-gap signals in enriched observations → `workspace.core` insight pool

---

## V2 Notes

**In-platform authoring** — Phase 1 is upload-only. V2: rich text editor for procedure authoring, making Hiviz the system of record rather than a document store.

**Requirement confidence gating** — V2: requirements below 0.70 extraction confidence flagged for human review before serving to AI jobs. MVP serves all extracted requirements.

**Document atrophy score** — separate from worksite atrophy; tracks how stale the document set is (last reviewed, field access frequency, open review enquiries). Not specced.

**Control → requirement seeding** — when both `workspace.ms` and `workspace.risk` are active, AI can propose critical controls from extracted requirements. V2 compound intelligence.

*Wireframes exist for: document ingestion flow (simulator: `simulators/management-system.html`). All UX views are to design.*
