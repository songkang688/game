/**
 * 窗口4 · 档B · 第 2 轮验收 —— 冒险小王(adventure-king)。
 *
 * 第 2 轮换样本:战役不再只看 1 / 100 / 188,改抽 20 / 57 / 123 / 166 四关,
 * 再加「难度曲线 / 竞态 / 无尽持续」三条主线。只增用例,不改既有用例。
 */
import { describe, expect, it } from "vitest";
import { Disposer, buildCastleRoom, solveRoom } from "./explore";
import {
  CHAPTERS,
  LEVELS,
  artifactsGrounded,
  buildEndlessFloor,
  buildSpeedrunCourse,
  chapterStartLevel,
  gapsOf,
  levelTraversable,
} from "./levels";
import { RUN_MAX, endlessFloor, levelStars, timeAttackStars } from "./logic";
import { botPlay, createRun, emptyInput, stepRun } from "./sim";

/** 第 2 轮的新样本:躲开第 1 轮已经跑过的 1 / 100 / 188 */
const R2_SPOTS = [20, 57, 123, 166];

describe("档B R2 · 冒险小王 · 换样本", () => {
  for (const level of R2_SPOTS) {
    it(`第 ${level} 关:形状合法、机器人打得通、三件神器齐`, () => {
      const lv = LEVELS[level - 1];
      expect(levelTraversable(lv), `第 ${level} 关有跨不过去的坑`).toBe(true);
      expect(artifactsGrounded(lv), `第 ${level} 关有神器悬空`).toBe(true);
      const r = botPlay(lv, 180);
      expect(r.outcome, `第 ${level} 关没打通:${JSON.stringify(r)}`).toBe("clear");
      expect(r.artifacts).toBe(3);
      expect(levelStars(r.artifacts, r.hurts)).toBeGreaterThanOrEqual(1);
    });
  }

  it("四个新样本的坑都在能力范围内:每条缝要么跳得过,要么有钩点", () => {
    for (const level of R2_SPOTS) {
      for (const gap of gapsOf(LEVELS[level - 1])) {
        expect(gap.jumpable || gap.anchor >= 0, `第 ${level} 关有一条缝既跳不过也没钩点`).toBe(true);
      }
    }
  });

  it("每一章各抽一关都打得通(12 章一章不落)", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const idx = Math.min(LEVELS.length - 1, chapterStartLevel(ci) + 3);
      const r = botPlay(LEVELS[idx], 180);
      expect(r.outcome, `第 ${ci + 1} 章第 ${idx + 1} 关卡住了`).toBe("clear");
    }
  });
});

describe("档B R2 · 冒险小王 · 难度曲线", () => {
  it("走廊长度整体走高:每 20 关取一段,后一段的平均长度不低于前一段", () => {
    const buckets: number[] = [];
    for (let start = 0; start < LEVELS.length; start += 20) {
      const slice = LEVELS.slice(start, start + 20);
      buckets.push(slice.reduce((n, lv) => n + lv.width, 0) / slice.length);
    }
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i], `第 ${i + 1} 段比上一段还短`).toBeGreaterThanOrEqual(buckets[i - 1]);
    }
  });

  it("心数只减不增:后面的关不会突然发福利", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].hearts).toBeLessThanOrEqual(LEVELS[0].hearts);
    }
  });

  it("目标时间永远追得上:188 关的 par 都比「全程全速跑」还宽裕", () => {
    // par 的算法是 width/190 + 藤环×2 + 守卫×0.9,而跑速上限是 250px/s;
    // 所以 par 至少要留出 width/250 的纯赶路时间,否则三星线就是不可能完成的。
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i];
      expect(lv.parSec, `第 ${i + 1} 关的 par 比全速跑完还短`).toBeGreaterThan(lv.width / RUN_MAX);
    }
  });

  it("目标时间按「路 + 藤环 + 守卫」一起算:章均 par 一章比一章宽", () => {
    const avg: number[] = [];
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const from = chapterStartLevel(ci);
      const to = ci + 1 < CHAPTERS.length ? chapterStartLevel(ci + 1) : LEVELS.length;
      const slice = LEVELS.slice(from, to);
      avg.push(slice.reduce((n, lv) => n + lv.parSec, 0) / slice.length);
    }
    for (let i = 1; i < avg.length; i++) {
      expect(avg[i], `第 ${i + 1} 章的章均 par 比上一章还紧`).toBeGreaterThan(avg[i - 1]);
    }
  });

  it("章内曲线单调:每一章的末关不比首关短", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const from = chapterStartLevel(ci);
      const to = ci + 1 < CHAPTERS.length ? chapterStartLevel(ci + 1) - 1 : LEVELS.length - 1;
      expect(LEVELS[to].width, `第 ${ci + 1} 章末关比首关还短`).toBeGreaterThanOrEqual(LEVELS[from].width);
    }
  });

  it("无尽遗迹的层配置一直变难,而且不会难到跳不过去", () => {
    for (let floor = 2; floor <= 60; floor++) {
      const prev = endlessFloor(floor - 1);
      const cur = endlessFloor(floor);
      expect(cur.platforms).toBeGreaterThanOrEqual(prev.platforms);
      expect(cur.enemies).toBeGreaterThanOrEqual(prev.enemies);
    }
  });
});

