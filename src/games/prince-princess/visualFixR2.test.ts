/**
 * prince-princess · 1.3 窗口 5 第 2 轮监督修复员 · 修复配套用例。
 *
 * N2(见 docs/qa/1.3-window5-round2-tester.md):门锁 emoji 字形 24×scale px →
 * `drawPadlockBadge` 自绘挂锁(圆环锁弓 + 金 2 停圆角锁体 + 锁孔),开 / 合两态锁弓不同位。
 * G4/L-1 + N4(画布部分):emoji() 画布字形助手整体退休 —— 状态小 icon
 * (盾 / 羽毛 / 木箱 / 翅 / 风)、克制与 BOSS 弱点小剑、掉队指路王冠 / 蝶结、
 * 敌人退场星光与 12 种事件飘图全部换成 visual13 矢量小徽章。
 * 修后把 R2 测试员的水位闸再拧紧(锁字形 1 → 0,emoji() 调用点 11 → 0,
 * emoji 码点 59 → 38,画布 fillText 4 → 3 只剩功能文字),只降不升。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import {
  EVENT_BADGE_KINDS,
  drawCrateBadge,
  drawEventBadge,
  drawFeatherBadge,
  drawGustBadge,
  drawPadlockBadge,
  drawRoyalBadge,
  drawShieldBadge,
  drawSwordBadge,
  drawWingBadge,
} from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

describe("prince-princess · 修复员 R2 · N2 门锁自绘挂锁", () => {
  it("挂锁开 / 合两态都画得动不抛,极小尺寸与非法尺寸不炸", () => {
    for (const open of [true, false]) {
      expect(() => drawPadlockBadge(ctx2d(new FakeCtx()), 40, 30, 7, open)).not.toThrow();
      expect(() => drawPadlockBadge(ctx2d(new FakeCtx()), 4, 4, 1.5, open)).not.toThrow();
      expect(() => drawPadlockBadge(ctx2d(new FakeCtx()), 4, 4, 0, open)).not.toThrow();
    }
  });

  it("开锁与上锁的锁弓弧不同位(一眼分开 / 合)", () => {
    const arcsOf = (open: boolean): string => {
      const c = new FakeCtx();
      drawPadlockBadge(ctx2d(c), 40, 30, 7, open);
      return JSON.stringify(c.ops.filter((o) => o.op === "arc"));
    };
    expect(arcsOf(true)).not.toBe(arcsOf(false));
  });

  it("index.ts 门锁已换 drawPadlockBadge,锁 emoji 字形退场(闸收紧:1 → 0)", () => {
    const src = read("index.ts");
    expect(src).toContain("drawPadlockBadge(");
    expect((src.match(/🔒/g) ?? []).length).toBe(0);
  });
});

describe("prince-princess · 修复员 R2 · G4/L-1 + N4 画布 emoji 全量矢量化", () => {
  it("七支小徽章画笔都画得动不抛,极小尺寸与非法尺寸不炸", () => {
    const draws: Array<(c: CanvasRenderingContext2D, x: number, y: number, s: number) => void> = [
      drawSwordBadge,
      drawShieldBadge,
      drawWingBadge,
      drawGustBadge,
      drawFeatherBadge,
      drawCrateBadge,
      (c, x, y, s) => drawRoyalBadge(c, x, y, s, "prince"),
      (c, x, y, s) => drawRoyalBadge(c, x, y, s, "princess"),
    ];
    for (const fn of draws) {
      expect(() => fn(ctx2d(new FakeCtx()), 40, 30, 8)).not.toThrow();
      expect(() => fn(ctx2d(new FakeCtx()), 4, 4, 1.2)).not.toThrow();
      expect(() => fn(ctx2d(new FakeCtx()), 4, 4, 0)).not.toThrow();
      expect(() => fn(ctx2d(new FakeCtx()), Number.NaN, 4, 8)).not.toThrow();
    }
  });

  it("指路徽章王子(金三齿冠)与公主(粉蝶结)剪影不同位,一眼分人", () => {
    const opsOf = (kind: "prince" | "princess"): string => {
      const c = new FakeCtx();
      drawRoyalBadge(ctx2d(c), 40, 30, 9, kind);
      return JSON.stringify(c.ops);
    };
    expect(opsOf("prince")).not.toBe(opsOf("princess"));
  });

  it("12 种事件飘图逐个画得动、形状互不相同(op 流两两不同)", () => {
    expect(EVENT_BADGE_KINDS.length).toBe(12);
    const streams = new Set<string>();
    for (const kind of EVENT_BADGE_KINDS) {
      const c = new FakeCtx();
      expect(() => drawEventBadge(ctx2d(c), kind, 40, 30, 9), kind).not.toThrow();
      expect(c.ops.length, kind).toBeGreaterThan(0);
      streams.add(JSON.stringify(c.ops));
      expect(() => drawEventBadge(ctx2d(new FakeCtx()), kind, 4, 4, 0), kind).not.toThrow();
    }
    expect(streams.size).toBe(EVENT_BADGE_KINDS.length);
  });

  it("index.ts:emoji() 画布字形助手退休,十处调用点全部换矢量徽章(闸收紧:11 → 0)", () => {
    const src = read("index.ts");
    expect((src.match(/emoji\((g|ctx),/g) ?? []).length).toBe(0);
    for (const fn of [
      "drawShieldBadge(",
      "drawFeatherBadge(",
      "drawCrateBadge(",
      "drawWingBadge(",
      "drawGustBadge(",
      "drawRoyalBadge(",
      "drawEventBadge(",
    ]) {
      expect(src).toContain(fn);
    }
    expect((src.match(/drawSwordBadge\(g,/g) ?? []).length).toBe(2);
  });

  it("水位闸收紧:绘制文件 emoji 码点 59 → 38、画布 fillText 4 → 3(剩余全为功能文字)", () => {
    const drawSrc = ["index.ts", "visual13.ts"].map(read).join("\n");
    expect((drawSrc.match(/\p{Extended_Pictographic}/gu) ?? []).length).toBeLessThanOrEqual(38);
    expect((drawSrc.match(/fillText\(/g) ?? []).length).toBeLessThanOrEqual(3);
  });
});

describe("prince-princess · 修复员 R2 · C-1 光照方向归位(B 档一致性点名)", () => {
  it("visual13 的线性体渐变全部拉斜到左上 45°:不再有『两端同 x』的纵向渐变", () => {
    const vis = read("visual13.ts");
    // B 档点名的三处(小怪体 / 铠甲盾 / BOSS 大王冠)+ 本轮新增徽章,一个不许竖回去
    expect(vis).toContain("createLinearGradient(cx - w * 0.18, top, cx + w * 0.18, bottom)");
    expect(vis).toContain("createLinearGradient(sx - sw * 0.18, cy - sh * 0.6, sx + sw * 0.18, cy + sh * 0.6)");
    expect(vis).toContain("createLinearGradient(bx - cw * 0.18, baseY - ch * 1.15, bx + cw * 0.18, baseY)");
    // 通用防线:createLinearGradient(A, y1, A, y2) 形式(首尾 x 完全相同的字面量)清零
    const vertical = vis.match(/createLinearGradient\(\s*([^,]+),[^,]+,\s*\1,/g) ?? [];
    expect(vertical.length).toBe(0);
  });
});
