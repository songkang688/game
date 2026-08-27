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

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.fs-wrap{--fs-ink:#3f5670;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--fs-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;position:relative;}
.fs-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.fs-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(90,130,160,.18);}
.fs-chip b{font-weight:900;color:#1f6f9c;}
.fs-chip--goal{background:#e6f5ff;color:#1f6f9c;}
.fs-chip--warn{background:#ffe8ee;color:#b23a63;}
.fs-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#5aa9d6,#3d87b8);box-shadow:0 3px 0 #2d6a94;}
.fs-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #2d6a94;}
.fs-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-btn--ghost{background:linear-gradient(180deg,#a9c4d8,#87a7bf);box-shadow:0 3px 0 #6b8aa1;}
.fs-btn--ghost:active{box-shadow:0 1px 0 #6b8aa1;}
.fs-sea{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(70,110,150,.22);line-height:0;}
.fs-sea canvas{display:block;}
.fs-bars{width:100%;max-width:620px;display:flex;flex-direction:column;gap:4px;}
.fs-barrow{display:flex;align-items:center;gap:7px;}
.fs-barlabel{font-size:11.5px;font-weight:900;white-space:nowrap;width:44px;text-align:right;color:#5b7a92;}
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
.fs-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#5aa9d6,#3d87b8);box-shadow:0 4px 0 #2d6a94;}
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
.fss-mark{font-size:12px;font-weight:900;width:34px;text-align:center;letter-spacing:-1px;color:#5b7a92;}
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
.fss-show{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;background:#ffffffdd;
  border-radius:14px;padding:6px 10px;font-size:12.5px;font-weight:800;color:#3f6f92;max-width:620px;}
.fss-show[hidden]{display:none;}
.fss-let{border:none;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7fc8e0,#4f9cc4);box-shadow:0 3px 0 #3b7c9e;
  min-height:36px;}
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
  min-height:40px;margin-left:auto;white-space:nowrap;}
.fss-gbuy:disabled{background:#cbd7e0;box-shadow:0 3px 0 #aebecb;cursor:default;color:#f4f8fb;}
.fss-gbuy:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #b46522;}
.fss-gbuy:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fss-gbar{font-size:12.5px;font-weight:800;color:#3f6f92;text-align:center;line-height:1.6;}
.fss-tier{font-size:11.5px;font-weight:900;letter-spacing:.5px;}
.fss-cdex{font-size:11px;font-weight:700;color:#6d8ba1;line-height:1.45;}
.fss-tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:4px;}
.fss-tab{border:none;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffcc;color:#4f7c9c;box-shadow:0 2px 5px rgba(90,130,160,.18);min-height:34px;}
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
@media (prefers-reduced-motion:reduce){
  .fss-shake{animation:none;}
  .fss-let:active,.fss-gbuy:active:not(:disabled){transform:none;}
}
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

  // 上鱼小演出那一行:水桶里这一条可以放生
  const showRow = el("div", "fss-show");
  showRow.hidden = true;
  const showLabel = el("span", "", "");
  const letBtn = button("fss-let", "💧 放生");
  showRow.append(showLabel, letBtn);

  const actBtn = button("fs-act fss-act", "🎣 按住抛竿");
  const live = el("div", "fs-sr");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");

  wrap.append(hud, seaBox, infoRow, bars, tip, showRow, actBtn, live);
  host.appendChild(wrap);

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
  const onCanvasDown = (e: PointerEvent): void => {
    e.preventDefault();
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

  function layout(): void {
    const avail = clamp(host.clientWidth || 340, 240, 620);
    const viewH = (globalThis as { innerHeight?: number }).innerHeight ?? 700;
    // 手机竖屏一共 667 像素,水面上面还压着平台标题栏和 level99 的选关条。
    // 水面必须让位,否则那颗「按住抛竿」的大按钮会被挤到首屏外面去。
    const share = viewH <= 560 ? 0.33 : viewH <= 720 ? 0.36 : 0.42;
    W = Math.round(avail);
    H = Math.round(clamp(viewH * share, 180, 380));
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
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

  function drawWater(): void {
    if (!g) return;
    const info = opts.daylight ? PHASE_INFO[dayPhase()] : null;
    const sky = g.createLinearGradient(0, 0, 0, surfaceY());
    sky.addColorStop(0, info ? info.sky : "#fdf3e6");
    sky.addColorStop(1, info ? info.sky : "#ffe9d2");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, surfaceY());

    for (let i = 0; i < LAYERS.length; i++) {
      const y0 = yOfDepth(LAYERS[i].from);
      const y1 = yOfDepth(i === LAYERS.length - 1 ? MAX_DEPTH : LAYERS[i].to);
      g.fillStyle = LAYERS[i].color;
      g.fillRect(0, y0, W, y1 - y0 + 1);
    }

    // 天色压在水上:清晨暖、夜里深蓝,始终是 2D 侧视的剖面图,不做真 3D
    if (info) {
      g.fillStyle = info.tint;
      g.fillRect(0, surfaceY(), W, H - surfaceY());
      if (dayPhase() === "night") {
        // 夜里的水下光柱:一条淡淡的月光
        g.fillStyle = "rgba(220,235,255,0.10)";
        g.beginPath();
        g.moveTo(W * 0.58, surfaceY());
        g.lineTo(W * 0.7, surfaceY());
        g.lineTo(W * 0.88, H);
        g.lineTo(W * 0.5, H);
        g.closePath();
        g.fill();
      }
    }

    // 水面的小波纹
    g.strokeStyle = "#ffffffb0";
    g.lineWidth = 2;
    g.beginPath();
    const sy = surfaceY();
    for (let x = 0; x <= W; x += 8) {
      const y = sy + Math.sin((x / 26) + ambient / 420) * 2.2;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
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
    g.fillStyle = "#2f6f9e";
    g.font = "600 11px system-ui,sans-serif";
    g.textAlign = "left";
    g.fillText(`鱼群带 ${opts.band.from}–${opts.band.to} 米`, 6, y0 + 13);
  }

  function drawRuler(): void {
    if (!g) return;
    g.textAlign = "right";
    g.font = "600 10px system-ui,sans-serif";
    for (let d = 10; d <= MAX_DEPTH; d += 10) {
      const y = yOfDepth(d);
      g.strokeStyle = "#ffffff70";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(W - 34, y);
      g.lineTo(W - 4, y);
      g.stroke();
      g.fillStyle = "#ffffffdd";
      g.fillText(`${d}m`, W - 5, y - 3);
    }
    g.textAlign = "left";
  }

  function drawSwimmers(): void {
    if (!g) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const s of swimmers) {
      const x = ((s.x + (ambient / 1000) * s.speed) % 1 + 1) % 1;
      const px = 12 + x * (W - 46);
      const py = yOfDepth(s.depth) + Math.sin(ambient / 600 + s.x * 9) * 3;
      g.globalAlpha = 0.55;
      g.font = `${Math.round(clamp(W / 22, 13, 22))}px system-ui,sans-serif`;
      g.fillText(s.fish.emoji, px, py);
      g.globalAlpha = 1;
    }
    g.textBaseline = "alphabetic";
  }

  function rodTip(): { x: number; y: number } {
    return { x: W * 0.34, y: surfaceY() - 10 };
  }

  /** 岸在左边:人站在岸上往右边的水面抛,不是坐在船里 */
  function drawShore(): void {
    if (!g) return;
    const sy = surfaceY();
    const shoreW = W * 0.28;
    g.fillStyle = "#e6d3ae";
    g.fillRect(0, sy - 2, shoreW, H - sy + 2);
    g.fillStyle = "#bcd9a4";
    g.fillRect(0, sy - 9, shoreW, 8);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = "18px system-ui,sans-serif";
    g.fillText("🧒", W * 0.13, sy - 11);
    g.font = "14px system-ui,sans-serif";
    g.fillText("🪣", W * 0.22, sy - 11);
    // 鱼竿:从岸上斜指向水面
    const tipPos = rodTip();
    g.strokeStyle = "#8a5a33";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(W * 0.15, sy - 22);
    g.lineTo(tipPos.x, tipPos.y);
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

  function drawLine(): void {
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
    const hy = yOfDepth(hookDepth());
    const hx = hookX();
    const band = phase === "fight" && params ? tensionBand(fight.tension, params.redAt) : "green";
    g.strokeStyle = band === "yellow" ? "#e8a02f" : band === "red" ? "#e04f74" : "#ffffffd8";
    g.lineWidth = band === "yellow" ? 2.4 : band === "red" ? 3 : 1.6;
    g.beginPath();
    g.moveTo(tipPos.x, tipPos.y);
    // 拉扯时线绷成一条直线,平时垂一点弧度
    const bend = phase === "fight" ? (1 - fight.tension) * 16 : 12;
    g.quadraticCurveTo((tipPos.x + hx) / 2 - bend, (tipPos.y + hy) / 2, hx, hy);
    g.stroke();

    g.textAlign = "center";
    g.textBaseline = "middle";
    if (phase === "fight" && hooked) {
      g.font = `${Math.round(clamp(W / 13, 22, 40))}px system-ui,sans-serif`;
      const shake = reduceMotion() ? 0 : Math.sin(ambient / 55) * (2 + fight.tension * 4);
      g.fillText(hooked.emoji, hx + shake, hy);
    } else if (phase === "bite") {
      // 咬钩瞬间:浮标一沉,这一下就是给你的反应窗口
      g.font = "17px system-ui,sans-serif";
      g.fillText("🎈", hx, hy + 4);
    } else {
      g.font = "15px system-ui,sans-serif";
      g.fillText("🪝", hx, hy);
    }
    g.textBaseline = "alphabetic";
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
    g.fillStyle = "#b23a63";
    g.font = "700 12px system-ui,sans-serif";
    g.textAlign = "left";
    g.fillText(`松手 → ${aimDist.toFixed(1)} 米远 · ${aimDepth.toFixed(1)} 米深`, 8, y - 5);
    g.textAlign = "center";
    g.font = "700 13px system-ui,sans-serif";
    g.fillStyle = "#3f6f92";
    g.fillText(windArrow(wind), x, surfaceY() - 8);
  }

  function render(): void {
    if (!g) return;
    g.clearRect(0, 0, W, H);
    drawWater();
    drawBand();
    drawSwimmers();
    drawRuler();
    drawShore();
    drawLine();
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
    if (!paused && !finished) tick(dt);
    render();
    refreshHud();
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
