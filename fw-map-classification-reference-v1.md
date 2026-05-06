# Forge Works Map® — AI Classification Reference
**Version:** 1.0 (Baseline — pre-augmentation)  
**Status:** Draft — built from existing project knowledge  
**Purpose:** Reference layer for AI-assisted classification, framing, and pipeline enrichment. This document is additive — it sits alongside the taxonomy schema, not inside it. The schema (15 factors, 3 domains, 3 maturity levels) is the spine. This document gives the AI the depth to classify with precision.

---

## How this document is used

The AI consults this reference when:
- **Classifying** a critical insight, enquiry summary, or investigation against the FW Map® (`fw_classify` job)
- **Framing** a community discussion from a workflow-generated trigger (`cop_thread.generate` job)
- **Generating** a situational brief that references a classified factor (`situational_brief.generate` job)
- **Enriching** a visit briefing with factor-level signals (`visit_briefing.generate` job)

It is **not** used for individual observation enrichment — signal is too thin at that level.

Confidence threshold for classification: **≥ 0.70**. Below this, return empty `classifications[]` with `attempted: true`.

---

## The Framework Structure

```
GUIDE domain     — Organisational intent and capacity
ENABLE domain    — Organisational systems and infrastructure  
EXECUTE domain   — Operational delivery and field behaviour
```

### Maturity Levels

| Level | Label | Signature |
|---|---|---|
| `compliant` | Systemic Management | Rules, compliance, procedures prescribe work. Safety is achieved by following the system. |
| `leading` | Cultural Management | Leadership behaviours, risk culture, safety climate. Safety is a value, not just a system. |
| `resilient` | Integrated Management | Work-as-done, emergent risk, safety as a property of the system. Safety is adaptive. |

**Maturity signal guidance:** The maturity level reflects where the *gap* is operating, not what the organisation aspires to. A `compliant`-level gap means the basic procedural infrastructure is missing or not being followed. A `resilient`-level gap means the procedure exists and is followed, but the system isn't adapting to how work actually happens.

---

## GUIDE Domain

*These factors relate to the organisation's intent, direction, and capacity to govern safety. Evidence typically surfaces through investigations, enquiry summaries, and multi-site insight patterns — rarely through individual field observations.*

---

### `senior_leadership`
**Definition:** The visible commitment, prioritisation, and resource allocation decisions of the most senior people in the organisation.

**Classifiable when evidence shows:**
- Senior decisions that deprioritised safety relative to production, cost, or schedule
- Absence of senior engagement with safety findings or investigations
- Stated safety values that are contradicted by resource or priority decisions
- Senior leaders who are unaware of, or unresponsive to, field-level signals

**Boundary with `strategy`:** Senior leadership is about *behaviour and decisions*. Strategy is about *what the organisation has articulated* as its safety direction. They can co-occur.

**Boundary with `goal_conflict_tradeoffs`:** Goal conflict operates at the operational layer (manager and supervisor). Senior leadership operates at the executive layer.

**Maturity signal:**
- `compliant` — No governance structure or policy accountability at senior level
- `leading` — Policy exists but senior behaviour doesn't model it
- `resilient` — Leadership responds to what the system surfaces, but doesn't proactively sense

**Pipeline stage affinity:** Strongest signal from investigations and multi-site enquiry summaries. Rarely classifiable from a single site insight.

**Framing cue (community discussion):** Frame as a systemic question about organisational prioritisation, not as blame. "What does it take to get this issue onto the leadership agenda?"

---

### `strategy`
**Definition:** The clarity, coherence, and communication of the organisation's safety strategy — how it translates intent into direction.

**Classifiable when evidence shows:**
- Absence of a coherent safety improvement direction
- Strategy that is not communicated to or understood by operational roles
- Strategic goals that are disconnected from field reality
- Conflicting strategic signals across divisions or business units

**Boundary with `senior_leadership`:** Strategy is the *document and direction*. Senior leadership is the *behaviour behind it*.

**Maturity signal:**
- `compliant` — No formal safety strategy or plan
- `leading` — Strategy exists but is not operationalised or understood at field level
- `resilient` — Strategy exists and is communicated, but doesn't reflect how work is actually done

**Pipeline stage affinity:** Enquiry summaries, multi-site pattern insights. Not typically a single-event signal.

---

### `risk_management`
**Definition:** The organisation's systems and processes for identifying, assessing, and controlling risk — including the quality of those systems and how well they reflect actual hazards.

