import { meta } from "./meta";
export { meta };

/**
 * 扫雷花园：看数字绕开刺种，把整片花园翻开。
 *
 * 188 关闯关 + 同图竞速对战 + 连续清盘无尽 + 朵朵星星左右分屏双人。
 * 全部离线，逻辑在 `board.ts` / `solver.ts` / `run.ts` 里，本文件只负责画和接线。
 */
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { rectBottom, stageClipBottom } from "../stageFit";
import {
  FLAG,
  GUESS,
  HIDDEN,
  OPEN,
  canChord,
  fogVisible,
  flagsLeft,
  maxMines,
  xOf,
  yOf,
  type Dir
} from "./board";
import { buildIcon, cloverSVG, flagSVG, flowerSVG, signSVG, wateringCanSVG, wreathSVG } from "./art";
import guide from "./guide";
import { CHAPTERS, levelAt, levelSeed, loseLine, starsByTime, winLine, type MineLevel } from "./levels";
import {
  AI_TIERS,
  AI_TIER_HINTS,
  AI_TIER_LABELS,
  aiFirstOpen,
  aiProgress,
  aiStep,
  createAi,
  type Ai,
  type AiTier
} from "./ai";
import {
  chordAt,
  createRun,
  elapsedMs,
  expire,
  flagAt,
  flagBudgetLeft,
  moveRunCursor,
  openAt,
  revealRest,
  runProgress,
  runWrongFlags,
  timeLeftMs,
  timedOut,
  type Run,
  type RunOptions
} from "./run";

// ---------------------------------------------------------------------------
// 版面：360px 上格子必须 ≥ 28px
// ---------------------------------------------------------------------------

/** 最小格子边长（px）。手指点得准，这条线不许再往下压。 */
export const MIN_CELL = 28;
/** 大图上格子的上限，免得 5×5 的小苗床铺满整个屏幕 */
export const MAX_CELL = 44;

/**
 * 按可用宽度算格子边长。宽度不够时**不会**把格子压小 ——
 * 直接维持 28px，画面比容器宽就交给外层横向滚动（配迷你地图看全局）。
 */
export function cellPx(cols: number, width: number): number {
  const usable = Number.isFinite(width) && width > 80 ? width : 320;
  const fit = Math.floor((usable - 10) / Math.max(1, cols));
  return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
}

/** 这张图在这个宽度下要不要横向滚动 */
export function needsScroll(cols: number, width: number): boolean {
  return cellPx(cols, width) * cols + 10 > (Number.isFinite(width) && width > 80 ? width : 320);
}

export function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type FieldKey = "up" | "down" | "left" | "right" | "open" | "flag" | "pause" | null;
export type KeyScheme = "solo" | "p1" | "p2" | "none";

/**
 * 单人：方向键或 `WASD` 挪光标，`F` 翻开，`G` 插旗，`Esc` 暂停。
 * 双人：朵朵 `WASD` + `F` + `G`，星星 方向键 + `L` + `K`。
 */
