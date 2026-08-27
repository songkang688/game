/**
 * 通用弹窗:胜利 / 失败 / 暂停 / 家长面板都基于它。
 *
 * 无障碍要点(1.1 第 12 步):
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`(拿弹窗里的标题当名字);
 * - 打开时焦点落到第一个可聚焦元素,Tab / Shift+Tab 只在弹窗内部打转(焦点陷阱);
 * - `Esc` 关闭(不可关闭的弹窗除外),关闭后焦点回到打开它的那个按钮;
 * - 胜负与得分走一个全局 `aria-live` 播报区,读屏软件能听到。
 */
import { createAvatarImg } from "./avatars";
import { playSound } from "../engine/audio";
import { speak, stopSpeaking } from "../games/speech";

export interface DialogButton {
  label: string;
  kind?: "primary" | "ghost";
  onClick: () => void;
  /** 点完不关弹窗(音效开关这类原地切换的按钮) */
  keepOpen?: boolean;
  /** 开关型按钮的按下态,会写进 aria-pressed */
  pressed?: boolean;
  /** 覆盖朗读名字(按钮上是图标 + 短词时用) */
  ariaLabel?: string;
}

export interface DialogHandle {
  close: () => void;
  el: HTMLElement;
}

/**
 * 弹窗/结算浮层刚弹出的「冷静期」(毫秒):
 * 狂点型玩法(拔河、点点、地鼠…)里孩子的手停不下来,胜负一出手指还在连点,
 * 没有冷静期时会瞬间误触「再玩一次/下一关/回首页」,结果画面根本没看到。
 */
export const CLICK_GUARD_MS = 400;

/** 弹出后 nowMs 距 shownAtMs 不足冷静期时,应忽略这次点击(纯函数便于测试) */
export function isGuardedClick(shownAtMs: number, nowMs: number, guardMs = CLICK_GUARD_MS): boolean {
  return nowMs - shownAtMs < guardMs;
}

/** 能接受键盘焦点的元素(焦点陷阱用它收集弹窗内部的落点) */
export const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

/** 这个按键算不算「关掉弹窗」(Esc,老浏览器上是 Escape 的旧名字) */
export function isDismissKey(key: string | undefined): boolean {
  return key === "Escape" || key === "Esc";
}

/**
 * 焦点陷阱里 Tab / Shift+Tab 的下一个落点下标(纯函数)。
 * `current` 传 -1 表示焦点当前不在弹窗里:此时 Tab 回到第一个、Shift+Tab 回到最后一个。
 */
export function nextFocusIndex(count: number, current: number, shift = false): number {
  if (!Number.isFinite(count) || count <= 0) return -1;
  const n = Math.floor(count);
  if (current < 0 || current >= n) return shift ? n - 1 : 0;
  return (current + (shift ? -1 : 1) + n) % n;
}

// ---------------------------------------------------------------------------
// 全局播报区(读屏软件用):分数变化、胜负结果都往这儿写
// ---------------------------------------------------------------------------

/** index.html 里那个视觉隐藏的播报区 id */
export const LIVE_REGION_ID = "a11y-live";

function docOf(node?: { ownerDocument?: Document | null } | null): Document | null {
  const fromNode = node?.ownerDocument ?? null;
  if (fromNode) return fromNode;
  return (globalThis as { document?: Document }).document ?? null;
}

/** 拿到(必要时补建)全局播报区 */
export function liveRegion(doc?: Document | null): HTMLElement | null {
  const d = doc ?? docOf();
  if (!d?.body) return null;
  const existing = d.getElementById?.(LIVE_REGION_ID);
  if (existing) return existing as HTMLElement;
  const el = d.createElement("div");
  el.id = LIVE_REGION_ID;
  el.className = "sr-only";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  d.body.appendChild(el);
  return el;
}

/**
 * 往播报区写一句话。
 * 连着播报同一句时读屏软件会当成「没变化」而不念,所以相同内容补一个不可见的空格。
 */
