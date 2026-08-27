/**
 * 铁皮小坦克 · 「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 * (C.5 也特意说明:按全文扫 `IDLE_INPUT` 会把本款误算成「已覆盖」——
 * `IDLE_INPUT` 到处都是,可没有一条用例真的拿它跑完一整关。)
 *
 * 建局照 `index.ts` 的 `playLevel()`:单人闯关是 `mode: "campaign"`、`players: 1`、
 * 种子 `1000 + 关号`,并走 `scaleForPlayers(lv, 1)`。玩家那一路全程喂 `IDLE_INPUT`,
 * 铁皮车照常出场、照常砸老巢。
 */
import { describe, expect, it } from "vitest";
import { LEVEL_TOTAL, buildLevel, scaleForPlayers } from "./levels";
import { IDLE_INPUT, createWorld, stepWorld, type World } from "./logic";

const DT = 1 / 60;

/** 一整关摆烂:方向不按、不开火、不铺砖,跑到分出胜负或者限时用完 */
function idleRun(level: number): World {
  const lv = buildLevel(level);
  const world = createWorld({
    rows: lv.rows,
    mode: "campaign",
    queue: lv.waves,
    limit: lv.limit,
    players: 1,
    seed: 1000 + level,
    ...scaleForPlayers(lv, 1),
  });
  let t = 0;
  while (world.status === "playing" && t < lv.limit + 10) {
    stepWorld(world, DT, [IDLE_INPUT]);
    t += DT;
  }
  return world;
}

describe("铁皮小坦克 · 摆烂:一个键都不按", () => {
  it("第 1 关零输入:一辆铁皮车都打不掉,老巢被砸判负", () => {
    const world = idleRun(0);
    expect(world.status, "第 1 关摆烂居然赢了").toBe("lose");
    expect(world.defeated, "一炮没开,却记了战果").toBe(0);
    expect(world.reason).toContain("星星堡垒被砸中");
  });

  it("全 188 关摆烂:一关都赢不了", () => {
    const won: number[] = [];
    for (let i = 0; i < LEVEL_TOTAL; i++) {
      if (idleRun(i).status === "win") won.push(i + 1);
    }
    expect(won, `摆烂过关的:第 ${won.join(" / ")} 关`).toEqual([]);
  }, 120000);

  it("全 188 关摆烂都真的判负 —— 没有一关是「既不赢也不输」的僵持", () => {
    const stalled: number[] = [];
    for (let i = 0; i < LEVEL_TOTAL; i++) {
      if (idleRun(i).status === "playing") stalled.push(i + 1);
    }
    expect(stalled, `摆烂僵持不结算的:第 ${stalled.join(" / ")} 关`).toEqual([]);
  }, 120000);
});
