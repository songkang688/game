/**
 * 铁皮坦克大战 · 规则单测:地图解析、地形性质、走位碰撞、开炮结算、
 * 寻路距离场、键位分工、评分与文案。全是纯函数,一条都不需要浏览器。
 */
import { describe, expect, it } from "vitest";
import {
  ACTION_DIR,
  BASE_BIAS,
  BRICK_HP,
  DEFAULT_BRICKS,
  ENEMY_KINDS,
  ENEMY_SPECS,
  KEY_MAP,
  PAUSE_KEY,
  TANK_HALF,
  UNREACHABLE,
  aliveEnemies,
  blocksBullet,
  blocksSight,
  blocksTank,
  canFire,
  canStand,
  createWorld,
  distanceField,
  endlessMaxAlive,
  endlessWave,
  endlessWaveSize,
  enemyIntent,
  fire,
  fortGaps,
  frontDoor,
  isFortBrick,
  keyConflicts,
  lineOfFire,
  loseLine,
  moveTank,
  parseMap,
  placeBrick,
  playerTank,
  rateRun,
  reachable,
  renderMap,
  scanFort,
  stepDownField,
  stepWorld,
  tankCell,
  tileAt,
  winLine,
  type Dir,
  type PlayerInput,
} from "./logic";
import { mulberry32 } from "../level99";

/** 一张 7x7 的小演习场,写测试比 13x13 好读 */
const TRAINING = [
  "e.....e",
  ".......",
  "..###..",
  "..#S#..",
  "..#~#..",
  "..*.*..",
  "1.#B#.2",
];

function press(dir: Dir | -1, fire = false, brick = false): PlayerInput {
  return { dir, fire, brick };
}

/**
 * 一个「不会自己结束」的演习场:队列里挂着一辆永远不出场的车,
 * 这样清场判定不会在第一帧就把这局判成胜利,方便单独验一条条规则。
 */
function sandbox(players: 1 | 2 = 1, bricks?: number) {
  const w = createWorld({
    rows: TRAINING,
    mode: "coop",
    players,
    limit: 600,
    bricks,
    queue: [{ kind: "swift", spawn: 0 }],
    spawnGap: 9999,
  });
  w.spawnTimer = 9999;
  return w;
}

describe("地图解析", () => {
  it("认得出全部六种地形,顺便把出生点抠出来", () => {
    const map = parseMap(TRAINING);
    expect(map.w).toBe(7);
    expect(map.h).toBe(7);
    expect(map.base).toEqual({ cx: 3, cy: 6 });
    expect(map.playerSpawns[0]).toEqual({ cx: 0, cy: 6 });
    expect(map.playerSpawns[1]).toEqual({ cx: 6, cy: 6 });
    expect(map.enemySpawns).toHaveLength(2);
    expect(tileAt(map, 3, 3)).toBe("S");
    expect(tileAt(map, 3, 4)).toBe("~");
    expect(tileAt(map, 2, 5)).toBe("*");
  });

  it("出生点那一格本身是空地,坦克才站得进去", () => {
    const map = parseMap(TRAINING);
    expect(tileAt(map, 0, 6)).toBe(".");
    expect(tileAt(map, 6, 0)).toBe(".");
  });

  it("砖墙一开局就是满耐久", () => {
    const map = parseMap(TRAINING);
    const i = 2 * map.w + 2;
    expect(map.tiles[i]).toBe("#");
    expect(map.brickHp[i]).toBe(BRICK_HP);
  });

  it("越界一律当钢墙,免得到处判边界", () => {
    const map = parseMap(TRAINING);
    expect(tileAt(map, -1, 0)).toBe("S");
    expect(tileAt(map, 0, 99)).toBe("S");
  });

  it("行长不齐、字符不认识、空地图都会当场报错", () => {
    expect(() => parseMap([])).toThrow();
    expect(() => parseMap(["...", "...."])).toThrow(/长度/);
    expect(() => parseMap(["..X"])).toThrow(/不认识/);
    expect(() => parseMap(["..."])).toThrow(/出生点/);
  });

  it("导回字符网格能和原图对上", () => {
    expect(renderMap(parseMap(TRAINING))).toEqual(TRAINING);
  });
});

