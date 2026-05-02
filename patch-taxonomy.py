#!/usr/bin/env python3
"""
taxonomy.html patcher — Blueprint-enriched FW Map® classifier (v0.2)

Run from the root of the hivizproductroadmap repo:
  python3 patch-taxonomy.py

What this does:
  1. Replaces the lean ENRICH_PROMPT constant with the full Blueprint
     reference (FW_REFERENCE), a system prompt (ENRICH_SYSTEM), and
     a function-form user prompt (ENRICH_PROMPT)
  2. Updates the fetch() call to use system/user split with max_tokens:1200
  3. Updates the FW Map® result rendering to display multiple classified
     factors (classifications array) instead of a single fw_factor field

Creates a .bak backup before writing.
"""

import os
import sys
import shutil

TARGET = 'taxonomy.html'

if not os.path.exists(TARGET):
    print(f"ERROR: {TARGET} not found. Run from repo root.")
    sys.exit(1)

with open(TARGET, 'r') as f:
    content = f.read()

print(f"Read {TARGET}: {len(content)} bytes")

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 1 — Replace ENRICH_PROMPT constant
# ─────────────────────────────────────────────────────────────────────────────

OLD_BLOCK_START = "const ENRICH_PROMPT = `You are an AI enrichment engine for a safety platform."

if OLD_BLOCK_START not in content:
    print("ERROR: Could not find ENRICH_PROMPT. Has this already been patched?")
    sys.exit(1)

start = content.index(OLD_BLOCK_START)
search_from = start + len(OLD_BLOCK_START)
end_marker = "`;"
end = content.index(end_marker, search_from) + len(end_marker)
old_block = content[start:end]
print(f"Found ENRICH_PROMPT block: {len(old_block)} chars")

