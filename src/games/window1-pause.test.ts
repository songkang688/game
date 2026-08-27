/**
 * 窗口 1 那 12 款的「Esc 只弹一层暂停」契约巡检。
 *
 * 为什么要有这一份：`src/ui/gameShell.ts` 自己也在 window 上听 Esc，
 * 收到**没被接住**的 Esc 就会弹一层它自己的暂停面板：
 *
 * ```ts
 * function onGlobalKeyDown(e: KeyboardEvent): void {
 *   if (disposed || !isDismissKey(e.key)) return;
 *   if (dialog || pauseDialog) return;
 *   window.setTimeout(() => {
 *     if (disposed || dialog || pauseDialog || e.defaultPrevented) return;  // ← 就看这一句
 *     openPause();
 *   }, 0);
 * }
 * ```
 *
 * 所以凡是自己接管了 Esc 的游戏，**必须** `e.preventDefault()`，否则两层暂停各记各的状态，
 * 真机上会走成：第 1 下两层一起停 → 第 2 下面板被弹窗吃掉、游戏还停着（屏幕上什么都没有但盘不动）
 * → 第 3 下面板又弹出来、游戏却恢复了（面板挡着屏，游戏在后面跑）。第 1 轮走查在
 * `orb-arena` / `snake-royale` / `block-drop` / `combo-clash` / `merge-2048` 五款上原样复现了这条。
 *
 * 1.1 的 `gold-hook` 早就把这条写在注释里了，这里把它变成一条跑得起来的红线，
 * 免得以后新加的模式又漏一次。巡检**只覆盖本窗口那 12 款**，不越界看别的窗口的目录。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 窗口 1 的 12 款 */
const WINDOW1_IDS = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
  "merge-2048",
  "mine-garden",
  "sudoku-petal"
] as const;

const sourceOf = (id: string): string =>
  readFileSync(new URL(`./${id}/index.ts`, import.meta.url), "utf8");

/**
 * 把 `index.ts` 里每一段「接住 Esc 之后到 return 为止」的代码切出来。
 *
 * 两种写法都要认：
 *   - 直接比 `e.key === "Escape"` / `k === "Escape"`；
 *   - 先过一层 `keyAction(e.key)` 映射成 `"pause"` 再判断。
 *
 * 切片是从**这次按键进处理函数的地方**起算，不是从 `if` 那一行起算：
 * `weiqi-garden` / `mine-garden` 是在 `keyAction(...)` 拿到动作之后、分支之前就统一
 * `e.preventDefault()` 了一次，这同样满足契约，按 `if` 行切会误判成漏。
 */
function escBranches(src: string): string[] {
  const out: string[] = [];
  const heads = [/if \(\s*(?:e\.key|k|key)\s*===\s*"Escape"\s*\)\s*\{/g, /if \(\s*act === "pause"\s*\)\s*\{/g];
  for (const re of heads) {
    for (const m of src.matchAll(re)) {
      const head = m.index ?? 0;
      // 往回找到本次按键的入口（`keyAction(` 那一句），拿不到就退回 `if` 那一行
      const mapped = src.lastIndexOf("keyAction(", head);
      const from = mapped >= 0 && head - mapped < 400 ? mapped : head;
      // 到本段第一个 return 为止就够了：preventDefault 必须在这之前调用
      const end = src.indexOf("return;", head);
      out.push(src.slice(from, end < 0 ? head + 400 : end + 7));
    }
  }
  return out;
}

describe("窗口 1 · Esc 只弹一层暂停", () => {
  it("12 款的源码都读得到", () => {
    for (const id of WINDOW1_IDS) expect(sourceOf(id).length, id).toBeGreaterThan(1000);
  });

  it("每一款都确实自己接管了 Esc（不是压根没做暂停）", () => {
    for (const id of WINDOW1_IDS) {
      expect(escBranches(sourceOf(id)).length, `${id} 没有任何 Esc 分支`).toBeGreaterThan(0);
    }
  });

  it("每一段 Esc 分支都调了 preventDefault，外壳不会再叠一层面板", () => {
    const missing: string[] = [];
    for (const id of WINDOW1_IDS) {
      for (const branch of escBranches(sourceOf(id))) {
        if (!branch.includes("preventDefault")) missing.push(id);
      }
    }
    expect(missing, `这些款的 Esc 分支漏了 e.preventDefault(): ${missing.join(", ")}`).toEqual([]);
  });

  it("第 1 轮踩过坑的那五款，逐款点名钉死", () => {
    for (const id of ["orb-arena", "snake-royale", "block-drop", "combo-clash", "merge-2048"]) {
      const branches = escBranches(sourceOf(id));
      expect(branches.length, id).toBeGreaterThan(0);
      for (const b of branches) expect(b, id).toContain("e.preventDefault()");
    }
  });

  it("暂停文案都告诉孩子怎么接着玩", () => {
    for (const id of WINDOW1_IDS) {
      const src = sourceOf(id);
      expect(/暂停|先歇一会儿/.test(src), `${id} 连暂停字样都没有`).toBe(true);
    }
  });

  it("暂停相关文案里没有商标，也没有低幼词", () => {
    for (const id of WINDOW1_IDS) {
      const src = sourceOf(id);
      const lines = src.split("\n").filter((l) => /暂停|先歇一会儿/.test(l));
      for (const l of lines) {
        expect(l, `${id}: ${l.trim()}`).not.toMatch(/俄罗斯方块|Tetris|三国杀|大富翁|斗地主|吃豆人/i);
        expect(l, `${id}: ${l.trim()}`).not.toMatch(/宝宝|乖乖|棒棒哒/);
      }
    }
  });
});
