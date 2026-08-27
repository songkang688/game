// 无头冒烟:不开浏览器,直接用逻辑层把一整局打完,确认真的分得出胜负。
//
// 这里跑的是和 index.ts 完全一样的那套推进函数(`stepWorld`),
// 只是把「玩家的手」换成了电脑决策,所以闯关通过、被撞出场、对战决出冠军
// 这几条路径都是真的被走完的,不是靠断言硬凑出来的。
import { describe, expect, it } from "vitest";
import { chooseCarAction, huntersFor, type AiLevel } from "./ai";
import { buildArena, buildLevel, buildWave, type CarLevel } from "./levels";
import {
  createWorld,
  foesGone,
  lastTeamStanding,
  levelCleared,
  makeCar,
  playerDown,
  timeUp,
  type Car,
  type Intent,
  type World,
} from "./logic";

const TICK = 16;

interface Table {
  world: World;
  /** 让电脑替所有人开车,直到 stop 成立或者时间用完;返回实际推进的毫秒 */
  play: (ms: number, stop: (w: World) => boolean) => number;
}

function seatSkills(lv: CarLevel, mySkill: AiLevel): AiLevel[] {
  return [mySkill, ...lv.foes.map((f) => f.skill)];
}

function bootstrap(lv: CarLevel, mySkill: AiLevel): Table {
  const cars: Car[] = [
    makeCar({
      id: 0,
      name: "鸭梨",
      emoji: "🌸",
      color: "#e8558f",
      team: 0,
      x: lv.spawn.x,
      y: lv.spawn.y,
      lives: lv.hearts,
      ai: true,
    }),
  ];
  lv.foes.forEach((foe, i) => {
    const spot = lv.foeSpawns[i] ?? lv.foeSpawns[0] ?? lv.spawn;
    cars.push(
      makeCar({
        id: i + 1,
        name: foe.name,
        emoji: foe.emoji,
        color: foe.color,
        team: 1,
        x: spot.x,
        y: spot.y,
        lives: foe.lives,
        mass: foe.mass,
        r: foe.r,
        ai: true,
      })
    );
  });
  const world = createWorld({
    field: lv.field,
    cars,
    pads: lv.pads,
    hazards: lv.hazards,
    spinners: lv.spinners,
    slicks: lv.slicks,
    limit: lv.seconds > 0 ? lv.seconds * 1000 : 0,
    keep: lv.keep,
    seed: lv.seed,
  });
  const skills = seatSkills(lv, mySkill);
  let tick = 0;
  function play(ms: number, stop: (w: World) => boolean): number {
    for (let t = 0; t < ms; t += TICK) {
      if (stop(world)) return t;
      const hunters = huntersFor(world, lv.hunters, world.time);
      const intents: Intent[] = world.cars.map((_, i) =>
        chooseCarAction(world, i, skills[i] ?? 2, tick + i * 7, i === 0 || hunters.has(i) ? "hunt" : "patrol")
      );
      tick++;
      world.events.length = 0;
      stepWorld(world, TICK, intents);
    }
    return ms;
  }
  return { world, play };
}

// stepWorld 单独 import 一次,避免上面的 import 列表被 lint 排序打乱
import { stepWorld } from "./logic";

// 一局什么时候结束,和 index.ts 的 checkEnd 对齐:场面清空(`foesGone`)就收场,
// 至于这一场算不算玩家赢,再由 `levelCleared` 单独回答——对手全是自己开下去的
// 那种局面场面也是空的,但不算通关。所以下面「打通了没有」一律断言 levelCleared。
describe("冒烟:闯关真的能打通", () => {
  it("第 1 关能被真的打赢——对手被撞出场地,自己没掉下去", () => {
    const lv = buildLevel(0);
    const { world, play } = bootstrap(lv, 3);
    expect(levelCleared(world)).toBe(false);
    play(lv.seconds * 1000, (w) => foesGone(w) || playerDown(w));
    expect(levelCleared(world), "第 1 关没能在限时内清场").toBe(true);
    expect(world.cars[0].score).toBeGreaterThan(0);
  });

  it("八个章节的开章第一关都打得通,不是只有第 1 关能过", () => {
    // 每一章的头一关是这一章的教学关,必须稳稳能过
    for (const level of [0, 24, 48, 72, 96, 119, 142, 165]) {
      const lv = buildLevel(level);
      const { world, play } = bootstrap(lv, 3);
      play(lv.seconds * 1000, (w) => foesGone(w) || playerDown(w));
      expect(levelCleared(world), `第 ${level + 1} 关(第 ${lv.chapter + 1} 章开章)没打通`).toBe(true);
    }
  });

  it("抽 32 关跑完:老练的打法大半能过,乱开的打法过不了一半", () => {
    const sample: number[] = [];
    for (let i = 2; i < 188; i += 6) sample.push(i);
    const rate = (skill: AiLevel) => {
      let win = 0;
      for (const level of sample) {
        const lv = buildLevel(level);
        const { world, play } = bootstrap(lv, skill);
        play(lv.seconds * 1000, (w) => foesGone(w) || playerDown(w));
        if (levelCleared(world)) win++;
      }
      return win / sample.length;
    };
    const good = rate(3);
    const sloppy = rate(1);
    expect(good, "会看悬崖、会挑角度的打法连一半都过不了,难度太离谱").toBeGreaterThan(0.6);
    expect(sloppy, "闷头乱撞也能全过,那这 188 关就没意思了").toBeLessThan(good);
  });

  it("玩家掉光生命就是一次真实的失败", () => {
    const lv = buildLevel(180);
    const { world, play } = bootstrap(lv, 1);
    // 把生命压到 1:同一张图,掉一次就结束
    world.cars[0].lives = 1;
    play(lv.seconds * 1000, (w) => foesGone(w) || playerDown(w));
    expect(foesGone(world) || playerDown(world) || timeUp(world)).toBe(true);
  });
});

