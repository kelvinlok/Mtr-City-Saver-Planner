# MTR City Saver Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only calendar app that optimizes remaining MTR City Saver ticket rides before expiry while respecting default usage, manual day edits, and unavailable ranges.

**Architecture:** Use a Vite + React + TypeScript single-page app. Keep optimizer logic in pure TypeScript modules with unit tests, then connect it to React components through local state and localStorage persistence. The UI is calendar-first: setup panel, month calendar, selected-day editor, and usage summary.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, date-fns, browser localStorage.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Modify `.gitignore`: ignore app build and dependency output.
- Create `index.html`: Vite entry document.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: TypeScript and test configuration.
- Create `src/main.tsx`: React entry point.
- Create `src/App.tsx`: top-level planner state and layout orchestration.
- Create `src/styles.css`: global app styles and calendar layout styles.
- Create `src/domain/types.ts`: planner data types and constants.
- Create `src/domain/dateUtils.ts`: ISO date helpers used by the optimizer and calendar.
- Create `src/domain/optimizer.ts`: pure optimization function.
- Create `src/domain/validation.ts`: pure validation helpers.
- Create `src/storage/plans.ts`: localStorage load/save helpers.
- Create `src/components/SetupPanel.tsx`: ticket setup, default pattern, unavailable ranges.
- Create `src/components/CalendarView.tsx`: month calendars and day cells.
- Create `src/components/DayEditor.tsx`: selected-day trip editing.
- Create `src/components/Summary.tsx`: usage counts and warnings.
- Create `src/domain/optimizer.test.ts`: optimizer behavior tests.
- Create `src/domain/validation.test.ts`: validation tests.
- Create `src/App.test.tsx`: smoke tests for render and edit flow.

## Task 1: Project Shell And Test Harness

**Files:**
- Create: `package.json`
- Modify: `.gitignore`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create package metadata and scripts**

Write `package.json`:

```json
{
  "name": "mtr-city-saver-planner",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "date-fns": "^4.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Update ignored generated files**

Append these entries to `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
```

- [ ] **Step 3: Create Vite and TypeScript config files**

Write `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MTR City Saver Planner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Write `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Write `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: []
  }
});
```

- [ ] **Step 4: Create a minimal app entry**

Write `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Write `src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="app-header">
        <div>
          <p className="eyebrow">MTR City Saver</p>
          <h1>Ticket usage planner</h1>
        </div>
      </section>
      <section className="empty-state">
        Planner shell ready.
      </section>
    </main>
  );
}
```

Write `src/styles.css`:

```css
:root {
  color: #182026;
  background: #f5f7f8;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 auto 20px;
  max-width: 1440px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #5b6770;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 1.8rem;
  letter-spacing: 0;
}

.empty-state {
  display: grid;
  min-height: 360px;
  place-items: center;
  max-width: 1440px;
  margin: 0 auto;
  border: 1px solid #d7dde2;
  background: #ffffff;
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: npm creates `package-lock.json` and installs dependencies without errors.

- [ ] **Step 6: Verify the shell builds**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully and write `dist/`.

- [ ] **Step 7: Commit the project shell**

Run:

```bash
git add .gitignore package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/main.tsx src/App.tsx src/styles.css
git commit -m "feat: scaffold planner app"
```

## Task 2: Domain Types And Date Utilities

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/dateUtils.ts`
- Create: `src/domain/dateUtils.test.ts`

- [ ] **Step 1: Write date utility tests**

Write `src/domain/dateUtils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eachDateInclusive, formatIsoDate, getMonthKeysInRange, isDateInRange } from "./dateUtils";

describe("dateUtils", () => {
  it("lists each date inclusively", () => {
    expect(eachDateInclusive("2026-05-01", "2026-05-03")).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03"
    ]);
  });

  it("detects dates inside inclusive ranges", () => {
    expect(isDateInRange("2026-05-10", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(true);
    expect(isDateInRange("2026-05-14", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(true);
    expect(isDateInRange("2026-05-15", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(false);
  });

  it("returns month keys across a range", () => {
    expect(getMonthKeysInRange("2026-04-28", "2026-06-02")).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("formats local dates as ISO calendar dates", () => {
    expect(formatIsoDate(new Date(2026, 4, 9))).toBe("2026-05-09");
  });
});
```

- [ ] **Step 2: Run date tests to verify failure**

Run:

```bash
npm test -- src/domain/dateUtils.test.ts
```

Expected: FAIL because `src/domain/dateUtils.ts` does not exist.

- [ ] **Step 3: Add domain types**

Write `src/domain/types.ts`:

