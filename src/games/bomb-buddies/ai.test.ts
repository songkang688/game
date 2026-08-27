import { describe, expect, it } from "vitest";
import {
  AI_LABEL,
  SAFETY_MS,
  alertLevel,
  bricksHit,
  chooseAiAction,
  dangerCells,
  dangerTiming,
  dirBetween,
  distanceToFoe,
  escapeAfterBomb,
  findEscape,
  seek,
  shrinkDelay,
  shrinkRing,
  timeToBurn,
  wouldCatch,
  type AiLevel,
} from "./ai";
import { buildArena, buildEndlessRound, pillarBoard } from "./levels";
import {
  DIR_RIGHT,
  FUSE_MS,
  TILE_FLOOR,
  TILE_HARD,
  TILE_SOFT,
  applyItem,
  createWorld,
  dropBomb,
  idx,
  makeBoard,
  makeFighter,
  stepMsFor,
  stepWorld,
  type Bomb,
  type Intent,
  type World,
} from "./logic";

function parse(rows: string[]): ReturnType<typeof makeBoard> {
  const h = rows.length;
  const w = rows[0].length;
  const board = makeBoard(w, h, TILE_FLOOR);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      board.cells[idx(board, x, y)] = ch === "#" ? TILE_HARD : ch === "+" ? TILE_SOFT : TILE_FLOOR;
    });
  });
  return board;
}

function soloWorld(rows: string[], at: [number, number], power = 2): World {
  const board = parse(rows);
  const me = makeFighter(0, "鸭梨", "🍐", idx(board, at[0], at[1]));
  me.power = power;
  return createWorld({ board, fighters: [me], seed: 5, richness: 0 });
}

function bombOf(pos: number, power: number, fuse = FUSE_MS, id = 1): Bomb {
  return { id, pos, owner: 0, power, fuse, remote: false, slide: -1, slideT: 0 };
}

// ---------------------------------------------------------------------------
// 危险时刻表
// ---------------------------------------------------------------------------

