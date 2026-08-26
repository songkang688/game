/**
 * 音乐星星 · 合成器（1.2 新增）。
 *
 * 全部声音 **Web Audio 现场合成**，一个音频文件都不引。
 * 三种音色靠「不同波形 + 不同 ADSR 包络」区分：星铃 / 木琴 / 软风琴。
 *
 * 音量红线：默认 0.35、上限 0.6，主音量节点统一收口；
 * 同时发几个音就把这份音量分几份，**任何路径下同时发声的总增益都 ≤ 0.6**。
 *
 * 依赖的是一组最小接口（`AudioLike`），真 `AudioContext` 与测试桩都对得上，
 * 所以解锁、限幅、`destroy` 后节点全断这几件事能直接写单测。
 */
import { measureLatencyMs } from "./timing";

/** 音量默认值 */
export const VOLUME_DEFAULT = 0.35;
/** 音量硬上限，任何情况下不许突破 */
export const VOLUME_MAX = 0.6;
/** 包络的地板值：指数曲线不能到 0 */
export const GAIN_FLOOR = 0.0001;

/** 音色 / 音量 / 静音的存档 key（只增不改，走 `yiduo-yixing.` 前缀） */
export const AUDIO_PREFS_KEY = "yiduo-yixing.music-stars.audio.v1";

export type TimbreId = "bell" | "marimba" | "reed";

export interface Timbre {
  id: TimbreId;
  name: string;
  wave: "sine" | "triangle" | "sawtooth" | "square";
  /** ADSR，单位秒 */
  attack: number;
  decay: number;
  /** 延音电平，0–1 的比例 */
  sustain: number;
  release: number;
  /** 相对音量，0–1；乘在主音量上，所以不会顶破上限 */
  gain: number;
  /** 需要削高频时挂一道低通（锯齿波不加这个会刺耳） */
  lowpass?: number;
  /** 叠一个高八度的弱泛音，星铃靠它出「铃」味 */
  overtone?: number;
}

export const TIMBRES: readonly Timbre[] = [
  {
    id: "bell",
    name: "星铃",
    wave: "triangle",
    attack: 0.005,
    decay: 0.28,
    sustain: 0.18,
    release: 0.45,
    gain: 1,
    overtone: 0.22,
  },
  {
    id: "marimba",
    name: "木琴",
    wave: "sine",
    attack: 0.002,
    decay: 0.14,
    sustain: 0,
    release: 0.16,
    gain: 0.95,
  },
  {
    id: "reed",
    name: "软风琴",
    wave: "sawtooth",
    attack: 0.07,
    decay: 0.1,
    sustain: 0.75,
    release: 0.28,
    gain: 0.62,
    lowpass: 1600,
  },
];

/** 按 id 找音色，找不到就退回第一种（永远给得出一个能响的音色） */
export function timbreById(id: string | undefined | null): Timbre {
  return TIMBRES.find((t) => t.id === id) ?? TIMBRES[0];
}

/** 把任意来源的音量夹进 0–0.6；坏数据一律退回默认值 */
export function clampVolume(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return VOLUME_DEFAULT;
  return Math.max(0, Math.min(VOLUME_MAX, n));
}

/**
 * 单个音的包络峰值。
 * 同时发 voices 个音就分 voices 份，所以**这一刻所有音加起来 ≤ 主音量 ≤ 0.6**。
 */
export function voicePeak(volume: unknown, timbre: Timbre, voices = 1): number {
  const v = clampVolume(volume);
  const n = Math.max(1, Math.round(Number.isFinite(voices) ? voices : 1));
  const peak = (v * timbre.gain) / n;
  return Math.max(GAIN_FLOOR, Math.min(VOLUME_MAX, peak));
}

export interface AudioPrefs {
  volume: number;
  muted: boolean;
  timbre: TimbreId;
}

export const DEFAULT_PREFS: AudioPrefs = { volume: VOLUME_DEFAULT, muted: false, timbre: "bell" };

/** 把任意来源的设置整理成合法的 AudioPrefs（坏数据一律回默认） */
export function migratePrefs(parsed: unknown): AudioPrefs {
  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PREFS };
  const raw = parsed as Record<string, unknown>;
  return {
    volume: clampVolume(raw.volume),
    muted: raw.muted === true,
    timbre: timbreById(typeof raw.timbre === "string" ? raw.timbre : null).id,
  };
}

export interface PrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): PrefsStorage | null {
  try {
    const ls = (globalThis as { localStorage?: PrefsStorage }).localStorage;
    return ls ?? null;
  } catch {
    // 隐私模式等场景：设置不持久化，只在本次会话内有效
    return null;
  }
}

