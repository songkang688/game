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
import { rectBottom, stageClipBottom } from "../stageFit";
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
import { KIT_PALETTE, makeCollectBurst } from "../../art/kit";
import {
  contrailSVG,
  dieSVG,
  grassSVG,
  hangarSVG,
  headingDeg,
  parachuteSVG,
  planeSVG,
  rankStripHTML,
  seatProgressHTML,
  stackMarkSVG,
  towerSVG,
  cloudSVG,
  type PlanePose
} from "./art";
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
/** 被撞飞机「打转」的时长（随后降落伞返航） */
export const SHOT_MS = 500;
/** 基地伞花绽放的时长（放完就把节点收干净） */
export const CHUTE_MS = 420;
/** 起飞拉烟尾迹的时长 */
export const TRAIL_MS = 400;
/** 掷出 6 的金边闪光 / 攻击方金边的时长 */
export const FLASH_MS = 620;
/** 终局塔台烟花总时长（3 波星星粒子，播完才交结算） */
export const FIREWORK_MS = 1400;

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
.fc-seat-head{display:flex;align-items:center;gap:4px;min-width:0;}
.fc-seat-ava{width:22px;height:22px;flex:0 0 auto;}
.fc-seat-ava svg{width:100%;height:100%;display:block;}
.fc-slots{display:inline-flex;gap:3px;vertical-align:middle;}
.fc-slot{width:9px;height:9px;border-radius:50%;background:#fff;display:inline-block;
  box-shadow:inset 0 0 0 1.5px rgba(120,160,200,.55);}
