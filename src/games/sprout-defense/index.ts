import { meta } from "./meta";
export { meta };

// 绿芽保卫战 1.2:188 关十三大花园守家战役 + 无尽「守到天亮」。
// 1.1 打底:昼夜循环、地下虫(望望草照出)、露珠罐上限、分分虫分裂、进化体狂暴。
// 1.2 新增:☀️阳光第二条经济与三种新绿芽(暖暖花/蓬蓬花/弹弹网)、哧溜虫挖地绕后、
// 每种机制提前 3 秒的预警角标、三类特殊关(固定苗解谜 / 传送带发苗 / 限时速攻)、
// 苗卡冷却圈与「为什么种不下」的原因提示、铲子二段确认,以及无尽守夜模式。
// 失败只鼓励、只重试本关。
import {
  BELT_QUEUE_MAX,
  BLITZ_GRACE,
  BOOM_DAMAGE,
  BOOM_RANGE,
  BOOM_TRIGGER,
  BOSS_CHEW_INTERVAL,
  BUBBLE_SPEED,
  BUG_INFO,
  BugKind,
  BugSpawn,
  CHEW_INTERVAL,
  HOME_X,
  ICE_SECONDS,
  ICE_SLOW,
  ICE_SPEED,
  LANES,
  LEVELS,
  MAMA_SPLIT_KIND,
  MOON_DEW_EVERY,
  PLANT_COLS,
  PLANT_INFO,
  PROGRESS_KEY,
  PUFF_SPEED,
  PUFF_SPLASH_DAMAGE,
  PUFF_SPLASH_RANGE,
  PlantKind,
  PlantStock,
  ProjKind,
  QUEENX_RAGE_FRAC,
  SCENE_ORDER,
  SCENE_STYLE,
  SPARKLE_DEW_EVERY,
  STAR_SPEED,
  TUNNEL_TIME,
  applyDamage,
  blitzLimit,
  bubbleHitsBug,
  bugHp,
  bugNightSpeedMult,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  canPlantOnCell,
  canJumpOver,
  clampDew,
  clearSpeechLine,
  cyclePhase,
  effectiveDewCap,
  isLevelUnlocked,
  isThemeUnlocked,
  moleRevealed,
  moonActive,
  parseProgress,
  passiveDewIntervalAt,
  plantsUnlockedAt,
  projectileCanHit,
  queenxSpeedMult,
  retrySpeechLine,
  serializeProgress,
  shootCooldown,
  shovelRefund,
  starsForLevel,
  themeCleared,
  themeIndexOfLevel,
  themeOffset,
  themeSize,
  themeStars,
  totalStars,
  tunnelExitCol,
} from "./logic";
import {
  CARD_H,
  ENDLESS_DAWN_WAVE,
  HUD_FONT_MIN,
  PLANT_SPEC,
  SUN_FIRST,
  ShovelPending,
  SpawnWarning,
  TRAIT_INFO,
  activeWarnings,
  buildWarnings,
  bugTraits,
  cardStripLayout,
  endlessSkyLine,
  endlessWave,
  fieldMetrics,
  plantBlockReason,
  BLOCK_REASON_TEXT,
  shovelStep,
  sunInterval,
} from "./sprout12";
import { kidWording } from "./wording";
import {
  BugArt,
  IconKind,
  drawBugBody,
  drawClearStar,
  drawFence,
  drawFireflies,
  drawKitIcon,
  drawLaneGrass,
  drawLeafDot,
  drawMapHorizon,
  drawMoleMound as artMoleMound,
  drawPlantIcon as artPlantIcon,
  drawShovelIcon as artShovelIcon,
  drawThemeMedallion,
  HorizonVariant,
} from "./art";
import { getLevelExtras } from "../../ui/level188Contract";
import { isRootOpen } from "../../ui/root12Contract";
import { save } from "../../engine/save";
import { fitLineWith, mapNodePoints, unlockedWithRoot } from "./mapFit";
import { speak, stopSpeaking } from "../speech";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
  /** 1.2 平台直达:进来就打第几关(1 基) */
  initialLevel?: number;
}

export interface SproutDefenseHandle {
  destroy: () => void;
  /** 1.2 平台直达第 N 关(1 基),返回真正打开的关号 */
  openCampaignLevel: (n: number) => number;
}

/** 顶部资源/波次那一行的高度(字号 ≥ 14px,独占一行不跟卡片抢地方)。 */
const HUD_ROW_H = 26;
const TOOLBAR_H = HUD_ROW_H + CARD_H + 10;
const HOME_W_CELLS = 1.2;

type Phase = "themes" | "map" | "intro" | "play" | "clear" | "retry";
type Tool = PlantKind | "shovel";
type Proj = ProjKind;
type Mode = "campaign" | "endless";

interface Plant {
  col: number;
  lane: number;
  kind: PlantKind;
  hp: number;
  cd: number;
  prodTimer: number;
  anim: number;
  /** 1.3:刚种下的弹入动画剩余秒数(0.25s 从 0.6 缩放弹到 1,弱动效直接出现) */
  born: number;
  /** 1.3:刚被啃了一口的小抖动(纯视觉,不改啃食节奏) */
  hurt: number;
}

interface Bug {
  kind: BugKind;
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  speed: number;
  flying: boolean;
  chewTimer: number;
  wob: number;
  freeze: number;
  jumped: boolean;
  jumpAnim: number;
  /** 1.1:进化体已进入狂暴(只触发一次特效) */
  raged: boolean;
  /** 1.1:地下虫已播过"现形"特效 */
  surfacedFx: boolean;
  /** 1.2:哧溜虫挖地剩余秒数,> 0 时在土里(打不到也不啃),出土点一直冒土花 */
  dig: number;
  /** 1.2:出土点(挖地时提前画出来,不许突然袭击) */
  digCol: number;
}

interface Shot {
  x: number;
  lane: number;
  proj: Proj;
}

interface Sparkle {
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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

/** 平台没给 initialLevel 时,兜底看地址栏的 ?level=(1 基)。 */
function levelFromQuery(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("level");
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

/** 局部样式:类名一律 spd- 前缀,不碰 src/styles.css。 */
const LOCAL_CSS = `
.spd-root{position:absolute;inset:0;overflow:hidden;background:#eafbe0;}
.spd-canvas{width:100%;height:100%;display:block;touch-action:none;}
.spd-skip{position:absolute;right:8px;bottom:8px;z-index:2;min-height:44px;padding:0 14px;
  border:0;border-radius:14px;background:rgba(255,255,255,0.92);color:#5a5a6e;
  font:600 ${HUD_FONT_MIN}px/1.2 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.12);cursor:pointer;}
.spd-skip[disabled]{opacity:.5;}
`;

export function mount(api: GameAPI): SproutDefenseHandle {
  const { root } = api;
  const wrap = document.createElement("div");
  wrap.className = "spd-root";
  const style = document.createElement("style");
  style.textContent = LOCAL_CSS;
  wrap.appendChild(style);
  const canvas = document.createElement("canvas");
  canvas.className = "spd-canvas";
  wrap.appendChild(canvas);
  root.appendChild(wrap);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const calmMotion = prefersReducedMotion();

  const progress = loadProgress();

  // ---- 局状态 ----
  let levelIdx = 0;
  let chapterIdx = 0;
  let phase: Phase = "themes";
  let schedule: BugSpawn[] = [];
  const plants = new Map<string, Plant>();
  const lilies = new Set<string>();
  const bugs: Bug[] = [];
  const shots: Shot[] = [];
  const sparkles: Sparkle[] = [];
  const floats: Floaty[] = [];

  let dew = 4;
  /** 1.2 第二条经济:☀️阳光,只有暖暖花会开,吃阳光的苗才种得下 */
  let sun = 0;
  let unlockedPlants: PlantKind[] = plantsUnlockedAt(0, LEVELS);
  let tools: Tool[] = [...unlockedPlants, "shovel"];
  let selected: Tool = "bubble";
  let time = 0;
  let spawnIdx = 0;
  let passiveTimer = 3.5;
  let plantsLost = 0;
  let score = 0;
  let earnedStars: 1 | 2 | 3 = 1;
  let finaleFired = false;
  let destroyed = false;
  let dewFlash = 0;
  let waveBanner = 0;
  let bannerFlag = false;
  let currentWave = -1;
  let shake = 0;
  /** 1.3:结算/失败覆盖层的演出时钟(金星逐颗点亮、无尽日出渐变) */
  let overlayT = 0;
  /** 1.3:防线被突破时房端栅栏倒下的一帧演出 */
  let fenceFall = 0;

  // ---- 1.2 苗卡冷却 / 种不下的原因 ----
  const cardCd = new Map<PlantKind, number>();
  let blockTip = "";
  let blockTipLife = 0;
  // ---- 1.2 铲子二段确认 ----
  let shovelPending: ShovelPending | null = null;
  // ---- 1.2 预警 ----
  let warnings: SpawnWarning[] = [];
  // ---- 1.2 特殊关 ----
  const stock = new Map<PlantKind, number>();
  let belt: PlantKind[] = [];
  let beltIdx = 0;
  let beltTimer = 0;
  let beltQueue: PlantKind[] = [];
  let timeLimit = 0;
  // ---- 1.2 无尽「守到天亮」 ----
  let mode: Mode = "campaign";
  let endlessWaveNo = 0;
  let endlessBest = 0;
  let endlessCleared = 0;
  let endlessNextAt = 0;
  let btnEndless: Rect | null = null;

  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  const themeCards: Array<{ idx: number; rect: Rect }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };

  let w = 640;
  let h = 480;
  /** 一格的宽 */
  let cell = 48;
  /** 一条道的高(1.2 起与宽分开算,360px 上也保证 ≥ 40px) */
  let laneH = 48;
  let ox = 0;
  let oy = TOOLBAR_H;
  let cardStrip = cardStripLayout(360, 4, 0);
  let stripScroll = 0;

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
    // 昼夜循环关在提示条下面还有一行时段钟,通道区要再往下让一行
    const extraRow = mode === "campaign" && level().cycle ? 26 : 0;
    const m = fieldMetrics(w, h, TOOLBAR_H + extraRow, HOME_W_CELLS);
    cell = m.cw;
    laneH = m.ch;
    ox = m.ox;
    oy = m.oy;
    cardStrip = cardStripLayout(w, tools.length, stripScroll);
    stripScroll = cardStrip.scroll;
  }

  const px = (cx: number) => ox + cx * cell;
  const laneCenterY = (lane: number) => oy + (lane + 0.5) * laneH;

  function level() {
    return LEVELS[levelIdx];
  }

  /** 无尽模式没有 LevelDef,统一用这几个取值口。 */
  function specialNow() {
    return mode === "endless" ? undefined : level().special;
  }
  const isPuzzle = () => specialNow()?.kind === "puzzle";
  const isConveyor = () => specialNow()?.kind === "conveyor";
  const isBlitz = () => specialNow()?.kind === "blitz";

  function sceneStyle() {
    return SCENE_STYLE[level().scene];
  }

  function isWaterLane(lane: number): boolean {
    return level().waterLanes.includes(lane);
  }

  /** 章内关号(1 起):1.1 起章节长短不一,按偏移算。 */
  function levelLabel(): string {
    return `${chapterIdx + 1}-${levelIdx - themeOffset(chapterIdx) + 1}`;
  }

  /** 现在是不是黑夜(昼夜循环关跟着钟走,其余关恒为白天)。 */
  function isNightNow(): boolean {
    return cyclePhase(time, level().cycle) === "night";
  }

