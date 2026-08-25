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
