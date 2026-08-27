import { meta } from "./meta";
export { meta };

// 寻找外星朋友:找物 + 推理混合的小场景游戏。
// 每一关一张程序化画出来的手绘感场景(没有任何外部图片):
// 找物关要在限时里把躲着外星小朋友和线索物的地方点出来;
// 推理关不给看,只给 3~5 条线索,靠排除法点中唯一的那个藏身点。
// 三种玩法:188 关八大场景战役、无尽(越找越多越找越快)、双人同屏抢答。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  CHAPTERS,
  LEVELS,
  buildEndlessRound,
  buildVersusRound,
  type DeduceLevel,
  type FindLevel,
  type SeekLevel,
} from "./levels";
import { START_X, START_Y } from "./sim";
import {
  COLOR_HEX,
  CURSOR_SPEED,
  SCENE_H,
  SCENE_W,
  clueText,
  deduceStars,
  endlessLine,
  findStars,
  formatClock,
  missPenalty,
  versusLine,
  versusWinner,
  type Spot,
} from "./logic";
import {
  DEFAULT_VIEW,
  canUseHint,
  checklistItems,
  checklistLabel,
  clampView,
  emptyClickTip,
  hintText,
  hintsLeft,
  panView,
  pickNearestSpot,
  pinchZoom,
  screenToScene,
  starsAfterHints,
  telescopeRegion,
  telescopeView,
  toleranceInScene,
  viewScale,
  zoomAt,
  type Region,
  type View,
  type Viewport,
} from "./seek12";
import { freezeAll, registerGate, thawAll } from "./pauseGate";

/** 两位玩家的光标颜色:朵朵粉、星星蓝 */
const P_COLOR = ["#e8558f", "#3f7fd6"];
const P_NAME = ["朵朵", "星星"];

const CSS = `
.as-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;}
.as-canvas{width:100%;display:block;border-radius:16px;background:#f7f5ff;touch-action:none;cursor:pointer;}
.as-clues{background:#fffdf6;border-radius:14px;padding:9px 12px;display:flex;flex-direction:column;gap:5px;
  box-shadow:0 2px 8px rgba(160,150,190,.22);}
.as-clue{font-size:13px;font-weight:700;color:#5f5280;line-height:1.5;display:flex;gap:7px;align-items:flex-start;}
.as-clue-n{flex:0 0 auto;width:19px;height:19px;border-radius:50%;background:#e6dcff;color:#6a4fa8;
  font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;}
.as-pads{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
.as-pad{display:grid;grid-template-columns:repeat(3,auto);gap:5px;justify-items:center;align-items:center;}
.as-pad-t{grid-column:1 / -1;font-size:12px;font-weight:900;}
.as-btn{border:none;border-radius:13px;min-width:46px;min-height:44px;padding:4px 8px;font-size:17px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;
  box-shadow:0 3px 0 rgba(140,120,190,.4);}
.as-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.as-btn-ok{background:#ffdbe8;color:#a83a68;box-shadow:0 3px 0 rgba(200,110,150,.4);}
.as-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.as-tip{text-align:center;font-size:13px;font-weight:700;color:#6f6390;line-height:1.5;}
.as-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.as-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.as-open.as-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.as-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.as-open:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.as-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.as-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.as-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.as-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.as-chip{background:#fff;border-radius:999px;padding:5px 12px;font-size:14px;font-weight:800;color:#63528c;
  box-shadow:0 2px 6px rgba(150,140,180,.25);}
.as-over{border-radius:16px;background:#fffdfa;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.as-over-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.as-over-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;}
/* 1.2 新增:缩略图清单栏 + 望远镜 / 缩放工具条(als- 前缀) */
.als-list{display:flex;gap:8px;overflow-x:auto;padding:6px 4px;scrollbar-width:thin;
  -webkit-overflow-scrolling:touch;}
.als-item{flex:0 0 auto;width:56px;display:flex;flex-direction:column;align-items:center;gap:2px;
  background:#fffdf6;border-radius:12px;padding:4px 2px;box-shadow:0 2px 6px rgba(160,150,190,.22);}
.als-item.als-done{background:#e9fbe8;}
.als-thumb{width:40px;height:40px;display:block;border-radius:10px;background:#f4f1ff;}
.als-name{font-size:11px;font-weight:800;color:#5f5280;max-width:54px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.als-tick{font-size:12px;font-weight:900;color:#3f9a54;line-height:1;}
.als-tools{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center;}
.als-tool{border:none;border-radius:13px;min-width:46px;min-height:44px;padding:4px 10px;font-size:15px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;
  box-shadow:0 3px 0 rgba(140,120,190,.4);}
.als-tool:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.als-tool:disabled{opacity:.5;cursor:default;box-shadow:none;}
.als-tool:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@media (prefers-reduced-motion:reduce){.as-btn:active,.als-tool:active{transform:none;}}
`;

/** 用户在系统里关掉了动画吗(关了就不抖不闪) */
function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  return typeof mm === "function" ? !!mm("(prefers-reduced-motion: reduce)").matches : false;
}

// ---------------------------------------------------------------------------
// 画笔:全部程序化绘制,一张外部图片都不用
// ---------------------------------------------------------------------------

/** 把一个色号压暗一点,用来描边(手绘感靠的就是这圈深色轮廓) */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

