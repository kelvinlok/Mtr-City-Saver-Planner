import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

function cssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));

  return match?.[1] ?? "";
}

function expectDeclaration(block: string, declaration: string) {
  expect(block.replace(/\s+/g, " ")).toContain(declaration);
}

describe("calendar sticky header bleed mask", () => {
  it("keeps a non-scrolling mask above sticky month headers on desktop", () => {
    const wrapper = cssBlock(".planner-grid-wrapper");
    const mask = cssBlock(".planner-grid-wrapper::before");

    expectDeclaration(wrapper, "position: relative");
    expectDeclaration(mask, 'content: ""');
    expectDeclaration(mask, "position: absolute");
    expectDeclaration(mask, "top: 0");
    expectDeclaration(mask, "left: 24px");
    expectDeclaration(mask, "right: 24px");
    expectDeclaration(mask, "height: 18px");
    expectDeclaration(mask, "background: var(--bg)");
    expectDeclaration(mask, "z-index: 3");
    expectDeclaration(mask, "pointer-events: none");
  });
});