```ts
export type TripPriority = "definitely" | "maybe" | "not_preferred";

export const PRIORITY_LABELS: Record<TripPriority, string> = {
  definitely: "Definitely",
  maybe: "Maybe",
  not_preferred: "Not preferred"
};

export const PRIORITY_ORDER: Record<TripPriority, number> = {
  definitely: 0,
  maybe: 1,
  not_preferred: 2
};

export type TripTemplate = {
  id: string;
  priority: TripPriority;
};

export type DefaultPattern = {
  tripsByWeekday: Record<number, TripTemplate[]>;
};

export type DateRange = {
  id: string;
  startDate: string;
  endDate: string;
};

export type DayOverride = {
  unavailable?: boolean;
  trips?: TripTemplate[];
};

export type TicketPlan = {
  remainingUses: number;
  planStartDate: string;
  expiryDate: string;
  defaultPattern: DefaultPattern;
  unavailableRanges: DateRange[];
  dayOverrides: Record<string, DayOverride>;
};

export type GeneratedTrip = {
  id: string;
  date: string;
  tripIndex: number;
  priority: TripPriority;
  source: "default" | "override";
};

export type OptimizedTrip = GeneratedTrip & {
  useCitySaver: boolean;
};

export type OptimizedDay = {
  date: string;
  unavailable: boolean;
  trips: OptimizedTrip[];
  hasOverride: boolean;
};

export type OptimizationResult = {
  days: OptimizedDay[];
  assignedUses: number;
  unusedUses: number;
  normalPayTrips: number;
  priorityUseCounts: Record<TripPriority, number>;
};
```

- [ ] **Step 4: Add date utilities**

Write `src/domain/dateUtils.ts`:

```ts
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth
} from "date-fns";
import type { DateRange } from "./types";

export function parseIsoDate(value: string): Date {
  return parseISO(value);
}

export function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getTodayIsoDate(): string {
  return formatIsoDate(new Date());
}

export function compareIsoDates(left: string, right: string): number {
  return parseIsoDate(left).getTime() - parseIsoDate(right).getTime();
}

export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (isAfter(start, end)) {
    return [];
  }

  return eachDayOfInterval({ start, end }).map(formatIsoDate);
}

export function isDateInRange(date: string, range: Pick<DateRange, "startDate" | "endDate">): boolean {
  return compareIsoDates(date, range.startDate) >= 0 && compareIsoDates(date, range.endDate) <= 0;
}

export function isDateInRanges(date: string, ranges: Pick<DateRange, "startDate" | "endDate">[]): boolean {
  return ranges.some((range) => isDateInRange(date, range));
}

export function getWeekdayIndex(date: string): number {
  return parseIsoDate(date).getDay();
}

export function getMonthKeysInRange(startDate: string, endDate: string): string[] {
  const start = startOfMonth(parseIsoDate(startDate));
  const end = startOfMonth(parseIsoDate(endDate));
  const keys: string[] = [];

  for (let cursor = start; !isAfter(cursor, end); cursor = addMonths(cursor, 1)) {
    keys.push(format(cursor, "yyyy-MM"));
  }

  return keys;
}

export function getDatesForMonth(monthKey: string): string[] {
  const firstDay = parseISO(`${monthKey}-01`);
  return eachDayOfInterval({
    start: startOfMonth(firstDay),
    end: endOfMonth(firstDay)
  }).map(formatIsoDate);
}

export function shiftIsoDate(date: string, days: number): string {
  return formatIsoDate(addDays(parseIsoDate(date), days));
}

export function isBeforeIso(left: string, right: string): boolean {
  return isBefore(parseIsoDate(left), parseIsoDate(right));
}

export function isAfterIso(left: string, right: string): boolean {
  return isAfter(parseIsoDate(left), parseIsoDate(right));
}
```

- [ ] **Step 5: Run date tests to verify pass**

Run:

```bash
npm test -- src/domain/dateUtils.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit domain primitives**

Run:

```bash
git add src/domain/types.ts src/domain/dateUtils.ts src/domain/dateUtils.test.ts
git commit -m "feat: add planner domain primitives"
```

## Task 3: Optimizer

**Files:**
- Create: `src/domain/optimizer.test.ts`
- Create: `src/domain/optimizer.ts`

- [ ] **Step 1: Write optimizer tests**

Write `src/domain/optimizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { optimizePlan } from "./optimizer";
import type { TicketPlan, TripTemplate } from "./types";

const definitely = (id: string): TripTemplate => ({ id, priority: "definitely" });
const maybe = (id: string): TripTemplate => ({ id, priority: "maybe" });
const notPreferred = (id: string): TripTemplate => ({ id, priority: "not_preferred" });

