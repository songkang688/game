/**
 * 音乐星星 · 进关不许带着别人滚过的位置（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FBS-03）。
 *
 * `W5R2-LB-03` 只接了三款，本款漏了。竖屏上量到的 0 是碰巧——横过来拿，
 * 舞台一下矮到 264px，聚焦滚动推得动的距离一下就大了：
 * 第 140 关 640×360 / 720×360 上 `.game-stage.scrollTop=131`、844×390 上 `=101`，
 * 「🗺️ 选关」被顶到 y=15 / y=45，`elementFromPoint` 拿回壳顶栏——**关内唯一的退出口按不着**。
 * 六组（三档视口 × 🎯 与直接点节点两条路）无一例外。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resetClippedScroll } from "./stageScroll";

const dir = fileURLToPath(new URL(".", import.meta.url));
const indexSource = readFileSync(`${dir}index.ts`, "utf8");
const advancedSource = readFileSync(`${dir}advanced.ts`, "utf8");

/** 只实现 `resetClippedScroll` 会碰的那两个属性 */
class FakeEl {
  scrollTop = 0;
  scrollLeft = 0;
  parentElement: FakeEl | null = null;
}

function chain(n: number): FakeEl[] {
  const all = Array.from({ length: n }, () => new FakeEl());
  for (let i = 0; i < n - 1; i++) all[i].parentElement = all[i + 1];
  return all;
}

const as = (el: FakeEl): HTMLElement => el as unknown as HTMLElement;

describe("音乐星星 · resetClippedScroll", () => {
  it("真机横屏复现的那一档：祖先 scrollTop=131，进关后归 0", () => {
    const all = chain(4);
    const leaf = all[0];
    all[2].scrollTop = 131;
    expect(resetClippedScroll(as(leaf))).toBe(1);
    for (const el of all) expect(el.scrollTop).toBe(0);
  });

  it("横向位移也一并还原（地图横着滑过也算）", () => {
    const all = chain(3);
    all[1].scrollLeft = 44;
    all[2].scrollTop = 101;
    expect(resetClippedScroll(as(all[0]))).toBe(2);
    expect(all[1].scrollLeft).toBe(0);
    expect(all[2].scrollTop).toBe(0);
  });

  it("本来就是 0 的一个都不碰——返回 0，不打断正常的滚动惯性", () => {
    const all = chain(4);
    expect(resetClippedScroll(as(all[0]))).toBe(0);
  });

  it("传 null 不抛", () => {
    expect(resetClippedScroll(null)).toBe(0);
  });

  it("整条链都归零，不是只归自己那一层", () => {
    const all = chain(5);
    for (const el of all) el.scrollTop = 60;
    expect(resetClippedScroll(as(all[0]))).toBe(5);
    for (const el of all) expect(el.scrollTop).toBe(0);
  });
});

describe("音乐星星 · 接线：关卡与进阶两条入口都得复位", () => {
  it("关卡界面挂进舞台之后立刻归零", () => {
    const at = indexSource.indexOf("stage.appendChild(wrap)");
    expect(at, "找不到挂载点").toBeGreaterThan(-1);
    expect(indexSource.slice(at, at + 320)).toContain("resetClippedScroll(wrap)");
  });

  it("进阶界面同样接上——两条入口漏一条都等于没修", () => {
    const at = advancedSource.indexOf("stage.appendChild(wrap)");
    expect(at, "找不到挂载点").toBeGreaterThan(-1);
    expect(advancedSource.slice(at, at + 320)).toContain("resetClippedScroll(wrap)");
  });
});
