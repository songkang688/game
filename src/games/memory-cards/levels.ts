/**
 * 记忆翻翻乐 · 188 关关卡表。
 * 前 99 关是 1.0 的六个主题，生成参数一个字都没动；
 * 1.1 在末尾追加四个新主题（第 100–188 关）：
 *  ⑦算式配对屋=一张算式配一张得数  ⑧旋转木马厅=牌阵会整体转一格
 *  ⑨幻影干扰卡=混进没有同伴的独苗卡  ⑩星海终极厅=新老机关全混
 * 1.0 的六个主题章节、六种玩法机关（并非同一模板）：
 *  ①动物乐园=经典配对  ②水果集市=开局偷看+失误更紧
 *  ③海底世界=调皮章鱼换牌位  ④太空基地=三张一样才配对
 *  ⑤玩具小屋=倒计时挑战  ⑥魔法城堡=机关混合终极挑战
 */
import { mulberry32, shuffled, type Chapter } from "../level99";

/** 1.0 的六个主题：合计 99 关，1.1 起不再改动 */
export const LEGACY_CHAPTER_SIZES = [17, 17, 17, 16, 16, 16];
/** 1.0 的总关数（新主题从这里开始往后排） */
export const LEGACY_LEVELS = 99;

export interface MemoryLevel {
  /** 需要配成的组数 */
  pairs: number;
  cols: number;
  /** 允许翻错次数（超过就重试本关） */
  maxMiss: number;
  /** 每翻错 imp 次，交换两张扣着的牌；0 = 无 */
  imp: number;
  /** 开局偷看毫秒数；0 = 不偷看 */
  peekMs: number;
  /** 一组几张（2 = 对对碰，3 = 三连卡） */
  matchSize: 2 | 3;
  /** 倒计时秒数；0 = 不限时 */
  timeLimit: number;
  /** 用第几套主题表情 */
  theme: number;
  /** 1.1 配对方式改成「算式 = 得数」，前 99 关不带 */
  mathPairs?: boolean;
  /** 1.1 算式难度档（0 加减、1 乘除口诀、2 两位数），前 99 关不带 */
  mathHard?: number;
  /** 1.1 每翻几张牌，整个牌阵就整体转一格；0 / 不写 = 不转，前 99 关不带 */
  rotateEvery?: number;
  /** 1.1 混进几张没有同伴的干扰卡，前 99 关不带 */
  decoys?: number;
}

export const CHAPTERS: Chapter[] = [
  { name: "动物乐园", emoji: "🐱", color: "#FFE9D6", desc: "翻开卡片，找到两只一样的小动物！", size: 17 },
  { name: "水果集市", emoji: "🍎", color: "#FFE3E3", desc: "开局偷看一眼，记住水果的位置！", size: 17 },
  { name: "海底世界", emoji: "🐠", color: "#D6F0FF", desc: "调皮章鱼会偷偷交换扣着的牌！", size: 17 },
  { name: "太空基地", emoji: "🚀", color: "#E6E0FF", desc: "三张一样的卡才能配成一组！", size: 16 },
  { name: "玩具小屋", emoji: "🧸", color: "#FFF3C4", desc: "倒计时开始，比比谁记得又快又准！", size: 16 },
  { name: "魔法城堡", emoji: "🏰", color: "#F3D9FF", desc: "偷看、章鱼、限时一起来，终极记忆挑战！", size: 16 },
  // ↓ 1.1 追加：四个新主题，合计 89 关
  { name: "算式配对屋", emoji: "🧮", color: "#E4F0FF", desc: "这里配对的是算式和它的得数，先算再翻！", size: 23 },
  { name: "旋转木马厅", emoji: "🎠", color: "#FFE7F2", desc: "每翻几张，整个牌阵就整体转一格，位置全变啦。", size: 22 },
  { name: "幻影干扰卡", emoji: "🌫️", color: "#EDE8F7", desc: "牌里混进了没有同伴的独苗卡，认出它别再碰。", size: 22 },
  { name: "星海终极厅", emoji: "🌌", color: "#DDE4F5", desc: "算式、旋转、独苗卡轮番上阵，终极记忆挑战！", size: 22 }
];

