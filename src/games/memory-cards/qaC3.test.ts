// 档C · 第 3 轮测试员 · memory-cards:188 关一关不漏地发一遍牌。
//
// 前两轮走的是抽样(第 1/100/188、再换一批 10 关),第 3 轮全部改成**全量**:
// 每一关都真发一副牌、真用「记性完美的孩子」跑一遍、真按 360px 排一次牌盘,
// 再把四种模式(战役 / 无尽 / 双人 / 记忆辅助)各自的入口和收场话过一遍。
import { describe, expect, it } from "vitest";
import {
  TOTAL_LEVELS,
  chapterOf,
  loadStars,
  mulberry32,
  saveStar,
  type StorageLike,
} from "../level99";
import { MIN_ICONS_PER_PACK, THEME_PACKS, packForTheme } from "./art";
import { meta } from "./meta";
import { CHAPTERS, LEGACY_LEVELS, LEVELS, THEME_EMOJIS, type MemoryLevel } from "./levels";
import {
  BACK_PATTERNS,
  CARD_MIN_W,
  ENDLESS_MAX_MISS,
  ENDLESS_MAX_PAIRS,
  SEAT_NAMES,
  assistChangesStars,
  assistLabel,
  assistTip,
  backPattern,
  buildDeck,
  cardWidthAt,
  coverDelayMs,
  deckSeed,
  deckSize,
  endlessLevel,
  endlessLine,
  estimateSeconds,
  evalExpr,
  groupMatches,
  hitDecoy,
  iconIndexOf,
  lostLine,
  nextTurn,
  simulatePerfectPlay,
  starsForMisses,
  versusLine,
  versusWinner,
  wonLine,
} from "./logic";

/** 牌盘几行:和 index.ts 里那一行算法保持一致 */
function rowsOf(cfg: MemoryLevel): number {
  return Math.ceil(deckSize(cfg) / Math.max(1, cfg.cols));
}

/* ------------------------------------------------------------------ */
/* 一、188 关全量                                                       */
/* ------------------------------------------------------------------ */

