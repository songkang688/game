/**
 * 红蓝点点 · 把 320×568 那台机器**横过来拿**（568×320），
 * 双人对战与「点到手软」的键还是一颗都点不着
 * （1.2 窗口5 · 第 3 轮 · 档B 监督修复员，`W5R3-BF-01`）。
 *
 * `W5R3-BL-01` 那一手（一侧摊成一排 4 列 + `KEY_TIGHT_PX`）在 640×360 / 740×360 /
 * 844×390 上真的把 8 颗键全捞回来了——我自己拿 `elementFromPoint(中心点)` 逐颗量过，
 * 三档六格 8/8。可**最矮的那一档它没盖到**：
 *
 * ```
 * 568×320 × 双人对战 / 点到手软（真机 CDP，补丁后仍旧）
 *   壳层顶栏吃掉 138px，.game-stage 看得见的那一段只剩 170px（138…308）
 *   .rbt-vs 面板 274.3px，键排上沿 303.6 / 下沿 359.5 —— 整排在裁切线以下 51.5px
 *   8 颗键 own 0/8，4 颗键 own 0/4；.rbt-vs 与 .game-stage 都不滚，真手指 3 趟也捞不回来
 *   .game-stage 下裁死的有字叶子：17 个（对战）/ 9 个（无尽）
 * ```
 *
 * learner 把这一档判成「根子在平台侧，交窗口1」。我自己把这笔余量算了一遍，
 * **不成立**：那 51.5px 全都躺在这一款自己的留白与字号里，一分都不用去动
 * 44px 热区，也不用碰平台的 `.game-stage`——
 *
 * | 让出来的 | 从哪儿 |
 * | --- | --- |
 * | 4px | 面板上下内衬 8 → `ULTRA_PAD_PX` |
 * | 2px | 顶栏下面那条缝 4 → `ULTRA_ROW_GAP_PX` |
 * | 8px | 比分头像 30 → `ULTRA_AVA_PX`，字号 18 → 15 |
 * | 2px | 比分行下面那条缝 |
 * | 26px | 回合说明字号 15 → 13、行高 1.5 → 1.3（**话一句没少说**，副提示也留着） |
 * | 2px | 回合说明下面那条缝 |
 * | 3px | 一侧的内衬 6 → `ULTRA_SIDE_PAD_PX` |
 * | 15px | 键位名那一行收起来——A S D F 本来就印在每一颗键上（`.rbt-key-cap`），谁是哪一边看比分行的头像 |
 *
 * 收的是**留白、字号与一行冗余标签**，不是玩法，也不是热区：
 * `.rbt-key` 仍旧 `KEY_TIGHT_PX`（56 ≥ 44），头上两颗按钮仍旧 `TOUCH_MIN_PX`，
 * 中间那条 `SIDE_GUTTER_PX` 隔离带一分不动。
 *
 * 门槛立在 `ULTRA_SHORT_PX = 340`：360 / 390 高的那三档横屏一个字节都不受影响
 * （真机 A/B 复量三档六格读数与补丁前一模一样）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARENA_CSS,
  KEY_TIGHT_PX,
  SHORT_LANDSCAPE_PX,
  SIDE_GUTTER_PX,
  TOUCH_MIN_PX,
  ULTRA_AVA_PX,
  ULTRA_BRIEF_MIN_PX,
  ULTRA_BRIEF_TWO_LINE_PX,
  ULTRA_PAD_PX,
  ULTRA_ROW_GAP_PX,
  ULTRA_SHORT_PX,
  ULTRA_SIDE_PAD_PX,
  ULTRA_STAGE_ROOM_PX,
  ultraAboveKeysPx,
  ultraKeyBottomPx,
} from "./arena";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}arena.ts`, "utf8");

/** 真机 568×320 量到的那一组：顶栏 138、裁切线 308、补丁前键排上沿离面板顶 165.6 */
const REAL = { chrome: 138, clip: 308, oldAboveKeys: 165.6, oldKeyBottom: 359.5 };

