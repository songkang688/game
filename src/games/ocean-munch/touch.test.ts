// R2C-O1：360px 上的手指口径。
//
// 这一款是纯画布，热区就是 `inRect` 拿去比的那个矩形，所以这里查两件事：
//   ① `touchArea()` 本身把矩形撑到 44px 见方，而且不会把手指够不着的那一截算进来；
//   ② `index.ts` 里所有 `btnXxx = { … }` 的字面量热区都已经 ≥ 44px，
//      剩下那 6 颗导航小按钮（两处图鉴、四处返回）确实走了 `touchArea()`。
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

  it("本来就够大的矩形一个数都不改（玩法卡、结算按钮都别被顺手改宽）", () => {
    expect(touchArea({ x: 20, y: 120, w: 320, h: 44 })).toEqual({ x: 20, y: 120, w: 320, h: 44 });
    expect(touchArea({ x: 40, y: 300, w: 132, h: 46 })).toEqual({ x: 40, y: 300, w: 132, h: 46 });
  });

  it("只矮不窄的导航按钮只往上下扩，宽度原样留着", () => {
    expect(touchArea({ x: 8, y: 8, w: 76, h: 36 })).toEqual({ x: 8, y: 4, w: 76, h: 44 });
    expect(touchArea({ x: 12, y: 12, w: 80, h: 34 })).toEqual({ x: 12, y: 7, w: 80, h: 44 });
  });

  it("扩的时候以原来那颗为中心，不会整颗往下溜", () => {
    const face = { x: 240, y: 8, w: 112, h: 34 };
    const r = touchArea(face);
    expect(r.x + r.w / 2).toBeCloseTo(face.x + face.w / 2, 6);
    expect(r.y + r.h / 2).toBeCloseTo(face.y + face.h / 2, 6);
  });

  it("贴着画布上沿的按钮推回 0，44px 是**真的**都落在画布里", () => {
    const r = touchArea({ x: 6, y: 7, w: 62, h: 30 });
    expect(r.y).toBe(0);
    expect(r.y + r.h).toBe(44);
  });

  it("扩过的矩形再扩一次还是它自己（幂等）", () => {
    const once = touchArea({ x: 6, y: 7, w: 62, h: 30 });
    expect(touchArea(once)).toEqual(once);
  });

  it("只读不改：传进去的那个对象一个字段都没被动过", () => {
    const src = { x: 8, y: 8, w: 74, h: 30 };
    touchArea(src);
    expect(src).toEqual({ x: 8, y: 8, w: 74, h: 30 });
  });
});

describe("R2C-O1 · index.ts 里每一个热区矩形", () => {
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

  it("两处图鉴入口与四处返回键都过了一道 touchArea", () => {
    expect((indexSrc.match(/btnDex = touchArea\(dexFace\)/g) ?? []).length).toBe(2);
    expect((indexSrc.match(/btnBack = touchArea\(backFace\)/g) ?? []).length).toBe(4);
  });

  it("存档键没被顺手动过（点名项④的红线）", () => {
    expect(indexSrc).toContain("save.recordEndlessBest(meta.id, scoreDepth)");
  });

  it("兜底这一层是纯算术，不碰渲染也不碰输入", () => {
    expect(readFileSync(`${dir}touch.ts`, "utf8")).not.toMatch(/^import /m);
  });
});
