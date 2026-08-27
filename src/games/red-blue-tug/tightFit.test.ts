/**
 * 红蓝拔河 · 拔河场收到底线之后还差 37px（窗口5 第2轮 档C 监督修复员 · W5R2-FC-07）。
 *
 * `fitFieldIntoStage()` 把 `.rbg-field` 从 124px 收到底线 76px 之后，
 * 320×640 上这一屏仍是 441px，而可视段只有 404px。掉在外面的还是那一句
 * `.rbg-msg`「看到 🟢 才按住拉，🔴 时松手歇着攒体力!」——36px 高只露 11px，
 * 而且这一款**没有可滚祖先**（拔河是按住不放的玩法，不许挂滚动条），
 * 所以不是「滚一下就看得见」，是看不见。
 *
 * 再从场地身上扣就看不出绳子偏哪边了。省在别处：
 * 这一屏一共排着 6 块，块间距 8px × 4 + 提示行上边距 8 + 外框上下内边距 12×2，
 * 光「空」就占 64px。挤的时候把这套竖向节奏减半（`rbg-tight`），
 * 一格不动地让出 32px，剩下的 5px 由场地再让一让（76 是底线，不破）。
 *
 * 宽松的时候一个像素都不改：390×844 / 360×720 上照原样。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MIN_FIELD_H, TIGHT_SAVING_PX, needsTight } from "./fit";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("红蓝拔河 · 收到底线还装不下就压竖向节奏（W5R2-FC-07）", () => {
  it("场地还没到底线，就别急着压节奏", () => {
    // 一屏 441、可视段 404：超 37，场地 124 还能扣到 87（>76），不用压
    expect(needsTight(441, 124, 404)).toBe(false);
  });

  it("场地已经在底线上还超出，才压", () => {
    // 场地已经是 76 了，还超 37 —— 这就是 320×640 实测的那一屏
    expect(needsTight(441, MIN_FIELD_H, 404)).toBe(true);
  });

  it("压完这一屏正好回得来（320×640 实测：超 37，让出 32 + 场地 5）", () => {
    expect(TIGHT_SAVING_PX).toBeGreaterThanOrEqual(32);
    expect(441 - TIGHT_SAVING_PX - 404).toBeLessThanOrEqual(MIN_FIELD_H - 40);
  });

  it("装得下 / 量不出可视段就不压", () => {
    expect(needsTight(400, MIN_FIELD_H, 404)).toBe(false);
    expect(needsTight(405, MIN_FIELD_H, 404)).toBe(false);
    expect(needsTight(441, MIN_FIELD_H, Number.POSITIVE_INFINITY)).toBe(false);
    expect(needsTight(441, MIN_FIELD_H, 0)).toBe(false);
    expect(needsTight(Number.NaN, MIN_FIELD_H, 404)).toBe(false);
  });

  it("三处 `.rbg-wrap` 走的是同一支收紧器，压节奏自然也一起管", () => {
    const hits = SRC.split("fitFieldIntoStage(").length - 1;
    expect(hits).toBeGreaterThanOrEqual(3);
    expect(SRC, "压节奏那条规则没写进样式").toContain("rbg-tight");
  });

  it("压的只是空隙，按钮热区一格不动", () => {
    const from = SRC.indexOf(".rbg-wrap.rbg-tight");
    // 只看第一档：`rbg-tighter` 是 W5R3-B-02 加的下一档，它可以扣按钮，
    // 但有 MIN_PULL_H=56 的底线，守门在 tighterFit.test.ts
    const to = SRC.indexOf(".rbg-wrap.rbg-tighter", from);
    const block = SRC.slice(from, to > from ? to : SRC.indexOf("@media (prefers-reduced-motion", from));
    expect(block.length).toBeGreaterThan(0);
    expect(block, "把控制键也压小了，热区会掉到 44px 以下").not.toMatch(/\.rbg-(pull|back|ctrl|toggle)\b[^{]*\{[^}]*height/);
    // 让出来的必须是空隙：内边距与块间距
    expect(block).toMatch(/padding:\s*6px/);
    expect(block).toMatch(/margin-bottom:\s*4px/);
  });
});
