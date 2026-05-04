import { eachDateInclusive, getWeekdayIndex, isDateInRanges, shiftIsoDate, compareIsoDates } from "./dateUtils";
import { isPublicHoliday } from "./holidays";
import {
  PRIORITY_ORDER,
  type GeneratedTrip,
  type OptimizationResult,
  type OptimizedTrip,
  type SecondTicketMode,
  type TicketBuyWindow,
  type TicketPlan,
  type TripPriority
} from "./types";

function makeGeneratedTrip(
  date: string,
  tripIndex: number,
  templateId: string,
  priority: TripPriority,
  source: GeneratedTrip["source"],
  done?: boolean
): GeneratedTrip {
  return {
    id: templateId,
    date,
    tripIndex,
    priority,
    source,
    done: done ?? false
  };
}

function getGeneratedTripsForDate(plan: TicketPlan, date: string): GeneratedTrip[] {
  const override = plan.dayOverrides[date];

  if (override?.unavailable || isDateInRanges(date, plan.unavailableRanges)) {
    return [];
  }

  if (override?.trips) {
    return override.trips.map((trip, index) =>
      makeGeneratedTrip(date, index, trip.id, trip.priority, "override", trip.done)
    );
  }

  // Skip default pattern on public holidays — only explicit overrides apply
  if (isPublicHoliday(date)) {
    return [];
  }

  const weekday = getWeekdayIndex(date);
  const templates = plan.defaultPattern.tripsByWeekday[weekday] ?? [];

  return templates.map((trip, index) =>
    makeGeneratedTrip(date, index, trip.id, trip.priority, "default")
  );
}

function isUnavailableForCalendar(plan: TicketPlan, date: string): boolean {
  const override = plan.dayOverrides[date];

  if (override?.unavailable || isDateInRanges(date, plan.unavailableRanges)) {
    return true;
  }

  return false;
}

function getTripKey(trip: GeneratedTrip): string {
  return `${trip.date}:${trip.tripIndex}:${trip.id}`;
}

type AssignmentBuckets = {
  done: GeneratedTrip[];
  preferred: GeneratedTrip[];
  notPreferred: GeneratedTrip[];
};

function compareTripAssignmentOrder(left: GeneratedTrip, right: GeneratedTrip): number {
  const dateDelta = left.date.localeCompare(right.date);
  if (dateDelta !== 0) return dateDelta;
  const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
  if (priorityDelta !== 0) return priorityDelta;
  return left.tripIndex - right.tripIndex;
}

function getAssignmentBuckets(trips: GeneratedTrip[]): AssignmentBuckets {
  const buckets: AssignmentBuckets = {
    done: [],
    preferred: [],
    notPreferred: [],
  };

  for (const trip of trips) {
    if (trip.done) {
      buckets.done.push(trip);
    } else if (trip.priority === "not_preferred") {
      buckets.notPreferred.push(trip);
    } else {
      buckets.preferred.push(trip);
    }
  }

  buckets.preferred.sort(compareTripAssignmentOrder);
  buckets.notPreferred.sort(compareTripAssignmentOrder);
  return buckets;
}

function assignFromBuckets(buckets: AssignmentBuckets, maxUses: number): Set<string> {
  const doneKeys = buckets.done.map(getTripKey);
  const remaining = Math.max(0, maxUses - doneKeys.length);
  const nonDoneAssigned = [...buckets.preferred, ...buckets.notPreferred]
    .slice(0, remaining)
    .map(getTripKey);

  return new Set([...doneKeys, ...nonDoneAssigned]);
}

function sortAndAssign(trips: GeneratedTrip[], maxUses: number): Set<string> {
  return assignFromBuckets(getAssignmentBuckets(trips), maxUses);
}

function countPriorityUses(trips: GeneratedTrip[], assignedKeys: Set<string>): Record<TripPriority, number> {
  const assigned = trips.filter((t) => assignedKeys.has(getTripKey(t)));
  return {
    definitely: assigned.filter((t) => t.priority === "definitely").length,
    maybe: assigned.filter((t) => t.priority === "maybe").length,
    not_preferred: assigned.filter((t) => t.priority === "not_preferred").length,
  };
}

const SECOND_TICKET_USES = 40;
const SECOND_TICKET_DAYS = 39; // 40 days = day 0 through day 39
const CITY_SAVER_TICKET_PRICE = 360;
const CITY_SAVER_COST_PER_TRIP = CITY_SAVER_TICKET_PRICE / SECOND_TICKET_USES;
const DEFINITELY_GAP_NORMAL_PAY_LOSS = 5;
const SAME_MONTH_SECOND_TICKET_SAVING = 130;

