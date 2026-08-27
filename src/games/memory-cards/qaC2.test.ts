// 窗口 4 · QA 档C · 第 2 轮测试员:记忆翻翻乐。
//
// 第 2 轮剧本(样本全换):难度曲线 → 竞态(狂点 / 同一拍翻第三张 / 结算期间重入 / 换位与旋转同拍)→
// 无尽持续(打 200 轮)→ 存档往返。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, chapterOf, loadStars, mulberry32, saveStar, type StorageLike } from "../level99";
import { THEME_PACKS } from "./art";
import { CHAPTERS, LEVELS, type MemoryLevel } from "./levels";
import {
  ENDLESS_MAX_DECOYS,
  ENDLESS_MAX_MISS,
  ENDLESS_MAX_PAIRS,
  ENDLESS_ROTATE_FROM,
  ENDLESS_SWAP_FROM,
  SWAP_WARN_MS,
  acceptsInput,
  buildDeck,
  deckSeed,
  deckSize,
  endlessDifficulty,
  endlessLevel,
  endlessLine,
  endlessScore,
  endlessTheme,
  endlessTwist,
  groupMatches,
  newFlipState,
  pickSwapPair,
  rotatePositions,
  secondsToSwap,
  settle,
  simulatePerfectPlay,
  startPlay,
  starsForMisses,
  swapSlots,
  swapWarning,
  tapCard,
  type FlipState,
} from "./logic";

/* ------------------------------------------------------------------ */
/* 一张真牌桌:每一次点击都过 tapCard → resolve → settle               */
/* ------------------------------------------------------------------ */

class Table {
  cfg: MemoryLevel;
  deck = buildDeck(LEVELS[0], 1);
  order: number[];
  gone: boolean[];
  faceUp = new Set<number>();
  flip: FlipState;
  misses = 0;
  matched = 0;
  /** 每一次点击的去向 */
  log: string[] = [];

  constructor(cfg: MemoryLevel, seed: number) {
    this.cfg = cfg;
    this.deck = buildDeck(cfg, seed);
    this.order = this.deck.map((_c, i) => i);
    this.gone = new Array<boolean>(this.deck.length).fill(false);
    this.flip = startPlay(newFlipState(cfg.matchSize, true));
  }

  /** 点第 card 张牌(牌号,不是槽位)。返回这一下有没有真的翻出一张牌 */
  tap(card: number): boolean {
    const r = tapCard(this.flip, card, { gone: this.gone[card], faceUp: this.faceUp.has(card) });
    this.flip = r.state;
    this.log.push(r.effect.kind);
    if (r.effect.kind === "flip") {
      this.faceUp.add(card);
      return true;
    }
    if (r.effect.kind === "resolve") {
      this.faceUp.add(card);
      this.resolve(r.effect.group);
      return true;
    }
    return false;
  }

  private resolve(group: number[]): void {
    if (groupMatches(this.deck, group)) {
      for (const c of group) this.gone[c] = true;
      this.matched++;
    } else {
      this.misses++;
      for (const c of group) this.faceUp.delete(c);
    }
  }

  /**
   * 结算动画播完:回到空闲,并把动画期间那一下补上。
   * 只有 `resolving` 才会走到这儿 —— 游戏里 settle 就挂在结算动画的回调上。
   */
  settleNow(): void {
    if (this.flip.phase !== "resolving") return;
    const s = settle(this.flip);
    this.flip = s.state;
    if (s.replay !== null) this.tap(s.replay);
  }

  snapshot(): string {
    return JSON.stringify([this.gone, [...this.faceUp].sort(), this.misses, this.matched, this.flip]);
  }
}

/**
 * 把整局打完:每一次点击都真的过 `tapCard → resolve → settle`。
 * 这个机器人是「全知」的(直接挑同一组的牌),用途是证明**这一关配得完**;
 * 「记性完美的孩子要错几次」另有 `simulatePerfectPlay` 管。
 */
