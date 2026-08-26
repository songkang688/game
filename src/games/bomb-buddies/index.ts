import { meta } from "./meta";
export { meta };

// 泡泡炸弹人:格子迷宫里摆泡泡弹的合家欢对战游戏。
//
// 五种玩法共用同一套对局运行时 `createMatch`:
//  - 闯关:188 关八大主题,清怪 / 找出口 / 泡泡王三种目标(走 level99 框架);
//  - 双人对战:同屏两人,先赢 3 局;
//  - 人机对战:三档电脑玩家,高档会算爆风与逃生路线;
//  - 无尽泡泡:场地一圈一圈收缩,被泡泡包住就结算轮次;
//  - 双人合作:两人同队一起闯关,进度单独存。
//
// 全程没有血、没有伤、没有死亡:被爆风碰到只是被泡泡包住几秒,自己就破泡泡出来。
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import {
  AI_LABEL,
  chooseAiAction,
  dangerTiming,
  shrinkDelay,
  shrinkRing,
  type AiLevel,
} from "./ai";
import {
  CHAPTERS,
  buildArena,
  buildCoopLevel,
  buildEndlessRound,
  buildLevel,
  goalText,
  type BombLevel,
} from "./levels";
import {
  BUBBLE_MS,
  COOP_KEY,
  CRITTER_INFO,
  DIR_NONE,
  FLAME_MS,
  FUSE_MS,
  ITEM_INFO,
  TILE_HARD,
  TILE_SOFT,
  actionDir,
  applyItem,
  createWorld,
  endlessLine,
  formatClock,
  isPauseKey,
  keyToAction,
  levelCleared,
  loseLine,
  makeFighter,
  matchWinner,
  parseCoopProgress,
  pickDir,
  rateLevel,
  roundWinner,
  secondsLeft,
  serializeCoopProgress,
  stepWorld,
  timeUp,
  versusLine,
  winLine,
  xOf,
  yOf,
  type Fighter,
  type Intent,
  type InputName,
  type World,
} from "./logic";

