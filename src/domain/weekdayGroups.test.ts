import { describe, expect, it } from "vitest";
import { groupWeekdays, tripFingerprint, formatGroupLabel } from "./weekdayGroups";
import type { TripTemplate } from "./types";

const trip = (id: string, priority: "definitely" | "maybe" | "not_preferred"): TripTemplate => ({ id, priority });

describe("tripFingerprint", () => {
  it("returns empty string for no trips", () => {
    expect(tripFingerprint([])).toBe("");
  });

  it("serializes trips to id:priority pairs", () => {
    expect(tripFingerprint([trip("AM", "definitely"), trip("PM", "maybe")]))
      .toBe("AM:definitely|PM:maybe");
  });
});

describe("groupWeekdays", () => {
  it("groups identical weekday patterns together", () => {
    const tripsByWeekday: Record<number, TripTemplate[]> = {
      1: [trip("AM", "definitely")],
      2: [trip("AM", "definitely")],
      3: [trip("AM", "definitely")],
      4: [trip("AM", "definitely")],
      5: [trip("AM", "definitely")],
    };
    const groups = groupWeekdays(tripsByWeekday);
    expect(groups).toHaveLength(2); // Mon-Fri group + empty weekend group
    expect(groups[0].weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(groups[0].trips).toHaveLength(1);
    expect(groups[1].weekdays).toEqual([0, 6]);
    expect(groups[1].trips).toHaveLength(0);
  });

  it("separates weekdays with different patterns", () => {
    const tripsByWeekday: Record<number, TripTemplate[]> = {
      1: [trip("AM", "definitely")],
      5: [trip("AM", "maybe")],
    };
    const groups = groupWeekdays(tripsByWeekday);
    // Mon alone, Fri alone, empty group (Sun,Tue,Wed,Thu,Sat)
    expect(groups).toHaveLength(3);
    expect(groups[0].weekdays).toEqual([1]);
    expect(groups[1].weekdays).toEqual([5]);
    expect(groups[2].trips).toHaveLength(0);
  });

  it("returns single group when all weekdays are empty", () => {
    const groups = groupWeekdays({});
    expect(groups).toHaveLength(1);
    expect(groups[0].weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("sorts non-empty groups before empty groups", () => {
    const tripsByWeekday: Record<number, TripTemplate[]> = {
      5: [trip("AM", "definitely")],
    };
    const groups = groupWeekdays(tripsByWeekday);
    expect(groups[0].trips.length).toBeGreaterThan(0);
    expect(groups[groups.length - 1].trips).toHaveLength(0);
  });
});

describe("formatGroupLabel", () => {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = (d: number) => names[d];

  it("returns single day name for one weekday", () => {
    expect(formatGroupLabel([3], dayName)).toBe("Wed");
  });

  it("returns range for consecutive days", () => {
    expect(formatGroupLabel([1, 2, 3, 4, 5], dayName)).toBe("Mon – Fri");
  });

  it("returns comma-separated for non-consecutive days", () => {
    expect(formatGroupLabel([0, 6], dayName)).toBe("Sun, Sat");
  });
});