describe("地形的三种「挡」", () => {
  it("坦克过不去的是砖、钢、水和堡垒", () => {
    expect(blocksTank("#")).toBe(true);
    expect(blocksTank("S")).toBe(true);
    expect(blocksTank("~")).toBe(true);
    expect(blocksTank("B")).toBe(true);
    expect(blocksTank("*")).toBe(false);
    expect(blocksTank(".")).toBe(false);
  });

  it("炮弹飞得过水面和草丛,飞不过砖钢和堡垒", () => {
    expect(blocksBullet("~")).toBe(false);
    expect(blocksBullet("*")).toBe(false);
    expect(blocksBullet("#")).toBe(true);
    expect(blocksBullet("S")).toBe(true);
    expect(blocksBullet("B")).toBe(true);
  });

  it("草丛只挡视线:看不见,但打得到", () => {
    expect(blocksSight("*")).toBe(true);
    expect(blocksBullet("*")).toBe(false);
    expect(blocksTank("*")).toBe(false);
  });
});

describe("键位:朵朵和星星互不抢占", () => {
  it("一个键只属于一位玩家", () => {
    expect(keyConflicts()).toEqual([]);
  });

  it("朵朵是 WASD + F/G,星星是方向键 + L/K", () => {
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG"]) {
      expect(KEY_MAP[code].player, code).toBe(0);
    }
    for (const code of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyL", "KeyK"]) {
      expect(KEY_MAP[code].player, code).toBe(1);
    }
  });

  it("两边各有一整套动作,谁也不缺胳膊少腿", () => {
    for (const player of [0, 1]) {
      const actions = Object.values(KEY_MAP)
        .filter((b) => b.player === player)
        .map((b) => b.action)
        .sort();
      expect(actions).toEqual(["brick", "down", "fire", "left", "right", "up"]);
    }
  });

  it("方向动作对得上方向号,暂停键是 Esc", () => {
    expect(ACTION_DIR.up).toBe(0);
    expect(ACTION_DIR.right).toBe(1);
    expect(ACTION_DIR.down).toBe(2);
    expect(ACTION_DIR.left).toBe(3);
    expect(PAUSE_KEY).toBe("Escape");
  });
});

describe("走位与碰撞", () => {
  function world() {
    return sandbox(2);
  }

  it("空地上走得动,墙里走不进去", () => {
    const w = world();
    const duo = playerTank(w, 0)!;
    expect(moveTank(w, duo, 0, 0.5)).toBe(true);
    expect(duo.y).toBeCloseTo(6.0, 5);
    duo.x = 3.5;
    duo.y = 5.5;
    expect(moveTank(w, duo, 2, 0.5)).toBe(false);
  });

  it("水面和堡垒都过不去,草丛可以开过去", () => {
    const w = world();
    const duo = playerTank(w, 0)!;
    duo.x = 3.5;
    duo.y = 3.4;
    expect(canStand(w, duo, 3.5, 4.5)).toBe(false);
    duo.x = 2.5;
    duo.y = 4.5;
    expect(canStand(w, duo, 2.5, 5.5)).toBe(true);
  });

  it("两辆坦克不会叠在一起", () => {
    const w = world();
    const duo = playerTank(w, 0)!;
    const xing = playerTank(w, 1)!;
    duo.x = 1.5;
    duo.y = 1.5;
    xing.x = 2.2;
    xing.y = 1.5;
    expect(canStand(w, duo, 2.1, 1.5)).toBe(false);
    expect(canStand(w, duo, 0.5, 1.5)).toBe(true);
  });

  it("横着走时会自动往车道中线靠,免得卡在墙角", () => {
    const w = world();
    const duo = playerTank(w, 0)!;
    duo.x = 1.5;
    duo.y = 1.2;
    moveTank(w, duo, 1, 0.3);
    expect(duo.y).toBeGreaterThan(1.2);
    expect(duo.y).toBeLessThanOrEqual(1.5);
  });

  it("坦克有大小,不是一个点", () => {
    expect(TANK_HALF).toBeGreaterThan(0.3);
    expect(TANK_HALF).toBeLessThan(0.5);
  });
});

