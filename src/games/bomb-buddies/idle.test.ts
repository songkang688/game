/**
 * 泡泡对战 · 「玩家一个键都不按」常驻用例。
 *
 * 第 3 轮测试员的附录 C.5 点名:本款有战役、摆烂扫描是干净的,
 * 但 `src` 里没有一条常驻用例在问「玩家什么都不做会怎样」。这一份补上那张网。
 *
 * 建局照 `index.ts` 的 `playLevel()` → `createMatch()`:单人战役只有 0 号座位,
 * **场上没有 AI 队友替你摆泡泡**,`exitNeedsClear` / `rescue` / `pool` 都照真机传,
 * 结束条件也照 `checkEnd()`:先看 `levelCleared()`,再看限时到没到。
 * 输入槽全程喂「不走、不摆、不引爆」,小怪照常巡逻。
 */
import { describe, expect, it } from "vitest";
import { buildLevel } from "./levels";
import { applyItem, createWorld, levelCleared, makeFighter, stepWorld, type World } from "./logic";

const TICK = 16;
/** 不走、不摆泡泡、不引爆 —— 手指从头到尾没碰过屏幕 */
const IDLE = { dir: -1, drop: false, detonate: false };

function idleRun(level: number): { world: World; lv: ReturnType<typeof buildLevel> } {
  const lv = buildLevel(level, 1);
  const me = makeFighter(0, "鸭梨", "🌸", lv.spawns[0], 0);
  for (const item of lv.starters) applyItem(me, item);
  const world = createWorld({
    board: lv.board,
    fighters: [me],
    critters: lv.critters.map((c) => ({ ...c })),
    hidden: new Map(lv.hidden),
    exit: lv.exit,
    exitNeedsClear: true,
    goal: lv.goal,
    pierce: lv.pierce,
    rescue: false,
    limit: lv.seconds > 0 ? lv.seconds * 1000 : 0,
    seed: lv.seed,
    richness: lv.richness,
    pool: lv.pool,
  } as never);
  const capMs = (lv.seconds > 0 ? lv.seconds : 200) * 1000;
  for (let t = 0; t < capMs; t += TICK) {
    if (levelCleared(world)) break;
    stepWorld(world, TICK, [IDLE] as never);
  }
  return { world, lv };
}

describe("泡泡对战 · 摆烂:一个键都不按", () => {
  it("第 1 关零输入:一只小怪都罩不住,清不了场", () => {
    const { world, lv } = idleRun(0);
    expect(levelCleared(world), "第 1 关摆烂居然清场了").toBe(false);
    expect(world.critters.length, "一个泡泡都没摆,小怪却少了").toBe(lv.critters.length);
    expect(world.bombs.length, "手指没碰过屏幕,场上却有泡泡").toBe(0);
    expect(world.escaped, "人没动过,却走到了出口").toBe(-1);
  });

  it("全 188 关摆烂:一关都清不掉", () => {
    const cleared: number[] = [];
    for (let i = 0; i < 188; i++) {
      if (levelCleared(idleRun(i).world)) cleared.push(i + 1);
    }
    expect(cleared, `摆烂过关的:第 ${cleared.join(" / ")} 关`).toEqual([]);
  }, 60000);

  it("三种关卡目标(清场 / 找出口 / 打头目)都被这一轮扫到了 —— 不是只扫了清场关", () => {
    const goals = new Set<string>();
    for (let i = 0; i < 188; i++) goals.add(buildLevel(i, 1).goal);
    expect(goals.has("clear")).toBe(true);
    expect(goals.has("exit")).toBe(true);
    expect(goals.has("boss")).toBe(true);
  });
});
