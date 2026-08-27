import { describe, expect, it } from "vitest";
import { AIRLINE_TO, ARM, BASE, GOAL, RING_LEN, ringAt, type Color } from "./board";
import { CLASSIC_RULES, IMPROVED_RULES, withRules } from "./dice";
import {
  BOUNCE_KEEPS_SHORTCUT,
  allHome,
  applyMove,
  blockedByStack,
  bounceInHome,
  createState,
  currentColor,
  enemyStackAt,
  homeCount,
  landingLine,
  legalMoves,
  nextTurn,
  occupantsOfRing,
  place,
  progressOf,
  rankOf,
  resolveLanding,
  resolveTakeOff,
  stackCount,
  walkSteps,
  winnerOf,
  type FlightState
} from "./rules";

const ME: Color = 0;

function table(planes: Partial<Record<Color, number[]>> = {}, rules = CLASSIC_RULES): FlightState {
  const s = createState([0, 1, 2, 3], rules);
  for (const [key, row] of Object.entries(planes)) {
    place(s, Number(key) as Color, row as number[]);
  }
  return s;
}

/** 把 count 架 foe 色的飞机停到「鸭梨行程 p」那一格上 */
function foesAt(s: FlightState, foe: Color, p: number, count: number): void {
  const ring = ringAt(ME, p);
  const theirs = ((ring - ARM * foe) % RING_LEN + RING_LEN) % RING_LEN;
  for (let i = 0; i < count; i++) s.planes[foe][i] = theirs;
}

