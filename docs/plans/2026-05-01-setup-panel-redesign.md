# Setup Panel Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the setup panel into a tabbed layout (Ticket / Trips) with smart weekday grouping and collapsible sections to reduce scroll depth and improve navigation.

**Architecture:** Split SetupPanel into tab container + two tab content components. Extract weekday grouping logic into a pure utility function. All grouping is view-layer only — no data model changes. Existing tests will need updates to account for tab navigation.

**Tech Stack:** React, CSS (no new dependencies)

**Design doc:** `docs/plans/2026-05-01-setup-panel-redesign-design.md`

---

### Task 1: Add i18n keys for tabs and day chips

**Files:**
- Modify: `src/domain/i18n.tsx`

**Step 1:** Add the following keys to both `en` and `zh-HK` translation objects:

English keys to add after `"setup.dataTransfer"`:
```
"setup.tabTicket": "Ticket",
"setup.tabTrips": "Trips",
"setup.nTripsEach": "{n} trips each",
"setup.chipSun": "S",
"setup.chipMon": "M",
"setup.chipTue": "T",
"setup.chipWed": "W",
"setup.chipThu": "T",
"setup.chipFri": "F",
"setup.chipSat": "S",
```

Chinese keys to add after `"setup.dataTransfer"`:
```
"setup.tabTicket": "車票",
"setup.tabTrips": "行程",
"setup.nTripsEach": "每日 {n} 個行程",
"setup.chipSun": "日",
"setup.chipMon": "一",
"setup.chipTue": "二",
"setup.chipWed": "三",
"setup.chipThu": "四",
"setup.chipFri": "五",
"setup.chipSat": "六",
```

**Step 2:** Run `npx tsc --noEmit` — expect clean.

**Step 3:** Commit: `git add src/domain/i18n.tsx && git commit -m "i18n: add tab and day chip translation keys"`

---

### Task 2: Create weekday grouping utility

**Files:**
- Create: `src/domain/weekdayGroups.ts`
- Create: `src/domain/weekdayGroups.test.ts`

This is a pure function with no React dependency. It takes `tripsByWeekday` and returns an array of groups.

**Step 1:** Create `src/domain/weekdayGroups.ts`:

```typescript
import type { TripTemplate } from "./types";

export type WeekdayGroup = {
  /** Weekday indices in this group, e.g. [1,2,3,4,5] for Mon–Fri */
  weekdays: number[];
  /** The shared trips (from the first weekday in the group) */
  trips: TripTemplate[];
  /** Fingerprint string used for matching */
  fingerprint: string;
};

/**
 * Serialize a weekday's trips into a stable fingerprint for comparison.
 * Two weekdays with the same fingerprint have identical trip configurations.
 */
export function tripFingerprint(trips: TripTemplate[]): string {
  return trips
    .map((t) => `${t.id}:${t.priority}`)
    .join("|");
}

/**
 * Group weekdays (0–6) by identical trip configurations.
 * Returns groups ordered: groups with trips first (by earliest weekday),
 * then empty groups (by earliest weekday).
 */
export function groupWeekdays(
  tripsByWeekday: Record<number, TripTemplate[]>
): WeekdayGroup[] {
  const fingerprints = new Map<string, number[]>();
  const order: string[] = [];

  for (let day = 0; day < 7; day++) {
    const trips = tripsByWeekday[day] ?? [];
    const fp = tripFingerprint(trips);
    if (!fingerprints.has(fp)) {
      fingerprints.set(fp, []);
      order.push(fp);
    }
    fingerprints.get(fp)!.push(day);
  }

  const groups: WeekdayGroup[] = order.map((fp) => {
    const weekdays = fingerprints.get(fp)!;
    const trips = tripsByWeekday[weekdays[0]] ?? [];
    return { weekdays, trips: [...trips], fingerprint: fp };
  });

  // Sort: non-empty groups first (by earliest weekday), then empty groups
  groups.sort((a, b) => {
    const aEmpty = a.trips.length === 0;
    const bEmpty = b.trips.length === 0;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return a.weekdays[0] - b.weekdays[0];
  });

  return groups;
}

/**
 * Format a group's weekday label, e.g. "Mon – Fri", "Sat – Sun", "Wednesday".
 * Uses the provided day name lookup function.
 */
export function formatGroupLabel(
  weekdays: number[],
  dayName: (weekday: number) => string
): string {
  if (weekdays.length === 1) return dayName(weekdays[0]);
  // Check if consecutive
  const sorted = [...weekdays].sort((a, b) => a - b);
  const isConsecutive = sorted.every((d, i) =>
    i === 0 || d === sorted[i - 1] + 1
  );
  if (isConsecutive && sorted.length >= 2) {
    return `${dayName(sorted[0])} – ${dayName(sorted[sorted.length - 1])}`;
  }
  // Non-consecutive: list all
  return sorted.map(dayName).join(", ");
}
```

