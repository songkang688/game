import { describe, expect, it } from "vitest";
import { ARENA_W, FLOOR_Y, WALL, rowSurface, type ArenaDef, type PlatformDef } from "./arena";
import {
  BRITTLE_CRACKS,
  BRITTLE_REGROW,
  GADGET_BLURB,
  GADGET_KINDS,
  SPRING_MIN_VY,
  SPRING_V,
  UPDRAFT_MAX_UP,
  WARP_CD,
  bounceOffSpring,
  brittlePhase,
  brittleSolid,
  gadget,
  gadgetRect,
  inUpdraft,
  newGadget,
  noteWarp,
  onWarp,
  shoveCrate,
  springApex,
  springReady,
  stepCrate,
  stepOnBrittle,
  tickGadget,
  updraftVy,
  warpPartner,
} from "./gadgets";
import {
  GRAVITY,
  PLAYER_H,
  createWorld,
  doubleJumpApex,
  emptyInput,
  jumpApex,
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
    name: "机关测试场",
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

function run(w: World, seconds: number, inputs: Input[] = [emptyInput()], dt = 1 / 120): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWorld(w, dt, inputs);
}

describe("puff-bros 机关清单", () => {
  it("正好五种机关,每一种都有一句给孩子看的人话", () => {
    expect(GADGET_KINDS).toEqual(["updraft", "crate", "brittle", "spring", "warp"]);
    expect(GADGET_KINDS.length).toBeGreaterThanOrEqual(5);
    for (const kind of GADGET_KINDS) {
      expect(GADGET_BLURB[kind].length).toBeGreaterThanOrEqual(12);
      for (const bad of ["笨", "蠢", "死", "血"]) expect(GADGET_BLURB[kind].includes(bad)).toBe(false);
    }
  });

  it("每一种都有自己的默认尺寸,包围盒算得出来", () => {
    for (const kind of GADGET_KINDS) {
      const g = newGadget(gadget(kind, 300, FLOOR_Y));
      const r = gadgetRect(g);
      expect(r.x1 - r.x0).toBeGreaterThan(0);
      expect(r.y1 - r.y0).toBeGreaterThan(0);
    }
  });
});

describe("puff-bros 气流管", () => {
  it("管子里的人被托着往上飘,而且飘得再快也封顶", () => {
    let vy = 400;
    for (let i = 0; i < 60; i++) vy = updraftVy(vy, 1 / 120);
    expect(vy).toBe(-UPDRAFT_MAX_UP);
  });

  it("管口之内认得出人,管口之外认不出", () => {
    const g = newGadget(gadget("updraft", 300, FLOOR_Y));
    expect(inUpdraft(g, 300, FLOOR_Y - 40)).toBe(true);
    expect(inUpdraft(g, 300, FLOOR_Y - 400)).toBe(false);
    expect(inUpdraft(g, 500, FLOOR_Y - 40)).toBe(false);
  });

  it("世界里:掉进管子里就一直被托着,落不到地上", () => {
    const withTube = createWorld(
      testArena({ gadgets: [gadget("updraft", 300, FLOOR_Y, { under: -1 })] }),
      { players: 1 }
    );
    const bare = createWorld(testArena(), { players: 1 });
    for (const w of [withTube, bare]) {
      const p = w.players[0];
      p.x = 300;
      p.y = FLOOR_Y - 120;
      p.vy = 0;
      p.onGround = false;
    }
    run(withTube, 1.5);
    run(bare, 1.5);
    // 没有管子的那位早就落地了,管子里的这位还浮着
    expect(bare.players[0].onGround).toBe(true);
    expect(withTube.players[0].onGround).toBe(false);
    expect(FLOOR_Y - withTube.players[0].y).toBeGreaterThan(60);
  });

  it("站在地上的人不会被管子无缘无故吹起来", () => {
    const w = createWorld(
      testArena({ gadgets: [gadget("updraft", 300, FLOOR_Y, { under: -1 })] }),
      { players: 1 }
    );
    const p = w.players[0];
    p.x = 300;
    p.y = FLOOR_Y;
    p.onGround = true;
    run(w, 1);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(FLOOR_Y);
  });
});

