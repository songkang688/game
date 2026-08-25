import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BGM_MASTER_GAIN,
  PENTATONIC_FREQS,
  bgmPhraseDuration,
  generateBgmPhrase,
  isBgmOn,
  playSound,
  toggleBgm
} from "./audio";
import type { SoundName } from "./types";

// ---------------------------------------------------------------------------
// BGM 乐句生成器(纯函数)
// ---------------------------------------------------------------------------

describe("generateBgmPhrase 五声琶音生成器", () => {
  it("同一 seed 输出完全相同的乐句(可复现)", () => {
    expect(generateBgmPhrase(123)).toEqual(generateBgmPhrase(123));
    expect(generateBgmPhrase(0)).toEqual(generateBgmPhrase(0));
  });

  it("连续 200 个 seed 的乐句互不重样(循环播放不重复)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      seen.add(JSON.stringify(generateBgmPhrase(seed)));
    }
    expect(seen.size).toBe(200);
  });

  it("所有音符都落在五声音阶(原位或高八度)上", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const note of generateBgmPhrase(seed)) {
        const inScale = PENTATONIC_FREQS.some(
          (base) => Math.abs(note.freq - base) < 1e-6 || Math.abs(note.freq - base * 2) < 1e-6
        );
        expect(inScale).toBe(true);
      }
    }
  });

  it("音符按时间先后排列,是慢速琶音(间隔不小于 0.5 秒)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const notes = generateBgmPhrase(seed);
      expect(notes.length).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < notes.length; i++) {
        expect(notes[i].dur).toBeGreaterThan(0);
        if (i > 0) {
          expect(notes[i].start - notes[i - 1].start).toBeGreaterThanOrEqual(0.5);
        }
      }
      expect(bgmPhraseDuration(notes)).toBeGreaterThan(0);
    }
  });

  it("音符相对音量都在 0~1 之间,BGM 总线音量不超过 0.06", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const note of generateBgmPhrase(seed)) {
        expect(note.gain).toBeGreaterThan(0);
        expect(note.gain).toBeLessThanOrEqual(1);
      }
    }
    expect(BGM_MASTER_GAIN).toBeLessThanOrEqual(0.06);
  });
});

// ---------------------------------------------------------------------------
// 音效回归:7 种音效在假 AudioContext 下都能正常触发合成
// ---------------------------------------------------------------------------

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type = "sine";
  buffer: unknown = null;
  connect = vi.fn(<T>(target: T): T => target);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

function makeFakeAudioContext(): { Ctor: new () => unknown; counters: { oscillators: number } } {
  const counters = { oscillators: 0 };
  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 44100;
    state = "running";
    destination = new FakeNode();
    createOscillator(): FakeNode {
      counters.oscillators += 1;
      return new FakeNode();
    }
    createGain(): FakeNode {
      return new FakeNode();
    }
    createBuffer(_channels: number, frames: number): { getChannelData: () => Float32Array } {
      const data = new Float32Array(frames);
      return { getChannelData: () => data };
    }
    createBufferSource(): FakeNode {
      return new FakeNode();
    }
    resume(): Promise<void> {
      return Promise.resolve();
    }
  }
  return { Ctor: FakeAudioContext, counters };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playSound 音效回归", () => {
  it("7 种内置音效都能正常触发合成,不报错", () => {
    const { Ctor, counters } = makeFakeAudioContext();
    vi.stubGlobal("window", { AudioContext: Ctor, setTimeout, clearTimeout });

    const all: SoundName[] = ["tap", "win", "oops", "coin", "pop", "meow", "jump"];
    for (const name of all) {
      expect(() => playSound(name)).not.toThrow();
    }
    // 每种音效至少各起了一个振荡器
    expect(counters.oscillators).toBeGreaterThanOrEqual(all.length);
  });
});

describe("toggleBgm 背景音乐开关", () => {
  it("默认关;切换会翻转存档里的 bgmOn,在无音频环境下也不报错", () => {
    expect(isBgmOn()).toBe(false);
    expect(toggleBgm()).toBe(true);
    expect(isBgmOn()).toBe(true);
    expect(toggleBgm()).toBe(false);
    expect(isBgmOn()).toBe(false);
  });
});
