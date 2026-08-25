/**
 * Web Audio 合成音效,不依赖任何外部音频文件。
 * 首次用户点击后才创建 AudioContext(浏览器自动播放策略)。
 */
import type { SoundName } from "./types";
import { save } from "./save";

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  /** 开始频率 Hz */
  freq: number;
  /** 结束频率 Hz(不填则保持不变) */
  to?: number;
  /** 时长(秒) */
  dur: number;
  /** 波形 */
  type?: OscillatorType;
  /** 音量 0~1 */
  vol?: number;
  /** 延迟开始(秒) */
  delay?: number;
}

function tone(ac: AudioContext, opts: ToneOpts): void {
  const t0 = ac.currentTime + (opts.delay ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + opts.dur);
  }
  const vol = opts.vol ?? 0.2;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

function noiseBurst(ac: AudioContext, dur: number, vol: number, delay = 0): void {
  const t0 = ac.currentTime + delay;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(gain).connect(ac.destination);
  src.start(t0);
}

/** 播放一个内置音效;音效开关关闭时静默 */
export function playSound(name: SoundName): void {
  if (!save.isSoundOn()) return;
  const ac = ensureCtx();
  if (!ac) return;

  switch (name) {
    case "tap":
      tone(ac, { freq: 560, dur: 0.07, type: "sine", vol: 0.22 });
      break;
    case "pop":
      tone(ac, { freq: 900, to: 150, dur: 0.1, type: "sine", vol: 0.3 });
      noiseBurst(ac, 0.05, 0.12);
      break;
    case "coin":
      tone(ac, { freq: 988, dur: 0.07, type: "square", vol: 0.12 });
      tone(ac, { freq: 1319, dur: 0.2, type: "square", vol: 0.12, delay: 0.07 });
      break;
    case "win":
      tone(ac, { freq: 523, dur: 0.12, type: "triangle", vol: 0.24 });
      tone(ac, { freq: 659, dur: 0.12, type: "triangle", vol: 0.24, delay: 0.1 });
      tone(ac, { freq: 784, dur: 0.12, type: "triangle", vol: 0.24, delay: 0.2 });
      tone(ac, { freq: 1047, dur: 0.35, type: "triangle", vol: 0.26, delay: 0.3 });
      break;
    case "oops":
      tone(ac, { freq: 320, to: 110, dur: 0.35, type: "sawtooth", vol: 0.14 });
      break;
    case "meow":
      tone(ac, { freq: 620, to: 900, dur: 0.16, type: "sine", vol: 0.2 });
      tone(ac, { freq: 900, to: 480, dur: 0.24, type: "sine", vol: 0.18, delay: 0.16 });
      break;
    case "jump":
      tone(ac, { freq: 190, to: 660, dur: 0.18, type: "square", vol: 0.12 });
      break;
  }
}

/** 切换音效开关,返回新的开关状态 */
export function toggleSound(): boolean {
  const next = !save.isSoundOn();
  save.setSoundOn(next);
  if (next) playSound("tap");
  return next;
}

// ---------------------------------------------------------------------------
// 背景音乐(BGM):五声音阶慢速琶音 + 柔和正弦垫底,全部 Web Audio 合成。
// 乐句由纯函数 generateBgmPhrase(seed) 生成(可单测),真实 AudioContext 只做薄封装。
// ---------------------------------------------------------------------------

/** 五声音阶(宫商角徵羽 = C4 D4 E4 G4 A4),BGM 只用这些音,怎么排都不刺耳 */
export const PENTATONIC_FREQS = [261.63, 293.66, 329.63, 392.0, 440.0] as const;

/** BGM 总线音量上限,柔和垫在音效底下 */
export const BGM_MASTER_GAIN = 0.06;

export interface BgmNote {
  /** 频率 Hz(五声音阶原位或高八度) */
  freq: number;
  /** 相对乐句开头的开始时刻(秒) */
  start: number;
  /** 时值(秒) */
  dur: number;
  /** 相对总线的音量 0~1(实际输出还要乘 BGM_MASTER_GAIN) */
  gain: number;
}

/** mulberry32:小巧的可复现伪随机数,同一 seed 序列完全一致 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 纯函数:给定 seed 生成一段慢速五声琶音乐句。
 * 同一 seed 输出完全相同,不同 seed 基本不重样(循环播放时 seed 递增即可不重复)。
 */
