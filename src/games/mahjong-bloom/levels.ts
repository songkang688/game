/**
 * 花开麻将 · 188 关残局战役（纯数据 + 纯函数）。
 *
 * **每一关都天生有解**：不是先撒牌再祈祷能胡，而是反过来做 ——
 * 先按本章要教的番种造出一副完整的 14 张胡牌，再抽掉其中一张当「和牌张」，
 * 把它塞进这一关的小牌墙里。所以只要玩家把闲牌打掉、把和牌张摸到手，
 * 这一关一定能和，而且一定够门槛。`solveLevel` 就是照着这条既定路线走一遍并自检。
 *
 * 八章 24 + 24 + 24 + 24 + 22 + 22 + 24 + 24 = 188。
 */
import { mulberry32, type Chapter } from "../level99";
import { canHuWithFloor, scoreFans, type FanHit } from "./fan";
import { isHu } from "./hu";
import { makeKan, makePon, type Meld } from "./melds";
import {
  THIRTEEN_ORPHANS,
  countOf,
  isFlower,
  isHonor,
  sortTiles,
  tileName
} from "./tiles";

export const CHAPTERS: Chapter[] = [
  { name: "顺子小溪", emoji: "🌊", color: "#DCEEFB", desc: "只练吃牌和顺子,一番就能和,先把「平和」凑出来。", size: 24 },
  { name: "碰碰花园", emoji: "🌷", color: "#FBE0EC", desc: "学会碰:四副刻子加一对将,这就是碰碰和。", size: 24 },
  { name: "杠上开花", emoji: "🎆", color: "#FFF0D6", desc: "明杠、暗杠、加杠都试一遍,杠完补的那张直接开花。", size: 24 },
  { name: "混清一色", emoji: "🎨", color: "#E6E0FB", desc: "一门到底:混一色带字牌,清一色一个字也不要。", size: 24 },
  { name: "七对星空", emoji: "✨", color: "#E0F2EF", desc: "十四张凑成七个对子,连号的七对更亮。", size: 22 },
  { name: "龙与三色", emoji: "🐉", color: "#FDE7DA", desc: "清龙、花龙、三色三同顺,顺子也能玩出花样。", size: 22 },
  { name: "八番考场", emoji: "📯", color: "#E2F0D9", desc: "门槛回到八番,不够番就不能和,先把大牌想好再动手。", size: 24 },
  { name: "国标华章", emoji: "👑", color: "#F6DDF0", desc: "大三元、十三幺、九莲宝灯……国标里最漂亮的那些牌型。", size: 24 }
];

/** 各章的起和门槛：前三章 1 / 2 / 4 番做教学，第 7 章起恢复 8 番 */
export const CHAPTER_FLOORS = [1, 2, 4, 6, 6, 6, 8, 8];

const SUIT_BASE = [0, 10, 20];

/** 34 种可打出的牌，按万→筒→条→字排 */
const POOL: number[] = (() => {
  const out: number[] = [];
  for (const b of SUIT_BASE) for (let r = 1; r <= 9; r++) out.push(b + r);
  for (let r = 1; r <= 7; r++) out.push(30 + r);
  return out;
})();

function chi(base: number, start: number): number[] {
  const s = Math.max(1, Math.min(7, start));
  return [base + s, base + s + 1, base + s + 2];
}

function pung(id: number): number[] {
  return [id, id, id];
}

function duo(id: number): number[] {
  return [id, id];
}

/** 从 POOL 里按固定步长取 n 张互不相同的牌 */
function distinctPicks(i: number, n: number, step = 7): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(POOL[(i * 5 + k * step) % POOL.length]);
  return out;
}

export interface Built {
  /** 完整的 14 张（含副露里的牌折成 3 张） */
  tiles: number[];
  melds: Meld[];
  /** 本关的目标番种 */
  require: string[];
  selfDraw: boolean;
  afterKan?: boolean;
}

// ---------------------------------------------------------------------------
// 八章的牌型模板
// ---------------------------------------------------------------------------