export function announce(message: string, doc?: Document | null): void {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return;
  const region = liveRegion(doc);
  if (!region) return;
  region.textContent = region.textContent === text ? `${text}\u00a0` : text;
}

/** 星星余额播报文案(纯函数) */
export function starsAnnouncement(stars: number): string {
  const n = Number.isFinite(stars) ? Math.max(0, Math.floor(stars)) : 0;
  return `现在有 ${n} 颗星星`;
}

/** 胜负播报文案(纯函数) */
export function resultAnnouncement(win: boolean, stars?: number, message?: string): string {
  const tail = typeof message === "string" && message.trim() ? `,${message.trim()}` : "";
  if (!win) return `这一局没过关${tail}`;
  const n = Number.isFinite(stars) ? Math.max(0, Math.floor(stars as number)) : 0;
  return `过关啦,拿到 ${n} 颗星星${tail}`;
}

// ---------------------------------------------------------------------------
// 弹窗
// ---------------------------------------------------------------------------

let dialogSeq = 0;

interface DialogEnv {
  doc: Document;
  setTimeout: (fn: () => void, ms: number) => number;
  now: () => number;
}

function envOf(doc: Document): DialogEnv {
  const g = globalThis as {
    setTimeout?: (fn: () => void, ms: number) => unknown;
    performance?: { now?: () => number };
  };
  return {
    doc,
    setTimeout: (fn, ms) => Number(g.setTimeout ? g.setTimeout(fn, ms) : 0),
    now: () => (typeof g.performance?.now === "function" ? g.performance.now() : Date.now())
  };
}

/** 弹窗内部所有能聚焦的元素,按 DOM 顺序 */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  const found = root.querySelectorAll?.(FOCUSABLE_SELECTOR);
  return found ? (Array.from(found) as HTMLElement[]) : [];
}

export interface DialogOptions {
  className?: string;
  content: HTMLElement;
  buttons?: DialogButton[];
  /** 点遮罩是否可以关闭,默认 false(避免小朋友误触) */
  dismissible?: boolean;
  /** 弹窗的无障碍名字;不传就用弹窗里第一个标题 */
  label?: string;
  /** Esc 是否能关掉,默认 true */
  escapable?: boolean;
  /** Esc / 遮罩关掉时额外做的事(点按钮关掉不会触发) */
  onDismiss?: () => void;
  /** 关掉后把焦点还给谁,默认还给打开弹窗前的那个元素 */
  returnFocusTo?: HTMLElement | null;
}