describe("开炮与炮弹", () => {
  it("冷却没好、场上炮弹满了就打不出去", () => {
    const w = sandbox(1);
    const duo = playerTank(w, 0)!;
    expect(canFire(duo)).toBe(true);
    expect(fire(w, duo)).not.toBeNull();
    expect(canFire(duo)).toBe(false);
    duo.cool = 0;
    expect(fire(w, duo)).not.toBeNull();
    duo.cool = 0;
    expect(fire(w, duo)).toBeNull();
  });

  it("被弹飞打转的时候开不了炮", () => {
    const w = sandbox(1);
    const duo = playerTank(w, 0)!;
    duo.spin = 1;
    expect(canFire(duo)).toBe(false);
  });

  it("砖墙要挨两发才塌,钢墙怎么打都在", () => {
    const w = sandbox(1);
    const duo = playerTank(w, 0)!;
    duo.x = 2.5;
    duo.y = 0.5;
    duo.dir = 2;
    const brick = 2 * w.map.w + 2;
    for (let i = 0; i < 2; i++) {
      duo.cool = 0;
      duo.shots = 0;
      fire(w, duo);
      for (let k = 0; k < 30 && w.map.brickHp[brick] > BRICK_HP - 1 - i; k++) stepWorld(w, 1 / 60, []);
    }
    expect(w.map.tiles[brick]).toBe(".");

    const steel = 3 * w.map.w + 3;
    duo.x = 3.5;
    duo.y = 1.5;
    duo.dir = 2;
    for (let i = 0; i < 4; i++) {
      duo.cool = 0;
      duo.shots = 0;
      fire(w, duo);
      for (let k = 0; k < 20; k++) stepWorld(w, 1 / 60, []);
    }
    expect(w.map.tiles[steel]).toBe("S");
  });

  it("我方炮弹不会误伤队友(合作模式)", () => {
    const w = sandbox(2);
    const duo = playerTank(w, 0)!;
    const xing = playerTank(w, 1)!;
    duo.x = 1.5;
    duo.y = 1.5;
    duo.dir = 1;
    xing.x = 3.5;
    xing.y = 1.5;
    xing.shield = 0;
    const before = w.bounced;
    fire(w, duo);
    for (let i = 0; i < 40; i++) stepWorld(w, 1 / 60, []);
    expect(w.bounced).toBe(before);
  });

  it("敌方坦克按装甲数决定要挨几发", () => {
    for (const kind of ENEMY_KINDS) {
      expect(ENEMY_SPECS[kind].armor).toBeGreaterThanOrEqual(1);
    }
    expect(ENEMY_SPECS.armor.armor).toBe(2);
    expect(ENEMY_SPECS.swift.armor).toBe(1);
  });

  it("敌人四种各有各的脾气:快的最快、装甲最厚、火力最快手、机灵最爱偷家", () => {
    expect(ENEMY_SPECS.swift.speed).toBeGreaterThan(ENEMY_SPECS.armor.speed);
    expect(ENEMY_SPECS.armor.armor).toBeGreaterThan(ENEMY_SPECS.swift.armor);
    expect(ENEMY_SPECS.power.cool).toBeLessThan(ENEMY_SPECS.swift.cool);
    expect(BASE_BIAS.smart).toBeGreaterThan(BASE_BIAS.swift);
    expect(BASE_BIAS.smart).toBeGreaterThan(BASE_BIAS.power);
  });
});

describe("补墙", () => {
  it("车头前面是空地才放得下,放一块少一块", () => {
    const w = sandbox(1, 2);
    const duo = playerTank(w, 0)!;
    duo.x = 0.5;
    duo.y = 5.5;
    duo.dir = 0;
    expect(placeBrick(w, duo)).toBe(true);
    expect(tileAt(w.map, 0, 4)).toBe("#");
    expect(duo.bricks).toBe(1);
    // 同一格已经有砖了,再放放不下
    expect(placeBrick(w, duo)).toBe(false);
  });

  it("砖用完了就放不了", () => {
    const w = sandbox(1, 0);
    const duo = playerTank(w, 0)!;
    expect(placeBrick(w, duo)).toBe(false);
  });

  it("默认每人带几块砖是说得清的数", () => {
    expect(DEFAULT_BRICKS).toBeGreaterThanOrEqual(3);
    const w = sandbox(1);
    expect(playerTank(w, 0)!.bricks).toBe(DEFAULT_BRICKS);
  });
});