function buildPinghe(i: number): Built {
  const s1 = SUIT_BASE[i % 3];
  const s2 = SUIT_BASE[(i + 1) % 3];
  const s3 = SUIT_BASE[(i + 2) % 3];
  const tiles = [
    ...chi(s1, (i % 7) + 1),
    ...chi(s1, ((i * 2) % 7) + 1),
    ...chi(s2, ((i * 3) % 7) + 1),
    ...chi(s3, ((i * 5) % 7) + 1),
    ...duo(s2 + ((i * 4) % 9) + 1)
  ];
  return { tiles, melds: [], require: ["平和"], selfDraw: true };
}

function buildPengpeng(i: number): Built {
  const ids = distinctPicks(i, 5);
  const tiles = [...pung(ids[0]), ...pung(ids[1]), ...pung(ids[2]), ...pung(ids[3]), ...duo(ids[4])];
  // 至少亮一副碰出来：四副都暗着就成了四暗刻，「就高不就低」会把碰碰和吃掉，
  // 这一章要教的恰恰是碰碰和，所以留三暗刻封顶
  const melds: Meld[] = [makePon(ids[0], (i % 3) + 1)];
  if (i % 3 === 2) melds.push(makePon(ids[1], 2));
  return { tiles, melds, require: ["碰碰和"], selfDraw: true };
}

function buildKan(i: number): Built {
  const kanTile = 31 + (i % 7);
  const s1 = SUIT_BASE[i % 3];
  const s2 = SUIT_BASE[(i + 1) % 3];
  const s3 = SUIT_BASE[(i + 2) % 3];
  const kind = i % 3 === 0 ? "ankan" : i % 3 === 1 ? "minkan" : "kakan";
  const tiles = [
    kanTile,
    kanTile,
    kanTile,
    ...chi(s1, (i % 7) + 1),
    ...chi(s2, ((i * 3) % 7) + 1),
    ...pung(s3 + (((i * 2) % 9) + 1)),
    ...duo(s1 + (((i * 4) % 9) + 1))
  ];
  return {
    tiles,
    melds: [makeKan(kanTile, kind as "ankan" | "minkan" | "kakan", kind === "ankan" ? 0 : 1)],
    require: ["杠上开花"],
    selfDraw: true,
    afterKan: true
  };
}

function buildFlush(i: number): Built {
  const b = SUIT_BASE[i % 3];
  if (i % 2 === 0) {
    const tiles = [
      ...chi(b, 1),
      ...chi(b, 4),
      ...chi(b, 7),
      ...chi(b, ((i * 2) % 7) + 1),
      ...duo(b + (((i * 3) % 9) + 1))
    ];
    return { tiles, melds: [], require: ["清一色"], selfDraw: true };
  }
  const tiles = [
    ...chi(b, 1),
    ...chi(b, 4),
    ...chi(b, 7),
    ...pung(31 + (i % 7)),
    ...duo(b + (((i * 3) % 9) + 1))
  ];
  return { tiles, melds: [], require: ["混一色"], selfDraw: true };
}

function buildSevenPairs(i: number): Built {
  if (i % 5 === 0) {
    const b = SUIT_BASE[Math.floor(i / 5) % 3];
    const start = 1 + (Math.floor(i / 5) % 3);
    const tiles: number[] = [];
    for (let k = 0; k < 7; k++) tiles.push(...duo(b + start + k));
    return { tiles, melds: [], require: ["连七对"], selfDraw: true };
  }
  const ids = distinctPicks(i, 7, 5);
  const tiles: number[] = [];
  for (const id of ids) tiles.push(...duo(id));
  return { tiles, melds: [], require: ["七对"], selfDraw: true };
}

function buildDragonSuits(i: number): Built {
  const s1 = SUIT_BASE[i % 3];
  const s2 = SUIT_BASE[(i + 1) % 3];
  const s3 = SUIT_BASE[(i + 2) % 3];
  const honor = 31 + (i % 7);
  const mode = i % 3;
  if (mode === 0) {
    return {
      tiles: [...chi(s1, 1), ...chi(s1, 4), ...chi(s1, 7), ...pung(honor), ...duo(s2 + ((i * 3) % 9) + 1)],
      melds: [],
      require: ["清龙"],
      selfDraw: true
    };
  }
  if (mode === 1) {
    return {
      tiles: [...chi(s1, 1), ...chi(s2, 4), ...chi(s3, 7), ...pung(honor), ...duo(s1 + ((i * 3) % 9) + 1)],
      melds: [],
      require: ["花龙"],
      selfDraw: true
    };
  }
  const a = ((i * 2) % 7) + 1;
  return {
    tiles: [...chi(s1, a), ...chi(s2, a), ...chi(s3, a), ...pung(honor), ...duo(s1 + ((a + 4) % 9) + 1)],
    melds: [],
    require: ["三色三同顺"],
    selfDraw: true
  };
}

