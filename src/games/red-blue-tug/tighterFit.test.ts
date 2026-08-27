/**
 * 红蓝拔河 · 空隙减半还装不下时的下一档（1.2 窗口5 · 第 3 轮 · 档B，W5R3-B-02）。
 *
 * 第 2 轮 W5R2-FC-03 修的是「场地退到底线 + 空隙减半」这两档。它在 320×640 上够用，
 * 可 320×568 的后段章节撞穿了：机关胶囊（`.rbg-chip`）会随章节变多，第 188 关排到三行，
 * `.rbg-gear` 从第 1 关的 44px 长到 104px，把底下的东西整片顶出裁切线。
 *
 * 真机实测（Chrome headless + CDP，裁切线一律按 padding box 算 = 舞台下沿 − 4px 白边）：
 *   320×568 裁切线 y=550，`.rbg-wrap` 顶 y=218，可视段 332px。
 *   第 1 关：这一屏 343px，`.rbg-msg` 可见 31/36px（还剩一行看得见）；
 *   第 117 关：373px，`.rbg-gear` 74px，`.rbg-msg` 可见 **1/36px**；
 *   第 188 关：403px，`.rbg-gear` 104px，`.rbg-msg` 可见 **0/36px**，
 *     两颗大按钮 `.rbg-pull` 76px 高只露出 51px，第二行「按住 F / 空格」压没了。
 * 「按住蓄力、松手换气，🎈 过中线时按下去额外拉一把！」是这一关的玩法说明，
 * 一个像素都看不见 = 孩子不知道要按住不放，按严重记（键还点得着，不算阻断）。
 *
 * 这一款**故意不挂滚动条**：拔河是按住不放的连点玩法，手指一滑就松了力。
 * 所以往下再走两档：先收字号与内边距，还不够才逐档扣两颗大按钮（底线 56px）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MIN_FIELD_H, MIN_PULL_H, needsTighter, pullRoomPx } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const SRC = readFileSync(`${dir}index.ts`, "utf8");
const FIT = readFileSync(`${dir}fit.ts`, "utf8");

describe("红蓝拔河 · needsTighter", () => {
  it("真机第 188 关那一档要收：这一屏 403、可视段只有 332", () => {
    expect(needsTighter(403, 332)).toBe(true);
  });

  it("第 117 关也要收（可见 1px 也是看不见）", () => {
    expect(needsTighter(373, 332)).toBe(true);
  });

  it("装得下就不收；只超 1px 当子像素误差，不为它抖", () => {
    expect(needsTighter(332, 332)).toBe(false);
    expect(needsTighter(333, 332)).toBe(false);
    expect(needsTighter(334, 332)).toBe(true);
  });

  it("量不出可视段（高屏）一律不收", () => {
    expect(needsTighter(403, Number.POSITIVE_INFINITY)).toBe(false);
    expect(needsTighter(403, 0)).toBe(false);
    expect(needsTighter(Number.NaN, 332)).toBe(false);
  });
});

describe("红蓝拔河 · pullRoomPx", () => {
  it("超多少就从按钮身上扣多少", () => {
    expect(pullRoomPx(352, 76, 332)).toBe(56);
    expect(pullRoomPx(342, 76, 332)).toBe(66);
  });

  it("扣到底线就不再扣了——56px 以下按钮里第二行字就压没了", () => {
    expect(pullRoomPx(500, 76, 332)).toBe(MIN_PULL_H);
    expect(MIN_PULL_H, "热区下限是 44px，底线不许低于它").toBeGreaterThanOrEqual(44);
  });

  it("装得下 / 量不出来就返回 null，照原样别管", () => {
    expect(pullRoomPx(332, 76, 332)).toBeNull();
    expect(pullRoomPx(333, 76, 332)).toBeNull();
    expect(pullRoomPx(403, 76, Number.POSITIVE_INFINITY)).toBeNull();
    expect(pullRoomPx(403, 0, 332)).toBeNull();
    expect(pullRoomPx(Number.NaN, 76, 332)).toBeNull();
  });
});

describe("红蓝拔河 · 收紧档的样式", () => {
  const block = (() => {
    const from = SRC.indexOf(".rbg-wrap.rbg-tighter");
    expect(from, "样式里没有 rbg-tighter 这一档").toBeGreaterThan(-1);
    return SRC.slice(from, SRC.indexOf("@media (prefers-reduced-motion", from));
  })();

  it("收的是字号与内边距", () => {
    expect(block).toMatch(/\.rbg-chip[^{]*\{[^}]*font-size/);
    expect(block).toMatch(/\.rbg-msg[^{]*\{[^}]*font-size/);
  });

  it("那两颗按钮的高度改的是自定义属性，不是写死一个数", () => {
    expect(block).toMatch(/\.rbg-pull[^{]*\{[^}]*var\(--rbg-pull-h/);
    expect(block, "写死高度就绕过了 MIN_PULL_H 的底线").not.toMatch(
      /\.rbg-pull[^{]*\{[^}]*height:\s*\d+px/
    );
  });

  it("热区一个都不动：拼一把开关和退出键在这一档里没被碰过", () => {
    expect(block).not.toMatch(/\.rbg-(toggle|back)\b[^{]*\{[^}]*height/);
  });

  it("字号那几条得带 important，不然压不过 JS 写的内联字号", () => {
    expect(block).toMatch(/\.rbg-chip[^{]*\{[^}]*font-size:[^;]*!important/);
    expect(block).toMatch(/\.rbg-msg[^{]*\{[^}]*font-size:[^;]*!important/);
  });
});

describe("红蓝拔河 · 三档接线", () => {
  it("顺序是「扣场地 → 减空隙 → 收字号 → 扣按钮」，一档比一档狠", () => {
    const field = FIT.indexOf("fieldRoomPx(wrap.scrollHeight");
    const tight = FIT.indexOf('wrap.classList.add("rbg-tight")');
    const tighter = FIT.indexOf('wrap.classList.add("rbg-tighter")');
    const pull = FIT.indexOf("pullRoomPx(wrap.scrollHeight");
    expect(field).toBeGreaterThan(-1);
    expect(tight).toBeGreaterThan(field);
    expect(tighter).toBeGreaterThan(tight);
    expect(pull).toBeGreaterThan(tighter);
  });

  it("每次重量之前先把上一次的三样都还原，不然越量越小", () => {
    const at = FIT.indexOf("const relayout = (): void =>");
    const head = FIT.slice(at, at + 460);
    expect(head).toContain('wrap.classList.remove("rbg-tight")');
    expect(head).toContain('wrap.classList.remove("rbg-tighter")');
    expect(head).toContain("resetPull(p)");
  });

  it("还原按钮高度用的是「这一次重绘写进来的内联值」，不是清空", () => {
    const at = FIT.indexOf("const resetPull");
    expect(at).toBeGreaterThan(-1);
    const body = FIT.slice(at, at + 320);
    expect(body, "清空会让带 important 的规则把高度打成 auto，按钮当场塌成一行字").toContain(
      "p.style.setProperty"
    );
  });

  it("dispose 之后两个记号和自定义属性都摘干净", () => {
    const at = FIT.indexOf("dispose(): void {");
    const body = FIT.slice(at);
    expect(body).toContain('wrap.classList?.remove("rbg-tighter")');
    expect(body).toContain('removeProperty?.("--rbg-pull-h")');
  });

  it("场地的底线一格没动——这一轮加的是下游几档，不是把上游放宽", () => {
    expect(MIN_FIELD_H).toBe(76);
  });
});
