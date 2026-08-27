import { describe, expect, it } from "vitest";
import {
  STAGES,
  STAGE_COUNT,
  blockCenterX,
  blockRect,
  boundaryHalfWidth,
  clampToArena,
  hitsBlock,
  insideBoundary,
  isFreeSpot,
  placeTarget,
  spawnPoints,
  stageAt,
  stageById,
  stageForRound,
} from "./stages";

describe("场地数据表", () => {
  it("至少三张擂台,id 与名字都不重复", () => {
    expect(STAGE_COUNT).toBeGreaterThanOrEqual(3);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGE_COUNT);
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(STAGE_COUNT);
  });

  it("每张场地的字段都填齐,数值都在合法范围里", () => {
    for (const s of STAGES) {
      expect(s.name.length, `${s.id} 没名字`).toBeGreaterThan(0);
      expect(s.blurb.length, `${s.id} 没说明`).toBeGreaterThan(6);
      expect(s.emoji.length).toBeGreaterThan(0);
      expect(s.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.paceScale).toBeGreaterThanOrEqual(1);
      expect(s.paceScale).toBeLessThanOrEqual(1.5);
      expect(s.blocks.length, `${s.id} 一块地块都没有`).toBeGreaterThan(0);
      for (const b of s.blocks) {
        expect(b.x).toBeGreaterThan(0);
        expect(b.x).toBeLessThan(1);
        expect(b.y).toBeGreaterThan(0);
        expect(b.y).toBeLessThan(1);
        expect(b.w).toBeGreaterThan(0);
        expect(b.w).toBeLessThan(0.5);
        expect(b.h).toBeGreaterThan(0);
        expect(b.h).toBeLessThan(0.5);
        if (b.sway) expect(b.period, `${s.id} 会滑的地块没写周期`).toBeGreaterThan(0);
      }
    }
  });

  it("地块数量、边界形状都不一样,不是同一张图换个颜色", () => {
    expect(new Set(STAGES.map((s) => s.blocks.length)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(STAGES.map((s) => s.boundary)).size).toBeGreaterThanOrEqual(3);
    const moving = STAGES.filter((s) => s.blocks.some((b) => b.sway));
    expect(moving.length, "至少要有场地带会滑的地块").toBeGreaterThanOrEqual(2);
  });

  it("按序号取场地会绕回来,负数也不会炸", () => {
    expect(stageAt(0)).toBe(STAGES[0]);
    expect(stageAt(STAGE_COUNT)).toBe(STAGES[0]);
    expect(stageAt(-1)).toBe(STAGES[STAGE_COUNT - 1]);
    expect(stageById(STAGES[1].id)).toBe(STAGES[1]);
    expect(stageById("没有这张")).toBeNull();
  });

  it("一场比赛里回合换场地,连着三个回合不会是同一张", () => {
    const picks = [0, 1, 2].map((r) => stageForRound(1, r).id);
    expect(new Set(picks).size).toBe(3);
  });
});

describe("会滑的地块", () => {
  it("不会滑的地块位置恒定", () => {
    const still = { x: 0.4, y: 0.5, w: 0.1, h: 0.1 };
    expect(blockCenterX(still, 0)).toBe(0.4);
    expect(blockCenterX(still, 7.3)).toBe(0.4);
  });

  it("会滑的地块在幅度范围里来回,不会滑出擂台", () => {
    const mover = { x: 0.5, y: 0.3, w: 0.2, h: 0.08, sway: 0.16, period: 4 };
    let min = 1;
    let max = 0;
    for (let t = 0; t < 8; t += 0.05) {
      const cx = blockCenterX(mover, t);
      min = Math.min(min, cx);
      max = Math.max(max, cx);
    }
    expect(min).toBeGreaterThanOrEqual(0.5 - 0.16 - 1e-6);
    expect(max).toBeLessThanOrEqual(0.5 + 0.16 + 1e-6);
    expect(max - min).toBeGreaterThan(0.2);
  });

  it("地块矩形跟着中心走", () => {
    const mover = { x: 0.5, y: 0.4, w: 0.2, h: 0.1, sway: 0.1, period: 4 };
    const r = blockRect(mover, 1); // 四分之一周期,滑到最右
    expect(r.x1 - r.x0).toBeCloseTo(0.2, 6);
    expect(r.y0).toBeCloseTo(0.35, 6);
    expect(r.x0).toBeGreaterThan(0.4);
  });
});

