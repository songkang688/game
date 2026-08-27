/**
 * 窗口 4 那 15 款的「Esc 只弹一层 + 暂停面板真的停得住」契约巡检。
 *
 * 两条红线，都是外壳 `src/ui/gameShell.ts` 定下来的：
 *
 * 一、Esc 只能弹一层。外壳自己也在 window 上听 Esc，收到**没被接住**的
 *     就会弹它那张「先歇一会儿」：
 *
 * ```ts
 * window.setTimeout(() => {
 *   if (disposed || dialog || pauseDialog || e.defaultPrevented) return;  // ← 就看这一句
 *   openPause();
 * }, 0);
 * ```
 *
 *     所以自己接管了 Esc 的游戏必须 `preventDefault()`。窗口 1 早在
 *     `src/games/window1-pause.test.ts` 里把这条钉死过；本轮复盘发现窗口 4
 *     的 `fruit-catch` 无尽与 `lianliankan` 无尽照样漏了，退场之后外壳又叠一层。
 *
 * 二、暂停面板得真的停得住。外壳弹面板前调 `mounted.pause()`、关掉调
 *     `mounted.resume()`，游戏不接就只是画了一张面板，后面照跑。
 *     行为怎么验在 `pause-freeze.test.ts` / `pause-gate.test.ts`，
 *     这一份只管「一款都不许漏接」。
 *
 * 巡检**只覆盖窗口 4 这 15 款**，不越界看别的窗口的目录。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 窗口 4 的 15 款 */
const WINDOW4_IDS = [
  "brave-path",
  "adventure-king",
  "alien-seek",
  "brick-break",
  "mole-pop",
  "box-hamster",
  "balloon-pop",
  "bubble-pop",
  "bubble-aim",
  "fruit-catch",
  "fruit-slice",
  "snake-snack",
  "lianliankan",
  "puzzle-tiles",
  "memory-cards",
] as const;

/**
 * 推箱子小仓鼠是纯回合玩法：没有倒计时、没有会自己动的东西，
 * 孩子不动它就一直等着。外壳弹面板时它本来就是停的，不给它加空壳代码。
 */
const NO_CLOCK = new Set(["box-hamster"]);

const sourceOf = (id: string): string => readFileSync(new URL(`../games/${id}/index.ts`, import.meta.url), "utf8");

