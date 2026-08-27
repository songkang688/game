/**
 * 萌猫小屋 · 钳位量早了一帧，钳完仍旧溢出 8px
 * （窗口5 第2轮 档C 监督修复员 · W5R2-FC-04）。
 *
 * `fitIntoStage()` 是在 `playLevel` 里量的，而平台顶栏 `.l99-stagebar` 在窄屏上
 * 会折行——折之前和折之后，这一屏的起点差 8px。量在折行之前，
 * `max-height` 就写大了 8px，钳完舞台照样裁掉 8px。
 *
 * CDP 实测 360×640 第 141 关：`.ktc-wrap` 拿到 `max-height:408px`，
 * 而它头顶到裁切线其实只剩 400px，`.ktc-wrap` 的下沿落在 626、裁切线在 618。
 *
 * 改法：`relayout()` 之后再挂一帧 `requestAnimationFrame` 补量一次。
 * 拿不到 `requestAnimationFrame`（测试桩、SSR）就安静跳过，不改变任何既有行为。
 */
import { describe, expect, it, vi } from "vitest";

import { fitIntoStage, scrollIntoStage } from "./runtime";

/** 一个刚够用的假 DOM：量得出高度，记得住写进去的样式 */
function makeHost(opts: { top: () => number; clipBottom: number; scrollHeight: number }) {
  const style: Record<string, string> = {};
  const frames: Array<() => void> = [];
  const listeners: Array<[string, () => void]> = [];
  const parent = {
    parentElement: null as unknown,
    getBoundingClientRect: () => ({ top: 0, bottom: opts.clipBottom })
  };
  const view = {
    getComputedStyle: () => ({ overflowY: "hidden" }),
    requestAnimationFrame(fn: () => void) {
      frames.push(fn);
      return frames.length;
    },
    addEventListener(type: string, fn: () => void) {
      listeners.push([type, fn]);
    },
    removeEventListener(type: string, fn: () => void) {
      const at = listeners.findIndex((l) => l[0] === type && l[1] === fn);
      if (at >= 0) listeners.splice(at, 1);
    }
  };
  const el = {
    ownerDocument: { defaultView: view },
    parentElement: parent,
    classList: { add: () => {}, remove: () => {} },
    style: {
      maxHeight: "",
      overflowY: "",
      minHeight: "",
      setProperty(k: string, v: string) {
        style[k] = v;
      },
      removeProperty(k: string) {
        delete style[k];
      }
    },
    scrollHeight: opts.scrollHeight,
    getBoundingClientRect: () => ({ top: opts.top(), bottom: opts.top() + opts.scrollHeight })
  };
  return { el: el as unknown as HTMLElement, frames, listeners, style };
}

describe("萌猫小屋 · 钳位补一帧（W5R2-FC-04）", () => {
  it("顶栏折行之后补量一次，`max-height` 跟着改小", () => {
    let top = 210;
    const host = makeHost({ top: () => top, clipBottom: 618, scrollHeight: 589 });
    const fit = scrollIntoStage(host.el, 100);
    // 第一次量：可视段 618−210 = 408
    expect(host.el.style.maxHeight).toBe("408px");
    // 顶栏折行，这一屏整体往下挪 8px
    top = 218;
    expect(host.frames.length, "没有挂补量那一帧").toBeGreaterThanOrEqual(1);
    for (const f of host.frames.splice(0)) f();
    expect(host.el.style.maxHeight, "补量之后才是真的 400").toBe("400px");
    fit.dispose();
  });

  it("`fitIntoStage()` 也补这一帧", () => {
    let top = 210;
    const host = makeHost({ top: () => top, clipBottom: 618, scrollHeight: 900 });
    const fit = fitIntoStage(host.el);
    expect(host.el.style.maxHeight).toBe("408px");
    top = 218;
    expect(host.frames.length).toBeGreaterThanOrEqual(1);
    for (const f of host.frames.splice(0)) f();
    expect(host.el.style.maxHeight).toBe("400px");
    fit.dispose();
  });

  it("`dispose()` 之后那一帧再跑也不许再往 DOM 上写", () => {
    let top = 210;
    const host = makeHost({ top: () => top, clipBottom: 618, scrollHeight: 589 });
    const fit = scrollIntoStage(host.el, 100);
    fit.dispose();
    expect(host.el.style.maxHeight).toBe("");
    top = 218;
    for (const f of host.frames.splice(0)) f();
    expect(host.el.style.maxHeight, "拆完还在偷偷钳").toBe("");
  });

  it("拿不到 requestAnimationFrame 时安静跳过，不抛异常", () => {
    const host = makeHost({ top: () => 210, clipBottom: 618, scrollHeight: 589 });
    const view = (host.el as unknown as { ownerDocument: { defaultView: Record<string, unknown> } }).ownerDocument
      .defaultView;
    view.requestAnimationFrame = undefined;
    const spy = vi.fn();
    expect(() => {
      const fit = scrollIntoStage(host.el, 100);
      spy();
      fit.dispose();
    }).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});
