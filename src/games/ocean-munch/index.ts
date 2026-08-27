import { meta } from "./meta";
export { meta };

// 海底大胃王:188 关十二片海域战役!先选海域再选关,每片海域专属配色、障碍组合
// 和区域 BOSS(共 12 位),吃过见过的生物都会记进生物图鉴!
// 1.1 新机制:洋流(整片海周期换向)、毒藻鱼、共生小鱼、深渊压力(体型上限)。
//
// 1.2 加了两个和战役并列的入口(首屏三选一):
//  · 无尽「深海马拉松」——一直往下潜,每 400 米或 45 秒进一层,成绩是潜到的米数;
//  · 对战「限时谁更胖」——60 秒同池抢食的人机三档。
// 两个新模式共用同一套竞技场循环(`updateArena` / `drawArena`),战役那一套
// 一行都没动:前 99 关的参数、胜负公式、存档 key 全部原样。
import {
  BOSS_INFO,
  BUDDY_MAX,
  BUDDY_REACH,
  BUDDY_SCORE,
  BossKind,
  DARK_SIGHT,
  DEX,
  DEX_KEY,
  HEARTS_PER_LEVEL,
  LEVELS,
  PROGRESS_KEY,
  SHIELD_SECONDS,
  START_RADIUS,
  TOXIN_NUMB,
  VORTEX_RADIUS,
  ZONE_ORDER,
  ZONE_STYLE,
  bossBiteReady,
  buddyCanEat,
  buddyRadius,
  buddyStep,
  canEat,
  circlesOverlap,
  clearSpeechLine,
  crushedCap,
  dexIdForFish,
  driftVector,
  eatScore,
  eelActive,
  eelPlan,
  eelReach,
  grow,
  hazardTier,
  inBubbleGap,
  isDanger,
  numbFollowMult,
  parseDex,
  parseProgress,
  retrySpeechLine,
  serializeDex,
  serializeProgress,
  sizeCapFor,
  spawnRadius,
  starsForLevel,
  themeCleared,
  themeIndexOf,
  themeSize,
  themeStars,
  themeStart,
  toxinShrink,
  totalStars,
  vortexPull,
} from "./logic";
import { DRIFT_SPEED } from "./logic";
import {
  DASH_CD,
  DASH_TIME,
  DEPTH_PER_BITE,
  ELITE_BREAK,
  ENDLESS_START_RADIUS,
  SWALLOW_MS,
  SpatialGrid,
  TIER_MAX as ENDLESS_TIER_MAX,
  biteLoss,
  canSwallow,
  dashReady,
  dashSpeed,
  depthForTier,
  depthGain,
  easeRadius,
  endlessFailAt,
  endlessFailCopy,
  endlessRecordSay,
  endlessSpeed,
  growEndless,
  isPredator,
  makeRng,
  pressureDrain,
  pressureLine,
  pressureState,
  spawnEndlessFish,
  startTierForLevel,
  starveWarnLevel,
  starveWarnLine,
  swallowStretch,
  tierAt,
  tierSpec,
} from "./endless";
import type { EndlessFail, EndlessFish, Rng } from "./endless";
import {
  CAMPAIGN_TOTAL,
  SKIP_KEY,
  clampLevelIndex,
  initialLevelIndex,
  isUnlockedWith,
  mergeSkip,
  parseSkipList,
  serializeSkipList,
} from "./campaign";
import {
  RIVAL_LEVELS,
  RIVAL_PROFILES,
  VERSUS_SECONDS,
  rivalSteer,
  versusCopy,
  versusOutcome,
} from "./versus";
import type { RivalLevel, RivalProfile, VersusOutcome } from "./versus";
import { touchArea } from "./touch";
import type { Rect } from "./touch";
import {
  bossDefeat,
  bossEntrance,
  BOSS_DEFEAT_S,
  bubbleCap,
  drawBubble,
  drawDepthTint,
  drawFarLayer,
  drawFishBody,
  drawForeLayer,
  drawLightShafts,
  drawSparkle,
  drawToxinAura,
  drawUnderwaterBackdrop,
  drawVignette,
  eatBubbleCount,
  growFx,
  GROW_FX_S,
  jellyGlowPulse,
  layerToggles,
  lerpColor,
  mouthOpen01,
  MOUTH_OPEN_MS,
  pufferInflateScale,
  qualityFor,
  shade,
  spawnSwirl,
  stepSwirls,
  swirlPose,
  drawCollectStar,
  drawShieldBadge,
} from "./art";
import type { Headdress, Swirl } from "./art";
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
  /** 平台可以指定直接开第几关(1 基);不给就读 `?level=`,再没有才停在首屏 */
  initialLevel?: number;
}

/** mount 返回的东西:除了 destroy,还得给平台一个「直开第 N 关」的入口。 */
export interface OceanMunchHandle {
  destroy: () => void;
  /** 直接开第 n 关(1 基),越界夹到两端 */
  openCampaignLevel: (n: number) => void;
}

type Phase =
  | "home"
  | "themes"
  | "map"
  | "dex"
  | "intro"
  | "play"
  | "clear"
  | "retry"
  | "rivalPick"
  | "arena"
  | "arenaOver";

/** 竞技场两种玩法:无尽深海马拉松 / 对战限时谁更胖。 */
type ArenaMode = "endless" | "versus";
type NpcKind = "fish" | "jelly" | "puffer" | "urchin" | "squid" | "toxin";

interface Npc {
  kind: NpcKind;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  color: string;
  /** 河豚:>0 表示鼓起(带刺,不能吃) */
  inflated: number;
  inflateClock: number;
  /** 墨墨鱼喷墨冷却 */
  inkCd: number;
}

interface Pickup {
  kind: "shield" | "star" | "buddy";
  x: number;
  y: number;
  vy: number;
  phase: number;
}

/** 共生小鱼:跟在你身后,顺手帮你吃掉身边的小鱼。 */
interface Buddy {
  x: number;
  y: number;
  phase: number;
  /** 咬一口的冷却,免得瞬间清场 */
  cd: number;
}

/** 毒云:荧荧海葵王吐的紫雾,碰到会缩小发麻,但不掉心。 */
interface Haze {
  x: number;
  y: number;
  r: number;
  life: number;
}

interface Boss {
  kind: BossKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  dashTimer: number;
  inkTimer: number;
  summonTimer: number;
  /** 1.1:掀洋流 / 吐毒雾 / 合壳加压的冷却 */
  driftTimer: number;
  hazeTimer: number;
  crushTimer: number;
  hurt: number;
}

interface Ink {
  x: number;
  y: number;
  r: number;
  life: number;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
}

interface Pop {
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

/** 水流带(位置用比例存,窗口大小变了也不乱) */
interface CurrentBand {
  fy: number;
  fh: number;
  dir: 1 | -1;
  speed: number;
}

interface VortexSpot {
  fx: number;
  fy: number;
}

interface EelPlant {
  fx: number;
  offset: number;
}

interface BubbleWallState {
  x: number;
  dir: 1 | -1;
  gapY: number;
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

function loadDex(): Set<string> {
  try {
    return parseDex(localStorage.getItem(DEX_KEY));
  } catch {
    return parseDex(null);
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

/** 地址栏的查询串;测试环境或者被沙箱掐掉时当没有。 */
function safeSearch(): string {
  try {
    return window.location.search ?? "";
  } catch {
    return "";
  }
}

/** 用户把系统动效关掉了:吞咽只留音效与半径插值,不再拉伸。 */
function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

/** 竞技场里的一条 NPC 鱼(无尽与对战共用)。 */
interface ArenaFish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  spec: EndlessFish;
}

/** 竞技场里会游的角色:玩家自己,或者对战里的那条人机鱼。 */
interface Swimmer {
  x: number;
  y: number;
  /** 逻辑半径 */
  r: number;
  /** 画面上的半径:追着逻辑半径插值,禁止一帧跳变 */
  shown: number;
  facing: 1 | -1;
  dashLeft: number;
  dashCd: number;
  /** 被咬掉一块之后的闪烁无敌 */
  inv: number;
  /** 吞咽拉伸还剩多少毫秒 */
  swallow: number;
  /** 上一口猎物在哪个方向(拉伸朝着它) */
  swx: number;
  swy: number;
}

function makeSwimmer(x: number, y: number, r: number): Swimmer {
  return { x, y, r, shown: r, facing: 1, dashLeft: 0, dashCd: 0, inv: 0, swallow: 0, swx: 1, swy: 0 };
}

export function mount(api: GameAPI): OceanMunchHandle {
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
  }
  syncSize();

  const progress = loadProgress();
  const dexSeen = loadDex();
  let skips = parseSkipList(readKey(SKIP_KEY));
  const reducedMotion = prefersReducedMotion();

  // ---- 局状态 ----
  let levelIdx = 0;
  let chapterIdx = 0;
  let phase: Phase = "home";
  let hearts = HEARTS_PER_LEVEL;
  let heartsLost = 0;
  let score = 0;
  let eaten = 0;
  let streak = 0;
  let streakTimer = 0;
  let time = 0;
  let shake = 0;
  let earnedStars: 1 | 2 | 3 = 1;
  let finaleFired = false;
  let destroyed = false;

  const player = { x: 320, y: 240, r: START_RADIUS, facing: 1 };
  let targetX = player.x;
  let targetY = player.y;
  let invincible = 0;
  let shield = 0;

  const npcs: Npc[] = [];
  const pickups: Pickup[] = [];
  const bubbles: Bubble[] = [];
  const pops: Pop[] = [];
  const floats: Floaty[] = [];
  const inks: Ink[] = [];
  const buddies: Buddy[] = [];
  const hazes: Haze[] = [];
  let boss: Boss | null = null;
  let bossActive = false;

  // 1.1 新机制的局内状态
  let numb = 0;
  let sizeCap = 0;
  let crushCount = 0;
  let buddyTimer = 0;
  let driftFlip = 0;

  // 关卡环境障碍
  const currents: CurrentBand[] = [];
  const vortexes: VortexSpot[] = [];
  const eels: EelPlant[] = [];
  let wall: BubbleWallState | null = null;
  let wallTimer = 0;

  let spawnTimer = 0.4;
  let shieldTimer = 9;
  let starTimer = 6;
  let urchinTimer = 0;

  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  const themeCards: Array<{ idx: number; rect: Rect }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnDex: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };
  let btnSkip: Rect | null = null;
  const homeCards: Array<{ id: "campaign" | "endless" | "versus"; rect: Rect }> = [];
  const rivalCards: Array<{ id: RivalLevel; rect: Rect }> = [];
  let btnAgain: Rect | null = null;
  let btnHome: Rect | null = null;

  // ---- 竞技场(无尽 / 对战共用一套循环)----
  let arenaMode: ArenaMode = "endless";
  const me = makeSwimmer(320, 240, ENDLESS_START_RADIUS);
  let rival: Swimmer | null = null;
  let rivalProfile: RivalProfile = RIVAL_PROFILES.dodge;
  const arenaFish: ArenaFish[] = [];
  /** 邻域网格:鱼一多也不用两两比 */
  const grid = new SpatialGrid<ArenaFish>(96);
  let arenaRng: Rng = makeRng(1);
  let depth = 0;
  let arenaTime = 0;
  let sinceEat = 0;
  let eliteLeft = 0;
  let arenaSpawn = 0;
  let arenaEaten = 0;
  let arenaTier = 1;
  let startTier = 1;
  let failKind: EndlessFail | null = null;
  let versusResult: VersusOutcome = "draw";
  let endlessBest = 0;
  let newRecord = false;
  /** 竞技场里按住的方向键(WASD / 方向键都认;Esc 一概不碰,留给壳层暂停) */
  const keys = new Set<string>();
  /** 触屏时手指压着的那一点;鱼浮在它上面一个身位,不许被手指盖住 */
  let pointerTouch = false;
  let skipPending = false;

  const SMALL_COLORS = ["#a8e6c9", "#ffe0a3", "#ffc4d6", "#c4e5ff"];
  const BIG_COLORS = ["#b8a9f5", "#8fc8e8", "#f5b8c9"];

  // ---- 1.3 纯视觉状态(只影响像素,不碰任何判定与数值)----
  /** 被吞的鱼缩小旋入嘴的残影池(art.SWIRL_CAP 封顶,自动回收) */
  const swirls: Swirl[] = [];
  /** 玩家上一口咬下的时刻(嘴巴张大一帧用);战役与竞技场各一份 */
  let mouthAt = -9;
  /** 成长升档金光:触发时刻与上一次升档时的体型基线 */
  let growFxAt = -9;
  let growMark = -1;
  /** 转向冒泡:上一帧朝向 */
  let lastFacing = 1;
  /** BOSS 进场演出起点 / 战败演出(翻白肚缓沉) */
  let bossIntroAt = -9;
  let bossDefeatFx: { kind: BossKind; x: number; y: number; r: number; at: number } | null = null;
  /** 跨层背景色 1s 插值(竞技场) */
  let bgTierSeen = -1;
  let bgBlendAt = -1;
  let bgPrevTop = "";
  let bgPrevBottom = "";
  let bgTop = "";
  let bgBottom = "";
  /** 结算吞吃链:本局吃过的最大三条(半径 + 颜色),战役与竞技场各一份 */
  const eatLog: Array<{ r: number; color: string }> = [];
  const arenaEatLog: Array<{ r: number; color: string }> = [];
  /** 竞技场开局体型(结算成长条的起点) */
  let arenaStartR = ENDLESS_START_RADIUS;

  /** 当前画质档:窄屏 / 低端机砍前景与远景层。 */
  function quality(): ReturnType<typeof qualityFor> {
    return qualityFor(w, h);
  }

  /** 记住这局吃过的最大三条,给结算的吞吃链回顾。 */
  function logEat(log: Array<{ r: number; color: string }>, r: number, color: string): void {
    log.push({ r, color });
    log.sort((a, b) => b.r - a.r);
    if (log.length > 3) log.length = 3;
  }

  /** 吞吃演出:残影旋入嘴 + 3 颗气泡(reduced 砍半)+ 张嘴一帧。 */
  function eatFx(fx: number, fy: number, fr: number, color: string, mx: number, my: number, now: number): void {
    spawnSwirl(swirls, fx, fy, Math.min(fr, 20), color, mx, my);
    mouthAt = now;
    const cap = bubbleCap(quality(), reducedMotion);
    for (let i = 0; i < eatBubbleCount(reducedMotion); i++) {
      if (bubbles.length >= cap) break;
      bubbles.push({ x: mx + (Math.random() - 0.5) * 12, y: my - 4 - i * 5, r: 2.5 + Math.random() * 2.5, vy: 46 + Math.random() * 24 });
    }
  }

  /** 玩家转向时嘴边冒 1–2 颗小气泡(reduced 只冒 1 颗)。 */
  function turnBubbles(x: number, y: number, facing: number): void {
    const cap = bubbleCap(quality(), reducedMotion);
    const n = reducedMotion ? 1 : 2;
    for (let i = 0; i < n; i++) {
      if (bubbles.length >= cap) break;
      bubbles.push({ x: x + facing * 10, y: y - 4 - i * 6, r: 2 + Math.random() * 2, vy: 50 + Math.random() * 20 });
    }
  }

  /** 成长升档检查:体型每涨 6 就闪一圈金光(视觉,不回写任何数值)。 */
  function checkGrowFx(r: number, now: number): void {
    if (growMark < 0 || r < growMark - 3) {
      growMark = r;
      return;
    }
    if (r >= growMark + 6) {
      growMark = r;
      growFxAt = now;
    }
  }

  function level() {
    return LEVELS[levelIdx];
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  function markDex(id: string): void {
    if (dexSeen.has(id)) return;
    dexSeen.add(id);
    const entry = DEX.find((d) => d.id === id);
    if (entry) addFloat(w / 2, 90, `图鉴收集:${entry.emoji} ${entry.name}!`, "#8a5ac9", true);
    try {
      localStorage.setItem(DEX_KEY, serializeDex(dexSeen));
    } catch {
      // 静默失败
    }
  }

  function growCap(): number {
    return sizeCap;
  }

  /** 本关有没有洋流(整片海周期换向)。 */
  function hasDrift(): boolean {
    return level().hazards.includes("drift");
  }

  /** 洋流现在的推力;没有洋流就是零。BOSS 掀反洋流时整段相位翻过来。 */
  function driftNow(): { fx: number; fy: number } {
    if (!hasDrift()) return { fx: 0, fy: 0 };
    return driftVector(time, driftFlip);
  }

  function resetLevel(): void {
    const def = level();
    npcs.length = 0;
    pickups.length = 0;
    pops.length = 0;
    inks.length = 0;
    buddies.length = 0;
    hazes.length = 0;
    swirls.length = 0;
    eatLog.length = 0;
    mouthAt = -9;
    growFxAt = -9;
    growMark = -1;
    bossIntroAt = -9;
    bossDefeatFx = null;
    numb = 0;
    crushCount = 0;
    driftFlip = 0;
    sizeCap = sizeCapFor(def);
    buddyTimer = def.buddy ? 4 : Infinity;
    boss = null;
    bossActive = false;
    player.x = w / 2;
    player.y = h / 2;
    player.r = START_RADIUS;
    targetX = player.x;
    targetY = player.y;
    hearts = HEARTS_PER_LEVEL;
    heartsLost = 0;
    score = 0;
    eaten = 0;
    streak = 0;
    invincible = 2;
    shield = 0;
    spawnTimer = 0.4;
    shieldTimer = 9;
    starTimer = 6;
    urchinTimer = 0.5;

    // 章节越深,环境障碍越密、越快
    const tier = hazardTier(levelIdx);
    currents.length = 0;
    vortexes.length = 0;
    eels.length = 0;
    wall = null;
    wallTimer = tier >= 3 ? 3 : 5;
    if (def.hazards.includes("current")) {
      const boost = 1 + (tier - 1) * 0.18;
      currents.push({ fy: 0.26, fh: 0.14, dir: 1, speed: 72 * boost });
      currents.push({ fy: 0.62, fh: 0.14, dir: -1, speed: 64 * boost });
      if (tier >= 2) currents.push({ fy: 0.44, fh: 0.1, dir: 1, speed: 58 * boost });
    }
    if (def.hazards.includes("vortex")) {
      vortexes.push({ fx: 0.3, fy: 0.34 });
      vortexes.push({ fx: 0.72, fy: 0.68 });
      if (tier >= 3) vortexes.push({ fx: 0.5, fy: 0.18 });
    }
    if (def.hazards.includes("eel")) {
      for (const e of eelPlan(def.zone, tier)) eels.push({ ...e });
    }
  }

  function levelCleared(): void {
    earnedStars = starsForLevel(heartsLost);
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
        `${LEVELS.length} 关十二片海域全部通关,连咔咔巨蚌都服气啦!图鉴 ${dexSeen.size}/${DEX.length} · 总星 ${totalStars(progress)}/${LEVELS.length * 3}`,
      );
    } else {
      // 结算面板自动朗读(终局走平台弹窗,那边自带朗读,不叠音)
      speak(clearSpeechLine(level().name, earnedStars, eaten));
      if (gained > 0) {
        api.addStars(gained);
        addFloat(w / 2, h / 2 - 110, `+${gained} ⭐`, "#e0a030", true);
      }
    }
  }

