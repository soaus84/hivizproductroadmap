# fw-map-blueprint.md — Forge Works Map® Blueprint Reference

**Forge Works · Hiviz SafetyPlatform — Global Reference**
Version: 1.0 — May 2026
Supersedes: `specs/fw-map-classification-reference-v1.md`

> **Scope:** Authoritative AI classification reference for the Forge Works Map®. This file is injected in full at runtime into the `fw_classify` system prompt — see `globals/fw-classify-job.md` for the job spec. It is also referenced by `cop_thread.generate`, `situational_brief.generate`, and `visit_briefing.generate` for factor-level framing. Feature specs reference this file by name — they do not copy content from it.

> **Not used for individual observation enrichment.** Signal at observation level is too thin for reliable FW classification. `fw_factor_hint` in the enrichment output is a lightweight forward-reference only — not a classification.

---

## How This Document Is Used

The AI consults this reference when:
- **Classifying** a critical insight, enquiry summary, or investigation against the FW Map® (`fw_classify` job)
- **Framing** a community discussion from a workflow-generated trigger (`cop_thread.generate` job)
- **Generating** a situational brief that references a classified factor (`situational_brief.generate` job)
- **Enriching** a visit briefing with factor-level signals (`visit_briefing.generate` job)

Confidence threshold for classification: **≥ 0.70**. Below this, return empty `classifications[]` with `attempted: true`.

---

## SUMMARY-REFERENCE — fw-map-blueprint

> **Runtime injection block — lightweight selection aid only.** Extracted by `extractSection(md, 'SUMMARY-REFERENCE — fw-map-blueprint')` and injected into prompts that select `fw_factor_hint` for the first time (observation capture, observation enrichment, incident capture, auto triage, investigation assist). It is deliberately lighter than the full Blueprint: 15 factor names, domain tag, and one sentence each — no maturity-level guidance, no diagnostic questions, no classification rules. The full per-factor content below is reserved for `fw_classify`, which receives the entire file in Full injection.

```
Select fw_factor_hint as one of these 15 Forge Works Map® factors, or null if no factor is strongly suggested by the observation:

GUIDE (direction & context)
- senior_leadership (guide): how senior leaders talk about and embody safety, and what their decisions signal about what actually matters
- strategy (guide): what triggers safety improvements and what the documented direction prioritises
- risk_management (guide): the quality of risk information and whether it flows into operational decisions
- safety_organisation (guide): the capability and focus of the safety function — compliance monitor vs system improver
- work_understanding (guide): the model of accident causation that drives decisions — human error vs system property

ENABLE (resources & systems)
- operational_management (enable): the role of middle and frontline managers in translating plans into controlled work
- resource_allocation (enable): how safety resources — time, people, equipment, budget — are identified and allocated
- management_systems (enable): the documented frameworks, procedures, and standards governing how work is planned and controlled
- goal_conflict_tradeoffs (enable): how safety goals are balanced against production, cost, and schedule pressure
- learning_development (enable): how the organisation builds capability and retains learning from experience

EXECUTE (frontline & operations)
- frontline_workers (execute): the knowledge, capability, and engagement of workers performing the work (never frames as blame)
- communications_coordination (execute): how information flows between roles, teams, and shifts; how handovers and briefings work
- decision_making (execute): how operational decisions are made in the moment — rule-following vs informed real-time judgment
- contractor_management (execute): how contractors are engaged, integrated, and managed alongside direct workforce
- monitoring_metrics (execute): what is tracked to monitor safety performance and what triggers a response
```

`fw_factor_hint` is a single lightweight pointer — not a classification. Only set it if the observation strongly suggests one of the 15 factors; otherwise return `null`. Full FW Map® classification runs separately via `fw_classify` on richer pattern-level evidence.

---

## Framework Structure

```
GUIDE domain     — Organisational intent, direction, and capacity to govern
ENABLE domain    — Organisational systems, infrastructure, and resources
EXECUTE domain   — Operational delivery and field behaviour
```

### The 15 Factors

