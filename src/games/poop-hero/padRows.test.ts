/**
 * 便便超人 · 手柄网格给「已经不显示的说明行」白留了一整行
 * （窗口5 第2轮 档C 监督修复员 · W5R2-FC-02）。
 *
 * 第 2 轮学习优化员把双人手柄从 34/37/41px 抬到了 45–51px（LC-04，真修，我复量过），
 * 但同一格上还压着一笔没人算过的账：
 *
 * `.ph-pad` 是 `grid-auto-rows:var(--k)` 的网格，键写死在第 2、3 行，
 * 第 1 行留给键盘说明 `.ph-pad-name`。而 `.ph-pad-name` 在
 * `@media (hover:none) and (max-width:420px)` 里是 `display:none`——
 * **触屏手机上它根本不显示**。可 `grid-auto-rows` 不管显不显示，
 * 照样给第 1 行分了整整 `var(--k)` = 44–56px。
 *
 * 这 56px 的空行落到屏幕上是这样（CDP 实测 360×640 第 141 关，分类关）：
 *
 * | 块 | 高 | 掉出裁切线多少 |
 * | --- | --- | --- |
 * | `.ph-pads` | **180**（= 56×3 + 6×2，其中第 1 行整行是空的） | 0 |
 * | `.pph-bins` 三色桶图例 ♻️🥬🗑️ | 32 | **33（整块 0 像素可见）** |
 * | `.ph-tip` 玩法提示 | 17 | **54（整句 0 像素可见）** |
 *
 * 画布这时已经收到 `MIN_CANVAS_H` = 130px 的底线，`canvasRoomPx()` 再也让不出来。
 * 三色桶图例是分类关「照着颜色就能投」的唯一说明，看不见就只能靠猜。
 *
 * 改法只有一行：把第 1 行从 `grid-auto-rows` 手里拿出来写成 `auto`——
 * 说明行显示时它照样撑开，`display:none` 时它就是 0。键仍旧在第 2、3 行，
 * 既有用例（`duoPad.test.ts` 那条「六颗键各占各的格子」）一个断言都不用改。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { padGridHeight, padMetrics } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const CSS = SRC.slice(SRC.indexOf("export const PH_CSS = `"), SRC.indexOf("\n`;", SRC.indexOf("export const PH_CSS = `")));

/** 抠出某条选择器的整段声明 */
function rule(sel: string): string {
  const at = CSS.indexOf(`${sel}{`);
  if (at < 0) return "";
  return CSS.slice(at, CSS.indexOf("}", at));
}

describe("便便超人 · 说明行藏起来之后那一行不许还占着地方（W5R2-FC-02）", () => {
  it("`.ph-pad` 的第一行写成 auto，不再由 grid-auto-rows 顶成一整颗键那么高", () => {
    const pad = rule(".ph-pad");
    expect(pad, ".ph-pad 这条规则没找着").not.toBe("");
    expect(pad, "第一行还归 grid-auto-rows 管，说明行藏起来也照样占 44–56px").toContain("grid-template-rows:");
    const rows = /grid-template-rows:([^;]+)/.exec(pad)?.[1]?.trim() ?? "";
    expect(rows.split(/\s+/)[0], "第一行必须是 auto：显示时撑开，display:none 时归零").toBe("auto");
    // 后面两行仍旧是一颗键那么高
    expect(rows).toContain("var(--k)");
  });

  it("说明行仍旧是触屏上藏起来的那一条（这条不许回潮成「一直显示」）", () => {
    expect(CSS).toContain("@media (hover:none) and (max-width:420px){ .ph-pad-name{display:none;} }");
  });

  it("藏起来的说明行不再吃高度：四档宽度上手柄整块都省下一整行", () => {
    for (const w of [320, 360, 390, 414]) {
      for (const players of [1, 2] as const) {
        const m = padMetrics(w, players);
        const shown = padGridHeight(m, 16);
        const hidden = padGridHeight(m, 0);
        expect(shown - hidden, `${w}px / ${players}人：说明行藏起来只省下 ${shown - hidden}px`).toBe(16);
        // 老写法（第一行也按 var(--k) 算）会是这个数，两者之差就是白留的那一整行
        const oldWay = m.key * 3 + m.gap * 2;
        expect(oldWay - hidden, `${w}px / ${players}人`).toBe(m.key);
        expect(m.key).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it("360×640 分类关那一屏：省下这一行就够三色桶图例和提示行回到屏幕里", () => {
    // 实测值：wrap 454，舞台看得见 400，超 54；画布已在 130 的底线上让不动
    const m = padMetrics(360, 1);
    const saved = m.key; // 白留的那一整行
    expect(saved, `只省下 ${saved}px，补不上 54px 的窟窿`).toBeGreaterThanOrEqual(54);
  });

  it("说明行真显示的时候（鼠标机 / 宽屏）照样撑得开，不许被压成 0", () => {
    const m = padMetrics(390, 1);
    expect(padGridHeight(m, 18)).toBe(18 + m.gap * 2 + m.key * 2);
  });
});