  function loseHeart(x: number, y: number): void {
    if (invincible > 0) return;
    if (shield > 0) {
      shield = 0;
      invincible = 1.2;
      api.play("pop");
      pops.push({ x, y, life: 0.5, color: "#bfe9ff" });
      addFloat(x, y - 20, "护盾碎啦!", "#5a8ac9");
      return;
    }
    hearts--;
    heartsLost++;
    invincible = 2;
    streak = 0;
    shake = 0.4;
    api.play("oops");
    pops.push({ x, y, life: 0.6, color: "#ff9eb5" });
    if (hearts <= 0) {
      phase = "retry";
      speak(retrySpeechLine(bossFailHint()));
    }
  }

  /* ================= 竞技场:无尽「深海马拉松」/ 对战「限时谁更胖」 ================= */

  /** 触屏跟随时,鱼浮在手指上方这么多像素——不许被手指压住。 */
  const FINGER_LIFT = 52;

  function arenaZone(): ReturnType<typeof tierSpec> {
    return tierSpec(arenaTier);
  }

  /** 这一帧整片海往哪推(层数越深洋流越强;第一层没有洋流)。 */
  function arenaDrift(): { fx: number; fy: number } {
    const strength = arenaZone().driftSpeed;
    if (strength <= 0) return { fx: 0, fy: 0 };
    const d = driftVector(arenaTime);
    const k = strength / DRIFT_SPEED;
    return { fx: d.fx * k, fy: d.fy * k };
  }

  function resetArena(mode: ArenaMode, tier: number, level?: RivalLevel): void {
    arenaMode = mode;
    startTier = Math.max(1, Math.min(ENDLESS_TIER_MAX, Math.round(tier)));
    arenaTier = startTier;
    depth = mode === "endless" ? depthForTier(startTier) : 0;
    arenaTime = 0;
    sinceEat = 0;
    eliteLeft = 0;
    arenaSpawn = 0;
    arenaEaten = 0;
    failKind = null;
    newRecord = false;
    score = 0;
    streak = 0;
    arenaFish.length = 0;
    pops.length = 0;
    floats.length = 0;
    inks.length = 0;
    swirls.length = 0;
    arenaEatLog.length = 0;
    arenaStartR = ENDLESS_START_RADIUS;
    mouthAt = -9;
    growFxAt = -9;
    growMark = -1;
    bgTierSeen = -1;
    bgBlendAt = -1;
    grid.clear();
    arenaRng = makeRng(Math.floor(Math.random() * 0xffffffff) || 1);
    me.x = w / 2;
    me.y = h / 2;
    me.r = ENDLESS_START_RADIUS;
    me.shown = ENDLESS_START_RADIUS;
    me.dashLeft = 0;
    me.dashCd = 0;
    me.inv = 1.2;
    me.swallow = 0;
    targetX = me.x;
    targetY = me.y;
    if (mode === "versus") {
      rivalProfile = RIVAL_PROFILES[level ?? "dodge"];
      rival = makeSwimmer(w * 0.75, h * 0.4, ENDLESS_START_RADIUS);
    } else {
      rival = null;
    }
  }

  function startEndless(tier: number): void {
    resetArena("endless", tier);
    endlessBest = readEndlessBest();
    phase = "arena";
    api.play("jump");
  }

  function startVersus(level: RivalLevel): void {
    // 对战固定在第 2 层的鱼群密度上打:两条鱼抢食,再深就变成各躲各的了
    resetArena("versus", 2, level);
    phase = "arena";
    api.play("jump");
  }

  function readEndlessBest(): number {
    try {
      return save.getGameProgress(meta.id).endlessBest;
    } catch {
      return endlessBest;
    }
  }

  /** 竞技场的鱼从左右两边游进来,层数越深越挤。 */
  function spawnArenaFish(): void {
    const spec = arenaZone();
    if (arenaFish.length >= spec.crowd) return;
    const f = spawnEndlessFish(arenaTier, me.r, arenaRng);
    const fromLeft = arenaRng() < 0.5;
    const speed = (46 + arenaRng() * 38) * f.speedMul;
    arenaFish.push({
      x: fromLeft ? -f.r - 12 : w + f.r + 12,
      y: 46 + arenaRng() * Math.max(40, h - 110),
      vx: fromLeft ? speed : -speed,
      vy: (arenaRng() - 0.5) * 26,
      phase: arenaRng() * Math.PI * 2,
      spec: f,
    });
  }

  function swimmerSpeed(s: Swimmer, mul = 1): number {
    return (s.dashLeft > 0 ? dashSpeed(s.r) : endlessSpeed(s.r)) * mul;
  }

  /** 点一下冲刺:有冷却,冲的时候留一串尾迹泡泡。 */
  function tryDash(s: Swimmer, sound: boolean): void {
    if (!dashReady(s.dashCd) || s.dashLeft > 0) return;
    s.dashLeft = DASH_TIME;
    s.dashCd = DASH_CD;
    if (sound) api.play("pop");
  }

  /** 朝 (dx, dy) 游一帧,顺带被洋流推着走,最后夹回池子里。 */
  function moveSwimmer(s: Swimmer, dx: number, dy: number, dt: number, mul = 1): void {
    const len = Math.hypot(dx, dy);
    if (len > 1e-3) {
      const v = swimmerSpeed(s, mul) * dt;
      s.x += (dx / len) * v;
      s.y += (dy / len) * v;
      if (Math.abs(dx) > 0.5) s.facing = dx > 0 ? 1 : -1;
    }
    const drift = arenaDrift();
    s.x += drift.fx * dt;
    s.y += drift.fy * dt;
    s.x = Math.max(s.r, Math.min(w - s.r, s.x));
    s.y = Math.max(s.r + 28, Math.min(h - s.r, s.y));
  }

  /**
   * 被更大的鱼碰到:掉一块质量,身上炸开一串泡泡和彩纸,短暂闪烁无敌。
   * 分级红线——这里只掉泡泡,没有血、没有伤、也没有「消失」。
   */
  function loseChunk(s: Swimmer, fromX: number, fromY: number, isPlayer: boolean): void {
    if (s.inv > 0) return;
    s.r = biteLoss(s.r);
    s.inv = 1.5;
    if (isPlayer) {
      streak = 0;
      shake = 0.35;
      api.play("oops");
      addFloat(s.x, s.y - s.r - 12, "掉了一串泡泡!", "#5a8ac9");
    }
    for (let i = 0; i < 4; i++) {
      pops.push({
        x: s.x + (Math.random() - 0.5) * s.r,
        y: s.y + (Math.random() - 0.5) * s.r,
        life: 0.45,
        color: i % 2 === 0 ? "#bfe9ff" : "#ffd8ea",
      });
    }
    const away = Math.hypot(s.x - fromX, s.y - fromY) || 1;
    s.x += ((s.x - fromX) / away) * 18;
    s.y += ((s.y - fromY) / away) * 18;
  }

  /** 竞技场鱼的展示色(和 drawArenaFish 同一套口径)。 */
  function arenaFishColor(spec: EndlessFish): string {
    if (spec.kind === "toxin") return "#c46ae8";
    if (spec.kind === "elite") return "#ffd868";
    if (spec.danger) return "#8fa8d8";
    return spec.dexId === "lantern" ? "#ffe0a3" : "#a8e6c9";
  }

  /** 吞下一条鱼:长大、拉伸、记图鉴、往下钻一点。 */
  function swallowFish(s: Swimmer, f: ArenaFish, isPlayer: boolean): void {
    s.r = growEndless(s.r, f.spec.r, arenaTier);
    s.swallow = SWALLOW_MS;
    s.swx = f.x - s.x;
    s.swy = f.y - s.y;
    if (f.spec.kind === "elite") eliteLeft = isPlayer ? ELITE_BREAK : eliteLeft;
    if (!isPlayer) {
      // 对手吃鱼也有旋入残影,但不占玩家的嘴巴帧与气泡
      spawnSwirl(swirls, f.x, f.y, Math.min(f.spec.r, 20), arenaFishColor(f.spec), s.x, s.y);
      return;
    }
    arenaEaten++;
    sinceEat = 0;
    streak++;
    streakTimer = 3;
    const gain = eatScore(streak);
    score += gain;
    if (arenaMode === "endless") depth += DEPTH_PER_BITE;
    markDex(f.spec.dexId);
    eatFx(f.x, f.y, f.spec.r, arenaFishColor(f.spec), s.x, s.y, arenaTime);
    logEat(arenaEatLog, f.spec.r, arenaFishColor(f.spec));
    checkGrowFx(s.r, arenaTime);
    pops.push({ x: f.x, y: f.y, life: 0.35, color: "#ffe0a3" });
    if (f.spec.kind === "elite") {
      addFloat(f.x, f.y - 14, `精英鱼!顶住水压 ${ELITE_BREAK} 秒`, "#c47a2a", true);
      api.play("coin");
    } else {
      addFloat(f.x, f.y, streak >= 3 ? `连吃×${streak} +${gain}` : `+${gain}`, streak >= 3 ? "#b28ae8" : "#c47a2a", streak >= 3);
      api.play(streak % 5 === 0 ? "coin" : "pop");
    }
  }

  /** 吃到毒藻鱼:缩一圈 + 麻酥酥,不掉心也不结束,提醒一下就好。 */
  function tasteToxin(f: ArenaFish): void {
    me.r = Math.max(START_RADIUS + 0.5, me.r * 0.9);
    numb = TOXIN_NUMB;
    streak = 0;
    markDex("toxin");
    api.play("oops");
    pops.push({ x: f.x, y: f.y, life: 0.5, color: "#c46ae8" });
    addFloat(f.x, f.y - 16, "毒藻鱼!缩了一圈~", "#8a3a9a", true);
  }

  /** 玩家这一帧想往哪游:键盘优先,其次跟着手指/鼠标。 */
  function playerAim(): { dx: number; dy: number } {
    let kx = 0;
    let ky = 0;
    if (keys.has("left")) kx -= 1;
    if (keys.has("right")) kx += 1;
    if (keys.has("up")) ky -= 1;
    if (keys.has("down")) ky += 1;
    if (kx !== 0 || ky !== 0) return { dx: kx, dy: ky };
    const aimY = targetY - (pointerTouch ? FINGER_LIFT : 0);
    const dx = targetX - me.x;
    const dy = aimY - me.y;
    // 已经贴上手指了就别再抖
    return Math.hypot(dx, dy) < 4 ? { dx: 0, dy: 0 } : { dx, dy };
  }

  /** 对手看到的这一池子鱼:最近能吃的、最近吃不下的。 */
  function rivalView(r: Swimmer): { prey: ArenaFish | null; threat: ArenaFish | null } {
    let prey: ArenaFish | null = null;
    let threat: ArenaFish | null = null;
    let bestPrey = Infinity;
    let bestThreat = Infinity;
    for (const f of arenaFish) {
      const d = Math.hypot(f.x - r.x, f.y - r.y);
      if (f.spec.kind === "toxin") continue;
      if (canSwallow(r.r, f.spec.r)) {
        if (d < bestPrey) {
          bestPrey = d;
          prey = f;
        }
      } else if (isPredator(r.r, f.spec.r) && d < bestThreat) {
        bestThreat = d;
        threat = f;
      }
    }
    return { prey, threat };
  }

  function updateArena(dt: number): void {
    arenaTime += dt;
    numb = Math.max(0, numb - dt);
    me.dashCd = Math.max(0, me.dashCd - dt);
    me.dashLeft = Math.max(0, me.dashLeft - dt);
    me.inv = Math.max(0, me.inv - dt);
    me.swallow = Math.max(0, me.swallow - dt * 1000);
    eliteLeft = Math.max(0, eliteLeft - dt);
    if (streakTimer > 0) {
      streakTimer -= dt;
      if (streakTimer <= 0) streak = 0;
    }

    // 层数:每 400 米或每 45 秒进一层,快的那条说了算
    if (arenaMode === "endless") {
      const next = tierAt(depth, arenaTime);
      if (next > arenaTier) {
        arenaTier = next;
        shake = 0.3;
        api.play("jump");
        addFloat(w / 2, 118, `第 ${arenaTier} 层 · ${arenaZone().name}`, arenaZone().accent, true);
      }
    }

    // 玩家走位(麻酥酥期间反应变笨,但不掉体型)
    const aim = playerAim();
    moveSwimmer(me, aim.dx, aim.dy, dt, numbFollowMult(numb));
    if (me.facing !== lastFacing) {
      lastFacing = me.facing;
      turnBubbles(me.x + me.facing * me.shown * 0.8, me.y, me.facing);
    }

    // 鱼群移动
    arenaSpawn -= dt;
    if (arenaSpawn <= 0) {
      arenaSpawn = 0.42;
      spawnArenaFish();
    }
    const drift = arenaDrift();
    for (let i = arenaFish.length - 1; i >= 0; i--) {
      const f = arenaFish[i];
      f.phase += dt * 3;
      f.x += (f.vx + drift.fx * 0.6) * dt;
      f.y += (f.vy + drift.fy * 0.6) * dt + Math.sin(f.phase) * 10 * dt;
      if (f.y < 30 || f.y > h - 20) f.vy = -f.vy;
      if (f.x < -f.spec.r - 70 || f.x > w + f.spec.r + 70) arenaFish.splice(i, 1);
    }

    // 邻域网格:只和身边格子里的鱼比,鱼再多也不会掉帧
    grid.clear();
    for (const f of arenaFish) grid.insert(f);

    const eatenNow = new Set<ArenaFish>();
    for (const f of grid.near(me.x, me.y, me.r + 110)) {
      if (eatenNow.has(f)) continue;
      if (!circlesOverlap(me.x, me.y, me.r, f.x, f.y, f.spec.r)) continue;
      if (f.spec.kind === "toxin") {
        eatenNow.add(f);
        tasteToxin(f);
        continue;
      }
      if (canSwallow(me.r, f.spec.r)) {
        eatenNow.add(f);
        swallowFish(me, f, true);
        continue;
      }
      if (isPredator(me.r, f.spec.r)) loseChunk(me, f.x, f.y, true);
    }

    // 对手:三档 AI 决策 → 同一套追逐与吞咽
    if (rival) {
      const r = rival;
      r.dashCd = Math.max(0, r.dashCd - dt);
      r.dashLeft = Math.max(0, r.dashLeft - dt);
      r.inv = Math.max(0, r.inv - dt);
      r.swallow = Math.max(0, r.swallow - dt * 1000);
      const view = rivalView(r);
      const move = rivalSteer(
        rivalProfile,
        {
          self: { x: r.x, y: r.y, r: r.r },
          player: { x: me.x, y: me.y, r: me.r },
          prey: view.prey ? { x: view.prey.x, y: view.prey.y, r: view.prey.spec.r } : null,
          threat: view.threat ? { x: view.threat.x, y: view.threat.y, r: view.threat.spec.r } : null,
          width: w,
          height: h,
        },
        arenaRng,
      );
      if (move.dash) tryDash(r, false);
      moveSwimmer(r, move.dx, move.dy, dt, rivalProfile.speedMul);
      for (const f of grid.near(r.x, r.y, r.r + 110)) {
        if (eatenNow.has(f)) continue;
        if (f.spec.kind === "toxin") continue;
        if (!circlesOverlap(r.x, r.y, r.r, f.x, f.y, f.spec.r)) continue;
        if (canSwallow(r.r, f.spec.r)) {
          eatenNow.add(f);
          swallowFish(r, f, false);
        } else if (isPredator(r.r, f.spec.r)) {
          loseChunk(r, f.x, f.y, false);
        }
      }
      // 两条鱼撞上:谁明显更大谁占便宜,差不多大就只是撞一下
      if (circlesOverlap(me.x, me.y, me.r, r.x, r.y, r.r, 0.72)) {
        if (canSwallow(me.r, r.r)) {
          loseChunk(r, me.x, me.y, false);
          me.r = growEndless(me.r, r.r * 0.35, arenaTier);
          me.swallow = SWALLOW_MS;
          me.swx = r.x - me.x;
          me.swy = r.y - me.y;
          api.play("coin");
        } else if (canSwallow(r.r, me.r)) {
          loseChunk(me, r.x, r.y, true);
        }
      }
    }

    if (eatenNow.size > 0) {
      for (let i = arenaFish.length - 1; i >= 0; i--) {
        if (eatenNow.has(arenaFish[i])) arenaFish.splice(i, 1);
      }
    }

    // 深渊压力:第 5 层起超过上限就慢慢缩,吃到精英鱼能顶住 10 秒
    me.r = pressureDrain(me.r, arenaTier, dt, eliteLeft);
    if (rival) rival.r = pressureDrain(rival.r, arenaTier, dt, 0);

    me.shown = easeRadius(me.shown, me.r, dt);
    if (rival) rival.shown = easeRadius(rival.shown, rival.r, dt);

    if (arenaMode === "endless") {
      depth += depthGain(dt, me.dashLeft > 0);
      sinceEat += dt;
      const fail = endlessFailAt(me.r, sinceEat);
      if (fail) finishArena(fail);
      return;
    }

    // 对战:60 秒到点比体型
    if (arenaTime >= VERSUS_SECONDS) finishArena(null);
  }

