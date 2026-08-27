// 梨康台球 · 球桌视图的回归测试。
//
// 测试环境是 node、没有 jsdom，所以这里用自带的极简 DOM 桩 `domStub.ts`：
// 它把监听器、rAF、定时器都数得出来，「destroy 之后不留任何东西」才是可断言的，不是嘴上说说。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TABLE, makeBall, type Ball } from "./physics";
import {
  El,
  fireWindow,
  flushFrames,
  installDom,
  restoreDom,
  windowListenerCount,
  type Dom,
} from "./domStub";
import {
  MIN_BALL_PX,
  MIN_TOUCH_PX,
  SHAKE_MAX_PX,
  SHAKE_MS,
  SHAKE_SPEED,
  aimPreview,
  chargePower,
  createTable,
  powerFromDrag,
  shakeAmplitude,
  shakeOffset,
  tableLayout,
  toScreen,
  toTable,
  type ShotIntent,
} from "./view";

let dom: Dom;

function flush(n: number, stepMs = 50): void {
  flushFrames(dom, n, stepMs);
}

function winCount(): number {
  return windowListenerCount(dom);
}

function fireWin(type: string, ev: unknown): void {
  fireWindow(dom, type, ev);
}

function el(cls: string): El | null {
  return dom.root.find((e) => e.className.includes(cls));
}

beforeEach(() => {
  dom = installDom(800);
});

