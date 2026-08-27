/**
 * 1.2 第 15 步 A 档:电脑玩家的新账(规格第六节)。
 *
 * 老的 `ai.test.ts` 已经把「不会把自己包住」这条钉死了,这里补 1.2 新要的三件:
 *  1. **三档真的有差别**,而且差别摊在一张表上,不是靠冷却时间糊弄过去;
 *  2. **放泡后一定走得到安全格**——起步冷却也算进 BFS 里(2 秒引信下,
 *     少算这半步就是「以为跑得掉,其实差一格」);
 *  3. **固定 seed 的胜率断言**:同一批擂台、同一套种子打下来,高档赢得比低档多。
 *
 * 胜率这条用的是完全确定性的推进(固定 tick、固定 20ms 步长),
 * 所以它是一条可复现的回归线,不是碰运气的抽样。
 */
import { describe, expect, it } from "vitest";
import {
  AI_LABEL,
  AI_TUNING,
  canEscapeFrom,
  chooseAiAction,
  escapeAfterBomb,
  foeEscapeCount,
  predictFoeCells,
  type AiLevel,
} from "./ai";
import { buildArena, buildTowerFloor } from "./levels";
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
  type World,
} from "./logic";

const LEVELS: AiLevel[] = [1, 2, 3];

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

/**
 * 一局人机对轰的结果(赢家座位号,-1 是打平)。
 *
 * 完全确定性:没有随机数,同样的输入永远同样的结果——所以算过的局直接记下来,
 * 后面几条断言复用同一批战绩,整个文件只跑一遍真实对局。
 */
const played = new Map<string, number>();

function duel(round: number, skills: [AiLevel, AiLevel]): number {
  const key = `${round}|${skills[0]}|${skills[1]}`;
  const hit = played.get(key);
  if (hit !== undefined) return hit;
  const out = playDuel(round, skills);
  played.set(key, out);
  return out;
}

function playDuel(round: number, skills: [AiLevel, AiLevel]): number {
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
  let tick = 0;
  // 擂台自带 120 秒限时,跑满就是打平,再往后推没有意义
  const ms = lv.seconds * 1000;
  for (let t = 0; t < ms; t += 20) {
    if (roundWinner(world) >= 0) break;
    const intents: Intent[] = skills.map((skill, i) => {
      const act = chooseAiAction(world, i, skill, tick + i);
      return { dir: act.dir, drop: act.drop, detonate: act.detonate };
    });
    tick++;
    stepWorld(world, 20, intents);
  }
  return roundWinner(world);
}

describe("三档电脑的差别摊在一张表上", () => {
  it("每一档都有名字,而且三个名字互不相同", () => {
    const names = LEVELS.map((l) => AI_LABEL[l]);
    expect(new Set(names).size).toBe(3);
    for (const n of names) expect(n.length).toBeGreaterThan(1);
  });

  it("想得越快、看得越远:三档的两条数值线都是单调的", () => {
    expect(AI_TUNING[1].thinkMs).toBeGreaterThan(AI_TUNING[2].thinkMs);
    expect(AI_TUNING[2].thinkMs).toBeGreaterThan(AI_TUNING[3].thinkMs);
    expect(AI_TUNING[1].itemReach).toBeLessThan(AI_TUNING[2].itemReach);
    expect(AI_TUNING[2].itemReach).toBeLessThan(AI_TUNING[3].itemReach);
  });

  it("埋伏、预判、封路是高手档独有的三件本事", () => {
    for (const flag of ["hunt", "predict", "cutoff"] as const) {
      expect(AI_TUNING[1][flag], flag).toBe(false);
      expect(AI_TUNING[2][flag], flag).toBe(false);
      expect(AI_TUNING[3][flag], flag).toBe(true);
    }
  });

  it("三档都会挪位置放泡泡——「简单」不等于「站着不动一颗都放不出来」", () => {
    for (const l of LEVELS) expect(AI_TUNING[l].reposition, `${l} 档`).toBe(true);
  });

  it("轻松档不埋伏人:对面就站在射程里也不为了他专门放一颗", () => {
    // 两排空地,两个人在上排隔两格面对面;场上没有小怪也没有砖,
    // 所以「放不放这一颗」唯一的理由就是埋伏对手。下排留着当退路,
    // 免得高手档因为跑不掉而不放——那样就测不出档位差别了。
    const board = parse(["#########", "#.......#", "#.......#", "#########"]);
    const me = makeFighter(0, "电脑", "🤖", idx(board, 3, 1), 0);
    me.ai = true;
    me.power = 4;
    const foe = makeFighter(1, "朵朵", "🌸", idx(board, 5, 1), 1);
    const world = createWorld({ board, fighters: [me, foe] });
    expect(chooseAiAction(world, 0, 1, 1).drop).toBe(false);
    expect(chooseAiAction(world, 0, 2, 1).drop).toBe(false);
    const top = chooseAiAction(world, 0, 3, 1);
    expect(top.drop).toBe(true);
    expect(top.why).toMatch(/对手/);
  });
});

