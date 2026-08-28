import { describe, expect, it } from "vitest";
import { CSS } from "./view";

describe("N-83 gomoku 闯关工具行 · 915×412", () => {
  it("对局态改「盘左、座位+工具右」,盘宽按剩余高度钳(实测盘 175..389、工具 259..363)", () => {
    expect(CSS).toContain(".gmk-wrap:not(:has(.gmk-start)){max-width:none;display:grid;grid-template-columns:auto 168px;");
    expect(CSS).toContain(".gmk-wrap:not(:has(.gmk-start)) .gmk-boardbox{grid-column:1;grid-row:2 / span 3;width:min(240px,52dvh);}");
  });

  it("N-10/N-67 既有守门字符串不动:248 钳盘、工具 sticky、设置页 :has 放宽", () => {
    expect(CSS).toContain(".gmk-wrap{max-width:248px;}");
    expect(CSS).toContain(".gmk-btns{position:sticky;bottom:0");
    expect(CSS).toContain(".gmk-wrap:has(.gmk-start){max-width:420px;}");
    expect(CSS).toContain(".gmk-panel .gmk-start{position:sticky;bottom:0");
  });
});