describe("危险时刻表(纯函数)", () => {
  it("没有炸弹时表是空的,任何格子都安全", () => {
    const board = parse(["#####", "#...#", "#####"]);
    expect(dangerTiming(board, []).size).toBe(0);
  });

  it("表里记的是「最早什么时候着火」", () => {
    const board = parse(["#######", "#.....#", "#######"]);
    const timing = dangerTiming(board, [bombOf(idx(board, 1, 1), 2, 1200)]);
    expect(timing.get(idx(board, 1, 1))).toBe(1200);
    expect(timing.get(idx(board, 3, 1))).toBe(1200);
    expect(timing.has(idx(board, 4, 1))).toBe(false);
  });

  it("连锁的炸弹按「先炸的那一刻」一起算,远处那颗旁边也算危险", () => {
    const board = parse(["#########", "#.......#", "#########"]);
    const early = bombOf(idx(board, 1, 1), 2, 400, 1);
    const late = { ...bombOf(idx(board, 3, 1), 2, 3000, 2) };
    const timing = dangerTiming(board, [early, late]);
    expect(timing.get(idx(board, 5, 1))).toBe(400);
  });

  it("timeToBurn:正在烧的格子是 0,安全格是无穷大", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1], 2);
    world.bombs.push(bombOf(idx(world.board, 1, 1), 2, 900));
    expect(timeToBurn(world, idx(world.board, 1, 1))).toBe(900);
    expect(timeToBurn(world, idx(world.board, 5, 1))).toBe(Infinity);
    world.flames.set(idx(world.board, 5, 1), 200);
    expect(timeToBurn(world, idx(world.board, 5, 1))).toBe(0);
  });

  it("dangerCells 把正在烧的和马上要烧的都算进去", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1], 2);
    world.bombs.push(bombOf(idx(world.board, 1, 1), 1, 800));
    world.flames.set(idx(world.board, 5, 1), 200);
    const cells = dangerCells(world);
    expect(cells.has(idx(world.board, 2, 1))).toBe(true);
    expect(cells.has(idx(world.board, 5, 1))).toBe(true);
    expect(cells.has(idx(world.board, 4, 1))).toBe(false);
  });

  it("告警等级:快炸了是 2,还早是 1,不炸是 0", () => {
    expect(alertLevel(Infinity)).toBe(0);
    expect(alertLevel(2000)).toBe(1);
    expect(alertLevel(100)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 逃生路径
// ---------------------------------------------------------------------------

describe("逃生路径 BFS(纯函数)", () => {
  it("本来就站在安全格上时不用走", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [5, 1], 2);
    const plan = findEscape(world, world.fighters[0].pos, { stepMs: 180 });
    expect(plan).not.toBeNull();
    expect(plan!.path).toEqual([]);
  });

  it("走廊里往安全的一端跑,路径每一步都相邻", () => {
    const world = soloWorld(["#########", "#.......#", "#########"], [1, 1], 2);
    world.bombs.push(bombOf(idx(world.board, 1, 1), 2));
    const plan = findEscape(world, world.fighters[0].pos, { stepMs: 180 });
    expect(plan).not.toBeNull();
    expect(plan!.path.length).toBeGreaterThan(0);
    let prev = world.fighters[0].pos;
    for (const cell of plan!.path) {
      expect(dirBetween(world.board, prev, cell)).toBeGreaterThanOrEqual(0);
      prev = cell;
    }
    expect(dangerCells(world).has(plan!.goal)).toBe(false);
  });

  it("死胡同里炸自己:根本没有安全格,返回 null", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1], 3);
    world.bombs.push(bombOf(idx(world.board, 1, 1), 3));
    expect(findEscape(world, world.fighters[0].pos, { stepMs: 180 })).toBeNull();
  });

  it("路太长、引信来不及烧完的话也算逃不掉", () => {
    // 直走廊:火力盖住一整条,唯一的出口远到跑不到
    const rows = ["#" + ".".repeat(20) + "#"];
    const board = parse(["#".repeat(22), rows[0], "#".repeat(22)]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const world = createWorld({ board, fighters: [me], seed: 1, richness: 0 });
    world.bombs.push(bombOf(idx(board, 1, 1), 20));
    // 走一格要 2 秒,引信只有 2.4 秒,注定跑不出去
    expect(findEscape(world, me.pos, { stepMs: 2000 })).toBeNull();
  });

  it("安全余量真的留出来了:刚好卡点的格子不算安全", () => {
    const world = soloWorld(["#########", "#.......#", "#########"], [1, 1], 2);
    world.bombs.push(bombOf(idx(world.board, 1, 1), 2, SAFETY_MS));
    // 引信只剩安全余量那么点时间,一步都来不及走
    expect(findEscape(world, world.fighters[0].pos, { stepMs: 300 })).toBeNull();
  });

  it("escapeAfterBomb:能跑掉的地方给方案,跑不掉的地方给 null", () => {
    const roomy = soloWorld(["#########", "#.......#", "#.......#", "#########"], [1, 1], 2);
    expect(escapeAfterBomb(roomy, roomy.fighters[0])).not.toBeNull();

    const trap = soloWorld(["#####", "#...#", "#####"], [1, 1], 3);
    expect(escapeAfterBomb(trap, trap.fighters[0])).toBeNull();
  });

  it("穿墙泡会让逃生多出几条路", () => {
    const world = soloWorld(["#####", "#.+.#", "#####"], [1, 1], 1);
    world.bombs.push(bombOf(idx(world.board, 1, 1), 1));
    expect(findEscape(world, world.fighters[0].pos, { stepMs: 180 })).toBeNull();
    expect(findEscape(world, world.fighters[0].pos, { stepMs: 180, ghost: true })).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 目标搜索
// ---------------------------------------------------------------------------

describe("目标搜索", () => {
  it("seek 会给出走向目标的第一步", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1], 2);
    world.items.set(idx(world.board, 4, 1), "fire");
    const quest = seek(world, world.fighters[0].pos, (c) => world.items.has(c), { stepMs: 180 });
    expect(quest).not.toBeNull();
    expect(quest!.dir).toBe(DIR_RIGHT);
    expect(quest!.steps).toBe(3);
  });

  it("seek 会绕开会着火的格子,绕不过去就返回 null", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1], 2);
    world.items.set(idx(world.board, 5, 1), "fire");
    world.bombs.push(bombOf(idx(world.board, 3, 1), 3));
    expect(seek(world, world.fighters[0].pos, (c) => world.items.has(c), { stepMs: 180 })).toBeNull();
  });

  it("bricksHit 数得清一颗弹能炸掉几块砖", () => {
    const world = soloWorld(["#####", "#.+.#", "#+..#", "#####"], [1, 1], 2);
    expect(bricksHit(world, world.fighters[0].pos, 2)).toBe(2);
    expect(bricksHit(world, idx(world.board, 3, 2), 1)).toBe(0);
  });

  it("wouldCatch 能判断爆风盖不盖得到对手", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1], 2);
    expect(wouldCatch(world, idx(world.board, 1, 1), 2, [idx(world.board, 3, 1)])).toBe(true);
    expect(wouldCatch(world, idx(world.board, 1, 1), 2, [idx(world.board, 5, 1)])).toBe(false);
  });

  it("distanceToFoe 只看没被泡泡困住的对手", () => {
    const board = parse(["#######", "#.....#", "#######"]);
    const a = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1), 0);
    const b = makeFighter(1, "康康", "👓", idx(board, 4, 1), 1);
    const world = createWorld({ board, fighters: [a, b], seed: 1, richness: 0 });
    expect(distanceToFoe(world, 0)).toBe(3);
    b.bubbleT = 1000;
    expect(distanceToFoe(world, 0)).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// 电脑玩家:绝不自炸