describe("边界形状", () => {
  it("方台从头到尾一样宽", () => {
    const rect = STAGES.find((s) => s.boundary === "rect")!;
    expect(boundaryHalfWidth(rect, 0.1)).toBeCloseTo(0.5, 6);
    expect(boundaryHalfWidth(rect, 0.9)).toBeCloseTo(0.5, 6);
  });

  it("圆台中间最宽、两头收口", () => {
    const round = STAGES.find((s) => s.boundary === "round")!;
    expect(boundaryHalfWidth(round, 0.5)).toBeCloseTo(0.5, 6);
    expect(boundaryHalfWidth(round, 0.05)).toBeLessThan(0.3);
    expect(insideBoundary(round, 0.02, 0.05)).toBe(false);
    expect(insideBoundary(round, 0.5, 0.5)).toBe(true);
  });

  it("沙漏台中间收腰", () => {
    const glass = STAGES.find((s) => s.boundary === "hourglass")!;
    expect(boundaryHalfWidth(glass, 0.5)).toBeLessThan(boundaryHalfWidth(glass, 0.05));
    expect(boundaryHalfWidth(glass, 0.5)).toBeGreaterThan(0.2);
  });
});

describe("走位收边与放置", () => {
  const r = 0.05;

  it("走出边界会被收回来,而且收回来的点一定合法", () => {
    for (const stage of STAGES) {
      for (const p of [
        { x: -5, y: 0.5 },
        { x: 9, y: 0.5 },
        { x: 0.5, y: -2 },
        { x: 0.5, y: 3 },
      ]) {
        const c = clampToArena(stage, p.x, p.y, r, 0);
        expect(insideBoundary(stage, c.x, c.y, r - 1e-6), `${stage.id} 收边失败`).toBe(true);
      }
    }
  });

  it("撞到地块会被推出去(只是停住,没有任何受伤)", () => {
    const stage = STAGES[0];
    const b = stage.blocks[0];
    const c = clampToArena(stage, b.x, b.y, r, 0);
    expect(hitsBlock(stage, c.x, c.y, r - 1e-6, 0)).toBe(false);
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThan(0.25);
  });

  it("每张场地任意时刻都还有能站人的地方", () => {
    for (const stage of STAGES) {
      for (const t of [0, 1.3, 2.7, 5.5]) {
        const p = clampToArena(stage, 0.5, 0.5, r, t);
        expect(isFreeSpot(stage, p.x, p.y, r - 1e-6, t), `${stage.id} 在 ${t}s 无处落脚`).toBe(true);
      }
    }
  });

  it("目标不会生在地块里或擂台外", () => {
    for (const stage of STAGES) {
      for (let i = 0; i < 40; i++) {
        const x = (i % 8) / 7;
        const y = Math.floor(i / 8) / 4;
        const p = placeTarget(stage, x, y, 0.04, i * 0.3);
        expect(isFreeSpot(stage, p.x, p.y, 0.035, i * 0.3), `${stage.id} 的目标落点不合法`).toBe(true);
      }
    }
  });

  it("两人的出生点左右对称,起手距离完全一样", () => {
    for (const stage of STAGES) {
      const { self, mirror } = spawnPoints(stage);
      expect(self.y).toBe(mirror.y);
      expect(Math.abs(self.x - 0.5)).toBeCloseTo(Math.abs(mirror.x - 0.5), 9);
      expect(self.x).toBeLessThan(mirror.x);
    }
  });
});
