/**
 * prince-princess · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * S1:五小怪从「裸 emoji 全身字形」升级为五母形自绘
 *     (果冻半圆水滴 / 蝙蝠圆体三角翼两帧 / 铠甲圆体前置盾 / 幽灵摆边纱体 / 法珠环绕三珠)。
 * S2:BOSS 从「单色圆角矩形 + emoji 脸」升级为参数化 Q 版首领骨架
 *     (三停渐变胖椭圆 + 皱眉鼓腮 + 短圆四肢 + 七套特征件),
 *     guard 光环改边缘径向渐变淡出,出场 400ms 缩放弹入(reduced 直接淡入)。
 * 几何全部按 ENEMY_STATS / BOSS_W / BOSS_H 现尺寸挂比例,判定盒只读不动。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import type { EnemyKind } from "./levels";
import {
  BAT_FLAP_MS,
  BOSS_INTRO_MS,
  ORB_COUNT,
  ORB_SPIN_MS,
  PP_ENEMY,
  bossIntroScale,
  drawBossFigure,
  drawEnemy,
  drawGuardHalo,
} from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const KINDS: EnemyKind[] = ["slime", "bat", "armor", "ghost", "turret"];
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

describe("prince-princess · 修复员 S1 · 五小怪母形自绘", () => {
  it("五种小怪 × 双朝向 × reduced 两档都画得动不抛,最小尺寸也不炸", () => {
    for (const kind of KINDS) {
      for (const dir of [1, -1] as const) {
        for (const reduced of [false, true]) {
          expect(() => drawEnemy(ctx2d(new FakeCtx()), kind, 80, 60, 36, 30, 1234, reduced, dir), kind).not.toThrow();
        }
      }
      expect(() => drawEnemy(ctx2d(new FakeCtx()), kind, 5, 5, 8, 8, 0, false), kind).not.toThrow();
    }
  });

  it("统一眼型在场:竖椭圆(ry > rx)至少两枚", () => {
    for (const kind of KINDS) {
      const c = new FakeCtx();
      drawEnemy(ctx2d(c), kind, 80, 60, 36, 30, 500, false, 1);
      const eyes = c.ops.filter((o) => o.op === "ellipse" && o.args[3] > o.args[2]);
      expect(eyes.length, kind).toBeGreaterThanOrEqual(2);
    }
  });

  it("五小怪主色合法且互不重复(母形 + 色双通道识别)", () => {
    const colors = Object.values(PP_ENEMY);
    for (const c of colors) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("动效表按 learner #6 规格:蝙蝠翼 300ms 两帧,法珠 3 颗公转", () => {
    expect(BAT_FLAP_MS).toBe(300);
    expect(ORB_COUNT).toBe(3);
    expect(ORB_SPIN_MS).toBeGreaterThan(0);
  });

  it("法珠怪 reduced 定格:同一毫秒喂不同 tMs,reduced 档的珠位完全一致", () => {
    const at = (tMs: number, reduced: boolean): string => {
      const c = new FakeCtx();
      drawEnemy(ctx2d(c), "turret", 80, 60, 38, 42, tMs, reduced, 1);
      return JSON.stringify(c.ops.filter((o) => o.op === "arc"));
    };
    expect(at(0, true)).toBe(at(999, true));
    expect(at(300, false)).not.toBe(at(900, false));
  });

  it("index.ts 小怪已换 drawEnemy,ENEMY_FACE emoji 脸谱表退场", () => {
    const src = read("index.ts");
    expect(src).toContain("drawEnemy(");
    expect(src).not.toContain("ENEMY_FACE[");
    for (const e of ["🟢", "🦇", "🔮"]) expect(src).not.toContain(e);
  });
});

describe("prince-princess · 修复员 S2 · 参数化首领骨架", () => {
  it("七套特征件(丸串/蜂后/石像/风筝/小龙/雪首领/王者)都画得动不抛", () => {
    const colors = ["#F4A6C4", "#EBC55C", "#7FA9D6", "#8FC7EA", "#EE8B5C", "#9FD3EC", "#8C7BC4"];
    for (let k = 0; k < 7; k++) {
      expect(() => drawBossFigure(ctx2d(new FakeCtx()), 120, 160, 72, 84, k, colors[k]), `kind ${k}`).not.toThrow();
    }
    // 越界编号也不炸(骨架兜底,特征件缺省)
    expect(() => drawBossFigure(ctx2d(new FakeCtx()), 120, 160, 72, 84, 99, "#888888")).not.toThrow();
  });

  it("guard 光环改渐变淡出:画得动,且 index 不再用平涂 0.28 大圆角矩形", () => {
    expect(() => drawGuardHalo(ctx2d(new FakeCtx()), 120, 160, 72, 84, "#E4635F", 0.28)).not.toThrow();
    const src = read("index.ts");
    expect(src).toContain("drawGuardHalo(");
    expect(src).toContain("drawBossFigure(");
    expect(src).not.toMatch(/globalAlpha = boss\.hurtT > 0 \? 0\.45 : 0\.28/);
  });

  it("出场弹入:400ms,0.7 起步收于 1,回弹不超过 9%;reduced 恒 1", () => {
    expect(BOSS_INTRO_MS).toBe(400);
    expect(bossIntroScale(0, false)).toBeCloseTo(0.7, 5);
    expect(bossIntroScale(1, false)).toBeCloseTo(1, 5);
    for (const k of [0.2, 0.5, 0.8]) {
      expect(bossIntroScale(k, false)).toBeGreaterThan(0.69);
      expect(bossIntroScale(k, false)).toBeLessThanOrEqual(1.09);
    }
    expect(bossIntroScale(0.5, true)).toBe(1);
  });

  it("BOSS 本体不再是「单色圆角矩形 + emoji 脸」:emoji(g, info.emoji…) 调用退场", () => {
    expect(read("index.ts")).not.toContain("emoji(g, info.emoji");
  });
});