  /** 产露植物数(闪光芽+月月菇),露珠罐上限随之变大。 */
  function producerCount(): number {
    let n = 0;
    for (const p of plants.values()) if (p.kind === "sparkle" || p.kind === "moon") n++;
    return n;
  }

  function dewCapNow(): number {
    return effectiveDewCap(level().dewCap, producerCount());
  }

  /** 拿露珠都走这里:有上限的关多出来的会溢出去;解谜/传送关没有露珠经济。 */
  function gainDew(n: number): void {
    if (isPuzzle() || isConveyor()) return;
    dew = clampDew(dew + n, dewCapNow());
  }

  function scoutInLane(lane: number): boolean {
    for (const p of plants.values()) if (p.kind === "scout" && p.lane === lane) return true;
    return false;
  }

  /** 1.2:这条道上的弹弹网都在第几列(哧溜虫钻不过网,只能在网前面冒头)。 */
  function netpadColsIn(lane: number): number[] {
    const out: number[] = [];
    for (const p of plants.values()) if (p.kind === "netpad" && p.lane === lane) out.push(p.col);
    return out;
  }

  /** 地下虫要车道上有望望草才现形;挖地中的哧溜虫也算「不在场上」。 */
  function revealed(bug: Bug): boolean {
    return moleRevealed(bug.kind, scoutInLane(bug.lane)) && bug.dig <= 0;
  }

  /**
   * 1.2 苗卡片条:一行横滑。卡片宽固定不小于 48px(热区 ≥ 44px),
   * 放不下就整条横向滚动,绝不把十几张卡压成小豆子。
   */
  function cardRect(i: number): Rect {
    return {
      x: 6 + i * (cardStrip.cardW + cardStrip.gap) - stripScroll,
      y: HUD_ROW_H + 4,
      w: cardStrip.cardW,
      h: CARD_H,
    };
  }

  /** 这一株现在能不能种(冷却 / 露珠 / 阳光 / 库存都算上)。 */
  function cardCooldownLeft(kind: PlantKind): number {
    return cardCd.get(kind) ?? 0;
  }

  /** 特殊关的「手里还有几张」:解谜看库存,传送看队列,普通关是 Infinity。 */
  function suppliesLeft(kind: PlantKind): number {
    if (isPuzzle()) return stock.get(kind) ?? 0;
    if (isConveyor()) return beltQueue.filter((k) => k === kind).length;
    return Infinity;
  }

  function affordablePlant(kind: PlantKind): boolean {
    if (isPuzzle() || isConveyor()) return suppliesLeft(kind) > 0;
    return dew >= PLANT_INFO[kind].cost && sun >= PLANT_SPEC[kind].sun;
  }

  function payPlant(kind: PlantKind): void {
    if (isPuzzle()) {
      stock.set(kind, Math.max(0, (stock.get(kind) ?? 0) - 1));
      return;
    }
    if (isConveyor()) {
      const i = beltQueue.indexOf(kind);
      if (i >= 0) beltQueue.splice(i, 1);
      return;
    }
    dew -= PLANT_INFO[kind].cost;
    sun -= PLANT_SPEC[kind].sun;
  }

  function showBlockTip(text: string): void {
    blockTip = text;
    blockTipLife = 1.6;
  }

