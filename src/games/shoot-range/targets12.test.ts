/**
 * 1.2 靶子体系与伪纵深的单测(规格第四节第二行、第六节)。
 * 四类新靶各自的行为、花朵靶扣分、连击倍率封顶、远排分高。
 */
import { describe, expect, it } from "vitest";
import {
  COMBO_CAP_HITS,
  COMBO_MAX_MULT,
  COMBO_STEP,
  FLOWER_PENALTY,
  FRIEND_PENALTY,
  comboMultiplier,
  foulHits,
  makeTarget,
  scoreForHit,
  starsForRound,
  type Target,
} from "./logic";
import {
  FAR_ROW_Y,
  FAR_SCORE_MUL,
  RAINBOW_MAX,
  RAINBOW_MIN,
  RAINBOW_TTL,
  SHIELD_HP,
  SPLIT_CHILDREN,
  depthRowOf,
  depthScoreMul,
  isForbidden,
  isLeavingSoon,
  makeTarget12,
  mustClear,
  rainbowScore,
  resolveHit,
  splitChildren,
  stepLifespan,
  targetDepthMul,
} from "./targets12";

const near = (kind: Target["kind"], extra: Parameters<typeof makeTarget12>[5] = {}): Target =>
  makeTarget12(1, kind, 500, 380, 40, { far: false, ...extra });

describe("shoot-range 1.2 靶 · 分裂靶", () => {
  it("打中变两个小的,小的更小、往两边弹开,而且不再分裂", () => {
    const big = near("split");
    const out = resolveHit(big, 0, 0);
    expect(out.destroyed).toBe(true);
    expect(out.spawns.length).toBe(SPLIT_CHILDREN);
    for (const kid of out.spawns) {
      expect(kid.kind).toBe("split");
      expect(kid.r).toBeLessThan(big.r);
      expect(kid.gen).toBe(1);
      expect(kid.alive).toBe(true);
    }
    expect(out.spawns[0].vx).toBeLessThan(0);
    expect(out.spawns[1].vx).toBeGreaterThan(0);
    // 小靶再打就只是倒下,不会没完没了地分家
    const again = resolveHit(out.spawns[0], 0, 0);
    expect(again.destroyed).toBe(true);
    expect(again.spawns).toEqual([]);
  });

  it("两个小靶的编号互不相同,也不会撞上原靶的 id", () => {
    const ids = new Set<number>();
    for (let seq = 0; seq < 20; seq++) {
      for (const kid of splitChildren(near("split"), seq)) {
        expect(ids.has(kid.id)).toBe(false);
        expect(kid.id).toBeGreaterThan(100);
        ids.add(kid.id);
      }
    }
    expect(ids.size).toBe(40);
  });
});

describe("shoot-range 1.2 靶 · 护盾靶", () => {
  it("第一发只敲开壳、靶子还立着,第二发才倒", () => {
    const t = near("shield");
    expect(t.hp).toBe(SHIELD_HP);
    const first = resolveHit(t, 0, 0);
    expect(first.destroyed).toBe(false);
    expect(first.target.alive).toBe(true);
    expect(first.target.hp).toBe(1);
    expect(first.counted).toBe(true);
    const second = resolveHit(first.target, 0, 0);
    expect(second.destroyed).toBe(true);
    expect(second.target.alive).toBe(false);
    // 真正的分在第二发,敲壳只给一点点
    expect(second.score).toBeGreaterThan(first.score * 2);
  });
});

