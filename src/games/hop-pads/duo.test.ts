/**
 * 跳跳台 · 双人同屏的触屏分台回归（QA 第 1 轮 · 包 B · B-6）。
 *
 * 测试员实测：`pointerup / pointercancel / touchend` 都挂在 `window` 上，两块 stage 各挂一份，
 * 而 `onUp` 不认是谁的手指——一个人抬手，两个人一起被弹出去。
 * 这里守住「谁的手指结束谁的蓄力」，顺带守住键盘一侧本来就是好的那部分。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameApi } from "../level99";
import { El, fireWindow, flushFrames, installDom, restoreDom, type Dom } from "./domStub";
import { levelDifficulty } from "./levels";
import { MAX_HOLD } from "./physics";
import { requiredPower } from "./run";
import { createStage, mount, type Stage } from "./index";

let dom: Dom;

function fakeApi(root: El): { api: GameApi; sounds: string[] } {
  const sounds: string[] = [];
  const api = {
    root: root as unknown as HTMLElement,
    play: (name: string) => sounds.push(name),
    addStars: () => 0,
    getStars: () => 0,
    onWin: () => undefined,
    onLose: () => undefined,
  } as unknown as GameApi;
  return { api, sounds };
}

function byText(part: string): El | null {
  const hits = dom.root.findAll((e) => e.tagName === "button" && e.textContent.includes(part));
  return hits[hits.length - 1] ?? null;
}

/** 两块并排的舞台，各认各的键（和双人同屏里那两个座位一样） */
function makeDuo(): Stage[] {
  const host = new El("div") as unknown as HTMLElement;
  dom.root.appendChild(host as unknown as El);
  return [
    { keys: ["f"], cancelKeys: ["g"], name: "🌸 朵朵 · F" },
    { keys: ["l"], cancelKeys: ["k"], name: "⭐ 星星 · L" },
  ].map((seat) =>
    createStage(host, {
      seed: 4321,
      difficulty: levelDifficulty(0, 0),
      goal: 6,
      keys: seat.keys,
      cancelKeys: seat.cancelKeys,
      name: seat.name,
      sfx: () => undefined,
    })
  );
}

function hotOf(stage: Stage): El {
  return (stage.root as unknown as El).find((e) => e.className.includes("hp-hot"))!;
}

function phases(stages: Stage[]): string[] {
  return stages.map((s) => s.phase());
}

beforeEach(() => {
  dom = installDom(360);
});

afterEach(() => {
  restoreDom();
});

