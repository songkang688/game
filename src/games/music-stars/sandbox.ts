/**
 * 音乐星星 · 自由弹奏沙盒（1.2 新增）。
 *
 * 一个**不计分**的键盘：五声音阶起步，可以切到七声；能录 30 秒并回放，最多存 6 段。
 * 沙盒不产星、不写关卡进度，也绝不碰 `yiduo-yixing.l99.*`——
 * 这里是让孩子瞎弹的地方，弹得再乱也不该影响任何成绩。
 */
import { DIATONIC_MIDI, PENTATONIC_MIDI } from "./tuning";

/** 一段录音最长 30 秒 */
export const SANDBOX_MAX_MS = 30000;
/** 最多存 6 段，满了丢最老的 */
export const SANDBOX_MAX_CLIPS = 6;
/** 存档 key（只增不改，走 `yiduo-yixing.` 前缀） */
export const SANDBOX_KEY = "yiduo-yixing.music-stars.sandbox.v1";

export type ScaleKind = "penta" | "hepta";

/** 当前音阶用哪几个 MIDI 音 */
export function scaleMidis(kind: ScaleKind): readonly number[] {
  return kind === "hepta" ? DIATONIC_MIDI : PENTATONIC_MIDI;
}

export interface SandboxNote {
  /** 相对录音开始的时刻（毫秒） */
  at: number;
  /** 音阶里的第几个键 */
  key: number;
  /** 按了多久（毫秒） */
  dur: number;
}

export interface SandboxClip {
  id: string;
  name: string;
  scale: ScaleKind;
  notes: SandboxNote[];
  /** 整段长度（毫秒），不超过 30000 */
  ms: number;
}

/** 一段录音有几个音、多长，用来给它起个名字 */
export function clipName(index: number, notes: readonly SandboxNote[]): string {
  const sec = Math.max(1, Math.round(clipLength(notes) / 1000));
  return `第 ${index} 段 · ${notes.length} 个音 · ${sec} 秒`;
}

/** 一串音符实际占的长度（毫秒） */
export function clipLength(notes: readonly SandboxNote[]): number {
  let end = 0;
  for (const n of notes) end = Math.max(end, n.at + Math.max(0, n.dur));
  return Math.min(SANDBOX_MAX_MS, Math.round(end));
}

/**
 * 30 秒硬上限：超出的音符直接丢掉，跨过 30 秒线的音符把尾巴剪短。
 * 顺便把时间排好序、把非法数据滤掉。
 */
export function trimClip(notes: readonly SandboxNote[], maxMs = SANDBOX_MAX_MS): SandboxNote[] {
  const out: SandboxNote[] = [];
  for (const n of notes) {
    if (!n || !Number.isFinite(n.at) || !Number.isFinite(n.key)) continue;
    const at = Math.max(0, Math.round(n.at));
    if (at >= maxMs) continue;
    const dur = Math.max(1, Math.round(Number.isFinite(n.dur) ? n.dur : 0));
    out.push({ at, key: Math.max(0, Math.round(n.key)), dur: Math.min(dur, maxMs - at) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** 把一段新录音塞进列表：满 6 段就丢最老的那段 */
export function pushClip(
  list: readonly SandboxClip[],
  clip: SandboxClip,
  max = SANDBOX_MAX_CLIPS
): SandboxClip[] {
  const cap = Math.max(1, Math.round(max));
  const next = [...list, clip];
  return next.slice(Math.max(0, next.length - cap));
}

/** 删掉某一段 */
export function dropClip(list: readonly SandboxClip[], id: string): SandboxClip[] {
  return list.filter((c) => c.id !== id);
}

/** 把任意来源的存档整理成合法的录音列表（坏数据一律丢） */
export function migrateClips(parsed: unknown): SandboxClip[] {
  if (!Array.isArray(parsed)) return [];
  const out: SandboxClip[] = [];
  for (const raw of parsed as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const notes = Array.isArray(c.notes) ? trimClip(c.notes as SandboxNote[]) : [];
    if (notes.length === 0) continue;
    out.push({
      id: typeof c.id === "string" && c.id ? c.id : `clip-${out.length + 1}`,
      name: typeof c.name === "string" && c.name ? c.name : clipName(out.length + 1, notes),
      scale: c.scale === "hepta" ? "hepta" : "penta",
      notes,
      ms: clipLength(notes),
    });
  }
  return out.slice(Math.max(0, out.length - SANDBOX_MAX_CLIPS));
}

export interface ClipStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ClipStorage | null {
  try {
    return (globalThis as { localStorage?: ClipStorage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadClips(storage?: ClipStorage | null): SandboxClip[] {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(SANDBOX_KEY);
    return raw ? migrateClips(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

export function saveClips(list: readonly SandboxClip[], storage?: ClipStorage | null): void {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(SANDBOX_KEY, JSON.stringify(list.slice(0, SANDBOX_MAX_CLIPS)));
  } catch {
    // 存不进去也不影响弹
  }
}

/**
 * 录音机：只管「什么时候按了哪个键、按了多久」，不碰声音也不碰 DOM。
 * 到 30 秒自动停，`notes()` 出来的一定是剪好的。
 */
export class ClipRecorder {
  private startedAt = 0;
  private recording = false;
  private readonly open = new Map<number, { at: number; key: number }>();
  private captured: SandboxNote[] = [];
  readonly maxMs: number;

  constructor(maxMs = SANDBOX_MAX_MS) {
    this.maxMs = Math.max(1000, Math.round(maxMs));
  }

  get active(): boolean {
    return this.recording;
  }

  start(atMs: number): void {
    this.startedAt = atMs;
    this.recording = true;
    this.open.clear();
    this.captured = [];
  }

  /** 已经录了多久（毫秒），封顶 30 秒 */
  elapsed(atMs: number): number {
    if (!this.recording) return clipLength(this.captured);
    return Math.max(0, Math.min(this.maxMs, atMs - this.startedAt));
  }

  /** 到点了没有：到了就该自动停 */
  expired(atMs: number): boolean {
    return this.recording && atMs - this.startedAt >= this.maxMs;
  }

  noteOn(pointerId: number, key: number, atMs: number): void {
    if (!this.recording) return;
    this.open.set(pointerId, { at: atMs - this.startedAt, key });
  }

  noteOff(pointerId: number, atMs: number): void {
    const started = this.open.get(pointerId);
    if (!started) return;
    this.open.delete(pointerId);
    if (!this.recording) return;
    const dur = Math.max(60, atMs - this.startedAt - started.at);
    this.captured.push({ at: Math.max(0, Math.round(started.at)), key: started.key, dur: Math.round(dur) });
  }

  stop(atMs: number): SandboxNote[] {
    for (const id of [...this.open.keys()]) this.noteOff(id, atMs);
    this.recording = false;
    return this.notes();
  }

  notes(): SandboxNote[] {
    return trimClip(this.captured, this.maxMs);
  }
}