function playAll(cfg: MemoryLevel, seed: number): Table {
  const t = new Table(cfg, seed);
  let guard = 0;
  while (t.matched < cfg.pairs && guard++ < 5000) {
    // 找一组还活着、而且凑得齐 matchSize 张的
    const byGroup = new Map<number, number[]>();
    t.deck.forEach((card, i) => {
      if (t.gone[i] || card.decoy) return;
      byGroup.set(card.group, [...(byGroup.get(card.group) ?? []), i]);
    });
    const pick = [...byGroup.values()].find((cards) => cards.length >= cfg.matchSize);
    if (!pick) break;
    for (const c of pick.slice(0, cfg.matchSize)) t.tap(c);
    t.settleNow();
  }
  return t;
}

/** 第 2 轮换的样本:和第 1 轮的 1 / 100 / 188 一关不重 */
const SAMPLE = [12, 27, 43, 66, 81, 104, 121, 145, 161, 179];

/* ------------------------------------------------------------------ */
/* 一、难度曲线                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · memory-cards · 难度曲线", () => {
  it("一章比一章多几张牌,机关也一章比一章多", () => {
    const perCh = CHAPTERS.map((_, ci) => {
      const rows = LEVELS.filter((_l, i) => chapterOf(CHAPTERS, i) === ci);
      const mech = rows.filter(
        (l) => l.imp > 0 || l.mathPairs || (l.rotateEvery ?? 0) > 0 || (l.decoys ?? 0) > 0 || (l.swapEvery ?? 0) > 0
      ).length;
      return {
        ci,
        n: rows.length,
        pairs: rows.reduce((s, l) => s + l.pairs, 0) / Math.max(1, rows.length),
        mechRate: mech / Math.max(1, rows.length),
      };
    });
    for (const p of perCh) expect(p.n, `第 ${p.ci + 1} 章一关都没有`).toBeGreaterThan(0);
    expect(perCh[0].pairs).toBeLessThan(perCh[perCh.length - 1].pairs);
    expect(perCh[0].mechRate, "第 1 章一上来就全是机关").toBeLessThan(0.2);
    expect(perCh[perCh.length - 1].mechRate, "终极章反而没机关").toBeGreaterThan(0.8);
  });

  it("每一章内部也在往上走:章末的组数不比章首少", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const rows = LEVELS.filter((_l, i) => chapterOf(CHAPTERS, i) === ci);
      expect(rows[rows.length - 1].pairs, `第 ${ci + 1} 章章末反而更简单`).toBeGreaterThanOrEqual(
        rows[0].pairs
      );
    }
  });

  it("换一批样本关:每一关记性完美的孩子都过得去,失误额度都够宽", () => {
    for (const i of SAMPLE) {
      const cfg = LEVELS[i];
      const est = simulatePerfectPlay(cfg, deckSeed(i));
      expect(cfg.maxMiss, `第 ${i + 1} 关最少要错 ${est.misses} 次,却只给 ${cfg.maxMiss} 次`).toBeGreaterThan(
        est.misses
      );
      expect(est.flips, `第 ${i + 1} 关一张牌都不用翻?`).toBeGreaterThan(0);
    }
  });

  it("评星门槛单调:错得越多星越少", () => {
    for (const i of SAMPLE) {
      const cfg = LEVELS[i];
      let prev: number = 4;
      for (let m = 0; m <= cfg.maxMiss; m++) {
        const s = starsForMisses(cfg.maxMiss, m);
        expect(s, `第 ${i + 1} 关错 ${m} 次反而星更多`).toBeLessThanOrEqual(prev);
        prev = s;
      }
      expect(starsForMisses(cfg.maxMiss, 0)).toBe(3);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 二、竞态                                                            */
/* ------------------------------------------------------------------ */

