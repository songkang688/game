/**
 * N-97：root 永久档直达末章末关（188），915×412 上三颗选项 394~440 全在舞台裁切线下。
 * 病灶两处，都在公共壳（A 独占面）：
 *  1. level99 矮横屏档 .l99-wrap{max-height:276px} 是给地图档让模式条的（N-63），
 *     关内也被它截走 62px 舞台高——关内放开回基础档 height:100%；
 *  2. quiz99 root 档「🎫 直达这题」整行 44px 插在题面上方——矮横屏用 order 排到答题区之后。
 * 题库/判分零触碰；竖屏与平板（高>500px）零变化。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const L99 = readFileSync(fileURLToPath(new URL("../level99.ts", import.meta.url)), "utf8");
const QUIZ = readFileSync(fileURLToPath(new URL("../quiz99.ts", import.meta.url)), "utf8");

describe("N-97 root×末章末关选项进屏(915×412)", () => {
  it("l99 关内放开地图档那条 276px 钳位,舞台吃满 game-stage;地图档钳位原样", () => {
    const start = L99.indexOf("@media (max-height:500px){");
    const block = L99.slice(start, L99.indexOf("@media", start + 10));
    expect(block).toContain(".l99-wrap{max-height:calc(100dvh - 136px);}");
    expect(block).toContain(".l99-wrap:has(.l99-stage-wrap){max-height:none;}");
  });

  it("quiz99 矮横屏把 root 直达行排到答题区之后,热区 44 不动", () => {
    const start = QUIZ.indexOf("@media (max-height: 500px)");
    const block = QUIZ.slice(start, QUIZ.indexOf("`;", start));
    expect(block).toContain(".qz-jump { order: 9; }");
    expect(block).toContain(".qz-jump-go { min-height: 44px;");
  });
});

describe("r18-A 复证 N-97 时顺带:农场天空不许盖住「🗺️ 选关」标题条", () => {
  it("四层 absolute 锚进本款舞台:运行时给舞台 position:relative,destroy 原样放回", async () => {
    const LAYER = readFileSync(fileURLToPath(new URL("./farmLayer.ts", import.meta.url)), "utf8");
    expect(LAYER).toContain('if (stage.style && !prevStagePos) stage.style.position = "relative";');
    expect(LAYER).toContain('if (stage.style && !prevStagePos) stage.style.position = "";');
    // CSS 契约不破:FARM_CSS 里仍只有 mtf-/qz- 选择器,场景层规则原样
    const { FARM_CSS } = await import("./farmScene");
    expect(FARM_CSS).toContain(".mtf-scene { position: absolute; inset: 0; z-index: 0;");
    expect(FARM_CSS).not.toContain(".l99-stage");
  });
});
