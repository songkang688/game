// 记忆翻翻乐 · 1.2 单测：翻牌状态机、翻转时序、无偏发牌、三种进阶机制、辅助档、无尽与双人。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS, type MemoryLevel } from "./levels";
import { THEME_PACKS } from "./art";
import {
  BACK_PATTERNS,
  CARD_MIN_W,
  ENDLESS_MAX_MISS,
  FLIP_FADE_MS,
  FLIP_MS,
  SEAT_NAMES,
  SWAP_WARN_MS,
  acceptsInput,
  assistChangesStars,
  assistLabel,
  assistTip,
  backPattern,
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
  endlessTheme,
  flipDuration,
  flipFrame,
  groupMatches,
  hitDecoy,
  iconIndexOf,
  lostLine,
  newFlipState,
  nextTurn,
  pickSwapPair,
  settle,
  simulatePerfectPlay,
  startPlay,
  starsForMisses,
  swapSlots,
  swapWarning,
  secondsToSwap,
  tapCard,
  versusLine,
  versusWinner,
  wonLine,
  type FlipState,
  type MemoryCard,
} from "./logic";

/** 一个普通的两张一组关卡，测状态机够用了 */
const PLAIN: MemoryLevel = {
  pairs: 4, cols: 4, maxMiss: 9, imp: 0, peekMs: 0, matchSize: 2, timeLimit: 0, theme: 0,
};

/** 手搓一副牌：0/1 一组，2/3 一组，4 是独苗 */
const HAND: MemoryCard[] = [
  { group: 0, face: "🐱", decoy: false },
  { group: 0, face: "🐱", decoy: false },
  { group: 1, face: "🐶", decoy: false },
  { group: 1, face: "🐶", decoy: false },
  { group: 1000, face: "🦊", decoy: true },
];

const FREE = { gone: false, faceUp: false };

describe("记忆翻翻乐 · 翻牌状态机", () => {
  it("狂点也翻不出第三张：一组齐了就进结算，后面全部不翻", () => {
    let s = newFlipState(2);
    const a = tapCard(s, 0, FREE);
    s = a.state;
    expect(a.effect).toEqual({ kind: "flip", card: 0 });
    expect(s.phase).toBe("open");
    const b = tapCard(s, 2, FREE);
    s = b.state;
    expect(b.effect).toEqual({ kind: "resolve", card: 2, group: [0, 2] });
    expect(s.phase).toBe("resolving");
    // 结算动画期间连点三下，一张都翻不出来
    for (const card of [1, 3, 4]) {
      const r = tapCard(s, card, FREE);
      s = r.state;
      expect(r.effect.kind).toBe("buffer");
    }
    expect(s.open).toEqual([]);
  });

  it("三张一组的关：翻满三张才判定，第二张还只是继续翻", () => {
    let s = newFlipState(3);
    expect(tapCard(s, 0, FREE).effect.kind).toBe("flip");
    s = tapCard(s, 0, FREE).state;
    const two = tapCard(s, 1, FREE);
    expect(two.effect.kind).toBe("flip");
    s = two.state;
    const three = tapCard(s, 2, FREE);
    expect(three.effect).toEqual({ kind: "resolve", card: 2, group: [0, 1, 2] });
    expect(three.state.phase).toBe("resolving");
  });

  it("动画期间的点击不吃掉：只留最后一次，结算完替玩家补上", () => {
    let s: FlipState = { phase: "resolving", matchSize: 2, open: [], pending: null };
    s = tapCard(s, 1, FREE).state;
    s = tapCard(s, 3, FREE).state;
    // 狂点三下也只攒下最后那一下，不会结算完连翻一串
    s = tapCard(s, 4, FREE).state;
    expect(s.pending).toBe(4);
    const back = settle(s);
    expect(back.replay).toBe(4);
    expect(back.state.phase).toBe("idle");
    expect(back.state.pending).toBeNull();
    expect(settle(back.state).replay).toBeNull();
  });

  it("同一张点两下、已配掉的空位、开局偷看期间，一律不算数", () => {
    const open: FlipState = { phase: "open", matchSize: 2, open: [7], pending: null };
    expect(tapCard(open, 7, FREE).effect.kind).toBe("ignore");
    expect(tapCard(open, 8, { gone: true, faceUp: false }).effect.kind).toBe("ignore");
    expect(tapCard(open, 8, { gone: false, faceUp: true }).effect.kind).toBe("ignore");
    const dealing = newFlipState(2, true);
    expect(dealing.phase).toBe("dealing");
    expect(tapCard(dealing, 0, FREE).effect.kind).toBe("ignore");
    // 偷看结束才开始收输入
    expect(tapCard(startPlay(dealing), 0, FREE).effect.kind).toBe("flip");
  });

  it("只有空闲和翻开中才吃输入，发牌与结算期间画面知道要变灰", () => {
    expect(acceptsInput(newFlipState(2))).toBe(true);
    expect(acceptsInput(newFlipState(2, true))).toBe(false);
    expect(acceptsInput({ phase: "open", matchSize: 2, open: [1], pending: null })).toBe(true);
    expect(acceptsInput({ phase: "resolving", matchSize: 2, open: [], pending: null })).toBe(false);
  });
});

