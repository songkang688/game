// 泡泡瞄准手 · 1.2 手感层:瞄准线预览、角度微调、真掉落物理、连锁分、换弹与炸弹泡、无尽墙。
//
// 全是纯函数,不碰 DOM。1.1 的 logic.ts 管网格与弹道,这一层管「看得清、瞄得准、掉得真」。
import {
  H,
  R,
  RAINBOW,
  W,
  cellCenter,
  colorsInGrid,
  findFloating,
  isStone,
  neighbors,
  rowLen,
  rowLength,
  type Cell,
  type Grid,
  type SettleResult,
} from "./logic";

// ---------------------------------------------------------------------------
// 一、瞄准线预览
// ---------------------------------------------------------------------------

/** 预览最多显示到第几次反弹(只给第一段反射,不把整条解喂给小朋友) */
export const PREVIEW_MAX_BOUNCES = 1;
/** 预览虚线最长这么长(场景单位),再远也不画 */
export const PREVIEW_MAX_LEN = 300;

/**
 * 把 simulateShot 算出来的完整弹道剪成一小段预览:
 * 最多带一次墙面反射,而且总长有限 —— 看得见方向,又不至于把落点直接告诉你。
 */
export function previewPath(
  path: ReadonlyArray<{ x: number; y: number }>,
  maxBounces: number = PREVIEW_MAX_BOUNCES,
  maxLen: number = PREVIEW_MAX_LEN
): Array<{ x: number; y: number }> {
  if (path.length === 0) return [];
  const keep = Math.min(path.length - 1, Math.max(0, maxBounces) + 1);
  const out: Array<{ x: number; y: number }> = [{ x: path[0].x, y: path[0].y }];
  let budget = Math.max(0, maxLen);
  for (let i = 1; i <= keep; i++) {
    const from = out[out.length - 1];
    const to = path[i];
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len <= budget) {
      out.push({ x: to.x, y: to.y });
      budget -= len;
      continue;
    }
    const k = len > 0 ? budget / len : 0;
    out.push({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    return out;
  }
  return out;
}

/** 预览这条线一共有多长(单测拿它卡「不给完整解」) */
export function pathLength(path: ReadonlyArray<{ x: number; y: number }>): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) {
    sum += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// 二、角度与微调
// ---------------------------------------------------------------------------

/** 只能往上打:太贴近水平的角度会被夹住 */
export const MIN_AIM_DEG = 8;
export const MAX_AIM_DEG = 172;

/** 手指离发射台多远才开始变精细 */
export const FINE_FROM = 60;
export const COARSE_STEP_DEG = 3;
export const FINE_STEP_DEG = 0.25;

/** 手指指到哪个角度(度,0 是正右,90 是正上);指到发射台下面返回 null */
export function aimAngleDeg(sx: number, sy: number, px: number, py: number): number | null {
  const dx = px - sx;
  const dy = py - sy;
  if (dy > -24) return null;
  const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  return Math.max(MIN_AIM_DEG, Math.min(MAX_AIM_DEG, deg));
}

/** 拖得越远,一格微调就越小 —— 远端 1px 抖动不再让弹道乱飞 */
export function angleStepDeg(distance: number): number {
  if (!(distance > FINE_FROM)) return COARSE_STEP_DEG;
  const k = Math.min(1, (distance - FINE_FROM) / 220);
  return Math.max(FINE_STEP_DEG, COARSE_STEP_DEG - (COARSE_STEP_DEG - FINE_STEP_DEG) * k);
}

/** 按当前精度把角度吸附到最近的一格 */
export function snapAimAngle(deg: number, distance: number): number {
  const step = angleStepDeg(distance);
  const snapped = Math.round(deg / step) * step;
  return Math.max(MIN_AIM_DEG, Math.min(MAX_AIM_DEG, Math.round(snapped * 1000) / 1000));
}

/** 角度换成单位方向向量(y 轴朝下,所以取负) */
export function aimVector(deg: number): { dx: number; dy: number } {
  const a = (deg * Math.PI) / 180;
  return { dx: Math.cos(a), dy: -Math.sin(a) };
}

/** 一次拖动的完整换算:指到哪 → 夹角 → 吸附 → 方向向量 */
export function aimFromDrag(
  sx: number,
  sy: number,
  px: number,
  py: number
): { deg: number; dx: number; dy: number } | null {
  const deg = aimAngleDeg(sx, sy, px, py);
  if (deg === null) return null;
  const snapped = snapAimAngle(deg, Math.hypot(px - sx, py - sy));
  return { deg: snapped, ...aimVector(snapped) };
}

// ---------------------------------------------------------------------------
// 三、掉落物理(硬指标:失联的泡泡必须真的往下掉,不许瞬间消失)
// ---------------------------------------------------------------------------

export const GRAVITY = 1500;
/** 掉下去的时候轻轻散开一点 */
export const SPREAD_VX = 120;

export interface Faller {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  /** 已经掉了多久(秒) */
  age: number;
}

/** 用序号当随机源:同一批掉落每次都散得一样,画面稳定又不呆板 */
export function makeFaller(x: number, y: number, color: string, seed: number): Faller {
  const wobble = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = wobble - Math.floor(wobble);
  return { x, y, vx: (frac - 0.5) * 2 * SPREAD_VX, vy: -40 - frac * 70, color, age: 0 };
}

/** 走一帧重力:返回新的一份,不改原来的 */
export function stepFaller(f: Faller, dt: number, gravity: number = GRAVITY): Faller {
  const vy = f.vy + gravity * dt;
  return { ...f, x: f.x + f.vx * dt, y: f.y + vy * dt, vy, age: f.age + dt };
}

/** 掉出屏幕了没有 */
export function fallenOut(f: Faller, height: number = H): boolean {
  return f.y - R > height;
}

/** 一颗泡泡从生成到掉出屏幕经过的所有位置(单测拿它卡「真的经过了中间位置」) */
export function fallPath(f: Faller, dt: number, height: number = H, maxSteps = 600): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [{ x: f.x, y: f.y }];
  let cur = f;
  for (let i = 0; i < maxSteps && !fallenOut(cur, height); i++) {
    cur = stepFaller(cur, dt);
    out.push({ x: cur.x, y: cur.y });
  }
  return out;
}