describe("shoot-range 1.2 靶 · 彩虹靶", () => {
  it("限时高分:越早打中分越高,拖到最后也有保底", () => {
    expect(rainbowScore(RAINBOW_TTL)).toBe(RAINBOW_MAX);
    expect(rainbowScore(0)).toBe(RAINBOW_MIN);
    expect(rainbowScore(RAINBOW_TTL / 2)).toBeGreaterThan(RAINBOW_MIN);
    expect(rainbowScore(RAINBOW_TTL / 2)).toBeLessThan(RAINBOW_MAX);
    expect(rainbowScore(999)).toBe(RAINBOW_MAX);
    const fresh = resolveHit(near("rainbow", { ttl: RAINBOW_TTL }), 0, 0);
    const stale = resolveHit(near("rainbow", { ttl: 0.2 }), 0, 0);
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it("没打中就自己走掉,不算漏靶也不算清场指标", () => {
    let t = near("rainbow", { ttl: 1 });
    expect(mustClear(t.kind)).toBe(false);
    let gone = false;
    for (let i = 0; i < 80 && !gone; i++) {
      const step = stepLifespan(t, 1 / 60);
      t = step.target;
      gone = step.gone;
    }
    expect(gone).toBe(true);
    expect(t.alive).toBe(false);
    // 快走之前会闪一闪提醒
    expect(isLeavingSoon(near("rainbow", { ttl: 0.6 }))).toBe(true);
    expect(isLeavingSoon(near("rainbow", { ttl: 4 }))).toBe(false);
    expect(isLeavingSoon(near("bull"))).toBe(false);
  });
});

describe("shoot-range 1.2 靶 · 花朵靶", () => {
  it("打中扣分、断连击、不算命中,而且提示只劝不骂", () => {
    const out = resolveHit(near("flower"), 0, 7);
    expect(out.foul).toBe(true);
    expect(out.counted).toBe(false);
    expect(out.destroyed).toBe(false);
    expect(out.score).toBe(-FLOWER_PENALTY);
    expect(out.say).toContain("忍住");
    for (const bad of ["笨", "错", "别哭"]) expect(out.say).not.toContain(bad);
    // 扣分不受连击倍率影响:连击越高误伤越亏会劝退
    expect(resolveHit(near("flower"), 0, 0).score).toBe(resolveHit(near("flower"), 0, 10).score);
  });

  it("两种不许打的靶都不算清场指标,评星时一起算犯规", () => {
    expect(isForbidden("flower")).toBe(true);
    expect(isForbidden("friend")).toBe(true);
    expect(mustClear("flower")).toBe(false);
    expect(mustClear("friend")).toBe(false);
    expect(mustClear("split")).toBe(true);
    expect(mustClear("shield")).toBe(true);
    expect(scoreForHit("flower", 0, 40, 0)).toBe(-FLOWER_PENALTY);
    expect(scoreForHit("friend", 0, 40, 0)).toBe(-FRIEND_PENALTY);
    expect(foulHits({ shots: 9, hits: 9, remaining: 0, friendHits: 1, orderMistakes: 0, flowerHits: 2 })).toBe(3);
    // 碰了花朵靶最多一星,和好人靶一个待遇
    expect(starsForRound({ shots: 10, hits: 10, remaining: 0, friendHits: 0, orderMistakes: 0, flowerHits: 1 })).toBe(1);
    expect(starsForRound({ shots: 10, hits: 10, remaining: 0, friendHits: 0, orderMistakes: 0, flowerHits: 0 })).toBe(3);
  });
});

describe("shoot-range 1.2 连击倍率", () => {
  it("每连中一发递增、失手清零由调用方管、倍率有封顶", () => {
    expect(COMBO_STEP).toBeCloseTo(0.1, 6);
    expect(COMBO_MAX_MULT).toBeCloseTo(1 + COMBO_CAP_HITS * COMBO_STEP, 6);
    let prev = 0;
    for (let combo = 0; combo <= COMBO_CAP_HITS; combo++) {
      const m = comboMultiplier(combo);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
    // 封顶之后再连也不涨,一局定胜负这种事不会发生
    expect(comboMultiplier(COMBO_CAP_HITS)).toBeCloseTo(COMBO_MAX_MULT, 6);
    expect(comboMultiplier(COMBO_CAP_HITS + 50)).toBeCloseTo(COMBO_MAX_MULT, 6);
    // 靶子的分也跟着封顶:满连击最多是无连击的两倍
    const solo = resolveHit(near("bull"), 0, 0).score;
    expect(resolveHit(near("bull"), 0, 99).score).toBe(Math.round(solo * COMBO_MAX_MULT));
  });
});

describe("shoot-range 1.2 伪纵深", () => {
  it("上面那排算远排,远排分数 1.5 倍、半径小一圈", () => {
    expect(depthRowOf(FAR_ROW_Y - 1)).toBe("far");
    expect(depthRowOf(FAR_ROW_Y + 1)).toBe("near");
    expect(depthScoreMul("far")).toBe(FAR_SCORE_MUL);
    expect(depthScoreMul("near")).toBe(1);
    const far = makeTarget12(1, "bull", 500, 150, 40);
    const close = makeTarget12(2, "bull", 500, 400, 40);
    expect(far.far).toBe(true);
    expect(close.far).toBe(false);
    expect(far.r).toBeLessThan(close.r);
    expect(targetDepthMul(far)).toBe(FAR_SCORE_MUL);
    expect(targetDepthMul(close)).toBe(1);
    // 老靶子没有 far 字段,按 y 判定,照样吃得到这条规则
    expect(targetDepthMul(makeTarget(3, "bull", 500, 150, 40))).toBe(FAR_SCORE_MUL);
  });

  it("同一种靶,远排那个真的更值钱", () => {
    const far = resolveHit(makeTarget12(1, "bull", 500, 150, 40), 0, 0).score;
    const close = resolveHit(makeTarget12(2, "bull", 500, 400, 40), 0, 0).score;
    expect(far).toBeGreaterThan(close);
  });
});