**Classifiable when evidence shows:**
- Risk assessments that don't reflect the actual work being performed
- SWMS or procedures that are generic, outdated, or not site-specific
- Hazard identification processes that miss known or recurring hazards
- Risk controls that are documented but not implemented or verified

**Boundary with `management_systems`:** Risk management is specifically about hazard identification and control. Management systems is broader — covering all safety management infrastructure.

**Boundary with `monitoring_metrics`:** Monitoring is about whether the organisation is *detecting* what's happening. Risk management is about whether the *controls* are adequate.

**Maturity signal:**
- `compliant` — Risk assessments absent or not current
- `leading` — Assessments exist and are followed, but hazard identification is reactive
- `resilient` — Controls in place but not adapted to how work is actually performed

**Pipeline stage affinity:** Strong signal from critical control failures (V5), SWMS review findings, investigation contributing factors.

**Framing cue:** "The risk assessment said X — but what was actually happening on the day?"

---

### `safety_organisation`
**Definition:** The structure, resources, and capabilities of the safety function itself — how safety is organised, resourced, and positioned within the business.

**Classifiable when evidence shows:**
- Safety roles that lack authority, access, or resource to act on findings
- Safety function that is reactive rather than proactive
- Insufficient safety coverage relative to operational complexity
- Safety professionals who are excluded from operational decision-making

**Maturity signal:**
- `compliant` — Safety role exists on paper but lacks function
- `leading` — Safety function is active but primarily compliance-focused
- `resilient` — Safety function is integrated but not positioned to sense emerging risk

---

### `work_understanding`
**Definition:** The degree to which those in Guide and Enable roles understand the actual work being performed — the gap between work-as-imagined and work-as-done.

**Classifiable when evidence shows:**
- Procedures that don't reflect how work is actually performed
- Management decisions made without accurate understanding of field conditions
- Investigations that reveal management was unaware of a known field practice
- Safety systems designed for an idealised version of work

**This is a Safety II / HOP signal.** Classifying at `resilient` is appropriate when the procedural infrastructure is sound but the system hasn't adapted to work-as-done.

**Boundary with `risk_management`:** Work understanding is about the *perception gap*. Risk management is about the *control adequacy*.

**Framing cue:** "What do the procedures assume about how this work gets done — and what's the reality?"

---

## ENABLE Domain

*These factors relate to the organisational infrastructure that supports safe work. Evidence surfaces through recurring patterns, system failures, and resource-related investigation findings.*

---

### `operational_management`
**Definition:** The quality of day-to-day management practices — how managers plan, supervise, communicate, and respond to operational conditions.

**Classifiable when evidence shows:**
- Supervisors or managers who are unaware of known hazardous conditions at their site
- Management practices that don't adapt to changing work conditions
- Reactive management responding to incidents rather than signals
- Planning failures that create foreseeable hazard conditions

**Boundary with `frontline_workers`:** Operational management is about the *manager layer*. Frontline workers is about the *worker layer*. They can co-occur.

**Boundary with `communications_coordination`:** Operational management is about the quality of the management function. Communications is about the quality of information flow between roles.

**Maturity signal:**
- `compliant` — Basic supervision absent or inconsistent
- `leading` — Supervision present but focused on compliance rather than sensing
- `resilient` — Management responds to incidents but doesn't proactively adapt

**Pipeline stage affinity:** Strong signal from observation patterns, atrophy-triggered insights, visit findings.

---

### `resource_allocation`
**Definition:** Whether the resources required to work safely — time, equipment, personnel, and support — are actually available when needed.

**Classifiable when evidence shows:**
- Workers improvising because adequate equipment is not available
- Controls not in place because resources to implement them aren't provided
- Scheduling or workload pressure that forces workers to take shortcuts
- Competing demands that leave safety-critical tasks under-resourced

**This is one of the most common root causes** in investigation findings and should be classified with high confidence when resource constraint is a contributing factor.

**Framing cue:** "If the equipment had been available / if there had been enough time — would this have happened?"

---

### `management_systems`
**Definition:** The documented systems, procedures, and processes that govern how safety is managed — their quality, currency, and practical usefulness.

**Classifiable when evidence shows:**
- Procedures that exist but are not used because they're impractical
- System gaps — areas of work not covered by any procedure
- Out-of-date documents that don't reflect current work practice
- Safety management system that is complex to navigate or inaccessible in the field

