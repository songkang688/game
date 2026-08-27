/**
 * 泡泡炸弹人 · 1.2 第 3 轮:**单测跑的电脑,必须就是上场的那个电脑**。
 *
 * 这一款的三档差别摊在 `AI_TUNING` 上,其中最要紧的一条是 `thinkMs`——
 * 隔多久才重新想一步。可到 1.2 第 3 轮之前:
 *
 *  - `AI_TUNING.thinkMs`(260 / 150 / 70)**全仓库没有一处生产代码读它**,
 *    只有 `ai12.test.ts` 断言它三档单调;
 *  - 同一组数字在 `index.ts` 的主循环里被手抄成
 *    `skill === 1 ? 260 : skill === 2 ? 150 : 70`,**抄出来的那份才是真上场的**;
 *  - 而 `ai12.test.ts` 那条「固定 seed 的胜率」回归线**每 20ms 就重想一次**,
 *    等于把三档的思考节奏整个抹平。
 *
 * 抹平之后量出来的电脑和上场的电脑不是一回事,而且差得很远(实测,12 局同一批擂台):
 *
 * | 对局 | 抹平节奏(老回归线) | 真节奏(`thinkMs`) |
 * |---|---|---|
 * | 高手 vs 轻松 | 7 - 0(5 平) | **12 - 0(0 平)** |
 * | 普通 vs 轻松 | 2 - 0(10 平) | **12 - 0(0 平)** |
 * | 高手 vs 普通 | **3 - 5,倒输** | 4 - 1(7 平) |
 *
 * 也就是说:老回归线上「高手档打不过普通档」,而真正上场的阶梯是好的。
 * 这个文件按**真节奏**重新钉一遍阶梯,并且盯住节拍器本身。
 * `ai12.test.ts` 那几条一个字没动 —— 它们量的是「不带节奏的裸决策」,那也是有用的一层。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AI_TUNING,
  chooseAiAction,
  createPacer,
  pacedAiAction,
  thinkMsFor,
  type AiLevel,
} from "./ai";
import { buildArena } from "./levels";
import {
  DIR_NONE,
  TILE_FLOOR,
  TILE_HARD,
  applyItem,
  createWorld,
  idx,
  makeBoard,
  makeFighter,
  roundWinner,
  stepWorld,
  type Intent,
} from "./logic";

const LEVELS: AiLevel[] = [1, 2, 3];
const FRAME = 20;

function parse(rows: string[]): ReturnType<typeof makeBoard> {
  const h = rows.length;
  const w = rows[0].length;
  const board = makeBoard(w, h, TILE_FLOOR);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      board.cells[idx(board, x, y)] = ch === "#" ? TILE_HARD : ch === "+" ? 2 : TILE_FLOOR;
    });
  });
  return board;
}

describe("思考节奏只有一份出处", () => {
  it("thinkMsFor 就是表里那一档,一个数都不另写", () => {
    for (const l of LEVELS) expect(thinkMsFor(l), `${l} 档`).toBe(AI_TUNING[l].thinkMs);
  });

  it("档号不认识就按普通档,不给出 undefined 也不当成最快档", () => {
    for (const bad of [0, 4, -1, 99]) {
      expect(thinkMsFor(bad as AiLevel), `档号 ${bad}`).toBe(AI_TUNING[2].thinkMs);
    }
    // 老代码那句三元表达式里,「不是 1 也不是 2」一律落到 70——
    // 也就是把不认识的档号当成高手档。现在不会了。
    expect(thinkMsFor(99 as AiLevel)).not.toBe(AI_TUNING[3].thinkMs);
  });

  it("主循环里不许再手抄一份节奏数字", () => {
    // 这一条盯的就是当初那句 `skill === 1 ? 260 : skill === 2 ? 150 : 70`:
    // 它和 `AI_TUNING` 各写各的,谁调表都不会红。现在主循环只许走节拍器。
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(src).toContain("pacedAiAction");
    for (const l of LEVELS) {
      const ms = String(AI_TUNING[l].thinkMs);
      expect(src, `index.ts 里又出现了 ${ms}`).not.toMatch(new RegExp(`skill\\s*===\\s*\\d[^\\n]*${ms}`));
    }
    expect(src).not.toMatch(/aiCooldown/);
  });

  it("三档的节奏是单调的,而且每一档都真的要隔一会儿才想一次", () => {
    expect(thinkMsFor(1)).toBeGreaterThan(thinkMsFor(2));
    expect(thinkMsFor(2)).toBeGreaterThan(thinkMsFor(3));
    // 最快的一档也得慢过一帧,不然「反应延迟」这条差别根本不存在
    expect(thinkMsFor(3)).toBeGreaterThan(FRAME);
  });
});

describe("节拍器:两次思考之间照着上一步走", () => {
  /** 一张空地,中间放一个电脑,一路推帧看它每一帧的动作 */
  function run(level: AiLevel, frames: number) {
    const board = parse(["#########", "#.......#", "#.......#", "#########"]);
    const me = makeFighter(0, "电脑", "🤖", idx(board, 2, 1), 0);
    me.ai = true;
    const world = createWorld({ board, fighters: [me] });
    const pacer = createPacer();
    const out: { fresh: boolean; dir: number; drop: boolean }[] = [];
    for (let i = 0; i < frames; i++) {
      const act = pacedAiAction(pacer, world, 0, level, FRAME, i);
      out.push({ fresh: pacer.fresh, dir: act.dir, drop: act.drop });
      stepWorld(world, FRAME, [{ dir: act.dir, drop: act.drop, detonate: act.detonate }]);
    }
    return out;
  }

  it("第一帧一定是真想一次(节拍器是冷的)", () => {
    for (const l of LEVELS) expect(run(l, 1)[0].fresh, `${l} 档`).toBe(true);
  });

  it("一秒钟里想几次,和 thinkMs 换算出来的帧数对得上", () => {
    // 冷却是一帧一帧扣的,所以真正的间隔向上取整到整帧:
    // 高手档 70ms 落在 4 帧(80ms)上,不是 3.5 帧。
    for (const l of LEVELS) {
      const every = Math.ceil(thinkMsFor(l) / FRAME);
      const total = 1000 / FRAME;
      const thinks = run(l, total).filter((f) => f.fresh).length;
      expect(thinks, `${l} 档一秒想了 ${thinks} 次`).toBe(Math.ceil(total / every));
    }
  });

  it("档位越高,同样一秒里想得越多", () => {
    const count = (l: AiLevel): number => run(l, 1000 / FRAME).filter((f) => f.fresh).length;
    expect(count(1)).toBeLessThan(count(2));
    expect(count(2)).toBeLessThan(count(3));
  });

  it("冷却那几帧只重复方向,绝不重复放泡泡", () => {
    for (const l of LEVELS) {
      const frames = run(l, 300);
      for (const f of frames) {
        if (!f.fresh) expect(f.drop, `${l} 档在冷却帧里又放了一颗`).toBe(false);
      }
    }
  });

  it("冷却帧走的就是上一次想出来的那个方向", () => {
    for (const l of LEVELS) {
      const frames = run(l, 300);
      let last = DIR_NONE;
      for (const f of frames) {
        if (f.fresh) last = f.dir;
        else expect(f.dir, `${l} 档冷却帧改了方向`).toBe(last);
      }
    }
  });

  it("dt 是 0 的那一帧不会白白吃掉一次思考", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const me = makeFighter(0, "电脑", "🤖", idx(board, 2, 1), 0);
    me.ai = true;
    const world = createWorld({ board, fighters: [me] });
    const pacer = createPacer();
    pacedAiAction(pacer, world, 0, 1, FRAME, 0); // 第一拍
    const before = pacer.cool;
    pacedAiAction(pacer, world, 0, 1, 0, 1);
    expect(pacer.fresh).toBe(false);
    expect(pacer.cool).toBe(before);
  });

  it("真想的那一帧,给出来的动作和裸决策一模一样", () => {
    // 节拍器只管「问不问」,不许改「问出来是什么」
    const board = parse(["#########", "#.......#", "#..+....#", "#########"]);
    const me = makeFighter(0, "电脑", "🤖", idx(board, 2, 1), 0);
    me.ai = true;
    const world = createWorld({ board, fighters: [me] });
    const pacer = createPacer();
    const paced = pacedAiAction(pacer, world, 0, 3, FRAME, 7);
    const bare = chooseAiAction(world, 0, 3, 7);
    expect(paced).toEqual(bare);
  });
});

