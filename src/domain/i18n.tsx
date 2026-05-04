import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// ── Supported locales ───────────────────────────────────────────────────

export type Locale = "en" | "zh-HK";

// ── Translation keys ────────────────────────────────────────────────────

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Header
    "header.eyebrow": "MTR City Saver",
    "header.title": "Ticket usage planner",
    "header.setup": "Setup",
    "header.openSetup": "Open setup",
    "header.closeSetup": "Close setup",

    // Theme
    "theme.light": "Switch to light mode",
    "theme.dark": "Switch to dark mode",

    // Language
    "lang.toggle": "繁",
    "lang.label": "Switch to Traditional Chinese",

    // Summary
    "summary.label": "Planner summary",
    "summary.plannedUses": "planned uses",
    "summary.cannotUse": "cannot use before expiry",
    "summary.normalPay": "normal-pay trips",
    "summary.byPriority": "Uses by priority",
    "summary.definitely": "definitely",
    "summary.maybe": "maybe",
    "summary.notPreferred": "not preferred",
    "summary.errors": "Validation errors",
    "summary.buyBy": "buy by",
    "summary.buyWindowSingle": "Buy on {date}",
    "summary.buyWindowRange": "Buy {start} to {end}",

    // Calendar
    "cal.label": "Planner calendar",
    "cal.sun": "Sun",
    "cal.mon": "Mon",
    "cal.tue": "Tue",
    "cal.wed": "Wed",
    "cal.thu": "Thu",
    "cal.fri": "Fri",
    "cal.sat": "Sat",
    "cal.unavailable": "Unavailable",
    "cal.use": "Use",
    "cal.pay": "Pay",
    "cal.done": "Done",
    "cal.buyByShort": "Buy by",
    "cal.buyByDay": "Buy second ticket by this date",
    "cal.buyByLabel": "Buy by {date}",

    // Day editor
    "editor.editDate": "Edit {date}",
    "editor.close": "Close day editor",
    "editor.markUnavailable": "Mark unavailable",
    "editor.clearOverride": "Clear override",
    "editor.trips": "Trips",
    "editor.addTrip": "Add trip",
    "editor.tripLabel": "Trip {n} label",
    "editor.removeTrip": "Remove trip {n}",
    "editor.markDone": "Mark trip {n} as done",
    "editor.unavailableNotice": "This date is inside an unavailable range. Remove or adjust that range before editing trips.",

    // Setup
    "setup.title": "Setup",
    "setup.close": "Close setup panel",
    "setup.dialogLabel": "Trip setup",
    "setup.remainingUses": "Remaining uses",
    "setup.planStart": "Plan start",
    "setup.ticketExpiry": "Ticket expiry",
    "setup.defaultPattern": "Default pattern",
    "setup.sunday": "Sunday",
    "setup.monday": "Monday",
    "setup.tuesday": "Tuesday",
    "setup.wednesday": "Wednesday",
    "setup.thursday": "Thursday",
    "setup.friday": "Friday",
    "setup.saturday": "Saturday",
    "setup.nTrips": "{n} trips",
    "setup.addWeekdayTrip": "Add {day} default trip",
    "setup.weekdayTripLabel": "{day} default trip {n} label",
    "setup.removeWeekdayTrip": "Remove {day} default trip {n}",
    "setup.weekdayTripPriority": "{day} default trip {n} priority",
    "setup.unavailableRanges": "Unavailable ranges",
    "setup.addRange": "Add unavailable range",
    "setup.range": "Range {n}",
    "setup.rangeStart": "Unavailable range {n} start date",
    "setup.rangeEnd": "Unavailable range {n} end date",
    "setup.removeRange": "Remove unavailable range {n}",

    // Priority
    "priority.definitely": "Definitely",
    "priority.maybe": "Maybe",
    "priority.notPreferred": "Not preferred",
    "priority.definitelyShort": "D",
    "priority.maybeShort": "M",
    "priority.notPreferredShort": "N",

    // Optimizer labels
    "useCitySaver": "Use City Saver",
    "payNormally": "Pay normally",

    // Default trip names
    "trip.morning": "Morning commute",
    "trip.evening": "Evening commute",
    "trip.default": "Trip {n}",

    // Month names
    "month.0": "January",
    "month.1": "February",
    "month.2": "March",
    "month.3": "April",
    "month.4": "May",
    "month.5": "June",
    "month.6": "July",
    "month.7": "August",
    "month.8": "September",
    "month.9": "October",
    "month.10": "November",
    "month.11": "December",
    "cal.monthYear": "{month} {year}",

    // Validation
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

    // Two-ticket planning
    "setup.planSecondTicket": "Plan second ticket",
    "setup.secondTicketMode": "Second ticket mode",
    "setup.secondTicketModeNormal": "Normal",
    "setup.secondTicketModeRebate": "Rebate",
    "setup.secondTicketInfo": "Activate on {date} · Expires {expiry}",
    "setup.secondTicketInfoWithBuyDate": "Buy on {buyDate} · Activate on {date} · Expires {expiry}",
    "setup.secondTicketInfoWithBuyWindow": "Buy {start} to {end} · Activate on {date} · Expires {expiry}",
    "setup.dataTransfer": "Data transfer",
    "setup.tabTicket": "Ticket",
    "setup.tabTrips": "Trips",
    "setup.nTripsEach": "{n} trips each",
    "setup.mergeWith": "Merge with {label}",
    "setup.chipSun": "S",
    "setup.chipMon": "M",
    "setup.chipTue": "T",
    "setup.chipWed": "W",
    "setup.chipThu": "T",
    "setup.chipFri": "F",
    "setup.chipSat": "S",
    "setup.export": "Export",
    "setup.import": "Import",
    "setup.copyAndClose": "Copy & close",
    "setup.applyImport": "Apply",
    "setup.cancel": "Cancel",
    "setup.importPlaceholder": "Paste exported plan JSON here…",
    "setup.importInvalid": "Clipboard does not contain a valid plan.",
    "setup.importFail": "Could not read clipboard. Try pasting into a text box instead.",
    "setup.reset": "Reset",
    "setup.resetTitle": "Reset all data?",
    "setup.resetBody": "This will erase your entire plan and restore factory defaults. All trip overrides, unavailable ranges, and custom settings will be permanently lost.",
    "setup.resetConfirm": "Yes, reset everything",
    "setup.importTitle": "Import plan data?",
    "setup.importBody": "Importing will replace your current plan with the pasted data. Any unsaved changes to your existing plan will be permanently lost.",
    "setup.importConfirm": "Yes, import",
    "summary.ticket1": "Ticket 1",
    "summary.ticket2": "Ticket 2",
    "summary.gap": "Gap",
    "summary.gapTrips": "normal-pay trips in gap",
    "cal.gapLabel": "Gap · pay normally",
    "cal.ticket2Label": "Ticket 2 · starts {date}",
  },
  "zh-HK": {
    // Header
    "header.eyebrow": "MTR 都會票",
    "header.title": "車票使用規劃",
    "header.setup": "設定",
    "header.openSetup": "開啟設定",
    "header.closeSetup": "關閉設定",

    // Theme
    "theme.light": "切換至淺色模式",
    "theme.dark": "切換至深色模式",

    // Language
    "lang.toggle": "EN",
    "lang.label": "Switch to English",

    // Summary
    "summary.label": "規劃摘要",
    "summary.plannedUses": "已規劃使用次數",
    "summary.cannotUse": "到期前未能使用",
    "summary.normalPay": "正常付費行程",
    "summary.byPriority": "按優先級使用",
    "summary.definitely": "一定用",
    "summary.maybe": "可以用",
    "summary.notPreferred": "唔太想用",
    "summary.errors": "驗證錯誤",
    "summary.buyBy": "購買限期",
    "summary.buyWindowSingle": "於 {date} 購買",
    "summary.buyWindowRange": "{start} 至 {end} 購買",

    // Calendar
    "cal.label": "規劃日曆",
    "cal.sun": "日",
    "cal.mon": "一",
    "cal.tue": "二",
    "cal.wed": "三",
    "cal.thu": "四",
    "cal.fri": "五",
    "cal.sat": "六",
    "cal.unavailable": "不可用",
    "cal.use": "用",
    "cal.pay": "付",
    "cal.done": "完成",
    "cal.buyByShort": "購買限期",
    "cal.buyByDay": "第二張車票購買限期",
    "cal.buyByLabel": "購買限期 {date}",

    // Day editor
    "editor.editDate": "編輯 {date}",
    "editor.close": "關閉日期編輯",
    "editor.markUnavailable": "標記為不可用",
    "editor.clearOverride": "清除自訂",
    "editor.trips": "行程",
    "editor.addTrip": "新增行程",
    "editor.tripLabel": "行程 {n} 名稱",
    "editor.removeTrip": "移除行程 {n}",
    "editor.markDone": "標記行程 {n} 為已完成",
    "editor.unavailableNotice": "此日期在不可用範圍內。請先移除或調整該範圍，才能編輯行程。",

    // Setup
    "setup.title": "設定",
    "setup.close": "關閉設定面板",
    "setup.dialogLabel": "行程設定",
    "setup.remainingUses": "剩餘使用次數",
    "setup.planStart": "規劃開始日期",
    "setup.ticketExpiry": "車票到期日",
    "setup.defaultPattern": "預設模式",
    "setup.sunday": "星期日",
    "setup.monday": "星期一",
    "setup.tuesday": "星期二",
    "setup.wednesday": "星期三",
    "setup.thursday": "星期四",
    "setup.friday": "星期五",
    "setup.saturday": "星期六",
    "setup.nTrips": "{n} 個行程",
    "setup.addWeekdayTrip": "新增{day}預設行程",
    "setup.weekdayTripLabel": "{day}預設行程 {n} 名稱",
    "setup.removeWeekdayTrip": "移除{day}預設行程 {n}",
    "setup.weekdayTripPriority": "{day}預設行程 {n} 優先級",
    "setup.unavailableRanges": "不可用日期範圍",
    "setup.addRange": "新增不可用範圍",
    "setup.range": "範圍 {n}",
    "setup.rangeStart": "不可用範圍 {n} 開始日期",
    "setup.rangeEnd": "不可用範圍 {n} 結束日期",
    "setup.removeRange": "移除不可用範圍 {n}",

    // Priority
    "priority.definitely": "一定用",
    "priority.maybe": "可以用",
    "priority.notPreferred": "唔太想用",
    "priority.definitelyShort": "定",
    "priority.maybeShort": "或",
    "priority.notPreferredShort": "否",

    // Optimizer labels
    "useCitySaver": "使用都會票",
    "payNormally": "正常付費",

    // Default trip names
    "trip.morning": "返工",
    "trip.evening": "收工",
    "trip.default": "行程 {n}",

    // Month names
    "month.0": "1月",
    "month.1": "2月",
    "month.2": "3月",
    "month.3": "4月",
    "month.4": "5月",
    "month.5": "6月",
    "month.6": "7月",
    "month.7": "8月",
    "month.8": "9月",
    "month.9": "10月",
    "month.10": "11月",
    "month.11": "12月",
    "cal.monthYear": "{year}年{month}",

    // Validation
    "validation.remainingUsesRange": "剩餘使用次數必須介乎 0 至 40 之間。",
    "validation.invalidPlanStart": "規劃開始日期必須為有效的 ISO 日期。",
    "validation.invalidExpiry": "到期日必須為有效的 ISO 日期。",
    "validation.expiryBeforeStart": "到期日必須在規劃開始日期當天或之後。",
    "validation.rangeStartInvalid": "不可用範圍 {n} 的開始日期必須為有效的 ISO 日期。",
    "validation.rangeEndInvalid": "不可用範圍 {n} 的結束日期必須為有效的 ISO 日期。",
    "validation.rangeEndBeforeStart": "不可用範圍 {n} 的結束日期必須在開始日期當天或之後。",
    "validation.defaultTripBlank": "{day}的預設行程 {n} 需要名稱。",
    "validation.defaultTripDuplicate": "{day}的預設行程名稱必須唯一。",
    "validation.overrideDateInvalid": "自訂日期 {date} 必須為有效的 ISO 日期。",
    "validation.tripBlank": "{date} 的行程 {n} 需要名稱。",
    "validation.tripDuplicate": "{date} 的行程名稱必須唯一。",
    "validation.noEligibleTrips": "到期前沒有合資格的行程。",

    // Two-ticket planning
    "setup.planSecondTicket": "規劃第二張車票",
    "setup.secondTicketMode": "第二張車票模式",
    "setup.secondTicketModeNormal": "一般",
    "setup.secondTicketModeRebate": "回贈",
    "setup.secondTicketInfo": "啟用日期 {date} · 到期 {expiry}",
    "setup.secondTicketInfoWithBuyDate": "{buyDate} 購買 · 啟用日期 {date} · 到期 {expiry}",
    "setup.secondTicketInfoWithBuyWindow": "{start} 至 {end} 購買 · 啟用日期 {date} · 到期 {expiry}",
    "setup.dataTransfer": "資料轉移",
    "setup.tabTicket": "車票",
    "setup.tabTrips": "行程",
    "setup.nTripsEach": "每日 {n} 個行程",
    "setup.mergeWith": "合併至 {label}",
    "setup.chipSun": "日",
    "setup.chipMon": "一",
    "setup.chipTue": "二",
    "setup.chipWed": "三",
    "setup.chipThu": "四",
    "setup.chipFri": "五",
    "setup.chipSat": "六",
    "setup.export": "匯出",
    "setup.import": "匯入",
    "setup.copyAndClose": "複製並關閉",
    "setup.applyImport": "套用",
    "setup.cancel": "取消",
    "setup.importPlaceholder": "在此貼上匯出的規劃 JSON…",
    "setup.importInvalid": "剪貼簿內容不是有效的規劃資料。",
    "setup.importFail": "無法讀取剪貼簿。請嘗試貼到文字框。",
    "setup.reset": "重設",
    "setup.resetTitle": "重設所有資料？",
    "setup.resetBody": "此操作將清除您的整個規劃並恢復預設值。所有行程自訂、不可用範圍及自訂設定將永久遺失。",
    "setup.resetConfirm": "確認重設",
    "setup.importTitle": "匯入規劃資料？",
    "setup.importBody": "匯入將以貼上的資料取代您目前的規劃。現有規劃的任何未儲存變更將永久遺失。",
    "setup.importConfirm": "確認匯入",
    "summary.ticket1": "車票 1",
    "summary.ticket2": "車票 2",
    "summary.gap": "空檔期",
    "summary.gapTrips": "空檔期正常付費行程",
    "cal.gapLabel": "空檔期 · 正常付費",
    "cal.ticket2Label": "車票 2 · 由 {date} 開始",
  },
};

