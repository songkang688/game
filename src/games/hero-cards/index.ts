import { meta } from "./meta";
export { meta };

// 英杰令:五个人围一圈,一位花主亮在明处,其余身份全扣着。
// 算距离、用技能、猜身份,把该请下桌的人一个个请下桌。
// 188 关残局战役 + 一人对四机的身份场 + 连胜无尽,全程离线。
//
// 为什么没有双人同屏:这一款的乐趣全在「藏着身份」上,两个人挤一块屏幕会互相
// 看光手牌和身份牌,规则就塌了。所以 meta.modes 里不填 twoPlayer,攻略里也写明了。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { cardLabel, cardName, isRed, GEARS, type Card } from "./cards";
import {
  cardArtSVG,
  deckStackSVG,
  emptyDiscardSVG,
  gearIconSVG,
  healRiseSVG,
  heartsSVG,
  heroPortrait,
  kindIconSVG,
  petalBitSVG,
  slashArcSVG,
  statIconSVG
} from "./cardart";
import {
  advanceTurn,
  aliveIds,
  borrowVictims,
  campOf,
  canPlay,
  createGame,
  distanceBetween,
  endTurn,
  giftCard,
  giftLeft,
  isGroupTrick,
  legalTargets,
  playCard,
  rangeOf,
  ROLE_EMOJI,
  ROLE_LABELS,
  startTurn,
  usableAsDodge,
  usableAsSlash,
  type Camp,
  type Flow,
  type GameState,
  type Reply,
  type Request,
  type SeatSpec
} from "./engine";
import { heroOf } from "./heroes";
import { AI_TIER_LABELS, AI_TIER_TIPS, decideRespond, runAiTurn, rollHeroes, rollRoles, type AiTier } from "./ai";
import {
  CHAPTERS,
  buildLevel,
  endlessOpenHand,
  endlessTier,
  goalLine,
  levelConfig,
  solveLevel,
  starsFor,
  type LevelConfig
} from "./levels";
import guide from "./guide";

/** 一张牌飞出去的时长(毫秒),不允许瞬变 */
export const FLY_MS = 220;
/** 出牌飞到桌面中心后放大亮相的停留时长 */
export const HOLD_MS = 400;
/** AI 每一步之间的停顿,给孩子看清楚 */
export const BEAT_MS = 460;
/** 花瓣飘落的时长 */
export const PETAL_MS = 620;
/** 结算时逐个揭晓身份的间隔 */
export const REVEAL_MS = 420;

/** 人类玩家永远坐 0 号位 */
export const HUMAN = 0;

