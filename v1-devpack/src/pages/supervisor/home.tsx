// src/pages/supervisor/home.tsx
// WIREFRAME — Entity display page showing what data this screen reads and writes.
// Replace mock data with real API calls. No design system applied yet.

import {
  MOCK_USER,
  MOCK_TALK,
  MOCK_OBSERVATION,
  MOCK_ACTIONS,
} from '@/data/mock'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface PendingTalk {
  id: string
  work_type_label: string
  generated_minutes_ago: number
  attendee_count: number
  insight_id: string
}

interface ActivityItem {
  type: 'observation' | 'talk_delivered' | 'insight_approved' | 'action_assigned'
  text: string
  time: string
  work_type_label?: string
}

interface PendingAction {
  id: string
  description: string
  due_date: string
  source_type: string
  status: string
}

// ─── DATA THIS PAGE READS ─────────────────────────────────────────────────────
// GET /api/talks?worksite_id=:id&status=generated        → pending_talk
// GET /api/observations?worksite_id=:id&limit=5          → recent_observations
// GET /api/talks?worksite_id=:id&status=delivered&limit=5 → recent_talks
// GET /api/actions?assigned_to=:user_id&status=open       → pending_actions
// GET /api/analytics/atrophy?worksite_id=:id             → site_stats

// ─── DATA THIS PAGE WRITES ────────────────────────────────────────────────────
// Nothing — navigation only

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function SupervisorHome() {
  // In production: replace with useQuery hooks or server component data fetching
  const user = MOCK_USER
  const pendingTalk: PendingTalk = {
    id: MOCK_TALK.id,
    work_type_label: MOCK_TALK.work_type_label,
    generated_minutes_ago: 32,
    attendee_count: 14,
    insight_id: MOCK_TALK.insight_id!,
  }
  const pendingActions: PendingAction[] = MOCK_ACTIONS.map(a => ({
    id: a.id,
    description: a.description,
    due_date: a.due_date,
    source_type: a.source_type,
    status: a.status,
  }))
  const activityFeed: ActivityItem[] = [
    { type: 'observation', text: 'Near-miss logged — Heavy Vehicle Operation', time: '2h ago', work_type_label: 'Heavy Vehicle' },
    { type: 'insight_approved', text: 'Critical Insight approved — Spotter management pattern', time: '4h ago' },
    { type: 'talk_delivered', text: 'Toolbox talk delivered — 14 crew reached', time: 'Yesterday', work_type_label: 'Heavy Vehicle' },
  ]
  const stats = { talks_this_week: 2, crew_reached_this_week: 28 }

  return (
    <WireframePage
      title="Supervisor Home"
      route="/supervisor/home"
      user={user}
      entities={[
        { name: 'ToolboxTalk', source: 'GET /api/talks?status=generated', description: 'Pending talk — primary CTA' },
        { name: 'Observation', source: 'GET /api/observations?limit=5', description: 'Recent activity feed' },
        { name: 'CorrectiveAction', source: 'GET /api/actions?assigned_to=me&status=open', description: 'Pending check-offs' },
      ]}
    >

      {/* ENTITY: User greeting */}
      <EntityBlock label="User Context" entity="User" fields={[
        { key: 'name', value: user.name },
        { key: 'role', value: user.role },
        { key: 'worksite_name', value: user.worksite_name },
      ]} />

      {/* ENTITY: ToolboxTalk (pending) — primary action */}
      <EntityBlock label="Pending Talk — Primary CTA" entity="ToolboxTalk" highlight>
        <FieldRow k="id" v={pendingTalk.id} />
        <FieldRow k="work_type_label" v={pendingTalk.work_type_label} />
        <FieldRow k="generated_minutes_ago" v={`${pendingTalk.generated_minutes_ago}m`} />
        <FieldRow k="attendee_count (expected)" v={pendingTalk.attendee_count} />
        <FieldRow k="status" v="generated" tag="pending" />
        <ActionBadge label="→ Navigate to /supervisor/talk/:id" />
      </EntityBlock>

      {/* ENTITY: Stats (aggregated) */}
      <EntityBlock label="Stat Tiles (aggregated queries)" entity="ToolboxTalk + Observation">
        <FieldRow k="talks_this_week" v={stats.talks_this_week} />
        <FieldRow k="crew_reached_this_week" v={stats.crew_reached_this_week} />
      </EntityBlock>

      {/* ENTITY: Activity feed */}
      <EntityBlock label="Activity Feed" entity="Observation + ToolboxTalk + CriticalInsight">
        {activityFeed.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px dashed #eee', padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12 }}>
              <TypeBadge type={item.type} /> {item.text}
            </span>
            <span style={{ fontSize: 11, color: '#888' }}>{item.time}</span>
          </div>
        ))}
      </EntityBlock>

      {/* ENTITY: CorrectiveAction */}
      <EntityBlock label="Pending Actions (check-off)" entity="CorrectiveAction">
        {pendingActions.map(a => (
          <div key={a.id} style={{ borderBottom: '1px dashed #eee', padding: '6px 0' }}>
            <FieldRow k="description" v={a.description} />
            <FieldRow k="due_date" v={new Date(a.due_date).toLocaleDateString()} />
            <FieldRow k="status" v={a.status} tag="open" />
            <ActionBadge label="PATCH /api/actions/:id/complete" />
          </div>
        ))}
      </EntityBlock>

      {/* NAVIGATION SHORTCUTS */}
      <EntityBlock label="Navigation" entity="—">
        <ActionBadge label="Log Observation → /supervisor/capture?type=observation" />
        <ActionBadge label="Report Incident → /supervisor/capture?type=incident" />
      </EntityBlock>

    </WireframePage>
  )
}

