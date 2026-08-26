/**
 * 冰冰火火森林 · 章节表与关卡网格的合法性巡检。
 *
 * 这一份只管「网格长得对不对」;「每一关是不是真的走得通」在 solve.test.ts 里。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf, totalSize } from "../level99";
import {
  BARRIER_HINTS,
  CHAPTERS,
  CHAPTER_NAMES,
  GUIDE,
  MAX_ATTEMPTS,
  buildGrid,
  buildHint,
  fallbackBlueprint,
  levelShape,
  type BarrierType,
} from "./levels";
import { isKnownChar, parseLevel, solveLevel } from "./logic";
import { meta } from "./meta";

/** 网格尺寸红线:再大窄屏就放不下、BFS 也会慢下来 */
const MAX_W = 17;
const MAX_H = 11;

function allGrids(): Array<{ level: number; grid: string[]; barriers: BarrierType[] }> {
  const out: Array<{ level: number; grid: string[]; barriers: BarrierType[] }> = [];
  for (let level = 0; level < TOTAL_LEVELS; level++) {
    const bp = buildGrid(level, 0);
    expect(bp, `第 ${level + 1} 关第一次尝试就该拼得出来`).not.toBeNull();
    out.push({ level, grid: bp!.grid, barriers: bp!.barriers });
  }
  return out;
}

describe("章节表", () => {
  it("八个章节,合计正好 188 关", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "ice-fire-forest")).toBe(true);
  });

  it("章节名不重复,每章都有 emoji、粉彩色和一句介绍", () => {
    expect(new Set(CHAPTER_NAMES).size).toBe(CHAPTERS.length);
    for (const ch of CHAPTERS) {
      expect(ch.size).toBeGreaterThan(0);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("每一关都落在某个章节里", () => {
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const ci = chapterOf(CHAPTERS, level);
      expect(ci).toBeGreaterThanOrEqual(0);
      expect(ci).toBeLessThan(CHAPTERS.length);
    }
  });

  it("meta 的 id 与框架存档 key 对得上", () => {
    expect(meta.id).toBe("ice-fire-forest");
    expect(meta.id).toBe(GUIDE.gameId);
    expect(meta.category).toBe("action");
    expect(meta.blurb).toContain("188");
  });
});

describe("关卡尺寸", () => {
  it("越往后越大,但不会超出窄屏放得下的上限", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const easy = levelShape(ci, 0);
      const hard = levelShape(ci, 1);
      expect(hard.sections).toBeGreaterThanOrEqual(easy.sections);
      expect(hard.height).toBeGreaterThanOrEqual(easy.height);
      for (const shape of [easy, hard]) {
        expect(shape.sections).toBeGreaterThanOrEqual(2);
        expect(shape.height % 2).toBe(1);
        const w = 1 + shape.sections * (shape.pocket + 1) + (shape.sections - 1) + 1;
        expect(w).toBeLessThanOrEqual(MAX_W);
        expect(shape.height).toBeLessThanOrEqual(MAX_H);
      }
    }
  });

  it("段数上到 4 的时候口袋会收窄", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const shape = levelShape(ci, t);
        if (shape.sections >= 4) expect(shape.pocket).toBe(2);
      }
    }
  });
});

describe("188 张网格的合法性", () => {
  const grids = allGrids();

  it("每一张都是齐整的矩形,而且四周封死", () => {
    for (const { level, grid } of grids) {
      const w = grid[0].length;
      expect(grid.length, `第 ${level + 1} 关行数`).toBeLessThanOrEqual(MAX_H);
      expect(w, `第 ${level + 1} 关列数`).toBeLessThanOrEqual(MAX_W);
      for (const row of grid) expect(row.length).toBe(w);
      expect(grid[0]).toBe("#".repeat(w));
      expect(grid[grid.length - 1]).toBe("#".repeat(w));
      for (const row of grid) {
        expect(row[0]).toBe("#");
        expect(row[w - 1]).toBe("#");
      }
    }
  });

  it("只用速查表里认得的字符", () => {
    for (const { level, grid } of grids) {
      for (const row of grid) {
        for (const ch of row) {
          expect(isKnownChar(ch), `第 ${level + 1} 关出现了「${ch}」`).toBe(true);
        }
      }
    }
  });

  it("两个出发点、两扇门,一关各一个", () => {
    for (const { level, grid } of grids) {
      const flat = grid.join("");
      for (const ch of ["L", "Y", "l", "y"]) {
        const n = flat.split(ch).length - 1;
        expect(n, `第 ${level + 1} 关的「${ch}」`).toBe(1);
      }
    }
  });

  it("解析得动,而且每关至少有一颗宝石", () => {
    for (const { level, grid } of grids) {
      const parsed = parseLevel(grid);
      expect(parsed.gems.length, `第 ${level + 1} 关的宝石`).toBeGreaterThanOrEqual(1);
      expect(parsed.gems.length).toBeLessThanOrEqual(8);
    }
  });

  it("机关组最多三组,拉杆组和踏板组不会串台", () => {
    for (const { level, grid } of grids) {
      const flat = grid.join("");
      for (const ch of ["1", "2", "3", "4", "5", "6"]) {
        expect(flat.split(ch).length - 1, `第 ${level + 1} 关的「${ch}」`).toBeLessThanOrEqual(1);
      }
      // 同一组不会既有踏板又有拉杆(通电规则会打架)
      for (let g = 0; g < 3; g++) {
        const plate = flat.includes(String(g + 1));
        const lever = flat.includes(String(g + 4));
        expect(plate && lever, `第 ${level + 1} 关第 ${g + 1} 组`).toBe(false);
      }
    }
  });

  it("闸门一定配得上它那一组的踏板或拉杆", () => {
    for (const { level, grid } of grids) {
      const flat = grid.join("");
      for (let g = 0; g < 3; g++) {
        const hasGate = flat.includes("ABC"[g]) || flat.includes("abc"[g]);
        if (!hasGate) continue;
        const hasSwitch = flat.includes(String(g + 1)) || flat.includes(String(g + 4));
        expect(hasSwitch, `第 ${level + 1} 关第 ${g + 1} 组的闸门没有开关`).toBe(true);
      }
    }
  });

  it("有光门就一定配了发射器和接收器,而且全场只有一束光", () => {
    for (const { level, grid } of grids) {
      const flat = grid.join("");
      const emitters = (flat.match(/[es]/g) ?? []).length;
      const receivers = (flat.match(/R/g) ?? []).length;
      const lightGates = (flat.match(/D/g) ?? []).length;
      if (lightGates > 0) {
        expect(emitters, `第 ${level + 1} 关`).toBe(1);
        expect(receivers, `第 ${level + 1} 关`).toBe(1);
        expect(lightGates).toBe(1);
      } else {
        expect(emitters).toBe(0);
      }
    }
  });

  it("有高坎就至少有两个托举点(两边各一个才轮得过来)", () => {
    for (const { level, grid } of grids) {
      const flat = grid.join("");
      const ledges = (flat.match(/H/g) ?? []).length;
      const pads = (flat.match(/t/g) ?? []).length;
      if (ledges > 0) expect(pads, `第 ${level + 1} 关`).toBeGreaterThanOrEqual(ledges + 1);
    }
  });

  it("同一关生成两次结果一模一样", () => {
    for (const level of [0, 7, 55, 96, 130, 187]) {
      expect(buildGrid(level, 0)?.grid).toEqual(buildGrid(level, 0)?.grid);
      expect(buildGrid(level, 1)?.grid).not.toEqual(buildGrid(level, 0)?.grid);
    }
  });
});

