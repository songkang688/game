import { meta } from "./meta";
export { meta };

// 连招对决:跳过去接一串连招,再取消成超必杀。
// 188 关挑战塔 + 四档人机 BO3 + 连胜无尽 + 同屏双人 + 训练场,对手是本机 AI,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import {
  ARCHETYPE_LABELS,
  CHARACTERS,
  METER_MAX,
  SLOT_LABELS,
  SUPER_LV1_COST,
  SUPER_LV2_COST,
  characterById,
  type Character,
  type MoveSlot
} from "./frames";
import {
  DUMMY_LABELS,
  DUMMY_MODES,
  WAKEUP_LABELS,
  inputOf,
  neutralInput,
  sparkCount,
  superCutinFrames,
  totalFrames,
  type DummyMode,
  type InputFrame
} from "./rules";
import {
  characterOf,
  createMatch,
  currentMove,
  stepMatch,
  type FighterState,
  type MatchConfig,
  type MatchState,
  type SideStats
} from "./engine";
import { AI_TIERS, AI_TIER_HINTS, AI_TIER_LABELS, dummyDecider, foeDecider, type AiTier } from "./ai";
import {
  CHAPTERS,
  endlessConfig,
  endlessMatchConfig,
  goalLine,
  levelConfig,
  levelWon,
  matchConfigFor,
  starsFor,
  trainingMatchConfig,
  versusMatchConfig,
  type LevelResult
} from "./levels";

/** 舞台画布高度 */
export const STAGE_HEIGHT = 250;
/** 地面在画布里的 y */
export const GROUND_Y = 214;

