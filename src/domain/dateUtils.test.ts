import { describe, expect, it } from "vitest";
import {
  compareIsoDates,
  eachDateInclusive,
  formatIsoDate,
  getDatesForMonth,
  getMonthKeysInRange,
  getWeekdayIndex,
  isAfterIso,
  isBeforeIso,
  isDateInRange,
  isDateInRanges,
  isValidIsoDate,
  shiftIsoDate,
} from "./dateUtils";

describe("dateUtils", () => {
  it("lists each date inclusively", () => {
    expect(eachDateInclusive("2026-05-01", "2026-05-03")).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03"
    ]);
  });

  it("returns empty array when start is after end", () => {
    expect(eachDateInclusive("2026-05-05", "2026-05-01")).toEqual([]);
  });

  it("returns single date when start equals end", () => {
    expect(eachDateInclusive("2026-05-01", "2026-05-01")).toEqual(["2026-05-01"]);
  });

  it("detects dates inside inclusive ranges", () => {
    expect(isDateInRange("2026-05-10", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(true);
    expect(isDateInRange("2026-05-14", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(true);
    expect(isDateInRange("2026-05-15", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(false);
  });

  it("detects dates outside range boundaries", () => {
    expect(isDateInRange("2026-05-09", { startDate: "2026-05-10", endDate: "2026-05-14" })).toBe(false);
  });

  it("checks multiple ranges with isDateInRanges", () => {
    const ranges = [
      { startDate: "2026-05-01", endDate: "2026-05-03" },
      { startDate: "2026-05-10", endDate: "2026-05-12" },
    ];
    expect(isDateInRanges("2026-05-02", ranges)).toBe(true);
    expect(isDateInRanges("2026-05-11", ranges)).toBe(true);
    expect(isDateInRanges("2026-05-05", ranges)).toBe(false);
  });

  it("returns false for empty ranges array", () => {
    expect(isDateInRanges("2026-05-01", [])).toBe(false);
  });

  it("returns month keys across a range", () => {
    expect(getMonthKeysInRange("2026-04-28", "2026-06-02")).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("returns single month key when start and end are in same month", () => {
    expect(getMonthKeysInRange("2026-05-01", "2026-05-31")).toEqual(["2026-05"]);
  });

  it("formats local dates as ISO calendar dates", () => {
    expect(formatIsoDate(new Date(2026, 4, 9))).toBe("2026-05-09");
  });

  it("validates real ISO calendar dates", () => {
    expect(isValidIsoDate("2026-05-01")).toBe(true);
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-5-1")).toBe(false);
  });

  it("rejects dates with wrong format but valid parse", () => {
    expect(isValidIsoDate("2026-1-01")).toBe(false);
    expect(isValidIsoDate("26-05-01")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });

  it("compares ISO dates correctly", () => {
    expect(compareIsoDates("2026-05-01", "2026-05-01")).toBe(0);
    expect(compareIsoDates("2026-05-02", "2026-05-01")).toBeGreaterThan(0);
    expect(compareIsoDates("2026-05-01", "2026-05-02")).toBeLessThan(0);
  });

  it("gets weekday index (0=Sunday)", () => {
    // 2026-05-11 is a Monday
    expect(getWeekdayIndex("2026-05-11")).toBe(1);
    // 2026-05-10 is a Sunday
    expect(getWeekdayIndex("2026-05-10")).toBe(0);
    // 2026-05-16 is a Saturday
    expect(getWeekdayIndex("2026-05-16")).toBe(6);
  });

  it("shifts dates forward and backward", () => {
    expect(shiftIsoDate("2026-05-01", 1)).toBe("2026-05-02");
    expect(shiftIsoDate("2026-05-01", -1)).toBe("2026-04-30");
    expect(shiftIsoDate("2026-05-01", 39)).toBe("2026-06-09");
    expect(shiftIsoDate("2026-05-01", 0)).toBe("2026-05-01");
  });

  it("shifts across month boundaries", () => {
    expect(shiftIsoDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("compares dates with isBeforeIso and isAfterIso", () => {
    expect(isBeforeIso("2026-05-01", "2026-05-02")).toBe(true);
    expect(isBeforeIso("2026-05-02", "2026-05-01")).toBe(false);
    expect(isBeforeIso("2026-05-01", "2026-05-01")).toBe(false);

    expect(isAfterIso("2026-05-02", "2026-05-01")).toBe(true);
    expect(isAfterIso("2026-05-01", "2026-05-02")).toBe(false);
    expect(isAfterIso("2026-05-01", "2026-05-01")).toBe(false);
  });

  it("gets all dates for a month", () => {
    const dates = getDatesForMonth("2026-02");
    expect(dates[0]).toBe("2026-02-01");
    expect(dates[dates.length - 1]).toBe("2026-02-28");
    expect(dates).toHaveLength(28);
  });

  it("handles leap year February", () => {
    const dates = getDatesForMonth("2024-02");
    expect(dates).toHaveLength(29);
    expect(dates[dates.length - 1]).toBe("2024-02-29");
  });
});
