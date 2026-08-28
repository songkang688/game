/**
 * 44px 热区补账(trio-r9):收藏册两条 + S-4 扩容一条。
 *
 * 收藏册是孩子面:`.collection-close` 写死 40×40、`.card-btn`(解锁 ⭐N / 试穿)
 * `min-height:36px`,都低于 44px 红线;顺带把同面板里同样欠账的
 * `.collection-tab` 36px 与 `.collection-done` 42px 一并抬齐。
 * `.qz-jump-input` 38px 与 l99 的 `.l99-jump-input` 同族(S-4 已抬 44),这里补 quiz 族。
 *
 * 真机实测(Chrome 无头,六档视口):四类控件全部 ≥44,
 * `.collection-panel` 裁切修前修后都是 0,布局零回归。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const COLLECTION = readFileSync(new URL("./collection.ts", import.meta.url), "utf8");
const QUIZ99 = readFileSync(new URL("../games/quiz99.ts", import.meta.url), "utf8");
const LEVEL99 = readFileSync(new URL("../games/level99.ts", import.meta.url), "utf8");

/** 取一条内联 CSS 规则的声明串(这两个文件的样式都是压在一行里的模板字符串) */
function decls(css: string, selector: string): string {
  const at = css.indexOf(`${selector}{`);
  expect(at, `应有 ${selector} 规则`).toBeGreaterThanOrEqual(0);
  return css.slice(at + selector.length + 1, css.indexOf("}", at));
}

describe("收藏册热区 ≥44px", () => {
  it("关闭钮 40×40 → 44×44", () => {
    const d = decls(COLLECTION, ".collection-close");
    expect(d).toMatch(/width:44px/);
    expect(d).toMatch(/height:44px/);
    expect(d).not.toMatch(/width:40px|height:40px/);
  });

  it("卡片「解锁 ⭐N / 试穿」钮 36 → 44", () => {
    expect(decls(COLLECTION, ".card-btn")).toMatch(/min-height:44px/);
  });

  it("同面板里其余两类钮一并抬齐:页签 36 → 44、「知道啦」42 → 44", () => {
    expect(decls(COLLECTION, ".collection-tab")).toMatch(/min-height:44px/);
    expect(decls(COLLECTION, ".collection-done")).toMatch(/min-height:44px/);
  });

  it("取反:收藏册样式里不再有低于 44 的按钮高度", () => {
    for (const sel of [".collection-close", ".card-btn", ".collection-tab", ".collection-done"]) {
      const d = decls(COLLECTION, sel);
      for (const m of d.matchAll(/(?:min-)?height:(\d+)px/g)) {
        expect(Number(m[1]), `${sel} 的 ${m[0]}`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

describe("S-4 扩容:跳关输入框全族 44px", () => {
  it("quiz 族 .qz-jump-input 38 → 44", () => {
    expect(decls(QUIZ99, ".qz-jump-input ")).toMatch(/min-height: 44px/);
  });

  it("l99 的 .l99-jump-input 仍旧是 44(r6 已修,别被回滚)", () => {
    expect(decls(LEVEL99, ".l99-jump-input")).toMatch(/min-height:44px/);
  });
});