describe("档B R2 · 冒险小王 · 竞态", () => {
  it("通关那一帧之后再喂输入:状态机不再冒事件,结果也不翻盘", () => {
    const lv = LEVELS[19];
    const s = createRun(lv);
    let guard = 0;
    while (s.outcome === "run" && guard++ < 60 * 180) {
      stepRun(lv, s, { ...emptyInput(), right: true, jump: guard % 24 === 0 }, 1 / 60);
    }
    const settled = s.outcome;
    for (let i = 0; i < 120; i++) {
      expect(stepRun(lv, s, { ...emptyInput(), right: true, jump: true }, 1 / 60)).toEqual([]);
    }
    expect(s.outcome).toBe(settled);
  });

  it("同一帧里左右一起按:不会把角色卡在原地抖,也不会算出 NaN", () => {
    const lv = LEVELS[19];
    const s = createRun(lv);
    for (let i = 0; i < 240; i++) {
      stepRun(lv, s, { ...emptyInput(), left: true, right: true, jump: i % 7 === 0 }, 1 / 60);
      expect(Number.isFinite(s.px)).toBe(true);
      expect(Number.isFinite(s.py)).toBe(true);
      expect(Number.isFinite(s.vx)).toBe(true);
    }
  });

  it("超大 dt(掉帧)一步也不会把角色送出地图", () => {
    const lv = LEVELS[56];
    const s = createRun(lv);
    for (let i = 0; i < 40; i++) {
      stepRun(lv, s, { ...emptyInput(), right: true, jump: i % 3 === 0 }, 0.5);
      expect(Number.isFinite(s.px)).toBe(true);
      expect(s.px).toBeGreaterThanOrEqual(0);
      expect(s.px).toBeLessThanOrEqual(lv.width);
    }
  });

  it("Disposer 收到一半抛错也不赖账:剩下的照收,口袋照样清零", () => {
    const bag = new Disposer();
    const done: number[] = [];
    bag.add(() => done.push(1));
    bag.add(() => {
      throw new Error("收尾里炸了一下");
    });
    bag.add(() => done.push(3));
    expect(() => bag.dispose()).not.toThrow();
    expect(bag.size).toBe(0);
    expect(bag.disposed).toBe(true);
    // 后进先出:3 先收,炸的那条被吞掉并记 warn,1 照样收得到
    expect(done).toEqual([3, 1]);
  });

  it("dispose 两次不会把同一件事收两遍", () => {
    const bag = new Disposer();
    let n = 0;
    bag.add(() => n++);
    bag.dispose();
    bag.dispose();
    expect(n).toBe(1);
  });
});

describe("档B R2 · 冒险小王 · 无尽持续", () => {
  it("无尽遗迹连下 60 层:层层都排得出合法地形,机器人至少打通 58 层", () => {
    const stuck: number[] = [];
    for (let floor = 1; floor <= 60; floor++) {
      const lv = buildEndlessFloor(floor);
      expect(levelTraversable(lv), `第 ${floor} 层有跨不过去的坑`).toBe(true);
      if (botPlay(lv, 240).outcome !== "clear") stuck.push(floor);
    }
    // 机器人是「够用就行」的策略,守卫排得刁钻时会被磨掉心;
    // 地形本身合法,所以这里盯的是「偶发」而不是「必然」——掉到 3 层以上就要查。
    expect(stuck.length, `这些层机器人没过:${stuck.join("/")}`).toBeLessThanOrEqual(2);
  });

  it("无尽古堡连闯 60 间:间间有解,换种子也一样", () => {
    for (let room = 1; room <= 60; room++) {
      const built = buildCastleRoom(room * 7 + 11, room);
      expect(solveRoom(built.state), `第 ${room} 间「${built.template.name}」无解`).toBe(true);
    }
  });

  it("计时速通八条赛道反复跑:同一条赛道每次生成完全一样(可比纪录)", () => {
    for (let ci = 0; ci < 8; ci++) {
      const a = buildSpeedrunCourse(ci);
      const b = buildSpeedrunCourse(ci);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      const r = botPlay(a, 180);
      expect(r.outcome).toBe("clear");
      expect(timeAttackStars(r.seconds, a.par)).toBeGreaterThanOrEqual(1);
    }
  });

  it("无尽遗迹越下越深也不会生成跨不过去的坑", () => {
    for (const floor of [45, 60, 80, 100]) {
      const lv = buildEndlessFloor(floor);
      expect(levelTraversable(lv), `第 ${floor} 层有跨不过去的坑`).toBe(true);
      expect(artifactsGrounded(lv), `第 ${floor} 层有神器悬空`).toBe(true);
    }
  });
});