/**
 * 按**真节奏**打一局人机对轰,返回赢家座位(-1 打平)。
 * 和 `ai12.test.ts` 那个 `playDuel` 唯一的区别就是这里过节拍器 —— 而这正是重点。
 */
function pacedDuel(round: number, skills: [AiLevel, AiLevel]): number {
  const lv = buildArena(round, 2);
  const fighters = skills.map((_, i) => {
    const f = makeFighter(i, `p${i}`, "🤖", lv.spawns[i] ?? lv.spawns[0], i);
    f.ai = true;
    for (const item of lv.starters) applyItem(f, item);
    return f;
  });
  const world = createWorld({
    board: lv.board,
    fighters,
    critters: [],
    hidden: new Map(lv.hidden),
    goal: lv.goal,
    pierce: lv.pierce,
    limit: lv.seconds * 1000,
    seed: lv.seed,
    richness: lv.richness,
    pool: lv.pool,
  });
  const pacers = skills.map(() => createPacer());
  let tick = 0;
  const ms = lv.seconds * 1000;
  for (let t = 0; t < ms; t += FRAME) {
    if (roundWinner(world) >= 0) break;
    const intents: Intent[] = skills.map((skill, i) => {
      const act = pacedAiAction(pacers[i], world, i, skill, FRAME, tick + i);
      return { dir: act.dir, drop: act.drop, detonate: act.detonate };
    });
    tick++;
    stepWorld(world, FRAME, intents);
  }
  return roundWinner(world);
}

