import { getTodayIsoDate, isValidIsoDate, shiftIsoDate } from "../domain/dateUtils";
import type { SecondTicketMode, TicketPlan, TripPriority, TripTemplate } from "../domain/types";

const STORAGE_KEY = "mtr-city-saver-plan:v1";
const TRIP_PRIORITIES: TripPriority[] = ["definitely", "maybe", "not_preferred"];
const SECOND_TICKET_MODES: SecondTicketMode[] = ["normal", "rebate"];

function trip(id: string, priority: TripPriority): TripTemplate {
  return { id, priority };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTripPriority(value: unknown): value is TripPriority {
  return typeof value === "string" && TRIP_PRIORITIES.includes(value as TripPriority);
}

function isSecondTicketMode(value: unknown): value is SecondTicketMode {
  return typeof value === "string" && SECOND_TICKET_MODES.includes(value as SecondTicketMode);
}

function isTripTemplate(value: unknown): value is TripTemplate {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isTripPriority(value.priority) &&
    (value.done === undefined || typeof value.done === "boolean")
  );
}

function isTicketPlan(value: unknown): value is TicketPlan {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.remainingUses !== "number" ||
    typeof value.planStartDate !== "string" ||
    !isValidIsoDate(value.planStartDate) ||
    typeof value.expiryDate !== "string" ||
    !isValidIsoDate(value.expiryDate) ||
    !isRecord(value.defaultPattern) ||
    !isRecord(value.defaultPattern.tripsByWeekday) ||
    !Array.isArray(value.unavailableRanges) ||
    !isRecord(value.dayOverrides)
  ) {
    return false;
  }

  if (value.planSecondTicket !== undefined && typeof value.planSecondTicket !== "boolean") {
    return false;
  }

  if (value.secondTicketMode !== undefined && !isSecondTicketMode(value.secondTicketMode)) {
    return false;
  }

  return (
    Object.values(value.defaultPattern.tripsByWeekday).every(
      (trips) => Array.isArray(trips) && trips.every(isTripTemplate)
    ) &&
    value.unavailableRanges.every(
      (range) =>
        isRecord(range) &&
        typeof range.id === "string" &&
        typeof range.startDate === "string" &&
        isValidIsoDate(range.startDate) &&
        typeof range.endDate === "string" &&
        isValidIsoDate(range.endDate)
    ) &&
    Object.entries(value.dayOverrides).every(
      ([date, override]) =>
        isValidIsoDate(date) &&
        isRecord(override) &&
        (override.unavailable === undefined || typeof override.unavailable === "boolean") &&
        (override.trips === undefined || (Array.isArray(override.trips) && override.trips.every(isTripTemplate)))
    )
  );
}

export function createDefaultPlan(today = getTodayIsoDate()): TicketPlan {
  return {
    remainingUses: 40,
    planStartDate: today,
    expiryDate: shiftIsoDate(today, 39),
    defaultPattern: {
      tripsByWeekday: {
        1: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        2: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        3: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        4: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")],
        5: [trip("Morning commute", "definitely"), trip("Evening commute", "definitely")]
      }
    },
    unavailableRanges: [],
    dayOverrides: {},
    planSecondTicket: false,
    secondTicketMode: "normal"
  };
}

export function loadPlan(): TicketPlan {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return createDefaultPlan();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isTicketPlan(parsed)) return createDefaultPlan();
    return {
      ...parsed,
      planSecondTicket: parsed.planSecondTicket ?? false,
      secondTicketMode: parsed.secondTicketMode ?? "normal"
    };
  } catch {
    return createDefaultPlan();
  }
}

export function savePlan(plan: TicketPlan): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Ignore storage failures so private browsing or quota issues do not break the planner.
  }
}
