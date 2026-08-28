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
import {
  ALIEN_SPECS,
  ALIEN_TINTS,
  AS_PALETTE,
  HUD_TIMER_MIN_PX,
  UFO_BEAM_MS,
  UFO_ENTER_MS,
  UFO_TOTAL_MS,
  UNCOVER_MS,
  alienPose,
  alienSilhouette,
  cavityGrad,
  ceremonyAt,
  featureParts,
  lightenHex,
  mixHex,
  spotUncover,
  wrongPose,
  wantedCardLayout,
  type AlienPose,
  type AlienSpec,
  type PathCmd,
} from "./visual";
import {
  createMeteor,
  hillPoints,
  makeStars,
  meteorFrame,
  paintHills,
  paintMeteor,
  paintNebula,
  paintStar,
  resetMeteor,
  starAlpha,
  stepMeteor,
  type HillPoint,
  type MeteorState,
  type NightStar,
} from "../../art/kit/nightsky";
import {
  clearSparkles,
  paintSparkles,
  spawnSparkles,
  stepSparkles,
  type SparkleParticle,
} from "../../art/kit/sparklePaper";
import { bodyFontUpliftCss, touchUpliftCss } from "../../art/kit/uiTouch";

/** 两位玩家的光标颜色:朵朵粉、星星蓝 */
const P_COLOR = ["#e8558f", "#3f7fd6"];
const P_NAME = ["朵朵", "星星"];

