# Two-Ticket City Saver Planning

Date: 2026-04-30

## Goal

Extend the MTR City Saver Planner to support planning for two consecutive tickets: the current ticket in use, and a second ticket the user may buy/activate after a gap. The optimizer determines the best activation date for the second ticket.

## Core Concept

The user toggles on "Plan second ticket." The optimizer automatically determines the optimal activation date for ticket 2, producing a timeline:

```
[── Ticket 1 (current) ──][── Gap (pay normally) ──][── Ticket 2 (40 uses / 40 days) ──]
```

**Optimizer goal:** Use all 40 rides on each ticket while minimizing "not preferred" trip assignments.

**Constraints:**

- Ticket 2 is always 40 uses, 40 days validity.
- Ticket 2's activation date is computed by the optimizer, not user-entered.
- The calendar extends to cover ticket 2's expiry (activation date + 39 days).
- Unavailable ranges and day overrides apply across the entire window.
- The default weekday pattern continues through the gap and ticket 2 period.

## Data Model Changes

### TicketPlan (input)

One new field:

```ts
type TicketPlan = {
  // ... existing fields unchanged ...
  planSecondTicket: boolean; // default false
};
```

No second set of dates or uses. The optimizer derives everything.

### OptimizationResult (output)

New fields for the two-ticket result:

```ts
type OptimizationResult = {
  // ... existing fields unchanged (ticket 1 stats) ...

  secondTicket?: {
    activationDate: string;
    expiryDate: string;       // activationDate + 39 days
    assignedUses: number;
    unusedUses: number;
    normalPayTrips: number;
    priorityUseCounts: Record<TripPriority, number>;
  };

  gapDays: number;            // days between ticket 1 expiry and ticket 2 activation
  gapNormalPayTrips: number;  // trips during the gap paid at normal fare
};
```

### OptimizedTrip

New ticket assignment field:

```ts
type OptimizedTrip = GeneratedTrip & {
  useCitySaver: boolean;
  ticket?: 1 | 2; // which ticket covers this trip (undefined = pay normally / gap)
};
```

Existing fields keep their meaning for ticket 1. When `planSecondTicket` is false, `secondTicket` is undefined and everything works as today.

## Optimizer Algorithm

When `planSecondTicket` is false, the optimizer runs exactly as today.

When `planSecondTicket` is true:

### Search space

- **Earliest activation**: day after ticket 1 expiry (no gap).
- **Latest activation**: ticket 1 expiry + 40 days. A gap longer than a full ticket validity is never optimal.
- **~40 candidates** to evaluate.

### Per candidate

1. Generate trips for the full window: ticket 1 start through candidate ticket 2 expiry.
2. Exclude unavailable dates and apply overrides as usual.
3. Split trips into three buckets:
   - **Ticket 1 eligible**: planStartDate through ticket 1 expiryDate.
   - **Gap**: between ticket 1 expiry and ticket 2 activation (all pay normally).
   - **Ticket 2 eligible**: activation date through activation + 39 days.
4. Run the existing priority-sort-and-assign logic independently on each ticket's bucket.
5. Assign first 40 to ticket 1, first 40 to ticket 2.

### Scoring

Pick the activation date that:

1. **Primary**: minimizes total "not preferred" trips assigned to City Saver across both tickets.
2. **Secondary** (tiebreaker): minimizes total unused rides across both tickets.
3. **Tertiary** (tiebreaker): minimizes gap length.

### Performance

~40 candidates × ~1000 trips each = well under a millisecond total. No concern.

### Unavailable period behavior

If a long unavailable stretch falls right after ticket 1 expires, the optimizer naturally pushes ticket 2 activation past it. Those days generate no usable trips, so the gap costs nothing in the scoring.

## UI Changes

### Setup Panel

- New toggle at the bottom: "Plan second ticket."
- When on, a read-only info line appears: "Activate on Jun 15 · Expires Jul 24" (derived from optimizer output).
- No additional input fields.

### Calendar View

- Calendar extends to ticket 2's expiry when the toggle is on.
- Three color-coded regions:
  - **Ticket 1 period**: current color scheme (unchanged).
  - **Gap period**: muted/dimmed background. Trips show but all marked "pay normally."
  - **Ticket 2 period**: distinct accent color (e.g., teal/blue-green) on day cells and City Saver trip pills.
- Subtle divider or label between regions: "Gap · pay normally" and "Ticket 2 · starts Jun 15."

### Summary Strip

- When two-ticket mode is on, the summary expands:
  - Ticket 1: assigned uses, unused, priority breakdown (as today).
  - Gap: number of normal-fare trips.
  - Ticket 2: assigned uses, unused, priority breakdown.
- One row per ticket, compact layout.

### Day Editor

- No structural changes. The optimizer assigns trips to the correct ticket.
- Trip pills in the editor show the ticket color accent so the user knows which ticket covers that trip.

## Storage & Backward Compatibility

- `planSecondTicket` defaults to `false`. Existing saved plans load and work unchanged.
- Storage key stays `mtr-city-saver-plan:v1` — additive change, not breaking.
- `isTicketPlan` validator treats `planSecondTicket` as optional, defaulting to `false`.
- All existing tests remain valid without modification.

## Edge Cases

- **Ticket 1 already optimal**: If ticket 1 fills all 40 uses with "definitely" + "maybe" trips, the optimizer picks the earliest activation (day after expiry) since there's no benefit to a gap.
- **Sparse pattern**: If the travel pattern is very sparse (e.g., 1 trip/week), ticket 2 might not use all 40 rides in 40 days. The `unusedUses` field captures this and the summary shows a warning.

## Testing Strategy

### Optimizer tests

- Single-ticket mode: existing tests pass unchanged.
- Two-ticket basic: enough "definitely" trips for both, optimizer picks earliest activation.
- Two-ticket gap with unavailable period: optimizer pushes activation past the unavailable stretch.
- Two-ticket "not preferred" avoidance: optimizer picks activation date that avoids "not preferred" assignments.
- Two-ticket tiebreaker: multiple dates tie on "not preferred" count — prefer fewer unused rides, then shorter gap.
- Two-ticket sparse pattern: ticket 2 can't use all 40 rides, verify `unusedUses`.

### Validation tests

- `planSecondTicket` optional, defaults to false.
- No new validation rules (ticket 2 params are derived).

### Component tests

- Summary renders both ticket stats when `secondTicket` present.
- Summary renders single-ticket view when `secondTicket` undefined.
- SetupPanel toggle controls `planSecondTicket`.

### Storage tests

- Loading plan without `planSecondTicket` defaults to false.
- Round-trip save/load preserves `planSecondTicket: true`.