  function addSparkle(x: number, y: number, color: string): void {
    sparkles.push({ x, y, life: 0.6, color });
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  function loadLevel(idx: number): void {
    mode = "campaign";
    levelIdx = idx;
    chapterIdx = themeIndexOfLevel(idx);
    const sp = LEVELS[idx].special;
    if (sp?.kind === "puzzle") unlockedPlants = (sp.stock ?? []).map((s) => s.kind);
    else if (sp?.kind === "conveyor") unlockedPlants = [...new Set(sp.belt ?? [])];
    else unlockedPlants = plantsUnlockedAt(idx, LEVELS);
    if (LEVELS[idx].waterLanes.length > 0 && !unlockedPlants.includes("lily")) {
      unlockedPlants = ["lily", ...unlockedPlants];
    }
    tools = [...unlockedPlants, "shovel"];
    if (!tools.includes(selected)) selected = tools[0];
    resetLevel();
    phase = "intro";
  }

  /** 每局都要归零的那一堆(重开、换关、进无尽都走这里)。 */
  function resetRun(): void {
    plants.clear();
    lilies.clear();
    bugs.length = 0;
    shots.length = 0;
    cardCd.clear();
    stock.clear();
    belt = [];
    beltIdx = 0;
    beltTimer = 0;
    beltQueue = [];
    timeLimit = 0;
    shovelPending = null;
    blockTip = "";
    blockTipLife = 0;
    sun = 0;
    time = 0;
    spawnIdx = 0;
    plantsLost = 0;
    score = 0;
    currentWave = -1;
    waveBanner = 0;
    stripScroll = 0;
    overlayT = 0;
    fenceFall = 0;
  }

  function resetLevel(): void {
    resetRun();
    const def = level();
    schedule = buildLevelSchedule(levelIdx);
    warnings = buildWarnings(schedule);
    const sp = def.special;
    for (const s of (sp?.stock ?? []) as PlantStock[]) stock.set(s.kind, s.count);
    if (sp?.kind === "conveyor") {
      belt = [...(sp.belt ?? [])];
      beltTimer = sp.beltEvery ?? 1;
      // 开局先发两张,不用干等第一趟传送带
      for (let i = 0; i < 2 && belt.length > 0; i++) beltQueue.push(belt[beltIdx++ % belt.length]);
    }
    if (sp?.kind === "blitz") timeLimit = blitzLimit(levelIdx);
    // 解谜关与传送关没有露珠经济:手里那几株就是全部家当
    dew = sp?.kind === "puzzle" || sp?.kind === "conveyor" ? 0 : def.startDew;
    passiveTimer = passiveDewIntervalAt(def.scene, false);
  }

  /* ---------------- 1.2 无尽「守到天亮」 ---------------- */

  function startEndless(): void {
    mode = "endless";
    levelIdx = LEVELS.length - 1;
    chapterIdx = themeIndexOfLevel(levelIdx);
    unlockedPlants = plantsUnlockedAt(LEVELS.length - 1, LEVELS);
    tools = [...unlockedPlants, "shovel"];
    if (!tools.includes(selected)) selected = tools[0];
    resetRun();
    schedule = [];
    warnings = [];
    endlessWaveNo = 0;
    endlessCleared = 0;
    endlessNextAt = 6;
    dew = 8;
    passiveTimer = passiveDewIntervalAt("night", true);
    endlessBest = save.getGameProgress("sprout-defense").endlessBest;
    phase = "intro";
  }

  /** 排下一波夜虫:波次无限,越往后种类越全、虫越多、血越厚。 */
  function pushEndlessWave(): void {
    endlessWaveNo++;
    const spec = endlessWave(endlessWaveNo);
    let i = 0;
    let clock = time + 0.4;
    let waveEnd = clock;
    for (const entry of spec.entries) {
      for (let k = 0; k < entry.count; k++) {
        const t = clock + k * entry.gap;
        schedule.push({ time: t, lane: (i * 3 + endlessWaveNo * 2) % LANES, kind: entry.kind, wave: endlessWaveNo - 1 });
        waveEnd = Math.max(waveEnd, t);
        i++;
      }
      clock += 1.1;
    }
    schedule.sort((a, b) => a.time - b.time);
    warnings = buildWarnings(schedule);
    endlessNextAt = waveEnd + Math.max(4, 9 - endlessWaveNo * 0.15);
    currentWave = endlessWaveNo - 1;
    bannerFlag = spec.boss;
    waveBanner = spec.boss ? 2.4 : 1.8;
    api.play(spec.boss ? "oops" : "jump");
  }

  function endlessOver(): void {
    endlessCleared = Math.max(0, endlessWaveNo - 1);
    endlessBest = save.recordEndlessBest("sprout-defense", endlessCleared);
    phase = "retry";
    overlayT = 0;
    fenceFall = 1;
    shake = calmMotion ? 0 : 0.5;
    api.play("oops");
    speak(`守住了 ${endlessCleared} 波,已经很棒啦!再来一夜试试?`);
  }

  function levelCleared(): void {
    earnedStars = starsForLevel(plantsLost);
    const prev = progress[levelIdx] ?? 0;
    const gained = Math.max(0, earnedStars - prev);
    progress[levelIdx] = Math.max(prev, earnedStars);
    saveProgress(progress);
    phase = "clear";
    overlayT = 0;
    api.play("win");
    if (levelIdx >= LEVELS.length - 1 && !finaleFired) {
      finaleFired = true;
      api.onWin(earnedStars, `${LEVELS.length} 关十三大花园全部守住,虫虫女王进化体也认输啦!总星 ${totalStars(progress)}/${LEVELS.length * 3}`);
    } else {
      // 结算面板自动朗读(终局走平台弹窗,那边自带朗读,不叠音)
      speak(clearSpeechLine(level().name, earnedStars, plantsLost));
      if (gained > 0) api.addStars(gained);
    }
  }

  function breach(): void {
    shake = calmMotion ? 0 : 0.5;
    api.play("oops");
    phase = "retry";
    overlayT = 0;
    fenceFall = 1;
    speak(retrySpeechLine(bossFailHint()));
  }

  // ---- 输入 ----
  function inRect(x: number, y: number, r: Rect | null): boolean {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /** 卡片条横滑:按下记起点,拖过 8px 就算滑动、不选卡。 */
  let strip: { id: number; x0: number; scroll0: number; moved: number } | null = null;

  function onPointerMove(e: PointerEvent): void {
    if (destroyed || !strip || e.pointerId !== strip.id) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dx = x - strip.x0;
    strip.moved = Math.max(strip.moved, Math.abs(dx));
    stripScroll = Math.min(Math.max(0, strip.scroll0 - dx), cardStrip.maxScroll);
  }

  function onPointerUp(e: PointerEvent): void {
    if (destroyed || !strip || e.pointerId !== strip.id) return;
    const s = strip;
    strip = null;
    if (s.moved > 8) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = 0; i < tools.length; i++) {
      if (inRect(x, y, cardRect(i))) {
        selected = tools[i];
        shovelPending = null;
        api.play("tap");
        return;
      }
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (destroyed) return;
    strip = null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (phase === "themes") {
      if (inRect(x, y, btnEndless)) {
        if (totalStars(progress) > 0) {
          api.play("tap");
          startEndless();
        } else {
          api.play("oops");
        }
        return;
      }
      for (const c of themeCards) {
        if (inRect(x, y, c.rect)) {
          if (themeOpenFor(c.idx)) {
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
          if (unlockedFor(n.idx)) {
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
        phase = mode === "endless" ? "themes" : "map";
        return;
      }
      api.play("tap");
      phase = "play";
      if (mode === "endless" && endlessWaveNo === 0) endlessNextAt = time + 6;
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
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        stopSpeaking();
        if (mode === "endless") {
          startEndless();
          phase = "play";
        } else {
          resetLevel();
          phase = "play";
        }
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = mode === "endless" ? "themes" : "map";
      }
      return;
    }

    if (inRect(x, y, btnBack)) {
      api.play("tap");
      phase = mode === "endless" ? "themes" : "map";
      return;
    }

    // 1.2 苗卡片条:按下先记住起点,松手时没横滑才算选卡(横滑是翻卡不是选卡)
    if (y >= HUD_ROW_H + 4 && y <= HUD_ROW_H + 4 + CARD_H) {
      strip = { id: e.pointerId, x0: x, scroll0: stripScroll, moved: 0 };
      return;
    }

    const col = Math.floor((x - ox) / cell);
    const lane = Math.floor((y - oy) / laneH);
    if (col < 0 || col >= PLANT_COLS || lane < 0 || lane >= LANES) return;
    const key = `${col},${lane}`;
    const existing = plants.get(key);
    const water = isWaterLane(lane);
    const hasLily = lilies.has(key);

    if (selected === "shovel") {
      if (!existing && !hasLily) {
        api.play("tap");
        shovelPending = null;
        return;
      }
      // 1.2 误触保护:第一下只是「举起铲子」,同一格再点一下才真铲
      const step = shovelStep(shovelPending, key, time);
      shovelPending = step.pending;
      if (step.action === "arm") {
        api.play("tap");
        addFloat(px(col + 0.5), laneCenterY(lane) - 12, "再点一下才铲哦", "#c47a2a");
        return;
      }
      if (existing) {
        const refund = shovelRefund(existing.kind);
        plants.delete(key);
        gainDew(refund); // 先铲再进账:铲掉的要是产露植物,罐口也跟着缩
        api.play("pop");
        addSparkle(px(col + 0.5), laneCenterY(lane), "#d5c9a8");
        addFloat(px(col + 0.5), laneCenterY(lane) - 14, `+${refund} 露珠`, "#5a8ac9");
      } else {
        lilies.delete(key);
        gainDew(shovelRefund("lily"));
        api.play("pop");
        addSparkle(px(col + 0.5), laneCenterY(lane), "#bfe9ff");
      }
      return;
    }
    shovelPending = null;

    const cellOk = canPlantOnCell(selected, water, hasLily, !!existing);
    // 1.2:种不下要说清楚为什么 —— 冷却 / 露珠 / 阳光 / 这一格
    const reason = isPuzzle() || isConveyor()
      ? cardCooldownLeft(selected) > 0
        ? "cooldown"
        : suppliesLeft(selected) <= 0
          ? "dew"
          : cellOk
            ? null
            : "cell"
      : plantBlockReason(selected, dew, sun, cardCooldownLeft(selected), cellOk);
    if (reason) {
      api.play("tap");
      if (reason === "dew" || reason === "sun") dewFlash = 0.8;
      const text =
        (isPuzzle() || isConveyor()) && reason === "dew"
          ? isPuzzle()
            ? "这一种苗用完啦,换一种试试"
            : "传送带还在送,等下一株"
          : BLOCK_REASON_TEXT[reason];
      showBlockTip(text);
      if (water && !hasLily && selected !== "lily") {
        addFloat(px(col + 0.5), laneCenterY(lane) - 10, "先铺荷叶垫!", "#5a8ac9");
      }
      return;
    }
    payPlant(selected);
    cardCd.set(selected, PLANT_SPEC[selected].cooldown);
    if (selected === "lily") {
      lilies.add(key);
      api.play("pop");
      addSparkle(px(col + 0.5), laneCenterY(lane), "#bfe9ff");
      return;
    }
    plants.set(key, {
      col,
      lane,
      kind: selected,
      hp: PLANT_INFO[selected].hp,
      cd: 0.5,
      prodTimer:
        selected === "moon" ? MOON_DEW_EVERY : selected === "sunbud" ? SUN_FIRST : SPARKLE_DEW_EVERY,
      anim: 1,
      born: calmMotion ? 0 : 0.25,
      hurt: 0,
    });
    api.play("pop");
    addSparkle(px(col + 0.5), laneCenterY(lane), "#d5f2ca");
    // 1.3:种下瞬间土粒四溅
    for (let k = 0; k < 4; k++) {
      addSparkle(
        px(col + 0.5) + Math.cos((k * Math.PI) / 2 + 0.6) * cell * 0.24,
        laneCenterY(lane) + laneH * 0.28,
        "#b98a5a",
      );
    }
    if (selected === "scout") {
      // 望望草落地即照亮:这条道藏土里的地地虫马上现形(特效在 update 里播)
      addFloat(px(col + 0.5), laneCenterY(lane) - cell * 0.6, "这条道亮啦!", "#ffe387");
    }
    if (selected === "netpad") {
      addFloat(px(col + 0.5), laneCenterY(lane) - cell * 0.6, "跳不过也钻不过!", "#8a5ac9");
    }
  }

  const isShooter = (k: PlantKind): boolean =>
    k === "bubble" || k === "star" || k === "ice" || k === "puff";

  function plantInLaneCell(lane: number, colFloat: number): Plant | undefined {
    const col = Math.round(colFloat - 0.5);
    return plants.get(`${col},${lane}`);
  }

  function killBug(i: number): void {
    const bug = bugs[i];
    bugs.splice(i, 1);
    gainDew(1);
    const gain = 10 * (currentWave + 1) * (BUG_INFO[bug.kind].boss ? 5 : 1);
    score += gain;
    api.play(BUG_INFO[bug.kind].boss ? "win" : "coin");
    addSparkle(px(bug.x), laneCenterY(bug.lane), "#c9b6f2");
    addFloat(px(bug.x), laneCenterY(bug.lane) - 16, `+${gain}`, "#c47a2a");
    if (BUG_INFO[bug.kind].boss) {
      shake = calmMotion ? 0 : 0.5;
      addFloat(px(bug.x), laneCenterY(bug.lane) - 40, `${BUG_INFO[bug.kind].name}倒下啦!`, "#e05a7a", true);
    }
    // 1.1 分分虫:倒下时蹦出爬爬虫宝宝(与模拟器同规则)
    const splits = BUG_INFO[bug.kind].splits ?? 0;
    if (splits > 0) {
      addFloat(px(bug.x), laneCenterY(bug.lane) - 30, "分裂啦!", "#e06a9a", true);
      for (let s = 0; s < splits; s++) {
        const info = BUG_INFO[MAMA_SPLIT_KIND];
        bugs.push({
          kind: MAMA_SPLIT_KIND,
          x: bug.x + s * 0.25,
          lane: bug.lane,
          hp: bugHp(MAMA_SPLIT_KIND, levelIdx),
          maxHp: bugHp(MAMA_SPLIT_KIND, levelIdx),
          armor: info.armor,
          maxArmor: info.armor,
          speed: info.speed * sceneStyle().speedMult,
          flying: info.flying,
          chewTimer: 0,
          wob: Math.random() * Math.PI * 2,
          freeze: 0,
          jumped: true,
          jumpAnim: 0,
          raged: false,
          surfacedFx: true,
          dig: 0,
          digCol: 0,
        });
      }
    }
  }

  function boomExplode(p: Plant): void {
    plants.delete(`${p.col},${p.lane}`);
    shake = calmMotion ? 0 : 0.4;
    api.play("oops");
    addSparkle(px(p.col + 0.5), laneCenterY(p.lane), "#ffc09b");
    addFloat(px(p.col + 0.5), laneCenterY(p.lane) - 20, "轰!!", "#e05a7a", true);
    for (let bi = bugs.length - 1; bi >= 0; bi--) {
      const b = bugs[bi];
      if (!revealed(b)) continue; // 藏在土里的地地虫轰不到
      if (Math.abs(b.lane - p.lane) <= 1 && Math.abs(b.x - (p.col + 0.5)) <= BOOM_RANGE) {
        const res = applyDamage(b, BOOM_DAMAGE);
        b.hp = res.hp;
        b.armor = res.armor;
        if (b.hp <= 0) killBug(bi);
      }
    }
  }

  function update(dt: number): void {
    for (let i = sparkles.length - 1; i >= 0; i--) {
      sparkles[i].life -= dt;
      sparkles[i].y -= dt * 30;
      if (sparkles[i].life <= 0) sparkles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= dt * 30;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    if (phase === "clear" || phase === "retry") overlayT += dt;
    if (phase !== "play") return;

    time += dt;
    dewFlash = Math.max(0, dewFlash - dt);
    waveBanner = Math.max(0, waveBanner - dt);
    shake = Math.max(0, shake - dt);
    blockTipLife = Math.max(0, blockTipLife - dt);
    for (const [k, v] of cardCd) if (v > 0) cardCd.set(k, Math.max(0, v - dt));
    const night = mode === "endless" ? true : isNightNow();

    // 无尽:上一波清完(或时间到了)就排下一波,永远不结束
    if (mode === "endless" && (endlessWaveNo === 0 || time >= endlessNextAt)) {
      pushEndlessWave();
    }

    // 传送关:传送带每隔几秒送一株苗,队列满了就先等着
    if (isConveyor() && belt.length > 0) {
      beltTimer -= dt;
      if (beltTimer <= 0) {
        beltTimer = specialNow()?.beltEvery ?? 1;
        if (beltQueue.length < BELT_QUEUE_MAX) {
          beltQueue.push(belt[beltIdx++ % belt.length]);
          api.play("coin");
        }
      }
    }

    // 速攻关:倒计时归零还没清场就算这一关没守住(仍然只鼓励)
    if (isBlitz() && timeLimit > 0 && time >= timeLimit) {
      breach();
      return;
    }

    // 出虫
    const hpBonus = mode === "endless" ? endlessWave(Math.max(1, endlessWaveNo)).hpBonus : 0;
    const hpLevel = mode === "endless" ? 40 : levelIdx;
    while (spawnIdx < schedule.length && schedule[spawnIdx].time <= time) {
      const s = schedule[spawnIdx++];
      if (mode === "campaign" && s.wave !== currentWave) {
        currentWave = s.wave;
        bannerFlag = level().flagWaves.includes(s.wave);
        waveBanner = bannerFlag ? 2.4 : 1.8;
        api.play(bannerFlag ? "oops" : "jump");
      }
      const info = BUG_INFO[s.kind];
      const hp = bugHp(s.kind, hpLevel) + hpBonus;
      bugs.push({
        kind: s.kind,
        x: PLANT_COLS + 0.7,
        lane: s.lane,
        hp,
        maxHp: hp,
        armor: info.armor,
        maxArmor: info.armor,
        speed: info.speed * sceneStyle().speedMult,
        flying: info.flying,
        chewTimer: 0,
        wob: Math.random() * Math.PI * 2,
        freeze: 0,
        jumped: false,
        jumpAnim: 0,
        raged: false,
        surfacedFx: !info.underground,
        dig: info.digs ? TUNNEL_TIME : 0,
        digCol: info.digs ? tunnelExitCol(netpadColsIn(s.lane)) : 0,
      });
    }

    // 露珠(黑夜里攒得慢)
    if (!isPuzzle() && !isConveyor()) {
      passiveTimer -= dt;
      if (passiveTimer <= 0) {
        passiveTimer = passiveDewIntervalAt(mode === "endless" ? "night" : level().scene, night);
        gainDew(1);
        addSparkle(60, TOOLBAR_H + 8, "#bfe9ff");
      }
    }

    // 植物
    for (const p of plants.values()) {
      p.anim = Math.max(0, p.anim - dt * 3);
      p.born = Math.max(0, p.born - dt);
      p.hurt = Math.max(0, p.hurt - dt * 3);
      if (p.kind === "sparkle") {
        p.prodTimer -= dt;
        if (p.prodTimer <= 0) {
          p.prodTimer = SPARKLE_DEW_EVERY;
          gainDew(1);
          api.play("coin");
          addSparkle(px(p.col + 0.5), laneCenterY(p.lane) - cell * 0.4, "#ffe387");
        }
      } else if (p.kind === "moon") {
        // 月月菇只在月光时段咕嘟冒露珠(昼夜关的黑夜/整关都暗的场景)
        if (moonActive(!!level().cycle, night, sceneStyle().dark)) {
          p.prodTimer -= dt;
          if (p.prodTimer <= 0) {
            p.prodTimer = MOON_DEW_EVERY;
            gainDew(1);
            api.play("coin");
            addSparkle(px(p.col + 0.5), laneCenterY(p.lane) - cell * 0.4, "#c9d8ff");
          }
        }
      } else if (p.kind === "sunbud") {
        // 1.2 暖暖花:唯一会开☀️阳光的苗,天黑了开得慢一大截
        p.prodTimer -= dt;
        if (p.prodTimer <= 0) {
          p.prodTimer = sunInterval(sceneStyle().dark || night);
          sun += 1;
          api.play("coin");
          addSparkle(px(p.col + 0.5), laneCenterY(p.lane) - laneH * 0.4, "#ffd868");
        }
      } else if (isShooter(p.kind)) {
        p.cd -= dt;
        if (p.cd <= 0) {
          const proj = p.kind as Proj;
          const hasTarget = bugs.some(
            (b) =>
              b.lane === p.lane &&
              b.x > p.col + 0.3 &&
              projectileCanHit(proj, b.flying) &&
              revealed(b),
          );
          if (hasTarget) {
            p.cd = shootCooldown(proj);
            p.anim = 1;
            shots.push({ x: p.col + 0.7, lane: p.lane, proj });
          }
        }
      } else if (p.kind === "boom") {
        const near = bugs.some(
          (b) => b.lane === p.lane && Math.abs(b.x - (p.col + 0.5)) <= BOOM_TRIGGER && revealed(b),
        );
        if (near) {
          boomExplode(p);
        }
      }
    }

    // 子弹飞行
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const spd =
        s.proj === "star"
          ? STAR_SPEED
          : s.proj === "ice"
            ? ICE_SPEED
            : s.proj === "puff"
              ? PUFF_SPEED
              : BUBBLE_SPEED;
      s.x += spd * dt;
      if (s.x > PLANT_COLS + 1.5) {
        shots.splice(i, 1);
        continue;
      }
      for (let bi = 0; bi < bugs.length; bi++) {
        const bug = bugs[bi];
        if (bug.lane !== s.lane || bug.hp <= 0) continue;
        if (!projectileCanHit(s.proj, bug.flying)) continue;
        if (!revealed(bug)) continue; // 子弹从藏土的地地虫头顶飞过
        if (bubbleHitsBug(s.x, bug.x)) {
          const hitX = bug.x;
          const res = applyDamage(bug, 1);
          bug.hp = res.hp;
          bug.armor = res.armor;
          if (s.proj === "ice") {
            bug.freeze = ICE_SECONDS;
            addSparkle(px(bug.x), laneCenterY(bug.lane), "#bfe9ff");
          }
          shots.splice(i, 1);
          if (res.brokeArmor) {
            api.play("meow");
            addFloat(px(bug.x), laneCenterY(bug.lane) - cell * 0.5, "壳碎啦!", "#c47a2a");
          } else {
            api.play("pop");
            addSparkle(px(bug.x), laneCenterY(bug.lane), s.proj === "star" ? "#ffe387" : "#bfe9ff");
          }
          // 1.2 蓬蓬花:花粉团炸开,溅到命中点前后一小片的地面虫
          if (s.proj === "puff") {
            addSparkle(px(hitX), laneCenterY(s.lane), "#ffd0e8");
            for (let k = bugs.length - 1; k >= 0; k--) {
              const other = bugs[k];
              if (other === bug || other.lane !== s.lane || other.flying) continue;
              if (!revealed(other) || Math.abs(other.x - hitX) > PUFF_SPLASH_RANGE) continue;
              const r2 = applyDamage(other, PUFF_SPLASH_DAMAGE);
              other.hp = r2.hp;
              other.armor = r2.armor;
              addSparkle(px(other.x), laneCenterY(other.lane), "#ffd0e8");
              if (other.hp <= 0) killBug(k);
            }
          }
          if (bug.hp <= 0) killBug(bugs.indexOf(bug));
          break;
        }
      }
    }

    // 虫子
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      bug.wob += dt * 6;
      bug.freeze = Math.max(0, bug.freeze - dt);
      bug.jumpAnim = Math.max(0, bug.jumpAnim - dt * 2);
      if (bug.hp <= 0) {
        killBug(i);
        continue;
      }
      // 1.2 哧溜虫:进场就钻土里,出土点一直冒土花(看得见,不算突然袭击)
      if (bug.dig > 0) {
        bug.digCol = tunnelExitCol(netpadColsIn(bug.lane));
        bug.dig -= dt;
        if (bug.dig <= 0) {
          bug.dig = 0;
          bug.x = bug.digCol + 0.5;
          api.play("jump");
          addSparkle(px(bug.x), laneCenterY(bug.lane), "#d8b088");
          addFloat(px(bug.x), laneCenterY(bug.lane) - laneH * 0.45, "冒出来啦!", "#c47a2a");
        }
        continue;
      }
      const surfaced = revealed(bug);
      // 地地虫被望望草照出来的那一下,播个"现形"特效
      if (surfaced && !bug.surfacedFx) {
        bug.surfacedFx = true;
        api.play("jump");
        addSparkle(px(bug.x), laneCenterY(bug.lane), "#e8b878");
        addFloat(px(bug.x), laneCenterY(bug.lane) - cell * 0.5, "现形啦!", "#e8b878");
      }
      // 进化体掉到半血进入狂暴:提速 + 一次性大特效
      if (bug.kind === "queenx" && !bug.raged && bug.hp / bug.maxHp <= QUEENX_RAGE_FRAC) {
        bug.raged = true;
        shake = calmMotion ? 0 : 0.5;
        api.play("oops");
        addFloat(px(bug.x), laneCenterY(bug.lane) - cell * 0.8, "女王狂暴啦!!", "#e05a7a", true);
      }
      const speedMul =
        (bug.freeze > 0 ? ICE_SLOW : 1) *
        bugNightSpeedMult(bug.kind, night) *
        queenxSpeedMult(bug.kind, bug.hp / bug.maxHp);
      // 飞虫越过植物;没现形的地地虫在土里钻,也不啃植物
      const p = bug.flying || !surfaced ? undefined : plantInLaneCell(bug.lane, bug.x - 0.3);
      if (p && bugReachesPlant(bug.x, p.col)) {
        // 钻钻虫第一次遇到植物直接跳过去 —— 但弹弹网专治跳跃,跳不过去
        if (BUG_INFO[bug.kind].jumps && !bug.jumped) {
          if (canJumpOver(p.kind)) {
            bug.jumped = true;
            bug.jumpAnim = 1;
            bug.x = p.col - 0.55;
            api.play("jump");
            addFloat(px(bug.x), laneCenterY(bug.lane) - cell * 0.5, "跳过去啦!", "#b28ae8");
            continue;
          }
          bug.jumped = true;
          addFloat(px(bug.x), laneCenterY(bug.lane) - cell * 0.5, "弹回来啦!", "#5aa878");
        }
        bug.chewTimer -= dt;
        if (bug.chewTimer <= 0) {
          bug.chewTimer = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
          p.hp--;
          p.hurt = 1;
          if (p.hp <= 0) {
            plants.delete(`${p.col},${p.lane}`);
            plantsLost++;
            api.play("oops");
            addSparkle(px(p.col + 0.5), laneCenterY(p.lane), "#e9d8dd");
          }
        }
      } else {
        bug.chewTimer = 0;
        bug.x -= bug.speed * speedMul * dt;
      }
      if (bug.x <= HOME_X) {
        if (mode === "endless") endlessOver();
        else breach();
        return;
      }
    }

    if (mode === "endless") {
      if (bugs.length === 0 && spawnIdx >= schedule.length && endlessWaveNo > 0) {
        endlessCleared = endlessWaveNo;
      }
      return;
    }
    if (spawnIdx >= schedule.length && bugs.length === 0) {
      levelCleared();
    }
  }

  // ---- 绘制 ----
  // 1.3:具体的资产绘制都在 art.ts(可单测),这里只负责算坐标与状态。
  /** 植物图标:anim 沿用 1.2 语义,hpFrac 给坚果三档缺口,recoil 给射手后坐帧 */
  function plantIcon(x: number, y: number, r: number, kind: PlantKind, anim = 0, hpFrac = 1, recoil = 0): void {
    artPlantIcon(ctx, x, y, r, kind, { anim, hpFrac, recoil });
  }

  function drawShovelIcon(x: number, y: number, r: number): void {
    artShovelIcon(ctx, x, y, r);
  }

  /** 卡片造价行:水滴图标 + 数字(吃阳光的苗再加太阳图标 + 数字)。 */
  function drawCostRow(cx: number, cy: number, dewCost: number, sunCost: number, dim: boolean): void {
    const ir = 5.5;
    const dewTxt = String(dewCost);
    const sunTxt = String(sunCost);
    let total = ir * 2 + 2 + ctx.measureText(dewTxt).width;
    if (sunCost > 0) total += 6 + ir * 2 + 2 + ctx.measureText(sunTxt).width;
    let x = cx - total / 2 + ir;
    if (dim) ctx.globalAlpha = 0.45;
    drawKitIcon(ctx, "drop", x, cy, ir);
    ctx.fillStyle = dim ? "#8a8a9a" : "#5a5a6e";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dewTxt, x + ir + 2, cy);
    if (sunCost > 0) {
      x += ir + 2 + ctx.measureText(dewTxt).width + 6 + ir;
      drawKitIcon(ctx, "sun", x, cy, ir);
      ctx.fillStyle = dim ? "#8a8a9a" : "#5a5a6e";
      ctx.fillText(sunTxt, x + ir + 2, cy);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
  }

  /** 虫子:把闭包状态翻成 BugArt,真正的笔画在 art.ts 里。 */
  function drawBug(bug: Bug): void {
    // 1.1 地地虫:没被望望草照出来时只画土包(问号气泡是绘制的,不是字符)
    if (!revealed(bug)) {
      artMoleMound(ctx, px(bug.x), laneCenterY(bug.lane), Math.min(cell, laneH) * 0.3, bug.wob, calmMotion);
      return;
    }
    const unit = Math.min(cell, laneH);
    const hover = bug.flying ? -unit * 0.22 + Math.sin(bug.wob * 1.4) * unit * 0.06 : 0;
    const hop = bug.jumpAnim > 0 ? -Math.sin(bug.jumpAnim * Math.PI) * unit * 0.5 : 0;
    const y = laneCenterY(bug.lane) + Math.sin(bug.wob) * unit * 0.03 + hover + hop;
    // 啃咬动作 0.3s 一循环:头部前顶 + 张嘴,纯视觉,不改啃食 DPS 节奏
    const chew = bug.chewTimer > 0 ? (calmMotion ? 0.5 : (time % 0.3) / 0.3) : 0;
    const art: BugArt = {
      kind: bug.kind,
      x: px(bug.x),
      y,
      groundY: laneCenterY(bug.lane),
      unit,
      wob: bug.wob,
      frozen: bug.freeze > 0,
      raged: bug.raged,
      chew,
      armor: bug.armor,
      maxArmor: bug.maxArmor,
      dots: Math.min(12, bug.maxHp + bug.maxArmor),
      hpFrac: (bug.hp + bug.armor) / (bug.maxHp + bug.maxArmor),
      calm: calmMotion,
    };
    drawBugBody(ctx, art);
  }

  function panelBox(pw: number, ph: number): { x: number; y: number } {
    const x = (w - pw) / 2;
    const y = h / 2 - ph / 2;
    ctx.fillStyle = "rgba(250,255,246,0.85)";
    ctx.fillRect(0, 0, w, h);
    // 1.3:面板卡片化 —— 底下垫一层柔和的圆角阴影
    ctx.fillStyle = "rgba(90,110,90,0.18)";
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 6, pw, ph, 22);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 22);
    ctx.fill();
    return { x, y };
  }

  /** 居中排一行「小图标 + 文字」(替代文案里的 emoji 字符)。 */
  function iconTextCenter(
    cx: number,
    y: number,
    icon: IconKind,
    text: string,
    font: string,
    color: string,
    iconR: number,
  ): void {
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const ix = cx - (iconR * 2 + 6 + tw) / 2 + iconR;
    drawKitIcon(ctx, icon, ix, y, iconR);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, ix + iconR + 6, y);
  }

