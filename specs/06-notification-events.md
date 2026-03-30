# Notification Events Registry

**Hiviz — Complete Notification Reference**  
Version: 0.3 — March 2026

All notification events, recipients, channels, tone, timing, and message content.

---

## Notification Channels

| Channel | Description | When to use |
|---------|-------------|-------------|
| `push` | Mobile push notification | Immediate action required, urgent alerts |
| `inbox` | In-app workbench inbox item | Desktop action queue items |
| `feed` | In-app activity feed (non-urgent) | Informational updates, loop closure |
| `email` | Email | High-stakes events, overdue escalations |

**Tone types:**
- `action` — Something requires your attention. Clear call to action.
- `info` — You should know this. No action required.
- `social` — Someone responded to something you're part of.
- `closure` — Something you contributed to has reached an outcome. The loop closes.
- `sensitive` — Witness/participant invitation. Careful, non-pressuring language.

---

## Observation Pipeline Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N01 | Threshold crossed | Algorithm detects N near-misses | Safety Manager (scope) | push, inbox | action | Immediate | "A pattern has been detected in [work type] at [scope]. An insight is being drafted for your review." |
| N02 | Critical Insight draft ready | AI generation complete | Safety Manager (scope) | push, inbox | action | Immediate | "A new Critical Insight is ready for your review: [insight title]. [N] endorsements from field managers." |
| N03 | Managers invited to endorse | Insight draft generated | Managers (affected sites) | push, feed | social | Immediate | "We've detected a pattern at your sites. Does this match what you're seeing? [insight title]" |

---

## Insight Review Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N04 | Endorsement added | Manager endorses insight | Safety Manager, prior commenters | feed | social | Batched (per insight, max 1/hr) | "[Name] endorsed the insight and commented: [preview]" |
| N05 | Insight approved | Safety Manager approves | All endorsers, supervisors (scope) | push, feed | closure | Immediate | Endorsers: "The insight you endorsed has been approved. It will reach crews in upcoming talks." Supervisors: "New safety insight approved for your next toolbox talk." |
| N06 | Insight escalated | Safety Manager escalates to systemic | Division Safety Manager, Regional Manager | push, email | action | Immediate | "A systemic safety investigation has been initiated: [title]. Action required." |
| N07 | Insight review overdue | No action >48h | Safety Manager | push, email | action | 48h then daily | "Critical Insight [title] has been waiting [N] days for review. Action required." |
| N08 | Insight rejected | Safety Manager rejects | No user-facing notification | — | — | — | Silent. Cooldown resets internally. |

---

## Incident & Investigation Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N09 | Incident reported | Supervisor submits incident | Site Manager, Safety Manager | push, email | action | Immediate | "Incident reported at [site]. Type: [type]. [Investigation initiated / No investigation required]." |
| N10 | Investigation assigned | Triage auto-creates investigation | Assigned Investigator | push, email | action | Immediate | "You've been assigned to investigate [INC-ref] at [site]. AI framework suggestions are ready." |
| N11 | Investigation overdue | Open >N days (configurable, default 14) | Assigned Investigator, Site Manager | push, inbox | action | Daily until resolved | "Investigation [INC-ref] has been open [N] days. Please update or close." |
| N12 | Investigation closed | Safety Manager closes | Site Manager, Reporting Supervisor | feed | closure | Immediate | "Investigation [INC-ref] has been closed. [Findings will / will not] be included in toolbox talks." |

---

## Toolbox Talk Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N13 | Talk delivered | Supervisor delivers | Site Manager, Safety Manager, Endorsers (of insight used) | feed, inbox | closure | Immediate | Safety Manager/Manager: "Talk delivered at [site] — [N] crew reached. Content: [source]." Endorsers: "The insight you endorsed has reached [N] crew members across [M] sites." |
| N14 | Talk undelivered — site alert | Talk generated but not delivered >24h | Site Supervisor, Site Manager | push | action | 24h after generation | "A toolbox talk for [work type] at [site] has been ready for [N] hours. Deliver it before the next shift." |

---

## Manager Visit Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N15 | Manager visit started | Manager taps Start Visit | Site Supervisor, Safety Manager | push | info | Immediate | "[Manager name] has started a field visit at your site." |
| N16 | Visit completed | Manager closes visit | Safety Manager | feed | info | Immediate | "Visit complete — [N] observations logged at [site]. Atrophy score updated." |
| N17 | Atrophy alert | Daily cron, score >70 | Assigned Manager, Safety Manager | push, inbox | action | Daily 8am | "[Site] hasn't had an observation in [N] days. A visit is recommended." |