describe("档C R2 · memory-cards · 竞态", () => {
  const CFG = LEVELS[SAMPLE[1]];

  it("同一张牌狂点 40 下:只翻开一次,后面全被忽略", () => {
    const t = new Table(CFG, 501);
    for (let k = 0; k < 40; k++) t.tap(0);
    expect(t.faceUp.size).toBe(1);
    expect(t.log.filter((x) => x === "flip")).toHaveLength(1);
    expect(t.log.filter((x) => x === "ignore")).toHaveLength(39);
  });

  it("凑齐一组的同一拍再点第三张:点不出来,只会被收进 pending", () => {
    const t = new Table(CFG, 502);
    t.tap(0);
    t.tap(1);
    expect(t.flip.phase).toBe("resolving");
    expect(acceptsInput(t.flip)).toBe(false);
    for (let k = 2; k < 12; k++) t.tap(k);
    // 结算期间一张都没翻开
    expect(t.log.filter((x) => x === "buffer")).toHaveLength(10);
    // pending 只留最后一次,狂点不会攒出一串
    expect(t.flip.pending).toBe(11);
  });

  it("结算播完之后,动画期间那一下会被补上 —— 不吃掉玩家的点击", () => {
    const t = new Table(CFG, 503);
    t.tap(0);
    t.tap(1);
    t.tap(5);
    expect(t.flip.pending).toBe(5);
    t.settleNow();
    expect(t.flip.phase === "open" || t.flip.phase === "idle").toBe(true);
    expect(t.faceUp.has(5) || t.gone[5]).toBe(true);
    expect(t.flip.pending).toBeNull();
  });

  it("发牌 / 偷看期间点破天也翻不动", () => {
    const s0 = newFlipState(2, true);
    expect(acceptsInput(s0)).toBe(false);
    let s = s0;
    for (let k = 0; k < 50; k++) {
      const r = tapCard(s, k % 8, { gone: false, faceUp: false });
      expect(r.effect.kind).toBe("ignore");
      s = r.state;
    }
    expect(s).toEqual(s0);
    // 发完牌就能翻了
    expect(acceptsInput(startPlay(s))).toBe(true);
  });

  it("已经配掉的牌怎么点都没反应", () => {
    const t = new Table(CFG, 504);
    // 先真配掉一组
    const g = t.deck[0].group;
    const pair = t.deck.map((_c, i) => i).filter((i) => t.deck[i].group === g).slice(0, CFG.matchSize);
    for (const c of pair) t.tap(c);
    t.settleNow();
    expect(pair.every((c) => t.gone[c])).toBe(true);
    const before = t.snapshot();
    for (let k = 0; k < 30; k++) for (const c of pair) t.tap(c);
    expect(t.snapshot()).toBe(before);
  });

  it("整局狂点 3000 下:配掉的组数永远等于真配上的次数,不会多算", () => {
    const t = new Table(CFG, 505);
    const rand = mulberry32(70707);
    for (let k = 0; k < 3000; k++) {
      t.tap(Math.floor(rand() * t.deck.length));
      if (rand() < 0.35) t.settleNow();
    }
    const goneCount = t.gone.filter(Boolean).length;
    expect(goneCount).toBe(t.matched * CFG.matchSize);
    expect(t.matched).toBeLessThanOrEqual(CFG.pairs);
    // 翻开着的牌永远不会超过一组
    expect(t.faceUp.size - goneCount).toBeLessThanOrEqual(CFG.matchSize);
  });

  it("旋转和换位撞在同一拍:牌一张不丢、不叠、不跑到已配掉的槽上", () => {
    const cfg = LEVELS.find((l) => (l.rotateEvery ?? 0) > 0) ?? LEVELS[SAMPLE[8]];
    const n = deckSize(cfg);
    const gone = new Array<boolean>(n).fill(false);
    // 先假装配掉两张
    gone[0] = true;
    gone[1] = true;
    let order = Array.from({ length: n }, (_, i) => i);
    const rand = mulberry32(31);
    for (let k = 0; k < 400; k++) {
      order = rotatePositions(order, gone);
      const hidden = order.map((_c, s) => s).filter((s) => !gone[order[s]]);
      const pair = pickSwapPair(hidden, rand);
      if (pair) order = swapSlots(order, pair[0], pair[1]);
      expect(order, `第 ${k} 拍之后牌数变了`).toHaveLength(n);
      expect(new Set(order).size, `第 ${k} 拍之后有牌叠在一起`).toBe(n);
    }
  });

  it("换位只在扣着的牌里挑,挑不出两张就干脆不换", () => {
    expect(pickSwapPair([], Math.random)).toBeNull();
    expect(pickSwapPair([3], Math.random)).toBeNull();
    const rand = mulberry32(5);
    for (let k = 0; k < 200; k++) {
      const p = pickSwapPair([2, 4, 6, 8], rand);
      expect(p).not.toBeNull();
      if (p) {
        expect(p[0]).not.toBe(p[1]);
        expect([2, 4, 6, 8]).toContain(p[0]);
        expect([2, 4, 6, 8]).toContain(p[1]);
      }
    }
  });

  it("换位前一定先亮预警,而且倒计时不会走到 0 以下", () => {
    const every = 10000;
    let warned = false;
    for (let ms = 0; ms < every * 3; ms += 250) {
      const left = secondsToSwap(every, ms);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(every / 1000);
      if (swapWarning(every, ms)) warned = true;
    }
    expect(warned).toBe(true);
    expect(swapWarning(every, every - SWAP_WARN_MS + 1)).toBe(true);
    expect(swapWarning(every, 100)).toBe(false);
    // 没有换位机关的关不会误报
    expect(swapWarning(0, 12345)).toBe(false);
    expect(secondsToSwap(0, 12345)).toBe(0);
  });

  it("交换槽位越界不会把牌弄丢", () => {
    const base = [0, 1, 2, 3, 4];
    expect(swapSlots(base, -1, 2)).toEqual(base);
    expect(swapSlots(base, 2, 99)).toEqual(base);
    expect(swapSlots(base, 0, 4)).toEqual([4, 1, 2, 3, 0]);
    expect(swapSlots(base, 2, 2)).toEqual(base);
  });
});