```
GUIDE (direction & context)
  1.  senior_leadership        — How do senior leaders talk about and embody safety?
  2.  strategy                 — What triggers safety improvements?
  3.  risk_management          — What is the quality of risk information and how is it used?
  4.  safety_organisation      — How capable is the safety function and what do they focus on?
  5.  work_understanding       — What model of accident causation drives decisions?

ENABLE (resources & systems)
  6.  operational_management   — What is the role of middle/frontline managers?
  7.  resource_allocation      — How are safety resources identified and allocated?
  8.  management_systems       — How effective and focused are safety management systems?
  9.  goal_conflict_tradeoffs  — How are safety goals balanced with production/cost?
  10. learning_development     — How does the organisation develop capability and learn?

EXECUTE (frontline & operations)
  11. frontline_workers        — What is the role of frontline workers in safety outcomes?
  12. communications_coordination — How does information flow and how coordinated are teams?
  13. decision_making          — How are work and safety decisions made?
  14. contractor_management    — How are contractors engaged and managed?
  15. monitoring_metrics       — What information is used to monitor safety performance?
```

### Domain-Factor Mapping (for validation)

```typescript
export const FW_DOMAIN_MAP: Record<string, string> = {
  senior_leadership: 'guide',
  strategy: 'guide',
  risk_management: 'guide',
  safety_organisation: 'guide',
  work_understanding: 'guide',
  operational_management: 'enable',
  resource_allocation: 'enable',
  management_systems: 'enable',
  goal_conflict_tradeoffs: 'enable',
  learning_development: 'enable',
  frontline_workers: 'execute',
  communications_coordination: 'execute',
  decision_making: 'execute',
  contractor_management: 'execute',
  monitoring_metrics: 'execute',
}

export const FW_CONFIDENCE_THRESHOLD = 0.70
```

---

## Maturity Levels

| Level | Label | Signature |
|---|---|---|
| `compliant` | Systemic Management | Rules, compliance, procedures prescribe work. Safety is achieved by following the system. |
| `leading` | Cultural Management | Leadership behaviours, risk culture, safety climate. Safety is a value, not just a system. |
| `resilient` | Integrated Management | Work-as-done, emergent risk, safety as a property of the system. Safety is adaptive. |

**Maturity signal guidance:** Classify at the maturity level where the *gap* operates — not where the organisation aspires to be. Maturity levels are sequential — do not classify `resilient` if the `compliant` gap has not been addressed.

- `compliant` gap: basic procedural infrastructure is missing or not being followed
- `leading` gap: procedures exist but culture, climate, or leadership behaviour is the gap
- `resilient` gap: procedure exists and is followed, but the system isn't adapting to how work actually happens

---

## GUIDE Domain — Per-Factor Definitions

*Evidence typically surfaces through investigations, enquiry summaries, and multi-site insight patterns — rarely through individual field observations.*

---

### `senior_leadership`
**Diagnostic question:** How do senior leaders talk about safety and how are their actions perceived?

**Compliant:** Leaders promote compliance through rewards and discipline. Safety equals regulatory risk mitigation. CEO rarely attends safety meetings. Leaders perceived as caring about compliance.

**Leading:** Leaders create a vision for safety. Safety-related issues considered by leadership regularly — not just after incidents. Leaders champion zero harm. Leaders perceived as caring about people.

**Resilient:** Leaders view their role as providing service and support to people who execute work. Safety is a moral obligation. Workers are local experts and partners. Leaders perceived as caring about making work better for each worker.

**Classify when:** Senior decisions deprioritised safety versus production, cost, or schedule; leaders unaware of or unresponsive to field signals; stated values are contradicted by resource decisions.

**Boundary:** `senior_leadership` vs `strategy` — behaviour and decisions vs documented direction and planning.

**Framing cue:** "What did senior decisions signal about what actually matters here?"

---

### `strategy`
**Diagnostic question:** What triggers safety improvements and what is the focus of plans and actions?

**Compliant:** Safety strategy is driven by incidents and regulatory requirements. Plans focus on compliance and incident prevention. Strategy is reviewed annually or less.

**Leading:** Strategy is proactive — informed by leading indicators, risk assessments, and cultural surveys. Improvement priorities are set before incidents occur.

