import "@testing-library/jest-dom/vitest";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OptimizationResult, TicketPlan } from "../domain/types";
import { renderWithI18n } from "../test-utils";
import { CalendarView } from "./CalendarView";

const plan: TicketPlan = {
  remainingUses: 3,
  planStartDate: "2026-05-01",
  expiryDate: "2026-05-31",
  defaultPattern: {
    tripsByWeekday: {}
  },
  unavailableRanges: [],
  dayOverrides: {},
  planSecondTicket: false
};

const result: OptimizationResult = {
  days: [
    {
      date: "2026-05-01",
      unavailable: false,
      hasOverride: false,
      trips: [
        {
          id: "Morning commute",
          date: "2026-05-01",
          tripIndex: 0,
          priority: "definitely",
          source: "default",
          useCitySaver: true
        },
        {
          id: "Evening commute",
          date: "2026-05-01",
          tripIndex: 1,
          priority: "definitely",
          source: "default",
          useCitySaver: true
        },
        {
          id: "Late trip",
          date: "2026-05-01",
          tripIndex: 2,
          priority: "maybe",
          source: "default",
          useCitySaver: false
        }
      ]
    },
    {
      date: "2026-05-02",
      unavailable: true,
      hasOverride: false,
      trips: []
    }
  ],
  assignedUses: 2,
  unusedUses: 1,
  normalPayTrips: 1,
  priorityUseCounts: {
    definitely: 2,
    maybe: 0,
    not_preferred: 0
  },
  gapDays: 0,
  gapNormalPayTrips: 0,
  lastT1TripDate: "2026-05-01"
};

describe("CalendarView", () => {
  it("aligns the first day of a month to its weekday", () => {
    renderWithI18n(<CalendarView plan={plan} result={result} selectedDate="2026-05-01" onSelectDate={vi.fn()} />);

    const may = screen.getByRole("heading", { name: "May 2026" }).closest("article");
    expect(may).not.toBeNull();

    const mayFirst = within(may as HTMLElement).getByRole("button", { name: /2026-05-01/ });
    expect(mayFirst).toHaveStyle({ gridColumnStart: "6" });
  });

  it("includes visible per-trip status and counts in day accessible names", () => {
    renderWithI18n(<CalendarView plan={plan} result={result} selectedDate="2026-05-01" onSelectDate={vi.fn()} />);

    expect(
      screen.getByRole("button", {
        name:
          "2026-05-01, Use City Saver 2, Pay normally 1, Morning commute, Definitely, Use City Saver, Evening commute, Definitely, Use City Saver, Late trip, Maybe, Pay normally"
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-05-02, Unavailable" })).toBeInTheDocument();
  });

  it("renders each trip label, priority, and assignment inside the day cell", () => {
    renderWithI18n(<CalendarView plan={plan} result={result} selectedDate="2026-05-01" onSelectDate={vi.fn()} />);

    const mayFirst = screen.getByRole("button", {
      name:
        "2026-05-01, Use City Saver 2, Pay normally 1, Morning commute, Definitely, Use City Saver, Evening commute, Definitely, Use City Saver, Late trip, Maybe, Pay normally"
    });

    expect(within(mayFirst).getByText("Morning commute")).toBeInTheDocument();
    expect(within(mayFirst).getAllByText("Definitely")).toHaveLength(2);
    expect(within(mayFirst).getAllByText("Use")).toHaveLength(2);
    expect(within(mayFirst).getByText("Late trip")).toBeInTheDocument();
    expect(within(mayFirst).getByText("Maybe")).toBeInTheDocument();
    expect(within(mayFirst).getByText("Pay")).toBeInTheDocument();
  });

  it("marks the second ticket buy-by date on the calendar", () => {
    const twoTicketResult: OptimizationResult = {
      ...result,
      days: [
        { date: "2026-05-01", unavailable: false, hasOverride: false, trips: [] },
        { date: "2026-05-02", unavailable: false, hasOverride: false, trips: [] },
        { date: "2026-05-03", unavailable: false, hasOverride: false, trips: [] },
        {
          date: "2026-05-04",
          unavailable: false,
          hasOverride: false,
          trips: [
            {
              id: "Morning commute",
              date: "2026-05-04",
              tripIndex: 0,
              priority: "definitely",
              source: "default",
              useCitySaver: true,
              ticket: 2,
            },
          ],
        },
      ],
      secondTicket: {
        activationDate: "2026-05-04",
        expiryDate: "2026-05-04",
        buyWindow: { startDate: "2026-05-03", endDate: "2026-05-03" },
        assignedUses: 1,
        unusedUses: 39,
        normalPayTrips: 0,
        priorityUseCounts: { definitely: 1, maybe: 0, not_preferred: 0 },
      },
      lastT1TripDate: "2026-05-01",
    };

    renderWithI18n(
      <CalendarView
        plan={{ ...plan, planSecondTicket: true }}
        result={twoTicketResult}
        selectedDate="2026-05-01"
        onSelectDate={vi.fn()}
      />
    );

    expect(screen.getByText("Buy by 2026-05-03")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "2026-05-03, Buy second ticket by this date" })
    ).toBeInTheDocument();
  });
});