function basePlan(overrides: Partial<TicketPlan> = {}): TicketPlan {
  return {
    remainingUses: 4,
    planStartDate: "2026-05-04",
    expiryDate: "2026-05-08",
    defaultPattern: {
      tripsByWeekday: {
        1: [definitely("mon-out"), definitely("mon-back")],
        2: [maybe("tue-out"), maybe("tue-back")],
        3: [notPreferred("wed-out"), notPreferred("wed-back")],
        4: [definitely("thu-out"), maybe("thu-back")],
        5: [notPreferred("fri-out")]
      }
    },
    unavailableRanges: [],
    dayOverrides: {},
    ...overrides
  };
}

describe("optimizePlan", () => {
  it("assigns City Saver uses by priority, then date, then trip order", () => {
    const result = optimizePlan(basePlan({ remainingUses: 3 }));
    const assigned = result.days.flatMap((day) => day.trips.filter((trip) => trip.useCitySaver));

    expect(assigned.map((trip) => trip.id)).toEqual(["mon-out", "mon-back", "thu-out"]);
    expect(result.assignedUses).toBe(3);
    expect(result.unusedUses).toBe(0);
  });

  it("uses lower priority trips when needed to avoid wasting uses", () => {
    const result = optimizePlan(basePlan({ remainingUses: 8 }));
    const assigned = result.days.flatMap((day) => day.trips.filter((trip) => trip.useCitySaver));

    expect(assigned).toHaveLength(8);
    expect(assigned.some((trip) => trip.priority === "not_preferred")).toBe(true);
    expect(result.unusedUses).toBe(0);
  });

  it("reports unused uses when there are not enough eligible trips", () => {
    const result = optimizePlan(basePlan({ remainingUses: 20 }));

    expect(result.assignedUses).toBe(9);
    expect(result.unusedUses).toBe(11);
  });

  it("excludes multiple unavailable date ranges", () => {
    const result = optimizePlan(basePlan({
      remainingUses: 8,
      unavailableRanges: [
        { id: "travel-a", startDate: "2026-05-05", endDate: "2026-05-05" },
        { id: "travel-b", startDate: "2026-05-07", endDate: "2026-05-08" }
      ]
    }));

    expect(result.days.find((day) => day.date === "2026-05-05")?.unavailable).toBe(true);
    expect(result.days.find((day) => day.date === "2026-05-05")?.trips).toEqual([]);
    expect(result.assignedUses).toBe(4);
    expect(result.unusedUses).toBe(4);
  });

  it("replaces defaults with manual day overrides", () => {
    const result = optimizePlan(basePlan({
      remainingUses: 2,
      dayOverrides: {
        "2026-05-04": {
          trips: [notPreferred("manual-late-trip")]
        }
      }
    }));

    const day = result.days.find((entry) => entry.date === "2026-05-04");
    expect(day?.trips.map((trip) => trip.id)).toEqual(["manual-late-trip"]);
    expect(day?.trips[0]?.source).toBe("override");
  });

  it("lets a day override mark a day unavailable", () => {
    const result = optimizePlan(basePlan({
      dayOverrides: {
        "2026-05-04": {
          unavailable: true
        }
      }
    }));

    const day = result.days.find((entry) => entry.date === "2026-05-04");
    expect(day?.unavailable).toBe(true);
    expect(day?.trips).toEqual([]);
  });
});
```

- [ ] **Step 2: Run optimizer tests to verify failure**

Run:

```bash
npm test -- src/domain/optimizer.test.ts
```

Expected: FAIL because `optimizePlan` is not implemented.

- [ ] **Step 3: Implement optimizer**

Write `src/domain/optimizer.ts`:

```ts
import { eachDateInclusive, getWeekdayIndex, isDateInRanges } from "./dateUtils";
import { PRIORITY_ORDER, type GeneratedTrip, type OptimizationResult, type OptimizedTrip, type TicketPlan, type TripPriority } from "./types";

function makeGeneratedTrip(date: string, tripIndex: number, templateId: string, priority: TripPriority, source: GeneratedTrip["source"]): GeneratedTrip {
  return {
    id: templateId,
    date,
    tripIndex,
    priority,
    source
  };
}

function getGeneratedTripsForDate(plan: TicketPlan, date: string): GeneratedTrip[] {
  const override = plan.dayOverrides[date];

  if (override?.unavailable) {
    return [];
  }

  if (override?.trips) {
    return override.trips.map((trip, index) =>
      makeGeneratedTrip(date, index, trip.id, trip.priority, "override")
    );
  }

  if (isDateInRanges(date, plan.unavailableRanges)) {
    return [];
  }

  const weekday = getWeekdayIndex(date);
  const templates = plan.defaultPattern.tripsByWeekday[weekday] ?? [];

  return templates.map((trip, index) =>
    makeGeneratedTrip(date, index, trip.id, trip.priority, "default")
  );
}

