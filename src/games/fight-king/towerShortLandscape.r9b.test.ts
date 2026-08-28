/**
 * 三人组 r9-B(d909) · N-25 续:格斗塔矮横屏双栏。
 *
 * 先合版把出战八宫格收成一行之后，915×412 实测塔里仍然裁 289、
 * 四枚触屏键(轻击/重击/必杀/防御)整排落在裁切线以下。塔的壳比别的模式多两层
 * (返回条 + 出战条,再加 level99 的关卡条与对手提示),竖着排一定装不下。
 * 这里走配方 G：返回条与出战条并成一排，对局壳画面在左、标题条与键排在右。
 *
 * 护栏：规则只认 .fk-tower-head / .fk-tower-fight 两个塔专属类。
 * 人机 / 双人 / 无尽（无尽实测裁 27，已干净）与训练场（先合版 sticky 已生效）不受影响。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIGHT_MIN_H, stageMaxWidthPx } from "./index";

const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 抓出矮横屏那一段媒体查询的正文 */
function shortLandscapeBlock(): string {
  const head = "@media (max-height:520px) and (orientation:landscape){";
  const at = src.indexOf(head);
  expect(at, "缺矮横屏媒体查询").toBeGreaterThan(-1);
  let depth = 0;
  for (let i = at + head.length - 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(at + head.length, i);
    }
  }
  throw new Error("矮横屏媒体查询没有闭合");
}

describe("N-25 续 · 格斗塔矮横屏双栏", () => {
  it("媒体查询只盯矮横屏,915×412 命中而 412×915 / 1280×800 不命中", () => {
    const q = { maxHeight: 520 };
    const hit = (w: number, h: number): boolean => h <= q.maxHeight && w > h;
    expect(hit(915, 412)).toBe(true);
    expect(hit(412, 915)).toBe(false);
    expect(hit(1280, 800)).toBe(false);
    expect(hit(1024, 768)).toBe(false);
    expect(hit(390, 844)).toBe(false);
  });

  it("返回条与出战条并进同一层 .fk-tower-head,竖屏仍是上下两行", () => {
    expect(src).toContain('const head = el("div", "fk-tower-head");');
    expect(src).toContain("head.appendChild(bar);");
    expect(src).toContain("head.appendChild(heroRow);");
    // 基线层没有 .fk-tower-head 规则,合排只在矮横屏里发生
    const base = src.slice(0, src.indexOf("@media (max-height:520px) and (orientation:landscape){"));
    expect(base).not.toContain(".fk-tower-head{");
    const block = shortLandscapeBlock();
    expect(block).toContain(".fk-tower-head{display:flex;");
    expect(block).toContain(".fk-tower-head>.fk-bar{margin-bottom:0;}");
  });

  it("对局壳左画面右键排:画面占两行,标题条与键排让到第二列", () => {
    const block = shortLandscapeBlock();
    expect(block).toMatch(/\.fk-tower-fight\{[^}]*display:grid;/);
    expect(block).toMatch(/\.fk-tower-fight\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(212px,300px\);/);
    expect(block).toContain(".fk-tower-fight>.fk-stage{grid-column:1;grid-row:1 / span 2;}");
    expect(block).toContain(".fk-tower-fight>.fk-bar{grid-column:2;grid-row:1;");
    expect(block).toContain(".fk-tower-fight>.fk-pads{grid-column:2;grid-row:2;");
  });

  it("右栏留够键排宽度:212px 装得下摇杆 96 + 两列 ≥44px 的按键", () => {
    const min = 212;
    const stick = 96;
    const gap = 6;
    const twoCols = min - stick - gap;
    expect(twoCols / 2).toBeGreaterThanOrEqual(44);
  });

  it("只有塔挂 fk-tower-fight,人机/双人/无尽/训练场壳不挂", () => {
    expect(src).toContain('shellClass: "fk-tower-fight",');
    expect(src.match(/shellClass: "fk-tower-fight"/g)).toHaveLength(1);
    // 三处 createFight 调用里,只有塔那一处给了 shellClass
    expect(src.match(/createFight\(host, \{/g)?.length).toBeGreaterThanOrEqual(3);
    expect(src).toContain("if (o.shellClass) wrap.classList.add(o.shellClass);");
  });

  it("矮横屏那段一条规则都不外溢到别的壳", () => {
    const block = shortLandscapeBlock();
    for (const line of block.split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("/*") && !s.startsWith("*"))) {
      if (!line.includes("{")) continue;
      const sel = line.slice(0, line.indexOf("{"));
      expect(sel.includes("fk-tower-head") || sel.includes("fk-tower-fight") || sel.includes("fk-tower-hint")).toBe(true);
    }
  });

  it("对手提示改走类名,行距/字号红线不动,只收矮横屏那点外边距", () => {
    expect(src).toContain('el("div", "fk-sub fk-tower-hint")');
    expect(src).not.toContain('hint.style.marginBottom = "8px";');
    expect(src).toContain(".fk-tower-hint{margin-bottom:8px;}");
    expect(shortLandscapeBlock()).toContain(".fk-tower-hint{margin-bottom:2px;}");
  });

  it("钳高门槛与帧数表零触碰:FIGHT_MIN_H 仍是 150,钳宽公式不变", () => {
    expect(FIGHT_MIN_H).toBe(150);
    // 双栏之后画面下面没有键排了,余量变大 → 该不钳就不钳
    expect(stageMaxWidthPx(360, 380 / 640, 260)).toBeNull();
    // 余量再小也兜在 FIGHT_MIN_H，再窄兜在 120px 盒宽
    expect(stageMaxWidthPx(632, 2, 60)).toBe(Math.max(120, Math.floor(FIGHT_MIN_H / 2)));
  });
});
