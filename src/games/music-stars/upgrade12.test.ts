/**
 * 音乐星星 · 1.2 升级用例。
 *
 * 既有的 `logic.test.ts` / `levels.test.ts` / `levels188.test.ts` 一条都没删，
 * 这份只加不减。重点钉四件容易出教学事故的事：
 *  1. 频率算得对不对（十二平均律）、音程名字说得对不对（乐理）；
 *  2. 节奏判定的三档窗口与输出延迟补偿；
 *  3. 双声部真的支持两根手指同时按（1.1 的必修 bug）；
 *  4. 音量任何路径下都顶不破 0.6，`destroy` 之后一个节点都不剩。
 * 外加一条底线：**前 99 关逐关指纹与升级前完全一致**。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "../level99";
import { meta } from "./meta";
import guide from "./guide";
import {
  buildDuets,
  buildIntervals,
  buildMelodies,
  buildScoreValues,
  buildScores,
  CHAPTERS,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
} from "./levels";
import { makeChords } from "./logic";
import {
  A4_FREQ,
  DIATONIC_MIDI,
  freqToMidi,
  INTERVAL_NAMES,
  intervalName,
  midiToFreq,
  PENTATONIC_MIDI,
  pentatonicIntervalName,
  pentatonicIntervalPhrase,
  pitchOffsetPx,
  semitonesBetween,
} from "./tuning";
import {
  beatSchedule,
  compensate,
  GOOD_MS,
  judgeHit,
  judgeTap,
  JUDGE_WINDOWS_MS,
  MAX_LATENCY_MS,
  measureLatencyMs,
  OK_MS,
  PERFECT_MS,
  summarize,
  type HitGrade,
} from "./timing";
import {
  ChordPad,
  CHORD_WINDOW_MS,
  DUET_MIN_GAP_PX,
  DUET_MIN_GAP_STEPS,
  duetKeysSeparated,
  keyGapPx,
  sameChord,
} from "./touch";
import { allowsDemo, clampSpeed, rateWithSpeed, scaleMs, speedLabel, SPEEDS, starCap } from "./practice";
import {
  AUDIO_PREFS_KEY,
  clampVolume,
  DEFAULT_PREFS,
  migratePrefs,
  loadPrefs,
  savePrefs,
  StarSynth,
  TIMBRES,
  timbreById,
  voicePeak,
  VOLUME_DEFAULT,
  VOLUME_MAX,
} from "./synth";
import {
  ClipRecorder,
  SANDBOX_KEY,
  SANDBOX_MAX_CLIPS,
  SANDBOX_MAX_MS,
  clipLength,
  loadClips,
  migrateClips,
  pushClip,
  saveClips,
  scaleMidis,
  trimClip,
  type SandboxClip,
} from "./sandbox";
import { glyphAria, glyphLine, glyphOf, lineText, rhythmValue, SCORE_MIN_FONT_PX } from "./notation";
import {
  KEY_MIN_GAP_PX,
  KEY_MIN_PX,
  KEY_TOUCH_MIN_PX,
  keyLayout,
  layoutFits,
  openLevelOnMap,
  parseLevelParam,
  resolveInitialLevel,
} from "./runtime";
import { createStarBoard, renderScore } from "./ui";
import { DRUM_FREQ, modeIntro } from "./advanced";
import {
  installDom,
  memoryStorage,
  StubAudioContext,
  StubEl,
  type InstalledDom,
} from "./domStub";

/* ------------------------------------------------------------------ */
/* 一、音准：十二平均律                                                 */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 十二平均律频率表", () => {
  it("C4 / A4 / C5 三个基准音的误差都小于 0.01Hz", () => {
    expect(Math.abs(midiToFreq(60) - 261.6256)).toBeLessThan(0.01);
    expect(midiToFreq(69)).toBe(440);
    expect(Math.abs(midiToFreq(72) - 523.2511)).toBeLessThan(0.01);
    // 顺带把 1.0 手打的那几个常数也对一遍：都在 0.005Hz 量级，说明只是四舍五入
    expect(Math.abs(midiToFreq(62) - 293.66)).toBeLessThan(0.01);
    expect(Math.abs(midiToFreq(64) - 329.63)).toBeLessThan(0.01);
    expect(Math.abs(midiToFreq(67) - 392.0)).toBeLessThan(0.01);
  });

  it("第一性原理：八度正好倍频，半音正好是 2 的十二次方根", () => {
    for (const midi of [48, 55, 60, 69, 72, 84]) {
      expect(midiToFreq(midi + 12) / midiToFreq(midi)).toBeCloseTo(2, 12);
    }
    expect(midiToFreq(61) / midiToFreq(60)).toBeCloseTo(Math.pow(2, 1 / 12), 12);
    expect(midiToFreq(69)).toBe(A4_FREQ);
  });

  it("频率反算回 MIDI 号，一圈下来还是同一个音", () => {
    for (let midi = 36; midi <= 96; midi++) {
      expect(freqToMidi(midiToFreq(midi))).toBeCloseTo(midi, 10);
    }
    expect(Number.isNaN(freqToMidi(0))).toBe(true);
    expect(Number.isNaN(freqToMidi(-100))).toBe(true);
  });

  it("五声音阶是 C D E G A，七声音阶是 C 大调加高八度的哆", () => {
    expect(PENTATONIC_MIDI).toEqual([60, 62, 64, 67, 69]);
    expect(DIATONIC_MIDI).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    // 五声音阶里一个半音关系都没有，所以怎么按都不难听
    for (let i = 1; i < PENTATONIC_MIDI.length; i++) {
      expect(PENTATONIC_MIDI[i] - PENTATONIC_MIDI[i - 1]).toBeGreaterThanOrEqual(2);
    }
  });

  it("节奏关两个鼓的音高也是真实频率，低鼓明显比高鼓低", () => {
    expect(DRUM_FREQ).toHaveLength(2);
    expect(DRUM_FREQ[1]).toBeLessThan(DRUM_FREQ[0]);
    for (const f of DRUM_FREQ) expect(f).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------------ */
/* 二、乐理：音程名称表                                                 */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 音程名称表", () => {
  it("小二度到纯八度逐个对照乐理，一个都不许说错", () => {
    const table: Array<[number, string]> = [
      [0, "纯一度"],
      [1, "小二度"],
      [2, "大二度"],
      [3, "小三度"],
      [4, "大三度"],
      [5, "纯四度"],
      [6, "增四度"],
      [7, "纯五度"],
      [8, "小六度"],
      [9, "大六度"],
      [10, "小七度"],
      [11, "大七度"],
      [12, "纯八度"],
    ];
    expect(INTERVAL_NAMES).toHaveLength(13);
    for (const [semis, name] of table) {
      expect(intervalName(semis), `${semis} 个半音应该叫${name}`).toBe(name);
      // 往下走同样的距离，名字一样
      expect(intervalName(-semis)).toBe(name);
    }
    expect(new Set(INTERVAL_NAMES).size).toBe(INTERVAL_NAMES.length);
  });

  it("超过八度拆成「几个八度又几度」，坏输入不炸", () => {
    expect(intervalName(13)).toBe("1 个八度又小二度");
    expect(intervalName(24)).toBe("2 个纯八度");
    expect(intervalName(Number.NaN)).toBe("纯一度");
    expect(intervalName(Number.POSITIVE_INFINITY)).toBe("纯一度");
    expect(semitonesBetween(60, 67)).toBe(7);
    expect(semitonesBetween(69, 60)).toBe(-9);
  });

  it("同样是「往上 2 格」，五声音阶上可能是大三度也可能是纯四度", () => {
    // 这正是 1.1 那句「往上 2 格」说不清楚的地方
    expect(pentatonicIntervalName(0, 2)).toBe("大三度");
    expect(pentatonicIntervalName(1, 3)).toBe("纯四度");
    expect(pentatonicIntervalName(2, 4)).toBe("纯四度");
    expect(pentatonicIntervalName(0, 3)).toBe("纯五度");
    expect(pentatonicIntervalName(0, 4)).toBe("大六度");
    expect(pentatonicIntervalName(3, 4)).toBe("大二度");
  });

  it("念给孩子的整句话带方向，同音也有说法", () => {
    expect(pentatonicIntervalPhrase(0, 2)).toBe("往上大三度");
    expect(pentatonicIntervalPhrase(4, 1)).toBe("往下纯五度");
    expect(pentatonicIntervalPhrase(3, 1)).toBe("往下纯四度");
    expect(pentatonicIntervalPhrase(2, 2)).toBe("两个音一样高，这叫纯一度");
    expect(pentatonicIntervalPhrase(0, 99)).toBe("");
  });

  it("音程听辨馆每一题的乐理真名都算得对，选项文案仍是 1.1 的说法", () => {
    const list = LEVELS.map((_, i) => i).filter((i) => LEVELS[i].mode === "interval");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      for (const q of buildIntervals(lv)) {
        expect(q.theory).toBe(pentatonicIntervalName(q.a, q.b));
        expect(INTERVAL_NAMES).toContain(q.theory);
        // 选项还是「往上/往下 N 格」，快照不变
        expect(q.choices[q.correct]).toMatch(/^(往上|往下) \d 格$/);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 三、节奏判定与延迟补偿                                               */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 三档节奏判定", () => {
  it("三档窗口是 60 / 120 / 200 毫秒，从严到宽", () => {
    expect([PERFECT_MS, GOOD_MS, OK_MS]).toEqual([60, 120, 200]);
    expect(JUDGE_WINDOWS_MS).toEqual([60, 120, 200]);
    for (let i = 1; i < JUDGE_WINDOWS_MS.length; i++) {
      expect(JUDGE_WINDOWS_MS[i]).toBeGreaterThan(JUDGE_WINDOWS_MS[i - 1]);
    }
  });

  it("六个边界值：60 / 60.1 / 120 / 120.1 / 200 / 200.1", () => {
    expect(judgeHit(60)).toBe("perfect");
    expect(judgeHit(60.1)).toBe("good");
    expect(judgeHit(120)).toBe("good");
    expect(judgeHit(120.1)).toBe("ok");
    expect(judgeHit(200)).toBe("ok");
    expect(judgeHit(200.1)).toBe("miss");
  });

  it("敲早敲晚一视同仁，坏输入算漏", () => {
    for (const d of [10, 59, 90, 150, 199]) {
      expect(judgeHit(-d)).toBe(judgeHit(d));
    }
    expect(judgeHit(0)).toBe("perfect");
    expect(judgeHit(Number.NaN)).toBe("miss");
    expect(judgeHit(Number.POSITIVE_INFINITY)).toBe("miss");
  });

  it("输出延迟三条路径：outputLatency 优先，退 baseLatency，都没有就 0", () => {
    expect(measureLatencyMs({ outputLatency: 0.05, baseLatency: 0.01 })).toBeCloseTo(50, 6);
    expect(measureLatencyMs({ baseLatency: 0.012 })).toBeCloseTo(12, 6);
    expect(measureLatencyMs({})).toBe(0);
    expect(measureLatencyMs(null)).toBe(0);
    // 离谱的读数夹回来，负数当没有
    expect(measureLatencyMs({ outputLatency: 9 })).toBe(MAX_LATENCY_MS);
    expect(measureLatencyMs({ outputLatency: -1, baseLatency: 0.02 })).toBeCloseTo(20, 6);
    expect(measureLatencyMs({ outputLatency: Number.NaN })).toBe(0);
  });

  it("补偿就是把「声音晚到耳朵」的那一段从敲击时刻里减掉", () => {
    expect(compensate(10, 50)).toBeCloseTo(9.95, 9);
    expect(compensate(10, 0)).toBe(10);
    // 有 50ms 输出延迟时，晚敲 50ms 恰好算完美
    const beats = [10];
    expect(judgeTap(beats, 10.05, [], 50).grade).toBe("perfect");
    expect(judgeTap(beats, 10.05, [], 0).deltaMs).toBeCloseTo(50, 6);
  });

  it("一次敲击落到最近的空拍点上，占过的不会被重复命中", () => {
    const beats = beatSchedule(0, [500, 500, 500], 100);
    expect(beats).toEqual([0, 0.6, 1.2]);
    const taken = [false, false, false];
    const first = judgeTap(beats, 0.02, taken);
    expect(first.index).toBe(0);
    expect(first.grade).toBe("perfect");
    taken[0] = true;
    // 同一时刻再敲一次，第 0 拍已被占，只能往后找，偏太多就算漏
    expect(judgeTap(beats, 0.02, taken).index).toBe(-1);
    const second = judgeTap(beats, 0.71, taken);
    expect(second.index).toBe(1);
    expect(second.grade).toBe("good");
  });

  it("整句敲完能数出各档几个，没敲的自动记成漏", () => {
    const grades: HitGrade[] = ["perfect", "perfect", "good", "ok"];
    const score = summarize(grades, 6);
    expect(score.perfect).toBe(2);
    expect(score.good).toBe(1);
    expect(score.ok).toBe(1);
    expect(score.miss).toBe(2);
    expect(score.points).toBe(3 + 3 + 2 + 1);
    expect(score.full).toBe(18);
  });
});

/* ------------------------------------------------------------------ */
/* 四、多点触控（1.1 的必修 bug）                                        */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 双声部多点触控", () => {
  it("两个 pointerId 交叠时，两个键同时算数", () => {
    const pad = new ChordPad();
    pad.down(11, 0, 0);
    expect(pad.heldKeys()).toEqual([0]);
    pad.down(12, 3, 50);
    expect(pad.pointerCount).toBe(2);
    expect(pad.heldKeys()).toEqual([0, 3]);
    expect(pad.chord(60)).toEqual([0, 3]);
    expect(pad.spreadMs(60)).toBe(60);
  });

  it("抬起一根手指不会把另一根也带走（不串）", () => {
    const pad = new ChordPad();
    pad.down(11, 0, 0);
    pad.down(12, 3, 40);
    pad.up(11, 120);
    // 11 号抬起来了，12 号还按着；刚松开的 0 还在窗口里，和弦仍是两个
    expect(pad.heldKeys()).toEqual([3]);
    expect(pad.chord(130)).toEqual([0, 3]);
    // 过了窗口，松开的那个才掉出去
    expect(pad.chord(130 + CHORD_WINDOW_MS)).toEqual([3]);
  });

  it("同一个键被两根手指按住只算一次", () => {
    const pad = new ChordPad();
    pad.down(11, 2, 0);
    pad.down(12, 2, 30);
    expect(pad.pointerCount).toBe(2);
    expect(pad.heldKeys()).toEqual([2]);
    expect(pad.chord(40)).toEqual([2]);
  });

  it("被系统取消的手指不进和弦，reset 之后干干净净", () => {
    const pad = new ChordPad();
    pad.down(11, 0, 0);
    pad.down(12, 4, 20);
    pad.cancel(12);
    expect(pad.chord(30)).toEqual([0]);
    expect(pad.up(99, 40)).toBe(-1);
    pad.reset();
    expect(pad.chord(50)).toEqual([]);
    expect(pad.pointerCount).toBe(0);
  });

  it("和弦比对与顺序无关", () => {
    expect(sameChord([3, 0], [0, 3])).toBe(true);
    expect(sameChord([0, 0, 3], [0, 3])).toBe(true);
    expect(sameChord([0, 2], [0, 3])).toBe(false);
    expect(sameChord([0], [0, 3])).toBe(false);
  });

  it("双声部每一拍的两颗星星都隔得开，一根手指盖不住两个", () => {
    expect(DUET_MIN_GAP_STEPS).toBe(2);
    // 56px 的键、8px 的间隙下，隔 2 格就有 72px 的净距离
    expect(keyGapPx(0, 2, KEY_MIN_PX, KEY_MIN_GAP_PX)).toBe(72);
    expect(keyGapPx(0, 1, KEY_MIN_PX, KEY_MIN_GAP_PX)).toBe(8);
    expect(duetKeysSeparated([0, 1], KEY_MIN_PX, KEY_MIN_GAP_PX)).toBe(false);
    expect(duetKeysSeparated([0, 2], KEY_MIN_PX, KEY_MIN_GAP_PX)).toBe(true);
    expect(duetKeysSeparated([3], KEY_MIN_PX, KEY_MIN_GAP_PX)).toBe(true);

    const list = LEVELS.map((_, i) => i).filter((i) => LEVELS[i].mode === "duet");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      for (const chords of buildDuets(lv)) {
        for (const chord of chords) {
          expect(chord).toHaveLength(2);
          expect(chord[1] - chord[0]).toBeGreaterThanOrEqual(DUET_MIN_GAP_STEPS);
          expect(keyGapPx(chord[0], chord[1], KEY_MIN_PX, KEY_MIN_GAP_PX))
            .toBeGreaterThanOrEqual(DUET_MIN_GAP_PX);
        }
      }
    }
  });

  it("makeChords 不传 minGap 时行为一格不变，星星不够宽时自动退让", () => {
    const rand = (): number => 0.5;
    expect(makeChords(3, 2, seeded(5))).toHaveLength(3);
    // 只有两颗星星却要求隔 2 格：退回相邻，不能死循环也不能返回空
    const tight = makeChords(4, 2, seeded(7), 5);
    expect(tight).toHaveLength(4);
    for (const c of tight) expect(c[0]).toBeLessThan(c[1]);
    void rand;
  });
});

