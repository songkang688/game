import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * N-32(trio-r7):无尽地牢战斗 915×412 攻击/防御/莓果三个回合必点钮折叠线下(实测裁 268)。
 * 修法(配方 E + 双栏):
 *  1. .bvp-acts 贴底常驻 —— position:sticky;bottom:0,不透明底 + 上缘阴影,
 *     竖屏内容装不下时操作行钉在滚动口下沿(shape-kingdom .shk-dock 同款先例);
 *  2. sticky 在 grid 区域内没有活动余量,矮横屏(max-height:500px)靠 .bvp-battle 双栏
 *     把「我方卡+提示+操作行」收进左栏、「对方卡+预判+战报」收进右栏,操作行进首屏。
 * 战斗数值 / 莓果计数 / 层数生成零触碰 —— 本文件只锁壳。
 */

const SRC = readFileSync(join(__dirname, "index.ts"), "utf8");

describe("brave-path 战斗操作行贴底 + 矮横屏双栏(N-32)", () => {
  it("操作行 .bvp-acts 是 sticky 贴底、带不透明底与上缘阴影", () => {
    const rule = SRC.match(/\.bvp-acts\{([^}]+)\}/);
    expect(rule, "缺 .bvp-acts 规则").toBeTruthy();
    const body = rule![1];
    expect(body).toContain("position:sticky");
    expect(body).toContain("bottom:0");
    expect(body).toMatch(/background:#[0-9a-f]{8}/);
    expect(body).toMatch(/box-shadow:0 -\d+px/);
  });

  it("矮横屏档把战斗壳切成双栏:我方+操作在左,对方+战报在右", () => {
    const media = SRC.match(/@media\(max-height:500px\)\{([\s\S]*?)\n\}/);
    expect(media, "缺 @media(max-height:500px) 档").toBeTruthy();
    const body = media![1];
    expect(body).toMatch(/\.bvp-battle\{[^}]*display:grid/);
    expect(body).toMatch(/\.bvp-battle \.bvp-fighter-hero\{grid-column:1/);
    expect(body).toMatch(/\.bvp-battle \.bvp-fighter-foe\{grid-column:2/);
    expect(body).toMatch(/\.bvp-battle \.bvp-acts\{grid-column:1/);
    expect(body).toMatch(/\.bvp-battle \.bvp-log\{grid-column:2/);
  });

  it("DOM:战斗壳挂 bvp-battle,敌我卡带侧别类,两条提示行可区分", () => {
    expect(SRC).toMatch(/el\("div", "bvp-battle"\)/);
    expect(SRC).toMatch(/`bvp-fighter bvp-fighter-\$\{side\}`/);
    expect(SRC).toMatch(/"bvp-note bvp-fore-note"/);
    expect(SRC).toMatch(/"bvp-note bvp-turn-hint"/);
  });

  it("战报区矮横屏钳高但仍可滚(读的可滚,按的常驻)", () => {
    expect(SRC).toMatch(/\.bvp-battle \.bvp-log\{[^}]*max-height:104px/);
    const logRule = SRC.match(/\.bvp-log\{([^}]+)\}/);
    expect(logRule![1]).toContain("overflow-y:auto");
  });
});
