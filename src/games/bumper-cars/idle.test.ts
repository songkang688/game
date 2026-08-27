/**
 * 碰碰车大乱斗 · 摆烂常驻用例(第 3 轮 S5 的回归网)。
 *
 * 第 3 轮测试员 + 补派测试员的独立驱动都抓到同一件事:**188 关里有 31 关
 * 玩家一个键都不按也能过**,含第 1 关——浏览器里摆烂 10 秒过关、三星,
 * 结算还写「撞飞 1 台对手车……走位和刹车配合得很好」,把对手自己冲下悬崖
 * 记成了玩家的战绩(`docs/qa/1.2-window3-round3-tester.md` §2.4 与附录 A、
 * `docs/qa/_evidence/window3-crosscheck-idle.json`)。
 *
 * 根因有两条,这里各钉一条常驻用例:
 *  1. 电脑车自己开下悬崖送关 —— `cliffGuard` 兜底,零输入不该再白拿过关;
 *  2. 结算把「自己掉下去的对手」算成玩家撞飞 —— `creditShove` 只认真的顶出去的那一下。
 *
 * 这里跑的是和 `index.ts` 一模一样的那套推进函数,玩家座位全程喂 `IDLE`,
 * 对手照常由 AI 驱动 —— 也就是「把手机放桌上不管」的真实模型。
 */
import { describe, expect, it } from "vitest";
import { chooseCarAction, huntersFor, type AiLevel } from "./ai";
import { ALL_LEVELS, buildLevel, type CarLevel } from "./levels";
import {
  IDLE,
  createWorld,
  levelCleared,
  makeCar,
  playerDown,
  rateLevel,
  secondsLeft,
  stepWorld,
  winLine,
  type Car,
  type World,
} from "./logic";

const TICK = 16;

interface IdleRun {
  world: World;
  cleared: boolean;
  /** 玩家名下的「撞飞」数 */
  knocked: number;
  /** 每一次出局是记在谁头上的:-1 = 没人,0 = 玩家 */
  credits: number[];
}

/** 玩家座位全程零输入,对手照常打;跑到分出胜负或者限时用完 */
function idlePlay(level: number): IdleRun {
  const lv: CarLevel = buildLevel(level);
  const cars: Car[] = [
    makeCar({ id: 0, name: "朵朵", emoji: "🌸", color: "#e8558f", team: 0, x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts }),
    ...lv.foes.map((foe, i) => {
      const spot = lv.foeSpawns[i] ?? lv.foeSpawns[0] ?? lv.spawn;
      return makeCar({
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
      });
    }),
  ];
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
  const skills: AiLevel[] = [1, ...lv.foes.map((f) => f.skill)];
  const credits: number[] = [];
  let tick = 0;
  for (let ms = 0; ms < lv.seconds * 1000; ms += TICK) {
    if (levelCleared(world) || playerDown(world)) break;
    const hunters = huntersFor(world, lv.hunters, world.time);
    const intents = world.cars.map((_, i) =>
      i === 0 ? IDLE : chooseCarAction(world, i, skills[i] ?? 2, tick + i * 7, hunters.has(i) ? "hunt" : "patrol")
    );
    tick++;
    world.events.length = 0;
    stepWorld(world, TICK, intents);
    for (const e of world.events) {
      if (e.kind === "out" && world.cars[e.who].team !== 0) credits.push(e.by);
    }
  }
  return { world, cleared: levelCleared(world), knocked: world.cars[0].score, credits };
}

describe("摆烂:玩家一个键都不按", () => {
  it("第 1 关不再是白送的:零输入既过不了关,也拿不到星", () => {
    const run = idlePlay(0);
    expect(run.cleared, "第 1 关摆烂还是能通关——AI 又在自己冲下悬崖").toBe(false);
    // 就算真被送了一关,星星也不该满上:一台都没撞飞最多 1 星
    const lv = buildLevel(0);
    expect(rateLevel(secondsLeft(run.world), lv.seconds, 0, run.knocked)).toBe(1);
  });

  it("第 3 轮点名的那批关:零输入通关的比例压到 5% 以下", () => {
    // 第 3 轮实测 31/188(16.5%),关号见 docs/qa/_evidence/window3-round3-idle.json
    const won = ALL_LEVELS.filter((i) => idlePlay(i).cleared);
    expect(won.length / ALL_LEVELS.length, `还有 ${won.length} 关摆烂能过:${won.map((i) => i + 1).join(",")}`).toBeLessThan(
      0.05
    );
  }, 60000);

  it("原来那 31 关里,抽查的这几关现在都过不去", () => {
    // 取自第 3 轮报告的 autoWin 名单(1 基),覆盖到八章里的六章
    for (const level of [1, 4, 11, 24, 31, 38, 52, 60, 84, 120, 144, 169, 176]) {
      expect(idlePlay(level - 1).cleared, `第 ${level} 关摆烂还是能过`).toBe(false);
    }
  }, 30000);

  it("对手自己掉下去不算玩家撞飞:归因字段与结算文案都不许张冠李戴", () => {
    for (const level of [0, 3, 10, 59]) {
      const run = idlePlay(level);
      expect(run.knocked, `第 ${level + 1} 关:玩家没动过,却被记了 ${run.knocked} 台撞飞`).toBe(0);
      for (const by of run.credits) {
        expect(by, `第 ${level + 1} 关:有一台对手出局被算到了玩家头上`).not.toBe(0);
      }
      const line = winLine(secondsLeft(run.world), run.world.cars[0].falls, run.knocked);
      expect(line).not.toMatch(/撞飞 \d+ 台/);
      expect(line).not.toContain("走位和刹车");
    }
  });
});