function buildEightFan(i: number): Built {
  const b = SUIT_BASE[i % 3];
  const b2 = SUIT_BASE[(i + 1) % 3];
  switch (i % 6) {
    case 0:
      return {
        tiles: [...chi(b, 1), ...chi(b, 4), ...chi(b, 7), ...chi(b, ((i * 2) % 7) + 1), ...duo(b + ((i * 3) % 9) + 1)],
        melds: [],
        require: ["清一色"],
        selfDraw: true
      };
    case 1: {
      const ids = distinctPicks(i + 3, 7, 5);
      const tiles: number[] = [];
      for (const id of ids) tiles.push(...duo(id));
      return { tiles, melds: [], require: ["七对"], selfDraw: true };
    }
    case 2: {
      const r1 = (i % 9) + 1;
      const r2 = ((i * 2) % 9) + 1;
      const r3 = ((i * 4) % 9) + 1;
      const picks = [...new Set([r1, r2, r3])];
      while (picks.length < 3) picks.push(((picks[picks.length - 1] + 3) % 9) + 1);
      return {
        tiles: [
          ...pung(b + picks[0]),
          ...pung(b + picks[1]),
          ...pung(b + picks[2]),
          ...pung(31 + (i % 7)),
          ...duo(b + (((picks[0] + 4) % 9) + 1))
        ],
        // 同上：亮一副碰，免得四暗刻把碰碰和盖掉
        melds: [makePon(b + picks[0], 1)],
        require: ["混一色", "碰碰和"],
        selfDraw: true
      };
    }
    case 3:
      return {
        tiles: [...chi(b, 1), ...chi(b, 4), ...chi(b, 7), ...chi(b2, ((i * 3) % 7) + 1), ...duo(31 + (i % 7))],
        melds: [],
        require: ["清龙"],
        selfDraw: true
      };
    case 4: {
      const terms = [1, 9, 11, 19, 21, 29];
      const honors = [31, 32, 33, 34, 35, 36, 37];
      return {
        tiles: [
          ...pung(terms[i % 6]),
          ...pung(terms[(i + 2) % 6]),
          ...pung(honors[i % 7]),
          ...pung(honors[(i + 3) % 7]),
          ...duo(terms[(i + 4) % 6])
        ],
        melds: [],
        require: ["混幺九"],
        selfDraw: true
      };
    }
    default: {
      const a = ((i * 2) % 7) + 1;
      const pr = a + 4 <= 9 ? a + 4 : a - 2;
      return {
        tiles: [...chi(b, a), ...chi(b, a), ...chi(b, a), ...chi(b, a), ...duo(b + Math.max(1, pr))],
        melds: [],
        require: ["一色四同顺"],
        selfDraw: true
      };
    }
  }
}