describe("档C R3 · memory-cards · 188 关一关不漏", () => {
  it("关数、章节切分都对得上", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
    expect(LEGACY_LEVELS).toBe(99);
    LEVELS.forEach((_l, i) => {
      const ci = chapterOf(CHAPTERS, i);
      expect(ci, `第 ${i + 1} 关落在了章节外`).toBeGreaterThanOrEqual(0);
      expect(ci).toBeLessThan(CHAPTERS.length);
    });
  });

  it("每一关的参数都在册:组数、列数、一组几张、失误额度、主题号", () => {
    LEVELS.forEach((cfg, i) => {
      expect(cfg.pairs, `第 ${i + 1} 关一组牌都没有`).toBeGreaterThan(0);
      expect(cfg.cols, `第 ${i + 1} 关的列数不对`).toBeGreaterThanOrEqual(3);
      expect(cfg.cols, `第 ${i + 1} 关的列数太多,窄屏摆不下`).toBeLessThanOrEqual(5);
      expect([2, 3], `第 ${i + 1} 关一组要几张?`).toContain(cfg.matchSize);
      expect(cfg.maxMiss, `第 ${i + 1} 关没给失误额度`).toBeGreaterThan(0);
      expect(cfg.peekMs, `第 ${i + 1} 关的偷看时间是负的`).toBeGreaterThanOrEqual(0);
      expect(cfg.timeLimit, `第 ${i + 1} 关的倒计时是负的`).toBeGreaterThanOrEqual(0);
      expect(cfg.theme, `第 ${i + 1} 关的主题号越界`).toBeGreaterThanOrEqual(0);
      expect(cfg.theme).toBeLessThan(THEME_EMOJIS.length);
      expect(deckSize(cfg), `第 ${i + 1} 关的牌多到摆不下`).toBeLessThanOrEqual(30);
    });
  });

  it("每一关真发一副牌:张数对、每组齐、独苗卡确实没同伴", () => {
    LEVELS.forEach((cfg, i) => {
      const deck = buildDeck(cfg, deckSeed(i));
      expect(deck, `第 ${i + 1} 关的牌数不对`).toHaveLength(deckSize(cfg));
      const byGroup = new Map<number, number>();
      deck.forEach((c) => byGroup.set(c.group, (byGroup.get(c.group) ?? 0) + 1));
      let real = 0;
      let decoy = 0;
      deck.forEach((c) => (c.decoy ? decoy++ : real++));
      expect(real, `第 ${i + 1} 关的正牌张数不对`).toBe(cfg.pairs * cfg.matchSize);
      expect(decoy, `第 ${i + 1} 关的独苗卡张数不对`).toBe(cfg.decoys ?? 0);
      deck.forEach((c, k) => {
        expect(c.face.length, `第 ${i + 1} 关第 ${k} 张牌没有牌面`).toBeGreaterThan(0);
        const n = byGroup.get(c.group) ?? 0;
        if (c.decoy) expect(n, `第 ${i + 1} 关的独苗卡居然有同伴`).toBe(1);
        else expect(n, `第 ${i + 1} 关有一组只发了 ${n} 张`).toBe(cfg.matchSize);
      });
    });
  });

  it("算式关:每张算式都算得出来,得数两两不同 —— 不会一张得数配得上两道题", () => {
    const mathLevels = LEVELS.map((cfg, i) => ({ cfg, i })).filter(({ cfg }) => cfg.mathPairs);
    expect(mathLevels.length, "一关算式关都没有?").toBeGreaterThan(20);
    for (const { cfg, i } of mathLevels) {
      const deck = buildDeck(cfg, deckSeed(i));
      const values = new Set<string>();
      const exprs = deck.filter((c) => /[+\-×÷]/.test(c.face));
      expect(exprs, `第 ${i + 1} 关的算式张数不对`).toHaveLength(cfg.pairs);
      for (const c of deck) {
        if (/[+\-×÷]/.test(c.face)) {
          const v = evalExpr(c.face);
          expect(Number.isFinite(v), `第 ${i + 1} 关的「${c.face}」算不出来`).toBe(true);
          expect(v, `第 ${i + 1} 关的「${c.face}」得数是负的`).toBeGreaterThanOrEqual(0);
        } else {
          expect(values.has(c.face), `第 ${i + 1} 关有两张一样的得数「${c.face}」`).toBe(false);
          values.add(c.face);
        }
      }
    }
  });

  it("每一关记性完美的孩子都过得去:最少失误次数一定小于额度", () => {
    LEVELS.forEach((cfg, i) => {
      const est = simulatePerfectPlay(cfg, deckSeed(i));
      expect(est.flips, `第 ${i + 1} 关一张牌都不用翻?`).toBeGreaterThan(0);
      expect(
        cfg.maxMiss,
        `第 ${i + 1} 关最少要错 ${est.misses} 次,却只给 ${cfg.maxMiss} 次`
      ).toBeGreaterThan(est.misses);
    });
  });

  it("限时关的时间够用:记性完美的孩子打完还剩三成时间", () => {
    const timed = LEVELS.map((cfg, i) => ({ cfg, i })).filter(({ cfg }) => cfg.timeLimit > 0);
    expect(timed.length, "一关限时关都没有?").toBeGreaterThan(10);
    for (const { cfg, i } of timed) {
      const need = estimateSeconds(simulatePerfectPlay(cfg, deckSeed(i)));
      expect(cfg.timeLimit, `第 ${i + 1} 关给 ${cfg.timeLimit} 秒,打完要 ${need.toFixed(1)} 秒`)
        .toBeGreaterThan(need * 1.3);
    }
  });

  it("每一关都摆得进 360px:每张牌都不窄于 56px", () => {
    LEVELS.forEach((cfg, i) => {
      const w = cardWidthAt(360, cfg.cols, rowsOf(cfg));
      expect(w, `第 ${i + 1} 关在 360px 上每张牌只剩 ${w}px`).toBeGreaterThanOrEqual(CARD_MIN_W);
    });
    // 更窄的 320px 老机器也别糊成一条缝
    LEVELS.forEach((cfg, i) => {
      expect(cardWidthAt(320, cfg.cols, rowsOf(cfg)), `第 ${i + 1} 关 320px`).toBeGreaterThan(40);
    });
  });

  it("机关声明和参数对得上:章鱼、偷看、限时、算式、旋转、独苗、挪窝都名副其实", () => {
    LEVELS.forEach((cfg, i) => {
      const ci = chapterOf(CHAPTERS, i);
      if (cfg.imp > 0) expect(cfg.imp, `第 ${i + 1} 关的章鱼太勤快`).toBeGreaterThanOrEqual(2);
      if ((cfg.rotateEvery ?? 0) > 0)
        expect(cfg.rotateEvery, `第 ${i + 1} 关转得太勤,翻不完一组`).toBeGreaterThanOrEqual(4);
      if ((cfg.swapEvery ?? 0) > 0)
        expect(cfg.swapEvery, `第 ${i + 1} 关挪得太勤`).toBeGreaterThanOrEqual(8000);
      if ((cfg.decoys ?? 0) > 0)
        expect(cfg.decoys, `第 ${i + 1} 关的独苗卡比正牌还多`).toBeLessThan(cfg.pairs);
      if (cfg.mathPairs) {
        expect(cfg.matchSize, `第 ${i + 1} 关算式关只能两张一组`).toBe(2);
        expect([0, 1, 2], `第 ${i + 1} 关的算式难度档`).toContain(cfg.mathHard ?? 0);
      }
      // 1.0 的六章不许长出 1.1/1.2 的新机关(老档进来还是原来那关)
      if (ci < 6) {
        expect(cfg.mathPairs, `第 ${i + 1} 关是老关,不该有算式`).toBeUndefined();
        expect(cfg.rotateEvery, `第 ${i + 1} 关是老关,不该会转`).toBeUndefined();
        expect(cfg.decoys, `第 ${i + 1} 关是老关,不该有独苗卡`).toBeUndefined();
        expect(cfg.swapEvery, `第 ${i + 1} 关是老关,不该会挪窝`).toBeUndefined();
      }
    });
  });

  it("每一关都画得出原创图案:图案号不越界,卡背花纹也不泄底", () => {
    LEVELS.forEach((cfg, i) => {
      const pack = packForTheme(cfg.theme);
      expect(pack.icons.length, `第 ${i + 1} 关的图案不够用`).toBeGreaterThanOrEqual(
        MIN_ICONS_PER_PACK
      );
      const deck = buildDeck(cfg, deckSeed(i));
      const perGroup = new Map<number, Set<number>>();
      deck.forEach((c) => {
        const idx = iconIndexOf(cfg, c, pack.icons.length);
        expect(idx, `第 ${i + 1} 关的图案号越界`).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(pack.icons.length);
        perGroup.set(c.group, (perGroup.get(c.group) ?? new Set()).add(idx));
      });
      // 同一组的牌必须画同一个图案,不然孩子配对了也看不出来
      for (const [g, set] of perGroup) expect(set.size, `第 ${i + 1} 关第 ${g} 组图案不一致`).toBe(1);
      // 卡背只看槽位:同一槽位永远同一种花纹,而且只有 4 种
      for (let slot = 0; slot < deck.length; slot++) {
        const p = backPattern(slot, cfg.theme);
        expect(p).toBe(backPattern(slot, cfg.theme));
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(BACK_PATTERNS);
      }
    });
  });

  it("十章的名字和介绍都干净:没有洋文、没有丧气话、没有商标", () => {
    const harsh = ["你输了", "笨", "蠢", "血", "死亡", "干掉", "杀"];
    const brands = ["愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "超级玛丽", "马里奥", "俄罗斯方块", "吃豆人", "皮卡丘", "奥特曼", "我的世界"];
    const names = new Set<string>();
    for (const ch of CHAPTERS) {
      expect(ch.name, `章节名「${ch.name}」有洋文`).not.toMatch(/[A-Za-z]/);
      expect(ch.desc.length, `章节「${ch.name}」没写介绍`).toBeGreaterThan(8);
      for (const w of [...harsh, ...brands]) {
        expect(ch.name.includes(w), `章节名里有「${w}」`).toBe(false);
        expect(ch.desc.includes(w), `章节介绍里有「${w}」`).toBe(false);
      }
      expect(ch.color, `章节「${ch.name}」的配色不对`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      names.add(ch.name);
    }
    expect(names.size).toBe(CHAPTERS.length);
    expect(meta.blurb).not.toContain("死");
    for (const w of brands) expect(meta.blurb.includes(w)).toBe(false);
  });

  it("每一关的评星门槛都够得着:一次不错就是三星,错满额度还有一星", () => {
    LEVELS.forEach((cfg, i) => {
      expect(starsForMisses(cfg.maxMiss, 0), `第 ${i + 1} 关`).toBe(3);
      expect(starsForMisses(cfg.maxMiss, cfg.maxMiss), `第 ${i + 1} 关`).toBeGreaterThanOrEqual(1);
      let prev = 3;
      for (let m = 0; m <= cfg.maxMiss; m++) {
        const s = starsForMisses(cfg.maxMiss, m);
        expect(s, `第 ${i + 1} 关错 ${m} 次反而星更多`).toBeLessThanOrEqual(prev);
        prev = s;
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/* 二、四种模式一个不漏                                                 */
/* ------------------------------------------------------------------ */

describe("档C R3 · memory-cards · 四种模式一个不漏", () => {
  it("meta 声明的四种模式都有真实入口", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless", "twoPlayer", "versus"]);
    expect(meta.levels).toBe(TOTAL_LEVELS);
    // 战役
    expect(LEVELS[0].pairs).toBeGreaterThan(0);
    // 无尽
    expect(endlessLevel(1, THEME_PACKS.length).pairs).toBeGreaterThan(0);
    // 双人
    expect(SEAT_NAMES).toEqual(["朵朵", "星星"]);
    // 记忆辅助
    expect(assistLabel(true)).not.toBe(assistLabel(false));
  });

  it("战役收场:赢了夸、输了也只鼓励", () => {
    for (const m of [0, 1, 7, 30]) {
      const line = wonLine(m);
      expect(line).toContain(String(m));
      for (const w of ["输", "笨", "菜", "失败"]) expect(line, line).not.toContain(w);
    }
    expect(wonLine(2, true)).toContain("记忆辅助");
    for (const t of [true, false]) {
      const line = lostLine(t);
      expect(line.length).toBeGreaterThan(10);
      for (const w of ["输", "笨", "菜", "失败", "死"]) expect(line, line).not.toContain(w);
    }
  });

  it("无尽:打到第 300 轮牌还发得出来、机关不越下限、收场只鼓励", () => {
    for (let r = 1; r <= 300; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      expect(cfg.pairs).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS);
      expect(buildDeck(cfg, 9000 + r), `第 ${r} 轮牌数不对`).toHaveLength(deckSize(cfg));
      expect(cardWidthAt(360, cfg.cols, rowsOf(cfg)), `第 ${r} 轮 360px 摆不下`)
        .toBeGreaterThanOrEqual(CARD_MIN_W);
      expect(cfg.maxMiss).toBeGreaterThan(ENDLESS_MAX_MISS);
    }
    expect(endlessLine(0, 0)).toContain("先把前两张记牢");
    expect(endlessLine(88, 3)).toContain("新纪录");
  });

  it("双人轮流翻:配到接着翻、没配到换人,平手也有话说", () => {
    expect(nextTurn(0, true)).toBe(0);
    expect(nextTurn(0, false)).toBe(1);
    expect(nextTurn(1, false)).toBe(0);
    expect(nextTurn(1, true)).toBe(1);
    expect(versusWinner([3, 3])).toBeNull();
    expect(versusWinner([4, 1])).toBe(0);
    expect(versusWinner([1, 4])).toBe(1);
    for (const s of [[0, 0], [3, 3], [5, 2], [2, 5]] as Array<[number, number]>) {
      const line = versusLine(s);
      expect(line.length).toBeGreaterThan(10);
      for (const w of ["输", "笨", "菜", "失败"]) expect(line, line).not.toContain(w);
      expect(line.includes(SEAT_NAMES[0]) || line.includes("平手")).toBe(true);
    }
  });

  it("记忆辅助:只多亮一会儿,三星标准一个字没动", () => {
    expect(assistChangesStars()).toBe(false);
    expect(assistTip(true)).not.toBe(assistTip(false));
    for (const size of [2, 3] as const) {
      expect(coverDelayMs(size, true), `${size} 张一组`).toBeGreaterThan(coverDelayMs(size, false));
    }
    // 开着辅助照样评得到三星
    const cfg = LEVELS[120];
    expect(starsForMisses(cfg.maxMiss, 0)).toBe(3);
  });

  it("配对判定:独苗卡永远配不上,混进独苗的一组也认得出来", () => {
    const idx = LEVELS.findIndex((l) => (l.decoys ?? 0) > 0);
    expect(idx).toBeGreaterThan(0);
    const cfg = LEVELS[idx];
    const deck = buildDeck(cfg, deckSeed(idx));
    const decoy = deck.findIndex((c) => c.decoy);
    const real = deck.findIndex((c) => !c.decoy);
    expect(groupMatches(deck, [decoy, decoy])).toBe(false);
    expect(groupMatches(deck, [decoy, real])).toBe(false);
    expect(groupMatches(deck, [])).toBe(false);
    expect(hitDecoy(deck, [real, decoy])).toBe(decoy);
    expect(hitDecoy(deck, [real])).toBeNull();
    // 同一组的真牌配得上
    const g = deck[real].group;
    const same = deck.map((_c, k) => k).filter((k) => deck[k].group === g);
    expect(groupMatches(deck, same.slice(0, cfg.matchSize))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 三、存档往返                                                        */
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

describe("档C R3 · memory-cards · 存档往返", () => {
  const ID = "memory-cards";

  it("188 关全部真打一遍,星星存进去读出来一颗不差", () => {
    const st = memStore();
    const want: number[] = [];
    LEVELS.forEach((cfg, i) => {
      const est = simulatePerfectPlay(cfg, deckSeed(i));
      const stars = starsForMisses(cfg.maxMiss, est.misses);
      want.push(stars);
      saveStar(ID, i, stars, st);
    });
    const reopened = memStore();
    for (const [k, v] of Object.entries(st.dump())) reopened.setItem(k, v);
    expect(loadStars(ID, reopened)).toEqual(want);
  });

  it("1.0 的 99 位老档读进来照样是老成绩,后面 89 关从 0 开始", () => {
    const st = memStore();
    const old = Array.from({ length: LEGACY_LEVELS }, (_v, i) => ((i % 3) + 1) as 1 | 2 | 3);
    st.setItem(`yiduo-yixing.l99.${ID}`, JSON.stringify(old));
    const back = loadStars(ID, st);
    expect(back).toHaveLength(TOTAL_LEVELS);
    for (let i = 0; i < LEGACY_LEVELS; i++) expect(back[i], `老档第 ${i + 1} 关丢了`).toBe(old[i]);
    for (let i = LEGACY_LEVELS; i < TOTAL_LEVELS; i++) expect(back[i]).toBe(0);
  });

  it("存档 key 一个字都没改,而且只写这一个 key", () => {
    const st = memStore();
    const rand = mulberry32(3);
    for (let k = 0; k < 50; k++) saveStar(ID, Math.floor(rand() * TOTAL_LEVELS), 2, st);
    expect(st.keys!()).toEqual([`yiduo-yixing.l99.${ID}`]);
  });

  it("同一关每次进来牌面都一样 —— 存档对得上,不会「上次那关不见了」", () => {
    for (let i = 0; i < TOTAL_LEVELS; i += 7) {
      const a = buildDeck(LEVELS[i], deckSeed(i));
      const b = buildDeck(LEVELS[i], deckSeed(i));
      expect(JSON.stringify(a), `第 ${i + 1} 关两次发牌不一样`).toBe(JSON.stringify(b));
    }
    // 不同关的种子互不相同
    const seeds = new Set(LEVELS.map((_l, i) => deckSeed(i)));
    expect(seeds.size).toBe(TOTAL_LEVELS);
  });
});
