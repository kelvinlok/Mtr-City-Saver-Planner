# Setup Panel Redesign — Design Document

**Date:** 2026-05-01
**Status:** Approved

## Problem

The setup panel crams everything into a single scrollable 320px slideover. The 7 weekday pattern sections dominate ~70% of the scroll height, burying data transfer controls at the bottom. Users must scroll past identical Mon–Fri trip configurations to reach Export/Import/Reset.

## Solution

Three changes, applied together:

1. **Tabbed layout** — split into "Ticket" and "Trips" tabs
2. **Smart weekday grouping** — auto-cluster identical weekday patterns with day-chip splitting
3. **Collapsible sections** — unavailable ranges collapse when empty

## Design

### Tab Structure

Two tabs at the top of the slideover, below the header:

**Ticket tab** (default):
- Remaining uses (number input)
- Plan start (date input)
- Ticket expiry (date input)
- Plan second ticket (checkbox + info text)
- Unavailable ranges (collapsible section — collapsed when 0 ranges, expanded when populated)
- Data transfer row: Export, Import, Reset buttons

**Trips tab:**
- "Default pattern" label
- Auto-grouped weekday rows (collapsible)

Tab state is ephemeral — not persisted. Defaults to "Ticket" on open.

### Weekday Grouping

Grouping is a **view-layer concern only**. The underlying `tripsByWeekday` data model (keyed 0–6) does not change.

**Fingerprinting:** At render time, each weekday's trips are serialized to a fingerprint string (trip IDs + priorities, sorted). Weekdays sharing the same fingerprint are clustered into a group.

**Group display:** Each group shows as a collapsible row:
- Label: day range (e.g., "Mon – Fri") or single day name
- Meta: trip count summary (e.g., "2 trips each" or "0 trips")
- Chevron indicator for expand/collapse

**Expanded group — day chips (Option A):**
When a group is expanded, it shows:
1. A row of day chips (e.g., `[M] [T] [W] [T] [F]`) — all active by default
2. The shared trip editor (trip name inputs + priority toggles + add/remove)
3. An "Add trip" button

Editing trips while all chips are selected applies the change to every day in the group.

**Splitting a day out:**
Deselecting a chip (e.g., tapping "F") removes Friday from the group. Friday becomes its own standalone group row below, inheriting a copy of the current trips. The original group label updates (e.g., "Mon – Thu").

**Auto-merging:**
If a standalone day's trips are edited to match another group's fingerprint, it automatically merges back into that group on the next render. No manual merge action needed.

**Edge cases:**
- Single-day "group": displays as just the day name (e.g., "Friday"), no range notation
- All days different: 7 individual rows, each expandable — degrades to current behavior but with collapse
- Empty group (0 trips): shows "0 trips", expanding shows only an "Add trip" button

### Collapsible Sections

Unavailable ranges section:
- **Collapsed when empty** (0 ranges) — shows just the header with a "+" button
- **Expanded when populated** — shows header with count badge + "+" button, and the range rows
- User can manually toggle collapse/expand regardless of count

### Interaction Details

- Tab switching is instant, no animation needed
- Group expand/collapse animates height with CSS `grid-template-rows: 0fr → 1fr` transition
- Day chip toggle is immediate — no confirmation needed (the split is non-destructive, user can re-select the chip or edit back to match)
- Collapsible chevron rotates 90° on expand

### Data Model

No changes to `TicketPlan`, `TripTemplate`, or `tripsByWeekday`. All grouping logic is derived at render time.

New component state:
- `activeTab: "ticket" | "trips"` — which tab is shown
- `expandedGroups: Set<string>` — which group fingerprints are expanded (keyed by fingerprint or day list)
- `unavailableExpanded: boolean` — whether the unavailable ranges section is expanded

### i18n

New translation keys needed:
- `setup.tabTicket` / `setup.tabTrips` — tab labels
- `setup.nTripsEach` — "{n} trips each" (for grouped display)
- Day abbreviation keys for chips: `setup.chipSun` through `setup.chipSat` (single letter)

### Accessibility

- Tabs use `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`
- Collapsible sections use `aria-expanded` on the trigger
- Day chips use `role="checkbox"` with `aria-checked` and `aria-label` (full day name)
- Group rows are buttons with `aria-expanded`

### Mobile

No special changes needed — the panel already converts to a bottom sheet on mobile (<680px). The tabs and collapsible sections work the same way. The day chips row fits within 320px (7 × 32px + gaps = ~240px).
