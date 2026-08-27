/**
 * 音乐星星 · 多点触控（1.2 新增，纯逻辑，不碰 DOM）。
 *
 * 1.1 的双声部关只挂了 `click`，触屏上「一根手指按住哆、另一根手指按索」这件事
 * 根本传不进来——`chordDone` 还明写着「先按一颗再按另一颗」。
 * 这就是那一章最大的 bug：**名字叫合奏，实际只能拆开按**。
 *
 * 这里按 `pointerId` 独立记录每根手指，同时按下的键才算一个和弦：
 *  - 同一个键被两根手指按住只算一次；
 *  - 抬起一根手指不影响另一根（不串）；
 *  - 松开后还在 `CHORD_WINDOW_MS` 窗口里的键仍然算数——
 *    小孩的两根手指落点差个几十毫秒是常事，太严就没法玩了。
 */

/** 两次按下算「同时」的最大间隔（毫秒） */
export const CHORD_WINDOW_MS = 220;

interface HeldEntry {
  key: number;
  at: number;
}

interface RecentEntry {
  key: number;
  /** 抬起的时刻 */
  at: number;
}

export class ChordPad {
  private readonly held = new Map<number, HeldEntry>();
  private recent: RecentEntry[] = [];
  private readonly windowMs: number;

  constructor(windowMs = CHORD_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  /** 一根手指按下了某个键 */
  down(pointerId: number, key: number, atMs: number): void {
    this.held.set(pointerId, { key, at: atMs });
  }

  /** 这根手指抬起来了；返回它按的是哪个键（没记录过返回 -1） */
  up(pointerId: number, atMs: number): number {
    const entry = this.held.get(pointerId);
    if (!entry) return -1;
    this.held.delete(pointerId);
    this.recent.push({ key: entry.key, at: atMs });
    return entry.key;
  }

  /** 这根手指被系统取消了（滑出按钮、来电话…）：当作没按过，不进和弦 */
  cancel(pointerId: number): void {
    this.held.delete(pointerId);
  }

  /** 当前有几根手指在按 */
  get pointerCount(): number {
    return this.held.size;
  }

  /** 此刻真正按住的键（升序去重） */
  heldKeys(): number[] {
    return uniqSorted([...this.held.values()].map((h) => h.key));
  }

  /**
   * 此刻的和弦：按住的 + 刚松开还在窗口内的。
   * @param atMs 现在的时刻
   */
  chord(atMs: number): number[] {
    this.prune(atMs);
    const keys = [...this.held.values()].map((h) => h.key);
    for (const r of this.recent) keys.push(r.key);
    return uniqSorted(keys);
  }

  /** 最早那根手指按下到现在过了多久（没人按返回 0） */
  spreadMs(atMs: number): number {
    let earliest = Number.POSITIVE_INFINITY;
    for (const h of this.held.values()) earliest = Math.min(earliest, h.at);
    for (const r of this.recent) earliest = Math.min(earliest, r.at);
    return Number.isFinite(earliest) ? atMs - earliest : 0;
  }

  /** 一拍判完就清干净，免得上一拍的手指混进下一拍 */
  reset(): void {
    this.held.clear();
    this.recent = [];
  }

  /** 丢掉已经超出窗口的「刚松开」记录 */
  private prune(atMs: number): void {
    this.recent = this.recent.filter((r) => atMs - r.at <= this.windowMs);
  }
}

function uniqSorted(keys: readonly number[]): number[] {
  return [...new Set(keys)].sort((a, b) => a - b);
}

/** 两组键是不是同一个和弦（顺序无关） */
export function sameChord(a: readonly number[], b: readonly number[]): boolean {
  const x = uniqSorted(a);
  const y = uniqSorted(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/**
 * 双声部关同时要按的两个键必须离得开：一根手指盖住两个就没法判了。
 * 返回这两个键之间实际的像素间距（键宽 + 间隙 × 中间隔了几个键）。
 */
export function keyGapPx(a: number, b: number, keyWidth: number, gap: number): number {
  const steps = Math.abs(a - b);
  if (steps <= 0) return 0;
  return steps * (keyWidth + gap) - keyWidth;
}

/** 双声部关两个键之间的最小间距（像素）：一根手指的指腹大约 20px */
export const DUET_MIN_GAP_PX = 24;

/** 双声部关同一拍的两颗星星至少隔几格（生成器按这个出题） */
export const DUET_MIN_GAP_STEPS = 2;

/** 这一拍的两个键在当前布局下够不够开 */
export function duetKeysSeparated(chord: readonly number[], keyWidth: number, gap: number): boolean {
  if (chord.length < 2) return true;
  for (let i = 1; i < chord.length; i++) {
    if (keyGapPx(chord[i - 1], chord[i], keyWidth, gap) < DUET_MIN_GAP_PX) return false;
  }
  return true;
}