const CSS = `
.cc-wrap{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#FFF2F8,#F5F0FF);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.cc-hud{display:flex;gap:8px;align-items:stretch;margin-bottom:6px;}
.cc-side{flex:1 1 0;min-width:0;}
.cc-side.cc-right{text-align:right;}
.cc-name{font-size:16px;font-weight:900;color:#8a4a76;overflow-wrap:anywhere;line-height:1.4;}
.cc-bar{height:12px;border-radius:8px;background:#F0E4EE;overflow:hidden;margin-top:3px;}
.cc-bar>i{display:block;height:100%;border-radius:8px;transition:width .12s linear;}
.cc-bar.cc-thin{height:7px;}
.cc-vigor>i{background:linear-gradient(90deg,#FF9EC4,#F26FA4);}
.cc-meter>i{background:linear-gradient(90deg,#FFD98A,#F5B93C);}
.cc-guard>i{background:linear-gradient(90deg,#A9D8F5,#5FA9DE);}
.cc-mid{flex:0 0 auto;text-align:center;min-width:86px;}
.cc-timer{font-size:22px;font-weight:900;color:#7a4a86;line-height:1.1;}
.cc-dots{font-size:var(--mt-control,14px);letter-spacing:2px;color:#D8A8C4;}
.cc-dots b{color:#E0568F;}
.cc-combo{font-size:16px;font-weight:800;color:#8a5aa8;min-height:18px;overflow-wrap:anywhere;}
.cc-canvas{width:100%;height:auto;display:block;border-radius:14px;background:#FFF7FC;touch-action:none;}
.cc-msg{text-align:center;min-height:20px;color:#7a4a86;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;}
.cc-pad{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-top:8px;flex-wrap:wrap;}
.cc-stick{width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.6);position:relative;
  box-shadow:inset 0 0 0 3px rgba(200,160,200,.35);flex:0 0 auto;touch-action:none;}
.cc-stick>i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
  background:rgba(232,150,190,.75);}
.cc-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.cc-btn{min-width:64px;min-height:64px;border:none;border-radius:50%;font-family:inherit;font-size:16px;
  font-weight:900;cursor:pointer;background:#FFD3E6;color:#8a3a66;box-shadow:0 4px 0 #E7A9C6;touch-action:none;}
.cc-btn.cc-heavy{background:#FFE3B8;color:#8a6321;box-shadow:0 4px 0 #E7C68A;}
.cc-btn.cc-burst{background:#D9D2FB;color:#4f3f96;box-shadow:0 4px 0 #B4A8E8;}
.cc-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #E7A9C6;}
.cc-btn:focus-visible,.cc-open:focus-visible,.cc-back:focus-visible{outline:3px solid #46246b;outline-offset:3px;}
.cc-modebar,.cc-optbar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.cc-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#7a4a86;text-align:center;overflow-wrap:anywhere;}
.cc-open{border:none;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  min-height:44px;font-family:inherit;background:linear-gradient(180deg,#E27BAE,#C55A91);box-shadow:0 4px 0 #A44576;}
.cc-open:active{transform:translateY(2px);box-shadow:0 2px 0 #A44576;}
.cc-open.cc-ghost{background:linear-gradient(180deg,#8f8fd0,#6f6fb4);box-shadow:0 4px 0 #5a5a97;}
.cc-mode{max-width:860px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.cc-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.cc-back{border:none;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:900;cursor:pointer;
  min-height:44px;font-family:inherit;background:#ffffffd9;color:#a4548a;box-shadow:0 3px 0 rgba(180,120,160,.35);}
.cc-badge{background:#fff;border-radius:14px;padding:6px 10px;font-weight:800;font-size:16px;color:#8a4a76;
  box-shadow:0 2px 6px rgba(190,150,190,.3);overflow-wrap:anywhere;}
.cc-pick{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.cc-face{min-width:74px;min-height:74px;border:none;border-radius:16px;font-family:inherit;cursor:pointer;
  background:#fff;box-shadow:0 3px 8px rgba(190,150,190,.3);padding:6px 4px;display:flex;flex-direction:column;
  align-items:center;gap:2px;}
.cc-face.cc-on{outline:3px solid #E0568F;}
.cc-face em{font-style:normal;font-size:22px;line-height:1;}
.cc-face span{font-size:var(--mt-control,14px);font-weight:900;color:#7a4a86;}
.cc-face i{font-style:normal;font-size:var(--mt-control,14px);color:#9a7ba8;}
.cc-note{text-align:center;font-size:16px;font-weight:700;color:#8a6a9a;line-height:1.6;overflow-wrap:anywhere;
  margin:6px auto;max-width:520px;}
.cc-over{text-align:center;padding:22px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(190,150,190,.3);}
.cc-over-t{font-size:21px;font-weight:900;color:#8a4a76;margin-bottom:8px;}
.cc-over-s{font-size:16px;font-weight:700;color:#7a5a8a;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
.cc-train{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.cc-info{background:#ffffffd0;border-radius:12px;padding:8px 10px;font-size:16px;font-weight:700;color:#6a4a7a;
  line-height:1.6;overflow-wrap:anywhere;max-width:520px;margin:8px auto 0;text-align:left;}
.cc-info b{color:#a4548a;}
@media (max-width:360px){
  .cc-timer{font-size:19px;}
  .cc-stick{width:96px;height:96px;}
  .cc-btn{min-width:56px;min-height:56px;font-size:15px;}
  .cc-open{padding:9px 13px;font-size:14px;}
  .cc-face{min-width:64px;}
}
@media (prefers-reduced-motion:reduce){
  .cc-bar>i{transition:none;}
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
// 键位:鸭梨 WASD + F/G,康康 方向键 + L/K
// ---------------------------------------------------------------------------

type Dir = "left" | "right" | "up" | "down" | "light" | "heavy";

/** 鸭梨这一侧的键位 */
export function duoKey(k: string): Dir | null {
  if (k === "a") return "left";
  if (k === "d") return "right";
  if (k === "w") return "up";
  if (k === "s") return "down";
  if (k === "f") return "light";
  if (k === "g") return "heavy";
  return null;
}

/** 康康这一侧的键位 */
export function starKey(k: string): Dir | null {
  if (k === "ArrowLeft") return "left";
  if (k === "ArrowRight") return "right";
  if (k === "ArrowUp") return "up";
  if (k === "ArrowDown") return "down";
  if (k === "l") return "light";
  if (k === "k") return "heavy";
  return null;
}

interface HeldKeys {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  burst: boolean;
}

function emptyHeld(): HeldKeys {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false, burst: false };
}

/** 键位状态 → 引擎输入:轻重同按也算必杀钮 */
export function heldToInput(h: HeldKeys): InputFrame {
  return inputOf({
    left: h.left,
    right: h.right,
    up: h.up,
    down: h.down,
    light: h.light,
    heavy: h.heavy,
    burst: h.burst || (h.light && h.heavy)
  });
}

// ---------------------------------------------------------------------------
// 舞台绘制
// ---------------------------------------------------------------------------

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, shift: number, color: string): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#FFF6FC");
  sky.addColorStop(1, color);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 远层:大圆丘,跟着镜头慢慢挪
  ctx.fillStyle = "rgba(255,255,255,.55)";
  for (let i = -1; i < 6; i++) {
    const x = ((i * 150 - shift * 0.25) % (w + 300)) + 150;
    ctx.beginPath();
    ctx.arc(x, GROUND_Y - 6, 78, Math.PI, 0);
    ctx.fill();
  }
  // 近层:小圆丘,挪得快一点
  ctx.fillStyle = "rgba(255,255,255,.8)";
  for (let i = -1; i < 8; i++) {
    const x = ((i * 110 - shift * 0.6) % (w + 220)) + 110;
    ctx.beginPath();
    ctx.arc(x, GROUND_Y + 4, 44, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = "#F3E4F0";
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
  ctx.fillStyle = "rgba(200,150,190,.35)";
  ctx.fillRect(0, GROUND_Y, w, 3);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

function drawFighter(ctx: CanvasRenderingContext2D, f: FighterState, ch: Character): void {
  const bx = f.x;
  const feet = GROUND_Y - f.y;
  const crouch = f.stance === "crouch";
  const resting = f.phase === "rest";
  const down = f.phase === "knockdown";
  const bodyH = resting || down ? ch.crouchHeight * 0.7 : crouch ? ch.crouchHeight : ch.height;
  const bodyW = ch.halfWidth * 2 + (down ? 14 : 0);

  // 影子
  ctx.fillStyle = "rgba(150,110,150,.16)";
  ctx.beginPath();
  ctx.ellipse(bx, GROUND_Y + 3, ch.halfWidth + 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 身体
  ctx.fillStyle = ch.color;
  roundedRect(ctx, bx - bodyW / 2, feet - bodyH, bodyW, bodyH, 14);
  ctx.strokeStyle = ch.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 出招时伸一只手出去(判定框的位置)
  const mv = currentMove(f);
  if (mv && f.frame - 1 >= mv.startup && f.frame - 1 < mv.startup + mv.active) {
    const rx = f.facing === 1 ? bx + mv.box.x : bx - mv.box.x - mv.box.w;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    roundedRect(ctx, rx, feet - mv.box.y - mv.box.h, mv.box.w, mv.box.h, 12);
    ctx.strokeStyle = ch.ink;
    ctx.stroke();
  }

  // 脸
  const eyeY = feet - bodyH + 18;
  ctx.fillStyle = ch.ink;
  if (resting || down) {
    ctx.fillRect(bx - 9, eyeY, 7, 2);
    ctx.fillRect(bx + 3, eyeY, 7, 2);
  } else {
    ctx.beginPath();
    ctx.arc(bx - 6 + f.facing * 2, eyeY, 2.6, 0, Math.PI * 2);
    ctx.arc(bx + 6 + f.facing * 2, eyeY, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(ch.emoji, bx, feet - bodyH - 4);

  // 硬直时冒几颗小星星
  if (f.phase === "hitstun" || f.phase === "guardbreak") {
    ctx.fillStyle = "#FFD05A";
    ctx.font = "13px system-ui";
    ctx.fillText("✦", bx - 10, feet - bodyH - 16);
    ctx.fillText("✦", bx + 10, feet - bodyH - 20);
  }
}

// ---------------------------------------------------------------------------
// 一场对局(战役 / 对战 / 双人 / 无尽 / 训练都用它)
// ---------------------------------------------------------------------------

export type SeatKind = { kind: "duo" } | { kind: "star" } | { kind: "ai"; tier: AiTier; style?: "normal" | "turtle" | "jumper"; seed: number } | { kind: "dummy"; mode: DummyMode };

export interface ArenaOpts {
  cfg: MatchConfig;
  seats: [SeatKind, SeatKind];
  goalText?: string;
  training?: boolean;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  onEnd?: (m: MatchState) => void;
}

export interface Arena {
  destroy: () => void;
  state: () => MatchState;
}

export function createArena(host: HTMLElement, opts: ArenaOpts): Arena {
  const soft = reducedMotion();
  const cfg = { ...opts.cfg, reducedMotion: soft };
  let m = createMatch(cfg);
  const sparks: Spark[] = [];
  let dummyMode: DummyMode = opts.seats[1].kind === "dummy" ? opts.seats[1].mode : "stand";

  const wrap = document.createElement("div");
  wrap.className = "cc-wrap";

  const hud = document.createElement("div");
  hud.className = "cc-hud";
  const left = document.createElement("div");
  left.className = "cc-side";
  const mid = document.createElement("div");
  mid.className = "cc-mid";
  const right = document.createElement("div");
  right.className = "cc-side cc-right";
  hud.append(left, mid, right);

  function sideHTML(f: FighterState): string {
    const ch = characterOf(f);
    const vig = Math.max(0, Math.round((f.vigor / f.vigorMax) * 100));
    const met = Math.round((f.meter / METER_MAX) * 100);
    const gua = Math.round((f.guard / f.guardMax) * 100);
    const hearts = Math.max(0, Math.ceil((f.vigor / f.vigorMax) * 3));
    return `<div class="cc-name">${ch.emoji} ${ch.name} <span aria-hidden="true">${"♥".repeat(hearts)}</span></div>
      <div class="cc-bar cc-vigor" role="img" aria-label="元气 ${vig}%"><i style="width:${vig}%"></i></div>
      <div class="cc-bar cc-thin cc-meter" role="img" aria-label="能量 ${met}%"><i style="width:${met}%"></i></div>
      <div class="cc-bar cc-thin cc-guard" role="img" aria-label="护盾 ${gua}%"><i style="width:${gua}%"></i></div>`;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "cc-canvas";
  canvas.width = cfg.stageWidth;
  canvas.height = STAGE_HEIGHT;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "连招对决的舞台");
  const ctx = canvas.getContext("2d");

  const msg = document.createElement("div");
  msg.className = "cc-msg";
  msg.textContent = opts.goalText ?? "";

  const pad = document.createElement("div");
  pad.className = "cc-pad";
  const stick = document.createElement("div");
  stick.className = "cc-stick";
  stick.setAttribute("role", "application");
  stick.setAttribute("aria-label", "虚拟摇杆:按住往哪边推就往哪边走,往上推是跳");
  const knob = document.createElement("i");
  stick.appendChild(knob);
  const btns = document.createElement("div");
  btns.className = "cc-btns";
  const bLight = document.createElement("button");
  bLight.type = "button";
  bLight.className = "cc-btn";
  bLight.textContent = "轻";
  const bHeavy = document.createElement("button");
  bHeavy.type = "button";
  bHeavy.className = "cc-btn cc-heavy";
  bHeavy.textContent = "重";
  const bBurst = document.createElement("button");
  bBurst.type = "button";
  bBurst.className = "cc-btn cc-burst";
  bBurst.textContent = "必杀";
  btns.append(bLight, bHeavy, bBurst);
  pad.append(stick, btns);

  const info = document.createElement("div");
  info.className = "cc-info";
  info.hidden = !opts.training;

  wrap.append(hud, canvas, msg, pad, info);
  host.appendChild(wrap);

  // --- 输入 ---
  const held: [HeldKeys, HeldKeys] = [emptyHeld(), emptyHeld()];
  const touch = emptyHeld();
  let paused = false;

  const seatOf = (kind: "duo" | "star"): 0 | 1 | null => {
    if (opts.seats[0].kind === kind) return 0;
    if (opts.seats[1].kind === kind) return 1;
    return null;
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      paused = !paused;
      msg.textContent = paused ? "⏸️ 暂停中,再按 Esc 继续。" : opts.goalText ?? "继续!";
      // 这一下归自己了:不拦住,游戏壳还会再弹一次统一暂停面板,
      // 之后的 Esc 只关面板,场上却一直停着
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const duoSeat = seatOf("duo");
    const starSeat = seatOf("star");
    const d = duoKey(k);
    if (d !== null && duoSeat !== null) {
      held[duoSeat][d] = true;
      if (k === "a" || k === "d" || k === "w" || k === "s") e.preventDefault();
    }
    const s = starKey(k);
    if (s !== null && starSeat !== null) {
      held[starSeat][s] = true;
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const duoSeat = seatOf("duo");
    const starSeat = seatOf("star");
    const d = duoKey(k);
    if (d !== null && duoSeat !== null) held[duoSeat][d] = false;
    const s = starKey(k);
    if (s !== null && starSeat !== null) held[starSeat][s] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const offs: Array<() => void> = [];
  function bindHold(el: HTMLElement, key: keyof HeldKeys): void {
    const on = (e: PointerEvent): void => {
      e.preventDefault();
      touch[key] = true;
    };
    const off = (): void => {
      touch[key] = false;
    };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("pointerleave", off);
    offs.push(() => {
      el.removeEventListener("pointerdown", on);
      el.removeEventListener("pointerup", off);
      el.removeEventListener("pointercancel", off);
      el.removeEventListener("pointerleave", off);
    });
  }
  bindHold(bLight, "light");
  bindHold(bHeavy, "heavy");
  bindHold(bBurst, "burst");

  let stickId = -1;
  const stickMove = (e: PointerEvent): void => {
    const r = stick.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const th = r.width * 0.18;
    touch.left = dx < -th;
    touch.right = dx > th;
    touch.up = dy < -th;
    touch.down = dy > th;
    knob.style.transform = `translate(${Math.max(-30, Math.min(30, dx))}px,${Math.max(-30, Math.min(30, dy))}px)`;
  };
  const stickDown = (e: PointerEvent): void => {
    e.preventDefault();
    stickId = e.pointerId;
    stickMove(e);
  };
  const stickDrag = (e: PointerEvent): void => {
    if (e.pointerId !== stickId) return;
    stickMove(e);
  };
  const stickUp = (): void => {
    stickId = -1;
    touch.left = touch.right = touch.up = touch.down = false;
    knob.style.transform = "";
  };
  stick.addEventListener("pointerdown", stickDown);
  stick.addEventListener("pointermove", stickDrag);
  stick.addEventListener("pointerup", stickUp);
  stick.addEventListener("pointercancel", stickUp);
  offs.push(() => {
    stick.removeEventListener("pointerdown", stickDown);
    stick.removeEventListener("pointermove", stickDrag);
    stick.removeEventListener("pointerup", stickUp);
    stick.removeEventListener("pointercancel", stickUp);
  });

  // --- 决策器 ---
  const deciders: Array<((m: MatchState, side: 0 | 1) => InputFrame) | null> = [null, null];
  opts.seats.forEach((seat, i) => {
    if (seat.kind === "ai") deciders[i] = foeDecider(seat.style ?? "normal", seat.tier, seat.seed);
    else if (seat.kind === "dummy") deciders[i] = dummyDecider(seat.mode, 21);
  });

  function inputFor(side: 0 | 1): InputFrame {
    const seat = opts.seats[side];
    if (seat.kind === "ai") return deciders[side]?.(m, side) ?? neutralInput();
    if (seat.kind === "dummy") {
      const d = dummyDecider(dummyMode, 21 + m.frame);
      return d(m, side);
    }
    const h = held[side];
    const merged: HeldKeys = seat.kind === "duo" && opts.seats[1].kind !== "star"
      ? {
          left: h.left || touch.left,
          right: h.right || touch.right,
          up: h.up || touch.up,
          down: h.down || touch.down,
          light: h.light || touch.light,
          heavy: h.heavy || touch.heavy,
          burst: h.burst || touch.burst
        }
      : h;
    return heldToInput(merged);
  }

  // --- 声音 ---
  let lastSfx = 0;
  function playEvents(): void {
    for (const ev of m.events) {
      const now = m.frame;
      if (now - lastSfx < 4) continue;
      lastSfx = now;
      if (ev.kind === "hit") opts.sfx("pop");
      else if (ev.kind === "block") opts.sfx("tap");
      else if (ev.kind === "crush") opts.sfx("oops");
      else if (ev.kind === "throw") opts.sfx("coin");
      else if (ev.kind === "super") opts.sfx("coin");
      else if (ev.kind === "clash") opts.sfx("tap");
      else if (ev.kind === "knockdown") opts.sfx("meow");
    }
    if (!soft) {
      for (const ev of m.events) {
        if (ev.kind !== "hit" && ev.kind !== "throw" && ev.kind !== "clash") continue;
        const n = sparkCount(ev.power, soft);
        for (let i = 0; i < n; i++) {
          sparks.push({
            x: ev.x,
            y: GROUND_Y - ev.y,
            vx: (i - n / 2) * 0.5,
            vy: -1 - (i % 3),
            life: 16 + (i % 5),
            color: i % 2 === 0 ? "#FFD05A" : "#FF9EC4"
          });
        }
      }
    }
  }

  // --- 渲染 ---
  function render(): void {
    if (!ctx) return;
    const [a, b] = m.fighters;
    left.innerHTML = sideHTML(a);
    right.innerHTML = sideHTML(b);
    const secs = Math.ceil(m.timer / 60);
    const dots = (side: 0 | 1): string => {
      let s = "";
      for (let i = 0; i < cfg.roundsToWin; i++) s += m.wins[side] > i ? "<b>●</b>" : "○";
      return s;
    };
    const combo = Math.max(a.comboHits, b.comboHits);
    mid.innerHTML = `<div class="cc-timer">${Math.max(0, secs)}</div>
      <div class="cc-dots">${dots(0)} · ${dots(1)}</div>
      <div class="cc-combo">${combo >= 2 ? `${combo} 连!` : `第 ${m.round} 回合`}</div>`;

    const shake = !soft && m.hitstop > 0 ? (m.hitstop % 2 === 0 ? 2 : -2) : 0;
    ctx.setTransform(1, 0, 0, 1, shake, 0);
    drawBackground(ctx, cfg.stageWidth, STAGE_HEIGHT, (a.x + b.x) / 2, "#F7E9FB");

    for (const p of m.projectiles) {
      ctx.fillStyle = p.color;
      roundedRect(ctx, p.x, GROUND_Y - p.y - p.h, p.w, p.h, 10);
    }
    drawFighter(ctx, a, characterOf(a));
    drawFighter(ctx, b, characterOf(b));

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.18;
      s.life -= 1;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = s.color;
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("✦", s.x, s.y);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (opts.training) renderTraining();
  }

  function renderTraining(): void {
    const f = m.fighters[0];
    const mv = currentMove(f);
    const frameLine = mv
      ? `<b>${mv.name}</b>(${SLOT_LABELS[mv.slot]}) 起手 ${mv.startup} / 命中 ${mv.active} / 收招 ${mv.recovery} · 取消窗口 ${mv.cancelLag} 帧 · 现在第 ${f.frame} 帧`
      : "站着的时候这里会显示上一招的帧数;出一招试试。";
    info.innerHTML = `<div>${frameLine}</div>
      <div>输入历史:${f.history.slice(-10).join(" ") || "·"}</div>
      <div>连段 ${f.comboHits} 段 · 空中连 ${f.juggleHits} 段 · 能量 ${Math.round(f.meter)} · 假人:${DUMMY_LABELS[dummyMode]}</div>`;
  }

  // --- 主循环 ---
  let raf = 0;
  let acc = 0;
  let last = 0;
  let destroyed = false;
  let ended = false;

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.08, (ts - last) / 1000);
    last = ts;
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 4) {
        acc -= 1 / 60;
        steps += 1;
        stepMatch(m, [inputFor(0), inputFor(1)]);
        playEvents();
        if (m.winner !== null && !ended && !opts.training) {
          ended = true;
          opts.onEnd?.(m);
        }
      }
    }
    render();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  render();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const off of offs) off();
      offs.length = 0;
      wrap.remove();
    },
    state: () => m,
    ...(opts.training
      ? {
          setDummy(mode: DummyMode) {
            dummyMode = mode;
          }
        }
      : {})
  } as Arena & { setDummy?: (mode: DummyMode) => void };
}

// ---------------------------------------------------------------------------
// 战役:188 关挑战塔
// ---------------------------------------------------------------------------

let chosenChar = "duoduo";

/** 从对局状态里抽出闯关要的结果 */
export function levelResultOf(m: MatchState): LevelResult {
  const me = m.fighters[0];
  return {
    won: m.winner === 0,
    stats: m.stats[0] as SideStats,
    vigorLeft: me.vigor,
    vigorMax: me.vigorMax,
    roundsWon: m.wins[0]
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level, chosenChar);
  let settled = false;
  const arena = createArena(stage, {
    cfg: matchConfigFor(cfg),
    goalText: goalLine(cfg),
    seats: [{ kind: "duo" }, { kind: "ai", tier: cfg.tier, style: cfg.foeStyle, seed: cfg.seed }],
    sfx: ctx.sfx,
    onEnd: (m) => {
      if (settled) return;
      settled = true;
      const r = levelResultOf(m);
      if (levelWon(cfg, r)) {
        ctx.win(starsFor(cfg, r), `打中 ${r.stats.hits} 下,最长 ${r.stats.maxCombo} 连,元气还剩 ${r.vigorLeft}!`);
      } else {
        ctx.lose("这一回合先坐下歇一歇,下次早一点起手就接得上啦!");
      }
    }
  });
  return { destroy: () => arena.destroy() };
}

// ---------------------------------------------------------------------------
// 其它四种模式
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo" | "train";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 人机对战",
  endless: "♾️ 连胜无尽",
  duo: "👫 双人同屏",
  train: "🎯 训练场"
};

function charPicker(current: string, onPick: (id: string) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "cc-pick";
  for (const c of CHARACTERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `cc-face${c.id === current ? " cc-on" : ""}`;
    b.innerHTML = `<em>${c.emoji}</em><span>${c.name}</span><i>${ARCHETYPE_LABELS[c.archetype]}</i>`;
    b.setAttribute("aria-label", `${c.name},${ARCHETYPE_LABELS[c.archetype]},${c.style}`);
    b.addEventListener("click", () => onPick(c.id));
    row.appendChild(b);
  }
  return row;
}

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "cc-mode";
  const head = document.createElement("div");
  head.className = "cc-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "cc-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "cc-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let arena: Arena | null = null;
  let tier: AiTier = "normal";
  let foeChar = "xingxing";
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function clearStage(): void {
    arena?.destroy();
    arena = null;
    stage.innerHTML = "";
  }

  function showOver(title: string, sub: string, again: string, next: () => void): void {
    clearStage();
    const box = document.createElement("div");
    box.className = "cc-over";
    box.innerHTML = `<div class="cc-over-t">${title}</div><div class="cc-over-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cc-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      next();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function menu(): void {
    clearStage();
    stage.appendChild(
      charPicker(chosenChar, (id) => {
        chosenChar = id;
        api.play("tap");
        menu();
      })
    );
    const note = document.createElement("div");
    note.className = "cc-note";
    const me = characterById(chosenChar);
    note.textContent = `${me.emoji} ${me.name}(${ARCHETYPE_LABELS[me.archetype]}):${me.style}。键位:鸭梨 WASD 移动 + F 轻 + G 重,F+G 一起按是必杀钮;康康 方向键 + L 轻 + K 重;Esc 暂停。手机用左边摇杆和右边三个大钮。`;
    stage.appendChild(note);

    if (mode === "versus") {
      const row = document.createElement("div");
      row.className = "cc-optbar";
      for (const t of AI_TIERS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `cc-open${t === tier ? "" : " cc-ghost"}`;
        b.textContent = `${AI_TIER_LABELS[t]}`;
        b.title = AI_TIER_HINTS[t];
        b.addEventListener("click", () => {
          tier = t;
          api.play("tap");
          startVersus();
        });
        row.appendChild(b);
      }
      stage.appendChild(row);
      const hint = document.createElement("div");
      hint.className = "cc-note";
      hint.textContent = `三局两胜。${AI_TIER_LABELS[tier]}:${AI_TIER_HINTS[tier]}`;
      stage.appendChild(hint);
      return;
    }
    if (mode === "endless") {
      const row = document.createElement("div");
      row.className = "cc-optbar";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-open";
      b.textContent = "▶ 开始连胜";
      b.addEventListener("click", () => {
        api.play("tap");
        streak = 0;
        startEndless();
      });
      row.appendChild(b);
      stage.appendChild(row);
      const hint = document.createElement("div");
      hint.className = "cc-note";
      hint.textContent = `一场接一场,对手越打越强。最高连胜 ${best} 场。`;
      stage.appendChild(hint);
      return;
    }
    if (mode === "duo") {
      const row = document.createElement("div");
      row.className = "cc-optbar";
      for (const c of CHARACTERS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `cc-open${c.id === foeChar ? "" : " cc-ghost"}`;
        b.textContent = `康康用 ${c.name}`;
        b.addEventListener("click", () => {
          foeChar = c.id;
          api.play("tap");
          startDuo();
        });
        row.appendChild(b);
      }
      stage.appendChild(row);
      return;
    }
    const row = document.createElement("div");
    row.className = "cc-optbar";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cc-open";
    b.textContent = "▶ 进训练场";
    b.addEventListener("click", () => {
      api.play("tap");
      startTraining();
    });
    row.appendChild(b);
    stage.appendChild(row);
    const hint = document.createElement("div");
    hint.className = "cc-note";
    hint.textContent = "训练场不结算胜负:帧数据、输入历史都看得见,假人的行为随时能换。";
    stage.appendChild(hint);
  }

  function startVersus(): void {
    clearStage();
    chip.textContent = `🤝 对手:${AI_TIER_LABELS[tier]}`;
    const seed = 991 + Math.floor(Math.random() * 100000);
    const foe = CHARACTERS[(seed + 3) % CHARACTERS.length].id;
    arena = createArena(stage, {
      cfg: versusMatchConfig(chosenChar, foe === chosenChar ? "xingxing" : foe),
      goalText: "三局两胜,先赢两回合",
      seats: [{ kind: "duo" }, { kind: "ai", tier, seed }],
      sfx: (n) => api.play(n),
      onEnd: (m) => {
        const won = m.winner === 0;
        if (won) api.addStars(2);
        showOver(
          won ? "这一场赢下来啦!" : "这一场先到这里",
          `回合比分 ${m.wins[0]}:${m.wins[1]},最长 ${m.stats[0].maxCombo} 连,取消 ${m.stats[0].cancels} 次。`,
          "🔁 再打一场",
          startVersus
        );
      }
    });
  }

  function startEndless(): void {
    clearStage();
    const cfg = endlessConfig(streak, chosenChar);
    chip.textContent = `♾️ 连胜 ${streak} · 对手 ${AI_TIER_LABELS[cfg.tier]}`;
    arena = createArena(stage, {
      cfg: endlessMatchConfig(cfg, chosenChar),
      goalText: `第 ${streak + 1} 场,赢了就继续。最高连胜 ${best}`,
      seats: [{ kind: "duo" }, { kind: "ai", tier: cfg.tier, seed: 5000 + streak * 31 }],
      sfx: (n) => api.play(n),
      onEnd: (m) => {
        if (m.winner === 0) {
          streak += 1;
          best = save.recordEndlessBest(meta.id, streak);
          if (streak % 3 === 0) api.addStars(1);
          showOver("赢啦,继续!", `已经连胜 ${streak} 场,最高纪录 ${best} 场。`, "▶ 下一场", startEndless);
        } else {
          showOver(
            "这一轮到此为止",
            `连胜 ${streak} 场,最高纪录 ${best} 场。休息一下再来一轮吧!`,
            "🔁 重新开始",
            () => {
              streak = 0;
              startEndless();
            }
          );
        }
      }
    });
  }

  function startDuo(): void {
    clearStage();
    chip.textContent = "👫 鸭梨 WASD+F/G · 康康 方向键+L/K";
    arena = createArena(stage, {
      cfg: versusMatchConfig(chosenChar, foeChar),
      goalText: "三局两胜,两个人一台设备",
      seats: [{ kind: "duo" }, { kind: "star" }],
      sfx: (n) => api.play(n),
      onEnd: (m) => {
        const who = m.winner === 0 ? characterById(chosenChar).name : characterById(foeChar).name;
        showOver(
          `${who} 这一场赢啦!`,
          `回合比分 ${m.wins[0]}:${m.wins[1]}。换个角色再来一场?`,
          "🔁 再来一场",
          startDuo
        );
      }
    });
  }

  function startTraining(): void {
    clearStage();
    chip.textContent = "🎯 训练场";
    const holder = document.createElement("div");
    stage.appendChild(holder);
    const created = createArena(holder, {
      cfg: trainingMatchConfig(chosenChar, foeChar === chosenChar ? "dundun" : foeChar),
      goalText: "训练场:不结算胜负,慢慢试连段",
      training: true,
      seats: [{ kind: "duo" }, { kind: "dummy", mode: "stand" }],
      sfx: (n) => api.play(n)
    }) as Arena & { setDummy?: (mode: DummyMode) => void };
    arena = created;

    const row = document.createElement("div");
    row.className = "cc-train";
    for (const mode2 of DUMMY_MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cc-open cc-ghost";
      b.textContent = DUMMY_LABELS[mode2];
      b.addEventListener("click", () => {
        api.play("tap");
        created.setDummy?.(mode2);
      });
      row.appendChild(b);
    }
    stage.appendChild(row);

    const wake = document.createElement("div");
    wake.className = "cc-note";
    wake.textContent = `起身三选一:${Object.values(WAKEUP_LABELS).join(" / ")}。超必 LV1 要 ${SUPER_LV1_COST} 能量,LV2 要 ${SUPER_LV2_COST}。`;
    stage.appendChild(wake);
  }

  menu();

  return {
    destroy() {
      arena?.destroy();
      arena = null;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" },
  // 训练场不是一种对局模式,不归 meta.modes 管,永远开着
  { key: "train" }
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
  bar.className = "cc-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "cc-modetip";
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

  MODE_KEYS.forEach((mkey) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cc-open";
    btn.textContent = MODE_TITLE[mkey];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, mkey, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "轻击命中之后马上按重击就是取消,连段一下子就长了。",
      grandMessage: "188 关全部拿下,连招杯冠军就是你!",
      guideTitle: "连招对决 · 帧数笔记"
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
export const CLASH_CONSTS = {
  STAGE_HEIGHT,
  GROUND_Y,
  cutin: superCutinFrames(false),
  moveTotal: (id: string, slot: MoveSlot): number => totalFrames(characterById(id).moves[slot])
};