function buildMasterpiece(i: number): Built {
  const b = SUIT_BASE[i % 3];
  const b2 = SUIT_BASE[(i + 1) % 3];
  const b3 = SUIT_BASE[(i + 2) % 3];
  switch (i % 24) {
    case 0:
      return {
        tiles: [...pung(35), ...pung(36), ...pung(37), ...chi(b, (i % 7) + 1), ...duo(b + ((i * 3) % 9) + 1)],
        melds: [],
        require: ["大三元"],
        selfDraw: true
      };
    case 1: {
      const dup = THIRTEEN_ORPHANS[i % 13];
      return { tiles: [...THIRTEEN_ORPHANS, dup], melds: [], require: ["十三幺"], selfDraw: true };
    }
    case 2:
      return {
        tiles: [...pung(31), ...pung(32), ...pung(33), ...pung(34), ...duo(b + ((i * 3) % 9) + 1)],
        melds: [],
        require: ["大四喜"],
        selfDraw: true
      };
    case 3: {
      const hs = [31, 32, 33, 34, 35, 36, 37];
      return {
        tiles: [
          ...pung(hs[i % 7]),
          ...pung(hs[(i + 1) % 7]),
          ...pung(hs[(i + 2) % 7]),
          ...pung(hs[(i + 3) % 7]),
          ...duo(hs[(i + 4) % 7])
        ],
        melds: [],
        require: ["字一色"],
        selfDraw: true
      };
    }
    case 4: {
      const ids = distinctPicks(i + 1, 5);
      return {
        tiles: [...pung(ids[0]), ...pung(ids[1]), ...pung(ids[2]), ...pung(ids[3]), ...duo(ids[4])],
        melds: [],
        require: ["四暗刻"],
        selfDraw: true
      };
    }
    case 5: {
      const terms = [1, 9, 11, 19, 21, 29];
      return {
        tiles: [
          ...pung(terms[i % 6]),
          ...pung(terms[(i + 1) % 6]),
          ...pung(terms[(i + 2) % 6]),
          ...pung(terms[(i + 3) % 6]),
          ...duo(terms[(i + 4) % 6])
        ],
        melds: [],
        require: ["清幺九"],
        selfDraw: true
      };
    }
    case 6:
      return {
        tiles: [...pung(35), ...pung(36), ...duo(37), ...chi(b, (i % 7) + 1), ...chi(b2, ((i * 2) % 7) + 1)],
        melds: [],
        require: ["小三元"],
        selfDraw: true
      };
    case 7: {
      const extra = b + ((i % 9) + 1);
      return {
        tiles: sortTiles([
          b + 1, b + 1, b + 1, b + 2, b + 3, b + 4, b + 5, b + 6, b + 7, b + 8, b + 9, b + 9, b + 9, extra
        ]),
        melds: [],
        require: ["九莲宝灯"],
        selfDraw: true
      };
    }
    case 8:
      return {
        tiles: [...chi(20, 2), ...chi(20, 2), ...pung(26), ...pung(28), ...duo(22)],
        melds: [],
        require: ["绿一色"],
        selfDraw: true
      };
    case 9: {
      const a = ((i * 2) % 7) + 1;
      const pr = a + 4 <= 9 ? a + 4 : a - 2;
      return {
        tiles: [...chi(b, a), ...chi(b, a), ...chi(b, a), ...chi(b, a), ...duo(b + Math.max(1, pr))],
        melds: [],
        require: ["一色四同顺"],
        selfDraw: true
      };
    }
    case 10: {
      const k = i % 3;
      const tracks = [
        [1, 2, 3],
        [2, 3, 1],
        [3, 1, 2]
      ][k];
      const nine: number[] = [];
      for (let t = 0; t < 3; t++) for (let n = 0; n < 3; n++) nine.push(SUIT_BASE[t] + tracks[t] + n * 3);
      // 七星不靠 = 七种字牌各一张 + 七张互不相靠的数牌，正好 14 张
      return {
        tiles: [...nine.slice(0, 7), 31, 32, 33, 34, 35, 36, 37],
        melds: [],
        require: ["七星不靠"],
        selfDraw: true
      };
    }
    case 11:
      return {
        tiles: [...chi(b, 1), ...chi(b, 1), ...chi(b, 7), ...chi(b, 7), ...duo(b + 5)],
        melds: [],
        require: ["一色双龙会"],
        selfDraw: true
      };
    case 12:
      return {
        tiles: [...pung(31), ...pung(32), ...pung(33), ...duo(34), ...chi(b, (i % 7) + 1)],
        melds: [],
        require: ["小四喜"],
        selfDraw: true
      };
    case 13: {
      const terms = [1, 9, 11, 19, 21, 29];
      const honors = [31, 32, 33, 34, 35, 36, 37];
      return {
        tiles: [
          ...pung(terms[i % 6]),
          ...pung(terms[(i + 3) % 6]),
          ...pung(honors[i % 7]),
          ...pung(honors[(i + 2) % 7]),
          ...duo(terms[(i + 5) % 6])
        ],
        melds: [],
        require: ["混幺九"],
        selfDraw: true
      };
    }
    case 14: {
      const evens = [2, 4, 6, 8];
      return {
        tiles: [
          ...pung(b + evens[i % 4]),
          ...pung(b + evens[(i + 1) % 4]),
          ...pung(b2 + evens[(i + 2) % 4]),
          ...pung(b3 + evens[(i + 3) % 4]),
          ...duo(b2 + evens[i % 4])
        ],
        melds: [],
        require: ["全双刻"],
        selfDraw: true
      };
    }
    case 15: {
      const nine: number[] = [];
      const tracks = [1, 2, 3];
      for (let t = 0; t < 3; t++) for (let n = 0; n < 3; n++) nine.push(SUIT_BASE[t] + tracks[t] + n * 3);
      return {
        tiles: [...nine, ...chi(b, 7), ...duo(b2 + 2)],
        melds: [],
        require: ["组合龙"],
        selfDraw: true
      };
    }
    case 16: {
      const nine = [1, 4, 7, 12, 15, 18, 23, 26];
      return { tiles: [...nine, 31, 32, 33, 34, 35, 36], melds: [], require: ["全不靠"], selfDraw: true };
    }
    case 17:
      return {
        tiles: [...chi(b, 1), ...chi(b, 7), ...chi(b2, 1), ...chi(b2, 7), ...duo(b3 + 5)],
        melds: [],
        require: ["三色双龙会"],
        selfDraw: true
      };
    case 18: {
      const st = (i % 5) + 1;
      return {
        tiles: [
          ...pung(b + st),
          ...pung(b + st + 1),
          ...pung(b + st + 2),
          ...pung(b + st + 3),
          ...duo(b2 + ((i * 3) % 9) + 1)
        ],
        melds: [],
        require: ["一色四节高"],
        selfDraw: true
      };
    }
    case 19: {
      const start = 1 + (i % 3);
      const tiles: number[] = [];
      for (let k = 0; k < 7; k++) tiles.push(...duo(b + start + k));
      return { tiles, melds: [], require: ["连七对"], selfDraw: true };
    }
    case 20:
      return {
        tiles: [...chi(b, 7), ...chi(b2, 7), ...pung(b3 + 9), ...pung(b + 7), ...duo(b2 + 8)],
        melds: [],
        require: ["全大"],
        selfDraw: true
      };
    case 21:
      return {
        tiles: [...chi(b, 1), ...chi(b2, 1), ...pung(b3 + 1), ...pung(b + 3), ...duo(b2 + 2)],
        melds: [],
        require: ["全小"],
        selfDraw: true
      };
    case 22:
      return {
        tiles: [...chi(b, 4), ...chi(b2, 4), ...pung(b3 + 5), ...pung(b + 4), ...duo(b2 + 6)],
        melds: [],
        require: ["全中"],
        selfDraw: true
      };
    default:
      return {
        tiles: [...chi(10, 1), ...chi(10, 3), ...chi(20, 4), ...pung(28), ...duo(19)],
        melds: [],
        require: ["推不倒"],
        selfDraw: true
      };
  }
}