**Resilient:** Strategy is shaped by understanding work-as-done. Planning is adaptive. Feedback loops between field reality and strategic direction are short.

**Classify when:** The pattern shows a known risk that wasn't addressed in planning; improvements consistently lag events; strategic priorities don't reflect field-level risk signals.

**Boundary:** `strategy` vs `senior_leadership` — the documented plan vs the behaviour of leaders executing it.

**Framing cue:** "What would the organisation have needed to have planned differently to prevent this?"

---

### `risk_management`
**Diagnostic question:** What is the quality of risk information and how is it used in decisions?

**Compliant:** Risk assessments are completed to satisfy regulatory requirements. Standard checklists and generic risk matrices. Risk information exists but doesn't flow into operational decisions.

**Leading:** Risk assessments are actively used to plan controls. Risk information informs supervisor and manager decisions. Hazard identification is a practiced skill.

**Resilient:** Risk management is embedded in work planning. Workers participate in identifying hazards. Risk information is current, specific, and connected to how work is actually done.

**Classify when:** Hazards were known but not adequately controlled; risk assessments didn't reflect actual conditions; risk information existed but didn't reach decision makers.

**Boundary:** `risk_management` vs `management_systems` — hazard controls specifically vs the safety system broadly.

---

### `safety_organisation`
**Diagnostic question:** How capable is the safety function and what does it focus on?

**Compliant:** Safety professionals focus on compliance monitoring and incident reporting. Safety is a specialist function — line managers are not primary safety actors.

**Leading:** Safety professionals coach and develop line manager capability. Safety function is involved in operational planning. Safety is seen as a line management responsibility.

**Resilient:** Safety professionals focus on understanding how work is done and supporting system improvement. Safety is embedded in operational decision-making at all levels.

**Classify when:** Safety function was absent from a decision where their input was needed; safety focus was on reporting rather than prevention; line managers lacked safety capability.

---

### `work_understanding`
**Diagnostic question:** What model of accident causation drives safety decisions?

**Compliant:** Accidents are attributed to human error and rule violations. Safety solutions focus on procedure compliance and disciplinary responses. Work-as-imagined is assumed to equal work-as-done.

**Leading:** There is awareness that human error has causes. Root cause analysis is used. Some recognition that the system shapes behaviour.

**Resilient:** Safety is understood as a property of the system. Work-as-done is routinely different from work-as-imagined. Variability is managed, not eliminated. Learning focuses on how normal work produces incidents, not just how aberrant behaviour does.

**Classify when:** The response to an incident was disciplinary rather than systemic; procedures were assumed to be followed without verification; the investigation didn't explore why the behaviour made sense to the worker at the time.

**Boundary:** This is the most cross-cutting GUIDE factor — it shapes how all other factors manifest.

**Framing cue:** "Did the organisation understand how work was actually being done before this happened?"

---

## ENABLE Domain — Per-Factor Definitions

*Evidence typically surfaces from multi-site patterns, investigations, and enquiry synthesis — these factors explain why field conditions persist.*

---

### `operational_management`
**Diagnostic question:** What is the role of frontline and middle managers in safety outcomes?

**Compliant:** Managers ensure compliance with rules. Safety role is monitoring and enforcement. Manager success is measured by absence of incidents.

**Leading:** Managers coach and engage their teams on safety. Pre-task engagement is a practiced skill. Manager capability in safety is explicitly developed.

**Resilient:** Managers understand how work is done and support workers to manage variability. Managers are the primary link between strategic intent and field reality. Manager visits are substantive, not performative.

**Classify when:** The pattern shows systematic manager under-engagement with pre-task risk; managers unaware of the conditions that led to an event; manager visits are sign-off exercises rather than genuine oversight.

**Framing cue:** "What role did the management layer play in creating or allowing the conditions that existed?"

---

### `resource_allocation`
**Diagnostic question:** How are safety resources — time, people, equipment, budget — identified and allocated?

**Compliant:** Safety resources are allocated to meet regulatory minimums. Resourcing decisions are made centrally, reactively. Understaffing is treated as a planning failure, not a safety issue.

