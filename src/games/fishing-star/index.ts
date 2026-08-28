import { meta } from "./meta";
export { meta };

// 钓鱼小达人:岸上抛竿蓄力 + 水下咬钩 + 收杆张力博弈的 2D 侧视钓鱼游戏。
//
// 四个入口共用同一套钓鱼运行时 `createRun`:
//  - 闯关:188 关八大水域,四种目标(钓够条数 / 攒够分数 / 钓够重量 / 钓够种类),走 level99 框架;
//  - 无尽「钓到天黑」:晨 → 昼 → 黄昏 → 夜,鱼群跟着换班,按总重量计分存进平台 endlessBest;
//  - 图鉴:25 种原创鱼四档稀有度,记首次捕获时间与最大尺寸;
//  - 装备:鱼线 / 鱼饵 / 浮标,只用打关攒的星星升级,没有任何货币与内购。
//
// 一竿的节奏:瞄(看风)→ 蓄力(决定甩多远)→ 下沉 → 等咬钩 → 浮标下沉的 0.4 秒反应窗口
// → 张力博弈(红区亮起还有 1.2 秒可以救)→ 上鱼小演出(可放生)。
//
// 全程没有伤害:线断了、鱼跑了都只是这一竿白费,朵朵和星星会接着给你打气。
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import {
  PHASE_INFO,
  endlessLine,
  phaseAt,
  pickFishAtPhase,
  untilNightMs,
  weightRank,
  type DayPhase,
} from "./daylight";
import {
  DEX2_KEY,
  bestSizeText,
  dexEntry,
  dexHas,
  dexStats,
  emptyDex,
  firstCatchText,
  markReleased,
  parseDexBook,
  recordCatch,
  serializeDexBook,
  type DexBook,
} from "./dex";
import {
  GEAR,
  GEAR_KEY,
  GEAR_KINDS,
  MAX_GEAR_LEVEL,
  assertGearCaps,
  emptyGear,
  gearBonus,
  gearSummary,
  nextCost,
  parseGear,
  serializeGear,
  upgrade,
  type GearBonus,
  type GearSet,
} from "./gear";
import {
  createClipWatch,
  needsImmediateRefit,
  resetClippedScroll,
  seaHeightPx,
  showAct,
  wrapCapPx,
} from "./fit";
import { createLedger } from "./runtime";
import {
  BAND_LUCK,
  CHAPTERS,
  bandText,
  buildLevel,
  emptyLog,
  goalMet,
  goalText,
  goalValue,
  levelRandom,
  loseLine,
  progressText,
  rateLevel,
  type CatchLog,
  type FishingLevel,
} from "./levels";
import {
  CHARGE_CYCLE_MS,
  DEX_KEY,
  ENDLESS_MS,
  FISH,
  GOOD_AT,
  LAYERS,
  MAX_CAST_M,
  MAX_DEPTH,
  PATTERN_INFO,
  RARITY_TIERS,
  RED_AT,
  SNAP_AT,
  TIGHT_AT,
  bandMark,
  bandTip,
  baseLengthCm,
  biteDelayMs,
  castDistance,
  catchScore,
  chargePower,
  clamp,
  comboMultiplier,
  depthAtDistance,
  depthLabel,
  distanceLuck,
  fightParams,
  formatClock,
  formatLength,
  formatWeight,
  inBand,
  isActionKey,
  isPauseKey,
  isPerfectCatch,
  newFight,
  patternOf,
  pickFish,
  rarityStars,
  redRatio,
  rollLengthCm,
  rollWind,
  sinkMs,
  stepFight,
  tensionBand,
  tierIndexOf,
  tierLabel,
  weightForLength,
  windArrow,
  windText,
  type Fish,
  type FightParams,
  type FightState,
} from "./logic";
// 1.3 视觉层:共享美术套件的参数化矢量鱼(只 import,kit 已有文件不修改)
import { drawKitFish, facingOf, fishColor, specForFish, depthFade } from "../../art/kit/fishArt";
import { SparklePool } from "../../art/kit/sparkle";
import {
  FSH_TIMING,
  FSH_TOKENS,
  FishingFx,
  bobberDipPx,
  bubbleAt,
  goldFlashAlpha,
  leapPoint,
  lineSplit,
  rippleGapMs,
  rippleRing,
  rodBendOf,
  splashDropAt,
  wagOf,
  waveShift,
} from "./visual";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

/** 触屏可点元素的最小边长 */
export const TOUCH_MIN_PX = 44;