const BUILDERS: Array<(i: number) => Built> = [
  buildPinghe,
  buildPengpeng,
  buildKan,
  buildFlush,
  buildSevenPairs,
  buildDragonSuits,
  buildEightFan,
  buildMasterpiece
];

/** 兜底牌型：任何模板出问题时都能顶上的一副清龙，绝不让某一关变成死局 */
function fallbackBuilt(i: number): Built {
  const b = SUIT_BASE[i % 3];
  return {
    tiles: [...chi(b, 1), ...chi(b, 4), ...chi(b, 7), ...chi(b, 1), ...duo(b + 5)],
    melds: [],
    require: [],
    selfDraw: true
  };
}

// ---------------------------------------------------------------------------
// 关卡装配
// ---------------------------------------------------------------------------

export interface MahjongLevel {
  /** 0 基关号 */
  level: number;
  chapterIndex: number;
  /** 起和门槛（番） */
  floor: number;
  /** 目标番种（凑齐了给三星） */
  require: string[];
  /** 13 张暗牌 */
  hand: number[];
  melds: Meld[];
  /** 保证能拿到的和牌张 */
  winTile: number;
  /** 这一关的小牌墙，从头摸；和牌张一定在里面，杠后补牌从牌尾拿 */
  wall: number[];
  selfDraw: boolean;
  afterKan: boolean;
  seatWind: number;
  roundWind: number;
  /** 按既定路线能拿到的番数（三星线） */
  targetPoints: number;
  /** 一句话目标 */
  goal: string;
}

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

