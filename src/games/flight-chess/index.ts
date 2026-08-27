import { meta } from "./meta";
export { meta };

// 飞行棋乐园:四色纸飞机绕 52 格环线，本色格跳 4 格、虚线航线飞 12 格、
// 叠机堡垒挡路、终点通道必须正好走到。188 关残局 + 四人对战 + 连胜无尽 + 朵朵星星双人，全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { prefersReducedMotion } from "../../engine/view25d";
import {
  BASE,
  COLORS,
  COLOR_INFO,
  GOAL,
  GRID,
  HOME_XY,
  PLANES_PER_COLOR,
  RING_LEN,
  RING_XY,
  baseRect,
  baseXY,
  cellXY,
  describePos,
  isAirline,
  isOwnColorCell,
  ringAt,
  ringColor,
  type Color,
  type XY
} from "./board";
import {
  CLASSIC_RULES,
  DICE_FACES,
  SIX_STREAK_LIMIT,
  extraRoll,
  roll,
  spinFrames,
  takeOffGrantsExtra,
  type Rules
} from "./dice";
import {
  allHome,
  applyMove,
  createState,
  currentColor,
  homeCount,
  landingLine,
  legalMoves,
  place,
  rankOf,
  resolveLanding,
  resolveTakeOff,
  winnerOf,
  type FlightState,
  type Landing,
  type Move
} from "./rules";
import { AI_TIER_LABELS, chooseMove, type AiTier } from "./ai";
import {
  CHAPTERS,
  achievementOf,
  duoConfig,
  endlessConfig,
  goalLine,
  levelConfig,
  rulesLine,
  starsFor,
  versusConfig
} from "./levels";
import guide from "./guide";

/** 走一格的时长:一格一格地跳，绝不瞬移 */
export const HOP_MS = 150;
/** 跳格与航线飞的一段弧线时长 */
export const ARC_MS = 420;
/** 每一条播报之间的停顿 */
export const BEAT_MS = 320;
/** 骰子每转一帧的时长 */
export const SPIN_MS = 70;

const CELL = 100 / GRID;

