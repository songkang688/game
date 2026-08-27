/**
 * 拼图乐园 · 1.2 吸附、预览三档、旋转撤销与中途续拼(纯函数,不碰 DOM)。
 *
 * 1.1 的缺块补齐是「先点托盘里的一块,再点画上的缺口」,没有拖拽也就谈不上吸附。
 * 1.2 给它补上真正的拖放:手指拖着碎片走,松手时看离最近格中心有多远,
 * 在阈值(格宽 × 0.35)内就磁性滑入,否则轻轻弹回托盘——弹回不扣步、不训人。
 *
 * 另外三件事也在这里:预览三档(整图底图 / 角落缩略图 / 无预览挑战)、
 * 旋转块的撤销栈与存档格式、以及大画板中途退出的续拼存档(坏数据一律当新档)。
 */
import { endlessBoard } from "./levels";

// ---------------------------------------------------------------------------
// 一、吸附与磁性
// ---------------------------------------------------------------------------

/** 吸附阈值 = 格宽 × 这个比例 */
export const SNAP_RATIO = 0.35;
/**
 * 吸附阈值的下限(像素)。
 * 360px 窄屏上 6 列的格宽只剩 ~54px,按 35% 算吸附半径不到 19px,
 * 小朋友的指尖落点误差比这个大;给一个不随格宽缩水的地板,窄屏也吸得住。
 */
export const SNAP_MIN = 18;
/** 磁性滑入用多久(毫秒) */
export const SNAP_MS = 120;
/** 放错了弹回原处用多久 */
export const BOUNCE_MS = 180;
/** reduced-motion 下只保留位移,不要弹性 */
export const REDUCED_MS = 16;

export function snapThreshold(cell: number): number {
  const c = Number.isFinite(cell) && cell > 0 ? cell : 0;
  if (c <= 0) return 0;
  // 吸附半径再小也不能小过半格,否则两格之间会出现「谁也吸不住」的死带
  return Math.min(c / 2, Math.max(SNAP_MIN, c * SNAP_RATIO));
}

/** 磁性动画时长:孩子的系统关了动效就压到一帧 */
export function magnetMs(reduced: boolean): number {
  return reduced ? REDUCED_MS : SNAP_MS;
}

export interface GridGeom {
  /** 画板左上角在页面里的坐标 */
  left: number;
  top: number;
  /** 一格的边长(正方形) */
  cell: number;
  /** 格与格之间的缝 */
  gap: number;
  rows: number;
  cols: number;
}

/** 第 pos 格中心在页面里的坐标 */
export function cellCenter(g: GridGeom, pos: number): { x: number; y: number } {
  const r = Math.floor(pos / g.cols);
  const c = pos % g.cols;
  const step = g.cell + g.gap;
  return { x: g.left + c * step + g.cell / 2, y: g.top + r * step + g.cell / 2 };
}

/** 离 (x,y) 最近的那一格(超出画板也会夹回最边上那格) */
export function nearestCell(g: GridGeom, x: number, y: number): number {
  const step = g.cell + g.gap;
  const c = Math.max(0, Math.min(g.cols - 1, Math.round((x - g.left - g.cell / 2) / step)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.round((y - g.top - g.cell / 2) / step)));
  return r * g.cols + c;
}

/** 松手时离最近格中心有多远 */
export function dropDistance(g: GridGeom, x: number, y: number): number {
  const center = cellCenter(g, nearestCell(g, x, y));
  return Math.hypot(x - center.x, y - center.y);
}

export type DropResult =
  /** 吸附成功:磁性滑进这一格 */
  | { kind: "snap"; pos: number }
  /** 弹回托盘:far=离格子太远,taken=这一格不是空缺口,wrong=块不对 */
  | { kind: "bounce"; pos: number; reason: "far" | "taken" | "wrong" };

/** 只有「块不对」才算真的走错一步;离得远或放到已填格都不扣步 */
export function dropCostsMove(res: DropResult): boolean {
  return res.kind === "snap" || res.reason === "wrong";
}

/**
 * 松手判定:先找最近的格,再依次看「够不够近」「这格空不空」「块对不对」。
 * `holes` 是画里缺掉的格,`filled` 是已经补好的格。
 */
