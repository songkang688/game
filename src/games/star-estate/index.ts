import { meta } from "./meta";
export { meta };

// 朵星地产:掷骰子绕 40 格环线,买地、垄断、平均建屋、抵押周转、拍卖、逼破产。
// 188 关残局战役 + 1 人对 3 个本机 AI + 短盘连胜无尽 + 朵朵星星同屏轮流,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import {
  BOARD,
  BOARD_LEN,
  JAIL_FINE,
  MAX_HOUSES,
  groupInfo,
  gridCell,
  houseCostOf,
  housesLabel,
  isBuyable,
  mortgageValue,
  tileAt,
  unmortgageCost
} from "./board";
import {
  BANK,
  deedsOf,
  liquidCeiling,
  fullSetActive,
  moveBy,
  netWorth,
  rankByNetWorth,
  rentOf,
  type EstateState
} from "./rent";
import {
  advanceTurn,
  autoManage,
  buildHouse,
  buyTile,
  canBuildEven,
  canMortgage,
  jailStep,
  lastOneStandingOrNone,
  mortgage,
  passedGoSalary,
  playTurn,
  resolveLanding,
  rollDice,
  runAuction,
  sellHouse,
  sendToJail,
  unmortgage,
  type EstateEvent,
  type JailChoice,
  type MatchRules
} from "./economy";
import { AI_TIER_LABELS, buildContext, buildState, type AiTier } from "./ai";
import {
  CHAPTERS,
  endlessConfig,
  goalLine,
  goalReached,
  levelConfig,
  rulesLine,
  solveLevel,
  starsFor,
  versusConfig
} from "./levels";

/** 棋子一格一格跳的单步时长（毫秒），不允许瞬移 */
export const HOP_MS = 130;
/** AI 回合每一条播报之间的停顿 */
export const BEAT_MS = 340;
/** 金币飞行动画时长 */
export const COIN_MS = 460;

const CSS = `
.se-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFF8EC,#FFF1F6);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.se-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:8px;}
.se-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#8a5a2a;
  box-shadow:0 2px 6px rgba(200,170,120,.3);overflow-wrap:anywhere;line-height:1.4;}
.se-seats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
.se-seat{flex:1 1 120px;min-width:0;background:#fff;border-radius:14px;padding:6px 8px;font-size:16px;font-weight:800;
  color:#7a5230;box-shadow:0 2px 6px rgba(200,170,120,.25);line-height:1.5;overflow-wrap:anywhere;}
.se-seat-on{outline:3px solid #F0A85C;}
.se-seat-out{opacity:.5;}
.se-seat-name{font-size:var(--mt-body,16px);}
.se-seat-tier{font-size:16px;font-weight:700;color:#9a7a52;}
.se-seat-cash{color:#3f7d55;}
.se-board-wrap{position:relative;width:100%;max-width:560px;margin:0 auto;}
.se-board{display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);gap:2px;
  aspect-ratio:1;background:#F3E4CD;border-radius:14px;padding:4px;}
.se-tile{position:relative;border:none;border-radius:6px;background:#fffdf8;padding:1px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;font-family:inherit;
  overflow:hidden;min-width:0;min-height:0;}
.se-tile-emoji{font-size:clamp(14px,2.2vw,15px);line-height:1;}
.se-tile-price{font-size:var(--mt-control,14px);font-weight:800;color:#8a6a44;line-height:1.1;}
.se-tile-band{position:absolute;top:0;left:0;right:0;height:22%;border-radius:6px 6px 0 0;}
.se-tile-own{position:absolute;bottom:0;left:0;right:0;height:16%;font-size:0;}
/* 房子用色块点表示：格子只有 30px 宽时，任何字号都读不动，读数交给放大预览。 */
.se-tile-houses{position:absolute;top:22%;left:0;right:0;display:flex;justify-content:center;
  align-items:center;gap:1px;font-size:0;line-height:0;pointer-events:none;}
.se-pip{display:block;width:14%;max-width:5px;aspect-ratio:1;border-radius:1px;background:#3f7d55;}
.se-pip-hotel{width:30%;max-width:11px;aspect-ratio:1.4;border-radius:2px;background:#c1443b;}
.se-tile-mort{position:absolute;inset:0;background:repeating-linear-gradient(45deg,rgba(150,150,170,.35) 0 4px,transparent 4px 8px);
  border-radius:6px;}
.se-tile-sel{outline:3px solid #E4762F;z-index:3;}
.se-tile-corner{background:#FFF3DC;}
.se-token{position:absolute;font-size:clamp(13px,2.1vw,15px);line-height:1;pointer-events:none;z-index:4;
  transition:left ${HOP_MS}ms linear,top ${HOP_MS}ms linear;transform:translate(-50%,-50%);}
.se-coin{position:absolute;font-size:18px;pointer-events:none;z-index:6;transition:left ${COIN_MS}ms ease,top ${COIN_MS}ms ease,opacity ${COIN_MS}ms ease;
  transform:translate(-50%,-50%);}
.se-center{grid-column:2 / span 9;grid-row:2 / span 9;background:#FFFBF2;border-radius:10px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;text-align:center;min-width:0;}
.se-dice{font-size:clamp(16px,5vw,30px);line-height:1;letter-spacing:4px;}
.se-goal{font-size:clamp(13px,2.4vw,14px);font-weight:800;color:#9a6a3a;line-height:1.5;overflow-wrap:anywhere;}
.se-preview{font-size:clamp(16px,2.8vw,17px);font-weight:900;color:#7a5230;line-height:1.5;overflow-wrap:anywhere;}
.se-log{font-size:clamp(16px,2.3vw,17px);font-weight:700;color:#6b6152;line-height:1.5;max-height:5.2em;
  overflow:hidden;overflow-wrap:anywhere;}
.se-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px;}
.se-btn{min-width:88px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:16px;
  font-weight:900;cursor:pointer;background:#F6D9AE;color:#7a4a18;box-shadow:0 3px 0 #DDB981;padding:0 12px;}
.se-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #DDB981;}
.se-btn:disabled{opacity:.45;cursor:default;box-shadow:0 3px 0 #DDB981;}
.se-btn-go{background:#F3B27A;color:#5c3208;box-shadow:0 3px 0 #D2905A;}
.se-btn-sm{min-width:62px;min-height:44px;font-size:14px;padding:0 10px;}
.se-btn:focus-visible,.se-tile:focus-visible{outline:3px solid #6b3d0d;outline-offset:2px;}
.se-msg{text-align:center;min-height:1.6em;color:#7a5230;font-weight:800;margin-top:8px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;}
.se-drawer{margin-top:10px;background:#fff;border-radius:14px;padding:8px;box-shadow:0 2px 8px rgba(200,170,120,.25);}
.se-drawer-h{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;
  font-size:16px;font-weight:900;color:#7a5230;}
.se-deeds{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
.se-deed{flex:1 1 150px;min-width:0;border:none;border-radius:10px;padding:6px 8px;text-align:left;cursor:pointer;
  font-family:inherit;font-size:16px;font-weight:800;color:#6b4a24;background:#FFF6E6;line-height:1.5;overflow-wrap:anywhere;}
.se-deed-mort{background:#EFEDF4;color:#6a6478;}
.se-modebar,.se-optbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.se-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#7a5230;text-align:center;overflow-wrap:anywhere;}
.se-open{border:none;border-radius:999px;padding:10px 18px;min-height:44px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#E9A05C,#CE7F3B);box-shadow:0 4px 0 #A96227;}
.se-open:active{transform:translateY(2px);box-shadow:0 2px 0 #A96227;}
.se-mode{max-width:640px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.se-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.se-back{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#B0763A;box-shadow:0 3px 0 rgba(190,140,80,.35);}
.se-over{text-align:center;padding:22px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(200,170,120,.3);}
.se-over-t{font-size:21px;font-weight:900;color:#8a5a2a;margin-bottom:8px;}
.se-over-s{font-size:16px;font-weight:700;color:#7a6a52;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
.se-paper{position:absolute;font-size:var(--mt-body,16px);pointer-events:none;z-index:7;}
.se-pause{position:absolute;inset:0;background:rgba(255,250,240,.95);border-radius:16px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;}
.se-pause-t{font-size:20px;font-weight:900;color:#8a5a2a;}
@keyframes sepaper{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),64px) rotate(220deg);opacity:0}}
/* 窄屏格子只剩 30px 上下，价格数字塞进去既读不动也挤掉图标，
   按规格改走「棋盘缩到整屏 + 当前格放大预览」，价格只在预览里给。 */
@media (max-width:480px){
  .se-tile-price{display:none;}
}
@media (max-width:360px){
  .se-badge{padding:4px 8px;}
  .se-seat{flex:1 1 46%;}
  .se-btn{min-width:72px;font-size:15px;padding:0 8px;}
  .se-deed{flex:1 1 100%;}
}
@media (prefers-reduced-motion:reduce){
  .se-token{transition:none;}
  .se-coin{transition:opacity 120ms linear;}
  .se-paper{display:none;}
}
`;

