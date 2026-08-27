/**
 * 窗口 6 · 第 1 轮视觉监督修复员(C 档)· box-hamster 舞台底纹钉住测试(B 档 TOP-9)。
 *
 * 修复:三主题舞台底从纯 tint 平涂升级为「tint 收底 + ≤8% 材质层」——
 * 木屋 45° 木纹 / 冰窖两粒白光斑 / 花园三瓣小花 96px 平铺。
 * 底纹走 background(天然点不到),不改棋盘几何与 HUD,对比度不受影响。
 * B 档原话:这一条是层次感,不是塞满,超过 8% 宁可不加。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BH_THEMES } from "./visual";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("box-hamster 舞台底纹(fixer 落地 B 档 TOP-9)", () => {
  it("三主题都有 mat 底纹,且以各自 tint 收底(毯面永远有色可回退)", () => {
    for (const t of BH_THEMES) {
      expect(t.mat, t.id).toBeTruthy();
      expect(t.mat.trim().endsWith(t.tint), `${t.id} 的 mat 没拿 tint 收底`).toBe(true);
    }
  });

  it("材质层峰值透明度全部 ≤8%(rgba 的 a 与 fill-opacity 逐个查)", () => {
    for (const t of BH_THEMES) {
      const alphas = [
        ...[...t.mat.matchAll(/rgba\([^)]*?,\s*(\.\d+|0|1)\)/g)].map((m) => Number(m[1])),
        ...[...t.mat.matchAll(/fill-opacity='(\.\d+)'/g)].map((m) => Number(m[1])),
      ];
      expect(alphas.length, `${t.id} 的 mat 里找不到透明度声明`).toBeGreaterThan(0);
      for (const a of alphas) expect(a, `${t.id} 底纹超过 8% 透明度`).toBeLessThanOrEqual(0.08);
    }
  });

  it("木屋=45° 木纹 24px 周期;冰窖=两粒光斑;花园=96px 平铺小花", () => {
    const [cabin, cellar, garden] = BH_THEMES;
    expect(cabin.mat).toContain("repeating-linear-gradient(45deg");
    expect(cabin.mat).toContain("12px 24px");
    expect((cellar.mat.match(/radial-gradient\(/g) ?? []).length).toBe(2);
    expect(garden.mat).toContain("data:image/svg+xml");
    expect(garden.mat).toContain("96px 96px repeat");
    expect((garden.mat.match(/%3Ccircle/g) ?? []).length).toBe(3); // 三瓣
  });

  it("index 消费 mat 而不是裸 tint;主题角标 deco 原样保留", () => {
    expect(SRC).toContain("box.style.background = theme.mat");
    expect(SRC).toContain("themeDeco.innerHTML = theme.deco");
  });

  it("底纹不带 emoji、不带动画(reduced 无需额外分支)", () => {
    for (const t of BH_THEMES) {
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t.mat)).toBe(false);
      expect(t.mat).not.toContain("animation");
    }
  });
});
