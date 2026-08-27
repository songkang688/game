// 窗口 4 · QA 档C · 第 1 轮测试员:记忆翻翻乐。
//
// 第 1 轮剧本:首页进入 → 赢一次 + 输一次 → 战役第 1 / 100 / 188 关 →
// 无尽 / 对战 / 双人各玩到结算 → 360px。
// 「赢」「输」都靠一个走完整翻牌状态机(tapCard → resolve → settle)的玩家跑出来,
// 不是直接看某个判定函数。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, totalSize, mulberry32 } from "../level99";
import { meta } from "./meta";
import { CHAPTERS, LEVELS, type MemoryLevel } from "./levels";
import { THEME_PACKS } from "./art";
import {
  CARD_MIN_W,
  ENDLESS_MAX_MISS,
  SEAT_NAMES,
  acceptsInput,
  boardGap,
  buildDeck,
  cardWidthAt,
  coverDelayMs,
  deckSeed,
  deckSize,
  endlessLevel,
  endlessLine,
  endlessPairs,
  endlessScore,
  estimateSeconds,
  groupMatches,
  lostLine,
  newFlipState,
  nextTurn,
  settle,
  simulatePerfectPlay,
  starsForMisses,
  startPlay,
  tapCard,
  versusLine,
  versusWinner,
  wonLine,
  type FlipState,
  type Seat,
} from "./logic";

/* ------------------------------------------------------------------ */
/* 走完整状态机的玩家                                                   */
/* ------------------------------------------------------------------ */

interface Session {
  /** 全部配完了吗 */
  cleared: boolean;
  misses: number;
  taps: number;
  /** 每人各配到几组(单人局只看 [0]) */
  scores: [number, number];
  turns: Seat[];
}

/**
 * 一局完整的翻牌:每一次点击都真的过 `tapCard`,凑齐一组就 `resolve`,
 * 播完再 `settle` 回到 idle —— 和玩家在屏幕上点的路径完全一致。
 *
 * `memory` = true 是记性完美的孩子(见过就记住);= false 是纯瞎翻。
 * `twoSeats` = true 就是双人轮流翻:配到接着翻,没配到换人。
 */
function playSession(
  cfg: MemoryLevel,
  seed: number,
  opts: { memory: boolean; twoSeats?: boolean; maxMiss?: number } = { memory: true }
): Session {
  const deck = buildDeck(cfg, seed);
  const need = cfg.matchSize;
  const gone = new Array<boolean>(deck.length).fill(false);
  const known = new Map<number, number>();
  const rand = mulberry32(seed * 131 + 7);
  const limit = opts.maxMiss ?? cfg.maxMiss;

  let flip: FlipState = startPlay(newFlipState(cfg.matchSize, true));
  let misses = 0;
  let taps = 0;
  let matched = 0;
  let seat: Seat = 0;
  const scores: [number, number] = [0, 0];
  const turns: Seat[] = [];

  const alive = (): number[] => deck.map((_, i) => i).filter((i) => !gone[i]);

  const chooseGroup = (): number[] | null => {
    const pool = alive();
    if (pool.length < need) return null;
    if (opts.memory) {
      // 记得住的先收现成的一组
      const byGroup = new Map<number, number[]>();
      for (const i of pool) {
        if (!known.has(i) || deck[i].decoy) continue;
        const list = byGroup.get(deck[i].group) ?? [];
        list.push(i);
        byGroup.set(deck[i].group, list);
      }
      for (const list of byGroup.values()) if (list.length >= need) return list.slice(0, need);
      const fresh = pool.filter((i) => !known.has(i));
      if (fresh.length >= need) return fresh.slice(0, need);
    }
    // 瞎翻:随便挑不重复的几张
    const pick: number[] = [];
    const bag = [...pool];
    while (pick.length < need && bag.length > 0) {
      pick.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
    }
    return pick.length === need ? pick : null;
  };

  let guard = 0;
  while (matched < cfg.pairs && guard++ < 4000) {
    const group = chooseGroup();
    if (!group) break;
    turns.push(seat);
    for (const card of group) {
      const before = flip;
      const out = tapCard(before, card, { gone: gone[card], faceUp: before.open.includes(card) });
      flip = out.state;
      taps++;
      known.set(card, deck[card].group);
      if (out.effect.kind === "resolve") {
        const ok = groupMatches(deck, out.effect.group);
        if (ok) {
          for (const c of out.effect.group) gone[c] = true;
          matched++;
          scores[seat]++;
        } else {
          misses++;
        }
        flip = settle(flip).state;
        seat = opts.twoSeats ? nextTurn(seat, ok) : seat;
        if (!opts.twoSeats && misses > limit) {
          return { cleared: false, misses, taps, scores, turns };
        }
      }
    }
  }

  return { cleared: matched >= cfg.pairs, misses, taps, scores, turns };
}

