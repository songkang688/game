/**
 * 铁皮坦克大战 1.2 · 手写的二维字符表地图。
 *
 * 188 关战役的地图仍旧由 `levels.ts` 的确定性生成器产出(这一版一格没动),
 * 这里放的是**对战专用的三张对称地图**和**无尽「守老巢」的冰原场**——
 * 都是一行一行敲出来的字符表,测试可以直接拿来构造世界,谁都能照着改。
 *
 * 对称是写进用例的硬约束:左右镜像 / 上下镜像 / 转 180°,
 * 翻过去要和原图一模一样(朵朵的出生点 `1` 和星星的 `2` 互换),
 * 这样两个人谁都占不到地形便宜。
 */

export type Symmetry = "mirror-x" | "mirror-y" | "point";

export interface ArenaMap {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  symmetry: Symmetry;
  rows: readonly string[];
}

/** 翻图时朵朵和星星的出生点要互换,不然「对称」就成了假的 */
export function swapSides(ch: string): string {
  if (ch === "1") return "2";
  if (ch === "2") return "1";
  return ch;
}

function mapChars(row: string): string {
  let out = "";
  for (const ch of row) out += swapSides(ch);
  return out;
}

/** 左右翻 */
export function mirrorX(rows: readonly string[]): string[] {
  return rows.map((row) => mapChars(row.split("").reverse().join("")));
}

/** 上下翻 */
export function mirrorY(rows: readonly string[]): string[] {
  return [...rows].reverse().map(mapChars);
}

/** 转 180° */
export function rotate180(rows: readonly string[]): string[] {
  return [...rows].reverse().map((row) => mapChars(row.split("").reverse().join("")));
}

export function isSymmetric(rows: readonly string[], kind: Symmetry): boolean {
  const flipped = kind === "mirror-x" ? mirrorX(rows) : kind === "mirror-y" ? mirrorY(rows) : rotate180(rows);
  return flipped.join("\n") === rows.join("\n");
}

// ---------------------------------------------------------------------------
// 三张对战场
// ---------------------------------------------------------------------------

/**
 * 一号场「镜面冰场」:左右对称。
 * 中轴上一串冰面,谁抢中路谁先打滑;两边各有一块钢板可以当盾牌。
 */
const ARENA_MIRROR: readonly string[] = [
  ".............",
  ".##.......##.",
  ".#..S...S..#.",
  "....S.i.S....",
  ".##.~~~~~.##.",
  "..*.......*..",
  "1..##.S.##..2",
  "..*.......*..",
  ".##.~~~~~.##.",
  "....S.i.S....",
  ".#..S...S..#.",
  ".##.......##.",
  ".............",
];

/**
 * 二号场「双层糖果盒」:上下对称。
 * 一人守上一人守下,中间一条钢板走廊,想过去就得从两边绕。
 */
const ARENA_LAYERS: readonly string[] = [
  "......2......",
  ".###.....###.",
  "...i.....i...",
  ".S..##.##..S.",
  "...*.....*...",
  "..~~.....~~..",
  "S..#..#..#..S",
  "..~~.....~~..",
  "...*.....*...",
  ".S..##.##..S.",
  "...i.....i...",
  ".###.....###.",
  "......1......",
];

/**
 * 三号场「转盘广场」:转 180° 对称。
 * 一个人在左下、一个人在右上,四块砖围出一个转盘,绕着追最有意思。
 */
const ARENA_PINWHEEL: readonly string[] = [
  "...##...iii..",
  "..S.....~..2.",
  "..S...###....",
  "....*....##..",
  ".##...i......",
  "...~~....S...",
  "..#.S.i.S.#..",
  "...S....~~...",
  "......i...##.",
  "..##....*....",
  "....###...S..",
  ".1..~.....S..",
  "..iii...##...",
];

export const ARENAS: readonly ArenaMap[] = [
  {
    id: "mirror",
    name: "镜面冰场",
    emoji: "🪞",
    desc: "左右对称。中路一条冰,抢中间要小心刹不住。",
    symmetry: "mirror-x",
    rows: ARENA_MIRROR,
  },
  {
    id: "layers",
    name: "双层糖果盒",
    emoji: "🍬",
    desc: "上下对称。中间隔着钢板走廊,想过去得绕边。",
    symmetry: "mirror-y",
    rows: ARENA_LAYERS,
  },
  {
    id: "pinwheel",
    name: "转盘广场",
    emoji: "🎡",
    desc: "转 180° 对称。围着中间的转盘互相追,弹力球最好用。",
    symmetry: "point",
    rows: ARENA_PINWHEEL,
  },
];

export function arenaById(id: string): ArenaMap {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}

// ---------------------------------------------------------------------------
// 无尽「守老巢」的冰原场
// ---------------------------------------------------------------------------

/**
 * 冰原老巢:老巢在底边正中,三个铁皮车出生点在顶边,朵朵和星星一左一右。
 * 两条冰带横在半路上,追车追急了会滑过头——这就是无尽越到后面越要动脑子的地方。
 */
export const FROST_NEST: readonly string[] = [
  "e.....e.....e",
  ".............",
  "..##..i..##..",
  "iii..S.S..iii",
  "..*.......*..",
  ".#.##...##.#.",
  "...~~...~~...",
  "iii...*...iii",
  ".##..S.S..##.",
  "...#.....#...",
  ".....###.....",
  ".....###.....",
  "...1##B##2...",
];

export interface NestMap {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  rows: readonly string[];
}

export const FROST_NEST_MAP: NestMap = {
  id: "frost",
  name: "冰原老巢",
  emoji: "🧊",
  desc: "两条冰带横在半路,追车别追太急。",
  rows: FROST_NEST,
};
