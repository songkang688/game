// 档C · 第 2 轮学习优化员 · L2-01:寻找外星朋友的无尽曲线不再第 20 轮就冻住。
//
// 改了三处:目标数分两段涨到 8 个、罚时改成跟着限时走(不再随 chapter 循环忽轻忽重)、
// 新增一个 endlessDifficulty 合成分好让单测一句话钉住「曲线不掉头」。
// 这一档同时盯着两条不许破的底线:公平(限时够用、罚时不过重)与手感(360px 上点得动)。
import { describe, expect, it } from "vitest";
import { LEVELS, buildEndlessRound, buildLevel } from "./levels";
import {
  ENDLESS_BASE_SECONDS,
  ENDLESS_MAX_TARGETS,
  ENDLESS_PEAK_ROUND,
  SCENE_H,
  SCENE_W,
  endlessDifficulty,
  endlessMissPenalty,
  endlessSeconds,
  endlessSpotCount,
  endlessTargetCount,
  missPenalty,
  type Spot,
} from "./logic";
import { levelIsBeatable } from "./sim";

/** 360px 手机上这个藏身点画出来有多大 */
function screenDiameter(s: Spot, width: number): number {
  const scale = Math.min(width / SCENE_W, (width * 0.75) / SCENE_H);
  return s.r * 2 * scale;
}

describe("档C R2 学习优化 · L2-01 无尽曲线延到第 36 轮", () => {
  it("难度分 1~200 轮一路不降", () => {
    for (let r = 2; r <= 200; r++) {
      expect(
        endlessDifficulty(r),
        `第 ${r} 轮的难度分比第 ${r - 1} 轮还低`
      ).toBeGreaterThanOrEqual(endlessDifficulty(r - 1));
    }
  });

  it("到顶之前每 8 轮至少涨一档,不会连着走平", () => {
    for (let r = 1; r + 8 <= ENDLESS_PEAK_ROUND; r++) {
      expect(
        endlessDifficulty(r + 8),
        `第 ${r} 轮到第 ${r + 8} 轮难度分一点没动`
      ).toBeGreaterThan(endlessDifficulty(r));
    }
  });

  it("第 20 轮不再是终点:第 20 / 28 / 36 轮规模两两都不一样", () => {
    const shape = (r: number): string =>
      `${endlessSpotCount(r)}/${endlessTargetCount(r)}/${endlessSeconds(r)}`;
    expect(shape(20)).not.toBe(shape(28));
    expect(shape(28)).not.toBe(shape(36));
    expect(endlessDifficulty(36)).toBeGreaterThan(endlessDifficulty(20));
  });

  it("第 36 轮到顶,再往后是同一个分数(16 个点是摆放上限,14 秒是公平地板)", () => {
    const peak = endlessDifficulty(ENDLESS_PEAK_ROUND);
    for (const r of [ENDLESS_PEAK_ROUND, 40, 80, 200, 999]) {
      expect(endlessDifficulty(r), `第 ${r} 轮`).toBe(peak);
    }
    expect(endlessSpotCount(999)).toBe(16);
    expect(endlessTargetCount(999)).toBe(ENDLESS_MAX_TARGETS);
    expect(endlessSeconds(999)).toBe(14);
  });

  it("前 12 轮的目标数一个都没动,老玩家的开局手感照旧", () => {
    // 改之前是 min(5, 2 + floor(r / 4)),前段必须逐轮对得上
    for (let r = 1; r <= 12; r++) {
      expect(endlessTargetCount(r), `第 ${r} 轮`).toBe(Math.min(5, 2 + Math.floor(r / 4)));
    }
  });

  it("目标数只增不减,封顶 8 个(场上一共 16 个藏身点,一半到头)", () => {
    for (let r = 2; r <= 200; r++) {
      expect(endlessTargetCount(r)).toBeGreaterThanOrEqual(endlessTargetCount(r - 1));
      expect(endlessTargetCount(r)).toBeLessThanOrEqual(ENDLESS_MAX_TARGETS);
      expect(endlessTargetCount(r)).toBeLessThanOrEqual(endlessSpotCount(r));
    }
  });

  it("罚时不再跟着 chapter 循环忽轻忽重", () => {
    // 改之前无尽第 r 轮走 missPenalty((r - 1) % 8):第 9 轮直接从 5 秒掉回 2 秒
    expect(missPenalty((9 - 1) % 8)).toBeLessThan(missPenalty((8 - 1) % 8));
    for (let r = 2; r <= 200; r++) {
      expect(
        endlessMissPenalty(r),
        `第 ${r} 轮的罚时比第 ${r - 1} 轮还重`
      ).toBeLessThanOrEqual(endlessMissPenalty(r - 1));
    }
  });

  it("罚时永远咬不掉这一轮五分之一的时间", () => {
    for (let r = 1; r <= 200; r++) {
      const p = endlessMissPenalty(r);
      expect(p).toBeGreaterThanOrEqual(2);
      expect(p, `第 ${r} 轮只有 ${endlessSeconds(r)} 秒,却要罚 ${p} 秒`).toBeLessThanOrEqual(
        endlessSeconds(r) / 5
      );
    }
  });

  it("无尽轮自带罚时,战役关不带(照旧按章算)", () => {
    for (let r = 1; r <= 60; r++) {
      expect(buildEndlessRound(r).penalty, `第 ${r} 轮`).toBe(endlessMissPenalty(r));
    }
    for (const i of [0, 45, 99, 187]) {
      expect(buildLevel(i).penalty, `第 ${i + 1} 关`).toBeUndefined();
      expect(LEVELS[i].penalty).toBeUndefined();
    }
  });

  it("目标数涨到 8 个之后,限时还是够用的(按键盘挪光标这种最慢的玩法算)", () => {
    const tight: number[] = [];
    for (let r = 1; r <= 120; r++) {
      if (!levelIsBeatable(buildEndlessRound(r), 3)) tight.push(r);
    }
    expect(tight).toEqual([]);
  });

  it("目标多了也不靠画小:360px 上每个藏身点直径都还有 24px", () => {
    for (let r = 20; r <= 60; r++) {
      const lv = buildEndlessRound(r);
      expect(lv.spots.length).toBe(endlessSpotCount(r));
      for (const s of lv.spots) {
        expect(screenDiameter(s, 360), `第 ${r} 轮有目标太小`).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it("第 36 轮之后照旧每轮换场景,不是同一张图重播", () => {
    const seen = new Set<string>();
    for (let r = ENDLESS_PEAK_ROUND; r <= ENDLESS_PEAK_ROUND + 20; r++) {
      seen.add(JSON.stringify(buildEndlessRound(r).spots));
    }
    expect(seen.size).toBe(21);
  });

  it("难度分的基准秒数和第 1 轮的限时对得上,不是拍脑袋写的常数", () => {
    expect(ENDLESS_BASE_SECONDS - endlessSeconds(1)).toBe(1);
    expect(endlessDifficulty(0)).toBe(endlessDifficulty(1));
    expect(endlessDifficulty(-8)).toBe(endlessDifficulty(1));
  });
});