/* ------------------------------------------------------------------ */
/* 一、从首页进得去                                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · memory-cards · 首页进入", () => {
  it("meta 的 id / 关数 / 模式和实现对得上", () => {
    expect(meta.id).toBe("memory-cards");
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
  });

  it("十个主题都有名字与说明,六套原创图案一套不少", () => {
    expect(CHAPTERS).toHaveLength(10);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
    }
    expect(THEME_PACKS.length).toBeGreaterThanOrEqual(6);
  });

  it("每一关的配置都是合法的,进去不会发出一副空牌", () => {
    for (const cfg of LEVELS) {
      expect(cfg.pairs).toBeGreaterThan(0);
      expect([2, 3]).toContain(cfg.matchSize);
      expect(cfg.cols).toBeGreaterThanOrEqual(3);
      expect(deckSize(cfg)).toBe(cfg.pairs * cfg.matchSize + (cfg.decoys ?? 0));
      expect(deckSize(cfg) % 1).toBe(0);
      expect(cfg.maxMiss).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、赢一次 + 输一次                                                  */
/* ------------------------------------------------------------------ */

describe("档C R1 · memory-cards · 赢一次 + 输一次", () => {
  it("赢:第 1 关记得住的孩子一路配完,失误还没到上限", () => {
    const cfg = LEVELS[0];
    const s = playSession(cfg, deckSeed(0), { memory: true });
    expect(s.cleared).toBe(true);
    expect(s.misses).toBeLessThanOrEqual(cfg.maxMiss);
    expect(s.taps).toBeGreaterThanOrEqual(cfg.pairs * cfg.matchSize);
    const stars = starsForMisses(cfg.maxMiss, s.misses);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(wonLine(s.misses)).toContain(String(s.misses));
    expect(wonLine(s.misses, true)).toContain("记忆辅助");
  });

  it("输:把失误额度收到 0 就真的过不去,而且提示只鼓励", () => {
    const cfg = LEVELS[20];
    const s = playSession(cfg, deckSeed(20), { memory: false, maxMiss: 0 });
    expect(s.cleared).toBe(false);
    expect(s.misses).toBeGreaterThan(0);
    for (const line of [lostLine(false), lostLine(true)]) {
      expect(line.length).toBeGreaterThan(6);
      for (const bad of ["笨", "差劲", "失败", "不行"]) expect(line).not.toContain(bad);
    }
  });

  it("狂点保护:结算动画期间点第三张不会翻出来,但最后那一下会补上", () => {
    let s = startPlay(newFlipState(2, true));
    s = tapCard(s, 0, { gone: false, faceUp: false }).state;
    const resolved = tapCard(s, 1, { gone: false, faceUp: false });
    expect(resolved.effect.kind).toBe("resolve");
    s = resolved.state;
    expect(acceptsInput(s)).toBe(false);

    // 动画期间狂点五下,只留最后一下
    for (const c of [3, 4, 5, 6, 7]) {
      const out = tapCard(s, c, { gone: false, faceUp: false });
      expect(out.effect.kind).toBe("buffer");
      s = out.state;
    }
    const done = settle(s);
    expect(done.replay).toBe(7);
    expect(acceptsInput(done.state)).toBe(true);
    expect(done.state.open).toEqual([]);
  });

  it("已经配掉的牌、已经翻开的牌都点不动,不会白算一次失误", () => {
    let s = startPlay(newFlipState(2, true));
    expect(tapCard(s, 0, { gone: true, faceUp: false }).effect.kind).toBe("ignore");
    s = tapCard(s, 0, { gone: false, faceUp: false }).state;
    expect(tapCard(s, 0, { gone: false, faceUp: true }).effect.kind).toBe("ignore");
    expect(s.open).toEqual([0]);
  });

  it("三连卡的等待时间比对对碰长,开了辅助还会再多留一会儿", () => {
    expect(coverDelayMs(3, false)).toBeGreaterThan(coverDelayMs(2, false));
    expect(coverDelayMs(2, true)).toBeGreaterThan(coverDelayMs(2, false));
  });
});

