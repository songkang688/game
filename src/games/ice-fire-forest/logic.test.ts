/**
 * 冰冰火火森林 · 纯逻辑用例。
 *
 * 每一条机关规则都用一张手写的小网格钉住:改坏了任何一条,这里立刻红。
 */
import { describe, expect, it } from "vitest";
import {
  ACTION_DIR,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  ENTER_HURT,
  ENTER_OK,
  ENTER_SOLID,
  HERO_NAMES,
  HERO_SHORT,
  KEY_MAP,
  LEGEND,
  MAX_HEARTS,
  POWER_CHARGES,
  POWER_CHARGES_MAX,
  TILE,
  canEnter,
  computeLight,
  computePower,
  formatClock,
  gemOwner,
  gemsAllReachable,
  initialState,
  isAdjacent,
  isKnownChar,
  isWin,
  keySetsDisjoint,
  loseLine,
  moveHero,
  parseLevel,
  parSeconds,
  rateRun,
  searchFrom,
  solveLevel,
  threeStarSeconds,
  timeLimitSeconds,
  traceBeam,
  twoStarSeconds,
  useElementPower,
  waitingLine,
  winLine,
  type GameState,
  type Hero,
  type ParsedLevel,
} from "./logic";

/** 把 (x,y) 换成格号 */
function at(lv: ParsedLevel, x: number, y: number): number {
  return y * lv.w + x;
}

/** 从一个状态出发走一串步子,任何一步走不动就直接报错(测试里要的是确定性) */
function walk(
  lv: ParsedLevel,
  st: GameState,
  moves: Array<[Hero, number]>
): GameState {
  let cur = st;
  moves.forEach(([hero, dir], i) => {
    const out = moveHero(lv, cur, hero, dir);
    if (out.kind !== "moved") {
      throw new Error(`第 ${i + 1} 步(${hero} 往 ${dir})没走成:${out.kind}`);
    }
    cur = out.state;
  });
  return cur;
}

const PLAIN = ["#######", "#L...l#", "#.....#", "#Y...y#", "#######"];

const ELEMENTS = ["#######", "#L.~.l#", "#..#..#", "#Y.^.y#", "#######"];

describe("字符网格解析", () => {
  it("读得出尺寸、出发点与两扇门", () => {
    const lv = parseLevel(PLAIN);
    expect(lv.w).toBe(7);
    expect(lv.h).toBe(5);
    expect(lv.iceStart).toBe(at(lv, 1, 1));
    expect(lv.fireStart).toBe(at(lv, 1, 3));
    expect(lv.iceDoor).toBe(at(lv, 5, 1));
    expect(lv.fireDoor).toBe(at(lv, 5, 3));
    expect(lv.gems).toEqual([]);
    expect(lv.leverGroupMask).toBe(0);
  });

  it("读得出宝石归属与机关组号", () => {
    const lv = parseLevel(["#########", "#L.o*+.l#", "#.1.4.A.#", "#Y..a..y#", "#########"]);
    expect(lv.gems.map((g) => g.kind)).toEqual(["blue", "red", "white"]);
    expect(lv.tiles[at(lv, 2, 2)]).toBe(TILE.PLATE);
    expect(lv.aux[at(lv, 2, 2)]).toBe(0);
    expect(lv.tiles[at(lv, 4, 2)]).toBe(TILE.LEVER);
    expect(lv.leverGroupMask).toBe(0b001);
    expect(lv.tiles[at(lv, 6, 2)]).toBe(TILE.GATE);
    expect(lv.tiles[at(lv, 4, 3)]).toBe(TILE.SEESAW);
  });

  it("网格不合法就抛错,不会把坏图丢给孩子", () => {
    expect(() => parseLevel(["#####", "#L.l#"])).toThrow();
    expect(() => parseLevel(["#######", "#L..l#", "#Y...y#", "#######"])).toThrow();
    expect(() => parseLevel(["#######", "#L.?.l#", "#Y...y#", "#######"])).toThrow();
    expect(() => parseLevel(["#######", "#....l#", "#Y...y#", "#######"])).toThrow();
    expect(() => parseLevel(["#######", "#L....#", "#Y...y#", "#######"])).toThrow();
  });

  it("速查表里的字符都认得,而且没有重复", () => {
    const chars = LEGEND.map((e) => e.ch);
    expect(new Set(chars).size).toBe(chars.length);
    for (const ch of chars) expect(isKnownChar(ch)).toBe(true);
    expect(isKnownChar("?")).toBe(false);
  });
});

