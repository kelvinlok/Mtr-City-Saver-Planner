import React, { useRef } from "react";
import { format, parseISO } from "date-fns";
import { getDatesForMonth, getMonthKeysInRange } from "../domain/dateUtils";
import { isPublicHoliday, getHolidayName } from "../domain/holidays";
import { useI18n, useT, translateTripName } from "../domain/i18n";
import type { OptimizationResult, OptimizedDay, TicketPlan } from "../domain/types";

type TicketRegion = "t1" | "gap" | "t2" | "shared" | "none";

function getTicketRegion(
  date: string,
  lastT1TripDate: string,
  secondTicket?: { activationDate: string; expiryDate: string }
): TicketRegion {
  if (!secondTicket) return "none";
  // Shared day: last T1 trip and T2 activation on the same date
  if (date === lastT1TripDate && date === secondTicket.activationDate) return "shared";
  if (date <= lastT1TripDate) return "t1";
  if (date >= secondTicket.activationDate && date <= secondTicket.expiryDate) return "t2";
  if (date > lastT1TripDate && date < secondTicket.activationDate) return "gap";
  return "none";
}

type CalendarViewProps = {
  plan: TicketPlan;
  result: OptimizationResult;
  selectedDate: string;
  onSelectDate: (date: string, ref: React.RefObject<HTMLButtonElement | null>) => void;
  /** Bumps when holiday data is refreshed, forcing re-render. */
  holidayRevision?: number;
};

const SUNDAY_INDEX = 0;
const WEEKDAY_KEYS = [
  "cal.sun", "cal.mon", "cal.tue", "cal.wed", "cal.thu", "cal.fri", "cal.sat",
] as const;

function getDayLabel(
  date: string,
  day: OptimizedDay | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
  isBuyByDate = false,
): string {
  const buyByParts = isBuyByDate ? [t("cal.buyByDay")] : [];
  if (!day) return [date, ...buyByParts].join(", ");
  if (day.unavailable) return [date, ...buyByParts, t("cal.unavailable")].join(", ");

  const citySaverCount = day.trips.filter((tr) => tr.useCitySaver).length;
  const normalCount = day.trips.filter((tr) => !tr.useCitySaver).length;
  const statusParts = [
    citySaverCount > 0 ? `${t("useCitySaver")} ${citySaverCount}` : "",
    normalCount > 0 ? `${t("payNormally")} ${normalCount}` : "",
  ].filter(Boolean);
  const tripParts = day.trips.flatMap((tr) => [
    translateTripName(tr.id, t),
    t(`priority.${tr.priority === "not_preferred" ? "notPreferred" : tr.priority}`),
    tr.useCitySaver ? t("useCitySaver") : t("payNormally"),
  ]);

  return [date, ...buyByParts, ...statusParts, ...tripParts].join(", ");
}