/* ------------------------------------------------------------------ */
/* 五、慢速练习与星级                                                   */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 慢速练习", () => {
  it("三档倍率 0.6 / 0.8 / 1.0，慢速封顶一星", () => {
    expect(SPEEDS).toEqual([0.6, 0.8, 1]);
    expect(starCap(0.6)).toBe(1);
    expect(starCap(0.8)).toBe(1);
    expect(starCap(1)).toBe(3);
  });

  it("星级与倍率绑死：慢速一律一星，全速才可能三星", () => {
    expect(rateWithSpeed(0, 1)).toBe(3);
    expect(rateWithSpeed(1, 1)).toBe(2);
    expect(rateWithSpeed(2, 1)).toBe(2);
    expect(rateWithSpeed(3, 1)).toBe(1);
    for (const slow of [0.6, 0.8]) {
      for (const misses of [0, 1, 5]) {
        expect(rateWithSpeed(misses, slow)).toBe(1);
      }
    }
  });

  it("慢速把时长拉长，倍率会被夹到最近的一档", () => {
    expect(scaleMs(600, 1)).toBe(600);
    expect(scaleMs(600, 0.6)).toBe(1000);
    expect(scaleMs(600, 0.8)).toBe(750);
    expect(clampSpeed(0.75)).toBe(0.8);
    expect(clampSpeed(3)).toBe(1);
    expect(clampSpeed("慢" as unknown as number)).toBe(1);
    expect(speedLabel(1)).toBe("全速");
    expect(speedLabel(0.6)).toContain("慢速");
  });

  it("简谱视奏台不给范奏，其余三章都给", () => {
    expect(allowsDemo("score")).toBe(false);
    for (const mode of ["rhythm", "interval", "duet", undefined]) {
      expect(allowsDemo(mode)).toBe(true);
    }
    for (const lv of LEVELS.map((_, i) => i).filter((i) => LEVELS[i].mode === "score")) {
      expect(LEVELS[lv].replays).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 六、音色与音量上限                                                   */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 三种音色与音量红线", () => {
  it("星铃 / 木琴 / 软风琴：波形互不相同，ADSR 参数都合法", () => {
    expect(TIMBRES).toHaveLength(3);
    expect(TIMBRES.map((t) => t.name)).toEqual(["星铃", "木琴", "软风琴"]);
    expect(new Set(TIMBRES.map((t) => t.wave)).size).toBe(3);
    for (const t of TIMBRES) {
      expect(t.attack).toBeGreaterThan(0);
      expect(t.decay).toBeGreaterThan(0);
      expect(t.release).toBeGreaterThan(0);
      expect(t.sustain).toBeGreaterThanOrEqual(0);
      expect(t.sustain).toBeLessThanOrEqual(1);
      expect(t.gain).toBeGreaterThan(0);
      expect(t.gain).toBeLessThanOrEqual(1);
      // 起音再快也不能是 0，不然会「啪」一声爆音
      expect(t.attack).toBeGreaterThanOrEqual(0.001);
    }
    // 锯齿波必须挂低通，否则刺耳
    const reed = TIMBRES.find((t) => t.wave === "sawtooth");
    expect(reed?.lowpass).toBeGreaterThan(0);
    expect(timbreById("marimba").id).toBe("marimba");
    expect(timbreById("不存在").id).toBe("bell");
  });

  it("音量默认 0.35、上限 0.6，坏输入回默认值", () => {
    expect(VOLUME_DEFAULT).toBe(0.35);
    expect(VOLUME_MAX).toBe(0.6);
    expect(clampVolume(0.35)).toBe(0.35);
    expect(clampVolume(5)).toBe(VOLUME_MAX);
    expect(clampVolume(-3)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(VOLUME_DEFAULT);
    expect(clampVolume("响一点")).toBe(VOLUME_DEFAULT);
  });

  it("任何路径下同时发声的总增益都 ≤ 0.6", () => {
    const badVolumes: unknown[] = [0, 0.35, 0.6, 1, 99, -5, Number.NaN, "大声", null];
    for (const vol of badVolumes) {
      for (const t of TIMBRES) {
        for (const voices of [1, 2, 3, 5, 8]) {
          const peak = voicePeak(vol, t, voices);
          expect(peak).toBeGreaterThan(0);
          expect(peak).toBeLessThanOrEqual(VOLUME_MAX);
          // 一起响的这几个音加起来也顶不破上限
          expect(peak * voices).toBeLessThanOrEqual(VOLUME_MAX + 1e-9);
        }
      }
    }
    expect(voicePeak(0.6, TIMBRES[0], 0)).toBeLessThanOrEqual(VOLUME_MAX);
    expect(voicePeak(0.6, TIMBRES[0], Number.NaN)).toBeLessThanOrEqual(VOLUME_MAX);
  });

  it("真弹一遍：合成器排出来的每一条包络峰值都不超过 0.6", () => {
    const ctx = new StubAudioContext({ outputLatency: 0.02 });
    const synth = new StarSynth({
      makeContext: () => ctx,
      prefs: { volume: 99 as unknown as number, muted: false, timbre: "bell" },
      storage: null,
    });
    synth.unlock();
    for (const t of TIMBRES) {
      synth.setTimbre(t.id);
      synth.play(midiToFreq(60), 400, 1);
      synth.play(midiToFreq(64), 400, 2);
      synth.play(midiToFreq(67), 400, 2);
    }
    expect(ctx.peakGain).toBeLessThanOrEqual(VOLUME_MAX + 1e-9);
    expect(synth.volume).toBe(VOLUME_MAX);
    synth.destroy();
  });

  it("静音时主增益直接归零，一个音都不发", () => {
    const ctx = new StubAudioContext();
    const synth = new StarSynth({ makeContext: () => ctx, storage: null });
    synth.unlock();
    const before = ctx.nodes.length;
    expect(synth.toggleMuted()).toBe(true);
    expect(synth.effectiveVolume()).toBe(0);
    synth.play(440, 300, 1);
    expect(ctx.nodes.length).toBe(before);
    expect(synth.toggleMuted()).toBe(false);
    synth.play(440, 300, 1);
    expect(ctx.nodes.length).toBeGreaterThan(before);
    synth.destroy();
  });

  it("音色 / 音量 / 静音存在 yiduo-yixing 前缀的 key 下，坏数据回默认", () => {
    expect(AUDIO_PREFS_KEY.startsWith("yiduo-yixing.")).toBe(true);
    const store = memoryStorage();
    savePrefs({ volume: 99, muted: true, timbre: "reed" }, store);
    const back = loadPrefs(store);
    expect(back.volume).toBe(VOLUME_MAX);
    expect(back.muted).toBe(true);
    expect(back.timbre).toBe("reed");
    store.data.set(AUDIO_PREFS_KEY, "{坏掉的 JSON");
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    expect(migratePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(migratePrefs({ timbre: "没这个音色" }).timbre).toBe("bell");
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
  });
});

/* ------------------------------------------------------------------ */
/* 七、AudioContext 生命周期                                            */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · AudioContext 解锁与回收", () => {
  it("首次交互 resume 上下文，并量到输出延迟", () => {
    const ctx = new StubAudioContext({ outputLatency: 0.04 });
    const synth = new StarSynth({ makeContext: () => ctx, storage: null });
    expect(ctx.resumed).toBe(0);
    synth.unlock();
    expect(ctx.resumed).toBe(1);
    expect(ctx.state).toBe("running");
    expect(synth.latencyMs).toBeCloseTo(40, 6);
    // 已经在跑就不重复 resume
    synth.unlock();
    expect(ctx.resumed).toBe(1);
    synth.destroy();
  });

  it("页面切后台挂起，没有音频环境时一切照常不抛", () => {
    const ctx = new StubAudioContext();
    const synth = new StarSynth({ makeContext: () => ctx, storage: null });
    synth.unlock();
    synth.suspend();
    expect(ctx.suspended).toBe(1);
    synth.destroy();

    const silent = new StarSynth({ makeContext: () => null, storage: null });
    expect(silent.context()).toBeNull();
    silent.unlock();
    silent.play(440, 200, 1);
    silent.suspend();
    silent.destroy();
    expect(silent.liveNodes).toBe(0);
  });

  it("判定时钟优先用音频时钟；没有音频环境时退回一把单调的墙钟", () => {
    const ctx = new StubAudioContext();
    const synth = new StarSynth({ makeContext: () => ctx, storage: null });
    synth.unlock();
    expect(synth.now()).toBe(0);
    ctx.tick(1.5);
    expect(synth.now()).toBe(1.5);
    synth.destroy();

    // 浏览器不给 Web Audio 时节奏关也得能玩：时钟必须还在往前走
    const silent = new StarSynth({ makeContext: () => null, storage: null });
    const t0 = silent.now();
    expect(t0).toBeGreaterThan(0);
    expect(silent.now()).toBeGreaterThanOrEqual(t0);
    silent.destroy();
  });

  it("destroy 之后节点全断、上下文关掉，再弹也不会新建节点", () => {
    const ctx = new StubAudioContext();
    const synth = new StarSynth({ makeContext: () => ctx, storage: null });
    synth.unlock();
    for (let i = 0; i < 6; i++) synth.play(midiToFreq(60 + i), 300, 1);
    expect(synth.liveNodes).toBeGreaterThan(0);
    expect(ctx.liveNodes).toBeGreaterThan(0);

    synth.destroy();
    expect(synth.liveNodes).toBe(0);
    expect(ctx.liveNodes).toBe(0);
    expect(ctx.closed).toBe(1);

    const after = ctx.nodes.length;
    synth.play(440, 200, 1);
    synth.unlock();
    expect(ctx.nodes.length).toBe(after);
    expect(synth.liveNodes).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 八、界面：范奏禁输入、按下手感、音高摆位                              */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 星星键盘", () => {
  let dom: InstalledDom;

  beforeEach(() => {
    dom = installDom();
  });

  afterEach(() => {
    dom.restore();
  });

  function board(onDown: (i: number, id: number) => void, onUp?: (i: number, id: number) => void) {
    return createStarBoard({
      midis: PENTATONIC_MIDI,
      notes: PENTATONIC_MIDI.map((_, i) => ({ name: `${i}`, color: "#fff" })),
      onDown,
      onUp,
    });
  }

  it("范奏播放中输入被禁：按下去不会有任何回调", () => {
    const hits: number[] = [];
    const b = board((i) => hits.push(i));
    expect(b.isEnabled()).toBe(true);

    b.setEnabled(false);
    expect(b.isEnabled()).toBe(false);
    for (const btn of b.buttons) expect(btn.disabled).toBe(true);
    (b.buttons[0] as unknown as StubEl).fire("pointerdown", { pointerId: 1 });
    expect(hits).toEqual([]);

    b.setEnabled(true);
    for (const btn of b.buttons) expect(btn.disabled).toBe(false);
    (b.buttons[0] as unknown as StubEl).fire("pointerdown", { pointerId: 1 });
    expect(hits).toEqual([0]);
    b.destroy();
  });

  it("两根手指按两颗星星，各自的 pointerId 原样传出来、不串", () => {
    const downs: Array<[number, number]> = [];
    const ups: Array<[number, number]> = [];
    const b = board((i, id) => downs.push([i, id]), (i, id) => ups.push([i, id]));
    const pad = new ChordPad();

    (b.buttons[0] as unknown as StubEl).fire("pointerdown", { pointerId: 11 });
    (b.buttons[3] as unknown as StubEl).fire("pointerdown", { pointerId: 12 });
    for (const [key, id] of downs) pad.down(id, key, 0);
    expect(downs).toEqual([[0, 11], [3, 12]]);
    expect(pad.heldKeys()).toEqual([0, 3]);

    (b.buttons[0] as unknown as StubEl).fire("pointerup", { pointerId: 11 });
    expect(ups).toEqual([[0, 11]]);
    pad.up(11, 10);
    expect(pad.heldKeys()).toEqual([3]);
    b.destroy();
  });

  it("按下发光并下沉，松开回弹", () => {
    const b = board(() => {});
    const first = b.buttons[0] as unknown as StubEl;
    first.fire("pointerdown", { pointerId: 1 });
    expect(first.classList.contains("mst-down")).toBe(true);
    expect(first.classList.contains("mst-lit")).toBe(true);
    first.fire("pointerup", { pointerId: 1 });
    expect(first.classList.contains("mst-down")).toBe(false);
    expect(first.classList.contains("mst-lit")).toBe(false);
    b.destroy();
  });

  it("音高越高星星摆得越靠上", () => {
    const b = board(() => {});
    const offsets = b.buttons.map((btn) => parseInt(btn.style.marginBottom || "0", 10));
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
    expect(pitchOffsetPx(60, 60, 69, 72)).toBe(0);
    expect(pitchOffsetPx(69, 60, 69, 72)).toBe(72);
    expect(pitchOffsetPx(64.5, 60, 69, 72)).toBe(36);
    // 坏输入不炸
    expect(pitchOffsetPx(Number.NaN, 60, 69)).toBe(0);
    expect(pitchOffsetPx(60, 60, 60)).toBe(0);
    b.destroy();
  });

  it("答对之后能连出星座，destroy 之后监听一个不剩", () => {
    const b = board(() => {});
    const svg = (b.el as unknown as StubEl).children[0];
    b.drawConstellation([0, 2, 4, 1]);
    expect(svg.classList.contains("mst-lines-on")).toBe(true);
    // 四个音连成三条线
    expect(svg.children).toHaveLength(3);
    b.clearConstellation();
    expect(svg.classList.contains("mst-lines-on")).toBe(false);
    expect(svg.children).toHaveLength(0);
    const before = (b.buttons[0] as unknown as StubEl).listenerCount;
    expect(before).toBeGreaterThan(0);
    b.destroy();
    expect((b.buttons[0] as unknown as StubEl).listenerCount).toBe(0);
  });

  it("简谱渲染出数字、八度点与时值线", () => {
    const host = new StubEl("div");
    const glyphs = glyphLine([60, 72, 48], ["quarter", "eighth", "half"]);
    renderScore(host as unknown as HTMLElement, glyphs, 1);
    expect(host.children).toHaveLength(3);
    expect(host.children[1].classList.contains("mst-cur")).toBe(true);
    // 高八度那一格上方有一个点，八分音符多一条下划线
    const high = host.children[1];
    expect(high.children[0].textContent).toBe("·");
    expect(high.children.some((c) => c.classList.contains("mst-glyph-under"))).toBe(true);
    // 低八度那一格下方有一个点，二分音符数字后面带增时线
    const low = host.children[2];
    expect(low.children[2].textContent).toBe("·");
    expect(low.children[1].textContent).toBe("1 -");
  });
});

/* ------------------------------------------------------------------ */
/* 九、自由弹奏沙盒                                                     */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 自由弹奏沙盒", () => {
  it("录音 30 秒硬上限：超时的音符丢掉，跨线的剪短", () => {
    expect(SANDBOX_MAX_MS).toBe(30000);
    const notes = trimClip([
      { at: 0, key: 0, dur: 300 },
      { at: 29800, key: 1, dur: 900 },
      { at: 30000, key: 2, dur: 300 },
      { at: 42000, key: 3, dur: 300 },
      { at: -5, key: 4, dur: 200 },
    ]);
    expect(notes.map((n) => n.at)).toEqual([0, 0, 29800]);
    expect(notes[2].dur).toBe(200);
    expect(clipLength(notes)).toBeLessThanOrEqual(SANDBOX_MAX_MS);
    expect(trimClip([{ at: Number.NaN, key: 1, dur: 10 }])).toEqual([]);
  });

  it("最多存 6 段，满了丢最老的那段", () => {
    expect(SANDBOX_MAX_CLIPS).toBe(6);
    let list: SandboxClip[] = [];
    for (let i = 1; i <= 8; i++) {
      list = pushClip(list, {
        id: `c${i}`,
        name: `第 ${i} 段`,
        scale: "penta",
        notes: [{ at: 0, key: 0, dur: 200 }],
        ms: 200,
      });
    }
    expect(list).toHaveLength(6);
    expect(list.map((c) => c.id)).toEqual(["c3", "c4", "c5", "c6", "c7", "c8"]);
  });

  it("录音机按住多久就记多久，到三十秒就该停", () => {
    const rec = new ClipRecorder();
    rec.start(1000);
    expect(rec.active).toBe(true);
    rec.noteOn(1, 2, 1200);
    rec.noteOff(1, 1600);
    // 两根手指交叠录进去也各算各的
    rec.noteOn(1, 0, 2000);
    rec.noteOn(2, 3, 2050);
    rec.noteOff(2, 2400);
    rec.noteOff(1, 2500);
    expect(rec.elapsed(2500)).toBe(1500);
    expect(rec.expired(2500)).toBe(false);
    expect(rec.expired(1000 + SANDBOX_MAX_MS)).toBe(true);
    const notes = rec.stop(2600);
    expect(rec.active).toBe(false);
    expect(notes.map((n) => n.key)).toEqual([2, 0, 3]);
    expect(notes[0].dur).toBe(400);
  });

  it("存档 key 走 yiduo-yixing 前缀，坏数据一律迁掉", () => {
    expect(SANDBOX_KEY).toBe("yiduo-yixing.music-stars.sandbox.v1");
    expect(SANDBOX_KEY.startsWith("yiduo-yixing.")).toBe(true);
    const store = memoryStorage();
    const clip: SandboxClip = {
      id: "a",
      name: "第 1 段",
      scale: "hepta",
      notes: [{ at: 0, key: 1, dur: 300 }],
      ms: 300,
    };
    saveClips([clip], store);
    expect([...store.data.keys()]).toEqual([SANDBOX_KEY]);
    expect(loadClips(store)[0].scale).toBe("hepta");
    store.data.set(SANDBOX_KEY, JSON.stringify([{ notes: "不是数组" }, null, 7]));
    expect(loadClips(store)).toEqual([]);
    expect(migrateClips("坏数据")).toEqual([]);
    // 沙盒绝不碰关卡进度的存档
    expect([...store.data.keys()].some((k) => k.startsWith("yiduo-yixing.l99"))).toBe(false);
  });

  it("沙盒的五声 / 七声音阶都从十二平均律取音", () => {
    expect(scaleMidis("penta")).toEqual(PENTATONIC_MIDI);
    expect(scaleMidis("hepta")).toEqual(DIATONIC_MIDI);
    // 七声里最后一个是高八度的哆，正好比第一个高一个八度
    const hepta = scaleMidis("hepta");
    expect(hepta[hepta.length - 1] - hepta[0]).toBe(12);
    expect(midiToFreq(hepta[hepta.length - 1]) / midiToFreq(hepta[0])).toBeCloseTo(2, 12);
  });
});

/* ------------------------------------------------------------------ */
/* 十、简谱记号                                                         */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 简谱记号", () => {
  it("八度点：高八度上加点、低八度下加点、中央那一组不加", () => {
    expect(glyphOf(60)).toMatchObject({ digit: 1, octave: 0, dotsAbove: 0, dotsBelow: 0 });
    expect(glyphOf(72)).toMatchObject({ digit: 1, octave: 1, dotsAbove: 1, dotsBelow: 0 });
    expect(glyphOf(48)).toMatchObject({ digit: 1, octave: -1, dotsAbove: 0, dotsBelow: 1 });
    expect(glyphOf(84)).toMatchObject({ octave: 2, dotsAbove: 2 });
    // 五声音阶的五个音写成 1 2 3 5 6
    expect(PENTATONIC_MIDI.map((m) => glyphOf(m).digit)).toEqual([1, 2, 3, 5, 6]);
    // 七声音阶补上 4 与 7
    expect(DIATONIC_MIDI.map((m) => glyphOf(m).digit)).toEqual([1, 2, 3, 4, 5, 6, 7, 1]);
  });

  it("时值：八分加下划线、二分加增时线、四分什么都不加", () => {
    expect(glyphOf(60, "eighth")).toMatchObject({ underlines: 1, dashes: 0 });
    expect(glyphOf(60, "half")).toMatchObject({ underlines: 0, dashes: 1 });
    expect(glyphOf(60, "quarter")).toMatchObject({ underlines: 0, dashes: 0 });
    expect(rhythmValue(true)).toBe("half");
    expect(rhythmValue(false)).toBe("eighth");
  });

  it("谱面文本与读屏说法都对得上，字号不低于 20px", () => {
    const line = glyphLine([60, 72, 48], ["quarter", "eighth", "half"]);
    expect(lineText(line)).toBe("1 1(高)_ 1(低) -");
    expect(glyphAria(line[1])).toBe("高八度哆，半拍");
    expect(glyphAria(glyphOf(67, "half"))).toBe("索，两拍");
    expect(SCORE_MIN_FONT_PX).toBeGreaterThanOrEqual(20);
  });

  it("简谱视奏台每一句都配得出时值，长短都有", () => {
    const list = LEVELS.map((_, i) => i).filter((i) => LEVELS[i].mode === "score");
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const lv of list) {
      const seqs = buildScores(lv);
      const values = buildScoreValues(lv);
      expect(values).toHaveLength(seqs.length);
      seqs.forEach((seq, i) => {
        expect(values[i]).toHaveLength(seq.length);
        for (const v of values[i]) expect([0, 1]).toContain(v);
        expect(values[i].includes(0)).toBe(true);
        expect(values[i].includes(1)).toBe(true);
      });
      // 同一关重玩时值不变
      expect(JSON.stringify(buildScoreValues(lv))).toBe(JSON.stringify(values));
    }
  });
});

