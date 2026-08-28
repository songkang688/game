/**
 * 红蓝点点 · 1.3 视觉特效助手（B 档）。
 *
 * 全部是「往画面上放一层皮」的函数：不开 setTimeout / setInterval（守
 * shell.test.ts 对 arena.ts 的定时器上限，也免得 destroy 漏收），
 * 动画收尸一律靠 animationend；粒子与浮层全挂在游戏自己的 wrap 子树里，
 * `destroy()` 的 `wrap.remove()` 一刀就能全部带走。
 *
 * `prefers-reduced-motion` 在生成端就拦住：波纹 / 星屑 / 气泡 / 翻页 / 倒计时
 * 数字直接不生成（CSS 里还有一层兜底），信号灯变色不受影响。
 */
import { JELLY_RIPPLE_SPREAD } from "../../art/kit/jellyBtn";
import { sparkleSpecs } from "../../art/kit/sparkle";
import { leadSide, type SignalFace } from "./skin";

/** 用户开没开「减弱动态效果」；量不到（老浏览器、测试桩）就当没开 */
export function reducedMotion(el: Element): boolean {
  const view = el.ownerDocument?.defaultView;
  if (!view || typeof view.matchMedia !== "function") return false;
  try {
    return view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 波纹基准直径（CSS 里 .rbt-ripple 的 12px），扩散倍数由这里换算成 scale */
const RIPPLE_BASE_PX = 12;

function rippleNode(host: HTMLElement, good: boolean, widthPx: number): HTMLElement {
  const s = host.ownerDocument.createElement("span");
  s.className = `rbt-ripple ${good ? "rbt-ripple-good" : "rbt-ripple-miss"}`;
  const w = widthPx > 0 ? widthPx : 72;
  s.style.setProperty("--rbt-rip-scale", String(Math.round(((w * JELLY_RIPPLE_SPREAD) / RIPPLE_BASE_PX) * 10) / 10));
  s.addEventListener("animationend", () => s.remove(), { once: true });
  return s;
}

/**
 * 在按垫上放一圈触点波纹：点对是金色星环（虚线金圈），点错是灰色淡纹。
 * 有指针事件就从触点出发，键盘敲的从按垫中心出发。
 */
export function spawnRipple(btn: HTMLElement, good: boolean, ev?: MouseEvent | PointerEvent | null): void {
  if (reducedMotion(btn)) return;
  const s = rippleNode(btn, good, btn.offsetWidth);
  if (ev && typeof ev.clientX === "number" && typeof btn.getBoundingClientRect === "function") {
    const rect = btn.getBoundingClientRect();
    if (rect.width > 0) {
      s.style.setProperty("--rbt-rip-x", `${Math.round(ev.clientX - rect.left)}px`);
      s.style.setProperty("--rbt-rip-y", `${Math.round(ev.clientY - rect.top)}px`);
    }
  }
  btn.appendChild(s);
}

/**
 * 闯关的点被拍掉的那一刻就从 DOM 里摘了，波纹改放到场地上、
 * 中心对准那颗点原来的位置（读它的 left/top 百分比，纯视觉）。
 */
export function spawnRippleAtDot(arena: HTMLElement, dot: HTMLElement, good: boolean): void {
  if (reducedMotion(arena)) return;
  const w = dot.offsetWidth > 0 ? dot.offsetWidth : 72;
  const s = rippleNode(arena, good, w);
  s.style.left = `calc(${dot.style.left || "50%"} + ${Math.round(w / 2)}px)`;
  s.style.top = `calc(${dot.style.top || "50%"} + ${Math.round(w / 2)}px)`;
  arena.appendChild(s);
}

/**
 * 翻页计分：**先落数据再谈动画**——textContent 永远即时等于真比分，
 * 翻转只是那 120ms 的皮；reduced 下就是瞬换。
 */
export function flipScore(el: HTMLElement, text: string): void {
  const changed = el.textContent !== text;
  el.textContent = text;
  if (!changed || reducedMotion(el)) return;
  el.classList.remove("rbt-flip");
  // 强制回流一次，让同一个数字连着变也能重新触发翻转
  void el.offsetWidth;
  el.classList.add("rbt-flip");
  el.addEventListener("animationend", () => el.classList.remove("rbt-flip"), { once: true });
}

/** 领先方那一侧亮 4%：只读比分算出类名，绝不写回比分 */
export function markLead(bodyEl: HTMLElement, left: number, right: number): void {
  const lead = leadSide(left, right);
  bodyEl.classList.toggle("rbt-lead-l", lead === "left");
  bodyEl.classList.toggle("rbt-lead-r", lead === "right");
}

/** 回合结算时在得分方按垫上放星屑 5 颗（reduced 不生成） */
export function sparkleBurst(host: HTMLElement, rand: () => number = Math.random): void {
  if (reducedMotion(host)) return;
  const doc = host.ownerDocument;
  for (const spec of sparkleSpecs(rand)) {
    const s = doc.createElement("span");
    s.className = "rbt-spark";
    s.textContent = "✦";
    s.style.color = "#FFD678";
    s.style.fontSize = `${spec.sizePx}px`;
    s.style.animationDelay = `${spec.delayMs}ms`;
    s.style.setProperty("--rbt-spark-dx", `${spec.dx}px`);
    s.style.setProperty("--rbt-spark-dy", `${spec.dy}px`);
    s.addEventListener("animationend", () => s.remove(), { once: true });
    host.appendChild(s);
  }
}

/**
 * 点完在按垫上方冒一颗反应耗时小气泡（毫秒数由调用方从既有统计里读出来传进）。
 * 比上一次快就带一道小闪电。纯展示，不写任何统计。
 */
export function showBubble(btn: HTMLElement, ms: number, faster: boolean): void {
  if (reducedMotion(btn)) return;
  const s = btn.ownerDocument.createElement("span");
  s.className = `rbt-bubble${faster ? " rbt-bubble-fast" : ""}`;
  s.textContent = `${faster ? "⚡" : ""}${Math.round(ms)}ms`;
  s.addEventListener("animationend", () => s.remove(), { once: true });
  btn.appendChild(s);
}

export type SignalState = "idle" | "ready" | "live";

/**
 * 信号灯三态切换：只在既有的时间点被调用（预备 = bodyEl 加 rbt-ready 的那一行，
 * 出题 = paintPad(…, true) 的那一个 later 回调），时机本身一毫秒不动。
 */
export function setSignal(lamp: HTMLElement, state: SignalState, face?: SignalFace): void {
  lamp.classList.remove("rbt-signal-ready", "rbt-signal-live");
  if (face) {
    lamp.textContent = face.glyph;
    lamp.style.setProperty("--rbt-signal-hue", face.hex);
  }
  if (state === "idle") {
    lamp.style.removeProperty("--rbt-signal-hue");
    return;
  }
  // 强制回流一次，让上一轮同名动画能重新触发
  void lamp.offsetWidth;
  lamp.classList.add(state === "ready" ? "rbt-signal-ready" : "rbt-signal-live");
}

/**
 * 开局 3-2-1 倒计时浮层：整个浮层的寿命就是 CSS 里那 700ms 渐隐动画
 * （等于 restart() 既有的 later(nextRound, 700) 间隙），出题一毫秒不推迟。
 * reduced 下数字不弹，浮层只显示静止的「预备…」再渐隐。
 */
export function countdown(host: HTMLElement): void {
  host.querySelector(".rbt-count")?.remove();
  const doc = host.ownerDocument;
  const ov = doc.createElement("div");
  ov.className = "rbt-count";
  ov.setAttribute("aria-hidden", "true");
  for (const n of ["3", "2", "1"]) {
    const num = doc.createElement("span");
    num.className = "rbt-count-num";
    num.textContent = n;
    ov.appendChild(num);
  }
  ov.addEventListener("animationend", (e) => {
    if (e.target === ov) ov.remove();
  });
  host.appendChild(ov);
}

/** 连对流光：给整侧按垫来一圈 900ms 的金边（reduced 走 CSS 静态亮边） */
export function flowPulse(padRoot: HTMLElement): void {
  padRoot.classList.remove("rbt-pad-flow");
  void padRoot.offsetWidth;
  padRoot.classList.add("rbt-pad-flow");
}

/** 闯关计分徽章轻弹一下（reduced 不弹） */
export function scorePop(el: HTMLElement): void {
  if (reducedMotion(el)) return;
  el.classList.remove("rbt-pop");
  void el.offsetWidth;
  el.classList.add("rbt-pop");
  el.addEventListener("animationend", () => el.classList.remove("rbt-pop"), { once: true });
}
