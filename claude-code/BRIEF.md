# SafetyPlatform Demo — Build Brief

## What This Is

A clickable prototype demonstrating the SafetyPlatform intelligence loop. Four navigable flows. No database — all data is static TypeScript objects in `/src/data/`. The kit handles all navigation, layout, and component patterns. This brief defines screens, their purpose, their data, and their navigation targets only.

---

## Tech Stack

```
Framework:     Next.js 14 (App Router)
Language:      TypeScript
UI:            Minimal UI kit — read the kit first, use its components throughout
State:         React useState only
Data:          Static TypeScript objects in /src/data/
```

---

## Before You Write a Single Component

Read the kit. Run:
```bash
ls ../starter-vite-js/src/
find ../starter-vite-js/src -name "theme*" -o -name "palette*" | head -10
find ../starter-vite-js/src -name "index.*" | head -20
cat ../starter-vite-js/package.json | grep -A 30 '"dependencies"'
```

Copy the kit's theme into this project. Wrap the app in ThemeProvider. Verify a Button renders correctly before building any screen.

---

## Project Structure

```
src/
  app/
    layout.tsx              ← ThemeProvider, font, global baseline
    page.tsx                ← redirect to /supervisor/home
    supervisor/
      home/page.tsx
      talk/page.tsx
      capture/page.tsx
      record/page.tsx
    manager/
      visits/page.tsx
      visit-plan/page.tsx
    safety/
      workbench/page.tsx
      insight/page.tsx
      enquiry-builder/page.tsx
      enquiry-results/page.tsx
    investigation/
      page.tsx
      enquiry/page.tsx
  data/
    sites.ts
    talks.ts
    insights.ts
    enquiries.ts
    users.ts
  types/index.ts
```

---

## Navigation Structure

Use the kit's standard navigation patterns throughout. Do not invent custom navigation.

**Mobile screens** use the kit's bottom navigation component. Four tabs:
- Home (supervisor) / Visits (manager)
- Talk / Capture
- Capture / Insights
- Records

**Desktop screens** use the kit's dashboard layout with a persistent left sidebar. Nav sections:
- Main: Workbench, Analytics, Site Map
- Intelligence: Insights, Enquiries, Investigations, Actions
- Reports: Board Report

The layout shell — sidebar, topbar, content area — is a kit pattern. Use it as-is.

---

## Build Order

### Phase 1 — Foundation

1. Read the kit structure (commands above)
2. Copy theme into `src/theme/`, apply ThemeProvider in layout.tsx
3. Create data files and TypeScript types
4. Verify kit renders correctly with a test page

Do not build any screens until Phase 1 is verified.

---

### Phase 2 — Supervisor Flow

**Purpose of this flow:** Show what the platform looks like from the field. A supervisor's morning — check for a pending talk, deliver it to crew, log an observation.

---

**S1 — `/supervisor/home`**

Purpose: Morning dashboard. Surface the most important action and recent activity.

Needs to show:
- Pending talk card (work type, time since generated, crew count) — primary CTA
- Two stat tiles: talks delivered this week, crew reached this week
- Activity feed: last 3 events (near-miss, talk delivered, insight approved) with work type chips
- Two action shortcuts: Log Observation, Report Incident

Navigation:
- Talk card → `/supervisor/talk`
- Log Observation → `/supervisor/capture`
- Report Incident → `/supervisor/capture`

Data: `talks.currentTalk`, `sites.riverside`, activity feed from static array in data file

---

**S2 — `/supervisor/talk`**

Purpose: Read and deliver a toolbox talk to crew.

Needs to show:
- Work type and talk title
- Language selector (display only — show English selected)
- Talk content: hazard intro, main narrative, key actions list, discussion questions
- Optional presenter note input
- Crew attendance — list of names, tap to acknowledge
- Deliver action

Navigation:
- Deliver → `/supervisor/record`
- Back → `/supervisor/home`

Data: `talks.currentTalk` (full content, crew list)

---

**S3 — `/supervisor/record`**

Purpose: Confirmation receipt after delivery.

Needs to show:
- Reference number, site, datetime, attendee count, work type
- Attendee list
- What happens next (brief informational text)

Navigation:
- Back to Home → `/supervisor/home`

Data: `talks.currentTalk` (delivered state)

---

**S4 — `/supervisor/capture`**

Purpose: Log an observation or report an incident.

Needs to show:
- Fork: "Did anyone get hurt or could they have?" — YES = incident fields, NO = observation fields
- Work type selector (required)
- Observation type: Safe / At-risk / Near-miss (observation path)
- Incident type: Near-miss / Injury / Property damage (incident path)
- What happened / what was observed (required free text)
- Immediate action taken (optional)
- Submit