// ─── WIREFRAME PRIMITIVES ─────────────────────────────────────────────────────
// Shared display components — replace with kit components when building for real

function WireframePage({ title, route, user, entities, children }: {
  title: string
  route: string
  user: typeof MOCK_USER
  entities: { name: string; source: string; description: string }[]
  children: React.ReactNode
}) {
  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 480, margin: '0 auto', background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '12px 16px', fontSize: 11 }}>
        <div style={{ opacity: 0.5, marginBottom: 4 }}>WIREFRAME · {route}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <div style={{ opacity: 0.6, marginTop: 2 }}>Role: {user.role} · {user.worksite_name}</div>
      </div>

      <div style={{ background: '#f0f0ff', borderBottom: '1px solid #d0d0ff', padding: '8px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, color: '#5555aa' }}>ENTITIES READ BY THIS VIEW</div>
        {entities.map(e => (
          <div key={e.name} style={{ fontSize: 10, marginBottom: 3, color: '#333' }}>
            <span style={{ background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2, marginRight: 5 }}>{e.name}</span>
            <span style={{ color: '#666' }}>{e.source}</span>
            <span style={{ color: '#999', marginLeft: 5 }}>— {e.description}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px' }}>{children}</div>

      <div style={{ borderTop: '1px solid #eee', padding: '12px 16px', display: 'flex', gap: 8, background: 'white' }}>
        {['Home', 'Talk', 'Capture', 'Records'].map(tab => (
          <div key={tab} style={{ flex: 1, textAlign: 'center', fontSize: 10, padding: '6px 0', background: tab === 'Home' ? '#1a1a2e' : '#f5f5f5', color: tab === 'Home' ? 'white' : '#666', borderRadius: 4 }}>
            {tab}
          </div>
        ))}
      </div>
    </div>
  )
}

function EntityBlock({ label, entity, highlight = false, fields, children }: {
  label: string
  entity: string
  highlight?: boolean
  fields?: { key: string; value: any }[]
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: 'white', border: `2px solid ${highlight ? '#1a1a2e' : '#e0e0e0'}`, borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ background: highlight ? '#1a1a2e' : '#f5f5f5', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: highlight ? 'white' : '#333' }}>{label}</span>
        <span style={{ fontSize: 9, background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2 }}>{entity}</span>
      </div>
      <div style={{ padding: '8px 10px' }}>
        {fields?.map(f => <FieldRow key={f.key} k={f.key} v={f.value} />)}
        {children}
      </div>
    </div>
  )
}

function FieldRow({ k, v, tag }: { k: string; v: any; tag?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, color: '#0080aa', minWidth: 160, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 11, color: '#333', lineHeight: 1.4 }}>{String(v)}</span>
      {tag && <span style={{ fontSize: 9, background: '#fff3cd', color: '#856404', padding: '1px 5px', borderRadius: 2, flexShrink: 0 }}>{tag}</span>}
    </div>
  )
}

function ActionBadge({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, color: '#1a6e1a', background: '#f0fff0', border: '1px solid #aaffaa', borderRadius: 3, padding: '3px 7px', marginTop: 4, display: 'inline-block' }}>
      {label}
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    observation: '#ff9900',
    talk_delivered: '#0080aa',
    insight_approved: '#5555aa',
    action_assigned: '#cc4400',
  }
  return (
    <span style={{ fontSize: 9, background: colors[type] || '#999', color: 'white', padding: '1px 4px', borderRadius: 2, marginRight: 4 }}>
      {type.replace('_', ' ')}
    </span>
  )
}