export const HC_CSS = `
.hc-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;position:relative;
  background:linear-gradient(180deg,#FFF6F0,#FFF0F6);border-radius:16px;padding:10px;
  user-select:none;-webkit-user-select:none;}
.hc-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:8px;}
.hc-badge{background:#fff;border-radius:14px;padding:5px 10px;font-size:16px;font-weight:800;color:#9a5a3a;
  box-shadow:0 2px 6px rgba(210,160,140,.3);line-height:1.5;overflow-wrap:anywhere;}
.hc-seats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
.hc-seat{flex:1 1 148px;min-width:0;background:#fff;border-radius:14px;padding:6px 8px;text-align:left;
  border:none;font-family:inherit;font-size:16px;font-weight:800;color:#7a4a34;cursor:pointer;
  box-shadow:0 2px 6px rgba(210,160,140,.28);line-height:1.5;overflow-wrap:anywhere;min-height:44px;
  /* 座位那行是「手牌 10 距 1」这样一段段拼的,窄屏优先在空格处折,
     别把「自己」「手牌」这种词从中间劈开 */
  word-break:keep-all;display:flex;gap:7px;align-items:flex-start;}
.hc-seat-face{flex:0 0 36px;width:36px;height:36px;margin-top:1px;}
.hc-seat-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px;}
.hc-seat-on{outline:3px solid #F0975C;}
.hc-seat-turn{background:#FFF1E2;}
.hc-seat-pick{outline:3px dashed #D2603A;}
.hc-seat-out{opacity:.45;}
.hc-seat-name{font-size:var(--mt-body,16px);}
.hc-seat-line{font-size:var(--mt-body,16px);color:#8a6a54;display:flex;align-items:center;gap:3px;flex-wrap:wrap;}
.hc-hearts{line-height:0;margin:1px 0;}
.hc-gear-ico{display:inline-flex;width:16px;height:16px;flex:0 0 auto;}
.hc-role{padding:0 5px;border-radius:6px;color:#fff;}
.hc-role-lord{background:#96691c;}
.hc-role-loyal{background:#40619e;}
.hc-role-rebel{background:#b13a40;}
.hc-role-spy{background:#7a4fa8;}
@keyframes hcshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.hc-seat-hit{animation:hcshake 260ms ease;outline:3px solid #E2574D;}
.hc-mid{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:stretch;margin:8px 0;}
.hc-table{display:flex;gap:8px;align-items:center;border-radius:14px;padding:6px 10px;
  background:linear-gradient(180deg,#FBEBD8,#F5DCC2);
  box-shadow:inset 0 0 0 2px #EBD2B4,0 2px 6px rgba(210,160,140,.25);}
.hc-deck-art{width:46px;height:58px;flex:0 0 auto;}
.hc-discard{display:flex;align-items:center;}
.hc-discard-art{width:40px;height:56px;flex:0 0 auto;}
.hc-hero{display:flex;gap:7px;align-items:center;background:#fff;border-radius:14px;padding:4px 10px;
  box-shadow:0 2px 6px rgba(210,160,140,.25);}
.hc-hero-face{width:42px;height:42px;flex:0 0 auto;}
.hc-pile{background:none;border-radius:12px;padding:2px 2px;font-size:16px;font-weight:800;color:#7a5a44;
  line-height:1.4;}
.hc-log{background:#FFFDFA;border-radius:12px;padding:8px;font-size:16px;font-weight:700;color:#6b5a4a;
  line-height:1.6;min-height:4.8em;max-height:8em;overflow:hidden;overflow-wrap:anywhere;white-space:pre-line;}
.hc-hand{display:flex;gap:6px;overflow-x:auto;padding:12px 4px 8px;scrollbar-width:none;}
.hc-hand::-webkit-scrollbar{display:none;}
.hc-card{flex:0 0 auto;width:60px;min-height:84px;border:none;border-radius:9px;background:#fff;cursor:pointer;
  position:relative;font-family:inherit;padding:0;
  box-shadow:0 2px 0 #E6D5C0,0 3px 7px rgba(200,150,130,.32);
  /* 扇形微倾:--fan/--arc 由 renderHand 按张数算,中间高两边低 */
  transform:rotate(var(--fan,0deg)) translateY(var(--arc,0px));}
.hc-card>svg{position:absolute;inset:0;width:100%;height:100%;display:block;}
.hc-card-suit{font-size:var(--mt-control,14px);font-weight:800;}
.hc-card-name{font-size:var(--mt-control,14px);font-weight:800;}
.hc-card-on{outline:3px solid #E0713F;transform:rotate(var(--fan,0deg)) translateY(calc(var(--arc,0px) - 8px));}
.hc-card-dim{opacity:.5;filter:grayscale(.65);}
.hc-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.hc-btn{min-width:84px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:16px;
  font-weight:900;cursor:pointer;background:#FBD9C0;color:#8a4318;box-shadow:0 3px 0 #E0B392;padding:0 12px;}
.hc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #E0B392;}
.hc-btn:disabled{opacity:.45;cursor:default;}
.hc-btn-go{background:#F5A97A;color:#5c2a08;box-shadow:0 3px 0 #D2854F;}
.hc-btn:focus-visible,.hc-card:focus-visible,.hc-seat:focus-visible{outline:3px solid #6b3210;outline-offset:2px;}
.hc-msg{text-align:center;min-height:1.6em;font-size:16px;font-weight:800;color:#8a5238;margin-top:6px;
  line-height:1.5;overflow-wrap:anywhere;}
.hc-fly{position:absolute;width:46px;height:64px;pointer-events:none;z-index:6;
  filter:drop-shadow(0 3px 4px rgba(120,70,40,.35));
  transition:left ${FLY_MS}ms ease,top ${FLY_MS}ms ease,opacity ${FLY_MS}ms ease,transform ${FLY_MS}ms ease;}
.hc-fly svg{width:100%;height:100%;display:block;}
@keyframes hcspin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.hc-fly-spin svg{animation:hcspin ${FLY_MS * 2 + HOLD_MS}ms linear;}
.hc-fx{position:absolute;pointer-events:none;z-index:7;}
.hc-fx svg{width:100%;height:100%;display:block;}
.hc-streak{width:44px;height:44px;transition:left ${FLY_MS}ms ease,top ${FLY_MS}ms ease;}
.hc-slashfx{width:46px;height:46px;animation:hcpop 300ms ease-out forwards;}
.hc-healfx{width:38px;height:38px;animation:hcrise 520ms ease-out forwards;}
@keyframes hcpop{0%{transform:scale(.4);opacity:0}30%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:0}}
@keyframes hcrise{0%{transform:translateY(8px);opacity:0}25%{opacity:1}100%{transform:translateY(-24px);opacity:0}}
.hc-petal{position:absolute;width:14px;height:14px;pointer-events:none;z-index:7;}
.hc-petal svg{width:100%;height:100%;display:block;}
@keyframes hcpetal{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),52px) rotate(200deg);opacity:0}}
.hc-over{text-align:center;padding:20px 14px;background:#fff;border-radius:16px;position:relative;
  box-shadow:0 4px 14px rgba(200,150,130,.3);}
.hc-over-t{font-size:20px;font-weight:900;color:#9a5030;margin-bottom:6px;}
.hc-over-s{font-size:16px;font-weight:700;color:#7a6252;line-height:1.6;margin-bottom:12px;overflow-wrap:anywhere;}
.hc-over-face{width:76px;height:76px;margin:0 auto 6px;}
.hc-over-face svg{width:100%;height:100%;display:block;}
.hc-statbar{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:0 0 12px;}
.hc-stat{display:inline-flex;align-items:center;gap:5px;font-size:16px;font-weight:800;color:#7a5a44;
  background:#FFF6EC;border-radius:10px;padding:4px 10px;}
.hc-reveal{font-size:var(--mt-body,16px);font-weight:800;color:#7a5238;line-height:1.7;margin-bottom:10px;}
.hc-modebar,.hc-optbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.hc-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#8a5238;text-align:center;overflow-wrap:anywhere;}
.hc-open{border:none;border-radius:999px;padding:10px 18px;min-height:44px;font-size:15px;font-weight:900;
  color:#fff;cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#EE9A63,#D07540);
  box-shadow:0 4px 0 #A95A28;}
.hc-open:active{transform:translateY(2px);box-shadow:0 2px 0 #A95A28;}
.hc-mode{max-width:660px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.hc-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.hc-back{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffd9;color:#B0763A;box-shadow:0 3px 0 rgba(190,140,80,.35);}
.hc-pause{position:absolute;inset:0;background:rgba(255,248,242,.96);border-radius:16px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;}
.hc-pause-t{font-size:20px;font-weight:900;color:#9a5030;}
.hc-keys{font-size:var(--mt-body,16px);font-weight:700;color:#7a6252;line-height:1.7;}
@media (max-width:360px){
  .hc-wrap{padding:8px;}
  .hc-seat{flex:1 1 46%;padding:5px 6px;}
  .hc-seat-face{flex:0 0 30px;width:30px;height:30px;}
  .hc-badge{padding:4px 8px;}
  /* 红线:360px 下单卡仍 ≥ 56×80,扇形退化成平排 */
  .hc-card{width:56px;min-height:80px;transform:none;}
  .hc-card-on{transform:translateY(-4px);}
  .hc-deck-art{width:40px;height:52px;}
  .hc-discard-art{width:36px;height:50px;}
  .hc-btn{min-width:74px;font-size:15px;padding:0 8px;}
}
@media (prefers-reduced-motion:reduce){
  .hc-fly{display:none;}
  .hc-petal{display:none;}
  .hc-fx{display:none;}
  .hc-seat-hit{animation:none;}
  .hc-card-on{transform:none;}
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

// ---------------------------------------------------------------------------
// 键位(纯函数,单测直接读)
// ---------------------------------------------------------------------------

export type KeyAction = "left" | "right" | "up" | "down" | "confirm" | "cancel" | "pause" | null;

/**
 * 朵朵:`WASD` 移光标 + `F` 确定 + `G` 取消。
 * 星星:方向键 + `L` / `K`(这一款没有同屏双人,方向键留给不习惯 WASD 的人)。
 * `Esc` 暂停。
 */
export function keyAction(key: string): KeyAction {
  const k = key.toLowerCase();
  if (key === "Escape") return "pause";
  if (k === "a" || key === "ArrowLeft") return "left";
  if (k === "d" || key === "ArrowRight") return "right";
  if (k === "w" || key === "ArrowUp") return "up";
  if (k === "s" || key === "ArrowDown") return "down";
  if (k === "f" || k === "l" || key === "Enter") return "confirm";
  if (k === "g" || k === "k") return "cancel";
  return null;
}

/** 响应请求时,手上哪几张牌是打得出去的 */
export function playableForRequest(state: GameState, req: Request): Card[] {
  const p = state.players[req.who];
  if (!p || req.kind !== "respond") return [];
  switch (req.need) {
    case "dodge":
      return p.hand.filter((c) => usableAsDodge(state, req.who, c));
    case "slash":
      return p.hand.filter((c) => usableAsSlash(state, req.who, c));
    case "heal":
      return p.hand.filter((c) => c.kind === "heal");
    case "nullify":
      return p.hand.filter((c) => c.kind === "nullify");
    default:
      return [];
  }
}

/** 座位上那一行字 */
export function seatSummary(state: GameState, id: number, viewer = HUMAN): string {
  const p = state.players[id];
  if (!p) return "";
  const hero = heroOf(p.heroId);
  const role = p.revealed ? `${ROLE_EMOJI[p.role]}${ROLE_LABELS[p.role]}` : "❓";
  const dist = id === viewer ? "自己" : `距 ${distanceBetween(state, viewer, id)}`;
  return `${hero.emoji}${p.name}·${hero.name} ${role} 元气 ${Math.max(0, p.vigor)}/${p.maxVigor} 手牌 ${p.hand.length} ${dist}`;
}

/** 结算时逐个揭晓的顺序:先自己,再按座位绕一圈 */
export function revealOrder(state: GameState, viewer = HUMAN): number[] {
  const n = state.players.length;
  return Array.from({ length: n }, (_, i) => (viewer + i) % n);
}

/** 一句「你赢了没有」 */
export function outcomeLine(winner: Camp | null, myCamp: Camp): string {
  if (!winner) return "这一局到点还没分出高下,算平局。下一盘再来。";
  if (winner === myCamp) return "这一局是你们这边赢了!";
  return "这一局没赢下来,不过每一次都看得更清楚一点,再来一盘吧。";
}

// ---------------------------------------------------------------------------
// 牌桌
// ---------------------------------------------------------------------------

export interface TableResult {
  winner: Camp | null;
  myWin: boolean;
  turns: number;
  timeout: boolean;
  /** 纯展示:这一局你打出的攻击 / 防御 / 回复张数,结算面板画图标条用 */
  stats: { attack: number; guard: number; heal: number };
  /** 纯展示:胜方阵营的代表英杰(画大头像),平局为 null */
  winnerHero: string | null;
}

export interface TableOptions {
  seats: SeatSpec[];
  seed: number;
  tier: AiTier;
  goalText: string;
  recipe?: LevelConfig["recipe"];
  factionLock?: boolean;
  openHand?: number;
  /** 玩家最多能过几个回合(残局用);不给就不限 */
  maxTurns?: number;
  sfx: (n: SoundName) => void;
  onOver: (r: TableResult) => void;
}

export interface Table {
  destroy: () => void;
  /** 只给测试:当前局面 */
  state: () => GameState;
}

type Mode = "idle" | "target" | "respond" | "discard" | "busy" | "over";

export function createTable(host: HTMLElement, opts: TableOptions): Table {
  const soft = reducedMotion();
  const state = createGame({
    seats: opts.seats,
    seed: opts.seed,
    recipe: opts.recipe,
    factionLock: opts.factionLock,
    openHand: opts.openHand
  });
  const myCamp = campOf(state.players[HUMAN].role);

  let mode: Mode = "idle";
  let selected: Card | null = null;
  let handCursor = 0;
  let seatCursor = 1 % state.players.length;
  let pendingTargets: number[] = [];
  let request: Request | null = null;
  let discardPicked: Card[] = [];
  let flow: Flow<unknown> | null = null;
  let afterFlow: (() => void) | null = null;
  let paused = false;
  let destroyed = false;
  let myTurns = 0;
  let logShown = 0;
  /** 纯展示:自己打出的攻击 / 防御 / 回复张数,结算面板画图标条 */
  const stats = { attack: 0, guard: 0, heal: 0 };
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function later(fn: () => void, ms: number): void {
    if (destroyed) return;
    const t = setTimeout(() => {
      timers.delete(t);
      if (!destroyed) fn();
    }, Math.max(0, soft ? Math.min(ms, 30) : ms));
    timers.add(t);
  }

  // ---- DOM ----
  const wrap = document.createElement("div");
  wrap.className = "hc-wrap";
  const style = document.createElement("style");
  style.textContent = HC_CSS;
  wrap.appendChild(style);

  const top = document.createElement("div");
  top.className = "hc-top";
  const goalChip = document.createElement("span");
  goalChip.className = "hc-badge";
  goalChip.textContent = opts.goalText;
  const turnChip = document.createElement("span");
  turnChip.className = "hc-badge";
  top.append(goalChip, turnChip);
  wrap.appendChild(top);

  const seatRow = document.createElement("div");
  seatRow.className = "hc-seats";
  const seatEls = state.players.map((p) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "hc-seat";
    el.addEventListener("click", () => onSeatClick(p.id));
    seatRow.appendChild(el);
    return el;
  });
  wrap.appendChild(seatRow);

  // 战桌中心区:左边是叠着牌背的牌堆实体,右边露出弃牌堆顶那张,中间的数字照旧是文本
  const mid = document.createElement("div");
  mid.className = "hc-mid";
  const tableZone = document.createElement("div");
  tableZone.className = "hc-table";
  const deckArt = document.createElement("span");
  deckArt.className = "hc-deck-art";
  deckArt.setAttribute("aria-hidden", "true");
  deckArt.innerHTML = deckStackSVG();
  const pileChip = document.createElement("span");
  pileChip.className = "hc-pile";
  const discardBox = document.createElement("span");
  discardBox.className = "hc-discard";
  const discardArt = document.createElement("span");
  discardArt.className = "hc-discard-art";
  discardArt.setAttribute("aria-hidden", "true");
  discardBox.appendChild(discardArt);
  tableZone.append(deckArt, pileChip, discardBox);
  // 英杰面板:自己的 Q 版头像挨着技能与攻击范围
  const heroPanel = document.createElement("div");
  heroPanel.className = "hc-hero";
  const heroFace = document.createElement("span");
  heroFace.className = "hc-hero-face";
  heroFace.setAttribute("aria-hidden", "true");
  heroFace.innerHTML = heroPortrait(state.players[HUMAN].heroId);
  const skillChip = document.createElement("span");
  skillChip.className = "hc-pile";
  heroPanel.append(heroFace, skillChip);
  mid.append(tableZone, heroPanel);
  wrap.appendChild(mid);

  const logEl = document.createElement("div");
  logEl.className = "hc-log";
  wrap.appendChild(logEl);

  const handEl = document.createElement("div");
  handEl.className = "hc-hand";
  handEl.setAttribute("aria-label", "你的手牌");
  wrap.appendChild(handEl);

  const pad = document.createElement("div");
  pad.className = "hc-pad";
  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "hc-btn hc-btn-go";
  okBtn.textContent = "✅ 确定 F";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "hc-btn";
  cancelBtn.textContent = "↩️ 取消 G";
  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "hc-btn";
  endBtn.textContent = "⏭️ 结束回合";
  pad.append(okBtn, cancelBtn, endBtn);
  wrap.appendChild(pad);

  const msg = document.createElement("div");
  msg.className = "hc-msg";
  wrap.appendChild(msg);

  host.appendChild(wrap);

  function say(text: string): void {
    msg.textContent = text;
  }

  // ---- 动画(soft = prefers-reduced-motion:一个特效节点都不建,画面直接落到终态) ----

  /** 某个座位在画面上大概的位置(百分比坐标,座位横排均摊) */
  function seatPos(id: number): { left: string; top: string } {
    const n = Math.max(1, state.players.length);
    return { left: `${8 + (id + 0.5) * (78 / n)}%`, top: "16%" };
  }

  /**
   * 出牌演出:整张卡面先飞到桌面中心放大亮相,停一拍,
   * 再按去向收尾——普通牌滑进弃牌堆,装备缩进目标座位,延时锦囊转着圈贴到目标头顶。
   */
  function flyCard(card: Card, fromSeat: number, toKind: "discard" | "gear" | "delay", toSeat = fromSeat): void {
    if (soft) return;
    const el = document.createElement("div");
    el.className = `hc-fly${toKind === "delay" ? " hc-fly-spin" : ""}`;
    el.innerHTML = cardArtSVG(card);
    const from = fromSeat === HUMAN ? { left: "44%", top: "72%" } : seatPos(fromSeat);
    el.style.left = from.left;
    el.style.top = from.top;
    wrap.appendChild(el);
    later(() => {
      el.style.left = "40%";
      el.style.top = "38%";
      el.style.transform = "scale(1.12)";
    }, 16);
    later(() => {
      const to = toKind === "discard" ? { left: "56%", top: "32%" } : seatPos(toSeat);
      el.style.left = to.left;
      el.style.top = to.top;
      el.style.opacity = "0";
      el.style.transform = toKind === "gear" ? "scale(.35)" : "scale(.5)";
    }, FLY_MS + HOLD_MS);
    later(() => el.remove(), FLY_MS * 2 + HOLD_MS + 120);
  }

  /** 攻击类:一道剑光从出牌人划向目标(分级口径:剑光 + 星星,无血液) */
  function streakFx(fromSeat: number, toSeat: number): void {
    if (soft) return;
    const el = document.createElement("div");
    el.className = "hc-fx hc-streak";
    el.innerHTML = slashArcSVG();
    const from = fromSeat === HUMAN ? { left: "44%", top: "70%" } : seatPos(fromSeat);
    el.style.left = from.left;
    el.style.top = from.top;
    wrap.appendChild(el);
    const to = seatPos(toSeat);
    later(() => {
      el.style.left = to.left;
      el.style.top = to.top;
    }, 16);
    later(() => el.remove(), FLY_MS + 140);
  }

  /** 受击:目标座位震一下 + 星光迸开 */
  function hitFx(seatId: number): void {
    if (soft) return;
    const seat = seatEls[seatId];
    if (seat && !seat.className.includes("hc-seat-hit")) {
      seat.className += " hc-seat-hit";
      later(() => {
        seat.className = seat.className.replace(" hc-seat-hit", "");
      }, 300);
    }
    const el = document.createElement("div");
    el.className = "hc-fx hc-slashfx";
    el.innerHTML = slashArcSVG();
    const at = seatPos(seatId);
    el.style.left = at.left;
    el.style.top = at.top;
    wrap.appendChild(el);
    later(() => el.remove(), 340);
  }

  /** 回血:绿光托着红心 +1 往上飘 */
  function healFx(seatId: number): void {
    if (soft) return;
    const el = document.createElement("div");
    el.className = "hc-fx hc-healfx";
    el.innerHTML = healRiseSVG();
    const at = seatPos(seatId);
    el.style.left = at.left;
    el.style.top = at.top;
    wrap.appendChild(el);
    later(() => el.remove(), 560);
  }

  /** 掉元气就飘几片花瓣,不做红闪 */
  function petals(seatId: number, n: number): void {
    if (soft) return;
    for (let i = 0; i < Math.max(1, n * 2); i++) {
      const el = document.createElement("div");
      el.className = "hc-petal";
      el.innerHTML = petalBitSVG(i % 2 === 0 ? "petal" : "spark");
      el.style.left = `${10 + seatId * 9 + i * 2}%`;
      el.style.top = "24%";
      el.style.setProperty("--dx", `${(i - 2) * 8}px`);
      el.style.animation = `hcpetal ${PETAL_MS + i * 40}ms ease-out forwards`;
      wrap.appendChild(el);
      later(() => el.remove(), PETAL_MS + i * 40 + 100);
    }
  }

  // ---- 画面 ----
  function render(): void {
    if (destroyed) return;
    const me = state.players[HUMAN];
    turnChip.textContent = state.over
      ? "本局结束"
      : `第 ${state.round} 圈 · 轮到 ${state.players[state.turn]?.name ?? "-"}${
          opts.maxTurns ? ` · 你还有 ${Math.max(0, opts.maxTurns - myTurns)} 个回合` : ""
        }`;

    seatEls.forEach((el, i) => {
      const p = state.players[i];
      const hero = heroOf(p.heroId);
      const gear = Object.values(p.gear).filter((c): c is Card => Boolean(c));
      // aria 用纯文字口径,画面上装备名前画小图标
      const gearText = gear.length
        ? gear.map((c) => `${GEARS[c.gear!].emoji}${GEARS[c.gear!].name}`).join(" ")
        : "没有装备";
      const gearHtml = gear.length
        ? gear
            .map((c) => `<span class="hc-gear-ico" aria-hidden="true">${gearIconSVG(c.gear!)}</span>${GEARS[c.gear!].name}`)
            .join(" ")
        : "没有装备";
      const delayed = p.delayed.length
        ? ` <span class="hc-gear-ico" aria-hidden="true">${kindIconSVG("playful")}</span>×${p.delayed.length}`
        : "";
      const role = p.revealed
        ? `<b class="hc-role hc-role-${p.role}">${ROLE_LABELS[p.role]}</b>`
        : `<b class="hc-role hc-role-spy">?</b>`;
      const dist = i === HUMAN ? "自己" : `距 ${distanceBetween(state, HUMAN, i)}`;
      const pickable = mode === "target" && pendingTargets.includes(i);
      el.className = `hc-seat${i === state.turn ? " hc-seat-turn" : ""}${p.out ? " hc-seat-out" : ""}${
        pickable ? " hc-seat-pick" : ""
      }${mode === "target" && i === seatCursor ? " hc-seat-on" : ""}`;
      el.innerHTML = `<span class="hc-seat-face" aria-hidden="true">${heroPortrait(p.heroId)}</span>
        <span class="hc-seat-main">
          <span class="hc-seat-name">${p.name}·${hero.name} ${role}</span>
          <span class="hc-hearts" aria-hidden="true">${heartsSVG(Math.max(0, p.vigor), p.maxVigor)}</span>
          <span class="hc-seat-line">手牌 ${p.hand.length} · ${dist}${delayed}${p.out ? " · 已下桌休息" : ""}</span>
          <span class="hc-seat-line">${gearHtml}</span>
        </span>`;
      el.setAttribute("aria-label", `${seatSummary(state, i)},${gearText}`);
      el.disabled = p.out;
    });

    pileChip.textContent = `牌堆 ${state.pile.deck.length} · 弃牌 ${state.pile.discard.length}`;
    const topDiscard = state.pile.discard[state.pile.discard.length - 1];
    discardArt.innerHTML = topDiscard ? cardArtSVG(topDiscard) : emptyDiscardSVG();
    const hero = heroOf(me.heroId);
    skillChip.textContent = `${hero.name}:${hero.skills.map((s) => s.name).join(" / ")} · 范围 ${rangeOf(
      state,
      HUMAN
    )}`;

    const lines = state.log.slice(Math.max(0, state.log.length - 6));
    logShown = state.log.length;
    logEl.textContent = lines.join("\n");

    renderHand();
    renderButtons();
  }

  function renderHand(): void {
    handEl.innerHTML = "";
    const me = state.players[HUMAN];
    const okSet = new Set<number>();
    if (mode === "respond" && request) {
      for (const c of playableForRequest(state, request)) okSet.add(c.id);
    } else if (mode === "discard") {
      for (const c of me.hand) okSet.add(c.id);
    } else {
      for (const c of me.hand) {
        if (canPlay(state, HUMAN, c) || (giftLeft(state, HUMAN) > 0 && me.hand.length > 1)) okSet.add(c.id);
      }
    }
    const center = (me.hand.length - 1) / 2;
    me.hand.forEach((card, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const chosen = selected?.id === card.id || discardPicked.some((c) => c.id === card.id);
      btn.className = `hc-card${isRed(card) ? " hc-card-red" : ""}${chosen || i === handCursor ? " hc-card-on" : ""}${
        okSet.has(card.id) ? "" : " hc-card-dim"
      }`;
      // 扇形微倾:每张差 2°,中间高两边低;360px 窄屏由 CSS 退化成平排
      btn.style.setProperty("--fan", `${Math.max(-8, Math.min(8, (i - center) * 2)).toFixed(1)}deg`);
      btn.style.setProperty("--arc", `${(Math.abs(i - center) * 2).toFixed(1)}px`);
      btn.innerHTML = cardArtSVG(card);
      btn.setAttribute("aria-label", cardLabel(card));
      btn.addEventListener("click", () => onCardClick(card));
      handEl.appendChild(btn);
    });
  }

  function renderButtons(): void {
    const myTurn = state.turn === HUMAN && !state.over && !paused;
    okBtn.disabled = state.over || paused || (mode === "idle" && !selected);
    cancelBtn.disabled = state.over || paused || (!selected && mode !== "respond" && mode !== "target");
    endBtn.disabled = state.over || paused || !(myTurn && (mode === "idle" || mode === "target"));
    cancelBtn.textContent = mode === "respond" ? "🙅 不出 G" : "↩️ 取消 G";
    okBtn.textContent = mode === "discard" ? `✅ 放下 ${discardPicked.length} 张` : "✅ 确定 F";
  }

  // ---- 生成器驱动 ----
  /** 一路推进,直到轮到玩家做决定或者这一段结算完 */
  function pump(reply: Reply): void {
    if (!flow) return;
    let step = flow.next(reply);
    let guard = 0;
    while (!step.done) {
      if (++guard > 5000) break;
      const req = step.value;
      if (req.who === HUMAN) {
        request = req;
        mode = req.kind === "discard" ? "discard" : "respond";
        discardPicked = [];
        selected = null;
        say(req.prompt);
        render();
        return;
      }
      step = flow.next(decideRespond(state, req, opts.tier));
    }
    flow = null;
    request = null;
    const done = afterFlow;
    afterFlow = null;
    render();
    done?.();
  }

  function startFlow(f: Flow<unknown>, done: () => void): void {
    flow = f;
    afterFlow = done;
    mode = "busy";
    pump({} as Reply);
  }

  // ---- 回合 ----
  function beginTurn(): void {
    if (destroyed || state.over) return;
    if (checkEnd()) return;
    const who = state.turn;
    const p = state.players[who];
    if (p.out) {
      advanceTurn(state);
      beginTurn();
      return;
    }
    if (who === HUMAN) {
      myTurns++;
      if (opts.maxTurns && myTurns > opts.maxTurns) {
        finish(true);
        return;
      }
      const before = snapshotVigor();
      startTurn(state, HUMAN);
      showVigorFx(before);
      mode = "idle";
      selected = null;
      pendingTargets = [];
      say(p.skipPlay ? "贪玩令判定没过,这个回合光顾着玩,直接结束吧。" : "你的回合:点一张牌,再点要指的人。");
      render();
      if (p.skipPlay) later(() => doEndTurn(), BEAT_MS);
      return;
    }
    mode = "busy";
    render();
    later(() => {
      if (paused) {
        later(beginTurn, BEAT_MS);
        return;
      }
      const before = snapshotVigor();
      startFlow(runAiTurn(state, who, opts.tier) as Flow<unknown>, () => {
        showVigorFx(before);
        opts.sfx("tap");
        if (checkEnd()) return;
        advanceTurn(state);
        later(beginTurn, BEAT_MS);
      });
    }, BEAT_MS);
  }

  function snapshotVigor(): number[] {
    return state.players.map((p) => p.vigor);
  }

  /** 打出「攻击 / 防御 / 回血」画面必须不一样:掉元气飘花瓣 + 震动,回元气绿光飘心 */
  function showVigorFx(before: number[]): void {
    state.players.forEach((p, i) => {
      const diff = p.vigor - before[i];
      if (diff < 0) {
        petals(i, -diff);
        hitFx(i);
      } else if (diff > 0) {
        healFx(i);
      }
    });
  }

  /** 出牌统计(只记自己,纯展示不进规则) */
  function countPlay(card: Card): void {
    const k = card.kind;
    if (k === "slash" || k === "duel" || k === "petalStorm" || k === "starShower" || k === "borrow") stats.attack++;
    else if (k === "dodge" || k === "nullify") stats.guard++;
    else if (k === "heal") stats.heal++;
  }

  function checkEnd(): boolean {
    if (!state.over) return false;
    finish(false);
    return true;
  }

  function finish(timeout: boolean): void {
    if (mode === "over") return;
    mode = "over";
    for (const p of state.players) p.revealed = true;
    render();
    // 逐个揭晓身份牌
    const order = revealOrder(state);
    order.forEach((id, i) => {
      later(() => {
        const p = state.players[id];
        say(`${p.name} 的身份是 ${ROLE_EMOJI[p.role]}${ROLE_LABELS[p.role]}`);
      }, REVEAL_MS * (i + 1));
    });
    // 胜方阵营的代表英杰(优先还在桌上的那位),结算面板画大头像
    const winnerHero = state.winner
      ? (state.players.find((p) => campOf(p.role) === state.winner && !p.out) ??
          state.players.find((p) => campOf(p.role) === state.winner))?.heroId ?? null
      : null;
    later(
      () => {
        opts.onOver({
          winner: state.winner,
          myWin: !timeout && state.winner === myCamp,
          turns: myTurns,
          timeout,
          stats: { ...stats },
          winnerHero
        });
      },
      REVEAL_MS * (order.length + 1)
    );
  }

  function doEndTurn(): void {
    if (state.over || destroyed) return;
    startFlow(endTurn(state, HUMAN) as Flow<unknown>, () => {
      if (checkEnd()) return;
      advanceTurn(state);
      mode = "busy";
      later(beginTurn, BEAT_MS);
    });
  }

  // ---- 玩家操作 ----
  function onCardClick(card: Card): void {
    if (paused || state.over) return;
    handCursor = Math.max(0, state.players[HUMAN].hand.findIndex((c) => c.id === card.id));
    if (mode === "discard") {
      const at = discardPicked.findIndex((c) => c.id === card.id);
      if (at >= 0) discardPicked.splice(at, 1);
      else if (request && request.kind === "discard" && discardPicked.length < request.count) discardPicked.push(card);
      opts.sfx("tap");
      render();
      return;
    }
    if (mode === "respond") {
      if (!request) return;
      const ok = playableForRequest(state, request).some((c) => c.id === card.id);
      if (!ok) {
        say("这张牌现在打不出去,换一张,或者按 G 不出。");
        return;
      }
      opts.sfx("pop");
      flyCard(card, HUMAN, "discard");
      countPlay(card);
      const before = snapshotVigor();
      mode = "busy";
      request = null;
      pump({ card });
      showVigorFx(before);
      return;
    }
    if (state.turn !== HUMAN) {
      say("现在不是你的回合,等一下下。");
      return;
    }
    selected = card;
    const targets = legalTargets(card, state, HUMAN);
    pendingTargets = targets;
    if (isGroupTrick(card.kind)) {
      mode = "idle";
      say(`${cardName(card)}:对所有人生效。按 F 打出去。`);
    } else if (targets.length === 0) {
      mode = "idle";
      say(
        giftLeft(state, HUMAN) > 0
          ? `${cardName(card)} 现在指不了人,不过可以按 F 把它送给别人。`
          : `${cardName(card)} 现在打不出去,换一张试试。`
      );
    } else {
      mode = "target";
      seatCursor = targets[0];
      say(`${cardName(card)}:选一个人(距离要够),再按 F 确定。`);
    }
    opts.sfx("tap");
    render();
  }

  function onSeatClick(id: number): void {
    if (paused || state.over || mode !== "target") return;
    if (!pendingTargets.includes(id)) {
      say("这个人现在指不到,可能是距离不够。");
      return;
    }
    seatCursor = id;
    opts.sfx("tap");
    confirm();
  }

  function confirm(): void {
    if (paused || state.over) return;
    if (mode === "discard") {
      if (!request || request.kind !== "discard") return;
      if (discardPicked.length < request.count) {
        say(`还要再放下 ${request.count - discardPicked.length} 张。`);
        return;
      }
      const cards = [...discardPicked];
      discardPicked = [];
      request = null;
      mode = "busy";
      opts.sfx("tap");
      pump({ cards });
      return;
    }
    if (mode === "respond") {
      const list = request ? playableForRequest(state, request) : [];
      const card = list[0];
      if (card) onCardClick(card);
      else declineRespond();
      return;
    }
    if (!selected || state.turn !== HUMAN) return;
    const card = selected;
    let targets: number[] = [];
    if (isGroupTrick(card.kind)) targets = [];
    else if (mode === "target") targets = [seatCursor];

    // 春风借力要再选一个「被打的人」
    if (card.kind === "borrow" && targets.length === 1) {
      const victims = borrowVictims(state, targets[0], HUMAN);
      if (victims.length === 0) {
        say("他手上没有能借的武器,换一张牌吧。");
        return;
      }
      targets = [targets[0], victims[0]];
    }

    if (!canPlay(state, HUMAN, card, targets)) {
      // 打不出去就试试花主的赠花
      const friend = aliveIds(state).find((id) => id !== HUMAN);
      if (giftLeft(state, HUMAN) > 0 && typeof friend === "number" && giftCard(state, HUMAN, friend, card)) {
        opts.sfx("coin");
        selected = null;
        mode = "idle";
        render();
        return;
      }
      say("这一步走不通,换一张牌或者换个人。");
      return;
    }
    selected = null;
    pendingTargets = [];
    mode = "busy";
    opts.sfx("pop");
    // 出什么牌就是什么演出:装备缩进座位,延时锦囊转圈贴头顶,攻击再补一道剑光
    const toKind = card.gear ? "gear" : card.kind === "playful" ? "delay" : "discard";
    flyCard(card, HUMAN, toKind, targets[0] ?? HUMAN);
    if (card.kind === "slash" || card.kind === "duel") streakFx(HUMAN, targets[0] ?? HUMAN);
    countPlay(card);
    const before = snapshotVigor();
    startFlow(playCard(state, HUMAN, card, targets) as Flow<unknown>, () => {
      showVigorFx(before);
      if (checkEnd()) return;
      mode = "idle";
      say("还能接着出牌,或者结束回合。");
      render();
    });
  }

  function declineRespond(): void {
    if (mode !== "respond") return;
    request = null;
    mode = "busy";
    const before = snapshotVigor();
    opts.sfx("tap");
    pump({ card: null });
    showVigorFx(before);
  }

  function cancel(): void {
    if (paused || state.over) return;
    if (mode === "respond") {
      declineRespond();
      return;
    }
    if (mode === "discard") {
      discardPicked = [];
      render();
      return;
    }
    selected = null;
    pendingTargets = [];
    mode = "idle";
    say("取消了,重新挑一张吧。");
    render();
  }

  // ---- 键盘 ----
  const onKey = (e: KeyboardEvent): void => {
    if (destroyed) return;
    const act = keyAction(e.key);
    if (!act) return;
    if (act === "pause") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;
    e.preventDefault();
    const me = state.players[HUMAN];
    if (act === "left" || act === "right") {
      if (me.hand.length === 0) return;
      handCursor = (handCursor + (act === "right" ? 1 : -1) + me.hand.length) % me.hand.length;
      opts.sfx("tap");
      render();
      return;
    }
    if (act === "up" || act === "down") {
      if (mode !== "target" || pendingTargets.length === 0) return;
      const at = Math.max(0, pendingTargets.indexOf(seatCursor));
      seatCursor = pendingTargets[(at + (act === "down" ? 1 : -1) + pendingTargets.length) % pendingTargets.length];
      opts.sfx("tap");
      render();
      return;
    }
    if (act === "confirm") {
      if (mode === "idle" && !selected) {
        const card = me.hand[handCursor];
        if (card) onCardClick(card);
        return;
      }
      if (mode === "respond" || mode === "discard") {
        const card = me.hand[handCursor];
        if (card && mode === "discard") {
          onCardClick(card);
          return;
        }
      }
      confirm();
      return;
    }
    if (act === "cancel") cancel();
  };
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey);

  let pauseEl: HTMLElement | null = null;
  function togglePause(): void {
    paused = !paused;
    if (paused) {
      pauseEl = document.createElement("div");
      pauseEl.className = "hc-pause";
      pauseEl.innerHTML = `<div class="hc-pause-t">⏸️ 先歇一会儿</div>
        <div class="hc-keys">点牌 → 点人 → 确定。<br>键盘:A / D 挑牌,W / S 换人,F 确定,G 取消。<br>方向键和 L / K 也是一样的。<br>再按一次 Esc 继续。</div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hc-open";
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

  okBtn.addEventListener("click", () => confirm());
  cancelBtn.addEventListener("click", () => cancel());
  endBtn.addEventListener("click", () => {
    if (state.turn !== HUMAN || state.over) return;
    opts.sfx("tap");
    mode = "busy";
    doEndTurn();
  });

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
      flow = null;
      afterFlow = null;
      void logShown;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  const table = createTable(stage, {
    seats: cfg.seats,
    seed: cfg.seed,
    tier: cfg.tier,
    recipe: cfg.recipe,
    factionLock: cfg.factionLock,
    openHand: 0,
    maxTurns: cfg.maxTurns,
    goalText: `${goalLine(cfg)}｜${cfg.hint}`,
    sfx: (n) => ctx.sfx(n),
    onOver: (r) => {
      if (!r.myWin) {
        ctx.lose(
          r.timeout
            ? "回合用完啦。换个出牌顺序,先把挡路的装备拆掉,一定来得及。"
            : "这一局没赢下来,再看一眼目标,换条路线试试!"
        );
        return;
      }
      ctx.win(starsFor(cfg, r.turns), `${r.turns} 个回合搞定,漂亮!`);
    }
  });
  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 身份场 1v4",
  endless: "♾️ 连胜无尽"
};

