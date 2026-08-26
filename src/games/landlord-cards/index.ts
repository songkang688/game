import { meta } from "./meta";
export { meta };

// 朵朵抢地主 —— 完整规则的三人斗地主。
//
// 54 张牌、叫分抢地主、三张底牌、单张对子三带顺子连对飞机四带二炸弹王炸、
// 春天与反春天、炸弹翻倍,全套规则都在 logic.ts / sim.ts 里,这里只负责摆牌桌:
// 扇形手牌、点选与横划框选、出牌提示、温和的非法提示,以及三种玩法——
// 对战(朵朵 vs 星星 vs 小牌灵)、188 层地主塔、无尽连胜。
import { save } from "../../engine/save";
import { AVATAR_URLS } from "../../ui/avatars";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { AI_LEVEL_NAMES, hintPlays, type AiLevel } from "./ai";
import {
  boxHits,
  cardHeightFor,
  cardWidthFor,
  fanHeightFor,
  fanLayout,
  hitIndex,
  isDragBox,
  moveCursor,
  normBox,
  type FanSlot,
} from "./fan";
import {
  CHAPTERS,
  LEVELS,
  buildEndlessRound,
  dealForLevel,
  endlessLine,
  towerLoseLine,
  towerStars,
  towerWinLine,
  type TowerLevel,
} from "./levels";
import {
  cardRank,
  cardSuit,
  dealCards,
  describePlay,
  gentleHint,
  isJoker,
  multiplierLine,
  parsePlay,
  rankLabel,
  sortDesc,
  suggestBid,
  type Play,
  type SettleResult,
} from "./logic";
import { aiDecide, createGame, settleGame, tryMove, type GameState } from "./sim";

// ---------------------------------------------------------------------------
// 座位
// ---------------------------------------------------------------------------

interface SeatCfg {
  kind: "human" | "ai";
  name: string;
  /** 头像:人类用 PNG,小牌灵用表情 */
  avatar: string;
  isImg: boolean;
  level: AiLevel;
  /** 人类玩家用哪一套键位:0 = 朵朵(WASD+F/G),1 = 星星(方向键+L/K) */
  keys: 0 | 1;
}

/** 两位电脑对手:原创角色,不用任何现成形象 */
const BOT_FACES = [
  { name: "团团", avatar: "🐰" },
  { name: "圆圆", avatar: "🐼" },
];

function humanSeat(name: "朵朵" | "星星", keys: 0 | 1): SeatCfg {
  return {
    kind: "human",
    name,
    avatar: name === "朵朵" ? AVATAR_URLS.duoduo : AVATAR_URLS.xingxing,
    isImg: true,
    level: "hard",
    keys,
  };
}

function botSeat(i: number, level: AiLevel): SeatCfg {
  const f = BOT_FACES[i % BOT_FACES.length];
  return { kind: "ai", name: f.name, avatar: f.avatar, isImg: false, level, keys: 0 };
}

/** 一个人类 + 两个小牌灵:人类坐 playerSeat */
function soloSeats(playerSeat: number, level: AiLevel): SeatCfg[] {
  const seats: SeatCfg[] = [];
  let bot = 0;
  for (let i = 0; i < 3; i++) {
    seats.push(i === playerSeat ? humanSeat("朵朵", 0) : botSeat(bot++, level));
  }
  return seats;
}

