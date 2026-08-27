/**
 * 萌猫小屋 · 模式条只在选关地图上露面（窗口5 第2轮 档C · W5R2-C-06 严重 / C-08 本档侧）。
 *
 * 测试员播种解锁后进第 90 关，**关卡进行中**顶上那两颗 `♾️ 照顾马拉松` / `📷 小屋相册`
 * 仍然 `elementFromPoint` 点得着。点下去关卡层只被 `levelHost.hidden = true` 藏起来、
 * 没有被销毁：`interval 0 → 1`、`listeners 6 → 7`，隐藏层里还留着 8 个活节点。
 *
 * 这一条 96px（连外边距 104px）的模式条同时还是 W5R2-C-08 的一半：
 * 360×720 起顶部四颗功能键被壳顶栏盖住或掉出屏幕，320×640 L140 上 y 低到 −219。
 *
 * 改法照搬档A 的 `97ebf62`：`[hidden]` 压得住 `display:flex`；进关收起来、离关放回去。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { KTC_CSS } from "./styles";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function rule(selector: string): string {
  const at = KTC_CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = KTC_CSS.indexOf("{", at) + 1;
  return KTC_CSS.slice(from, KTC_CSS.indexOf("}", from)).replace(/\s+/g, "");
}

const WIRED = SRC.slice(SRC.indexOf("      // 真下到某一关里"), SRC.indexOf("      guide,"));

describe("萌猫小屋 · 模式条只在选关地图上露面（W5R2-C-06）", () => {
  it("[hidden] 得压得住 display:flex，不然「收起模式条」全是空转", () => {
    // 这一条同时钉住一个一直在的老毛病：开马拉松 / 开相册时 bar.hidden 没起过作用
    expect(rule(".ktc-tools")).toContain("display:flex");
    expect(KTC_CSS).toContain(".ktc-tools[hidden]");
    expect(rule(".ktc-tools[hidden]")).toContain("display:none");
  });

  it("进关收起来、离关放回去", () => {
    expect(WIRED, "playLevel 没接成收模式条的那一版").toContain("bar.hidden = true");
    expect(WIRED, "离关得把模式条放回去，不然回地图就没入口了").toContain("bar.hidden = false");
    expect(WIRED).toContain("handle?.destroy?.()");
    expect(WIRED, "马拉松 / 相册开着时这一条本来就该收着").toContain("if (!mode) bar.hidden = false;");
  });

  it("得先收再摆：fitIntoStage() 是在 playLevel 里量的，量早了这 104px 白让", () => {
    expect(WIRED.indexOf("bar.hidden = true")).toBeLessThan(WIRED.indexOf("runLevel(stage, ctx)"));
  });

  it("关卡工厂只建一次，包一层不许每关重建", () => {
    expect(SRC).toContain("const runLevel = makePlayLevel(api, refreshBar);");
  });

  it("热区没动：两颗入口键回到地图上仍是 44px", () => {
    expect(rule(".ktc-mini")).toContain("min-height:44px");
    expect(rule(".ktc-tools[hidden]")).not.toContain("min-height");
  });
});