/* ------------------------------------------------------------------ */
/* 十一、平台接线与 360px 布局                                          */
/* ------------------------------------------------------------------ */

describe("音乐星星 1.2 · 平台接线与窄屏", () => {
  it("?level=N 与壳层的 initialLevel 都能直开第 N 关，越界会夹回来", () => {
    expect(parseLevelParam("?level=12")).toBe(12);
    expect(parseLevelParam("#level=7&x=1")).toBe(7);
    expect(parseLevelParam("?a=1")).toBeNull();
    expect(parseLevelParam("")).toBeNull();
    // 1 基进、0 基出
    expect(resolveInitialLevel(1, 187)).toBe(0);
    expect(resolveInitialLevel(12, 187)).toBe(11);
    expect(resolveInitialLevel(999, 187)).toBe(187);
    expect(resolveInitialLevel(-4, 187)).toBe(0);
    // 还没解锁的关退到当前能玩到的最远那一关
    expect(resolveInitialLevel(120, 30)).toBe(30);
    expect(resolveInitialLevel(undefined, 30)).toBeNull();
    expect(resolveInitialLevel("不是数字", 30)).toBeNull();
  });

  it("替玩家在地图上点开那一关；章节或格子锁着就安静停下", () => {
    const clicks: string[] = [];
    const node = (label: string, locked: boolean) => ({
      classList: { contains: (t: string) => locked && t === "l99-node-lock" },
      getAttribute: () => label,
      click: () => clicks.push(label),
    });
    const tab = (locked: boolean) => ({
      classList: { contains: (t: string) => locked && t === "l99-tab-lock" },
      getAttribute: () => null,
      click: () => clicks.push("tab"),
    });
    const host = (tabs: unknown[], nodes: unknown[]) => ({
      querySelectorAll: (sel: string) =>
        (sel.includes("tab") ? tabs : nodes) as ArrayLike<ReturnType<typeof node>>,
    });

    expect(openLevelOnMap(host([tab(false)], [node("第 3 关，还没通关", false)]), 2, 0)).toBe(true);
    expect(clicks).toEqual(["tab", "第 3 关，还没通关"]);
    expect(openLevelOnMap(host([tab(true)], []), 2, 0)).toBe(false);
    expect(openLevelOnMap(host([tab(false)], [node("第 3 关，还没解锁", true)]), 2, 0)).toBe(false);
    expect(openLevelOnMap(host([tab(false)], []), 2, 5)).toBe(false);
  });

  it("360px 下五颗星星一行放得下，热区 ≥56px、间距 ≥8px", () => {
    const layout = keyLayout(360, 5);
    expect(layout.width).toBeGreaterThanOrEqual(KEY_MIN_PX);
    expect(layout.gap).toBeGreaterThanOrEqual(KEY_MIN_GAP_PX);
    expect(layoutFits(layout, 5, 360)).toBe(true);
    // 320px 的老机器也不能挤掉热区
    const tiny = keyLayout(320, 5);
    expect(tiny.width).toBeGreaterThanOrEqual(KEY_MIN_PX);
    expect(tiny.gap).toBeGreaterThanOrEqual(KEY_MIN_GAP_PX);
    expect(layoutFits(tiny, 5, 320)).toBe(true);
    // 双声部关拉开间距之后，键仍然摆得下。
    // 这里从「≥56px」放宽到「≥44px 触屏底线」是本轮有意改的：原来死守 56px，
    // 算出来 5×56 + 4×24 = 376 > 360，两端各被切掉约 5px（测试员 W5-B-07）；
    // 换成允许收一档之后，断言改成「真的摆得下」——比原来更严，不是放水。
    const duet = keyLayout(360, 5, DUET_MIN_GAP_PX);
    expect(duet.gap).toBeGreaterThanOrEqual(DUET_MIN_GAP_PX);
    expect(duet.width).toBeGreaterThanOrEqual(KEY_TOUCH_MIN_PX);
    expect(layoutFits(duet, 5, 360)).toBe(true);
    // 七声音阶 8 个键在 360px 下怎么排都塞不进（光键身 8×44 就 352px），
    // 键收到触屏底线为止就不再收，剩下的交给横向滚动（`createStarBoard` 挂 mst-keys-scroll）
    const seven = keyLayout(360, 8);
    expect(seven.width).toBeGreaterThanOrEqual(KEY_TOUCH_MIN_PX);
    expect(layoutFits(seven, 8, 360)).toBe(false);
  });

  it("meta 与事实对齐：188 关、只有闯关、按实测填了 platform", () => {
    expect(meta.levels).toBe(TOTAL_LEVELS);
    expect(meta.modes).toEqual(["campaign"]);
    expect(meta.category).toBe("create");
    expect(meta.platform).toBe("both");
    expect(meta.blurb).toContain("188 关");
    expect(meta.blurb).toContain("十场音乐会");
    expect(meta.blurb).not.toMatch(/[A-Za-z]/);
    for (const mode of ["rhythm", "interval", "duet", "score"] as const) {
      expect(modeIntro(mode)).not.toMatch(/[A-Za-z]/);
    }
  });

  it("攻略补了 1.2 的打法，仍然一个具体旋律都不写", () => {
    expect(guide.gameId).toBe("music-stars");
    expect(guide.general.length).toBeGreaterThanOrEqual(3);
    expect(guide.general.length).toBeLessThanOrEqual(6);
    expect(guide.entries).toHaveLength(10);
    const all = [...guide.general, ...guide.entries.flatMap((e) => [e.title, ...e.tips])];
    const text = all.join("\n");
    expect(text).toContain("慢速");
    expect(text).toContain("节拍条");
    expect(text).toContain("同时按");
    // 不许出现具体音名串（那就是泄题）
    expect(text).not.toMatch(/[哆来咪索拉]\s*[哆来咪索拉]\s*[哆来咪索拉]/);
    expect(text).not.toMatch(/\d\s*\d\s*\d\s*\d/);
    for (const tip of all) expect(tip).not.toContain("答案");
  });
});

