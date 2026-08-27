/**
 * 铁皮坦克大战 1.2 · 地形五件套(纯函数,不碰 DOM 也不碰世界状态)。
 *
 * 战场是一张字符网格,这里是这张网格的「地形字典」:
 *   `.` 空地   `#` 砖(可破,四分之一格粒度)   `S` 钢(要彩纸穿甲弹才拆得动)
 *   `~` 水(弹力球飞得过、铁皮车开不过)      `*` 草(半透明遮挡,只挡视线)
 *   `i` 冰(打滑,松手还会往前溜)            `B` 星星老巢
 *   `1`/`2` 鸭梨 / 康康出生点   `e` 铁皮车出生点
 *
 * 砖的四分之一格:每格砖记一个 4 位掩码,四个小块各自独立。
 * 弹丸有粗细(`SHELL_RADIUS`),打在正中间就把整条边的两个小块一起崩掉——
 * 于是「正面对着打两下塌一格」这条老规矩不变;
 * 打偏一点只崩掉一角,就在墙上开出一条射击缝,弹丸钻得过去、铁皮车还是过不去。
 */

export type Tile = "." | "#" | "S" | "~" | "*" | "i" | "B";

export interface Cell {
  cx: number;
  cy: number;
}

/** 0 上 1 右 2 下 3 左 */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export const TILE_CHARS: readonly Tile[] = [".", "#", "S", "~", "*", "i", "B"];

export interface TerrainInfo {
  tile: Tile;
  name: string;
  emoji: string;
  /** 一句话:小朋友读得懂的规则 */
  desc: string;
  /** 铁皮车过不过得去 */
  stopsTank: boolean;
  /** 普通弹丸飞不飞得过 */
  stopsShell: boolean;
  /** 挡不挡视线(只有草挡) */
  hidesTank: boolean;
  /** 滑不滑(只有冰滑) */
  slippery: boolean;
  /** 普通弹丸打不打得碎 */
  breakable: boolean;
  /** 要不要彩纸穿甲弹才拆得动 */
  needsPierce: boolean;
}

export const TERRAIN: Record<Tile, TerrainInfo> = {
  ".": {
    tile: ".",
    name: "空地",
    emoji: "⬜",
    desc: "随便开,什么都挡不住。",
    stopsTank: false,
    stopsShell: false,
    hidesTank: false,
    slippery: false,
    breakable: false,
    needsPierce: false,
  },
  "#": {
    tile: "#",
    name: "积木砖",
    emoji: "🧱",
    desc: "打得碎,而且是一小角一小角地碎。",
    stopsTank: true,
    stopsShell: true,
    hidesTank: false,
    slippery: false,
    breakable: true,
    needsPierce: false,
  },
  S: {
    tile: "S",
    name: "钢板",
    emoji: "🔩",
    desc: "普通弹丸弹开,换彩纸穿甲弹才拆得动。",
    stopsTank: true,
    stopsShell: true,
    hidesTank: false,
    slippery: false,
    breakable: false,
    needsPierce: true,
  },
  "~": {
    tile: "~",
    name: "水洼",
    emoji: "💧",
    desc: "弹丸飞得过去,铁皮车开不过去。",
    stopsTank: true,
    stopsShell: false,
    hidesTank: false,
    slippery: false,
    breakable: false,
    needsPierce: false,
  },
  "*": {
    tile: "*",
    name: "草丛",
    emoji: "🌿",
    desc: "半透明,躲进去别人只看得见影子。",
    stopsTank: false,
    stopsShell: false,
    hidesTank: true,
    slippery: false,
    breakable: false,
    needsPierce: false,
  },
  i: {
    tile: "i",
    name: "冰面",
    emoji: "🧊",
    desc: "会打滑:松开手还要往前溜一小段。",
    stopsTank: false,
    stopsShell: false,
    hidesTank: false,
    slippery: true,
    breakable: false,
    needsPierce: false,
  },
  B: {
    tile: "B",
    name: "星星老巢",
    emoji: "⭐",
    desc: "要守住的地方,谁都开不进去。",
    stopsTank: true,
    stopsShell: true,
    hidesTank: false,
    slippery: false,
    breakable: false,
    needsPierce: false,
  },
};

export function isTile(ch: string): ch is Tile {
  return (TILE_CHARS as readonly string[]).includes(ch);
}

export function terrainOf(t: Tile): TerrainInfo {
  return TERRAIN[t];
}

/** 铁皮车过不去的地形 */
export function blocksTank(t: Tile): boolean {
  return TERRAIN[t].stopsTank;
}

/** 普通弹丸飞不过去的地形(水和草都飞得过) */
export function blocksShell(t: Tile): boolean {
  return TERRAIN[t].stopsShell;
}

/** 挡视线的地形:草丛挡,能打穿的墙当然也挡 */
export function blocksSight(t: Tile): boolean {
  return TERRAIN[t].hidesTank || TERRAIN[t].stopsShell;
}

/** 站上去会打滑的地形 */
export function isSlippery(t: Tile): boolean {
  return TERRAIN[t].slippery;
}