export function showDialog(opts: DialogOptions): DialogHandle {
  const doc = docOf(opts.content) ?? (globalThis as unknown as { document: Document }).document;
  const env = envOf(doc);
  const escapable = opts.escapable !== false;
  const trigger =
    opts.returnFocusTo !== undefined
      ? opts.returnFocusTo
      : ((doc.activeElement as HTMLElement | null) ?? null);

  const overlay = doc.createElement("div");
  overlay.className = "overlay";

  const dialog = doc.createElement("div");
  dialog.className = `dialog ${opts.className ?? ""}`.trim();
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.appendChild(opts.content);

  // 无障碍名字:优先用调用方给的,其次认弹窗里的第一个标题
  const heading = opts.content.querySelector?.("h1,h2,h3") as HTMLElement | null;
  if (opts.label) {
    dialog.setAttribute("aria-label", opts.label);
  } else if (heading) {
    if (!heading.id) heading.id = `dialog-title-${++dialogSeq}`;
    dialog.setAttribute("aria-labelledby", heading.id);
  }

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    doc.removeEventListener("keydown", onKeyDown, true);
    overlay.classList.add("overlay--closing");
    env.setTimeout(() => overlay.remove(), 160);
    // 关掉后焦点回到打开它的按钮,不然读屏软件会掉回 <body> 从头念
    try {
      trigger?.focus?.();
    } catch {
      // 触发元素已经被移除就算了
    }
  };

  const dismiss = (): void => {
    close();
    opts.onDismiss?.();
  };

  function onKeyDown(e: KeyboardEvent): void {
    if (closed) return;
    if (isDismissKey(e.key)) {
      if (!escapable) return;
      e.preventDefault();
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== "Tab") return;
    const list = focusablesIn(dialog);
    if (list.length === 0) return;
    // 焦点陷阱:Tab / Shift+Tab 只在弹窗里的可聚焦元素之间循环
    const active = doc.activeElement as HTMLElement | null;
    const at = active ? list.indexOf(active) : -1;
    const next = list[nextFocusIndex(list.length, at, e.shiftKey === true)];
    e.preventDefault();
    next?.focus?.();
  }

  const shownAt = env.now();

  if (opts.buttons && opts.buttons.length > 0) {
    const row = doc.createElement("div");
    row.className = "dialog-buttons";
    for (const btn of opts.buttons) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = `btn ${btn.kind === "ghost" ? "btn--ghost" : "btn--primary"}`;
      b.textContent = btn.label;
      if (btn.ariaLabel) b.setAttribute("aria-label", btn.ariaLabel);
      if (typeof btn.pressed === "boolean") b.setAttribute("aria-pressed", String(btn.pressed));
      b.addEventListener("click", () => {
        // 冷静期内的点击是孩子狂点的余波,不当成选择
        if (isGuardedClick(shownAt, env.now())) return;
        if (!btn.keepOpen) close();
        btn.onClick();
      });
      row.appendChild(b);
    }
    dialog.appendChild(row);
  }

  if (opts.dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismiss();
    });
  }

  overlay.appendChild(dialog);
  doc.body.appendChild(overlay);

  doc.addEventListener("keydown", onKeyDown, true);
  // 打开就把焦点送进弹窗,键盘用户不用先 Tab 一圈才够得着按钮
  const first = focusablesIn(dialog)[0];
  if (first?.focus) {
    first.focus();
  } else {
    dialog.setAttribute("tabindex", "-1");
    dialog.focus?.();
  }

  return { close, el: dialog };
}

const WIN_FACES = ["🎉", "🥳", "🌟", "🎈"];
const WIN_TITLES = ["太棒啦!", "好厉害呀!", "真了不起!"];
const WIN_MESSAGES = [
  "你真厉害,星星收好啦!",
  "闪闪的星星送给你!",
  "哇,你越来越棒了!"
];
const LOSE_FACES = ["🌦️", "🫧", "🌱"];
const LOSE_TITLES = ["差一点点!", "就差一点啦!", "快成功啦!"];
const LOSE_MESSAGES = [
  "没关系,再来一次一定行!",
  "深呼吸,下一次会更棒!",
  "你已经很努力啦,再试试看!"
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}

/** 结算弹窗要朗读的整句话：标题 + 鼓励语连读（一年级孩子靠听懂结果） */
export function resultSpeechLine(title: string, message: string): string {
  return `${title}${message}`;
}

/** 三颗星星的读屏文案(纯函数):视觉上是 ⭐☆☆,听起来得是「拿到 1 颗星,共 3 颗」 */
export function starRowLabel(earned: number, total = 3): string {
  const t = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 3;
  const n = Number.isFinite(earned) ? Math.min(t, Math.max(0, Math.floor(earned))) : 0;
  return `拿到 ${n} 颗星星,一共 ${t} 颗`;
}

