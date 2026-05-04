import "@testing-library/jest-dom/vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TicketPlan } from "../domain/types";
import { renderWithI18n } from "../test-utils";
import { SetupPanelModal } from "./SetupPanelModal";
import { createRef } from "react";

const plan: TicketPlan = {
  remainingUses: 10,
  planStartDate: "2026-05-01",
  expiryDate: "2026-05-30",
  defaultPattern: {
    tripsByWeekday: {
      1: [{ id: "Morning commute", priority: "definitely" }],
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
      <SetupPanelModal
        plan={plan}
        onPlanChange={vi.fn()}
        onClose={onClose}
        triggerRef={triggerRef}
      />
    </>,
  );

  return { ...result, onClose, triggerRef };
}

describe("SetupPanelModal", () => {
  it("renders a dialog with the correct aria-label", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Trip setup");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape key", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByRole("button", { name: "Close setup panel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking the overlay backdrop", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    const overlay = document.querySelector(".setup-overlay")!;
    await user.click(overlay);

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

    last.focus();
    expect(document.activeElement).toBe(last);

    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it("renders the SetupPanel content inside the modal", () => {
    renderModal();

    expect(screen.getByLabelText("Remaining uses")).toBeInTheDocument();
    expect(screen.getByLabelText("Plan start")).toBeInTheDocument();
    expect(screen.getByLabelText("Ticket expiry")).toBeInTheDocument();
  });

  it("shows the title in the header", () => {
    renderModal();

    const header = document.querySelector(".setup-slideover-title")!;
    expect(header).toHaveTextContent("Setup");
  });
});
