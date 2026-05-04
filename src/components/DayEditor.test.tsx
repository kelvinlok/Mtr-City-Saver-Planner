import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TicketPlan } from "../domain/types";
import { renderWithI18n } from "../test-utils";
import { DayEditor } from "./DayEditor";

const plan: TicketPlan = {
  remainingUses: 40,
  planStartDate: "2026-05-01",
  expiryDate: "2026-05-31",
  defaultPattern: {
    tripsByWeekday: {
      1: [
        { id: "Morning commute", priority: "definitely" },
        { id: "Evening commute", priority: "definitely" },
      ],
    },
  },
  unavailableRanges: [
    { id: "travel", startDate: "2026-05-04", endDate: "2026-05-06" },
  ],
  dayOverrides: {},
  planSecondTicket: false,
};

function StatefulDayEditor({
  initialPlan,
  selectedDate,
  onPlanChangeSpy,
}: {
  initialPlan: TicketPlan;
  selectedDate: string;
  onPlanChangeSpy?: (plan: TicketPlan) => void;
}) {
  const [currentPlan, setCurrentPlan] = useState(initialPlan);

  return (
    <DayEditor
      selectedDate={selectedDate}
      plan={currentPlan}
      onPlanChange={(nextPlan) => {
        onPlanChangeSpy?.(nextPlan);
        setCurrentPlan(nextPlan);
      }}
    />
  );
}

describe("DayEditor", () => {
  it("blocks trip editing when the selected date is inside an unavailable range", () => {
    renderWithI18n(
      <DayEditor selectedDate="2026-05-04" plan={plan} onPlanChange={vi.fn()} />,
    );

    expect(
      screen.getByText(
        "This date is inside an unavailable range. Remove or adjust that range before editing trips.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trip 1 label")).not.toBeInTheDocument();
  });

  it("shows default pattern trips for a Monday with no override", () => {
    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={vi.fn()} />,
    );

    expect(screen.getByRole("textbox", { name: "Trip 1 label" })).toHaveValue("Morning commute");
    expect(screen.getByRole("textbox", { name: "Trip 2 label" })).toHaveValue("Evening commute");
  });

  it("shows override trips instead of defaults when a dayOverride exists", () => {
    const planWithOverride: TicketPlan = {
      ...plan,
      dayOverrides: {
        "2026-05-11": {
          trips: [{ id: "Dentist appointment", priority: "maybe" }],
        },
      },
    };

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={planWithOverride} onPlanChange={vi.fn()} />,
    );

    expect(screen.getByRole("textbox", { name: "Trip 1 label" })).toHaveValue("Dentist appointment");
    expect(screen.queryByRole("textbox", { name: "Trip 2 label" })).not.toBeInTheDocument();
  });

  it("adds a new trip", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={onPlanChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Add trip" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": expect.objectContaining({
            trips: [
              { id: "Morning commute", priority: "definitely" },
              { id: "Evening commute", priority: "definitely" },
              { id: "Trip 3", priority: "maybe" },
            ],
          }),
        }),
      }),
    );
  });

  it("removes a trip", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={onPlanChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove trip 1" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": expect.objectContaining({
            trips: [{ id: "Evening commute", priority: "definitely" }],
          }),
        }),
      }),
    );
  });

  it("edits a trip label", () => {
    const onPlanChange = vi.fn();

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={onPlanChange} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Trip 1 label" }), {
      target: { value: "Gym trip" },
    });

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": expect.objectContaining({
            trips: expect.arrayContaining([expect.objectContaining({ id: "Gym trip" })]),
          }),
        }),
      }),
    );
  });

  it("changes trip priority", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={onPlanChange} />,
    );

    const priorityGroup = screen.getAllByRole("group", { name: "Trip 1 label" })[0];
    await user.click(within(priorityGroup).getByRole("button", { name: "Maybe" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": expect.objectContaining({
            trips: expect.arrayContaining([
              expect.objectContaining({ id: "Morning commute", priority: "maybe" }),
            ]),
          }),
        }),
      }),
    );
  });

  it("marks a trip as done", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={onPlanChange} />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Mark trip 1 as done" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": expect.objectContaining({
            trips: expect.arrayContaining([
              expect.objectContaining({ id: "Morning commute", done: true }),
            ]),
          }),
        }),
      }),
    );
  });

  it("unmarks a done trip", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    const planWithDoneTrip: TicketPlan = {
      ...plan,
      dayOverrides: {
        "2026-05-11": {
          trips: [
            { id: "Morning commute", priority: "definitely", done: true },
            { id: "Evening commute", priority: "definitely" },
          ],
        },
      },
    };

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={planWithDoneTrip} onPlanChange={onPlanChange} />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Mark trip 1 as done" });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": expect.objectContaining({
            trips: expect.arrayContaining([
              expect.objectContaining({ id: "Morning commute", done: false }),
            ]),
          }),
        }),
      }),
    );
  });

  it("marks day as unavailable", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={plan} onPlanChange={onPlanChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Mark unavailable" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dayOverrides: expect.objectContaining({
          "2026-05-11": { unavailable: true, trips: [] },
        }),
      }),
    );
  });

  it("clears an override", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    const planWithOverride: TicketPlan = {
      ...plan,
      dayOverrides: {
        "2026-05-11": {
          trips: [{ id: "Custom trip", priority: "maybe" }],
        },
      },
    };

    renderWithI18n(
      <DayEditor selectedDate="2026-05-11" plan={planWithOverride} onPlanChange={onPlanChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Clear override" }));

    const updatedPlan = onPlanChange.mock.calls[0][0];
    expect(updatedPlan.dayOverrides).not.toHaveProperty("2026-05-11");
  });

  it("hides 'Mark unavailable' button when date is in global unavailable range", () => {
    renderWithI18n(
      <DayEditor selectedDate="2026-05-05" plan={plan} onPlanChange={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: "Mark unavailable" })).not.toBeInTheDocument();
  });

  it("falls back to empty trips for a weekday with no default pattern", () => {
    // 2026-05-10 is a Sunday (weekday 0), which has no default trips
    renderWithI18n(
      <DayEditor selectedDate="2026-05-10" plan={plan} onPlanChange={vi.fn()} />,
    );

    expect(screen.queryByRole("textbox", { name: "Trip 1 label" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add trip" })).toBeInTheDocument();
  });

  it("supports sequential edits via stateful re-renders", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();

    renderWithI18n(
      <StatefulDayEditor initialPlan={plan} selectedDate="2026-05-11" onPlanChangeSpy={spy} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Trip 1 label" }), {
      target: { value: "Office" },
    });

    const priorityGroup = screen.getAllByRole("group", { name: "Trip 1 label" })[0];
    await user.click(within(priorityGroup).getByRole("button", { name: "Not preferred" }));

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0];
    const trip1 = lastCall.dayOverrides["2026-05-11"].trips[0];
    expect(trip1.id).toBe("Office");
    expect(trip1.priority).toBe("not_preferred");
  });
});
