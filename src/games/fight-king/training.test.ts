/**
 * 朵星格斗王 —— 训练场的两块纯函数。
 *
 * 训练场屏幕上那几行字（起手 / 命中 / 收招、现在第几帧、挡下与命中的帧数差、
 * 能取消成哪几招、连段几段、离陪练多远）全部由 `training.ts` 算出来，
 * 界面只负责把字符串贴上去。所以这一份测试按住的就是"孩子看到的数字对不对"。
 *
 * 假人的三种行为也在这里：站立 / 蹲防 / 随机反击，随机数由外面传进来，
 * 给定同样的骰子序列，行为必须一模一样。
 */
import { describe, expect, it } from "vitest";
import { createMatch, inputOf, type FighterState, type MatchState } from "./engine";
import { MOVE_SLOTS, METER_MAX, characterById, totalFrames, type MoveSlot } from "./frames";
import { COMBO_LIMIT, movePhase, onBlockAdvantage, onHitAdvantage } from "./rules";
import {
  COUNTER_CHANCE,
  DUMMY_HINTS,
  DUMMY_LABELS,
  DUMMY_MODES,
  PHASE_LABELS,
  cancelTargets,
  dummyInput,
  dummyIsBlocking,
  emptyContext,
  foePhaseOf,
  frameReadout,
  idleReadout,
  phaseLeftOf,
  readoutLines,
  signed,
  usableNow
} from "./training";

const HERO = characterById("lvlvdou");

function match(): MatchState {
  return createMatch("lvlvdou", "dundun", { config: { training: true, timeLimit: 0 } });
}

/** 把某一位摆成"正在出某一招的第 n 帧" */
function attacking(f: FighterState, slot: MoveSlot, frame: number): FighterState {
  f.phase = "attack";
  f.slot = slot;
  f.frame = frame;
  return f;
}

/** 掷出固定序列的骰子 */
function dice(...xs: number[]): () => number {
  let i = 0;
  return () => xs[Math.min(i++, xs.length - 1)];
}

/* ------------------------------------------------------------------ */
/* 一、帧数据读数                                                      */
/* ------------------------------------------------------------------ */

describe("训练场读数", () => {
  it("三段加上「站着没动」都有中文名，界面和读屏共用同一份", () => {
    expect(PHASE_LABELS.startup).toBe("起手");
    expect(PHASE_LABELS.active).toBe("命中");
    expect(PHASE_LABELS.recovery).toBe("收招");
    expect(PHASE_LABELS.idle).toBeTruthy();
  });

  it("没出招时也有东西看，不是一片空白", () => {
    const r = idleReadout();
    expect(r.attacking).toBe(false);
    expect(r.phase).toBe("idle");
    expect(r.cancelInto).toEqual([]);
    expect(frameReadout(HERO, null, 0)).toEqual(r);
  });

  it("报出来的 startup / active / recovery 与帧表上的数字一字不差", () => {
    for (const slot of MOVE_SLOTS) {
      const mv = HERO.moves[slot];
      const r = frameReadout(HERO, slot, 0);
      expect(r.moveName).toBe(mv.name);
      expect(r.startup).toBe(mv.startup);
      expect(r.active).toBe(mv.active);
      expect(r.recovery).toBe(mv.recovery);
      expect(r.total).toBe(totalFrames(mv));
      expect(r.onBlock).toBe(onBlockAdvantage(mv));
      expect(r.onHit).toBe(onHitAdvantage(mv));
    }
  });

  it("一帧一帧往下走，三段会按 起手 → 命中 → 收招 的顺序切过去", () => {
    const mv = HERO.moves["5H"];
    const seen: string[] = [];
    for (let f = 0; f < totalFrames(mv); f++) {
      const label = frameReadout(HERO, "5H", f).phaseLabel;
      if (seen[seen.length - 1] !== label) seen.push(label);
    }
    expect(seen).toEqual(["起手", "命中", "收招"]);
  });

  it("是纯函数：同样的输入连叫两次，结果一模一样", () => {
    const ctx = { ...emptyContext(), hitDone: true, meter: METER_MAX };
    expect(frameReadout(HERO, "5L", 3, ctx)).toEqual(frameReadout(HERO, "5L", 3, ctx));
  });

  it("本段还剩几帧：三段各自倒数，加起来正好是总帧数", () => {
    const mv = HERO.moves["5L"];
    expect(phaseLeftOf(mv, 0)).toBe(mv.startup);
    expect(phaseLeftOf(mv, mv.startup)).toBe(mv.active);
    expect(phaseLeftOf(mv, mv.startup + mv.active)).toBe(mv.recovery);
    expect(phaseLeftOf(mv, totalFrames(mv))).toBe(0);
    // 每一帧的读数都在 1..总帧数 之间，不会出现第 0 帧或者超出总帧数
    for (let f = 0; f < totalFrames(mv); f++) {
      const r = frameReadout(HERO, "5L", f);
      expect(r.frame).toBeGreaterThanOrEqual(1);
      expect(r.frame).toBeLessThanOrEqual(r.total);
      expect(r.phaseLeft).toBeGreaterThan(0);
      expect(movePhase(mv, f)).toBe(r.phase);
    }
  });

  it("帧数差写成带正负号的字符串，一眼看得出亏不亏", () => {
    expect(signed(3)).toBe("+3");
    expect(signed(0)).toBe("+0");
    expect(signed(-7)).toBe("−7");
  });

  it("五行字都在：招式帧数、现在哪一段、挡下与命中、可取消路线、连段与距离", () => {
    const r = frameReadout(HERO, "5L", 1, { ...emptyContext(), hitDone: true });
    const lines = readoutLines(r, 3, 5, 41.4);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("起手");
    expect(lines[1]).toContain("第 2 /");
    expect(lines[2]).toContain("挡下");
    expect(lines[3]).toContain("取消");
    expect(lines[4]).toContain("连段 3 段");
    expect(lines[4]).toContain("41");
    // 没出招的时候也有五行，不会塌成空白
    expect(readoutLines(idleReadout(), 0, 0, 0)).toHaveLength(5);
  });
});

