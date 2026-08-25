/**
 * 画布小工具:requestAnimationFrame 循环 + 自适应 DPR 的 canvas。
 * 游戏子代理可直接使用,也可以自己实现。
 */

export interface LoopController {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/**
 * 创建一个游戏循环。tick(dt) 的 dt 单位是秒,最大被钳到 1/20,
 * 避免切后台回来后一帧跳太远。
 */
export function createLoop(tick: (dt: number) => void): LoopController {
  let rafId = 0;
  let running = false;
  let last = 0;

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    tick(dt);
    rafId = requestAnimationFrame(frame);
  }

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }
  };
}

export interface CanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** CSS 像素宽度(绘制时用这个,ctx 已按 DPR 缩放) */
  readonly width: number;
  /** CSS 像素高度 */
  readonly height: number;
  dispose(): void;
}

/**
 * 在 parent 里塞一个铺满的 canvas,自动跟随尺寸与 devicePixelRatio,
 * 绘制坐标始终按 CSS 像素来写。
 */
export function attachCanvas(
  parent: HTMLElement,
  onResize?: (w: number, h: number) => void
): CanvasHandle {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前环境不支持 2D canvas");

  let cssW = 0;
  let cssH = 0;

  function resize(): void {
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize?.(cssW, cssH);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  resize();

  return {
    canvas,
    ctx,
    get width() {
      return cssW;
    },
    get height() {
      return cssH;
    },
    dispose() {
      observer.disconnect();
      canvas.remove();
    }
  };
}