describe("按真节奏跑的阶梯", () => {
  const ROUNDS = 6;
  const played = new Map<string, number>();

  function duel(round: number, skills: [AiLevel, AiLevel]): number {
    const key = `${round}|${skills[0]}|${skills[1]}`;
    const hit = played.get(key);
    if (hit !== undefined) return hit;
    const out = pacedDuel(round, skills);
    played.set(key, out);
    return out;
  }

  /** 六张擂台、两个座位各打一遍(共 12 局);全程无随机数,成绩单是死的 */
  function tally(a: AiLevel, b: AiLevel): { a: number; b: number; draw: number } {
    const out = { a: 0, b: 0, draw: 0 };
    for (let round = 1; round <= ROUNDS; round++) {
      for (const swap of [false, true]) {
        const w = duel(round, swap ? [b, a] : [a, b]);
        const seatOfA = swap ? 1 : 0;
        if (w < 0) out.draw++;
        else if (w === seatOfA) out.a++;
        else out.b++;
      }
    }
    return out;
  }

  it("高手档打轻松档:十二局全赢,一局都不平", () => {
    const r = tally(3, 1);
    expect(r.b, `轻松档赢了高手档 ${r.b} 局`).toBe(0);
    expect(r.a, `高手档只赢了 ${r.a} / 12 局`).toBe(12);
  }, 60000);

  it("普通档打轻松档:同样一局不输", () => {
    const r = tally(2, 1);
    expect(r.b, `轻松档赢了普通档 ${r.b} 局`).toBe(0);
    expect(r.a).toBeGreaterThan(ROUNDS);
  }, 60000);

  it("高手档稳压普通档 —— 抹平节奏的那条线上它是倒输的(3 比 5)", () => {
    const r = tally(3, 2);
    expect(r.a, `高手档只赢 ${r.a},普通档赢 ${r.b}`).toBeGreaterThan(r.b);
  }, 60000);

  it("节奏就是这一款拉开档次的主要手段:抹平之后阶梯会塌", () => {
    // 反过来钉一条:如果哪天有人把三档的 thinkMs 调成一样,
    // 这一款的三档就只剩「捡道具跑多远」和高手档那三个开关了。
    // 这条断言不许它悄悄发生。
    const gaps = [thinkMsFor(1) - thinkMsFor(2), thinkMsFor(2) - thinkMsFor(3)];
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(FRAME * 2);
  });

  it("同一场打两遍结果一模一样:节拍器没有引入随机", () => {
    for (let round = 1; round <= 3; round++) {
      expect(pacedDuel(round, [3, 1])).toBe(pacedDuel(round, [3, 1]));
      expect(pacedDuel(round, [2, 1])).toBe(pacedDuel(round, [2, 1]));
    }
  }, 60000);
});
