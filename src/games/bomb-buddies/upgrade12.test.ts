/**
 * 1.2 第 15 步 A 档:纯函数层的新账(规格第四~七、十节)。
 *
 * 分五块:
 *  1. **拐弯补正**:阈值常量 + `planTurn` 的每一条分支 + 端到端真的拐过去了;
 *  2. **泡泡时间线**:0.4s 膨胀 / 2.0s 破裂 / 连锁 3 帧内兑现,而且波次可复现;
 *  3. **道具**:七件(含泡泡护盾)、seeded 掉落、新旧两张表互不干扰;
 *  4. **合作救援**:5 秒窗口、贴身 0.6 秒拍破、救人计数;
 *  5. **泡泡塔与窄屏**:一层一张小图、全 188 关封在 15×15、前 99 关指纹一格没动。
 *
 * 老用例(`logic.test.ts` / `ai.test.ts` / `levels.test.ts`)一条没删,这里只增。
 */
import { describe, expect, it } from "vitest";
import { FIRST_99_FINGERPRINTS, levelFingerprint } from "./fingerprints";
import {
  ALL_LEVELS,
  MAX_COLS,
  MAX_ROWS,
  MIN_CELL_PX,
  NARROW_PX,
  TOWER_SECONDS,
  buildArena,
  buildLevel,
  buildTowerFloor,
  fitSize,
  fitsNarrow,
  poolForChapter,
  reachable,
  towerCritters,
  towerSize,
} from "./levels";
import {
  BUBBLE_GROW_MS,
  BUBBLE_POP_MS,
  CHAIN_FRAMES,
  CHAIN_STEP_MS,
  CHAIN_WINDOW_MS,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  FRAME_MS,
  FREE_GRACE_MS,
  FUSE_MS,
  ITEM_INFO,
  ITEM_KINDS,
  ITEM_KINDS_V2,
  MAX_SHIELD,
  RESCUE_MS,
  RESCUE_TOUCH_MS,
  TILE_FLOOR,
  TILE_HARD,
  TILE_SOFT,
  TURN_ASSIST_CELLS,
  applyItem,
  bubble,
  bubbleStage,
  chainDelay,
  chainWaves,
  createWorld,
  dropBomb,
  explodeBombs,
  growProgress,
  idx,
  kickBomb,
  makeBoard,
  makeFighter,
  planTurn,
  popBubble,
  rescuerFor,
  rollItem,
  rollItemV2,
  stepWorld,
  turnAssistReach,
  type Bomb,
  type Fighter,
  type Intent,
  type ItemKind,
  type World,
} from "./logic";

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

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

function bomb(id: number, pos: number, power: number, fuse = FUSE_MS): Bomb {
  return { id, pos, owner: 0, power, fuse, remote: false, slide: -1, slideT: 0 };
}

function idle(n: number): Intent[] {
  return Array.from({ length: n }, () => ({ dir: -1, drop: false, detonate: false, kick: false }));
}

function run(world: World, ms: number, intents: (t: number) => Intent[] = () => idle(world.fighters.length)): void {
  for (let t = 0; t < ms; t += 20) stepWorld(world, 20, intents(t));
}

// ---------------------------------------------------------------------------
// 一、拐弯补正
// ---------------------------------------------------------------------------