describe("记忆翻翻乐 · 翻转动画的时序", () => {
  it("背面到正面的切换卡在 90° 那一帧，中途绝不露馅", () => {
    expect(flipFrame(0).showFace).toBe(false);
    expect(flipFrame(FLIP_MS * 0.49).deg).toBeLessThan(90);
    expect(flipFrame(FLIP_MS * 0.49).showFace).toBe(false);
    expect(flipFrame(FLIP_MS / 2).deg).toBe(90);
    expect(flipFrame(FLIP_MS / 2).showFace).toBe(true);
    expect(flipFrame(FLIP_MS).deg).toBe(180);
    expect(flipFrame(FLIP_MS).done).toBe(true);
    // 超时的帧不会越界
    expect(flipFrame(FLIP_MS * 3).t).toBe(1);
  });

  it("盖回去是同一段动画倒着放，换面同样在半程", () => {
    expect(flipFrame(0, FLIP_MS, false).deg).toBe(180);
    expect(flipFrame(0, FLIP_MS, false).showFace).toBe(true);
    expect(flipFrame(FLIP_MS / 2, FLIP_MS, false).deg).toBe(90);
    expect(flipFrame(FLIP_MS / 2, FLIP_MS, false).showFace).toBe(false);
    expect(flipFrame(FLIP_MS, FLIP_MS, false).deg).toBe(0);
  });

  it("关掉动画效果的孩子改成淡入淡出，时长更短但半程换面的语义不变", () => {
    expect(flipDuration(false)).toBe(FLIP_MS);
    expect(flipDuration(true)).toBe(FLIP_FADE_MS);
    expect(FLIP_MS).toBeGreaterThanOrEqual(180);
    expect(FLIP_MS).toBeLessThanOrEqual(220);
    const half = flipFrame(FLIP_FADE_MS / 2, FLIP_FADE_MS);
    expect(half.showFace).toBe(true);
    expect(flipFrame(FLIP_FADE_MS / 2 - 1, FLIP_FADE_MS).showFace).toBe(false);
  });
});

