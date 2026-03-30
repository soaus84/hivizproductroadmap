# Enquiry Module Specification

**Hiviz — Field Intelligence Enquiry System**  
Version: 0.3 — March 2026

---

## 1. What the Enquiry System Is

The Enquiry is the pull counterpart to the Toolbox Talk push. The Toolbox Talk broadcasts learning to crews. The Enquiry gathers intelligence from sites. Both are triggered by the same intelligence pipeline.

```
Field Signal (observation / incident)
  │
  ▼
Intelligence Layer
  ├── Trend Detection ──────────────────────────────────┐
  │                                                     │
  └── Investigation (open)                              │
        ├── Mid-investigation cross-site check ─── ENQUIRY ◄─── Critical Insight (approved)
        └── Witness / participant questions              │
                                                        │
                               ┌────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │                     │
              TOOLBOX TALK           ENQUIRY DISPATCH
              (broadcast)            (pull / learn)
                    │                     │
                    └──────────┬──────────┘
                               ▼
                        CORRECTIVE ACTIONS
                        (verified, owned, dated)
                               │
                               ▼
                          Loop Closed ✓
```

---

## 2. Trigger Sources

### Trigger 1 — Critical Insight Approved

```
ON critical_insight.review_action = 'approved':
  CREATE enquiry (trigger_source = 'critical_insight', status = 'draft')
  QUEUE job: enquiry.generate_questions
  NOTIFY Safety Manager: "Enquiry draft ready"
```

AI generates questions by reading:
- The approved insight's pattern_summary, likely_systemic_cause, and toolbox_narrative
- The source observation cluster (anonymised)
- The existing observation pool — if prevalence data already exists, prevalence question is not recommended
- The work type taxonomy — to frame assurance questions correctly

Default targeting: source sites only, supervisors.

### Trigger 2 — Investigation Mid-Enquiry

```
TRIGGER: Investigator manually initiates OR AI investigation assist flags suspected cross-site condition

LEGAL CHECK: IF investigation.legal_hold = true → BLOCK ENTIRELY (no override)

ON trigger (if clear):
  CREATE enquiry (trigger_source = 'investigation_mid', status = 'draft')
  context_narrative = "We are investigating an incident at one of our sites.
                       We need to check whether a related condition exists at yours."
  DEFAULT targeting: same-region sites
```

AI generates questions based on the investigation's current immediate_cause and contributing_factors context. Questions verify whether the specific gap exists at other sites — not investigation details.

### Trigger 3 — Investigation Witness

```
TRIGGER: Investigator adds named individuals to investigation record

LEGAL CHECK: IF investigation.legal_hold = true → BLOCK ENTIRELY

ON trigger (if clear):
  CREATE enquiry (
    trigger_source = 'investigation_witness',
    default_target_type = 'named_individuals',
    target_ids = [named_user_ids]
  )
```

AI generates questions from the investigation framework (from Prompt 3 output). Questions are witness-appropriate: Work as Done, Assurance Check, Gap Identification. Notification uses sensitive wording (N25).

---

## 3. Question Types

Seven types. AI selects the most appropriate for each enquiry. Safety manager can remove, add, or reorder.

### 3.1 Assurance Check
**Use when:** You need to know if a specific control is in place right now.  
**Response:** Yes / Partially / No + mandatory note if Partially or No + optional photo  
**Example:** "Is a designated spotter assigned and confirmed in position before any heavy vehicle reversing operation begins on your site?"

### 3.2 Likelihood Assessment
**Use when:** You want to understand how supervisors perceive the risk — before asking about controls.  
**Response:** Low / Moderate / High + optional brief reason  
**Example:** "How likely is it that a spotter could leave their position during a reversing operation without the operator knowing?"

### 3.3 Prevalence Check
**Use when:** Observation pool data is thin and you need to understand frequency of a behaviour.  
**AI behaviour:** If sufficient prevalence data exists in recent observations for this work type and site, AI will NOT recommend this question type — it's already answered by the data.  
**Response:** Never / Sometimes / Always + optional note  
**Example:** "How often do you see the PTW conditions being read before work starts?"

### 3.4 Evidence Request
**Use when:** Visual proof of a physical condition is needed — not just attestation.  
**Response:** Required photo + description of what it shows  
**Example:** "Take a photo of your current site traffic management plan showing how spotter positions are documented."

### 3.5 Work as Done
**Use when:** You need to understand actual practice vs documented procedure.  
**Response:** Free text, AI synthesised across responses. Min 3 sentences encouraged.  
**Prompt shown to supervisor:** "Describe what actually happens, not what the procedure says."  
**Example:** "Describe how spotter assignment actually works on your site — from when the task starts to when it's complete."