**Step 2:** Create `src/domain/weekdayGroups.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { groupWeekdays, tripFingerprint, formatGroupLabel } from "./weekdayGroups";
import type { TripTemplate } from "./types";

const trip = (id: string, priority: "definitely" | "maybe" | "not_preferred"): TripTemplate => ({ id, priority });

describe("tripFingerprint", () => {
  it("returns empty string for no trips", () => {
    expect(tripFingerprint([])).toBe("");
  });

  it("serializes trips to id:priority pairs", () => {
    expect(tripFingerprint([trip("AM", "definitely"), trip("PM", "maybe")]))
      .toBe("AM:definitely|PM:maybe");
  });
});

describe("groupWeekdays", () => {
  it("groups identical weekday patterns together", () => {
    const tripsByWeekday: Record<number, TripTemplate[]> = {
      1: [trip("AM", "definitely")],
      2: [trip("AM", "definitely")],
      3: [trip("AM", "definitely")],
      4: [trip("AM", "definitely")],
      5: [trip("AM", "definitely")],
    };
    const groups = groupWeekdays(tripsByWeekday);
    expect(groups).toHaveLength(2); // Mon-Fri group + empty weekend group
    expect(groups[0].weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(groups[0].trips).toHaveLength(1);
    expect(groups[1].weekdays).toEqual([0, 6]);
    expect(groups[1].trips).toHaveLength(0);
  });

  it("separates weekdays with different patterns", () => {
    const tripsByWeekday: Record<number, TripTemplate[]> = {
      1: [trip("AM", "definitely")],
      5: [trip("AM", "maybe")],
    };
    const groups = groupWeekdays(tripsByWeekday);
    // Mon alone, Fri alone, empty group (Sun,Tue,Wed,Thu,Sat)
    expect(groups).toHaveLength(3);
    expect(groups[0].weekdays).toEqual([1]);
    expect(groups[1].weekdays).toEqual([5]);
    expect(groups[2].trips).toHaveLength(0);
  });

  it("returns single group when all weekdays are empty", () => {
    const groups = groupWeekdays({});
    expect(groups).toHaveLength(1);
    expect(groups[0].weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("sorts non-empty groups before empty groups", () => {
    const tripsByWeekday: Record<number, TripTemplate[]> = {
      5: [trip("AM", "definitely")],
    };
    const groups = groupWeekdays(tripsByWeekday);
    expect(groups[0].trips.length).toBeGreaterThan(0);
    expect(groups[groups.length - 1].trips).toHaveLength(0);
  });
});

describe("formatGroupLabel", () => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = (d: number) => names[d];

  it("returns single day name for one weekday", () => {
    expect(formatGroupLabel([3], dayName)).toBe("Wed");
  });

  it("returns range for consecutive days", () => {
    expect(formatGroupLabel([1, 2, 3, 4, 5], dayName)).toBe("Mon – Fri");
  });

  it("returns comma-separated for non-consecutive days", () => {
    expect(formatGroupLabel([0, 6], dayName)).toBe("Sun, Sat");
  });
});
```

**Step 3:** Run `npx vitest run src/domain/weekdayGroups.test.ts` — expect all pass.

**Step 4:** Commit: `git add src/domain/weekdayGroups.ts src/domain/weekdayGroups.test.ts && git commit -m "feat: add weekday grouping utility"`

---

### Task 3: Add CSS for tabs, collapsible sections, day chips, and group rows

**Files:**
- Modify: `src/styles.css`

**Step 1:** Add the following CSS blocks to `src/styles.css` (append before the responsive media queries section):