export function optimizePlan(plan: TicketPlan): OptimizationResult {
  const dates = eachDateInclusive(plan.planStartDate, plan.expiryDate);
  const generatedTrips = dates.flatMap((date) => getGeneratedTripsForDate(plan, date));
  const selectedTripKeys = new Set(
    [...generatedTrips]
      .sort((left, right) => {
        const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
        if (priorityDelta !== 0) return priorityDelta;
        const dateDelta = left.date.localeCompare(right.date);
        if (dateDelta !== 0) return dateDelta;
        return left.tripIndex - right.tripIndex;
      })
      .slice(0, plan.remainingUses)
      .map((trip) => `${trip.date}:${trip.tripIndex}:${trip.id}`)
  );

  const days = dates.map((date) => {
    const override = plan.dayOverrides[date];
    const rangeUnavailable = isDateInRanges(date, plan.unavailableRanges);
    const unavailable = Boolean(override?.unavailable || rangeUnavailable);
    const trips = unavailable ? [] : getGeneratedTripsForDate(plan, date).map<OptimizedTrip>((trip) => ({
      ...trip,
      useCitySaver: selectedTripKeys.has(`${trip.date}:${trip.tripIndex}:${trip.id}`)
    }));

    return {
      date,
      unavailable,
      trips,
      hasOverride: Boolean(override)
    };
  });

  const assignedTrips = days.flatMap((day) => day.trips).filter((trip) => trip.useCitySaver);
  const allTrips = days.flatMap((day) => day.trips);

  return {
    days,
    assignedUses: assignedTrips.length,
    unusedUses: Math.max(0, plan.remainingUses - assignedTrips.length),
    normalPayTrips: allTrips.length - assignedTrips.length,
    priorityUseCounts: {
      definitely: assignedTrips.filter((trip) => trip.priority === "definitely").length,
      maybe: assignedTrips.filter((trip) => trip.priority === "maybe").length,
      not_preferred: assignedTrips.filter((trip) => trip.priority === "not_preferred").length
    }
  };
}
```

- [ ] **Step 4: Run optimizer tests to verify pass**

Run:

```bash
npm test -- src/domain/optimizer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit optimizer**

Run:

```bash
git add src/domain/optimizer.ts src/domain/optimizer.test.ts
git commit -m "feat: add ticket usage optimizer"
```

## Task 4: Validation And Local Persistence

**Files:**
- Create: `src/domain/validation.ts`
- Create: `src/domain/validation.test.ts`
- Create: `src/storage/plans.ts`

- [ ] **Step 1: Write validation tests**

Write `src/domain/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePlan } from "./validation";
import type { TicketPlan } from "./types";

function validPlan(overrides: Partial<TicketPlan> = {}): TicketPlan {
  return {
    remainingUses: 10,
    planStartDate: "2026-05-01",
    expiryDate: "2026-05-30",
    defaultPattern: { tripsByWeekday: {} },
    unavailableRanges: [],
    dayOverrides: {},
    ...overrides
  };
}

describe("validatePlan", () => {
  it("accepts a valid plan", () => {
    expect(validatePlan(validPlan())).toEqual([]);
  });

  it("flags remaining uses outside City Saver bounds", () => {
    expect(validatePlan(validPlan({ remainingUses: -1 }))).toContain("Remaining uses must be between 0 and 40.");
    expect(validatePlan(validPlan({ remainingUses: 41 }))).toContain("Remaining uses must be between 0 and 40.");
  });

  it("flags expiry before plan start", () => {
    expect(validatePlan(validPlan({ planStartDate: "2026-05-30", expiryDate: "2026-05-01" }))).toContain("Expiry date must be on or after the plan start date.");
  });

  it("flags unavailable ranges with end before start", () => {
    expect(validatePlan(validPlan({
      unavailableRanges: [{ id: "bad-range", startDate: "2026-05-20", endDate: "2026-05-10" }]
    }))).toContain("Unavailable range 1 must end on or after it starts.");
  });
});
```

- [ ] **Step 2: Run validation tests to verify failure**

Run:

```bash
npm test -- src/domain/validation.test.ts
```

Expected: FAIL because `validatePlan` is not implemented.

- [ ] **Step 3: Implement validation**

Write `src/domain/validation.ts`:

```ts
import { compareIsoDates } from "./dateUtils";
import type { TicketPlan } from "./types";

export function validatePlan(plan: TicketPlan): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(plan.remainingUses) || plan.remainingUses < 0 || plan.remainingUses > 40) {
    errors.push("Remaining uses must be between 0 and 40.");
  }

  if (compareIsoDates(plan.expiryDate, plan.planStartDate) < 0) {
    errors.push("Expiry date must be on or after the plan start date.");
  }

  plan.unavailableRanges.forEach((range, index) => {
    if (compareIsoDates(range.endDate, range.startDate) < 0) {
      errors.push(`Unavailable range ${index + 1} must end on or after it starts.`);
    }
  });

  Object.entries(plan.dayOverrides).forEach(([date, override]) => {
    const tripIds = new Set<string>();

    override.trips?.forEach((trip, index) => {
      if (!trip.id.trim()) {
        errors.push(`Trip ${index + 1} on ${date} needs a label.`);
      }

      if (tripIds.has(trip.id)) {
        errors.push(`Trip labels on ${date} must be unique.`);
      }

      tripIds.add(trip.id);
    });
  });

  return errors;
}
```

- [ ] **Step 4: Add localStorage helpers**

Write `src/storage/plans.ts`:

```ts
import { getTodayIsoDate, shiftIsoDate } from "../domain/dateUtils";
import type { TicketPlan, TripPriority, TripTemplate } from "../domain/types";

const STORAGE_KEY = "mtr-city-saver-plan:v1";

function trip(id: string, priority: TripPriority): TripTemplate {
  return { id, priority };
}

export function createDefaultPlan(today = getTodayIsoDate()): TicketPlan {
  return {
    remainingUses: 40,
    planStartDate: today,
    expiryDate: shiftIsoDate(today, 39),
    defaultPattern: {
      tripsByWeekday: {
        1: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        2: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        3: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        4: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        5: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")]
      }
    },
    unavailableRanges: [],
    dayOverrides: {}
  };
}

export function loadPlan(): TicketPlan {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return createDefaultPlan();
  }

  try {
    return JSON.parse(raw) as TicketPlan;
  } catch {
    return createDefaultPlan();
  }
}

export function savePlan(plan: TicketPlan): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}
```

- [ ] **Step 5: Run validation tests**

Run:

```bash
npm test -- src/domain/validation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run all domain tests**

Run:

```bash
npm test -- src/domain
```

Expected: PASS for date utilities, validation, and optimizer.

- [ ] **Step 7: Commit validation and persistence**

Run:

```bash
git add src/domain/validation.ts src/domain/validation.test.ts src/storage/plans.ts
git commit -m "feat: add validation and local plan storage"
```

## Task 5: Calendar Planner UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/SetupPanel.tsx`
- Create: `src/components/CalendarView.tsx`
- Create: `src/components/DayEditor.tsx`
- Create: `src/components/Summary.tsx`

- [ ] **Step 1: Replace app shell with planner state wiring**

Write `src/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { CalendarView } from "./components/CalendarView";
import { DayEditor } from "./components/DayEditor";
import { SetupPanel } from "./components/SetupPanel";
import { Summary } from "./components/Summary";
import { optimizePlan } from "./domain/optimizer";
import { validatePlan } from "./domain/validation";
import type { TicketPlan } from "./domain/types";
import { loadPlan, savePlan } from "./storage/plans";

export function App() {
  const [plan, setPlan] = useState<TicketPlan>(() => loadPlan());
  const [selectedDate, setSelectedDate] = useState(plan.planStartDate);
  const result = useMemo(() => optimizePlan(plan), [plan]);
  const validationErrors = useMemo(() => validatePlan(plan), [plan]);

  useEffect(() => {
    savePlan(plan);
  }, [plan]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MTR City Saver</p>
          <h1>Ticket usage planner</h1>
        </div>
      </header>

      <Summary result={result} validationErrors={validationErrors} />

      <section className="planner-grid">
        <SetupPanel plan={plan} onPlanChange={setPlan} />
        <CalendarView plan={plan} result={result} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <DayEditor selectedDate={selectedDate} plan={plan} onPlanChange={setPlan} />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Add setup panel**

Write `src/components/SetupPanel.tsx`:

```tsx
import type { DateRange, TicketPlan } from "../domain/types";

type SetupPanelProps = {
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
};

function updateRange(ranges: DateRange[], id: string, patch: Partial<DateRange>): DateRange[] {
  return ranges.map((range) => (range.id === id ? { ...range, ...patch } : range));
}