**Leading:** Safety resource requirements are identified through risk assessment. Resourcing is a deliberate safety management decision. Gaps are reported and tracked.

**Resilient:** Workers and supervisors have input into resource requirements. Goal conflicts between safety resource needs and production demands are visible and managed explicitly.

**Classify when:** The event or pattern reflects a resourcing decision — too few people, insufficient time, missing equipment; production pressure was met by reducing safety resource.

**Boundary:** `resource_allocation` vs `goal_conflict_tradeoffs` — missing resources vs competing priorities with available resources.

---

### `management_systems`
**Diagnostic question:** How effective and focused are safety management systems?

**Compliant:** Procedures and systems exist to meet regulatory requirements. Documentation is maintained. Compliance is monitored. Systems are the safety solution.

**Leading:** Systems are actively used and regularly reviewed. Procedures reflect actual practice. System gaps are identified and closed. Managers engage with the system quality.

**Resilient:** Systems are designed with input from the workers who use them. Procedures describe work-as-done, not work-as-imagined. System adaptation is a normal management activity.

**Classify when:** A procedure existed but didn't cover the actual conditions encountered; the permit or checklist process was followed but didn't prevent the event; documentation was complete but work wasn't safe.

**Boundary:** `management_systems` vs `risk_management` — the safety management system broadly vs hazard controls specifically.

---

### `goal_conflict_tradeoffs`
**Diagnostic question:** How are safety goals balanced with production, cost, and schedule?

**Compliant:** Goal conflicts are resolved by referring to rules. Production pressure is not formally acknowledged as a safety issue. Safety and production are treated as independent.

**Leading:** Goal conflicts are identified and escalated. There is a formal mechanism for raising safety concerns that compete with production. Leaders acknowledge tension exists.

**Resilient:** Goal conflicts are openly discussed. Workers have real authority to stop work when safety and production conflict. The cost of safety is explicitly included in operational planning.

**Classify when:** Production pressure was visibly present at the time of the event; the observation reflects a pattern of accepting increased risk to maintain output; stop-work authority was available but not exercised due to production context.

**Framing cue:** "What was the cost of choosing safety at the moment this decision was made?"

---

### `learning_development`
**Diagnostic question:** How does the organisation develop capability and learn from experience?

**Compliant:** Training is provided to meet regulatory requirements. Competency is assessed by completing training. Learning is event-driven — triggered by incidents.

**Leading:** Learning is proactive. Near-misses and observations are used to improve training. Capability development is tracked. Supervisors are developed as safety practitioners.

**Resilient:** Learning is continuous and embedded in work. Field experience feeds system improvement. Communities of practice develop shared expertise. Learning from success is as valued as learning from failure.

**Classify when:** Workers lacked the knowledge to recognise or respond to the hazard; training existed but didn't translate to field capability; the pattern has been seen before without the learning being retained.

**Framing cue:** "This issue has come up before — what happened to the learning from last time?"

---

## EXECUTE Domain — Per-Factor Definitions

*These factors relate to the operational layer — most directly evidenced by field observations, control verifications, and supervisor-level signals.*

---

### `frontline_workers`
**Diagnostic question:** What is the knowledge, capability, and engagement of workers performing the work?

**Compliant:** Workers follow procedures. Safety role is rule compliance. Deviation is treated as a disciplinary issue.

**Leading:** Workers actively participate in safety. Hazard identification is a practiced skill. Workers raise concerns. Safety engagement is recognised and developed.

**Resilient:** Workers are partners in safety. Their knowledge of how work is actually done is actively sought and used. Workers have real authority to influence safe work conditions.

**Classify when:** Workers were unaware of the hazards associated with their work type; workers lacked the practical skill to implement the required control; low engagement with safety processes was evident.

**Important:** Classifying `frontline_workers` never implies blame. The factor is about capability and knowledge — which are organisational responsibilities. Frame accordingly.

**Boundary:** `frontline_workers` vs `learning_development` — the state of worker capability vs the system that produces that capability.

---