export function loadPrefs(storage?: PrefsStorage | null): AudioPrefs {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return { ...DEFAULT_PREFS };
  try {
    const raw = store.getItem(AUDIO_PREFS_KEY);
    return raw ? migratePrefs(JSON.parse(raw) as unknown) : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: AudioPrefs, storage?: PrefsStorage | null): void {
  const store = storage === undefined ? defaultStorage() : storage;
  if (!store) return;
  try {
    store.setItem(AUDIO_PREFS_KEY, JSON.stringify(migratePrefs(prefs)));
  } catch {
    // 存不进去也不影响弹
  }
}

// ---------------------------------------------------------------------------
// 最小 Web Audio 接口：真 AudioContext 与测试桩都满足它
// ---------------------------------------------------------------------------

export interface ParamLike {
  value: number;
  setValueAtTime(value: number, at: number): unknown;
  linearRampToValueAtTime(value: number, at: number): unknown;
  exponentialRampToValueAtTime(value: number, at: number): unknown;
  cancelScheduledValues?(at: number): unknown;
}

export interface NodeLike {
  connect(dest: unknown): unknown;
  disconnect(): unknown;
}

export interface OscLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  detune?: ParamLike;
  start(at: number): unknown;
  stop(at: number): unknown;
  onended?: (() => void) | null;
}

export interface GainNodeLike extends NodeLike {
  gain: ParamLike;
}

export interface FilterLike extends NodeLike {
  type: string;
  frequency: ParamLike;
}

export interface AudioLike {
  currentTime: number;
  state?: string;
  destination: unknown;
  outputLatency?: number;
  baseLatency?: number;
  createOscillator(): OscLike;
  createGain(): GainNodeLike;
  createBiquadFilter?(): FilterLike;
  resume?(): Promise<void> | void;
  suspend?(): Promise<void> | void;
  close?(): Promise<void> | void;
}

export interface SynthOptions {
  /** 造一个音频上下文；返回 null 表示这个环境没有音频（照样能玩，只是没声） */
  makeContext?: () => AudioLike | null;
  prefs?: AudioPrefs;
  storage?: PrefsStorage | null;
}

