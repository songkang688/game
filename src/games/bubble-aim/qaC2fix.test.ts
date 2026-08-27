// 档C · 第 2 轮监督修复员:C2-02(阻断)清零 + 「一次异常卡死整局」这一类风险的总闸。
//
// C2-02 的两层原因分开修、分开验:
//   里层——`endlessStartRows` 出的行长度不看 `g.flip`,一半的时候和 `descend` 对不上;
//   外层——`raf = requestAnimationFrame(tick)` 写在帧函数最后一行,
//          中间任何一步抛异常都会把整条 rAF 循环带走,不只是这一帧画歪。
// 里层是这次的病,外层是这一类病的通道。三款有帧循环的都按外层改了一遍。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import {
  ENDLESS_PUSH_EVERY,
  endlessRow,
  endlessShouldPush,
  endlessStartRows,
  endlessTotal,
} from "./aim12";
import { COLS, countBubbles, descend, parseLayout, rowLen, type Grid } from "./logic";

const COLORS = ["R", "Y", "B", "G", "P"];

/** `index.ts` 的 afterEndlessShot() 一比一搬下来(去掉 DOM 和音效) */
function afterEndlessShot(g: Grid, shotsFired: number, rowsPushed: number, rand: () => number): number {
  let pushed = rowsPushed;
  if (endlessShouldPush(shotsFired)) {
    descend(g, endlessRow(g, COLORS, rand, pushed));
    pushed++;
  }
  if (countBubbles(g) === 0) {
    for (const line of endlessStartRows(COLORS, rand, 2, g.flip ^ 1)) descend(g, line);
  }
  return pushed;
}

describe("档C R2 修复 · C2-02 无尽清屏补货不再抛异常", () => {
  it("四种奇偶起手都补得上(第 0/1/2/3 次压行之后各清一次屏)", () => {
    for (const pushes of [0, 1, 2, 3]) {
      const g = parseLayout(endlessStartRows(COLORS, mulberry32(21), 4));
      for (let k = 0; k < pushes; k++) descend(g, endlessRow(g, COLORS, mulberry32(30 + k), k));
      expect(g.flip, `压过 ${pushes} 行`).toBe(pushes % 2);
      g.rows.forEach((row) => row.fill(null));
      expect(() => afterEndlessShot(g, 1, pushes, mulberry32(7)), `压过 ${pushes} 行`).not.toThrow();
      expect(countBubbles(g), `压过 ${pushes} 行`).toBeGreaterThan(0);
    }
  });

  it("补进来的两行长度逐行都对得上 descend 的要求", () => {
    for (let flip = 0; flip <= 1; flip++) {
      const lines = endlessStartRows(COLORS, mulberry32(5), 2, flip ^ 1);
      // descend 第 0 行要 rowLen(flip ^ 1, 0),第 1 行 flip 已翻,要 rowLen(flip, 0)
      expect(lines.map((l) => l.length), `flip=${flip}`).toEqual([
        rowLen(flip ^ 1, 0),
        rowLen(flip, 0),
      ]);
    }
  });

  it("连打 1000 发、一路狂清屏,一次都不抛,也从来不停在空屏", () => {
    const rand = mulberry32(4242);
    const g = parseLayout(endlessStartRows(COLORS, mulberry32(4241), 4));
    let pushed = 0;
    for (let fired = 1; fired <= 1000; fired++) {
      // 每隔几发就把整屏清掉,模拟一串大连锁
      if (fired % 7 === 0) g.rows.forEach((row) => row.fill(null));
      expect(() => {
        pushed = afterEndlessShot(g, fired, pushed, rand);
      }, `第 ${fired} 发`).not.toThrow();
      expect(countBubbles(g), `第 ${fired} 发之后停在空屏了`).toBeGreaterThan(0);
      if (g.rows.length > 12) g.rows.length = 12;
    }
    expect(pushed).toBe(Math.floor(1000 / ENDLESS_PUSH_EVERY));
  });

  it("补货这条路走过之后,网格自己还是自洽的(每行长度和 flip 对得上)", () => {
    const g = parseLayout(endlessStartRows(COLORS, mulberry32(88), 4));
    for (let round = 0; round < 30; round++) {
      if (round % 3 === 0) g.rows.forEach((row) => row.fill(null));
      afterEndlessShot(g, (round + 1) * ENDLESS_PUSH_EVERY, round, mulberry32(90 + round));
      g.rows.forEach((row, r) => {
        expect(row.length, `第 ${round} 轮第 ${r} 行长度和 flip 对不上`).toBe(rowLen(g.flip, r));
      });
      if (g.rows.length > 12) g.rows.length = 12;
    }
  });

  it("不传 flip 的老口径一个字节没变,parseLayout 那条路不受影响", () => {
    const a = endlessStartRows(COLORS, mulberry32(13), 4);
    expect(a.map((l) => l.length)).toEqual([COLS, COLS - 1, COLS, COLS - 1]);
    const g = parseLayout(a);
    expect(g.flip).toBe(0);
    expect(countBubbles(g)).toBeGreaterThan(0);
    // 同一个种子出同一批行,无尽开局仍然是确定性的
    expect(endlessStartRows(COLORS, mulberry32(13), 4)).toEqual(a);
  });

  it("成绩换算没被这次修改带歪", () => {
    expect(endlessTotal(0, 0)).toBe(0);
    expect(endlessTotal(100, 4)).toBeGreaterThan(endlessTotal(100, 3));
  });
});

