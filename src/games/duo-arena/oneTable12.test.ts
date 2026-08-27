/**
 * 朵星擂台 · 1.2 第 3 轮:**一款游戏的「人机四档」只许有一份定义**。
 *
 * 这一款以前同时存在两张四档表:
 *  - `ai.ts/AI_SPECS`,反应 0.85 / 0.48 / 0.30 / 0.18 —— `index.ts` 走 `createBrain`,
 *    **这张真上场**;
 *  - `arena12.ts` 里另有一张手写表,反应 0.62 / 0.40 / 0.22 / 0.16 ——
 *    **只被单测读过,一次都没上过场**。
 *
 * 两张表从头到尾对不上,可写给孩子看的那句提示引的是**下面那张不上场的**:
 * 「它也要 0.22 秒才反应过来」——高手档真跑的是 0.30 秒。
 * 这句话的全部用处就是告诉孩子「抢那半拍」,数字错了就是骗人。
 *
 * 这个文件盯两件事,而且都是**只要有人再手抄一份数就会红**的那种盯法:
 *  1. `arena12.ts` 那一节的每一个数都必须能在 `AI_SPECS` 里逐字找到出处;
 *  2. 「地狱档也必须留反打窗口」这条硬规矩,必须兜在**真正在跑的 `thinkAi` 那条路上**,
 *     而不是兜在一张不上场的表里。
 */
import { describe, expect, it } from "vitest";
import {
  AI_LEVELS,
  AI_SPECS,
  MIN_COUNTER_WINDOW_S,
  createBrain,
  reactionOf,
  thinkAi,
  type AiSpec,
  type AiTargetView,
} from "./ai";
import {
  ARENA_AI_BOMB_SLIP,
  ARENA_AI_HINTS,
  ARENA_AI_LABELS,
  ARENA_AI_LEVELS,
  ARENA_AI_MIN_REACTION,
  ARENA_AI_MISS,
  ARENA_AI_REACTION,
  arenaAiName,
  type ArenaAiLevel,
} from "./arena12";

describe("四档只有一份定义:arena12 的每个数都得在 AI_SPECS 里找得到出处", () => {
  it("档号 0..3 依次对上 AI_LEVELS 的四档,顺序不许错位", () => {
    expect(ARENA_AI_LEVELS.map(arenaAiName)).toEqual([...AI_LEVELS]);
  });

  it("档号越界当普通档,不抛错也不给出 undefined", () => {
    for (const bad of [-1, 4, 99, 1.5]) {
      const name = arenaAiName(bad as ArenaAiLevel);
      expect(AI_SPECS[name], `档号 ${bad}`).toBeDefined();
    }
  });

  it("反应 / 漏点 / 误点炸弹三条线,逐档等于规格表里那一档的数", () => {
    for (const lv of ARENA_AI_LEVELS) {
      const spec = AI_SPECS[arenaAiName(lv)];
      expect(ARENA_AI_REACTION[lv], `${lv} 档反应`).toBe(spec.reactionS);
      expect(ARENA_AI_MISS[lv], `${lv} 档漏点`).toBe(spec.missRate);
      expect(ARENA_AI_BOMB_SLIP[lv], `${lv} 档误点炸弹`).toBe(spec.bombRisk);
      expect(ARENA_AI_LABELS[lv], `${lv} 档档名`).toBe(spec.label);
    }
  });

  it("上过场的那张表是 AI_SPECS —— 老的手写数字必须已经不在了", () => {
    // 1.2 之前 arena12 手写的四个反应值。它们和真上场的那张表对不上,
    // 所以只要还有任何一档等于这里的老数,就说明这一节又被人抄回去了。
    const stale = [0.62, 0.4, 0.22, 0.16];
    const live = ARENA_AI_LEVELS.map((lv) => ARENA_AI_REACTION[lv]);
    expect(live).not.toEqual(stale);
    expect(live).toEqual(AI_LEVELS.map((n) => AI_SPECS[n].reactionS));
  });

  it("写给孩子看的那句提示里的秒数,就是这一档真跑的秒数", () => {
    for (const lv of ARENA_AI_LEVELS) {
      const spec = AI_SPECS[arenaAiName(lv)];
      const hint = ARENA_AI_HINTS[lv];
      // 从这句话里把数字抠出来,和规格逐位对
      const found = hint.match(/(\d+\.\d+)\s*秒/);
      expect(found, `${lv} 档的提示里没有秒数:${hint}`).not.toBe(null);
      expect(Number((found as RegExpMatchArray)[1]), `${lv} 档提示里的秒数`).toBeCloseTo(
        spec.reactionS,
        6
      );
      // 还得真的是一句给孩子看的话,不是光秃秃一个数
      expect(hint.length).toBeGreaterThan(12);
      expect(hint).toContain(spec.blurb);
    }
  });

  it("反打窗口下限也是同一个常量,不是又抄了一份 0.15", () => {
    expect(ARENA_AI_MIN_REACTION).toBe(MIN_COUNTER_WINDOW_S);
  });
});

