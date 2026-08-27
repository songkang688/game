/**
 * 花开麻将 · 牌的编码（纯数据 + 纯函数，没有任何 DOM）。
 *
 * 一副 144 张：万 / 筒 / 条 各 1–9 每种 4 张（108），风牌东南西北各 4 张（16），
 * 箭牌中发白各 4 张（12），花牌 8 张（8）。花牌只补不打，每张 1 分不计番。
 *
 * 牌用一个整数 id 表示：`花色序号 * 10 + 点数`，
 * 所以 m1=1 … m9=9，p1=11 … p9=19，s1=21 … s9=29，
 * 字牌 z1=31(东) z2=32(南) z3=33(西) z4=34(北) z5=35(中) z6=36(发) z7=37(白)，
 * 花牌 f1=41 … f8=48。直接按数字升序排就是「万→筒→条→字→花」的标准顺序。
 */

/** 花色：m=万 p=筒 s=条 z=字（风+箭） f=花 */
export type Suit = "m" | "p" | "s" | "z" | "f";

/** 花色排序权重，也是 tileId 的十位 */
export const SUIT_ORDER: Record<Suit, number> = { m: 0, p: 1, s: 2, z: 3, f: 4 };

/** 三种数牌花色（成顺子只在这三种里） */
export const NUMBER_SUITS: Suit[] = ["m", "p", "s"];

export interface Tile {
  suit: Suit;
  /** 数牌 1–9；字牌 1–7；花牌 1–8 */
  rank: number;
}

/** 牌 → 稳定可排序的整数 id */
export function tileId(t: Tile): number {
  return SUIT_ORDER[t.suit] * 10 + t.rank;
}

/** 整数 id → 牌 */
export function tileOf(id: number): Tile {
  const suit = (["m", "p", "s", "z", "f"] as Suit[])[Math.floor(id / 10)];
  return { suit, rank: id % 10 };
}

export function suitOf(id: number): Suit {
  return (["m", "p", "s", "z", "f"] as Suit[])[Math.floor(id / 10)];
}

export function rankOf(id: number): number {
  return id % 10;
}

/** 是不是数牌（万筒条） */
export function isNumber(id: number): boolean {
  return id >= 1 && id <= 29;
}

/** 是不是字牌（风 + 箭） */
export function isHonor(id: number): boolean {
  return id >= 31 && id <= 37;
}

/** 是不是风牌（东南西北） */
export function isWind(id: number): boolean {
  return id >= 31 && id <= 34;
}

/** 是不是箭牌（中发白） */
export function isDragon(id: number): boolean {
  return id >= 35 && id <= 37;
}

/** 是不是花牌 */
export function isFlower(id: number): boolean {
  return id >= 41 && id <= 48;
}

/** 幺九牌：数牌的 1 和 9，外加全部字牌 */
export function isTerminalOrHonor(id: number): boolean {
  if (isHonor(id)) return true;
  return isNumber(id) && (rankOf(id) === 1 || rankOf(id) === 9);
}

/** 老头牌：只有数牌的 1 和 9 */
export function isTerminal(id: number): boolean {
  return isNumber(id) && (rankOf(id) === 1 || rankOf(id) === 9);
}

/** 幺九十三张：十三幺用的那 13 种牌 */
export const THIRTEEN_ORPHANS: number[] = [1, 9, 11, 19, 21, 29, 31, 32, 33, 34, 35, 36, 37];

/** 东南西北的座位/圈风 id（1=东 2=南 3=西 4=北） */
export function windId(n: number): number {
  return 30 + ((n - 1 + 4) % 4) + 1;
}

const SUIT_CN: Record<Suit, string> = { m: "万", p: "筒", s: "条", z: "字", f: "花" };
const HONOR_CN = ["东", "南", "西", "北", "中", "发", "白"];
const FLOWER_CN = ["春", "夏", "秋", "冬", "梅", "兰", "竹", "菊"];

/** 牌面中文名，例如「三万」「东」「红中」 */
export function tileName(id: number): string {
  const s = suitOf(id);
  const r = rankOf(id);
  if (s === "z") return HONOR_CN[r - 1] ?? "?";
  if (s === "f") return FLOWER_CN[r - 1] ?? "?";
  return `${"零一二三四五六七八九"[r]}${SUIT_CN[s]}`;
}

/** 牌面上画的那两个字符：数牌是「数字 + 花色符」，字牌就一个字 */
export function tileFace(id: number): { top: string; bottom: string } {
  const s = suitOf(id);
  const r = rankOf(id);
  if (s === "z") return { top: HONOR_CN[r - 1] ?? "?", bottom: "" };
  if (s === "f") return { top: FLOWER_CN[r - 1] ?? "?", bottom: "花" };
  return { top: String(r), bottom: SUIT_CN[s] };
}

