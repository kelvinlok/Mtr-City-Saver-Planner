import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { screen, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TicketPlan } from "../domain/types";
import { renderWithI18n } from "../test-utils";
import { SetupPanel } from "./SetupPanel";

function createPlan(overrides: Partial<TicketPlan> = {}): TicketPlan {
  return {
    remainingUses: 10,
    planStartDate: "2026-05-01",
    expiryDate: "2026-05-30",
    defaultPattern: {
      tripsByWeekday: {
        1: [{ id: "Morning commute", priority: "definitely" }]
      }
    },
    unavailableRanges: [],
    dayOverrides: {},
    planSecondTicket: false,
    secondTicketMode: "normal",
    ...overrides
  };
}

/** Helper: switch to the Trips tab */
async function goToTripsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: "Trips" }));
}

/** Helper: expand a weekday group by its label */
async function expandGroup(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(label) }));
}

describe("SetupPanel", () => {
  it("adds a default trip for a weekday", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(<SetupPanel plan={createPlan()} onPlanChange={onPlanChange} />);

    // Navigate to Trips tab and expand the empty group (contains Tuesday)
    await goToTripsTab(user);
    // The empty group label is "Sun, Tue, Wed, Thu, Fri, Sat" (Mon is separate)
    const emptyGroupBtn = screen.getByRole("button", { name: /Sun.*Tue.*Wed.*Thu.*Fri.*Sat/i });
    await user.click(emptyGroupBtn);

    // Now click the add trip button for that group
    await user.click(screen.getByRole("button", { name: /Add Sun.*default trip/i }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPattern: {
          tripsByWeekday: expect.objectContaining({
            2: [{ id: "Trip 1", priority: "definitely" }]
          })
        }
      })
    );
  });

  it("edits and removes default trips without mutating the original plan", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();
    const plan = createPlan();

    function StatefulSetupPanel() {
      const [currentPlan, setCurrentPlan] = useState(plan);

      return (
        <SetupPanel
          plan={currentPlan}
          onPlanChange={(nextPlan) => {
            onPlanChange(nextPlan);
            setCurrentPlan(nextPlan);
          }}
        />
      );
    }

    renderWithI18n(<StatefulSetupPanel />);

    // Navigate to Trips tab and expand the Monday group
    await user.click(screen.getByRole("tab", { name: "Trips" }));
    // Click the Monday group row to expand it (Monday is its own group since it has trips)
    await user.click(screen.getByRole("button", { name: /Monday.*trips each/i }));

    const tripInput = screen.getByLabelText("Monday default trip 1 label");
    fireEvent.change(tripInput, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Monday default trip 1 label"), { target: { value: "Work inbound" } });
    const priorityGroup = screen.getByRole("group", { name: "Monday default trip 1 priority" });
    await user.click(within(priorityGroup).getByRole("button", { name: "Maybe" }));
    await user.click(screen.getByRole("button", { name: "Remove Monday default trip 1" }));

    expect(onPlanChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        defaultPattern: {
          tripsByWeekday: expect.objectContaining({
            1: [{ id: "", priority: "definitely" }]
          })
        }
      })
    );
    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPattern: {
          tripsByWeekday: expect.objectContaining({
            1: [{ id: "Work inbound", priority: "definitely" }]
          })
        }
      })
    );
    expect(onPlanChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultPattern: {
          tripsByWeekday: expect.objectContaining({
            1: []
          })
        }
      })
    );
    expect(plan.defaultPattern.tripsByWeekday[1]).toEqual([{ id: "Morning commute", priority: "definitely" }]);
  });

  it("adds an unavailable range", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    renderWithI18n(<SetupPanel plan={createPlan()} onPlanChange={onPlanChange} />);

    // Unavailable ranges are on the Ticket tab (default)
    await user.click(screen.getByRole("button", { name: "Add unavailable range" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        unavailableRanges: [
          expect.objectContaining({
            startDate: "2026-05-01",
            endDate: "2026-05-01",
          }),
        ],
      }),
    );
  });

  it("removes an unavailable range", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();

    const plan = createPlan({
      unavailableRanges: [
        { id: "range-1", startDate: "2026-05-10", endDate: "2026-05-12" },
        { id: "range-2", startDate: "2026-05-20", endDate: "2026-05-22" },
      ],
    });

    renderWithI18n(<SetupPanel plan={plan} onPlanChange={onPlanChange} />);

    // Unavailable ranges section is expanded because plan has ranges
    await user.click(screen.getByRole("button", { name: "Remove unavailable range 1" }));

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({
        unavailableRanges: [
          expect.objectContaining({ id: "range-2" }),
        ],
      }),
    );
  });

  it("shows weekday groups on the Trips tab", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SetupPanel plan={createPlan()} onPlanChange={vi.fn()} />);

    await goToTripsTab(user);

    // Monday has 1 trip — shown as its own group
    expect(screen.getByRole("button", { name: /Monday/ })).toBeInTheDocument();
    // The remaining 6 days are grouped together (0 trips)
    expect(screen.getByRole("button", { name: /Sun.*Tue.*Wed.*Thu.*Fri.*Sat/i })).toBeInTheDocument();
  });

  it("shows trip count in group meta", async () => {
    const user = userEvent.setup();
    renderWithI18n(<SetupPanel plan={createPlan()} onPlanChange={vi.fn()} />);

    await goToTripsTab(user);

    // Monday group shows "1 trips each"
    expect(screen.getByText(/1 trips each/)).toBeInTheDocument();
    // Empty group shows "0 trips"
    expect(screen.getByText(/0 trips/)).toBeInTheDocument();
  });

  it("toggles planSecondTicket when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();
    const plan = createPlan({ planSecondTicket: false });

    renderWithI18n(<SetupPanel plan={plan} onPlanChange={onPlanChange} />);

    // Checkbox is on the Ticket tab (default)
    const checkbox = screen.getByRole("checkbox", { name: /plan second ticket/i });
    await user.click(checkbox);

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({ planSecondTicket: true })
    );
  });

  it("changes second ticket optimization mode", async () => {
    const user = userEvent.setup();
    const onPlanChange = vi.fn();
    const plan = createPlan({ planSecondTicket: true, secondTicketMode: "normal" });

    renderWithI18n(<SetupPanel plan={plan} onPlanChange={onPlanChange} />);

    await user.selectOptions(screen.getByLabelText("Second ticket mode"), "rebate");

    expect(onPlanChange).toHaveBeenCalledWith(
      expect.objectContaining({ secondTicketMode: "rebate" })
    );
  });

  it("shows the second ticket buy window when available", () => {
    const plan = createPlan({ planSecondTicket: true, secondTicketMode: "rebate" });

    renderWithI18n(
      <SetupPanel
        plan={plan}
        onPlanChange={vi.fn()}
        secondTicketInfo={{
          activationDate: "2026-05-26",
          expiryDate: "2026-07-04",
          buyWindow: { startDate: "2026-05-13", endDate: "2026-05-26" },
        }}
      />
    );

    expect(screen.getByText("Buy 2026-05-13 to 2026-05-26 · Activate on 2026-05-26 · Expires 2026-07-04")).toBeInTheDocument();
  });

  it("shows a single second ticket buy date without a repeated range", () => {
    const plan = createPlan({ planSecondTicket: true, secondTicketMode: "normal" });

    renderWithI18n(
      <SetupPanel
        plan={plan}
        onPlanChange={vi.fn()}
        secondTicketInfo={{
          activationDate: "2026-05-26",
          expiryDate: "2026-07-04",
          buyWindow: { startDate: "2026-05-26", endDate: "2026-05-26" },
        }}
      />
    );

    expect(screen.getByText("Buy on 2026-05-26 · Activate on 2026-05-26 · Expires 2026-07-04")).toBeInTheDocument();
  });
});
