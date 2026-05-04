import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./CloseIcon";
import { SetupPanel } from "./SetupPanel";
import { useT } from "../domain/i18n";
import type { TicketBuyWindow, TicketPlan } from "../domain/types";

type SetupPanelModalProps = {
  plan: TicketPlan;
  onPlanChange: (plan: TicketPlan) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  secondTicketInfo?: { activationDate: string; expiryDate: string; buyWindow?: TicketBuyWindow };
};

export function SetupPanelModal({ plan, onPlanChange, onClose, triggerRef, secondTicketInfo }: SetupPanelModalProps) {
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

  // Return focus to trigger on close
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
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    panel.addEventListener("keydown", onKeyDown);
    return () => panel.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <>
      {/* Non-modal backdrop — closes on click but doesn't block the calendar visually */}
      <div className="setup-overlay" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="setup-slideover"
        role="dialog"
        aria-modal="true"
        aria-label={t("setup.dialogLabel")}
        tabIndex={-1}
      >
        <div className="setup-slideover-header">
          <span className="setup-slideover-title">{t("setup.title")}</span>
          <button
            type="button"
            className="day-editor-close"
            aria-label={t("setup.close")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="setup-slideover-body">
          <SetupPanel plan={plan} onPlanChange={onPlanChange} secondTicketInfo={secondTicketInfo} />
        </div>
      </div>
    </>,
    document.body
  );
}

