/**
 * 形状王国 · 作图关的大字得说主路那条（1.2 窗口5 · 第 3 轮 · 档B 学习优化员，`W5R3-BT-04`）。
 *
 * `W5-B-05` 修通的是「点两个点」：第 1 轮之前只有「按住拖」能画出长方形，
 * 点两下一点反应都没有。修完之后测试员八档全量复测 **8/8 点得出来**，
 * 读数行也早就改成了「点两个点（或者按住拖）」——**点两个点是主路**。
 *
 * 只有大标题 `.shk-ask` 还留在原地：「**拖**两个点，画一个面积是 6 平方厘米的长方形」。
 *
 * 孩子先看大字。大字说「拖」，可竖着拖在矮屏和横屏上会被壳层当成滚动
 * （`FB-01` / `boardPan` 那几手补丁写明的代价：`.shk-draw` 让出了竖向手势），
 * **照着大字做反而最容易做不成**——而旁边那行小字里正躺着能做成的那条路。
 *
 * 这一条只改一个动词，判题、点阵、热区、手势一个字节都不碰。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { buildDrawTasks, makeDrawTask, type RectTask } from "./draw";

/** 遍历 188 关，把所有作图题的题面收上来 */
function allRectAsks(): string[] {
  const out: string[] = [];
  for (let lv = 1; lv <= TOTAL_LEVELS; lv++) {
    for (let round = 0; round < 3; round++) {
      for (const t of buildDrawTasks(lv, 4, round)) {
        if (t.kind === "rect") out.push((t as RectTask).ask);
      }
    }
  }
  return out;
}

describe("形状王国 · 作图关大字说的就是主路那条（W5R3-BT-04）", () => {
  it("188 关的长方形题面里，一句「拖两个点」都不许再有", () => {
    const asks = allRectAsks();
    expect(asks.length, "一道长方形题都没抽到，这条用例就是空转").toBeGreaterThan(50);
    const dragging = asks.filter((a) => a.includes("拖两个点"));
    expect(
      dragging.length,
      `还有 ${dragging.length} 道大字写着「拖两个点」，例如：${dragging[0] ?? ""}`
    ).toBe(0);
  });

  it("改成「点两个点」，而且把「按住拖」那条老路写在括号里没删", () => {
    for (const ask of allRectAsks()) {
      expect(ask).toContain("点两个点");
      expect(ask, "老路还在，只是不再当第一句说").toContain("按住拖");
    }
  });

  it("大字和读数行现在说的是同一件事", () => {
    const rect = makeDrawTask(() => 0.25, "rect") as RectTask;
    // 读数行那句（draw.ts 里 paintReadout 的兜底文案）
    const readout = "点两个点（或者按住拖），拉出一个长方形";
    const verb = (s: string): string => (/点两个点/.exec(s) ? "点" : /拖两个点/.exec(s) ? "拖" : "?");
    expect(verb(rect.ask)).toBe(verb(readout));
  });

  it("只动了一个动词：题目要的周长 / 面积、单位、图形名一个字都没换", () => {
    const area = makeDrawTask(() => 0.25, "rect") as RectTask;
    const peri = makeDrawTask(() => 0.75, "rect") as RectTask;
    for (const t of [area, peri]) {
      expect(t.ask).toMatch(/画一个(面积是 \d+ 平方厘米|周长是 \d+ 厘米)的长方形/);
      expect(t.goal === "area" || t.goal === "perimeter").toBe(true);
      expect(t.target).toBeGreaterThan(0);
    }
    expect(area.goal).not.toBe(peri.goal);
  });
});
