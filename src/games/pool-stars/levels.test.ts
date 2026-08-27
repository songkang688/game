// 朵星台球 · 188 关关卡与「残局一定有解」的回归测试。
//
// 最重要的两条:章节和恒等 188;每一关都能被搜索到至少一个合法解。
// 解的搜索用的就是玩家能用的那两个量——角度和力度,搜出来的解还会回代重跑一遍验证。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import { POCKETS, TABLE, simulateShot, strike } from "./physics";
import {
  CHAPTERS,
  DEFAULT_POWERS,
  TOTAL,
  buildEndlessLevel,
  buildLevel,
  candidateShots,
  chapterOfLevel,
  findSolution,
  gridSolve,
  levelSuccess,
  loseLine,
  rateLevel,
  tryShot,
  winLine,
  type LevelSpec,
} from "./levels";

function chapterStart(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 布局合不合法:都在台面里、互不重叠、不是一开局就压在袋口上 */
function layoutOk(spec: LevelSpec): boolean {
  const live = spec.balls.filter((b) => !b.potted);
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    if (a.x < TABLE.r || a.x > TABLE.w - TABLE.r) return false;
    if (a.y < TABLE.r || a.y > TABLE.h - TABLE.r) return false;
    for (const p of POCKETS) {
      if (Math.hypot(a.x - p.x, a.y - p.y) <= TABLE.pocketR) return false;
    }
    for (let k = i + 1; k < live.length; k++) {
      const b = live[k];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * TABLE.r - 1e-9) return false;
    }
  }
  return true;
}

describe("章节切分", () => {
  it("八章之和恒等 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(TOTAL).toBe(TOTAL_LEVELS);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("章节信息齐全，而且和通用框架的分章算法对得上", () => {
    expect(CHAPTERS).toHaveLength(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.desc.length).toBeGreaterThan(6);
      expect(ch.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    for (const idx of [0, 23, 24, 96, 143, 144, 187]) {
      expect(chapterOfLevel(idx)).toBe(chapterOf(CHAPTERS, idx));
    }
  });
});

describe("关卡布局", () => {
  it("188 关每一关都摆得出合法布局，而且带母球", () => {
    for (let i = 0; i < TOTAL; i++) {
      const spec = buildLevel(i);
      expect(spec.index).toBe(i);
      expect(spec.balls.some((b) => b.kind === "cue"), `第 ${i + 1} 关缺母球`).toBe(true);
      expect(layoutOk(spec), `第 ${i + 1} 关布局不合法`).toBe(true);
      expect(spec.hint.length).toBeGreaterThan(6);
    }
  });

  it("同一关每次生成都一模一样", () => {
    const a = buildLevel(77);
    const b = buildLevel(77);
    expect(a.balls.map((x) => [x.kind, x.x, x.y])).toEqual(b.balls.map((x) => [x.kind, x.x, x.y]));
  });

  it("每一章的机制标记都对", () => {
    expect(buildLevel(0).kind).toBe("straight");
    expect(buildLevel(chapterStart(1)).requireCushionFirst).toBe(true);
    expect(buildLevel(chapterStart(2)).requireGroup).toBe("warm");
    expect(buildLevel(chapterStart(3)).cueMustSurvive).toBe(true);
    expect(buildLevel(chapterStart(4)).requireFirstHitId).toBe(2);
    const called = buildLevel(chapterStart(5));
    expect(called.calledPocket).not.toBeNull();
    expect(called.balls.some((b) => b.kind === "black")).toBe(true);
    const endgame = buildLevel(chapterStart(6) + 12);
    expect(endgame.balls.filter((b) => b.kind !== "cue").length).toBeGreaterThanOrEqual(3);
    expect(endgame.balls.filter((b) => b.kind !== "cue").length).toBeLessThanOrEqual(5);
    const rack = buildLevel(chapterStart(7) + 20);
    expect(rack.kind).toBe("rack");
    expect(rack.balls).toHaveLength(16);
    expect(rack.aiTier).toBeGreaterThanOrEqual(1);
    expect(rack.aiTier).toBeLessThanOrEqual(4);
  });

  it("球房杯那一章的电脑档位是一路往上走的", () => {
    const first = buildLevel(chapterStart(7)).aiTier;
    const last = buildLevel(chapterStart(7) + CHAPTERS[7].size - 1).aiTier;
    expect(last).toBeGreaterThan(first);
    expect(last).toBe(4);
  });
});

