/**
 * 王子公主大冒险 · 无尽「城堡塔」(纯数据生成 + 可过性校验,不碰 DOM)。
 *
 * 1.1 的无尽是把战役那个随机撒点器换了个种子再跑一遍:能不能过全靠几何红线兜底,
 * 撒完还得 `trimSpikes / trimEnemies` 回头擦屁股。1.2 换成**模板 + 必过窗口**:
 *
 *  1. 一层塔 = 起跑台 + 若干**模板段** + 出口台。模板一共七种
 *     (巡逻厅 / 断口连跳 / 平台阶梯 / 尖刺走廊 / 浮台风口 / 高空龛 / 炮台哨位);
 *  2. 每一段自己声明一条**必过窗口**(`PassWindow`):从哪儿走到哪儿、是平走 `walk`、
 *     跨断口 `hop` 还是踩台阶 `climb`。窗口首尾相接、覆盖整层,才算这一层「有路可走」;
 *  3. `validateFloor` 逐条核对:窗口连不连得上、断口宽不宽过红线、落脚点是不是干净实地、
 *     尖刺跨不跨得过、平台抬升超没超王子的极限、地面怪的巡逻段有没有踩空。
 *
 * 所以「随机 2000 段全部可过」不是跑 2000 局机器人赌出来的,是 2000 段全过静态校验——
 * 用例真的会把 2000 段挨个validate一遍(`tower.test.ts`)。
 *
 * 层数(不是分数)记进 `save.recordEndlessBest("prince-princess", n)`。
 */
import { mulberry32, randInt } from "../level99";
import {
  GOAL_INSET,
  LANDING_PAD,
  MAX_GAP,
  MAX_PLATFORM_RISE,
  MAX_SPIKE_RUN,
  MIN_GAP,
  SPIKE_CLEAR,
  START_PAD,
} from "./geometry";
import type { EnemyDef, EnemyKind, Gap, GemDef, PlatformDef, SpikeDef } from "./levels";

/** 必过窗口的一段:平走 / 跨断口 / 踩台阶 */
export type WindowKind = "walk" | "hop" | "climb";

export interface PassWindow {
  x0: number;
  x1: number;
  kind: WindowKind;
  /** hop:这一跳要跨多宽;climb:要抬多高。walk 恒为 0 */
  span: number;
}

export interface TowerPiece {
  /** 模板名(校验报错时好认) */
  name: string;
  len: number;
  gaps: Gap[];
  platforms: PlatformDef[];
  spikes: SpikeDef[];
  enemies: EnemyDef[];
  gems: GemDef[];
  windows: PassWindow[];
}

export interface TowerFloor {
  /** 第几层(0 基) */
  floor: number;
  len: number;
  goalX: number;
  gaps: Gap[];
  platforms: PlatformDef[];
  spikes: SpikeDef[];
  enemies: EnemyDef[];
  gems: GemDef[];
  windows: PassWindow[];
  /** 这一层用了哪几张模板 */
  pieces: string[];
}

/** 出口台前后这么宽必须是干净实地 */
const EXIT_PAD = 90;

/**
 * 高空宝石比落脚的台子高多少。
 *
 * 王子从台上跳起来,脚最高到台面上方 `jumpApex("prince")≈109`,拾取判定还能往上够 70,
 * 所以 200 这个数把他挡在外面(还剩 20 出头的富余);
 * 公主二段跳脚最高到 `doubleJumpApex()≈161`,加 70 是 231 —— 稳稳够得着。
 * `tower.test.ts` 拿真实物理常量把这两条都算了一遍,改了物理常量会当场红。
 */
export const SKY_GEM_RISE = 200;

// ---------------------------------------------------------------------------
// 模板
// ---------------------------------------------------------------------------

interface PieceCtx {
  rand: () => number;
  /** 0..1,越大越挤越快 */
  diff: number;
  /** 这一层允许出场的怪 */
  kinds: EnemyKind[];
}

