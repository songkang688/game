/**
 * 冰冰火火森林 · 关卡数据层(纯函数,不碰 DOM)。
 *
 * 八个主题章节合计 188 关,走 `src/games/level99.ts` 的通用闯关框架:
 *  ①晨露林 ②熔岩洞 ③机关工坊 ④转轮长廊 ⑤幽绿沼泽 ⑥镜光殿 ⑦云端遗迹 ⑧冰火之心
 *
 * 关卡骨架永远是「若干段 + 中间几道屏障」:两人都从最左段出发,两扇门都在最右段。
 * 每一段里都保留两条打不断的通路 —— **最左那一列整列是空地**,以及**每一个通口所在的整行**;
 * 宝石与机关一律摆在这两条通路旁边的死胡同口袋里。这样段内连通性是构造出来的,
 * 谜题全部集中在屏障上,生成器不容易造出走不通的关。
 *
 * 即便如此,每一关生成完还是要过一遍 BFS 求解器(见 `analyzeLevel`);
 * 万一某个种子拼不出合法布局,就换个种子重来,最后还有一张必然可解的兜底关。
 */
import { mulberry32, randInt, type Chapter } from "../level99";
import type { GuideBook } from "../../ui/level188Contract";
import {
  gemsAllReachable,
  parseLevel,
  solveLevel,
  timeLimitSeconds,
  type ParsedLevel,
} from "./logic";

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  {
    name: "晨露林",
    emoji: "🌿",
    color: "#E3F5DF",
    desc: "先认路:凛凛趟得过冰水潭,焰焰踩得住岩浆池,两人都站上自己的门才算过。",
    size: 24,
  },
  {
    name: "熔岩洞",
    emoji: "🌋",
    color: "#FBDCD2",
    desc: "岩浆把路截断了。踏板只有被人压着才通电——一个人压住,另一个人过。",
    size: 24,
  },
  {
    name: "机关工坊",
    emoji: "⚙️",
    color: "#E7E2F6",
    desc: "拉杆踩一下就换一次状态,跷跷门此开彼关,谁先过、谁后过得先商量好。",
    size: 24,
  },
  {
    name: "转轮长廊",
    emoji: "🛞",
    color: "#DCEEF8",
    desc: "传送带是单向的,踏上去就停不下来;顺路的宝石要一次捡干净。",
    size: 24,
  },
  {
    name: "幽绿沼泽",
    emoji: "🍀",
    color: "#DFF0E4",
    desc: "绿黏液两个人都碰不得,通道被挤得很窄,前四章学的机关在这里一起用。",
    size: 23,
  },
  {
    name: "镜光殿",
    emoji: "🔮",
    color: "#EFE3F7",
    desc: "光束照到接收器,光门才会打开;斜镜负责拐弯,而人站在光路上会把光挡住。",
    size: 23,
  },
  {
    name: "云端遗迹",
    emoji: "☁️",
    color: "#E6EAF9",
    desc: "高坎一个人上不去,得有同伴踩在托举点上搭把手,两边轮流托一次才都过得去。",
    size: 23,
  },
  {
    name: "冰火之心",
    emoji: "💠",
    color: "#F5E2EE",
    desc: "全部机关混编,路线最长,分工要提前想清楚——这是森林最深处的考试。",
    size: 23,
  },
];

export const CHAPTER_NAMES = CHAPTERS.map((c) => c.name);

// ---------------------------------------------------------------------------
// 屏障类型
// ---------------------------------------------------------------------------

export type BarrierType =
  /** 一个共用的直通口 */
  | "open"
  /** 冰火分道:一边冰水一边岩浆 */
  | "split"
  /** 凛凛走闸门、焰焰走岩浆,得有人压着踏板 */
  | "plateIce"
  /** 焰焰走闸门、凛凛走冰水,得有人压着踏板 */
  | "plateFire"
  /** 唯一的通口是闸门,拉杆一拉就常开 */
  | "lever"
  /** 石闸门与跷跷门此开彼关,只能一个一个过 */
  | "seesaw"
  /** 传送带:去程一路滑过去,回程留一格 */
  | "belt"
  /** 高坎:同伴踩住托举点才上得去,两边各留一个托举点 */
  | "lift"
  /** 光门 + 光路上的闸门:一个人压踏板放光过去,另一个人才走得了光门 */
  | "beamPlate"
  /** 光门 + 斜镜绕一圈:光路默认通,但人站上去就会把光挡断 */
  | "beamMirror";

