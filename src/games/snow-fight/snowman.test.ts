/**
 * 被砸中之后会怎样。
 *
 * 这一层同时是**分级红线**的守门人:被砸中不掉血、不淘汰,只是变一会儿雪人;
 * 连着三次去炉子边暖手。用例里专门有一条扫文案,不许出现输 / 死 / 血 / 伤 / 疼。
 */
import { describe, expect, it } from "vitest";
import {
  BUMP_LIMIT,
  FREEZE_TIME,
  REST_TIME,
  bump,
  bumpsLeft,
  canAct,
  freezeRatio,
  hitLine,
  makeHitState,
  tickHit,
  type HitState,
} from "./snowman";

/** 让时间往前走一段(按 1/120 秒切,和实时引擎一个步长) */
function wait(s: HitState, seconds: number): HitState {
  let out = s;
  for (let t = 0; t < seconds - 1e-9; t += 1 / 120) out = tickHit(out, 1 / 120);
  return out;
}

describe("变雪人 1.5 秒", () => {
  it("开局是自由的,被砸中就变雪人、动不了", () => {
    const s = makeHitState();
    expect(canAct(s)).toBe(true);
    const hit = bump(s);
    expect(hit.phase).toBe("snowman");
    expect(hit.timer).toBe(FREEZE_TIME);
    expect(canAct(hit)).toBe(false);
  });

  it("1.49 秒还动不了,1.51 秒抖抖雪就回场了", () => {
    const hit = bump(makeHitState());
    expect(canAct(wait(hit, FREEZE_TIME - 0.05))).toBe(false);
    const back = wait(hit, FREEZE_TIME + 0.05);
    expect(back.phase).toBe("free");
    expect(canAct(back)).toBe(true);
    // 回场了但这一轮的次数还记着
    expect(back.bumps).toBe(1);
  });

  it("已经是雪人的时候再被砸不算数——不叠加惩罚,也免得两个人对着一个雪人猛砸", () => {
    const hit = bump(makeHitState());
    const again = bump(hit);
    expect(again).toBe(hit);
    expect(again.bumps).toBe(1);
    expect(again.total).toBe(1);
  });
});

describe("连中三次去暖手", () => {
  it("第三次进 warming,歇 5 秒,而且这一轮的计数清零重新算", () => {
    let s = makeHitState();
    for (let i = 1; i < BUMP_LIMIT; i++) {
      s = bump(s);
      expect(s.phase).toBe("snowman");
      s = wait(s, FREEZE_TIME + 0.02);
    }
    s = bump(s);
    expect(s.phase).toBe("warming");
    expect(s.timer).toBe(REST_TIME);
    expect(s.bumps).toBe(0);
    expect(s.total).toBe(BUMP_LIMIT);
  });

  it("暖手 5 秒之后精神抖擞地回场,再挨三次才会又去暖手", () => {
    let s = makeHitState();
    for (let i = 0; i < BUMP_LIMIT; i++) {
      s = bump(s);
      s = wait(s, REST_TIME + 0.02);
    }
    expect(s.phase).toBe("free");
    expect(s.bumps).toBe(0);
    expect(bumpsLeft(s)).toBe(BUMP_LIMIT);
    s = bump(s);
    expect(s.phase).toBe("snowman");
  });

  it("`total` 只涨不清零,是给结算文案数数用的", () => {
    let s = makeHitState();
    for (let i = 0; i < 5; i++) {
      s = bump(s);
      s = wait(s, REST_TIME + 0.02);
    }
    expect(s.total).toBe(5);
  });
});

describe("HUD 要的两个读数", () => {
  it("倒计时圈从满到空,自由状态一直是 0", () => {
    const hit = bump(makeHitState());
    expect(freezeRatio(hit)).toBeCloseTo(1, 6);
    expect(freezeRatio(wait(hit, FREEZE_TIME * 0.5))).toBeLessThan(0.6);
    expect(freezeRatio(makeHitState())).toBe(0);
    // 攒到「再挨一下就要去暖手」的状态,那一下之后倒计时圈按 5 秒算
    const rest = bump({ ...makeHitState(), bumps: BUMP_LIMIT - 1 });
    expect(rest.phase).toBe("warming");
    expect(freezeRatio(rest)).toBeCloseTo(1, 6);
    expect(freezeRatio(wait(rest, REST_TIME * 0.5))).toBeLessThan(0.6);
  });

  it("还差几次去暖手,数得出来", () => {
    expect(bumpsLeft(makeHitState())).toBe(BUMP_LIMIT);
    expect(bumpsLeft(bump(makeHitState()))).toBe(BUMP_LIMIT - 1);
  });
});

describe("分级红线", () => {
  it("三句提示只鼓励,不出现输 / 死 / 血 / 伤 / 疼", () => {
    const lines = [
      hitLine(makeHitState(), "鸭梨"),
      hitLine(bump(makeHitState()), "鸭梨"),
      hitLine({ phase: "warming", timer: REST_TIME, bumps: 0, total: 3 }, "康康"),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/死|血|伤|疼|痛|杀|淘汰|失败|输了/);
      expect(line.length).toBeGreaterThan(4);
    }
    expect(lines[1]).toContain("雪人");
    expect(lines[2]).toContain("暖");
  });
});
