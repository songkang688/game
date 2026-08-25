import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pickChineseVoice,
  speak,
  SPEECH_LANG,
  SPEECH_RATE,
  speechReady,
  speechText,
  stopSpeaking,
  whenSpeechReady,
} from "./speech";

interface MockVoice {
  lang: string;
  name: string;
}

/** 造一个假的 speechSynthesis + SpeechSynthesisUtterance 挂到 globalThis 上 */
function installMockSynth(voices: MockVoice[]) {
  const spoken: Array<{ text: string; lang: string; rate: number; voice: MockVoice | null }> = [];
  const listeners = new Set<() => void>();
  let cancelCount = 0;
  const synth = {
    getVoices: () => voices.slice(),
    speak(u: { text: string; lang: string; rate: number; voice: MockVoice | null }) {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice });
    },
    cancel() {
      cancelCount++;
    },
    addEventListener(_type: string, cb: () => void) {
      listeners.add(cb);
    },
    removeEventListener(_type: string, cb: () => void) {
      listeners.delete(cb);
    },
  };
  class MockUtterance {
    text: string;
    lang = "";
    rate = 1;
    voice: MockVoice | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const g = globalThis as Record<string, unknown>;
  g.speechSynthesis = synth;
  g.SpeechSynthesisUtterance = MockUtterance;
  return {
    spoken,
    fireVoicesChanged: () => [...listeners].forEach((cb) => cb()),
    listenerCount: () => listeners.size,
    cancelCount: () => cancelCount,
    setVoices: (v: MockVoice[]) => {
      voices.length = 0;
      voices.push(...v);
    },
  };
}

function uninstallMockSynth(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.speechSynthesis;
  delete g.SpeechSynthesisUtterance;
}

const ZH_CN: MockVoice = { lang: "zh-CN", name: "婷婷" };
const ZH_TW: MockVoice = { lang: "zh_TW", name: "美佳" };
const EN: MockVoice = { lang: "en-US", name: "Alice" };

afterEach(() => {
  uninstallMockSynth();
  vi.restoreAllMocks();
});

describe("speech 朗读模块：选音与降级", () => {
  it("优先挑 zh-CN，其次任何 zh 开头（大小写与下划线都认）", () => {
    expect(pickChineseVoice([EN, ZH_TW, ZH_CN])).toBe(ZH_CN);
    expect(pickChineseVoice([EN, ZH_TW])).toBe(ZH_TW);
    expect(pickChineseVoice([{ lang: "ZH_cn", name: "x" }, ZH_TW])?.name).toBe("x");
    expect(pickChineseVoice([EN])).toBeNull();
    expect(pickChineseVoice([])).toBeNull();
  });

  it("没有 speechSynthesis 时（多数 Linux CI）：全部静默降级、不报错", () => {
    expect(speechReady()).toBe(false);
    expect(speak("你好")).toBe(false);
    expect(() => stopSpeaking()).not.toThrow();
    const cb = vi.fn();
    const un = whenSpeechReady(cb);
    expect(cb).not.toHaveBeenCalled();
    expect(() => un()).not.toThrow();
  });

  it("有接口但只有英文语音包：同样静默降级", () => {
    const mock = installMockSynth([EN]);
    expect(speechReady()).toBe(false);
    expect(speak("你好")).toBe(false);
    expect(mock.spoken).toHaveLength(0);
  });
});

describe("speech 朗读模块：正常朗读", () => {
  it("用 zh-CN 语音、0.85 语速朗读，且先 cancel 防叠音", () => {
    const mock = installMockSynth([EN, ZH_CN]);
    expect(speechReady()).toBe(true);
    expect(speak("哪个是小猫的猫？")).toBe(true);
    expect(mock.spoken).toHaveLength(1);
    expect(mock.spoken[0].text).toBe("哪个是小猫的猫？");
    expect(mock.spoken[0].lang).toBe(SPEECH_LANG);
    expect(mock.spoken[0].rate).toBe(SPEECH_RATE);
    expect(mock.spoken[0].voice).toBe(ZH_CN);
    expect(mock.cancelCount()).toBe(1);
    // 连续朗读：每次都先 cancel
    speak("答对啦！");
    expect(mock.cancelCount()).toBe(2);
    expect(mock.spoken).toHaveLength(2);
  });

  it("表情符号会被去掉，只念文字；全是表情就干脆不念", () => {
    const mock = installMockSynth([ZH_CN]);
    expect(speechText("🔥 连对 4 题，奖励一颗小星星！")).toBe("连对 4 题，奖励一颗小星星！");
    expect(speechText("⬜ 里应该填几？")).toBe("里应该填几？");
    expect(speak("🔈🌈✨")).toBe(false);
    expect(mock.spoken).toHaveLength(0);
  });

  it("stopSpeaking 调用 cancel", () => {
    const mock = installMockSynth([ZH_CN]);
    stopSpeaking();
    expect(mock.cancelCount()).toBe(1);
  });
});

describe("speech 朗读模块：语音包异步加载", () => {
  it("就绪时立刻回调；未就绪时等 voiceschanged 再回调一次并自动退订", () => {
    const mock = installMockSynth([ZH_CN]);
    const now = vi.fn();
    whenSpeechReady(now);
    expect(now).toHaveBeenCalledTimes(1);

    mock.setVoices([]);
    const later = vi.fn();
    whenSpeechReady(later);
    expect(later).not.toHaveBeenCalled();
    expect(mock.listenerCount()).toBe(1);
    // 语音包到了
    mock.setVoices([ZH_CN]);
    mock.fireVoicesChanged();
    expect(later).toHaveBeenCalledTimes(1);
    expect(mock.listenerCount()).toBe(0);
    // 再触发也不会重复回调
    mock.fireVoicesChanged();
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("取消函数能在就绪前退订", () => {
    const mock = installMockSynth([]);
    const cb = vi.fn();
    const un = whenSpeechReady(cb);
    expect(mock.listenerCount()).toBe(1);
    un();
    expect(mock.listenerCount()).toBe(0);
    mock.setVoices([ZH_CN]);
    mock.fireVoicesChanged();
    expect(cb).not.toHaveBeenCalled();
  });
});