export function resolveDrop(
  g: GridGeom,
  x: number,
  y: number,
  opts: { holes: readonly number[]; filled: readonly number[]; value: number }
): DropResult {
  const pos = nearestCell(g, x, y);
  if (dropDistance(g, x, y) > snapThreshold(g.cell)) return { kind: "bounce", pos, reason: "far" };
  if (!opts.holes.includes(pos) || opts.filled.includes(pos)) {
    return { kind: "bounce", pos, reason: "taken" };
  }
  if (opts.value !== pos) return { kind: "bounce", pos, reason: "wrong" };
  return { kind: "snap", pos };
}

/** 弹回时那句话:只解释,不责怪 */
export function bounceLine(reason: "far" | "taken" | "wrong"): string {
  if (reason === "far") return "放在缺口上面一点点就会自己吸进去,再试一次~";
  if (reason === "taken") return "这一格已经有画啦,找找还空着的缺口~";
  return "这块和缺口四周的花纹接不上,对着小图再比一比~";
}

// ---------------------------------------------------------------------------
// 二、预览三档
// ---------------------------------------------------------------------------

/** ghost=整图半透明底图(低年级) thumb=角落缩略图 none=无预览(挑战) */
export type PreviewMode = "ghost" | "thumb" | "none";

export const PREVIEW_MODES: PreviewMode[] = ["ghost", "thumb", "none"];

/** 预览档位只是看图方式,不进游戏存档主键,单独存一个小设置 */
export const PREVIEW_KEY = "yiduo-yixing.puzzle-tiles.preview.v1";

export function parsePreview(raw: string | null): PreviewMode {
  return PREVIEW_MODES.includes(raw as PreviewMode) ? (raw as PreviewMode) : "thumb";
}

export function nextPreview(m: PreviewMode): PreviewMode {
  const i = PREVIEW_MODES.indexOf(m);
  return PREVIEW_MODES[(i < 0 ? 0 : i + 1) % PREVIEW_MODES.length];
}

export function previewLabel(m: PreviewMode): string {
  if (m === "ghost") return "🖼️ 整图底图";
  if (m === "thumb") return "🔍 角落小图";
  return "🚫 不看图挑战";
}

/** 无预览通关额外发一枚徽章;三星标准三档完全一样,徽章只是结算时多一句夸 */
export function challengeBadge(m: PreviewMode): string | null {
  return m === "none" ? "🏅 不看图挑战徽章" : null;
}

// ---------------------------------------------------------------------------
// 三、旋转块:撤销栈与存档
// ---------------------------------------------------------------------------

export interface RotateStep {
  pos: number;
  from: number;
  to: number;
}

export function rotateOnce(r: number): number {
  const v = Number.isFinite(r) ? Math.round(r) : 0;
  return (((v + 1) % 4) + 4) % 4;
}

/** 点一下第 pos 块:返回新的朝向表和这一步(用来入撤销栈),原表不动 */
export function applyRotate(rot: readonly number[], pos: number): { rot: number[]; step: RotateStep } {
  const next = rot.slice();
  const from = next[pos] ?? 0;
  const to = rotateOnce(from);
  next[pos] = to;
  return { rot: next, step: { pos, from, to } };
}

/** 撤一步:把那一块转回去 */
export function undoRotate(rot: readonly number[], step: RotateStep): number[] {
  const next = rot.slice();
  next[step.pos] = ((Math.round(step.from) % 4) + 4) % 4;
  return next;
}

export function serializeRotations(rot: readonly number[]): string {
  return rot.map((r) => ((Math.round(r) % 4) + 4) % 4).join("");
}