// ---------------------------------------------------------------------------

describe("电脑玩家不会把自己炸掉", () => {
  it("死胡同里就算旁边有砖也不放弹", () => {
    // 一条 3 格长的死胡同,尽头有砖;火力盖满整条,放下去就没地方躲
    const world = soloWorld(["#####", "#..+#", "#####"], [1, 1], 3);
    world.fighters[0].ai = true;
    for (const skill of [1, 2, 3] as AiLevel[]) {
      const act = chooseAiAction(world, 0, skill);
      expect(act.drop, `${AI_LABEL[skill]} 档不该在死胡同里放弹`).toBe(false);
    }
  });

  it("有退路的时候才愿意炸砖", () => {
    // 回字形走廊:炸砖之后能绕到另一条边上
    const world = soloWorld(["#####", "#..+#", "#.#.#", "#...#", "#####"], [1, 1], 2);
    world.fighters[0].ai = true;
    const act = chooseAiAction(world, 0, 3);
    expect(escapeAfterBomb(world, world.fighters[0])).not.toBeNull();
    expect(act.drop || act.dir >= 0).toBe(true);
  });

  it("脚下要着火时第一件事是往安全格跑", () => {
    const world = soloWorld(["#########", "#.......#", "#########"], [1, 1], 2);
    world.fighters[0].ai = true;
    world.bombs.push(bombOf(idx(world.board, 1, 1), 2));
    const act = chooseAiAction(world, 0, 3);
    expect(act.drop).toBe(false);
    expect(act.dir).toBe(DIR_RIGHT);
    expect(act.why).toContain("躲");
  });

  it("三档电脑在六张真实擂台上各打三分钟,一次都不会被自己的弹包住", () => {
    for (const skill of [1, 2, 3] as AiLevel[]) {
      for (const round of [1, 2, 3, 5, 8, 12]) {
        const lv = buildArena(round, 2);
        const me = makeFighter(0, "电脑", "🤖", lv.spawns[0], 0);
        me.ai = true;
        for (const item of lv.starters) applyItem(me, item);
        const world = createWorld({
          board: lv.board,
          fighters: [me],
          hidden: new Map(lv.hidden),
          seed: lv.seed,
          richness: lv.richness,
        });
        let tick = 0;
        for (let t = 0; t < 9000; t++) {
          const act = chooseAiAction(world, 0, skill, tick++);
          const intents: Intent[] = [{ dir: act.dir, drop: act.drop, detonate: act.detonate }];
          stepWorld(world, 20, intents);
        }
        expect(me.bubbled, `${AI_LABEL[skill]} 档在第 ${round} 张擂台上把自己炸到了`).toBe(0);
      }
    }
  });

  it("电脑在无尽的图里边清怪边躲弹,也不会栽在自己的爆风上", () => {
    for (const round of [1, 5, 10]) {
      const lv = buildEndlessRound(round);
      const me = makeFighter(0, "电脑", "🤖", lv.spawns[0], 0);
      me.ai = true;
      for (const item of lv.starters) applyItem(me, item);
      const world = createWorld({
        board: lv.board,
        fighters: [me],
        critters: lv.critters.map((c) => ({ ...c })),
        hidden: new Map(lv.hidden),
        seed: lv.seed,
        richness: lv.richness,
      });
      // 小怪撞人也会把人包成泡泡,这里只盯「自己的弹炸到自己」这一件事:
      // 把小怪先撤掉,剩下的危险来源就只有电脑自己摆的炸弹了
      world.critters = [];
      let tick = 0;
      for (let t = 0; t < 6000; t++) {
        const act = chooseAiAction(world, 0, 3, tick++);
        stepWorld(world, 20, [{ dir: act.dir, drop: act.drop, detonate: act.detonate }]);
      }
      expect(me.bubbled, `第 ${round} 轮的图里电脑自炸了`).toBe(0);
    }
  });

  it("高手档在擂台上确实会动手炸砖(不是靠站着不动来保命)", () => {
    const lv = buildArena(5, 2);
    const me = makeFighter(0, "电脑", "🤖", lv.spawns[0], 0);
    me.ai = true;
    const world = createWorld({
      board: lv.board,
      fighters: [me],
      hidden: new Map(lv.hidden),
      seed: lv.seed,
      richness: lv.richness,
    });
    const bricksBefore = world.board.cells.filter((c) => c === TILE_SOFT).length;
    let tick = 0;
    for (let t = 0; t < 4000; t++) {
      const act = chooseAiAction(world, 0, 3, tick++);
      stepWorld(world, 20, [{ dir: act.dir, drop: act.drop, detonate: act.detonate }]);
    }
    const bricksAfter = world.board.cells.filter((c) => c === TILE_SOFT).length;
    expect(bricksAfter).toBeLessThan(bricksBefore);
    expect(me.picked).toBeGreaterThan(0);
    expect(me.bubbled).toBe(0);
  });

  it("两台电脑互相对轰,谁也不会栽在自己的炸弹上", () => {
    const lv = buildArena(2, 2);
    const a = makeFighter(0, "电脑甲", "🤖", lv.spawns[0], 0);
    const b = makeFighter(1, "电脑乙", "🤖", lv.spawns[1], 1);
    a.ai = true;
    b.ai = true;
    const world = createWorld({
      board: lv.board,
      fighters: [a, b],
      hidden: new Map(lv.hidden),
      seed: lv.seed,
      richness: lv.richness,
    });
    let tick = 0;
    let firstBubbleAt = -1;
    for (let t = 0; t < 6000; t++) {
      const acts = [chooseAiAction(world, 0, 3, tick), chooseAiAction(world, 1, 2, tick + 1)];
      tick++;
      stepWorld(
        world,
        20,
        acts.map((act) => ({ dir: act.dir, drop: act.drop, detonate: act.detonate }))
      );
      if (firstBubbleAt < 0 && (a.bubbleT > 0 || b.bubbleT > 0)) firstBubbleAt = t;
    }
    // 被包住只可能是被对手的爆风碰到;自己的弹从来炸不到自己
    for (const f of [a, b]) {
      const selfHit = f.bubbled > 0 && world.fighters.every((o) => o.index === f.index);
      expect(selfHit).toBe(false);
    }
  });

  it("被泡泡包着的时候什么都不做,老老实实等着", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1], 2);
    world.fighters[0].bubbleT = 1200;
    const act = chooseAiAction(world, 0, 3);
    expect(act.drop).toBe(false);
    expect(act.detonate).toBe(false);
    expect(act.dir).toBe(-1);
  });

  it("手上有遥控弹又能盖住对手时会主动按引爆,盖到自己就不按", () => {
    const board = parse(["#########", "#.......#", "#########"]);
    const a = makeFighter(0, "电脑", "🤖", idx(board, 5, 1), 0);
    const b = makeFighter(1, "康康", "👓", idx(board, 2, 1), 1);
    a.ai = true;
    a.remote = true;
    const world = createWorld({ board, fighters: [a, b], seed: 1, richness: 0 });
    world.bombs.push({ id: 1, pos: idx(board, 1, 1), owner: 0, power: 2, fuse: 9000, remote: true, slide: -1, slideT: 0 });
    expect(chooseAiAction(world, 0, 3).detonate).toBe(true);

    a.pos = idx(board, 2, 1);
    expect(chooseAiAction(world, 0, 3).detonate).toBe(false);
  });

  it("轻松档想得比高手档慢,但一样不会自炸", () => {
    const world = soloWorld(["#########", "#.......#", "#.......#", "#########"], [1, 1], 2);
    world.fighters[0].ai = true;
    for (let t = 0; t < 600; t++) {
      const act = chooseAiAction(world, 0, 1, t);
      stepWorld(world, 20, [{ dir: act.dir, drop: act.drop, detonate: act.detonate }]);
    }
    expect(world.fighters[0].bubbled).toBe(0);
  });

  it("放下弹以后真的能靠自己走出爆风(端到端跑一遍)", () => {
    const world = soloWorld(["#######", "#..+..#", "#.#.#.#", "#.....#", "#######"], [1, 1], 2);
    world.fighters[0].ai = true;
    let dropped = false;
    for (let t = 0; t < 400; t++) {
      const act = chooseAiAction(world, 0, 3, t);
      if (act.drop) dropped = true;
      stepWorld(world, 20, [{ dir: act.dir, drop: act.drop, detonate: act.detonate }]);
    }
    expect(dropped).toBe(true);
    expect(world.fighters[0].bubbled).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 无尽收缩
// ---------------------------------------------------------------------------

describe("无尽模式的场地收缩", () => {
  it("收缩返回的是一整圈的空地格", () => {
    const board = pillarBoard(11, 11);
    const ring = shrinkRing(board, 1);
    expect(ring.length).toBeGreaterThan(0);
    for (const cell of ring) {
      const x = cell % board.w;
      const y = Math.floor(cell / board.w);
      const onRing = x === 1 || y === 1 || x === board.w - 2 || y === board.h - 2;
      expect(onRing).toBe(true);
      expect(board.cells[cell]).toBe(TILE_FLOOR);
    }
  });

  it("收到中心以后就收不动了,不会把棋盘收成空的", () => {
    const board = pillarBoard(9, 9);
    for (let ring = 0; ring < 20; ring++) {
      for (const cell of shrinkRing(board, ring)) board.cells[cell] = TILE_HARD;
    }
    const floors = board.cells.filter((c) => c === TILE_FLOOR).length;
    expect(floors).toBeGreaterThanOrEqual(0);
    expect(shrinkRing(board, 99)).toEqual([]);
  });

  it("轮次越高,收缩越快", () => {
    expect(shrinkDelay(1)).toBeGreaterThan(shrinkDelay(5));
    expect(shrinkDelay(50)).toBeGreaterThanOrEqual(4000);
  });

  it("无尽的图能正常开局:出生点是空地,身边有活动空间", () => {
    for (const round of [1, 4, 9, 15]) {
      const lv = buildEndlessRound(round);
      expect(lv.board.cells[lv.spawns[0]]).toBe(TILE_FLOOR);
      expect(lv.critters.length).toBeGreaterThan(0);
    }
  });
});
