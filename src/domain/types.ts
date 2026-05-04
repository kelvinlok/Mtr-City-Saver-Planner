export type TripPriority = "definitely" | "maybe" | "not_preferred";
export type SecondTicketMode = "normal" | "rebate";

export const PRIORITY_LABELS: Record<TripPriority, string> = {
  definitely: "Definitely",
  maybe: "Maybe",
  not_preferred: "Not preferred"
};

export const PRIORITY_ORDER: Record<TripPriority, number> = {
  definitely: 0,
  maybe: 1,
  not_preferred: 2
};

export type TripTemplate = {
  id: string;
  priority: TripPriority;
  done?: boolean;
};

export type DefaultPattern = {
  tripsByWeekday: Record<number, TripTemplate[]>;
};

export type DateRange = {
  id: string;
  startDate: string;
  endDate: string;
};

export type DayOverride = {
  unavailable?: boolean;
  trips?: TripTemplate[];
};

export type TicketPlan = {
  remainingUses: number;
  planStartDate: string;
  expiryDate: string;
  defaultPattern: DefaultPattern;
  unavailableRanges: DateRange[];
  dayOverrides: Record<string, DayOverride>;
  planSecondTicket: boolean;
  secondTicketMode?: SecondTicketMode;
};

export type GeneratedTrip = {
  id: string;
  date: string;
  tripIndex: number;
  priority: TripPriority;
  source: "default" | "override";
  done?: boolean;
};

export type OptimizedTrip = GeneratedTrip & {
  useCitySaver: boolean;
  ticket?: 1 | 2;
};

export type OptimizedDay = {
  date: string;
  unavailable: boolean;
  trips: OptimizedTrip[];
  hasOverride: boolean;
};

export type TicketBuyWindow = {
  startDate: string;
  endDate: string;
};

export type SecondTicketResult = {
  activationDate: string;
  expiryDate: string;
  buyWindow?: TicketBuyWindow;
  assignedUses: number;
  unusedUses: number;
  normalPayTrips: number;
  priorityUseCounts: Record<TripPriority, number>;
};

export type OptimizationResult = {
  days: OptimizedDay[];
  assignedUses: number;
  unusedUses: number;
  normalPayTrips: number;
  priorityUseCounts: Record<TripPriority, number>;
  secondTicket?: SecondTicketResult;
  /** Date of the last trip assigned to ticket 1 (or planStartDate if none). */
  lastT1TripDate: string;
  gapDays: number;
  gapNormalPayTrips: number;
};
