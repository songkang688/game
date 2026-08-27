/**
 * 跳跳台 · 台面与生成器的回归。
 *
 * 规格第十三节点名要的:完美 / 边缘 / 落空三种判定边界、一次台消失、
 * 生成器可达性抽样 ≥ 100 座。
 */
import { describe, expect, it } from "vitest";
import { PERFECT_R, REACH_MAX, REACH_MIN, powerForDistance } from "./physics";
import {
  KIND_NAMES,
  buildPads,
  leavePad,
  makePad,
  nextPad,
  onPad,
  originPad,
  padTick,
  perfectRadius,
  requiredPowerFor,
  requiredPowerRange,
  safeAmp,
  type Difficulty,
  type PadKind,
} from "./pads";
import { CHAPTER_KINDS, endlessDifficulty, levelDifficulty, matchDifficulty } from "./levels";

const STEADY = makePad({ kind: "steady", x: 0, z: 0, r: 40 });

describe("落台判定 onPad", () => {
  it("落在完美圈里算完美,落在圈上就已经算边缘了", () => {
    expect(onPad({ x: 0, z: 0 }, STEADY)).toBe("perfect");
    expect(onPad({ x: PERFECT_R - 0.01, z: 0 }, STEADY)).toBe("perfect");
    expect(onPad({ x: PERFECT_R, z: 0 }, STEADY)).toBe("edge");
  });

  it("台面内、完美圈外算边缘;正好踩在台沿上也还站得住", () => {
    expect(onPad({ x: 30, z: 0 }, STEADY)).toBe("edge");
    expect(onPad({ x: 40, z: 0 }, STEADY)).toBe("edge");
  });

  it("出了台沿一点点就是落空", () => {
    expect(onPad({ x: 40.01, z: 0 }, STEADY)).toBe("miss");
    expect(onPad({ x: 0, z: 90 }, STEADY)).toBe("miss");
  });

  it("台面被缩得很小时,完美圈跟着收窄,但仍在正中间", () => {
    const tiny = makePad({ kind: "steady", x: 0, z: 0, r: 10 });
    expect(perfectRadius(tiny)).toBeLessThan(PERFECT_R);
    expect(perfectRadius(tiny)).toBeCloseTo(6, 10);
    expect(onPad({ x: 0, z: 0 }, tiny)).toBe("perfect");
    expect(onPad({ x: 8, z: 0 }, tiny)).toBe("edge");
  });
});

describe("台面行为 padTick", () => {
  it("移动台按正弦左右滑,永远不超过振幅", () => {
    const pad = makePad({ kind: "slider", x: 0, z: 100, r: 40, amp: 20, period: 4, phase: 0 });
    expect(padTick(pad, 0).x).toBeCloseTo(0, 10);
    expect(padTick(pad, 1).x).toBeCloseTo(20, 10);
    expect(padTick(pad, 3).x).toBeCloseTo(-20, 10);
    for (let t = 0; t < 8; t += 0.13) {
      expect(Math.abs(padTick(pad, t).x)).toBeLessThanOrEqual(20 + 1e-9);
    }
    // 纵深不动
    expect(padTick(pad, 2.4).z).toBe(100);
  });

  it("缩小台随时间变小,缩到 minR 就不再缩", () => {
    const pad = makePad({ kind: "shrink", x: 0, z: 0, r: 40, shrink: 10, minR: 18, bornAt: 0 });
    expect(padTick(pad, 0).r).toBe(40);
    expect(padTick(pad, 1).r).toBe(30);
    expect(padTick(pad, 2.2).r).toBe(18);
    expect(padTick(pad, 60).r).toBe(18);
    // bornAt 之前不缩
    const later = makePad({ kind: "shrink", x: 0, z: 0, r: 40, shrink: 10, minR: 18, bornAt: 5 });
    expect(padTick(later, 3).r).toBe(40);
    expect(padTick(later, 6).r).toBe(30);
  });

  it("稳台 / 弹簧台 / 一次台不受时间影响", () => {
    for (const kind of ["steady", "spring", "once"] as PadKind[]) {
      const pad = makePad({ kind, x: 7, z: 20, r: 36 });
      expect(padTick(pad, 12.5)).toEqual(pad);
    }
  });
});

describe("一次台跳走就没了", () => {
  it("leavePad 只让一次台塌掉,别的台原样留着", () => {
    const once = makePad({ kind: "once", x: 0, z: 0, r: 40 });
    expect(once.alive).toBe(true);
    const gone = leavePad(once);
    expect(gone.alive).toBe(false);
    expect(leavePad(STEADY).alive).toBe(true);
    expect(leavePad(makePad({ kind: "spring", x: 0, z: 0, r: 40 })).alive).toBe(true);
  });

  it("塌掉的一次台再落回来一律算落空,连台心都接不住", () => {
    const gone = leavePad(makePad({ kind: "once", x: 0, z: 0, r: 40 }));
    expect(onPad({ x: 0, z: 0 }, gone)).toBe("miss");
    expect(onPad({ x: 5, z: 5 }, gone)).toBe("miss");
  });
});

