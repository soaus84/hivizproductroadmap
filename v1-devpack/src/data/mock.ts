// src/data/mock.ts
// Static data for wireframe pages. Replace with real API calls.

export const MOCK_USER = {
  id: 'u-001',
  name: 'Marcus Reyes',
  initials: 'MR',
  role: 'supervisor' as const,
  worksite_id: 'ws-001',
  worksite_name: 'Riverside Tower',
}

export const MOCK_SAFETY_MANAGER = {
  id: 'u-002',
  name: 'Sarah Thompson',
  initials: 'ST',
  role: 'safety_manager' as const,
  scope: 'North Region',
}

export const MOCK_MANAGER = {
  id: 'u-003',
  name: 'James Wong',
  initials: 'JW',
  role: 'manager' as const,
  scope: 'North Region',
}

export const MOCK_WORK_TYPES = [
  { id: 'wt-001', label: 'Heavy Vehicle Operation' },
  { id: 'wt-002', label: 'Working at Height' },
  { id: 'wt-003', label: 'Hot Work' },
  { id: 'wt-004', label: 'Confined Space' },
  { id: 'wt-005', label: 'Blasting' },
  { id: 'wt-006', label: 'Electrical' },
]

export const MOCK_OBSERVATION = {
  id: 'obs-001',
  observer_id: 'u-001',
  observer_role: 'supervisor',
  worksite_id: 'ws-001',
  worksite_name: 'Riverside Tower',
  work_type_id: 'wt-001',
  work_type_label: 'Heavy Vehicle Operation',
  observed_at: new Date().toISOString(),
  observation_type: 'near-miss',
  what_was_observed:
    'Excavator reversed without a confirmed spotter in position. Spotter had moved to assist crane lift without informing the operator. No one in the blind zone by luck only.',
  immediate_action_taken: 'Stopped the operation and briefed the team.',
  stop_work_called: true,
  involved_role: 'operator',
  people_involved_count: 2,
  // AI enrichment (populated async — shown as pending in UI until job completes)
  ai_enriched_at: new Date().toISOString(),
  ai_failure_type: 'systemic',
  ai_key_hazard: 'Heavy vehicle reversing without active spotter — blind zone exposed',
  ai_severity_signal: 'near-miss',
  ai_stop_work_warranted: true,
  ai_enrichment_confidence: 0.91,
  cleared_for_sharing: true,
  sharing_scope: 'region',
  created_at: new Date().toISOString(),
}

export const MOCK_INSIGHT = {
  id: 'ci-042',
  trigger_source: 'algorithm',
  source_metadata: { observation_count: 6, site_count: 4, threshold: 5, window_days: 30 },
  source_observation_ids: ['obs-001', 'obs-002', 'obs-003', 'obs-004', 'obs-005', 'obs-006'],
  generated_at_level: 'region',
  scope_ref_id: 'region-north',
  worksite_id: 'ws-001',
  work_type_id: 'wt-001',
  work_type_label: 'Heavy Vehicle Operation',
  pattern_summary:
    'Six near-misses involving heavy vehicle spotters across four North Region sites in 28 days. In five of six cases the spotter was absent at the moment of the reversing movement — not because of negligence, but because spotter assignment and continuity are not systematically managed during operations.',
  likely_systemic_cause:
    'Spotter roles are treated as informal assignments — no system ensures continuity during reversing operations.',
  recommended_action:
    'Embed a spotter handover protocol into the PTW and pre-task brief template.',
  toolbox_narrative:
    "Six times in the last month, a heavy vehicle reversed without someone properly watching the blind zone. Six times. That's not bad luck — that's a system that isn't working. The common factor isn't the drivers. It's that we're not managing the spotter role the same way we manage everything else on site.",
  escalate_to_systemic: false,
  escalation_rationale: null,
  ai_generated_at: new Date(Date.now() - 3600000).toISOString(),
  reviewed_by_id: null,
  reviewed_at: null,
  review_action: null,
  cleared_for_toolbox: false,
  sharing_scope: 'region',
  // FW classification — pending until fw_classify job runs
  fw_factor: null,
  fw_domain: null,
  fw_maturity_signal: null,
  fw_confidence: null,
  fw_rationale: null,
  created_at: new Date(Date.now() - 3600000).toISOString(),
}

