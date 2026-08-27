import { describe, expect, it } from "vitest";
import { FLOOR_Y, rowSurface, type ArenaDef, type PlatformDef } from "./arena";
import {
  AIR_JUMPS,
  COYOTE_TIME,
  DOUBLE_JUMP_V,
  GRAVITY,
  JUMP_BUFFER,
  JUMP_V,
  MAX_SUBSTEP,
  MOVE_SPEED,
  SQUASH_AMOUNT,
  SQUASH_MIN_VY,
  coyoteSlack,
  doubleJumpApex,
  jumpApex,
  newJumpFeel,
  noteJumpKey,
  noteLanding,
  peekJump,
  squashScale,
  substeps,
  takeJump,
  tickJumpFeel,
} from "./feel";
import { PLAYER_W, createWorld, emptyInput, stepWorld, type Input, type World } from "./logic";

function platform(x: number, row: number, w: number, parent: number): PlatformDef {
  return { x, y: rowSurface(row), w, row, parent };
}

function testArena(over: Partial<ArenaDef> = {}): ArenaDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "手感测试场",
    feature: "测试",
    hint: "测试",
    platforms: [platform(200, 1, 160, -1), platform(230, 2, 120, 0)],
    monsters: [],
    candies: [],
    spawns: [
      { x: 60, surface: -1 },
      { x: 580, surface: -1 },
    ],
    hearts: 3,
    parSeconds: 30,
    candyGoal: 1,
    timeLimit: 0,
    roundTarget: 3,
    gadgets: [],
    pits: [],
    climbRow: 0,
    ...over,
  };
}

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

function run(w: World, seconds: number, inputs: Input[] = [emptyInput()], dt = 1 / 120): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWorld(w, dt, inputs);
}

/** 把人放到 0 号浮台的右边缘上,准备走出台沿 */
function onLedge(w: World): World["players"][number] {
  const p = w.players[0];
  p.x = 200 + 160 - 4;
  p.y = rowSurface(1);
  p.surface = 0;
  p.onGround = true;
  return p;
}

describe("puff-bros 手感常量", () => {
  it("土狼时间约 90ms、跳跃缓冲约 120ms,都写成了常量", () => {
    expect(COYOTE_TIME).toBeCloseTo(0.09, 3);
    expect(JUMP_BUFFER).toBeCloseTo(0.12, 3);
    // 两个窗口都得比一帧长,不然 60fps 上等于没有
    expect(COYOTE_TIME).toBeGreaterThan(1 / 60);
    expect(JUMP_BUFFER).toBeGreaterThan(COYOTE_TIME);
    expect(AIR_JUMPS).toBe(1);
  });

  it("二段跳比地面跳矮一截,但两段加起来上得了两层", () => {
    expect(DOUBLE_JUMP_V).toBeLessThan(JUMP_V);
    expect(doubleJumpApex()).toBeLessThan(jumpApex());
    expect(jumpApex() + doubleJumpApex()).toBeGreaterThan(rowSurface(0) - rowSurface(2));
  });

  it("土狼时间折算成距离,不到半个身位就用完,不会变成「悬空乱跳」", () => {
    expect(coyoteSlack()).toBeCloseTo(MOVE_SPEED * COYOTE_TIME, 5);
    expect(coyoteSlack()).toBeLessThan(PLAYER_W);
  });

  it("重力、初速、空中控制系数都是常量,派生量算得出来", () => {
    expect(jumpApex()).toBeCloseTo((JUMP_V * JUMP_V) / (2 * GRAVITY), 5);
    expect(doubleJumpApex()).toBeCloseTo((DOUBLE_JUMP_V * DOUBLE_JUMP_V) / (2 * GRAVITY), 5);
  });
});

describe("puff-bros 跳跃状态机", () => {
  it("站着的每一帧都把土狼时间刷满,一离地就开始倒数", () => {
    const f = newJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    expect(f.coyote).toBe(COYOTE_TIME);
    tickJumpFeel(f, 0.05, false);
    expect(f.coyote).toBeCloseTo(COYOTE_TIME - 0.05, 5);
    tickJumpFeel(f, 0.05, false);
    expect(f.coyote).toBe(0);
  });

  it("只有按下沿才进缓冲,一直按着不会一直续", () => {
    const f = newJumpFeel();
    expect(noteJumpKey(f, true)).toBe(true);
    expect(f.buffer).toBe(JUMP_BUFFER);
    tickJumpFeel(f, 0.05, false);
    expect(noteJumpKey(f, true)).toBe(false);
    expect(f.buffer).toBeCloseTo(JUMP_BUFFER - 0.05, 5);
  });

  it("takeJump 结算一次就把缓冲吃掉,不会同一下按键跳两回", () => {
    const f = newJumpFeel();
    tickJumpFeel(f, 1 / 60, true);
    noteJumpKey(f, true);
    expect(peekJump(f, true)).toBe("ground");
    expect(takeJump(f, true)).toBe("ground");
    expect(takeJump(f, true)).toBeNull();
    expect(f.buffer).toBe(0);
  });

  it("空中跳只有一次,用掉就得落地才回满", () => {
    const f = newJumpFeel();
    tickJumpFeel(f, 1 / 60, false);
    noteJumpKey(f, true);
    expect(takeJump(f, false)).toBe("double");
    expect(f.airJumps).toBe(0);
    noteJumpKey(f, false);
    noteJumpKey(f, true);
    expect(takeJump(f, false)).toBeNull();
    tickJumpFeel(f, 1 / 60, true);
    expect(f.airJumps).toBe(AIR_JUMPS);
  });
});

