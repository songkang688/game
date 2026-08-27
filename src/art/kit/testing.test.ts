import { describe, expect, it } from "vitest";
import { makeStubCtx } from "./testing";

describe("makeStubCtx 记录式 2D 桩", () => {
  it("记录方法调用次数与最近参数", () => {
    const stub = makeStubCtx();
    const ctx = stub.ctx;
    ctx.beginPath();
    ctx.arc(1, 2, 3, 0, Math.PI);
    ctx.arc(4, 5, 6, 0, Math.PI);
    ctx.fill();
    expect(stub.count("arc")).toBe(2);
    expect(stub.count("fill")).toBe(1);
    expect(stub.count("stroke")).toBe(0);
    expect(stub.last("arc")?.slice(0, 3)).toEqual([4, 5, 6]);
    expect(stub.countAny("arc", "fill")).toBe(3);
  });

  it("记录样式赋值: fillStyle/font 进各自日志", () => {
    const stub = makeStubCtx();
    const ctx = stub.ctx;
    ctx.fillStyle = "#ff0000";
    ctx.fillStyle = "#00ff00";
    ctx.fillStyle = "#ff0000";
    ctx.font = "bold 14px sans-serif";
    expect(stub.fillStyleLog).toEqual(["#ff0000", "#00ff00", "#ff0000"]);
    expect(stub.distinctFillStyles()).toEqual(["#ff0000", "#00ff00"]);
    expect(stub.fontLog).toEqual(["bold 14px sans-serif"]);
    expect(ctx.fillStyle).toBe("#ff0000");
  });

  it("统计非有限数值参数(NaN 坐标契约)", () => {
    const stub = makeStubCtx();
    stub.ctx.moveTo(1, 2);
    expect(stub.nonFiniteArgs).toBe(0);
    stub.ctx.lineTo(NaN, 3);
    stub.ctx.arc(0, Infinity, 5, 0, 1);
    expect(stub.nonFiniteArgs).toBe(2);
  });

  it("snapshot 序列化调用序列,reset 清空", () => {
    const stub = makeStubCtx();
    stub.ctx.translate(1.23456, 7);
    const snap = stub.snapshot();
    expect(snap).toContain("translate(1.235,7)");
    stub.reset();
    expect(stub.calls.length).toBe(0);
    expect(stub.snapshot()).toBe("");
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("文字与渐变等常用能力可用: 记录 fillText,measureText 有宽度", () => {
    const stub = makeStubCtx();
    const ctx = stub.ctx;
    ctx.fillText("+1", 5, 6);
    ctx.strokeText("hi", 7, 8);
    expect(stub.textLog).toEqual(["+1", "hi"]);
    expect(ctx.measureText("abc").width).toBeGreaterThan(0);
    const grad = ctx.createLinearGradient(0, 0, 1, 1);
    expect(() => grad.addColorStop(0, "#fff")).not.toThrow();
    expect(stub.count("createLinearGradient")).toBe(1);
  });
});
