// 无头冒烟:不开浏览器,直接用逻辑层把一整局打完,确认真的分得出胜负。
//
// 这里跑的是和 index.ts 完全一样的那套推进函数(`stepWorld`),
// 只是把「玩家的手」换成了电脑决策,所以过关 / 超时 / 对战分胜负这三条
// 路径都是真的被走完的,不是靠断言硬凑出来的。
import { describe, expect, it } from "vitest";
import { chooseAiAction, type AiLevel } from "./ai";
import { ALL_LEVELS, buildArena, buildCoopLevel, buildEndlessRound, buildLevel } from "./levels";
import {
  applyItem,
  createWorld,
  levelCleared,
  loseLine,
  makeFighter,
  matchWinner,
  rateLevel,
  roundWinner,
  secondsLeft,
  stepWorld,
  timeUp,
  winLine,
  type Intent,
  type World,
} from "./logic";

const TICK = 20;

interface Seat {
  skill: AiLevel;
}

function bootstrap(
  lv: ReturnType<typeof buildLevel>,
  seats: Seat[]
): { world: World; play: (ms: number, stop: (w: World) => boolean) => number } {
  const fighters = seats.map((_, i) => {
    const f = makeFighter(i, `玩家${i + 1}`, "🤖", lv.spawns[i] ?? lv.spawns[0], i);
    f.ai = true;
    for (const item of lv.starters) applyItem(f, item);
    return f;
  });
  const world = createWorld({
    board: lv.board,
    fighters,
    critters: lv.critters.map((c) => ({ ...c })),
    hidden: new Map(lv.hidden),
    exit: lv.exit,
    goal: lv.goal,
    pierce: lv.pierce,
    limit: lv.seconds > 0 ? lv.seconds * 1000 : 0,
    seed: lv.seed,
    richness: lv.richness,
  });

  let tick = 0;
  function play(ms: number, stop: (w: World) => boolean): number {
    for (let t = 0; t < ms; t += TICK) {
      if (stop(world)) return t;
      const intents: Intent[] = seats.map((seat, i) => {
        const act = chooseAiAction(world, i, seat.skill, tick + i);
        return { dir: act.dir, drop: act.drop, detonate: act.detonate };
      });
      tick++;
      stepWorld(world, TICK, intents);
    }
    return ms;
  }

  return { world, play };
}

