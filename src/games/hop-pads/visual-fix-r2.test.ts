// 窗口3 · 第 2 轮监督修复:round1 遗留 #6 / B 档 round2 建议 8——
// 画布暂停层的「⏸」emoji 换画制双圆角竖条(drawPauseBars),文字部分保留。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { drawPauseBars } from "./art";
import { makeRecordingCtx } from "./domStub";

const indexSrc = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("hop-pads 暂停牌画制化(遗留 #6)", () => {
  it("drawPauseBars:两根圆头竖条(2×moveTo+2×lineTo),一次 stroke,无文字", () => {
    const { ops, ctx } = makeRecordingCtx();
    drawPauseBars(ctx, 100, 80, 20);
    const line = ops.join("|");
    expect(line).toContain("lineCap=round");
    expect(ops.filter((o) => o.startsWith("moveTo(")).length).toBe(2);
    expect(ops.filter((o) => o.startsWith("lineTo(")).length).toBe(2);
    expect(ops.filter((o) => o === "stroke()").length).toBe(1);
    expect(line.includes("fillText(")).toBe(false);
  });

  it("drawPauseBars:两根竖条左右对称、等高,save/restore 自净不漏状态", () => {
    const { ops, ctx } = makeRecordingCtx();
    drawPauseBars(ctx, 0, 0, 20);
    // h=20 → dx=6,half=10:左条 (-6,-10)→(-6,10),右条 (6,-10)→(6,10)
    expect(ops).toContain("moveTo(-6,-10)");
    expect(ops).toContain("lineTo(-6,10)");
    expect(ops).toContain("moveTo(6,-10)");
    expect(ops).toContain("lineTo(6,10)");
    expect(ops[0]).toBe("save()");
    expect(ops[ops.length - 1]).toBe("restore()");
  });

  it("默认颜色沿用暂停层原有赭墨 #9A5A2C,线宽随高度成比例且有 3px 下限", () => {
    const a = makeRecordingCtx();
    drawPauseBars(a.ctx, 0, 0, 20);
    expect(a.ops).toContain("strokeStyle=#9A5A2C");
    expect(a.ops).toContain("lineWidth=6.4");
    const b = makeRecordingCtx();
    drawPauseBars(b.ctx, 0, 0, 6);
    expect(b.ops).toContain("lineWidth=3");
  });

  it("画布源码不再有「⏸」emoji,暂停标题改为画制牌 + 纯文字「已暂停」", () => {
    expect(indexSrc.includes("⏸")).toBe(false);
    expect(indexSrc).toContain("drawPauseBars(ctx, cam.w / 2");
    expect(indexSrc).toContain('ctx.fillText("已暂停", cam.w / 2, cam.h / 2 - 14);');
  });

  it("aria 播报里的「已暂停」一字未动(读屏口径不变)", () => {
    expect(indexSrc).toContain('paused ? ",已暂停" : ""');
  });
});
