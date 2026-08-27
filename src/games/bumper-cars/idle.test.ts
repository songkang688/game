/**
 * 碰碰车大乱斗 · 摆烂常驻用例(第 3 轮 S5 的回归网)。
 *
 * 第 3 轮测试员 + 补派测试员的独立驱动都抓到同一件事:**188 关里有 31 关
 * 玩家一个键都不按也能过**,含第 1 关——浏览器里摆烂 10 秒过关、三星,
 * 结算还写「撞飞 1 台对手车……走位和刹车配合得很好」,把对手自己冲下悬崖
 * 记成了玩家的战绩(`docs/qa/1.2-window3-round3-tester.md` §2.4 与附录 A、
 * `docs/qa/_evidence/window3-crosscheck-idle.json`)。
 *
 * 根因有三条,这里各钉一条常驻用例:
 *  1. 电脑车自己开下悬崖送关 —— `cliffGuard` 兜底,零输入不该再白拿过关;
 *  2. 电脑车互相顶,一台把另一台顶下去等于替玩家清场 —— `levelCleared` 现在
 *     还要问一句「有没有一台是玩家亲手顶下去的」,没有就是 `levelForfeit`;
 *  3. 结算把「自己掉下去的对手」算成玩家撞飞 —— `creditShove` 只认真的顶出去的那一下。
 *
 * 第 2 条是附录 C 追出来的残量:`cliffGuard` 落地之后 31 关降到 6 关,
 * 但其中五关(3 / 8 / 54 / 78 / 152)是**新冒出来的**,原来那份抽查名单一关都没盖到。
 * 所以这里的守门按附录 C.5 的建议改成两条一起守:**点名清单 + 总数上限**,
 * 不再用「比例 < 5%」这种会把新口子放进来的宽线。
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
  foesGone,
  levelCleared,
  levelForfeit,
  loseLine,
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

/**
 * 摆烂能过的关数上限。
 *
 * 现在实测是 0:零输入的玩家永远拿不到一台「撞飞」(`creditShove` 要求撞上去的
 * 那一刻自己正朝对方开),所以 `levelCleared` 那道闸门结构性地关死了这条路。
 * 留成常量是为了下一任改动之后一眼看得出水位线在哪 —— 它只该是 0。
 */
const IDLE_WIN_LIMIT = 0;

/**
 * 点名清单(1 基关号)。
 *
 * 两批合在一起:附录 C 量到的六关残量(3 / 8 / 54 / 78 / 152 / 153,其中 3 / 8
 * 在第一章、真机上 10~14 秒就送一颗星),外加第 3 轮原始 31 关名单里的抽查关。
 * 这份名单是死的:以后谁再动 AI 或者判定,这几关都得逐关过一遍。
 */
const NAMED_LEVELS = [1, 3, 4, 8, 11, 24, 31, 38, 52, 54, 60, 78, 84, 120, 144, 152, 153, 169, 176];

/** 附录 C 六关残量里,第一章那两关——最要紧的两关,单独点出来 */
const CHAPTER1_RESIDUAL = [3, 8];

interface IdleRun {
  world: World;
  cleared: boolean;
  /** 对手是不是全退场了(场面清空,不问是谁的功劳) */
  emptied: boolean;
  /** 场面清空了但一台都不是玩家顶的:这一关不算玩家赢 */
  forfeit: boolean;
  /** 玩家名下的「撞飞」数 */
  knocked: number;
  /** 每一次出局是记在谁头上的:-1 = 没人,0 = 玩家 */
  credits: number[];
}

/** 玩家座位全程零输入,对手照常打;跑到分出胜负或者限时用完 */
function idlePlay(level: number): IdleRun {
  const lv: CarLevel = buildLevel(level);
  const cars: Car[] = [
    makeCar({ id: 0, name: "鸭梨", emoji: "🌸", color: "#e8558f", team: 0, x: lv.spawn.x, y: lv.spawn.y, lives: lv.hearts }),
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
    // 和 index.ts 的 checkEnd 一样:场面清空(不管算不算玩家赢)或者玩家掉光就收场
    if (foesGone(world) || playerDown(world)) break;
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
  return {
    world,
    cleared: levelCleared(world),
    emptied: foesGone(world),
    forfeit: levelForfeit(world),
    knocked: world.cars[0].score,
    credits,
  };
}

describe("摆烂:玩家一个键都不按", () => {
  it("第 1 关不再是白送的:零输入既过不了关,也拿不到星", () => {
    const run = idlePlay(0);
    expect(run.cleared, "第 1 关摆烂还是能通关——AI 又在自己冲下悬崖").toBe(false);
    // 就算真被送了一关,星星也不该满上:一台都没撞飞最多 1 星
    const lv = buildLevel(0);
    expect(rateLevel(secondsLeft(run.world), lv.seconds, 0, run.knocked)).toBe(1);
  });

  it("点名清单:附录 C 的六关残量 + 第 3 轮原名单的抽查关,一关都过不去", () => {
    for (const level of NAMED_LEVELS) {
      const run = idlePlay(level - 1);
      expect(run.cleared, `第 ${level} 关摆烂还是能过`).toBe(false);
      expect(run.knocked, `第 ${level} 关:玩家没动过,却被记了 ${run.knocked} 台撞飞`).toBe(0);
    }
  }, 60000);

  it("第一章那两关(3 / 8):电脑车互相顶到清场,也只判「不算你赢」", () => {
    // 附录 C 真机复验:修前第 3 关 14 秒、第 8 关 10 秒就 1 星过关并解锁下一关。
    // 这两关的对手确实会自己清光,所以要守的不是「场面清不清得空」,
    // 而是「清空了算不算玩家赢」—— 结论必须是 forfeit,不发星也不解锁。
    for (const level of CHAPTER1_RESIDUAL) {
      const run = idlePlay(level - 1);
      expect(run.emptied, `第 ${level} 关:这一关的对手本来就是自己清光的`).toBe(true);
      expect(run.cleared, `第 ${level} 关摆烂还是白送一颗星`).toBe(false);
      expect(run.forfeit, `第 ${level} 关没走「不算你赢」这条结算`).toBe(true);
      for (const by of run.credits) {
        expect(by, `第 ${level} 关:有一台对手出局被算到了玩家头上`).not.toBe(0);
      }
      // 结算走的是 loseLine("empty"):如实说对手是自己下去的,不夸零输入的玩家
      const line = loseLine("empty");
      expect(line).not.toMatch(/撞飞 \d+ 台/);
      expect(line).not.toContain("走位和刹车");
    }
  }, 30000);

  it("总数上限:全 188 关摆烂通关压到 0 关", () => {
    // 第 3 轮实测 31/188,附录 C 修后 6/188(关号 3、8、54、78、152、153)
    const won = ALL_LEVELS.filter((i) => idlePlay(i).cleared);
    expect(
      won.length,
      `还有 ${won.length} 关摆烂能过:${won.map((i) => i + 1).join(",")}`
    ).toBeLessThanOrEqual(IDLE_WIN_LIMIT);
  }, 60000);

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