describe("冰水与岩浆", () => {
  it("凛凛趟得过冰水,焰焰碰到就要被弹回来", () => {
    const lv = parseLevel(ELEMENTS);
    const st = initialState(lv);
    const water = at(lv, 3, 1);
    expect(canEnter(lv, water, "ice", 0, false, false)).toBe(ENTER_OK);
    expect(canEnter(lv, water, "fire", 0, false, false)).toBe(ENTER_HURT);
    const two = walk(lv, st, [
      ["ice", DIR_RIGHT],
      ["ice", DIR_RIGHT],
    ]);
    expect(two.ice).toBe(water);
  });

  it("焰焰踩得住岩浆,凛凛碰到就要被弹回来", () => {
    const lv = parseLevel(ELEMENTS);
    const lava = at(lv, 3, 3);
    expect(canEnter(lv, lava, "fire", 0, false, false)).toBe(ENTER_OK);
    expect(canEnter(lv, lava, "ice", 0, false, false)).toBe(ENTER_HURT);
  });

  it("绿黏液两个人都得绕开", () => {
    const lv = parseLevel(["#######", "#L.%.l#", "#..#..#", "#Y.%.y#", "#######"]);
    const slime = at(lv, 3, 1);
    expect(canEnter(lv, slime, "ice", 0, false, false)).toBe(ENTER_HURT);
    expect(canEnter(lv, slime, "fire", 0, false, false)).toBe(ENTER_HURT);
  });

  it("门只认自己的主人", () => {
    const lv = parseLevel(PLAIN);
    expect(canEnter(lv, lv.iceDoor, "ice", 0, false, false)).toBe(ENTER_OK);
    expect(canEnter(lv, lv.iceDoor, "fire", 0, false, false)).toBe(ENTER_SOLID);
    expect(canEnter(lv, lv.fireDoor, "fire", 0, false, false)).toBe(ENTER_OK);
    expect(canEnter(lv, lv.fireDoor, "ice", 0, false, false)).toBe(ENTER_SOLID);
  });

  it("撞墙 / 撞同伴都走不动,状态也不会被改坏", () => {
    const lv = parseLevel(PLAIN);
    const st = initialState(lv);
    expect(moveHero(lv, st, "ice", DIR_UP).kind).toBe("solid");
    expect(moveHero(lv, st, "ice", DIR_LEFT).kind).toBe("solid");
    const together: GameState = { ice: at(lv, 2, 2), fire: at(lv, 3, 2), levers: 0 };
    expect(moveHero(lv, together, "ice", DIR_RIGHT).kind).toBe("solid");
    expect(st.ice).toBe(lv.iceStart);
  });

  it("危险格返回 hurt,而且人不会真的走进去", () => {
    const lv = parseLevel(ELEMENTS);
    const st: GameState = { ice: at(lv, 2, 3), fire: lv.fireStart, levers: 0 };
    const out = moveHero(lv, st, "ice", DIR_RIGHT);
    expect(out.kind).toBe("hurt");
    expect(out.state.ice).toBe(at(lv, 2, 3));
  });
});

describe("踏板与石闸门", () => {
  const PLATE_LEVEL = ["#########", "#L..A..l#", "#.1.#...#", "#Y..^..y#", "#########"];

  it("没人压踏板时闸门是关的,压上去就开", () => {
    const lv = parseLevel(PLATE_LEVEL);
    const st = initialState(lv);
    expect(computePower(lv, st)).toBe(0);
    expect(canEnter(lv, at(lv, 4, 1), "ice", 0, false, false)).toBe(ENTER_SOLID);
    const onPlate: GameState = { ice: lv.iceStart, fire: at(lv, 2, 2), levers: 0 };
    expect(computePower(lv, onPlate)).toBe(0b001);
    expect(canEnter(lv, at(lv, 4, 1), "ice", 0b001, false, false)).toBe(ENTER_OK);
  });

  it("一个人压着、另一个人过,是这一关的正解", () => {
    const lv = parseLevel(PLATE_LEVEL);
    const res = solveLevel(lv);
    expect(res.solvable).toBe(true);
    expect(res.steps).toBeGreaterThan(0);
  });

  it("人一走开闸门立刻关上", () => {
    const lv = parseLevel(PLATE_LEVEL);
    const onPlate: GameState = { ice: lv.iceStart, fire: at(lv, 2, 2), levers: 0 };
    const off = moveHero(lv, onPlate, "fire", DIR_LEFT);
    expect(off.kind).toBe("moved");
    expect(computePower(lv, off.state)).toBe(0);
  });
});