NEW_BLOCK = r"""const FW_REFERENCE = `
FORGE WORKS MAP® — CLASSIFICATION REFERENCE (Forge Works Blueprint source, May 2026)

FRAMEWORK:
GUIDE domain — capacity to frame and set direction, priorities and aligned understanding
ENABLE domain — capacity to provide resources, capability and business processes
EXECUTE domain — capacity to create the safety of work day-in and day-out

MATURITY LEVELS (sequential — do not classify resilient if compliant gap is not addressed):
- compliant: Safety processes exist to meet legislative/organisational requirements. Rules, compliance, procedures prescribe work.
- leading: Safety leadership capability created. Focus on leadership behaviours, risk management, safety communication and assurance.
- resilient: Safety is an emergent property of how the organisation functions. Focus on understanding how work is done, open communication, anticipating scenarios, minimising goal conflict.

FACTOR DEFINITIONS:

senior_leadership [GUIDE]
Diagnostic question: How do senior leaders talk about safety and how are their actions perceived by others?
compliant: Leaders promote compliance through rewards/discipline. Safety = regulatory risk mitigation. CEO rarely attends safety meetings. Leaders perceived as caring about compliance.
leading: Leaders create a vision for safety. Safety-related issues considered by CEO regularly — not just after incidents. Leaders champion zero harm. Leaders perceived as caring about people.
resilient: Leaders view their role as providing service/support to people who execute work. Safety is a moral obligation. Workers are local experts and partners. Leaders perceived as caring about making work better for each worker.
classify when: Senior decisions deprioritised safety vs production/cost/schedule; leaders unaware of/unresponsive to field signals; stated values contradicted by resource decisions.
boundary: vs strategy — behaviour and decisions vs documented direction.

strategy [GUIDE]
Diagnostic question: What triggers safety improvements and what is the focus of plans and actions?
compliant: Improvement focused on corrective action in response to incidents and regulatory requirements. Plans target creation/improvement of safety work practices. Actions directed at frontline workers.
leading: Clear goals, strategies and programs at all levels to reduce safety risk. Organisation proactively undertakes pre-accident safety investigations. Improvement action directed towards leadership and safety organisation.
resilient: Safety created through organisational strategy — an emergent property of how the organisation functions. All strategic decisions made with a clear view of safety. Improvements for safety realised through improvements to work.
classify when: Absence of coherent safety improvement direction; strategy not communicated to or understood by operational roles; improvement actions directed only at individuals, not the system.

risk_management [GUIDE]
Diagnostic question: What is the quality of risk information generated in the organisation and how is it used?
compliant: Risk assessments performed as required by law. Focus on completing paperwork. Risk information stored but has limited influence on strategy, decision-making, and resource allocation.
leading: Risks known and communicated throughout the organisation, updated in real time. Risk information integrated across operational dimensions. Risk assessments inform how work is planned and executed.
resilient: Organisation continually looking beyond what is in the risk register. Diverse groups including frontline workers probe and revise the organisation's understanding of risk. Expects failure and invests in resilience for unknown risks.
classify when: Risk assessments do not reflect actual work performed; SWMS/procedures generic, outdated, or not site-specific; risk controls documented but not implemented or verified; risk information existed but was not used in decisions.
boundary: vs management_systems — hazard identification/control quality vs safety system infrastructure broadly. vs monitoring_metrics — detecting signals vs adequacy of controls.

safety_organisation [GUIDE]
Diagnostic question: How capable is your safety organisation and what is the focus of their activities?
compliant: Safety professionals regularly marginalised and left out of important operational and strategic decisions. Work is predominately administrative.
leading: Safety professionals identify and drive risk reduction using the hierarchy of controls. They have formal senior status with dedicated, qualified, experienced resources.
resilient: Safety professionals are an integral link in strategic and operational management. They explore everyday work to understand work-as-imagined vs work-as-done. Their work focuses on supporting safe execution of operational work — not safety work.
classify when: Safety roles lack authority, access, or resource to act on findings; safety function reactive rather than proactive; safety professionals excluded from operational decision-making.

work_understanding [GUIDE]
Diagnostic question: What model of accident causation does your organisation use?
compliant: Accidents caused by technical/operational failures at point of risk. Focus on creating more rules and detailed procedures. People working outside procedures are non-compliant. Language: deviation, non-compliance, human error.
leading: Safety outcomes driven by underlying organisational factors. Investigations follow multiple causation models (ICAM, 5-whys, Taproot). Language: root cause, just culture, organisational factors.
resilient: Safety outcomes are emergent properties of work — always complex and dynamic. Investigations follow complex, non-linear causation models (STAMP, FRAM, CAST). Learnings implemented as global reforms. Performance variability accepted and essential. Language: performance variability, complexity, normal work, adaptation.
classify when: Procedures do not reflect how work is actually performed; management decisions made without accurate understanding of field conditions; incident reports attribute events to non-compliance or human error.
boundary: vs risk_management — the perception gap vs the control adequacy.

operational_management [ENABLE]
Diagnostic question: What is the role of middle and frontline managers in delivering operational and safety outcomes?
compliant: Managers delegate safety work to safety professionals. Engage with frontline to reinforce compliance. Do not comprehensively understand worker needs. Involved in serious incidents — not day-to-day safety integration.
leading: Managers actively participate in safety work including leadership visits, inductions, training, risk assessments, investigations. Managers at all levels accountable for safety and genuinely committed.
resilient: Organisation deeply integrates planning and execution with management of safety risks. Managers internalise safety as a moral responsibility and actively search for weak signals where risk might be emerging. They improve work-as-done rather than performing separate safety work activities.
classify when: Supervisors/managers unaware of known hazardous conditions at their site; management practices do not adapt to changing work conditions; reactive management responding to incidents rather than signals; planning failures that create foreseeable hazard conditions.
boundary: vs frontline_workers — manager layer vs worker layer. vs communications_coordination — quality of the management function vs quality of information flow between roles.

resource_allocation [ENABLE]
Diagnostic question: How are safety needs identified and resources allocated to reduce risk?
compliant: Organisation invests minimal resources in safety to comply with regulations. Safety professionals do not have authority to invest in safety without Senior Leadership approval.
leading: Organisation invests in improvements to address known safety risks and issues. Safety department staffed with competent professionals and there is an approved, resourced safety improvement program.
resilient: Organisation invests significant resources supporting operations. Spare capacity (operational slack) viewed as essential — deliberately designed into the management system. Organisation continually builds capacity for operational resilience.
classify when: Workers improvising because adequate equipment not available; scheduling/workload pressure forces shortcuts; competing demands leave safety-critical tasks under-resourced; safety professionals lack authority to act without senior approval.
note: High-frequency root cause. Strong interaction with goal_conflict_tradeoffs — resource constraint often forces goal conflict.

management_systems [ENABLE]
Diagnostic question: What is the focus and effectiveness of safety and work management systems?
compliant: Safety management practices separate to work management systems. Based on safety regulatory requirements and industry standards. Effectiveness determined through compliance to legislation and surveillance audits.
leading: Safety and work management systems are effective and reliable — they target specific needs of the work and known safety risks. Widely known and monitored for usefulness and impact. Needs of the SMS identified through consultation with frontline.
resilient: Organisation understands work-as-done and co-designs work processes with frontline workers. Local units have autonomy to design safety processes that meet organisational requirements. Defers to expertise and experienced workers over protocol. Inquires deeply with objective curiosity when work deviates from expected processes.
classify when: Procedures exist but not used because they are impractical; system gaps where work is not covered by any procedure; out-of-date documents that do not reflect current work practice; management systems designed without consultation with frontline.
boundary: vs risk_management — broader safety system infrastructure vs hazard identification and control specifically.

goal_conflict_tradeoffs [ENABLE]
Diagnostic question: How are safety goals balanced with other business objectives?
compliant: Primary objective is to optimise production and cost. Safety issues prioritised over production following an incident. Workers have authority to stop work with manager's permission when clear risk to life.
leading: Organisation balances safety and other business goals by prioritising safety over significant known issues. Workers have authority to stop work and exercise it routinely when facing clear challenges. Committed to zero fatalities/injuries.
resilient: Goal conflicts identified and addressed before work starts. Cost and production objectives sacrificed based on weak signals: targets and schedules reset when goal conflict increases. Frontline workers stop and adjust work to adapt to emerging risk and are enabled and supported to do so.
classify when: Workers/supervisors making decisions that trade safety for productivity; deadline/production pressure documented as a contributing factor; workers feel unable to stop work despite identified hazards; stop-work authority exists on paper but is not exercised in practice.
note: Strong interaction with resource_allocation — resource constraint often forces goal conflict.

learning_development [ENABLE]
Diagnostic question: What is the approach to developing capability, operational learning and knowledge management?
compliant: Established worker competency development program focusing on technical skill and knowledge requirements. Operational learning is largely reactive — focused on learning from incidents, audits. Limited absorptive capacity for learning and change.
leading: Established worker capability program combining technical and non-technical skills. Safety professionals support operational learning activities based on incidents and issues. Organisation seeks to understand peer organisations' practices and adopt industry best practice.
resilient: Dedicated processes implemented across all levels to make collective sense of normal work and events. Team-based learning processes. Organisation understands blame fixes nothing. Active learning dominates capability development. Learning processes built into planning, preparing, executing and reviewing work. After-action reviews.
classify when: The same issue recurring across sites or over time (failure to learn); training that does not match actual work conditions or hazards; toolbox talks/briefings that do not reflect current risk intelligence; learning that is reactive (only after incidents) rather than proactive.

frontline_workers [EXECUTE]
Diagnostic question: What is the role of frontline workers in contributing to work and safety outcomes?
compliant: Frontline workers maintain technical competence and comply with the organisation's safety rules and procedures. Workers participate in safety processes through formal consultation. Encouraged to stop work when there is a serious safety risk.
leading: Frontline workers actively engaged in identifying and developing safety programs, processes, and improvements. Creates a collective ownership environment. Workers expected to stop work or abandon production goals when there is a safety risk.
resilient: Frontline workers engaged in co-design of work. Valued for their experience and viewed as local experts and partners. The frontline educates management in how work is done. Management creates a climate of psychological safety. Workers express initiative and adapt to emerging situations.
classify when: Workers unaware of the hazards associated with their work type; workers lack practical skills to implement required controls; low engagement with safety processes (sign-off without understanding).
IMPORTANT: classifying frontline_workers must never imply worker blame — the factor is about capability and knowledge, which are organisational responsibilities.
boundary: vs learning_development — capability STATE (what workers know and can do) vs SYSTEM that produces that state.

communications_coordination [EXECUTE]
Diagnostic question: How does information flow through the organisation and how coordinated are teams and activities?
compliant: Information flows strongly from senior leaders to operational management to frontline via a one-to-many broadcast style. Teams focus on individual objectives and may work at cross-purposes.
leading: Information flows strongly up and down the organisation. Formal and informal ways allow frontline workers to raise and resolve issues. Peer relationships encouraged to facilitate learning and sharing across organisational boundaries.
resilient: As a psychologically safe workplace, employees share incidents, issues, insights, and ideas. Information about work issues and safety risks flows freely and constructively up, down, and across the organisation. Teams focus on the organisation's objectives and anticipate the needs of others.
classify when: Handover failures where critical information was not transferred; pre-task briefings that do not cover actual site conditions; cross-team coordination failures that create foreseeable hazard conditions; information that existed in the system but did not reach the people who needed it; PTW or shift-change protocols that treat recommencement as continuation.
note: PTW confirmation at shift change not being treated as recommencement is a textbook communications_coordination signal.

decision_making [EXECUTE]
Diagnostic question: How are decisions made in relation to the management of work and safety?
compliant: Safety decisions made by management and referred to a safety professional to meet legal compliance requirements. Work management decisions rarely involve safety professionals unless there is a clear safety impact.
leading: Safety decisions made by the appropriate level of line management with trusted and professional input from a safety professional. Organisation defers to protocol and safety requirements. Decision-making processes seek confirming evidence.
resilient: Work management decisions made by the most appropriate person or team. Leaders understand that in complex work, complete control cannot be achieved — so they let go and create capability and trust for their teams to make good decisions. Decision-making processes seek disconfirming evidence.
classify when: Workers/supervisors who proceeded despite visible warning signs; decisions made without adequate information about actual conditions; failure to exercise stop-work authority when conditions warranted it; decisions escalated to management that should have been made at the front line.
boundary: vs goal_conflict_tradeoffs — goal_conflict_tradeoffs explains WHY a poor decision was made; decision_making is about the QUALITY of the decision process itself.

contractor_management [EXECUTE]
Diagnostic question: How are contractors engaged and managed?
compliant: Contractors pre-qualified in a largely desktop review process with site audits. Organisation periodically performs reactive audit and assurance processes — typically following incidents and non-conformances.
leading: All scopes of work to be contracted are risk assessed. Contractors pre-qualified based on safety requirements specific to the scope of work. Capability of contractors well understood and verified. Organisation performs scheduled assurance activities.
resilient: Organisation is an informed buyer of all procured services. Guided collaborative pre-qualification processes. Contractors have flexibility and autonomy in work delivery and are seamlessly integrated. Dynamic assurance processes respond to emerging risks and weak signals.
classify when: Contractors operating without adequate induction or site-specific briefing; controls verified for direct workforce but not for contractors on the same site; contractor management treated as a compliance exercise rather than a safety function.

monitoring_metrics [EXECUTE]
Diagnostic question: What sources of information are used to monitor and influence work and safety performance?
compliant: Lagging and compliance indicators monitored — incident metrics, near-miss incident metrics, and safety compliance metrics. Managers measure safety by incident rates and compliance. Operations considered safe when there is an absence of negative events.
leading: Suite of quantitative and qualitative lagging and leading indicators. Metrics may include critical risk control effectiveness activities, positive safety climate indicators. Operations considered safe when controls are assured effective and when a positive climate for safety is observed.
resilient: Operational work data and qualitative insights provide information about current operations and management of known AND unknown safety risks. Performance indicators raise questions — they do not provide answers — so formal discovery processes are implemented. Managers are pre-occupied with failure — not complacent.
classify when: Known signals that existed but were not detected or responded to; measurement focused on lagging indicators (incidents) rather than leading indicators; reporting systems that discourage honest disclosure; atrophy patterns indicating monitoring cadence has broken down.

BOUNDARY CASE QUICK REFERENCE:
- senior_leadership vs strategy: behaviour and decisions vs documented direction
- risk_management vs management_systems: hazard controls specifically vs safety system broadly
- operational_management vs frontline_workers: manager layer vs worker layer
- goal_conflict_tradeoffs vs resource_allocation: competing priorities vs missing resources
- learning_development vs frontline_workers: system that produces capability vs capability state itself
- communications_coordination vs decision_making: information not transferred vs decision made with available information
- monitoring_metrics vs risk_management: detecting signals vs controlling hazards
- work_understanding vs risk_management: the perception gap vs the control adequacy
- safety_organisation vs operational_management: safety function capability vs line management function
`;

const ENRICH_SYSTEM = `You are an AI enrichment engine for a construction and industrial safety platform. Analyse the observation and return ONLY valid JSON — no preamble, no markdown, no explanation.

For the FW Map® classification, use the following reference material:

${FW_REFERENCE}

FW Map® classification rules:
- Only classify factors where you can write a specific, evidence-based rationale
- Never classify on vague association — the narrative must provide direct evidence
- Maximum 3 factors, ordered by fw_confidence descending
- Only include factors where fw_confidence >= 0.70
- Classify at the maturity level where the GAP operates
- Maturity levels are sequential — do not classify resilient if the compliant gap is not addressed`;

const ENRICH_PROMPT = (obs) => `Observation: "${obs}"

Return this exact JSON structure:
{
  "signal_type": "positive_performance|weak_signal|at_risk_condition|unwanted_energy_event|barrier_failure",
  "signal_type_confidence": 0.0,
  "signal_type_rationale": "one sentence",
  "energy_type": "kinetic|gravitational|electrical|thermal|chemical|pressure|noise_vibration|none",
  "energy_type_confidence": 0.0,
  "energy_release_potential": "catastrophic|high|moderate|low|none",
  "barrier_assessment": "barrier_absent|barrier_failed|barrier_degraded|barrier_held|none",
  "barrier_confidence": 0.0,
  "barrier_rationale": "one sentence",
  "pipeline_routing": "pool|pipeline_direct",
  "routing_rationale": "one sentence",
  "fw_classifications": [
    {
      "fw_factor": "factor_name",
      "fw_domain": "guide|enable|execute",
      "fw_maturity_signal": "compliant|leading|resilient",
      "fw_confidence": 0.0,
      "fw_rationale": "one sentence — why THIS factor based on THIS evidence"
    }
  ],
  "fw_classification_basis": "one sentence — what specific evidence made this narrative classifiable at all",
  "fw_attempted": true
}

fw_classifications is an empty array if nothing met 0.70. Max 3 items, ordered by fw_confidence descending.`;"""