/** 朵朵 + 星星 + 一个小牌灵 */
function duoSeats(level: AiLevel): SeatCfg[] {
  return [humanSeat("朵朵", 0), humanSeat("星星", 1), botSeat(0, level)];
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.ld-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;
  background:linear-gradient(180deg,#fdf3fb,#eef3ff);border-radius:18px;padding:10px;position:relative;}
.ld-banner{text-align:center;font-size:13px;font-weight:900;color:#7a5aa8;line-height:1.5;}
.ld-foes{display:flex;gap:8px;justify-content:space-between;align-items:flex-start;}
.ld-foe{flex:1 1 0;min-width:0;background:#ffffffcc;border-radius:14px;padding:7px 8px;
  display:flex;flex-direction:column;gap:5px;align-items:center;box-shadow:0 2px 7px rgba(150,140,190,.2);}
.ld-foe-on{outline:3px solid #ff9ec7;}
.ld-face{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#f3ecff;
  display:flex;align-items:center;justify-content:center;font-size:22px;border:2px solid #fff;}
.ld-foe-name{font-size:12px;font-weight:900;color:#5f4a86;text-align:center;line-height:1.3;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}
.ld-role{display:inline-block;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:900;}
.ld-role-l{background:#ffe0b3;color:#9a5b12;}
.ld-role-f{background:#dcefd6;color:#3f7433;}
.ld-count{font-size:12px;font-weight:800;color:#7b6f9a;}
.ld-mini{display:flex;gap:2px;flex-wrap:wrap;justify-content:center;min-height:26px;}
.ld-mini-c{width:18px;height:26px;border-radius:4px;background:#fff;border:1px solid #d8cfe8;
  font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1;}
.ld-mini-r{color:#d1436a;}
.ld-mini-b{color:#3d3a52;}
.ld-bubble{font-size:12px;font-weight:900;color:#8a7ab0;background:#f4efff;border-radius:999px;padding:2px 9px;}
.ld-center{display:flex;flex-direction:column;align-items:center;gap:5px;min-height:58px;justify-content:center;}
.ld-info{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
.ld-chip{background:#ffffffdd;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#6a5892;
  box-shadow:0 2px 5px rgba(150,140,190,.18);}
.ld-say{font-size:13px;font-weight:800;color:#7d6aa6;text-align:center;line-height:1.5;min-height:19px;}
.ld-say-oops{color:#c2557f;}
.ld-mehead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:center;}
.ld-fanbox{position:relative;width:100%;touch-action:none;}
.ld-card{position:absolute;border-radius:7px;background:#fff;border:1.5px solid #cfc4e4;
  box-shadow:0 2px 5px rgba(120,105,160,.3);display:flex;flex-direction:column;align-items:center;
  justify-content:center;transform-origin:50% 88%;transition:transform .12s ease;}
.ld-card-red{color:#d1436a;}
.ld-card-black{color:#3d3a52;}
.ld-card-on{border-color:#ff8fc0;box-shadow:0 4px 10px rgba(220,120,170,.5);}
.ld-card-cur{outline:3px solid #6c4fd0;outline-offset:1px;}
.ld-c-r{font-weight:900;line-height:1;}
.ld-c-s{line-height:1;}
.ld-marquee{position:absolute;border:2px dashed #b48be0;background:rgba(180,139,224,.14);
  border-radius:8px;pointer-events:none;}
.ld-btns{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}
.ld-btn{border:none;border-radius:14px;min-height:42px;padding:8px 15px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;box-shadow:0 3px 0 rgba(140,120,190,.4);}
.ld-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.ld-btn:disabled{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.ld-btn-go{background:linear-gradient(180deg,#f793b6,#e2648f);color:#fff;box-shadow:0 3px 0 #b8496f;}
.ld-btn-go:active{box-shadow:0 1px 0 #b8496f;}
.ld-btn-bid{background:linear-gradient(180deg,#ffd98a,#f5bd53);color:#7a4d0b;box-shadow:0 3px 0 #c9922f;}
.ld-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.ld-keys{font-size:11px;font-weight:700;color:#8b7ead;text-align:center;line-height:1.6;}
.ld-cover{position:absolute;inset:0;background:rgba(253,243,251,.97);border-radius:18px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;}
.ld-cover-t{font-size:20px;font-weight:900;color:#7a5aa8;}
.ld-cover-s{font-size:14px;font-weight:700;color:#7d6aa6;line-height:1.6;max-width:300px;}
.ld-shake{animation:ldshake .3s;}
@keyframes ldshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.ld-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
.ld-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.ld-open.ld-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.ld-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.ld-open:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.ld-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.ld-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ld-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.ld-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.ld-over{border-radius:16px;background:#fffdfa;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.ld-over-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.ld-over-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;}
@media (max-width:420px){
  .ld-foe{padding:5px 4px;}
  .ld-face{width:32px;height:32px;font-size:19px;}
  .ld-btn{padding:7px 11px;font-size:14px;min-height:40px;}
}
@media (prefers-reduced-motion:reduce){
  .ld-card{transition:none;}
  .ld-shake{animation:none;}
}
`;

// ---------------------------------------------------------------------------
// 牌面
// ---------------------------------------------------------------------------

/** 红桃与方块是红的,大王也画成红的 */
function isRedCard(id: number): boolean {
  if (isJoker(id)) return cardRank(id) === 17;
  return id % 4 === 1 || id % 4 === 3;
}

function cardFaceHTML(id: number, big: boolean): string {
  const rank = cardRank(id);
  if (isJoker(id)) {
    return `<span class="ld-c-r" style="font-size:${big ? 13 : 9}px">${rank === 17 ? "大" : "小"}</span>
            <span class="ld-c-s" style="font-size:${big ? 15 : 10}px">🃏</span>`;
  }
  return `<span class="ld-c-r" style="font-size:${big ? 17 : 11}px">${rankLabel(rank)}</span>
          <span class="ld-c-s" style="font-size:${big ? 15 : 10}px">${cardSuit(id)}</span>`;
}

/** 出牌区 / 对手气泡里的小牌 */
function miniCardsHTML(ids: readonly number[]): string {
  return sortDesc(ids)
    .map((id) => `<span class="ld-mini-c ${isRedCard(id) ? "ld-mini-r" : "ld-mini-b"}">${
      isJoker(id) ? (cardRank(id) === 17 ? "大" : "小") : `${rankLabel(cardRank(id))}${cardSuit(id)}`
    }</span>`)
    .join("");
}

// ---------------------------------------------------------------------------
// 牌桌
// ---------------------------------------------------------------------------

export interface TableDone {
  state: GameState;
  settle: SettleResult;
  landlord: number;
  winner: number;
}

interface TableOpts {
  hands: number[][];
  bottom: number[];
  seats: SeatCfg[];
  /** 从谁开始叫分 */
  bidStart: number;
  banner: string;
  sfx: (name: SoundName) => void;
  onDone: (r: TableDone) => void;
  /** 三家都不叫,请上层换一副牌 */
  onRedeal: () => void;
}

type Phase = "bid" | "play" | "over";

interface Bubble {
  cards: number[];
  passed: boolean;
}

const KEYS_P1 = { left: "a", right: "d", pick: "w", clear: "s", play: "f", pass: "g" };
const KEYS_P2 = { left: "ArrowLeft", right: "ArrowRight", pick: "ArrowUp", clear: "ArrowDown", play: "l", pass: "k" };

function keySetOf(keys: 0 | 1): typeof KEYS_P1 {
  return keys === 0 ? KEYS_P1 : KEYS_P2;
}

function keyHint(seat: SeatCfg): string {
  const k = keySetOf(seat.keys);
  const dirs = seat.keys === 0 ? "A / D" : "← / →";
  const pick = seat.keys === 0 ? "W" : "↑";
  const clear = seat.keys === 0 ? "S" : "↓";
  return `${seat.name}:${dirs} 挑牌 · ${pick} 选中 · ${clear} 清空 · ${k.play.toUpperCase()} 出牌 · ${k.pass.toUpperCase()} 不要`;
}

function createTable(host: HTMLElement, opts: TableOpts): { destroy: () => void } {
  let destroyed = false;
  let paused = false;
  let phase: Phase = "bid";
  let aiPending = false;
  const timers = new Set<number>();

  // 叫分
  let bidSeat = opts.bidStart;
  let bidsLeft = 3;
  let bidBest = 0;
  let bidWinner = -1;

  // 对局
  let state: GameState | null = null;
  let bubbles: Array<Bubble | null> = [null, null, null];
  const selected = new Set<number>();
  let cursor = 0;
  let hintIdx = 0;
  let hintKey = "";
  let say = "";
  let sayBad = false;

  const humans = opts.seats.map((s, i) => (s.kind === "human" ? i : -1)).filter((i) => i >= 0);
  /** 界面下方摊开的是哪一家的手牌 */
  let showSeat = humans[0] ?? 0;
  /** 双人同屏换人时的遮挡幕:等这一家按下「准备好了」再摊牌 */
  let curtainFor = -1;

  const wrap = document.createElement("div");
  wrap.className = "ld-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const banner = document.createElement("div");
  banner.className = "ld-banner";
  const foesEl = document.createElement("div");
  foesEl.className = "ld-foes";
  const centerEl = document.createElement("div");
  centerEl.className = "ld-center";
  const meHead = document.createElement("div");
  meHead.className = "ld-mehead";
  const fanBox = document.createElement("div");
  fanBox.className = "ld-fanbox";
  const btnsEl = document.createElement("div");
  btnsEl.className = "ld-btns";
  const keysEl = document.createElement("div");
  keysEl.className = "ld-keys";
  wrap.append(style, banner, foesEl, centerEl, meHead, fanBox, btnsEl, keysEl);
  host.appendChild(wrap);

  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  function clearTimers(): void {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  }

  function fanWidth(): number {
    const w = fanBox.clientWidth;
    return w > 40 ? w : 340;
  }

  /** 当前该谁动:叫分阶段是 bidSeat,出牌阶段是 state.turn */
  function actor(): number {
    return phase === "bid" ? bidSeat : state ? state.turn : 0;
  }

  function myHand(): number[] {
    if (phase === "bid") return sortDesc(opts.hands[showSeat]);
    return state ? sortDesc(state.hands[showSeat]) : [];
  }

  function roleTag(seat: number): string {
    if (phase === "bid" || !state) return "";
    return state.landlord === seat
      ? `<span class="ld-role ld-role-l">地主</span>`
      : `<span class="ld-role ld-role-f">农民</span>`;
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  function renderFoes(): void {
    foesEl.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      if (i === showSeat) continue;
      const s = opts.seats[i];
      const box = document.createElement("div");
      box.className = `ld-foe${actor() === i ? " ld-foe-on" : ""}`;
      const n = state ? state.hands[i].length : opts.hands[i].length;
      const face = s.isImg
        ? `<img class="ld-face" src="${s.avatar}" alt="${s.name}">`
        : `<span class="ld-face">${s.avatar}</span>`;
      const b = bubbles[i];
      const bubbleHTML = b
        ? b.passed
          ? `<span class="ld-bubble">不要～</span>`
          : `<span class="ld-mini">${miniCardsHTML(b.cards)}</span>`
        : `<span class="ld-mini"></span>`;
      box.innerHTML = `${face}
        <span class="ld-foe-name">${s.name}${s.kind === "ai" ? `·${AI_LEVEL_NAMES[s.level]}` : ""}</span>
        <span class="ld-count">${roleTag(i)} ${n} 张</span>
        ${bubbleHTML}`;
      foesEl.appendChild(box);
    }
  }

  function renderCenter(): void {
    centerEl.innerHTML = "";
    const info = document.createElement("div");
    info.className = "ld-info";
    if (phase === "bid") {
      info.innerHTML = `<span class="ld-chip">🎲 叫分中</span>
        <span class="ld-chip">当前 ${bidBest} 分</span>
        <span class="ld-chip">底牌 3 张等着地主</span>`;
    } else if (state) {
      info.innerHTML = `<span class="ld-chip">底分 ${state.base}</span>
        <span class="ld-chip">倍数 ×${2 ** state.bombs}</span>
        <span class="ld-chip">底牌 ${miniCardsHTML(state.bottom)}</span>`;
    }
    centerEl.appendChild(info);

    if (state && state.prev) {
      const line = document.createElement("div");
      line.className = "ld-say";
      line.innerHTML = `${opts.seats[state.prevSeat].name} 出了 <b>${describePlay(state.prev)}</b>`;
      centerEl.appendChild(line);
    }

    const sayEl = document.createElement("div");
    sayEl.className = `ld-say${sayBad ? " ld-say-oops" : ""}`;
    sayEl.textContent = say;
    centerEl.appendChild(sayEl);
  }

  function renderHand(): void {
    const hand = myHand();
    const width = fanWidth();
    const cardW = cardWidthFor(width);
    const cardH = cardHeightFor(cardW);
    const slots = fanLayout(hand.length, width, cardW);
    fanBox.style.height = `${fanHeightFor(cardW)}px`;
    fanBox.innerHTML = "";

    const lift = Math.round(cardW * 0.42);
    hand.forEach((id, i) => {
      const s: FanSlot = slots[i];
      const el = document.createElement("div");
      const on = selected.has(id);
      el.className = `ld-card ${isRedCard(id) ? "ld-card-red" : "ld-card-black"}${on ? " ld-card-on" : ""}${
        i === cursor && humans.length > 0 ? " ld-card-cur" : ""
      }`;
      el.style.width = `${cardW}px`;
      el.style.height = `${cardH}px`;
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.zIndex = String(10 + i);
      el.style.transform = `translate(${s.x}px, ${s.y - (on ? lift : 0)}px) rotate(${s.rot}deg)`;
      el.innerHTML = cardFaceHTML(id, cardW >= 40);
      fanBox.appendChild(el);
    });
    fanBox.dataset.cardw = String(cardW);
    fanBox.dataset.cardh = String(cardH);
  }

  function renderMeHead(): void {
    const s = opts.seats[showSeat];
    const hand = myHand();
    const face = s.isImg
      ? `<img class="ld-face" src="${s.avatar}" alt="${s.name}">`
      : `<span class="ld-face">${s.avatar}</span>`;
    const turn = actor() === showSeat ? "该你啦!" : `等 ${opts.seats[actor()].name}…`;
    meHead.innerHTML = `${face}
      <span class="ld-foe-name">${s.name}</span>
      <span class="ld-count">${roleTag(showSeat)} ${hand.length} 张</span>
      <span class="ld-chip">${turn}</span>`;
  }

  function mkBtn(label: string, cls: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `ld-btn${cls ? ` ${cls}` : ""}`;
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  function renderButtons(): void {
    btnsEl.innerHTML = "";
    const me = actor();
    const iAct = opts.seats[me]?.kind === "human" && me === showSeat && !paused && phase !== "over";

    if (phase === "bid") {
      for (const v of [0, 1, 2, 3] as const) {
        const label = v === 0 ? "🙅 不叫" : `${v} 分`;
        btnsEl.appendChild(
          mkBtn(label, v === 0 ? "" : "ld-btn-bid", () => humanBid(v), !iAct || (v !== 0 && v <= bidBest))
        );
      }
    } else if (phase === "play") {
      btnsEl.appendChild(mkBtn("💡 提示", "", doHint, !iAct));
      btnsEl.appendChild(mkBtn("↩️ 重选", "", doClear, !iAct || selected.size === 0));
      btnsEl.appendChild(mkBtn("🙅 不要", "", doPass, !iAct || !state?.prev));
      btnsEl.appendChild(mkBtn("✅ 出牌", "ld-btn-go", doPlay, !iAct || selected.size === 0));
    }
    btnsEl.appendChild(mkBtn(paused ? "▶️ 继续" : "⏸ 暂停", "", togglePause, phase === "over"));
  }

  function renderKeys(): void {
    keysEl.innerHTML = humans
      .map((i) => keyHint(opts.seats[i]))
      .concat("Esc 暂停 · 手机直接点牌,横着划一道可以一次选好几张")
      .join("<br>");
  }

  function renderCover(): void {
    const old = wrap.querySelector(".ld-cover");
    old?.remove();
    if (paused) {
      const c = document.createElement("div");
      c.className = "ld-cover";
      c.innerHTML = `<div class="ld-cover-t">⏸ 先歇一会儿</div>
        <div class="ld-cover-s">牌都给你留着,回来接着打。</div>`;
      c.appendChild(mkBtn("▶️ 继续玩", "ld-btn-go", togglePause));
      wrap.appendChild(c);
      return;
    }
    if (curtainFor >= 0) {
      const s = opts.seats[curtainFor];
      const c = document.createElement("div");
      c.className = "ld-cover";
      c.innerHTML = `<div class="ld-cover-t">🙈 轮到 ${s.name} 啦</div>
        <div class="ld-cover-s">另一位先把眼睛捂上,${s.name} 准备好了再点下面的按钮。</div>`;
      c.appendChild(
        mkBtn("我准备好了", "ld-btn-go", () => {
          opts.sfx("tap");
          showSeat = curtainFor;
          curtainFor = -1;
          cursor = 0;
          selected.clear();
          render();
        })
      );
      wrap.appendChild(c);
    }
  }

  function render(): void {
    if (destroyed) return;
    syncShowSeat();
    renderFoes();
    renderCenter();
    renderMeHead();
    renderHand();
    renderButtons();
    renderKeys();
    renderCover();
  }

  /** 只有一个人玩就永远摊他的牌;两个人玩就靠遮挡幕换人 */
  function syncShowSeat(): void {
    if (humans.length <= 1) {
      showSeat = humans[0] ?? 0;
      curtainFor = -1;
      return;
    }
    const me = actor();
    if (phase !== "over" && opts.seats[me]?.kind === "human" && me !== showSeat) curtainFor = me;
    else if (curtainFor >= 0 && (phase === "over" || opts.seats[me]?.kind !== "human")) curtainFor = -1;
  }

  // -------------------------------------------------------------------------
  // 叫分
  // -------------------------------------------------------------------------

  function bidStep(): void {
    if (destroyed || phase !== "bid") return;
    if (bidsLeft <= 0 || bidBest === 3) {
      finishBidding();
      return;
    }
    const s = opts.seats[bidSeat];
    if (s.kind === "ai") {
      if (paused) return;
      later(() => {
        if (destroyed || phase !== "bid") return;
        if (paused) {
          bidStep();
          return;
        }
        applyBid(suggestBid(opts.hands[bidSeat], bidBest));
      }, 620);
    }
    render();
  }

  function applyBid(value: number): void {
    const who = opts.seats[bidSeat].name;
    if (value > bidBest) {
      bidBest = value;
      bidWinner = bidSeat;
      say = `${who} 叫了 ${value} 分!`;
      opts.sfx("coin");
    } else {
      say = `${who} 说:这把不叫～`;
      opts.sfx("tap");
    }
    sayBad = false;
    bidsLeft--;
    bidSeat = (bidSeat + 1) % 3;
    bidStep();
  }

  function humanBid(value: 0 | 1 | 2 | 3): void {
    if (phase !== "bid" || opts.seats[bidSeat].kind !== "human") return;
    applyBid(value);
  }

  function finishBidding(): void {
    if (bidWinner < 0) {
      say = "三家都不叫,那就重新洗牌发过!";
      render();
      later(() => opts.onRedeal(), 900);
      return;
    }
    phase = "play";
    state = createGame({ hands: opts.hands, bottom: opts.bottom, landlord: bidWinner, base: bidBest });
    say = `${opts.seats[bidWinner].name} 当地主,拿走 3 张底牌,先出牌!`;
    sayBad = false;
    selected.clear();
    cursor = 0;
    render();
    pump();
  }

  // -------------------------------------------------------------------------
  // 出牌
  // -------------------------------------------------------------------------

  function pump(): void {
    if (destroyed || paused || phase !== "play" || !state || state.finished) return;
    if (opts.seats[state.turn].kind !== "ai" || aiPending) return;
    aiPending = true;
    later(() => {
      aiPending = false;
      if (destroyed || phase !== "play" || !state) return;
      if (paused) {
        pump();
        return;
      }
      const seat = state.turn;
      const cards = aiDecide(state, opts.seats[seat].level, Math.random);
      commit(seat, cards);
    }, 780);
  }

  /** 真正落子:更新气泡、音效、结算,再决定下一步 */
  function commit(seat: number, cards: readonly number[]): boolean {
    if (!state) return false;
    const leading = !state.prev && cards.length > 0;
    if (leading) bubbles = [null, null, null];
    const res = tryMove(state, cards);
    if (!res.ok) return false;

    bubbles[seat] = { cards: cards.slice(), passed: cards.length === 0 };
    if (cards.length === 0) {
      say = `${opts.seats[seat].name} 不要～`;
      opts.sfx("tap");
    } else {
      const p = res.play!;
      say = `${opts.seats[seat].name} 出了 ${describePlay(p)}`;
      opts.sfx(p.type === "bomb" || p.type === "rocket" ? "pop" : "tap");
    }
    sayBad = false;
    selected.clear();
    hintIdx = 0;
    cursor = 0;

    if (state.finished) {
      phase = "over";
      render();
      const settle = settleGame(state);
      later(() => {
        if (!destroyed && state) opts.onDone({ state, settle, landlord: state.landlord, winner: state.winner ?? 0 });
      }, 700);
      return true;
    }
    render();
    pump();
    return true;
  }

  function canAct(): boolean {
    return (
      !paused &&
      curtainFor < 0 &&
      phase === "play" &&
      !!state &&
      state.turn === showSeat &&
      opts.seats[showSeat].kind === "human"
    );
  }

  function doPlay(): void {
    if (!canAct() || !state) return;
    const cards = myHand().filter((id) => selected.has(id));
    const play = parsePlay(cards);
    if (!play || !commit(showSeat, cards)) {
      say = gentleHint(cards, state.prev);
      sayBad = true;
      opts.sfx("oops");
      wrap.classList.add("ld-shake");
      later(() => wrap.classList.remove("ld-shake"), 320);
      render();
    }
  }

  function doPass(): void {
    if (!canAct() || !state || !state.prev) return;
    commit(showSeat, []);
  }

  function doClear(): void {
    if (!canAct()) return;
    selected.clear();
    hintIdx = 0;
    opts.sfx("tap");
    render();
  }

  function doHint(): void {
    if (!canAct() || !state) return;
    const hand = state.hands[showSeat];
    const key = `${state.prev ? describePlay(state.prev) : "lead"}|${hand.length}`;
    if (key !== hintKey) {
      hintKey = key;
      hintIdx = 0;
    }
    const list = hintPlays(hand, state.prev);
    if (list.length === 0) {
      say = state.prev ? "这一手实在压不住,点「不要」过掉就好～" : "先挑几张牌吧!";
      sayBad = false;
      opts.sfx("oops");
      render();
      return;
    }
    const pick = list[hintIdx % list.length];
    hintIdx++;
    selected.clear();
    for (const id of pick.cards) selected.add(id);
    say = `试试这个:${describePlay(pick)}(再点提示换一手)`;
    sayBad = false;
    opts.sfx("pop");
    render();
  }

  function toggleAt(index: number): void {
    const hand = myHand();
    if (index < 0 || index >= hand.length) return;
    const id = hand[index];
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    cursor = index;
    opts.sfx("tap");
    render();
  }

  function togglePause(): void {
    if (phase === "over") return;
    paused = !paused;
    opts.sfx("tap");
    render();
    if (!paused) {
      if (phase === "bid") bidStep();
      else pump();
    }
  }

  // -------------------------------------------------------------------------
  // 触屏:点选 + 横划框选
  // -------------------------------------------------------------------------

  let dragFrom: { x: number; y: number } | null = null;
  let marquee: HTMLElement | null = null;

  function localXY(ev: PointerEvent): { x: number; y: number } {
    const r = fanBox.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function slotsNow(): { slots: FanSlot[]; cardW: number; cardH: number; lifts: number[] } {
    const hand = myHand();
    const cardW = Number(fanBox.dataset.cardw ?? 44);
    const cardH = Number(fanBox.dataset.cardh ?? 62);
    const slots = fanLayout(hand.length, fanWidth(), cardW);
    const lift = Math.round(cardW * 0.42);
    return { slots, cardW, cardH, lifts: hand.map((id) => (selected.has(id) ? lift : 0)) };
  }

  function onPointerDown(ev: PointerEvent): void {
    if (!canAct()) return;
    ev.preventDefault();
    dragFrom = localXY(ev);
    fanBox.setPointerCapture?.(ev.pointerId);
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!dragFrom) return;
    const p = localXY(ev);
    const box = normBox(dragFrom.x, dragFrom.y, p.x, p.y);
    if (!isDragBox(box)) return;
    if (!marquee) {
      marquee = document.createElement("div");
      marquee.className = "ld-marquee";
      fanBox.appendChild(marquee);
    }
    marquee.style.left = `${box.x1}px`;
    marquee.style.top = `${box.y1}px`;
    marquee.style.width = `${box.x2 - box.x1}px`;
    marquee.style.height = `${box.y2 - box.y1}px`;
  }

  function onPointerUp(ev: PointerEvent): void {
    if (!dragFrom) return;
    const p = localXY(ev);
    const box = normBox(dragFrom.x, dragFrom.y, p.x, p.y);
    const started = dragFrom;
    dragFrom = null;
    marquee?.remove();
    marquee = null;
    if (!canAct()) return;

    const { slots, cardW, cardH, lifts } = slotsNow();
    const hand = myHand();
    if (isDragBox(box)) {
      const hits = boxHits(slots, cardW, cardH, box);
      if (hits.length === 0) return;
      // 划过的这一片:全没选中就整片选上,否则整片取消,来回划一道就能改主意
      const allOn = hits.every((i) => selected.has(hand[i]));
      for (const i of hits) {
        if (allOn) selected.delete(hand[i]);
        else selected.add(hand[i]);
      }
      cursor = hits[hits.length - 1];
      opts.sfx("pop");
      render();
      return;
    }
    toggleAt(hitIndex(slots, cardW, cardH, started.x, started.y, lifts));
  }

  // -------------------------------------------------------------------------
  // 键盘
  // -------------------------------------------------------------------------

  function onKeyDown(ev: KeyboardEvent): void {
    if (destroyed) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;

    const me = actor();
    const seat = opts.seats[me];
    if (!seat || seat.kind !== "human") return;
    // 遮挡幕还没掀开时,键盘先不生效,免得偷看
    if (curtainFor >= 0) return;
    if (me !== showSeat) return;

    const k = keySetOf(seat.keys);
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

    if (phase === "bid") {
      if (key === k.play) {
        ev.preventDefault();
        humanBid(Math.min(3, bidBest + 1) as 1 | 2 | 3);
      } else if (key === k.pass) {
        ev.preventDefault();
        humanBid(0);
      }
      return;
    }
    if (phase !== "play") return;

    const hand = myHand();
    if (key === k.left) {
      ev.preventDefault();
      cursor = moveCursor(cursor, -1, hand.length);
      render();
    } else if (key === k.right) {
      ev.preventDefault();
      cursor = moveCursor(cursor, 1, hand.length);
      render();
    } else if (key === k.pick) {
      ev.preventDefault();
      toggleAt(cursor);
    } else if (key === k.clear) {
      ev.preventDefault();
      doClear();
    } else if (key === k.play) {
      ev.preventDefault();
      doPlay();
    } else if (key === k.pass) {
      ev.preventDefault();
      doPass();
    }
  }

  const onResize = (): void => {
    if (!destroyed) renderHand();
  };

  fanBox.addEventListener("pointerdown", onPointerDown);
  fanBox.addEventListener("pointermove", onPointerMove);
  fanBox.addEventListener("pointerup", onPointerUp);
  fanBox.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);

  banner.textContent = opts.banner;
  say = "先叫分抢地主:手上大牌多就多叫几分!";
  render();
  bidStep();

  return {
    destroy() {
      destroyed = true;
      clearTimers();
      fanBox.removeEventListener("pointerdown", onPointerDown);
      fanBox.removeEventListener("pointermove", onPointerMove);
      fanBox.removeEventListener("pointerup", onPointerUp);
      fanBox.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 结算小工具
// ---------------------------------------------------------------------------

/** 我这一方赢了没有 */
function mySideWon(r: TableDone, mySeat: number): boolean {
  const iAmLandlord = r.landlord === mySeat;
  const landlordWon = r.winner === r.landlord;
  return iAmLandlord === landlordWon;
}

/** 对手阵营手上还剩多少张 */
function foeCardsLeft(r: TableDone, mySeat: number): number {
  const iAmLandlord = r.landlord === mySeat;
  let n = 0;
  for (let i = 0; i < 3; i++) {
    const isFoe = iAmLandlord ? i !== r.landlord : i === r.landlord;
    if (isFoe) n += r.state.hands[i].length;
  }
  return n;
}

/** 结算面板上的那句「春天!倍数翻到 8 分」 */
function settleLine(settle: SettleResult): string {
  const extra = settle.spring ? " 打出春天!" : settle.antiSpring ? " 农民打出反春天!" : "";
  return `${multiplierLine(settle)}。${extra}`.trim();
}

// ---------------------------------------------------------------------------
// 闯关:188 层地主塔
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const lv: TowerLevel = LEVELS[ctx.level];
  let table: { destroy: () => void } | null = null;
  let bump = 0;

  function start(): void {
    table?.destroy();
    stage.innerHTML = "";
    const cfg: TowerLevel = { ...lv, seed: lv.seed + bump * 104729 };
    const d = dealForLevel(cfg);
    const mySeat = d.playerSeat;
    table = createTable(stage, {
      hands: d.hands,
      bottom: d.bottom,
      seats: soloSeats(mySeat, lv.aiLevel),
      bidStart: mySeat,
      banner: `${CHAPTERS[lv.chapter].emoji} 第 ${ctx.level + 1} 关 · 小牌灵是「${AI_LEVEL_NAMES[lv.aiLevel]}」档<br>${lv.hint}`,
      sfx: ctx.sfx,
      onRedeal: () => {
        bump++;
        start();
      },
      onDone: (r) => {
        const iAmLandlord = r.landlord === mySeat;
        if (mySideWon(r, mySeat)) {
          const left = foeCardsLeft(r, mySeat);
          const stars = towerStars(left, iAmLandlord);
          ctx.win(stars, `${towerWinLine(stars, left, iAmLandlord)} ${settleLine(r.settle)}`);
        } else {
          ctx.lose(`${towerLoseLine(r.state.hands[mySeat].length, iAmLandlord)} ${settleLine(r.settle)}`);
        }
      },
    });
  }

  start();
  return {
    destroy() {
      table?.destroy();
      table = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽连胜
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "ld-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "ld-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ld-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ld-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);

  let streak = 0;
  let bump = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let table: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ld-over";
    box.innerHTML = `<div class="ld-over-t">${title}</div><div class="ld-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "ld-open";
    again.textContent = "🔁 从第 1 局再来";
    again.addEventListener("click", () => {
      api.play("tap");
      streak = 0;
      bump = 0;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startRound(): void {
    table?.destroy();
    stage.innerHTML = "";
    const round = buildEndlessRound(streak + 1);
    chip.textContent = `♾️ 无尽连胜 · 第 ${round.round} 局 · 最好 ${best} 连胜`;
    const d = dealCards(round.seed + bump * 65537);
    const mySeat = round.playerIsLandlord ? 0 : 1;
    table = createTable(stage, {
      hands: d.hands,
      bottom: d.bottom,
      seats: soloSeats(mySeat, round.aiLevel),
      bidStart: mySeat,
      banner: `♾️ 第 ${round.round} 局 · 小牌灵是「${AI_LEVEL_NAMES[round.aiLevel]}」档 · 输一局就从头再来`,
      sfx: (n) => api.play(n),
      onRedeal: () => {
        bump++;
        startRound();
      },
      onDone: (r) => {
        if (mySideWon(r, mySeat)) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.addStars(1);
          startRound();
        } else {
          best = save.recordEndlessBest(meta.id, streak);
          showOver("这一局被拦下来啦", `${endlessLine(streak, best)} ${settleLine(r.settle)}`);
        }
      },
    });
  }

  startRound();

  return {
    destroy() {
      table?.destroy();
      table = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战:朵朵 + 星星 + 一个小牌灵
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "ld-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "ld-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ld-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "ld-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);

  let round = 1;
  let bump = 0;
  const score = [0, 0];
  let table: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showResult(r: TableDone): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const duoWon = mySideWon(r, 0);
    const xingWon = mySideWon(r, 1);
    if (duoWon) score[0]++;
    if (xingWon) score[1]++;
    const title = duoWon && xingWon ? "🤝 朵朵和星星是一伙的,一起赢啦!" : duoWon ? "🏆 朵朵赢啦!" : xingWon ? "🏆 星星赢啦!" : "🤖 这局被小牌灵拿下啦!";
    const box = document.createElement("div");
    box.className = "ld-over";
    box.innerHTML = `<div class="ld-over-t">${title}</div>
      <div class="ld-over-s">${settleLine(r.settle)}<br>总比分:朵朵 ${score[0]} · 星星 ${score[1]}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "ld-open ld-open-vs";
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      round++;
      bump = 0;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
    if (duoWon || xingWon) api.addStars(1);
  }

  function startRound(): void {
    table?.destroy();
    stage.innerHTML = "";
    chip.textContent = `⚔️ 第 ${round} 局 · 朵朵 ${score[0]} : ${score[1]} 星星`;
    const d = dealCards(920000 + round * 4523 + bump * 65537);
    table = createTable(stage, {
      hands: d.hands,
      bottom: d.bottom,
      seats: duoSeats("normal"),
      bidStart: (round - 1) % 2,
      banner: "⚔️ 朵朵 vs 星星 vs 小牌灵 —— 谁抢到地主谁一个人打两个!<br>换人时会先盖住牌,另一位记得捂眼睛哦",
      sfx: (n) => api.play(n),
      onRedeal: () => {
        bump++;
        startRound();
      },
      onDone: showResult,
    });
  }

  startRound();

  return {
    destroy() {
      table?.destroy();
      table = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "ld-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "ld-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "ld-open ld-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  bar.append(endlessBtn, vsBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽连胜 · 最好 ${best} 连胜` : "♾️ 无尽连胜 · 点我开始!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "先叫分抢地主,再一手一手把牌走完;拿不准就点「提示」。",
      grandMessage: "188 层地主塔全部登顶,你就是牌桌上的小王者!",
      guideTitle: "朵朵抢地主 · 出牌手记",
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
