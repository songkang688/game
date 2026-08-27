import { meta } from "./meta";
export { meta };

// 彩虹跑跑:188 关十二大主题世界跑酷战役!先选世界再选关,每关一个小任务,
// 滚滚球、电光门、彩纸箱等八种障碍,喷气鞋/磁铁/滑板道具,还能花星星复活一次!
// 1.1 新增:可铲碎的彩纸箱、加速滑轨、三连完美跳节奏段、随机分岔路线与三位章节大王。
// 另有「无尽彩虹跑」:一直跑吃金币,每 1600 米换世界,越跑越快,挑战最远纪录!
//
// 1.1 第 6 步把画面换成了 2.5D 伪三维:三条车道向地平线收敛,地面铺网格线,
// 天边挂两三层视差远景,远端化进雾里。玩法仍然跑在原来的平面轨道坐标上
// (障碍存 trackY、判定用 HIT_WINDOW),透视只发生在绘制那一刻——
// 所以 188 关战役的可通关性一点没变。同一步还加了土狼时间与输入缓冲、
// 程序化拼接的无限模式,以及掉帧自动降画质。
//
// 1.2 第 9 步接着往下做,全都长在那一版 2.5D 之上:
//  · 日夜与天气——无尽按距离循环晨 / 昼 / 黄昏 / 夜,雨天地面多几条反光(daynight.ts);
//  · 幽灵竞速——上一趟的操作录成快照,这一趟半透明的自己同场跑(ghost.ts);
//  · 路段语法——三连节拍、低梁抢道、彩纸箱链、分岔合流四种新模板(endless.ts);
//  · 手感——换道 100ms、跳跃按初速与重力积分、换道侧倾(motion.ts);
//  · 平台接线——直开第 N 关、家长跳关、无尽成绩上报、收藏册加成(campaign.ts)。
// 188 关的关卡表一个数都没动,改的只有渲染与手感。
import {
  BOARD_SECONDS,
  BOSSES,
  BossDef,
  CRATE_SCORE,
  ForkGate,
  HIT_WINDOW,
  JET_SECONDS,
  JUMP_TIME,
  LEVELS,
  LevelDef,
  MAGNET_SECONDS,
  MAX_HEARTS,
  Mission,
  ObstacleKind,
  PERFECT_STREAK_GOAL,
  PatternRow,
  PlayerAction,
  PowerKind,
  PROGRESS_KEY,
  RAIL_SECONDS,
  REVIVE_COST,
  ROLLER_SPEED_MULT,
  ROW_GAP,
  RunStats,
  SLIDE_TIME,
  THEME_ORDER,
  THEME_STYLE,
  bossDefeated,
  bossHitsOf,
  clampLane,
  clearSpeechLine,
  completesPerfectRun,
  detectSwipe,
  forkRows,
  isPerfectJump,
  missionDone,
  missionLabel,
  missionProgress,
  nextPerfectStreak,
  parseProgress,
  patternsForLevel,
  pickFork,
  railSpeedMult,
  retrySpeechLine,
  serializeProgress,
  smashesCrate,
  starsForLevel,
  themeCleared,
  themeIndexOfLevel,
  themeOffset,
  themeSize,
  themeStars,
  totalStars,
  wouldHit,
  zapperActive,
} from "./logic";
import type { ThemeStyle } from "./logic";
import {
  COYOTE_TIME,
  RunInput,
  feelConsume,
  feelPress,
  feelTick,
  hasBufferedJump,
  hasCoyote,
  initJumpFeel,
  inputForKey,
  inputForSwipe,
  laneStep,
} from "./controls";
import {
  CHASER_COIN_BONUS,
  CHASER_DODGE_BONUS,
  CHASER_EMOJI,
  CHASER_NAME,
  CHASER_PERFECT_BONUS,
  CHASER_RAIL_BONUS,
  CHASER_START_GAP,
  ENDLESS_RECORD_KEY,
  EndlessRecord,
  EndlessSegment,
  FailKind,
  buildSegment,
  chaserBoost,
  chaserCaught,
  chaserDrift,
  chaserPenalty,
  chaserWarning,
  emptyRecord,
  failCopy,
  mergeRecord,
  parseRecord,
  recordBroken,
  recordLine,
  serializeRecord,
  tierForDistance,
} from "./endless";
import {
  Camera,
  LANE_SPREAD,
  PARALLAX_LAYERS,
  Projected,
  QUALITY_TIERS,
  SPAWN_TRACK_Y,
  clampDt,
  depthOf,
  edgeOffset,
  fogAlpha,
  groundGridDepths,
  laneOffset,
  makeCamera,
  mixHex,
  nextQualityTier,
  parallaxShift,
  particleCount,
  projectFlatX,
  projectTrack,
  scaleAtDepth,
  screenYAtDepth,
  smoothFps,
  smoothing,
  withAlpha,
} from "./view3d";
import {
  JUMP_RISE,
  SLIDE_LOCK,
  glideLane,
  groundedBody,
  launchBody,
  renderLift,
  shadowScale,
  stepJump,
  tiltFor,
} from "./motion";
import type { JumpBody } from "./motion";
import {
  DAY_CYCLE_METERS,
  STATIC_DAY,
  lightingAt,
  lightingLabel,
  shade,
} from "./daynight";
import type { Lighting } from "./daynight";
import {
  GHOST_KEY,
  GhostPlayer,
  GhostRecorder,
  ghostGap,
  ghostGapLine,
  ghostResultLine,
  parseGhost,
  serializeGhost,
} from "./ghost";
import type { GhostRun } from "./ghost";
import {
  CAMPAIGN_TOTAL,
  SKIP_KEY,
  bestEndlessMeters,
  clampLevelIndex,
  describeBoosts,
  initialLevelIndex,
  isUnlockedWith,
  mergeSkip,
  neutralBoosts,
  parseSkipList,
  readLegacyMeters,
  readRunnerBoosts,
  serializeSkipList,
} from "./campaign";
import type { RunnerBoosts } from "./campaign";
import { touchArea } from "./touch";
import type { Rect } from "./touch";
import { save } from "../../engine/save";
import { getLevelExtras } from "../../ui/level188Contract";
import { speak, stopSpeaking } from "../speech";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
  /** 平台可以指定直接开第几关(1 基);不给就读 `?level=`,再没有才走选世界 */
  initialLevel?: number;
}

/** mount 返回的东西:除了 destroy,还得给平台一个「直开第 N 关」的入口。 */
export interface RainbowRunHandle {
  destroy: () => void;
  /** 直接开跑第 n 关(1 基),越界夹到两端 */
  openCampaignLevel: (n: number) => void;
}

type Phase = "themes" | "map" | "intro" | "run" | "clear" | "retry";

interface Obstacle {
  baseLane: number;
  kind: ObstacleKind;
  /** 轨道坐标:玩家线在 playerY(),数字越小离得越远 */
  y: number;
  phase: number;
  /** 已经结算过(铲碎/完美跳判定),不再重复计 */
  done?: boolean;
  /** 坑洞专用:踏上坑沿之后攒的土狼时间,过了这一段还没跳才算掉下去 */
  grace?: number;
}

interface Pickup {
  kind: "star" | "coin" | "rail" | PowerKind;
  lane: number;
  x: number;
  y: number;
  taken: boolean;
}

/** 分岔路牌:滚到玩家身位时,按当时站的道决定接下来跑哪一条支线。 */
interface ForkSign {
  gate: ForkGate;
  y: number;
  chosen: "left" | "right" | null;
}

interface Puff {
  x: number;
  y: number;
  life: number;
  color: string;
}

interface Floaty {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  big: boolean;
}

function loadProgress(): number[] {
  try {
    return parseProgress(localStorage.getItem(PROGRESS_KEY), LEVELS.length);
  } catch {
    return parseProgress(null, LEVELS.length);
  }
}

function saveProgress(stars: number[]): void {
  try {
    localStorage.setItem(PROGRESS_KEY, serializeProgress(stars));
  } catch {
    // 静默失败
  }
}

/* ---- 无尽跑:随距离换世界,速度有封顶,记录最远距离与最高糖果数 ---- */

/** 每跑多少米换一个主题世界。 */
const ENDLESS_STAGE_LEN = 1600;
const ENDLESS_BASE_SPEED = 250;
const ENDLESS_MAX_SPEED = 500;

function endlessSpeedAt(dist: number): number {
  return Math.min(ENDLESS_MAX_SPEED, ENDLESS_BASE_SPEED + dist * 0.02);
}

function loadEndlessRecord(): EndlessRecord {
  try {
    return parseRecord(localStorage.getItem(ENDLESS_RECORD_KEY));
  } catch {
    return emptyRecord();
  }
}

function saveEndlessRecord(r: EndlessRecord): void {
  try {
    localStorage.setItem(ENDLESS_RECORD_KEY, serializeRecord(r));
  } catch {
    // 静默失败
  }
}

/** 隐私模式下 localStorage 一碰就抛,读写全都包一层,读不到就当没有。 */
function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 静默失败:这一局照样能玩,只是关掉页面不留痕
  }
}

/**
 * 无尽最好成绩统一上报给平台。老 key 只读一次取最大值,
 * 一路只涨不降——迁移绝不会把谁的纪录清零。
 */
function syncEndlessBest(record: EndlessRecord): number {
  const platform = save.getGameProgress(meta.id).endlessBest;
  const legacy = readLegacyMeters({ getItem: readKey });
  const best = bestEndlessMeters(record, legacy, platform);
  try {
    return save.recordEndlessBest(meta.id, best);
  } catch {
    return best;
  }
}

function loadGhost(): GhostRun | null {
  return parseGhost(readKey(GHOST_KEY));
}

function saveGhost(run: GhostRun): void {
  writeKey(GHOST_KEY, serializeGhost(run));
}

function loadSkips(): number[] {
  return parseSkipList(readKey(SKIP_KEY));
}

/** 地址栏的查询串;测试环境或者被沙箱掐掉时当没有。 */
function safeSearch(): string {
  try {
    return window.location.search ?? "";
  } catch {
    return "";
  }
}

/** 用户把系统动效关掉了:换道只留位移,不再侧倾。 */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

/**
 * 收藏册是另一个窗口在做的,可能还没进仓库。
 * 用 glob 探一眼:文件不在就连按钮都不画,绝不因为缺模块把跑酷打崩。
 */
const COLLECTION_MODULES = import.meta.glob("../../ui/collection.ts");
const COLLECTION_PATH = "../../ui/collection.ts";

function hasCollection(): boolean {
  return typeof COLLECTION_MODULES[COLLECTION_PATH] === "function";
}

async function openCollectionSafely(): Promise<void> {
  const loader = COLLECTION_MODULES[COLLECTION_PATH];
  if (typeof loader !== "function") return;
  try {
    const mod = (await loader()) as { openCollection?: () => void };
    mod.openCollection?.();
  } catch {
    // 收藏册加载失败就当没这个按钮,跑酷照常玩
  }
}

