# SCOPE.md — Hiviz Prism Platform Scope

**Forge Works · Hiviz Prism** · Version 0.1 — September 2026 · Status: draft for discussion

> Single home for Prism scope decisions. Taxonomies, prompts, and pipeline rules that already exist in `../specs/` are referenced, never copied. See `README.md` for the reuse map.

---

## 1. The product in one paragraph

An organisation connects the safety tools it already uses (incident system, inspection app, construction platform, a SharePoint list). Prism backfills a window of history, then listens for new and changed records. Each record is **refracted**: reshaped into a common source shape and enriched with the Hiviz stack of signal type, energy type and release potential, barrier state, key hazard, FW Map® factor hint, and a rationale for each. Enriched records form an opinionated safety data pool. Scheduled runs and direct-path triggers turn that pool into Critical Insights, periodic intelligence reports, situational briefs, and visit briefings for managers. Where the source tool allows it, the actions Prism suggests are pushed back into that tool.

## 2. Principles specific to Prism

1. **Their system stays the system of record.** Prism never becomes the place a record is created, edited, or closed (manager visit observations are the one exception).
2. **Thin copy, not zero copy.** We store a pointer, a fingerprint, the enrichment, and a scrubbed summary. We do not store the raw record body, attachments, or identifying fields. See §5 and decision D1.
3. **Enrichment is a suggestion with a reason.** Inherited unchanged from `../specs/globals/ai-output-standards.md`.
4. **Five connector patterns, not twenty integrations.** Every source is served by one of the patterns in §4. Vendor work is configuration of a pattern.
5. **Manager-only surfaces.** No crew-facing output. Anything that would have gone to crew in Hiviz goes to a manager as a suggestion instead.
6. **Value on day one.** A backfill is enough to produce a first report before any live data arrives. This is the sales motion (§9).

## 3. Source types

The source type is Prism's first classification, set at schema-mapping time (per source object) and confirmed per record by enrichment. It decides which enrichment variant runs and which pool the record feeds.

| Priority | Source type | Typical names in customer tools | What we read | Feeds |
|---|---|---|---|---|
| P1 | `incident` | Incident, injury, illness, property damage, environmental event | Narrative, severity, classification, date, location, work activity | Incident pool → CriticalIncident; direct path on serious outcomes |
| P1 | `near_miss` | Near miss, near hit, close call, potential incident | Narrative, potential severity | Observation pool; direct path when energy was released |
| P1 | `hazard_observation` | Hazard report, safety observation, issue, BBS card, Take 5 exception | Narrative, category, location, status | Observation pool |
| P1 | `inspection_finding` | Failed or flagged inspection / audit item | Question, response, comment, template, site | Observation pool (failed and flagged items only; passes feed coverage) |
| P1 | `corrective_action` | Action, CAPA, task | Title, source link, due date, status, overdue | Action debt signal, atrophy, insight follow-through |
| P2 | `investigation` | Investigation, RCA, ICAM, TapRooT, 5 Whys | Contributing factors, root cause, actions | `fw_classify` (investigation path), systemic causes |
| P2 | `control_verification` | CCV, critical control check, verification | Control, result, defeating factors | Barrier signal on the relevant control / energy |
| P2 | `permit_to_work` | Permit, PTW, isolation, confined space entry | Work type, permit exceptions, suspensions | Exposure context for high-risk work; permit exceptions to observation pool |
| P2 | `pre_task` | JSA, JHA, SWMS, Take 5, pre-start | Hazards identified, stop-work flags, completion rate | Weak signals; work-understanding context |
| P2 | `leadership_visit` | Safety walk, field leadership visit, gemba | Findings, conversations, frequency | Visit coverage; atrophy baseline |
| P2 | `meeting` | Toolbox talk record, pre-start meeting | Topic, attendance, issues raised | Coverage and activity (not content generation) |
| P3 | `exposure` | Hours worked, headcount, shift roster | Hours by site and period | **Denominators** for rates; without these every trend is a raw count |
| P3 | `plant_defect` | Pre-start defect, work order, CMMS | Defect text, asset class, criticality | Energy and barrier context for plant |
| P3 | `contractor` | Prequalification, induction, contractor company | Company, trade, induction status | Contractor management factor context |
| P3 | `training_expiry` | Competency, ticket, licence | Expiries by role and site | Resource and capability signals |
| P3 | `external_notice` | Regulator notice, improvement notice, client alert | Notice text, issuer | Critical Insight `external_alert` path |

Deliberately out of scope for v1: occupational health and injury-claims data (medical privacy), environmental monitoring streams, telematics and IoT sensor feeds.

## 4. Connector layer

### Five patterns