export function SetupPanel({ plan, onPlanChange }: SetupPanelProps) {
  return (
    <aside className="panel">
      <h2>Setup</h2>
      <label className="field">
        Remaining uses
        <input
          type="number"
          min={0}
          max={40}
          value={plan.remainingUses}
          onChange={(event) => onPlanChange({ ...plan, remainingUses: Number(event.target.value) })}
        />
      </label>
      <label className="field">
        Plan start
        <input
          type="date"
          value={plan.planStartDate}
          onChange={(event) => onPlanChange({ ...plan, planStartDate: event.target.value })}
        />
      </label>
      <label className="field">
        Ticket expiry
        <input
          type="date"
          value={plan.expiryDate}
          onChange={(event) => onPlanChange({ ...plan, expiryDate: event.target.value })}
        />
      </label>

      <section className="panel-section">
        <div className="section-heading">
          <h3>Unavailable ranges</h3>
          <button
            type="button"
            onClick={() =>
              onPlanChange({
                ...plan,
                unavailableRanges: [
                  ...plan.unavailableRanges,
                  { id: crypto.randomUUID(), startDate: plan.planStartDate, endDate: plan.planStartDate }
                ]
              })
            }
          >
            Add
          </button>
        </div>
        {plan.unavailableRanges.map((range, index) => (
          <div className="range-row" key={range.id}>
            <span>Range {index + 1}</span>
            <input
              type="date"
              value={range.startDate}
              onChange={(event) =>
                onPlanChange({ ...plan, unavailableRanges: updateRange(plan.unavailableRanges, range.id, { startDate: event.target.value }) })
              }
            />
            <input
              type="date"
              value={range.endDate}
              onChange={(event) =>
                onPlanChange({ ...plan, unavailableRanges: updateRange(plan.unavailableRanges, range.id, { endDate: event.target.value }) })
              }
            />
            <button
              type="button"
              aria-label={`Remove unavailable range ${index + 1}`}
              onClick={() =>
                onPlanChange({ ...plan, unavailableRanges: plan.unavailableRanges.filter((item) => item.id !== range.id) })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </section>
    </aside>
  );
}
```

- [ ] **Step 3: Add calendar view**

Write `src/components/CalendarView.tsx`:

```tsx
import { format, parseISO } from "date-fns";
import { getDatesForMonth, getMonthKeysInRange } from "../domain/dateUtils";
import type { OptimizationResult, TicketPlan } from "../domain/types";

type CalendarViewProps = {
  plan: TicketPlan;
  result: OptimizationResult;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ plan, result, selectedDate, onSelectDate }: CalendarViewProps) {
  const dayMap = new Map(result.days.map((day) => [day.date, day]));
  const monthKeys = getMonthKeysInRange(plan.planStartDate, plan.expiryDate);

  return (
    <section className="calendar-region">
      {monthKeys.map((monthKey) => (
        <article className="month" key={monthKey}>
          <h2>{format(parseISO(`${monthKey}-01`), "MMMM yyyy")}</h2>
          <div className="weekday-grid">
            {weekdayLabels.map((label) => (
              <div className="weekday" key={label}>{label}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {getDatesForMonth(monthKey).map((date) => {
              const day = dayMap.get(date);
              const inWindow = Boolean(day);
              const citySaverCount = day?.trips.filter((trip) => trip.useCitySaver).length ?? 0;
              const normalCount = day?.trips.filter((trip) => !trip.useCitySaver).length ?? 0;

              return (
                <button
                  className={[
                    "day-cell",
                    selectedDate === date ? "selected" : "",
                    day?.unavailable ? "unavailable" : "",
                    !inWindow ? "outside-window" : ""
                  ].join(" ")}
                  type="button"
                  key={date}
                  disabled={!inWindow}
                  onClick={() => onSelectDate(date)}
                >
                  <span className="day-number">{format(parseISO(date), "d")}</span>
                  {day?.unavailable ? <span className="tag muted">Unavailable</span> : null}
                  {citySaverCount > 0 ? <span className="tag use">Use x{citySaverCount}</span> : null}
                  {normalCount > 0 ? <span className="tag pay">Pay x{normalCount}</span> : null}
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Add selected day editor**

Write `src/components/DayEditor.tsx`:

```tsx
import type { DayOverride, TicketPlan, TripPriority, TripTemplate } from "../domain/types";
import { PRIORITY_LABELS } from "../domain/types";

type DayEditorProps = {
  selectedDate: string;
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
};

const priorityOptions: TripPriority[] = ["definitely", "maybe", "not_preferred"];

function getOverride(plan: TicketPlan, selectedDate: string): DayOverride {
  return plan.dayOverrides[selectedDate] ?? {
    trips: plan.defaultPattern.tripsByWeekday[new Date(`${selectedDate}T00:00:00`).getDay()] ?? []
  };
}

export function DayEditor({ selectedDate, plan, onPlanChange }: DayEditorProps) {
  const override = getOverride(plan, selectedDate);
  const trips = override.trips ?? [];

  function saveOverride(nextOverride: DayOverride) {
    onPlanChange({
      ...plan,
      dayOverrides: {
        ...plan.dayOverrides,
        [selectedDate]: nextOverride
      }
    });
  }

  function updateTrip(index: number, patch: Partial<TripTemplate>) {
    saveOverride({
      ...override,
      unavailable: false,
      trips: trips.map((trip, tripIndex) => (tripIndex === index ? { ...trip, ...patch } : trip))
    });
  }

  return (
    <aside className="panel">
      <h2>{selectedDate}</h2>
      <div className="button-row">
        <button type="button" onClick={() => saveOverride({ unavailable: true, trips: [] })}>Mark unavailable</button>
        <button
          type="button"
          onClick={() => {
            const { [selectedDate]: _removed, ...rest } = plan.dayOverrides;
            onPlanChange({ ...plan, dayOverrides: rest });
          }}
        >
          Clear override
        </button>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <h3>Trips</h3>
          <button
            type="button"
            onClick={() =>
              saveOverride({
                ...override,
                unavailable: false,
                trips: [...trips, { id: `Trip ${trips.length + 1}`, priority: "maybe" }]
              })
            }
          >
            Add
          </button>
        </div>

        {trips.map((trip, index) => (
          <div className="trip-row" key={`${trip.id}-${index}`}>
            <input
              aria-label={`Trip ${index + 1} label`}
              value={trip.id}
              onChange={(event) => updateTrip(index, { id: event.target.value })}
            />
            <select
              aria-label={`Trip ${index + 1} priority`}
              value={trip.priority}
              onChange={(event) => updateTrip(index, { priority: event.target.value as TripPriority })}
            >
              {priorityOptions.map((priority) => (
                <option value={priority} key={priority}>{PRIORITY_LABELS[priority]}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Remove trip ${index + 1}`}
              onClick={() => saveOverride({ ...override, trips: trips.filter((_, tripIndex) => tripIndex !== index) })}
            >
              Remove
            </button>
          </div>
        ))}
      </section>
    </aside>
  );
}
```

- [ ] **Step 5: Add summary**

Write `src/components/Summary.tsx`:

```tsx
import type { OptimizationResult } from "../domain/types";

type SummaryProps = {
  result: OptimizationResult;
  validationErrors: string[];
};

export function Summary({ result, validationErrors }: SummaryProps) {
  return (
    <section className="summary-strip">
      <div>
        <span className="metric">{result.assignedUses}</span>
        <span>planned uses</span>
      </div>
      <div>
        <span className="metric">{result.unusedUses}</span>
        <span>cannot use before expiry</span>
      </div>
      <div>
        <span className="metric">{result.normalPayTrips}</span>
        <span>normal-pay trips</span>
      </div>
      <div className="priority-counts">
        <span>Definitely {result.priorityUseCounts.definitely}</span>
        <span>Maybe {result.priorityUseCounts.maybe}</span>
        <span>Not preferred {result.priorityUseCounts.not_preferred}</span>
      </div>
      {validationErrors.length > 0 ? (
        <ul className="error-list" aria-label="Validation errors">
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 6: Replace styles with full planner layout**

Write `src/styles.css`:

```css
:root {
  color: #182026;
  background: #f5f7f8;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 1px solid #b9c3ca;
  border-radius: 6px;
  background: #ffffff;
  color: #182026;
  cursor: pointer;
  min-height: 34px;
  padding: 6px 10px;
}

button:hover:not(:disabled) {
  background: #eef4f7;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

input,
select {
  width: 100%;
  min-height: 34px;
  border: 1px solid #cbd4da;
  border-radius: 6px;
  background: #ffffff;
  padding: 6px 8px;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}

.app-header,
.planner-grid,
.summary-strip {
  max-width: 1480px;
  margin-left: auto;
  margin-right: auto;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #5b6770;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2,
h3 {
  letter-spacing: 0;
}

h1 {
  margin: 0;
  font-size: 1.8rem;
}

h2 {
  margin: 0 0 12px;
  font-size: 1.05rem;
}

h3 {
  margin: 0;
  font-size: 0.92rem;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-strip > div,
.error-list {
  min-height: 64px;
  border: 1px solid #d7dde2;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
}

.metric {
  display: block;
  font-size: 1.5rem;
  font-weight: 800;
}

.priority-counts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-list {
  grid-column: 1 / -1;
  margin: 0;
  color: #9c2f2f;
}

.planner-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.panel,
.month {
  border: 1px solid #d7dde2;
  border-radius: 8px;
  background: #ffffff;
  padding: 14px;
}

.field,
.panel-section,
.trip-row,
.range-row {
  display: grid;
  gap: 8px;
}

.field {
  margin-bottom: 12px;
  color: #44515a;
  font-size: 0.86rem;
  font-weight: 700;
}

.panel-section {
  margin-top: 18px;
}

.section-heading,
.button-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.button-row {
  justify-content: flex-start;
}

.range-row,
.trip-row {
  border-top: 1px solid #e4e9ed;
  padding-top: 10px;
}

.calendar-region {
  display: grid;
  gap: 16px;
}

.weekday-grid,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.weekday {
  color: #65717a;
  font-size: 0.78rem;
  font-weight: 800;
  text-align: center;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 92px;
  gap: 4px;
  border-color: #d7dde2;
  text-align: left;
}

.day-cell.selected {
  border-color: #007a78;
  box-shadow: 0 0 0 2px rgba(0, 122, 120, 0.16);
}

.day-cell.unavailable {
  background: #eef0f1;
  color: #6b7378;
}

.day-cell.outside-window {
  background: #f8f9fa;
}

.day-number {
  font-weight: 800;
}

.tag {
  display: inline-flex;
  max-width: 100%;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 0.75rem;
  line-height: 1.25;
}

.tag.use {
  background: #dff4ee;
  color: #006c58;
}

.tag.pay {
  background: #fff0d9;
  color: #825000;
}

.tag.muted {
  background: #dfe3e6;
  color: #5b6770;
}

@media (max-width: 1120px) {
  .planner-grid {
    grid-template-columns: 1fr;
  }

  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .app-shell {
    padding: 14px;
  }

  .summary-strip {
    grid-template-columns: 1fr;
  }

  .calendar-grid,
  .weekday-grid {
    gap: 4px;
  }

  .day-cell {
    min-height: 78px;
    padding: 6px;
  }
}
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit planner UI**

Run:

```bash
git add src/App.tsx src/styles.css src/components/SetupPanel.tsx src/components/CalendarView.tsx src/components/DayEditor.tsx src/components/Summary.tsx
git commit -m "feat: add calendar planner interface"
```

## Task 6: App Tests, Browser Verification, And Final Polish

**Files:**
- Create: `src/App.test.tsx`
- Modify: `src/components/DayEditor.tsx` if tests expose accessibility gaps.
- Modify: `src/styles.css` if browser verification exposes layout issues.

- [ ] **Step 1: Write app smoke tests**

Write `src/App.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the planner shell with summary and setup controls", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Ticket usage planner" })).toBeInTheDocument();
    expect(screen.getByLabelText("Remaining uses")).toBeInTheDocument();
    expect(screen.getByText("planned uses")).toBeInTheDocument();
  });

  it("updates remaining uses from the setup panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("Remaining uses");
    await user.clear(input);
    await user.type(input, "12");

    expect(input).toHaveValue(12);
    expect(window.localStorage.getItem("mtr-city-saver-plan:v1")).toContain("\"remainingUses\":12");
  });
});
```

- [ ] **Step 2: Run app tests to verify failure or pass**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS for all test files.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` is generated.

- [ ] **Step 5: Start the dev server**

Run:

```bash
npm run dev -- --port 5173
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 6: Browser verification**

Open the local URL and verify:

- The setup panel, calendar, day editor, and summary are visible on desktop.
- Changing remaining uses updates the summary.
- Adding an unavailable range marks dates unavailable after the values are set.
- Selecting a calendar day updates the day editor.
- Adding a trip to a selected day changes the day cell labels.
- The layout remains usable at a mobile-width viewport.
- The browser console has no uncaught errors.

- [ ] **Step 7: Commit verification polish**

If Step 6 required code changes, run:

```bash
git add src
git commit -m "fix: polish planner interactions"
```

If Step 6 required no code changes, skip this commit.

- [ ] **Step 8: Final status check**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation files except ignored `dist/` output if it is not tracked.

## Self-Review Notes

- Spec coverage: The plan covers local-only storage, remaining uses, editable plan start and expiry dates, default weekday usage, multiple unavailable ranges, manual day overrides, manual priorities, calendar result labels, validation, optimizer tests, and browser verification.
- Scope check: This is one cohesive app and does not need to be split into multiple implementation plans.
- Type consistency: The same `TicketPlan`, `TripTemplate`, `DateRange`, `DayOverride`, `OptimizationResult`, and `TripPriority` names are used across domain, storage, and UI tasks.
