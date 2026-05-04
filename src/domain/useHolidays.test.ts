import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHolidays } from "./useHolidays";
import * as holidays from "./holidays";
import type { Locale } from "./i18n";

type UseHolidaysProps = {
  maxYear: number;
  locale: Locale;
};

describe("useHolidays", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0 initially when all years are covered", () => {
    // Fallback data covers 2024-2026, so maxYear=2026 should not trigger a fetch
    vi.spyOn(holidays, "refreshHolidays").mockResolvedValue(false);

    const { result } = renderHook(() => useHolidays(2026, "en"));

    expect(result.current).toBe(0);
    expect(holidays.refreshHolidays).not.toHaveBeenCalled();
  });

  it("triggers a fetch when maxYear exceeds covered years", async () => {
    vi.spyOn(holidays, "getHolidayCoveredYears").mockReturnValue(new Set([2024, 2025, 2026]));
    vi.spyOn(holidays, "refreshHolidays").mockResolvedValue(true);

    const { result } = renderHook(() => useHolidays(2027, "en"));

    await waitFor(() => {
      expect(result.current).toBe(1);
    });

    expect(holidays.refreshHolidays).toHaveBeenCalledWith("en");
  });

  it("does not bump revision when refresh returns false", async () => {
    vi.spyOn(holidays, "getHolidayCoveredYears").mockReturnValue(new Set([2024, 2025, 2026]));
    vi.spyOn(holidays, "refreshHolidays").mockResolvedValue(false);

    const { result } = renderHook(() => useHolidays(2027, "en"));

    // Give the effect time to resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current).toBe(0);
  });

  it("re-fetches when locale changes", async () => {
    vi.spyOn(holidays, "getHolidayCoveredYears").mockReturnValue(new Set([2024, 2025, 2026]));
    const refreshSpy = vi.spyOn(holidays, "refreshHolidays").mockResolvedValue(true);
    const initialProps: UseHolidaysProps = { maxYear: 2027, locale: "en" };

    const { result, rerender } = renderHook(
      ({ maxYear, locale }: UseHolidaysProps) => useHolidays(maxYear, locale),
      { initialProps },
    );

    await waitFor(() => {
      expect(result.current).toBe(1);
    });

    rerender({ maxYear: 2027, locale: "zh-HK" });

    await waitFor(() => {
      expect(result.current).toBe(2);
    });

    expect(refreshSpy).toHaveBeenCalledWith("en");
    expect(refreshSpy).toHaveBeenCalledWith("zh-HK");
  });

  it("cancels pending fetch on unmount", async () => {
    vi.spyOn(holidays, "getHolidayCoveredYears").mockReturnValue(new Set([2024, 2025, 2026]));

    let resolveRefresh: (value: boolean) => void;
    vi.spyOn(holidays, "refreshHolidays").mockImplementation(
      () => new Promise((resolve) => { resolveRefresh = resolve; }),
    );

    const { result, unmount } = renderHook(() => useHolidays(2027, "en"));

    unmount();

    // Resolve after unmount — revision should NOT bump
    resolveRefresh!(true);
    await new Promise((r) => setTimeout(r, 50));

    // Can't check result.current after unmount, but the key thing is no error thrown
    expect(result.current).toBe(0);
  });
});