/** 胜负结算弹窗 */
export function showResultDialog(opts: {
  win: boolean;
  stars?: 1 | 2 | 3;
  message?: string;
  onReplay: () => void;
  onHome: () => void;
  /** 关掉后焦点还给谁 */
  returnFocusTo?: HTMLElement | null;
  /** 按 Esc 关掉结算面板时通知壳层(不重开也不回首页,停在结算后的画面) */
  onDismiss?: () => void;
}): DialogHandle {
  const content = document.createElement("div");
  content.className = "result-content";

  // 鸭梨和康康出来一起庆祝 / 打气
  const buddies = document.createElement("div");
  buddies.className = `result-buddies ${opts.win ? "result-buddies--win" : "result-buddies--lose"}`;
  buddies.setAttribute("aria-hidden", "true");
  if (opts.win) {
    buddies.append(
      createAvatarImg("duoduoCheer", { round: false, className: "result-buddy" }),
      createAvatarImg("xingxingRun", { round: false, className: "result-buddy" })
    );
  } else {
    buddies.append(
      createAvatarImg("duoduo", { className: "result-buddy result-buddy--round" }),
      createAvatarImg("xingxing", { className: "result-buddy result-buddy--round" })
    );
  }
  content.appendChild(buddies);

  const face = document.createElement("div");
  face.className = "result-face";
  face.setAttribute("aria-hidden", "true");
  face.textContent = opts.win ? pick(WIN_FACES) : pick(LOSE_FACES);
  content.appendChild(face);

  const title = document.createElement("h2");
  title.className = "result-title";
  const titleText = opts.win ? pick(WIN_TITLES) : pick(LOSE_TITLES);
  title.textContent = titleText;
  content.appendChild(title);

  // 三星逐颗弹出的音效节奏,与星星动画的 delay 对齐
  const starTimers: number[] = [];
  const clearStarTimers = (): void => {
    for (const t of starTimers) window.clearTimeout(t);
    starTimers.length = 0;
  };

  if (opts.win) {
    const confetti = document.createElement("div");
    confetti.className = "result-confetti";
    confetti.setAttribute("aria-hidden", "true");
    confetti.textContent = "🎊 ✨ 🎊";
    content.appendChild(confetti);

    const starRow = document.createElement("div");
    starRow.className = "result-stars";
    const earned = opts.stars ?? 1;
    // 一排 ⭐☆☆ 对读屏软件毫无意义,整排给一句话,单颗一律隐藏
    starRow.setAttribute("role", "img");
    starRow.setAttribute("aria-label", starRowLabel(earned));
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("span");
      s.className = i < earned ? "star star--on" : "star";
      s.textContent = i < earned ? "⭐" : "☆";
      s.setAttribute("aria-hidden", "true");
      s.style.animationDelay = `${0.15 + i * 0.18}s`;
      starRow.appendChild(s);
      if (i < earned) {
        starTimers.push(window.setTimeout(() => playSound("coin"), 150 + i * 180));
      }
    }
    content.appendChild(starRow);
  }

  const msg = document.createElement("p");
  msg.className = "result-message";
  const msgText =
    opts.message ?? (opts.win ? pick(WIN_MESSAGES) : pick(LOSE_MESSAGES));
  msg.textContent = msgText;
  content.appendChild(msg);

  const handle = showDialog({
    className: opts.win ? "dialog--win" : "dialog--lose",
    content,
    returnFocusTo: opts.returnFocusTo,
    // Esc 只是把面板收起来看一眼画面,重玩 / 回首页仍要自己选(再按一次 Esc 就是暂停面板)
    onDismiss: () => {
      stopSpeaking();
      clearStarTimers();
      opts.onDismiss?.();
    },
    buttons: [
      {
        label: "🔁 再玩一次",
        kind: "primary",
        onClick: () => {
          stopSpeaking();
          clearStarTimers();
          opts.onReplay();
        }
      },
      {
        label: "🏠 回首页",
        kind: "ghost",
        onClick: () => {
          stopSpeaking();
          clearStarTimers();
          opts.onHome();
        }
      }
    ]
  });

  // 读屏软件听得到的结果播报(和朗读并行,互不影响)
  announce(resultAnnouncement(opts.win, opts.stars, msgText));

  // 弹出即朗读结果:识字量不够的孩子也能"听"到夸奖;无中文语音包时静默
  speak(resultSpeechLine(titleText, msgText));

  return {
    el: handle.el,
    close: () => {
      stopSpeaking();
      clearStarTimers();
      handle.close();
    }
  };
}
