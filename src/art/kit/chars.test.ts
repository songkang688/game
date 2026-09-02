import { describe, expect, it } from "vitest";
import {
  CHAR_ANIM,
  DUODUO_SKINS,
  XINGXING_SKINS,
  drawDuoduo,
  drawXingxing,
  type CharOpts,
  type KitPose
} from "./chars";
import { CHAR_COLORS } from "./palette";
import { makeStubCtx } from "./testing";

const POSES: KitPose[] = ["idle", "run", "jump", "hurt", "win"];
const CHARS = [
  { name: "朵朵", draw: drawDuoduo },
  { name: "星星", draw: drawXingxing }
] as const;

function base(extra?: Partial<CharOpts>): CharOpts {
  return { x: 100, y: 200, size: 64, ...extra };
}

describe.each(CHARS)("$name 各姿态素材契约", ({ draw }) => {
  it.each(POSES)("pose=%s 有绘制调用、不抛、无 NaN 坐标、save/restore 配平", (pose) => {
    const stub = makeStubCtx();
    expect(() => draw(stub.ctx, base({ pose, t: 0.3 }))).not.toThrow();
    expect(stub.count("fill")).toBeGreaterThan(0);
    expect(stub.count("beginPath")).toBeGreaterThan(3);
    expect(stub.count("stroke")).toBeGreaterThan(0);
    expect(stub.nonFiniteArgs).toBe(0);
    expect(stub.count("save")).toBe(stub.count("restore"));
  });
});

describe("idle 呼吸与眨眼", () => {
  it("呼吸振幅契约 ≤ size 的 4%", () => {
    expect(CHAR_ANIM.breathAmp).toBeLessThanOrEqual(0.04);
  });

  it("朵朵 idle 相位变化产生不同输出(呼吸浮动)", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawDuoduo(a.ctx, base({ pose: "idle", t: 0 }));
    drawDuoduo(b.ctx, base({ pose: "idle", t: 0.25 }));
    expect(a.snapshot()).not.toBe(b.snapshot());
  });

  it("朵朵眨眼窗口: 睁眼是圆眼填充,闭眼换成弯弧描边", () => {
    const open = makeStubCtx();
    const blink = makeStubCtx();
    drawDuoduo(open.ctx, base({ pose: "idle", t: 0.3 }));
    drawDuoduo(blink.ctx, base({ pose: "idle", t: (CHAR_ANIM.blinkStart + CHAR_ANIM.blinkEnd) / 2 }));
    expect(open.snapshot()).not.toBe(blink.snapshot());
    // 闭眼比睁眼少两次眼球填充、多两次弧线描边
    expect(blink.count("fill")).toBeLessThan(open.count("fill"));
    expect(blink.count("stroke")).toBeGreaterThan(open.count("stroke"));
  });

  it("星星眨眼窗口同样生效", () => {
    const open = makeStubCtx();
    const blink = makeStubCtx();
    drawXingxing(open.ctx, base({ pose: "idle", t: 0.3 }));
    drawXingxing(blink.ctx, base({ pose: "idle", t: 0.65 }));
    expect(open.snapshot()).not.toBe(blink.snapshot());
  });
});

describe("朝向翻转", () => {
  it("朵朵 facing:left 用 scale(-1,1) 镜像, right 不镜像", () => {
    const left = makeStubCtx();
    const right = makeStubCtx();
    drawDuoduo(left.ctx, base({ facing: "left" }));
    drawDuoduo(right.ctx, base({ facing: "right" }));
    const flip = (s: ReturnType<typeof makeStubCtx>) =>
      s.calls.some((c) => c.method === "scale" && c.args[0] === -1 && c.args[1] === 1);
    expect(flip(left)).toBe(true);
    expect(flip(right)).toBe(false);
  });

  it("星星 facing:left 同样镜像且配饰(披风)照画", () => {
    const left = makeStubCtx();
    drawXingxing(left.ctx, base({ facing: "left" }));
    expect(left.calls.some((c) => c.method === "scale" && c.args[0] === -1)).toBe(true);
    // 披风的两段二次曲线仍然在
    expect(left.count("quadraticCurveTo")).toBeGreaterThanOrEqual(3);
  });
});

describe("表情姿态差异", () => {
  it("朵朵 hurt 与 idle 调用序列不同,且多出眩晕圈描边", () => {
    const idle = makeStubCtx();
    const hurt = makeStubCtx();
    drawDuoduo(idle.ctx, base({ pose: "idle", t: 0.3 }));
    drawDuoduo(hurt.ctx, base({ pose: "hurt", t: 0.3 }));
    expect(idle.snapshot()).not.toBe(hurt.snapshot());
    expect(hurt.count("stroke")).toBeGreaterThan(idle.count("stroke"));
    // 眩晕圈是 ellipse 轨道
    expect(hurt.count("ellipse")).toBeGreaterThan(idle.count("ellipse"));
  });

  it("hurt 不出血: 画面里没有血红色", () => {
    const stub = makeStubCtx();
    drawDuoduo(stub.ctx, base({ pose: "hurt" }));
    drawXingxing(stub.ctx, base({ pose: "hurt" }));
    for (const c of [...stub.fillStyleLog, ...stub.strokeStyleLog]) {
      expect(c).not.toBe("#ff0000");
      expect(c).not.toBe("#cc0000");
      expect(c).not.toBe("red");
    }
  });

  it("星星 win 与 idle 调用序列不同,并撒出星花", () => {
    const idle = makeStubCtx();
    const win = makeStubCtx();
    drawXingxing(idle.ctx, base({ pose: "idle", t: 0.3 }));
    drawXingxing(win.ctx, base({ pose: "win", t: 0.3 }));
    expect(idle.snapshot()).not.toBe(win.snapshot());
    // 撒花的四芒星路径带来更多 lineTo
    expect(win.count("lineTo")).toBeGreaterThan(idle.count("lineTo"));
  });
});

