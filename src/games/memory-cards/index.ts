import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  CHAPTERS,
  LEVELS,
  buildDeck,
  deckSeed,
  rotatePositions,
  type MemoryCard,
  type MemoryLevel,
} from "./levels";

const BACKS = ["#FFD6E7", "#D6EBFF", "#DFF7DC", "#FFF0C9", "#EBDFFF", "#FFE4D6"];

const CSS = `
.mem-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FDF0FF); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.mem-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.mem-badge { background: #fff; border-radius: 14px; padding: 5px 12px; font-weight: 700; color: #5B8FC9; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 14px; }
.mem-badge.mem-warn { color: #E8590C; }
.mem-badge.mem-spin { color: #C065A8; }
.mem-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mem-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #8FC5FF, #C9A7F5); border-radius: 8px; transition: width .3s; }
.mem-board { display: grid; gap: 8px; }
.mem-card { aspect-ratio: 1; border: none; border-radius: 14px; font-size: clamp(20px, 6.5vw, 34px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .18s, opacity .3s, background .18s; padding: 0; box-shadow: 0 3px 6px rgba(100,140,200,.18); }
.mem-card.mem-up { background: #fff !important; transform: rotateY(180deg) scale(1.02); }
.mem-card.mem-text { font-size: clamp(13px, 4.2vw, 20px); font-weight: 800; color: #4B7BB5; letter-spacing: .5px; }
.mem-card.mem-gone { opacity: 0; pointer-events: none; }
.mem-card.mem-swap { animation: memSwap .5s ease; }
.mem-card.mem-turn { animation: memTurn .45s ease; }
.mem-card.mem-ghost { animation: memGhost .5s ease; }
@keyframes memSwap { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-12deg) scale(1.1); } 70% { transform: rotate(12deg) scale(1.1); } }
@keyframes memTurn { 0% { transform: rotate(0) scale(1); } 50% { transform: rotate(180deg) scale(.82); } 100% { transform: rotate(360deg) scale(1); } }
@keyframes memGhost { 0%,100% { opacity: 1; } 50% { opacity: .35; transform: scale(.9); } }
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
  let flipsSinceTurn = 0;
  let open: number[] = [];
  let timeLeft = cfg.timeLimit;

  const deck: MemoryCard[] = buildDeck(cfg, deckSeed(ctx.level) + Math.floor(Math.random() * 997));
  const totalCards = deck.length;
  /** order[格子] = 牌号；旋转木马厅会把这张表整体挪一格 */
  let order: number[] = deck.map((_, i) => i);
  const gone: boolean[] = new Array(totalCards).fill(false);
  const faceUp: boolean[] = new Array(totalCards).fill(false);

  const rotateEvery = cfg.rotateEvery ?? 0;
  const decoys = cfg.decoys ?? 0;

  const wrap = document.createElement("div");
  wrap.className = "mem-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mem-top">
      <span class="mem-badge mem-pairs">🐾 0 / ${cfg.pairs}</span>
      <span class="mem-badge mem-life">💗 可失误 ${cfg.maxMiss}</span>
      ${rotateEvery > 0 ? `<span class="mem-badge mem-spin mem-turnbadge">🎠 还有 ${rotateEvery} 翻</span>` : ""}
      ${decoys > 0 ? `<span class="mem-badge mem-spin">🌫️ 独苗卡 ${decoys}</span>` : ""}
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
  const turnEl = wrap.querySelector(".mem-turnbadge") as HTMLElement | null;
  const fillEl = wrap.querySelector(".mem-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mem-msg") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const slots: HTMLButtonElement[] = [];
  for (let s = 0; s < totalCards; s++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mem-card";
    btn.style.background = BACKS[(s + cfg.theme) % BACKS.length];
    btn.addEventListener("click", () => onSlot(s));
    boardEl.appendChild(btn);
    slots.push(btn);
  }

  function renderSlot(s: number): void {
    const btn = slots[s];
    const card = order[s];
    const up = faceUp[card];
    btn.textContent = up ? deck[card].face : "";
    btn.classList.toggle("mem-up", up);
    btn.classList.toggle("mem-gone", gone[card]);
    btn.classList.toggle("mem-text", up && cfg.mathPairs === true);
    btn.setAttribute("aria-label", up ? `已翻开：${deck[card].face}` : "扣着的卡片");
  }

  function renderAll(): void {
    for (let s = 0; s < totalCards; s++) renderSlot(s);
  }

  function renderTop(): void {
    pairsEl.textContent = `🐾 ${matched} / ${cfg.pairs}`;
    const left = Math.max(0, cfg.maxMiss - misses);
    lifeEl.textContent = `💗 可失误 ${left}`;
    fillEl.style.width = `${(matched / cfg.pairs) * 100}%`;
    if (timeEl) timeEl.textContent = `⏰ ${timeLeft}s`;
    if (turnEl) turnEl.textContent = `🎠 还有 ${Math.max(0, rotateEvery - flipsSinceTurn)} 翻`;
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
    for (let s = 0; s < totalCards; s++) {
      const card = order[s];
      if (!gone[card] && !faceUp[card]) hidden.push(s);
    }
    if (hidden.length < 2) return;
    const a = hidden[Math.floor(Math.random() * hidden.length)];
    let b = a;
    while (b === a) b = hidden[Math.floor(Math.random() * hidden.length)];
    [order[a], order[b]] = [order[b], order[a]];
    renderSlot(a);
    renderSlot(b);
    slots[a].classList.add("mem-swap");
    slots[b].classList.add("mem-swap");
    ctx.sfx("meow");
    msgEl.textContent = "🐙 调皮章鱼换了两张牌的位置！";
    later(() => {
      slots[a].classList.remove("mem-swap");
      slots[b].classList.remove("mem-swap");
    }, 520);
  }

  /** 旋转木马：还在场上的牌整体挪一格，一张不少、位置全变 */
  function spinBoard(): void {
    order = rotatePositions(order, gone, 1);
    renderAll();
    ctx.sfx("tap");
    msgEl.textContent = "🎠 木马转了一圈，牌全都挪了一格！";
    for (const s of slots) s.classList.add("mem-turn");
    later(() => {
      for (const s of slots) s.classList.remove("mem-turn");
    }, 470);
  }

  function countFlip(): void {
    if (rotateEvery <= 0) return;
    flipsSinceTurn++;
    if (flipsSinceTurn >= rotateEvery) {
      flipsSinceTurn = 0;
      later(spinBoard, 60);
    }
    renderTop();
  }

  function onSlot(s: number): void {
    const card = order[s];
    if (locked || done || gone[card] || faceUp[card]) return;
    ctx.sfx("tap");
    faceUp[card] = true;
    open.push(card);
    renderSlot(s);
    if (open.length < cfg.matchSize) {
      countFlip();
      return;
    }

    const group = open.slice();
    open = [];
    const first = deck[group[0]];
    const same = !first.decoy && group.every((c) => !deck[c].decoy && deck[c].group === first.group);
    if (same) {
      ctx.sfx("coin");
      matched++;
      msgEl.textContent = cfg.mathPairs
        ? `${group.map((c) => deck[c].face).join(" = ")}，算对啦！`
        : `配到一组 ${first.face}！`;
      later(() => {
        group.forEach((c) => { gone[c] = true; });
        renderAll();
        renderTop();
        if (matched >= cfg.pairs) finish(true);
        else countFlip();
      }, 350);
    } else {
      locked = true;
      misses++;
      missSinceImp++;
      renderTop();
      const hitDecoy = group.find((c) => deck[c].decoy);
      if (hitDecoy !== undefined) {
        msgEl.textContent = "🌫️ 这是一张没有同伴的独苗卡，记住它，别再碰啦。";
        for (const c of group) {
          const slot = order.indexOf(c);
          if (slot >= 0) slots[slot].classList.add("mem-ghost");
        }
      } else {
        msgEl.textContent = cfg.mathPairs
          ? "得数对不上，再算一算～"
          : "不太一样，再想想它们藏在哪～";
      }
      later(() => {
        group.forEach((c) => { faceUp[c] = false; });
        for (const btn of slots) btn.classList.remove("mem-ghost");
        renderAll();
        locked = false;
        if (misses > cfg.maxMiss) {
          finish(false);
          return;
        }
        if (cfg.imp > 0 && missSinceImp >= cfg.imp) {
          missSinceImp = 0;
          impSwap();
        }
        countFlip();
      }, cfg.matchSize === 3 ? 950 : 750);
    }
  }

  function openingHint(): string {
    if (cfg.mathPairs && decoys > 0) return "算式配得数，还有对不上号的独苗卡，看仔细！";
    if (cfg.mathPairs) return "🧮 先算出得数，再去找写着它的那张牌！";
    if (rotateEvery > 0 && decoys > 0) return "牌阵会转，还混着独苗卡，记位置也记牌面！";
    if (rotateEvery > 0) return `🎠 每翻 ${rotateEvery} 张，整个牌阵就整体挪一格！`;
    if (decoys > 0) return `🌫️ 有 ${decoys} 张牌没有同伴，认出来就别再碰它。`;
    if (cfg.matchSize === 3) return "三张一样的才算一组哦！";
    if (cfg.imp > 0) return "小心调皮章鱼捣乱！";
    return "点击卡片翻开，找到一样的图案！";
  }

  renderAll();
  renderTop();
  if (cfg.peekMs > 0) {
    msgEl.textContent = "👀 快记住它们的位置！";
    faceUp.fill(true);
    renderAll();
    later(() => {
      faceUp.fill(false);
      renderAll();
      locked = false;
      msgEl.textContent = openingHint();
    }, cfg.peekMs);
  } else {
    locked = false;
    msgEl.textContent = openingHint();
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
    mapHint: "翻错越少星星越多，十大主题等你挑战！",
    grandMessage: "188 关全部配对成功，超级记忆小达人！",
  });
}