### 3.6 Gap Identification
**Use when:** You want supervisors to name what's missing — not just confirm a problem.  
**Response:** Free text + category tag (People / Process / Equipment / Environment)  
**Example:** "What would need to change on your site for spotter management to work reliably every single time?"

### 3.7 Comparative Check
**Use when:** You need to know both whether a system exists AND whether it's working.  
**Response:** Exists & works / Has gaps / Doesn't exist + description  
**Example:** "Does your site have a process for handing over spotter responsibility when a spotter needs to leave their position — and is it working reliably?"

---

## 4. Targeting Model

Two dimensions per question: **who** and **where**.

### Target Type
- `site_role` — all users of a given role at targeted sites (most common)
- `named_individuals` — specific named users (witness enquiries only)
- `site_scope` — all supervisors at specific sites regardless of role nuance

### Target Scope (for site_role and site_scope)
- `source_sites` — only the sites whose observations triggered the insight
- `region` — all sites in the same region as the incident/insight
- `division` — all sites in the division
- `organisation` — all sites organisation-wide
- `custom` — safety manager manually selects specific sites

### Target Role (for site_role)
- `supervisor` — default for most questions
- `manager` — when the question is about management systems rather than frontline practice
- `both` — when both perspectives are needed

**Per-question targeting overrides enquiry-level defaults.** A single enquiry can have Q1 targeting source sites (supervisors) and Q2 targeting the full region (supervisors). This is intentional — the targeting is set per question, not per enquiry.

---

## 5. AI Prompt — Question Generation

**Triggered by:** `enquiry.generate_questions` job  
**Model:** `claude-sonnet-4-20250514`  
**Returns:** JSON array of question objects

### System Prompt

```
You are a safety intelligence analyst generating field enquiry questions for a 
construction and industrial safety platform.

Your role is to generate the minimum set of questions that will give the safety 
manager the clearest possible picture of whether a risk condition exists at 
multiple sites — and what is actually happening in practice.

Rules:
- Generate 3-6 questions maximum. More questions = lower completion rate.
- Select question types that build on each other: start with perception 
  (likelihood), then control verification (assurance), then practice 
  (work as done), then gap (identification).
- Never recommend a Prevalence Check if you are told prevalence data exists.
- Always include at least one Work as Done question — it captures what 
  no other question type can.
- Write questions in plain language a site supervisor can answer in 2 minutes.
- Do not use safety jargon.
- Each question must have a clear, single answer — no compound questions.
- Output ONLY valid JSON, no preamble.
```

### User Prompt Template

```
Trigger source: {{trigger_source}}

{{#if trigger_source == 'critical_insight'}}
Insight pattern: {{pattern_summary}}
Likely systemic cause: {{likely_systemic_cause}}
Work type: {{work_type_label}}
Source observation count: {{observation_count}}
Sample observations (anonymised): {{observation_summaries}}
Prevalence data available from existing observations: {{prevalence_available}}
{{/if}}

{{#if trigger_source == 'investigation_mid'}}
Incident narrative: {{incident_description}}
Suspected cross-site condition: {{contributing_factors}}
Work type: {{work_type_label}}
{{/if}}

{{#if trigger_source == 'investigation_witness'}}
Incident narrative: {{incident_description}}
Immediate cause (provisional): {{immediate_cause}}
Contributing factors (provisional): {{contributing_factors}}
These questions go to named witnesses — not site-wide.
{{/if}}

Generate a field enquiry question set. Return JSON array:
[
  {
    "position": 1,
    "question_type": "likelihood|assurance|prevalence|evidence|work_as_done|gap_identification|comparative",
    "question_text": "Plain language question",
    "response_options": ["Option A", "Option B", "Option C"] | null,
    "allow_photo": true | false,
    "require_note_if": ["Option B", "Option C"] | null,
    "ai_rationale": "Why this question, why this position, what it adds",
    "default_target_scope": "source_sites|region|division",
    "default_target_role": "supervisor|manager|both"
  }
]
```

---

## 6. AI Prompt — Live Synthesis

**Triggered by:** `enquiry.synthesise` job — runs after every new response submission  
**Model:** `claude-sonnet-4-20250514`  
**Returns:** JSON synthesis object stored in `enquiry.ai_synthesis`

The synthesis updates continuously as responses arrive. It does not wait for completion. The safety manager sees findings building in real time.

### System Prompt

```
You are synthesising field responses to a safety enquiry in real time. 
Responses are still arriving — your analysis should reflect what is 
known now, not wait for completeness.

Be direct. Name patterns clearly. Use colour-coded signal language:
- 🔴 Confirmed risk condition / control not in place
- 🟠 Likely condition / inconsistent control
- 🟡 Perceived risk / partial visibility  
- 💡 Actionable insight / convergent suggestion

Do not hedge unnecessarily. If 7 of 9 responses say the control is not 
in place, say that clearly. Output ONLY valid JSON.
```

