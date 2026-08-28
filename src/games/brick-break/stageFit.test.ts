/**
 * 碰碰砖块 · 横屏矮屏钳高与滚动兜底(三人组 r4 playbook C-2)。
 *
 * 实测:915×412 裁 739 / canvas 出屏 615 / ⬅️➡️ 折叠线下;`.brk-wrap` 的
 * touch-action:none 还把舞台的滚动兜底也废了——看不见且滚不到。
 * 修法:① 画布显示高走共享件 attachCanvasFit 按可视余量钳 max-height
 * (物理分辨率 W×H 与反弹判定坐标不动);② wrap 层改 pan-y 只禁横划,
 * 画布与按钮各自的 touch-action:none 保持,拖板不触发页面滚动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("const CSS = `"), SRC.indexOf("function reducedMotion"));

function rule(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  expect(at, `CSS 里没有 ${selector} 规则`).toBeGreaterThanOrEqual(0);
  const from = CSS.indexOf("{", at) + 1;
  return CSS.slice(from, CSS.indexOf("}", from)).replace(/\s+/g, "");
}

describe("碰碰砖块 · 横屏钳高与触摸分层(C-2)", () => {
  it("wrap 层只禁横划(pan-y),舞台滚动兜底留着", () => {
    expect(rule(".brk-wrap")).toContain("touch-action:pan-y");
    expect(rule(".brk-wrap")).not.toContain("touch-action:none");
  });

  it("画布与方向按钮自己仍是 touch-action:none,拖板不惊动页面", () => {
    expect(rule(".brk-canvas")).toContain("touch-action:none");
    expect(rule(".brk-btn")).toContain("touch-action:none");
  });

  it("画布显示层保持 width:100%(等比收窄靠 max-height 触发替换元素约束)", () => {
    expect(rule(".brk-canvas")).toContain("width:100%");
  });

  it("闯关与无尽砖塔都接了共享钳高件,destroy 摘监听", () => {
    expect(SRC).toContain('import { attachCanvasFit } from "../stageFit";');
    const spots = SRC.split("attachCanvasFit(canvas, wrap)").length - 1;
    expect(spots, "playLevel 与 mountTower 各接一次").toBe(2);
    expect(SRC.split("fit.detach()").length - 1).toBe(2);
  });

  it("物理分辨率没被顺手动过:画布仍按 W×H 建", () => {
    expect(SRC).toContain('width="${W}" height="${H}"');
  });
});
