// src/pages/safety/enquiry.tsx
// WIREFRAME — Enquiry Builder (desktop) and Supervisor Response (mobile).
// Shows the full Enquiry entity and question/response lifecycle.

import { MOCK_SAFETY_MANAGER, MOCK_USER, MOCK_ENQUIRY } from '@/data/mock'

// ─── DATA ENQUIRY BUILDER READS ───────────────────────────────────────────────
// GET /api/insights/:id                         → source insight context
// GET /api/enquiries/:id/questions              → AI-generated questions (after job)

// ─── DATA ENQUIRY BUILDER WRITES ─────────────────────────────────────────────
// POST /api/enquiries { insight_id, title, target_scope, deadline }
//   → creates Enquiry, queues enquiry.generate_questions
// POST /api/enquiries/:id/dispatch
//   → sets status = dispatched, queues enquiry.notify_recipients

// ─── DATA SUPERVISOR RESPONSE READS ──────────────────────────────────────────
// GET /api/enquiries/:id/questions              → question list

// ─── DATA SUPERVISOR RESPONSE WRITES ─────────────────────────────────────────
// POST /api/enquiries/:id/respond { responses: [{ question_id, free_text_answer }] }
//   → creates EnquiryResponse records, queues enquiry.synthesise

export default function EnquiryPage() {
  const enquiry = MOCK_ENQUIRY

  return (
    <div style={{ fontFamily: 'monospace', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '12px 20px' }}>
        <div style={{ opacity: 0.4, fontSize: 10 }}>WIREFRAME · /safety/enquiry/:id</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Enquiry — Entity & Flow</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, padding: '16px 20px', maxWidth: 1100 }}>

        {/* ── LEFT: Builder (desktop) ── */}
        <div>
          {/* Enquiry entity fields */}
          <Card label="Enquiry Entity" entity="Enquiry">
            <FieldR k="id" v={enquiry.id} />
            <FieldR k="trigger_source" v={enquiry.trigger_source} tag="insight" />
            <FieldR k="insight_id" v={enquiry.insight_id} />
            <FieldR k="title" v={enquiry.title} />
            <FieldR k="target_scope" v={enquiry.target_scope} />
            <FieldR k="deadline" v={new Date(enquiry.deadline).toLocaleDateString()} />
            <FieldR k="status" v={enquiry.status} tag="active" />
            <FieldR k="recipient_count" v={enquiry.recipient_count} />
            <FieldR k="response_count" v={`${enquiry.response_count} of ${enquiry.recipient_count}`} />
          </Card>

          {/* Questions */}
          <Card label="EnquiryQuestion Entity (×3 — V1 free text only)" entity="EnquiryQuestion">
            <div style={{ fontSize: 10, background: '#fff3cd', color: '#856404', padding: '6px 8px', borderRadius: 4, marginBottom: 8 }}>
              V1: question_text (plain string) + ai_rationale only.
              V2 adds: question_type enum, response_options JSONB, structured response handling.
            </div>
            {enquiry.questions.map((q, i) => (
              <div key={q.id} style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 5, padding: '8px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2 }}>Q{q.position}</span>
                  <span style={{ fontSize: 10, color: '#888' }}>EnquiryQuestion.id: {q.id}</span>
                </div>
                <FieldR k="question_text" v={q.question_text} />
                <FieldR k="ai_rationale" v={q.ai_rationale} italic />
                <FieldR k="response_type (V1)" v="free_text" tag="always" />
              </div>
            ))}
          </Card>

          {/* AI synthesis results */}
          <Card label="AI Synthesis — enquiry.synthesise job output" entity="Enquiry.synthesis_findings (JSONB)">
            <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>
              Job runs after each EnquiryResponse is submitted (debounced 30s).
              Updates Enquiry.synthesis_findings in place.
            </div>
            {enquiry.synthesis_findings?.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px dashed #eee' }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 12, color: '#333' }}>{f.text}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 10, color: '#555', background: '#f5f5f5', padding: '6px', borderRadius: 4 }}>
              Stored as JSONB array: [{'{'}icon: "🔴", text: "..."{'}'}, ...]<br/>
              summary_narrative and recommended_actions populated on enquiry close.
            </div>
          </Card>

          {/* Actions from enquiry */}
          <Card label="→ CorrectiveAction created from enquiry results" entity="CorrectiveAction">
            <FieldR k="source_type" v="enquiry" />
            <FieldR k="enquiry_id" v={enquiry.id} />
            <FieldR k="description" v="Embed spotter handover into PTW before operations" />
            <FieldR k="assigned_to_id" v="u-001 (supervisor)" />
            <FieldR k="due_date" v="+7 days" />
            <FieldR k="status" v="open" tag="pending supervisor check-off" />
            <div style={{ fontSize: 10, color: '#0080aa', marginTop: 4 }}>
              POST /api/actions (batch) from enquiry results screen
            </div>
          </Card>
        </div>

        {/* ── RIGHT: Supervisor response view (mobile simulation) ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>SUPERVISOR MOBILE RESPONSE VIEW</div>
          <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '10px 14px', borderRadius: '8px 8px 0 0', fontSize: 11 }}>
            <div style={{ opacity: 0.5, fontSize: 10 }}>WIREFRAME · /supervisor/enquiry/:id</div>
            <div style={{ fontWeight: 700 }}>{enquiry.title}</div>
            <div style={{ opacity: 0.6, fontSize: 10, marginTop: 2 }}>Due: {new Date(enquiry.deadline).toLocaleDateString()} · {MOCK_USER.worksite_name}</div>
          </div>

          <div style={{ background: 'white', border: '1px solid #ddd', padding: '12px 14px' }}>
            <div style={{ fontSize: 10, background: '#f0f0ff', border: '1px solid #d0d0ff', padding: '6px 8px', borderRadius: 4, marginBottom: 12, color: '#5555aa' }}>
              Supervisor receives push notification → opens enquiry → sees plain question list → answers in free text → submits all at once
            </div>

            {enquiry.questions.map((q, i) => (
              <div key={q.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  <span style={{ color: '#5555aa', marginRight: 6 }}>{q.position}.</span>
                  {q.question_text}
                </div>
                <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 4, padding: '8px', fontSize: 11, color: '#888', minHeight: 50 }}>
                  [free text input — EnquiryResponse.free_text_answer]
                </div>
              </div>
            ))}

            <div style={{ background: '#1a1a2e', color: 'white', borderRadius: 5, padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
              Submit Responses
            </div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 6, textAlign: 'center' }}>
              POST /api/enquiries/:id/respond<br/>
              Body: {'{'} responses: [{'{'} question_id, free_text_answer {'}'}] {'}'}
            </div>
          </div>

          {/* EnquiryResponse entity */}
          <div style={{ background: 'white', border: '1px solid #ddd', borderTop: 'none', padding: '10px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#5555aa', marginBottom: 6 }}>ENQUIRYRESPONSE ENTITY</div>
            <FieldR k="id" v="resp-auto-uuid" />
            <FieldR k="enquiry_id" v={enquiry.id} />
            <FieldR k="question_id" v="q-001" />
            <FieldR k="responder_id" v={MOCK_USER.id} />
            <FieldR k="free_text_answer" v="We assign at the brief but if the spotter moves there is no handover process..." />
            <FieldR k="submitted_at" v="now()" />
            <div style={{ fontSize: 10, color: '#666', marginTop: 6, background: '#f5f5f5', padding: '5px', borderRadius: 3 }}>
              Unique constraint: (question_id, responder_id) — one response per question per person.
              On create: queues enquiry.synthesise (debounced 30s).
            </div>
          </div>
          <div style={{ background: '#1a1a2e', borderRadius: '0 0 8px 8px', padding: '10px 14px', display: 'flex', gap: 6 }}>
            {['Home', 'Talk', 'Capture', 'Records'].map(t => (
              <div key={t} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#888' }}>{t}</div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

function Card({ label, entity, children }: any) {
  return (
    <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ background: '#f5f5f5', padding: '7px 12px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 9, background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2 }}>{entity}</span>
      </div>
      <div style={{ padding: '10px 12px' }}>{children}</div>
    </div>
  )
}

function FieldR({ k, v, tag, italic }: { k: string; v: any; tag?: string; italic?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, color: '#0080aa', minWidth: 150, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 11, color: '#333', lineHeight: 1.4, fontStyle: italic ? 'italic' : 'normal' }}>{String(v)}</span>
      {tag && <span style={{ fontSize: 9, background: '#fff3cd', color: '#856404', padding: '1px 5px', borderRadius: 2, flexShrink: 0 }}>{tag}</span>}
    </div>
  )
}
