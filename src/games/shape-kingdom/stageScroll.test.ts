/**
 * 图形王国 · 进关不许带着别人滚过的位置（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5R2-FBS-03）。
 *
 * `W5R2-LB-03` 只接了三款，本款和 `music-stars` 漏了。竖屏四档量到的 0 是碰巧：
 * `music-stars` 横过来拿当场带进 131px，把「🗺️ 选关」顶到壳顶栏底下。
 * 本款这一轮量到的是 0，可两款只差在内容高矮上——同一行接上，别等下一道高题把它撞出来。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resetClippedScroll } from "./stageScroll";

const dir = fileURLToPath(new URL(".", import.meta.url));
const drawSource = readFileSync(`${dir}draw.ts`, "utf8");
const reviewSource = readFileSync(`${dir}review.ts`, "utf8");

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

describe("图形王国 · resetClippedScroll", () => {
  it("祖先带着位移进关，整条链一起归 0", () => {
    const all = chain(4);
    all[2].scrollTop = 131;
    expect(resetClippedScroll(as(all[0]))).toBe(1);
    for (const el of all) expect(el.scrollTop).toBe(0);
  });

  it("横向位移也一并还原", () => {
    const all = chain(3);
    all[1].scrollLeft = 44;
    expect(resetClippedScroll(as(all[0]))).toBe(1);
    expect(all[1].scrollLeft).toBe(0);
  });

  it("本来就是 0 的一个都不碰——返回 0，不打断正常的滚动惯性", () => {
    expect(resetClippedScroll(as(chain(4)[0]))).toBe(0);
  });

  it("传 null 不抛", () => {
    expect(resetClippedScroll(null)).toBe(0);
  });
});

describe("图形王国 · 接线：作图台与答题屏两条入口都得复位", () => {
  it("作图台挂进舞台之后立刻归零", () => {
    const at = drawSource.indexOf("stage.appendChild(wrap)");
    expect(at, "找不到挂载点").toBeGreaterThan(-1);
    expect(drawSource.slice(at, at + 320)).toContain("resetClippedScroll(wrap)");
  });

  it("答题屏同样接上——两条入口漏一条都等于没修", () => {
    const at = reviewSource.indexOf("stage.appendChild(wrap)");
    expect(at, "找不到挂载点").toBeGreaterThan(-1);
    expect(reviewSource.slice(at, at + 320)).toContain("resetClippedScroll(wrap)");
  });

  it("归零要排在钳位之前——钳位量的是位置，带着位移量出来的可视段是错的", () => {
    const reset = drawSource.indexOf("resetClippedScroll(wrap)");
    const fit = drawSource.indexOf("fitIntoStage(wrap)");
    expect(reset, "没接线").toBeGreaterThan(-1);
    expect(fit).toBeGreaterThan(-1);
    expect(reset, "钳位排在归零前面，量到的可视段是带着位移的那一份").toBeLessThan(fit);
  });
});