describe("记忆翻翻乐 · 发牌", () => {
  it("洗牌无偏：每个位置落到同一组牌的次数都在合理区间（Fisher–Yates 统计断言）", () => {
    const cfg: MemoryLevel = { ...PLAIN, pairs: 4 };
    const n = deckSize(cfg);
    const hits = new Array<number>(n).fill(0);
    const runs = 2400;
    for (let seed = 1; seed <= runs; seed++) {
      const deck = buildDeck(cfg, seed);
      deck.forEach((c, i) => {
        if (c.group === 0) hits[i]++;
      });
    }
    // 8 个位置、每副牌 2 张 0 号牌：每个位置的期望是 600 次
    const expected = (runs * cfg.matchSize) / n;
    for (const h of hits) {
      expect(h).toBeGreaterThan(expected * 0.8);
      expect(h).toBeLessThan(expected * 1.2);
    }
    expect(hits.reduce((a, b) => a + b, 0)).toBe(runs * cfg.matchSize);
  });

  it("同一对不会老是挨着发，不然一眼就配完了", () => {
    const cfg: MemoryLevel = { ...PLAIN, pairs: 6 };
    let adjacentTotal = 0;
    let allSeparated = 0;
    const runs = 300;
    for (let seed = 1; seed <= runs; seed++) {
      const deck = buildDeck(cfg, seed);
      let adj = 0;
      for (let i = 0; i + 1 < deck.length; i++) {
        if (deck[i].group === deck[i + 1].group) adj++;
      }
      adjacentTotal += adj;
      if (adj === 0) allSeparated++;
    }
    // 12 张牌里平均挨着的对数应该很少（随机洗牌下 ~1 对）
    expect(adjacentTotal / runs).toBeLessThan(2);
    // 而且大部分局面里不是每一对都挨着
    expect(allSeparated).toBeGreaterThan(runs * 0.2);
  });

  it("正牌刚好凑得成一组、独苗卡真的没同伴、张数一张不差", () => {
    for (const level of [0, 30, 66, 98, 120, 150, 187]) {
      const cfg = LEVELS[level];
      const deck = buildDeck(cfg, deckSeed(level));
      expect(deck).toHaveLength(deckSize(cfg));
      const byGroup = new Map<number, number>();
      for (const c of deck) byGroup.set(c.group, (byGroup.get(c.group) ?? 0) + 1);
      let groups = 0;
      for (const [g, count] of byGroup) {
        if (g >= 1000) expect(count).toBe(1);
        else {
          expect(count).toBe(cfg.matchSize);
          groups++;
        }
      }
      expect(groups).toBe(cfg.pairs);
    }
  });

  it("同一关同一种子发出来的牌一模一样，孩子重来不会换一套题", () => {
    const a = buildDeck(LEVELS[42], deckSeed(42));
    const b = buildDeck(LEVELS[42], deckSeed(42));
    expect(a).toEqual(b);
    expect(buildDeck(LEVELS[42], deckSeed(42) + 1)).not.toEqual(a);
  });

  it("每张牌都能找到自己那个原创图案，编号绝不越界", () => {
    for (const level of [0, 20, 55, 98, 150, 187]) {
      const cfg = LEVELS[level];
      const deck = buildDeck(cfg, deckSeed(level));
      const size = THEME_PACKS[0].icons.length;
      for (const card of deck) {
        const idx = iconIndexOf(cfg, card, size);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(size);
      }
      // 同一组的牌画的一定是同一个图案
      const first = deck.find((c) => !c.decoy)!;
      const same = deck.filter((c) => c.group === first.group);
      const idxs = new Set(same.map((c) => iconIndexOf(cfg, c, size)));
      expect(idxs.size).toBe(1);
    }
  });
});

describe("记忆翻翻乐 · 配对判定与计分", () => {
  it("同组才算配上，独苗卡永远配不上，也能被认出来", () => {
    expect(groupMatches(HAND, [0, 1])).toBe(true);
    expect(groupMatches(HAND, [2, 3])).toBe(true);
    expect(groupMatches(HAND, [0, 2])).toBe(false);
    expect(groupMatches(HAND, [0, 4])).toBe(false);
    expect(groupMatches(HAND, [4, 4])).toBe(false);
    expect(groupMatches(HAND, [])).toBe(false);
    expect(hitDecoy(HAND, [0, 4])).toBe(4);
    expect(hitDecoy(HAND, [0, 1])).toBeNull();
  });

  it("翻错越少星越多，评星口径与 1.1 一模一样", () => {
    expect(starsForMisses(9, 0)).toBe(3);
    expect(starsForMisses(9, 3)).toBe(3);
    expect(starsForMisses(9, 4)).toBe(2);
    expect(starsForMisses(9, 6)).toBe(2);
    expect(starsForMisses(9, 7)).toBe(1);
    // maxMiss 很小的关也不会把三星门槛压成 0
    expect(starsForMisses(2, 0)).toBe(3);
    expect(starsForMisses(2, 3)).toBe(1);
  });

  it("过关保留 1.1 的原话，没过关只鼓励、不批评", () => {
    expect(wonLine(1)).toBe("全部配对成功，只翻错 1 次，记忆很扎实！");
    expect(wonLine(2, true)).toContain("记忆辅助");
    for (const line of [lostLine(true), lostLine(false)]) {
      expect(line.length).toBeGreaterThan(10);
      for (const bad of ["笨", "失败", "输了", "不行", "真差"]) expect(line).not.toContain(bad);
      expect(line).toContain("～");
    }
  });
});

