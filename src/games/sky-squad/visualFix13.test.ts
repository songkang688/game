/**
 * sky-squad · 1.3 窗口 5 第 1 轮监督修复员 · 修复配套用例。
 *
 * S7:拾取物从「平涂白圆 + emoji 字形」升级为 kit 三停渐变专属色圈 + 矢量符号
 *     (星 / 护盾泡 / 圆炸弹 / 小僚机 / 循环箭头 / 气球 / 菱晶),七类各一个底色圈。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeCtx } from "./domStub";
import { BOSSES } from "./levels";
import { PICKUP_BADGE, bossBadgeArt, pickupArt, segExtent, tracePath, type PickupArtKind } from "./art";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");

const KINDS: PickupArtKind[] = ["power", "shield", "bomb", "wing", "weapon", "homing", "pierce"];

describe("sky-squad · 修复员 S7 · 拾取物矢量化", () => {
  it("七类拾取物都有矢量件,且坐标全部夹在 ±r 之内(不越出圆底)", () => {
    for (const kind of KINDS) {
      const parts = pickupArt(kind, 8.5);
      expect(parts.length, kind).toBeGreaterThanOrEqual(2);
      for (const part of parts) expect(segExtent(part.segs), kind).toBeLessThanOrEqual(8.5 + 1e-6);
    }
  });

  it("七类底色圈与符号主色都是合法色值,且色圈互不重复(弹雨双通道识别)", () => {
    const rings = new Set<string>();
    for (const kind of KINDS) {
      const badge = PICKUP_BADGE[kind];
      expect(badge.ring).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(badge.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      rings.add(badge.ring);
    }
    expect(rings.size).toBe(KINDS.length);
  });

  it("矢量件放到画笔上画得动不抛(tracePath 全类冒烟)", () => {
    const g = new FakeCtx() as unknown as CanvasRenderingContext2D;
    for (const kind of KINDS) {
      for (const part of pickupArt(kind, 8.5)) {
        expect(() => tracePath(g, part.segs), kind).not.toThrow();
      }
    }
  });

  it("index.ts 拾取物不再走 emoji 字形,改走 ballGradient + pickupArt", () => {
    const src = read("index.ts");
    expect(src).not.toMatch(/fillText\(PICKUP_INFO/);
    expect(src).toContain("pickupArt(");
    expect(src).toContain("ballGradient(ctx, 0, 0, 15");
  });
});

describe("sky-squad · 修复员 G1 · Boss 肚皮徽章矢量化", () => {
  it("八位章 Boss 的徽章符号都有矢量件,坐标夹在 ±r,认不出的 id 兜底星形", () => {
    for (const boss of BOSSES) {
      const parts = bossBadgeArt(boss.id, 9);
      expect(parts.length, boss.id).toBeGreaterThanOrEqual(2);
      for (const part of parts) expect(segExtent(part.segs), boss.id).toBeLessThanOrEqual(9 + 1e-6);
    }
    expect(bossBadgeArt("unknown-boss", 9).length).toBeGreaterThanOrEqual(1);
  });

  it("徽章符号放到画笔上画得动不抛(全 Boss 冒烟)", () => {
    const g = new FakeCtx() as unknown as CanvasRenderingContext2D;
    for (const boss of BOSSES) {
      for (const part of bossBadgeArt(boss.id, 9)) {
        expect(() => tracePath(g, part.segs), boss.id).not.toThrow();
      }
    }
  });

  it("index.ts 的 Boss 肚皮不再 fillText emoji 字形,改走 bossBadgeArt", () => {
    const src = read("index.ts");
    expect(src).not.toMatch(/fillText\(b\.spec\.emoji/);
    expect(src).toContain("bossBadgeArt(");
  });
});