### `communications_coordination`
**Diagnostic question:** How does information flow between roles, teams, and sites?

**Compliant:** Communication follows formal channels. Handover procedures exist. Information is transferred when required by procedure.

**Leading:** Communication is actively managed. Pre-task briefings are substantive. Shift handovers are thorough. Cross-team coordination is a managed activity.

**Resilient:** Communication is adaptive — it responds to changing conditions. Information gaps are proactively identified and closed. Coordination happens at the pace of work, not the pace of procedure.

**Classify when:** Information existed that didn't reach the right person at the right time; handover failures allowed a condition to persist; cross-team coordination failure created a foreseeable hazard condition.

**Framing cue:** "What information existed that didn't reach the right person at the right time?"

**Maturity signal example:** The spotter handover failure — PTW confirmation at shift change not treated as recommencement — is a textbook `communications_coordination` signal at the `leading` level: the process exists but is not consistently followed.

---

### `decision_making`
**Diagnostic question:** How are work and safety decisions made at the operational level?

**Compliant:** Decisions follow procedures. Deviation requires authorisation. Decision-making is rule-referencing.

**Leading:** Decisions incorporate risk assessment. Workers and supervisors apply structured thinking to non-standard conditions. Decision quality is developed through coaching.

**Resilient:** Decisions are made with full awareness of system state. Workers have the authority and capability to make safe decisions in real time. Decision-making under uncertainty is a trained skill.

**Classify when:** A decision was made in the moment that, with better information or authority, would have been made differently; the decision reflected production pressure rather than risk assessment; the decision was within procedure but produced an unsafe outcome.

**Boundary:** `decision_making` vs `communications_coordination` — decisions made with available information vs information not transferred.

---

### `contractor_management`
**Diagnostic question:** How are contractors engaged, integrated, and managed for safety?

**Compliant:** Contractors are inducted and required to comply with site rules. Safety responsibility is transferred via contract. Contractor performance is monitored for compliance.

**Leading:** Contractors are integrated into safety culture. Contractor supervisors are engaged the same as direct employees. Contractor safety performance is actively managed and developed.

**Resilient:** Contractors are partners. Their knowledge of the work is incorporated into risk management. Interface risks between contractor and site activities are actively managed.

**Classify when:** A contractor was involved and their safety integration into the site was a contributing factor; interface between contractor and site activities was not adequately managed; contractor was subject to different or lesser safety standards.

---

### `monitoring_metrics`
**Diagnostic question:** What information is used to monitor safety performance and what triggers a response?

**Compliant:** Monitoring focuses on lagging indicators — incident rates, lost time, compliance scores. Reporting is for regulatory purposes. Alerts are triggered by incidents.

**Leading:** Leading indicators are tracked — observation rates, near-miss reporting, atrophy scores. Monitoring triggers proactive intervention. Trend data is used in planning.

**Resilient:** Monitoring captures the health of the system, not just the outcomes. Work-as-done is monitored, not just work-as-planned. Signal quality is a management concern — not just signal quantity.

**Classify when:** The pattern was visible in the data before the event but didn't generate a response; monitoring was tracking the wrong things; the signal existed but wasn't connected to a decision.

**Framing cue:** "What signals were available before this happened — and why didn't they generate a response?"

---

## Classification Decision Rules

### When to classify
- Source contains specific, evidenced narrative — not just a description of an event
- The factor connection can be stated in one sentence with direct reference to the evidence
- At least one factor independently meets ≥ 0.70 confidence

### When NOT to classify
- Single observation without pattern context (signal too thin)
- Narrative is purely descriptive of physical conditions with no organisational signal
- The only classifiable factor would be `frontline_workers` without any enabling-layer evidence — this usually signals the narrative hasn't been fully read

### Multi-factor classification
- Maximum 3 factors per run, ordered by confidence descending
- Co-classification of EXECUTE and ENABLE factors is common and appropriate
- GUIDE factors rarely co-classify with EXECUTE factors from the same source — if both appear, verify the evidence genuinely supports both independently

