import type { TripTemplate } from "./types";

export type WeekdayGroup = {
  /** Weekday indices in this group, e.g. [1,2,3,4,5] for Mon–Fri */
  weekdays: number[];
  /** The shared trips (from the first weekday in the group) */
  trips: TripTemplate[];
  /** Fingerprint string used for matching */
  fingerprint: string;
};

/**
 * Serialize a weekday's trips into a stable fingerprint for comparison.
 * Two weekdays with the same fingerprint have identical trip configurations.
 */
export function tripFingerprint(trips: TripTemplate[]): string {
  return trips
    .map((t) => `${t.id}:${t.priority}`)
    .join("|");
}

/**
 * Group weekdays (0–6) by identical trip configurations.
 * Returns groups ordered: groups with trips first (by earliest weekday),
 * then empty groups (by earliest weekday).
 */
export function groupWeekdays(
  tripsByWeekday: Record<number, TripTemplate[]>
): WeekdayGroup[] {
  const fingerprints = new Map<string, number[]>();
  const order: string[] = [];

  for (let day = 0; day < 7; day++) {
    const trips = tripsByWeekday[day] ?? [];
    const fp = tripFingerprint(trips);
    if (!fingerprints.has(fp)) {
      fingerprints.set(fp, []);
      order.push(fp);
    }
    fingerprints.get(fp)!.push(day);
  }

  const groups: WeekdayGroup[] = order.map((fp) => {
    const weekdays = fingerprints.get(fp)!;
    const trips = tripsByWeekday[weekdays[0]] ?? [];
    return { weekdays, trips: [...trips], fingerprint: fp };
  });

  // Sort: non-empty groups first (by earliest weekday), then empty groups
  groups.sort((a, b) => {
    const aEmpty = a.trips.length === 0;
    const bEmpty = b.trips.length === 0;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return a.weekdays[0] - b.weekdays[0];
  });

  return groups;
}

/**
 * Format a group's weekday label, e.g. "Mon – Fri", "Sat – Sun", "Wednesday".
 * Uses the provided day name lookup function.
 */
export function formatGroupLabel(
  weekdays: number[],
  dayName: (weekday: number) => string
): string {
  if (weekdays.length === 1) return dayName(weekdays[0]);
  // Check if consecutive
  const sorted = [...weekdays].sort((a, b) => a - b);
  const isConsecutive = sorted.every((d, i) =>
    i === 0 || d === sorted[i - 1] + 1
  );
  if (isConsecutive && sorted.length >= 2) {
    return `${dayName(sorted[0])} – ${dayName(sorted[sorted.length - 1])}`;
  }
  // Non-consecutive: list all
  return sorted.map(dayName).join(", ");
}
