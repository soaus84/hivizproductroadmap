// src/pages/safety/workbench.tsx
// WIREFRAME — Safety Manager Workbench. Primary desktop view.
// Shows the insight review queue, insight detail panel, and action queue.

import {
  MOCK_SAFETY_MANAGER,
  MOCK_INSIGHT,
  MOCK_INSIGHT_APPROVED,
  MOCK_OBSERVATION,
} from '@/data/mock'

// ─── DATA THIS PAGE READS ─────────────────────────────────────────────────────
// GET /api/insights?scope=region&status=pending_review     → queue items
// GET /api/insights/:id                                    → selected insight detail
// GET /api/observations?insight_id=:id                    → source observations
// GET /api/actions?scope=region&status=open               → action queue

// ─── DATA THIS PAGE WRITES ────────────────────────────────────────────────────
// POST /api/insights/:id/review  { action, sharing_scope, reviewer_notes }
//   → sets cleared_for_toolbox, queues talk.generate, enquiry.generate_questions, fw_classify

// ─── QUEUE ITEM TYPES ─────────────────────────────────────────────────────────
// critical_insight — requires review
// corrective_action — overdue / due this week

export default function SafetyManagerWorkbench() {
  const user = MOCK_SAFETY_MANAGER

  const queueItems = [
    { id: 'ci-042', type: 'insight', urgency: 'overdue', daysOverdue: 2, title: 'Spotter management — 6 near-misses · North Region', work_type: 'Heavy Vehicle', endorsements: 5 },
    { id: 'act-003', type: 'action', urgency: 'overdue', daysOverdue: 5, title: 'Update STMP — spotter positioning', assignee: 'J. Reyes' },
    { id: 'ci-040', type: 'insight', urgency: 'this_week', daysOverdue: 0, title: 'PTW sign-on atrophy — Central Rail', work_type: 'Control of Work', endorsements: 2 },
    { id: 'act-004', type: 'action', urgency: 'this_week', daysOverdue: 0, title: 'Add reversing camera to pre-start', assignee: 'M. Chen' },
  ]

  // Selected insight — shows in detail panel
  const selectedInsight = MOCK_INSIGHT
  const sourceObservations = [MOCK_OBSERVATION]

  return (
    <DesktopWireframePage
      title="Safety Manager Workbench"
      route="/safety/workbench"
      user={user}
      entities={[
        { name: 'CriticalInsight', source: 'GET /api/insights?status=pending_review', description: 'Review queue items' },
        { name: 'Observation', source: 'GET /api/observations?insight_id=:id', description: 'Source observations for selected insight' },
        { name: 'CorrectiveAction', source: 'GET /api/actions?status=overdue', description: 'Overdue action queue items' },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 220px', gap: 12, height: 'calc(100vh - 140px)' }}>

        {/* ── COLUMN 1: Queue ── */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
          <ColHeader label="Action Queue" count={queueItems.length} />
          <div style={{ overflow: 'auto', height: 'calc(100% - 40px)' }}>
            <GroupLabel label="OVERDUE" color="#dc2626" />
            {queueItems.filter(i => i.urgency === 'overdue').map(item => (
              <QueueItem key={item.id} item={item} selected={item.id === 'ci-042'} />
            ))}
            <GroupLabel label="DUE THIS WEEK" color="#d97706" />
            {queueItems.filter(i => i.urgency === 'this_week').map(item => (
              <QueueItem key={item.id} item={item} selected={false} />
            ))}
          </div>
        </div>

        {/* ── COLUMN 2: Insight Detail Panel ── */}
        <div style={{ background: 'white', border: '2px solid #1a1a2e', borderRadius: 6, overflow: 'auto' }}>
          <ColHeader label="CI-042 — Insight Review" count={null} highlight />

          {/* Entity: CriticalInsight fields */}
          <Section label="CriticalInsight Entity">
            <FieldRow2 k="id" v={selectedInsight.id} />
            <FieldRow2 k="trigger_source" v={selectedInsight.trigger_source} tag="algorithm" />
            <FieldRow2 k="source_metadata" v={JSON.stringify(selectedInsight.source_metadata)} />
            <FieldRow2 k="generated_at_level" v={selectedInsight.generated_at_level} />
            <FieldRow2 k="work_type_label" v={selectedInsight.work_type_label} />
            <FieldRow2 k="cleared_for_toolbox" v="false" tag="pending review" color="#dc2626" />
          </Section>

          {/* AI-generated content — editable before approval */}
          <Section label="AI-Generated Content (editable)">
            <FieldRow2 k="pattern_summary" v={selectedInsight.pattern_summary} />
            <FieldRow2 k="likely_systemic_cause" v={selectedInsight.likely_systemic_cause} />
            <FieldRow2 k="recommended_action" v={selectedInsight.recommended_action} />
            <FieldRow2 k="toolbox_narrative" v={selectedInsight.toolbox_narrative} italic />
            <FieldRow2 k="escalate_to_systemic" v="false" />
          </Section>

          {/* Source observations */}
          <Section label="Source Observations (6 total — showing 1)">
            {sourceObservations.map(obs => (
              <div key={obs.id} style={{ background: '#f5f5f5', borderRadius: 4, padding: '6px 8px', marginBottom: 6 }}>
                <FieldRow2 k="id" v={obs.id} />
                <FieldRow2 k="observation_type" v={obs.observation_type} tag="near-miss" color="#dc2626" />
                <FieldRow2 k="what_was_observed" v={obs.what_was_observed} />
                <FieldRow2 k="stop_work_called" v={String(obs.stop_work_called)} />
                <FieldRow2 k="ai_key_hazard" v={obs.ai_key_hazard} />
                <FieldRow2 k="ai_failure_type" v={obs.ai_failure_type} />
              </div>
            ))}
          </Section>

          {/* FW Classification — pending */}
          <Section label="Forge Works Map® Classification (pending fw_classify job)">
            <div style={{ background: '#f5f5ff', border: '1px solid #c0c0ff', borderRadius: 4, padding: '8px', fontSize: 11, color: '#555' }}>
              fw_classify job queues after approval. Classification runs async — confidence threshold 0.70.
              Fields: fw_factor, fw_domain, fw_maturity_signal, fw_confidence, fw_rationale.
              All NULL until job completes.
            </div>
          </Section>

          {/* Review actions */}
          <Section label="Review Actions → POST /api/insights/:id/review">
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionButton label="✓ Approve & Share" color="#059669" />
              <ActionButton label="✎ Edit first" color="#d97706" />
              <ActionButton label="✕ Reject" color="#dc2626" />
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
              On approve: cleared_for_toolbox = true · sharing_scope set · queues:
              toolbox_talk.generate, enquiry.generate_questions, fw_classify
            </div>
          </Section>
        </div>

        {/* ── COLUMN 3: Context ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
            <ColHeader label="Site Metrics" count={null} />
            <div style={{ padding: '8px 10px' }}>
              <MetricTile label="Atrophy Score" value="79" color="#dc2626" />
              <MetricTile label="Near-misses 30d" value="6" color="#d97706" />
              <MetricTile label="Open Investigations" value="2" color="#d97706" />
              <MetricTile label="Days since last obs" value="18" color="#d97706" />
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
            <ColHeader label="Endorsements (5)" count={null} />
            <div style={{ padding: '8px 10px', fontSize: 11 }}>
              {[
                { name: 'J. Thompson', role: 'Regional Mgr', note: 'Saw this at Riverside on Tuesday' },
                { name: 'K. Obi', role: 'Supervisor · CRD', note: 'Same at Central Rail last week' },
              ].map(e => (
                <div key={e.name} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #eee' }}>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{e.role}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{e.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </DesktopWireframePage>
  )
}

// ─── WIREFRAME PRIMITIVES (DESKTOP) ──────────────────────────────────────────

function DesktopWireframePage({ title, route, user, entities, children }: any) {
  return (
    <div style={{ fontFamily: 'monospace', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ opacity: 0.4, fontSize: 10, marginRight: 8 }}>WIREFRAME · {route}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{user.name} · {user.scope}</div>
      </div>

      <div style={{ background: '#f0f0ff', borderBottom: '1px solid #d0d0ff', padding: '6px 20px', display: 'flex', gap: 16 }}>
        {entities.map((e: any) => (
          <div key={e.name} style={{ fontSize: 10, color: '#444' }}>
            <span style={{ background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2, marginRight: 4 }}>{e.name}</span>
            {e.source}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 20px' }}>{children}</div>
    </div>
  )
}

function ColHeader({ label, count, highlight = false }: { label: string; count: number | null; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#1a1a2e' : '#f0f0f0', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: highlight ? 'white' : '#333' }}>{label}</span>
      {count !== null && <span style={{ fontSize: 10, background: '#dc2626', color: 'white', borderRadius: 10, padding: '1px 6px' }}>{count}</span>}
    </div>
  )
}

function GroupLabel({ label, color }: { label: string; color: string }) {
  return <div style={{ fontSize: 9, padding: '5px 10px', color, fontWeight: 700, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>{label}</div>
}

function QueueItem({ item, selected }: { item: any; selected: boolean }) {
  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: selected ? '#f0f0ff' : 'white', borderLeft: `3px solid ${item.type === 'insight' ? '#5555aa' : '#d97706'}`, cursor: 'pointer' }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{item.title}</div>
      <div style={{ fontSize: 10, color: '#888', display: 'flex', gap: 6 }}>
        <span style={{ background: item.type === 'insight' ? '#eeeeff' : '#fff3cd', color: item.type === 'insight' ? '#5555aa' : '#856404', padding: '1px 5px', borderRadius: 2 }}>{item.type}</span>
        {item.daysOverdue > 0 && <span style={{ color: '#dc2626' }}>{item.daysOverdue}d overdue</span>}
        {item.endorsements && <span>👍 {item.endorsements}</span>}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '10px 14px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#888', marginBottom: 6, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  )
}

function FieldRow2({ k, v, tag, color, italic }: { k: string; v: any; tag?: string; color?: string; italic?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, color: '#0080aa', minWidth: 150, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 11, color: color || '#333', lineHeight: 1.4, fontStyle: italic ? 'italic' : 'normal' }}>{String(v)}</span>
      {tag && <span style={{ fontSize: 9, background: '#fff3cd', color: '#856404', padding: '1px 5px', borderRadius: 2, flexShrink: 0 }}>{tag}</span>}
    </div>
  )
}

function ActionButton({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ fontSize: 11, padding: '6px 12px', background: color, color: 'white', borderRadius: 4, cursor: 'pointer' }}>{label}</div>
  )
}

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #eee', fontSize: 11 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  )
}
