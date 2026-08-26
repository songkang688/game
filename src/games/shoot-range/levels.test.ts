import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import { CHAPTERS, TARGET_BOUNDS, buildDuelTargets, buildLevel, buildTide, hasCleanShot } from "./levels";
import { MUZZLE_X, MUZZLE_Y, aimToVelocity, traceShot } from "./logic";

describe("shoot-range 188 关战役", () => {
  it("十个章节加起来正好 188 关", () => {
    expect(assertTotal(CHAPTERS, TOTAL_LEVELS, "shoot-range")).toBe(true);
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    expect(CHAPTERS.every((c) => c.size > 0 && c.name.length > 0 && c.desc.length > 0)).toBe(true);
  });

  it("每一关都能生成,靶子都在场地里、半径为正", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const def = buildLevel(lv);
      expect(def.level).toBe(lv);
      expect(def.chapter).toBe(chapterOf(CHAPTERS, lv));
      expect(def.targets.length).toBeGreaterThanOrEqual(3);
      for (const t of def.targets) {
        expect(t.r).toBeGreaterThan(8);
        expect(t.x).toBeGreaterThanOrEqual(TARGET_BOUNDS.x0 - t.r);
        expect(t.x).toBeLessThanOrEqual(TARGET_BOUNDS.x1 + t.r);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThanOrEqual(TARGET_BOUNDS.y1);
        expect(t.alive).toBe(true);
      }
    }
  });

  it("同一关重复生成结果完全一致(确定性随机)", () => {
    for (const lv of [0, 37, 96, 150, 187]) {
      expect(JSON.stringify(buildLevel(lv))).toBe(JSON.stringify(buildLevel(lv)));
    }
  });

  it("每关至少有一个必须打掉的靶,好人靶不算进指标", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const def = buildLevel(lv);
      expect(def.need).toBeGreaterThan(0);
      expect(def.need).toBe(def.targets.filter((t) => t.kind !== "friend").length);
      expect(def.parShots).toBeGreaterThan(def.need);
      // 弹药量要比三星线宽松,但不能宽松到「随便乱打也能过」
      expect(def.shotBudget).toBeGreaterThan(def.parShots);
      expect(def.shotBudget).toBeLessThan(def.need * 4);
    }
  });

  it("章节机制按计划登场:气球 / 飞碟 / 机器人 / 遮挡 / 编号 / 好人靶", () => {
    const kindsOfChapter = (ci: number): Set<string> => {
      const out = new Set<string>();
      let start = 0;
      for (let i = 0; i < ci; i++) start += CHAPTERS[i].size;
      for (let i = 0; i < CHAPTERS[ci].size; i++) {
        for (const t of buildLevel(start + i).targets) out.add(t.kind);
      }
      return out;
    };
    expect([...kindsOfChapter(0)]).toEqual(["bull"]);
    expect(kindsOfChapter(1).has("balloon")).toBe(true);
    expect(kindsOfChapter(2).has("ufo")).toBe(true);
    expect(kindsOfChapter(3).has("robot")).toBe(true);
    expect([...kindsOfChapter(5)]).toEqual(["number"]);
    expect(kindsOfChapter(6).has("friend")).toBe(true);
  });

  it("遮挡木板只在遮挡迷城与后期章节出现,前四章一块都没有", () => {
    let blocksEarly = 0;
    for (let lv = 0; lv < 78; lv++) blocksEarly += buildLevel(lv).blocks.length;
    expect(blocksEarly).toBe(0);
    let blocksCity = 0;
    for (let lv = 78; lv < 98; lv++) blocksCity += buildLevel(lv).blocks.length;
    expect(blocksCity).toBeGreaterThan(15);
  });

  it("编号靶从 1 开始连号,不跳号不重号", () => {
    for (let lv = 98; lv < 118; lv++) {
      const nums = buildLevel(lv)
        .targets.filter((t) => t.kind === "number")
        .map((t) => t.order)
        .sort((a, b) => a - b);
      expect(nums.length).toBeGreaterThan(0);
      expect(nums).toEqual(nums.map((_, i) => i + 1));
    }
  });

  it("限时章节才有倒计时,前面的章节可以慢慢瞄", () => {
    expect(buildLevel(0).seconds).toBe(0);
    expect(buildLevel(60).seconds).toBe(0);
    for (let lv = 138; lv < TOTAL_LEVELS; lv++) {
      expect(buildLevel(lv).seconds).toBeGreaterThanOrEqual(16);
    }
  });

  it("难度是往上走的:后期靶更小、章节内三星线更紧", () => {
    const avgR = (lv: number): number => {
      const ts = buildLevel(lv).targets;
      return ts.reduce((s, t) => s + t.r, 0) / ts.length;
    };
    expect(avgR(180)).toBeLessThan(avgR(2));
    const slackRatio = (lv: number): number => {
      const d = buildLevel(lv);
      return (d.parShots - d.need) / d.need;
    };
    expect(slackRatio(180)).toBeLessThan(slackRatio(2));
  });

  it("每一关都可通过:每个必打靶都有一条绕开木板和好人靶的干净射线", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const def = buildLevel(lv);
      const friends = def.targets.filter((t) => t.kind === "friend");
      for (const t of def.targets) {
        if (t.kind === "friend") continue;
        expect(hasCleanShot(t, friends, def.blocks)).toBe(true);
      }
    }
  });

  it("站位靠前的靶挡住后面的靶时,先打掉前面那个后面就能打了", () => {
    const def = buildLevel(0);
    const first = def.targets[0];
    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, first.x, first.y);
    expect(traceShot(shot, def.targets, def.blocks).targetId).toBe(first.id);
    const after = def.targets.map((t) => (t.id === first.id ? { ...t, alive: false } : t));
    expect(traceShot(shot, after, def.blocks).targetId).not.toBe(first.id);
  });
});

describe("shoot-range 无尽与对战的靶阵", () => {
  it("靶潮按给定参数出靶,同一波每次一样", () => {
    const a = buildTide(7, ["bull", "balloon"], 8, 1.5, 0);
    const b = buildTide(7, ["bull", "balloon"], 8, 1.5, 0);
    expect(a.length).toBe(8);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.every((t) => t.kind === "bull" || t.kind === "balloon")).toBe(true);
  });

  it("好人靶概率给满就全是好人靶,给 0 就一个都没有", () => {
    expect(buildTide(3, ["bull"], 6, 1, 1).every((t) => t.kind === "friend")).toBe(true);
    expect(buildTide(3, ["bull"], 6, 1, 0).some((t) => t.kind === "friend")).toBe(false);
  });

  it("分屏对战两边拿到的是同一批靶,比的是手不是运气", () => {
    const left = buildDuelTargets(2);
    const right = buildDuelTargets(2);
    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left.length).toBe(8);
    expect(left.some((t) => t.kind === "friend")).toBe(false);
  });
});
