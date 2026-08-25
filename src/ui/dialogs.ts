/**
 * 通用弹窗:胜利 / 失败 / 家长面板都基于它。
 */

export interface DialogButton {
  label: string;
  kind?: "primary" | "ghost";
  onClick: () => void;
}

export interface DialogHandle {
  close: () => void;
  el: HTMLElement;
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

  if (opts.buttons && opts.buttons.length > 0) {
    const row = document.createElement("div");
    row.className = "dialog-buttons";
    for (const btn of opts.buttons) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `btn ${btn.kind === "ghost" ? "btn--ghost" : "btn--primary"}`;
      b.textContent = btn.label;
      b.addEventListener("click", () => {
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

  const face = document.createElement("div");
  face.className = "result-face";
  face.textContent = opts.win ? pick(WIN_FACES) : pick(LOSE_FACES);
  content.appendChild(face);

  const title = document.createElement("h2");
  title.className = "result-title";
  title.textContent = opts.win ? pick(WIN_TITLES) : pick(LOSE_TITLES);
  content.appendChild(title);

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
    }
    content.appendChild(starRow);
  }

  const msg = document.createElement("p");
  msg.className = "result-message";
  msg.textContent =
    opts.message ?? (opts.win ? pick(WIN_MESSAGES) : pick(LOSE_MESSAGES));
  content.appendChild(msg);

  return showDialog({
    className: opts.win ? "dialog--win" : "dialog--lose",
    content,
    buttons: [
      { label: "🔁 再玩一次", kind: "primary", onClick: opts.onReplay },
      { label: "🏠 回首页", kind: "ghost", onClick: opts.onHome }
    ]
  });
}
