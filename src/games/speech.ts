/**
 * 朗读小助手（学习类游戏共用）：用浏览器自带的 speechSynthesis 给孩子读题。
 * - 中文语音（zh-CN 优先），语速放慢到 0.85，适合一年级小朋友；
 * - 零新依赖、离线可用（走系统自带语音包）；
 * - 没有语音接口或没有中文语音包时静默降级：speechReady() 返回 false、
 *   speak() 什么也不做，界面据此隐藏朗读按钮，绝不报错。
 */

export const SPEECH_RATE = 0.85;
export const SPEECH_LANG = "zh-CN";

export interface VoiceLike {
  lang: string;
}

interface UtteranceLike {
  lang: string;
  rate: number;
  voice: VoiceLike | null;
}

export interface SynthLike {
  getVoices(): VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  addEventListener?(type: "voiceschanged", listener: () => void): void;
  removeEventListener?(type: "voiceschanged", listener: () => void): void;
}

type UtteranceCtor = new (text: string) => UtteranceLike;
type SpeechGlobals = { speechSynthesis?: SynthLike; SpeechSynthesisUtterance?: UtteranceCtor };

function getSynth(): SynthLike | null {
  const g = globalThis as SpeechGlobals;
  if (!g.speechSynthesis || typeof g.SpeechSynthesisUtterance !== "function") return null;
  return g.speechSynthesis;
}

/** 从语音列表里挑中文语音：zh-CN 优先，其次任何 zh 开头的（zh_CN、zh-TW…） */
export function pickChineseVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const norm = (lang: string) => lang.toLowerCase().replace(/_/g, "-");
  return (
    voices.find((v) => norm(v.lang) === "zh-cn") ??
    voices.find((v) => norm(v.lang).startsWith("zh")) ??
    null
  );
}

/** 现在就能用中文朗读吗（有接口、且系统装了中文语音包） */
export function speechReady(): boolean {
  const synth = getSynth();
  if (!synth) return false;
  try {
    return pickChineseVoice(synth.getVoices()) !== null;
  } catch {
    return false;
  }
}

/**
 * 语音包可能异步加载（Chrome 的 voiceschanged 事件）：就绪后回调一次。
 * 返回取消函数；环境完全不支持时回调永远不会来，界面保持按钮隐藏即可。
 */
export function whenSpeechReady(onReady: () => void): () => void {
  if (speechReady()) {
    onReady();
    return () => {};
  }
  const synth = getSynth();
  if (!synth || typeof synth.addEventListener !== "function") return () => {};
  const listener = (): void => {
    if (!speechReady()) return;
    unsubscribe();
    onReady();
  };
  const unsubscribe = (): void => synth.removeEventListener?.("voiceschanged", listener);
  synth.addEventListener("voiceschanged", listener);
  return unsubscribe;
}

/** 去掉表情符号等念不出来的字符，只留下真正要读的话 */
export function speechText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 朗读一句话（自动停掉上一句，切题不叠音）。
 * @returns 是否真的开始朗读；没有中文语音包时返回 false 且毫无副作用
 */
export function speak(text: string): boolean {
  const synth = getSynth();
  const Utterance = (globalThis as SpeechGlobals).SpeechSynthesisUtterance;
  if (!synth || typeof Utterance !== "function") return false;
  try {
    const voice = pickChineseVoice(synth.getVoices());
    if (!voice) return false;
    const line = speechText(text);
    if (!line) return false;
    synth.cancel();
    const u = new Utterance(line);
    u.lang = SPEECH_LANG;
    u.rate = SPEECH_RATE;
    u.voice = voice;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** 停止朗读（切题、退出关卡、销毁游戏时调用，防止叠音）。静默：朗读永远不该把游戏搞崩 */
export function stopSpeaking(): void {
  try {
    getSynth()?.cancel();
  } catch { /* 忽略 */ }
}