.fc-slot-on{box-shadow:none;}
.fc-boardwrap{position:relative;width:100%;max-width:440px;margin:0 auto;}
.fc-board{position:relative;width:100%;aspect-ratio:1;background:linear-gradient(180deg,#EAF7E3,#D8EFD0);
  border-radius:14px;overflow:hidden;box-shadow:inset 0 0 0 2px #CBE6C0;}
.fc-ground{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.fc-base{position:absolute;border-radius:12px;}
.fc-base svg{width:100%;height:100%;display:block;}
.fc-cell{position:absolute;box-sizing:border-box;border-radius:22%;background:#FFFFFF;
  box-shadow:inset 0 0 0 1px rgba(120,160,200,.28);}
.fc-cell-own{box-shadow:inset 0 0 0 1px rgba(255,255,255,.9);}
.fc-cell-start{box-shadow:inset 0 0 0 2px #6FB3E0;}
.fc-cell-home{border-radius:26%;}
.fc-pad{position:absolute;display:flex;align-items:center;justify-content:center;font-size:var(--mt-control,14px);}
.fc-pad svg{width:100%;height:100%;display:block;}
.fc-line{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.fc-decor{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.fc-token{position:absolute;display:flex;align-items:center;justify-content:center;border:none;padding:0;margin:0;
  background:transparent;font-family:inherit;font-size:inherit;line-height:1;cursor:pointer;z-index:5;
  transition:left ${HOP_MS}ms linear,top ${HOP_MS}ms linear;}
.fc-token-shadow{position:absolute;left:22%;top:64%;width:56%;height:22%;border-radius:50%;
  background:rgba(70,110,80,.3);transition:transform .3s ease,opacity .3s ease;}
.fc-shadow-off{transform:scale(.55);opacity:.45;}
.fc-token-face{position:absolute;inset:2%;display:flex;align-items:center;justify-content:center;
  font-size:clamp(14px,2.6vw,17px);}
.fc-token-rot{position:absolute;inset:0;transition:transform ${HOP_MS}ms linear;}
.fc-plane{width:100%;height:100%;display:block;}
.fc-token-pick{outline:3px solid #2E80BC;outline-offset:1px;border-radius:50%;animation:fcpulse 1.2s ease infinite;}
.fc-token-can .fc-token-face{filter:drop-shadow(0 0 2px rgba(255,255,255,.95)) drop-shadow(0 3px 5px rgba(46,128,188,.5));}
/* 360px 屏上一格才 24px 见方，给能点的飞机垫一圈看不见的手指热区 */
.fc-token-can::before{content:"";position:absolute;left:50%;top:50%;width:44px;height:44px;
  transform:translate(-50%,-50%);border-radius:50%;}
.fc-token:disabled{pointer-events:none;}
.fc-token-arc{transition:left ${ARC_MS}ms cubic-bezier(.3,-0.4,.5,1.4),top ${ARC_MS}ms cubic-bezier(.3,1.4,.6,1);}
.fc-stackwrap{position:absolute;right:-9%;bottom:-9%;width:46%;height:46%;pointer-events:none;z-index:2;}
.fc-stackwrap svg{width:100%;height:100%;display:block;}
.fc-stackwrap[hidden]{display:none;}
@keyframes fcpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
/* 逐格小跳:上抛 4px。两个名字轮流用,同一架连跳时动画才会重新触发 */
.fc-hop-a{animation:fchopa ${HOP_MS}ms ease;}
.fc-hop-b{animation:fchopb ${HOP_MS}ms ease;}
@keyframes fchopa{50%{transform:translateY(-4px)}}
@keyframes fchopb{50%{transform:translateY(-4px)}}
/* 走子中的螺旋桨提转速(transform-box 让 SVG 内的组绕自己转) */
.fc-token-move .fc-prop{animation:fcprop .24s linear infinite;transform-box:fill-box;transform-origin:center;}
@keyframes fcprop{to{transform:rotate(360deg)}}
/* 起飞:弧线爬升 + 放大一拍 */
.fc-token-rise{animation:fcrise ${ARC_MS}ms ease;}
@keyframes fcrise{40%{transform:translateY(-18%) scale(1.15)}}
.fc-trail{position:absolute;inset:0;pointer-events:none;animation:fctrail ${TRAIL_MS}ms ease-out forwards;}
.fc-trail svg{width:100%;height:100%;display:block;}
@keyframes fctrail{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(55%)}}
/* 跳格/航线:飞机拉高、影子留在地面缩小 —— 低成本 2.5D 高度感 */
.fc-token-lift{transform:translateY(-16%) scale(1.12);transition:transform ${ARC_MS}ms ease;}
/* 击落:打转 720° 缩小(降落伞安全返航,无爆炸) */
.fc-token-shot{animation:fcshot ${SHOT_MS}ms ease-in forwards;}
@keyframes fcshot{to{transform:rotate(720deg) scale(.4)}}
.fc-chute{position:absolute;left:14%;top:-52%;width:72%;height:72%;pointer-events:none;}
.fc-chute svg{width:100%;height:100%;display:block;}
.fc-chute-bloom{animation:fcbloom ${CHUTE_MS}ms ease-out forwards;}
@keyframes fcbloom{from{transform:scale(.85);opacity:1}to{transform:scale(1.3);opacity:0}}
/* 攻击方机身闪金边 */
.fc-token-gold{filter:drop-shadow(0 0 5px ${KIT_PALETTE.starGold}) drop-shadow(0 0 2px rgba(255,255,255,.9));}
.fc-fireworks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8;}
.fc-hud{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;margin:8px 0 6px;}
/* 宽高要定死:骰面 SVG 没写 width/height,收缩盒里 76% 会循环解析回 300×150 固有值,盒子被撑成海报大 */
.fc-dice{width:56px;height:56px;flex:0 0 auto;border-radius:16px;background:#fff;box-shadow:0 3px 8px rgba(120,160,200,.35);
  display:flex;align-items:center;justify-content:center;font-size:34px;line-height:1;color:#2f6b96;}
.fc-dice .fc-die{width:76%;height:auto;display:block;}
.fc-dice-spin{animation:fcroll .32s linear infinite;}
@keyframes fcroll{0%{transform:rotate(0)}25%{transform:rotate(-13deg)}75%{transform:rotate(13deg)}100%{transform:rotate(0)}}
.fc-dice-six{animation:fcsix ${FLASH_MS}ms ease;}
@keyframes fcsix{30%{box-shadow:0 0 0 4px ${KIT_PALETTE.starGold},0 3px 8px rgba(120,160,200,.35);transform:scale(1.08)}}
.fc-btn{min-width:96px;min-height:48px;border:none;border-radius:16px;font-family:inherit;font-size:16px;font-weight:900;
  cursor:pointer;background:#BFE3FA;color:#1F5C87;box-shadow:0 3px 0 #8CC4E8;padding:0 14px;}
.fc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #8CC4E8;}
.fc-btn:disabled{opacity:.45;cursor:default;}
.fc-btn-go{background:#FFC7DC;color:#8E2B54;box-shadow:0 3px 0 #EFA1C0;}
.fc-btn-go:active{box-shadow:0 1px 0 #EFA1C0;}
.fc-btn-sm{min-width:64px;min-height:44px;font-size:14px;padding:0 10px;}
/* r5 N-2:掷骰+选棋是每回合必点,矮横屏盘面比屏高时贴底常驻,不许折叠线下 */
.fc-actions{position:sticky;bottom:0;z-index:6;background:rgba(240,248,255,.92);border-radius:14px;}
.fc-picker{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:4px 0;}
.fc-pick{min-width:66px;min-height:44px;border:none;border-radius:14px;font-family:inherit;font-size:14px;font-weight:800;
  cursor:pointer;background:#fff;color:#37627f;box-shadow:0 2px 6px rgba(120,160,200,.3);padding:0 8px;line-height:1.3;
  display:inline-flex;align-items:center;justify-content:center;gap:4px;}
.fc-pick-thumb{width:18px;height:18px;flex:0 0 auto;}
.fc-pick-thumb svg{width:100%;height:100%;display:block;}
.fc-pick-on{outline:3px solid #2E80BC;}
.fc-pick:disabled{opacity:.4;cursor:default;}
.fc-ranks{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:8px 0 12px;}
.fc-rank{display:flex;flex-direction:column;align-items:center;gap:2px;}
.fc-rank-no{color:#5b6f80;}
.fc-rank-plane{width:32px;height:32px;}
.fc-rank-plane svg{width:100%;height:100%;display:block;}
.fc-rank-star{width:16px;height:16px;}
.fc-msg{text-align:center;min-height:2.8em;color:#3a5a72;font-weight:800;margin-top:6px;font-size:16px;
  line-height:1.5;overflow-wrap:anywhere;}
.fc-goal{text-align:center;font-size:16px;font-weight:800;color:#2f6b96;line-height:1.5;margin-bottom:6px;
  overflow-wrap:anywhere;}
.fc-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.fc-modebar[hidden]{display:none;}
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
  .fc-dice{width:48px;height:48px;font-size:28px;}
}
/* r5 N-2:矮横屏竖排装不下(盘 440 + 座位 + 骰行 > 412),改「盘左控件右」双栏,
   闯关壳(.l99-stage)overflow:hidden 粘不住 sticky,只能靠一屏全装下 */
@media (min-width:700px) and (max-height:520px){
  .fc-wrap{display:grid;grid-template-columns:minmax(0,11fr) minmax(0,13fr);gap:2px 10px;
    align-items:start;align-content:start;padding:8px;}
  .fc-top,.fc-goal{grid-column:1 / -1;margin-bottom:2px;}
  .fc-goal{font-size:16px;}
  .fc-boardwrap{grid-column:1;grid-row:3 / span 5;align-self:center;}
  .fc-seats,.fc-actions,.fc-msg{grid-column:2;}
  .fc-seats{margin-bottom:2px;}
  .fc-seat{flex:1 1 45%;padding:3px 6px;font-size:16px;}
  .fc-seat-tier{font-size:16px;}
  .fc-hud{margin:4px 0 2px;}
  .fc-dice{width:46px;height:46px;}
  .fc-btn{min-height:44px;}
  .fc-msg{min-height:1.6em;font-size:16px;margin-top:2px;}
  .fc-keys{display:none;}
}
@media (prefers-reduced-motion:reduce){
  .fc-token,.fc-token-arc{transition:none;}
  .fc-token-pick{animation:none;}
  .fc-dice-spin{animation:none;}
  .fc-hop-a,.fc-hop-b,.fc-token-rise,.fc-token-shot,.fc-dice-six,.fc-trail,.fc-chute-bloom{animation:none;}
  .fc-token-move .fc-prop{animation:none;}
  .fc-token-rot,.fc-token-face,.fc-token-shadow,.fc-token-lift{transition:none;}
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

/** 草地底图:十字淡跑道 + 虚线中线 + 四片草影(viewBox 是 GRID×GRID) */
export function groundArt(): string {
  let grassPatches = "";
  for (const [gx, gy] of [
    [3, 3],
    [12, 3],
    [12, 12],
    [3, 12]
  ]) {
    grassPatches += `<ellipse cx="${gx}" cy="${gy}" rx="2.6" ry="1.9" fill="#C4E6B6" opacity=".55"/>`;
  }
  return (
    grassPatches +
    `<rect x="0.2" y="6.35" width="14.6" height="2.3" rx="1.15" fill="#FFFFFF" opacity=".3"/>` +
    `<rect x="6.35" y="0.2" width="2.3" height="14.6" rx="1.15" fill="#FFFFFF" opacity=".3"/>` +
    `<path d="M 0.6 7.5 H 14.4" stroke="#FFFFFF" stroke-width=".14" stroke-dasharray=".55 .5" opacity=".55"/>` +
    `<path d="M 7.5 0.6 V 14.4" stroke="#FFFFFF" stroke-width=".14" stroke-dasharray=".55 .5" opacity=".55"/>`
  );
}

/**
 * 盖在格子上的一层(viewBox 是 GRID×GRID):
 * - 外环每 3 格一枚该格归属色的行进小箭头(按当前格 → 下一格的向量转角);
 * - 四条云朵航线:起点格一朵云 + 虚线弧线飞向对角(替代旧的直虚线)。
 */
export function overlayArt(): string {
  let out = "";
  for (let ring = 0; ring < RING_LEN; ring += 3) {
    const a = RING_XY[ring];
    const b = RING_XY[(ring + 1) % RING_LEN];
    const cx = a.x + 0.5;
    const cy = a.y + 0.5;
    const deg = Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
    out +=
      `<polygon points="${cx - 0.16},${cy - 0.19} ${cx + 0.27},${cy} ${cx - 0.16},${cy + 0.19} ${cx - 0.05},${cy}"` +
      ` fill="${COLOR_INFO[ringColor(ring)].ink}" opacity=".8" transform="rotate(${deg} ${cx} ${cy})"/>`;
  }
  for (const c of COLORS) {
    const from = cellXY(c, 16);
    const to = cellXY(c, 28);
    const fx = from.x + 0.5;
    const fy = from.y + 0.5;
    const tx = to.x + 0.5;
    const ty = to.y + 0.5;
    // 控制点往棋盘中心拉,虚线弧线才有「绕过塔台飞对角」的味道
    const mx = (fx + tx) / 2 + (7.5 - (fx + tx) / 2) * 0.55;
    const my = (fy + ty) / 2 + (7.5 - (fy + ty) / 2) * 0.55;
    out +=
      `<path d="M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}" fill="none" stroke="${COLOR_INFO[c].ink}"` +
      ` stroke-width="0.16" stroke-dasharray="0.42 0.38" stroke-linecap="round" opacity=".65"/>` +
      `<g transform="translate(${fx} ${fy - 0.06}) scale(0.1)">${cloudSVG()}</g>` +
      `<g transform="translate(${tx} ${ty}) scale(0.07)">${cloudSVG()}</g>`;
  }
  return out;
}

/**
 * 静态盘面装饰层(1.3 r1 · learner P3):四角机库内沿各 1 簇草地 +
 * 中央塔台垫两侧 2 朵云(远小近大)。总计 6 件、全部静态低饱和,
 * 位置只落在基地内角与塔台垫对角(全盘唯一不压 `.fc-cell` 与航线弧的空位);
 * 整层 `aria-hidden` + `pointer-events:none`,零动画,reduced-motion 无涉。
 */
export function decorArt(): string {
  // 四角基地的内角落(基地 6×6,内角在 5.1 / 9.9;格子从 6 或到 6 为止,不相交)
  const grassSpots: Array<[number, number, Color]> = [
    [5.1, 5.1, 0],
    [9.9, 5.1, 1],
    [9.9, 9.9, 2],
    [5.1, 9.9, 3]
  ];
  let out = "";
  for (const [x, y, c] of grassSpots) {
    out += `<g class="fc-decor-grass" opacity=".35" transform="translate(${x} ${y}) scale(0.055)">${grassSVG(
      COLOR_INFO[c].soft
    )}</g>`;
  }
  // 塔台垫(6–9 × 6–9)的两个对角口袋,在塔台圆(r≈1.35)之外;远小近大
  return (
    out +
    `<g class="fc-decor-cloud" opacity=".8" transform="translate(6.45 6.45) scale(0.045)">${cloudSVG()}</g>` +
    `<g class="fc-decor-cloud" opacity=".8" transform="translate(8.55 8.55) scale(0.06)">${cloudSVG()}</g>`
  );
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

  const svgNS = "http://www.w3.org/2000/svg";

  // 草地底上的四条淡跑道纹(十字交汇于中央塔台)
  const ground = document.createElementNS(svgNS, "svg");
  ground.setAttribute("class", "fc-ground");
  ground.setAttribute("viewBox", `0 0 ${GRID} ${GRID}`);
  ground.setAttribute("aria-hidden", "true");
  ground.innerHTML = groundArt();
  board.appendChild(ground);

  // 四角机库(色块圆角区 + 机库门弧线 + 停机坪 4 个圆位)
  for (const c of COLORS) {
    const rect = baseRect(c);
    const el = document.createElement("div");
    el.className = "fc-base";
    el.style.left = `${rect.x * CELL}%`;
    el.style.top = `${rect.y * CELL}%`;
    el.style.width = `${rect.w * CELL}%`;
    el.style.height = `${rect.h * CELL}%`;
    el.style.background = COLOR_INFO[c].soft;
    el.innerHTML = hangarSVG(c);
    board.appendChild(el);
  }

  // 静态装饰层(草地簇 ×4 + 塔台旁云 ×2):盖在基地色块之上、格子与棋子之下
  const decor = document.createElementNS(svgNS, "svg");
  decor.setAttribute("class", "fc-decor");
  decor.setAttribute("viewBox", `0 0 ${GRID} ${GRID}`);
  decor.setAttribute("aria-hidden", "true");
  decor.innerHTML = decorArt();
  board.appendChild(decor);

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

  // 中央塔台:四色风车跑道汇聚 + 大星星塔台(替代旧的 🌈 emoji 占位)
  const pad = document.createElement("div");
  pad.className = "fc-pad";
  pad.style.left = `${6 * CELL}%`;
  pad.style.top = `${6 * CELL}%`;
  pad.style.width = `${3 * CELL}%`;
  pad.style.height = `${3 * CELL}%`;
  pad.innerHTML = towerSVG();
  board.appendChild(pad);

  // 盖在格子上的一层:行进方向小箭头(每 3 格一枚)+ 云朵航线弧
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "fc-line");
  svg.setAttribute("viewBox", `0 0 ${GRID} ${GRID}`);
  svg.innerHTML = overlayArt();
  board.appendChild(svg);

  // 棋子:影子(2.5D 高度感用) + 旋转层(机头朝向) + SVG 小飞机 + ×2 迭子徽章。
  // emoji 不再上棋盘,只留在 aria-label(describePos)与座位卡文案里。
  const tokens = new Map<string, HTMLButtonElement>();
  const faces = new Map<string, HTMLElement>();
  const rots = new Map<string, HTMLElement>();
  const shadows = new Map<string, HTMLElement>();
  const marks = new Map<string, HTMLElement>();
  const poses = new Map<string, PlanePose>();
  for (const c of order) {
    for (let i = 0; i < PLANES_PER_COLOR; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fc-token";
      btn.style.width = `${CELL}%`;
      btn.style.height = `${CELL}%`;
      const shadow = document.createElement("span");
      shadow.className = "fc-token-shadow";
      shadow.setAttribute("aria-hidden", "true");
      const face = document.createElement("span");
      face.className = "fc-token-face";
      face.setAttribute("aria-hidden", "true");
      const rot = document.createElement("span");
      rot.className = "fc-token-rot";
      rot.innerHTML = planeSVG(c, "park");
      face.appendChild(rot);
      const mark = document.createElement("span");
      mark.className = "fc-stackwrap";
      mark.setAttribute("aria-hidden", "true");
      mark.hidden = true;
      mark.innerHTML = stackMarkSVG(c);
      btn.append(shadow, face, mark);
      btn.addEventListener("click", () => onTokenTap(c, i));
      board.appendChild(btn);
      const k = key(c, i);
      tokens.set(k, btn);
      faces.set(k, face);
      rots.set(k, rot);
      shadows.set(k, shadow);
      marks.set(k, mark);
      poses.set(k, "park");
    }
  }

  const hud = document.createElement("div");
  hud.className = "fc-hud";
  const diceBox = document.createElement("div");
  diceBox.className = "fc-dice";
  diceBox.innerHTML = dieSVG(6);
  diceBox.setAttribute("role", "status");
  diceBox.setAttribute("aria-label", "骰子");
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

  // 掷骰行 + 选棋行合抱成一条 sticky 操作条:矮屏上盘面再高,这两排也贴底常驻
  const actions = document.createElement("div");
  actions.className = "fc-actions";
  actions.append(hud, picker);

  wrap.append(top, goalBar, seatRow, boardWrap, actions, msg, keys);
  host.appendChild(wrap);

  /* r5 N-2 配方 B:盘面(正方形)按舞台可视余量收宽,骰行/选棋/战报全家当装进一屏。
     「下方家当」量 wrap 下沿减盘下沿:竖排时是骰行+选棋+战报,矮横屏双栏时右列自理、差值≈0。
     量不到(单测桩)一个样式不写;缩到 220px 以下宁可交给舞台滚动。 */
  function fitBoard(): void {
    if (typeof boardWrap.getBoundingClientRect !== "function" || typeof wrap.getBoundingClientRect !== "function")
      return;
    boardWrap.style.maxWidth = "";
    const clip = stageClipBottom(wrap);
    if (!Number.isFinite(clip)) return;
    const b = boardWrap.getBoundingClientRect();
    if (!Number.isFinite(b.top) || !(b.height > 0)) return;
    const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(b));
    const room = clip - b.top - below - 8;
    if (!Number.isFinite(room) || b.height <= room + 1) return;
    boardWrap.style.maxWidth = `${Math.max(220, Math.floor(room))}px`;
  }
  fitBoard();
  after(0, fitBoard);
  const hasResize = typeof window !== "undefined" && typeof window.addEventListener === "function";
  if (hasResize) window.addEventListener("resize", fitBoard);

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

  /** 同格迭子里排第几(0 是底、1 是错位 45° 叠上去的那架) */
  function stackRank(color: Color, idx: number, p: number): number {
    if (p < 0 || p >= RING_LEN) return 0;
    let n = 0;
    for (let i = 0; i < idx; i++) if (state.planes[color][i] === p) n++;
    return n;
  }

  /** innerHTML 只在内容真变了才重赋,走子动画每帧 render 不重建 SVG */
  const seatHtmlCache = new Map<Color, string>();
  const pickHtmlCache: string[] = [];

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
      const html =
        `<div class="fc-seat-head"><span class="fc-seat-ava">${planeSVG(seat.color, "park")}</span>` +
        `<span>${who.token} ${who.name}</span></div>` +
        `<div class="fc-seat-tier">${label} · ${seatProgressHTML(homeCount(state, seat.color), seat.color)}</div>`;
      if (seatHtmlCache.get(seat.color) !== html) {
        seatHtmlCache.set(seat.color, html);
        el.innerHTML = html;
      }
    }

    for (const c of order) {
      for (let i = 0; i < PLANES_PER_COLOR; i++) {
        const k = key(c, i);
        const btn = tokens.get(k);
        if (!btn) continue;
        const p = visual.get(k) ?? BASE;
        const pos = pctOf(tokenXY(c, p, i));
        btn.style.left = `${pos.left - CELL / 2}%`;
        btn.style.top = `${pos.top - CELL / 2}%`;
        // 姿态:基地停机 / 环线与通道飞行 / 终点着陆收翼戴花环
        const pose: PlanePose = p === BASE ? "park" : p >= GOAL ? "land" : "fly";
        const rot = rots.get(k);
        if (rot && poses.get(k) !== pose) {
          poses.set(k, pose);
          rot.innerHTML = planeSVG(c, pose);
        }
        const statP = state.planes[c][i];
        const stacked = stackedAt(c, statP);
        const rank = stackRank(c, i, statP);
        if (rot) {
          const deg = headingDeg(c, p);
          rot.style.transform =
            stacked && rank > 0 ? `translate(9%,-9%) rotate(${deg + 45}deg)` : `rotate(${deg}deg)`;
        }
        const mark = marks.get(k);
        if (mark) mark.hidden = !(stacked && rank === 0);
        const movable =
          phase === "choosing" && c === cur && moves.some((m) => m.plane.idx === i && m.plane.color === c);
        btn.classList.toggle("fc-token-can", movable);
        btn.classList.toggle("fc-token-pick", movable && moves[picked]?.plane.idx === i);
        btn.classList.toggle("fc-token-stack", stacked);
        btn.style.zIndex = String(movable ? 8 : p === GOAL ? 7 : 5);
        btn.setAttribute("aria-label", describePos(c, statP));
        btn.disabled = !movable;
      }
    }

    pickBtns.forEach((btn, i) => {
      const m = moves.find((x) => x.plane.idx === i);
      const on = phase === "choosing" && Boolean(m);
      btn.disabled = !on;
      btn.classList.toggle("fc-pick-on", on && moves[picked]?.plane.idx === i);
      const html =
        `<span class="fc-pick-thumb">${planeSVG(cur, "fly")}</span>` +
        `<span>第 ${i + 1} 架${on ? " ▶" : ""}</span>`;
      if (pickHtmlCache[i] !== html) {
        pickHtmlCache[i] = html;
        btn.innerHTML = html;
      }
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
    // 电脑的骰子也要转，只是少转几圈——绝不直接跳出数字。
    // 帧序列节奏不变，每帧换一面立体骰的点数(微旋转交给 .fc-dice-spin)。
    const frames = spinFrames(opts.seed, rolls, reduced || !humanTurn());
    let f = 0;
    diceBox.classList.add("fc-dice-spin");
    const tick = (): void => {
      if (f < frames.length - 1) {
        diceBox.innerHTML = dieSVG(frames[f]);
        f++;
        after(SPIN_MS, tick);
        return;
      }
      diceBox.classList.remove("fc-dice-spin");
      // 掷出 6 金边闪一次(对应「再掷一次」规则);reduced 时金边只亮不闪
      diceBox.innerHTML = dieSVG(value, value === 6);
      diceBox.setAttribute("data-value", String(value));
      diceBox.setAttribute("aria-label", `骰子掷出 ${value} 点`);
      if (value === 6 && !reduced) {
        diceBox.classList.add("fc-dice-six");
        after(FLASH_MS, () => diceBox.classList.remove("fc-dice-six"));
      }
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
    const face = faces.get(tokenKey);
    const shadow = shadows.get(tokenKey);
    const takeoff = move.kind === "takeOff";
    // 走子全程螺旋桨提转速;reduced 一律不加动画类,退回直线滑
    if (!reduced) face?.classList.add("fc-token-move");
    if (takeoff && !reduced && btn) {
      // 起飞:弧线爬升 + 两条尾迹白线 0.4s,放完就收
      face?.classList.add("fc-token-rise");
      const trail = document.createElement("span");
      trail.className = "fc-trail";
      trail.setAttribute("aria-hidden", "true");
      trail.innerHTML = contrailSVG();
      btn.appendChild(trail);
      after(TRAIL_MS, () => {
        trail.remove();
        face?.classList.remove("fc-token-rise");
      });
    }
    let i = 0;
    let hopFlip = false;
    const stepOnce = (): void => {
      if (destroyed) return;
      if (i >= hops.length) {
        btn?.classList.remove("fc-token-arc");
        face?.classList.remove("fc-token-move", "fc-token-lift", "fc-hop-a", "fc-hop-b");
        shadow?.classList.remove("fc-shadow-off");
        flyBackCaptured(move, res, done);
        return;
      }
      const prev = i === 0 ? res.from : hops[i - 1];
      const target = hops[i];
      const leap = Math.abs(target - prev) > 1;
      if (btn) btn.classList.toggle("fc-token-arc", leap && !reduced);
      if (!reduced && face) {
        if (leap) {
          // 跳格/航线:飞机拉高、影子留在地面缩小(落地时影子合并)
          face.classList.remove("fc-hop-a", "fc-hop-b");
          face.classList.add("fc-token-lift");
          shadow?.classList.add("fc-shadow-off");
        } else {
          face.classList.remove("fc-token-lift");
          shadow?.classList.remove("fc-shadow-off");
          if (!takeoff) {
            // 逐格小跳:a/b 两个类轮流用,连跳时动画每格都重新触发
            face.classList.remove(hopFlip ? "fc-hop-b" : "fc-hop-a");
            face.classList.add(hopFlip ? "fc-hop-a" : "fc-hop-b");
            hopFlip = !hopFlip;
          }
        }
      }
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
    // 撞回对方:攻击方机身闪金边(自己撞上堡垒一起回家就不闪了)
    if (res.captured.length > 0 && !res.selfBack && !reduced) {
      const hero = faces.get(key(move.plane.color, move.plane.idx));
      hero?.classList.add("fc-token-gold");
      after(FLASH_MS, () => hero?.classList.remove("fc-token-gold"));
    }
    // 绕回基地也走一段弧线，不许瞬间闪回去;非 reduced 时打开降落伞安全返航
    const sendHome = (): void => {
      const chutes: HTMLElement[] = [];
      for (const foe of back) {
        const k = key(foe.color, foe.idx);
        const btn = tokens.get(k);
        btn?.classList.add("fc-token-arc");
        if (!reduced && btn) {
          const chute = document.createElement("span");
          chute.className = "fc-chute";
          chute.setAttribute("aria-hidden", "true");
          chute.innerHTML = parachuteSVG(foe.color);
          btn.appendChild(chute);
          chutes.push(chute);
        }
        visual.set(k, BASE);
      }
      render();
      after(reduced ? 80 : ARC_MS, () => {
        for (const foe of back) tokens.get(key(foe.color, foe.idx))?.classList.remove("fc-token-arc");
        if (chutes.length === 0) {
          done();
          return;
        }
        // 到家后伞花在基地绽放一下,放完把节点收干净
        for (const chute of chutes) chute.classList.add("fc-chute-bloom");
        after(CHUTE_MS, () => {
          for (const chute of chutes) chute.remove();
          done();
        });
      });
    };
    if (reduced) {
      sendHome();
      return;
    }
    // 被撞的飞机先打个转(0.5s),再开伞返航 —— 无爆炸碎片
    for (const foe of back) faces.get(key(foe.color, foe.idx))?.classList.add("fc-token-shot");
    after(SHOT_MS, () => {
      for (const foe of back) faces.get(key(foe.color, foe.idx))?.classList.remove("fc-token-shot");
      sendHome();
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

  /**
   * 终局烟花:中央塔台上空放 3 波 12 粒星星粒子(共享 art kit 的 makeCollectBurst)。
   * 画在盖住棋盘的 canvas 上,播完整个节点移除再交结算;测试桩没有 canvas 2D 时
   * 只走节奏与清理,不画。
   */
  function celebrate(done: () => void): void {
    const canvas = document.createElement("canvas");
    canvas.className = "fc-fireworks";
    const size = board.clientWidth || 440;
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute("aria-hidden", "true");
    board.appendChild(canvas);
    const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    const bursts: ReturnType<typeof makeCollectBurst>[] = [];
    const waveColors = [KIT_PALETTE.starGold, KIT_PALETTE.candyDeep, KIT_PALETTE.gem];
    waveColors.forEach((colorHex, w) => {
      after(w * 260, () => {
        bursts.push(
          makeCollectBurst({
            x: size / 2 + (w - 1) * size * 0.12,
            y: size / 2 - w * size * 0.05,
            count: 12,
            color: colorHex
          })
        );
      });
    });
    let t = 0;
    const tick = (): void => {
      t += 40;
      if (ctx) {
        ctx.clearRect(0, 0, size, size);
        for (const b of bursts) {
          b.step(0.04);
          b.draw(ctx);
        }
      }
      if (t >= FIREWORK_MS) {
        canvas.remove();
        done();
        return;
      }
      after(40, tick);
    };
    after(40, tick);
  }

  function finish(reason: OverResult["reason"], won: boolean): void {
    if (phase === "over") return;
    phase = "over";
    moves = [];
    render();
    const champ = winnerOf(state);
    const humanColors = opts.seats.filter((s) => s.human).map((s) => s.color);
    const humanWon = won && (champ === null || humanColors.includes(champ));
    const emit = (): void =>
      opts.onOver({ winner: champ, ranks: rankOf(state), rolls, state, reason, humanWon });
    // 赢下这一局才放烟花;弱动效直接交结算
    if (won && !reduced) celebrate(emit);
    else emit();
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
      if (hasResize) window.removeEventListener("resize", fitBoard);
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

  function showOver(title: string, sub: string, again: string, ranks?: readonly Color[]): void {
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "fc-over";
    box.innerHTML =
      `<div class="fc-over-t">${title}</div><div class="fc-over-s">${sub}</div>` +
      (ranks && ranks.length > 0 ? rankStripHTML(ranks) : "");
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
          `${overLine(allHome(r.state, 0), mine)}`,
          "🔁 再来一局",
          r.ranks
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
          showOver(
            `连胜 ${streak} 场！`,
            `最高连胜 ${best}。对手会越来越难缠，接着来一局吧。`,
            "▶ 下一局",
            r.ranks
          );
        } else {
          showOver(
            "连胜到这里啦",
            `这一轮连胜 ${streak} 场，最高纪录 ${best}。${overLine(false, homeCount(r.state, 0))}`,
            "🔁 重新开始",
            r.ranks
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
        showOver(
          title,
          `朵朵到家 ${duoHome} 架，星星到家 ${starHome} 架。换个开局顺序再来一次吧。`,
          "🔁 再来一局",
          r.ranks
        );
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
      // 关内把模式入口收起来:手机上这一条要占约 150px,棋盘能整个抬进首屏
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
export const FLIGHT_CONSTS = {
  HOP_MS,
  ARC_MS,
  BEAT_MS,
  SPIN_MS,
  SHOT_MS,
  CHUTE_MS,
  TRAIL_MS,
  FLASH_MS,
  FIREWORK_MS,
  RING_LEN,
  GOAL,
  SIX_STREAK_LIMIT
};

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