function reducedMotion(): boolean {
  try {
    return Boolean(
      (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches
    );
  } catch {
    return false;
  }
}

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/** 事件 → 一句中文播报（纯函数，测试直接读） */
export function eventLine(state: EstateState, ev: EstateEvent): string {
  const who = (id: number): string => state.players[id]?.name ?? "银行";
  switch (ev.kind) {
    case "roll":
      return `${who(ev.player)} 掷出 ${ev.dice[0]} + ${ev.dice[1]}${ev.doubles ? "（同点，可以再掷）" : ""}`;
    case "move":
      return `${who(ev.player)} 走到 ${tileAt(ev.to).name}`;
    case "salary":
      return `${who(ev.player)} 经过出发花园，领 ${ev.amount} 星币`;
    case "buy":
      return `${who(ev.player)} 花 ${ev.price} 星币买下 ${tileAt(ev.pos).name}`;
    case "rent":
      return `${who(ev.payer)} 给 ${who(ev.owner)} 付了 ${ev.amount} 星币过路费`;
    case "tax":
      return `${who(ev.player)} 在 ${tileAt(ev.pos).name} 交了 ${ev.amount} 星币`;
    case "card":
      return `${ev.deck === "chance" ? "🎡" : "💌"} ${ev.text}`;
    case "jail":
      return `${who(ev.player)}：${ev.why}`;
    case "free":
      return `${who(ev.player)} 走出小黑屋（${
        ev.how === "pay" ? "交罚款" : ev.how === "card" ? "用出门卡" : ev.how === "forced" ? "第三回合到点" : "掷出同点"
      }）`;
    case "build":
      return `${who(ev.player)} 在 ${tileAt(ev.pos).name} 盖到 ${housesLabel(ev.houses)}`;
    case "sellHouse":
      return `${who(ev.player)} 拆掉一栋，退回 ${ev.refund} 星币`;
    case "mortgage":
      return `${who(ev.player)} 抵押 ${tileAt(ev.pos).name}，拿到 ${ev.amount} 星币`;
    case "unmortgage":
      return `${who(ev.player)} 花 ${ev.amount} 星币赎回 ${tileAt(ev.pos).name}`;
    case "trade":
      return `${who(ev.to)} 花 ${ev.price} 星币接下了 ${who(ev.from)} 的 ${tileAt(ev.pos).name}`;
    case "auction":
      return ev.winner < 0
        ? `${tileAt(ev.pos).name} 没人出价，留在银行手里`
        : `${tileAt(ev.pos).name} 被 ${who(ev.winner)} 以 ${ev.price} 星币拍下`;
    case "fee":
      return `${who(ev.player)} 交了 ${ev.amount} 星币手续费`;
    case "bankrupt":
      return `${who(ev.player)} 的钱包空啦，去朵朵公园歇一会儿，下一局再来。`;
    case "over":
      return `这一局结束：${who(ev.winner)} 收摊收得最稳。`;
    default:
      return ev.text;
  }
}

// ---------------------------------------------------------------------------
// 牌桌:战役、对战、无尽、双人同屏全部复用这一份
// ---------------------------------------------------------------------------

export interface TableSeat {
  name: string;
  emoji: string;
  /** 人类玩家的键位;不给就是本机 AI */
  human?: "duo" | "star";
  tier: AiTier;
  cash?: number;
}

export interface TableResult {
  winner: number;
  reason: "bankrupt" | "settle" | "goal" | "timeout";
  rounds: number;
  netWorths: number[];
  /** 收场时每个座位名下有几处产业 */
  deeds: number[];
  /** 每个座位本局自己掏钱买下了几处产业 */
  bought: number[];
  humanWon: boolean;
}

export interface TableOpts {
  seats: TableSeat[];
  rules: MatchRules;
  seed: number;
  preset?: Array<{ tile: number; owner: number; houses?: number; mortgaged?: boolean }>;
  goalText: string;
  scriptedDice?: Array<[number, number]>;
  /** 战役目标达成判定；返回 true 就立刻结算成功 */
  goalReached?: (state: EstateState) => boolean;
  sfx: (n: SoundName) => void;
  onOver: (r: TableResult) => void;
}

interface Table {
  destroy: () => void;
  /** 只给测试用：当前局面 */
  state: () => EstateState;
}

type Phase = "idle" | "busy" | "decide" | "bid" | "jail" | "over";

function createTable(host: HTMLElement, opts: TableOpts): Table {
  const soft = reducedMotion();
  const humans = new Set<number>();
  opts.seats.forEach((s, i) => {
    if (s.human) humans.add(i);
  });
  const tiers = opts.seats.map((s) => s.tier);

  const state = buildState({
    seed: opts.seed,
    tiers,
    cashes: opts.seats.map((s) => s.cash),
    preset: opts.preset,
    names: opts.seats.map((s) => s.name)
  });
  state.players.forEach((p, i) => {
    p.emoji = opts.seats[i].emoji;
  });
  const diceCursor = { i: 0 };
  const ctx = buildContext(state, { seed: opts.seed, tiers, rules: opts.rules, scriptedDice: opts.scriptedDice });
  ctx.diceCursor = diceCursor;
  ctx.humans = humans;

  /** 画出来的棋子位置（跳格动画期间和 state.pos 不同步） */
  const renderPos = state.players.map((p) => p.pos);
  let selected = 0;
  let phase: Phase = "idle";
  let pendingBuy = -1;
  let legDoubles = false;
  let lastDice: [number, number] = [1, 1];
  let paused = false;
  let destroyed = false;
  const log: string[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function later(fn: () => void, ms: number): void {
    if (destroyed) return;
    const t = setTimeout(() => {
      timers.delete(t);
      if (!destroyed) fn();
    }, Math.max(0, soft ? Math.min(ms, 40) : ms));
    timers.add(t);
  }

  // ---- DOM ----
  const wrap = document.createElement("div");
  wrap.className = "se-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  const top = document.createElement("div");
  top.className = "se-top";
  const roundChip = document.createElement("span");
  roundChip.className = "se-badge";
  const goalChip = document.createElement("span");
  goalChip.className = "se-badge";
  goalChip.textContent = opts.goalText;
  top.append(roundChip, goalChip);
  wrap.appendChild(top);

  const seatRow = document.createElement("div");
  seatRow.className = "se-seats";
  const seatEls = state.players.map(() => {
    const el = document.createElement("div");
    el.className = "se-seat";
    seatRow.appendChild(el);
    return el;
  });
  wrap.appendChild(seatRow);

  const boardWrap = document.createElement("div");
  boardWrap.className = "se-board-wrap";
  const board = document.createElement("div");
  board.className = "se-board";
  boardWrap.appendChild(board);
  wrap.appendChild(boardWrap);

  const tileEls: HTMLButtonElement[] = [];
  for (const tile of BOARD) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `se-tile${tile.kind === "go" || tile.kind === "rest" || tile.kind === "park" || tile.kind === "jail" ? " se-tile-corner" : ""}`;
    const cell = gridCell(tile.pos);
    btn.style.gridRow = String(cell.row);
    btn.style.gridColumn = String(cell.col);
    btn.addEventListener("click", () => {
      selected = tile.pos;
      opts.sfx("tap");
      render();
    });
    board.appendChild(btn);
    tileEls.push(btn);
  }

  const center = document.createElement("div");
  center.className = "se-center";
  const diceEl = document.createElement("div");
  diceEl.className = "se-dice";
  diceEl.textContent = "🎲🎲";
  const previewEl = document.createElement("div");
  previewEl.className = "se-preview";
  const logEl = document.createElement("div");
  logEl.className = "se-log";
  center.append(diceEl, previewEl, logEl);
  board.appendChild(center);

  const tokens = state.players.map((p) => {
    const el = document.createElement("div");
    el.className = "se-token";
    el.textContent = p.emoji;
    boardWrap.appendChild(el);
    return el;
  });

  const pad = document.createElement("div");
  pad.className = "se-pad";
  const rollBtn = document.createElement("button");
  rollBtn.type = "button";
  rollBtn.className = "se-btn se-btn-go";
  rollBtn.textContent = "🎲 掷骰 F";
  const buyBtn = document.createElement("button");
  buyBtn.type = "button";
  buyBtn.className = "se-btn";
  buyBtn.textContent = "🏠 购买 G";
  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "se-btn";
  endBtn.textContent = "⏭️ 结束回合";
  pad.append(rollBtn, buyBtn, endBtn);
  wrap.appendChild(pad);

  const bidRow = document.createElement("div");
  bidRow.className = "se-pad";
  bidRow.hidden = true;
  wrap.appendChild(bidRow);

  const msg = document.createElement("div");
  msg.className = "se-msg";
  wrap.appendChild(msg);

  const drawer = document.createElement("div");
  drawer.className = "se-drawer";
  const drawerHead = document.createElement("div");
  drawerHead.className = "se-drawer-h";
  const deeds = document.createElement("div");
  deeds.className = "se-deeds";
  drawer.append(drawerHead, deeds);
  wrap.appendChild(drawer);

  host.appendChild(wrap);

  // ---- 画面 ----
  function tileCenter(pos: number): { x: number; y: number } {
    const cell = gridCell(pos);
    return { x: ((cell.col - 0.5) / 11) * 100, y: ((cell.row - 0.5) / 11) * 100 };
  }

  function drawTokens(): void {
    const bucket = new Map<number, number[]>();
    renderPos.forEach((p, i) => {
      if (state.players[i].bankrupt) return;
      const list = bucket.get(p) ?? [];
      list.push(i);
      bucket.set(p, list);
    });
    tokens.forEach((el, i) => {
      if (state.players[i].bankrupt) {
        el.style.opacity = "0";
        return;
      }
      el.style.opacity = "1";
      const pos = renderPos[i];
      const mates = bucket.get(pos) ?? [i];
      const k = Math.max(0, mates.indexOf(i));
      const c = tileCenter(pos);
      el.style.left = `${c.x + (k % 2 === 0 ? -1.4 : 1.4)}%`;
      el.style.top = `${c.y + (k < 2 ? -1.2 : 1.4)}%`;
    });
  }

  function render(): void {
    const me = state.players[state.turn];
    roundChip.textContent = `第 ${state.round} / ${opts.rules.maxRounds} 回合 · 轮到 ${me?.name ?? "-"}`;
    seatEls.forEach((el, i) => {
      const p = state.players[i];
      const own = deedsOf(state, i).length;
      el.className = `se-seat${i === state.turn ? " se-seat-on" : ""}${p.bankrupt ? " se-seat-out" : ""}`;
      el.innerHTML = `<div class="se-seat-name">${p.emoji} ${p.name}${humans.has(i) ? "" : `<span class="se-seat-tier"> · ${AI_TIER_LABELS[tiers[i]]}</span>`}</div>
        <div class="se-seat-cash">💰 ${p.bankrupt ? "已收摊" : p.cash}</div>
        <div>🏷️ ${own} 块 · 净资产 ${netWorth(state, i)}${p.inJail ? " · 🪑小黑屋" : ""}${p.outCards > 0 ? ` · 🎫${p.outCards}` : ""}</div>`;
    });

    for (const tile of BOARD) {
      const el = tileEls[tile.pos];
      const st = state.tiles[tile.pos];
      const owner = st.owner;
      const band = tile.group ? groupInfo(tile.group).color : tile.kind === "station" ? "#D9D3C4" : tile.kind === "util" ? "#CFE0E6" : "";
      const price = tile.price ? `${tile.price}` : tile.tax ? `-${tile.tax}` : "";
      el.innerHTML = `${band ? `<span class="se-tile-band" style="background:${band}"></span>` : ""}
        <span class="se-tile-emoji">${tile.emoji}</span>
        ${price ? `<span class="se-tile-price">${price}</span>` : ""}
        ${
          st.houses > 0
            ? `<span class="se-tile-houses">${
                st.houses >= MAX_HOUSES
                  ? `<i class="se-pip se-pip-hotel"></i>`
                  : `<i class="se-pip"></i>`.repeat(st.houses)
              }</span>`
            : ""
        }
        ${owner !== BANK ? `<span class="se-tile-own" style="background:${seatColor(owner)}"></span>` : ""}
        ${st.mortgaged ? `<span class="se-tile-mort"></span>` : ""}`;
      el.classList.toggle("se-tile-sel", tile.pos === selected);
      el.setAttribute(
        "aria-label",
        `${tile.name}${tile.price ? `，售价 ${tile.price} 星币` : ""}${owner !== BANK ? `，主人是${state.players[owner].name}` : ""}${
          st.houses > 0 ? `，${housesLabel(st.houses)}` : ""
        }${st.mortgaged ? "，抵押中" : ""}`
      );
    }

    const sel = tileAt(selected);
    const selSt = state.tiles[selected];
    const parts = [`${sel.emoji} ${sel.name}`];
    if (sel.price) parts.push(`售价 ${sel.price}`);
    if (selSt.owner !== BANK) {
      parts.push(`主人 ${state.players[selSt.owner].name}`);
      parts.push(housesLabel(selSt.houses));
      if (selSt.mortgaged) parts.push("抵押中，不收租");
      else parts.push(`租金 ${rentOf(state, selected, 7)}`);
    } else if (isBuyable(selected)) {
      parts.push("还没有主人");
    }
    if (sel.tax) parts.push(`要交 ${sel.tax} 星币`);
    previewEl.textContent = parts.join(" · ");
    logEl.textContent = log.slice(-3).join("\n");
    drawTokens();
    renderDeeds();
    renderButtons();
  }

  function seatColor(id: number): string {
    return ["#E4762F", "#5B8FD6", "#59A36B", "#B36FC0"][id % 4];
  }

  function renderDeeds(): void {
    const meId = currentHuman();
    const id = meId >= 0 ? meId : state.turn;
    const p = state.players[id];
    drawerHead.innerHTML = `<span>📜 ${p.name} 的地契（${deedsOf(state, id).length} 块）</span><span>可变现上限 ${liquidCeiling(state, id)}</span>`;
    deeds.innerHTML = "";
    const list = deedsOf(state, id);
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "se-deed";
      empty.textContent = "还没有地契。走到没主人的格子上就能买下来。";
      deeds.appendChild(empty);
      return;
    }
    for (const pos of list) {
      const st = state.tiles[pos];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `se-deed${st.mortgaged ? " se-deed-mort" : ""}`;
      const tile = tileAt(pos);
      const mono = tile.group && fullSetActive(state, id, tile.group) ? " 🌟垄断" : "";
      btn.textContent = `${tile.emoji} ${tile.name} · ${housesLabel(st.houses)}${st.mortgaged ? " · 抵押中" : mono}`;
      btn.addEventListener("click", () => {
        selected = pos;
        opts.sfx("tap");
        render();
      });
      deeds.appendChild(btn);
    }
  }

  /** 现在轮到的是不是人类座位 */
  function currentHuman(): number {
    return humans.has(state.turn) ? state.turn : -1;
  }

  function renderButtons(): void {
    const mine = currentHuman();
    const canAct = phase !== "over" && !paused && mine >= 0;
    if (phase === "bid") {
      // 正在问「最多跟到多少」，三个主钮先让位给出价按钮
      rollBtn.disabled = true;
      buyBtn.disabled = true;
      endBtn.disabled = true;
      return;
    }
    if (phase === "decide") {
      rollBtn.disabled = true;
      rollBtn.textContent = "🎲 掷骰 F";
      buyBtn.disabled = false;
      buyBtn.textContent = `🏠 买下 ${tileAt(pendingBuy).price} G`;
      endBtn.disabled = false;
      endBtn.textContent = opts.rules.auction ? "🔨 不买，上拍卖" : "🙅 不买";
      return;
    }
    if (phase === "jail") {
      rollBtn.disabled = false;
      rollBtn.textContent = "🎲 掷同点 F";
      buyBtn.disabled = (state.players[state.turn]?.cash ?? 0) < JAIL_FINE && (state.players[state.turn]?.outCards ?? 0) <= 0;
      buyBtn.textContent = (state.players[state.turn]?.outCards ?? 0) > 0 ? "🎫 用出门卡 G" : `💰 交 ${JAIL_FINE} G`;
      endBtn.disabled = true;
      endBtn.textContent = "⏭️ 结束回合";
      return;
    }
    rollBtn.disabled = !canAct || phase === "busy" || (!legDoubles && rolledThisTurn);
    rollBtn.textContent = legDoubles ? "🎲 再掷一次 F" : "🎲 掷骰 F";
    buyBtn.disabled = !canAct || phase === "busy" || !buildableSelected();
    buyBtn.textContent = buildableSelected() ? `🏠 建屋 ${houseCostOf(selected)} G` : "🏠 购买 G";
    endBtn.disabled = !canAct || phase === "busy" || !rolledThisTurn;
    endBtn.textContent = "⏭️ 结束回合";
  }

  function buildableSelected(): boolean {
    const mine = currentHuman();
    if (mine < 0 || !opts.rules.build) return false;
    return state.tiles[selected].owner === mine && canBuildEven(state, selected) && state.players[mine].cash >= houseCostOf(selected);
  }

  let rolledThisTurn = false;

  function say(text: string): void {
    if (!text) return;
    log.push(text);
    if (log.length > 40) log.shift();
    msg.textContent = text;
  }

  // ---- 动画 ----
  function hop(playerId: number, from: number, to: number, done: () => void): void {
    const steps: number[] = [];
    let cur = from;
    for (let i = 0; i < BOARD_LEN; i++) {
      if (cur === to) break;
      cur = moveBy(cur, 1);
      steps.push(cur);
    }
    if (steps.length === 0 || soft) {
      renderPos[playerId] = to;
      drawTokens();
      later(done, soft ? 20 : 60);
      return;
    }
    let i = 0;
    const tick = (): void => {
      renderPos[playerId] = steps[i];
      drawTokens();
      i++;
      if (i < steps.length) later(tick, HOP_MS);
      else later(done, HOP_MS);
    };
    tick();
  }

  function coinFly(fromPos: number, toPos: number): void {
    if (soft) return;
    const el = document.createElement("div");
    el.className = "se-coin";
    el.textContent = "🪙";
    const a = tileCenter(fromPos);
    const b = tileCenter(toPos);
    el.style.left = `${a.x}%`;
    el.style.top = `${a.y}%`;
    boardWrap.appendChild(el);
    later(() => {
      el.style.left = `${b.x}%`;
      el.style.top = `${b.y}%`;
      el.style.opacity = "0";
    }, 20);
    later(() => el.remove(), COIN_MS + 120);
  }

  /** 破产是「棋子收摊 + 钱包倒出彩纸」，不做任何沮丧化描写 */
  function confetti(pos: number): void {
    if (soft) return;
    const c = tileCenter(pos);
    for (let i = 0; i < 8; i++) {
      const el = document.createElement("div");
      el.className = "se-paper";
      el.textContent = ["🎊", "🎉", "✨"][i % 3];
      el.style.left = `${c.x}%`;
      el.style.top = `${c.y}%`;
      el.style.setProperty("--dx", `${(i - 4) * 9}px`);
      el.style.animation = `sepaper ${700 + i * 40}ms ease-out forwards`;
      boardWrap.appendChild(el);
      later(() => el.remove(), 900 + i * 40);
    }
  }

  /** 把一串事件按节奏播出来 */
  function playBeats(events: EstateEvent[], done: () => void): void {
    let i = 0;
    const next = (): void => {
      if (destroyed) return;
      if (i >= events.length) {
        render();
        done();
        return;
      }
      const ev = events[i];
      i++;
      const line = eventLine(state, ev);
      if (ev.kind === "move") {
        say(line);
        hop(ev.player, renderPos[ev.player], ev.to, () => {
          render();
          later(next, BEAT_MS / 2);
        });
        return;
      }
      if (ev.kind === "rent") {
        opts.sfx("coin");
        coinFly(state.players[ev.payer].pos, state.players[ev.owner].pos);
      } else if (ev.kind === "buy" || ev.kind === "build") {
        opts.sfx("pop");
      } else if (ev.kind === "bankrupt") {
        opts.sfx("oops");
        confetti(state.players[ev.player].pos);
      } else if (ev.kind === "card" || ev.kind === "jail") {
        opts.sfx("tap");
      }
      say(line);
      render();
      later(next, BEAT_MS);
    };
    next();
  }

  // ---- 回合流程 ----
  function finish(reason: TableResult["reason"]): void {
    if (phase === "over") return;
    phase = "over";
    const standings = rankByNetWorth(state);
    const alive = state.players.filter((p) => !p.bankrupt);
    const winner = reason === "goal" ? [...humans][0] ?? 0 : alive.length === 1 ? alive[0].id : standings[0] ?? -1;
    render();
    opts.onOver({
      winner,
      reason,
      rounds: state.round,
      netWorths: state.players.map((p) => netWorth(state, p.id)),
      deeds: state.players.map((p) => deedsOf(state, p.id).length),
      bought: state.players.map((p) => p.deedsBought),
      humanWon: humans.has(winner)
    });
  }

  function checkEnd(): boolean {
    if (opts.goalReached?.(state)) {
      finish("goal");
      return true;
    }
    // 人类座位收摊了就当场结束，不让 AI 自己接着打完
    for (const id of humans) {
      if (state.players[id].bankrupt) {
        finish("bankrupt");
        return true;
      }
    }
    const last = lastOneStandingOrNone(state);
    if (last >= 0 || state.over) {
      finish("bankrupt");
      return true;
    }
    if (state.round > opts.rules.maxRounds) {
      finish("settle");
      return true;
    }
    return false;
  }

  function beginTurn(): void {
    if (phase === "over" || destroyed) return;
    if (checkEnd()) return;
    rolledThisTurn = false;
    legDoubles = false;
    pendingBuy = -1;
    const id = state.turn;
    const p = state.players[id];
    if (p.bankrupt) {
      advanceTurn(state);
      beginTurn();
      return;
    }
    if (humans.has(id)) {
      phase = p.inJail && opts.rules.jail ? "jail" : "idle";
      selected = p.pos;
      say(
        phase === "jail"
          ? `${p.name} 在小黑屋里。交 ${JAIL_FINE} 星币、用出门卡，或者掷出一对同点就能出来。`
          : `${p.name} 的回合。先看看要不要建屋，然后掷骰。`
      );
      render();
      return;
    }
    phase = "busy";
    render();
    later(() => {
      // 暂停时对手也停下来等，回来还是原来那一步
      if (paused) {
        phase = "idle";
        later(beginTurn, BEAT_MS);
        return;
      }
      const events = playTurn(state, id, ctx);
      playBeats(events, () => {
        if (checkEnd()) return;
        advanceTurn(state);
        beginTurn();
      });
    }, BEAT_MS);
  }

  function humanRoll(): void {
    const id = currentHuman();
    if (id < 0 || phase === "busy" || phase === "over" || paused) return;
    const p = state.players[id];
    const dice = nextDiceForHuman();
    lastDice = dice;
    diceEl.textContent = `${DICE_FACES[dice[0]]}${DICE_FACES[dice[1]]}`;
    opts.sfx("tap");

    if (phase === "jail") {
      const res = jailStep(state, id, "roll", dice);
      say(res.note);
      if (!res.freed) {
        rolledThisTurn = true;
        phase = "idle";
        render();
        later(endTurn, BEAT_MS);
        return;
      }
      phase = "busy";
      moveAndResolve(id, res.steps);
      return;
    }

    rolledThisTurn = true;
    const doubles = dice[0] === dice[1];
    say(`${p.name} 掷出 ${dice[0]} + ${dice[1]}${doubles ? "（同点）" : ""}`);
    if (doubles) {
      p.doublesRun++;
      if (p.doublesRun >= 3) {
        sendToJail(state, id);
        renderPos[id] = state.players[id].pos;
        say("连着三次同点，直接去小黑屋歇一歇。");
        legDoubles = false;
        phase = "idle";
        render();
        later(endTurn, BEAT_MS);
        return;
      }
    }
    legDoubles = doubles;
    phase = "busy";
    moveAndResolve(id, dice[0] + dice[1]);
  }

  function nextDiceForHuman(): [number, number] {
    const script = opts.scriptedDice;
    if (script && diceCursor.i < script.length) {
      const d = script[diceCursor.i];
      diceCursor.i++;
      return [d[0], d[1]];
    }
    return rollDice(ctx.rand);
  }

  function moveAndResolve(id: number, steps: number): void {
    const p = state.players[id];
    const from = p.pos;
    const to = moveBy(from, steps);
    p.pos = to;
    const salary = passedGoSalary(state, id, from, to, steps);
    hop(id, from, to, () => {
      selected = to;
      say(`${p.name} 走到 ${tileAt(to).name}`);
      if (salary > 0) {
        opts.sfx("coin");
        say(`经过出发花园，领 ${salary} 星币`);
      }
      render();
      later(() => landing(id, steps), BEAT_MS / 2);
    });
  }

  function landing(id: number, steps: number): void {
    const p = state.players[id];
    const st = state.tiles[p.pos];
    if (isBuyable(p.pos) && st.owner === BANK) {
      if (p.cash >= (tileAt(p.pos).price ?? 0)) {
        pendingBuy = p.pos;
        phase = "decide";
        say(`${tileAt(p.pos).name} 还没有主人，买下来吗？`);
        render();
        return;
      }
      // 全价买不起，但拍卖是无底价的，兜里还有钱就还有机会
      if (opts.rules.auction && p.cash >= 10) {
        say(`${tileAt(p.pos).name} 的标价买不起，不过拍卖是无底价的。`);
        askBid(p.pos, id);
        return;
      }
    }
    const events: EstateEvent[] = [];
    resolveLanding(state, id, steps, ctx, events);
    playBeats(events, afterLanding);
  }

  function afterLanding(): void {
    if (checkEnd()) return;
    const id = state.turn;
    const p = state.players[id];
    if (p.bankrupt || p.inJail || !legDoubles) {
      phase = "idle";
      legDoubles = false;
      render();
      if (!humans.has(id)) later(endTurn, BEAT_MS);
      return;
    }
    phase = "idle";
    say("同点可以再掷一次！");
    render();
  }

  function humanBuyOrBuild(): void {
    const id = currentHuman();
    if (id < 0 || paused) return;
    if (phase === "decide") {
      const pos = pendingBuy;
      pendingBuy = -1;
      phase = "busy";
      if (buyTile(state, id, pos)) {
        opts.sfx("coin");
        say(`${state.players[id].name} 买下了 ${tileAt(pos).name}。`);
      }
      render();
      later(afterLanding, BEAT_MS / 2);
      return;
    }
    if (phase === "jail") {
      const p = state.players[id];
      if (p.outCards <= 0 && p.cash < JAIL_FINE) {
        say(`交罚款要 ${JAIL_FINE} 星币，现在还不够。掷出一对同点也能出来。`);
        return;
      }
      const choice: JailChoice = p.outCards > 0 ? "card" : "pay";
      const res = jailStep(state, id, choice, lastDice);
      say(res.note);
      if (!res.freed) {
        render();
        return;
      }
      opts.sfx("pop");
      phase = "busy";
      const dice = nextDiceForHuman();
      lastDice = dice;
      diceEl.textContent = `${DICE_FACES[dice[0]]}${DICE_FACES[dice[1]]}`;
      rolledThisTurn = true;
      moveAndResolve(id, dice[0] + dice[1]);
      return;
    }
    if (buildableSelected()) {
      if (buildHouse(state, selected)) {
        opts.sfx("pop");
        say(`在 ${tileAt(selected).name} 盖到 ${housesLabel(state.tiles[selected].houses)}。`);
      }
      render();
      return;
    }
    say("这一块现在盖不了。要整条街都归你、都没抵押，而且只能挑房子最少的那一块盖。");
  }

  function declineBuy(): void {
    const id = currentHuman();
    if (id < 0 || phase !== "decide") return;
    const pos = pendingBuy;
    pendingBuy = -1;
    if (!opts.rules.auction) {
      phase = "busy";
      playBeats([{ kind: "note", text: `${tileAt(pos).name} 先留在银行手里。` }], afterLanding);
      return;
    }
    askBid(pos, id);
  }

  /** 不买就上拍卖台：先问玩家这一次最多愿意跟到多少，绝不背着他掏钱 */
  function askBid(pos: number, id: number): void {
    phase = "bid";
    const price = tileAt(pos).price ?? 0;
    const cash = state.players[id].cash;
    const low = Math.min(cash, Math.max(10, Math.round(price * 0.6)));
    const high = Math.min(cash, Math.round(price * 1.2));
    const choices: Array<{ label: string; limit: number }> = [{ label: "🙅 不跟", limit: 0 }];
    if (low >= 10) choices.push({ label: `🔨 最多 ${low}`, limit: low });
    if (high > low) choices.push({ label: `🔨 最多 ${high}`, limit: high });

    bidRow.innerHTML = "";
    bidRow.hidden = false;
    for (const c of choices) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "se-btn se-btn-sm";
      b.textContent = c.label;
      b.addEventListener("click", () => {
        bidRow.hidden = true;
        bidRow.innerHTML = "";
        opts.sfx("tap");
        phase = "busy";
        const events: EstateEvent[] = [];
        runAuction(state, pos, id, ctx, events, new Map([[id, c.limit]]));
        playBeats(events, afterLanding);
      });
      bidRow.appendChild(b);
    }
    say(`${tileAt(pos).name} 要上拍卖台了，你打算最多跟到多少？`);
    render();
  }

  function endTurn(): void {
    if (phase === "over" || destroyed) return;
    if (checkEnd()) return;
    phase = "busy";
    advanceTurn(state);
    beginTurn();
  }

  /** 地契抽屉里的抵押 / 赎回 / 拆屋 */
  function toggleMortgage(): void {
    const id = currentHuman();
    if (id < 0 || paused || !opts.rules.mortgage) return;
    const st = state.tiles[selected];
    if (st.owner !== id) {
      say("这块地不是你的，抵押不了。");
      return;
    }
    if (st.mortgaged) {
      if (unmortgage(state, selected)) {
        opts.sfx("coin");
        say(`花 ${unmortgageCost(selected)} 星币赎回 ${tileAt(selected).name}。`);
      } else say(`赎回要 ${unmortgageCost(selected)} 星币，现在还不够。`);
    } else if (st.houses > 0) {
      const refund = sellHouse(state, selected);
      if (refund > 0) say(`拆掉一栋，退回 ${refund} 星币。抵押之前要把整条街的房子拆光。`);
      else say("拆房也要平均：只能从房子最多的那一块开始拆。");
    } else if (canMortgage(state, selected)) {
      const got = mortgage(state, selected);
      say(`抵押 ${tileAt(selected).name}，拿到 ${got} 星币。抵押着的地不收租。`);
      opts.sfx("coin");
    } else {
      say(`要抵押 ${tileAt(selected).name}，得先把整条街的房子按半价拆光。`);
    }
    render();
  }

  // ---- 键盘 ----
  const onKey = (e: KeyboardEvent): void => {
    if (destroyed) return;
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;
    const id = currentHuman();
    if (id < 0) return;
    const seat = opts.seats[id];
    const isStar = seat.human === "star";
    const rollKey = isStar ? "l" : "f";
    const buyKey = isStar ? "k" : "g";
    const low = k.toLowerCase();

    if (low === rollKey) {
      e.preventDefault();
      humanRoll();
      return;
    }
    if (low === buyKey) {
      e.preventDefault();
      humanBuyOrBuild();
      return;
    }
    if (low === "m") {
      e.preventDefault();
      toggleMortgage();
      return;
    }
    // 朵朵用 WASD 选地块，星星用方向键；顺时针 +1、逆时针 -1
    const step = isStar
      ? k === "ArrowRight" || k === "ArrowDown"
        ? 1
        : k === "ArrowLeft" || k === "ArrowUp"
          ? -1
          : null
      : low === "d" || low === "s"
        ? 1
        : low === "a" || low === "w"
          ? -1
          : null;
    if (typeof step === "number") {
      e.preventDefault();
      selected = moveBy(selected, step);
      opts.sfx("tap");
      render();
    }
  };
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey);

  let pauseEl: HTMLElement | null = null;
  function togglePause(): void {
    paused = !paused;
    if (paused) {
      pauseEl = document.createElement("div");
      pauseEl.className = "se-pause";
      pauseEl.innerHTML = `<div class="se-pause-t">⏸️ 先歇一会儿</div>
        <div class="se-goal">朵朵：W A S D 选地块、F 掷骰、G 购买 / 建屋、M 抵押。<br>星星：方向键选地块、L 掷骰、K 购买 / 建屋。<br>再按一次 Esc 继续。</div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "se-open";
      btn.textContent = "▶ 继续";
      btn.addEventListener("click", () => togglePause());
      pauseEl.appendChild(btn);
      wrap.appendChild(pauseEl);
    } else {
      pauseEl?.remove();
      pauseEl = null;
    }
    render();
  }

  rollBtn.addEventListener("click", () => humanRoll());
  buyBtn.addEventListener("click", () => humanBuyOrBuild());
  endBtn.addEventListener("click", () => {
    if (phase === "decide") declineBuy();
    else endTurn();
  });

  say(`开局啦！${opts.goalText}`);
  render();
  beginTurn();

  return {
    state: () => state,
    destroy() {
      destroyed = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey
      );
      pauseEl?.remove();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  const seats: TableSeat[] = cfg.tiers.map((tier, i) => ({
    name: i === 0 ? "朵朵" : ["星星", "糯糯", "云云"][(i - 1) % 3],
    emoji: i === 0 ? "🌸" : ["⭐", "🍡", "☁️"][(i - 1) % 3],
    human: i === 0 ? "duo" : undefined,
    tier,
    cash: cfg.cashes[i]
  }));

  const table = createTable(stage, {
    seats,
    rules: cfg.rules,
    seed: cfg.seed,
    preset: cfg.preset,
    scriptedDice: cfg.scriptedDice,
    goalText: `${goalLine(cfg)}｜${rulesLine(cfg)}`,
    goalReached: (state) => goalReached(cfg, state),
    sfx: (n) => ctx.sfx(n),
    onOver: (r) => {
      // 只有真的达成目标、或者对手全部收摊才算过关；到点没够线一律重来。
      // 对手先收摊也要看自己买够地没有 —— 只掷骰、一块地都不买，不算学会了这一章
      // （对手收摊时地会整批转到朵朵名下，所以这里数的是自己买的，不是手里有的）。
      const shortBuys = Math.max(0, cfg.goal.minBuys - (r.bought[0] ?? 0));
      const won = r.reason === "goal" || (r.reason === "bankrupt" && r.winner === 0 && shortBuys === 0);
      if (!won) {
        ctx.lose(
          shortBuys > 0
            ? `这一局自己还差买 ${shortBuys} 处产业，下一把路过空地就把它买下来，肯定能行！`
            : "这一局没赶上目标，换个买地顺序再试一次，肯定能行！"
        );
        return;
      }
      const stars = starsFor(cfg, { win: true, rounds: r.rounds, netWorth: r.netWorths[0] ?? 0 });
      ctx.win(stars, `${r.rounds} 回合达成目标，净资产 ${r.netWorths[0]} 星币！`);
    }
  });
  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 对战 1v3",
  endless: "♾️ 短盘连胜",
  duo: "👫 双人同屏"
};

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "se-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "se-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "se-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "se-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);

  let table: Table | null = null;
  let tier: AiTier = "normal";
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string, again: string): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "se-over";
    box.innerHTML = `<div class="se-over-t">${title}</div><div class="se-over-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "se-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function picker(labels: string[], onPick: (i: number) => void): HTMLElement {
    const row = document.createElement("div");
    row.className = "se-optbar";
    labels.forEach((label, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "se-open";
      b.textContent = label;
      b.addEventListener("click", () => {
        api.play("tap");
        onPick(i);
      });
      row.appendChild(b);
    });
    return row;
  }

  function tip(text: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "se-msg";
    el.textContent = text;
    return el;
  }

  function start(): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    if (mode === "versus") {
      stage.appendChild(
        picker(["🐣 菜鸟", "🙂 普通", "😎 高手", "🔥 地狱"], (i) => {
          tier = (["rookie", "normal", "pro", "hell"] as AiTier[])[i];
          runVersus();
        })
      );
      stage.appendChild(tip("1 个人对 3 个本机对手。80 回合到点没人破产，就比谁的净资产高。"));
      return;
    }
    if (mode === "endless") {
      streak = 0;
      runEndless();
      return;
    }
    runDuo();
  }

  function runVersus(): void {
    stage.innerHTML = "";
    const cfg = versusConfig(tier, 1);
    chip.textContent = `🤝 对手：${AI_TIER_LABELS[tier]} ×3`;
    table = createTable(stage, {
      seats: [
        { name: "朵朵", emoji: "🌸", human: "duo", tier: "pro", cash: cfg.cash },
        { name: "星星", emoji: "⭐", tier, cash: cfg.cash },
        { name: "糯糯", emoji: "🍡", tier, cash: cfg.cash },
        { name: "云云", emoji: "☁️", tier, cash: cfg.cash }
      ],
      rules: cfg.rules,
      seed: Math.floor(Math.random() * 1e9),
      goalText: "买地、垄断、盖屋，把三个对手熬到收摊",
      sfx: (n) => api.play(n),
      onOver: (r) => {
        if (r.humanWon) api.addStars(2);
        showOver(
          r.humanWon ? "这一局赢下来啦！" : "这一局到此为止",
          `${r.reason === "settle" ? "80 回合到点比净资产" : "有人先收摊了"}：朵朵 ${r.netWorths[0]} 星币，` +
            `对手 ${r.netWorths.slice(1).join(" / ")}。`,
          "🔁 再打一场"
        );
      }
    });
  }

  function runEndless(): void {
    stage.innerHTML = "";
    const cfg = endlessConfig(streak);
    chip.textContent = `♾️ 连胜 ${streak} · 最高 ${best}`;
    table = createTable(stage, {
      seats: [
        { name: "朵朵", emoji: "🌸", human: "duo", tier: "pro", cash: cfg.cash },
        { name: AI_TIER_LABELS[cfg.tiers[1]], emoji: "⭐", tier: cfg.tiers[1], cash: cfg.cash }
      ],
      rules: {
        build: true,
        cards: true,
        jail: true,
        mortgage: true,
        auction: true,
        fullSetDouble: true,
        maxRounds: cfg.rounds
      },
      seed: Math.floor(Math.random() * 1e9),
      goalText: `短盘 ${cfg.rounds} 回合，赢一局连胜 +1，输一次就从头来`,
      sfx: (n) => api.play(n),
      onOver: (r) => {
        if (r.humanWon) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.play("win");
          showOver(`连胜 ${streak} 场！`, `最高连胜 ${best}。手气正好，接着来一盘吧。`, "▶ 下一盘");
        } else {
          showOver(
            "连胜到这里啦",
            `这一轮连胜 ${streak} 场，最高纪录还是 ${best}。钱包空了没关系，下一局重新开。`,
            "🔁 重新开始"
          );
          streak = 0;
        }
      }
    });
  }

  function runDuo(): void {
    stage.innerHTML = "";
    chip.textContent = "👫 朵朵 WASD+F/G · 星星 方向键+L/K";
    table = createTable(stage, {
      seats: [
        { name: "朵朵", emoji: "🌸", human: "duo", tier: "pro" },
        { name: "星星", emoji: "⭐", human: "star", tier: "pro" },
        { name: "糯糯", emoji: "🍡", tier: "normal" },
        { name: "云云", emoji: "☁️", tier: "rookie" }
      ],
      rules: {
        build: true,
        cards: true,
        jail: true,
        mortgage: true,
        auction: true,
        fullSetDouble: true,
        maxRounds: 60
      },
      seed: Math.floor(Math.random() * 1e9),
      goalText: "两个人轮流操作，60 回合到点比净资产",
      sfx: (n) => api.play(n),
      onOver: (r) => {
        const duo = r.netWorths[0];
        const star = r.netWorths[1];
        showOver(
          duo === star ? "打成平手！" : duo > star ? "朵朵这一局更稳" : "星星这一局更稳",
          `朵朵 ${duo} 星币，星星 ${star} 星币。再来一局换个买地顺序试试。`,
          "🔁 再来一局"
        );
      }
    });
  }

  start();

  return {
    destroy() {
      table?.destroy();
      table = null;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "se-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "se-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "se-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "先看清这一关的目标，再决定买哪条街。垄断一整条街，租金才真的涨得起来。",
      grandMessage: "188 关全部拿下，朵星地产的招牌就挂你名字了！",
      guideTitle: "朵星地产 · 经营笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const ESTATE_CONSTS = { HOP_MS, BEAT_MS, COIN_MS, BOARD_LEN, MAX_HOUSES };

/** 给测试用的参考解法（战役可通关性） */
export { solveLevel, levelConfig };

/** 界面上「这块地现在值多少」的一句话（无障碍标签与预览共用） */
export function tileSummary(state: EstateState, pos: number): string {
  const tile = tileAt(pos);
  const st = state.tiles[pos];
  const bits = [tile.name];
  if (tile.price) bits.push(`售价 ${tile.price}`);
  if (st.owner !== BANK) {
    bits.push(`主人 ${state.players[st.owner].name}`);
    bits.push(housesLabel(st.houses));
    bits.push(st.mortgaged ? "抵押中，不收租" : `租金 ${rentOf(state, pos, 7)}`);
    if (!st.mortgaged) bits.push(`抵押可拿 ${mortgageValue(pos)}`);
  }
  return bits.join(" · ");
}

/** autoManage 在界面里也用得到（AI 托管时的一步） */
export { autoManage };
