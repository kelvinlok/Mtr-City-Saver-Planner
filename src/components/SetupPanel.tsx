import React, { useState } from "react";
import { useT } from "../domain/i18n";
import type { DateRange, SecondTicketMode, TicketBuyWindow, TicketPlan, TripTemplate } from "../domain/types";
import { groupWeekdays, formatGroupLabel } from "../domain/weekdayGroups";
import { BinIcon } from "./BinIcon";
import { ConfirmModal } from "./ConfirmModal";
import { PlusIcon } from "./PlusIcon";
import { PriorityToggle } from "./PriorityToggle";
import { createDefaultPlan } from "../storage/plans";

type SetupPanelProps = {
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
  secondTicketInfo?: { activationDate: string; expiryDate: string; buyWindow?: TicketBuyWindow };
};

function createRangeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `range-${Date.now()}`;
}

function updateRange(ranges: DateRange[], id: string, patch: Partial<DateRange>): DateRange[] {
  return ranges.map((range) => (range.id === id ? { ...range, ...patch } : range));
}

const priorityAccent: Record<string, string> = {
  definitely:    "var(--priority-definitely)",
  maybe:         "var(--priority-maybe)",
  not_preferred: "var(--priority-not_preferred)",
};

const WEEKDAY_KEYS = [
  "setup.sunday", "setup.monday", "setup.tuesday", "setup.wednesday",
  "setup.thursday", "setup.friday", "setup.saturday",
] as const;

const CHIP_KEYS = [
  "setup.chipSun", "setup.chipMon", "setup.chipTue", "setup.chipWed",
  "setup.chipThu", "setup.chipFri", "setup.chipSat",
] as const;