describe("冒烟:闯关真的能打通", () => {
  it("第 1 关能被打到「小怪全清」的真实胜利,并且评得出星", () => {
    const lv = buildLevel(0);
    const { world, play } = bootstrap(lv, [{ skill: 3 }]);
    expect(levelCleared(world)).toBe(false);
    play(lv.seconds * 1000, (w) => levelCleared(w));
    expect(levelCleared(world), "第 1 关没能在限时内清干净").toBe(true);
    expect(timeUp(world)).toBe(false);
    const stars = rateLevel(secondsLeft(world), lv.seconds, world.fighters[0].bubbled);
    expect(stars).toBeGreaterThanOrEqual(1);
    expect(stars).toBeLessThanOrEqual(3);
    expect(winLine(secondsLeft(world), world.fighters[0].bubbled, world.fighters[0].picked).length).toBeGreaterThan(10);
  });

  it("八个章节各抽一关都打得通,不是只有第 1 关能过", () => {
    for (const level of [1, 2, 3, 24, 48, 72, 96, 119, 142, 165, 186]) {
      const lv = buildLevel(level);
      const { world, play } = bootstrap(lv, [{ skill: 3 }]);
      play(lv.seconds * 1000, (w) => levelCleared(w));
      expect(levelCleared(world), `第 ${level + 1} 关没打通`).toBe(true);
    }
  });

  it("找出口的关能真的走到出口(先清怪,再炸开砖走过去)", () => {
    const level = ALL_LEVELS.find((i) => buildLevel(i).goal === "exit");
    expect(level).toBeDefined();
    const lv = buildLevel(level as number);
    const { world, play } = bootstrap(lv, [{ skill: 3 }]);
    play(lv.seconds * 1000, (w) => levelCleared(w));
    expect(world.exitOpen, `第 ${(level as number) + 1} 关的出口没被炸开`).toBe(true);
    expect(world.escaped).toBe(0);
    expect(levelCleared(world)).toBe(true);
  });

  it("泡泡王关能真的把它连包三层", () => {
    const level = ALL_LEVELS.find((i) => buildLevel(i).goal === "boss");
    expect(level).toBeDefined();
    const lv = buildLevel(level as number);
    const { world, play } = bootstrap(lv, [{ skill: 3 }]);
    expect(lv.critters.some((c) => c.kind === "boss")).toBe(true);
    play(lv.seconds * 1000, (w) => levelCleared(w));
    expect(levelCleared(world), `第 ${(level as number) + 1} 关的泡泡王没请走`).toBe(true);
  });

  it("时间耗光是一次真实的失败,失败文案只鼓励", () => {
    const lv = buildLevel(30);
    const { world, play } = bootstrap(lv, [{ skill: 3 }]);
    // 把限时压到 6 秒:同一张图,时间不够就是过不了
    world.limit = 6000;
    play(20000, (w) => levelCleared(w) || timeUp(w));
    expect(timeUp(world)).toBe(true);
    expect(levelCleared(world)).toBe(false);
    expect(loseLine("time")).toContain("下一次");
  });

  it("合作关两个人一起打,也能打到真实通关", () => {
    const lv = buildCoopLevel(2);
    const { world, play } = bootstrap(lv, [{ skill: 3 }, { skill: 3 }]);
    play(lv.seconds * 1000, (w) => levelCleared(w));
    expect(levelCleared(world)).toBe(true);
    expect(world.fighters).toHaveLength(2);
  });

  it("无尽的前三轮都能清完,轮次真的能往上走", () => {
    for (const round of [1, 2, 3]) {
      const lv = buildEndlessRound(round);
      const { world, play } = bootstrap(lv, [{ skill: 3 }]);
      play(60000, (w) => levelCleared(w));
      expect(levelCleared(world), `无尽第 ${round} 轮没清完`).toBe(true);
    }
  });
});

describe("冒烟:对战真的分得出胜负", () => {
  it("两台电脑同屏对轰,一定有人先被泡泡包住", () => {
    const lv = buildArena(1, 2);
    const { world, play } = bootstrap(lv, [{ skill: 3 }, { skill: 3 }]);
    expect(roundWinner(world)).toBe(-1);
    play(180000, (w) => roundWinner(w) >= 0);
    const winner = roundWinner(world);
    expect(winner === 0 || winner === 1, "这一局打了三分钟也没分出胜负").toBe(true);
    // 赢家全程没被包住,输家被包了一次
    expect(world.fighters[winner].bubbled).toBe(0);
    expect(world.fighters[1 - winner].bubbled).toBe(1);
  });

  it("一整场三局两胜打到底,冠军产生", () => {
    const scores = [0, 0];
    let round = 1;
    let guard = 0;
    while (matchWinner(scores) < 0 && guard++ < 12) {
      const lv = buildArena(round, 2);
      const { world, play } = bootstrap(lv, [{ skill: 3 }, { skill: round % 2 === 0 ? 2 : 3 }]);
      play(180000, (w) => roundWinner(w) >= 0);
      const winner = roundWinner(world);
      if (winner >= 0) scores[winner]++;
      round++;
    }
    const champion = matchWinner(scores);
    expect(champion, `打了 ${round - 1} 局还没人先赢 3 局:${scores.join(":")}`).toBeGreaterThanOrEqual(0);
    expect(scores[champion]).toBe(3);
  });

  it("人机对战:三档电脑都能真的把一局打完", () => {
    for (const skill of [1, 2, 3] as AiLevel[]) {
      const lv = buildArena(4, 2);
      const { world, play } = bootstrap(lv, [{ skill: 3 }, { skill }]);
      play(180000, (w) => roundWinner(w) >= 0);
      expect(roundWinner(world), `${skill} 档没打出结果`).toBeGreaterThanOrEqual(0);
    }
  });
});