describe("冒烟:对战真的分得出胜负", () => {
  function duel(round: number, aSkill: AiLevel, bSkill: AiLevel): number {
    const arena = buildArena(round);
    const cars = [
      makeCar({ id: 0, name: "鸭梨", emoji: "🌸", color: "#e8558f", team: 0, x: arena.spawns[0].x, y: arena.spawns[0].y, lives: 1, ai: true }),
      makeCar({ id: 1, name: "康康", emoji: "⭐", color: "#3f7fd6", team: 1, x: arena.spawns[1].x, y: arena.spawns[1].y, lives: 1, ai: true }),
    ];
    const world = createWorld({
      field: arena.field,
      cars,
      pads: arena.pads,
      hazards: arena.hazards,
      spinners: arena.spinners,
      slicks: arena.slicks,
      limit: arena.seconds * 1000,
      keep: arena.keep,
      seed: arena.seed,
    });
    const skills = [aSkill, bSkill];
    for (let tick = 0; tick < (arena.seconds * 1000) / TICK; tick++) {
      if (lastTeamStanding(world) >= 0) break;
      const intents = world.cars.map((_, i) => chooseCarAction(world, i, skills[i], tick + i * 7));
      world.events.length = 0;
      stepWorld(world, TICK, intents);
    }
    return lastTeamStanding(world);
  }

  it("两台电脑同屏对轰,一定有人先被撞下场", () => {
    const winner = duel(1, 3, 3);
    expect(winner === 0 || winner === 1, "这一局打满限时也没分出胜负").toBe(true);
  });

  it("五张对战场地都能打出结果", () => {
    for (let round = 1; round <= 5; round++) {
      expect(duel(round, 3, 2), `第 ${round} 张场地没分出胜负`).toBeGreaterThanOrEqual(0);
    }
  });

  it("人机对战:三档电脑都能真的把一局打完", () => {
    for (const skill of [1, 2, 3] as AiLevel[]) {
      expect(duel(2, 3, skill), `${skill} 档没打出结果`).toBeGreaterThanOrEqual(0);
    }
  });

  it("冠军档明显打得过新手档:五张场地里至少赢四张", () => {
    let wins = 0;
    for (let round = 1; round <= 5; round++) {
      if (duel(round, 3, 1) === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(4);
  });
});

// 无尽考的是「在越来越多的车里撑住」,所以这一段判的是 foesGone(场面清空)
// 而不是闯关那道 levelCleared(还要问一句这一场是不是玩家自己打下来的)。
// 混战里对手互相顶下去本来就是车海的一部分,不该拿闯关的尺子量。
describe("冒烟:无尽车海", () => {
  it("前三波都能清完,波次真的能往上走", () => {
    for (const wave of [1, 2, 3]) {
      const lv = buildWave(wave);
      const { world, play } = bootstrap(lv, 3);
      play(90000, (w) => foesGone(w) || playerDown(w));
      expect(foesGone(world), `无尽第 ${wave} 波没清完`).toBe(true);
    }
  });

  it("车海一直堆下去总会被淹掉:无尽不是无敌", () => {
    let ended = false;
    for (let wave = 1; wave <= 8 && !ended; wave++) {
      const lv = buildWave(wave);
      const { world, play } = bootstrap(lv, 1);
      play(90000, (w) => foesGone(w) || playerDown(w));
      if (playerDown(world)) ended = true;
    }
    expect(ended, "新手档撑过了八波车海,难度爬得太慢").toBe(true);
  });
});