/** 屏障类型的一句话说明,进关提示与攻略共用 */
export const BARRIER_HINTS: Record<BarrierType, string> = {
  open: "有一个两人都能过的直通口。",
  split: "冰水潭归凛凛,岩浆池归焰焰,各走各的门。",
  plateIce: "凛凛的路被石闸门锁着——焰焰先压住踏板,凛凛过去了再走岩浆。",
  plateFire: "焰焰的路被石闸门锁着——凛凛先压住踏板,焰焰过去了再趟冰水。",
  lever: "唯一的通口是石闸门,先找到拉杆把它拉开。",
  seesaw: "石闸门和跷跷门此开彼关,一个人先过,另一个人再拉杆。",
  belt: "传送带是单向的,踏上去就一路滑到头,回程只有窄窄一格。",
  lift: "高坎一个人上不去,同伴得踩在托举点上;两边各有一个托举点,轮流托一次。",
  beamPlate: "光门要光束照到接收器才开,而光路上还横着一道石闸门。",
  beamMirror: "斜镜把光拐了个弯,注意别把自己站在光路上。",
};

/** 需要占用一个机关组编号的屏障 */
const NEEDS_GROUP: ReadonlySet<BarrierType> = new Set<BarrierType>([
  "plateIce",
  "plateFire",
  "lever",
  "seesaw",
  "beamPlate",
]);

/** 需要「一条 3 格长的口袋」才摆得下的屏障(光学器材比较占地方) */
const NEEDS_WIDE_POCKET: ReadonlySet<BarrierType> = new Set<BarrierType>([
  "beamPlate",
  "beamMirror",
]);

interface ChapterPlan {
  types: BarrierType[];
  sections: [number, number];
  pocket: [number, number];
  height: [number, number];
  /** 屏障上没用到的格子改成绿黏液(看着就危险,蹭一下掉一颗心) */
  slimeWalls: boolean;
}

const PLANS: ChapterPlan[] = [
  { types: ["open", "split"], sections: [2, 3], pocket: [2, 3], height: [7, 9], slimeWalls: false },
  { types: ["split", "plateIce", "plateFire"], sections: [3, 3], pocket: [2, 3], height: [9, 9], slimeWalls: false },
  { types: ["lever", "seesaw", "plateIce", "plateFire"], sections: [3, 3], pocket: [3, 3], height: [9, 9], slimeWalls: false },
  { types: ["split", "belt", "plateFire", "plateIce"], sections: [3, 3], pocket: [3, 3], height: [9, 9], slimeWalls: false },
  { types: ["split", "plateIce", "plateFire", "lever", "belt"], sections: [3, 4], pocket: [2, 3], height: [9, 11], slimeWalls: true },
  { types: ["beamMirror", "beamPlate", "plateIce", "plateFire"], sections: [3, 3], pocket: [3, 3], height: [9, 11], slimeWalls: false },
  { types: ["lift", "seesaw", "belt", "plateFire"], sections: [3, 3], pocket: [3, 3], height: [9, 11], slimeWalls: false },
  {
    types: ["plateIce", "plateFire", "seesaw", "belt", "lift", "beamPlate", "lever"],
    sections: [3, 4],
    pocket: [2, 3],
    height: [9, 11],
    slimeWalls: true,
  },
];

// ---------------------------------------------------------------------------
// 生成器
// ---------------------------------------------------------------------------

const GATE_CH = ["A", "B", "C"];
const SEESAW_CH = ["a", "b", "c"];
const PLATE_CH = ["1", "2", "3"];
const LEVER_CH = ["4", "5", "6"];

