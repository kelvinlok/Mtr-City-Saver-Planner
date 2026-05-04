import { describe, expect, it } from "vitest";
import { validatePlan } from "./validation";
import type { TicketPlan } from "./types";

/**
 * Minimal English translation function for tests.
 * Mirrors the real i18n `t` — looks up keys and interpolates {params}.
 */
const EN_TRANSLATIONS: Record<string, string> = {
  "setup.sunday": "Sunday",
  "setup.monday": "Monday",
  "setup.tuesday": "Tuesday",
  "setup.wednesday": "Wednesday",
  "setup.thursday": "Thursday",
  "setup.friday": "Friday",
  "setup.saturday": "Saturday",
  "validation.remainingUsesRange": "Remaining uses must be between 0 and 40.",
  "validation.invalidPlanStart": "Plan start date must be a valid ISO date.",
  "validation.invalidExpiry": "Expiry date must be a valid ISO date.",
  "validation.expiryBeforeStart": "Expiry date must be on or after the plan start date.",
  "validation.rangeStartInvalid": "Unavailable range {n} start date must be a valid ISO date.",
  "validation.rangeEndInvalid": "Unavailable range {n} end date must be a valid ISO date.",
  "validation.rangeEndBeforeStart": "Unavailable range {n} must end on or after it starts.",
  "validation.defaultTripBlank": "Default trip {n} on {day} needs a label.",
  "validation.defaultTripDuplicate": "Default trip labels on {day} must be unique.",
  "validation.overrideDateInvalid": "Day override date {date} must be a valid ISO date.",
  "validation.tripBlank": "Trip {n} on {date} needs a label.",
  "validation.tripDuplicate": "Trip labels on {date} must be unique.",
  "validation.noEligibleTrips": "No eligible trips before expiry.",
};