describe("拉杆与跷跷门", () => {
  const LEVER_LEVEL = ["#########", "#L..A..l#", "#.4.#...#", "#Y..^..y#", "#########"];

  it("踩上拉杆才切换,退回来不会再切一次", () => {
    const lv = parseLevel(LEVER_LEVEL);
    const st = initialState(lv);
    const down = moveHero(lv, st, "ice", DIR_DOWN);
    const on = moveHero(lv, down.state, "ice", DIR_RIGHT);
    expect(on.state.levers).toBe(0b001);
    const back = moveHero(lv, on.state, "ice", DIR_LEFT);
    expect(back.state.levers).toBe(0b001);
    const again = moveHero(lv, back.state, "ice", DIR_RIGHT);
    expect(again.state.levers).toBe(0);
  });

  it("拉开之后闸门就一直开着,两个人都能过", () => {
    const lv = parseLevel(LEVER_LEVEL);
    const res = solveLevel(lv);
    expect(res.solvable).toBe(true);
  });

  it("跷跷门和石闸门永远相反", () => {
    const lv = parseLevel(["#########", "#L..A..l#", "#.4.a...#", "#Y..#..y#", "#########"]);
    const gate = at(lv, 4, 1);
    const seesaw = at(lv, 4, 2);
    expect(canEnter(lv, gate, "ice", 0, false, false)).toBe(ENTER_SOLID);
    expect(canEnter(lv, seesaw, "ice", 0, false, false)).toBe(ENTER_OK);
    expect(canEnter(lv, gate, "ice", 0b001, false, false)).toBe(ENTER_OK);
    expect(canEnter(lv, seesaw, "ice", 0b001, false, false)).toBe(ENTER_SOLID);
  });
});

describe("传送带", () => {
  const BELT_LEVEL = ["#########", "#L>>>..l#", "#.......#", "#Y.....y#", "#########"];

  it("踏上去就一路滑到尽头", () => {
    const lv = parseLevel(BELT_LEVEL);
    const st = initialState(lv);
    const out = moveHero(lv, st, "ice", DIR_RIGHT);
    expect(out.kind).toBe("moved");
    expect(out.state.ice).toBe(at(lv, 5, 1));
    expect(out.icePath).toEqual([at(lv, 2, 1), at(lv, 3, 1), at(lv, 4, 1), at(lv, 5, 1)]);
  });

  it("有人挡在带子出口时就停在他后面,不会叠在一起", () => {
    const lv = parseLevel(BELT_LEVEL);
    const st: GameState = { ice: lv.iceStart, fire: at(lv, 5, 1), levers: 0 };
    const out = moveHero(lv, st, "ice", DIR_RIGHT);
    expect(out.state.ice).toBe(at(lv, 4, 1));
    expect(out.state.fire).not.toBe(out.state.ice);
  });

  it("四个方向的带子都认", () => {
    const lv = parseLevel(["#######", "#L.v.l#", "#..u..#", "#Y...y#", "#######"]);
    expect(lv.aux[at(lv, 3, 1)]).toBe(2);
    expect(lv.aux[at(lv, 3, 2)]).toBe(3);
  });
});

describe("托举高坎", () => {
  const LIFT_LEVEL = ["#########", "#Lt.H.tl#", "#...#...#", "#Y.....y#", "#########"];

  it("同伴不在托举点上就爬不上去", () => {
    const lv = parseLevel(LIFT_LEVEL);
    const ledge = at(lv, 4, 1);
    expect(canEnter(lv, ledge, "ice", 0, false, false)).toBe(ENTER_SOLID);
    expect(canEnter(lv, ledge, "ice", 0, false, true)).toBe(ENTER_OK);
  });

  it("同伴踩住托举点,这一步就走得动了", () => {
    const lv = parseLevel(LIFT_LEVEL);
    const blocked: GameState = { ice: at(lv, 3, 1), fire: at(lv, 1, 3), levers: 0 };
    expect(moveHero(lv, blocked, "ice", DIR_RIGHT).kind).toBe("solid");
    const helped: GameState = { ice: at(lv, 3, 1), fire: at(lv, 2, 1), levers: 0 };
    const out = moveHero(lv, helped, "ice", DIR_RIGHT);
    expect(out.kind).toBe("moved");
    expect(out.state.ice).toBe(at(lv, 4, 1));
  });
});

