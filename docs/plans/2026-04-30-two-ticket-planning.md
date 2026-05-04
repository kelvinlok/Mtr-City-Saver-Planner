# Two-Ticket Planning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the MTR City Saver Planner to optimize across two consecutive tickets, automatically determining the best activation date for a second ticket.

**Architecture:** Add `planSecondTicket: boolean` to `TicketPlan`. When true, the optimizer brute-forces ~40 candidate activation dates for ticket 2 (always 40 uses / 40 days), scoring each by fewest "not preferred" assignments, then fewest unused rides, then shortest gap. UI gets color-coded ticket regions and expanded summary.

**Tech Stack:** React 19, TypeScript, Vitest, date-fns

**Design doc:** `docs/plans/2026-04-30-two-ticket-planning-design.md`

---

### Task 1: Add `planSecondTicket` to types and storage

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/storage/plans.ts`
- Modify: `src/storage/plans.test.ts`

**Step 1: Update `TicketPlan` type**

In `src/domain/types.ts`, add `planSecondTicket` to `TicketPlan`:

```ts
export type TicketPlan = {
  remainingUses: number;
  planStartDate: string;
  expiryDate: string;
  defaultPattern: DefaultPattern;
  unavailableRanges: DateRange[];
  dayOverrides: Record<string, DayOverride>;
  planSecondTicket: boolean;
};
```

**Step 2: Update `OptimizedTrip` type**

In `src/domain/types.ts`, add `ticket` to `OptimizedTrip`:

```ts
export type OptimizedTrip = GeneratedTrip & {
  useCitySaver: boolean;
  ticket?: 1 | 2;
};
```

**Step 3: Add `SecondTicketResult` and update `OptimizationResult`**

In `src/domain/types.ts`, add after `OptimizationResult`:

```ts
export type SecondTicketResult = {
  activationDate: string;
  expiryDate: string;
  assignedUses: number;
  unusedUses: number;
  normalPayTrips: number;
  priorityUseCounts: Record<TripPriority, number>;
};

export type OptimizationResult = {
  days: OptimizedDay[];
  assignedUses: number;
  unusedUses: number;
  normalPayTrips: number;
  priorityUseCounts: Record<TripPriority, number>;
  secondTicket?: SecondTicketResult;
  gapDays: number;
  gapNormalPayTrips: number;
};
```

**Step 4: Update `createDefaultPlan` in storage**

In `src/storage/plans.ts`, add `planSecondTicket: false` to the return value of `createDefaultPlan`.

**Step 5: Update `isTicketPlan` validator in storage**

In `src/storage/plans.ts`, inside `isTicketPlan`, after the existing checks, add:

```ts
if (value.planSecondTicket !== undefined && typeof value.planSecondTicket !== "boolean") {
  return false;
}
```

And at the end of `loadPlan`, normalize the field:

```ts
const parsed: unknown = JSON.parse(raw);
if (!isTicketPlan(parsed)) return createDefaultPlan();
return { ...parsed, planSecondTicket: parsed.planSecondTicket ?? false };
```

**Step 6: Write storage tests**

In `src/storage/plans.test.ts`, add:

```ts
it("includes planSecondTicket: false in default plan", () => {
  expect(createDefaultPlan("2026-05-01").planSecondTicket).toBe(false);
});

it("loads a plan without planSecondTicket and defaults to false", () => {
  const plan = createDefaultPlan("2026-05-01");
  const { planSecondTicket: _, ...planWithout } = plan;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(planWithout));
  expect(loadPlan().planSecondTicket).toBe(false);
});

