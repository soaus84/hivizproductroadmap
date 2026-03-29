// src/pages/manager/visits.tsx
// WIREFRAME — Manager Visit Workflow. Plan → Active → Close.
// Shows atrophy-ranked sites and visit plan entity.

import { MOCK_MANAGER, MOCK_SITES, MOCK_VISIT } from '@/data/mock'

// ─── DATA THIS PAGE READS ─────────────────────────────────────────────────────
// GET /api/analytics/atrophy?scope=region     → sites with atrophy scores
// GET /api/visits?manager_id=me&status=active → active visit if any

// ─── DATA THIS PAGE WRITES ────────────────────────────────────────────────────
// POST /api/visits  { worksite_id, planned_date }  → creates VisitPlan, queues topic recommendation
// PATCH /api/visits/:id  { status: 'active' }      → Start Visit
// PATCH /api/visits/:id  { status: 'completed' }   → Close Visit → atrophy recalculates

export default function ManagerVisits() {
  const user = MOCK_MANAGER

  return (
    <MobileWireframePage
      title="My Sites — Visit Planning"
      route="/manager/visits"
      user={user}
      entities={[
        { name: 'AtrophyScoreLog', source: 'GET /api/analytics/atrophy?scope=region', description: 'Ranked site list' },
        { name: 'VisitPlan', source: 'GET /api/visits?manager_id=me&status=active', description: 'Active visit if any' },
      ]}
      activeTab="Visits"
    >
      {/* Summary stats */}
      <EntityBlock2 label="Portfolio Summary (aggregated)" entity="AtrophyScoreLog + VisitPlan">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
          <StatTile label="Needs attention" value="2" color="#dc2626" />
          <StatTile label="Visited this month" value="1" color="#059669" />
        </div>
      </EntityBlock2>

      {/* Site list */}
      <EntityBlock2 label="Sites — Ranked by Atrophy Score" entity="AtrophyScoreLog + Worksite">
        {MOCK_SITES.sort((a, b) => b.atrophy_score - a.atrophy_score).map(site => (
          <SiteCard key={site.id} site={site} />
        ))}
      </EntityBlock2>

      {/* Visit plan entity */}
      <EntityBlock2 label="VisitPlan Entity — Plan Phase" entity="VisitPlan" highlight>
        <FieldRow3 k="id" v={MOCK_VISIT.id} />
        <FieldRow3 k="manager_id" v={MOCK_VISIT.manager_id} />
        <FieldRow3 k="worksite_id" v={MOCK_VISIT.worksite_id} />
        <FieldRow3 k="worksite_name" v={MOCK_VISIT.worksite_name} />
        <FieldRow3 k="status" v={MOCK_VISIT.status} tag="planned" />
        <FieldRow3 k="planned_date" v={new Date(MOCK_VISIT.planned_date).toLocaleDateString()} />
        <FieldRow3 k="atrophy_score_at_plan" v={MOCK_VISIT.atrophy_score_at_plan} />

        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #eee' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginBottom: 6 }}>RECOMMENDED TOPICS (AI-generated)</div>
          {MOCK_VISIT.recommended_topics.map((t, i) => (
            <div key={i} style={{ marginBottom: 5, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t.topic}</span>
                <SourceBadge type={t.sourceType} />
              </div>
              <div style={{ fontSize: 10, color: '#888' }}>{t.source}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>VisitPlan.recommended_topics field (JSONB):</div>
          <pre style={{ fontSize: 9, background: '#f5f5f5', padding: 6, borderRadius: 4, overflow: 'auto' }}>
{JSON.stringify(MOCK_VISIT.recommended_topics[0], null, 2)}
          </pre>
        </div>
      </EntityBlock2>

      {/* Status lifecycle */}
      <EntityBlock2 label="VisitPlan Status Lifecycle" entity="VisitPlan">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          {['planned', 'active', 'completed', 'cancelled'].map((s, i, arr) => (
            <>
              <span key={s} style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: s === 'planned' ? '#dbeafe' : s === 'active' ? '#fef3c7' : s === 'completed' ? '#d1fae5' : '#fee2e2',
                color: s === 'planned' ? '#1e40af' : s === 'active' ? '#92400e' : s === 'completed' ? '#065f46' : '#991b1b'
              }}>{s}</span>
              {i < arr.length - 1 && <span style={{ color: '#aaa' }}>→</span>}
            </>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#666', marginTop: 6 }}>
          planned → active: PATCH /api/visits/:id {'{'}status: active{'}'} (Start Visit tapped)<br/>
          active → completed: PATCH /api/visits/:id {'{'}status: completed{'}'} (Close Visit tapped)<br/>
          On completed: atrophy.calculate job fires for this worksite
        </div>
      </EntityBlock2>

      {/* Active visit observation capture note */}
      <EntityBlock2 label="Active Visit — Observation Capture" entity="Observation">
        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
          During an active visit (status = active), observations are captured via the same
          Capture form as supervisors. The visit_id is auto-set on the observation record.
          Topic prompts from VisitPlan.selected_topics are shown above the free text field.
          Observations tagged to this visit feed the trend pipeline on visit close.
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: '#0080aa' }}>
          Observation.visit_id → VisitPlan.id (FK)
        </div>
      </EntityBlock2>

    </MobileWireframePage>
  )
}

// ─── SITE CARD ────────────────────────────────────────────────────────────────

function SiteCard({ site }: { site: typeof MOCK_SITES[0] }) {
  const level = site.atrophy_score >= 70 ? 'red' : site.atrophy_score >= 40 ? 'amber' : 'green'
  const colors = { red: '#dc2626', amber: '#d97706', green: '#059669' }

  return (
    <div style={{ border: `1px solid ${colors[level]}`, borderRadius: 5, padding: '8px 10px', marginBottom: 8, borderLeft: `4px solid ${colors[level]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{site.name}</div>
          <div style={{ fontSize: 10, color: '#888' }}>{site.subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors[level] }}>{site.atrophy_score}</div>
          <div style={{ fontSize: 9, color: '#aaa' }}>atrophy</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: '#666' }}>
        <span>📍 {site.days_since_last_obs}d no obs</span>
        <span>🔍 {site.open_investigations} open</span>
        <span>⚠️ {site.near_miss_30d} NM</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: '#0080aa' }}>
        POST /api/visits {'{'} worksite_id: "{site.id}", planned_date: "..." {'}'}
      </div>
    </div>
  )
}

function SourceBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    trend: { bg: '#fee2e2', text: '#991b1b' },
    investigation: { bg: '#fef3c7', text: '#92400e' },
    ai: { bg: '#f3e8ff', text: '#6b21a8' },
  }
  const c = colors[type] || { bg: '#f5f5f5', text: '#666' }
  return <span style={{ fontSize: 9, background: c.bg, color: c.text, padding: '1px 5px', borderRadius: 2 }}>{type}</span>
}

// ─── WIREFRAME PRIMITIVES (MOBILE) ────────────────────────────────────────────

function MobileWireframePage({ title, route, user, entities, activeTab, children }: any) {
  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 480, margin: '0 auto', background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '12px 16px', fontSize: 11 }}>
        <div style={{ opacity: 0.5, marginBottom: 4 }}>WIREFRAME · {route}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <div style={{ opacity: 0.6, marginTop: 2 }}>{user.name} · {user.scope}</div>
      </div>
      <div style={{ background: '#f0f0ff', borderBottom: '1px solid #d0d0ff', padding: '6px 12px' }}>
        {entities.map((e: any) => (
          <div key={e.name} style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>
            <span style={{ background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2, marginRight: 4 }}>{e.name}</span>
            {e.source}
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
      <div style={{ borderTop: '1px solid #eee', padding: '10px 14px', display: 'flex', gap: 8, background: 'white', position: 'sticky', bottom: 0 }}>
        {['Visits', 'Capture', 'Insights', 'Records'].map(tab => (
          <div key={tab} style={{ flex: 1, textAlign: 'center', fontSize: 10, padding: '6px 0', background: tab === activeTab ? '#1a1a2e' : '#f5f5f5', color: tab === activeTab ? 'white' : '#666', borderRadius: 4 }}>{tab}</div>
        ))}
      </div>
    </div>
  )
}

function EntityBlock2({ label, entity, highlight = false, children }: any) {
  return (
    <div style={{ background: 'white', border: `2px solid ${highlight ? '#1a1a2e' : '#e0e0e0'}`, borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ background: highlight ? '#1a1a2e' : '#f5f5f5', padding: '6px 10px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: highlight ? 'white' : '#333' }}>{label}</span>
        <span style={{ fontSize: 9, background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2 }}>{entity}</span>
      </div>
      <div style={{ padding: '8px 10px' }}>{children}</div>
    </div>
  )
}

function FieldRow3({ k, v, tag }: { k: string; v: any; tag?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, color: '#0080aa', minWidth: 140, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 11, color: '#333', lineHeight: 1.4 }}>{String(v)}</span>
      {tag && <span style={{ fontSize: 9, background: '#fff3cd', color: '#856404', padding: '1px 5px', borderRadius: 2 }}>{tag}</span>}
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#888' }}>{label}</div>
    </div>
  )
}
