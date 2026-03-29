// src/pages/safety/analytics.tsx
// WIREFRAME — Safety Manager Analytics. Pipeline health + leading indicators.
// Shows what entities are aggregated and how metrics are derived.

import { MOCK_SAFETY_MANAGER, MOCK_PIPELINE_STATS } from '@/data/mock'

// ─── DATA THIS PAGE READS ─────────────────────────────────────────────────────
// GET /api/analytics/pipeline?scope=region&period=30d    → pipeline funnel
// GET /api/analytics/leading?scope=region&period=30d     → stat tiles
// GET /api/analytics/atrophy?scope=region                → heatmap data
// GET /api/analytics/insights?scope=region&period=30d    → insight source breakdown

export default function AnalyticsPage() {
  const stats = MOCK_PIPELINE_STATS

  const funnelStages = [
    { label: 'Observations', count: stats.observations, source: 'COUNT(observation)', color: '#1a1a2e' },
    { label: 'Enriched by AI', count: stats.enriched, source: 'COUNT(observation WHERE ai_enriched_at IS NOT NULL)', color: '#334' },
    { label: 'Near-misses', count: stats.near_misses, source: "COUNT(observation WHERE observation_type='near-miss')", color: '#d97706' },
    { label: 'Insights generated', count: stats.insights_generated, source: 'COUNT(critical_insight)', color: '#7c3aed' },
    { label: 'Insights approved', count: stats.insights_approved, source: "COUNT(critical_insight WHERE cleared_for_toolbox=true)", color: '#5b21b6' },
    { label: 'Talks generated', count: stats.talks_generated, source: 'COUNT(toolbox_talk)', color: '#0369a1' },
    { label: 'Talks delivered', count: stats.talks_delivered, source: "COUNT(toolbox_talk WHERE status='delivered')", color: '#0891b2' },
    { label: 'Crew reached', count: stats.crew_reached, source: 'SUM(toolbox_talk.attendee_count)', color: '#059669' },
  ]

  return (
    <div style={{ fontFamily: 'monospace', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ opacity: 0.4, fontSize: 10, marginRight: 8 }}>WIREFRAME · /safety/analytics</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Analytics — Pipeline Health & Leading Indicators</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>Period: {stats.period} · Scope: North Region</div>
      </div>

      <div style={{ padding: '16px 20px', maxWidth: 1100 }}>

        {/* STAT TILES */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px', marginBottom: 16 }}>
          <SectionHeader label="Leading Indicator Stat Tiles" source="Multiple aggregated queries" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
            <StatCard label="Near-miss rate" value={`${stats.near_miss_rate}%`} source="near_miss_count / observation_count" color="#d97706" note="of all observations" />
            <StatCard label="Stop-work events" value={stats.stop_work_events} source="COUNT(observation WHERE stop_work_called=true)" color="#dc2626" note="in period" />
            <StatCard label="Sites atrophy >50" value={stats.sites_atrophy_over_50} source="COUNT(atrophy_score_log WHERE score > 50)" color="#dc2626" note="need attention" />
            <StatCard label="Visit coverage" value={`${stats.visit_coverage}%`} source="sites_visited_30d / total_sites" color="#059669" note="sites visited" />
          </div>
        </div>

        {/* PIPELINE FUNNEL */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px', marginBottom: 16 }}>
          <SectionHeader label="Pipeline Funnel — 7 Stages" source="GET /api/analytics/pipeline" />
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 12, height: 140 }}>
            {funnelStages.map((stage, i) => {
              const pct = Math.round((stage.count / funnelStages[0].count) * 100)
              const height = Math.max(20, pct)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: stage.color }}>{stage.count}</div>
                  <div style={{ width: '100%', height: height, background: stage.color, borderRadius: '3px 3px 0 0', opacity: 0.85 }}></div>
                  <div style={{ fontSize: 9, textAlign: 'center', color: '#666', lineHeight: 1.2 }}>{stage.label}</div>
                  <div style={{ fontSize: 9, color: '#aaa' }}>{i > 0 ? `${Math.round((stage.count / funnelStages[i-1].count) * 100)}%` : ''}</div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#888', marginBottom: 6 }}>SQL SOURCES PER STAGE</div>
            {funnelStages.map((s, i) => (
              <div key={i} style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>
                <span style={{ color: '#0080aa', minWidth: 140, display: 'inline-block' }}>{s.label}:</span>
                <code style={{ background: '#f5f5f5', padding: '0 4px', borderRadius: 2 }}>{s.source}</code>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* CORRECTIVE ACTIONS */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px' }}>
            <SectionHeader label="Corrective Action Close Rate" source="GET /api/analytics/actions" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
              <StatCard label="Total" value={stats.corrective_actions_total} source="COUNT(corrective_action)" color="#333" note="" />
              <StatCard label="Complete" value={stats.corrective_actions_complete} source="WHERE status='complete'" color="#059669" note="" />
              <StatCard label="Close rate" value={`${Math.round((stats.corrective_actions_complete / stats.corrective_actions_total) * 100)}%`} source="complete / total" color="#0891b2" note="" />
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: '#666' }}>
              close_rate = COUNT(status='complete') / COUNT(id) × 100<br/>
              Overdue = WHERE due_date {'<'} NOW() AND status != 'complete'
            </div>
          </div>

          {/* FORGE WORKS PLACEHOLDER */}
          <div style={{ background: 'white', border: '2px dashed #c0c0ff', borderRadius: 6, padding: '14px' }}>
            <SectionHeader label="Forge Works Map® Capacity Signal" source="fw_* fields on critical_insight + enquiry" />
            <div style={{ marginTop: 10, background: '#f5f5ff', border: '1px solid #d0d0ff', borderRadius: 5, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🗺️</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#5555aa', marginBottom: 4 }}>Building Capacity Profile</div>
              <div style={{ fontSize: 11, color: '#777' }}>
                {stats.fw_classified} of {stats.fw_classification_needed} classified findings needed
              </div>
              <div style={{ background: '#e0e0f0', borderRadius: 3, height: 6, margin: '8px 0', overflow: 'hidden' }}>
                <div style={{ background: '#5555aa', height: '100%', width: `${(stats.fw_classified / stats.fw_classification_needed) * 100}%` }}></div>
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                Full view unlocks when 5+ insights or investigations have been classified by the fw_classify job with confidence ≥ 0.70
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
              V2: domain summary (Guide/Enable/Execute), factor detail (15 factors), maturity signal trend table.<br/>
              Data source: fw_factor, fw_domain, fw_maturity_signal columns on critical_insight + enquiry.
            </div>
          </div>

          {/* INSIGHT SOURCE BREAKDOWN */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px' }}>
            <SectionHeader label="Insight Source Breakdown" source="GROUP BY trigger_source ON critical_insight" />
            <div style={{ marginTop: 10 }}>
              {[
                { source: 'algorithm', count: 2, color: '#1a1a2e' },
                { source: 'manual', count: 1, color: '#d97706' },
                { source: 'external_alert', count: 0, color: '#0891b2' },
                { source: 'external_investigation', count: 0, color: '#5b21b6' },
              ].map(s => (
                <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, background: s.color, color: 'white', padding: '1px 6px', borderRadius: 2, minWidth: 80, textAlign: 'center' }}>{s.source}</span>
                  <div style={{ flex: 1, background: '#f0f0f0', height: 14, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ background: s.color, height: '100%', width: `${s.count > 0 ? Math.max(10, (s.count / 3) * 100) : 0}%`, opacity: 0.7 }}></div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 16 }}>{s.count}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                Amber flag if manual ≥ 40% — signals observation capture adoption issue.<br/>
                Currently: manual = 33% — within normal range.
              </div>
            </div>
          </div>

          {/* ATROPHY HEATMAP NOTE */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '14px' }}>
            <SectionHeader label="Atrophy Heatmap" source="atrophy_score_log — sites × weeks" />
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>
                Rows: worksites in scope | Columns: weeks | Cell colour = activity level
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                {/* Simulated heatmap cells */}
                {['ws-001','ws-002','ws-003','ws-004'].map(ws =>
                  [0,1,2,3,4,5].map(week => {
                    const score = Math.floor(Math.random() * 100)
                    const bg = score > 70 ? '#dc2626' : score > 40 ? '#d97706' : '#059669'
                    return <div key={`${ws}-${week}`} style={{ height: 20, background: bg, borderRadius: 2, opacity: 0.7 }}></div>
                  })
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 10, background: '#dc2626', borderRadius: 1, display: 'inline-block' }}></span> Atrophy &gt;70</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 10, background: '#d97706', borderRadius: 1, display: 'inline-block' }}></span> 40–70</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 10, background: '#059669', borderRadius: 1, display: 'inline-block' }}></span> &lt;40</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: '#555' }}>
                Source: atrophy_score_log — one row per worksite per day.<br/>
                Query: GROUP BY worksite_id, week → MAX(score) per cell.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

function SectionHeader({ label, source }: { label: string; source: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#888' }}>{source}</div>
    </div>
  )
}

function StatCard({ label, value, source, color, note }: { label: string; value: any; source: string; color: string; note: string }) {
  return (
    <div style={{ background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 5, padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {note && <div style={{ fontSize: 9, color: '#aaa', marginBottom: 4 }}>{note}</div>}
      <div style={{ fontSize: 9, color: '#888', background: '#f0f0f0', borderRadius: 3, padding: '2px 4px' }}>{source}</div>
    </div>
  )
}