/** 由坐标算出来的固定小抖动:让轮廓有点歪,但每帧都歪在同一个地方 */
function wobble(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function drawSpotShape(c2d: CanvasRenderingContext2D, s: Spot, i: number): void {
  const fill = COLOR_HEX[s.color];
  const line = shade(fill, 0.55);
  const r = s.r;
  c2d.save();
  c2d.translate(s.x, s.y);
  c2d.rotate(wobble(i + 1) * 0.05);
  c2d.lineWidth = 3.5;
  c2d.lineJoin = "round";
  c2d.lineCap = "round";
  c2d.strokeStyle = line;
  c2d.fillStyle = fill;

  const path = new Path2D();
  switch (s.kind) {
    case "树洞":
      path.roundRect(-r * 0.72, -r * 0.95, r * 1.44, r * 1.9, r * 0.3);
      break;
    case "木箱":
      path.roundRect(-r * 0.85, -r * 0.7, r * 1.7, r * 1.4, r * 0.16);
      break;
    case "花丛":
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        path.moveTo(Math.cos(a) * r * 0.45 + r * 0.5, Math.sin(a) * r * 0.45);
        path.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.5, 0, Math.PI * 2);
      }
      break;
    case "水缸":
      path.moveTo(-r * 0.6, -r * 0.8);
      path.quadraticCurveTo(-r * 0.95, 0, -r * 0.55, r * 0.85);
      path.lineTo(r * 0.55, r * 0.85);
      path.quadraticCurveTo(r * 0.95, 0, r * 0.6, -r * 0.8);
      path.closePath();
      break;
    case "云朵":
      path.arc(-r * 0.45, r * 0.1, r * 0.5, 0, Math.PI * 2);
      path.arc(0, -r * 0.2, r * 0.62, 0, Math.PI * 2);
      path.arc(r * 0.5, r * 0.12, r * 0.46, 0, Math.PI * 2);
      break;
    case "石头":
      path.moveTo(-r * 0.9, r * 0.5);
      path.lineTo(-r * 0.55, -r * 0.5);
      path.lineTo(r * 0.1, -r * 0.85);
      path.lineTo(r * 0.85, -r * 0.2);
      path.lineTo(r * 0.7, r * 0.6);
      path.closePath();
      break;
    case "帐篷":
      path.moveTo(0, -r * 0.95);
      path.lineTo(r * 0.95, r * 0.7);
      path.lineTo(-r * 0.95, r * 0.7);
      path.closePath();
      break;
    case "信箱":
      path.roundRect(-r * 0.7, -r * 0.85, r * 1.4, r * 1.1, r * 0.4);
      path.roundRect(-r * 0.14, r * 0.2, r * 0.28, r * 0.75, r * 0.1);
      break;
  }
  c2d.fill(path);
  c2d.stroke(path);

  // 每种藏身点再补一笔小细节,一眼能认出是什么东西
  c2d.fillStyle = line;
  if (s.kind === "树洞") {
    c2d.beginPath();
    c2d.ellipse(0, r * 0.15, r * 0.4, r * 0.5, 0, 0, Math.PI * 2);
    c2d.fill();
  } else if (s.kind === "木箱") {
    c2d.fillRect(-r * 0.85, -r * 0.08, r * 1.7, r * 0.16);
  } else if (s.kind === "花丛") {
    c2d.beginPath();
    c2d.arc(0, 0, r * 0.26, 0, Math.PI * 2);
    c2d.fill();
  } else if (s.kind === "水缸") {
    c2d.beginPath();
    c2d.moveTo(-r * 0.55, r * 0.15);
    c2d.quadraticCurveTo(0, -r * 0.1, r * 0.55, r * 0.15);
    c2d.lineWidth = 3;
    c2d.strokeStyle = line;
    c2d.stroke();
  } else if (s.kind === "帐篷") {
    c2d.beginPath();
    c2d.moveTo(0, -r * 0.5);
    c2d.lineTo(r * 0.3, r * 0.7);
    c2d.lineTo(-r * 0.3, r * 0.7);
    c2d.closePath();
    c2d.fill();
  } else if (s.kind === "信箱") {
    c2d.fillRect(-r * 0.4, -r * 0.45, r * 0.8, r * 0.12);
  } else if (s.kind === "石头") {
    c2d.beginPath();
    c2d.arc(r * 0.2, -r * 0.2, r * 0.14, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.restore();
}

/** 躲在藏身点后面的外星小朋友:只露出脑袋和触角,这就是要找的东西 */
function drawAlien(c2d: CanvasRenderingContext2D, x: number, y: number, size: number, tint: number, peek: boolean): void {
  const body = ["#8fe0c4", "#a9d8ff", "#ffd28f", "#d9bcff", "#b6e89a", "#ffb6c9"][tint % 6];
  c2d.save();
  c2d.translate(x, y);
  c2d.lineWidth = 2.6;
  c2d.lineJoin = "round";
  c2d.strokeStyle = shade(body, 0.5);
  // 触角
  for (const d of [-1, 1]) {
    c2d.beginPath();
    c2d.moveTo(d * size * 0.3, -size * 0.35);
    c2d.quadraticCurveTo(d * size * 0.55, -size * 0.95, d * size * 0.42, -size * 1.15);
    c2d.stroke();
    c2d.fillStyle = "#ffe066";
    c2d.beginPath();
    c2d.arc(d * size * 0.42, -size * 1.2, size * 0.15, 0, Math.PI * 2);
    c2d.fill();
    c2d.stroke();
  }
  // 脑袋
  c2d.fillStyle = body;
  c2d.beginPath();
  c2d.ellipse(0, 0, size * 0.62, size * 0.55, 0, 0, Math.PI * 2);
  c2d.fill();
  c2d.stroke();
  // 眼睛
  c2d.fillStyle = "#3a3a4a";
  for (const d of [-1, 1]) {
    c2d.beginPath();
    c2d.ellipse(d * size * 0.22, -size * 0.05, size * 0.11, size * 0.14, 0, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.fillStyle = "#fff";
  for (const d of [-1, 1]) {
    c2d.beginPath();
    c2d.arc(d * size * 0.22 + size * 0.04, -size * 0.1, size * 0.04, 0, Math.PI * 2);
    c2d.fill();
  }
  if (!peek) {
    // 找到之后露出整张笑脸
    c2d.strokeStyle = "#3a3a4a";
    c2d.lineWidth = 2.2;
    c2d.beginPath();
    c2d.arc(0, size * 0.14, size * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    c2d.stroke();
  }
  c2d.restore();
}

/** 线索物:一颗会闪的小星星贴纸 */
function drawTrinket(c2d: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  c2d.save();
  c2d.translate(x, y);
  c2d.fillStyle = "#ffd75e";
  c2d.strokeStyle = "#c8942a";
  c2d.lineWidth = 2.2;
  c2d.lineJoin = "round";
  c2d.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 === 0 ? size : size * 0.45;
    if (k === 0) c2d.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c2d.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c2d.closePath();
  c2d.fill();
  c2d.stroke();
  c2d.restore();
}

/** 背景:按章节换一批涂鸦(草丛 / 果子 / 水波 / 云 / 星星 / 齿轮 / 晶簇 / 星轨) */
function drawBackdrop(c2d: CanvasRenderingContext2D, chapter: number, t: number): void {
  const base = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, chapter))].color;
  const g = c2d.createLinearGradient(0, 0, 0, SCENE_H);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, base);
  c2d.fillStyle = g;
  c2d.fillRect(0, 0, SCENE_W, SCENE_H);

  c2d.save();
  c2d.strokeStyle = shade(base, 0.72);
  c2d.fillStyle = shade(base, 0.82);
  c2d.lineWidth = 3;
  c2d.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x = 30 + ((i * 173) % (SCENE_W - 60));
    const y = 40 + ((i * 271) % (SCENE_H - 80));
    const s = 12 + ((i * 7) % 10);
    const drift = Math.sin(t * 0.7 + i) * 3;
    c2d.save();
    c2d.translate(x, y + drift);
    switch (chapter % 8) {
      case 0: // 草叶
        for (const d of [-1, 0, 1]) {
          c2d.beginPath();
          c2d.moveTo(d * s * 0.4, s * 0.6);
          c2d.quadraticCurveTo(d * s * 0.6, -s * 0.2, d * s * 0.9, -s * 0.7);
          c2d.stroke();
        }
        break;
      case 1: // 小果子
        c2d.beginPath();
        c2d.arc(0, 0, s * 0.5, 0, Math.PI * 2);
        c2d.fill();
        break;
      case 2: // 水波
        c2d.beginPath();
        c2d.moveTo(-s, 0);
        c2d.quadraticCurveTo(-s * 0.5, -s * 0.5, 0, 0);
        c2d.quadraticCurveTo(s * 0.5, s * 0.5, s, 0);
        c2d.stroke();
        break;
      case 3: // 小云
        c2d.beginPath();
        c2d.arc(-s * 0.4, 0, s * 0.4, 0, Math.PI * 2);
        c2d.arc(s * 0.2, 0, s * 0.5, 0, Math.PI * 2);
        c2d.fill();
        break;
      case 4: // 月牙
        c2d.beginPath();
        c2d.arc(0, 0, s * 0.5, 0.4 * Math.PI, 1.6 * Math.PI);
        c2d.stroke();
        break;
      case 5: // 齿轮
        c2d.beginPath();
        c2d.arc(0, 0, s * 0.45, 0, Math.PI * 2);
        c2d.stroke();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          c2d.beginPath();
          c2d.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
          c2d.lineTo(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72);
          c2d.stroke();
        }
        break;
      case 6: // 晶簇
        c2d.beginPath();
        c2d.moveTo(0, -s * 0.7);
        c2d.lineTo(s * 0.4, s * 0.5);
        c2d.lineTo(-s * 0.4, s * 0.5);
        c2d.closePath();
        c2d.stroke();
        break;
      default: // 小星星
        c2d.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? s * 0.5 : s * 0.2;
          if (k === 0) c2d.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else c2d.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c2d.closePath();
        c2d.fill();
        break;
    }
    c2d.restore();
  }
  c2d.restore();
}