describe("护墙与堡垒", () => {
  it("护墙就是堡垒周围两格内的砖", () => {
    const map = parseMap(TRAINING);
    expect(isFortBrick(map, 2, 6)).toBe(true);
    expect(isFortBrick(map, 4, 6)).toBe(true);
    expect(isFortBrick(map, 2, 2)).toBe(false);
    expect(scanFort(map).length).toBeGreaterThanOrEqual(2);
  });

  it("护墙被打掉就会出现在缺口清单里", () => {
    const w = sandbox(1);
    expect(fortGaps(w)).toEqual([]);
    const i = 6 * w.map.w + 2;
    w.map.tiles[i] = ".";
    expect(fortGaps(w)).toEqual([{ cx: 2, cy: 6 }]);
  });

  it("正门是堡垒上面那两格,机灵车专门绕开它", () => {
    const map = parseMap(TRAINING);
    expect(frontDoor(map)).toEqual([
      { cx: 3, cy: 5 },
      { cx: 3, cy: 4 },
    ]);
  });
});

describe("寻路距离场", () => {
  it("离目标越远数字越大,钢墙和水面走不通", () => {
    const map = parseMap(TRAINING);
    const field = distanceField(map, [{ cx: 0, cy: 0 }]);
    expect(field[0]).toBe(0);
    expect(field[map.w]).toBe(1);
    expect(field[3 * map.w + 3]).toBe(UNREACHABLE);
  });

  it("砖墙只是「贵一点」,不是走不通", () => {
    const map = parseMap(["1..", ".#.", "..B"]);
    const cheap = distanceField(map, [{ cx: 2, cy: 2 }], { brickCost: 1 });
    const dear = distanceField(map, [{ cx: 2, cy: 2 }], { brickCost: 9 });
    expect(cheap[1 * map.w + 1]).toBeLessThan(dear[1 * map.w + 1]);
  });

  it("顺着距离场走一步,方向是对的", () => {
    const map = parseMap(["1..", "...", "..B"]);
    const field = distanceField(map, [{ cx: 2, cy: 2 }]);
    const dir = stepDownField(map, field, { cx: 0, cy: 0 });
    expect([1, 2]).toContain(dir);
    expect(stepDownField(map, field, { cx: 2, cy: 2 })).toBe(-1);
  });

  it("blocked 能把某些格子封起来(机灵车绕后就靠它)", () => {
    const map = parseMap(["1.....", "SSSS.S", "...B.S"]);
    const open = distanceField(map, [{ cx: 3, cy: 2 }]);
    const shut = distanceField(map, [{ cx: 3, cy: 2 }], { blocked: [{ cx: 4, cy: 1 }] });
    expect(open[0]).toBeLessThan(UNREACHABLE);
    expect(shut[0]).toBe(UNREACHABLE);
  });

  it("能判断两点之间通不通", () => {
    const map = parseMap(TRAINING);
    expect(reachable(map, { cx: 0, cy: 0 }, { cx: 3, cy: 6 })).toBe(true);
    expect(reachable(map, { cx: 0, cy: 0 }, { cx: 3, cy: 4 })).toBe(false);
  });
});

describe("射线:这一炮打出去会打到什么", () => {
  it("认得出砖墙、钢墙、堡垒和坦克", () => {
    const w = sandbox(2);
    const duo = playerTank(w, 0)!;
    duo.x = 2.5;
    duo.y = 0.5;
    duo.dir = 2;
    expect(lineOfFire(w, duo).kind).toBe("brick");

    // 从下往上打:先飞过水面,撞在钢墙上
    duo.x = 3.5;
    duo.y = 5.5;
    duo.dir = 0;
    expect(lineOfFire(w, duo).kind).toBe("steel");

    const xing = playerTank(w, 1)!;
    duo.x = 1.5;
    duo.y = 1.5;
    duo.dir = 1;
    xing.x = 4.5;
    xing.y = 1.5;
    expect(lineOfFire(w, duo).kind).toBe("player");
  });

  it("草丛不挡炮弹:看不见也打得到", () => {
    const w = sandbox(2);
    const duo = playerTank(w, 0)!;
    const xing = playerTank(w, 1)!;
    duo.x = 2.5;
    duo.y = 5.5;
    duo.dir = 1;
    xing.x = 4.5;
    xing.y = 5.5;
    expect(tileAt(w.map, 2, 5)).toBe("*");
    expect(lineOfFire(w, duo).kind).toBe("player");
  });
});

