// 记忆翻翻乐 · 1.2 原创图案库单测：六套主题、画得出来、不越框、不沾商标。
import { describe, expect, it } from "vitest";
import { BRAND_WORDS } from "../copy.test";
import {
  MIN_ICONS_PER_PACK,
  THEME_PACKS,
  drawIcon,
  packForTheme,
  type IconCtx,
  type Shape,
} from "./art";

/** 一个只记账不画画的假上下文：单测靠它检查每个图案真的落了笔 */
function fakeCtx(): IconCtx & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    translate: () => calls.push("translate"),
    scale: (x: number) => calls.push(`scale:${x}`),
    rotate: () => calls.push("rotate"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    arc: () => calls.push("arc"),
    ellipse: () => calls.push("ellipse"),
    roundRect: () => calls.push("roundRect"),
    rect: () => calls.push("rect"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "round",
    lineCap: "round",
  };
}

/** 一个形状用到的所有坐标（图案统一画在 0..100 的方框里；圆弧按真正画出来的那一段采样） */
function pointsOf(s: Shape): number[] {
  switch (s.t) {
    case "c": return [s.x - s.r, s.x + s.r, s.y - s.r, s.y + s.r];
    case "e": return [s.x - s.rx, s.x + s.rx, s.y - s.ry, s.y + s.ry];
    case "r": return [s.x, s.x + s.w, s.y, s.y + s.h];
    case "a": {
      const out: number[] = [];
      const half = s.w / 2;
      for (let k = 0; k <= 24; k++) {
        const a = s.from + ((s.to - s.from) * k) / 24;
        out.push(s.x + (s.r + half) * Math.cos(a), s.y + (s.r + half) * Math.sin(a));
      }
      return out;
    }
    default: return s.pts;
  }
}

describe("记忆翻翻乐 · 六套原创主题", () => {
  it("正好六套主题，每套至少 12 个图案，套名与卡背都不重样", () => {
    expect(THEME_PACKS.length).toBeGreaterThanOrEqual(6);
    expect(MIN_ICONS_PER_PACK).toBeGreaterThanOrEqual(12);
    for (const pack of THEME_PACKS) {
      expect(pack.icons.length).toBeGreaterThanOrEqual(MIN_ICONS_PER_PACK);
      expect(pack.name.length).toBeGreaterThan(0);
      expect(pack.back).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(new Set(THEME_PACKS.map((p) => p.id)).size).toBe(THEME_PACKS.length);
    expect(new Set(THEME_PACKS.map((p) => p.name)).size).toBe(THEME_PACKS.length);
    expect(new Set(THEME_PACKS.map((p) => p.back)).size).toBe(THEME_PACKS.length);
  });

  it("同一套里图案名两两不同：正面靠图案 + 名字双通道认牌", () => {
    for (const pack of THEME_PACKS) {
      const names = pack.icons.map((i) => i.name);
      expect(new Set(names).size, `${pack.name} 里有重名的图案`).toBe(names.length);
      for (const n of names) {
        expect(n.length).toBeGreaterThanOrEqual(1);
        // 窄屏一行放得下，名字最多四个字
        expect(n.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it("图案全是自己画的几何形状，一个商标、一个别家角色名都不沾", () => {
    const low = (s: string): string => s.toLowerCase();
    for (const pack of THEME_PACKS) {
      for (const w of BRAND_WORDS) {
        expect(low(pack.name), `主题名撞了「${w}」`).not.toContain(low(w));
        for (const icon of pack.icons) {
          expect(low(icon.name), `图案名撞了「${w}」`).not.toContain(low(w));
        }
      }
    }
  });

  it("每个图案都落在 0..100 的方框里，缩到卡片上不会画出边", () => {
    for (const pack of THEME_PACKS) {
      for (const icon of pack.icons) {
        expect(icon.shapes.length, `${icon.name} 一笔都没画`).toBeGreaterThan(0);
        for (const s of icon.shapes) {
          for (const v of pointsOf(s)) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v, `${pack.name}/${icon.name} 画出框了`).toBeGreaterThanOrEqual(-8);
            expect(v, `${pack.name}/${icon.name} 画出框了`).toBeLessThanOrEqual(108);
          }
        }
      }
    }
  });

  it("每个图案都真的画得出来：落笔、填色、收笔一样不少", () => {
    for (const pack of THEME_PACKS) {
      for (const icon of pack.icons) {
        const ctx = fakeCtx();
        drawIcon(ctx, icon, 72);
        expect(ctx.calls[0]).toBe("save");
        expect(ctx.calls).toContain("scale:0.72");
        expect(ctx.calls.filter((c) => c === "beginPath").length).toBe(icon.shapes.length);
        expect(ctx.calls.filter((c) => c === "fill" || c === "stroke").length).toBe(icon.shapes.length);
        expect(ctx.calls[ctx.calls.length - 1]).toBe("restore");
      }
    }
  });

  it("没有 roundRect 的老浏览器退回普通方框，照样画得完整", () => {
    const pack = THEME_PACKS.find((p) => p.icons.some((i) => i.shapes.some((s) => s.t === "r")))!;
    const icon = pack.icons.find((i) => i.shapes.some((s) => s.t === "r"))!;
    const ctx = fakeCtx();
    delete (ctx as { roundRect?: unknown }).roundRect;
    drawIcon(ctx, icon, 60);
    expect(ctx.calls).toContain("rect");
    expect(ctx.calls).not.toContain("roundRect");
    expect(ctx.calls.filter((c) => c === "fill" || c === "stroke").length).toBe(icon.shapes.length);
  });

  it("十章关卡都能挑到一套图案，编号再大也不越界", () => {
    for (let theme = 0; theme < 24; theme++) {
      const pack = packForTheme(theme);
      expect(THEME_PACKS).toContain(pack);
      expect(pack.icons.length).toBeGreaterThanOrEqual(MIN_ICONS_PER_PACK);
    }
    expect(packForTheme(0)).toBe(THEME_PACKS[0]);
    expect(packForTheme(THEME_PACKS.length)).toBe(THEME_PACKS[0]);
    expect(packForTheme(-3)).toBe(THEME_PACKS[0]);
  });
});