### Maturity signal discipline
- Classify at the maturity level where the *gap* operates, not where the organisation aspires
- Do not classify `resilient` if the `compliant` gap has not been addressed — levels are sequential
- `resilient` classification requires evidence that basic procedural compliance is in place but the system is failing to adapt to work-as-done

---

## Boundary Case Quick Reference

| If torn between... | Distinguish by... |
|---|---|
| `senior_leadership` vs `strategy` | Behaviour and decisions vs documented direction |
| `risk_management` vs `management_systems` | Hazard controls specifically vs safety system broadly |
| `operational_management` vs `frontline_workers` | Manager layer vs worker layer |
| `goal_conflict_tradeoffs` vs `resource_allocation` | Competing priorities vs missing resources |
| `learning_development` vs `frontline_workers` | The system that produces capability vs the capability state itself |
| `communications_coordination` vs `decision_making` | Information not transferred vs decision made with available information |
| `monitoring_metrics` vs `risk_management` | Detecting signals vs controlling hazards |

---

## Factor × Pipeline Stage Affinity

`✓✓` = strong signal source · `✓` = occasional signal · `—` = rarely classifiable from this source

| Factor | Obs pattern | Enquiry summary | Investigation | Insight approved | CoP discussion |
|---|---|---|---|---|---|
| `senior_leadership` | — | ✓✓ | ✓✓ | ✓ | — |
| `strategy` | — | ✓✓ | ✓ | ✓ | — |
| `risk_management` | ✓ | ✓ | ✓✓ | ✓✓ | ✓ |
| `safety_organisation` | — | ✓ | ✓✓ | ✓ | — |
| `work_understanding` | ✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `operational_management` | ✓✓ | ✓ | ✓✓ | ✓✓ | ✓ |
| `resource_allocation` | ✓ | ✓✓ | ✓✓ | ✓✓ | ✓ |
| `management_systems` | — | ✓ | ✓✓ | ✓ | ✓ |
| `goal_conflict_tradeoffs` | ✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `learning_development` | ✓ | ✓ | ✓ | ✓✓ | ✓✓ |
| `frontline_workers` | ✓✓ | ✓ | ✓ | ✓ | ✓ |
| `communications_coordination` | ✓✓ | ✓ | ✓✓ | ✓✓ | ✓✓ |
| `decision_making` | ✓✓ | ✓ | ✓✓ | ✓ | ✓ |
| `contractor_management` | ✓ | ✓ | ✓✓ | ✓ | — |
| `monitoring_metrics` | ✓ | ✓ | ✓ | ✓✓ | ✓ |

---

## Community Discussion Framing Principles

When FW Map® classification informs a community discussion thread, these principles apply regardless of factor:

1. **Reframe as practitioner question, not announcement.** Invite field experience — do not report a finding.
2. **Name the pattern, not the site.** Abstract from the specific incident to the general phenomenon.
3. **The question must be answerable from experience.** Practitioners should respond without needing to know policy.
4. **Factor language is for the platform, not the post.** Never surface the factor name or maturity level in community-facing content.
5. **`goal_conflict_tradeoffs` and `work_understanding` generate the richest discussions.** These factors invite honest reflection on the gap between how work is imagined and how it's done.

---

## Consumed By

| Feature | File | How used |
|---|---|---|
| FW Map® classification | `features/CRITICAL-INSIGHT.md`, `features/INVESTIGATION.md`, `features/ENQUIRY.md` | Injected in full at runtime into `fw_classify` system prompt |
| CoP thread generation | `features/COMMUNITIES.md` | Factor framing principles + factor definitions for discussion seeding |
| Situational brief | `features/SITUATIONAL-BRIEF.md` | Factor-level narrative framing |
| Visit briefing | `features/VISIT-BRIEFING.md` | Factor signals for focus area prompts |
| Observation enrichment | `features/OBSERVATION-CAPTURE.md` | `fw_factor_hint` validation only — 15 factor names, not full content |
| Taxonomy reference | `taxonomy.html` | Full Blueprint rendered for human reference |

---

*Update this document when: new FW Map® definitional material is added; classification accuracy issues are identified in production; new pipeline stages generate classifiable signal; community framing principles are refined through V7 experience.*
