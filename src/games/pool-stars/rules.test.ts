// 梨康台球 · 八球规则与犯规表的回归测试。
// PLAN.md 里那张 13 行的犯规表,这里一行一行对着测。
import { describe, expect, it } from "vitest";
import { TABLE, makeBall, simulateShot, strike, type Ball, type ShotResult } from "./physics";
import {
  FOUL_LIMIT,
  FOUL_TEXT,
  GROUP_LABEL,
  OPPONENT_POT_KEEPS_TURN,
  POCKET_LABEL,
  assignGroups,
  breakSpot,
  createMatch,
  cueInPocket,
  eightBallOutcome,
  foulReason,
  legalTarget,
  nearestPocket,
  placeCueBall,
  rackBalls,
  remainingOf,
  resolveShot,
  type MatchState,
} from "./rules";

/** 拼一份「假装刚打完一杆」的推演结果,只填规则要用到的字段 */
function fakeShot(
  balls: Ball[],
  opts: {
    firstHit?: ShotResult["firstHit"];
    firstHitId?: number | null;
    potted?: { id: number; kind: Ball["kind"]; pocket: number }[];
    crossed?: boolean;
  } = {}
): ShotResult {
  const potted = opts.potted ?? [];
  const after = balls.map((b) => {
    const hit = potted.find((p) => p.id === b.id);
    return hit ? { ...b, potted: true, pocket: hit.pocket } : { ...b };
  });
  return {
    balls: after,
    events: [],
    firstHit: opts.firstHit ?? null,
    firstHitId: opts.firstHitId ?? null,
    potted,
    cushionBeforeContact: false,
    cushionAfterContact: false,
    cueCrossedCenter: opts.crossed ?? true,
    steps: 1,
  };
}

describe("犯规表 · foulReason", () => {
  it("母球落袋是犯规（第 6 行）", () => {
    expect(foulReason("warm", ["warm", "cue"], "warm")).toBe("cue-potted");
    expect(FOUL_TEXT["cue-potted"]).toContain("自由");
  });

  it("空杆是犯规（第 3 行）", () => {
    expect(foulReason(null, [], "warm")).toBe("no-contact");
  });

  it("先碰到对方组是犯规（第 4 行）", () => {
    expect(foulReason("cool", [], "warm")).toBe("wrong-first");
    expect(foulReason("warm", [], "cool")).toBe("wrong-first");
  });

  it("己组没清完先碰黑星球是犯规（第 5 行）", () => {
    expect(foulReason("black", [], "warm")).toBe("black-first-early");
  });

  it("先碰己组球不犯规", () => {
    expect(foulReason("warm", ["warm"], "warm")).toBe("none");
    expect(foulReason("cool", ["cool", "warm"], "cool")).toBe("none");
  });

  it("己组清完之后碰黑星球是合法的", () => {
    expect(foulReason("black", ["black"], "warm", { ownCleared: true })).toBe("none");
    expect(foulReason("warm", [], "warm", { ownCleared: true })).toBe("wrong-first");
  });

  it("台面开放时先碰谁都行，只有黑星球不行", () => {
    expect(foulReason("warm", [], null)).toBe("none");
    expect(foulReason("cool", [], null)).toBe("none");
    expect(foulReason("black", [], null)).toBe("black-first-early");
  });
});

describe("开球与分组 · assignGroups", () => {
  it("开球没过中线算犯规并重摆（第 1 行）", () => {
    const v = assignGroups({ firstHit: "warm", potted: [], cueCrossedCenter: false });
    expect(v.foul).toBe(true);
    expect(v.rerack).toBe(true);
    expect(v.reason).toBe(FOUL_TEXT["break-short"]);
  });

  it("开球空杆同样重摆", () => {
    const v = assignGroups({ firstHit: null, potted: [], cueCrossedCenter: true });
    expect(v.rerack).toBe(true);
    expect(v.foul).toBe(true);
  });

  it("开球把黑星球打进只重摆，不判胜负（第 2 行）", () => {
    const v = assignGroups({ firstHit: "warm", potted: ["black"], cueCrossedCenter: true });
    expect(v.rerack).toBe(true);
    expect(v.foul).toBe(false);
    expect(v.group).toBeNull();
  });

  it("第一颗合法落袋的非黑星球决定分组", () => {
    const warm = assignGroups({ firstHit: "warm", potted: ["warm", "cool"], cueCrossedCenter: true });
    expect(warm.group).toBe("warm");
    expect(warm.open).toBe(false);
    expect(warm.reason).toContain(GROUP_LABEL.warm);
    const cool = assignGroups({ firstHit: "cool", potted: ["cool"], cueCrossedCenter: true });
    expect(cool.group).toBe("cool");
  });

  it("开球什么都没进，台面继续开放", () => {
    const v = assignGroups({ firstHit: "cool", potted: [], cueCrossedCenter: true });
    expect(v.open).toBe(true);
    expect(v.group).toBeNull();
    expect(v.foul).toBe(false);
  });

  it("开球母球落袋：犯规交杆，但台面还开放", () => {
    const v = assignGroups({ firstHit: "warm", potted: ["cue", "warm"], cueCrossedCenter: true });
    expect(v.foul).toBe(true);
    expect(v.rerack).toBe(false);
    expect(v.open).toBe(true);
  });
});