**Tab styles:**
```css
/* ─── Setup tabs ────────────────────────────────────────────────────────── */
.setup-tabs {
  display: flex;
  gap: 0;
  padding: 0 16px;
}

.setup-tab {
  flex: 1;
  padding: 10px 0;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  min-height: unset;
  border-radius: 0;
  transition: color 200ms var(--ease-out), border-color 200ms var(--ease-out);
}

.setup-tab:hover:not(:disabled) {
  color: var(--text-secondary);
  background: none;
  border-bottom-color: var(--border);
}

.setup-tab--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.setup-tab--active:hover:not(:disabled) {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: none;
}

.setup-tab-divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0 16px;
}
```

**Collapsible section styles:**
```css
/* ─── Collapsible sections ──────────────────────────────────────────────── */
.collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  cursor: pointer;
  user-select: none;
  border: none;
  background: none;
  width: 100%;
  min-height: unset;
  border-radius: 0;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 700;
  transition: color 180ms var(--ease-out);
}

.collapsible-header:hover:not(:disabled) {
  background: none;
  border-color: var(--border-soft);
}

.collapsible-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.collapsible-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface-2);
  padding: 1px 7px;
  border-radius: 10px;
}

.collapsible-chevron {
  color: var(--text-muted);
  font-size: 0.7rem;
  transition: transform 200ms var(--ease-out);
  display: inline-block;
}

.collapsible-chevron--open {
  transform: rotate(90deg);
}

.collapsible-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms var(--ease-out);
}

.collapsible-body--open {
  grid-template-rows: 1fr;
}

.collapsible-body > div {
  overflow: hidden;
}
```

**Weekday group row styles:**
```css
/* ─── Weekday group rows ────────────────────────────────────────────────── */
.weekday-group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  user-select: none;
  min-height: unset;
  background: var(--surface);
  color: var(--text-primary);
  width: 100%;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: background 180ms var(--ease-out), border-color 180ms var(--ease-out);
}

.weekday-group-row:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--border);
}

.weekday-group-row--expanded {
  border-color: var(--accent);
  background: var(--accent-light);
  border-radius: 10px 10px 0 0;
  margin-bottom: 0;
}

.weekday-group-row--expanded:hover:not(:disabled) {
  background: var(--accent-light);
  border-color: var(--accent);
}

.weekday-group-meta {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.weekday-group-chevron {
  color: var(--text-muted);
  font-size: 0.75rem;
  transition: transform 200ms var(--ease-out);
  display: inline-block;
}

.weekday-group-row--expanded .weekday-group-chevron {
  transform: rotate(90deg);
  color: var(--accent);
}

.weekday-group-expanded {
  border: 1px solid var(--accent);
  border-top: none;
  border-radius: 0 0 10px 10px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--surface);
}
```

**Day chip styles:**
```css
/* ─── Day chips ─────────────────────────────────────────────────────────── */
.day-chips {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.day-chip {
  width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  min-height: unset;
  padding: 0;
  transition: background 180ms var(--ease-out),
              border-color 180ms var(--ease-out),
              color 180ms var(--ease-out),
              transform 120ms var(--ease-out);
}

.day-chip:hover:not(:disabled) {
  background: var(--surface-2);
  border-color: var(--border);
}

.day-chip--active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.day-chip--active:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  opacity: 0.85;
}

.day-chip:active:not(:disabled) {
  transform: scale(0.93);
}
```

**Step 2:** Run `npx tsc --noEmit` — expect clean (CSS-only change).

**Step 3:** Commit: `git add src/styles.css && git commit -m "style: add CSS for tabs, collapsible sections, day chips, group rows"`

---

### Task 4: Refactor SetupPanel into tabbed layout

**Files:**
- Modify: `src/components/SetupPanel.tsx`

This is the main refactor. Split the existing `SetupPanel` into:
- A tab container with `activeTab` state
- `TicketTab` — contains: remaining uses, dates, second ticket, unavailable ranges (collapsible), data transfer
- `TripsTab` — contains: weekday groups with day chips

**Key implementation notes:**

1. **Tab container:** Add `activeTab` state (`"ticket" | "trips"`, default `"ticket"`). Render tab buttons with `role="tablist"` / `role="tab"` / `aria-selected`. Render the active tab's content in a `role="tabpanel"`.

2. **TicketTab:** Move the existing fields (remaining uses, plan start, expiry, second ticket checkbox, unavailable ranges, data transfer) into this component. Wrap unavailable ranges in a collapsible section — collapsed when `plan.unavailableRanges.length === 0`, expanded otherwise. User can toggle manually.

3. **TripsTab:** Use `groupWeekdays()` from Task 2 to compute groups. Each group is a collapsible row. When expanded, show day chips + trip editor. Track `expandedGroup` state (which group fingerprint is expanded, or null). Only one group expanded at a time (accordion behavior).

