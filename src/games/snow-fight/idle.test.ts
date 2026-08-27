/**
 * 雪球大作战 · 「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 * (C.5 也特意说明:按全文扫 `idle` 会把本款误算成「已覆盖」——
 * `idleInput()` 到处都是,可没有一条用例真的拿它跑完一整关。)
 *
 * 用的是 1.2 的实时场地 `arena.ts`(`index.ts` 的战役走的就是 `campaignArena`),
 * 座位 0 全程喂 `idleInput()`:不走、不抬准星、不蹲下搓雪、不按投。
 * 雪怪照常行军、照常朝雪堡扔雪球。
 */
import { describe, expect, it } from "vitest";
import { LEVEL_TOTAL, buildLevel } from "./levels";
import { campaignArena, idleInput, stepArena, type Arena } from "./arena";

/** 一步 1/30 秒;跑到分出胜负,或者 400 秒都没动静就收手 */
const STEP = 1 / 30;
const CAP_SECONDS = 400;

function idleRun(level: number): Arena {
  const arena = campaignArena(buildLevel(level));
  let t = 0;
  while (arena.status === "playing" && t < CAP_SECONDS) {
    stepArena(arena, STEP, { 0: idleInput() });
    t += STEP;
  }
  return arena;
}

/** 这一关有没有会朝雪堡走的雪怪(只有灯笼靶的关,摆烂就是干等) */
function hasMarchingFoe(level: number): boolean {
  return campaignArena(buildLevel(level)).foes.some((f) => f.march > 0);
}

describe("雪球大作战 · 摆烂:一个键都不按", () => {
  it("第 1 关零输入:靶子一个都不会自己化掉,更不会判过关", () => {
    const arena = idleRun(0);
    expect(arena.status, "第 1 关摆烂居然过关了").not.toBe("win");
    expect(arena.melted, "一个雪球都没扔,靶子却化了").toBe(0);
    expect(arena.balls.length).toBe(0);
    // 第 1 关是静止的灯笼靶,没有会走过来的雪怪,所以摆烂就是一直不结束
    expect(hasMarchingFoe(0)).toBe(false);
    expect(arena.status).toBe("playing");
  });

  it("全 188 关摆烂:一关都过不去", () => {
    const won: number[] = [];
    for (let i = 0; i < LEVEL_TOTAL; i++) {
      if (idleRun(i).status === "win") won.push(i + 1);
    }
    expect(won, `摆烂过关的:第 ${won.join(" / ")} 关`).toEqual([]);
  }, 60000);

  it("有雪怪会行军的关,摆烂一律以「雪人走到雪堡跟前」判负", () => {
    const bad: number[] = [];
    let checked = 0;
    for (let i = 0; i < LEVEL_TOTAL; i++) {
      if (!hasMarchingFoe(i)) continue;
      checked++;
      const arena = idleRun(i);
      if (arena.status !== "lose" || !arena.reason.includes("雪堡")) {
        bad.push(i + 1);
      }
    }
    expect(checked, "一关会行军的雪怪都没扫到,模型八成搭错了").toBeGreaterThan(100);
    expect(bad, `摆烂却没被雪怪推平的:第 ${bad.join(" / ")} 关`).toEqual([]);
  }, 120000);
});
