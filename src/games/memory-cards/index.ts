import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import { CHAPTERS, LEVELS, type MemoryLevel } from "./levels";
import { THEME_PACKS, drawIcon, packForTheme, type Icon, type IconCtx } from "./art";
import {
  BACK_PATTERNS,
  ENDLESS_MAX_MISS,
  SEAT_NAMES,
  acceptsInput,
  assistLabel,
  assistTip,
  backPattern,
  boardGap,
  buildDeck,
  coverDelayMs,
  deckSeed,
  endlessLevel,
  endlessLine,
  endlessScore,
  groupMatches,
  hitDecoy,
  iconIndexOf,
  lostLine,
  newFlipState,
  nextTurn,
  pickSwapPair,
  rotatePositions,
  secondsToSwap,
  settle,
  startPlay,
  starsForMisses,
  swapSlots,
  swapWarning,
  tapCard,
  versusLine,
  versusWinner,
  wonLine,
  type FlipState,
  type MemoryCard,
  type Seat,
} from "./logic";

const CSS = `
.mmc-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E9F4FF, #FDF0FF); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.mmc-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.mmc-badge { background: #fff; border-radius: 14px; padding: 5px 12px; font-weight: 700; color: #5B8FC9; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 14px; white-space: nowrap; }
.mmc-badge.mmc-warn { color: #E8590C; }
.mmc-badge.mmc-spin { color: #C065A8; }
.mmc-badge.mmc-hot { background: #FFE9D6; color: #D9480F; }
.mmc-badge.mmc-seat { background: #FFF0F6; color: #B5348A; }
.mmc-badge.mmc-seat2 { background: #EAF3FF; color: #2F6BB5; }
.mmc-badge.mmc-seat-on { outline: 3px solid #ffffff; box-shadow: 0 3px 10px rgba(150,120,200,.35); }
.mmc-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mmc-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #8FC5FF, #C9A7F5); border-radius: 8px; transition: width .3s; }
.mmc-board { display: grid; gap: 8px; }
.mmc-card { position: relative; aspect-ratio: 3 / 4; min-height: 72px; border: none; background: none; padding: 0; cursor: pointer; perspective: 600px; }
.mmc-inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 200ms ease; }
.mmc-card.mmc-up .mmc-inner { transform: rotateY(180deg); }
.mmc-side { position: absolute; inset: 0; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; overflow: hidden; box-shadow: 0 3px 6px rgba(100,140,200,.18); transition: opacity 0s linear 100ms; }
.mmc-face { opacity: 0; background: #fff; transform: rotateY(180deg); }
.mmc-card.mmc-up .mmc-face { opacity: 1; }
.mmc-card.mmc-up .mmc-back { opacity: 0; }
.mmc-b0 { background: radial-gradient(circle at 50% 40%, #ffffff55 12%, transparent 13%), var(--mmc-back); }
.mmc-b1 { background: repeating-linear-gradient(45deg, #ffffff33 0 6px, transparent 6px 12px), var(--mmc-back); }
.mmc-b2 { background: radial-gradient(circle at 20% 20%, #ffffff55 8%, transparent 9%), radial-gradient(circle at 80% 80%, #ffffff55 8%, transparent 9%), var(--mmc-back); }
.mmc-b3 { background: repeating-linear-gradient(-45deg, #ffffff2e 0 5px, transparent 5px 14px), var(--mmc-back); }
.mmc-mark { font-size: clamp(15px, 5vw, 22px); font-weight: 900; color: #ffffffcc; text-shadow: 0 1px 2px rgba(120,90,150,.25); }
.mmc-pic { width: 78%; height: 62%; display: block; }
.mmc-name { font-size: clamp(11px, 3.2vw, 14px); font-weight: 800; color: #5B7FB5; line-height: 1; }
.mmc-text { font-size: clamp(13px, 4.2vw, 20px); font-weight: 900; color: #4B7BB5; letter-spacing: .5px; padding: 0 2px; text-align: center; }
.mmc-card.mmc-gone .mmc-inner { opacity: 0; transform: scale(.86); transition: opacity .32s, transform .32s; }
.mmc-card.mmc-gone { pointer-events: none; }
.mmc-card.mmc-hit .mmc-inner { animation: mmcHit .42s ease; }
.mmc-card.mmc-shake .mmc-inner { animation: mmcShake .36s ease; }
.mmc-card.mmc-assist .mmc-face { outline: 3px solid #FFB84D; outline-offset: -3px; }
.mmc-card.mmc-alert .mmc-back { outline: 3px dashed #E8590C; outline-offset: -3px; }
.mmc-card.mmc-swap .mmc-inner { animation: mmcSwap .5s ease; }
.mmc-card.mmc-turn .mmc-inner { animation: mmcTurn .45s ease; }
.mmc-card.mmc-ghost .mmc-inner { animation: mmcGhost .5s ease; }
.mmc-card:disabled { cursor: default; }
@keyframes mmcHit { 0%,100% { transform: rotateY(180deg) scale(1); } 45% { transform: rotateY(180deg) scale(1.14); } }
@keyframes mmcShake { 0%,100% { transform: rotateY(180deg) rotate(0); } 30% { transform: rotateY(180deg) rotate(-7deg); } 70% { transform: rotateY(180deg) rotate(7deg); } }
@keyframes mmcSwap { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-12deg) scale(1.08); } 70% { transform: rotate(12deg) scale(1.08); } }
@keyframes mmcTurn { 0% { transform: rotate(0) scale(1); } 50% { transform: rotate(180deg) scale(.84); } 100% { transform: rotate(360deg) scale(1); } }
@keyframes mmcGhost { 0%,100% { opacity: 1; } 50% { opacity: .35; transform: scale(.9); } }
.mmc-msg { text-align: center; min-height: 22px; color: #6A9BD8; font-weight: 700; margin-top: 10px; font-size: 15px; line-height: 1.5; }
.mmc-modes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 8px; }
.mmc-open { border: none; border-radius: 999px; padding: 8px 16px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #6FA8DC, #4E86BC); box-shadow: 0 4px 0 #3C6C9C; }
.mmc-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #3C6C9C; }
.mmc-toggle { border: none; border-radius: 999px; padding: 8px 14px; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #7A5AA0; box-shadow: 0 3px 0 rgba(120,90,160,.25); white-space: nowrap; }
.mmc-toggle:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(120,90,160,.25); }
.mmc-tip { text-align: center; font-size: 13px; font-weight: 700; color: #77619B; margin-bottom: 8px; line-height: 1.5; }
.mmc-mhead { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; margin-bottom: 8px; }
.mmc-over { text-align: center; padding: 18px 10px; }
.mmc-over-t { font-size: 20px; font-weight: 900; color: #8A5AA8; margin-bottom: 6px; }
.mmc-over-s { font-size: 15px; font-weight: 700; color: #77619B; line-height: 1.6; margin-bottom: 12px; }
@media (max-width: 380px) {
  .mmc-wrap { padding: 8px; }
  .mmc-badge { font-size: 14px; padding: 4px 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .mmc-inner { transition: none; }
  .mmc-side { transition: opacity 140ms linear; }
  .mmc-face { transform: none; }
  .mmc-card.mmc-hit .mmc-inner, .mmc-card.mmc-shake .mmc-inner,
  .mmc-card.mmc-swap .mmc-inner, .mmc-card.mmc-turn .mmc-inner,
  .mmc-card.mmc-ghost .mmc-inner { animation: none; }
}
`;

