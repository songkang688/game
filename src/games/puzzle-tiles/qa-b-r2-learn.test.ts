/**
 * 窗口 4 · 档B · 第 2 轮学习优化员 —— 拼图乐园
 *
 * 落地 B2-02：无尽画廊到顶之后接着加压，展厅招牌也不再卡死。
 */
import { describe, expect, it } from "vitest";
import {
  ENDLESS_HALLS,
  GALLERY_CAP_ROUND,
  GALLERY_HINT_FLOOR,
  GALLERY_TRIM_MAX,
  endlessBoard,
  endlessHallName,
  galleryPressure,
} from "./levels";
import { boardKind } from "./logic";

describe("档B R2 学习优化员 · 拼图乐园 · 无尽画廊到顶之后还在走", () => {
  it("展厅招牌逛完一圈就从头再逛：不会第 21 幅起永远挂「焰火厅」", () => {
    // 改之前：endlessHallName 用的是 clamp，第 21 幅之后招牌再也不换
    expect(endlessHallName(21)).toBe(ENDLESS_HALLS[0]);
    expect(endlessHallName(1)).toBe(ENDLESS_HALLS[0]);
    expect(endlessHallName(17)).toBe(ENDLESS_HALLS[4]);
    // 一圈是 5 个厅 × 每厅 4 幅 = 20 幅
    for (const round of [1, 7, 13, 26, 44, 91]) {
      expect(endlessHallName(round + 20), `第 ${round} 幅和第 ${round + 20} 幅该是同一个厅`).toBe(
        endlessHallName(round),
      );
    }
    const seen = new Set(Array.from({ length: 40 }, (_, i) => endlessHallName(i + 21)));
    expect([...seen].sort()).toEqual([...ENDLESS_HALLS].sort());
  });

  it("板子封顶之后三个旋钮接着拧：提示更少、来「不看图挑战」、步数更紧", () => {
    const at = (r: number) => galleryPressure(r, 4);
    expect(at(GALLERY_CAP_ROUND).over).toBe(0);
    expect(at(GALLERY_CAP_ROUND).moveScale).toBe(1);
    expect(at(GALLERY_CAP_ROUND).hidePreview).toBe(false);
    // 封顶之后一路收紧
    expect(at(GALLERY_CAP_ROUND + 40).moveScale).toBeLessThan(at(GALLERY_CAP_ROUND + 10).moveScale);
    expect(at(GALLERY_CAP_ROUND + 40).hints).toBeLessThan(at(GALLERY_CAP_ROUND).hints);
  });

  it("每个旋钮都有下限：拧到底就稳住，不会一路紧到没法玩", () => {
    for (let round = 1; round <= 600; round++) {
      const p = galleryPressure(round, 4);
      expect(p.hints, `第 ${round} 幅的提示被扣光了`).toBeGreaterThanOrEqual(GALLERY_HINT_FLOOR);
      expect(p.moveScale, `第 ${round} 幅的步数被砍过头`).toBeGreaterThanOrEqual(1 - GALLERY_TRIM_MAX);
      expect(p.moveScale).toBeLessThanOrEqual(1);
    }
    expect(galleryPressure(9999, 4).moveScale).toBe(1 - GALLERY_TRIM_MAX);
  });

  it("「不看图挑战」是穿插的，不是从此每幅都不给看", () => {
    let hidden = 0;
    for (let round = GALLERY_CAP_ROUND + 1; round <= GALLERY_CAP_ROUND + 100; round++) {
      if (galleryPressure(round, 3).hidePreview) hidden++;
    }
    expect(hidden).toBeGreaterThan(0);
    expect(hidden).toBeLessThanOrEqual(30);
  });

  it("封顶到触底这一段是真的一幅比一幅紧", () => {
    // 改之前：第 30 / 60 / 120 幅的（片数, hints, 藏图, 限时, 玩法）逐项相等，玩多久都一个样。
    // 取同一种玩法（n % 3 === 0 的推格子）来比，免得三种玩法混着比不出所以然。
    const dump = (r: number): string => {
      const b = endlessBoard(r);
      return `${b.rows}x${b.cols}|${b.hints}|${b.moveLimit}|${b.timeLimit ?? "-"}`;
    };
    const shots = [21, 30, 42].map(dump);
    expect(new Set(shots).size, `第 21 / 30 / 42 幅还是同一张配置：${shots[0]}`).toBe(3);
    // 触底之后（推格子约在第 44 幅各项先后到底）就稳住，这是「有下限」而不是「又冻住了」
    expect(dump(60)).toBe(dump(120));
  });

  it("加压之后每一幅仍旧是合法、拼得完的板子", () => {
    for (let round = 1; round <= 200; round++) {
      const b = endlessBoard(round);
      expect(b.rows, `第 ${round} 幅的板子越界了`).toBeGreaterThanOrEqual(3);
      expect(b.rows).toBeLessThanOrEqual(6);
      expect(b.cols).toBe(b.rows);
      expect(b.two, `第 ${round} 幅的二星线不比三星线松`).toBeGreaterThan(b.three);
      expect(b.moveLimit, `第 ${round} 幅收紧过头,连二星线都够不着`).toBeGreaterThan(b.two);
      expect(b.hints).toBeGreaterThanOrEqual(GALLERY_HINT_FLOOR);
      if (boardKind(b) === "slide") expect(b.timeLimit ?? 999).toBeGreaterThanOrEqual(120);
    }
  });

  it("同一幅两次生成还是一模一样：无尽也能比纪录", () => {
    for (const round of [7, 26, 63, 150]) {
      expect(endlessBoard(round)).toEqual(endlessBoard(round));
    }
  });
});