const CSS = `
.fs-wrap{--fs-ink:#3f5670;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--fs-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;position:relative;}
/* 横过来拿的时候 capWrap() 会给 .fs-wrap 钳一个像素高度（水面收到 MIN_SEA_PX 还是装不下）。
   光钳高度不够：列向 flex 的孩子默认 flex-shrink:1，一钳就抢着自己压扁。真机 740×360 上
   量到 .fs-sea 被压成 10px（它是 overflow:hidden，min-height:auto 解析成 0），
   132px 的画布整个被裁掉，而 wrap 的 scrollHeight 等于 clientHeight，滚动条压根不出现——
   抛竿键是够得着了，可水面、鱼群带、深度尺一起没了。不许压扁，超出的交给 wrap 自己滚。
   没钳位的那几档列向没有负空间，这一条是空转的。 */
.fs-wrap>*{flex-shrink:0;}
.fs-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.fs-chip{background:linear-gradient(180deg,#ffffff,#f2f9ff);border-radius:999px;padding:4px 10px;font-size:12.5px;
  font-weight:800;white-space:nowrap;border:1px solid rgba(120,160,190,.28);
  box-shadow:0 2px 5px rgba(90,130,160,.18),inset 0 1px 0 #ffffff;}
.fs-chip b{font-weight:900;color:#1f6f9c;}
.fs-chip--goal{background:#e6f5ff;color:#1f6f9c;}
.fs-chip--warn{background:#ffe8ee;color:#b23a63;}
/* 触屏底线 44px：这颗按钮（⏸ 暂停、结算页的几颗）原来只有 34px 高，
   小手指按不准。只抬高不动配色圆角；inline-flex 居中，免得文字贴着上边。 */
.fs-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#5aa9d6,#3d87b8);box-shadow:0 3px 0 #2d6a94;
  min-height:${TOUCH_MIN_PX}px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;}
.fs-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #2d6a94;}
.fs-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-btn--ghost{background:linear-gradient(180deg,#a9c4d8,#87a7bf);box-shadow:0 3px 0 #6b8aa1;}
.fs-btn--ghost:active{box-shadow:0 1px 0 #6b8aa1;}
/* position:relative 是给上鱼那一行「水桶」当画布用的：它浮在水面上，不占常规流高度。
   为什么非这么摆不可，见下面 .fss-show 那一段。 */
.fs-sea{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(70,110,150,.22);line-height:0;
  position:relative;}
.fs-sea canvas{display:block;}
.fs-bars{width:100%;max-width:620px;display:flex;flex-direction:column;gap:4px;}
.fs-barrow{display:flex;align-items:center;gap:7px;}
.fs-barlabel{font-size:14px;font-weight:900;white-space:nowrap;width:44px;text-align:right;color:#5b7a92;}
.fs-track{position:relative;flex:1;height:16px;border-radius:999px;background:#e8eff5;overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(70,110,150,.25);}
.fs-zone{position:absolute;top:0;bottom:0;}
.fs-zone--good{background:#cdeecd;}
.fs-zone--tight{background:#ffe0a8;}
.fs-zone--snap{background:#ffc4cf;}
.fs-fill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:linear-gradient(180deg,#7fd0f0,#3d9ed4);}
.fs-fill--tension{background:linear-gradient(180deg,#8fd68f,#4fae63);}
.fs-fill--tight{background:linear-gradient(180deg,#ffce70,#e8a02f);}
.fs-fill--danger{background:linear-gradient(180deg,#ff97ad,#e04f74);}
.fs-fill--slack{background:linear-gradient(180deg,#c9d6e0,#9db1c2);}
.fs-mark{position:absolute;top:-2px;bottom:-2px;width:2px;background:#3f5670a0;}
.fs-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:620px;color:#4f6c86;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;min-height:19px;}
.fs-act{border:none;border-radius:18px;padding:13px 30px;font-size:17px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f0a35c,#dd8232);box-shadow:0 5px 0 #b4652248;
  min-width:190px;touch-action:none;}
.fs-act:active{transform:translateY(3px);box-shadow:0 2px 0 #b4652248;}
.fs-act:focus-visible{outline:3px solid #ffb43c;outline-offset:3px;}
.fs-act--reel{background:linear-gradient(180deg,#6fc48f,#3f9c68);box-shadow:0 5px 0 #2d7a4e48;}
.fs-act--wait{background:linear-gradient(180deg,#a9c4d8,#87a7bf);box-shadow:0 5px 0 #6b8aa148;}
.fs-veil{position:absolute;inset:0;background:rgba(248,253,255,.95);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.fs-veil-t{font-size:20px;font-weight:900;color:#2f7ba6;}
.fs-veil-s{font-size:13.5px;font-weight:700;color:#57748c;line-height:1.6;max-width:330px;}
.fs-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fs-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#eaf6fd,#fdf3ea);display:flex;flex-direction:column;gap:8px;}
.fs-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.fs-back{border:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#2f7ba6;box-shadow:0 3px 0 rgba(80,130,170,.28);}
.fs-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(80,130,170,.28);}
.fs-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.fs-bar[hidden]{display:none;}
/* 地图页那三颗入口(🌙 钓到天黑 / 📖 鱼类图鉴 / 🎒 我的装备)实测只有 34px 高,
   低于 44px 触屏底线——测试员 W5-B-11。关内那一批第 1 轮已经清干净了,这是地图页的残留。
   只抬高度,配色圆角内边距一个都不动;inline-flex 居中,免得抬高之后文字贴着上边。 */
.fs-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#5aa9d6,#3d87b8);box-shadow:0 4px 0 #2d6a94;
  min-height:${TOUCH_MIN_PX}px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;}
.fs-open:active{transform:translateY(2px);box-shadow:0 2px 0 #2d6a94;}
.fs-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-open--endless{background:linear-gradient(180deg,#f0a35c,#dd8232);box-shadow:0 4px 0 #b46522;}
.fs-open--dex{background:linear-gradient(180deg,#8f9fe0,#6f7fc8);box-shadow:0 4px 0 #57679f;}
.fs-dex{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px;max-height:60vh;
  overflow-y:auto;padding:2px;}
.fs-card{background:#fff;border-radius:14px;padding:8px 10px;box-shadow:0 3px 8px rgba(90,130,160,.16);
  display:flex;flex-direction:column;gap:2px;}
.fs-card--locked{background:#eef2f6;box-shadow:none;}
.fs-cname{font-size:14px;font-weight:900;color:#2f5f80;}
.fs-card--locked .fs-cname{color:#9fb0bf;}
.fs-cmeta{font-size:11.5px;font-weight:800;color:#6d8ba1;}
.fs-cnote{font-size:11.5px;font-weight:600;color:#7b93a6;line-height:1.45;}
.fs-crare{font-size:12px;letter-spacing:1px;color:#e8a02f;}
.fs-dexhead{font-size:13px;font-weight:800;color:#3f7ea6;text-align:center;}
.fs-layerhead{grid-column:1/-1;font-size:13px;font-weight:900;color:#2f7ba6;padding:4px 2px 0;}
.fs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
@media (max-width:420px){
  .fs-chip{font-size:11.5px;padding:3px 8px;}
  .fs-act{padding:12px 22px;font-size:16px;min-width:160px;}
  .fs-dex{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));}
}
/* 手机竖屏一共 667 像素高,水面上面还压着标题栏。每一行都收一点,
   保证张力条和那颗大按钮永远在首屏里,不用一边滚屏一边收线。 */
@media (max-height:720px){
  .fs-wrap{gap:5px;}
  .fs-chip{font-size:11px;padding:2px 7px;}
  .fs-tip{font-size:11.5px;line-height:1.35;padding:3px 9px;}
  .fs-act{padding:11px 20px;font-size:15.5px;}
  .fs-track{height:14px;}
}
@media (max-height:840px) and (min-height:721px){
  .fs-wrap{gap:6px;}
  .fs-act{min-height:44px;}
}
@media (prefers-reduced-motion:reduce){
  .fs-btn:active,.fs-act:active,.fs-open:active{transform:none;}
}

/* ---------------------------------------------------------------------------
   1.2 追加(一律 fss- 前缀,不动上面任何一条老规则)
   风向条 / 红区预警 / 上鱼小演出 / 装备面板 / 图鉴详情 / 天色
--------------------------------------------------------------------------- */
.fss-row{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;width:100%;}
.fss-wind{background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;
  color:#3f6f92;box-shadow:0 2px 5px rgba(90,130,160,.18);}
.fss-wind b{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;color:#1f6f9c;letter-spacing:1px;}
.fss-phase{background:#fff5e6;color:#a3641f;}
.fss-zone--red{position:absolute;top:0;bottom:0;background:#ffb3c2;}
.fss-warn{position:absolute;top:-3px;bottom:-3px;width:3px;background:#b23a63;border-radius:2px;}
.fss-mark{font-size:14px;font-weight:900;width:40px;text-align:center;letter-spacing:-1px;color:#5b7a92;}
.fss-mark--green{color:#3f9c68;}
.fss-mark--yellow{color:#d8901f;}
.fss-mark--red{color:#d33a5f;}
.fss-redbar{width:100%;max-width:620px;height:8px;border-radius:999px;background:#ffe3e9;overflow:hidden;
  box-shadow:inset 0 1px 2px rgba(150,60,90,.2);}
.fss-redbar[hidden]{display:none;}
.fss-redfill{height:100%;width:0;background:linear-gradient(90deg,#ff9db1,#d33a5f);border-radius:999px;}
.fss-shake{animation:fssShake .18s linear infinite;}
@keyframes fssShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
/* 手机上蓄力与收线共用这一颗大按钮:热区必须够 64px */
.fss-act{min-height:64px;min-width:min(88vw,220px);}
/* 上鱼之后的「水桶」那一行：**浮在水面上，绝对定位，不占常规文档流高度**。
   原来它是 .fs-wrap 的一个常规子节点,钓上第一条鱼才显形——一显形就把整屏顶高
   48–73px（实测桶行 48/73px、整屏长高 55/77/78px）,而 .game-stage 是定高 +
   overflow:hidden（平台文件,交窗口1）,顶出去的那一截既不滚也没提示。
   顶出去的正是「🎣 按住抛竿」那颗唯一的操作键:四档视口 × 三关 12 组全中,
   elementFromPoint 拿回舞台祖先甚至 null,而每关要钓 4–6 条,于是永远卡在 1 条
   ——测试员 W5-B-08(阻断)。改成浮层之后,钓第几条鱼都不会再改变这一屏的高度。
   放生键跟着抬到 44px 触屏底线(原来 36px)。 */
.fss-show{position:absolute;left:6px;right:6px;bottom:6px;z-index:3;line-height:1.4;
  display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;background:#ffffffee;
  border-radius:14px;padding:6px 10px;font-size:12.5px;font-weight:800;color:#3f6f92;
  box-shadow:0 3px 10px rgba(70,110,150,.22);}
.fss-show[hidden]{display:none;}
.fss-let{border:none;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7fc8e0,#4f9cc4);box-shadow:0 3px 0 #3b7c9e;
  min-height:${TOUCH_MIN_PX}px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;}
.fss-let:active{transform:translateY(2px);box-shadow:0 1px 0 #3b7c9e;}
.fss-let:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fss-open--gear{background:linear-gradient(180deg,#f0c05c,#d99a2e);box-shadow:0 4px 0 #a97516;}
.fss-gear{display:flex;flex-direction:column;gap:8px;max-height:62vh;overflow-y:auto;padding:2px;}
.fss-gcard{background:#fff;border-radius:14px;padding:9px 11px;box-shadow:0 3px 8px rgba(90,130,160,.16);
  display:flex;flex-direction:column;gap:4px;}
.fss-gtop{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.fss-gname{font-size:15px;font-weight:900;color:#2f5f80;}
.fss-glv{font-size:12px;font-weight:900;color:#a97516;background:#fff3d8;border-radius:999px;padding:2px 8px;}
.fss-gwhat{font-size:12px;font-weight:700;color:#7b93a6;line-height:1.5;}
.fss-gnote{font-size:12px;font-weight:700;color:#4f6c86;}
.fss-gbuy{border:none;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f0a35c,#dd8232);box-shadow:0 3px 0 #b46522;
  min-height:${TOUCH_MIN_PX}px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;
  margin-left:auto;white-space:nowrap;}
.fss-gbuy:disabled{background:#cbd7e0;box-shadow:0 3px 0 #aebecb;cursor:default;color:#f4f8fb;}
.fss-gbuy:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #b46522;}
.fss-gbuy:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fss-gbar{font-size:12.5px;font-weight:800;color:#3f6f92;text-align:center;line-height:1.6;}
.fss-tier{font-size:11.5px;font-weight:900;letter-spacing:.5px;}
.fss-cdex{font-size:11px;font-weight:700;color:#6d8ba1;line-height:1.45;}
.fss-tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:4px;}
.fss-tab{border:none;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffcc;color:#4f7c9c;box-shadow:0 2px 5px rgba(90,130,160,.18);
  min-height:${TOUCH_MIN_PX}px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;}
.fss-tab[aria-pressed="true"]{background:#2f7ba6;color:#fff;}
.fss-tab:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
@media (max-width:420px){
  .fss-act{min-width:min(92vw,200px);}
  .fss-wind{font-size:11.5px;padding:3px 8px;}
}
/* 640 高的机器再收一档。舞台是定高 + overflow:hidden（平台的 styles.css，交给窗口1），
   超出的部分既不滚也没提示：测试员 W5-B-01 在 360×640 上量到第 100 关的
   「🎣 按住抛竿」中心落到裁切线以下 8px，按不着就开不了局——1.2 追加的风向条与
   红区预警正好又给这一屏加了两行。这里把那两行连同 HUD 一起收一档，
   并给 .fs-wrap 一个自滚兜底：收完还高也不至于点不着。
   那颗大按钮只收内边距、不动 44px 热区。 */
@media (max-height:660px){
  .fs-wrap{gap:4px;max-height:100%;overflow-y:auto;}
  .fs-chip{font-size:10.5px;padding:2px 6px;}
  .fs-tip{font-size:11px;line-height:1.3;padding:2px 8px;min-height:16px;}
  .fs-track{height:12px;}
  .fs-act{padding:10px 18px;min-height:44px;box-sizing:border-box;}
  .fss-wind{font-size:11px;padding:2px 7px;}
  .fss-row{gap:4px;}
}
@media (max-height:840px) and (min-height:661px){
  .fs-wrap{max-height:100%;overflow-y:auto;}
  .fs-act{min-height:44px;box-sizing:border-box;}
}
@media (prefers-reduced-motion:reduce){
  .fss-shake{animation:none;}
  .fss-let:active,.fss-gbuy:active:not(:disabled){transform:none;}
}

/* ---------------------------------------------------------------------------
   1.3 视觉升级追加(第 22 步 B 档;仍旧只追加,选择器一律 fss- 前缀)
   上鱼那一行「水桶」做成木牌展示卡,配画布里的收获仪式
--------------------------------------------------------------------------- */
.fss-show{background:linear-gradient(180deg,#f2d6a4,#dfb87c);border:2px solid #a97a44;color:#5f3f1e;
  box-shadow:0 3px 10px rgba(120,80,30,.30),inset 0 1px 0 #f8e6c4;}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("fs-style")) return;
  const style = document.createElement("style");
  style.id = "fs-style";
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

function button(cls: string, label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.textContent = label;
  return btn;
}

// ---------------------------------------------------------------------------
// 一场钓鱼(闯关的一关 / 无尽的一局共用)
// ---------------------------------------------------------------------------

type Phase = "aim" | "charge" | "sink" | "wait" | "bite" | "fight" | "show";

/** 咬钩到开始拉扯之间的反应窗口(浮标装备还能再加一点) */
const BITE_WINDOW_MS = 400;

/** 上鱼小演出多长(可跳过) */
const SHOW_MS = 900;
/** 演出至少放这么久才允许按掉,免得手快的人根本没看见鱼 */
const SHOW_SKIP_MS = 220;

/** 隔多久重新量一次舞台可视高(量到的和现在一样就什么都不写) */
export const REFIT_MS = 300;

export interface CatchInfo {
  fish: Fish;
  /** 这一条多长(厘米) */
  cm: number;
  /** 这一条多重(千克) */
  kg: number;
  score: number;
  /** 图鉴新收录 */
  isNew: boolean;
  /** 刷新了本种最大尺寸 */
  isBiggest: boolean;
}

export interface RunResult {
  won: boolean;
  reason: "goal" | "time" | "casts" | "quit";
  log: CatchLog;
  secondsLeft: number;
  castsLeft: number;
  /** 断线 + 跑鱼的次数 */
  lost: number;
  /** 最重的一条 */
  bestFish: Fish | null;
  /** 最重那一条有多重(千克) */
  bestKg: number;
  /** 放生了几条 */
  released: number;
}

interface RunOpts {
  /** 有目标的闯关关卡;无尽模式不给 */
  level?: FishingLevel;
  band: { from: number; to: number };
  /** 限时秒数(0 表示不限时) */
  seconds: number;
  /** 抛竿上限(0 表示不限) */
  casts: number;
  hardness: number;
  hint: string;
  /** 这一局带的装备(鱼线 / 鱼饵 / 浮标) */
  gear: GearSet;
  /** 无尽「钓到天黑」:时间推移会换天色、换鱼群 */
  daylight?: boolean;
  sfx: (name: SoundName) => void;
  /** 每钓上一条鱼回调一次(记图鉴、加星星) */
  onCatch?: (info: CatchInfo) => void;
  /** 放生一条鱼 */
  onRelease?: (fish: Fish, firstRelease: boolean) => void;
  onDone: (res: RunResult) => void;
}

interface Runner {
  destroy: () => void;
}

/** 水面在画布里占的高度比例 */
const SKY = 0.13;

/** 装饰用的游鱼:同一关每次布局一样,纯装饰不参与判定 */
interface Swimmer {
  fish: Fish;
  depth: number;
  x: number;
  speed: number;
}

function makeSwimmers(rand: () => number, count: number): Swimmer[] {
  const out: Swimmer[] = [];
  for (let i = 0; i < count; i++) {
    const fish = FISH[Math.floor(rand() * FISH.length)];
    const layer = LAYERS[fish.layer];
    out.push({
      fish,
      depth: layer.from + rand() * (layer.to - layer.from),
      x: rand(),
      speed: (0.02 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),
    });
  }
  return out;
}

function createRun(host: HTMLElement, opts: RunOpts): Runner {
  ensureCss(host);

  // 闯关每次重玩换一个盐:关卡目标是固定的,但咬钩顺序不会背下来
  const rand = opts.level ? levelRandom(opts.level, Math.floor(Math.random() * 997)) : mulberryNow();
  const totalMs = opts.seconds > 0 ? opts.seconds * 1000 : 0;
  const ledger = createLedger({
    cancelRaf: (id) => cancelAnimationFrame(id),
    clearTimer: (id) => clearTimeout(id),
  });

  // 装备加成:进这一局的时候定死,中途不会变;越界的存档会被夹回上限
  const bonus: GearBonus = gearBonus(opts.gear);
  assertGearCaps(bonus);

  // ---- 状态 ---------------------------------------------------------------
  let phase: Phase = "aim";
  let phaseMs = 0;
  let chargeMs = 0;
  let power = 0;
  let depth = 0;
  let dist = 0;
  let wind = rollWind(rand);
  let waitMs = 0;
  let sinkTotal = 0;
  let biteWindow = BITE_WINDOW_MS + bonus.reactionMs;
  let hooked: Fish | null = null;
  let params: FightParams | null = null;
  let fight: FightState = newFight();
  let holding = false;
  let paused = false;
  let finished = false;
  let remainMs = totalMs;
  let castsLeft = opts.casts > 0 ? opts.casts : Number.POSITIVE_INFINITY;
  let combo = 0;
  let lost = 0;
  let log: CatchLog = emptyLog();
  let bestFish: Fish | null = null;
  let bestKg = 0;
  let released = 0;
  let showText = "";
  let ambient = 0;
  /** 手上这一条(演出期间可以放生),抛下一竿就清掉 */
  let inBucket: CatchInfo | null = null;

  /** 无尽「钓到天黑」现在是哪一段 */
  function dayPhase(): DayPhase {
    if (!opts.daylight || totalMs <= 0) return "day";
    return phaseAt(totalMs - remainMs, totalMs);
  }

  const swimmers = makeSwimmers(mulberry(opts.level ? opts.level.seed : 20260826), 9);

  // ---- 1.3 视觉状态(纯皮:涟漪 / 水花 / 鱼跃 / 星屑;destroy 一把清) ----------
  const fx = new FishingFx();
  const stars = new SparklePool();
  /** 上一帧的相位:只用来触发入水涟漪与收获仪式,不写任何玩法状态 */
  let fxPhase: Phase = "aim";

  // ---- DOM ----------------------------------------------------------------
  const wrap = el("div", "fs-wrap");
  const hud = el("div", "fs-hud");
  const chipGoal = el("span", "fs-chip fs-chip--goal");
  const chipTime = el("span", "fs-chip");
  const chipCombo = el("span", "fs-chip");
  const pauseBtn = button("fs-btn fs-btn--ghost", "⏸ 暂停");
  hud.append(chipGoal, chipTime, chipCombo, pauseBtn);

  const seaBox = el("div", "fs-sea");
  const canvas = document.createElement("canvas");
  seaBox.appendChild(canvas);
  // 上鱼小演出那一行「水桶」:浮在水面上(见 CSS 里 .fss-show 那一段)。
  // 挂在水面盒子里而不是挂在 wrap 上,是为了让它彻底退出常规文档流——
  // 钓上第几条鱼都不会再改变这一屏的高度,抛竿键也就不会被顶出舞台。
  const showRow = el("div", "fss-show");
  showRow.hidden = true;
  const showLabel = el("span", "", "");
  const letBtn = button("fss-let", "💧 放生");
  showRow.append(showLabel, letBtn);
  seaBox.appendChild(showRow);

  // 风向 / 天色那一行:抛竿之前就能看清这一竿会被吹偏多少
  const infoRow = el("div", "fss-row");
  const windChip = el("span", "fss-wind");
  const phaseChip = el("span", "fss-wind fss-phase");
  phaseChip.hidden = !opts.daylight;
  infoRow.append(windChip, phaseChip);

  const bars = el("div", "fs-bars");
  const tensionRow = el("div", "fs-barrow");
  const tensionTrack = el("div", "fs-track");
  const zoneGood = el("div", "fs-zone fs-zone--good");
  zoneGood.style.left = `${GOOD_AT * 100}%`;
  zoneGood.style.width = `${(TIGHT_AT - GOOD_AT) * 100}%`;
  const zoneTight = el("div", "fs-zone fs-zone--tight");
  zoneTight.style.left = `${TIGHT_AT * 100}%`;
  zoneTight.style.width = `${(SNAP_AT - TIGHT_AT) * 100}%`;
  // 红区:1.2 秒倒计时的那一段(鱼线越好它越靠右);竖线是浮标的预警刻度,比红区更早
  const redStart = RED_AT + (bonus.snapAt - SNAP_AT);
  const zoneRed = el("div", "fss-zone--red");
  zoneRed.style.left = `${clamp(redStart, 0, 1) * 100}%`;
  zoneRed.style.width = `${clamp(1 - redStart, 0, 1) * 100}%`;
  const warnMark = el("div", "fss-warn");
  warnMark.style.left = `${clamp(bonus.warnAt, 0, 1) * 100}%`;
  const tensionFill = el("div", "fs-fill fs-fill--tension");
  tensionTrack.append(zoneGood, zoneTight, zoneRed, tensionFill, warnMark);
  const bandMarkEl = el("div", "fss-mark", bandMark("green"));
  tensionRow.append(el("div", "fs-barlabel", "张力"), tensionTrack, bandMarkEl);

  const pullRow = el("div", "fs-barrow");
  const pullTrack = el("div", "fs-track");
  const pullFill = el("div", "fs-fill");
  pullTrack.appendChild(pullFill);
  pullRow.append(el("div", "fs-barlabel", "收线"), pullTrack, el("div", "fss-mark", " "));
  // 红区倒计时:进红区才出现,走满就断线
  const redBar = el("div", "fss-redbar");
  redBar.hidden = true;
  const redFill = el("div", "fss-redfill");
  redBar.appendChild(redFill);
  bars.append(tensionRow, pullRow, redBar);

  const tip = el("div", "fs-tip", opts.hint);

  const actBtn = button("fs-act fss-act", "🎣 按住抛竿");
  const live = el("div", "fs-sr");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");

  wrap.append(hud, seaBox, infoRow, bars, tip, actBtn, live);
  host.appendChild(wrap);
  // 地图上「🎯 跳到当前关」(以及点节点时浏览器自带的聚焦滚动)会给舞台留下一个非 0 的
  // scrollTop,进关之后没有任何东西会还原它,而舞台是 overflow:hidden——关内顶部就被
  // 永久裁掉一截(测试员 W5-B-09)。进关这一刻把这条链上的位移归 0。
  resetClippedScroll(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ---------------------------------------------------------------
  function press(): void {
    if (paused || finished) return;
    // 举鱼那一下看够了就能按掉,但先留 SHOW_SKIP_MS 让人看清是哪条鱼
    if (phase === "show") {
      if (phaseMs >= SHOW_SKIP_MS) afterShow();
      return;
    }
    holding = true;
  }
  function release(): void {
    holding = false;
  }

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    press();
  };
  actBtn.addEventListener("pointerdown", onPointerDown);
  ledger.listener(() => actBtn.removeEventListener("pointerdown", onPointerDown));
  /** 这一刻这一屏真滚得起来吗（横过来拿被 capWrap() 钳过位的那几档） */
  function wrapScrolls(): boolean {
    return wrap.scrollHeight - wrap.clientHeight > 4;
  }
  const onCanvasDown = (e: PointerEvent): void => {
    // 钳过位那几档,抛竿键就在滚出去的那 94px 里,手指落在水面上必须划得动。
    // 而 preventDefault() 会把这一指的默认行为(滚动)连同双击缩放一起吃掉——
    // 真机 844×390 上从水面正中上划两次 150px,scrollTop 纹丝不动 0 → 0。
    // 所以只在滚不动的那几档拦(竖屏四档,点水面抛竿是原来的手感);
    // 滚得起来就放行,「按住蓄力」照旧生效——手指真滑起来时浏览器发 pointercancel,
    // 上面那条 window pointercancel → release() 会把这一次蓄力收干净。
    if (!wrapScrolls()) e.preventDefault();
    press();
  };
  canvas.addEventListener("pointerdown", onCanvasDown);
  ledger.listener(() => canvas.removeEventListener("pointerdown", onCanvasDown));

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    // R = 放生手上这一条(和界面上那颗按钮同一件事)
    if (e.code === "KeyR" && inBucket) {
      e.preventDefault();
      letGo();
      return;
    }
    if (!isActionKey(e.code) || e.repeat) return;
    e.preventDefault();
    press();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!isActionKey(e.code)) return;
    e.preventDefault();
    release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);
  ledger.listener(() => window.removeEventListener("keydown", onKeyDown));
  ledger.listener(() => window.removeEventListener("keyup", onKeyUp));
  ledger.listener(() => window.removeEventListener("pointerup", release));
  ledger.listener(() => window.removeEventListener("pointercancel", release));
  ledger.listener(() => window.removeEventListener("blur", release));

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  letBtn.addEventListener("click", () => {
    letGo();
  });

  // ---- 画布尺寸 ------------------------------------------------------------
  let W = 320;
  let H = 260;

  // 一条裁切线认下之后就一直算数。只问「这一刻裁不裁」会在水面收到刚好装得下的那一帧
  // 把舞台弄丢(定高盒子的 scrollHeight 会被夹回 clientHeight),钳位整条被跳过,
  // 水面一口气弹回按 innerHeight 猜的那个值,把抛竿键顶出舞台 —— 见 fit.ts 的 staysClipLine。
  const clipWatch = createClipWatch();

  /** 这一屏现在应该多宽多高（纯测量，不写任何东西） */
  function wantedSize(): { w: number; h: number } {
    const avail = clamp(host.clientWidth || 340, 240, 620);
    const viewH = (globalThis as { innerHeight?: number }).innerHeight ?? 700;
    // 手机竖屏一共 667 像素,水面上面还压着平台标题栏和 level99 的选关条。
    // 水面必须让位,否则那颗「按住抛竿」的大按钮会被挤到首屏外面去。
    const share = viewH <= 560 ? 0.33 : viewH <= 720 ? 0.36 : 0.42;
    let want = clamp(viewH * share, 180, 380);
    // 上面这个比例是拿整块屏幕猜的,可子游戏拿到的从来不是整块屏幕:平台壳顶栏 +
    // l99 抬头 + 关卡 HUD 在矮屏上要吃掉两百多像素,而多出来的部分被 .game-stage
    // (定高 + overflow:hidden,平台文件,交窗口1)直接裁掉。这里量一次真实可视高
    // 再倒推水面——水面以外那几行(HUD / 风向 / 张力条 / 提示 / 大按钮)就是 chrome。
    const room = clipWatch.roomPx(wrap);
    if (Number.isFinite(room) && typeof wrap.getBoundingClientRect === "function") {
      const chrome = Math.max(0, wrap.getBoundingClientRect().height - seaBox.getBoundingClientRect().height);
      want = seaHeightPx(want, room, chrome);
    }
    return { w: Math.round(avail), h: Math.round(want) };
  }

  /**
   * 排一次版。**幂等**:算出来和现在一样就一个字节都不写。
   * 幂等这一点是必需的——挂进 DOM 的那一瞬间壳层还没落位(选关地图还在上面),
   * 那时候量到的可视高偏小,水面会被收得过头。所以主循环每隔一会儿会再量一次,
   * 壳层落位之后水面自己长回来;不幂等的话就是每帧清一次画布。
   */
  function layout(): void {
    const next = wantedSize();
    if (next.w === W && next.h === H && canvas.width > 0) return;
    W = next.w;
    H = next.h;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /**
   * 水面收到下限还是装不下时,这一屏自己钳出一条滚动条。
   *
   * `seaHeightPx()` 收的只有水面,而水面有下限(`MIN_SEA_PX`)。横过来拿的时候
   * 舞台看得见的那一段只剩两百出头,光是水面以外那几行就要 182px,
   * 于是水面一路收到底仍旧超出 90px——整颗「🎣 按住抛竿」掉在裁切线以下,
   * 而这一屏当时连一处能起手滚的地方都没有(`scrollHeight − clientHeight` 是 0)。
   * CSS 里那句 `.fs-wrap{max-height:100%}` 指望不上:壳层那条祖先链是 auto 高的,
   * 百分比没有可解析的参照。只能量出真实像素写死。
   *
   * 收得动的那几档 `wrapCapPx()` 返回 `null`,一个字节都不写,手感一分不变。
   *
   * 返回**这一帧钳位值变没变**:变了才是一次布局事件,那一刻(也只有那一刻)
   * 才该把抛竿键送进眼里。每帧都送就成了每 300ms 把孩子的滚动位置抢回来一次。
   */
  let lastCap: number | null = null;
  function capWrap(): boolean {
    const cap = wrapCapPx(clipWatch.roomPx(wrap), wrap.scrollHeight);
    const changed = cap !== lastCap;
    lastCap = cap;
    if (cap === null) {
      wrap.style.maxHeight = "";
      wrap.style.overflowY = "";
      return changed;
    }
    wrap.style.maxHeight = `${cap}px`;
    wrap.style.overflowY = "auto";
    return changed;
  }

  /**
   * 把抛竿键送进可视段（`W5R3-BT-01` / `W5R3-BT-02`）。
   *
   * 只在**布局事件**上调用：钳位值换了、换相位、这一屏的内容长高了、转屏。
   * 这几刻这一屏刚重新落位，孩子也刚被交代一件新的事。**其余时间一格不动**
   * ——想看水面就让他看，每帧都往回拽比看不见键更难受。
   * 键本来就在眼前时 `showAct()` 一个字节都不写。
   */
  function sendActIntoView(): void {
    showAct(wrap, actBtn);
  }

  /**
   * 重排到不动为止。
   *
   * 一趟只收水面,可 chrome(HUD / 提示行那几排)会跟着这一趟变——320px 宽上
   * HUD 那排药丸的折行数就跟着水面走。收完再量一次,直到高度不再变化。
   * `layout()` 幂等,所以「不变了」就是 0 成本的一次空跑;三趟封顶,不给它机会来回荡。
   */
  function refitNow(): void {
    // 量之前先摘掉上一次钳出来的高度。钳过的 wrap 其 rect 高度**就是钳位本身**,
    // 拿它去倒推 chrome 会一趟比一趟小,水面越收越窄,最后收成一条线。
    //
    // 可摘掉的那一瞬间这一屏不再滚得起来,浏览器当场把 scrollTop 夹回 0。
    // 而这个函数每 REFIT_MS(300ms)跑一次:真机 844×390 上把 scrollTop 拨到满行程 94、
    // 600ms 后回来量是 0 —— 孩子刚滑到抛竿键,0.3 秒后又被弹回水面。所以先记下来。
    const keepScroll = wrap.scrollTop;
    wrap.style.maxHeight = "";
    wrap.style.overflowY = "";
    for (let i = 0; i < 3; i++) {
      const before = H;
      layout();
      if (H === before) break;
    }
    const capChanged = capWrap();
    // 还回去。滚不动的那几档 scrollTop 恒 0,这一句是空转的;钳位变小了浏览器自己夹。
    if (keepScroll > 0 && wrap.scrollTop !== keepScroll) wrap.scrollTop = keepScroll;
    // 钳位换了 = 这一屏刚刚重新落位(进关第一帧、转屏、上鱼那一下都走这里)。
    // 「滚得动」和「落地就在眼前」是两件事:落地的 scrollTop 是 0,而抛竿键排在最后一行
    // ——真机 640×360 上量到键在 428.3–472.3、可视段下沿只到 344,整颗在口子外面
    // (W5R3-BT-01)。钳完顺手把它送进来,滚最小的那一段。键本来就在眼前时一格不动。
    if (capChanged) sendActIntoView();
  }
  layout();
  /** 上一帧量到的这一屏总高:变了就当帧重排(见 frame() 里那一段) */
  let lastWrapH = 0;
  /** 上一帧是哪个相位:换相位那一下把抛竿键送回眼前(见 frame() 末尾那一段) */
  let lastActPhase: Phase | "" = "";
  /** 上一帧这一屏的内容有多高:钳过之后它是唯一还在动的那个量(见 frame() 末尾那一段) */
  let lastContentH = 0;
  const onResize = (): void => {
    // 转屏是「收无可收」那一档唯一的入口,只 layout() 一次收不住(水面到下限就不动了,
    // 钳位那一手压根不会跑)。走收敛版。
    refitNow();
    // 竖着拿好好的,横过来拿抛竿键就整颗掉到可视段外面(W5R3-BT-01)。
    // 转屏是这一条最要紧的入口:钳位值有可能没变(refitNow 里那一手就不会跑),
    // 可这一屏的高矮全变了,得自己再送一次。
    sendActIntoView();
    render();
  };
  window.addEventListener("resize", onResize);
  ledger.listener(() => window.removeEventListener("resize", onResize));

  function surfaceY(): number {
    return H * SKY;
  }

  function yOfDepth(d: number): number {
    const top = surfaceY();
    return top + (clamp(d, 0, MAX_DEPTH) / MAX_DEPTH) * (H - top - 4);
  }

  // ---- 绘制 ---------------------------------------------------------------

  /** ① 天空 + 远山 + 云两朵(视差两档;reduced 静止) */
  function drawBackdrop(): void {
    if (!g) return;
    const sy = surfaceY();
    const info = opts.daylight ? PHASE_INFO[dayPhase()] : null;
    const sky = g.createLinearGradient(0, 0, 0, sy);
    sky.addColorStop(0, info ? info.sky : FSH_TOKENS.fshSkyTop);
    sky.addColorStop(1, info ? info.sky : "#f2fbff");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, sy);

    // 远景山影两座(坐在水平线上)
    g.fillStyle = "rgba(110,150,185,.28)";
    g.beginPath();
    g.moveTo(W * 0.4, sy);
    g.quadraticCurveTo(W * 0.58, sy - H * 0.1, W * 0.78, sy);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(110,150,185,.18)";
    g.beginPath();
    g.moveTo(W * 0.62, sy);
    g.quadraticCurveTo(W * 0.82, sy - H * 0.14, W * 1.04, sy);
    g.closePath();
    g.fill();

    // 云两朵:一快一慢的视差,reduced 静止
    const reduced = reduceMotion();
    const drift1 = waveShift(ambient, 90_000, reduced);
    const drift2 = waveShift(ambient, 140_000, reduced);
    drawCloud(((drift1 + 0.22) % 1) * (W + 70) - 35, sy * 0.36, W * 0.05, 0.85);
    drawCloud(((drift2 + 0.62) % 1) * (W + 70) - 35, sy * 0.62, W * 0.038, 0.6);
  }

  function drawCloud(cx: number, cy: number, r: number, alpha: number): void {
    if (!g) return;
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.beginPath();
    g.ellipse(cx, cy, r * 1.6, r * 0.72, 0, 0, Math.PI * 2);
    g.ellipse(cx - r, cy + r * 0.18, r, r * 0.55, 0, 0, Math.PI * 2);
    g.ellipse(cx + r, cy + r * 0.2, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  }

  /** ③ 深水渐变 + ④ 光柱两道 + 气泡(≤6 颗;reduced 静止) */
  function drawWater(): void {
    if (!g) return;
    const sy = surfaceY();
    const info = opts.daylight ? PHASE_INFO[dayPhase()] : null;

    // ③ 深水渐变:水面亮 → 深水暗(替代原先五条纯色横带)
    const water = g.createLinearGradient(0, sy, 0, H);
    water.addColorStop(0, FSH_TOKENS.fshWaterHi);
    water.addColorStop(1, FSH_TOKENS.fshWaterLo);
    g.fillStyle = water;
    g.fillRect(0, sy, W, H - sy);

    // 岸下的浅水沙坡:近岸浅、越远越深的体感
    g.fillStyle = "rgba(232,213,168,.4)";
    g.beginPath();
    g.moveTo(0, sy);
    g.lineTo(W * 0.26, sy);
    g.quadraticCurveTo(W * 0.1, sy + (H - sy) * 0.34, 0, sy + (H - sy) * 0.5);
    g.closePath();
    g.fill();

    // 水层分界只留淡淡一线(位置照旧吃 yOfDepth,只读)
    g.strokeStyle = "rgba(255,255,255,.09)";
    g.lineWidth = 1;
    for (let i = 1; i < LAYERS.length; i++) {
      const y = yOfDepth(LAYERS[i].from);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    // 天色压在水上:清晨暖、夜里深蓝,始终是 2D 侧视的剖面图,不做真 3D
    if (info) {
      g.fillStyle = info.tint;
      g.fillRect(0, sy, W, H - sy);
    }

    // ④ 光柱两道:斜向白 6%(左上光源);夜里再加一条月光
    for (const [x0, wd, slant] of [
      [W * 0.46, W * 0.055, W * 0.07],
      [W * 0.7, W * 0.04, W * 0.055],
    ] as const) {
      g.fillStyle = "rgba(255,255,255,.06)";
      g.beginPath();
      g.moveTo(x0, sy);
      g.lineTo(x0 + wd, sy);
      g.lineTo(x0 + wd + slant, H);
      g.lineTo(x0 + slant, H);
      g.closePath();
      g.fill();
    }
    if (info && dayPhase() === "night") {
      g.fillStyle = "rgba(220,235,255,0.10)";
      g.beginPath();
      g.moveTo(W * 0.58, sy);
      g.lineTo(W * 0.7, sy);
      g.lineTo(W * 0.88, H);
      g.lineTo(W * 0.5, H);
      g.closePath();
      g.fill();
    }

    // 小气泡上浮(纯函数推位置;reduced 定格成静止层次)
    const reduced = reduceMotion();
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 1;
    for (let i = 0; i < FSH_TIMING.bubbleMax; i++) {
      const b = bubbleAt(i, ambient, reduced);
      const bx = W * 0.3 + b.fx * (W * 0.66);
      const by = H - 8 - b.rise * (H - 8 - (sy + 10));
      g.beginPath();
      g.arc(bx, by, b.r, 0, Math.PI * 2);
      g.stroke();
    }
  }

  /** ⑦ 水面:波光带两条(5200/6800ms 平移) + 浪花白边 + 水面细波 */
  function drawSurface(): void {
    if (!g) return;
    const sy = surfaceY();
    const reduced = reduceMotion();

    // 波光高光带两条:相位相反、周期不同,缓慢平移;reduced 静止
    for (const [periodMs, yOff, dir, width] of [
      [FSH_TIMING.waveMsA, 5, 1, 2.6],
      [FSH_TIMING.waveMsB, 10, -1, 2],
    ] as const) {
      const shift = waveShift(ambient, periodMs, reduced) * 52 * dir;
      g.strokeStyle = FSH_TOKENS.fshWave;
      g.lineWidth = width;
      g.beginPath();
      for (let x = 0; x <= W; x += 7) {
        const y = sy + yOff + Math.sin((x + shift) / 17) * 1.6;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    // 水面的小波纹(1.2 原有的那条白线,提到波光带上面)
    g.strokeStyle = "#ffffffb0";
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = sy + Math.sin((x / 26) + (reduced ? 0 : ambient / 420)) * 2.2;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    // 浪花白边:水面与岸交界处一排小泡
    const edge = W * 0.28;
    g.fillStyle = "rgba(255,255,255,.7)";
    for (const [dx, r] of [
      [-2, 2.6],
      [4, 1.8],
      [9, 1.2],
    ] as const) {
      g.beginPath();
      g.arc(edge + dx, sy + 1, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawBand(): void {
    if (!g) return;
    const y0 = yOfDepth(opts.band.from);
    const y1 = yOfDepth(opts.band.to);
    g.fillStyle = "#ffffff38";
    g.fillRect(0, y0, W, y1 - y0);
    g.strokeStyle = "#ffffffcc";
    g.lineWidth = 1.5;
    g.setLineDash([6, 5]);
    g.beginPath();
    g.moveTo(0, y0);
    g.lineTo(W, y0);
    g.moveTo(0, y1);
    g.lineTo(W, y1);
    g.stroke();
    g.setLineDash([]);
    // 标签垫一块圆角小牌,不再是裸文本(窗口 7 R1 修复 A-10:功能小字 ≥14px,牌随字加高)
    g.fillStyle = "rgba(47,111,158,.8)";
    const label = `鱼群带 ${opts.band.from}–${opts.band.to} 米`;
    g.beginPath();
    g.moveTo(4, y0 + 3);
    g.lineTo(4 + label.length * 14 + 10, y0 + 3);
    g.quadraticCurveTo(4 + label.length * 14 + 16, y0 + 3, 4 + label.length * 14 + 16, y0 + 12);
    g.quadraticCurveTo(4 + label.length * 14 + 16, y0 + 21, 4 + label.length * 14 + 10, y0 + 21);
    g.lineTo(4, y0 + 21);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = "600 14px system-ui,sans-serif";
    g.textAlign = "left";
    g.fillText(label, 8, y0 + 16);
  }

  /** ⑩ 深度刻度:做成一根木尺(刻度位置照旧吃 yOfDepth,只读) */
  function drawRuler(): void {
    if (!g) return;
    const sy = surfaceY();
    // 木尺条:右缘一根窄木条,上下顶到水域
    const wood = g.createLinearGradient(W - 30, 0, W - 2, 0);
    wood.addColorStop(0, "#e6c48c");
    wood.addColorStop(1, "#cfa468");
    g.fillStyle = wood;
    g.fillRect(W - 30, sy + 2, 28, H - sy - 4);
    g.strokeStyle = "#a97a44";
    g.lineWidth = 1;
    g.strokeRect(W - 30, sy + 2, 28, H - sy - 4);
    // 窗口 7 R1 修复 A-10:刻度数字提到 14px(功能小字底线)
    g.textAlign = "right";
    g.font = "700 14px system-ui,sans-serif";
    for (let d = 10; d <= MAX_DEPTH; d += 10) {
      const y = yOfDepth(d);
      g.strokeStyle = "#8a6234";
      g.beginPath();
      g.moveTo(W - 30, y);
      g.lineTo(W - 18, y);
      g.stroke();
      g.fillStyle = "#5f3f1e";
      g.fillText(`${d}m`, W - 4, y - 3);
    }
    g.textAlign = "left";
  }

  /** ⑤ 鱼群自绘:深水先画、浅水后画;游动坐标演算三行原样保留 */
  function drawSwimmers(): void {
    if (!g) return;
    const reduced = reduceMotion();
    const size = Math.round(clamp(W / 22, 13, 22));
    // 只排绘制次序,不动任何演算数据
    const order = [...swimmers].sort((a, b) => b.depth - a.depth);
    for (const s of order) {
      const x = ((s.x + (ambient / 1000) * s.speed) % 1 + 1) % 1;
      const px = 12 + x * (W - 46);
      const py = yOfDepth(s.depth) + Math.sin(ambient / 600 + s.x * 9) * 3;
      // 深水映射:饱和度 -30%、轮廓 alpha 0.7(读 depth 只做映射)
      const fade = depthFade(s.depth, MAX_DEPTH);
      // 水下落影一小片
      g.fillStyle = FSH_TOKENS.fshShadow;
      g.beginPath();
      g.ellipse(px, py + size * 0.42, size * 0.42, size * 0.12, 0, 0, Math.PI * 2);
      g.fill();
      drawKitFish(g, px, py, size, specForFish(s.fish.id, s.fish.rarity), {
        wagPhase: wagOf(px, s.speed, reduced),
        facing: facingOf(s.speed),
        satScale: fade.sat,
        alpha: 0.8 * fade.alpha,
      });
    }
  }

  function rodTip(): { x: number; y: number } {
    return { x: W * 0.34, y: surfaceY() - 10 };
  }

  /** ② 岸在左边:沙岸 + 草丛 + Q 版小人(草帽背影,拉杆时后仰 8°)+ 小桶 + 弯得动的鱼竿 */
  function drawShore(): void {
    if (!g) return;
    const sy = surfaceY();
    const shoreW = W * 0.28;
    const s = clamp(W / 360, 0.8, 1.5);

    // 沙岸台面:右缘圆润地探进水里
    g.fillStyle = FSH_TOKENS.fshShore;
    g.beginPath();
    g.moveTo(0, sy - 10);
    g.lineTo(shoreW - 12, sy - 10);
    g.quadraticCurveTo(shoreW + 4, sy - 8, shoreW + 2, sy + 3);
    g.lineTo(0, sy + 3);
    g.closePath();
    g.fill();
    // 台面草皮一条
    g.fillStyle = "#bcd9a4";
    g.fillRect(0, sy - 13, shoreW - 14, 4);
    // 草丛几撮
    g.strokeStyle = "#8fbf72";
    g.lineWidth = Math.max(1, 1.4 * s);
    for (const gx of [W * 0.035, W * 0.185, W * 0.255]) {
      for (const [dx, lift] of [
        [-3, 7],
        [0, 10],
        [3, 7],
      ] as const) {
        g.beginPath();
        g.moveTo(gx, sy - 12);
        g.quadraticCurveTo(gx + dx * s, sy - 12 - lift * s * 0.6, gx + dx * 1.6 * s, sy - 12 - lift * s);
        g.stroke();
      }
    }

    // Q 版钓鱼小人(背影):拉杆(蓄力 / 收线)时后仰 8°
    const kidX = W * 0.13;
    const feetY = sy - 12;
    const pulling = phase === "charge" || phase === "fight";
    g.save();
    g.translate(kidX, feetY);
    if (pulling) g.rotate((-8 * Math.PI) / 180);
    // 腿
    g.fillStyle = "#4a6f8f";
    g.fillRect(-4.6 * s, -8 * s, 3.4 * s, 8 * s);
    g.fillRect(1.2 * s, -8 * s, 3.4 * s, 8 * s);
    // 上衣(背影圆背)
    g.fillStyle = "#7fb9dd";
    g.beginPath();
    g.ellipse(0, -14 * s, 6.6 * s, 8 * s, 0, 0, Math.PI * 2);
    g.fill();
    // 握竿的小手
    g.fillStyle = "#f8d6b0";
    g.beginPath();
    g.arc(6.4 * s, -16 * s, 1.8 * s, 0, Math.PI * 2);
    g.fill();
    // 头 + 草帽(帽檐椭圆 + 帽顶,光源左上)
    g.beginPath();
    g.arc(0, -25 * s, 5 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ecc878";
    g.beginPath();
    g.ellipse(0, -28 * s, 8.2 * s, 2.6 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e0b860";
    g.beginPath();
    g.arc(0, -28.4 * s, 4.6 * s, Math.PI, Math.PI * 2);
    g.closePath();
    g.fill();
    g.restore();

    // 小桶(钓到的鱼进桶,桶口露条尾巴)
    const bx = W * 0.225;
    g.fillStyle = "#8fb3cf";
    g.beginPath();
    g.moveTo(bx - 7 * s, feetY - 12 * s);
    g.lineTo(bx + 7 * s, feetY - 12 * s);
    g.lineTo(bx + 5.4 * s, feetY);
    g.lineTo(bx - 5.4 * s, feetY);
    g.closePath();
    g.fill();
    g.strokeStyle = "#5f87a8";
    g.lineWidth = Math.max(1, 1.2 * s);
    g.beginPath();
    g.ellipse(bx, feetY - 12 * s, 7 * s, 2.2 * s, 0, 0, Math.PI * 2);
    g.stroke();
    if (inBucket) {
      // 桶口露出的鱼尾:用这条鱼自己的配色(「搬家做客」语义,全程开心)
      const spec = specForFish(inBucket.fish.id, inBucket.fish.rarity);
      g.fillStyle = fishColor(spec, 1, -6);
      g.beginPath();
      g.moveTo(bx, feetY - 12 * s);
      g.lineTo(bx - 4.4 * s, feetY - 19 * s);
      g.quadraticCurveTo(bx, feetY - 15 * s, bx + 4.4 * s, feetY - 19 * s);
      g.closePath();
      g.fill();
    }

    // 鱼竿:蓄力 / 拉扯时按弯曲量弓起来(映射 = 既有力度/张力的线性搬运,逐点一致)
    const tipPos = rodTip();
    const gripX = W * 0.15;
    const gripY = sy - 24;
    const bendK = phase === "charge" ? rodBendOf(power) : phase === "fight" ? rodBendOf(clamp(fight.tension, 0, 1)) : 0;
    const rodLen = Math.hypot(tipPos.x - gripX, tipPos.y - gripY);
    g.strokeStyle = "#8a5a33";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(gripX, gripY);
    g.quadraticCurveTo((gripX + tipPos.x) / 2, (gripY + tipPos.y) / 2 + bendK * rodLen, tipPos.x, tipPos.y);
    g.stroke();
  }

  function hookDepth(): number {
    if (phase === "sink") return depth * clamp(sinkTotal > 0 ? phaseMs / sinkTotal : 1, 0, 1);
    // 咬钩的那一下浮标往下一沉,沉的就是这几厘米
    if (phase === "bite") return depth + 1.2;
    if (phase === "wait" || phase === "fight") {
      // 拉扯时钩子随着进度往上走,看得见「快到岸了」
      const lift = phase === "fight" ? fight.progress * 0.75 : 0;
      return depth * (1 - lift);
    }
    if (phase === "charge") return 0;
    return 0;
  }

  /** 钩子的水平位置:抛得越远越靠右(2D 侧视图里看得见「甩出去多远」) */
  function hookX(): number {
    const left = W * 0.42;
    const right = W - 26;
    const t = clamp(dist / MAX_CAST_M, 0, 1);
    return left + (right - left) * t;
  }

  /** 钩子在不在水里(空中段 / 水下段 / 浮标共用的判断,只读 phase) */
  function hookInWater(): boolean {
    return phase === "sink" || phase === "wait" || phase === "bite" || phase === "fight";
  }

  /** 张力配色(空中段 / 水下段共用;不在拉扯时是安静的白) */
  function lineStroke(): { color: string; width: number } {
    const band = phase === "fight" && params ? tensionBand(fight.tension, params.redAt) : "green";
    return {
      color: band === "yellow" ? "#e8a02f" : band === "red" ? "#e04f74" : "#ffffffd8",
      width: band === "yellow" ? 2.4 : band === "red" ? 3 : 1.6,
    };
  }

  /** 小挂钩自绘:一段小 J 弯 */
  function drawHook(hx: number, hy: number): void {
    if (!g) return;
    g.strokeStyle = "#e8eef4";
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(hx, hy, 3.2, -Math.PI * 0.2, Math.PI * 0.9);
    g.stroke();
  }

  /** ⑥ 水下段钓线:入水点折射错位 2px 起笔、颜色变淡;鱼 / 钩画在末端 */
  function drawLineUnder(): void {
    if (!g || !hookInWater()) return;
    const hy = yOfDepth(hookDepth());
    const hx = hookX();
    const split = lineSplit(hx, surfaceY());
    const pen = lineStroke();
    g.save();
    g.globalAlpha = 0.55;
    g.strokeStyle = pen.color;
    g.lineWidth = pen.width;
    g.beginPath();
    g.moveTo(split.underX, split.entryY);
    g.quadraticCurveTo((split.underX + hx) / 2 + 3, (split.entryY + hy) / 2, hx, hy);
    g.stroke();
    g.restore();

    if (phase === "fight" && hooked) {
      const fsize = Math.round(clamp(W / 13, 22, 40));
      const shake = reduceMotion() ? 0 : Math.sin(ambient / 55) * (2 + fight.tension * 4);
      drawKitFish(g, hx + shake, hy, fsize, specForFish(hooked.id, hooked.rarity), {
        wagPhase: reduceMotion() ? 0 : ambient / 90,
        facing: -1,
      });
    } else if (phase === "bite" && hooked) {
      // 咬钩瞬间:它已经凑过来了——给一眼剪影,收线的决心更足
      drawHook(hx, hy);
      drawKitFish(g, hx + 9, hy + 2, Math.round(clamp(W / 16, 16, 28)), specForFish(hooked.id, hooked.rarity), {
        wagPhase: reduceMotion() ? 0 : ambient / 120,
        facing: -1,
        alpha: 0.6,
      });
    } else {
      drawHook(hx, hy);
    }
  }

  /** 红白双色浮标自绘:上钩时点头下沉 3px(160ms;功能提示,reduced 保留) */
  function drawBobber(bx: number, by: number): void {
    if (!g) return;
    const r = clamp(W / 70, 4, 6);
    g.fillStyle = FSH_TOKENS.fshBobberA;
    g.beginPath();
    g.arc(bx, by, r, Math.PI, Math.PI * 2);
    g.closePath();
    g.fill();
    g.fillStyle = FSH_TOKENS.fshBobberB;
    g.beginPath();
    g.arc(bx, by, r, 0, Math.PI);
    g.closePath();
    g.fill();
    g.strokeStyle = "#c04058";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(bx, by, r, 0, Math.PI * 2);
    g.stroke();
    // 顶上的小天线
    g.beginPath();
    g.moveTo(bx, by - r);
    g.lineTo(bx, by - r - 3);
    g.stroke();
  }

  /** ⑧ 空中段钓线:贝塞尔垂坠(拉扯时绷直)+ 浮标 */
  function drawLineAir(): void {
    if (!g) return;
    const tipPos = rodTip();
    if (phase === "aim" || phase === "show") {
      g.strokeStyle = "#ffffffcc";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(tipPos.x, tipPos.y);
      g.lineTo(tipPos.x + 4, surfaceY() + 4);
      g.stroke();
      return;
    }
    const hx = hookX();
    const split = lineSplit(hx, surfaceY());
    const pen = lineStroke();
    g.strokeStyle = pen.color;
    g.lineWidth = pen.width;
    // 垂坠:控制点往下坠一点;拉扯时张力越高越绷直
    const sag = phase === "fight" ? (1 - fight.tension) * 10 : 14;
    g.beginPath();
    g.moveTo(tipPos.x, tipPos.y);
    g.quadraticCurveTo((tipPos.x + split.entryX) / 2, (tipPos.y + split.entryY) / 2 + sag, split.entryX, split.entryY);
    g.stroke();

    if (hookInWater()) {
      const inBite = phase === "bite";
      const dip = bobberDipPx(inBite ? phaseMs : 0, inBite, reduceMotion());
      drawBobber(split.entryX, split.entryY - 2 + dip);
    }
  }

  /** 蓄力时的落点预览:横线是深度,竖线是距离,箭头是风 */
  function drawAim(): void {
    if (!g || phase !== "charge") return;
    const aimDist = castDistance(power, wind);
    const aimDepth = depthAtDistance(aimDist);
    const y = yOfDepth(aimDepth);
    const x = W * 0.42 + (W - 26 - W * 0.42) * clamp(aimDist / MAX_CAST_M, 0, 1);
    g.strokeStyle = "#e04f74";
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.moveTo(x, surfaceY());
    g.lineTo(x, y);
    g.stroke();
    g.setLineDash([]);
    // 窗口 7 R1 修复 A-10:瞄准提示与风向标都是功能小字,统一 ≥14px
    g.fillStyle = "#b23a63";
    g.font = "700 14px system-ui,sans-serif";
    g.textAlign = "left";
    g.fillText(`松手 → ${aimDist.toFixed(1)} 米远 · ${aimDepth.toFixed(1)} 米深`, 8, y - 5);
    g.textAlign = "center";
    g.font = "700 14px system-ui,sans-serif";
    g.fillStyle = "#3f6f92";
    g.fillText(windArrow(wind), x, surfaceY() - 8);
  }

  /**
   * 相位观察哨:只读 phase / inBucket,把「入水 / 上钩窗口 / 钓起」翻译成
   * 涟漪 / 水花 / 鱼跃 / 星屑这些纯视觉粒子。不写任何玩法状态。
   */
  function observeFx(): void {
    const now = ambient;
    const reduced = reduceMotion();
    const sy = surfaceY();
    if (phase !== fxPhase) {
      const prev = fxPhase;
      fxPhase = phase;
      // 抛出去落水的那一下 / 上钩窗口开启的那一下:都值一圈涟漪
      if (phase === "sink" || phase === "bite") fx.spawnRipple(hookX(), sy, now);
      if (phase === "show" && prev === "fight" && inBucket) {
        // 收获仪式:鱼跃出水面沿弧线进桶 + 水花皇冠 + 星屑;稀有(▲/★)再加金光
        const rare = tierIndexOf(inBucket.fish.rarity) >= 2;
        fx.startLeap(hookX(), sy, W * 0.225, sy - 34, now, rare, inBucket.fish.id, inBucket.fish.rarity);
        if (!reduced) fx.spawnSplash(hookX(), sy, now);
        stars.spawn(W * 0.225, sy - 40, reduced, 10);
        stars.spawn(W * 0.19, sy - 26, reduced, 7);
        stars.spawn(W * 0.26, sy - 22, reduced, 6);
      }
    }
    // 钩在水里就按间隔冒圈;上钩窗口内加密 2 倍(只读窗口,不改判定)
    if (!reduced && (phase === "wait" || phase === "bite")) {
      if (now - fx.lastRippleAt >= rippleGapMs(phase === "bite")) fx.spawnRipple(hookX(), sy, now);
    }
  }

  /** ⑨ 涟漪 / 水花皇冠 / 鱼跃弧线 / 星屑 / 稀有金光 */
  function drawFx(): void {
    if (!g) return;
    const now = ambient;
    const reduced = reduceMotion();
    fx.prune(now);

    // 涟漪:ease-out 扩散圆环;reduced 只在上钩窗口画一枚静态圆环(提示保留)
    if (reduced) {
      if (phase === "bite") {
        const sy = surfaceY();
        g.strokeStyle = "rgba(255,255,255,.6)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.ellipse(hookX(), sy, 12, 4, 0, 0, Math.PI * 2);
        g.stroke();
      }
    } else {
      for (const rp of fx.ripples) {
        const ring = rippleRing((now - rp.bornAt) / FSH_TIMING.rippleMs);
        const rr = 16 * ring.k;
        g.strokeStyle = `rgba(255,255,255,${ring.alpha.toFixed(3)})`;
        g.lineWidth = 1.5;
        g.beginPath();
        g.ellipse(rp.x, rp.y, rr, rr * 0.32, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // 水花皇冠 5 瓣(reduced 根本不会生成)
    for (const sp of fx.splashes) {
      const t = (now - sp.bornAt) / FSH_TIMING.splashMs;
      const reach = clamp(W / 16, 16, 26);
      g.fillStyle = "rgba(255,255,255,.85)";
      for (let i = 0; i < FSH_TIMING.splashDrops; i++) {
        const d = splashDropAt(i, t);
        g.beginPath();
        g.ellipse(sp.x + d.dx * reach, sp.y + d.dy * reach, d.r * 8, d.r * 11, 0, 0, Math.PI * 2);
        g.fill();
      }
    }

    // 鱼跃弧线进桶(240ms ease-out;reduced 瞬移展示);稀有金光 260ms 一闪
    if (fx.leap && inBucket) {
      const lp = fx.leap;
      const t = (now - lp.bornAt) / FSH_TIMING.leapMs;
      const p = leapPoint(lp.fromX, lp.fromY, lp.toX, lp.toY, t, reduced);
      const gold = lp.rare ? goldFlashAlpha(now - lp.bornAt, reduced) : 0;
      drawKitFish(g, p.x, p.y, Math.round(clamp(W / 15, 20, 32)), specForFish(lp.fishId, lp.rarity), {
        wagPhase: reduced ? 0 : ambient / 70,
        facing: -1,
        goldEdge: gold,
      });
    }

    // 星屑(kit 的白闪星花:reduced 自动只留 1 帧功能反馈)
    stars.draw(g);
  }

  function render(): void {
    if (!g) return;
    observeFx();
    g.clearRect(0, 0, W, H);
    drawBackdrop();
    drawShore();
    drawWater();
    drawSwimmers();
    drawLineUnder();
    drawSurface();
    drawLineAir();
    drawFx();
    drawBand();
    drawRuler();
    drawAim();
  }

  // ---- HUD -----------------------------------------------------------------

  function refreshHud(): void {
    if (opts.level) {
      chipGoal.textContent = `🎯 ${progressText(opts.level, log)}`;
    } else {
      chipGoal.textContent = `🎯 ${log.score} 分`;
    }
    // 竖屏一行只放得下三四个 chip:竿数并进时间那一格,连击没起来时干脆不占位置
    const casts = Number.isFinite(castsLeft) ? ` · 🎣 ${castsLeft} 竿` : "";
    chipTime.textContent = totalMs > 0 ? `⏱ ${formatClock(remainMs)}${casts}` : `🎣 ${log.count} 条`;
    chipTime.className = totalMs > 0 && remainMs <= 10_000 ? "fs-chip fs-chip--warn" : "fs-chip";
    chipCombo.hidden = combo <= 0;
    chipCombo.textContent = `🔥 连击 ×${comboMultiplier(combo).toFixed(1)}`;

    const redAt = params ? params.redAt : bonus.warnAt;
    const band = phase === "fight" ? tensionBand(fight.tension, redAt) : "green";
    tensionFill.style.width = `${clamp(fight.tension, 0, 1) * 100}%`;
    tensionFill.className = `fs-fill fs-fill--${
      phase !== "fight" ? "slack" : band === "yellow" ? "tight" : band === "red" ? "danger" : band === "slack" ? "slack" : "tension"
    }`;
    bandMarkEl.textContent = phase === "fight" ? bandMark(band) : " ";
    bandMarkEl.className = `fss-mark fss-mark--${band === "slack" ? "green" : band}`;
    pullFill.style.width = `${(phase === "charge" ? power : phase === "fight" ? fight.progress : 0) * 100}%`;

    // 预警条:浮标越好亮得越早(还没进红区就先出现),进了红区才真的开始走倒计时
    const inRed = phase === "fight" && params !== null && fight.tension >= bonus.warnAt;
    redBar.hidden = !inRed;
    if (inRed && params) {
      const ratio = redRatio(fight, params);
      redFill.style.width = `${ratio * 100}%`;
      redBar.className = ratio > 0.45 && !reduceMotion() ? "fss-redbar fss-shake" : "fss-redbar";
    }

    // 风向永远看得见:抛之前就能算准这一竿会被吹到哪儿
    windChip.innerHTML = "";
    windChip.append(el("b", "", windArrow(wind)), document.createTextNode(` ${windText(wind)}`));
    if (opts.daylight) {
      const info = PHASE_INFO[dayPhase()];
      const left = Math.ceil(untilNightMs(totalMs - remainMs, totalMs) / 1000);
      phaseChip.textContent = `${info.emoji} ${info.name}${left > 0 ? ` · 距天黑 ${left} 秒` : " · 天黑了"}`;
    }

    if (phase === "aim") {
      actBtn.textContent = "🎣 按住抛竿";
      actBtn.className = "fs-act fss-act";
    } else if (phase === "charge") {
      actBtn.textContent = "✋ 松手抛出";
      actBtn.className = "fs-act fss-act";
    } else if (phase === "fight") {
      actBtn.textContent = holding ? "🪝 收线中…" : "🪝 按住收线";
      actBtn.className = "fs-act fss-act fs-act--reel";
    } else {
      actBtn.textContent =
        phase === "show" ? "👀 看看它(按一下继续)" : phase === "bite" ? "❗ 咬钩了,按住!" : "🌊 等咬钩…";
      actBtn.className = `fs-act fss-act${phase === "bite" ? " fs-act--reel" : " fs-act--wait"}`;
    }

    // 手上这一条:演出结束以后按钮还留着,来得及决定放不放
    showRow.hidden = inBucket === null;
    if (inBucket) {
      showLabel.textContent = `🪣 ${inBucket.fish.emoji} ${inBucket.fish.name} · ${formatLength(inBucket.cm)} · ${formatWeight(inBucket.kg)}`;
    }

    if (phase === "charge") {
      const aimDist = castDistance(power, wind);
      tip.textContent = `力度 ${(power * 100).toFixed(0)}% · 甩出 ${aimDist.toFixed(1)} 米 · ${depthLabel(depthAtDistance(aimDist))}`;
    } else if (phase === "sink") tip.textContent = `钩子正在下沉…${depthLabel(depth)}`;
    else if (phase === "wait") tip.textContent = `${depthLabel(depth)} · 静静地等一会儿`;
    else if (phase === "bite" && hooked) tip.textContent = `❗ 浮标沉下去了!${PATTERN_INFO[patternOf(hooked)].mark} 准备收线`;
    else if (phase === "fight" && hooked) {
      tip.textContent = `${hooked.emoji} ${hooked.name}(${PATTERN_INFO[patternOf(hooked)].name})· ${bandTip(band)}`;
    } else if (phase === "show") tip.textContent = showText;
    else tip.textContent = opts.hint;
  }

  function say(text: string): void {
    live.textContent = text;
  }

  // ---- 流程 -----------------------------------------------------------------

  function startCast(): void {
    dist = castDistance(power, wind);
    depth = depthAtDistance(dist);
    castsLeft -= 1;
    inBucket = null;
    sinkTotal = sinkMs(depth);
    phase = "sink";
    phaseMs = 0;
    opts.sfx("pop");
    say(`抛出 ${dist.toFixed(1)} 米,落在 ${depthLabel(depth)}`);
  }

  function startBite(): void {
    // 落点越远越容易碰上稀有鱼,再叠上鱼饵与鱼群带的加成
    const luck =
      (inBand(depth, opts.band) ? BAND_LUCK : -0.55) + distanceLuck(dist) + bonus.luck;
    hooked = opts.daylight ? pickFishAtPhase(depth, rand, dayPhase(), luck) : pickFish(depth, rand, luck);
    params = fightParams(hooked, opts.hardness, bonus.snapAt);
    fight = newFight();
    // 先给一个反应窗口:浮标沉一下、响一声,手再动也来得及
    phase = "bite";
    phaseMs = 0;
    opts.sfx("pop");
    say(`浮标沉下去了!${hooked.name} 咬钩,准备收线`);
  }

  function startFight(): void {
    phase = "fight";
    phaseMs = 0;
    opts.sfx("jump");
  }

  function afterShow(): void {
    if (finished) return;
    if (opts.level && goalMet(opts.level, log)) {
      finish(true, "goal");
      return;
    }
    if (castsLeft <= 0) {
      finish(false, "casts");
      return;
    }
    phase = "aim";
    phaseMs = 0;
    chargeMs = 0;
    power = 0;
    // 下一竿换一阵风
    wind = rollWind(rand);
  }

  function landFish(): void {
    const fish = hooked;
    if (!fish) return;
    const perfect = isPerfectCatch(fight);
    const gained = catchScore(fish, { combo, perfect, inBand: inBand(depth, opts.band) });
    // 每一条的体长都不一样,体重跟着体长走 —— 图鉴记的就是这个「最大的一条」
    const cm = rollLengthCm(fish, rand());
    const kg = weightForLength(fish, cm);
    log = {
      count: log.count + 1,
      score: log.score + gained,
      weight: log.weight + kg,
      species: log.species.includes(fish.id) ? log.species : [...log.species, fish.id],
    };
    combo += 1;
    if (!bestFish || kg > bestKg) {
      bestFish = fish;
      bestKg = kg;
    }
    const mark = rememberFish(fish.id, cm);
    inBucket = { fish, cm, kg, score: gained, isNew: mark.isNew, isBiggest: mark.isBiggest };
    opts.sfx("coin");
    showText = `${fish.emoji} ${fish.name} · ${formatLength(cm)} · ${formatWeight(kg)} · +${gained} 分${
      perfect ? " · 完美收竿!" : ""
    }${mark.isNew ? " · 图鉴新收录!" : mark.isBiggest ? " · 刷新最大尺寸!" : ""}`;
    say(showText);
    opts.onCatch?.(inBucket);
    phase = "show";
    phaseMs = 0;
  }

  /** 把手上这一条放回水里:图鉴照样记着,第一次放生还有额外的星星 */
  function letGo(): void {
    const caught = inBucket;
    if (!caught || finished) return;
    inBucket = null;
    released += 1;
    const out = releaseFish(caught.fish.id);
    opts.sfx("meow");
    showText = `💧 ${caught.fish.name} 摆摆尾巴游走了${out.firstRelease ? ",朵朵给你记了一颗星星" : ""}。`;
    say(showText);
    opts.onRelease?.(caught.fish, out.firstRelease);
    refreshHud();
  }

  function loseFish(reason: "snapped" | "escaped"): void {
    lost += 1;
    combo = 0;
    opts.sfx("oops");
    showText =
      reason === "snapped"
        ? "线断啦!张力冲到红区就要立刻松手。"
        : "鱼跑啦!线松太久它就甩钩了,松一下就要马上再收。";
    say(showText);
    phase = "show";
    phaseMs = 0;
  }

  function finish(won: boolean, reason: RunResult["reason"]): void {
    if (finished) return;
    finished = true;
    holding = false;
    opts.onDone({
      won,
      reason,
      log,
      secondsLeft: Math.max(0, Math.round(remainMs / 1000)),
      castsLeft: Number.isFinite(castsLeft) ? castsLeft : 0,
      lost,
      bestFish,
      bestKg: Math.round(bestKg * 100) / 100,
      released,
    });
  }

  // ---- 主循环 ---------------------------------------------------------------

  let raf = 0;
  let last = 0;
  /** 距上一次重新量可视高过了多久(毫秒) */
  let sinceFit = 0;

  function tick(dt: number): void {
    ambient += dt;
    if (totalMs > 0) remainMs = Math.max(0, remainMs - dt);

    switch (phase) {
      case "aim":
        if (holding) {
          phase = "charge";
          chargeMs = 0;
          power = 0;
        }
        break;
      case "charge":
        chargeMs += dt;
        power = chargePower(chargeMs, CHARGE_CYCLE_MS);
        if (!holding) startCast();
        break;
      case "sink":
        phaseMs += dt;
        if (phaseMs >= sinkTotal) {
          phase = "wait";
          phaseMs = 0;
          waitMs = biteDelayMs(rand, depth);
        }
        break;
      case "wait":
        phaseMs += dt;
        if (phaseMs >= waitMs) startBite();
        break;
      case "bite":
        // 反应窗口:这 0.4 秒(浮标越好越长)里张力还没开始涨
        phaseMs += dt;
        if (phaseMs >= biteWindow) startFight();
        break;
      case "fight": {
        if (!params) break;
        const before = fight.tension;
        fight = stepFight(fight, params, holding, dt);
        if (before < TIGHT_AT && fight.tension >= TIGHT_AT) opts.sfx("tap");
        // 进红区响一声:1.2 秒的倒计时从这一刻开始
        if (before < params.redAt && fight.tension >= params.redAt) opts.sfx("oops");
        if (fight.status === "landed") landFish();
        else if (fight.status === "snapped") loseFish("snapped");
        else if (fight.status === "escaped") loseFish("escaped");
        break;
      }
      case "show":
        phaseMs += dt;
        if (phaseMs >= SHOW_MS) afterShow();
        break;
      default:
        break;
    }

    // 拉扯途中时间到:先把这一条拉完再结算,不半路把手上的鱼掐掉
    if (totalMs > 0 && remainMs <= 0 && phase !== "fight" && !finished) {
      finish(opts.level ? goalMet(opts.level, log) : true, "time");
    }
  }

  function frame(now: number): void {
    ledger.dropRaf(raf);
    raf = ledger.raf(requestAnimationFrame(frame));
    const dt = last === 0 ? 16 : clamp(now - last, 0, 120);
    last = now;
    // 壳层落位、转屏、字体加载都会改变可视高。隔一会儿量一次,变了才重排(layout 幂等)。
    sinceFit += dt;
    if (sinceFit >= REFIT_MS) {
      sinceFit = 0;
      refitNow();
    }
    if (!paused && !finished) tick(dt);
    render();
    refreshHud();
    // 上鱼那一下这一屏会当场长高:提示行换成一长串「🐟 名字 · 12.3 厘米 · +30 分」,
    // HUD 那排小药丸在 320px 宽上再多折一行 —— 真机 320×640 上量到 chrome 182→224。
    // 长出去的那一截被 .game-stage(定高 + overflow:hidden,平台文件,交窗口1)硬裁,
    // 「🎣 按住抛竿」的中心落到 y=642、裁切线在 626,elementFromPoint 返回 null,
    // 而 .fs-wrap 只能滚 3px 等于滚不动。上面那条 REFIT_MS 要 300ms 才收回来,
    // 那 300ms 里孩子按不着唯一的操作键。所以高度一变就当帧重排,周期性那条留着兜底。
    const nowWrapH = wrap.getBoundingClientRect?.().height ?? 0;
    if (needsImmediateRefit(lastWrapH, nowWrapH)) {
      sinceFit = 0;
      refitNow();
      // layout() 会重设画布尺寸,等于把画面擦了,得补画一次
      render();
      lastWrapH = wrap.getBoundingClientRect?.().height ?? nowWrapH;
    }
    // 换一次相位 = 这颗键换了一件事要孩子做(抛竿 → 收线 → 看看它 → 再抛竿)。
    //
    // 光认相位不够。上鱼那一下这一屏**不是一帧长完的**:提示行先换成
    // 「🍬 棉花糖鲶 · 39.1 厘米 · 1.1 千克 · +27 分 · 完美收竿!」,过一会儿再追一句
    // 「· 图鉴新收录!」多折一行 —— 真机 320×568 上量到内容 356 → 359,
    // 只在换相位那一帧送一次会停在 30/33,「👀 看看它」的下沿仍旧被裁掉 2.6px。
    //
    // 而钳过之后 wrap 自己的高度被 maxHeight 焊死,上面那条 needsImmediateRefit()
    // 和 capWrap() 的钳位值**都不会再变** —— 这一屏还在长高这件事,
    // 只有 scrollHeight 说得出来。所以内容高度也算一次布局事件。
    // (滚动不改 scrollHeight,这一条不会自己追自己。)
    const nowContentH = wrap.scrollHeight;
    if (phase !== lastActPhase || needsImmediateRefit(lastContentH, nowContentH)) {
      lastActPhase = phase;
      lastContentH = nowContentH;
      sendActIntoView();
    }
    if (finished) ledger.dropRaf(raf);
  }
  raf = ledger.raf(requestAnimationFrame(frame));

  // ---- 暂停 -----------------------------------------------------------------

  let veil: HTMLElement | null = null;

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    holding = false;
    if (paused) {
      veil = el("div", "fs-veil");
      veil.append(
        el("div", "fs-veil-t", "⏸ 暂停一下"),
        el("div", "fs-veil-s", "喝口水、揉揉手指,回来接着钓。按 Esc 也能继续。")
      );
      const row = el("div", "fs-veil-btns");
      const go = button("fs-btn", "▶ 继续");
      go.addEventListener("click", () => {
        opts.sfx("tap");
        togglePause();
      });
      row.appendChild(go);
      veil.appendChild(row);
      wrap.appendChild(veil);
      go.focus?.();
      pauseBtn.textContent = "▶ 继续";
      say("已暂停");
    } else {
      veil?.remove();
      veil = null;
      pauseBtn.textContent = "⏸ 暂停";
      last = 0;
      say("继续钓鱼");
    }
  }

  // ---- 图鉴收录 --------------------------------------------------------------

  function rememberFish(id: string, cm: number): { isNew: boolean; isBiggest: boolean } {
    const out = recordCatch(readDex(), { id, cm, at: Date.now() });
    writeDex(out.book);
    return { isNew: out.isNew, isBiggest: out.isBiggest };
  }

  function releaseFish(id: string): { firstRelease: boolean } {
    const out = markReleased(readDex(), id);
    writeDex(out.book);
    return { firstRelease: out.firstRelease };
  }

  refreshHud();
  render();

  return {
    destroy() {
      finished = true;
      holding = false;
      // rAF、定时器、全部监听都登记在册,这一句把它们一次性还清(还完计数归零)
      ledger.releaseAll();
      // 1.3 视觉粒子(涟漪 / 水花 / 鱼跃 / 星屑)同步归零
      fx.reset();
      stars.clear();
      veil?.remove();
      veil = null;
      wrap.remove();
    },
  };
}

/** 尊重系统的「减少动态效果」:关掉抖动与震动条 */
function reduceMotion(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return typeof mm === "function" && mm("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 图鉴存档
// ---------------------------------------------------------------------------

/** 读图鉴:v2 为准,1.1 那份 id 列表自动并进来(老玩家的收录不会丢) */
function readDex(): DexBook {
  try {
    return parseDexBook(localStorage.getItem(DEX2_KEY), localStorage.getItem(DEX_KEY));
  } catch {
    return emptyDex();
  }
}

function writeDex(book: DexBook): void {
  try {
    localStorage.setItem(DEX2_KEY, serializeDexBook(book));
  } catch {
    // 隐私模式写不进去也不影响这一次游玩
  }
}

// ---------------------------------------------------------------------------
// 装备存档
// ---------------------------------------------------------------------------

function readGear(): GearSet {
  try {
    return parseGear(localStorage.getItem(GEAR_KEY));
  } catch {
    return emptyGear();
  }
}

function writeGear(gear: GearSet): void {
  try {
    localStorage.setItem(GEAR_KEY, serializeGear(gear));
  } catch {
    // 存不进去就是这一次没升成,不影响继续钓
  }
}

// ---------------------------------------------------------------------------
// 随机源
// ---------------------------------------------------------------------------

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 无尽模式每局换一串随机数,免得每次都钓到同样的顺序 */
function mulberryNow(): () => number {
  return mulberry((Date.now() & 0x7fffffff) ^ 0x5bf03635);
}

// ---------------------------------------------------------------------------
// 闯关的一关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const level = buildLevel(ctx.level);
  const box = el("div");
  stage.append(box);

  let run: Runner | null = null;

  run = createRun(box, {
    level,
    band: level.band,
    seconds: level.seconds,
    casts: level.casts,
    hardness: level.hardness,
    gear: readGear(),
    // 目标与鱼群带都挤在这一行:竖屏上每省一行,大按钮就多一分留在首屏里
    hint: `${goalText(level)} · ${bandText(level)}`,
    sfx: ctx.sfx,
    onCatch: (info) => {
      if (info.isNew) ctx.bonusStars(1);
    },
    // 温柔一点也有回报:每一种鱼第一次被放回水里给一颗星星
    onRelease: (_fish, firstRelease) => {
      if (firstRelease) ctx.bonusStars(1);
    },
    onDone: (res) => {
      if (res.won) {
        ctx.win(
          rateLevel(level, { secondsLeft: res.secondsLeft, lost: res.lost, castsLeft: res.castsLeft }),
          `${goalText(level)} 完成!一共钓上 ${res.log.count} 条,${
            res.bestFish ? `最大的是 ${res.bestFish.name}(${formatWeight(res.bestKg)})。` : "手感很稳。"
          }${res.released > 0 ? `还放生了 ${res.released} 条。` : ""}`
        );
      } else {
        ctx.lose(`${loseLine(res.reason === "time" ? "time" : "casts")}(这一关已经完成 ${goalValue(level, res.log)}/${level.need})`);
      }
    },
  });

  return {
    destroy() {
      run?.destroy();
      run = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 模式外壳(无尽 / 图鉴共用)
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "fs-mode");
  const head = el("div", "fs-mhead");
  const back = button("fs-back", "◀ 回选关");
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "fs-chip", title);
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
  buttons: { label: string; ghost?: boolean; onClick: () => void }[]
): void {
  stage.innerHTML = "";
  const box = el("div", "fs-veil");
  box.style.position = "static";
  box.append(el("div", "fs-veil-t", title), el("div", "fs-veil-s", sub));
  const row = el("div", "fs-veil-btns");
  for (const b of buttons) {
    const btn = button(`fs-btn${b.ghost ? " fs-btn--ghost" : ""}`, b.label);
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 无尽「钓到天黑」:晨 → 昼 → 黄昏 → 夜,鱼群跟着换班,按总重量计分
// ---------------------------------------------------------------------------

const ENDLESS_TITLE = "🌙 钓到天黑";

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, ENDLESS_TITLE);
  let run: Runner | null = null;

  function refreshChip(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    shell.chip.textContent = best > 0 ? `${ENDLESS_TITLE} · 最好 ${best} 千克` : ENDLESS_TITLE;
  }

  function start(): void {
    run?.destroy();
    shell.stage.innerHTML = "";
    refreshChip();
    run = createRun(shell.stage, {
      band: { from: 0, to: MAX_DEPTH },
      seconds: Math.round(ENDLESS_MS / 1000),
      casts: 0,
      hardness: 0.5,
      gear: readGear(),
      daylight: true,
      hint: `从${PHASE_INFO.dawn.name}钓到${PHASE_INFO.night.name},比的是水桶里的总重量。天越黑,深处的大家伙越愿意上浮。`,
      sfx: (n) => api.play(n),
      onCatch: (info) => {
        if (info.isNew) api.addStars(1);
      },
      onRelease: (_fish, firstRelease) => {
        if (firstRelease) api.addStars(1);
      },
      onDone: (res) => {
        run?.destroy();
        run = null;
        const kg = Math.round(res.log.weight * 10) / 10;
        const best = save.recordEndlessBest(meta.id, kg);
        api.play(kg > 0 ? "win" : "oops");
        if (kg >= 25) api.addStars(1);
        overBox(
          shell.stage,
          `🏁 ${weightRank(kg)} · ${formatWeight(kg)}`,
          `一天里钓上 ${res.log.count} 条,${
            res.bestFish ? `最大的一条是 ${res.bestFish.emoji} ${res.bestFish.name}(${formatWeight(res.bestKg)})。` : ""
          }${res.released > 0 ? `放生了 ${res.released} 条。` : ""}${endlessLine(kg, res.log.count)}历史最好 ${best} 千克。`,
          [
            {
              label: "🔁 再来一局",
              onClick: () => {
                api.play("tap");
                start();
              },
            },
            {
              label: "◀ 回选关",
              ghost: true,
              onClick: () => {
                api.play("tap");
                onBack();
              },
            },
          ]
        );
      },
    });
  }

  start();

  return {
    destroy() {
      run?.destroy();
      run = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 图鉴页
// ---------------------------------------------------------------------------

function mountDex(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const book = readDex();
  const stats = dexStats(book);
  const shell = makeShell(host, api, onBack, `📖 鱼类图鉴 · ${stats.found}/${stats.total}`);

  const head = el(
    "div",
    "fs-dexhead",
    `已经认识 ${stats.found} 种鱼,收录度 ${stats.percent}%。${
      stats.released > 0 ? `放生过 ${stats.released} 条。` : ""
    }没见过的先钓上来才会亮。`
  );

  // 按水层看还是按稀有度看,两种翻法
  const tabs = el("div", "fss-tabs");
  const grid = el("div", "fs-dex");
  let mode: "layer" | "tier" = "layer";

  function card(fish: Fish): HTMLElement {
    const known = dexHas(book, fish.id);
    const entry = dexEntry(book, fish.id);
    const node = el("div", `fs-card${known ? "" : " fs-card--locked"}`);
    const tierEl = el("div", "fss-tier", tierLabel(fish.rarity));
    tierEl.style.color = RARITY_TIERS[tierIndexOf(fish.rarity)].color;
    node.append(
      el("div", "fs-cname", known ? `${fish.emoji} ${fish.name}` : "❔ 还没见过"),
      tierEl,
      el("div", "fs-crare", rarityStars(fish.rarity))
    );
    if (known && entry) {
      node.append(
        el("div", "fs-cmeta", `${LAYERS[fish.layer].name} · 标准 ${formatLength(baseLengthCm(fish))}`),
        el("div", "fss-cdex", `${firstCatchText(entry)} · 钓到过 ${entry.caught} 条`),
        el("div", "fss-cdex", bestSizeText(fish, entry)),
        el("div", "fss-cdex", `挣扎节奏:${PATTERN_INFO[patternOf(fish)].mark} ${PATTERN_INFO[patternOf(fish)].name}`),
        el("div", "fs-cnote", fish.note)
      );
    } else {
      node.append(
        el("div", "fs-cmeta", LAYERS[fish.layer].name),
        el("div", "fs-cnote", "在这一层多抛几竿,说不定就碰上它了。")
      );
    }
    return node;
  }

  function fill(): void {
    grid.innerHTML = "";
    if (mode === "layer") {
      for (let layer = 0; layer < LAYERS.length; layer++) {
        grid.appendChild(
          el("div", "fs-layerhead", `${LAYERS[layer].emoji} ${LAYERS[layer].name}(${LAYERS[layer].from}–${LAYERS[layer].to} 米)`)
        );
        for (const fish of FISH.filter((f) => f.layer === layer)) grid.appendChild(card(fish));
      }
    } else {
      for (let i = 0; i < RARITY_TIERS.length; i++) {
        const tier = RARITY_TIERS[i];
        const group = FISH.filter((f) => tierIndexOf(f.rarity) === i);
        grid.appendChild(el("div", "fs-layerhead", `${tier.mark} ${tier.name}(${stats.byTier[i]}/${group.length})· ${tier.desc}`));
        for (const fish of group) grid.appendChild(card(fish));
      }
    }
  }

  for (const [key, label] of [
    ["layer", "🌊 按水层"],
    ["tier", "★ 按稀有度"],
  ] as const) {
    const btn = button("fss-tab", label);
    btn.setAttribute("aria-pressed", key === mode ? "true" : "false");
    btn.addEventListener("click", () => {
      api.play("tap");
      mode = key;
      for (const other of Array.from(tabs.children)) {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      }
      fill();
    });
    tabs.appendChild(btn);
  }

  fill();
  shell.stage.append(head, tabs, grid);

  return { destroy: () => shell.destroy() };
}

// ---------------------------------------------------------------------------
// 装备页:只花打关攒下来的星星,没有货币也没有内购
// ---------------------------------------------------------------------------

function mountGear(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "🎒 我的装备");
  let gear = readGear();

  const bar = el("div", "fss-gbar");
  const list = el("div", "fss-gear");
  shell.stage.append(bar, list);

  function refresh(): void {
    const stars = api.getStars();
    const bonus = gearBonus(gear);
    assertGearCaps(bonus);
    shell.chip.textContent = `🎒 我的装备 · ⭐ ${stars}`;
    bar.textContent = `⭐ 星星 ${stars} 颗 · 现在带着:${gearSummary(gear)}。星星是闯关和图鉴收录攒的,花完还能再攒。`;

    list.innerHTML = "";
    for (const kind of GEAR_KINDS) {
      const spec = GEAR[kind];
      const lv = gear[kind];
      const cost = nextCost(gear, kind);
      const cardEl = el("div", "fss-gcard");
      const top = el("div", "fss-gtop");
      top.append(
        el("div", "fss-gname", `${spec.emoji} ${spec.name} · ${spec.steps[lv].name}`),
        el("div", "fss-glv", lv >= MAX_GEAR_LEVEL ? "已满级" : `Lv.${lv}/${MAX_GEAR_LEVEL}`)
      );
      const buy = button("fss-gbuy", cost === null ? "已满级" : `⭐ ${cost} 升级`);
      buy.disabled = cost === null || stars < cost;
      buy.addEventListener("click", () => {
        const out = upgrade(gear, kind, api.getStars());
        if (out.spent <= 0) return;
        gear = out.gear;
        writeGear(gear);
        api.addStars(-out.spent);
        api.play("coin");
        refresh();
      });
      top.appendChild(buy);
      cardEl.append(top, el("div", "fss-gwhat", spec.what), el("div", "fss-gnote", spec.steps[lv].note));
      if (cost !== null) {
        cardEl.appendChild(el("div", "fss-gnote", `下一级「${spec.steps[lv + 1].name}」:${spec.steps[lv + 1].note}`));
      }
      list.appendChild(cardEl);
    }
  }

  refresh();
  return { destroy: () => shell.destroy() };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  ensureCss(api.root);
  const root = el("div");
  const bar = el("div", "fs-bar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = button("fs-open fs-open--endless", ENDLESS_TITLE);
  const dexBtn = button("fs-open fs-open--dex", "📖 鱼类图鉴");
  const gearBtn = button("fs-open fss-open--gear", "🎒 我的装备");
  bar.append(endlessBtn, dexBtn, gearBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `${ENDLESS_TITLE} · 最好 ${best} 千克` : ENDLESS_TITLE;
    const stats = dexStats(readDex());
    dexBtn.textContent = `📖 鱼类图鉴 · ${stats.found}/${stats.total}`;
    gearBtn.textContent = `🎒 我的装备 · ⭐ ${api.getStars()}`;
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
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
  dexBtn.addEventListener("click", () => openMode(mountDex));
  gearBtn.addEventListener("click", () => openMode(mountGear));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开钓的时候把模式条收起来:手机竖屏上这一行正好够张力条和大按钮同框
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) bar.hidden = false;
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "抛竿看水层,收线看张力:一收一放才是最快的。",
      grandMessage: "188 关全部通关,这片水域最会看张力的人就是你!",
      guideTitle: "钓鱼小达人 · 手感手册",
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
