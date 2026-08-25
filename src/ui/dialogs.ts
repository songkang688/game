/**
 * 通用弹窗:胜利 / 失败 / 家长面板都基于它。
 */
import { createAvatarImg } from "./avatars";
import { playSound } from "../engine/audio";
import { speak, stopSpeaking } from "../games/speech";

export interface DialogButton {
  label: string;
  kind?: "primary" | "ghost";
  onClick: () => void;
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

export function showDialog(opts: {
  className?: string;
  content: HTMLElement;
  buttons?: DialogButton[];
  /** 点遮罩是否可以关闭,默认 false(避免小朋友误触) */
  dismissible?: boolean;
}): DialogHandle {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const dialog = document.createElement("div");
  dialog.className = `dialog ${opts.className ?? ""}`.trim();
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.appendChild(opts.content);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    overlay.classList.add("overlay--closing");
    window.setTimeout(() => overlay.remove(), 160);
  };

  const shownAt = performance.now();

  if (opts.buttons && opts.buttons.length > 0) {
    const row = document.createElement("div");
    row.className = "dialog-buttons";
    for (const btn of opts.buttons) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${btn.kind === "ghost" ? "btn--ghost" : "btn--primary"}`;
      b.textContent = btn.label;
      b.addEventListener("click", () => {
        // 冷静期内的点击是孩子狂点的余波,不当成选择
        if (isGuardedClick(shownAt, performance.now())) return;
        close();
        btn.onClick();
      });
      row.appendChild(b);
    }
    dialog.appendChild(row);
  }

  if (opts.dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
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

/** 胜负结算弹窗 */
export function showResultDialog(opts: {
  win: boolean;
  stars?: 1 | 2 | 3;
  message?: string;
  onReplay: () => void;
  onHome: () => void;
}): DialogHandle {
  const content = document.createElement("div");
  content.className = "result-content";

  // 朵朵和星星出来一起庆祝 / 打气
  const buddies = document.createElement("div");
  buddies.className = `result-buddies ${opts.win ? "result-buddies--win" : "result-buddies--lose"}`;
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
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("span");
      s.className = i < earned ? "star star--on" : "star";
      s.textContent = i < earned ? "⭐" : "☆";
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