  /** 居中排「前段文字 + 金星 + 后段文字」(主页/地图副标题的星数)。 */
  function starLineCenter(cx: number, y: number, before: string, after: string, font: string, color: string): void {
    ctx.font = font;
    const sr = 7;
    const w1 = ctx.measureText(before).width;
    const w2 = ctx.measureText(after).width;
    let x = cx - (w1 + sr * 2 + 6 + w2) / 2;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(before, x, y);
    x += w1 + sr + 3;
    drawKitIcon(ctx, "star", x, y, sr);
    ctx.fillStyle = color;
    ctx.fillText(after, x + sr + 3, y);
  }

  function drawButton(r: Rect, label: string, bg: string, fg: string): void {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  function drawThemes(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#eafbe0");
    grad.addColorStop(0.5, "#e8ecf8");
    grad.addColorStop(1, "#d4f0ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 标题:双叶芽是绘制的,不再用 🌱 字符
    iconTextCenter(w / 2, 28, "sprout", "绿芽保卫战 · 十三大花园", "bold 24px sans-serif", "#4a9a5a", 13);
    starLineCenter(
      w / 2,
      54,
      `共 ${LEVELS.length} 关 · `,
      ` ${totalStars(progress)}/${LEVELS.length * 3} · 先选花园,再选关卡`,
      "14px sans-serif",
      "#7a8a6e",
    );

    themeCards.length = 0;
    const cols = w > h * 1.15 ? 3 : 2;
    const rows = Math.ceil(SCENE_ORDER.length / cols);
    const pad = 10;
    const x0 = Math.max(10, w * 0.06);
    const y0 = 72;
    // 底下给无尽入口留一条 60px 的地方,章节卡不许压到它
    const endlessH = 46;
    const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
    const ch = Math.min(96, (h - y0 - 16 - endlessH - 10 - pad * (rows - 1)) / rows);
    for (let i = 0; i < SCENE_ORDER.length; i++) {
      const st = SCENE_STYLE[SCENE_ORDER[i]];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x0 + col * (cw + pad), y: y0 + row * (ch + pad), w: cw, h: ch };
      themeCards.push({ idx: i, rect });
      const unlocked = themeOpenFor(i);
      const cleared = themeCleared(progress, i);
      ctx.fillStyle = unlocked ? (st.dark ? st.laneB : st.laneA) : "#e8e8ee";
      ctx.strokeStyle = unlocked ? st.accent : "#b8b8c2";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.stroke();
      // 章节圆章:accent 圆底 + 双叶芽 + 叶环;锁住换挂锁(不再用 emoji/🔒 字符)
      drawThemeMedallion(ctx, rect.x + 10 + ch * 0.17, rect.y + ch * 0.3, ch * 0.17, st.accent, !unlocked);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = unlocked ? (st.dark ? "#fff" : st.accent) : "#9a9aa8";
      ctx.font = `bold ${Math.min(17, Math.round(ch * 0.22))}px sans-serif`;
      // 390px 手机两列卡只有 150px 宽:标题 / 简介量宽截断,不再捅进邻卡(1.3 UX 走查修复)
      const measure = (s: string): number => ctx.measureText(s).width;
      const titleX = rect.x + 10 + ch * 0.42;
      ctx.fillText(fitLineWith(measure, `第${i + 1}章 ${st.name}`, rect.x + rect.w - 8 - titleX), titleX, rect.y + ch * 0.3);
      ctx.font = `${Math.min(12, Math.round(ch * 0.16))}px sans-serif`;
      ctx.fillStyle = unlocked ? (st.dark ? "#e0e0f0" : "#5a5a6e") : "#a8a8b4";
      ctx.fillText(fitLineWith(measure, unlocked ? st.blurb : "通关上一章解锁", rect.w - 20), rect.x + 10, rect.y + ch * 0.6);
      if (unlocked) {
        const sr = Math.min(6, ch * 0.09);
        const before = `${cleared}/${themeSize(i)} 关 · `;
        ctx.fillText(before, rect.x + 10, rect.y + ch * 0.82);
        const bw = ctx.measureText(before).width;
        drawKitIcon(ctx, "star", rect.x + 10 + bw + sr, rect.y + ch * 0.82, sr);
        ctx.fillStyle = unlocked ? (st.dark ? "#e0e0f0" : "#5a5a6e") : "#a8a8b4";
        ctx.fillText(
          `${themeStars(progress, i)}/${themeSize(i) * 3}`,
          rect.x + 10 + bw + sr * 2 + 3,
          rect.y + ch * 0.82,
        );
      }
    }

    // 1.2 无尽入口:守到天亮。第一章通了就开,战役进度不受影响
    const openEndless = totalStars(progress) > 0;
    const best = save.getGameProgress("sprout-defense").endlessBest;
    btnEndless = { x: x0, y: y0 + rows * (ch + pad) + 2, w: w - x0 * 2, h: endlessH };
    ctx.fillStyle = openEndless ? "#3c4270" : "#e8e8ee";
    ctx.strokeStyle = openEndless ? "#ffd27a" : "#b8b8c2";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(btnEndless.x, btnEndless.y, btnEndless.w, btnEndless.h, 14);
    ctx.fill();
    ctx.stroke();
    iconTextCenter(
      btnEndless.x + btnEndless.w / 2,
      btnEndless.y + btnEndless.h / 2,
      openEndless ? "moon" : "lock",
      openEndless
        ? `无尽守夜 · 守到天亮${best > 0 ? ` · 最好 ${best} 波` : ""}`
        : "先在战役里拿一颗星,就能来守夜",
      "bold 16px sans-serif",
      openEndless ? "#fff3d0" : "#9a9aa8",
      9,
    );
  }

  /** 章节 → 地平线剪影查表:雪原 / 夜园 / 水畔 / 花园。 */
  function horizonVariant(): HorizonVariant {
    const scene = SCENE_ORDER[chapterIdx];
    if (scene === "winter") return "snow";
    if (scene === "pool" || scene === "beach") return "water";
    return SCENE_STYLE[scene].dark ? "night" : "garden";
  }

  function drawMap(): void {
    const st = SCENE_STYLE[SCENE_ORDER[chapterIdx]];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.bg);
    grad.addColorStop(1, st.dark ? st.laneA : st.laneB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    drawMapHorizon(ctx, w, h, horizonVariant(), st.accent);

    btnBack = { x: 6, y: 7, w: 62, h: 30 };
    drawButton(btnBack, "◀ 花园", "rgba(255,255,255,0.85)", "#5a5a6e");

    // 标题:章节圆章替代 emoji
    ctx.font = "bold 22px sans-serif";
    const titleTxt = `第${chapterIdx + 1}章 · ${st.name}`;
    const titleW = ctx.measureText(titleTxt).width;
    drawThemeMedallion(ctx, w / 2 - titleW / 2 - 16, 28, 12, st.accent, false);
    ctx.fillStyle = st.dark ? "#fff" : st.accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(titleTxt, w / 2 - titleW / 2, 28);
    starLineCenter(
      w / 2,
      54,
      "",
      ` ${themeStars(progress, chapterIdx)}/${themeSize(chapterIdx) * 3} · 通关解锁下一关,回放可刷 3 星`,
      "14px sans-serif",
      st.dark ? "#d8d8e8" : "#6a6a7e",
    );

    mapNodes.length = 0;
    const count = themeSize(chapterIdx);
    const base = themeOffset(chapterIdx);
    // 排布公式在 mapFit.mapNodePoints 里(行距钳制居中,1.3 UX 走查修复),
    // runtime/art 测试也用它反推点击坐标,画与点永远对得上
    for (const [i, p] of mapNodePoints(w, h, count).entries()) {
      mapNodes.push({ idx: base + i, x: p.x, y: p.y, r: p.r });
    }
    // 连线改小叶片路径点:一片片叶子沿路排开,方向顺着路走
    for (let i = 0; i + 1 < mapNodes.length; i++) {
      const a = mapNodes[i];
      const b = mapNodes[i + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(2, Math.floor(seg / 22));
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        drawLeafDot(ctx, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 4.5, ang + (k % 2 === 0 ? 0.35 : -0.35), st.dark);
      }
    }
    for (const n of mapNodes) {
      const def = LEVELS[n.idx];
      const unlocked = unlockedFor(n.idx);
      const got = progress[n.idx] ?? 0;
      const isBoss = def.feature.includes("BOSS");
      const r = isBoss ? n.r * 1.25 : n.r;
      ctx.fillStyle = unlocked ? (got > 0 ? "#e8f6e0" : "#ffffff") : "rgba(228,228,234,0.92)";
      ctx.strokeStyle = unlocked ? st.accent : "#b8b8c2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 1.3:节点叶环微饰(通关的节点绕一圈章节色小叶)
      if (unlocked && got > 0) {
        ctx.fillStyle = st.accent;
        ctx.globalAlpha = 0.55;
        for (let li = 0; li < 6; li++) {
          const a = (Math.PI * 2 * li) / 6 - Math.PI / 2;
          ctx.beginPath();
          ctx.ellipse(n.x + Math.cos(a) * (r + 4), n.y + Math.sin(a) * (r + 4), r * 0.14, r * 0.08, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!unlocked) {
        // 挂锁是绘制的,不再是 "🔒" 字符
        drawKitIcon(ctx, "lock", n.x, n.y, r * 0.5);
      } else {
        ctx.fillStyle = st.accent;
        ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
        ctx.fillText(String(n.idx - base + 1), n.x, n.y);
        // 关卡类型角标:王冠 / 双剑 / 水滴 / 双叶芽(全部绘制)
        const icon: IconKind = isBoss ? "crown" : def.gen ? "swords" : def.waterLanes.length > 0 ? "drop" : "sprout";
        drawKitIcon(ctx, icon, n.x, n.y - r * 1.1, r * 0.34);
        // 三颗迷你星:金渐变亮星 / 灰空星
        for (let s = 0; s < 3; s++) {
          drawKitIcon(ctx, s < got ? "star" : "starEmpty", n.x + (s - 1) * r * 0.55, n.y + r * 1.45, r * 0.24);
        }
      }
    }
  }

  function drawClearPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(440, w - 40), 230);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 25px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${levelLabel()} · ${def.name} 守住啦!`, w / 2, y + 42);
    // 1.3:金星逐颗点亮(0.3s 一颗,点亮瞬间弹跳 + 星屑;弱动效直接全亮)
    for (let s = 0; s < 3; s++) {
      const litAt = 0.25 + s * 0.3;
      const lit = s < earnedStars && (calmMotion || overlayT >= litAt);
      const pop = calmMotion ? 1 : Math.min(1, Math.max(0, (overlayT - litAt) / 0.35));
      drawClearStar(ctx, w / 2 + (s - 1) * 52, y + 90, 20, { lit, pop });
    }
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(
      plantsLost <= 1 ? "植物几乎无伤,完美防守!" : `损失植物 ${plantsLost} 棵 · 得分 ${score}`,
      w / 2,
      y + 126,
    );
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 158, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (levelIdx < LEVELS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 158, w: bw2, h: 44 };
      drawButton(btnNext, "下一关 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  /** 本关有 BOSS 时,失败面板给一句针对性的短提示。 */
  function bossFailHint(): string | null {
    for (const wave of level().waves) {
      for (const e of wave) {
        if (!BUG_INFO[e.kind].boss) continue;
        if (e.kind === "queenx") return "进化体元气掉一半会狂暴,提前埋爆爆果,冰冰花别停!";
        if (e.kind === "queen") return "冰冰花冻住女王,星星芽集火!";
        return "大虫王那条道多种果果墩顶住!";
      }
    }
    return null;
  }

  function drawRetryPanel(): void {
    const endless = mode === "endless";
    const hint = endless ? "夜里虫虫最多的是会飞的,星星芽多留两株" : bossFailHint();
    // 1.3 无尽「守到天亮」结算:日出渐变演出(2s 过渡,弱动效直接切到亮)
    if (endless) {
      const t = calmMotion ? 1 : Math.min(1, overlayT / 2);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#3e4468");
      sky.addColorStop(1, "#4a5080");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const dawn = ctx.createLinearGradient(0, 0, 0, h);
      dawn.addColorStop(0, "#ffb47a");
      dawn.addColorStop(1, "#ffe8c8");
      ctx.globalAlpha = t;
      ctx.fillStyle = dawn;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      drawKitIcon(ctx, "sun", w / 2, h / 2 - 140 + (1 - t) * 30, 20);
    }
    const { y } = panelBox(Math.min(440, w - 40), hint ? 240 : 210);
    // 深紫替代浅紫:白底大字对比 4.8:1(原 #b28ae8 只有 2.7:1,不达 AA)
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(endless ? `守住了 ${endlessCleared} 波!` : "虫虫溜进小屋啦……", w / 2, y + 46);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(
      endless
        ? `已经很棒啦!最好成绩 ${endlessBest} 波 · 再来一夜?`
        : isBlitz() && timeLimit > 0 && time >= timeLimit
          ? "时间到啦!没关系,火力再密一点就成"
          : "没关系!就在这一关重新布阵",
      w / 2,
      y + 84,
    );
    let by = y + 130;
    if (hint) {
      // BOSS 失败给一句针对性提示,温柔不吓人(深橙 5.3:1,14px 小字要 4.5:1)
      ctx.fillStyle = "#a05914";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(hint, w / 2, y + 116, Math.min(400, w - 60));
      by = y + 160;
    }
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: by, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: by, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再试一次", "#ffd868", "#7a5a1a");
  }

  function drawIntroPanel(): void {
    if (mode === "endless") {
      const { y } = panelBox(Math.min(450, w - 40), 200);
      iconTextCenter(w / 2, y + 44, "moon", "无尽 · 守到天亮", "bold 24px sans-serif", "#5a6ac9", 13);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText("一波接一波,撑到第 20 波天就亮啦!", w / 2, y + 84, Math.min(420, w - 60));
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#a0a0b2";
      ctx.fillText(`最好成绩 ${endlessBest} 波 · 点一下屏幕开始`, w / 2, y + 124);
      ctx.fillText("(左上角 ◀ 可回花园)", w / 2, y + 154);
      return;
    }
    const def = level();
    const st = sceneStyle();
    const { y } = panelBox(Math.min(450, w - 40), 200);
    ctx.fillStyle = st.accent;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${levelLabel()} · ${def.name}`, w / 2, y + 44);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    // 1.1 冻结的第 13 关那句还写着「掉血」——数据带回归指纹不能动,
    // 所以在这儿按元气的说法念给孩子听。详见 `wording.ts`。
    ctx.fillText(kidWording(def.hint), w / 2, y + 88, Math.min(420, w - 60));
    // 1.1 新机制角标:昼夜循环 / 露珠罐上限;1.2 再加特殊关与本关会出的机制
    const badges: string[] = [];
    if (def.special?.kind === "puzzle") badges.push("解谜关:苗是发好的,想清楚摆哪儿");
    if (def.special?.kind === "conveyor") badges.push("传送关:传送带来什么就用什么");
    if (def.special?.kind === "blitz") badges.push(`速攻关:${blitzLimit(levelIdx)}s 内清场`);
    const traits = new Set<string>();
    for (const wave of def.waves) {
      for (const e of wave) for (const t of bugTraits(e.kind)) traits.add(TRAIT_INFO[t].label);
    }
    if (traits.size > 0) badges.push(`本关机制:${[...traits].join(" ")}`);
    if (def.cycle) badges.push(`白天${def.cycle.day}s→黑夜${def.cycle.night}s 循环`);
    if (def.dewCap !== undefined) badges.push(`露珠罐上限 ${def.dewCap}(种产露植物变大)`);
    if (badges.length > 0) {
      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#8a5ac9";
      ctx.fillText(badges.join(" · "), w / 2, y + 114, Math.min(430, w - 50));
    }
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText(`${st.name} · ${def.waves.length} 波 · 点一下屏幕开始`, w / 2, y + 138);
    ctx.fillText("(左上角 ◀ 可回地图)", w / 2, y + 162);
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
    const st = sceneStyle();
    const cycleNight = !!def.cycle && isNightNow();
    const night = st.dark || cycleNight;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    ctx.fillStyle = st.bg;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    if (night) {
      // 星星点点
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 97) % 100) / 100 * w;
        const sy = ((i * 53) % 100) / 100 * (oy - 8);
        ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(time * 1.5 + i));
        ctx.fillRect(sx, sy, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff1c9";
      ctx.beginPath();
      ctx.arc(w - 60, TOOLBAR_H + 26, 18, 0, Math.PI * 2);
      ctx.fill();
      // 1.3 夜章氛围:月光斜带(8% 白)+ 几粒慢慢飘的萤火虫
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(w - 130, 0);
      ctx.lineTo(w - 30, 0);
      ctx.lineTo(w * 0.35, h);
      ctx.lineTo(w * 0.35 - 100, h);
      ctx.closePath();
      ctx.fill();
      drawFireflies(ctx, w, oy, laneH * LANES, time, calmMotion);
    }

    const plantSelected = selected !== "shovel";
    const affordSelected =
      plantSelected &&
      affordablePlant(selected as PlantKind) &&
      cardCooldownLeft(selected as PlantKind) <= 0;
    const hintPulse = 0.25 + Math.sin(time * 4) * 0.12;
    for (let lane = 0; lane < LANES; lane++) {
      const water = isWaterLane(lane);
      if (water) {
        ctx.fillStyle = "#9fd8f5";
        ctx.fillRect(ox - cell * HOME_W_CELLS, oy + lane * laneH, cell * (PLANT_COLS + HOME_W_CELLS), laneH);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        for (let c = 0; c < PLANT_COLS; c++) {
          ctx.beginPath();
          const wy = oy + lane * laneH + laneH * 0.5 + Math.sin(time * 2 + c) * 3;
          ctx.moveTo(px(c) + cell * 0.2, wy);
          ctx.quadraticCurveTo(px(c) + cell * 0.5, wy - 4, px(c) + cell * 0.8, wy);
          ctx.stroke();
        }
        // 1.3:水面微光斑,慢慢往右漂(弱动效停在原地)
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        for (let k = 0; k < 3; k++) {
          const drift = calmMotion ? 0 : (time * 0.25 + k * 0.37) % 1;
          const lx = ox + ((k * 0.31 + drift) % 1) * cell * PLANT_COLS;
          ctx.beginPath();
          ctx.ellipse(lx, oy + lane * laneH + laneH * (0.3 + k * 0.2), cell * 0.32, laneH * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = lane % 2 === 0 ? st.laneA : st.laneB;
        ctx.fillRect(ox - cell * HOME_W_CELLS, oy + lane * laneH, cell * (PLANT_COLS + HOME_W_CELLS), laneH);
        // 1.3:每条泳道点缀几株两笔小草(位置确定,不闪)
        drawLaneGrass(ctx, ox, cell * PLANT_COLS, oy + lane * laneH, laneH, lane, night);
      }
      // 1.3:泳道分界改软边 —— 亮暗两条细线叠出渐变感,不再是生硬的色块拼缝
      if (lane > 0) {
        const by2 = oy + lane * laneH;
        ctx.fillStyle = night ? "rgba(0,0,0,0.14)" : "rgba(90,130,90,0.12)";
        ctx.fillRect(ox - cell * HOME_W_CELLS, by2 - 1, cell * (PLANT_COLS + HOME_W_CELLS), 1);
        ctx.fillStyle = night ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.35)";
        ctx.fillRect(ox - cell * HOME_W_CELLS, by2, cell * (PLANT_COLS + HOME_W_CELLS), 1);
      }
      for (let c = 0; c < PLANT_COLS; c++) {
        const key = `${c},${lane}`;
        if (!water) {
          // 旱地画成圆角小土坑,种在哪里一目了然
          const insetX = cell * 0.09;
          const insetY = laneH * 0.09;
          ctx.fillStyle = night ? "rgba(255,255,255,0.05)" : "rgba(150,110,70,0.1)";
          ctx.strokeStyle = night ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.55)";
          ctx.lineWidth = Math.max(1, cell * 0.03);
          ctx.beginPath();
          ctx.roundRect(px(c) + insetX, oy + lane * laneH + insetY, cell - insetX * 2, laneH - insetY * 2, Math.min(cell, laneH) * 0.18);
          ctx.fill();
          ctx.stroke();
        }
        // 呼吸的绿色"+":选中的植物能种在这里
        if (phase === "play" && affordSelected && plantSelected) {
          const ok = canPlantOnCell(selected as PlantKind, water, lilies.has(key), plants.has(key));
          if (ok) {
            ctx.strokeStyle = `rgba(90,168,120,${hintPulse})`;
            ctx.lineWidth = Math.max(2, cell * 0.055);
            ctx.lineCap = "round";
            const cxc = px(c + 0.5);
            const cyc = laneCenterY(lane);
            const arm = Math.min(cell, laneH) * 0.11;
            ctx.beginPath();
            ctx.moveTo(cxc - arm, cyc);
            ctx.lineTo(cxc + arm, cyc);
            ctx.moveTo(cxc, cyc - arm);
            ctx.lineTo(cxc, cyc + arm);
            ctx.stroke();
          }
        }
      }
    }

    // 1.2 挖地预告:哧溜虫在土里的时候,出土点一直冒土花
    for (const bug of bugs) {
      if (bug.dig <= 0) continue;
      const gx = px(bug.digCol + 0.5);
      const gy = laneCenterY(bug.lane);
      const pulse = 0.35 + 0.3 * Math.abs(Math.sin(time * 5));
      ctx.fillStyle = `rgba(180,130,80,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy + laneH * 0.16, cell * 0.3, laneH * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120,88,56,0.85)";
      for (let k = 0; k < 4; k++) {
        const a = time * 4 + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(gx + Math.cos(a) * cell * 0.22, gy - Math.abs(Math.sin(a)) * laneH * 0.28, cell * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      // 出土点的洞是绘制的椭圆洞 + 阴影,不再是 "🕳" 字符
      drawKitIcon(ctx, "hole", gx, gy - laneH * 0.3, Math.max(6, laneH * 0.14));
    }

    // 小屋
    const hx = ox - cell * HOME_W_CELLS * 0.5;
    const hs = Math.min(cell, laneH);
    // 1.3:防线尽头的小栅栏剪影,被突破时倒下一帧
    drawFence(ctx, ox - cell * HOME_W_CELLS + hs * 0.12, oy + 4, oy + laneH * LANES - 4, hs, fenceFall);
    for (let lane = 0; lane < LANES; lane++) {
      const hy = laneCenterY(lane);
      ctx.fillStyle = "#ffd6e7";
      ctx.beginPath();
      ctx.roundRect(hx - hs * 0.38, hy - hs * 0.25, hs * 0.76, hs * 0.55, 6);
      ctx.fill();
      ctx.fillStyle = "#ff9eb5";
      ctx.beginPath();
      ctx.moveTo(hx - hs * 0.46, hy - hs * 0.22);
      ctx.lineTo(hx, hy - hs * 0.52);
      ctx.lineTo(hx + hs * 0.46, hy - hs * 0.22);
      ctx.closePath();
      ctx.fill();
      // 门上的小心心是绘制的,不再是 "💗" 字符
      drawKitIcon(ctx, "heart", hx, hy + hs * 0.04, hs * 0.13);
    }

    const iconR = Math.min(cell, laneH) * 0.42;

    // 荷叶
    for (const key of lilies) {
      const [c, lane] = key.split(",").map(Number);
      plantIcon(px(c + 0.5), laneCenterY(lane) + laneH * 0.12, iconR, "lily");
    }

    // 植物
    for (const p of plants.values()) {
      // 1.3:被啃时小抖动(纯视觉);刚种下从 0.6 缩放弹入
      const tremble = p.hurt > 0 && !calmMotion ? Math.sin(time * 40) * 2 * p.hurt : 0;
      const scale = p.born > 0 ? 0.6 + 0.4 * (1 - p.born / 0.25) : 1;
      const x = px(p.col + 0.5) + tremble;
      const y = laneCenterY(p.lane);
      ctx.globalAlpha = p.hp <= 1 ? 0.65 : 1;
      const full = PLANT_INFO[p.kind].hp;
      const recoil = p.kind === "star" || p.kind === "ice" ? p.anim : 0;
      plantIcon(x, y, iconR * scale, p.kind, p.anim, p.hp / full, recoil);
      if (p.kind === "nut" || p.kind === "netpad") {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x - cell * 0.28, y - laneH * 0.46, cell * 0.56, 4);
        ctx.fillStyle = "#7ac97a";
        ctx.fillRect(x - cell * 0.28, y - laneH * 0.46, (cell * 0.56 * p.hp) / full, 4);
      }
      ctx.globalAlpha = 1;
    }

    // 子弹
    for (const s of shots) {
      const x = px(s.x);
      const y = laneCenterY(s.lane) - cell * (s.proj === "bubble" ? 0.08 : 0.2);
      // 1.3:出膛小拖尾(两粒渐淡的残影)
      const trailColor =
        s.proj === "star" ? "255,216,104" : s.proj === "puff" ? "255,208,232" : "160,220,255";
      for (let k = 1; k <= 2; k++) {
        ctx.fillStyle = `rgba(${trailColor},${(0.3 / k).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x - k * cell * 0.14, y, cell * (0.09 / k) + 1, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.proj === "bubble") {
        ctx.fillStyle = "rgba(160,220,255,0.85)";
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(x - cell * 0.04, y - cell * 0.04, cell * 0.04, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.proj === "ice") {
        ctx.strokeStyle = "#9fd8f5";
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * i) / 3 + s.x * 3;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * cell * 0.12, y - Math.sin(a) * cell * 0.12);
          ctx.lineTo(x + Math.cos(a) * cell * 0.12, y + Math.sin(a) * cell * 0.12);
          ctx.stroke();
        }
      } else if (s.proj === "puff") {
        // r2(B档TOP8):蓬蓬花的花粉弹不再落进星形分支——三瓣小圆云才像一团花粉
        ctx.fillStyle = "rgba(255,208,232,.9)";
        ctx.beginPath();
        ctx.ellipse(x, y - cell * 0.03, cell * 0.1, cell * 0.08, 0, 0, Math.PI * 2);
        ctx.ellipse(x - cell * 0.09, y + cell * 0.04, cell * 0.07, cell * 0.06, 0, 0, Math.PI * 2);
        ctx.ellipse(x + cell * 0.09, y + cell * 0.04, cell * 0.07, cell * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // r2(B档TOP8):星弹从平涂换金渐变 + 深金描边,与 drawClearStar 金星三色同族
        const rGrad = ctx.createRadialGradient(
          x - cell * 0.042,
          y - cell * 0.042,
          cell * 0.028,
          x,
          y,
          cell * 0.14,
        );
        rGrad.addColorStop(0, "#ffe9a0");
        rGrad.addColorStop(1, "#f0b429");
        ctx.fillStyle = rGrad;
        ctx.strokeStyle = "#c9861b";
        ctx.lineWidth = Math.max(1, cell * 0.02);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * i) / 5 - Math.PI / 2 + s.x * 2;
          const rr = i % 2 === 0 ? cell * 0.14 : cell * 0.06;
          const sx = x + Math.cos(a) * rr;
          const sy = y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    for (const bug of bugs) drawBug(bug);

    for (const s of sparkles) {
      ctx.globalAlpha = Math.max(0, s.life / 0.6);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 20px sans-serif" : "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // 1.1 昼夜循环:黑夜给全场罩一层柔柔的夜色
    if (cycleNight) {
      ctx.fillStyle = "rgba(30,34,80,0.24)";
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    ctx.restore();

    // ---- 顶部:资源与波次独占一行(字号 ≥ 14px),下面才是横滑的苗卡片条 ----
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(0, 0, w, TOOLBAR_H);
    ctx.font = `bold ${HUD_FONT_MIN}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const capNow = dewCapNow();
    const hudY = HUD_ROW_H / 2 + 2;
    const dewColor = dewFlash > 0 && Math.floor(dewFlash * 8) % 2 === 0 ? "#e05a7a" : "#3f6b4a";
    // 资源行:水滴/太阳是绘制图标,不再是 💧/☀️ 字符
    let hudX = 8;
    if (isPuzzle() || isConveyor()) {
      const label = isPuzzle() ? "解谜 · 固定苗阵" : "传送带发苗";
      if (isConveyor()) {
        drawKitIcon(ctx, "cart", hudX + 8, hudY, 8);
        hudX += 20;
      }
      ctx.fillStyle = dewColor;
      ctx.textAlign = "left";
      ctx.fillText(label, hudX, hudY);
      hudX += ctx.measureText(label).width + 12;
    } else {
      const dewText = Number.isFinite(capNow) ? `${dew}/${capNow}` : `${dew}`;
      drawKitIcon(ctx, "drop", hudX + 7, hudY, 7);
      ctx.fillStyle = dewColor;
      ctx.textAlign = "left";
      ctx.fillText(dewText, hudX + 17, hudY);
      hudX += 17 + ctx.measureText(dewText).width + 12;
      if (unlockedPlants.includes("sunbud")) {
        drawKitIcon(ctx, "sun", hudX + 7, hudY, 7);
        ctx.fillStyle = "#a06a14";
        ctx.textAlign = "left";
        ctx.fillText(`${sun}`, hudX + 17, hudY);
        hudX += 17 + ctx.measureText(`${sun}`).width + 12;
      }
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#5a5a6e";
    if (mode === "endless") {
      const rt = `第${Math.max(1, endlessWaveNo)}波 · 最好${endlessBest}`;
      drawKitIcon(ctx, "moon", w - 8 - ctx.measureText(rt).width - 12, hudY, 7);
      ctx.fillStyle = "#5a5a6e";
      ctx.textAlign = "right";
      ctx.fillText(rt, w - 8, hudY);
    } else if (isBlitz() && timeLimit > 0) {
      const left = Math.max(0, Math.ceil(timeLimit - time));
      ctx.fillStyle = left <= 10 ? "#c0392b" : "#5a5a6e";
      ctx.fillText(`倒计时 ${left}s · 波${Math.max(1, currentWave + 1)}/${level().waves.length}`, w - 8, hudY);
    } else {
      ctx.fillText(
        `${levelLabel()} 波${Math.max(1, currentWave + 1)}/${level().waves.length}`,
        w - 8,
        hudY,
      );
    }

    // 苗卡片条:一行横滑,卡片 ≥ 48px 宽,冷却时转一圈灰色扇形
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_ROW_H, w, CARD_H + 8);
    ctx.clip();
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const r = cardRect(i);
      if (r.x > w || r.x + r.w < 0) continue;
      const cdLeft = tool === "shovel" ? 0 : cardCooldownLeft(tool);
      const afford = tool === "shovel" || (affordablePlant(tool) && cdLeft <= 0);
      ctx.fillStyle = selected === tool ? "#fff1c9" : "#f3f3f7";
      ctx.strokeStyle = selected === tool ? "#ffb84d" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = afford ? 1 : 0.45;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cardIconR = Math.min(13, r.w * 0.3);
      if (tool === "shovel") {
        drawShovelIcon(r.x + r.w / 2, r.y + r.h * 0.36, cardIconR);
        ctx.fillStyle = "#5a5a6e";
        ctx.font = `bold ${HUD_FONT_MIN}px sans-serif`;
        ctx.fillText("铲子", r.x + r.w / 2, r.y + r.h - 12, r.w - 4);
      } else {
        plantIcon(r.x + r.w / 2, r.y + r.h * 0.36, cardIconR, tool);
        ctx.font = `bold ${HUD_FONT_MIN}px sans-serif`;
        const left = suppliesLeft(tool);
        if (Number.isFinite(left)) {
          ctx.fillStyle = afford ? "#5a5a6e" : "#8a8a9a";
          ctx.fillText(`×${left}`, r.x + r.w / 2, r.y + r.h - 12, r.w - 4);
        } else {
          // 造价行:水滴/太阳小图标 + 数字(替代 💧/☀️ 字符)
          drawCostRow(r.x + r.w / 2, r.y + r.h - 12, PLANT_INFO[tool].cost, PLANT_SPEC[tool].sun, !afford);
        }
      }
      ctx.globalAlpha = 1;
      // 冷却圈:灰扇形从满转到空,转完这张卡就又能种了
      if (cdLeft > 0 && tool !== "shovel") {
        const total = PLANT_SPEC[tool].cooldown;
        ctx.fillStyle = "rgba(90,90,110,0.32)";
        ctx.beginPath();
        ctx.moveTo(r.x + r.w / 2, r.y + r.h * 0.36);
        ctx.arc(
          r.x + r.w / 2,
          r.y + r.h * 0.36,
          r.w * 0.42,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * (cdLeft / Math.max(0.01, total)),
        );
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    if (cardStrip.maxScroll > 0) {
      // 横滑提示:底部一条小滑轨,告诉小朋友卡片还能往旁边拨
      const trackW = w - 24;
      const knobW = Math.max(28, (trackW * w) / cardStrip.contentW);
      const t = cardStrip.maxScroll > 0 ? stripScroll / cardStrip.maxScroll : 0;
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.roundRect(12, TOOLBAR_H - 6, trackW, 4, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(90,168,120,0.7)";
      ctx.beginPath();
      ctx.roundRect(12 + (trackW - knobW) * t, TOOLBAR_H - 6, knobW, 4, 2);
      ctx.fill();
    }

    // 回地图按钮(叠在工具栏下方左侧)
    btnBack = { x: 6, y: TOOLBAR_H + 4, w: 62, h: 28 };
    drawButton(btnBack, "◀ 地图", "rgba(255,255,255,0.85)", "#5a5a6e");

    // 「正在种什么」提示条:选中的工具一目了然;种不下时改成告诉你为什么
    if (phase === "play") {
      const label =
        blockTipLife > 0
          ? blockTip
          : selected === "shovel"
            ? "铲子:点两下同一格才铲,退回一半露珠"
            : `正在种:${PLANT_INFO[selected].name} · 点闪亮绿格种下`;
      // 提示条文字 12→14px:两段式(先点卡再点格子)的关键引导,要看得清
      ctx.font = "bold 14px sans-serif";
      const tw = ctx.measureText(label).width;
      const chip: Rect = { x: 74, y: TOOLBAR_H + 4, w: Math.min(w - 80, tw + 34), h: 28 };
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.strokeStyle = "rgba(90,168,120,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(chip.x, chip.y, chip.w, chip.h, 14);
      ctx.fill();
      ctx.stroke();
      if (selected !== "shovel") {
        plantIcon(chip.x + 15, chip.y + 14, 9, selected);
      } else {
        drawShovelIcon(chip.x + 15, chip.y + 14, 9);
      }
      ctx.fillStyle = blockTipLife > 0 ? "#a05914" : "#4a7a5a";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, chip.x + 28, chip.y + 15, chip.w - 34);
    }

    // 1.2 预警角标:每种机制出场前 3 秒就在那条道右边亮起来,不许突然袭击
    if (phase === "play") {
      const live = activeWarnings(warnings, time);
      const shown = new Set<string>();
      for (const wn of live) {
        const k = `${wn.lane}|${wn.trait}`;
        if (shown.has(k)) continue;
        shown.add(k);
        const info = TRAIT_INFO[wn.trait];
        const blink = 0.6 + 0.4 * Math.abs(Math.sin(time * 5));
        const bx = Math.min(w - 8, px(PLANT_COLS + 0.35));
        const by = laneCenterY(wn.lane) - laneH * 0.28;
        ctx.font = `bold ${HUD_FONT_MIN}px sans-serif`;
        // 机制小图标改绘制:盾 / 弹簧 / 土洞 / 翅膀 / 问号
        const traitIcon: IconKind =
          wn.trait === "shield" ? "shield" : wn.trait === "jump" ? "spring" : wn.trait === "dig" ? "hole" : wn.trait === "fly" ? "wing" : "question";
        const bw3 = ctx.measureText(info.label).width + 32;
        ctx.globalAlpha = blink;
        ctx.fillStyle = "rgba(255,244,220,0.95)";
        ctx.strokeStyle = "#e0a030";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx - bw3, by - 12, bw3, 24, 12);
        ctx.fill();
        ctx.stroke();
        drawKitIcon(ctx, traitIcon, bx - bw3 + 14, by + 1, 7);
        ctx.fillStyle = "#a05914";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(info.label, bx - bw3 + 25, by + 1);
        ctx.globalAlpha = 1;
      }
    }

    // 1.2 传送关:传送带队列条,来什么用什么
    if (isConveyor() && phase === "play") {
      const qh = 34;
      const qy = h - qh - 6;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "rgba(90,168,120,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(6, qy, w - 12, qh, 12);
      ctx.fill();
      ctx.stroke();
      // 小推车图标替代 🚚 字符
      drawKitIcon(ctx, "cart", 22, qy + qh / 2, 9);
      ctx.fillStyle = "#4a7a5a";
      ctx.font = `bold ${HUD_FONT_MIN}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("传送带", 36, qy + qh / 2);
      for (let i = 0; i < beltQueue.length; i++) {
        const cx2 = 96 + i * 34;
        if (cx2 > w - 20) break;
        ctx.fillStyle = i === 0 ? "#fff1c9" : "#f3f3f7";
        ctx.beginPath();
        ctx.roundRect(cx2 - 14, qy + 4, 28, qh - 8, 8);
        ctx.fill();
        plantIcon(cx2, qy + qh / 2, 10, beltQueue[i]);
      }
    }

    // 1.2 无尽:天色进度条,「守到天亮」看得见
    if (mode === "endless" && phase === "play") {
      const dawn = Math.min(1, Math.max(0, (endlessWaveNo - 1) / (ENDLESS_DAWN_WAVE - 1)));
      const bw4 = Math.min(280, w - 40);
      const bx2 = (w - bw4) / 2;
      const by2 = h - 30;
      ctx.fillStyle = "rgba(40,44,88,0.75)";
      ctx.beginPath();
      ctx.roundRect(bx2, by2, bw4, 16, 8);
      ctx.fill();
      const g2 = ctx.createLinearGradient(bx2, 0, bx2 + bw4, 0);
      g2.addColorStop(0, "#6a7ac9");
      g2.addColorStop(1, "#ffd27a");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.roundRect(bx2, by2, Math.max(6, bw4 * dawn), 16, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${HUD_FONT_MIN}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(endlessSkyLine(endlessWaveNo), w / 2, by2 - 12);
    }

    // 1.1 昼夜钟:循环关显示当前时段和还剩几秒(挂在提示条下面一行,窄屏不挤)
    if (def.cycle && phase === "play" && mode === "campaign") {
      const period = def.cycle.day + def.cycle.night;
      const t = ((time % period) + period) % period;
      const remain = Math.ceil(cycleNight ? period - t : def.cycle.day - t);
      // 月牙/太阳小图标 + 文字,不再用 🌙/☀️ 字符
      const label = cycleNight ? `黑夜 ${remain}s` : `白天 ${remain}s`;
      ctx.font = "bold 13px sans-serif";
      const tw2 = ctx.measureText(label).width;
      const chip2: Rect = { x: 6, y: TOOLBAR_H + 36, w: tw2 + 36, h: 24 };
      ctx.fillStyle = cycleNight ? "rgba(62,68,104,0.88)" : "rgba(255,255,255,0.88)";
      ctx.strokeStyle = cycleNight ? "rgba(185,166,232,0.7)" : "rgba(224,160,48,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(chip2.x, chip2.y, chip2.w, chip2.h, 12);
      ctx.fill();
      ctx.stroke();
      drawKitIcon(ctx, cycleNight ? "moon" : "sun", chip2.x + 14, chip2.y + 12, 7);
      ctx.fillStyle = cycleNight ? "#e0e0f5" : "#a06a14";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, chip2.x + 26, chip2.y + 13);
    }

    // 波次横幅
    if (waveBanner > 0 && phase === "play") {
      ctx.globalAlpha = Math.min(1, waveBanner);
      ctx.fillStyle = bannerFlag ? "rgba(255,225,225,0.92)" : "rgba(255,255,255,0.85)";
      ctx.fillRect(0, h / 2 - 28, w, 56);
      if (bannerFlag) {
        // 小旗子是绘制的,不再是 🚩 字符
        iconTextCenter(w / 2, h / 2, "flag", "旗帜大波!!超多虫虫!", "bold 26px sans-serif", "#e05a7a", 14);
      } else {
        ctx.fillStyle = "#e05a7a";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`第 ${currentWave + 1} 波虫虫来啦!`, w / 2, h / 2);
      }
      ctx.globalAlpha = 1;
    }

    refreshSkip();

    // ---- 覆盖层 ----
    if (phase === "intro") {
      drawIntroPanel();
      drawButton(btnBack, mode === "endless" ? "◀ 花园" : "◀ 地图", "#f0f0f5", "#5a5a6e");
    } else if (phase === "clear") {
      drawClearPanel();
    } else if (phase === "retry") {
      drawRetryPanel();
    }
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

  /* ---------------- 1.2 平台接线 ---------------- */

  /** 平台直达第 N 关(1 基)。锁着的关也允许直达 —— 家长/平台点进来就是要打这关。 */
  function openCampaignLevel(n: number): number {
    const idx = Math.min(LEVELS.length - 1, Math.max(0, Math.round(n) - 1));
    stopSpeaking();
    loadLevel(idx);
    return idx + 1;
  }

  // 跳关:壳层没注册 requestSkip 就不挂按钮(单测环境保持干净)。
  // 授权通过 = 本关记 0 星但放行下一关,战役星数一颗不送。
  const skipped = new Set<number>();
  const skipBtn = document.createElement("button");
  let skipBusy = false;
  function refreshSkip(): void {
    const request = getLevelExtras().requestSkip;
    const usable =
      !!request && mode === "campaign" && (phase === "play" || phase === "intro" || phase === "retry");
    skipBtn.style.display = usable ? "" : "none";
    if (!usable) return;
    skipBtn.textContent = `跳过 第${levelIdx + 1}关`;
    skipBtn.disabled = skipBusy || levelIdx >= LEVELS.length - 1;
  }
  function onSkip(): void {
    const request = getLevelExtras().requestSkip;
    if (!request || skipBusy || mode !== "campaign") return;
    api.play("tap");
    skipBusy = true;
    refreshSkip();
    const from = levelIdx;
    Promise.resolve(request("sprout-defense", from))
      .then((ok) => {
        if (destroyed) return;
        skipBusy = false;
        if (!ok) return;
        skipped.add(from);
        stopSpeaking();
        if (from < LEVELS.length - 1) loadLevel(from + 1);
      })
      .catch(() => {
        if (destroyed) return;
        skipBusy = false;
      });
  }
  skipBtn.type = "button";
  skipBtn.className = "spd-skip";
  skipBtn.style.display = "none";
  skipBtn.addEventListener("click", onSkip);
  wrap.appendChild(skipBtn);

  function unlockedFor(idx: number): boolean {
    // 管理员权限(kangkang 密码)开着时全关可进;关着/过期回落到星级/跳关解锁
    return unlockedWithRoot(isRootOpen(), isLevelUnlocked(progress, idx) || skipped.has(idx - 1));
  }

  /** 章节口径与关卡一致:root 开则全开 */
  function themeOpenFor(ci: number): boolean {
    return unlockedWithRoot(isRootOpen(), isThemeUnlocked(progress, ci));
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // 平台直达:api.initialLevel 优先,没有就看地址栏 ?level=
  const want = api.initialLevel ?? levelFromQuery();
  if (want != null && want >= 1) openCampaignLevel(want);

  syncSize();
  raf = requestAnimationFrame(frame);

  return {
    openCampaignLevel,
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      stopSpeaking();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      skipBtn.removeEventListener("click", onSkip);
      // 局内状态一律归零,免得下一次 mount 捡到上一局的虫
      plants.clear();
      lilies.clear();
      cardCd.clear();
      stock.clear();
      bugs.length = 0;
      shots.length = 0;
      sparkles.length = 0;
      floats.length = 0;
      schedule = [];
      warnings = [];
      belt = [];
      beltQueue = [];
      strip = null;
      shovelPending = null;
      mapNodes.length = 0;
      themeCards.length = 0;
      time = 0;
      dew = 0;
      sun = 0;
      phase = "themes";
      wrap.remove();
    },
  };
}