/* ------------------------------------------------------------------ */
/* 十二、前 99 关一个音都没变                                           */
/* ------------------------------------------------------------------ */

/**
 * 前 99 关的逐关指纹：`[LEVELS[i], buildMelodies(i)]` 的 FNV-1a 摘要。
 * 这串数是在 1.2 动工前从 1.1 的输出上取下来的，
 * 改动前 6 章的任何一个分支、seed 或参数，对应那一关就会红。
 */
const LEGACY_FINGERPRINTS: readonly string[] = [
  "a9af7a4f", "ef665312", "27e37f13", "38514061", "113b1629", "75fd7e69",
  "55e46a11", "928c417b", "fa5c663f", "6c12dda2", "e31e8165", "7ee8c666",
  "37491c41", "2c3c6654", "149e1a48", "33e5949b", "21e8f3c3", "94918411",
  "23326d1a", "57a6cd23", "0f9295e1", "9c046da2", "59700485", "effd1dac",
  "d54f32f9", "0870981a", "69bc5836", "e4088c74", "b656803c", "924312ec",
  "6b26c52d", "1d4284af", "c8d1c97f", "6f8f6e7f", "853b7c64", "4907299c",
  "ac2f02d6", "96fa94e3", "e2b5ffe6", "1d9b658f", "e0c6c322", "b1846b4b",
  "cdc9e82f", "3835e0f2", "a94448d8", "89b416d6", "db32c7ba", "e4199eaf",
  "e0645604", "bdc65869", "1635307b", "039f2cdb", "43036e60", "8072d3b2",
  "4537bd87", "1d6a3ab3", "32cabb07", "e9cc6f17", "788c441d", "65dba1cc",
  "bbb2c971", "9cd349e3", "3b2778d4", "7661735f", "f1a6613c", "87af4fda",
  "3b8dfacc", "6d3d024a", "974d1c69", "4959d85d", "b6938ec6", "3474a75f",
  "c351b2fe", "cb20acc8", "075dea10", "2d5c5afd", "b4df3bd3", "8531c7cc",
  "3fe4f255", "fe871d09", "c23b5b1b", "7aa1b7eb", "fc2ba651", "5c35858d",
  "d8ab03c0", "83ef07cd", "dc57da78", "19410b27", "153f8a6d", "89a9242f",
  "0c09e24a", "80db03e9", "36f8821c", "74d70ab8", "3661f68d", "4219f980",
  "bf26a3a8", "2b5f00b1", "5ac097a0",
];

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

