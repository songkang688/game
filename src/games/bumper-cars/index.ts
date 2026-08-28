import { meta } from "./meta";
export { meta };

// 碰碰车大乱斗:俯视撞人擂台。
//
// 四种玩法共用同一套对局运行时 `createMatch`:
//  - 闯关:188 关八大主题,每关场地、护栏、加速带、滚桶和对手阵容都不一样(走 level99 框架);
//  - 双人对战:同屏两人各开一台车,先赢 3 局;
//  - 人机对战:三档电脑车手,高档会绕到你的悬崖侧再发力;
//  - 无尽车海:一波比一波多,撑到撑不住为止。
//
// 全程没有血也没有伤:被顶出场地只是转一圈再开回来,生命用光就是这一局结束。
import { save } from "../../engine/save";
import { stagePlayRoom } from "../../engine/stageRoom";
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { AI_LABEL, AI_LEVELS, chooseCarAction, huntersFor, type AiLevel } from "./ai";
import GUIDE from "./guide";
import { CHAPTERS, buildArena, buildLevel, buildWave, type CarLevel } from "./levels";
import { shade, withAlpha } from "../../art/kit/palette";
import { drawParticles, spawnSparkles, stepParticles, type Particle } from "../../art/kit/sparkle";
import {
  BC_COLORS,
  BC_GOLD,
  BUMP_STAR_COUNT,
  BUMP_STAR_LIFE_MS,
  BUMP_STAR_LIFE_REDUCED_MS,
  drawBarrel,
  drawBulb,
  drawBumperCar,
  drawChargeTrack,
  drawDizzyStars,
  drawFloorGlow,
  drawLampPost,
  drawParachuteCar,
  drawSoapSlick,
  drawSweat,
  drawTurntable,
  flagSwing,
  flowPhase,
  lampOn,
  padFlow,
  parachuteProgress,
  squashAmount,
} from "./visual13";
import {
  CHARGE_MIN_MS,
  CHARGE_MS,
  SKID_MS,
  TEETER_MS,
  axisFromHeld,
  chargeRatio,
  createWorld,
  endlessLine,
  fieldCenter,
  fieldRadius,
  foesGone,
  formatClock,
  hypot,
  inArc,
  isPauseKey,
  keyToAction,
  lastTeamStanding,
  levelCleared,
  levelForfeit,
  loseLine,
  makeCar,
  matchWinner,
  playerDown,
  rateLevel,
  secondsLeft,
  stepWorld,
  stickVector,
  timeUp,
  versusLine,
  winLine,
  type Car,
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
.bc-wrap{--bc-ink:#4a4266;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--bc-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  /* 1.3 手机端修复:壳只留 pan-y——舞台竖着能滚,手指落在壳上得划得动;
     吃拖动手势的摇杆(.bc-stick)与按住不放的冲撞/刹车键各自挂 touch-action:none */
  touch-action:pan-y;position:relative;}
.bc-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
/* 比分与剩余车数走这个芯片。规格第八节要求字号 ≥ 14px:这是比赛里唯一
   要用余光扫的数字,再小就得低头找,所以下面两个 @media 只收内边距,不动字号。 */
.bc-chip{background:#fff;border:1px solid rgba(120,110,170,.14);border-radius:999px;padding:4px 10px;font-size:14px;
  font-weight:800;white-space:nowrap;box-shadow:0 2px 5px rgba(120,110,170,.18);}
.bc-chip-p0{color:#a8306a;background:#ffeaf3;}
.bc-chip-p1{color:#28568f;background:#e6f0ff;}
.bc-btn{border:none;border-radius:999px;padding:6px 13px;min-height:44px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#e07aa8,#c8558a);box-shadow:0 3px 0 #a03f6d;}
.bc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #a03f6d;}
.bc-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bc-btn--ghost{background:linear-gradient(180deg,#9db6d8,#7f9ac3);box-shadow:0 3px 0 #64809f;}
.bc-btn--ghost:active{box-shadow:0 1px 0 #64809f;}
.bc-arena{border-radius:18px;overflow:hidden;box-shadow:0 6px 16px rgba(110,100,160,.22);line-height:0;}
.bc-arena canvas{display:block;}
.bc-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:620px;color:#6a5f8c;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
.bc-pads{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;width:100%;}
.bc-padwrap{display:flex;align-items:center;gap:9px;}
.bc-stick{width:104px;height:104px;border-radius:50%;position:relative;touch-action:none;cursor:pointer;
  background:radial-gradient(circle at 50% 40%,#ffffff,#f0ecfa);box-shadow:inset 0 2px 8px rgba(120,110,170,.25);}
.bc-stick--p0{box-shadow:inset 0 2px 8px rgba(200,85,138,.28);}
.bc-stick--p1{box-shadow:inset 0 2px 8px rgba(63,127,214,.28);}
.bc-knob{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
  pointer-events:none;background:linear-gradient(180deg,#ffffff,#e7e0f5);box-shadow:0 3px 7px rgba(90,80,140,.3);
  display:flex;align-items:center;justify-content:center;font-size:19px;}
.bc-acts{display:flex;flex-direction:column;gap:6px;}
/* 冲撞键与刹车键是手指全程按住的两颗,热区不许低于 44px(规格第八节)。
   下面窄屏 / 矮屏两档只收宽度和字号,高度锁死 44。 */
.bc-acts button{border:none;border-radius:13px;height:44px;min-height:44px;width:60px;font-size:13px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#fff;line-height:1.2;
  touch-action:none;}
.bc-acts button:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bc-acts--p0 button{background:linear-gradient(180deg,#f79ac0,#e8558f);box-shadow:0 3px 0 #bf3a70;}
.bc-acts--p1 button{background:linear-gradient(180deg,#8db6ec,#3f7fd6);box-shadow:0 3px 0 #2f63aa;}
.bc-acts button:active{transform:translateY(2px);}
.bc-padname{font-size:11.5px;font-weight:900;text-align:center;}
.bc-veil{position:absolute;inset:0;background:rgba(255,252,255,.94);border-radius:18px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.bc-veil-t{font-size:20px;font-weight:900;color:#a8306a;}
.bc-veil-s{font-size:13.5px;font-weight:700;color:#6f6390;line-height:1.6;max-width:340px;}
.bc-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.bc-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#fff3f8,#f2f5ff);display:flex;flex-direction:column;gap:8px;}
.bc-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.bc-back{border:none;border-radius:999px;padding:6px 12px;min-height:44px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#a8306a;box-shadow:0 3px 0 rgba(180,90,140,.28);}
.bc-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(180,90,140,.28);}
.bc-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bc-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.bc-bar[hidden],.bc-picks[hidden]{display:none;}
.bc-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#e07aa8,#c8558a);box-shadow:0 4px 0 #a03f6d;
  min-height:44px;box-sizing:border-box;}
.bc-open:active{transform:translateY(2px);box-shadow:0 2px 0 #a03f6d;}
.bc-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bc-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.bc-open--en{background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.bc-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.bc-pick{border:none;border-radius:14px;padding:7px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#5b4a7a;box-shadow:0 3px 0 rgba(140,120,190,.35);
  min-height:44px;box-sizing:border-box;}
.bc-pick[aria-pressed="true"]{background:linear-gradient(180deg,#e07aa8,#c8558a);color:#fff;box-shadow:0 3px 0 #a03f6d;}
.bc-pick:active{transform:translateY(2px);}
.bc-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
@media (max-width:420px){
  .bc-stick{width:92px;height:92px;}
  .bc-knob{width:38px;height:38px;margin:-19px 0 0 -19px;font-size:17px;}
  .bc-acts button{height:44px;width:54px;font-size:12px;}
  .bc-chip{padding:3px 8px;}
  .bc-pads{gap:9px;}
}
/* 手机竖屏一共 667 像素高,场地上面还压着标题栏。每一行都收一点,
   保证摇杆整块留在首屏里,不用一边滚屏一边躲对手。 */
@media (max-height:720px){
  .bc-wrap{gap:5px;}
  .bc-chip{padding:2px 7px;}
  .bc-btn{padding:5px 11px;min-height:44px;font-size:12px;}
  .bc-back{min-height:44px;}
  .bc-tip{font-size:11.5px;line-height:1.35;padding:3px 9px;}
  .bc-stick{width:86px;height:86px;}
  .bc-knob{width:36px;height:36px;margin:-18px 0 0 -18px;}
  .bc-acts button{height:44px;width:52px;font-size:11.5px;}
}
@media (max-height:500px) and (min-width:640px){
  .bc-pads{position:sticky;bottom:0;z-index:3;background:linear-gradient(180deg,transparent,#f2f5ff);}
}
@media (max-height:840px){
  .bc-pads{position:sticky;bottom:0;z-index:3;background:linear-gradient(180deg,transparent,#f2f5ff);}
}
@media (prefers-reduced-motion:reduce){
  .bc-btn:active,.bc-acts button:active,.bc-pick:active{transform:none;}
}
/* ---- 1.2 新增(bpc- 前缀):冲撞键的蓄力条 ---- */
.bpc-hit{position:relative;overflow:hidden;}
.bpc-hit-t{position:relative;z-index:2;}
.bpc-hit-bar{position:absolute;left:0;bottom:0;height:5px;width:0;background:#ffd166;border-radius:0 3px 3px 0;
  z-index:1;}
.bpc-hit--full .bpc-hit-bar{background:#ff8a3d;}
.bpc-hit--cd{opacity:.55;}
.bpc-legend{font-size:11.5px;font-weight:800;color:#7b6f9e;text-align:center;line-height:1.5;max-width:620px;}
@media (max-width:420px){
  .bpc-legend{font-size:11px;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("bc-style")) return;
  const style = document.createElement("style");
  style.id = "bc-style";
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
// 触屏摇杆
// ---------------------------------------------------------------------------

interface Stick {
  root: HTMLElement;
  /** 当前摇杆方向(-1..1),没按就是 0 */
  value: { dx: number; dy: number };
  reset: () => void;
  destroy: () => void;
}

function makeStick(player: 0 | 1): Stick {
  const root = el("div", `bc-stick bc-stick--p${player}`);
  root.setAttribute("role", "application");
  root.setAttribute("aria-label", `${P_NAME[player]}的方向摇杆`);
  const knob = el("div", "bc-knob", P_EMOJI[player]);
  root.appendChild(knob);
  const value = { dx: 0, dy: 0 };
  let active = -1;

  function place(dx: number, dy: number): void {
    const r = root.clientWidth / 2 || 52;
    const v = stickVector(dx, dy, r * 0.72);
    value.dx = v.dx;
    value.dy = v.dy;
    const len = Math.min(1, hypot(dx, dy) / Math.max(1, r * 0.72));
    knob.style.transform = `translate(${v.dx * len * r * 0.52}px,${v.dy * len * r * 0.52}px)`;
  }

  function reset(): void {
    value.dx = 0;
    value.dy = 0;
    active = -1;
    knob.style.transform = "";
  }

  function localOffset(ev: PointerEvent): { dx: number; dy: number } {
    const box = root.getBoundingClientRect();
    return { dx: ev.clientX - (box.left + box.width / 2), dy: ev.clientY - (box.top + box.height / 2) };
  }

  const onDown = (ev: PointerEvent): void => {
    active = ev.pointerId;
    root.setPointerCapture?.(ev.pointerId);
    const o = localOffset(ev);
    place(o.dx, o.dy);
    ev.preventDefault();
  };
  const onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== active) return;
    const o = localOffset(ev);
    place(o.dx, o.dy);
    ev.preventDefault();
  };
  const onUp = (ev: PointerEvent): void => {
    if (ev.pointerId !== active) return;
    reset();
  };

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);

  return {
    root,
    value,
    reset,
    destroy() {
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 对局运行时
// ---------------------------------------------------------------------------

export interface MatchResult {
  cleared: boolean;
  /** empty = 对手全自己开下去了,一台都不是玩家顶的:场面清空了,但这一关不算赢 */
  reason: "clear" | "fall" | "time" | "empty";
  secondsLeft: number;
  totalSeconds: number;
  /** 玩家掉下去几次 */
  falls: number;
  /** 玩家撞飞几台 */
  knocked: number;
  /** 对战的胜者座位号;没分出来是 -1 */
  winner: number;
}

interface MatchOpts {
  level: CarLevel;
  mode: "campaign" | "versus" | "ai" | "endless";
  /** 同屏真人数量 */
  humans: 1 | 2;
  /** 人机对战时 1 号座位的档位 */
  aiSkill?: AiLevel;
  banner: string;
  tip: string;
  sfx: (name: SoundName) => void;
  onDone: (res: MatchResult) => void;
}

interface Runner {
  destroy: () => void;
  pause: () => void;
}

const ARROW_KEYS: InputName[] = ["up", "right", "down", "left"];

function createMatch(host: HTMLElement, opts: MatchOpts): Runner {
  ensureCss(host);
  const lv = opts.level;
  const duel = opts.mode === "versus" || opts.mode === "ai";
  const seats = duel ? 2 : 1;

  // ---- 车 -------------------------------------------------------------------
  const cars: Car[] = [
    makeCar({
      id: 0,
      name: P_NAME[0],
      emoji: P_EMOJI[0],
      color: P_COLOR[0],
      team: 0,
      x: lv.spawn.x,
      y: lv.spawn.y,
      lives: lv.hearts,
    }),
  ];
  if (duel) {
    const spot = lv.foeSpawns[0] ?? lv.spawn;
    cars.push(
      makeCar({
        id: 1,
        name: P_NAME[1],
        emoji: P_EMOJI[1],
        color: P_COLOR[1],
        team: 1,
        x: spot.x,
        y: spot.y,
        lives: lv.hearts,
        ai: opts.mode === "ai",
      })
    );
  } else {
    lv.foes.forEach((foe, i) => {
      const spot = lv.foeSpawns[i] ?? lv.foeSpawns[0] ?? lv.spawn;
      cars.push(
        makeCar({
          id: i + 1,
          name: foe.name,
          emoji: foe.emoji,
          color: foe.color,
          team: 1,
          x: spot.x,
          y: spot.y,
          lives: foe.lives,
          mass: foe.mass,
          r: foe.r,
          ai: true,
        })
      );
    });
  }

  const world: World = createWorld({
    field: lv.field,
    cars,
    pads: lv.pads,
    hazards: lv.hazards,
    spinners: lv.spinners,
    slicks: lv.slicks,
    limit: lv.seconds > 0 ? lv.seconds * 1000 : 0,
    keep: lv.keep,
    seed: lv.seed,
  });

  const foeSkills: AiLevel[] = duel
    ? [1, opts.aiSkill ?? 2]
    : [1, ...lv.foes.map((f) => f.skill)];

  // ---- DOM ------------------------------------------------------------------
  const wrap = el("div", "bc-wrap");
  const hud = el("div", "bc-hud");
  const chipBanner = el("span", "bc-chip", opts.banner);
  const chipTime = el("span", "bc-chip", "⏱ 0:00");
  const chipStats: HTMLElement[] = [];
  const statSeats = duel ? 2 : 1;
  for (let i = 0; i < statSeats; i++) chipStats.push(el("span", `bc-chip bc-chip-p${i}`, ""));
  const chipFoes = el("span", "bc-chip", "");
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "bc-btn bc-btn--ghost";
  pauseBtn.textContent = "⏸ 暂停";
  hud.append(chipBanner, chipTime, ...chipStats);
  if (!duel) hud.appendChild(chipFoes);
  hud.appendChild(pauseBtn);

  const arena = el("div", "bc-arena");
  const canvas = document.createElement("canvas");
  arena.appendChild(canvas);
  const tip = el("div", "bc-tip", opts.tip);
  const pads = el("div", "bc-pads");
  const legend = el(
    "div",
    "bpc-legend",
    "💥 轻点 = 小冲刺,按住 0.8 秒 = 蓄力强撞(蓄力时车会慢下来)· 滑到场边会打转两秒,往场内打方向就能开回来"
  );
  wrap.append(hud, arena, tip, pads, legend);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // 关掉动效的孩子:旋转盘不转、车身不形变、撞击不顿帧
  const spinArt = !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---- 输入 ------------------------------------------------------------------
  const held: boolean[][] = [
    [false, false, false, false],
    [false, false, false, false],
  ];
  // 一个「冲撞键」两种用法:轻点是小冲刺,按住 220ms 以上是蓄力强撞。
  // hold 记的是按下的时刻,dashOnce 是这一帧要放出去的小冲刺。
  const btnHeld = [
    { dash: false, brake: false, holdAt: 0, charging: false, dashOnce: false },
    { dash: false, brake: false, holdAt: 0, charging: false, dashOnce: false },
  ];
  const sticks: Stick[] = [];
  const hitBtns: HTMLButtonElement[] = [];

  function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  /** 按下冲撞键 */
  function pressHit(player: 0 | 1): void {
    const b = btnHeld[player];
    if (b.charging) return;
    b.charging = true;
    b.holdAt = nowMs();
  }

  /** 松开冲撞键:按得短就是轻冲刺,按得久让 logic 层去结算蓄力 */
  function releaseHit(player: 0 | 1): void {
    const b = btnHeld[player];
    if (!b.charging) return;
    b.charging = false;
    if (nowMs() - b.holdAt < CHARGE_MIN_MS) b.dashOnce = true;
    b.holdAt = 0;
  }

  for (let p = 0; p < seats; p++) {
    if (duel && cars[p]?.ai) continue;
    const player = p as 0 | 1;
    const box = el("div", "bc-padwrap");
    const stick = makeStick(player);
    sticks[player] = stick;
    const acts = el("div", `bc-acts bc-acts--p${player}`);
    const hit = document.createElement("button");
    hit.type = "button";
    hit.className = "bpc-hit";
    hit.innerHTML = "";
    hit.append(el("span", "bpc-hit-t", "💥冲撞"), el("span", "bpc-hit-bar"));
    hit.setAttribute("aria-label", `${P_NAME[player]}的冲撞键:轻点小冲刺,按住蓄力强撞`);
    const brake = document.createElement("button");
    brake.type = "button";
    brake.textContent = "🛑刹车";
    hit.addEventListener("pointerdown", (ev) => {
      pressHit(player);
      ev.preventDefault();
    });
    const letGo = (): void => releaseHit(player);
    hit.addEventListener("pointerup", letGo);
    hit.addEventListener("pointerleave", letGo);
    hit.addEventListener("pointercancel", letGo);
    brake.addEventListener("pointerdown", (ev) => {
      btnHeld[player].brake = true;
      ev.preventDefault();
    });
    const brakeOff = (): void => {
      btnHeld[player].brake = false;
    };
    brake.addEventListener("pointerup", brakeOff);
    brake.addEventListener("pointerleave", brakeOff);
    brake.addEventListener("pointercancel", brakeOff);
    acts.append(hit, brake);
    hitBtns[player] = hit;
    box.append(stick.root, acts);
    pads.appendChild(box);
  }

  function releaseAll(): void {
    for (const row of held) row.fill(false);
    for (const b of btnHeld) {
      b.dash = false;
      b.brake = false;
      b.charging = false;
      b.holdAt = 0;
      b.dashOnce = false;
    }
    for (const s of sticks) s?.reset();
  }

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (isPauseKey(ev.code)) {
      ev.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(ev.code, seats);
    if (!hit) return;
    ev.preventDefault();
    const idx = ARROW_KEYS.indexOf(hit.action);
    if (idx >= 0) held[hit.player][idx] = true;
    else if (hit.action === "dash") pressHit(hit.player as 0 | 1);
    else btnHeld[hit.player].brake = true;
  };
  const onKeyUp = (ev: KeyboardEvent): void => {
    const hit = keyToAction(ev.code, seats);
    if (!hit) return;
    const idx = ARROW_KEYS.indexOf(hit.action);
    if (idx >= 0) held[hit.player][idx] = false;
    else if (hit.action === "dash") releaseHit(hit.player as 0 | 1);
    else btnHeld[hit.player].brake = false;
  };
  const onGlobalUp = (): void => {
    for (let p = 0; p < btnHeld.length; p++) {
      btnHeld[p].brake = false;
      releaseHit(p as 0 | 1);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);
  window.addEventListener("pointerup", onGlobalUp);

  // ---- 画面尺寸 --------------------------------------------------------------
  let scale = 4;

  function layout(): void {
    const avail = Math.max(240, Math.min(host.clientWidth || 360, 720));
    // 场地上下压着标题栏、HUD、提示语和摇杆。矮屏按舞台剩余高度缩，不再猜 innerHeight-320。
    const guessed = Math.max(200, (window.innerHeight || 700) - 320);
    const stageH = Math.max(200, stagePlayRoom(host, { w: avail, h: guessed }).h);
    const below = Math.max(
      118,
      (tip.offsetHeight || 0) + (pads.offsetHeight || 0) + (legend.offsetHeight || 0) + 10,
    );
    const hudH = Math.max(36, hud.offsetHeight || 0);
    const roomH = Math.max(140, stageH - hudH - below);
    scale = Math.min(avail / lv.field.w, roomH / lv.field.h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(lv.field.w * scale);
    const chh = Math.round(lv.field.h * scale);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${chh}px`;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(chh * dpr);
    g?.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
    render();
  };
  window.addEventListener("resize", onResize);

  // ---- 画面 ------------------------------------------------------------------
  const CH_COLOR = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, lv.chapter))].color;

  function traceField(inset: number): void {
    if (!g) return;
    const f = lv.field;
    g.beginPath();
    if (f.shape === "round") {
      const c = fieldCenter(f);
      g.arc(c.x, c.y, Math.max(2, fieldRadius(f) - inset), 0, Math.PI * 2);
    } else {
      const r = Math.min(f.w, f.h) * 0.06;
      const x = inset;
      const y = inset;
      const w = Math.max(4, f.w - inset * 2);
      const h = Math.max(4, f.h - inset * 2);
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    }
  }

  /** 弹簧护栏:几何采样沿用 1.2(弧 / 边一模一样),画法升级成「立面 + 顶面 + 支柱」的双色栏板 */
  function drawSprings(inset: number): void {
    if (!g) return;
    const f = lv.field;
    g.lineCap = "round";
    const railH = Math.min(f.w, f.h) * 0.024;
    // 两遍:先立面(往下错开半个栏板高),再顶面 —— 俯视图里就有了厚度
    const passes: Array<{ dy: number; color: string; w: number }> = [
      { dy: railH * 0.55, color: BC_COLORS.bcRailSide, w: railH * 1.2 },
      { dy: 0, color: BC_COLORS.bcRail, w: railH },
    ];
    if (f.shape === "round") {
      const c = fieldCenter(f);
      const rad = Math.max(2, fieldRadius(f) - inset);
      for (const pass of passes) {
        g.strokeStyle = pass.color;
        g.lineWidth = pass.w;
        for (const arc of f.arcs) {
          g.beginPath();
          const from = arc.from * Math.PI * 2;
          const to = (arc.from <= arc.to ? arc.to : arc.to + 1) * Math.PI * 2;
          g.arc(c.x, c.y + pass.dy, rad, from, to);
          g.stroke();
        }
      }
      // 支柱:沿弧隔一小段点一根
      g.fillStyle = shade(BC_COLORS.bcRailSide, -14);
      for (const arc of f.arcs) {
        const from = arc.from;
        const to = arc.from <= arc.to ? arc.to : arc.to + 1;
        const posts = Math.max(2, Math.round((to - from) * 10));
        for (let i = 0; i <= posts; i++) {
          const a = (from + ((to - from) * i) / posts) * Math.PI * 2;
          g.beginPath();
          g.arc(c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad, railH * 0.34, 0, Math.PI * 2);
          g.fill();
        }
      }
      return;
    }
    const x0 = inset;
    const y0 = inset;
    const x1 = f.w - inset;
    const y1 = f.h - inset;
    const lines: Record<string, [number, number, number, number]> = {
      top: [x0, y0, x1, y0],
      bottom: [x0, y1, x1, y1],
      left: [x0, y0, x0, y1],
      right: [x1, y0, x1, y1],
    };
    for (const pass of passes) {
      g.strokeStyle = pass.color;
      g.lineWidth = pass.w;
      for (const edge of f.springs) {
        const [ax, ay, bx, by] = lines[edge];
        g.beginPath();
        g.moveTo(ax, ay + pass.dy);
        g.lineTo(bx, by + pass.dy);
        g.stroke();
      }
    }
    g.fillStyle = shade(BC_COLORS.bcRailSide, -14);
    for (const edge of f.springs) {
      const [ax, ay, bx, by] = lines[edge];
      const len = hypot(bx - ax, by - ay);
      const posts = Math.max(2, Math.round(len / 12));
      for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        g.beginPath();
        g.arc(ax + (bx - ax) * t, ay + (by - ay) * t, railH * 0.34, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  /** 悬崖引导虚线:跳段逻辑沿用 1.2,颜色换成冰断面同族的深一档(断面立面才是主讲) */
  function drawCliffs(inset: number): void {
    if (!g) return;
    const f = lv.field;
    g.strokeStyle = withAlpha(shade(BC_COLORS.bcIceEdge, -30), 0.85);
    g.lineWidth = 1.1;
    g.setLineDash([2.2, 2.2]);
    if (f.shape === "round") {
      const c = fieldCenter(f);
      const rad = Math.max(2, fieldRadius(f) - inset);
      const steps = 72;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        if (f.arcs.some((a) => inArc(a, t))) continue;
        g.beginPath();
        g.arc(c.x, c.y, rad, t * Math.PI * 2, (t + 1 / steps) * Math.PI * 2);
        g.stroke();
      }
    } else {
      const box: Array<[number, number, number, number, string]> = [
        [inset, inset, f.w - inset, inset, "top"],
        [f.w - inset, inset, f.w - inset, f.h - inset, "right"],
        [inset, f.h - inset, f.w - inset, f.h - inset, "bottom"],
        [inset, inset, inset, f.h - inset, "left"],
      ];
      for (const [ax, ay, bx, by, edge] of box) {
        if (f.springs.includes(edge as "top")) continue;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
      }
    }
    g.setLineDash([]);
  }

  /** 融冰断面上的裂纹:只画在立面看得见的那一侧(下半圈 / 下边) */
  function drawIceCracks(inset: number, slabH: number): void {
    if (!g) return;
    const f = lv.field;
    // 修复员 G10:线色透明度 0.9 → 0.96(加深一档),线宽与根数不动,冰面不画花
    g.strokeStyle = withAlpha(shade(BC_COLORS.bcIceEdge, -22), 0.96);
    g.lineWidth = 0.35;
    g.lineCap = "round";
    const crack = (x: number, y: number): void => {
      if (!g) return;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - slabH * 0.18, y + slabH * 0.5);
      g.lineTo(x + slabH * 0.14, y + slabH * 0.95);
      g.stroke();
    };
    if (f.shape === "round") {
      const c = fieldCenter(f);
      const rad = Math.max(2, fieldRadius(f) - inset);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.12 + (i / 6) * 0.76);
        crack(c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad);
      }
    } else {
      const y = f.h - inset;
      for (let i = 0; i < 7; i++) crack(inset + ((f.w - inset * 2) * (i + 0.5)) / 7, y);
    }
  }

  /** 四角灯柱 + 灯串:灯泡 900ms 交替亮(reduced 常亮),把「场馆」的氛围点出来 */
  function drawLamps(): void {
    if (!g) return;
    const f = lv.field;
    const s = Math.min(f.w, f.h) * 0.024;
    const c = fieldCenter(f);
    const rad = Math.min(f.w, f.h) / 2 - s * 1.3;
    const t = world.time;
    const posts: Array<{ x: number; y: number }> = [];
    for (const k of [-3, -1, 1, 3]) {
      const a = (k * Math.PI) / 4;
      posts.push({ x: c.x + Math.cos(a) * rad * 1.16, y: c.y + Math.sin(a) * rad * 1.16 });
    }
    // 灯串:相邻灯柱之间一条微垂的线,挂 7 颗小灯泡
    let bulbIdx = 0;
    g.strokeStyle = withAlpha(BC_COLORS.bcBumper, 0.35);
    g.lineWidth = s * 0.1;
    for (let i = 0; i < posts.length; i++) {
      const a = posts[i];
      const b = posts[(i + 1) % posts.length];
      const ax = a.x;
      const ay = a.y - s * 2;
      const bx = b.x;
      const by = b.y - s * 2;
      const sag = s * 1.1;
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag * 2, bx, by);
      g.stroke();
      for (let j = 1; j <= 7; j++) {
        const k = j / 8;
        // 二次贝塞尔在 k 处的点(和上面那条线同一条)
        const qx = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * ((ax + bx) / 2) + k * k * bx;
        const qy = (1 - k) * (1 - k) * ay + 2 * (1 - k) * k * ((ay + by) / 2 + sag * 2) + k * k * by;
        drawBulb(g, qx, qy, s * 0.22, lampOn(bulbIdx++, t, !spinArt));
      }
    }
    for (let i = 0; i < posts.length; i++) {
      drawLampPost(g, posts[i].x, posts[i].y, s, lampOn(i, t, !spinArt));
    }
  }

  // 星花 / 彩纸(纯视觉粒子,destroy 时清空)
  let fx: Particle[] = [];
  // 上一帧的车头朝向:算集电杆小旗的摆动量(只在渲染侧记账,不写回 Car)
  const faceMemo = new Map<number, number>();

  function render(): void {
    if (!g) return;
    const f = lv.field;
    const inset = world.inset;
    g.clearRect(0, 0, f.w, f.h);

    // ① 场外看台(深一档)+ 原始场地的冰面残影:化掉多少一眼看得见
    g.fillStyle = shade(BC_COLORS.bcFloor, -26);
    g.fillRect(0, 0, f.w, f.h);
    traceField(0);
    g.fillStyle = withAlpha(BC_COLORS.bcIceEdge, 0.2);
    g.fill();

    // ② 融冰断面:当前地面往下错一小截的浅蓝立面 + 裂纹 ——「掉下去就出局」的空间关系
    const slabH = Math.min(f.w, f.h) * 0.024;
    g.save();
    g.translate(0, slabH);
    traceField(inset);
    g.fillStyle = BC_COLORS.bcIceEdge;
    g.fill();
    g.restore();

    // 当前还能站人的地面:地板 token 打底,章节色只做淡罩染(章节辨识不丢)
    traceField(inset);
    g.fillStyle = BC_COLORS.bcFloor;
    g.fill();
    g.save();
    g.globalAlpha = 0.3;
    traceField(inset);
    g.fillStyle = CH_COLOR;
    g.fill();
    g.restore();
    // 地板反射斑三块(裁进地面里)。修复员 G10:第 1 关观感近平涂,
    // 按 learner 备选方案补第三块小斑(0.18×min)错开放置,半径与前两块不动
    g.save();
    traceField(inset);
    g.clip();
    drawFloorGlow(g, f.w * 0.36, f.h * 0.32, Math.min(f.w, f.h) * 0.3);
    drawFloorGlow(g, f.w * 0.66, f.h * 0.64, Math.min(f.w, f.h) * 0.22);
    drawFloorGlow(g, f.w * 0.24, f.h * 0.74, Math.min(f.w, f.h) * 0.18);
    g.restore();
    drawIceCracks(inset, slabH);

    // ③ 道具:加速带(流光箭头)
    for (const pad of world.pads) {
      g.save();
      g.translate(pad.x + pad.w / 2, pad.y + pad.h / 2);
      g.rotate(Math.atan2(pad.dy, pad.dx));
      g.fillStyle = "#ffe9a8";
      g.globalAlpha = 0.9;
      g.fillRect(-pad.w / 2, -pad.h / 2, pad.w, pad.h);
      g.globalAlpha = 1;
      g.strokeStyle = "#f0b429";
      g.lineWidth = 0.9;
      for (let k = -1; k <= 1; k++) {
        const cx = k * (pad.w * 0.28);
        g.beginPath();
        g.moveTo(cx - pad.w * 0.07, -pad.h * 0.22);
        g.lineTo(cx + pad.w * 0.07, 0);
        g.lineTo(cx - pad.w * 0.07, pad.h * 0.22);
        g.stroke();
      }
      // 流光:一条亮斑顺着加速方向推进(reduced 冻结在起点)
      const flow = padFlow(world.time, !spinArt);
      const fw = pad.w * 0.16;
      g.fillStyle = withAlpha("#FFFFFF", 0.35);
      g.fillRect(-pad.w / 2 + flow * (pad.w - fw), -pad.h / 2, fw, pad.h);
      g.restore();
    }

    // 油渍 → 彩虹肥皂渍
    for (const sl of world.slicks) drawSoapSlick(g, sl.x, sl.y, sl.r);

    // 旋转盘 → 唱片机转盘(reduced 下相位恒 0,静态)
    for (const sp of world.spinners) {
      const turn = spinArt ? (world.time / 1000) * sp.rate * Math.PI * 2 : 0;
      drawTurntable(g, sp.x, sp.y, sp.r, turn);
    }

    // 滚桶 → 木纹滚筒
    for (const h of world.hazards) drawBarrel(g, h.x, h.y, h.r);

    // ④ 车:三层自绘 + 集电杆,squash / 蓄力流光只动绘制
    for (const car of world.cars) {
      if (car.gone) continue;
      if (car.out) {
        // 等复活:降落伞顺着既有复活倒计时飘回出生点(reduced 直接淡显)
        drawParachuteCar(g, car.homeX, car.homeY, car.r, car.color, car.team, parachuteProgress(car.respawn), !spinArt);
        continue;
      }
      if (car.dashT > 0) {
        // 冲刺残影:两枚沿车尾渐隐的拖影
        for (const [k, a] of [
          [1.0, 0.3],
          [1.8, 0.16],
        ] as Array<[number, number]>) {
          g.globalAlpha = a;
          g.fillStyle = BC_GOLD;
          g.beginPath();
          g.arc(car.x - Math.cos(car.face) * car.r * k, car.y - Math.sin(car.face) * car.r * k, car.r * (1 - k * 0.18), 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      // 蓄力流光跑道:进度映射与 1.2 蓄力环逐点一致,对手照样一眼看见躲避窗口
      if (car.charge > 0) {
        drawChargeTrack(g, car.x, car.y, car.r, chargeRatio(car.charge), flowPhase(world.time, !spinArt), !spinArt);
      }
      const prevFace = faceMemo.get(car.id);
      faceMemo.set(car.id, car.face);
      drawBumperCar(g, {
        x: car.x,
        y: car.y,
        r: car.r,
        face: car.face,
        color: car.color,
        team: car.team,
        charge: chargeRatio(car.charge),
        squash: car.skid > 0 ? squashAmount(SKID_MS - car.skid, !spinArt) : 0,
        swing: flagSwing(prevFace === undefined ? 0 : car.face - prevFace, !spinArt),
      });
      if (car.teeter > 0) {
        // 打转两秒:场边一圈倒计时(功能表达,reduced 保留)+ 汗珠
        const left = car.teeter / TEETER_MS;
        g.save();
        g.strokeStyle = "#ff7ba8";
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(car.x, car.y, car.r * 1.7, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
        g.stroke();
        g.restore();
        drawSweat(g, car.x, car.y, car.r);
      } else if (car.spin > 0) {
        drawDizzyStars(g, car.x, car.y, car.r, world.time, !spinArt);
      }
    }

    // ⑤ 星花 / 彩纸
    drawParticles(g, fx);

    // ⑥ 围栏与灯柱(压在车上面,车永远「在场馆里」)
    drawSprings(inset);
    drawCliffs(inset);
    drawLamps();
  }

  // ---- HUD -------------------------------------------------------------------
  function heartRow(car: Car): string {
    return car.lives > 3 ? `❤️×${car.lives}` : "❤️".repeat(Math.max(0, car.lives));
  }

  function refreshHud(): void {
    chipTime.textContent =
      world.limit > 0 ? `⏱ ${formatClock(secondsLeft(world))}` : `⏱ ${formatClock(Math.floor(world.time / 1000))}`;
    for (let i = 0; i < statSeats; i++) {
      const car = world.cars[i];
      const cd = car.chargeCd > 0 ? `💥${Math.ceil(car.chargeCd / 100) / 10}s` : "💥就绪";
      chipStats[i].textContent = `${car.emoji}${car.name} ${heartRow(car)} 撞飞${car.score} ${cd}`;
      const btn = hitBtns[i];
      if (btn) {
        const bar = btn.querySelector(".bpc-hit-bar") as HTMLElement | null;
        if (bar) bar.style.width = `${Math.round(chargeRatio(world.cars[i].charge) * 100)}%`;
        btn.classList.toggle("bpc-hit--cd", world.cars[i].chargeCd > 0);
        btn.classList.toggle("bpc-hit--full", world.cars[i].charge >= CHARGE_MS);
      }
    }
    if (!duel) {
      const left = world.cars.filter((c) => c.team !== 0 && !c.gone).length;
      chipFoes.textContent = `🚙 还剩 ${left} 台对手`;
    }
  }

  // ---- 遮罩 ------------------------------------------------------------------
  let veil: HTMLElement | null = null;
  let paused = false;
  let finished = false;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>): void {
    clearVeil();
    const box = el("div", "bc-veil");
    box.append(el("div", "bc-veil-t", title), el("div", "bc-veil-s", sub));
    const row = el("div", "bc-veil-btns");
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `bc-btn${b.ghost ? " bc-btn--ghost" : ""}`;
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
      showVeil(
        "⏸ 休息一下",
        "按 Esc 或点「继续」回到场上。朵朵用 WASD 开车、F 冲撞、G 刹车;星星用方向键开车、L 冲撞、K 刹车。" +
          "冲撞键轻点是小冲刺,按住 0.8 秒蓄满再松手是强撞——蓄力的时候车会慢下来,对手看得见。",
        [{ label: "▶ 继续", onClick: () => togglePause() }]
      );
    } else {
      clearVeil();
    }
  }
  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- 事件 → 音效与提示 ------------------------------------------------------
  let lastBump = 0;
  let lastStars = 0;
  let toast = "";
  let toastUntil = 0;
  /** 顿帧:重要的一撞之后停 3–5 帧,撞击才有分量 */
  let hitStop = 0;

  /** 接触点星花:碰撞永远是「弹开 + 星花」,reduced 只出 1 帧 */
  function bumpStars(x: number, y: number, tint: string): void {
    fx = fx.concat(
      spawnSparkles(x, y, {
        count: BUMP_STAR_COUNT,
        lifeMs: spinArt ? BUMP_STAR_LIFE_MS : BUMP_STAR_LIFE_REDUCED_MS,
        speed: 22,
        gravity: 46,
        size: 1.5,
        colors: [BC_GOLD, "#FFFFFF", tint],
      })
    );
  }

  function consumeEvents(now: number): void {
    for (const e of world.events) {
      switch (e.kind) {
        case "bump":
          if (now - lastBump > 110) {
            opts.sfx("pop");
            lastBump = now;
          }
          if (e.impact >= 12 && now - lastStars > 110) {
            const a = world.cars[e.who];
            const b = world.cars[e.other];
            if (a && b) bumpStars((a.x + b.x) / 2, (a.y + b.y) / 2, a.color);
            lastStars = now;
          }
          if (spinArt && e.impact >= 26) hitStop = Math.max(hitStop, 3);
          break;
        case "wall":
          if (now - lastBump > 110) {
            opts.sfx("pop");
            lastBump = now;
          }
          break;
        case "dash":
          opts.sfx("jump");
          break;
        case "charge":
          opts.sfx("jump");
          if (world.cars[e.who].team === 0) {
            toast = "蓄满的一记强撞!推力全在车头上,顺着悬崖方向顶最划算。";
            toastUntil = now + 1200;
          }
          break;
        case "teeter": {
          const who = world.cars[e.who];
          opts.sfx("oops");
          toast =
            who.team === 0
              ? `${who.name}滑到场边打转啦!赶紧往场中间打方向,两秒之内还开得回来。`
              : `${who.name}被逼到场边了,趁它打转再补一下!`;
          toastUntil = now + 1600;
          hitStop = spinArt ? 4 : 0;
          break;
        }
        case "rescue": {
          const who = world.cars[e.who];
          if (who.team === 0) {
            opts.sfx("coin");
            toast = `${who.name}自己开回场上了,漂亮!`;
            toastUntil = now + 1200;
          }
          break;
        }
        case "spinner":
        case "slick":
        case "boost":
          break;
        case "out": {
          const who = world.cars[e.who];
          const by = e.by >= 0 ? world.cars.find((c) => c.id === e.by) : undefined;
          bumpStars(who.x, who.y, who.color);
          if (who.team === 0) {
            opts.sfx("oops");
            toast = `${who.name}被顶出场地啦,坐降落伞回来。`;
          } else {
            opts.sfx("coin");
            toast = by ? `${by.name}把${who.name}撞下去了!` : `${who.name}自己开下去了。`;
          }
          toastUntil = now + 1600;
          break;
        }
        case "gone":
          if (world.cars[e.who].team !== 0) opts.sfx("meow");
          break;
        case "respawn":
          break;
      }
    }
    world.events.length = 0;
    tip.textContent = now < toastUntil ? toast : opts.tip;
  }

  // ---- 主循环 -----------------------------------------------------------------
  let raf = 0;
  let last = 0;
  let tick = 0;

  function intentsFor(): Intent[] {
    const hunters = duel ? null : huntersFor(world, lv.hunters, world.time);
    return world.cars.map((car, i) => {
      if (car.ai || i >= seats) {
        const mode = hunters && !hunters.has(i) ? "patrol" : "hunt";
        return chooseCarAction(world, i, foeSkills[i] ?? 2, tick + i * 7, mode);
      }
      const player = i as 0 | 1;
      const axis = axisFromHeld(held[player]);
      const stick = sticks[player]?.value ?? { dx: 0, dy: 0 };
      const dx = axis.dx !== 0 || axis.dy !== 0 ? axis.dx : stick.dx;
      const dy = axis.dx !== 0 || axis.dy !== 0 ? axis.dy : stick.dy;
      const b = btnHeld[player];
      // 按住超过 CHARGE_MIN_MS 才真的开始蓄力,之前都当「还没决定」
      const charge = b.charging && nowMs() - b.holdAt >= CHARGE_MIN_MS;
      const dash = b.dashOnce;
      b.dashOnce = false;
      return { dx, dy, dash, brake: b.brake, charge };
    });
  }

  function settle(res: MatchResult): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    releaseAll();
    opts.onDone(res);
  }

  function baseResult(): MatchResult {
    return {
      cleared: false,
      reason: "time",
      secondsLeft: secondsLeft(world),
      totalSeconds: lv.seconds,
      falls: world.cars[0].falls,
      knocked: world.cars[0].score,
      winner: -1,
    };
  }

  function checkEnd(): void {
    if (duel) {
      const w = lastTeamStanding(world);
      if (w >= 0) {
        settle({ ...baseResult(), cleared: true, reason: "clear", winner: w });
        return;
      }
      if (timeUp(world)) settle({ ...baseResult(), reason: "time", winner: -1 });
      return;
    }
    // 无尽车海考的是「在越来越多的车里撑住」,场面清空就算这一波过了;
    // 闯关还要问一句「这一场是不是玩家自己打下来的」,见 levelCleared / levelForfeit。
    if (opts.mode === "endless" ? foesGone(world) : levelCleared(world)) {
      settle({ ...baseResult(), cleared: true, reason: "clear" });
      return;
    }
    if (levelForfeit(world)) {
      settle({ ...baseResult(), reason: "empty" });
      return;
    }
    if (playerDown(world)) {
      settle({ ...baseResult(), reason: "fall" });
      return;
    }
    if (timeUp(world)) settle({ ...baseResult(), reason: "time" });
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
    if (hitStop > 0) {
      hitStop--;
      fx = stepParticles(fx, dt / 1000);
      render();
      return;
    }
    tick++;
    fx = stepParticles(fx, dt / 1000);
    stepWorld(world, dt, intentsFor());
    consumeEvents(now);
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
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onGlobalUp);
      for (const s of sticks) s?.destroy();
      hitBtns.length = 0;
      // 新加的纯视觉状态一并归零:星花粒子与小旗摆动记账
      fx = [];
      faceMemo.clear();
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
  const runner = createMatch(stage, {
    level: lv,
    mode: "campaign",
    humans: 1,
    banner: `第 ${ctx.level + 1} 关`,
    tip: lv.hint,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.cleared) {
        ctx.win(
          rateLevel(res.secondsLeft, lv.seconds, res.falls, res.knocked),
          winLine(res.secondsLeft, res.falls, res.knocked)
        );
      } else {
        ctx.lose(loseLine(res.reason === "fall" || res.reason === "empty" ? res.reason : "time"));
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
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "bc-mode");
  const head = el("div", "bc-mhead");
  const back = document.createElement("button");
  back.type = "button";
  back.className = "bc-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "bc-chip", title);
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
  const box = el("div", "bc-veil");
  box.style.position = "static";
  box.append(el("div", "bc-veil-t", title), el("div", "bc-veil-s", sub));
  const row = el("div", "bc-veil-btns");
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `bc-btn${b.ghost ? " bc-btn--ghost" : ""}`;
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
    shell.chip.textContent = `${label} · ${versusLine(scores, P_NAME)} · 先赢 ${WIN_TARGET} 局`;
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
          ? "这一档电脑已经会绕到你的悬崖侧了,想再练手就调高一档。"
          : "换一张场地再来一场,护栏和悬崖的位置完全不一样。"
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

  function roundOver(winner: number): void {
    runner?.destroy();
    runner = null;
    const drawn = winner < 0;
    if (!drawn) scores[winner]++;
    refreshChip();
    const champion = matchWinner(scores, WIN_TARGET);
    if (champion >= 0) {
      finishMatch(champion);
      return;
    }
    const arena = buildArena(round + 1);
    const title = drawn ? "🤝 这一局打平" : `🚗 ${P_NAME[winner]}赢下第 ${round} 局!`;
    const sub = drawn
      ? `时间到,两台车都还稳稳站在场上。${versusLine(scores, P_NAME)},下一局换到「${arena.name}」再决胜负。`
      : `${versusLine(scores, P_NAME)}。下一局是「${arena.name}」:${arena.hint}`;
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
    const arena = buildArena(round);
    runner = createMatch(shell.stage, {
      level: {
        index: -1,
        chapter: (round - 1) % CHAPTERS.length,
        field: arena.field,
        pads: arena.pads,
        hazards: arena.hazards,
        spinners: arena.spinners,
        slicks: arena.slicks,
        keep: arena.keep,
        spawn: arena.spawns[0],
        foeSpawns: [arena.spawns[1]],
        foes: [],
        hunters: 1,
        hearts: 1,
        seconds: arena.seconds,
        seed: arena.seed,
        hint: arena.hint,
      },
      mode: aiSkill ? "ai" : "versus",
      humans: aiSkill ? 1 : 2,
      aiSkill: aiSkill ?? undefined,
      banner: `${arena.name} · 第 ${round} 局`,
      tip: aiSkill
        ? `${arena.hint} 朵朵:WASD 开车、F 冲刺、G 刹车。`
        : `${arena.hint} 朵朵:WASD + F/G;星星:方向键 + L/K。`,
      sfx: (n) => api.play(n),
      onDone: (res) => roundOver(res.winner),
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
// 无尽车海
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽车海");
  let runner: Runner | null = null;
  let wave = 1;
  let best = save.getGameProgress(meta.id).endlessBest;

  function startWave(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `♾️ 无尽车海 · 第 ${wave} 波 · 最好 第 ${best} 波`;
    const lv = buildWave(wave);
    runner = createMatch(shell.stage, {
      level: lv,
      mode: "endless",
      humans: 1,
      banner: `第 ${wave} 波 · ${lv.foes.length} 台`,
      tip: lv.hint,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        if (res.cleared) {
          best = save.recordEndlessBest(meta.id, wave);
          api.addStars(1);
          wave++;
          startWave();
          return;
        }
        const reached = Math.max(0, wave - 1);
        best = save.recordEndlessBest(meta.id, reached);
        runner?.destroy();
        runner = null;
        overBox(shell.stage, "🚗 车海把你淹掉啦", endlessLine(reached, best), [
          {
            label: "🔁 从第 1 波再来",
            onClick: () => {
              api.play("tap");
              wave = 1;
              startWave();
            },
          },
          { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
        ]);
      },
    });
  }

  startWave();

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
  const bar = el("div", "bc-bar");
  const picks = el("div", "bc-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let aiSkill: AiLevel = 2;

  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "bc-open";
  vsBtn.textContent = "⚔️ 双人对战";
  const aiBtn = document.createElement("button");
  aiBtn.type = "button";
  aiBtn.className = "bc-open bc-open--ai";
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "bc-open bc-open--en";
  bar.append(vsBtn, aiBtn, endlessBtn);

  const pickBtns: HTMLButtonElement[] = [];
  AI_LEVELS.forEach((skill) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bc-pick";
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
    endlessBtn.textContent = best > 0 ? `♾️ 无尽车海 · 最好 第 ${best} 波` : "♾️ 无尽车海";
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

  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, null)));
  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, aiSkill)));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来:手机竖屏上这一百来像素正好够场地和摇杆同框
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
      mapHint: "站在对手和场地中心之间再发力,推力才是朝着悬崖去的。",
      grandMessage: "188 关全部通关,你就是碰碰车擂台上最会找角度的那一个!",
      guideTitle: "碰碰车大乱斗 · 撞人手册",
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