  /** 这一趟结束:无尽先把成绩报给平台,对战直接比体型。 */
  function finishArena(fail: EndlessFail | null): void {
    failKind = fail;
    phase = "arenaOver";
    if (arenaMode === "endless") {
      const scoreDepth = Math.max(0, Math.floor(depth));
      const before = readEndlessBest();
      try {
        endlessBest = save.recordEndlessBest(meta.id, scoreDepth);
      } catch {
        endlessBest = Math.max(before, scoreDepth);
      }
      newRecord = scoreDepth > before;
      api.play(newRecord ? "win" : "oops");
      speak(
        endlessFailCopy(fail ?? "starved", scoreDepth).line +
          endlessRecordSay(scoreDepth, before, newRecord),
      );
      return;
    }
    versusResult = versusOutcome(me.r, rival ? rival.r : 0);
    api.play(versusResult === "lose" ? "oops" : "win");
    speak(versusCopy(versusResult, rivalProfile, me.r, rival ? rival.r : 0).line);
  }

  /* ---------------- 平台接线:直开第 N 关 / 家长跳关 ---------------- */

  /**
   * 直开第 n 关(1 基)。越界夹到 1..188,不合法的数字当第 1 关。
   * 平台给了 `initialLevel`、地址栏带着 `?level=`,或者外面拿着 handle 调进来,走的都是这一条。
   */
  function openCampaignLevel(n: number): void {
    if (destroyed) return;
    stopSpeaking();
    levelIdx = clampLevelIndex(n);
    chapterIdx = themeIndexOf(levelIdx);
    resetLevel();
    phase = "intro";
  }

  /** 这一关能不能跳:战役里、不是最后一关、壳层注册过家长授权门。 */
  function canSkip(): boolean {
    return (
      (phase === "intro" || phase === "retry") &&
      levelIdx < CAMPAIGN_TOTAL - 1 &&
      typeof getLevelExtras().requestSkip === "function"
    );
  }

  /**
   * 跳过这一关。授权是家长那道高权限门给的,这边只负责记账:
   * 本关星级仍旧记 0(跳过去不是本事),但下一关照样解锁。
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
        if (progress[target] === undefined) progress[target] = 0;
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

  /** 关卡解锁:上一关通关过,或者上一关被家长跳过。 */
  function levelUnlocked(idx: number): boolean {
    return isUnlockedWith(progress, skips, idx);
  }

  /** 章节解锁跟着同一个口径走。 */
  function themeUnlocked(ci: number): boolean {
    return levelUnlocked(themeStart(ci));
  }

  /** 战役打到第几关了(0 基):无尽默认从这一关对应的水层起步。 */
  function furthestLevel(): number {
    let last = 0;
    for (let i = 0; i < progress.length; i++) if ((progress[i] ?? 0) > 0) last = i + 1;
    return Math.min(CAMPAIGN_TOTAL - 1, last);
  }

