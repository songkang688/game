/**
 * 音符下落 · 音高合成(规格第三节第 5 条、第十五节)。
 *
 * 全部音高都是 Web Audio 振荡器现场算出来的:没有 mp3、没有任何外部音频文件,
 * 旋律只在五声音阶上跑。destroy 之后 AudioContext 必须被 close。
 */
import { describe, expect, it } from "vitest";
import {
  A4_HZ,
  MAX_DEGREE,
  PENTATONIC,
  createToneKit,
  degreeFreq,
  laneDegree,
  semitoneFreq,
} from "./audio";
import { FakeAudioContext } from "./domStub";

function hostWith(): { host: { AudioContext: typeof FakeAudioContext }; made: FakeAudioContext[] } {
  const made: FakeAudioContext[] = [];
  class Tracked extends FakeAudioContext {
    constructor() {
      super();
      made.push(this);
    }
  }
  return { host: { AudioContext: Tracked }, made };
}

describe("音阶换算", () => {
  it("A4 就是 440,C4 差 9 个半音", () => {
    expect(semitoneFreq(0)).toBe(A4_HZ);
    expect(degreeFreq(0)).toBeCloseTo(261.63, 1);
  });

  it("五声音阶一级比一级高,跨八度也接得上", () => {
    expect(PENTATONIC).toEqual([0, 2, 4, 7, 9]);
    for (let d = 1; d <= MAX_DEGREE; d++) {
      expect(degreeFreq(d), `第 ${d} 级`).toBeGreaterThan(degreeFreq(d - 1));
    }
    expect(degreeFreq(5)).toBeCloseTo(degreeFreq(0) * 2, 1);
  });

  it("音区温和:最高一级也没到刺耳的高频", () => {
    expect(degreeFreq(MAX_DEGREE)).toBeLessThan(1400);
    expect(degreeFreq(99)).toBe(degreeFreq(MAX_DEGREE));
    expect(degreeFreq(-5)).toBe(degreeFreq(0));
  });

  it("轨道打底、连击往上推,所以连得越长听上去越往上走", () => {
    expect(laneDegree(0, 0)).toBe(0);
    expect(laneDegree(3, 0)).toBe(3);
    expect(laneDegree(0, 4)).toBeGreaterThan(laneDegree(0, 1));
    expect(laneDegree(3, 999)).toBeLessThanOrEqual(MAX_DEGREE);
  });
});

describe("音色套件", () => {
  it("不发声就不建 AudioContext(自动播放策略友好)", () => {
    const { host, made } = hostWith();
    const kit = createToneKit(host);
    expect(kit.live).toBe(false);
    expect(made).toHaveLength(0);
    kit.close();
  });

  it("命中会真的合成音高,完美比良好多一层泛音", () => {
    const { host, made } = hostWith();
    const kit = createToneKit(host);
    kit.hit("good", 1, 1);
    expect(made).toHaveLength(1);
    const afterGood = made[0].tones;
    expect(afterGood).toBe(1);
    kit.hit("perfect", 1, 1);
    expect(made[0].tones - afterGood).toBe(2);
    expect(made[0].freqs.every((f) => f > 100 && f < 3000)).toBe(true);
    kit.close();
  });

  it("溜走的音符只发一声很轻的低音", () => {
    const { host, made } = hostWith();
    const kit = createToneKit(host);
    kit.miss();
    expect(made[0].freqs).toHaveLength(1);
    expect(made[0].freqs[0]).toBeLessThan(degreeFreq(0));
    kit.close();
  });

  it("静音之后一个音都不发,也不会建上下文", () => {
    const { host, made } = hostWith();
    const kit = createToneKit(host);
    kit.setMuted(true);
    kit.hit("perfect", 0, 5);
    expect(kit.muted).toBe(true);
    expect(made).toHaveLength(0);
    kit.close();
  });

  it("close 之后上下文被关掉,再点也不会又开一个", () => {
    const { host, made } = hostWith();
    const kit = createToneKit(host);
    kit.hit("perfect", 2, 3);
    expect(made).toHaveLength(1);
    kit.close();
    expect(kit.closed).toBe(true);
    expect(made[0].closedTimes).toBe(1);
    expect(made[0].state).toBe("closed");
    kit.hit("perfect", 2, 4);
    expect(made).toHaveLength(1);
  });

  it("拿不到 AudioContext 就整只静音降级,接口照样能调", () => {
    const kit = createToneKit({});
    expect(() => {
      kit.hit("perfect", 0, 1);
      kit.holdStart(1, 2);
      kit.miss();
      kit.close();
    }).not.toThrow();
    expect(kit.live).toBe(false);
    expect(kit.closed).toBe(true);
  });
});
