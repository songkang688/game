/**
 * 红蓝拔河 · 把关内那一屏钳进「舞台真正看得见的那一段」
 * （窗口5 第2轮 档C 监督修复员 · W5R2-FC-03）。
 *
 * 第 2 轮学习优化员判 LC-05「不需要单独收紧」——理由是 LC-02 把模式条收起来之后
 * `.game-stage` 裁掉 0。我自己按同一把尺子复量，这个 0 站不住：
 *
 * | 视口 | 学习优化员记的 | 我复量到的 |
 * | --- | --- | --- |
 * | 390×844 | 0 | 0 |
 * | 360×720 | 0 | 0 |
 * | 360×640 | **0** | **63** |
 * | 320×640 | **0** | **95** |
 *
 * 那 63 / 95px 里装着两样东西：
 *
 * 1. `.rbg-msg`——「看到 🟢 才按住拉，🔴 时松手歇着攒体力!」，
 *    红绿灯章唯一的规则说明，**整句 0 像素可见**；同一格还负责「同一只手连着拉
 *    使不上劲」这类即时反馈。这一层不是按钮，`elementFromPoint` 那把尺子照不到它，
 *    所以逐颗数按钮的复量会给出「够不着 0 颗」的绿灯。
 * 2. 320×640 上 `.rbg-pull` 副标签「按住 F / 空格」被切掉 14px（键心还在，点得着，
 *    但字只剩一半）。
 *
 * 这一款关内**没有任何收紧器**（`poop-hero` 有 `canvasRoomPx`、`kitty-care` 有
 * `fitIntoStage`、`find-diff` 有钳矮 `.fdf-viewport`，只有拔河是裸的）。
 * 补一支和 `poop-hero` 同族的：超出多少就从拔河场 `.rbg-field` 身上扣多少，
 * 扣到 76px 的底线为止——76px 还看得清旗子和两个人，再矮就不知道绳子偏哪边了。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MIN_FIELD_H, fieldRoomPx, visibleRoomPx } from "./fit";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("红蓝拔河 · 拔河场按可视段收（W5R2-FC-03）", () => {
  it("装得下就一个像素都不动", () => {
    expect(fieldRoomPx(400, 124, 400)).toBeNull();
    expect(fieldRoomPx(399, 124, 400)).toBeNull();
    // 只超 1px 也当装得下，免得为了一个像素抖来抖去
    expect(fieldRoomPx(401, 124, 400)).toBeNull();
  });

  it("超出多少就从拔河场身上扣多少", () => {
    // 360×640 实测：wrap 457、可视段 400 → 超 57，拔河场 124 收到 67…但不许破底线
    expect(fieldRoomPx(457, 124, 400)).toBe(MIN_FIELD_H);
    // 超 20px 的话 124 → 104，还在底线之上，如实扣
    expect(fieldRoomPx(420, 124, 400)).toBe(104);
  });

  it("再挤也不许把拔河场压到看不出绳子偏哪边", () => {
    expect(fieldRoomPx(900, 124, 400)).toBe(MIN_FIELD_H);
    expect(MIN_FIELD_H).toBeGreaterThanOrEqual(76);
  });

  it("量不出可视段（高屏 / 测试桩）就不管", () => {
    expect(fieldRoomPx(457, 124, Number.POSITIVE_INFINITY)).toBeNull();
    expect(fieldRoomPx(457, 124, 0)).toBeNull();
    expect(fieldRoomPx(457, 124, -5)).toBeNull();
    expect(fieldRoomPx(Number.NaN, 124, 400)).toBeNull();
    expect(fieldRoomPx(457, 0, 400)).toBeNull();
  });

  it("一层裁切祖先都没有就返回 Infinity（不钳）", () => {
    expect(visibleRoomPx(218, [])).toBe(Number.POSITIVE_INFINITY);
    expect(visibleRoomPx(218, [618, 700])).toBe(400);
  });

  it("三处 `.rbg-wrap` 都接上了收紧器，且换窗口大小会重量一次", () => {
    expect(SRC, "关内那一处没接").toContain("fitFieldIntoStage");
    // 关卡 + 对战 + 拉不完的绳，三处都要接
    const hits = SRC.split("fitFieldIntoStage(").length - 1;
    expect(hits, `只接了 ${hits} 处，三处 .rbg-wrap 都得接`).toBeGreaterThanOrEqual(3);
  });

  it("收紧器拆得干净：每一处接线都配一句 dispose", () => {
    const disposes = SRC.split(".dispose()").length - 1;
    expect(disposes, "接了却不拆，退关之后 resize 监听还挂着").toBeGreaterThanOrEqual(3);
  });
});
