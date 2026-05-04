import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfMonth
} from "date-fns";
import type { DateRange } from "./types";

export function parseIsoDate(value: string): Date {
  return parseISO(value);
}

export function formatIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getTodayIsoDate(): string {
  return formatIsoDate(new Date());
}

export function compareIsoDates(left: string, right: string): number {
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = parseIsoDate(value);
  return isValid(date) && formatIsoDate(date) === value;
}

export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (isAfter(start, end)) {
    return [];
  }

  return eachDayOfInterval({ start, end }).map(formatIsoDate);
}

export function isDateInRange(date: string, range: Pick<DateRange, "startDate" | "endDate">): boolean {
  return compareIsoDates(date, range.startDate) >= 0 && compareIsoDates(date, range.endDate) <= 0;
}

export function isDateInRanges(date: string, ranges: Pick<DateRange, "startDate" | "endDate">[]): boolean {
  return ranges.some((range) => isDateInRange(date, range));
}

export function getWeekdayIndex(date: string): number {
  return parseIsoDate(date).getDay();
}

export function getMonthKeysInRange(startDate: string, endDate: string): string[] {
  const start = startOfMonth(parseIsoDate(startDate));
  const end = startOfMonth(parseIsoDate(endDate));
  const keys: string[] = [];

  for (let cursor = start; !isAfter(cursor, end); cursor = addMonths(cursor, 1)) {
    keys.push(format(cursor, "yyyy-MM"));
  }

  return keys;
}

export function getDatesForMonth(monthKey: string): string[] {
  const firstDay = parseISO(`${monthKey}-01`);
  return eachDayOfInterval({
    start: startOfMonth(firstDay),
    end: endOfMonth(firstDay)
  }).map(formatIsoDate);
}

export function shiftIsoDate(date: string, days: number): string {
  return formatIsoDate(addDays(parseIsoDate(date), days));
}

export function isBeforeIso(left: string, right: string): boolean {
  return isBefore(parseIsoDate(left), parseIsoDate(right));
}

export function isAfterIso(left: string, right: string): boolean {
  return isAfter(parseIsoDate(left), parseIsoDate(right));
}