const P_NAME = ["朵朵", "星星"];
const P_EMOJI = ["🌸", "⭐"];
const P_COLOR = ["#e8558f", "#3f7fd6"];

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.bb-wrap{--bb-ink:#4a4266;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--bb-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;position:relative;}
.bb-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.bb-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(120,110,170,.18);}
.bb-chip b{font-weight:900;}
.bb-chip-p0{color:#a8306a;background:#ffeaf3;}
.bb-chip-p1{color:#28568f;background:#e6f0ff;}
.bb-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7e6bc4,#6857ae);box-shadow:0 3px 0 #52458c;}
.bb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #52458c;}
.bb-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bb-btn--ghost{background:linear-gradient(180deg,#9db6d8,#7f9ac3);box-shadow:0 3px 0 #64809f;}
.bb-btn--ghost:active{box-shadow:0 1px 0 #64809f;}
.bb-board{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(110,100,160,.22);line-height:0;}
.bb-board canvas{display:block;}
.bb-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:620px;color:#6a5f8c;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
.bb-pads{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;width:100%;}
.bb-padwrap{display:flex;flex-direction:column;align-items:center;gap:4px;}
.bb-padname{font-size:11.5px;font-weight:900;}
.bb-pad{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:4px;}
.bb-pad button{border:none;border-radius:11px;width:40px;height:40px;font-size:16px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;}
.bb-pad .bb-slot{visibility:hidden;}
.bb-pad--p0 button{background:linear-gradient(180deg,#f79ac0,#e8558f);box-shadow:0 3px 0 #bf3a70;}
.bb-pad--p1 button{background:linear-gradient(180deg,#8db6ec,#3f7fd6);box-shadow:0 3px 0 #2f63aa;}
.bb-pad button:active{transform:translateY(2px);}
.bb-pad button:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bb-acts{display:flex;gap:5px;}
.bb-acts button{border:none;border-radius:11px;height:34px;padding:0 11px;font-size:12.5px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;}
.bb-acts button:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bb-acts--p0 button{background:linear-gradient(180deg,#f79ac0,#e8558f);box-shadow:0 3px 0 #bf3a70;}
.bb-acts--p1 button{background:linear-gradient(180deg,#8db6ec,#3f7fd6);box-shadow:0 3px 0 #2f63aa;}
.bb-acts button:active{transform:translateY(2px);}
.bb-veil{position:absolute;inset:0;background:rgba(255,252,255,.94);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.bb-veil-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.bb-veil-s{font-size:13.5px;font-weight:700;color:#6f6390;line-height:1.6;max-width:320px;}
.bb-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.bb-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f2f5ff,#fff3f8);display:flex;flex-direction:column;gap:8px;}
.bb-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.bb-back{border:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.bb-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.bb-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bb-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.bb-bar[hidden],.bb-picks[hidden]{display:none;}
.bb-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.bb-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.bb-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bb-open--vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.bb-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.bb-open--co{background:linear-gradient(180deg,#efb268,#d8913f);box-shadow:0 4px 0 #ab7031;}
.bb-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.bb-pick{border:none;border-radius:14px;padding:7px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#5b4a7a;box-shadow:0 3px 0 rgba(140,120,190,.35);}
.bb-pick[aria-pressed="true"]{background:linear-gradient(180deg,#8f7ae0,#6f57c8);color:#fff;box-shadow:0 3px 0 #57429f;}
.bb-pick:active{transform:translateY(2px);}
.bb-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
@media (max-width:420px){
  .bb-pad button{width:36px;height:36px;font-size:14px;}
  .bb-acts button{height:31px;padding:0 9px;font-size:11.5px;}
  .bb-chip{font-size:11.5px;padding:3px 8px;}
  .bb-pads{gap:8px;}
}
/* 手机竖屏一共就 667 像素高,棋盘上面还压着标题栏和选关条。
   这里把每一行都收一点,保证方向盘整块留在首屏里,不用一边滚屏一边躲炸弹。 */
@media (max-height:720px){
  .bb-wrap{gap:5px;}
  .bb-chip{font-size:11px;padding:2px 7px;}
  .bb-btn{padding:5px 11px;font-size:12px;}
  .bb-tip{font-size:11.5px;line-height:1.35;padding:3px 9px;}
  .bb-padname{font-size:10.5px;}
  .bb-pad{gap:3px;}
  .bb-pad button{width:34px;height:34px;font-size:14px;}
  .bb-acts button{height:29px;padding:0 8px;font-size:11px;}
  /* 只有一个人玩的时候,放弹/引爆挪到方向盘右边,又省下一行的高度 */
  .bb-pads--one .bb-padwrap{display:grid;grid-template-columns:auto auto;grid-template-areas:"name name" "pad acts";
    align-items:center;column-gap:8px;}
  .bb-pads--one .bb-padname{grid-area:name;}
  .bb-pads--one .bb-pad{grid-area:pad;}
  .bb-pads--one .bb-acts{grid-area:acts;flex-direction:column;}
}
@media (prefers-reduced-motion:reduce){
  .bb-btn:active,.bb-pad button:active,.bb-acts button:active,.bb-pick:active{transform:none;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("bb-style")) return;
  const style = document.createElement("style");
  style.id = "bb-style";
  style.textContent = CSS;
  (document.head ?? host).appendChild(style);
  cssInjected = true;
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// 配色
// ---------------------------------------------------------------------------

interface Palette {
  bg: string;
  floor: string;
  line: string;
  wall: string;
  wallTop: string;
  brick: string;
  brickTop: string;
}

// 每一章一套粉彩配色。软砖要和地板拉开差距(砖是暖色、地板近白),
// 不然孩子一眼分不清「这块能炸」还是「这里能走」。
const PALETTES: Palette[] = [
  { bg: "#eef8ef", floor: "#fbfefa", line: "#e2f0e0", wall: "#7fb389", wallTop: "#9ccba4", brick: "#f0cf94", brickTop: "#ffe6b8" },
  { bg: "#fdeef4", floor: "#fffbfd", line: "#f6e2ea", wall: "#cd8aa5", wallTop: "#e3a5bd", brick: "#f3b183", brickTop: "#ffcfa6" },
  { bg: "#eaf4fc", floor: "#fbfdff", line: "#dcecf7", wall: "#6fa3c4", wallTop: "#8dbcd9", brick: "#eec98f", brickTop: "#ffe1b2" },
  { bg: "#eeeffb", floor: "#fcfcff", line: "#e4e6f5", wall: "#868dc6", wallTop: "#a2a8d9", brick: "#e9bfa0", brickTop: "#fbd9c0" },
  { bg: "#f5f0e6", floor: "#fefdfa", line: "#eee6d8", wall: "#b0906a", wallTop: "#cbae8b", brick: "#d9b98f", brickTop: "#f0d5ae" },
  { bg: "#e9f5f8", floor: "#fafeff", line: "#dcedf1", wall: "#6fb2c4", wallTop: "#8ecada", brick: "#f0cba1", brickTop: "#ffe3bf" },
  { bg: "#fdf1e4", floor: "#fffcf8", line: "#f6e6d5", wall: "#c9925f", wallTop: "#e0ae7f", brick: "#e8c07e", brickTop: "#fbdaa8" },
  { bg: "#f0ecfa", floor: "#fdfcff", line: "#e7e1f4", wall: "#9280c2", wallTop: "#ac9bd6", brick: "#e3bfa2", brickTop: "#f7dcc4" },
];

const FLAME_CORE = "#ffe9a8";
const FLAME_EDGE = "#ff9fbe";
const BOMB_BODY = "#5c5580";
const BOMB_SHINE = "#8d86ad";

// ---------------------------------------------------------------------------
// 一场对局
// ---------------------------------------------------------------------------

export type MatchMode = "campaign" | "coop" | "versus" | "ai" | "endless";

export interface MatchResult {
  cleared: boolean;
  reason: "clear" | "time" | "bubble" | "escape";
  secondsLeft: number;
  totalSeconds: number;
  /** 1 号玩家(或合作双方合计)被包了几次 */
  bubbled: number;
  picked: number;
  /** 对战:赢家下标;其它模式 -1 */
  winner: number;
}

export interface MatchOpts {
  level: BombLevel;
  mode: MatchMode;
  /** 人类玩家数(1 或 2) */
  humans: number;
  /** 电脑玩家 */
  ai?: { index: number; skill: AiLevel }[];
  banner: string;
  tip: string;
  sfx: (name: SoundName) => void;
  onDone: (res: MatchResult) => void;
  /** 无尽模式的轮次(>0 时场地会收缩) */
  shrinkRound?: number;
}

interface Runner {
  destroy: () => void;
  pause: () => void;
}

interface FighterView {
  rx: number;
  ry: number;
  hop: number;
}

const HOLD_KEYS: InputName[] = ["up", "right", "down", "left"];

function createMatch(host: HTMLElement, opts: MatchOpts): Runner {
  ensureCss(host);
  const lv = opts.level;
  const board = lv.board;
  const palette = PALETTES[Math.max(0, Math.min(PALETTES.length - 1, lv.chapter))];
  const coop = opts.mode === "coop";
  const duel = opts.mode === "versus" || opts.mode === "ai";
  const seats = Math.max(1, Math.min(2, opts.humans + (opts.ai?.length ?? 0)));

  // ---- 世界 ----------------------------------------------------------------
  const fighters: Fighter[] = [];
  for (let i = 0; i < seats; i++) {
    const spawn = lv.spawns[i] ?? lv.spawns[0];
    const f = makeFighter(i, P_NAME[i], P_EMOJI[i], spawn, coop ? 0 : i);
    for (const item of lv.starters) applyItem(f, item);
    fighters.push(f);
  }
  for (const seat of opts.ai ?? []) {
    const f = fighters[seat.index];
    if (f) f.ai = true;
  }

  const world: World = createWorld({
    board,
    fighters,
    critters: lv.critters.map((c) => ({ ...c })),
    hidden: new Map(lv.hidden),
    exit: lv.exit,
    exitNeedsClear: true,
    goal: lv.goal,
    pierce: lv.pierce,
    limit: lv.seconds > 0 ? lv.seconds * 1000 : 0,
    seed: lv.seed,
    richness: lv.richness,
  });

  const views: FighterView[] = fighters.map((f) => ({ rx: xOf(board, f.pos), ry: yOf(board, f.pos), hop: 0 }));

  // ---- DOM -----------------------------------------------------------------
  const wrap = el("div", "bb-wrap");
  const hud = el("div", "bb-hud");
  const chipTime = el("span", "bb-chip");
  const chipGoal = el("span", "bb-chip");
  const chipStats: HTMLElement[] = [];
  for (let i = 0; i < seats; i++) chipStats.push(el("span", `bb-chip bb-chip-p${i}`));
  const pauseBtn = el("button", "bb-btn bb-btn--ghost", "⏸ 暂停") as HTMLButtonElement;
  pauseBtn.type = "button";
  hud.append(chipTime, chipGoal, ...chipStats, pauseBtn);

  const boardBox = el("div", "bb-board");
  const canvas = document.createElement("canvas");
  boardBox.appendChild(canvas);

  const tip = el("div", "bb-tip", opts.tip);
  const pads = el("div", "bb-pads");
  const live = el("div", "bb-sr");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");

  wrap.append(hud, boardBox, tip, pads, live);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ----------------------------------------------------------------
  const held: boolean[][] = [];
  const recent: number[][] = [];
  const pending: { drop: boolean; boom: boolean }[] = [];
  for (let i = 0; i < seats; i++) {
    held.push([false, false, false, false]);
    recent.push([]);
    pending.push({ drop: false, boom: false });
  }

  function humanSeat(player: number): number {
    // 单人玩时两套键位都归 0 号;双人时各管各的
    if (opts.humans <= 1) return 0;
    return player;
  }

  function setHold(seat: number, action: InputName, down: boolean): void {
    if (seat < 0 || seat >= seats) return;
    if (fighters[seat]?.ai) return;
    const dir = actionDir(action);
    if (dir >= 0) {
      held[seat][dir] = down;
      if (down) recent[seat].push(dir);
      else recent[seat] = recent[seat].filter((d) => d !== dir);
      if (recent[seat].length > 6) recent[seat] = recent[seat].slice(-6);
      return;
    }
    if (!down) return;
    if (action === "drop") pending[seat].drop = true;
    if (action === "boom") pending[seat].boom = true;
  }

  const padButtons: { btn: HTMLButtonElement; seat: number; action: InputName }[] = [];

  function buildPad(seat: number): void {
    const box = el("div", "bb-padwrap");
    const name = el("div", "bb-padname", `${P_EMOJI[seat]} ${P_NAME[seat]}`);
    name.style.color = P_COLOR[seat];
    const pad = el("div", `bb-pad bb-pad--p${seat}`);
    const layout: Array<InputName | null> = [null, "up", null, "left", null, "right", null, "down", null];
    for (const slot of layout) {
      const btn = document.createElement("button");
      btn.type = "button";
      if (!slot) {
        btn.className = "bb-slot";
        btn.tabIndex = -1;
        btn.setAttribute("aria-hidden", "true");
        pad.appendChild(btn);
        continue;
      }
      btn.textContent = slot === "up" ? "↑" : slot === "down" ? "↓" : slot === "left" ? "←" : "→";
      btn.setAttribute("aria-label", `${P_NAME[seat]}向${slot === "up" ? "上" : slot === "down" ? "下" : slot === "left" ? "左" : "右"}走`);
      pad.appendChild(btn);
      padButtons.push({ btn, seat, action: slot });
    }
    const acts = el("div", `bb-acts bb-acts--p${seat}`);
    for (const act of [
      { action: "drop" as InputName, label: "💣 放弹" },
      { action: "boom" as InputName, label: "📡 引爆" },
    ]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = act.label;
      btn.setAttribute("aria-label", `${P_NAME[seat]}${act.action === "drop" ? "放炸弹" : "遥控引爆"}`);
      acts.appendChild(btn);
      padButtons.push({ btn, seat, action: act.action });
    }
    box.append(name, pad, acts);
    pads.appendChild(box);
  }

  for (let i = 0; i < seats; i++) {
    if (!fighters[i].ai) buildPad(i);
  }
  pads.classList.add(pads.childElementCount > 1 ? "bb-pads--two" : "bb-pads--one");

  for (const { btn, seat, action } of padButtons) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      setHold(seat, action, true);
    });
    const up = (): void => setHold(seat, action, false);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  const releaseAll = (): void => {
    for (let i = 0; i < seats; i++) {
      held[i] = [false, false, false, false];
      recent[i] = [];
    }
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(e.code, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setHold(humanSeat(hit.player), hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setHold(humanSeat(hit.player), hit.action, false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerup", releaseAll);
  window.addEventListener("blur", releaseAll);

  // ---- 画布尺寸 -------------------------------------------------------------
  let cell = 30;

  function layout(): void {
    const avail = Math.max(220, Math.min(host.clientWidth || 340, 620));
    const viewH = (globalThis as { innerHeight?: number }).innerHeight ?? 700;
    // 手机竖屏(667 那一档)要给下面两套方向盘留位置,棋盘就得矮一点,
    // 不然孩子得一边滚屏一边按方向键。大屏上再放开限制。
    const share = viewH <= 560 ? 0.42 : viewH <= 720 ? 0.3 : 0.46;
    const maxH = Math.max(150, Math.min(400, viewH * share));
    cell = Math.max(14, Math.floor(Math.min(avail / board.w, maxH / board.h)));
    const cssW = cell * board.w;
    const cssH = cell * board.h;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
    render();
  };
  window.addEventListener("resize", onResize);

  // ---- 绘制 ----------------------------------------------------------------
  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    if (!g) return;
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function emojiAt(text: string, cx: number, cy: number, size: number): void {
    if (!g) return;
    g.font = `${Math.round(size)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, cx, cy);
  }

  function render(): void {
    if (!g) return;
    const cssW = cell * board.w;
    const cssH = cell * board.h;
    g.clearRect(0, 0, cssW, cssH);
    g.fillStyle = palette.bg;
    g.fillRect(0, 0, cssW, cssH);

    const timing = dangerTiming(board, world.bombs, world.pierce);

    // 地板 / 墙 / 砖
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const cellIdx = y * board.w + x;
        const px = x * cell;
        const py = y * cell;
        const t = board.cells[cellIdx];
        if (t === TILE_HARD) {
          g.fillStyle = palette.wall;
          roundRect(px + 1, py + 1, cell - 2, cell - 2, Math.max(3, cell * 0.18));
          g.fill();
          g.fillStyle = palette.wallTop;
          roundRect(px + 2.5, py + 2, cell - 5, (cell - 4) * 0.42, Math.max(2, cell * 0.14));
          g.fill();
          continue;
        }
        g.fillStyle = palette.floor;
        g.fillRect(px, py, cell, cell);
        g.strokeStyle = palette.line;
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
        if (t === TILE_SOFT) {
          g.fillStyle = palette.brick;
          roundRect(px + 2, py + 2, cell - 4, cell - 4, Math.max(3, cell * 0.22));
          g.fill();
          g.fillStyle = palette.brickTop;
          roundRect(px + 3.5, py + 3, cell - 7, (cell - 6) * 0.38, Math.max(2, cell * 0.16));
          g.fill();
        } else if (world.exitOpen && cellIdx === world.exit) {
          emojiAt("🚪", px + cell / 2, py + cell / 2, cell * 0.66);
        }
        // 快要着火的格子给一圈提示,让孩子来得及跑
        const burn = timing.get(cellIdx);
        if (burn !== undefined && !world.flames.has(cellIdx)) {
          const heat = Math.max(0, Math.min(1, 1 - burn / FUSE_MS));
          g.strokeStyle = `rgba(255,150,120,${0.15 + heat * 0.5})`;
          g.lineWidth = Math.max(1.5, cell * 0.06);
          roundRect(px + 2, py + 2, cell - 4, cell - 4, Math.max(3, cell * 0.2));
          g.stroke();
        }
      }
    }

    // 道具
    for (const [cellIdx, kind] of world.items) {
      const px = (cellIdx % board.w) * cell;
      const py = Math.floor(cellIdx / board.w) * cell;
      g.fillStyle = "#ffffffdd";
      roundRect(px + cell * 0.14, py + cell * 0.14, cell * 0.72, cell * 0.72, cell * 0.24);
      g.fill();
      emojiAt(ITEM_INFO[kind].emoji, px + cell / 2, py + cell / 2 + 1, cell * 0.48);
    }

    // 炸弹
    for (const bomb of world.bombs) {
      const px = (bomb.pos % board.w) * cell;
      const py = Math.floor(bomb.pos / board.w) * cell;
      const beat = bomb.remote ? 0.9 : 0.86 + 0.1 * Math.sin((FUSE_MS - bomb.fuse) / 90);
      const r = (cell * 0.34) * beat;
      g.fillStyle = BOMB_BODY;
      g.beginPath();
      g.arc(px + cell / 2, py + cell / 2 + cell * 0.04, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = BOMB_SHINE;
      g.beginPath();
      g.arc(px + cell / 2 - r * 0.32, py + cell / 2 - r * 0.3, r * 0.26, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = bomb.remote ? "#6fd0c4" : "#ffb35c";
      g.lineWidth = Math.max(1.5, cell * 0.07);
      g.beginPath();
      g.moveTo(px + cell / 2 + r * 0.4, py + cell / 2 - r * 0.7);
      g.quadraticCurveTo(px + cell / 2 + r, py + cell / 2 - r * 1.3, px + cell / 2 + r * 0.3, py + cell / 2 - r * 1.5);
      g.stroke();
    }

    // 爆风
    for (const [cellIdx, left] of world.flames) {
      const px = (cellIdx % board.w) * cell;
      const py = Math.floor(cellIdx / board.w) * cell;
      const k = Math.max(0.25, left / FLAME_MS);
      g.globalAlpha = 0.35 + k * 0.5;
      g.fillStyle = FLAME_EDGE;
      roundRect(px + 1, py + 1, cell - 2, cell - 2, cell * 0.3);
      g.fill();
      g.fillStyle = FLAME_CORE;
      const inset = cell * (0.22 - k * 0.08);
      roundRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2, cell * 0.28);
      g.fill();
      g.globalAlpha = 1;
    }

    // 小怪
    for (const c of world.critters) {
      const px = (c.pos % board.w) * cell;
      const py = Math.floor(c.pos / board.w) * cell;
      const info = CRITTER_INFO[c.kind];
      if (c.kind === "boss") {
        g.fillStyle = "#ffe0f0";
        g.beginPath();
        g.arc(px + cell / 2, py + cell / 2, cell * 0.46, 0, Math.PI * 2);
        g.fill();
      }
      emojiAt(info.emoji, px + cell / 2, py + cell / 2, cell * (c.kind === "boss" ? 0.72 : 0.6));
      if (info.layers > 1) {
        g.fillStyle = "#7a5da8";
        g.font = `900 ${Math.round(cell * 0.28)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(`${c.layers}`, px + cell * 0.8, py + cell * 0.22);
      }
    }

    // 人
    fighters.forEach((f, i) => {
      const v = views[i];
      const cx = v.rx * cell + cell / 2;
      const cy = v.ry * cell + cell / 2 - v.hop;
      const r = cell * 0.34;
      g.fillStyle = P_COLOR[i];
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(cx - r * 0.32, cy - r * 0.18, r * 0.22, 0, Math.PI * 2);
      g.arc(cx + r * 0.32, cy - r * 0.18, r * 0.22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#3a3357";
      g.beginPath();
      g.arc(cx - r * 0.32, cy - r * 0.16, r * 0.1, 0, Math.PI * 2);
      g.arc(cx + r * 0.32, cy - r * 0.16, r * 0.1, 0, Math.PI * 2);
      g.fill();
      emojiAt(f.emoji, cx, cy - r * 1.15, cell * 0.34);
      if (f.bubbleT > 0) {
        g.strokeStyle = "#8fd6f5";
        g.lineWidth = Math.max(2, cell * 0.08);
        g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "rgba(180,230,250,.35)";
        g.fill();
        g.globalAlpha = 1;
      }
      if (f.ai) {
        g.fillStyle = "#4a4266";
        g.font = `900 ${Math.round(cell * 0.24)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("电脑", cx, cy + r * 1.35);
      }
    });
  }

  // ---- HUD -----------------------------------------------------------------
  function refreshHud(): void {
    chipTime.textContent =
      world.limit > 0
        ? `⏱ ${formatClock(secondsLeft(world))}`
        : `⏱ ${formatClock(Math.floor(world.time / 1000))}`;
    if (duel) {
      chipGoal.textContent = `⚔️ ${opts.banner}`;
    } else if (world.goal === "exit") {
      chipGoal.textContent = world.exitOpen ? "🚪 出口开了,走过去!" : `👾 剩 ${world.critters.length} 只 · 再找出口`;
    } else {
      chipGoal.textContent = `👾 剩 ${world.critters.length} 只`;
    }
    fighters.forEach((f, i) => {
      const gear = `${f.kick ? "🦵" : ""}${f.ghost ? "🫧" : ""}${f.remote ? "📡" : ""}`;
      chipStats[i].textContent = `${f.emoji}${f.name} 🔥${f.power} 💣${f.bombs} 👟${f.speed}${gear ? ` ${gear}` : ""}`;
    });
  }

  // ---- 遮罩 ----------------------------------------------------------------
  let veil: HTMLElement | null = null;
  let paused = false;
  let finished = false;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(title: string, sub: string, buttons: { label: string; ghost?: boolean; onClick: () => void }[]): void {
    clearVeil();
    const box = el("div", "bb-veil");
    box.append(el("div", "bb-veil-t", title), el("div", "bb-veil-s", sub));
    const row = el("div", "bb-veil-btns");
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `bb-btn${b.ghost ? " bb-btn--ghost" : ""}`;
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        opts.sfx("tap");
        b.onClick();
      });
      row.appendChild(btn);
    }
    box.appendChild(row);
    wrap.appendChild(box);
    veil = box;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    if (paused) {
      releaseAll();
      showVeil("⏸ 休息一下", "按 Esc 或点「继续」回到对局。朵朵用 WASD 走、F 放弹、G 引爆;星星用方向键走、L 放弹、K 引爆。", [
        { label: "▶ 继续", onClick: () => togglePause() },
      ]);
    } else {
      clearVeil();
    }
  }
  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- 事件 → 音效与提示 -----------------------------------------------------
  let lastBoom = 0;
  let toast = "";
  let toastUntil = 0;

  function consumeEvents(now: number): void {
    for (const e of world.events) {
      switch (e.kind) {
        case "boom":
          if (now - lastBoom > 90) {
            opts.sfx("pop");
            lastBoom = now;
          }
          break;
        case "pickup":
          opts.sfx("coin");
          toast = `${fighters[e.who].name} 捡到 ${ITEM_INFO[e.item].name}:${ITEM_INFO[e.item].line}`;
          toastUntil = now + 1800;
          break;
        case "bubble":
          opts.sfx("oops");
          toast = `${fighters[e.who].name} 被泡泡包住啦,${Math.round(BUBBLE_MS / 1000)} 秒后自己就出来。`;
          toastUntil = now + 1800;
          break;
        case "critter":
          if (e.done) opts.sfx("meow");
          break;
        case "exit":
          opts.sfx("jump");
          break;
        case "free":
        case "brick":
          break;
      }
    }
    world.events.length = 0;
    tip.textContent = now < toastUntil ? toast : opts.tip;
  }

  // ---- 无尽收缩 -------------------------------------------------------------
  let shrinkAt = opts.shrinkRound && opts.shrinkRound > 0 ? shrinkDelay(opts.shrinkRound) : Infinity;
  let ring = 1;

  function maybeShrink(): void {
    if (world.time < shrinkAt) return;
    const cells = shrinkRing(board, ring);
    if (cells.length === 0) {
      shrinkAt = Infinity;
      return;
    }
    for (const c of cells) {
      // 站着人的格子先不封,给一点缓冲,下一轮再收
      if (fighters.some((f) => f.pos === c)) continue;
      board.cells[c] = TILE_HARD;
      world.items.delete(c);
    }
    world.bombs = world.bombs.filter((b) => board.cells[b.pos] !== TILE_HARD);
    world.critters = world.critters.filter((c) => board.cells[c.pos] !== TILE_HARD);
    ring++;
    shrinkAt = world.time + shrinkDelay(opts.shrinkRound ?? 1);
    opts.sfx("tap");
    toast = "场地缩小了!快往中间靠。";
    toastUntil = performance.now() + 1600;
  }

  // ---- 主循环 ---------------------------------------------------------------
  let raf = 0;
  let last = 0;
  let aiTick = 0;
  const aiCooldown: number[] = fighters.map(() => 0);
  const aiLastDir: number[] = fighters.map(() => DIR_NONE);

  function intentsFor(now: number, dt: number): Intent[] {
    const out: Intent[] = [];
    for (let i = 0; i < seats; i++) {
      const f = fighters[i];
      if (f.ai) {
        aiCooldown[i] -= dt;
        const skill = opts.ai?.find((a) => a.index === i)?.skill ?? 2;
        if (aiCooldown[i] > 0) {
          out.push({ dir: aiLastDir[i], drop: false, detonate: false });
          continue;
        }
        // 档位越低想得越慢,给孩子留出反应时间
        aiCooldown[i] = skill === 1 ? 260 : skill === 2 ? 150 : 70;
        const act = chooseAiAction(world, i, skill, aiTick++);
        aiLastDir[i] = act.dir;
        out.push({ dir: act.dir, drop: act.drop, detonate: act.detonate });
        continue;
      }
      const dir = pickDir(held[i], recent[i]);
      out.push({ dir, drop: pending[i].drop, detonate: pending[i].boom });
      pending[i].drop = false;
      pending[i].boom = false;
    }
    return out;
  }

  function settle(res: MatchResult): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    releaseAll();
    opts.onDone(res);
  }

  function baseResult(): MatchResult {
    const mine = coop ? fighters.reduce((s, f) => s + f.bubbled, 0) : fighters[0].bubbled;
    const picked = fighters.reduce((s, f) => s + f.picked, 0);
    return {
      cleared: false,
      reason: "time",
      secondsLeft: secondsLeft(world),
      totalSeconds: lv.seconds,
      bubbled: mine,
      picked,
      winner: -1,
    };
  }

  function checkEnd(): void {
    if (duel) {
      const w = roundWinner(world);
      if (w >= 0) {
        settle({ ...baseResult(), cleared: true, reason: "bubble", winner: w });
        return;
      }
      if (timeUp(world)) {
        settle({ ...baseResult(), cleared: false, reason: "time", winner: -1 });
      }
      return;
    }
    if (levelCleared(world)) {
      settle({ ...baseResult(), cleared: true, reason: world.goal === "exit" ? "escape" : "clear" });
      return;
    }
    if (opts.mode === "endless" && fighters[0].bubbleT > 0) {
      settle({ ...baseResult(), cleared: false, reason: "bubble" });
      return;
    }
    if (timeUp(world)) {
      settle({ ...baseResult(), cleared: false, reason: "time" });
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.max(0, Math.min(48, now - last));
    last = now;
    if (paused || finished) {
      render();
      return;
    }

    stepWorld(world, dt, intentsFor(now, dt));
    if (opts.shrinkRound) maybeShrink();
    consumeEvents(now);

    // 视觉插值:格子跳到目标位,人走得顺滑一点
    fighters.forEach((f, i) => {
      const v = views[i];
      const tx = xOf(board, f.pos);
      const ty = yOf(board, f.pos);
      const k = Math.min(1, dt / 90);
      v.rx += (tx - v.rx) * k;
      v.ry += (ty - v.ry) * k;
      const moving = Math.abs(tx - v.rx) + Math.abs(ty - v.ry) > 0.05;
      v.hop = moving && f.bubbleT <= 0 ? Math.abs(Math.sin(now / 90)) * cell * 0.06 : 0;
    });

    refreshHud();
    render();
    checkEnd();
  }
  refreshHud();
  render();
  raf = requestAnimationFrame(frame);

  return {
    pause: () => {
      if (!paused) togglePause();
    },
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("resize", onResize);
      clearVeil();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关(188 关)
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const lv = buildLevel(ctx.level, 1);
  const runner = createMatch(stage, {
    level: lv,
    mode: "campaign",
    humans: 1,
    banner: `第 ${ctx.level + 1} 关`,
    tip: `${goalText(lv.goal)}。${lv.hint}`,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.cleared) {
        ctx.win(rateLevel(res.secondsLeft, lv.seconds, res.bubbled), winLine(res.secondsLeft, res.bubbled, res.picked));
      } else {
        ctx.lose(loseLine(res.reason === "bubble" ? "bubble" : "time"));
      }
    },
  });
  return { destroy: () => runner.destroy() };
}

// ---------------------------------------------------------------------------
// 模式外壳:统一的「◀ 回选关 + 标题 + 舞台」
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  head: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "bb-mode");
  const head = el("div", "bb-mhead");
  const back = document.createElement("button");
  back.type = "button";
  back.className = "bb-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "bb-chip", title);
  head.append(back, chip);
  const stage = el("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return {
    stage,
    chip,
    head,
    destroy: () => wrap.remove(),
  };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: { label: string; ghost?: boolean; onClick: () => void }[]
): void {
  stage.innerHTML = "";
  const box = el("div", "bb-veil");
  box.style.position = "static";
  box.append(el("div", "bb-veil-t", title), el("div", "bb-veil-s", sub));
  const row = el("div", "bb-veil-btns");
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `bb-btn${b.ghost ? " bb-btn--ghost" : ""}`;
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 对战(双人同屏 / 人机),先赢 3 局
// ---------------------------------------------------------------------------

const WIN_TARGET = 3;

function mountDuel(host: HTMLElement, api: GameApi, onBack: () => void, aiSkill: AiLevel | null): { destroy: () => void } {
  const label = aiSkill ? `🤖 人机对战 · ${AI_LABEL[aiSkill]}` : "⚔️ 双人对战";
  const shell = makeShell(host, api, onBack, `${label} · 先赢 ${WIN_TARGET} 局`);
  let runner: Runner | null = null;
  let round = 1;
  const scores = [0, 0];

  function refreshChip(): void {
    shell.chip.textContent = `${label} · ${P_NAME[0]} ${scores[0]} : ${scores[1]} ${P_NAME[1]} · 先赢 ${WIN_TARGET} 局`;
  }

  function finishMatch(winner: number): void {
    runner?.destroy();
    runner = null;
    api.play("win");
    api.addStars(2);
    overBox(
      shell.stage,
      `🏆 ${P_NAME[winner]}拿下整场!`,
      `${versusLine(scores, P_NAME)}。${
        winner === 1 && aiSkill
          ? "电脑这一档已经会算爆风了,想再练手就调高一档试试。"
          : "换个开局位置再来一场,布局思路会完全不一样。"
      }`,
      [
        {
          label: "🔁 再来一场",
          onClick: () => {
            api.play("tap");
            scores[0] = 0;
            scores[1] = 0;
            round = 1;
            startRound();
          },
        },
        { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
      ]
    );
  }

  function roundOver(winner: number, drawn: boolean): void {
    runner?.destroy();
    runner = null;
    if (!drawn && winner >= 0) scores[winner]++;
    refreshChip();
    const champion = matchWinner(scores, WIN_TARGET);
    if (champion >= 0) {
      finishMatch(champion);
      return;
    }
    const title = drawn ? "🤝 这一局打平" : `🫧 ${P_NAME[winner]}赢下第 ${round} 局!`;
    const sub = drawn
      ? `时间到,两个人都没被泡泡包住。${versusLine(scores, P_NAME)},下一局再决胜负。`
      : `${versusLine(scores, P_NAME)}。${
          winner === 0 ? "堵得漂亮!" : "下一局先抢道具,火力上来就好打了。"
        }`;
    overBox(shell.stage, title, sub, [
      {
        label: "▶ 下一局",
        onClick: () => {
          api.play("tap");
          round++;
          startRound();
        },
      },
      { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
    ]);
  }

  function startRound(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    refreshChip();
    runner = createMatch(shell.stage, {
      level: buildArena(round, 2),
      mode: aiSkill ? "ai" : "versus",
      humans: aiSkill ? 1 : 2,
      ai: aiSkill ? [{ index: 1, skill: aiSkill }] : [],
      banner: `第 ${round} 局 · ${scores[0]}:${scores[1]}`,
      tip: aiSkill
        ? "朵朵:WASD 走、F 放弹、G 引爆。把电脑逼进死胡同就赢了。"
        : "朵朵:WASD + F/G;星星:方向键 + L/K。谁先被泡泡包住,这一局就算对方赢。",
      sfx: (n) => api.play(n),
      onDone: (res) => roundOver(res.winner, res.winner < 0),
    });
  }

  startRound();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽泡泡(场地收缩)
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽泡泡");
  let runner: Runner | null = null;
  let round = 1;
  let best = save.getGameProgress(meta.id).endlessBest;

  function startRound(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `♾️ 无尽泡泡 · 第 ${round} 轮 · 最好 第 ${best} 轮`;
    runner = createMatch(shell.stage, {
      level: buildEndlessRound(round),
      mode: "endless",
      humans: 1,
      banner: `第 ${round} 轮`,
      tip: "清光小怪进下一轮。场地会一圈圈缩小,被泡泡包住这次挑战就结束。",
      sfx: (n) => api.play(n),
      shrinkRound: round,
      onDone: (res) => {
        if (res.cleared) {
          best = save.recordEndlessBest(meta.id, round);
          api.addStars(1);
          round++;
          startRound();
          return;
        }
        const reached = Math.max(0, round - 1);
        best = save.recordEndlessBest(meta.id, reached);
        runner?.destroy();
        runner = null;
        overBox(shell.stage, "🫧 泡泡把你接住啦", `${endlessLine(reached, best)}`, [
          {
            label: "🔁 从第 1 轮再来",
            onClick: () => {
              api.play("tap");
              round = 1;
              startRound();
            },
          },
          { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
        ]);
      },
    });
  }

  startRound();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人合作闯关
// ---------------------------------------------------------------------------

function readCoop(): number {
  try {
    return parseCoopProgress(localStorage.getItem(COOP_KEY));
  } catch {
    return 0;
  }
}

function writeCoop(level: number): void {
  try {
    localStorage.setItem(COOP_KEY, serializeCoopProgress(level));
  } catch {
    // 隐私模式写不进去也不影响这一次游玩
  }
}

function mountCoop(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "🤝 双人合作闯关");
  let runner: Runner | null = null;
  let level = readCoop();

  function startLevel(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    const lv = buildCoopLevel(level);
    shell.chip.textContent = `🤝 双人合作 · 第 ${level + 1} 关 · ${CHAPTERS[lv.chapter].emoji} ${CHAPTERS[lv.chapter].name}`;
    runner = createMatch(shell.stage, {
      level: lv,
      mode: "coop",
      humans: 2,
      banner: `合作 第 ${level + 1} 关`,
      tip: `${goalText(lv.goal)}。两个人分头行动更快:朵朵 WASD+F/G,星星 方向键+L/K。`,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        runner?.destroy();
        runner = null;
        if (res.cleared) {
          api.play("win");
          api.addStars(1);
          const next = Math.min(187, level + 1);
          writeCoop(next);
          overBox(
            shell.stage,
            `🎉 第 ${level + 1} 关合作通过!`,
            `两个人一共捡了 ${res.picked} 件道具,被泡泡包了 ${res.bubbled} 次。下一关记得分头开路,别挤在同一条走廊里。`,
            [
              {
                label: "▶ 下一关",
                onClick: () => {
                  api.play("tap");
                  level = next;
                  startLevel();
                },
              },
              { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
            ]
          );
        } else {
          overBox(shell.stage, "⏱ 时间到啦", loseLine("time"), [
            {
              label: "🔁 再试一次",
              onClick: () => {
                api.play("tap");
                startLevel();
              },
            },
            { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
          ]);
        }
      },
    });
  }

  startLevel();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  ensureCss(api.root);
  const root = el("div");
  const bar = el("div", "bb-bar");
  const picks = el("div", "bb-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let aiSkill: AiLevel = 2;

  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "bb-open bb-open--vs";
  vsBtn.textContent = "⚔️ 双人对战";
  const aiBtn = document.createElement("button");
  aiBtn.type = "button";
  aiBtn.className = "bb-open bb-open--ai";
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "bb-open";
  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "bb-open bb-open--co";
  bar.append(vsBtn, aiBtn, endlessBtn, coopBtn);

  const pickBtns: HTMLButtonElement[] = [];
  ([1, 2, 3] as AiLevel[]).forEach((skill) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bb-pick";
    btn.textContent = `🤖 ${AI_LABEL[skill]}`;
    btn.setAttribute("aria-label", `电脑难度:${AI_LABEL[skill]}`);
    btn.addEventListener("click", () => {
      api.play("tap");
      aiSkill = skill;
      refreshBar();
    });
    pickBtns.push(btn);
    picks.appendChild(btn);
  });

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽泡泡 · 最好 第 ${best} 轮` : "♾️ 无尽泡泡";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[aiSkill]}`;
    coopBtn.textContent = `🤝 双人合作 · 第 ${readCoop() + 1} 关`;
    pickBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i + 1 === aiSkill)));
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    picks.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    picks.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, null)));
  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, aiSkill)));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来:手机竖屏上这一百来像素正好够棋盘和方向盘同框
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        picks.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) {
              bar.hidden = false;
              picks.hidden = false;
            }
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "放弹之前先想好往哪躲,拐角后面永远安全。",
      grandMessage: "188 关全部通关,你就是泡泡炸弹人里最会算退路的那一个!",
      guideTitle: "泡泡炸弹人 · 摆弹手册",
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