Navigation:
- Submit → `/supervisor/home`
- Back → previous screen

Data: `sites.workTypes` for selector

---

### Phase 3 — Manager Flow

**Purpose of this flow:** Show visit planning driven by atrophy data. A manager sees which sites need attention, reviews AI-recommended topics, and starts a visit.

---

**M1 — `/manager/visits`**

Purpose: Portfolio view. Sites ranked by atrophy so the manager knows where to go.

Needs to show:
- Summary: sites needing attention (atrophy >70), visited this month
- Site list ranked by atrophy score with colour coding (red >70, amber 40–70, green <40)
- Per site: name, worker count, atrophy score, days since last observation, open investigations, last visit
- Plan Visit action per site

Navigation:
- Plan Visit → `/manager/visit-plan`

Data: `sites.all` (with atrophy scores)

---

**M2 — `/manager/visit-plan`**

Purpose: Prepare for a visit. Review site context, select topics, start.

Needs to show:
- Site name and context metrics (last observation age, open investigations, near-miss count, last talk age)
- Recommended topics list — 4 items with source badge (Trend / Investigation / AI) and checkbox
- Site context summary
- Start Visit action

Navigation:
- Start Visit → `/manager/visits` (with success state)
- Back → `/manager/visits`

Data: `sites.riverside` (context), `insights.recommendedTopics`

---

### Phase 4 — Intelligence Loop (most important)

**Purpose of this flow:** Show the full pipeline. A safety manager approves an insight, builds an enquiry, dispatches it, and sees responses aggregate with AI synthesis. This is the core demo.

---

**D1 — `/safety/workbench`**

Purpose: Safety manager's action queue. Three-column layout — queue, work panel, context.

Needs to show:

*Queue column:*
- 8 items grouped by urgency (Overdue / Due This Week / Upcoming)
- Item types: Critical Insight, Investigation, Corrective Action, Atrophy Alert
- Per item: type badge, urgency, title, meta, endorsement count (insights only)
- Click to select and load in work panel

*Work panel (default — insight selected):*
- Insight title, scope, overdue flag
- Source observations (3 items)
- AI draft: pattern summary, toolbox narrative (italic)
- Discussion thread: 2 comments with avatars, endorse button, endorsement count
- Scope selector: Site / Region / Division / Organisation
- Escalation toggle
- Approve / Edit / Reject actions

*Context column:*
- Site metrics (4 tiles)
- Event timeline (5 events)
- Related items list

Navigation:
- Approve & Share → `/safety/enquiry-builder`
- Insight item click → loads in work panel (same page state)

Data: `insights.currentInsight`, `insights.queueItems`, `sites.riverside`

---

**D2 — `/safety/enquiry-builder`**

Purpose: Review AI-generated questions, set targeting, dispatch.

Needs to show:
- Source insight context banner
- AI strip: what the AI checked before suggesting questions
- 5 question cards — each with: type badge, question text, AI rationale, response preview, target scope selector, remove button
- Add custom question option
- Targeting sidebar: scope options (4) with site/supervisor counts, deadline picker, notification preview, recipient summary
- Dispatch action

Navigation:
- Dispatch → `/safety/enquiry-results`
- Back → `/safety/workbench`

Data: `enquiries.current` (questions, targeting options)

---

**D3 — `/safety/enquiry-results`**

Purpose: Real-time results as supervisors respond. Safety manager reads synthesis, generates summary, creates actions.

Needs to show:
- 4 stat tiles: response count, critical findings, process gaps, response rate
- AI synthesis card: 4 findings with signal icons (🔴🟠🟡💡)
- Bar charts for structured questions (assurance distribution, likelihood distribution)
- Live response feed: 5 responses with avatar, name, site, answers, time
- Generated summary: narrative paragraph, 3 recommended actions
- Action buttons: Create Corrective Actions, Generate Toolbox Talk, Export

Navigation:
- Create Corrective Actions → `/safety/workbench`
- Generate Toolbox Talk → `/safety/workbench`

Data: `enquiries.current.results`

---

### Phase 5 — Investigation Path

**D4 — `/investigation`**

Purpose: Safety manager reviews an open investigation and closes it.

Needs to show:
- Incident reference, type, site, occurred at, incident description
- Investigation framework fields (each showing AI suggestion alongside confirmed value):
  - Immediate cause
  - Contributing factors (3 items)
  - Root cause
  - Corrective actions (3 items with owner and due date)
- Sharing decision: cleared_for_sharing toggle, scope, legal hold toggle
- Dispatch Mid-Enquiry action
- Close & Sign Off action