| Pattern | How it works | Latency | Examples (see `profiler.html`) |
|---|---|---|---|
| **A · Webhook + fetch** | Vendor posts a thin event; Prism fetches the full record by ID. Dedupe on event ID; tolerate out-of-order and repeat delivery | Seconds to minutes | Mitti (SafetyCulture), Procore, Autodesk Construction Cloud |
| **B · Incremental poll** | Scheduled REST pull using a modified-since cursor | 15–60 min | Intelex, HSI Donesafe, HammerTech, Ideagen EHS |
| **C · Scheduled extract** | Vendor exposes a daily extract or lagged API | ~24 h | Evotix Assure (outbound API runs a day behind) |
| **D · Platform table** | Generic platform API over customer-configured tables or lists | Minutes | ServiceNow, SharePoint lists / Microsoft Lists, Dataverse, Google Sheets |
| **E · Drop** | CSV / XLSX upload, SFTP drop, or forwarded notification emails to a Prism inbox | Batch | Any tool, including the ones with no API |

Pattern E is the universal fallback and the fastest path to a pilot. A prospect can send twelve months of CSV exports and get a first report before any integration work starts.

### Onboarding steps for every connection

1. **Authorise.** Read-only scopes wherever the vendor supports them. Write scope only if action push is enabled.
2. **Discover.** List objects, fields, and sample records.
3. **Map schema** (new AI job `connector.map_schema`). Suggests which object is which source type and which field carries the narrative, date, site, severity, and status, with a rationale per mapping. A human confirms. Stored as a versioned `FieldMap`.
4. **Map sites and work.** Customer locations → Hiviz org hierarchy (site → region → division → organisation), and customer categories → work types. AI-suggested, human-confirmed.
5. **Backfill.** Default 12 months, rate-limited, lowest-priority queue.
6. **Go live.** Switch to the pattern's live mode.

## 5. Thin entities

New entities only. Everything downstream (CriticalInsight, CriticalIncident, report, briefs) uses existing Hiviz schemas.

```
SourceConnection
  id, organisation_id
  vendor                  -- mitti | procore | intelex | servicenow | csv | ...
  pattern                 -- webhook_fetch | poll | extract | platform_table | drop
  auth_ref                -- secret-store reference, never the credential
  scopes                  -- read | read_write
  cursor                  -- last modified-since / event position
  backfill_from, backfill_status
  status                  -- connecting | mapping | backfilling | live | degraded | paused

FieldMap                  -- versioned; one per source object
  connection_id, source_object, source_type
  narrative_fields[], occurred_at_field, site_field, severity_field, status_field
  ai_mapping_rationale, confirmed_by, confirmed_at, version

SiteMap / WorkTypeMap     -- customer value → Hiviz worksite_id / work_type_id

SourceRecord              -- the pointer. No raw body.
  id, connection_id, source_object, external_id, external_url
  source_type             -- §3
  worksite_id, work_type_id, occurred_at
  content_hash            -- detects edits that need re-enrichment
  source_status           -- open | closed | deleted (mirrors source)
  scrubbed_summary        -- ≤ 3 sentences, anonymised per anonymisation-rules.md
  legal_hold              -- inherited flag or customer rule; blocks all sharing
  first_seen_at, last_seen_at

SourceEnrichment          -- one current row per SourceRecord, prior versions retained
  source_record_id, enrichment_version, model_id
  -- the observation.enrich output schema, unchanged:
  ai_signal_type (+confidence, rationale), ai_energy_type (+confidence),
  ai_energy_release_potential, ai_barrier_assessment (+confidence, rationale),
  ai_failure_type, ai_key_hazard (+rationale), ai_stop_work_warranted (+rationale),
  ai_fw_factor_hint, ai_anonymisation_flags, enrichment_confidence
  -- Prism additions:
  ai_source_type_confirmed, ai_potential_severity (+rationale),
  ai_duplicate_of_record_id      -- the same event reported in two tools
```

The enrichment output schema is the one defined in `../specs/features/OBSERVATION-CAPTURE.md` Stage 2. Prism adds source-type-specific **user prompt variants** (incident, inspection finding, investigation, control verification) and never forks the system prompt or taxonomies.

## 6. Pipeline

```
Source tool ──► Connector (A–E) ──► Shape (FieldMap, SiteMap) ──► SourceRecord
                                                                     │
                                          source_record.enrich ◄─────┘
                                                                     │
                                  ┌──────────────── pool ◄───────────┤
                                  │                                  │
          scheduled trend runs ◄──┘       direct path (single record)┘
                  │                                  │
                  ▼                                  ▼
       CriticalInsight / CriticalIncident drafts ── manager review ── fw_classify
                  │
                  ├── Periodic report (REPORTING.md)
                  ├── Situational brief
                  ├── Visit briefing ──► manager visit ──► native observations ──► pool
                  └── Action push ──► back into the source tool
```

