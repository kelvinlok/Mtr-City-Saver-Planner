import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPublicHoliday,
  getHolidayName,
  getHolidayCoveredYears,
  refreshHolidays,
} from "./holidays";

// Sample ICS content matching the real 1823.gov.hk format
const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20270101
SUMMARY:The first day of January
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20270216
SUMMARY:Lunar New Year's Day
END:VEVENT
END:VCALENDAR`;

describe("holidays", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Synchronous API (uses bundled fallback data) ────────────────────

  describe("isPublicHoliday", () => {
    it("returns true for a known HK public holiday", () => {
      expect(isPublicHoliday("2026-01-01")).toBe(true);
    });

    it("returns false for a regular weekday", () => {
      expect(isPublicHoliday("2026-05-11")).toBe(false);
    });

    it("returns false for an invalid date string", () => {
      expect(isPublicHoliday("not-a-date")).toBe(false);
    });

    it("returns true for Christmas Day", () => {
      expect(isPublicHoliday("2026-12-25")).toBe(true);
    });

    it("returns true for Lunar New Year", () => {
      expect(isPublicHoliday("2026-02-17")).toBe(true);
      expect(isPublicHoliday("2026-02-18")).toBe(true);
      expect(isPublicHoliday("2026-02-19")).toBe(true);
    });
  });

  describe("getHolidayName", () => {
    it("returns the English name for a holiday", () => {
      expect(getHolidayName("2026-01-01", "en")).toBe("The first day of January");
    });

    it("returns the Chinese name for a holiday", () => {
      expect(getHolidayName("2026-01-01", "zh-HK")).toBe("一月一日");
    });

    it("returns undefined for a non-holiday date", () => {
      expect(getHolidayName("2026-05-11", "en")).toBeUndefined();
    });

    it("returns locale-specific names for the same date", () => {
      const en = getHolidayName("2026-07-01", "en");
      const zh = getHolidayName("2026-07-01", "zh-HK");
      expect(en).toBe("Hong Kong Special Administrative Region Establishment Day");
      expect(zh).toBe("香港特別行政區成立紀念日");
    });
  });

  describe("getHolidayCoveredYears", () => {
    it("returns years covered by fallback data", () => {
      const years = getHolidayCoveredYears("en");
      expect(years.has(2024)).toBe(true);
      expect(years.has(2025)).toBe(true);
      expect(years.has(2026)).toBe(true);
    });

    it("does not include years outside fallback data", () => {
      const years = getHolidayCoveredYears("en");
      expect(years.has(2023)).toBe(false);
      expect(years.has(2030)).toBe(false);
    });

    it("returns the same years for both locales", () => {
      const enYears = getHolidayCoveredYears("en");
      const zhYears = getHolidayCoveredYears("zh-HK");
      expect([...enYears].sort()).toEqual([...zhYears].sort());
    });
  });

  // ── refreshHolidays (fetch + ICS parsing) ───────────────────────────

  describe("refreshHolidays", () => {
    it("returns true and merges data on successful fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(SAMPLE_ICS, { status: 200 }),
      );

      const result = await refreshHolidays("en");

      expect(result).toBe(true);
      expect(isPublicHoliday("2027-01-01")).toBe(true);
      expect(getHolidayName("2027-01-01", "en")).toBe("The first day of January");
      expect(getHolidayName("2027-02-16", "en")).toBe("Lunar New Year's Day");
    });

    it("returns false on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const result = await refreshHolidays("en");

      expect(result).toBe(false);
    });

    it("returns false on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 }),
      );

      const result = await refreshHolidays("en");

      expect(result).toBe(false);
    });

    it("returns false when ICS contains no events", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR", { status: 200 }),
      );

      const result = await refreshHolidays("en");

      expect(result).toBe(false);
    });

    it("caches fetched data in localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(SAMPLE_ICS, { status: 200 }),
      );

      await refreshHolidays("en");

      const cached = window.localStorage.getItem("hk-holidays-en");
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached!);
      expect(parsed.data["2027-01-01"]).toBe("The first day of January");
      expect(parsed.fetchedAt).toBeDefined();
    });

    it("preserves fallback data after a successful fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(SAMPLE_ICS, { status: 200 }),
      );

      await refreshHolidays("en");

      // Fallback 2026 data should still be present
      expect(isPublicHoliday("2026-01-01")).toBe(true);
      // New 2027 data should also be present
      expect(isPublicHoliday("2027-01-01")).toBe(true);
    });

    it("de-duplicates concurrent fetches for the same locale", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(SAMPLE_ICS, { status: 200 }),
      );

      const [result1, result2] = await Promise.all([
        refreshHolidays("zh-HK"),
        refreshHolidays("zh-HK"),
      ]);

      // Both should resolve, but fetch should only be called once
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("handles localStorage write failure gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(SAMPLE_ICS, { status: 200 }),
      );
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota exceeded");
      });

      // Should not throw — just skip caching
      const result = await refreshHolidays("en");
      expect(result).toBe(true);
    });
  });
});
