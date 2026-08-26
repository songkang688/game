/**
 * 星星射击场的 188 关战役:十个靶场章节,一章一套新机制。
 * 全部靠 `level99.ts` 的确定性随机生成,同一关每次布局一模一样,可测可复现。
 */
import { mulberry32, randInt, type Chapter } from "../level99";
import {
  FIELD_W,
  MUZZLE_X,
  MUZZLE_Y,
  aimToVelocity,
  makeTarget,
  traceShot,
  type Block,
  type Target,
  type TargetKind,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "新手靶场", emoji: "🎯", color: "#FFE1EC", desc: "先熟悉准星和换弹,靶子都乖乖站着。", size: 18 },
  { name: "气球花园", emoji: "🎈", color: "#FFEFD6", desc: "气球一路往上飘,要算好提前量。", size: 20 },
  { name: "飞碟夜空", emoji: "🛸", color: "#E4EAFF", desc: "小飞碟横着飘还上下晃,盯住节奏再打。", size: 20 },
  { name: "铁皮工厂", emoji: "🤖", color: "#E2F3E8", desc: "铁皮机器人来回巡逻,打中就摊手坐下。", size: 20 },
  { name: "遮挡迷城", emoji: "🧱", color: "#F3E7DA", desc: "木板会挡住星星弹,得找没被挡住的角度。", size: 20 },
  { name: "编号挑战", emoji: "🔢", color: "#E7F0FB", desc: "靶子带号码,必须从 1 号开始按顺序打。", size: 20 },
  { name: "好人靶训练", emoji: "🙂", color: "#FFF3E1", desc: "举旗子的笑脸是好人靶,看清楚再按发射。", size: 20 },
  { name: "限时竞速", emoji: "⏱️", color: "#FDE6F0", desc: "倒计时开始跑,手快还要手稳。", size: 20 },
  { name: "综合考场", emoji: "📋", color: "#EAE7F8", desc: "前面所有机制混在一起考。", size: 18 },
  { name: "星星大师赛", emoji: "🏆", color: "#FFF0C9", desc: "全机制全开,还要顶住命中率线。", size: 12 },
];

export interface LevelDef {
  /** 0 基关号 */
  level: number;
  chapter: number;
  targets: Target[];
  blocks: Block[];
  /** 限时秒数,0 表示不限时 */
  seconds: number;
  magSize: number;
  reloadTime: number;
  /** 允许打空多少发还能三星(命中率线的通俗说法) */
  parShots: number;
  /** 本关一共能打多少发,打完还没清场就得重来 */
  shotBudget: number;
  /** 本关必须打掉的靶数(好人靶不算) */
  need: number;
  hint: string;
}

/** 每一章的靶子种类池 */
const KIND_POOL: TargetKind[][] = [
  ["bull"],
  ["balloon", "bull"],
  ["ufo", "bull"],
  ["robot", "balloon"],
  ["bull", "balloon", "ufo"],
  ["number"],
  ["bull", "balloon", "friend"],
  ["bull", "balloon", "ufo"],
  ["bull", "balloon", "ufo", "robot"],
  ["bull", "balloon", "ufo", "robot"],
];

const HINTS = [
  "准星对准圆心再按发射,越靠中间环数越高。",
  "气球一直在往上飘,瞄它头顶一点点。",
  "飞碟横着走,等它到画面中间再打最稳。",
  "机器人来回巡逻,在它掉头的一瞬间最好打。",
  "木板挡得住星星弹,换个角度或者等靶子走出来。",
  "从 1 号开始按顺序打,打错顺序会掉连击。",
  "举小旗子的笑脸是好人靶,千万别碰它。",
  "倒计时在跑,但抢时间反而更容易打偏。",
  "什么都可能出现,先扫一眼全场再动手。",
  "大师赛只看命中率,少打一发废弹就多一分把握。",
];