/** 把 `index.ts` 里每一段「接住 Esc 之后到 return 为止」的代码切出来 */
function escBranches(src: string): string[] {
  const out: string[] = [];
  const heads = [
    /if \(\s*(?:e\.key|k|key|ev\.key)\s*===\s*"Escape"\s*\)\s*\{/g,
    /else if \(\s*(?:e\.key|k|key)\s*===\s*"Escape"\s*\)\s*\{/g,
    /if \(\s*(?:e|ev)\.key\s*!==\s*"Escape"\s*\)\s*return;/g,
  ];
  for (const re of heads) {
    for (const m of src.matchAll(re)) {
      const head = m.index ?? 0;
      const end = src.indexOf("return;", head + m[0].length);
      out.push(src.slice(head, end < 0 ? head + 400 : end + 7));
    }
  }
  // 还有一种写法:`else if (k === "Escape") back();` 挂在一串 else 后面,
  // 由链子最后那一句统一 preventDefault——按整条 keydown 回调切出来看
  for (const m of src.matchAll(/else if \(\s*k === "Escape"\s*\)[^\n]*\n/g)) {
    const head = m.index ?? 0;
    const tail = src.indexOf("});", head);
    out.push(src.slice(head, tail < 0 ? head + 400 : tail));
  }
  return out;
}

describe("窗口 4 · Esc 只弹一层暂停", () => {
  it("15 款的源码都读得到", () => {
    for (const id of WINDOW4_IDS) expect(sourceOf(id).length, id).toBeGreaterThan(1000);
  });

  it("每一段 Esc 分支都调了 preventDefault，外壳不会再叠一层面板", () => {
    const missing: string[] = [];
    for (const id of WINDOW4_IDS) {
      for (const branch of escBranches(sourceOf(id))) {
        if (!branch.includes("preventDefault")) missing.push(id);
      }
    }
    expect(missing, `这些款的 Esc 分支漏了 preventDefault(): ${missing.join(", ")}`).toEqual([]);
  });

  it("本轮点名的两处（接住小水果无尽 / 连连看无尽）钉死", () => {
    for (const id of ["fruit-catch", "lianliankan"]) {
      const branches = escBranches(sourceOf(id));
      expect(branches.length, `${id} 一段 Esc 分支都没切出来`).toBeGreaterThan(0);
      for (const b of branches) expect(b, id).toContain("preventDefault");
    }
  });

  it("没自己接 Esc 的那几款是有意为之：交给外壳弹面板，而不是压根没暂停", () => {
    // 交给外壳的前提就是 pause/resume 接上了，否则面板停不住——由下一组用例保证
    for (const id of WINDOW4_IDS) {
      const src = sourceOf(id);
      if (escBranches(src).length > 0) continue;
      expect(NO_CLOCK.has(id) || /pause:\s*(freezeAll|\(\))/.test(src), `${id} 既不接 Esc 也不接 pause`).toBe(true);
    }
  });
});

describe("窗口 4 · 外壳暂停面板停得住", () => {
  it("会自己动的那几款都从 mount 返回了 pause / resume", () => {
    const missing: string[] = [];
    for (const id of WINDOW4_IDS) {
      if (NO_CLOCK.has(id)) continue;
      const src = sourceOf(id);
      if (!/\n\s*pause:\s/.test(src) || !/\n\s*resume:\s/.test(src)) missing.push(id);
    }
    expect(missing, `这些款没接外壳的暂停契约: ${missing.join(", ")}`).toEqual([]);
  });

  it("mount 的返回类型也一并放宽了，不是只在对象字面量里多塞两个键", () => {
    for (const id of WINDOW4_IDS) {
      if (NO_CLOCK.has(id)) continue;
      const src = sourceOf(id);
      expect(src, `${id} 的 mount 返回类型没写 pause`).toMatch(
        /export function mount\([^)]*\): \{ pause: \(\) => void; resume: \(\) => void; destroy: \(\) => void \}/
      );
    }
  });

  it("免检的那一款是真的没有会自己走的东西", () => {
    for (const id of NO_CLOCK) {
      const src = sourceOf(id);
      expect(src, `${id} 有 setInterval，就不该免检`).not.toContain("setInterval(");
      // 只剩两处装饰性的：提示条 2.2 秒自己收起来、开局量一次棋盘宽度
      const timers = src.split("setTimeout(").length - 1;
      const frames = src.split("requestAnimationFrame(").length - 1;
      expect(timers, `${id} 的 setTimeout 变多了，回头确认是不是加了计时玩法`).toBe(1);
      expect(frames, `${id} 的 rAF 变多了，回头确认是不是加了动画循环`).toBe(1);
    }
  });

  it("暂停相关的注释里没有商标，也没有低幼词", () => {
    for (const id of WINDOW4_IDS) {
      const lines = sourceOf(id)
        .split("\n")
        .filter((l) => /暂停|先歇一会儿|冻住|化冻/.test(l));
      for (const l of lines) {
        expect(l, `${id}: ${l.trim()}`).not.toMatch(
          /愤怒的小鸟|植物大战僵尸|水果忍者|地铁跑酷|超级玛丽|马里奥|俄罗斯方块|Tetris|三国杀|大富翁|斗地主|吃豆人|宝可梦|皮卡丘|奥特曼|喜羊羊|蛋仔|原神|王者荣耀/i
        );
        expect(l, `${id}: ${l.trim()}`).not.toMatch(/宝宝|乖乖|棒棒哒/);
      }
    }
  });
});