/* ------------------------------------------------------------------ */
/* 「一次异常卡死整局」这一类风险的总闸                                  */
/* ------------------------------------------------------------------ */

/** 有帧循环的三款,以及各自的帧函数名 */
const LOOPS: Array<[string, string]> = [
  ["alien-seek", "frame"],
  ["bubble-aim", "tick"],
  ["snake-snack", "frame"],
];

function readIndex(game: string): string {
  return readFileSync(new URL(`../${game}/index.ts`, import.meta.url), "utf8");
}

describe("档C R2 修复 · 帧循环不许被一次异常带走", () => {
  it("三款的排帧句都紧跟在 destroyed 闸后面,不是压在函数最后一行", () => {
    for (const [game, fn] of LOOPS) {
      const src = readIndex(game);
      const at = src.indexOf(`function ${fn}(now: number): void {`);
      expect(at, `${game} 里找不到 ${fn}()`).toBeGreaterThan(0);
      const head = src.slice(at, at + 700);
      const guard = head.indexOf("if (destroyed) return;");
      const sched = head.indexOf(`raf = requestAnimationFrame(${fn});`);
      expect(guard, `${game} 的 ${fn}() 没有 destroyed 闸`).toBeGreaterThan(0);
      expect(sched, `${game} 的 ${fn}() 里没有排帧句`).toBeGreaterThan(guard);
      // 排帧句和 destroyed 闸之间只许隔注释,不许隔真代码
      const between = head.slice(guard + "if (destroyed) return;".length, sched);
      const code = between
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));
      expect(code, `${game} 的 ${fn}() 在排帧之前还干了别的活`).toEqual([]);
    }
  });

  it("三款的帧函数里排帧句只有一处,不会一帧排两次(排两次会越跑越快)", () => {
    for (const [game, fn] of LOOPS) {
      const src = readIndex(game);
      const at = src.indexOf(`function ${fn}(now: number): void {`);
      const body = src.slice(at, src.indexOf("\n  }\n", at));
      const hits = body.split(`requestAnimationFrame(${fn})`).length - 1;
      expect(hits, `${game} 的 ${fn}() 里排了 ${hits} 次帧`).toBe(1);
    }
  });

  it("三款都有 destroyed 标记 + cancelAnimationFrame,退出时不会留着帧在跑", () => {
    for (const [game] of LOOPS) {
      const src = readIndex(game);
      expect(src, `${game} 没有 destroyed 标记`).toContain("destroyed = true");
      expect(src, `${game} 退出时没有取消帧`).toContain("cancelAnimationFrame(");
    }
  });

  it("box-hamster / memory-cards 没有常驻帧循环,不在这张闸上", () => {
    expect(readIndex("memory-cards")).not.toContain("requestAnimationFrame");
    // box-hamster 只有挂载时量一次格子那一发,不是循环
    const box = readIndex("box-hamster");
    expect(box.split("requestAnimationFrame").length - 1).toBe(1);
    expect(box).toContain("cancelAnimationFrame(");
  });
});