export const MOCK_INSIGHT_APPROVED = {
  ...MOCK_INSIGHT,
  id: 'ci-041',
  cleared_for_toolbox: true,
  reviewed_by_id: 'u-002',
  reviewed_at: new Date(Date.now() - 7200000).toISOString(),
  review_action: 'approved',
  // FW classification populated after fw_classify job
  fw_factor: 'management_systems',
  fw_domain: 'enable',
  fw_maturity_signal: 'compliant',
  fw_confidence: 0.86,
  fw_rationale:
    'The organisation has PTW and pre-task briefs but neither covers spotter continuity — the system exists but does not reflect how the work is actually done.',
  fw_classified_at: new Date(Date.now() - 3600000).toISOString(),
}

export const MOCK_TALK = {
  id: 'talk-001',
  worksite_id: 'ws-001',
  worksite_name: 'Riverside Tower',
  presenter_id: 'u-001',
  presenter_name: 'Marcus Reyes',
  work_type_id: 'wt-001',
  work_type_label: 'Heavy Vehicle Operation',
  insight_id: 'ci-041',
  status: 'generated',
  scheduled_for: null,
  delivered_at: null,
  generated_content: {
    hazard_intro:
      "We're working with heavy vehicles on levels 7–9 today. The single most important thing: blind zones during reversing. Someone needs to own that space — every single time.",
    main_content:
      "Six times in the last month across four of our sites, a heavy vehicle reversed without someone properly watching the blind zone. That's not bad luck — that's a system that isn't working. The common factor isn't the drivers. It's that we're not managing the spotter role the same way we manage everything else on site.",
    key_actions: [
      'Before any reversing movement: operator confirms spotter is in position and they have eye contact',
      "If you're the spotter and need to step away — tell the operator first, find a replacement before you go",
      'Spotter assignment is a controlled position, not an informal favour',
      'Any gap in the perimeter plan is raised immediately — not assumed someone else saw it',
    ],
    discussion_questions: [
      "Where are the blind zones in today's reversing path — and who is covering them?",
      'What happens if your assigned spotter gets pulled away mid-operation?',
      'Has anyone seen a reversing operation happen without a confirmed spotter this week?',
    ],
    closing_line: "Eyes open out there. If something doesn't look right, it probably isn't.",
  },
  attendee_ids: [],
  attendee_count: 0,
  created_at: new Date(Date.now() - 1800000).toISOString(),
}

export const MOCK_VISIT = {
  id: 'visit-001',
  manager_id: 'u-003',
  manager_name: 'James Wong',
  worksite_id: 'ws-001',
  worksite_name: 'Riverside Tower',
  status: 'planned',
  planned_date: new Date(Date.now() + 86400000).toISOString(),
  atrophy_score_at_plan: 79,
  recommended_topics: [
    { topic: 'Spotter positioning during reversing', source: '3 near-misses this month', sourceType: 'trend' },
    { topic: 'Hot work pre-task checklist', source: 'Open investigation INC-0088', sourceType: 'investigation' },
    { topic: 'PTW sign-on compliance', source: 'Practice atrophy — 14 days no PTW obs', sourceType: 'ai' },
    { topic: 'Harness inspection before WAH tasks', source: 'No WAH observation in 22 days', sourceType: 'ai' },
  ],
  selected_topics: ['Spotter positioning during reversing', 'Hot work pre-task checklist'],
  created_at: new Date().toISOString(),
}

