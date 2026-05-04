import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarView } from "./components/CalendarView";
import { DayEditorModal } from "./components/DayEditorModal";
import { SetupPanelModal } from "./components/SetupPanelModal";
import { Summary } from "./components/Summary";
import { ThemeToggle } from "./components/ThemeToggle";
import { useI18n } from "./domain/i18n";
import { optimizePlan } from "./domain/optimizer";
import { useHolidays } from "./domain/useHolidays";
import { validatePlan } from "./domain/validation";
import type { TicketPlan } from "./domain/types";
import { loadPlan, savePlan } from "./storage/plans";

function getInitialDark(): boolean {
  try {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
  } catch { /* unavailable */ }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function App() {
  const { locale, setLocale, t } = useI18n();
  const [plan, setPlan] = useState<TicketPlan>(() => loadPlan());
  const [selectedDate, setSelectedDate] = useState(plan.planStartDate);
  const [editorOpen, setEditorOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [isDark, setIsDark] = useState(getInitialDark);
  const maxYear = plan.planSecondTicket
    ? parseInt(plan.expiryDate.substring(0, 4), 10) + 1
    : parseInt(plan.expiryDate.substring(0, 4), 10);
  const holidayRevision = useHolidays(maxYear, locale);
  // holidayRevision is included to force re-computation when holiday data refreshes
  const result = useMemo(() => optimizePlan(plan), [plan, holidayRevision]);
  const validationErrors = useMemo(() => validatePlan(plan, t), [plan, t]);
  const activeDayRef = useRef<HTMLButtonElement | null>(null);
  const setupTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { savePlan(plan); }, [plan]);

  useEffect(() => {
    if (result.days.some((day) => day.date === selectedDate)) return;
    setSelectedDate(result.days[0]?.date ?? plan.planStartDate);
  }, [plan.planStartDate, result.days, selectedDate]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch { /* unavailable */ }
  }, [isDark]);

  const handleSelectDate = useCallback((date: string, ref: React.RefObject<HTMLButtonElement | null>) => {
    activeDayRef.current = ref.current;
    setSelectedDate(date);
    setEditorOpen(true);
  }, []);

  function getTicketRegion(date: string): "t1" | "gap" | "t2" | "shared" | "none" {
    if (!result.secondTicket) return "none";
    if (date === result.lastT1TripDate && date === result.secondTicket.activationDate) return "shared";
    if (date <= result.lastT1TripDate) return "t1";
    if (date >= result.secondTicket.activationDate && date <= result.secondTicket.expiryDate) return "t2";
    if (date > result.lastT1TripDate && date < result.secondTicket.activationDate) return "gap";
    return "none";
  }

  return (
    <main className="app-shell" id="main-content">
      <header className="app-header">
        <div className="header-brand">
          <p className="eyebrow">{t("header.eyebrow")}</p>
          <span className="header-sep" aria-hidden="true" />
          <h1>{t("header.title")}</h1>
        </div>
        <div className="header-actions">
          <a
            href="https://link.mtrmb.mtr.com.hk/mtrmobileapp/pwa/ticketing/index.html?lang=zh"
            target="_blank"
            rel="noopener noreferrer"
            className="eticket-link"
          >
            <TicketIcon />
            <span>Open eTicket</span>
          </a>
          <button
            ref={setupTriggerRef}
            type="button"
            className={`setup-toggle ${setupOpen ? "setup-toggle--active" : ""}`}
            aria-label={setupOpen ? t("header.closeSetup") : t("header.openSetup")}
            aria-expanded={setupOpen}
            aria-haspopup="dialog"
            onClick={() => setSetupOpen((o) => !o)}
          >
            <SlidersIcon />
            <span>{t("header.setup")}</span>
          </button>
          <button
            type="button"
            className="lang-toggle"
            aria-label={t("lang.label")}
            onClick={() => setLocale(locale === "en" ? "zh-HK" : "en")}
          >
            {t("lang.toggle")}
          </button>
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark((d) => !d)} />
        </div>
      </header>

      <div className="summary-strip-wrapper">
        <Summary result={result} validationErrors={validationErrors} />
      </div>

      <div className="planner-grid-wrapper">
        <section className="planner-grid planner-grid--single">
          <div className="calendar-scroll">
            <CalendarView
              plan={plan}
              result={result}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              holidayRevision={holidayRevision}
            />
          </div>
        </section>
      </div>

      {setupOpen && (
        <SetupPanelModal
          plan={plan}
          onPlanChange={setPlan}
          onClose={() => setSetupOpen(false)}
          triggerRef={setupTriggerRef}
          secondTicketInfo={result.secondTicket ? {
            activationDate: result.secondTicket.activationDate,
            expiryDate: result.secondTicket.expiryDate,
            buyWindow: result.secondTicket.buyWindow,
          } : undefined}
        />
      )}

      {editorOpen && (
        <DayEditorModal
          selectedDate={selectedDate}
          plan={plan}
          onPlanChange={setPlan}
          onClose={() => setEditorOpen(false)}
          triggerRef={activeDayRef}
          ticketRegion={getTicketRegion(selectedDate)}
        />
      )}
    </main>
  );
}

function TicketIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}