describe("黑星球胜负 · eightBallOutcome", () => {
  const base = { group: "warm" as const, ownRemaining: 0, requireCall: false, calledPocket: null };

  it("没落袋黑星球就不涉及胜负", () => {
    expect(eightBallOutcome(base, { potted: [{ kind: "warm", pocket: 1 }], foul: "none" })).toBeNull();
  });

  it("己组没清完就把黑星球打进判负（第 7 行）", () => {
    const out = eightBallOutcome(
      { ...base, ownRemaining: 2 },
      { potted: [{ kind: "black", pocket: 0 }], foul: "none" }
    );
    expect(out).toBe("lose");
  });

  it("黑星球与母球同一杆落袋判负（第 8 行）", () => {
    const out = eightBallOutcome(base, {
      potted: [
        { kind: "black", pocket: 3 },
        { kind: "cue", pocket: 5 },
      ],
      foul: "cue-potted",
    });
    expect(out).toBe("lose");
  });

  it("合法把黑星球打进判胜（第 11 行）", () => {
    expect(eightBallOutcome(base, { potted: [{ kind: "black", pocket: 2 }], foul: "none" })).toBe("win");
  });

  it("己组最后一颗与黑星球同一杆进袋判胜（第 12 行）", () => {
    const out = eightBallOutcome(
      { ...base, ownRemaining: 1 },
      {
        potted: [
          { kind: "warm", pocket: 4 },
          { kind: "black", pocket: 2 },
        ],
        foul: "none",
      }
    );
    expect(out).toBe("win");
  });

  it("指定袋模式进错袋判负（第 9 行），进对袋判胜", () => {
    const state = { ...base, requireCall: true, calledPocket: 2 };
    expect(eightBallOutcome(state, { potted: [{ kind: "black", pocket: 5 }], foul: "none" })).toBe("lose");
    expect(eightBallOutcome(state, { potted: [{ kind: "black", pocket: 2 }], foul: "none" })).toBe("win");
    expect(POCKET_LABEL).toHaveLength(6);
  });

  it("进黑星球那一杆同时犯规也判负", () => {
    expect(
      eightBallOutcome(base, { potted: [{ kind: "black", pocket: 1 }], foul: "wrong-first" })
    ).toBe("lose");
  });
});

describe("自由球 · placeCueBall", () => {
  it("台面外的点会被压回台面里", () => {
    const out = placeCueBall([], { x: -50, y: 500 });
    expect(out.pos.x).toBeGreaterThanOrEqual(TABLE.r);
    expect(out.pos.y).toBeLessThanOrEqual(TABLE.h - TABLE.r);
  });

  it("放在别的球身上会被挪开", () => {
    const balls = [makeBall(1, "warm", 100, 50)];
    const out = placeCueBall(balls, { x: 100, y: 50 });
    expect(out.ok).toBe(false);
    expect(Math.hypot(out.pos.x - 100, out.pos.y - 50)).toBeGreaterThanOrEqual(2 * TABLE.r);
  });

  it("放在袋口里也会被挪开", () => {
    const out = placeCueBall([], { x: 1, y: 1 });
    expect(out.ok).toBe(false);
    expect(Math.hypot(out.pos.x, out.pos.y)).toBeGreaterThan(TABLE.pocketR);
  });

  it("空位就原样放下", () => {
    const out = placeCueBall([makeBall(1, "warm", 20, 20)], { x: 120, y: 60 });
    expect(out.ok).toBe(true);
    expect(out.pos).toEqual({ x: 120, y: 60 });
  });
});

