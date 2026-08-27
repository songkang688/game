// 朵星台球 · 四档电脑球手与无头对局的回归测试。
// 关键断言:固定 seed 下地狱档打菜鸟档 20 局,胜率显著更高。
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../level99";
import { TABLE, makeBall, type Ball } from "./physics";
import {
  AI_BLURB,
  AI_LABEL,
  AI_TIERS,
  aiCuePlacement,
  chooseShot,
  clearOfPockets,
  cushionHit,
  legalBalls,
  type AiContext,
  type AiTier,
} from "./ai";
import { aiWinRate, breakShot, fireShot, playAiMatch, restoreCue, shotContext } from "./match";
import { createMatch, rackBalls, remainingOf } from "./rules";

function ctxOf(balls: Ball[], group: AiContext["group"] = "warm", ownCleared = false): AiContext {
  return { balls, group, ownCleared, requireCall: true };
}

const TABLE_SET: Ball[] = [
  makeBall(0, "cue", 40, 50),
  makeBall(1, "warm", 150, 22),
  makeBall(2, "warm", 90, 70),
  makeBall(3, "cool", 120, 40),
];

describe("四档电脑球手", () => {
  it("四档都有中文名和一句话说明", () => {
    expect(AI_TIERS).toEqual([1, 2, 3, 4]);
    for (const t of AI_TIERS) {
      expect(AI_LABEL[t].length).toBeGreaterThan(1);
      expect(AI_BLURB[t].length).toBeGreaterThan(6);
    }
    expect(AI_LABEL[4]).toBe("地狱");
  });

  it("合法目标球:开放局面不许打黑星球，清完之后只剩黑星球", () => {
    const withBlack = [...TABLE_SET, makeBall(4, "black", 170, 60)];
    expect(legalBalls(ctxOf(withBlack, null)).map((b) => b.id).sort()).toEqual([1, 2, 3]);
    expect(legalBalls(ctxOf(withBlack, "warm")).map((b) => b.id).sort()).toEqual([1, 2]);
    expect(legalBalls(ctxOf(withBlack, "warm", true)).map((b) => b.id)).toEqual([4]);
  });

  it("菜鸟档:角度随机、力气小", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 12; i++) {
      const shot = chooseShot(ctxOf(TABLE_SET), 1, rand);
      expect(shot.power).toBeLessThanOrEqual(0.4);
      expect(shot.power).toBeGreaterThan(0);
      expect(shot.angle).toBeGreaterThanOrEqual(0);
      expect(shot.angle).toBeLessThan(Math.PI * 2);
    }
  });

  it("普通档:瞄最近的己组球", () => {
    const shot = chooseShot(ctxOf(TABLE_SET), 2, mulberry32(3));
    // 最近的暖色球是 2 号(90,70)，方向应该指向右下
    expect(Math.cos(shot.angle)).toBeGreaterThan(0);
    expect(Math.sin(shot.angle)).toBeGreaterThan(0);
  });

  it("高手档:挑得出真能打进的那条线", () => {
    const spec: Ball[] = [makeBall(0, "cue", 60, 50), makeBall(1, "warm", 140, 28)];
    const shot = chooseShot(ctxOf(spec), 3, mulberry32(11));
    const res = fireShot(spec, shot);
    expect(res.firstHit).toBe("warm");
    expect(res.potted.some((p) => p.id === 1)).toBe(true);
  });

  it("地狱档:有球打就打进，而且不会顺手把母球送掉", () => {
    const spec: Ball[] = [makeBall(0, "cue", 60, 50), makeBall(1, "warm", 140, 28), makeBall(2, "warm", 70, 80)];
    const shot = chooseShot(ctxOf(spec), 4, mulberry32(5));
    const res = fireShot(spec, shot);
    expect(res.potted.some((p) => p.kind === "warm")).toBe(true);
    expect(res.potted.some((p) => p.kind === "cue")).toBe(false);
  });

  it("地狱档:一颗都打不进的时候改打安全球（软力气 + 不空杆）", () => {
    // 己组球被冷色球死死挡在袋口前，直线全被堵
    const blocked: Ball[] = [
      makeBall(0, "cue", 20, 50),
      makeBall(1, "warm", 100, 50),
      makeBall(2, "cool", 100, 44),
      makeBall(3, "cool", 100, 56),
      makeBall(4, "cool", 106, 50),
      makeBall(5, "cool", 94, 50),
    ];
    const shot = chooseShot(ctxOf(blocked), 4, mulberry32(9));
    expect(shot.safety).toBe(true);
    expect(shot.power).toBeLessThanOrEqual(0.4);
    const res = fireShot(blocked, shot);
    expect(res.potted.some((p) => p.kind === "cue")).toBe(false);
  });

  it("库边反弹的碰库点算得对：方向不对、打在库外、压在袋口上一律不算", () => {
    // 母球在台面里，镜像点在左库外侧：中间那一下正好落在 x = r 上
    const hit = cushionHit({ x: 60, y: 40 }, { x: -20, y: 60 }, "left");
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(TABLE.r, 6);
    expect(hit!.y).toBeGreaterThan(40);
    expect(hit!.y).toBeLessThan(60);
    // 镜像点还在库内侧：这条线压根没碰到库
    expect(cushionHit({ x: 60, y: 40 }, { x: 80, y: 60 }, "left")).toBeNull();
    // 碰库点会落到台面外
    expect(cushionHit({ x: 60, y: 40 }, { x: -20, y: 400 }, "left")).toBeNull();
    // 正对着角袋打过去，碰的不是库是袋
    expect(cushionHit({ x: 60, y: 40 }, { x: -60, y: -60 }, "left")).toBeNull();
  });

  it("顺路从袋口边上蹭过去的线不算通", () => {
    // 沿着上库横穿，正好从中袋口上过
    expect(clearOfPockets({ x: 40, y: 3 }, { x: 160, y: 3 })).toBe(false);
    // 往台面中间挪开就通了
    expect(clearOfPockets({ x: 40, y: 40 }, { x: 160, y: 40 })).toBe(true);
  });

  it("高手档打库边球时先碰到的是自己那一组，不再白丢一杆", () => {
    // 己组球贴着上库，直线被三颗冷色球挡死，只有从下库弹回去这一条路
    const bankable: Ball[] = [
      makeBall(0, "cue", 40, 20),
      makeBall(1, "warm", 150, 18),
      makeBall(2, "cool", 95, 19),
      makeBall(3, "cool", 95, 26),
      makeBall(4, "cool", 95, 12),
    ];
    const shot = chooseShot(ctxOf(bankable), 3, mulberry32(9));
    const res = fireShot(bankable, shot);
    // 校验之前这一杆先撞上冷色球（犯规），现在先碰到的是自己那一组
    expect(res.firstHit).toBe("warm");
    expect(res.potted.some((p) => p.kind === "cue")).toBe(false);
  });

  it("要指定袋的时候，打黑星球会报出袋号", () => {
    const spec: Ball[] = [makeBall(0, "cue", 60, 50), makeBall(1, "black", 150, 26)];
    for (const tier of [2, 3, 4] as AiTier[]) {
      const shot = chooseShot(ctxOf(spec, "warm", true), tier, mulberry32(2));
      expect(shot.calledPocket).not.toBeNull();
      expect(shot.calledPocket).toBeGreaterThanOrEqual(0);
      expect(shot.calledPocket).toBeLessThan(6);
    }
  });

  it("自由球:电脑把母球放在台面里的合法位置", () => {
    const pos = aiCuePlacement(ctxOf(TABLE_SET));
    expect(pos.x).toBeGreaterThanOrEqual(TABLE.r);
    expect(pos.x).toBeLessThanOrEqual(TABLE.w - TABLE.r);
    expect(pos.y).toBeGreaterThanOrEqual(TABLE.r);
    expect(pos.y).toBeLessThanOrEqual(TABLE.h - TABLE.r);
    for (const b of TABLE_SET.slice(1)) {
      expect(Math.hypot(pos.x - b.x, pos.y - b.y)).toBeGreaterThanOrEqual(2 * TABLE.r);
    }
  });
});

