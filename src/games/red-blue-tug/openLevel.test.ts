/**
 * 红蓝拔河 · 「直开第 N 关」写好了却没人调（窗口5 第2轮 档C 监督修复员 · W5R2-FC-08 空转）。
 *
 * `runtime.ts` 里 `parseLevelParam` / `resolveInitialLevel` 两支按契约写齐、
 * `upgrade12.test.ts` 里还各有六条用例钉着——可 `index.ts` 一次都没 import 过它们。
 * 用例全绿、功能不存在：真机上 `?level=141#/game/red-blue-tug` 打开的还是选关地图，
 * 五款里只有这一款进不去。
 *
 * `UPGRADE-1.2.md` 给的理由是「`mountLevelGame` 没有 `initialLevel` 这个入口，
 * 要接就得改 `level99.ts`」。这个理由现在站不住了：同档另外四款
 * （`poop-hero` / `find-diff` / `kitty-care` / `pinyin-train`）**一个字都没改 `level99.ts`**，
 * 全是「替玩家在地图上点一下那一格」落地的。照抄同一套。
 *
 * 兜底照抄邻居：章节锁着 / 关卡锁着 / 抛异常，一律安静停在地图上，绝不把游戏卡住。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { openLevelOnMap, parseLevelParam, resolveInitialLevel } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

interface NodeStub {
  label: string;
  locked?: boolean;
  clicked?: boolean;
}

function mapHost(nodes: NodeStub[], tabs: boolean[]) {
  const mk = (n: NodeStub) => ({
    classList: { contains: (t: string) => t === "l99-node-lock" && !!n.locked },
    getAttribute: () => n.label,
    click: () => {
      n.clicked = true;
    }
  });
  const tabStubs = tabs.map((open) => ({
    classList: { contains: (t: string) => t === "l99-tab-lock" && !open },
    getAttribute: () => null,
    click: () => {}
  }));
  return {
    querySelectorAll: (sel: string) => (sel.includes("l99-tab") ? tabStubs : nodes.map(mk))
  };
}

describe("红蓝拔河 · 接上「直开第 N 关」（W5R2-FC-08）", () => {
  it("`index.ts` 真的调了这两支，不是只在 runtime 里放着", () => {
    expect(SRC, "`resolveInitialLevel` 还是没人调").toContain("resolveInitialLevel");
    expect(SRC, "地址栏的 ?level=N 还是没人读").toContain("parseLevelParam");
    expect(SRC, "壳层给的 initialLevel 还是没人接").toContain("initialLevel");
    expect(SRC, "没有「替玩家在地图上点一格」这一步").toMatch(/l99-node|openLevelOnMap/);
  });

  it("点不开就安静停在地图上，不许把游戏卡住", () => {
    expect(SRC, "直开这一步没有兜底，抛出来会把整关卡死").toMatch(/try\s*\{[\s\S]{0,400}catch/);
  });

  it("地址栏与壳层两条路都读得出关号", () => {
    expect(parseLevelParam("?level=141")).toBe(141);
    expect(parseLevelParam("?a=1&level=7&b=2")).toBe(7);
    expect(parseLevelParam("?nope=1")).toBeNull();
    expect(resolveInitialLevel(141, 187)).toBe(140);
    expect(resolveInitialLevel(141, 40), "还没解锁就退到能玩到的最远那一关").toBe(40);
    expect(resolveInitialLevel(undefined, 40)).toBeNull();
  });

  it("章节锁着 / 关卡锁着都返回 false，一格都不点", () => {
    const nodes = [{ label: "第 3 关 · 锁着", locked: true }];
    expect(openLevelOnMap(mapHost(nodes, [true]), 2, 0)).toBe(false);
    expect(nodes[0].clicked).toBeUndefined();
    expect(openLevelOnMap(mapHost([{ label: "第 3 关" }], [false]), 2, 0)).toBe(false);
  });

  it("解锁了就替玩家点那一格", () => {
    const nodes = [{ label: "第 1 关" }, { label: "第 3 关 · 三星" }];
    expect(openLevelOnMap(mapHost(nodes, [true]), 2, 0)).toBe(true);
    expect(nodes[1].clicked).toBe(true);
    expect(nodes[0].clicked).toBeUndefined();
  });
});
