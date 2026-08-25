import { mountLevelGame, shuffled, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, THEME_EMOJIS, type MemoryLevel } from "./levels";

export const meta = {
  id: "memory-cards",
  title: "记忆翻翻乐",
  emoji: "🃏",
  category: "casual" as const,
  color: "#E3F2FF",
  blurb: "99 关六大主题！偷看、章鱼换牌、三连卡、限时赛，记忆小达人冲鸭！",
};

const BACKS = ["#FFD6E7", "#D6EBFF", "#DFF7DC", "#FFF0C9", "#EBDFFF", "#FFE4D6"];

const CSS = `
.mem-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FDF0FF); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.mem-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.mem-badge { background: #fff; border-radius: 14px; padding: 5px 12px; font-weight: 700; color: #5B8FC9; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 14px; }
.mem-badge.mem-warn { color: #E8590C; }
.mem-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mem-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #8FC5FF, #C9A7F5); border-radius: 8px; transition: width .3s; }
.mem-board { display: grid; gap: 8px; }
.mem-card { aspect-ratio: 1; border: none; border-radius: 14px; font-size: clamp(20px, 6.5vw, 34px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .18s, opacity .3s, background .18s; padding: 0; box-shadow: 0 3px 6px rgba(100,140,200,.18); }
.mem-card.mem-up { background: #fff !important; transform: rotateY(180deg) scale(1.02); }
.mem-card.mem-gone { opacity: 0; pointer-events: none; }
.mem-card.mem-swap { animation: memSwap .5s ease; }
@keyframes memSwap { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-12deg) scale(1.1); } 70% { transform: rotate(12deg) scale(1.1); } }
.mem-card:active { transform: scale(.92); }
.mem-msg { text-align: center; min-height: 22px; color: #6A9BD8; font-weight: 700; margin-top: 10px; font-size: 15px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MemoryLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let ticker: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let locked = true;
  let done = false;
  let misses = 0;
  let missSinceImp = 0;
  let matched = 0;
  let open: number[] = [];
  let timeLeft = cfg.timeLimit;

  const totalCards = cfg.pairs * cfg.matchSize;
  const pool = THEME_EMOJIS[cfg.theme].slice(0, cfg.pairs);
  const deck = shuffled(
    pool.flatMap((e) => new Array<string>(cfg.matchSize).fill(e)),
    Math.random as () => number
  );
  const gone: boolean[] = new Array(totalCards).fill(false);
  const faceUp: boolean[] = new Array(totalCards).fill(false);

  const wrap = document.createElement("div");
  wrap.className = "mem-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mem-top">
      <span class="mem-badge mem-pairs">🐾 0 / ${cfg.pairs}</span>
      <span class="mem-badge mem-life">💗 可失误 ${cfg.maxMiss}</span>
      ${cfg.timeLimit > 0 ? `<span class="mem-badge mem-warn mem-time">⏰ ${cfg.timeLimit}s</span>` : ""}
    </div>
    <div class="mem-bar"><div class="mem-fill"></div></div>
    <div class="mem-board" style="grid-template-columns:repeat(${cfg.cols},1fr)"></div>
    <div class="mem-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".mem-board") as HTMLElement;
  const pairsEl = wrap.querySelector(".mem-pairs") as HTMLElement;
  const lifeEl = wrap.querySelector(".mem-life") as HTMLElement;
  const timeEl = wrap.querySelector(".mem-time") as HTMLElement | null;
  const fillEl = wrap.querySelector(".mem-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mem-msg") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const cards: HTMLButtonElement[] = [];
  for (let i = 0; i < totalCards; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mem-card";
    btn.style.background = BACKS[(i + cfg.theme) % BACKS.length];
    btn.addEventListener("click", () => onCard(i));
    boardEl.appendChild(btn);
    cards.push(btn);
  }

  function renderCard(i: number): void {
    const c = cards[i];
    c.textContent = faceUp[i] ? deck[i] : "";
    c.classList.toggle("mem-up", faceUp[i]);
    c.classList.toggle("mem-gone", gone[i]);
  }

  function renderTop(): void {
    pairsEl.textContent = `🐾 ${matched} / ${cfg.pairs}`;
    const left = Math.max(0, cfg.maxMiss - misses);
    lifeEl.textContent = `💗 可失误 ${left}`;
    fillEl.style.width = `${(matched / cfg.pairs) * 100}%`;
    if (timeEl) timeEl.textContent = `⏰ ${timeLeft}s`;
  }

  function finish(won: boolean): void {
    if (done) return;
    done = true;
    locked = true;
    if (ticker) clearInterval(ticker);
    if (won) {
      const third = Math.max(1, Math.floor(cfg.maxMiss / 3));
      const got = misses <= third ? 3 : misses <= third * 2 ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `只翻错了 ${misses} 次，记性真好！`), 400);
    } else {
      later(() => ctx.lose(cfg.timeLimit > 0 && timeLeft <= 0
        ? "时间到啦，再试一次会更快！"
        : "翻错的次数有点多，休息一下再来！"), 400);
    }
  }

  /** 调皮章鱼：随机交换两张扣着的牌 */
  function impSwap(): void {
    const hidden: number[] = [];
    for (let i = 0; i < totalCards; i++) {
      if (!gone[i] && !faceUp[i]) hidden.push(i);
    }
    if (hidden.length < 2) return;
    const a = hidden[Math.floor(Math.random() * hidden.length)];
    let b = a;
    while (b === a) b = hidden[Math.floor(Math.random() * hidden.length)];
    [deck[a], deck[b]] = [deck[b], deck[a]];
    cards[a].classList.add("mem-swap");
    cards[b].classList.add("mem-swap");
    ctx.sfx("meow");
    msgEl.textContent = "🐙 调皮章鱼换了两张牌的位置！";
    later(() => {
      cards[a].classList.remove("mem-swap");
      cards[b].classList.remove("mem-swap");
    }, 520);
  }

  function onCard(i: number): void {
    if (locked || done || gone[i] || faceUp[i]) return;
    ctx.sfx("tap");
    faceUp[i] = true;
    open.push(i);
    renderCard(i);
    if (open.length < cfg.matchSize) return;

    const group = open.slice();
    open = [];
    const same = group.every((idx) => deck[idx] === deck[group[0]]);
    if (same) {
      ctx.sfx("coin");
      matched++;
      msgEl.textContent = `配到一组 ${deck[group[0]]}！`;
      later(() => {
        group.forEach((idx) => {
          gone[idx] = true;
          renderCard(idx);
        });
        renderTop();
        if (matched >= cfg.pairs) finish(true);
      }, 350);
    } else {
      locked = true;
      misses++;
      missSinceImp++;
      renderTop();
      msgEl.textContent = "不太一样，再想想它们藏在哪～";
      later(() => {
        group.forEach((idx) => {
          faceUp[idx] = false;
          renderCard(idx);
        });
        locked = false;
        if (misses > cfg.maxMiss) {
          finish(false);
          return;
        }
        if (cfg.imp > 0 && missSinceImp >= cfg.imp) {
          missSinceImp = 0;
          impSwap();
        }
      }, cfg.matchSize === 3 ? 950 : 750);
    }
  }

  // 开局提示 / 偷看 / 计时
  deck.forEach((_, i) => renderCard(i));
  renderTop();
  if (cfg.peekMs > 0) {
    msgEl.textContent = "👀 快记住它们的位置！";
    faceUp.fill(true);
    deck.forEach((_, i) => renderCard(i));
    later(() => {
      faceUp.fill(false);
      deck.forEach((_, i) => renderCard(i));
      locked = false;
      msgEl.textContent = cfg.matchSize === 3 ? "三张一样的才算一组哦！" : "开始配对吧！";
    }, cfg.peekMs);
  } else {
    locked = false;
    msgEl.textContent = cfg.matchSize === 3
      ? "三张一样的才算一组哦！"
      : cfg.imp > 0
        ? "小心调皮章鱼捣乱！"
        : "点击卡片翻开，找到一样的图案！";
  }
  if (cfg.timeLimit > 0) {
    ticker = setInterval(() => {
      if (destroyed || done) return;
      timeLeft--;
      renderTop();
      if (timeLeft <= 0) finish(false);
    }, 1000);
  }

  return {
    destroy() {
      destroyed = true;
      done = true;
      if (ticker) clearInterval(ticker);
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "翻错越少星星越多，六大主题等你挑战！",
    grandMessage: "99 关全部配对成功，超级记忆小达人！",
  });
}
