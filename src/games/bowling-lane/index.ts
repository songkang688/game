import { meta } from "./meta";
export { meta };

// 保龄球小馆:蓄力 → 落点 → 旋转,三下按键定一球。
//
// 三种玩法共用同一张「投球台」`createDesk`:
//  - 闯关:188 关八大主题,一关两到四格,目标分一路涨,后面几章还混特殊瓶(走 level99 框架);
//  - 双人对战:整整十格,朵朵和星星轮流投,也可以换成三档电脑球手;
//  - 无尽:一格一格往下打,哪一格没够到目标分就结束。
//
// 记分完全交给 scoring.ts 那个纯函数,画面上看到的每一次滚瓶也都是 logic.ts 真算出来的,
// 和单测跑的是同一套代码。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import GUIDE from "./guide";
import { CHAPTERS, buildEndlessFrame, buildLevel, buildVersus, chapterOfLevel } from "./levels";
import {
  AI_LABEL,
  BALL_R,
  DECK_END,
  GUTTER_EDGE,
  HEAD_Y,
  LANE_W,
  PIN_R,
  PIN_TRAITS,
  STAGE_LABEL,
  STAGE_MS,
  aiShot,
  aimFromSweep,
  clamp,
  createLane,
  downFlags,
  endlessLine,
  isPauseKey,
  keyToAction,
  loseLine,
  pinShift,
  pinSpot,
  powerFromSweep,
  rateLevel,
  releaseX,
  shotLine,
  spinFromSweep,
  standingAfter,
  stepLane,
  sweep,
  versusLine,
  winLine,
  type AiLevel,
  type LaneState,
  type PinKind,
  type Shot,
  type Stage,
} from "./logic";
import { PINS, frameMarks, scoreGame, totalScore, turnState, type FrameScore } from "./scoring";

