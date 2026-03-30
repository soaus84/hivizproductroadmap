# Hiviz — Master Snapshot
**Date:** March 2026  
**Status:** Pre-repository setup. Next step: GitHub + Vercel + Supabase.

---

## What's in this snapshot

```
snapshot/
  README.md                    ← this file
  mvp-scope.html               ← full product roadmap V1–V5 (open in browser)

  specs/                       ← full specification set (latest versions)
    01-data-model-api-spec.md  ← all entities, Prisma schema, API surface
    02-ai-prompt-library.md    ← all 12 AI prompts with V2/V3 cascade notes
    03-system-architecture.md  ← component diagram, job queue, tech stack
    04-integration-logic-rules.md ← platform integration + V2/V3 cascade notes
    05-view-information-spec.md ← all views, AI suggestion display standard
    06-notification-events.md  ← 30 notification events N01-N30
    07-enquiry-module-spec.md  ← full enquiry system spec

  simulators/                  ← interactive pipeline demonstrations
    workflow-sim.html          ← observation → insight → talk pipeline (3 scenarios)
    enquiry-sim.html           ← enquiry pipeline with FW Map® classification (3 scenarios)

  product-docs/                ← light-mode product documents (open in browser)
    sales-page.html
    product-spec.html
    journey-map.html
    desktop-minimal.html
    enquiry-system.html
    minimal-ui-views.html
    mobile-flow.html
    workbench.html
    toolbox-talk.html

  v1-devpack/                  ← V1 build pack for dev team
    README.md                  ← full build guide: stack, schema, prompts, build order
    01-data-model-api-spec.md  ← data model (copy for dev reference)
    02-ai-prompt-library.md    ← prompt library (copy for dev reference)
    04-integration-logic-rules.md
    05-view-information-spec.md
    src/
      data/mock.ts             ← static mock data for all entities
      pages/
        supervisor/home.tsx    ← entity wireframe — supervisor home
        safety/workbench.tsx   ← entity wireframe — safety manager workbench
        safety/enquiry.tsx     ← entity wireframe — enquiry flow
        safety/analytics.tsx   ← entity wireframe — analytics & pipeline health
        manager/visits.tsx     ← entity wireframe — manager visit workflow

  claude-code/                 ← Claude Code session files (if prototype build resumes)
    claude.md                  ← Claude Code instructions
    BRIEF.md                   ← functional brief (kit-first, no design overrides)
```

---

## Roadmap summary

| Version | Name | Status |
|---------|------|--------|
| V1 | Core Loop | Ready to build — 8 epics, full spec |
| V2 | Intelligence Depth | Designed — 6 epics, cascade notes documented |
| V3 | Integration & Enterprise | Outlined — 5 epics |
| V4 | Organisational Diagnostic | Specced — periodic survey, role-targeted, anonymous |
| V5 | Risk Assurance | Discovery phase — 6 discussion notes for expert consultation |

---

## Key design decisions (for context in next session)

- **Forge Works Map® classification** — multi-factor arrays, confidence threshold 0.70, per-factor rationale required, stored as parallel arrays
- **AI suggestion principle** — every AI output is a suggestion with a visible reason, never a recommendation or directive
- **Worksite personnel** — role slots (supervisor, manager, safety_professional, control_verifier), not a flat user list
- **Worksite targeting vs person targeting** — toolbox talks and enquiries are worksite obligations; briefs, polls, CoP use existing person-targeted platform tools
- **Enquiry V1** — free text only; V2 adds structured question types informed by FW Map® classification
- **Toolbox talk voice** — veteran, plain-spoken; V2 adapts register to maturity level of classified factors
- **Incident module** — data model complete, UI deferred to V2+
- **Mobile** — Capacitor-wrapped responsive Next.js, not native

---

## Next steps

1. Set up GitHub repo — drop this snapshot in as initial commit
2. Connect Vercel — deploy mvp-scope.html as living roadmap URL
3. Connect Supabase — persistent data for prompt config, seed data
4. Start validation conversations with real organisations
5. Return to this repo to update specs based on what validation surfaces
