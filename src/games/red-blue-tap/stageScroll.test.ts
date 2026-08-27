/**
 * 红蓝大作战 · 别人滚过的位置不许带进关内（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 对着测试员 W5-B-09（严重）：从选关地图按「🎯 跳到当前关」进关，`.game-stage` 上
 * 那个非 0 的 `scrollTop` 会一路带进关卡界面，而舞台是定高 + `overflow:hidden`
 * （平台文件，交窗口1），于是 `⚔️ 双人对战` 与 `♾️ 点到手软` 被硬裁到顶栏后面，
 * 用户没有任何手势能把它滚回来——双人与无尽模式的唯一入口就此锁死。
 *
 * 仓库的 vitest 跑在 node 环境、没有 jsdom，所以这里用一条自造的假祖先链，
 * 只实现 `resetClippedScroll` 会碰的那两个属性。
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
  /** 样式与 DOM 有没有被动过——用例靠它证明这个修法「只碰滚动位置」 */
  readonly style: Record<string, string> = {};
  readonly children: FakeEl[] = [];
}

/** 造一条 `深 -> 浅` 的链，返回最深的那个（关卡根节点） */
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
const indexSource = readFileSync(`${dir}index.ts`, "utf8");
const helperSource = readFileSync(`${dir}stageScroll.ts`, "utf8");

describe("红蓝大作战 · 进关时把带进来的滚动位移归 0（W5-B-09）", () => {
  it("真机复现的那一档：祖先 scrollTop=102，进关后归 0", () => {
    const { leaf, all } = chain(0, 102, 0);
    expect(resetClippedScroll(as(leaf))).toBe(1);
    for (const el of all) expect(el.scrollTop).toBe(0);
  });

  it("整条链上有几个滚过就还原几个，自己也算", () => {
    const { leaf, all } = chain(31, 102, 8);
    expect(resetClippedScroll(as(leaf))).toBe(3);
    for (const el of all) expect(el.scrollTop).toBe(0);
  });

  it("横向也一起还原（宽屏地图横滚过来的同理）", () => {
    const { leaf } = chain(0, 0);
    leaf.scrollLeft = 45;
    expect(resetClippedScroll(as(leaf))).toBe(1);
    expect(leaf.scrollLeft).toBe(0);
  });

  it("本来就是 0 的一个都不碰（免得打断正常的滚动惯性）", () => {
    const { leaf } = chain(0, 0, 0);
    expect(resetClippedScroll(as(leaf))).toBe(0);
  });

  it("传 null 不炸（关卡还没挂上时的兜底）", () => {
    expect(resetClippedScroll(null)).toBe(0);
  });

  it("只动滚动位置：样式与子节点一个没碰", () => {
    const { leaf, all } = chain(12, 102);
    resetClippedScroll(as(leaf));
    for (const el of all) {
      expect(Object.keys(el.style)).toHaveLength(0);
      expect(el.children).toHaveLength(0);
    }
  });
});

describe("红蓝大作战 · 这一下确实接在进关那一刻上", () => {
  it("playLevel 里挂完 wrap 就复位", () => {
    expect(indexSource).toContain('from "./stageScroll"');
    const at = indexSource.indexOf("stage.appendChild(wrap);");
    expect(at, "playLevel 里那句 appendChild 不见了，这条断言得跟着改").toBeGreaterThan(0);
    expect(indexSource.slice(at, at + 320)).toContain("resetClippedScroll(wrap)");
  });

  it("helper 不许顺手改样式或改 DOM（平台的 overflow 交窗口1，一行不碰）", () => {
    for (const banned of ["overflow", "style.", "appendChild", "removeChild", "classList"]) {
      expect(helperSource.split("*/")[1] ?? helperSource, `helper 里出现了 ${banned}`).not.toContain(
        banned
      );
    }
  });
});
