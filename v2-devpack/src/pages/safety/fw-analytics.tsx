// src/pages/safety/fw-analytics.tsx
// WIREFRAME — Forge Works Map® Full Analytics View (V2)
// Shows domain summary, factor detail table, maturity trend, factor drill-down
// All powered by fw_* arrays already populated in V1 — no new data collection

import { MOCK_SAFETY_MANAGER } from '@/data/mock'

// ─── DATA THIS PAGE READS ─────────────────────────────────────────────────────
// GET /api/analytics/fw-capacity?scope=region&period=90d
//   → domain_summary, factor_detail[], classification_coverage
// GET /api/analytics/fw-factors/:factor
//   → findings[] tagged to this factor with rationales (drill-down)
// GET /api/analytics/insights?scope=region  → source breakdown

// ─── MINIMUM DATA REQUIREMENT ─────────────────────────────────────────────────
// >= 5 classified findings (insights or investigations with fw_classified_at set)
// Below this threshold: show building state, not empty analytics

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_FW_DATA = {
  classification_coverage: { classified: 8, eligible: 11, pct: 73 },
  domain_summary: [
    { domain: 'enable', count: 12, pct: 55, color: '#7635DC' },
    { domain: 'execute', count: 6, pct: 27, color: '#059669' },
    { domain: 'guide', count: 4, pct: 18, color: '#0891b2' },
  ],
  factors: [
    { factor: 'management_systems', domain: 'enable', count: 7, maturity: 'compliant', trend: 'stable', last_seen: '2 days ago' },
    { factor: 'operational_management', domain: 'enable', count: 4, maturity: 'compliant', trend: 'stable', last_seen: '5 days ago' },
    { factor: 'frontline_workers', domain: 'execute', count: 3, maturity: 'leading', trend: 'improving', last_seen: '1 week ago' },
    { factor: 'work_understanding', domain: 'guide', count: 3, maturity: 'compliant', trend: 'stable', last_seen: '3 days ago' },
    { factor: 'communications_coordination', domain: 'execute', count: 2, maturity: 'compliant', trend: 'declining', last_seen: '2 weeks ago' },
    { factor: 'monitoring_metrics', domain: 'execute', count: 1, maturity: 'compliant', trend: 'stable', last_seen: '3 weeks ago' },
  ],
  source_breakdown: { algorithm: 6, manual: 1, external_alert: 1, external_investigation: 0 },
  drill_down_factor: 'management_systems',
  drill_down_findings: [
    { title: 'Spotter management — 6 near-misses · North Region', type: 'insight', date: '2 days ago', confidence: 0.86, rationale: 'The PTW and pre-task brief exist but neither covers spotter continuity — the system doesn\'t enforce what it doesn\'t specify.' },
    { title: 'INC-0091 — Fracture, Working at Height', type: 'investigation', date: '5 days ago', confidence: 0.91, rationale: 'The PTW and pre-task brief exist but their content does not cover the harness management scenario workers actually encounter.' },
    { title: 'PTW sign-on atrophy — Central Rail', type: 'insight', date: '1 week ago', confidence: 0.78, rationale: 'Pre-task briefs are present but workers are not reading permit conditions before starting — gap in system enforcement, not awareness.' },
  ]
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function FwAnalytics() {
  const user = MOCK_SAFETY_MANAGER
  const fw = MOCK_FW_DATA
  const domainColors: Record<string, string> = { guide: '#0891b2', enable: '#7635DC', execute: '#059669' }
  const maturityColors: Record<string, string> = { compliant: '#d97706', leading: '#0891b2', resilient: '#059669' }
  const trendIcons: Record<string, string> = { improving: '↑', stable: '→', declining: '↓' }
  const trendColors: Record<string, string> = { improving: '#059669', stable: '#637381', declining: '#dc2626' }

  return (
    <div style={{ fontFamily: 'monospace', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a2e', color: '#e8ecf8', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ opacity: 0.4, fontSize: 10, marginRight: 8 }}>WIREFRAME · /safety/analytics/fw-capacity</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Forge Works Map® — Capacity Analytics (V2)</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{user.name} · {user.scope} · 90 days</div>
      </div>

      {/* ENTITY READ BANNER */}
      <div style={{ background: '#f0f0ff', borderBottom: '1px solid #d0d0ff', padding: '6px 20px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#444' }}><span style={{ background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2, marginRight: 4 }}>CriticalInsight</span>fw_factors[] WHERE fw_classified_at IS NOT NULL</span>
        <span style={{ fontSize: 10, color: '#444' }}><span style={{ background: '#5555aa', color: 'white', padding: '1px 5px', borderRadius: 2, marginRight: 4 }}>Investigation</span>fw_factors[] WHERE fw_classified_at IS NOT NULL</span>
        <span style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>V1 note: wire GET /api/analytics/fw-capacity in V1 returning empty state — V2 populates it</span>
      </div>

      <div style={{ padding: '16px 20px', maxWidth: 1100 }}>

        {/* CLASSIFICATION COVERAGE */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>Classification Coverage</div>
            <div style={{ fontSize: 11, color: '#666' }}>{fw.classification_coverage.classified} of {fw.classification_coverage.eligible} eligible findings classified · {fw.classification_coverage.pct}%</div>
          </div>
          <div style={{ background: '#f0f0f0', borderRadius: 6, height: 8, width: 200, overflow: 'hidden' }}>
            <div style={{ background: '#5555aa', height: '100%', width: `${fw.classification_coverage.pct}%` }}></div>
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>fw_confidence ≥ 0.70 · max 3 factors per finding</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, marginBottom: 14 }}>

          {/* DOMAIN SUMMARY */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>Domain Distribution</div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>unnest(fw_domains) GROUP BY domain</div>
            {fw.domain_summary.map(d => (
              <div key={d.domain} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: d.color, textTransform: 'uppercase' }}>{d.domain}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{d.count}</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: 3, height: 10, overflow: 'hidden' }}>
                  <div style={{ background: d.color, height: '100%', width: `${d.pct}%`, opacity: 0.8 }}></div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10, fontSize: 10, color: '#888', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
              A finding tagged to multiple factors contributes to each domain it appears in.
            </div>
          </div>

          {/* FACTOR DETAIL TABLE */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>Factor Detail — Ranked by Frequency</span>
              <span style={{ fontSize: 10, color: '#888' }}>Tap factor to drill down → rationales visible</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {['Factor', 'Domain', 'Appearances', 'Current Maturity', '90d Trend', 'Last Seen'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#888', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fw.factors.map((f, i) => (
                  <tr key={f.factor} style={{ background: f.factor === fw.drill_down_factor ? '#f5f0ff' : 'white', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.factor}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: 'rgba(0,0,0,0.05)', color: domainColors[f.domain], padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{f.domain.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{f.count}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: maturityColors[f.maturity], fontWeight: 600 }}>{f.maturity}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: trendColors[f.trend], fontWeight: 700 }}>
                      {trendIcons[f.trend]} {f.trend}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#888' }}>{f.last_seen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FACTOR DRILL-DOWN */}
        <div style={{ background: 'white', border: '2px solid #5555aa', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: '#5555aa', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>management_systems — 7 findings · ENABLE · Compliant</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>GET /api/analytics/fw-factors/management_systems</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {fw.drill_down_findings.map((f, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, background: f.type === 'insight' ? '#eeeeff' : '#fff3cd', color: f.type === 'insight' ? '#5555aa' : '#856404', padding: '1px 6px', borderRadius: 3 }}>{f.type}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{f.title}</span>
                  <span style={{ fontSize: 10, color: '#888', marginLeft: 'auto' }}>{f.date}</span>
                  <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>{f.confidence} ✓</span>
                </div>
                {/* RATIONALE — inline, not a tooltip */}
                <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic', background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 4, padding: '6px 10px' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#5555aa', marginRight: 6, fontStyle: 'normal' }}>WHY TAGGED:</span>
                  {f.rationale}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 14px', background: '#f9f8ff', fontSize: 10, color: '#888' }}>
            Rationale shown inline — not in tooltip. This is the defence for the tag. fw_rationales[i] explains fw_factors[i].
          </div>
        </div>

        {/* SOURCE BREAKDOWN */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Insight Source Breakdown</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {Object.entries(fw.source_breakdown).map(([k, v]) => (
              <div key={k} style={{ background: '#f5f5f5', borderRadius: 5, padding: '8px 12px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v as number}</div>
                <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#888' }}>
            Amber flag if manual ≥ 40% — signals observation capture adoption issue. Currently: {Math.round(fw.source_breakdown.manual / Object.values(fw.source_breakdown).reduce((a,b) => (a as number)+(b as number), 0) as unknown as number * 100)}% manual — within normal range.
          </div>
        </div>

      </div>
    </div>
  )
}