describe("放泡之前先想好退路(BFS 自保)", () => {
  it("canEscapeFrom:波纹够不到的地方就退得开,整条走廊都被盖住就退不开", () => {
    // 一条九格长的独木桥:两头是墙,没有岔路
    const board = parse(["###########", "#.........#", "###########"]);
    const f = makeFighter(0, "电脑", "🤖", idx(board, 1, 1), 0);
    const world = createWorld({ board, fighters: [f] });
    // 波纹只有一格长:往右走两步就出圈了
    f.power = 1;
    expect(canEscapeFrom(world, f, idx(board, 1, 1))).toBe(true);
    // 波纹长到把整条走廊铺满:这一颗放下去哪儿都不干净,不许放
    f.power = 9;
    expect(canEscapeFrom(world, f, idx(board, 1, 1))).toBe(false);
  });

  it("逃生路线算上了起步冷却:走格冷却没走完的那一截会让路程更贵", () => {
    const board = parse(["#########", "#.......#", "#.......#", "#########"]);
    const f = makeFighter(0, "电脑", "🤖", idx(board, 4, 1), 0);
    f.power = 3;
    const world = createWorld({ board, fighters: [f] });
    f.moveT = 0;
    const fresh = escapeAfterBomb(world, f);
    f.moveT = 220;
    const stalled = escapeAfterBomb(world, f);
    expect(fresh).not.toBe(null);
    // 要么两次都跑得掉但带冷却那次更贵,要么带冷却那次干脆判跑不掉;
    // 唯一不许出现的是「带着冷却反而更宽裕」
    if (stalled) expect(stalled.cost).toBeGreaterThan((fresh as { cost: number }).cost);
    else expect(stalled).toBe(null);
  });

  it("三档电脑放下泡泡的每一刻,都真的存在一条走得出去的路", () => {
    for (const skill of LEVELS) {
      const lv = buildTowerFloor(4);
      const f = makeFighter(0, "电脑", "🤖", lv.spawns[0], 0);
      f.ai = true;
      // 场上不放小怪:这一条只问「会不会被**自己的**泡泡罩住」,
      // 被追追怪贴脸罩住是另一回事(那是玩法,不是 bug)。
      const world = createWorld({
        board: lv.board,
        fighters: [f],
        critters: [],
        hidden: new Map(lv.hidden),
        goal: "clear",
        seed: lv.seed,
        richness: lv.richness,
        pool: lv.pool,
      });
      let drops = 0;
      for (let t = 0, tick = 0; t < 60000; t += 20, tick++) {
        const act = chooseAiAction(world, 0, skill, tick);
        if (act.drop) {
          // 决定放的这一刻,BFS 必须给得出一条退路
          expect(escapeAfterBomb(world, f), `${skill} 档放泡时没有退路`).not.toBe(null);
          drops++;
        }
        stepWorld(world, 20, [{ dir: act.dir, drop: act.drop, detonate: act.detonate }]);
      }
      expect(drops, `${skill} 档一分钟一颗泡泡都没放`).toBeGreaterThan(0);
      expect(f.bubbled, `${skill} 档把自己包住了`).toBe(0);
    }
  });

  it("预判:高手档看得到对手两步之内能去的格子", () => {
    const board = parse(["#####", "#...#", "#...#", "#####"]);
    const world = createWorld({ board, fighters: [] });
    const cells = predictFoeCells(world, idx(board, 2, 1), 2);
    expect(cells).toContain(idx(board, 1, 1));
    expect(cells).toContain(idx(board, 3, 1));
    expect(cells).toContain(idx(board, 2, 2));
    // 墙外面的格子不会被算进来
    expect(cells).not.toContain(idx(board, 0, 1));
  });

  it("封路:对手退路越少,foeEscapeCount 给的数越小", () => {
    // 对手蹲在一条一格宽的死胡同里,只有一个出口
    const tight = parse(["#####", "#.#.#", "#...#", "#####"]);
    const world = createWorld({ board: tight, fighters: [] });
    const trapped = foeEscapeCount(world, idx(tight, 2, 2), 3, idx(tight, 3, 1));
    // 同一张图上换到开阔处,退路明显更多
    const open = foeEscapeCount(world, idx(tight, 1, 2), 1, idx(tight, 3, 2));
    expect(trapped).toBeLessThan(open);
  });
});

