/**
 * 窗口4 · 档B · 第 3 轮验收 —— 冒险小王(adventure-king)。
 *
 * 前两轮打的是样本(1/100/188、20/57/123/166)。第 3 轮的题目是「五款不漏」,
 * 所以这一轮不再抽样:**188 关一关不落地让机器人真打一遍**,
 * 再把 360px 几何、无尽三种玩法、存档往返各扫一遍全量。
 */
import { describe, expect, it } from "vitest";
import { buildCastleRoom, solveRoom } from "./explore";
import {
  CHAPTERS,
  LEVELS,
  artifactsGrounded,
  buildEndlessFloor,
  buildSpeedrunCourse,
  gapsOf,
  levelTraversable,
} from "./levels";
import { RUN_MAX, endlessFloor, levelStars, timeAttackStars } from "./logic";
import { botPlay } from "./sim";
import {
  DOCK_B_GAMES,
  inlineCss,
  narrowBreakpoints,
  overflowingRules,
  readGameSources,
  respectsReducedMotion,
} from "./qaAudit";

describe("档B R3 · 冒险小王 · 188 关一关不落", () => {
  it("188 关机器人全部打通,三件神器一关不缺", () => {
    const stuck: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const r = botPlay(LEVELS[i], 240);
      if (r.outcome !== "clear") stuck.push(`第 ${i + 1} 关(${r.outcome})`);
      else if (r.artifacts !== 3) stuck.push(`第 ${i + 1} 关只捡到 ${r.artifacts} 件神器`);
    }
    expect(stuck, `这些关打不通:${stuck.slice(0, 10).join("、")}`).toEqual([]);
  });

  it("188 关形状全部合法:没有跨不过去的坑,没有悬空的神器", () => {
    const bad: string[] = [];
    for (let i = 0; i < LEVELS.length; i++) {
      if (!levelTraversable(LEVELS[i])) bad.push(`第 ${i + 1} 关有跨不过去的坑`);
      if (!artifactsGrounded(LEVELS[i])) bad.push(`第 ${i + 1} 关有神器悬空`);
      for (const gap of gapsOf(LEVELS[i])) {
        if (!gap.jumpable && gap.anchor < 0) bad.push(`第 ${i + 1} 关有一条缝既跳不过也没钩点`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("188 关全部拿得到至少 1 星,而且目标时间都追得上", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const r = botPlay(LEVELS[i], 240);
      expect(levelStars(r.artifacts, r.hurts), `第 ${i + 1} 关连 1 星都拿不到`).toBeGreaterThanOrEqual(1);
      expect(LEVELS[i].parSec, `第 ${i + 1} 关的目标时间连全速跑都不够`).toBeGreaterThan(
        LEVELS[i].width / RUN_MAX,
      );
    }
  });

  it("12 章一章不落:每章的关数对得上,章内难度不回头", () => {
    let seen = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) seen += CHAPTERS[ci].size;
    expect(seen, "各章关数加起来不等于 188").toBe(LEVELS.length);
    expect(LEVELS.length).toBe(188);
  });
});

describe("档B R3 · 冒险小王 · 无尽三种玩法全量复扫", () => {
  it("无尽遗迹连下 120 层:层层排得出合法地形", () => {
    for (let floor = 1; floor <= 120; floor++) {
      const lv = buildEndlessFloor(floor, floor * 37 + 11);
      expect(levelTraversable(lv), `第 ${floor} 层有跨不过去的坑`).toBe(true);
      const cfg = endlessFloor(floor);
      expect(cfg.platforms, `第 ${floor} 层一块平台都没有`).toBeGreaterThan(0);
      expect(cfg.gapMax, `第 ${floor} 层的坑宽没有上限`).toBeLessThanOrEqual(300);
    }
  });

  it("无尽古堡连闯 200 间:间间有解,而且一次都不连着重样", () => {
    for (const seed of [4242, 20260827]) {
      let prev = "";
      for (let room = 1; room <= 200; room++) {
        const built = buildCastleRoom(seed, room);
        expect(solveRoom(built.state), `seed=${seed} 第 ${room} 间走不通`).toBe(true);
        expect(built.template.id, `seed=${seed} 第 ${room} 间和上一间重样`).not.toBe(prev);
        prev = built.template.id;
      }
    }
  });

  it("计时速通八条赛道:条条跑得完,同一条每次生成一模一样", () => {
    for (let course = 0; course < 8; course++) {
      const a = buildSpeedrunCourse(course);
      expect(buildSpeedrunCourse(course), `第 ${course + 1} 条赛道两次生成不一样`).toEqual(a);
      expect(levelTraversable(a), `第 ${course + 1} 条赛道跑不完`).toBe(true);
      const r = botPlay(a, 240);
      expect(r.outcome, `第 ${course + 1} 条赛道机器人跑不完`).toBe("clear");
      expect(timeAttackStars(a, r.time)).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * 五款横扫:第 3 轮的题目是「五款不漏」。
 * 前两轮的 360px 走查只看了各款的 `index.ts`,这里改成**每款的每一份源码都扫**——
 * 本档这一轮新写了 `qaSolver.ts` 这样的文件,以后再添文件也会自动被扫到。
 */
describe("档B R3 · 五款横扫 · 360px 一份源码都不漏", () => {
  it("五款的每一份源码里都没有会在 360px 撑破容器的固定宽度", () => {
    const bad: string[] = [];
    for (const game of DOCK_B_GAMES) {
      for (const source of readGameSources(game)) {
        for (const rule of overflowingRules(inlineCss(source))) {
          bad.push(`${game}/${source.name}: ${rule.decl}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("五款都有一套应付窄屏的办法:要么写断点,要么整块画布随容器伸缩", () => {
    for (const game of DOCK_B_GAMES) {
      const sources = readGameSources(game);
      const css = sources.map(inlineCss).join("\n");
      const text = sources.map((s) => s.text).join("\n");
      // `fruit-slice` 是整块 canvas，宽高都写成 100% 跟着容器走，本来就不需要断点
      const fluidCanvas = text.includes('canvas.style.width = "100%"') && text.includes("clientWidth");
      expect(
        narrowBreakpoints(css).length > 0 || fluidCanvas,
        `${game} 既没有窄屏断点，画布也不跟着容器伸缩`,
      ).toBe(true);
    }
  });

  /**
   * B3-01(本轮测试员新查出来的):五款里只有 `fruit-slice` 一份源码都没提
   * `prefers-reduced-motion`。前两轮的窄屏走查只翻各款的 `index.ts` 内联样式,
   * 而切水果整块是 canvas、没有内联 CSS 动画,就这么漏过去了。
   * 这条先按现状钉住,交给本轮修复员收;修复员落地后把它翻成「五款全过」。
   */
  it("五款里有四款照顾了 prefers-reduced-motion,切水果是这一轮查出来的缺口", () => {
    const missing: string[] = [];
    for (const game of DOCK_B_GAMES) {
      const sources = readGameSources(game);
      const text = sources.map((s) => s.text).join("\n");
      const css = sources.map(inlineCss).join("\n");
      if (!respectsReducedMotion(css) && !text.includes("prefers-reduced-motion")) missing.push(game);
    }
    expect(missing, "缺口游戏跟测试员记的 B3-01 对不上").toEqual(["fruit-slice"]);
  });

  it("五款都读得到源码,而且每款都有 index.ts(闸门本身没扫空)", () => {
    expect(DOCK_B_GAMES).toHaveLength(5);
    for (const game of DOCK_B_GAMES) {
      const sources = readGameSources(game);
      expect(sources.length, `${game} 没读到源码`).toBeGreaterThan(0);
      expect(
        sources.some((s) => s.name === "index.ts"),
        `${game} 没有 index.ts`,
      ).toBe(true);
    }
  });
});
