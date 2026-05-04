import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "../test-utils";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("renders with 'Switch to dark mode' label when light", () => {
    renderWithI18n(<ThemeToggle isDark={false} onToggle={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("renders with 'Switch to light mode' label when dark", () => {
    renderWithI18n(<ThemeToggle isDark={true} onToggle={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Switch to light mode" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderWithI18n(<ThemeToggle isDark={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the moon icon when light mode", () => {
    renderWithI18n(<ThemeToggle isDark={false} onToggle={vi.fn()} />);

    // Moon icon has a <path> element, sun icon has a <circle>
    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(button.querySelector("path")).toBeInTheDocument();
    expect(button.querySelector("circle")).not.toBeInTheDocument();
  });

  it("renders the sun icon when dark mode", () => {
    renderWithI18n(<ThemeToggle isDark={true} onToggle={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Switch to light mode" });
    expect(button.querySelector("circle")).toBeInTheDocument();
  });
});
