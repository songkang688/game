// 朵星台球 · 1.3 视觉资产的素材契约测试。
//
// 口径按 visual-bible 第九节：绘制函数给个 stub 的 2D context 就得真的画（调用计数 > 0）、
// 调色板色值合法、双阵营形状 + 颜色双通道、极小尺寸有简化档、sprite 有缓存。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installDom, makeRecordingCtx, restoreDom, type Dom } from "./domStub";
import {
  BALL_COLORS,
  GOLD,
  SIMPLE_STAMP_R,
  ballIconSvg,
  ballSprite,
  ballStampSprite,
  paintBallBase,
  paintBallStamp,
  paintCueStick,
  paintSparkle,
  resetArtCache,
} from "./art";
import type { BallKind } from "./physics";

const KINDS: readonly BallKind[] = ["cue", "warm", "cool", "black"];

let dom: Dom;

beforeEach(() => {
  dom = installDom(800);
  resetArtCache();
});

afterEach(() => {
  void dom;
  restoreDom();
});

type Ctx2D = CanvasRenderingContext2D;

describe("调色板契约", () => {
  it("四类球的主色/亮色/暗色都是合法 #rrggbb，而且亮暗真的分了阶", () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const k of KINDS) {
      const c = BALL_COLORS[k];
      expect(c.base).toMatch(hex);
      expect(c.light).toMatch(hex);
      expect(c.dark).toMatch(hex);
      expect(c.light).not.toBe(c.dark);
      expect(c.base).not.toBe(c.dark);
    }
  });

  it("朵朵（暖）和星星（冷）两阵营主色不相等（双人可分辨的颜色通道）", () => {
    expect(BALL_COLORS.warm.base).not.toBe(BALL_COLORS.cool.base);
    expect(BALL_COLORS.warm.stamp).not.toBe(BALL_COLORS.black.stamp);
  });

  it("压印简化阈值覆盖 8px 直径红线（半径 4 以下必然简化）", () => {
    expect(SIMPLE_STAMP_R).toBeGreaterThanOrEqual(4);
  });
});

