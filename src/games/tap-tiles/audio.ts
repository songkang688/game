/**
 * 音符下落 · 音高合成(Web Audio 振荡器现场合成,没有任何外部音频文件)。
 *
 * 旋律不是任何现成曲子:一律在 C 大调五声音阶上跑,
 * 轨道决定起始音级,连击往上推音级,所以连得越长听上去越往上走。
 * 拿不到 AudioContext(比如 node 里跑测试)就整只静音降级,接口照样能用。
 */
import { save } from "../../engine/save";
import type { Judgement } from "./judge";

/** 基准音 A4 */
export const A4_HZ = 440;
/** C4 相对 A4 差 9 个半音 */
export const ROOT_SEMI = -9;
/** C 大调五声音阶(相对主音的半音数) */
export const PENTATONIC: readonly number[] = [0, 2, 4, 7, 9];
/** 音级封顶:再往上就偏尖了,给耳朵留点余地 */
export const MAX_DEGREE = 11;

/** 半音换算成频率 */
export function semitoneFreq(semi: number): number {
  return Math.round(A4_HZ * Math.pow(2, semi / 12) * 100) / 100;
}

/** 五声音阶第 degree 级的频率(超过一个八度就往上翻) */
export function degreeFreq(degree: number): number {
  const d = Math.max(0, Math.min(MAX_DEGREE, Math.round(Number.isFinite(degree) ? degree : 0)));
  const len = PENTATONIC.length;
  const octave = Math.floor(d / len);
  return semitoneFreq(ROOT_SEMI + PENTATONIC[d % len] + 12 * octave);
}

/** 某条轨在某个连击数上该响哪一级:轨道打底,连击往上推 */
export function laneDegree(lane: number, combo: number): number {
  const l = Math.max(0, Math.min(3, Math.round(Number.isFinite(lane) ? lane : 0)));
  const c = Math.max(0, Math.round(Number.isFinite(combo) ? combo : 0));
  return Math.min(MAX_DEGREE, l + (c % 6));
}

/** 命中音的音量:完美亮一点,良好柔一点,整体都很温和 */
export const PERFECT_VOL = 0.16;
export const GOOD_VOL = 0.1;
export const MISS_VOL = 0.06;

export interface ToneKit {
  /** 命中一个音符 */
  hit(judgement: Judgement, lane: number, combo: number): void;
  /** 接住长按条的头 */
  holdStart(lane: number, combo: number): void;
  /** 音符溜走了:一声很轻的低音,不刺耳 */
  miss(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  readonly closed: boolean;
  /** 是否已经真的建过 AudioContext */
  readonly live: boolean;
  /** 关掉音频上下文;destroy 里必须调 */
  close(): void;
}

type Ctor = new () => AudioContext;

function findCtor(host: unknown): Ctor | null {
  if (typeof host !== "object" || host === null) return null;
  const h = host as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return h.AudioContext ?? h.webkitAudioContext ?? null;
}

/**
 * 建一套音色。host 默认是 globalThis(测试里可以塞一个桩进来)。
 * AudioContext 是懒建的:第一次真的要发声时才建,避免自动播放策略把它挂起。
 */
export function createToneKit(host: unknown = globalThis): ToneKit {
  let ctx: AudioContext | null = null;
  let closed = false;
  let muted = false;

  function ensure(): AudioContext | null {
    if (closed || muted) return null;
    try {
      if (!save.isSoundOn()) return null;
    } catch {
      // 读不到设置就当开着,别因为存档问题把声音吞了
    }
    if (ctx) return ctx;
    const Ctor = findCtor(host);
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      // 个别 WebView 建不出上下文:整只静音降级,不影响玩
      return null;
    }
    return ctx;
  }

  /** 一颗短音:正弦打底,起落都有包络,不会有咔哒声 */
  function blip(freq: number, dur: number, vol: number, type: OscillatorType, delay = 0): void {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // 声音发不出来也不能影响玩法
    }
  }

  const kit: ToneKit = {
    hit(judgement, lane, combo) {
      const freq = degreeFreq(laneDegree(lane, combo));
      if (judgement === "perfect") {
        blip(freq, 0.18, PERFECT_VOL, "triangle");
        // 完美再叠一个高八度的轻泛音,听上去更亮
        blip(freq * 2, 0.12, PERFECT_VOL * 0.35, "sine", 0.01);
      } else if (judgement === "good") {
        blip(freq, 0.16, GOOD_VOL, "sine");
      } else {
        kit.miss();
      }
    },
    holdStart(lane, combo) {
      blip(degreeFreq(laneDegree(lane, combo)), 0.26, GOOD_VOL, "sine");
    },
    miss() {
      blip(degreeFreq(0) / 2, 0.22, MISS_VOL, "sine");
    },
    setMuted(next) {
      muted = next;
    },
    get muted() {
      return muted;
    },
    get closed() {
      return closed;
    },
    get live() {
      return ctx !== null;
    },
    close() {
      closed = true;
      const ac = ctx;
      ctx = null;
      if (!ac) return;
      try {
        const ret = ac.close();
        if (ret && typeof (ret as Promise<void>).catch === "function") {
          void (ret as Promise<void>).catch(() => {});
        }
      } catch {
        // 已经关过了就算了
      }
    },
  };
  return kit;
}