Navigation:
- Dispatch Mid-Enquiry → `/investigation/enquiry`
- Close & Sign Off → `/safety/workbench`

Data: `investigations.current`

---

**D5 — `/investigation/enquiry`**

Purpose: Mid-investigation cross-site enquiry. Simplified builder showing investigation context.

Needs to show:
- Investigation context banner (amber — different from insight purple)
- Legal hold status (showing clear)
- 3 questions (assurance, work as done, gap identification)
- Targeting: same-region sites, scope options
- Dispatch action

Navigation:
- Dispatch → `/safety/enquiry-results`
- Back → `/investigation`

Data: `enquiries.investigationEnquiry`

---

## Data Files

### `/src/data/sites.ts`

```typescript
export const sites = {
  riverside: {
    id: 'site-001',
    name: 'Riverside Tower',
    subtitle: 'Phase 2',
    workerCount: 47,
    workTypes: ['Heavy Vehicle Operation', 'Hot Work', 'Working at Height'],
    atrophyScore: 87,
    daysSinceLastObs: 18,
    daysSinceLastTalk: 11,
    openInvestigations: 2,
    nearMiss30d: 6,
    lastVisit: '24 days ago',
    region: 'North Region'
  },
  all: [
    { id:'site-001', name:'Riverside Tower',        subtitle:'Phase 2',  workerCount:47, atrophyScore:87, daysSinceLastObs:18, openInvestigations:2, nearMiss30d:6, lastVisit:'24 days ago' },
    { id:'site-002', name:'Central Rail Depot',     subtitle:'Stage 3',  workerCount:31, atrophyScore:54, daysSinceLastObs:12, openInvestigations:1, nearMiss30d:2, lastVisit:'11 days ago' },
    { id:'site-003', name:'Harbour Bridge Retrofit', subtitle:'Zone B',  workerCount:22, atrophyScore:21, daysSinceLastObs:2,  openInvestigations:0, nearMiss30d:1, lastVisit:'3 days ago'  }
  ],
  workTypes: ['Heavy Vehicle Operation','Hot Work','Working at Height','Confined Space','Blasting']
}
```

### `/src/data/talks.ts`

```typescript
export const currentTalk = {
  id: 'talk-001',
  ref: 'TLK-0187',
  workType: 'Heavy Vehicle Operation',
  title: 'Spotter Management — Heavy Vehicle',
  generatedMinutesAgo: 8,
  crewCount: 14,
  hazardIntro: "We're working with heavy vehicles on levels 7–9 today. The single most important thing: blind zones during reversing. Someone needs to own that space — every single time.",
  mainContent: "Six times in the last month across four of our sites, a heavy vehicle reversed without someone properly watching the blind zone. Six times. That's not bad luck — that's a system that isn't working. The common factor isn't the drivers. It's that we're not managing the spotter role the same way we manage everything else on site.",
  keyActions: [
    "Before any reversing movement: operator confirms spotter is in position and they have eye contact",
    "If you're the spotter and need to step away — tell the operator first, find a replacement before you go",
    "Spotter assignment is a controlled position, not an informal favour",
    "Any gap in the perimeter plan is raised immediately — not assumed someone else saw it"
  ],
  discussionQuestions: [
    "Where are the blind zones in today's reversing path — and who is covering them?",
    "What happens if your assigned spotter gets pulled away mid-operation?",
    "Has anyone seen a reversing operation happen without a confirmed spotter this week?"
  ],
  closingLine: "Eyes open out there. If something doesn't look right, it probably isn't.",
  deliveredAt: null,
  crew: [
    { id:'u1', name:'J. Reyes',  role:'Leading Hand', initials:'JR' },
    { id:'u2', name:'K. Smith',  role:'Operator',     initials:'KS' },
    { id:'u3', name:'M. Chen',   role:'Rigger',        initials:'MC' },
    { id:'u4', name:'T. Walsh',  role:'Spotter',       initials:'TW' },
    { id:'u5', name:'A. Obi',    role:'Operator',      initials:'AO' }
  ]
}
```

### `/src/data/insights.ts`

