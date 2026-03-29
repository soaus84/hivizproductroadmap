# SafetyPlatform Demo — Claude Code Instructions

## What This Project Is

A clickable prototype demonstrating the SafetyPlatform intelligence loop. No database, no real API calls, no authentication. All data is static TypeScript objects. The goal is a navigable demo across four flows.

---

## Rule 1 — The Kit Is Installed. Use It. Do Not Rebuild It.

The full paid Minimal UI kit is already in this project. It ships React components. **Your job is to import and use those components — not recreate them.**

**Your first action every session:**

```bash
# Find where the kit components live
find . -type f -name "index.ts" | grep -i "components" | head -20
# Find the theme setup
find . -type f -name "theme*" | head -10
```

Read the kit's component exports before writing a single line of UI code. Every component you need almost certainly exists in the kit already.

**The rule is simple:**

```
Does this component exist in the kit?
  YES → import it, use it, do not rewrite it
  NO  → ask before building anything custom
```

Never write a custom Card, Chip, Button, Avatar, TextField, Stack, Typography,
Divider, IconButton, Badge, LinearProgress, ListItem, ListItemText, Paper,
Alert, or any other component that the kit already provides.

---

## Rule 2 — Theme First, Everything Else Second

The kit ships a theme. The entire app must be wrapped in the kit's ThemeProvider
with the kit's theme applied. Do this in the root layout before building any screens.

Find the kit's theme setup file. Apply it at the root. Verify it is working
before touching any screen.

If the kit's theme is not applied, nothing will look right. Do this first.

---

## Rule 3 — No Database, No API Calls

All data is static TypeScript objects imported from /src/data/.
No fetch calls, no Prisma, no Supabase, no database of any kind.

---

## Rule 4 — No New Dependencies Without Asking

The kit and its peer dependencies are already installed.
Do not add npm packages. If a feature seems to need a new package, ask first.

---

## Rule 5 — One Screen at a Time

Build in the order defined in BRIEF.md. Complete each screen fully before starting the next.
Fully means: correct data, working navigation, correct kit components, no console errors.

---

## Rule 6 — Responsive Layouts, Not Phone Frames

This is a real responsive web app, not a slideshow. No phone frames, no fixed-width wrappers, no fake bezels.

Every screen must be fully responsive using the kit's responsive system:
- Mobile (xs/sm): single column, bottom navigation, compact spacing
- Desktop (md+): sidebar navigation, multi-column layouts, expanded spacing

The kit's breakpoint system handles this. Use it:
- xs: 0px+    (mobile portrait)
- sm: 600px+  (mobile landscape / small tablet)
- md: 900px+  (tablet / small desktop)
- lg: 1200px+ (desktop)

Supervisor and manager views are primarily used on mobile — design mobile-first,
then ensure they scale gracefully to desktop.

Safety manager workbench and analytics are primarily desktop — design desktop-first,
then ensure they are usable on tablet.

Use the kit's useMediaQuery, Hidden, Drawer (temporary on mobile, permanent on desktop),
BottomNavigation (mobile only), and responsive Grid/Stack props throughout.
Never hardcode pixel widths for layout. Never fix a component to a specific viewport size.

---

## Rule 7 — Check BRIEF.md Before Every Screen

BRIEF.md defines what each screen contains, what data it uses, and what the navigation is.
Read the relevant section before writing any code for that screen.

---

## Rule 8 — No Placeholder Content

No Lorem ipsum, no TODO, no Coming soon. All content comes from /src/data/ files
defined in BRIEF.md. If content is not defined, ask.

---

## Rule 9 — One Source of Truth for Visual Decisions

The kit. Not this file. Not DESIGN_SYSTEM.md. Not the prototype HTML files.
If there is any conflict between this file and the kit — the kit wins.

---

## Project Structure

```
src/
  app/
    layout.tsx          <- ThemeProvider wrapping everything, font import
    page.tsx            <- redirect to /supervisor/home
    supervisor/
    manager/
    safety/
    investigation/
  components/
    layout/             <- PhoneFrame, PhoneCanvas, DesktopShell
                           Structural wrappers only.
                           No custom UI — only layout divs
                           and kit components for nav/topbar content.
  data/                 <- all static data as TypeScript objects
  types/                <- TypeScript interfaces
```

There is no components/ui/ folder. UI components come from the kit.

---

## What Not to Build

- No login / auth screens
- No settings screens  
- No animations beyond kit-standard transitions
- No third-party chart libraries — use the kit's built-in chart components
- No map components
- No error states
- No loading states (static data, nothing to load)

---

## Charts — Use the Kit's Chart Components

The kit ships chart components. Use them when a chart genuinely communicates better than numbers alone.

Screens where charts are appropriate:
- Enquiry results: assurance response distribution, likelihood distribution — bar or donut
- Analytics workbench: observation volume over time — area or bar chart
- Pipeline funnel: conversion stages — bar or funnel chart
- Atrophy heatmap on analytics — if the kit has a heatmap component, use it

Screens where charts are not needed:
- Stat cards — large number + delta is cleaner than a chart
- Queue items — text and chips communicate better
- Any screen where a single number tells the story

When in doubt: would a chart make this clearer to someone seeing it for the first time?
If yes — use the kit chart. If the number alone is clear — skip it.

---

## How to Handle Ambiguity

1. Does the kit have a component for this? Use it.
2. Is the screen defined in BRIEF.md? Follow it.
3. Neither? Ask. Do not invent.