### User Prompt Template

```
Enquiry: {{enquiry_title}}
Trigger: {{trigger_source}} — {{trigger_context}}
Responses received: {{response_count}} of {{total_recipients}}

Structured response distributions:
{{per_question_distributions}}

Free text response excerpts (anonymised by question):
{{free_text_excerpts}}

Generate a synthesis. Return JSON:
{
  "findings": [
    {
      "signal": "🔴|🟠|🟡|💡",
      "text": "Finding in plain language, specific, direct. Reference response counts."
    }
  ],
  "response_count": {{response_count}},
  "generated_at": "{{now}}"
}
```

---

## 7. AI Prompt — Final Summary

**Triggered by:** `enquiry.generate_summary` job — on close or manual trigger  
**Model:** `claude-sonnet-4-20250514`  
**Returns:** JSON with narrative, recommended actions, stored in `enquiry.summary` + `enquiry.recommended_actions`

### System Prompt

```
You are writing the final summary of a completed safety field enquiry. 
This summary will be read by safety managers, possibly shared with 
division leadership, and used to generate corrective actions and 
toolbox talk content.

Voice: Direct, evidence-based, no hedging. Name what was found.
Recommended actions must be specific and implementable — not generic 
safety advice. Output ONLY valid JSON.
```

### User Prompt Template

```
Enquiry: {{enquiry_title}}
Trigger: {{trigger_context}}
Total responses: {{response_count}} of {{total_recipients}}
Response rate: {{response_rate}}%

Final distributions:
{{per_question_final_distributions}}

All free text responses (anonymised):
{{all_free_text_responses}}

AI synthesis at close:
{{final_synthesis}}

Generate the final summary. Return JSON:
{
  "narrative": "3-5 sentences. What was found, across how many sites/responses, what the key condition is, what the field said. Evidence-based, no hedging.",
  "recommended_actions": [
    "Specific implementable action 1 — address the primary root cause",
    "Specific implementable action 2 — address a contributing condition",
    "Specific implementable action 3 — close the loop with crews"
  ],
  "toolbox_narrative": "2-3 sentences suitable for a toolbox talk. Written so a supervisor can say: 'We asked [N] supervisors across [M] sites. Here's what we found. Here's what we're doing.' Crew-facing language.",
  "escalate_to_systemic": true | false,
  "escalation_rationale": "If true: why this warrants escalation. If false: null."
}
```

---

## 8. Database Schema

See `01-data-model-api-spec.md` Sections 4.6 and 5 for full SQL schemas.

Tables:
- `safety_intelligence.enquiry`
- `safety_intelligence.enquiry_question`
- `safety_intelligence.enquiry_response`

---

## 9. API Endpoints

See `01-data-model-api-spec.md` Section 4.6 for full endpoint definitions.

Key endpoints:
- `POST /api/v1/enquiries` — create draft
- `PATCH /api/v1/enquiries/:id` — update questions/targeting
- `POST /api/v1/enquiries/:id/dispatch` — lock and send
- `GET /api/v1/enquiries/:id/results` — real-time results + synthesis
- `POST /api/v1/enquiries/:id/close` — trigger summary generation

---

## 10. Async Jobs

| Job | Trigger | Latency |
|-----|---------|---------|
| `enquiry.generate_questions` | Enquiry created | <15s |
| `enquiry.notify_recipients` | Enquiry dispatched | Immediate |
| `enquiry.synthesise` | Response submitted | <5s |
| `enquiry.reminder` | 24h before deadline | Scheduled |
| `enquiry.generate_summary` | Close or manual | <20s |
| `enquiry.notify_completion` | Summary generated | Immediate |

---

## 11. Legal & Privacy Rules

1. **Legal hold hard block.** `investigation.legal_hold = true` prevents ANY enquiry creation from that investigation. Enforced at data layer. No override.

2. **Witness notification wording.** The N25 notification template requires approval from the organisation's legal and HR team before go-live. The platform provides the template — the org approves.

3. **Anonymisation.** No names, specific dates, or identifying worksite details in enquiry context narratives sent to supervisors. The context explains why without disclosing investigation specifics.

4. **Witness response confidentiality.** Witness responses are visible only to the investigation team. They do not appear in the live feed or general enquiry results view. Separate access control required.

5. **Enquiry responses are not anonymous.** Supervisors know their responses are attributed. This is intentional — it enables follow-up and maintains accountability. Make this clear in the UI.
