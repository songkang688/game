import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCENE_CSS } from "./scene";

const SPELL = readFileSync(fileURLToPath(new URL("./spell.ts", import.meta.url)), "utf8");
const PICK = readFileSync(fileURLToPath(new URL("./pickAll.ts", import.meta.url)), "utf8");
const TIMED = readFileSync(fileURLToPath(new URL("./timed.ts", import.meta.url)), "utf8");
const LOGIC = readFileSync(fileURLToPath(new URL("./pinyin.ts", import.meta.url)), "utf8");

describe("N-34 拼写关矮横屏双栏（配方 G/J）", () => {
  it("矮屏松开 380 下限，宽屏把舞台和票排拆成两列", () => {
    expect(SPELL).toContain("@media (max-height:500px)");
    expect(SPELL).toContain(".pyt-spell{min-height:0");
    expect(SPELL).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(SPELL).toContain("grid-template-columns:minmax(168px,34%) minmax(0,1fr)");
    expect(SPELL).toContain(".pyt-yard{grid-column:2;");
    expect(SPELL).toContain(".pyt-go{position:sticky;bottom:0");
  });

  it("拼读判定模块零触碰", () => {
    expect(LOGIC).toContain("export function spell(");
    expect(SPELL).toContain("judgeSpell");
  });
});

describe("N-35 全选关矮横屏双栏", () => {
  it("选票进右栏，舞台进左栏", () => {
    expect(PICK).toContain("@media (max-height:500px)");
    expect(PICK).toContain(".pk-wrap{min-height:0");
    expect(PICK).toContain(".pk-chips{grid-column:2;");
    expect(PICK).toContain(".pyt-scene{grid-column:1;");
  });
});

describe("限时关与舞台矮屏护栏", () => {
  it("矮屏舞台缩高但不改倒计时接线", () => {
    expect(SCENE_CSS).toContain("@media (max-height:500px){.pyt-scene{height:72px;}}");
    expect(TIMED).toContain("export function runTimed");
    expect(TIMED).toContain("TIME_UP_LINE");
    expect(TIMED).toContain(".tm-bar");
  });
});
