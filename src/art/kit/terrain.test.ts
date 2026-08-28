/**
 * 共享美术套件 · terrain.ts 的单测(1.3 第 17 步 B 档随文件新增)。
 * 三段剖面的分段数学 + 2D 桩上的可调用性:草 / 土 / 石加起来正好是总高,
 * 花朵与根须的位置全是确定式,不用随机数。
 */
import { describe, expect, it } from "vitest";
import {
  drawHangingRoots,
  drawTerrainProfile,
  terrainBands,
  type TerrainBrush,
  type TerrainPalette,
} from "./terrain";

class Brush2D {
  lineWidth = 0;
  lineCap: unknown = "";
  globalAlpha = 1;
  ops = 0;
  gradients = 0;
  colors: string[] = [];
  private fillV: unknown = "";
  private strokeV: unknown = "";
  get fillStyle(): unknown {
    return this.fillV;
  }
  set fillStyle(v: unknown) {
    this.fillV = v;
    this.colors.push(typeof v === "string" ? v : "gradient");
  }
  get strokeStyle(): unknown {
    return this.strokeV;
  }
  set strokeStyle(v: unknown) {
    this.strokeV = v;
    this.colors.push(typeof v === "string" ? v : "gradient");
  }
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  roundRect(): void {}
  fill(): void {
    this.ops++;
  }
  stroke(): void {
    this.ops++;
  }
  createLinearGradient(): { addColorStop: () => void } {
    this.gradients++;
    return { addColorStop: () => {} };
  }
}

function brush(): Brush2D & TerrainBrush {
  return new Brush2D() as Brush2D & TerrainBrush;
}

const PAL: TerrainPalette = {
  grass: "#9FD98B",
  grassDark: "#7cb56b",
  soil: "#D8B48F",
  soilLine: "#b99674",
  stone: "#B9AFA4",
};

describe("terrain · 三段剖面的分段数学", () => {
  it("草 + 土 + 石正好等于总高,三段全非负", () => {
    for (const h of [0, 6, 20, 80, 150, 300]) {
      const b = terrainBands(h);
      expect(b.grassH).toBeGreaterThanOrEqual(0);
      expect(b.soilH).toBeGreaterThanOrEqual(0);
      expect(b.stoneH).toBeGreaterThanOrEqual(0);
      expect(b.grassH + b.soilH + b.stoneH).toBeCloseTo(Math.max(0, h), 8);
    }
  });

  it("高剖面时草顶与石底有封顶,大头都留给土身", () => {
    const b = terrainBands(300);
    expect(b.grassH).toBe(14);
    expect(b.stoneH).toBe(16);
    expect(b.soilH).toBe(270);
  });

  it("负数与 0 不炸:全 0", () => {
    expect(terrainBands(-5)).toEqual({ grassH: 0, soilH: 0, stoneH: 0 });
  });
});

describe("terrain · 2D 桩上的可调用性", () => {
  it("宽剖面:石底 / 土身 / 草顶渐变 / 草丛 / 小花 / 土层纹全落笔", () => {
    const b = brush();
    drawTerrainProfile(b, 0, 100, 200, 120, 8, PAL, { scale: 1, strata: 2 });
    expect(b.ops).toBeGreaterThan(8);
    expect(b.gradients).toBe(1);
    expect(b.colors).toContain(PAL.stone);
    expect(b.colors).toContain(PAL.soil);
    expect(b.colors).toContain(PAL.soilLine);
  });

  it("窄剖面自动省掉小花;非法宽高直接不画", () => {
    const wide = brush();
    drawTerrainProfile(wide, 0, 0, 200, 80, 8, PAL, { scale: 1 });
    const narrow = brush();
    drawTerrainProfile(narrow, 0, 0, 40, 80, 8, PAL, { scale: 1 });
    expect(narrow.ops).toBeLessThan(wide.ops);
    const empty = brush();
    drawTerrainProfile(empty, 0, 0, 0, 80, 8, PAL);
    drawTerrainProfile(empty, 0, 0, 80, -5, 8, PAL);
    expect(empty.ops).toBe(0);
  });

  it("悬根须:2~5 缕、每缕一笔,位置确定式(同参重画笔数一致)", () => {
    const a = brush();
    drawHangingRoots(a, 0, 50, 120, 24, "#8a6f52", 1);
    const b = brush();
    drawHangingRoots(b, 0, 50, 120, 24, "#8a6f52", 1);
    expect(a.ops).toBe(b.ops);
    expect(a.ops).toBeGreaterThanOrEqual(2);
    expect(a.ops).toBeLessThanOrEqual(5);
    const none = brush();
    drawHangingRoots(none, 0, 50, 0, 24, "#8a6f52", 1);
    expect(none.ops).toBe(0);
  });
});