---

## Corrective Action Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N18 | Action assigned | Safety Manager creates action | Action Owner | push, email | action | Immediate | "You've been assigned a corrective action due [date]: [action text]. From investigation [INC-ref]." |
| N19 | Action due reminder | 3 days before due_date | Action Owner | push | action | 3 days prior | "Corrective action due in 3 days: [action text]." |
| N20 | Action overdue | Past due_date | Action Owner, Safety Manager | push, inbox | action | Daily until resolved | "Corrective action is [N] days overdue: [action text]. Owner: [name]." |
| N21 | Action verified | Safety Manager verifies complete | Site Supervisor, Action Owner | feed | closure | Immediate | "Corrective action completed and verified: [action text]. This closes the loop on [INC-ref]." |

---

## Enquiry Pipeline Events

| # | Event | Trigger | Recipients | Channels | Tone | Timing | Message |
|---|-------|---------|------------|----------|------|--------|---------|
| N22 | Enquiry draft ready | AI generates questions post-insight approval | Safety Manager | push, inbox | action | Immediate | "An enquiry has been drafted for CI-[id]. Review and dispatch to gather field intelligence." |
| N23 | Enquiry dispatched | Safety Manager dispatches | Targeted Supervisors | push, feed | action | Immediate | "A safety enquiry has been sent to your site. Your input helps us understand what's actually happening on the ground. Due: [deadline]." |
| N24 | Investigation mid-enquiry dispatched | Investigator dispatches | Targeted Supervisors | push, feed | action | Immediate | "We're currently investigating an incident at one of our sites. We need to check whether a related condition exists at your site. This will take about 3 minutes. Due: [deadline]." |
| N25 | Witness enquiry invitation | Investigator adds named individuals | Named Individuals | push, email | sensitive | Immediate | "You have been identified as a witness or participant in a safety investigation at [site]. Your input helps us understand what happened and prevent it happening again. Responses are confidential within the investigation team." |
| N26 | Enquiry response received | Supervisor submits | Safety Manager | feed | info | Batched per 3 responses | "[N] new responses received for enquiry EQ-[id]. Response rate: [%]." |
| N27 | Enquiry deadline reminder | 24h before deadline | Non-respondent supervisors | push | action | 24h before deadline | "Your response is needed for the safety enquiry at [site]. Closes in 24 hours." |
| N28 | Enquiry summary generated | Enquiry closed or manually triggered | Safety Manager, All respondents | push, feed | closure | Immediate | Safety Manager: "Enquiry EQ-[id] summary is ready. [N] responses across [M] sites." Respondents: "The enquiry you contributed to is closed. Here's what we found: [summary excerpt]. Your input shaped what happens next." |
| N29 | Witness response acknowledged | Named individual submits | Named Individual | in-app only | closure | Immediate | "Your input has been recorded. The investigation team will use it to understand what happened and make the site safer. You'll be notified of relevant outcomes." |
| N30 | Enquiry-informed talk generated | Enquiry summary feeds a toolbox talk | Site Supervisors (scope) | feed | info | Immediate | "A new toolbox talk is available, informed by responses from [N] supervisors across [M] sites." |

---

## Notification Design Rules

1. **Push notifications should be rare and meaningful.** If everything is push, nothing gets attention. Action-required and sensitive events only.

2. **Feed is for information, not action.** If a user needs to do something, it's push + inbox. If they just need to know, it's feed.

3. **Closure notifications are the most important.** Telling a supervisor their near-miss observation reached 200 crew members is what makes people keep observing. Never omit closure events.

4. **Sensitive tone for witness invitations.** N25 wording must be approved by the organisation's legal and HR team before go-live. The platform sends the template — the org approves the wording.

5. **Batching prevents fatigue.** Endorsements (N04) and response receipts (N26) are batched — not one notification per event. Immediate events (incident, assignment, overdue) are never batched.

6. **No notification for rejected insights.** Rejection is silent to field users. The corrective signal goes only to the internal system (reset cooldown).

7. **Legal hold blocks all enquiry notifications.** If `investigation.legal_hold = true`, N24 and N25 are blocked entirely. The system never creates an enquiry notification from a legal-held investigation.