// ---------------------------------------------------------------------------
// 一局可玩的场景
// ---------------------------------------------------------------------------

export interface SeekResult {
  cleared: boolean;
  secondsLeft: number;
  /** 点错了几次 */
  misses: number;
  /** 双人对战时两边各找到几个 */
  scores: [number, number];
  /** 用掉了几次望远镜(用过就不给三星) */
  hintsUsed: number;
}

interface RunnerOpts {
  level: SeekLevel;
  banner: string;
  /** 1 = 单人(可直接点画面);2 = 双人对战,各自一个光标 */
  players: 1 | 2;
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  onDone: (result: SeekResult) => void;
}

function createRunner(host: HTMLElement, opts: RunnerOpts): { destroy: () => void } {
  const lv = opts.level;
  const deduce = lv.mode === "deduce";
  const targets = lv.mode === "find" ? lv.targets : [];
  const need = deduce ? 1 : targets.length;
  // 无尽轮自带罚时(它的 chapter 是循环的,照章算会忽轻忽重);战役关照旧按章
  const penalty = lv.penalty ?? missPenalty(lv.chapter);

  const wrap = document.createElement("div");
  wrap.className = "as-wrap";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const canvas = document.createElement("canvas");
  canvas.className = "as-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    deduce ? "推理场景:按线索找出外星小朋友躲在哪个地方" : "找物场景:点出躲着外星小朋友和线索物的地方"
  );
  wrap.appendChild(canvas);

  if (deduce) {
    const box = document.createElement("div");
    box.className = "as-clues";
    (lv as DeduceLevel).clues.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "as-clue";
      const n = document.createElement("span");
      n.className = "as-clue-n";
      n.textContent = String(i + 1);
      const txt = document.createElement("span");
      txt.textContent = clueText(c, lv.spots);
      row.append(n, txt);
      box.appendChild(row);
    });
    wrap.appendChild(box);
  }

  // 找物关的清单栏:缩略图 + 名字,横着滑,找到一个打一个勾
  const list = document.createElement("div");
  list.className = "als-list";
  if (!deduce && targets.length > 0) wrap.appendChild(list);

  // 单人才给缩放与望远镜:双人抢答两个人共用一块屏,镜头必须固定
  const tools = document.createElement("div");
  tools.className = "als-tools";
  if (opts.players === 1) wrap.appendChild(tools);

  const pads = document.createElement("div");
  pads.className = "as-pads";
  wrap.appendChild(pads);

  const tip = document.createElement("div");
  tip.className = "as-tip";
  tip.textContent =
    opts.players === 2
      ? `${lv.hint} Esc 暂停。`
      : `${lv.hint} 直接点画面,或用 W A S D + F(方向键 + L 也行)挪光标,Esc 暂停。`;
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const c2d = canvas.getContext("2d") as CanvasRenderingContext2D;

  // ---- 状态 ----
  let cssW = 320;
  let cssH = 210;
  let left = lv.seconds;
  let misses = 0;
  let paused = false;
  /** 这次的暂停是外壳面板按下去的（孩子自己按的那次不归它管） */
  let shellHeld = false;
  let finished = false;
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let message = "";
  let messageTimer = 0;
  /** 已经点开的藏身点 → 是谁点开的(0 朵朵 / 1 星星) */
  const found = new Map<number, number>();
  /** 推理关点错过的藏身点,画个叉 */
  const crossed = new Set<number>();
  const scores: [number, number] = [0, 0];
  /** 镜头:0.8~2.5 倍,双人时永远锁在 1 倍 */
  let view: View = { ...DEFAULT_VIEW };
  /** 用掉了几次望远镜 */
  let hintsUsed = 0;
  /** 连着点空了几次 */
  let emptyStreak = 0;
  /** 望远镜圈出来的那一片(只圈范围,不圈目标本体) */
  let focus: Region | null = null;
  let focusTimer = 0;
  const softMotion = reducedMotion();

  // 出生点与 sim.ts 的限时校验保持一致:那边算「够不够时间」就是从这里起步的
  const cursors = [
    { x: START_X, y: START_Y },
    { x: SCENE_W - START_X, y: START_Y },
  ];
  const held = [
    { up: false, down: false, left: false, right: false },
    { up: false, down: false, left: false, right: false },
  ];

  function say(text: string): void {
    message = text;
    messageTimer = 1.6;
  }

  /** 画布这一刻的可视范围(缩放换算全靠它) */
  function viewport(): Viewport {
    return { left: 0, top: 0, width: cssW, height: cssH };
  }

  function syncSize(): void {
    cssW = Math.max(240, Math.round(host.clientWidth || wrap.clientWidth || 320));
    cssH = Math.round(cssW * (SCENE_H / SCENE_W));
    view = clampView(view, viewport());
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.height = `${cssH}px`;
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function settle(cleared: boolean): void {
    if (finished) return;
    finished = true;
    opts.sfx(cleared ? "win" : "oops");
    opts.onDone({ cleared, secondsLeft: Math.max(0, left), misses, scores, hintsUsed });
  }

  /** 某个玩家点了场景上的一个点 */
  function pick(player: number, sx: number, sy: number): void {
    if (finished || paused) return;
    // 手指比看上去粗一圈:目标外 44px 以内都算,几个挨着就取最近的那个
    const i = pickNearestSpot(lv.spots, sx, sy, toleranceInScene(viewScale(viewport(), view.zoom)));
    if (i < 0) {
      emptyStreak++;
      opts.sfx("tap");
      // 点空不扣星也不扣时间,连着点空几次才轻轻提醒一句
      const coach = emptyClickTip(emptyStreak);
      if (coach) say(coach);
      return;
    }
    emptyStreak = 0;
    if (deduce) {
      if (crossed.has(i)) return;
      if (i === (lv as DeduceLevel).answer) {
        found.set(i, player);
        opts.sfx("coin");
        settle(true);
      } else {
        crossed.add(i);
        misses++;
        left = Math.max(0, left - penalty);
        opts.sfx("oops");
        say("这个地方和线索对不上,再读一遍线索～");
        if (misses >= 3) settle(false);
      }
      return;
    }

    if (found.has(i)) return;
    const hit = targets.find((t) => t.spot === i);
    if (!hit) {
      misses++;
      left = Math.max(0, left - penalty);
      opts.sfx("oops");
      say("这里没人躲着,再找找!");
      return;
    }
    found.set(i, player);
    scores[player]++;
    opts.sfx(hit.role === "alien" ? "meow" : "coin");
    say(hit.role === "alien" ? `找到${hit.name}啦!` : `捡到${hit.name}!`);
    refreshList();
    if (found.size >= need) settle(true);
  }

  function step(dt: number): void {
    if (paused || finished) return;
    clock += dt;
    messageTimer = Math.max(0, messageTimer - dt);
    if (focusTimer > 0) {
      focusTimer = Math.max(0, focusTimer - dt);
      if (focusTimer === 0) focus = null;
    }
    left -= dt;
    for (let p = 0; p < opts.players; p++) {
      const h = held[p];
      const dx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
      const dy = (h.down ? 1 : 0) - (h.up ? 1 : 0);
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        cursors[p].x = Math.max(0, Math.min(SCENE_W, cursors[p].x + (dx / len) * CURSOR_SPEED * dt));
        cursors[p].y = Math.max(0, Math.min(SCENE_H, cursors[p].y + (dy / len) * CURSOR_SPEED * dt));
      }
    }
    if (left <= 0) {
      left = 0;
      // 对战场时间到就按比分算,单人场时间到算没找完
      settle(opts.players === 2);
    }
  }

  // ---- 画面 ----
  function draw(): void {
    const s = viewScale(viewport(), view.zoom);
    c2d.clearRect(0, 0, cssW, cssH);
    c2d.save();
    // 镜头:画面正中对着 view.cx / view.cy,放大倍数 view.zoom
    c2d.translate(cssW / 2, cssH / 2);
    c2d.scale(s, s);
    c2d.translate(-view.cx, -view.cy);
    drawBackdrop(c2d, lv.chapter, softMotion ? 0 : clock);

    lv.spots.forEach((s, i) => {
      const hidden = deduce ? -1 : targets.findIndex((t) => t.spot === i);
      const isFound = found.has(i);
      // 先画躲在后面的小家伙,再画藏身点——只露出一点点脑袋,这就是要「找」的东西
      if (!deduce && hidden >= 0 && !isFound) {
        const t = targets[hidden];
        if (t.role === "alien") drawAlien(c2d, s.x + s.r * 0.34, s.y - s.r * 0.92, s.r * 0.5, i, true);
        else drawTrinket(c2d, s.x - s.r * 0.5, s.y - s.r * 0.9, s.r * 0.26);
      }
      drawSpotShape(c2d, s, i);

      if (isFound) {
        const t = hidden >= 0 ? targets[hidden] : null;
        if (!t || t.role === "alien") drawAlien(c2d, s.x, s.y - s.r * 0.2, s.r * 0.62, i, false);
        else drawTrinket(c2d, s.x, s.y - s.r * 0.1, s.r * 0.4);
        c2d.strokeStyle = P_COLOR[found.get(i) ?? 0];
        c2d.lineWidth = 5;
        c2d.beginPath();
        c2d.arc(s.x, s.y, s.r + 7, 0, Math.PI * 2);
        c2d.stroke();
      }
      if (crossed.has(i)) {
        c2d.strokeStyle = "rgba(120,110,140,.75)";
        c2d.lineWidth = 6;
        c2d.lineCap = "round";
        const d = s.r * 0.7;
        c2d.beginPath();
        c2d.moveTo(s.x - d, s.y - d);
        c2d.lineTo(s.x + d, s.y + d);
        c2d.moveTo(s.x + d, s.y - d);
        c2d.lineTo(s.x - d, s.y + d);
        c2d.stroke();
      }
    });

    // 望远镜圈出来的一片:只框范围,里头有几个藏身点还是要自己认
    if (focus) {
      c2d.strokeStyle = "rgba(120,90,200,.75)";
      c2d.lineWidth = 6;
      c2d.setLineDash([18, 12]);
      c2d.lineDashOffset = softMotion ? 0 : -clock * 26;
      c2d.strokeRect(focus.left + 6, focus.top + 6, focus.right - focus.left - 12, focus.bottom - focus.top - 12);
      c2d.setLineDash([]);
    }

    for (let p = 0; p < opts.players; p++) {
      const cur = cursors[p];
      c2d.strokeStyle = P_COLOR[p];
      c2d.lineWidth = 5;
      c2d.setLineDash([12, 9]);
      c2d.lineDashOffset = softMotion ? 0 : -clock * 34;
      c2d.beginPath();
      c2d.arc(cur.x, cur.y, 30, 0, Math.PI * 2);
      c2d.stroke();
      c2d.setLineDash([]);
      if (opts.players === 2) {
        c2d.fillStyle = P_COLOR[p];
        c2d.font = "bold 22px sans-serif";
        c2d.textAlign = "center";
        c2d.fillText(P_NAME[p], cur.x, cur.y - 40);
      }
    }
    c2d.restore();

    // ---- 顶栏 ----
    c2d.textBaseline = "middle";
    c2d.font = `bold ${Math.max(12, Math.round(cssW * 0.038))}px sans-serif`;
    c2d.fillStyle = "rgba(255,255,255,.88)";
    c2d.beginPath();
    c2d.roundRect(6, 6, cssW - 12, 30, 12);
    c2d.fill();
    c2d.fillStyle = "#5f4a90";
    c2d.textAlign = "left";
    c2d.fillText(opts.banner, 14, 21);
    c2d.textAlign = "right";
    const right =
      opts.players === 2
        ? `${P_NAME[0]} ${scores[0]} : ${scores[1]} ${P_NAME[1]}　⏱ ${formatClock(left)}`
        : `${deduce ? "🔍" : `${found.size}/${need}`}　⏱ ${formatClock(left)}`;
    c2d.fillText(right, cssW - 14, 21);

    // 时间条:快没时间了变红,小朋友一眼看得见
    const ratio = lv.seconds > 0 ? Math.max(0, left / lv.seconds) : 0;
    c2d.fillStyle = "rgba(255,255,255,.7)";
    c2d.beginPath();
    c2d.roundRect(10, cssH - 16, cssW - 20, 8, 4);
    c2d.fill();
    c2d.fillStyle = ratio < 0.25 ? "#e8608a" : "#8f7ae0";
    c2d.beginPath();
    c2d.roundRect(10, cssH - 16, Math.max(0, (cssW - 20) * ratio), 8, 4);
    c2d.fill();

    if (messageTimer > 0 && message) {
      c2d.textAlign = "center";
      c2d.fillStyle = "rgba(70,55,105,.82)";
      c2d.beginPath();
      c2d.roundRect(cssW * 0.1, cssH - 52, cssW * 0.8, 28, 12);
      c2d.fill();
      c2d.fillStyle = "#fff";
      c2d.fillText(message, cssW / 2, cssH - 38);
    }
    if (paused) {
      c2d.fillStyle = "rgba(252,250,255,.92)";
      c2d.fillRect(0, 0, cssW, cssH);
      c2d.textAlign = "center";
      c2d.fillStyle = "#6a4fa8";
      c2d.font = "bold 22px sans-serif";
      c2d.fillText("⏸ 休息一下", cssW / 2, cssH / 2 - 12);
      c2d.font = "bold 15px sans-serif";
      c2d.fillText("再按一次 Esc 或点 ⏸ 继续", cssW / 2, cssH / 2 + 16);
    }
  }

  function frame(now: number): void {
    if (destroyed) return;
    // 先排下一帧再干活:排帧句要是留在最后一行,中间任何一步抛异常都会把整条
    // rAF 循环带走,画面当场冻住只能退出重进(C2-02 在 bubble-aim 上就是这么卡死的)。
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    syncSize();
    step(dt);
    draw();
  }

  // ---- 输入 ----
  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    opts.sfx("tap");
  }

  const KEYS: Array<Record<string, "up" | "down" | "left" | "right">> = [
    { w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right" },
    { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  ];
  const CONFIRM = [new Set(["f", "F", "g", "G"]), new Set(["l", "L", "k", "K"])];

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    for (let p = 0; p < opts.players; p++) {
      const dir = KEYS[p][e.key];
      if (dir) {
        held[p][dir] = true;
        e.preventDefault();
        return;
      }
      if (CONFIRM[p].has(e.key)) {
        if (!e.repeat) pick(p, cursors[p].x, cursors[p].y);
        e.preventDefault();
        return;
      }
    }
    // 单人时两套键位都归朵朵用,谁顺手用谁
    if (opts.players === 1) {
      const dir = KEYS[1][e.key];
      if (dir) {
        held[0][dir] = true;
        e.preventDefault();
      } else if (CONFIRM[1].has(e.key)) {
        if (!e.repeat) pick(0, cursors[0].x, cursors[0].y);
        e.preventDefault();
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    for (let p = 0; p < 2; p++) {
      const dir = KEYS[p][e.key];
      if (dir) held[Math.min(p, opts.players - 1)][dir] = false;
    }
  }

  /** 画布在屏幕上的位置与大小:点击换算与缩放都要用 */
  function canvasViewport(): Viewport {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width || cssW, height: rect.height || cssH };
  }

  /** 按下去的手指:一根是点 / 拖,两根是捏合缩放 */
  const touches = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; view: View; moved: boolean } | null = null;
  let pinch: { dist: number; view: View; ax: number; ay: number } | null = null;
  const DRAG_SLOP = 7;

  function twoFingerDistance(): number {
    const pts = [...touches.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function onPointerDown(e: PointerEvent): void {
    if (opts.players === 2) return;
    e.preventDefault();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) {
      drag = { x: e.clientX, y: e.clientY, view: { ...view }, moved: false };
      pinch = null;
    } else if (touches.size === 2) {
      const vp = canvasViewport();
      const pts = [...touches.values()];
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const anchor = screenToScene(mid.x, mid.y, vp, view);
      pinch = { dist: twoFingerDistance(), view: { ...view }, ax: anchor.x, ay: anchor.y };
      drag = null;
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const vp = canvasViewport();
    if (pinch && touches.size >= 2) {
      const zoom = pinchZoom(pinch.view.zoom, pinch.dist, twoFingerDistance());
      view = zoomAt(pinch.view, zoom / pinch.view.zoom, pinch.ax, pinch.ay, vp);
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > DRAG_SLOP) drag.moved = true;
      if (drag.moved) view = panView(drag.view, dx, dy, vp);
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!touches.has(e.pointerId)) return;
    const spent = drag;
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (touches.size > 0) {
      drag = null;
      return;
    }
    drag = null;
    // 手指没怎么动才算「点了一下」;拖过画面就只是挪镜头
    if (spent && !spent.moved) {
      const p = screenToScene(e.clientX, e.clientY, canvasViewport(), view);
      cursors[0].x = Math.max(0, Math.min(SCENE_W, p.x));
      cursors[0].y = Math.max(0, Math.min(SCENE_H, p.y));
      pick(0, p.x, p.y);
    }
  }

  /** 滚轮缩放:鼠标指到哪就以哪儿为中心放大 */
  function onWheel(e: WheelEvent): void {
    if (opts.players === 2) return;
    e.preventDefault();
    const vp = canvasViewport();
    const anchor = screenToScene(e.clientX, e.clientY, vp, view);
    view = zoomAt(view, e.deltaY < 0 ? 1.12 : 1 / 1.12, anchor.x, anchor.y, vp);
  }

  /** 按钮缩放:以画面正中为锚,键盘党也能用 */
  function nudgeZoom(factor: number): void {
    view = zoomAt(view, factor, view.cx, view.cy, viewport());
    opts.sfx("tap");
  }

  /** 望远镜:把镜头缩到目标所在的那一片,不直接指出是哪个藏身点 */
  function useTelescope(): void {
    if (finished || paused || !canUseHint(hintsUsed)) return;
    const goal =
      lv.mode === "deduce"
        ? lv.spots[(lv as DeduceLevel).answer]
        : lv.spots[(targets.find((t) => !found.has(t.spot)) ?? targets[0]).spot];
    if (!goal) return;
    hintsUsed++;
    const region = telescopeRegion(goal.x, goal.y);
    focus = region;
    focusTimer = 6;
    view = telescopeView(region, viewport());
    say(hintText(region));
    opts.sfx("pop");
    refreshTools();
  }

  /** 清单栏里的一枚缩略图:直接把外星朋友 / 线索物画一遍,不用任何外部图片 */
  function drawThumb(target: { role: "alien" | "clue"; spot: number }): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.className = "als-thumb";
    cv.width = 80;
    cv.height = 80;
    const g = cv.getContext("2d");
    if (g) {
      g.scale(2, 2);
      g.fillStyle = "#f4f1ff";
      g.fillRect(0, 0, 40, 40);
      if (target.role === "alien") drawAlien(g, 20, 24, 15, target.spot, false);
      else drawTrinket(g, 20, 20, 13);
    }
    return cv;
  }

  function refreshList(): void {
    if (deduce || targets.length === 0) return;
    list.innerHTML = "";
    for (const item of checklistItems(targets, found)) {
      const box = document.createElement("div");
      box.className = `als-item${item.found ? " als-done" : ""}`;
      box.setAttribute("aria-label", checklistLabel(item));
      const name = document.createElement("div");
      name.className = "als-name";
      name.textContent = item.name;
      const tick = document.createElement("div");
      tick.className = "als-tick";
      tick.textContent = item.found ? "✓ 找到" : "找找看";
      box.append(drawThumb(item), name, tick);
      list.appendChild(box);
    }
  }

  let hintBtn: HTMLButtonElement | null = null;
  function refreshTools(): void {
    if (!hintBtn) return;
    const n = hintsLeft(hintsUsed);
    hintBtn.textContent = `🔭 望远镜 ${n}`;
    hintBtn.disabled = n <= 0;
    hintBtn.setAttribute("aria-label", n > 0 ? `用望远镜缩小范围,还剩 ${n} 次` : "望远镜用完了");
  }

  function buildTools(): void {
    const mk = (label: string, aria: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "als-tool";
      b.textContent = label;
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", onClick);
      return b;
    };
    hintBtn = mk("🔭 望远镜 2", "用望远镜缩小范围", () => useTelescope());
    tools.append(
      mk("＋", "放大场景", () => nudgeZoom(1.25)),
      mk("－", "缩小场景", () => nudgeZoom(1 / 1.25)),
      mk("⤢", "回到整张场景", () => {
        view = clampView({ ...DEFAULT_VIEW }, viewport());
        opts.sfx("tap");
      }),
      hintBtn
    );
    refreshTools();
  }

  /** 触屏方向盘:每位玩家一套,和键盘完全等价 */
  function buildPad(player: number): void {
    const pad = document.createElement("div");
    pad.className = "as-pad";
    const title = document.createElement("div");
    title.className = "as-pad-t";
    title.style.color = P_COLOR[player];
    title.textContent = player === 0 ? "朵朵 W A S D / F" : "星星 ↑←↓→ / L";
    pad.appendChild(title);

    const mk = (label: string, aria: string, hot = false): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `as-btn${hot ? " as-btn-ok" : ""}`;
      b.textContent = label;
      b.setAttribute("aria-label", `${P_NAME[player]}${aria}`);
      return b;
    };
    const hold = (b: HTMLButtonElement, dir: "up" | "down" | "left" | "right"): void => {
      const on = (ev: Event): void => {
        ev.preventDefault();
        held[player][dir] = true;
      };
      const off = (): void => {
        held[player][dir] = false;
      };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off);
      b.addEventListener("pointercancel", off);
    };

    const blank = (): HTMLElement => document.createElement("span");
    const up = mk("▲", "向上");
    const leftB = mk("◀", "向左");
    const ok = mk("✓", "确认", true);
    const rightB = mk("▶", "向右");
    const down = mk("▼", "向下");
    hold(up, "up");
    hold(leftB, "left");
    hold(rightB, "right");
    hold(down, "down");
    ok.addEventListener("click", () => pick(player, cursors[player].x, cursors[player].y));
    pad.append(blank(), up, blank(), leftB, ok, rightB, blank(), down, blank());
    pads.appendChild(pad);
  }

  for (let p = 0; p < opts.players; p++) buildPad(p);
  const pause = document.createElement("button");
  pause.type = "button";
  pause.className = "as-btn";
  pause.textContent = "⏸";
  pause.setAttribute("aria-label", "暂停");
  pause.addEventListener("click", () => togglePause());
  pads.appendChild(pause);

  if (opts.players === 1) buildTools();
  refreshList();

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // 外壳的暂停面板走这条线：它停的是同一个 paused，和自家 Esc / ⏸ 按钮一个开关
  const dropGate = registerGate({
    freeze: () => {
      shellHeld = !paused;
      if (shellHeld) paused = true;
    },
    thaw: () => {
      // 面板弹出来之前孩子自己就按过暂停的，关掉面板不要替他恢复
      if (shellHeld) paused = false;
      shellHeld = false;
    },
  });

  syncSize();
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      dropGate();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      touches.clear();
      drag = null;
      pinch = null;
      hintBtn = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 结算文案(纯函数,便于测试)
