import { describe, expect, it } from "vitest";
import { ARENA_H, ARENA_W, FLOOR_Y, buildVersusArena, rowSurface, type ArenaDef, type PlatformDef } from "./arena";
import {
  TUMBLE_DEPTH,
  TUMBLE_GRAVITY_SCALE,
  TUMBLE_MOVE,
  TUMBLE_TIME,
  beginTumble,
  newBounds,
  onSolidGround,
  pitAt,
  recover,
  resetBounds,
  stepTumble,
  tumbleGravity,
  tumbleProgress,
  wouldStepIntoPit,
} from "./bounds";
import {
  MOVE_SPEED,
  RESPAWN_TIME,
  createWorld,
  drainEvents,
  emptyInput,
  stepWorld,
  versusBotInput,
  type Input,
  type World,
} from "./logic";

function platform(x: number, row: number, w: number, parent: number): PlatformDef {
  return { x, y: rowSurface(row), w, row, parent };
}

function pitArena(over: Partial<ArenaDef> = {}): ArenaDef {
  return {
    kind: "versus",
    index: 0,
    chapterIndex: 0,
    name: "出界测试场",
    feature: "测试",
    hint: "测试",
    platforms: [platform(200, 1, 160, -1)],
    monsters: [],
    candies: [],
    spawns: [
      { x: 60, surface: -1 },
      { x: 580, surface: -1 },
    ],
    hearts: 0,
    parSeconds: 30,
    candyGoal: 0,
    timeLimit: 0,
    roundTarget: 3,
    gadgets: [],
    pits: [{ x0: 280, x1: 360 }],
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

describe("puff-bros 坑的几何", () => {
  it("坑里没有地板,坑外站得住", () => {
    const pits = [{ x0: 280, x1: 360 }];
    expect(pitAt(pits, 320)).toEqual(pits[0]);
    expect(pitAt(pits, 200)).toBeNull();
    expect(onSolidGround(pits, 200)).toBe(true);
    expect(onSolidGround(pits, 320)).toBe(false);
    expect(onSolidGround([], 320)).toBe(true);
    expect(wouldStepIntoPit(pits, 300)).toBe(true);
    expect(wouldStepIntoPit([], 300)).toBe(false);
  });
});

describe("puff-bros 出界两段式", () => {
  it("掉出底线先打转,不是一下子就出局", () => {
    const b = newBounds();
    expect(b.phase).toBe("in");
    beginTumble(b, ARENA_H);
    expect(b.phase).toBe("tumble");
    expect(b.tumbleT).toBe(TUMBLE_TIME);
    expect(tumbleProgress(b)).toBe(1);
    expect(stepTumble(b, 0.2, ARENA_H + 10)).toBe(false);
    expect(b.phase).toBe("tumble");
    expect(b.spin).toBeGreaterThan(0);
  });

  it("打转时重力打折、横向反而更跟手 —— 这一段是真给孩子留的自救窗口", () => {
    expect(TUMBLE_GRAVITY_SCALE).toBeLessThan(1);
    expect(tumbleGravity(1750)).toBeCloseTo(1750 * TUMBLE_GRAVITY_SCALE, 5);
    expect(TUMBLE_MOVE).toBeGreaterThan(MOVE_SPEED);
    expect(TUMBLE_TIME).toBeGreaterThan(1);
  });

  it("打转期间飘回底线以上就当没事发生", () => {
    const b = newBounds();
    beginTumble(b, ARENA_H);
    stepTumble(b, 0.3, ARENA_H + 10);
    recover(b);
    expect(b.phase).toBe("in");
    expect(b.tumbleT).toBe(0);
    expect(tumbleProgress(b)).toBe(0);
  });

  it("打转时间用完才真的出局", () => {
    const b = newBounds();
    beginTumble(b, ARENA_H);
    expect(stepTumble(b, TUMBLE_TIME - 0.05, ARENA_H + 10)).toBe(false);
    expect(stepTumble(b, 0.1, ARENA_H + 10)).toBe(true);
    expect(b.phase).toBe("out");
    resetBounds(b);
    expect(b.phase).toBe("in");
  });

  it("掉得太深也直接出局,不会一路往下掉个没完", () => {
    const b = newBounds();
    beginTumble(b, ARENA_H);
    expect(stepTumble(b, 0.05, ARENA_H + TUMBLE_DEPTH + 1)).toBe(true);
  });
});

describe("puff-bros 坑在世界里真的生效", () => {
  it("走进坑里会掉下去,先打转,还有一次自救的机会", () => {
    const w = createWorld(pitArena(), { players: 1 });
    const p = w.players[0];
    p.x = 260;
    run(w, 0.5, [press({ right: true })]);
    expect(p.bounds.phase).toBe("tumble");
    expect(p.respawnT).toBe(0);
    expect(drainEvents(w).some((e) => e.kind === "tumble")).toBe(true);
  });

  it("撑不到最后就出局:对战里回出生点重来,不掉心也不判负", () => {
    const w = createWorld(pitArena(), { players: 2 });
    const p = w.players[0];
    p.x = 300;
    p.y = ARENA_H + 10;
    p.onGround = false;
    run(w, TUMBLE_TIME + 0.2, [emptyInput(), emptyInput()]);
    expect(p.respawnT).toBeGreaterThan(0);
    expect(p.respawnT).toBeLessThanOrEqual(RESPAWN_TIME);
    expect(w.status).toBe("playing");
    run(w, RESPAWN_TIME + 0.1, [emptyInput(), emptyInput()]);
    expect(p.bounds.phase).toBe("in");
    expect(p.y).toBe(FLOOR_Y);
  });

  it("坑外的地板照样接得住人", () => {
    const w = createWorld(pitArena(), { players: 1 });
    const p = w.players[0];
    p.x = 100;
    p.y = FLOOR_Y - 100;
    p.onGround = false;
    run(w, 1, [emptyInput()]);
    expect(p.y).toBe(FLOOR_Y);
    expect(p.bounds.phase).toBe("in");
  });

  it("人机认得出坑:跨得过就跳过去,不会站在坑边发呆", () => {
    const def = buildVersusArena(0);
    expect(def.pits).toHaveLength(1);
    const w = createWorld(def, { players: 2 });
    const p = w.players[0];
    p.x = def.pits[0].x0 - 20;
    p.facing = 1;
    // 对手在坑那一头老远,人机想赶过去
    w.players[1].x = def.pits[0].x1 + 200;
    const input = versusBotInput(w, 0, "hard");
    expect(input.right).toBe(true);
    expect(input.up).toBe(true);
  });

  it("对战整场跑完,两边都不会永远卡在坑边(人机三档都分得出胜负)", () => {
    for (const level of ["easy", "normal", "hard"] as const) {
      const w = createWorld(buildVersusArena(3), { players: 2 });
      let steps = 0;
      while (w.status === "playing" && steps < 60 * 90) {
        stepWorld(w, 1 / 60, [versusBotInput(w, 0, level), versusBotInput(w, 1, level)]);
        steps++;
      }
      expect(w.status, `${level} 卡住了`).toBe("won");
      for (const p of w.players) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(ARENA_W);
      }
    }
  });
});