  /** 键盘:WASD / 方向键游动,空格冲刺。Esc 一概不碰,留给壳层接管暂停。 */
  function keyName(code: string, key: string): string | null {
    if (code === "KeyA" || code === "ArrowLeft") return "left";
    if (code === "KeyD" || code === "ArrowRight") return "right";
    if (code === "KeyW" || code === "ArrowUp") return "up";
    if (code === "KeyS" || code === "ArrowDown") return "down";
    if (code === "Space" || key === " ") return "dash";
    return null;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed || phase !== "arena") return;
    const name = keyName(e.code, e.key);
    if (!name) return;
    if (name === "dash") {
      tryDash(me, true);
      return;
    }
    keys.add(name);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const name = keyName(e.code, e.key);
    if (name && name !== "dash") keys.delete(name);
  }

  // ---- 输入 ----
  function inRect(x: number, y: number, r: Rect | null): boolean {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    pointerTouch = e.pointerType === "touch";
  }

  function onPointerDown(e: PointerEvent): void {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (phase === "home") {
      if (inRect(px, py, btnDex)) {
        api.play("tap");
        phase = "dex";
        return;
      }
      for (const c of homeCards) {
        if (!inRect(px, py, c.rect)) continue;
        api.play("tap");
        if (c.id === "campaign") phase = "themes";
        else if (c.id === "versus") phase = "rivalPick";
        else startEndless(startTierForLevel(furthestLevel() + 1));
        return;
      }
      return;
    }
    if (phase === "rivalPick") {
      if (inRect(px, py, btnBack)) {
        api.play("tap");
        phase = "home";
        return;
      }
      for (const c of rivalCards) {
        if (!inRect(px, py, c.rect)) continue;
        startVersus(c.id);
        return;
      }
      return;
    }
    if (phase === "arena") {
      onPointerMove(e);
      // 空白处按一下就是冲刺:窄屏上不另设按钮,免得挡住鱼
      tryDash(me, true);
      return;
    }
    if (phase === "arenaOver") {
      if (inRect(px, py, btnAgain)) {
        api.play("tap");
        stopSpeaking();
        if (arenaMode === "endless") startEndless(startTier);
        else startVersus(rivalProfile.id);
      } else if (inRect(px, py, btnHome)) {
        api.play("tap");
        stopSpeaking();
        phase = "home";
      }
      return;
    }
    if (phase === "themes") {
      if (inRect(px, py, btnBack)) {
        api.play("tap");
        phase = "home";
        return;
      }
      if (inRect(px, py, btnDex)) {
        api.play("tap");
        phase = "dex";
        return;
      }
      for (const c of themeCards) {
        if (inRect(px, py, c.rect)) {
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
      if (inRect(px, py, btnBack)) {
        api.play("tap");
        phase = "themes";
        return;
      }
      for (const n of mapNodes) {
        if (Math.hypot(px - n.x, py - n.y) <= n.r + 8) {
          if (levelUnlocked(n.idx)) {
            api.play("tap");
            levelIdx = n.idx;
            resetLevel();
            phase = "intro";
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "dex") {
      api.play("tap");
      phase = "home";
      return;
    }
    if (phase === "intro") {
      if (inRect(px, py, btnSkip)) {
        askSkip();
        return;
      }
      api.play("tap");
      phase = "play";
      invincible = 2;
      return;
    }
    if (phase === "clear") {
      if (inRect(px, py, btnNext)) {
        api.play("tap");
        stopSpeaking();
        levelIdx++;
        chapterIdx = themeIndexOf(levelIdx);
        resetLevel();
        phase = "intro";
      } else if (inRect(px, py, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = "map";
      }
      return;
    }
    if (phase === "retry") {
      if (inRect(px, py, btnSkip)) {
        askSkip();
        return;
      }
      if (inRect(px, py, btnRetry)) {
        api.play("tap");
        stopSpeaking();
        resetLevel();
        phase = "play";
      } else if (inRect(px, py, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = "map";
      }
      return;
    }
    onPointerMove(e);
  }

  // ---- 生成 ----
  function spawnNpc(): void {
    const def = level();
    const sm = ZONE_STYLE[def.zone].speedMult;
    const fromLeft = Math.random() < 0.5;
    const roll = Math.random();
    if (def.hazards.includes("puffer") && roll < 0.15) {
      const r = 16 + Math.random() * 8;
      npcs.push({
        kind: "puffer",
        x: fromLeft ? -r - 10 : w + r + 10,
        y: 60 + Math.random() * Math.max(60, h - 160),
        r,
        vx: (fromLeft ? 1 : -1) * (30 + Math.random() * 25) * sm,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        color: "#ffd6a8",
        inflated: 0,
        inflateClock: 1 + Math.random() * 2,
        inkCd: 0,
      });
      markDex("puffer");
      return;
    }
    if (def.hazards.includes("toxin") && roll < 0.22) {
      // 毒藻鱼:个头永远比你小一圈,看着好吃,咬下去却会缩水
      const r = Math.max(9, player.r * (0.4 + Math.random() * 0.28));
      npcs.push({
        kind: "toxin",
        x: fromLeft ? -r - 10 : w + r + 10,
        y: 60 + Math.random() * Math.max(60, h - 160),
        r,
        vx: (fromLeft ? 1 : -1) * (34 + Math.random() * 20) * sm,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        color: "#c46ae8",
        inflated: 0,
        inflateClock: 0,
        inkCd: 0,
      });
      markDex("toxin");
      return;
    }
    if (def.hazards.includes("squid") && roll < 0.3) {
      const r = 13 + Math.random() * 6;
      npcs.push({
        kind: "squid",
        x: fromLeft ? -r - 10 : w + r + 10,
        y: 60 + Math.random() * Math.max(60, h - 160),
        r,
        vx: (fromLeft ? 1 : -1) * (36 + Math.random() * 22) * sm,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        color: "#d8b8f0",
        inflated: 0,
        inflateClock: 0,
        inkCd: 1 + Math.random(),
      });
      markDex("squid");
      return;
    }
    const r = spawnRadius(player.r, Math.random(), def.bigFishBias);
    const speed = (40 + Math.random() * 55 + (r < player.r ? 15 : 0)) * sm;
    npcs.push({
      kind: "fish",
      x: fromLeft ? -r - 10 : w + r + 10,
      y: 40 + Math.random() * Math.max(40, h - 120),
      r,
      vx: fromLeft ? speed : -speed,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      color: canEat(player.r, r)
        ? SMALL_COLORS[Math.floor(Math.random() * SMALL_COLORS.length)]
        : BIG_COLORS[Math.floor(Math.random() * BIG_COLORS.length)],
      inflated: 0,
      inflateClock: 0,
      inkCd: 0,
    });
  }

  function ensureJellies(): void {
    if (!level().hazards.includes("jelly")) return;
    const sm = ZONE_STYLE[level().zone].speedMult;
    const want = 2 + hazardTier(levelIdx);
    const have = npcs.filter((n) => n.kind === "jelly").length;
    for (let i = have; i < want; i++) {
      npcs.push({
        kind: "jelly",
        x: 60 + Math.random() * (w - 120),
        y: -30 - Math.random() * 80,
        r: 20 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 24 * sm,
        vy: (26 + Math.random() * 18) * sm,
        phase: Math.random() * Math.PI * 2,
        color: "#e5c4f2",
        inflated: 0,
        inflateClock: 0,
        inkCd: 0,
      });
      markDex("jelly");
    }
  }

  function ensureUrchins(): void {
    if (!level().hazards.includes("urchin")) return;
    const sm = ZONE_STYLE[level().zone].speedMult;
    const want = 2 + hazardTier(levelIdx);
    const have = npcs.filter((n) => n.kind === "urchin").length;
    urchinTimer -= 1 / 60;
    for (let i = have; i < want; i++) {
      const ang = Math.random() * Math.PI * 2;
      npcs.push({
        kind: "urchin",
        x: 60 + Math.random() * (w - 120),
        y: Math.random() < 0.5 ? -26 : h + 26,
        r: 16 + Math.random() * 6,
        vx: Math.cos(ang) * 34 * sm,
        vy: (20 + Math.random() * 16) * sm,
        phase: Math.random() * Math.PI * 2,
        color: "#9a7ab8",
        inflated: 0,
        inflateClock: 0,
        inkCd: 0,
      });
      markDex("urchin");
    }
  }

  function spawnBoss(): void {
    const def = level();
    if (!def.boss) return;
    const spec = BOSS_INFO[def.boss];
    bossActive = true;
    boss = {
      kind: def.boss,
      x: w + spec.r + 20,
      y: h * 0.4,
      r: spec.r,
      hp: spec.hp,
      maxHp: spec.hp,
      vx: -50,
      vy: 0,
      dashTimer: spec.dashCd,
      inkTimer: 2.5,
      summonTimer: 3.5,
      driftTimer: 4,
      hazeTimer: 3,
      crushTimer: 6,
      hurt: 0,
    };
    markDex(def.boss);
    bossIntroAt = time;
    addFloat(w / 2, h * 0.3, `${spec.name}出现啦!`, "#e05a7a", true);
    api.play("jump");
    shake = reducedMotion ? 0.15 : 0.5;
  }

  // ---- 更新 ----
  function update(dt: number): void {
    time += dt;
    shake = Math.max(0, shake - dt);
    invincible = Math.max(0, invincible - dt);
    shield = Math.max(0, shield - dt);
    if (streakTimer > 0) {
      streakTimer -= dt;
      if (streakTimer <= 0) streak = 0;
    }

    if (Math.random() < dt * 3 && bubbles.length < bubbleCap(quality(), reducedMotion)) {
      bubbles.push({ x: Math.random() * w, y: h + 10, r: 3 + Math.random() * 6, vy: 30 + Math.random() * 40 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].y -= bubbles[i].vy * dt;
      if (bubbles[i].y < -12) bubbles.splice(i, 1);
    }
    stepSwirls(swirls, dt);
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= dt * 30;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    for (let i = inks.length - 1; i >= 0; i--) {
      inks[i].life -= dt;
      inks[i].r += dt * 14;
      if (inks[i].life <= 0) inks.splice(i, 1);
    }
    for (let i = hazes.length - 1; i >= 0; i--) {
      hazes[i].life -= dt;
      hazes[i].r += dt * 10;
      if (hazes[i].life <= 0) hazes.splice(i, 1);
    }

    if (phase === "arena") {
      updateArena(dt);
      return;
    }
    if (phase !== "play") return;

    const def = level();
    numb = Math.max(0, numb - dt);

    // 玩家跟随指针(单指:按下即游、指哪游哪)
    // 触控修复:跟随速度 5.5→7,窄屏上小鱼贴手更紧,不再有"慢半拍"的拖沓感
    // 1.1:吃到毒藻鱼会"麻酥酥",这段时间跟手变迟钝(不掉心,只是手感变笨)
    const k = Math.min(1, dt * 7 * numbFollowMult(numb));
    const dx = targetX - player.x;
    player.x += dx * k;
    player.y += (targetY - player.y) * k;
    if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1;
    if (player.facing !== lastFacing) {
      lastFacing = player.facing;
      turnBubbles(player.x + player.facing * player.r * 0.8, player.y, player.facing);
    }

    // 洋流:整片海一个方向,周期换向,玩家和所有鱼一起被推着走
    const drift = driftNow();
    if (drift.fx !== 0 || drift.fy !== 0) {
      player.x += drift.fx * dt;
      player.y += drift.fy * dt;
    }

    // 水流带推动
    for (const c of currents) {
      const y0 = c.fy * h;
      const y1 = (c.fy + c.fh) * h;
      if (player.y > y0 && player.y < y1) {
        player.x += c.dir * c.speed * dt;
      }
    }
    // 涡流吸引
    for (const v of vortexes) {
      const pull = vortexPull(player.x - v.fx * w, player.y - v.fy * h);
      player.x += pull.fx * dt;
      player.y += pull.fy * dt;
    }
    player.x = Math.max(player.r, Math.min(w - player.r, player.x));
    player.y = Math.max(player.r, Math.min(h - player.r, player.y));

    // 电电草:通电时碰到会麻
    for (const e of eels) {
      const ex = e.fx * w;
      if (eelActive(time, e.offset) && Math.abs(player.x - ex) < eelReach(player.r)) {
        loseHeart(player.x, player.y);
        if (phase !== "play") return;
      }
    }

    // 气泡墙:整面墙横扫,只能从缺口穿
    if (def.hazards.includes("bubbleWall")) {
      if (!wall) {
        wallTimer -= dt;
        if (wallTimer <= 0) {
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          wall = {
            x: dir > 0 ? -30 : w + 30,
            dir,
            gapY: h * (0.25 + Math.random() * 0.5),
          };
          api.play("pop");
        }
      } else {
        wall.x += wall.dir * 62 * dt;
        // 玩家不在缺口里就被墙推着走
        if (Math.abs(player.x - wall.x) < player.r + 14 && !inBubbleGap(player.y, wall.gapY)) {
          player.x = wall.x + wall.dir * (player.r + 16);
          targetX = player.x;
          player.x = Math.max(player.r, Math.min(w - player.r, player.x));
        }
        if (wall.x < -60 || wall.x > w + 60) {
          wall = null;
          wallTimer = 6 + Math.random() * 4;
        }
      }
    }

    // 生成
    spawnTimer -= dt;
    if (spawnTimer <= 0 && npcs.filter((n) => n.kind === "fish").length < 9) {
      spawnTimer = 0.8;
      spawnNpc();
    }
    ensureJellies();
    ensureUrchins();
    shieldTimer -= dt;
    if (shieldTimer <= 0) {
      shieldTimer = 11 + Math.random() * 5;
      pickups.push({ kind: "shield", x: 40 + Math.random() * (w - 80), y: h + 20, vy: -36, phase: 0 });
    }
    starTimer -= dt;
    if (starTimer <= 0) {
      starTimer = 7 + Math.random() * 4;
      pickups.push({ kind: "star", x: 40 + Math.random() * (w - 80), y: h + 20, vy: -46, phase: 0 });
    }
    // 共生小鱼泡泡:带满两条就不再飘了
    buddyTimer -= dt;
    if (buddyTimer <= 0) {
      buddyTimer = buddies.length >= BUDDY_MAX ? 6 : 10 + Math.random() * 5;
      if (buddies.length < BUDDY_MAX) {
        pickups.push({ kind: "buddy", x: 40 + Math.random() * (w - 80), y: h + 20, vy: -40, phase: 0 });
      }
    }

    // 道具
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy * dt;
      p.phase += dt * 4;
      p.x += Math.sin(p.phase) * 14 * dt;
      if (p.y < -30) {
        pickups.splice(i, 1);
        continue;
      }
      if (circlesOverlap(player.x, player.y, player.r, p.x, p.y, 16, 1)) {
        pickups.splice(i, 1);
        if (p.kind === "shield") {
          shield = SHIELD_SECONDS;
          api.play("jump");
          addFloat(p.x, p.y, "护盾泡泡!", "#5a8ac9", true);
        } else if (p.kind === "buddy") {
          buddies.push({ x: player.x, y: player.y, phase: Math.random() * Math.PI * 2, cd: 0 });
          markDex("buddy");
          api.play("meow");
          addFloat(p.x, p.y, "共生小鱼加入!", "#2a8a9a", true);
        } else {
          score += 20;
          api.play("coin");
          addFloat(p.x, p.y, "+20", "#c47a2a");
        }
        pops.push({ x: p.x, y: p.y, life: 0.4, color: "#bfe9ff" });
      }
    }

    // NPC 移动 + 碰撞
    for (let i = npcs.length - 1; i >= 0; i--) {
      const f = npcs[i];
      f.phase += dt * 3;
      // 洋流也推鱼,但推得比玩家轻一点,顺流追鱼才有便宜可占
      if (drift.fx !== 0 || drift.fy !== 0) {
        f.x += drift.fx * dt * 0.6;
        f.y += drift.fy * dt * 0.6;
      }
      if (f.kind === "jelly") {
        f.x += f.vx * dt + Math.sin(f.phase) * 10 * dt;
        f.y += f.vy * dt;
        if (f.x < 30 || f.x > w - 30) f.vx = -f.vx;
        if (f.y > h + 40) {
          f.y = -30;
          f.x = 60 + Math.random() * (w - 120);
        }
      } else if (f.kind === "urchin") {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < f.r || f.x > w - f.r) f.vx = -f.vx;
        if (f.y > h + 40) {
          f.y = -30;
          f.x = 60 + Math.random() * (w - 120);
        }
      } else {
        f.x += f.vx * dt;
        f.y += Math.sin(f.phase) * 12 * dt;
        if (f.kind === "puffer") {
          f.inflateClock -= dt;
          if (f.inflateClock <= 0) {
            f.inflated = f.inflated > 0 ? 0 : 1;
            f.inflateClock = f.inflated > 0 ? 1.6 : 2.2;
          }
        }
        if (f.kind === "squid") {
          f.inkCd -= dt;
          const d = Math.hypot(player.x - f.x, player.y - f.y);
          if (d < 130 && f.inkCd <= 0 && canEat(player.r, f.r)) {
            f.inkCd = 3.5;
            inks.push({ x: f.x, y: f.y, r: 46, life: 2.2 });
            // 逃跑加速
            const away = d || 1;
            f.vx = ((f.x - player.x) / away) * 120;
            api.play("pop");
          }
        }
        if ((f.vx > 0 && f.x > w + f.r + 30) || (f.vx < 0 && f.x < -f.r - 30)) {
          npcs.splice(i, 1);
          continue;
        }
      }

      const effR = f.kind === "puffer" && f.inflated > 0 ? f.r * 1.5 : f.r;
      if (!circlesOverlap(player.x, player.y, player.r, f.x, f.y, effR)) continue;

      if (f.kind === "jelly" || f.kind === "urchin") {
        loseHeart(f.x, f.y);
        if (phase !== "play") return;
        continue;
      }
      if (f.kind === "puffer" && f.inflated > 0) {
        loseHeart(f.x, f.y);
        if (phase !== "play") return;
        continue;
      }
      if (f.kind === "toxin") {
        // 毒藻鱼:不掉心,只是缩一圈 + 麻酥酥,提醒一下就好
        npcs.splice(i, 1);
        player.r = toxinShrink(player.r);
        numb = TOXIN_NUMB;
        streak = 0;
        markDex("toxin");
        api.play("oops");
        pops.push({ x: f.x, y: f.y, life: 0.5, color: "#c46ae8" });
        addFloat(f.x, f.y - 18, "毒藻鱼!缩了一圈~", "#8a3a9a", true);
        continue;
      }
      if (canEat(player.r, f.r)) {
        npcs.splice(i, 1);
        player.r = grow(player.r, f.r, growCap());
        eaten++;
        streak++;
        streakTimer = 3;
        const gain = eatScore(streak);
        score += gain;
        markDex(f.kind === "squid" ? "squid" : f.kind === "puffer" ? "puffer" : dexIdForFish(f.r, player.r));
        addFloat(f.x, f.y, streak >= 3 ? `连吃×${streak} +${gain}` : `+${gain}`, streak >= 3 ? "#b28ae8" : "#c47a2a", streak >= 3);
        eatFx(f.x, f.y, f.r, f.color, player.x + player.facing * player.r * 0.7, player.y, time);
        logEat(eatLog, f.r, f.color);
        checkGrowFx(player.r, time);
        pops.push({ x: f.x, y: f.y, life: 0.4, color: f.color });
        api.play(streak % 5 === 0 ? "coin" : "pop");
        if (player.r >= def.targetR) {
          if (def.boss) {
            if (!bossActive) spawnBoss();
          } else {
            levelCleared();
            return;
          }
        }
      } else if (isDanger(player.r, f.r)) {
        markDex("bigblue");
        loseHeart(f.x, f.y);
        if (phase !== "play") return;
      }
    }

    // 共生小鱼:排队跟在你身后,顺手帮你吃掉小鱼(毒藻鱼它才不碰)
    const br = buddyRadius(player.r);
    for (let bi = 0; bi < buddies.length; bi++) {
      const bd = buddies[bi];
      bd.phase += dt * 4;
      bd.cd = Math.max(0, bd.cd - dt);
      const side = bi === 0 ? -1 : 1;
      const tx = player.x - player.facing * (player.r + 24);
      const ty = player.y + side * (player.r * 0.75 + 12) + Math.sin(bd.phase) * 5;
      const next = buddyStep(bd.x, bd.y, tx, ty, dt);
      bd.x = Math.max(8, Math.min(w - 8, next.x));
      bd.y = Math.max(8, Math.min(h - 8, next.y));
      if (bd.cd > 0) continue;
      for (let i = npcs.length - 1; i >= 0; i--) {
        const f = npcs[i];
        if (f.kind !== "fish" || !buddyCanEat(br, f.r)) continue;
        if (Math.hypot(f.x - bd.x, f.y - bd.y) > BUDDY_REACH) continue;
        npcs.splice(i, 1);
        bd.cd = 1.1;
        score += BUDDY_SCORE;
        eaten++;
        // 小伙伴叼回来喂你一口,长得比自己吃慢一半
        player.r = grow(player.r, f.r * 0.5, growCap());
        pops.push({ x: f.x, y: f.y, life: 0.35, color: f.color });
        addFloat(f.x, f.y - 10, `小鱼帮忙 +${BUDDY_SCORE}`, "#2a8a9a");
        api.play("pop");
        if (player.r >= def.targetR && !def.boss) {
          levelCleared();
          return;
        }
        if (player.r >= def.targetR && def.boss && !bossActive) spawnBoss();
        break;
      }
    }

    // 毒云:碰到缩一圈 + 麻酥酥,同样不掉心
    for (const hz of hazes) {
      if (numb > 0) break;
      if (Math.hypot(player.x - hz.x, player.y - hz.y) < hz.r + player.r * 0.4) {
        player.r = toxinShrink(player.r);
        numb = TOXIN_NUMB;
        api.play("oops");
        addFloat(player.x, player.y - player.r - 14, "紫雾好麻!", "#8a3a9a");
        break;
      }
    }

    // BOSS 行为
    if (boss) {
      const b = boss;
      const spec = BOSS_INFO[b.kind];
      b.hurt = Math.max(0, b.hurt - dt);
      b.dashTimer -= dt;
      if (b.dashTimer <= 0) {
        b.dashTimer = spec.dashCd + Math.random() * 1.2;
        // 狂暴 BOSS:血越少冲刺越快
        const rage = spec.enrages ? 1 + (1 - b.hp / b.maxHp) * 0.6 : 1;
        const d = Math.hypot(player.x - b.x, player.y - b.y) || 1;
        b.vx = ((player.x - b.x) / d) * spec.dashSpeed * rage;
        b.vy = ((player.y - b.y) / d) * spec.dashSpeed * rage;
        api.play("meow");
      }
      if (spec.inks) {
        b.inkTimer -= dt;
        if (b.inkTimer <= 0) {
          b.inkTimer = 3.2;
          inks.push({ x: b.x, y: b.y, r: 78, life: 2.6 });
          api.play("pop");
        }
      }
      // 旋旋鳐:翅膀一挥把整片洋流掀反
      if (spec.drifts) {
        b.driftTimer -= dt;
        if (b.driftTimer <= 0) {
          b.driftTimer = 5.5;
          driftFlip += 0.5;
          shake = 0.35;
          api.play("jump");
          addFloat(b.x, b.y - b.r - 8, "洋流掀反啦!", "#1f6a8a", true);
        }
      }
      // 荧荧海葵王:吐一团紫毒雾
      if (spec.poisons) {
        b.hazeTimer -= dt;
        if (b.hazeTimer <= 0) {
          b.hazeTimer = 3.8;
          hazes.push({ x: b.x, y: b.y, r: 52, life: 3 });
          api.play("pop");
        }
      }
      // 咔咔巨蚌:合壳加压,体型上限一档一档往下掉(但永远够得着目标)
      if (spec.crushes) {
        b.crushTimer -= dt;
        if (b.crushTimer <= 0) {
          b.crushTimer = 6;
          crushCount++;
          sizeCap = crushedCap(sizeCapFor(def), crushCount, def.targetR);
          player.r = Math.min(player.r, sizeCap);
          shake = 0.4;
          api.play("oops");
          addFloat(w / 2, 108, "咔!水压又重了", "#3f4f8e", true);
        }
      }
      // 召唤型 BOSS:周期叫小怪帮忙
      if (spec.summons) {
        b.summonTimer -= dt;
        if (b.summonTimer <= 0) {
          b.summonTimer = 4.5;
          const ang = Math.random() * Math.PI * 2;
          npcs.push({
            kind: spec.summons,
            x: Math.max(40, Math.min(w - 40, b.x + Math.cos(ang) * (b.r + 30))),
            y: Math.max(40, Math.min(h - 40, b.y + Math.sin(ang) * (b.r + 30))),
            r: 17 + Math.random() * 5,
            vx: (Math.random() - 0.5) * 40,
            vy: spec.summons === "jelly" ? 24 + Math.random() * 14 : 26 + Math.random() * 12,
            phase: Math.random() * Math.PI * 2,
            color: spec.summons === "jelly" ? "#e5c4f2" : "#9a7ab8",
            inflated: 0,
            inflateClock: 0,
            inkCd: 0,
          });
          markDex(spec.summons);
          addFloat(b.x, b.y - b.r - 8, "帮手来啦!", "#8a5ac9");
          api.play("pop");
        }
      }
      // 吸力型 BOSS:把玩家往嘴边吸
      if (spec.pulls) {
        const d = Math.hypot(player.x - b.x, player.y - b.y);
        if (d > 1 && d < 230) {
          const pull = 62 * (1 - d / 230);
          player.x += ((b.x - player.x) / d) * pull * dt;
          player.y += ((b.y - player.y) / d) * pull * dt;
        }
      }
      b.vx *= 1 - Math.min(1, dt * 0.7);
      b.vy *= 1 - Math.min(1, dt * 0.7);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = Math.max(-40, Math.min(w + 40, b.x));
      b.y = Math.max(60, Math.min(h - 60, b.y));

      if (circlesOverlap(player.x, player.y, player.r, b.x, b.y, b.r, 0.7)) {
        if (bossBiteReady(player.r, b.r)) {
          if (b.hurt <= 0) {
            b.hp--;
            b.hurt = 1;
            score += 50;
            shake = 0.4;
            api.play("coin");
            addFloat(b.x, b.y - b.r, `咬到啦!还剩 ${Math.max(0, b.hp)} 口`, "#e05a7a", true);
            pops.push({ x: b.x, y: b.y, life: 0.6, color: "#ff9eb5" });
            const d = Math.hypot(player.x - b.x, player.y - b.y) || 1;
            targetX = player.x + ((player.x - b.x) / d) * 120;
            targetY = player.y + ((player.y - b.y) / d) * 120;
            if (b.hp <= 0) {
              // 战败演出(翻白肚缓沉 + 气泡星星)交给绘制侧,判定这边照旧收关
              bossDefeatFx = { kind: b.kind, x: b.x, y: b.y, r: b.r, at: time };
              const cap = bubbleCap(quality(), reducedMotion);
              for (let i = 0; i < (reducedMotion ? 4 : 9); i++) {
                if (bubbles.length >= cap) break;
                bubbles.push({ x: b.x + (Math.random() - 0.5) * b.r * 1.6, y: b.y + (Math.random() - 0.5) * b.r, r: 3 + Math.random() * 5, vy: 40 + Math.random() * 50 });
              }
              boss = null;
              levelCleared();
              return;
            }
          }
        } else {
          loseHeart(player.x, player.y);
          if (phase !== "play") return;
        }
      }
    }
  }

  // ---- 绘制 ----
  /**
   * 1.3 主角待遇的鱼:双色渐变身体、弧形鳞纹、背鳍胸鳍、两叉摆动尾鳍、
   * 会眨的眼睛、吞吃那一帧张大的嘴。头饰双通道:P1 金冠 / P2 银星 / 普通鱼没有。
   * 具体几何全部在 `art.drawFishBody`(纯函数,契约测试盯着)。
   */
  function drawFish(
    x: number,
    y: number,
    r: number,
    facing: number,
    color: string,
    head: Headdress,
    t: number,
    mouth = 0,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    drawFishBody(ctx, { r, color, t, reduced: reducedMotion, head, mouth });
    ctx.restore();
  }

  /** 成长升档金光:一圈金环扩散 + 短暂 1.15 倍弹性缩放(reduced 只留金环淡出)。 */
  function drawGrowFx(x: number, y: number, r: number, now: number): number {
    const t = now - growFxAt;
    if (t < 0 || t >= GROW_FX_S) return 1;
    const fx = growFx(t, reducedMotion);
    ctx.save();
    ctx.globalAlpha = fx.ringAlpha;
    ctx.strokeStyle = "#ffd868";
    ctx.lineWidth = Math.max(2, r * 0.14) * (1 - fx.ring01 * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r * (1.1 + fx.ring01 * 1.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    return fx.scale;
  }

  /** 被吞的鱼缩小旋入嘴的残影(0.2s,reduced 不旋转只缩小淡出)。 */
  function drawSwirls(): void {
    for (const s of swirls) {
      const p = swirlPose(s, reducedMotion);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, s.r * p.scale, s.r * 0.6 * p.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s.r * 0.8 * p.scale, 0);
      ctx.lineTo(-s.r * 1.4 * p.scale, -s.r * 0.5 * p.scale);
      ctx.lineTo(-s.r * 1.4 * p.scale, s.r * 0.5 * p.scale);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  function drawJelly(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    // 半透明发光伞盖:径向渐变,中心亮
    const g = ctx.createRadialGradient(0, -f.r * 0.25, f.r * 0.12, 0, 0, f.r * 1.05);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.45, f.color);
    g.addColorStop(1, shade(f.color, -0.18));
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, Math.PI, 0);
    const squig = Math.sin(f.phase * 2) * f.r * 0.12;
    ctx.quadraticCurveTo(f.r * 0.6, f.r * 0.3 + squig, 0, f.r * 0.28);
    ctx.quadraticCurveTo(-f.r * 0.6, f.r * 0.3 - squig, -f.r, 0);
    ctx.fill();
    // 伞缘 8 个发光点:呼吸(reduced 静态常亮)
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / 8;
      ctx.globalAlpha = jellyGlowPulse(f.phase, i, reducedMotion);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * f.r * 0.92, Math.sin(a) * f.r * 0.92, f.r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * f.r * 0.4, f.r * 0.25);
      ctx.quadraticCurveTo(
        i * f.r * 0.4 + Math.sin(f.phase * 3 + i) * 6,
        f.r * 0.8,
        i * f.r * 0.4 + Math.sin(f.phase * 3 + i + 1) * 8,
        f.r * 1.25,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-f.r * 0.28, -f.r * 0.2, f.r * 0.09, 0, Math.PI * 2);
    ctx.arc(f.r * 0.28, -f.r * 0.2, f.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPuffer(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.vx >= 0 ? 1 : -1, 1);
    // 鼓起瞬间的弹性过冲(1.5→1.65→1.5,reduced 不过冲):
    // 鼓起时 inflateClock 从 1.6 往下数,过了多久 = 1.6 - inflateClock
    const sinceInflate = f.inflated > 0 ? 1.6 - f.inflateClock : -1;
    const r = f.r * pufferInflateScale(sinceInflate, reducedMotion);
    if (f.inflated > 0) {
      // 刺:根粗尖细的小三角 + 刺尖高光点
      ctx.fillStyle = "#e8a878";
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(nx * r * 0.88 - ny * r * 0.09, ny * r * 0.88 + nx * r * 0.09);
        ctx.lineTo(nx * r * 1.18, ny * r * 1.18);
        ctx.lineTo(nx * r * 0.88 + ny * r * 0.09, ny * r * 0.88 - nx * r * 0.09);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#fff2e0";
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.14, Math.sin(a) * r * 1.14, Math.max(1, r * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 身体:上深下浅两阶
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, shade(f.color, -0.16));
    g.addColorStop(1, shade(f.color, 0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.15, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.15, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawUrchin(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.phase * 0.5);
    // 刺:根粗尖细的渐变三角
    ctx.fillStyle = "#7a5a98";
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(nx * f.r * 0.55 - ny * f.r * 0.1, ny * f.r * 0.55 + nx * f.r * 0.1);
      ctx.lineTo(nx * f.r * 1.28, ny * f.r * 1.28);
      ctx.lineTo(nx * f.r * 0.55 + ny * f.r * 0.1, ny * f.r * 0.55 - nx * f.r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    // 球身:两阶明暗
    const g = ctx.createRadialGradient(-f.r * 0.2, -f.r * 0.25, f.r * 0.1, 0, 0, f.r * 0.85);
    g.addColorStop(0, shade(f.color, 0.25));
    g.addColorStop(1, shade(f.color, -0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // 中心宝石眼:菱形高光
    ctx.fillStyle = "#e8d8ff";
    ctx.beginPath();
    ctx.moveTo(0, f.r * 0.16);
    ctx.lineTo(f.r * 0.14, f.r * 0.32);
    ctx.lineTo(0, f.r * 0.48);
    ctx.lineTo(-f.r * 0.14, f.r * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-f.r * 0.25, -f.r * 0.1, f.r * 0.16, 0, Math.PI * 2);
    ctx.arc(f.r * 0.25, -f.r * 0.1, f.r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-f.r * 0.25, -f.r * 0.1, f.r * 0.08, 0, Math.PI * 2);
    ctx.arc(f.r * 0.25, -f.r * 0.1, f.r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSquid(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.vx >= 0 ? 1 : -1, 1);
    // 喷墨后退时(inkCd 刚重置)身后拖 3 团墨雾
    if (f.inkCd > 2.9) {
      const fade = (f.inkCd - 2.9) / 0.6;
      ctx.fillStyle = `rgba(74,58,94,${0.3 * fade})`;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(f.r * (0.9 + i * 0.55), Math.sin(f.phase * 2 + i) * f.r * 0.3, f.r * (0.5 - i * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 半透明身体
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = f.color;
    // 身体三角帽
    ctx.beginPath();
    ctx.moveTo(-f.r * 1.4, 0);
    ctx.quadraticCurveTo(-f.r * 0.6, -f.r * 1.1, f.r * 0.4, -f.r * 0.5);
    ctx.quadraticCurveTo(f.r * 0.8, 0, f.r * 0.4, f.r * 0.5);
    ctx.quadraticCurveTo(-f.r * 0.6, f.r * 1.1, -f.r * 1.4, 0);
    ctx.fill();
    // 触手
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(f.r * 0.4, i * f.r * 0.3);
      ctx.quadraticCurveTo(
        f.r * 0.9,
        i * f.r * 0.5 + Math.sin(f.phase * 4 + i) * 4,
        f.r * 1.3,
        i * f.r * 0.6 + Math.sin(f.phase * 4 + i + 1) * 5,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, -f.r * 0.1, f.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(0, -f.r * 0.1, f.r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 毒藻鱼:亮紫小鱼 + 危险绿气泡光环(缓慢脉动,reduced 静态)。
   * 光环是形状通道——色弱的孩子不靠颜色也一眼认出「这条不能吃」。
   */
  function drawToxin(f: Npc): void {
    drawToxinAura(ctx, f.x, f.y, f.r, f.phase, reducedMotion);
    drawFish(f.x, f.y, f.r, f.vx >= 0 ? 1 : -1, f.color, "none", time + f.phase);
  }

  /** 共生小鱼:小小一条青绿色的伙伴,身后拖一串气泡。 */
  function drawBuddy(bd: Buddy): void {
    const r = buddyRadius(player.r);
    drawFish(bd.x, bd.y, r, player.facing, "#7fe0c8", "none", time + bd.phase);
    for (let i = 1; i <= 2; i++) {
      drawBubble(ctx, bd.x - player.facing * (r * 1.6 + i * 8), bd.y + Math.sin(bd.phase + i) * 4, 2.5 + i, 0.6);
    }
  }

  /* ---------------- 竞技场的画法 ---------------- */

  /**
   * 会吞咽拉伸的角色。180ms 里朝着刚吃下的那条鱼拉长再回正,
   * `prefers-reduced-motion` 下 `swallowStretch` 一路返回 1——只剩音效与半径插值。
   * 头饰双通道:玩家金冠、对手银星,形状和颜色都不同。
   */
  function drawSwimmer(s: Swimmer, color: string, head: Headdress): void {
    const st = swallowStretch(SWALLOW_MS - s.swallow, reducedMotion);
    const ang = Math.atan2(s.swy, s.swx);
    // 成长升档金光(玩家吃大一圈时闪一下,只对戴金冠的自己)
    const scale = head === "crown" ? drawGrowFx(s.x, s.y, s.shown, arenaTime) : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(ang);
    ctx.scale(st.along * scale, st.across * scale);
    ctx.rotate(-ang);
    ctx.translate(-s.x, -s.y);
    const mouth = head === "crown" ? mouthOpen01(Math.max(0, arenaTime - mouthAt) * 1000) : mouthOpen01(SWALLOW_MS - s.swallow);
    drawFish(s.x, s.y, s.shown, s.facing, color, head, arenaTime, mouth);
    ctx.restore();
    // 冲刺尾迹
    if (s.dashLeft > 0) {
      for (let i = 1; i <= 3; i++) {
        drawBubble(ctx, s.x - s.facing * (s.shown * 1.4 + i * 11), s.y + Math.sin(arenaTime * 12 + i) * 5, 3 + i, 0.6);
      }
    }
  }

  /**
   * 竞技场里的一条鱼。危险鱼与毒藻鱼**不靠颜色区分**:
   * 危险鱼有锯齿背鳍加斜纹,毒藻鱼有危险绿气泡光环——色觉不同的孩子也认得出来。
   */
  function drawArenaFish(f: ArenaFish): void {
    const facing: 1 | -1 = f.vx >= 0 ? 1 : -1;
    const r = f.spec.r;
    if (f.spec.kind === "toxin") {
      drawToxinAura(ctx, f.x, f.y, r, f.phase, reducedMotion);
      drawFish(f.x, f.y, r, facing, "#c46ae8", "none", arenaTime + f.phase);
      return;
    }
    if (f.spec.kind === "elite") {
      drawFish(f.x, f.y, r, facing, "#ffd868", "none", arenaTime + f.phase);
      const glow = reducedMotion ? 0.65 : 0.5 + Math.sin(f.phase * 2) * 0.3;
      ctx.strokeStyle = `rgba(255,240,170,${glow})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      drawSparkle(ctx, f.x, f.y - r * 1.5, Math.max(6, r * 0.4), f.phase, reducedMotion);
      return;
    }
    const color = f.spec.danger ? "#8fa8d8" : f.spec.dexId === "lantern" ? "#ffe0a3" : "#a8e6c9";
    drawFish(f.x, f.y, r, facing, color, "none", arenaTime + f.phase);
    if (f.spec.danger) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(facing, 1);
      // 锯齿背鳍:一眼看出「这条惹不起」
      ctx.fillStyle = "#5f7ab0";
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.6);
      for (let i = 0; i < 3; i++) {
        ctx.lineTo(-r * 0.55 + i * r * 0.38 + r * 0.19, -r * (1.05 - i * 0.06));
        ctx.lineTo(-r * 0.55 + (i + 1) * r * 0.38, -r * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      // 斜纹
      ctx.strokeStyle = "rgba(45,70,120,0.55)";
      ctx.lineWidth = Math.max(2, r * 0.1);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.4 - r * 0.12, -r * 0.55);
        ctx.lineTo(i * r * 0.4 + r * 0.2, r * 0.55);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (f.spec.dexId === "lantern") {
      const glow = 0.5 + Math.sin(f.phase * 3) * 0.3;
      ctx.fillStyle = `rgba(255,220,120,${glow})`;
      ctx.beginPath();
      ctx.arc(f.x - facing * r * 1.6, f.y, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 竞技场背景:侧视 2.5D 水体——深度着色渐变 + 斜光柱(reduced 静止)+
   * 远景剪影层(视差跟玩家),跨层时背景色 1s 插值过渡。
   * 不做透视投影——真 3D 会挡住「谁比谁大」的阅读性,这一款读不出大小就没法玩。
   */
  function drawArenaBackground(): void {
    const spec = arenaZone();
    // 跨层背景色 1s 插值
    if (bgTierSeen !== arenaTier) {
      bgPrevTop = bgTierSeen < 0 ? spec.top : bgTop || spec.top;
      bgPrevBottom = bgTierSeen < 0 ? spec.bottom : bgBottom || spec.bottom;
      bgTierSeen = arenaTier;
      bgBlendAt = arenaTime;
    }
    const k = bgBlendAt < 0 ? 1 : Math.min(1, Math.max(0, arenaTime - bgBlendAt) / 1);
    bgTop = lerpColor(bgPrevTop, spec.top, k);
    bgBottom = lerpColor(bgPrevBottom, spec.bottom, k);
    drawUnderwaterBackdrop(ctx, w, h, bgTop, bgBottom);

    const layers = layerToggles(quality());
    // 远景层:剪影水草礁石 + 远景鱼影(视差 0.3 跟玩家),无光层不画
    if (layers.far && !spec.dark) {
      drawFarLayer(ctx, w, h, arenaTime, -(me.x - w / 2) * 0.06, reducedMotion);
    }
    // 光柱:白 8% → 透明,±3° 缓慢摆动,reduced 静止;无光层没有光
    if (!spec.dark) drawLightShafts(ctx, w, h, arenaTime, reducedMotion);
    // 近景水纹,越深越暗
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = ((arenaTime * 26 + i * 120) % (h + 120)) - 60;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(w * 0.5, y + 14, w, y);
      ctx.stroke();
    }
  }

  /** 竞技场 HUD:分两行贴顶,360 宽也不横向溢出、不压着鱼。 */
  function drawArenaHud(): void {
    const spec = arenaZone();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    if (arenaMode === "endless") {
      ctx.fillText(`⬇ ${Math.floor(depth)} 米 · 第 ${arenaTier} 层 ${spec.name}`, 12, 20);
    } else {
      const left = Math.max(0, Math.ceil(VERSUS_SECONDS - arenaTime));
      ctx.fillText(`⏱ ${left} 秒 · 对手 ${rivalProfile.emoji} ${rivalProfile.name}`, 12, 20);
    }
    ctx.textAlign = "right";
    ctx.fillText(`体型 ${Math.round(me.r)}${rival ? ` · 它 ${Math.round(rival.r)}` : ""}`, w - 12, 20);

    // 第二行:冲刺冷却条 + 图鉴 / 纪录
    const barW = Math.min(150, w * 0.36);
    const ready = dashReady(me.dashCd);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.roundRect(12, 34, barW, 14, 7);
    ctx.fill();
    ctx.fillStyle = ready ? "#7fe0c8" : "rgba(255,255,255,0.62)";
    ctx.beginPath();
    ctx.roundRect(12, 34, Math.max(8, barW * (ready ? 1 : 1 - me.dashCd / DASH_CD)), 14, 7);
    ctx.fill();
    ctx.fillStyle = "#2a4a5e";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ready ? "冲刺就绪" : "冲刺蓄力", 12 + barW / 2, 41);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "13px sans-serif";
    ctx.fillText(
      arenaMode === "endless"
        ? `📖 ${dexSeen.size}/${DEX.length} · 最好 ${endlessBest} 米`
        : `📖 ${dexSeen.size}/${DEX.length}`,
      w - 12,
      41,
    );

    // 饿了就提醒:剩 20 秒开始跳字,最后 8 秒催得更急,别等到游不动才知道
    if (arenaMode === "endless") {
      const warn = starveWarnLevel(sinceEat);
      if (warn !== "none") {
        const blink = warn === "hard" ? 7 : 4;
        ctx.textAlign = "center";
        ctx.fillStyle = Math.floor(arenaTime * blink) % 2 === 0 ? "#ffd868" : "#ffffff";
        ctx.font = `bold ${warn === "hard" ? 17 : 15}px sans-serif`;
        ctx.fillText(starveWarnLine(sinceEat), w / 2, 62);
      }
      // 正在被压小的时候要说出来:不然孩子只看到「我一直在吃,鱼却越来越小」
      const squeezed = pressureState(me.r, arenaTier, eliteLeft) === "squeezed";
      const pressure = pressureLine(me.r, arenaTier, eliteLeft);
      if (pressure) {
        ctx.textAlign = "center";
        ctx.font = "12px sans-serif";
        ctx.fillStyle = squeezed
          ? Math.floor(arenaTime * 4) % 2 === 0
            ? "#ffb0b0"
            : "#ffe6a8"
          : eliteLeft > 0
            ? "#ffe6a8"
            : "rgba(255,255,255,0.82)";
        ctx.fillText(pressure, w / 2, warn === "none" ? 62 : 82);
      }
    }
  }

  function drawArena(): void {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
    drawArenaBackground();

    for (const b of bubbles) drawBubble(ctx, b.x, b.y, b.r, 0.55);

    for (const f of arenaFish) drawArenaFish(f);

    drawSwirls();

    if (rival) {
      const blink = rival.inv > 0 && Math.floor(arenaTime * 8) % 2 === 0;
      if (!blink) drawSwimmer(rival, "#b8a9f5", "star");
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rivalProfile.emoji} ${rivalProfile.name}`, rival.x, rival.y - rival.shown - 16);
    }

    const blinkMe = me.inv > 0 && Math.floor(arenaTime * 8) % 2 === 0;
    if (!blinkMe) drawSwimmer(me, "#ff9eb5", "crown");

    // 深水罩:屏下 30% 叠极淡蓝,低成本纵深
    drawDepthTint(ctx, w, h);

    // 无光水层:只看得清身边一圈
    if (arenaZone().dark) {
      const sight = me.shown * DARK_SIGHT;
      const g = ctx.createRadialGradient(me.x, me.y, sight * 0.45, me.x, me.y, sight);
      g.addColorStop(0, "rgba(8,10,26,0)");
      g.addColorStop(1, "rgba(8,10,26,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    // 前景层:近景水草大剪影(35% 半透明,视差 1.3,只贴屏角),低画质不画
    if (layerToggles(quality()).fore && !arenaZone().dark) {
      drawForeLayer(ctx, w, h, arenaTime, -(me.x - w / 2) * 0.12, reducedMotion);
    }

    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.5 - Math.min(0.5, p.life)) * 90 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 20px sans-serif" : "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    drawArenaHud();
    if (phase === "arenaOver") drawArenaOverPanel();
  }

  function drawArenaOverPanel(): void {
    const copy =
      arenaMode === "endless"
        ? endlessFailCopy(failKind ?? "starved", depth)
        : versusCopy(versusResult, rivalProfile, me.r, rival ? rival.r : 0);
    const { y } = panelBox(Math.min(460, w - 32), 330);
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 23px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(copy.title, w / 2, y + 40);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(copy.lines[0], w / 2, y + 76);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6a6a7e";
    ctx.fillText(copy.lines[1], w / 2, y + 100, Math.min(430, w - 60));
    if (arenaMode === "endless") {
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = newRecord ? "#c47a2a" : "#8a8a9a";
      ctx.fillText(
        newRecord ? `🎉 破纪录!最深 ${endlessBest} 米` : `最好成绩 ${endlessBest} 米 · 吃了 ${arenaEaten} 条`,
        w / 2,
        y + 126,
      );
    }
    drawEatChain(arenaEatLog, y + 174);
    drawGrowthBar(y + 202, arenaStartR, Math.max(arenaStartR + 1, me.r), me.r);
    const bw2 = 132;
    btnHome = { x: w / 2 - bw2 - 10, y: y + 254, w: bw2, h: 46 };
    btnAgain = { x: w / 2 + 10, y: y + 254, w: bw2, h: 46 };
    drawButton(btnHome, "回首页", "#f0f0f5", "#5a5a6e");
    drawButton(btnAgain, "再来一趟", "#ffd868", "#7a5a1a");
  }

  /** 首屏:战役 / 无尽 / 对战三选一,和图鉴入口并列。 */
  function drawHome(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#cdefff");
    grad.addColorStop(0.5, "#8fc4e8");
    grad.addColorStop(1, "#3f6aa8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#1f4a72";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐟 海底大胃王", w / 2, 28);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#2a5a86";
    ctx.fillText(`吃比自己小的鱼,越吃越大 · 最深 ${endlessBest} 米`, w / 2, 52);

    // 副标题就在 y=52 那一行,按钮画高会压字 —— 画的照旧,能点的范围兜到 44px 高
    const dexFace: Rect = { x: w - 120, y: 8, w: 112, h: 34 };
    btnDex = touchArea(dexFace);
    drawButton(dexFace, `📖 图鉴 ${dexSeen.size}/${DEX.length}`, "#fff1c9", "#7a5a1a");

    const cards: Array<{ id: "campaign" | "endless" | "versus"; emoji: string; title: string; blurb: string; bg: string; fg: string }> = [
      {
        id: "campaign",
        emoji: "🌊",
        title: `海域战役 · ${LEVELS.length} 关`,
        blurb: `十二片海域 · ⭐ ${totalStars(progress)}/${LEVELS.length * 3}`,
        bg: "#ffffff",
        fg: "#2a6a9a",
      },
      {
        id: "endless",
        emoji: "🏊",
        title: "深海马拉松 · 无尽",
        blurb: `一直往下潜,看能潜多深 · 最好 ${endlessBest} 米`,
        bg: "#fff6e0",
        fg: "#a05914",
      },
      {
        id: "versus",
        emoji: "⚖️",
        title: "限时谁更胖 · 对战",
        blurb: `${VERSUS_SECONDS} 秒同池抢食,人机三档`,
        bg: "#ffe9f5",
        fg: "#a03a72",
      },
    ];
    homeCards.length = 0;
    const pad = 12;
    const x0 = Math.max(12, w * 0.06);
    const cw = w - x0 * 2;
    const y0 = 76;
    const ch = Math.min(96, (h - y0 - 20 - pad * 2) / 3);
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const rect: Rect = { x: x0, y: y0 + i * (ch + pad), w: cw, h: ch };
      homeCards.push({ id: c.id, rect });
      ctx.fillStyle = c.bg;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 16);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = `${Math.round(ch * 0.4)}px sans-serif`;
      ctx.fillText(c.emoji, rect.x + 14, rect.y + ch * 0.5);
      ctx.fillStyle = c.fg;
      ctx.font = `bold ${Math.min(19, Math.round(ch * 0.24))}px sans-serif`;
      ctx.fillText(c.title, rect.x + 16 + ch * 0.5, rect.y + ch * 0.38);
      ctx.font = `${Math.max(13, Math.min(14, Math.round(ch * 0.17)))}px sans-serif`;
      ctx.fillStyle = "#4a5a6e";
      ctx.fillText(c.blurb, rect.x + 16 + ch * 0.5, rect.y + ch * 0.66, cw - ch * 0.5 - 30);
    }
  }

  /** 对战选难度:三档人机,热区都做到 44px 以上。 */
  function drawRivalPick(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#ffe9f5");
    grad.addColorStop(1, "#b8a9f5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const backFace: Rect = { x: 8, y: 8, w: 76, h: 36 };
    btnBack = touchArea(backFace);
    drawButton(backFace, "◀ 返回", "rgba(255,255,255,0.9)", "#5a5a6e");
    ctx.fillStyle = "#a03a72";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚖️ 限时谁更胖", w / 2, 30);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6a4a6e";
    ctx.fillText(`${VERSUS_SECONDS} 秒同池抢食,时间到谁更胖谁赢`, w / 2, 56);

    rivalCards.length = 0;
    const pad = 12;
    const x0 = Math.max(12, w * 0.06);
    const cw = w - x0 * 2;
    const y0 = 80;
    const ch = Math.min(92, (h - y0 - 20 - pad * 2) / 3);
    for (let i = 0; i < RIVAL_LEVELS.length; i++) {
      const p = RIVAL_PROFILES[RIVAL_LEVELS[i]];
      const rect: Rect = { x: x0, y: y0 + i * (ch + pad), w: cw, h: Math.max(44, ch) };
      rivalCards.push({ id: p.id, rect });
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#c96aa0";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 16);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = `${Math.round(rect.h * 0.4)}px sans-serif`;
      ctx.fillText(p.emoji, rect.x + 14, rect.y + rect.h * 0.5);
      ctx.fillStyle = "#a03a72";
      ctx.font = `bold ${Math.min(19, Math.round(rect.h * 0.25))}px sans-serif`;
      ctx.fillText(`第 ${i + 1} 档 · ${p.name}`, rect.x + 16 + rect.h * 0.5, rect.y + rect.h * 0.38);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#5a5a6e";
      ctx.fillText(p.blurb, rect.x + 16 + rect.h * 0.5, rect.y + rect.h * 0.68, cw - rect.h * 0.5 - 30);
    }
  }

  function drawBoss(b: Boss): void {
    const spec = BOSS_INFO[b.kind];
    // 进场演出:从阴影里游出来(剪影 → 实体 0.8s)
    const intro = bossEntrance(time - bossIntroAt, reducedMotion);
    ctx.save();
    ctx.translate(b.x, b.y);
    const facing = player.x < b.x ? -1 : 1;
    ctx.scale(facing, 1);
    ctx.globalAlpha = intro.alpha;
    if (b.hurt > 0.6) ctx.globalAlpha = 0.6;
    if (b.kind === "crab") {
      ctx.fillStyle = "#f5a89a";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      // 大钳子
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * b.r * 0.95, -b.r * 0.35, b.r * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fef1ee";
        ctx.beginPath();
        ctx.arc(s * b.r * 0.95, -b.r * 0.35, b.r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f5a89a";
      }
      // 腿
      ctx.strokeStyle = "#e08878";
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * b.r * 0.7, b.r * (0.1 + i * 0.2));
          ctx.lineTo(s * b.r * (1.1 + i * 0.06), b.r * (0.35 + i * 0.22));
          ctx.stroke();
        }
      }
    } else if (b.kind === "octopus") {
      ctx.fillStyle = "#c9a0e8";
      ctx.beginPath();
      ctx.arc(0, -b.r * 0.15, b.r * 0.8, Math.PI, 0);
      ctx.quadraticCurveTo(b.r * 0.8, b.r * 0.4, b.r * 0.6, b.r * 0.5);
      ctx.quadraticCurveTo(0, b.r * 0.7, -b.r * 0.6, b.r * 0.5);
      ctx.quadraticCurveTo(-b.r * 0.8, b.r * 0.4, -b.r * 0.8, -b.r * 0.15);
      ctx.fill();
      ctx.strokeStyle = "#c9a0e8";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const bx = (i - 2) * b.r * 0.32;
        ctx.beginPath();
        ctx.moveTo(bx, b.r * 0.45);
        ctx.quadraticCurveTo(bx + Math.sin(time * 3 + i) * 9, b.r * 0.85, bx + Math.sin(time * 3 + i + 1) * 12, b.r * 1.15);
        ctx.stroke();
      }
    } else if (b.kind === "angler") {
      ctx.fillStyle = "#8898c8";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      // 小灯笼
      ctx.strokeStyle = "#8898c8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.r * 0.3, -b.r * 0.6);
      ctx.quadraticCurveTo(b.r * 0.7, -b.r * 1.15, b.r * 0.95, -b.r * 0.9);
      ctx.stroke();
      const glow = 0.6 + Math.sin(time * 6) * 0.35;
      ctx.fillStyle = `rgba(255,240,150,${glow})`;
      ctx.beginPath();
      ctx.arc(b.r * 0.95, -b.r * 0.9, b.r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // 大牙齿
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(b.r * (0.25 + i * 0.16), b.r * 0.28);
        ctx.lineTo(b.r * (0.31 + i * 0.16), b.r * 0.5);
        ctx.lineTo(b.r * (0.37 + i * 0.16), b.r * 0.28);
        ctx.closePath();
        ctx.fill();
      }
    } else if (b.kind === "turtle") {
      // 龟壳
      ctx.fillStyle = "#6aa87a";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4a8858";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 0.62, b.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * b.r * 0.62, Math.sin(a) * b.r * 0.45);
        ctx.lineTo(Math.cos(a) * b.r * 0.95, Math.sin(a) * b.r * 0.68);
        ctx.stroke();
      }
      // 脑袋和鳍
      ctx.fillStyle = "#8ac89a";
      ctx.beginPath();
      ctx.arc(b.r * 0.95, -b.r * 0.15, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(-b.r * 0.5, s * b.r * 0.62, b.r * 0.3, b.r * 0.14, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.kind === "sword") {
      // 长条身体 + 剑鼻
      ctx.fillStyle = "#7ab8d8";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.r * 0.8, -b.r * 0.1);
      ctx.lineTo(b.r * 1.75, 0);
      ctx.lineTo(b.r * 0.8, b.r * 0.1);
      ctx.closePath();
      ctx.fillStyle = "#e8e0c8";
      ctx.fill();
      // 背帆
      ctx.fillStyle = "#5a98b8";
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.6, -b.r * 0.3);
      ctx.quadraticCurveTo(0, -b.r * 1.05, b.r * 0.5, -b.r * 0.32);
      ctx.closePath();
      ctx.fill();
      // 尾巴
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.85, 0);
      ctx.lineTo(-b.r * 1.35, -b.r * 0.45);
      ctx.lineTo(-b.r * 1.35, b.r * 0.45);
      ctx.closePath();
      ctx.fill();
    } else if (b.kind === "lobster") {
      // 长身
      ctx.fillStyle = "#e87a5a";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // 尾节
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-b.r * (0.7 + i * 0.28), 0, b.r * (0.34 - i * 0.07), b.r * (0.4 - i * 0.08), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 双钳
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(b.r * 0.9, s * b.r * 0.5, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffe0c2";
        ctx.beginPath();
        ctx.arc(b.r * 0.98, s * b.r * 0.5, b.r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e87a5a";
      }
      // 火光触须
      ctx.strokeStyle = `rgba(255,180,80,${0.6 + Math.sin(time * 5) * 0.3})`;
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.r * 0.6, s * b.r * 0.2 - b.r * 0.3);
        ctx.quadraticCurveTo(b.r * 1.3, s * b.r * 0.5 - b.r * 0.7, b.r * 1.6, s * b.r * 0.3 - b.r * 0.9);
        ctx.stroke();
      }
    } else if (b.kind === "shark") {
      ctx.fillStyle = "#98a8b8";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // 背鳍
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.25, -b.r * 0.45);
      ctx.lineTo(b.r * 0.05, -b.r * 1.05);
      ctx.lineTo(b.r * 0.3, -b.r * 0.42);
      ctx.closePath();
      ctx.fill();
      // 尾巴
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.85, 0);
      ctx.lineTo(-b.r * 1.4, -b.r * 0.55);
      ctx.lineTo(-b.r * 1.15, 0);
      ctx.lineTo(-b.r * 1.4, b.r * 0.4);
      ctx.closePath();
      ctx.fill();
      // 白肚皮 + 尖牙
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.ellipse(b.r * 0.1, b.r * 0.25, b.r * 0.75, b.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(b.r * (0.2 + i * 0.13), b.r * 0.3);
        ctx.lineTo(b.r * (0.25 + i * 0.13), b.r * 0.5);
        ctx.lineTo(b.r * (0.3 + i * 0.13), b.r * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    } else if (b.kind === "dragon") {
      // 蛇形长身
      ctx.strokeStyle = "#8a5ac9";
      ctx.lineWidth = b.r * 0.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const x = -b.r * 1.5 + t * b.r * 1.9;
        const y = Math.sin(t * Math.PI * 2 + time * 3) * b.r * 0.3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // 龙头
      ctx.fillStyle = "#a97ae0";
      ctx.beginPath();
      ctx.ellipse(b.r * 0.55, 0, b.r * 0.52, b.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // 龙角
      ctx.strokeStyle = "#ffd868";
      ctx.lineWidth = 5;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.r * (0.45 + s * 0.12), -b.r * 0.35);
        ctx.quadraticCurveTo(b.r * (0.45 + s * 0.3), -b.r * 0.85, b.r * (0.6 + s * 0.35), -b.r * 0.95);
        ctx.stroke();
      }
      // 龙须
      ctx.strokeStyle = "#e0c8ff";
      ctx.lineWidth = 2.5;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.r * 1.0, s * b.r * 0.12);
        ctx.quadraticCurveTo(b.r * 1.5, s * b.r * 0.3 + Math.sin(time * 4) * 5, b.r * 1.75, s * b.r * 0.15);
        ctx.stroke();
      }
      // 鹿角般的背鳍
      ctx.fillStyle = "#ffd868";
      for (let i = 0; i < 4; i++) {
        const x = -b.r * 1.2 + i * b.r * 0.5;
        const y = Math.sin(((x + b.r * 1.5) / (b.r * 1.9)) * Math.PI * 2 + time * 3) * b.r * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - 6, y - b.r * 0.2);
        ctx.lineTo(x, y - b.r * 0.55);
        ctx.lineTo(x + 6, y - b.r * 0.2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (b.kind === "ray") {
      // 旋旋鳐:一对大翅膀 + 细长尾巴,翅膀会随时间上下扇
      const flap = Math.sin(time * 3) * b.r * 0.22;
      ctx.fillStyle = "#5fa8c8";
      ctx.beginPath();
      ctx.moveTo(0, -b.r * 0.35);
      ctx.quadraticCurveTo(b.r * 0.9, -b.r * 0.9 - flap, b.r * 1.45, -b.r * 0.05 - flap * 0.4);
      ctx.quadraticCurveTo(b.r * 0.9, b.r * 0.4, 0, b.r * 0.5);
      ctx.quadraticCurveTo(-b.r * 0.9, b.r * 0.4, -b.r * 1.45, -b.r * 0.05 + flap * 0.4);
      ctx.quadraticCurveTo(-b.r * 0.9, -b.r * 0.9 + flap, 0, -b.r * 0.35);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.ellipse(0, b.r * 0.1, b.r * 0.55, b.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#5fa8c8";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, b.r * 0.45);
      ctx.quadraticCurveTo(-b.r * 0.2, b.r * 1.1, b.r * 0.15 + Math.sin(time * 4) * 8, b.r * 1.6);
      ctx.stroke();
    } else if (b.kind === "anemone") {
      // 荧荧海葵王:一丛会发光的触手,顶着圆圆的花心
      const glow = 0.5 + Math.sin(time * 4) * 0.28;
      ctx.strokeStyle = `rgba(150,240,190,${glow})`;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (Math.PI * i) / 8;
        const wob = Math.sin(time * 3 + i) * b.r * 0.16;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * b.r * 0.35, Math.sin(a) * b.r * 0.35 + b.r * 0.3);
        ctx.quadraticCurveTo(
          Math.cos(a) * b.r * 0.9 + wob,
          Math.sin(a) * b.r * 0.9 + b.r * 0.1,
          Math.cos(a) * b.r * 1.25 + wob * 1.6,
          Math.sin(a) * b.r * 1.2,
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#4ec99a";
      ctx.beginPath();
      ctx.arc(0, b.r * 0.15, b.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(220,255,235,${glow})`;
      ctx.beginPath();
      ctx.arc(0, b.r * 0.15, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === "clam") {
      // 咔咔巨蚌:一开一合的两片贝壳,中间藏着一颗大珍珠
      const open = 0.18 + Math.max(0, Math.sin(time * 1.6)) * 0.3;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * open);
        ctx.fillStyle = s < 0 ? "#c8b6e8" : "#a894d8";
        ctx.beginPath();
        ctx.ellipse(0, s * b.r * 0.34, b.r, b.r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 3;
        for (let i = 1; i <= 4; i++) {
          ctx.beginPath();
          ctx.ellipse(0, s * b.r * 0.34, b.r * (i / 5), b.r * 0.5 * (i / 5), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
      const pearl = 0.6 + Math.sin(time * 5) * 0.3;
      ctx.fillStyle = `rgba(255,250,255,${pearl})`;
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // whale
      ctx.fillStyle = "#8fc8e8";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r, b.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.85, 0);
      ctx.quadraticCurveTo(-b.r * 1.4, -b.r * 0.1, -b.r * 1.5, -b.r * 0.6);
      ctx.quadraticCurveTo(-b.r * 1.25, -b.r * 0.1, -b.r * 1.1, 0);
      ctx.quadraticCurveTo(-b.r * 1.25, b.r * 0.1, -b.r * 1.5, b.r * 0.6);
      ctx.quadraticCurveTo(-b.r * 1.4, b.r * 0.1, -b.r * 0.85, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(0, b.r * 0.3, b.r * 0.75, b.r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#bfe9ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -b.r * 0.7);
      ctx.quadraticCurveTo(-b.r * 0.15, -b.r * 1.1, -b.r * 0.3, -b.r * 1.2);
      ctx.moveTo(0, -b.r * 0.7);
      ctx.quadraticCurveTo(b.r * 0.15, -b.r * 1.1, b.r * 0.3, -b.r * 1.2);
      ctx.stroke();
    }
    // 体侧条纹 + 尾侧小伤疤:BOSS 独有的身份特征(卡通、不狰狞)
    ctx.globalAlpha = intro.alpha * 0.22;
    ctx.strokeStyle = "#20243c";
    ctx.lineWidth = Math.max(2, b.r * 0.09);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-b.r * (0.15 + i * 0.3), -b.r * 0.42);
      ctx.quadraticCurveTo(-b.r * (0.28 + i * 0.3), 0, -b.r * (0.15 + i * 0.3), b.r * 0.4);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.5, b.r * 0.05);
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.62, -b.r * 0.18);
    ctx.lineTo(-b.r * 0.44, b.r * 0.02);
    ctx.moveTo(-b.r * 0.44, -b.r * 0.18);
    ctx.lineTo(-b.r * 0.62, b.r * 0.02);
    ctx.stroke();
    ctx.globalAlpha = intro.alpha;
    // 通用眼睛嘴巴:狂暴 BOSS 血少一半后瞪红眼(照旧圆润,只换色)
    const enraged = spec.enrages && b.hp <= b.maxHp / 2;
    ctx.fillStyle = enraged ? "#e04a4a" : "#3a3a4a";
    ctx.beginPath();
    ctx.arc(b.r * 0.4, -b.r * 0.15, b.r * (enraged ? 0.09 : 0.07), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(2, b.r * 0.05);
    ctx.beginPath();
    ctx.arc(b.r * 0.4, b.r * 0.12, b.r * 0.16, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
    // 从阴影里游出来:剪影随进场进度散去
    if (intro.silhouette > 0.02) {
      ctx.globalAlpha = intro.silhouette * 0.82;
      ctx.fillStyle = "#101830";
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 1.45, b.r * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 加速冲刺时的尾流气泡(纯装饰,reduced 少两颗)
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 90) {
      const nx = -b.vx / (speed || 1);
      const ny = -b.vy / (speed || 1);
      for (let i = 1; i <= (reducedMotion ? 1 : 3); i++) {
        drawBubble(
          ctx,
          b.x + nx * (b.r + i * 14),
          b.y + ny * (b.r + i * 14) + Math.sin(time * 10 + i) * 4,
          2.5 + i,
          0.5,
        );
      }
    }
    // 血量爱心
    for (let i = 0; i < b.maxHp; i++) {
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i < b.hp ? "💗" : "🤍", b.x - (b.maxHp - 1) * 11 + i * 22, b.y - b.r - 22);
    }
    // 名字
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(spec.name, b.x, b.y - b.r - 42);
  }

  /**
   * BOSS 战败演出:翻白肚缓缓下沉 + 星星迸出(卡通,分级红线:无任何受伤描写)。
   * 到点自动清理演出状态。
   */
  function drawBossDefeatFx(): void {
    const fx = bossDefeatFx;
    if (!fx) return;
    const t = time - fx.at;
    const pose = bossDefeat(t);
    if (pose.done) {
      bossDefeatFx = null;
      return;
    }
    ctx.save();
    ctx.translate(fx.x, fx.y + pose.sink01 * (h - fx.y + fx.r));
    ctx.rotate(reducedMotion ? 0 : pose.rot);
    ctx.globalAlpha = pose.alpha;
    // 翻过来的白肚皮
    ctx.fillStyle = "#e8ecf2";
    ctx.beginPath();
    ctx.ellipse(0, 0, fx.r, fx.r * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8d2de";
    ctx.beginPath();
    ctx.ellipse(0, -fx.r * 0.3, fx.r * 0.8, fx.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 晕圈眼(X 不用,圆点半闭更温和)
    ctx.strokeStyle = "#7a8496";
    ctx.lineWidth = Math.max(2, fx.r * 0.06);
    ctx.beginPath();
    ctx.arc(fx.r * 0.35, 0, fx.r * 0.1, 0, Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // 金星迸出:绕落点转一圈的小星星
    const n = reducedMotion ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + t * (reducedMotion ? 0 : 1.4);
      const rad = fx.r * (0.8 + t * 1.1);
      drawSparkle(ctx, fx.x + Math.cos(a) * rad, fx.y + Math.sin(a) * rad * 0.7, 7, t * 2 + i, reducedMotion);
    }
  }

  function drawHazards(): void {
    // 水流带
    for (const c of currents) {
      const y0 = c.fy * h;
      const bandH = c.fh * h;
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(0, y0, w, bandH);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2.5;
      const flow = (time * c.speed * c.dir) % 90;
      for (let x = -90 + flow; x < w + 90; x += 90) {
        const ay = y0 + bandH / 2;
        ctx.beginPath();
        ctx.moveTo(x, ay);
        ctx.lineTo(x + 26 * c.dir, ay);
        ctx.lineTo(x + 18 * c.dir, ay - 6);
        ctx.moveTo(x + 26 * c.dir, ay);
        ctx.lineTo(x + 18 * c.dir, ay + 6);
        ctx.stroke();
      }
    }
    // 涡流
    for (const v of vortexes) {
      const vx = v.fx * w;
      const vy = v.fy * h;
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(time * 2);
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = `rgba(120,170,230,${0.55 - ring * 0.14})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + ring * 22, ring, ring + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(120,170,230,0.2)";
      ctx.setLineDash([4, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(vx, vy, VORTEX_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 电电草
    for (const e of eels) {
      const ex = e.fx * w;
      const active = eelActive(time, e.offset);
      ctx.strokeStyle = active ? "#ffe14a" : "#6aa87a";
      ctx.lineWidth = active ? 8 : 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let y = h; y > -10; y -= 18) {
        const sway = Math.sin(y * 0.05 + time * 2 + e.offset) * 9;
        if (y === h) ctx.moveTo(ex + sway, y);
        else ctx.lineTo(ex + sway, y);
      }
      ctx.stroke();
      if (active) {
        ctx.fillStyle = "#ffe14a";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", ex, 40 + Math.sin(time * 8) * 6);
      }
    }
    // 气泡墙
    if (wall) {
      for (let y = 8; y < h; y += 26) {
        if (inBubbleGap(y, wall.gapY)) continue;
        const wob = (reducedMotion ? 0 : Math.sin(time * 4 + y)) * 4;
        ctx.fillStyle = "rgba(200,235,255,0.75)";
        ctx.beginPath();
        ctx.arc(wall.x + wob, y, 13, 0, Math.PI * 2);
        ctx.fill();
        drawBubble(ctx, wall.x + wob, y, 13, 0.9);
      }
      ctx.fillStyle = "#5a8ac9";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("从这钻!", wall.x, wall.gapY);
    }
  }

  function drawZoneDecor(): void {
    const def = level();
    if (def.zone === "shallow") {
      ctx.fillStyle = "#ffeeba";
      ctx.beginPath();
      ctx.ellipse(w / 2, h + 24, w * 0.75, 56, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (def.zone === "coral") {
      // 标志物:一把大珊瑚扇的剪影,骨架从扇柄呈放射铺开
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#e06a90";
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.85 + (Math.PI * 0.7 * i) / 6;
        ctx.lineWidth = 6 - Math.abs(i - 3);
        ctx.beginPath();
        ctx.moveTo(w * 0.82, h + 4);
        ctx.quadraticCurveTo(
          w * 0.82 + Math.cos(a) * 60,
          h - 40 + Math.sin(a) * 40,
          w * 0.82 + Math.cos(a) * 104,
          h - 30 + Math.sin(a) * 88,
        );
        ctx.stroke();
      }
      ctx.restore();
      for (let i = 0; i < 5; i++) {
        const x = (w / 5) * i + w / 10;
        ctx.fillStyle = i % 2 === 0 ? "#ff9eb5" : "#c9b6f2";
        ctx.globalAlpha = 0.5;
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.ellipse(x + j * 14, h - 20 - Math.abs(j) * 8, 9, 26 + (j === 0 ? 10 : 0), j * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    } else if (def.zone === "deep") {
      for (let i = 0; i < 3; i++) {
        const x = w * (0.25 + i * 0.25) + Math.sin(time * 0.5 + i) * 20;
        const g = ctx.createLinearGradient(x, 0, x + 60, h);
        g.addColorStop(0, "rgba(255,255,255,0.18)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 20, 0);
        ctx.lineTo(x + 40, 0);
        ctx.lineTo(x + 90, h);
        ctx.lineTo(x - 60, h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (def.zone === "kelp") {
      // 海带森林:摇曳的宽叶海带
      for (let i = 0; i < 6; i++) {
        const x = (w / 6) * i + w / 12;
        ctx.strokeStyle = i % 2 === 0 ? "rgba(74,138,90,0.5)" : "rgba(106,168,122,0.45)";
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let y = h; y > h * 0.2; y -= 24) {
          const sway = Math.sin(y * 0.025 + time * 1.2 + i * 1.4) * 22;
          if (y === h) ctx.moveTo(x + sway, y);
          else ctx.lineTo(x + sway, y);
        }
        ctx.stroke();
      }
    } else if (def.zone === "wreck") {
      // 沉船湾:半埋的船身和桅杆
      ctx.fillStyle = "rgba(90,64,40,0.55)";
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h);
      ctx.quadraticCurveTo(w * 0.3, h - 90, w * 0.55, h - 70);
      ctx.quadraticCurveTo(w * 0.7, h - 55, w * 0.78, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(90,64,40,0.6)";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(w * 0.42, h - 74);
      ctx.lineTo(w * 0.46, h - 190);
      ctx.stroke();
      ctx.fillStyle = "rgba(200,180,140,0.4)";
      ctx.beginPath();
      ctx.moveTo(w * 0.46, h - 188);
      ctx.lineTo(w * 0.6, h - 150);
      ctx.lineTo(w * 0.465, h - 130);
      ctx.closePath();
      ctx.fill();
      // 标志物:露出泥沙的船骨剪影(一根根肋骨弧)
      ctx.strokeStyle = "rgba(60,42,26,0.5)";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const x = w * (0.24 + i * 0.11);
        ctx.beginPath();
        ctx.arc(x, h + 26, 74 + i * 5, Math.PI * 1.18, Math.PI * 1.62);
        ctx.stroke();
      }
    } else if (def.zone === "volcano") {
      // 火山温泉:底部红光和上升的热泡
      const g = ctx.createLinearGradient(0, h, 0, h - 130);
      g.addColorStop(0, "rgba(255,110,60,0.5)");
      g.addColorStop(1, "rgba(255,110,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, h - 130, w, 130);
      for (let i = 0; i < 7; i++) {
        const t = (time * 0.4 + i * 0.37) % 1;
        const x = w * ((i * 0.148 + 0.06) % 1) + Math.sin(time * 2 + i) * 8;
        ctx.fillStyle = `rgba(255,190,120,${0.5 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(x, h - t * h, 5 + i % 3 * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (def.zone === "abyss") {
      // 午夜深渊:远处的微光浮游生物
      for (let i = 0; i < 12; i++) {
        const x = w * ((i * 0.083 + 0.04) % 1);
        const y = h * ((i * 0.19 + 0.1 + Math.sin(time * 0.5 + i) * 0.02) % 1);
        ctx.fillStyle = `rgba(154,138,232,${0.25 + Math.sin(time * 2 + i * 1.7) * 0.15})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // 标志物:两条远景灯笼鱼剪影,只亮那盏小灯(纯装饰)
      for (let i = 0; i < 2; i++) {
        const dir = i === 0 ? 1 : -1;
        const x = w * (0.25 + i * 0.5) + Math.sin(time * 0.4 + i * 2) * 26 * (reducedMotion ? 0 : 1);
        const y = h * (0.3 + i * 0.34);
        ctx.fillStyle = "rgba(24,26,52,0.85)";
        ctx.beginPath();
        ctx.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - dir * 14, y);
        ctx.lineTo(x - dir * 24, y - 6);
        ctx.lineTo(x - dir * 24, y + 6);
        ctx.closePath();
        ctx.fill();
        const glow = reducedMotion ? 0.55 : 0.4 + Math.sin(time * 2.2 + i * 2) * 0.25;
        ctx.fillStyle = `rgba(255,226,140,${glow})`;
        ctx.beginPath();
        ctx.arc(x + dir * 20, y - 8, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (def.zone === "pearl") {
      // 珍珠龙宫:发光珍珠和宫殿拱门
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 10;
      for (let i = 0; i < 3; i++) {
        const x = w * (0.2 + i * 0.3);
        ctx.beginPath();
        ctx.arc(x, h, 70, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const x = w * (0.1 + i * 0.2);
        const glow = 0.45 + Math.sin(time * 2 + i * 1.3) * 0.25;
        ctx.fillStyle = `rgba(255,240,250,${glow})`;
        ctx.beginPath();
        ctx.arc(x, h - 18, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (def.zone === "strait") {
      // 洋流海峡:一条条随洋流方向流动的长水纹
      const d = driftNow();
      const dir = d.fx >= 0 ? 1 : -1;
      const speed = Math.abs(d.fx);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const ly = h * (0.08 + i * 0.13);
        const phaseX = ((time * (40 + speed) + i * 150) % (w + 260)) - 130;
        const lx = dir > 0 ? phaseX : w - phaseX;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.quadraticCurveTo(lx + 30 * dir, ly - 7, lx + 66 * dir, ly);
        ctx.stroke();
      }
    } else if (def.zone === "bloom") {
      // 荧光藻湾:海底一丛丛会呼吸的荧光藻
      for (let i = 0; i < 7; i++) {
        const x = (w / 7) * i + w / 14;
        const glow = 0.25 + Math.sin(time * 2 + i * 1.1) * 0.18;
        ctx.strokeStyle = `rgba(140,255,190,${glow + 0.2})`;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let y = h; y > h * 0.55; y -= 20) {
          const sway = Math.sin(y * 0.03 + time * 1.4 + i) * 16;
          if (y === h) ctx.moveTo(x + sway, y);
          else ctx.lineTo(x + sway, y);
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(220,255,235,${glow + 0.3})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(time * 1.4 + i) * 14, h * 0.55, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (def.zone === "trench") {
      // 万丈压渊:两侧不断收拢的岩壁,越往下越挤
      ctx.fillStyle = "rgba(20,24,44,0.55)";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s < 0 ? 0 : w, 0);
        ctx.lineTo(s < 0 ? 0 : w, h);
        ctx.lineTo(s < 0 ? w * 0.2 : w * 0.8, h);
        ctx.quadraticCurveTo(s < 0 ? w * 0.06 : w * 0.94, h * 0.5, s < 0 ? w * 0.12 : w * 0.88, 0);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const y = h * ((i * 0.21 + time * 0.06) % 1);
        ctx.strokeStyle = `rgba(180,200,255,${0.1 + (i % 2) * 0.05})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.16, y);
        ctx.lineTo(w * 0.84, y);
        ctx.stroke();
      }
    } else {
      // 冰海:漂浮小冰山 + 浮冰底光(冰底透进来的一圈青光)
      for (let i = 0; i < 4; i++) {
        const x = ((i * 173) % 100) / 100 * w;
        const bob = (reducedMotion ? 0 : Math.sin(time * 0.8 + i * 2)) * 5;
        const g = ctx.createRadialGradient(x, 14 + bob, 4, x, 14 + bob, 60);
        g.addColorStop(0, "rgba(170,230,255,0.4)");
        g.addColorStop(1, "rgba(170,230,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, 14 + bob, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.moveTo(x - 34, 12 + bob);
        ctx.lineTo(x, -14 + bob);
        ctx.lineTo(x + 30, 10 + bob);
        ctx.closePath();
        ctx.fill();
      }
    }
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
    grad.addColorStop(0, "#c9edff");
    grad.addColorStop(0.45, "#9fc8ec");
    grad.addColorStop(1, "#5f7ab8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#2a6a9a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐟 海底大胃王 · 九大海域", w / 2, 26);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#3a5a7e";
    ctx.fillText(
      `共 ${LEVELS.length} 关 · ⭐ ${totalStars(progress)}/${LEVELS.length * 3} · 先选海域,再选关卡`,
      w / 2,
      52,
    );

    const dexFace: Rect = { x: w - 118, y: 8, w: 110, h: 30 };
    btnDex = touchArea(dexFace);
    drawButton(dexFace, `📖 图鉴 ${dexSeen.size}/${DEX.length}`, "#fff1c9", "#7a5a1a");
    const backFace: Rect = { x: 8, y: 8, w: 74, h: 30 };
    btnBack = touchArea(backFace);
    drawButton(backFace, "◀ 首页", "rgba(255,255,255,0.88)", "#5a5a6e");

    themeCards.length = 0;
    const cols = w > h * 1.15 ? 3 : 2;
    const rows = Math.ceil(ZONE_ORDER.length / cols);
    const pad = 10;
    const x0 = Math.max(10, w * 0.06);
    const y0 = 70;
    const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
    const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
    for (let i = 0; i < ZONE_ORDER.length; i++) {
      const st = ZONE_STYLE[ZONE_ORDER[i]];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x0 + col * (cw + pad), y: y0 + row * (ch + pad), w: cw, h: ch };
      themeCards.push({ idx: i, rect });
      const unlocked = themeUnlocked(i);
      const cleared = themeCleared(progress, i);
      ctx.fillStyle = unlocked ? st.top : "#e8e8ee";
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
      ctx.font = `bold ${Math.min(17, Math.round(ch * 0.22))}px sans-serif`;
      ctx.fillText(`第${i + 1}章 ${st.name}`, rect.x + 10 + ch * 0.42, rect.y + ch * 0.3);
      ctx.font = `${Math.min(12, Math.round(ch * 0.16))}px sans-serif`;
      ctx.fillStyle = unlocked ? "#3a4a5e" : "#a8a8b4";
      ctx.fillText(unlocked ? st.blurb : "通关上一片海域解锁", rect.x + 10, rect.y + ch * 0.6);
      ctx.fillText(
        unlocked
          ? `${cleared}/${themeSize(i)} 关 · ⭐${themeStars(progress, i)}/${themeSize(i) * 3} · BOSS ${BOSS_INFO[st.boss].name}`
          : "",
        rect.x + 10,
        rect.y + ch * 0.82,
      );
    }
  }

  function drawMap(): void {
    const st = ZONE_STYLE[ZONE_ORDER[chapterIdx]];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.top);
    grad.addColorStop(1, st.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const backFace: Rect = { x: 6, y: 7, w: 62, h: 30 };
    btnBack = touchArea(backFace);
    drawButton(backFace, "◀ 海域", "rgba(255,255,255,0.85)", "#5a5a6e");

    ctx.fillStyle = st.accent;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, w / 2, 28);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `⭐ ${themeStars(progress, chapterIdx)}/${themeSize(chapterIdx) * 3} · 通关解锁下一关,回放可刷 3 星`,
      w / 2,
      54,
    );

    mapNodes.length = 0;
    const base = themeStart(chapterIdx);
    const count = themeSize(chapterIdx);
    const cols = 4;
    const rows = Math.ceil(count / cols);
    const mx0 = w * 0.12;
    const mx1 = w * 0.88;
    const my0 = 96;
    // 最后一行的星星也要留得下:375×667 上原来会被切掉一截
    const my1 = h - 62;
    const nr = Math.max(16, Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6));
    for (let i = 0; i < count; i++) {
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
      const isBoss = !!def.boss;
      const r = isBoss ? n.r * 1.22 : n.r;
      ctx.fillStyle = unlocked ? (got > 0 ? "#ffffff" : "#fffef5") : "rgba(230,230,236,0.92)";
      ctx.strokeStyle = unlocked ? (isBoss ? "#e05a7a" : st.accent) : "#b8b8c2";
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
        ctx.fillStyle = isBoss ? "#e05a7a" : st.accent;
        ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
        ctx.fillText(String(n.idx - base + 1), n.x, n.y);
        if (isBoss) {
          ctx.font = `${Math.round(r * 0.62)}px sans-serif`;
          ctx.fillText("👑", n.x, n.y - r * 0.95);
        } else if (def.gen) {
          ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
          ctx.fillText("⚔", n.x, n.y - r * 0.95);
        }
        ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
        let starTxt = "";
        for (let s = 0; s < 3; s++) starTxt += s < got ? "⭐" : "▫";
        ctx.fillText(starTxt, n.x, n.y + r * 1.45);
      }
    }
  }

  function drawDex(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#fff6e0");
    grad.addColorStop(1, "#ffe3ee");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#7a5a1a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`📖 生物图鉴 ${dexSeen.size}/${DEX.length}`, w / 2, 32);
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#9a8a6e";
    ctx.fillText("吃过、见过的海洋生物都会记在这里!点任意处返回", w / 2, 58);

    const cols = w > 560 ? 4 : 3;
    const rows = Math.ceil(DEX.length / cols);
    const cw = Math.min(150, (w - 40) / cols);
    const ch = Math.min(92, (h - 110) / rows);
    const x0 = (w - cw * cols) / 2;
    const y0 = 80;
    for (let i = 0; i < DEX.length; i++) {
      const d = DEX[i];
      const seen = dexSeen.has(d.id);
      const cx = x0 + (i % cols) * cw + cw / 2;
      const cy = y0 + Math.floor(i / cols) * ch + ch / 2;
      ctx.fillStyle = seen ? "#ffffff" : "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2 + 5, cy - ch / 2 + 5, cw - 10, ch - 10, 12);
      ctx.fill();
      ctx.font = `${Math.round(ch * 0.34)}px sans-serif`;
      ctx.fillText(seen ? d.emoji : "❓", cx, cy - ch * 0.15);
      ctx.font = `bold ${Math.max(11, Math.round(ch * 0.15))}px sans-serif`;
      ctx.fillStyle = seen ? "#5a5a6e" : "#b8b8c2";
      ctx.fillText(seen ? d.name : "???", cx, cy + ch * 0.18);
      if (seen && ch > 70) {
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#9a9aa8";
        ctx.fillText(d.desc, cx, cy + ch * 0.35);
      }
    }
    const backFace: Rect = { x: 12, y: 12, w: 80, h: 34 };
    btnBack = touchArea(backFace);
    drawButton(backFace, "◀ 返回", "#fff", "#5a5a6e");
  }

  /** 结算里的一排吞吃链:这一局吃过的最大三条(按体型),鱼是画的不是字符。 */
  function drawEatChain(log: Array<{ r: number; color: string }>, cy: number): void {
    if (log.length === 0) return;
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#8a8a9a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("本局吞吃链", w / 2, cy - 24);
    const gap = 64;
    const x0 = w / 2 - ((log.length - 1) * gap) / 2;
    for (let i = 0; i < log.length; i++) {
      const it = log[i];
      const rr = Math.max(8, Math.min(16, it.r * 0.55));
      drawFish(x0 + i * gap, cy, rr, 1, it.color, "none", i * 0.7);
      if (i < log.length - 1) {
        ctx.fillStyle = "#b8b8c2";
        ctx.font = "13px sans-serif";
        ctx.fillText("›", x0 + i * gap + gap / 2, cy);
      }
    }
  }

  /** 体型成长条:from → to,金色打底。 */
  function drawGrowthBar(cy: number, from: number, to: number, nowR: number): void {
    const bw2 = Math.min(300, w - 80);
    const bx = (w - bw2) / 2;
    ctx.fillStyle = "#eef0f5";
    ctx.beginPath();
    ctx.roundRect(bx, cy, bw2, 14, 7);
    ctx.fill();
    const p = Math.max(0.06, Math.min(1, (nowR - from) / Math.max(1, to - from)));
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.roundRect(bx, cy, bw2 * p, 14, 7);
    ctx.fill();
    ctx.fillStyle = "#8a7a4a";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`体型 ${Math.round(from)} → ${Math.round(nowR)}`, w / 2, cy + 30);
  }

  function drawClearPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(450, w - 40), 320);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${def.name} 通过啦!`, w / 2, y + 38);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 78);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`吃了 ${eaten} 条鱼 · 掉心 ${heartsLost} · 得分 ${score}`, w / 2, y + 112);
    drawEatChain(eatLog, y + 162);
    drawGrowthBar(y + 190, START_RADIUS, def.targetR, player.r);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 244, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (levelIdx < LEVELS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 244, w: bw2, h: 44 };
      drawButton(btnNext, "下一关 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  /** BOSS 战失败时给一句针对这只 BOSS 的具体提示(短句,360 宽面板放得下)。 */
  function bossFailHint(): string | null {
    const def = level();
    if (!def.boss || !bossActive) return null;
    const b = BOSS_INFO[def.boss];
    if (b.crushes) return "趁它张开壳的那一下冲上去咬!";
    if (b.poisons) return "紫雾会散开,等一下再从侧面贴上去!";
    if (b.drifts) return "洋流被掀反时先别硬顶,顺着水绕过去!";
    if (b.inks) return "先绕开大墨团,再贴上去咬!";
    if (b.pulls) return "被吸住就往反方向使劲游!";
    if (b.summons) return "别理小帮手,躲开冲刺再咬!";
    if (b.enrages) return "它冲完停下的那一下最好咬!";
    return "等它冲刺停下,再贴上去咬!";
  }

  function drawRetryPanel(): void {
    const hint = bossFailHint();
    const skippable = canSkip();
    const { y } = panelBox(Math.min(450, w - 40), (hint ? 240 : 210) + (skippable ? 56 : 0));
    // 深紫替代浅紫:白底大字对比 4.8:1(原 #b28ae8 只有 2.7:1,不达 AA)
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("小鱼晕乎乎……", w / 2, y + 44);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText("没关系!这片海再游一次就好", w / 2, y + 80);
    let by = y + 128;
    if (hint) {
      // BOSS 失败给一句针对性提示,温柔不吓人(深橙 5.3:1,14px 小字要 4.5:1)
      ctx.fillStyle = "#a05914";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`💡 ${hint}`, w / 2, y + 112);
      by = y + 158;
    }
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: by, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: by, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再游一次", "#ffd868", "#7a5a1a");
    drawSkipButton(by + 56);
  }

  function drawIntroPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(460, w - 40), canSkip() ? 240 : 210);
    ctx.fillStyle = "#e05a7a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `第${themeIndexOf(levelIdx) + 1}章 第${levelIdx - themeStart(themeIndexOf(levelIdx)) + 1}关 · ${def.name}`,
      w / 2,
      y + 42,
    );
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.fillText(def.hint, w / 2, y + 88);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText(`${ZONE_STYLE[def.zone].name} · 点一下屏幕开始`, w / 2, y + 148);
    drawSkipButton(y + 176);
  }

  /**
   * 「跳过这一关」只在壳层注册过家长授权门时才画。
   * 授权通过后本关记 0 星、下一关照样解锁——跳过去不是本事,不该冒出一颗星来。
   */
  function drawSkipButton(top: number): void {
    if (!canSkip()) {
      btnSkip = null;
      return;
    }
    const bw = 150;
    btnSkip = { x: w / 2 - bw / 2, y: top, w: bw, h: 44 };
    drawButton(btnSkip, skipPending ? "问问大人中…" : "🔑 请大人跳过", "#efe6ff", "#5a3a9a");
  }

  function draw(): void {
    if (phase === "home") {
      drawHome();
      return;
    }
    if (phase === "rivalPick") {
      drawRivalPick();
      return;
    }
    if (phase === "arena" || phase === "arenaOver") {
      drawArena();
      return;
    }
    if (phase === "themes") {
      drawThemes();
      return;
    }
    if (phase === "map") {
      drawMap();
      return;
    }
    if (phase === "dex") {
      drawDex();
      return;
    }

    const def = level();
    const zone = ZONE_STYLE[def.zone];
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    // 水体:深度着色(越深越暗)+ 远景剪影层 + 斜光柱(reduced 静止)
    drawUnderwaterBackdrop(ctx, w, h, zone.top, zone.bottom);
    const layers = layerToggles(quality());
    if (layers.far && !zone.dark) {
      drawFarLayer(ctx, w, h, time, -(player.x - w / 2) * 0.06, reducedMotion);
    }
    if (!zone.dark) drawLightShafts(ctx, w, h, time, reducedMotion);
    drawZoneDecor();
    drawHazards();

    for (const b of bubbles) drawBubble(ctx, b.x, b.y, b.r, 0.55);

    for (const p of pickups) {
      if (p.kind === "buddy") {
        // 泡泡里装着一条小青鱼(画的,不再是字符占位)
        drawBubble(ctx, p.x, p.y, 16, 0.85);
        drawFish(p.x, p.y, 8, 1, "#7fe0c8", "none", time + p.phase);
      } else if (p.kind === "shield") {
        drawShieldBadge(ctx, p.x, p.y, 15, 0.85);
      } else {
        drawCollectStar(ctx, p.x, p.y, 11, time + p.phase, reducedMotion);
      }
    }

    for (const f of npcs) {
      if (f.kind === "jelly") drawJelly(f);
      else if (f.kind === "puffer") drawPuffer(f);
      else if (f.kind === "urchin") drawUrchin(f);
      else if (f.kind === "squid") drawSquid(f);
      else if (f.kind === "toxin") drawToxin(f);
      else drawFish(f.x, f.y, f.r, f.vx >= 0 ? 1 : -1, f.color, "none", time + f.phase);
    }

    for (const bd of buddies) drawBuddy(bd);

    drawSwirls();

    if (boss) drawBoss(boss);
    if (bossDefeatFx) drawBossDefeatFx();

    const blink = invincible > 0 && Math.floor(time * 8) % 2 === 0;
    if (!blink) {
      // 成长升档:金光扩散 + 1.15 倍弹性缩放(reduced 只留金光)
      const scale = drawGrowFx(player.x, player.y, player.r, time);
      ctx.save();
      if (scale !== 1) {
        ctx.translate(player.x, player.y);
        ctx.scale(scale, scale);
        ctx.translate(-player.x, -player.y);
      }
      drawFish(
        player.x,
        player.y,
        player.r,
        player.facing,
        "#ff9eb5",
        "crown",
        time,
        mouthOpen01(Math.max(0, time - mouthAt) * 1000),
      );
      ctx.restore();
      if (shield > 0) {
        ctx.strokeStyle = `rgba(120,180,255,${0.5 + Math.sin(time * 6) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r * 1.5 + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 毒雾(碰到会缩一圈)
    for (const hz of hazes) {
      ctx.globalAlpha = Math.max(0, Math.min(0.55, hz.life * 0.24));
      ctx.fillStyle = "#a05ac9";
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
      ctx.arc(hz.x - hz.r * 0.5, hz.y + hz.r * 0.35, hz.r * 0.6, 0, Math.PI * 2);
      ctx.arc(hz.x + hz.r * 0.55, hz.y - hz.r * 0.3, hz.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 墨云(遮挡视线)
    for (const ink of inks) {
      ctx.globalAlpha = Math.max(0, Math.min(0.85, ink.life * 0.6));
      ctx.fillStyle = "#4a3a5e";
      ctx.beginPath();
      ctx.arc(ink.x, ink.y, ink.r, 0, Math.PI * 2);
      ctx.arc(ink.x - ink.r * 0.6, ink.y + ink.r * 0.3, ink.r * 0.7, 0, Math.PI * 2);
      ctx.arc(ink.x + ink.r * 0.6, ink.y - ink.r * 0.25, ink.r * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 深水罩:屏下 30% 叠极淡蓝(实体越深越蒙一层),低成本纵深
    drawDepthTint(ctx, w, h);

    // 午夜深渊:漆黑一片,只能看清玩家身边一圈
    if (zone.dark && phase === "play") {
      const sight = player.r * DARK_SIGHT;
      const g = ctx.createRadialGradient(player.x, player.y, sight * 0.45, player.x, player.y, sight);
      g.addColorStop(0, "rgba(10,10,26,0)");
      g.addColorStop(1, "rgba(10,10,26,0.88)");
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.5 - Math.min(0.5, p.life)) * 90 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 21px sans-serif" : "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // 前景层:近景水草大剪影(35% 半透明,视差 1.3,只贴屏角不挡触控),低画质不画
    if (layers.fore && !zone.dark) {
      drawForeLayer(ctx, w, h, time, -(player.x - w / 2) * 0.12, reducedMotion);
    }

    // BOSS 进场:屏幕边缘暗角 0.5s(reduced 减弱),随剪影渐显一起收掉
    if (boss && bossIntroAt >= 0) {
      drawVignette(ctx, w, h, bossEntrance(time - bossIntroAt, reducedMotion).vignette);
    }

    ctx.restore();

    // ---- HUD ----
    // 窄屏修复:HUD 拆两行——第一行左章节/右爱心得分,第二行长大进度条独占,
    // 原来三块挤同一行在 360 宽互相压盖;进度文字 13→14px
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(
      `第${themeIndexOf(levelIdx) + 1}章 ${levelIdx - themeStart(themeIndexOf(levelIdx)) + 1}/${themeSize(themeIndexOf(levelIdx))} · ${zone.name}`,
      12,
      21,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_LEVEL - hearts)) + `  分 ${score}`,
      w - 12,
      21,
    );

    const bw = Math.min(340, w - 24);
    const bx = (w - bw) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(bx, 34, bw, 22, 11);
    ctx.fill();
    const prog = bossActive
      ? 1
      : Math.max(0, Math.min(1, (player.r - START_RADIUS) / (def.targetR - START_RADIUS)));
    ctx.fillStyle = "#ff9eb5";
    ctx.beginPath();
    ctx.roundRect(bx, 34, Math.max(22, bw * prog), 22, 11);
    ctx.fill();
    ctx.fillStyle = "#4a4a5e";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      bossActive && def.boss
        ? `去咬${BOSS_INFO[def.boss].name}!`
        : `长大进度 ${Math.round(prog * 100)}%`,
      w / 2,
      45,
    );
    if (shield > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a8ac9";
      ctx.fillText(`🛡 ${Math.ceil(shield)}s`, w - 12, 70);
    }
    // 1.1 机制徽标:洋流方向 / 体型上限 / 共生小鱼 / 麻酥酥。
    // 单独占第三行左侧,右边留给护盾,375 宽也塞得下。
    const badges: string[] = [];
    if (hasDrift()) badges.push(`🌀 洋流 ${driftNow().fx >= 0 ? "→" : "←"}`);
    if (def.hazards.includes("pressure")) badges.push(`🕳 上限 ${Math.round(sizeCap)}`);
    if (buddies.length > 0) badges.push(`🐬 ×${buddies.length}`);
    if (numb > 0) badges.push("😵 麻");
    if (badges.length > 0) {
      ctx.textAlign = "left";
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#3a4a5e";
      ctx.fillText(badges.join(" · "), 12, 70, Math.max(60, w - (shield > 0 ? 90 : 24)));
    }
    if (streak >= 3 && streakTimer > 0) {
      ctx.fillStyle = "#b28ae8";
      ctx.font = `bold ${18 + Math.min(streak, 8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`连吃 ×${streak}`, w / 2, badges.length > 0 ? 98 : 76);
    }

    // ---- 覆盖层 ----
    if (phase === "intro") drawIntroPanel();
    else if (phase === "clear") drawClearPanel();
    else if (phase === "retry") drawRetryPanel();
  }

  let raf = 0;
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    syncSize();
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  resetLevel();
  endlessBest = readEndlessBest();
  raf = requestAnimationFrame(frame);

  // 平台给了 initialLevel、或者地址栏带着 ?level=N,就别停在首屏
  const wanted = initialLevelIndex(api.initialLevel, safeSearch());
  if (wanted !== null) openCampaignLevel(wanted + 1);

  return {
    openCampaignLevel,
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      stopSpeaking();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.remove();
    },
  };
}
