/**
 * 窗口 1 · 12 款新游戏与游戏壳的 Esc 契约。
 *
 * `src/ui/gameShell.ts` 的 `onGlobalKeyDown` 也挂在 window 上,推迟一个宏任务之后
 * 看 `e.defaultPrevented`:**游戏自己接住了 Esc 就必须 `preventDefault()`**,
 * 否则壳层会再弹一次统一暂停面板。两边各暂停一次的后果是 360×640 上实测到的这样:
 *
 *   第 1 下 Esc:游戏暂停 + 壳弹出暂停面板;
 *   第 2 下 Esc:被面板在捕获阶段吃掉,只关面板 —— 游戏还停着,画面上却没有任何面板;
 *   第 3 下 Esc:游戏才继续,同时面板又弹了出来。
 *
 * 孩子按两下 Esc 看到棋盘不动、又找不到暂停面板,只会以为游戏卡死了。
 * 这份用例照着源码钉住这条契约:凡是在 `index.ts` 里认 `Escape` 的,
 * 同一段分支里必须能找到 `preventDefault`。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WINDOW1_GAMES = [
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

function sourceOf(id: string): string {
  return readFileSync(new URL(`../${id}/index.ts`, import.meta.url), "utf8");
}

/**
 * 取出每一处「认 Escape 并当场处理」的 `if {...}` 块,**只到配对的那个右花括号为止**。
 *
 * 范围必须卡准:同一个 keydown 处理函数下面往往还有一句管方向键的 `preventDefault()`,
 * 窗口开大一点就会把它误当成 Esc 分支自己调的,漏掉真正的毛病。
 *
 * 只把「按键翻译成动作」的映射表(`return "pause"` / `? "pause" : null`)排除掉 ——
 * 那种写法真正处理的地方在别处,由那一处的 `act === "pause"` 分支负责。
 */
function escBranches(src: string): string[] {
  const lines = src.split("\n");
  const out: string[] = [];
  lines.forEach((line, i) => {
    const handlesEsc = /["']Escape["']/.test(line);
    const handlesPause = /\b(?:act|action|key|k)\s*===\s*["']pause["']/.test(line);
    if (!handlesEsc && !handlesPause) return;
    if (/["']pause["']\s*(?::|;|$)/.test(line) || /return\s+["']pause["']/.test(line)) return;
    if (/\?\s*["']pause["']/.test(line)) return;
    if (!line.includes("{")) return;

    // 分支上面几行也一并收:有的游戏把 `e.preventDefault()` 提到分支之前统一调,
    // 那样同样满足契约,不该判红
    let depth = 0;
    const chunk: string[] = lines.slice(Math.max(0, i - 6), i);
    for (let j = i; j < lines.length; j++) {
      chunk.push(lines[j]);
      for (const ch of lines[j]) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0 && chunk.length > 0 && lines[j].includes("}")) break;
    }
    out.push(chunk.join("\n"));
  });
  return out;
}

describe("窗口 1 · Esc 暂停不许和游戏壳打架", () => {
  for (const id of WINDOW1_GAMES) {
    it(`${id} 接住 Esc 之后调了 preventDefault`, () => {
      const src = sourceOf(id);
      const branches = escBranches(src);
      expect(branches.length, `${id} 里找不到处理 Esc 的分支`).toBeGreaterThan(0);
      for (const branch of branches) {
        expect(
          branch,
          `${id} 自己接了 Esc 却没 preventDefault,壳层会再弹一次暂停面板:\n${branch}`
        ).toMatch(/preventDefault/);
      }
    });
  }

  it("12 款一个都不少", () => {
    expect(new Set(WINDOW1_GAMES).size).toBe(12);
  });
});