/* ------------------------------------------------------------------ */
/* 三、无尽持续                                                        */
/* ------------------------------------------------------------------ */

describe("档C R2 · memory-cards · 无尽打 200 轮", () => {
  it("每一轮都发得出牌、配得完,一路走到第 200 轮", () => {
    let cleared = 0;
    for (let r = 1; r <= 200; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      const t = playAll(cfg, 8000 + r);
      expect(t.matched, `第 ${r} 轮只配完 ${t.matched}/${cfg.pairs} 组`).toBe(cfg.pairs);
      cleared += cfg.pairs;
    }
    expect(endlessScore(cleared)).toBe(cleared);
    expect(cleared).toBeGreaterThan(1500);
  });

  it("难度分从第 1 轮到第 200 轮一路不降", () => {
    for (let r = 2; r <= 200; r++) {
      expect(endlessDifficulty(r), `第 ${r} 轮反而更简单`).toBeGreaterThanOrEqual(
        endlessDifficulty(r - 1)
      );
    }
    expect(endlessDifficulty(40)).toBeGreaterThan(endlessDifficulty(8));
  });

  it("机关是一样一样上的,而且一路不会破自己的下限", () => {
    for (let r = 1; r <= 200; r++) {
      const { rotateEvery, swapEvery } = endlessTwist(r);
      expect(swapEvery === 0 || swapEvery >= 8000, `第 ${r} 轮换位太勤`).toBe(true);
      expect(rotateEvery === 0 || rotateEvery >= 5, `第 ${r} 轮转太勤`).toBe(true);
      if (r < ENDLESS_SWAP_FROM) expect(swapEvery).toBe(0);
      if (r < ENDLESS_ROTATE_FROM) expect(rotateEvery).toBe(0);
    }
  });

  it("牌数、列数、失误额度 200 轮不越界", () => {
    for (let r = 1; r <= 200; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      expect(cfg.pairs).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS);
      // 第 3 轮起第 30 轮之后会混进最多 3 张独苗卡(L3-02),牌数上限跟着放宽这 3 张
      expect(deckSize(cfg)).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS * 2 + ENDLESS_MAX_DECOYS);
      expect(cfg.maxMiss).toBeGreaterThan(ENDLESS_MAX_MISS);
      expect(cfg.cols).toBeLessThanOrEqual(5);
    }
  });

  it("六套主题轮着换,200 轮里每一套都出得来", () => {
    const seen = new Set<number>();
    for (let r = 1; r <= 200; r++) seen.add(endlessTheme(r, THEME_PACKS.length));
    expect(seen.size).toBe(THEME_PACKS.length);
    expect(endlessTheme(0, 6)).toBe(endlessTheme(1, 6));
    expect(endlessTheme(-5, 6)).toBe(endlessTheme(1, 6));
  });

  it("收工那句话只鼓励,破纪录会点出来", () => {
    expect(endlessLine(0, 0)).toContain("先把前两张记牢");
    expect(endlessLine(40, 10)).toContain("新纪录");
    expect(endlessLine(5, 40)).toContain("40");
    for (const [p, b] of [[0, 0], [3, 3], [99, 1]]) {
      const line = endlessLine(p, b);
      for (const bad of ["输", "笨", "菜", "失败"]) expect(line, line).not.toContain(bad);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 四、存档往返                                                        */
/* ------------------------------------------------------------------ */

function memStore(): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
    dump: () => Object.fromEntries(map),
  };
}

describe("档C R2 · memory-cards · 存档往返", () => {
  const ID = "memory-cards";

  it("真打完一关,算出的星写进去再读出来还是同一个", () => {
    const st = memStore();
    const i = SAMPLE[0];
    const cfg = LEVELS[i];
    const t = playAll(cfg, deckSeed(i));
    expect(t.matched).toBe(cfg.pairs);
    const stars = starsForMisses(cfg.maxMiss, t.misses);
    saveStar(ID, i, stars, st);
    const reopened = memStore();
    for (const [k, v] of Object.entries(st.dump())) reopened.setItem(k, v);
    expect(loadStars(ID, reopened)[i]).toBe(stars);
  });

  it("同一关反复打只留最好那一次", () => {
    const st = memStore();
    saveStar(ID, 81, 2, st);
    saveStar(ID, 81, 3, st);
    saveStar(ID, 81, 1, st);
    expect(loadStars(ID, st)[81]).toBe(3);
  });

  it("188 关全写满,读回来一关不差", () => {
    const st = memStore();
    const rand = mulberry32(818);
    const want = Array.from({ length: TOTAL_LEVELS }, () => (1 + Math.floor(rand() * 3)) as 1 | 2 | 3);
    want.forEach((s, i) => saveStar(ID, i, s, st));
    expect(loadStars(ID, st)).toEqual(want);
  });

  it("存档被写坏也只是从头再来", () => {
    const st = memStore();
    const key = `yiduo-yixing.l99.${ID}`;
    for (const junk of ["", "{{", "0", '{"stars":[1,2,"x",4,-1]}', "[]"]) {
      st.setItem(key, junk);
      const back = loadStars(ID, st);
      expect(back).toHaveLength(TOTAL_LEVELS);
      expect(back.every((v) => Number.isInteger(v) && v >= 0 && v <= 3), junk).toBe(true);
    }
  });

  it("存档 key 一个字都没改", () => {
    const st = memStore();
    saveStar(ID, 0, 1, st);
    expect(st.keys!()).toEqual([`yiduo-yixing.l99.${ID}`]);
  });

  it("同一关同一个种子发出来的牌永远一样 —— 存档能对得上", () => {
    for (const i of SAMPLE) {
      const a = buildDeck(LEVELS[i], deckSeed(i));
      const b = buildDeck(LEVELS[i], deckSeed(i));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});