**Boundary with `risk_management`:** Management systems is the broader infrastructure. Risk management is specifically about hazard identification and control.

**Boundary with `learning_development`:** Management systems governs the *what*. Learning and development governs whether people *know and can apply* the what.

---

### `goal_conflict_tradeoffs`
**Definition:** The tension between safety and production, cost, or schedule goals — and how that tension is resolved at the operational level.

**Classifiable when evidence shows:**
- Workers or supervisors making decisions that trade safety for productivity
- Deadline or production pressure documented as a contributing factor
- Explicit or implicit messaging that productivity matters more than safety
- Workers who feel unable to stop work despite identified hazards

**This factor has strong interaction with `resource_allocation`.** Resource constraint often *forces* goal conflict — allocate accordingly.

**Maturity signal:**
- `compliant` — No mechanism for workers to raise goal conflicts
- `leading` — Stop-work authority exists but is rarely used
- `resilient` — Workers exercise judgement but the system doesn't learn from those decisions

**Framing cue:** "What would have had to be true for someone to feel they could stop work here?"

---

### `learning_development`
**Definition:** The organisation's capacity to learn from experience and translate that learning into improved practice — including training, knowledge transfer, and safety culture development.

**Classifiable when evidence shows:**
- The same issue recurring across sites or over time (failure to learn)
- Training that doesn't match actual work conditions or hazards
- Knowledge that exists at one site but hasn't transferred to others
- Toolbox talks, briefings, or inductions that don't reflect current risk intelligence

**This is the factor most directly supported by Hiviz's intelligence pipeline.** When insights are generated but not delivered as talks, or talks are delivered but don't change behaviour, `learning_development` is the signal.

**V7 Community signal:** High-quality community discussions that surface practice knowledge can be a positive signal on this factor. CoP health contributing to `learning_development` is architectural.

**Framing cue:** "This issue has come up before — what happened to the learning from last time?"

---

## EXECUTE Domain

*These factors relate to the operational layer — how work is actually performed in the field. This is the domain most directly evidenced by field observations, control verifications, and supervisor-level signals.*

---

### `frontline_workers`
**Definition:** The knowledge, capability, judgement, and engagement of the workers performing the work — their ability to recognise hazards and respond appropriately.

**Classifiable when evidence shows:**
- Workers unaware of the hazards associated with their work type
- Workers who lack the practical skills to implement required controls
- Low engagement with safety processes (sign-off without understanding)
- Workers who can identify hazards but don't know how to respond

**Important framing note:** Classifying `frontline_workers` should never imply worker blame. The factor is about *capability and knowledge*, which are organisational responsibilities. Frame accordingly.

**Boundary with `learning_development`:** Frontline workers is the *state* (what workers know and can do). Learning and development is the *system* that produces that state.

---

### `communications_coordination`
**Definition:** The quality of information flow between roles, teams, and sites — including pre-task briefings, shift handovers, cross-team coordination, and safety-critical communication.

**Classifiable when evidence shows:**
- Handover failures where critical information wasn't transferred
- Pre-task briefings that don't cover actual site conditions
- Cross-team coordination failures that create foreseeable hazard conditions
- Information that exists in the system but didn't reach the people who needed it

**This is a high-frequency EXECUTE factor.** The spotter handover example in the prototype — where PTW confirmation at shift change wasn't being treated as recommencement — is a textbook `communications_coordination` signal.

**Maturity signal:**
- `compliant` — No formal handover or briefing process
- `leading` — Process exists but is not consistently followed
- `resilient` — Process is followed but doesn't adapt to non-standard conditions

**Framing cue:** "What information existed that didn't reach the right person at the right time?"

---

### `decision_making`
**Definition:** The quality of decisions made at the operational level — including pre-task planning, in-work risk assessment, and responses to unexpected conditions.

**Classifiable when evidence shows:**
- Workers or supervisors who proceeded despite visible warning signs
- Decisions made without adequate information
- In-the-moment risk assessments that didn't account for actual conditions
- Failure to exercise stop-work authority when conditions warranted it

**Boundary with `goal_conflict_tradeoffs`:** Goal conflict explains *why* a poor decision was made. Decision making is about the *quality of the decision process itself*.

**Maturity signal:**
- `compliant` — Decision-making framework absent or not trained
- `leading` — Framework exists but workers lack confidence to apply it
- `resilient` — Workers make good individual decisions but the system doesn't capture or learn from them

