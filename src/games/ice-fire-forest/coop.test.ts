/**
 * 冰冰火火森林 · 六种合作机关的用例。
 *
 * 每一种一张手写小网格,规则改坏了这里立刻红。
 * 最后一组是**「只增不减」**的守门用例:合作机关一旦拿走了原本走得通的某一步,
 * 「188 关全部可解」的旧证明就不成立了 —— 那一组必须永远绿着。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { analyzeLevel } from "./levels";
import {
  BOOST_DISTANCE,
  COOP_FROM_LEVEL,
  COOP_HINTS,
  COOP_KINDS,
  COOP_NAMES,
  ROPE_REACH,
  boostTarget,
  buildCoopKit,
  canEnterCoop,
  crateAt,
  crateFits,
  dualPressed,
  elevatorCellsIn,
  elevatorReady,
  elevatorRide,
  emptyKit,
  initialCoop,
  isPool,
  latchDual,
  linkHints,
  memoryDoorOpen,
  moveWithCoop,
  planCratePush,
  portalReady,
  portalSwap,
  ropePull,
  type CoopKind,
  type CoopKit,
} from "./coop";
import {
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  ENTER_OK,
  ENTER_SOLID,
  canEnter,
  gemsAllReachable,
  initialState,
  isWin,
  parseLevel,
  solveLevel,
  type GameState,
  type Hero,
  type ParsedLevel,
} from "./logic";

function at(lv: ParsedLevel, x: number, y: number): number {
  return y * lv.w + x;
}

// ---------------------------------------------------------------------------
// 机关一:双人按钮
// ---------------------------------------------------------------------------

const WALLED = ["#########", "#L..#..l#", "#...#...#", "#Y..#..y#", "#########"];

describe("机关一 · 双人按钮", () => {
  function setup(): { lv: ParsedLevel; kit: CoopKit } {
    const lv = parseLevel(WALLED);
    const kit: CoopKit = {
      ...emptyKit(),
      dualButton: { icePad: at(lv, 2, 1), firePad: at(lv, 2, 3), door: at(lv, 4, 2) },
      kinds: ["dualButton"],
    };
    return { lv, kit };
  }

  it("只有一人一颗都压住才算数,一个人踩两下不行", () => {
    const { lv, kit } = setup();
    expect(dualPressed(kit, { ice: at(lv, 2, 1), fire: at(lv, 1, 3), levers: 0 })).toBe(false);
    expect(dualPressed(kit, { ice: at(lv, 2, 1), fire: at(lv, 2, 3), levers: 0 })).toBe(true);
  });

  it("两颗都压住的那一瞬间,记忆门永久闩开", () => {
    const { lv, kit } = setup();
    let coop = initialCoop(kit);
    expect(memoryDoorOpen(kit, coop)).toBe(false);
    coop = latchDual(kit, { ice: at(lv, 2, 1), fire: at(lv, 2, 3), levers: 0 }, coop);
    expect(memoryDoorOpen(kit, coop)).toBe(true);
    // 人走开也不会再关上 —— 不然两个人被钉在按钮上,门就是个摆设
    coop = latchDual(kit, { ice: at(lv, 1, 1), fire: at(lv, 1, 3), levers: 0 }, coop);
    expect(memoryDoorOpen(kit, coop)).toBe(true);
  });

  it("没闩开之前那一格还是墙,闩开之后两个人都过得去", () => {
    const { lv, kit } = setup();
    const shut = initialCoop(kit);
    const door = at(lv, 4, 2);
    expect(canEnterCoop(lv, kit, shut, door, "ice", 0, false, false)).toBe(ENTER_SOLID);
    const open = latchDual(kit, { ice: at(lv, 2, 1), fire: at(lv, 2, 3), levers: 0 }, shut);
    for (const hero of ["ice", "fire"] as Hero[]) {
      expect(canEnterCoop(lv, kit, open, door, hero, 0, false, false)).toBe(ENTER_OK);
    }
  });

  it("走一步就能穿过闩开的记忆门", () => {
    const { lv, kit } = setup();
    const pressed: GameState = { ice: at(lv, 2, 1), fire: at(lv, 2, 3), levers: 0 };
    const coop = latchDual(kit, pressed, initialCoop(kit));
    const standing: GameState = { ice: at(lv, 3, 2), fire: at(lv, 1, 3), levers: 0 };
    const out = moveWithCoop(lv, kit, coop, standing, "ice", DIR_RIGHT);
    expect(out.kind).toBe("moved");
    expect(out.state.ice).toBe(at(lv, 4, 2));
  });
});

// ---------------------------------------------------------------------------
// 机关二:顶举
// ---------------------------------------------------------------------------

const BOOST_MAP = ["########", "#LY%..l#", "#......#", "#....y.#", "########"];

describe("机关二 · 顶举", () => {
  it("把紧挨着的同伴举过一格绿黏液,落到两格外", () => {
    const lv = parseLevel(BOOST_MAP);
    const st: GameState = { ice: at(lv, 1, 1), fire: at(lv, 2, 1), levers: 0 };
    expect(boostTarget(lv, st, "ice", 0, false)).toBe(at(lv, 2 + BOOST_DISTANCE, 1));
  });

  it("不挨着就举不动", () => {
    const lv = parseLevel(BOOST_MAP);
    const st: GameState = { ice: at(lv, 1, 1), fire: at(lv, 4, 1), levers: 0 };
    expect(boostTarget(lv, st, "ice", 0, false)).toBe(-1);
  });

  it("落点是墙就不许举 —— 不能把同伴举进石头里", () => {
    const lv = parseLevel(BOOST_MAP);
    // 焰焰在凛凛左边(靠着外墙),再往左两格出图
    const st: GameState = { ice: at(lv, 2, 1), fire: at(lv, 1, 1), levers: 0 };
    expect(boostTarget(lv, st, "ice", 0, false)).toBe(-1);
  });

  it("高坎照样举得上去 —— 顶举就是「亲手托一把」", () => {
    const lv = parseLevel(["########", "#L.H..l#", "#......#", "#Y...y.#", "########"]);
    const st: GameState = { ice: at(lv, 1, 1), fire: at(lv, 2, 1), levers: 0 };
    // 同伴在 (2,1),被举到 (4,1);(3,1) 是高坎,一个人本来上不去
    expect(canEnter(lv, at(lv, 3, 1), "fire", 0, false, false)).toBe(ENTER_SOLID);
    expect(boostTarget(lv, st, "ice", 0, false)).toBe(at(lv, 4, 1));
  });
});

// ---------------------------------------------------------------------------
// 机关三:绳索拉伸
// ---------------------------------------------------------------------------

const ROPE_MAP = ["#########", "#L.~Y..l#", "#.......#", "#.....y.#", "#########"];

describe("机关三 · 绳索拉伸", () => {
  it("隔着冰水潭也能把焰焰拉到身边", () => {
    const lv = parseLevel(ROPE_MAP);
    const st: GameState = { ice: at(lv, 1, 1), fire: at(lv, 4, 1), levers: 0 };
    expect(ropePull(lv, st, "ice", 0, false)).toBe(at(lv, 2, 1));
  });

  it("中间一路畅通就用不着绳子", () => {
    const lv = parseLevel(ROPE_MAP);
    const st: GameState = { ice: at(lv, 1, 2), fire: at(lv, 4, 2), levers: 0 };
    expect(ropePull(lv, st, "ice", 0, false)).toBe(-1);
  });

  it("不在同一行同一列,或者超出绳长,都拉不到", () => {
    const lv = parseLevel(ROPE_MAP);
    expect(ropePull(lv, { ice: at(lv, 1, 1), fire: at(lv, 4, 2), levers: 0 }, "ice", 0, false)).toBe(-1);
    expect(ROPE_REACH).toBeGreaterThanOrEqual(3);
    const far = parseLevel(["##########", "#L..~...Y#", "#........#", "#.l....y.#", "##########"]);
    const st: GameState = { ice: at(far, 1, 1), fire: at(far, 8, 1), levers: 0 };
    expect(ropePull(far, st, "ice", 0, false)).toBe(-1);
  });

  it("紧挨着的时候不算拉绳(那是击掌的活)", () => {
    const lv = parseLevel(ROPE_MAP);
    const st: GameState = { ice: at(lv, 1, 1), fire: at(lv, 2, 1), levers: 0 };
    expect(ropePull(lv, st, "ice", 0, false)).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 机关四:浮桥木箱
// ---------------------------------------------------------------------------

const CRATE_MAP = ["#########", "#L.~~..l#", "#.......#", "#Y.....y#", "#########"];

describe("机关四 · 浮桥木箱", () => {
  it("木箱占的那一格两个人都踩得住,水火都不挡", () => {
    const lv = parseLevel(CRATE_MAP);
    const kit: CoopKit = { ...emptyKit(), crate: at(lv, 3, 1), kinds: ["crate"] };
    const coop = initialCoop(kit);
    expect(isPool(lv, at(lv, 3, 1))).toBe(true);
    expect(crateAt(coop, at(lv, 3, 1))).toBe(true);
    for (const hero of ["ice", "fire"] as Hero[]) {
      expect(canEnterCoop(lv, kit, coop, at(lv, 3, 1), hero, 0, false, false)).toBe(ENTER_OK);
    }
  });

  it("推得进水里、推不进墙里", () => {
    const lv = parseLevel(CRATE_MAP);
    const kit: CoopKit = { ...emptyKit(), crate: at(lv, 3, 1), kinds: ["crate"] };
    expect(crateFits(lv, kit, at(lv, 4, 1))).toBe(true);
    expect(crateFits(lv, kit, at(lv, 3, 0))).toBe(false);
  });

  it("凛凛趟在冰水里推,推的人跟着进去(他本来就趟得过)", () => {
    const lv = parseLevel(CRATE_MAP);
    const kit: CoopKit = { ...emptyKit(), crate: at(lv, 3, 1), kinds: ["crate"] };
    const st: GameState = { ice: at(lv, 2, 1), fire: at(lv, 1, 3), levers: 0 };
    const out = moveWithCoop(lv, kit, initialCoop(kit), st, "ice", DIR_RIGHT);
    expect(out.kind).toBe("moved");
    expect(out.pushed).toBe(true);
    expect(out.coop.crate).toBe(at(lv, 4, 1));
    expect(out.state.ice).toBe(at(lv, 3, 1));
  });

  it("焰焰在岸上推,人留在岸上 —— 不会稀里糊涂踩进冰水里", () => {
    const lv = parseLevel(CRATE_MAP);
    const kit: CoopKit = { ...emptyKit(), crate: at(lv, 3, 1), kinds: ["crate"] };
    const st: GameState = { ice: at(lv, 1, 1), fire: at(lv, 2, 1), levers: 0 };
    const plan = planCratePush(lv, kit, initialCoop(kit), st, "fire", DIR_RIGHT, 0, false);
    expect(plan).not.toBeNull();
    expect(plan!.crate).toBe(at(lv, 4, 1));
    expect(plan!.pusher).toBe(-1);
  });

  it("摆渡:焰焰坐在木箱上,凛凛推一下,两个人一起过河", () => {
    const lv = parseLevel(CRATE_MAP);
    const kit: CoopKit = { ...emptyKit(), crate: at(lv, 3, 1), kinds: ["crate"] };
    const coop = initialCoop(kit);
    const st: GameState = { ice: at(lv, 2, 1), fire: at(lv, 3, 1), levers: 0 };
    const out = moveWithCoop(lv, kit, coop, st, "ice", DIR_RIGHT);
    expect(out.kind).toBe("moved");
    expect(out.coop.crate).toBe(at(lv, 4, 1));
    expect(out.state.fire).toBe(at(lv, 4, 1));
    expect(out.state.ice).toBe(at(lv, 3, 1));
  });

  it("推不动就爬上去,木箱本来就是站得住的", () => {
    const lv = parseLevel(["#########", "#L....#l#", "#..~~##.#", "#Y.....y#", "#########"]);
    const kit: CoopKit = { ...emptyKit(), crate: at(lv, 4, 2), kinds: ["crate"] };
    const st: GameState = { ice: at(lv, 3, 2), fire: at(lv, 1, 3), levers: 0 };
    const out = moveWithCoop(lv, kit, initialCoop(kit), st, "ice", DIR_RIGHT);
    expect(out.kind).toBe("moved");
    expect(out.pushed).toBe(false);
    expect(out.state.ice).toBe(at(lv, 4, 2));
    expect(out.coop.crate).toBe(at(lv, 4, 2));
  });
});

// ---------------------------------------------------------------------------
// 机关五:传送门配对
// ---------------------------------------------------------------------------

describe("机关五 · 传送门配对", () => {
  it("要两个人各站一扇门才亮", () => {
    const lv = parseLevel(WALLED);
    const kit: CoopKit = {
      ...emptyKit(),
      portal: { a: at(lv, 2, 2), b: at(lv, 6, 2) },
      kinds: ["portal"],
    };
    expect(portalReady(kit, { ice: at(lv, 2, 2), fire: at(lv, 1, 3), levers: 0 })).toBe(false);
    expect(portalReady(kit, { ice: at(lv, 2, 2), fire: at(lv, 6, 2), levers: 0 })).toBe(true);
    // 谁站哪一头都行
    expect(portalReady(kit, { ice: at(lv, 6, 2), fire: at(lv, 2, 2), levers: 0 })).toBe(true);
  });

  it("按下同行键就交换位置,拉杆状态原样带过去", () => {
    const lv = parseLevel(WALLED);
    const kit: CoopKit = {
      ...emptyKit(),
      portal: { a: at(lv, 2, 2), b: at(lv, 6, 2) },
      kinds: ["portal"],
    };
    const st: GameState = { ice: at(lv, 2, 2), fire: at(lv, 6, 2), levers: 0b010 };
    const swapped = portalSwap(kit, st);
    expect(swapped).toEqual({ ice: at(lv, 6, 2), fire: at(lv, 2, 2), levers: 0b010 });
    expect(portalSwap(kit, { ice: at(lv, 1, 1), fire: at(lv, 1, 3), levers: 0 })).toBeNull();
  });

  it("光站上去不会被硬拽走 —— 这一格照样是普通空地", () => {
    const lv = parseLevel(WALLED);
    const kit: CoopKit = {
      ...emptyKit(),
      portal: { a: at(lv, 2, 2), b: at(lv, 6, 2) },
      kinds: ["portal"],
    };
    const st: GameState = { ice: at(lv, 1, 2), fire: at(lv, 1, 3), levers: 0 };
    const out = moveWithCoop(lv, kit, initialCoop(kit), st, "ice", DIR_RIGHT);
    expect(out.state.ice).toBe(at(lv, 2, 2));
  });
});

// ---------------------------------------------------------------------------
// 机关六:双人电梯
// ---------------------------------------------------------------------------

const LIFT_MAP = ["########", "#L....l#", "#.##...#", "#.##...#", "#Y....y#", "########"];

describe("机关六 · 双人电梯", () => {
  function setup(): { lv: ParsedLevel; kit: CoopKit } {
    const lv = parseLevel(LIFT_MAP);
    const kit = buildCoopKit(COOP_FROM_LEVEL, lv);
    return { lv, kit };
  }

  it("图里那条竖井会被找出来,上下各留一层空地", () => {
    const { kit } = setup();
    expect(kit.elevator).not.toBeNull();
    expect(kit.elevator!.colB).toBe(kit.elevator!.colA + 1);
    expect(kit.elevator!.bottom).toBeGreaterThan(kit.elevator!.top + 1);
  });

  it("必须两个人都站上去才动得了", () => {
    const { lv, kit } = setup();
    const coop = initialCoop(kit);
    const cells = elevatorCellsIn(lv, kit, coop);
    expect(cells.length).toBe(2);
    const alone: GameState = { ice: cells[0], fire: lv.fireStart, levers: 0 };
    expect(elevatorReady(lv, kit, alone, coop)).toBe(false);
    expect(elevatorRide(lv, kit, alone, coop, DIR_DOWN)).toBeNull();
    const both: GameState = { ice: cells[0], fire: cells[1], levers: 0 };
    expect(elevatorReady(lv, kit, both, coop)).toBe(true);
  });

  it("两个人一起坐,一次开一层,到头就停", () => {
    const { lv, kit } = setup();
    let coop = initialCoop(kit);
    const cells = elevatorCellsIn(lv, kit, coop);
    let st: GameState = { ice: cells[0], fire: cells[1], levers: 0 };
    const lift = kit.elevator!;
    for (let row = lift.top; row < lift.bottom; row++) {
      const ride = elevatorRide(lv, kit, st, coop, DIR_DOWN);
      expect(ride, `第 ${row} 层往下`).not.toBeNull();
      st = ride!.state;
      coop = ride!.coop;
      expect(coop.elevatorRow).toBe(row + 1);
    }
    expect(coop.elevatorRow).toBe(lift.bottom);
    expect(elevatorRide(lv, kit, st, coop, DIR_DOWN)).toBeNull();
    expect(elevatorRide(lv, kit, st, coop, DIR_UP)).not.toBeNull();
  });

  it("坐电梯的时候两个人都跟着走,左右不换位", () => {
    const { lv, kit } = setup();
    const coop = initialCoop(kit);
    const cells = elevatorCellsIn(lv, kit, coop);
    const st: GameState = { ice: cells[0], fire: cells[1], levers: 0 };
    const ride = elevatorRide(lv, kit, st, coop, DIR_DOWN)!;
    expect(ride.state.ice % lv.w).toBe(st.ice % lv.w);
    expect(ride.state.fire % lv.w).toBe(st.fire % lv.w);
    expect((ride.state.ice / lv.w) | 0).toBe(((st.ice / lv.w) | 0) + 1);
  });

  it("横着按没用,电梯只上下", () => {
    const { lv, kit } = setup();
    const coop = initialCoop(kit);
    const cells = elevatorCellsIn(lv, kit, coop);
    const st: GameState = { ice: cells[0], fire: cells[1], levers: 0 };
    expect(elevatorRide(lv, kit, st, coop, DIR_LEFT)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 机关套件:什么时候登场、摆在哪
// ---------------------------------------------------------------------------

describe("合作机关套件", () => {
  it("六种一种不少,每种都有名字和一句给孩子看的说明", () => {
    expect(COOP_KINDS.length).toBe(6);
    expect(new Set(COOP_KINDS).size).toBe(6);
    for (const kind of COOP_KINDS) {
      expect(COOP_NAMES[kind].length).toBeGreaterThan(1);
      expect(COOP_HINTS[kind].length).toBeGreaterThanOrEqual(8);
      expect(COOP_HINTS[kind].length).toBeLessThanOrEqual(25);
      expect(COOP_HINTS[kind].endsWith("。")).toBe(true);
    }
  });

  it("前 99 关一件都不加 —— 那一段的关卡数据与手感和 1.1 一模一样", () => {
    for (const level of [0, 24, 50, 97, COOP_FROM_LEVEL - 1]) {
      const kit = buildCoopKit(level, parseLevel(analyzeLevel(level).grid));
      expect(kit.kinds, `第 ${level + 1} 关`).toEqual([]);
      expect(kit.crate).toBe(-1);
      expect(kit.portal).toBeNull();
      expect(kit.dualButton).toBeNull();
      expect(kit.elevator).toBeNull();
    }
  });

  it("第 100 关起才登场,而且同一关每次摆出来的位置完全一样", () => {
    const parsed = parseLevel(analyzeLevel(COOP_FROM_LEVEL).grid);
    const a = buildCoopKit(COOP_FROM_LEVEL, parsed);
    const b = buildCoopKit(COOP_FROM_LEVEL, parsed);
    expect(a).toEqual(b);
    expect(a.kinds).toContain("boost");
    expect(a.kinds).toContain("rope");
  });

  it("六种机关在第 100 关往后都露过面", () => {
    const seen = new Set<CoopKind>();
    for (let level = COOP_FROM_LEVEL; level < TOTAL_LEVELS; level++) {
      for (const kind of buildCoopKit(level, parseLevel(analyzeLevel(level).grid)).kinds) {
        seen.add(kind);
      }
    }
    for (const kind of COOP_KINDS) expect(seen.has(kind), `${COOP_NAMES[kind]} 一次都没出现`).toBe(true);
  }, 120000);

  it("机关不会压在出发点、门或者宝石上", () => {
    for (let level = COOP_FROM_LEVEL; level < TOTAL_LEVELS; level += 7) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const kit = buildCoopKit(level, lv);
      const taboo = new Set<number>([lv.iceStart, lv.fireStart, lv.iceDoor, lv.fireDoor]);
      for (const g of lv.gems) taboo.add(g.pos);
      const spots = [kit.crate, kit.portal?.a, kit.portal?.b, kit.dualButton?.icePad, kit.dualButton?.firePad];
      for (const spot of spots) {
        if (spot === undefined || spot === null || spot < 0) continue;
        expect(taboo.has(spot), `第 ${level + 1} 关的机关压到了要紧的格子`).toBe(false);
      }
    }
  }, 120000);
});

// ---------------------------------------------------------------------------
// 守门用例:只增不减
// ---------------------------------------------------------------------------

describe("合作机关只增不减", () => {
  /**
   * 这一组是整套设计的地基:
   * 只要「原本走得进去的格子,叠了机关之后照样走得进去」永远成立,
   * `solve.test.ts` 里那份「188 关全部可解」的旧证明就一行都不用重跑。
   */
  it("原本 ENTER_OK 的格子,叠上机关之后一格都没少", () => {
    for (let level = COOP_FROM_LEVEL; level < TOTAL_LEVELS; level += 11) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const kit = buildCoopKit(level, lv);
      const coop = initialCoop(kit);
      for (let pos = 0; pos < lv.tiles.length; pos++) {
        for (const hero of ["ice", "fire"] as Hero[]) {
          for (const power of [0, 1, 2, 3, 4, 5, 6, 7]) {
            for (const light of [false, true]) {
              for (const pad of [false, true]) {
                const base = canEnter(lv, pos, hero, power, light, pad);
                if (base !== ENTER_OK) continue;
                const now = canEnterCoop(lv, kit, coop, pos, hero, power, light, pad);
                expect(now, `第 ${level + 1} 关第 ${pos} 格`).toBe(ENTER_OK);
              }
            }
          }
        }
      }
    }
  }, 120000);

  it("木箱只会落在原本谁也过不去的水火池上,不会堵住空地上的路", () => {
    for (let level = COOP_FROM_LEVEL; level < TOTAL_LEVELS; level += 5) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const kit = buildCoopKit(level, lv);
      if (kit.crate < 0) continue;
      expect(isPool(lv, kit.crate), `第 ${level + 1} 关的木箱`).toBe(true);
    }
  }, 120000);

  it("记忆门原本一定是石墙或绿黏液 —— 闩开只会多一条路", () => {
    for (let level = COOP_FROM_LEVEL; level < TOTAL_LEVELS; level += 5) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const kit = buildCoopKit(level, lv);
      if (!kit.dualButton) continue;
      const base = canEnter(lv, kit.dualButton.door, "ice", 7, true, true);
      expect(base, `第 ${level + 1} 关的记忆门`).not.toBe(ENTER_OK);
    }
  }, 120000);
});

