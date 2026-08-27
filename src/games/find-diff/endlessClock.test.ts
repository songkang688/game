/**
 * 找不同 · 马拉松换轮时的秒表守门（窗口5 第1轮 学习优化员）。
 *
 * 本款测试员没记问题，这一条是本轮读代码时另外找到的竞态：清干净一轮之后
 * 要等 450 毫秒才开下一轮，而 1 秒一跳的秒表在这段空档里没人停——
 * 卡在最后一秒清完的那一把，会先闪一屏「⏰ 这一轮没找完」再被新一轮盖掉。
 *
 * 这块逻辑长在 `mountEndless` 里、外面拿不到句柄，所以这里守的是**源码结构**：
 * 「清干净」那条路上必须先 `stopTimer()` 再排下一轮，而且全款只有一处
 * 会开这个秒表。真机行为由后续轮次的测试员复验。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shell = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");

/** 把 `onCleared: () => { … }` 那一整块揪出来（马拉松那一处） */
function clearedBlock(src: string): string {
  const start = src.indexOf("onCleared: () => {", src.indexOf("function mountEndless"));
  expect(start, "找不到马拉松的 onCleared").toBeGreaterThan(0);
  const end = src.indexOf("\n      },", start);
  expect(end, "onCleared 没有收尾").toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("找不同 · 马拉松换轮不许闪「这一轮没找完」", () => {
  it("清干净一轮之后先停秒表，再排下一轮", () => {
    const block = clearedBlock(shell);
    const stop = block.indexOf("stopTimer()");
    const schedule = block.indexOf("nextId = setTimeout");
    expect(stop, "清干净之后没有停秒表").toBeGreaterThan(0);
    expect(schedule, "没有排下一轮").toBeGreaterThan(0);
    expect(stop, "秒表得在排下一轮之前停掉").toBeLessThan(schedule);
  });

  it("stopTimer 把倒计时与换轮延时一起收干净", () => {
    expect(shell).toMatch(/function stopTimer\(\): void \{[\s\S]*?clearInterval\(timerId\)[\s\S]*?clearTimeout\(nextId\)[\s\S]*?\}/);
  });

  it("马拉松里只有一处会开倒计时，超时与退出也都从 stopTimer 走", () => {
    const endless = shell.slice(shell.indexOf("function mountEndless"));
    const starts = endless.match(/timerId = setInterval\(/g) ?? [];
    expect(starts.length, "马拉松里开了不止一个倒计时").toBe(1);
    // 超时结算与拆场两条路都先收秒表
    expect(endless).toMatch(/function showOver\(\): void \{\s*stopTimer\(\);/);
    expect(endless).toMatch(/dead = true;\s*stopTimer\(\);/);
    // 换一轮同样先收
    expect(endless).toMatch(/function startRound\(\): void \{\s*if \(dead\) return;\s*stopTimer\(\);/);
  });
});