/** 读回朝向表:长度不对或者有脏字符就当没存过 */
export function parseRotations(raw: string | null, n: number): number[] | null {
  if (typeof raw !== "string" || raw.length !== n) return null;
  const out: number[] = [];
  for (const ch of raw) {
    const v = Number(ch);
    if (!Number.isInteger(v) || v < 0 || v > 3) return null;
    out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 四、中途退出续拼
// ---------------------------------------------------------------------------

/** 续拼存档 key(按规定走 yiduo-yixing. 前缀) */
export const RESUME_KEY = "yiduo-yixing.puzzle-tiles.resume.v1";

/**
 * 多大的画才值得存续拼。
 * 规格写的是 ≥48 片,但本作最大的画板是 6×6=36 片,再大孩子在 360px 上就点不准了;
 * 所以门槛落在 25 片(5×5 起),把「巨幅长卷 / 限时大画展」这两本大画册全都盖住。
 */
export const RESUME_MIN_PIECES = 25;

export function needsResume(rows: number, cols: number): boolean {
  const n = Math.max(0, Math.round(rows)) * Math.max(0, Math.round(cols));
  return n >= RESUME_MIN_PIECES;
}

export interface ResumeState {
  /** 第几关(0 起) */
  level: number;
  kind: "slide" | "rotate" | "fill";
  total: number;
  moves: number;
  /** 推格子的摆法 */
  board?: number[];
  /** 旋转块的朝向表 */
  rot?: number[];
  /** 缺块补齐已经补好的格 */
  filled?: number[];
  /** 缺块补齐托盘里已经用掉的下标 */
  used?: number[];
}

export function serializeResume(s: ResumeState): string {
  return JSON.stringify(s);
}

/** 读回续拼存档:任何一处对不上就当新档重开(坏数据降级,绝不崩) */
export function parseResume(raw: string | null): ResumeState | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const level = o.level;
    const kind = o.kind;
    const total = o.total;
    const moves = o.moves;
    if (typeof level !== "number" || !Number.isInteger(level) || level < 0) return null;
    if (kind !== "slide" && kind !== "rotate" && kind !== "fill") return null;
    if (typeof total !== "number" || !Number.isInteger(total) || total <= 0) return null;
    if (typeof moves !== "number" || !Number.isFinite(moves) || moves < 0) return null;
    const out: ResumeState = { level, kind, total, moves: Math.round(moves) };
    const nums = (v: unknown): number[] | undefined =>
      Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isInteger(x)) ? (v as number[]) : undefined;
    const board = nums(o.board);
    if (board) out.board = board;
    const rot = nums(o.rot);
    if (rot) out.rot = rot;
    const filled = nums(o.filled);
    if (filled) out.filled = filled;
    const used = nums(o.used);
    if (used) out.used = used;
    return out;
  } catch {
    return null;
  }
}

/** 这份存档能不能接着拼这一关(关号、板式、片数都得对上) */
export function resumeMatches(
  s: ResumeState | null,
  level: number,
  kind: "slide" | "rotate" | "fill",
  total: number
): boolean {
  if (!s) return false;
  if (s.level !== level || s.kind !== kind || s.total !== total) return false;
  if (kind === "slide") {
    if (!s.board || s.board.length !== total) return false;
    const seen = new Set(s.board);
    return seen.size === total && s.board.every((v) => v >= 0 && v < total);
  }
  if (kind === "rotate") return !!s.rot && s.rot.length === total && s.rot.every((v) => v >= 0 && v <= 3);
  return !!s.filled;
}

// ---------------------------------------------------------------------------
// 五、无尽「拼不完的画」
// ---------------------------------------------------------------------------

/** 无尽第 round 幅(1 起)有几片 */
export function galleryPieces(round: number): number {
  const cfg = endlessBoard(round);
  return cfg.rows * cfg.cols;
}

/** 前 n 幅里最大的那幅有几片:用来验证「片数随幅数递增」 */
export function galleryPeak(n: number): number {
  let peak = 0;
  for (let i = 1; i <= Math.max(1, Math.round(n)); i++) peak = Math.max(peak, galleryPieces(i));
  return peak;
}

// ---------------------------------------------------------------------------
// 六、收摊清理
// ---------------------------------------------------------------------------

/** 指针监听 / rAF / timer 统一记账,destroy 一把倒干净 */
export class TileBag {
  private jobs: Array<() => void> = [];

  add(off: () => void): void {
    this.jobs.push(off);
  }

  get size(): number {
    return this.jobs.length;
  }

  clear(): void {
    const jobs = this.jobs;
    this.jobs = [];
    for (const off of jobs) off();
  }
}