describe("resolveLanding 落点结算表", () => {
  it("① 平常走两步就是走两步，不跳不飞", () => {
    const s = table({ 0: [0] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 2);
    expect(r.to).toBe(2);
    expect(r.hops).toEqual([1, 2]);
    expect(r.jumped).toBe(false);
    expect(r.flew).toBe(false);
  });

  it("② 落在本色格 12 → 跳到航线格 16 → 沿航线飞到 28，飞完停止", () => {
    const s = table({ 0: [10] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 2);
    expect(r.jumped).toBe(true);
    expect(r.flew).toBe(true);
    expect(r.to).toBe(AIRLINE_TO);
    expect(r.hops).toEqual([11, 12, 16, 28]);
  });

  it("③ 直接落在航线格 16 → 飞到 28，而且不再跳格", () => {
    const s = table({ 0: [14] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 2);
    expect(r.flew).toBe(true);
    expect(r.jumped).toBe(false);
    expect(r.to).toBe(AIRLINE_TO);
  });

  it("④ 从航线飞抵的 28 也是本色格，但飞抵之后不再连跳", () => {
    const s = table({ 0: [24] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 4);
    expect(r.jumped).toBe(true);
    expect(r.flew).toBe(false);
    expect(r.to).toBe(32);
    // 上一条用例已经证明:飞到 28 的那次落点就停在 28，不会再跳到 32
    const flown = resolveLanding(table({ 0: [14] }), { color: ME, idx: 0 }, 2);
    expect(flown.to).toBe(28);
  });

  it("⑤ 48 是本色格，但再跳就撞进终点通道，所以停在 48", () => {
    const s = table({ 0: [44] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 4);
    expect(r.to).toBe(48);
    expect(r.jumped).toBe(false);
  });

  it("⑥ 落点有敌方单机 → 敌机绕回基地，自己停在那一格", () => {
    const s = table({ 0: [3] });
    foesAt(s, 3, 6, 1);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 3);
    expect(r.to).toBe(6);
    expect(r.captured).toEqual([{ color: 3, idx: 0 }]);
    expect(r.selfBack).toBe(false);
  });

  it("⑦ 落点是敌方叠子 → 连自己一起绕回基地", () => {
    const s = table({ 0: [3] });
    foesAt(s, 3, 6, 2);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 3);
    expect(r.captured).toHaveLength(2);
    expect(r.selfBack).toBe(true);
    expect(r.to).toBe(BASE);
    expect(r.arrived).toBe(false);
  });

  it("⑧ 走到敌方叠子头上还有剩步 → 原路折返", () => {
    const s = table({ 0: [3] });
    foesAt(s, 3, 6, 2);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 5);
    expect(r.blocked).toBe(true);
    expect(r.bounced).toBe(true);
    expect(r.to).toBe(4);
    expect(r.hops).toEqual([4, 5, 6, 5, 4]);
  });

  it("⑨ 跳格不受叠子阻挡:12 跳到 16 时越过了 14 的敌方堡垒", () => {
    const s = table({ 0: [8] });
    foesAt(s, 3, 14, 2);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 4);
    expect(r.blocked).toBe(false);
    expect(r.jumped).toBe(true);
    expect(r.flew).toBe(true);
    expect(r.to).toBe(AIRLINE_TO);
    // 同一座堡垒，用走的就会被挡回来
    const w = table({ 0: [10] });
    foesAt(w, 3, 14, 2);
    const walked = resolveLanding(w, { color: ME, idx: 0 }, 6);
    expect(walked.blocked).toBe(true);
    expect(walked.to).toBe(12);
    expect(walked.jumped).toBe(false);
  });

  it("⑩ 终点必须正好到达", () => {
    const s = table({ 0: [GOAL - 3] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 3);
    expect(r.to).toBe(GOAL);
    expect(r.arrived).toBe(true);
  });

  it("⑪ 超出终点的步数在通道里折返", () => {
    const s = table({ 0: [GOAL - 3] });
    const r = resolveLanding(s, { color: ME, idx: 0 }, 5);
    expect(r.arrived).toBe(false);
    expect(r.bounced).toBe(true);
    expect(r.to).toBe(GOAL - 2);
    expect(r.hops).toEqual([55, 56, 57, 56, 55]);
  });

  it("⑫ 进了终点通道就安全，敌机撞不到", () => {
    const s = table({ 0: [50] });
    foesAt(s, 2, 50, 1);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 4);
    expect(r.to).toBe(54);
    expect(r.captured).toEqual([]);
    expect(occupantsOfRing(s, ringAt(ME, 54))).toEqual([]);
  });
});

describe("走格与折返", () => {
  it("走格是一格一格来的，不会瞬移", () => {
    const s = table({ 0: [5] });
    const walk = walkSteps(s, ME, 5, 4);
    expect(walk.hops).toEqual([6, 7, 8, 9]);
    expect(walk.to).toBe(9);
    expect(walk.bounced).toBe(false);
  });

  it("bounceInHome 是纯算术:正好到就停，超出就退回来", () => {
    expect(bounceInHome(54, 3)).toBe(GOAL);
    expect(bounceInHome(54, 5)).toBe(GOAL - 2);
    expect(bounceInHome(50, 4)).toBe(54);
    expect(bounceInHome(56, 12)).toBe(RING_LEN);
  });

  it("blockedByStack 认得出叠子挡路，己方叠子不挡自己", () => {
    const s = table({ 0: [3] });
    foesAt(s, 1, 6, 2);
    expect(blockedByStack(s, ME, 3, 5)).toBe(true);
    expect(blockedByStack(s, ME, 3, 3)).toBe(false);
    const mine = table({ 0: [3, 6, 6] });
    expect(blockedByStack(mine, ME, 3, 5)).toBe(false);
  });

  it("关掉叠子阻挡的规则时，直接飞过去", () => {
    const s = table({ 0: [3] }, withRules(CLASSIC_RULES, { allowStackBlock: false }));
    foesAt(s, 1, 6, 2);
    expect(blockedByStack(s, ME, 3, 5)).toBe(false);
    // 一路走到本色格 8，再按规矩向前跳 4 格
    expect(resolveLanding(s, { color: ME, idx: 0 }, 5).to).toBe(12);
  });

  it("折返之后只判撞子，不再触发跳格与航线", () => {
    expect(BOUNCE_KEEPS_SHORTCUT).toBe(false);
    const s = table({ 0: [3] });
    foesAt(s, 1, 7, 2);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 6);
    // 3 → 4,5,6,7(堡垒,剩 2 步) → 折返 6,5,停在 5
    expect(r.to).toBe(5);
    expect(r.jumped).toBe(false);
  });
});

