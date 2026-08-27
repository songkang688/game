import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import { BLOCK, canMove, emptyCells, hasTile, maxTile, rng } from "./board";
import { simulateRun } from "./ai";
import {
  CHAPTERS,
  chapterIndexOf,
  endlessConfig,
  goalLine,
  ladderValues,
  levelConfig,
  levelWon,
  maxRungs,
  overLine,
  roomRungs,
  starsFor,
  startBoard,
  stepBudget,
  versusConfig,
  VERSUS_TARGETS,
  type MergeResult
} from "./levels";

const ALL = Array.from({ length: TOTAL_LEVELS }, (_, i) => i);

describe("章节切分", () => {
  it("八章之和恒等于 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
  });

  it("章节大小与规格表一致", () => {
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每章都有名字、表情、颜色和一句介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(8);
    }
  });

  it("关号落到正确的章", () => {
    expect(chapterIndexOf(0)).toBe(0);
    expect(chapterIndexOf(23)).toBe(0);
    expect(chapterIndexOf(24)).toBe(1);
    expect(chapterIndexOf(96)).toBe(4);
    expect(chapterIndexOf(187)).toBe(7);
  });
});

describe("关卡配置", () => {
  it("188 关都配得出来,越界的关号夹到边上", () => {
    expect(levelConfig(-5).level).toBe(0);
    expect(levelConfig(999).level).toBe(TOTAL_LEVELS - 1);
    expect(levelConfig(Number.NaN).level).toBe(0);
  });

  it("同一关每次配出来一模一样", () => {
    for (const lv of [0, 47, 120, 187]) {
      expect(levelConfig(lv)).toEqual(levelConfig(lv));
    }
  });

  it("每关的 seed 互不相同", () => {
    const seeds = new Set(ALL.map((lv) => levelConfig(lv).seed));
    expect(seeds.size).toBe(TOTAL_LEVELS);
  });

  it("目标一律是 2 的幂,而且至少 32", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      expect(Number.isInteger(Math.log2(cfg.target))).toBe(true);
      expect(cfg.target).toBeGreaterThanOrEqual(32);
      expect(cfg.target).toBeLessThanOrEqual(4096);
    }
  });

  it("难度是往上走的:最后一章的目标比第一章大得多", () => {
    expect(levelConfig(0).target).toBe(32);
    expect(levelConfig(187).target).toBe(4096);
    expect(levelConfig(95).target).toBe(2048);
  });

  it("盘面尺寸只有 3 / 4 / 5 三种", () => {
    const sizes = new Set(ALL.map((lv) => levelConfig(lv).size));
    expect([...sizes].sort()).toEqual([3, 4, 5]);
  });

  it("第六章确实一小一大地换盘面", () => {
    const ch5 = ALL.filter((lv) => levelConfig(lv).chapter === 5).map((lv) => levelConfig(lv).size);
    expect(ch5).toHaveLength(22);
    expect(new Set(ch5)).toEqual(new Set([3, 5]));
  });

  it("障碍花只出现在第五章", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      if (cfg.chapter === 4) expect(cfg.blocks).toBeGreaterThan(0);
      else expect(cfg.blocks).toBe(0);
    }
  });

  it("限步只出现在第七章,而且给的步数够宽裕", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      if (cfg.chapter === 6) {
        expect(cfg.stepLimit).toBeGreaterThan(40);
        expect(cfg.stepLimit).toBeLessThanOrEqual(stepBudget(cfg));
      } else {
        expect(cfg.stepLimit).toBe(0);
      }
    }
  });

  it("竞速关只出现在第八章,而且四档假人都用上了", () => {
    const race = ALL.map(levelConfig).filter((c) => c.race);
    expect(race.length).toBeGreaterThan(6);
    expect(race.every((c) => c.chapter === 7)).toBe(true);
    expect(new Set(race.map((c) => c.aiTier))).toEqual(new Set(["rookie", "normal", "pro", "hell"]));
  });

  it("阶梯级数不超过盘面装得下的上限", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      expect(cfg.rungs).toBeGreaterThanOrEqual(1);
      expect(cfg.rungs).toBeLessThanOrEqual(maxRungs(cfg.target));
      expect(cfg.rungs).toBeLessThanOrEqual(roomRungs(cfg.size, cfg.blocks));
    }
  });

  it("阶梯是从 target/2 一路减半下来的", () => {
    const vals = ladderValues({ target: 512, rungs: 4 });
    expect(vals).toEqual([256, 128, 64, 32]);
    expect(ladderValues({ target: 32, rungs: 99 })).toEqual([16, 8, 4, 2]);
  });

  it("目标一句话把要点都写上了", () => {
    const cfg = levelConfig(100);
    expect(goalLine(cfg)).toContain(`合成 ${cfg.target}`);
    expect(goalLine(cfg)).toContain("障碍花");
    expect(goalLine(levelConfig(150))).toContain("步以内");
    expect(goalLine(levelConfig(0))).toBe("合成 32");
  });
});