describe("固定 seed 的胜率", () => {
  const ROUNDS = 6;

  /**
   * 六张擂台、两个座位各打一遍(共 12 局),数一数各赢了几局。
   *
   * 为什么两个座位都要打:擂台是中心对称的,但两个人的思考 tick 差 1,
   * 只坐一边的话赢面里会掺进「先手」的便宜。换边再打一遍才是干净的对比。
   * 全程没有随机数,同一份代码永远给同一张成绩单。
   */
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

  it("高手档打轻松档:赢一大半,而且一局都没输过", () => {
    const r = tally(3, 1);
    expect(r.b, `轻松档居然赢了高手档 ${r.b} 局`).toBe(0);
    expect(r.a, `高手档只赢了 ${r.a} / ${ROUNDS * 2} 局`).toBeGreaterThan(ROUNDS);
  }, 30000);

  it("普通档打轻松档:同样一局没输,只是拉不开那么大差距", () => {
    const r = tally(2, 1);
    expect(r.b).toBe(0);
    expect(r.a).toBeGreaterThan(0);
  }, 30000);

  it("档位越高赢面越大:高手档对轻松档的战绩好过普通档对轻松档", () => {
    expect(tally(3, 1).a).toBeGreaterThan(tally(2, 1).a);
  }, 30000);

  it("高手档对普通档势均力敌——两档都过得了自保这道闸,差的是反应快慢", () => {
    const r = tally(3, 2);
    expect(r.a + r.b, "两档打了十二局一局都没分出胜负").toBeGreaterThan(4);
    expect(Math.abs(r.a - r.b), `差距太大:${r.a} 比 ${r.b}`).toBeLessThanOrEqual(4);
  }, 30000);

  it("同一场打两遍结果一模一样:胜负是可复现的,不是碰运气", () => {
    // 绕过缓存直接再打一遍,确认两次真的一模一样
    for (let round = 1; round <= 3; round++) {
      expect(playDuel(round, [3, 1])).toBe(playDuel(round, [3, 1]));
    }
  }, 30000);
});

describe("被罩住的时候什么都不做", () => {
  it("泡泡里的电脑既不走也不放泡", () => {
    const board = parse(["#####", "#...#", "#####"]);
    const f = makeFighter(0, "电脑", "🤖", idx(board, 2, 1), 0);
    f.ai = true;
    f.bubbleT = 1200;
    const world = createWorld({ board, fighters: [f] });
    for (const skill of LEVELS) {
      const act = chooseAiAction(world, 0, skill, 0);
      expect(act.dir).toBe(DIR_NONE);
      expect(act.drop).toBe(false);
    }
  });
});