const P_NAME = ["朵朵", "星星"];
const P_EMOJI = ["🌸", "⭐"];
const P_COLOR = ["#e8558f", "#3f7fd6"];

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.bl-wrap{--bl-ink:#42406b;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--bl-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;position:relative;width:100%;}
.bl-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.bl-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(110,120,170,.18);}
.bl-chip-p0{color:#a8306a;background:#ffeaf3;}
.bl-chip-p1{color:#28568f;background:#e6f0ff;}
.bl-chip-now{outline:2px solid #ffb43c;}
.bl-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7aa8e0,#5585c8);box-shadow:0 3px 0 #3f6da8;}
.bl-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #3f6da8;}
.bl-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-btn--ghost{background:linear-gradient(180deg,#b3aecd,#918bb0);box-shadow:0 3px 0 #736e8f;}
.bl-btn--ghost:active{box-shadow:0 1px 0 #736e8f;}
.bl-lane{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(100,110,160,.22);line-height:0;}
.bl-lane canvas{display:block;}
.bl-card{display:flex;gap:2px;justify-content:center;flex-wrap:nowrap;width:100%;overflow-x:auto;padding-bottom:2px;}
.bl-fr{background:#fff;border-radius:8px;min-width:30px;flex:0 0 auto;text-align:center;
  box-shadow:0 1px 3px rgba(110,120,170,.2);padding:1px 0 2px;}
.bl-fr-now{outline:2px solid #ffb43c;}
.bl-fr-n{font-size:9px;font-weight:800;color:#9a93b8;line-height:1.2;}
.bl-fr-m{font-size:12px;font-weight:900;letter-spacing:1px;line-height:1.25;min-height:15px;}
.bl-fr-s{font-size:11px;font-weight:800;color:#5d5786;line-height:1.2;min-height:13px;}
.bl-gauges{display:flex;flex-direction:column;gap:4px;width:100%;max-width:520px;}
.bl-gauge{position:relative;height:20px;border-radius:999px;background:#efecf8;overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(110,110,160,.18);}
.bl-gauge--power{background:linear-gradient(90deg,#d9f0e4,#ffe6a8,#ffc2c2);}
.bl-gauge--aim{background:linear-gradient(90deg,#dfe9ff,#ffffff,#dfe9ff);}
.bl-gauge--spin{background:linear-gradient(90deg,#e6dcff,#ffffff,#ffe1ef);}
.bl-gauge-tag{position:absolute;left:8px;top:0;line-height:20px;font-size:11px;font-weight:900;color:#6d6795;}
.bl-gauge-val{position:absolute;right:8px;top:0;line-height:20px;font-size:11px;font-weight:900;color:#6d6795;}
.bl-needle{position:absolute;top:1px;width:6px;height:18px;border-radius:3px;background:#4a4270;margin-left:-3px;}
.bl-gauge--done .bl-needle{background:#e8558f;}
.bl-gauge--idle{opacity:.42;}
.bl-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:620px;color:#645e8c;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
.bl-roll{border:none;border-radius:18px;padding:12px 30px;font-size:17px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f79ac0,#e8558f);box-shadow:0 4px 0 #bf3a70;
  min-width:190px;}
.bl-roll:active{transform:translateY(2px);box-shadow:0 2px 0 #bf3a70;}
.bl-roll:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-roll--p1{background:linear-gradient(180deg,#8db6ec,#3f7fd6);box-shadow:0 4px 0 #2f63aa;}
.bl-roll--p1:active{box-shadow:0 2px 0 #2f63aa;}
.bl-roll[disabled]{opacity:.5;cursor:default;transform:none;}
.bl-nudge{display:flex;gap:8px;align-items:center;}
.bl-nudge button{border:none;border-radius:14px;width:48px;height:40px;font-size:17px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#4a4270;background:#ffffffe0;box-shadow:0 3px 0 rgba(130,130,180,.35);}
.bl-nudge button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(130,130,180,.35);}
.bl-nudge button:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-veil{position:absolute;inset:0;background:rgba(252,253,255,.95);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.bl-veil-t{font-size:20px;font-weight:900;color:#3f6da8;}
.bl-veil-s{font-size:13.5px;font-weight:700;color:#645e8c;line-height:1.6;max-width:340px;}
.bl-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.bl-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#eef4ff,#fdf1f6);display:flex;flex-direction:column;gap:8px;}
.bl-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.bl-back{border:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#3f6da8;box-shadow:0 3px 0 rgba(90,120,180,.28);}
.bl-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(90,120,180,.28);}
.bl-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.bl-bar[hidden],.bl-picks[hidden]{display:none;}
.bl-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7aa8e0,#5585c8);box-shadow:0 4px 0 #3f6da8;}
.bl-open:active{transform:translateY(2px);box-shadow:0 2px 0 #3f6da8;}
.bl-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.bl-open--en{background:linear-gradient(180deg,#9a86e4,#7358cc);box-shadow:0 4px 0 #5b43a3;}
.bl-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.bl-pick{border:none;border-radius:14px;padding:7px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#544d7d;box-shadow:0 3px 0 rgba(130,130,190,.35);}
.bl-pick[aria-pressed="true"]{background:linear-gradient(180deg,#7aa8e0,#5585c8);color:#fff;box-shadow:0 3px 0 #3f6da8;}
.bl-pick:active{transform:translateY(2px);}
.bl-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
@media (max-width:420px){
  .bl-chip{font-size:11.5px;padding:3px 8px;}
  .bl-fr{min-width:26px;}
  .bl-fr-m{font-size:11px;letter-spacing:0;}
  .bl-roll{min-width:150px;padding:11px 22px;font-size:16px;}
}
/* 手机竖屏统共 667 像素高,球道上面还压着标题栏,每一行都收一点 */
@media (max-height:720px){
  .bl-wrap{gap:5px;}
  .bl-chip{font-size:11px;padding:2px 7px;}
  .bl-tip{font-size:11.5px;line-height:1.35;padding:3px 9px;}
  .bl-gauge{height:18px;}
  .bl-needle{height:16px;}
  .bl-gauge-tag,.bl-gauge-val{line-height:18px;}
  .bl-roll{padding:10px 20px;}
}
@media (prefers-reduced-motion:reduce){
  .bl-btn:active,.bl-roll:active,.bl-pick:active,.bl-nudge button:active{transform:none;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("bl-style")) return;
  const style = document.createElement("style");
  style.id = "bl-style";
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

function button(cls: string, text: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.textContent = text;
  return btn;
}

// ---------------------------------------------------------------------------
// 投球台:三种玩法共用的一整局
// ---------------------------------------------------------------------------

export interface SeatPlan {
  name: string;
  emoji: string;
  color: string;
  /** null = 真人,数字 = 电脑档位 */
  ai: AiLevel | null;
}

export interface DeskResult {
  /** 每个座位的总分 */
  totals: number[];
  /** 每个座位打出的全中次数 */
  strikes: number[];
  /** 赢家座位号;只有一个人玩就是 0,打平是 -1 */
  winner: number;
}

interface DeskOpts {
  frames: number;
  seats: SeatPlan[];
  /** 这一格摆什么瓶 */
  kindsFor: (frame: number) => PinKind[];
  oil: number;
  banner: string;
  tip: string;
  /** 记分牌上显示的目标分(没有就不显示) */
  target?: number;
  sfx: (name: SoundName) => void;
  onDone: (res: DeskResult) => void;
}

interface Runner {
  destroy: () => void;
}

interface SeatRun {
  plan: SeatPlan;
  rolls: number[];
  /** 这一架瓶还站着哪几个 */
  standing: boolean[];
  kinds: PinKind[];
}

/** 方向键微调落点,一下挪这么多 */
const NUDGE_STEP = 0.06;

function createDesk(host: HTMLElement, opts: DeskOpts): Runner {
  ensureCss(host);
  const frames = Math.max(1, Math.round(opts.frames));
  const seats: SeatRun[] = opts.seats.map((plan) => ({
    plan,
    rolls: [],
    standing: new Array<boolean>(PINS).fill(true),
    kinds: opts.kindsFor(0),
  }));
  const solo = seats.length === 1;

  // ---- DOM -------------------------------------------------------------------
  const wrap = el("div", "bl-wrap");
  const hud = el("div", "bl-hud");
  const chipBanner = el("span", "bl-chip", opts.banner);
  const chipSeats = seats.map((_, i) => el("span", `bl-chip bl-chip-p${i}`, ""));
  const pauseBtn = button("bl-btn bl-btn--ghost", "⏸ 暂停");
  hud.append(chipBanner, ...chipSeats, pauseBtn);

  const laneBox = el("div", "bl-lane");
  const canvas = document.createElement("canvas");
  laneBox.appendChild(canvas);

  const card = el("div", "bl-card");
  const gauges = el("div", "bl-gauges");

  const gaugeOrder: Array<Exclude<Stage, "roll">> = ["power", "aim", "spin"];
  const gaugeEls = gaugeOrder.map((stage) => {
    const bar = el("div", `bl-gauge bl-gauge--${stage} bl-gauge--idle`);
    const tag = el("span", "bl-gauge-tag", STAGE_LABEL[stage]);
    const val = el("span", "bl-gauge-val", "");
    const needle = el("div", "bl-needle");
    bar.append(tag, val, needle);
    gauges.appendChild(bar);
    return { bar, val, needle };
  });

  const tip = el("div", "bl-tip", opts.tip);
  const controls = el("div", "bl-nudge");
  const leftBtn = button("", "◀");
  leftBtn.setAttribute("aria-label", "落点往左挪一点");
  const rollBtn = button("bl-roll", "🎳 停!");
  const rightBtn = button("", "▶");
  rightBtn.setAttribute("aria-label", "落点往右挪一点");
  controls.append(leftBtn, rollBtn, rightBtn);

  wrap.append(hud, laneBox, card, gauges, tip, controls);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 画面尺寸 ---------------------------------------------------------------
  // 球道横着画:球从左边出手,瓶阵在右边。这样 375 宽的手机也放得下整条道。
  const WORLD_W = DECK_END + 4;
  const WORLD_H = LANE_W;
  let scale = 3;

  function layout(): void {
    const avail = Math.max(240, Math.min(host.clientWidth || 360, 640));
    const roomH = Math.max(110, (window.innerHeight || 700) - 400);
    scale = Math.min(avail / WORLD_W, roomH / WORLD_H);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(WORLD_W * scale);
    const ch = Math.round(WORLD_H * scale);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    // 世界坐标 (laneX, laneY) → 画面 (laneY, laneX):把球道放倒
    g?.setTransform(0, dpr * scale, dpr * scale, 0, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
    render();
  };
  window.addEventListener("resize", onResize);

  // ---- 一局的状态 --------------------------------------------------------------
  let turnSeat = 0;
  let stage: Stage = "power";
  let stageStart = 0;
  let clock = 0;
  let pending: Shot = { power: 0.6, aim: 0, spin: 0 };
  let aimNudge = 0;
  let lane: LaneState | null = null;
  let paused = false;
  let finished = false;
  let waitUntil = 0;
  let aiThinkUntil = 0;
  /** 上一球算完了,等提示语念完再开下一球 */
  let awaitingNextShot = false;
  let toast = "";
  let toastUntil = 0;
  let shotSeed = 0;

  /** 下一球该谁投:格数落后的先投,一样多就按座位顺序 */
  function pickSeat(): number {
    let best = -1;
    let bestFrame = Number.POSITIVE_INFINITY;
    for (let i = 0; i < seats.length; i++) {
      const st = turnState(seats[i].rolls, frames);
      if (st.over) continue;
      if (st.frame < bestFrame) {
        bestFrame = st.frame;
        best = i;
      }
    }
    return best;
  }

  function currentSeat(): SeatRun {
    return seats[turnSeat];
  }

  function beginShot(): void {
    const seat = currentSeat();
    const st = turnState(seat.rolls, frames);
    if (st.freshRack) {
      seat.kinds = opts.kindsFor(st.frame);
      seat.standing = new Array<boolean>(PINS).fill(true);
    }
    aimNudge = 0;
    pending = { power: 0.6, aim: 0, spin: 0 };
    stage = "power";
    stageStart = clock;
    lane = null;
    if (seat.plan.ai) aiThinkUntil = clock + 700;
    refreshHud();
  }

  function stageValue(): number {
    if (stage === "roll") return 0;
    return sweep(clock - stageStart, STAGE_MS[stage]);
  }

  /** 按下确认:锁住当前这一段,进入下一段;三段都锁完就滚球 */
  function lockStage(): void {
    if (finished || paused || lane || stage === "roll") return;
    const v = stageValue();
    if (stage === "power") {
      pending.power = powerFromSweep(v);
      stage = "aim";
      stageStart = clock;
      opts.sfx("tap");
    } else if (stage === "aim") {
      pending.aim = aimFromSweep(v);
      stage = "spin";
      stageStart = clock;
      opts.sfx("tap");
    } else {
      pending.spin = spinFromSweep(v);
      stage = "roll";
      opts.sfx("jump");
      startRoll();
    }
    refreshGauges();
  }

  /** 退回上一段重新来 */
  function stepBack(): void {
    if (finished || paused || lane || stage === "roll") return;
    if (stage === "power") return;
    stage = stage === "spin" ? "aim" : "power";
    stageStart = clock;
    opts.sfx("tap");
    refreshGauges();
  }

  function nudge(dir: -1 | 1): void {
    if (finished || paused || lane) return;
    aimNudge = clamp(aimNudge + dir * NUDGE_STEP, -0.3, 0.3);
    opts.sfx("tap");
    refreshHud();
  }

  function startRoll(): void {
    const seat = currentSeat();
    const shot: Shot = {
      power: pending.power,
      aim: clamp(pending.aim + aimNudge, -1, 1),
      spin: pending.spin,
    };
    lane = createLane({ standing: seat.standing.slice(), kinds: seat.kinds, oil: opts.oil }, shot);
    shotSeed++;
  }

  function finishRoll(): void {
    if (!lane) return;
    const seat = currentSeat();
    const st = turnState(seat.rolls, frames);
    const knocked = downFlags(lane).filter(Boolean).length;
    const gutter = lane.ball.gutter;
    seat.standing = standingAfter(lane);
    seat.rolls.push(knocked);
    lane = null;

    if (knocked === PINS && st.ball === 0) opts.sfx("win");
    else if (knocked > 0) opts.sfx("coin");
    else opts.sfx("oops");
    toast = `${seat.plan.emoji}${seat.plan.name}:${shotLine(knocked, st.ball === 0, gutter)}`;
    toastUntil = clock + 1500;

    refreshCard();
    refreshHud();

    const next = pickSeat();
    if (next < 0) {
      settle();
      return;
    }
    turnSeat = next;
    waitUntil = clock + 900;
    awaitingNextShot = true;
  }

  function settle(): void {
    if (finished) return;
    finished = true;
    const totals = seats.map((s) => totalScore(s.rolls, frames));
    const strikes = seats.map((s) =>
      scoreGame(s.rolls, frames).frames.filter((f) => f.kind === "strike").length
    );
    let winner = 0;
    if (!solo) {
      if (totals[0] === totals[1]) winner = -1;
      else winner = totals[0] > totals[1] ? 0 : 1;
    }
    opts.onDone({ totals, strikes, winner });
  }

  // ---- 记分牌 ------------------------------------------------------------------
  const cardCells: Array<{ box: HTMLElement; marks: HTMLElement; score: HTMLElement }[]> = [];

  function buildCard(): void {
    card.innerHTML = "";
    cardCells.length = 0;
    for (let s = 0; s < seats.length; s++) {
      const row: Array<{ box: HTMLElement; marks: HTMLElement; score: HTMLElement }> = [];
      const strip = el("div", "bl-card");
      for (let f = 0; f < frames; f++) {
        const box = el("div", "bl-fr");
        const n = el("div", "bl-fr-n", solo ? String(f + 1) : `${seats[s].plan.emoji}${f + 1}`);
        const marks = el("div", "bl-fr-m", "");
        const score = el("div", "bl-fr-s", "");
        box.append(n, marks, score);
        strip.appendChild(box);
        row.push({ box, marks, score });
      }
      cardCells.push(row);
      card.appendChild(strip);
    }
    if (seats.length > 1) card.style.flexDirection = "column";
  }

  function refreshCard(): void {
    for (let s = 0; s < seats.length; s++) {
      const sheet = scoreGame(seats[s].rolls, frames);
      const now = turnState(seats[s].rolls, frames);
      sheet.frames.forEach((frame: FrameScore, f: number) => {
        const cell = cardCells[s]?.[f];
        if (!cell) return;
        cell.marks.textContent = frameMarks(frame);
        cell.score.textContent = frame.running === null ? "" : String(frame.running);
        cell.box.classList.toggle("bl-fr-now", !now.over && now.frame === f && turnSeat === s);
      });
    }
  }

  // ---- HUD --------------------------------------------------------------------
  function refreshHud(): void {
    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const sheet = scoreGame(seat.rolls, frames);
      const who = seat.plan.ai ? `🤖${seat.plan.name}` : `${seat.plan.emoji}${seat.plan.name}`;
      const mark = !finished && turnSeat === i ? " ◀" : "";
      // 有奖励的那几格要等后面的球才结算,所以另外报一句「已经打倒多少瓶」,
      // 免得刚打了七瓶还看见 0 分,小朋友以为是坏了
      const pins = seat.rolls.reduce((s, v) => s + v, 0);
      const pending = sheet.complete ? "" : ` · 已倒 ${pins} 瓶`;
      chipSeats[i].textContent = `${who} ${sheet.total} 分${pending}${mark}`;
      chipSeats[i].classList.toggle("bl-chip-now", !finished && turnSeat === i);
    }
    const st = turnState(currentSeat().rolls, frames);
    const nudgeText = aimNudge === 0 ? "" : ` · 落点微调 ${aimNudge > 0 ? "右" : "左"}${Math.round(Math.abs(aimNudge) / NUDGE_STEP)}`;
    chipBanner.textContent = opts.target
      ? `${opts.banner} · 目标 ${opts.target} 分 · 第 ${Math.min(st.frame + 1, frames)}/${frames} 格${nudgeText}`
      : `${opts.banner} · 第 ${Math.min(st.frame + 1, frames)}/${frames} 格${nudgeText}`;
    rollBtn.className = `bl-roll${turnSeat === 1 ? " bl-roll--p1" : ""}`;
    const ai = Boolean(currentSeat().plan.ai);
    rollBtn.disabled = ai || Boolean(lane) || finished;
    rollBtn.textContent = ai ? "🤖 电脑在瞄" : lane ? "🎳 球滚出去啦" : `🎳 停!(${STAGE_LABEL[stage === "roll" ? "power" : stage]})`;
  }

  function refreshGauges(): void {
    const live = stageValue();
    gaugeOrder.forEach((name, i) => {
      const ui = gaugeEls[i];
      const active = stage === name && !lane;
      const locked =
        (name === "power" && (stage === "aim" || stage === "spin" || stage === "roll")) ||
        (name === "aim" && (stage === "spin" || stage === "roll")) ||
        (name === "spin" && stage === "roll");
      const v = active ? live : locked ? (name === "power" ? pending.power : (name === "aim" ? pending.aim : pending.spin) / 2 + 0.5) : 0;
      ui.needle.style.left = `${clamp(v, 0, 1) * 100}%`;
      ui.bar.classList.toggle("bl-gauge--idle", !active && !locked);
      ui.bar.classList.toggle("bl-gauge--done", locked);
      if (name === "power") ui.val.textContent = locked ? `${Math.round(pending.power * 100)}%` : "";
      else if (name === "aim") ui.val.textContent = locked ? (pending.aim >= 0 ? `偏右 ${pending.aim.toFixed(2)}` : `偏左 ${(-pending.aim).toFixed(2)}`) : "";
      else ui.val.textContent = locked ? (pending.spin >= 0 ? `右旋 ${pending.spin.toFixed(2)}` : `左旋 ${(-pending.spin).toFixed(2)}`) : "";
    });
  }

  // ---- 画面 --------------------------------------------------------------------
  function pinFace(kind: PinKind): string {
    return PIN_TRAITS[kind].emoji;
  }

  function render(): void {
    if (!g) return;
    g.clearRect(0, 0, WORLD_W, WORLD_H);
    // 球道
    g.fillStyle = "#f7e6c8";
    g.fillRect(0, 0, WORLD_W, WORLD_H);
    // 两侧球沟
    g.fillStyle = "#cfd6e6";
    g.fillRect(0, 0, WORLD_W, GUTTER_EDGE);
    g.fillRect(0, WORLD_H - GUTTER_EDGE, WORLD_W, GUTTER_EDGE);
    // 打油区:油越厚越亮,一眼看出这一关拐不拐得动
    g.fillStyle = `rgba(180,205,255,${0.1 + opts.oil * 0.3})`;
    g.fillRect(0, GUTTER_EDGE, DECK_END * 0.62, WORLD_H - GUTTER_EDGE * 2);
    // 犯规线与瓶台
    g.fillStyle = "#e0c79a";
    g.fillRect(HEAD_Y - 8, GUTTER_EDGE, WORLD_W - HEAD_Y + 8, WORLD_H - GUTTER_EDGE * 2);
    g.fillStyle = "#d8b98a";
    g.fillRect(1.4, GUTTER_EDGE, 0.8, WORLD_H - GUTTER_EDGE * 2);

    // 瞄准辅助线:落点定下来之后画出球出手的那条直线
    const seat = currentSeat();
    if (!lane && !finished && (stage === "spin" || stage === "roll")) {
      const x = releaseX(clamp(pending.aim + aimNudge, -1, 1));
      g.strokeStyle = "rgba(232,85,143,.55)";
      g.lineWidth = 0.6;
      g.setLineDash([2, 2]);
      g.beginPath();
      g.moveTo(0, x);
      g.lineTo(HEAD_Y, x);
      g.stroke();
      g.setLineDash([]);
    }

    // 瓶
    const pins = lane ? lane.pins : null;
    for (let i = 0; i < PINS; i++) {
      const kind = seat.kinds[i] ?? "wood";
      let px: number;
      let py: number;
      let down: boolean;
      let here: boolean;
      if (pins) {
        const pin = pins[i];
        px = pin.x;
        py = pin.y;
        down = pin.down || pinShift(pin) > 0.6;
        here = !pin.gone;
      } else {
        const home = pinSpot(i);
        px = home.x;
        py = home.y;
        down = false;
        here = seat.standing[i];
      }
      if (!here) continue;
      g.save();
      g.globalAlpha = down ? 0.4 : 1;
      g.fillStyle = down ? "#c9c2d8" : "#ffffff";
      g.beginPath();
      g.arc(py, px, PIN_R, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = down ? "#b3abc6" : "#e5638f";
      g.lineWidth = 0.5;
      g.stroke();
      g.restore();
      if (kind !== "wood") {
        g.save();
        g.translate(py, px);
        g.rotate(Math.PI / 2);
        g.globalAlpha = down ? 0.45 : 1;
        g.font = `${PIN_R * 1.7}px "Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(pinFace(kind), 0, 0);
        g.restore();
      }
    }

    // 球
    if (lane && !lane.ball.gone) {
      const b = lane.ball;
      g.fillStyle = seat.plan.color;
      g.beginPath();
      g.arc(b.y, b.x, BALL_R, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffffaa";
      g.beginPath();
      g.arc(b.y - BALL_R * 0.3, b.x - BALL_R * 0.3, BALL_R * 0.3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ---- 遮罩与暂停 ---------------------------------------------------------------
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    if (!paused) {
      clearVeil();
      return;
    }
    clearVeil();
    const box = el("div", "bl-veil");
    box.append(
      el("div", "bl-veil-t", "⏸ 休息一下"),
      el(
        "div",
        "bl-veil-s",
        "按 Esc 或点「继续」接着投。朵朵用 F 停指针、G 退回上一段;星星用 L 停指针、K 退回上一段,方向键左右微调落点。"
      )
    );
    const row = el("div", "bl-veil-btns");
    const go = button("bl-btn", "▶ 继续");
    go.addEventListener("click", () => {
      opts.sfx("tap");
      togglePause();
    });
    row.appendChild(go);
    box.appendChild(row);
    wrap.appendChild(box);
    veil = box;
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- 输入 --------------------------------------------------------------------
  const humanSeats = seats.filter((s) => !s.plan.ai).length;

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (isPauseKey(ev.code)) {
      ev.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(ev.code, humanSeats);
    if (!hit) return;
    // 双人对战时只认「轮到的那个人」的键,免得对面乱按
    if (humanSeats > 1 && hit.player !== turnSeat) return;
    if (currentSeat().plan.ai) return;
    ev.preventDefault();
    if (hit.action === "confirm") lockStage();
    else if (hit.action === "cancel") stepBack();
    else if (hit.action === "left") nudge(-1);
    else if (hit.action === "right") nudge(1);
  };
  window.addEventListener("keydown", onKeyDown);

  rollBtn.addEventListener("click", () => lockStage());
  leftBtn.addEventListener("click", () => nudge(-1));
  rightBtn.addEventListener("click", () => nudge(1));
  const onLaneTap = (ev: PointerEvent): void => {
    ev.preventDefault();
    lockStage();
  };
  canvas.addEventListener("pointerdown", onLaneTap);

  // ---- 主循环 -------------------------------------------------------------------
  let raf = 0;
  let last = 0;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.max(0, Math.min(48, now - last));
    last = now;
    if (finished) {
      render();
      return;
    }
    if (!paused) {
      clock += dt;
      if (lane) {
        // stepLane 单步最多推进 8ms,一帧要补几步才跟得上真实时间
        let rest = dt;
        while (rest > 0 && !lane.settled) {
          stepLane(lane, Math.min(8, rest));
          rest -= 8;
        }
        if (lane.settled) finishRoll();
      } else if (clock >= waitUntil) {
        if (awaitingNextShot) {
          awaitingNextShot = false;
          beginShot();
        }
        const seat = currentSeat();
        // 电脑不用三段式,想一小会儿就直接投
        if (seat.plan.ai && stage !== "roll" && clock >= aiThinkUntil) {
          const st = turnState(seat.rolls, frames);
          pending = aiShot(seat.standing, seat.plan.ai, shotSeed * 7 + st.frame * 3 + st.ball);
          aimNudge = 0;
          stage = "roll";
          startRoll();
        }
      }
    }
    refreshGauges();
    refreshHud();
    tip.textContent = clock < toastUntil ? toast : opts.tip;
    render();
  }

  // 开局
  buildCard();
  beginShot();
  refreshCard();
  refreshGauges();
  render();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onLaneTap);
      clearVeil();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关(188 关)
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const lv = buildLevel(ctx.level);
  const chapter = CHAPTERS[chapterOfLevel(lv.index)];
  const desk = createDesk(stage, {
    frames: lv.frames,
    seats: [{ name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null }],
    kindsFor: () => lv.kinds,
    oil: lv.oil,
    banner: `${chapter.emoji} 第 ${lv.index + 1} 关`,
    tip: lv.hint,
    target: lv.target,
    sfx: ctx.sfx,
    onDone: (res) => {
      const score = res.totals[0];
      if (score >= lv.target) ctx.win(rateLevel(score, lv.target), winLine(score, lv.target, res.strikes[0]));
      else ctx.lose(loseLine(score, lv.target));
    },
  });
  return { destroy: () => desk.destroy() };
}

// ---------------------------------------------------------------------------
// 模式外壳:统一的「◀ 回选关 + 标题 + 舞台」
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "bl-mode");
  const head = el("div", "bl-mhead");
  const back = button("bl-back", "◀ 回选关");
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "bl-chip", title);
  head.append(back, chip);
  const stage = el("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return { stage, chip, destroy: () => wrap.remove() };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
): void {
  stage.innerHTML = "";
  const box = el("div", "bl-veil");
  box.style.position = "static";
  box.append(el("div", "bl-veil-t", title), el("div", "bl-veil-s", sub));
  const row = el("div", "bl-veil-btns");
  for (const b of buttons) {
    const btn = button(`bl-btn${b.ghost ? " bl-btn--ghost" : ""}`, b.label);
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 双人对战:整整十格,轮流投
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void, aiSkill: AiLevel | null): { destroy: () => void } {
  const label = aiSkill ? `🤖 人机对战 · ${AI_LABEL[aiSkill]}` : "⚔️ 双人对战";
  const shell = makeShell(host, api, onBack, label);
  let desk: Runner | null = null;
  let round = 1;

  function start(): void {
    desk?.destroy();
    shell.stage.innerHTML = "";
    const vs = buildVersus(round);
    shell.chip.textContent = `${label} · ${vs.name} · 第 ${round} 局`;
    desk = createDesk(shell.stage, {
      frames: vs.frames,
      seats: [
        { name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null },
        aiSkill
          ? { name: AI_LABEL[aiSkill], emoji: "🤖", color: P_COLOR[1], ai: aiSkill }
          : { name: P_NAME[1], emoji: P_EMOJI[1], color: P_COLOR[1], ai: null },
      ],
      kindsFor: () => vs.kinds,
      oil: vs.oil,
      banner: `${vs.name} · 第 ${round} 局`,
      tip: aiSkill
        ? `${vs.hint} 朵朵:F 停指针、G 退回上一段,方向键左右微调落点。`
        : `${vs.hint} 朵朵:F/G;星星:L/K。轮到谁,谁的键才管用。`,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        desk?.destroy();
        desk = null;
        const names = [P_NAME[0], aiSkill ? AI_LABEL[aiSkill] : P_NAME[1]];
        const line = versusLine(res.totals, names);
        if (res.winner >= 0) {
          api.play("win");
          api.addStars(2);
        } else {
          api.play("meow");
          api.addStars(1);
        }
        const title = res.winner < 0 ? "🤝 打成平手!" : `🏆 ${names[res.winner]}赢了这一局!`;
        overBox(shell.stage, title, `${line}。换一张球道再来一局,油量和瓶型都不一样。`, [
          {
            label: "▶ 换一张球道",
            onClick: () => {
              api.play("tap");
              round++;
              start();
            },
          },
          { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
        ]);
      },
    });
  }

  start();

  return {
    destroy() {
      desk?.destroy();
      desk = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:一格一格往下打,没够到目标分就结束
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽格");
  let desk: Runner | null = null;
  let frame = 1;
  let best = save.getGameProgress(meta.id).endlessBest;

  function start(): void {
    desk?.destroy();
    shell.stage.innerHTML = "";
    const setup = buildEndlessFrame(frame);
    shell.chip.textContent = `♾️ 无尽格 · 第 ${frame} 格 · 最好 ${best} 格`;
    desk = createDesk(shell.stage, {
      frames: 1,
      seats: [{ name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null }],
      kindsFor: () => setup.kinds,
      oil: setup.oil,
      banner: `第 ${frame} 格`,
      tip: `${setup.hint} 这一格要拿到 ${setup.target} 分才能继续。`,
      target: setup.target,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const score = res.totals[0];
        if (score >= setup.target) {
          best = save.recordEndlessBest(meta.id, frame);
          api.addStars(1);
          frame++;
          start();
          return;
        }
        const reached = Math.max(0, frame - 1);
        best = save.recordEndlessBest(meta.id, reached);
        desk?.destroy();
        desk = null;
        api.play("oops");
        overBox(
          shell.stage,
          "🎳 这一格没够到目标分",
          `第 ${frame} 格拿了 ${score} 分,差 ${Math.max(0, setup.target - score)} 分。${endlessLine(reached, best)}`,
          [
            {
              label: "🔁 从第 1 格再来",
              onClick: () => {
                api.play("tap");
                frame = 1;
                start();
              },
            },
            { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
          ]
        );
      },
    });
  }

  start();

  return {
    destroy() {
      desk?.destroy();
      desk = null;
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
  const bar = el("div", "bl-bar");
  const picks = el("div", "bl-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let aiSkill: AiLevel = 2;

  const vsBtn = button("bl-open", "⚔️ 双人对战");
  const aiBtn = button("bl-open bl-open--ai", "🤖 人机对战");
  const endlessBtn = button("bl-open bl-open--en", "♾️ 无尽格");
  bar.append(vsBtn, aiBtn, endlessBtn);

  const pickBtns: HTMLButtonElement[] = [];
  ([1, 2, 3] as AiLevel[]).forEach((skill) => {
    const btn = button("bl-pick", `🤖 ${AI_LABEL[skill]}`);
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
    endlessBtn.textContent = best > 0 ? `♾️ 无尽格 · 最好 ${best} 格` : "♾️ 无尽格";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[aiSkill]}`;
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

  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, null)));
  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, aiSkill)));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来:手机竖屏上这一百来像素正好够球道和三条指针同框
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
      mapHint: "口袋在头瓶稍微偏右那条缝,正对头瓶撞过去反而会剩角瓶。",
      grandMessage: "188 关全部通关,保龄球小馆的口袋位已经被你摸透啦!",
      guideTitle: "保龄球小馆 · 投球手册",
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