// ---------------------------------------------------------------------------
// 光路提示
// ---------------------------------------------------------------------------

describe("机关联动的光路提示", () => {
  it("每个开关都连到它那一组的门上", () => {
    const lv = parseLevel(["#########", "#L..A..l#", "#.1.#...#", "#Y..^..y#", "#########"]);
    const hints = linkHints(lv);
    expect(hints.length).toBe(1);
    expect(hints[0].from).toBe(at(lv, 2, 2));
    expect(hints[0].to).toBe(at(lv, 4, 1));
    expect(hints[0].group).toBe(0);
  });

  it("没有机关的关卡就一条线都不画", () => {
    expect(linkHints(parseLevel(["#######", "#L...l#", "#.....#", "#Y...y#", "#######"]))).toEqual([]);
  });

  it("188 关里凡是有闸门的,都能给孩子指出对应的开关", () => {
    for (let level = 0; level < TOTAL_LEVELS; level += 13) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const flat = analyzeLevel(level).grid.join("");
      const hasGate = /[ABCabc]/.test(flat);
      if (!hasGate) continue;
      expect(linkHints(lv).length, `第 ${level + 1} 关`).toBeGreaterThan(0);
    }
  }, 60000);
});

// ---------------------------------------------------------------------------
// 机关摆进真关卡里也走得动
// ---------------------------------------------------------------------------

