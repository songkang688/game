import { meta } from "./meta";
export { meta };

// 跳跳台 —— 按住蓄力,松手跳到下一座台。
//
// 手感、台面、关卡、幽灵全在 physics.ts / pads.ts / run.ts / levels.ts / ai.ts 里,
// 这个文件只负责把它画出来、把手指和键盘接上去:
// Canvas 伪 2.5D(椭圆台面 + 侧壁,纯数学等距投影,没有任何 3D 库),
// 底下一根蓄力条,蓄力时角色压扁、起跳拉伸、落地扬起小尘土。
// 四种玩法都在这儿:188 关闯关、幽灵对战、无尽跳、双人上下分屏。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { TIER_FACES, TIER_NAMES, ghostLine, playGhost, type AiTier, type GhostRun } from "./ai";
import guideBook from "./guide";
import {
  CATCH_LINE,
  CHAPTERS,
  buildLevel,
  endlessDifficulty,
  levelPassed,
  levelStars,
  loseLine,
  matchDifficulty,
  matchSeed,
  winLine,
  type HopLevel,
} from "./levels";
import { KIND_ICONS, KIND_NAMES, padTick, perfectRadius, type Difficulty, type Pad } from "./pads";
import { MAX_HOLD, clamp, clamp01, jumpApex, landPoint, powerFromHold, type Point } from "./physics";
import { aimYaw, createRun, hop, requiredPower, type HopResult, type RunState } from "./run";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.hp-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:none;display:flex;flex-direction:column;gap:8px;
  background:linear-gradient(180deg,#FFF3E8,#F1F0FF);border-radius:18px;padding:10px;position:relative;}
.hp-bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:6px;}
.hp-open{border:none;border-radius:16px;min-height:44px;padding:9px 16px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;background:linear-gradient(180deg,#F2A268,#DB7F42);
  box-shadow:0 4px 0 #B4642F;}
.hp-open:active{transform:translateY(2px);box-shadow:0 2px 0 #B4642F;}
.hp-open-vs{background:linear-gradient(180deg,#7FA7EA,#5A82C9);box-shadow:0 4px 0 #446299;}
.hp-open-vs:active{box-shadow:0 2px 0 #446299;}
.hp-open-duo{background:linear-gradient(180deg,#EE94BE,#D66E9C);box-shadow:0 4px 0 #AB5178;}
.hp-open-duo:active{box-shadow:0 2px 0 #AB5178;}
.hp-shell{display:flex;flex-direction:column;gap:8px;}
.hp-shelltop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.hp-back{border:none;border-radius:999px;min-height:40px;padding:7px 13px;font-size:15px;font-weight:900;
  cursor:pointer;background:#ffffffd9;color:#9A5A2C;box-shadow:0 3px 0 rgba(170,120,70,.3);font-family:inherit;}
.hp-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,70,.3);}
.hp-chip{flex:1;text-align:center;font-size:16px;font-weight:900;color:#9A5A2C;min-width:120px;}
.hp-stage{position:relative;border-radius:16px;overflow:hidden;background:#FFF8F0;
  box-shadow:0 4px 14px rgba(190,150,120,.22);}
.hp-canvas{display:block;width:100%;height:auto;}
/* 整块画面都是蓄力热区:360px 单手随便按哪儿都能蓄力 */
.hp-hot{position:absolute;inset:0;cursor:pointer;background:transparent;border:none;padding:0;margin:0;}
.hp-hud{position:absolute;left:10px;top:8px;right:10px;display:flex;justify-content:space-between;
  gap:8px;pointer-events:none;font-size:17px;font-weight:900;color:#8A5330;text-shadow:0 1px 0 #fff;}
.hp-hud-r{color:#B4437B;}
.hp-say{text-align:center;font-size:15px;font-weight:800;color:#8A6A50;line-height:1.5;min-height:22px;}
.hp-say-oops{color:#C1567F;}
.hp-over{position:absolute;inset:0;background:rgba(255,248,242,.95);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;}
.hp-over-t{font-size:21px;font-weight:900;color:#9A5A2C;}
.hp-over-s{font-size:16px;font-weight:700;color:#7C6350;line-height:1.6;max-width:300px;}
.hp-tip{text-align:center;font-size:13px;font-weight:700;color:#9A8676;line-height:1.5;}
.hp-duo{display:flex;flex-direction:column;gap:8px;}
.hp-name{position:absolute;left:10px;bottom:8px;font-size:15px;font-weight:900;color:#8A5330;
  pointer-events:none;text-shadow:0 1px 0 #fff;}
@media (max-width:420px){
  .hp-chip{font-size:16px;}
  .hp-open{padding:9px 13px;font-size:15px;}
}
`;

// ---------------------------------------------------------------------------
// 投影:等距伪 2.5D,纯数学,不引任何 3D 库
// ---------------------------------------------------------------------------

/** 纵深方向压扁多少(等距透视的味道就靠它) */
export const DEPTH_SQUASH = 0.52;
/** 台面侧壁厚度(世界单位) */
export const WALL_H = 26;
/** 掉下去的动画时长(秒):必须先掉再结算,禁止瞬死 */
export const FALL_TIME = 1.15;
/** 底部蓄力条的高度(CSS 像素),360px 上也要看得清 */
export const CHARGE_BAR_H = 16;

export interface Camera {
  x: number;
  z: number;
  /** 世界单位 → 像素 */
  scale: number;
  /** 画面宽高(CSS 像素) */
  w: number;
  h: number;
  /** 落地时镜头往下沉一点(reduced-motion 下恒为 0) */
  shake: number;
}

/** 世界坐标 → 屏幕坐标(纯函数,单测直接查) */
export function project(cam: Camera, x: number, z: number, y = 0): { sx: number; sy: number } {
  return {
    sx: cam.w / 2 + (x - cam.x) * cam.scale,
    sy: cam.h * 0.74 - (z - cam.z) * cam.scale * DEPTH_SQUASH - y * cam.scale + cam.shake,
  };
}

/** 画面能装下多少纵深:决定 scale。台面最远也要能看见前面两三座 */
export function fitScale(w: number, h: number): number {
  return Math.max(0.5, Math.min(w / 620, h / 560));
}

// ---------------------------------------------------------------------------
// 画一座台面:椭圆台顶 + 侧壁 + 完美圈
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

const PAD_TOP: Record<string, string> = {
  steady: "#FFD9B4",
  slider: "#BFDCFF",
  shrink: "#DCD7FF",
  spring: "#FFC9E2",
  once: "#BFEFDF",
};
const PAD_SIDE: Record<string, string> = {
  steady: "#D9A473",
  slider: "#8AAEDC",
  shrink: "#A9A1DE",
  spring: "#DB93B8",
  once: "#84C4AC",
};

function ellipse(ctx: Ctx, sx: number, sy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(sx, sy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
}

function drawPad(ctx: Ctx, cam: Camera, pad: Pad, isTarget: boolean): void {
  if (!pad.alive || pad.r <= 0) return;
  const top = project(cam, pad.x, pad.z, 0);
  const rx = pad.r * cam.scale;
  const ry = pad.r * cam.scale * DEPTH_SQUASH;
  const wall = WALL_H * cam.scale;

  // 侧壁:上下两个椭圆之间的一段柱身
  ctx.fillStyle = PAD_SIDE[pad.kind] ?? PAD_SIDE.steady;
  ctx.beginPath();
  ctx.ellipse(top.sx, top.sy + wall, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(top.sx - rx, top.sy);
  ctx.ellipse(top.sx, top.sy, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  // 台顶
  ctx.fillStyle = PAD_TOP[pad.kind] ?? PAD_TOP.steady;
  ellipse(ctx, top.sx, top.sy, rx, ry);
  ctx.fill();

  // 完美圈:浅浅一圈,告诉孩子要往哪儿落
  const pr = perfectRadius(pad) * cam.scale;
  ctx.fillStyle = isTarget ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.55)";
  ellipse(ctx, top.sx, top.sy, pr, pr * DEPTH_SQUASH);
  ctx.fill();

  if (pad.kind !== "steady") {
    ctx.fillStyle = "#7A5638";
    ctx.font = `${Math.round(15 * cam.scale + 5)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(KIND_ICONS[pad.kind], top.sx, top.sy + ry * 0.55);
  }
}

/** 角色:一个圆滚滚的小家伙,蓄力压扁、起跳拉伸 */
function drawHero(
  ctx: Ctx,
  cam: Camera,
  pos: { x: number; z: number; y: number },
  squash: number,
  color: string
): void {
  const p = project(cam, pos.x, pos.z, pos.y);
  const base = 15 * cam.scale;
  const rx = base * (1 + squash * 0.42);
  const ry = base * (1 - squash * 0.46);

  // 影子落在地面高度上
  const ground = project(cam, pos.x, pos.z, 0);
  ctx.fillStyle = "rgba(120,90,70,.18)";
  ellipse(ctx, ground.sx, ground.sy, rx * 0.9, rx * 0.42);
  ctx.fill();

  ctx.fillStyle = color;
  ellipse(ctx, p.sx, p.sy - ry, rx, ry * 1.25);
  ctx.fill();
  ctx.fillStyle = "#40332B";
  ellipse(ctx, p.sx - rx * 0.34, p.sy - ry * 1.35, rx * 0.14, ry * 0.2);
  ctx.fill();
  ellipse(ctx, p.sx + rx * 0.34, p.sy - ry * 1.35, rx * 0.14, ry * 0.2);
  ctx.fill();
}

/** 接住人的那朵云 */
function drawCloud(ctx: Ctx, sx: number, sy: number, s: number): void {
  ctx.fillStyle = "#FFFFFF";
  for (const [dx, dy, r] of [
    [-1.1, 0.1, 0.72],
    [0, -0.25, 0.95],
    [1.1, 0.1, 0.72],
    [0, 0.32, 0.8],
  ]) {
    ellipse(ctx, sx + dx * s, sy + dy * s, r * s, r * s * 0.72);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// 一条台路 = 一块画布 + 一套输入
// ---------------------------------------------------------------------------

export type StagePhase = "ready" | "charging" | "flying" | "falling" | "over";

export interface StageOpts {
  seed: number;
  difficulty: Difficulty;
  /** 站住这么多座就算达标(无尽传 Infinity) */
  goal?: number;
  /** 训练关:画出落点辅助圆 */
  assist?: boolean;
  /** 这一路认哪些键蓄力(不区分大小写) */
  keys?: readonly string[];
  /** 分屏时显示的名字 */
  name?: string;
  /** 角色颜色 */
  color?: string;
  /** 画布高度(CSS 像素),不给就按宽度自适应 */
  height?: number;
  /** 无尽模式:每跳一座重算一次难度 */
  ramp?: (hops: number) => Difficulty;
  sfx: (n: SoundName) => void;
  /** 每一跳落地后回调 */
  onHop?: (res: HopResult, run: RunState) => void;
  /** 站满 goal 座 */
  onGoal?: (run: RunState) => void;
  /** 掉下去、这一局结束(下落动画播完才会调) */
  onOver?: (run: RunState) => void;
  /** 顶栏右边那行小字 */
  info?: () => string;
}

export interface Stage {
  destroy: () => void;
  /** 给单测用:直接开始 / 结束蓄力,不必伪造指针事件 */
  press: () => void;
  release: (holdMs?: number) => void;
  phase: () => StagePhase;
  state: () => RunState;
  /** 暂停 / 继续 */
  setPaused: (v: boolean) => void;
  /** 手动推进 n 毫秒(单测用) */
  tick: (ms: number) => void;
  /** 当前镜头(单测查 reduced-motion 有没有真的不晃) */
  camera: () => Camera;
  root: HTMLElement;
}

interface Leg {
  from: Point;
  to: Point;
  apex: number;
  dur: number;
}

function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return Boolean(mm?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

export function createStage(host: HTMLElement, opts: StageOpts): Stage {
  const reduced = prefersReducedMotion();
  const keys = (opts.keys ?? ["f", " ", "spacebar"]).map((k) => k.toLowerCase());
  const heroColor = opts.color ?? "#F2A268";
  const goal = opts.goal ?? Number.POSITIVE_INFINITY;

  const root = document.createElement("div");
  root.className = "hp-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "hp-canvas";
  const hud = document.createElement("div");
  hud.className = "hp-hud";
  const hudL = document.createElement("span");
  const hudR = document.createElement("span");
  hudR.className = "hp-hud-r";
  hud.append(hudL, hudR);
  const hot = document.createElement("button");
  hot.type = "button";
  hot.className = "hp-hot";
  hot.setAttribute("aria-label", "按住蓄力,松手起跳");
  root.append(canvas, hud, hot);
  if (opts.name) {
    const tag = document.createElement("div");
    tag.className = "hp-name";
    tag.textContent = opts.name;
    root.appendChild(tag);
  }
  host.appendChild(root);

  let run: RunState = createRun(opts.seed, opts.difficulty);
  let phase: StagePhase = "ready";
  let clock = 0;
  let holdMs = 0;
  let paused = false;
  let over = false;
  let goalHit = false;
  let dust = 0;
  let fallT = 0;
  let legs: Leg[] = [];
  let legIndex = 0;
  let legT = 0;
  let pending: { state: RunState; result: HopResult } | null = null;
  let heroPos = { x: 0, z: 0, y: 0 };
  let flashText = "";
  let flashT = 0;
  const cam: Camera = { x: 0, z: 0, scale: 1, w: 360, h: 400, shake: 0 };

  // ---- 画布尺寸 ----
  function resize(): void {
    const cssW = Math.max(240, host.clientWidth || root.clientWidth || 360);
    const cssH = opts.height ?? Math.round(clamp(cssW * 1.06, 280, 460));
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    cam.w = cssW;
    cam.h = cssH;
    cam.scale = fitScale(cssW, cssH);
  }
  resize();

  const ctx = canvas.getContext("2d") as Ctx | null;

  function heroAt(): { x: number; z: number; y: number } {
    return heroPos;
  }

  function power(): number {
    return powerFromHold(holdMs);
  }

  // ---- 蓄力 / 起跳 ----
  function press(): void {
    if (paused || over || phase !== "ready") return;
    phase = "charging";
    holdMs = 0;
  }

  function buildLegs(step: { state: RunState; result: HopResult }): Leg[] {
    const out: Leg[] = [];
    let node: HopResult | null = step.result;
    while (node) {
      out.push({
        from: { x: node.from.x, z: node.from.z },
        to: { x: node.landing.x, z: node.landing.z },
        apex: jumpApex(node.power),
        dur: node.flight,
      });
      node = node.bonus;
    }
    return out;
  }

  function release(forcedHold?: number): void {
    if (paused || over || phase !== "charging") return;
    if (forcedHold !== undefined) holdMs = forcedHold;
    const p = power();
    run = { ...run, time: clock };
    pending = hop(run, p);
    legs = buildLegs(pending);
    legIndex = 0;
    legT = 0;
    phase = "flying";
    holdMs = 0;
    opts.sfx("jump");
  }

  function settleLanding(): void {
    if (!pending) return;
    const res = pending.result;
    run = pending.state;
    clock = run.time;
    pending = null;

    if (res.verdict === "miss") {
      phase = "falling";
      fallT = 0;
      opts.sfx("oops");
      flashText = CATCH_LINE;
      flashT = FALL_TIME + 1;
      return;
    }

    phase = "ready";
    dust = 1;
    if (!reduced) cam.shake = 5;
    if (res.verdict === "perfect") {
      opts.sfx("coin");
      flashText = res.combo > 1 ? `踩中圆心!${res.combo} 连` : "踩中圆心!";
    } else {
      opts.sfx("tap");
      flashText = "站住啦,连击重新数";
    }
    flashT = 1.1;
    if (res.bonus) {
      opts.sfx("pop");
      flashText = `弹簧台!直接送你一跳,${run.combo} 连`;
    }
    if (opts.ramp) run = { ...run, difficulty: opts.ramp(run.hops) };
    opts.onHop?.(res, run);
    if (!goalHit && run.hops >= goal) {
      goalHit = true;
      opts.sfx("win");
      opts.onGoal?.(run);
    }
  }

  function finishFall(): void {
    if (over) return;
    over = true;
    phase = "over";
    opts.onOver?.(run);
  }

  // ---- 每帧 ----
  function step(dt: number): void {
    if (phase === "ready" || phase === "charging") {
      clock += dt;
      run.time = clock;
      if (phase === "charging") holdMs = Math.min(MAX_HOLD * 1.6, holdMs + dt * 1000);
      const cur = padTick(run.pads[run.index], clock);
      heroPos = { x: cur.x, z: cur.z, y: 0 };
    } else if (phase === "flying") {
      clock += dt;
      const leg = legs[legIndex];
      if (!leg) {
        settleLanding();
      } else {
        legT += dt;
        const u = clamp01(leg.dur > 0 ? legT / leg.dur : 1);
        heroPos = {
          x: leg.from.x + (leg.to.x - leg.from.x) * u,
          z: leg.from.z + (leg.to.z - leg.from.z) * u,
          y: 4 * leg.apex * u * (1 - u),
        };
        if (u >= 1) {
          legIndex++;
          legT = 0;
          if (legIndex >= legs.length) settleLanding();
        }
      }
    } else if (phase === "falling") {
      clock += dt;
      fallT += dt;
      // 往屏幕下方掉出去,再由云朵接住 —— 掉下去不是死亡
      heroPos = { ...heroPos, y: -260 * fallT * fallT };
      if (fallT >= FALL_TIME) finishFall();
    }

    if (dust > 0) dust = Math.max(0, dust - dt * 2.4);
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    cam.shake = reduced ? 0 : cam.shake * 0.86;

    // 镜头平滑跟到角色身上
    const follow = reduced ? 1 : Math.min(1, dt * 6);
    const target = heroAt();
    cam.x += (target.x - cam.x) * follow;
    cam.z += (target.z + 60 - cam.z) * follow;
  }

  // ---- 画 ----
  function draw(): void {
    if (!ctx) return;
    const dpr = canvas.width / Math.max(1, cam.w);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, cam.h);
    sky.addColorStop(0, "#FFF3E4");
    sky.addColorStop(1, "#EDE9FF");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cam.w, cam.h);

    // 远处的台子先画,近处的后画,自然叠出前后关系
    const from = Math.max(0, run.index - 1);
    const to = Math.min(run.pads.length - 1, run.index + 4);
    for (let i = to; i >= from; i--) {
      drawPad(ctx, cam, padTick(run.pads[i], clock), i === run.index + 1);
    }

    // 训练关的落点辅助圆:告诉你现在松手会落在哪儿
    if (opts.assist && phase === "charging") {
      const cur = padTick(run.pads[run.index], clock);
      const hit = landPoint(cur, power(), aimYaw({ ...run, time: clock }));
      const p = project(cam, hit.x, hit.z, 0);
      ctx.strokeStyle = "#E2703A";
      ctx.lineWidth = 3;
      ellipse(ctx, p.sx, p.sy, 14 * cam.scale, 14 * cam.scale * DEPTH_SQUASH);
      ctx.stroke();
    }

    if (dust > 0) {
      const g = project(cam, heroPos.x, heroPos.z, 0);
      ctx.fillStyle = `rgba(214,180,150,${0.4 * dust})`;
      ellipse(ctx, g.sx, g.sy, 30 * cam.scale * (1.4 - dust), 12 * cam.scale * (1.4 - dust));
      ctx.fill();
    }

    if (phase !== "over") {
      const squash = phase === "charging" && !reduced ? power() * 0.85 : 0;
      drawHero(ctx, cam, heroAt(), squash, heroColor);
    }

    if (phase === "falling" || phase === "over") {
      const g = project(cam, heroPos.x, heroPos.z, 0);
      drawCloud(ctx, g.sx, Math.min(cam.h - 40, g.sy + 70), 26 * cam.scale);
    }

    drawChargeBar(ctx);

    if (flashT > 0 && flashText) {
      ctx.fillStyle = "#8A5330";
      ctx.font = `900 ${Math.round(15 + 3 * cam.scale)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(flashText, cam.w / 2, cam.h * 0.16);
    }
  }

  /** 底部蓄力条:≥12px 高,360px 上也一眼看得清 */
  function drawChargeBar(ctx2: Ctx): void {
    const h = CHARGE_BAR_H;
    const pad = 14;
    const y = cam.h - h - 12;
    const w = cam.w - pad * 2;
    ctx2.fillStyle = "rgba(255,255,255,.8)";
    ctx2.fillRect(pad, y, w, h);
    ctx2.fillStyle = "#F2A268";
    ctx2.fillRect(pad, y, w * clamp01(power()), h);
    // 刻度:正好够到下一座台心的那个力度
    const need = clamp01(requiredPower({ ...run, time: clock }));
    ctx2.fillStyle = "#B4437B";
    ctx2.fillRect(pad + w * need - 2, y - 4, 4, h + 8);
  }

  // ---- HUD ----
  function refreshHud(): void {
    const goalText = Number.isFinite(goal) ? ` / ${goal}` : "";
    hudL.textContent = `⭕ ${run.hops}${goalText} 座 · ${run.score} 分`;
    hudR.textContent = opts.info ? opts.info() : run.combo > 1 ? `🔥 ${run.combo} 连` : "";
  }

  // ---- 主循环 ----
  let raf = 0;
  let last = 0;
  function frame(ts: number): void {
    raf = requestAnimationFrame(frame);
    const now = typeof ts === "number" ? ts : 0;
    const dt = last === 0 ? 0.016 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) step(dt);
    draw();
    refreshHud();
  }
  raf = requestAnimationFrame(frame);

  // ---- 输入:整块画面都能按 ----
  const onDown = (ev: { preventDefault?: () => void }): void => {
    ev.preventDefault?.();
    press();
  };
  const onUp = (): void => {
    if (phase === "charging") release();
  };
  const onKeyDown = (ev: { key?: string; repeat?: boolean; preventDefault?: () => void }): void => {
    const k = (ev.key ?? "").toLowerCase();
    if (!keys.includes(k)) return;
    ev.preventDefault?.();
    if (ev.repeat) return;
    press();
  };
  const onKeyUp = (ev: { key?: string }): void => {
    const k = (ev.key ?? "").toLowerCase();
    if (!keys.includes(k)) return;
    if (phase === "charging") release();
  };

  hot.addEventListener("pointerdown", onDown as EventListener);
  hot.addEventListener("touchstart", onDown as EventListener);
  const win = globalThis as unknown as {
    addEventListener: (t: string, f: unknown) => void;
    removeEventListener: (t: string, f: unknown) => void;
  };
  win.addEventListener("pointerup", onUp);
  win.addEventListener("pointercancel", onUp);
  win.addEventListener("touchend", onUp);
  win.addEventListener("keydown", onKeyDown);
  win.addEventListener("keyup", onKeyUp);
  win.addEventListener("resize", resize);

  return {
    root,
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      hot.removeEventListener("pointerdown", onDown as EventListener);
      hot.removeEventListener("touchstart", onDown as EventListener);
      win.removeEventListener("pointerup", onUp);
      win.removeEventListener("pointercancel", onUp);
      win.removeEventListener("touchend", onUp);
      win.removeEventListener("keydown", onKeyDown);
      win.removeEventListener("keyup", onKeyUp);
      win.removeEventListener("resize", resize);
      root.remove();
    },
    press,
    release,
    phase: () => phase,
    state: () => run,
    camera: () => cam,
    setPaused: (v: boolean) => {
      paused = v;
    },
    tick: (ms: number) => {
      const dt = ms / 1000;
      let left = dt;
      while (left > 0) {
        const slice = Math.min(0.032, left);
        if (!paused) step(slice);
        left -= slice;
      }
      draw();
      refreshHud();
    },
  };
}

// ---------------------------------------------------------------------------
// 外壳:返回键 + 标题 + 一块舞台 + 一行说明
// ---------------------------------------------------------------------------

interface Shell {
  wrap: HTMLElement;
  chip: HTMLElement;
  body: HTMLElement;
  say: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  const wrap = document.createElement("div");
  wrap.className = "hp-shell";
  const top = document.createElement("div");
  top.className = "hp-shelltop";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "hp-back";
  back.textContent = "← 返回";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("div");
  chip.className = "hp-chip";
  chip.textContent = title;
  top.append(back, chip);
  const body = document.createElement("div");
  const say = document.createElement("div");
  say.className = "hp-say";
  wrap.append(top, body, say);
  host.appendChild(wrap);
  return {
    wrap,
    chip,
    body,
    say,
    destroy() {
      wrap.remove();
    },
  };
}

/** 一块结算浮层 */
function overPanel(host: HTMLElement, title: string, sub: string, label: string, onAgain: () => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "hp-over";
  const t = document.createElement("div");
  t.className = "hp-over-t";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "hp-over-s";
  s.textContent = sub;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hp-open";
  btn.textContent = label;
  btn.addEventListener("click", onAgain);
  box.append(t, s, btn);
  host.appendChild(box);
  return box;
}

// ---------------------------------------------------------------------------
// 闯关:188 关
// ---------------------------------------------------------------------------

function playLevel(stageHost: HTMLElement, ctx: PlayCtx): PlayHandle {
  const lv: HopLevel = buildLevel(ctx.level);
  const box = document.createElement("div");
  const tip = document.createElement("div");
  tip.className = "hp-tip";
  tip.textContent = `${lv.hint}${lv.assist ? " · 蓄力时会画出落点辅助圆" : ""}`;
  const say = document.createElement("div");
  say.className = "hp-say";
  say.textContent = "按住屏幕(或空格 / F)蓄力,松手起跳。";
  box.append(tip, say);
  stageHost.appendChild(box);

  let settled = false;
  const stage = createStage(box, {
    seed: lv.seed,
    difficulty: lv.difficulty,
    goal: lv.goal,
    assist: lv.assist,
    sfx: (n) => ctx.sfx(n),
    onHop: (res, run) => {
      if (res.verdict === "perfect") say.textContent = `踩中圆心!连击 ${run.combo}`;
      else say.textContent = "站住了,连击重新数,下一跳往中间收一点。";
      say.className = "hp-say";
    },
    onGoal: (run) => {
      if (settled) return;
      settled = true;
      const res = { cleared: run.hops, perfects: run.perfects, score: run.score, bestCombo: run.bestCombo };
      const stars = levelStars(lv, res);
      ctx.win(stars, winLine(lv, res, stars));
    },
    onOver: (run) => {
      if (settled) return;
      settled = true;
      const res = { cleared: run.hops, perfects: run.perfects, score: run.score, bestCombo: run.bestCombo };
      if (levelPassed(lv, res)) {
        const stars = levelStars(lv, res);
        ctx.win(stars, winLine(lv, res, stars));
      } else {
        ctx.lose(loseLine(lv, res));
      }
    },
  });

  let paused = false;
  const onEsc = (ev: { key?: string }): void => {
    if ((ev.key ?? "").toLowerCase() !== "escape") return;
    paused = !paused;
    stage.setPaused(paused);
    say.textContent = paused ? "已暂停,再按一次 Esc 继续。" : "继续跳!";
  };
  const win = globalThis as unknown as {
    addEventListener: (t: string, f: unknown) => void;
    removeEventListener: (t: string, f: unknown) => void;
  };
  win.addEventListener("keydown", onEsc);

  return {
    destroy() {
      win.removeEventListener("keydown", onEsc);
      stage.destroy();
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:一直跳下去,记最高分
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽跳");
  let best = save.getGameProgress(meta.id).endlessBest;
  let stage: Stage | null = null;
  let panel: HTMLElement | null = null;

  function start(): void {
    stage?.destroy();
    panel?.remove();
    panel = null;
    shell.chip.textContent = `♾️ 无尽跳 · 最好 ${best} 分`;
    shell.say.textContent = "按住任意位置蓄力,松手起跳。台子会越来越小,慢慢来。";
    shell.say.className = "hp-say";
    stage = createStage(shell.body, {
      seed: (Date.now() % 1_000_000) + 17,
      difficulty: endlessDifficulty(0),
      ramp: endlessDifficulty,
      sfx: (n) => api.play(n),
      info: () => `最好 ${best} 分`,
      onHop: (res, run) => {
        if (res.verdict === "perfect" && run.combo > 0 && run.combo % 5 === 0) api.addStars(1);
      },
      onOver: (run) => {
        best = save.recordEndlessBest(meta.id, run.score);
        shell.say.textContent = `${CATCH_LINE}。`;
        shell.say.className = "hp-say hp-say-oops";
        panel = overPanel(
          stage!.root,
          "☁️ 云朵接住你啦",
          `这一局站住 ${run.hops} 座,拿了 ${run.score} 分,最高连击 ${run.bestCombo}。历史最好 ${best} 分。`,
          "🔁 再来一次",
          () => {
            api.play("tap");
            start();
          }
        );
      },
    });
  }

  start();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:和幽灵跑同一条台序比分
// ---------------------------------------------------------------------------

/** 对战一局跳多少座 */
export const MATCH_HOPS = 16;

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "⚔️ 幽灵对战");
  let tier: AiTier = "normal";
  let round = 1;
  const wins = [0, 0];
  let stage: Stage | null = null;
  let panel: HTMLElement | null = null;

  function pickPanel(): void {
    stage?.destroy();
    stage = null;
    panel?.remove();
    panel = null;
    shell.body.innerHTML = "";
    shell.chip.textContent = "⚔️ 幽灵对战 · 挑一个对手";
    shell.say.textContent = "你和幽灵跑同一条台序,谁的分高谁赢。";
    const box = document.createElement("div");
    box.className = "hp-bar";
    for (const t of ["rookie", "normal", "expert", "hell"] as AiTier[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `hp-open${tier === t ? "" : " hp-open-vs"}`;
      b.textContent = `${TIER_FACES[t]} ${TIER_NAMES[t]}`;
      b.addEventListener("click", () => {
        api.play("tap");
        tier = t;
        pickPanel();
      });
      box.appendChild(b);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "hp-open";
    go.textContent = "开跳 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      startRound();
    });
    shell.body.append(box, go);
  }

  function startRound(): void {
    stage?.destroy();
    panel?.remove();
    panel = null;
    shell.body.innerHTML = "";
    const seed = matchSeed(round);
    const diff = matchDifficulty(round);
    const ghost: GhostRun = playGhost(seed, diff, tier, MATCH_HOPS);
    shell.chip.textContent = `⚔️ 第 ${round} 局 · 你 ${wins[0]} : ${wins[1]} ${TIER_NAMES[tier]}`;
    shell.say.textContent = `${TIER_FACES[tier]} ${TIER_NAMES[tier]}幽灵在这条台序上拿了 ${ghost.score} 分,轮到你了。`;
    shell.say.className = "hp-say";

    let done = false;
    function finish(run: RunState): void {
      if (done) return;
      done = true;
      const iWin = run.score > ghost.score;
      if (iWin) {
        wins[0]++;
        api.addStars(1);
      } else if (run.score < ghost.score) {
        wins[1]++;
      }
      panel = overPanel(
        stage!.root,
        iWin ? "🏆 这一局你赢了!" : run.score === ghost.score ? "🤝 打成平手" : "☁️ 云朵接住你啦",
        ghostLine(tier, ghost, run.score),
        "🔁 再来一局",
        () => {
          api.play("tap");
          round++;
          startRound();
        }
      );
    }

    stage = createStage(shell.body, {
      seed,
      difficulty: diff,
      goal: MATCH_HOPS,
      sfx: (n) => api.play(n),
      info: () => `${TIER_FACES[tier]} ${ghost.score} 分`,
      onGoal: finish,
      onOver: finish,
    });
  }

  pickPanel();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏:上下分屏,朵朵 F / 星星 L
// ---------------------------------------------------------------------------

/** 双人一局跳多少座 */
export const DUO_HOPS = 14;

function mountTwoPlayer(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "👫 双人同屏");
  let round = 1;
  const wins = [0, 0];
  let stages: Stage[] = [];
  let panel: HTMLElement | null = null;

  function startRound(): void {
    for (const s of stages) s.destroy();
    stages = [];
    panel?.remove();
    panel = null;
    shell.body.innerHTML = "";
    shell.chip.textContent = `👫 第 ${round} 局 · 朵朵 ${wins[0]} : ${wins[1]} 星星`;
    shell.say.textContent = "上半屏是朵朵,按 F 或按住上半块屏幕;下半屏是星星,按 L 或按住下半块。";
    shell.say.className = "hp-say";

    const seed = matchSeed(round + 500);
    const diff = matchDifficulty(round);
    const done = [false, false];
    const scores = [0, 0];

    function maybeSettle(): void {
      if (!done[0] || !done[1]) return;
      const line =
        scores[0] === scores[1]
          ? `${scores[0]} 比 ${scores[1]},平手!再来一局。`
          : scores[0] > scores[1]
            ? `朵朵 ${scores[0]} 分,星星 ${scores[1]} 分,这一局朵朵赢。`
            : `星星 ${scores[1]} 分,朵朵 ${scores[0]} 分,这一局星星赢。`;
      if (scores[0] > scores[1]) wins[0]++;
      else if (scores[1] > scores[0]) wins[1]++;
      api.addStars(1);
      panel = overPanel(
        stages[0]?.root ?? shell.body,
        "🏁 这一局结束",
        `${line} 总比分 朵朵 ${wins[0]} : ${wins[1]} 星星。`,
        "🔁 再来一局",
        () => {
          api.play("tap");
          round++;
          startRound();
        }
      );
    }

    const wrap = document.createElement("div");
    wrap.className = "hp-duo";
    shell.body.appendChild(wrap);

    const seats: Array<{ name: string; keys: string[]; color: string }> = [
      { name: "🌸 朵朵 · F", keys: ["f"], color: "#F2A268" },
      { name: "⭐ 星星 · L", keys: ["l"], color: "#7FA7EA" },
    ];
    seats.forEach((seat, i) => {
      const st = createStage(wrap, {
        seed,
        difficulty: diff,
        goal: DUO_HOPS,
        keys: seat.keys,
        name: seat.name,
        color: seat.color,
        height: 236,
        sfx: (n) => api.play(n),
        onGoal: (run) => {
          if (done[i]) return;
          done[i] = true;
          scores[i] = run.score;
          maybeSettle();
        },
        onOver: (run) => {
          if (done[i]) return;
          done[i] = true;
          scores[i] = run.score;
          maybeSettle();
        },
      });
      stages.push(st);
    });
  }

  startRound();
  return {
    destroy() {
      for (const s of stages) s.destroy();
      stages = [];
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  root.className = "hp-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "hp-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "hp-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "hp-open hp-open-vs";
  vsBtn.textContent = "⚔️ 幽灵对战";
  const duoBtn = document.createElement("button");
  duoBtn.type = "button";
  duoBtn.className = "hp-open hp-open-duo";
  duoBtn.textContent = "👫 双人同屏";
  bar.append(endlessBtn, vsBtn, duoBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽跳 · 最好 ${best} 分` : "♾️ 无尽跳 · 点我开始!";
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
  duoBtn.addEventListener("click", () => openMode(mountTwoPlayer));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: `按住蓄力、松手起跳,踩中${KIND_NAMES.steady}中间的圆心才算完美。掉下去有云朵接着,不怕。`,
      grandMessage: "188 关全部跳完,你就是跳跳台上最稳的那一个!",
      guide: guideBook,
      guideTitle: "跳跳台 · 手感手记",
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