interface SectionPlan {
  x0: number;
  x1: number;
  openRows: number[];
  freeRows: number[];
}

/** 一次「摆点东西」的请求;段内的空闲行按顺序分配给它们 */
type ItemRequest =
  | { kind: "plate"; group: number }
  | { kind: "lever"; group: number }
  | { kind: "pad" }
  | { kind: "beamRig"; group: number }
  | { kind: "mirrorRig" };

class Draft {
  readonly w: number;
  readonly h: number;
  private readonly cells: string[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = new Array<string>(w * h).fill("#");
  }

  set(x: number, y: number, ch: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = ch;
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return "#";
    return this.cells[y * this.w + x];
  }

  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) {
      out.push(this.cells.slice(y * this.w, y * this.w + this.w).join(""));
    }
    return out;
  }
}

export interface LevelBlueprint {
  grid: string[];
  barriers: BarrierType[];
  /** 进关时显示的一句话,提示本关的机关重点 */
  hint: string;
}

/** 关卡尺寸参数(纯算术,方便测试盯住上限) */
export function levelShape(chapterIndex: number, t: number): {
  sections: number;
  pocket: number;
  height: number;
} {
  const plan = PLANS[chapterIndex];
  const lerp = (range: [number, number]): number =>
    range[0] + Math.round((range[1] - range[0]) * t);
  let sections = lerp(plan.sections);
  let pocket = lerp(plan.pocket);
  let height = lerp(plan.height);
  if (height % 2 === 0) height += 1;
  // 段数上到 4 就把口袋收窄,免得网格宽到窄屏放不下、BFS 也跑不动
  if (sections >= 4) pocket = 2;
  return { sections, pocket, height };
}

function pickRowPair(rand: () => number, h: number): [number, number] {
  const lo = 1;
  const hi = h - 2;
  const a = randInt(rand, lo, Math.max(lo, hi - 2));
  const gap = randInt(rand, 2, Math.max(2, Math.min(4, hi - a)));
  return [a, Math.min(hi, a + gap)];
}

function uniqueSorted(nums: number[]): number[] {
  return Array.from(new Set(nums)).sort((p, q) => p - q);
}

/**
 * 拼一张字符网格。拼不出来(空闲行不够摆机关)就返回 null,让调用方换种子重来。
 */