/** 关掉动效时掉得快一点,但仍然一帧一帧地掉过中间位置,不许瞬移 */
export function fallGravity(reducedMotion: boolean): number {
  return reducedMotion ? GRAVITY * 3.2 : GRAVITY;
}

/** 把「失联清单」变成一串真的会往下掉的泡泡 */
export function fallersFor(
  g: Grid,
  cells: ReadonlyArray<{ r: number; c: number; color: string }>
): Faller[] {
  return cells.map((cell, i) => {
    const cc = cellCenter(g, cell.r, cell.c);
    return makeFaller(cc.x, cc.y, cell.color, i + 1);
  });
}

// ---------------------------------------------------------------------------
// 四、连锁分
// ---------------------------------------------------------------------------

/** 一发的得分:消掉的按个算,掉下去的翻倍,链越长加成越高 */
export function chainScore(popped: number, dropped: number, chain: number): number {
  const link = Math.max(1, Math.round(chain));
  const base = popped * 10 + dropped * 20;
  return Math.round(base * (1 + (link - 1) * 0.5));
}

/** 飘字:链越长字越大、话越热闹 */
export function chainLabel(dropped: number, chain: number): string {
  if (dropped <= 0) return "";
  if (chain >= 3) return `连锁 ×${chain}!掉了 ${dropped} 颗!`;
  if (chain === 2) return `双连锁!掉了 ${dropped} 颗`;
  return `掉了 ${dropped} 颗!`;
}

/** 飘字字号:链越长越大,但有上限,不会糊满屏 */
export function chainFontSize(chain: number): number {
  return Math.min(30, 14 + Math.max(0, chain - 1) * 5);
}

// ---------------------------------------------------------------------------
// 五、发射器:当前 + 下一颗、换弹、特殊泡
// ---------------------------------------------------------------------------

/** 炸弹泡:落点连同一圈邻居一起清掉(石泡也炸得动) */
export const BOMB = "X";

export function isBomb(cell: Cell): boolean {
  return cell === BOMB;
}

/** 特殊弹算不算「颜色」:不算,它们跟谁都配 */
export function isWildAmmo(ammo: string): boolean {
  return ammo === RAINBOW || ammo === BOMB;
}

export interface Loader {
  current: string;
  next: string;
}

/** 换弹:当前和下一颗对调 */
export function swapLoader(l: Loader): Loader {
  return { current: l.next, next: l.current };
}

/**
 * 挑一发新弹药:普通颜色只从**墙上还有的颜色**里出,免得手里攥着一颗永远配不上的死球。
 * 墙上一颗普通泡都没有了(只剩彩虹 / 石泡)就发彩虹。
 */