/** 画一个原创图案到卡面上（拿不到画布上下文就只留名字，照样玩得下去） */
function paintIcon(cv: HTMLCanvasElement, icon: Icon): void {
  const size = 72;
  const dpr = Math.min(2, Math.max(1, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1));
  cv.width = Math.round(size * dpr);
  cv.height = Math.round(size * dpr);
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = cv.getContext?.("2d") ?? null;
  } catch {
    ctx = null;
  }
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  drawIcon(ctx as unknown as IconCtx, icon, size);
}

// ---------------------------------------------------------------------------
// 牌盘：闯关 / 无尽 / 双人共用同一套发牌、状态机与机关
// ---------------------------------------------------------------------------

export interface BoardResult {
  won: boolean;
  /** 这一盘翻错了几次 */
  misses: number;
  /** 配掉了几组 */
  matched: number;
  /** 是不是时间到了才结束的 */
  timeUp: boolean;
  /** 双人局两个人各配到几组 */
  scores: [number, number];
}

interface BoardOpts {
  cfg: MemoryLevel;
  /** 记忆辅助：翻错时把刚看到的位置多亮一会儿 */
  assist?: boolean;
  /** 顶上多挂一条（无尽用） */
  banner?: string;
  /** 1 = 一个人玩，2 = 两个人轮流翻 */
  seats?: 1 | 2;
  /** 发牌种子；不给就随机 */
  seed?: number;
  sfx: (n: SoundName) => void;
  onDone: (r: BoardResult) => void;
}