/** 把一条难度配方跑一遍,逐座断言可达 */
function assertReachable(seed: number, d: Difficulty, count: number, label: string): number {
  const pads = buildPads(seed, d, count);
  let checked = 0;
  for (let i = 1; i < pads.length; i++) {
    const prev = pads[i - 1];
    const pad = pads[i];
    const range = requiredPowerRange(prev, pad, 24);
    expect(range.min, `${label} 第 ${i} 座台太近了`).toBeGreaterThanOrEqual(REACH_MIN);
    expect(range.max, `${label} 第 ${i} 座台够不着`).toBeLessThanOrEqual(REACH_MAX);
    checked++;
  }
  return checked;
}

describe("生成器 nextPad 的可达性", () => {
  it("同一个 seed + 序号,生成的台面一模一样(对战靠这个比分)", () => {
    const d = levelDifficulty(7, 0.6);
    const a = buildPads(4242, d, 30);
    const b = buildPads(4242, d, 30);
    expect(a).toEqual(b);
    expect(buildPads(4243, d, 30)).not.toEqual(a);
  });

  it("闯关每一章抽满 ≥ 100 座,所需力度全落在 0.2–0.9", () => {
    let total = 0;
    for (let ci = 0; ci < CHAPTER_KINDS.length; ci++) {
      for (const t of [0, 0.5, 1]) {
        total += assertReachable(9000 + ci * 31 + Math.round(t * 7), levelDifficulty(ci, t), 15, `第 ${ci + 1} 章`);
      }
    }
    expect(total).toBeGreaterThanOrEqual(100);
  });

  it("无尽与对战的难度曲线同样座座可达", () => {
    let total = 0;
    for (let hops = 0; hops <= 60; hops += 10) {
      total += assertReachable(7100 + hops, endlessDifficulty(hops), 12, `无尽 ${hops} 座`);
    }
    for (let round = 1; round <= 6; round++) {
      total += assertReachable(7200 + round, matchDifficulty(round), 12, `对战第 ${round} 局`);
    }
    expect(total).toBeGreaterThanOrEqual(100);
  });

  it("移动台滑到两个极端也够得着 —— 振幅按射程余量收过了", () => {
    const d = levelDifficulty(3, 1);
    const pads = buildPads(5150, d, 40);
    let sliders = 0;
    for (let i = 1; i < pads.length; i++) {
      if (pads[i].kind !== "slider") continue;
      sliders++;
      const range = requiredPowerRange(pads[i - 1], pads[i], 64);
      expect(range.min).toBeGreaterThanOrEqual(REACH_MIN);
      expect(range.max).toBeLessThanOrEqual(REACH_MAX);
      expect(range.max).toBeGreaterThan(range.min);
    }
    expect(sliders).toBeGreaterThan(3);
  });

  it("safeAmp 不会让台子滑出可达区间,想要多大都给你削回来", () => {
    const mid = (REACH_MIN + REACH_MAX) / 2;
    const dist = 60 + 200 * mid;
    expect(safeAmp(dist, 999)).toBeGreaterThan(0);
    expect(powerForDistance(dist + safeAmp(dist, 999))).toBeLessThanOrEqual(REACH_MAX);
    expect(powerForDistance(dist - safeAmp(dist, 999))).toBeGreaterThanOrEqual(REACH_MIN);
    // 贴着可达下限的台子干脆不给振幅
    expect(safeAmp(60 + 200 * REACH_MIN, 30)).toBe(0);
  });

  it("难度配方里写歪的力度区间会被夹回可达区间", () => {
    const wild: Difficulty = {
      kinds: ["steady"],
      minPower: -5,
      maxPower: 9,
      maxYaw: 3,
      minR: 40,
      maxR: 40,
      slideAmp: 0,
      minPeriod: 4,
      maxPeriod: 5,
      shrink: 0,
      minRRatio: 1,
    };
    const pads = buildPads(31, wild, 40);
    for (let i = 1; i < pads.length; i++) {
      const p = requiredPowerFor(pads[i - 1], pads[i]);
      expect(p).toBeGreaterThanOrEqual(REACH_MIN);
      expect(p).toBeLessThanOrEqual(REACH_MAX);
      // 偏航角被夹住,台子始终在前方
      expect(pads[i].z).toBeGreaterThan(pads[i - 1].z);
    }
  });

  it("第 1 章是笔直往前的稳台,一座都不歪", () => {
    const pads = buildPads(77, levelDifficulty(0, 0), 20);
    for (let i = 1; i < pads.length; i++) {
      expect(pads[i].kind).toBe("steady");
      expect(pads[i].x).toBeCloseTo(0, 10);
    }
    expect(originPad().x).toBe(0);
  });

  it("每一种台面都有中文名,界面上不会露出英文", () => {
    for (const kind of ["steady", "slider", "shrink", "spring", "once"] as PadKind[]) {
      expect(KIND_NAMES[kind].length).toBeGreaterThan(1);
    }
  });
});