### Cadence

| Run | When | What it does |
|---|---|---|
| Direct path | On enrichment | `barrier_failure` / `unwanted_energy_event` at ≥ 0.70, or imported incident with serious actual or potential severity → insight draft within minutes |
| Trend detection | Nightly | `SPEC.md` §7.2 / §7.3 over enriched SourceRecords, per org level and work type, rate-based where exposure data exists |
| Systemic roll-up | Weekly | FW capacity profile, blind spots, atrophy per site |
| Manager digest | Weekly | What changed, what needs review, what's overdue |
| Intelligence report | Monthly / quarterly | `REPORTING.md` schedules with Prism modules added |
| Re-enrichment | On edit | `content_hash` change triggers re-enrichment; the prior version is kept |

## 7. In and out

| In (v1) | Out (v1) |
|---|---|
| Connectors (patterns A, B, D, E; C where needed) | Any capture of incidents or hazards by crew |
| Schema, site, and work-type mapping with AI assist | Toolbox talk generation and crew broadcast |
| Source enrichment (all P1 source types) | Enquiry, communities, CoP threads |
| Critical Insight and Critical Incident review | Investigation workflow |
| FW Map® classification and systemic causes | Risk-control register and verification clockwork |
| Periodic reports, situational briefs | Document / procedure ingestion (candidate add-on) |
| Field leadership visits with observation capture | Occupational health data |
| Action push (write-back where supported) with fallback tracker | Offline crew app |

## 8. Decisions to make

These need a call before the build can be sized. Recommendations are the starting position, not the decision.

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Copy boundary.** Zero-copy (fetch text on demand every time) vs thin copy (scrubbed summary stored) | Thin copy. Insight generation and reports need the text repeatedly; refetching creates rate-limit and availability risk. Keep raw bodies out. |
| D2 | **Deletion and edits.** What happens when a source record is deleted or changed | Mirror deletes within 24 h, including removal from open insight evidence. Edits re-enrich and keep version history. |
| D3 | **Legal hold and privilege** on imported investigations | Customer rule per source object (e.g. "all investigations held until closed"). Default to held. |
| D4 | **Duplicate events** across tools (e.g. a near miss in both Procore and the EHS system) | Enrichment suggests `duplicate_of`; trend counts use the de-duplicated set. |
| D5 | **Exposure data.** Require hours worked or accept raw counts | Accept counts at launch, promote rates as soon as any exposure source is connected. Label every chart with which one it is. |
| D6 | **Action push scope** | Write-back only to tools with a documented create-action endpoint. Otherwise a Hiviz tracker with a link to the source record. |
| D7 | **Pricing unit** | Per organisation platform fee plus a band per connected site count. Avoid per-record pricing; it punishes good reporting cultures. |
| D8 | **AI cost per record** | Model the backfill (12 months × records) separately from live run-rate. Batch the backfill. |
| D9 | **Data residency and security** | AU and US regions at launch. Secrets in a managed store, read-only scopes, per-tenant encryption. Start SOC 2 Type I. |
| D10 | **Vendor relationships** | List on Mitti, Procore, and Autodesk marketplaces. Treat enterprise EHS vendors as channel partners, not targets. |

## 9. Commercial shape

- **First light (pilot).** Customer provides 12 months of exports (pattern E). Prism returns a retrospective intelligence report within two weeks: top patterns, FW blind spots, sites going quiet. Fixed fee, credited against subscription.
- **Subscription.** Live connectors, nightly runs, monthly reports, visit briefings, action push.
- **Add-ons.** Procedure ingestion (requirement-gap detection), extra connectors beyond the included count, consulting-led insight review (where remaining consulting capacity is used).

## 10. Competitive watch

Several incumbents are adding their own AI. Mitti (formerly SafetyCulture) launched background AI agents with its August 2026 rebrand, and Benchmark Gensuite markets AI incident classification. Prism's defence is that it works across tools and is opinionated. It reads every system the customer runs, not one vendor's data, and it classifies against the FW Map® and the Hiviz barrier and energy model rather than generic categories.

## 11. What to spec next

1. `prism/specs/CONNECTORS.md`: pattern contracts, retry and dedupe rules, rate-limit budgets
2. `prism/specs/SCHEMA-MAPPING.md`: `connector.map_schema` prompt, FieldMap versioning, confirmation UI
3. `prism/specs/SOURCE-ENRICHMENT.md`: user prompt variants per source type (system prompt stays in `OBSERVATION-CAPTURE.md`)
4. `prism/specs/ACTION-PUSH.md`: write-back contract per vendor, fallback tracker
5. Report modules for source coverage and data quality in `REPORTING.md` (extend, don't fork)
6. A Prism sim (`simulators/prism-sim.html`): paste a CSV and see records refracted and a first insight drafted
