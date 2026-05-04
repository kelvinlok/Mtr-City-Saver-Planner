/**
 * Hong Kong public holidays — fetched from the 1823.gov.hk iCal feed,
 * cached in localStorage per locale, and refreshed only when the plan
 * reaches a year not yet covered by the cache.
 *
 * Sources:
 *   EN:    https://www.1823.gov.hk/common/ical/en.ics
 *   zh-HK: https://www.1823.gov.hk/common/ical/tc.ics
 */

import type { Locale } from "./i18n";

const ICS_URLS: Record<Locale, string> = {
  en: "https://www.1823.gov.hk/common/ical/en.ics",
  "zh-HK": "https://www.1823.gov.hk/common/ical/tc.ics",
};

const STORAGE_KEY_PREFIX = "hk-holidays";

// ── Fallback data (bundled snapshot so the app works offline) ───────────

const FALLBACK_EN: Record<string, string> = {
  // 2024
  "2024-01-01": "The first day of January",
  "2024-02-10": "Lunar New Year's Day",
  "2024-02-12": "The third day of Lunar New Year",
  "2024-02-13": "The fourth day of Lunar New Year",
  "2024-03-29": "Good Friday",
  "2024-03-30": "The day following Good Friday",
  "2024-04-01": "Easter Monday",
  "2024-04-04": "Ching Ming Festival",
  "2024-05-01": "Labour Day",
  "2024-05-15": "The Birthday of the Buddha",
  "2024-06-10": "Tuen Ng Festival",
  "2024-07-01": "Hong Kong Special Administrative Region Establishment Day",
  "2024-09-18": "The day following the Chinese Mid-Autumn Festival",
  "2024-10-01": "National Day",
  "2024-10-11": "Chung Yeung Festival",
  "2024-12-25": "Christmas Day",
  "2024-12-26": "The first weekday after Christmas Day",
  // 2025
  "2025-01-01": "The first day of January",
  "2025-01-29": "Lunar New Year's Day",
  "2025-01-30": "The second day of Lunar New Year",
  "2025-01-31": "The third day of Lunar New Year",
  "2025-04-04": "Ching Ming Festival",
  "2025-04-18": "Good Friday",
  "2025-04-19": "The day following Good Friday",
  "2025-04-21": "Easter Monday",
  "2025-05-01": "Labour Day",
  "2025-05-05": "The Birthday of the Buddha",
  "2025-05-31": "Tuen Ng Festival",
  "2025-07-01": "Hong Kong Special Administrative Region Establishment Day",
  "2025-10-01": "National Day",
  "2025-10-07": "The day following the Chinese Mid-Autumn Festival",
  "2025-10-29": "Chung Yeung Festival",
  "2025-12-25": "Christmas Day",
  "2025-12-26": "The first weekday after Christmas Day",
  // 2026
  "2026-01-01": "The first day of January",
  "2026-02-17": "Lunar New Year's Day",
  "2026-02-18": "The second day of Lunar New Year",
  "2026-02-19": "The third day of Lunar New Year",
  "2026-04-03": "Good Friday",
  "2026-04-04": "The day following Good Friday",
  "2026-04-06": "The day following Ching Ming Festival",
  "2026-04-07": "The day following Easter Monday",
  "2026-05-01": "Labour Day",
  "2026-05-25": "The day following the Birthday of the Buddha",
  "2026-06-19": "Tuen Ng Festival",
  "2026-07-01": "Hong Kong Special Administrative Region Establishment Day",
  "2026-09-26": "The day following the Chinese Mid-Autumn Festival",
  "2026-10-01": "National Day",
  "2026-10-19": "The day following Chung Yeung Festival",
  "2026-12-25": "Christmas Day",
  "2026-12-26": "The first weekday after Christmas Day",
};