describe("机关的登场顺序", () => {
  const grids = allGrids();
  const typesOf = (from: number, to: number): Set<BarrierType> => {
    const set = new Set<BarrierType>();
    for (let level = from; level <= to; level++) for (const b of grids[level].barriers) set.add(b);
    return set;
  };

  it("十种屏障在 188 关里都出现过", () => {
    const all = typesOf(0, TOTAL_LEVELS - 1);
    for (const ty of Object.keys(BARRIER_HINTS) as BarrierType[]) {
      expect(all.has(ty), `${ty} 一次都没出现`).toBe(true);
    }
  });

  it("头一章只教走路,不上机关", () => {
    const first = typesOf(0, 23);
    for (const ty of first) expect(["open", "split"]).toContain(ty);
  });

  it("传送带、光束、托举各自出现在自己那一章", () => {
    expect(typesOf(72, 95).has("belt")).toBe(true);
    const mirrorHall = typesOf(119, 141);
    expect(mirrorHall.has("beamMirror") || mirrorHall.has("beamPlate")).toBe(true);
    expect(typesOf(142, 164).has("lift")).toBe(true);
  });

  it("每一种屏障都有一句给孩子看的说明", () => {
    for (const [ty, text] of Object.entries(BARRIER_HINTS)) {
      expect(text.length, ty).toBeGreaterThanOrEqual(8);
      expect(text.endsWith("。")).toBe(true);
    }
  });
});

describe("进关提示", () => {
  const grids = allGrids();

  it("每条屏障说明都短到能在手机上一两行放完", () => {
    for (const [ty, text] of Object.entries(BARRIER_HINTS)) {
      expect(text.length, `${ty} 这句太长了`).toBeLessThanOrEqual(25);
      expect(text.length).toBeGreaterThanOrEqual(8);
    }
  });

  it("同一种屏障只说一次,最多说两条", () => {
    const hint = buildHint(["plateIce", "plateIce", "lever", "belt"]);
    expect(hint).toBe(BARRIER_HINTS.lever + BARRIER_HINTS.belt);
    expect(buildHint(["open"])).toBe(BARRIER_HINTS.open);
    expect(buildHint([])).toBe("");
  });

  it("188 关的提示都控制在两句以内,虚拟按键才不会被顶下去", () => {
    // 棋盘下面这行字要是铺成三四行,焰焰那套方向键就掉出 375×667 的屏幕了
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const hint = buildHint(grids[level].barriers);
      expect(hint.length, `第 ${level + 1} 关提示太长`).toBeLessThanOrEqual(50);
      expect(hint.length, `第 ${level + 1} 关没有提示`).toBeGreaterThan(0);
    }
  });
});

describe("兜底关与攻略", () => {
  it("兜底关一定走得通", () => {
    const bp = fallbackBlueprint();
    const parsed = parseLevel(bp.grid);
    expect(solveLevel(parsed).solvable).toBe(true);
    expect(MAX_ATTEMPTS).toBeGreaterThanOrEqual(8);
  });

  it("攻略把 1 到 188 关不重不漏地盖满", () => {
    expect(GUIDE.entries.length).toBe(CHAPTERS.length);
    let expected = 1;
    for (const e of GUIDE.entries) {
      expect(e.from).toBe(expected);
      expect(e.to).toBeGreaterThanOrEqual(e.from);
      expect(e.tips.length).toBeGreaterThanOrEqual(2);
      expected = e.to + 1;
    }
    expect(expected - 1).toBe(TOTAL_LEVELS);
    expect(GUIDE.general.length).toBeGreaterThanOrEqual(4);
  });
});
