import { describe, expect, it } from "vitest";
import { ARENA_W, FLOOR_Y, MAX_ROWS, SUPPORT_INSET, WALL, rowSurface, supportChain, surfaceSpan } from "./arena";
import {
  CLIMB_BEST_KEY,
  CLIMB_ROWS,
  LINE_SPEED_MAX,
  SECTION_METERS,
  bottomLine,
  buildClimbSection,
  climbGoalY,
  climbHeight,
  climbMessage,
  heightLine,
  lineSpeed,
  lineY,
  parseClimbBest,
  rowOfSurface,
  serializeClimbBest,
} from "./updraft";
import { createWorld, emptyInput, endlessScore, stepWorld, type Input, type World } from "./logic";

const SECTIONS = Array.from({ length: 10 }, (_, i) => buildClimbSection(i));

function press(over: Partial<Input> = {}): Input {
  return { ...emptyInput(), ...over };
}

function run(w: World, seconds: number, inputs: Input[] = [emptyInput()], dt = 1 / 120): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepWorld(w, dt, inputs);
}

describe("puff-bros 上升气流 · 段落生成", () => {
  it("同一段生成两次结果完全一样,越界的段号也不会崩", () => {
    for (const i of [0, 3, 9]) {
      expect(JSON.stringify(buildClimbSection(i))).toBe(JSON.stringify(buildClimbSection(i)));
    }
    expect(buildClimbSection(-4).index).toBe(0);
    expect(buildClimbSection(2.4).index).toBe(2);
  });

  it("每一段底下整条都是坑:没有地板可以赖着,只能往上爬", () => {
    for (const def of SECTIONS) {
      expect(def.kind).toBe("climb");
      expect(def.pits).toHaveLength(1);
      expect(def.pits[0].x0).toBeLessThanOrEqual(WALL);
      expect(def.pits[0].x1).toBeGreaterThanOrEqual(ARENA_W - WALL);
      expect(def.climbRow).toBeGreaterThan(0);
      expect(def.climbRow).toBeLessThanOrEqual(MAX_ROWS);
    }
  });

  it("出生点站在最低那一层的浮台上,不会一开局就掉出去", () => {
    for (const def of SECTIONS) {
      expect(def.spawns).toHaveLength(2);
      for (const s of def.spawns) {
        expect(s.surface).toBeGreaterThanOrEqual(0);
        const span = surfaceSpan(def.platforms, s.surface);
        expect(s.x).toBeGreaterThan(span.x0);
        expect(s.x).toBeLessThan(span.x1);
      }
    }
  });

  it("浮台照支撑树摆:每一层都跳得上去,也回得来", () => {
    for (const def of SECTIONS) {
      def.platforms.forEach((p, i) => {
        expect(p.parent).toBeLessThan(i);
        expect(p.y).toBe(rowSurface(p.row));
        const sup = surfaceSpan(def.platforms, p.parent);
        const mid = p.x + p.w / 2;
        expect(mid).toBeGreaterThanOrEqual(sup.x0 + SUPPORT_INSET - 1);
        expect(mid).toBeLessThanOrEqual(sup.x1 - SUPPORT_INSET + 1);
        expect(supportChain(def.platforms, i).at(-1)).toBe(-1);
      });
    }
  });

  it("每一段都至少有一根气流管和一朵弹簧云 —— 它们是这个模式的主角", () => {
    for (const def of SECTIONS) {
      const kinds = def.gadgets.map((g) => g.kind);
      expect(kinds, def.name).toContain("updraft");
      expect(kinds, def.name).toContain("spring");
    }
    // 越往上机关越多:第 6 段该有的都有了
    const late = new Set(SECTIONS[6].gadgets.map((g) => g.kind));
    expect(late.size).toBeGreaterThanOrEqual(4);
  });

  it("传送泡永远成对,而且互相认得", () => {
    for (const def of SECTIONS) {
      const warps = def.gadgets.map((g, i) => ({ g, i })).filter((e) => e.g.kind === "warp");
      expect(warps.length % 2).toBe(0);
      for (const { g, i } of warps) {
        expect(def.gadgets[g.link]?.kind).toBe("warp");
        expect(def.gadgets[g.link].link).toBe(i);
      }
    }
  });

  it("文案干净、原创,不吓唬小朋友", () => {
    for (const def of SECTIONS) {
      const text = `${def.name}${def.feature}${def.hint}`;
      for (const bad of ["笨", "蠢", "傻", "死", "血", "Bubble", "马里奥"]) {
        expect(text.includes(bad), def.name).toBe(false);
      }
      expect(def.hint.length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("puff-bros 上升气流 · 气流线与高度", () => {
  it("气流线一路往上追,段号越大追得越急,但有上限", () => {
    expect(lineSpeed(0)).toBeGreaterThan(0);
    expect(lineSpeed(5)).toBeGreaterThan(lineSpeed(0));
    expect(lineSpeed(999)).toBe(LINE_SPEED_MAX);
    expect(lineY(0, 0)).toBeGreaterThan(FLOOR_Y);
    expect(lineY(0, 10)).toBeLessThan(lineY(0, 0));
    expect(lineY(5, 10)).toBeLessThan(lineY(0, 10));
  });

  it("高度是单调的:爬得越高米数越大,一段正好 SECTION_METERS 米", () => {
    expect(climbHeight(0, 0)).toBe(0);
    expect(climbHeight(0, CLIMB_ROWS)).toBe(SECTION_METERS);
    expect(climbHeight(3, 0)).toBe(SECTION_METERS * 3);
    expect(climbHeight(1, 2)).toBeGreaterThan(climbHeight(1, 1));
    expect(climbHeight(2, 0)).toBeGreaterThan(climbHeight(1, CLIMB_ROWS - 1));
    // 离谱的入参也夹得住
    expect(climbHeight(-3, -1)).toBe(0);
    expect(climbHeight(0, 99)).toBe(SECTION_METERS);
    expect(heightLine(12)).toBe("12 米");
  });

  it("终点线与屏底线都算得出来,而且终点在屏底之上", () => {
    expect(climbGoalY()).toBe(rowSurface(CLIMB_ROWS));
    expect(climbGoalY()).toBeLessThan(bottomLine());
    expect(rowOfSurface(SECTIONS[0], -1)).toBe(0);
    expect(rowOfSurface(SECTIONS[0], 0)).toBeGreaterThan(0);
  });

  it("结算文案只鼓励,不数落", () => {
    expect(climbMessage(0, 40)).toContain("再来一趟");
    expect(climbMessage(60, 40)).toContain("最高");
    expect(climbMessage(20, 40)).toContain("40 米");
    for (const msg of [climbMessage(0, 0), climbMessage(30, 90)]) {
      for (const bad of ["笨", "输", "失败"]) expect(msg.includes(bad)).toBe(false);
    }
  });
});

describe("puff-bros 上升气流 · 玩起来", () => {
  it("爬到最高那一层就算过了这一段", () => {
    const def = buildClimbSection(0);
    const w = createWorld(def, { players: 1 });
    const top = def.platforms.findIndex((p) => p.row === def.climbRow);
    expect(top).toBeGreaterThanOrEqual(0);
    const p = w.players[0];
    p.x = def.platforms[top].x + def.platforms[top].w / 2;
    p.y = def.platforms[top].y;
    p.surface = top;
    run(w, 0.1);
    expect(w.status).toBe("won");
  });

  it("掉出屏底先打转,救不回来这一趟就结束", () => {
    const w = createWorld(buildClimbSection(0), { players: 1 });
    const p = w.players[0];
    p.y = bottomLine() + 4;
    p.onGround = false;
    p.surface = -1;
    run(w, 0.1);
    expect(p.bounds.phase).toBe("tumble");
    expect(w.status).toBe("playing");
    run(w, 2.4);
    expect(w.status).toBe("lost");
    expect(w.message.length).toBeGreaterThan(6);
  });

  it("不断上升的气流线追上来也会开始打转,催着人往上走", () => {
    const w = createWorld(buildClimbSection(0), { players: 1 });
    const p = w.players[0];
    // 赖在最低那一层不动,气流线迟早追上来
    p.y = FLOOR_Y;
    p.surface = -1;
    p.onGround = false;
    run(w, 6);
    expect(p.bounds.phase === "tumble" || w.status === "lost").toBe(true);
  });

  it("站在出生点上不会莫名其妙就掉出去", () => {
    const w = createWorld(buildClimbSection(1), { players: 1 });
    run(w, 1.5);
    expect(w.players[0].bounds.phase).toBe("in");
    expect(w.players[0].onGround).toBe(true);
  });
});

/* ---------------- 上升气流自己的纪录位 ---------------- */

/**
 * 1.2 监督修复员修的:两种无尽本来挤在平台那一个成绩位里。
 *
 * 噗噗不停记**分**(`endlessScore` 一波 40 分起,几波下来就是几百),
 * 上升气流记**米**(一段 20 米,爬得好也就几十米)。挤一格的后果有两个,
 * 都是玩家能看见的:
 *
 *  1. 分数量级压着米数,`recordEndlessBest` 又是取 max —— 孩子玩过一趟
 *     噗噗不停之后,上升气流**再也刷不出新纪录**,每趟都被判「没破纪录」;
 *  2. 上升气流那一格是按「米」念的,300 分会显示成「最好 300 米」,
 *     孩子根本没爬到过那个高度。
 *
 * 现在上升气流用本文件的 `CLIMB_BEST_KEY` 单独记一格。
 */
describe("上升气流的纪录不跟噗噗不停抢格子", () => {
  it("纪录键是本款专用的,不会和别款或平台那一格撞上", () => {
    expect(CLIMB_BEST_KEY).toContain("puff-bros");
    expect(CLIMB_BEST_KEY).toContain("climb");
  });

  it("读得回自己写出去的高度", () => {
    for (const m of [0, 1, 20, 87, 4000]) {
      expect(parseClimbBest(serializeClimbBest(m))).toBe(m);
    }
  });

  it("坏数据一律读成 0,绝不把纪录读成 NaN 或负数", () => {
    for (const bad of [null, undefined, "", "不是数字", "NaN", "-5", "abc12"]) {
      const got = parseClimbBest(bad as string | null);
      expect(Number.isFinite(got), `${String(bad)} 读出了非数字`).toBe(true);
      expect(got, `${String(bad)} 该读成 0`).toBe(0);
    }
  });

  it("写进去的一律是规整过的整数,小数和负数不会落盘", () => {
    expect(serializeClimbBest(12.7)).toBe("13");
    expect(serializeClimbBest(-9)).toBe("0");
    expect(serializeClimbBest(Number.NaN)).toBe("0");
    expect(serializeClimbBest(Number.POSITIVE_INFINITY)).toBe("0");
  });

  it("一趟几十米的好成绩,不会被几百分的波次成绩判成「没破纪录」", () => {
    // 噗噗不停那边随手一趟的量级(清 10 个 + 拿 8 颗糖 + 过 3 波)
    const waveScore = endlessScore(10, 8, 3);
    expect(waveScore).toBeGreaterThan(200);
    // 上升气流爬满四段也才这么多米
    const climbed = climbHeight(4, 0);
    expect(climbed).toBe(4 * SECTION_METERS);
    expect(climbed, "米数确实比分数小一个量级,所以更不能挤一格").toBeLessThan(waveScore);
    // 各记各的:上升气流那一格里只有米数,波次分数进不来
    expect(parseClimbBest(serializeClimbBest(climbed))).toBe(climbed);
  });
});