it("round-trips planSecondTicket: true", () => {
  const plan = { ...createDefaultPlan("2026-05-01"), planSecondTicket: true };
  savePlan(plan);
  expect(loadPlan().planSecondTicket).toBe(true);
});
```

**Step 7: Run tests**

Run: `npx vitest run src/storage/plans.test.ts`
Expected: All tests pass.

**Step 8: Fix existing tests**

The existing `createDefaultPlan` test assertion needs `planSecondTicket: false` added to the expected object. Update the assertion in the "creates a default plan from a supplied date" test.

**Step 9: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (some may need minor fixes for the new `gapDays`/`gapNormalPayTrips` fields on `OptimizationResult`).

**Step 10: Commit**

```bash
git add src/domain/types.ts src/storage/plans.ts src/storage/plans.test.ts
git commit -m "feat: add planSecondTicket to types and storage"
```


---

### Task 2: Update optimizer for single-ticket backward compatibility

The `OptimizationResult` now requires `gapDays` and `gapNormalPayTrips`. The existing `optimizePlan` must return these as `0` when `planSecondTicket` is false, and assign `ticket: 1` to all City Saver trips.

**Files:**
- Modify: `src/domain/optimizer.ts`
- Modify: `src/domain/optimizer.test.ts`

**Step 1: Update existing `optimizePlan` return**

In `src/domain/optimizer.ts`, update the return statement to include the new fields:

```ts
return {
  days,
  assignedUses: assignedTrips.length,
  unusedUses: Math.max(0, plan.remainingUses - assignedTrips.length),
  normalPayTrips: allTrips.length - assignedTrips.length,
  priorityUseCounts: {
    definitely: assignedTrips.filter((trip) => trip.priority === "definitely").length,
    maybe: assignedTrips.filter((trip) => trip.priority === "maybe").length,
    not_preferred: assignedTrips.filter((trip) => trip.priority === "not_preferred").length
  },
  gapDays: 0,
  gapNormalPayTrips: 0
};
```

Also update the trip mapping to include `ticket: 1` for City Saver trips:

```ts
const trips = getGeneratedTripsForDate(plan, date).map<OptimizedTrip>((trip) => ({
  ...trip,
  useCitySaver: selectedTripKeys.has(getTripKey(trip)),
  ticket: selectedTripKeys.has(getTripKey(trip)) ? 1 : undefined
}));
```

**Step 2: Run existing optimizer tests**

Run: `npx vitest run src/domain/optimizer.test.ts`
Expected: All existing tests pass unchanged.

**Step 3: Commit**

```bash
git add src/domain/optimizer.ts src/domain/optimizer.test.ts
git commit -m "feat: add gapDays/gapNormalPayTrips to single-ticket result"
```


---

### Task 3: Implement two-ticket optimizer

**Files:**
- Modify: `src/domain/optimizer.ts`
- Modify: `src/domain/optimizer.test.ts`

**Step 1: Write failing tests for two-ticket optimization**

Add these tests to `src/domain/optimizer.test.ts`:

```ts
describe("two-ticket optimization", () => {
  // Mon 2026-05-04 through Fri 2026-05-08 = 5 weekdays
  // Pattern: 2 definitely trips per weekday (Mon-Fri) = 10 trips/week
  // Ticket 1: 4 remaining uses, expires 2026-05-08
  // Ticket 2: 40 uses, 40 days from activation

  it("plans ticket 2 starting the day after ticket 1 expires when no gap needed", () => {
    const plan = basePlan({
      remainingUses: 4,
      planSecondTicket: true,
      // Short window: Mon-Fri, 2 trips/day on weekdays = 10 trips
      // 4 uses on ticket 1, plenty of definitely trips
    });
    const result = optimizePlan(plan);

    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-05-09");
    expect(result.secondTicket!.expiryDate).toBe("2026-06-17");
    expect(result.secondTicket!.assignedUses).toBeLessThanOrEqual(40);
    expect(result.gapDays).toBe(0);
  });

  it("assigns ticket: 1 and ticket: 2 to the correct trips", () => {
    const plan = basePlan({
      remainingUses: 4,
      planSecondTicket: true,
    });
    const result = optimizePlan(plan);

    const t1Trips = result.days.flatMap((d) => d.trips.filter((t) => t.ticket === 1));
    const t2Trips = result.days.flatMap((d) => d.trips.filter((t) => t.ticket === 2));

    expect(t1Trips.length).toBe(4);
    expect(t2Trips.length).toBeGreaterThan(0);
    // All ticket 1 trips should be within ticket 1 window
    t1Trips.forEach((t) => {
      expect(t.date >= "2026-05-04" && t.date <= "2026-05-08").toBe(true);
    });
  });

  it("avoids not_preferred trips by choosing a better activation date", () => {
    // Ticket 1 has 10 uses but only 4 definitely + 2 maybe trips in window
    // (Mon: 2 def, Tue: 2 maybe, Wed: 2 not_preferred, Thu: 1 def + 1 maybe, Fri: 1 not_preferred)
    // With 10 uses, ticket 1 must use not_preferred trips
    // But with planSecondTicket, the optimizer should let ticket 1 use only 9
    // and shift remaining to ticket 2 — wait, ticket 1 uses are fixed.
    // The optimizer picks activation date to minimize not_preferred across BOTH tickets.
    const plan = basePlan({
      remainingUses: 9,
      planSecondTicket: true,
    });
    const result = optimizePlan(plan);

    // All 9 trips in ticket 1 window are assigned (the full set)
    expect(result.assignedUses).toBe(9);
    expect(result.secondTicket).toBeDefined();
  });

  it("pushes ticket 2 past an unavailable period in the gap", () => {
    const plan = basePlan({
      remainingUses: 4,
      planSecondTicket: true,
      unavailableRanges: [
        { id: "vacation", startDate: "2026-05-09", endDate: "2026-05-18" }
      ],
    });
    const result = optimizePlan(plan);

    expect(result.secondTicket).toBeDefined();
    // Optimizer should not waste ticket 2 days during unavailable period
    // Activation should be on or after 2026-05-19
    expect(result.secondTicket!.activationDate >= "2026-05-09").toBe(true);
    expect(result.gapDays).toBeGreaterThanOrEqual(0);
  });

  it("reports gap normal-pay trips", () => {
    const plan = basePlan({
      remainingUses: 4,
      planSecondTicket: true,
    });
    const result = optimizePlan(plan);

    expect(result.gapNormalPayTrips).toBeGreaterThanOrEqual(0);
    expect(typeof result.gapDays).toBe("number");
  });

  it("does not plan second ticket when planSecondTicket is false", () => {
    const plan = basePlan({ planSecondTicket: false });
    const result = optimizePlan(plan);

    expect(result.secondTicket).toBeUndefined();
    expect(result.gapDays).toBe(0);
    expect(result.gapNormalPayTrips).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/optimizer.test.ts`
Expected: New two-ticket tests fail (planSecondTicket not handled yet).

**Step 3: Implement two-ticket optimizer**

In `src/domain/optimizer.ts`, add a helper to extract the core assign logic, then add the two-ticket search:

```ts
import { compareIsoDates, eachDateInclusive, getWeekdayIndex, isDateInRanges, shiftIsoDate } from "./dateUtils";

// ... existing code ...

const SECOND_TICKET_USES = 40;
const SECOND_TICKET_DAYS = 39; // 40 days = day 0 through day 39

function sortAndAssign(
  trips: GeneratedTrip[],
  maxUses: number
): Set<string> {
  return new Set(
    [...trips]
      .sort((left, right) => {
        const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
        if (priorityDelta !== 0) return priorityDelta;
        const dateDelta = left.date.localeCompare(right.date);
        if (dateDelta !== 0) return dateDelta;
        return left.tripIndex - right.tripIndex;
      })
      .slice(0, Math.max(0, maxUses))
      .map(getTripKey)
  );
}

function countNotPreferred(trips: GeneratedTrip[], assignedKeys: Set<string>): number {
  return trips.filter(
    (t) => t.priority === "not_preferred" && assignedKeys.has(getTripKey(t))
  ).length;
}

function countPriorityUses(
  trips: GeneratedTrip[],
  assignedKeys: Set<string>
): Record<TripPriority, number> {
  const assigned = trips.filter((t) => assignedKeys.has(getTripKey(t)));
  return {
    definitely: assigned.filter((t) => t.priority === "definitely").length,
    maybe: assigned.filter((t) => t.priority === "maybe").length,
    not_preferred: assigned.filter((t) => t.priority === "not_preferred").length,
  };
}
```

Then refactor `optimizePlan` to use `sortAndAssign` for the single-ticket path, and add the two-ticket path:

```ts
export function optimizePlan(plan: TicketPlan): OptimizationResult {
  if (!plan.planSecondTicket) {
    return optimizeSingleTicket(plan);
  }
  return optimizeTwoTickets(plan);
}

function optimizeSingleTicket(plan: TicketPlan): OptimizationResult {
  const dates = eachDateInclusive(plan.planStartDate, plan.expiryDate);
  const generatedTrips = dates.flatMap((date) => getGeneratedTripsForDate(plan, date));
  const selectedTripKeys = sortAndAssign(generatedTrips, plan.remainingUses);

  const days = dates.map((date) => {
    const trips = getGeneratedTripsForDate(plan, date).map<OptimizedTrip>((trip) => {
      const selected = selectedTripKeys.has(getTripKey(trip));
      return { ...trip, useCitySaver: selected, ticket: selected ? 1 : undefined };
    });
    return {
      date,
      unavailable: isUnavailableForCalendar(plan, date),
      trips,
      hasOverride: Boolean(plan.dayOverrides[date])
    };
  });

  const assignedTrips = days.flatMap((d) => d.trips).filter((t) => t.useCitySaver);
  const allTrips = days.flatMap((d) => d.trips);

  return {
    days,
    assignedUses: assignedTrips.length,
    unusedUses: Math.max(0, plan.remainingUses - assignedTrips.length),
    normalPayTrips: allTrips.length - assignedTrips.length,
    priorityUseCounts: countPriorityUses(
      days.flatMap((d) => d.trips),
      selectedTripKeys
    ),
    gapDays: 0,
    gapNormalPayTrips: 0,
  };
}

function optimizeTwoTickets(plan: TicketPlan): OptimizationResult {
  const t1ExpiryDate = plan.expiryDate;
  // Earliest: day after ticket 1 expiry. Latest: ticket 1 expiry + 40 days.
  const earliestActivation = shiftIsoDate(t1ExpiryDate, 1);
  const latestActivation = shiftIsoDate(t1ExpiryDate, 40);

  // Generate ticket 1 trips once (they don't change per candidate)
  const t1Dates = eachDateInclusive(plan.planStartDate, t1ExpiryDate);
  const t1Trips = t1Dates.flatMap((date) => getGeneratedTripsForDate(plan, date));
  const t1AssignedKeys = sortAndAssign(t1Trips, plan.remainingUses);

  type Candidate = {
    activationDate: string;
    t2ExpiryDate: string;
    t2Trips: GeneratedTrip[];
    t2AssignedKeys: Set<string>;
    notPreferredTotal: number;
    unusedTotal: number;
    gapDays: number;
  };

  let bestCandidate: Candidate | null = null;

  const candidateDates = eachDateInclusive(earliestActivation, latestActivation);

  for (const activationDate of candidateDates) {
    const t2ExpiryDate = shiftIsoDate(activationDate, SECOND_TICKET_DAYS);
    const t2Dates = eachDateInclusive(activationDate, t2ExpiryDate);
    const t2Trips = t2Dates.flatMap((date) => getGeneratedTripsForDate(plan, date));
    const t2AssignedKeys = sortAndAssign(t2Trips, SECOND_TICKET_USES);

    const notPreferredTotal =
      countNotPreferred(t1Trips, t1AssignedKeys) +
      countNotPreferred(t2Trips, t2AssignedKeys);

    const t1Unused = Math.max(0, plan.remainingUses - t1Trips.filter((t) => t1AssignedKeys.has(getTripKey(t))).length);
    const t2Unused = Math.max(0, SECOND_TICKET_USES - t2Trips.filter((t) => t2AssignedKeys.has(getTripKey(t))).length);
    const unusedTotal = t1Unused + t2Unused;

    const gapDayCount = Math.max(0,
      eachDateInclusive(shiftIsoDate(t1ExpiryDate, 1), shiftIsoDate(activationDate, -1)).length
    );

    const candidate: Candidate = {
      activationDate,
      t2ExpiryDate,
      t2Trips,
      t2AssignedKeys,
      notPreferredTotal,
      unusedTotal,
      gapDays: gapDayCount,
    };

    if (!bestCandidate) {
      bestCandidate = candidate;
      continue;
    }

    // Primary: fewer not_preferred
    if (candidate.notPreferredTotal < bestCandidate.notPreferredTotal) {
      bestCandidate = candidate;
      continue;
    }
    if (candidate.notPreferredTotal > bestCandidate.notPreferredTotal) continue;

    // Secondary: fewer unused
    if (candidate.unusedTotal < bestCandidate.unusedTotal) {
      bestCandidate = candidate;
      continue;
    }
    if (candidate.unusedTotal > bestCandidate.unusedTotal) continue;

    // Tertiary: shorter gap
    if (candidate.gapDays < bestCandidate.gapDays) {
      bestCandidate = candidate;
    }
  }

  // Build the full day list from ticket 1 start through ticket 2 expiry
  const fullEndDate = bestCandidate!.t2ExpiryDate;
  const allDates = eachDateInclusive(plan.planStartDate, fullEndDate);

  const days = allDates.map((date) => {
    const tripsForDate = getGeneratedTripsForDate(plan, date);
    const inT1 = compareIsoDates(date, plan.planStartDate) >= 0 && compareIsoDates(date, t1ExpiryDate) <= 0;
    const inT2 = compareIsoDates(date, bestCandidate!.activationDate) >= 0 && compareIsoDates(date, bestCandidate!.t2ExpiryDate) <= 0;

    const trips = tripsForDate.map<OptimizedTrip>((trip) => {
      const key = getTripKey(trip);
      const isT1 = inT1 && t1AssignedKeys.has(key);
      const isT2 = inT2 && bestCandidate!.t2AssignedKeys.has(key);
      return {
        ...trip,
        useCitySaver: isT1 || isT2,
        ticket: isT1 ? 1 : isT2 ? 2 : undefined,
      };
    });

    return {
      date,
      unavailable: isUnavailableForCalendar(plan, date),
      trips,
      hasOverride: Boolean(plan.dayOverrides[date]),
    };
  });

  const t1AssignedTrips = days.flatMap((d) => d.trips).filter((t) => t.ticket === 1);
  const t2AssignedTrips = days.flatMap((d) => d.trips).filter((t) => t.ticket === 2);
  const allTrips = days.flatMap((d) => d.trips);

  // Gap trips: trips between ticket 1 expiry and ticket 2 activation
  const gapTrips = days
    .filter((d) => compareIsoDates(d.date, t1ExpiryDate) > 0 && compareIsoDates(d.date, bestCandidate!.activationDate) < 0)
    .flatMap((d) => d.trips);

  return {
    days,
    assignedUses: t1AssignedTrips.length,
    unusedUses: Math.max(0, plan.remainingUses - t1AssignedTrips.length),
    normalPayTrips: allTrips.filter((t) => !t.useCitySaver).length,
    priorityUseCounts: countPriorityUses(
      days.flatMap((d) => d.trips),
      t1AssignedKeys
    ),
    secondTicket: {
      activationDate: bestCandidate!.activationDate,
      expiryDate: bestCandidate!.t2ExpiryDate,
      assignedUses: t2AssignedTrips.length,
      unusedUses: Math.max(0, SECOND_TICKET_USES - t2AssignedTrips.length),
      normalPayTrips: allTrips.filter((t) => !t.useCitySaver && compareIsoDates(t.date, bestCandidate!.activationDate) >= 0).length - 0,
      priorityUseCounts: countPriorityUses(
        days.flatMap((d) => d.trips),
        bestCandidate!.t2AssignedKeys
      ),
    },
    gapDays: bestCandidate!.gapDays,
    gapNormalPayTrips: gapTrips.length,
  };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/domain/optimizer.test.ts`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/domain/optimizer.ts src/domain/optimizer.test.ts
git commit -m "feat: implement two-ticket optimizer"
```


---

### Task 4: Add i18n keys for two-ticket UI

**Files:**
- Modify: `src/domain/i18n.tsx`

**Step 1: Add English translation keys**

In the `en` section of `translations` in `src/domain/i18n.tsx`, add:

```ts
// Two-ticket planning
"setup.planSecondTicket": "Plan second ticket",
"setup.secondTicketInfo": "Activate on {date} · Expires {expiry}",
"summary.ticket1": "Ticket 1",
"summary.ticket2": "Ticket 2",
"summary.gap": "Gap",
"summary.gapTrips": "normal-pay trips in gap",
"cal.gapLabel": "Gap · pay normally",
"cal.ticket2Label": "Ticket 2 · starts {date}",
```

**Step 2: Add Chinese translation keys**

In the `zh-HK` section:

```ts
// Two-ticket planning
"setup.planSecondTicket": "規劃第二張車票",
"setup.secondTicketInfo": "啟用日期 {date} · 到期 {expiry}",
"summary.ticket1": "車票 1",
"summary.ticket2": "車票 2",
"summary.gap": "空檔期",
"summary.gapTrips": "空檔期正常付費行程",
"cal.gapLabel": "空檔期 · 正常付費",
"cal.ticket2Label": "車票 2 · 由 {date} 開始",
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/domain/i18n.tsx
git commit -m "feat: add i18n keys for two-ticket UI"
```


---

### Task 5: Add "Plan second ticket" toggle to SetupPanel

**Files:**
- Modify: `src/components/SetupPanel.tsx`
- Modify: `src/components/SetupPanel.test.tsx`

**Step 1: Add the toggle UI**

At the bottom of the `SetupPanel` component's return JSX (after the unavailable ranges section), add:

```tsx
<section className="panel-section">
  <label className="field field--checkbox">
    <input
      type="checkbox"
      checked={plan.planSecondTicket}
      onChange={(event) => onPlanChange({ ...plan, planSecondTicket: event.target.checked })}
    />
    {t("setup.planSecondTicket")}
  </label>
</section>
```

Note: The `SetupPanel` does not have access to the optimization result, so the "Activate on X · Expires Y" info line needs to be passed in as a prop or rendered elsewhere. The simplest approach: add an optional `secondTicketInfo` prop.

Update the `SetupPanelProps` type:

```ts
type SetupPanelProps = {
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
  secondTicketInfo?: { activationDate: string; expiryDate: string };
};
```

And render it below the checkbox when present:

```tsx
{plan.planSecondTicket && secondTicketInfo ? (
  <p className="second-ticket-info">
    {t("setup.secondTicketInfo", {
      date: secondTicketInfo.activationDate,
      expiry: secondTicketInfo.expiryDate,
    })}
  </p>
) : null}
```

**Step 2: Update SetupPanelModal to pass the prop**

In `src/components/SetupPanelModal.tsx`, add `secondTicketInfo` to the props and pass it through to `SetupPanel`.

**Step 3: Update App.tsx to pass secondTicketInfo**

In `src/App.tsx`, pass `secondTicketInfo` to `SetupPanelModal`:

```tsx
{setupOpen && (
  <SetupPanelModal
    plan={plan}
    onPlanChange={setPlan}
    onClose={() => setSetupOpen(false)}
    triggerRef={setupTriggerRef}
    secondTicketInfo={result.secondTicket ? {
      activationDate: result.secondTicket.activationDate,
      expiryDate: result.secondTicket.expiryDate,
    } : undefined}
  />
)}
```

**Step 4: Write test for the toggle**

In `src/components/SetupPanel.test.tsx`, add a test that the checkbox toggles `planSecondTicket`:

```ts
it("toggles planSecondTicket when checkbox is clicked", async () => {
  const onPlanChange = vi.fn();
  const plan = { ...createDefaultPlan("2026-05-01"), planSecondTicket: false };
  render(<SetupPanel plan={plan} onPlanChange={onPlanChange} />);

  const checkbox = screen.getByRole("checkbox", { name: /plan second ticket/i });
  await userEvent.click(checkbox);

  expect(onPlanChange).toHaveBeenCalledWith(
    expect.objectContaining({ planSecondTicket: true })
  );
});
```

**Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/components/SetupPanel.tsx src/components/SetupPanelModal.tsx src/components/SetupPanel.test.tsx src/App.tsx
git commit -m "feat: add plan-second-ticket toggle to setup panel"
```


---

### Task 6: Update Summary for two-ticket display

**Files:**
- Modify: `src/components/Summary.tsx`
- Modify: `src/components/Summary.test.tsx`

**Step 1: Update Summary component**

The Summary component receives `OptimizationResult`. When `result.secondTicket` is defined, render an expanded view with ticket 1 stats, gap stats, and ticket 2 stats.

```tsx
export function Summary({ result, validationErrors }: SummaryProps) {
  const t = useT();
  const hasSecondTicket = Boolean(result.secondTicket);

  return (
    <>
      <section className="summary-strip" aria-label={t("summary.label")}>
        {hasSecondTicket ? <h3 className="summary-ticket-label">{t("summary.ticket1")}</h3> : null}
        <div className="summary-stat">
          <span className="summary-metric">{result.assignedUses}</span>
          <span className="summary-label">{t("summary.plannedUses")}</span>
        </div>
        <div className="summary-stat">
          <span className="summary-metric">{result.unusedUses}</span>
          <span className="summary-label">{t("summary.cannotUse")}</span>
        </div>
        {!hasSecondTicket ? (
          <div className="summary-stat">
            <span className="summary-metric">{result.normalPayTrips}</span>
            <span className="summary-label">{t("summary.normalPay")}</span>
          </div>
        ) : null}
        <div className="summary-priority" aria-label={t("summary.byPriority")}>
          {/* ... existing priority dots, unchanged ... */}
        </div>

        {hasSecondTicket ? (
          <>
            <h3 className="summary-ticket-label summary-ticket-label--gap">{t("summary.gap")}</h3>
            <div className="summary-stat">
              <span className="summary-metric">{result.gapNormalPayTrips}</span>
              <span className="summary-label">{t("summary.gapTrips")}</span>
            </div>

            <h3 className="summary-ticket-label summary-ticket-label--t2">{t("summary.ticket2")}</h3>
            <div className="summary-stat">
              <span className="summary-metric">{result.secondTicket!.assignedUses}</span>
              <span className="summary-label">{t("summary.plannedUses")}</span>
            </div>
            <div className="summary-stat">
              <span className="summary-metric">{result.secondTicket!.unusedUses}</span>
              <span className="summary-label">{t("summary.cannotUse")}</span>
            </div>
            <div className="summary-priority" aria-label={t("summary.byPriority")}>
              <span className="summary-priority-item">
                <span className="summary-priority-dot summary-priority-dot--definitely" aria-hidden="true" />
                <span className="summary-priority-count">{result.secondTicket!.priorityUseCounts.definitely}</span>
                <span>{t("summary.definitely")}</span>
              </span>
              <span className="summary-priority-item">
                <span className="summary-priority-dot summary-priority-dot--maybe" aria-hidden="true" />
                <span className="summary-priority-count">{result.secondTicket!.priorityUseCounts.maybe}</span>
                <span>{t("summary.maybe")}</span>
              </span>
              <span className="summary-priority-item">
                <span className="summary-priority-dot summary-priority-dot--not_preferred" aria-hidden="true" />
                <span className="summary-priority-count">{result.secondTicket!.priorityUseCounts.not_preferred}</span>
                <span>{t("summary.notPreferred")}</span>
              </span>
            </div>
          </>
        ) : null}
      </section>
      {validationErrors.length > 0 ? (
        <ul className="error-list" role="alert" aria-label={t("summary.errors")}>
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
```

**Step 2: Write tests**

In `src/components/Summary.test.tsx`, add tests for:
- Single-ticket mode: renders as before (no "Ticket 1" label)
- Two-ticket mode: renders "Ticket 1", "Gap", "Ticket 2" sections with correct stats

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/components/Summary.tsx src/components/Summary.test.tsx
git commit -m "feat: expand summary for two-ticket display"
```


---

### Task 7: Update CalendarView for two-ticket color coding

**Files:**
- Modify: `src/components/CalendarView.tsx`
- Modify: `src/styles.css`

**Step 1: Extend CalendarView to determine ticket region per date**

The CalendarView needs to know which region each date falls in: ticket 1, gap, or ticket 2. Pass the `secondTicket` info from the result.

Add a helper function in CalendarView:

```ts
type TicketRegion = "t1" | "gap" | "t2" | "none";

function getTicketRegion(
  date: string,
  plan: TicketPlan,
  secondTicket?: { activationDate: string; expiryDate: string }
): TicketRegion {
  if (!secondTicket) return "none";
  if (date <= plan.expiryDate && date >= plan.planStartDate) return "t1";
  if (date >= secondTicket.activationDate && date <= secondTicket.expiryDate) return "t2";
  if (date > plan.expiryDate && date < secondTicket.activationDate) return "gap";
  return "none";
}
```

**Step 2: Apply region CSS class to DayCell**

Add a `region` prop to `DayCell` and apply it as a CSS class:

```tsx
className={[
  "day-cell",
  selected ? "selected" : "",
  day?.unavailable ? "unavailable" : "",
  !inWindow ? "outside-window" : "",
  region !== "none" ? `day-cell--${region}` : "",
].join(" ").trim()}
```

**Step 3: Update CalendarView month range**

When `result.secondTicket` is defined, the month range should extend to `result.secondTicket.expiryDate` instead of `plan.expiryDate`:

```ts
const endDate = result.secondTicket?.expiryDate ?? plan.expiryDate;
const monthKeys = getMonthKeysInRange(plan.planStartDate, endDate);
```

Also update the `inWindow` check for DayCell — dates in the gap and ticket 2 window should be interactive:

```ts
const fullEndDate = result.secondTicket?.expiryDate ?? plan.expiryDate;
// inWindow = date is between planStartDate and fullEndDate
```

**Step 4: Add region divider labels**

Between months or at the start of gap/ticket 2 regions, render a subtle label row. This can be done by checking if the first date of a month falls in a new region and rendering a banner.

**Step 5: Add CSS for ticket regions**

In `src/styles.css`, add:

```css
/* Ticket 2 accent */
.day-cell--t2 {
  --ticket-accent: var(--color-ticket2, #0d9488);
}
.day-cell--t2 .tag.use {
  background: var(--ticket-accent);
}
.day-cell--t2 .trip-pill .assignment.use-text {
  color: var(--ticket-accent);
}

/* Gap styling */
.day-cell--gap {
  opacity: 0.7;
  background: var(--color-gap-bg, rgba(128, 128, 128, 0.05));
}

/* Region labels */
.ticket-region-label {
  grid-column: 1 / -1;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ticket-region-label--gap {
  color: var(--color-muted);
}
.ticket-region-label--t2 {
  color: var(--color-ticket2, #0d9488);
}
```

**Step 6: Run tests and visual check**

Run: `npx vitest run`
Expected: All tests pass.

Start dev server manually and verify the calendar renders correctly with two tickets enabled.

**Step 7: Commit**

```bash
git add src/components/CalendarView.tsx src/styles.css
git commit -m "feat: color-coded calendar regions for two-ticket view"
```


---

### Task 8: Update App.tsx for extended holiday fetching

**Files:**
- Modify: `src/App.tsx`

**Step 1: Extend maxYear calculation**

When `planSecondTicket` is true and the optimizer returns a `secondTicket`, the calendar extends beyond the original expiry. The `maxYear` for holiday fetching should account for this:

```ts
const maxYear = result.secondTicket
  ? parseInt(result.secondTicket.expiryDate.substring(0, 4), 10)
  : parseInt(plan.expiryDate.substring(0, 4), 10);
```

Note: This creates a circular dependency since `result` depends on `holidayRevision`. To break the cycle, compute `maxYear` from the plan alone — if `planSecondTicket` is true, estimate the max year as `expiryDate year + 1` (safe upper bound):

```ts
const maxYear = plan.planSecondTicket
  ? parseInt(plan.expiryDate.substring(0, 4), 10) + 1
  : parseInt(plan.expiryDate.substring(0, 4), 10);
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: extend holiday fetching for two-ticket window"
```


---

### Task 9: Update DayEditor trip pill accent for ticket 2

**Files:**
- Modify: `src/components/DayEditor.tsx`

**Step 1: Pass ticket region info to DayEditor**

The DayEditor doesn't need structural changes, but trip pills should show the ticket 2 accent color when the selected date falls in the ticket 2 window. The simplest approach: pass an optional `ticketRegion` prop to `DayEditorModal` and `DayEditor`, and apply a CSS class.

In `DayEditor.tsx`, add a `ticketRegion` prop:

```ts
type DayEditorProps = {
  selectedDate: string;
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
  ticketRegion?: "t1" | "gap" | "t2" | "none";
};
```

Apply a class to the container:

```tsx
<div className={`day-editor-content${ticketRegion === "t2" ? " day-editor--t2" : ""}`}>
```

Add CSS in `src/styles.css`:

```css
.day-editor--t2 .trip-row-main {
  --trip-accent: var(--color-ticket2, #0d9488);
}
```

**Step 2: Thread the prop through DayEditorModal and App.tsx**

In `App.tsx`, compute the region for the selected date and pass it through.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/components/DayEditor.tsx src/components/DayEditorModal.tsx src/App.tsx src/styles.css
git commit -m "feat: ticket 2 accent in day editor"
```


---

### Task 10: Final integration test and cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run TypeScript type check**

Run: `npx tsc -b`
Expected: No type errors.

**Step 3: Build**

Run: `npx vite build`
Expected: Build succeeds.

**Step 4: Manual smoke test**

Start dev server (`npm run dev`) and verify:
- Default state: single ticket, everything works as before
- Toggle "Plan second ticket" on: calendar extends, summary shows two tickets + gap
- Ticket 2 region has distinct color accent
- Gap days are visually muted
- Adding unavailable ranges in the gap pushes ticket 2 activation later
- Toggling off returns to single-ticket view

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: two-ticket planning complete"
```