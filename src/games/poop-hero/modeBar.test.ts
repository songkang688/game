/**
 * 便便超人 · 模式条只在选关地图上露面（窗口5 第2轮 档C · W5R2-C-02 阻断 / C-06 严重）。
 *
 * 第 2 轮 CDP 复量：`.ph-modebar` 那两颗入口键在 360px 宽上排不下、折成两行占 96px，
 * 连同外边距 106px，而它从选关地图一路跟进关内常驻。
 * 舞台 360×640 上一共才看得见 530px，实测裁掉 145px ——
 * 六颗 56×56 的方向键整排落在裁切线以下（y=646…708），
 * `elementFromPoint` 六颗全部拿不回自己，**纯触屏 secs=0，一步都走不动**。
 *
 * 另外测试员还量到：关卡进行中这两颗仍然点得着，点下去关卡层只被 `hidden` 藏起来、
 * 不销毁，两条 `requestAnimationFrame` 会同时跑（W5R2-C-06）。
 *
 * 改法照搬档A 的 `97ebf62`，两处缺一不可：`[hidden]` 压得住 `display:flex`；
 * 进关收起来、离关放回去，侧模式开着时不替它放回来。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HUD_BTN_MIN_H } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("export const PH_CSS = `"), SRC.indexOf("\n/* ---- 1.2 新增"));

function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = CSS.indexOf("{", at) + 1;
  return CSS.slice(from, CSS.indexOf("}", from)).replace(/\s+/g, "");
}

const WIRED = SRC.slice(SRC.indexOf("      chapters: CHAPTERS,\n      // 真下到某一关里"), SRC.indexOf("      mapHint: \"清洁度"));

describe("便便超人 · 模式条只在选关地图上露面（W5R2-C-02 / C-06）", () => {
  it("[hidden] 得压得住 display:flex,不然「收起模式条」全是空转", () => {
    // 这一条同时钉住一个一直在的老毛病:开无尽 / 开双人时 bar.hidden 没起过作用
    expect(rule(".ph-modebar")).toContain("display:flex");
    expect(CSS).toContain(".ph-modebar[hidden]");
    expect(rule(".ph-modebar[hidden]")).toContain("display:none");
  });

  it("进关收起来、离关放回去", () => {
    expect(WIRED, "playLevel 没接成收模式条的那一版").toContain("bar.hidden = true");
    expect(WIRED, "离关得把模式条放回去,不然回地图就没入口了").toContain("bar.hidden = false");
    expect(WIRED).toContain("handle?.destroy?.()");
    expect(WIRED, "无尽 / 双人开着时这一条本来就该收着").toContain("if (!current) bar.hidden = false;");
  });

  it("得先收再摆:摇杆是在 playLevel 里按视口量的,量早了这 106px 白让", () => {
    expect(WIRED.indexOf("bar.hidden = true")).toBeLessThan(WIRED.indexOf("playLevel(stage, ctx)"));
  });

  it("热区没动:两颗入口键回到地图上仍是 44px", () => {
    // 读的是源码文本,模板串还没求值(rule() 会切在 ${} 的右花括号上),所以两头分开断言
    expect(rule(".ph-mode")).toContain("min-height:${HUD_BTN_MIN_H");
    expect(HUD_BTN_MIN_H).toBeGreaterThanOrEqual(44);
    expect(rule(".ph-modebar[hidden]")).not.toContain("min-height");
  });
});
