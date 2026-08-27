/**
 * 泡泡兄弟 · 「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 *
 * 建局照 `index.ts` 的 `playLevel()`:单人战役是 `createWorld(buildLevel(n), { players: 1 })`,
 * 场上**没有 AI 队友**(队友只在双人合作里出现),所以「玩家不动」就等于「玩家那一位不动」,
 * 咕噜怪照常巡逻、照常追人。这正是 B2(`prince-princess`)踩过的坑:
 * 扫错模式会把「搭档替你包场」的关误判成干净,所以这里按真机的单人模型来。
 */
import { describe, expect, it } from "vitest";
import { TOTAL, buildLevel } from "./arena";
import { createWorld, emptyInput, starsForRun, stepWorld, summarize, type World } from "./logic";

const DT = 1 / 60;

/** 一整关摆烂:输入槽全程喂空,怪照常动,跑到分出胜负或者超出限时 */
function idleRun(level: number): { world: World; def: ReturnType<typeof buildLevel> } {
  const def = buildLevel(level);
  const world = createWorld(def, { players: 1 });
  // 不限时的关也给个天花板,免得摆烂僵持把用例挂死
  const cap = Math.ceil(((def.timeLimit > 0 ? def.timeLimit : 120) + 10) / DT);
  let steps = 0;
  while (world.status === "playing" && steps < cap) {
    stepWorld(world, DT, [emptyInput()]);
    steps++;
  }
  return { world, def };
}

describe("泡泡兄弟 · 摆烂:一个键都不按", () => {
  it("第 1 关零输入:一只咕噜怪都裹不住,既过不了关也拿不到糖", () => {
    const { world, def } = idleRun(0);
    const run = summarize(world);
    expect(run.win, "第 1 关摆烂居然过关了").toBe(false);
    expect(world.status).toBe("lost");
    expect(run.cleared, "一个键都没按,却清掉了咕噜怪").toBe(0);
    expect(run.candies).toBe(0);
    expect(run.monsterTotal).toBeGreaterThan(0);
    expect(starsForRun(def, run)).toBeLessThan(3);
  });

  it("全 188 关摆烂:一关都过不去", () => {
    const won: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      if (idleRun(i).world.status === "won") won.push(i + 1);
    }
    expect(won, `摆烂过关的:第 ${won.join(" / ")} 关`).toEqual([]);
  }, 60000);

  it("全 188 关摆烂都是真的判负 —— 没有一关是「既不过也不输」的僵持", () => {
    const stalled: number[] = [];
    for (let i = 0; i < TOTAL; i++) {
      if (idleRun(i).world.status === "playing") stalled.push(i + 1);
    }
    expect(stalled, `摆烂僵持不结算的:第 ${stalled.join(" / ")} 关`).toEqual([]);
  }, 60000);
});