function walkWindow(x0: number, x1: number): PassWindow {
  return { x0, x1, kind: "walk", span: 0 };
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function enemySpeed(diff: number): number {
  return 42 + Math.round(diff * 44);
}

/** 巡逻厅:一段平地 + 一两只地面怪 + 宝石。最好懂的一段,永远排得进 */
function hall(ctx: PieceCtx): TowerPiece {
  const len = randInt(ctx.rand, 380, 520);
  const foes = ctx.diff > 0.5 ? 2 : 1;
  const enemies: EnemyDef[] = [];
  for (let i = 0; i < foes; i++) {
    const x = 110 + i * 190;
    const span = Math.min(60, (len - x - 90) / 2, x - 40);
    if (span < 12) continue;
    const kind = pick(ctx.rand, ctx.kinds.filter((k) => k !== "turret"));
    enemies.push({
      kind,
      x,
      minX: x - span,
      maxX: x + span,
      speed: enemySpeed(ctx.diff),
      y: kind === "bat" || kind === "ghost" ? -randInt(ctx.rand, 46, 96) : 0,
    });
  }
  return {
    name: "巡逻厅",
    len,
    gaps: [],
    platforms: [],
    spikes: [],
    enemies,
    gems: [{ x: len * 0.5, y: -46, ground: true }],
    windows: [walkWindow(0, len)],
  };
}

/** 断口连跳:一到两个断口,两头都留干净的起跳台与落脚点,对面各摆一颗宝石 */
function hops(ctx: PieceCtx): TowerPiece {
  const count = ctx.diff > 0.55 ? 2 : 1;
  const gaps: Gap[] = [];
  const gems: GemDef[] = [];
  const windows: PassWindow[] = [];
  let x = LANDING_PAD;
  windows.push(walkWindow(0, x));
  for (let i = 0; i < count; i++) {
    const w = randInt(ctx.rand, MIN_GAP, Math.min(MAX_GAP, 74 + Math.round(ctx.diff * 40)));
    gaps.push({ x0: x, x1: x + w });
    windows.push({ x0: x, x1: x + w, kind: "hop", span: w });
    gems.push({ x: x + w + 34, y: -48, ground: true });
    const rest = LANDING_PAD + randInt(ctx.rand, 40, 110);
    windows.push(walkWindow(x + w, x + w + rest));
    x += w + rest;
  }
  return { name: "断口连跳", len: x + LANDING_PAD, gaps, platforms: [], spikes: [], enemies: [], gems, windows: [...windows, walkWindow(x, x + LANDING_PAD)] };
}

/** 平台阶梯:两级实心台阶,台上各一颗宝石;地面是通的,不想爬也能走过去 */
function stairs(ctx: PieceCtx): TowerPiece {
  const y1 = -randInt(ctx.rand, 50, 66);
  const y2 = -randInt(ctx.rand, 68, MAX_PLATFORM_RISE);
  const w1 = randInt(ctx.rand, 120, 160);
  const w2 = randInt(ctx.rand, 110, 150);
  // 段长必须由台阶自己撑出来:先随机长度再摆台阶的话,两级台阶摆得宽一点就会顶出段尾,
  // 末尾那扇「走到段尾」的窗口长度会变成负的。
  const len = 90 + w1 + 46 + w2 + randInt(ctx.rand, 90, 150);
  return {
    name: "平台阶梯",
    len,
    gaps: [],
    platforms: [
      { x: 90, y: y1, w: w1, kind: "solid" },
      { x: 90 + w1 + 46, y: y2, w: w2, kind: "solid" },
    ],
    spikes: [],
    enemies: [],
    gems: [
      { x: 90 + w1 * 0.5, y: y1 - 40, ground: false },
      { x: 90 + w1 + 46 + w2 * 0.5, y: y2 - 40, ground: false },
    ],
    windows: [
      walkWindow(0, 90),
      { x0: 90, x1: 90 + w1, kind: "climb", span: -y1 },
      { x0: 90 + w1, x1: 90 + w1 + 46 + w2, kind: "climb", span: -y2 },
      walkWindow(90 + w1 + 46 + w2, len),
    ],
  };
}

/** 尖刺走廊:一到两段尖刺,每段都比一跳窄,两头留干净地 */
function spikeHall(ctx: PieceCtx): TowerPiece {
  const count = ctx.diff > 0.6 ? 2 : 1;
  const spikes: SpikeDef[] = [];
  const windows: PassWindow[] = [];
  let x = SPIKE_CLEAR;
  windows.push(walkWindow(0, x));
  for (let i = 0; i < count; i++) {
    const w = randInt(ctx.rand, 40, MAX_SPIKE_RUN);
    spikes.push({ x, w });
    windows.push({ x0: x, x1: x + w, kind: "hop", span: w });
    windows.push(walkWindow(x + w, x + w + SPIKE_CLEAR + 40));
    x += w + SPIKE_CLEAR + 40;
  }
  return { name: "尖刺走廊", len: x + SPIKE_CLEAR, gaps: [], platforms: [], spikes, enemies: [], gems: [{ x: x + 20, y: -46, ground: true }], windows: [...windows, walkWindow(x, x + SPIKE_CLEAR)] };
}

/** 浮台风口:一块飘来飘去的浮台 + 台上宝石;下面的地面是完整的,掉下来也不亏 */
function windPlat(ctx: PieceCtx): TowerPiece {
  const len = randInt(ctx.rand, 380, 480);
  const w = randInt(ctx.rand, 110, 150);
  const y = -randInt(ctx.rand, 56, MAX_PLATFORM_RISE);
  const range = randInt(ctx.rand, 40, 76);
  return {
    name: "浮台风口",
    len,
    gaps: [],
    platforms: [{ x: 120, y, w, kind: "move", range, speed: 40 + randInt(ctx.rand, 0, 26) }],
    spikes: [],
    enemies: [],
    gems: [{ x: 120 + w * 0.5, y: y - 42, ground: false }],
    windows: [walkWindow(0, 120), { x0: 120, x1: 120 + w, kind: "climb", span: -y }, walkWindow(120 + w, len)],
  };
}

/** 高空龛:一块实心台 + 台子上方一颗「只有公主够得着」的高空宝石 */
function skyNiche(ctx: PieceCtx): TowerPiece {
  const len = randInt(ctx.rand, 360, 440);
  const w = randInt(ctx.rand, 130, 170);
  const y = -randInt(ctx.rand, 70, MAX_PLATFORM_RISE);
  return {
    name: "高空龛",
    len,
    gaps: [],
    platforms: [{ x: 100, y, w, kind: "solid" }],
    spikes: [],
    enemies: [],
    gems: [
      { x: 100 + w * 0.4, y: y - 36, ground: false },
      // 高空那一颗:比王子从台上跳起来还高一截,只有公主的二段跳 + 滑翔够得着
      { x: 100 + w * 0.9, y: y - SKY_GEM_RISE, ground: false },
    ],
    windows: [walkWindow(0, 100), { x0: 100, x1: 100 + w, kind: "climb", span: -y }, walkWindow(100 + w, len)],
  };
}

/** 炮台哨位:一座炮台 + 一块挡弹的台子 */
function turretPost(ctx: PieceCtx): TowerPiece {
  const len = randInt(ctx.rand, 380, 460);
  const y = -randInt(ctx.rand, 54, 74);
  return {
    name: "炮台哨位",
    len,
    gaps: [],
    platforms: [{ x: 96, y, w: 126, kind: "solid" }],
    spikes: [],
    enemies: [{ kind: "turret", x: len - 110, minX: len - 110, maxX: len - 110, speed: 0, y: 0 }],
    gems: [{ x: 96 + 63, y: y - 40, ground: false }],
    windows: [walkWindow(0, 96), { x0: 96, x1: 96 + 126, kind: "climb", span: -y }, walkWindow(96 + 126, len)],
  };
}

type Template = (ctx: PieceCtx) => TowerPiece;

/** 七张模板。`hall` 权重高一点,免得一层全是机关没地方喘气 */
export const TEMPLATES: Array<{ name: string; make: Template; minDiff: number }> = [
  { name: "巡逻厅", make: hall, minDiff: 0 },
  { name: "断口连跳", make: hops, minDiff: 0 },
  { name: "平台阶梯", make: stairs, minDiff: 0 },
  { name: "高空龛", make: skyNiche, minDiff: 0 },
  { name: "浮台风口", make: windPlat, minDiff: 0.15 },
  { name: "尖刺走廊", make: spikeHall, minDiff: 0.3 },
  { name: "炮台哨位", make: turretPost, minDiff: 0.4 },
];

export const TEMPLATE_NAMES = TEMPLATES.map((t) => t.name);

// ---------------------------------------------------------------------------
// 拼层
// ---------------------------------------------------------------------------

/** 这一层允许出场的怪:越高层认识的怪越多 */
export function kindsForFloor(floor: number): EnemyKind[] {
  const out: EnemyKind[] = ["slime"];
  if (floor >= 1) out.push("bat");
  if (floor >= 3) out.push("armor");
  if (floor >= 5) out.push("ghost");
  if (floor >= 7) out.push("turret");
  return out;
}

function shift(piece: TowerPiece, dx: number): TowerPiece {
  return {
    name: piece.name,
    len: piece.len,
    gaps: piece.gaps.map((g) => ({ x0: g.x0 + dx, x1: g.x1 + dx })),
    platforms: piece.platforms.map((p) => ({ ...p, x: p.x + dx })),
    spikes: piece.spikes.map((s) => ({ ...s, x: s.x + dx })),
    enemies: piece.enemies.map((e) => ({ ...e, x: e.x + dx, minX: e.minX + dx, maxX: e.maxX + dx })),
    gems: piece.gems.map((g) => ({ ...g, x: g.x + dx })),
    windows: piece.windows.map((w) => ({ ...w, x0: w.x0 + dx, x1: w.x1 + dx })),
  };
}

/**
 * 拼出第 `floor` 层(0 基)。同一层号每次拼出来的结果完全一样。
 *
 * 长度按层数往上走,但一层顶多这么长 —— 再长孩子一口气跑不完。
 */
export function buildTowerFloor(floor: number): TowerFloor {
  const f = Math.max(0, Math.round(floor));
  return buildWithSeed(f, mulberry32(0x7c0000 + f * 104729 + 17));
}

/**
 * 拿一个自己给的种子拼一层 —— 用例靠它把「随机 2000 段」真的随机出来,
 * 而不是把同一层重复算 2000 遍。
 */
export function buildTowerFloorSeeded(floor: number, seed: number): TowerFloor {
  return buildWithSeed(Math.max(0, Math.round(floor)), mulberry32(seed >>> 0));
}

function buildWithSeed(f: number, rand: () => number): TowerFloor {
  const diff = Math.min(1, f / 14);
  const kinds = kindsForFloor(f);
  const target = 1500 + Math.min(1500, f * 150);

  const pieces: TowerPiece[] = [];
  let x = START_PAD;
  let guard = 0;
  while (x - START_PAD < target && guard++ < 24) {
    const usable = TEMPLATES.filter((t) => t.minDiff <= diff);
    // 巡逻厅多来一份权重:纯机关连着排,读起来太紧
    const bag = [...usable, usable[0]];
    const tpl = bag[Math.floor(rand() * bag.length)];
    const piece = shift(tpl.make({ rand, diff, kinds }), x);
    pieces.push(piece);
    x += piece.len;
  }

  const tailPad = EXIT_PAD + GOAL_INSET;
  const len = Math.round(x + tailPad);
  const floorDef: TowerFloor = {
    floor: f,
    len,
    goalX: len - GOAL_INSET,
    gaps: pieces.flatMap((p) => p.gaps),
    platforms: pieces.flatMap((p) => p.platforms),
    spikes: pieces.flatMap((p) => p.spikes),
    enemies: pieces.flatMap((p) => p.enemies),
    gems: pieces.flatMap((p) => p.gems),
    windows: [walkWindow(0, START_PAD), ...pieces.flatMap((p) => p.windows), walkWindow(x, len)],
    pieces: pieces.map((p) => p.name),
  };
  ensureFoes(floorDef, diff, rand);
  return floorDef;
}

/** 这一层至少要有几只怪:一层空跑不算「远征」 */
export function minFoesFor(floor: number): number {
  return Math.min(10, 2 + Math.floor(floor * 0.7));
}

/**
 * 怪太稀就补几只果冻怪,补的位置一定挑「整段巡逻都踩得到实地、旁边没尖刺」的地方,
 * 补完照样过得了 `validateFloor`。
 */
function ensureFoes(f: TowerFloor, diff: number, rand: () => number): void {
  const want = minFoesFor(f.floor);
  const ok = (x: number): boolean =>
    solidAt(f.gaps, f.len, x) && !spikeAt(f.spikes, x) && x > START_PAD + 40 && x < f.goalX - EXIT_PAD - 40;
  let tries = 0;
  while (f.enemies.length < want && tries++ < 80) {
    const x = Math.round(START_PAD + 120 + rand() * Math.max(120, f.goalX - START_PAD - 300));
    if (!ok(x)) continue;
    let span = 56;
    while (span > 0 && !(ok(x - span) && ok(x + span))) span -= 8;
    if (span <= 0) continue;
    if (f.enemies.some((e) => Math.abs(e.x - x) < 90)) continue;
    f.enemies.push({ kind: "slime", x, minX: x - span, maxX: x + span, speed: enemySpeed(diff), y: 0 });
  }
  f.enemies.sort((a, b) => a.x - b.x);
}

// ---------------------------------------------------------------------------
// 必过窗口校验
// ---------------------------------------------------------------------------

function solidAt(gaps: readonly Gap[], len: number, x: number): boolean {
  if (x < 0 || x > len) return false;
  return !gaps.some((g) => x > g.x0 && x < g.x1);
}

function spikeAt(spikes: readonly SpikeDef[], x: number): boolean {
  return spikes.some((s) => x >= s.x - 4 && x <= s.x + s.w + 4);
}

/**
 * 逐条核对这一层能不能走通。返回**问题清单**,空数组就是全过。
 *
 * 校验的是「窗口」这条明路,不是「随便怎么走都行」——
 * 只要这条明路成立,机器人和孩子就都有得走。
 */
export function validateFloor(f: TowerFloor): string[] {
  const bad: string[] = [];
  const at = (x: number): boolean => solidAt(f.gaps, f.len, x);

  // 1. 起跑台与出口台:干净实地,不摆尖刺,不站怪
  for (let x = 0; x <= START_PAD; x += 10) {
    if (!at(x)) bad.push(`起跑台 ${x} 悬空`);
    if (spikeAt(f.spikes, x)) bad.push(`起跑台 ${x} 有尖刺`);
  }
  for (let x = f.goalX - EXIT_PAD; x <= Math.min(f.len, f.goalX + EXIT_PAD); x += 10) {
    if (!at(x)) bad.push(`出口台 ${x} 悬空`);
    if (spikeAt(f.spikes, x)) bad.push(`出口台 ${x} 有尖刺`);
  }

  // 2. 断口:不重叠、宽度在红线内、两头留干净落脚点
  const gaps = [...f.gaps].sort((a, b) => a.x0 - b.x0);
  let prevEnd = -Infinity;
  for (const g of gaps) {
    const w = g.x1 - g.x0;
    if (w < MIN_GAP) bad.push(`断口 ${g.x0} 太窄(${w})`);
    if (w > MAX_GAP) bad.push(`断口 ${g.x0} 超红线(${w})`);
    if (g.x0 <= prevEnd) bad.push(`断口 ${g.x0} 和上一个叠在一起`);
    prevEnd = g.x1;
    for (let d = 4; d <= LANDING_PAD; d += 8) {
      if (!at(g.x0 - d)) bad.push(`断口 ${g.x0} 起跳台悬空`);
      if (!at(g.x1 + d)) bad.push(`断口 ${g.x0} 落脚点悬空`);
      if (spikeAt(f.spikes, g.x0 - d)) bad.push(`断口 ${g.x0} 起跳台有尖刺`);
      if (spikeAt(f.spikes, g.x1 + d)) bad.push(`断口 ${g.x0} 落脚点有尖刺`);
    }
  }

  // 3. 尖刺:一跳跨得过、踩在实地上、两头留干净地
  const spikes = [...f.spikes].sort((a, b) => a.x - b.x);
  let prevSpikeEnd = -Infinity;
  for (const s of spikes) {
    if (s.w <= 0) bad.push(`尖刺 ${s.x} 宽度不对`);
    if (s.w > MAX_SPIKE_RUN) bad.push(`尖刺 ${s.x} 太长(${s.w}),跳不过去`);
    if (s.x <= prevSpikeEnd + SPIKE_CLEAR) bad.push(`尖刺 ${s.x} 离上一段太近`);
    prevSpikeEnd = s.x + s.w;
    for (let d = 4; d <= SPIKE_CLEAR; d += 8) {
      if (!at(s.x - d)) bad.push(`尖刺 ${s.x} 起跳台悬空`);
      if (!at(s.x + s.w + d)) bad.push(`尖刺 ${s.x} 落脚点悬空`);
    }
  }

  // 4. 平台:抬升不超红线、够宽、浮台参数齐全
  for (const p of f.platforms) {
    if (p.y >= 0) bad.push(`平台 ${p.x} 不在空中`);
    if (-p.y > MAX_PLATFORM_RISE) bad.push(`平台 ${p.x} 太高(${-p.y})`);
    if (p.w < 80) bad.push(`平台 ${p.x} 太窄(${p.w})`);
    if (p.kind === "move" && !((p.range ?? 0) > 0 && (p.speed ?? 0) > 0)) {
      bad.push(`浮台 ${p.x} 少了 range / speed`);
    }
  }

  // 5. 地面怪:整段巡逻都得踩得到实地,也不许站在尖刺上
  for (const e of f.enemies) {
    if (e.y < 0) continue;
    for (const probe of [e.minX, e.x, e.maxX]) {
      if (!at(probe)) bad.push(`${e.kind} ${Math.round(e.x)} 巡逻踩空`);
      if (spikeAt(f.spikes, probe)) bad.push(`${e.kind} ${Math.round(e.x)} 站在尖刺上`);
    }
  }

  // 6. 地面宝石站得到
  for (const g of f.gems) {
    if (g.ground && !at(g.x)) bad.push(`宝石 ${Math.round(g.x)} 悬在断口上`);
  }

  // 7. 必过窗口首尾相接,一路铺到出口
  const win = [...f.windows].sort((a, b) => a.x0 - b.x0 || a.x1 - b.x1);
  if (win.length === 0) bad.push("这一层没有必过窗口");
  let reach = 0;
  for (const w of win) {
    if (w.x1 <= w.x0) bad.push(`窗口 ${w.x0} 长度不对`);
    if (w.x0 > reach + 1) bad.push(`窗口在 ${reach} 处断了`);
    if (w.kind === "hop" && w.span > MAX_GAP) bad.push(`窗口 ${w.x0} 这一跳太远(${w.span})`);
    if (w.kind === "climb" && w.span > MAX_PLATFORM_RISE) bad.push(`窗口 ${w.x0} 这一爬太高(${w.span})`);
    reach = Math.max(reach, w.x1);
  }
  if (reach < f.goalX) bad.push(`必过窗口只铺到 ${Math.round(reach)},没到出口 ${Math.round(f.goalX)}`);

  return bad;
}

/** 这一层过不过得去 */
export function floorPassable(f: TowerFloor): boolean {
  return validateFloor(f).length === 0;
}