describe("光束、斜镜与光门", () => {
  it("光打到接收器,光门才开", () => {
    const lv = parseLevel(["########", "#L.....#", "#e.R.Dl#", "#......#", "#Y....y#", "########"]);
    const st = initialState(lv);
    expect(computeLight(lv, st, 0)).toBe(true);
    expect(canEnter(lv, at(lv, 5, 2), "ice", 0, true, false)).toBe(ENTER_OK);
    expect(canEnter(lv, at(lv, 5, 2), "ice", 0, false, false)).toBe(ENTER_SOLID);
  });

  it("光路上的石闸门没开,光就过不去", () => {
    const lv = parseLevel(["########", "#L.....#", "#eAR.Dl#", "#.1....#", "#Y....y#", "########"]);
    const dark: GameState = { ice: lv.iceStart, fire: lv.fireStart, levers: 0 };
    expect(computeLight(lv, dark, computePower(lv, dark))).toBe(false);
    const onPlate: GameState = { ice: lv.iceStart, fire: at(lv, 2, 3), levers: 0 };
    const power = computePower(lv, onPlate);
    expect(power).toBe(0b001);
    expect(computeLight(lv, onPlate, power)).toBe(true);
  });

  it("斜镜会把光拐弯", () => {
    const lv = parseLevel(["########", "#e..\\.l#", "#L....##", "#...R.##", "#Y....y#", "########"]);
    const st = initialState(lv);
    expect(computeLight(lv, st, 0)).toBe(true);
    const path = traceBeam(lv, st, 0);
    expect(path).toContain(at(lv, 4, 1));
    expect(path).toContain(at(lv, 4, 3));
  });

  it("人站在光路上会把光挡断", () => {
    const lv = parseLevel(["########", "#e..\\.l#", "#L....##", "#...R.##", "#Y....y#", "########"]);
    const blocking: GameState = { ice: at(lv, 4, 2), fire: at(lv, 1, 4), levers: 0 };
    expect(computeLight(lv, blocking, 0)).toBe(false);
  });

  it("没有发射器的关卡光门永远是关的", () => {
    const lv = parseLevel(PLAIN);
    expect(computeLight(lv, initialState(lv), 0)).toBe(false);
    expect(traceBeam(lv, initialState(lv), 0)).toEqual([]);
  });
});

describe("元素之力", () => {
  it("凛凛把面前的岩浆冻成空地,焰焰把冰水烤干", () => {
    const lv = parseLevel(ELEMENTS);
    const iceSt: GameState = { ice: at(lv, 2, 3), fire: at(lv, 1, 3), levers: 0 };
    const frozen = useElementPower(lv, iceSt, "ice", DIR_RIGHT);
    expect(frozen).toBe(at(lv, 3, 3));
    expect(lv.tiles[frozen]).toBe(TILE.FLOOR);

    const lv2 = parseLevel(ELEMENTS);
    const fireSt: GameState = { ice: lv2.iceStart, fire: at(lv2, 2, 1), levers: 0 };
    const dried = useElementPower(lv2, fireSt, "fire", DIR_RIGHT);
    expect(dried).toBe(at(lv2, 3, 1));
    expect(lv2.tiles[dried]).toBe(TILE.FLOOR);
  });

  it("对着不是自己克制的东西用就没反应,也不会改地图", () => {
    const lv = parseLevel(ELEMENTS);
    const st = initialState(lv);
    expect(useElementPower(lv, st, "ice", DIR_RIGHT)).toBe(-1);
    expect(useElementPower(lv, st, "ice", DIR_UP)).toBe(-1);
    expect(lv.tiles[at(lv, 3, 1)]).toBe(TILE.ICE_WATER);
  });

  it("开局两发,击掌最多补到三发", () => {
    expect(POWER_CHARGES).toBe(2);
    expect(POWER_CHARGES_MAX).toBe(3);
    expect(POWER_CHARGES_MAX).toBeGreaterThan(POWER_CHARGES);
  });
});

