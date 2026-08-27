/**
 * 果果叠叠乐 · 1.3 第 1 轮视觉验收（窗口 2 · 测试员）补充契约。
 *
 *  ① 专项②：每一级果卡主体都是「hi → 主色 → 边缘」≥ 3 停径向渐变,三色互不相同;
 *  ② 专项①：merge.ts 里的 emoji 字段只是无障碍/文案口径,paintFruit 的绘制序列里
 *     不许出现任何 fillText(emoji)——脸和纹理全是矢量;
 *  ③ 11 级的提亮色 hi 两两不同(遮住数字也认得出等级)。
 */
import { describe, expect, it } from "vitest";
import { FRUIT_STYLE, paintFruit } from "./art";
import { CHAIN, TOP_LEVEL } from "./merge";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

function recordCtx(): { g: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const fmt = (v: unknown): string => (typeof v === "number" ? v.toFixed(1) : String(v));
  const g = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        return (...args: unknown[]) => {
          calls.push(`${prop}(${args.map(fmt).join(",")})`);
          if (prop === "createRadialGradient" || prop === "createLinearGradient") {
            return { addColorStop: (o: number, c: string) => calls.push(`stop(${fmt(o)},${c})`) };
          }
          return undefined;
        };
      },
      set(_t, prop, v) {
        calls.push(`${String(prop)}=${fmt(v)}`);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("专项②:果身三停渐变", () => {
  it("11 级每级的主体渐变 ≥ 3 停,且 hi/主色/边缘三色互不相同", () => {
    for (let lvl = 0; lvl <= TOP_LEVEL; lvl++) {
      const { g, calls } = recordCtx();
      paintFruit(g, lvl, 30, "smile");
      const stops = calls.filter((c) => c.startsWith("stop("));
      expect(stops.length, `级 ${lvl} 渐变停数`).toBeGreaterThanOrEqual(3);
      const tri = new Set([FRUIT_STYLE[lvl].hi.toLowerCase(), CHAIN[lvl].color.toLowerCase(), CHAIN[lvl].edge.toLowerCase()]);
      expect(tri.size, `级 ${lvl} 提亮/主色/边缘要分得开`).toBe(3);
    }
  });
});

describe("专项①:果卡绘制零 emoji 直出", () => {
  it("11 级 × 两种脸的绘制序列里没有任何含 emoji 的 fillText", () => {
    for (let lvl = 0; lvl <= TOP_LEVEL; lvl++) {
      for (const face of ["smile", "worry"] as const) {
        const { g, calls } = recordCtx();
        paintFruit(g, lvl, 26, face);
        for (const c of calls) {
          if (!c.startsWith("fillText(")) continue;
          expect(EMOJI_RE.test(c), `级 ${lvl} ${face} 把 emoji 画上了果卡: ${c}`).toBe(false);
        }
      }
    }
  });

  it("微笑脸与担忧脸的绘制序列不同(状态双态真的画了两套)", () => {
    const a = recordCtx();
    paintFruit(a.g, 4, 26, "smile");
    const b = recordCtx();
    paintFruit(b.g, 4, 26, "worry");
    expect(a.calls.join(";")).not.toBe(b.calls.join(";"));
  });
});

describe("11 级提亮色互异", () => {
  it("FRUIT_STYLE.hi 两两不同且都是合法 #rrggbb", () => {
    const his = FRUIT_STYLE.map((s) => s.hi.toLowerCase());
    expect(his.length).toBe(TOP_LEVEL + 1);
    expect(new Set(his).size).toBe(his.length);
    for (const h of his) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });
});