describe("起飞、叠子与胜负", () => {
  it("起飞落在自己的起飞格上，顺手把占位的敌机送回基地", () => {
    const s = table({ 0: [BASE, BASE, BASE, BASE] });
    foesAt(s, 2, 0, 1);
    const r = resolveTakeOff(s, { color: ME, idx: 0 });
    expect(r.legal).toBe(true);
    expect(r.to).toBe(0);
    expect(r.captured).toHaveLength(1);
    applyMove(s, { kind: "takeOff", plane: { color: ME, idx: 0 } }, 6);
    expect(s.planes[ME][0]).toBe(0);
    expect(s.planes[2][0]).toBe(BASE);
    expect(s.tally[ME].takeOff).toBe(1);
    expect(s.tally[2].crashed).toBe(1);
  });

  it("已经在路上的飞机不能再起飞，已经到终点的飞机不再被选中", () => {
    const s = table({ 0: [GOAL, GOAL, 10, BASE] });
    expect(resolveTakeOff(s, { color: ME, idx: 2 }).legal).toBe(false);
    expect(resolveLanding(s, { color: ME, idx: 0 }, 3).legal).toBe(false);
    const moves = legalMoves(s, 6);
    expect(moves.filter((m) => m.kind === "fly").map((m) => m.plane.idx)).toEqual([2]);
    expect(moves.filter((m) => m.kind === "takeOff")).toHaveLength(1);
  });

  it("掷不到 6 时基地里的飞机一架也动不了", () => {
    const s = table({ 0: [BASE, BASE, BASE, BASE] });
    expect(legalMoves(s, 3)).toEqual([]);
    expect(legalMoves(s, 6)).toHaveLength(1);
    const improved = table({ 0: [BASE, BASE, BASE, BASE] }, IMPROVED_RULES);
    expect(legalMoves(improved, 5)).toHaveLength(1);
  });

  it("己方两架停同格就是一座叠机堡垒", () => {
    const s = table({ 0: [12, 12, BASE, BASE] });
    expect(stackCount(s, ME)).toBe(1);
    expect(enemyStackAt(s, 1, ringAt(ME, 12))).toHaveLength(2);
    expect(enemyStackAt(s, ME, ringAt(ME, 12))).toHaveLength(0);
  });

  it("4 架全到终点才算赢，名次先看到齐几架再看总行程", () => {
    const s = table({ 0: [GOAL, GOAL, GOAL, 40], 1: [GOAL, GOAL, GOAL, GOAL], 2: [5], 3: [] });
    expect(allHome(s, 1)).toBe(true);
    expect(allHome(s, 0)).toBe(false);
    expect(homeCount(s, 0)).toBe(3);
    expect(winnerOf(s)).toBe(1);
    expect(rankOf(s)[0]).toBe(1);
    expect(rankOf(s)[1]).toBe(0);
    expect(rankOf(s).at(-1)).toBe(3);
    expect(progressOf(s, 3)).toBe(0);
  });

  it("轮转按座位顺序，走完一圈算一个回合", () => {
    const s = table();
    expect(currentColor(s)).toBe(0);
    nextTurn(s);
    expect(currentColor(s)).toBe(1);
    nextTurn(s);
    nextTurn(s);
    expect(s.round).toBe(0);
    nextTurn(s);
    expect(currentColor(s)).toBe(0);
    expect(s.round).toBe(1);
  });

  it("播报只写绕回基地，不写坠毁爆炸", () => {
    const s = table({ 0: [3] });
    foesAt(s, 3, 6, 2);
    const r = resolveLanding(s, { color: ME, idx: 0 }, 3);
    const line = landingLine({ color: ME, idx: 0 }, r);
    expect(line).toContain("绕回基地");
    expect(line).not.toMatch(/坠毁|爆炸|击落|阵亡/);
    const single = landingLine({ color: ME, idx: 0 }, resolveLanding(table({ 0: [3] }), { color: ME, idx: 0 }, 2));
    expect(single).not.toContain("undefined");
  });
});