export function generateBgmPhrase(seed: number): BgmNote[] {
  const rand = mulberry32(seed);
  const count = 6 + Math.floor(rand() * 3); // 每句 6~8 个音
  const notes: BgmNote[] = [];
  let t = 0;
  let degree = Math.floor(rand() * PENTATONIC_FREQS.length);
  for (let i = 0; i < count; i++) {
    // 琶音式行进:多数时候走到相邻音级,偶尔跳跃,听感连贯
    const step = rand() < 0.7 ? (rand() < 0.5 ? -1 : 1) : Math.floor(rand() * 5) - 2;
    degree = Math.min(PENTATONIC_FREQS.length - 1, Math.max(0, degree + step));
    const octave = rand() < 0.25 ? 2 : 1; // 偶尔升一个八度,像风铃
    notes.push({
      freq: PENTATONIC_FREQS[degree] * octave,
      start: t,
      dur: 0.9 + rand() * 0.9,
      gain: 0.45 + rand() * 0.3
    });
    t += 0.55 + rand() * 0.55; // 慢速:音与音间隔 0.55~1.1 秒
  }
  return notes;
}

/** 乐句总时长(秒),用来排下一句 */
export function bgmPhraseDuration(notes: BgmNote[]): number {
  let end = 0;
  for (const n of notes) end = Math.max(end, n.start + n.dur);
  return end;
}

let bgmBus: GainNode | null = null;
let bgmPadOscs: OscillatorNode[] = [];
let bgmTimer: number | null = null;
// 从随机乐句起播,每句 seed 递增,循环不重样
let bgmSeed = Math.floor(Math.random() * 1_000_000);
let bgmActive = false;
let bgmPausedByHide = false;

function scheduleBgmPhrase(ac: AudioContext): void {
  if (!bgmActive || !bgmBus) return;
  const notes = generateBgmPhrase(bgmSeed++);
  const t0 = ac.currentTime + 0.05;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(n.freq, t0 + n.start);
    g.gain.setValueAtTime(0, t0 + n.start);
    g.gain.linearRampToValueAtTime(n.gain, t0 + n.start + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
    osc.connect(g).connect(bgmBus);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.dur + 0.05);
  }
  // 提前一点排下一句,衔接不留缝也不叠音
  const waitMs = Math.max(300, (bgmPhraseDuration(notes) - 0.3) * 1000);
  bgmTimer = window.setTimeout(() => scheduleBgmPhrase(ac), waitMs);
}

function startBgmEngine(): void {
  if (bgmActive) return;
  const ac = ensureCtx();
  if (!ac) return;
  bgmActive = true;

  bgmBus = ac.createGain();
  // 慢慢淡入,避免爆音
  bgmBus.gain.setValueAtTime(0.0001, ac.currentTime);
  bgmBus.gain.linearRampToValueAtTime(BGM_MASTER_GAIN, ac.currentTime + 1.2);
  bgmBus.connect(ac.destination);

  // 柔和正弦垫底:低八度的宫音 + 徵音,持续铺在琶音下面
  for (const freq of [130.81, 196.0]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(0.22, ac.currentTime);
    osc.connect(g).connect(bgmBus);
    osc.start();
    bgmPadOscs.push(osc);
  }

  scheduleBgmPhrase(ac);
}

function stopBgmEngine(): void {
  if (!bgmActive) return;
  bgmActive = false;
  if (bgmTimer !== null) {
    window.clearTimeout(bgmTimer);
    bgmTimer = null;
  }
  const bus = bgmBus;
  const pads = bgmPadOscs;
  bgmBus = null;
  bgmPadOscs = [];
  if (bus && ctx) {
    // 快速淡出后再断开,避免爆音
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    window.setTimeout(() => {
      for (const osc of pads) {
        try {
          osc.stop();
        } catch {
          // 已停过就算了
        }
      }
      try {
        bus.disconnect();
      } catch {
        // 已断开就算了
      }
    }, 300);
  }
}

/** 背景音乐当前是否开启(读存档开关) */
export function isBgmOn(): boolean {
  return save.isBgmOn();
}

/** 切换背景音乐,返回新的开关状态;点击本身就是用户手势,可直接起播 */
export function toggleBgm(): boolean {
  const next = !save.isBgmOn();
  save.setBgmOn(next);
  if (next) startBgmEngine();
  else stopBgmEngine();
  return next;
}

// 自动播放策略:上次会话开着 BGM 时,本次要等第一次用户点击才起播;
// 页面切到后台立即暂停,回到前台再续上。
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    () => {
      if (save.isBgmOn()) startBgmEngine();
    },
    { once: true }
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (bgmActive) {
        stopBgmEngine();
        bgmPausedByHide = true;
      }
    } else if (bgmPausedByHide) {
      bgmPausedByHide = false;
      if (save.isBgmOn()) startBgmEngine();
    }
  });
}