function makeRealContext(): AudioLike | null {
  try {
    const Ctor = (globalThis as { AudioContext?: new () => AudioLike }).AudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

/**
 * 星星合成器。
 *
 * - 懒创建上下文，但**第一次用户手势就 `unlock()`**，否则自动播放策略会把它按在 suspended；
 * - 所有声音都先进主音量节点再出去，主音量恒 ≤ 0.6；
 * - 每个音用完自己断开，`destroy()` 会把还活着的节点全部断掉并 `close()` 上下文。
 */
export class StarSynth {
  private ctx: AudioLike | null = null;
  private master: GainNodeLike | null = null;
  private readonly live = new Set<NodeLike>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly make: () => AudioLike | null;
  private readonly storage: PrefsStorage | null | undefined;
  private prefs: AudioPrefs;
  private closed = false;
  /** 开局测出来的输出延迟（毫秒） */
  latencyMs = 0;

  constructor(opts: SynthOptions = {}) {
    this.make = opts.makeContext ?? makeRealContext;
    this.storage = opts.storage;
    this.prefs = opts.prefs ? migratePrefs(opts.prefs) : loadPrefs(opts.storage);
  }

  get volume(): number {
    return this.prefs.volume;
  }

  get muted(): boolean {
    return this.prefs.muted;
  }

  get timbre(): Timbre {
    return timbreById(this.prefs.timbre);
  }

  /** 还挂着几个节点：`destroy` 之后必须是 0，单测靠它证明没泄漏 */
  get liveNodes(): number {
    return this.live.size;
  }

  /** 拿到（必要时创建）音频上下文；没有音频环境返回 null */
  context(): AudioLike | null {
    if (this.closed) return null;
    if (!this.ctx) {
      this.ctx = this.make();
      if (this.ctx) {
        this.latencyMs = 0;
        try {
          const gain = this.ctx.createGain();
          gain.gain.value = this.effectiveVolume();
          gain.connect(this.ctx.destination);
          this.master = gain;
          this.live.add(gain);
        } catch {
          this.master = null;
        }
      }
    }
    return this.ctx;
  }

  /** 主音量的实际取值：静音就是 0，否则是夹过的音量 */
  effectiveVolume(): number {
    return this.prefs.muted ? 0 : clampVolume(this.prefs.volume);
  }

  /**
   * 首次用户手势时调用：创建上下文并 `resume()`，顺便量一次输出延迟。
   * 反复调用没有副作用。
   */
  unlock(): void {
    const ctx = this.context();
    if (!ctx) return;
    try {
      if (ctx.state !== "running") void ctx.resume?.();
    } catch {
      // 解锁失败就静默降级，游戏照样能玩
    }
    this.latencyMs = measureLatencyMs(ctx);
  }

  /** 页面切到后台时挂起，省电也避免回来一片声音一起炸出来 */
  suspend(): void {
    try {
      if (this.ctx && this.ctx.state === "running") void this.ctx.suspend?.();
    } catch {
      // 忽略
    }
  }

  setVolume(v: number): void {
    this.prefs = { ...this.prefs, volume: clampVolume(v) };
    this.applyMaster();
    savePrefs(this.prefs, this.storage);
  }

  setMuted(on: boolean): void {
    this.prefs = { ...this.prefs, muted: on === true };
    this.applyMaster();
    savePrefs(this.prefs, this.storage);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.prefs.muted);
    return this.prefs.muted;
  }

  setTimbre(id: string): void {
    this.prefs = { ...this.prefs, timbre: timbreById(id).id };
    savePrefs(this.prefs, this.storage);
  }

  private applyMaster(): void {
    if (!this.master) return;
    try {
      this.master.gain.value = this.effectiveVolume();
    } catch {
      // 忽略
    }
  }

  /** 现在的音频时钟（秒）；没有音频环境退回 0 */
  now(): number {
    const ctx = this.ctx;
    return ctx ? ctx.currentTime : 0;
  }

  /**
   * 弹一个音。
   * @param freq 频率（Hz）
   * @param ms 按住的时长（毫秒），释放段在这之后
   * @param voices 这一刻同时发几个音，用来分摊音量
   */
  play(freq: number, ms: number, voices = 1, timbre: Timbre = this.timbre): void {
    if (this.closed || !(freq > 0)) return;
    const ctx = this.context();
    if (!ctx || !this.master) return;
    if (this.prefs.muted) return;
    try {
      const t0 = ctx.currentTime;
      const hold = Math.max(0.03, ms / 1000);
      const peak = voicePeak(this.prefs.volume, timbre, voices);
      const sustainLevel = Math.max(GAIN_FLOOR, peak * timbre.sustain);

      const env = ctx.createGain();
      env.gain.setValueAtTime(GAIN_FLOOR, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + timbre.attack);
      env.gain.exponentialRampToValueAtTime(sustainLevel, t0 + timbre.attack + timbre.decay);
      const releaseAt = t0 + Math.max(hold, timbre.attack + timbre.decay);
      env.gain.exponentialRampToValueAtTime(GAIN_FLOOR, releaseAt + timbre.release);

      let filter: FilterLike | null = null;
      if (timbre.lowpass && typeof ctx.createBiquadFilter === "function") {
        filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = timbre.lowpass;
        env.connect(filter);
        filter.connect(this.master);
      } else {
        env.connect(this.master);
      }

      const osc = ctx.createOscillator();
      osc.type = timbre.wave;
      osc.frequency.value = freq;
      osc.connect(env);
      osc.start(t0);
      const stopAt = releaseAt + timbre.release + 0.05;
      osc.stop(stopAt);

      const parts: NodeLike[] = [env, osc];
      if (filter) parts.push(filter);

      if (timbre.overtone) {
        const oct = ctx.createOscillator();
        const octGain = ctx.createGain();
        oct.type = "sine";
        oct.frequency.value = freq * 2;
        octGain.gain.setValueAtTime(GAIN_FLOOR, t0);
        octGain.gain.linearRampToValueAtTime(peak * timbre.overtone, t0 + timbre.attack);
        octGain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, releaseAt + timbre.release);
        oct.connect(octGain);
        octGain.connect(this.master);
        oct.start(t0);
        oct.stop(stopAt);
        parts.push(oct, octGain);
      }

      for (const p of parts) this.live.add(p);
      const cleanup = (): void => {
        for (const p of parts) {
          try {
            p.disconnect();
          } catch {
            // 已经断过了
          }
          this.live.delete(p);
        }
      };
      osc.onended = cleanup;
      // onended 在某些实现里不保证触发，兜一个定时器
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        cleanup();
      }, Math.ceil((stopAt - t0) * 1000) + 120);
      this.timers.add(timer);
    } catch {
      // 没有音频环境也不影响玩
    }
  }

  /** 断开所有节点、清掉定时器、关掉上下文；调用之后 `liveNodes` 必须是 0 */
  destroy(): void {
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const node of this.live) {
      try {
        node.disconnect();
      } catch {
        // 已经断过了
      }
    }
    this.live.clear();
    this.master = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      try {
        const p = ctx.close?.();
        if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
      } catch {
        // 关不掉也不抛
      }
    }
  }
}