export const THEME_EMOJIS: string[][] = [
  ["🐱", "🐶", "🦊", "🐰", "🐼", "🦄", "🐸", "🐥", "🐷", "🐨", "🦁", "🐭"],
  ["🍎", "🍌", "🍇", "🍓", "🍑", "🍍", "🥝", "🍉", "🍒", "🍋", "🥕", "🌽"],
  ["🐠", "🐙", "🦀", "🐬", "🐳", "🦞", "🐚", "🐡", "🦈", "🐢", "🦐", "🪼"],
  ["🚀", "🛸", "👽", "🌟", "🪐", "🌙", "☄️", "🛰️", "🌍", "👨‍🚀", "🌈", "⚡"],
  ["🧸", "🪀", "🎈", "🎁", "🪁", "🎠", "🥁", "🎺", "🦖", "🎲", "🚂", "🪆"],
  ["🧙", "🔮", "✨", "🦄", "🐉", "🏰", "🪄", "⭐", "🗝️", "👑", "🎩", "🧚"],
  // ↓ 1.1 四套新表情（各 16 个，够铺「组 + 干扰卡」）
  ["🧮", "📐", "📏", "🔢", "💯", "🧾", "📊", "🗒️", "🖇️", "🧷", "🪙", "🎯", "🔟", "⏱️", "🧩", "📌"],
  ["🎠", "🎡", "🎢", "🎪", "🎈", "🍦", "🍭", "🎫", "🥁", "🪗", "🎺", "🎷", "🪘", "🎨", "🧁", "🍿"],
  ["🌫️", "💠", "🫧", "🪞", "🔮", "🕯️", "👻", "🪄", "🧿", "🕸️", "🦇", "🌙", "⭐", "☁️", "❄️", "🌊"],
  ["🌌", "🪐", "🚀", "🛸", "☄️", "💫", "🌠", "🔭", "👾", "🌑", "🌗", "🛰️", "⚛️", "🧊", "🌟", "🌈"]
];