// ── Context ─────────────────────────────────────────────────────────────

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem("locale");
    if (stored === "en" || stored === "zh-HK") return stored;
  } catch { /* unavailable */ }
  // Auto-detect from browser
  try {
    const lang = navigator.language;
    if (lang.startsWith("zh")) return "zh-HK";
  } catch { /* unavailable */ }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem("locale", next); } catch { /* unavailable */ }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = translations[locale][key] ?? translations.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", locale === "zh-HK" ? "zh-Hant-HK" : "en");
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Shorthand — just the translation function */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  return useI18n().t;
}

// ── Translatable trip name support ──────────────────────────────────────

/**
 * Maps all known translations of default trip names back to their i18n key.
 * This lets us detect "Morning commute" / "早上通勤" etc. and translate them
 * dynamically when the user switches language.
 */
const TRIP_NAME_REVERSE_MAP: Record<string, string> = {};
for (const locale of ["en", "zh-HK"] as Locale[]) {
  for (const key of ["trip.morning", "trip.evening"]) {
    const value = translations[locale][key];
    if (value) TRIP_NAME_REVERSE_MAP[value] = key;
  }
}

/**
 * Patterns for numbered default trip names like "Trip 3" / "行程 3".
 * We extract the number and re-translate with the current locale.
 */
const NUMBERED_TRIP_PATTERNS: { regex: RegExp; key: string }[] = [];
for (const locale of ["en", "zh-HK"] as Locale[]) {
  // Build a regex from the template, e.g. "Trip {n}" → /^Trip (\d+)$/
  const template = translations[locale]["trip.default"];
  if (template) {
    const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace("\\{n\\}", "(\\d+)");
    NUMBERED_TRIP_PATTERNS.push({ regex: new RegExp(`^${pattern}$`), key: "trip.default" });
  }
}

/**
 * Resolve a trip name for display. If the name matches a known default
 * (in any language), return the translation for the current locale.
 * Otherwise return the name as-is (user-customized).
 */
export function translateTripName(
  name: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  // Check exact matches first (Morning commute, Evening commute, etc.)
  const key = TRIP_NAME_REVERSE_MAP[name];
  if (key) return t(key);

  // Check numbered patterns (Trip 3, 行程 3, etc.)
  for (const { regex, key: patternKey } of NUMBERED_TRIP_PATTERNS) {
    const match = name.match(regex);
    if (match) return t(patternKey, { n: match[1] });
  }

  return name;
}
