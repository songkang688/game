/**
 * 红蓝赛跑 · 触屏热区巡检（窗口5 第1轮学习优化员补）。
 *
 * 测试员在 360px 真机上量到两处够不到 44×44 的热区：
 *  · W5-A-03 「🤝 让分」开关 158×**30**——攻略点名推荐、大人最常点的那一颗；
 *  · W5-A-04 「🤝 对战场」「♾️ 跑不完的跑道」两个模式入口 210×**40** / 229×**40**。
 * 同窗另三款在 360px 下一个小于 44px 的热区都没有，说明 44px 是本库做得到的口径。
 * 这一份把口径钉住，免得以后调样式又掉回去。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");

/** 取某条 CSS 规则的规则体 */
function ruleBody(selector: string): string {
  const at = shell.indexOf(`${selector} {`);
  expect(at, `找不到样式规则 ${selector}`).toBeGreaterThan(-1);
  return shell.slice(at, shell.indexOf("}", at));
}

/** 规则体里声明的 min-height（没写就算 0） */
function minHeight(selector: string): number {
  return Number(ruleBody(selector).match(/min-height:\s*(\d+)px/)?.[1] ?? 0);
}

describe("红蓝赛跑 · 360px 上点得着", () => {
  it("「让分」开关不小于 44px", () => {
    expect(minHeight(".rbr-chip-btn")).toBeGreaterThanOrEqual(44);
  });

  it("对战场 / 无尽两个模式入口不小于 44px，并且文字上下居中", () => {
    expect(minHeight(".rbe-open")).toBeGreaterThanOrEqual(44);
    expect(ruleBody(".rbe-open")).toContain("align-items: center");
  });

  it("关内那几颗常按的按钮本来就够大，这一轮没有被改小", () => {
    expect(minHeight(".rbe-back")).toBeGreaterThanOrEqual(44);
    expect(minHeight(".rbv-over-btn")).toBeGreaterThanOrEqual(44);
  });
});
