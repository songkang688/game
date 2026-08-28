/**
 * tank-battle · 1.3 窗口 5 第 3 轮(终验)监督修复员 · C-3 配套用例。
 *
 * C-3 = B 档 R2 一致性点名排名 5(R2-b 登记交本轮):全款唯一「主角无三停光影」,
 * 比邻款平半档。修法克制执行两笔:
 *  ① 炮塔圆顶左上高光弧:1px 白细线 → shade(炮塔顶色,+18) 2px 圆头弧(静态、弧段同位);
 *  ② 徽章描边换 kit strokeOutline(深 20% / 1.5px)对齐家规。
 * 地形块顶侧双面是本款方言,一个不动;不新增徽记(商标提醒)。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OUTLINE_DARKEN, OUTLINE_MIN } from "../../art/kit/outline";
import { shade } from "../../art/kit/palette";
import { FakeCtx } from "./domStub";
import {
  BOLT_YELLOW,
  KIND_BADGE,
  TK_GOLD,
  TURRET_SHEEN_ARC,
  TURRET_SHEEN_SHADE,
  TURRET_SHEEN_W,
  drawBoltBadge,
  drawStarBadge,
  drawTurretSheen,
  turretSheenColor,
} from "./visual13";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(HERE, f), "utf8");
const ctx2d = (c: FakeCtx): CanvasRenderingContext2D => c as unknown as CanvasRenderingContext2D;

/** 记录每一次落笔时描边状态的桩 */
class SnapCtx extends FakeCtx {
  snaps: Array<{ style: unknown; width: number; cap: string; join: string }> = [];
  override stroke(): void {
    this.snaps.push({ style: this.strokeStyle, width: this.lineWidth, cap: this.lineCap, join: this.lineJoin });
    super.stroke();
  }
}

describe("tank-battle · C-3 ① 炮塔高光弧(家族光照上主角)", () => {
  it("规格对表:+18 提亮、2px、弧段落在左上象限且与原白细线同位", () => {
    expect(TURRET_SHEEN_SHADE).toBe(18);
    expect(TURRET_SHEEN_W).toBe(2);
    expect(TURRET_SHEEN_ARC[0]).toBeCloseTo(Math.PI * 0.9, 9);
    expect(TURRET_SHEEN_ARC[1]).toBeCloseTo(Math.PI * 1.45, 9);
    // 左上象限:整段弧在 π×0.75(左下 45°)与 π×1.5(正上)之间
    expect(TURRET_SHEEN_ARC[0]).toBeGreaterThanOrEqual(Math.PI * 0.75);
    expect(TURRET_SHEEN_ARC[1]).toBeLessThanOrEqual(Math.PI * 1.5);
    expect(turretSheenColor("#F4859F")).toBe(shade("#F4859F", 18));
  });

  it("落笔即家族语言:strokeStyle = shade(顶色,+18)、lineWidth 2、圆头;r≤0 不画", () => {
    const c = new SnapCtx();
    drawTurretSheen(ctx2d(c), 0, 0, 8, "#F4859F");
    expect(c.snaps).toHaveLength(1);
    expect(c.snaps[0].style).toBe(shade("#F4859F", TURRET_SHEEN_SHADE));
    expect(c.snaps[0].width).toBe(TURRET_SHEEN_W);
    expect(c.snaps[0].cap).toBe("round");
    const dead = new SnapCtx();
    drawTurretSheen(ctx2d(dead), 0, 0, 0, "#F4859F");
    expect(dead.snaps).toHaveLength(0);
  });

  it("index.ts 炮塔段已换 drawTurretSheen,1px 白细线只剩基地那一处(2→≤1,只降不升)", () => {
    const src = read("index.ts");
    expect(src).toContain("drawTurretSheen(c, 0, 0, turret * 0.72, bodyTopLite)");
    expect((src.match(/rgba\(255,255,255,\.6\)/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe("tank-battle · C-3 ② 徽章描边对齐家规(kit strokeOutline)", () => {
  it("星徽章:金五角星描边 = shade(金,-20)、1.5px、圆角接头", () => {
    const c = new SnapCtx();
    drawStarBadge(ctx2d(c), 10, 10, 8);
    expect(c.snaps).toHaveLength(1);
    expect(c.snaps[0].style).toBe(shade(TK_GOLD, OUTLINE_DARKEN));
    expect(c.snaps[0].width).toBe(OUTLINE_MIN);
    expect(c.snaps[0].join).toBe("round");
  });

  it("闪电徽章:亮黄折线描边 = shade(主色,-20)、1.5px(不再手写铁灰描边)", () => {
    const c = new SnapCtx();
    drawBoltBadge(ctx2d(c), 10, 10, 8);
    expect(c.snaps).toHaveLength(1);
    expect(c.snaps[0].style).toBe(shade(BOLT_YELLOW, OUTLINE_DARKEN));
    expect(c.snaps[0].width).toBe(OUTLINE_MIN);
  });

  it("visual13.ts 里 kit strokeOutline 真在场(≥2 处调用),B 档「全款 0 处」清零", () => {
    const art = read("visual13.ts");
    expect((art.match(/strokeOutline\(c,/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("tank-battle · C-3 边界:方言与徽记集合不动", () => {
  it("地形块方言不动:cellBlock 仍是投影 + topSideBlock 顶侧双面", () => {
    const art = read("visual13.ts");
    const cell = art.slice(art.indexOf("export function cellBlock"), art.indexOf("// ---", art.indexOf("export function cellBlock")));
    expect(cell).toContain("TK_COLORS.tkShadow");
    expect(cell).toContain("topSideBlock(c, x, y, bw, bh, base, SIDE_RATIO, radius)");
  });

  it("不新增徽记:敌方车型 → 徽章映射还是那三形(bolt/rivet/gear)", () => {
    expect(KIND_BADGE).toEqual({ swift: "bolt", armor: "rivet", power: "gear", smart: "gear" });
  });
});
