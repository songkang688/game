import { describe, expect, it } from "vitest";
import { FLOOR_Y, buildVersusArena, rowSurface, type ArenaDef, type PlatformDef } from "./arena";
import { gadget } from "./gadgets";
import {
  PUFF_CD,
  PUFF_FALLOFF_MIN,
  PUFF_REACH,
  PUFF_SELF_AIR_USES,
  PUFF_WINDUP,
  PUSH_USES,
  beginPuff,
  choosePuffUse,
  newPuffState,
  noteSquish,
  objectImpulse,
  puffFalloff,
  puffReady,
  puffRing,
  releasePuff,
  ringHas,
  ringOverlaps,
  rivalImpulse,
  selfBoost,
  squishScale,
  tickPuff,
  windupProgress,
} from "./push";
import {
  PLAYER_H,
  PLAYER_W,
  createWorld,
  drainEvents,
  emptyInput,
  stepWorld,
  type Input,
  type World,
} from "./logic";

function platform(x: number, row: number, w: number, parent: number): PlatformDef {
  return { x, y: rowSurface(row), w, row, parent };
}

function testArena(over: Partial<ArenaDef> = {}): ArenaDef {
  return {
    kind: "campaign",
    index: 0,
    chapterIndex: 0,
    name: "推力测试场",
    feature: "测试",
    hint: "测试",
    platforms: [platform(200, 1, 160, -1)],
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

function run(w: World, seconds: number, inputs: Input[], dt = 1 / 120): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWorld(w, dt, inputs);
}

describe("puff-bros 气流环几何", () => {
  it("气流环画在身前,转身就换到另一边", () => {
    const right = puffRing(300, FLOOR_Y, PLAYER_H, PLAYER_W / 2, 1);
    const left = puffRing(300, FLOOR_Y, PLAYER_H, PLAYER_W / 2, -1);
    expect(right.cx).toBeGreaterThan(300);
    expect(left.cx).toBeLessThan(300);
    expect(right.x1 - right.x0).toBeCloseTo(PUFF_REACH, 5);
    expect(right.cx - 300).toBeCloseTo(300 - left.cx, 5);
  });

  it("环里的点认得出来,环外的点认不出来", () => {
    const r = puffRing(300, FLOOR_Y, PLAYER_H, PLAYER_W / 2, 1);
    expect(ringHas(r, r.cx, r.cy)).toBe(true);
    expect(ringHas(r, r.x1 + 20, r.cy)).toBe(false);
    expect(ringOverlaps(r, r.x0 - 4, r.x0 + 4, r.cy - 2, r.cy + 2)).toBe(true);
    expect(ringOverlaps(r, r.x1 + 10, r.x1 + 30, r.cy - 2, r.cy + 2)).toBe(false);
  });

  it("离得越远推得越轻,但轻不到没有", () => {
    expect(puffFalloff(0)).toBeCloseTo(1, 5);
    expect(puffFalloff(PUFF_REACH)).toBeCloseTo(PUFF_FALLOFF_MIN, 5);
    expect(puffFalloff(999)).toBeCloseTo(PUFF_FALLOFF_MIN, 5);
    expect(puffFalloff(10)).toBeGreaterThan(puffFalloff(30));
  });
});

describe("puff-bros 「噗」的三种用途", () => {
  it("正好三种用途,各有各的冷却,推自己最贵、推物件最便宜", () => {
    expect(PUSH_USES).toEqual(["self", "rival", "object"]);
    expect(PUFF_CD.self).toBeGreaterThan(PUFF_CD.rival);
    expect(PUFF_CD.rival).toBeGreaterThan(PUFF_CD.object);
    expect(PUFF_WINDUP).toBeGreaterThan(0);
  });

  it("挑用途:有物件先推物件,有对手推对手,都没有且人在空中才推自己", () => {
    const s = newPuffState();
    expect(choosePuffUse(s, { rival: true, object: true, onGround: true })).toBe("object");
    expect(choosePuffUse(s, { rival: true, object: false, onGround: true })).toBe("rival");
    expect(choosePuffUse(s, { rival: false, object: false, onGround: false })).toBe("self");
    // 站在地上又什么都没打着,这一口就白费了,干脆不放
    expect(choosePuffUse(s, { rival: false, object: false, onGround: true })).toBeNull();
  });

  it("自我加速空中只有一次,落地才回满", () => {
    const s = newPuffState();
    expect(puffReady(s, "self", true)).toBe(false);
    expect(puffReady(s, "self", false)).toBe(true);
    beginPuff(s, "self");
    tickPuff(s, PUFF_WINDUP, false);
    expect(releasePuff(s)).toBe("self");
    expect(s.selfLeft).toBe(0);
    expect(puffReady(s, "self", false)).toBe(false);
    tickPuff(s, PUFF_CD.self + 0.01, true);
    expect(s.selfLeft).toBe(PUFF_SELF_AIR_USES);
  });

  it("前摇:按下去先鼓一口气,到点了才喷出来", () => {
    const s = newPuffState();
    beginPuff(s, "rival");
    expect(windupProgress(s)).toBeCloseTo(0, 5);
    expect(releasePuff(s)).toBeNull();
    tickPuff(s, PUFF_WINDUP / 2, true);
    expect(windupProgress(s)).toBeGreaterThan(0.4);
    expect(releasePuff(s)).toBeNull();
    tickPuff(s, PUFF_WINDUP, true);
    expect(releasePuff(s)).toBe("rival");
    expect(s.cd.rival).toBe(PUFF_CD.rival);
  });

  it("冷却没走完就放不出同一种,别的种类不受牵连", () => {
    const s = newPuffState();
    beginPuff(s, "object");
    tickPuff(s, PUFF_WINDUP, true);
    releasePuff(s);
    expect(puffReady(s, "object", true)).toBe(false);
    expect(puffReady(s, "rival", true)).toBe(true);
    tickPuff(s, PUFF_CD.object + 0.01, true);
    expect(puffReady(s, "object", true)).toBe(true);
  });

  it("三种冲量的方向与衰减都对得上", () => {
    expect(selfBoost(1).vx).toBeGreaterThan(0);
    expect(selfBoost(-1).vx).toBeLessThan(0);
    expect(selfBoost(1).vy).toBeLessThan(0);
    expect(rivalImpulse(0, 1).vx).toBeGreaterThan(rivalImpulse(PUFF_REACH, 1).vx);
    expect(rivalImpulse(0, -1).vx).toBeLessThan(0);
    expect(objectImpulse(0, 1)).toBeGreaterThan(objectImpulse(PUFF_REACH, 1));
  });

  it("被吹只是扁一下再弹回来,不掉血也不受伤", () => {
    const s = newPuffState();
    noteSquish(s, 1);
    expect(squishScale(s)).toBeGreaterThan(0);
    tickPuff(s, 1, true);
    expect(squishScale(s)).toBe(0);
  });
});

describe("puff-bros 推力在世界里真的生效", () => {
  it("对着对手噗一口,把他推开、吹扁,但一颗心都不掉", () => {
    const w = createWorld(buildVersusArena(0), { players: 2 });
    w.players[0].x = 200;
    w.players[1].x = 232;
    w.players[0].facing = 1;
    stepWorld(w, 1 / 120, [press({ sub: true }), emptyInput()]);
    expect(w.players[0].puff.pending).toBe("rival");
    run(w, PUFF_WINDUP + 0.02, [emptyInput(), emptyInput()]);
    expect(w.players[1].vx).toBeGreaterThan(150);
    expect(w.players[1].puff.squish).toBeGreaterThan(0);
    expect(w.players[1].trapped).toBe(false);
    expect(w.hearts).toBe(w.startHearts);
  });

  it("合作模式里不会误伤队友:同一口气改成推自己或者推物件", () => {
    const w = createWorld(testArena(), { players: 2 });
    w.players[0].x = 200;
    w.players[1].x = 232;
    w.players[0].facing = 1;
    stepWorld(w, 1 / 120, [press({ sub: true }), emptyInput()]);
    expect(w.players[0].puff.pending).toBeNull();
    run(w, 0.3, [emptyInput(), emptyInput()]);
    expect(w.players[1].vx).toBe(0);
  });

  it("对着箱子噗一口,箱子被推走(推物件)", () => {
    const w = createWorld(
      testArena({ gadgets: [gadget("crate", 244, FLOOR_Y, { under: -1 })] }),
      { players: 1 }
    );
    w.players[0].x = 200;
    w.players[0].facing = 1;
    const before = w.gadgets[0].x;
    stepWorld(w, 1 / 120, [press({ sub: true })]);
    expect(w.players[0].puff.pending).toBe("object");
    run(w, PUFF_WINDUP + 0.3, [emptyInput()]);
    expect(w.gadgets[0].x).toBeGreaterThan(before + 20);
  });

  it("空中什么都没打着,这口气就喷给自己(自我加速)", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = w.players[0];
    p.x = 300;
    p.y = FLOOR_Y - 120;
    p.vy = 0;
    p.onGround = false;
    p.facing = 1;
    stepWorld(w, 1 / 120, [press({ sub: true })]);
    expect(p.puff.pending).toBe("self");
    run(w, PUFF_WINDUP + 0.02, [emptyInput()]);
    expect(p.vx).toBeGreaterThan(200);
    expect(p.vy).toBeLessThan(0);
    expect(drainEvents(w).some((e) => e.kind === "puff")).toBe(true);
  });

  it("空中的自我加速一趟只给一次,落地才回满", () => {
    const w = createWorld(testArena(), { players: 1 });
    const p = w.players[0];
    p.x = 300;
    p.y = FLOOR_Y - 200;
    p.onGround = false;
    p.facing = 1;
    stepWorld(w, 1 / 120, [press({ sub: true })]);
    run(w, PUFF_WINDUP + 0.02, [emptyInput()]);
    expect(p.puff.selfLeft).toBe(0);
    stepWorld(w, 1 / 120, [press({ sub: true })]);
    expect(p.puff.pending).toBeNull();
  });
});
