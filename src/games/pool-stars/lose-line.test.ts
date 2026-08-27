/**
 * 朵星台球 · 结算浮层收场话的回归网（`R3-PA-PS-1` 的收尾）。
 *
 * 这一条一共经手三拨人，每一拨解决的都是同一句话的不同半截：
 *
 *  1. 第 2 名测试员记下：`loseLine` 无条件在 reason 后面接一句「这一杆差一点点，换个角度再来。」，
 *     可最常见的那条 reason 自己就是这句话，浮层上连着说了两遍；
 *  2. 监督修复员 `d324399` 拦住了含「这一杆差一点点」的那一条；
 *  3. 学习优化员 `82bdd3c` 把闸拉宽到三条词，另外两条自带收尾的 reason 也不再重复。
 *
 * 拉宽之后剩下最后一个豁口：「母球先碰到的不是自己那一组，这一杆差一点点。」
 * 只因为带了「这一杆差一点点」这半句就被整句放行，于是它成了六条 reason 里
 * **唯一一条没有一句「再来」**的收场话 —— 别的失手都请他再试一次，就这一条没有。
 *
 * 所以这张网同时盯两头，缺哪一头都会红：
 *  - 一条线里不许有长度 ≥ 5 的片段出现两次（防重复）；
 *  - 每一条线都得留着一句「再来 / 再瞄」（防漏掉邀请）。
 *
 * reason 列表**从 `levels.ts` 源码里现扫**，不写死：以后有人给 `levelSuccess`
 * 加一条新的失败理由，这张网会自动管上，不用记得回来补。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENCOURAGE, loseLine } from "./levels";

const SRC = readFileSync(fileURLToPath(new URL("./levels.ts", import.meta.url)), "utf8");

/** 把 `levelSuccess` 里每一条失败 reason 从源码上扫下来 */
function failReasons(): string[] {
  const fn = /export function levelSuccess[\s\S]*?\n}/.exec(SRC)?.[0] ?? "";
  return [...fn.matchAll(/ok:\s*false,\s*reason:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** 这一条线里出现两次的第一个长片段；没有就回 null */
function repeatedFragment(line: string, len = 5): string | null {
  for (let i = 0; i + len <= line.length; i++) {
    const frag = line.slice(i, i + len);
    if (line.indexOf(frag) !== line.lastIndexOf(frag)) return frag;
  }
  return null;
}

describe("R3-PA-PS-1 · 结算浮层的收场话", () => {
  const reasons = failReasons();

  it("levelSuccess 的失败理由一条都没漏扫", () => {
    expect(reasons.length, "源码里扫不到失败 reason，这张网就空了").toBeGreaterThanOrEqual(5);
  });

  it("同一句话不许说两遍", () => {
    const bad = reasons
      .map((r) => ({ r, line: loseLine(r), dup: repeatedFragment(loseLine(r)) }))
      .filter((x) => x.dup !== null)
      .map((x) => `「${x.r}」→「${x.line}」重了「${x.dup}」`);
    expect(bad).toEqual([]);
  });

  it("每一条失手都请他再来一次，一条都不许漏", () => {
    const silent = reasons.filter((r) => !/再来|再瞄/.test(loseLine(r)));
    expect(silent, "这几条失手的收场话没有一句「再来」").toEqual([]);
  });

  it("带了「这一杆差一点点」但没请他再来的，只补后半句", () => {
    expect(loseLine("母球先碰到的不是自己那一组，这一杆差一点点。")).toBe(
      "母球先碰到的不是自己那一组，这一杆差一点点。换个角度再来。"
    );
  });

  it("reason 自己已经请过了就一个字不加", () => {
    for (const r of ["这一杆差一点点，换个角度再来。", "进了，可惜不是指定的那个袋，再瞄一次。"]) {
      expect(loseLine(r)).toBe(r);
    }
  });

  it("reason 什么都没说的，照旧补整句鼓励语", () => {
    expect(loseLine("这一关要先吃一次库，直接打过去不算数。")).toBe(
      `这一关要先吃一次库，直接打过去不算数。${ENCOURAGE}`
    );
  });

  it("补出来的话一定以句号收尾，不会断在半截", () => {
    for (const r of [...reasons, "母球掉袋了，"]) {
      expect(loseLine(r).endsWith("。"), `「${r}」的收场话断在半截`).toBe(true);
    }
  });

  it("收场话只鼓励，不批评", () => {
    for (const r of reasons) {
      expect(loseLine(r)).not.toMatch(/笨|差劲|失败者|你不行|活该/);
    }
  });
});
