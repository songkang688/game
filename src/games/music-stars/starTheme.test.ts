/**
 * 音乐星星 · 星空主题映射的守门用例（1.3 第 26 步 B 档，只增不减）。
 *
 * 钉死三件事：
 *  1. 彩虹音阶是**只读映射**——音高数据（PENTATONIC_MIDI / DIATONIC_MIDI）
 *     在映射前后一个字不变；
 *  2. 色相沿音阶单调走高（do 红 → si 紫）、同音名不同八度亮度差 ±12%；
 *  3. 音程卡 / 录音条的示意都从题目数据 / 片段数据只读推导，绝不改数据。
 */
import { describe, expect, it } from "vitest";
import { shade } from "../../art/kit/palette";
import { DIATONIC_MIDI, PENTATONIC_MIDI } from "./tuning";
import {
  CLIP_WAVE_MAX_PX,
  CLIP_WAVE_MIN_PX,
  METEOR_TAIL,
  NIGHT_BOTTOM,
  NIGHT_TOP,
  OCTAVE_SHADE_PCT,
  RAINBOW,
  STAFF_GLOW,
  STAFF_LINE_YS,
  WAVE_RING,
  choiceStarGapPx,
  clipWaveHeights,
  degreeOfMidi,
  hueOfHex,
  jellyKeyStyle,
  lumaOfHex,
  noteColorByMidi,
  parseIntervalChoice,
  skyStageSvg,
  skyStageUri,
} from "./starTheme";

describe("音乐星星 1.3 · 彩虹音阶映射（乐理零改动）", () => {
  it("do 到 si 七点色相单调走高：红 → 紫的彩虹助记", () => {
    expect(RAINBOW).toHaveLength(7);
    const hues = RAINBOW.map((c) => hueOfHex(c));
    for (let i = 1; i < hues.length; i++) {
      expect(hues[i], `第 ${i} 级的色相没有比上一级高`).toBeGreaterThan(hues[i - 1]);
    }
    // 七声音阶（C 大调）逐键对上七色；映射前后音高数据一个字不变
    const before = JSON.stringify(DIATONIC_MIDI);
    for (let i = 0; i < 7; i++) {
      expect(noteColorByMidi(DIATONIC_MIDI[i])).toBe(RAINBOW[i]);
    }
    expect(JSON.stringify(DIATONIC_MIDI)).toBe(before);
    expect(PENTATONIC_MIDI).toEqual([60, 62, 64, 67, 69]);
  });

  it("同音名不同八度用亮度 ±12% 区分（两八度抽样）", () => {
    expect(OCTAVE_SHADE_PCT).toBe(12);
    // 高八度的哆 = 本色往白提 12%，低八度 = 往黑压 12%
    expect(noteColorByMidi(72)).toBe(shade(RAINBOW[0], 12));
    expect(noteColorByMidi(48)).toBe(shade(RAINBOW[0], -12));
    expect(lumaOfHex(noteColorByMidi(72))).toBeGreaterThan(lumaOfHex(noteColorByMidi(60)));
    expect(lumaOfHex(noteColorByMidi(48))).toBeLessThan(lumaOfHex(noteColorByMidi(60)));
    // 高八度的拉也一样（第二个抽样：不同级数同样成立）
    expect(noteColorByMidi(81)).toBe(shade(RAINBOW[5], 12));
    // 中央那一组用本色
    expect(noteColorByMidi(69)).toBe(RAINBOW[5]);
  });

  it("级数映射与坏输入：五声五键落在 0/1/2/4/5 级，坏输入不炸", () => {
    expect(PENTATONIC_MIDI.map((m) => degreeOfMidi(m))).toEqual([0, 1, 2, 4, 5]);
    expect(degreeOfMidi(Number.NaN)).toBe(0);
    expect(noteColorByMidi(Number.NaN)).toBe(RAINBOW[0]);
    expect(hueOfHex("不是颜色")).toBe(0);
  });
});

describe("音乐星星 1.3 · 果冻键式样（盒子几何零改动）", () => {
  it("音色渐变 + 顶部 35% 顶光 + 2px 描边 + 底部 2px 暗边，全走 inset box-shadow", () => {
    const s = jellyKeyStyle("#ff6b6b");
    // 顶光弧：白 35% 透明度、35% 处收掉
    expect(s.background).toContain("rgba(255,255,255,0.35) 0%");
    expect(s.background).toContain("0) 35%");
    // 音色三停渐变（受光 → 本色 → 暗部）
    expect(s.background).toContain("#ff6b6b 55%");
    expect(s.background).toContain(shade("#ff6b6b", 40));
    expect(s.background).toContain(shade("#ff6b6b", -22));
    // 描边与底边全是 inset，不占盒子——热区一个像素不动
    expect(s.boxShadow).toBe(
      `inset 0 0 0 2px ${shade("#ff6b6b", -45)},inset 0 -2px 0 ${shade("#ff6b6b", -45)}`
    );
    expect(s.boxShadow).not.toContain("px 0 0 #"); // 没有外扩投影
  });
});