export const MOCK_ENQUIRY = {
  id: 'enq-001',
  created_by: 'u-002',
  worksite_id: null,
  insight_id: 'ci-041',
  trigger_source: 'insight',
  title: 'Spotter management — how does it work on your site?',
  deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
  target_scope: 'region',
  status: 'active',
  recipient_count: 12,
  response_count: 7,
  questions: [
    {
      id: 'q-001',
      position: 1,
      question_text: 'How does spotter assignment actually work on your site — from when the task starts to when it\'s complete?',
      ai_rationale: 'Captures the gap between documented procedure and actual field practice.',
    },
    {
      id: 'q-002',
      position: 2,
      question_text: 'Is a designated spotter confirmed in position before any heavy vehicle reversing operation begins?',
      ai_rationale: 'Primary control check — verifies whether the root cause condition is being addressed.',
    },
    {
      id: 'q-003',
      position: 3,
      question_text: 'What would need to change for spotter management to work reliably every time — even when things get busy?',
      ai_rationale: 'Invites supervisors to name the specific gap themselves.',
    },
  ],
  synthesis_findings: [
    { icon: '🔴', text: '6 of 7 supervisors report no formal handover process exists for spotter responsibility.' },
    { icon: '🟠', text: 'Spotter assignment happens at the brief but there is no system to maintain it during the operation.' },
    { icon: '💡', text: 'Most common suggestion: embed spotter handover into the PTW before operations begin.' },
  ],
  dispatched_at: new Date(Date.now() - 86400000).toISOString(),
  created_at: new Date(Date.now() - 90000000).toISOString(),
}

export const MOCK_ACTIONS = [
  {
    id: 'act-001',
    worksite_id: 'ws-001',
    worksite_name: 'Riverside Tower',
    source_type: 'insight',
    insight_id: 'ci-041',
    description: 'Develop and embed a spotter handover protocol into the PTW and pre-task brief template.',
    assigned_to_id: 'u-001',
    assigned_to_name: 'Marcus Reyes',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: 'open',
    completed_at: null,
    completed_by: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'act-002',
    worksite_id: 'ws-001',
    worksite_name: 'Riverside Tower',
    source_type: 'insight',
    insight_id: 'ci-041',
    description: 'Update the STMP to define spotter positioning requirements explicitly.',
    assigned_to_id: 'u-001',
    assigned_to_name: 'Marcus Reyes',
    due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    status: 'open',
    completed_at: null,
    completed_by: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

export const MOCK_SITES = [
  { id: 'ws-001', name: 'Riverside Tower', subtitle: 'Phase 2', atrophy_score: 79, days_since_last_obs: 18, open_investigations: 2, near_miss_30d: 6, last_visit: '24 days ago' },
  { id: 'ws-002', name: 'Central Rail Depot', subtitle: 'Stage 3', atrophy_score: 54, days_since_last_obs: 12, open_investigations: 1, near_miss_30d: 2, last_visit: '11 days ago' },
  { id: 'ws-003', name: 'Harbour Bridge Retrofit', subtitle: 'Zone B', atrophy_score: 21, days_since_last_obs: 2, open_investigations: 0, near_miss_30d: 1, last_visit: '3 days ago' },
  { id: 'ws-004', name: 'Westport Hub', subtitle: 'Tower A', atrophy_score: 67, days_since_last_obs: 9, open_investigations: 1, near_miss_30d: 3, last_visit: '8 days ago' },
]

export const MOCK_PIPELINE_STATS = {
  period: '30 days',
  observations: 47,
  enriched: 44,
  near_misses: 18,
  insights_generated: 3,
  insights_approved: 2,
  talks_generated: 2,
  talks_delivered: 1,
  crew_reached: 14,
  corrective_actions_total: 5,
  corrective_actions_complete: 2,
  near_miss_rate: 38, // % of observations
  stop_work_events: 3,
  sites_atrophy_over_50: 2,
  visit_coverage: 67, // % of sites visited in 30d
  fw_classified: 1,
  fw_classification_needed: 5,
}