export function buildGrid(level: number, attempt = 0): LevelBlueprint | null {
  const { chapterIndex, indexInChapter, size } = locate(level);
  const plan = PLANS[chapterIndex];
  const t = size <= 1 ? 0 : indexInChapter / (size - 1);
  const rand = mulberry32(level * 7919 + attempt * 104729 + 20250811);
  const { sections, pocket, height } = levelShape(chapterIndex, t);

  const secW = pocket + 1;
  const w = 1 + sections * secW + (sections - 1) + 1;
  const h = height;
  const draft = new Draft(w, h);

  // 1. 挑屏障类型:章节靠前只放前几种,越往后花样越多
  const usable = plan.types.filter((ty) => !NEEDS_WIDE_POCKET.has(ty) || pocket >= 3);
  if (usable.length === 0) return null;
  const cap = Math.max(1, Math.min(usable.length, 1 + Math.floor(t * usable.length + 0.001)));
  const barriers: BarrierType[] = [];
  let beamUsed = false;
  for (let b = 0; b < sections - 1; b++) {
    let ty = usable[randInt(rand, 0, cap - 1)];
    // 全场只认一束光(发射器一亮,所有光门一起开),所以一关里最多摆一道光门屏障
    if (NEEDS_WIDE_POCKET.has(ty)) {
      if (beamUsed) ty = usable.find((o) => !NEEDS_WIDE_POCKET.has(o)) ?? "split";
      else beamUsed = true;
    }
    barriers.push(ty);
  }

  // 2. 分配机关组编号
  let nextGroup = 0;
  const groups: number[] = barriers.map((ty) => {
    if (!NEEDS_GROUP.has(ty)) return -1;
    const g = nextGroup % 3;
    nextGroup++;
    return g;
  });
  if (nextGroup > 3) return null;

  // 3. 每道屏障的通口行
  const crossRows: number[][] = [];
  for (let b = 0; b < barriers.length; b++) {
    const [rA, rB] = pickRowPair(rand, h);
    crossRows.push(barriers[b] === "open" || barriers[b] === "lift" ? [rA] : [rA, rB]);
  }

  // 4. 段的坐标与开放行
  const secs: SectionPlan[] = [];
  for (let s = 0; s < sections; s++) {
    const x0 = 1 + s * (secW + 1);
    const x1 = x0 + secW - 1;
    const open: number[] = [];
    if (s > 0) open.push(...crossRows[s - 1]);
    if (s < sections - 1) open.push(...crossRows[s]);
    if (s === sections - 1) open.push(1, h - 2);
    const openRows = uniqueSorted(open);
    const freeRows: number[] = [];
    for (let y = 1; y <= h - 2; y++) if (!openRows.includes(y)) freeRows.push(y);
    secs.push({ x0, x1, openRows, freeRows });
  }

  // 5. 挖出保底通路:最左一列整列 + 每条开放行整行
  for (const sec of secs) {
    for (let y = 1; y <= h - 2; y++) draft.set(sec.x0, y, ".");
    for (const y of sec.openRows) {
      for (let x = sec.x0; x <= sec.x1; x++) draft.set(x, y, ".");
    }
  }

  // 6. 屏障本体 + 各自要在段里摆的东西
  const requests: ItemRequest[][] = secs.map(() => []);
  for (let b = 0; b < barriers.length; b++) {
    const ty = barriers[b];
    const g = groups[b];
    const bx = secs[b].x1 + 1;
    const [rA, rB] = [crossRows[b][0], crossRows[b][1] ?? crossRows[b][0]];
    if (plan.slimeWalls) {
      for (let y = 1; y <= h - 2; y++) draft.set(bx, y, "%");
    }
    switch (ty) {
      case "open":
        draft.set(bx, rA, ".");
        break;
      case "split":
        draft.set(bx, rA, "~");
        draft.set(bx, rB, "^");
        break;
      case "plateIce":
        draft.set(bx, rA, GATE_CH[g]);
        draft.set(bx, rB, "^");
        requests[b].push({ kind: "plate", group: g });
        break;
      case "plateFire":
        draft.set(bx, rA, "~");
        draft.set(bx, rB, GATE_CH[g]);
        requests[b].push({ kind: "plate", group: g });
        break;
      case "lever":
        draft.set(bx, rA, GATE_CH[g]);
        draft.set(bx, rB, "%");
        requests[b].push({ kind: "lever", group: g });
        break;
      case "seesaw":
        draft.set(bx, rA, GATE_CH[g]);
        draft.set(bx, rB, SEESAW_CH[g]);
        requests[b].push({ kind: "lever", group: g });
        break;
      case "belt":
        // 去程:从段内一路滑到下一段;回程只在屏障上留一格,免得挡住最左那一列
        for (let x = secs[b].x0 + 1; x <= secs[b].x1; x++) draft.set(x, rA, ">");
        draft.set(bx, rA, ">");
        draft.set(bx, rB, "<");
        break;
      case "lift":
        draft.set(bx, rA, "H");
        requests[b].push({ kind: "pad" });
        requests[b + 1].push({ kind: "pad" });
        break;
      case "beamPlate":
        draft.set(bx, rA, "D");
        draft.set(bx, rB, b % 2 === 0 ? "~" : "^");
        requests[b].push({ kind: "beamRig", group: g });
        requests[b].push({ kind: "plate", group: g });
        break;
      case "beamMirror":
        draft.set(bx, rA, "D");
        draft.set(bx, rB, "%");
        requests[b].push({ kind: "mirrorRig" });
        break;
      default:
        return null;
    }
  }

  // 7. 把机关摆进空闲行的口袋里(口袋从最左那一列进,是条死胡同)
  const usedRows: Set<number>[] = secs.map(() => new Set<number>());
  for (let s = 0; s < sections; s++) {
    const sec = secs[s];
    for (const req of requests[s]) {
      if (req.kind === "mirrorRig") {
        const pair = findMirrorRows(sec, usedRows[s]);
        if (!pair) return null;
        const [y1, y2] = pair;
        usedRows[s].add(y1);
        usedRows[s].add(y2);
        draft.set(sec.x0 + 1, y1, "e");
        draft.set(sec.x0 + 2, y1, ".");
        draft.set(sec.x1, y1, "\\");
        draft.set(sec.x1, y2, "/");
        draft.set(sec.x0 + 2, y2, ".");
        draft.set(sec.x0 + 1, y2, "R");
        // 竖着这一段是光的通道,该挖开的挖开(碰上开放行就保持原样)
        for (let y = y1 + 1; y < y2; y++) {
          if (draft.get(sec.x1, y) === "#") draft.set(sec.x1, y, ".");
        }
        continue;
      }
      const y = takeFreeRow(sec, usedRows[s]);
      if (y < 0) return null;
      if (req.kind === "plate") {
        draft.set(sec.x0 + 1, y, PLATE_CH[req.group]);
      } else if (req.kind === "lever") {
        draft.set(sec.x0 + 1, y, LEVER_CH[req.group]);
      } else if (req.kind === "pad") {
        draft.set(sec.x0 + 1, y, "t");
      } else {
        if (sec.x1 - sec.x0 < 3) return null;
        draft.set(sec.x0 + 1, y, "e");
        draft.set(sec.x0 + 2, y, GATE_CH[req.group]);
        draft.set(sec.x1, y, "R");
      }
    }
  }

  // 8. 剩下的口袋拿来放宝石与装饰;按「一段一颗」轮着发,免得宝石全挤在第一段
  const pockets: Array<{ s: number; y: number }> = [];
  const cursors = secs.map(() => 0);
  for (let guard = 0; guard < sections * h; guard++) {
    let any = false;
    for (let s = 0; s < sections; s++) {
      const sec = secs[s];
      while (cursors[s] < sec.freeRows.length && usedRows[s].has(sec.freeRows[cursors[s]])) cursors[s]++;
      if (cursors[s] >= sec.freeRows.length) continue;
      if (sec.x1 - sec.x0 >= 2) pockets.push({ s, y: sec.freeRows[cursors[s]] });
      cursors[s]++;
      any = true;
    }
    if (!any) break;
  }

  const gemTarget = 2 + Math.round(t * 2) + (chapterIndex >= 4 ? 1 : 0);
  let gems = 0;
  for (const { s, y } of pockets) {
    const sec = secs[s];
    usedRows[s].add(y);
    // 出发点就在最左那一列,紧挨着它的口袋不摆水火,免得刚上手就被弹回来
    const nextToSpawn = s === 0 && (y === 1 || y === h - 2);
    if (gems < gemTarget) {
      const roll = nextToSpawn ? 2 : randInt(rand, 0, 2);
      const guard = roll === 0 ? "~" : roll === 1 ? "^" : ".";
      const gem = roll === 0 ? "o" : roll === 1 ? "*" : "+";
      for (let x = sec.x0 + 1; x < sec.x1; x++) draft.set(x, y, guard);
      draft.set(sec.x1, y, gem);
      gems++;
    } else if (plan.slimeWalls && !nextToSpawn && randInt(rand, 0, 2) === 0) {
      for (let x = sec.x0 + 1; x <= sec.x1; x++) draft.set(x, y, "%");
    } else if (randInt(rand, 0, 3) === 0) {
      for (let x = sec.x0 + 1; x <= sec.x1; x++) draft.set(x, y, ".");
    }
  }

  // 9. 出发点与两扇门
  draft.set(1, 1, "L");
  draft.set(1, h - 2, "Y");
  const last = secs[sections - 1];
  draft.set(last.x1, 1, "l");
  draft.set(last.x1, h - 2, "y");

  const hint = barriers.map((ty) => BARRIER_HINTS[ty]).join(" ");
  return { grid: draft.rows(), barriers, hint };
}