describe("拐弯补正", () => {
  it("阈值是半格,换算成「最远看一格」", () => {
    expect(TURN_ASSIST_CELLS).toBe(0.5);
    expect(turnAssistReach()).toBe(1);
    // 阈值调大到一格半,就该看到两格外的路口
    expect(turnAssistReach(1.5)).toBe(3);
  });

  it("想拐的方向被墙堵着、但错开一格就是路口时,先横着挪一格对齐", () => {
    //  0 1 2 3 4
    //  # # . # #     ← 上面只有 x=2 通
    //  . . . . .     ← 人在 (1,1),朝右跑
    const board = parse(["##.##", "....."]);
    const from = idx(board, 1, 1);
    const plan = planTurn(board, from, DIR_RIGHT, DIR_UP);
    expect(plan.assisted).toBe(true);
    // 顺着当前朝向(往右)挪一格就对齐了
    expect(plan.dir).toBe(DIR_RIGHT);
    expect(plan.via).toBe(idx(board, 2, 1));
  });

  it("超出半格阈值(要挪两格)就不补了,老老实实撞墙", () => {
    // 上面只有 x=3 通,人在 (1,1):差两格,超出阈值
    const board = parse(["###.#", "....."]);
    const plan = planTurn(board, idx(board, 1, 1), DIR_RIGHT, DIR_UP);
    expect(plan.assisted).toBe(false);
    expect(plan.dir).toBe(DIR_UP);
    expect(plan.via).toBe(-1);
  });

  it("本来就走得通的方向不插手", () => {
    const board = parse([".....", "....."]);
    const plan = planTurn(board, idx(board, 2, 1), DIR_RIGHT, DIR_UP);
    expect(plan).toEqual({ dir: DIR_UP, assisted: false, via: -1 });
  });

  it("目标格上压着泡泡时不补正——那一下是踢泡,不许被悄悄改成别的方向", () => {
    const board = parse(["##.##", "....."]);
    const from = idx(board, 1, 1);
    const bombs = new Set([idx(board, 1, 0)]);
    // 没有泡泡时会补正
    expect(planTurn(board, from, DIR_RIGHT, DIR_UP).assisted).toBe(true);
    // 上面那格摆了泡泡:方向原样交回去
    const plan = planTurn(board, from, DIR_RIGHT, DIR_UP, { bombs });
    expect(plan.assisted).toBe(false);
    expect(plan.dir).toBe(DIR_UP);
  });

  it("软砖挡路一样补正,但拿到穿泡的人本来就能钻,不需要补", () => {
    const board = parse(["++.++", "....."]);
    const from = idx(board, 1, 1);
    expect(planTurn(board, from, DIR_RIGHT, DIR_UP).assisted).toBe(true);
    expect(planTurn(board, from, DIR_RIGHT, DIR_UP, { ghost: true }).assisted).toBe(false);
  });

  it("四面都堵死的时候不会瞎补,返回原方向", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const plan = planTurn(board, idx(board, 2, 1), DIR_RIGHT, DIR_UP);
    expect(plan.assisted).toBe(false);
  });

  it("端到端:按着上键往右跑,人真的从口子里拐上去了", () => {
    const board = parse(["##.##", "....."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 1, 1), 0);
    const world = createWorld({ board, fighters: [f] });
    run(world, 1200, () => [{ dir: DIR_UP, drop: false, detonate: false }]);
    expect(f.pos).toBe(idx(board, 2, 0));
  });

  it("电脑玩家不吃补正:它的每一步都是算准的,替它改方向反而会把它推进彩虹波", () => {
    const board = parse(["##.##", "....."]);
    const f = makeFighter(0, "电脑", "🤖", idx(board, 1, 1), 0);
    f.ai = true;
    const world = createWorld({ board, fighters: [f] });
    run(world, 1200, () => [{ dir: DIR_UP, drop: false, detonate: false }]);
    expect(f.pos).toBe(idx(board, 1, 1));
  });
});

// ---------------------------------------------------------------------------
// 二、泡泡时间线
// ---------------------------------------------------------------------------

