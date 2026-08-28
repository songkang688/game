/**
 * N-43 · 涂色小屋矮横屏：七关型色盘/调色锅不许卷进 .clf-scrolly 线下。
 * 判定 / 线稿 / 混色表零触碰；只钉皮肤 CSS 与操作排结构。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLF_CSS } from "./ui";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const MIX = readFileSync(fileURLToPath(new URL("./mix.ts", import.meta.url)), "utf8");
const LINE = readFileSync(fileURLToPath(new URL("./linework.ts", import.meta.url)), "utf8");
const LEVELS = readFileSync(fileURLToPath(new URL("./levels.ts", import.meta.url)), "utf8");

function media(query: string): string {
  const i = CLF_CSS.indexOf(`@media ${query}`);
  expect(i, `缺少 ${query}`).toBeGreaterThan(0);
  const next = CLF_CSS.indexOf("@media", i + 1);
  return next < 0 ? CLF_CSS.slice(i) : CLF_CSS.slice(i, next);
}

describe("N-43 color-fun 矮横屏双栏（配方 G/J）", () => {
  it("操作排收到 .clf-ops，不跟画布混成一长条", () => {
    expect(INDEX).toContain('class="clf-ops"');
    const ops = INDEX.slice(INDEX.indexOf('class="clf-ops"'), INDEX.indexOf("stage.appendChild(wrap)"));
    expect(ops).toContain("clf-chips");
    expect(ops).toContain("clf-tools");
    expect(ops).toContain("clf-palette");
    expect(ops).toContain("clf-msg");
    expect(ops).toContain("clf-mixer");
    expect(INDEX.indexOf('class="clf-stage"')).toBeLessThan(INDEX.indexOf('class="clf-ops"'));
  });

  it("矮屏松开 55vh；宽屏把画布置左、色盘+锅置右 sticky", () => {
    expect(CLF_CSS).toContain("@media (max-height:500px)");
    expect(CLF_CSS).toContain("@media (max-height:500px) and (min-width:640px)");
    const short = media("(max-height:500px)");
    expect(short).toContain(".clf-stage{min-height:0;}");
    const dock = media("(max-height:500px) and (min-width:640px)");
    expect(dock).toContain("grid-template-columns:minmax(0,1fr) minmax(280px,42%)");
    expect(dock).toContain('grid-area:stage');
    expect(dock).toContain('grid-area:ops');
    expect(dock).toContain("position:sticky");
    expect(dock).not.toContain("clf-scrolly");
  });

  it("判定 / 线稿 / 混色表零触碰", () => {
    expect(MIX).toContain("export const MIX_TABLE");
    expect(MIX).toContain("export function stirColor");
    expect(LINE).toContain("export const EXTRA_PICTURES");
    expect(LEVELS).toContain("export const LEVELS");
    expect(INDEX).toContain("ctx.win(got");
  });
});
