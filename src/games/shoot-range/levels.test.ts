import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import { CHAPTERS, TARGET_BOUNDS, buildDuelTargets, buildLevel, buildTide, hasCleanShot } from "./levels";
import {
  MUZZLE_X,
  MUZZLE_Y,
  aimToVelocity,
  fireGun,
  makeGun,
  nextOrder,
  stepGun,
  stepTarget,
  traceShot,
} from "./logic";

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

  it("照着「一个个瞄准打」的打法模拟一遍,188 关都能在弹药与时限内清完", () => {
    // 瞄准点的候选:靶心优先,被好人靶或木板挡住时再试靶面上的几个偏移
    const offsets: Array<[number, number]> = [
      [0, 0],
      [-0.6, 0],
      [0.6, 0],
      [0, -0.6],
      [0, 0.6],
    ];
    // 一个不算快的玩家:每发之间花 0.45 秒挪准星
    const AIM_TIME = 0.45;

    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const def = buildLevel(lv);
      let targets = def.targets.map((t) => ({ ...t }));
      let gun = makeGun(def.magSize, def.reloadTime);
      let time = 0;
      let shots = 0;
      let friendHits = 0;
      const limit = def.seconds > 0 ? def.seconds : 120;

      let cleared = false;
      while (time <= limit && shots < def.shotBudget) {
        const pending = targets.filter((t) => t.alive && t.kind !== "friend");
        if (pending.length === 0) {
          cleared = true;
          break;
        }
        // 编号关必须按顺序,其余关就近打
        const want = nextOrder(targets);
        const goal = want > 0 ? pending.find((t) => t.order === want) ?? pending[0] : pending[0];

        // 等到瞄准完成、冷却走完、换弹结束
        const wait = Math.max(AIM_TIME, gun.reloadLeft, gun.cooldownLeft);
        time += wait;
        gun = stepGun(gun, wait);
        targets = targets.map((t) => stepTarget(t, wait));

        const live = targets.find((t) => t.id === goal.id);
        expect(live).toBeDefined();
        if (!live) break;

        // 先试着打中目标本身;要是被另一个必打的靶挡在前面,那就先打掉挡路的那个
        let hitId: number | null = null;
        let shadow: number | null = null;
        for (const [ox, oy] of offsets) {
          const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, live.x + ox * live.r, live.y + oy * live.r);
          const res = traceShot(shot, targets, def.blocks);
          if (res.targetId === live.id) {
            hitId = res.targetId;
            break;
          }
          const other = targets.find((t) => t.id === res.targetId);
          if (shadow === null && other && other.kind !== "friend") shadow = other.id;
        }
        if (hitId === null) hitId = shadow;

        const fired = fireGun(gun);
        expect(fired.fired).toBe(true);
        gun = fired.gun;
        shots++;
        if (hitId === null) continue;
        const struck = targets.find((t) => t.id === hitId);
        if (struck?.kind === "friend") friendHits++;
        else if (struck) struck.alive = false;
      }

      expect(cleared, `第 ${lv + 1} 关照着一个个瞄的打法清不完(用了 ${shots} 发 / ${time.toFixed(1)} 秒)`).toBe(true);
      expect(shots).toBeLessThanOrEqual(def.shotBudget);
      expect(time).toBeLessThanOrEqual(limit);
      // 这套打法全程不该误伤好人靶
      expect(friendHits).toBe(0);
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