/** 照着某一档改一个数,别的都不动 —— 用来演「有人把下限写没了」 */
function tweak(base: AiSpec, patch: Partial<AiSpec>): AiSpec {
  return { ...base, ...patch };
}

describe("「地狱档也必须留反打窗口」这条规矩兜在真跑的那条路上", () => {
  it("reactionOf:正常档位原样返回,低于下限的一律抬到下限", () => {
    for (const name of AI_LEVELS) {
      const spec = AI_SPECS[name];
      expect(reactionOf(spec), `${spec.label}`).toBe(spec.reactionS);
      expect(reactionOf(spec)).toBeGreaterThanOrEqual(MIN_COUNTER_WINDOW_S);
    }
    expect(reactionOf(tweak(AI_SPECS.master, { reactionS: 0 }))).toBe(MIN_COUNTER_WINDOW_S);
    expect(reactionOf(tweak(AI_SPECS.master, { reactionS: -5 }))).toBe(MIN_COUNTER_WINDOW_S);
    expect(reactionOf(tweak(AI_SPECS.master, { reactionS: 0.149 }))).toBe(MIN_COUNTER_WINDOW_S);
  });

  it("有人把地狱档的反应时间写成 0,它照样不是 0 帧完美反应", () => {
    // 这一条就是以前**漏掉的那道闸**:规矩只写在一张不上场的表里,
    // 真跑的 thinkAi 直接读 spec.reactionS,写成 0 就当场变成完美反应,
    // 而且没有一条断言会红。
    const brain = createBrain("master", 1234);
    brain.spec = tweak(AI_SPECS.master, { reactionS: 0, missRate: 0 });
    const targets: AiTargetView[] = [
      { id: 1, kind: "star", x: 0.5, y: 0.5, bornAt: 0, dieAt: 9 },
    ];
    const self = { x: 0.5, y: 0.9 };

    // 目标刚冒出来的那一瞬间:下限之内它必须还「看不见」
    for (const t of [0, 0.05, 0.1, MIN_COUNTER_WINDOW_S - 0.001]) {
      const cmd = thinkAi(brain, t, self, targets, false);
      expect(cmd.grab, `t=${t} 就出手了`).toBe(false);
      expect(Math.hypot(cmd.dx, cmd.dy), `t=${t} 就动身了`).toBeCloseTo(0, 6);
    }
    // 熬过下限之后才允许动 —— 规矩是「留出窗口」,不是「永远不动」
    const after = thinkAi(brain, MIN_COUNTER_WINDOW_S + 0.02, self, targets, false);
    expect(Math.hypot(after.dx, after.dy)).toBeGreaterThan(0);
  });

  it("四档正常配置下,谁都不会比下限更快看见目标", () => {
    for (const name of AI_LEVELS) {
      const spec = AI_SPECS[name];
      const brain = createBrain(name, 77);
      const targets: AiTargetView[] = [
        { id: 1, kind: "star", x: 0.5, y: 0.5, bornAt: 0, dieAt: 9 },
      ];
      const early = thinkAi(brain, MIN_COUNTER_WINDOW_S - 0.001, { x: 0.5, y: 0.9 }, targets, false);
      expect(early.grab, `${spec.label} 在反打窗口里就出手了`).toBe(false);
      expect(Math.hypot(early.dx, early.dy), `${spec.label} 在反打窗口里就动身了`).toBeCloseTo(0, 6);
    }
  });
});