describe("记忆翻翻乐 · 记忆辅助档", () => {
  it("辅助档只多亮一会儿位置，三星标准一个字没动", () => {
    expect(assistChangesStars()).toBe(false);
    expect(coverDelayMs(2, true)).toBeGreaterThan(coverDelayMs(2, false));
    expect(coverDelayMs(2, false)).toBe(750);
    expect(coverDelayMs(3, false)).toBe(950);
    expect(coverDelayMs(3, true) - coverDelayMs(3, false)).toBe(coverDelayMs(2, true) - coverDelayMs(2, false));
  });

  it("开关文案一眼看得出现在是开还是关，说明里也点明不影响拿三星", () => {
    expect(assistLabel(true)).not.toBe(assistLabel(false));
    expect(assistLabel(true)).toContain("开");
    expect(assistLabel(false)).toContain("关");
    expect(assistTip(true)).toContain("三星");
    expect(assistTip(false).length).toBeGreaterThan(8);
  });
});

describe("记忆翻翻乐 · 会移动的牌", () => {
  it("换位置之前先亮预警，倒计时一秒一秒往下走", () => {
    expect(secondsToSwap(10000, 0)).toBe(10);
    expect(secondsToSwap(10000, 2500)).toBe(8);
    expect(secondsToSwap(10000, 9750)).toBe(1);
    expect(secondsToSwap(0, 500)).toBe(0);
    expect(swapWarning(10000, 0)).toBe(false);
    expect(swapWarning(10000, 10000 - SWAP_WARN_MS)).toBe(true);
    expect(swapWarning(10000, 9900)).toBe(true);
    expect(swapWarning(0, 9900)).toBe(false);
    expect(SWAP_WARN_MS).toBeGreaterThanOrEqual(1000);
  });

  it("只在扣着的牌里挑两张换，挑不出两张就干脆不换", () => {
    const hidden = [2, 5, 7, 9];
    for (const r of [0, 0.25, 0.5, 0.99]) {
      const pair = pickSwapPair(hidden, () => r);
      expect(pair).not.toBeNull();
      expect(pair![0]).not.toBe(pair![1]);
      for (const s of pair!) expect(hidden).toContain(s);
    }
    expect(pickSwapPair([3], () => 0.5)).toBeNull();
    expect(pickSwapPair([], () => 0.5)).toBeNull();
  });

  it("换完位置牌一张不多一张不少，越界的下标不会把牌弄丢", () => {
    const order = [0, 1, 2, 3, 4, 5];
    const next = swapSlots(order, 1, 4);
    expect(next).toEqual([0, 4, 2, 3, 1, 5]);
    expect(next.slice().sort((a, b) => a - b)).toEqual(order);
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
    expect(swapSlots(order, -1, 3)).toEqual(order);
    expect(swapSlots(order, 2, 99)).toEqual(order);
  });

  it("会移动的牌只在后段章节出现，前 99 关一张都不带", () => {
    for (let i = 0; i < 99; i++) expect(LEVELS[i].swapEvery).toBeUndefined();
    const withSwap = LEVELS.filter((lv) => (lv.swapEvery ?? 0) > 0);
    expect(withSwap.length).toBeGreaterThan(0);
    for (const lv of withSwap) expect(lv.swapEvery).toBeGreaterThanOrEqual(8000);
  });
});

describe("记忆翻翻乐 · 卡背花纹", () => {
  it("花纹只跟槽位走：牌换了位置也不会把身份泄出去", () => {
    for (let s = 0; s < 30; s++) {
      const p = backPattern(s, 3);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(BACK_PATTERNS);
      // 同一个槽位无论现在扣着哪张牌，花纹永远是这一个
      expect(backPattern(s, 3)).toBe(p);
    }
    // 邻座的花纹不一样，看起来才不像复印的
    expect(backPattern(0, 0)).not.toBe(backPattern(1, 0));
    expect(BACK_PATTERNS).toBeGreaterThanOrEqual(3);
  });
});