export function keyAction(key: string, scheme: KeyScheme = "solo"): FieldKey {
  if (scheme === "none") return key === "Escape" ? "pause" : null;
  const arrows = scheme === "solo" || scheme === "p2";
  const wasd = scheme === "solo" || scheme === "p1";
  switch (key) {
    case "ArrowUp":
      return arrows ? "up" : null;
    case "ArrowDown":
      return arrows ? "down" : null;
    case "ArrowLeft":
      return arrows ? "left" : null;
    case "ArrowRight":
      return arrows ? "right" : null;
    case "w":
    case "W":
      return wasd ? "up" : null;
    case "s":
    case "S":
      return wasd ? "down" : null;
    case "a":
    case "A":
      return wasd ? "left" : null;
    case "d":
    case "D":
      return wasd ? "right" : null;
    case "f":
    case "F":
      return scheme === "p2" ? null : "open";
    case "g":
    case "G":
      return scheme === "p2" ? null : "flag";
    case "l":
    case "L":
      return scheme === "p1" ? null : "open";
    case "k":
    case "K":
      return scheme === "p1" ? null : "flag";
    case "Enter":
      return scheme === "p2" ? null : "open";
    case "Escape":
      return "pause";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 触屏长按插旗
// ---------------------------------------------------------------------------

/** 长按多久算插旗（毫秒）。设置里可以在这三档之间切。 */
export const LONG_PRESS_CHOICES: readonly number[] = [260, 400, 560];
export const LONG_PRESS_MS = LONG_PRESS_CHOICES[1];

/** 长按进度环的完成度 0..1（纯函数，界面照着画） */
export function longPressProgress(elapsed: number, threshold: number = LONG_PRESS_MS): number {
  if (!(threshold > 0)) return 1;
  return Math.max(0, Math.min(1, elapsed / threshold));
}

export function nextLongPress(cur: number): number {
  const i = LONG_PRESS_CHOICES.indexOf(cur);
  return LONG_PRESS_CHOICES[(i + 1) % LONG_PRESS_CHOICES.length];
}

// ---------------------------------------------------------------------------
// 动效
// ---------------------------------------------------------------------------

export function reducedMotion(): boolean {
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

/** 翻开的翻转动画时长（毫秒）；省电模式缩到最短 */
export function flipMs(reduced: boolean): number {
  return reduced ? 16 : 110;
}

/** 输了之后一颗一颗开花的间隔（毫秒）；顺序永远在，绝不一下子全开 */
export function bloomStepMs(reduced: boolean): number {
  return reduced ? 8 : 90;
}

/** 波纹开垦：大片连开时，视觉上每远一圈（曼哈顿距离）晚这么多毫秒翻起 */
export const RIPPLE_STEP_MS = 30;

/** 破土绽放的两帧间隔：先土裂再开花（弱动效直接一帧到位） */
export const BLOOM_FRAME_MS = 150;

/** HUD 进度小花的三档：花苞 → 半开 → 盛放 */
export function flowerStage(p: number): 0 | 1 | 2 {
  const v = Math.max(0, Math.min(1, p));
  return v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2;
}

/**
 * 数字 n 底下的种子点：数量（1–3）× 形状（圆/菱/方）双通道，
 * 1–8 每一档的组合都不重样——色弱的小朋友不靠颜色也分得开。
 */
export function seedSpec(n: number): { shape: number; count: number } {
  const k = Math.max(1, Math.min(8, Math.round(n))) - 1;
  return { shape: Math.floor(k / 3), count: (k % 3) + 1 };
}

/** 格子索引的小哈希：草叶朝向、石子位置全由它定，刷新不跳变也不整齐划一 */
export function cellHash(i: number): number {
  let h = ((i + 1) * 2654435761) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** 小地图（花园鸟瞰）的四色：深草绿 / 浅土色 / 旗红 / 光标描边 */
export const MINI_COLORS = {
  turf: "#7DB262",
  soil: "#F1E8D2",
  flag: "#DA5A4A",
  pole: "#7C5A36",
  cursor: "#E2705A"
} as const;

// ---------------------------------------------------------------------------
// 配色与文案
// ---------------------------------------------------------------------------

/** 数字 1–8 的粉彩八色（对着浅底都够对比度） */
export const HINT_COLORS: readonly string[] = [
  "#3F7D3A",
  "#2F5FA8",
  "#B03E63",
  "#6A44A0",
  "#A86A22",
  "#1F7A73",
  "#6B4A38",
  "#4A4A5C"
];

export function hintColor(n: number): string {
  return HINT_COLORS[Math.max(0, Math.min(HINT_COLORS.length - 1, n - 1))];
}

/** 计时 / 倒计时都用 mm:ss */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function percentText(p: number): string {
  return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

// ---------------------------------------------------------------------------
// 难度预设与无尽
// ---------------------------------------------------------------------------

export interface Preset {
  key: string;
  label: string;
  w: number;
  h: number;
  mines: number;
}

export const PRESETS: readonly Preset[] = [
  { key: "easy", label: "初级 9×9", w: 9, h: 9, mines: 10 },
  { key: "mid", label: "中级 16×16", w: 16, h: 16, mines: 40 },
  { key: "hard", label: "高级 30×16", w: 30, h: 16, mines: 99 }
];

/** 无尽：每清一盘密度 +1 颗刺种 */
export function endlessMines(round: number, preset: Preset): number {
  return Math.min(maxMines(preset.w, preset.h, 0) - 1, preset.mines + Math.max(0, round));
}

export function endlessLine(streak: number, best: number, mines: number): string {
  return `连清 ${streak} 盘 · 最好成绩 ${Math.max(best, streak)} 盘 · 这一盘 ${mines} 颗刺种`;
}

export const MODE_LABELS = {
  versus: "🤖 竞速对战",
  endless: "🔥 连续清盘",
  duo: "👫 双人同屏"
} as const;

export type ExtraMode = keyof typeof MODE_LABELS;

/** 竞速对战里假人那根进度条的刷新间隔（毫秒） */
export const AI_TICK_MS = 120;

/**
 * 一次插旗动作的去重窗口（毫秒）。
 * 右键会连着发 pointerdown(button=2) 和 contextmenu，安卓长按也会补一发 contextmenu，
 * 两发都翻旗的话等于没插。这个窗口内只认头一发。
 */
export const DOUBLE_FLAG_GUARD_MS = 400;

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

export const MN_CSS = `
.mn-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#F4FBEC,#E9F5E0);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.mn-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.mn-modebar[hidden]{display:none;}
.mn-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#41633A;text-align:center;overflow-wrap:anywhere;}
.mn-open,.mn-back{border:none;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  min-height:44px;font-family:inherit;background:linear-gradient(180deg,#6FA85A,#568844);box-shadow:0 4px 0 #416832;}
.mn-open:active,.mn-back:active{transform:translateY(2px);box-shadow:0 2px 0 #416832;}
.mn-back{background:linear-gradient(180deg,#7E97C0,#65799C);box-shadow:0 4px 0 #4E5E7C;}
.mn-back:active{box-shadow:0 2px 0 #4E5E7C;}
.mn-field{position:relative;}
.mn-hud{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.mn-chip{background:#fff;border-radius:999px;padding:6px 11px;font-size:16px;font-weight:800;color:#3F6033;
  box-shadow:0 2px 6px rgba(110,150,90,.24);overflow-wrap:anywhere;display:inline-flex;align-items:center;gap:4px;}
.mn-chip b{color:#B0563E;}
.mn-chip svg{width:15px;height:15px;flex:0 0 auto;}
.mn-mbar{width:30px;height:7px;border-radius:999px;background:#E7F0DA;overflow:hidden;flex:0 0 auto;
  box-shadow:inset 0 1px 1px rgba(110,150,90,.25);}
.mn-mbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#F6C6D8,#E58BA8);}
.mn-chip.mn-warn{background:#FFF0E4;color:#A85A28;}
.mn-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;border-radius:12px;max-width:100%;
  padding:3px;background:#DCEBCF;}
.mn-grid{display:grid;gap:2px;margin:0 auto;width:max-content;}
.mn-cell{border:none;padding:0;margin:0;border-radius:6px;font-family:inherit;font-weight:900;
  --mn-b:none;--mn-g:linear-gradient(180deg,#BDE0A6,#A8D08C);
  background-color:#A8D08C;background-image:var(--mn-b),var(--mn-g);
  background-size:100% 100%;background-repeat:no-repeat;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -2px 0 rgba(90,130,70,.4);
  display:flex;align-items:center;justify-content:center;line-height:1;touch-action:none;position:relative;
  cursor:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><path d='M13.2 2.6l6.2 6.2-2.5 2.5-6.2-6.2z' fill='%238A5B33'/><path d='M9.4 6.6l6 6-6.6 6.8q-3.2 1.6-5.4 1.2-.4-2.2 1.2-5.4z' fill='%23AEB6C2'/><path d='M10 8.4l3.6 3.6' stroke='%23DDE3EC' stroke-width='1.2'/></svg>") 4 18,pointer;}
.mn-cell:active{transform:scale(.94);}
.mn-cell svg{width:74%;height:74%;display:block;pointer-events:none;}
.mn-cell.mn-g1{--mn-g:linear-gradient(180deg,#B5D99C,#A0C983);}
.mn-cell.mn-t0{--mn-b:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><path d='M7 22q1.8-4.6.4-8' stroke='%23709E51' stroke-width='1.5' fill='none' stroke-linecap='round'/><path d='M19 13q1.6-3.6.2-6.4' stroke='%2380B160' stroke-width='1.3' fill='none' stroke-linecap='round'/></svg>");}
.mn-cell.mn-t1{--mn-b:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><path d='M21 22q-1.8-4.6-.4-8' stroke='%23709E51' stroke-width='1.5' fill='none' stroke-linecap='round'/><path d='M8 12q-1.5-3.4-.2-6' stroke='%2380B160' stroke-width='1.3' fill='none' stroke-linecap='round'/></svg>");}
.mn-cell.mn-t2{--mn-b:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><path d='M6 10q.8-2.6 0-4.6' stroke='%23709E51' stroke-width='1.4' fill='none' stroke-linecap='round'/><path d='M14 24q1-2.8 0-5' stroke='%2380B160' stroke-width='1.4' fill='none' stroke-linecap='round'/><path d='M22 11q-1-2.6 0-4.8' stroke='%23709E51' stroke-width='1.3' fill='none' stroke-linecap='round'/></svg>");}
.mn-cell.mn-lit{background:#F5EFDF;cursor:default;text-shadow:0 1px 0 rgba(255,255,255,.9);
  box-shadow:inset 0 2px 3px rgba(125,105,70,.25),inset 0 0 0 1px rgba(160,140,105,.35);
  animation:mnflip 110ms ease-out;}
.mn-cell.mn-lit.mn-s1{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><ellipse cx='20.5' cy='21.5' rx='2.6' ry='1.8' fill='%23DCD2B9'/><ellipse cx='19.8' cy='21' rx='1.1' ry='.6' fill='%23EFE8D6'/></svg>");}
.mn-cell.mn-lit.mn-s2{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><ellipse cx='7' cy='6.5' rx='2.2' ry='1.6' fill='%23DCD2B9'/><circle cx='21' cy='8' r='1.2' fill='%23E4DBC4'/></svg>");}
.mn-cell.mn-lit.mn-s3{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><ellipse cx='6.5' cy='21' rx='2.4' ry='1.7' fill='%23DCD2B9'/><ellipse cx='21' cy='6.8' rx='1.8' ry='1.3' fill='%23E4DBC4'/></svg>");}
.mn-cell.mn-turn{animation:mnturn 150ms ease-out;}
.mn-cell.mn-crumb::after{content:"";position:absolute;left:30%;top:-2px;width:4px;height:4px;border-radius:50%;
  background:#8FBF74;animation:mncrumb .4s ease-out forwards;pointer-events:none;}
.mn-cell.mn-chordable{box-shadow:inset 0 0 0 2px #E0A94A,inset 0 2px 3px rgba(125,105,70,.18);cursor:pointer;}
.mn-cell.mn-flag{background:linear-gradient(180deg,#F6D9A8,#EFC684);}
.mn-cell.mn-flag svg{transform-origin:50% 88%;animation:mnplant 200ms cubic-bezier(.34,1.56,.64,1);}
.mn-cell.mn-guess{background:linear-gradient(180deg,#DCD8EE,#C7C1E2);}
.mn-cell.mn-bloom{background:#FDEFF5;animation:mnbloom 260ms cubic-bezier(.34,1.56,.64,1);}
.mn-cell.mn-wrong{background:#EFE7DA;}
.mn-cell.mn-cursor{outline:3px solid #E2705A;outline-offset:-2px;z-index:2;}
.mn-cell.mn-dark{background:linear-gradient(180deg,#9FB3A0,#8CA18E);color:transparent;
  box-shadow:inset 0 -2px 0 rgba(70,90,75,.4);}
.mn-cell.mn-dark.mn-lit{background:#C6CFC1;}
.mn-cell.mn-pressing::after{content:"";position:absolute;inset:2px;border-radius:5px;
  border:2px solid #E0A94A;opacity:var(--mn-press,0);}
.mn-seeds{position:absolute;left:0;right:0;bottom:2px;display:flex;gap:2px;justify-content:center;
  pointer-events:none;}
.mn-seeds .mn-seed{width:3px;height:3px;background:currentColor;opacity:.55;display:block;}
.mn-sh0 .mn-seed{border-radius:50%;}
.mn-sh1 .mn-seed{transform:rotate(45deg);border-radius:1px;}
.mn-sh2 .mn-seed{border-radius:1px;}
.mn-cell .mn-pop{position:absolute;left:16%;top:12%;width:68%;height:68%;pointer-events:none;z-index:3;
  animation:mnpop .72s ease-out forwards;}
@media (hover:hover){.mn-cell:not(.mn-lit):not(.mn-dark):hover{filter:brightness(1.06);}}
@keyframes mnflip{from{transform:rotateX(70deg);opacity:.3}to{transform:none;opacity:1}}
@keyframes mnbloom{from{transform:scale(.4)}to{transform:scale(1)}}
@keyframes mnturn{0%{transform:scaleY(1)}45%{transform:scaleY(.12)}100%{transform:scaleY(1)}}
@keyframes mnplant{from{transform:translateY(-45%);opacity:.4}to{transform:none;opacity:1}}
@keyframes mncrumb{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translate(4px,-10px)}}
@keyframes mnpop{0%{transform:scale(.2) translateY(4px);opacity:0}30%{opacity:1}100%{transform:scale(1.05) translateY(-7px);opacity:0}}
.mn-mini{display:block;margin:6px auto 0;border-radius:8px;background:#DCEBCF;border:1px solid #B9D3A4;
  box-shadow:0 2px 6px rgba(110,150,90,.3);box-sizing:border-box;max-width:100%;}
/* display:block 会盖掉 UA 的 [hidden]{display:none}——这行补回来，收起时不再留一块空底板 */
.mn-mini[hidden]{display:none;}
.mn-minitip{text-align:center;font-size:var(--mt-body,16px);font-weight:700;color:#5B7A4C;margin-top:2px;}
.mn-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.mn-btn{border:none;border-radius:12px;padding:9px 13px;min-height:40px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#fff;color:#3F6033;box-shadow:0 3px 0 rgba(110,150,90,.32);white-space:nowrap;}
.mn-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,150,90,.32);}
.mn-btn.mn-on{background:#DCEFC9;color:#37642A;}
.mn-btn:disabled{opacity:.5;cursor:default;}
.mn-btn:focus-visible,.mn-open:focus-visible,.mn-back:focus-visible,.mn-cell:focus-visible{outline:3px solid #274C1C;outline-offset:2px;}
.mn-msg{text-align:center;font-size:16px;font-weight:800;color:#41633A;min-height:22px;line-height:1.6;margin-top:8px;
  overflow-wrap:anywhere;}
.mn-note{text-align:center;font-size:16px;font-weight:700;color:#5B7A4C;line-height:1.6;margin:6px auto 0;
  max-width:520px;overflow-wrap:anywhere;}
.mn-setup{display:flex;flex-direction:column;gap:8px;align-items:center;}
.mn-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;}
.mn-label{font-size:var(--mt-body,16px);font-weight:800;color:#4B6B3E;}
.mn-duo{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:flex-start;}
.mn-duo>div{flex:1 1 300px;min-width:280px;}
.mn-side{background:#ffffffcc;border-radius:12px;padding:8px 10px;font-size:16px;font-weight:800;color:#41633A;
  line-height:1.7;margin:8px auto 0;max-width:520px;}
.mn-bar{height:10px;border-radius:999px;background:#D6E6C6;overflow:hidden;margin-top:4px;}
.mn-bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8CC46C,#5E9B45);}
.mn-over{position:absolute;inset:0;background:rgba(244,251,236,.96);border-radius:16px;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;z-index:6;}
.mn-over-t{font-size:21px;font-weight:900;color:#3F7D3A;}
.mn-over-art{line-height:0;}
.mn-over-art svg{width:92px;height:92px;}
.mn-over-s{font-size:16px;font-weight:700;color:#4B6B3E;line-height:1.6;max-width:340px;overflow-wrap:anywhere;}
@media (max-width:420px){
  .mn-wrap{padding:8px;}
  .mn-chip{padding:5px 9px;}
  .mn-duo>div{min-width:0;flex:1 1 100%;}
}
/* r5 N-20:915×412 矮横屏纵排装不下(第 5 行+长按钮折叠线下)——盘左、HUD/提示/工具右双栏;
   双人分屏两块盘各自窄,保持原纵排 */
@media (min-width:700px) and (max-height:520px){
  .mn-field{display:grid;grid-template-columns:minmax(0,auto) minmax(210px,1fr);column-gap:12px;row-gap:6px;
    align-items:start;justify-content:center;}
  .mn-field .mn-scroll{grid-column:1;grid-row:1 / span 5;}
  .mn-hud,.mn-mini,.mn-minitip,.mn-msg,.mn-tools{grid-column:2;margin:0;}
  .mn-duo .mn-field{display:block;}
}
@media (prefers-reduced-motion:reduce){
  .mn-cell.mn-lit{animation:none;}
  .mn-cell.mn-bloom{animation:none;}
  .mn-cell.mn-turn{animation:none;}
  .mn-cell.mn-flag svg{animation:none;}
  .mn-cell.mn-crumb::after{animation:none;content:none;}
  .mn-cell .mn-pop{animation:none;opacity:0;}
}
`;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function el(tag: string, cls = "", text = ""): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function chip(text: string): HTMLElement {
  return el("span", "mn-chip", text);
}

function button(text: string, onClick: () => void, on = false): HTMLElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `mn-btn${on ? " mn-on" : ""}`;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

/** 一个只管清理的定时器篮子：destroy 的时候一口气全倒掉 */
class Timers {
  private timeouts = new Set<number>();
  private intervals = new Set<number>();
  private frames = new Set<number>();

  after(fn: () => void, ms: number): number {
    const id = setTimeout(() => {
      this.timeouts.delete(id as unknown as number);
      fn();
    }, ms) as unknown as number;
    this.timeouts.add(id);
    return id;
  }

  every(fn: () => void, ms: number): number {
    const id = setInterval(fn, ms) as unknown as number;
    this.intervals.add(id);
    return id;
  }

  frame(fn: () => void): number {
    const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
    if (!raf) return this.after(fn, 16);
    const id = raf(() => {
      this.frames.delete(id);
      fn();
    });
    this.frames.add(id);
    return id;
  }

  cancel(id: number): void {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    this.timeouts.delete(id);
    const caf = (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame;
    if (this.frames.has(id)) {
      caf?.(id);
      this.frames.delete(id);
    }
  }

  clear(): void {
    for (const id of this.timeouts) clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    for (const id of this.intervals) clearInterval(id as unknown as ReturnType<typeof setInterval>);
    const caf = (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame;
    for (const id of this.frames) caf?.(id);
    this.timeouts.clear();
    this.intervals.clear();
    this.frames.clear();
  }
}

function nowMs(): number {
  const p = (globalThis as { performance?: { now: () => number } }).performance;
  return p ? p.now() : Date.now();
}

// ---------------------------------------------------------------------------
// 一片花园（四种模式共用的核心组件）
// ---------------------------------------------------------------------------

export interface FieldEndInfo {
  win: boolean;
  ms: number;
  usedProtect: boolean;
  reason: "clear" | "hit" | "time";
}

export interface FieldOptions extends RunOptions {
  title?: string;
  /** 键盘方案；双人同屏时两边各一套 */
  scheme?: KeyScheme;
  /** 分屏用的紧凑版：格子小一点，工具行收起来 */
  compact?: boolean;
  longPressMs?: number;
  sfx: (name: SoundName) => void;
  /** 本局结束（赢或输）时回调一次 */
  onEnd?: (info: FieldEndInfo) => void;
  /** 第一下点完、种布好之后回调（竞速对战靠它把同一张图交给假人） */
  onPlant?: (mine: Uint8Array, first: number) => void;
  /** 自己弹结算浮层；闯关交给 188 关框架，所以传 false */
  autoSettle?: boolean;
  /** 结算浮层上的「再来一盘」；不给就不显示 */
  onReplay?: () => void;
}

export interface FieldHandle {
  destroy: () => void;
  run: Run;
  el: HTMLElement;
  /** 让外面的人（比如暂停键）也能问一句现在过了多久 */
  elapsed: () => number;
}

/**
 * 挂一片可玩的花园。
 *
 * 交互：左键 / `F` 翻开，右键 / `G` 插旗，`WASD` 或方向键挪光标，`Esc` 暂停；
 * 触屏点一下翻开、长按插旗（有进度环）；已翻开的数字格再点一下就是和弦。
 */
export function mountField(host: HTMLElement, opts: FieldOptions): FieldHandle {
  const run = createRun(opts);
  const timers = new Timers();
  const reduced = reducedMotion();
  const scheme: KeyScheme = opts.scheme ?? "solo";
  let longPress = opts.longPressMs ?? LONG_PRESS_MS;
  let paused = false;
  let pausedTotal = 0;
  let pauseStart = 0;
  let finished = false;
  let dead = false;
  let bloomed: number[] = [];
  /** 波纹开垦：逻辑上已翻开、视觉上还排着队没掀草皮的格子 */
  const pendingReveal = new Set<number>();
  /** 这一拍刚被波纹翻起的格子：paintCell 给它加一次「掀草皮」动画 */
  const justTurned = new Set<number>();
  /** 破土绽放第一帧（土裂）里的刺种格 */
  const sprouting = new Set<number>();

  const wrap = el("div", "mn-field");
  const hud = el("div", "mn-hud");
  const flagChip = chip("");
  flagChip.appendChild(buildIcon(flagSVG(), "mn-ci"));
  const flagText = el("span", "", "0");
  flagChip.appendChild(flagText);
  const clockChip = chip("⏱ 00:00");
  const doneChip = chip("");
  const doneIcon = el("span", "mn-cicon");
  doneIcon.setAttribute("aria-hidden", "true");
  let doneStage = -1;
  const doneBar = el("span", "mn-mbar");
  doneBar.setAttribute("aria-hidden", "true");
  const doneFill = el("i");
  doneBar.appendChild(doneFill);
  const doneText = el("span", "", "0%");
  doneChip.append(doneIcon, doneBar, doneText);
  hud.append(flagChip, clockChip, doneChip);
  if (opts.title) hud.appendChild(chip(opts.title));
  wrap.appendChild(hud);

  const scroll = el("div", "mn-scroll");
  const grid = el("div", "mn-grid");
  scroll.appendChild(grid);
  wrap.appendChild(scroll);

  const mini = document.createElement("canvas");
  mini.className = "mn-mini";
  const miniTip = el("div", "mn-minitip", "🗺 花园鸟瞰 · 地图放不下可以横着拖，这张小图就是全景。");
  wrap.append(mini, miniTip);

  const msg = el("div", "mn-msg", opts.fog ? "雾里只照亮光标周围，数字要记住。" : "第一下一定安全，放心点。");
  wrap.appendChild(msg);

  const tools = el("div", "mn-tools");
  const pressBtn = button(`🖐 长按 ${longPress}ms`, () => {
    longPress = nextLongPress(longPress);
    pressBtn.textContent = `🖐 长按 ${longPress}ms`;
    opts.sfx("tap");
  });
  const pauseBtn = button("⏸ 暂停", () => togglePause());
  if (!opts.compact) tools.append(pressBtn, pauseBtn);
  wrap.appendChild(tools);
  host.appendChild(wrap);

  const total = run.opts.w * run.opts.h;
  const cells: HTMLElement[] = new Array(total);
  for (let i = 0; i < total; i++) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "mn-cell";
    c.setAttribute("aria-label", cellLabel(i));
    bindCell(c, i);
    cells[i] = c;
    grid.appendChild(c);
  }

  function cellLabel(i: number): string {
    const x = xOf(run.opts.w, i) + 1;
    const y = yOf(run.opts.w, i) + 1;
    const st = run.board.state[i];
    if (st === OPEN) {
      const n = run.board.hint[i];
      return run.board.mine[i] ? `第 ${y} 行第 ${x} 列，刺种开花了` : `第 ${y} 行第 ${x} 列，${n} 颗刺种`;
    }
    if (st === FLAG) return `第 ${y} 行第 ${x} 列，插着小旗`;
    if (st === GUESS) return `第 ${y} 行第 ${x} 列，打了问号`;
    return `第 ${y} 行第 ${x} 列，还没翻开`;
  }

  function layout(): void {
    const px = cellPx(run.opts.w, Math.min(viewportWidth(), (host as { clientWidth?: number }).clientWidth || viewportWidth()));
    let size = opts.compact ? Math.max(MIN_CELL, Math.round(px * 0.8)) : px;
    // r5 N-20:格径宽高两把尺取小——按舞台可视余量(减掉盘下鸟瞰图/提示/工具排)
    // 反推行高上限再收一刀;MIN_CELL(28)是手指底线,贴着底线还装不下才交给舞台滚。
    if (typeof scroll.getBoundingClientRect === "function" && typeof wrap.getBoundingClientRect === "function") {
      const clip = stageClipBottom(wrap);
      const sRect = scroll.getBoundingClientRect();
      if (Number.isFinite(clip) && Number.isFinite(sRect.top)) {
        const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(sRect));
        const room = clip - sRect.top - below - 4;
        // 滚动槽内衬 3×2,格缝 2px
        const cap = Math.floor((room - 6 - (run.opts.h - 1) * 2) / run.opts.h);
        if (Number.isFinite(cap)) size = Math.max(MIN_CELL, Math.min(size, cap));
      }
    }
    grid.style.gridTemplateColumns = `repeat(${run.opts.w}, ${size}px)`;
    grid.style.fontSize = `${Math.max(13, Math.round(size * 0.52))}px`;
    for (const c of cells) {
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
    }
    const wide = size * run.opts.w + 10 > viewportWidth();
    mini.hidden = !wide;
    miniTip.hidden = !wide;
    if (wide) drawMini();
  }

  function drawMini(): void {
    // 鸟瞰图按容器实际宽收敛：320px 视口下容器不足 300px，画布跟着缩，不越界
    const measured = (wrap as { clientWidth?: number }).clientWidth || 0;
    const avail = measured > 0 ? Math.min(300, Math.max(96, measured - 8)) : 300;
    const scale = Math.max(2, Math.floor(avail / run.opts.w));
    mini.width = run.opts.w * scale;
    mini.height = run.opts.h * scale;
    const ctx = (mini as HTMLCanvasElement).getContext?.("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mini.width, mini.height);
    for (let i = 0; i < total; i++) {
      const st = run.board.state[i];
      const px = xOf(run.opts.w, i) * scale;
      const py = yOf(run.opts.w, i) * scale;
      ctx.fillStyle = st === OPEN ? MINI_COLORS.soil : MINI_COLORS.turf;
      ctx.fillRect(px, py, scale, scale);
      if (st === FLAG) {
        // 像素小旗：一格旗杆 + 两格旗面，鸟瞰图上一眼认出自己插过哪
        const u = Math.max(1, Math.floor(scale / 3));
        ctx.fillStyle = MINI_COLORS.pole;
        ctx.fillRect(px + u, py + u, 1, u * 2);
        ctx.fillStyle = MINI_COLORS.flag;
        ctx.fillRect(px + u + 1, py + u, u, u);
      }
    }
    ctx.strokeStyle = MINI_COLORS.cursor;
    ctx.lineWidth = 1;
    ctx.strokeRect(xOf(run.opts.w, run.cursor) * scale, yOf(run.opts.w, run.cursor) * scale, scale, scale);
  }

  /** 内容签名：同一格重画时内容没变就不重建节点，插旗动画才不会被重复触发 */
  const cellSig: string[] = new Array(total).fill("\u0000");

  function seedDotsEl(n: number): HTMLElement {
    const spec = seedSpec(n);
    const box = el("span", `mn-seeds mn-sh${spec.shape}`);
    box.setAttribute("aria-hidden", "true");
    for (let k = 0; k < spec.count; k++) box.appendChild(el("i", "mn-seed"));
    return box;
  }

  /** 只在签名变了的时候被叫到：把格子里的东西（数字/花/旗/木牌）重建一遍 */
  function paintCellContent(c: HTMLElement, i: number, st: number, dark: boolean): void {
    if (dark && st !== FLAG) {
      c.textContent = "";
      return;
    }
    if (st === OPEN) {
      if (run.board.mine[i]) {
        c.textContent = "";
        c.appendChild(buildIcon(flowerSVG(sprouting.has(i) ? 0 : 2), "mn-i-flower"));
        return;
      }
      const n = run.board.hint[i];
      if (n > 0) {
        c.textContent = String(n);
        c.appendChild(seedDotsEl(n));
      } else {
        c.textContent = "";
      }
      return;
    }
    if (st === FLAG) {
      const wrong = finished && !run.board.mine[i];
      c.textContent = "";
      c.appendChild(buildIcon(wrong ? cloverSVG() : flagSVG(), wrong ? "mn-i-clover" : "mn-i-flag"));
      return;
    }
    if (st === GUESS) {
      c.textContent = "";
      c.appendChild(buildIcon(signSVG(), "mn-i-guess"));
      return;
    }
    c.textContent = "";
  }

  function paintCell(i: number): void {
    const c = cells[i];
    const logical = run.board.state[i];
    // 波纹开垦：逻辑上已翻开、还排在视觉队列里的格子，先照草皮画（aria 口径始终跟逻辑走）
    const st = logical === OPEN && pendingReveal.has(i) ? HIDDEN : logical;
    const dark = Boolean(opts.fog) && !fogVisible(run.opts.w, run.opts.h, run.cursor, i);
    const h = cellHash(i);
    let cls = "mn-cell";
    let sig = `${st}|${dark ? 1 : 0}`;
    let color = "";
    if (st === OPEN) {
      if (run.board.mine[i]) {
        cls += " mn-bloom";
        if (sprouting.has(i)) {
          cls += " mn-sprout";
          sig += "|crack";
        } else {
          sig += "|flower";
        }
      } else {
        cls += " mn-lit";
        if (!dark) {
          const pebble = h % 4;
          if (pebble > 0) cls += ` mn-s${pebble}`;
          const n = run.board.hint[i];
          if (n > 0) {
            color = hintColor(n);
            sig += `|n${n}`;
          }
        }
        if (justTurned.has(i)) {
          cls += " mn-turn";
          if (h % 5 === 0) cls += " mn-crumb";
          justTurned.delete(i);
        }
        if (!finished && canChord(run.board, i)) cls += " mn-chordable";
      }
    } else if (st === FLAG) {
      const wrong = finished && !run.board.mine[i];
      cls += wrong ? " mn-flag mn-wrong" : " mn-flag";
      sig += wrong ? "|clover" : "|flag";
    } else if (st === GUESS) {
      cls += " mn-guess";
      sig += "|guess";
    } else if (!dark) {
      // 草皮双档棋盘格 + 草叶朝向三选一，全由格子哈希定，不泄露任何内容
      cls += ` mn-g${(xOf(run.opts.w, i) + yOf(run.opts.w, i)) & 1} mn-t${h % 3}`;
    }
    if (dark) cls += " mn-dark";
    if (i === run.cursor && scheme !== "none") cls += " mn-cursor";
    c.className = cls;
    if (cellSig[i] !== sig) {
      cellSig[i] = sig;
      paintCellContent(c, i, st, dark);
    }
    c.style.color = color;
    c.setAttribute("aria-label", cellLabel(i));
  }

  function paintAll(): void {
    for (let i = 0; i < total; i++) paintCell(i);
    if (!mini.hidden) drawMini();
  }

  function clock(): number {
    const raw = nowMs();
    const pausedNow = paused ? raw - pauseStart : 0;
    return raw - pausedTotal - pausedNow;
  }

  function paintHud(): void {
    const budget = flagBudgetLeft(run);
    flagText.textContent = Number.isFinite(budget)
      ? `${budget} / ${run.opts.flagLimit}`
      : `${flagsLeft(run.board)}`;
    flagChip.className = Number.isFinite(budget) && budget <= 0 ? "mn-chip mn-warn" : "mn-chip";
    const limit = run.opts.timeLimitMs;
    if (typeof limit === "number") {
      const left = timeLeftMs(run, clock());
      clockChip.textContent = `⏳ ${clockText(left)}`;
      clockChip.className = left <= 20000 ? "mn-chip mn-warn" : "mn-chip";
    } else {
      clockChip.textContent = `⏱ ${clockText(elapsedMs(run, clock()))}`;
    }
    // 小花进度条：花苞 → 半开 → 盛放，跟着翻开进度换脸
    const p = runProgress(run);
    const stage = flowerStage(p);
    if (stage !== doneStage) {
      doneStage = stage;
      doneIcon.textContent = "";
      doneIcon.appendChild(buildIcon(flowerSVG(stage), "mn-ci"));
    }
    doneFill.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    doneText.textContent = percentText(p);
  }

  /** 胜利花开波：一列一列冒小花，一共不超过 20 朵，0.8 秒内收场 */
  function bloomWave(): void {
    const cols = Math.min(run.opts.w, 20);
    for (let k = 0; k < cols; k++) {
      const x = Math.floor((k * run.opts.w) / cols);
      const y = cellHash(x * 7 + k) % run.opts.h;
      const idx = y * run.opts.w + x;
      timers.after(() => {
        if (dead) return;
        const pop = buildIcon(flowerSVG(2), "mn-pop");
        cells[idx].appendChild(pop);
        timers.after(() => pop.remove(), 720);
      }, 40 * k);
    }
  }

  function finish(win: boolean, reason: FieldEndInfo["reason"]): void {
    if (finished) return;
    finished = true;
    pendingReveal.clear();
    const ms = elapsedMs(run, clock());
    if (win) {
      opts.sfx("win");
      msg.textContent = "整片花园都翻开啦！";
      if (!reduced) bloomWave();
    } else {
      opts.sfx("oops");
      msg.textContent = loseLine(reason === "time" ? "time" : "hit");
      // 温柔揭开剩下的刺种：一颗一颗慢慢开花，绝不一下子全开；
      // 每颗两帧——先土裂再绽放，弱动效时一帧到位
      bloomed = revealRest(run);
      const step = bloomStepMs(reduced);
      bloomed.forEach((idx, k) => {
        timers.after(() => {
          if (dead) return;
          run.board.state[idx] = OPEN;
          if (reduced) {
            paintCell(idx);
            return;
          }
          sprouting.add(idx);
          paintCell(idx);
          timers.after(() => {
            if (dead) return;
            sprouting.delete(idx);
            paintCell(idx);
          }, BLOOM_FRAME_MS);
        }, step * (k + 1));
      });
      for (const idx of runWrongFlags(run)) paintCell(idx);
    }
    paintAll();
    paintHud();
    if (opts.autoSettle !== false) showOver(win, ms);
    opts.onEnd?.({ win, ms, usedProtect: run.usedProtect, reason });
  }

  function showOver(win: boolean, ms: number): void {
    const ov = el("div", "mn-over");
    // 赢了配大花环，没扫完配一把浇水壶——回头浇一浇再来
    const art = el("div", "mn-over-art");
    art.setAttribute("aria-hidden", "true");
    art.appendChild(buildIcon(win ? wreathSVG() : wateringCanSVG(), "mn-i-settle"));
    ov.appendChild(art);
    ov.appendChild(el("div", "mn-over-t", win ? "🌼 扫种完成！" : "🌱 这一片没扫完"));
    ov.appendChild(
      el("div", "mn-over-s", win ? `用时 ${clockText(ms)}，${run.board.mines} 颗刺种都绕开了。` : loseLine("hit"))
    );
    if (opts.onReplay) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mn-open";
      b.textContent = "🔁 再来一盘";
      b.addEventListener("click", () => {
        opts.sfx("tap");
        ov.remove();
        opts.onReplay?.();
      });
      ov.appendChild(b);
    }
    wrap.appendChild(ov);
  }

  /**
   * 波纹开垦：大片连开只是「看起来」一圈一圈翻——离起点每远一圈晚 30ms 掀草皮。
   * 逻辑上 `board.ts` 早就一次性全翻开了，这里只排视觉队列；
   * 定时器都挂在 `timers` 篮子里，destroy 一口气倒掉；弱动效时压根不排队。
   */
  function queueRipple(origin: number, opened: number[]): void {
    const ox = xOf(run.opts.w, origin);
    const oy = yOf(run.opts.w, origin);
    for (const idx of opened) {
      const d = Math.abs(xOf(run.opts.w, idx) - ox) + Math.abs(yOf(run.opts.w, idx) - oy);
      if (d === 0) continue;
      pendingReveal.add(idx);
      timers.after(() => {
        if (dead) return;
        pendingReveal.delete(idx);
        justTurned.add(idx);
        paintCell(idx);
      }, RIPPLE_STEP_MS * d);
    }
  }

  function afterAction(res: ReturnType<typeof openAt>, origin: number): void {
    if (res.first) {
      opts.onPlant?.(Uint8Array.from(run.board.mine), run.firstIndex);
      msg.textContent = run.noGuess
        ? "这一张保证能算出来，不用蒙。"
        : "看数字推刺种，拿不准就先插面小旗。";
    }
    if (res.blocked) {
      msg.textContent = "小旗用完啦，先收一面再插。";
      opts.sfx("oops");
    } else if (res.saved) {
      msg.textContent = "小铲子替你挡下了一颗刺种，已经插好小旗。";
      opts.sfx("pop");
    } else if (res.flag === "flag") {
      opts.sfx("pop");
    } else if (res.flag === "clear" || res.flag === "guess") {
      opts.sfx("tap");
    } else if (res.opened.length > 0) {
      opts.sfx("tap");
    }
    if (!reduced && !res.win && !res.lose && res.opened.length > 1) queueRipple(origin, res.opened);
    paintAll();
    paintHud();
    if (res.win) finish(true, "clear");
    else if (res.lose) finish(false, "hit");
  }

  function doOpen(i: number): void {
    if (finished || paused) return;
    if (run.board.state[i] === OPEN) {
      afterAction(chordAt(run, i, clock()), i);
      return;
    }
    afterAction(openAt(run, i, clock()), i);
  }

  function doFlag(i: number): void {
    if (finished || paused) return;
    afterAction(flagAt(run, i, clock()), i);
  }

  function bindCell(c: HTMLElement, i: number): void {
    let pressAt = 0;
    let longFired = false;
    let raf = 0;
    // 右键会连着发 pointerdown(button=2) 和 contextmenu，长按在有些浏览器上也会补一发 contextmenu。
    // 插旗只认第一发，后面这一小会儿的重复事件一律吞掉，免得刚插上又被自己拔掉。
    let flaggedAt = -1e9;
    const flagOnce = (): void => {
      const t = nowMs();
      if (t - flaggedAt < DOUBLE_FLAG_GUARD_MS) return;
      flaggedAt = t;
      doFlag(i);
    };

    const stopRing = (): void => {
      if (raf) timers.cancel(raf);
      raf = 0;
      c.style.removeProperty?.("--mn-press");
      c.className = c.className.replace(" mn-pressing", "");
    };

    const ring = (): void => {
      if (dead || longFired || pressAt === 0) return;
      const p = longPressProgress(nowMs() - pressAt, longPress);
      c.style.setProperty?.("--mn-press", String(p));
      if (p >= 1) {
        longFired = true;
        stopRing();
        flagOnce();
        return;
      }
      raf = timers.frame(ring);
    };

    c.addEventListener("pointerdown", (ev) => {
      const e = ev as PointerEvent;
      if (e.button === 2) {
        e.preventDefault?.();
        flagOnce();
        longFired = true;
        return;
      }
      pressAt = nowMs();
      longFired = false;
      c.className += " mn-pressing";
      raf = timers.frame(ring);
    });
    c.addEventListener("pointerup", () => {
      stopRing();
      const wasLong = longFired;
      pressAt = 0;
      longFired = false;
      if (!wasLong) doOpen(i);
    });
    c.addEventListener("pointercancel", () => {
      stopRing();
      pressAt = 0;
      longFired = false;
    });
    c.addEventListener("pointerleave", () => {
      stopRing();
      pressAt = 0;
    });
    c.addEventListener("contextmenu", (ev) => {
      (ev as Event).preventDefault?.();
      flagOnce();
      longFired = true;
    });
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    if (paused) {
      pauseStart = nowMs();
      pauseBtn.textContent = "▶ 继续";
      msg.textContent = "先歇一会儿，计时停住了。";
    } else {
      pausedTotal += nowMs() - pauseStart;
      pauseBtn.textContent = "⏸ 暂停";
      msg.textContent = "接着扫。";
    }
    paintHud();
  }

  const onKey = (ev: Event): void => {
    if (dead) return;
    const e = ev as KeyboardEvent;
    const act = keyAction(e.key, scheme);
    if (!act) return;
    e.preventDefault?.();
    if (act === "pause") {
      togglePause();
      return;
    }
    if (paused || finished) return;
    if (act === "open") doOpen(run.cursor);
    else if (act === "flag") doFlag(run.cursor);
    else {
      moveRunCursor(run, act as Dir);
      paintAll();
    }
  };

  const onResize = (): void => layout();
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey);
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("resize", onResize);

  timers.every(() => {
    if (dead || finished) return;
    paintHud();
    if (!paused && timedOut(run, clock())) {
      expire(run, clock());
      finish(false, "time");
    }
  }, 250);

  layout();
  // 挂载那一刻可能还没排好版(量不到舞台),抽空补量一次
  timers.after(layout, 0);
  paintAll();
  paintHud();

  return {
    run,
    el: wrap,
    elapsed: () => elapsedMs(run, clock()),
    destroy() {
      dead = true;
      timers.clear();
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey
      );
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "resize",
        onResize
      );
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

export function levelRunOptions(level: MineLevel, retry = 0): RunOptions {
  return {
    w: level.w,
    h: level.h,
    mines: level.mines,
    seed: levelSeed(level.index, retry),
    noGuess: level.noGuess,
    protect: level.protect,
    fog: level.fog,
    flagLimit: level.flagLimit,
    timeLimitMs: level.timeLimitMs
  };
}

/** 关卡上方那行小字：这一关有什么特别的 */
export function levelNote(level: MineLevel): string {
  const bits = [`${level.h} 行 × ${level.w} 列 · ${level.mines} 颗刺种`];
  if (level.protect) bits.push("有一次保护");
  if (level.chordCourse) bits.push("练和弦");
  if (level.fog) bits.push("有雾");
  if (level.flagLimit) bits.push(`小旗上限 ${level.flagLimit}`);
  if (level.timeLimitMs) bits.push(`限时 ${clockText(level.timeLimitMs)}`);
  if (level.noGuess) bits.push("保证能算出来");
  return bits.join(" · ");
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const level = levelAt(ctx.level);
  const note = el("div", "mn-note", `${level.task} ${levelNote(level)}`);
  stage.appendChild(note);
  const field = mountField(stage, {
    ...levelRunOptions(level),
    title: level.title,
    sfx: ctx.sfx,
    autoSettle: false,
    onEnd: (info) => {
      if (info.win) {
        const stars = starsByTime(info.ms, level.starMs, info.usedProtect);
        ctx.win(stars, winLine(level, stars, info.ms));
      } else {
        ctx.lose(loseLine(info.reason === "time" ? "time" : "hit"));
      }
    }
  });
  return {
    destroy() {
      field.destroy();
      note.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 竞速对战 / 连续清盘 / 双人同屏
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const box = el("div");
  host.appendChild(box);
  let preset = PRESETS[0];
  let tier: AiTier = "normal";
  let field: FieldHandle | null = null;
  let ai: Ai | null = null;
  const timers = new Timers();
  let seed = (Date.now() ^ 0x51ed) >>> 0;
  let dead = false;

  function clear(): void {
    timers.clear();
    field?.destroy();
    field = null;
    ai = null;
    box.textContent = "";
  }

  function setup(): void {
    clear();
    const wrap = el("div", "mn-setup");
    const r1 = el("div", "mn-row");
    r1.appendChild(el("span", "mn-label", "地块"));
    for (const p of PRESETS) {
      r1.appendChild(
        button(p.label, () => {
          api.play("tap");
          preset = p;
          setup();
        }, preset.key === p.key)
      );
    }
    const r2 = el("div", "mn-row");
    r2.appendChild(el("span", "mn-label", "对手"));
    for (const t of AI_TIERS) {
      r2.appendChild(
        button(AI_TIER_LABELS[t], () => {
          api.play("tap");
          tier = t;
          setup();
        }, tier === t)
      );
    }
    const note = el("div", "mn-note", `${AI_TIER_HINTS[tier]} 同一张图，比谁先扫完。`);
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mn-open";
    go.textContent = "开始竞速 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    wrap.append(r1, r2, note, go);
    box.appendChild(wrap);
  }

  function start(): void {
    clear();
    seed = (seed + 0x9e3779b9) >>> 0;
    const side = el("div", "mn-side", `🤖 ${AI_TIER_LABELS[tier]}还在等你点第一下。`);
    const bar = el("div", "mn-bar");
    const fill = el("i");
    bar.appendChild(fill);
    side.appendChild(bar);
    let over = false;

    field = mountField(box, {
      w: preset.w,
      h: preset.h,
      mines: preset.mines,
      seed,
      noGuess: true,
      sfx: (n) => api.play(n),
      title: `🤖 对手：${AI_TIER_LABELS[tier]}`,
      autoSettle: false,
      onPlant: (mine, first) => {
        // 假人和你从同一格起手，之后各扫各的
        const brain = createAi(preset.w, preset.h, mine, tier);
        ai = brain;
        const rand = makeUiRand(seed ^ 0x1234);
        let clockMs = aiFirstOpen(brain, first);
        let waitUntil = clockMs;
        fill.style.width = `${Math.round(aiProgress(brain) * 100)}%`;
        timers.every(() => {
          if (dead || over || brain.done) return;
          clockMs += AI_TICK_MS;
          if (clockMs < waitUntil) return;
          const step = aiStep(brain, rand);
          waitUntil = clockMs + step.ms;
          fill.style.width = `${Math.round(aiProgress(brain) * 100)}%`;
          if (brain.done && aiProgress(brain) >= 1) {
            over = true;
            finishRace(false);
          }
        }, AI_TICK_MS);
      },
      onEnd: (info) => {
        if (over) return;
        over = true;
        finishRace(info.win);
      },
      onReplay: () => start()
    });
    box.appendChild(side);

    function finishRace(playerWon: boolean): void {
      const ov = el("div", "mn-over");
      ov.appendChild(el("div", "mn-over-t", playerWon ? "🏆 你先扫完！" : "🌱 这一局对手快一点"));
      ov.appendChild(
        el(
          "div",
          "mn-over-s",
          playerWon
            ? `${AI_TIER_LABELS[tier]}还在慢慢数呢，这片花园是你的了。`
            : `${AI_TIER_LABELS[tier]}先扫完了，换一张图再来。`
        )
      );
      const again = document.createElement("button");
      again.type = "button";
      again.className = "mn-open";
      again.textContent = "🔁 再来一局";
      again.addEventListener("click", () => {
        api.play("tap");
        start();
      });
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "mn-back";
      backBtn.textContent = "← 换难度";
      backBtn.addEventListener("click", () => {
        api.play("tap");
        setup();
      });
      ov.append(again, backBtn);
      if (playerWon) api.play("win");
      (field?.el ?? box).appendChild(ov);
    }
  }

  setup();
  return {
    destroy() {
      dead = true;
      clear();
      box.remove();
    }
  };
}

function makeUiRand(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mountEndless(host: HTMLElement, api: GameApi): { destroy: () => void } {
  const box = el("div");
  host.appendChild(box);
  let preset = PRESETS[0];
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let field: FieldHandle | null = null;
  let seed = (Date.now() ^ 0x2f1d) >>> 0;

  function clear(): void {
    field?.destroy();
    field = null;
    box.textContent = "";
  }

  function setup(): void {
    clear();
    const wrap = el("div", "mn-setup");
    const r1 = el("div", "mn-row");
    r1.appendChild(el("span", "mn-label", "起手地块"));
    for (const p of PRESETS) {
      r1.appendChild(
        button(p.label, () => {
          api.play("tap");
          preset = p;
          streak = 0;
          setup();
        }, preset.key === p.key)
      );
    }
    const note = el("div", "mn-note", endlessLine(streak, best, endlessMines(streak, preset)));
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mn-open";
    go.textContent = streak > 0 ? "接着清 ▶" : "开始连清 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    wrap.append(r1, note, go);
    box.appendChild(wrap);
  }

  function start(): void {
    clear();
    seed = (seed + 0x85ebca6b) >>> 0;
    const mines = endlessMines(streak, preset);
    field = mountField(box, {
      w: preset.w,
      h: preset.h,
      mines,
      seed,
      noGuess: true,
      sfx: (n) => api.play(n),
      title: `🔥 连清 ${streak} · ${mines} 颗`,
      autoSettle: false,
      onEnd: (info) => {
        if (info.win) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.play("coin");
        } else {
          streak = 0;
        }
        setup();
      }
    });
    const side = el("div", "mn-side", endlessLine(streak, best, mines));
    box.appendChild(side);
  }

  setup();
  return {
    destroy() {
      clear();
      box.remove();
    }
  };
}

function mountDuo(host: HTMLElement, api: GameApi): { destroy: () => void } {
  const box = el("div");
  host.appendChild(box);
  let preset = PRESETS[0];
  let left: FieldHandle | null = null;
  let right: FieldHandle | null = null;
  let seed = (Date.now() ^ 0x77aa) >>> 0;

  function clear(): void {
    left?.destroy();
    right?.destroy();
    left = null;
    right = null;
    box.textContent = "";
  }

  function setup(): void {
    clear();
    const wrap = el("div", "mn-setup");
    const r1 = el("div", "mn-row");
    r1.appendChild(el("span", "mn-label", "地块"));
    for (const p of PRESETS) {
      r1.appendChild(
        button(p.label, () => {
          api.play("tap");
          preset = p;
          setup();
        }, preset.key === p.key)
      );
    }
    const note = el(
      "div",
      "mn-note",
      "两张一模一样的图，左边朵朵（WASD 挪、F 翻开、G 插旗），右边星星（方向键挪、L 翻开、K 插旗）。谁先扫完谁赢。"
    );
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mn-open";
    go.textContent = "开始 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    wrap.append(r1, note, go);
    box.appendChild(wrap);
  }

  function start(): void {
    clear();
    seed = (seed + 0xc2b2ae35) >>> 0;
    const row = el("div", "mn-duo");
    const lHost = el("div");
    const rHost = el("div");
    row.append(lHost, rHost);
    box.appendChild(row);
    let over = false;

    const settle = (who: string): void => {
      if (over) return;
      over = true;
      api.play("win");
      const ov = el("div", "mn-over");
      ov.appendChild(el("div", "mn-over-t", `🌼 ${who}先扫完！`));
      ov.appendChild(el("div", "mn-over-s", "同一张图，另一边也把剩下的看完再走吧。"));
      const again = document.createElement("button");
      again.type = "button";
      again.className = "mn-open";
      again.textContent = "🔁 再来一局";
      again.addEventListener("click", () => {
        api.play("tap");
        start();
      });
      ov.appendChild(again);
      box.appendChild(ov);
    };

    const common = {
      w: preset.w,
      h: preset.h,
      mines: preset.mines,
      seed,
      noGuess: true,
      compact: true,
      sfx: (n: SoundName) => api.play(n),
      autoSettle: false
    };
    left = mountField(lHost, {
      ...common,
      scheme: "p1",
      title: "🌸 朵朵",
      onEnd: (info) => {
        if (info.win) settle("朵朵");
      }
    });
    right = mountField(rHost, {
      ...common,
      scheme: "p2",
      title: "⭐ 星星",
      onEnd: (info) => {
        if (info.win) settle("星星");
      }
    });
  }

  setup();
  return {
    destroy() {
      clear();
      box.remove();
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
  const root = el("div", "mn-wrap");
  const style = document.createElement("style");
  style.textContent = MN_CSS;
  const bar = el("div", "mn-modebar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "mn-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let extra: { destroy: () => void } | null = null;

  function closeExtra(): void {
    extra?.destroy();
    extra = null;
    modeHost.textContent = "";
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mn-open";
    btn.textContent = MODE_LABELS[key];
    btn.addEventListener("click", () => {
      if (extra) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "mn-back";
      backBtn.textContent = "← 回闯关";
      backBtn.addEventListener("click", () => {
        api.play("tap");
        closeExtra();
      });
      modeHost.appendChild(backBtn);
      extra =
        key === "versus"
          ? mountVersus(modeHost, api, closeExtra)
          : key === "endless"
            ? mountEndless(modeHost, api)
            : mountDuo(modeHost, api);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关内把模式入口收起来:手机上这一条要占约 150px,雷区能整个抬进首屏
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const h = playLevel(stage, ctx);
        return {
          destroy() {
            h?.destroy?.();
            bar.hidden = false;
          }
        };
      },
      mapHint: "数字说的是它周围 8 格里有几颗刺种。第一下永远安全，放心点。",
      grandMessage: "188 关全部扫完，从小苗床一路扫到园丁杯，这片花园全开了！",
      guide,
      guideTitle: "扫雷花园 · 扫种笔记"
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

/** 给测试钉住的关键常量与工具 */
export const MG_CONSTS = {
  minCell: MIN_CELL,
  longPress: LONG_PRESS_MS,
  flip: flipMs(false),
  bloom: bloomStepMs(false),
  ripple: RIPPLE_STEP_MS,
  bloomFrame: BLOOM_FRAME_MS,
  presets: PRESETS,
  hintColors: HINT_COLORS
};
