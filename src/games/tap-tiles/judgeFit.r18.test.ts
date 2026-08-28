import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JUDGE_LINE_RATIO, MIN_STAGE_PX, fitJudgeRatio } from "./index";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/**
 * N-90(r18):915×412 壳层只给 ~164px,画布被 MIN_STAGE_PX=190 兜底后底边伸到
 * 剪裁盒(实测 wrap 底 336、画布底 424)之外,80% 处的判定线彻底看不见,音符
 * 消失在半空只能盲点。判定是纯时间制(approachMs 固定毫秒),把判定线的比例
 * 收进可视区不改难度。MIN_STAGE_PX 与 stageHeight/fitStageHeight 的老规则不动。
 */
describe("N-90 tap-tiles 判定线进可视区", () => {
  it("画布装得下时保持 0.8 不动", () => {
    // 画布顶 100、剪裁底 500、画布高 190:190*0.8+100=252 远在 500 之内
    expect(fitJudgeRatio(190, 100, 500)).toBe(JUDGE_LINE_RATIO);
    expect(fitJudgeRatio(400, 0, 900)).toBe(JUDGE_LINE_RATIO);
  });

  it("915×412 实测档:画布顶 234、剪裁底 336,判定线收进 336 以内", () => {
    const ratio = fitJudgeRatio(MIN_STAGE_PX, 234, 336);
    expect(ratio).toBeLessThan(JUDGE_LINE_RATIO);
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(234 + MIN_STAGE_PX * ratio).toBeLessThanOrEqual(336);
  });

  it("量不到就退回 0.8,绝不抛异常", () => {
    expect(fitJudgeRatio(0, 100, 300)).toBe(JUDGE_LINE_RATIO);
    expect(fitJudgeRatio(Number.NaN, 100, 300)).toBe(JUDGE_LINE_RATIO);
    expect(fitJudgeRatio(190, 300, 100)).toBe(JUDGE_LINE_RATIO);
    expect(fitJudgeRatio(190, Number.NaN, Number.NaN)).toBe(JUDGE_LINE_RATIO);
  });

  it("剪裁底边找的是最先裁人的那层(overflow 收拢层也算),矮横屏键盘提示让位", () => {
    expect(SRC).toContain('o === "hidden" || o === "clip"');
    expect(SRC).toContain(".tt-keys{display:none;}");
  });
});