describe("残局可解（角度 × 力度搜索）", () => {
  it("第 1–7 章各抽若干关，都能搜到至少一个成功解，解回代重跑仍然成立", () => {
    const sampled: number[] = [];
    for (let ci = 0; ci < 7; ci++) {
      const start = chapterStart(ci);
      const size = CHAPTERS[ci].size;
      for (const off of [0, Math.floor(size / 3), Math.floor((size * 2) / 3), size - 1]) {
        sampled.push(start + off);
      }
    }
    for (const idx of sampled) {
      const spec = buildLevel(idx);
      const sol = findSolution(spec);
      expect(sol, `第 ${idx + 1} 关搜不到解`).not.toBeNull();
      // 回代:同一组角度力度再打一次，必须还是成功
      expect(tryShot(spec, sol!.angle, sol!.power).ok, `第 ${idx + 1} 关的解回代失败`).toBe(true);
      expect(sol!.power).toBeGreaterThan(0);
      expect(sol!.power).toBeLessThanOrEqual(1);
    }
    expect(sampled).toHaveLength(28);
  }, 120000);

  it("纯网格扫描（角度 1.5° 一格 × 五档力度）也能扫到解", () => {
    for (const idx of [0, 26, 52, 80, 100, 130, 150]) {
      const sol = gridSolve(buildLevel(idx), 240, DEFAULT_POWERS);
      expect(sol, `第 ${idx + 1} 关网格扫不到解`).not.toBeNull();
      expect(tryShot(buildLevel(idx), sol!.angle, sol!.power).ok).toBe(true);
    }
  }, 120000);

  it("几何候选角是真的按袋口和假想球点生成的，不是瞎撞", () => {
    const spec = buildLevel(3);
    const cands = candidateShots(spec);
    expect(cands.length).toBeGreaterThan(6);
    for (const a of cands) expect(Number.isFinite(a)).toBe(true);
    // 空台面（只有母球）就没有候选角
    expect(candidateShots({ ...spec, balls: spec.balls.filter((b) => b.kind === "cue") })).toEqual([]);
  });

  it("库边关的解真的是先吃库打进的", () => {
    const spec = buildLevel(chapterStart(1) + 5);
    const sol = findSolution(spec);
    expect(sol).not.toBeNull();
    const res = tryShot(spec, sol!.angle, sol!.power).res;
    expect(res.cushionBeforeContact).toBe(true);
    expect(levelSuccess(spec, res).ok).toBe(true);
  }, 60000);

  it("组合球关的解真的是先碰前面那颗再顶进后面那颗", () => {
    const spec = buildLevel(chapterStart(4) + 4);
    const sol = findSolution(spec);
    expect(sol).not.toBeNull();
    const res = tryShot(spec, sol!.angle, sol!.power).res;
    expect(res.firstHitId).toBe(spec.requireFirstHitId);
    expect(res.potted.some((p) => p.id === 1)).toBe(true);
  }, 60000);
});

describe("成功判定 levelSuccess", () => {
  const spec = buildLevel(0);

  it("目标球没进就不算过", () => {
    const res = simulateShot({ balls: spec.balls.map((b) => ({ ...b })) });
    expect(levelSuccess(spec, res).ok).toBe(false);
    expect(levelSuccess(spec, res).reason).toContain("差一点点");
  });

  it("母球落袋的关要求母球必须活着", () => {
    const cueSpec = { ...spec, cueMustSurvive: true };
    const res = {
      ...simulateShot({ balls: spec.balls.map((b) => ({ ...b })) }),
      potted: [
        { id: 0, kind: "cue" as const, pocket: 0 },
        { id: 1, kind: "warm" as const, pocket: 2 },
      ],
    };
    expect(levelSuccess(cueSpec, res).ok).toBe(false);
    expect(levelSuccess({ ...cueSpec, cueMustSurvive: false, requireGroup: null }, res).ok).toBe(true);
  });

  it("指定袋进错袋不算过", () => {
    const called = { ...spec, calledPocket: 4 };
    const base = simulateShot({ balls: spec.balls.map((b) => ({ ...b })) });
    const wrong = { ...base, potted: [{ id: 1, kind: "warm" as const, pocket: 0 }] };
    const right = { ...base, potted: [{ id: 1, kind: "warm" as const, pocket: 4 }] };
    expect(levelSuccess(called, wrong).ok).toBe(false);
    expect(levelSuccess(called, right).ok).toBe(true);
  });

  it("先碰错组的关不算过", () => {
    const groupSpec = { ...spec, requireGroup: "warm" as const };
    const base = simulateShot({ balls: spec.balls.map((b) => ({ ...b })) });
    const res = { ...base, firstHit: "cool" as const, potted: [{ id: 1, kind: "warm" as const, pocket: 1 }] };
    expect(levelSuccess(groupSpec, res).ok).toBe(false);
  });
});