describe("皮肤参数化", () => {
  it("朵朵换冬装: fillStyle 集合变化,路径数不变(剪影不变)", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawDuoduo(a.ctx, base({ t: 0.3, skin: DUODUO_SKINS.default }));
    drawDuoduo(b.ctx, base({ t: 0.3, skin: DUODUO_SKINS.winter }));
    expect(a.fillStyleLog.join("|")).not.toBe(b.fillStyleLog.join("|"));
    expect(b.count("beginPath")).toBe(a.count("beginPath"));
    expect(b.count("fill")).toBe(a.count("fill"));
    expect(b.count("stroke")).toBe(a.count("stroke"));
  });

  it("星星换冬装: 换色不改剪影", () => {
    const a = makeStubCtx();
    const b = makeStubCtx();
    drawXingxing(a.ctx, base({ t: 0.3, skin: XINGXING_SKINS.default }));
    drawXingxing(b.ctx, base({ t: 0.3, skin: XINGXING_SKINS.winter }));
    expect(a.fillStyleLog.join("|")).not.toBe(b.fillStyleLog.join("|"));
    expect(b.count("beginPath")).toBe(a.count("beginPath"));
    expect(b.count("fill")).toBe(a.count("fill"));
  });

  it("两套皮肤自身也是合法配色且主色不同", () => {
    const HEX_RE = /^#[0-9a-f]{6}$/;
    for (const skins of [DUODUO_SKINS, XINGXING_SKINS]) {
      for (const key of ["default", "winter"] as const) {
        const s = skins[key];
        for (const c of [s.primary, s.secondary, s.accent, s.outline]) {
          expect(c).toMatch(HEX_RE);
        }
      }
      expect(skins.default.primary).not.toBe(skins.winter.primary);
    }
  });
});

describe("极端输入安全", () => {
  it("size ≤ 0 / NaN: 不抛、零绘制调用", () => {
    for (const size of [0, -5, NaN, Infinity]) {
      for (const { draw } of CHARS) {
        const stub = makeStubCtx();
        expect(() => draw(stub.ctx, base({ size }))).not.toThrow();
        expect(stub.calls.length).toBe(0);
      }
    }
  });

  it("x / y 非有限: 不抛、零绘制调用", () => {
    for (const { draw } of CHARS) {
      const stub = makeStubCtx();
      expect(() => draw(stub.ctx, base({ x: NaN }))).not.toThrow();
      expect(() => draw(stub.ctx, base({ y: Infinity }))).not.toThrow();
      expect(stub.calls.length).toBe(0);
    }
  });

  it("未知 pose 回退成 idle,输出一致", () => {
    const junk = makeStubCtx();
    const idle = makeStubCtx();
    drawDuoduo(junk.ctx, base({ pose: "flip" as unknown as KitPose, t: 0.3 }));
    drawDuoduo(idle.ctx, base({ pose: "idle", t: 0.3 }));
    expect(junk.snapshot()).toBe(idle.snapshot());
  });

  it("t 越界(5.3 / -2 / NaN)不抛且无 NaN 坐标", () => {
    for (const t of [5.3, -2, NaN]) {
      for (const { draw } of CHARS) {
        const stub = makeStubCtx();
        expect(() => draw(stub.ctx, base({ pose: "run", t }))).not.toThrow();
        expect(stub.calls.length).toBeGreaterThan(0);
        expect(stub.nonFiniteArgs).toBe(0);
      }
    }
  });
});

describe("A/B 一眼可区分(宪法第三节)", () => {
  it("各自画面里出现各自主色,且互不借用对方主色", () => {
    const duo = makeStubCtx();
    const xing = makeStubCtx();
    drawDuoduo(duo.ctx, base());
    drawXingxing(xing.ctx, base());
    expect(duo.fillStyleLog).toContain(CHAR_COLORS.duoduo.primary);
    expect(xing.fillStyleLog).toContain(CHAR_COLORS.xingxing.primary);
    expect(duo.fillStyleLog).not.toContain(CHAR_COLORS.xingxing.primary);
    expect(xing.fillStyleLog).not.toContain(CHAR_COLORS.duoduo.primary);
  });

  it("非火柴人: 躯干是有宽度的填充形状,三阶光影(≥3 种填充色)", () => {
    for (const { draw } of CHARS) {
      const stub = makeStubCtx();
      draw(stub.ctx, base());
      // 底色 + 暗部 + 高光,至少 3 种填充色
      expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
      // 躯干/头部是路径填充,不是几根线
      expect(stub.count("fill")).toBeGreaterThanOrEqual(6);
    }
  });
});
