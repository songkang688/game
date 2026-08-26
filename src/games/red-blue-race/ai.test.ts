import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { buildDuelTrack } from "./fair";
import { HUMAN_TAP_CAP_HZ, MIN_EFFECTIVE_GAP_MS, pacePerSec } from "./rhythm";
import {
  AI_LEVELS,
  AI_PROFILES,
  aiButtonLabel,
  aiMisses,
  aiPacePerSec,
  aiStumbleSec,
  aiTapGapMs,
  profileOf,
  respectsHumanCap,
  runAiLane,
  type AiLevel
} from "./ai";

const TAP_STEP = 1.7;

/** 固定 seed 下这一档跑若干趟的平均用时 */
function avgFinish(level: AiLevel, rounds = 20): number {
  let sum = 0;
  for (let i = 0; i < rounds; i++) {
    const rand = mulberry32(7000 + i * 131);
    const track = buildDuelTrack(mulberry32(300 + i * 17), 6);
    sum += runAiLane(level, TAP_STEP, track.blue, rand).finishSec;
  }
  return sum / rounds;
}

describe("红蓝赛跑 · 小电脑四档", () => {
  it("四档齐全、顺序由弱到强，档案字段对得上", () => {
    expect(AI_LEVELS).toEqual(["rookie", "normal", "expert", "hell"]);
    for (const lv of AI_LEVELS) {
      const p = AI_PROFILES[lv];
      expect(p.key).toBe(lv);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(4);
      expect(p.missRate).toBeGreaterThanOrEqual(0);
      expect(p.missRate).toBeLessThan(1);
      expect(p.steadiness).toBeGreaterThan(0);
      expect(p.steadiness).toBeLessThanOrEqual(1);
    }
    expect(aiButtonLabel("hell")).toContain(AI_PROFILES.hell.label);
  });

  it("目标节奏一律不超过人手上限——不许用玩家做不到的频率", () => {
    expect(respectsHumanCap()).toBe(true);
    for (const lv of AI_LEVELS) {
      expect(AI_PROFILES[lv].tapsPerSec).toBeLessThanOrEqual(HUMAN_TAP_CAP_HZ);
      expect(aiTapGapMs(lv)).toBeGreaterThanOrEqual(MIN_EFFECTIVE_GAP_MS);
    }
  });

  it("四档的目标节奏严格递增，失误率与反应时间严格递减", () => {
    for (let i = 1; i < AI_LEVELS.length; i++) {
      const prev = AI_PROFILES[AI_LEVELS[i - 1]];
      const cur = AI_PROFILES[AI_LEVELS[i]];
      expect(cur.tapsPerSec).toBeGreaterThan(prev.tapsPerSec);
      expect(cur.missRate).toBeLessThan(prev.missRate);
      expect(cur.reactionMs).toBeLessThan(prev.reactionMs);
      expect(cur.steadiness).toBeGreaterThan(prev.steadiness);
    }
  });

  it("推进速度四档严格递增，而且和玩家走同一套换算", () => {
    const paces = AI_LEVELS.map((lv) => aiPacePerSec(lv, TAP_STEP));
    for (let i = 1; i < paces.length; i++) expect(paces[i]).toBeGreaterThan(paces[i - 1]);
    // 同一个节奏喂进玩家公式和 AI 公式，结果应当一致（地狱档踩满稳定度）
    expect(aiPacePerSec("hell", TAP_STEP)).toBeCloseTo(
      pacePerSec(AI_PROFILES.hell.tapsPerSec, TAP_STEP),
      10
    );
  });

  it("地狱档也是人打得过的：按得比它快一点的手速就压得住它", () => {
    const hell = aiPacePerSec("hell", TAP_STEP);
    expect(pacePerSec(7, TAP_STEP)).toBeGreaterThan(hell);
    // 菜鸟档明显比六年级的稳定手速慢，孩子第一次玩不会被劝退
    expect(aiPacePerSec("rookie", TAP_STEP)).toBeLessThan(pacePerSec(6, TAP_STEP) * 0.6);
  });

  it("固定 seed 跑 20 趟：相邻两档的平均用时严格递减", () => {
    const times = AI_LEVELS.map((lv) => avgFinish(lv));
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeLessThan(times[i - 1]);
    for (const t of times) expect(Number.isFinite(t)).toBe(true);
  });

  it("失误率真的会掷出来：菜鸟摔得多，地狱摔得少", () => {
    const count = (lv: AiLevel): number => {
      const rand = mulberry32(88);
      let n = 0;
      for (let i = 0; i < 400; i++) if (aiMisses(lv, rand)) n++;
      return n;
    };
    expect(count("rookie")).toBeGreaterThan(count("hell"));
    expect(count("hell")).toBeLessThan(80);
    expect(count("rookie")).toBeGreaterThan(80);
  });

  it("同一个 seed 跑出来的结果完全确定", () => {
    const track = buildDuelTrack(mulberry32(11), 6);
    const a = runAiLane("expert", TAP_STEP, track.red, mulberry32(5));
    const b = runAiLane("expert", TAP_STEP, track.red, mulberry32(5));
    expect(a).toEqual(b);
    expect(a.misses).toBeLessThanOrEqual(track.red.length);
  });

  it("愣神时长按反应时间来，档位越高愣得越短", () => {
    expect(aiStumbleSec("rookie")).toBeGreaterThan(aiStumbleSec("hell"));
    for (const lv of AI_LEVELS) expect(aiStumbleSec(lv)).toBeGreaterThan(0);
  });

  it("拿到奇怪的档位名不会炸，按普通档兜底", () => {
    expect(profileOf("normal")).toBe(AI_PROFILES.normal);
    expect(profileOf("nope" as AiLevel)).toBe(AI_PROFILES.normal);
    expect(aiPacePerSec("nope" as AiLevel, TAP_STEP)).toBeGreaterThan(0);
  });

  it("档位文案只说对手，不评价玩家", () => {
    const shaming = ["笨", "菜鸟玩家", "废", "垃圾", "没用"];
    for (const lv of AI_LEVELS) {
      for (const w of shaming) expect(AI_PROFILES[lv].blurb).not.toContain(w);
    }
  });
});
