import { meta } from "./meta";
export { meta };

// 糖果秋千 —— 划绳物理益智：划断绳子，把糖果送进小怪物"啾啾"的嘴巴。
// 188 关 10 大主题：草地 / 夜空 / 工厂 / 云朵 / 冰雪 / 彩虹 / 钟楼 / 浮岛 / 星糖 / 月夜，
// 14 种机关（1.1 新增发条伸缩绳、风扇气流、糖霜磁铁、捣蛋鬼咕噜噜、多段高台），
// 带选关地图与进度存档。
import {
  type Link,
  type Particle,
  type StickyGrip,
  applyAcceleration,
  applyImpulse,
  attachedToAnchor,
  boardPosition,
  buildRope,
  circleRectOverlap,
  circlesOverlap,
  collideCircleRect,
  comboLabel,
  countRopesCut,
  cutLinksNear,
  deactivateConnectedLinks,
  fadeAlpha,
  fanForceAt,
  fanOn,
  integrate,
  linksCrossedBySwipe,
  magnetForceAt,
  makeParticle,
  moveToward,
  nearestAnchoredLink,
  patrolPosition,
  retuneLinks,
  setVelocity,
  snipOccurred,
  solveLinks,
  springBounce,
  springNormal,
  starsForCollected,
  stickyGripStep,
  teleport,
  velocityOf,
  whipImpulse,
  winchScale,
} from "./physics";
import {
  CHAPTERS,
  CHAPTER_SIZES,
  LEVELS,
  chapterOf,
  chapterStart,
  failedSpeechLine,
  totalStars,
  wonSpeechLine,
  type ChapterTheme,
  type LevelDef,
} from "./levels";
import {
  MUSHROOM_R,
  createSticky,
  mushroomAxis,
  mushroomBounce,
  mushroomTriggers,
  stickyCatch,
  stickyProgress,
  stickyRelease,
  tickSticky,
  type StickyState as BubbleStickyState,
} from "./swing12";
import { makeTowerLevel, towerTitle } from "./endless";
import {
  BUBBLE_RAINBOW,
  CANDY_BODY_DEEP,
  CANDY_BODY_LIGHT,
  CANDY_WRAP,
  CANDY_WRAP_FOLD,
  MID_PARALLAX,
  MONSTER_DARK,
  MONSTER_EAR_INNER,
  MONSTER_LIGHT,
  PORTAL_IN_COLOR,
  PORTAL_OUT_COLOR,
  RESULT_STAR_POP,
  SNIP_FRAY_SEC,
  STAR_CORE,
  candySpiralPoints,
  drawGoldStar,
  drawHeart,
  fluffOutline,
  monsterPose,
  starPath,
} from "./art";
import { needsMigration, readProgress, writeProgress, type Progress } from "./progress";
import { save } from "../../engine/save";
import { isRootOpen } from "../../ui/root12Contract";
import { unlockedWithRoot } from "./rootUnlock";
import { speak, stopSpeaking } from "../speech";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const W = 360;
const H = 480;
const CANDY_R = 16;
const GRAVITY = 900;
const STEP = 1 / 120;
const MOUTH_EAT_R = 42;
const STAR_COLLECT_R = 30;
const BUBBLE_CATCH_R = 50;
const PORTAL_R = 24;
const PORTAL_COOLDOWN = 0.45;
const PUFF_RANGE = 130;
const PUFF_SPEED = 320;
const BALLOON_TAP_R = 42;
const MOTH_BITE_DIST = 12;
/** 割绳判定带半宽:10px 半宽 = 20px 线宽,小手划过附近就算割中 */
const CUT_HALF_WIDTH = 10;
/**
 * 1.2 补 tunneling：手指两帧之间的位移再细分成 ≤12px 的子线段逐段判交。
 * 一挥手划过大半个屏幕也不会从绳子上「跳」过去。
 */
const CUT_SUBSTEP = 12;
/** 糖果落出画面后先给 0.5s 缓冲(可能被风口吹回/荡回)再判失败 */
const FALL_GRACE = 0.5;
/** 1.2 糖果残影：留 300ms 淡出，帮孩子看清刚才那一段是怎么飞的 */
const CANDY_GHOST_MS = 300;
/** 1.2 接糖三段小演出（接住 / 咀嚼 / 满足）总时长，规格上限 700ms */
const EAT_SHOW_MS = 700;
/** 1.2 连击提示停留时长 */
const COMBO_SHOW = 1.1;

/* ---- 1.3 视觉素材（确定性数据在模块级算一次，逐帧只描不算） ---- */

/** 糖体螺旋纹：阿基米德螺线 2.5 圈的折线点列 */
const CANDY_SPIRAL = candySpiralPoints(CANDY_R * 0.82);
/** 小怪物绒毛轮廓：32×30 椭圆切 14 段微锯齿 */
const MONSTER_FLUFF = fluffOutline(32, 30, 14);
/** 中景层（视差系数 MID_PARALLAX；本款无镜头，除云层外静态） */
const MEADOW_FLOWERS = [[46, 421], [104, 434], [168, 425], [246, 431], [316, 419]] as const;
const NIGHT_RIDGE = [[0, 436], [58, 396], [120, 420], [188, 384], [252, 416], [312, 394], [360, 428]] as const;
const FACTORY_PIPES = [{ y: 336, h: 12 }, { y: 406, h: 9 }] as const;
const SKY_HAZE = [[40, 322, 64], [180, 252, 80], [312, 356, 56]] as const;

const localStore: Storage | null = (() => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
})();

function loadProgress(): Progress {
  const p = readProgress(localStore, LEVELS.length);
  // 两代老 key 里还有更高的星就地搬一次，不用等下一次通关才落盘
  if (needsMigration(localStore, LEVELS.length)) writeProgress(localStore, p);
  return p;
}

function saveProgress(p: Progress): void {
  writeProgress(localStore, p);
}