describe("音乐星星 1.3 · 星空舞台（程序化 SVG，无位图）", () => {
  it("五条星轨线各带微光晕，线距在 104px 高的星空上仍 ≥8px", () => {
    expect(STAFF_LINE_YS).toHaveLength(5);
    for (let i = 1; i < STAFF_LINE_YS.length; i++) {
      // viewBox 0–100 拉伸到矮屏星空最矮的 104px：间距 × 1.04 ≥ 8
      expect((STAFF_LINE_YS[i] - STAFF_LINE_YS[i - 1]) * 1.04).toBeGreaterThanOrEqual(8);
    }
    const svg = skyStageSvg();
    // 每条线两笔：宽 2 的光晕 + 宽 0.6 的亮芯
    expect(svg.match(/stroke-width="2"/g)).toHaveLength(5);
    expect(svg.match(/stroke-width="0.6"/g)).toHaveLength(5);
    expect(svg).toContain(STAFF_GLOW);
    // 谱号是星点 + 细线连成的一笔星座
    expect(svg.match(/stroke-width="0.5"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(svg).toContain('r="1.1"');
  });

  it("data-URI 是程序化 SVG 且色板 token 与规格一致", () => {
    const uri = skyStageUri();
    expect(uri.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(uri).not.toContain("base64");
    expect(decodeURIComponent(uri)).toContain("<svg");
    expect(NIGHT_TOP).toBe("#1d2b53");
    expect(NIGHT_BOTTOM).toBe("#3a4a7d");
    expect(STAFF_GLOW).toBe("rgba(180,200,255,.55)");
    expect(WAVE_RING).toBe("rgba(255,255,255,.5)");
    expect(METEOR_TAIL).toBe("rgba(255,246,214,.7)");
  });
});

describe("音乐星星 1.3 · 音程卡与录音条的只读映射", () => {
  it("选项文案解析：往上/往下/一样高，认不出就当 0（绝不改题）", () => {
    expect(parseIntervalChoice("往上 2 格")).toEqual({ dir: 1, steps: 2 });
    expect(parseIntervalChoice("往下 3 格")).toEqual({ dir: -1, steps: 3 });
    expect(parseIntervalChoice("一样高")).toEqual({ dir: 0, steps: 0 });
    expect(parseIntervalChoice("看不懂的文案")).toEqual({ dir: 0, steps: 0 });
    expect(parseIntervalChoice(undefined as unknown as string)).toEqual({ dir: 0, steps: 0 });
  });

  it("音程卡上下两星的距离随格数单调增（三例断言）", () => {
    const g1 = choiceStarGapPx(1);
    const g2 = choiceStarGapPx(2);
    const g4 = choiceStarGapPx(4);
    expect(g2).toBeGreaterThan(g1);
    expect(g4).toBeGreaterThan(g2);
    // 封顶不出卡、坏输入不炸
    expect(choiceStarGapPx(99)).toBeLessThanOrEqual(34);
    expect(choiceStarGapPx(Number.NaN)).toBe(choiceStarGapPx(0));
  });

  it("波形微缩条从片段音符只读推导：不改数据、高度夹在上下限", () => {
    const notes = [
      { at: 0, key: 0, dur: 300 },
      { at: 400, key: 2, dur: 900 },
      { at: 1100, key: 4, dur: 120 },
    ];
    const before = JSON.stringify(notes);
    const bars = clipWaveHeights(notes);
    expect(JSON.stringify(notes)).toBe(before);
    expect(bars).toHaveLength(12);
    for (const h of bars) {
      expect(h).toBeGreaterThanOrEqual(CLIP_WAVE_MIN_PX);
      expect(h).toBeLessThanOrEqual(CLIP_WAVE_MAX_PX);
    }
    // 长音落的那一格比空档高；同一份输入两次输出一致（确定性）
    expect(Math.max(...bars)).toBeGreaterThan(CLIP_WAVE_MIN_PX);
    expect(clipWaveHeights(notes)).toEqual(bars);
    expect(clipWaveHeights([])).toEqual(new Array(12).fill(CLIP_WAVE_MIN_PX));
  });
});