// ---------------------------------------------------------------------------

/** 找物关过关时的一句夸奖 */
export function findLine(res: SeekResult, need: number): string {
  if (res.misses === 0) return `${need} 个全找到,一次都没点错,眼力真好!`;
  if (res.misses <= 2) return `全找到啦!只点错了 ${res.misses} 次,已经很稳了。`;
  return `全找到啦!这次点错 ${res.misses} 次,下次先看清再点会更快。`;
}

/** 推理关过关时的一句夸奖 */
export function deduceLine(res: SeekResult): string {
  if (res.misses === 0) return "线索一条都没读错,一次就点中,推理小能手!";
  return `虽然绕了 ${res.misses} 个弯,最后还是把它揪出来啦!`;
}

// ---------------------------------------------------------------------------
// 战役:188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const lv = LEVELS[ctx.level];
  const deduce = lv.mode === "deduce";
  const runner = createRunner(stage, {
    level: lv,
    banner: `${CHAPTERS[lv.chapter].emoji} 第 ${ctx.level + 1} 关${deduce ? " · 推理" : ""}`,
    players: 1,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (!res.cleared) {
        ctx.lose(deduce
          ? "线索还差一步就对上了～下一轮读到一条线索先在心里划掉一批,范围会缩得很快!"
          : "时间到～下一轮按「从上到下、一行行扫」的顺序找,不回头重复看,速度立刻就上来了!");
        return;
      }
      // 用过望远镜就封顶两星:提示帮了忙,星星要留给自己找到的那一次
      const base = deduce
        ? deduceStars(res.misses, res.secondsLeft)
        : findStars(res.secondsLeft, lv.seconds, res.misses);
      const stars = starsAfterHints(base, res.hintsUsed);
      const line = deduce ? deduceLine(res) : findLine(res, (lv as FindLevel).targets.length);
      ctx.win(stars, res.hintsUsed > 0 ? `${line}(这次用了望远镜,自己找到就是三星啦!)` : line);
    },
  });
  return { destroy: () => runner.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "as-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "as-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "as-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "as-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let round = 1;
  let runner: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string): void {
    runner?.destroy();
    runner = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "as-over";
    box.innerHTML = `<div class="as-over-t">${title}</div><div class="as-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "as-open";
    again.textContent = "🔁 从第 1 轮再来";
    again.addEventListener("click", () => {
      api.play("tap");
      round = 1;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startRound(): void {
    runner?.destroy();
    stage.innerHTML = "";
    chip.textContent = `♾️ 无尽寻找 · 第 ${round} 轮 · 最好成绩 第 ${best} 轮`;
    runner = createRunner(stage, {
      level: buildEndlessRound(round),
      banner: `♾️ 第 ${round} 轮`,
      players: 1,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        if (res.cleared) {
          best = save.recordEndlessBest(meta.id, round);
          api.addStars(1);
          round++;
          startRound();
        } else {
          const reached = Math.max(0, round - 1);
          best = save.recordEndlessBest(meta.id, reached);
          showOver("这一轮没找完", endlessLine(reached, best));
        }
      },
    });
  }

  startRound();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "as-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "as-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "as-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "as-chip";
  chip.textContent = "⚔️ 双人对战 · 同屏抢着找,谁找到的多谁赢";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let round = 1;
  let runner: { destroy: () => void } | null = null;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showResult(res: SeekResult): void {
    runner?.destroy();
    runner = null;
    stage.innerHTML = "";
    const who = versusWinner(res.scores[0], res.scores[1]);
    const box = document.createElement("div");
    box.className = "as-over";
    box.innerHTML = `<div class="as-over-t">${who === "平局" ? "🤝 平手!" : `🏆 ${who}赢啦!`}</div>
      <div class="as-over-s">${versusLine(res.scores[0], res.scores[1])}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "as-open as-open-vs";
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      round++;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
    if (who !== "平局") api.addStars(1);
  }

  function startRound(): void {
    runner?.destroy();
    stage.innerHTML = "";
    runner = createRunner(stage, {
      level: buildVersusRound(round),
      banner: `⚔️ 第 ${round} 局`,
      players: 2,
      sfx: (n) => api.play(n),
      onDone: showResult,
    });
  }

  startRound();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { pause: () => void; resume: () => void; destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "as-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "as-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "as-open as-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  bar.append(endlessBtn, vsBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽寻找 · 最好 第 ${best} 轮` : "♾️ 无尽寻找 · 点我开始!";
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
      mapHint: "先看清有几个要找的,再一个个点;后面的推理关要先读线索。",
      grandMessage: "188 张场景全找完啦,外星小朋友们都愿意跟你做朋友!",
      guideTitle: "寻找外星朋友 · 观察手记",
    }
  );

  return {
    // 外壳弹「先歇一会儿」时会调这一对：找物倒计时与双人抢答一起停住，
    // 不接的话面板只是挡在前面，孩子一边看着暂停一边看时间走完
    pause: freezeAll,
    resume: thawAll,
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