describe("机关接进真关卡", () => {
  /**
   * 规格点名要抽的三关。它们都在合作机关登场之后,
   * 所以这一条同时证明「机关摆上去了」和「摆上去之后照样解得开」。
   */
  const SPOTLIGHT = [99, 144, 187];

  it("第 100 / 145 / 188 关摆上机关之后依然可解,而且原来的解一步没丢", () => {
    for (const level of SPOTLIGHT) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const kit = buildCoopKit(level, lv);
      const coop = initialCoop(kit);
      expect(kit.kinds.length, `第 ${level + 1} 关`).toBeGreaterThan(0);

      const res = solveLevel(lv, true);
      expect(res.solvable, `第 ${level + 1} 关`).toBe(true);

      // 照着旧解一步一步走,每一步在叠了机关之后都还走得通
      let st = initialState(lv);
      let cur = coop;
      for (const step of res.path!) {
        const out = moveWithCoop(lv, kit, cur, st, step.hero, step.dir);
        expect(out.kind, `第 ${level + 1} 关的第 ${step.hero} 步`).toBe("moved");
        st = out.state;
        cur = out.coop;
      }
      expect(isWin(lv, st), `第 ${level + 1} 关走到门口`).toBe(true);
    }
  }, 120000);

  it("第 100 / 145 / 188 关每颗宝石都还有人捡得到", () => {
    for (const level of SPOTLIGHT) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const res = solveLevel(lv);
      expect(gemsAllReachable(lv, res), `第 ${level + 1} 关`).toBe(true);
    }
  }, 120000);

  it("第 100 关照样走得动第一步,机关没把出发点堵死", () => {
    const lv = parseLevel(analyzeLevel(COOP_FROM_LEVEL).grid);
    const kit = buildCoopKit(COOP_FROM_LEVEL, lv);
    const coop = initialCoop(kit);
    const st = initialState(lv);
    const dirs = [DIR_RIGHT, DIR_LEFT, DIR_DOWN, DIR_UP];
    for (const hero of ["ice", "fire"] as Hero[]) {
      const anyMove = dirs.some((d) => moveWithCoop(lv, kit, coop, st, hero, d).kind === "moved");
      expect(anyMove, `第 100 关的${hero}`).toBe(true);
    }
  });
});