describe("固定开局", () => {
  it("同一关每次摆出一模一样的开局", () => {
    for (const lv of [0, 60, 119, 187]) {
      expect(startBoard(lv)).toEqual(startBoard(lv));
    }
  });

  it("开局摆好了阶梯,还留了起手的 2", () => {
    for (const lv of [0, 40, 80, 130, 187]) {
      const cfg = levelConfig(lv);
      const board = startBoard(lv);
      for (const v of ladderValues(cfg)) expect(hasTile(board, v)).toBe(true);
      expect(hasTile(board, 2)).toBe(true);
    }
  });

  it("开局一定推得动,而且没到目标", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      const board = startBoard(lv);
      expect(canMove(board)).toBe(true);
      expect(maxTile(board)).toBeLessThan(cfg.target);
    }
  });

  it("开局留了足够的空格腾挪(至少四成)", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      const board = startBoard(lv);
      expect(emptyCells(board).length).toBeGreaterThanOrEqual(Math.floor(cfg.size * cfg.size * 0.4));
    }
  });

  it("障碍花按配置的朵数摆好", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      if (cfg.blocks === 0) continue;
      const board = startBoard(lv);
      const flowers = board.flat().filter((v) => v === BLOCK).length;
      expect(flowers).toBe(cfg.blocks);
    }
  });
});

describe("188 关可达成(搜索验证,不是嘴上说说)", () => {
  it("每一关都能从固定开局走到目标", () => {
    const failures: string[] = [];
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      const cap = cfg.stepLimit > 0 ? cfg.stepLimit : stepBudget(cfg);
      // 先用便宜的两层搜索跑;跑不通的少数几关再加深一层,证明这一关真有走得通的路
      let run = simulateRun({
        board: startBoard(lv),
        target: cfg.target,
        tier: "hell",
        rand: rng(cfg.seed),
        maxSteps: cap,
        depth: 2
      });
      if (!run.reached) {
        run = simulateRun({
          board: startBoard(lv),
          target: cfg.target,
          tier: "hell",
          rand: rng(cfg.seed),
          maxSteps: cap,
          depth: 3
        });
      }
      if (!run.reached) {
        failures.push(
          `第 ${lv + 1} 关(${cfg.size}×${cfg.size} 目标 ${cfg.target}):只叠到 ${run.best},走了 ${run.steps}/${cap} 步`
        );
      }
    }
    expect(failures.join("\n")).toBe("");
  }, 300000);
});

describe("胜负与评星", () => {
  const base = levelConfig(0);

  it("合到目标就算过关", () => {
    expect(levelWon(base, { best: 32, steps: 20, score: 100, stuck: false })).toBe(true);
    expect(levelWon(base, { best: 16, steps: 20, score: 100, stuck: true })).toBe(false);
  });

  it("限步关超了步数就算没过,哪怕合到了目标", () => {
    const cfg = levelConfig(150);
    expect(cfg.stepLimit).toBeGreaterThan(0);
    const got: MergeResult = { best: cfg.target, steps: cfg.stepLimit + 1, score: 999, stuck: false };
    expect(levelWon(cfg, got)).toBe(false);
    expect(levelWon(cfg, { ...got, steps: cfg.stepLimit })).toBe(true);
  });

  it("竞速关被假人抢先就算没过", () => {
    const cfg = levelConfig(ALL.find((lv) => levelConfig(lv).race) as number);
    const got: MergeResult = { best: cfg.target, steps: 30, score: 999, stuck: false, foeReached: true };
    expect(levelWon(cfg, got)).toBe(false);
    expect(levelWon(cfg, { ...got, foeReached: false })).toBe(true);
  });

  it("没到目标只有一星", () => {
    expect(starsFor(base, { best: 16, steps: 5, score: 10, stuck: true })).toBe(1);
  });

  it("省步数或者超额合出更大的块能加星", () => {
    const budget = stepBudget(base);
    expect(starsFor(base, { best: 32, steps: budget, score: 10, stuck: false })).toBe(1);
    expect(starsFor(base, { best: 32, steps: 3, score: 10, stuck: false })).toBe(2);
    expect(starsFor(base, { best: 128, steps: budget, score: 10, stuck: false })).toBe(2);
    expect(starsFor(base, { best: 128, steps: 3, score: 10, stuck: false })).toBe(3);
  });

  it("步数预算跟着目标和盘面走,而且总是正数", () => {
    for (const lv of ALL) {
      const cfg = levelConfig(lv);
      expect(stepBudget(cfg)).toBeGreaterThan(40);
    }
    expect(stepBudget({ target: 4096, size: 5, blocks: 0 })).toBeGreaterThan(
      stepBudget({ target: 128, size: 4, blocks: 0 })
    );
  });

  it("失败的话只鼓励,不批评", () => {
    const lines = [
      overLine(base, { best: 16, steps: 9, score: 8, stuck: true }),
      overLine(levelConfig(150), { best: 64, steps: 9999, score: 8, stuck: false }),
      overLine(levelConfig(171), { best: 64, steps: 9, score: 8, stuck: false, foeReached: true })
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(8);
      expect(line).not.toMatch(/笨|差劲|失败了|输了|不行/);
    }
  });
});

describe("无尽与对战配置", () => {
  it("无尽有四乘四和三乘三两种", () => {
    expect(endlessConfig("marathon").size).toBe(4);
    expect(endlessConfig("tiny").size).toBe(3);
    expect(endlessConfig("marathon").hint.length).toBeGreaterThan(6);
  });

  it("对战是四乘四,目标可选", () => {
    expect(versusConfig("pro").target).toBe(512);
    expect(versusConfig("hell", 1024)).toEqual({ tier: "hell", size: 4, target: 1024 });
    expect(VERSUS_TARGETS.every((n) => Number.isInteger(Math.log2(n)))).toBe(true);
  });
});
