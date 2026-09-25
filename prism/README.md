# Hiviz Prism

**Codename:** Prism · **Status:** Concept / scoping — September 2026 · **Parent:** Hiviz SafetyPlatform

> Prism is the Hiviz intelligence layer sold on its own. It plugs into the safety tools an organisation already runs, enriches their records with the Hiviz classification stack, and surfaces manager-level insight. It does not replace capture, workflow, or the system of record.

The Chromecast promise: the TV stays. We make it smart.

---

## Why Prism exists

- Consulting revenue is shrinking as AI absorbs advisory work. Forge Works needs a product that sells without a transformation programme attached.
- Full Hiviz competes with incumbent EHS platforms on capture, workflow, and embedded change management. That is a long, expensive sale.
- Prism competes with nobody's system of record. It sits beside the incumbent, reads what is already there, and gives managers the part those tools do badly: an opinionated read of what the data means.

## Who it is for

Managers only: safety managers, operations managers, regional and divisional leaders. No crew-facing surfaces. The one field surface we keep is the manager's own **field leadership visit** with observation capture, because it maps directly to how managers already work.

---

## Folder map

| File | What it is |
|---|---|
| `README.md` | This file — thesis, reuse map, and how Prism references the Hiviz specs |
| `SCOPE.md` | Scope spec: source types, connector layer, thin entities, pipeline, cadence, in/out, open decisions |
| `index.html` | Internal pitch page — the idea in one read |
| `scope.html` | Visual platform scope — data flow, source catalogue, entity model, reuse map |
| `profiler.html` | Product-in profiler — common safety platforms, their API shape, and the connector pattern each needs |
| _(styles)_ | Each page carries its own copy of the shared Prism styles so it renders on its own, including in the preview pane and as a published artifact. Change the token block in all three together |

The profiler page is the single home for vendor API data. `SCOPE.md` is the single home for Prism scope decisions. Neither copies Hiviz spec content.

---

## How Prism references the Hiviz specs

Prism follows the same DRY rule as the parent project (see `../specs/HOW-TO-READ-THIS.md`). **If a taxonomy, prompt, or rule already exists in `../specs/`, Prism points to it and does not copy it.** Prism specs only define what is new (connectors, source records, schema mapping, source-type-specific enrichment variants) or what is deliberately changed.

### Kept as-is (referenced directly)

| Hiviz spec | Role in Prism |
|---|---|
| [`globals/signal-type-taxonomy.md`](../specs/globals/signal-type-taxonomy.md) | Signal type on every enriched source record |
| [`globals/energy-type-taxonomy.md`](../specs/globals/energy-type-taxonomy.md) | Energy type and release potential |
| [`globals/barrier-assessment-values.md`](../specs/globals/barrier-assessment-values.md) | Barrier state |
| [`globals/fw-map-blueprint.md`](../specs/globals/fw-map-blueprint.md) | FW Map® factor hints and classification |
| [`globals/fw-classify-job.md`](../specs/globals/fw-classify-job.md) | Classification of insights and imported investigations |
| [`globals/ai-output-standards.md`](../specs/globals/ai-output-standards.md) | Rationale-per-suggestion, suggestion language, JSON-only |
| [`globals/anonymisation-rules.md`](../specs/globals/anonymisation-rules.md) | PII scrub before anything leaves the enrichment job |
| [`features/CRITICAL-INSIGHT.md`](../specs/features/CRITICAL-INSIGHT.md) | Primary output. Trigger sources extended, pipeline unchanged |
| [`features/REPORTING.md`](../specs/features/REPORTING.md) | Periodic intelligence reports. New modules for source coverage |
| [`features/SITUATIONAL-BRIEF.md`](../specs/features/SITUATIONAL-BRIEF.md) | Manager-facing brief |
| [`features/VISIT-BRIEFING.md`](../specs/features/VISIT-BRIEFING.md) | Field leadership visit prep |
| [`features/SYSTEMIC-CAUSES.md`](../specs/features/SYSTEMIC-CAUSES.md) | FW capacity profile, blind spots, atrophy (rebased on imported activity) |
| [`features/OBSERVATION-CAPTURE.md`](../specs/features/OBSERVATION-CAPTURE.md) | Manager observations during visits; Stage 2 enrichment is the template for all source enrichment |

### Adapted

| Hiviz spec | Change in Prism |
|---|---|
| [`features/CRITICAL-INCIDENT.md`](../specs/features/CRITICAL-INCIDENT.md) | Incident pool is fed by imported incidents. No Hiviz triage conversation |
| [`features/CORRECTIVE-ACTIONS.md`](../specs/features/CORRECTIVE-ACTIONS.md) | Becomes **action push**: actions are written back into the customer's own tool where its API allows, with a Hiviz-side tracker as fallback |
| [`features/INVESTIGATION.md`](../specs/features/INVESTIGATION.md) | Read-only. Imported investigations are FW-classified; no investigation workflow |
| [`features/MANAGEMENT-SYSTEM-INGESTION.md`](../specs/features/MANAGEMENT-SYSTEM-INGESTION.md) | Optional later add-on: upload procedures to get requirement-gap detection |
| [`SPEC.md` §7.2–7.3](../specs/SPEC.md) | Trend detection counts enriched source records, not only native observations |

### Dropped for Prism

Toolbox talks, crew broadcast, enquiry, communities / CoP threads, the risk-control register and verification clockwork (we *read* control verification data instead), incident capture conversations, and offline crew capture.

---

## Working rules

- Same as the parent repo: never commit or push without explicit instruction (`../CLAUDE.md`).
- New Prism feature specs go in `prism/specs/` when they are written, following the parent's tier structure.
