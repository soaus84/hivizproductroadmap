# signal-type-taxonomy.md — Signal Type Taxonomy

**Forge Works · Hiviz SafetyPlatform — Global Reference**
Version: 1.0

> **Scope:** Authoritative definitions for the `signal_type` field used in observations. Referenced by feature specs — definitions are not copied into feature files, they point here.

---

## Overview

`signal_type` is the primary routing field on an observation. It is AI-determined by the `observation.enrich` job from the free-text observation content and work type context. It determines whether an observation accumulates in the pool for trend detection or routes directly to the intelligence pipeline.

**Confidence threshold for routing decisions:** `signal_type_confidence >= 0.70`

**`emerging_pattern` is system-generated** by the trend detection algorithm — it is never assigned by the enrichment prompt. Do not include it in enrichment output.

---

## SUMMARY-REFERENCE — signal-type-taxonomy

> **Runtime injection block.** Extracted by `extractSection(md, 'SUMMARY-REFERENCE — signal-type-taxonomy')` and injected into prompts that classify `signal_type` independently from raw observation text. One line per value — enough to disambiguate at classification time without copying the full definition. Do not edit this section without re-checking the full definitions below.

```
Classify signal_type as one of:
- positive_performance: safe behaviour or effective control observed beyond mere compliance; no hazard present and nothing to correct
- weak_signal: indirect or contextual indicator of drift — uncertainty, fatigue, unclear communication — no specific control gap yet; valuable only in aggregation
- at_risk_condition: a specific physical condition or behaviour that increases the probability of harm; the control has not failed yet but conditions are deteriorating or below standard
- unwanted_energy_event: uncontrolled release of energy occurred or nearly occurred (dropped object, vehicle roll, hydraulic spray); classify here when energy was actually released, even if no harm resulted
- barrier_failure: a required control was absent, bypassed, or failed to function at the moment of the event; classify on the state of the control, not the outcome
```

Disambiguation rules:
- `weak_signal` is early drift, not just "something minor" — if a specific control gap is described, use `at_risk_condition`
- `at_risk_condition` is an active hazard with no energy release event
- `barrier_failure` is about the state of the control, not the outcome — pair with `barrier_assessment` for the full picture
- `unwanted_energy_event` is about actual or near energy release — if both the barrier failed and energy was released, classify as `unwanted_energy_event`

---

## The 5 Signal Types

### `barrier_failure`
**Routing:** Pipeline direct — one event is sufficient, no threshold required.
**Severity:** High.

A required control was absent, bypassed, or failed to function. The system that should have prevented harm broke down in practice.

**Classification guidance:** Use when the observation explicitly describes a control not being in place or failing at the moment of the event. The supervisor must be describing a failure of a specific, expected control — not a general concern.

**Examples:**
- Excavator reversed without a confirmed spotter in position
- Lockout tag removed before electrical isolation was confirmed
- Guard removed from conveyor during operation
- Permit to Work signed without the required pre-task physical hazard check

**Pipeline effect:** On `observation.enrich` completion, if `signal_type_confidence >= 0.70`: queues `critical_insight.generate` with `trigger_source = critical_observation`, passing the single enriched observation record as input. Does not wait for trend threshold. Does not require accumulation.

---

### `unwanted_energy_event`
**Routing:** Pipeline direct — one event is sufficient, no threshold required.
**Severity:** High.

Uncontrolled release of energy that had the potential to cause harm. The barrier may have held — no injury may have occurred — but the energy was released in an unintended way.

**Classification guidance:** Distinguish from `barrier_failure` by the presence of an actual energy release. If the barrier failed *and* energy was released, classify as `unwanted_energy_event`. If only the barrier failed with no release, classify as `barrier_failure`.

**Examples:**
- Dropped object from height — no injury but landed in the work area
- Truck rolled before brakes fully engaged
- Hydraulic line sprayed fluid under pressure
- Uncontrolled load swing during crane lift