/** 一整副 144 张（未洗牌，顺序固定） */
export function fullDeck(): number[] {
  const out: number[] = [];
  for (const s of NUMBER_SUITS) {
    for (let r = 1; r <= 9; r++) {
      for (let k = 0; k < 4; k++) out.push(tileId({ suit: s, rank: r }));
    }
  }
  for (let r = 1; r <= 7; r++) {
    for (let k = 0; k < 4; k++) out.push(tileId({ suit: "z", rank: r }));
  }
  for (let r = 1; r <= 8; r++) out.push(tileId({ suit: "f", rank: r }));
  return out;
}

/** 一副牌总张数 */
export const DECK_SIZE = 144;

/** 某张牌在一副牌里最多几张（花牌只有 1 张） */
export function maxCopies(id: number): number {
  return isFlower(id) ? 1 : 4;
}

/**
 * 简写解析：`"m123p55z1"` → id 数组。测试和关卡表都用它写牌，比手敲数字好读。
 * 认不出的字符直接跳过，绝不抛异常。
 */
export function parseTiles(text: string): number[] {
  const out: number[] = [];
  let digits: number[] = [];
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      digits.push(Number(ch));
      continue;
    }
    if (ch === "m" || ch === "p" || ch === "s" || ch === "z" || ch === "f") {
      // 点数越界的写法（例如 `9z`）直接忽略，免得算出一个不存在的 id
      const top = ch === "z" ? 7 : ch === "f" ? 8 : 9;
      for (const d of digits) {
        if (d >= 1 && d <= top) out.push(tileId({ suit: ch, rank: d }));
      }
    }
    digits = [];
  }
  return out.sort((a, b) => a - b);
}

/** id 数组 → 简写字符串（便于测试里对比与打印） */
export function formatTiles(ids: readonly number[]): string {
  const sorted = [...ids].sort((a, b) => a - b);
  let out = "";
  let cur: Suit | null = null;
  let buf = "";
  for (const id of sorted) {
    const s = suitOf(id);
    if (s !== cur) {
      if (cur) out += buf + cur;
      cur = s;
      buf = "";
    }
    buf += String(rankOf(id));
  }
  if (cur) out += buf + cur;
  return out;
}

/** 34 种可打出的牌（不含花牌），counts 数组按这个顺序索引 */
export const PLAYABLE_IDS: number[] = fullDeck().filter((id) => !isFlower(id)).filter((id, i, arr) => arr.indexOf(id) === i);

/** id → counts 数组下标（0..33） */
export function idIndex(id: number): number {
  const s = Math.floor(id / 10);
  const r = id % 10;
  if (s <= 2) return s * 9 + (r - 1);
  return 27 + (r - 1);
}

/** counts 数组下标 → id */
export function indexId(i: number): number {
  if (i < 27) return Math.floor(i / 9) * 10 + (i % 9) + 1;
  return 31 + (i - 27);
}

/** 手牌 → 长度 34 的计数数组（花牌不计入） */
export function toCounts(ids: readonly number[]): number[] {
  const c = new Array<number>(34).fill(0);
  for (const id of ids) {
    if (isFlower(id)) continue;
    c[idIndex(id)]++;
  }
  return c;
}

/** 计数数组 → 升序 id 数组 */
export function fromCounts(counts: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 34; i++) {
    for (let k = 0; k < counts[i]; k++) out.push(indexId(i));
  }
  return out;
}

/** 升序排一手牌（不改原数组） */
export function sortTiles(ids: readonly number[]): number[] {
  return [...ids].sort((a, b) => a - b);
}

/** 从手里拿掉一张牌，拿不到返回 null（绝不抛异常） */
export function removeTile(hand: readonly number[], id: number): number[] | null {
  const i = hand.indexOf(id);
  if (i < 0) return null;
  const out = hand.slice();
  out.splice(i, 1);
  return out;
}

/** 这手牌里有几张某牌 */
export function countOf(hand: readonly number[], id: number): number {
  let n = 0;
  for (const t of hand) if (t === id) n++;
  return n;
}

/** 手牌里出现过的花色（只看万筒条字，花牌不算门） */
export function suitsUsed(ids: readonly number[]): Suit[] {
  const set = new Set<Suit>();
  for (const id of ids) {
    if (isFlower(id)) continue;
    set.add(suitOf(id));
  }
  return (["m", "p", "s", "z"] as Suit[]).filter((s) => set.has(s));
}
