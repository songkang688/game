/**
 * 数学农场 · 别人滚过的位置不许带进关内（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 对着测试员 W5-B-09（严重）：从选关地图按「🎯 跳到当前关」进关，`.game-stage` 上
 * 那个非 0 的 `scrollTop` 一路带进关卡界面，而舞台是定高 + `overflow:hidden`
 * （平台文件，交窗口1）。本款上被裁掉的是 `🗺️ 选关`——退不回地图；矮到 320×640
 * 时 `📖 攻略` 与 `⏭️ 跳过` 也一起挂掉。
 *
 * 仓库的 vitest 跑在 node 环境、没有 jsdom，所以这里用一条自造的假祖先链。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resetClippedScroll } from "./stageScroll";

/** 一条祖先链上的假节点，只有滚动位移是真的 */
class FakeEl {
  scrollTop = 0;
  scrollLeft = 0;
  parentElement: FakeEl | null = null;
  readonly style: Record<string, string> = {};
}

/** 造一条 `深 -> 浅` 的链，返回最深的那个（舞台节点） */
function chain(...tops: number[]): { leaf: FakeEl; all: FakeEl[] } {
  const all = tops.map((t) => {
    const el = new FakeEl();
    el.scrollTop = t;
    return el;
  });
  for (let i = 0; i < all.length - 1; i += 1) all[i].parentElement = all[i + 1];
  return { leaf: all[0], all };
}

const as = (el: FakeEl) => el as unknown as HTMLElement;

const dir = fileURLToPath(new URL(".", import.meta.url));
const runnerSource = readFileSync(`${dir}runner.ts`, "utf8");

describe("数学农场 · 进关时把带进来的滚动位移归 0（W5-B-09）", () => {
  it("真机复现的两档：87 与 60 都归 0", () => {
    for (const top of [87, 60]) {
      const { leaf, all } = chain(top, 0);
      expect(resetClippedScroll(as(leaf))).toBe(1);
      for (const el of all) expect(el.scrollTop).toBe(0);
    }
  });

  it("祖先滚了也一并还原（舞台在更外层的壳里滚的情形）", () => {
    const { leaf, all } = chain(0, 87, 14);
    expect(resetClippedScroll(as(leaf))).toBe(2);
    for (const el of all) expect(el.scrollTop).toBe(0);
  });

  it("本来就是 0 的一个都不碰", () => {
    const { leaf } = chain(0, 0, 0);
    expect(resetClippedScroll(as(leaf))).toBe(0);
  });

  it("传 null 不炸", () => {
    expect(resetClippedScroll(null)).toBe(0);
  });

  it("只动滚动位置，样式一个没碰", () => {
    const { leaf, all } = chain(9, 87);
    resetClippedScroll(as(leaf));
    for (const el of all) expect(Object.keys(el.style)).toHaveLength(0);
  });
});

describe("数学农场 · 这一下确实接在进关那一刻上", () => {
  it("playFarmLevel 开头就复位，早于后面所有排版", () => {
    expect(runnerSource).toContain('from "./stageScroll"');
    const enter = runnerSource.indexOf("export function playFarmLevel");
    expect(enter).toBeGreaterThan(0);
    const reset = runnerSource.indexOf("resetClippedScroll(stage)", enter);
    expect(reset, "playFarmLevel 里没有复位这一下").toBeGreaterThan(enter);
    // 复位要发生在关卡 UI 铺开之前，不然量出来的位置还是旧的
    const body = runnerSource.slice(enter, reset);
    expect(body.length, "复位这一下掉到函数很后面了").toBeLessThan(1200);
  });
});
