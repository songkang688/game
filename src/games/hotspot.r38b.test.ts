import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const games = fileURLToPath(new URL(".", import.meta.url));
const read = (rel: string) => readFileSync(join(games, rel), "utf8");

describe("r38 B · N-174/175 + 抽验裁切中间档", () => {
  it("N-174 / N-175 拔河选对手与结算钮 ≥44，不改 open/back/toggle", () => {
    const s = read("red-blue-tug/index.ts");
    expect(s).toMatch(/\.rbg-pick \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(s).toMatch(/\.rbg-btn \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(s).toMatch(/\.rbg-open \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(s).toMatch(/\.rbg-back \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
    expect(s).toMatch(/\.rbg-toggle \{[^}]*min-height: \$\{TOGGLE_MIN_H\}px/s);
  });

  it("N-105 禁第四版：combo-clash / mahjong-bloom 本拍零动", () => {
    expect(read("combo-clash/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
    expect(read("mahjong-bloom/index.ts")).not.toContain("max-height:820px) and (pointer:coarse)");
  });

  it("果盆 / 找物 / 冰火：820 粗指针中间档，500 原文仍在", () => {
    const fs = read("fruit-stack/index.ts");
    expect(fs).toContain("@media (max-height:500px)");
    expect(fs).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(fs).toContain("@media (max-width:430px) and (min-height:700px)");
    expect(fs).toContain(".fs-pad{position:sticky;bottom:0");

    const as = read("alien-seek/index.ts");
    expect(as).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(as).toContain("@media (max-height:820px) and (min-width:640px)");
    expect(as).toContain("vh <= 500 && vw >= 640");

    const iff = read("ice-fire-forest/index.ts");
    expect(iff).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(iff).toContain("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    const fiveEnd = iff.indexOf("@media (max-height:820px) and (min-width:640px) and (pointer:coarse)");
    expect(iff.slice(0, fiveEnd)).toContain(".iff-pads{grid-column:2;grid-row:3;flex-direction:row");
  });

  it("星盘 / 飞行棋 / 英雄牌 / 军棋 / 台球：820 钉 CTA，500 档不回退", () => {
    const se = read("star-estate/index.ts");
    expect(se).toContain("@media (max-height:500px){");
    expect(se).toContain(".se-wrap{height:100%;max-height:100%;min-height:0;overflow:hidden");
    expect(se).toContain("@media (max-height:820px) and (pointer:coarse)");
    expect(se).toContain("@media (max-width:430px) and (min-height:700px)");

    const fc = read("flight-chess/index.ts");
    expect(fc).toContain("@media (max-height:500px){");
    expect(fc).toContain(".fc-wrap{max-height:calc(100dvh - 76px);}");
    expect(fc).toContain("@media (max-height:820px) and (pointer:coarse)");

    const hc = read("hero-cards/index.ts");
    expect(hc).toContain("@media (max-height:500px){");
    expect(hc).toContain(".hc-wrap{max-height:calc(100dvh - 76px);}");
    expect(hc).toContain("@media (max-height:820px) and (pointer:coarse)");

    const jq = read("junqi-camp/view.ts");
    expect(jq).toContain("min-height:300px");
    expect(jq).toContain("@media (max-height:500px){");
    expect(jq).toContain("@media (max-height:820px) and (pointer:coarse)");

    const ps = read("pool-stars/view.ts");
    expect(ps).toContain("@media (min-width:560px) and (max-height:500px)");
    expect(ps).toContain("@media (min-width:560px) and (max-height:820px) and (pointer:coarse)");
    expect(ps).toContain("ih > 0 && ih <= 500 && viewportWidth() >= 560");
  });
});
