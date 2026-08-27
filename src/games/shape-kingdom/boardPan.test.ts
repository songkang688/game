/**
 * 图形王国 · 矮屏上手指落在作图板上也划得动
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`W5R2-LB-07` 的复审补修）。
 *
 * 学习优化员的 `W5R2-LB-07` 把图形以下那一摞合成 `.shk-dock` 钉在作图台底边常驻，
 * 量化写的是「三档视口 × 三个滚动位置 **7/7**」。这个数字本身没错，
 * 可它是**拨 `scrollTop`** 量出来的——换成真手指就不是这么回事。
 *
 * 本轮 CDP 逐点复量（作图关 L140，起手点钉死在具体某一颗点的中心上）：
 *
 * ```
 * 视口      .shk-draw 可滚   顶部点不着   从「第 3 行第 4 列的点」起手上划 110px
 * 360×720   30px            7 颗        scrollTop 0 → 0
 * 360×640   110px           14 颗       scrollTop 0 → 0
 * 320×640   101px           14 颗       scrollTop 0 → 0
 * ```
 *
 * 点不着的那 7–14 颗全是点阵**最后两行**，被常驻的 `.shk-dock` 压在底下
 * （`elementFromPoint` 拿回 `.shk-tools` / `.shk-btn` / `.shk-readout`）。
 * 要够着就得滚，可 `.shk-board` 挂着 `touch-action:none`，手指落在板子上一步都划不动。
 * 对照实验把同一颗点的 `touch-action` 临时改成 `pan-y`，同一次上划当场滚满
 * **104 / 101 / 30px**——挡路的就是这一条，不是别的。
 *
 * 这和第 1 轮在 `music-stars` 横向上、本轮 `W5R2-LB-13` 在竖向上抓到的是同一个坑：
 * 壳滚得起来，可键 / 板子把手势吃掉了。修法也照抄那一条：**只在真的滚得起来的那一档里**
 * 让出**竖**这一个方向，热区一个都不动。
 *
 * 代价写清楚：`buildRectBoard` 的「按住拖」在矮屏上，竖着拖会变成滚动。
 * 这一款的读数行白纸黑字写的是「点两个点（或者按住拖）」，**点两个点是主路**
 * （第 1 轮 W5-F-13 / W5-B-05 专门修通过的就是它），横着拖也照旧能拖。
 * 高屏（> `SHORT_SCREEN_PX`）上一个字都没变，按住拖仍旧是原来的手感。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DRAW_CSS, SHORT_SCREEN_PX } from "./draw";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}draw.ts`, "utf8");

const css = DRAW_CSS;
const shortAt = css.indexOf(`@media (max-height:${SHORT_SCREEN_PX}px)`);
/** 矮屏那一档的规则体 */
const shortBlock = css.slice(shortAt, css.indexOf("\n}", shortAt));
/** 矮屏那一档以外的通用规则 */
const baseBlock = css.slice(0, shortAt);

function rule(block: string, name: string): string {
  const at = block.indexOf(`${name}{`);
  expect(at, `这一段里没有 ${name}`).toBeGreaterThan(-1);
  return block.slice(at, block.indexOf("}", at));
}

describe("图形王国 · 作图板在矮屏上让出竖向手势", () => {
  it("高屏上板子仍旧吃掉全部手势——按住拖是原来的手感", () => {
    expect(rule(baseBlock, ".shk-board")).toContain("touch-action:none");
  });

  it("矮屏那一档里板子让出竖向（pan-y），手指落在点上也划得动", () => {
    expect(shortAt, "矮屏那一档不见了").toBeGreaterThan(-1);
    expect(rule(shortBlock, ".shk-board")).toContain("touch-action:pan-y");
  });

  it("让的是手势不是尺寸：矮屏这一档没有把任何热区收小", () => {
    // 这一档里但凡出现 min-height，只能落在只读的行上（城堡 / 读数 / 反馈 / 壳自己），
    // 热区那几类（点 / 格子 / 按钮 / 骨牌）一个都不许被这一档碰到尺寸。
    for (const hot of [".shk-dot", ".shk-cell", ".shk-piece"]) {
      expect(shortBlock, `${hot} 不该出现在矮屏那一档里`).not.toContain(`${hot}{`);
    }
    expect(rule(shortBlock, ".shk-btn")).not.toContain("min-height");
    expect(rule(shortBlock, ".shk-btn")).not.toContain("font-size");
    // 板子那条只让手势，不许顺手改尺寸
    const board = rule(shortBlock, ".shk-board");
    expect(board).not.toContain("min-height");
    expect(board).not.toContain("width");
    expect(board).not.toContain("transform");
  });

  it("这一档确实是「真的滚得起来」的那一档——壳自己 overflow-y:auto", () => {
    expect(rule(shortBlock, ".shk-draw")).toContain("overflow-y:auto");
  });

  it("常驻那一摞还钉在底边（钉住 + 划得动是两道，缺一不可）", () => {
    expect(rule(baseBlock, ".shk-dock")).toContain("position:sticky");
    expect(rule(baseBlock, ".shk-dock")).toContain("bottom:0");
  });

  it("按住拖那条路一个字没删——点两个点仍是主路，横着拖照旧能拖", () => {
    expect(source).toContain('board.addEventListener("pointerdown", onDown as EventListener)');
    expect(source).toContain('board.addEventListener("pointermove", onMove as EventListener)');
    expect(source).toContain('board.addEventListener("pointerup", onUp as EventListener)');
    // 「原地抬起算一次点击」= 点两个点这条主路（第 1 轮 W5-B-05 修通的那一条）
    expect(source).toContain("if (!movedAway)");
    expect(source).toContain("tapDot(from.r, from.c)");
  });

  it("矮屏阈值和 fitIntoStage 那一套用的是同一个常量，不另抄数字", () => {
    expect(SHORT_SCREEN_PX).toBe(720);
    expect(css.split(`@media (max-height:${SHORT_SCREEN_PX}px)`).length - 1).toBe(1);
  });
});
