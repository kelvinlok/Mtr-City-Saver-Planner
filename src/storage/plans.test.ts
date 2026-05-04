import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultPlan, loadPlan, savePlan } from "./plans";

const STORAGE_KEY = "mtr-city-saver-plan:v1";

function storePlan(overrides: Record<string, unknown>): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createDefaultPlan("2026-05-01"), ...overrides }));
}

describe("plan storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("creates a default plan from a supplied date", () => {
    expect(createDefaultPlan("2026-05-01")).toEqual({
      remainingUses: 40,
      planStartDate: "2026-05-01",
      expiryDate: "2026-06-09",
      defaultPattern: {
        tripsByWeekday: {
          1: [
            { id: "Morning commute", priority: "definitely" },
            { id: "Evening commute", priority: "definitely" }
          ],
          2: [
            { id: "Morning commute", priority: "definitely" },
            { id: "Evening commute", priority: "definitely" }
          ],
          3: [
            { id: "Morning commute", priority: "definitely" },
            { id: "Evening commute", priority: "definitely" }
          ],
          4: [
            { id: "Morning commute", priority: "definitely" },
            { id: "Evening commute", priority: "definitely" }
          ],
          5: [
            { id: "Morning commute", priority: "definitely" },
            { id: "Evening commute", priority: "definitely" }
          ]
        }
      },
      unavailableRanges: [],
      dayOverrides: {},
      planSecondTicket: false,
      secondTicketMode: "normal"
    });
  });

  it("falls back to a default plan for corrupt JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{");

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("falls back to a default plan for structurally invalid JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({}));

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("falls back to a default plan for an invalid plan start date", () => {
    storePlan({ remainingUses: 12, planStartDate: "not-a-date" });

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("falls back to a default plan for an invalid expiry date", () => {
    storePlan({ remainingUses: 12, expiryDate: "2026-02-31" });

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("falls back to a default plan for an invalid unavailable range date", () => {
    storePlan({
      remainingUses: 12,
      unavailableRanges: [{ id: "bad-range", startDate: "2026-05-10", endDate: "not-a-date" }]
    });

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("falls back to a default plan for an invalid day override key", () => {
    storePlan({
      remainingUses: 12,
      dayOverrides: {
        "not-a-date": {
          trips: [{ id: "Morning commute", priority: "definitely" }]
        }
      }
    });

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("falls back to a default plan for an invalid nested trip priority", () => {
    storePlan({
      remainingUses: 12,
      defaultPattern: {
        tripsByWeekday: {
          1: [{ id: "Morning commute", priority: "invalid" }]
        }
      }
    });

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("round-trips a saved plan", () => {
    const plan = createDefaultPlan("2026-05-01");
    const savedPlan = { ...plan, remainingUses: 12 };

    savePlan(savedPlan);

    expect(loadPlan()).toEqual(savedPlan);
  });

  it("falls back to a default plan when localStorage read throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(loadPlan().remainingUses).toBe(40);
  });

  it("ignores localStorage write errors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => savePlan(createDefaultPlan("2026-05-01"))).not.toThrow();
  });

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

  it("loads a plan without secondTicketMode and defaults to normal", () => {
    const plan = createDefaultPlan("2026-05-01");
    const { secondTicketMode: _, ...planWithout } = plan;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(planWithout));
    expect(loadPlan().secondTicketMode).toBe("normal");
  });

  it("round-trips secondTicketMode: rebate", () => {
    const plan = { ...createDefaultPlan("2026-05-01"), secondTicketMode: "rebate" as const };
    savePlan(plan);
    expect(loadPlan().secondTicketMode).toBe("rebate");
  });

  it("falls back to a default plan for an invalid secondTicketMode", () => {
    storePlan({ secondTicketMode: "invalid" });
    expect(loadPlan().secondTicketMode).toBe("normal");
  });
});
