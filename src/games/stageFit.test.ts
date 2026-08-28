/**
 * 共享钳高件的口径测试(三人组 r5 · 配方 B 之 1 落成共享件)。
 *
 * 病灶:画布分辨率按屏宽定、显示层 width:100%;height:auto——横屏矮屏与平板上
 * 显示高远超 .game-stage 可视高,画布下半截连同虚拟按键掉在折叠线下。
 * 修法:量出真实余量后钳 max-height;canvas 是带内在比例的 replaced 元素,
 * 浏览器连宽等比收、不变形;判定坐标按 rect 换算,一像素不碰。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIN_CANVAS_DISPLAY_PX,
  attachCanvasFit,
  belowCanvasPx,
  boardCapWidthPx,
  canvasDisplayCapPx,
  canvasRoomPx,
  rectBottom,
  stageClipBottom,
} from "./stageFit";

describe("canvasDisplayCapPx · 钳的是显示高度", () => {
  it("装得下(余量 ≥ 原生高)就一个样式不写", () => {
    expect(canvasDisplayCapPx(338, 400)).toBeNull();
    expect(canvasDisplayCapPx(338, 338)).toBeNull();
    expect(canvasDisplayCapPx(338, 337.5)).toBeNull();
  });

  it("装不下就贴着余量钳,向下取整", () => {
    expect(canvasDisplayCapPx(390, 280.9)).toBe(280);
    expect(canvasDisplayCapPx(600, 231)).toBe(231);
  });

  it("余量再小也不低于下限(剩下的交给舞台滚动)", () => {
    expect(canvasDisplayCapPx(390, 100)).toBe(MIN_CANVAS_DISPLAY_PX);
    expect(canvasDisplayCapPx(390, MIN_CANVAS_DISPLAY_PX - 1)).toBe(MIN_CANVAS_DISPLAY_PX);
    // 各款可以按玩法自定下限(比如砖块台要看清落球点)
    expect(canvasDisplayCapPx(390, 100, 220)).toBe(220);
  });

  it("量不出数(NaN / 0 / 负数)时不动手", () => {
    expect(canvasDisplayCapPx(390, Number.NaN)).toBeNull();
    expect(canvasDisplayCapPx(390, 0)).toBeNull();
    expect(canvasDisplayCapPx(390, -60)).toBeNull();
    expect(canvasDisplayCapPx(Number.NaN, 300)).toBeNull();
    expect(canvasDisplayCapPx(0, 300)).toBeNull();
  });
});

describe("boardCapWidthPx · 方格盘按高预算反推宽上限", () => {
  it("装得下(盘高 ≤ 余量)就不动手", () => {
    expect(boardCapWidthPx({ h: 300, room: 320, cols: 8, rows: 8 })).toBeNull();
    expect(boardCapWidthPx({ h: 300, room: 299.5, cols: 8, rows: 8 })).toBeNull();
  });

  it("8×8 无 gap:宽上限 = 余量(方盘等宽高)", () => {
    expect(boardCapWidthPx({ h: 800, room: 230, cols: 8, rows: 8 })).toBe(230);
  });

  it("3×3 带 12px gap:解出的宽装回去正好贴住余量", () => {
    // room=220 → cap = (220-24)*1 + 24 = 220(方盘);格下限 44 时 floor=156
    expect(boardCapWidthPx({ h: 600, room: 220, cols: 3, rows: 3, gap: 12, minCellPx: 44 })).toBe(220);
    expect(boardCapWidthPx({ h: 600, room: 100, cols: 3, rows: 3, gap: 12, minCellPx: 44 })).toBe(156);
  });

  it("量不出数就不动手", () => {
    expect(boardCapWidthPx({ h: Number.NaN, room: 200, cols: 8, rows: 8 })).toBeNull();
    expect(boardCapWidthPx({ h: 300, room: 0, cols: 8, rows: 8 })).toBeNull();
  });
});

describe("rectBottom · 测试桩的 rect 没有 bottom 也量得出", () => {
  it("有 bottom 用 bottom,没有用 top+height", () => {
    expect(rectBottom({ top: 10, bottom: 110, height: 100 })).toBe(110);
    expect(rectBottom({ top: 10, height: 100 })).toBe(110);
  });
});

describe("belowCanvasPx / canvasRoomPx · 配方 F 的两把尺", () => {
  it("画布下方家当 = wrap 下沿 − 画布下沿,量不到返回 0", () => {
    const { canvas, wrap } = harness({
      stageClientHeight: 376,
      canvasRect: { top: 60, height: 900 },
      wrapRect: { top: 48, height: 1040 },
    });
    expect(belowCanvasPx(canvas, wrap)).toBe(128);
    const bare = { className: "" } as unknown as HTMLElement;
    expect(belowCanvasPx(bare, bare)).toBe(0);
  });

  it("canvasRoomPx = 舞台可视下沿 − 画布上沿 − 家当 − margin;量不到返回 NaN", () => {
    const { canvas, wrap } = harness({
      stageClientHeight: 376,
      canvasRect: { top: 60, height: 900 },
      wrapRect: { top: 48, height: 1040 },
    });
    // clip=380,top=60,below=128,margin=4 → 188
    expect(canvasRoomPx(canvas, wrap)).toBe(188);
    const orphanWrap = stubEl({ top: 0, height: 100 });
    const orphanCv = stubEl({ top: 0, height: 60 });
    expect(Number.isNaN(canvasRoomPx(orphanCv as unknown as HTMLElement, orphanWrap as unknown as HTMLElement))).toBe(true);
  });
});

// ---- 下面是挂线行为:用鸭子桩模拟「壳层舞台裁人」的现场 ----

interface StubRect {
  top: number;
  height: number;
  bottom?: number;
}

function stubEl(rect: StubRect, extra: Partial<Record<string, unknown>> = {}) {
  return {
    className: "",
    parentElement: null as unknown,
    style: {} as Record<string, string>,
    getBoundingClientRect: () => rect,
    ...extra,
  };
}

function harness(opts: { stageClientHeight: number; canvasRect: StubRect; wrapRect: StubRect }) {
  const stage = stubEl({ top: 0, height: opts.stageClientHeight + 8 }, {
    className: "game-stage",
    clientHeight: opts.stageClientHeight,
    clientTop: 4,
  });
  const wrap = stubEl(opts.wrapRect);
  (wrap as { parentElement: unknown }).parentElement = stage;
  const canvas = stubEl(opts.canvasRect);
  return {
    canvas: canvas as unknown as HTMLCanvasElement,
    wrap: wrap as unknown as HTMLElement,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("attachCanvasFit · 915×412 横屏实测口径", () => {
  it("画布 617px 出屏时钳到可视余量,按钮排高度已扣掉", () => {
    // 舞台可视 380,画布 top=60、显示高 900,wrap 下沿比画布下沿多 120(按钮排+提示)
    const { canvas, wrap } = harness({
      stageClientHeight: 376,
      canvasRect: { top: 60, height: 900 },
      wrapRect: { top: 48, height: 1040 }, // 下沿 1088,画布下沿 960 → below 128
    });
    const h = attachCanvasFit(canvas, wrap);
    // clip = 0 + 4 + 376 = 380;room = 380 - 60 - 128 - 4 = 188
    expect(canvas.style.maxHeight).toBe("188px");
    h.detach();
  });

  it("装得下时一个样式不写;detach 之后 refit 也不再动手", () => {
    const { canvas, wrap } = harness({
      stageClientHeight: 800,
      canvasRect: { top: 60, height: 300 },
      wrapRect: { top: 48, height: 400 },
    });
    const h = attachCanvasFit(canvas, wrap);
    expect(canvas.style.maxHeight ?? "").toBe("");
    h.detach();
    h.refit();
    expect(canvas.style.maxHeight ?? "").toBe("");
  });

  it("找不到 .game-stage(单测桩)时不抛也不写样式", () => {
    const wrap = stubEl({ top: 0, height: 500 });
    const canvas = stubEl({ top: 0, height: 400 });
    const h = attachCanvasFit(canvas as unknown as HTMLCanvasElement, wrap as unknown as HTMLElement);
    expect((canvas.style as Record<string, string>).maxHeight ?? "").toBe("");
    h.detach();
  });

  it("resize 会重量一次,detach 摘掉监听不再理会", () => {
    const listeners = new Map<string, Set<() => void>>();
    const g = globalThis as { window?: unknown };
    const savedWin = g.window;
    g.window = {
      addEventListener: (type: string, fn: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
    };
    try {
      const { canvas, wrap } = harness({
        stageClientHeight: 376,
        canvasRect: { top: 60, height: 900 },
        wrapRect: { top: 48, height: 1040 },
      });
      const h = attachCanvasFit(canvas, wrap);
      expect(listeners.get("resize")?.size).toBe(1);
      canvas.style.maxHeight = "";
      for (const fn of listeners.get("resize")!) fn();
      expect(canvas.style.maxHeight).toBe("188px");
      h.detach();
      expect(listeners.get("resize")?.size).toBe(0);
    } finally {
      if (savedWin === undefined) delete g.window;
      else g.window = savedWin;
    }
  });
});

describe("stageClipBottom · 用 clientHeight 口径不用 rect.bottom", () => {
  it("舞台 4px 边框不计入可视下沿", () => {
    const stage = stubEl({ top: 100, height: 508 }, {
      className: "game-stage",
      clientHeight: 500,
      clientTop: 4,
    });
    const inner = stubEl({ top: 120, height: 300 });
    (inner as { parentElement: unknown }).parentElement = stage;
    expect(stageClipBottom(inner as unknown as HTMLElement)).toBe(604); // 100+4+500
  });
});