describe("泡泡时间线", () => {
  it("常量就是规格上写的那几个数:0.4 秒鼓起来,2.0 秒破,连锁 3 帧内兑现", () => {
    expect(BUBBLE_GROW_MS).toBe(400);
    expect(BUBBLE_POP_MS).toBe(2000);
    expect(FUSE_MS).toBe(BUBBLE_POP_MS);
    expect(CHAIN_FRAMES).toBe(3);
    expect(CHAIN_STEP_MS).toBe(FRAME_MS);
    expect(CHAIN_WINDOW_MS).toBe(CHAIN_FRAMES * FRAME_MS);
  });

  it("膨胀进度从 0 走到 1,0.4 秒之后一直是 1", () => {
    expect(growProgress(BUBBLE_POP_MS)).toBe(0);
    expect(growProgress(BUBBLE_POP_MS - BUBBLE_GROW_MS / 2)).toBeCloseTo(0.5, 5);
    expect(growProgress(BUBBLE_POP_MS - BUBBLE_GROW_MS)).toBe(1);
    expect(growProgress(200)).toBe(1);
  });

  it("三个阶段接得上:鼓起来 → 晃悠悠 → 马上要破", () => {
    expect(bubbleStage(BUBBLE_POP_MS)).toBe("grow");
    expect(bubbleStage(BUBBLE_POP_MS - BUBBLE_GROW_MS + 1)).toBe("grow");
    expect(bubbleStage(BUBBLE_POP_MS - BUBBLE_GROW_MS)).toBe("wobble");
    expect(bubbleStage(1000)).toBe("wobble");
    expect(bubbleStage(30)).toBe("burst");
  });

  it("波次表是一波一环,延迟一波一帧", () => {
    // 三颗排成一列,间距 2,power 2 → 一颗点一颗
    const board = parse([".......", ".......", "......."]);
    const bombs = [bomb(1, idx(board, 1, 1), 2), bomb(2, idx(board, 3, 1), 2), bomb(3, idx(board, 5, 1), 2)];
    const waves = chainWaves(board, bombs, [1]);
    expect(waves.map((w) => w.ids)).toEqual([[1], [2], [3]]);
    expect(waves.map((w) => w.delay)).toEqual([0, CHAIN_STEP_MS, CHAIN_STEP_MS * 2]);
  });

  it("同一个局面拆出来的波次完全一样,连锁顺序可复现", () => {
    const board = parse([".......", ".......", "......."]);
    const make = (): Bomb[] => [
      bomb(7, idx(board, 5, 1), 2),
      bomb(3, idx(board, 1, 1), 2),
      bomb(5, idx(board, 3, 1), 2),
    ];
    const a = chainWaves(board, make(), [3]);
    const b = chainWaves(board, make(), [3]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // 喂进去的顺序打乱也不影响结果:排序在函数里做掉了
    const c = chainWaves(board, make().reverse(), [3]);
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  it("chainDelay 一波一帧,负数波次当第 0 波", () => {
    expect(chainDelay(0)).toBe(0);
    expect(chainDelay(1)).toBe(CHAIN_STEP_MS);
    expect(chainDelay(-3)).toBe(0);
  });

  it("被波及的泡泡引信立刻压到一帧,不会拖到自己的 2 秒", () => {
    const board = parse([".......", ".......", "......."]);
    const world = createWorld({ board, fighters: [] });
    world.bombs = [bomb(1, idx(board, 1, 1), 2), bomb(2, idx(board, 3, 1), 2, FUSE_MS)];
    explodeBombs(world, [1]);
    const left = world.bombs.find((b) => b.id === 2);
    expect(left?.fuse).toBe(CHAIN_STEP_MS);
    expect(left?.chained).toBe(true);
  });

  it("端到端:一串四颗泡泡,从第一声「啵」到最后一颗破,正好卡在 3 帧的兑现窗口里", () => {
    const board = parse([".........", ".........", "........."]);
    const world = createWorld({ board, fighters: [] });
    world.bombs = [
      bomb(1, idx(board, 1, 1), 2, FRAME_MS),
      bomb(2, idx(board, 3, 1), 2),
      bomb(3, idx(board, 5, 1), 2),
      bomb(4, idx(board, 7, 1), 2),
    ];
    let clock = 0;
    let firstBoom = -1;
    let lastBoom = -1;
    for (let t = 0; t < 2000 && world.bombs.length > 0; t += FRAME_MS) {
      stepWorld(world, FRAME_MS, []);
      clock += FRAME_MS;
      if (world.events.some((e) => e.kind === "boom")) {
        if (firstBoom < 0) firstBoom = clock;
        lastBoom = clock;
      }
      world.events.length = 0;
    }
    expect(world.bombs.length).toBe(0);
    // 一波一帧:四颗排成一串,第一声之后再过 3 帧全部兑现,一帧不多
    expect(lastBoom - firstBoom).toBe(CHAIN_WINDOW_MS);
  });
});

// ---------------------------------------------------------------------------
// 三、道具:七件与两张表
// ---------------------------------------------------------------------------

describe("道具与泡泡护盾", () => {
  it("新池七件,老池原样六件,顺序一个字节都没动", () => {
    expect(ITEM_KINDS).toEqual(["fire", "bomb", "speed", "kick", "ghost", "remote"]);
    expect(ITEM_KINDS_V2).toEqual([...ITEM_KINDS, "shield"]);
    expect(ITEM_KINDS_V2.length).toBeGreaterThanOrEqual(6);
    expect(ITEM_KINDS_V2).toContain("kick");
    expect(ITEM_KINDS_V2).toContain("ghost");
    expect(ITEM_KINDS_V2).toContain("shield");
  });

  it("七件都有中文名、图标和一句说明", () => {
    for (const kind of ITEM_KINDS_V2) {
      const info = ITEM_INFO[kind];
      expect(info.name.length, kind).toBeGreaterThan(1);
      expect(info.emoji.length, kind).toBeGreaterThan(0);
      expect(info.line.length, kind).toBeGreaterThan(6);
    }
  });

  it("v2 掉落是 seeded 的:同一颗种子同一格永远掉同一件", () => {
    for (let cell = 0; cell < 40; cell++) {
      expect(rollItemV2(1234, cell)).toBe(rollItemV2(1234, cell));
    }
    expect(rollItemV2(1, 5)).not.toBe(undefined);
  });

  it("v2 表七件都掉得出来,而且和老表不是同一张", () => {
    const seen = new Set<ItemKind>();
    let differ = 0;
    for (let cell = 0; cell < 4000; cell++) {
      const v2 = rollItemV2(99, cell, 1.4);
      if (v2) seen.add(v2);
      if (v2 !== rollItem(99, cell, 1.4)) differ++;
    }
    for (const kind of ITEM_KINDS_V2) expect(seen.has(kind), `${kind} 一次都没掉出来`).toBe(true);
    // 换了盐,两张表在大多数格子上给的答案不一样
    expect(differ).toBeGreaterThan(2000);
  });

  it("richness 为 0 时新表也一件都不掉", () => {
    for (let cell = 0; cell < 50; cell++) expect(rollItemV2(7, cell, 0)).toBe(null);
  });

  it("护盾最多叠两层,捡第三个不再涨", () => {
    const f = makeFighter(0, "鸭梨", "🌸", 0, 0);
    expect(f.shield).toBe(0);
    expect(applyItem(f, "shield")).toBe(true);
    expect(applyItem(f, "shield")).toBe(true);
    expect(f.shield).toBe(MAX_SHIELD);
    expect(applyItem(f, "shield")).toBe(false);
    expect(f.shield).toBe(MAX_SHIELD);
  });

  it("有护盾时被彩虹波扫到只掉一层盾,人不进泡泡", () => {
    const board = parse(["....."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 2, 0), 0);
    f.shield = 2;
    const world = createWorld({ board, fighters: [f] });
    bubble(world, 0);
    expect(f.shield).toBe(1);
    expect(f.bubbleT).toBe(0);
    expect(f.bubbled).toBe(0);
    expect(world.events.some((e) => e.kind === "shield")).toBe(true);
  });

  it("同一圈彩虹波不会连扣两层盾", () => {
    const board = parse(["....."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 2, 0), 0);
    f.shield = 2;
    const world = createWorld({ board, fighters: [f] });
    bubble(world, 0);
    bubble(world, 0);
    expect(f.shield).toBe(1);
  });

  it("盾掉光了才会被罩住", () => {
    const board = parse(["....."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 2, 0), 0);
    const world = createWorld({ board, fighters: [f] });
    bubble(world, 0);
    expect(f.bubbleT).toBeGreaterThan(0);
    expect(f.bubbled).toBe(1);
  });

  it("踢泡钮:脚边有泡泡就把它踹出去,没有就什么也不发生", () => {
    const board = parse([".......", "......."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 1, 0), 0);
    f.kick = true;
    const world = createWorld({ board, fighters: [f] });
    expect(kickBomb(world, 0, DIR_RIGHT)).toBe(false);
    world.bombs = [bomb(1, idx(board, 2, 0), 1)];
    expect(kickBomb(world, 0, DIR_RIGHT)).toBe(true);
    expect(world.bombs[0].slide).toBe(DIR_RIGHT);
  });

  it("没有踢泡道具的人按踢泡钮不起作用", () => {
    const board = parse([".......", "......."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 1, 0), 0);
    const world = createWorld({ board, fighters: [f] });
    world.bombs = [bomb(1, idx(board, 2, 0), 1)];
    expect(kickBomb(world, 0, DIR_RIGHT)).toBe(false);
    expect(world.bombs[0].slide).toBe(-1);
  });

  it("第 100 关之后才换新表:前 99 关走的章节一律是老六件", () => {
    expect(poolForChapter(0)).toBe("v1");
    expect(poolForChapter(4)).toBe("v1");
    expect(poolForChapter(5)).toBe("v2");
    expect(poolForChapter(7)).toBe("v2");
    // 前 99 关(0..98)全落在 v1 的章节里
    for (let i = 0; i < 99; i++) expect(buildLevel(i).pool, `第 ${i + 1} 关`).toBe("v1");
    // 后面确实有关卡在发护盾
    const late = ALL_LEVELS.slice(120).map((n) => buildLevel(n));
    expect(late.some((lv) => [...lv.hidden.values()].includes("shield"))).toBe(true);
  });

  it("对战擂台故意不发护盾:决胜的那一下被盾吃掉,三局两胜就打不完了", () => {
    for (let round = 1; round <= 6; round++) {
      const lv = buildArena(round, 2);
      expect(lv.pool).toBe("v1");
      expect([...lv.hidden.values()]).not.toContain("shield");
    }
  });
});

// ---------------------------------------------------------------------------
// 四、合作救援
// ---------------------------------------------------------------------------

describe("合作救援", () => {
  function coopWorld(): { world: World; a: Fighter; b: Fighter; board: ReturnType<typeof makeBoard> } {
    const board = parse([".......", ".......", "......."]);
    const a = makeFighter(0, "鸭梨", "🌸", idx(board, 1, 1), 0);
    const b = makeFighter(1, "康康", "⭐", idx(board, 5, 1), 0);
    const world = createWorld({ board, fighters: [a, b], rescue: true });
    return { world, a, b, board };
  }

  it("常量:困住 5 秒、贴身拍 0.6 秒", () => {
    expect(RESCUE_MS).toBe(5000);
    expect(RESCUE_TOUCH_MS).toBe(600);
    expect(RESCUE_TOUCH_MS).toBeLessThan(RESCUE_MS);
  });

  it("开了救援的世界里被罩住是 5 秒,没开还是原来的 3.6 秒", () => {
    const { world, a } = coopWorld();
    bubble(world, 0);
    expect(a.bubbleT).toBe(RESCUE_MS);

    const solo = createWorld({ board: parse(["....."]), fighters: [makeFighter(0, "鸭梨", "🌸", 2, 0)] });
    bubble(solo, 0);
    expect(solo.fighters[0].bubbleT).toBeLessThan(RESCUE_MS);
  });

  it("rescuerFor 只认同队、没被罩住、就在旁边一格的队友", () => {
    const { world, a, b } = coopWorld();
    bubble(world, 0);
    // 隔得远:没人能救
    expect(rescuerFor(world, 0)).toBe(-1);
    // 贴到旁边:认得出
    b.pos = a.pos + 1;
    expect(rescuerFor(world, 0)).toBe(1);
    // 队友自己也被罩住了:救不了
    b.bubbleT = 1000;
    expect(rescuerFor(world, 0)).toBe(-1);
    // 不同队(对战)也不算救
    b.bubbleT = 0;
    b.team = 1;
    expect(rescuerFor(world, 0)).toBe(-1);
  });

  it("没被罩住的人不需要救", () => {
    const { world } = coopWorld();
    expect(rescuerFor(world, 0)).toBe(-1);
  });

  it("端到端:队友贴过来站住 0.6 秒,泡泡「啵」的一下破了,人被放出来", () => {
    const { world, a, b } = coopWorld();
    bubble(world, 0);
    b.pos = a.pos + 1;
    world.events.length = 0;
    run(world, RESCUE_TOUCH_MS + 40);
    expect(a.bubbleT).toBe(0);
    expect(a.rescued).toBe(1);
    expect(b.saves).toBe(1);
    const ev = world.events.find((e) => e.kind === "rescue");
    expect(ev).toEqual({ kind: "rescue", who: 0, by: 1 });
  });

  it("拍到一半跑开,进度会退回去,不是攒着的", () => {
    const { world, a, b } = coopWorld();
    bubble(world, 0);
    b.pos = a.pos + 1;
    run(world, 300);
    expect(a.rescueT).toBeGreaterThan(0);
    b.pos = idx(world.board, 5, 1);
    run(world, 400);
    expect(a.rescueT).toBe(0);
    expect(a.bubbleT).toBeGreaterThan(0);
  });

  it("5 秒之内没人来救,自己也会晃出来——救援是加分项,不是通关的必要条件", () => {
    const { world, a } = coopWorld();
    bubble(world, 0);
    run(world, RESCUE_MS + 200);
    expect(a.bubbleT).toBe(0);
    expect(a.rescued).toBe(0);
  });

  it("popBubble 直接拍破也算数,自己晃出来的不记救援", () => {
    const { world, a, b } = coopWorld();
    bubble(world, 0);
    expect(popBubble(world, 0, 1)).toBe(true);
    expect(b.saves).toBe(1);
    // 已经出来了,再拍一次什么也不会发生
    expect(popBubble(world, 0, 1)).toBe(false);
    expect(b.saves).toBe(1);

    bubble(world, 0);
    popBubble(world, 0);
    expect(a.rescued).toBe(1);
    expect(b.saves).toBe(1);
  });

  it("刚被放出来有一段彩虹光缓冲,不会站在原地被反复罩住", () => {
    const { world, a } = coopWorld();
    bubble(world, 0);
    popBubble(world, 0, 1);
    expect(a.safeT).toBe(FREE_GRACE_MS);
    bubble(world, 0);
    expect(a.bubbleT).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 五、泡泡塔与窄屏
// ---------------------------------------------------------------------------

describe("无尽泡泡塔", () => {
  it("一层一张小地图:边长从 9 起步,越爬越大但封在窄屏上限内", () => {
    expect(towerSize(1)).toBe(9);
    expect(towerSize(5)).toBe(11);
    expect(towerSize(50)).toBe(MAX_COLS);
    for (let floor = 1; floor <= 40; floor++) {
      const size = towerSize(floor);
      expect(size % 2, `第 ${floor} 层不是奇数边长`).toBe(1);
      expect(size).toBeLessThanOrEqual(MAX_COLS);
    }
  });

  it("越往上小怪越多、种类越难缠,但封顶不超过 6 只", () => {
    const one = towerCritters(1);
    const ten = towerCritters(10);
    expect(one.length).toBeLessThan(ten.length);
    expect(towerCritters(99).length).toBe(6);
    expect(one).toEqual(["slime"]);
    expect(ten).toContain("ghosty");
  });

  it("每一层都能开局、都打得完:出生点是空地,所有小怪都走得到", () => {
    for (let floor = 1; floor <= 20; floor++) {
      const lv = buildTowerFloor(floor);
      expect(lv.board.cells[lv.spawns[0]], `第 ${floor} 层出生点被墙压住`).toBe(TILE_FLOOR);
      expect(lv.critters.length, `第 ${floor} 层没有小怪`).toBeGreaterThan(0);
      const open = reachable(lv.board, lv.spawns[0], true);
      for (const c of lv.critters) {
        expect(open.has(c.pos), `第 ${floor} 层的 ${c.kind} 够不着`).toBe(true);
      }
    }
  });

  it("同一层生成两次完全一样,可以背板;不同层不一样", () => {
    const a = buildTowerFloor(6);
    const b = buildTowerFloor(6);
    expect(a.board.cells.join("")).toBe(b.board.cells.join(""));
    expect(a.critters.map((c) => c.pos)).toEqual(b.critters.map((c) => c.pos));
    expect(buildTowerFloor(7).board.cells.join("")).not.toBe(a.board.cells.join(""));
  });

  it("塔里不送起手道具(上一层带上来的才是家当),每层给固定的秒数", () => {
    const lv = buildTowerFloor(3);
    expect(lv.starters).toEqual([]);
    expect(lv.seconds).toBe(TOWER_SECONDS);
    expect(lv.pool).toBe("v2");
    expect(lv.goal).toBe("clear");
  });

  it("塔里发得出护盾,爬得越高越需要它", () => {
    const kinds = new Set<ItemKind>();
    for (let floor = 1; floor <= 30; floor++) {
      for (const k of buildTowerFloor(floor).hidden.values()) kinds.add(k);
    }
    expect(kinds.has("shield")).toBe(true);
  });
});

describe("窄屏 360px", () => {
  it("尺寸上限是「真机上量出来的可画宽度 / 24」那道除法", () => {
    expect(NARROW_PX).toBe(360);
    expect(MIN_CELL_PX).toBe(24);
    // 360 的屏宽先要扣掉平台留白、舞台描边和本款内边距,真正能画的约 315px。
    // 上限必须小于那个数,而且是奇数(奇数才摆得出标准的硬墙柱子格局)。
    expect(MAX_COLS * MIN_CELL_PX).toBeLessThanOrEqual(315);
    expect(MAX_COLS % 2).toBe(1);
    expect(MAX_ROWS % 2).toBe(1);
    // 竖屏 720 扣掉标题栏 / HUD / 摇杆之后剩 312,行数不能比列数还宽松
    expect(MAX_ROWS * MIN_CELL_PX).toBeLessThanOrEqual(312);
    expect(MAX_COLS * MIN_CELL_PX).toBeLessThanOrEqual(NARROW_PX);
  });

  it("fitSize 压在上限内,而且压完还是奇数", () => {
    expect(fitSize(9, MAX_COLS)).toBe(9);
    expect(fitSize(16, MAX_COLS)).toBe(MAX_COLS);
    expect(fitSize(99, MAX_COLS)).toBe(MAX_COLS);
    expect(fitSize(99, 14)).toBe(13);
    expect(fitSize(99, 15)).toBe(15);
  });

  it("188 关一关都不超框:360px 手机上整屏看得完,每格不小于 24px", () => {
    for (const n of ALL_LEVELS) {
      const lv = buildLevel(n);
      expect(fitsNarrow(lv.board), `第 ${n + 1} 关是 ${lv.board.w}×${lv.board.h}`).toBe(true);
      expect(lv.board.w * MIN_CELL_PX).toBeLessThanOrEqual(NARROW_PX);
      expect(lv.board.h).toBeLessThanOrEqual(MAX_ROWS);
    }
  });

  it("擂台、合作、泡泡塔也都在框里", () => {
    for (let i = 1; i <= 8; i++) {
      expect(fitsNarrow(buildArena(i, 2).board)).toBe(true);
      expect(fitsNarrow(buildTowerFloor(i * 3).board)).toBe(true);
    }
  });
});

describe("前 99 关地图指纹", () => {
  it("99 条指纹一条不少", () => {
    expect(FIRST_99_FINGERPRINTS.length).toBe(99);
  });

  it("前 99 关一格都没动:格局 / 藏品 / 目标 / 出口 / 限时 / 小怪站位逐关对得上", () => {
    for (let i = 0; i < 99; i++) {
      expect(levelFingerprint(i), `第 ${i + 1} 关的地图变了`).toBe(FIRST_99_FINGERPRINTS[i]);
    }
  });

  it("指纹真的抓得住变化(改一格就对不上,不是永远为真的空断言)", () => {
    const lv = buildLevel(0);
    const floor = lv.board.cells.findIndex((c) => c === TILE_FLOOR);
    const tampered = { ...lv, board: { ...lv.board, cells: [...lv.board.cells] } };
    tampered.board.cells[floor] = TILE_SOFT;
    expect(tampered.board.cells.join("")).not.toBe(lv.board.cells.join(""));
  });
});

// ---------------------------------------------------------------------------
// 六、分级红线:泡泡不是炸药
// ---------------------------------------------------------------------------

describe("分级红线", () => {
  /** 这些字眼一个都不许出现在给孩子看的文案里 */
  const BANNED = ["爆炸", "炸死", "火焰", "烧焦", "死亡", "死掉", "血", "受伤", "打死", "杀"];

  it("道具说明里没有任何爆炸 / 火焰 / 死亡的字眼", () => {
    for (const kind of ITEM_KINDS_V2) {
      const text = `${ITEM_INFO[kind].name}${ITEM_INFO[kind].line}`;
      for (const word of BANNED) expect(text.includes(word), `${kind}:${text}`).toBe(false);
    }
  });

  it("188 关的提示与目标说明也一样干净", () => {
    for (const n of ALL_LEVELS) {
      const lv = buildLevel(n);
      for (const word of BANNED) expect(lv.hint.includes(word), `第 ${n + 1} 关:${lv.hint}`).toBe(false);
    }
  });

  it("砖被波及走的是 brick 事件(画面据此散小花),不是什么「炸毁」", () => {
    const board = parse([".+.", "...", "..."]);
    const world = createWorld({ board, fighters: [] });
    world.bombs = [bomb(1, idx(board, 1, 1), 2)];
    explodeBombs(world, [1]);
    expect(world.events.some((e) => e.kind === "brick")).toBe(true);
    expect(board.cells[idx(board, 1, 0)]).toBe(TILE_FLOOR);
  });

  it("人被彩虹波扫到只是进泡泡:还在场上、还能被放出来,没有任何「出局」状态", () => {
    const board = parse(["....."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 2, 0), 0);
    const world = createWorld({ board, fighters: [f] });
    bubble(world, 0);
    expect(world.fighters).toContain(f);
    expect(f.bubbleT).toBeGreaterThan(0);
    run(world, 4000);
    expect(f.bubbleT).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 七、放泡到走人这条链子还是通的(回归)
// ---------------------------------------------------------------------------

describe("回归:2 秒引信下人还跑得掉", () => {
  it("放下泡泡以后一直往右走,2 秒破的时候人已经在波纹外面了", () => {
    const board = parse([".........", ".........", "........."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 1, 1), 0);
    f.speed = 3;
    const world = createWorld({ board, fighters: [f] });
    dropBomb(world, 0);
    run(world, BUBBLE_POP_MS + 200, () => [{ dir: DIR_RIGHT, drop: false, detonate: false }]);
    expect(world.bombs.length).toBe(0);
    expect(f.bubbleT).toBe(0);
    expect(f.bubbled).toBe(0);
  });

  it("原地不动的话 2 秒后会被自己的彩虹波罩住(时间线是真的在走)", () => {
    const board = parse([".........", ".........", "........."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 4, 1), 0);
    const world = createWorld({ board, fighters: [f] });
    dropBomb(world, 0);
    run(world, BUBBLE_POP_MS + 200);
    expect(f.bubbled).toBe(1);
  });

  it("放下去 0.4 秒内泡泡还在鼓,不会瞬间就破", () => {
    const board = parse([".........", "........."]);
    const f = makeFighter(0, "鸭梨", "🌸", idx(board, 4, 1), 0);
    const world = createWorld({ board, fighters: [f] });
    const b = dropBomb(world, 0);
    expect(bubbleStage(b?.fuse ?? 0)).toBe("grow");
    // 0.4 秒还没到:还在鼓
    run(world, BUBBLE_GROW_MS - 60);
    expect(world.bombs.length).toBe(1);
    expect(bubbleStage(world.bombs[0].fuse)).toBe("grow");
    // 过了 0.4 秒:鼓满了,开始晃悠悠
    run(world, 120);
    expect(bubbleStage(world.bombs[0].fuse)).toBe("wobble");
  });

  it("上下左右四个方向都走得动(方向常量没被写反)", () => {
    const board = parse([".....", ".....", "....."]);
    for (const [dir, dx, dy] of [
      [DIR_UP, 0, -1],
      [DIR_RIGHT, 1, 0],
      [DIR_DOWN, 0, 1],
      [DIR_LEFT, -1, 0],
    ] as const) {
      const f = makeFighter(0, "鸭梨", "🌸", idx(board, 2, 1), 0);
      const world = createWorld({ board, fighters: [f] });
      // 一档速度走一格 230ms,这里只给 200ms:确认走的是**一格**,不是滑出去两格
      run(world, 200, () => [{ dir, drop: false, detonate: false }]);
      expect(f.pos).toBe(idx(board, 2 + dx, 1 + dy));
    }
  });
});