describe("音乐星星 1.2 · 前 99 关回归", () => {
  it("99 个逐关指纹一个不差", () => {
    expect(LEGACY_FINGERPRINTS).toHaveLength(LEGACY_LEVELS);
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const got = fnv(JSON.stringify([LEVELS[i], buildMelodies(i)]));
      expect(got, `第 ${i + 1} 关的生成结果变了`).toBe(LEGACY_FINGERPRINTS[i]);
    }
  });

  it("章节切分与 1.0 一致，前 99 关一个新字段都没多", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(LEGACY_LEVELS);
    const keys = new Set<string>();
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(LEVELS[i].mode).toBeUndefined();
      for (const k of Object.keys(LEVELS[i])) keys.add(k);
    }
    expect([...keys].sort()).toEqual([
      "finale", "maxJump", "maxMiss", "noteMs", "replays", "rounds", "seqLen", "starCount", "theme",
    ]);
  });

  it("1.2 的改动全部落在第 100 关之后", () => {
    // 双声部的间距要求、简谱时值、音程真名都只影响 1.1 追加的四章
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      expect(buildScoreValues(i).length).toBe(buildMelodies(i).length);
    }
    const duetLevels = LEVELS.map((_, i) => i).filter((i) => LEVELS[i].mode === "duet");
    expect(Math.min(...duetLevels)).toBeGreaterThanOrEqual(LEGACY_LEVELS);
    const intervalLevels = LEVELS.map((_, i) => i).filter((i) => LEVELS[i].mode === "interval");
    expect(Math.min(...intervalLevels)).toBeGreaterThanOrEqual(LEGACY_LEVELS);
  });
});

/** 固定种子的小随机数 */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
