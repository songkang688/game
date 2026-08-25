export const meta = {
  id: "memory-cards",
  title: "记忆翻翻乐",
  emoji: "🃏",
  category: "casual" as const,
  color: "#E3F2FF",
  blurb: "翻开卡片找到一样的小动物，考考你的小脑瓜！",
};

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const EMOJIS = ["🐱", "🐶", "🦊", "🐰", "🐼", "🦄", "🐸", "🐥"];
const BACKS = ["#FFD6E7", "#D6EBFF", "#DFF7DC", "#FFF0C9"];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let finished = false;
  let locked = false;
  let firstIdx = -1;
  let attempts = 0;
  let matchedPairs = 0;

  const deck: string[] = [...EMOJIS, ...EMOJIS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const faceUp: boolean[] = new Array(16).fill(false);
  const gone: boolean[] = new Array(16).fill(false);

  const wrap = document.createElement("div");
  wrap.className = "mem-wrap";
  wrap.innerHTML = `
    <style>
      .mem-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FDF0FF); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; }
      .mem-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
      .mem-badge { background: #fff; border-radius: 14px; padding: 6px 14px; font-weight: 700; color: #5B8FC9; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 15px; }
      .mem-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .mem-card { aspect-ratio: 1; border: none; border-radius: 14px; font-size: clamp(24px, 8vw, 40px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .18s, opacity .3s, background .18s; padding: 0; box-shadow: 0 3px 6px rgba(100,140,200,.18); }
      .mem-card.mem-down { transform: none; }
      .mem-card.mem-up { background: #fff !important; transform: rotateY(180deg) scale(1.02); }
      .mem-card.mem-gone { opacity: 0; pointer-events: none; }
      .mem-card:active { transform: scale(.92); }
      .mem-msg { text-align: center; min-height: 22px; color: #6A9BD8; font-weight: 700; margin-top: 10px; font-size: 15px; }
    </style>
    <div class="mem-top">
      <span class="mem-badge mem-pairs">🐾 配对 0 / 8</span>
      <span class="mem-badge mem-tries">🔍 翻了 0 次</span>
    </div>
    <div class="mem-board"></div>
    <div class="mem-msg">点击卡片翻开，找到两只一样的小动物！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".mem-board") as HTMLElement;
  const pairsEl = wrap.querySelector(".mem-pairs") as HTMLElement;
  const triesEl = wrap.querySelector(".mem-tries") as HTMLElement;
  const msgEl = wrap.querySelector(".mem-msg") as HTMLElement;

  const cards: HTMLButtonElement[] = [];
  for (let i = 0; i < 16; i++) {
    const btn = document.createElement("button");
    btn.className = "mem-card mem-down";
    btn.type = "button";
    btn.style.background = BACKS[i % BACKS.length];
    btn.textContent = "❓";
    btn.addEventListener("click", () => onCard(i));
    boardEl.appendChild(btn);
    cards.push(btn);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!finished) fn();
    }, ms);
    timeouts.add(t);
  }

  function renderCard(i: number): void {
    const el = cards[i];
    if (gone[i]) {
      el.classList.add("mem-gone");
      return;
    }
    if (faceUp[i]) {
      el.classList.remove("mem-down");
      el.classList.add("mem-up");
      el.textContent = deck[i];
    } else {
      el.classList.remove("mem-up");
      el.classList.add("mem-down");
      el.textContent = "❓";
    }
  }

  function updateTop(): void {
    pairsEl.textContent = `🐾 配对 ${matchedPairs} / 8`;
    triesEl.textContent = `🔍 翻了 ${attempts} 次`;
  }

  function onCard(i: number): void {
    if (finished || locked || faceUp[i] || gone[i]) return;
    api.play("tap");
    faceUp[i] = true;
    renderCard(i);

    if (firstIdx === -1) {
      firstIdx = i;
      return;
    }

    const a = firstIdx;
    firstIdx = -1;
    attempts++;
    updateTop();

    if (deck[a] === deck[i]) {
      matchedPairs++;
      api.play("coin");
      msgEl.textContent = `找到啦！两只 ${deck[i]} 手拉手回家咯～`;
      later(() => {
        gone[a] = true;
        gone[i] = true;
        renderCard(a);
        renderCard(i);
        updateTop();
        if (matchedPairs === 8) {
          finished = true;
          const stars: 1 | 2 | 3 = attempts <= 11 ? 3 : attempts <= 15 ? 2 : 1;
          api.play("win");
          api.onWin(stars, `翻了 ${attempts} 次就全部配对，记忆力真棒！`);
        }
      }, 450);
    } else {
      locked = true;
      api.play("oops");
      msgEl.textContent = "不一样哦，记住它们的位置！";
      later(() => {
        faceUp[a] = false;
        faceUp[i] = false;
        renderCard(a);
        renderCard(i);
        locked = false;
      }, 800);
    }
  }

  updateTop();

  return {
    destroy() {
      finished = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}