export function mount(api: GameAPI): RainbowRunHandle {
  const { root } = api;
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  let w = 640;
  let h = 480;
  let cam: Camera = makeCamera(w, h);
  function syncSize(): void {
    w = root.clientWidth || 640;
    h = root.clientHeight || 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cam.w !== w || cam.h !== h) cam = makeCamera(w, h);
  }
  syncSize();

  // 车道中心线的「平面 x」:2.5D 只在画的时候按深度把它收向消失点,
  // 判定与磁铁吸附全都还在这套平面坐标里,一个数都没变。
  const laneX = (lane: number) => w / 2 + laneOffset(w, lane);
  const playerY = () => cam.playerY;
  /** 轨道坐标 + 车道 → 屏幕坐标与缩放 */
  const proj = (trackY: number, laneF: number): Projected => projectTrack(cam, trackY, laneF);
  /** 远到几乎看不见就不用画了 */
  const VISIBLE_SCALE = 0.07;

  const progress = loadProgress();
  /** 家长授权跳过的关(0 基);跳过的关星级仍是 0,但下一关照样解锁 */
  let skips = loadSkips();
  const levelUnlocked = (idx: number): boolean => isUnlockedWith(progress, skips, idx);
  const themeUnlocked = (ci: number): boolean => levelUnlocked(themeOffset(ci));

  // ---- 局状态 ----
  let levelIdx = 0;
  let chapterIdx = 0;
  let phase: Phase = "themes";
  let lane = 1;
  let laneFloat = 1;
  let action: PlayerAction = "run";
  let actionTimer = 0;
  let jumpsUsed = 0;
  let hearts = MAX_HEARTS;
  let invincible = 0;
  let time = 0;
  let dist = 0;
  let score = 0;
  let speed = 250;
  let scrollPhase = 0;
  let shake = 0;
  let magnetTimer = 0;
  let jetTimer = 0;
  let boardTimer = 0;
  let railTimer = 0;
  let jumpElapsed = 0;
  let jumpJudged = false;
  let perfectStreak = 0;
  let reviveUsed = false;
  /** 宠物「绵绵」白送的那一次接住,不花星星 */
  let petReviveLeft = 0;
  let earnedStars: 1 | 2 | 3 = 1;
  let missionOk = false;
  let finaleFired = false;
  let destroyed = false;
  let boss: BossDef | null = null;
  let bossBeaten = false;
  let loseReason: "hearts" | "boss" = "hearts";
  /** 无尽模式里这一趟是怎么结束的:撞障碍 / 掉坑 / 被追上 */
  let failKind: FailKind = "crash";

  // ---- 手感:土狼时间 + 输入缓冲 + 按 dt 积分的跳跃 ----
  let jumpFeel = initJumpFeel();
  /** 跳跃的高度与竖直速度:每帧按重力积分,不按帧数扫一条 sin 曲线 */
  let jumpBody: JumpBody = groundedBody();
  /** 这次下滑贴地多久了:过了 SLIDE_LOCK 就能被跳跃打断 */
  let slideElapsed = 0;
  const reducedMotion = prefersReducedMotion();

  // ---- 收藏册加成(只读收藏册,加成一律封顶) ----
  let boosts: RunnerBoosts = neutralBoosts();

  // ---- 日夜与天气:无尽按距离循环,战役固定白昼 ----
  let light: Lighting = STATIC_DAY;

  // ---- 幽灵竞速 ----
  let ghostBest: GhostRun | null = loadGhost();
  let ghostPlayer: GhostPlayer | null = null;
  let ghostRec: GhostRecorder | null = null;
  /** 幽灵这一刻站在哪条道、正在做什么 */
  let ghostLane = 1;
  let ghostLaneFloat = 1;
  let ghostAction: PlayerAction = "run";
  let ghostBody: JumpBody = groundedBody();
  let ghostAlive = false;
  /** 这一趟同场跑的是哪一份快照(结算时要拿它比一比;`ghostBest` 结算里会被换掉) */
  let ghostRaced: GhostRun | null = null;
  /** 结算面板上那一行幽灵战报(没有幽灵就是空串,那一行不画) */
  let ghostReport = "";
  /** 这一趟从起跑算起过了多少毫秒(幽灵回放与录制共用同一条时间线) */
  let runMs = 0;

  // ---- 帧率自适应画质 ----
  let fps = 60;
  let qualityTier = 0;

  const stats: RunStats = {
    coins: 0,
    stars: 0,
    dodged: 0,
    heartsLost: 0,
    smashed: 0,
    perfectRuns: 0,
    bossHits: 0,
  };

  const obstacles: Obstacle[] = [];
  const pickups: Pickup[] = [];
  const puffs: Puff[] = [];
  const floats: Floaty[] = [];
  // 画之前按深度排一次序,远的先画;复用同一对数组,不每帧新建
  const drawOrder: Obstacle[] = [];
  const pickOrder: Pickup[] = [];

  let patternPool: PatternRow[][] = patternsForLevel(LEVELS[0]);
  let pendingRows: PatternRow[] = [];
  let rowDist = 0;
  let powerTimer = 8;
  let forkSign: ForkSign | null = null;
  let forkTimer = Infinity;

  // ---- 无尽跑状态 ----
  let endless = false;
  let endlessRecord = loadEndlessRecord();
  /** 这一趟结算时用来比对的旧纪录(结算面板要显示「破了没有」) */
  let recordBefore = emptyRecord();
  /** 程序化路段:接着上一段的必过车道往下拼,段与段之间横移不超过一格 */
  let endlessLane = 1;
  let endlessSeg: EndlessSegment | null = null;
  /** 追风棉花云离玩家还有多远(轨道像素),归零就是被追上 */
  let chaserGap = CHASER_START_GAP;
  let btnEndless: Rect | null = null;
  let btnCollection: Rect | null = null;
  const endlessDef: LevelDef = {
    name: "无尽彩虹跑",
    world: "grass",
    len: Infinity,
    speed: ENDLESS_BASE_SPEED,
    obstacleKinds: [...THEME_STYLE.grass.palette],
    powerups: ["magnet", "jet", "board"],
    mission: { type: "coins", n: 999999 },
    feature: "endless",
    hint: "一直跑一直跑!吃金币躲障碍,每 1600 米换一个世界,越跑越快!",
  };

  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  const themeCards: Array<{ idx: number; rect: Rect }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnRevive: Rect | null = null;
  /** 「跳过这一关」:壳层没注册家长授权门时压根不画 */
  let btnSkip: Rect | null = null;
  let skipPending = false;
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };

  // ---- 手势 ----
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swiping = false;
  let swipeDone = false;

  function level() {
    return endless ? endlessDef : LEVELS[levelIdx];
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.8, big });
  }

  function obstacleLane(o: Obstacle): number {
    if (o.kind !== "cloudy") return o.baseLane;
    return clampLane(Math.round(o.baseLane + Math.sin(o.phase) * 1.2));
  }

  /** 真正起跳。返回有没有跳成。 */
  function startJump(second = false): boolean {
    action = "jump";
    actionTimer = JUMP_TIME;
    jumpsUsed = second ? 2 : 1;
    jumpElapsed = 0;
    jumpJudged = false;
    slideElapsed = 0;
    // 抛物线交给初速与重力,滞空时长仍旧是 JUMP_TIME(两者是同一组数反推出来的)
    jumpBody = launchBody();
    api.play("jump");
    if (second) addFloat(laneX(lane), playerY() - 90, "二段跳!", "#8a5ac9");
    return true;
  }

  function doInput(input: RunInput): void {
    if (destroyed || phase !== "run") return;
    // 幽灵竞速:这一趟的每一个操作都记一笔,下一趟半透明的自己照着重跑
    ghostRec?.push(runMs, input);
    if (input === "left" || input === "right") {
      const next = clampLane(lane + laneStep(input));
      if (next !== lane) {
        lane = next;
        api.play("tap");
      }
      return;
    }
    if (input === "jump") {
      // 滑板二段跳是空中专属的,不走缓冲那条路
      if (action === "jump" && boardTimer > 0 && jumpsUsed < 2) {
        startJump(true);
        return;
      }
      // 滑到一半想跳:锁定期一过就放行。低梁抢道那种「滑过去马上换道再跳」
      // 的路段就是靠这一下接上的,锁定期本身比一次跳跃短得多。
      if (action === "slide" && slideCanCancelNow()) {
        action = "run";
        actionTimer = 0;
      }
      // 其余情况先记下这一按:能跳就当帧跳,跳不了就交给输入缓冲,
      // 落地那一刻 update() 会自动把它补上。
      jumpFeel = feelPress(jumpFeel);
      return;
    }
    if (action !== "slide") {
      action = "slide";
      actionTimer = SLIDE_TIME;
      slideElapsed = 0;
      api.play("tap");
    }
  }

  /** 这一次下滑已经贴地够久,可以被别的动作打断了吗。 */
  function slideCanCancelNow(): boolean {
    return slideElapsed >= SLIDE_LOCK;
  }

  /**
   * 开跑那一刻罩多久的无敌。
   * 基础 1.5 秒;宠物「泡泡」的起步护罩比它长时就用护罩那个数——
   * 不然点一下开始就把收藏册的加成抹掉了。
   */
  function startShield(): number {
    return Math.max(1.5, boosts.startShieldMs / 1000);
  }

  /**
   * 直开第 n 关(1 基)。越界夹到 1..188,不合法的数字当第 1 关。
   * 平台给了 `initialLevel`、地址栏带着 `?level=`,或者外面拿着 handle 调进来,走的都是这一条。
   */
  function openCampaignLevel(n: number): void {
    if (destroyed) return;
    stopSpeaking();
    loadLevel(clampLevelIndex(n));
  }

  /** 这一关能不能跳:战役里、不是最后一关、壳层注册过家长授权门。 */
  function canSkip(): boolean {
    return (
      !endless &&
      levelIdx < CAMPAIGN_TOTAL - 1 &&
      typeof getLevelExtras().requestSkip === "function"
    );
  }

  /**
   * 跳过这一关。授权是家长那道高权限门给的,这边只负责记账:
   * 星级仍旧记 0(跳过去不是本事),但下一关照样解锁——和 188 关框架同一个口径。
   */
  function askSkip(): void {
    const request = getLevelExtras().requestSkip;
    if (!request || skipPending || !canSkip()) return;
    const target = levelIdx;
    skipPending = true;
    api.play("tap");
    Promise.resolve(request(meta.id, target))
      .then((ok) => {
        if (destroyed || !ok) return;
        skips = mergeSkip(readKey(SKIP_KEY), target);
        writeKey(SKIP_KEY, serializeSkipList(skips));
        api.play("win");
        if (target < CAMPAIGN_TOTAL - 1) openCampaignLevel(target + 2);
      })
      .catch(() => {
        // 授权那边出问题就当没点过,不打断这一关
      })
      .finally(() => {
        skipPending = false;
      });
  }

  function loadLevel(idx: number): void {
    endless = false;
    levelIdx = clampLevelIndex(idx + 1);
    chapterIdx = themeIndexOfLevel(levelIdx);
    const def = LEVELS[levelIdx];
    patternPool = patternsForLevel(def);
    boss = def.boss ? BOSSES[def.boss] : null;
    resetLevel();
    phase = "intro";
  }

  function startEndless(): void {
    endless = true;
    endlessDef.world = "grass";
    boss = null;
    patternPool = patternsForLevel(endlessDef);
    resetLevel();
    phase = "intro";
  }

  /** 无尽模式:这一趟结束了,先结算纪录再弹面板。 */
  function endEndlessRun(kind: FailKind): void {
    failKind = kind;
    loseReason = "hearts";
    recordBefore = { ...endlessRecord };
    const meters = Math.floor(dist);
    const run: EndlessRecord = { meters, coins: stats.coins };
    const brokeMeters = recordBroken(endlessRecord, run).meters;
    endlessRecord = mergeRecord(endlessRecord, run);
    saveEndlessRecord(endlessRecord);
    // 无尽成绩统一上报平台(老 key 在这里顺带被读一次并入最大值)
    syncEndlessBest(endlessRecord);
    // 战报要在换幽灵之前算:换完 ghostBest 就是这一趟自己了,再比就没意义
    ghostReport = ghostResultLine(meters, ghostRaced);
    // 跑赢了上一趟才换幽灵:留着的永远是自己最好的那一趟
    if (ghostRec && (brokeMeters || !ghostBest)) {
      ghostBest = ghostRec.finish(meters);
      saveGhost(ghostBest);
    }
    ghostRec = null;
    ghostPlayer = null;
    ghostAlive = false;
    hearts = 0;
    phase = "retry";
    api.play("oops");
    shake = 0.45;
    speak(failCopy(kind, dist).line);
  }

  /**
   * 幽灵推进一帧:按上一趟录下来的时间线走位。
   * 它不参与任何判定——撞不到人,也撞不到障碍,纯粹是个参照物。
   */
  function stepGhost(dt: number): void {
    if (!ghostPlayer) return;
    const state = ghostPlayer.seek(runMs);
    if (state.lane !== ghostLane) ghostLane = state.lane;
    ghostLaneFloat = glideLane(ghostLaneFloat, ghostLane, dt);
    if (state.action === "jump" && ghostAction !== "jump") ghostBody = launchBody();
    ghostAction = state.action;
    ghostBody = stepJump(ghostBody, dt);
    // 快照放完了幽灵就淡出:上一趟就是跑到这儿结束的
    if (state.finished) ghostAlive = false;
  }

  /** 无尽跑:根据当前距离切换主题世界(换世界时广播一下)。 */
  function syncEndlessTheme(): void {
    const stage = Math.floor(dist / ENDLESS_STAGE_LEN) % THEME_ORDER.length;
    const world = THEME_ORDER[stage];
    if (endlessDef.world !== world) {
      endlessDef.world = world;
      endlessDef.obstacleKinds = [...THEME_STYLE[world].palette];
      patternPool = patternsForLevel(endlessDef);
      // 换世界只换皮:待刷的那一段留着不动,免得把必过窗口从中间切断
      if (dist > 50) {
        const st = THEME_STYLE[world];
        addFloat(w / 2, h * 0.35, `${st.emoji} 进入${st.name}!`, st.accent, true);
        api.play("win");
      }
    }
  }

  function resetLevel(): void {
    dist = 0;
    score = 0;
    obstacles.length = 0;
    pickups.length = 0;
    pendingRows = [];
    rowDist = 0;
    powerTimer = 7;
    hearts = MAX_HEARTS;
    invincible = 2;
    lane = 1;
    laneFloat = 1;
    action = "run";
    actionTimer = 0;
    jumpsUsed = 0;
    magnetTimer = 0;
    jetTimer = 0;
    boardTimer = 0;
    railTimer = 0;
    jumpElapsed = 0;
    jumpJudged = false;
    jumpFeel = initJumpFeel();
    jumpBody = groundedBody();
    slideElapsed = 0;
    perfectStreak = 0;
    forkSign = null;
    forkTimer = level().fork ? 5 : Infinity;
    bossBeaten = false;
    reviveUsed = false;
    endlessLane = 1;
    endlessSeg = null;
    chaserGap = CHASER_START_GAP;
    failKind = "crash";
    runMs = 0;
    // 收藏册每一局读一次:跑到一半去换装备不该让这一趟的手感变来变去
    boosts = readRunnerBoosts();
    petReviveLeft = boosts.reviveOnce ? 1 : 0;
    // 开跑那一下会重新罩一次(intro 面板期间这个值就在往下走了),这里只是先摆上
    invincible = startShield();
    light = endless ? lightingAt(0) : STATIC_DAY;
    // 幽灵竞速只在无尽模式开:战役有固定关卡长度,比的是星级不是里程
    ghostRec = endless ? new GhostRecorder() : null;
    ghostPlayer = endless && ghostBest && ghostBest.events.length > 0 ? new GhostPlayer(ghostBest) : null;
    ghostPlayer?.reset();
    ghostAlive = ghostPlayer !== null;
    ghostRaced = ghostPlayer ? ghostBest : null;
    ghostReport = "";
    ghostLane = 1;
    ghostLaneFloat = 1;
    ghostAction = "run";
    ghostBody = groundedBody();
    stats.coins = 0;
    stats.stars = 0;
    stats.dodged = 0;
    stats.heartsLost = 0;
    stats.smashed = 0;
    stats.perfectRuns = 0;
    stats.bossHits = 0;
  }

  function levelCleared(): void {
    const def = level();
    missionOk = missionDone(def.mission, stats);
    earnedStars = starsForLevel(missionOk, stats.heartsLost);
    const prev = progress[levelIdx] ?? 0;
    const gained = Math.max(0, earnedStars - prev);
    progress[levelIdx] = Math.max(prev, earnedStars);
    saveProgress(progress);
    phase = "clear";
    api.play("win");
    if (levelIdx >= LEVELS.length - 1 && !finaleFired) {
      finaleFired = true;
      api.onWin(
        earnedStars,
        `${LEVELS.length} 关十二大世界跑酷全部通关!总星 ${totalStars(progress)}/${LEVELS.length * 3}`,
      );
    } else {
      // 结算面板自动朗读(终局走平台弹窗,那边自带朗读,不叠音)
      speak(clearSpeechLine(def.name, earnedStars, missionOk));
      if (gained > 0) api.addStars(gained);
    }
  }

  /** 大王关专属的失败:好好跑到终点,但护甲没卸完,他就溜走了。 */
  function bossEscaped(): void {
    loseReason = "boss";
    phase = "retry";
    api.play("oops");
    speak(
      `${boss?.name ?? "大王"}还剩一点力气就溜走了!这一次打中 ${bossHitsOf(stats)} 下,再来一次多铲几个箱子!`,
    );
  }

  function onHit(x: number, y: number): void {
    if (invincible > 0 || jetTimer > 0) return;
    if (boardTimer > 0) {
      boardTimer = 0;
      invincible = 1.5;
      api.play("pop");
      addFloat(laneX(lane), playerY() - 60, "滑板帮你挡住啦!", "#8a5ac9", true);
      return;
    }
    hearts--;
    stats.heartsLost++;
    invincible = 1.5;
    shake = 0.4;
    api.play("oops");
    for (let k = 0; k < particleCount(8, qualityTier); k++) {
      puffs.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 50,
        life: 0.5,
        color: "#ffffff",
      });
    }
    // 无尽模式:撞一下追风棉花云就贴近一大截
    if (endless) chaserGap = chaserPenalty(chaserGap);
    if (hearts <= 0) {
      if (petCatches()) return;
      if (endless) {
        endEndlessRun("crash");
        return;
      }
      loseReason = "hearts";
      phase = "retry";
      speak(retrySpeechLine(false, Math.floor(dist), false));
    }
  }

  /**
   * 收藏册里的棉花小兔「绵绵」:一局白接你一次,不花星星。
   * 只在真要摔倒的那一刻用掉,平时撞一下不会浪费。
   */
  function petCatches(): boolean {
    if (petReviveLeft <= 0) return false;
    petReviveLeft--;
    hearts = 1;
    invincible = 2;
    api.play("win");
    addFloat(laneX(lane), playerY() - 70, "绵绵接住你啦!", "#ffc2d6", true);
    return true;
  }

  // ---- 输入 ----
  function inRect(x: number, y: number, r: Rect | null): boolean {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function onPointerDown(e: PointerEvent): void {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (phase === "themes") {
      if (inRect(x, y, btnEndless)) {
        api.play("jump");
        startEndless();
        return;
      }
      if (inRect(x, y, btnCollection)) {
        api.play("tap");
        void openCollectionSafely();
        return;
      }
      for (const c of themeCards) {
        if (inRect(x, y, c.rect)) {
          if (themeUnlocked(c.idx)) {
            api.play("tap");
            chapterIdx = c.idx;
            phase = "map";
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "map") {
      if (inRect(x, y, btnBack)) {
        api.play("tap");
        phase = "themes";
        return;
      }
      for (const n of mapNodes) {
        if (Math.hypot(x - n.x, y - n.y) <= n.r + 6) {
          if (levelUnlocked(n.idx)) {
            api.play("tap");
            loadLevel(n.idx);
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "intro") {
      if (inRect(x, y, btnBack)) {
        api.play("tap");
        phase = endless ? "themes" : "map";
        return;
      }
      api.play("tap");
      phase = "run";
      invincible = startShield();
      return;
    }
    if (phase === "clear") {
      if (inRect(x, y, btnNext) && levelIdx < LEVELS.length - 1) {
        api.play("tap");
        stopSpeaking();
        loadLevel(levelIdx + 1);
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = "map";
      }
      return;
    }
    if (phase === "retry") {
      if (inRect(x, y, btnRevive) && !reviveUsed && api.getStars() >= REVIVE_COST) {
        reviveUsed = true;
        api.addStars(-REVIVE_COST);
        hearts = MAX_HEARTS;
        invincible = 2.5;
        // 复活也把追风棉花云推回起手距离,不然一睁眼又被追上
        chaserGap = CHASER_START_GAP;
        obstacles.length = 0;
        phase = "run";
        api.play("win");
        stopSpeaking();
        addFloat(w / 2, h / 2, "复活啦!继续冲!", "#e0a030", true);
        return;
      }
      if (inRect(x, y, btnSkip)) {
        askSkip();
        return;
      }
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        stopSpeaking();
        resetLevel();
        phase = "run";
        invincible = startShield();
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = endless ? "themes" : "map";
      }
      return;
    }

    if (inRect(x, y, btnBack)) {
      api.play("tap");
      phase = endless ? "themes" : "map";
      return;
    }

    swiping = true;
    swipeDone = false;
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
  }

  function onPointerMove(e: PointerEvent): void {
    if (!swiping || swipeDone) return;
    // 触控修复:滑动阈值统一为 24px(原来滑动中 28 / 松手 24 不一致),
    // 360px 窄屏一年级短滑约 30~40px,24px 阈值实测能稳定触发且不误触
    const dir = detectSwipe(e.clientX - swipeStartX, e.clientY - swipeStartY, 24);
    if (dir) {
      swipeDone = true;
      doInput(inputForSwipe(dir));
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (swiping && !swipeDone) {
      const dir = detectSwipe(e.clientX - swipeStartX, e.clientY - swipeStartY, 24);
      if (dir) doInput(inputForSwipe(dir));
    }
    swiping = false;
  }

  /** 跳:上滑 / W / ↑ / 空格;换道:左右滑 / A D / ← →;滚翻:下滑 / S / ↓ */
  function onKeyDown(e: KeyboardEvent): void {
    const input = inputForKey(e.key);
    if (input) {
      e.preventDefault();
      doInput(input);
    }
  }

  // ---- 关卡推进 ----
  function spawnRow(row: PatternRow): void {
    const y = SPAWN_TRACK_Y;
    for (const o of row.obstacles) {
      obstacles.push({ baseLane: o.lane, kind: o.kind, y, phase: Math.random() * Math.PI * 2 });
    }
    for (const l of row.stars) {
      pickups.push({ kind: "star", lane: l, x: laneX(l), y, taken: false });
    }
    for (const l of row.coins) {
      pickups.push({ kind: "coin", lane: l, x: laneX(l), y, taken: false });
    }
    // 无尽模式的滑轨由路段模板自己带,战役沿用关卡开关
    if (level().rails || endless) {
      for (const l of row.rails ?? []) {
        pickups.push({ kind: "rail", lane: l, x: laneX(l), y, taken: false });
      }
    }
  }

  /** 无尽模式:pending 空了就现拼一段,接着上一段的必过车道往下走。 */
  function refillEndlessRows(): void {
    endlessSeg = buildSegment(dist, endlessLane, Math.random);
    endlessLane = endlessSeg.clearPath[endlessSeg.clearPath.length - 1];
    pendingRows = cloneRows(endlessSeg.rows);
  }

  function cloneRows(rows: ReadonlyArray<PatternRow>): PatternRow[] {
    return rows.map((r) => ({
      obstacles: r.obstacles.map((o) => ({ ...o })),
      stars: [...r.stars],
      coins: [...r.coins],
      rails: r.rails ? [...r.rails] : undefined,
      beat: r.beat,
    }));
  }

  /** 卸大王的护甲:铲箱 1 层,三连完美跳 2 层。卸满就当场宣布打赢。 */
  function syncBossHits(): void {
    stats.bossHits = bossHitsOf(stats);
    if (boss && !bossBeaten && bossDefeated(boss, stats)) {
      bossBeaten = true;
      api.play("win");
      addFloat(w / 2, h * 0.32, `${boss.emoji} ${boss.name}被打趴下了!冲向终点!`, "#e05a7a", true);
    }
  }

  function update(dt: number): void {
    time += dt;
    shake = Math.max(0, shake - dt);
    invincible = Math.max(0, invincible - dt);
    magnetTimer = Math.max(0, magnetTimer - dt);
    jetTimer = Math.max(0, jetTimer - dt);
    boardTimer = Math.max(0, boardTimer - dt);
    railTimer = Math.max(0, railTimer - dt);
    for (let i = puffs.length - 1; i >= 0; i--) {
      puffs[i].life -= dt;
      puffs[i].y -= dt * 40;
      if (puffs[i].life <= 0) puffs.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= dt * 34;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }

    if (phase !== "run") return;

    runMs += dt * 1000;
    // 跳跃高度按初速与重力积分:60fps 与 30fps 抬到同样的高度、同一刻落地
    jumpBody = stepJump(jumpBody, dt);
    if (action === "slide") slideElapsed += dt;

    // 脚下有没有地:跑在坑洞上方就算踏空了,土狼时间从这一刻开始走
    const overPit = obstacles.some(
      (o) =>
        o.kind === "pit" &&
        !o.done &&
        o.baseLane === lane &&
        Math.abs(o.y - playerY()) < HIT_WINDOW,
    );
    const onGround = action !== "jump" && !overPit;
    jumpFeel = feelTick(jumpFeel, dt, onGround);
    // 输入缓冲 + 土狼时间:提前按下的跳落地就补上,刚踏空的一小会儿也还跳得起来
    if (hasBufferedJump(jumpFeel) && action !== "jump" && hasCoyote(jumpFeel, onGround)) {
      startJump();
      jumpFeel = feelConsume(jumpFeel);
    }

    const def = level();
    if (endless) {
      // 收藏册的速度加成只作用在无尽模式:188 关的速度是配平过的,动了就等于改关卡数据
      speed = endlessSpeedAt(dist) * boosts.speedMul;
      syncEndlessTheme();
      light = lightingAt(dist);
      stepGhost(dt);
    } else {
      const frac = Math.min(1, dist / def.len);
      speed = def.speed * (1 + frac * 0.1);
    }
    // 加速滑轨:踩上去的这几秒整条路都变快
    speed *= railSpeedMult(railTimer);
    dist += speed * dt;
    scrollPhase += speed * dt;

    if (!endless && dist >= def.len) {
      if (boss && !bossDefeated(boss, stats)) bossEscaped();
      else levelCleared();
      return;
    }

    // 换道插值走指数逼近:100 毫秒挪到位,60fps 和 30fps 下同一时刻在同一个位置
    laneFloat = glideLane(laneFloat, lane, dt);
    if (actionTimer > 0) {
      actionTimer -= dt;
      if (action === "jump") jumpElapsed += dt;
      if (actionTimer <= 0) {
        action = "run";
        jumpsUsed = 0;
        slideElapsed = 0;
      }
    }

    // 按花样刷行
    rowDist += speed * dt;
    if (rowDist >= ROW_GAP) {
      rowDist = 0;
      if (pendingRows.length === 0) {
        if (endless) {
          // 无尽模式:现拼一段带必过窗口的路,而不是抽一组固定花样
          refillEndlessRows();
        } else {
          const pool = patternPool.length > 0 ? patternPool : [[]];
          pendingRows = cloneRows(pool[Math.floor(Math.random() * pool.length)]);
        }
      }
      const row = pendingRows.shift();
      if (row) spawnRow(row);
    }

    // 追风棉花云:光跑不动它就一点点贴上来,躲障碍、吃糖果、踩滑轨能把它甩开
    if (endless) {
      chaserGap = chaserDrift(chaserGap, dt, dist);
      if (chaserCaught(chaserGap)) {
        endEndlessRun("chaser");
        return;
      }
    }

    // 分岔路牌:滚到身位时按当时站的道决定支线
    if (def.fork) {
      if (forkSign) {
        forkSign.y += speed * dt;
        if (!forkSign.chosen && forkSign.y >= playerY()) {
          const side = lane >= 2 ? "right" : "left";
          forkSign.chosen = side;
          pendingRows = cloneRows(forkRows(forkSign.gate, lane));
          api.play("tap");
          addFloat(laneX(lane), playerY() - 70, side === "right" ? "走右边!" : "走左边!", "#5a8ac9");
        }
        if (forkSign.y > h + 40) {
          forkSign = null;
          forkTimer = 6 + Math.random() * 3;
        }
      } else {
        forkTimer -= dt;
        if (forkTimer <= 0) forkSign = { gate: pickFork(Math.random()), y: -60, chosen: null };
      }
    }

    // 定时刷道具
    if (def.powerups.length > 0) {
      powerTimer -= dt;
      if (powerTimer <= 0) {
        powerTimer = 8 + Math.random() * 4;
        const kind = def.powerups[Math.floor(Math.random() * def.powerups.length)];
        const l = Math.floor(Math.random() * 3);
        pickups.push({ kind, lane: l, x: laneX(l), y: -60, taken: false });
      }
    }

    const py = playerY();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      // 滚滚球比路面滚得快
      o.y += speed * dt * (o.kind === "roller" ? ROLLER_SPEED_MULT : 1);
      if (o.kind === "cloudy") o.phase += dt * 1.6;
      if (o.y > h + 60) {
        obstacles.splice(i, 1);
        score += 1;
        stats.dodged++;
        if (endless) chaserGap = chaserBoost(chaserGap, CHASER_DODGE_BONUS);
        continue;
      }
      if (obstacleLane(o) !== lane || Math.abs(o.y - py) >= HIT_WINDOW) continue;

      // 坑洞:踏上坑沿先不判,留 90 毫秒土狼时间;这一段过完还没跳起来才算掉下去。
      // 坑沿整个滑过身位之前一定会结算,所以跑得再快也不会白白蹭过去。
      if (o.kind === "pit" && !o.done && action !== "jump" && invincible <= 0 && jetTimer <= 0) {
        o.grace = (o.grace ?? 0) + dt;
        const passed = o.y - py >= HIT_WINDOW * 0.9;
        if (o.grace <= COYOTE_TIME && !passed) continue;
        if (endless) {
          obstacles.splice(i, 1);
          if (boardTimer > 0) {
            // 滑板会架在坑口上,帮你滑过去一次
            boardTimer = 0;
            invincible = 1.5;
            api.play("pop");
            addFloat(laneX(lane), py - 60, "滑板架住坑口啦!", "#8a5ac9", true);
            continue;
          }
          if (petCatches()) continue;
          endEndlessRun("pit");
          return;
        }
      }

      // 彩纸箱:下滑铲过去当场碎掉,顺便给大王一下
      if (!o.done && smashesCrate(o.kind, action)) {
        o.done = true;
        obstacles.splice(i, 1);
        stats.smashed = (stats.smashed ?? 0) + 1;
        score += CRATE_SCORE;
        api.play("pop");
        addFloat(laneX(lane), py - 40, "铲碎!", "#e0a030");
        if (endless) chaserGap = chaserBoost(chaserGap, CHASER_PERFECT_BONUS);
        for (let k = 0; k < particleCount(6, qualityTier); k++) {
          puffs.push({
            x: laneX(lane) + (Math.random() - 0.5) * 46,
            y: py + (Math.random() - 0.5) * 30,
            life: 0.45,
            color: "#ffd868",
          });
        }
        syncBossHits();
        continue;
      }

      // 完美跳:贴着栅栏或坑沿起跳才算;一次跳只判第一个障碍
      if (!o.done && action === "jump" && (o.kind === "hurdle" || o.kind === "pit")) {
        o.done = true;
        if (!jumpJudged) {
          jumpJudged = true;
          const perfect = isPerfectJump(jumpElapsed);
          if (completesPerfectRun(perfectStreak, perfect)) {
            stats.perfectRuns = (stats.perfectRuns ?? 0) + 1;
            score += 30;
            api.play("win");
            addFloat(laneX(lane), py - 80, `三连完美跳!×${stats.perfectRuns}`, "#8a5ac9", true);
            if (endless) chaserGap = chaserBoost(chaserGap, CHASER_PERFECT_BONUS * 2);
            syncBossHits();
          } else if (perfect) {
            if (endless) chaserGap = chaserBoost(chaserGap, CHASER_PERFECT_BONUS);
            addFloat(laneX(lane), py - 60, "完美!", "#4a9a5a");
          }
          perfectStreak = nextPerfectStreak(perfectStreak, perfect);
        }
        continue;
      }

      if (
        invincible <= 0 &&
        jetTimer <= 0 &&
        // 电光门只有通电(亮)的时候才伤人
        (o.kind !== "zapper" || zapperActive(time, o.phase)) &&
        wouldHit(o.kind, action)
      ) {
        obstacles.splice(i, 1);
        onHit(laneX(lane), py);
        if (destroyed || phase !== "run") return;
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += speed * dt;
      if (magnetTimer > 0 && !p.taken && (p.kind === "coin" || p.kind === "star")) {
        const dx = laneX(lane) - p.x;
        const dy = py - p.y;
        const d = Math.hypot(dx, dy);
        // 收藏册的吸金范围加成落在这条半径上
        if (d < 300 * boosts.magnetMul) {
          p.x += (dx / (d || 1)) * 500 * dt;
          p.y += (dy / (d || 1)) * 500 * dt;
        }
      }
      if (p.y > h + 40) {
        pickups.splice(i, 1);
        continue;
      }
      const near = Math.hypot(p.x - laneX(lane), p.y - py) < 44;
      if (!p.taken && near) {
        p.taken = true;
        pickups.splice(i, 1);
        if (p.kind === "star") {
          stats.stars++;
          // 收藏册的糖果加成只加分,不加「吃到几颗」——任务进度得是老老实实数出来的
          score += Math.round(10 * boosts.coinMul);
          api.play("coin");
          addFloat(p.x, p.y - 20, "+⭐", "#e0a030");
          puffs.push({ x: p.x, y: p.y, life: 0.5, color: "#ffe387" });
        } else if (p.kind === "coin") {
          stats.coins++;
          score += Math.round(5 * boosts.coinMul);
          api.play("pop");
          addFloat(p.x, p.y - 20, "+1🍬", "#e05a7a");
          if (endless) chaserGap = chaserBoost(chaserGap, CHASER_COIN_BONUS);
        } else if (p.kind === "rail") {
          railTimer = RAIL_SECONDS;
          api.play("jump");
          addFloat(p.x, p.y - 24, "加速滑轨!", "#2f7ab0", true);
          if (endless) chaserGap = chaserBoost(chaserGap, CHASER_RAIL_BONUS);
        } else if (p.kind === "magnet") {
          magnetTimer = MAGNET_SECONDS;
          api.play("win");
          addFloat(p.x, p.y - 24, "磁铁!糖果自己来!", "#8a5ac9", true);
        } else if (p.kind === "jet") {
          jetTimer = JET_SECONDS;
          api.play("win");
          addFloat(p.x, p.y - 24, "喷气鞋!起飞!!", "#5a8ac9", true);
        } else {
          boardTimer = BOARD_SECONDS;
          api.play("win");
          addFloat(p.x, p.y - 24, "滑板!能二段跳!", "#e05a7a", true);
        }
      }
    }
  }

  // ---- 绘制 ----
  function drawStar(x: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const sx = x + Math.cos(a) * rr;
      const sy = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ---- 2.5D 背景:天空 / 视差远景 / 收敛的地面 / 两侧装饰 ---- */

  /** 这一帧能看多远。 */
  function farDepth(): number {
    return cam.camDepth * 10;
  }

  /** 车道分隔线第 j 条(0..3)在某个缩放下的屏幕 x。 */
  function edgeX(j: number, scale: number): number {
    return w / 2 + edgeOffset(w, j) * scale;
  }

  function drawSky(theme: ThemeStyle, def: LevelDef): void {
    const hy = cam.horizonY;
    const grad = ctx.createLinearGradient(0, 0, 0, hy + 30);
    // 世界给底色,天色只在底色上调一调——十二个世界配四种天色都还认得出是哪儿
    grad.addColorStop(0, shade(theme.skyTop, light));
    grad.addColorStop(1, shade(theme.skyBottom, light));
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, hy + 50);
    // 夜空的三个世界撒一把会眨眼的星星;跑到夜里,别的世界天上也会亮起来
    const nightSky = light.phase === "night" && light.weather === "clear";
    if (def.world === "space" || def.world === "stardust" || def.world === "neon" || nightSky) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const stars = particleCount(30, qualityTier);
      for (let i = 0; i < stars; i++) {
        const sx = (((i * 89) % 100) / 100) * w;
        const sy = (((i * 41) % 100) / 100) * hy;
        ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(time * 2 + i));
        ctx.fillRect(sx, sy, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    }
    if (light.sheen > 0) drawRain();
  }

  /**
   * 雨:天上几道斜线,数量跟着画质档走。
   * 位置由 `time` 直接算出来,不留粒子数组——雨停了就一颗都不剩。
   */
  function drawRain(): void {
    const drops = particleCount(46, qualityTier);
    ctx.strokeStyle = withAlpha("#dbe8ff", 0.16 + light.sheen * 0.24);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const speedy = 520 + (i % 7) * 90;
      const x = (((i * 137) % 100) / 100) * (w + 120) - 60 + ((time * 90) % 40);
      const y = ((((i * 53) % 100) / 100) * h + time * speedy) % (h + 60);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 16);
    }
    ctx.stroke();
  }

  /**
   * 远景视差:两三层圆润的小丘挂在地平线上,越远的层跑得越慢、颜色越淡。
   * 掉帧时从最近那层开始砍,地平线的轮廓不会一下子空掉。
   */
  function drawParallax(theme: ThemeStyle): void {
    const hy = cam.horizonY;
    const layers = Math.min(PARALLAX_LAYERS.length, QUALITY_TIERS[qualityTier].parallax);
    for (let i = 0; i < layers; i++) {
      const layer = PARALLAX_LAYERS[i];
      const span = Math.max(48, layer.span * w);
      const shift = parallaxShift(scrollPhase, layer.factor, span);
      const top = hy - hy * layer.height * 0.55;
      // 远景层跟着天色走色温:黄昏偏橘、夜里偏靛,近处的层调得轻一点
      const base = mixHex(theme.skyBottom, theme.accent, 0.2 + i * 0.22);
      ctx.fillStyle = withAlpha(
        mixHex(base, light.tint, light.layerMix * (1 - i * 0.18)),
        layer.alpha,
      );
      ctx.beginPath();
      ctx.moveTo(-span * 2, hy + 4);
      for (let x = -span * 2 + shift; x < w + span; x += span) {
        ctx.lineTo(x, hy + 4);
        ctx.quadraticCurveTo(x + span * 0.5, top, x + span, hy + 4);
      }
      ctx.lineTo(w + span * 2, hy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** 三条车道从脚下向地平线收敛,地面铺上会往前涌的网格线,远端化进雾里。 */
  function drawGround(theme: ThemeStyle, def: LevelDef): void {
    const tier = QUALITY_TIERS[qualityTier];
    const hy = cam.horizonY;
    const far = farDepth();
    const nearDepth = depthOf(cam, h + 80);
    const nearS = scaleAtDepth(cam, nearDepth);
    const nearY = screenYAtDepth(cam, nearDepth);
    const farS = scaleAtDepth(cam, far);
    const farY = screenYAtDepth(cam, far);

    // 跑道以外的大地
    const ground = ctx.createLinearGradient(0, hy, 0, h);
    ground.addColorStop(0, shade(mixHex(theme.lanes[1], theme.skyBottom, 0.7), light));
    ground.addColorStop(1, shade(mixHex(theme.lanes[1], theme.accent, 0.18), light));
    ctx.fillStyle = ground;
    ctx.fillRect(-20, hy, w + 40, h - hy + 20);

    // 三条车道:每条都是一块向消失点收窄的梯形
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = shade(theme.lanes[i], light);
      ctx.beginPath();
      ctx.moveTo(edgeX(i, farS), farY);
      ctx.lineTo(edgeX(i + 1, farS), farY);
      ctx.lineTo(edgeX(i + 1, nearS), nearY);
      ctx.lineTo(edgeX(i, nearS), nearY);
      ctx.closePath();
      ctx.fill();
    }

    // 地面横向网格线:等距铺在世界里,跑起来就朝人涌过来
    const grid = groundGridDepths(scrollPhase, tier.gridSpacing, far);
    // 网格线的亮度跟着天色走:白昼最亮,夜里压下去,下雨反而更亮(地面是湿的)
    ctx.strokeStyle = withAlpha("#ffffff", light.gridAlpha);
    for (const d of grid) {
      const s = scaleAtDepth(cam, d);
      const y = screenYAtDepth(cam, d);
      ctx.globalAlpha = Math.max(0, 1 - fogAlpha(s, 1));
      ctx.lineWidth = Math.max(0.8, 3 * s);
      ctx.beginPath();
      ctx.moveTo(edgeX(0, s), y);
      ctx.lineTo(edgeX(3, s), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 雨天:三条车道各拉一道竖直反光,跟着网格一起往前涌
    if (light.sheen > 0) {
      const sheen = ctx.createLinearGradient(0, farY, 0, nearY);
      sheen.addColorStop(0, withAlpha("#ffffff", 0));
      sheen.addColorStop(1, withAlpha("#dff0ff", 0.16 * light.sheen));
      ctx.fillStyle = sheen;
      for (let i = 0; i < 3; i++) {
        const cf = (edgeX(i, farS) + edgeX(i + 1, farS)) / 2;
        const cn = (edgeX(i, nearS) + edgeX(i + 1, nearS)) / 2;
        const wf = Math.max(1, (edgeX(i + 1, farS) - edgeX(i, farS)) * 0.16);
        const wn = Math.max(2, (edgeX(i + 1, nearS) - edgeX(i, nearS)) * 0.16);
        ctx.beginPath();
        ctx.moveTo(cf - wf, farY);
        ctx.lineTo(cf + wf, farY);
        ctx.lineTo(cn + wn, nearY);
        ctx.lineTo(cn - wn, nearY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 车道分隔线:四条都指向同一个消失点,中间两条画成一段段的虚线
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    for (let j = 0; j <= 3; j++) {
      const outer = j === 0 || j === 3;
      ctx.lineWidth = outer ? 4 : 3;
      if (outer || !tier.laneDashes) {
        ctx.beginPath();
        ctx.moveTo(edgeX(j, nearS), nearY);
        ctx.lineTo(edgeX(j, farS), farY);
        ctx.stroke();
        continue;
      }
      for (let k = 0; k < grid.length; k += 2) {
        const d0 = grid[k];
        const d1 = d0 + tier.gridSpacing * 0.5;
        const s0 = scaleAtDepth(cam, d0);
        const s1 = scaleAtDepth(cam, d1);
        ctx.lineWidth = Math.max(1, 3 * s0);
        ctx.beginPath();
        ctx.moveTo(edgeX(j, s0), screenYAtDepth(cam, d0));
        ctx.lineTo(edgeX(j, s1), screenYAtDepth(cam, d1));
        ctx.stroke();
      }
    }

    // 远端雾:越靠近地平线越浓,一点点化进天空里。夜里与雨天铺得更厚
    const fogH = (cam.playerY - hy) * 0.55 * Math.max(0.6, Math.min(1.8, light.fogScale));
    const fogHue = shade(theme.skyBottom, light);
    const fog = ctx.createLinearGradient(0, hy - 2, 0, hy + fogH);
    fog.addColorStop(0, withAlpha(fogHue, 0.96));
    fog.addColorStop(0.55, withAlpha(fogHue, 0.45));
    fog.addColorStop(1, withAlpha(fogHue, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(-20, hy - 2, w + 40, fogH + 4);

    if (tier.glow && def.world !== "lava") {
      // 跑道两侧的一点点高光,只有最细腻那一档才画
      ctx.strokeStyle = withAlpha(theme.deco, 0.35);
      ctx.lineWidth = 2;
      for (const j of [0, 3]) {
        ctx.beginPath();
        ctx.moveTo(edgeX(j, nearS), nearY);
        ctx.lineTo(edgeX(j, farS), farY);
        ctx.stroke();
      }
    }
  }

  /** 两侧的小装饰:按世界深度摆一排,越远越小,也跟着雾一起淡掉。 */
  function drawSideDeco(theme: ThemeStyle, def: LevelDef): void {
    const spacing = QUALITY_TIERS[qualityTier].gridSpacing * 2;
    const off = w * (LANE_SPREAD * 1.5 + 0.07);
    for (const d of groundGridDepths(scrollPhase, spacing, farDepth() * 0.75)) {
      const s = scaleAtDepth(cam, d);
      if (s < 0.14) continue;
      const y = screenYAtDepth(cam, d);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(w / 2 + side * off * s, y);
        ctx.scale(s, s);
        ctx.globalAlpha = Math.max(0, 1 - fogAlpha(s));
        drawDecoShape(theme, def, d);
        ctx.restore();
      }
    }
  }

  /** 一个装饰物,画在原点上,缩放交给画布变换。 */
  function drawDecoShape(theme: ThemeStyle, def: LevelDef, seed: number): void {
    const world = def.world;
    if (world === "grass") {
      ctx.fillStyle = theme.deco;
      for (let p = 0; p < 5; p++) {
        const a = (Math.PI * 2 * p) / 5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffe387";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (world === "sky" || world === "ropeway") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(-8, 0, 10, 0, Math.PI * 2);
      ctx.arc(6, -4, 12, 0, Math.PI * 2);
      ctx.arc(16, 3, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (world === "candy") {
      ctx.strokeStyle = "#e8a8c8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = theme.deco;
      ctx.beginPath();
      ctx.arc(0, -6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0.3, Math.PI * 1.4);
      ctx.stroke();
    } else if (world === "forest") {
      ctx.fillStyle = theme.deco;
      ctx.fillRect(-3, 4, 6, 10);
      ctx.fillStyle = "#4a8a4a";
      ctx.beginPath();
      ctx.moveTo(-12, 6);
      ctx.lineTo(0, -16);
      ctx.lineTo(12, 6);
      ctx.closePath();
      ctx.fill();
    } else if (world === "beach") {
      ctx.fillStyle = theme.deco;
      ctx.beginPath();
      ctx.arc(0, 0, 9, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(i * 5, -8);
        ctx.stroke();
      }
    } else if (world === "desert") {
      ctx.fillStyle = theme.deco;
      ctx.beginPath();
      ctx.roundRect(-4, -14, 8, 26, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-13, -6, 8, 5, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(5, -2, 8, 5, 3);
      ctx.fill();
    } else if (world === "snow") {
      ctx.strokeStyle = theme.deco;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * i) / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * 9, -Math.sin(a) * 9);
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.stroke();
      }
    } else if (world === "lava") {
      ctx.fillStyle = "#5a3a35";
      ctx.beginPath();
      ctx.arc(0, 4, 8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = theme.deco;
      ctx.beginPath();
      ctx.arc(0, -5 + Math.sin(time * 4 + seed) * 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (world === "neon") {
      // 月台上的灯牌:一根小柱子挑着一块会亮的牌子
      ctx.fillStyle = "#5a4a7a";
      ctx.fillRect(-2, -4, 4, 18);
      ctx.fillStyle = withAlpha(theme.deco, 0.6 + 0.4 * Math.abs(Math.sin(time * 3 + seed)));
      ctx.beginPath();
      ctx.roundRect(-11, -18, 22, 14, 4);
      ctx.fill();
    } else {
      drawStar(0, 0, 8, "#ffe387");
    }
  }

  /**
   * 把一个障碍投影到 2.5D 画面上:远的画得小、贴着地平线,还要盖一层雾。
   * 形状本身仍旧按原来的尺寸画在原点上,缩放交给画布变换——
   * 这样判定用的还是那套平面坐标,画法换了也不会影响手感。
   */
  function drawObstacle(o: Obstacle, laneW: number): void {
    const lf = o.kind === "cloudy" ? clampLane(o.baseLane + Math.sin(o.phase) * 1.2) : o.baseLane;
    const p = proj(o.y, lf);
    if (p.scale < VISIBLE_SCALE) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.scale, p.scale);
    ctx.globalAlpha = 1 - fogAlpha(p.scale);
    drawObstacleShape(o, laneW);
    ctx.restore();
  }

  /** 一个可以吃的东西,画在原点上。 */
  function drawPickupShape(p: Pickup, laneW: number): void {
    if (p.kind === "star") {
      drawStar(0, 0, 14, "#ffd868");
      return;
    }
    if (p.kind === "coin") {
      ctx.fillStyle = "#ffb84d";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (p.kind === "rail") {
      // 加速滑轨:一小段发亮的轨道,踩上去就冲
      const rw = laneW * 0.42;
      ctx.fillStyle = "rgba(90,224,208,0.85)";
      ctx.beginPath();
      ctx.roundRect(-rw, -12, rw * 2, 24, 10);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(k * 13 - 6, 6);
        ctx.lineTo(k * 13 + 2, 0);
        ctx.lineTo(k * 13 - 6, -6);
      }
      ctx.stroke();
      return;
    }
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a6f2";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.kind === "magnet" ? "🧲" : p.kind === "jet" ? "🚀" : "🛹", 0, 1);
  }

  /** 追风棉花云:跟在身后,越近画得越大,近到一定程度整块画面边缘会泛红。 */
  function drawChaser(): void {
    const trackY = playerY() + Math.max(0, chaserGap) * 0.75 + 40;
    const s = Math.min(2.2, scaleAtDepth(cam, depthOf(cam, trackY)));
    const y = Math.min(h + 40, screenYAtDepth(cam, depthOf(cam, trackY)));
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.scale(s, s);
    const wobble = Math.sin(time * 6) * 4;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(-26 + wobble, 6, 20, 0, Math.PI * 2);
    ctx.arc(0, -6, 26, 0, Math.PI * 2);
    ctx.arc(26 - wobble, 6, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(178,138,232,0.8)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -6, 30 + i * 7, 0.15 * Math.PI + time * 2, 0.75 * Math.PI + time * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-9, -10, 3.5, 0, Math.PI * 2);
    ctx.arc(9, -10, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (chaserWarning(chaserGap)) {
      ctx.fillStyle = `rgba(255,138,168,${0.16 + 0.14 * Math.abs(Math.sin(time * 7))})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }
  }

  function drawObstacleShape(o: Obstacle, laneW: number): void {
    const x = 0;
    const oy = 0;
    if (o.kind === "rock") {
      ctx.fillStyle = "#c9a6f2";
      ctx.beginPath();
      ctx.ellipse(x, oy, laneW * 0.3, laneW * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(x - laneW * 0.1, oy - laneW * 0.08, laneW * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.kind === "hurdle") {
      ctx.fillStyle = "#f8f8ff";
      ctx.strokeStyle = "#e0a8bc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - laneW * 0.32, oy - 10, laneW * 0.64, 20, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - laneW * 0.2, oy - 10);
      ctx.lineTo(x - laneW * 0.2, oy + 10);
      ctx.moveTo(x + laneW * 0.2, oy - 10);
      ctx.lineTo(x + laneW * 0.2, oy + 10);
      ctx.stroke();
    } else if (o.kind === "bar") {
      ctx.fillStyle = "#9adcf0";
      ctx.fillRect(x - laneW * 0.36, oy - 26, 8, 30);
      ctx.fillRect(x + laneW * 0.36 - 8, oy - 26, 8, 30);
      const bands = ["#ff9eb5", "#ffd868", "#8fd8c8"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(x - laneW * 0.36, oy - 26 + i * 6, laneW * 0.72, 6);
      }
    } else if (o.kind === "pit") {
      // 坑洞:深色椭圆 + 裂纹边
      ctx.fillStyle = "rgba(60,55,90,0.85)";
      ctx.beginPath();
      ctx.ellipse(x, oy, laneW * 0.34, laneW * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, oy, laneW * 0.34, laneW * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (o.kind === "roller") {
      // 滚滚球:带旋转纹路的大圆球
      const rr = laneW * 0.27;
      // 转速跟着它在轨道上跑了多远走,不是跟着屏幕位置走
      const spin = o.y * 0.04;
      ctx.fillStyle = "#e8a05a";
      ctx.beginPath();
      ctx.arc(x, oy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, oy, rr * 0.65, spin + (i * Math.PI * 2) / 3, spin + (i * Math.PI * 2) / 3 + 1.1);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(120,70,30,0.4)";
      ctx.beginPath();
      ctx.ellipse(x, oy + rr + 5, rr * 0.9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.kind === "zapper") {
      // 电光门:两根柱子,通电时中间闪电
      const active = zapperActive(time, o.phase);
      const half = laneW * 0.36;
      ctx.fillStyle = active ? "#ffd868" : "#9a9ab8";
      ctx.beginPath();
      ctx.roundRect(x - half - 5, oy - 26, 10, 42, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + half - 5, oy - 26, 10, 42, 4);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = `rgba(255,238,120,${0.75 + Math.sin(time * 20) * 0.25})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - half + 5, oy - 6);
        for (let i = 1; i <= 4; i++) {
          const zx = x - half + 5 + ((half * 2 - 10) * i) / 4;
          ctx.lineTo(zx, oy - 6 + (i % 2 === 0 ? 6 : -8));
        }
        ctx.stroke();
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", x, oy - 34);
      }
    } else if (o.kind === "crate") {
      // 彩纸箱:方方正正带丝带,下滑铲得碎
      const s = laneW * 0.3;
      ctx.fillStyle = "#f2c48a";
      ctx.beginPath();
      ctx.roundRect(x - s, oy - s * 0.72, s * 2, s * 1.44, 6);
      ctx.fill();
      ctx.strokeStyle = "#c98a4a";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ff9eb5";
      ctx.fillRect(x - s * 0.16, oy - s * 0.72, s * 0.32, s * 1.44);
      ctx.fillStyle = "#9adcf0";
      ctx.fillRect(x - s, oy - s * 0.16, s * 2, s * 0.32);
    } else {
      // 云朵怪:飘来飘去的软云
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x - laneW * 0.16, oy, laneW * 0.15, 0, Math.PI * 2);
      ctx.arc(x, oy - laneW * 0.08, laneW * 0.18, 0, Math.PI * 2);
      ctx.arc(x + laneW * 0.16, oy, laneW * 0.15, 0, Math.PI * 2);
      ctx.arc(x, oy + laneW * 0.06, laneW * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3a4a";
      ctx.beginPath();
      ctx.arc(x - laneW * 0.06, oy - laneW * 0.03, 3, 0, Math.PI * 2);
      ctx.arc(x + laneW * 0.06, oy - laneW * 0.03, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a3a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, oy + laneW * 0.03, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  function drawPlayer(): void {
    const pxx = laneX(laneFloat);
    const py = playerY();
    const blink = invincible > 0 && Math.floor(invincible * 8) % 2 === 0;
    if (blink) return;
    const jumping = action === "jump";
    const sliding = action === "slide";
    const flying = jetTimer > 0;
    // 跳跃高度来自按重力积分的 jumpBody:滞空时长与最高点跟 1.1 一模一样,
    // 只是这条弧线现在是算出来的,不再是扫一条 sin。收藏册的弹跳加成只抬高画面。
    const lift = flying
      ? 90 + Math.sin(time * 5) * 8
      : jumping
        ? renderLift(jumpBody, boosts.jumpMul)
        : 0;
    const r = 30;
    // 影子跟着高度缩:跳得越高越小越淡
    const shs = flying ? 0.42 : shadowScale(lift);
    ctx.fillStyle = withAlpha("#5a5a6e", 0.18 * (0.45 + shs * 0.55));
    ctx.beginPath();
    ctx.ellipse(pxx, py + r * 0.85, r * 0.85 * shs, r * 0.25 * shs, 0, 0, Math.PI * 2);
    ctx.fill();
    const bodyY = py - lift;
    const sx = sliding ? 1.25 : 1;
    const sy = sliding ? 0.6 : 1;
    // 换道侧倾:身体往要去的那一边压一点。系统关了动效就只剩位移,不再倾斜
    const tilt = tiltFor(laneFloat, lane, reducedMotion);
    ctx.save();
    if (tilt !== 0) {
      ctx.translate(pxx, bodyY);
      ctx.rotate(tilt);
      ctx.translate(-pxx, -bodyY);
    }
    if (boardTimer > 0) {
      // 小滑板
      ctx.fillStyle = "#c9a6f2";
      ctx.beginPath();
      ctx.roundRect(pxx - r * 1.1, bodyY + r * 0.85, r * 2.2, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#8a5ac9";
      ctx.beginPath();
      ctx.arc(pxx - r * 0.6, bodyY + r * 0.85 + 10, 5, 0, Math.PI * 2);
      ctx.arc(pxx + r * 0.6, bodyY + r * 0.85 + 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (flying) {
      // 喷气火花
      ctx.fillStyle = "#ffd868";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(pxx - 10 + i * 10, bodyY + r * 1.1 + Math.random() * 12, 4 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#ffb3c8";
    ctx.beginPath();
    ctx.ellipse(pxx, bodyY, r * sx, r * sy, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!jumping && !sliding && !flying) {
      const step = Math.sin(scrollPhase * 0.05) * 8;
      ctx.fillStyle = "#e88aa5";
      ctx.beginPath();
      ctx.arc(pxx - 12, bodyY + r * 0.8 + step * 0.4, 7, 0, Math.PI * 2);
      ctx.arc(pxx + 12, bodyY + r * 0.8 - step * 0.4, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(pxx - 10, bodyY - 5 * sy, 3.5, 0, Math.PI * 2);
    ctx.arc(pxx + 10, bodyY - 5 * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pxx, bodyY + 5 * sy, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,120,150,0.4)";
    ctx.beginPath();
    ctx.arc(pxx - 18, bodyY + 2, 5, 0, Math.PI * 2);
    ctx.arc(pxx + 18, bodyY + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    if (magnetTimer > 0) {
      ctx.strokeStyle = "rgba(178,138,232,0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(pxx, bodyY, r * 2.2 + Math.sin(time * 5) * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /**
   * 上一趟的自己:半透明,只画个轮廓。
   * 它不参与任何判定,画在玩家之前,所以两个人重叠时真人永远在上面。
   */
  function drawGhost(): void {
    if (!ghostAlive || !ghostPlayer || phase !== "run") return;
    const gx = laneX(ghostLaneFloat);
    const py = playerY();
    const lift = ghostAction === "jump" ? ghostBody.lift : 0;
    const sliding = ghostAction === "slide";
    const r = 30;
    const bodyY = py - lift;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "rgba(90,90,110,0.5)";
    ctx.beginPath();
    ctx.ellipse(gx, py + r * 0.85, r * 0.8 * shadowScale(lift), r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9fd6ff";
    ctx.beginPath();
    ctx.ellipse(gx, bodyY, r * (sliding ? 1.25 : 1), r * (sliding ? 0.6 : 1), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5aa9e0";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // 名牌上写领先还是落后:比的是「跑到这一刻,上一趟到了第几米」
    const gap = ghostGap(dist, ghostPlayer.metersAt(runMs));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = gap.state === "behind" ? "#a05a2f" : gap.state === "even" ? "#4a5a8a" : "#2f7a52";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(ghostGapLine(gap), gx, bodyY - r - 8);
    ctx.restore();
  }

  function panelBox(pw: number, ph: number): { x: number; y: number } {
    const x = (w - pw) / 2;
    const y = h / 2 - ph / 2;
    ctx.fillStyle = "rgba(255,248,252,0.87)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 22);
    ctx.fill();
    return { x, y };
  }

  function drawButton(r: Rect, label: string, bg: string, fg: string): void {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  function drawThemes(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#dff1ff");
    grad.addColorStop(0.4, "#ffe3ee");
    grad.addColorStop(1, "#565c88");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌈 彩虹跑跑 · 十二大世界", w / 2, 26);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6a5a7e";
    ctx.fillText(
      `共 ${LEVELS.length} 关 · ⭐ ${totalStars(progress)}/${LEVELS.length * 3} · 先选世界,再选关卡`,
      w / 2,
      52,
    );

    // 无尽跑入口:一直跑、吃金币、越跑越快
    const ex = Math.max(10, w * 0.06);
    btnEndless = { x: ex, y: 68, w: w - ex * 2, h: 44 };
    const eg = ctx.createLinearGradient(btnEndless.x, 0, btnEndless.x + btnEndless.w, 0);
    eg.addColorStop(0, "#ffd868");
    eg.addColorStop(0.5, "#ff9eb5");
    eg.addColorStop(1, "#9adcf0");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.roundRect(btnEndless.x, btnEndless.y, btnEndless.w, btnEndless.h, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "#5a3a6e";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `♾️ 无尽彩虹跑 · 2.5D 一直跑${
        endlessRecord.meters > 0
          ? ` · 最远 ${endlessRecord.meters} 米 · 最多 🍬${endlessRecord.coins}`
          : " · 点我开跑!"
      }`,
      w / 2,
      btnEndless.y + btnEndless.h / 2,
    );

    // 收藏册入口:另一个窗口还没把收藏册放进来时,这个按钮压根不出现
    btnCollection = null;
    if (hasCollection()) {
      // 画的是右上角那颗小礼物,能点的范围兜到 44px 见方(标题横着排到 x≈310,扩出来的 6px 不打架)
      const face: Rect = { x: w - 46, y: 8, w: 38, h: 34 };
      btnCollection = touchArea(face);
      drawButton(face, "🎁", "rgba(255,255,255,0.9)", "#8a5ac9");
    }

    themeCards.length = 0;
    const cols = w > h * 1.15 ? 3 : 2;
    const rows = Math.ceil(THEME_ORDER.length / cols);
    const pad = 10;
    const x0 = Math.max(10, w * 0.06);
    const y0 = 120;
    const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
    const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
    for (let i = 0; i < THEME_ORDER.length; i++) {
      const st = THEME_STYLE[THEME_ORDER[i]];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x0 + col * (cw + pad), y: y0 + row * (ch + pad), w: cw, h: ch };
      themeCards.push({ idx: i, rect });
      const unlocked = themeUnlocked(i);
      const cleared = themeCleared(progress, i);
      ctx.fillStyle = unlocked ? st.lanes[1] : "#e8e8ee";
      ctx.strokeStyle = unlocked ? st.accent : "#b8b8c2";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.round(ch * 0.32)}px sans-serif`;
      ctx.fillText(unlocked ? st.emoji : "🔒", rect.x + 10, rect.y + ch * 0.3);
      ctx.fillStyle = unlocked ? st.accent : "#9a9aa8";
      // 章节名、简介、进度这三行都量过宽:超出先降字号,降到底就掐尾巴。
      // 卡片在 360 宽的两列布局里只有 150 出头,不量就会横着捅出去。
      const titleX = rect.x + 10 + ch * 0.42;
      ctx.font = `bold ${Math.max(13, Math.min(17, Math.round(ch * 0.22)))}px sans-serif`;
      fitText(`第${i + 1}章 ${st.name}`, titleX, rect.y + ch * 0.3, rect.x + rect.w - 8 - titleX);
      ctx.fillStyle = unlocked ? "#5a5a6e" : "#a8a8b4";
      const bodyW = rect.w - 18;
      ctx.font = "13px sans-serif";
      fitText(unlocked ? st.blurb : "通关上一个世界解锁", rect.x + 10, rect.y + ch * 0.6, bodyW);
      const size = themeSize(i);
      if (unlocked) {
        fitText(
          `${cleared}/${size} 关 · ⭐${themeStars(progress, i)}/${size * 3}`,
          rect.x + 10,
          rect.y + ch * 0.82,
          bodyW,
        );
      }
    }
  }

  function drawMap(): void {
    const st = THEME_STYLE[THEME_ORDER[chapterIdx]];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.skyTop);
    grad.addColorStop(1, st.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 章节标题就在下面一行,按钮画大了会被压住 —— 画的照旧,能点的范围兜到 44px 高
    const backFace: Rect = { x: 6, y: 7, w: 62, h: 30 };
    btnBack = touchArea(backFace);
    drawButton(backFace, "◀ 世界", "rgba(255,255,255,0.85)", "#5a5a6e");

    ctx.fillStyle = st.accent;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, w / 2, 28);
    const size = themeSize(chapterIdx);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `⭐ ${themeStars(progress, chapterIdx)}/${size * 3} · 通关解锁下一关,回放可刷 3 星`,
      w / 2,
      54,
    );

    mapNodes.length = 0;
    const base = themeOffset(chapterIdx);
    // 1.1 的新章一章就有 29~30 关,4 列会排得太长,列数跟着关数走
    const cols = size > 16 ? 5 : 4;
    const rows = Math.ceil(size / cols);
    const mx0 = w * 0.12;
    const mx1 = w * 0.88;
    const my0 = 96;
    const my1 = h - 40;
    const nr = Math.max(12, Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6));
    for (let i = 0; i < size; i++) {
      const row = Math.floor(i / cols);
      const colRaw = i % cols;
      const col = row % 2 === 0 ? colRaw : cols - 1 - colRaw;
      const x = mx0 + ((mx1 - mx0) * col) / (cols - 1);
      const y = my0 + (rows === 1 ? 0 : ((my1 - my0) * row) / (rows - 1));
      mapNodes.push({ idx: base + i, x, y, r: nr });
    }
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 5;
    ctx.setLineDash([2, 9]);
    ctx.beginPath();
    for (let i = 0; i < mapNodes.length; i++) {
      const n = mapNodes[i];
      if (i === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const n of mapNodes) {
      const def = LEVELS[n.idx];
      const unlocked = levelUnlocked(n.idx);
      const got = progress[n.idx] ?? 0;
      const isFinal = n.idx - base === size - 1;
      const r = isFinal ? n.r * 1.25 : n.r;
      ctx.fillStyle = unlocked ? (got > 0 ? st.lanes[0] : "#ffffff") : "rgba(230,230,236,0.92)";
      ctx.strokeStyle = unlocked ? st.accent : "#b8b8c2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!unlocked) {
        ctx.font = `${Math.round(r * 0.9)}px sans-serif`;
        ctx.fillText("🔒", n.x, n.y);
      } else {
        ctx.fillStyle = st.accent;
        ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
        ctx.fillText(String(n.idx - base + 1), n.x, n.y);
        if (def.boss) {
          ctx.font = `${Math.round(r * 0.6)}px sans-serif`;
          ctx.fillText(BOSSES[def.boss].emoji, n.x, n.y - r * 0.95);
        } else if (isFinal) {
          ctx.font = `${Math.round(r * 0.6)}px sans-serif`;
          ctx.fillText("🏁", n.x, n.y - r * 0.95);
        } else if (def.gen) {
          ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
          ctx.fillText("⏱", n.x, n.y - r * 0.95);
        }
        ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
        let starTxt = "";
        for (let s = 0; s < 3; s++) starTxt += s < got ? "⭐" : "▫";
        ctx.fillText(starTxt, n.x, n.y + r * 1.45);
      }
    }
  }

  function drawClearPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(450, w - 40), 250);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${def.name} 跑完啦!`, w / 2, y + 40);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 86);
    ctx.font = "15px sans-serif";
    // 深绿/深灰:15px 小字要 4.5:1(原 #4a9a5a/#9a9aa8 只有 3.5/2.8:1)
    ctx.fillStyle = missionOk ? "#357a42" : "#62626f";
    ctx.fillText(
      `${missionOk ? "✓" : "✗"} 任务:${missionLabel(def.mission)}`,
      w / 2,
      y + 124,
    );
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`🍬${stats.coins} ⭐${stats.stars} · 掉心 ${stats.heartsLost} · 分 ${score}`, w / 2, y + 148);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 178, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (levelIdx < LEVELS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 178, w: bw2, h: 44 };
      drawButton(btnNext, "下一关 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  function drawRetryPanel(): void {
    // 大王溜走不给复活:那不是"摔了一跤",是护甲没卸完,得重新跑一趟
    const bossLose = !endless && loseReason === "boss";
    const canRevive = !reviveUsed && !bossLose && api.getStars() >= REVIVE_COST;
    const skippable = canSkip();
    // 跟上一趟的自己比赢了没有:第一趟没有幽灵,这一行就整行不画
    const ghostRow = endless ? ghostReport : "";
    // 无尽模式多一行「跑了多少米」的鼓励语,能跳关时多一行按钮,面板都要跟着高一点
    const { y } = panelBox(
      Math.min(450, w - 40),
      (canRevive ? 260 : 210) +
        (bossLose ? 28 : 0) +
        (endless ? 16 : 0) +
        (ghostRow ? 22 : 0) +
        (skippable ? 56 : 0),
    );
    // 深紫替代浅紫:白底大字对比 4.8:1(原 #b28ae8 只有 2.7:1,不达 AA)
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 无尽模式:标题按三种失败分别说,只鼓励不批评
    const fail = failCopy(failKind, dist);
    ctx.fillText(
      endless
        ? fail.title
        : loseReason === "boss"
          ? `${boss?.name ?? "大王"}溜走了……`
          : "摔了一跤,晕乎乎……",
      w / 2,
      y + 44,
    );
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    if (endless) {
      // 分两行写:窄屏一行塞不下这么长的鼓励语
      fitText(fail.lines[0], w / 2, y + 74, Math.min(440, w - 50));
      fitText(fail.lines[1], w / 2, y + 94, Math.min(440, w - 50));
    } else if (loseReason === "boss") {
      fitText(
        `打中 ${bossHitsOf(stats)}/${boss?.hp ?? 0} 下:铲碎一个彩纸箱算 1 下,三连完美跳算 2 下`,
        w / 2,
        y + 84,
        Math.min(420, w - 60),
      );
    }
    const run: EndlessRecord = { meters: Math.floor(dist), coins: stats.coins };
    const broke = recordBroken(recordBefore, run);
    const subText = endless
      ? `${recordLine(recordBefore, run)} · 这趟 🍬${stats.coins}${
          canRevive ? ` · 花 ${REVIVE_COST}⭐ 还能接着跑!` : ""
        }`
      : canRevive
        ? `看小星星帮帮忙:花 ${REVIVE_COST} 颗⭐原地复活!`
        : "没关系!就从这一关重新出发";
    ctx.fillStyle = endless && (broke.meters || broke.coins) ? "#c47a2a" : "#5a5a6e";
    // 大王溜走那一行已经占了 y+84,鼓励语顺延一行
    fitText(
      subText,
      w / 2,
      y + (endless ? 114 : loseReason === "boss" ? 108 : 84),
      Math.min(440, w - 50),
    );
    if (ghostRow) {
      ctx.fillStyle = "#7a6ab8";
      ctx.font = "14px sans-serif";
      fitText(ghostRow, w / 2, y + 136, Math.min(440, w - 50));
      ctx.font = "15px sans-serif";
    }
    let by = y + (endless ? 146 : loseReason === "boss" ? 138 : 116) + (ghostRow ? 22 : 0);
    btnRevive = null;
    if (canRevive) {
      btnRevive = { x: w / 2 - 110, y: by, w: 220, h: 44 };
      drawButton(btnRevive, `✨ 花 ${REVIVE_COST}⭐ 原地复活`, "#fff1c9", "#c47a2a");
      by += 56;
    }
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: by, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: by, w: bw2, h: 44 };
    drawButton(btnMap, endless ? "回主页" : "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再跑一次", "#ffd868", "#7a5a1a");
    // 卡住太久就找家长开个门:跳过去的关星级仍记 0,但下一关会解锁
    btnSkip = null;
    if (skippable) {
      btnSkip = { x: w / 2 - 137, y: by + 56, w: 274, h: 44 };
      drawButton(
        btnSkip,
        skipPending ? "等家长确认中…" : `⏭️ 跳过第 ${levelIdx + 1} 关(要家长确认)`,
        "#eef0ff",
        "#5a5a8e",
      );
    }
  }

  function drawIntroPanel(): void {
    const def = level();
    const st = THEME_STYLE[def.world];
    const { y } = panelBox(Math.min(460, w - 40), 220);
    ctx.fillStyle = st.accent;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (endless) {
      ctx.fillText("♾️ 无尽彩虹跑", w / 2, y + 42);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText(def.hint, w / 2, y + 84);
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(
        endlessRecord.meters > 0
          ? `🎯 目标:超过 ${endlessRecord.meters} 米 · 糖果纪录 🍬${endlessRecord.coins}`
          : "🎯 目标:跑得越远越厉害!",
        w / 2,
        y + 122,
      );
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#a0a0b2";
      fitText(
        "左右滑或 ← → 换道 · 上滑或空格起跳 · 下滑或 ↓ 滚翻 · 点一下开始",
        w / 2,
        y + 158,
        Math.min(440, w - 50),
      );
      drawIntroExtras(y + 186);
      return;
    }
    const ci = themeIndexOfLevel(levelIdx);
    ctx.fillText(
      `第${ci + 1}章 第${levelIdx - themeOffset(ci) + 1}关 · ${def.name}`,
      w / 2,
      y + 42,
    );
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    fitText(def.hint, w / 2, y + 84, Math.min(430, w - 60));
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`🎯 任务:${missionLabel(def.mission)}`, w / 2, y + 122);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    const tips: string[] = [];
    if (def.rails) tips.push("有加速滑轨");
    if (def.rhythm) tips.push("有节奏段");
    if (def.fork) tips.push("有岔路口");
    fitText(
      `${st.name}${tips.length > 0 ? ` · ${tips.join("·")}` : ""} · 左右滑换道 上滑跳 下滑趴`,
      w / 2,
      y + 158,
      Math.min(430, w - 60),
    );
    drawIntroExtras(y + 186);
  }

  /**
   * 开跑前那两行小字:身上这一套收藏册帮了什么忙,以及这一趟有没有幽灵同场。
   * 画在面板下沿之外,不跟正文抢位置。
   */
  function drawIntroExtras(baseY: number): void {
    const lines: string[] = [];
    const boostLine = describeBoosts(boosts);
    if (boostLine !== "") lines.push(boostLine);
    if (endless && ghostBest && ghostBest.events.length > 0) {
      lines.push(`👻 上一趟的自己(${ghostBest.meters} 米)会跟你一起跑`);
    }
    if (lines.length === 0) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < lines.length; i++) {
      ctx.font = "13px sans-serif";
      ctx.fillStyle = i === 0 && boostLine !== "" ? "#8a5ac9" : "#5a8ac9";
      fitText(lines[i], w / 2, baseY + i * 20, Math.min(440, w - 40));
    }
  }

  /**
   * 一行放不下就先缩字号,缩到 13px(全站可读性下限)还是塞不进就掐尾巴加省略号。
   * 窄屏上宁可少几个字,也不许把提示语顶出面板、把章节简介捅出卡片。
   */
  function fitText(text: string, cx: number, cy: number, maxW: number): void {
    const base = ctx.font;
    const size = Number(/(\d+)px/.exec(base)?.[1] ?? 16);
    let px = size;
    while (px > 13 && ctx.measureText(text).width > maxW) {
      px -= 1;
      ctx.font = base.replace(/\d+px/, `${px}px`);
    }
    let out = text;
    while (out.length > 1 && ctx.measureText(out).width > maxW) out = out.slice(0, -1);
    if (out !== text && out.length > 1) out = `${out.slice(0, -1)}…`;
    ctx.fillText(out, cx, cy);
    ctx.font = base;
  }

  function draw(): void {
    if (phase === "themes") {
      drawThemes();
      return;
    }
    if (phase === "map") {
      drawMap();
      return;
    }

    const def = level();
    const theme = THEME_STYLE[def.world];
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    drawSky(theme, def);
    drawParallax(theme);
    drawGround(theme, def);
    drawSideDeco(theme, def);
    const laneW = w * LANE_SPREAD;

    // 终点线:随地面一起收进透视里
    const toFinish = def.len - dist;
    if (toFinish < h + 900) {
      const fy = playerY() - toFinish;
      const fs = scaleAtDepth(cam, depthOf(cam, fy));
      if (fs >= VISIBLE_SCALE) {
        ctx.save();
        ctx.translate(w / 2, screenYAtDepth(cam, depthOf(cam, fy)));
        ctx.scale(fs, fs);
        ctx.globalAlpha = 1 - fogAlpha(fs);
        const left = edgeOffset(w, 0);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(left, -12, laneW * 3, 24);
        ctx.fillStyle = "#3a3a4a";
        for (let i = 0; i < 12; i++) {
          const gx = left + i * laneW * 0.25;
          ctx.fillRect(gx, i % 2 === 0 ? -12 : 0, laneW * 0.25, 12);
        }
        ctx.restore();
      }
    }

    // 远的先画、近的后画,近处的东西才会正确地盖住远处的
    drawOrder.length = 0;
    for (const o of obstacles) drawOrder.push(o);
    drawOrder.sort((a, b) => a.y - b.y);
    for (const o of drawOrder) drawObstacle(o, laneW);

    pickOrder.length = 0;
    for (const p of pickups) pickOrder.push(p);
    pickOrder.sort((a, b) => a.y - b.y);
    for (const p of pickOrder) {
      const s = scaleAtDepth(cam, depthOf(cam, p.y));
      if (s < VISIBLE_SCALE) continue;
      ctx.save();
      ctx.translate(projectFlatX(cam, p.x, s), screenYAtDepth(cam, depthOf(cam, p.y)));
      ctx.scale(s, s);
      ctx.globalAlpha = 1 - fogAlpha(s);
      drawPickupShape(p, laneW);
      ctx.restore();
    }

    // 分岔路牌
    if (forkSign) {
      const s = scaleAtDepth(cam, depthOf(cam, forkSign.y));
      if (s >= VISIBLE_SCALE) {
        ctx.save();
        ctx.translate(w / 2, screenYAtDepth(cam, depthOf(cam, forkSign.y)));
        ctx.scale(s, s);
        ctx.globalAlpha = 1 - fogAlpha(s);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.roundRect(edgeOffset(w, 0) + 6, -18, laneW * 3 - 12, 36, 12);
        ctx.fill();
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#4a4a5e";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`◀ 岔路口 · ${forkSign.gate.name} ▶`, 0, 0);
        ctx.restore();
      }
    }

    // 幽灵画在真人之前:两个人站到同一条道上时,上面那个永远是你自己
    drawGhost();
    drawPlayer();
    if (endless && phase === "run") drawChaser();

    for (const p of puffs) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 22px sans-serif" : "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    // 窄屏修复:HUD 拆成两行——第一行(左糖果星星/右爱心)与第二行(赛道进度+任务条)
    // 不再挤在同一行,360 宽也互不压盖;任务/纪录文字 12→14px,对比色加深到 ≥4.5:1
    const rowY = 40;
    const bw = Math.min(340, w - 20);
    const bx = (w - bw) / 2;
    if (endless) {
      // 无尽跑:第二行显示距离与最好成绩
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.roundRect(bx, rowY, bw, 42, 12);
      ctx.fill();
      ctx.fillStyle = "#8a5ac9";
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `🏃 ${Math.floor(dist)} 米 · ${tierForDistance(dist).name} · ${lightingLabel(light)}`,
        w / 2,
        rowY + 12,
      );
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#6a5a86";
      ctx.fillText(
        Math.floor(dist) > endlessRecord.meters && endlessRecord.meters > 0
          ? `🎉 新纪录保持中! · 糖果纪录 🍬${endlessRecord.coins}`
          : `最远 ${endlessRecord.meters} 米 · 最多 🍬${endlessRecord.coins}`,
        w / 2,
        rowY + 30,
      );

      // 追风棉花云的距离条:贴得越近条子越短、颜色越急
      const cy = rowY + 46;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.roundRect(bx, cy, bw, 18, 9);
      ctx.fill();
      const frac = Math.max(0, Math.min(1, chaserGap / CHASER_START_GAP));
      ctx.fillStyle = chaserWarning(chaserGap) ? "#ff8aa8" : "#9adcf0";
      ctx.beginPath();
      ctx.roundRect(bx, cy, Math.max(10, bw * frac), 18, 9);
      ctx.fill();
      ctx.fillStyle = "#4a4a5e";
      // 13px 是全站可读性下限,追赶条这一行原来是 12px
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(
        `${CHASER_EMOJI} ${CHASER_NAME}${chaserWarning(chaserGap) ? " 快跑!" : " 在后面追"}`,
        w / 2,
        cy + 9,
      );
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.roundRect(bx, rowY, bw, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#b28ae8";
      ctx.beginPath();
      ctx.roundRect(bx, rowY, Math.max(10, (bw * Math.min(dist, def.len)) / def.len), 10, 5);
      ctx.fill();

      // 任务条
      const m: Mission = def.mission;
      const prog = missionProgress(m, stats);
      const done = missionDone(m, stats);
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.roundRect(bx, rowY + 14, bw, 24, 12);
      ctx.fill();
      ctx.fillStyle = done ? "#7ac97a" : "#ffd868";
      const mfrac = m.type === "noHit" ? (done ? 1 : stats.heartsLost === 0 ? 1 : 0) : prog / m.n;
      ctx.beginPath();
      ctx.roundRect(bx, rowY + 14, Math.max(12, bw * Math.min(1, mfrac)), 24, 12);
      ctx.fill();
      ctx.fillStyle = "#4a4a5e";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `🎯 ${missionLabel(m)}${m.type === "noHit" ? (stats.heartsLost === 0 ? " ✓保持中" : " ✗") : ` ${prog}/${m.n}`}`,
        w / 2,
        rowY + 26,
      );
    }

    // 大王护甲条:接在任务条下面,窄屏也和任务条同宽,不会横着挤出去
    // 无尽模式那一行已经被追风棉花云的距离条占了,道具倒计时同样往下顺一行
    let extraRow = endless ? 24 : 0;
    if (!endless && boss) {
      const by0 = rowY + 42;
      extraRow = 26;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.roundRect(bx, by0, bw, 22, 11);
      ctx.fill();
      const hits = Math.min(boss.hp, bossHitsOf(stats));
      ctx.fillStyle = bossBeaten ? "#7ac97a" : "#ff8aa8";
      ctx.beginPath();
      ctx.roundRect(bx, by0, Math.max(12, (bw * hits) / boss.hp), 22, 11);
      ctx.fill();
      ctx.fillStyle = "#4a4a5e";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${boss.emoji} ${boss.name} ${hits}/${boss.hp}${bossBeaten ? " ✓打趴下了" : ""}`,
        w / 2,
        by0 + 11,
      );
    }

    ctx.font = "15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#5a5a6e";
    const comboTxt = !endless && level().rhythm ? ` 🎵${perfectStreak}/${PERFECT_STREAK_GOAL}` : "";
    ctx.fillText(`🍬${stats.coins} ⭐${stats.stars}${comboTxt}`, 76, 20);
    ctx.textAlign = "right";
    ctx.fillText("💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, MAX_HEARTS - hearts)), w - 10, 20);
    // 道具倒计时:移到任务条下方,不再和第二行进度条打架;13→14px
    let px2 = w - 10;
    ctx.font = "14px sans-serif";
    const ptY = rowY + 52 + extraRow;
    if (magnetTimer > 0) {
      ctx.fillText(`🧲${Math.ceil(magnetTimer)}s`, px2, ptY);
      px2 -= 58;
    }
    if (jetTimer > 0) {
      ctx.fillText(`🚀${Math.ceil(jetTimer)}s`, px2, ptY);
      px2 -= 58;
    }
    if (boardTimer > 0) {
      ctx.fillText(`🛹${Math.ceil(boardTimer)}s`, px2, ptY);
      px2 -= 58;
    }
    if (railTimer > 0) {
      ctx.fillText(`⚡${Math.ceil(railTimer)}s`, px2, ptY);
    }

    // HUD 第二行(赛道进度 + 任务条)从 y=40 起,按钮画到 44px 高就压上去了 —— 只扩热区
    const backFace: Rect = { x: 6, y: 6, w: 62, h: 28 };
    btnBack = touchArea(backFace);
    drawButton(backFace, endless ? "◀ 回家" : "◀ 地图", "rgba(255,255,255,0.85)", "#5a5a6e");

    // ---- 覆盖层 ----
    if (phase === "intro") {
      drawIntroPanel();
      drawButton(backFace, endless ? "◀ 回家" : "◀ 地图", "#f0f0f5", "#5a5a6e");
    } else if (phase === "clear") {
      drawClearPanel();
    } else if (phase === "retry") {
      drawRetryPanel();
    }
  }

  let raf = 0;
  let last = performance.now();
  function frame(now: number): void {
    const dt = clampDt(now - last);
    last = now;
    // 帧率自适应:低端安卓掉帧就自动少画几层视差、少放几颗粒子
    fps = smoothFps(fps, dt);
    qualityTier = nextQualityTier(qualityTier, fps);
    syncSize();
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  raf = requestAnimationFrame(frame);

  // 平台给了 initialLevel、或者地址栏带着 ?level=N,就别停在选世界那一屏
  const wanted = initialLevelIndex(api.initialLevel, safeSearch());
  if (wanted !== null) loadLevel(wanted);

  return {
    openCampaignLevel,
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      stopSpeaking();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      canvas.remove();
    },
  };
}