**Pipeline effect:** Same as `barrier_failure` — queues `critical_insight.generate` with `trigger_source = critical_observation` on `signal_type_confidence >= 0.70`. Single event, no accumulation required.

---

### `at_risk_condition`
**Routing:** Pool → trend detection. Accumulates toward threshold.
**Severity:** Elevated.

A physical condition or behaviour that increases the probability of harm. The barrier has not failed yet but conditions are deteriorating or not meeting the required standard.

**Classification guidance:** Use when the supervisor is describing something that *could* lead to a barrier failure if not corrected. The condition exists now — it is not hypothetical. Distinguish from `weak_signal` by the specificity and directness of the condition described.

**Examples:**
- Berm height below standard on haul road
- Operator systematically skipping steps in the pre-start check
- Permit signed before physical hazard conditions were checked
- PPE not worn for the required work type

---

### `weak_signal`
**Routing:** Pool → trend detection. Accumulates toward threshold.
**Severity:** Low to moderate.

An observation that hints at a systemic issue but does not constitute a specific condition or event on its own. Valuable in aggregation — a pattern of weak signals across a site is meaningful even if each one individually is not urgent.

**Classification guidance:** Use when the observation is indirect, contextual, or behavioural in a way that doesn't clearly point to a specific control gap. If in doubt between `weak_signal` and `at_risk_condition`, use `at_risk_condition` — it is the safer routing choice.

**Examples:**
- Supervisor seemed uncertain about the applicable procedure
- Crew appeared fatigued at shift start but no specific behaviour noted
- Communication between operators was unclear but no incident occurred
- General sense that the pace of work is pushing against safe practice

---

### `positive_performance`
**Routing:** Pool → analytics. Feeds Resilient maturity signal.
**Severity:** N/A — positive indicator.

Observed behaviour or condition that demonstrates safety practice being done well. Reinforces what good looks like. Can surface in toolbox talks as positive reinforcement content. Contributes to the Resilient maturity signal in the FW Map® capacity profile.

**Classification guidance:** Use when the supervisor is explicitly noting something done correctly, proactively, or beyond the minimum requirement. Do not use for mere compliance — use for observed excellence or discretionary safe behaviour.

**Examples:**
- Crew voluntarily waited for a replacement spotter rather than proceeding
- Supervisor identified a berm issue during a routine check and actioned it before work started
- Operator called a stop and re-briefed the crew when conditions changed mid-task
- Pre-task checklist completed thoroughly with crew participation

---

## Pipeline Routing Summary

| Signal type | Routing | Threshold | Notes |
|---|---|---|---|
| `barrier_failure` | Pipeline direct | Single event | Queues `critical_insight.generate` (`trigger_source = critical_observation`) if confidence ≥ 0.70 |
| `unwanted_energy_event` | Pipeline direct | Single event | Queues `critical_insight.generate` (`trigger_source = critical_observation`) if confidence ≥ 0.70 |
| `at_risk_condition` | Pool | Trend algorithm | Accumulates by work_type × org_level × time_window |
| `weak_signal` | Pool | Trend algorithm | Same accumulation — lower weight |
| `positive_performance` | Analytics | N/A | Never routes to pipeline |
| `emerging_pattern` | System-generated | N/A | Never assigned by enrichment — algorithm only |

---

## Consumed By

| Feature | File | How used |
|---|---|---|
| Observation capture conversation | `features/OBSERVATION-CAPTURE.md` | `signal_type` field in capture summary |
| Observation enrichment | `features/OBSERVATION-CAPTURE.md` | Primary classification field |
| Trend detection algorithm | `SPEC.md` §7.2 | Accumulation and threshold logic |
| Toolbox talk content selection | `features/TOOLBOX-TALK.md` | Source signal weighting |
| Auto triage | `features/INCIDENT-CAPTURE.md` | Routing disambiguation |