/* ------------------------------------------------------------------ */
/* 三、战役第 1 / 100 / 188 关                                          */
/* ------------------------------------------------------------------ */

describe("档C R1 · memory-cards · 战役第 1 / 100 / 188 关", () => {
  const PICKS = [1, 100, 188];

  it.each(PICKS)("第 %i 关真的配得完,失误额度还有富余", (n) => {
    const cfg = LEVELS[n - 1];
    const s = playSession(cfg, deckSeed(n - 1), { memory: true });
    expect(s.cleared, `第 ${n} 关没配完`).toBe(true);
    expect(s.misses, `第 ${n} 关失误 ${s.misses} 超过额度 ${cfg.maxMiss}`).toBeLessThanOrEqual(cfg.maxMiss);
  });

  it.each(PICKS)("第 %i 关的牌面数量与分组都对得上", (n) => {
    const cfg = LEVELS[n - 1];
    const deck = buildDeck(cfg, deckSeed(n - 1));
    expect(deck).toHaveLength(deckSize(cfg));
    const counts = new Map<number, number>();
    for (const c of deck) if (!c.decoy) counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
    expect(counts.size).toBe(cfg.pairs);
    for (const [g, n2] of counts) expect(n2, `第 ${g} 组只有 ${n2} 张`).toBe(cfg.matchSize);
    expect(deck.filter((c) => c.decoy)).toHaveLength(cfg.decoys ?? 0);
  });

  it.each(PICKS)("第 %i 关限时(如果有)够记性完美的孩子玩完", (n) => {
    const cfg = LEVELS[n - 1];
    if (!cfg.timeLimit) return;
    const est = simulatePerfectPlay(cfg, deckSeed(n - 1));
    expect(estimateSeconds(est), `第 ${n} 关限时 ${cfg.timeLimit}s 不够`).toBeLessThan(cfg.timeLimit);
  });

  it("同一关重进两次发的是同一副牌", () => {
    for (const n of PICKS) {
      expect(buildDeck(LEVELS[n - 1], deckSeed(n - 1))).toEqual(buildDeck(LEVELS[n - 1], deckSeed(n - 1)));
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、无尽 / 对战 / 双人各玩到结算                                     */
/* ------------------------------------------------------------------ */

describe("档C R1 · memory-cards · 无尽玩到结算", () => {
  it("连打 20 轮每轮都配得完,一路走到结算", () => {
    let cleared = 0;
    for (let r = 1; r <= 20; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      const s = playSession(cfg, 4000 + r, { memory: true });
      expect(s.cleared, `第 ${r} 轮没配完`).toBe(true);
      cleared += cfg.pairs;
    }
    expect(cleared).toBeGreaterThan(0);
    expect(endlessScore(cleared)).toBe(cleared);
    expect(endlessLine(cleared, 3)).toContain("新纪录");
  });

  it("三次机会是外面统一管的,单轮不会先判负", () => {
    expect(ENDLESS_MAX_MISS).toBe(3);
    for (let r = 1; r <= 20; r++) {
      expect(endlessLevel(r, 6).maxMiss).toBeGreaterThan(ENDLESS_MAX_MISS);
    }
  });

  it("【C1-02 一般 · 待改】无尽从第 8 轮起完全不再变难,只换配色", () => {
    // 现状快照:endlessPairs 在第 8 轮触顶 10 组,之后每一轮的牌数、列数、机关全一样。
    expect(endlessPairs(8)).toBe(10);
    expect(endlessPairs(100)).toBe(10);
    const r8 = endlessLevel(8, 6);
    const r99 = endlessLevel(99, 6);
    const shape = (c: MemoryLevel): string =>
      JSON.stringify({
        pairs: c.pairs,
        cols: c.cols,
        matchSize: c.matchSize,
        decoys: c.decoys ?? 0,
        rotateEvery: c.rotateEvery ?? 0,
        swapEvery: c.swapEvery ?? 0,
        timeLimit: c.timeLimit,
      });
    expect(shape(r8)).toBe(shape(r99));
    // 唯一还在动的只有主题配色
    expect(r8.theme).not.toBe(r99.theme);
  });
});

describe("档C R1 · memory-cards · 对战 / 双人玩到结算", () => {
  it("两个人轮流翻,能把一整局翻完并分出结果", () => {
    const cfg = LEVELS[10];
    const s = playSession(cfg, deckSeed(10), { memory: true, twoSeats: true });
    expect(s.cleared).toBe(true);
    expect(s.scores[0] + s.scores[1]).toBe(cfg.pairs);
    const who = versusWinner(s.scores);
    expect(who === null || who === 0 || who === 1).toBe(true);
    const line = versusLine(s.scores);
    expect(line).toContain("组");
    for (const bad of ["输", "笨", "差劲"]) expect(line).not.toContain(bad);
  });

  it("配到就接着翻、没配到才换人 —— 轮次序列里能看出这条规则", () => {
    expect(nextTurn(0, true)).toBe(0);
    expect(nextTurn(0, false)).toBe(1);
    expect(nextTurn(1, false)).toBe(0);
    const cfg = LEVELS[4];
    const s = playSession(cfg, deckSeed(4), { memory: false, twoSeats: true });
    expect(s.turns.length).toBeGreaterThan(0);
    expect(new Set(s.turns).size).toBeGreaterThanOrEqual(1);
  });

  it("两个座位就是朵朵和星星,没有别的角色", () => {
    expect(SEAT_NAMES).toEqual(["朵朵", "星星"]);
    expect(versusLine([3, 1])).toContain("朵朵");
    expect(versusLine([1, 3])).toContain("星星");
    expect(versusLine([2, 2])).toContain("平手");
  });
});

/* ------------------------------------------------------------------ */
/* 五、360px 窄屏                                                       */
/* ------------------------------------------------------------------ */

describe("档C R1 · memory-cards · 360px 窄屏", () => {
  const rowsOf = (cfg: MemoryLevel): number => Math.ceil(deckSize(cfg) / cfg.cols);

  it("全部 188 关在 360px 上每张牌都不小于 56px(既有单测只抽了 5 关)", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const cfg = LEVELS[i];
      expect(
        cardWidthAt(360, cfg.cols, rowsOf(cfg)),
        `第 ${i + 1} 关的牌在 360px 上只有 ${cardWidthAt(360, cfg.cols, rowsOf(cfg))}px`
      ).toBeGreaterThanOrEqual(CARD_MIN_W);
    }
  });

  it("全部 188 关最多 6 行,一屏看得完不用滚动", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(rowsOf(LEVELS[i]), `第 ${i + 1} 关有 ${rowsOf(LEVELS[i])} 行`).toBeLessThanOrEqual(6);
    }
  });

  it("无尽 40 轮的牌盘在 360px 上也摆得下", () => {
    for (let r = 1; r <= 40; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      expect(cardWidthAt(360, cfg.cols, rowsOf(cfg))).toBeGreaterThanOrEqual(CARD_MIN_W);
      expect(rowsOf(cfg)).toBeLessThanOrEqual(6);
    }
  });

  it("牌越多间距越紧,但永远是正数", () => {
    expect(boardGap(5, 6)).toBeLessThan(boardGap(3, 3));
    for (const [c, r] of [
      [3, 2],
      [4, 4],
      [5, 6],
    ]) {
      expect(boardGap(c, r)).toBeGreaterThan(0);
    }
  });
});