```typescript
export const currentInsight = {
  id: 'CI-042',
  title: 'Spotter management — 6 near-misses across 4 sites in 28 days',
  workType: 'Heavy Vehicle',
  scope: 'North Region',
  daysOverdue: 3,
  sourceObservations: 6,
  sourceSites: 4,
  endorsements: 5,
  patternSummary: 'Six near-misses involving heavy vehicle spotters across four North Region sites in 28 days. In five of six cases the spotter was absent or distracted — not because of individual negligence, but because spotter assignment and continuity are not systematically managed.',
  toolboxNarrative: "Six times in the last month, across four of our sites, a heavy vehicle reversed without someone properly watching the blind zone. Six times. That's not bad luck — that's a system that isn't working.",
  likelyCause: 'Spotter roles are treated as informal assignments — no system ensures continuity during reversing operations.',
  escalateToSystemic: true,
  comments: [
    { id:'c1', name:'J. Thompson', role:'Regional Mgr', initials:'JT', text:"Saw this at Riverside on my visit Tuesday. The spotter walked off mid-operation — no handover. Definitely systemic.", endorsed:true,  time:'2h ago' },
    { id:'c2', name:'K. Obi',      role:'Supervisor · CRD', initials:'KO', text:"Same at Central Rail last week. PTW doesn't mention spotter continuity at all.", endorsed:false, time:'1h ago' }
  ],
  sourceObs: [
    { text:'Excavator reversed — spotter had moved to crane lift without informing operator.', site:'Riverside Tower · 18 Mar · Sup: J. Reyes' },
    { text:'Dump truck reversing — no spotter present. Worker shouted warning.',              site:'Central Rail Depot · 14 Mar · Sup: K. Obi' }
  ]
}

export const queueItems = [
  { id:'qi1', type:'insight',     urgency:'overdue', title:'Spotter Management Pattern',          meta:'6 near-misses · North Region',          endorsements:5, daysOverdue:3 },
  { id:'qi2', type:'investigation',urgency:'overdue', title:'INC-0091 — Fracture, Working at Height',meta:'Riverside Tower · 14 days open',       endorsements:0, daysOverdue:1 },
  { id:'qi3', type:'action',      urgency:'overdue', title:'Update STMP — spotter positioning',   meta:'Owner: J. Reyes · From INC-0088',       endorsements:0, daysOverdue:5 },
  { id:'qi4', type:'insight',     urgency:'thisweek',title:'PTW sign-on atrophy — Central Rail',  meta:'4 observations · Site level',           endorsements:2, daysOverdue:0 },
  { id:'qi5', type:'investigation',urgency:'thisweek',title:'INC-0094 — Near-miss, Hot Work',     meta:'Central Rail Depot · 60% complete',     endorsements:0, daysOverdue:0 },
  { id:'qi6', type:'action',      urgency:'thisweek',title:'Add reversing camera to vehicle pre-start',meta:'Owner: M. Chen · Due 27 Mar',       endorsements:0, daysOverdue:0 },
  { id:'qi7', type:'atrophy',     urgency:'thisweek',title:'Riverside Tower — 18 days no observation',meta:'Score: 87 · No visit scheduled',     endorsements:0, daysOverdue:0 },
  { id:'qi8', type:'action',      urgency:'upcoming',title:'Pre-task brief template — spotter',   meta:'Safety Team · From INC-0091 · Due 1 Apr',endorsements:0, daysOverdue:0 }
]

export const recommendedTopics = [
  { text:'Spotter positioning during reversing',             source:'Near-miss trend · 3 obs this month', sourceType:'trend' },
  { text:'Hot work pre-task checklist — fire blankets',      source:'Open investigation · INC-0091',      sourceType:'investigation' },
  { text:'PTW sign-on — workers reading permit conditions',  source:'AI · Practice atrophy detected',     sourceType:'ai' },
  { text:'Harness inspection before working at height',      source:'AI · No WAH obs in 22 days',         sourceType:'ai' }
]
```

### `/src/data/enquiries.ts`

