import "@testing-library/jest-dom/vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TicketPlan } from "../domain/types";
import { renderWithI18n } from "../test-utils";
import { DayEditorModal } from "./DayEditorModal";
import { createRef } from "react";

const plan: TicketPlan = {
  remainingUses: 40,
  planStartDate: "2026-05-01",
  expiryDate: "2026-05-31",
  defaultPattern: {
    tripsByWeekday: {
      1: [
        { id: "Morning commute", priority: "definitely" },
        { id: "Evening commute", priority: "definitely" },
      ],
    },
  },
  unavailableRanges: [],
  dayOverrides: {},
  planSecondTicket: false,
};

function renderModal(overrides: { onClose?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();

  const result = renderWithI18n(
    <>
      <button ref={triggerRef}>trigger</button>
      <DayEditorModal
        selectedDate="2026-05-11"
        plan={plan}
        onPlanChange={vi.fn()}
        onClose={onClose}
        triggerRef={triggerRef}
      />
    </>,
  );

  return { ...result, onClose, triggerRef };
}

describe("DayEditorModal", () => {
  it("renders a dialog with the correct aria-label", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Edit 2026-05-11");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking the overlay backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    // The overlay is the parent div with class "day-editor-overlay"
    const overlay = document.querySelector(".day-editor-overlay")!;
    await user.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    // Click the date heading inside the panel
    await user.click(screen.getByText("2026-05-11"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when clicking the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByRole("button", { name: "Close day editor" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the dialog panel on open", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });

  it("traps focus — Tab from last element wraps to first", async () => {
    const user = userEvent.setup();
    renderModal();

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus the last element
    last.focus();
    expect(document.activeElement).toBe(last);

    // Tab should wrap to first
    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it("traps focus — Shift+Tab from first element wraps to last", async () => {
    const user = userEvent.setup();
    renderModal();

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus the first element
    first.focus();
    expect(document.activeElement).toBe(first);

    // Shift+Tab should wrap to last
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it("renders the DayEditor content inside the modal", () => {
    renderModal();

    // Should show the date heading and trip inputs from DayEditor
    expect(screen.getByText("2026-05-11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add trip" })).toBeInTheDocument();
  });
});