content = content[:start] + NEW_BLOCK + content[end:]
print("✓ Patch 1: ENRICH_PROMPT replaced with FW_REFERENCE + ENRICH_SYSTEM + ENRICH_PROMPT function")

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 2 — Remove old prompt variable line
# ─────────────────────────────────────────────────────────────────────────────

OLD_P2 = "    const prompt = ENRICH_PROMPT.replace('{OBS}', obs.replace(/\"/g, '\\\\\"'));\n    const res = await fetch('https://api.anthropic.com/v1/messages', {"
NEW_P2 = "    const res = await fetch('https://api.anthropic.com/v1/messages', {"

if OLD_P2 in content:
    content = content.replace(OLD_P2, NEW_P2, 1)
    print("✓ Patch 2: Removed old prompt variable line")
else:
    print("⚠ Patch 2: Old prompt line not found — may already be patched")

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 3 — Update max_tokens and use system/user split
# ─────────────────────────────────────────────────────────────────────────────

OLD_P3 = "        model: 'claude-sonnet-4-20250514',\n        max_tokens: 800,\n        messages: [{ role: 'user', content: prompt }]"
NEW_P3 = "        model: 'claude-sonnet-4-20250514',\n        max_tokens: 1200,\n        system: ENRICH_SYSTEM,\n        messages: [{ role: 'user', content: ENRICH_PROMPT(obs) }]"

