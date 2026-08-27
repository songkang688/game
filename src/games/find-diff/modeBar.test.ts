/**
 * 找不同 · 模式条只在选关地图上露面（窗口5 第2轮 档C · W5R2-C-06 严重 / C-04 本档侧）。
 *
 * 两件事同一个根：
 *
 * ① 测试员播种解锁后进第 90 关，**关卡进行中**顶上那颗 `♾️ 找不同马拉松` 仍然
 *    `elementFromPoint` 点得着。点下去关卡层只被 `levelHost.hidden = true` 藏起来、
 *    没有被销毁：`interval 1 → 2`，被藏起来的第 90 关秒表一路走到 0，
 *    52 秒后关卡的「就差一点点！时间到～」结算屏**盖在正在进行的马拉松上**，
 *    同屏两个 `.fdf-hud` 各走各的。
 * ② 这一条 44px 的模式条连外边距占掉 52px。360×640 上舞台一共才看得见 530px，
 *    提示键与放大滑杆就差这一截掉到裁切线以下（W5R2-C-04）。
 *
 * 改法照搬档A 的 `97ebf62`（`landlord-cards` / `red-blue-race` 同族），两处缺一不可：
 *   ① `.fdf-tools[hidden]{display:none}` —— `display:flex` 是作者样式，
 *      压过浏览器自带的 `[hidden]{display:none}`，所以「开马拉松时收起模式条」
 *      这件本来就该成立的事，一直是空转；
 *   ② 进关收起来、离关放回去，侧模式开着时不替它放回来。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("const CSS = `"), SRC.indexOf("\n`;", SRC.indexOf("const CSS = `")));

function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = CSS.indexOf("{", at) + 1;
  return CSS.slice(from, CSS.indexOf("}", from)).replace(/\s+/g, "");
}

/** `mount()` 里接进 `mountLevelGame` 的那一段 */
const WIRED = SRC.slice(SRC.indexOf("      mapHint: \"一行一行按路线扫"), SRC.indexOf("  function open(level1: number)"));

describe("找不同 · 模式条只在选关地图上露面（W5R2-C-06）", () => {
  it("[hidden] 得压得住 display:flex，不然「收起模式条」全是空转", () => {
    expect(rule(".fdf-tools")).toContain("display:flex");
    expect(CSS, "少了这一条,bar.hidden 写了也白写").toContain(".fdf-tools[hidden]");
    expect(rule(".fdf-tools[hidden]")).toContain("display:none");
  });

  it("进关收起来、离关放回去", () => {
    expect(WIRED, "playLevel 没接成收模式条的那一版").toContain("bar.hidden = true");
    expect(WIRED, "离关得把模式条放回去，不然回地图就没入口了").toContain("bar.hidden = false");
    // 关卡框架允许 playLevel 什么都不返回，包一层的时候别把这种情况漏了
    expect(WIRED).toContain("handle?.destroy?.()");
    // 马拉松开着时这一条本来就该收着，离关时别替它放回来
    expect(WIRED).toContain("if (!mode) bar.hidden = false;");
  });

  it("得先收再摆：格子是在 playLevel 里按可视高摊的，量早了这 52px 白让", () => {
    expect(WIRED.indexOf("bar.hidden = true")).toBeLessThan(WIRED.indexOf("playLevel(stage, ctx)"));
  });

  it("热区没动：入口键回到地图上仍是 44px", () => {
    expect(rule(".fdf-btn")).toContain("min-height:44px");
    expect(rule(".fdf-tools[hidden]"), "收起来那条不许顺手改尺寸").not.toContain("min-height");
  });

  it("关卡秒表这条老路一个字没动：换轮仍旧先 stopTimer 再交卷", () => {
    // W5-L-33 的守门，本轮改模式条不许把它带歪
    expect(SRC).toContain("stopTimer()");
  });
});
