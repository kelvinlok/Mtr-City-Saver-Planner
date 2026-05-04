import React from "react";
import { getWeekdayIndex, isDateInRanges } from "../domain/dateUtils";
import { useT } from "../domain/i18n";
import type { DayOverride, TicketPlan, TripTemplate } from "../domain/types";
import { BinIcon } from "./BinIcon";
import { PlusIcon } from "./PlusIcon";
import { PriorityToggle } from "./PriorityToggle";

type DayEditorProps = {
  selectedDate: string;
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
  ticketRegion?: "t1" | "gap" | "t2" | "shared" | "none";
};

const priorityAccent: Record<string, string> = {
  definitely:    "var(--priority-definitely)",
  maybe:         "var(--priority-maybe)",
  not_preferred: "var(--priority-not_preferred)",
};

function getOverride(plan: TicketPlan, selectedDate: string): DayOverride {
  return (
    plan.dayOverrides[selectedDate] ?? {
      trips: plan.defaultPattern.tripsByWeekday[getWeekdayIndex(selectedDate)] ?? []
    }
  );
}

export function DayEditor({ selectedDate, plan, onPlanChange, ticketRegion }: DayEditorProps) {
  const t = useT();
  const override = getOverride(plan, selectedDate);
  const trips = override.trips ?? [];
  const isGloballyUnavailable = isDateInRanges(selectedDate, plan.unavailableRanges);

  function saveOverride(nextOverride: DayOverride) {
    onPlanChange({
      ...plan,
      dayOverrides: {
        ...plan.dayOverrides,
        [selectedDate]: nextOverride
      }
    });
  }

  function updateTrip(index: number, patch: Partial<TripTemplate>) {
    saveOverride({
      ...override,
      unavailable: false,
      trips: trips.map((trip, tripIndex) => (tripIndex === index ? { ...trip, ...patch } : trip))
    });
  }

  return (
    <div className={`day-editor-content${ticketRegion === "t2" || ticketRegion === "shared" ? " day-editor--t2" : ""}`}>
      <h2 className="day-editor-date">{selectedDate}</h2>
      <div className="button-row">
        {!isGloballyUnavailable ? (
          <button type="button" onClick={() => saveOverride({ unavailable: true, trips: [] })}>
            {t("editor.markUnavailable")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const nextOverrides = { ...plan.dayOverrides };
            delete nextOverrides[selectedDate];
            onPlanChange({ ...plan, dayOverrides: nextOverrides });
          }}
        >
          {t("editor.clearOverride")}
        </button>
      </div>

      <section className="panel-section">
        {isGloballyUnavailable ? (
          <p className="notice">
            {t("editor.unavailableNotice")}
          </p>
        ) : (
          <>
            <div className="section-heading">
              <h3>{t("editor.trips")}</h3>
              <button
                type="button"
                className="btn-plus"
                aria-label={t("editor.addTrip")}
                onClick={() =>
                  saveOverride({
                    ...override,
                    unavailable: false,
                    trips: [...trips, { id: t("trip.default", { n: trips.length + 1 }), priority: "maybe" }]
                  })
                }
              >
                <PlusIcon />
              </button>
            </div>

            {trips.map((trip, index) => (
              <div
                className={`trip-row${trip.done ? " trip-row--done" : ""}`}
                key={`${trip.id}-${index}`}
                style={{ "--trip-accent": priorityAccent[trip.priority] } as React.CSSProperties}
              >
                <div className="trip-row-main">
                  <label className="trip-done-toggle" aria-label={t("editor.markDone", { n: index + 1 })}>
                    <input
                      type="checkbox"
                      checked={!!trip.done}
                      onChange={(event) => updateTrip(index, { done: event.target.checked })}
                    />
                    <span className="trip-done-check" aria-hidden="true" />
                  </label>
                  <input
                    aria-label={t("editor.tripLabel", { n: index + 1 })}
                    className={trip.done ? "trip-input--done" : ""}
                    value={trip.id}
                    onChange={(event) => updateTrip(index, { id: event.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-bin"
                    aria-label={t("editor.removeTrip", { n: index + 1 })}
                    onClick={() =>
                      saveOverride({ ...override, trips: trips.filter((_, tripIndex) => tripIndex !== index) })
                    }
                  >
                    <BinIcon />
                  </button>
                </div>
                <PriorityToggle
                  value={trip.priority}
                  ariaLabel={t("editor.tripLabel", { n: index + 1 })}
                  onChange={(priority) => updateTrip(index, { priority })}
                />
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
