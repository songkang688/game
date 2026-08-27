import { describe, expect, it } from "vitest";
import {
  BUBBLE_MS,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  FLAME_MS,
  FUSE_MS,
  ITEM_INFO,
  ITEM_KINDS,
  MAX_BOMBS,
  MAX_POWER,
  MAX_SPEED,
  TILE_FLOOR,
  TILE_HARD,
  TILE_SOFT,
  actionDir,
  applyItem,
  blastCells,
  bombAt,
  bombsOf,
  bubble,
  chainBombs,
  createWorld,
  detonate,
  dropBomb,
  explodeBombs,
  formatClock,
  idx,
  isPauseKey,
  keyToAction,
  levelCleared,
  loseLine,
  makeBoard,
  makeCritter,
  makeFighter,
  matchWinner,
  parseCoopProgress,
  pickDir,
  rateLevel,
  rollItem,
  roundWinner,
  secondsLeft,
  serializeCoopProgress,
  stepCell,
  stepMsFor,
  stepWorld,
  tileAt,
  timeUp,
  tryStep,
  winLine,
  type Bomb,
  type Intent,
  type World,
} from "./logic";

// ---------------------------------------------------------------------------
// 小工具:用一张文本图快速搭棋盘
//   '#' 硬墙   '+' 软砖   '.' 空地
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

function bomb(id: number, pos: number, power: number, fuse = FUSE_MS, owner = 0): Bomb {
  return { id, pos, owner, power, fuse, remote: false, slide: -1, slideT: 0 };
}

function idle(n: number): Intent[] {
  return Array.from({ length: n }, () => ({ dir: -1, drop: false, detonate: false }));
}

/** 把世界推进 ms 毫秒(每帧 20ms,和真实帧率一个量级) */
function run(world: World, ms: number, intents: (t: number) => Intent[] = () => idle(world.fighters.length)): void {
  for (let t = 0; t < ms; t += 20) stepWorld(world, 20, intents(t));
}

// ---------------------------------------------------------------------------
// 棋盘
// ---------------------------------------------------------------------------