describe("敌人 AI", () => {
  it("想偷家的时候会往堡垒挪", () => {
    const w = createWorld({
      rows: TRAINING,
      mode: "campaign",
      players: 1,
      limit: 60,
      queue: [{ kind: "swift", spawn: 0 }],
      spawnGap: 0.1,
    });
    for (let i = 0; i < 40; i++) stepWorld(w, 1 / 60, [press(-1)]);
    const foe = aliveEnemies(w)[0];
    expect(foe).toBeTruthy();
    foe.goal = "base";
    const intent = enemyIntent(w, foe);
    expect(intent.dir).toBeGreaterThanOrEqual(0);
  });

  it("卡住之前不会顺手拆挡路的砖(护墙才保得住)", () => {
    const w = createWorld({
      rows: TRAINING,
      mode: "campaign",
      players: 1,
      limit: 60,
      queue: [{ kind: "swift", spawn: 0 }],
      spawnGap: 0.05,
    });
    for (let i = 0; i < 40; i++) stepWorld(w, 1 / 60, [press(-1)]);
    const foe = aliveEnemies(w)[0];
    foe.x = 2.5;
    foe.y = 1.5;
    foe.dir = 2;
    foe.goal = "base";
    foe.stuck = 0;
    expect(enemyIntent(w, foe).fire).toBe(false);
  });

  it("出场会排队,同屏不会超过 maxAlive", () => {
    const w = createWorld({
      rows: TRAINING,
      mode: "campaign",
      players: 1,
      limit: 120,
      queue: Array.from({ length: 8 }, () => ({ kind: "swift" as const, spawn: 0 })),
      maxAlive: 2,
      spawnGap: 0.1,
    });
    for (let i = 0; i < 600; i++) {
      stepWorld(w, 1 / 60, [press(-1)]);
      expect(aliveEnemies(w).length).toBeLessThanOrEqual(2);
    }
  });
});

describe("回合结束与评分", () => {
  it("车全清完就赢,时间到没清完就重来", () => {
    const w = createWorld({ rows: TRAINING, mode: "campaign", players: 1, limit: 2, queue: [] });
    stepWorld(w, 0.1, [press(-1)]);
    expect(w.status).toBe("win");

    const slow = createWorld({
      rows: TRAINING,
      mode: "campaign",
      players: 1,
      limit: 1,
      queue: [{ kind: "armor", spawn: 0 }],
      spawnGap: 0.1,
    });
    for (let i = 0; i < 120; i++) stepWorld(slow, 1 / 60, [press(-1)]);
    expect(slow.status).toBe("lose");
    expect(slow.reason).toContain("时间到");
  });

  it("评星:又快又稳三星,拖到最后一星", () => {
    expect(rateRun(30, 120, 0)).toBe(3);
    expect(rateRun(30, 120, 3)).toBe(2);
    expect(rateRun(110, 120, 0)).toBe(1);
    expect(rateRun(0, 0, 0)).toBe(1);
  });

  it("结算文案说清楚战果,失败只给方法", () => {
    expect(winLine(3, 12, 0)).toContain("12");
    expect(winLine(1, 5, 4)).toContain("补上堡垒周围的砖");
    expect(loseLine("星星堡垒被砸中啦", 6)).toContain("补回去");
    expect(loseLine("时间到,还有坦克没清完", 6)).toContain("离堡垒最近");
    for (const line of [winLine(2, 3, 1), loseLine("时间到", 1)]) {
      expect(line).not.toMatch(/输|死|血|伤/);
    }
  });
});

describe("无尽敌潮的节奏", () => {
  it("波次越大人越多,但有上限", () => {
    expect(endlessWaveSize(1)).toBeLessThan(endlessWaveSize(6));
    expect(endlessWaveSize(99)).toBeLessThanOrEqual(14);
    expect(endlessMaxAlive(1)).toBeLessThanOrEqual(endlessMaxAlive(9));
    expect(endlessMaxAlive(99)).toBeLessThanOrEqual(8);
  });

  it("新车型是一波一波解锁的", () => {
    const rand = mulberry32(3);
    const first = endlessWave(1, rand).map((s) => s.kind);
    expect(new Set(first)).toEqual(new Set(["swift"]));
    const late = endlessWave(9, mulberry32(3)).map((s) => s.kind);
    expect(new Set(late).size).toBeGreaterThan(1);
  });

  it("同一颗种子生成的敌潮一模一样", () => {
    const a = endlessWave(5, mulberry32(11));
    const b = endlessWave(5, mulberry32(11));
    expect(a).toEqual(b);
  });
});

describe("坦克所在格", () => {
  it("坐标折算成格子是向下取整", () => {
    const w = sandbox(1);
    const duo = playerTank(w, 0)!;
    duo.x = 3.9;
    duo.y = 2.1;
    expect(tankCell(duo)).toEqual({ cx: 3, cy: 2 });
  });
});