/** 草丛的不透明度:半透明才辨得出里面有没有车,全黑会让人抓狂 */
export const GRASS_ALPHA = 0.55;

// ---------------------------------------------------------------------------
// 冰面:滑行惯性
// ---------------------------------------------------------------------------

/** 冰上松手后,速度每秒掉多少(格/秒²) */
export const ICE_FRICTION = 2.8;
/** 冰上蹬地只使得出几成力:所以起步慢、停不住 */
export const ICE_GRIP = 0.45;
/** 溜到这个速度以下就算停住了 */
export const ICE_STILL = 0.08;

/** 松开手之后,冰上还能溜多快 */
export function iceGlide(speed: number, dt: number, friction: number = ICE_FRICTION): number {
  const next = speed - friction * dt;
  return next <= ICE_STILL ? 0 : next;
}

/** 在冰上蹬地:想要 want 这么快,但一帧只补得上一点点 */
export function iceSteer(cur: number, want: number, dt: number, grip: number = ICE_GRIP): number {
  const gain = want * grip * 6 * dt;
  return Math.min(want, cur + gain);
}

/** 松手后还能溜多远(格);用例拿它验「冰比空地滑」 */
export function glideDistance(speed: number, friction: number = ICE_FRICTION): number {
  return (speed * speed) / (2 * friction);
}

// ---------------------------------------------------------------------------
// 砖:四分之一格
// ---------------------------------------------------------------------------

/** 四个小块的位:左上 / 右上 / 左下 / 右下 */
export const Q_NW = 1;
export const Q_NE = 2;
export const Q_SW = 4;
export const Q_SE = 8;
/** 一整块新砖 */
export const BRICK_FULL = Q_NW | Q_NE | Q_SW | Q_SE;
/** 弹丸的半径(格):正好让「打在格中线上」同时崩掉左右两个小块 */
export const SHELL_RADIUS = 0.12;

/** 一格砖上还剩几个小块 */
export function quarterCount(mask: number): number {
  let n = 0;
  for (const bit of [Q_NW, Q_NE, Q_SW, Q_SE]) if (mask & bit) n += 1;
  return n;
}

/** 这一格砖还剩多少「耐久」(两个小块折一发普通弹丸,老规矩不变) */
export function maskToHp(mask: number): number {
  return Math.ceil(quarterCount(mask) / 2);
}

/** 格内坐标(0..1)落在哪个小块上 */
export function quarterBitAt(fx: number, fy: number): number {
  const right = fx >= 0.5;
  const bottom = fy >= 0.5;
  if (bottom) return right ? Q_SE : Q_SW;
  return right ? Q_NE : Q_NW;
}

/** 这一点还是实心的吗(弹丸从缺口钻过去就靠它) */
export function quarterSolid(mask: number, fx: number, fy: number): boolean {
  return (mask & quarterBitAt(fx, fy)) !== 0;
}

/** 顺着 dir 飞过来的弹丸,先撞上哪两个小块(近侧那一对) */
export function nearPair(dir: Dir): number {
  if (dir === 0) return Q_SW | Q_SE; // 往上飞:先撞下面那一排
  if (dir === 2) return Q_NW | Q_NE; // 往下飞:先撞上面那一排
  if (dir === 1) return Q_NW | Q_SW; // 往右飞:先撞左边那一列
  return Q_NE | Q_SE; // 往左飞:先撞右边那一列
}

export function farPair(dir: Dir): number {
  return BRICK_FULL & ~nearPair(dir);
}

/** 弹丸横向盖住了哪几个小块:cross 是它在另一根轴上的格内坐标 */
export function spanBits(dir: Dir, cross: number, radius: number = SHELL_RADIUS): number {
  const lo = cross - radius;
  const hi = cross + radius;
  const touchesLow = lo < 0.5;
  const touchesHigh = hi > 0.5;
  if (dir === 0 || dir === 2) {
    // 竖着飞:cross 是 x,低半边是左列
    return (touchesLow ? Q_NW | Q_SW : 0) | (touchesHigh ? Q_NE | Q_SE : 0);
  }
  // 横着飞:cross 是 y,低半边是上排
  return (touchesLow ? Q_NW | Q_NE : 0) | (touchesHigh ? Q_SW | Q_SE : 0);
}

/**
 * 一发普通弹丸打在这格砖上,会崩掉哪几个小块。
 * 近侧那一对先挨打;近侧已经空了就轮到远侧——所以正面对着打,还是两下一格。
 */
export function chipBits(mask: number, dir: Dir, cross: number, radius: number = SHELL_RADIUS): number {
  const span = spanBits(dir, cross, radius);
  const near = mask & nearPair(dir) & span;
  if (near !== 0) return near;
  return mask & farPair(dir) & span;
}

/** 崩掉之后这格砖剩下什么 */
export function chipBrick(mask: number, dir: Dir, cross: number, radius: number = SHELL_RADIUS): number {
  return mask & ~chipBits(mask, dir, cross, radius);
}

/** 四个小块都没了才算这格空了 */
export function brickGone(mask: number): boolean {
  return (mask & BRICK_FULL) === 0;
}