function takeFreeRow(sec: SectionPlan, used: Set<number>): number {
  for (const y of sec.freeRows) {
    if (!used.has(y)) {
      used.add(y);
      return y;
    }
  }
  return -1;
}

/** 斜镜要上下两条空闲行,中间至少隔一行,好让光竖着走一段 */
function findMirrorRows(sec: SectionPlan, used: Set<number>): [number, number] | null {
  for (const y1 of sec.freeRows) {
    if (used.has(y1)) continue;
    for (const y2 of sec.freeRows) {
      if (y2 - y1 >= 2 && !used.has(y2)) return [y1, y2];
    }
  }
  return null;
}

function locate(level: number): { chapterIndex: number; indexInChapter: number; size: number } {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (level < acc + CHAPTERS[i].size) {
      return { chapterIndex: i, indexInChapter: level - acc, size: CHAPTERS[i].size };
    }
    acc += CHAPTERS[i].size;
  }
  const lastIdx = CHAPTERS.length - 1;
  return { chapterIndex: lastIdx, indexInChapter: CHAPTERS[lastIdx].size - 1, size: CHAPTERS[lastIdx].size };
}

/** 兜底关:一条平直的小路,两人各走一边,怎么算都有解 */
export function fallbackBlueprint(): LevelBlueprint {
  return {
    grid: [
      "###########",
      "#L...~...l#",
      "#....+....#",
      "#Y...^...y#",
      "###########",
    ],
    barriers: ["split"],
    hint: BARRIER_HINTS.split,
  };
}