function t(key: string, params?: Record<string, string | number>): string {
  let text = EN_TRANSLATIONS[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

function validPlan(overrides: Partial<TicketPlan> = {}): TicketPlan {
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
    ...overrides
  };
}

describe("validatePlan", () => {
  it("accepts a valid plan", () => {
    expect(validatePlan(validPlan(), t)).toEqual([]);
  });

  it("flags remaining uses outside City Saver bounds", () => {
    expect(validatePlan(validPlan({ remainingUses: -1 }), t)).toContain("Remaining uses must be between 0 and 40.");
    expect(validatePlan(validPlan({ remainingUses: 41 }), t)).toContain("Remaining uses must be between 0 and 40.");
  });

  it("flags expiry before plan start", () => {
    expect(validatePlan(validPlan({ planStartDate: "2026-05-30", expiryDate: "2026-05-01" }), t)).toContain(
      "Expiry date must be on or after the plan start date."
    );
  });

  it("flags invalid plan dates", () => {
    expect(validatePlan(validPlan({ planStartDate: "not-a-date" }), t)).toContain(
      "Plan start date must be a valid ISO date."
    );
    expect(validatePlan(validPlan({ expiryDate: "2026-02-31" }), t)).toContain(
      "Expiry date must be a valid ISO date."
    );
  });

  it("flags unavailable ranges with end before start", () => {
    expect(
      validatePlan(
        validPlan({
          unavailableRanges: [{ id: "bad-range", startDate: "2026-05-20", endDate: "2026-05-10" }]
        }),
        t
      )
    ).toContain("Unavailable range 1 must end on or after it starts.");
  });

  it("flags invalid unavailable range dates", () => {
    expect(
      validatePlan(
        validPlan({
          unavailableRanges: [{ id: "bad-range", startDate: "not-a-date", endDate: "2026-05-10" }]
        }),
        t
      )
    ).toContain("Unavailable range 1 start date must be a valid ISO date.");

    expect(
      validatePlan(
        validPlan({
          unavailableRanges: [{ id: "bad-range", startDate: "2026-05-10", endDate: "2026-02-31" }]
        }),
        t
      )
    ).toContain("Unavailable range 1 end date must be a valid ISO date.");
  });

  it("flags invalid day override dates", () => {
    expect(
      validatePlan(
        validPlan({
          dayOverrides: {
            "not-a-date": {
              trips: [{ id: "Morning commute", priority: "definitely" }]
            }
          }
        }),
        t
      )
    ).toContain("Day override date not-a-date must be a valid ISO date.");
  });

  it("flags blank trip labels", () => {
    expect(
      validatePlan(
        validPlan({
          dayOverrides: {
            "2026-05-01": {
              trips: [{ id: " ", priority: "definitely" }]
            }
          }
        }),
        t
      )
    ).toContain("Trip 1 on 2026-05-01 needs a label.");
  });

  it("flags duplicate trip labels", () => {
    expect(
      validatePlan(
        validPlan({
          dayOverrides: {
            "2026-05-01": {
              trips: [
                { id: "Morning commute", priority: "definitely" },
                { id: " Morning commute ", priority: "maybe" }
              ]
            }
          }
        }),
        t
      )
    ).toContain("Trip labels on 2026-05-01 must be unique.");
  });

  it("flags blank default trip labels", () => {
    expect(
      validatePlan(
        validPlan({
          defaultPattern: {
            tripsByWeekday: {
              1: [{ id: " ", priority: "definitely" }]
            }
          }
        }),
        t
      )
    ).toContain("Default trip 1 on Monday needs a label.");
  });

  it("flags duplicate default trip labels within a weekday", () => {
    expect(
      validatePlan(
        validPlan({
          defaultPattern: {
            tripsByWeekday: {
              1: [
                { id: "Morning commute", priority: "definitely" },
                { id: " Morning commute ", priority: "maybe" }
              ]
            }
          }
        }),
        t
      )
    ).toContain("Default trip labels on Monday must be unique.");
  });

  it("flags plans with no eligible trips before expiry", () => {
    expect(
      validatePlan(
        validPlan({
          defaultPattern: { tripsByWeekday: {} },
          dayOverrides: {}
        }),
        t
      )
    ).toContain("No eligible trips before expiry.");
  });

  it("flags plans where unavailable ranges block every trip before expiry", () => {
    expect(
      validatePlan(
        validPlan({
          planStartDate: "2026-05-04",
          expiryDate: "2026-05-04",
          unavailableRanges: [{ id: "holiday", startDate: "2026-05-04", endDate: "2026-05-04" }]
        }),
        t
      )
    ).toContain("No eligible trips before expiry.");
  });

  it("does not flag no eligible trips when a day override date is invalid", () => {
    const errors = validatePlan(
      validPlan({
        defaultPattern: { tripsByWeekday: {} },
        dayOverrides: {
          "not-a-date": {
            trips: [{ id: "Morning commute", priority: "definitely" }]
          }
        }
      }),
      t
    );

    expect(errors).toContain("Day override date not-a-date must be a valid ISO date.");
    expect(errors).not.toContain("No eligible trips before expiry.");
  });

  it.each([
    {
      name: "invalid plan start date",
      plan: validPlan({
        planStartDate: "not-a-date",
        defaultPattern: { tripsByWeekday: {} }
      }),
      expectedError: "Plan start date must be a valid ISO date."
    },
    {
      name: "invalid expiry date",
      plan: validPlan({
        expiryDate: "2026-02-31",
        defaultPattern: { tripsByWeekday: {} }
      }),
      expectedError: "Expiry date must be a valid ISO date."
    },
    {
      name: "invalid unavailable range start date",
      plan: validPlan({
        defaultPattern: { tripsByWeekday: {} },
        unavailableRanges: [{ id: "bad-range", startDate: "not-a-date", endDate: "2026-05-10" }]
      }),
      expectedError: "Unavailable range 1 start date must be a valid ISO date."
    },
    {
      name: "invalid unavailable range end date",
      plan: validPlan({
        defaultPattern: { tripsByWeekday: {} },
        unavailableRanges: [{ id: "bad-range", startDate: "2026-05-10", endDate: "2026-02-31" }]
      }),
      expectedError: "Unavailable range 1 end date must be a valid ISO date."
    }
  ])("does not flag no eligible trips when there is $name", ({ plan, expectedError }) => {
    const errors = validatePlan(plan, t);

    expect(errors).toContain(expectedError);
    expect(errors).not.toContain("No eligible trips before expiry.");
  });
});