describe("棋盘基础", () => {
  it("越界一律当硬墙,不用每个调用方自己判边界", () => {
    const board = parse(["...", "...", "..."]);
    expect(tileAt(board, 0, 0)).toBe(TILE_FLOOR);
    expect(tileAt(board, -1, 0)).toBe(TILE_HARD);
    expect(tileAt(board, 3, 1)).toBe(TILE_HARD);
  });

  it("沿方向走一格,走出棋盘返回 -1", () => {
    const board = parse(["...", "...", "..."]);
    const center = idx(board, 1, 1);
    expect(stepCell(board, center, DIR_UP)).toBe(idx(board, 1, 0));
    expect(stepCell(board, center, DIR_RIGHT)).toBe(idx(board, 2, 1));
    expect(stepCell(board, idx(board, 1, 0), DIR_UP)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 爆风传播
// ---------------------------------------------------------------------------

describe("爆风传播(纯函数)", () => {
  it("空地上是一个十字,四个方向各伸 power 格", () => {
    const board = parse([".....", ".....", ".....", ".....", "....."]);
    const cells = blastCells(board, idx(board, 2, 2), 2);
    expect(cells).toHaveLength(9);
    expect(cells).toContain(idx(board, 2, 0));
    expect(cells).toContain(idx(board, 4, 2));
    expect(cells).not.toContain(idx(board, 3, 3));
  });

  it("撞上硬墙立刻停,硬墙本身不着火", () => {
    const board = parse([".....", ".....", ".#...", ".....", "....."]);
    const cells = blastCells(board, idx(board, 3, 2), 3);
    expect(cells).toContain(idx(board, 2, 2));
    expect(cells).not.toContain(idx(board, 1, 2));
    expect(cells).not.toContain(idx(board, 0, 2));
  });

  it("软砖自己会着火,但爆风到此为止", () => {
    const board = parse([".....", ".....", ".+...", ".....", "....."]);
    const cells = blastCells(board, idx(board, 3, 2), 3);
    expect(cells).toContain(idx(board, 1, 2));
    expect(cells).not.toContain(idx(board, 0, 2));
  });

  it("贯通爆风(pierce)能穿过软砖继续烧", () => {
    const board = parse([".....", ".....", ".+...", ".....", "....."]);
    const cells = blastCells(board, idx(board, 3, 2), 3, true);
    expect(cells).toContain(idx(board, 1, 2));
    expect(cells).toContain(idx(board, 0, 2));
  });

  it("power 为 0 时只烧脚下那一格", () => {
    const board = parse(["...", "...", "..."]);
    expect(blastCells(board, idx(board, 1, 1), 0)).toEqual([idx(board, 1, 1)]);
  });

  it("返回值升序去重,方便直接做集合运算", () => {
    const board = parse([".....", ".....", ".....", ".....", "....."]);
    const cells = blastCells(board, idx(board, 2, 2), 2);
    expect([...cells].sort((a, b) => a - b)).toEqual(cells);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe("连锁引爆(纯函数)", () => {
  it("爆风盖到的炸弹会被一起点着", () => {
    const board = parse([".......", ".......", "......."]);
    const a = bomb(1, idx(board, 1, 1), 2);
    const b = bomb(2, idx(board, 3, 1), 2);
    const res = chainBombs(board, [a, b], [1]);
    expect(res.ids).toEqual([1, 2]);
    expect(res.cells).toContain(idx(board, 5, 1));
  });

  it("隔着硬墙的炸弹不会被连锁", () => {
    const board = parse([".......", ".#.#.#.", "......."]);
    const a = bomb(1, idx(board, 0, 1), 3);
    const b = bomb(2, idx(board, 4, 1), 3);
    const res = chainBombs(board, [a, b], [1]);
    expect(res.ids).toEqual([1]);
  });

  it("一长串炸弹会一路传染下去", () => {
    const board = parse(["........."]);
    const bombs = [bomb(1, 0, 2), bomb(2, 2, 2), bomb(3, 4, 2), bomb(4, 6, 2)];
    expect(chainBombs(board, bombs, [1]).ids).toEqual([1, 2, 3, 4]);
  });

  it("传进来的炸弹数组不会被改动", () => {
    const board = parse(["....."]);
    const bombs = [bomb(1, 0, 2), bomb(2, 2, 2)];
    const snapshot = JSON.stringify(bombs);
    chainBombs(board, bombs, [1]);
    expect(JSON.stringify(bombs)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// 道具
// ---------------------------------------------------------------------------

describe("道具掉落(纯函数)", () => {
  it("同一颗种子同一格永远掉同一件,可以背板", () => {
    for (let cell = 0; cell < 40; cell++) {
      expect(rollItem(1234, cell)).toBe(rollItem(1234, cell));
    }
  });

  it("richness 为 0 时一件都不掉", () => {
    for (let cell = 0; cell < 40; cell++) {
      expect(rollItem(77, cell, 0)).toBeNull();
    }
  });

  it("掉出来的东西一定是六种道具之一,而且六种都掉得出来", () => {
    const seen = new Set<string>();
    for (let cell = 0; cell < 4000; cell++) {
      const item = rollItem(99, cell, 1);
      if (item) {
        expect(ITEM_KINDS).toContain(item);
        seen.add(item);
      }
    }
    expect(seen.size).toBe(ITEM_KINDS.length);
  });

  it("掉落率落在一个合理区间(既不遍地都是也不颗粒无收)", () => {
    let hits = 0;
    const total = 3000;
    for (let cell = 0; cell < total; cell++) if (rollItem(5, cell, 1)) hits++;
    const rate = hits / total;
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.55);
  });

  it("六种道具都有中文名和一句说明", () => {
    for (const kind of ITEM_KINDS) {
      expect(ITEM_INFO[kind].name.length).toBeGreaterThan(0);
      expect(ITEM_INFO[kind].line.length).toBeGreaterThan(4);
    }
  });

  it("火力 / 炸弹数 / 速度会顶到上限就不再涨", () => {
    const f = makeFighter(0, "鸭梨", "🍐", 0);
    for (let i = 0; i < 30; i++) {
      applyItem(f, "fire");
      applyItem(f, "bomb");
      applyItem(f, "speed");
    }
    expect(f.power).toBe(MAX_POWER);
    expect(f.bombs).toBe(MAX_BOMBS);
    expect(f.speed).toBe(MAX_SPEED);
  });

  it("三件特殊道具是开关型,捡第二次不再返回提升", () => {
    const f = makeFighter(0, "鸭梨", "🍐", 0);
    expect(applyItem(f, "kick")).toBe(true);
    expect(applyItem(f, "kick")).toBe(false);
    expect(applyItem(f, "ghost")).toBe(true);
    expect(applyItem(f, "remote")).toBe(true);
    expect(f.kick && f.ghost && f.remote).toBe(true);
  });

  it("速度档位越高,走一格用的时间越短", () => {
    for (let s = 1; s < MAX_SPEED; s++) {
      expect(stepMsFor(s + 1)).toBeLessThan(stepMsFor(s));
    }
  });
});

// ---------------------------------------------------------------------------
// 走位与放弹
// ---------------------------------------------------------------------------

function soloWorld(rows: string[], at: [number, number]): World {
  const board = parse(rows);
  const me = makeFighter(0, "鸭梨", "🍐", idx(board, at[0], at[1]));
  return createWorld({ board, fighters: [me], seed: 42, richness: 0 });
}

describe("走位", () => {
  it("空地能走,硬墙走不动", () => {
    const world = soloWorld(["###", "#.#", "###"], [1, 1]);
    expect(tryStep(world, 0, DIR_UP)).toBe(false);
    expect(world.fighters[0].pos).toBe(idx(world.board, 1, 1));
  });

  it("软砖挡路,但拿到穿墙泡就能钻过去", () => {
    const world = soloWorld(["###", "#.#", "#+#", "###"], [1, 1]);
    expect(tryStep(world, 0, DIR_DOWN)).toBe(false);
    world.fighters[0].ghost = true;
    expect(tryStep(world, 0, DIR_DOWN)).toBe(true);
    expect(world.fighters[0].pos).toBe(idx(world.board, 1, 2));
  });

  it("被泡泡包住的时候动不了也放不了弹", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    bubble(world, 0);
    expect(world.fighters[0].bubbleT).toBe(BUBBLE_MS);
    expect(tryStep(world, 0, DIR_RIGHT)).toBe(false);
    expect(dropBomb(world, 0)).toBeNull();
  });

  it("泡泡到点会自己破,人回到能动的状态", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    bubble(world, 0);
    run(world, BUBBLE_MS + 100);
    expect(world.fighters[0].bubbleT).toBe(0);
    expect(world.fighters[0].bubbled).toBe(1);
  });
});

describe("放弹与踢弹", () => {
  it("同时能摆的炸弹数受 bombs 限制", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    expect(dropBomb(world, 0)).not.toBeNull();
    expect(dropBomb(world, 0)).toBeNull();
    tryStep(world, 0, DIR_RIGHT);
    expect(dropBomb(world, 0)).toBeNull();
    world.fighters[0].bombs = 2;
    expect(dropBomb(world, 0)).not.toBeNull();
    expect(bombsOf(world, 0)).toBe(2);
  });

  it("脚下已经有一颗就不能再摞一颗", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    world.fighters[0].bombs = 3;
    dropBomb(world, 0);
    expect(dropBomb(world, 0)).toBeNull();
  });

  it("会踢炸弹的人撞上去,炸弹滑走、人留在原地", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1]);
    world.fighters[0].kick = true;
    dropBomb(world, 0);
    tryStep(world, 0, DIR_RIGHT);
    const b = world.bombs[0];
    b.pos = idx(world.board, 2, 1);
    b.slide = -1;
    world.fighters[0].pos = idx(world.board, 1, 1);
    expect(tryStep(world, 0, DIR_RIGHT)).toBe(false);
    expect(world.bombs[0].slide).toBe(DIR_RIGHT);
    run(world, 400);
    expect(world.bombs[0].pos).toBeGreaterThan(idx(world.board, 2, 1));
  });

  it("不会踢的人撞到炸弹只是被挡住", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1]);
    dropBomb(world, 0);
    world.fighters[0].pos = idx(world.board, 1, 1);
    const b = world.bombs[0];
    b.pos = idx(world.board, 2, 1);
    expect(tryStep(world, 0, DIR_RIGHT)).toBe(false);
    expect(b.slide).toBe(-1);
  });

  it("遥控弹要按引爆键才炸,而且只炸自己那几颗", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1]);
    world.fighters[0].remote = true;
    dropBomb(world, 0);
    run(world, FUSE_MS + 300);
    expect(world.bombs).toHaveLength(1);
    expect(detonate(world, 0)).toBe(1);
    expect(world.bombs).toHaveLength(0);
  });

  it("没有遥控道具时按引爆键没有任何反应", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1]);
    dropBomb(world, 0);
    expect(detonate(world, 0)).toBe(0);
    expect(world.bombs).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 爆炸结算
// ---------------------------------------------------------------------------

describe("爆炸结算", () => {
  it("炸掉软砖会留下爆风,砖变成空地", () => {
    const world = soloWorld(["#####", "#.+.#", "#####"], [1, 1]);
    const b = dropBomb(world, 0);
    explodeBombs(world, [b!.id]);
    expect(world.board.cells[idx(world.board, 2, 1)]).toBe(TILE_FLOOR);
    expect(world.flames.has(idx(world.board, 2, 1))).toBe(true);
  });

  it("砖底下藏的道具会落到地上,走过去就能捡", () => {
    const board = parse(["#####", "#.+.#", "#...#", "#####"]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const hidden = new Map([[idx(board, 2, 1), "fire" as const]]);
    const world = createWorld({ board, fighters: [me], hidden, seed: 3, richness: 0 });
    const b = dropBomb(world, 0);
    // 摆完弹躲到爆风外面去,免得自己先被泡泡包住
    world.fighters[0].pos = idx(board, 2, 2);
    explodeBombs(world, [b!.id]);
    expect(world.fighters[0].bubbleT).toBe(0);
    expect(world.items.get(idx(board, 2, 1))).toBe("fire");
    run(world, FLAME_MS + 60);
    expect(tryStep(world, 0, DIR_UP)).toBe(true);
    expect(world.fighters[0].power).toBe(3);
    expect(world.items.size).toBe(0);
  });

  it("站在爆风里的人会被泡泡包住(不掉血、不受伤)", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    const b = dropBomb(world, 0);
    explodeBombs(world, [b!.id]);
    expect(world.fighters[0].bubbleT).toBeGreaterThan(0);
    expect(world.fighters[0].bubbled).toBe(1);
  });

  it("一次爆风只算一次,不会连着把同一个人包好几层", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    const b = dropBomb(world, 0);
    explodeBombs(world, [b!.id]);
    run(world, FLAME_MS - 40);
    expect(world.fighters[0].bubbled).toBe(1);
  });

  it("小怪被爆风碰到就会被包成泡泡送回家", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const critter = makeCritter(1, "slime", idx(board, 3, 1));
    const world = createWorld({ board, fighters: [me], critters: [critter], seed: 1, richness: 0 });
    const b = dropBomb(world, 0);
    explodeBombs(world, [b!.id]);
    expect(world.critters).toHaveLength(0);
    expect(levelCleared(world)).toBe(true);
  });

  it("泡泡王要连着包三层才请得动", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const boss = makeCritter(1, "boss", idx(board, 3, 1));
    const world = createWorld({ board, fighters: [me], critters: [boss], seed: 1, richness: 0 });
    for (let i = 0; i < 3; i++) {
      world.critters[0].pos = idx(board, 3, 1);
      world.critters[0].hitCd = 0;
      const b = { ...bomb(100 + i, idx(board, 2, 1), 2) };
      world.bombs.push(b);
      explodeBombs(world, [b.id]);
      if (world.critters.length > 0) expect(world.critters[0].layers).toBe(2 - i);
    }
    expect(world.critters).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 世界推进
// ---------------------------------------------------------------------------

describe("世界推进", () => {
  it("引信烧完炸弹自己会炸,爆风过一会儿也会散", () => {
    const world = soloWorld(["#######", "#.....#", "#######"], [1, 1]);
    dropBomb(world, 0);
    world.fighters[0].pos = idx(world.board, 5, 1);
    run(world, FUSE_MS + 40);
    expect(world.bombs).toHaveLength(0);
    expect(world.flames.size).toBeGreaterThan(0);
    run(world, FLAME_MS + 60);
    expect(world.flames.size).toBe(0);
  });

  it("按住方向键会一格一格走,速度决定节奏", () => {
    const world = soloWorld(["#########", "#.......#", "#########"], [1, 1]);
    const startX = 1;
    run(world, 1000, () => [{ dir: DIR_RIGHT, drop: false, detonate: false }]);
    const moved = (world.fighters[0].pos % world.board.w) - startX;
    expect(moved).toBeGreaterThanOrEqual(3);
    expect(moved).toBeLessThanOrEqual(6);
  });

  it("限时到了 timeUp 变真,剩余秒数一路减到 0", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const world = createWorld({ board, fighters: [me], limit: 2000, seed: 1, richness: 0 });
    expect(secondsLeft(world)).toBe(2);
    run(world, 2100);
    expect(timeUp(world)).toBe(true);
    expect(secondsLeft(world)).toBe(0);
  });

  it("小怪撞到人也只是把人包成泡泡", () => {
    const board = parse(["#######", "#.....#", "#######"]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const critter = makeCritter(1, "chaser", idx(board, 5, 1));
    const world = createWorld({ board, fighters: [me], critters: [critter], seed: 1, richness: 0 });
    run(world, 3000);
    expect(world.fighters[0].bubbled).toBeGreaterThan(0);
    expect(world.critters).toHaveLength(1);
  });

  it("出口藏在砖底下,炸开以后走过去就算逃出去了", () => {
    const board = parse(["#####", "#..+#", "#...#", "#####"]);
    const me = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1));
    const exit = idx(board, 3, 1);
    const world = createWorld({ board, fighters: [me], exit, goal: "exit", seed: 1, richness: 0 });
    expect(levelCleared(world)).toBe(false);
    world.fighters[0].power = 3;
    const b = dropBomb(world, 0);
    world.fighters[0].pos = idx(board, 2, 2);
    explodeBombs(world, [b!.id]);
    expect(world.exitOpen).toBe(true);
    run(world, FLAME_MS + 60);
    world.fighters[0].pos = exit;
    stepWorld(world, 20, idle(1));
    expect(levelCleared(world)).toBe(true);
    expect(world.escaped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 胜负与评分
// ---------------------------------------------------------------------------

describe("胜负与评分", () => {
  it("对战里只剩一个人没被包住,这一局就归他", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const a = makeFighter(0, "鸭梨", "🍐", idx(board, 1, 1), 0);
    const b = makeFighter(1, "康康", "👓", idx(board, 3, 1), 1);
    const world = createWorld({ board, fighters: [a, b], seed: 1, richness: 0 });
    expect(roundWinner(world)).toBe(-1);
    bubble(world, 1);
    expect(roundWinner(world)).toBe(0);
  });

  it("先赢 3 局才拿下整场", () => {
    expect(matchWinner([2, 1])).toBe(-1);
    expect(matchWinner([3, 1])).toBe(0);
    expect(matchWinner([1, 3])).toBe(1);
  });

  it("评星:一次没被包又剩很多时间才给 3 星", () => {
    expect(rateLevel(60, 100, 0)).toBe(3);
    expect(rateLevel(25, 100, 0)).toBe(2);
    expect(rateLevel(60, 100, 2)).toBe(1);
    expect(rateLevel(5, 100, 0)).toBe(1);
  });

  it("失败文案只鼓励、给可执行的建议,不说重话", () => {
    for (const line of [loseLine("time"), loseLine("bubble")]) {
      expect(line.length).toBeGreaterThan(10);
      expect(/输|死|失败|笨/.test(line)).toBe(false);
    }
  });

  it("过关文案会把成绩讲清楚", () => {
    expect(winLine(30, 0, 4)).toContain("30");
    expect(winLine(0, 2, 5)).toContain("2");
  });
});

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

describe("双人键位", () => {
  it("鸭梨是 WASD + F/G,康康是方向键 + L/K,互不抢占", () => {
    expect(keyToAction("KeyW", 2)).toEqual({ player: 0, action: "up" });
    expect(keyToAction("KeyF", 2)).toEqual({ player: 0, action: "drop" });
    expect(keyToAction("KeyG", 2)).toEqual({ player: 0, action: "boom" });
    expect(keyToAction("ArrowUp", 2)).toEqual({ player: 1, action: "up" });
    expect(keyToAction("KeyL", 2)).toEqual({ player: 1, action: "drop" });
    expect(keyToAction("KeyK", 2)).toEqual({ player: 1, action: "boom" });
  });

  it("两套键位没有任何一个键重叠", () => {
    const p0 = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG"];
    const p1 = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyL", "KeyK"];
    for (const code of p0) expect(keyToAction(code, 2)?.player).toBe(0);
    for (const code of p1) expect(keyToAction(code, 2)?.player).toBe(1);
    expect(p0.filter((c) => p1.includes(c))).toEqual([]);
  });

  it("一个人玩的时候两套键位都归 1 号玩家", () => {
    expect(keyToAction("ArrowUp", 1)?.player).toBe(0);
    expect(keyToAction("KeyL", 1)?.player).toBe(0);
  });

  it("不认识的键返回 null,Esc 专门用来暂停", () => {
    expect(keyToAction("KeyZ", 2)).toBeNull();
    expect(isPauseKey("Escape")).toBe(true);
    expect(isPauseKey("KeyP")).toBe(false);
  });

  it("同时按住两个方向时,后按下去的那个说了算", () => {
    const held = [true, true, false, false];
    expect(pickDir(held, [DIR_UP, DIR_RIGHT])).toBe(DIR_RIGHT);
    expect(pickDir(held, [DIR_RIGHT, DIR_UP])).toBe(DIR_UP);
    expect(pickDir([false, false, false, false])).toBe(-1);
  });

  it("方向动作能翻译成方向,放弹 / 引爆不是方向", () => {
    expect(actionDir("left")).toBe(DIR_LEFT);
    expect(actionDir("down")).toBe(DIR_DOWN);
    expect(actionDir("drop")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 存档与小工具
// ---------------------------------------------------------------------------

describe("合作进度与小工具", () => {
  it("合作进度读写是一对互逆的纯函数,坏数据一律当第 1 关", () => {
    expect(parseCoopProgress(serializeCoopProgress(37))).toBe(37);
    expect(parseCoopProgress(null)).toBe(0);
    expect(parseCoopProgress("你好")).toBe(0);
    expect(parseCoopProgress("-5")).toBe(0);
    expect(parseCoopProgress("9999")).toBe(187);
  });

  it("时钟按 mm:ss 显示", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(125)).toBe("2:05");
  });

  it("bombAt 找得到脚下那颗炸弹", () => {
    const world = soloWorld(["#####", "#...#", "#####"], [1, 1]);
    expect(bombAt(world, world.fighters[0].pos)).toBeNull();
    dropBomb(world, 0);
    expect(bombAt(world, world.fighters[0].pos)).not.toBeNull();
  });
});
