/**
 * 拼音小火车 · 答完一题那句话得让孩子看得见
 * （窗口5 第2轮 档C 监督修复员 · W5R2-FC-01，严重）。
 *
 * 第 2 轮学习优化员 LC-12 的原话是「本档侧『能压就压』的部分已经全部压完并逐条量过：
 * 关内与两个侧模式在四档视口上够不着 0 颗、小于 44px 0 颗」。
 * 这句话对**按钮**是成立的（我逐颗复量过，`.qz-choice` 96×80 四档全部 `elementFromPoint` 拿得回来）。
 * 但那把尺子只照按钮，照不到不是按钮的东西——
 *
 * CDP 实测（Chrome headless，答错一题之后量 `.qz-msg`）：
 *
 * | 视口 | 舞台裁掉 | `.qz-msg` 高 | 看得见几像素 | 可滚祖先 |
 * | --- | --- | --- | --- | --- |
 * | 390×844 | 0 | 24 | 24 | — |
 * | 360×720 | 0 | 24 | 24 | — |
 * | 360×640 | 33–65 | 24 | **0**（L141/168/171/188）/ 19（L41/91） | **无** |
 * | 320×640 | 33–77 | 24 | **0**（L141/168/171/188）/ 19（L41/91） | **无** |
 *
 * `.qz-msg` 是这一款唯一的即时反馈位：「答对啦！真棒！」「别着急，慢慢来～」
 * 「再看一眼，答案就在里面！」——**失败只鼓励**这条红线就落在这一行上；
 * 同一行还负责连错两次的那句悄悄提示。矮屏上孩子答完一题，屏幕上什么都不会发生。
 *
 * 一个可滚祖先都没有，所以不是「滚一下就看得见」，是**永远看不见**。
 *
 * 改法照仓内既有做法（档A 第 2 轮给 `clock-house` / `word-garden` 补的
 * `fitQuizHost`，更早还有 `shape-kingdom`）：`quiz99.ts` 是平台共享模块、禁改，
 * 但**它渲到哪儿是本款说了算**。给它一个本款自己的宿主，由这里量一次舞台下沿、
 * 把像素值写成宿主自己的 `max-height`，装不下就让宿主自己滚，
 * 并且**每换一题 / 每出一句反馈都把那一段带进眼里**——光能滚不够，
 * 孩子不知道底下还有字。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { revealTargetOf, scrollToShowPx, visibleRoomPx } from "./fit";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("拼音小火车 · 答题屏钳进可视段（W5R2-FC-01）", () => {
  it("一层裁切祖先都没有就不钳", () => {
    expect(visibleRoomPx(218, [])).toBe(Number.POSITIVE_INFINITY);
    expect(visibleRoomPx(218, [618, 700, 900])).toBe(400);
  });

  it("要露出的那一段滚多少：只滚最小的那一下，题面尽量留在眼前", () => {
    // 段落 [300,340]，可视段 200 高，最多能滚 300 → 滚到 140 刚好露出下沿
    expect(scrollToShowPx(300, 340, 200, 300)).toBe(140);
    // 已经在眼里就不动
    expect(scrollToShowPx(10, 40, 200, 300)).toBe(0);
    // 这一段自己比可视段还高，就从它的上沿开始露
    expect(scrollToShowPx(100, 500, 200, 300)).toBe(100);
    // 没得滚 / 量不出来一律 0，不平白往 DOM 上写
    expect(scrollToShowPx(300, 340, 200, 0)).toBe(0);
    expect(scrollToShowPx(300, 340, 0, 300)).toBe(0);
    expect(scrollToShowPx(Number.NaN, 340, 200, 300)).toBe(0);
  });

  it("有反馈话就先露反馈话，没有就露选项整排", () => {
    expect(revealTargetOf("答对啦！真棒！")).toBe(".qz-msg");
    expect(revealTargetOf("悄悄提示：一闪一闪的那个就是答案！")).toBe(".qz-msg");
    expect(revealTargetOf("")).toBe(".qz-choices");
    expect(revealTargetOf("   ")).toBe(".qz-choices");
    expect(revealTargetOf(null)).toBe(".qz-choices");
  });

  it("答题那条路真的渲进本款自己的宿主，而不是直接渲进舞台", () => {
    expect(SRC, "没给答题屏建宿主").toContain("fitQuizHost");
    const play = SRC.slice(SRC.indexOf("const run = ("), SRC.indexOf("return runTimed"));
    expect(play, "runQuizWithReview 还是直接渲进 inner").not.toMatch(/runQuizWithReview\(\{\s*stage:\s*inner/);
    expect(play).toMatch(/stage:\s*host/);
  });

  it("拆得干净：宿主要摘掉、收紧器要 dispose", () => {
    expect(SRC).toContain("fit.dispose()");
    expect(SRC).toContain("host.remove()");
  });

  it("拼字 / 全选那两种玩法一个字没动，仍旧直接渲进 inner", () => {
    const play = SRC.slice(SRC.indexOf("const run = ("), SRC.indexOf("return runTimed"));
    expect(play).toMatch(/runPickAll\(\{\s*stage:\s*inner/);
    expect(play).toMatch(/runSpell\(\{\s*stage:\s*inner/);
  });
});