/* ------------------------------------------------------------------ */
/* 二、能不能取消                                                      */
/* ------------------------------------------------------------------ */

describe("能取消成哪几招", () => {
  it("还没打中就一招都取消不了（打空了硬要接是接不上的）", () => {
    const ctx = { ...emptyContext(), meter: METER_MAX };
    expect(cancelTargets(HERO, HERO.moves["5L"], ctx)).toEqual([]);
    expect(frameReadout(HERO, "5L", 2, ctx).cancelable).toBe(false);
  });

  it("只走取消表允许的路线：轻能接重，重接不回轻", () => {
    const ctx = { ...emptyContext(), hitDone: true, meter: METER_MAX };
    const fromLight = cancelTargets(HERO, HERO.moves["5L"], ctx);
    expect(fromLight).toContain("5H");
    expect(fromLight).toContain("s1");
    const fromHeavy = cancelTargets(HERO, HERO.moves["5H"], ctx);
    expect(fromHeavy).toContain("s1");
    expect(fromHeavy).not.toContain("5L");
    expect(fromHeavy).not.toContain("2L");
  });

  it("同一段连段里用过的槽不会再被列出来", () => {
    const ctx = { ...emptyContext(), hitDone: true, used: ["5L", "5H"] as MoveSlot[], hits: 2, meter: METER_MAX };
    const targets = cancelTargets(HERO, HERO.moves["5H"], ctx);
    expect(targets).not.toContain("5H");
    expect(targets.length).toBeGreaterThan(0);
  });

  it("连段顶到上限，取消表立刻变空——上限不是摆设", () => {
    const used = ["5L", "2L", "5H", "s1", "s2", "s3"] as MoveSlot[];
    const ctx = { ...emptyContext(), hitDone: true, used, hits: COMBO_LIMIT, meter: METER_MAX };
    expect(cancelTargets(HERO, HERO.moves.s3, ctx)).toEqual([]);
    // 差一段的时候还是接得上的，说明空数组真是上限拦的
    expect(cancelTargets(HERO, HERO.moves.s2, { ...ctx, used: used.slice(0, 5), hits: COMBO_LIMIT - 1 }).length)
      .toBeGreaterThan(0);
  });

  it("能量不够就出不了超必杀，人在地上也出不了空中招", () => {
    expect(usableNow(HERO.moves.super, { ...emptyContext(), meter: 0 })).toBe(false);
    expect(usableNow(HERO.moves.super, { ...emptyContext(), meter: METER_MAX })).toBe(true);
    expect(usableNow(HERO.moves.jL, { ...emptyContext(), airborne: false })).toBe(false);
    expect(usableNow(HERO.moves.jL, { ...emptyContext(), airborne: true })).toBe(true);
    expect(usableNow(HERO.moves["5L"], { ...emptyContext(), airborne: true })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 三、三种假人                                                        */
/* ------------------------------------------------------------------ */

describe("假人", () => {
  it("三种假人都有名字和一句「拿来练什么」的说明", () => {
    expect(DUMMY_MODES).toEqual(["stand", "guard", "counter"]);
    for (const m of DUMMY_MODES) {
      expect(DUMMY_LABELS[m].length).toBeGreaterThan(0);
      expect(DUMMY_HINTS[m].length).toBeGreaterThan(6);
    }
  });

  it("站立假人一个键都不按，拿来量连段最干净", () => {
    const s = match();
    const input = dummyInput("stand", s.fighters[1], s.fighters[0], dice(0));
    expect(Object.values(input).every((v) => v === false)).toBe(true);
  });

  it("蹲防假人一直按着「远离对手」的方向 + 蹲，格挡是真的成立", () => {
    const s = match();
    const me = s.fighters[1];
    const input = dummyInput("guard", me, s.fighters[0], dice(0));
    expect(input.down).toBe(true);
    expect(dummyIsBlocking(input, me)).toBe(true);
    // 换个朝向，按的方向键也跟着换边
    me.facing = 1;
    expect(dummyIsBlocking(dummyInput("guard", me, s.fighters[0], dice(0)), me)).toBe(true);
  });

  it("反击假人：对手还在起手 / 命中就老老实实蹲防，绝不乱伸手", () => {
    const s = match();
    const foe = attacking(s.fighters[0], "5H", 0);
    expect(foePhaseOf(foe)).toBe("startup");
    // 骰子掷 0（必还手）也照样先挡住
    const onStartup = dummyInput("counter", s.fighters[1], foe, dice(0));
    expect(onStartup.light).toBe(false);
    expect(dummyIsBlocking(onStartup, s.fighters[1])).toBe(true);

    foe.frame = foe.slot ? characterById(foe.charId).moves[foe.slot].startup : 0;
    expect(foePhaseOf(foe)).toBe("active");
    expect(dummyInput("counter", s.fighters[1], foe, dice(0)).light).toBe(false);
  });

  it("反击假人：对手收招或者站着发呆时按概率还手，骰子决定结果", () => {
    const s = match();
    const foe = s.fighters[0];
    expect(foePhaseOf(foe)).toBe(null);
    expect(dummyInput("counter", s.fighters[1], foe, dice(COUNTER_CHANCE - 0.01)).light).toBe(true);
    expect(dummyInput("counter", s.fighters[1], foe, dice(COUNTER_CHANCE + 0.01)).light).toBe(false);
    expect(COUNTER_CHANCE).toBeGreaterThan(0);
    expect(COUNTER_CHANCE).toBeLessThan(1);
  });

  it("三种假人倒地都会受身爬起来，不会让练手的人干等", () => {
    const s = match();
    s.fighters[1].phase = "knockdown";
    for (const m of DUMMY_MODES) {
      expect(dummyInput(m, s.fighters[1], s.fighters[0], dice(0.99)).light).toBe(true);
    }
  });

  it("同样的骰子序列跑两遍，假人的每一帧都一模一样", () => {
    const a = match();
    const b = match();
    const seq = [0.1, 0.8, 0.3, 0.9, 0.44, 0.46];
    const one = Array.from({ length: 6 }, (_, i) =>
      dummyInput("counter", a.fighters[1], attacking(a.fighters[0], "5L", i * 3), dice(seq[i]))
    );
    const two = Array.from({ length: 6 }, (_, i) =>
      dummyInput("counter", b.fighters[1], attacking(b.fighters[0], "5L", i * 3), dice(seq[i]))
    );
    expect(one).toEqual(two);
  });
});
