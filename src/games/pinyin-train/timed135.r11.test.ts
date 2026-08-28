/**
 * N-37 合入后补测：root × pinyin-train 第 135 关（限时）三票 915×412。
 * 不新开号、不改倒计时接线；钉已合入的矮屏护栏仍在。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENE_CSS } from "./scene";

const TIMED = readFileSync(new URL("./timed.ts", import.meta.url), "utf8");
const LEVEL99 = readFileSync(new URL("../level99.ts", import.meta.url), "utf8");
const PICK = readFileSync(new URL("./pickAll.ts", import.meta.url), "utf8");
const SPELL = readFileSync(new URL("./spell.ts", import.meta.url), "utf8");

describe("N-37 × 限时 135 矮横屏护栏仍在", () => {
  it("root 抬头 :has(.l99-jump) 矮屏收口仍在（N-37）", () => {
    expect(LEVEL99).toContain("@media (max-height:500px)");
    expect(LEVEL99).toContain(".l99-stagebar:has(.l99-jump)");
  });

  it("限时条矮屏收高，倒计时接线未改", () => {
    expect(TIMED).toContain("@media (max-height:500px)");
    expect(TIMED).toContain("export function runTimed");
    expect(TIMED).toContain("TIME_UP_LINE");
    expect(SCENE_CSS).toContain("@media (max-height:500px){.pyt-scene{height:72px;}}");
  });

  it("拼写/全选双栏在场，第 135 关走同一壳", () => {
    expect(SPELL).toContain("@media (max-height:500px) and (min-width:640px)");
    expect(PICK).toContain("@media (max-height:500px)");
  });
});
