/**
 * N-33(trio-r9):915×412 结算弹窗「再玩一次/回首页」原先折在 .dialog 内滚线下。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const DIALOGS = readFileSync(new URL("./dialogs.ts", import.meta.url), "utf8");

function firstRule(selector: string): string {
  const m = new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(CSS);
  expect(m, `找不到 ${selector}`).not.toBeNull();
  return m![1];
}

describe("N-33 结算按钮列矮横屏可视", () => {
  it(".dialog-buttons 贴住弹窗底边且底不透明", () => {
    const body = firstRule(".dialog-buttons");
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/bottom:\s*0/);
    expect(body).toMatch(/background:\s*#ffffff/);
    expect(body).toMatch(/box-shadow:/);
    expect(body).not.toMatch(/background:\s*transparent/);
  });

  it("dialogs.ts 按钮语义与冷静期入口一字未动", () => {
    expect(DIALOGS).toContain('row.className = "dialog-buttons"');
    expect(DIALOGS).toContain("isGuardedClick");
    expect(DIALOGS).toMatch(/focus/);
  });
});