---

### `contractor_management`
**Definition:** The systems and practices for managing contractor safety — induction, supervision, control verification, and integration into the safety management system.

**Classifiable when evidence shows:**
- Contractors operating without adequate induction or site-specific briefing
- Controls verified for direct workforce but not for contractors on the same site
- Contractor management treated as a compliance exercise rather than a safety function
- Interface hazards between contractor and direct workforce not identified or managed

**Pipeline stage affinity:** Investigation contributing factors, multi-contractor site observations, control verification failures where contractor status is relevant.

---

### `monitoring_metrics`
**Definition:** The organisation's capacity to detect and respond to safety signals — including the quality of leading indicators, reporting systems, and safety performance measurement.

**Classifiable when evidence shows:**
- Known signals that existed but weren't detected or responded to
- Measurement focused on lagging indicators (incidents) rather than leading indicators
- Reporting systems that discourage honest disclosure
- Atrophy patterns that indicate monitoring has lapsed

**Hiviz platform note:** The atrophy score is itself a `monitoring_metrics` signal. When atrophy is high, it indicates monitoring cadence has broken down. Classification at this factor is appropriate when the pattern shows a monitoring failure rather than a one-off incident.

**Framing cue:** "What signals were available before this happened — and why didn't they generate a response?"

---

## Classification Decision Rules

These rules are operational guidance for the `fw_classify` prompt. They supplement the confidence threshold.

### When to classify
- Source contains specific, evidenced narrative — not just a description of an event
- The factor connection can be stated in one sentence with direct reference to the evidence
- At least one factor meets ≥ 0.70 confidence

### When NOT to classify
- Single observation without pattern context (signal too thin)
- Narrative is purely descriptive of physical conditions with no organisational signal
- The only classifiable factor would be `frontline_workers` without any enabling-layer evidence — this is usually a sign the narrative hasn't been fully read

### Multi-factor classification
- Maximum 3 factors per run, ordered by confidence descending
- Co-classification of EXECUTE and ENABLE factors is common and appropriate
- GUIDE factors rarely co-classify with EXECUTE factors from the same source — if both appear, check whether the evidence genuinely supports both

### Maturity signal discipline
- Classify at the maturity level where the *gap* operates, not where the organisation aspires to be
- `resilient` is appropriate when the procedural infrastructure exists and is followed, but the system isn't adapting to work-as-done
- Do not classify `resilient` if the `compliant` gap hasn't been addressed — they are sequential, not independent

---

## Boundary Case Quick Reference

| If you're torn between... | Distinguish by... |
|---|---|
| `senior_leadership` vs `strategy` | Behaviour vs documented direction |
| `risk_management` vs `management_systems` | Hazard controls specifically vs safety system broadly |
| `operational_management` vs `frontline_workers` | Manager layer vs worker layer |
| `goal_conflict_tradeoffs` vs `resource_allocation` | Competing priorities vs missing resources |
| `learning_development` vs `frontline_workers` | The system that produces capability vs the capability state itself |
| `communications_coordination` vs `decision_making` | Information not transferred vs decision made with available information |
| `monitoring_metrics` vs `risk_management` | Detecting signals vs controlling hazards |

---

## Factor → Pipeline Stage Affinity

This table guides which pipeline stages are most likely to produce classifiable signal for each factor.

| Factor | Obs Pattern | Enquiry Summary | Investigation | Insight Approved | CoP Discussion |
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

`✓✓` = strong signal source · `✓` = occasional signal · `—` = rarely classifiable from this source

---

## Community Discussion Framing Principles

When the AI uses FW Map® classification to frame a community discussion, the following principles apply regardless of factor:

1. **Reframe as practitioner question, not announcement.** The discussion should invite field experience, not report a finding.
2. **Name the pattern, not the site.** Abstract from the specific incident to the general phenomenon.
3. **The question should be answerable from experience.** Practitioners should be able to respond without needing to know policy.
4. **Factor language is for the platform, not the post.** Never surface the factor name or maturity level in community-facing content.
5. **`goal_conflict_tradeoffs` and `work_understanding` generate the richest discussions.** These factors invite honest reflection on the gap between how work is imagined and how it's done.

---

*This document should be updated when:*
- *New FW Map® definitional material is added to the project*
- *Classification accuracy issues are identified in production*
- *New pipeline stages are added that generate classifiable signal*
- *Community discussion framing principles are refined through V7 experience*
