/**
 * 红蓝拔河 · 模式条只在选关地图上露面（窗口5 第2轮 档C · W5R2-C-05 阻断 / C-06 严重）。
 *
 * 第 2 轮 CDP 复量：`.rbg-bar` 那两颗入口键在 360px 宽上排不下、折成两行占 96px，
 * 连同外边距 106px，而它从选关地图一路跟进关内常驻。
 * 舞台 360×640 上一共才看得见 530px，实测裁掉 169px ——
 * 两颗 132×76 的「🪢 用力拉」整排落在裁切线以下（y=683…713），
 * `elementFromPoint` 两颗都拿不回自己，**只剩键盘 F / 空格能玩，触屏一下都拉不动**。
 *
 * 另外测试员量到：关卡进行中这两颗仍然点得着，点下去关卡层只被 `hidden` 藏起来、
 * 不销毁，两条 `requestAnimationFrame` 会同时跑（W5R2-C-06）。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TOGGLE_MIN_H } from "./tuning";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("const SHELL_CSS = `"), SRC.indexOf("\n`;", SRC.indexOf("const SHELL_CSS = `")));

function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = CSS.indexOf("{", at) + 1;
  return CSS.slice(from, CSS.indexOf("}", from)).replace(/\s+/g, "");
}

const WIRED = SRC.slice(SRC.indexOf("      // 真下到某一关里"), SRC.indexOf("      guide,"));

describe("红蓝拔河 · 模式条只在选关地图上露面（W5R2-C-05 / C-06）", () => {
  it("[hidden] 得压得住 display:flex，不然「收起模式条」全是空转", () => {
    // 这一条同时钉住一个一直在的老毛病：开对战 / 开无尽时 bar.hidden 没起过作用
    expect(rule(".rbg-bar")).toContain("display:flex");
    expect(CSS).toContain(".rbg-bar[hidden]");
    expect(rule(".rbg-bar[hidden]")).toContain("display:none");
  });

  it("进关收起来、离关放回去", () => {
    expect(WIRED, "playLevel 没接成收模式条的那一版").toContain("bar.hidden = true");
    expect(WIRED, "离关得把模式条放回去，不然回地图就没入口了").toContain("bar.hidden = false");
    expect(WIRED).toContain("handle?.destroy?.()");
    expect(WIRED, "对战场 / 无尽开着时这一条本来就该收着").toContain("if (!side) bar.hidden = false;");
  });

  it("得先收再摆：拉绳钮是在 playLevel 里按视口量的，量早了这 106px 白让", () => {
    expect(WIRED.indexOf("bar.hidden = true")).toBeLessThan(WIRED.indexOf("playLevel(stage, ctx, settings)"));
  });

  it("热区没动：两颗入口键回到地图上仍是 44px", () => {
    // 读的是源码文本，模板串还没求值（rule() 会切在 ${} 的右花括号上），所以两头分开断言
    expect(rule(".rbg-open")).toContain("min-height:${TOGGLE_MIN_H");
    expect(TOGGLE_MIN_H).toBeGreaterThanOrEqual(44);
    expect(rule(".rbg-bar[hidden]")).not.toContain("min-height");
  });
});