function chapterStart(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 一副牌里同一张最多 4 枚，花牌只有 1 枚 */
function legalCounts(tiles: readonly number[]): boolean {
  if (tiles.length !== 14) return false;
  for (const t of tiles) {
    if (isFlower(t)) return false;
    if (countOf(tiles, t) > 4) return false;
  }
  return true;
}

const cache = new Map<number, MahjongLevel>();

/** 某一关的完整配置（同一关每次进来都一样） */
export function levelConfig(level: number): MahjongLevel {
  const lv = Math.max(0, Math.min(187, Math.round(level)));
  const hit = cache.get(lv);
  if (hit) return hit;

  const ci = chapterIndexOf(lv);
  const idx = lv - chapterStart(ci);
  const floor = CHAPTER_FLOORS[ci];
  const seatWind = (lv % 4) + 1;
  const roundWind = (Math.floor(lv / 47) % 4) + 1;

  const candidates: Built[] = [BUILDERS[ci](idx), BUILDERS[ci](idx + CHAPTERS[ci].size), fallbackBuilt(lv)];
  for (const built of candidates) {
    const packed = pack(lv, ci, built, floor, seatWind, roundWind);
    if (packed) {
      cache.set(lv, packed);
      return packed;
    }
  }
  // 理论上走不到这里；真走到了也给一关能玩的，不让界面白屏
  const safe = pack(lv, ci, fallbackBuilt(0), 1, seatWind, roundWind);
  const result = safe ?? emptyLevel(lv, ci, floor, seatWind, roundWind);
  cache.set(lv, result);
  return result;
}

function emptyLevel(
  lv: number,
  ci: number,
  floor: number,
  seatWind: number,
  roundWind: number
): MahjongLevel {
  const tiles = [...chi(0, 1), ...chi(0, 4), ...chi(0, 7), ...chi(0, 1), 5, 5];
  return {
    level: lv,
    chapterIndex: ci,
    floor: 1,
    require: [],
    hand: sortTiles(tiles.slice(0, 13)),
    melds: [],
    winTile: tiles[13],
    wall: [tiles[13]],
    selfDraw: true,
    afterKan: false,
    seatWind,
    roundWind,
    targetPoints: floor,
    goal: "把这副牌和出来"
  };
}

function pack(
  lv: number,
  ci: number,
  built: Built,
  floor: number,
  seatWind: number,
  roundWind: number
): MahjongLevel | null {
  const tiles = sortTiles(built.tiles);
  if (!legalCounts(tiles)) return null;
  const meldTiles: number[] = [];
  for (const m of built.melds) meldTiles.push(...m.tiles.slice(0, 3));
  // 副露里的牌必须真的在这副牌里
  const rest = tiles.slice();
  for (const t of meldTiles) {
    const at = rest.indexOf(t);
    if (at < 0) return null;
    rest.splice(at, 1);
  }
  if (!isHu(rest, null, built.melds)) return null;

  const seen = new Set<number>();
  for (const wt of rest) {
    if (seen.has(wt)) continue;
    seen.add(wt);
    const hand = rest.slice();
    hand.splice(hand.indexOf(wt), 1);
    if (!isHu(hand, wt, built.melds)) continue;
    const scored = scoreFans({
      hand: sortTiles([...hand, wt]),
      melds: built.melds,
      winTile: wt,
      selfDraw: built.selfDraw,
      seatWind,
      roundWind,
      afterKan: built.afterKan,
      flowers: 0
    });
    if (!canHuWithFloor(scored.points, floor)) continue;
    if (!built.require.every((n) => scored.names.includes(n))) continue;
    return {
      level: lv,
      chapterIndex: ci,
      floor,
      require: built.require,
      hand: sortTiles(hand),
      melds: built.melds,
      winTile: wt,
      wall: buildWall(lv, hand, wt, built),
      selfDraw: built.selfDraw,
      afterKan: Boolean(built.afterKan),
      seatWind,
      roundWind,
      targetPoints: scored.points,
      goal: goalLine(built.require, floor)
    };
  }
  return null;
}

/**
 * 这一关的小牌墙：几张一眼就该打掉的闲牌 + 和牌张。
 * 和牌张放在最后，正着摸能摸到、杠后从牌尾补也能补到，两条路都通。
 */
function buildWall(lv: number, hand: readonly number[], winTile: number, built: Built): number[] {
  const rand = mulberry32(lv * 131 + 17);
  const junkCount = 3 + (lv % 4);
  const out: number[] = [];
  const busy = new Set<number>([...hand, winTile]);
  for (const m of built.melds) for (const t of m.tiles) busy.add(t);
  let guard = 0;
  while (out.length < junkCount && guard++ < 200) {
    const cand = POOL[Math.floor(rand() * POOL.length)];
    // 闲牌要离手牌远一点，别一不小心变成有用的牌
    if (busy.has(cand)) continue;
    if (!isHonor(cand) && [...busy].some((t) => Math.abs(t - cand) <= 2 && Math.floor(t / 10) === Math.floor(cand / 10))) {
      continue;
    }
    if (countOf(out, cand) >= 2) continue;
    out.push(cand);
  }
  out.push(winTile);
  return out;
}

function goalLine(require: readonly string[], floor: number): string {
  if (require.length === 0) return `凑够 ${floor} 番就能和`;
  return `${require.join(" + ")}（${floor} 番起和）`;
}

export interface SolveReport {
  solvable: boolean;
  points: number;
  fans: FanHit[];
  names: string[];
  /** 走这条既定路线要摸几张牌 */
  draws: number;
}

/**
 * 按既定路线把这一关走一遍：摸掉闲牌 → 摸到和牌张 → 和。
 * 188 关全部要 `solvable === true`，这条断言写在 levels.test.ts 里。
 */
export function solveLevel(cfg: MahjongLevel): SolveReport {
  const winTile = cfg.wall[cfg.wall.length - 1];
  const ok = winTile === cfg.winTile && isHu(cfg.hand, cfg.winTile, cfg.melds);
  const scored = scoreFans({
    hand: sortTiles([...cfg.hand, cfg.winTile]),
    melds: cfg.melds,
    winTile: cfg.winTile,
    selfDraw: cfg.selfDraw,
    seatWind: cfg.seatWind,
    roundWind: cfg.roundWind,
    afterKan: cfg.afterKan,
    flowers: 0
  });
  const enough = canHuWithFloor(scored.points, cfg.floor);
  const hasAll = cfg.require.every((n) => scored.names.includes(n));
  return {
    solvable: ok && enough && hasAll,
    points: scored.points,
    fans: scored.fans,
    names: scored.names,
    draws: cfg.wall.length
  };
}

/** 三星评价：够门槛给 1 星，达成目标番种给 2 星，还没浪费摸牌机会给 3 星 */
export function starsFor(points: number, cfg: MahjongLevel, gotRequire: boolean, wasted: number): 1 | 2 | 3 {
  if (!gotRequire) return points >= cfg.targetPoints ? 2 : 1;
  return wasted <= 1 ? 3 : 2;
}

/** 关卡目标写成一句话（界面顶栏用） */
export function levelGoal(cfg: MahjongLevel): string {
  return cfg.goal;
}

/** 本关的闲牌提示：哪些牌是可以放心打掉的 */
export function junkHint(cfg: MahjongLevel): string {
  const junk = cfg.wall.slice(0, -1);
  if (junk.length === 0) return "直接摸最后一张就能和啦。";
  return `会摸到 ${junk.length} 张闲牌（像 ${tileName(junk[0])}），打掉它们别动手里的牌。`;
}

/** 无尽快棋第 n 局的配置：门槛与对手档位一路往上走 */
export function endlessConfig(round: number): { floor: number; tier: "rookie" | "normal" | "pro" | "hell"; label: string } {
  const r = Math.max(1, Math.round(round));
  const tier = r >= 10 ? "hell" : r >= 6 ? "pro" : r >= 3 ? "normal" : "rookie";
  const floor = r >= 8 ? 8 : r >= 5 ? 6 : r >= 3 ? 4 : 2;
  return { floor, tier, label: `第 ${r} 盘 · ${floor} 番起和` };
}