/** 系统「减少动态效果」开关：残影与碎屑减半，结果与音效照旧 */
function reducedMotion(): boolean {
  try {
    return typeof matchMedia === "function"
      && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface ThemePalette {
  skyTop: string;
  skyBottom: string;
  accent: string;
  deco: ChapterTheme;
}

const THEMES: Record<ChapterTheme, ThemePalette> = {
  meadow: { skyTop: "#FFF7FB", skyBottom: "#DCF3E1", accent: "#7CBE5F", deco: "meadow" },
  night: { skyTop: "#252A55", skyBottom: "#4A3E78", accent: "#8E7BE0", deco: "night" },
  factory: { skyTop: "#FFEFF7", skyBottom: "#FFD9EA", accent: "#F06FA5", deco: "factory" },
  sky: { skyTop: "#BFE3FF", skyBottom: "#E8F6FF", accent: "#5FA8E0", deco: "sky" },
  ice: { skyTop: "#D8F0FA", skyBottom: "#EDF9FF", accent: "#5BB8D4", deco: "ice" },
  rainbow: { skyTop: "#FFF3D6", skyBottom: "#FFE3F1", accent: "#F0975F", deco: "rainbow" },
  clock: { skyTop: "#F6EEDD", skyBottom: "#E7DCC6", accent: "#B08A4E", deco: "clock" },
  isle: { skyTop: "#DFF6F2", skyBottom: "#F2FBF8", accent: "#4FBFA8", deco: "isle" },
  starfac: { skyTop: "#EFE6FF", skyBottom: "#FBF2FF", accent: "#8E6FD8", deco: "starfac" },
  moonfair: { skyTop: "#2B2F5E", skyBottom: "#5A4A86", accent: "#FFD98A", deco: "moonfair" },
};

interface StarState {
  x: number;
  y: number;
  collected: boolean;
  suck: number;
}

interface BubbleState {
  x: number;
  y: number;
  used: boolean;
  /** 1.2 粘性泡泡：挂住糖果这么多秒（普通泡泡不填） */
  sticky?: number;
}

interface HookState {
  x: number;
  y: number;
  radius: number;
  used: boolean;
}

interface BoardState {
  def: NonNullable<LevelDef["boards"]>[number];
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

interface BalloonState {
  def: NonNullable<LevelDef["balloons"]>[number];
  puffsLeft: number;
}

interface ScissorsState {
  def: NonNullable<LevelDef["scissors"]>[number];
  lastSnipAt: number;
}

interface MothState {
  def: NonNullable<LevelDef["moths"]>[number];
  x: number;
  y: number;
  chewT: number;
  chewing: boolean;
}

/** 咕噜噜：在两点间来回巡逻，碰到糖果就抢走 */
interface GremlinState {
  def: NonNullable<LevelDef["gremlins"]>[number];
  x: number;
  y: number;
  prevX: number;
}

/** 发条绳：记下这段绳的原始节长，每帧按倍率重设 */
interface WinchState {
  def: NonNullable<NonNullable<LevelDef["ropes"]>[number]["winch"]>;
  from: number;
  to: number;
  baseRests: number[];
  /** 当前倍率，绘制发条盘时用 */
  scale: number;
}

/** 1.2 黏黏泡的运行时状态 */
interface StickyState {
  def: NonNullable<LevelDef["stickies"]>[number];
  grip: StickyGrip;
  /** 刚黏上的演出计时 */
  flash: number;
}

/** 1.2 弹簧蘑菇的运行时状态（squash 是被踩扁的回弹动画） */
interface SpringState {
  def: NonNullable<LevelDef["springs"]>[number];
  squash: number;
  hits: number;
}

/** 1.2 弹簧蘑菇（swing12 那一版，按朝向弹开）的运行时状态 */
interface MushroomState {
  def: NonNullable<LevelDef["mushrooms"]>[number];
  squash: number;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

/** 1.2 糖果残影：记下糖果走过的位置，300ms 淡出 */
interface Ghost {
  x: number;
  y: number;
  t: number;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}

export interface CandySwingHandle {
  destroy: () => void;
  /** 平台直达第 N 关（1 基），返回真正打开的关号 */
  openCampaignLevel: (n: number) => number;
}

export function mount(api: GameApi): CandySwingHandle {
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let acc = 0;
  let simTime = 0;

  const progress = loadProgress();

  let screen: "map" | "play" = "map";
  let levelIndex = 0;
  let phase: "play" | "won" | "failed" = "play";
  let phaseTime = 0;
  let bannerTime = 0;
  let failReason = "";
  let allDoneReported = false;

  // ---- 1.2 无尽「甜甜塔」 ----
  let mode: "campaign" | "endless" = "campaign";
  /** 本局塔的种子：每开一局换一颗，同一局里逐层可复现 */
  let towerSeed = 1;
  /** 当前爬到第几层（1 基） */
  let towerWave = 1;
  /** 本局吃进嘴里的糖果数 */
  let towerScore = 0;
  let towerBest = 0;
  /** 本层剩余时间；闯关模式是 Infinity */
  let timeLeft = Infinity;

  // 物理世界
  let particles: Particle[] = [];
  let links: Link[] = [];
  let stars: StarState[] = [];
  let bubbles: BubbleState[] = [];
  let hooks: HookState[] = [];
  let boards: BoardState[] = [];
  let balloons: BalloonState[] = [];
  let scissorsArr: ScissorsState[] = [];
  let moths: MothState[] = [];
  let gremlins: GremlinState[] = [];
  let winches: WinchState[] = [];
  let stickies: StickyState[] = [];
  let springs: SpringState[] = [];
  let mushrooms: MushroomState[] = [];
  /** 粘性泡泡（bubbles[i].sticky）挂住糖果的那一段时间，与 sim.ts 同一套纯函数 */
  let bubbleSticky: BubbleStickyState = createSticky();
  /** 挂住糖果的那个泡泡：画倒计时圈用 */
  let bubbleStickyAt: { x: number; y: number; hold: number } | null = null;
  /** 第 i 根绳对应的发条（没挂发条就是 undefined），画发条盘时用 */
  let winchOfRope: Array<WinchState | undefined> = [];
  /** 第 i 根绳占用的 link 下标区间 [from, to)，「一刀两断」按根数算 */
  let ropeLinkRanges: Array<[number, number]> = [];
  let level: LevelDef = LEVELS[0];
  let theme: ThemePalette = THEMES.meadow;
  let inBubble = false;
  let candyEaten = false;
  let candyGone = false;
  let mouthOpenAmount = 0;
  let portalCooldown = 0;
  let wonStars = 0;
  let fallGraceT = 0;
  /** 糖果被黏黏泡钉住时，绳物理与掉落判定都先让路 */
  let stuckToSticky = false;
  /** 接糖三段演出（0 → EAT_SHOW_MS/1000），点一下可跳过 */
  let eatShowT = 0;
  let eatShowSkipped = false;
  /** 「一刀两断」提示 */
  let comboText = "";
  let comboT = 0;
  let bestComboThisLevel = 0;
  /** 1.3 失败演出：糖果出事的位置，短暂画一张哭脸 */
  let sadCandyAt: { x: number; y: number } | null = null;
  const lessMotion = reducedMotion();

  const trail: TrailPoint[] = [];
  const ghosts: Ghost[] = [];
  const sparkles: Sparkle[] = [];

  const wrap = document.createElement("div");
  wrap.className = "cs-wrap";
  wrap.innerHTML = `
    <style>
      .cs-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F6, #EAF4FF); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: manipulation; }
      .cs-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; }
      .cs-badge { background: #fff; border-radius: 14px; padding: 6px 10px; font-weight: 700; color: #D65C8B; box-shadow: 0 2px 6px rgba(214,92,139,.2); font-size: 13px; white-space: nowrap; }
      .cs-btn { border: none; border-radius: 14px; padding: 6px 12px; font-size: 13px; font-weight: 700; background: #FFD3E3; color: #B03A6B; cursor: pointer; box-shadow: 0 3px 0 #F2AECB; }
      .cs-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #F2AECB; }
      .cs-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .cs-msg { text-align: center; min-height: 20px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .cs-hidden { display: none; }
      .cs-map { max-height: min(960px, max(180px, calc(100dvh - 120px))); overflow-y: auto; }
      .cs-lv.cs-lv-cur { outline: 3px solid #e0679f; }
      .cs-map-title { text-align: center; font-size: 20px; font-weight: 800; color: #D65C8B; margin: 4px 0 2px; }
      .cs-map-total { text-align: center; font-size: 14px; font-weight: 700; color: #B06AB3; margin-bottom: 10px; }
      .cs-chapter { border-radius: 18px; padding: 10px 12px 12px; margin-bottom: 12px; }
      .cs-chapter.meadow { background: linear-gradient(160deg, #E9F8DF, #D5F0E2); }
      .cs-chapter.night { background: linear-gradient(160deg, #3A3E77, #55488F); }
      .cs-chapter.factory { background: linear-gradient(160deg, #FFE2F0, #FFD1E6); }
      .cs-chapter.sky { background: linear-gradient(160deg, #CDE8FF, #E4F4FF); }
      .cs-chapter.ice { background: linear-gradient(160deg, #DDF3FC, #F0FBFF); }
      .cs-chapter.rainbow { background: linear-gradient(160deg, #FFE9C9, #FFD9EC, #DDE7FF); }
      .cs-chapter.clock { background: linear-gradient(160deg, #F5EAD3, #E6D9BF); }
      .cs-chapter.isle { background: linear-gradient(160deg, #D9F4EE, #EFFBF7); }
      .cs-chapter.starfac { background: linear-gradient(160deg, #EDE2FF, #FBF1FF); }
      .cs-chapter.moonfair { background: linear-gradient(160deg, #3B3F72, #6A5A96); }
      .cs-ch-name { font-weight: 800; font-size: 15px; margin-bottom: 2px; color: #4E7A3A; }
      .cs-ch-blurb { font-size: 12px; margin-bottom: 8px; color: #6F9A5C; }
      .cs-chapter.night .cs-ch-name { color: #E7DFFF; }
      .cs-chapter.night .cs-ch-blurb { color: #B9AEE8; }
      .cs-chapter.factory .cs-ch-name { color: #C2497E; }
      .cs-chapter.factory .cs-ch-blurb { color: #D97BA5; }
      .cs-chapter.sky .cs-ch-name { color: #2E6FAE; }
      .cs-chapter.sky .cs-ch-blurb { color: #5A93C7; }
      .cs-chapter.ice .cs-ch-name { color: #2C7E9C; }
      .cs-chapter.ice .cs-ch-blurb { color: #5FA6BF; }
      .cs-chapter.rainbow .cs-ch-name { color: #C7642E; }
      .cs-chapter.rainbow .cs-ch-blurb { color: #C9856B; }
      .cs-chapter.clock .cs-ch-name { color: #8A6420; }
      .cs-chapter.clock .cs-ch-blurb { color: #9C7C43; }
      .cs-chapter.isle .cs-ch-name { color: #1F7F6C; }
      .cs-chapter.isle .cs-ch-blurb { color: #4A9A8A; }
      .cs-chapter.starfac .cs-ch-name { color: #6B47C0; }
      .cs-chapter.starfac .cs-ch-blurb { color: #8A6BC8; }
      .cs-chapter.moonfair .cs-ch-name { color: #FFE9B8; }
      .cs-chapter.moonfair .cs-ch-blurb { color: #C9BDEA; }
      .cs-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .cs-lv { border: none; border-radius: 14px; padding: 7px 2px 5px; background: #FFFFFF; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); display: flex; flex-direction: column; align-items: center; gap: 1px; min-height: 44px; min-width: 44px; box-sizing: border-box; }
      .cs-lv:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,.12); }
      .cs-lv .n { font-size: 16px; font-weight: 800; color: #B03A6B; }
      .cs-lv .s { font-size: 10px; letter-spacing: 1px; }
      .cs-lv.locked { background: rgba(255,255,255,.45); cursor: default; box-shadow: none; }
      .cs-lv.locked .n { color: #A99DB5; }
      .cs-chapter.night .cs-lv { background: rgba(255,255,255,.92); }
      .cs-chapter.night .cs-lv.locked { background: rgba(255,255,255,.22); }
      .cs-chapter.moonfair .cs-lv { background: rgba(255,255,255,.92); }
      .cs-chapter.moonfair .cs-lv.locked { background: rgba(255,255,255,.22); }
      /* ---- 1.2 新增（cds- 前缀，只在本款局部生效，不动全局 styles.css） ---- */
      .cds-modes { display: flex; gap: 8px; margin: 0 0 10px; }
      .cds-mode { flex: 1; border: none; border-radius: 16px; padding: 10px 6px; min-height: 44px; cursor: pointer; background: #FFFFFF; box-shadow: 0 3px 0 rgba(214,92,139,.22); display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .cds-mode:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(214,92,139,.22); }
      .cds-mode .t { font-size: 15px; font-weight: 800; color: #B03A6B; }
      .cds-mode .d { font-size: 12px; color: #8C6BA8; }
      .cds-mode.on { background: linear-gradient(160deg, #FFE1EE, #FFD0E4); }
      /* 关卡目标与星星数一行显示，字号 ≥ 14px */
      .cds-hud { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
      .cds-hud .cs-badge { font-size: 14px; padding: 7px 10px; }
      .cds-hud .cds-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      /* 360px 上「第几关 · 关名」和两个按钮挤一行会只剩省略号，让 HUD 单独占一行 */
      .cds-top { flex-wrap: wrap; }
      .cds-top .cds-hud { flex: 1 1 100%; order: -1; }
      .cds-tap { min-height: 44px; min-width: 44px; font-size: 14px; padding: 8px 12px; }
      .cds-clock { color: #C2497E; }
      .cds-clock.hot { color: #E0453F; }
      /* 平板/横屏:选关地图别缩在 400px 一条窄柱里,两边留白离谱。
         放宽到 720px、每章 8 列;进关后画布是 3:4 定比,仍回到 400px 档(1.3 UX 走查修复) */
      @media (min-width: 700px) {
        /* 平台舞台是 flex,不写 width 的话 wrap 会缩回内容宽,max-width 白放宽 */
        .cs-wrap.cs-view-map { max-width: 720px; width: 100%; }
        .cs-wrap.cs-view-map .cs-grid { grid-template-columns: repeat(8, 1fr); }
        .cs-wrap.cs-view-map .cds-modes { max-width: 480px; margin-left: auto; margin-right: auto; }
      }
      /* N-29 尾款:915×412 关内画布 166~660 出屏 248(3:4 定比被 400px 宽驱动)。
         矮横屏按余量钳「显示高」,宽度让 auto 保持长宽比居中;指针按 rect 换算,物理零触碰。 */
      @media (max-height:500px) and (min-width:640px) {
        .cs-canvas { width: auto; max-width: 100%; max-height: max(150px, calc(100dvh - 178px)); margin: 0 auto; }
        .cs-wrap { padding: 8px 12px; }
        .cs-msg { margin-top: 4px; min-height: 0; }
      }
    </style>
    <div class="cs-map">
      <div class="cs-map-title">🍬 糖果秋千</div>
      <div class="cs-map-total"></div>
      <div class="cds-modes">
        <button class="cds-mode on cds-mode-campaign" type="button">
          <span class="t">🗺️ 闯关 ${LEVELS.length} 关</span>
          <span class="d">10 大主题，慢慢挑</span>
        </button>
        <button class="cds-mode cds-mode-endless" type="button">
          <span class="t">🍩 无尽甜甜塔</span>
          <span class="d cds-best">看能吃到第几颗</span>
        </button>
      </div>
      <div class="cs-chapters"></div>
    </div>
    <div class="cs-game cs-hidden">
      <div class="cs-top cds-top">
        <span class="cds-hud">
          <span class="cs-badge cs-level cds-name">第 1 关</span>
          <span class="cs-badge cs-stars">⭐ 0/3</span>
        </span>
        <button class="cs-btn cds-tap cs-retry" type="button">🔄 重试</button>
        <button class="cs-btn cds-tap cs-back" type="button">🗺️ 选关</button>
      </div>
      <canvas class="cs-canvas" width="${W}" height="${H}"></canvas>
      <div class="cs-msg"></div>
    </div>
  `;
  api.root.appendChild(wrap);

  const mapEl = wrap.querySelector(".cs-map") as HTMLElement;
  const mapTotalEl = wrap.querySelector(".cs-map-total") as HTMLElement;
  const chaptersEl = wrap.querySelector(".cs-chapters") as HTMLElement;
  const gameEl = wrap.querySelector(".cs-game") as HTMLElement;
  const canvas = wrap.querySelector(".cs-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const levelEl = wrap.querySelector(".cs-level") as HTMLElement;
  const starsEl = wrap.querySelector(".cs-stars") as HTMLElement;
  const msgEl = wrap.querySelector(".cs-msg") as HTMLElement;
  const retryBtn = wrap.querySelector(".cs-retry") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".cs-back") as HTMLButtonElement;
  const campaignBtn = wrap.querySelector(".cds-mode-campaign") as HTMLButtonElement;
  const endlessBtn = wrap.querySelector(".cds-mode-endless") as HTMLButtonElement;
  const bestEl = wrap.querySelector(".cds-best") as HTMLElement;

  function candy(): Particle {
    return particles[0];
  }

  function levelUnlocked(i: number): boolean {
    // 管理员权限(kangkang 密码)开着时全关可进;关着/过期回落到星级解锁
    return unlockedWithRoot(isRootOpen(), i === 0 || progress.stars[i - 1] > 0);
  }

  function allCleared(): boolean {
    return progress.stars.every((s) => s > 0);
  }

  function bestTotal(): number {
    return progress.stars.reduce((a, b) => a + b, 0);
  }

  // ---------- 选关地图 ----------

  function renderMap(): void {
    mapTotalEl.textContent = `⭐ ${bestTotal()} / ${totalStars()} · 共 ${LEVELS.length} 关`;
    bestEl.textContent = towerBest > 0 ? `最好成绩 ${towerBest} 颗糖` : "看能吃到第几颗";
    chaptersEl.innerHTML = "";
    CHAPTERS.forEach((ch, ci) => {
      const box = document.createElement("div");
      box.className = `cs-chapter ${ch.theme}`;
      const name = document.createElement("div");
      name.className = "cs-ch-name";
      const numeral = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][ci] ?? `${ci + 1}`;
      name.textContent = `第${numeral}章 · ${ch.name}`;
      const blurb = document.createElement("div");
      blurb.className = "cs-ch-blurb";
      blurb.textContent = ch.blurb;
      const grid = document.createElement("div");
      grid.className = "cs-grid";
      const start = chapterStart(ci);
      for (let k = 0; k < CHAPTER_SIZES[ci]; k++) {
        const i = start + k;
        if (i >= LEVELS.length) break;
        const btn = document.createElement("button");
        btn.type = "button";
        const unlocked = levelUnlocked(i);
        const got = progress.stars[i];
        const isCurrent = unlocked && got === 0 && (i === 0 || progress.stars[i - 1] > 0) &&
          !progress.stars.slice(0, i).some((st, j) => st === 0 && levelUnlocked(j));
        btn.className = (unlocked ? "cs-lv" : "cs-lv locked") + (isCurrent ? " cs-lv-cur" : "");
        btn.innerHTML = unlocked
          ? `<span class="n">${i + 1}</span><span class="s">${"★".repeat(got)}${"☆".repeat(3 - got)}</span>`
          : `<span class="n">🔒</span><span class="s">&nbsp;</span>`;
        if (unlocked) {
          btn.addEventListener("click", () => {
            api.play("tap");
            startLevel(i);
          });
        }
        grid.appendChild(btn);
      }
      box.appendChild(name);
      box.appendChild(blurb);
      box.appendChild(grid);
      chaptersEl.appendChild(box);
    });
    const cur = chaptersEl.querySelector(".cs-lv-cur") ?? chaptersEl.querySelector(".cs-lv:not(.locked)");
    if (cur && typeof (cur as { scrollIntoView?: (o: { block: string }) => void }).scrollIntoView === "function") {
      try {
        (cur as { scrollIntoView: (o: { block: string }) => void }).scrollIntoView({ block: "center" });
      } catch {
        // ignore
      }
    }
  }

  function showMap(): void {
    screen = "map";
    stopSpeaking();
    renderMap();
    gameEl.classList.add("cs-hidden");
    mapEl.classList.remove("cs-hidden");
    // 宽屏放宽只给地图页:画布是 3:4 定比,进关铺到 720px 宽会竖着装不下
    wrap.className = "cs-wrap cs-view-map";
  }

  // ---------- 关卡装载 ----------

  function updateHud(): void {
    const got = stars.filter((s) => s.collected).length;
    if (mode === "endless") {
      levelEl.textContent = `🍩 第 ${towerWave} 层 · ${towerTitle(towerWave)}`;
      starsEl.textContent = `🍬 ${towerScore} 颗`;
      starsEl.classList.remove("cds-clock", "hot");
    } else {
      levelEl.textContent = `第 ${levelIndex + 1}/${LEVELS.length} 关 · ${level.name}`;
      starsEl.textContent = `⭐ ${got}/${level.stars.length}`;
    }
  }

  function addRopeRange(from: number): void {
    ropeLinkRanges.push([from, links.length]);
  }

  function addRopeToCandy(
    ax: number,
    ay: number,
    totalLength?: number,
    winch?: WinchState["def"]
  ): void {
    const c = candy();
    const dist = totalLength ?? Math.hypot(c.x - ax, c.y - ay);
    const segments = Math.max(3, Math.min(14, Math.round(dist / 16)));
    const build = buildRope(ax, ay, c.x, c.y, segments, totalLength);
    const base = particles.length;
    const linkBase = links.length;
    for (const p of build.particles) particles.push(p);
    for (const l of build.links) {
      links.push({
        a: base + l.a,
        b: l.b === -1 ? 0 : base + l.b,
        rest: l.rest,
        active: true,
      });
    }
    if (winch) {
      winches.push({
        def: winch,
        from: linkBase,
        to: links.length,
        baseRests: links.slice(linkBase).map((l) => l.rest),
        scale: winch.max,
      });
    }
  }

  /** 装载一份关卡数据：闯关走 LEVELS[index]，无尽走现搭的甜甜塔层 */
  function loadLevel(def: LevelDef, palette: ThemePalette): void {
    screen = "play";
    mapEl.classList.add("cs-hidden");
    gameEl.classList.remove("cs-hidden");
    wrap.className = "cs-wrap";
    level = def;
    theme = palette;
    phase = "play";
    phaseTime = 0;
    bannerTime = 1.4;
    simTime = 0;
    acc = 0;
    inBubble = false;
    candyEaten = false;
    candyGone = false;
    mouthOpenAmount = 0;
    portalCooldown = 0;
    wonStars = 0;
    fallGraceT = 0;
    stuckToSticky = false;
    eatShowT = 0;
    eatShowSkipped = false;
    comboText = "";
    comboT = 0;
    bestComboThisLevel = 0;
    sadCandyAt = null;
    timeLeft = level.timeLimit ?? Infinity;
    trail.length = 0;
    ghosts.length = 0;
    sparkles.length = 0;

    particles = [makeParticle(level.candy.x, level.candy.y, false, 0.3)];
    links = [];
    winches = [];
    winchOfRope = [];
    ropeLinkRanges = [];
    for (const r of level.ropes) {
      const before = winches.length;
      const linkBase = links.length;
      addRopeToCandy(r.x, r.y, r.length, r.winch);
      addRopeRange(linkBase);
      winchOfRope.push(winches.length > before ? winches[winches.length - 1] : undefined);
    }
    stars = level.stars.map((s) => ({ x: s.x, y: s.y, collected: false, suck: 0 }));
    bubbles = (level.bubbles ?? []).map((b) => ({ x: b.x, y: b.y, used: false, sticky: b.sticky }));
    hooks = (level.hooks ?? []).map((h) => ({ x: h.x, y: h.y, radius: h.radius, used: false }));
    boards = (level.boards ?? []).map((def) => {
      const pos = boardPosition(def.x1, def.y1, def.x2, def.y2, def.period, 0);
      return { def, x: pos.x, y: pos.y, prevX: pos.x, prevY: pos.y };
    });
    balloons = (level.balloons ?? []).map((def) => ({ def, puffsLeft: def.puffs }));
    scissorsArr = (level.scissors ?? []).map((def) => ({ def, lastSnipAt: -99 }));
    moths = (level.moths ?? []).map((def) => ({
      def,
      x: def.x,
      y: def.y,
      chewT: 0,
      chewing: false,
    }));
    gremlins = (level.gremlins ?? []).map((g) => {
      const pos = patrolPosition(g.x1, g.y1, g.x2, g.y2, g.period, 0, g.offset ?? 0);
      return { def: g, x: pos.x, y: pos.y, prevX: pos.x };
    });
    stickies = (level.stickies ?? []).map((s) => ({
      def: s,
      grip: { left: 0, used: false },
      flash: 0,
    }));
    springs = (level.springs ?? []).map((s) => ({ def: s, squash: 0, hits: 0 }));
    mushrooms = (level.mushrooms ?? []).map((def) => ({ def, squash: 0 }));
    bubbleSticky = createSticky();
    bubbleStickyAt = null;
    msgEl.textContent = level.tip;
    updateHud();
  }

  function startLevel(index: number): void {
    mode = "campaign";
    levelIndex = index;
    loadLevel(LEVELS[index], THEMES[CHAPTERS[chapterOf(index)].theme]);
  }

  /** 无尽「甜甜塔」的第 wave 层 */
  function startTowerWave(wave: number): void {
    mode = "endless";
    towerWave = wave;
    // 层数越高换个主题，爬塔有「越走越深」的感觉
    const palettes: ChapterTheme[] = ["meadow", "sky", "rainbow", "isle", "starfac", "moonfair"];
    const theme10 = palettes[Math.min(palettes.length - 1, Math.floor((wave - 1) / 10))];
    loadLevel(makeTowerLevel(towerSeed, wave), THEMES[theme10]);
  }

  function startTowerRun(): void {
    towerSeed = (Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0;
    towerScore = 0;
    startTowerWave(1);
  }

  function retryLevel(): void {
    if (screen !== "play") return;
    api.play("tap");
    stopSpeaking();
    if (mode === "endless") startTowerRun();
    else startLevel(levelIndex);
  }

  function burst(x: number, y: number, color: string, count = 8, speed = 120): void {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const v = speed * (0.5 + Math.random() * 0.7);
      sparkles.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, t: 0, color });
    }
  }

  function failLevel(reason: string): void {
    if (phase !== "play") return;
    phase = "failed";
    phaseTime = 0;
    failReason = reason;
    // 记下出事位置（夹回画面内），drawCandy 在那儿画一张哭脸
    const c0 = candy();
    sadCandyAt = {
      x: Math.max(24, Math.min(W - 24, c0.x)),
      y: Math.max(28, Math.min(H - 46, c0.y)),
    };
    api.play("oops");
    if (mode === "endless") {
      towerBest = save.recordEndlessBest("candy-swing", towerScore);
      msgEl.textContent = towerScore > 0
        ? `这一趟爬到第 ${towerWave} 层，吃到 ${towerScore} 颗糖！点画面再爬一次`
        : "没关系，点击画面再爬一次！";
      speak(`${failedSpeechLine(reason)}这一趟吃到 ${towerScore} 颗糖。`);
      return;
    }
    msgEl.textContent = "没关系，点击画面再来一次！";
    // 结算自动朗读：识字量有限的孩子靠听（无中文语音包时静默）
    speak(failedSpeechLine(reason));
  }

  function winLevel(): void {
    if (phase !== "play") return;
    phase = "won";
    phaseTime = 0;
    candyEaten = true;
    eatShowT = 0;
    eatShowSkipped = false;
    // 吃掉时把还连在糖果上的绳段一起收走（不然会悬空残留）
    deactivateConnectedLinks(links, 0);
    api.play("coin");
    api.play("win");
    burst(level.monster.x, level.monster.y - 10, "#FF9DBE", 12, 160);

    if (mode === "endless") {
      towerScore++;
      towerBest = save.recordEndlessBest("candy-swing", towerScore);
      updateHud();
      msgEl.textContent = `第 ${towerScore} 颗糖到手！继续往上爬！`;
      speak(`吃到第 ${towerScore} 颗糖啦！`);
      return;
    }

    const collected = stars.filter((s) => s.collected).length;
    wonStars = Math.max(1, collected);
    const before = progress.stars[levelIndex];
    const wasAllCleared = allCleared();
    progress.stars[levelIndex] = Math.max(before, wonStars);
    saveProgress(progress);
    msgEl.textContent = "啾啾吃到糖果啦！";

    if (!wasAllCleared && allCleared() && !allDoneReported) {
      allDoneReported = true;
      const rating = starsForCollected(bestTotal(), totalStars());
      window.setTimeout(() => {
        if (destroyed) return;
        api.onWin(rating, `${LEVELS.length} 关全部通关！共收集 ${bestTotal()} 颗星星！`);
      }, 1500);
    } else {
      // 逐关结算自动朗读（全通关那次走平台弹窗，那边自带朗读，不叠音）
      speak(wonSpeechLine(wonStars));
    }
  }

  // ---------- 物理与规则 ----------

  /**
   * 一段手指位移的割绳判定。
   * 1.2 起把 (x0,y0)→(x1,y1) 细分成 ≤12px 的子线段逐段判交（补 tunneling），
   * 切断瞬间沿划线方向给绳头一记「甩」，绳子是被划开的，不是凭空消失。
   * speed 是这一段的划线速度 px/s，划得越快甩得越开（封顶）。
   */
  function cutAt(x0: number, y0: number, x1: number, y1: number, speed = 0): void {
    if (phase !== "play") return;
    const hit = linksCrossedBySwipe(
      particles, links, x0, y0, x1, y1, CUT_HALF_WIDTH, CUT_SUBSTEP
    );
    if (hit.length === 0) return;

    const dirX = x1 - x0;
    const dirY = y1 - y0;
    const len = Math.hypot(dirX, dirY) || 1;
    // 划线的法向：两截绳头往两边分开
    const nx = -dirY / len;
    const ny = dirX / len;
    const kick = whipImpulse(dirX, dirY, speed);
    for (const li of hit) {
      const link = links[li];
      link.active = false;
      const pa = particles[link.a];
      const pb = particles[link.b];
      // 甩：沿划线方向给速度 + 沿法向把两截分开，绳头会明显抖一下
      if (!pa.pinned) {
        applyImpulse(pa, kick.vx - nx * 90, kick.vy - ny * 90, STEP);
      }
      if (!pb.pinned) {
        applyImpulse(pb, kick.vx + nx * 90, kick.vy + ny * 90, STEP);
      }
      burst((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, "#C58A4F", lessMotion ? 2 : 5, 70);
    }
    api.play("pop");

    // 一刀两断：同一刀切断了几「根」绳（一根绳上连切几段只算一根）
    const ropesCut = countRopesCut(hit, ropeLinkRanges);
    if (ropesCut >= 2) {
      bestComboThisLevel = Math.max(bestComboThisLevel, ropesCut);
      comboText = comboLabel(ropesCut);
      comboT = COMBO_SHOW;
      api.play("coin");
      const mid = particles[links[hit[0]].a];
      burst(mid.x, mid.y, "#FFD36B", lessMotion ? 4 : 12, 150);
    }
  }

  function popBubble(): void {
    if (!inBubble) return;
    inBubble = false;
    const c = candy();
    burst(c.x, c.y, "#9AD4FF", 10, 110);
    api.play("pop");
  }

  function tryPuff(x: number, y: number): boolean {
    for (const b of balloons) {
      if (b.puffsLeft <= 0) continue;
      if (Math.hypot(x - b.def.x, y - b.def.y) > BALLOON_TAP_R) continue;
      b.puffsLeft--;
      const dir = b.def.dir;
      const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
      const dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
      const c = candy();
      if (!candyGone && Math.hypot(c.x - b.def.x, c.y - b.def.y) <= PUFF_RANGE) {
        applyImpulse(c, dx * PUFF_SPEED, dy * PUFF_SPEED, STEP);
      }
      api.play("jump");
      for (let i = 0; i < 10; i++) {
        sparkles.push({
          x: b.def.x + dx * 20,
          y: b.def.y + dy * 20,
          vx: dx * (120 + Math.random() * 160) + (Math.random() - 0.5) * 60,
          vy: dy * (120 + Math.random() * 160) + (Math.random() - 0.5) * 60,
          t: 0,
          color: "#E8F6FF",
        });
      }
      return true;
    }
    return false;
  }

  function stepScissors(prevT: number, nowT: number): void {
    for (const s of scissorsArr) {
      const offset = s.def.offset ?? s.def.period;
      if (snipOccurred(s.def.period, offset, prevT, nowT)) {
        s.lastSnipAt = nowT;
        const cut = cutLinksNear(particles, links, s.def.x, s.def.y, s.def.radius);
        if (cut > 0) {
          burst(s.def.x, s.def.y, "#C58A4F", 6, 90);
          api.play("pop");
        }
      }
    }
  }

  function stepMoths(dt: number): void {
    for (const m of moths) {
      m.chewing = false;
      if (simTime < m.def.delay) continue;
      const li = nearestAnchoredLink(particles, links, m.x, m.y);
      if (li < 0) {
        // 没绳可咬就飘走
        const away = moveToward(m.x, m.y, m.def.x, m.def.y - 30, m.def.speed * 0.5, dt);
        m.x = away.x;
        m.y = away.y;
        continue;
      }
      const link = links[li];
      const tx = (particles[link.a].x + particles[link.b].x) / 2;
      const ty = (particles[link.a].y + particles[link.b].y) / 2;
      const dist = Math.hypot(tx - m.x, ty - m.y);
      if (dist > MOTH_BITE_DIST) {
        const mv = moveToward(m.x, m.y, tx, ty, m.def.speed, dt);
        m.x = mv.x;
        m.y = mv.y;
        m.chewT = 0;
      } else {
        m.chewing = true;
        m.chewT += dt;
        if (m.chewT >= m.def.chew) {
          link.active = false;
          m.chewT = 0;
          burst(tx, ty, "#D9A05B", 6, 80);
          api.play("pop");
        }
      }
    }
  }

  function stepPortals(): void {
    if (portalCooldown > 0 || candyGone) return;
    // 还挂在锚点上的糖果进不了传送门
    if (attachedToAnchor(particles, links)) return;
    const c = candy();
    for (const p of level.portals ?? []) {
      if (Math.hypot(c.x - p.ax, c.y - p.ay) <= PORTAL_R) {
        burst(p.ax, p.ay, "#C79DF5", 8, 100);
        // 拖着的绳尾进不了门，留在门口散掉
        deactivateConnectedLinks(links, 0);
        teleport(c, p.bx, p.by);
        burst(p.bx, p.by, "#9DE0F5", 8, 100);
        portalCooldown = PORTAL_COOLDOWN;
        api.play("jump");
        return;
      }
    }
  }

  function step(dt: number): void {
    const prevSim = simTime;
    simTime += dt;
    if (portalCooldown > 0) portalCooldown -= dt;

    // 移动木板（静止的那种就是「高台」，位置恒定）
    for (const b of boards) {
      b.prevX = b.x;
      b.prevY = b.y;
      const pos = boardPosition(b.def.x1, b.def.y1, b.def.x2, b.def.y2, b.def.period, simTime);
      b.x = pos.x;
      b.y = pos.y;
    }

    // 捣蛋鬼巡逻
    for (const g of gremlins) {
      g.prevX = g.x;
      const pos = patrolPosition(
        g.def.x1, g.def.y1, g.def.x2, g.def.y2,
        g.def.period, simTime, g.def.offset ?? 0
      );
      g.x = pos.x;
      g.y = pos.y;
    }

    // 发条绳一收一放：按倍率重设这段绳的静止长度
    for (const wi of winches) {
      wi.scale = winchScale(wi.def.min, wi.def.max, wi.def.period, simTime, wi.def.offset ?? 0);
      retuneLinks(links, wi.from, wi.to, wi.baseRests, wi.scale);
    }

    if (phase === "won") return;

    if (phase === "play") {
      stepScissors(prevSim, simTime);
      stepMoths(dt);
    }

    integrate(particles, 0, GRAVITY, dt);
    const c = candy();
    if (inBubble && !candyGone) {
      c.y += (-260 - GRAVITY) * dt * dt;
      const upSpeed = (c.py - c.y) / dt;
      const maxUp = 95;
      if (upSpeed > maxUp) c.py = c.y + maxUp * dt;
    }
    if (!candyGone) {
      // 风扇气流与糖霜磁铁：都是叠加在重力上的加速度
      for (const f of level.fans ?? []) {
        if (!fanOn(f.period, f.duty ?? 0.5, f.offset ?? 0, simTime)) continue;
        const force = fanForceAt(f.x, f.y, f.w, f.h, f.dir, f.power, c.x, c.y);
        applyAcceleration(c, force.fx, force.fy, dt);
      }
      for (const mg of level.magnets ?? []) {
        const force = magnetForceAt(mg.x, mg.y, mg.radius, mg.strength, c.x, c.y);
        applyAcceleration(c, force.fx, force.fy, dt);
      }
    }
    solveLinks(particles, links, 6);

    if (!candyGone) {
      for (const b of boards) {
        collideCircleRect(
          c, CANDY_R,
          b.x, b.y, b.def.w, b.def.h,
          0.35, b.x - b.prevX, b.y - b.prevY
        );
      }
    }

    if (phase !== "play" || candyGone) return;

    // 1.2 粘性泡泡：挂住期间原地不动，到点自己松手，把攒下的速度还回去
    let gripped = false;
    if (bubbleSticky.held && bubbleStickyAt) {
      c.x = bubbleStickyAt.x;
      c.y = bubbleStickyAt.y;
      setVelocity(c, 0, 0, dt);
      gripped = true;
      const before = bubbleSticky;
      bubbleSticky = tickSticky(bubbleSticky, dt);
      if (!bubbleSticky.held) {
        const out = stickyRelease(before);
        setVelocity(c, out.vx, out.vy, dt);
        api.play("jump");
        burst(bubbleStickyAt.x, bubbleStickyAt.y, "#C8F5E8", lessMotion ? 3 : 8, 110);
        bubbleStickyAt = null;
      }
    }

    // 1.2 黏黏泡：黏住期间把糖果钉在泡泡中心，孩子有几秒看清下半程
    for (const st of stickies) {
      if (st.flash > 0) st.flash -= dt;
      const r = stickyGripStep(
        st.grip, st.def.hold,
        c.x, c.y, CANDY_R,
        st.def.x, st.def.y, st.def.radius,
        dt
      );
      st.grip = r.grip;
      if (r.grabbed) {
        st.flash = 0.45;
        api.play("pop");
        burst(st.def.x, st.def.y, "#8FE0C8", lessMotion ? 3 : 8, 90);
      }
      if (r.released) {
        api.play("jump");
        burst(st.def.x, st.def.y, "#C8F5E8", lessMotion ? 3 : 8, 110);
      }
      if (r.gripped) {
        gripped = true;
        c.x = st.def.x;
        c.y = st.def.y;
        setVelocity(c, 0, 0, dt);
      }
    }
    stuckToSticky = gripped;

    // 1.2 弹簧蘑菇：踩到就换个方向弹走
    for (const sp of springs) {
      if (sp.squash > 0) sp.squash -= dt;
      if (!circlesOverlap(c.x, c.y, CANDY_R, sp.def.x, sp.def.y, sp.def.radius)) continue;
      const n = springNormal(sp.def.dir);
      const v = velocityOf(c, dt);
      const out = springBounce(v.vx, v.vy, n.nx, n.ny, sp.def.bounce, sp.def.minOut);
      const push = sp.def.radius + CANDY_R + 1;
      c.x = sp.def.x + n.nx * push;
      c.y = sp.def.y + n.ny * push;
      setVelocity(c, out.vx, out.vy, dt);
      sp.squash = 0.25;
      sp.hits++;
      api.play("jump");
      burst(sp.def.x, sp.def.y, "#FFB4D2", lessMotion ? 3 : 8, 120);
    }

    // 1.2 弹簧蘑菇（swing12 版）：压上伞面就沿朝向弹开
    for (const mu of mushrooms) {
      if (mu.squash > 0) mu.squash -= dt;
      if (!circlesOverlap(c.x, c.y, CANDY_R, mu.def.x, mu.def.y, MUSHROOM_R)) continue;
      const v = velocityOf(c, dt);
      if (!mushroomTriggers(v.vx, v.vy, mu.def.dir)) continue;
      const out = mushroomBounce(v.vx, v.vy, mu.def.dir);
      const axis = mushroomAxis(mu.def.dir);
      c.x = mu.def.x + axis.x * (MUSHROOM_R + CANDY_R + 1);
      c.y = mu.def.y + axis.y * (MUSHROOM_R + CANDY_R + 1);
      setVelocity(c, out.vx, out.vy, dt);
      mu.squash = 0.25;
      api.play("jump");
      burst(mu.def.x, mu.def.y, "#FFD59E", lessMotion ? 3 : 8, 120);
    }

    stepPortals();

    // 挂钩自动抓住
    for (const h of hooks) {
      if (h.used) continue;
      if (circlesOverlap(c.x, c.y, CANDY_R, h.x, h.y, h.radius - CANDY_R)) {
        h.used = true;
        const dist = Math.hypot(c.x - h.x, c.y - h.y);
        addRopeToCandy(h.x, h.y, Math.max(dist * 0.95, 55));
        api.play("jump");
        burst(h.x, h.y, "#B7E29B", 6, 80);
      }
    }

    // 泡泡（接住时吸收大部分冲量，软着陆再慢慢上浮）
    for (const b of bubbles) {
      if (b.used) continue;
      if (circlesOverlap(c.x, c.y, CANDY_R, b.x, b.y, BUBBLE_CATCH_R - CANDY_R)) {
        b.used = true;
        if (b.sticky && b.sticky > 0) {
          const v = velocityOf(c, dt);
          bubbleSticky = stickyCatch(bubbleSticky, v.vx, v.vy, b.sticky);
          bubbleStickyAt = { x: b.x, y: b.y, hold: b.sticky };
          c.x = b.x;
          c.y = b.y;
          setVelocity(c, 0, 0, dt);
          api.play("pop");
          burst(b.x, b.y, "#8FE0C8", lessMotion ? 3 : 8, 90);
        } else {
          inBubble = true;
          c.px = c.x - (c.x - c.px) * 0.25;
          c.py = c.y - (c.y - c.py) * 0.25;
          api.play("jump");
        }
      }
    }

    // 星星收集
    for (const s of stars) {
      if (s.collected) continue;
      if (circlesOverlap(c.x, c.y, STAR_COLLECT_R - 14, s.x, s.y, 14)) {
        s.collected = true;
        api.play("coin");
        updateHud();
      }
    }

    // 刺
    for (const sp of level.spikes ?? []) {
      if (circleRectOverlap(c.x, c.y, CANDY_R - 2, sp.x, sp.y, sp.w, sp.h)) {
        candyGone = true;
        inBubble = false;
        burst(c.x, c.y, "#FF8FB1", 12, 150);
        failLevel("糖果碰到刺啦！");
        return;
      }
    }

    // 捣蛋鬼咕噜噜抢糖
    for (const g of gremlins) {
      if (simTime < (g.def.delay ?? 0)) continue;
      if (circlesOverlap(c.x, c.y, CANDY_R, g.x, g.y, g.def.radius)) {
        candyGone = true;
        inBubble = false;
        burst(c.x, c.y, "#9FE0A8", 12, 150);
        failLevel("咕噜噜把糖果抢走啦！");
        return;
      }
    }

    // 怪物吃糖
    const mouthX = level.monster.x;
    const mouthY = level.monster.y + 4;
    const dMouth = Math.hypot(c.x - mouthX, c.y - mouthY);
    mouthOpenAmount = Math.max(0, Math.min(1, (130 - dMouth) / 90));
    if (dMouth <= MOUTH_EAT_R) {
      inBubble = false;
      candyGone = true;
      winLevel();
      return;
    }

    // 掉出画面:先给 0.5s 缓冲(还可能荡回来/被气球吹回来),超时才判失败
    if (c.y > H + 60 || c.x < -60 || c.x > W + 60 || c.y < -80) {
      fallGraceT += dt;
      if (fallGraceT >= FALL_GRACE) {
        candyGone = true;
        failLevel(c.y < 0 ? "糖果飞走啦！" : "糖果掉出去啦！");
        return;
      }
    } else {
      fallGraceT = 0;
    }

    // 无尽「甜甜塔」的限时：闯关模式 timeLeft 是 Infinity，永远走不到这里
    if (Number.isFinite(timeLeft)) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        failLevel("时间到啦！");
      }
    }
  }

  // ---------- 绘制 ----------

  function drawBackground(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.skyTop);
    g.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (theme.deco === "meadow") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      for (let i = 0; i < 5; i++) {
        const bx = (i * 83 + 40) % W;
        const by = 60 + ((i * 127) % 300);
        ctx.beginPath();
        ctx.arc(bx, by, 20 + (i % 3) * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      // 中景：远丘两座 + 小花点（无镜头 → 静态）
      ctx.fillStyle = "rgba(150, 205, 130, 0.18)";
      ctx.beginPath();
      ctx.ellipse(90, H + 6, 170, 70, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(305, H + 12, 190, 84, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      for (const [fx, fy] of MEADOW_FLOWERS) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 190, 215, 0.9)";
        ctx.beginPath();
        ctx.arc(fx, fy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(150, 210, 130, 0.35)";
      ctx.beginPath();
      ctx.ellipse(70, H + 30, 180, 90, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(300, H + 40, 200, 100, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (theme.deco === "night") {
      for (let i = 0; i < 18; i++) {
        const sx = (i * 61 + 23) % W;
        const sy = (i * 97 + 15) % (H - 100);
        const tw = 0.5 + Math.abs(Math.sin(simTime * 2 + i)) * 0.5;
        ctx.fillStyle = `rgba(255, 245, 200, ${0.35 + tw * 0.45})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2 + (i % 3) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      // 中景：远山剪影
      ctx.fillStyle = "rgba(28, 30, 68, 0.6)";
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (const [rx, ry] of NIGHT_RIDGE) ctx.lineTo(rx, ry);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      // 月亮
      ctx.fillStyle = "#FFF3C2";
      ctx.beginPath();
      ctx.arc(312, 54, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.skyTop;
      ctx.beginPath();
      ctx.arc(303, 47, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.deco === "factory") {
      // 糖果工厂：斜条纹 + 齿轮
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 14;
      for (let i = -2; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 70, -20);
        ctx.lineTo(i * 70 + 120, H + 20);
        ctx.stroke();
      }
      ctx.restore();
      // 中景：糖浆管道剪影（横贯画面 + 接头卡箍）
      for (const pi of FACTORY_PIPES) {
        ctx.fillStyle = "rgba(214, 92, 139, 0.14)";
        ctx.beginPath();
        ctx.roundRect(-6, pi.y, W + 12, pi.h, 5);
        ctx.fill();
        ctx.fillStyle = "rgba(214, 92, 139, 0.22)";
        for (const jx of [70, 200, 320]) {
          ctx.beginPath();
          ctx.roundRect(jx, pi.y - 2, 10, pi.h + 4, 3);
          ctx.fill();
        }
      }
      for (const [gx, gy, gr] of [[40, 70, 24], [326, 250, 18]] as const) {
        ctx.strokeStyle = "rgba(240, 111, 165, 0.35)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = simTime * 0.6 + (Math.PI * i) / 4;
          ctx.beginPath();
          ctx.moveTo(gx + Math.cos(ang) * gr, gy + Math.sin(ang) * gr);
          ctx.lineTo(gx + Math.cos(ang) * (gr + 7), gy + Math.sin(ang) * (gr + 7));
          ctx.stroke();
        }
      }
    } else if (theme.deco === "sky") {
      // 中景：远层淡云，漂移速度按视差系数打折（lessMotion 静止）
      const hazeDrift = lessMotion ? 0 : simTime * 8 * MID_PARALLAX;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (const [hx, hy, hr] of SKY_HAZE) {
        const hxNow = ((hx + hazeDrift) % (W + 160)) - 80;
        ctx.beginPath();
        ctx.ellipse(hxNow, hy, hr, hr * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 云朵乐园：飘动的大朵白云 + 远处小鸟
      for (let i = 0; i < 4; i++) {
        const drift = ((simTime * 8 + i * 110) % (W + 140)) - 70;
        const cy = 60 + i * 95;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(drift, cy, 22, 0, Math.PI * 2);
        ctx.arc(drift + 24, cy - 8, 17, 0, Math.PI * 2);
        ctx.arc(drift + 46, cy, 19, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(80, 120, 170, 0.5)";
      ctx.lineWidth = 2;
      for (const [bx, by] of [[70, 90], [280, 150]] as const) {
        const w2 = Math.sin(simTime * 6 + bx) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 8, by + w2);
        ctx.quadraticCurveTo(bx, by - 6, bx + 1, by + w2);
        ctx.quadraticCurveTo(bx + 2, by - 6, bx + 9, by + w2);
        ctx.stroke();
      }
    } else if (theme.deco === "ice") {
      // 冰雪王国：飘雪 + 底部冰山
      for (let i = 0; i < 14; i++) {
        const fx = (i * 71 + 30 + Math.sin(simTime + i) * 14) % W;
        const fy = (i * 53 + simTime * 26) % (H + 20);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(fx, fy, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(190, 226, 245, 0.55)";
      ctx.beginPath();
      ctx.moveTo(-10, H);
      ctx.lineTo(60, H - 70);
      ctx.lineTo(130, H);
      ctx.moveTo(210, H);
      ctx.lineTo(290, H - 90);
      ctx.lineTo(375, H);
      ctx.fill();
    } else if (theme.deco === "rainbow") {
      // 彩虹嘉年华：大彩虹拱 + 彩纸屑
      const colors = ["#FF8A8A", "#FFC46B", "#FFEC8A", "#9DE58F", "#8FCBF0", "#C79DF5"];
      ctx.lineWidth = 9;
      for (let i = 0; i < colors.length; i++) {
        ctx.strokeStyle = colors[i] + "66";
        ctx.beginPath();
        ctx.arc(W / 2, H + 120, 300 - i * 10, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const cx = (i * 89 + 25) % W;
        const cy = (i * 67 + simTime * 34) % (H + 16);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(simTime * 2 + i);
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-3, -2, 6, 4);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    } else if (theme.deco === "clock") {
      // 发条钟楼：墙上的大钟 + 慢慢转的齿轮
      ctx.strokeStyle = "rgba(176, 138, 78, 0.35)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(300, 78, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (const [len, speed] of [[24, 0.25], [16, 3]] as const) {
        const ang = simTime * speed - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(300, 78);
        ctx.lineTo(300 + Math.cos(ang) * len, 78 + Math.sin(ang) * len);
        ctx.stroke();
      }
      for (const [gx, gy, gr, spin] of [[48, 200, 26, 0.5], [330, 330, 20, -0.7]] as const) {
        ctx.strokeStyle = "rgba(176, 138, 78, 0.28)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = simTime * spin + (Math.PI * i) / 4;
          ctx.beginPath();
          ctx.moveTo(gx + Math.cos(ang) * gr, gy + Math.sin(ang) * gr);
          ctx.lineTo(gx + Math.cos(ang) * (gr + 7), gy + Math.sin(ang) * (gr + 7));
          ctx.stroke();
        }
      }
    } else if (theme.deco === "isle") {
      // 泡泡浮岛：漂浮的小岛 + 一串串小气泡
      for (const [ix, iy, iw] of [[70, 130, 46], [286, 216, 38], [140, 330, 30]] as const) {
        const bob = Math.sin(simTime * 1.4 + ix) * 4;
        ctx.fillStyle = "rgba(120, 200, 180, 0.35)";
        ctx.beginPath();
        ctx.ellipse(ix, iy + bob, iw, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(160, 220, 200, 0.4)";
        ctx.beginPath();
        ctx.moveTo(ix - iw * 0.7, iy + bob);
        ctx.lineTo(ix, iy + bob + 26);
        ctx.lineTo(ix + iw * 0.7, iy + bob);
        ctx.fill();
      }
      for (let i = 0; i < 12; i++) {
        const bx = (i * 47 + 20) % W;
        const by = (H - ((i * 61 + simTime * 40) % (H + 40)));
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, 3 + (i % 3) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (theme.deco === "starfac") {
      // 星糖工厂：糖霜管道 + 飘落的糖粒
      ctx.strokeStyle = "rgba(142, 111, 216, 0.25)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-10, 96);
      ctx.lineTo(96, 96);
      ctx.lineTo(96, 168);
      ctx.moveTo(370, 300);
      ctx.lineTo(272, 300);
      ctx.lineTo(272, 232);
      ctx.stroke();
      ctx.lineCap = "butt";
      for (let i = 0; i < 12; i++) {
        const sx = (i * 59 + 18) % W;
        const sy = (i * 83 + simTime * 30) % (H + 12);
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 200, 235, 0.8)" : "rgba(200, 225, 255, 0.8)";
        ctx.fillRect(sx, sy, 3, 3);
      }
    } else if (theme.deco === "moonfair") {
      // 月光大巡游：大月亮 + 挂满的小彩灯
      ctx.fillStyle = "rgba(255, 240, 190, 0.9)";
      ctx.beginPath();
      ctx.arc(58, 62, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.skyTop;
      ctx.beginPath();
      ctx.arc(48, 54, 21, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 20; i++) {
        const sx = (i * 71 + 40) % W;
        const sy = (i * 53 + 20) % (H - 140);
        const tw = 0.5 + Math.abs(Math.sin(simTime * 2.4 + i)) * 0.5;
        ctx.fillStyle = `rgba(255, 244, 210, ${0.25 + tw * 0.4})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      const lampColors = ["#FFB3C7", "#FFE08A", "#A8E6CF", "#B3C7FF"];
      ctx.strokeStyle = "rgba(255, 230, 180, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.quadraticCurveTo(W / 2, 52, W, 24);
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const lx = t * W;
        const ly = 24 + Math.sin(Math.PI * t) * 28;
        ctx.fillStyle = lampColors[i % lampColors.length];
        ctx.globalAlpha = 0.55 + Math.abs(Math.sin(simTime * 3 + i)) * 0.45;
        ctx.beginPath();
        ctx.arc(lx, ly + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawFans(): void {
    for (const f of level.fans ?? []) {
      const on = fanOn(f.period, f.duty ?? 0.5, f.offset ?? 0, simTime);
      const dx = f.dir === "left" ? -1 : f.dir === "right" ? 1 : 0;
      const dy = f.dir === "up" ? -1 : f.dir === "down" ? 1 : 0;
      // 风道
      ctx.fillStyle = on ? "rgba(140, 220, 235, 0.16)" : "rgba(170, 180, 190, 0.1)";
      ctx.beginPath();
      ctx.roundRect(f.x, f.y, f.w, f.h, 10);
      ctx.fill();
      ctx.strokeStyle = on ? "rgba(90, 190, 210, 0.5)" : "rgba(160, 170, 180, 0.35)";
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      // 流动的风线
      if (on) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        const along = dx !== 0 ? f.w : f.h;
        const lanes = 4;
        for (let i = 0; i < lanes; i++) {
          const lane = (i + 0.5) / lanes;
          const flow = ((simTime * 170 + i * 45) % (along + 60)) - 30;
          const sx = dx !== 0
            ? (dx > 0 ? f.x + flow : f.x + f.w - flow)
            : f.x + f.w * lane;
          const sy = dy !== 0
            ? (dy > 0 ? f.y + flow : f.y + f.h - flow)
            : f.y + f.h * lane;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + dx * 22, sy + dy * 22);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      }
      // 出风口那面的扇叶
      const bx = dx > 0 ? f.x : dx < 0 ? f.x + f.w : f.x + f.w / 2;
      const by = dy > 0 ? f.y : dy < 0 ? f.y + f.h : f.y + f.h / 2;
      const spin = on ? simTime * 9 : simTime * 0.6;
      ctx.save();
      ctx.translate(bx + dx * 8, by + dy * 8);
      // 扇叶运动模糊弧：转得快才有，弧长随转速（lessMotion 不画）
      if (on && !lessMotion) {
        const blur = 0.9;
        ctx.strokeStyle = "rgba(95, 198, 216, 0.4)";
        ctx.lineWidth = 3.2;
        for (let i = 0; i < 3; i++) {
          const a0 = spin + (Math.PI * 2 * i) / 3 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(0, 0, 8.2, a0 - blur, a0);
          ctx.stroke();
        }
      }
      ctx.fillStyle = on ? "#5FC6D8" : "#AEB8C2";
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(spin + (Math.PI * 2 * i) / 3);
        ctx.beginPath();
        ctx.ellipse(0, -8, 4.5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMagnets(): void {
    for (const mg of level.magnets ?? []) {
      const pull = mg.strength >= 0;
      // 作用范围
      ctx.strokeStyle = pull ? "rgba(240, 91, 122, 0.25)" : "rgba(79, 132, 232, 0.25)";
      ctx.setLineDash([4, 9]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mg.x, mg.y, mg.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 一圈一圈的磁力波
      const wave = (simTime * 0.55) % 1;
      for (let i = 0; i < 3; i++) {
        const k = (wave + i / 3) % 1;
        const r = pull ? mg.radius * (1 - k) : mg.radius * k;
        ctx.strokeStyle = pull
          ? `rgba(240, 91, 122, ${0.3 * (1 - Math.abs(k - 0.5) * 1.4)})`
          : `rgba(79, 132, 232, ${0.3 * (1 - Math.abs(k - 0.5) * 1.4)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(mg.x, mg.y, Math.max(6, r), 0, Math.PI * 2);
        ctx.stroke();
      }
      // 马蹄形磁铁本体：金属渐变涂装 + 白端头 + 蹄铁高光
      ctx.save();
      ctx.translate(mg.x, mg.y);
      const mgG = ctx.createLinearGradient(-12, -12, 12, 10);
      mgG.addColorStop(0, pull ? "#FF8AA0" : "#8FB3F5");
      mgG.addColorStop(1, pull ? "#D8375C" : "#2F63C9");
      ctx.strokeStyle = mgG;
      ctx.lineWidth = 9;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(0, 0, 11, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(-11, 9);
      ctx.moveTo(11, 0);
      ctx.lineTo(11, 9);
      ctx.stroke();
      ctx.strokeStyle = "#F2F4F8";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-11, 9);
      ctx.lineTo(-11, 14);
      ctx.moveTo(11, 9);
      ctx.lineTo(11, 14);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -1, 12.5, Math.PI * 1.15, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 咕噜噜：圆滚滚一团糖霜怪，大嘴、两颗小角，本作原创形象 */
  function drawGremlins(): void {
    for (const g of gremlins) {
      const napping = simTime < (g.def.delay ?? 0);
      const facing = g.x >= g.prevX ? 1 : -1;
      const bob = Math.sin(simTime * 5 + g.x * 0.05) * 2;
      const r = g.def.radius;
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.scale(facing, 1);
      // 抢糖范围
      ctx.strokeStyle = napping ? "rgba(150, 160, 170, 0.2)" : "rgba(120, 200, 140, 0.3)";
      ctx.setLineDash([4, 7]);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r + CANDY_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 两只小角
      ctx.fillStyle = "#63B383";
      ctx.beginPath();
      ctx.moveTo(-7, -r + 2);
      ctx.lineTo(-11, -r - 8);
      ctx.lineTo(-2, -r - 1);
      ctx.closePath();
      ctx.moveTo(7, -r + 2);
      ctx.lineTo(11, -r - 8);
      ctx.lineTo(2, -r - 1);
      ctx.closePath();
      ctx.fill();
      // 身体
      ctx.fillStyle = napping ? "#BFD9C6" : "#8FD8A6";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.15, r * 0.26, 0, Math.PI * 2);
      ctx.arc(r * 0.32, -r * 0.15, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2F4A38";
      if (napping) {
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "#2F4A38";
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.15, r * 0.2, 0.2, Math.PI - 0.2);
        ctx.arc(r * 0.32, -r * 0.15, r * 0.2, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(-r * 0.26, -r * 0.12, r * 0.13, 0, Math.PI * 2);
        ctx.arc(r * 0.36, -r * 0.12, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
      // 大嘴（睡着时抿成一条线）
      if (napping) {
        ctx.strokeStyle = "#4A6B54";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.25, r * 0.42);
        ctx.lineTo(r * 0.25, r * 0.42);
        ctx.stroke();
      } else {
        const open = 0.5 + Math.abs(Math.sin(simTime * 4)) * 0.5;
        ctx.fillStyle = "#3F6B4C";
        ctx.beginPath();
        ctx.ellipse(0, r * 0.42, r * 0.34, r * 0.2 * open + 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, r * 0.3);
        ctx.lineTo(-r * 0.1, r * 0.44);
        ctx.lineTo(0, r * 0.3);
        ctx.fill();
      }
      ctx.restore();
      if (napping) {
        ctx.fillStyle = "rgba(90, 120, 100, 0.75)";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("呼呼…", g.x, g.y - r - 12);
        ctx.textAlign = "left";
      }
    }
  }

  function drawRopes(): void {
    ctx.lineCap = "round";
    for (let li = 0; li < links.length; li++) {
      const link = links[li];
      if (!link.active) continue;
      const pa = particles[link.a];
      const pb = particles[link.b];
      // 粗细变化：靠锚点那头粗、靠糖果那头细，绳子看着有张力
      const ra = ropeLinkRanges.find(([f, t]) => li >= f && li < t);
      const frac = ra ? (li - ra[0]) / Math.max(1, ra[1] - ra[0] - 1) : 0.5;
      const wide = 5.4 - frac * 1.8;
      ctx.strokeStyle = "#A5713F";
      ctx.lineWidth = wide;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      // 麻绳的高光捻线：沿绳身画一条细的浅色曲线
      ctx.strokeStyle = "#C99763";
      ctx.lineWidth = wide * 0.36;
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const nx = -(pb.y - pa.y);
      const ny = pb.x - pa.x;
      const nlen = Math.hypot(nx, ny) || 1;
      const wob = (li % 2 === 0 ? 1 : -1) * 1.1;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.quadraticCurveTo(mx + (nx / nlen) * wob, my + (ny / nlen) * wob, pb.x, pb.y);
      ctx.stroke();
    }
    for (const p of particles) {
      if (!p.pinned) continue;
      ctx.fillStyle = "#C9915F";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8F5E33";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 发条绳的锚点画成一枚会转的发条盘，收绳/放绳转向相反 */
  function drawWinchAnchors(): void {
    level.ropes.forEach((r, i) => {
      const w = r.winch;
      if (!w) return;
      const scale = winchOfRope[i]?.scale ?? w.max;
      const span = Math.max(1e-6, w.max - w.min);
      const t = (scale - w.min) / span;
      // 正在放绳还是收绳：看下一瞬间的倍率往哪走
      const next = winchScale(w.min, w.max, w.period, simTime + 0.05, w.offset ?? 0);
      const dir = next >= scale ? 1 : -1;
      ctx.save();
      ctx.translate(r.x, r.y);
      // 发条盘：金属渐变盘面 + 齿圈光泽
      const wg = ctx.createLinearGradient(-11, -11, 11, 11);
      wg.addColorStop(0, "#E8CE96");
      wg.addColorStop(1, "#B08F4F");
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 8, -2.2, -0.9);
      ctx.stroke();
      ctx.strokeStyle = "#9A7B42";
      ctx.lineWidth = 3;
      for (let k = 0; k < 8; k++) {
        const ang = dir * simTime * 2.2 + (Math.PI * k) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 10, Math.sin(ang) * 10);
        ctx.lineTo(Math.cos(ang) * 15, Math.sin(ang) * 15);
        ctx.stroke();
      }
      // 中间的小指针：绳越长指得越靠外
      ctx.strokeStyle = "#6E4E1F";
      ctx.lineWidth = 2;
      const hand = -Math.PI / 2 + t * Math.PI * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(hand) * 7, Math.sin(hand) * 7);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawSpikes(): void {
    const isNight = theme.deco === "night";
    for (const sp of level.spikes ?? []) {
      ctx.fillStyle = isNight ? "#59548C" : "#DCE3F5";
      ctx.beginPath();
      ctx.roundRect(sp.x, sp.y, sp.w, sp.h, 4);
      ctx.fill();
      // 齿面金属渐变：根部浅 → 尖端深（保住粉色的危险语义）
      const tipG =
        sp.dir === "up" ? ctx.createLinearGradient(0, sp.y, 0, sp.y - 9)
        : sp.dir === "down" ? ctx.createLinearGradient(0, sp.y + sp.h, 0, sp.y + sp.h + 9)
        : sp.dir === "left" ? ctx.createLinearGradient(sp.x, 0, sp.x - 9, 0)
        : ctx.createLinearGradient(sp.x + sp.w, 0, sp.x + sp.w + 9, 0);
      tipG.addColorStop(0, "#FF9AB2");
      tipG.addColorStop(1, "#E8476F");
      ctx.fillStyle = tipG;
      const tooth = 12;
      const tips: Array<[number, number]> = [];
      ctx.beginPath();
      if (sp.dir === "up" || sp.dir === "down") {
        const n = Math.floor(sp.w / tooth);
        const yBase = sp.dir === "up" ? sp.y : sp.y + sp.h;
        const yTip = sp.dir === "up" ? sp.y - 9 : sp.y + sp.h + 9;
        for (let i = 0; i < n; i++) {
          const x0 = sp.x + i * tooth;
          ctx.moveTo(x0, yBase);
          ctx.lineTo(x0 + tooth / 2, yTip);
          ctx.lineTo(x0 + tooth, yBase);
          tips.push([x0 + tooth / 2, yTip + (sp.dir === "up" ? 2.4 : -2.4)]);
        }
      } else {
        const n = Math.floor(sp.h / tooth);
        const xBase = sp.dir === "left" ? sp.x : sp.x + sp.w;
        const xTip = sp.dir === "left" ? sp.x - 9 : sp.x + sp.w + 9;
        for (let i = 0; i < n; i++) {
          const y0 = sp.y + i * tooth;
          ctx.moveTo(xBase, y0);
          ctx.lineTo(xTip, y0 + tooth / 2);
          ctx.lineTo(xBase, y0 + tooth);
          tips.push([xTip + (sp.dir === "left" ? 2.4 : -2.4), y0 + tooth / 2]);
        }
      }
      ctx.fill();
      // 尖端高光点
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      for (const [hx, hy] of tips) {
        ctx.beginPath();
        ctx.arc(hx, hy, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBoards(): void {
    for (const b of boards) {
      // 底下的落影（体积感）
      ctx.fillStyle = "rgba(120, 80, 40, 0.16)";
      ctx.beginPath();
      ctx.ellipse(b.x + b.def.w / 2, b.y + b.def.h + 4, b.def.w * 0.42, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#D8A268";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.def.w, b.def.h, 6);
      ctx.fill();
      // 顶面受光条
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.roundRect(b.x + 2, b.y + 1.5, b.def.w - 4, 3, 2);
      ctx.fill();
      ctx.strokeStyle = "#B9834C";
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 2; i++) {
        const yy = b.y + (b.def.h * i) / 3;
        ctx.beginPath();
        ctx.moveTo(b.x + 6, yy);
        ctx.lineTo(b.x + b.def.w - 6, yy);
        ctx.stroke();
      }
    }
  }

  function drawPortals(): void {
    // 双层旋转漩涡：外环虚线转 + 内盘径向渐变 + 漩涡臂；
    // 入口紫 / 出口青两色可分辨，转向相反；lessMotion 静止。
    for (const p of level.portals ?? []) {
      const spin = lessMotion ? 0 : simTime * 2;
      const gates = [
        { x: p.ax, y: p.ay, ring: PORTAL_IN_COLOR, glow: "rgba(176, 106, 240, ", dir: 1 },
        { x: p.bx, y: p.by, ring: PORTAL_OUT_COLOR, glow: "rgba(63, 195, 232, ", dir: -1 },
      ];
      for (const gate of gates) {
        ctx.save();
        ctx.translate(gate.x, gate.y);
        // 内盘：中心亮的能量面
        const disk = ctx.createRadialGradient(0, 0, 2, 0, 0, PORTAL_R - 3);
        disk.addColorStop(0, "rgba(255, 255, 255, 0.75)");
        disk.addColorStop(1, `${gate.glow}0.28)`);
        ctx.fillStyle = disk;
        ctx.beginPath();
        ctx.arc(0, 0, PORTAL_R - 3, 0, Math.PI * 2);
        ctx.fill();
        // 漩涡臂（入口顺时针 / 出口逆时针）
        ctx.rotate(spin * gate.dir);
        ctx.strokeStyle = `${gate.glow}0.75)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.25) {
          const r = (a / (Math.PI * 4)) * (PORTAL_R - 5);
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        // 外环虚线
        ctx.strokeStyle = gate.ring;
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, PORTAL_R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  function drawBalloons(): void {
    for (const b of balloons) {
      const { x, y, dir } = b.def;
      const bob = Math.sin(simTime * 2.4 + x) * 3;
      const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
      const dy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
      const empty = b.puffsLeft <= 0;
      // 系绳
      ctx.strokeStyle = "rgba(150, 120, 90, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + bob + 20);
      ctx.quadraticCurveTo(x + 5, y + bob + 34, x - 3, y + bob + 46);
      ctx.stroke();
      // 气球本体
      ctx.fillStyle = empty ? "#D8CFE0" : "#FF9E64";
      ctx.beginPath();
      ctx.ellipse(x, y + bob, 17, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(x - 5, y + bob - 6, 5, 7, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // 嘴巴（出风口方向箭头）
      if (!empty) {
        ctx.fillStyle = "#4FA3E8";
        ctx.beginPath();
        const ax = x + dx * 26;
        const ay = y + bob + dy * 30;
        ctx.moveTo(ax + dx * 10 + dy * 0, ay + dy * 10);
        ctx.lineTo(ax - dy * 7, ay - dx * 7);
        ctx.lineTo(ax + dy * 7, ay + dx * 7);
        ctx.closePath();
        ctx.fill();
        // 剩余口数
        for (let i = 0; i < b.puffsLeft; i++) {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(x - 8 + i * 8, y + bob + 26, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawScissors(): void {
    for (const s of scissorsArr) {
      const { x, y, radius, period } = s.def;
      const offset = s.def.offset ?? period;
      // 提示圈
      ctx.strokeStyle = "rgba(240, 130, 130, 0.4)";
      ctx.setLineDash([5, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 距下次咔嚓越近，刀刃张得越开
      let next = offset;
      while (next <= simTime) next += period;
      const until = next - simTime;
      const sinceSnip = simTime - s.lastSnipAt;
      const justSnipped = sinceSnip < 0.18;
      const open = justSnipped ? 0.06 : Math.min(0.55, 0.15 + (1 - Math.min(1, until / period)) * 0.5);
      ctx.save();
      ctx.translate(x, y);
      // 金属渐变刃面 + 红圈手柄
      const bladeG = ctx.createLinearGradient(-6, -16, 8, 6);
      bladeG.addColorStop(0, "#F4F8FE");
      bladeG.addColorStop(0.55, "#B9C4DC");
      bladeG.addColorStop(1, "#7E8BAD");
      for (const side of [-1, 1] as const) {
        const bx = Math.cos(side * open) * 19;
        const by = Math.sin(side * open) * 19 - 7;
        const blen = Math.hypot(bx, by) || 1;
        const plx = (-by / blen) * 2;
        const ply = (bx / blen) * 2;
        ctx.fillStyle = bladeG;
        ctx.beginPath();
        ctx.moveTo(plx, ply);
        ctx.lineTo(bx, by);
        ctx.lineTo(-plx, -ply);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#F08282";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(-Math.cos(side * open) * 9, -Math.sin(side * open) * 9 + 8, 4.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 轴心铆钉 + 高光
      ctx.fillStyle = "#5E6A88";
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.arc(-0.7, -0.7, 0.9, 0, Math.PI * 2);
      ctx.fill();
      // 剪断瞬间：白闪一帧 + 三根断口散丝卷曲消失（lessMotion 不闪不散）
      if (!lessMotion && sinceSnip >= 0 && sinceSnip < 0.1) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * (1 - sinceSnip / 0.1)})`;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + sinceSnip * 140, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!lessMotion && sinceSnip >= 0 && sinceSnip < SNIP_FRAY_SEC) {
        const k = sinceSnip / SNIP_FRAY_SEC;
        ctx.strokeStyle = `rgba(197, 138, 79, ${0.85 * (1 - k)})`;
        ctx.lineWidth = 1.6;
        for (let f = 0; f < 3; f++) {
          const fa = -0.7 + f * 0.7;
          ctx.beginPath();
          ctx.moveTo(0, 3);
          ctx.quadraticCurveTo(
            Math.cos(fa) * 9, 3 + Math.sin(fa) * 9 - k * 5,
            Math.cos(fa) * (13 - k * 5), 3 + Math.sin(fa) * (13 - k * 4) - k * 9
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function drawMoths(): void {
    for (const m of moths) {
      if (simTime < m.def.delay - 1.2) continue;
      const flap = Math.sin(simTime * 18) * (m.chewing ? 0.35 : 0.8);
      const jx = m.chewing ? (Math.random() - 0.5) * 2 : 0;
      ctx.save();
      ctx.translate(m.x + jx, m.y);
      // 翅膀
      ctx.fillStyle = "rgba(230, 190, 250, 0.9)";
      ctx.beginPath();
      ctx.ellipse(-7, -2, 9, 5 + flap * 4, -0.5 + flap * 0.3, 0, Math.PI * 2);
      ctx.ellipse(7, -2, 9, 5 + flap * 4, 0.5 - flap * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // 身体
      ctx.fillStyle = "#8D6BB8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // 触角
      ctx.strokeStyle = "#8D6BB8";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-1, -7);
      ctx.quadraticCurveTo(-5, -13, -7, -12);
      ctx.moveTo(1, -7);
      ctx.quadraticCurveTo(5, -13, 7, -12);
      ctx.stroke();
      // 眼睛
      ctx.fillStyle = "#FFF";
      ctx.beginPath();
      ctx.arc(-2, -4, 1.6, 0, Math.PI * 2);
      ctx.arc(2, -4, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (m.chewing) {
        ctx.fillStyle = "#B03A6B";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("咔嚓咔嚓", m.x, m.y - 18);
        ctx.textAlign = "left";
      }
    }
  }

  /** 全产品标准的金星：金渐变 + 2px 深金描边 + 中心小高光星（三层） */
  function drawStar(x: number, y: number, r: number, rot = 0): void {
    drawGoldStar(ctx, x, y, r, rot);
  }

  function drawStars(): void {
    const c = candy();
    for (const s of stars) {
      if (s.collected) {
        if (s.suck < 1) {
          s.suck = Math.min(1, s.suck + 0.06);
          const tx = candyGone ? s.x : c.x;
          const ty = candyGone ? s.y - 20 : c.y;
          const ix = s.x + (tx - s.x) * s.suck;
          const iy = s.y + (ty - s.y) * s.suck;
          // 3 粒星屑尾迹跟在后面（lessMotion 只留主星淡出）
          if (!lessMotion) {
            ctx.fillStyle = STAR_CORE;
            for (let k = 1; k <= 3; k++) {
              const tt = Math.max(0, s.suck - k * 0.1);
              ctx.globalAlpha = (1 - s.suck) * (0.6 - k * 0.15);
              ctx.beginPath();
              ctx.arc(s.x + (tx - s.x) * tt, s.y + (ty - s.y) * tt, 3.6 - k * 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1 - s.suck;
          drawStar(ix, iy, 14 * (1 - s.suck * 0.8), s.suck * 3);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      const pulse = 1 + Math.sin(simTime * 4 + s.x) * 0.08;
      drawStar(s.x, s.y, 13 * pulse);
    }
  }

  function drawHooks(): void {
    for (const h of hooks) {
      if (h.used) continue;
      ctx.strokeStyle = "rgba(150, 200, 130, 0.4)";
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#8CC170";
      ctx.beginPath();
      ctx.arc(h.x, h.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.x, h.y + 2, 5, Math.PI * 0.1, Math.PI * 1.4);
      ctx.stroke();
    }
  }

  function drawBubbles(): void {
    for (const b of bubbles) {
      if (b.used) continue;
      const wob = Math.sin(simTime * 3 + b.x) * 2;
      const gooey = b.sticky !== undefined && b.sticky > 0;
      ctx.fillStyle = gooey ? "rgba(150, 232, 205, 0.4)" : "rgba(170, 220, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y + wob, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = gooey ? "rgba(58, 168, 138, 0.9)" : "rgba(140, 200, 250, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y + wob, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(b.x - 9, b.y + wob - 9, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // 挂住糖果的粘性泡泡：画一圈倒计时，孩子看得见「还剩多久放开」
    if (bubbleSticky.held && bubbleStickyAt) {
      const frac = stickyProgress(bubbleSticky, bubbleStickyAt.hold);
      ctx.strokeStyle = "#2E8F73";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(bubbleStickyAt.x, bubbleStickyAt.y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }
  }

  function drawCandy(): void {
    // 1.3 失败一瞬：糖果丢了（掉落/被扎/被抢）就在出事的位置画一帧哭脸再重来
    if (phase === "failed" && candyGone && !candyEaten && sadCandyAt !== null && phaseTime < 0.6) {
      ctx.save();
      ctx.translate(sadCandyAt.x, sadCandyAt.y);
      const sg = ctx.createRadialGradient(-5, -6, 2, 0, 0, CANDY_R);
      sg.addColorStop(0, CANDY_BODY_LIGHT);
      sg.addColorStop(1, CANDY_BODY_DEEP);
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, CANDY_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8E2F55";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-6, -5, 3.4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(6, -5, 3.4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = "#8E2F55";
      ctx.beginPath();
      ctx.ellipse(0, 6, 4.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9AD4FF";
      ctx.beginPath();
      ctx.arc(-9, 1, 2.1, 0, Math.PI * 2);
      ctx.arc(9, 2, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (candyGone && !candyEaten) return;
    if (candyEaten) return;
    const c = candy();
    if (inBubble) {
      const wob = Math.sin(simTime * 6) * 1.5;
      ctx.fillStyle = "rgba(170, 220, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 27 + wob, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 200, 250, 0.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 27 + wob, 0, Math.PI * 2);
      ctx.stroke();
      // 彩虹泡膜：细分色弧沿泡壁慢慢转（lessMotion 静止）
      const rainbowSpin = lessMotion ? 0 : simTime * 0.9;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < BUBBLE_RAINBOW.length; i++) {
        const a0 = rainbowSpin + (Math.PI * 2 * i) / BUBBLE_RAINBOW.length;
        ctx.strokeStyle = BUBBLE_RAINBOW[i];
        ctx.beginPath();
        ctx.arc(c.x, c.y, 25 + wob, a0, a0 + (Math.PI * 2) / BUBBLE_RAINBOW.length - 0.25);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const rot = (c.x - c.px) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(rot);
    // 糖纸：比糖体深一档 + 端部圆角 + 一条折线褶
    ctx.fillStyle = CANDY_WRAP;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(side * (CANDY_R - 2), 0);
      ctx.lineTo(side * (CANDY_R + 8), -7);
      ctx.quadraticCurveTo(side * (CANDY_R + 11), -3, side * (CANDY_R + 11), 0);
      ctx.quadraticCurveTo(side * (CANDY_R + 11), 3, side * (CANDY_R + 8), 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = CANDY_WRAP_FOLD;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-(CANDY_R + 8), -5);
    ctx.lineTo(-(CANDY_R + 3), 0);
    ctx.lineTo(-(CANDY_R + 8), 5);
    ctx.moveTo(CANDY_R + 8, -5);
    ctx.lineTo(CANDY_R + 3, 0);
    ctx.lineTo(CANDY_R + 8, 5);
    ctx.stroke();
    // 糖光泽之一：径向渐变底（左上亮 → 边缘深）
    const bodyG = ctx.createRadialGradient(-6, -7, 3, 0, 0, CANDY_R + 1);
    bodyG.addColorStop(0, CANDY_BODY_LIGHT);
    bodyG.addColorStop(1, CANDY_BODY_DEEP);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R, 0, Math.PI * 2);
    ctx.fill();
    // 糖光泽之二：阿基米德螺线 2.5 圈的真螺旋纹
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(CANDY_SPIRAL[0].x, CANDY_SPIRAL[0].y);
    for (let i = 1; i < CANDY_SPIRAL.length; i++) {
      ctx.lineTo(CANDY_SPIRAL[i].x, CANDY_SPIRAL[i].y);
    }
    ctx.stroke();
    ctx.lineCap = "butt";
    // 糖光泽之三：左上高光点组（大 1 小 1）
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(-5, -7, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-1, -10, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 1.2 接糖三段小演出：接住（0–0.22s）→ 咀嚼（0.22–0.5s）→ 满足（0.5–0.7s）。
   * 总长 EAT_SHOW_MS = 700ms，点一下画面直接跳到「满足」。
   */
  function eatStage(): "catch" | "chew" | "happy" | "" {
    if (phase !== "won") return "";
    if (eatShowSkipped) return "happy";
    const t = eatShowT;
    if (t < 0.22) return "catch";
    if (t < 0.5) return "chew";
    return "happy";
  }

  function drawMonster(): void {
    const mx = level.monster.x;
    const my = level.monster.y;
    const stage = eatStage();
    // 接住往下沉 / 咀嚼小幅晃 / 满足轻轻弹：编排全在 monsterPose（公式原样）
    const pose = monsterPose(stage, eatShowT, phaseTime);
    const bounce = pose.bounce;
    const y = my - bounce;
    ctx.save();
    // 地面环境阴影：跳得越高影子越小越淡
    ctx.fillStyle = `rgba(96, 64, 140, ${Math.max(0.06, 0.16 - bounce * 0.01)})`;
    ctx.beginPath();
    ctx.ellipse(mx, my + 30, Math.max(18, 30 - bounce), 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 耳朵：外耳 + 内耳双层，随呼吸微摆（lessMotion 静止）
    const sway = lessMotion ? 0 : Math.sin(simTime * 2.3) * 0.08;
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.translate(mx + side * 20, y - 28);
      ctx.rotate(side * sway);
      ctx.fillStyle = "#B48CE8";
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MONSTER_EAR_INNER;
      ctx.beginPath();
      ctx.arc(-side, -2.4, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 头顶呆毛 2 根
    ctx.strokeStyle = "#A87BDD";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mx - 3, y - 27);
    ctx.quadraticCurveTo(mx - 7, y - 38, mx - 13, y - 40);
    ctx.moveTo(mx + 3, y - 27);
    ctx.quadraticCurveTo(mx + 6, y - 40, mx + 13, y - 43);
    ctx.stroke();
    ctx.lineCap = "butt";
    // 身体：径向渐变（左上亮 → 右下深）+ 一次 path 的绒毛锯齿边
    const bodyG = ctx.createRadialGradient(mx - 12, y - 14, 4, mx, y, 42);
    bodyG.addColorStop(0, MONSTER_LIGHT);
    bodyG.addColorStop(1, MONSTER_DARK);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(mx + 32, y);
    for (const seg of MONSTER_FLUFF) {
      ctx.quadraticCurveTo(mx + seg.cx, y + seg.cy, mx + seg.x, y + seg.y);
    }
    ctx.closePath();
    ctx.fill();
    // 肚皮 + 2 条浅色肚纹
    ctx.fillStyle = "#DCC6FA";
    ctx.beginPath();
    ctx.ellipse(mx, y + 12, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(mx, y + 6, 13, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, y + 10, 15, Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
    // 身体下缘环境阴影弧
    ctx.fillStyle = "rgba(106, 74, 154, 0.16)";
    ctx.beginPath();
    ctx.ellipse(mx, y + 17, 26, 12, 0, Math.PI * 0.14, Math.PI * 0.86);
    ctx.fill();
    const c = candy();
    const lookX = candyGone ? 0 : Math.max(-3, Math.min(3, (c.x - mx) * 0.03));
    const lookY = candyGone ? 0 : Math.max(-3, Math.min(3, (c.y - y) * 0.03));
    if (pose.eyes === "smile") {
      // 满足：眯成两道弯弯的笑眼
      ctx.strokeStyle = "#3A2B52";
      ctx.lineWidth = 3;
      for (const ex of [mx - 11, mx + 11]) {
        ctx.beginPath();
        ctx.arc(ex, y - 8, 7, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(mx - 11, y - 10, 7.5, 0, Math.PI * 2);
      ctx.arc(mx + 11, y - 10, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3A2B52";
      ctx.beginPath();
      ctx.arc(mx - 11 + lookX, y - 10 + lookY, 3.4, 0, Math.PI * 2);
      ctx.arc(mx + 11 + lookX, y - 10 + lookY, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const open = pose.open ?? mouthOpenAmount;
    if (open > 0.15) {
      ctx.fillStyle = "#5A3A6E";
      ctx.beginPath();
      ctx.ellipse(mx, y + 8, 12 + open * 6, 5 + open * 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FF8FA8";
      ctx.beginPath();
      ctx.ellipse(mx, y + 12 + open * 5, 7, 3.5 + open * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#5A3A6E";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mx, y + 6, 8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    // 咀嚼时腮帮子鼓一鼓
    ctx.fillStyle = "rgba(255, 150, 180, 0.5)";
    ctx.beginPath();
    ctx.arc(mx - 22, y + 2, pose.cheek, 0, Math.PI * 2);
    ctx.arc(mx + 22, y + 2, pose.cheek, 0, Math.PI * 2);
    ctx.fill();
    if (pose.halo !== null && !lessMotion) {
      // 接住：一圈扩散开的小光环
      const k = pose.halo;
      ctx.strokeStyle = `rgba(255, 180, 205, ${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, y + 6, 20 + k * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (pose.heart !== null) {
      // 满足：绘制的心形上飘 + 缩放弹跳（lessMotion 原地只淡出）
      const hk = pose.heart;
      const rise = lessMotion ? 0 : hk * 32;
      const pop = lessMotion ? 1 : 1 + Math.sin(Math.min(1, hk * 2.2) * Math.PI) * 0.3;
      ctx.globalAlpha = 1 - hk;
      drawHeart(ctx, mx + 30, y - 36 - rise, 8 * pop);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** 1.2 黏黏泡：一坨会呼吸的绿泡泡，黏住时鼓一下 */
  function drawStickies(): void {
    for (const st of stickies) {
      const held = st.grip.left > 0;
      const done = st.grip.used && !held;
      const bob = lessMotion ? 0 : Math.sin(simTime * 2.6 + st.def.x) * 2;
      const r = st.def.radius * (held ? 1.12 : 1) + (st.flash > 0 ? 3 : 0);
      ctx.save();
      ctx.globalAlpha = done ? 0.3 : 1;
      ctx.fillStyle = held ? "rgba(120, 224, 190, 0.75)" : "rgba(150, 232, 205, 0.5)";
      ctx.beginPath();
      ctx.arc(st.def.x, st.def.y + bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(58, 168, 138, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 表面几个小亮点，看着黏糊糊
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      for (let i = 0; i < 3; i++) {
        const ang = (Math.PI * 2 * i) / 3 - 0.8;
        ctx.beginPath();
        ctx.arc(
          st.def.x + Math.cos(ang) * r * 0.5,
          st.def.y + bob + Math.sin(ang) * r * 0.5,
          2.6 - i * 0.4, 0, Math.PI * 2
        );
        ctx.fill();
      }
      if (held) {
        // 剩余黏住时间的小圆环，孩子能看见「还剩多久放开」
        const frac = Math.max(0, Math.min(1, st.grip.left / Math.max(0.01, st.def.hold)));
        ctx.strokeStyle = "#2E8F73";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(st.def.x, st.def.y + bob, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** 1.2 弹簧蘑菇：一朵带弹簧杆的小蘑菇，踩一下压扁再弹回 */
  function drawSprings(): void {
    for (const sp of springs) {
      const n = springNormal(sp.def.dir);
      const squash = sp.squash > 0 ? sp.squash / 0.25 : 0;
      const r = sp.def.radius * (1 + squash * 0.25);
      ctx.save();
      ctx.translate(sp.def.x, sp.def.y);
      ctx.rotate(Math.atan2(n.ny, n.nx) + Math.PI / 2);
      // 弹簧杆
      ctx.strokeStyle = "#B0728C";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const y = t * 16 * (1 - squash * 0.5);
        const x = Math.sin(t * Math.PI * 3) * 5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // 伞盖（顶亮底深的渐变）
      const capG = ctx.createLinearGradient(0, -r * 0.72, 0, 2);
      capG.addColorStop(0, "#FFB9D2");
      capG.addColorStop(1, "#F2679C");
      ctx.fillStyle = capG;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.72 * (1 - squash * 0.3), 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF0F5";
      for (const [dx, dy, dr] of [[-8, -7, 3.2], [6, -9, 2.6], [1, -3, 2]] as const) {
        ctx.beginPath();
        ctx.arc(dx * (r / 22), dy * (r / 22), dr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // 朝哪弹的小箭头
      ctx.strokeStyle = "rgba(224, 90, 140, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const ax = sp.def.x + n.nx * (r + 8);
      const ay = sp.def.y + n.ny * (r + 8);
      ctx.moveTo(sp.def.x + n.nx * (r + 2), sp.def.y + n.ny * (r + 2));
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax - n.nx * 5 - n.ny * 4, ay - n.ny * 5 + n.nx * 4);
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - n.nx * 5 + n.ny * 4, ay - n.ny * 5 - n.nx * 4);
      ctx.stroke();
    }
  }

  /** 1.2 弹簧蘑菇（swing12 版）：伞盖朝哪边，糖果就往哪边弹 */
  function drawMushrooms(): void {
    for (const mu of mushrooms) {
      const axis = mushroomAxis(mu.def.dir);
      const squash = mu.squash > 0 ? mu.squash / 0.25 : 0;
      const r = MUSHROOM_R * (1 + squash * 0.2);
      ctx.save();
      ctx.translate(mu.def.x, mu.def.y);
      ctx.rotate(Math.atan2(axis.y, axis.x) + Math.PI / 2);
      ctx.strokeStyle = "#C08A5A";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 14 * (1 - squash * 0.5));
      ctx.stroke();
      const capG = ctx.createLinearGradient(0, -r * 0.7, 0, 2);
      capG.addColorStop(0, "#FFC98B");
      capG.addColorStop(1, "#F09B3F");
      ctx.fillStyle = capG;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.7 * (1 - squash * 0.3), 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF3DC";
      for (const [dx, dy, dr] of [[-9, -8, 3.4], [7, -10, 2.8], [0, -4, 2.2]] as const) {
        ctx.beginPath();
        ctx.arc(dx * (r / MUSHROOM_R), dy * (r / MUSHROOM_R), dr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // 朝哪弹的小箭头
      ctx.strokeStyle = "rgba(198, 118, 40, 0.9)";
      ctx.lineWidth = 2.5;
      const ax = mu.def.x + axis.x * (r + 9);
      const ay = mu.def.y + axis.y * (r + 9);
      ctx.beginPath();
      ctx.moveTo(mu.def.x + axis.x * (r + 2), mu.def.y + axis.y * (r + 2));
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax - axis.x * 5 - axis.y * 4, ay - axis.y * 5 + axis.x * 4);
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - axis.x * 5 + axis.y * 4, ay - axis.y * 5 - axis.x * 4);
      ctx.stroke();
    }
  }

  /** 1.2 糖果残影：300ms 淡出，帮孩子回看刚才那一段是怎么飞的 */
  function drawGhosts(): void {
    const life = CANDY_GHOST_MS / 1000;
    while (ghosts.length > 0 && simTime - ghosts[0].t > life) ghosts.shift();
    if (candyGone && !candyEaten) return;
    for (const g of ghosts) {
      const a = fadeAlpha(simTime - g.t, life);
      if (a <= 0) continue;
      ctx.globalAlpha = a * (lessMotion ? 0.14 : 0.34);
      ctx.fillStyle = "#FF7FA8";
      ctx.beginPath();
      ctx.arc(g.x, g.y, CANDY_R * (0.45 + a * 0.4), 0, Math.PI * 2);
      ctx.fill();
      // 残影里的一点光核，拖尾更像糖光划过
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(g.x - 1.5, g.y - 1.5, CANDY_R * (0.45 + a * 0.4) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const age = simTime - p1.t;
      const alpha = Math.max(0, 1 - age / 0.25);
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.lineWidth = 5 * alpha;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    while (trail.length > 0 && simTime - trail[0].t > 0.3) trail.shift();
  }

  function drawSparkles(dt: number): void {
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.t += dt;
      if (s.t > 0.6) {
        sparkles.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 300 * dt;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 1 - s.t / 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.2 * (1 - s.t / 0.6) + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function overlayTextColor(): string {
    return "#D65C8B";
  }

  /** 无尽模式的倒计时条：最后 3 秒变红并跳一下 */
  function drawTowerClock(): void {
    if (mode !== "endless" || !Number.isFinite(timeLeft)) return;
    const total = level.timeLimit ?? 1;
    const frac = Math.max(0, Math.min(1, timeLeft / total));
    const hot = timeLeft <= 3;
    const barW = 200;
    const x = (W - barW) / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.beginPath();
    ctx.roundRect(x, 10, barW, 12, 6);
    ctx.fill();
    ctx.fillStyle = hot ? "#E0453F" : "#5FC2A0";
    ctx.beginPath();
    ctx.roundRect(x + 1.5, 11.5, Math.max(0, (barW - 3) * frac), 9, 4.5);
    ctx.fill();
    // 小闹钟图标是画的，不用 emoji 字符
    const ccx = W / 2 - 30;
    const ccy = 33;
    ctx.strokeStyle = hot ? "#B02B26" : "#3E7A66";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ccx, ccy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx, ccy - 3.6);
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx + 2.8, ccy + 1);
    ctx.stroke();
    ctx.fillStyle = hot ? "#B02B26" : "#3E7A66";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.ceil(Math.max(0, timeLeft))} 秒`, W / 2 + 8, 38);
    ctx.textAlign = "left";
  }

  /** 一刀两断的奖励弹字 */
  function drawCombo(dt: number): void {
    if (comboT <= 0 || comboText === "") return;
    comboT -= dt;
    const a = fadeAlpha(COMBO_SHOW - comboT, COMBO_SHOW);
    const rise = (1 - a) * 26;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.fillStyle = "#E8892B";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 4;
    ctx.strokeText(comboText, W / 2, 116 - rise);
    ctx.fillText(comboText, W / 2, 116 - rise);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawOverlays(): void {
    if (bannerTime > 0 && phase === "play") {
      const a = Math.min(1, bannerTime / 0.4);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * a})`;
      ctx.beginPath();
      ctx.roundRect(40, 190, 280, 84, 18);
      ctx.fill();
      ctx.fillStyle = `rgba(214, 92, 139, ${a})`;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`第 ${levelIndex + 1} 关 · ${level.name}`, W / 2, 226);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = `rgba(150, 100, 190, ${a})`;
      ctx.fillText(level.tip, W / 2, 254);
      ctx.textAlign = "left";
    }
    // 接糖三段演出还没演完就先不盖结算板，别挡住啾啾嚼糖
    const showResult = phase !== "won" || eatShowSkipped || eatShowT >= EAT_SHOW_MS / 1000;
    if (phase === "won" && showResult) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.roundRect(60, 170, 240, 120, 20);
      ctx.fill();
      ctx.fillStyle = overlayTextColor();
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      if (mode === "endless") {
        ctx.fillText(`第 ${towerScore} 颗糖！`, W / 2, 210);
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#7a5aa8";
        ctx.fillText(`最好成绩 ${Math.max(towerBest, towerScore)} 颗`, W / 2, 244);
        ctx.font = "14px sans-serif";
        ctx.fillText("继续往上爬…", W / 2, 274);
      } else {
        ctx.fillText("过关啦！", W / 2, 210);
        // 三星逐颗点亮：每颗 RESULT_STAR_POP 秒缩放弹入 + 星屑 4 粒（lessMotion 直接全亮）
        const got = Math.max(1, stars.filter((s) => s.collected).length);
        const resultT = eatShowSkipped ? phaseTime : Math.max(0, phaseTime - EAT_SHOW_MS / 1000);
        for (let i = 0; i < 3; i++) {
          const sx = W / 2 + (i - 1) * 44;
          const sy = 240;
          if (i >= got) {
            // 没拿到的星：灰底描边占位
            starPath(ctx, sx, sy, 15);
            ctx.fillStyle = "#EFE9F6";
            ctx.fill();
            ctx.strokeStyle = "#CBBFDC";
            ctx.lineWidth = 2;
            ctx.stroke();
            continue;
          }
          const k = lessMotion
            ? 1
            : Math.max(0, Math.min(1, (resultT - i * RESULT_STAR_POP) / RESULT_STAR_POP));
          if (k <= 0) {
            // 还没轮到这颗：先画未点亮底座
            starPath(ctx, sx, sy, 15);
            ctx.fillStyle = "#EFE9F6";
            ctx.fill();
            continue;
          }
          drawStar(sx, sy, 15 * (0.5 + 0.5 * k) * (1 + 0.3 * Math.sin(Math.PI * k)));
          if (k < 1) {
            ctx.fillStyle = `rgba(240, 180, 41, ${1 - k})`;
            for (let d = 0; d < 4; d++) {
              const ang = Math.PI / 4 + (Math.PI / 2) * d;
              ctx.beginPath();
              ctx.arc(sx + Math.cos(ang) * (14 + k * 12), sy + Math.sin(ang) * (14 + k * 12), 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        // 14px 深紫：小字对比 5.5:1（原 13px #9B7BC8 只有 3.5:1，不达 AA）
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#7a5aa8";
        ctx.fillText(
          levelIndex + 1 < LEVELS.length ? "马上进入下一关…" : "最后一关通过！",
          W / 2, 276
        );
      }
      ctx.textAlign = "left";
    }
    if (phase === "failed") {
      const tall = mode === "endless";
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.roundRect(50, 176, 260, tall ? 118 : 100, 20);
      ctx.fill();
      ctx.fillStyle = "#E0708C";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(failReason, W / 2, 216);
      ctx.font = "14px sans-serif";
      // 深紫：小字对比 5.5:1（原 #9B7BC8 只有 3.5:1，不达 AA）
      ctx.fillStyle = "#7a5aa8";
      if (tall) {
        ctx.font = "16px sans-serif";
        ctx.fillText(`爬到第 ${towerWave} 层 · 吃到 ${towerScore} 颗糖`, W / 2, 246);
        ctx.font = "14px sans-serif";
        ctx.fillText(`最好成绩 ${towerBest} 颗 · 点画面再爬一次`, W / 2, 274);
      } else {
        ctx.fillText("点击画面重试本关", W / 2, 248);
      }
      ctx.textAlign = "left";
    }
  }

  function draw(dt: number): void {
    drawBackground();
    drawFans();
    drawSpikes();
    drawBoards();
    drawPortals();
    drawMagnets();
    drawHooks();
    drawBubbles();
    drawStickies();
    drawSprings();
    drawMushrooms();
    drawBalloons();
    drawStars();
    drawMonster();
    drawRopes();
    drawWinchAnchors();
    drawScissors();
    drawMoths();
    drawGremlins();
    drawGhosts();
    drawCandy();
    drawSparkles(dt);
    drawTrail();
    drawTowerClock();
    drawCombo(dt);
    drawOverlays();
  }

  // ---------- 主循环 ----------

  function tick(now: number): void {
    if (destroyed) return;
    const frameDt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (screen === "play") {
      acc += frameDt;
      let sub = 0;
      while (acc >= STEP && sub < 6) {
        step(STEP);
        acc -= STEP;
        sub++;
      }
      if (acc > STEP * 6) acc = 0;

      phaseTime += frameDt;
      if (bannerTime > 0) bannerTime -= frameDt;
      if (phase === "won") eatShowT += frameDt;

      // 糖果残影：每 ~30ms 记一个点，300ms 后自然淡完
      if (phase === "play" && !candyGone) {
        const c = candy();
        if (ghosts.length === 0 || simTime - ghosts[ghosts.length - 1].t > 0.03) {
          ghosts.push({ x: c.x, y: c.y, t: simTime });
        }
      }

      // 演出跑完（或被点掉）再进下一关，保证「接住 + 咀嚼 + 满足」看得完整
      const showDone = eatShowSkipped || eatShowT >= EAT_SHOW_MS / 1000;
      if (phase === "won" && showDone && phaseTime > 1.8) {
        if (mode === "endless") startTowerWave(towerWave + 1);
        else if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
        else showMap();
      }

      draw(frameDt);
    }
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------

  let pointerDown = false;
  let activePointerId = -1;
  let lastX = 0;
  let lastY = 0;
  let lastMoveAt = 0;
  let movedDist = 0;
  let downX = 0;
  let downY = 0;

  function toCanvasXY(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function toCanvas(e: PointerEvent): { x: number; y: number } {
    return toCanvasXY(e.clientX, e.clientY);
  }

  /** 把手指从上一个采样点划到 (x,y) 这一段交给割绳判定，并记一段划痕 */
  function feedSwipe(x: number, y: number, atMs: number): void {
    const d = Math.hypot(x - lastX, y - lastY);
    movedDist += d;
    if (d > 0.5) {
      const dtMs = Math.max(1, atMs - lastMoveAt);
      cutAt(lastX, lastY, x, y, (d / dtMs) * 1000);
      trail.push({ x, y, t: simTime });
    }
    lastX = x;
    lastY = y;
    lastMoveAt = atMs;
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (screen !== "play") return;
    e.preventDefault();
    if (phase === "failed") {
      retryLevel();
      return;
    }
    if (phase === "won") {
      // 演出可跳过：等不及的孩子点一下直接看结果
      eatShowSkipped = true;
      return;
    }
    pointerDown = true;
    activePointerId = e.pointerId;
    // 抓住指针：手指划出画布甚至划出屏幕边缘也照样收得到 move / up，不会卡住输入状态
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // 老浏览器没有 pointer capture，退回 window 上的 pointerup 兜底
    }
    const p = toCanvas(e);
    lastX = p.x;
    lastY = p.y;
    lastMoveAt = e.timeStamp;
    downX = p.x;
    downY = p.y;
    movedDist = 0;
    trail.push({ x: p.x, y: p.y, t: simTime });
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pointerDown || screen !== "play") return;
    if (activePointerId !== -1 && e.pointerId !== activePointerId) return;
    // 连续采样：浏览器为省电会把中间点合并掉，取回来逐点判交，快划才不会漏切
    let samples: PointerEvent[] = [];
    try {
      samples = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    } catch {
      samples = [];
    }
    if (samples.length === 0) samples = [e];
    for (const s of samples) {
      const p = toCanvasXY(s.clientX, s.clientY);
      feedSwipe(p.x, p.y, s.timeStamp || e.timeStamp);
    }
  };

  const endPointer = (): void => {
    if (activePointerId !== -1) {
      try {
        canvas.releasePointerCapture(activePointerId);
      } catch {
        // 已经自动释放过就算了
      }
      activePointerId = -1;
    }
  };

  const onPointerUp = (): void => {
    if (!pointerDown) {
      endPointer();
      return;
    }
    pointerDown = false;
    endPointer();
    if (movedDist < 12 && phase === "play") {
      // 轻点：先看是不是点了气球，否则试着戳破泡泡
      if (!tryPuff(downX, downY)) popBubble();
    }
  };

  const onPointerCancel = (): void => {
    // 系统手势打断:只收起划痕,不触发轻点动作
    pointerDown = false;
    endPointer();
  };

  /** 只响应"原地轻点"：连续割绳的滑动手势扫过按钮时不误触重试/返回 */
  function tapOnly(btn: HTMLButtonElement, handler: () => void): void {
    let downX2 = 0;
    let downY2 = 0;
    let swiped = false;
    btn.addEventListener("pointerdown", (e) => {
      downX2 = e.clientX;
      downY2 = e.clientY;
      swiped = false;
    });
    btn.addEventListener("pointermove", (e) => {
      if (Math.hypot(e.clientX - downX2, e.clientY - downY2) > 12) swiped = true;
    });
    btn.addEventListener("click", () => {
      if (swiped) {
        swiped = false;
        return;
      }
      handler();
    });
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  tapOnly(retryBtn, retryLevel);
  tapOnly(backBtn, () => {
    api.play("tap");
    showMap();
  });
  campaignBtn.addEventListener("click", () => {
    api.play("tap");
    campaignBtn.classList.add("on");
    endlessBtn.classList.remove("on");
    // 闯关档从「第一关还没打过的那关」接着玩
    const next = progress.stars.findIndex((s) => s === 0);
    startLevel(next < 0 ? 0 : next);
  });
  endlessBtn.addEventListener("click", () => {
    api.play("tap");
    endlessBtn.classList.add("on");
    campaignBtn.classList.remove("on");
    startTowerRun();
  });

  towerBest = save.getGameProgress("candy-swing").endlessBest;
  showMap();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    /**
     * 平台直达第 N 关（1 基）。本款是自建选关地图、不走 mountLevelGame，
     * 所以按第九节要求单独提供这个入口；越界会夹到合法范围。
     */
    openCampaignLevel(n: number) {
      const i = Math.max(0, Math.min(LEVELS.length - 1, Math.round(n) - 1));
      campaignBtn.classList.add("on");
      endlessBtn.classList.remove("on");
      stopSpeaking();
      startLevel(i);
      return i + 1;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      stopSpeaking();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      endPointer();
      pointerDown = false;
      // 物理世界与演出队列一起清空，免得残留引用挂着旧关卡数据
      particles = [];
      links = [];
      stars = [];
      bubbles = [];
      hooks = [];
      boards = [];
      balloons = [];
      scissorsArr = [];
      moths = [];
      gremlins = [];
      winches = [];
      stickies = [];
      springs = [];
      mushrooms = [];
      bubbleSticky = createSticky();
      bubbleStickyAt = null;
      ropeLinkRanges = [];
      trail.length = 0;
      ghosts.length = 0;
      sparkles.length = 0;
      wrap.remove();
    },
  };
}