// ---------------------------------------------------------------------------
// 逐关分析(生成 → 求解 → 定三星线)
// ---------------------------------------------------------------------------

export interface LevelAnalysis {
  level: number;
  grid: string[];
  barriers: BarrierType[];
  hint: string;
  /** BFS 求出的最优联合步数 */
  steps: number;
  totalGems: number;
  limitSeconds: number;
  /** 换了几次种子才拼成 */
  attempts: number;
  /** 有没有掉进兜底关 */
  fallback: boolean;
}

const ANALYSIS_CACHE = new Map<number, LevelAnalysis>();

/** 生成器最多换几次种子 */
export const MAX_ATTEMPTS = 12;

function analyzeBlueprint(bp: LevelBlueprint): { parsed: ParsedLevel; steps: number } | null {
  let parsed: ParsedLevel;
  try {
    parsed = parseLevel(bp.grid);
  } catch {
    return null;
  }
  const res = solveLevel(parsed);
  if (!res.solvable) return null;
  if (!gemsAllReachable(parsed, res)) return null;
  return { parsed, steps: res.steps };
}

/**
 * 拿到某一关的完整信息:字符网格 + 最优步数 + 三星线。
 * 结果按关号缓存(纯函数,同一关每次都一样);运行时要改地格的话
 * 请自己用 `parseLevel(analysis.grid)` 现解一份,别动缓存里的东西。
 */
export function analyzeLevel(level: number): LevelAnalysis {
  const cached = ANALYSIS_CACHE.get(level);
  if (cached) return cached;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const bp = buildGrid(level, attempt);
    if (!bp) continue;
    const ok = analyzeBlueprint(bp);
    if (!ok) continue;
    const out: LevelAnalysis = {
      level,
      grid: bp.grid,
      barriers: bp.barriers,
      hint: bp.hint,
      steps: ok.steps,
      totalGems: ok.parsed.gems.length,
      limitSeconds: timeLimitSeconds(ok.steps),
      attempts: attempt + 1,
      fallback: false,
    };
    ANALYSIS_CACHE.set(level, out);
    return out;
  }

  const bp = fallbackBlueprint();
  const ok = analyzeBlueprint(bp);
  const steps = ok ? ok.steps : 24;
  const out: LevelAnalysis = {
    level,
    grid: bp.grid,
    barriers: bp.barriers,
    hint: bp.hint,
    steps,
    totalGems: ok ? ok.parsed.gems.length : 1,
    limitSeconds: timeLimitSeconds(steps),
    attempts: MAX_ATTEMPTS,
    fallback: true,
  };
  ANALYSIS_CACHE.set(level, out);
  return out;
}