describe("会合与击掌", () => {
  it("两人各自站上自己的门才算过关", () => {
    const lv = parseLevel(PLAIN);
    expect(isWin(lv, { ice: lv.iceDoor, fire: lv.fireStart, levers: 0 })).toBe(false);
    expect(isWin(lv, { ice: lv.iceStart, fire: lv.fireDoor, levers: 0 })).toBe(false);
    expect(isWin(lv, { ice: lv.iceDoor, fire: lv.fireDoor, levers: 0 })).toBe(true);
  });

  it("只有紧挨着才击得到掌", () => {
    const lv = parseLevel(PLAIN);
    expect(isAdjacent(lv, { ice: at(lv, 2, 2), fire: at(lv, 3, 2), levers: 0 })).toBe(true);
    expect(isAdjacent(lv, { ice: at(lv, 2, 2), fire: at(lv, 2, 1), levers: 0 })).toBe(true);
    expect(isAdjacent(lv, { ice: at(lv, 2, 2), fire: at(lv, 4, 2), levers: 0 })).toBe(false);
    expect(isAdjacent(lv, { ice: at(lv, 2, 2), fire: at(lv, 3, 1), levers: 0 })).toBe(false);
  });

  it("门口等人的提示会说清是谁在等", () => {
    expect(waitingLine(false, false)).toBe("");
    expect(waitingLine(true, false)).toContain("凛凛");
    expect(waitingLine(false, true)).toContain("焰焰");
    expect(waitingLine(true, true)).toContain("到齐");
  });
});

describe("求解器", () => {
  it("走得通的关能给出最优步数", () => {
    const lv = parseLevel(PLAIN);
    const res = solveLevel(lv);
    expect(res.solvable).toBe(true);
    // 两人各走 4 格,一次动一个人就是 8 步
    expect(res.steps).toBe(8);
  });

  it("走不通的关会老老实实说无解", () => {
    const lv = parseLevel(["#######", "#L..#l#", "#####.#", "#Y..#y#", "#######"]);
    const res = solveLevel(lv);
    expect(res.solvable).toBe(false);
    expect(res.steps).toBe(-1);
  });

  it("能报出两人各自踏得到哪些格子", () => {
    const lv = parseLevel(ELEMENTS);
    const res = solveLevel(lv);
    expect(res.iceReach[at(lv, 3, 1)]).toBe(1);
    expect(res.fireReach[at(lv, 3, 1)]).toBe(0);
    expect(res.fireReach[at(lv, 3, 3)]).toBe(1);
    expect(res.iceReach[at(lv, 3, 3)]).toBe(0);
  });

  it("宝石归属对得上才算「都捡得到」", () => {
    const good = parseLevel(["#######", "#L.~ol#", "#..#..#", "#Y.^*y#", "#######"]);
    expect(gemsAllReachable(good, solveLevel(good))).toBe(true);
    // 红宝石被冰水锁在死角里,只有凛凛进得去 —— 焰焰的宝石凛凛可捡不了
    const bad = parseLevel(["#######", "#L.~*l#", "#..####", "#Y.^.y#", "#######"]);
    expect(gemsAllReachable(bad, solveLevel(bad))).toBe(false);
  });

  it("searchFrom 可以搜任意目标,不只是出口", () => {
    const lv = parseLevel(["#######", "#L.~ol#", "#..#..#", "#Y.^.y#", "#######"]);
    const gem = at(lv, 4, 1);
    const res = searchFrom(lv, initialState(lv), (st) => st.ice === gem);
    expect(res.found).toBe(true);
    expect(res.state?.ice).toBe(gem);
    expect(res.steps).toBe(3);
  });

  it("宝石归属表把三种宝石分清楚", () => {
    expect(gemOwner("blue")).toBe("ice");
    expect(gemOwner("red")).toBe("fire");
    expect(gemOwner("white")).toBe("both");
  });
});