if OLD_P3 in content:
    content = content.replace(OLD_P3, NEW_P3, 1)
    print("✓ Patch 3: Updated fetch call — max_tokens:1200, system prompt, ENRICH_PROMPT(obs)")
else:
    print("⚠ Patch 3: Old fetch params not found — may already be patched")

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 4 — Update FW result rendering for classifications array
# ─────────────────────────────────────────────────────────────────────────────

OLD_P4 = "    populateResult('fw_factor', result.fw_factor?.replace(/_/g,' '), result.fw_confidence, result.fw_rationale);\n    populateResult('fw_domain', result.fw_domain?.toUpperCase(), null, null);\n    populateResult('fw_maturity', result.fw_maturity_signal, null, null);\n\n    // Highlight in taxonomy\n    highlightTaxonomy('signal_type', result.signal_type);\n    highlightTaxonomy('fw_factor', result.fw_factor);\n    highlightTaxonomy('barrier', result.barrier_assessment);"

NEW_P4 = r"""    // FW Map® — render multiple classifications (Blueprint-enriched v0.2)
    const fwCard = document.getElementById('res-fw_factor');
    fwCard.classList.add('populated');
    const fwValEl = fwCard.querySelector('.result-value');
    fwValEl.textContent = '';
    fwValEl.className = 'result-value';

    if (result.fw_classifications && result.fw_classifications.length > 0) {
      result.fw_classifications.forEach((cls, i) => {
        const factorEl = document.createElement('div');
        factorEl.style.cssText = i > 0 ? 'margin-top:10px;padding-top:10px;border-top:1px solid var(--border-light);' : '';
        const confColor = cls.fw_confidence >= 0.7 ? 'var(--green)' : cls.fw_confidence >= 0.5 ? 'var(--amber)' : 'var(--red)';
        factorEl.innerHTML = `
          <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:var(--text-primary);">${cls.fw_factor?.replace(/_/g,' ')}</div>
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${cls.fw_domain?.toUpperCase()} \xb7 ${cls.fw_maturity_signal}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <div style="flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${cls.fw_confidence*100}%;border-radius:2px;background:${confColor}"></div>
            </div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);">${(cls.fw_confidence*100).toFixed(0)}%</div>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);font-style:italic;line-height:1.45;">${cls.fw_rationale}</div>
        `;
        fwValEl.appendChild(factorEl);
        highlightTaxonomy('fw_factor', cls.fw_factor);
      });
      if (result.fw_classification_basis) {
        const basisEl = document.createElement('div');
        basisEl.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);font-size:10px;color:var(--text-muted);font-style:italic;';
        basisEl.textContent = result.fw_classification_basis;
        fwValEl.appendChild(basisEl);
      }
    } else {
      fwValEl.textContent = result.fw_attempted === false ? 'Input too thin to classify' : 'No factor met 0.70 threshold';
      fwValEl.className = 'result-value c-muted';
    }

    // Hide separate domain/maturity cards — shown inline per factor above
    const domCard = document.getElementById('res-fw_domain');
    const matCard = document.getElementById('res-fw_maturity');
    if (domCard) domCard.style.display = 'none';
    if (matCard) matCard.style.display = 'none';

    // Highlight in taxonomy
    highlightTaxonomy('signal_type', result.signal_type);
    highlightTaxonomy('barrier', result.barrier_assessment);"""

if OLD_P4 in content:
    content = content.replace(OLD_P4, NEW_P4, 1)
    print("✓ Patch 4: FW result rendering updated for multi-factor classifications array")
else:
    print("⚠ Patch 4: Old FW result rendering not found — may already be patched")

# ─────────────────────────────────────────────────────────────────────────────
# Write output
# ─────────────────────────────────────────────────────────────────────────────

shutil.copy(TARGET, TARGET + '.bak')
with open(TARGET, 'w') as f:
    f.write(content)

print(f"\n✓ Patched {TARGET} written ({len(content)} bytes)")
print(f"  Backup saved as {TARGET}.bak")
print("\nCommit both files together:")
print("  git add taxonomy.html specs/02-ai-prompt-library.md")
print('  git commit -m "feat: Blueprint-enriched FW Map® classifier (v0.2)"')
