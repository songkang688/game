import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLICK_GUARD_MS, isGuardedClick } from "./dialogs";

const CSS = readFileSync(fileURLToPath(new URL("../styles.css", import.meta.url)), "utf8");
const DIALOGS = readFileSync(fileURLToPath(new URL("./dialogs.ts", import.meta.url)), "utf8");

function firstRule(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(^|[},])\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(CSS);
  expect(m, `找不到 ${selector}`).not.toBeNull();
  return m![2];
}

describe("N-33 结算按钮列 sticky（配方 I）", () => {
  it(".dialog-buttons 粘在弹窗可视底且底不透明", () => {
    const body = firstRule(".dialog-buttons");
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/bottom:\s*0/);
    expect(body).toMatch(/background:\s*#ffffff/);
    expect(body).toMatch(/box-shadow:/);
    expect(body).toMatch(/z-index:\s*3/);
  });

  it("dialogs.ts 按钮语义与冷静期零触碰", () => {
    expect(DIALOGS).toContain('row.className = "dialog-buttons"');
    expect(DIALOGS).toContain("isGuardedClick");
    expect(isGuardedClick(1000, 1000)).toBe(true);
    expect(isGuardedClick(1000, 1000 + CLICK_GUARD_MS)).toBe(false);
  });
});
