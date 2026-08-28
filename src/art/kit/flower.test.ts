/**
 * 共享美术套件 · 五瓣花单测（窗口8 A 档 · word-garden 独占文件）。
 *
 * 钉死的是规格数字：五帧瓣长 0.2/0.45/0.7/0.9/1.0、五瓣每瓣 72°、
 * 三色映射与相邻不撞色 —— 这些一变，写字开花的动画就不是规格里那一套了。
 */
import { describe, expect, it } from "vitest";
import {
  BLOOM_FRAMES,
  FLOWER_CORE,
  FLOWER_TRIO,
  flowerSvg,
  flowerTier,
  petalPath,
  PETAL_COUNT,
  pickFlowerColorIndex,
} from "./flower";

describe("art-kit · 五瓣花", () => {
  it("五帧展开的瓣长序列钉死为 0.2/0.45/0.7/0.9/1.0", () => {
    expect([...BLOOM_FRAMES]).toEqual([0.2, 0.45, 0.7, 0.9, 1]);
    expect(PETAL_COUNT).toBe(5);
  });

  it("逐帧字符串互不相同：五帧就是五张不同的画", () => {
    const frames = BLOOM_FRAMES.map((_, i) =>
      flowerSvg({ cx: 50, cy: 30, r: 12, petal: FLOWER_TRIO[0], frame: i })
    );
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        expect(frames[i], `第 ${i} 帧和第 ${j} 帧画重了`).not.toBe(frames[j]);
      }
    }
  });

  it("每帧都是五片花瓣 + 一个花心 + 三点蕊", () => {
    const svg = flowerSvg({ cx: 10, cy: 10, r: 8, petal: "#ffb3c1", frame: 2 });
    expect(svg.match(/<path /g)).toHaveLength(5);
    expect(svg.match(/<circle /g)).toHaveLength(4);
    expect(svg).toContain(`fill="${FLOWER_CORE}"`);
    expect(svg).toContain('data-frame="2"');
    expect(svg.startsWith("<g class=\"kit-flower")).toBe(true);
  });

  it("不传帧号直接全开；帧号越界钳回 0-4", () => {
    const full = flowerSvg({ cx: 10, cy: 10, r: 8, petal: "#ffe066" });
    expect(full).toContain('data-frame="4"');
    expect(flowerSvg({ cx: 10, cy: 10, r: 8, petal: "#ffe066", frame: 99 })).toContain('data-frame="4"');
    expect(flowerSvg({ cx: 10, cy: 10, r: 8, petal: "#ffe066", frame: -3 })).toContain('data-frame="0"');
  });

  it("花瓣路径随角度旋转：五个 72° 方向的路径互不相同且都闭合", () => {
    const paths = Array.from({ length: 5 }, (_, i) => petalPath(50, 50, 10, -90 + i * 72, 1));
    expect(new Set(paths).size).toBe(5);
    for (const p of paths) {
      expect(p.startsWith("M 50.00 50.00")).toBe(true);
      expect(p.endsWith("Z")).toBe(true);
    }
    // 朝上的那瓣（-90°）瓣尖在花心正上方 r 处
    expect(paths[0]).toContain("50.00 40.00");
  });

  it("难度三色映射：笔画 ≤2 粉、3-4 黄、≥5 紫", () => {
    expect(FLOWER_TRIO).toHaveLength(3);
    expect(flowerTier(1)).toBe(0);
    expect(flowerTier(2)).toBe(0);
    expect(flowerTier(3)).toBe(1);
    expect(flowerTier(4)).toBe(1);
    expect(flowerTier(5)).toBe(2);
    expect(flowerTier(6)).toBe(2);
  });

  it("同局相邻两朵不撞色：档位色跟上一朵一样时顺移一位", () => {
    expect(pickFlowerColorIndex(0, -1)).toBe(0);
    expect(pickFlowerColorIndex(0, 0)).toBe(1);
    expect(pickFlowerColorIndex(1, 1)).toBe(2);
    expect(pickFlowerColorIndex(2, 2)).toBe(0);
    expect(pickFlowerColorIndex(2, 1)).toBe(2);
  });
});