/** 开一桌五人身份场 */
export function randomSeats(seed: number): SeatSpec[] {
  let a = (seed >>> 0) || 1;
  const rand = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const roles = rollRoles(rand);
  const heroIds = rollHeroes(rand, roles);
  const names = ["朵朵", "星星", "糯糯", "云云", "闪闪"];
  return roles.map((role, i) => ({ name: names[i], heroId: heroIds[i], role }));
}

function mountExtra(host: HTMLElement, api: GameApi, kind: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "hc-mode";
  const style = document.createElement("style");
  style.textContent = HC_CSS;
  const head = document.createElement("div");
  head.className = "hc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "hc-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "hc-badge";
  chip.textContent = MODE_TITLE[kind];
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

  function over(title: string, sub: string, again: string, r?: TableResult): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "hc-over";
    // 胜者英杰大头像 + 本局出牌统计(攻/防/愈图标条)
    const face = r?.winnerHero
      ? `<div class="hc-over-face" aria-hidden="true">${heroPortrait(r.winnerHero)}</div>`
      : "";
    const stat = r
      ? `<div class="hc-statbar"><span class="hc-stat">${statIconSVG("attack")}攻 ×${r.stats.attack}</span>` +
        `<span class="hc-stat">${statIconSVG("guard")}防 ×${r.stats.guard}</span>` +
        `<span class="hc-stat">${statIconSVG("heal")}愈 ×${r.stats.heal}</span></div>`
      : "";
    box.innerHTML = `${face}<div class="hc-over-t">${title}</div><div class="hc-over-s">${sub}</div>${stat}`;
    // 赢了撒彩带:复用花瓣粒子通道,弱动效下一片都不撒
    if (r?.myWin && !reducedMotion()) {
      for (let i = 0; i < 10; i++) {
        const bit = document.createElement("div");
        bit.className = "hc-petal";
        bit.innerHTML = petalBitSVG(i % 2 === 0 ? "petal" : "spark");
        bit.style.left = `${8 + i * 9}%`;
        bit.style.top = "4%";
        bit.style.setProperty("--dx", `${(i - 5) * 10}px`);
        bit.style.animation = `hcpetal ${PETAL_MS + i * 60}ms ease-out forwards`;
        box.appendChild(bit);
      }
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hc-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function start(): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    if (kind === "versus") {
      const row = document.createElement("div");
      row.className = "hc-optbar";
      (["rookie", "normal", "pro", "hell"] as AiTier[]).forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "hc-open";
        b.textContent = AI_TIER_LABELS[t];
        b.addEventListener("click", () => {
          api.play("tap");
          tier = t;
          runVersus();
        });
        row.appendChild(b);
      });
      const tip = document.createElement("div");
      tip.className = "hc-msg";
      tip.textContent = "五个人一桌:一位花主亮在明处,两位夺花、一位护花、一位藏花全扣着。挑个对手档位开局。";
      stage.append(row, tip);
      return;
    }
    streak = 0;
    runEndless();
  }

  function runVersus(): void {
    stage.innerHTML = "";
    const seed = Math.floor(Math.random() * 1e9);
    chip.textContent = `🤝 对手:${AI_TIER_LABELS[tier]}`;
    table = createTable(stage, {
      seats: randomSeats(seed),
      seed,
      tier,
      goalText: `${AI_TIER_TIPS[tier]}`,
      sfx: (n) => api.play(n),
      onOver: (r) => {
        if (r.myWin) api.addStars(2);
        api.play(r.myWin ? "win" : "oops");
        over(
          r.myWin ? "这一局赢下来啦!" : "这一局到此为止",
          outcomeLine(r.winner, campOf(table?.state().players[HUMAN].role ?? "lord")),
          "🔁 再来一局",
          r
        );
      }
    });
  }

  function runEndless(): void {
    stage.innerHTML = "";
    const seed = Math.floor(Math.random() * 1e9);
    const t = endlessTier(streak);
    chip.textContent = `♾️ 连胜 ${streak} · 最高 ${best} · 对手 ${AI_TIER_LABELS[t]}`;
    table = createTable(stage, {
      seats: randomSeats(seed),
      seed,
      tier: t,
      openHand: endlessOpenHand(streak),
      goalText: `连胜 ${streak} 场。赢一局对手就更硬一点,输一次从头再来。`,
      sfx: (n) => api.play(n),
      onOver: (r) => {
        if (r.myWin) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.play("win");
          over(`连胜 ${streak} 场!`, `最高连胜 ${best}。下一桌的对手会更难缠。`, "▶ 下一桌", r);
        } else {
          api.play("oops");
          over(
            "连胜到这里啦",
            `这一轮连胜 ${streak} 场,最高纪录还是 ${best}。歇一会儿,下一局重新开。`,
            "🔁 重新开始",
            r
          );
          streak = 0;
        }
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
  { key: "endless", kind: "endless" }
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
  style.textContent = HC_CSS;
  const bar = document.createElement("div");
  bar.className = "hc-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "hc-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let extra: { destroy: () => void } | null = null;

  function closeExtra(): void {
    extra?.destroy();
    extra = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hc-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (extra) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      extra = mountExtra(modeHost, api, m, closeExtra);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "先看清这一关要请谁下桌,再算距离。够不着就先挂武器、先拆坐骑。",
      grandMessage: "188 关残局全部拿下,这张英杰令就归你了!",
      guide
    }
  );

  return {
    destroy() {
      extra?.destroy();
      extra = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const HC_CONSTS = { FLY_MS, BEAT_MS, PETAL_MS, REVEAL_MS, HUMAN };

/** 关卡体检:测试直接用 */
export { solveLevel, levelConfig, buildLevel };