describe("puff-bros 土狼时间与跳跃缓冲(世界里真的生效)", () => {
  it("走出台沿之后那一下跳还算数(土狼时间)", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = onLedge(w);
    run(w, 0.08, [press({ right: true })]);
    expect(p.onGround).toBe(false);
    expect(p.feel.coyote).toBeGreaterThan(0);
    stepWorld(w, 1 / 120, [press({ right: true, up: true })]);
    expect(p.vy).toBeLessThan(-600);
  });

  it("过了土狼时间再按就跳不动了,不会变成空中随便飞", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = onLedge(w);
    run(w, 0.2, [press({ right: true })]);
    expect(p.feel.coyote).toBe(0);
    p.feel.airJumps = 0;
    stepWorld(w, 1 / 120, [press({ right: true, up: true })]);
    expect(p.vy).toBeGreaterThan(0);
  });

  it("落地之前按的那一下跳会被记住,一落地就兑现(跳跃缓冲)", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = w.players[0];
    p.y = FLOOR_Y - 25;
    p.vy = 300;
    p.onGround = false;
    p.feel.airJumps = 0;
    stepWorld(w, 1 / 120, [press({ up: true })]);
    expect(p.feel.buffer).toBeGreaterThan(0);
    expect(p.vy).toBeGreaterThan(0);
    run(w, 0.09);
    expect(p.vy).toBeLessThan(-600);
  });

  it("按得太早(超出缓冲窗口)就不算,免得落地无缘无故弹起来", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = w.players[0];
    p.y = FLOOR_Y - 160;
    p.vy = 0;
    p.onGround = false;
    p.feel.airJumps = 0;
    stepWorld(w, 1 / 120, [press({ up: true })]);
    run(w, 0.6);
    expect(p.onGround).toBe(true);
    expect(p.vy).toBe(0);
  });

  it("二段跳:空中再按一下能再蹬一脚,而且只有一次", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = w.players[0];
    let peak = FLOOR_Y;
    for (let i = 0; i < 260; i++) {
      stepWorld(w, 1 / 120, [press({ up: i === 0 || i === 30 || i === 60 })]);
      peak = Math.min(peak, p.y);
    }
    expect(FLOOR_Y - peak).toBeGreaterThan(jumpApex() + doubleJumpApex() * 0.5);
    expect(p.onGround).toBe(true);
    expect(p.feel.airJumps).toBe(AIR_JUMPS);
  });
});

describe("puff-bros 帧率无关", () => {
  it("substeps 把任意 dt 切成不超过 MAX_SUBSTEP 的小步,总时长不变", () => {
    for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.1]) {
      const steps = substeps(dt);
      expect(steps.every((s) => s <= MAX_SUBSTEP + 1e-9)).toBe(true);
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(dt, 6);
    }
    // 离谱的 dt 会被截断,不会一口气推进几十秒
    expect(substeps(9).reduce((a, b) => a + b, 0)).toBeCloseTo(0.25, 6);
  });

  it("30fps 与 60fps 跑同样一秒,落点差不到 2%", () => {
    const make = (): World => createWorld(testArena(), { players: 1 });
    const hold = [press({ right: true, up: true })];
    const a = make();
    const b = make();
    for (let i = 0; i < 60; i++) stepWorld(a, 1 / 60, hold);
    for (let i = 0; i < 30; i++) stepWorld(b, 1 / 30, hold);
    const da = a.players[0].x - 60;
    const db = b.players[0].x - 60;
    expect(Math.abs(da - db) / Math.abs(da)).toBeLessThan(0.02);
    expect(Math.abs(a.players[0].y - b.players[0].y)).toBeLessThan(2);
  });

  it("连 144fps 这种切不整的帧率,一秒下来也对得上", () => {
    const make = (): World => createWorld(testArena(), { players: 1 });
    const hold = [press({ right: true, up: true })];
    const a = make();
    const c = make();
    for (let i = 0; i < 30; i++) stepWorld(a, 1 / 30, hold);
    for (let i = 0; i < 144; i++) stepWorld(c, 1 / 144, hold);
    const da = a.players[0].x - 60;
    const dc = c.players[0].x - 60;
    expect(Math.abs(da - dc) / Math.abs(da)).toBeLessThan(0.02);
  });
});

describe("puff-bros 落地压扁", () => {
  it("轻轻落地不形变,砸下来才压扁,而且不超过 8%", () => {
    const f = newJumpFeel();
    noteLanding(f, SQUASH_MIN_VY - 1);
    expect(squashScale(f)).toBe(0);
    noteLanding(f, 900);
    tickJumpFeel(f, 0.09, true);
    const s = squashScale(f);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(SQUASH_AMOUNT);
    // 一小会儿就弹回来,不会一直扁着
    tickJumpFeel(f, 0.2, true);
    expect(squashScale(f)).toBe(0);
  });

  it("从高处落回地面会记下一次压扁", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = w.players[0];
    p.y = FLOOR_Y - 220;
    p.onGround = false;
    run(w, 0.6);
    expect(p.onGround).toBe(true);
    expect(p.feel.squashPower).toBeGreaterThan(0);
  });
});
