import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { App } from "./App";
import { renderWithI18n } from "./test-utils";

beforeEach(() => {
  window.localStorage.clear();
});

test("renders the planner shell", async () => {
  const user = userEvent.setup();
  renderWithI18n(<App />);

  expect(screen.getByRole("heading", { name: "Ticket usage planner" })).toBeInTheDocument();
  expect(screen.getByText("planned uses")).toBeInTheDocument();

  // Setup panel is behind a modal — open it first
  await user.click(screen.getByRole("button", { name: "Open setup" }));
  expect(screen.getByLabelText("Remaining uses")).toBeInTheDocument();
});

test("updates remaining uses from setup and persists the plan", async () => {
  const user = userEvent.setup();
  renderWithI18n(<App />);

  // Open the setup panel modal
  await user.click(screen.getByRole("button", { name: "Open setup" }));

  const remainingUsesInput = screen.getByLabelText("Remaining uses");

  await user.clear(remainingUsesInput);
  await user.type(remainingUsesInput, "12");

  expect(remainingUsesInput).toHaveValue(12);
  expect(window.localStorage.getItem("mtr-city-saver-plan:v1")).toContain('"remainingUses":12');
});