describe("计时与评星", () => {
  it("三星线比二星线紧,时限比二星线还宽", () => {
    for (const steps of [10, 40, 80, 150]) {
      expect(threeStarSeconds(steps)).toBeLessThan(twoStarSeconds(steps));
      expect(twoStarSeconds(steps)).toBeLessThan(timeLimitSeconds(steps));
      expect(parSeconds(steps)).toBeGreaterThan(0);
    }
  });

  it("时限有下限也有上限,不会短到没法玩", () => {
    expect(timeLimitSeconds(1)).toBeGreaterThanOrEqual(120);
    expect(timeLimitSeconds(100000)).toBeLessThanOrEqual(480);
  });

  it("宝石收齐 + 够快 + 心还剩两颗才给三星", () => {
    const base = { gems: 3, totalGems: 3, steps: 40, hearts: 3 };
    expect(rateRun({ ...base, seconds: 10 })).toBe(3);
    expect(rateRun({ ...base, seconds: 10, hearts: 1 })).toBe(2);
    expect(rateRun({ ...base, seconds: threeStarSeconds(40) + 1 })).toBe(2);
    expect(rateRun({ ...base, gems: 0, seconds: twoStarSeconds(40) + 1 })).toBe(1);
    expect(rateRun({ ...base, gems: 2, seconds: 10 })).toBe(2);
  });

  it("一颗宝石都没有的关不会因此掉星", () => {
    expect(rateRun({ gems: 0, totalGems: 0, seconds: 5, steps: 20, hearts: 3 })).toBe(3);
  });

  it("过关和没过关的话都只鼓励,不带一句批评", () => {
    const run = { gems: 3, totalGems: 3, seconds: 20, steps: 40, hearts: 3 };
    const lines = [
      winLine(run, 3),
      winLine(run, 2),
      winLine(run, 1),
      loseLine("time"),
      loseLine("hearts"),
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(6);
      for (const bad of ["笨", "差劲", "不行", "失败", "输了", "太慢了"]) {
        expect(line).not.toContain(bad);
      }
    }
  });

  it("开局三颗心", () => {
    expect(MAX_HEARTS).toBe(3);
  });
});

describe("双人键位", () => {
  it("两套键位一个都不重叠", () => {
    expect(keySetsDisjoint()).toBe(true);
  });

  it("凛凛走 WASD + F/G,焰焰走方向键 + L/K", () => {
    expect(KEY_MAP.KeyW).toEqual({ hero: "ice", action: "up" });
    expect(KEY_MAP.KeyA).toEqual({ hero: "ice", action: "left" });
    expect(KEY_MAP.KeyS).toEqual({ hero: "ice", action: "down" });
    expect(KEY_MAP.KeyD).toEqual({ hero: "ice", action: "right" });
    expect(KEY_MAP.KeyF).toEqual({ hero: "ice", action: "power" });
    expect(KEY_MAP.KeyG).toEqual({ hero: "ice", action: "cheer" });
    expect(KEY_MAP.ArrowUp).toEqual({ hero: "fire", action: "up" });
    expect(KEY_MAP.ArrowLeft).toEqual({ hero: "fire", action: "left" });
    expect(KEY_MAP.ArrowDown).toEqual({ hero: "fire", action: "down" });
    expect(KEY_MAP.ArrowRight).toEqual({ hero: "fire", action: "right" });
    expect(KEY_MAP.KeyL).toEqual({ hero: "fire", action: "power" });
    expect(KEY_MAP.KeyK).toEqual({ hero: "fire", action: "cheer" });
  });

  it("方向动作对得上方向号", () => {
    expect(ACTION_DIR.up).toBe(DIR_UP);
    expect(ACTION_DIR.down).toBe(DIR_DOWN);
    expect(ACTION_DIR.left).toBe(DIR_LEFT);
    expect(ACTION_DIR.right).toBe(DIR_RIGHT);
  });

  it("同屏两人分别按各自的键,互相不抢", () => {
    const lv = parseLevel(PLAIN);
    let st = initialState(lv);
    st = moveHero(lv, st, KEY_MAP.KeyD.hero, ACTION_DIR[KEY_MAP.KeyD.action]).state;
    st = moveHero(lv, st, KEY_MAP.ArrowRight.hero, ACTION_DIR[KEY_MAP.ArrowRight.action]).state;
    expect(st.ice).toBe(at(lv, 2, 1));
    expect(st.fire).toBe(at(lv, 2, 3));
  });

  it("时钟显示分秒", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9.4)).toBe("0:09");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("两位主角只用本作原创的名字", () => {
    expect(HERO_NAMES.ice).toBe("冰灵·凛凛");
    expect(HERO_NAMES.fire).toBe("火灵·焰焰");
    expect(HERO_SHORT.ice).toBe("凛凛");
    expect(HERO_SHORT.fire).toBe("焰焰");
  });
});
