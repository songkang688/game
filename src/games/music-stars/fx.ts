/**
 * 音乐星星 · 节奏特效层（1.3 视觉升级 · 第 26 步 B 档新增，纯视觉模块）。
 *
 * 一块 `pointer-events:none` 的覆盖层，装三种一次性特效：
 *  - 命中节拍：两圈同心音波环扩散（240ms，第二圈错开 80ms）；
 *  - 连击：背景星空渐亮 + 一条流星（800ms 一次性）；
 *  - 结算：整片星空点亮（渐亮态常开）。
 *
 * `prefers-reduced-motion` 时环与流星整个不生成（调用方传 `reduced`），
 * 渐亮保留为静态。**只做视觉**：不读判定、不写任何玩法状态；
 * `destroy()` 之后计时器归零、节点移除——这是守门用例钉死的两条。
 */

/** 音波环扩散时长（毫秒）与第二圈的错开量 */
export const RING_MS = 240;
export const RING_STAGGER_MS = 80;
/** 流星划过的时长（毫秒，一次性） */
export const METEOR_MS = 800;

export interface FxLayerOptions {
  /** 减少动效：环与流星整个不生成，渐亮保留静态 */
  reduced?: boolean;
}

export interface FxLayerHandle {
  el: HTMLElement;
  /** 命中：在 (xPct, yPct)（百分比坐标）炸开两圈音波环 */
  ringAt(xPct: number, yPct: number): void;
  /** 连击：一条流星划过（reduced 关） */
  meteor(): void;
  /** 背景星空渐亮（连击中 / 结算点亮），off 传 false 收掉 */
  brighten(on: boolean): void;
  /** 还挂着几个特效计时器（守门用例数它归零） */
  readonly pendingTimers: number;
  destroy(): void;
}

export function createFxLayer(opts: FxLayerOptions = {}): FxLayerHandle {
  const reduced = !!opts.reduced;
  const layer = document.createElement("div");
  layer.className = "mst-fx";
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!destroyed) fn();
    }, ms);
    timers.add(t);
  }

  return {
    el: layer,
    ringAt(xPct: number, yPct: number): void {
      if (reduced || destroyed) return;
      const x = Number.isFinite(xPct) ? Math.max(0, Math.min(100, xPct)) : 50;
      const y = Number.isFinite(yPct) ? Math.max(0, Math.min(100, yPct)) : 50;
      const rings: HTMLElement[] = [];
      for (let k = 0; k < 2; k++) {
        const ring = document.createElement("div");
        ring.className = "mst-ring";
        ring.style.left = `${x}%`;
        ring.style.top = `${y}%`;
        ring.style.animationDelay = `${k * RING_STAGGER_MS}ms`;
        layer.appendChild(ring);
        rings.push(ring);
      }
      later(() => {
        for (const ring of rings) ring.remove();
      }, RING_MS + RING_STAGGER_MS + 60);
    },
    meteor(): void {
      if (reduced || destroyed) return;
      const m = document.createElement("div");
      m.className = "mst-meteor";
      layer.appendChild(m);
      later(() => m.remove(), METEOR_MS + 60);
    },
    brighten(on: boolean): void {
      if (destroyed) return;
      layer.classList.toggle("mst-fx-bright", on);
    },
    get pendingTimers(): number {
      return timers.size;
    },
    destroy(): void {
      destroyed = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      layer.remove();
    },
  };
}
