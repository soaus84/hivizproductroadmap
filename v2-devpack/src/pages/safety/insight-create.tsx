// src/pages/safety/insight-create.tsx
// WIREFRAME — Manual Critical Insight Creation (V2)
// Source type selector drives which metadata fields appear.
// One shape — source-aware field population.
// Creator IS reviewer: cleared_for_toolbox = true on save.

import { MOCK_SAFETY_MANAGER, MOCK_WORK_TYPES } from '@/data/mock'

// ─── DATA THIS PAGE READS ─────────────────────────────────────────────────────
// GET /api/work-types           → work type selector options
// GET /api/users?scope=region   → scope options

// ─── DATA THIS PAGE WRITES ────────────────────────────────────────────────────
// POST /api/insights {
//   trigger_source, work_type_id, sharing_scope,
//   pattern_summary, likely_systemic_cause, recommended_action,
//   toolbox_narrative, escalate_to_systemic, source_metadata
// }
// → cleared_for_toolbox = true immediately (creator = reviewer)
// → queues: fw_classify, toolbox_talk.generate, enquiry.generate_questions, situational_brief.generate

// POST /api/insights/structure-assist { raw_text, trigger_source }
// → SYNCHRONOUS — returns structured fields for manager to review before save
// → NOT a background job — manager sees output before anything is created