export function pickAmmo(pool: readonly string[], rand: () => number, specials: { bomb?: number; rainbow?: number } = {}): string {
  const bomb = Math.max(0, specials.bomb ?? 0);
  const rainbow = Math.max(0, specials.rainbow ?? 0);
  const roll = rand();
  if (roll < bomb) return BOMB;
  if (roll < bomb + rainbow) return RAINBOW;
  if (pool.length === 0) return RAINBOW;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/** 上膛:把打掉的那一颗补上,顺手保证颜色还在墙上 */
export function reload(l: Loader, g: Grid, rand: () => number, specials?: { bomb?: number; rainbow?: number }): Loader {
  const pool = colorsInGrid(g);
  const next = pickAmmo(pool, rand, specials);
  const current = ammoIsUseful(l.next, pool) ? l.next : pickAmmo(pool, rand, specials);
  return { current, next };
}

/** 这颗弹药还有用吗:特殊弹永远有用,普通颜色要墙上还有同色 */
export function ammoIsUseful(ammo: string, pool: readonly string[]): boolean {
  return isWildAmmo(ammo) || pool.includes(ammo);
}

/** 手里两颗都配不上墙上的颜色就换掉(死球保险) */
export function fixDeadAmmo(l: Loader, g: Grid, rand: () => number): Loader {
  const pool = colorsInGrid(g);
  return {
    current: ammoIsUseful(l.current, pool) ? l.current : pickAmmo(pool, rand),
    next: ammoIsUseful(l.next, pool) ? l.next : pickAmmo(pool, rand),
  };
}

/** 炸弹的杀伤范围:落点这一格加一圈邻居 */
export function bombTargets(g: Grid, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [[r, c]];
  for (const [nr, nc] of neighbors(g, r, c)) out.push([nr, nc]);
  return out;
}

/**
 * 引爆炸弹泡:一圈全清(石泡也炸掉),然后让失联的泡泡掉下去。
 * 直接改 grid,返回消掉的和掉下去的两份清单。
 */
export function detonate(g: Grid, r: number, c: number): SettleResult {
  const popped: SettleResult["popped"] = [];
  const dropped: SettleResult["dropped"] = [];
  for (const [tr, tc] of bombTargets(g, r, c)) {
    const cell = g.rows[tr]?.[tc];
    if (!cell) continue;
    popped.push({ r: tr, c: tc, color: cell });
    g.rows[tr][tc] = null;
  }
  if (popped.length === 0) return { popped, dropped };
  for (const [fr, fc] of findFloating(g)) {
    dropped.push({ r: fr, c: fc, color: g.rows[fr][fc]! });
    g.rows[fr][fc] = null;
  }
  return { popped, dropped };
}

// ---------------------------------------------------------------------------
// 六、无尽墙
// ---------------------------------------------------------------------------

/** 每打这么多发,墙就往下压一行 */
export const ENDLESS_PUSH_EVERY = 5;
/** 无尽模式一开始铺几行 */
export const ENDLESS_START_ROWS = 4;

export function endlessShouldPush(shotsFired: number, every: number = ENDLESS_PUSH_EVERY): boolean {
  return shotsFired > 0 && shotsFired % Math.max(1, every) === 0;
}

/** 越往后压得越密:前面留几个洞,后面几乎排满 */
export function endlessRowFill(rowsPushed: number): number {
  return Math.min(0.95, 0.6 + rowsPushed * 0.03);
}

/** 生成下压进来的那一行(长度按翻转后的顶行算) */
export function endlessRow(g: Grid, colors: readonly string[], rand: () => number, rowsPushed = 0): string {
  const len = rowLen(g.flip ^ 1, 0);
  const fill = endlessRowFill(rowsPushed);
  const palette = colors.length > 0 ? colors : ["R", "B", "G", "Y"];
  let out = "";
  for (let i = 0; i < len; i++) {
    out += rand() < fill ? palette[Math.min(palette.length - 1, Math.floor(rand() * palette.length))] : ".";
  }
  return out;
}

/** 无尽开局:铺几行随机泡泡 */
export function endlessStartRows(colors: readonly string[], rand: () => number, rows = ENDLESS_START_ROWS): string[] {
  const palette = colors.length > 0 ? colors : ["R", "B", "G", "Y"];
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let i = 0; i < rowLen(0, r); i++) {
      line += rand() < 0.85 ? palette[Math.min(palette.length - 1, Math.floor(rand() * palette.length))] : ".";
    }
    out.push(line);
  }
  return out;
}

/** 无尽成绩:清掉的泡泡 + 撑住的行数 */
export function endlessTotal(popScore: number, rowsSurvived: number): number {
  return popScore + Math.max(0, rowsSurvived) * 25;
}

/** 无尽结束时的一句话:只鼓励 */
export function endlessLine(score: number, best: number): string {
  if (score > best) return `新纪录 ${score} 分!这面墙被你顶回去好多次。`;
  return `这趟 ${score} 分,最好成绩 ${best} 分,再来一次准能超过它!`;
}

/** 网格里最下面那一行泡泡的行号;空网格返回 -1 */
export function lowestRow(g: Grid): number {
  for (let r = g.rows.length - 1; r >= 0; r--) {
    for (let c = 0; c < rowLength(g, r); c++) if (g.rows[r][c]) return r;
  }
  return -1;
}

/** 发射台的位置:index.ts 直接用这两个常量,单测也照这个算,不会两处对不上 */
export const SHOOTER_X = W / 2;
export const SHOOTER_Y = 444;

/** 石泡只能靠掉落或炸弹清掉,不参与同色消 —— 这条写成函数免得以后改歪 */
export function stoneNeedsDrop(cell: Cell): boolean {
  return isStone(cell);
}