describe("双人同屏 · 触屏按谁的手指分台", () => {
  it("两个人各按各的，只抬一根手指时只有那一侧起跳", () => {
    const stages = makeDuo();
    for (const s of stages) s.tick(20);
    hotOf(stages[0]).dispatch("pointerdown", { pointerId: 11 });
    hotOf(stages[1]).dispatch("pointerdown", { pointerId: 12 });
    expect(phases(stages)).toEqual(["charging", "charging"]);

    // 星星抬手：朵朵还在蓄力
    fireWindow(dom, "pointerup", { pointerId: 12 });
    expect(phases(stages)).toEqual(["charging", "flying"]);

    // 朵朵再抬手才轮到朵朵起跳
    fireWindow(dom, "pointerup", { pointerId: 11 });
    expect(phases(stages)).toEqual(["flying", "flying"]);
    for (const s of stages) s.destroy();
  });

  it("touchend 也按手指号分台，别人那一侧不受影响", () => {
    const stages = makeDuo();
    for (const s of stages) s.tick(20);
    hotOf(stages[0]).dispatch("touchstart", { changedTouches: [{ identifier: 0 }] });
    hotOf(stages[1]).dispatch("touchstart", { changedTouches: [{ identifier: 1 }] });
    expect(phases(stages)).toEqual(["charging", "charging"]);

    fireWindow(dom, "touchend", { changedTouches: [{ identifier: 0 }] });
    expect(phases(stages)).toEqual(["flying", "charging"]);
    for (const s of stages) s.destroy();
  });

  it("只有一个人按着屏幕时，另一个人那边的抬手不会把他强行送出去", () => {
    const stages = makeDuo();
    for (const s of stages) s.tick(20);
    hotOf(stages[0]).dispatch("pointerdown", { pointerId: 7 });
    expect(phases(stages)).toEqual(["charging", "ready"]);
    // 星星在自己那半屏点了一下又抬起来（没按在朵朵的蓄力上）
    fireWindow(dom, "touchend", { changedTouches: [{ identifier: 3 }] });
    fireWindow(dom, "pointerup", { pointerId: 9 });
    expect(phases(stages)).toEqual(["charging", "ready"]);
    for (const s of stages) s.destroy();
  });

  it("pointercancel 只取消自己那一台的蓄力", () => {
    const stages = makeDuo();
    for (const s of stages) s.tick(20);
    hotOf(stages[0]).dispatch("pointerdown", { pointerId: 21 });
    hotOf(stages[1]).dispatch("pointerdown", { pointerId: 22 });
    fireWindow(dom, "pointercancel", { pointerId: 22 });
    expect(phases(stages)).toEqual(["charging", "flying"]);
    for (const s of stages) s.destroy();
  });

  it("蓄力时长真的各按各的：朵朵按够了站得住，星星手一抖就够不着", () => {
    const stages = makeDuo();
    for (const s of stages) s.tick(20);
    hotOf(stages[0]).dispatch("pointerdown", { pointerId: 31 });
    hotOf(stages[1]).dispatch("pointerdown", { pointerId: 32 });
    // 星星按了一下就松手:力不够,够不着下一座台
    stages[1].tick(60);
    fireWindow(dom, "pointerup", { pointerId: 32 });
    // 朵朵接着按到正好的力度再松:这一下的时长完全由自己决定
    stages[0].tick(requiredPower(stages[0].state()) * MAX_HOLD);
    fireWindow(dom, "pointerup", { pointerId: 31 });
    for (const s of stages) s.tick(2600);
    expect(stages[0].state().hops).toBe(1);
    expect(stages[0].state().perfects).toBe(1);
    expect(stages[1].state().hops).toBe(0);
    for (const s of stages) s.destroy();
  });

  it("鼠标 / 不带手指号的老事件照旧能松手起跳", () => {
    const stages = makeDuo();
    stages[0].tick(20);
    hotOf(stages[0]).dispatch("pointerdown");
    expect(stages[0].phase()).toBe("charging");
    fireWindow(dom, "pointerup");
    expect(stages[0].phase()).toBe("flying");
    for (const s of stages) s.destroy();
  });

  it("键盘一侧仍旧各松各的（学习优化员加的收力键不受影响）", () => {
    const stages = makeDuo();
    for (const s of stages) s.tick(20);
    fireWindow(dom, "keydown", { key: "f" });
    fireWindow(dom, "keydown", { key: "l" });
    expect(phases(stages)).toEqual(["charging", "charging"]);
    // 星星按 K 收力,朵朵一点事没有
    fireWindow(dom, "keydown", { key: "k" });
    expect(phases(stages)).toEqual(["charging", "ready"]);
    fireWindow(dom, "keyup", { key: "f" });
    expect(phases(stages)).toEqual(["flying", "ready"]);
    for (const s of stages) s.destroy();
  });

  it("真的双人同屏模式里也是各跳各的", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 2, 16);
    const canvases = dom.root.findAll((e) => e.className.includes("hp-canvas"));
    expect(canvases.length).toBe(2);
    const hots = dom.root.findAll((e) => e.className.includes("hp-hot"));
    expect(hots.length).toBe(2);

    hots[0].dispatch("pointerdown", { pointerId: 1 });
    hots[1].dispatch("pointerdown", { pointerId: 2 });
    flushFrames(dom, 2, 16);
    expect(canvases.map((c) => c.getAttribute("data-phase"))).toEqual(["charging", "charging"]);

    fireWindow(dom, "pointerup", { pointerId: 2 });
    flushFrames(dom, 2, 16);
    expect(canvases.map((c) => c.getAttribute("data-phase"))).toEqual(["charging", "flying"]);
    handle.destroy();
  });

  it("destroy 之后 window 上一个监听都不剩", () => {
    const rec = fakeApi(dom.root);
    const handle = mount(rec.api);
    byText("双人同屏")!.dispatch("click");
    flushFrames(dom, 2, 16);
    const hots = dom.root.findAll((e) => e.className.includes("hp-hot"));
    hots[0].dispatch("pointerdown", { pointerId: 5 });
    handle.destroy();
    let n = 0;
    for (const set of dom.winListeners.values()) n += set.size;
    expect(n).toBe(0);
  });
});