describe("红蓝点点 · 568×320 矮横屏：侧模式的键得留在裁切线里面", () => {
  it("**先摆事实**：`BL-01` 那一手之后，568×320 上整排键仍旧在裁切线以下 51.5px", () => {
    expect(REAL.clip - REAL.chrome, "舞台看得见的那一段").toBe(ULTRA_STAGE_ROOM_PX);
    // 补丁前的预算：键排上沿 165.6 + 一排 56px 的键
    const before = REAL.oldAboveKeys + KEY_TIGHT_PX;
    expect(Math.round(before), "补丁前键排下沿离面板顶").toBe(Math.round(REAL.oldKeyBottom - REAL.chrome));
    expect(before, "这就是为什么 8 颗键 own 0/8").toBeGreaterThan(ULTRA_STAGE_ROOM_PX);
    expect(Math.round(before - ULTRA_STAGE_ROOM_PX), "差这么多").toBe(52);
  });

  it("超矮那一档把留白与字号让出来之后，整排键落回裁切线里面", () => {
    // 回合说明折两行是这一档的最坏情况（真机量到 31.8px）
    expect(ultraKeyBottomPx(ULTRA_BRIEF_TWO_LINE_PX)).toBeLessThanOrEqual(ULTRA_STAGE_ROOM_PX);
    // 只有一行时更宽裕
    expect(ultraKeyBottomPx(ULTRA_BRIEF_MIN_PX)).toBeLessThan(ultraKeyBottomPx(ULTRA_BRIEF_TWO_LINE_PX));
    // 键排上沿：真机量到 112.8，公式给的是同一个数（±1px 以内）
    expect(Math.abs(ultraAboveKeysPx(ULTRA_BRIEF_TWO_LINE_PX) - 112.8)).toBeLessThanOrEqual(1);
  });

  it("热区一分没缩：键仍旧 56，头上两颗按钮仍旧 44", () => {
    expect(KEY_TIGHT_PX).toBeGreaterThanOrEqual(TOUCH_MIN_PX);
    expect(ULTRA_AVA_PX, "缩的是头像，不是能按的东西").toBeLessThan(30);
    const at = source.indexOf("@media (max-height: ${ULTRA_SHORT_PX}px)");
    expect(at, "样式上没有超矮那一档，CSS 与预算就走散了").toBeGreaterThan(0);
    const block = source.slice(at, source.indexOf("\n}", at));
    expect(block, "超矮档不许去动键的边长").not.toContain(".rbt-key {");
    // 这一档里唯一还写 min-height 的只有回合说明与反馈行，两颗 44px 的按钮一个字节没碰
    const minHeights = block.split("\n").filter((line) => line.includes("min-height"));
    for (const line of minHeights) {
      expect(line, "超矮档只许收说明行与反馈行的最矮高度").toMatch(/\.rbt-vs-(brief|cloud)/);
    }
    expect(block).toContain("${ULTRA_PAD_PX}px");
    expect(block).toContain("${ULTRA_ROW_GAP_PX}px");
    expect(block).toContain("${ULTRA_SIDE_PAD_PX}px");
  });

  it("只在超矮那一档生效：360 / 390 高的三档横屏一个字节不受影响", () => {
    expect(ULTRA_SHORT_PX).toBeLessThan(360);
    expect(ULTRA_SHORT_PX).toBeGreaterThan(320);
    expect(ULTRA_SHORT_PX).toBeLessThan(SHORT_LANDSCAPE_PX);
    // 320×568 竖屏也在门槛外（高 568）
    expect(568).toBeGreaterThan(ULTRA_SHORT_PX);
  });

  it("收的是留白与一行冗余标签，不是内容：回合说明与副提示都还在，键位印在键上", () => {
    const at = source.indexOf("@media (max-height: ${ULTRA_SHORT_PX}px)");
    const block = source.slice(at, source.indexOf("\n}", at));
    expect(block, "回合说明那一行不许藏起来").not.toContain(".rbt-vs-brief { display: none");
    expect(block, "副提示那一行不许藏起来").not.toContain(".rbt-vs-brief-hint { display: none");
    expect(block, "键位名那一行收起来，A S D F 印在键上").toContain(".rbt-vs-name { display: none; }");
    // 键帽照旧生成，不然收起来键位名就真丢了
    expect(source).toContain('cap.className = "rbt-key-cap"');
    expect(ARENA_CSS).toContain(".rbt-key-cap {");
  });

  it("隔离带一分不动（W5-B-02 定的规矩：一只手不许误触另一边）", () => {
    expect(SIDE_GUTTER_PX).toBe(24);
    const at = source.indexOf("@media (max-height: ${ULTRA_SHORT_PX}px)");
    const block = source.slice(at, source.indexOf("\n}", at));
    expect(block).not.toContain("rbt-vs-gap");
  });
});