```typescript
export const currentEnquiry = {
  id: 'EQ-018',
  insightId: 'CI-042',
  status: 'active',
  deadline: 'Fri 28 Mar 2026 — 5:00 PM',
  targetSites: 4,
  targetSupervisors: 12,
  responseCount: 9,
  questions: [
    { id:'q1', position:1, type:'likelihood',  typeLabel:'Likelihood Assessment', text:'How likely is it that a spotter could leave their position during a reversing operation without the operator knowing?', rationale:'Establishes whether supervisors perceive this as a real risk before asking about controls.', options:['Low','Moderate','High'], targetScope:'Source sites (4)' },
    { id:'q2', position:2, type:'assurance',   typeLabel:'Assurance Check',       text:'Is a designated spotter assigned and confirmed in position before any heavy vehicle reversing operation begins on your site?', rationale:'Primary control check. Directly verifies whether the root cause condition is being addressed.', options:['Yes','Partially','No'], allowPhoto:true, targetScope:'Source sites (4)' },
    { id:'q3', position:3, type:'work_as_done',typeLabel:'Work as Done',          text:"Describe how spotter assignment actually works on your site — from when the task starts to when it's complete. What happens in practice?", rationale:'Captures the gap between documented procedure and actual practice. AI synthesises patterns across responses.', options:null, targetScope:'Source sites (4)' },
    { id:'q4', position:4, type:'gap',         typeLabel:'Gap Identification',    text:'What would need to change on your site for spotter management to work reliably every single time — even when things get busy?', rationale:'Invites supervisors to name the specific gap. Feeds directly into corrective action design.', options:null, targetScope:'Source sites (4)' },
    { id:'q5', position:5, type:'comparative', typeLabel:'Comparative Check',     text:"Does your site have a process for handing over spotter responsibility when a spotter needs to leave their position — and is it working reliably?", rationale:'Tests whether the supporting system exists and is effective.', options:["Exists & works","Has gaps","Doesn't exist"], targetScope:'Source sites (4)' }
  ],
  results: {
    assurance: { yes:2, partially:5, no:2 },
    likelihood: { low:1, moderate:4, high:4 },
    comparative: { exists:0, gaps:1, doesntExist:8 },
    liveResponses: [
      { name:'Marcus Reyes', site:'Riverside Tower',    role:'Supervisor', answers:['Moderate','Partially'], time:'2m ago',  initials:'MR' },
      { name:'K. Obi',       site:'Central Rail Depot', role:'Supervisor', answers:['High','No'],           time:'14m ago', initials:'KO' },
      { name:'T. Walsh',     site:'Harbour Bridge',     role:'Supervisor', answers:['High','Yes'],          time:'31m ago', initials:'TW' }
    ],
    synthesis: [
      { signal:'🔴', text:'The control is not consistently in place. 7 of 9 supervisors report the spotter assurance check is either Partial or absent — consistent across all 4 source sites.' },
      { signal:'🟠', text:'No formal handover process exists at any site. 8 of 9 responses confirm spotters have no mechanism for handing over responsibility when they need to leave position.' },
      { signal:'🟡', text:'Supervisors perceive the risk. 6 of 9 rated likelihood Moderate or High — the gap is known but there is no system to manage it.' },
      { signal:'💡', text:'Gap responses converge on Process. 7 of 9 tagged Process. Most common suggestion: spotter handover embedded in the PTW or pre-task brief.' }
    ],
    summary: "This enquiry confirms the spotter management gap identified in CI-042 is real, widespread, and recognised by supervisors. Across 4 sites and 9 responses, only 2 supervisors report the control is consistently in place. No site has a documented spotter handover process. Work as Done responses describe the same informal pattern: assignment at the brief, no system to maintain it, no handover when the spotter needs to leave.",
    recommendedActions: [
      'Develop and embed a spotter handover protocol into the PTW and pre-task brief template — applicable across all sites in scope',
      'Update the STMP at all 4 source sites to define spotter positioning requirements explicitly',
      'Generate a follow-up toolbox talk using this enquiry summary as primary content'
    ]
  }
}

export const investigationEnquiry = {
  id: 'EQ-019',
  investigationId: 'INV-0055',
  context: 'INC-0091 — Fracture, Working at Height · Riverside Tower',
  legalHold: false,
  targetSites: 6,
  targetSupervisors: 18,
  questions: [
    { type:'assurance',   typeLabel:'Assurance Check', text:'Is a harness self-rescue procedure communicated to workers before any working at height task begins on your site?', options:['Yes','Partially','No'] },
    { type:'work_as_done',typeLabel:'Work as Done',    text:"Describe what your WAH pre-task brief covers for harness management — specifically what workers are told about what to do if a harness gets caught.", options:null },
    { type:'gap',         typeLabel:'Gap Identification',text:'What is missing from your current WAH pre-task brief that would prevent a harness management incident?', options:null }
  ]
}
```

### `/src/data/users.ts`

```typescript
export const currentUser = { id:'u-safety-01', name:'Sarah Reyes', initials:'SR', role:'safety_manager', scope:'North Region' }
export const supervisor   = { id:'u-sup-01',    name:'Marcus Reyes',initials:'MR', role:'supervisor',     site:'Riverside Tower' }
export const manager      = { id:'u-mgr-01',    name:'J. Thompson', initials:'JT', role:'manager',        region:'North Region' }
```

---

## Quality Check

Before marking any screen complete:
- [ ] All components imported from the kit — nothing custom-built that the kit provides
- [ ] Navigation uses kit patterns throughout — no invented nav
- [ ] Works at mobile viewport (375px) and desktop (1280px)
- [ ] No hardcoded layout widths
- [ ] All content from data files — no inline strings
- [ ] Navigation links work — no dead ends
- [ ] No console errors
