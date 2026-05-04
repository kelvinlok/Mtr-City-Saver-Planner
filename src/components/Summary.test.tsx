import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OptimizationResult } from "../domain/types";
import { renderWithI18n } from "../test-utils";
import { Summary } from "./Summary";

function makeResult(overrides: Partial<OptimizationResult> = {}): OptimizationResult {
  return {
    days: [],
    assignedUses: 10,
    unusedUses: 5,
    normalPayTrips: 3,
    priorityUseCounts: {
      definitely: 6,
      maybe: 3,
      not_preferred: 1,
    },
    lastT1TripDate: "2026-05-01",
    gapDays: 0,
    gapNormalPayTrips: 0,
    ...overrides,
  };
}

describe("Summary", () => {
  it("displays all summary metrics", () => {
    renderWithI18n(<Summary result={makeResult()} validationErrors={[]} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("planned uses")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("cannot use before expiry")).toBeInTheDocument();
    // "3" appears in both normalPayTrips and maybe priority count
    expect(screen.getAllByText("3")).toHaveLength(2);
    expect(screen.getByText("normal-pay trips")).toBeInTheDocument();
  });

  it("displays priority breakdown counts", () => {
    renderWithI18n(<Summary result={makeResult()} validationErrors={[]} />);

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("definitely")).toBeInTheDocument();
    // "3" appears for both maybe count and normal-pay trips
    expect(screen.getByText("maybe")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("not preferred")).toBeInTheDocument();
  });

  it("does not render error list when there are no validation errors", () => {
    renderWithI18n(<Summary result={makeResult()} validationErrors={[]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders validation errors as an alert list", () => {
    const errors = [
      "Remaining uses must be between 0 and 40.",
      "Expiry date must be on or after the plan start date.",
    ];

    renderWithI18n(<Summary result={makeResult()} validationErrors={errors} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Remaining uses must be between 0 and 40.")).toBeInTheDocument();
    expect(screen.getByText("Expiry date must be on or after the plan start date.")).toBeInTheDocument();
  });

  it("displays zero counts correctly", () => {
    renderWithI18n(
      <Summary
        result={makeResult({
          assignedUses: 0,
          unusedUses: 0,
          normalPayTrips: 0,
          priorityUseCounts: { definitely: 0, maybe: 0, not_preferred: 0 },
        })}
        validationErrors={[]}
      />,
    );

    const metrics = screen.getAllByText("0");
    // 3 summary stats + 3 priority counts = 6 zeros
    expect(metrics.length).toBe(6);
  });

  it("has accessible section label", () => {
    renderWithI18n(<Summary result={makeResult()} validationErrors={[]} />);

    expect(screen.getByRole("region", { name: "Planner summary" })).toBeInTheDocument();
  });

  it("does not show ticket labels in single-ticket mode", () => {
    renderWithI18n(<Summary result={makeResult()} validationErrors={[]} />);
    expect(screen.queryByText("Ticket 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Ticket 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Gap")).not.toBeInTheDocument();
  });

  it("shows ticket 1, gap, and ticket 2 sections in two-ticket mode", () => {
    const result = makeResult({
      secondTicket: {
        activationDate: "2026-06-01",
        expiryDate: "2026-07-10",
        buyWindow: { startDate: "2026-05-19", endDate: "2026-05-31" },
        assignedUses: 30,
        unusedUses: 10,
        normalPayTrips: 5,
        priorityUseCounts: { definitely: 20, maybe: 8, not_preferred: 2 },
      },
      gapDays: 3,
      gapNormalPayTrips: 4,
    });

    renderWithI18n(<Summary result={result} validationErrors={[]} />);

    expect(screen.getByText("Ticket 1")).toBeInTheDocument();
    expect(screen.getByText("Gap")).toBeInTheDocument();
    expect(screen.getByText("Ticket 2")).toBeInTheDocument();
    expect(screen.getByText("2026-05-31")).toBeInTheDocument();
    expect(screen.getByText("buy by")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument(); // ticket 2 assigned uses
    expect(screen.getByText("4")).toBeInTheDocument(); // gap normal-pay trips
  });

  it("hides normal-pay trips stat in two-ticket mode", () => {
    const result = makeResult({
      normalPayTrips: 99,
      secondTicket: {
        activationDate: "2026-06-01",
        expiryDate: "2026-07-10",
        assignedUses: 30,
        unusedUses: 10,
        normalPayTrips: 5,
        priorityUseCounts: { definitely: 20, maybe: 8, not_preferred: 2 },
      },
      gapDays: 0,
      gapNormalPayTrips: 0,
    });

    renderWithI18n(<Summary result={result} validationErrors={[]} />);

    // The overall "normal-pay trips" stat should be hidden in two-ticket mode
    expect(screen.queryByText("normal-pay trips")).not.toBeInTheDocument();
  });
});