describe("无头对局", () => {
  it("开球那一杆会全力撞球堆，而且母球过了中线", () => {
    const balls = rackBalls(4);
    const shot = breakShot(balls, mulberry32(1));
    expect(shot.power).toBeGreaterThan(0.85);
    const res = fireShot(balls, shot);
    expect(res.cueCrossedCenter).toBe(true);
    expect(res.firstHit).not.toBeNull();
  });

  it("母球落袋之后能被放回台面", () => {
    const balls = rackBalls(2).map((b) => (b.kind === "cue" ? { ...b, potted: true, pocket: 0 } : b));
    const back = restoreCue(balls, { x: 44, y: 50 });
    const cue = back.find((b) => b.kind === "cue")!;
    expect(cue.potted).toBe(false);
    expect(cue.x).toBeGreaterThan(TABLE.r);
  });

  it("shotContext 会算出己组清完没有", () => {
    const m = createMatch({ seed: 1 });
    const playing = { ...m, phase: "play" as const, groups: ["warm", "cool"] as [null | "warm", null | "cool"] };
    expect(shotContext(playing).ownCleared).toBe(false);
    const cleared = {
      ...playing,
      balls: playing.balls.map((b) => (b.kind === "warm" ? { ...b, potted: true } : b)),
    };
    expect(remainingOf(cleared.balls, "warm")).toBe(0);
    expect(shotContext(cleared).ownCleared).toBe(true);
  });

  it("一整局真的能打完并分出胜负", () => {
    const r = playAiMatch([3, 2], 21);
    expect(r.timeout).toBe(false);
    expect([0, 1]).toContain(r.winner);
    expect(r.shots).toBeGreaterThan(2);
  }, 120000);

  it("固定 seed 下同样的两档打出同样的结果", () => {
    expect(playAiMatch([4, 2], 33)).toEqual(playAiMatch([4, 2], 33));
  }, 120000);

  it("地狱档打菜鸟档 20 局，胜率显著高于反过来", () => {
    const hellFirst = aiWinRate([4, 1], 20, 100);
    const rookieFirst = aiWinRate([1, 4], 20, 100);
    expect(hellFirst).toBeGreaterThanOrEqual(0.75);
    expect(rookieFirst).toBeLessThanOrEqual(0.25);
    expect(hellFirst - rookieFirst).toBeGreaterThanOrEqual(0.5);
  }, 300000);

  it("高手档也明显打得过普通档", () => {
    expect(aiWinRate([3, 2], 10, 300)).toBeGreaterThanOrEqual(0.6);
  }, 300000);
});