/** 仅供测试:清空缓存 */
export function resetAnalysisCache(): void {
  ANALYSIS_CACHE.clear();
}

// ---------------------------------------------------------------------------
// 攻略
// ---------------------------------------------------------------------------

export const GUIDE: GuideBook = {
  gameId: "ice-fire-forest",
  title: "冰冰火火森林 · 通关笔记",
  general: [
    "凛凛只趟冰水潭,焰焰只踩岩浆池,绿黏液谁都别碰;碰错了不会怎样,就是要弹回来、少一颗心。",
    "两个人**同时**站在自己的门上才算过关,先到的那位在门口等一会儿就行。",
    "每一段最左边那一整列永远是通的,迷路了就先横着回到那一列,再重新找路。",
    "三星要求把宝石收齐,所以先绕路捡东西、最后再一起进门,顺序反了就得重来。",
    "单人玩按 Tab 换人;两个人玩的话,凛凛用 W A S D、焰焰用方向键,互不打架。",
  ],
  entries: [
    {
      from: 1,
      to: 24,
      title: "晨露林 · 认路",
      tips: [
        "看清哪一格是冰水、哪一格是岩浆,颜色不一样:冰水偏蓝,岩浆偏橘。",
        "先各走各的,把路走顺;宝石一般藏在冰水或岩浆守着的死胡同尽头。",
      ],
    },
    {
      from: 25,
      to: 48,
      title: "熔岩洞 · 踏板",
      tips: [
        "踏板要一直被人压着才通电,人一走开石闸门立刻关上。",
        "标准打法:先让一个人站上踏板,另一个人穿过闸门,然后压踏板的那位再走自己的水火通道。",
      ],
    },
    {
      from: 49,
      to: 72,
      title: "机关工坊 · 拉杆与跷跷门",
      tips: [
        "拉杆是「踩一下换一次」,踩上去就变,退回来不会再变回去。",
        "跷跷门和石闸门永远相反:一个开着,另一个一定关着,所以只能一个一个过。",
        "顺序想反了也不要紧,回到拉杆再踩一下就换回来了。",
      ],
    },
    {
      from: 73,
      to: 96,
      title: "转轮长廊 · 传送带",
      tips: [
        "传送带一踏上就滑到底,中途停不下来,所以上带子之前先把这一段的宝石捡完。",
        "回程只有屏障上那窄窄一格,别指望原路折返。",
      ],
    },
    {
      from: 97,
      to: 119,
      title: "幽绿沼泽 · 窄道",
      tips: [
        "绿黏液把通道挤得很窄,走之前先用眼睛把整条路描一遍再动手。",
        "这一章会把前面所有机关混着用,看到闸门先找它的踏板或拉杆是哪一组。",
      ],
    },
    {
      from: 120,
      to: 142,
      title: "镜光殿 · 光束",
      tips: [
        "光束打到接收器,光门才开;斜镜负责把光拐弯。",
        "人是会挡光的:光门突然关上,多半是同伴正好站在光路上。",
        "光路上还横着石闸门的那种,得先有人压住踏板把闸门打开,光才过得去。",
      ],
    },
    {
      from: 143,
      to: 165,
      title: "云端遗迹 · 托举",
      tips: [
        "高坎要同伴踩在托举点上才上得去,而高坎两边各有一个托举点。",
        "标准打法:甲踩左边托举点 → 乙翻过高坎 → 乙走到右边托举点 → 甲再翻过去。",
      ],
    },
    {
      from: 166,
      to: 188,
      title: "冰火之心 · 综合",
      tips: [
        "路线长,先站着不动把整张图看一遍,想好谁负责压踏板、谁负责先过。",
        "时间只影响星数,不影响能不能过,想清楚再走反而更快。",
      ],
    },
  ],
};
