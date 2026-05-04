# MTR City Saver Planner Design

Date: 2026-04-28

## Goal

Build a local-only browser app that helps plan how to use remaining MTR City Saver ticket rides before the ticket expires. The app should account for normal travel patterns, manual itinerary changes, multiple unavailable date ranges, and manual trip preference levels.

The result should be shown in one or more calendar layouts, with each planned trip labeled as either `Use City Saver` or `Pay normally`.

## Scope

Version 1 supports:

- Entering remaining City Saver uses, from `0` to `40`.
- Using a plan start date that defaults to today and can be edited if the user wants to plan from another date.
- Entering the official ticket expiry date.
- Defining a mostly fixed usage pattern, such as `2 trips per working day`.
- Manually adjusting individual days based on itinerary.
- Defining multiple unavailable date ranges where the user cannot use the ticket.
- Manually assigning each trip one of three preference levels:
  - `Definitely`
  - `Maybe`
  - `Not preferred`
- Optimizing ticket use across all usable dates before the official expiry date.
- Using `Not preferred` trips when needed to avoid wasting rides before expiry.
- Storing data locally on the user's device.

Version 1 does not include:

- Account login.
- Cloud sync.
- Fare-based automatic trip classification.
- Live MTR fare lookup.
- Sharing or collaboration.

## Product Behavior

The app uses the plan start date as the beginning of the planning window and the official ticket expiry date as the end. The plan start date defaults to today. Travel or other unavailable periods do not shorten the ticket window. Instead, unavailable ranges block usage only for those dates.

For example, if the ticket expires on May 30 and the user is unavailable from May 10 to May 14, the optimizer can still schedule ticket uses on May 1-9 and May 15-30.

The app starts from the user's default travel pattern, then lets the user override specific dates. Manual day overrides replace generated defaults for that date.

## Architecture

The app is a local-only browser app with no backend.

Main parts:

- **Planner state:** stores ticket details, default pattern, unavailable ranges, and per-day overrides.
- **Optimizer:** expands the planner state into dated trips, applies priority rules, and assigns ticket uses.
- **Calendar UI:** provides the main planning workspace and shows the optimized result.
- **Local persistence:** saves the planner state in browser storage so the plan survives reloads.

The optimizer must be deterministic. The same inputs must always produce the same plan.

## UI Design

The main screen is calendar-first.

Layout:

- **Left setup panel:** ticket setup and global planning controls.
- **Center calendar:** month calendar showing dates, trip labels, unavailable ranges, and priority indicators.
- **Right selected-day editor:** quick editing for the clicked day.
- **Summary strip:** planned usage totals and warnings.

The calendar should show all months from the plan start date through the official ticket expiry date if the range crosses month boundaries.

Each day should clearly show:

- whether the day is unavailable
- how many trips are planned
- which trips use City Saver
- which trips should be paid normally
- whether assigned ticket trips are `Definitely`, `Maybe`, or `Not preferred`

The selected-day editor should allow:

- adding a trip
- removing a trip
- changing each trip's manual priority
- marking the day unavailable
- clearing the day override to return to the default pattern

## Data Model

Suggested core state:

```ts
type TripPriority = "definitely" | "maybe" | "not_preferred";

type TicketPlan = {
  remainingUses: number;
  planStartDate: string;
  expiryDate: string;
  defaultPattern: DefaultPattern;
  unavailableRanges: DateRange[];
  dayOverrides: Record<string, DayOverride>;
};

type DefaultPattern = {
  weekdays: number[];
  tripsByWeekday: Record<number, TripTemplate[]>;
};

type TripTemplate = {
  priority: TripPriority;
};

type DateRange = {
  startDate: string;
  endDate: string;
};

type DayOverride = {
  unavailable?: boolean;
  trips?: TripTemplate[];
};
```

Dates should be stored as ISO calendar dates in `YYYY-MM-DD` format.

## Optimizer Rules

The optimizer should:

1. Generate all eligible trips from the plan start date through the official expiry date.
2. Exclude dates inside unavailable ranges.
3. Apply the default pattern first.
4. Replace generated trips with manual day overrides where present.
5. Exclude days marked unavailable by day override.
6. Sort eligible trips by:
   - priority: `Definitely`, then `Maybe`, then `Not preferred`
   - date ascending
   - trip order within the day
7. Assign City Saver uses to the first `remainingUses` trips in that sorted list.
8. Render all other trips as `Pay normally`.
9. If there are fewer eligible trips than remaining uses, show the unused count as `Cannot use before expiry`.

This makes `Not preferred` lower priority, not forbidden. If using those trips is the only way to avoid wasting ticket rides, the optimizer should assign City Saver uses to them.

## Validation And Error Handling

The app should block or clearly flag:

- remaining uses below `0`
- remaining uses above `40`
- expiry date before plan start date
- unavailable range with end date before start date
- invalid or duplicate trip rows in the selected-day editor
- no eligible days before expiry

Warnings should be visible near the affected control and summarized near the calendar.

## Testing

Testing should focus on the optimizer.

Required optimizer cases:

- default pattern of `2 trips per working day`
- multiple unavailable ranges
- manual day override replacing defaults
- day override marking a day unavailable
- priority ordering across `Definitely`, `Maybe`, and `Not preferred`
- using `Not preferred` trips when needed to avoid waste
- insufficient eligible trips before expiry
- expiry date crossing multiple calendar months

UI tests can be lighter for version 1:

- render calendar from saved state
- edit a selected day
- add an unavailable range
- verify calendar labels update after optimization

## Open Decisions

None for version 1. The approved direction is a local-only, calendar-first planner with manual trip priorities and multiple unavailable ranges.