function DayCell({
  date,
  day,
  selected,
  inWindow,
  onSelectDate,
  region,
  isBuyByDate,
  forceGridColumn,
}: {
  date: string;
  day: OptimizedDay | undefined;
  selected: boolean;
  inWindow: boolean;
  onSelectDate: (date: string, ref: React.RefObject<HTMLButtonElement | null>) => void;
  region: TicketRegion;
  isBuyByDate?: boolean;
  forceGridColumn?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { locale } = useI18n();
  const t = useT();
  const citySaverCount = day?.trips.filter((tr) => tr.useCitySaver).length ?? 0;
  const normalCount = day?.trips.filter((tr) => !tr.useCitySaver).length ?? 0;
  const isFirstOfMonth = format(parseISO(date), "d") === "1";
  const needsGridColumn = isFirstOfMonth || forceGridColumn;
  const isSunday = parseISO(date).getDay() === 0;
  const holiday = isPublicHoliday(date);
  const holidayName = getHolidayName(date, locale);
  const isRedDay = isSunday || holiday;

  return (
    <button
      ref={ref}
      className={[
        "day-cell",
        selected ? "selected" : "",
        day?.unavailable ? "unavailable" : "",
        !inWindow ? "outside-window" : "",
        region !== "none" ? `day-cell--${region}` : "",
        isBuyByDate ? "day-cell--buy-by" : "",
      ]
        .join(" ")
        .trim()}
      type="button"
      disabled={!inWindow}
      aria-pressed={selected}
      aria-label={getDayLabel(date, day, t, isBuyByDate)}
      aria-haspopup="dialog"
      title={holidayName}
      style={needsGridColumn ? { gridColumnStart: parseISO(date).getDay() + 1 } : undefined}
      onClick={() => onSelectDate(date, ref)}
    >
      <span className={`day-number${isRedDay ? " holiday-or-sunday" : ""}`}>{format(parseISO(date), "d")}</span>

      {/* ── Desktop content ── */}
      <span className="day-cell-desktop">
        {isBuyByDate ? <span className="tag buy">{t("cal.buyByShort")}</span> : null}
        {holidayName ? <span className="holiday-label">{holidayName}</span> : null}
        {day?.unavailable ? <span className="tag muted">{t("cal.unavailable")}</span> : null}
        {citySaverCount > 0 ? <span className="tag use">{t("cal.use")} ×{citySaverCount}</span> : null}
        {normalCount > 0 ? <span className="tag pay">{t("cal.pay")} ×{normalCount}</span> : null}
        {day && day.trips.length > 0 ? (
          <span className="trip-list">
            {day.trips.map((trip) => (
              <span className={`trip-pill${trip.done ? " trip-pill--done" : ""}${trip.ticket === 2 ? " trip-pill--t2" : ""}`} key={`${trip.date}-${trip.tripIndex}-${trip.id}`}>
                {trip.done ? <span className="trip-done-indicator" aria-label={t("cal.done")}>✓</span> : null}
                <span className="trip-name">{translateTripName(trip.id, t)}</span>
                <span className="trip-meta">
                  <span className={trip.useCitySaver ? "assignment use-text" : "assignment pay-text"}>
                    {trip.useCitySaver ? t("cal.use") : t("cal.pay")}
                  </span>
                  <span className={`priority-label priority-label--${trip.priority}`}>
                    {t(`priority.${trip.priority === "not_preferred" ? "notPreferred" : trip.priority}`)}
                  </span>
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </span>

      {/* ── Mobile content ── */}
      <span className="day-cell-mobile">
        {isBuyByDate ? <span className="mobile-buy-by">{t("cal.buyByShort")}</span> : null}
        {holidayName ? <span className="mobile-holiday-label">{holidayName}</span> : null}
        {day?.unavailable ? (
          <span className="mobile-unavailable">—</span>
        ) : day && day.trips.length > 0 ? (
          <span className="mobile-trip-dots">
            {day.trips.map((trip, i) => (
              <span
                key={i}
                className={`mobile-dot mobile-dot--${trip.useCitySaver ? "use" : "pay"}${trip.done ? " mobile-dot--done" : ""}${trip.ticket === 2 ? " mobile-dot--t2" : ""}`}
                aria-hidden="true"
              />
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function CalendarView({ plan, result, selectedDate, onSelectDate, holidayRevision: _holidayRevision }: CalendarViewProps) {
  const t = useT();
  const dayMap = new Map(result.days.map((day) => [day.date, day]));
  const endDate = result.secondTicket?.expiryDate ?? plan.expiryDate;
  const monthKeys = getMonthKeysInRange(plan.planStartDate, endDate);

  const lastT1Date = result.lastT1TripDate;
  const gapStartDate = result.secondTicket && lastT1Date < result.secondTicket.activationDate
    ? getDatesForMonth(lastT1Date.substring(0, 7)).find((d) => d > lastT1Date)
      ?? result.secondTicket.activationDate
    : null;

  const t2StartDate = result.secondTicket?.activationDate ?? null;
  const buyByDate = result.secondTicket?.buyWindow?.endDate ?? null;

  return (
    <section className="calendar-region" aria-label={t("cal.label")}>
      {monthKeys.map((monthKey) => {
        const monthDate = parseISO(`${monthKey}-01`);
        const monthName = t(`month.${monthDate.getMonth()}`);
        const year = String(monthDate.getFullYear());
        const datesInMonth = getDatesForMonth(monthKey);

        // Split dates into segments at region boundaries so labels go between grids
        type Segment = { label?: { key: string; className: string; text: string }; dates: string[] };
        const segments: Segment[] = [];
        let currentDates: string[] = [];

        for (const date of datesInMonth) {
          if (buyByDate && date === buyByDate && datesInMonth.includes(buyByDate)) {
            if (currentDates.length > 0) segments.push({ dates: currentDates });
            currentDates = [];
            segments.push({
              label: { key: `label-buy-${date}`, className: "ticket-region-label ticket-region-label--buy", text: t("cal.buyByLabel", { date: buyByDate }) },
              dates: [],
            });
          }
          if (gapStartDate && date === gapStartDate && datesInMonth.includes(gapStartDate)) {
            if (currentDates.length > 0) segments.push({ dates: currentDates });
            currentDates = [];
            segments.push({
              label: { key: `label-gap-${date}`, className: "ticket-region-label ticket-region-label--gap", text: t("cal.gapLabel") },
              dates: [],
            });
          }
          if (t2StartDate && date === t2StartDate && datesInMonth.includes(t2StartDate)) {
            if (currentDates.length > 0) segments.push({ dates: currentDates });
            currentDates = [];
            segments.push({
              label: { key: `label-t2-${date}`, className: "ticket-region-label ticket-region-label--t2", text: t("cal.ticket2Label", { date: t2StartDate }) },
              dates: [],
            });
          }
          currentDates.push(date);
        }
        if (currentDates.length > 0) segments.push({ dates: currentDates });

        return (
          <article className="month" key={monthKey}>
            <div className="month-sticky-header">
              <h2>{t("cal.monthYear", { month: monthName, year })}</h2>
              <div className="weekday-grid">
                {WEEKDAY_KEYS.map((key, i) => (
                  <div className={`weekday${i === SUNDAY_INDEX ? " weekday-sunday" : ""}`} key={key}>
                    {t(key)}
                  </div>
                ))}
              </div>
            </div>
          {segments.map((segment, segIdx) => (
            <React.Fragment key={segment.label?.key ?? `seg-${segIdx}`}>
              {segment.label ? (
                <div className={segment.label.className}>{segment.label.text}</div>
              ) : null}
              {segment.dates.length > 0 ? (
                <div className="calendar-grid">
                  {segment.dates.map((date, dateIdx) => (
                    <DayCell
                      key={date}
                      date={date}
                      day={dayMap.get(date)}
                      selected={selectedDate === date}
                      inWindow={Boolean(dayMap.get(date))}
                      onSelectDate={onSelectDate}
                      region={getTicketRegion(date, result.lastT1TripDate, result.secondTicket)}
                      isBuyByDate={date === buyByDate}
                      forceGridColumn={dateIdx === 0 && segIdx > 0}
                    />
                  ))}
                </div>
              ) : null}
            </React.Fragment>
          ))}
        </article>
        );
      })}
    </section>
  );
}
