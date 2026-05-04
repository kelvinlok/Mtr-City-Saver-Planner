import { describe, expect, it } from "vitest";
import { shiftIsoDate } from "./dateUtils";
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
    planSecondTicket: false,
    ...overrides
  };
}

describe("optimizePlan", () => {
  it("assigns City Saver uses by date first, then priority within the same date", () => {
    const result = optimizePlan(basePlan({ remainingUses: 3 }));
    const assigned = result.days.flatMap((day) => day.trips.filter((trip) => trip.useCitySaver));

    // Date-first: Mon definitely×2, then Tue maybe (earlier date beats Thu definitely)
    expect(assigned.map((trip) => trip.id)).toEqual(["mon-out", "mon-back", "tue-out"]);
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

  it("blocks manual day overrides inside global unavailable ranges", () => {
    const result = optimizePlan(basePlan({
      unavailableRanges: [
        { id: "travel", startDate: "2026-05-04", endDate: "2026-05-04" }
      ],
      dayOverrides: {
        "2026-05-04": {
          trips: [definitely("manual-out"), definitely("manual-back")]
        }
      }
    }));

    const day = result.days.find((entry) => entry.date === "2026-05-04");
    expect(day?.unavailable).toBe(true);
    expect(day?.trips).toEqual([]);
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

  it("always assigns done trips to City Saver regardless of priority", () => {
    // Only 1 remaining use, but 2 done trips — both must be assigned
    const result = optimizePlan(basePlan({
      remainingUses: 1,
      dayOverrides: {
        "2026-05-04": {
          trips: [
            { id: "done-trip-1", priority: "not_preferred", done: true },
            { id: "done-trip-2", priority: "not_preferred", done: true },
          ]
        }
      }
    }));

    const day = result.days.find((d) => d.date === "2026-05-04");
    expect(day?.trips.filter((t) => t.useCitySaver).map((t) => t.id)).toEqual([
      "done-trip-1",
      "done-trip-2"
    ]);
    // Both done trips are assigned even though remainingUses is only 1
    expect(result.assignedUses).toBeGreaterThanOrEqual(2);
  });

  it("does not double-count done trips against remaining uses budget", () => {
    // 3 remaining uses, 1 done trip + other definitely trips
    const result = optimizePlan(basePlan({
      remainingUses: 3,
      dayOverrides: {
        "2026-05-04": {
          trips: [
            { id: "done-morning", priority: "definitely", done: true },
            { id: "undone-evening", priority: "definitely" },
          ]
        }
      }
    }));

    // done-morning is pinned (1 use), then 2 more from the budget
    expect(result.assignedUses).toBe(3);
    const day = result.days.find((d) => d.date === "2026-05-04");
    expect(day?.trips.find((t) => t.id === "done-morning")?.useCitySaver).toBe(true);
  });
});

describe("two-ticket optimization", () => {
  function rebateBoundaryPlan(): TicketPlan {
    const dayOverrides: TicketPlan["dayOverrides"] = {
      "2026-05-05": {
        trips: [definitely("ticket-1-trip")]
      },
      "2026-06-13": {
        trips: [notPreferred("rebate-boundary")]
      }
    };

    for (let offset = 0; offset < 40; offset++) {
      const date = shiftIsoDate("2026-06-14", offset);
      dayOverrides[date] = {
        trips: [definitely(`future-${offset}`)]
      };
    }

    return {
      remainingUses: 1,
      planStartDate: "2026-05-05",
      expiryDate: "2026-05-05",
      defaultPattern: { tripsByWeekday: {} },
      unavailableRanges: [],
      dayOverrides,
      planSecondTicket: true
    };
  }

  function maybeNeutralGapPlan(): TicketPlan {
    const dayOverrides: TicketPlan["dayOverrides"] = {
      "2026-05-04": {
        trips: [definitely("ticket-1-trip")]
      },
      "2026-05-05": {
        trips: [
          maybe("maybe-gap-1"),
          maybe("maybe-gap-2"),
          notPreferred("not-preferred-gap")
        ]
      },
      "2026-06-14": {
        trips: [
          definitely("extra-future-1"),
          definitely("extra-future-2"),
          definitely("extra-future-3")
        ]
      }
    };

    for (let offset = 0; offset < 37; offset++) {
      const date = shiftIsoDate("2026-05-06", offset);
      dayOverrides[date] = {
        trips: [definitely(`future-${offset}`)]
      };
    }

    return {
      remainingUses: 1,
      planStartDate: "2026-05-04",
      expiryDate: "2026-05-04",
      defaultPattern: { tripsByWeekday: {} },
      unavailableRanges: [],
      dayOverrides,
      planSecondTicket: true
    };
  }

  function economicGapPlan(): TicketPlan {
    return {
      remainingUses: 24,
      planStartDate: "2026-04-29",
      expiryDate: "2026-05-25",
      defaultPattern: {
        tripsByWeekday: {
          1: [definitely("Morning commute"), definitely("Evening commute")],
          2: [definitely("Morning commute"), maybe("Evening commute")],
          3: [definitely("Morning commute"), definitely("Evening commute")],
          4: [definitely("Morning commute"), definitely("Evening commute")],
          5: []
        }
      },
      unavailableRanges: [{ id: "travel", startDate: "2026-06-18", endDate: "2026-06-21" }],
      dayOverrides: {
        "2026-04-29": {
          trips: [
            { ...definitely("Morning commute"), done: true },
            { ...definitely("Evening commute"), done: true },
          ],
          unavailable: false
        },
        "2026-04-30": {
          trips: [
            { ...definitely("Morning commute"), done: true },
            { ...definitely("Evening commute"), done: true },
          ],
          unavailable: false
        },
        "2026-05-05": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-05-09": {
          trips: [],
          unavailable: false
        },
        "2026-05-12": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-05-13": {
          trips: [definitely("Morning commute"), definitely("Evening commute")],
          unavailable: false
        },
        "2026-05-18": {
          trips: [definitely("Morning commute"), definitely("Trip 2")],
          unavailable: false
        },
        "2026-05-19": {
          trips: [definitely("Morning commute"), { ...notPreferred("Evening commute"), done: false }],
          unavailable: false
        },
        "2026-05-21": {
          trips: [definitely("Morning commute"), definitely("Evening commute")],
          unavailable: false
        },
        "2026-05-26": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-05-29": {
          trips: [definitely("Trip 1"), definitely("Trip 2")],
          unavailable: false
        },
        "2026-06-02": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-06-09": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-06-16": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-06-17": {
          trips: [definitely("Morning commute")]
        },
        "2026-06-22": {
          trips: [definitely("Evening commute")]
        },
        "2026-06-23": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        },
        "2026-06-30": {
          trips: [definitely("Morning commute"), notPreferred("Evening commute")],
          unavailable: false
        }
      },
      planSecondTicket: true,
    };
  }

  function sparseEarlyTripsPlan(): TicketPlan {
    const dayOverrides: TicketPlan["dayOverrides"] = {
      "2026-05-25": {
        trips: [{ ...definitely("last-ticket-1-trip"), done: true }],
        unavailable: false
      }
    };

    for (let offset = 0; offset < 21; offset++) {
      const date = shiftIsoDate("2026-07-23", offset);
      dayOverrides[date] = {
        trips: [
          definitely(`future-morning-${offset}`),
          definitely(`future-evening-${offset}`)
        ],
        unavailable: false
      };
    }

    return {
      remainingUses: 1,
      planStartDate: "2026-05-01",
      expiryDate: "2026-05-25",
      defaultPattern: { tripsByWeekday: {} },
      unavailableRanges: [],
      dayOverrides,
      planSecondTicket: true,
    };
  }

  function ticketOneForfeitForRebatePlan(): TicketPlan {
    const dayOverrides: TicketPlan["dayOverrides"] = {
    };

    for (let offset = 0; offset < 9; offset++) {
      const date = shiftIsoDate("2026-07-14", offset);
      dayOverrides[date] = {
        trips: [
          definitely(`future-${offset}-1`),
          definitely(`future-${offset}-2`),
          definitely(`future-${offset}-3`),
          definitely(`future-${offset}-4`),
          definitely(`future-${offset}-5`)
        ],
        unavailable: false
      };
    }

    return {
      remainingUses: 1,
      planStartDate: "2026-05-01",
      expiryDate: "2026-07-14",
      defaultPattern: { tripsByWeekday: {} },
      unavailableRanges: [],
      dayOverrides,
      planSecondTicket: true,
    };
  }

  function ticketOneForfeitTiePlan(): TicketPlan {
    const dayOverrides: TicketPlan["dayOverrides"] = {
      "2026-05-01": {
        trips: [definitely("early-ticket-1-trip")],
        unavailable: false
      },
      "2026-06-14": {
        trips: [
          definitely("late-ticket-1-trip-1"),
          definitely("late-ticket-1-trip-2")
        ],
        unavailable: false
      }
    };

    for (let offset = 0; offset < 38; offset++) {
      const date = shiftIsoDate("2026-06-15", offset);
      dayOverrides[date] = {
        trips: [definitely(`future-${offset}`)],
        unavailable: false
      };
    }

    return {
      remainingUses: 3,
      planStartDate: "2026-05-01",
      expiryDate: "2026-06-14",
      defaultPattern: { tripsByWeekday: {} },
      unavailableRanges: [],
      dayOverrides,
      planSecondTicket: true,
    };
  }

  it("prices a long normal-pay gap above a few not-preferred ticket uses", () => {
    const result = optimizePlan(economicGapPlan());

    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-05-26");
    expect(result.secondTicket!.expiryDate).toBe("2026-07-04");
    expect(result.secondTicket!.buyWindow).toEqual({
      startDate: "2026-05-26",
      endDate: "2026-05-26",
    });
    expect(result.gapNormalPayTrips).toBe(0);
    expect(result.secondTicket!.priorityUseCounts.not_preferred).toBe(4);
  });

  it("reports the rebate purchase window for the chosen activation date", () => {
    const result = optimizePlan({ ...economicGapPlan(), secondTicketMode: "rebate" });

    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-05-26");
    expect(result.secondTicket!.buyWindow).toEqual({
      startDate: "2026-05-13",
      endDate: "2026-05-26",
    });
  });

  it("treats maybe trips paid normally in the gap as neutral", () => {
    const result = optimizePlan(maybeNeutralGapPlan());

    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-05-06");
    expect(result.gapNormalPayTrips).toBe(3);
    expect(result.secondTicket!.priorityUseCounts.not_preferred).toBe(0);
  });

  it("caps rebate activation to 13 days after the calendar-month purchase window", () => {
    const normal = optimizePlan({ ...rebateBoundaryPlan(), secondTicketMode: "normal" });
    const rebate = optimizePlan({ ...rebateBoundaryPlan(), secondTicketMode: "rebate" });

    expect(normal.secondTicket!.activationDate).toBe("2026-06-14");
    expect(normal.secondTicket!.buyWindow).toEqual({
      startDate: "2026-06-14",
      endDate: "2026-06-14",
    });
    expect(rebate.secondTicket!.activationDate).toBe("2026-06-13");
    expect(rebate.secondTicket!.buyWindow).toEqual({
      startDate: "2026-05-31",
      endDate: "2026-05-31",
    });
    expect(rebate.secondTicket!.priorityUseCounts.not_preferred).toBe(1);
  });

  it("does not force the rebate window when the $130 saving is worse than wasting ticket 2", () => {
    const result = optimizePlan({ ...sparseEarlyTripsPlan(), secondTicketMode: "rebate" });

    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-07-04");
    expect(result.secondTicket!.buyWindow).toEqual({
      startDate: "2026-07-04",
      endDate: "2026-07-04",
    });
    expect(result.secondTicket!.unusedUses).toBe(0);
  });

  it("can forfeit ticket 1 uses at $9 each to fit ticket 2 into the earlier rebate month", () => {
    const result = optimizePlan({ ...ticketOneForfeitForRebatePlan(), secondTicketMode: "rebate" });

    expect(result.assignedUses).toBe(0);
    expect(result.unusedUses).toBe(1);
    expect(result.lastT1TripDate).toBe("2026-05-01");
    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-06-13");
    expect(result.secondTicket!.buyWindow).toEqual({
      startDate: "2026-05-31",
      endDate: "2026-05-31",
    });
    expect(result.secondTicket!.assignedUses).toBe(40);
    expect(result.secondTicket!.unusedUses).toBe(0);
  });

  it("keeps ticket 1 uses when forfeiting only ties the net score", () => {
    const result = optimizePlan({ ...ticketOneForfeitTiePlan(), secondTicketMode: "rebate" });

    expect(result.assignedUses).toBe(3);
    expect(result.unusedUses).toBe(0);
    expect(result.lastT1TripDate).toBe("2026-06-14");
    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.activationDate).toBe("2026-06-15");
    expect(result.secondTicket!.buyWindow).toEqual({
      startDate: "2026-06-02",
      endDate: "2026-06-15",
    });
    expect(result.secondTicket!.unusedUses).toBe(2);
  });

  it("picks the activation date that minimizes not_preferred assignments", () => {
    // basePlan has Wed: 2 not_preferred, Fri: 1 not_preferred
    // The optimizer should pick an activation date that minimizes not_preferred
    // across ticket 2's 40-day window, even if that means a gap.
    const plan = basePlan({ remainingUses: 4, planSecondTicket: true });
    const result = optimizePlan(plan);
    expect(result.secondTicket).toBeDefined();
    expect(result.secondTicket!.assignedUses).toBeLessThanOrEqual(40);
    // Activation must be after ticket 1 expiry
    expect(result.secondTicket!.activationDate > plan.expiryDate).toBe(true);
    // Expiry is activation + 39 days
    expect(result.secondTicket!.expiryDate).toBeDefined();
  });

  it("prefers later activation when tied candidates add no normal-pay loss", () => {
    // Use a pattern with no not_preferred trips. If delaying activation does not
    // strand any paid-normal definitely trips, prefer the later expiry for flexibility.
    const plan: TicketPlan = {
      remainingUses: 4,
      planStartDate: "2026-05-04",
      expiryDate: "2026-05-08",
      defaultPattern: {
        tripsByWeekday: {
          1: [definitely("mon-out"), definitely("mon-back")],
          2: [definitely("tue-out"), definitely("tue-back")],
          3: [definitely("wed-out"), definitely("wed-back")],
          4: [definitely("thu-out"), definitely("thu-back")],
          5: [definitely("fri-out"), definitely("fri-back")]
        }
      },
      unavailableRanges: [],
      dayOverrides: {},
      planSecondTicket: true,
    };
    const result = optimizePlan(plan);
    expect(result.secondTicket).toBeDefined();
    // With 4 uses and 2 trips/day, last T1 trip is on Tue 2026-05-05.
    // Activating on Wed 2026-05-06 has the same economic score and preserves one more valid day.
    expect(result.secondTicket!.activationDate).toBe("2026-05-06");
    expect(result.gapDays).toBe(0);
  });

  it("assigns ticket: 1 and ticket: 2 to the correct trips", () => {
    const plan = basePlan({ remainingUses: 4, planSecondTicket: true });
    const result = optimizePlan(plan);
    const t1Trips = result.days.flatMap((d) => d.trips.filter((t) => t.ticket === 1));
    const t2Trips = result.days.flatMap((d) => d.trips.filter((t) => t.ticket === 2));
    expect(t1Trips.length).toBe(4);
    expect(t2Trips.length).toBeGreaterThan(0);
    t1Trips.forEach((t) => {
      expect(t.date >= "2026-05-04" && t.date <= "2026-05-08").toBe(true);
    });
  });

  it("pushes ticket 2 past an unavailable period in the gap", () => {
    const plan = basePlan({
      remainingUses: 4,
      planSecondTicket: true,
      unavailableRanges: [{ id: "vacation", startDate: "2026-05-09", endDate: "2026-05-18" }],
    });
    const result = optimizePlan(plan);
    expect(result.secondTicket).toBeDefined();
    // The optimizer should prefer activating after the unavailable period
    // to avoid wasting ticket 2 days
    expect(result.secondTicket!.activationDate >= "2026-05-09").toBe(true);
    expect(result.gapDays).toBeGreaterThanOrEqual(0);
  });

  it("reports gap normal-pay trips", () => {
    const plan = basePlan({ remainingUses: 4, planSecondTicket: true });
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
