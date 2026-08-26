import { meta } from "./meta";
export { meta };

// 雪球大作战:侧视雪原上的回合制投掷。
// 抬角度、看风标、按住蓄力,松手把雪球抛出去;冰砖掩体能砸碎,也能自己堆雪墙挡一挡。
// 四种玩法:188 关闯关、双人对战、人机对战(三档)、无尽雪怪车轮战。
// 全程没有血量与淘汰:雪灯笼和雪怪化成一摊雪,被砸中的人只是变一会儿雪人,歇一回合接着玩。
import { mountLevelGame, mulberry32, rateAbove, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import {
  CHAPTERS,
  CHAPTER_NEW,
  LEVEL_TOTAL,
  VIEW_W,
  buildLevel,
  chapterIndexOf,
  duelMatch,
  endlessMatch,
  levelMatch,
} from "./levels";
import {
  ANGLE_STEP,
  BALL_R,
  BODY_R,
  CHARGE_CYCLE,
  GUARD_X,
  KEY_MAP,
  PAUSE_KEY,
  addTargets,
  aiPlan,
  buildWall,
  chargeAt,
  createMatch,
  current,
  endlessTargets,
  flyShot,
  liveTargets,
  loseLine,
  rateLevel,
  stepAngle,
  takeShot,
  winLine,
  type Cover,
  type Match,
  type SnowAction,
  type Target,
  type Thrower,
  type TurnOutcome,
} from "./logic";
import { AI_PROFILES, FIELD_W, GROUND_Y, trajectory, windLabel, type AiLevel, type ThrowSpec, type Vec } from "./physics";

const P_NAME = ["朵朵", "星星"];
const P_MARK = ["🌸", "⭐"];
const P_COLOR = ["#e8558f", "#3f7fd6"];
const P_KEYS = ["W/S 调角度 · A/D 挪位置 · 按住 F 蓄力 · G 堆雪墙", "↑/↓ 调角度 · ←/→ 挪位置 · 按住 L 蓄力 · K 堆雪墙"];

/** 画面往上画到多少个单位高(再高的雪球就飞出画面了,不影响判定) */
const VIEW_H = 13;
/** 地面线下面留几个像素画雪地 */
const GROUND_PAD = 16;
/** 一个人一回合最多能挪多远 */
const STEP_X = 0.35;

const CSS = `
.sf-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;align-items:center;}
.sf-hud{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%;}
.sf-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#4f5b78;
  box-shadow:0 2px 6px rgba(140,160,190,.26);white-space:nowrap;}
.sf-chip-turn{background:#fff0f6;color:#b8436f;}
.sf-chip-turn1{background:#e6f0ff;color:#2f5fa8;}
.sf-board{position:relative;line-height:0;width:100%;display:flex;justify-content:center;}
.sf-canvas{display:block;border-radius:14px;background:#dceaf8;touch-action:none;
  box-shadow:0 4px 14px rgba(110,140,180,.3);}
.sf-over{position:absolute;inset:0;border-radius:14px;background:rgba(252,253,255,.94);display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:14px;}
.sf-over-t{font-size:20px;font-weight:900;color:#3f6ea8;line-height:1.3;}
.sf-over-s{font-size:14px;font-weight:700;color:#5b6885;line-height:1.6;max-width:300px;}
.sf-say{font-size:13px;font-weight:800;color:#4f5b78;text-align:center;line-height:1.5;max-width:440px;min-height:20px;}
.sf-tip{font-size:12.5px;font-weight:700;color:#6b7794;text-align:center;line-height:1.5;max-width:440px;}
.sf-pads{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;width:100%;}
.sf-pad{display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 8px;border-radius:14px;background:#ffffffb0;}
.sf-pad-on{background:#fff6fa;box-shadow:0 0 0 2px #f3b6cf inset;}
.sf-pad-on1{background:#f2f7ff;box-shadow:0 0 0 2px #a9c6ee inset;}
.sf-pad-t{font-size:11.5px;font-weight:900;text-align:center;line-height:1.4;}
.sf-row{display:flex;gap:5px;align-items:center;}
.sf-btn{border:none;border-radius:12px;min-width:44px;min-height:40px;padding:2px 8px;font-size:15px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#42557a;background:#e8f0fb;
  box-shadow:0 3px 0 rgba(120,150,190,.4);}
.sf-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,150,190,.4);}
.sf-btn:disabled{opacity:.42;cursor:default;}
.sf-btn-throw{background:#ffdbe6;color:#a83a68;box-shadow:0 3px 0 rgba(200,110,150,.42);min-width:96px;}
.sf-btn-wall{background:#eef6ff;color:#3a6ba8;box-shadow:0 3px 0 rgba(110,150,200,.42);}
.sf-btn:focus-visible,.sf-act:focus-visible,.sf-open:focus-visible{outline:3px solid #2a3f6b;outline-offset:3px;}
.sf-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.sf-act{border:none;border-radius:999px;padding:7px 14px;font-size:13.5px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#4f6a9c;box-shadow:0 3px 0 rgba(110,140,180,.26);white-space:nowrap;}
.sf-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,180,.26);}
.sf-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.sf-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7fb2e0,#5b8ec4);box-shadow:0 4px 0 #43709e;}
.sf-open.sf-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.sf-open.sf-open-ai{background:linear-gradient(180deg,#9d9ae0,#7a76c9);box-shadow:0 4px 0 #5f5ba6;}
.sf-open:active{transform:translateY(2px);box-shadow:0 2px 0 #43709e;}
.sf-mode{border-radius:18px;padding:10px;background:linear-gradient(180deg,#eef5fd,#fff3f8);
  display:flex;flex-direction:column;gap:8px;align-items:center;}
.sf-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;}
.sf-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#52698c;box-shadow:0 3px 0 rgba(110,140,180,.3);}
.sf-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,180,.3);}
@media (max-width:420px){
  .sf-btn{min-width:40px;min-height:38px;font-size:14px;padding:2px 6px;}
  .sf-btn-throw{min-width:84px;}
  .sf-pads{gap:6px;}
  .sf-pad{padding:4px 6px;}
  .sf-open{padding:7px 11px;font-size:13px;}
  .sf-bar{gap:6px;margin-bottom:4px;}
  .sf-tip{font-size:11.5px;}
  .sf-say{font-size:12px;}
  .sf-chip{padding:4px 9px;font-size:12px;}
}
@media (prefers-reduced-motion:reduce){.sf-btn:active{transform:none;}}
`;

// ---------------------------------------------------------------------------
// 画面:全部程序化绘制,一张外部图片都不用
// ---------------------------------------------------------------------------

/** 手机上画面矮得看不清抛物线,至少给它这么多像素高 */
const MIN_BOARD_H = 150;

/**
 * 世界坐标 → 画布坐标。
 *
 * 横向是老老实实的等比缩放,竖向多了一个拉伸系数:场地有 54 格宽,
 * 挤进手机屏之后一格只剩六七个像素,抛物线会被压成一条直线。
 * 只把竖向拉高,落点、风偏这些「横着算」的东西一点都不受影响,
 * 弧线却看得清清楚楚——瞄准虚线指到哪儿,雪球就落到哪儿。
 */
interface Camera {
  /** 横向:一个世界单位有多少像素 */
  s: number;
  /** 竖向额外拉伸多少倍(宽屏上就是 1) */
  ys: number;
  /** 地面线在画布上的高度(下面还有一条雪地) */
  h: number;
}

function sx(cam: Camera, x: number): number {
  return x * cam.s;
}

function sy(cam: Camera, y: number): number {
  return cam.h - (y - GROUND_Y) * cam.s * cam.ys;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawSky(c: CanvasRenderingContext2D, cam: Camera, w: number, t: number): void {
  const g = c.createLinearGradient(0, 0, 0, cam.h);
  g.addColorStop(0, "#cfe3f7");
  g.addColorStop(1, "#f2f8ff");
  c.fillStyle = g;
  c.fillRect(0, 0, w, cam.h + GROUND_PAD);
  // 慢慢飘的雪:位置只跟时间有关,不占状态
  c.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 26; i++) {
    const px = ((i * 137.5 + t * 12) % (w + 20)) - 10;
    const py = ((i * 61.7 + t * 26) % (cam.h + 20)) - 10;
    c.beginPath();
    c.arc(px, py, Math.max(1, cam.s * 0.06) + (i % 3) * 0.4, 0, Math.PI * 2);
    c.fill();
  }
}

/** 远处的雪山和小松树:位置固定,只是让雪原不那么空 */
function drawBackdrop(c: CanvasRenderingContext2D, cam: Camera, w: number): void {
  const base = sy(cam, 0);
  c.fillStyle = "#e6eff9";
  for (const [cx, r] of [
    [0.22, 0.3],
    [0.55, 0.24],
    [0.86, 0.28],
  ] as Array<[number, number]>) {
    c.beginPath();
    c.ellipse(w * cx, base + 2, w * r, Math.max(14, cam.h * 0.3), 0, Math.PI, Math.PI * 2);
    c.fill();
  }
  const treeH = Math.max(12, cam.h * 0.17);
  c.fillStyle = "#cbdcec";
  for (const cx of [0.16, 0.33, 0.47, 0.64, 0.79, 0.93]) {
    const x = w * cx;
    for (let k = 0; k < 3; k++) {
      const y = base - (treeH * k) / 3.4;
      const half = (treeH * (3 - k)) / 9;
      c.beginPath();
      c.moveTo(x, y - treeH / 2.6);
      c.lineTo(x - half, y);
      c.lineTo(x + half, y);
      c.closePath();
      c.fill();
    }
  }
}

function drawGround(c: CanvasRenderingContext2D, cam: Camera, w: number): void {
  const y = sy(cam, 0);
  c.fillStyle = "#fbfdff";
  c.fillRect(0, y, w, GROUND_PAD);
  // 雪地上一小溜起伏,不然地面就是一条直尺
  c.fillStyle = "#f2f7fd";
  c.beginPath();
  c.moveTo(0, y);
  for (let x = 0; x <= w; x += 18) c.lineTo(x, y + 2 + Math.sin(x * 0.09) * 1.6);
  c.lineTo(w, y + GROUND_PAD);
  c.lineTo(0, y + GROUND_PAD);
  c.closePath();
  c.fill();
  c.strokeStyle = "#dbe7f3";
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(0, y);
  c.lineTo(w, y);
  c.stroke();
}

/** 雪堡与警戒线:雪怪走到这里这一轮就结束 */
function drawFort(c: CanvasRenderingContext2D, cam: Camera): void {
  const gx = sx(cam, GUARD_X);
  const base = sy(cam, 0);
  c.fillStyle = "#eef4fb";
  c.beginPath();
  c.moveTo(0, base);
  c.lineTo(0, sy(cam, 4));
  c.lineTo(gx * 0.34, sy(cam, 5.4));
  c.lineTo(gx * 0.68, sy(cam, 4));
  c.lineTo(gx * 0.68, base);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(160,190,220,.7)";
  c.lineWidth = 1.4;
  c.stroke();
  c.setLineDash([4, 4]);
  c.strokeStyle = "rgba(240,150,180,.85)";
  c.beginPath();
  c.moveTo(gx, base);
  c.lineTo(gx, sy(cam, 3.4));
  c.stroke();
  c.setLineDash([]);
  c.textAlign = "center";
  c.textBaseline = "bottom";
  c.font = `${Math.max(12, Math.round(cam.s * 0.9))}px system-ui`;
  c.fillText("🏰", gx * 0.34, base - 3);
}

function drawCover(c: CanvasRenderingContext2D, cam: Camera, cv: Cover): void {
  const x = sx(cam, cv.x);
  const w = Math.max(4, cv.w * cam.s);
  const top = sy(cam, cv.h);
  const bottom = sy(cam, 0);
  const worn = cv.hp / Math.max(1, cv.maxHp);
  if (cv.kind === "snow") {
    c.fillStyle = "#ffffff";
    roundRect(c, x, top, w, bottom - top, Math.min(w / 2, cam.s * 0.5));
    c.fill();
    c.strokeStyle = "rgba(150,185,220,.8)";
  } else {
    c.fillStyle = worn > 0.6 ? "#bcdcf2" : worn > 0.3 ? "#cbe6f6" : "#dff0fa";
    roundRect(c, x, top, w, bottom - top, 3);
    c.fill();
    c.strokeStyle = "rgba(120,165,200,.85)";
  }
  c.lineWidth = 1.4;
  c.stroke();
  // 砸掉一层就多一道裂纹
  const cracks = Math.max(0, cv.maxHp - cv.hp);
  c.strokeStyle = "rgba(110,150,190,.55)";
  for (let i = 0; i < cracks; i++) {
    const yy = top + ((bottom - top) * (i + 1)) / (cracks + 1);
    c.beginPath();
    c.moveTo(x + 2, yy);
    c.lineTo(x + w - 2, yy + (i % 2 === 0 ? 3 : -3));
    c.stroke();
  }
}

function drawTarget(c: CanvasRenderingContext2D, cam: Camera, t: Target, time: number): void {
  const x = sx(cam, t.x);
  const y = sy(cam, t.y);
  const r = Math.max(7, t.r * cam.s);
  if (t.melted) return;
  if (t.kind === "monster") {
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(x, y + r * 0.5, r * 0.95, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y - r * 0.55, r * 0.68, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(150,185,220,.85)";
    c.lineWidth = 1.3;
    c.stroke();
    c.fillStyle = "#5b6885";
    c.beginPath();
    c.arc(x - r * 0.25, y - r * 0.62, Math.max(1, r * 0.1), 0, Math.PI * 2);
    c.arc(x + r * 0.25, y - r * 0.62, Math.max(1, r * 0.1), 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f0a2b8";
    c.beginPath();
    c.arc(x, y - r * 0.32, Math.max(1, r * 0.14), 0, Math.PI);
    c.fill();
    return;
  }
  // 雪灯笼:一颗会轻轻发光的小灯
  c.fillStyle = `rgba(255,214,150,${0.3 + Math.sin(time * 2 + t.id) * 0.12})`;
  c.beginPath();
  c.arc(x, y, r * 1.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = t.owner === 0 ? "#f7a8c6" : t.owner === 1 ? "#9ec2ee" : "#ffcf87";
  c.beginPath();
  c.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,.9)";
  c.lineWidth = 1.4;
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.95)";
  c.fillRect(x - r * 0.9, y - r * 0.12, r * 1.8, Math.max(1.5, r * 0.16));
  // 顶上的一小顶雪帽,一眼就知道是雪灯笼
  c.beginPath();
  c.ellipse(x, y - r * 0.95, r * 0.55, r * 0.28, 0, Math.PI, Math.PI * 2);
  c.fill();
}

function drawThrower(c: CanvasRenderingContext2D, cam: Camera, who: Thrower, active: boolean, time: number): void {
  const x = sx(cam, who.x);
  const base = sy(cam, 0);
  const r = Math.max(7, BODY_R * cam.s * 0.62);
  if (active) {
    c.fillStyle = `rgba(255,214,120,${0.28 + Math.sin(time * 3) * 0.1})`;
    c.beginPath();
    c.ellipse(x, base - r * 0.2, r * 1.8, r * 0.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  const frozen = who.frozen > 0;
  c.fillStyle = frozen ? "#eaf4ff" : P_COLOR[who.seat] ?? P_COLOR[0];
  roundRect(c, x - r * 0.75, base - r * 2.1, r * 1.5, r * 2.1, r * 0.6);
  c.fill();
  c.fillStyle = frozen ? "#f6fbff" : "#ffe8d2";
  c.beginPath();
  c.arc(x, base - r * 2.5, r * 0.72, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#5b6885";
  c.beginPath();
  c.arc(x - r * 0.24, base - r * 2.56, Math.max(1, r * 0.1), 0, Math.PI * 2);
  c.arc(x + r * 0.24, base - r * 2.56, Math.max(1, r * 0.1), 0, Math.PI * 2);
  c.fill();
  c.textAlign = "center";
  c.textBaseline = "bottom";
  c.font = `${Math.max(11, Math.round(r * 1.1))}px system-ui`;
  c.fillText(frozen ? "⛄" : P_MARK[who.seat] ?? "🌸", x, base - r * 3.1);
}

/** 瞄准虚线:让小朋友看见「这一发大概往哪儿飞」 */
function drawAim(c: CanvasRenderingContext2D, cam: Camera, spec: ThrowSpec): void {
  const pts = trajectory(spec, GROUND_Y, 0.06);
  c.setLineDash([3, 5]);
  c.strokeStyle = "rgba(90,130,180,.6)";
  c.lineWidth = 1.6;
  c.beginPath();
  for (const [i, p] of pts.entries()) {
    const px = sx(cam, p.x);
    const py = sy(cam, p.y);
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.stroke();
  c.setLineDash([]);
}

function drawBall(c: CanvasRenderingContext2D, cam: Camera, p: Vec): void {
  c.fillStyle = "#ffffff";
  c.strokeStyle = "rgba(140,175,210,.9)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(sx(cam, p.x), sy(cam, p.y), Math.max(3, BALL_R * cam.s), 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

interface Puff {
  x: number;
  y: number;
  t: number;
  face: string;
}

function drawPuffs(c: CanvasRenderingContext2D, cam: Camera, puffs: Puff[]): void {
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const p of puffs) {
    const k = Math.max(0, 1 - p.t / 0.9);
    c.globalAlpha = k;
    c.font = `${Math.max(13, Math.round(cam.s * 1.1))}px system-ui`;
    c.fillText(p.face, sx(cam, p.x), sy(cam, p.y) - (1 - k) * cam.s);
    c.globalAlpha = 1;
  }
}

function drawWindFlag(c: CanvasRenderingContext2D, cam: Camera, w: number, wind: number): void {
  const cx = w / 2;
  const cy = Math.max(14, cam.h * 0.12);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `700 ${Math.max(11, Math.round(cam.s * 0.85))}px system-ui`;
  c.fillStyle = "#4f6a9c";
  c.fillText(windLabel(wind), cx, cy);
  if (Math.abs(wind) < 0.25) return;
  const len = Math.min(46, 12 + Math.abs(wind) * 12);
  const dir = wind > 0 ? 1 : -1;
  c.strokeStyle = "rgba(90,130,180,.8)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx - (len / 2) * dir, cy + 14);
  c.lineTo(cx + (len / 2) * dir, cy + 14);
  c.lineTo(cx + (len / 2 - 6) * dir, cy + 10);
  c.moveTo(cx + (len / 2) * dir, cy + 14);
  c.lineTo(cx + (len / 2 - 6) * dir, cy + 18);
  c.stroke();
}

// ---------------------------------------------------------------------------
// 一局的运行器:画布 + HUD + 键盘 + 触屏按钮 + 暂停
// ---------------------------------------------------------------------------

interface RunOptions {
  match: Match;
  /** 场地画多宽(闯关只画到 VIEW_W,对战要画满 FIELD_W) */
  viewW: number;
  /** 有几位真人在场(1 = 只有朵朵的键位生效) */
  humans: 1 | 2;
  hint: string;
  extraChips?: () => string[];
  onEnd: (m: Match) => void;
  /** 一波清完了(无尽用) */
  onWaveClear?: (m: Match) => void;
}

interface Runner {
  destroy: () => void;
}

function mountRun(host: HTMLElement, sfx: (n: SoundName) => void, opts: RunOptions): Runner {
  const match = opts.match;
  const wrap = document.createElement("div");
  wrap.className = "sf-wrap";

  const hud = document.createElement("div");
  hud.className = "sf-hud";
  const board = document.createElement("div");
  board.className = "sf-board";
  const canvas = document.createElement("canvas");
  canvas.className = "sf-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "雪球大作战的雪原");
  board.appendChild(canvas);
  const say = document.createElement("div");
  say.className = "sf-say";
  say.setAttribute("aria-live", "polite");
  const tip = document.createElement("div");
  tip.className = "sf-tip";
  tip.textContent = opts.hint;
  const acts = document.createElement("div");
  acts.className = "sf-acts";
  const pads = document.createElement("div");
  pads.className = "sf-pads";
  wrap.append(hud, board, say, tip, acts, pads);
  host.appendChild(wrap);

  const angles = [45, 45];
  const charge: Array<number | null> = [null, null];
  const rand = mulberry32(((Date.now() % 100000) + 7) | 0);

  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let cam: Camera = { s: 8, ys: 1, h: 128 };
  let cssW = 320;

  /** 正在飞的那一发(飞完才结算) */
  let flight: { points: Vec[]; i: number; after: () => void } | null = null;
  let aiWait = 0;
  const puffs: Puff[] = [];

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "sf-act";
  pauseBtn.textContent = "⏸️ 暂停 (Esc)";
  acts.appendChild(pauseBtn);

  function layout(): void {
    const availW = Math.max(240, (host.clientWidth || 340) - 8);
    const maxW = Math.min(availW, 860);
    const s = maxW / opts.viewW;
    const ys = Math.max(1, Math.min(1.9, MIN_BOARD_H / (VIEW_H * s)));
    cam = { s, ys, h: Math.round(VIEW_H * s * ys) };
    cssW = Math.round(opts.viewW * s);
    const cssH = cam.h + GROUND_PAD;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const c = canvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 现在是不是在等真人出手 */
  function humanTurn(): boolean {
    if (match.status !== "playing" || flight || paused) return false;
    return !current(match).ai;
  }

  /** 这个座位现在能不能操作(没轮到就不能,免得两个人抢) */
  function canAct(seat: number): boolean {
    return humanTurn() && current(match).seat === seat && seat < opts.humans;
  }

  function specFor(who: Thrower, power: number): ThrowSpec {
    return { x: who.x, y: who.y + 1.2, angle: angles[who.seat] ?? 45, power, dir: who.dir, wind: match.wind };
  }

  function refreshHud(): void {
    const me = current(match);
    const chips: string[] = [];
    chips.push(`${P_MARK[me.seat] ?? "🌸"} 轮到${me.ai ? AI_PROFILES[me.ai].name : P_NAME[me.seat] ?? "朵朵"}`);
    chips.push(`📐 ${Math.round(angles[me.seat] ?? 45)}°`);
    chips.push(`🌬️ ${windLabel(match.wind)}`);
    if (me.balls >= 0) chips.push(`❄️ 雪球 ${me.balls}`);
    if (me.walls > 0) chips.push(`🧱 雪墙 ${me.walls}`);
    if (match.mode === "versus" || match.mode === "ai") {
      chips.push(`🏮 我方 ${liveTargets(match, 0).length} : ${liveTargets(match, 1).length} 对方`);
    } else {
      chips.push(`🎯 还剩 ${liveTargets(match).length} 个`);
    }
    for (const extra of opts.extraChips?.() ?? []) chips.push(extra);
    hud.innerHTML = "";
    for (const [i, text] of chips.entries()) {
      const el = document.createElement("span");
      el.className = `sf-chip${i === 0 ? (me.seat === 0 ? " sf-chip-turn" : " sf-chip-turn1") : ""}`;
      el.textContent = text;
      el.setAttribute("aria-live", i === 0 ? "polite" : "off");
      hud.appendChild(el);
    }
    for (const [seat, pad] of padBoxes.entries()) {
      const on = canAct(seat);
      pad.className = `sf-pad${on ? (seat === 0 ? " sf-pad-on" : " sf-pad-on1") : ""}`;
      for (const b of pad.querySelectorAll("button")) b.disabled = !on;
    }
  }

  /** 结算一发:先让雪球飞完,落地了再改状态 */
  function launch(power: number): void {
    const me = current(match);
    const angle = angles[me.seat] ?? 45;
    const preview = flyShot(match, specFor(me, power), me.id);
    sfx("pop");
    flight = {
      points: preview.points,
      i: 0,
      after() {
        const out = takeShot(match, angle, power);
        settle(out);
      },
    };
  }

  function settle(out: TurnOutcome | null): void {
    if (!out) return;
    say.textContent = out.line;
    const hit = out.shot.hit;
    if (hit === "lantern" || hit === "monster") {
      puffs.push({ x: out.shot.x, y: out.shot.y, t: 0, face: hit === "monster" ? "🌼" : "✨" });
      sfx("coin");
    } else if (hit === "cover") {
      puffs.push({ x: out.shot.x, y: out.shot.y, t: 0, face: "💨" });
      sfx("tap");
    } else if (hit === "player") {
      puffs.push({ x: out.shot.x, y: out.shot.y, t: 0, face: "⛄" });
      sfx("oops");
    } else {
      puffs.push({ x: out.shot.x, y: out.shot.y, t: 0, face: "💨" });
    }
    if (match.status !== "playing") {
      finished = true;
      window.setTimeout(() => opts.onEnd(match), 420);
    } else if (opts.onWaveClear && liveTargets(match).length === 0) {
      opts.onWaveClear(match);
    }
    refreshHud();
  }

  function doWall(): void {
    if (buildWall(match)) {
      sfx("tap");
      say.textContent = "堆好一堵雪墙!雪怪要先把它拆了才能过来。";
      refreshHud();
    }
  }

  function nudge(seat: number, dx: number): void {
    const me = current(match);
    if (me.seat !== seat) return;
    const lo = match.mode === "versus" || match.mode === "ai" ? (me.dir === 1 ? 2 : FIELD_W / 2 + 1) : 2;
    const hi = match.mode === "versus" || match.mode === "ai" ? (me.dir === 1 ? FIELD_W / 2 - 1 : FIELD_W - 2) : GUARD_X - 1;
    me.x = Math.max(lo, Math.min(hi, me.x + dx));
  }

  function act(seat: number, action: SnowAction, down: boolean): void {
    if (!canAct(seat)) return;
    if (action === "up" && down) angles[seat] = stepAngle(angles[seat] ?? 45, ANGLE_STEP);
    else if (action === "down" && down) angles[seat] = stepAngle(angles[seat] ?? 45, -ANGLE_STEP);
    else if (action === "left" && down) nudge(seat, -STEP_X);
    else if (action === "right" && down) nudge(seat, STEP_X);
    else if (action === "wall" && down) doWall();
    else if (action === "throw") {
      if (down) {
        if (charge[seat] === null) charge[seat] = 0;
      } else if (charge[seat] !== null) {
        const power = Math.max(6, chargeAt(charge[seat] as number));
        charge[seat] = null;
        launch(power);
      }
    }
    refreshHud();
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused && !finished) {
      clock += dt;
      for (const p of puffs) p.t += dt;
      while (puffs.length > 0 && puffs[0].t > 0.9) puffs.shift();
      for (const seat of [0, 1]) {
        if (charge[seat] !== null) charge[seat] = (charge[seat] as number) + dt;
      }
      if (flight) {
        // 轨迹是按 0.02 秒采样的,照着这个速度放就是真实飞行速度
        flight.i += dt / 0.02;
        if (flight.i >= flight.points.length - 1) {
          const done = flight;
          flight = null;
          done.after();
        }
      } else if (match.status === "playing" && current(match).ai) {
        aiWait += dt;
        if (aiWait > 0.75) {
          aiWait = 0;
          const me = current(match);
          const plan = aiPlan(match, rand);
          if (plan) {
            angles[me.seat] = plan.angle;
            launch(plan.power);
          }
        }
      }
    }
    const c = canvas.getContext("2d");
    if (c) draw(c);
  }

  function draw(c: CanvasRenderingContext2D): void {
    drawSky(c, cam, cssW, clock);
    drawBackdrop(c, cam, cssW);
    drawGround(c, cam, cssW);
    if (match.mode === "campaign" || match.mode === "endless") drawFort(c, cam);
    for (const cv of match.covers) drawCover(c, cam, cv);
    for (const t of match.targets) drawTarget(c, cam, t, clock);
    const me = current(match);
    for (const who of match.throwers) drawThrower(c, cam, who, who.id === me.id && !finished, clock);
    drawWindFlag(c, cam, cssW, match.wind);
    if (humanTurn()) {
      const held = charge[me.seat];
      drawAim(c, cam, specFor(me, held === null ? 55 : Math.max(6, chargeAt(held))));
      if (held !== null) drawPowerBar(c, chargeAt(held));
    }
    if (flight) {
      const p = flight.points[Math.min(flight.points.length - 1, Math.floor(flight.i))];
      if (p) drawBall(c, cam, p);
    }
    drawPuffs(c, cam, puffs);
  }

  function drawPowerBar(c: CanvasRenderingContext2D, power: number): void {
    const w = Math.min(180, cssW * 0.5);
    const x = (cssW - w) / 2;
    const y = cam.h - 14;
    c.fillStyle = "rgba(255,255,255,.85)";
    roundRect(c, x, y, w, 9, 5);
    c.fill();
    c.fillStyle = power > 80 ? "#e8558f" : "#5b8ec4";
    roundRect(c, x + 1, y + 1, Math.max(2, ((w - 2) * power) / 100), 7, 4);
    c.fill();
  }

  // ---- 键盘 ---------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent): void {
    if (e.code === PAUSE_KEY) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    if (bind.player >= opts.humans) return;
    e.preventDefault();
    if (bind.action === "throw" && e.repeat) return;
    act(bind.player, bind.action, true);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    if (bind.player >= opts.humans) return;
    act(bind.player, bind.action, false);
  }

  function onBlur(): void {
    charge[0] = null;
    charge[1] = null;
  }

  // ---- 触屏(和键盘完全等价) -----------------------------------------------
  const padBoxes: HTMLElement[] = [];

  function makeBtn(label: string, aria: string, cls = ""): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `sf-btn${cls ? ` ${cls}` : ""}`;
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    return b;
  }

  function bindTap(b: HTMLButtonElement, seat: number, action: SnowAction): void {
    b.addEventListener("click", () => act(seat, action, true));
  }

  function bindHold(b: HTMLButtonElement, seat: number): void {
    const down = (e: Event): void => {
      e.preventDefault();
      act(seat, "throw", true);
    };
    const up = (e: Event): void => {
      e.preventDefault();
      act(seat, "throw", false);
    };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("pointerleave", up);
    b.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
        e.preventDefault();
        act(seat, "throw", true);
      }
    });
    b.addEventListener("keyup", (e) => {
      if (e.key === "Enter" || e.key === " ") act(seat, "throw", false);
    });
    b.addEventListener("blur", () => act(seat, "throw", false));
  }

  function makePad(seat: 0 | 1): HTMLElement {
    const box = document.createElement("div");
    box.className = "sf-pad";
    const name = document.createElement("div");
    name.className = "sf-pad-t";
    name.style.color = P_COLOR[seat];
    name.textContent = `${P_MARK[seat]} ${P_NAME[seat]} · ${P_KEYS[seat]}`;
    const row1 = document.createElement("div");
    row1.className = "sf-row";
    const up = makeBtn("📐▲", `${P_NAME[seat]}把角度调高`);
    bindTap(up, seat, "up");
    const dn = makeBtn("📐▼", `${P_NAME[seat]}把角度调低`);
    bindTap(dn, seat, "down");
    const lf = makeBtn("◀", `${P_NAME[seat]}往左挪一点`);
    bindTap(lf, seat, "left");
    const rt = makeBtn("▶", `${P_NAME[seat]}往右挪一点`);
    bindTap(rt, seat, "right");
    row1.append(up, dn, lf, rt);
    const row2 = document.createElement("div");
    row2.className = "sf-row";
    const th = makeBtn("❄️ 按住蓄力", `${P_NAME[seat]}按住蓄力,松手扔出去`, "sf-btn-throw");
    bindHold(th, seat);
    const wl = makeBtn("🧱 雪墙", `${P_NAME[seat]}堆一堵雪墙`, "sf-btn-wall");
    bindTap(wl, seat, "wall");
    row2.append(th, wl);
    box.append(name, row1, row2);
    padBoxes[seat] = box;
    return box;
  }

  for (let s = 0; s < opts.humans; s++) pads.appendChild(makePad(s as 0 | 1));

  function setPaused(next: boolean): void {
    if (finished) return;
    paused = next;
    charge[0] = null;
    charge[1] = null;
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    board.querySelector(".sf-over")?.remove();
    if (paused) {
      const ov = document.createElement("div");
      ov.className = "sf-over";
      ov.innerHTML = `<div class="sf-over-t">⏸️ 先歇一会儿</div>
        <div class="sf-over-s">按 Esc 或点「继续」回到雪原。<br>朵朵:W/S 调角度、按住 F 蓄力、G 堆雪墙。<br>星星:↑/↓ 调角度、按住 L 蓄力、K 堆雪墙。</div>`;
      board.appendChild(ov);
    }
  }

  pauseBtn.addEventListener("click", () => {
    sfx("tap");
    setPaused(!paused);
  });

  const onResize = (): void => layout();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);

  layout();
  refreshHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      charge[0] = null;
      charge[1] = null;
      flight = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 188 关闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const level = buildLevel(ctx.level);
  const ci = chapterIndexOf(ctx.level);
  const match = createMatch(levelMatch(level));
  let runner: Runner | null = null;
  runner = mountRun(stage, ctx.sfx, {
    match,
    viewW: VIEW_W,
    humans: 1,
    hint: `${CHAPTER_NEW[ci] ?? ""} 一共 ${level.targets.length} 个靶子,给了 ${level.balls} 个雪球。`,
    onEnd(m) {
      const used = level.balls - m.throwers[0].balls;
      if (m.status === "win") {
        const stars = rateLevel(m.throwers[0].balls, level.balls);
        ctx.win(stars, winLine(stars, used, level.balls));
      } else {
        ctx.lose(loseLine(m.reason, liveTargets(m).length));
      }
    },
  });
  return {
    destroy() {
      runner?.destroy();
      runner = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战 / 人机对战
// ---------------------------------------------------------------------------

function mountDuel(host: HTMLElement, api: GameApi, back: () => void, ai: AiLevel | null): { destroy: () => void } {
  const box = document.createElement("div");
  box.className = "sf-mode";
  const head = document.createElement("div");
  head.className = "sf-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "sf-back";
  backBtn.textContent = "← 回选关";
  const title = document.createElement("span");
  title.className = "sf-chip";
  title.textContent = ai
    ? `🤖 人机对战 · ${AI_PROFILES[ai].name}(${AI_PROFILES[ai].desc})`
    : "⚔️ 双人对战 · 先砸化对面三盏雪灯笼";
  head.append(backBtn, title);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);

  const match = createMatch(duelMatch(ai));
  let runner: Runner | null = null;
  let over = false;

  function finish(m: Match): void {
    if (over) return;
    over = true;
    runner?.destroy();
    runner = null;
    const iWon = m.winner === 0;
    const who = m.winner < 0 ? "两边打成平手" : ai ? (iWon ? "朵朵赢啦" : `${AI_PROFILES[ai].name}赢啦`) : `${P_NAME[m.winner]}赢啦`;
    const ov = document.createElement("div");
    ov.className = "sf-mode";
    ov.innerHTML = `<div class="sf-over-t">🎉 ${who}</div>
      <div class="sf-over-s">${m.reason}。<br>
      雪灯笼 ${liveTargets(m, 0).length} : ${liveTargets(m, 1).length}。被砸中的人拍拍雪就好,一点都不疼。<br>
      下一局试试先堆一堵雪墙,再从墙后面高抛过去。</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = `sf-open ${ai ? "sf-open-ai" : "sf-open-vs"}`;
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      box.remove();
      mountDuel(host, api, back, ai);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "sf-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "sf-acts";
    row.append(again, home);
    ov.appendChild(row);
    stage.appendChild(ov);
  }

  runner = mountRun(stage, (n) => api.play(n), {
    match,
    viewW: FIELD_W,
    humans: ai ? 1 : 2,
    hint: ai
      ? "对面的灯笼躲在中间的冰砖后面,抬高角度绕过去。砸中对手他会歇一回合。"
      : "两个人轮流扔。左边朵朵、右边星星,键位各管各的,谁也抢不了谁。",
    onEnd: finish,
  });

  backBtn.addEventListener("click", () => {
    api.play("tap");
    back();
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:雪怪车轮战
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const box = document.createElement("div");
  box.className = "sf-mode";
  const head = document.createElement("div");
  head.className = "sf-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "sf-back";
  backBtn.textContent = "← 回选关";
  const title = document.createElement("span");
  title.className = "sf-chip";
  title.textContent = "♾️ 无尽雪怪 · 一波比一波多";
  head.append(backBtn, title);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);

  const rand = mulberry32((Date.now() % 100000) | 0);
  const match = createMatch(endlessMatch(endlessTargets(1, rand)));
  let runner: Runner | null = null;
  let over = false;

  function finish(m: Match): void {
    if (over) return;
    over = true;
    const best = save.recordEndlessBest(meta.id, m.wave);
    runner?.destroy();
    runner = null;
    const ov = document.createElement("div");
    ov.className = "sf-mode";
    ov.innerHTML = `<div class="sf-over-t">🌼 顶到了第 ${m.wave} 波</div>
      <div class="sf-over-s">这一轮化掉 ${m.melted} 个雪怪。<br>
      历史最好成绩:第 ${best} 波。下次先打最靠近雪堡的那一个,挡不住就堆雪墙。</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "sf-open";
    again.textContent = "🔁 再来一轮";
    again.addEventListener("click", () => {
      api.play("tap");
      box.remove();
      mountEndless(host, api, back);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "sf-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "sf-acts";
    row.append(again, home);
    ov.appendChild(row);
    stage.appendChild(ov);
  }

  runner = mountRun(stage, (n) => api.play(n), {
    match,
    viewW: VIEW_W,
    humans: 1,
    hint: "雪球无限,但雪怪走到雪堡就这一轮结束。雪墙用完了会随波补给。",
    extraChips: () => [`🌊 第 ${match.wave} 波`, `🌼 化掉 ${match.melted}`],
    onEnd: finish,
    onWaveClear(m) {
      addTargets(m, endlessTargets(m.wave + 1, rand));
      m.throwers[0].walls += 1;
      api.play("win");
    },
  });

  backBtn.addEventListener("click", () => {
    api.play("tap");
    back();
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "sf-bar";
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

  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "sf-open sf-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, null)));

  // 三档人机的短名字:手机上一行放得下才不会把画面挤到屏幕外面
  const AI_SHORT: Record<AiLevel, string> = { easy: "🤖 简单", normal: "🤖 普通", hard: "🤖 会算风" };
  const aiBtns = (["easy", "normal", "hard"] as AiLevel[]).map((level) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sf-open sf-open-ai";
    b.textContent = AI_SHORT[level];
    b.title = `${AI_PROFILES[level].name}:${AI_PROFILES[level].desc}`;
    b.setAttribute("aria-label", `人机对战 ${AI_PROFILES[level].name}`);
    b.addEventListener("click", () => openMode((h, a, back) => mountDuel(h, a, back, level)));
    return b;
  });

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "sf-open";
  endlessBtn.addEventListener("click", () => openMode(mountEndless));

  bar.append(vsBtn, ...aiBtns, endlessBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽雪怪 · 最好 第 ${best} 波` : "♾️ 无尽雪怪 · 点我开始!";
  }
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "第一发当试投:看看差多少,第二发照着改,别每次都重新猜。",
      grandMessage: `${LEVEL_TOTAL} 关全部打完,风向、掩体、雪怪你都拿捏住了,你就是雪原上的投手!`,
      guide,
      guideTitle: "雪球大作战 · 雪原手记",
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

/** 给首页玩法说明用:这一款到底有哪几种玩法 */
export const MODE_LABELS: readonly string[] = ["188 关闯关", "双人对战", "人机对战(三档)", "无尽雪怪"];

/** 评一评无尽成绩(波次越高越好) */
export function rateEndless(wave: number): 1 | 2 | 3 {
  return rateAbove(wave, 8, 4);
}