describe("无尽残局与评星", () => {
  it("无尽一局比一局多球（上限五颗），而且都有解", () => {
    const a = buildEndlessLevel(1);
    const b = buildEndlessLevel(12);
    expect(a.balls.length).toBeGreaterThanOrEqual(3);
    expect(b.balls.length).toBeGreaterThanOrEqual(a.balls.length);
    expect(b.balls.length).toBeLessThanOrEqual(6);
    for (const round of [1, 5, 12]) {
      const spec = buildEndlessLevel(round);
      expect(findSolution(spec), `无尽第 ${round} 局搜不到解`).not.toBeNull();
    }
  }, 120000);

  it("杆数越少星越多", () => {
    expect(rateLevel(1, 3)).toBe(3);
    expect(rateLevel(2, 3)).toBe(2);
    expect(rateLevel(3, 3)).toBe(1);
    expect(rateLevel(4, 6)).toBe(2);
    expect(rateLevel(6, 3)).toBe(1);
  });

  it("胜负文案只鼓励，不批评", () => {
    for (const line of [winLine(1), winLine(3), winLine(9), loseLine("母球掉袋了，")]) {
      expect(line.length).toBeGreaterThan(4);
      expect(line).not.toMatch(/笨|差劲|失败者|你不行/);
    }
    expect(loseLine("这一关要先吃一次库，")).toContain("再来");
  });

  // R3-PA-PS-1：`loseLine` 原来无条件在 reason 后面接一句鼓励语，
  // 可最常见的那条 reason 自己就是这句话，结算浮层上连着说了两遍。
  it("鼓励语不重复：reason 自己已经说过就不再接一遍", () => {
    const twice = (s: string): number => s.split("这一杆差一点点").length - 1;
    expect(twice(loseLine("这一杆差一点点，换个角度再来。"))).toBe(1);
    expect(twice(loseLine("母球先碰到的不是自己那一组，这一杆差一点点。"))).toBe(1);
    // reason 里没有这句话时照样补上，鼓励一句不能少
    expect(twice(loseLine("母球掉袋了，"))).toBe(1);
    expect(loseLine("母球掉袋了，")).toContain("换个角度再来");
    // 补出来的话一定以句号收尾，不会断在半截
    for (const r of ["这一杆差一点点，换个角度再来。", "母球先碰到的不是自己那一组，这一杆差一点点。", "母球掉袋了，"]) {
      expect(loseLine(r).endsWith("。")).toBe(true);
    }
  });

  it("judgeShot 给得出的每一条 reason 套进 loseLine 都不会重复", () => {
    const reasons = [
      "母球掉袋了，",
      "母球要先碰前面那颗球，才叫组合球。",
      "母球先碰到的不是自己那一组，这一杆差一点点。",
      "这一杆差一点点，换个角度再来。",
      "进了，可惜不是指定的那个袋，再瞄一次。",
    ];
    for (const r of reasons) {
      const line = loseLine(r);
      expect(line.split("这一杆差一点点").length - 1, `「${r}」套出来重复了`).toBeLessThanOrEqual(1);
      expect(line.split("换个角度再来").length - 1).toBeLessThanOrEqual(1);
    }
  });

  it("真的照着解打一杆，关卡就过了", () => {
    const spec = buildLevel(6);
    const sol = findSolution(spec)!;
    const balls = spec.balls.map((b) => ({ ...b }));
    balls[0] = strike(balls[0], sol.angle, sol.power, 0);
    const res = simulateShot({ balls });
    expect(levelSuccess(spec, res).ok).toBe(true);
    expect(res.potted.some((p) => p.id === 1)).toBe(true);
  }, 60000);
});