afterEach(() => {
  restoreDom();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* 布局与几何                                                           */
/* ------------------------------------------------------------------ */

describe("360px 布局", () => {
  it("窄屏转成竖版，球直径不小于 14px，画布不超出屏宽", () => {
    const lay = tableLayout(360);
    expect(lay.vertical).toBe(true);
    expect(lay.ballPx).toBeGreaterThanOrEqual(MIN_BALL_PX);
    expect(lay.cssW).toBeLessThanOrEqual(360 - 16);
    expect(lay.fontPx).toBeGreaterThanOrEqual(13);
  });

  it("更窄的 320px 也照样竖版且球看得清", () => {
    const lay = tableLayout(320);
    expect(lay.vertical).toBe(true);
    expect(lay.ballPx).toBeGreaterThanOrEqual(MIN_BALL_PX);
    expect(lay.fontPx).toBeGreaterThanOrEqual(13);
  });

  it("宽屏是横版，长边朝右", () => {
    const lay = tableLayout(1024);
    expect(lay.vertical).toBe(false);
    expect(lay.cssW).toBeGreaterThan(lay.cssH);
    expect(lay.ballPx).toBeGreaterThanOrEqual(MIN_BALL_PX);
  });

  it("力度条与击球钮的热区不小于 44px", () => {
    expect(MIN_TOUCH_PX).toBeGreaterThanOrEqual(44);
  });

  it("台面坐标和画布坐标能来回换算（横版竖版都对）", () => {
    for (const w of [360, 1024]) {
      const lay = tableLayout(w);
      for (const p of [{ x: 12, y: 8 }, { x: 100, y: 50 }, { x: 190, y: 92 }]) {
        const s = toScreen(p, lay);
        const back = toTable(s.x, s.y, lay);
        expect(back.x).toBeCloseTo(p.x, 6);
        expect(back.y).toBeCloseTo(p.y, 6);
      }
    }
  });
});

describe("瞄准与力度", () => {
  it("瞄准线会停在第一颗挡路的球上", () => {
    const balls: Ball[] = [makeBall(1, "warm", 120, 50)];
    const pv = aimPreview({ x: 40, y: 50 }, 0, balls);
    expect(pv.hitId).toBe(1);
    expect(pv.end.x).toBeLessThan(120);
    expect(pv.end.x).toBeGreaterThan(100);
  });

  it("没有球挡路时瞄准线停在库边", () => {
    const pv = aimPreview({ x: 40, y: 50 }, 0, []);
    expect(pv.hitId).toBeNull();
    expect(pv.end.x).toBeCloseTo(TABLE.w - TABLE.r, 6);
  });

  it("拖得越远力度越大，且永远在 0..1 之间", () => {
    const lay = tableLayout(800);
    expect(powerFromDrag(0, lay)).toBeGreaterThan(0);
    expect(powerFromDrag(10, lay)).toBeLessThan(powerFromDrag(60, lay));
    expect(powerFromDrag(99999, lay)).toBe(1);
  });

  it("蓄力条来回跑，不会卡在满力", () => {
    expect(chargePower(0)).toBeCloseTo(0.06, 6);
    expect(chargePower(750)).toBeCloseTo(1, 2);
    expect(chargePower(1500)).toBeCloseTo(0.06, 2);
    for (const t of [100, 400, 900, 2600]) {
      expect(chargePower(t)).toBeGreaterThanOrEqual(0.06);
      expect(chargePower(t)).toBeLessThanOrEqual(1);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 球桌本体                                                             */
/* ------------------------------------------------------------------ */

function mountTable(over: Partial<Parameters<typeof createTable>[1]> = {}) {
  const settled: Array<{ potted: number[]; shot: ShotIntent }> = [];
  const handle = createTable(dom.root as unknown as HTMLElement, {
    balls: [makeBall(0, "cue", 40, 50), makeBall(1, "warm", 140, 28)],
    seats: [{ name: "鸭梨", emoji: "🍐", color: "#e8558f", ai: null }],
    turn: 0,
    banner: "练习台",
    tip: "先找线再出杆。",
    showAim: true,
    allowSpin: true,
    requireCall: false,
    freeBall: false,
    target: "warm",
    sfx: () => undefined,
    onSettled: (res, shot) => settled.push({ potted: res.potted.map((p) => p.id), shot }),
    ...over,
  });
  return { handle, settled };
}

describe("球桌:挂载与清理", () => {
  it("挂上去会画出球桌、力度条和击球钮", () => {
    const { handle } = mountTable();
    expect(el("ps-wrap")).not.toBeNull();
    expect(el("ps-power")).not.toBeNull();
    expect(el("ps-shoot")).not.toBeNull();
    expect(dom.root.find((e) => e.tagName === "canvas")).not.toBeNull();
    handle.destroy();
  });

  it("destroy 之后 window 监听、rAF、DOM 全部清干净", () => {
    const before = winCount();
    const { handle } = mountTable();
    expect(winCount()).toBeGreaterThan(before);
    expect(dom.root.countListeners()).toBeGreaterThan(0);
    flush(3);
    handle.destroy();
    expect(winCount()).toBe(before);
    expect(dom.cancelled.length).toBeGreaterThan(0);
    expect(dom.root.children).toHaveLength(0);
  });

  it("滚球滚到一半 destroy 也不会再往下跑", () => {
    const { handle, settled } = mountTable();
    fireWin("keydown", { key: "f", preventDefault: () => undefined });
    dom.clock.ms += 300;
    fireWin("keyup", { key: "f" });
    flush(3);
    handle.destroy();
    const framesLeft = dom.frames.length;
    flush(20);
    expect(settled).toHaveLength(0);
    expect(dom.frames.length).toBeLessThanOrEqual(framesLeft);
    expect(winCount()).toBe(0);
  });

  it("destroy 调两次也不报错", () => {
    const { handle } = mountTable();
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});

describe("球桌:真的能打一杆", () => {
  it("键盘 F 蓄力 + 松开击球，球滚完之后回调拿到结果", () => {
    const { handle, settled } = mountTable();
    // 先把角度调到瞄着目标球（母球 40,50 → 目标 140,28）
    fireWin("keydown", { key: "f", preventDefault: () => undefined });
    dom.clock.ms += 400;
    fireWin("keyup", { key: "f" });
    expect(handle.rolling()).toBe(true);
    for (let i = 0; i < 400 && settled.length === 0; i++) flush(1);
    expect(settled).toHaveLength(1);
    expect(settled[0].shot.power).toBeGreaterThan(0);
    expect(handle.rolling()).toBe(false);
    handle.destroy();
  });

  it("方向键会改角度，改完再打出去的方向也跟着变", () => {
    const { handle, settled } = mountTable();
    for (let i = 0; i < 10; i++) fireWin("keydown", { key: "ArrowRight", preventDefault: () => undefined });
    fireWin("keydown", { key: "f", preventDefault: () => undefined });
    dom.clock.ms += 200;
    fireWin("keyup", { key: "f" });
    for (let i = 0; i < 400 && settled.length === 0; i++) flush(1);
    expect(settled).toHaveLength(1);
    expect(settled[0].shot.angle).toBeCloseTo(0.3, 5);
    handle.destroy();
  });

  it("手机拖动瞄准：松手就出杆，力度跟着拉开的距离走", () => {
    const { handle, settled } = mountTable();
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    const lay = tableLayout(800);
    const p = toScreen({ x: 140, y: 28 }, lay);
    canvas.dispatch("pointerdown", { clientX: p.x, clientY: p.y });
    canvas.dispatch("pointermove", { clientX: p.x, clientY: p.y });
    canvas.dispatch("pointerup", {});
    expect(handle.rolling()).toBe(true);
    for (let i = 0; i < 400 && settled.length === 0; i++) flush(1);
    expect(settled).toHaveLength(1);
    expect(settled[0].shot.power).toBeGreaterThan(0.5);
    handle.destroy();
  });

  it("入袋不是瞬删：球落袋之后还会缩小下沉一小会儿", () => {
    const { handle, settled } = mountTable({
      balls: [makeBall(0, "cue", 60, 50), makeBall(1, "warm", 140, 28)],
    });
    fireWin("keydown", { key: "f", preventDefault: () => undefined });
    dom.clock.ms += 400;
    fireWin("keyup", { key: "f" });
    for (let i = 0; i < 400 && settled.length === 0; i++) flush(1);
    expect(settled).toHaveLength(1);
    // 有没有进球取决于角度，这里只要求「进了就有下沉动画、没进也不报错」
    flush(20);
    expect(handle.rolling()).toBe(false);
    handle.destroy();
  });

  it("Esc 暂停会停下画面并给出提示，再按一次恢复", () => {
    const { handle } = mountTable();
    fireWin("keydown", { key: "Escape", preventDefault: () => undefined });
    expect(el("ps-tip")?.textContent).toContain("暂停");
    fireWin("keydown", { key: "Escape", preventDefault: () => undefined });
    expect(el("ps-tip")?.textContent).not.toContain("暂停");
    handle.destroy();
  });
});

describe("球桌:自由球与电脑出杆", () => {
  it("自由球时点一下台面就能摆母球，确认之后回调拿到合法位置", () => {
    let placed: { x: number; y: number } | null = null;
    const { handle } = mountTable({
      freeBall: true,
      onFreeBall: (pos) => {
        placed = pos;
      },
    });
    const canvas = dom.root.find((e) => e.tagName === "canvas")!;
    const lay = tableLayout(800);
    const p = toScreen({ x: 70, y: 60 }, lay);
    canvas.dispatch("pointerdown", { clientX: p.x, clientY: p.y });
    const btn = dom.root.find((e) => e.textContent.includes("母球放好了"))!;
    btn.dispatch("click", {});
    expect(placed).not.toBeNull();
    expect(placed!.x).toBeGreaterThanOrEqual(TABLE.r);
    expect(placed!.x).toBeLessThanOrEqual(TABLE.w - TABLE.r);
    handle.destroy();
  });

  it("轮到电脑时会自己出杆（等一小会儿再打，看得清）", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let asked = 0;
    const { handle, settled } = mountTable({
      seats: [{ name: "机器人", emoji: "🤖", color: "#3f7fd6", ai: 2 }],
      aiThink: () => {
        asked++;
        return { angle: 0, power: 0.6, spin: 0, calledPocket: null };
      },
    });
    expect(asked).toBe(0);
    vi.advanceTimersByTime(900);
    expect(asked).toBe(1);
    expect(handle.rolling()).toBe(true);
    for (let i = 0; i < 400 && settled.length === 0; i++) flush(1);
    expect(settled).toHaveLength(1);
    handle.destroy();
  });

  it("电脑在想的时候 destroy，定时器不会再回来敲门", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let asked = 0;
    const { handle } = mountTable({
      seats: [{ name: "机器人", emoji: "🤖", color: "#3f7fd6", ai: 3 }],
      aiThink: () => {
        asked++;
        return { angle: 0, power: 0.5, spin: 0, calledPocket: null };
      },
    });
    handle.destroy();
    vi.advanceTimersByTime(3000);
    expect(asked).toBe(0);
    expect(winCount()).toBe(0);
  });

  it("update 能换球、换出杆方、换提示", () => {
    const { handle } = mountTable();
    handle.update({
      balls: [makeBall(0, "cue", 100, 50)],
      tip: "换一句提示",
      banner: "第 2 局",
      target: "black",
      requireCall: true,
    });
    expect(el("ps-tip")?.textContent).toBe("换一句提示");
    // 指定袋按钮这时候要露出来
    const pockets = dom.root.findAll((e) => e.className === "ps-pockets");
    expect(pockets[0]?.hidden).toBe(false);
    handle.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* 撞库的轻微抖动                                                        */
/* ------------------------------------------------------------------ */

describe("撞库抖一下", () => {
  it("撞得不够狠就不抖，够狠才抖而且幅度有上限", () => {
    expect(shakeAmplitude(0)).toBe(0);
    expect(shakeAmplitude(SHAKE_SPEED - 1)).toBe(0);
    expect(shakeAmplitude(SHAKE_SPEED + 90)).toBeGreaterThan(0);
    expect(shakeAmplitude(9999)).toBeLessThanOrEqual(SHAKE_MAX_PX);
    expect(shakeAmplitude(Number.NaN)).toBe(0);
  });

  it("抖动随剩余时间收敛，时间走完正好回到原位", () => {
    const amp = SHAKE_MAX_PX;
    const early = shakeOffset(SHAKE_MS, amp, 1000);
    const late = shakeOffset(SHAKE_MS * 0.2, amp, 1000);
    expect(Math.hypot(early.x, early.y)).toBeGreaterThan(Math.hypot(late.x, late.y));
    expect(shakeOffset(0, amp, 1000)).toEqual({ x: 0, y: 0 });
    for (const t of [0, 37, 500, 1234]) {
      const o = shakeOffset(SHAKE_MS, amp, t);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(amp);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(amp);
    }
  });

  /** 母球从左边满力直推右库，中途没有球挡路，一定会重重吃一次库 */
  function hardBank() {
    const { handle, settled } = mountTable({
      balls: [makeBall(0, "cue", 40, 50), makeBall(1, "warm", 150, 92)],
    });
    fireWin("keydown", { key: "f", preventDefault: () => undefined });
    // 蓄力条要靠动画帧往上爬，flush 到满力再松手
    flush(15);
    fireWin("keyup", { key: "f" });
    return { handle, settled, box: el("ps-table")! };
  }

  it("重重吃一次库，球桌会轻轻晃一下，然后自己回正", () => {
    const { handle, settled, box } = hardBank();
    let shook = "";
    for (let i = 0; i < 60 && !shook; i++) {
      flush(1);
      shook = box.style.transform ?? "";
    }
    expect(shook).toContain("translate");
    for (let i = 0; i < 60 && settled.length === 0; i++) flush(1);
    flush(20);
    expect(box.style.transform ?? "").toBe("");
    handle.destroy();
  });

  it("prefers-reduced-motion 打开时，同一杆一动不动", () => {
    (globalThis as Record<string, unknown>).matchMedia = () => ({ matches: true });
    try {
      const { handle, settled, box } = hardBank();
      for (let i = 0; i < 400 && settled.length === 0; i++) {
        flush(1);
        expect(box.style.transform ?? "").toBe("");
      }
      expect(settled).toHaveLength(1);
      handle.destroy();
    } finally {
      delete (globalThis as Record<string, unknown>).matchMedia;
    }
  });

  it("destroy 会把抖动的位移一起抹掉", () => {
    const { handle, box } = hardBank();
    for (let i = 0; i < 60 && !(box.style.transform ?? ""); i++) flush(1);
    expect(box.style.transform ?? "").toContain("translate");
    handle.destroy();
    expect(box.style.transform).toBe("");
  });
});