export default function InsightCreatePage() {
  const user = MOCK_SAFETY_MANAGER
  // Showing external_alert source type as example
  const selectedSource = 'external_alert'

  return (
    <div style={{ fontFamily: 'monospace', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ opacity: 0.4, fontSize: 10, marginRight: 8 }}>WIREFRAME · /safety/insights/new</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>New Critical Insight — Manual Entry</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{user.name}</div>
      </div>
      <div style={{ background: '#f0f0ff', borderBottom: '1px solid #d0d0ff', padding: '5px 20px', fontSize: 10, color: '#444' }}>
        <span style={{ background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2, marginRight: 4 }}>CriticalInsight</span>
        POST /api/insights — trigger_source: manual | external_alert | external_investigation
      </div>

      <div style={{ padding: '16px 20px', maxWidth: 780 }}>

        {/* SOURCE TYPE */}
        <Card label="1 — Source Type (required first — drives remaining fields)">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['manual', 'external_alert', 'external_investigation'].map(s => (
              <div key={s} style={{ padding: '8px 14px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: s === selectedSource ? '#1a1a2e' : '#f0f0f0', color: s === selectedSource ? 'white' : '#555', border: `2px solid ${s === selectedSource ? '#1a1a2e' : 'transparent'}` }}>
                {s.replace('_', ' ')}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>
            manual → leadership observation, judgement call<br/>
            external_alert → regulator, industry body, client alert<br/>
            external_investigation → finding from another system (Cintellate, InControl etc.)
          </div>
          <div style={{ marginTop: 8, background: '#fff3cd', border: '1px solid #fde68a', borderRadius: 4, padding: '6px 10px', fontSize: 11, color: '#92400e' }}>
            Creator is reviewer — cleared_for_toolbox = true on save. No separate review step.
          </div>
        </Card>

        {/* SOURCE METADATA — external_alert fields */}
        <Card label="2 — Source Metadata (shown for external_alert)">
          <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>Stored in CriticalInsight.source_metadata JSONB</div>
          <Field label="alert_title" placeholder="e.g. Safe Work Australia — Heavy Vehicle Reversing Safety Alert" required />
          <Field label="issuing_body" placeholder="e.g. Safe Work Australia / WorkSafe Victoria / Client Name" required />
          <Field label="alert_date" placeholder="Date of alert" type="date" required />
          <Field label="source_url" placeholder="https://..." optional />
          <div style={{ marginTop: 6, fontSize: 10, color: '#666' }}>
            Stored as: {'{'}"alert_title": "...", "issuing_body": "...", "alert_date": "2026-03-15", "source_url": "..."{'}'} 
          </div>
        </Card>

        {/* TAXONOMY */}
        <Card label="3 — Classification">
          <Field label="work_type_id" placeholder="Select work type" type="select" options={MOCK_WORK_TYPES.map(w => w.label)} required />
          <Field label="sharing_scope" placeholder="Select scope" type="select" options={['Site', 'Region', 'Division', 'Organisation']} required />
        </Card>

        {/* CONTENT */}
        <Card label="4 — Content (AI structuring assist available)">
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 5, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>AI Structuring Assist</div>
            <div style={{ fontSize: 11, color: '#0369a1', marginBottom: 8 }}>Paste raw source material (alert text, investigation summary, your notes) and AI will populate the fields below for your review.</div>
            <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 4, padding: '8px', fontSize: 11, color: '#888', minHeight: 60, marginBottom: 8 }}>
              [Paste raw text here...]
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ background: '#0369a1', color: 'white', borderRadius: 4, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Structure with AI
              </div>
              <div style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>
                POST /api/insights/structure-assist — SYNCHRONOUS, not a job
              </div>
            </div>
          </div>

          <Field label="pattern_summary" placeholder="2-3 sentences. What is the pattern and why does it matter operationally." type="textarea" required />
          <div style={{ fontSize: 10, color: '#888', marginTop: -8, marginBottom: 8 }}>ai_suggested_* version shown here if structuring assist was used — manager edits before save</div>

          <Field label="likely_systemic_cause" placeholder="1 sentence. The underlying condition probably driving this pattern." type="textarea" required />
          <Field label="recommended_action" placeholder="1 sentence. The change that would most directly address the cause." required />
          <Field label="toolbox_narrative" placeholder="4-6 sentences. Written so a supervisor can read it aloud to their crew. Plain English. Present tense. No jargon." type="textarea" required />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #e0e0e0', marginTop: 4 }}>
            <div style={{ width: 18, height: 18, border: '2px solid #e0e0e0', borderRadius: 3 }}></div>
            <span style={{ fontSize: 12 }}>Escalate to systemic investigation</span>
          </div>
        </Card>

        {/* ON SAVE */}
        <Card label="5 — On Save">
          <div style={{ fontSize: 11, color: '#555', lineHeight: 1.65, marginBottom: 10 }}>
            The following happens immediately on save — no additional steps required:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              'cleared_for_toolbox = true (creator = reviewer, reviewed_at = now())',
              'trigger_source = external_alert stored with source_metadata JSONB',
              'source badge applied to insight and all downstream outputs',
              'fw_classify job queued → Forge Works classification runs async',
              'toolbox_talk.generate job queued',
              'enquiry.generate_questions job queued',
              'situational_brief.generate job queued',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, color: '#333' }}>
                <span style={{ color: '#059669', flexShrink: 0 }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ACTIONS */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#059669', color: 'white', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Save & Enter Pipeline
          </div>
          <div style={{ background: '#f0f0f0', color: '#555', borderRadius: 6, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ background: '#f5f5f5', padding: '7px 14px', fontSize: 11, fontWeight: 700 }}>{label}</div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

function Field({ label, placeholder, required = false, optional = false, type = 'text', options }: {
  label: string; placeholder: string; required?: boolean; optional?: boolean; type?: string; options?: string[]
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#0080aa', fontWeight: 600 }}>{label}</span>
        {required && <span style={{ fontSize: 9, background: '#fee2e2', color: '#dc2626', padding: '0 4px', borderRadius: 2 }}>required</span>}
        {optional && <span style={{ fontSize: 9, color: '#888' }}>optional</span>}
      </div>
      {type === 'textarea' ? (
        <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 4, padding: '8px', fontSize: 11, color: '#aaa', minHeight: 60 }}>{placeholder}</div>
      ) : type === 'select' ? (
        <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 4, padding: '8px', fontSize: 11, color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
          <span>Select...</span><span>▾</span>
        </div>
      ) : (
        <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 4, padding: '8px', fontSize: 11, color: '#aaa' }}>{placeholder}</div>
      )}
    </div>
  )
}
