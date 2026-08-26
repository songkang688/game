import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  FARMER_YIELD_CARDS,
  beatCandidates,
  chooseAiPlay,
  controlScore,
  hintPlays,
  leadCandidates,
  sameTeam,
  splitCount,
  type AiContext,
  type AiLevel,
} from "./ai";
import { BIG_JOKER, SMALL_JOKER, beats, cardRank, parsePlay, type Play } from "./logic";

const RANK_OF: Record<string, number> = {
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  "2": 15,
  w: 16,
  W: 17,
};

function cards(spec: string): number[] {
  const used = new Map<number, number>();
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const r = RANK_OF[tok];
      if (r === undefined) throw new Error(`看不懂的牌:${tok}`);
      const n = used.get(r) ?? 0;
      used.set(r, n + 1);
      if (r === 16) return SMALL_JOKER;
      if (r === 17) return BIG_JOKER;
      return (r - 3) * 4 + n;
    });
}

function play(spec: string): Play {
  const p = parsePlay(cards(spec));
  if (!p) throw new Error(`应该是合法牌型:${spec}`);
  return p;
}

function ctxOf(over: Partial<AiContext> & { hand: number[] }): AiContext {
  return {
    seat: 0,
    landlord: 0,
    prev: null,
    prevSeat: 1,
    counts: [over.hand.length, 10, 10],
    rand: mulberry32(7),
    ...over,
  };
}

describe("手牌拆解", () => {
  it("一手顺子算一手牌", () => {
    expect(splitCount(cards("3 4 5 6 7"))).toBe(1);
  });

  it("五张散牌要出五手", () => {
    expect(splitCount(cards("3 5 7 9 J"))).toBe(5);
  });

  it("连对算一手", () => {
    expect(splitCount(cards("3 3 4 4 5 5"))).toBe(1);
  });

  it("三带一算一手,不是两手", () => {
    expect(splitCount(cards("3 3 3 9"))).toBe(1);
  });

  it("炸弹算一手", () => {
    expect(splitCount(cards("3 3 3 3"))).toBe(1);
  });

  it("空手是 0 手", () => {
    expect(splitCount([])).toBe(0);
  });

  it("大牌越多控场分越高", () => {
    expect(controlScore(cards("w W 2 2"))).toBeGreaterThan(controlScore(cards("3 4 5 6")));
  });
});

describe("候选牌型", () => {
  it("先手候选里能找到顺子、对子和单张", () => {
    const list = leadCandidates(cards("3 4 5 6 7 9 9"));
    const types = new Set(list.map((p) => p.type));
    expect(types.has("straight")).toBe(true);
    expect(types.has("pair")).toBe(true);
    expect(types.has("single")).toBe(true);
  });

  it("跟牌候选每一手都真的压得住", () => {
    const prev = play("9");
    const list = beatCandidates(cards("3 3 10 J Q K A 2 w W"), prev);
    expect(list.length).toBeGreaterThan(0);
    for (const p of list) expect(beats(p, prev)).toBe(true);
  });

  it("上家是王炸就一手都跟不出来", () => {
    expect(beatCandidates(cards("2 2 2 2"), play("w W"))).toHaveLength(0);
  });

  it("上家是炸弹时只剩更大的炸弹和王炸", () => {
    const list = beatCandidates(cards("3 3 3 3 K K K K w W"), play("9 9 9 9"));
    const types = new Set(list.map((p) => p.type));
    expect(types).toEqual(new Set(["bomb", "rocket"]));
    expect(list.filter((p) => p.type === "bomb").every((p) => p.main > 9)).toBe(true);
  });

  it("跟顺子只给同样长度的顺子", () => {
    const list = beatCandidates(cards("4 5 6 7 8 9 10"), play("3 4 5 6 7"));
    for (const p of list.filter((x) => x.type === "straight")) expect(p.len).toBe(5);
  });

  it("提示按「小的排前面」排序,炸弹排最后", () => {
    const list = hintPlays(cards("3 3 3 3 5 9 K"), null);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].type).not.toBe("bomb");
    expect(list[list.length - 1].type).toBe("bomb");
  });

  it("提示不会给重复的同一手牌", () => {
    const list = hintPlays(cards("3 4 5 6 7 8 9"), null);
    const keys = list.map((p) => p.cards.join(","));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("跟不上就给空提示", () => {
    expect(hintPlays(cards("3 4 5"), play("A"))).toHaveLength(0);
  });
});

describe("阵营", () => {
  it("两个农民是一伙的,地主谁也不是队友", () => {
    expect(sameTeam(1, 2, 0)).toBe(true);
    expect(sameTeam(0, 1, 0)).toBe(false);
    expect(sameTeam(1, 1, 0)).toBe(true);
  });
});