describe("记忆翻翻乐 · 无尽记忆挑战", () => {
  it("对数一轮比一轮多，最多到 10 组就封顶", () => {
    expect(endlessPairs(1)).toBe(3);
    expect(endlessPairs(2)).toBe(4);
    for (let r = 1; r < 20; r++) {
      expect(endlessPairs(r + 1)).toBeGreaterThanOrEqual(endlessPairs(r));
      expect(endlessPairs(r)).toBeLessThanOrEqual(10);
    }
    expect(endlessPairs(50)).toBe(10);
  });

  it("每轮换一套主题，六套轮着来，编号不会越界", () => {
    const packs = THEME_PACKS.length;
    const seen = new Set<number>();
    for (let r = 1; r <= packs; r++) {
      const t = endlessTheme(r, packs);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(packs);
      seen.add(t);
    }
    expect(seen.size).toBe(packs);
    expect(endlessTheme(packs + 1, packs)).toBe(endlessTheme(1, packs));
  });

  it("每轮的牌盘摆得下、第一轮先给偷看，三次机会由外面统一管", () => {
    expect(ENDLESS_MAX_MISS).toBe(3);
    for (let r = 1; r <= 12; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      expect(cfg.pairs).toBe(endlessPairs(r));
      expect(cfg.matchSize).toBe(2);
      expect(cfg.cols).toBeLessThanOrEqual(5);
      expect(Math.ceil(deckSize(cfg) / cfg.cols)).toBeLessThanOrEqual(6);
      expect(cfg.timeLimit).toBe(0);
      expect(cfg.maxMiss).toBeGreaterThan(ENDLESS_MAX_MISS);
    }
    expect(endlessLevel(1, 6).peekMs).toBeGreaterThan(0);
    expect(endlessLevel(2, 6).peekMs).toBe(0);
  });

  it("成绩就是一路配掉的组数，收工那句话只鼓励", () => {
    expect(endlessScore(0)).toBe(0);
    expect(endlessScore(12)).toBe(12);
    expect(endlessScore(-3)).toBe(0);
    expect(endlessLine(0, 5)).toContain("先把前两张记牢");
    expect(endlessLine(9, 5)).toContain("新纪录");
    expect(endlessLine(3, 9)).toContain("最好成绩 9 组");
    for (const line of [endlessLine(0, 0), endlessLine(4, 9)]) {
      for (const bad of ["失败", "输", "笨"]) expect(line).not.toContain(bad);
    }
  });
});

describe("记忆翻翻乐 · 双人轮流翻", () => {
  it("配到一组就接着翻，没配到才换人", () => {
    expect(nextTurn(0, true)).toBe(0);
    expect(nextTurn(1, true)).toBe(1);
    expect(nextTurn(0, false)).toBe(1);
    expect(nextTurn(1, false)).toBe(0);
  });

  it("配对多的那个人赢，一样多就是平手，两种收场都不损人", () => {
    expect(versusWinner([5, 3])).toBe(0);
    expect(versusWinner([2, 6])).toBe(1);
    expect(versusWinner([4, 4])).toBeNull();
    expect(versusLine([4, 4])).toContain("平");
    expect(versusLine([5, 3])).toContain(SEAT_NAMES[0]);
    expect(versusLine([2, 6])).toContain(SEAT_NAMES[1]);
    for (const line of [versusLine([4, 4]), versusLine([5, 3])]) {
      for (const bad of ["输", "笨", "差劲"]) expect(line).not.toContain(bad);
    }
  });
});

describe("记忆翻翻乐 · 窄屏与可完成性", () => {
  it("360px 窄屏上每张牌都不小于 56px，牌越多间距自动收紧", () => {
    for (const level of [0, 55, 99, 143, 187]) {
      const cfg = LEVELS[level];
      const rows = Math.ceil(deckSize(cfg) / cfg.cols);
      const w = cardWidthAt(360, cfg.cols, rows);
      expect(w).toBeGreaterThanOrEqual(CARD_MIN_W);
    }
    expect(boardGap(5, 6)).toBeLessThan(boardGap(3, 3));
    expect(cardWidthAt(360, 5, 6)).toBeGreaterThanOrEqual(CARD_MIN_W);
  });

  it("188 关抽样：记性完美的孩子都能把每一关配完，失误额度还有富余", () => {
    const bad: string[] = [];
    for (let i = 0; i < 188; i += 7) {
      const cfg = LEVELS[i];
      const est = simulatePerfectPlay(cfg, deckSeed(i));
      if (est.misses > cfg.maxMiss) bad.push(`第${i + 1}关 失误${est.misses}/${cfg.maxMiss}`);
      expect(est.flips).toBeGreaterThanOrEqual(cfg.pairs * cfg.matchSize);
    }
    expect(bad).toEqual([]);
  });

  it("destroy 里定时器、心跳与结算回调全部归零", () => {
    const src = readFileSync("src/games/memory-cards/index.ts", "utf8");
    expect(src).toContain("clearInterval(ticker)");
    expect(src).toContain("clearInterval(beat)");
    expect(src).toContain("timeouts.forEach((t) => clearTimeout(t))");
    expect(src).toContain("timeouts.clear()");
    // 三种模式各自的 destroy 都要把里面那盘牌拆掉
    expect(src.match(/run\?\.destroy\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