function createBoard(host: HTMLElement, opts: BoardOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  const assist = opts.assist === true;
  const seats = opts.seats ?? 1;
  const pack = packForTheme(cfg.theme);
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let ticker: ReturnType<typeof setInterval> | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let done = false;
  let misses = 0;
  let missSinceImp = 0;
  let matched = 0;
  let flipsSinceTurn = 0;
  let timeLeft = cfg.timeLimit;
  let sinceSwap = 0;
  let seat: Seat = 0;
  const scores: [number, number] = [0, 0];

  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const deck: MemoryCard[] = buildDeck(cfg, seed);
  const totalCards = deck.length;
  /** order[格子] = 牌号；旋转木马厅会把这张表整体挪一格 */
  let order: number[] = deck.map((_, i) => i);
  const gone: boolean[] = new Array(totalCards).fill(false);
  const faceUp: boolean[] = new Array(totalCards).fill(false);
  /** 这个槽位现在画的是哪张牌（换了牌才重画，翻牌过程中画面不闪） */
  const painted: number[] = new Array(totalCards).fill(-1);

  const rotateEvery = cfg.rotateEvery ?? 0;
  const decoys = cfg.decoys ?? 0;
  const swapEvery = cfg.swapEvery ?? 0;
  const rows = Math.ceil(totalCards / Math.max(1, cfg.cols));

  /** 翻牌状态机：开局要偷看的先按住不让翻 */
  let flip: FlipState = newFlipState(cfg.matchSize, cfg.peekMs > 0);

  const wrap = document.createElement("div");
  wrap.className = "mmc-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mmc-top">
      ${opts.banner ? `<span class="mmc-badge mmc-hot">${opts.banner}</span>` : ""}
      <span class="mmc-badge mmc-pairs">🐾 0 / ${cfg.pairs}</span>
      ${seats === 2
        ? `<span class="mmc-badge mmc-seat mmc-s0">${SEAT_NAMES[0]} 0</span>
           <span class="mmc-badge mmc-seat2 mmc-s1">${SEAT_NAMES[1]} 0</span>`
        : `<span class="mmc-badge mmc-life">💗 可失误 ${cfg.maxMiss}</span>`}
      ${rotateEvery > 0 ? `<span class="mmc-badge mmc-spin mmc-turnbadge">🎠 还有 ${rotateEvery} 翻</span>` : ""}
      ${decoys > 0 ? `<span class="mmc-badge mmc-spin">🌫️ 独苗卡 ${decoys}</span>` : ""}
      ${swapEvery > 0 ? `<span class="mmc-badge mmc-spin mmc-swapbadge">🔀 ${Math.round(swapEvery / 1000)}s</span>` : ""}
      ${assist ? `<span class="mmc-badge mmc-assistbadge">🫶 辅助</span>` : ""}
      ${cfg.timeLimit > 0 ? `<span class="mmc-badge mmc-warn mmc-time">⏰ ${cfg.timeLimit}s</span>` : ""}
    </div>
    <div class="mmc-bar"><div class="mmc-fill"></div></div>
    <div class="mmc-board"></div>
    <div class="mmc-msg"></div>
  `;
  host.appendChild(wrap);

  const boardEl = wrap.querySelector(".mmc-board") as HTMLElement;
  const pairsEl = wrap.querySelector(".mmc-pairs") as HTMLElement;
  const lifeEl = wrap.querySelector(".mmc-life") as HTMLElement | null;
  const timeEl = wrap.querySelector(".mmc-time") as HTMLElement | null;
  const turnEl = wrap.querySelector(".mmc-turnbadge") as HTMLElement | null;
  const swapEl = wrap.querySelector(".mmc-swapbadge") as HTMLElement | null;
  const seatEls = [
    wrap.querySelector(".mmc-s0") as HTMLElement | null,
    wrap.querySelector(".mmc-s1") as HTMLElement | null,
  ];
  const fillEl = wrap.querySelector(".mmc-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mmc-msg") as HTMLElement;

  boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, minmax(0, 1fr))`;
  boardEl.style.gap = `${boardGap(cfg.cols, rows)}px`;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  // --- 建牌 ---------------------------------------------------------------

  interface SlotEls {
    btn: HTMLButtonElement;
    pic: HTMLCanvasElement;
    name: HTMLElement;
    text: HTMLElement;
  }

  const slots: SlotEls[] = [];
  for (let s = 0; s < totalCards; s++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mmc-card";
    const inner = document.createElement("div");
    inner.className = "mmc-inner";
    const back = document.createElement("div");
    back.className = `mmc-side mmc-back mmc-b${backPattern(s, cfg.theme)}`;
    back.style.setProperty("--mmc-back", pack.back);
    back.innerHTML = `<span class="mmc-mark">★</span>`;
    const face = document.createElement("div");
    face.className = "mmc-side mmc-face";
    const pic = document.createElement("canvas");
    pic.className = "mmc-pic";
    const name = document.createElement("div");
    name.className = "mmc-name";
    const text = document.createElement("div");
    text.className = "mmc-text";
    face.append(pic, name, text);
    inner.append(back, face);
    btn.appendChild(inner);
    btn.addEventListener("click", () => onSlot(s));
    boardEl.appendChild(btn);
    slots.push({ btn, pic, name, text });
  }

  /** 把某张牌的正面画到某个槽位上（算式关写字，其余关画原创图案 + 名字） */
  function paintFace(s: number): void {
    const card = order[s];
    if (painted[s] === card) return;
    painted[s] = card;
    const el = slots[s];
    if (cfg.mathPairs) {
      el.pic.style.display = "none";
      el.name.textContent = "";
      el.text.textContent = deck[card].face;
      return;
    }
    const icon = pack.icons[iconIndexOf(cfg, deck[card], pack.icons.length)];
    el.text.textContent = "";
    el.pic.style.display = "block";
    el.name.textContent = icon.name;
    paintIcon(el.pic, icon);
  }

  function renderSlot(s: number): void {
    const { btn } = slots[s];
    const card = order[s];
    const up = faceUp[card];
    paintFace(s);
    btn.classList.toggle("mmc-up", up);
    btn.classList.toggle("mmc-gone", gone[card]);
    btn.disabled = gone[card] || done;
    const label = cfg.mathPairs ? deck[card].face : pack.icons[iconIndexOf(cfg, deck[card], pack.icons.length)].name;
    btn.setAttribute("aria-label", gone[card] ? "已经配好的空位" : up ? `已翻开：${label}` : "扣着的卡片");
  }

  function renderAll(): void {
    for (let s = 0; s < totalCards; s++) renderSlot(s);
  }

  function renderTop(): void {
    pairsEl.textContent = `🐾 ${matched} / ${cfg.pairs}`;
    if (lifeEl) lifeEl.textContent = `💗 可失误 ${Math.max(0, cfg.maxMiss - misses)}`;
    fillEl.style.width = `${(matched / Math.max(1, cfg.pairs)) * 100}%`;
    if (timeEl) timeEl.textContent = `⏰ ${timeLeft}s`;
    if (turnEl) turnEl.textContent = `🎠 还有 ${Math.max(0, rotateEvery - flipsSinceTurn)} 翻`;
    if (swapEl) swapEl.textContent = `🔀 ${secondsToSwap(swapEvery, sinceSwap)}s`;
    if (seats === 2) {
      seatEls.forEach((el, i) => {
        if (!el) return;
        el.textContent = `${SEAT_NAMES[i]} ${scores[i]}`;
        el.classList.toggle("mmc-seat-on", seat === i);
      });
    }
  }

  function finish(won: boolean, timeUp = false): void {
    if (done) return;
    done = true;
    if (ticker) clearInterval(ticker);
    ticker = null;
    if (beat) clearInterval(beat);
    beat = null;
    for (const el of slots) el.btn.disabled = true;
    later(() => opts.onDone({ won, misses, matched, timeUp, scores }), 420);
  }

  // --- 三种机关 -----------------------------------------------------------

  /** 扣着的、还没配掉的槽位（机关只在这些牌里动手） */
  function hiddenSlots(): number[] {
    const out: number[] = [];
    for (let s = 0; s < totalCards; s++) {
      const card = order[s];
      if (!gone[card] && !faceUp[card]) out.push(s);
    }
    return out;
  }

  /** 调皮章鱼：随机交换两张扣着的牌 */
  function impSwap(): void {
    const pair = pickSwapPair(hiddenSlots(), Math.random);
    if (!pair) return;
    order = swapSlots(order, pair[0], pair[1]);
    renderSlot(pair[0]);
    renderSlot(pair[1]);
    flashSlots(pair, "mmc-swap", 520);
    opts.sfx("meow");
    msgEl.textContent = "🐙 调皮章鱼换了两张牌的位置！";
  }

  /** 1.2 会移动的牌：到点了就把两张扣着的牌对调（预警已经先亮过了） */
  function timedSwap(): void {
    const pair = pickSwapPair(hiddenSlots(), Math.random);
    for (const el of slots) el.btn.classList.remove("mmc-alert");
    if (!pair) return;
    order = swapSlots(order, pair[0], pair[1]);
    renderSlot(pair[0]);
    renderSlot(pair[1]);
    flashSlots(pair, "mmc-swap", 520);
    opts.sfx("pop");
    msgEl.textContent = "🔀 两张牌换了位置，把记忆挪一挪！";
  }

  function flashSlots(list: readonly number[], cls: string, ms: number): void {
    for (const s of list) slots[s]?.btn.classList.add(cls);
    later(() => {
      for (const s of list) slots[s]?.btn.classList.remove(cls);
    }, ms);
  }

  /** 旋转木马：还在场上的牌整体挪一格，一张不少、位置全变 */
  function spinBoard(): void {
    order = rotatePositions(order, gone, 1);
    renderAll();
    opts.sfx("tap");
    msgEl.textContent = "🎠 木马转了一圈，牌全都挪了一格！";
    flashSlots(slots.map((_, i) => i), "mmc-turn", 470);
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

  // --- 翻牌 ---------------------------------------------------------------

  function onSlot(s: number): void {
    if (done) return;
    const card = order[s];
    const step = tapCard(flip, card, { gone: gone[card], faceUp: faceUp[card] });
    flip = step.state;
    const eff = step.effect;
    // 动画期间的点击只记不翻：结算完会替玩家补上这一下，不白点
    if (eff.kind === "ignore" || eff.kind === "buffer") return;

    opts.sfx("tap");
    faceUp[card] = true;
    renderSlot(s);
    if (eff.kind === "flip") {
      countFlip();
      return;
    }
    resolve(eff.group);
  }

  /** 一组翻齐了：判定 → 播动画 → 回到空闲，并补上动画期间那一下点击 */
  function resolve(group: number[]): void {
    const ok = groupMatches(deck, group);
    if (ok) {
      opts.sfx("coin");
      matched++;
      scores[seat]++;
      const first = deck[group[0]];
      msgEl.textContent = cfg.mathPairs
        ? `${group.map((c) => deck[c].face).join(" = ")}，算对啦！`
        : `配到一组「${pack.icons[iconIndexOf(cfg, first, pack.icons.length)].name}」！`;
      flashSlots(slotsOf(group), "mmc-hit", 430);
      renderTop();
      later(() => {
        group.forEach((c) => { gone[c] = true; });
        renderAll();
        renderTop();
        if (matched >= cfg.pairs) {
          finish(true);
          return;
        }
        seat = nextTurn(seat, true);
        release();
        countFlip();
      }, 420);
      return;
    }

    misses++;
    missSinceImp++;
    renderTop();
    const decoy = hitDecoy(deck, group);
    if (decoy !== null) {
      msgEl.textContent = "🌫️ 这是一张没有同伴的独苗卡，记住它，别再碰啦。";
      flashSlots(slotsOf(group), "mmc-ghost", 520);
    } else {
      msgEl.textContent = cfg.mathPairs
        ? "得数对不上～重算一遍，再去找写着它的那张牌！"
        : "这两张不是一对～把刚看到的位置记进去，下一轮就能用上！";
      flashSlots(slotsOf(group), "mmc-shake", 380);
    }
    // 记忆辅助：翻错的这几张多亮一会儿并描个圈，给孩子时间把位置记牢
    if (assist) flashSlots(slotsOf(group), "mmc-assist", coverDelayMs(cfg.matchSize, true));
    later(() => {
      group.forEach((c) => { faceUp[c] = false; });
      renderAll();
      if (misses > cfg.maxMiss) {
        finish(false);
        return;
      }
      seat = nextTurn(seat, false);
      renderTop();
      release();
      if (cfg.imp > 0 && missSinceImp >= cfg.imp) {
        missSinceImp = 0;
        impSwap();
      }
      countFlip();
    }, coverDelayMs(cfg.matchSize, assist));
  }

  /** 结算播完：解锁，并把动画期间收下的那一次点击补翻出来 */
  function release(): void {
    const back = settle(flip);
    flip = back.state;
    if (back.replay === null || done) return;
    const s = order.indexOf(back.replay);
    if (s >= 0) later(() => onSlot(s), 40);
  }

  function slotsOf(cards: readonly number[]): number[] {
    return cards.map((c) => order.indexOf(c)).filter((s) => s >= 0);
  }

  function openingHint(): string {
    if (cfg.mathPairs && decoys > 0) return "算式配得数，还有对不上号的独苗卡，看仔细！";
    if (cfg.mathPairs) return "🧮 先算出得数，再去找写着它的那张牌！";
    if (swapEvery > 0 && rotateEvery > 0) return "牌阵会转，单张牌还会自己挪窝，记图案更保险！";
    if (swapEvery > 0) return `🔀 每 ${Math.round(swapEvery / 1000)} 秒有两张牌互换位置，换之前会先亮一下。`;
    if (rotateEvery > 0 && decoys > 0) return "牌阵会转，还混着独苗卡，记位置也记牌面！";
    if (rotateEvery > 0) return `🎠 每翻 ${rotateEvery} 张，整个牌阵就整体挪一格！`;
    if (decoys > 0) return `🌫️ 有 ${decoys} 张牌没有同伴，认出来就别再碰它。`;
    if (cfg.matchSize === 3) return "三张一样的才算一组，凑齐再翻！";
    if (cfg.imp > 0) return "调皮章鱼会换牌，记忆随时要重新核对！";
    if (seats === 2) return `轮流翻牌，配到一组就接着翻，${SEAT_NAMES[0]}先来！`;
    return "按行一张一张翻，把图案和位置一起记下来！";
  }

  // --- 开局 ---------------------------------------------------------------

  renderAll();
  renderTop();
  if (cfg.peekMs > 0) {
    msgEl.textContent = "👀 快记住它们的位置！";
    faceUp.fill(true);
    renderAll();
    later(() => {
      faceUp.fill(false);
      renderAll();
      flip = startPlay(flip);
      msgEl.textContent = openingHint();
    }, cfg.peekMs);
  } else {
    flip = startPlay(flip);
    msgEl.textContent = openingHint();
  }

  if (cfg.timeLimit > 0) {
    ticker = setInterval(() => {
      if (destroyed || done) return;
      timeLeft--;
      renderTop();
      if (timeLeft <= 0) finish(false, true);
    }, 1000);
  }

  if (swapEvery > 0) {
    const BEAT = 250;
    beat = setInterval(() => {
      if (destroyed || done) return;
      sinceSwap += BEAT;
      renderTop();
      if (sinceSwap >= swapEvery) {
        sinceSwap = 0;
        timedSwap();
        return;
      }
      // 预警：要换之前先给扣着的牌描个虚线框，别让孩子措手不及
      const warn = swapWarning(swapEvery, sinceSwap);
      const hidden = new Set(hiddenSlots());
      slots.forEach((el, s) => el.btn.classList.toggle("mmc-alert", warn && hidden.has(s)));
      if (warn && acceptsInput(flip)) msgEl.textContent = "🔀 注意，马上有两张牌要换位置！";
    }, BEAT);
  }

  return {
    destroy() {
      destroyed = true;
      done = true;
      if (ticker) clearInterval(ticker);
      ticker = null;
      if (beat) clearInterval(beat);
      beat = null;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「记忆挑战」：对数一轮比一轮多，累计翻错 3 次收工
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, assist: boolean, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "mmc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mmc-toggle";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "mmc-badge";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let round = 1;
  let cleared = 0;
  let missUsed = 0;
  let run: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(sub: string): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "mmc-over";
    box.innerHTML = `<div class="mmc-over-t">这一趟记忆挑战结束啦</div><div class="mmc-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "mmc-open";
    again.textContent = "🔁 再来一趟";
    again.addEventListener("click", () => {
      api.play("tap");
      round = 1;
      cleared = 0;
      missUsed = 0;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startRound(): void {
    run?.destroy();
    stage.innerHTML = "";
    const base = endlessLevel(round, THEME_PACKS.length);
    // 三次机会是整趟共用的：这一轮最多还能错 ENDLESS_MAX_MISS - missUsed 次
    const cfg: MemoryLevel = { ...base, maxMiss: Math.max(0, ENDLESS_MAX_MISS - missUsed - 1) };
    chip.textContent = `♾️ 第 ${round} 轮 · 已配 ${cleared} 组 · 最好 ${best} 组`;
    run = createBoard(stage, {
      cfg,
      assist,
      banner: `♾️ 还能错 ${Math.max(0, ENDLESS_MAX_MISS - missUsed)} 次`,
      sfx: (n) => api.play(n),
      onDone: (r) => {
        cleared += r.matched;
        missUsed += r.misses;
        if (r.won) {
          api.addStars(1);
          round++;
          startRound();
          return;
        }
        const score = endlessScore(cleared);
        best = save.recordEndlessBest(meta.id, score);
        showOver(endlessLine(score, best));
      },
    });
  }

  startRound();

  return {
    destroy() {
      run?.destroy();
      run = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏：轮流翻，配对多的那个人赢（配到就接着翻）
// ---------------------------------------------------------------------------

const VERSUS_PAIRS = 8;

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "mmc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mmc-toggle";
  back.textContent = "◀ 回选关";
  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "mmc-toggle";
  head.append(back, themeBtn);
  const tip = document.createElement("div");
  tip.className = "mmc-tip";
  tip.textContent = "两个人轮流翻两张：配到一组就接着翻，没配到换人。谁配的组多谁赢。";
  const stage = document.createElement("div");
  wrap.append(head, tip, stage);
  host.appendChild(wrap);

  let theme = 0;
  let run: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function renderTheme(): void {
    themeBtn.textContent = `🎨 ${THEME_PACKS[theme].name}`;
  }

  themeBtn.addEventListener("click", () => {
    api.play("tap");
    theme = (theme + 1) % THEME_PACKS.length;
    renderTheme();
    start();
  });

  function showOver(scores: [number, number]): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "mmc-over";
    const w = versusWinner(scores);
    box.innerHTML = `<div class="mmc-over-t">${w === null ? "打成平手！" : `${SEAT_NAMES[w]} 这局记得更牢！`}</div>
      <div class="mmc-over-s">${versusLine(scores)}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "mmc-open";
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function start(): void {
    run?.destroy();
    stage.innerHTML = "";
    run = createBoard(stage, {
      cfg: {
        pairs: VERSUS_PAIRS,
        cols: 4,
        // 双人局不淘汰任何人，翻错只是换人
        maxMiss: 9999,
        imp: 0,
        peekMs: 1200,
        matchSize: 2,
        timeLimit: 0,
        theme,
      },
      seats: 2,
      sfx: (n) => api.play(n),
      onDone: (r) => showOver(r.scores),
    });
  }

  renderTheme();
  start();

  return {
    destroy() {
      run?.destroy();
      run = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "mmc-modes";
  const tipEl = document.createElement("div");
  tipEl.className = "mmc-tip";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, tipEl, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "mmc-open";
  const versusBtn = document.createElement("button");
  versusBtn.type = "button";
  versusBtn.className = "mmc-open";
  versusBtn.textContent = "👥 双人轮流翻";
  const assistBtn = document.createElement("button");
  assistBtn.type = "button";
  assistBtn.className = "mmc-toggle";
  bar.append(endlessBtn, versusBtn, assistBtn);

  let mode: { destroy: () => void } | null = null;
  /** 关外选的记忆辅助：只多亮一会儿位置，三星标准一个字没动 */
  let assist = false;

  function renderAssist(): void {
    assistBtn.textContent = assistLabel(assist);
    tipEl.textContent = `${assistTip(assist)}（${BACK_PATTERNS} 种卡背只跟位置走，不会泄底）`;
  }

  assistBtn.addEventListener("click", () => {
    api.play("tap");
    assist = !assist;
    renderAssist();
  });

  function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const cfg: MemoryLevel = LEVELS[ctx.level];
    const run = createBoard(stage, {
      cfg,
      assist,
      seed: deckSeed(ctx.level) + Math.floor(Math.random() * 997),
      sfx: ctx.sfx,
      onDone: (r) => {
        if (r.won) ctx.win(starsForMisses(cfg.maxMiss, r.misses), wonLine(r.misses, assist));
        else ctx.lose(lostLine(r.timeUp));
      },
    });
    return { destroy: () => run.destroy() };
  }

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 记忆挑战 · 最好 ${best} 组` : "♾️ 记忆挑战 · 点我开始";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    tipEl.hidden = false;
    refreshBar();
  }

  function openMode(make: () => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    tipEl.hidden = true;
    modeHost.hidden = false;
    mode = make();
  }

  endlessBtn.addEventListener("click", () => {
    openMode(() => mountEndless(modeHost, api, assist, closeMode));
  });
  versusBtn.addEventListener("click", () => {
    openMode(() => mountVersus(modeHost, api, closeMode));
  });

  refreshBar();
  renderAssist();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "翻错越少星星越多，十大主题等你挑战！",
      grandMessage: "188 关全部配对成功，你的记忆方法已经很有一套了！",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
