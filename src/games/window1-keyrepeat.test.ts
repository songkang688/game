/**
 * 窗口 1 那 12 款的「按住不放不许连发一次性动作」契约巡检。
 *
 * 按住一个键不放，系统会一秒补发三十来个 `keydown`（`e.repeat === true`）。
 * 挪左挪右、软降、光标移动本来就该跟着连发；但**一下算一下**的动作不行：
 *
 *   - `block-drop` 的硬降：第 2 轮真机取证是「一次真按 ＋ 19 下连发」之后
 *     分数从 0 跳到 258、下一块队列走掉 4 个 —— 一关只有 26 块预算，
 *     手指多停半秒就白掉四分之一；
 *   - `orb-arena` 的分裂：`MAX_CELLS` 是 16，按住不放会当场炸成一堆碎片，
 *     等 18–30 秒的合体冷却谁也来不及。
 *
 * 这一份把「哪些键放行连发」钉成红线，免得以后加模式时又漏一处。
 * 只覆盖**接管了一次性动作键**的那两款，其余十款要么是回合制（有状态闸），
 * 要么用的是 `Set.add` / `Set.delete` 这种幂等写法（`snake-royale` 的加速与刹车），
 * 连发本来就不造成伤害，不在这条红线里。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acceptsRepeat as blockDropAcceptsRepeat } from "./block-drop/index";
import { acceptsRepeat as orbArenaAcceptsRepeat } from "./orb-arena/index";

const GUARDED = [
  {
    id: "block-drop",
    fn: blockDropAcceptsRepeat,
    repeatable: ["a", "d", "s", "ArrowLeft", "ArrowRight", "ArrowDown"],
    oneShot: ["w", "f", "g", "Shift", "l", "k", "Enter", "ArrowUp"]
  },
  {
    id: "orb-arena",
    fn: orbArenaAcceptsRepeat,
    repeatable: ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
    oneShot: ["f", "g", "l", "k", "Enter", " "]
  }
] as const;

const sourceOf = (id: string): string => readFileSync(new URL(`./${id}/index.ts`, import.meta.url), "utf8");

describe("窗口 1 · 按住不放不连发一次性动作", () => {
  it("该连发的键一个不少", () => {
    for (const g of GUARDED) {
      for (const k of g.repeatable) expect(g.fn(k), `${g.id} 的 ${k} 应当跟着连发`).toBe(true);
    }
  });

  it("一次性动作键一个都不放行", () => {
    for (const g of GUARDED) {
      for (const k of g.oneShot) expect(g.fn(k), `${g.id} 的 ${k} 不该跟着连发`).toBe(false);
    }
  });

  it("字母键大小写都认得（真机上按住 Shift 时 key 会变大写）", () => {
    for (const g of GUARDED) {
      const letters = [...g.repeatable, ...g.oneShot].filter((k) => k.length === 1);
      for (const k of letters) expect(g.fn(k.toUpperCase()), `${g.id} ${k}`).toBe(g.fn(k));
      // 长名字的键（ArrowLeft 之类）按原样比，不做大小写折叠 —— 处理函数里也是这么归一的
      expect(g.fn("ARROWLEFT"), g.id).toBe(false);
    }
  });

  it("认不出来的键一律当一次性动作（宁可少响应，不许连发）", () => {
    for (const g of GUARDED) {
      for (const k of ["Escape", "Tab", "F5", "Home", "PageDown", ""]) expect(g.fn(k), `${g.id} ${k}`).toBe(false);
    }
  });

  it("keydown 处理函数里真的接了这道闸，不只是导出了一个没人用的函数", () => {
    for (const g of GUARDED) {
      const src = sourceOf(g.id);
      expect(src, `${g.id} 的 keydown 里没有 e.repeat 这道闸`).toContain("if (e.repeat && !acceptsRepeat(e.key))");
    }
  });

  it("被拦下来的那一下要 preventDefault，别漏给游戏壳", () => {
    for (const g of GUARDED) {
      const src = sourceOf(g.id);
      const at = src.indexOf("if (e.repeat && !acceptsRepeat(e.key))");
      expect(src.slice(at, at + 120), g.id).toContain("e.preventDefault()");
    }
  });
});
