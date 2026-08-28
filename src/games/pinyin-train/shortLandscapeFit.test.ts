/**
 * N-34 / N-35(trio-r9)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENE_CSS } from "./scene";

const SPELL = readFileSync(new URL("./spell.ts", import.meta.url), "utf8");
const PICK = readFileSync(new URL("./pickAll.ts", import.meta.url), "utf8");

describe("N-34 拼写关矮横屏双栏", () => {
  it("max-height:500px 把画布放到左栏、票排与开车钮在右栏", () => {
    expect(SPELL).toContain("@media (max-height:500px)");
    expect(SPELL).toMatch(/grid-template-columns:minmax\(150px,34%\)/);
    expect(SPELL).toContain(".pyt-go{position:sticky;bottom:0");
  });

  it("拼读判定函数签名仍在", () => {
    expect(SPELL).toContain("spell(p.initial as string, p.final as string, p.tone as number)");
  });
});

describe("N-35 全选关矮横屏双栏", () => {
  it("pk-chips 进右栏,火车舞台进左栏", () => {
    expect(PICK).toContain("@media (max-height:500px)");
    expect(PICK).toMatch(/grid-template-columns:minmax\(150px,34%\)/);
    expect(PICK).toContain(".pk-chips{overflow-y:auto");
  });

  it("挑拣判定仍走 judgePickAll", () => {
    expect(PICK).toContain("const verdict = judgePickAll([...picked], task.correct);");
  });
});

describe("共享火车画布带矮屏缩高", () => {
  it("SCENE_CSS 在 max-height:500px 把舞台从 132 收到 72", () => {
    expect(SCENE_CSS).toContain("@media (max-height:500px){.pyt-scene{height:72px;");
  });
});