function buildLevel(ci: number, t: number): MemoryLevel {
  switch (ci) {
    case 0: {
      // 动物乐园：3 → 10 对，失误宽松
      const pairs = 3 + Math.floor(t / 2.5);
      return {
        pairs, cols: pairs <= 4 ? 3 : 4,
        maxMiss: pairs * 2 + 2, imp: 0, peekMs: 0, matchSize: 2, timeLimit: 0, theme: 0
      };
    }
    case 1: {
      // 水果集市：偷看时间越来越短，失误预算更紧
      const pairs = 4 + Math.floor(t / 2.5);
      return {
        pairs, cols: 4,
        maxMiss: pairs + 3, imp: 0,
        peekMs: Math.max(1200, 3200 - t * 130),
        matchSize: 2, timeLimit: 0, theme: 1
      };
    }
    case 2: {
      // 海底世界：章鱼越来越勤快
      const pairs = 5 + Math.floor(t / 3);
      return {
        pairs, cols: 4,
        maxMiss: pairs * 2, imp: Math.max(2, 4 - Math.floor(t / 6)),
        peekMs: 0, matchSize: 2, timeLimit: 0, theme: 2
      };
    }
    case 3: {
      // 太空基地：三连卡，组数少但更烧脑
      const pairs = 3 + Math.floor(t / 4);
      return {
        pairs, cols: pairs <= 4 ? 3 : 4,
        maxMiss: pairs * 3 + 4, imp: 0, peekMs: 0, matchSize: 3, timeLimit: 0, theme: 3
      };
    }
    case 4: {
      // 玩具小屋：限时挑战
      const pairs = 5 + Math.floor(t / 3);
      return {
        pairs, cols: 4,
        maxMiss: pairs * 2 + 2, imp: 0, peekMs: 0, matchSize: 2,
        timeLimit: 30 + pairs * 6 - t, theme: 4
      };
    }
    case 5: {
      // 魔法城堡：偷看 + 章鱼 + 限时轮流混合
      const pairs = 6 + Math.floor(t / 3);
      const mode = t % 3;
      return {
        pairs, cols: pairs >= 9 ? 5 : 4,
        maxMiss: pairs + 4,
        imp: mode === 1 ? 3 : 0,
        peekMs: mode === 0 ? 1600 : 0,
        matchSize: 2,
        timeLimit: mode === 2 ? 26 + pairs * 5 : 0,
        theme: 5
      };
    }
    case 6: {
      // 算式配对屋：一张写算式、一张写得数，算完再配对
      const pairs = 4 + Math.floor(t / 3);
      return {
        pairs, cols: pairs >= 9 ? 5 : 4,
        maxMiss: pairs + 6, imp: 0,
        peekMs: t < 6 ? 2200 : 0,
        matchSize: 2, timeLimit: 0, theme: 6,
        mathPairs: true,
        mathHard: t < 8 ? 0 : t < 16 ? 1 : 2
      };
    }
    case 7: {
      // 旋转木马厅：牌阵每隔几张翻牌就整体转一格
      const pairs = 5 + Math.floor(t / 3);
      return {
        pairs, cols: pairs >= 10 ? 5 : 4,
        maxMiss: pairs * 2 + 2, imp: 0,
        peekMs: t < 5 ? 1800 : 0,
        matchSize: 2, timeLimit: 0, theme: 7,
        rotateEvery: Math.max(4, 7 - Math.floor(t / 7))
      };
    }
    case 8: {
      // 幻影干扰卡：独苗卡越来越多
      const pairs = 5 + Math.floor(t / 3);
      const decoys = 1 + Math.floor(t / 7);
      return {
        pairs, cols: pairs >= 10 ? 5 : 4,
        maxMiss: pairs + decoys + 6, imp: 0, peekMs: 0,
        matchSize: 2, timeLimit: 0, theme: 8,
        decoys
      };
    }
    default: {
      // 星海终极厅：三连 / 算式 / 独苗+旋转 三种收尾轮着来
      const mode = t % 3;
      if (mode === 0) {
        const pairs = 4 + Math.floor(t / 6);
        return {
          pairs, cols: 4,
          maxMiss: pairs * 3 + 6, imp: 0, peekMs: 0,
          matchSize: 3, timeLimit: 0, theme: 9,
          rotateEvery: 8
        };
      }
      if (mode === 1) {
        const pairs = 6 + Math.floor(t / 5);
        return {
          pairs, cols: pairs >= 10 ? 5 : 4,
          maxMiss: pairs + 8, imp: 0, peekMs: 0,
          matchSize: 2, timeLimit: 0, theme: 9,
          mathPairs: true,
          mathHard: 2,
          decoys: 1 + Math.floor(t / 12)
        };
      }
      const pairs = 6 + Math.floor(t / 5);
      const decoys = 2 + Math.floor(t / 9);
      return {
        pairs, cols: pairs >= 10 ? 5 : 4,
        maxMiss: pairs + decoys + 8, imp: t >= 14 ? 4 : 0, peekMs: 1400,
        matchSize: 2, timeLimit: 0, theme: 9,
        rotateEvery: 6,
        decoys
      };
    }
  }
}

export const LEVELS: MemoryLevel[] = (() => {
  const out: MemoryLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t));
  });
  return out;
})();

// ---------------------------------------------------------------------------
// 1.1 机制一：配对是「算式 = 得数」
// ---------------------------------------------------------------------------

export interface MathPair {
  expr: string;
  value: number;
}

/** 口算求值：只认「a 运算符 b」，看不懂就返回 NaN */
export function evalExpr(expr: string): number {
  const m = /^(\d+)([+\-×÷])(\d+)$/.exec(expr);
  if (!m) return NaN;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    default: return b === 0 ? NaN : a / b;
  }
}

/**
 * 生成 count 组「算式 + 得数」，得数两两不同——
 * 不然一张得数卡会同时配得上两张算式卡，孩子就没法判断对错了。
 * hard：0 = 二十以内加减，1 = 乘法口诀与整除，2 = 两位数加减乘除。
 */
