# barrier-assessment-values.md — Barrier Assessment Values

**Forge Works · Hiviz SafetyPlatform — Global Reference**
Version: 1.0

> **Scope:** Authoritative definitions for the `barrier_assessment` field used in observations and enrichment. Referenced by feature specs — not copied into them.

---

## Overview

`barrier_assessment` describes the state of the safety barrier or control relevant to the observation at the time it was made. It is one of the most diagnostically useful fields in the platform — it tells the intelligence pipeline not just *that* a problem was observed, but *how far the control has degraded*.

The field is assigned by both the capture conversation (as part of the summary JSON) and the enrichment job (with an independent confidence value). Both assignments are stored and compared — divergence is meaningful.

**Confidence threshold:** `barrier_confidence >= 0.70` for reliable classification. Store at any confidence; only act on high-confidence values for pipeline routing decisions.

**Rule:** Assign the barrier state that most accurately describes the control relevant to the hazard in this observation. If the observation does not describe a specific control or barrier situation, use `none`.

---

## SUMMARY-REFERENCE — barrier-assessment-values

> **Runtime injection block.** Extracted by `extractSection(md, 'SUMMARY-REFERENCE — barrier-assessment-values')` and injected into prompts that classify `barrier_assessment` independently from raw text. One line per value — enough to disambiguate the state of the control. Do not edit without re-checking the full definitions below.

```
Classify barrier_assessment as one of:
- barrier_absent: the required control was never established — no procedure, no guard, no permit requirement, no supervision model exists; structural absence, not situational
- barrier_failed: the control existed and should have applied but did not function when required — present but ineffective at the moment of the event
- barrier_degraded: the control exists and is partially functioning but operating below the required standard — drifting, inconsistent, or sub-standard application
- barrier_held: the control was tested under genuine pressure and worked as designed; harm was prevented (do not use for routine compliance — use when the barrier was stressed)
- none: no specific barrier or control is relevant to this observation, or barrier state cannot be assessed from what was described
```

Disambiguation rules:
- Distinguish `barrier_absent` from `barrier_failed` by whether the control existed at all — absent is structural, failed is execution
- `barrier_degraded` is the most common state on well-managed sites — supervisors catching drift before it becomes a failure
- `barrier_held` requires the control to have been genuinely stressed — not mere compliance with normal conditions
- Do not use `none` as a default — only when barrier state genuinely cannot be assessed

---

## The 5 Barrier States

### `barrier_absent`
**Severity:** Critical — pipeline direct trigger in combination with `barrier_failure` signal type.

The required control does not exist at all. There is no procedure, no physical guard, no permit requirement, no supervision model — the hazard has no control in place. This is not a failure of an existing control; the control was never established.

**Classification guidance:** Use when the observation describes a situation where a control that *should exist* simply does not. The absence is structural, not situational.

**Examples:**
- No PTW process exists for the work type observed
- No spotter procedure is in place for reversing operations at this site
- Electrical isolation standard has not been defined for this equipment type
- No pre-start checklist exists for this class of plant

**Pipeline effect:** `barrier_absent` combined with `signal_type = barrier_failure` triggers immediate pipeline routing.

---

### `barrier_failed`
**Severity:** Critical — pipeline direct trigger in combination with `barrier_failure` signal type.

The control exists and should have applied, but actively failed at the moment of the observation. The system broke down in practice — not because the control was absent, but because it was not functioning when it needed to.

**Classification guidance:** Use when the observation describes a control that was in place (a procedure existed, a person was assigned, a device was fitted) but did not work as required. The control was present but ineffective.

**Examples:**
- Spotter was assigned but had left position without informing the operator
- LOTO was applied but isolation was not confirmed before work began
- Permit was signed but conditions listed in the permit were not being met
- Safety observer present but not actively monitoring the task

---

### `barrier_degraded`
**Severity:** Elevated — routes to pool as `at_risk_condition`, accumulates toward threshold.

The control exists and is partially functioning, but not to the required standard. The barrier is weakening — not failed yet, but trending toward failure. This is the most common observation type for well-managed sites where frontline supervisors are actively catching drift before it becomes a failure.

**Classification guidance:** Use when the observation describes a control that is operating inconsistently, partially, or at reduced effectiveness. The control exists and is being applied, but something is missing or sub-standard.

**Examples:**
- Pre-start checks are being completed but not all steps are being covered
- Spotter is in position but the communication protocol between spotter and operator is not being followed
- Heat management plan is referenced in the permit but enforcement at crew level is ambiguous
- PPE is available but one crew member is not wearing it consistently

---

### `barrier_held`
**Severity:** None — positive indicator. Routes to pool as `positive_performance`.

The control was tested — something occurred that could have caused harm — and the barrier functioned as designed. This is a strong positive signal. It tells the system that the control works under real conditions, not just on paper.

**Classification guidance:** Use when the observation describes a situation where conditions or behaviours created a potential for harm, and the control prevented harm. The barrier was stressed and held. Do not use for routine compliance — use when there was genuine pressure on the control and it worked.

**Examples:**
- Crew stopped work when the assigned spotter was unavailable and waited for a replacement — did not proceed without one
- Permit was correctly refused when site conditions changed from those assessed at permit issuance
- Operator identified a pre-start defect, tagged the machine out of service, and reported before shift start
- Supervisor intervened when crew began to deviate from the task plan and re-briefed before continuing

---

### `none`
No identifiable barrier or control is relevant to this observation. Used for positive performance observations where no specific control was tested, general contextual observations, or cases where the observation is too vague to assess barrier state.

**Do not use as a default.** Only use `none` when barrier state genuinely cannot be assessed from the observation.

---

## State Severity Summary

| State | Severity | Signal type pairing | Pipeline effect |
|---|---|---|---|
| `barrier_absent` | Critical | `barrier_failure` | Pipeline direct |
| `barrier_failed` | Critical | `barrier_failure` or `unwanted_energy_event` | Pipeline direct |
| `barrier_degraded` | Elevated | `at_risk_condition` | Pool → trend detection |
| `barrier_held` | Positive | `positive_performance` | Pool → analytics |
| `none` | — | Any | No direct effect |

---

## Relationship to Signal Type

`barrier_assessment` and `signal_type` are independently classified but diagnostically paired. The combination tells a richer story than either field alone:

| barrier_assessment | signal_type | Diagnostic reading |
|---|---|---|
| `barrier_absent` | `barrier_failure` | Control gap — structural, not situational |
| `barrier_failed` | `barrier_failure` | Control exists but broke down — execution or maintenance issue |
| `barrier_failed` | `unwanted_energy_event` | Control broke down and energy was released |
| `barrier_degraded` | `at_risk_condition` | Control is drifting — intervention opportunity |
| `barrier_held` | `positive_performance` | Control tested and proved — reinforcement opportunity |

---

## Consumed By

| Feature | File | How used |
|---|---|---|
| Observation capture conversation | `features/OBSERVATION-CAPTURE.md` | `barrier_assessment` field in capture summary |
| Observation enrichment | `features/OBSERVATION-CAPTURE.md` | Independent barrier classification with confidence |
| Critical insight generation | `features/CRITICAL-INSIGHT.md` | Passed in observation summaries as context |
| Enquiry question generation | `features/ENQUIRY.md` | Barrier state informs question type selection |
| FW Map® classification | `features/CRITICAL-INSIGHT.md`, `features/INVESTIGATION.md` | Evidence basis for `management_systems` factor classification |
