// R2C-R1：360px 上的手指口径。
//
// 这一款是纯画布，热区就是 `inRect` 拿去比的那个矩形，所以这里查两件事：
//   ① `touchArea()` 本身把矩形撑到 44px 见方，而且不会把手指够不着的那一截算进来；
//   ② `index.ts` 里所有 `btnXxx = { … }` 的字面量热区都已经 ≥ 44px，
//      剩下那几颗画得小的（收藏册、两处返回）确实走了 `touchArea()`。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIN_HIT_PX, touchArea } from "./touch";

const dir = fileURLToPath(new URL(".", import.meta.url));
const indexSrc = readFileSync(`${dir}index.ts`, "utf8");

describe("touchArea · 热区兜底", () => {
  it("热区下限就是无障碍要的 44px", () => {
    expect(MIN_HIT_PX).toBe(44);
  });

  it("本来就够大的矩形一个数都不改", () => {
    expect(touchArea({ x: 40, y: 60, w: 132, h: 44 })).toEqual({ x: 40, y: 60, w: 132, h: 44 });
    expect(touchArea({ x: 10, y: 10, w: 274, h: 60 })).toEqual({ x: 10, y: 10, w: 274, h: 60 });
  });

  it("两个方向都不够的小按钮撑成 44×44，而且是以原来那颗为中心撑的", () => {
    // 收藏册：360 宽下画在 (314, 8) 的 38×34
    const r = touchArea({ x: 314, y: 8, w: 38, h: 34 });
    expect(r).toEqual({ x: 311, y: 3, w: 44, h: 44 });
    expect(r.x + r.w / 2).toBeCloseTo(314 + 38 / 2, 6);
    expect(r.y + r.h / 2).toBeCloseTo(8 + 34 / 2, 6);
  });

  it("只矮不窄的按钮只往上下扩，宽度原样留着", () => {
    expect(touchArea({ x: 6, y: 7, w: 62, h: 30 })).toEqual({ x: 6, y: 0, w: 62, h: 44 });
  });

  it("贴着画布上沿的按钮推回 0，44px 是**真的**都落在画布里", () => {
    // 局内的「◀ 回家」画在 y=6、高 28，居中扩会跑到 y=-2，画布外那 2px 手指够不着
    const r = touchArea({ x: 6, y: 6, w: 62, h: 28 });
    expect(r.y).toBe(0);
    expect(r.y + r.h).toBe(44);
  });

  it("扩过的矩形再扩一次还是它自己（幂等）", () => {
    const once = touchArea({ x: 314, y: 8, w: 38, h: 34 });
    expect(touchArea(once)).toEqual(once);
  });

  it("只读不改：传进去的那个对象一个字段都没被动过", () => {
    const src = { x: 6, y: 6, w: 62, h: 28 };
    touchArea(src);
    expect(src).toEqual({ x: 6, y: 6, w: 62, h: 28 });
  });
});

describe("R2C-R1 · index.ts 里每一个热区矩形", () => {
  /** 抓出所有 `btnXxx = { x: …, y: …, w: …, h: … }` 的直接赋值（声明时的占位不算） */
  function rectLiterals(): Array<{ name: string; w: string; h: string }> {
    const re = /^\s+(btn[A-Za-z]*) = \{[^}]*?w:\s*([^,]+),\s*h:\s*([^,}]+)/gm;
    const out: Array<{ name: string; w: string; h: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(indexSrc)) !== null) out.push({ name: m[1], w: m[2].trim(), h: m[3].trim() });
    return out;
  }

  it("抓得到东西（正则失效了要当场发现，别静悄悄全绿）", () => {
    expect(rectLiterals().length).toBeGreaterThanOrEqual(6);
  });

  it("写死数字的那些边，一条都不低于 44px", () => {
    for (const r of rectLiterals()) {
      if (/^\d+(\.\d+)?$/.test(r.h)) {
        expect(Number(r.h), `${r.name} 的高只有 ${r.h}px`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      }
      if (/^\d+(\.\d+)?$/.test(r.w)) {
        expect(Number(r.w), `${r.name} 的宽只有 ${r.w}px`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      }
    }
  });

  it("无尽入口那条按钮自己就有 44px 高，不靠兜底", () => {
    expect(indexSrc).toContain("btnEndless = { x: ex, y: 68, w: w - ex * 2, h: 44 }");
  });

  it("画得小的三颗（收藏册 / 选关屏返回 / 局内返回）都过了一道 touchArea", () => {
    expect(indexSrc).toContain("btnCollection = touchArea(face)");
    expect((indexSrc.match(/btnBack = touchArea\(backFace\)/g) ?? []).length).toBe(2);
  });

  it("兜底这一层是纯算术，不碰渲染也不碰输入", () => {
    expect(readFileSync(`${dir}touch.ts`, "utf8")).not.toMatch(/^import /m);
  });
});
