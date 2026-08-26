import { describe, expect, it } from "vitest";
import {
  AI_LEVELS,
  AI_SPECS,
  MIN_COUNTER_WINDOW_S,
  aiSpec,
  aiStrength,
  createBrain,
  duelWinner,
  simulateAiScore,
  thinkAi,
  tierForStreak,
  winRate,
} from "./ai";
import { type AiTargetView } from "./ai";
import { buildRoundSchedule } from "./logic";

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i * 37);
const scheduleFor = (seed: number) => buildRoundSchedule(seed, 2);

describe("人机四档数据表", () => {
  it("正好四档,档名与说明都填齐", () => {
    expect(AI_LEVELS).toEqual(["rookie", "normal", "pro", "master"]);
    for (const level of AI_LEVELS) {
      const s = AI_SPECS[level];
      expect(s.level).toBe(level);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.blurb.length).toBeGreaterThan(8);
    }
  });

  it("档位越高:反应更快、跑得更快、失手更少", () => {
    for (let i = 1; i < AI_LEVELS.length; i++) {
      const low = AI_SPECS[AI_LEVELS[i - 1]];
      const high = AI_SPECS[AI_LEVELS[i]];
      expect(high.reactionS, `${high.label} 反应应快于 ${low.label}`).toBeLessThan(low.reactionS);
      expect(high.speed).toBeGreaterThan(low.speed);
      expect(high.missRate).toBeLessThan(low.missRate);
      expect(high.bombRisk).toBeLessThanOrEqual(low.bombRisk);
      expect(aiStrength(high)).toBeGreaterThan(aiStrength(low));
    }
  });

  it("地狱档也不是 0 帧完美反应,永远留着可反打的窗口", () => {
    const boss = AI_SPECS.master;
    expect(boss.reactionS).toBeGreaterThanOrEqual(MIN_COUNTER_WINDOW_S);
    expect(boss.counterWindowS).toBeGreaterThanOrEqual(MIN_COUNTER_WINDOW_S);
    expect(boss.missRate).toBeGreaterThan(0);
    for (const level of AI_LEVELS) {
      const s = AI_SPECS[level];
      expect(s.counterWindowS, `${s.label} 没有反打窗口`).toBeGreaterThan(0);
      expect(s.counterWindowS).toBeCloseTo(s.reactionS, 6);
    }
  });

  it("不认识的档位兜底成普通,不会崩", () => {
    expect(aiSpec("normal")).toBe(AI_SPECS.normal);
    expect(aiSpec("nope" as never)).toBe(AI_SPECS.normal);
  });

  it("守擂一场换一档,守到第五场之后一直是地狱", () => {
    expect(tierForStreak(1)).toBe("rookie");
    expect(tierForStreak(2)).toBe("normal");
    expect(tierForStreak(3)).toBe("pro");
    expect(tierForStreak(4)).toBe("master");
    expect(tierForStreak(9)).toBe("master");
    expect(tierForStreak(0)).toBe("rookie");
  });
});

describe("固定 seed 自我对弈", () => {
  it("同 seed 同表结果完全可复现", () => {
    const sched = scheduleFor(4242);
    expect(simulateAiScore("pro", 7, sched)).toBe(simulateAiScore("pro", 7, sched));
  });

  it("20 局总分随档位单调上升", () => {
    const totals = AI_LEVELS.map((level) =>
      SEEDS.reduce((sum, seed) => sum + simulateAiScore(level, seed, scheduleFor(seed)), 0),
    );
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i], `${AI_LEVELS[i]} 总分应高于 ${AI_LEVELS[i - 1]}`).toBeGreaterThan(totals[i - 1]);
    }
  });

  it("相邻两档对下 20 局,高的一档胜率明显占优", () => {
    for (let i = 1; i < AI_LEVELS.length; i++) {
      const rate = winRate(AI_LEVELS[i], AI_LEVELS[i - 1], SEEDS, scheduleFor);
      expect(rate, `${AI_LEVELS[i]} 打不过 ${AI_LEVELS[i - 1]}`).toBeGreaterThan(0.6);
    }
  });

  it("菜鸟对地狱赢面很小,但不是零(还是有翻盘余地)", () => {
    const rate = winRate("rookie", "master", SEEDS, scheduleFor);
    expect(rate).toBeLessThan(0.2);
  });

  it("同档对同档没有系统性的座位优势", () => {
    const seeds = Array.from({ length: 60 }, (_, i) => 20 + i * 11);
    for (const level of ["normal", "pro"] as const) {
      const rate = winRate(level, level, seeds, scheduleFor);
      expect(rate, `${level} 的 0 号位胜率跑偏了:${rate}`).toBeGreaterThan(0.38);
      expect(rate).toBeLessThan(0.62);
    }
  });

  it("交换座位不会改变强弱结论", () => {
    const forward = winRate("pro", "rookie", SEEDS, scheduleFor);
    const backward = winRate("rookie", "pro", SEEDS, scheduleFor);
    expect(forward).toBeGreaterThan(0.6);
    expect(backward).toBeLessThan(0.4);
    expect(duelWinner("master", "rookie", 3, scheduleFor(3))).toBe(0);
  });
});