const CSS = `
.as-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;}
.as-canvas{width:100%;display:block;border-radius:16px;background:#28234d;touch-action:none;cursor:pointer;}
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
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.as-bar[hidden]{display:none;}
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
  background:rgba(255,255,255,.9);border:1px solid #e2d9f6;border-radius:12px;padding:4px 2px;
  box-shadow:0 2px 6px rgba(160,150,190,.22);}
.als-item.als-done{background:#e9fbe8;border-color:#c8ecc6;}
.als-thumb{width:40px;height:40px;display:block;border-radius:10px;}
.als-name{font-size:11px;font-weight:800;color:#5f5280;max-width:54px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;background:#f1ecff;border-radius:6px;padding:0 5px;}
.als-tick{font-size:12px;font-weight:900;color:#3f9a54;line-height:1;}
.als-tools{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center;}
.als-tool{border:none;border-radius:13px;min-width:46px;min-height:44px;padding:4px 10px;font-size:15px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;
  box-shadow:0 3px 0 rgba(140,120,190,.4);}
.als-tool:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.als-tool:disabled{opacity:.5;cursor:default;box-shadow:none;}
.als-tool:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@media (prefers-reduced-motion:reduce){.as-btn:active,.als-tool:active{transform:none;}}
/* C-6(trio-r11):915×412 推理关线索+工具+D-pad 整排掉进舞台线下(crop~608)。
   矮宽横屏双栏——画布左、线索/清单/工具/方向盘右；画布按列宽与视口余高钳。
   r15:root×121 时 sticky 钉在自滚 .game-stage 里仍 675/724。先锁舞台、
   再给 .as-land（JS 按视口挂，不单靠媒体查询）把 D-pad 收进 412。
   找物关同一套壳,竖屏与高屏零变化。判定/seed 不动。 */
@media (max-height:500px) and (min-width:640px){
  .game-stage:has(.as-wrap){overflow-y:hidden;}
  .as-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,36%);
    gap:4px 10px;align-items:stretch;height:100%;max-height:100%;min-height:0;
    overflow:hidden;box-sizing:border-box;}
  .as-wrap>style{grid-column:1/-1;height:0;margin:0;padding:0;border:0;overflow:hidden;}
  .as-wrap>.as-canvas{grid-column:1;grid-row:1/-1;width:100%;max-height:100%;}
  .as-wrap>.as-clues{grid-column:2;max-height:22dvh;overflow:auto;padding:4px 8px;gap:2px;}
  .as-wrap>.als-list{grid-column:2;max-height:44px;}
  .as-wrap>.als-tools{grid-column:2;}
  .as-wrap>.as-pads{grid-column:2;margin:0;align-self:end;}
  .as-wrap>.as-tip{grid-column:2;font-size:12px;line-height:1.25;max-height:2.4em;overflow:hidden;}
}
.as-wrap.as-land{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,36%);
  gap:4px 10px;align-items:stretch;height:100%;max-height:100%;min-height:0;
  overflow:hidden;box-sizing:border-box;}
.as-wrap.as-land>style{grid-column:1/-1;height:0;margin:0;padding:0;border:0;overflow:hidden;}
.as-wrap.as-land>.as-canvas{grid-column:1;grid-row:1/-1;width:100%;max-height:100%;}
.as-wrap.as-land>.as-clues{grid-column:2;max-height:64px;overflow:auto;padding:4px 8px;gap:2px;}
.as-wrap.as-land>.als-list{grid-column:2;max-height:44px;}
.as-wrap.as-land>.als-tools{grid-column:2;}
.as-wrap.as-land>.as-pads{grid-column:2;margin:0;align-self:end;}
.as-wrap.as-land>.as-tip{grid-column:2;font-size:12px;line-height:1.25;max-height:2.4em;overflow:hidden;}
${touchUpliftCss([".as-open", ".as-back"])}
${bodyFontUpliftCss([".as-tip", ".as-pad-t", ".als-name"])}
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

/** 把 visual.ts 吐出来的画法指令描到画布上(M/L/Q 同 SVG,A 圆弧,E 椭圆) */
function tracePath(c2d: CanvasRenderingContext2D, cmds: PathCmd[]): void {
  c2d.beginPath();
  for (const c of cmds) {
    switch (c[0]) {
      case "M":
        c2d.moveTo(c[1], c[2]);
        break;
      case "L":
        c2d.lineTo(c[1], c[2]);
        break;
      case "Q":
        c2d.quadraticCurveTo(c[1], c[2], c[3], c[4]);
        break;
      case "A":
        c2d.moveTo(c[1] + c[3], c[2]);
        c2d.arc(c[1], c[2], c[3], c[4], c[5]);
        break;
      case "E":
        c2d.moveTo(c[1] + c[3], c[2]);
        c2d.ellipse(c[1], c[2], c[3], c[4], 0, 0, Math.PI * 2);
        break;
      case "Z":
        c2d.closePath();
        break;
    }
  }
}

/**
 * 藏身点:1.3 升级成「可掀开的藏身处」——夜景落影 + 左上 45° 受光面 +
 * 一个能藏东西的深色内腔;找到后两瓣掀开、缝里透暖光。
 * open / shakeX 全是画法参数,形状几何与命中判定的圆心半径一个像素不动。
 */
function drawSpotShape(c2d: CanvasRenderingContext2D, s: Spot, i: number, open = 0, shakeX = 0): void {
  const fill = COLOR_HEX[s.color];
  const line = shade(fill, 0.55);
  const r = s.r;
  const up = spotUncover(s, open);
  c2d.save();
  c2d.translate(s.x + shakeX, s.y);
  c2d.rotate(wobble(i + 1) * 0.05);

  // 夜景统一落影(光源左上,影子往右下溜一点)
  c2d.fillStyle = AS_PALETTE.asShadow;
  c2d.beginPath();
  c2d.ellipse(r * 0.14, r * 0.82, r * 0.85, r * 0.22, 0, 0, Math.PI * 2);
  c2d.fill();

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
  // 受光面:左上 45° 一层高光、右下一层暗部,平涂立刻有体积
  const lg = c2d.createLinearGradient(-r, -r, r * 0.9, r * 0.9);
  lg.addColorStop(0, "rgba(255,255,255,.32)");
  lg.addColorStop(0.55, "rgba(255,255,255,0)");
  lg.addColorStop(1, "rgba(30,26,60,.16)");
  c2d.fillStyle = lg;
  c2d.fill(path);
  c2d.stroke(path);

  // 「能藏东西」的内腔:每种藏身点一个更深的开口,掀开(open)时越张越大。
  // 内腔统一走 2 停径向渐变(中心 #3E3A66 → 边缘 -18%),掀开后不再平涂
  const cavity = (cx: number, cy: number, rad: number): void => {
    c2d.fillStyle = cavityGrad(c2d, cx, cy, rad);
  };
  const gapGlow = up.gap > 0.12;
  if (s.kind === "树洞") {
    cavity(0, r * 0.15, r * 0.55);
    c2d.beginPath();
    c2d.ellipse(0, r * 0.15, r * (0.34 + 0.12 * up.gap), r * (0.44 + 0.12 * up.gap), 0, 0, Math.PI * 2);
    c2d.fill();
    // 洞口上缘一圈受光的木纹边
    c2d.strokeStyle = lightenHex(fill, 0.22);
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.ellipse(0, r * 0.15, r * 0.4, r * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
    c2d.stroke();
  } else if (s.kind === "木箱") {
    // 盖缝:找到时盖子抬起,缝里透光
    cavity(0, -r * 0.04, r * 0.9);
    c2d.fillRect(-r * 0.85, -r * 0.12, r * 1.7, r * 0.16);
    if (open > 0) {
      c2d.save();
      c2d.translate(-r * 0.85, -r * 0.12 - up.lift * r);
      c2d.rotate(-up.flapAngle * 0.5);
      c2d.fillStyle = lightenHex(fill, 0.12);
      c2d.strokeStyle = line;
      c2d.lineWidth = 3;
      const lid = new Path2D();
      lid.roundRect(0, -r * 0.58, r * 1.7, r * 0.6, r * 0.14);
      c2d.fill(lid);
      c2d.stroke(lid);
      c2d.restore();
    }
  } else if (s.kind === "花丛") {
    // 三簇叠层:后簇更深,有前后才藏得住
    c2d.fillStyle = shade(fill, 0.68);
    c2d.beginPath();
    c2d.arc(-r * 0.34, -r * 0.12, r * 0.34, 0, Math.PI * 2);
    c2d.arc(r * 0.36, -r * 0.1, r * 0.3, 0, Math.PI * 2);
    c2d.fill();
    cavity(0, r * 0.04, r * 0.4);
    c2d.beginPath();
    c2d.arc(0, r * 0.04, r * (0.26 + 0.1 * up.gap), 0, Math.PI * 2);
    c2d.fill();
  } else if (s.kind === "水缸") {
    // 缸口:一圈深色的「里面」,水光在口沿
    cavity(0, -r * 0.68, r * 0.56);
    c2d.beginPath();
    c2d.ellipse(0, -r * 0.68, r * (0.5 + 0.06 * up.gap), r * 0.16, 0, 0, Math.PI * 2);
    c2d.fill();
    c2d.beginPath();
    c2d.moveTo(-r * 0.55, r * 0.15);
    c2d.quadraticCurveTo(0, -r * 0.1, r * 0.55, r * 0.15);
    c2d.lineWidth = 3;
    c2d.strokeStyle = lightenHex(fill, 0.3);
    c2d.stroke();
  } else if (s.kind === "帐篷") {
    // 门帘:深色门洞,掀开时门帘往边上翻
    cavity(0, r * 0.3, r * 0.75);
    c2d.beginPath();
    c2d.moveTo(0, -r * 0.4);
    c2d.lineTo(r * (0.3 + 0.08 * up.gap), r * 0.7);
    c2d.lineTo(-r * (0.3 + 0.08 * up.gap), r * 0.7);
    c2d.closePath();
    c2d.fill();
    if (open > 0) {
      c2d.save();
      c2d.translate(-r * 0.08, r * 0.7);
      c2d.rotate(-up.flapAngle);
      c2d.fillStyle = lightenHex(fill, 0.18);
      c2d.beginPath();
      c2d.moveTo(0, 0);
      c2d.lineTo(r * 0.06, -r * 1.05);
      c2d.lineTo(r * 0.4, -r * 0.1);
      c2d.closePath();
      c2d.fill();
      c2d.restore();
    }
  } else if (s.kind === "信箱") {
    cavity(0, -r * 0.35, r * 0.55);
    c2d.fillRect(-r * 0.4, -r * 0.45, r * 0.8, r * (0.12 + 0.14 * up.gap));
  } else if (s.kind === "石头") {
    // 影子后的石缝:右下一道能塞进小朋友的缝
    cavity(r * 0.25, r * 0.27, r * 0.5);
    c2d.beginPath();
    c2d.moveTo(r * 0.2, -r * 0.1);
    c2d.lineTo(r * (0.5 + 0.1 * up.gap), r * 0.5);
    c2d.lineTo(r * 0.05, r * 0.42);
    c2d.closePath();
    c2d.fill();
    c2d.fillStyle = lightenHex(fill, 0.28);
    c2d.beginPath();
    c2d.arc(-r * 0.24, -r * 0.34, r * 0.13, 0, Math.PI * 2);
    c2d.fill();
  } else if (s.kind === "云朵") {
    // 云肚子的阴影层:下缘一条软软的暗带
    cavity(0, r * 0.36, r * 0.62);
    c2d.beginPath();
    c2d.ellipse(0, r * (0.36 - 0.08 * up.gap), r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
    c2d.fill();
  }

  // 掀开的缝隙光:里头透出一点暖光,告诉小朋友「这里已经看过了」
  if (gapGlow) {
    c2d.fillStyle = `rgba(255,243,201,${0.3 * up.gap})`;
    c2d.beginPath();
    c2d.ellipse(0, r * 0.1, r * 0.24 * up.gap, r * 0.3 * up.gap, 0, 0, Math.PI * 2);
    c2d.fill();
  }

  // 拨开的两瓣(草丛式藏身处;木箱 / 水缸走上面的掀盖):瓣长不超过 1.1r,不遮邻居
  if (open > 0 && s.kind !== "木箱" && s.kind !== "水缸") {
    for (const d of [-1, 1]) {
      c2d.save();
      c2d.translate(d * r * 0.4, r * 0.24);
      c2d.rotate(d * up.flapAngle);
      c2d.fillStyle = lightenHex(fill, 0.1);
      c2d.strokeStyle = line;
      c2d.lineWidth = 2;
      c2d.beginPath();
      c2d.moveTo(0, r * 0.16);
      c2d.quadraticCurveTo(d * r * 0.52, -r * 0.12, d * r * 0.26, -r * 0.6);
      c2d.quadraticCurveTo(d * r * 0.02, -r * 0.3, 0, r * 0.16);
      c2d.closePath();
      c2d.fill();
      c2d.stroke();
      c2d.restore();
    }
  }
  c2d.restore();
}

/** 眼睛:六款眼型各画各的,眨眼(blink)与瞟眼(eyeShift)全从 pose 来 */
function drawAlienEyes(c2d: CanvasRenderingContext2D, spec: AlienSpec, size: number, pose: AlienPose): void {
  const ink = "#3a3a4a";
  const openK = 1 - pose.blink * 0.85;
  const px = pose.eyeShift * size * 0.06;
  const bead = (ex: number, ey: number, rx: number, ry: number): void => {
    c2d.fillStyle = ink;
    c2d.beginPath();
    c2d.ellipse(ex, ey, rx, Math.max(0.5, ry * openK), 0, 0, Math.PI * 2);
    c2d.fill();
    c2d.fillStyle = "#fff";
    c2d.beginPath();
    c2d.arc(ex + rx * 0.32, ey - ry * 0.32, Math.max(0.4, rx * 0.3), 0, Math.PI * 2);
    c2d.fill();
  };
  switch (spec.eyes) {
    case "cyclops": {
      c2d.fillStyle = "#fff";
      c2d.beginPath();
      c2d.ellipse(0, -size * 0.12, size * 0.26, Math.max(0.5, size * 0.26 * openK), 0, 0, Math.PI * 2);
      c2d.fill();
      c2d.lineWidth = 1.5;
      c2d.stroke();
      c2d.fillStyle = ink;
      c2d.beginPath();
      c2d.ellipse(px * 1.8, -size * 0.12, size * 0.12, Math.max(0.5, size * 0.12 * openK), 0, 0, Math.PI * 2);
      c2d.fill();
      c2d.fillStyle = "#fff";
      c2d.beginPath();
      c2d.arc(px * 1.8 + size * 0.04, -size * 0.16, size * 0.04, 0, Math.PI * 2);
      c2d.fill();
      break;
    }
    case "triple":
      bead(-size * 0.26 + px, -size * 0.2, size * 0.08, size * 0.1);
      bead(px, -size * 0.3, size * 0.09, size * 0.11);
      bead(size * 0.26 + px, -size * 0.2, size * 0.08, size * 0.1);
      break;
    case "droopy":
      // 双眼下垂:往外斜一点,一脸温柔
      for (const d of [-1, 1]) {
        c2d.save();
        c2d.translate(d * size * 0.24 + px, -size * 0.04);
        c2d.rotate(d * 0.4);
        c2d.fillStyle = ink;
        c2d.beginPath();
        c2d.ellipse(0, 0, size * 0.09, Math.max(0.5, size * 0.13 * openK), 0, 0, Math.PI * 2);
        c2d.fill();
        c2d.fillStyle = "#fff";
        c2d.beginPath();
        c2d.arc(size * 0.02, -size * 0.04, size * 0.032, 0, Math.PI * 2);
        c2d.fill();
        c2d.restore();
      }
      break;
    case "beads":
      bead(-size * 0.2 + px, -size * 0.1, size * 0.07, size * 0.07);
      bead(size * 0.2 + px, -size * 0.1, size * 0.07, size * 0.07);
      break;
    case "boxy":
      for (const d of [-1, 1]) {
        c2d.fillStyle = ink;
        const bw = size * 0.17;
        const bh = Math.max(1, size * 0.19 * openK);
        c2d.beginPath();
        c2d.roundRect(d * size * 0.28 - bw / 2 + px, -size * 0.18 - bh / 2, bw, bh, size * 0.04);
        c2d.fill();
        c2d.fillStyle = "#9fe8ff";
        c2d.fillRect(d * size * 0.28 - bw * 0.22 + px, -size * 0.22, bw * 0.3, bh * 0.3);
      }
      break;
    case "starry":
      // 星星眼:四角小星
      for (const d of [-1, 1]) {
        c2d.fillStyle = ink;
        c2d.beginPath();
        const ex = d * size * 0.22 + px;
        const ey = -size * 0.1;
        const ro = size * 0.13;
        const ri = size * 0.05;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? ro : ri;
          if (k === 0) c2d.moveTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
          else c2d.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr);
        }
        c2d.closePath();
        c2d.fill();
        c2d.fillStyle = "#fff";
        c2d.beginPath();
        c2d.arc(ex + size * 0.03, ey - size * 0.03, size * 0.03, 0, Math.PI * 2);
        c2d.fill();
      }
      break;
  }
}

/**
 * 外星小朋友:六只按 ALIEN_SPECS 走剪影级差异(独眼圆胖 / 三眼瘦高 / 大耳光环 /
 * 蘑菇双尾 / 方脑袋天线 / 小翅膀螺旋),三停径向渐变 + 肚皮浅色域 + 1.5px 描边。
 * peek 只露上半身、眼睛左右瞟;waveK 是找到仪式的挥手摆角;reduced 全静止。
 */
function drawAlien(
  c2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tint: number,
  peek: boolean,
  tMs = 0,
  reduced = true,
  waveK = 0
): void {
  const idx = ((tint % 6) + 6) % 6;
  const spec = ALIEN_SPECS[idx];
  const body = ALIEN_TINTS[idx];
  const line = shade(body, 0.5);
  const pose = alienPose(spec, peek, tMs, reduced);
  c2d.save();
  c2d.translate(x, y);
  if (peek) {
    // 探头:只露上半身,下缘按 reveal 裁掉(裁的是画,不是命中区)
    c2d.beginPath();
    c2d.rect(-size * 2.4, -size * 2.4, size * 4.8, size * 2.4 + size * (pose.reveal - 0.3));
    c2d.clip();
  } else {
    c2d.fillStyle = AS_PALETTE.asShadow;
    c2d.beginPath();
    c2d.ellipse(size * 0.1, size * 0.72, size * 0.6, size * 0.16, 0, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.lineWidth = 1.5;
  c2d.lineJoin = "round";
  c2d.lineCap = "round";
  c2d.strokeStyle = line;

  // 特征件:触角 / 光环 / 尾巴 / 天线 / 翅膀,按 idle 摆动(reduced 静止)
  for (const part of featureParts(spec, size)) {
    c2d.save();
    if (part.sway) c2d.rotate(part.kind === "wing" ? pose.wingAngle * 0.22 : pose.antennaSwing * 0.09);
    if (part.kind === "halo") {
      tracePath(c2d, part.cmds);
      c2d.strokeStyle = "#ffe066";
      c2d.lineWidth = 2.4;
      c2d.stroke();
    } else if (part.kind === "spiralWing") {
      tracePath(c2d, part.cmds);
      c2d.lineWidth = 1.8;
      c2d.stroke();
    } else if (part.kind === "wing") {
      tracePath(c2d, part.cmds);
      c2d.fillStyle = lightenHex(body, 0.42);
      c2d.fill();
      c2d.lineWidth = 1.5;
      c2d.stroke();
    } else if (part.kind === "twinTail") {
      tracePath(c2d, part.cmds);
      c2d.lineWidth = Math.max(2.4, size * 0.14);
      c2d.strokeStyle = shade(body, 0.7);
      c2d.stroke();
    } else {
      // 触角 / 天线:杆描线,顶端小球点亮
      tracePath(c2d, part.cmds.filter((c) => c[0] !== "A"));
      c2d.lineWidth = 1.8;
      c2d.strokeStyle = line;
      c2d.stroke();
      tracePath(c2d, part.cmds.filter((c) => c[0] === "A"));
      c2d.fillStyle = "#ffe066";
      c2d.fill();
      c2d.lineWidth = 1.5;
      c2d.stroke();
    }
    c2d.restore();
  }
  c2d.strokeStyle = line;
  c2d.lineWidth = 1.5;

  // 身体:三停径向渐变(顶光 +22% → 主色 → 底部压暗),光源统一左上 45°
  const g = c2d.createRadialGradient(-size * 0.28, -size * 0.36, size * 0.08, 0, 0, size * 1.05);
  g.addColorStop(0, lightenHex(body, 0.22));
  g.addColorStop(0.55, body);
  g.addColorStop(1, shade(body, 0.78));
  tracePath(c2d, alienSilhouette(spec, size));
  c2d.fillStyle = g;
  c2d.fill();
  c2d.stroke();

  // 肚皮浅色域
  c2d.fillStyle = lightenHex(body, 0.4);
  c2d.beginPath();
  c2d.ellipse(0, size * 0.3, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
  c2d.fill();

  drawAlienEyes(c2d, spec, size, pose);

  if (!peek) {
    // 找到之后露出整张笑脸
    c2d.strokeStyle = "#3a3a4a";
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.arc(0, size * 0.16, size * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
    c2d.stroke();
  }
  if (waveK !== 0) {
    // 找到仪式的挥手:小手臂从身侧举起来摆(是打招呼,不是被抓)
    c2d.save();
    c2d.translate(size * 0.5, -size * 0.02);
    c2d.rotate(-0.7 - waveK * 0.35);
    c2d.strokeStyle = line;
    c2d.lineWidth = Math.max(2, size * 0.13);
    c2d.beginPath();
    c2d.moveTo(0, 0);
    c2d.lineTo(size * 0.42, 0);
    c2d.stroke();
    c2d.fillStyle = lightenHex(body, 0.3);
    c2d.beginPath();
    c2d.arc(size * 0.5, 0, size * 0.12, 0, Math.PI * 2);
    c2d.fill();
    c2d.restore();
  }
  c2d.restore();
}

/** 线索物:一颗真的会呼吸发光的小星星贴纸(reduced 恒亮不动) */
function drawTrinket(
  c2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tMs = 0,
  reduced = true
): void {
  const pulse = reduced ? 1 : 1 + 0.07 * Math.sin(tMs / 280);
  const s = size * pulse;
  c2d.save();
  c2d.translate(x, y);
  // 夜里的一圈柔光
  c2d.fillStyle = "rgba(255,243,201,.22)";
  c2d.beginPath();
  c2d.arc(0, 0, s * 1.5, 0, Math.PI * 2);
  c2d.fill();
  const g = c2d.createRadialGradient(-s * 0.25, -s * 0.3, s * 0.1, 0, 0, s * 1.1);
  g.addColorStop(0, "#fff3c9");
  g.addColorStop(0.55, "#ffd75e");
  g.addColorStop(1, "#efb63e");
  c2d.fillStyle = g;
  c2d.strokeStyle = "#c8942a";
  c2d.lineWidth = 2.2;
  c2d.lineJoin = "round";
  c2d.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 === 0 ? s : s * 0.45;
    if (k === 0) c2d.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c2d.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c2d.closePath();
  c2d.fill();
  c2d.stroke();
  c2d.restore();
}

/** 一局的夜空状态:亮星 / 流星 / 两层丘陵,seed 定了就一整局不变 */
interface SkyState {
  stars: NightStar[];
  meteor: MeteorState;
  hillFar: HillPoint[];
  hillNear: HillPoint[];
}

/**
 * 背景:1.3 升级成星空氛围——星云双色径向渐变(揉一点章节色,八章各有色温)、
 * 亮星 12 颗两级缓慢闪烁、流星 8~14s 一条、两层丘陵剪影跟镜头做视差;
 * 章节涂鸦压成夜色里的淡纹理,不跟藏匿点抢眼。reduced:闪烁与漂移全停。
 */
function drawBackdrop(c2d: CanvasRenderingContext2D, chapter: number, t: number, sky: SkyState, viewCx: number, reduced: boolean): void {
  const base = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, chapter))].color;
  // ① 星云渐变底
  paintNebula(
    c2d,
    SCENE_W,
    SCENE_H,
    mixHex(AS_PALETTE.asNebulaB, base, 0.24),
    mixHex(AS_PALETTE.asNebulaA, base, 0.12)
  );
  // ② 亮星与流星
  const tMs = t * 1000;
  for (const st of sky.stars) paintStar(c2d, st, starAlpha(st, tMs, reduced), AS_PALETTE.asStar);
  const mf = meteorFrame(sky.meteor);
  if (mf) paintMeteor(c2d, mf, AS_PALETTE.asStar);
  // ③④ 两层丘陵剪影:远丘跟镜头多挪一点,天就显得远
  const off = viewCx - SCENE_W / 2;
  paintHills(c2d, sky.hillFar, SCENE_H, mixHex(AS_PALETTE.asHillFar, base, 0.16), off * 0.14);
  paintHills(c2d, sky.hillNear, SCENE_H, mixHex(AS_PALETTE.asHillNear, base, 0.1), off * 0.06);

  // 章节涂鸦:调得很淡,只是夜色里的一点纹理
  c2d.save();
  c2d.globalAlpha = 0.16;
  c2d.strokeStyle = "#cfc6f0";
  c2d.fillStyle = "#cfc6f0";
  c2d.lineWidth = 3;
  c2d.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x = 30 + ((i * 173) % (SCENE_W - 60));
    const y = 40 + ((i * 271) % (SCENE_H - 80));
    const s = 12 + ((i * 7) % 10);
    const drift = reduced ? 0 : Math.sin(t * 0.7 + i) * 3;
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

/** 一只圆滚滚的原创小飞碟:薰衣草色碟身 + 透明舱盖 + 一排小灯 */
function drawUfo(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c2d.save();
  // 舱盖
  c2d.fillStyle = "rgba(205,236,255,.8)";
  c2d.beginPath();
  c2d.ellipse(x, y - r * 0.26, r * 0.5, r * 0.44, 0, Math.PI, Math.PI * 2);
  c2d.closePath();
  c2d.fill();
  // 碟身
  const g = c2d.createLinearGradient(x - r, y - r * 0.3, x + r, y + r * 0.3);
  g.addColorStop(0, "#e6def8");
  g.addColorStop(1, "#b7a8e4");
  c2d.fillStyle = g;
  c2d.strokeStyle = "#6f5cae";
  c2d.lineWidth = 2;
  c2d.beginPath();
  c2d.ellipse(x, y, r, r * 0.34, 0, 0, Math.PI * 2);
  c2d.fill();
  c2d.stroke();
  // 一排小灯
  c2d.fillStyle = "#ffe066";
  for (let k = 0; k < 4; k++) {
    c2d.beginPath();
    c2d.arc(x + (k - 1.5) * r * 0.46, y + r * 0.1, r * 0.075, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.restore();
}

/** 找到仪式的覆盖层:UFO 飘入 → 光束锥 → (外星人在藏身点那边挥手上升) */
function drawCeremonyOverlay(
  c2d: CanvasRenderingContext2D,
  fx: { x: number; y: number; r: number; t: number },
  reduced: boolean
): void {
  const f = ceremonyAt(fx.t * 1000, reduced);
  if (f.phase === "done") return;
  if (f.phase === "static") {
    // reduced:静态光圈一帧(挥手那一帧由藏身点上的外星人自己画)
    c2d.strokeStyle = AS_PALETTE.asBeam;
    c2d.lineWidth = 7;
    c2d.beginPath();
    c2d.arc(fx.x, fx.y - fx.r * 0.2, fx.r + 12, 0, Math.PI * 2);
    c2d.stroke();
    return;
  }
  const startX = -140;
  const ux = startX + (fx.x - startX) * f.ufoT;
  const uy = fx.y - fx.r * 2.6 - (1 - f.ufoT) * 70;
  if (f.beamK > 0) {
    // 光束锥:半透明渐变罩住外星人
    const g = c2d.createLinearGradient(0, uy, 0, fx.y + fx.r * 0.3);
    g.addColorStop(0, "rgba(180,230,255,.5)");
    g.addColorStop(1, "rgba(180,230,255,.06)");
    c2d.fillStyle = g;
    c2d.beginPath();
    c2d.moveTo(ux - fx.r * 0.3, uy + fx.r * 0.28);
    c2d.lineTo(ux + fx.r * 0.3, uy + fx.r * 0.28);
    c2d.lineTo(fx.x + fx.r * (0.5 + 0.45 * f.beamK), fx.y + fx.r * 0.3);
    c2d.lineTo(fx.x - fx.r * (0.5 + 0.45 * f.beamK), fx.y + fx.r * 0.3);
    c2d.closePath();
    c2d.fill();
  }
  drawUfo(c2d, ux, uy, fx.r * 0.9);
}

/** 点错时冒出来的小问号云:只是「咦?」一下,不批评 */
function drawQuestionCloud(
  c2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  scale: number
): void {
  c2d.save();
  c2d.globalAlpha = Math.max(0, Math.min(1, alpha));
  c2d.translate(x, y);
  c2d.scale(scale, scale);
  c2d.fillStyle = "rgba(255,255,255,.94)";
  c2d.strokeStyle = "#b9aede";
  c2d.lineWidth = 2;
  c2d.beginPath();
  c2d.arc(-r * 0.28, 0, r * 0.26, 0, Math.PI * 2);
  c2d.arc(0, -r * 0.12, r * 0.32, 0, Math.PI * 2);
  c2d.arc(r * 0.28, 0.02 * r, r * 0.24, 0, Math.PI * 2);
  c2d.fill();
  c2d.stroke();
  // 问号换 2.2px 描边白路径 + 薰衣草落影(B 档第 1 轮建议级,第 2 轮清偿):
  // 钩 = 上半圆弧顺到下垂小竖,点 = 实心小圆;先画偏移的落影再画白芯,
  // 白纸云上白问号靠落影浮起来。文本字形一个不留。
  const qStroke = (dx: number, dy: number, color: string, width: number): void => {
    c2d.strokeStyle = color;
    c2d.lineWidth = width;
    c2d.lineCap = "round";
    c2d.beginPath();
    c2d.arc(dx, dy - r * 0.16, r * 0.14, Math.PI, Math.PI * 2.25);
    c2d.quadraticCurveTo(dx + r * 0.1, dy + r * 0.02, dx, dy + r * 0.04);
    c2d.stroke();
    c2d.beginPath();
    c2d.arc(dx, dy + r * 0.16, r * 0.05, 0, Math.PI * 2);
    c2d.fillStyle = color;
    c2d.fill();
  };
  qStroke(r * 0.035, r * 0.05 - r * 0.06, "rgba(122,104,176,.8)", 3.4);
  qStroke(0, -r * 0.06, "#ffffff", 2.2);
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

  // ---- 纯视觉状态(1.3 视觉升级):夜空 / 掀开 / 点错 / UFO 仪式 / 星屑 ----
  const skySeed = (lv.chapter + 1) * 131 + (lv.index + 2) * 17;
  const sky: SkyState = {
    stars: makeStars(skySeed, SCENE_W, SCENE_H * 0.92),
    meteor: createMeteor(skySeed + 5),
    hillFar: hillPoints(skySeed + 1, SCENE_W, SCENE_H * 0.66, 44, 5),
    hillNear: hillPoints(skySeed + 2, SCENE_W, SCENE_H * 0.78, 34, 6),
  };
  /** 纯视觉时钟(秒):结算后 UFO 仪式还要走完,所以不搭玩法的 clock */
  let vClock = 0;
  let sparkles: SparkleParticle[] = [];
  /** 已点开藏身点的掀开进度(毫秒,封顶 UNCOVER_MS 之后保持张开) */
  const fxOpen = new Map<number, number>();
  let fxWrong: { spot: number; t: number } | null = null;
  let ceremony: { spot: number; x: number; y: number; r: number; t: number; sparkled: boolean } | null = null;

  /** 找到外星朋友:开一场 UFO 仪式(纯视觉覆盖层,不阻塞下一次点击) */
  function startCeremony(i: number): void {
    const s = lv.spots[i];
    if (!s) return;
    ceremony = { spot: i, x: s.x, y: s.y, r: s.r, t: 0, sparkled: false };
  }

  /** 推进纯视觉动效:和 step(玩法)分开,结算后仪式与星屑照样收尾 */
  function stepFx(dt: number): void {
    if (paused) return;
    vClock += dt;
    stepMeteor(sky.meteor, dt * 1000, SCENE_W, SCENE_H, softMotion);
    if (sparkles.length > 0) sparkles = stepSparkles(sparkles, dt * 1000);
    for (const [k, v] of fxOpen) {
      if (v < UNCOVER_MS) fxOpen.set(k, Math.min(UNCOVER_MS, v + dt * 1000));
    }
    if (fxWrong) {
      fxWrong.t += dt;
      if (wrongPose(fxWrong.t * 1000, softMotion).done) fxWrong = null;
    }
    if (ceremony) {
      ceremony.t += dt;
      const tMs = ceremony.t * 1000;
      if (!ceremony.sparkled && !softMotion && tMs >= UFO_ENTER_MS + UFO_BEAM_MS) {
        // 光束罩住的那一刻撒星屑彩纸
        sparkles = sparkles.concat(
          spawnSparkles(skySeed + ceremony.spot, ceremony.x, ceremony.y - ceremony.r, 16)
        );
        ceremony.sparkled = true;
      }
      if (tMs >= UFO_TOTAL_MS) ceremony = null;
    }
  }

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
    const colW = Math.round(canvas.clientWidth || host.clientWidth || wrap.clientWidth || 320);
    cssW = Math.max(240, colW);
    let nextH = Math.round(cssW * (SCENE_H / SCENE_W));
    const vh = (globalThis as { innerHeight?: number }).innerHeight || 0;
    const vw = (globalThis as { innerWidth?: number }).innerWidth || 0;
    // 矮宽横屏:画布跟左栏走,高度再钳一档,右边工具+D-pad 留在 412 里
    if (vh > 0 && vh <= 500 && vw >= 640) {
      wrap.classList.add("as-land");
      const hostH = host.clientHeight || 0;
      const box = Math.max(160, Math.round(Math.min(vh - 96, hostH > 80 ? hostH : vh - 96)));
      wrap.style.maxHeight = `${box}px`;
      wrap.style.overflow = "hidden";
      const cap = Math.max(120, Math.round(Math.min(vh - 148, box)));
      if (nextH > cap) nextH = cap;
    } else {
      wrap.classList.remove("as-land");
      wrap.style.maxHeight = "";
      wrap.style.overflow = "";
    }
    cssH = nextH;
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
        fxOpen.set(i, softMotion ? UNCOVER_MS : 0);
        startCeremony(i);
        opts.sfx("coin");
        settle(true);
      } else {
        crossed.add(i);
        misses++;
        left = Math.max(0, left - penalty);
        fxWrong = { spot: i, t: 0 };
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
      fxWrong = { spot: i, t: 0 };
      opts.sfx("oops");
      say("这里没人躲着,再找找!");
      return;
    }
    found.set(i, player);
    fxOpen.set(i, softMotion ? UNCOVER_MS : 0);
    if (hit.role === "alien") startCeremony(i);
    else if (!softMotion) {
      const s = lv.spots[i];
      sparkles = sparkles.concat(spawnSparkles(skySeed + i, s.x, s.y - s.r * 0.6, 12));
    }
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
    const vMs = vClock * 1000;
    drawBackdrop(c2d, lv.chapter, vClock, sky, view.cx, softMotion);

    lv.spots.forEach((s, i) => {
      const hidden = deduce ? -1 : targets.findIndex((t) => t.spot === i);
      const isFound = found.has(i);
      // 先画躲在后面的小家伙,再画藏身点——只露出一点点脑袋,这就是要「找」的东西
      if (!deduce && hidden >= 0 && !isFound) {
        const t = targets[hidden];
        if (t.role === "alien") drawAlien(c2d, s.x + s.r * 0.34, s.y - s.r * 0.92, s.r * 0.5, i, true, vMs, softMotion);
        else drawTrinket(c2d, s.x - s.r * 0.5, s.y - s.r * 0.9, s.r * 0.26, vMs, softMotion);
      }
      const openK = isFound ? Math.min(1, (fxOpen.get(i) ?? UNCOVER_MS) / UNCOVER_MS) : 0;
      const shakeX = fxWrong && fxWrong.spot === i ? wrongPose(fxWrong.t * 1000, softMotion).shakeX : 0;
      drawSpotShape(c2d, s, i, openK, shakeX);

      if (isFound) {
        const t = hidden >= 0 ? targets[hidden] : null;
        // 仪式进行中:外星人跟着光束挥手上升;仪式结束回到藏身点上站好
        const cf = ceremony && ceremony.spot === i ? ceremonyAt(ceremony.t * 1000, softMotion) : null;
        if (!t || t.role === "alien") {
          const rise = cf ? -cf.riseK * s.r * 1.1 : 0;
          drawAlien(c2d, s.x, s.y - s.r * 0.2 + rise, s.r * 0.62, i, false, vMs, softMotion, cf ? cf.waveK : 0);
        } else drawTrinket(c2d, s.x, s.y - s.r * 0.1, s.r * 0.4, vMs, softMotion);
        c2d.strokeStyle = P_COLOR[found.get(i) ?? 0];
        c2d.lineWidth = 5;
        c2d.beginPath();
        c2d.arc(s.x, s.y, s.r + 7, 0, Math.PI * 2);
        c2d.stroke();
      }
      if (crossed.has(i)) {
        c2d.strokeStyle = "rgba(200,190,225,.8)";
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

    // ---- 反馈层:问号云 / UFO 仪式 / 星屑彩纸(全是覆盖层,不挡点击) ----
    if (fxWrong) {
      const s = lv.spots[fxWrong.spot];
      const wp = wrongPose(fxWrong.t * 1000, softMotion);
      if (s && wp.cloudAlpha > 0) {
        drawQuestionCloud(c2d, s.x, s.y - s.r * 0.95, s.r * 0.9, wp.cloudAlpha, Math.max(0.25, Math.min(1.15, wp.cloudScale)));
      }
    }
    if (ceremony) drawCeremonyOverlay(c2d, ceremony, softMotion);
    if (sparkles.length > 0) paintSparkles(c2d, sparkles);

    // 望远镜圈出来的一片:只框范围,里头有几个藏身点还是要自己认
    if (focus) {
      c2d.strokeStyle = "rgba(120,90,200,.75)";
      c2d.lineWidth = 6;
      c2d.setLineDash([18, 12]);
      c2d.lineDashOffset = softMotion ? 0 : -vClock * 26;
      c2d.strokeRect(focus.left + 6, focus.top + 6, focus.right - focus.left - 12, focus.bottom - focus.top - 12);
      c2d.setLineDash([]);
    }

    for (let p = 0; p < opts.players; p++) {
      const cur = cursors[p];
      c2d.strokeStyle = P_COLOR[p];
      c2d.lineWidth = 5;
      c2d.setLineDash([12, 9]);
      c2d.lineDashOffset = softMotion ? 0 : -vClock * 34;
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

    // ---- 顶栏:横幅卡 + 计时计数卡(卡片化,夜空上更清楚) ----
    c2d.textBaseline = "middle";
    c2d.font = `bold ${Math.max(HUD_TIMER_MIN_PX, Math.round(cssW * 0.038))}px sans-serif`;
    const right =
      opts.players === 2
        ? `${P_NAME[0]} ${scores[0]} : ${scores[1]} ${P_NAME[1]}　⏱ ${formatClock(left)}`
        : `${deduce ? "🔍" : `${found.size}/${need}`}　⏱ ${formatClock(left)}`;
    const rightW = c2d.measureText(right).width + 20;
    const leftW = Math.min(c2d.measureText(opts.banner).width + 20, cssW - rightW - 20);
    c2d.fillStyle = AS_PALETTE.asCard;
    c2d.beginPath();
    c2d.roundRect(6, 6, leftW, 30, 12);
    c2d.roundRect(cssW - 6 - rightW, 6, rightW, 30, 12);
    c2d.fill();
    c2d.fillStyle = "#5f4a90";
    c2d.textAlign = "left";
    c2d.fillText(opts.banner, 16, 21);
    c2d.textAlign = "right";
    c2d.fillText(right, cssW - 16, 21);

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
    stepFx(dt);
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

  /** 清单栏里的一枚「通缉令小卡」:圆角卡 + 别针 + 半身像 + 名字条,全程序化绘制 */
  function drawThumb(target: { role: "alien" | "clue"; spot: number }): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.className = "als-thumb";
    cv.width = 80;
    cv.height = 80;
    const g = cv.getContext("2d");
    if (g) {
      g.scale(2, 2);
      const card = wantedCardLayout(40, 40);
      // 卡底
      g.fillStyle = AS_PALETTE.asCard;
      g.strokeStyle = "#d9d0f2";
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect(1, 1, card.w - 2, card.h - 2, card.radius);
      g.fill();
      g.stroke();
      for (const part of card.parts) {
        if (part === "portrait") {
          // 半身像:名字条以下裁掉
          g.save();
          g.beginPath();
          g.rect(2, 4, card.w - 4, card.nameStrip.y - 4);
          g.clip();
          if (target.role === "alien") {
            drawAlien(g, card.portrait.x, card.portrait.y, card.portrait.size + 3, target.spot, false, 0, true);
          } else {
            drawTrinket(g, card.portrait.x, card.portrait.y - 2, card.portrait.size, 0, true);
          }
          g.restore();
        } else if (part === "nameStrip") {
          g.fillStyle = "#efe7ff";
          g.beginPath();
          g.roundRect(card.nameStrip.x, card.nameStrip.y, card.nameStrip.w, card.nameStrip.h, 3);
          g.fill();
        } else if (part === "pin") {
          g.fillStyle = "#e8558f";
          g.beginPath();
          g.arc(card.pin.x, card.pin.y, card.pin.r, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#ffd3e4";
          g.beginPath();
          g.arc(card.pin.x - card.pin.r * 0.3, card.pin.y - card.pin.r * 0.3, card.pin.r * 0.32, 0, Math.PI * 2);
          g.fill();
        }
      }
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

  syncSize();
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
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
      // 视觉动效清场:流星计时与星屑粒子全部归零
      resetMeteor(sky.meteor);
      clearSparkles(sparkles);
      fxOpen.clear();
      fxWrong = null;
      ceremony = null;
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

export function mount(api: GameApi): { destroy: () => void } {
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
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