describe("球体底层", () => {
  it("球体走径向渐变（主体 + 高光斑各一个），有填充有描边，不是纯色圆", () => {
    const rec = makeRecordingCtx();
    paintBallBase(rec.ctx as Ctx2D, "warm", 10);
    const names = rec.names();
    expect(names.filter((n) => n === "createRadialGradient")).toHaveLength(2);
    expect(names.filter((n) => n === "arc").length).toBeGreaterThanOrEqual(3);
    expect(names).toContain("fill");
    expect(names).toContain("stroke");
  });

  it("四类球的底层绘制序列互不相同（颜色进了渐变，不靠单一 fillStyle）", () => {
    const seqs = KINDS.map((k) => {
      const rec = makeRecordingCtx();
      paintBallBase(rec.ctx as Ctx2D, k, 10);
      return JSON.stringify(rec.ops.map((o) => ({ n: o.name, a: o.args })));
    });
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${KINDS[i]} 与 ${KINDS[j]} 画得一样`).not.toBe(seqs[j]);
      }
    }
  });
});

describe("阵营压印（形状 + 颜色双通道）", () => {
  it("朵/星/黑/母四类压印互不相同", () => {
    const seqs = KINDS.map((k) => {
      const rec = makeRecordingCtx();
      paintBallStamp(rec.ctx as Ctx2D, k, 10);
      return JSON.stringify(rec.ops.map((o) => ({ n: o.name, a: o.args })));
    });
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        expect(seqs[i], `${KINDS[i]} 与 ${KINDS[j]} 压印一样`).not.toBe(seqs[j]);
      }
    }
  });

  it("朵阵营是花（圆瓣 arc），星阵营是五角星（lineTo 折线），色弱靠形状也分得开", () => {
    const warm = makeRecordingCtx();
    paintBallStamp(warm.ctx as Ctx2D, "warm", 10);
    expect(warm.names().filter((n) => n === "arc").length).toBeGreaterThanOrEqual(6);

    const cool = makeRecordingCtx();
    paintBallStamp(cool.ctx as Ctx2D, "cool", 10);
    expect(cool.names()).not.toContain("arc");
    expect(cool.names().filter((n) => n === "lineTo").length).toBeGreaterThanOrEqual(9);
  });

  it("黑星球是金色大五角星（金色描边上场），不再是一个黄圆", () => {
    const rec = makeRecordingCtx();
    paintBallStamp(rec.ctx as Ctx2D, "black", 10);
    expect(rec.names().filter((n) => n === "lineTo").length).toBeGreaterThanOrEqual(9);
    expect(rec.ops.some((o) => o.name === "set:strokeStyle" && o.args[0] === GOLD)).toBe(true);
  });

  it("极小半径下压印简化成色点（朵是圆点、星是菱形点），依然分得出阵营", () => {
    const warm = makeRecordingCtx();
    paintBallStamp(warm.ctx as Ctx2D, "warm", SIMPLE_STAMP_R - 1);
    expect(warm.names().filter((n) => n === "arc")).toHaveLength(1);

    const cool = makeRecordingCtx();
    paintBallStamp(cool.ctx as Ctx2D, "cool", SIMPLE_STAMP_R - 1);
    expect(cool.names()).not.toContain("arc");
    expect(cool.names().filter((n) => n === "lineTo")).toHaveLength(3);
  });
});

describe("sprite 缓存", () => {
  it("同 kind 同尺寸返回同一张离屏画布（16 球 60fps 的性能要求）", () => {
    const a = ballSprite("warm", 8);
    const b = ballSprite("warm", 8);
    expect(a).toBe(b);
    expect(a.width).toBeGreaterThan(0);
    const c = ballSprite("warm", 12);
    expect(c).not.toBe(a);
  });

  it("四类底层 sprite 与四类压印 sprite 一共 8 张，张张不同", () => {
    const all = [...KINDS.map((k) => ballSprite(k, 8)), ...KINDS.map((k) => ballStampSprite(k, 8))];
    expect(new Set(all).size).toBe(8);
  });
});

describe("球杆与星光", () => {
  it("球杆有木纹渐变、握把与先角，杆尾圆弧是全管线唯一的 bezierCurveTo", () => {
    const rec = makeRecordingCtx();
    paintCueStick(rec.ctx as Ctx2D, 10, 120, 5);
    const names = rec.names();
    expect(names).toContain("createLinearGradient");
    expect(names).toContain("bezierCurveTo");
    expect(names.filter((n) => n === "fillRect").length).toBeGreaterThanOrEqual(2);
  });

  it("星光粒子按传入的颜色画四芒星，中心还有一点白", () => {
    const rec = makeRecordingCtx();
    paintSparkle(rec.ctx as Ctx2D, 5, "#ffd25e");
    expect(rec.ops.some((o) => o.name === "set:fillStyle" && o.args[0] === "#ffd25e")).toBe(true);
    expect(rec.names().filter((n) => n === "fill")).toHaveLength(2);
    expect(rec.names()).toContain("closePath");
  });
});

describe("HUD / 结算的 SVG 小球", () => {
  it("四类图标都是装饰性 SVG（aria-hidden），且互不相同", () => {
    const svgs = KINDS.map((k) => ballIconSvg(k, 16));
    for (const s of svgs) {
      expect(s).toContain("<svg");
      expect(s).toContain('aria-hidden="true"');
      expect(s).toContain("radialGradient");
    }
    expect(new Set(svgs).size).toBe(4);
  });

  it("朵阵营图标有花瓣圆、星阵营与黑星球图标有星形 polygon", () => {
    expect((ballIconSvg("warm", 16).match(/<circle/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(ballIconSvg("cool", 16)).toContain("<polygon");
    expect(ballIconSvg("black", 16)).toContain(`stroke="${GOLD}"`);
  });
});