function chapterOfLevel(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

function startOfChapter(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 靶子的活动范围(逻辑坐标),留出天空和地面 */
export const TARGET_BOUNDS = { x0: 70, y0: 70, x1: FIELD_W - 70, y1: 470 };

/** 试瞄的采样点:靶心 + 靶面上几个偏移,用来判断「有没有一条干净的射线」 */
const AIM_SAMPLES: Array<[number, number]> = [
  [0, 0],
  [-0.6, 0],
  [0.6, 0],
  [0, -0.6],
  [0, 0.6],
  [-0.45, -0.45],
  [0.45, -0.45],
  [-0.45, 0.45],
  [0.45, 0.45],
];

/**
 * 这个靶有没有「一条干净的射线」:绕开挡板与好人靶,能打到它自己。
 * 判定时不管别的必打靶——它们会被一个个打掉,不构成永久阻挡。
 * 关卡生成与关卡测试共用这一把尺子。
 */
export function hasCleanShot(target: Target, friends: readonly Target[], blocks: readonly Block[]): boolean {
  const scene = [target, ...friends.filter((f) => f.id !== target.id)];
  for (const [ox, oy] of AIM_SAMPLES) {
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, target.x + ox * target.r, target.y + oy * target.r);
    if (traceShot(shot, scene, blocks).targetId === target.id) return true;
  }
  return false;
}

function speedFor(kind: TargetKind, ci: number, depth: number, rand: () => number): { vx: number; vy: number } {
  const ramp = 1 + depth * 0.7 + ci * 0.06;
  const dir = rand() < 0.5 ? -1 : 1;
  switch (kind) {
    case "balloon":
      return { vx: 0, vy: -(38 + 30 * ramp) };
    case "ufo":
      return { vx: dir * (70 + 55 * ramp), vy: 0 };
    case "robot":
      return { vx: dir * (55 + 45 * ramp), vy: 0 };
    case "number":
      return ci >= 8 ? { vx: dir * (30 + 30 * depth), vy: 0 } : { vx: 0, vy: 0 };
    case "friend":
      return ci >= 6 ? { vx: dir * (34 + 26 * depth), vy: 0 } : { vx: 0, vy: 0 };
    default:
      return ci >= 8 ? { vx: dir * (28 + 30 * depth), vy: 0 } : { vx: 0, vy: 0 };
  }
}

function radiusFor(kind: TargetKind, ci: number, depth: number): number {
  const shrink = 1 - Math.min(0.34, depth * 0.22 + ci * 0.018);
  const base = kind === "bull" ? 46 : kind === "balloon" ? 34 : kind === "ufo" ? 40 : kind === "robot" ? 42 : kind === "number" ? 40 : 38;
  return Math.round(base * shrink);
}

/**
 * 生成第 level 关(0 基)。同一个 level 永远得到同一份布局。
 */
export function buildLevel(level: number): LevelDef {
  const lv = Math.max(0, Math.min(187, Math.floor(level)));
  const ci = chapterOfLevel(lv);
  const inCh = lv - startOfChapter(ci);
  const depth = CHAPTERS[ci].size > 1 ? inCh / (CHAPTERS[ci].size - 1) : 0;
  const rand = mulberry32(0x5ba7 + lv * 2654435761);

  const pool = KIND_POOL[ci];
  const count = Math.min(10, 3 + Math.floor(depth * 3) + Math.floor(ci / 3));
  const targets: Target[] = [];
  let orderSeq = 0;
  // 好人靶最多占三分之一,而且至少留两个必打的靶:不然这一关就没得打了
  const friendCap = ci === 6 || ci >= 8 ? Math.max(1, Math.min(Math.floor(count / 3), count - 2)) : 0;
  let friendUsed = 0;

  // 按列均匀铺开,再在列内随机抖一点,保证不重叠也不整齐得像表格
  const cols = Math.max(2, Math.min(5, Math.ceil(count / 2)));
  for (let i = 0; i < count; i++) {
    let kind = pool[randInt(rand, 0, pool.length - 1)];
    if (ci === 5) kind = "number";
    const wantFriend = (ci === 6 && i % 3 === 2) || (ci >= 8 && rand() < 0.3);
    if (kind === "friend" || wantFriend) {
      // 池子里随机摸到好人靶也要过配额这一关,超了就换成同心圆靶
      kind = friendUsed < friendCap ? "friend" : "bull";
    }
    if (kind === "friend") friendUsed++;

    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellW = (TARGET_BOUNDS.x1 - TARGET_BOUNDS.x0) / cols;
    const x = TARGET_BOUNDS.x0 + cellW * col + cellW * (0.28 + rand() * 0.44);
    const y = TARGET_BOUNDS.y0 + 92 + row * 128 + rand() * 46;
    const r = radiusFor(kind, ci, depth);
    const spd = speedFor(kind, ci, depth, rand);
    const order = kind === "number" ? ++orderSeq : 0;
    targets.push(
      makeTarget(i, kind, Math.round(x), Math.round(Math.min(TARGET_BOUNDS.y1 - r, y)), r, {
        vx: spd.vx,
        vy: spd.vy,
        order,
        phase: rand() * 6,
      })
    );
  }

  // 遮挡木板:第 5 章起登场,后面几章偶尔来一块。
  // 木板只负责「难打」,不负责「打不到」:凡是会把某个必打靶彻底封死的木板一律不要。
  const blocks: Block[] = [];
  const friends = targets.filter((t) => t.kind === "friend");
  const mustHit = targets.filter((t) => t.kind !== "friend");
  const wantBlocks = ci === 4 ? 1 + Math.floor(depth * 2) : ci >= 8 ? (rand() < 0.6 ? 1 : 0) : 0;
  for (let i = 0; i < wantBlocks; i++) {
    // 位置不合适就换个地方再试几次,免得「合法的木板」被一次性否掉、这一章白瞎
    for (let attempt = 0; attempt < 10; attempt++) {
      const w = 90 + Math.round(rand() * 130);
      const h = 26 + Math.round(rand() * 22);
      const x = Math.round(TARGET_BOUNDS.x0 + rand() * (TARGET_BOUNDS.x1 - TARGET_BOUNDS.x0 - w));
      const y = Math.round(240 + rand() * 180);
      const candidate = [...blocks, { x, y, w, h }];
      if (mustHit.every((t) => hasCleanShot(t, friends, candidate))) {
        blocks.push({ x, y, w, h });
        break;
      }
    }
  }

  // 好人靶挡在必打靶正前方同样会把关卡卡死,横着挪开就好(挪不开就撤掉这个好人靶)
  for (let guard = 0; guard < friends.length * 4; guard++) {
    const stuck = mustHit.find((t) => !hasCleanShot(t, friends, blocks));
    if (!stuck) break;
    const culprit = friends.find((f) => f.alive && !hasCleanShot(stuck, [f], blocks));
    if (!culprit) break;
    const shifted = culprit.x + (culprit.x < FIELD_W / 2 ? -110 : 110);
    if (shifted > TARGET_BOUNDS.x0 + culprit.r && shifted < TARGET_BOUNDS.x1 - culprit.r) {
      culprit.x = Math.round(shifted);
    } else {
      culprit.alive = false;
    }
  }
  const dropped = new Set(friends.filter((f) => !f.alive).map((f) => f.id));
  const kept = targets.filter((t) => !dropped.has(t.id));

  const need = kept.filter((t) => t.kind !== "friend").length;
  const timed = ci === 7 || ci >= 8;
  const seconds = timed ? Math.max(16, 40 - Math.floor(depth * 12) - (ci - 7) * 3) : 0;
  const magSize = ci <= 1 ? 8 : ci <= 4 ? 7 : 6;
  const reloadTime = ci <= 2 ? 0.9 : ci <= 6 ? 1.05 : 1.2;
  // 三星线:必打靶数 + 允许的废弹数(越往后越紧)
  const slack = Math.max(1, Math.round(need * (0.5 - Math.min(0.4, ci * 0.045))));

  return {
    level: lv,
    chapter: ci,
    targets: kept,
    blocks,
    seconds,
    magSize,
    reloadTime,
    parShots: need + slack,
    shotBudget: need + slack + Math.max(4, Math.round(need * 0.9)),
    need,
    hint: HINTS[ci],
  };
}

/** 无尽靶潮的一批靶子(纯函数,给定波数与种子就确定) */
export function buildTide(wave: number, kinds: readonly TargetKind[], count: number, speed: number, friendChance: number): Target[] {
  const rand = mulberry32(0x7c31 + wave * 40503);
  const out: Target[] = [];
  const cols = Math.max(2, Math.min(5, Math.ceil(count / 2)));
  for (let i = 0; i < count; i++) {
    const useFriend = rand() < friendChance;
    const kind: TargetKind = useFriend ? "friend" : kinds[randInt(rand, 0, kinds.length - 1)];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellW = (TARGET_BOUNDS.x1 - TARGET_BOUNDS.x0) / cols;
    const x = TARGET_BOUNDS.x0 + cellW * col + cellW * (0.25 + rand() * 0.5);
    const y = TARGET_BOUNDS.y0 + 90 + row * 122 + rand() * 40;
    const r = Math.round((kind === "bull" ? 44 : kind === "balloon" ? 32 : 38) * (1 - Math.min(0.3, wave * 0.015)));
    const dir = rand() < 0.5 ? -1 : 1;
    const vx = kind === "balloon" ? 0 : dir * 60 * speed;
    const vy = kind === "balloon" ? -46 * speed : 0;
    out.push(makeTarget(i, kind, Math.round(x), Math.round(Math.min(TARGET_BOUNDS.y1 - r, y)), r, { vx, vy, phase: rand() * 6 }));
  }
  return out;
}

/** 双人分屏对战用的一批靶子:两边完全一样,比的是手 */
export function buildDuelTargets(round: number, count = 8): Target[] {
  const rand = mulberry32(0x2f19 + round * 9176);
  const kinds: TargetKind[] = ["bull", "balloon", "ufo", "robot"];
  const out: Target[] = [];
  const cols = 4;
  for (let i = 0; i < count; i++) {
    const kind = kinds[randInt(rand, 0, kinds.length - 1)];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellW = (TARGET_BOUNDS.x1 - TARGET_BOUNDS.x0) / cols;
    const x = TARGET_BOUNDS.x0 + cellW * col + cellW * (0.3 + rand() * 0.4);
    const y = TARGET_BOUNDS.y0 + 110 + row * 130;
    const r = kind === "bull" ? 44 : kind === "balloon" ? 32 : 38;
    const dir = rand() < 0.5 ? -1 : 1;
    const vx = kind === "balloon" ? 0 : dir * (50 + rand() * 50);
    const vy = kind === "balloon" ? -50 : 0;
    out.push(makeTarget(i, kind, Math.round(x), Math.round(y), r, { vx, vy, phase: rand() * 6 }));
  }
  return out;
}
