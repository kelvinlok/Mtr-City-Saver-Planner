import { compareIsoDates, isValidIsoDate } from "./dateUtils";
import { optimizePlan } from "./optimizer";
import type { TicketPlan } from "./types";

type T = (key: string, params?: Record<string, string | number>) => string;

const WEEKDAY_KEYS = [
  "setup.sunday", "setup.monday", "setup.tuesday", "setup.wednesday",
  "setup.thursday", "setup.friday", "setup.saturday",
];

export function validatePlan(plan: TicketPlan, t: T): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(plan.remainingUses) || plan.remainingUses < 0 || plan.remainingUses > 40) {
    errors.push(t("validation.remainingUsesRange"));
  }

  const hasValidPlanStartDate = isValidIsoDate(plan.planStartDate);
  const hasValidExpiryDate = isValidIsoDate(plan.expiryDate);
  const hasValidPlanWindow =
    hasValidPlanStartDate &&
    hasValidExpiryDate &&
    compareIsoDates(plan.expiryDate, plan.planStartDate) >= 0;

  if (!hasValidPlanStartDate) {
    errors.push(t("validation.invalidPlanStart"));
  }

  if (!hasValidExpiryDate) {
    errors.push(t("validation.invalidExpiry"));
  }

  if (hasValidPlanStartDate && hasValidExpiryDate && !hasValidPlanWindow) {
    errors.push(t("validation.expiryBeforeStart"));
  }

  let hasValidUnavailableRanges = true;
  let hasValidDayOverrideDates = true;

  plan.unavailableRanges.forEach((range, index) => {
    const hasValidStartDate = isValidIsoDate(range.startDate);
    const hasValidEndDate = isValidIsoDate(range.endDate);

    if (!hasValidStartDate) {
      hasValidUnavailableRanges = false;
      errors.push(t("validation.rangeStartInvalid", { n: index + 1 }));
    }

    if (!hasValidEndDate) {
      hasValidUnavailableRanges = false;
      errors.push(t("validation.rangeEndInvalid", { n: index + 1 }));
    }

    if (hasValidStartDate && hasValidEndDate && compareIsoDates(range.endDate, range.startDate) < 0) {
      hasValidUnavailableRanges = false;
      errors.push(t("validation.rangeEndBeforeStart", { n: index + 1 }));
    }
  });

  Object.entries(plan.defaultPattern.tripsByWeekday).forEach(([weekdayKey, trips]) => {
    const tripIds = new Set<string>();
    const weekday = t(WEEKDAY_KEYS[Number(weekdayKey)] ?? "setup.sunday");

    trips.forEach((trip, index) => {
      const label = trip.id.trim();

      if (!label) {
        errors.push(t("validation.defaultTripBlank", { n: index + 1, day: weekday }));
      }

      if (tripIds.has(label)) {
        errors.push(t("validation.defaultTripDuplicate", { day: weekday }));
      }

      tripIds.add(label);
    });
  });

  Object.entries(plan.dayOverrides).forEach(([date, override]) => {
    const tripIds = new Set<string>();

    if (!isValidIsoDate(date)) {
      hasValidDayOverrideDates = false;
      errors.push(t("validation.overrideDateInvalid", { date }));
    }

    override.trips?.forEach((trip, index) => {
      const label = trip.id.trim();

      if (!label) {
        errors.push(t("validation.tripBlank", { n: index + 1, date }));
      }

      if (tripIds.has(label)) {
        errors.push(t("validation.tripDuplicate", { date }));
      }

      tripIds.add(label);
    });
  });

  if (hasValidPlanWindow && hasValidUnavailableRanges && hasValidDayOverrideDates) {
    const eligibleTripCount = optimizePlan(plan).days.reduce((count, day) => count + day.trips.length, 0);

    if (eligibleTripCount === 0) {
      errors.push(t("validation.noEligibleTrips"));
    }
  }

  return errors;
}