export function SetupPanel({ plan, onPlanChange, secondTicketInfo }: SetupPanelProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<"ticket" | "trips">("ticket");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [unavailableExpanded, setUnavailableExpanded] = useState(
    plan.unavailableRanges.length > 0
  );

  function saveWeekdayTrips(weekday: number, trips: TripTemplate[]) {
    onPlanChange({
      ...plan,
      defaultPattern: {
        ...plan.defaultPattern,
        tripsByWeekday: {
          ...plan.defaultPattern.tripsByWeekday,
          [weekday]: trips
        }
      }
    });
  }

  function saveGroupTrips(weekdays: number[], trips: TripTemplate[]) {
    const patch: Record<number, TripTemplate[]> = {};
    for (const day of weekdays) {
      patch[day] = trips;
    }
    onPlanChange({
      ...plan,
      defaultPattern: {
        ...plan.defaultPattern,
        tripsByWeekday: {
          ...plan.defaultPattern.tripsByWeekday,
          ...patch,
        }
      }
    });
  }

  function updateGroupTrip(weekdays: number[], index: number, tripPatch: Partial<TripTemplate>) {
    const trips = plan.defaultPattern.tripsByWeekday[weekdays[0]] ?? [];
    const updated = trips.map((trip, i) => (i === index ? { ...trip, ...tripPatch } : trip));
    saveGroupTrips(weekdays, updated);
  }

  // Groups are purely derived from trip data — no forced-split state needed.
  // Auto-merging happens naturally: days with identical fingerprints cluster together.
  const tripsByWeekday = plan.defaultPattern.tripsByWeekday;
  const effectiveTripsByWeekday: Record<number, TripTemplate[]> = {};
  for (let day = 0; day < 7; day++) {
    effectiveTripsByWeekday[day] = tripsByWeekday[day] ?? [];
  }
  const allGroups = groupWeekdays(effectiveTripsByWeekday);

  // Stable key for a group: sorted weekday indices joined by comma
  function groupKey(weekdays: number[]): string {
    return [...weekdays].sort((a, b) => a - b).join(",");
  }

  const dayName = (weekday: number) => t(WEEKDAY_KEYS[weekday]);

  return (
    <div className="setup-panel-content">
      <h2>{t("setup.title")}</h2>

      {/* Tab bar */}
      <div role="tablist" className="setup-tabs">
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "ticket"}
          className={`setup-tab${activeTab === "ticket" ? " setup-tab--active" : ""}`}
          onClick={() => setActiveTab("ticket")}
        >
          {t("setup.tabTicket")}
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "trips"}
          className={`setup-tab${activeTab === "trips" ? " setup-tab--active" : ""}`}
          onClick={() => setActiveTab("trips")}
        >
          {t("setup.tabTrips")}
        </button>
      </div>
      <div className="setup-tab-divider" />

      {/* Ticket tab */}
      {activeTab === "ticket" && (
        <div role="tabpanel">
          <label className="field">
            {t("setup.remainingUses")}
            <input
              type="number"
              min={0}
              max={40}
              value={plan.remainingUses}
              onChange={(event) => onPlanChange({ ...plan, remainingUses: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            {t("setup.planStart")}
            <input
              type="date"
              value={plan.planStartDate}
              onChange={(event) =>
                event.target.value ? onPlanChange({ ...plan, planStartDate: event.target.value }) : undefined
              }
            />
          </label>
          <label className="field">
            {t("setup.ticketExpiry")}
            <input
              type="date"
              value={plan.expiryDate}
              onChange={(event) =>
                event.target.value ? onPlanChange({ ...plan, expiryDate: event.target.value }) : undefined
              }
            />
          </label>

          <section className="panel-section">
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={plan.planSecondTicket}
                onChange={(event) => onPlanChange({ ...plan, planSecondTicket: event.target.checked })}
              />
              {t("setup.planSecondTicket")}
            </label>
            {plan.planSecondTicket ? (
              <label className="field">
                {t("setup.secondTicketMode")}
                <select
                  value={plan.secondTicketMode ?? "normal"}
                  onChange={(event) =>
                    onPlanChange({ ...plan, secondTicketMode: event.target.value as SecondTicketMode })
                  }
                >
                  <option value="normal">{t("setup.secondTicketModeNormal")}</option>
                  <option value="rebate">{t("setup.secondTicketModeRebate")}</option>
                </select>
              </label>
            ) : null}
            {plan.planSecondTicket && secondTicketInfo ? (
              <p className="second-ticket-info">
                {secondTicketInfo.buyWindow
                  ? secondTicketInfo.buyWindow.startDate === secondTicketInfo.buyWindow.endDate
                    ? t("setup.secondTicketInfoWithBuyDate", {
                      buyDate: secondTicketInfo.buyWindow.endDate,
                      date: secondTicketInfo.activationDate,
                      expiry: secondTicketInfo.expiryDate,
                    })
                    : t("setup.secondTicketInfoWithBuyWindow", {
                      start: secondTicketInfo.buyWindow.startDate,
                      end: secondTicketInfo.buyWindow.endDate,
                      date: secondTicketInfo.activationDate,
                      expiry: secondTicketInfo.expiryDate,
                    })
                  : t("setup.secondTicketInfo", {
                    date: secondTicketInfo.activationDate,
                    expiry: secondTicketInfo.expiryDate,
                  })}
              </p>
            ) : null}
          </section>

          {/* Unavailable ranges — collapsible */}
          <section className="panel-section">
            <div className="collapsible-header-row">
              <button
                type="button"
                className="collapsible-header"
                aria-expanded={unavailableExpanded}
                onClick={() => setUnavailableExpanded((v) => !v)}
              >
                <span>{t("setup.unavailableRanges")}</span>
                <span className="collapsible-right">
                  {plan.unavailableRanges.length > 0 && (
                    <span className="collapsible-count">{plan.unavailableRanges.length}</span>
                  )}
                  <span className={`collapsible-chevron${unavailableExpanded ? " collapsible-chevron--open" : ""}`}>▶</span>
                </span>
              </button>
              <button
                type="button"
                className="btn-plus"
                aria-label={t("setup.addRange")}
                onClick={() => {
                  setUnavailableExpanded(true);
                  onPlanChange({
                    ...plan,
                    unavailableRanges: [
                      ...plan.unavailableRanges,
                      { id: createRangeId(), startDate: plan.planStartDate, endDate: plan.planStartDate }
                    ]
                  });
                }}
              >
                <PlusIcon />
              </button>
            </div>
            <div className={`collapsible-body${unavailableExpanded ? " collapsible-body--open" : ""}`}>
              <div>
                {plan.unavailableRanges.map((range, index) => (
                  <div className="range-row" key={range.id}>
                    <span>{t("setup.range", { n: index + 1 })}</span>
                    <input
                      aria-label={t("setup.rangeStart", { n: index + 1 })}
                      type="date"
                      value={range.startDate}
                      onChange={(event) =>
                        event.target.value
                          ? onPlanChange({
                              ...plan,
                              unavailableRanges: updateRange(plan.unavailableRanges, range.id, {
                                startDate: event.target.value
                              })
                            })
                          : undefined
                      }
                    />
                    <input
                      aria-label={t("setup.rangeEnd", { n: index + 1 })}
                      type="date"
                      value={range.endDate}
                      onChange={(event) =>
                        event.target.value
                          ? onPlanChange({
                              ...plan,
                              unavailableRanges: updateRange(plan.unavailableRanges, range.id, {
                                endDate: event.target.value
                              })
                            })
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      aria-label={t("setup.removeRange", { n: index + 1 })}
                      onClick={() =>
                        onPlanChange({
                          ...plan,
                          unavailableRanges: plan.unavailableRanges.filter((item) => item.id !== range.id)
                        })
                      }
                    >
                      <BinIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h3>{t("setup.dataTransfer")}</h3>
            </div>
            <DataTransfer plan={plan} onPlanChange={onPlanChange} />
          </section>
        </div>
      )}

      {/* Trips tab */}
      {activeTab === "trips" && (
        <div role="tabpanel">
          <section className="panel-section">
            <div className="section-heading">
              <h3>{t("setup.defaultPattern")}</h3>
            </div>
            <div className="weekday-patterns">
              {allGroups.map((group) => {
                const label = formatGroupLabel(group.weekdays, dayName);
                const key = groupKey(group.weekdays);
                const isExpanded = expandedGroups.has(key);
                const tripCount = group.trips.length;
                const meta = tripCount === 0
                  ? t("setup.nTrips", { n: 0 })
                  : t("setup.nTripsEach", { n: tripCount });

                return (
                  <div key={group.fingerprint}>
                    <button
                      type="button"
                      className={`weekday-group-row${isExpanded ? " weekday-group-row--expanded" : ""}`}
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        next.has(key) ? next.delete(key) : next.add(key);
                        return next;
                      })}
                    >
                      <span>{label}</span>
                      <span className="weekday-group-meta">
                        {meta}
                        <span className="weekday-group-chevron"> ▶</span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="weekday-group-expanded">
                        {/* Day chips */}
                        <div className="day-chips" role="group" aria-label={label}>
                          {group.weekdays.map((day) => (
                            <button
                              key={day}
                              type="button"
                              role="checkbox"
                              aria-checked={true}
                              aria-label={dayName(day)}
                              className="day-chip day-chip--active"
                              onClick={() => {
                                // Only split if group has more than 1 day.
                                // Give the deselected day a blank extra trip so its
                                // fingerprint differs from the group — it will render
                                // as its own row. The user can then edit it freely.
                                if (group.weekdays.length > 1) {
                                  const newTrips = [
                                    ...group.trips,
                                    { id: "", priority: "definitely" as const },
                                  ];
                                  saveWeekdayTrips(day, newTrips);
                                  // Expand the new solo group (key = just that day)
                                  setExpandedGroups((prev) => new Set([...prev, String(day)]));
                                }
                              }}
                            >
                              {t(CHIP_KEYS[day])}
                            </button>
                          ))}
                        </div>

                        {/* Trip editor */}
                        {group.trips.map((trip, index) => (
                          <div
                            className="default-trip-row"
                            key={`${group.fingerprint}-${index}`}
                            style={{ "--trip-accent": priorityAccent[trip.priority] } as React.CSSProperties}
                          >
                            <div className="trip-row-main">
                              <input
                                aria-label={t("setup.weekdayTripLabel", { day: label, n: index + 1 })}
                                value={trip.id}
                                onChange={(event) => updateGroupTrip(group.weekdays, index, { id: event.target.value })}
                              />
                              <button
                                type="button"
                                className="btn-bin"
                                aria-label={t("setup.removeWeekdayTrip", { day: label, n: index + 1 })}
                                onClick={() => saveGroupTrips(group.weekdays, group.trips.filter((_, i) => i !== index))}
                              >
                                <BinIcon />
                              </button>
                            </div>
                            <PriorityToggle
                              value={trip.priority}
                              ariaLabel={t("setup.weekdayTripPriority", { day: label, n: index + 1 })}
                              onChange={(priority) => updateGroupTrip(group.weekdays, index, { priority })}
                            />
                          </div>
                        ))}

                        <button
                          type="button"
                          className="btn-plus"
                          aria-label={t("setup.addWeekdayTrip", { day: label })}
                          onClick={() =>
                            saveGroupTrips(group.weekdays, [
                              ...group.trips,
                              { id: t("trip.default", { n: group.trips.length + 1 }), priority: "definitely" }
                            ])
                          }
                        >
                          <PlusIcon />
                        </button>

                        {/* Merge buttons — only shown for solo days */}
                        {group.weekdays.length === 1 && allGroups.filter(g => g.fingerprint !== group.fingerprint).map((target) => (
                          <button
                            key={target.fingerprint}
                            type="button"
                            className="btn-merge"
                            onClick={() => {
                              saveWeekdayTrips(group.weekdays[0], [...target.trips]);
                              setExpandedGroups((prev) => new Set([...prev, groupKey(target.weekdays)]));
                            }}
                          >
                            {t("setup.mergeWith", { label: formatGroupLabel(target.weekdays, dayName) })}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DataTransfer({ plan, onPlanChange }: { plan: TicketPlan; onPlanChange: (plan: TicketPlan) => void }) {
  const t = useT();
  const [textValue, setTextValue] = useState("");
  const [mode, setMode] = useState<"idle" | "export" | "import">("idle");
  const [confirmAction, setConfirmAction] = useState<"import" | "reset" | null>(null);
  const [pendingImport, setPendingImport] = useState<TicketPlan | null>(null);

  function handleExport() {
    setTextValue(JSON.stringify(plan, null, 2));
    setMode("export");
  }

  function handleImport() {
    setTextValue("");
    setMode("import");
  }

  function handleApply() {
    try {
      const imported = JSON.parse(textValue);
      if (
        imported &&
        typeof imported === "object" &&
        typeof imported.remainingUses === "number" &&
        typeof imported.planStartDate === "string" &&
        typeof imported.expiryDate === "string"
      ) {
        // Store the parsed plan and show confirmation
        setPendingImport({
          remainingUses: imported.remainingUses,
          planStartDate: imported.planStartDate,
          expiryDate: imported.expiryDate,
          defaultPattern: imported.defaultPattern ?? plan.defaultPattern,
          unavailableRanges: imported.unavailableRanges ?? [],
          dayOverrides: imported.dayOverrides ?? {},
          planSecondTicket: imported.planSecondTicket ?? false,
          secondTicketMode: imported.secondTicketMode === "rebate" ? "rebate" : "normal",
        });
        setConfirmAction("import");
      } else {
        alert(t("setup.importInvalid"));
      }
    } catch {
      alert(t("setup.importInvalid"));
    }
  }

  function confirmImport() {
    if (pendingImport) {
      onPlanChange(pendingImport);
      setPendingImport(null);
      setConfirmAction(null);
      setMode("idle");
      setTextValue("");
    }
  }

  function confirmReset() {
    onPlanChange(createDefaultPlan());
    setConfirmAction(null);
    setMode("idle");
    setTextValue("");
  }

  return (
    <>
      {mode === "idle" ? (
        <div className="button-row">
          <button type="button" onClick={handleExport}>{t("setup.export")}</button>
          <button type="button" onClick={handleImport}>{t("setup.import")}</button>
          <button
            type="button"
            className="btn-reset"
            onClick={() => setConfirmAction("reset")}
          >
            <ResetIcon />
            {t("setup.reset")}
          </button>
        </div>
      ) : (
        <div className="data-transfer-area">
          <textarea
            className="data-transfer-textarea"
            rows={6}
            value={textValue}
            readOnly={mode === "export"}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={mode === "import" ? t("setup.importPlaceholder") : undefined}
          />
          <div className="button-row">
            {mode === "export" ? (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(textValue).catch(() => {});
                  setMode("idle");
                  setTextValue("");
                }}
              >
                {t("setup.copyAndClose")}
              </button>
            ) : (
              <button type="button" onClick={handleApply}>{t("setup.applyImport")}</button>
            )}
            <button type="button" onClick={() => { setMode("idle"); setTextValue(""); }}>{t("setup.cancel")}</button>
          </div>
        </div>
      )}

      {confirmAction === "import" && (
        <ConfirmModal
          title={t("setup.importTitle")}
          body={t("setup.importBody")}
          confirmLabel={t("setup.importConfirm")}
          onConfirm={confirmImport}
          onCancel={() => { setConfirmAction(null); setPendingImport(null); }}
        />
      )}

      {confirmAction === "reset" && (
        <ConfirmModal
          title={t("setup.resetTitle")}
          body={t("setup.resetBody")}
          confirmLabel={t("setup.resetConfirm")}
          onConfirm={confirmReset}
          onCancel={() => setConfirmAction(null)}
          destructive
        />
      )}
    </>
  );
}

function ResetIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