describe("puff-bros 可推箱", () => {
  it("顶一下会慢慢滑,滑一会儿自己停下来", () => {
    const g = newGadget(gadget("crate", 300, FLOOR_Y));
    shoveCrate(g, 1);
    expect(g.vx).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) stepCrate(g, 1 / 120, FLOOR_Y, WALL + 15, ARENA_W - WALL - 15);
    expect(g.x).toBeGreaterThan(300);
    expect(g.vx).toBe(0);
  });

  it("箱子会掉,落到脚下那块地面就停住;撞到墙也停", () => {
    const g = newGadget(gadget("crate", 300, FLOOR_Y - 120));
    for (let i = 0; i < 120; i++) stepCrate(g, 1 / 120, FLOOR_Y, WALL + 15, ARENA_W - WALL - 15);
    expect(g.y).toBe(FLOOR_Y);
    g.vx = 900;
    for (let i = 0; i < 240; i++) stepCrate(g, 1 / 120, FLOOR_Y, WALL + 15, ARENA_W - WALL - 15);
    expect(g.x).toBeLessThanOrEqual(ARENA_W - WALL - 15);
  });

  it("世界里:走过去顶得动,而且箱子不挡路", () => {
    const w = createWorld(
      testArena({ gadgets: [gadget("crate", 200, FLOOR_Y, { under: -1 })] }),
      { players: 1 }
    );
    const p = w.players[0];
    p.x = 150;
    const before = w.gadgets[0].x;
    run(w, 0.6, [press({ right: true })]);
    expect(w.gadgets[0].x).toBeGreaterThan(before);
    expect(p.x).toBeGreaterThan(150);
  });
});

describe("puff-bros 脆弱地板", () => {
  it("踩第一下先裂出纹路当预警,再踩才碎", () => {
    const g = newGadget(gadget("brittle", 300, FLOOR_Y - 44));
    expect(brittlePhase(g)).toBe("solid");
    expect(stepOnBrittle(g)).toBe(false);
    expect(brittlePhase(g)).toBe("cracked");
    expect(g.cracks).toBe(BRITTLE_CRACKS - 1);
    expect(stepOnBrittle(g)).toBe(true);
    expect(brittlePhase(g)).toBe("gone");
    expect(brittleSolid(g)).toBe(false);
  });

  it("碎掉之后过一会儿会长回来,回头路不会断", () => {
    const g = newGadget(gadget("brittle", 300, FLOOR_Y - 44));
    stepOnBrittle(g);
    stepOnBrittle(g);
    expect(g.regrow).toBeCloseTo(BRITTLE_REGROW, 5);
    tickGadget(g, BRITTLE_REGROW + 0.01);
    expect(brittleSolid(g)).toBe(true);
    expect(brittlePhase(g)).toBe("solid");
  });

  it("世界里:跳上去两次就把它踩碎,人落回下面那层", () => {
    const w = createWorld(
      testArena({ gadgets: [gadget("brittle", 60, FLOOR_Y - 44, { under: -1 })] }),
      { players: 1 }
    );
    const p = w.players[0];
    const slab = w.gadgets[0];
    for (let round = 0; round < 2; round++) {
      p.x = 60;
      p.y = FLOOR_Y - 120;
      p.vy = 0;
      p.onGround = false;
      p.feel.airJumps = 0;
      run(w, 0.5);
    }
    expect(slab.regrow).toBeGreaterThan(0);
    run(w, 0.6);
    expect(p.y).toBe(FLOOR_Y);
  });
});