describe("实时大脑", () => {
  const targets: AiTargetView[] = [
    { id: 1, x: 0.8, y: 0.5, kind: "bloom", bornAt: 0, dieAt: 6 },
    { id: 2, x: 0.55, y: 0.5, kind: "coin", bornAt: 0, dieAt: 6 },
  ];

  it("目标刚冒出来时还看不见 —— 这就是留给对手的时间", () => {
    const brain = createBrain("master", 9);
    const early = thinkAi(brain, 0.05, { x: 0.5, y: 0.5 }, targets);
    expect(early.dx).toBe(0);
    expect(early.dy).toBe(0);
  });

  it("等满反应时间之后才朝目标走", () => {
    const brain = createBrain("pro", 11);
    const cmd = thinkAi(brain, AI_SPECS.pro.reactionS + 0.05, { x: 0.5, y: 0.5 }, targets);
    expect(Math.hypot(cmd.dx, cmd.dy)).toBeGreaterThan(0.9);
    expect(cmd.dx).toBeGreaterThan(0); // 目标都在右边
  });

  it("菜鸟比地狱慢得多:同一时刻一个还在发愣,一个已经动了", () => {
    const rookie = createBrain("rookie", 5);
    const master = createBrain("master", 5);
    const t = AI_SPECS.master.reactionS + 0.05;
    const a = thinkAi(rookie, t, { x: 0.5, y: 0.5 }, targets);
    const b = thinkAi(master, t, { x: 0.5, y: 0.5 }, targets);
    expect(Math.hypot(a.dx, a.dy)).toBe(0);
    expect(Math.hypot(b.dx, b.dy)).toBeGreaterThan(0);
  });

  it("挨着目标就出手,离得远不乱出手", () => {
    const near = createBrain("pro", 3);
    const close = thinkAi(near, 1, { x: 0.55, y: 0.51 }, targets);
    expect(close.grab).toBe(true);
    const far = createBrain("pro", 3);
    expect(thinkAi(far, 1, { x: 0.1, y: 0.9 }, targets).grab).toBe(false);
  });

  it("多数时候不去追迷糊泡", () => {
    const brain = createBrain("master", 8);
    const only: AiTargetView[] = [{ id: 7, x: 0.9, y: 0.9, kind: "bomb", bornAt: 0, dieAt: 9 }];
    const cmd = thinkAi(brain, 2, { x: 0.5, y: 0.5 }, only);
    expect(cmd.grab).toBe(false);
    expect(Math.hypot(cmd.dx, cmd.dy)).toBe(0);
  });

  it("档位越低越容易看走眼,一头撞上迷糊泡", () => {
    function blunders(level: "rookie" | "normal" | "master"): number {
      let n = 0;
      for (let seed = 0; seed < 120; seed++) {
        const brain = createBrain(level, seed * 13 + 1);
        const bomb: AiTargetView[] = [{ id: 1, x: 0.9, y: 0.5, kind: "bomb", bornAt: 0, dieAt: 9 }];
        const cmd = thinkAi(brain, 2, { x: 0.5, y: 0.5 }, bomb);
        if (Math.hypot(cmd.dx, cmd.dy) > 0.5) n++;
      }
      return n;
    }
    const rookie = blunders("rookie");
    const master = blunders("master");
    expect(rookie).toBeGreaterThan(10);
    expect(rookie).toBeGreaterThan(master);
    expect(master).toBeLessThan(20);
  });

  it("同一个迷糊泡只判一次,不会这一帧躲下一帧又追", () => {
    const brain = createBrain("rookie", 4);
    const bomb: AiTargetView[] = [{ id: 42, x: 0.85, y: 0.5, kind: "bomb", bornAt: 0, dieAt: 30 }];
    thinkAi(brain, 2, { x: 0.5, y: 0.5 }, bomb); // 第一帧先掷骰子(可能还在犹豫)
    const decided = thinkAi(brain, 3, { x: 0.5, y: 0.5 }, bomb);
    for (let t = 3.1; t < 8; t += 0.1) {
      const cmd = thinkAi(brain, t, { x: 0.5, y: 0.5 }, bomb);
      expect(Math.hypot(cmd.dx, cmd.dy) > 0.5).toBe(Math.hypot(decided.dx, decided.dy) > 0.5);
    }
  });

  it("会隔一段时间放一次技能,高档比低档放得勤", () => {
    function casts(level: "rookie" | "master"): number {
      const brain = createBrain(level, 21);
      let n = 0;
      for (let t = 0; t < 60; t += 0.1) {
        if (thinkAi(brain, t, { x: 0.5, y: 0.5 }, targets).skill) n++;
      }
      return n;
    }
    const rookie = casts("rookie");
    const master = casts("master");
    expect(rookie).toBeGreaterThan(0);
    expect(master).toBeGreaterThan(rookie);
  });

  it("同 seed 的大脑每一步都一样(录像可复现)", () => {
    const a = createBrain("normal", 77);
    const b = createBrain("normal", 77);
    for (let t = 0; t < 12; t += 0.25) {
      expect(thinkAi(a, t, { x: 0.5, y: 0.5 }, targets)).toEqual(
        thinkAi(b, t, { x: 0.5, y: 0.5 }, targets),
      );
    }
  });
});
