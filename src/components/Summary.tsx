import { useT } from "../domain/i18n";
import type { OptimizationResult, TripPriority } from "../domain/types";

type SummaryProps = {
  result: OptimizationResult;
  validationErrors: string[];
};

function PriorityDots({ counts, label }: { counts: Record<TripPriority, number>; label: string }) {
  const t = useT();
  return (
    <div className="summary-priority" aria-label={label}>
      <span className="summary-priority-item">
        <span className="summary-priority-dot summary-priority-dot--definitely" aria-hidden="true" />
        <span className="summary-priority-count">{counts.definitely}</span>
        <span>{t("summary.definitely")}</span>
      </span>
      <span className="summary-priority-item">
        <span className="summary-priority-dot summary-priority-dot--maybe" aria-hidden="true" />
        <span className="summary-priority-count">{counts.maybe}</span>
        <span>{t("summary.maybe")}</span>
      </span>
      <span className="summary-priority-item">
        <span className="summary-priority-dot summary-priority-dot--not_preferred" aria-hidden="true" />
        <span className="summary-priority-count">{counts.not_preferred}</span>
        <span>{t("summary.notPreferred")}</span>
      </span>
    </div>
  );
}

function formatBuyWindowTitle(
  buyWindow: NonNullable<OptimizationResult["secondTicket"]>["buyWindow"],
  t: (key: string, params?: Record<string, string | number>) => string
): string | undefined {
  if (!buyWindow) return undefined;
  if (buyWindow.startDate === buyWindow.endDate) {
    return t("summary.buyWindowSingle", { date: buyWindow.endDate });
  }
  return t("summary.buyWindowRange", { start: buyWindow.startDate, end: buyWindow.endDate });
}

export function Summary({ result, validationErrors }: SummaryProps) {
  const t = useT();
  const hasSecondTicket = Boolean(result.secondTicket);

  if (!hasSecondTicket) {
    return (
      <>
        <section className="summary-strip" aria-label={t("summary.label")}>
          <div className="summary-stat">
            <span className="summary-metric">{result.assignedUses}</span>
            <span className="summary-label">{t("summary.plannedUses")}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-metric">{result.unusedUses}</span>
            <span className="summary-label">{t("summary.cannotUse")}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-metric">{result.normalPayTrips}</span>
            <span className="summary-label">{t("summary.normalPay")}</span>
          </div>
          <PriorityDots counts={result.priorityUseCounts} label={t("summary.byPriority")} />
        </section>
        {validationErrors.length > 0 ? (
          <ul className="error-list" role="alert" aria-label={t("summary.errors")}>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }

  return (
    <>
      <section className="summary-two-ticket" aria-label={t("summary.label")}>
        <div className="summary-row summary-row--t1">
          <h3 className="summary-ticket-label">{t("summary.ticket1")}</h3>
          <div className="summary-stat">
            <span className="summary-metric">{result.assignedUses}</span>
            <span className="summary-label">{t("summary.plannedUses")}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-metric">{result.unusedUses}</span>
            <span className="summary-label">{t("summary.cannotUse")}</span>
          </div>
          <PriorityDots counts={result.priorityUseCounts} label={t("summary.byPriority")} />
        </div>

        <div className="summary-row summary-row--gap">
          <h3 className="summary-ticket-label summary-ticket-label--gap">{t("summary.gap")}</h3>
          <div className="summary-stat">
            <span className="summary-metric">{result.gapNormalPayTrips}</span>
            <span className="summary-label">{t("summary.gapTrips")}</span>
          </div>
        </div>

        <div className="summary-row summary-row--t2">
          <h3 className="summary-ticket-label summary-ticket-label--t2">{t("summary.ticket2")}</h3>
          {result.secondTicket!.buyWindow ? (
            <div className="summary-stat summary-stat--buy-by" title={formatBuyWindowTitle(result.secondTicket!.buyWindow, t)}>
              <span className="summary-metric summary-metric--date">{result.secondTicket!.buyWindow.endDate}</span>
              <span className="summary-label">{t("summary.buyBy")}</span>
            </div>
          ) : null}
          <div className="summary-stat">
            <span className="summary-metric">{result.secondTicket!.assignedUses}</span>
            <span className="summary-label">{t("summary.plannedUses")}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-metric">{result.secondTicket!.unusedUses}</span>
            <span className="summary-label">{t("summary.cannotUse")}</span>
          </div>
          <PriorityDots counts={result.secondTicket!.priorityUseCounts} label={t("summary.byPriority")} />
        </div>
      </section>
      {validationErrors.length > 0 ? (
        <ul className="error-list" role="alert" aria-label={t("summary.errors")}>
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