4. **Day chip splitting:** When a chip is deselected, copy the group's current trips to that weekday's slot in `tripsByWeekday` (they already match, so this is a no-op for data). Then modify the deselected weekday's trips slightly (or leave as-is — the visual split happens because the weekday is now in its own group). Actually, since the data already exists per-weekday, deselecting a chip just means we need to make that weekday's trips *different* from the group so it splits out. The simplest approach: when a user deselects a chip, we don't change data — we just track "forced splits" in local state. A forced-split weekday is excluded from auto-grouping and rendered as its own row. When the user re-selects the chip (or edits the day to match the group), the forced split is removed.

5. **Editing within a group:** When trips are edited in a group (rename, priority change, add, remove), apply the change to ALL weekdays in that group. This keeps them in sync.

6. **The existing `DataTransfer` component** stays as-is (already has Reset + confirmation modals from the previous task). It just moves into the Ticket tab.

**Step 1:** Refactor `SetupPanel` component. The component should:
- Import `groupWeekdays`, `formatGroupLabel` from `../domain/weekdayGroups`
- Add state: `activeTab`, `expandedGroup`, `unavailableExpanded`, `forcedSplits: Set<number>`
- Render tabs + active tab content
- Keep all existing `onPlanChange` callback logic intact

**Step 2:** Run `npx tsc --noEmit` — expect clean.

**Step 3:** Run `npx vitest run src/components/SetupPanel.test.tsx` — some tests will fail because they expect all weekday names to be visible at once. We'll fix tests in Task 5.

**Step 4:** Commit: `git add src/components/SetupPanel.tsx && git commit -m "feat: refactor SetupPanel into tabbed layout with weekday grouping"`

---

### Task 5: Update SetupPanel tests

**Files:**
- Modify: `src/components/SetupPanel.test.tsx`

The existing tests need updates because:
- Weekday sections are now behind the "Trips" tab
- Individual weekday names may not be visible (they're grouped)
- Adding trips requires expanding a group first

**Step 1:** Update tests:

- Tests that interact with weekday trips (add trip, edit trip, remove trip) need to first click the "Trips" tab, then click the relevant group row to expand it.
- The "displays all seven weekday sections" test should be replaced with a test that verifies groups are shown (e.g., "Mon – Fri" and "Sat – Sun" for the default plan).
- The "shows trip count per weekday" test should be replaced with a test that verifies group-level trip counts.
- Tests for unavailable ranges, second ticket checkbox, and data transfer should work on the "Ticket" tab (default), so they may need minimal changes.

**Step 2:** Run `npx vitest run src/components/SetupPanel.test.tsx` — expect all pass.

**Step 3:** Run `npx vitest run` — expect all 149+ tests pass.

**Step 4:** Commit: `git add src/components/SetupPanel.test.tsx && git commit -m "test: update SetupPanel tests for tabbed layout"`

---

### Task 6: Update SetupPanelModal tests if needed

**Files:**
- Modify: `src/components/SetupPanelModal.test.tsx` (if any tests break)

**Step 1:** Run `npx vitest run src/components/SetupPanelModal.test.tsx` — check if all pass.

**Step 2:** Fix any failures (likely minimal — the modal wraps SetupPanel, so if SetupPanel tests pass, modal tests should too).

**Step 3:** Run full test suite: `npx vitest run` — expect all pass.

**Step 4:** Commit if changes were needed: `git add src/components/SetupPanelModal.test.tsx && git commit -m "test: fix SetupPanelModal tests for tabbed layout"`

---

### Task 7: Visual verification and polish

**Files:**
- Possibly: `src/styles.css` (minor tweaks)

**Step 1:** Start dev server, open the app, verify:
- Ticket tab shows by default with all fields
- Unavailable ranges collapse/expand correctly
- Switching to Trips tab shows grouped weekdays
- Expanding a group shows day chips + trip editor
- Editing a trip in a group updates all days in the group
- Deselecting a day chip splits it into its own group
- Re-selecting or matching trips auto-merges
- Dark mode renders correctly
- Mobile bottom sheet works with tabs

**Step 2:** Fix any visual issues found.

**Step 3:** Run full test suite one final time: `npx vitest run`

**Step 4:** Commit any polish: `git commit -m "style: polish setup panel redesign"`
