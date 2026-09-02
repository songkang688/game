/**
 * W8R1-06 · 奖励花花瓣渐变的钉子（窗口 8 第 1 轮监督修复员）。
 *
 * A 档报告：flowerSvg 花瓣单色平涂（缺「≥2 停渐变」项）。kit 件只读，
 * 修在消费端：shadeFlower 给花瓣挂 2 停径向渐变（瓣根深→瓣尖亮）。
 * 这里钉四件事：
 *   1. 装饰后：五片花瓣全部指向渐变、渐变确有 2 停且深浅方向正确；
 *   2. 花心、三点蕊、路径几何、帧标记一个字节不动；
 *   3. 三色 × 五帧全组合都装饰得上；上游改版找不到平涂 fill 时原样返回不画坏；
 *   4. tracing.ts 的两个调用点（花园横条 / 展开动画）都走了装饰。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BLOOM_FRAMES, FLOWER_TRIO, flowerSvg, PETAL_COUNT } from "../../art/kit/flower";
import { shade } from "../../art/kit/palette";
import { PETAL_ROOT_DARK, PETAL_TIP_LIGHT, shadeFlower } from "./flowerShade";

const OPTS = { cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[0], idPrefix: "t" };

describe("W8R1-06 · shadeFlower 花瓣渐变", () => {
  it("五片花瓣全部换成渐变引用，平涂 fill 一处不剩", () => {
    const out = shadeFlower(flowerSvg({ cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[0] }), OPTS);
    expect((out.match(/fill="url\(#t-petal\)"/g) ?? []).length).toBe(PETAL_COUNT);
    expect(out).not.toContain(`fill="${FLOWER_TRIO[0]}"`);
  });

  it("径向渐变 2 停：瓣根压深、瓣尖提亮，花心系 userSpaceOnUse", () => {
    const out = shadeFlower(flowerSvg({ cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[0] }), OPTS);
    expect(out).toContain('gradientUnits="userSpaceOnUse"');
    expect(out).toContain('cx="12" cy="12" r="10"');
    expect(out).toContain(`stop-color="${shade(FLOWER_TRIO[0], PETAL_ROOT_DARK)}"`);
    expect(out).toContain(`stop-color="${shade(FLOWER_TRIO[0], PETAL_TIP_LIGHT)}"`);
    expect((out.match(/<stop /g) ?? []).length).toBe(2);
    expect(PETAL_ROOT_DARK).toBeLessThan(0);
    expect(PETAL_TIP_LIGHT).toBeGreaterThan(0);
  });

  it("花心、三点蕊与路径几何一个字节不动，帧标记保留", () => {
    for (const frame of BLOOM_FRAMES.keys()) {
      const raw = flowerSvg({ cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[1], frame });
      const out = shadeFlower(raw, { ...OPTS, petal: FLOWER_TRIO[1] });
      // 除了 defs 与 fill 替换，其余（路径 d、花心、蕊）原样
      const rawRest = raw.split(`fill="${FLOWER_TRIO[1]}"`).join("|");
      const outRest = out
        .replace(/<defs>.*<\/defs>/, "")
        .split('fill="url(#t-petal)"')
        .join("|");
      expect(outRest).toBe(rawRest);
      expect(out).toContain(`data-frame="${frame}"`);
      expect(out).toContain('fill="#ffd93d"');
      expect((out.match(/fill="#e8590c"/g) ?? []).length).toBe(3);
    }
  });

  it("三色 × 五帧全组合装饰得上；找不到平涂 fill 原样返回", () => {
    for (const petal of FLOWER_TRIO) {
      for (const frame of BLOOM_FRAMES.keys()) {
        const out = shadeFlower(flowerSvg({ cx: 50, cy: 24, r: 13, petal, frame }), {
          cx: 50, cy: 24, r: 13, petal, idPrefix: "x",
        });
        expect(out).toContain("radialGradient");
      }
    }
    expect(shadeFlower("<g><path fill=\"#123456\"/></g>", OPTS)).toBe("<g><path fill=\"#123456\"/></g>");
  });

  it("tracing.ts 两个调用点（花园横条 / 展开动画帧）都走 shadeFlower", () => {
    const src = readFileSync(fileURLToPath(new URL("./tracing.ts", import.meta.url)), "utf8");
    const calls = (src.match(/shadeFlower\(flowerSvg\(/g) ?? []).length;
    expect(calls).toBe(2);
    // 裸的 flowerSvg 直出不许再有（import 行除外）
    const bare = src
      .split("\n")
      .filter((line) => line.includes("flowerSvg(") && !line.includes("shadeFlower(") && !line.includes("import"));
    expect(bare).toEqual([]);
  });
});
