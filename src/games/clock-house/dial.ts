/**
 * 时钟小屋 1.2：可以拖的钟面。
 *
 * 拨分针时时针按比例跟着走（`dragMinuteTo` + `hourHandAngleAt`），
 * 这是本款最重要的教学正确性；拖动默认磁性吸附到最近整分，
 * 「🎯 精确」开关一按就关掉吸附，指针可以停在两分之间。
 *
 * 出题壳 `quiz99.ts` 是公共资产（只读），题面只能是一段 HTML 字符串带不了监听，
 * 所以钟面先由 `clockface.faceSVG(..., { dial: true })` 画成静态 SVG，
 * 再由这里在题面渲染完之后接管；`destroy` 会把指针监听、按钮和 pointer capture 一起摘掉。
 */
import { HANDS, handTip } from "./clockface";
import {
  angleToMinute,
  clockHour,
  clockMinute,
  dragMinuteTo,
  formatClockMinute,
  hourHandAngleAt,
  minuteHandAngleAt,
  snapMinute,
  wrapClockMinutes,
} from "./logic";

/** 从中心指向 (x, y) 的角度：0 度指向 12，顺时针增大 */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
  return ((deg % 360) + 360) % 360;
}

/** 拖到 (x, y) 之后钟面上是几点几分（吸附与联动都在这一步做完） */
export function dialTimeAt(
  time: number,
  box: { left: number; top: number; width: number; height: number },
  x: number,
  y: number,
  precise: boolean
): number {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const minute = snapMinute(angleToMinute(pointerAngle(cx, cy, x, y)), precise);
  return dragMinuteTo(time, minute);
}

/** 读数行的文案（精确模式下会把小数那一点也说清楚） */
export function dialReadout(time: number, precise: boolean): string {
  if (!precise) return `现在拨到 ${formatClockMinute(time)}`;
  const whole = Math.floor(wrapClockMinutes(time));
  return `现在拨到 ${clockHour(whole)} 点 ${clockMinute(whole)} 分左右`;
}

export interface DialHandle {
  destroy: () => void;
  /** 仅供测试与外部读数 */
  getTime: () => number;
}

interface PointerLike {
  clientX: number;
  clientY: number;
  pointerId?: number;
  preventDefault?: () => void;
}

/**
 * 接管一个 `data-clk-dial` 钟面。
 * 找不到指针元素就原样返回一个空 handle，绝不让题面因为拖不动而白屏。
 */
export function mountDial(svg: Element): DialHandle {
  const hourHand = svg.querySelector('[data-clk-hand="hour"]');
  const minuteHand = svg.querySelector('[data-clk-hand="minute"]');
  const host = svg.parentElement;
  const start = Number((svg as Element).getAttribute("data-t") ?? 0);
  let time = wrapClockMinutes(Number.isFinite(start) ? start : 0);
  let precise = false;
  let dragging = false;

  if (!(hourHand instanceof Element) || !(minuteHand instanceof Element) || !host) {
    return { destroy: () => {}, getTime: () => time };
  }

  const readout = host.ownerDocument.createElement("div");
  readout.className = "clk-dial-read";
  const toggle = host.ownerDocument.createElement("button");
  toggle.type = "button";
  toggle.className = "clk-toggle";
  const offs: Array<() => void> = [];

  function paint(): void {
    const h = handTip(hourHandAngleAt(time), HANDS.hour.length);
    const m = handTip(minuteHandAngleAt(time), HANDS.minute.length);
    (hourHand as Element).setAttribute("x2", h.x.toFixed(2));
    (hourHand as Element).setAttribute("y2", h.y.toFixed(2));
    (minuteHand as Element).setAttribute("x2", m.x.toFixed(2));
    (minuteHand as Element).setAttribute("y2", m.y.toFixed(2));
    svg.setAttribute("data-t", String(Math.round(time)));
    svg.setAttribute("aria-label", formatClockMinute(time));
    readout.textContent = dialReadout(time, precise);
    toggle.textContent = precise ? "🎯 精确模式：开" : "🎯 精确模式：关";
    toggle.setAttribute("aria-pressed", precise ? "true" : "false");
  }

  function moveTo(ev: PointerLike): void {
    const rect = (svg as Element).getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    time = dialTimeAt(time, rect, ev.clientX, ev.clientY, precise);
    paint();
  }

  function on<T extends Event>(target: EventTarget, type: string, fn: (ev: T) => void): void {
    const handler = fn as EventListener;
    target.addEventListener(type, handler);
    offs.push(() => target.removeEventListener(type, handler));
  }

  on<PointerEvent>(svg, "pointerdown", (ev) => {
    dragging = true;
    ev.preventDefault?.();
    (svg as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(ev.pointerId);
    moveTo(ev);
  });
  on<PointerEvent>(svg, "pointermove", (ev) => {
    if (!dragging) return;
    ev.preventDefault?.();
    moveTo(ev);
  });
  const stop = (): void => {
    dragging = false;
  };
  on<PointerEvent>(svg, "pointerup", stop);
  on<PointerEvent>(svg, "pointercancel", stop);
  on<PointerEvent>(svg, "pointerleave", stop);

  // 键盘也能拨：左右一次一分钟，上下一次五分钟，读屏用户不掉队
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("role", "slider");
  on<KeyboardEvent>(svg, "keydown", (ev) => {
    const step =
      ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowUp" ? 5 : ev.key === "ArrowDown" ? -5 : 0;
    if (step === 0) return;
    ev.preventDefault?.();
    time = dragMinuteTo(time, clockMinute(time) + step);
    paint();
  });

  on<MouseEvent>(toggle, "click", () => {
    precise = !precise;
    if (!precise) time = Math.round(time);
    paint();
  });

  host.appendChild(readout);
  host.appendChild(toggle);
  paint();

  return {
    destroy() {
      dragging = false;
      while (offs.length) offs.pop()?.();
      readout.remove();
      toggle.remove();
    },
    getTime: () => time,
  };
}