describe("摆球", () => {
  it("母球 + 15 颗：暖色 7、冷色 7、黑星球 1", () => {
    const balls = rackBalls(5);
    expect(balls).toHaveLength(16);
    expect(balls.filter((b) => b.kind === "warm")).toHaveLength(7);
    expect(balls.filter((b) => b.kind === "cool")).toHaveLength(7);
    expect(balls.filter((b) => b.kind === "black")).toHaveLength(1);
    expect(balls[0].kind).toBe("cue");
  });

  it("球堆里的球互不重叠，而且都在台面里", () => {
    const balls = rackBalls(9);
    for (let i = 0; i < balls.length; i++) {
      expect(balls[i].x).toBeGreaterThan(TABLE.r);
      expect(balls[i].x).toBeLessThan(TABLE.w - TABLE.r);
      expect(balls[i].y).toBeGreaterThan(TABLE.r);
      expect(balls[i].y).toBeLessThan(TABLE.h - TABLE.r);
      for (let k = i + 1; k < balls.length; k++) {
        expect(Math.hypot(balls[i].x - balls[k].x, balls[i].y - balls[k].y)).toBeGreaterThanOrEqual(
          2 * TABLE.r - 1e-9
        );
      }
    }
  });

  it("母球摆在开球区（左半台）", () => {
    expect(breakSpot().x).toBeLessThan(TABLE.w / 2);
    expect(rackBalls(1)[0].x).toBeLessThan(TABLE.w / 2);
  });

  it("同一个 seed 摆出同一副球", () => {
    expect(rackBalls(7).map((b) => b.kind)).toEqual(rackBalls(7).map((b) => b.kind));
  });
});