function estimateGapNormalPayLoss(trips: GeneratedTrip[]): number {
  return trips.reduce((loss, trip) => {
    if (trip.priority === "definitely") {
      return loss + DEFINITELY_GAP_NORMAL_PAY_LOSS;
    }

    return loss;
  }, 0);
}

function countNotPreferred(trips: GeneratedTrip[], assignedKeys: Set<string>): number {
  return trips.filter(
    (t) => t.priority === "not_preferred" && assignedKeys.has(getTripKey(t))
  ).length;
}

function getMonthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function getNextMonthStart(monthStartDate: string): string {
  const year = Number(monthStartDate.slice(0, 4));
  const month = Number(monthStartDate.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function getMonthEnd(monthStartDate: string): string {
  return shiftIsoDate(getNextMonthStart(monthStartDate), -1);
}

function maxIsoDate(left: string, right: string): string {
  return compareIsoDates(left, right) >= 0 ? left : right;
}

function minIsoDate(left: string, right: string): string {
  return compareIsoDates(left, right) <= 0 ? left : right;
}

type ActivationCandidate = {
  activationDate: string;
  buyWindow?: TicketBuyWindow;
  rebateSaving: number;
};

function getNormalActivationCandidates(earliestActivation: string, latestActivation: string): ActivationCandidate[] {
  return eachDateInclusive(earliestActivation, latestActivation).map((activationDate) => ({
    activationDate,
    buyWindow: {
      startDate: activationDate,
      endDate: activationDate,
    },
    rebateSaving: 0,
  }));
}

function getRebateBuyWindow(activationDate: string, buyMonth: string): TicketBuyWindow | undefined {
  const monthEnd = getMonthEnd(buyMonth);
  if (
    compareIsoDates(activationDate, buyMonth) < 0 ||
    compareIsoDates(activationDate, shiftIsoDate(monthEnd, 13)) > 0
  ) {
    return undefined;
  }

  return {
    startDate: maxIsoDate(buyMonth, shiftIsoDate(activationDate, -13)),
    endDate: minIsoDate(monthEnd, activationDate),
  };
}

function getFirstFeasibleRebateBuyMonth(
  plan: TicketPlan,
  earliestActivation: string,
  latestActivation: string
): string | undefined {
  const firstBuyMonth = getMonthStart(plan.planStartDate);
  const buyMonths = [firstBuyMonth, getNextMonthStart(firstBuyMonth)];

  for (const buyMonth of buyMonths) {
    const monthEnd = getMonthEnd(buyMonth);
    const windowStart = maxIsoDate(earliestActivation, buyMonth);
    const windowEnd = minIsoDate(latestActivation, shiftIsoDate(monthEnd, 13));
    if (compareIsoDates(windowStart, windowEnd) <= 0) {
      return buyMonth;
    }
  }

  return undefined;
}

function getRebateActivationCandidates(
  plan: TicketPlan,
  earliestActivation: string,
  latestActivation: string
): ActivationCandidate[] {
  const rebateBuyMonth = getFirstFeasibleRebateBuyMonth(plan, earliestActivation, latestActivation);

  return eachDateInclusive(earliestActivation, latestActivation).map((activationDate) => {
    const rebateBuyWindow = rebateBuyMonth
      ? getRebateBuyWindow(activationDate, rebateBuyMonth)
      : undefined;

    return {
      activationDate,
      buyWindow: rebateBuyWindow ?? {
        startDate: activationDate,
        endDate: activationDate,
      },
      rebateSaving: rebateBuyWindow ? SAME_MONTH_SECOND_TICKET_SAVING : 0,
    };
  });
}

function getActivationCandidates(
  plan: TicketPlan,
  mode: SecondTicketMode,
  earliestActivation: string,
  latestActivation: string
): ActivationCandidate[] {
  if (mode === "normal") {
    return getNormalActivationCandidates(earliestActivation, latestActivation);
  }

  return getRebateActivationCandidates(plan, earliestActivation, latestActivation);
}

function optimizeSingleTicket(plan: TicketPlan): OptimizationResult {
  const dates = eachDateInclusive(plan.planStartDate, plan.expiryDate);
  const generatedTrips = dates.flatMap((date) => getGeneratedTripsForDate(plan, date));
  const selectedTripKeys = sortAndAssign(generatedTrips, plan.remainingUses);

  const days = dates.map((date) => {
    const trips = getGeneratedTripsForDate(plan, date).map<OptimizedTrip>((trip) => ({
      ...trip,
      useCitySaver: selectedTripKeys.has(getTripKey(trip)),
      ticket: selectedTripKeys.has(getTripKey(trip)) ? 1 : undefined
    }));

    return {
      date,
      unavailable: isUnavailableForCalendar(plan, date),
      trips,
      hasOverride: Boolean(plan.dayOverrides[date])
    };
  });

  const allTrips = days.flatMap((day) => day.trips);
  const assignedTrips = allTrips.filter((trip) => trip.useCitySaver);
  const lastT1Date = assignedTrips.length > 0
    ? assignedTrips[assignedTrips.length - 1].date
    : plan.planStartDate;

  return {
    days,
    assignedUses: assignedTrips.length,
    unusedUses: Math.max(0, plan.remainingUses - assignedTrips.length),
    normalPayTrips: allTrips.length - assignedTrips.length,
    priorityUseCounts: countPriorityUses(generatedTrips, selectedTripKeys),
    lastT1TripDate: lastT1Date,
    gapDays: 0,
    gapNormalPayTrips: 0
  };
}

function optimizeTwoTickets(plan: TicketPlan): OptimizationResult {
  const tripCache = new Map<string, GeneratedTrip[]>();
  const getCachedGeneratedTripsForDate = (date: string): GeneratedTrip[] => {
    const cached = tripCache.get(date);
    if (cached) return cached;

    const trips = getGeneratedTripsForDate(plan, date);
    tripCache.set(date, trips);
    return trips;
  };
  const assignmentBucketCache = new Map<string, AssignmentBuckets>();
  const getCachedAssignmentBucketsForDate = (date: string): AssignmentBuckets => {
    const cached = assignmentBucketCache.get(date);
    if (cached) return cached;

    const buckets = getAssignmentBuckets(getCachedGeneratedTripsForDate(date));
    assignmentBucketCache.set(date, buckets);
    return buckets;
  };

  // --- Ticket 1: collect trips within the expiry window ---
  const t1Dates = eachDateInclusive(plan.planStartDate, plan.expiryDate);
  const t1AllTrips = t1Dates.flatMap((date) => getCachedGeneratedTripsForDate(date));
  const t1AssignmentBuckets = getAssignmentBuckets(t1AllTrips);

  type Candidate = {
    t1AssignedKeys: Set<string>;
    t1UnusedUses: number;
    lastT1Date: string;
    lastT1TripIndex: number;
    activationDate: string;
    expiryDate: string;
    assignedKeys: Set<string>;
    eligibleTrips: GeneratedTrip[];
    buyWindow?: TicketBuyWindow;
    notPreferredCount: number;
    unusedUses: number;
    totalUnusedUses: number;
    gapDays: number;
    gapNormalPayLoss: number;
    estimatedLoss: number;
  };

  let bestCandidate: Candidate | null = null;
  const latestActivation = shiftIsoDate(plan.expiryDate, 40);
  const latestCalendarDate = shiftIsoDate(latestActivation, SECOND_TICKET_DAYS);
  const searchDates = eachDateInclusive(plan.planStartDate, latestCalendarDate);
  const dateIndexByDate = new Map(searchDates.map((date, index) => [date, index]));

  function getDateIndex(date: string): number {
    const index = dateIndexByDate.get(date);
    if (index === undefined) {
      throw new Error(`Optimizer date ${date} is outside the search range`);
    }

    return index;
  }

  function getDateRangeFromIndexes(startIndex: number, endIndex: number): string[] {
    if (startIndex > endIndex) return [];
    return searchDates.slice(startIndex, endIndex + 1);
  }

  function canUseTicket2(
    trip: GeneratedTrip,
    lastT1Date: string,
    lastT1TripIndex: number,
    t1AssignedKeys: Set<string>
  ): boolean {
    if (t1AssignedKeys.has(getTripKey(trip))) return false;
    if (trip.date === lastT1Date) return trip.tripIndex > lastT1TripIndex;
    return true;
  }

  function getTicket2EligibleTrips(
    startIndex: number,
    endIndex: number,
    lastT1Date: string,
    lastT1TripIndex: number,
    t1AssignedKeys: Set<string>
  ): { buckets: AssignmentBuckets; trips: GeneratedTrip[] } {
    const buckets: AssignmentBuckets = {
      done: [],
      preferred: [],
      notPreferred: [],
    };
    const trips: GeneratedTrip[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
      const dayBuckets = getCachedAssignmentBucketsForDate(searchDates[index]);
      for (const trip of dayBuckets.done) {
        if (!canUseTicket2(trip, lastT1Date, lastT1TripIndex, t1AssignedKeys)) continue;
        buckets.done.push(trip);
        trips.push(trip);
      }
      for (const trip of dayBuckets.preferred) {
        if (!canUseTicket2(trip, lastT1Date, lastT1TripIndex, t1AssignedKeys)) continue;
        buckets.preferred.push(trip);
        trips.push(trip);
      }
      for (const trip of dayBuckets.notPreferred) {
        if (!canUseTicket2(trip, lastT1Date, lastT1TripIndex, t1AssignedKeys)) continue;
        buckets.notPreferred.push(trip);
        trips.push(trip);
      }
    }

    return { buckets, trips };
  }

  function isBetterCandidate(candidate: Candidate, currentBest: Candidate): boolean {
    if (candidate.estimatedLoss !== currentBest.estimatedLoss) {
      return candidate.estimatedLoss < currentBest.estimatedLoss;
    }

    if (candidate.gapNormalPayLoss !== currentBest.gapNormalPayLoss) {
      return candidate.gapNormalPayLoss < currentBest.gapNormalPayLoss;
    }

    if (candidate.notPreferredCount !== currentBest.notPreferredCount) {
      return candidate.notPreferredCount < currentBest.notPreferredCount;
    }

    if (candidate.totalUnusedUses !== currentBest.totalUnusedUses) {
      return candidate.totalUnusedUses < currentBest.totalUnusedUses;
    }

    if (candidate.t1UnusedUses !== currentBest.t1UnusedUses) {
      return candidate.t1UnusedUses < currentBest.t1UnusedUses;
    }

    if (candidate.unusedUses !== currentBest.unusedUses) {
      return candidate.unusedUses < currentBest.unusedUses;
    }

    return compareIsoDates(candidate.activationDate, currentBest.activationDate) > 0;
  }

  const maxPossibleRebateSaving = plan.secondTicketMode === "rebate" ? SAME_MONTH_SECOND_TICKET_SAVING : 0;

  for (let t1UseLimit = plan.remainingUses; t1UseLimit >= 0; t1UseLimit--) {
    const t1AssignedKeys = assignFromBuckets(t1AssignmentBuckets, t1UseLimit);
    let lastT1Trip: GeneratedTrip | null = null;
    for (const trip of t1AllTrips) {
      if (t1AssignedKeys.has(getTripKey(trip))) {
        lastT1Trip = trip;
      }
    }

    const lastT1Date = lastT1Trip?.date ?? plan.planStartDate;
    const lastT1TripIndex = lastT1Trip?.tripIndex ?? -1;
    const t1UnusedUses = Math.max(0, plan.remainingUses - t1AssignedKeys.size);
    const t1NotPreferredCount = countNotPreferred(t1AllTrips, t1AssignedKeys);

    const optimisticLoss =
      (t1NotPreferredCount * CITY_SAVER_COST_PER_TRIP) +
      (t1UnusedUses * CITY_SAVER_COST_PER_TRIP) -
      maxPossibleRebateSaving;
    if (bestCandidate && optimisticLoss > bestCandidate.estimatedLoss) {
      continue;
    }

    // Ticket 2 can start as early as the same day as the last T1 trip
    // (picking up trips after the last T1 trip on that day).
    const earliestActivation = lastT1Date;
    const activationCandidates = getActivationCandidates(
      plan,
      plan.secondTicketMode ?? "normal",
      earliestActivation,
      latestActivation
    );

    for (const activationCandidate of activationCandidates) {
      const { activationDate } = activationCandidate;
      const activationIndex = getDateIndex(activationDate);
      const t2ExpiryIndex = activationIndex + SECOND_TICKET_DAYS;
      const t2Expiry = searchDates[t2ExpiryIndex];
      const t2Eligible = getTicket2EligibleTrips(
        activationIndex,
        t2ExpiryIndex,
        lastT1Date,
        lastT1TripIndex,
        t1AssignedKeys
      );
      const t2EligibleTrips = t2Eligible.trips;
      const t2AssignedKeys = assignFromBuckets(t2Eligible.buckets, SECOND_TICKET_USES);

      const notPreferredCount =
        t1NotPreferredCount +
        countNotPreferred(t2EligibleTrips, t2AssignedKeys);
      const unusedUses = Math.max(0, SECOND_TICKET_USES - t2AssignedKeys.size);
      const totalUnusedUses = t1UnusedUses + unusedUses;

      // Gap: days strictly between lastT1Date and activationDate
      const lastT1DateIndex = getDateIndex(lastT1Date);
      const gapDateIndexesStart = lastT1DateIndex + 1;
      const gapDateIndexesEnd = activationIndex - 1;
      const gapDays = Math.max(0, gapDateIndexesEnd - gapDateIndexesStart + 1);
      const gapTrips = getDateRangeFromIndexes(gapDateIndexesStart, gapDateIndexesEnd)
        .flatMap((date) => getCachedGeneratedTripsForDate(date));
      const gapNormalPayLoss = estimateGapNormalPayLoss(gapTrips);
      const estimatedLoss =
        (notPreferredCount * CITY_SAVER_COST_PER_TRIP) +
        (totalUnusedUses * CITY_SAVER_COST_PER_TRIP) +
        gapNormalPayLoss -
        activationCandidate.rebateSaving;

      const candidate: Candidate = {
        t1AssignedKeys,
        t1UnusedUses,
        lastT1Date,
        lastT1TripIndex,
        activationDate,
        expiryDate: t2Expiry,
        assignedKeys: t2AssignedKeys,
        eligibleTrips: t2EligibleTrips,
        buyWindow: activationCandidate.buyWindow,
        notPreferredCount,
        unusedUses,
        totalUnusedUses,
        gapDays,
        gapNormalPayLoss,
        estimatedLoss,
      };

      if (!bestCandidate) {
        bestCandidate = candidate;
        continue;
      }

      // Estimate avoidable dollar loss before applying preference tie-breakers.
      if (isBetterCandidate(candidate, bestCandidate)) {
        bestCandidate = candidate;
      }
    }
  }

  const t2 = bestCandidate!;

  // --- Build full day list from ticket 1 start through ticket 2 expiry ---
  const allDates = getDateRangeFromIndexes(0, getDateIndex(t2.expiryDate));

  // Gap trips: trips on dates strictly between lastT1Date and t2 activation
  const gapTripCount = (() => {
    const gapDates = getDateRangeFromIndexes(
      getDateIndex(t2.lastT1Date) + 1,
      getDateIndex(t2.activationDate) - 1
    );
    return gapDates.flatMap((date) => getCachedGeneratedTripsForDate(date)).length;
  })();

  const days = allDates.map((date) => {
    const rawTrips = getCachedGeneratedTripsForDate(date);

    const trips = rawTrips.map<OptimizedTrip>((trip) => {
      const key = getTripKey(trip);
      const isT1Assigned = t2.t1AssignedKeys.has(key);
      const isT2Assigned = t2.assignedKeys.has(key);
      const useCitySaver = isT1Assigned || isT2Assigned;
      return {
        ...trip,
        useCitySaver,
        ticket: isT1Assigned ? 1 : isT2Assigned ? 2 : undefined
      };
    });

    return {
      date,
      unavailable: isUnavailableForCalendar(plan, date),
      trips,
      hasOverride: Boolean(plan.dayOverrides[date])
    };
  });

  const allTrips = days.flatMap((day) => day.trips);
  const t1FinalAssigned = allTrips.filter((t) => t.ticket === 1);
  const t2FinalAssigned = allTrips.filter((t) => t.ticket === 2);

  return {
    days,
    assignedUses: t1FinalAssigned.length,
    unusedUses: Math.max(0, plan.remainingUses - t1FinalAssigned.length),
    normalPayTrips: allTrips.filter((t) => !t.useCitySaver).length,
    priorityUseCounts: countPriorityUses(t1AllTrips, t2.t1AssignedKeys),
    lastT1TripDate: t2.lastT1Date,
    secondTicket: {
      activationDate: t2.activationDate,
      expiryDate: t2.expiryDate,
      buyWindow: t2.buyWindow,
      assignedUses: t2FinalAssigned.length,
      unusedUses: Math.max(0, SECOND_TICKET_USES - t2FinalAssigned.length),
      normalPayTrips: t2.eligibleTrips.length - t2FinalAssigned.length,
      priorityUseCounts: countPriorityUses(t2.eligibleTrips, t2.assignedKeys)
    },
    gapDays: t2.gapDays,
    gapNormalPayTrips: gapTripCount
  };
}

export function optimizePlan(plan: TicketPlan): OptimizationResult {
  if (!plan.planSecondTicket) {
    return optimizeSingleTicket(plan);
  }
  return optimizeTwoTickets(plan);
}
