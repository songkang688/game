/**
 * 冰冰火火森林 · 检查点与小云朵的用例。
 *
 * 最要紧的一条是**「回检查点不重置机关」**:
 * 拉杆、闩开的记忆门、推过的木箱、捡过的宝石一件都不许还原,
 * 不然「不整关重来」就是句空话。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { analyzeLevel } from "./levels";
import {
  MAX_CHECKPOINTS,
  MIN_CHECKPOINTS,
  checkpointLabel,
  cloudLine,
  cloudPath,
  pickCheckpoints,
  respawnCell,
  updateReached,
} from "./checkpoint";
import { emptyKit, initialCoop, latchDual, moveWithCoop, type CoopKit } from "./coop";
import {
  DIR_DOWN,
  DIR_RIGHT,
  TILE,
  initialState,
  parseLevel,
  type GameState,
  type ParsedLevel,
} from "./logic";

function at(lv: ParsedLevel, x: number, y: number): number {
  return y * lv.w + x;
}

const LONG = [
  "#############",
  "#L.........l#",
  "#...........#",
  "#Y....^....y#",
  "#############",
];

describe("检查线怎么挑", () => {
  it("这一关挑出来的线在出发点和门之间,从左到右排好", () => {
    const lv = parseLevel(LONG);
    const cps = pickCheckpoints(lv);
    expect(cps.columns.length).toBeGreaterThanOrEqual(MIN_CHECKPOINTS);
    expect(cps.columns.length).toBeLessThanOrEqual(MAX_CHECKPOINTS);
    for (let i = 1; i < cps.columns.length; i++) {
      expect(cps.columns[i]).toBeGreaterThan(cps.columns[i - 1]);
    }
    expect(cps.columns[0]).toBeGreaterThan(1);
    expect(cps.columns[cps.columns.length - 1]).toBeLessThan(lv.w - 2);
  });

  it("同一张图挑两次结果一样(纯函数)", () => {
    const lv = parseLevel(LONG);
    expect(pickCheckpoints(lv)).toEqual(pickCheckpoints(lv));
  });

  it("188 关每一关都是 2 到 3 条线,而且每条线上都真的站得住人", () => {
    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const lv = parseLevel(analyzeLevel(level).grid);
      const cps = pickCheckpoints(lv);
      expect(cps.columns.length, `第 ${level + 1} 关`).toBeGreaterThanOrEqual(MIN_CHECKPOINTS);
      expect(cps.columns.length, `第 ${level + 1} 关`).toBeLessThanOrEqual(MAX_CHECKPOINTS);
      for (const x of cps.columns) {
        let rest = false;
        for (let y = 1; y < lv.h - 1; y++) {
          const t = lv.tiles[y * lv.w + x];
          if (t === TILE.FLOOR || t === TILE.LIFT_PAD) rest = true;
        }
        expect(rest, `第 ${level + 1} 关第 ${x} 列没地方歇脚`).toBe(true);
      }
    }
  }, 120000);

  it("短得离谱的图就干脆不摆检查线", () => {
    const lv = parseLevel(["#####", "#Ll#", "#Yy#", "#####"].map((r) => r.padEnd(5, "#")));
    expect(pickCheckpoints(lv).columns.length).toBe(0);
  });
});

describe("检查线什么时候点亮", () => {
  it("两个人都越过去才算数 —— 一个人冲在前面不算", () => {
    const cps = { columns: [4, 8] };
    expect(updateReached(cps, -1, 5, 2)).toBe(-1);
    expect(updateReached(cps, -1, 5, 4)).toBe(0);
    expect(updateReached(cps, 0, 9, 8)).toBe(1);
  });

  it("只往前记,不会因为退回去就熄灭", () => {
    const cps = { columns: [4, 8] };
    expect(updateReached(cps, 1, 1, 1)).toBe(1);
  });

  it("HUD 上那面小旗数得对", () => {
    expect(checkpointLabel({ columns: [] }, -1)).toBe("🚩 —");
    expect(checkpointLabel({ columns: [3, 6] }, -1)).toBe("🚩 0/2");
    expect(checkpointLabel({ columns: [3, 6] }, 1)).toBe("🚩 2/2");
  });
});

describe("小云朵飘回哪儿", () => {
  it("一条线都没点亮就飘回自己的出发点", () => {
    const lv = parseLevel(LONG);
    const cps = pickCheckpoints(lv);
    expect(respawnCell(lv, cps, -1, "ice", at(lv, 6, 3), at(lv, 1, 3))).toBe(lv.iceStart);
    expect(respawnCell(lv, cps, -1, "fire", at(lv, 6, 3), at(lv, 1, 1))).toBe(lv.fireStart);
  });

  it("点亮之后回那条线上离他最近的一行", () => {
    const lv = parseLevel(LONG);
    const cps = pickCheckpoints(lv);
    const back = respawnCell(lv, cps, 0, "fire", at(lv, 6, 3), lv.iceStart);
    expect(back % lv.w).toBe(cps.columns[0]);
    // 他刚才在最下面那一行,所以落点也该贴着下面
    expect((back / lv.w) | 0).toBe(3);
  });

  it("同伴正好占着那一格就让开", () => {
    const lv = parseLevel(LONG);
    const cps = pickCheckpoints(lv);
    const taken = respawnCell(lv, cps, 0, "fire", at(lv, 6, 3), lv.iceStart);
    const moved = respawnCell(lv, cps, 0, "fire", at(lv, 6, 3), taken);
    expect(moved).not.toBe(taken);
    expect(moved % lv.w).toBe(cps.columns[0]);
  });

  it("飘回去的路是一条抬起来的弧线,头尾对得上", () => {
    const lv = parseLevel(LONG);
    const pts = cloudPath(lv, at(lv, 6, 3), at(lv, 2, 1));
    expect(pts[0].x).toBeCloseTo(6);
    expect(pts[0].y).toBeCloseTo(3);
    expect(pts[pts.length - 1].x).toBeCloseTo(2);
    expect(pts[pts.length - 1].y).toBeCloseTo(1);
    const mid = pts[Math.floor(pts.length / 2)];
    // 中间那一段是抬起来的(y 更小 = 更靠上)
    expect(mid.y).toBeLessThan((3 + 1) / 2);
  });

  it("说的那句话里没有一个吓人的字,而且讲清了机关还开着", () => {
    for (const line of [cloudLine("ice", -1), cloudLine("fire", 1)]) {
      expect(line).toContain("小云");
      expect(line).toContain("机关都还开着");
      for (const bad of ["死", "血", "痛", "输"]) expect(line.includes(bad)).toBe(false);
    }
  });
});

describe("回检查点不重置机关", () => {
  it("拉杆、记忆门、木箱、宝石一件都不还原,只是人换个地方", () => {
    const lv = parseLevel(["###########", "#L..4..^.l#", "#.........#", "#Y.~~....y#", "###########"]);
    const kit: CoopKit = {
      ...emptyKit(),
      dualButton: { icePad: at(lv, 2, 2), firePad: at(lv, 3, 2), door: at(lv, 5, 0) },
      crate: at(lv, 3, 3),
      kinds: ["dualButton", "crate"],
    };
    let coop = initialCoop(kit);
    let st: GameState = initialState(lv);

    // 1. 凛凛踩上拉杆
    for (let i = 0; i < 3; i++) {
      const out = moveWithCoop(lv, kit, coop, st, "ice", DIR_RIGHT);
      expect(out.kind).toBe("moved");
      st = out.state;
      coop = out.coop;
    }
    expect(st.levers).toBe(0b001);

    // 2. 焰焰把木箱往右推一格
    const push = moveWithCoop(lv, kit, coop, st, "fire", DIR_RIGHT);
    expect(push.kind).toBe("moved");
    st = push.state;
    coop = push.coop;
    const pushed = moveWithCoop(lv, kit, coop, st, "fire", DIR_RIGHT);
    expect(pushed.pushed).toBe(true);
    st = pushed.state;
    coop = pushed.coop;
    const crateNow = coop.crate;
    expect(crateNow).toBe(at(lv, 4, 3));

    // 3. 记忆门闩开
    coop = latchDual(kit, { ice: kit.dualButton!.icePad, fire: kit.dualButton!.firePad, levers: st.levers }, coop);

    // 4. 凛凛踩进岩浆 —— 只是飘回检查点,机关一件不动
    const cps = pickCheckpoints(lv);
    const reached = updateReached(cps, -1, st.ice % lv.w, st.fire % lv.w);
    const hurt = moveWithCoop(lv, kit, coop, { ...st, ice: at(lv, 6, 1) }, "ice", DIR_RIGHT);
    expect(hurt.kind).toBe("hurt");
    const back = respawnCell(lv, cps, reached, "ice", at(lv, 6, 1), st.fire);
    const after: GameState = { ...st, ice: back };
    expect(after.levers).toBe(0b001);
    expect(coop.crate).toBe(crateNow);
    expect(coop.latched).toBe(1);
    expect(after.ice).not.toBe(at(lv, 7, 1));
  });

  it("掉一次池子不会把关卡打回原样 —— 人是唯一被挪动的东西", () => {
    const lv = parseLevel(LONG);
    const cps = pickCheckpoints(lv);
    const st = initialState(lv);
    // 凛凛趟不过岩浆 —— (6,3) 那一格是 `^`
    const hurt = moveWithCoop(lv, emptyKit(), initialCoop(emptyKit()), { ...st, ice: at(lv, 5, 3) }, "ice", DIR_RIGHT);
    expect(hurt.kind).toBe("hurt");
    expect(hurt.state.fire).toBe(st.fire);
    const back = respawnCell(lv, cps, -1, "ice", at(lv, 5, 3), st.fire);
    expect(back).toBe(lv.iceStart);
  });

  it("走到下一段之后再掉,回的是更靠后的那条线,不是从头来过", () => {
    const lv = parseLevel(LONG);
    const cps = pickCheckpoints(lv);
    const deep = updateReached(cps, -1, cps.columns[1] + 1, cps.columns[1] + 1);
    expect(deep).toBe(1);
    const back = respawnCell(lv, cps, deep, "ice", at(lv, cps.columns[1] + 2, 1), -1);
    expect(back % lv.w).toBe(cps.columns[1]);
    expect(back % lv.w).toBeGreaterThan(cps.columns[0]);
  });

  it("往下踩进池子也一样飘回去(方向不影响判定)", () => {
    const lv = parseLevel(["#########", "#L.....l#", "#..^....#", "#Y.....y#", "#########"]);
    const out = moveWithCoop(lv, emptyKit(), initialCoop(emptyKit()), { ice: at(lv, 3, 1), fire: lv.fireStart, levers: 0 }, "ice", DIR_DOWN);
    expect(out.kind).toBe("hurt");
    expect(out.state.ice).toBe(at(lv, 3, 1));
  });
});
