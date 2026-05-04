import { useEffect, useState } from "react";
import { getHolidayCoveredYears, refreshHolidays } from "./holidays";
import type { Locale } from "./i18n";

/**
 * React hook that ensures holiday data covers all years in the plan's range
 * for the current locale. Triggers a fetch when the plan reaches into a year
 * not yet cached, or when the locale changes.
 *
 * Returns a revision counter that bumps on successful refresh.
 */
export function useHolidays(maxYear: number, locale: Locale): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const covered = getHolidayCoveredYears(locale);
    let needsFetch = false;

    for (let y = new Date().getFullYear(); y <= maxYear; y++) {
      if (!covered.has(y)) {
        needsFetch = true;
        break;
      }
    }

    if (!needsFetch) return;

    let cancelled = false;
    refreshHolidays(locale).then((updated) => {
      if (updated && !cancelled) {
        setRevision((r) => r + 1);
      }
    });

    return () => { cancelled = true; };
  }, [maxYear, locale]);

  return revision;
}
