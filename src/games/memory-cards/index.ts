export const meta = {
  id: "memory-cards",
  title: "记忆翻翻乐",
  emoji: "🃏",
  category: "casual" as const,
  color: "#E3F2FF",
  blurb: "五关记忆挑战！卡片越来越多，还有调皮精灵偷偷换位置！",
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

const EMOJIS = ["🐱", "🐶", "🦊", "🐰", "🐼", "🦄", "🐸", "🐥", "🐷", "🐨", "🦁", "🐙"];
const BACKS = ["#FFD6E7", "#D6EBFF", "#DFF7DC", "#FFF0C9"];

interface LevelConfig {
  pairs: number;
  cols: number;
  /** 允许翻错的次数（超过就本关重来） */
  maxMiss: number;
  /** 调皮精灵：每翻错几次就交换两张扣着的牌，0 表示没有精灵 */
  imp: number;
}

const LEVELS: LevelConfig[] = [
  { pairs: 3, cols: 3, maxMiss: 6, imp: 0 },
  { pairs: 4, cols: 4, maxMiss: 8, imp: 0 },
  { pairs: 6, cols: 4, maxMiss: 11, imp: 0 },
  { pairs: 8, cols: 4, maxMiss: 14, imp: 3 },
  { pairs: 10, cols: 5, maxMiss: 17, imp: 3 },
];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let locked = false;
  let levelDone = false;

  let level = 0;
  let retries = 0;
  let firstIdx = -1;
  let misses = 0;
  let missSinceImp = 0;
  let combo = 0;
  let matchedPairs = 0;

  let deck: string[] = [];
  let faceUp: boolean[] = [];
  let gone: boolean[] = [];
  let cards: HTMLButtonElement[] = [];

  const wrap = document.createElement("div");
  wrap.className = "mem-wrap";
  wrap.innerHTML = `
    <style>
      .mem-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FDF0FF); border-radius: 20px; padding: 14px; max-width: 420px; margin: 0 auto; user-select: none; position: relative; }
      .mem-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
      .mem-badge { background: #fff; border-radius: 14px; padding: 5px 12px; font-weight: 700; color: #5B8FC9; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 14px; }
      .mem-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
      .mem-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #8FC5FF, #C9A7F5); border-radius: 8px; transition: width .3s; }
      .mem-board { display: grid; gap: 8px; }
      .mem-card { aspect-ratio: 1; border: none; border-radius: 14px; font-size: clamp(22px, 7vw, 38px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .18s, opacity .3s, background .18s; padding: 0; box-shadow: 0 3px 6px rgba(100,140,200,.18); }
      .mem-card.mem-up { background: #fff !important; transform: rotateY(180deg) scale(1.02); }
      .mem-card.mem-gone { opacity: 0; pointer-events: none; }
      .mem-card.mem-swap { animation: memSwap .5s ease; }
      @keyframes memSwap { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-12deg) scale(1.1); } 70% { transform: rotate(12deg) scale(1.1); } }
      .mem-card:active { transform: scale(.92); }
      .mem-msg { text-align: center; min-height: 22px; color: #6A9BD8; font-weight: 700; margin-top: 10px; font-size: 15px; }
      .mem-overlay { position: absolute; inset: 0; background: rgba(240,248,255,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .mem-ov-big { font-size: 52px; }
      .mem-ov-title { font-size: 24px; font-weight: 900; color: #5B8FC9; }
      .mem-ov-sub { font-size: 16px; font-weight: 700; color: #7FA8D6; line-height: 1.6; }
      .mem-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#7FBFFF,#4D97E8); cursor: pointer; box-shadow: 0 5px 0 #3576BF; font-family: inherit; }
      .mem-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #3576BF; }
    </style>
    <div class="mem-top">
      <span class="mem-badge mem-level">🚩 第 1 关</span>
      <span class="mem-badge mem-pairs">🐾 0 / 3</span>
      <span class="mem-badge mem-life">💗</span>
    </div>
    <div class="mem-bar"><div class="mem-fill"></div></div>
    <div class="mem-board"></div>
    <div class="mem-msg">点击卡片翻开，找到两只一样的小动物！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".mem-board") as HTMLElement;
  const levelEl = wrap.querySelector(".mem-level") as HTMLElement;
  const pairsEl = wrap.querySelector(".mem-pairs") as HTMLElement;
  const lifeEl = wrap.querySelector(".mem-life") as HTMLElement;
  const fillEl = wrap.querySelector(".mem-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mem-msg") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function cfg(): LevelConfig {
    return LEVELS[level];
  }

  function setupLevel(): void {
    const c = cfg();
    levelDone = false;
    locked = false;
    firstIdx = -1;
    misses = 0;
    missSinceImp = 0;
    combo = 0;
    matchedPairs = 0;

    const picks = EMOJIS.slice(0, c.pairs);
    deck = [...picks, ...picks];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    faceUp = new Array(deck.length).fill(false);
    gone = new Array(deck.length).fill(false);

    boardEl.style.gridTemplateColumns = `repeat(${c.cols}, 1fr)`;
    boardEl.innerHTML = "";
    cards = [];
    for (let i = 0; i < deck.length; i++) {
      const btn = document.createElement("button");
      btn.className = "mem-card";
      btn.type = "button";
      btn.style.background = BACKS[i % BACKS.length];
      btn.textContent = "❓";
      const idx = i;
      btn.addEventListener("click", () => onCard(idx));
      boardEl.appendChild(btn);
      cards.push(btn);
    }
    updateTop();
    msgEl.textContent = c.imp > 0
      ? "小心！调皮精灵会趁你翻错时偷偷换牌哦～"
      : "点击卡片翻开，找到两只一样的小动物！";
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
      el.textContent = "❓";
    }
  }

  function updateTop(): void {
    const c = cfg();
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
    pairsEl.textContent = `🐾 ${matchedPairs} / ${c.pairs}`;
    const left = Math.max(0, c.maxMiss - misses);
    lifeEl.textContent = left > 4 ? `💗 还能错 ${left} 次` : "💗".repeat(Math.max(0, left)) || "🤍";
    fillEl.style.width = `${(matchedPairs / c.pairs) * 100}%`;
  }

  function impSwap(): void {
    // 调皮精灵：随机挑两张扣着的、还没消失的牌互换
    const downs: number[] = [];
    for (let i = 0; i < deck.length; i++) if (!faceUp[i] && !gone[i]) downs.push(i);
    if (downs.length < 2) return;
    const a = downs[Math.floor(Math.random() * downs.length)];
    let b = a;
    while (b === a) b = downs[Math.floor(Math.random() * downs.length)];
    [deck[a], deck[b]] = [deck[b], deck[a]];
    api.play("meow");
    msgEl.textContent = "😜 调皮精灵把两张牌换了位置！";
    for (const i of [a, b]) {
      cards[i].classList.remove("mem-swap");
      void cards[i].offsetWidth;
      cards[i].classList.add("mem-swap");
    }
  }

  function showOverlay(kind: "next" | "retry"): void {
    const ov = document.createElement("div");
    ov.className = "mem-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="mem-ov-big">🎉</div>
        <div class="mem-ov-title">第 ${level + 1} 关完成！</div>
        <div class="mem-ov-sub">只翻错 ${misses} 次，记忆力真棒！</div>
        <button class="mem-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".mem-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        setupLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="mem-ov-big">🌧️</div>
        <div class="mem-ov-title">翻错次数用完啦</div>
        <div class="mem-ov-sub">没关系，位置都看熟了，这关再来一次！</div>
        <button class="mem-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".mem-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        setupLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function onCard(i: number): void {
    if (levelDone || locked || faceUp[i] || gone[i]) return;
    api.play("tap");
    faceUp[i] = true;
    renderCard(i);

    if (firstIdx === -1) {
      firstIdx = i;
      return;
    }

    const a = firstIdx;
    firstIdx = -1;

    if (deck[a] === deck[i]) {
      matchedPairs++;
      combo++;
      api.play("coin");
      if (combo >= 2) {
        msgEl.textContent = `连续配对 x${combo}！${deck[i]} 手拉手回家咯～`;
        if (combo === 3) {
          api.addStars(1);
          msgEl.textContent = "🎁 连对三次，奖励一颗小星星！";
        }
      } else {
        msgEl.textContent = `找到啦！两只 ${deck[i]} 手拉手回家咯～`;
      }
      updateTop();
      later(() => {
        gone[a] = true;
        gone[i] = true;
        renderCard(a);
        renderCard(i);
        if (matchedPairs >= cfg().pairs) {
          levelDone = true;
          api.play("win");
          if (level >= LEVELS.length - 1) {
            const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
            later(() => api.onWin(stars, `五关记忆挑战全部完成，你的小脑瓜太厉害啦！`), 400);
          } else {
            later(() => showOverlay("next"), 400);
          }
        }
      }, 450);
    } else {
      locked = true;
      misses++;
      combo = 0;
      missSinceImp++;
      api.play("oops");
      msgEl.textContent = "不一样哦，记住它们的位置！";
      updateTop();
      later(() => {
        faceUp[a] = false;
        faceUp[i] = false;
        renderCard(a);
        renderCard(i);
        locked = false;
        if (misses >= cfg().maxMiss) {
          levelDone = true;
          api.play("oops");
          showOverlay("retry");
          return;
        }
        const c = cfg();
        if (c.imp > 0 && missSinceImp >= c.imp) {
          missSinceImp = 0;
          impSwap();
        }
      }, 800);
    }
  }

  setupLevel();

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}