const FALLBACK_ZH: Record<string, string> = {
  // 2024
  "2024-01-01": "一月一日",
  "2024-02-10": "農曆年初一",
  "2024-02-12": "農曆年初三",
  "2024-02-13": "農曆年初四",
  "2024-03-29": "耶穌受難節",
  "2024-03-30": "耶穌受難節翌日",
  "2024-04-01": "復活節星期一",
  "2024-04-04": "清明節",
  "2024-05-01": "勞動節",
  "2024-05-15": "佛誕",
  "2024-06-10": "端午節",
  "2024-07-01": "香港特別行政區成立紀念日",
  "2024-09-18": "中秋節翌日",
  "2024-10-01": "國慶日",
  "2024-10-11": "重陽節",
  "2024-12-25": "聖誕節",
  "2024-12-26": "聖誕節後第一個周日",
  // 2025
  "2025-01-01": "一月一日",
  "2025-01-29": "農曆年初一",
  "2025-01-30": "農曆年初二",
  "2025-01-31": "農曆年初三",
  "2025-04-04": "清明節",
  "2025-04-18": "耶穌受難節",
  "2025-04-19": "耶穌受難節翌日",
  "2025-04-21": "復活節星期一",
  "2025-05-01": "勞動節",
  "2025-05-05": "佛誕",
  "2025-05-31": "端午節",
  "2025-07-01": "香港特別行政區成立紀念日",
  "2025-10-01": "國慶日",
  "2025-10-07": "中秋節翌日",
  "2025-10-29": "重陽節",
  "2025-12-25": "聖誕節",
  "2025-12-26": "聖誕節後第一個周日",
  // 2026
  "2026-01-01": "一月一日",
  "2026-02-17": "農曆年初一",
  "2026-02-18": "農曆年初二",
  "2026-02-19": "農曆年初三",
  "2026-04-03": "耶穌受難節",
  "2026-04-04": "耶穌受難節翌日",
  "2026-04-06": "清明節翌日",
  "2026-04-07": "復活節星期一翌日",
  "2026-05-01": "勞動節",
  "2026-05-25": "佛誕翌日",
  "2026-06-19": "端午節",
  "2026-07-01": "香港特別行政區成立紀念日",
  "2026-09-26": "中秋節翌日",
  "2026-10-01": "國慶日",
  "2026-10-19": "重陽節翌日",
  "2026-12-25": "聖誕節",
  "2026-12-26": "聖誕節後第一個周日",
};

const FALLBACK: Record<Locale, Record<string, string>> = {
  en: FALLBACK_EN,
  "zh-HK": FALLBACK_ZH,
};

// ── Per-locale in-memory holiday maps ───────────────────────────────────

const holidaysByLocale: Record<Locale, Record<string, string>> = {
  en: { ...FALLBACK_EN },
  "zh-HK": { ...FALLBACK_ZH },
};

// ── localStorage cache (per locale) ─────────────────────────────────────

interface CachedHolidays {
  fetchedAt: string;
  data: Record<string, string>;
}

function storageKey(locale: Locale): string {
  return `${STORAGE_KEY_PREFIX}-${locale}`;
}

function loadCache(locale: Locale): CachedHolidays | null {
  try {
    const raw = localStorage.getItem(storageKey(locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedHolidays;
    if (parsed.data && typeof parsed.data === "object") return parsed;
  } catch { /* corrupt or unavailable */ }
  return null;
}

function saveCache(locale: Locale, data: Record<string, string>): void {
  try {
    const entry: CachedHolidays = { fetchedAt: new Date().toISOString(), data };
    localStorage.setItem(storageKey(locale), JSON.stringify(entry));
  } catch { /* quota or unavailable */ }
}

// Hydrate both locales from cache on module load
for (const loc of ["en", "zh-HK"] as Locale[]) {
  const cached = loadCache(loc);
  if (cached) {
    holidaysByLocale[loc] = { ...FALLBACK[loc], ...cached.data };
  }
}

// ── ICS parser ──────────────────────────────────────────────────────────

function parseIcs(icsText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const events = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < events.length; i++) {
    const block = events[i];
    const dtMatch = block.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
    const summaryMatch = block.match(/SUMMARY:(.+)/);
    if (dtMatch && summaryMatch) {
      const isoDate = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
      result[isoDate] = summaryMatch[1].trim();
    }
  }

  return result;
}

// ── Fetch logic (per locale, de-duped) ──────────────────────────────────

const fetchPromises: Partial<Record<Locale, Promise<boolean>>> = {};

/**
 * Fetch the ICS feed for a locale and merge into the holiday map.
 * Returns true if new data was loaded.
 */
export function refreshHolidays(locale: Locale): Promise<boolean> {
  if (fetchPromises[locale]) return fetchPromises[locale]!;

  const promise = (async () => {
    try {
      const res = await fetch(ICS_URLS[locale]);
      if (!res.ok) return false;
      const text = await res.text();
      const parsed = parseIcs(text);
      if (Object.keys(parsed).length === 0) return false;

      holidaysByLocale[locale] = { ...FALLBACK[locale], ...parsed };
      saveCache(locale, parsed);
      return true;
    } catch {
      return false;
    } finally {
      delete fetchPromises[locale];
    }
  })();

  fetchPromises[locale] = promise;
  return promise;
}

// ── Public synchronous API ──────────────────────────────────────────────

/** Check whether a given ISO date is a HK public holiday (locale-independent). */
export function isPublicHoliday(date: string): boolean {
  // Use EN map for date detection (same dates across locales)
  return date in holidaysByLocale.en;
}

/** Get the holiday name for a date in the given locale. */
export function getHolidayName(date: string, locale: Locale): string | undefined {
  return holidaysByLocale[locale]?.[date];
}

/** Returns the set of years covered by holiday data for a locale. */
export function getHolidayCoveredYears(locale: Locale): Set<number> {
  const years = new Set<number>();
  for (const d of Object.keys(holidaysByLocale[locale] ?? {})) {
    years.add(parseInt(d.substring(0, 4), 10));
  }
  return years;
}
