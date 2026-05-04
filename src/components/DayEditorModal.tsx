import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./CloseIcon";
import { DayEditor } from "./DayEditor";
import { useT } from "../domain/i18n";
import type { TicketPlan } from "../domain/types";

type DayEditorModalProps = {
  selectedDate: string;
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  ticketRegion?: "t1" | "gap" | "t2" | "shared" | "none";
};

export function DayEditorModal({
  selectedDate,
  plan,
  onPlanChange,
  onClose,
  triggerRef,
  ticketRegion,
}: DayEditorModalProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus the panel on open
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Return focus to the trigger on close
  useEffect(() => {
    return () => {
      triggerRef.current?.focus();
    };
  }, [triggerRef]);

  // Trap focus inside the panel
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = panel!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <div className="day-editor-overlay" aria-hidden="false" onClick={onClose}>
      <div
        ref={panelRef}
        className="day-editor-slideover"
        role="dialog"
        aria-modal="true"
        aria-label={t("editor.editDate", { date: selectedDate })}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="day-editor-slideover-header">
          <button
            type="button"
            className="day-editor-close"
            aria-label={t("editor.close")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="day-editor-slideover-body">
          <DayEditor
            selectedDate={selectedDate}
            plan={plan}
            onPlanChange={onPlanChange}
            ticketRegion={ticketRegion}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