/** 样式表也要能被测试盯住:字号下限与手指热区都写在这里 */
export const CSS = `
.fc-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#EAF6FF,#FFF2F7);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.fc-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:6px;}
.fc-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#2f6b96;
  box-shadow:0 2px 6px rgba(120,170,210,.3);line-height:1.5;overflow-wrap:anywhere;}
.fc-seats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
.fc-seat{flex:1 1 96px;min-width:0;background:#fff;border-radius:12px;padding:5px 8px;font-size:16px;font-weight:800;
  color:#4a5a70;box-shadow:0 2px 6px rgba(120,160,200,.25);line-height:1.5;overflow-wrap:anywhere;}
.fc-seat-on{outline:3px solid #59A9DC;}
.fc-seat-tier{font-size:16px;font-weight:700;color:#7d8ba0;}
.fc-boardwrap{position:relative;width:100%;max-width:440px;margin:0 auto;}
.fc-board{position:relative;width:100%;aspect-ratio:1;background:#F4FAFF;border-radius:14px;overflow:hidden;
  box-shadow:inset 0 0 0 2px #DCEBF6;}
.fc-base{position:absolute;border-radius:12px;}
.fc-cell{position:absolute;box-sizing:border-box;border-radius:22%;background:#FFFFFF;
  box-shadow:inset 0 0 0 1px rgba(120,160,200,.28);}
.fc-cell-own{box-shadow:inset 0 0 0 1px rgba(255,255,255,.9);}
.fc-cell-start{box-shadow:inset 0 0 0 2px #6FB3E0;}
.fc-cell-air::after{content:"";position:absolute;inset:26%;border-radius:50%;background:rgba(255,255,255,.75);}
.fc-cell-home{border-radius:26%;}
.fc-pad{position:absolute;border-radius:50%;background:#FFF8DC;box-shadow:inset 0 0 0 2px #F3D98B;
  display:flex;align-items:center;justify-content:center;font-size:var(--mt-control,14px);}
.fc-line{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.fc-token{position:absolute;display:flex;align-items:center;justify-content:center;border:none;padding:0;margin:0;
  background:transparent;font-family:inherit;line-height:1;cursor:pointer;z-index:5;
  transition:left ${HOP_MS}ms linear,top ${HOP_MS}ms linear;}
.fc-token-face{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;
  font-size:clamp(13px,2.6vw,17px);box-shadow:0 2px 4px rgba(80,120,160,.35);}
.fc-token-pick{outline:3px solid #2E80BC;outline-offset:1px;border-radius:50%;animation:fcpulse 1.2s ease infinite;}
.fc-token-can .fc-token-face{box-shadow:0 0 0 3px rgba(255,255,255,.95),0 3px 6px rgba(80,120,160,.4);}
/* 360px 屏上一格才 24px 见方，给能点的飞机垫一圈看不见的手指热区 */
.fc-token-can::before{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;
  transform:translate(-50%,-50%);border-radius:50%;}
.fc-token:disabled{pointer-events:none;}
.fc-token-arc{transition:left ${ARC_MS}ms cubic-bezier(.3,-0.4,.5,1.4),top ${ARC_MS}ms cubic-bezier(.3,1.4,.6,1);}
.fc-token-stack::after{content:"";position:absolute;right:-2px;bottom:-2px;width:38%;height:38%;border-radius:50%;
  background:#fff;box-shadow:0 1px 3px rgba(80,120,160,.5);}
@keyframes fcpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.fc-hud{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;margin:8px 0 6px;}
.fc-dice{min-width:56px;min-height:56px;border-radius:16px;background:#fff;box-shadow:0 3px 8px rgba(120,160,200,.35);
  display:flex;align-items:center;justify-content:center;font-size:34px;line-height:1;color:#2f6b96;}
.fc-dice-spin{animation:fcroll .32s linear infinite;}
@keyframes fcroll{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.fc-btn{min-width:96px;min-height:48px;border:none;border-radius:16px;font-family:inherit;font-size:16px;font-weight:900;
  cursor:pointer;background:#BFE3FA;color:#1F5C87;box-shadow:0 3px 0 #8CC4E8;padding:0 14px;}
.fc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #8CC4E8;}
.fc-btn:disabled{opacity:.45;cursor:default;}
.fc-btn-go{background:#FFC7DC;color:#8E2B54;box-shadow:0 3px 0 #EFA1C0;}
.fc-btn-go:active{box-shadow:0 1px 0 #EFA1C0;}
.fc-btn-sm{min-width:64px;min-height:44px;font-size:14px;padding:0 10px;}
.fc-picker{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:4px 0;}
.fc-pick{min-width:66px;min-height:44px;border:none;border-radius:14px;font-family:inherit;font-size:14px;font-weight:800;
  cursor:pointer;background:#fff;color:#37627f;box-shadow:0 2px 6px rgba(120,160,200,.3);padding:0 8px;line-height:1.3;}
.fc-pick-on{outline:3px solid #2E80BC;}
.fc-pick:disabled{opacity:.4;cursor:default;}
.fc-msg{text-align:center;min-height:2.8em;color:#3a5a72;font-weight:800;margin-top:6px;font-size:16px;
  line-height:1.5;overflow-wrap:anywhere;}
.fc-goal{text-align:center;font-size:16px;font-weight:800;color:#2f6b96;line-height:1.5;margin-bottom:6px;
  overflow-wrap:anywhere;}
.fc-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.fc-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#3a5a72;text-align:center;overflow-wrap:anywhere;}
.fc-open{border:none;border-radius:999px;padding:10px 18px;min-height:44px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#63AEDE,#3F8ABE);box-shadow:0 4px 0 #2F6D9B;}
.fc-open:active{transform:translateY(2px);box-shadow:0 2px 0 #2F6D9B;}
.fc-mode{max-width:520px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.fc-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.fc-back{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#2F6D9B;box-shadow:0 3px 0 rgba(90,140,180,.35);}
.fc-over{text-align:center;padding:20px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(120,160,200,.3);}
.fc-over-t{font-size:20px;font-weight:900;color:#2f6b96;margin-bottom:8px;}
.fc-over-s{font-size:16px;font-weight:700;color:#5b6f80;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
.fc-pause{position:absolute;inset:0;background:rgba(240,250,255,.96);border-radius:16px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;}
.fc-pause-t{font-size:19px;font-weight:900;color:#2f6b96;}
.fc-keys{font-size:16px;font-weight:700;color:#5b7386;line-height:1.6;text-align:center;margin-top:6px;
  overflow-wrap:anywhere;}
.fc-btn:focus-visible,.fc-pick:focus-visible,.fc-token:focus-visible,.fc-open:focus-visible,.fc-back:focus-visible{
  outline:3px solid #123f5e;outline-offset:2px;}
@media (max-width:380px){
  .fc-wrap{padding:6px;}
  .fc-seat{flex:1 1 45%;padding:4px 6px;}
  .fc-btn{min-width:84px;font-size:15px;padding:0 10px;}
  .fc-dice{min-width:48px;min-height:48px;font-size:28px;}
}
@media (prefers-reduced-motion:reduce){
  .fc-token,.fc-token-arc{transition:none;}
  .fc-token-pick{animation:none;}
  .fc-dice-spin{animation:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 纯函数:界面文案与几何                                                */
/* ------------------------------------------------------------------ */

/** 网格坐标 → 百分比位置（棋盘是正方形，360px 也能整屏塞下） */
export function pctOf(cell: XY): { left: number; top: number } {
  return { left: (cell.x + 0.5) * CELL, top: (cell.y + 0.5) * CELL };
}

/** 一架飞机现在画在哪:基地里用停机位，路上用行程 */
export function tokenXY(color: Color, p: number, slot: number): XY {
  return p === BASE ? baseXY(color, slot) : cellXY(color, p);
}

/** 骰子面 */
export function diceFace(n: number): string {
  return n >= 1 && n <= 6 ? DICE_FACES[n] : "🎲";
}

/** 提示这一手能干什么（无障碍标签与提示条共用） */
export function movePreview(s: FlightState, move: Move, dice: number): string {
  const res = move.kind === "takeOff" ? resolveTakeOff(s, move.plane) : resolveLanding(s, move.plane, dice);
  const who = COLOR_INFO[move.plane.color].name;
  const no = move.plane.idx + 1;
  if (move.kind === "takeOff") return `${who}第 ${no} 架:起飞到起飞格`;
  const bits: string[] = [`${who}第 ${no} 架:走 ${dice} 步`];
  if (res.flew) bits.push("接航线飞到对面");
  else if (res.jumped) bits.push("踩本色格再跳 4 格");
  if (res.blocked) bits.push("会被叠机堡垒挡回来");
  else if (res.bounced) bits.push("会在通道里折返");
  if (res.selfBack) bits.push("撞上堡垒会一起回基地");
  else if (res.captured.length > 0) bits.push(`撞回对方 ${res.captured.length} 架`);
  if (res.arrived) bits.push("正好到终点");
  return bits.join("，");
}

/** 结算面板的一句话（只鼓励，不批评） */
export function overLine(win: boolean, homeGot: number): string {
  if (win) return `4 架全部到齐，这一局稳稳拿下！`;
  if (homeGot >= 2) return `已经送到家 ${homeGot} 架，差一点点就到齐啦，下一局先叠个堡垒。`;
  return "差一点点就到齐啦，下一局先叠个堡垒，把对手挡在门口。";
}

/* ------------------------------------------------------------------ */
/* 牌桌                                                                */
/* ------------------------------------------------------------------ */

export interface TableSeat {
  color: Color;
  /** 人类玩家:duo = 朵朵键位，star = 星星键位;null 表示电脑 */
  human: "duo" | "star" | null;
  tier: AiTier;
  /**
   * 只摆在棋盘上、不轮到它走。
   * 残局关里对手正在补给，这一关不动，但它们照样能被撞、照样能叠成堡垒挡路。
   */
  idle?: boolean;
}

export interface OverResult {
  winner: Color | null;
  ranks: Color[];
  rolls: number;
  state: FlightState;
  reason: "win" | "rounds" | "dice" | "goal";
  humanWon: boolean;
}

export interface TableOptions {
  seats: TableSeat[];
  rules: Rules;
  setup?: number[][];
  /** 固定骰序（闯关用）；不给就按种子现掷 */
  dice?: number[];
  seed: number;
  goalText: string;
  rounds?: number;
  sfx: (n: SoundName) => void;
  onOver: (r: OverResult) => void;
  /** 每一手之后判一次输赢（闯关目标） */
  judge?: (s: FlightState, rolls: number) => "win" | "lose" | null;
  hudNote?: string;
}

type Phase = "idle" | "rolling" | "choosing" | "moving" | "over";

export function createTable(host: HTMLElement, opts: TableOptions): { destroy: () => void } {
  const seatOf = new Map<Color, TableSeat>();
  for (const seat of opts.seats) seatOf.set(seat.color, seat);
  const order = opts.seats.map((s) => s.color);
  const state = createState(order, opts.rules);
  if (opts.setup) {
    for (let c = 0; c < 4; c++) place(state, c as Color, opts.setup[c] ?? []);
  }

  const reduced = prefersReducedMotion();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let phase: Phase = "idle";
  let rolls = 0;
  let dice = 0;
  let picked = 0;
  let moves: Move[] = [];
  let message = "按「掷骰子」开始这一局。";
  /** 画面上的位置(可能落后于真实局面，用来做一格一格的动画) */
  const visual = new Map<string, number>();

  function after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  function key(color: Color, idx: number): string {
    return `${color}-${idx}`;
  }

  for (const c of order) {
    for (let i = 0; i < PLANES_PER_COLOR; i++) visual.set(key(c, i), state.planes[c][i]);
  }

  /* --------------------------- DOM --------------------------- */
  const wrap = document.createElement("div");
  wrap.className = "fc-wrap";

  const top = document.createElement("div");
  top.className = "fc-top";
  const badge = document.createElement("div");
  badge.className = "fc-badge";
  const badge2 = document.createElement("div");
  badge2.className = "fc-badge";
  top.append(badge, badge2);

  const goalBar = document.createElement("div");
  goalBar.className = "fc-goal";
  goalBar.textContent = opts.goalText;

  const seatRow = document.createElement("div");
  seatRow.className = "fc-seats";
  const seatEls = new Map<Color, HTMLElement>();
  for (const seat of opts.seats) {
    const el = document.createElement("div");
    el.className = "fc-seat";
    el.style.background = COLOR_INFO[seat.color].soft;
    seatRow.appendChild(el);
    seatEls.set(seat.color, el);
  }

  const boardWrap = document.createElement("div");
  boardWrap.className = "fc-boardwrap";
  const board = document.createElement("div");
  board.className = "fc-board";
  boardWrap.appendChild(board);

  // 四角基地
  for (const c of COLORS) {
    const rect = baseRect(c);
    const el = document.createElement("div");
    el.className = "fc-base";
    el.style.left = `${rect.x * CELL}%`;
    el.style.top = `${rect.y * CELL}%`;
    el.style.width = `${rect.w * CELL}%`;
    el.style.height = `${rect.h * CELL}%`;
    el.style.background = COLOR_INFO[c].soft;
    board.appendChild(el);
  }

  // 环线 52 格
  RING_XY.forEach((cell, ring) => {
    const el = document.createElement("div");
    const owner = ringColor(ring);
    const isStart = ring % 13 === 0;
    el.className = `fc-cell fc-cell-own${isStart ? " fc-cell-start" : ""}`;
    el.style.left = `${cell.x * CELL}%`;
    el.style.top = `${cell.y * CELL}%`;
    el.style.width = `${CELL}%`;
    el.style.height = `${CELL}%`;
    el.style.background = COLOR_INFO[owner].soft;
    const progress = (ring - owner * 13 + RING_LEN) % RING_LEN;
    if (isAirline(progress)) el.classList.add("fc-cell-air");
    board.appendChild(el);
  });

  // 四条终点通道
  for (const c of COLORS) {
    HOME_XY[c].forEach((cell, i) => {
      const el = document.createElement("div");
      el.className = "fc-cell fc-cell-home";
      el.style.left = `${cell.x * CELL}%`;
      el.style.top = `${cell.y * CELL}%`;
      el.style.width = `${CELL}%`;
      el.style.height = `${CELL}%`;
      el.style.background = COLOR_INFO[c].soft;
      el.style.opacity = String(0.55 + i * 0.09);
      board.appendChild(el);
    });
  }

  // 中央彩虹停机坪
  const pad = document.createElement("div");
  pad.className = "fc-pad";
  pad.style.left = `${6 * CELL}%`;
  pad.style.top = `${6 * CELL}%`;
  pad.style.width = `${3 * CELL}%`;
  pad.style.height = `${3 * CELL}%`;
  pad.textContent = "🌈";
  board.appendChild(pad);

  // 四条虚线航线
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "fc-line");
  svg.setAttribute("viewBox", `0 0 ${GRID} ${GRID}`);
  for (const c of COLORS) {
    const from = cellXY(c, 16);
    const to = cellXY(c, 28);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", String(from.x + 0.5));
    line.setAttribute("y1", String(from.y + 0.5));
    line.setAttribute("x2", String(to.x + 0.5));
    line.setAttribute("y2", String(to.y + 0.5));
    line.setAttribute("stroke", COLOR_INFO[c].ink);
    line.setAttribute("stroke-width", "0.18");
    line.setAttribute("stroke-dasharray", "0.5 0.45");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.75");
    svg.appendChild(line);
  }
  board.appendChild(svg);

  // 棋子
  const tokens = new Map<string, HTMLButtonElement>();
  for (const c of order) {
    for (let i = 0; i < PLANES_PER_COLOR; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fc-token";
      btn.style.width = `${CELL}%`;
      btn.style.height = `${CELL}%`;
      const face = document.createElement("span");
      face.className = "fc-token-face";
      face.textContent = COLOR_INFO[c].token;
      face.style.background = COLOR_INFO[c].soft;
      btn.appendChild(face);
      btn.addEventListener("click", () => onTokenTap(c, i));
      board.appendChild(btn);
      tokens.set(key(c, i), btn);
    }
  }

  const hud = document.createElement("div");
  hud.className = "fc-hud";
  const diceBox = document.createElement("div");
  diceBox.className = "fc-dice";
  diceBox.textContent = "🎲";
  diceBox.setAttribute("role", "status");
  const rollBtn = document.createElement("button");
  rollBtn.type = "button";
  rollBtn.className = "fc-btn fc-btn-go";
  rollBtn.textContent = "🎲 掷骰子";
  rollBtn.addEventListener("click", () => doRoll());
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "fc-btn fc-btn-sm";
  pauseBtn.textContent = "⏸ 暂停";
  pauseBtn.addEventListener("click", () => togglePause());
  hud.append(diceBox, rollBtn, pauseBtn);

  const picker = document.createElement("div");
  picker.className = "fc-picker";
  const pickBtns: HTMLButtonElement[] = [];
  for (let i = 0; i < PLANES_PER_COLOR; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fc-pick";
    btn.textContent = `第 ${i + 1} 架`;
    btn.addEventListener("click", () => {
      const color = currentColor(state);
      onTokenTap(color, i);
    });
    picker.appendChild(btn);
    pickBtns.push(btn);
  }

  const msg = document.createElement("div");
  msg.className = "fc-msg";
  const keys = document.createElement("div");
  keys.className = "fc-keys";
  keys.textContent = "键盘:F 掷骰 / G 换飞机 / WASD 选棋 · 星星 方向键 + L / K · Esc 暂停";

  wrap.append(top, goalBar, seatRow, boardWrap, hud, picker, msg, keys);
  host.appendChild(wrap);

  /* --------------------------- 渲染 --------------------------- */

  function humanTurn(): boolean {
    const seat = seatOf.get(currentColor(state));
    return Boolean(seat && seat.human);
  }

  /** 电脑自己走的时候节奏收紧一半:人在旁边看，不用陪它「思考」 */
  function beat(ms: number): number {
    return humanTurn() ? ms : Math.round(ms * 0.5);
  }

  function stackedAt(color: Color, p: number): boolean {
    if (p < 0 || p >= RING_LEN) return false;
    let n = 0;
    for (let i = 0; i < PLANES_PER_COLOR; i++) if (state.planes[color][i] === p) n++;
    return n >= 2;
  }

  function render(): void {
    const cur = currentColor(state);
    badge.textContent = `${COLOR_INFO[cur].token} 轮到 ${COLOR_INFO[cur].name}`;
    badge2.textContent = opts.hudNote ?? `第 ${state.round + 1} 回合 · 已掷 ${rolls} 次`;

    for (const seat of opts.seats) {
      const el = seatEls.get(seat.color);
      if (!el) continue;
      const who = COLOR_INFO[seat.color];
      const label = seat.human
        ? seat.human === "duo"
          ? "你（朵朵键位）"
          : "你（星星键位）"
        : seat.idle
          ? "这一关在补给，不动"
          : AI_TIER_LABELS[seat.tier];
      el.className = `fc-seat${seat.color === cur ? " fc-seat-on" : ""}`;
      el.innerHTML = `<div>${who.token} ${who.name}</div><div class="fc-seat-tier">${label} · 到家 ${homeCount(
        state,
        seat.color
      )}/4</div>`;
    }

    for (const c of order) {
      for (let i = 0; i < PLANES_PER_COLOR; i++) {
        const btn = tokens.get(key(c, i));
        if (!btn) continue;
        const p = visual.get(key(c, i)) ?? BASE;
        const pos = pctOf(tokenXY(c, p, i));
        btn.style.left = `${pos.left - CELL / 2}%`;
        btn.style.top = `${pos.top - CELL / 2}%`;
        const movable =
          phase === "choosing" && c === cur && moves.some((m) => m.plane.idx === i && m.plane.color === c);
        btn.classList.toggle("fc-token-can", movable);
        btn.classList.toggle("fc-token-pick", movable && moves[picked]?.plane.idx === i);
        btn.classList.toggle("fc-token-stack", stackedAt(c, state.planes[c][i]));
        btn.style.zIndex = String(movable ? 8 : p === GOAL ? 7 : 5);
        btn.setAttribute("aria-label", describePos(c, state.planes[c][i]));
        btn.disabled = !movable;
      }
    }

    pickBtns.forEach((btn, i) => {
      const m = moves.find((x) => x.plane.idx === i);
      const on = phase === "choosing" && Boolean(m);
      btn.disabled = !on;
      btn.classList.toggle("fc-pick-on", on && moves[picked]?.plane.idx === i);
      btn.textContent = on ? `第 ${i + 1} 架 ▶` : `第 ${i + 1} 架`;
    });

    rollBtn.disabled = phase !== "idle" || !humanTurn();
    msg.textContent = message;
  }

  function say(line: string): void {
    message = line;
    msg.textContent = line;
  }

  /* --------------------------- 掷骰 --------------------------- */

  function nextDice(): number {
    const fixed = opts.dice;
    const i = rolls;
    rolls++;
    if (fixed && fixed.length > 0) return fixed[Math.min(i, fixed.length - 1)];
    return roll(opts.seed, i);
  }

  function outOfDice(): boolean {
    return Boolean(opts.dice && opts.dice.length > 0 && rolls >= opts.dice.length);
  }

  function doRoll(): void {
    if (phase !== "idle" || destroyed) return;
    if (paused) return;
    phase = "rolling";
    render();
    opts.sfx("tap");
    const value = nextDice();
    // 电脑的骰子也要转，只是少转几圈——绝不直接跳出数字
    const frames = spinFrames(opts.seed, rolls, reduced || !humanTurn());
    let f = 0;
    diceBox.classList.add("fc-dice-spin");
    const tick = (): void => {
      if (f < frames.length - 1) {
        diceBox.textContent = diceFace(frames[f]);
        f++;
        after(SPIN_MS, tick);
        return;
      }
      diceBox.classList.remove("fc-dice-spin");
      diceBox.textContent = diceFace(value);
      settleRoll(value);
    };
    tick();
  }

  function settleRoll(value: number): void {
    const color = currentColor(state);
    const streak = extraRoll(value, state.streak, state.rules);
    if (streak.cancel) {
      state.streak = 0;
      opts.sfx("oops");
      say(`连着 ${SIX_STREAK_LIMIT} 个 6，这一手作废，换下一位。`);
      after(beat(BEAT_MS * 2), () => endTurn(false));
      return;
    }
    state.streak = streak.streak;
    moves = legalMoves(state, value);
    dice = value;
    picked = 0;
    if (moves.length === 0) {
      say(`掷到 ${value}，这一手没有能动的飞机，先过。`);
      after(beat(BEAT_MS * 2), () => endTurn(streak.again));
      return;
    }
    const seat = seatOf.get(color);
    if (!seat || !seat.human) {
      phase = "choosing";
      render();
      const pick = chooseMove(state, value, seat?.tier ?? "normal") ?? moves[0];
      say(`${COLOR_INFO[color].name} 掷到 ${value}。`);
      after(beat(BEAT_MS), () => runMove(pick, streak.again));
      return;
    }
    if (moves.length === 1) {
      phase = "choosing";
      render();
      say(`掷到 ${value}。${movePreview(state, moves[0], value)}`);
      after(beat(BEAT_MS), () => runMove(moves[0], streak.again));
      return;
    }
    phase = "choosing";
    say(`掷到 ${value}，挑一架:${movePreview(state, moves[picked], value)}`);
    render();
  }

  function cyclePick(step: number): void {
    if (phase !== "choosing" || moves.length === 0) return;
    picked = (picked + step + moves.length) % moves.length;
    opts.sfx("tap");
    say(`掷到 ${dice}，挑一架:${movePreview(state, moves[picked], dice)}`);
    render();
  }

  function confirmPick(): void {
    if (phase !== "choosing" || moves.length === 0) return;
    const again = dice === 6 && state.rules.extraOnSix;
    runMove(moves[picked], again);
  }

  function onTokenTap(color: Color, idx: number): void {
    if (phase !== "choosing" || paused) return;
    if (color !== currentColor(state)) return;
    const seat = seatOf.get(color);
    if (!seat || !seat.human) return;
    const at = moves.findIndex((m) => m.plane.idx === idx);
    if (at < 0) return;
    picked = at;
    render();
    const again = dice === 6 && state.rules.extraOnSix;
    runMove(moves[at], again);
  }

  /* --------------------------- 走子 --------------------------- */

  function runMove(move: Move | undefined, again: boolean): void {
    // 只有「正在挑飞机」这一刻才走得动:排在定时器里的自动走子，
    // 要是玩家抢先自己点了一架，回来时这一手已经翻篇，直接作废。
    if (destroyed || !move || phase !== "choosing") return;
    phase = "moving";
    const res: Landing =
      move.kind === "takeOff" ? resolveTakeOff(state, move.plane) : resolveLanding(state, move.plane, dice);
    const hops = res.hops.length > 0 ? res.hops : [res.to];
    applyMove(state, move, dice);
    say(landingLine(move.plane, res));
    render();
    animate(move, res, hops, () => {
      if (res.captured.length > 0) opts.sfx("pop");
      else if (res.flew || res.jumped) opts.sfx("jump");
      else opts.sfx("tap");
      if (res.arrived) opts.sfx("coin");
      const judged = opts.judge ? opts.judge(state, rolls) : null;
      if (judged === "win") return finish("goal", true);
      if (judged === "lose") return finish("goal", false);
      const champ = winnerOf(state);
      if (champ !== null) return finish("win", true);
      if (outOfDice()) return finish("dice", false);
      const extra = move.kind === "takeOff" ? takeOffGrantsExtra(dice, state.rules) : again;
      after(beat(BEAT_MS), () => endTurn(extra));
    });
  }

  function animate(move: Move, res: Landing, hops: number[], done: () => void): void {
    const tokenKey = key(move.plane.color, move.plane.idx);
    const btn = tokens.get(tokenKey);
    let i = 0;
    const stepOnce = (): void => {
      if (destroyed) return;
      if (i >= hops.length) {
        btn?.classList.remove("fc-token-arc");
        flyBackCaptured(move, res, done);
        return;
      }
      const prev = i === 0 ? res.from : hops[i - 1];
      const target = hops[i];
      const leap = Math.abs(target - prev) > 1;
      if (btn) btn.classList.toggle("fc-token-arc", leap && !reduced);
      visual.set(tokenKey, target);
      render();
      i++;
      after(leap ? (reduced ? HOP_MS : ARC_MS) : reduced ? Math.max(40, HOP_MS / 2) : HOP_MS, stepOnce);
    };
    stepOnce();
  }

  function flyBackCaptured(move: Move, res: Landing, done: () => void): void {
    const back = [...res.captured];
    if (res.selfBack) back.push(move.plane);
    if (back.length === 0) {
      done();
      return;
    }
    // 绕回基地也走一段弧线，不许瞬间闪回去
    for (const foe of back) {
      tokens.get(key(foe.color, foe.idx))?.classList.add("fc-token-arc");
      visual.set(key(foe.color, foe.idx), BASE);
    }
    render();
    after(reduced ? 80 : ARC_MS, () => {
      for (const foe of back) tokens.get(key(foe.color, foe.idx))?.classList.remove("fc-token-arc");
      done();
    });
  }

  function endTurn(extra: boolean): void {
    if (destroyed || phase === "over") return;
    moves = [];
    if (!extra) {
      // 只摆着不走的座位直接跳过:残局关里对手正在补给，这一关轮不到它们
      for (let hop = 0; hop < state.seats.length; hop++) {
        state.turn = (state.turn + 1) % state.seats.length;
        if (state.turn === 0) state.round++;
        if (!seatOf.get(currentColor(state))?.idle) break;
      }
      state.streak = 0;
      if (opts.rounds && state.round >= opts.rounds) return finish("rounds", false);
    }
    if (outOfDice()) return finish("dice", false);
    phase = "idle";
    const seat = seatOf.get(currentColor(state));
    if (seat && seat.human) {
      say(extra ? "掷到 6，再来一次！" : `轮到 ${COLOR_INFO[seat.color].name}，按「掷骰子」。`);
      render();
    } else {
      say(`${COLOR_INFO[currentColor(state)].name} 正在想…`);
      render();
      after(beat(BEAT_MS), () => {
        if (phase === "idle") doRoll();
      });
    }
  }

  function finish(reason: OverResult["reason"], won: boolean): void {
    if (phase === "over") return;
    phase = "over";
    moves = [];
    render();
    const champ = winnerOf(state);
    const humanColors = opts.seats.filter((s) => s.human).map((s) => s.color);
    const humanWon = won && (champ === null || humanColors.includes(champ));
    opts.onOver({ winner: champ, ranks: rankOf(state), rolls, state, reason, humanWon });
  }

  /* --------------------------- 暂停与键盘 --------------------------- */

  let paused = false;
  let pauseEl: HTMLElement | null = null;

  function togglePause(): void {
    paused = !paused;
    if (paused) {
      const el = document.createElement("div");
      el.className = "fc-pause";
      el.innerHTML = `<div class="fc-pause-t">✈️ 先歇一会儿</div>
        <div class="fc-keys">F 掷骰 / G 换飞机 / WASD 选棋<br>星星:方向键 + L 掷骰 + K 换飞机<br>Esc 或点下面的按钮继续</div>`;
      const go = document.createElement("button");
      go.type = "button";
      go.className = "fc-btn fc-btn-go";
      go.textContent = "▶ 继续飞";
      go.addEventListener("click", () => togglePause());
      el.appendChild(go);
      wrap.appendChild(el);
      pauseEl = el;
    } else {
      pauseEl?.remove();
      pauseEl = null;
      if (phase === "idle" && !humanTurn()) after(beat(BEAT_MS), () => phase === "idle" && doRoll());
    }
    render();
  }

  function onKey(e: KeyboardEvent): void {
    if (destroyed) return;
    const k = e.key;
    if (k === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;
    const cur = currentColor(state);
    const seat = seatOf.get(cur);
    if (!seat || !seat.human) return;
    const duo = seat.human === "duo";
    const rollKey = duo ? ["f", "F"] : ["l", "L"];
    const swapKey = duo ? ["g", "G"] : ["k", "K"];
    const prevKey = duo ? ["a", "A", "w", "W"] : ["ArrowLeft", "ArrowUp"];
    const nextKey = duo ? ["d", "D", "s", "S"] : ["ArrowRight", "ArrowDown"];
    if (rollKey.includes(k)) {
      e.preventDefault();
      if (phase === "idle") doRoll();
      else if (phase === "choosing") confirmPick();
      return;
    }
    if (swapKey.includes(k) || nextKey.includes(k)) {
      e.preventDefault();
      cyclePick(1);
      return;
    }
    if (prevKey.includes(k)) {
      e.preventDefault();
      cyclePick(-1);
    }
  }

  window.addEventListener("keydown", onKey);

  render();
  if (!humanTurn()) after(beat(BEAT_MS * 2), () => phase === "idle" && doRoll());

  return {
    destroy() {
      destroyed = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      window.removeEventListener("keydown", onKey);
      pauseEl?.remove();
      wrap.remove();
    }
  };
}

/* ------------------------------------------------------------------ */
/* 闯关                                                                */
/* ------------------------------------------------------------------ */

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  const seats: TableSeat[] = cfg.seats.map((c) => ({
    color: c,
    human: c === cfg.player ? "duo" : null,
    tier: cfg.tiers[c] ?? "normal",
    // 单人残局关的对手只当障碍:参考解法也是按「对手不动」算出来的目标
    idle: !cfg.multi && c !== cfg.player
  }));
  let handle: { destroy: () => void } | null = null;

  handle = createTable(stage, {
    seats,
    rules: cfg.rules,
    setup: cfg.setup,
    dice: cfg.dice,
    seed: cfg.seed,
    rounds: cfg.multi ? cfg.rounds : undefined,
    goalText: `🎯 ${goalLine(cfg)}　·　${rulesLine(cfg)}`,
    hudNote: `参考步数 ${cfg.refRolls}`,
    sfx: ctx.sfx,
    judge: (s, rolls) => {
      if (achievementOf(s, cfg.goal.kind, cfg.player) >= cfg.goal.need) return "win";
      if (!cfg.multi && rolls >= cfg.dice.length) return "lose";
      if (cfg.multi && s.round >= cfg.rounds) return "lose";
      return null;
    },
    onOver: (r) => {
      const got = achievementOf(r.state, cfg.goal.kind, cfg.player);
      if (got >= cfg.goal.need) {
        ctx.win(starsFor(cfg, r.rolls), `目标达成:${got} / ${cfg.goal.need}，用了 ${r.rolls} 次掷骰。`);
      } else {
        ctx.lose(`已经做到 ${got} / ${cfg.goal.need} 啦，差一点点，下一次先想好每个点数给谁用。`);
      }
    }
  });

  return {
    destroy() {
      handle?.destroy();
      handle = null;
    }
  };
}

/* ------------------------------------------------------------------ */
/* 对战 / 无尽 / 双人                                                   */
/* ------------------------------------------------------------------ */

export type ExtraMode = "versus" | "endless" | "duo";

export const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 四人对战",
  endless: "♾️ 连胜无尽",
  duo: "👫 双人同屏"
};

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "fc-mode";
  const head = document.createElement("div");
  head.className = "fc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "fc-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("div");
  chip.className = "fc-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let table: { destroy: () => void } | null = null;
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;

  function showOver(title: string, sub: string, again: string): void {
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "fc-over";
    box.innerHTML = `<div class="fc-over-t">${title}</div><div class="fc-over-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fc-btn fc-btn-go";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function tierPicker(onPick: (t: AiTier) => void): void {
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "fc-over";
    box.innerHTML = `<div class="fc-over-t">选对手强度</div>
      <div class="fc-over-s">四个人同场，缺的位置由电脑补上。先挑一档试试手。</div>`;
    const row = document.createElement("div");
    row.className = "fc-picker";
    (["rookie", "normal", "pro", "hell"] as AiTier[]).forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fc-btn fc-btn-sm";
      btn.textContent = AI_TIER_LABELS[t];
      btn.addEventListener("click", () => {
        api.play("tap");
        onPick(t);
      });
      row.appendChild(btn);
    });
    box.appendChild(row);
    stage.appendChild(box);
  }

  function runVersus(pick: AiTier): void {
    stage.innerHTML = "";
    const cfg = versusConfig(pick);
    table?.destroy();
    table = createTable(stage, {
      seats: cfg.seats.map((c) => ({ color: c, human: c === 0 ? "duo" : null, tier: cfg.tiers[c] ?? "normal" })),
      rules: cfg.rules,
      seed: Math.floor(Math.random() * 1e9),
      rounds: 200,
      goalText: `🎯 把 4 架朵朵纸飞机全部送到终点　·　对手 ${AI_TIER_LABELS[pick]}`,
      sfx: (n) => api.play(n),
      onOver: (r) => {
        const mine = homeCount(r.state, 0);
        if (r.humanWon && allHome(r.state, 0)) api.addStars(2);
        showOver(
          allHome(r.state, 0) ? "朵朵这一局到齐啦！" : "这一局到此为止",
          `${overLine(allHome(r.state, 0), mine)} 名次:${r.ranks.map((c) => COLOR_INFO[c].name).join(" > ")}。`,
          "🔁 再来一局"
        );
      }
    });
  }

  function runEndless(): void {
    stage.innerHTML = "";
    const cfg = endlessConfig(streak);
    chip.textContent = `♾️ 连胜 ${streak} · 最高 ${best} · 对手 ${AI_TIER_LABELS[cfg.tier]}`;
    table?.destroy();
    table = createTable(stage, {
      seats: cfg.seats.map((c) => ({ color: c, human: c === 0 ? "duo" : null, tier: cfg.tiers[c] ?? "normal" })),
      rules: cfg.rules,
      seed: Math.floor(Math.random() * 1e9),
      rounds: 200,
      goalText: `🎯 连胜挑战:赢一局连胜 +1，输一局从头再来　·　对手 ${AI_TIER_LABELS[cfg.tier]}`,
      sfx: (n) => api.play(n),
      onOver: (r) => {
        if (allHome(r.state, 0)) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.play("win");
          showOver(`连胜 ${streak} 场！`, `最高连胜 ${best}。对手会越来越难缠，接着来一局吧。`, "▶ 下一局");
        } else {
          showOver(
            "连胜到这里啦",
            `这一轮连胜 ${streak} 场，最高纪录 ${best}。${overLine(false, homeCount(r.state, 0))}`,
            "🔁 重新开始"
          );
          streak = 0;
        }
      }
    });
  }

  function runDuo(): void {
    stage.innerHTML = "";
    const cfg = duoConfig();
    chip.textContent = "👫 朵朵 WASD+F/G · 星星 方向键+L/K";
    table?.destroy();
    table = createTable(stage, {
      seats: [
        { color: 0, human: "duo", tier: "pro" },
        { color: 1, human: "star", tier: "pro" },
        { color: 2, human: null, tier: cfg.tiers[2] ?? "normal" },
        { color: 3, human: null, tier: cfg.tiers[3] ?? "normal" }
      ],
      rules: cfg.rules,
      seed: Math.floor(Math.random() * 1e9),
      rounds: 200,
      goalText: "🎯 朵朵与星星各执一色，先把自己 4 架送到齐的人获胜",
      sfx: (n) => api.play(n),
      onOver: (r) => {
        const duoHome = homeCount(r.state, 0);
        const starHome = homeCount(r.state, 1);
        const title =
          duoHome === starHome ? "打成平手！" : duoHome > starHome ? "朵朵这一局更快" : "星星这一局更快";
        showOver(title, `朵朵到家 ${duoHome} 架，星星到家 ${starHome} 架。换个开局顺序再来一次吧。`, "🔁 再来一局");
      }
    });
  }

  function start(): void {
    if (mode === "versus") tierPicker((t) => runVersus(t));
    else if (mode === "endless") runEndless();
    else runDuo();
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

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

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
  bar.className = "fc-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "fc-modetip";
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
    btn.className = "fc-open";
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
      mapHint: "每一关的骰序都是固定的，同一关重玩点数一模一样——想清楚每个点数该给哪一架用。",
      grandMessage: "188 关全部飞完，整片天空的航线都被你摸熟啦！",
      guide,
      guideTitle: "飞行棋乐园 · 飞行手册"
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

/** 给测试钉住的节奏常量 */
export const FLIGHT_CONSTS = { HOP_MS, ARC_MS, BEAT_MS, SPIN_MS, RING_LEN, GOAL, SIX_STREAK_LIMIT };

/** 界面上「这一格是什么格」的一句话，无障碍标签与攻略共用 */
export function cellSummary(color: Color, p: number): string {
  if (p === BASE) return `${COLOR_INFO[color].name}的基地`;
  if (p >= RING_LEN) return `${COLOR_INFO[color].name}的终点通道第 ${p - RING_LEN + 1} 格`;
  const bits = [`环线第 ${p + 1} 格`];
  if (isAirline(p)) bits.push("虚线航线起点，踩上去直接飞到对面");
  else if (isOwnColorCell(p)) bits.push(`${COLOR_INFO[color].name}的本色格，可以再跳 4 格`);
  bits.push(`格子归 ${COLOR_INFO[ringColor(ringAt(color, p))].name}`);
  return bits.join(" · ");
}