describe("一局的状态机 · resolveShot", () => {
  function playing(overrides: Partial<MatchState> = {}): MatchState {
    const balls: Ball[] = [
      makeBall(0, "cue", 40, 50),
      makeBall(1, "warm", 90, 30),
      makeBall(2, "warm", 120, 70),
      makeBall(3, "cool", 150, 40),
      makeBall(4, "black", 170, 60),
    ];
    return {
      ...createMatch({ requireCall: false }),
      balls,
      phase: "play",
      open: false,
      groups: ["warm", "cool"],
      turn: 0,
      ...overrides,
    };
  }

  it("犯规就交杆并给对方自由球（第 3–6 行的统一处理）", () => {
    const m = playing();
    const next = resolveShot(m, fakeShot(m.balls, { firstHit: "cool", firstHitId: 3 }));
    expect(next.turn).toBe(1);
    expect(next.freeBall).toBe(true);
    expect(next.fouls[0]).toBe(1);
  });

  it("进了己组球可以继续出杆", () => {
    const m = playing();
    const next = resolveShot(
      m,
      fakeShot(m.balls, { firstHit: "warm", firstHitId: 1, potted: [{ id: 1, kind: "warm", pocket: 0 }] })
    );
    expect(next.turn).toBe(0);
    expect(next.freeBall).toBe(false);
    expect(next.message).toContain("继续");
  });

  it("只进了对方的球不算犯规，但也不续杆（第 13 行）", () => {
    expect(OPPONENT_POT_KEEPS_TURN).toBe(false);
    const m = playing();
    const next = resolveShot(
      m,
      fakeShot(m.balls, { firstHit: "warm", firstHitId: 1, potted: [{ id: 3, kind: "cool", pocket: 2 }] })
    );
    expect(next.fouls[0]).toBe(0);
    expect(next.turn).toBe(1);
    expect(next.balls.find((b) => b.id === 3)?.potted).toBe(true);
  });

  it("连续 3 次犯规判负（第 10 行）", () => {
    let m = playing({ threeFoulLoss: true });
    for (let i = 0; i < FOUL_LIMIT; i++) {
      m = resolveShot({ ...m, turn: 0 }, fakeShot(m.balls, { firstHit: null }));
    }
    expect(m.fouls[0]).toBe(FOUL_LIMIT);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(1);
  });

  it("关掉开关就不会因为三次犯规判负", () => {
    let m = playing({ threeFoulLoss: false });
    for (let i = 0; i < FOUL_LIMIT + 1; i++) {
      m = resolveShot({ ...m, turn: 0 }, fakeShot(m.balls, { firstHit: null }));
    }
    expect(m.phase).toBe("play");
    expect(m.winner).toBe(-1);
  });

  it("打成一杆合法球会把自己的犯规计数清零", () => {
    let m = playing();
    m = resolveShot(m, fakeShot(m.balls, { firstHit: null }));
    expect(m.fouls[0]).toBe(1);
    m = resolveShot(
      { ...m, turn: 0 },
      fakeShot(m.balls, { firstHit: "warm", firstHitId: 1, potted: [{ id: 1, kind: "warm", pocket: 0 }] })
    );
    expect(m.fouls[0]).toBe(0);
  });

  it("开球进黑星球会重新摆一副球，不判胜负", () => {
    const m = createMatch({ seed: 3 });
    const next = resolveShot(
      m,
      fakeShot(m.balls, {
        firstHit: "warm",
        potted: [{ id: 5, kind: "black", pocket: 0 }],
        crossed: true,
      })
    );
    expect(next.rerack).toBe(true);
    expect(next.phase).toBe("break");
    expect(next.winner).toBe(-1);
    expect(next.balls.filter((b) => !b.potted)).toHaveLength(16);
  });

  it("开球进了暖色球就分到暖色组，而且可以继续出杆", () => {
    const m = createMatch({ seed: 3 });
    const next = resolveShot(
      m,
      fakeShot(m.balls, { firstHit: "warm", potted: [{ id: 2, kind: "warm", pocket: 3 }], crossed: true })
    );
    expect(next.groups).toEqual(["warm", "cool"]);
    expect(next.open).toBe(false);
    expect(next.turn).toBe(0);
    expect(next.phase).toBe("play");
  });

  it("台面开放时，这一杆第一颗进的球定分组", () => {
    const m = playing({ open: true, groups: [null, null] });
    const next = resolveShot(
      m,
      fakeShot(m.balls, { firstHit: "cool", firstHitId: 3, potted: [{ id: 3, kind: "cool", pocket: 1 }] })
    );
    expect(next.groups).toEqual(["cool", "warm"]);
    expect(next.open).toBe(false);
    expect(next.turn).toBe(0);
  });

  it("己组清完之后合法进黑星球就赢下这一局", () => {
    const balls: Ball[] = [makeBall(0, "cue", 40, 50), makeBall(4, "black", 170, 60)];
    const m: MatchState = {
      ...createMatch({ requireCall: false }),
      balls,
      phase: "play",
      open: false,
      groups: ["warm", "cool"],
      turn: 0,
    };
    expect(legalTarget(m)).toBe("black");
    const next = resolveShot(
      m,
      fakeShot(balls, { firstHit: "black", firstHitId: 4, potted: [{ id: 4, kind: "black", pocket: 2 }] })
    );
    expect(next.phase).toBe("over");
    expect(next.winner).toBe(0);
  });

  it("真的打一杆（物理 + 规则串起来）也能判出犯规", () => {
    const balls = [strike(makeBall(0, "cue", 40, 50), 0, 0.55), makeBall(3, "cool", 120, 50)];
    const res = simulateShot({ balls });
    const m: MatchState = {
      ...createMatch({ requireCall: false }),
      balls,
      phase: "play",
      open: false,
      groups: ["warm", "cool"],
      turn: 0,
    };
    const next = resolveShot(m, res);
    expect(res.firstHit).toBe("cool");
    expect(next.fouls[0]).toBe(1);
    expect(next.freeBall).toBe(true);
  });
});

describe("小工具", () => {
  it("remainingOf 数得清各组还剩几颗", () => {
    const balls = rackBalls(2);
    expect(remainingOf(balls, "warm")).toBe(7);
    balls[1].potted = true;
    expect(remainingOf(balls, balls[1].kind === "warm" ? "warm" : "cool")).toBe(6);
  });

  it("nearestPocket 找的是最近的那个袋", () => {
    expect(nearestPocket({ x: 5, y: 5 })).toBe(0);
    expect(nearestPocket({ x: 195, y: 95 })).toBe(5);
    expect(nearestPocket({ x: 100, y: 10 })).toBe(1);
  });

  it("cueInPocket 能认出母球掉袋", () => {
    expect(cueInPocket([makeBall(0, "cue", 100, 50)])).toBe(false);
    expect(cueInPocket([{ ...makeBall(0, "cue", 100, 50), potted: true }])).toBe(true);
  });
});