export function buildMathPairs(seed: number, count: number, hard: number): MathPair[] {
  const rand = mulberry32(seed);
  const level = Math.max(0, Math.min(2, Math.floor(hard)));
  const out: MathPair[] = [];
  const used = new Set<number>();
  const ri = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
  let guard = 0;
  while (out.length < Math.max(0, Math.floor(count)) && guard < 4000) {
    guard++;
    let expr = "";
    let value = 0;
    const op = level === 0 ? (rand() < 0.55 ? "+" : "-") : ["+", "-", "×", "÷"][Math.floor(rand() * 4)];
    if (op === "+") {
      const a = level === 0 ? ri(2, 9) : level === 1 ? ri(6, 29) : ri(15, 79);
      const b = level === 0 ? ri(2, 9) : level === 1 ? ri(6, 29) : ri(15, 79);
      expr = `${a}+${b}`;
      value = a + b;
    } else if (op === "-") {
      const b = level === 0 ? ri(2, 9) : level === 1 ? ri(4, 19) : ri(12, 49);
      const v = level === 0 ? ri(2, 11) : level === 1 ? ri(3, 40) : ri(10, 90);
      expr = `${v + b}-${b}`;
      value = v;
    } else if (op === "×") {
      const a = level === 1 ? ri(2, 9) : ri(3, 12);
      const b = level === 1 ? ri(2, 9) : ri(3, 12);
      expr = `${a}×${b}`;
      value = a * b;
    } else {
      const b = level === 1 ? ri(2, 9) : ri(3, 12);
      const v = level === 1 ? ri(2, 9) : ri(3, 12);
      expr = `${v * b}÷${b}`;
      value = v;
    }
    if (used.has(value)) continue;
    used.add(value);
    out.push({ expr, value });
  }
  // 极端情况下补几组最简单的，保证张数一定够（宁可简单也不能少牌）
  let fill = 1;
  while (out.length < Math.max(0, Math.floor(count))) {
    while (used.has(fill)) fill++;
    used.add(fill);
    out.push({ expr: `${fill}+0`, value: fill });
    fill++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1.1 机制二：牌阵整体旋转
// ---------------------------------------------------------------------------

/**
 * 把还在场上的牌整体挪一格（已经配掉的空位不参与）。
 * order[slot] = 牌号；返回新的 order，牌一张不多一张不少。
 */
export function rotatePositions(order: number[], gone: boolean[], step = 1): number[] {
  const slots: number[] = [];
  order.forEach((card, slot) => {
    if (card >= 0 && !gone[card]) slots.push(slot);
  });
  if (slots.length < 2) return order.slice();
  const next = order.slice();
  const cards = slots.map((slot) => order[slot]);
  const n = cards.length;
  const s = ((Math.round(step) % n) + n) % n;
  slots.forEach((slot, k) => {
    next[slot] = cards[(k - s + n * 2) % n];
  });
  return next;
}

// ---------------------------------------------------------------------------
// 1.1 机制三：干扰卡（没有同伴的独苗）
// ---------------------------------------------------------------------------

export interface MemoryCard {
  /** 同一组的牌 group 相同；干扰卡的 group 独一无二 */
  group: number;
  /** 牌面（表情、算式或得数） */
  face: string;
  /** 没有同伴的独苗卡 */
  decoy: boolean;
}

/** 一关要发多少张牌 */
export function deckSize(cfg: MemoryLevel): number {
  return cfg.pairs * cfg.matchSize + (cfg.decoys ?? 0);
}

/** 发一副牌：算式关一张算式配一张得数，普通关同一个表情配 matchSize 张 */
export function buildDeck(cfg: MemoryLevel, seed: number): MemoryCard[] {
  const pool = THEME_EMOJIS[cfg.theme] ?? THEME_EMOJIS[0];
  const cards: MemoryCard[] = [];
  if (cfg.mathPairs) {
    const pairs = buildMathPairs(seed, cfg.pairs + (cfg.decoys ?? 0), cfg.mathHard ?? 0);
    pairs.slice(0, cfg.pairs).forEach((p, gi) => {
      cards.push({ group: gi, face: p.expr, decoy: false });
      cards.push({ group: gi, face: String(p.value), decoy: false });
    });
    // 干扰卡：得数对不上任何一道算式的孤零零一张
    pairs.slice(cfg.pairs).forEach((p, k) => {
      cards.push({ group: 1000 + k, face: String(p.value), decoy: true });
    });
  } else {
    for (let gi = 0; gi < cfg.pairs; gi++) {
      for (let k = 0; k < cfg.matchSize; k++) {
        cards.push({ group: gi, face: pool[gi % pool.length], decoy: false });
      }
    }
    for (let k = 0; k < (cfg.decoys ?? 0); k++) {
      cards.push({ group: 1000 + k, face: pool[(cfg.pairs + k) % pool.length], decoy: true });
    }
  }
  return shuffled(cards, mulberry32(seed * 31 + 17));
}

// ---------------------------------------------------------------------------
// 可解性：一个记性完美的孩子要翻多少次、错多少次
// ---------------------------------------------------------------------------

export interface PlayEstimate {
  /** 翻牌总次数 */
  flips: number;
  /** 配错的次数 */
  misses: number;
}

/**
 * 记性完美的玩法：见过的牌都记得住，
 * 先把已经认出来的一组收掉，认不出来才去翻生牌（翻岔了才算一次失误）。
 * 返回这一关最少需要几次失误——maxMiss 必须比它宽裕，这一关才算过得去。
 */
export function simulatePerfectPlay(cfg: MemoryLevel, seed: number): PlayEstimate {
  const deck = buildDeck(cfg, seed);
  const need = cfg.matchSize;
  const gone = new Array<boolean>(deck.length).fill(false);
  /** 已经翻开看过的牌（下标） */
  const known = new Set<number>();
  let flips = 0;
  let misses = 0;
  let matched = 0;

  const knownGroup = (group: number): number[] =>
    Array.from(known).filter((i) => !gone[i] && deck[i].group === group);

  const collect = (idxs: number[]): void => {
    for (const i of idxs) {
      gone[i] = true;
      known.delete(i);
    }
    matched++;
  };

  let guard = 0;
  while (matched < cfg.pairs && guard++ < 5000) {
    // ① 手上已经有凑齐的一组，直接收掉，一次都不会错
    let done = false;
    for (const i of Array.from(known)) {
      if (gone[i] || deck[i].decoy) continue;
      const same = knownGroup(deck[i].group);
      if (same.length >= need) {
        flips += need;
        collect(same.slice(0, need));
        done = true;
        break;
      }
    }
    if (done) continue;

    // ② 没有现成的，就去翻一张生牌
    const fresh = deck
      .map((_, i) => i)
      .filter((i) => !gone[i] && !known.has(i));
    if (fresh.length === 0) break;
    const first = fresh[0];
    known.add(first);
    flips++;
    // 翻出来的牌正好补齐一组，就顺手收掉
    const same = knownGroup(deck[first].group);
    if (!deck[first].decoy && same.length >= need) {
      flips += need - 1;
      collect(same.slice(0, need));
      continue;
    }
    // 补不齐：再翻一张生牌碰运气，碰不上就记一次失误
    const more = fresh.filter((i) => i !== first);
    if (more.length === 0) break;
    const second = more[0];
    known.add(second);
    flips++;
    const pair = knownGroup(deck[second].group);
    if (!deck[second].decoy && pair.length >= need) {
      flips += need - 1;
      collect(pair.slice(0, need));
    } else {
      misses++;
    }
  }
  return { flips, misses };
}

/** 按翻牌次数估一局要多久（一次翻牌 1.2 秒，配错还要等牌翻回去） */
export function estimateSeconds(est: PlayEstimate): number {
  return est.flips * 1.2 + est.misses * 0.9;
}

/** 本关发牌的随机种子：同一关每次进入的牌面一致 */
export function deckSeed(level: number): number {
  return level * 6151 + 409;
}