describe("puff-bros 弹簧云", () => {
  it("弹得比二段跳还高一截,不然它就白摆了", () => {
    expect(springApex(GRAVITY)).toBeGreaterThan(jumpApex() + doubleJumpApex());
  });

  it("落得够快才弹得起来,走过去只是站在云上", () => {
    const g = newGadget(gadget("spring", 300, FLOOR_Y));
    expect(springReady(g, 10)).toBe(false);
    expect(springReady(g, SPRING_MIN_VY)).toBe(true);
    expect(bounceOffSpring(g)).toBe(-SPRING_V);
    expect(springReady(g, 900)).toBe(false);
    tickGadget(g, 1);
    expect(springReady(g, 900)).toBe(true);
  });

  it("世界里:从高处落到云上会被弹得比一次起跳还高", () => {
    const w = createWorld(
      testArena({ gadgets: [gadget("spring", 100, FLOOR_Y, { under: -1 })] }),
      { players: 1 }
    );
    const p = w.players[0];
    p.x = 100;
    p.y = FLOOR_Y - 140;
    p.vy = 0;
    p.onGround = false;
    p.feel.airJumps = 0;
    let peak = FLOOR_Y;
    for (let i = 0; i < 240; i++) {
      stepWorld(w, 1 / 120, [emptyInput()]);
      peak = Math.min(peak, p.y);
    }
    expect(FLOOR_Y - peak).toBeGreaterThan(jumpApex() * 1.4);
  });
});

describe("puff-bros 传送泡", () => {
  it("配对的两颗互相认得,没配对的返回 null", () => {
    const list = [
      newGadget(gadget("warp", 100, FLOOR_Y, { link: 1 })),
      newGadget(gadget("warp", 500, FLOOR_Y, { link: 0 })),
      newGadget(gadget("warp", 300, FLOOR_Y, { link: -1 })),
    ];
    expect(warpPartner(list, 0)).toBe(list[1]);
    expect(warpPartner(list, 1)).toBe(list[0]);
    expect(warpPartner(list, 2)).toBeNull();
    expect(onWarp(list[0], 100, FLOOR_Y)).toBe(true);
    expect(onWarp(list[0], 200, FLOOR_Y)).toBe(false);
    noteWarp(list[0], list[1], 0);
    expect(list[0].warpCd[0]).toBe(WARP_CD);
    expect(list[1].warpCd[0]).toBe(WARP_CD);
  });

  it("世界里:站在泡上按 ⬇ 就飞到另一头,而且不会来回弹", () => {
    const w = createWorld(
      testArena({
        gadgets: [
          gadget("warp", 100, FLOOR_Y, { under: -1, link: 1 }),
          gadget("warp", 500, FLOOR_Y, { under: -1, link: 0 }),
        ],
      }),
      { players: 1 }
    );
    const p = w.players[0];
    p.x = 100;
    stepWorld(w, 1 / 120, [press({ down: true })]);
    expect(p.x).toBe(500);
    // 冷却里再按也不会立刻传回去
    stepWorld(w, 1 / 120, [emptyInput()]);
    stepWorld(w, 1 / 120, [press({ down: true })]);
    expect(p.x).toBe(500);
  });
});

describe("puff-bros 五种机关在一张图上一起工作", () => {
  it("同一张图里五种机关都能生成、都能推进,互不打架", () => {
    const gadgets = [
      gadget("updraft", 120, FLOOR_Y, { under: -1 }),
      gadget("crate", 220, FLOOR_Y, { under: -1 }),
      gadget("brittle", 320, FLOOR_Y - 44, { under: -1 }),
      gadget("spring", 420, FLOOR_Y, { under: -1 }),
      gadget("warp", 520, FLOOR_Y, { under: -1, link: 5 }),
      gadget("warp", 580, FLOOR_Y, { under: -1, link: 4 }),
    ];
    const w = createWorld(testArena({ gadgets }), { players: 1 });
    expect(w.gadgets).toHaveLength(6);
    run(w, 4, [press({ right: true, sub: true })]);
    expect(w.status).toBe("playing");
    expect(w.players[0].y).toBeLessThanOrEqual(FLOOR_Y);
    expect(w.players[0].y - PLAYER_H).toBeGreaterThan(0);
    for (const g of w.gadgets) {
      expect(Number.isFinite(g.x)).toBe(true);
      expect(Number.isFinite(g.y)).toBe(true);
    }
  });
});