describe("三档电脑", () => {
  const levels: AiLevel[] = ["easy", "normal", "hard"];

  it("先手时三档都不会「不要」", () => {
    for (const lv of levels) {
      const out = chooseAiPlay(ctxOf({ hand: cards("3 5 9 K 2") }), lv);
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it("出的牌一定在自己手里,而且是合法牌型", () => {
    for (const lv of levels) {
      const hand = cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2 w W");
      const out = chooseAiPlay(ctxOf({ hand }), lv);
      expect(out.every((id) => hand.includes(id))).toBe(true);
      expect(parsePlay(out)).not.toBeNull();
    }
  });

  it("跟牌跟出来的一定压得住上一手", () => {
    const prev = play("9 9");
    for (const lv of levels) {
      const out = chooseAiPlay(ctxOf({ hand: cards("3 3 10 10 K K 2 2"), prev, prevSeat: 1, landlord: 1 }), lv);
      expect(out.length).toBeGreaterThan(0);
      expect(beats(parsePlay(out)!, prev)).toBe(true);
    }
  });

  it("能一把走完就一把走完", () => {
    for (const lv of levels) {
      const hand = cards("3 4 5 6 7");
      expect(chooseAiPlay(ctxOf({ hand }), lv)).toHaveLength(5);
    }
  });

  it("跟不上就老老实实「不要」", () => {
    for (const lv of levels) {
      expect(chooseAiPlay(ctxOf({ hand: cards("3 4 5"), prev: play("A"), prevSeat: 1, landlord: 1 }), lv)).toEqual([]);
    }
  });

  it("简单档先手永远先甩最小的单张", () => {
    const out = chooseAiPlay(ctxOf({ hand: cards("3 5 5 9 9 9 K") }), "easy");
    expect(out).toHaveLength(1);
    expect(cardRank(out[0])).toBe(3);
  });

  it("普通档先手会先走顺子,不是拆着一张张甩", () => {
    const out = chooseAiPlay(ctxOf({ hand: cards("3 4 5 6 7 K K 2 w") }), "normal");
    expect(parsePlay(out)?.type).toBe("straight");
  });

  it("困难档不会拿王去压一张小牌", () => {
    const prev = play("5");
    const out = chooseAiPlay(
      ctxOf({ hand: cards("6 8 J K W"), prev, prevSeat: 1, landlord: 1, counts: [5, 9, 9] }),
      "hard"
    );
    expect(out).toHaveLength(1);
    expect(cardRank(out[0])).toBeLessThan(16);
  });

  it("困难档的农民不会去压自己的队友", () => {
    const out = chooseAiPlay(
      ctxOf({
        seat: 2,
        landlord: 0,
        hand: cards("4 6 8 10 Q A"),
        prev: play("9"),
        prevSeat: 1,
        counts: [8, 5, 6],
      }),
      "hard"
    );
    expect(out).toEqual([]);
  });

  it("对手只剩一张时,困难档会舍得动用炸弹拦下来", () => {
    const out = chooseAiPlay(
      ctxOf({
        seat: 1,
        landlord: 0,
        hand: cards("3 3 3 3 4 6"),
        prev: play("K"),
        prevSeat: 0,
        counts: [1, 6, 9],
      }),
      "hard"
    );
    expect(parsePlay(out)?.type).toBe("bomb");
  });

  it("同样的手牌与随机源,三档给的答案每次都一样", () => {
    for (const lv of levels) {
      const mk = (): AiContext => ctxOf({ hand: cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2 w W"), rand: mulberry32(42) });
      expect(chooseAiPlay(mk(), lv)).toEqual(chooseAiPlay(mk(), lv));
    }
  });
});

// ---------------------------------------------------------------------------
// 1.2:可压牌组枚举的完备性 + 农民之间的配合
// ---------------------------------------------------------------------------

/** 把一手牌的「牌型 · 链长 · 主点数」拼成一把钥匙:枚举完不完整看的是它,而不是具体哪几张 */
function shapeKey(p: Play): string {
  return `${p.type}|${p.len}|${p.main}`;
}

/** 暴力枚举手里所有子集,挑出真的能压过 prev 的那些 */
function bruteForceBeats(hand: number[], prev: Play): Set<string> {
  const out = new Set<string>();
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    const pick: number[] = [];
    for (let i = 0; i < hand.length; i++) if (mask & (1 << i)) pick.push(hand[i]);
    const p = parsePlay(pick);
    if (p && beats(p, prev)) out.add(shapeKey(p));
  }
  return out;
}

describe("可压牌组枚举得全不全", () => {
  it("单张:暴力枚举出来的每一种压法,候选表里都有", () => {
    const hand = cards("4 6 9 10 J Q 2 w");
    const prev = play("8");
    const got = new Set(beatCandidates(hand, prev).map(shapeKey));
    for (const key of bruteForceBeats(hand, prev)) expect(got, `漏了 ${key}`).toContain(key);
  });

  it("对子与三带:带什么翅膀不重要,能压的「型」一个都不能漏", () => {
    for (const [spec, prevSpec] of [
      ["3 3 9 9 J J K K 2 2", "8 8"],
      ["3 4 9 9 9 J J J K", "5 5 5 7"],
    ] as const) {
      const hand = cards(spec);
      const prev = play(prevSpec);
      const got = new Set(beatCandidates(hand, prev).map(shapeKey));
      for (const key of bruteForceBeats(hand, prev)) expect(got, `${spec} 漏了 ${key}`).toContain(key);
    }
  });

  it("顺子与连对:同样长度的每一段都枚举得到", () => {
    const hand = cards("4 5 6 7 8 9 10 J");
    const prev = play("3 4 5 6 7");
    const got = new Set(beatCandidates(hand, prev).map(shapeKey));
    for (const key of bruteForceBeats(hand, prev)) expect(got, `漏了 ${key}`).toContain(key);
  });

  it("炸弹与王炸永远在候选里,而且只留压得住的那些", () => {
    const hand = cards("5 5 5 5 K K K K w W 3");
    const prev = play("9 9 9 9");
    const list = beatCandidates(hand, prev);
    const got = new Set(list.map(shapeKey));
    for (const key of bruteForceBeats(hand, prev)) expect(got, `漏了 ${key}`).toContain(key);
    expect(list.every((p) => beats(p, prev))).toBe(true);
  });

  it("枚举出来的每一手都在自己手里,没有凭空变牌", () => {
    const hand = cards("3 3 4 5 6 7 8 9 9 9 J Q K A 2 w W");
    for (const p of [...leadCandidates(hand), ...beatCandidates(hand, play("7"))]) {
      const pool = [...hand];
      for (const id of p.cards) {
        const at = pool.indexOf(id);
        expect(at, `手里没有这张牌`).toBeGreaterThanOrEqual(0);
        pool.splice(at, 1);
      }
    }
  });
});

describe("农民之间的配合", () => {
  const teammateSeat = 1;

  it("队友只剩三张以内、马上要走完时,困难档一张都不抢——连炸弹都不动", () => {
    for (let left = 1; left <= FARMER_YIELD_CARDS; left++) {
      const out = chooseAiPlay(
        ctxOf({
          seat: 2,
          landlord: 0,
          hand: cards("3 3 3 3 5 7 9 J K A 2"),
          prev: play("10"),
          prevSeat: teammateSeat,
          counts: [11, left, 11],
        }),
        "hard"
      );
      expect(out, `队友只剩 ${left} 张还去抢`).toEqual([]);
    }
  });

  it("队友出的牌本来就压得住,困难档就把出牌权留给他", () => {
    const out = chooseAiPlay(
      ctxOf({
        seat: 2,
        landlord: 0,
        hand: cards("4 6 8 10 Q A 2"),
        prev: play("K"),
        prevSeat: teammateSeat,
        counts: [9, 6, 7],
      }),
      "hard"
    );
    expect(out).toEqual([]);
  });

  it("轮到地主快走完时,困难档农民立刻改口拦截,不再让牌", () => {
    const out = chooseAiPlay(
      ctxOf({
        seat: 2,
        landlord: 0,
        hand: cards("3 3 3 3 5 7"),
        prev: play("K"),
        prevSeat: teammateSeat,
        counts: [1, 2, 6],
      }),
      "hard"
    );
    expect(out.length).toBeGreaterThan(0);
  });

  it("上家是地主就该压就压,让牌只对自己人", () => {
    const out = chooseAiPlay(
      ctxOf({
        seat: 2,
        landlord: 0,
        hand: cards("4 6 8 10 Q A 2"),
        prev: play("9"),
        prevSeat: 0,
        counts: [3, 7, 7],
      }),
      "hard"
    );
    expect(out.length).toBeGreaterThan(0);
    expect(beats(parsePlay(out)!, play("9"))).toBe(true);
  });

  it("简单档没有配合这回事:队友的牌照压不误", () => {
    const out = chooseAiPlay(
      ctxOf({
        seat: 2,
        landlord: 0,
        hand: cards("4 6 8 10 Q A 2"),
        prev: play("K"),
        prevSeat: teammateSeat,
        counts: [9, 2, 7],
      }),
      "easy"
    );
    expect(out.length).toBeGreaterThan(0);
  });
});
