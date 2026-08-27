import { meta } from "./meta";
export { meta };

// 水果切切乐:188 回合十二果园经典战役 + 禅宗无炸弹限时 + 街机无尽!
// 先选果园再选回合;侧风、低重力、急坠、小果大瓜,每个果园手感都不一样!
// 1.1 的后三个果园还加了连刀、指令果、硬壳果、镜像模式和三位果王。
import {
  BEST_KEY,
  BIG_BOMB_HEARTS,
  BOOM_RADIUS,
  BestScores,
  COMBO_WINDOW,
  COMMAND_CLEAR_BONUS,
  FRENZY_MULTIPLIER,
  FRENZY_SECONDS,
  FruitKingId,
  FruitKingSpec,
  HEARTS_PER_ROUND,
  ICE_SECONDS,
  ICE_SLOW,
  KING_INFO,
  MIRROR_PERIOD,
  ORCHARD_ORDER,
  ORCHARD_STYLE,
  OrchardStyle,
  PROGRESS_KEY,
  ROUNDS,
  SHELL_SCORE,
  SPECIAL_CHANCE,
  SpecialKind,
  ZEN_SECONDS,
  arcadePace,
  arcadeStars,
  chainGain,
  chainLabel,
  clearSpeechLine,
  comboBonus,
  comboLabel,
  commandCheck,
  commandLabel,
  commandResetNeed,
  commandSequence,
  commandStepScore,
  endSpeechLine,
  gravityFor,
  isLevelUnlocked,
  isThemeUnlocked,
  kingDown,
  kingShowMult,
  makeLaunch,
  mapLayout,
  mirrorOn,
  mirrorX,
  parseBest,
  parseProgress,
  retrySpeechLine,
  roundIsCleared,
  segCircleHit,
  serializeBest,
  serializeProgress,
  shellBounce,
  shellCracked,
  starsForRound,
  themeCleared,
  themeIndexOf,
  themeSize,
  themeStars,
  themeStart,
  totalStars,
  zenStars,
} from "./logic";
import {
  BLADE_WINDOW,
  BladeBag,
  CHILL_SECONDS,
  DOUBLE_SECONDS,
  EXTRA_SPEC,
  ExtraKind,
  FLOWER_COST,
  STORM_MISS_LIMIT,
  STORM_MISTAKE_LIMIT,
  bladeLabel,
  bladeScore,
  bladeWindowAlive,
  doubleScore,
  extraChance,
  extrasForRound,
  flowerLine,
  isRainbowBlade,
  safeLaunch,
  stormLine,
  stormOver,
  stormStars,
  stormWave,
  strokeBonus,
  sweptHit,
  swipeCounts,
  twinCracked,
  twinStepScore,
} from "./blade";
import { save } from "../../engine/save";
import { speak, stopSpeaking } from "../speech";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

type Mode = "classic" | "zen" | "arcade" | "storm";
type Phase = "menu" | "themes" | "map" | "intro" | "play" | "clear" | "retry" | "end";

interface FruitKind {
  name: string;
  skin: string;
  flesh: string;
  r: number;
}

const FRUITS: FruitKind[] = [
  { name: "桃桃", skin: "#ffb3c1", flesh: "#fff0f3", r: 30 },
  { name: "橙橙", skin: "#ffc46b", flesh: "#ffe8c2", r: 28 },
  { name: "瓜瓜", skin: "#8fd47a", flesh: "#ff8fa3", r: 36 },
  { name: "莓莓", skin: "#91a7ff", flesh: "#e0e7ff", r: 22 },
  { name: "柠柠", skin: "#ffe66b", flesh: "#fff9d6", r: 26 },
];

/** 硬壳果切开后的果肉配色(1.1)。 */
const SHELL_FRUIT: FruitKind = { name: "壳壳", skin: "#c9a06a", flesh: "#fff0d0", r: 32 };
/** 指令果切开后的果肉配色(1.1)。 */
const CMD_FRUIT: FruitKind = { name: "令令", skin: "#c9a6f2", flesh: "#f3e6ff", r: 30 };
/** 双倍果切开后的果肉配色(1.2)。 */
const DOUBLE_FRUIT: FruitKind = { name: "亮亮", skin: "#ffd85a", flesh: "#fff6c8", r: 28 };
/** 连体果切开后的果肉配色(1.2)。 */
const TWIN_FRUIT: FruitKind = { name: "双双", skin: "#ff8fa8", flesh: "#ffe0e8", r: 30 };

type FlyKind =
  | "fruit"
  | "bomb"
  | "bigbomb"
  | "banana"
  | "ice"
  | "boom"
  | "shell"
  | "command"
  // 1.2 新目标:双倍果 / 小花朵(不能切)/ 连体果(要切两刀)
  | "double"
  | "flower"
  | "twin";

interface Flying {
  fly: FlyKind;
  kind: FruitKind | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
  /** 硬壳果已经挨了几刀 */
  hits?: number;
  /** 指令果的号码牌 */
  num?: number;
  /** 指令果属于第几组(切错了只重数当前这组) */
  group?: number;
}

/** 本回合开着哪些 1.1 机制(禅宗/街机一律不开)。 */
interface RoundMech {
  chain: boolean;
  command: number;
  shellChance: number;
  mirror: boolean;
  mirrorPeriod: number;
  king?: FruitKingId;
}

const NO_MECH: RoundMech = {
  chain: false,
  command: 0,
  shellChance: 0,
  mirror: false,
  mirrorPeriod: MIRROR_PERIOD,
};

/** 果王:定时探头出来,砍够刀数才倒。 */
interface King {
  spec: FruitKingSpec;
  hits: number;
  x: number;
  y: number;
  /** 现身中还是躲起来了 */
  out: boolean;
  /** 当前状态还剩几秒 */
  timer: number;
  /** 左右巡游的相位 */
  phase: number;
  /** 倒下之后的谢幕计时 */
  downTimer: number;
}

interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
  skin: string;
  flesh: string;
  /** 水果名,决定切面细节(瓜籽/橙瓣/桃核…) */
  name: string;
  life: number;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

interface Splash {
  x: number;
  y: number;
  life: number;
  color: string;
}

interface Ring {
  x: number;
  y: number;
  life: number;
  maxR: number;
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
    return parseProgress(localStorage.getItem(PROGRESS_KEY), ROUNDS.length);
  } catch {
    return parseProgress(null, ROUNDS.length);
  }
}

function saveProgress(stars: number[]): void {
  try {
    localStorage.setItem(PROGRESS_KEY, serializeProgress(stars));
  } catch {
    // 静默失败
  }
}

function loadBest(): BestScores {
  try {
    return parseBest(localStorage.getItem(BEST_KEY));
  } catch {
    return parseBest(null);
  }
}

function saveBest(best: BestScores): void {
  try {
    localStorage.setItem(BEST_KEY, serializeBest(best));
  } catch {
    // 静默失败
  }
}

export function mount(api: GameAPI): { destroy: () => void } {
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
  const best = loadBest();

  // ---- 局状态 ----
  let mode: Mode = "classic";
  let phase: Phase = "menu";
  let chapterIdx = 0;
  let roundIdx = 0;
  let roundScore = 0;
  let totalScore = 0;
  let roundTime = 0;
  let hearts = HEARTS_PER_ROUND;
  let heartsLost = 0;
  let bestCombo = 0;
  let earnedStars: 1 | 2 | 3 = 1;
  let endStars: 0 | 1 | 2 | 3 = 0;
  let finaleFired = false;
  let destroyed = false;

  const flying: Flying[] = [];
  const halves: Half[] = [];
  const trail: TrailPoint[] = [];
  const splashes: Splash[] = [];
  const rings: Ring[] = [];
  const floats: Floaty[] = [];

  /**
   * 系统开了「减弱动态效果」。
   * 切水果整块是 canvas,动效全在帧循环里用 JS 画,没有 CSS 动画可以挂 `@media`,
   * 所以这里自己读一次媒体查询,把**纯装饰**的那几样压下去:
   * 刀光拖尾短一截、迸溅和光圈几乎立刻收、飘分不再往上飘、彩虹刀不再刷色相。
   * 水果的抛物线、判定、计时一概不动——那是玩法,不是动效。
   */
  const reducedMotion = typeof matchMedia === "function"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** 装饰性残留的消退倍速:减弱动效时收得快得多 */
  const FX_FADE = reducedMotion ? 5 : 1;

  /** 刀光拖尾留几帧、留多久 */
  const TRAIL_MAX = reducedMotion ? 5 : 16;
  const TRAIL_SEC = reducedMotion ? 0.06 : 0.18;

  let time = 0;
  let launchTimer = 0.8;
  let slicing = false;
  let lastX = 0;
  let lastY = 0;
  let shake = 0;
  let hitStop = 0;
  let frenzyTimer = 0;
  let frenzyLaunch = 0;
  let freezeTimer = 0;

  // 连击窗口
  let comboCount = 0;
  let comboClock = 0;
  let comboX = 0;
  let comboY = 0;

  // ---- 1.1 新机制 ----
  /** 连刀:一刀(按下到抬起)之内已经切到几颗 */
  let strokeCount = 0;
  let strokeX = 0;
  let strokeY = 0;
  /** 指令果:当前这组还差几号、一共几号、组号 */
  let cmdNeed = 1;
  let cmdTotal = 0;
  let cmdGroup = 0;
  let cmdTimer = 0;
  /** 镜像:这一帧翻没翻 */
  let mirrored = false;
  let mirrorFlash = 0;
  /** 果王额外掀的那一下,和周期翻转叠加 */
  let mirrorInvert = false;
  /** 果王 */
  let king: King | null = null;

  // ---- 1.2 新机制 ----
  /** 上一帧的时长:扫掠判定要用它把水果往回推 */
  let lastDt = 1 / 60;
  /** 这一刀到现在划了多长(像素);不够 MIN_SWIPE 之前不吃判定 */
  let strokeLen = 0;
  /** 连击串数(800ms 窗口内可累计,倍率封顶) */
  let bladeStreak = 0;
  let bladeClock = 0;
  /** 双倍果剩余秒数 */
  let doubleTimer = 0;
  /** 水果暴风:第几波、这一局的种子、漏了几个、切错几次 */
  let stormN = 0;
  let stormSeed = 1;
  let stormMissed = 0;
  let stormMistakes = 0;
  let stormBest = save.getGameProgress(meta.id).endlessBest;
  /** 上一刀是什么时候收的(算连击窗口用) */
  let lastStrokeAt = -99;
  /** 彩虹刀余辉:刀光整条变彩虹的剩余秒数 */
  let rainbowBlade = 0;
  /** 结束面板要显示的鼓励语(暴风用) */
  let endMsg = "";

  const menuRects: Array<{ mode: Mode; rect: Rect }> = [];
  const themeCards: Array<{ idx: number; rect: Rect }> = [];
  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnMenu: Rect | null = null;
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };

  function round() {
    return ROUNDS[Math.min(roundIdx, ROUNDS.length - 1)];
  }

  const NEUTRAL_STYLE: OrchardStyle = ORCHARD_STYLE.sunny;

  /** 经典模式用当前回合所在果园的手感;禅宗/街机用阳光果园的中性手感。 */
  function orchardStyle(): OrchardStyle {
    return mode === "classic" ? ORCHARD_STYLE[round().orchard] : NEUTRAL_STYLE;
  }

  /** 星夜/火山是深色背景,文字要换成浅色。 */
  function isDarkOrchard(ci: number): boolean {
    const id = ORCHARD_ORDER[ci];
    return id === "night" || id === "volcano";
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.2 : 0.85, big });
  }

  /** 本回合开着的新机制(只有经典模式的新果园才有)。 */
  function mech(): RoundMech {
    if (mode !== "classic") return NO_MECH;
    const r = round();
    return {
      chain: !!r.chain,
      command: r.command ?? 0,
      shellChance: r.shellChance ?? 0,
      mirror: !!r.mirror,
      mirrorPeriod: r.mirrorPeriod ?? MIRROR_PERIOD,
      king: r.king,
    };
  }

  function resetRound(): void {
    if (mode === "classic") chapterIdx = themeIndexOf(roundIdx);
    flying.length = 0;
    halves.length = 0;
    splashes.length = 0;
    rings.length = 0;
    roundScore = 0;
    totalScore = mode === "classic" ? totalScore : 0;
    roundTime = mode === "classic" ? round().time : mode === "zen" ? ZEN_SECONDS : 0;
    hearts = HEARTS_PER_ROUND;
    heartsLost = 0;
    launchTimer = 0.8;
    frenzyTimer = 0;
    freezeTimer = 0;
    comboCount = 0;
    comboClock = 0;
    strokeCount = 0;
    cmdNeed = 1;
    cmdTotal = 0;
    cmdGroup = 0;
    cmdTimer = 2.5;
    mirrored = false;
    mirrorFlash = 0;
    mirrorInvert = false;
    strokeLen = 0;
    bladeStreak = 0;
    bladeClock = 0;
    doubleTimer = 0;
    stormN = 0;
    stormMissed = 0;
    stormMistakes = 0;
    if (mode === "storm") stormSeed = Math.floor(Math.random() * 1e6) + 1;
    const m = mech();
    king = m.king
      ? {
          spec: KING_INFO[m.king],
          hits: 0,
          x: w / 2,
          y: h * 0.3,
          out: false,
          timer: 2.2,
          phase: 0,
          downTimer: 0,
        }
      : null;
  }

  function startMode(m: Mode): void {
    mode = m;
    roundIdx = 0;
    totalScore = 0;
    bestCombo = 0;
    time = 0;
    if (m === "classic") {
      phase = "themes";
    } else {
      resetRound();
      phase = "intro";
    }
  }

  function roundCleared(): void {
    settleCombo();
    earnedStars = starsForRound(heartsLost);
    const prev = progress[roundIdx] ?? 0;
    const gained = Math.max(0, earnedStars - prev);
    progress[roundIdx] = Math.max(prev, earnedStars);
    saveProgress(progress);
    phase = "clear";
    api.play("win");
    if (roundIdx >= ROUNDS.length - 1 && !finaleFired) {
      finaleFired = true;
      api.onWin(
        earnedStars,
        `${ROUNDS.length} 回合十二座果园全通关,大果王也倒下了!最高 ${bestCombo} 连切 · 总星 ${totalStars(progress)}/${ROUNDS.length * 3}`,
      );
    } else {
      // 结算面板自动朗读(终局走平台弹窗,那边自带朗读,不叠音)
      speak(clearSpeechLine(round().name, earnedStars, bestCombo));
      if (gained > 0) {
        api.addStars(gained);
        addFloat(w / 2, h / 2 - 110, `+${gained} ⭐`, "#e0a030", true);
      }
    }
  }

  function endFreeMode(): void {
    settleCombo();
    phase = "end";
    if (mode === "storm") {
      endStars = stormStars(totalScore);
      const prevBest = stormBest;
      const gained = Math.max(0, endStars - stormStars(prevBest));
      stormBest = save.recordEndlessBest(meta.id, totalScore);
      endMsg = stormLine(totalScore, prevBest);
      if (gained > 0) {
        api.addStars(gained);
        addFloat(w / 2, h / 2 - 120, `+${gained} ⭐`, "#e0a030", true);
      }
      api.play(endStars > 0 ? "win" : "oops");
      speak(endMsg);
      return;
    }
    endStars = mode === "zen" ? zenStars(totalScore) : arcadeStars(totalScore);
    const prevBest = mode === "zen" ? best.zen : best.arcade;
    const prevStars = mode === "zen" ? zenStars(prevBest) : arcadeStars(prevBest);
    const gained = Math.max(0, endStars - prevStars);
    if (mode === "zen") best.zen = Math.max(best.zen, totalScore);
    else best.arcade = Math.max(best.arcade, totalScore);
    saveBest(best);
    if (gained > 0) {
      api.addStars(gained);
      addFloat(w / 2, h / 2 - 120, `+${gained} ⭐`, "#e0a030", true);
    }
    api.play(endStars > 0 ? "win" : "oops");
    // 结束面板自动朗读:破纪录大声夸
    speak(endSpeechLine(mode === "zen", totalScore, totalScore > prevBest));
  }

  function roundFail(): void {
    settleCombo();
    if (mode === "classic") {
      phase = "retry";
      api.play("oops");
      speak(retrySpeechLine());
    } else {
      endFreeMode();
    }
  }

  // ---- 抛射 ----
  function radiusFor(fly: FlyKind): number {
    if (fly === "bigbomb") return 38;
    if (fly === "banana") return 30;
    if (fly === "shell") return 32;
    if (fly === "command") return 30;
    // 1.2 新目标都按 ≥44px 直径来,手指按得住
    if (fly === "twin") return 30;
    if (fly === "double") return 26;
    if (fly === "flower") return 24;
    return 26;
  }

  /** 本局的实际重力(果园手感会改它),抛物线与模拟共用同一个值 */
  function gravityNow(): number {
    return gravityFor(h) * orchardStyle().gravityMult;
  }

  function launchOne(fly: FlyKind): void {
    const st = orchardStyle();
    // 1.2:先挑好顶点落在可视区哪一点,再倒算初速度,不会再有「飞出屏幕根本切不到」的果子
    const r = radiusFor(fly);
    const g = gravityNow();
    const arc = safeLaunch(w, h, Math.random(), Math.random(), Math.random(), g, r);
    // 侧风会额外推着果子跑,先从初速里扣掉,顶点才落在算好的位置上
    const vx = arc.vx - st.wind;
    if (fly === "fruit") {
      const kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      flying.push({
        fly,
        kind,
        x: arc.x,
        y: arc.y,
        vx,
        vy: arc.vy,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 4,
        r: kind.r * st.fruitScale,
      });
    } else {
      flying.push({
        fly,
        kind: null,
        x: arc.x,
        y: arc.y,
        vx,
        vy: arc.vy * (fly === "bigbomb" ? 0.92 : 1),
        rot: fly === "banana" ? Math.random() * Math.PI : 0,
        vrot: (Math.random() - 0.5) * (fly === "banana" ? 5 : 2),
        r,
        ...(fly === "shell" || fly === "twin" ? { hits: 0 } : {}),
      });
    }
  }

  /** 挂出一整组指令果:号码 1..n 一次全上,要按号码从小到大切。 */
  function launchCommandSet(count: number): void {
    const st = orchardStyle();
    const seq = commandSequence(count);
    cmdGroup++;
    cmdNeed = 1;
    cmdTotal = seq.length;
    const vyScale = Math.sqrt(st.gravityMult);
    for (const num of seq) {
      // 号码牌按左右铺开,给孩子留出「先找 1 再找 2」的扫视时间
      const spread = (num - (seq.length + 1) / 2) / Math.max(1, seq.length);
      const l = makeLaunch(w, h, 0.5 + spread * 0.7, 0.5, 0.35 + Math.random() * 0.2);
      flying.push({
        fly: "command",
        kind: null,
        x: l.x,
        y: l.y,
        vx: l.vx * 0.6,
        vy: l.vy * vyScale,
        rot: 0,
        vrot: 0,
        r: radiusFor("command"),
        num,
        group: cmdGroup,
      });
    }
    addFloat(w / 2, h * 0.24, `指令果 1→${seq.length},按号码切!`, "#6a2a9a", true);
  }

  function activeSpecials(): SpecialKind[] {
    if (mode === "classic") return round().specials;
    return ["banana", "ice", "boom"];
  }

  /** 1.2 的连刀倍率 / 新目标只在第 100 回合之后与水果暴风里生效,老回合手感原样保留 */
  function bladeOn(): boolean {
    return mode === "storm" || (mode === "classic" && roundIdx >= 99);
  }

  /** 这一波会混哪些 1.2 新目标 */
  function activeExtras(): ExtraKind[] {
    if (mode === "storm") return stormWave(stormN, stormSeed).extras;
    if (mode === "classic") return extrasForRound(roundIdx);
    return [];
  }

  function launchVolley(): void {
    const r = round();
    const m = mech();
    const storm = mode === "storm" ? stormWave(stormN, stormSeed) : null;
    const min = storm ? storm.count : mode === "classic" ? r.volleyMin : mode === "zen" ? 2 : 1;
    const max = storm ? storm.count : mode === "classic" ? r.volleyMax : mode === "zen" ? 4 : 3;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < n; i++) launchOne("fruit");
    if (mode !== "zen" && time > 4) {
      const bombChance = storm
        ? storm.bombChance
        : mode === "arcade"
          ? arcadePace(totalScore).bombChance
          : r.bombChance;
      const bigChance = storm
        ? Math.min(0.1, stormN / 90)
        : mode === "arcade"
          ? Math.min(0.1, totalScore / 1500)
          : r.bigBombChance;
      if (Math.random() < bigChance) launchOne("bigbomb");
      else if (Math.random() < bombChance) launchOne("bomb");
    }
    for (const sp of activeSpecials()) {
      if (Math.random() < SPECIAL_CHANCE) launchOne(sp);
    }
    // 1.2 新目标:双倍果 / 小花朵 / 连体果
    const extras = activeExtras();
    if (extras.length > 0) {
      const chance = mode === "storm" ? 0.34 : extraChance(roundIdx);
      if (Math.random() < chance) launchOne(extras[Math.floor(Math.random() * extras.length)]);
    }
    if (m.shellChance > 0 && Math.random() < m.shellChance) launchOne("shell");
    if (storm) stormN++;
    api.play("jump");
  }

  // ---- 连击结算 ----
  function settleCombo(): void {
    if (comboCount >= 2) {
      const bonus = comboBonus(comboCount);
      roundScore += bonus;
      totalScore += bonus;
      bestCombo = Math.max(bestCombo, comboCount);
      const label = comboLabel(comboCount);
      if (label) addFloat(comboX, comboY - 30, `${label} +${bonus}`, "#b28ae8", true);
      api.play("coin");
      if (comboCount >= 3) {
        hitStop = 0.28;
        shake = Math.min(0.35, 0.1 + comboCount * 0.05);
      }
    }
    comboCount = 0;
    comboClock = 0;
  }

  function checkClassicTarget(): boolean {
    if (mode !== "classic") return false;
    const hasKing = !!king;
    if (!roundIsCleared(roundScore, round().target, hasKing, !!king && kingDown(king.spec, king.hits)))
      return false;
    roundCleared();
    return true;
  }

  /** 果肉飞两半:切开的通用表现。 */
  function splitHalves(f: Flying, kind: FruitKind, angle: number): void {
    splashes.push({ x: f.x, y: f.y, life: 0.5, color: kind.flesh });
    for (const side of [-1, 1]) {
      halves.push({
        x: f.x,
        y: f.y,
        vx: f.vx + Math.cos(angle + (Math.PI / 2) * side) * 130,
        vy: f.vy * 0.3 + Math.sin(angle + (Math.PI / 2) * side) * 130 - 60,
        rot: angle,
        vrot: side * 3,
        r: f.r,
        skin: kind.skin,
        flesh: kind.flesh,
        name: kind.name,
        life: 1.2,
      });
    }
  }

  /**
   * 记一笔分,并把连击窗口续上。
   * 1.2:第 100 回合之后与水果暴风里,还要叠上双倍果与连击串倍率(倍率封顶)。
   * 返回真正入账的分数,浮字直接用它,免得屏幕上写的和账上记的对不上。
   */
  function scoreHit(x: number, y: number, gain: number): number {
    const paid = bladeOn() ? bladeScore(doubleScore(gain, doubleTimer > 0), bladeStreak) : gain;
    roundScore += paid;
    totalScore += paid;
    comboCount++;
    comboClock = COMBO_WINDOW;
    comboX = x;
    comboY = y;
    return paid;
  }

  function sliceFruit(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    const kind = f.kind as FruitKind;
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    // 连刀:一刀之内第 n 颗值 n 分(上限 CHAIN_MAX)
    strokeCount++;
    const chain = mech().chain ? chainGain(strokeCount) : 1;
    const gain = scoreHit(f.x, f.y, chain * mult);
    strokeX = f.x;
    strokeY = f.y;
    api.play("pop");
    addFloat(f.x, f.y - 10, chain > 1 ? `+${gain} ×${chain}` : `+${gain}`, "#c47a2a");
    splitHalves(f, kind, Math.atan2(y2 - y1, x2 - x1));
  }

  /** 硬壳果:第一刀弹开,第二刀才切得开。 */
  function sliceShell(f: Flying, x1: number, y1: number, x2: number, y2: number): boolean {
    const hits = (f.hits ?? 0) + 1;
    f.hits = hits;
    if (!shellCracked(hits)) {
      const b = shellBounce(f.vx, f.vy, x2 - x1, y2 - y1);
      f.vx = b.vx;
      f.vy = b.vy;
      f.vrot = (Math.random() - 0.5) * 8;
      api.play("tap");
      shake = Math.max(shake, 0.22);
      rings.push({ x: f.x, y: f.y, life: 0.4, maxR: 70, color: "#b08a5a" });
      addFloat(f.x, f.y - 22, "壳裂了!再补一刀", "#8a6a3e");
      return false;
    }
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    strokeCount++;
    const chain = mech().chain ? chainGain(strokeCount) : 1;
    const gain = scoreHit(f.x, f.y, SHELL_SCORE * chain * mult);
    strokeX = f.x;
    strokeY = f.y;
    api.play("coin");
    addFloat(f.x, f.y - 14, `硬壳开!+${gain}`, "#8a6a3e", true);
    splitHalves(f, SHELL_FRUIT, Math.atan2(y2 - y1, x2 - x1));
    return true;
  }

  /** 指令果:号码对了才加分,错了这一组从头数,不掉心。 */
  function sliceCommand(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    const num = f.num ?? 1;
    // 上一组还没切完就飞走了,新组的号码从 1 重新开始
    if (commandCheck(cmdNeed, num) === "wrong") {
      cmdNeed = commandResetNeed();
      api.play("tap");
      addFloat(f.x, f.y - 16, "顺序乱啦,从 1 重新数!", "#7a5ac9", true);
      splitHalves(f, CMD_FRUIT, Math.atan2(y2 - y1, x2 - x1));
      return;
    }
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    let base = commandStepScore(num) * mult;
    const last = num >= cmdTotal;
    if (last) base += COMMAND_CLEAR_BONUS * mult;
    const gain = scoreHit(f.x, f.y, base);
    api.play(last ? "win" : "coin");
    addFloat(
      f.x,
      f.y - 16,
      last ? `整组切完!+${gain}` : `${num} 号对!+${gain}`,
      "#6a2a9a",
      last,
    );
    splitHalves(f, CMD_FRUIT, Math.atan2(y2 - y1, x2 - x1));
    cmdNeed = last ? commandResetNeed() : num + 1;
    if (last) {
      cmdTotal = 0;
      cmdTimer = 2.6;
      rings.push({ x: f.x, y: f.y, life: 0.6, maxR: 170, color: "#c9a6f2" });
    }
  }

  /** 砍果王一刀。 */
  function sliceKing(k: King): void {
    k.hits++;
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    const gain = scoreHit(k.x, k.y, k.spec.hitScore * mult);
    shake = Math.max(shake, 0.45);
    api.play("coin");
    splashes.push({ x: k.x, y: k.y, life: 0.6, color: "#ffd0e0" });
    if (kingDown(k.spec, k.hits)) {
      const bonus = k.spec.downBonus * mult;
      roundScore += bonus;
      totalScore += bonus;
      k.out = false;
      k.downTimer = 2.2;
      shake = 0.8;
      api.play("win");
      addFloat(w / 2, h * 0.3, `${k.spec.name}倒下啦!+${bonus}`, "#c47a2a", true);
      rings.push({ x: k.x, y: k.y, life: 0.8, maxR: 260, color: "#ffd868" });
    } else {
      addFloat(k.x, k.y - k.spec.r * 0.8, `+${gain} 还剩 ${k.spec.hp - k.hits} 刀`, "#c47a2a", true);
    }
  }

  function sliceBomb(f: Flying, big: boolean): void {
    const lost = big ? BIG_BOMB_HEARTS : 1;
    hearts -= lost;
    heartsLost += lost;
    shake = big ? 0.9 : 0.6;
    comboCount = 0;
    comboClock = 0;
    bladeStreak = 0;
    if (mode === "storm") stormMistakes++;
    api.play("oops");
    splashes.push({ x: f.x, y: f.y, life: 0.8, color: "#8a93a8" });
    rings.push({ x: f.x, y: f.y, life: 0.6, maxR: big ? 220 : 110, color: big ? "#e05a7a" : "#8a93a8" });
    if (big) {
      // 大炸弹把全屏水果炸飞(不得分)
      for (let i = flying.length - 1; i >= 0; i--) {
        const other = flying[i];
        if (other === f || other.fly === "bomb" || other.fly === "bigbomb") continue;
        splashes.push({ x: other.x, y: other.y, life: 0.5, color: "#c8c8d2" });
        flying.splice(i, 1);
      }
      addFloat(f.x, f.y - 24, `轰!大炸弹 -${lost}💗`, "#e05a7a", true);
    } else {
      addFloat(f.x, f.y - 20, "哎呀,是小炸弹!", "#5c6b8a", true);
    }
    if (hearts <= 0) roundFail();
  }

  function sliceBanana(f: Flying): void {
    frenzyTimer = FRENZY_SECONDS;
    frenzyLaunch = 0;
    shake = 0.3;
    api.play("win");
    addFloat(w / 2, h * 0.3, "彩虹香蕉!水果雨来啦!!", "#e0a030", true);
    splashes.push({ x: f.x, y: f.y, life: 0.6, color: "#ffe66b" });
  }

  /** 1.2 双倍果:切开之后几秒钟内每一刀都算两份。 */
  function sliceDouble(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    doubleTimer = DOUBLE_SECONDS;
    const gain = scoreHit(f.x, f.y, 3);
    strokeCount++;
    strokeX = f.x;
    strokeY = f.y;
    api.play("coin");
    addFloat(w / 2, h * 0.3, `${EXTRA_SPEC.double.emoji} 双倍果!接下来 ${DOUBLE_SECONDS} 秒都算两份`, "#e0a030", true);
    addFloat(f.x, f.y - 12, `+${gain}`, "#c47a2a");
    rings.push({ x: f.x, y: f.y, life: 0.7, maxR: 170, color: "#ffd85a" });
    splitHalves(f, DOUBLE_FRUIT, Math.atan2(y2 - y1, x2 - x1));
  }

  /** 1.2 小花朵:不能切。切了只少一次机会 + 温和提示,不掉血、不训人。 */
  function sliceFlower(f: Flying): void {
    hearts -= FLOWER_COST;
    heartsLost += FLOWER_COST;
    if (mode === "storm") stormMistakes++;
    comboCount = 0;
    comboClock = 0;
    bladeStreak = 0;
    api.play("oops");
    addFloat(f.x, f.y - 24, flowerLine(), "#c86a9a", true);
    // 花瓣飘落:用果肉两半冒充花瓣,颜色换成粉白
    splashes.push({ x: f.x, y: f.y, life: 0.7, color: "#ffd8e8" });
    rings.push({ x: f.x, y: f.y, life: 0.5, maxR: 110, color: "#ffc0d8" });
    if (hearts <= 0) roundFail();
  }

  /** 1.2 连体果:两颗连在一起,第一刀先分开一半,第二刀才整颗算完。 */
  function sliceTwin(f: Flying, x1: number, y1: number, x2: number, y2: number): boolean {
    const hits = (f.hits ?? 0) + 1;
    f.hits = hits;
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    strokeCount++;
    strokeX = f.x;
    strokeY = f.y;
    if (!twinCracked(hits)) {
      const gain = scoreHit(f.x, f.y, twinStepScore(hits) * mult);
      f.r = Math.max(18, f.r * 0.72);
      f.vy -= 120;
      f.vrot = (Math.random() - 0.5) * 7;
      api.play("pop");
      addFloat(f.x, f.y - 20, `分开一半 +${gain},再补一刀!`, "#c8506a");
      splitHalves(f, TWIN_FRUIT, Math.atan2(y2 - y1, x2 - x1));
      return false;
    }
    const gain = scoreHit(f.x, f.y, twinStepScore(hits) * mult);
    api.play("coin");
    addFloat(f.x, f.y - 16, `连体果切完!+${gain}`, "#c8506a", true);
    splitHalves(f, TWIN_FRUIT, Math.atan2(y2 - y1, x2 - x1));
    return true;
  }

  function sliceIce(f: Flying): void {
    // 暴风节奏更快,冰冻按 1.2 规格给 3 秒;老回合沿用 1.0 的手感不动
    freezeTimer = mode === "storm" ? CHILL_SECONDS : ICE_SECONDS;
    api.play("coin");
    addFloat(w / 2, h * 0.3, "冰冻果!全场慢动作~", "#5a8ac9", true);
    splashes.push({ x: f.x, y: f.y, life: 0.6, color: "#bfe9ff" });
    rings.push({ x: f.x, y: f.y, life: 0.7, maxR: 160, color: "#8fd0f0" });
  }

  function sliceBoom(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    api.play("coin");
    shake = 0.4;
    addFloat(f.x, f.y - 24, "爆裂果开花!", "#e07a3a", true);
    rings.push({ x: f.x, y: f.y, life: 0.6, maxR: BOOM_RADIUS, color: "#ffb84d" });
    // 范围内水果全部切开得分,炸弹被安全排掉
    for (let i = flying.length - 1; i >= 0; i--) {
      const other = flying[i];
      if (other === f) continue;
      if (Math.hypot(other.x - f.x, other.y - f.y) > BOOM_RADIUS) continue;
      flying.splice(i, 1);
      if (other.fly === "fruit") {
        sliceFruit(other, x1, y1, x2, y2);
      } else if (other.fly === "bomb" || other.fly === "bigbomb") {
        splashes.push({ x: other.x, y: other.y, life: 0.5, color: "#c8c8d2" });
        addFloat(other.x, other.y, "炸弹被排掉啦!", "#4a9a5a");
      } else if (other.fly === "banana") {
        sliceBanana(other);
      } else if (other.fly === "ice") {
        sliceIce(other);
      }
    }
  }

  function slice(x1: number, y1: number, x2: number, y2: number): void {
    if (phase !== "play") return;
    // 1.2:一刀没划够 MIN_SWIPE 之前不吃判定,小手指头点一下不会误切
    if (!swipeCounts(strokeLen)) return;
    const wind = orchardStyle().wind;
    // 果王判定放在水果前面:它块头大,别被后面的果子抢了刀
    if (king && king.out && segCircleHit(x1, y1, x2, y2, king.x, king.y, king.spec.r)) {
      sliceKing(king);
      if (checkClassicTarget()) return;
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      // 爆裂果会在这一轮里连锁清掉好几个,数组可能已经比 i 短了
      const f = flying[i];
      if (!f) continue;
      // 触控放宽:判定走廊 = 果半径 + 12px,配合 ≥24px 的可见刀光,一年级拖不准也切得中。
      // 1.2 换成扫掠判定:这一帧里刀和果子一起往前走,划得再快也不会擦身而过还判没切到。
      if (!sweptHit(x1, y1, x2, y2, { x: f.x, y: f.y, vx: f.vx + wind, vy: f.vy, r: f.r }, lastDt, 12)) continue;
      if (f.fly === "shell") {
        // 硬壳果第一刀不移除,弹开等补刀
        if (!sliceShell(f, x1, y1, x2, y2)) continue;
        flying.splice(i, 1);
        if (checkClassicTarget()) return;
        continue;
      }
      if (f.fly === "twin") {
        // 连体果第一刀只分开一半,留在场上等补刀
        if (!sliceTwin(f, x1, y1, x2, y2)) continue;
        flying.splice(i, 1);
        if (checkClassicTarget()) return;
        continue;
      }
      flying.splice(i, 1);
      if (f.fly === "bomb" || f.fly === "bigbomb") {
        sliceBomb(f, f.fly === "bigbomb");
        if (phase !== "play") return;
      } else if (f.fly === "flower") {
        sliceFlower(f);
        if (phase !== "play") return;
      } else if (f.fly === "double") {
        sliceDouble(f, x1, y1, x2, y2);
        if (checkClassicTarget()) return;
      } else if (f.fly === "banana") {
        sliceBanana(f);
      } else if (f.fly === "ice") {
        sliceIce(f);
      } else if (f.fly === "command") {
        sliceCommand(f, x1, y1, x2, y2);
        if (checkClassicTarget()) return;
      } else if (f.fly === "boom") {
        sliceBoom(f, x1, y1, x2, y2);
        if (checkClassicTarget()) return;
      } else {
        sliceFruit(f, x1, y1, x2, y2);
        if (checkClassicTarget()) return;
      }
    }
  }

  /** 一刀结束:报连刀战果,并把 800ms 的连击串接上(倍率封顶)。 */
  function settleStroke(): void {
    if (strokeCount >= 1) {
      bladeStreak = bladeWindowAlive(time - lastStrokeAt) ? bladeStreak + 1 : 1;
      lastStrokeAt = time;
    }
    if (strokeCount >= 2 && bladeOn()) {
      const bonus = strokeBonus(strokeCount);
      roundScore += bonus;
      totalScore += bonus;
      bestCombo = Math.max(bestCombo, strokeCount);
      const rainbow = isRainbowBlade(strokeCount);
      const label = bladeLabel(strokeCount);
      if (label) {
        addFloat(strokeX, strokeY - 52, `${label} +${bonus}`, rainbow ? "#c85ab0" : "#1f7a5e", true);
      }
      if (rainbow) {
        // 彩虹刀:刀光整条变彩虹,再来一圈水花
        api.play("win");
        shake = Math.max(shake, 0.32);
        rainbowBlade = 0.55;
        rings.push({ x: strokeX, y: strokeY, life: 0.7, maxR: 210, color: "#ffb0e0" });
      }
    } else if (strokeCount >= 2 && mech().chain) {
      const label = chainLabel(strokeCount);
      if (label) addFloat(strokeX, strokeY - 52, label, "#1f7a5e", true);
    }
    strokeCount = 0;
    strokeLen = 0;
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

    if (phase === "menu") {
      for (const m of menuRects) {
        if (inRect(x, y, m.rect)) {
          api.play("tap");
          startMode(m.mode);
          return;
        }
      }
      return;
    }
    if (phase === "themes") {
      if (inRect(x, y, btnBack)) {
        api.play("tap");
        phase = "menu";
        return;
      }
      for (const c of themeCards) {
        if (inRect(x, y, c.rect)) {
          if (isThemeUnlocked(progress, c.idx)) {
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
        if (Math.hypot(x - n.x, y - n.y) <= n.r + 8) {
          if (isLevelUnlocked(progress, n.idx)) {
            api.play("tap");
            roundIdx = n.idx;
            resetRound();
            phase = "intro";
          } else {
            api.play("oops");
          }
          return;
        }
      }
      return;
    }
    if (phase === "intro") {
      api.play("tap");
      phase = "play";
      return;
    }
    if (phase === "clear") {
      if (inRect(x, y, btnNext)) {
        api.play("tap");
        stopSpeaking();
        roundIdx++;
        resetRound();
        phase = "intro";
      } else if (inRect(x, y, btnMap)) {
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
        resetRound();
        phase = "play";
      } else if (inRect(x, y, btnMap)) {
        api.play("tap");
        stopSpeaking();
        phase = "map";
      }
      return;
    }
    if (phase === "end") {
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        stopSpeaking();
        resetRound();
        totalScore = 0;
        phase = "intro";
      } else if (inRect(x, y, btnMenu)) {
        api.play("tap");
        stopSpeaking();
        phase = "menu";
      }
      return;
    }

    slicing = true;
    strokeCount = 0;
    strokeLen = 0;
    // 镜像开着的时候,手往右划刀就往左走
    lastX = mirrorX(x, w, mirrored);
    lastY = y;
    trail.push({ x: lastX, y: lastY, t: time });
  }

  function onPointerMove(e: PointerEvent): void {
    if (!slicing || destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const x = mirrorX(e.clientX - rect.left, w, mirrored);
    const y = e.clientY - rect.top;
    strokeLen += Math.hypot(x - lastX, y - lastY);
    slice(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
    trail.push({ x, y, t: time });
    if (trail.length > TRAIL_MAX) trail.shift();
  }

  function onPointerUp(): void {
    if (slicing) settleStroke();
    slicing = false;
  }

  /** 果王来回巡游、定时探头,倒下之后就只剩谢幕动画。 */
  function updateKing(k: King, dt: number, m: RoundMech): void {
    k.phase += dt * (k.out ? 0.9 : 0.4);
    if (kingDown(k.spec, k.hits)) {
      k.downTimer = Math.max(0, k.downTimer - dt);
      k.out = false;
      return;
    }
    k.timer -= dt;
    if (k.timer <= 0) {
      k.out = !k.out;
      k.timer = k.out
        ? k.spec.showTime * kingShowMult(k.spec, k.hits)
        : k.spec.hideTime;
      if (k.out) {
        // 每次探头换个位置,别老在同一边
        k.x = w * (0.25 + Math.random() * 0.5);
        k.y = h * (0.24 + Math.random() * 0.16);
        api.play("meow");
        rings.push({ x: k.x, y: k.y, life: 0.6, maxR: k.spec.r * 2.4, color: "#ffb0c8" });
        if (k.spec.throwsShell) launchOne("shell");
        if (k.spec.decrees && m.command > 0) {
          const alive = flying.some((f) => f.fly === "command" && f.group === cmdGroup);
          if (!alive) launchCommandSet(m.command);
        }
        if (k.spec.flips && m.mirror) {
          // 果王亲手掀一下镜湖,和固定周期叠在一起
          mirrorInvert = !mirrorInvert;
        }
      }
    }
    // 现身时左右晃,给个可预判的节奏
    k.x += Math.sin(k.phase * 1.6) * 46 * dt;
    k.x = Math.max(k.spec.r + 12, Math.min(w - k.spec.r - 12, k.x));
    k.y += Math.sin(k.phase * 2.3) * 22 * dt;
  }

  // ---- 更新 ----
  function update(rawDt: number): void {
    const scale = hitStop > 0 ? 0.3 : 1;
    hitStop = Math.max(0, hitStop - rawDt);
    const dt = rawDt * scale;
    time += dt;
    // 扫掠判定要拿这一帧的时长把水果往回推,所以记下来
    lastDt = Math.max(1 / 240, rawDt);
    shake = Math.max(0, shake - rawDt);
    freezeTimer = Math.max(0, freezeTimer - rawDt);
    doubleTimer = Math.max(0, doubleTimer - rawDt);
    rainbowBlade = Math.max(0, rainbowBlade - rawDt);
    if (bladeStreak > 0 && time - lastStrokeAt > BLADE_WINDOW) bladeStreak = 0;

    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= rawDt;
      // 减弱动效时飘分停在原地,只淡出——分数照样读得到
      if (!reducedMotion) floats[i].y -= rawDt * 32;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    while (trail.length > 0 && time - trail[0].t > TRAIL_SEC) trail.shift();
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].life -= dt * FX_FADE;
      if (splashes[i].life <= 0) splashes.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].life -= rawDt * FX_FADE;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }

    if (phase !== "play") return;

    const m = mech();

    // 镜像模式:每 mirrorPeriod 秒左右翻一次,翻的瞬间闪一下提醒
    if (m.mirror) {
      const now = mirrorOn(time, m.mirrorPeriod) !== mirrorInvert;
      if (now !== mirrored) {
        mirrored = now;
        mirrorFlash = 0.7;
        api.play("pop");
        trail.length = 0;
      }
    } else if (mirrored) {
      mirrored = false;
    }
    mirrorFlash = Math.max(0, mirrorFlash - rawDt);

    // 连击窗口计时
    if (comboClock > 0) {
      comboClock -= rawDt;
      if (comboClock <= 0) settleCombo();
    }

    // 倒计时(经典与禅宗)
    if (mode === "classic" || mode === "zen") {
      roundTime -= dt;
      if (roundTime <= 0) {
        if (mode === "zen") {
          endFreeMode();
        } else {
          settleCombo();
          if (roundScore >= round().target) roundCleared();
          else roundFail();
        }
        return;
      }
    }

    // 水果雨
    if (frenzyTimer > 0) {
      frenzyTimer -= dt;
      frenzyLaunch -= dt;
      if (frenzyLaunch <= 0 && flying.length < 12) {
        frenzyLaunch = 0.3;
        launchOne("fruit");
        if (Math.random() < 0.4) launchOne("fruit");
      }
    } else {
      launchTimer -= dt;
      const maxOn =
        mode === "classic" ? round().maxOnScreen : mode === "zen" ? 9 : mode === "storm" ? 13 : 8;
      if (launchTimer <= 0 && flying.length < maxOn) {
        launchTimer =
          mode === "storm"
            ? stormWave(stormN, stormSeed).interval
            : mode === "arcade"
              ? arcadePace(totalScore).interval
              : mode === "zen"
                ? 1.1
                : 1.4;
        launchVolley();
      }
    }

    // 指令果:上一组切完(或飞走)之后隔一会儿再挂一组
    if (m.command > 0) {
      const alive = flying.some((f) => f.fly === "command" && f.group === cmdGroup);
      if (!alive) {
        if (cmdTotal > 0) {
          // 整组没切完就落地了:不罚分,下一组重新数
          cmdTotal = 0;
          cmdNeed = commandResetNeed();
          cmdTimer = Math.max(cmdTimer, 1.6);
        }
        cmdTimer -= dt;
        if (cmdTimer <= 0) {
          cmdTimer = 3.4;
          launchCommandSet(m.command);
        }
      }
    }

    // 果王:一会儿探头一会儿躲,现身时才砍得到
    if (king) updateKing(king, dt, m);

    // 冰冻果:飞行物慢动作,好切!果园手感:重力倍率 + 侧风漂移。
    const st = orchardStyle();
    const simDt = dt * (freezeTimer > 0 ? ICE_SLOW : 1);
    const g = gravityFor(h) * st.gravityMult;
    const wind = st.wind;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.vy += g * simDt;
      f.x += (f.vx + wind) * simDt;
      f.y += f.vy * simDt;
      f.rot += f.vrot * simDt;
      if (f.y > h + 80 && f.vy > 0) {
        flying.splice(i, 1);
        // 水果暴风:能切的果子落地就算漏一个(炸弹和花朵本来就不该切,不算)
        if (mode === "storm" && f.fly !== "bomb" && f.fly !== "bigbomb" && f.fly !== "flower") {
          stormMissed++;
          addFloat(Math.max(30, Math.min(w - 30, f.x)), h - 40, `漏了 ${stormMissed}/${STORM_MISS_LIMIT}`, "#c86a9a");
        }
      }
    }
    if (mode === "storm" && stormOver(stormMissed, stormMistakes)) {
      endFreeMode();
      return;
    }

    for (let i = halves.length - 1; i >= 0; i--) {
      const half = halves[i];
      half.vy += g * simDt;
      half.x += (half.vx + wind) * simDt;
      half.y += half.vy * simDt;
      half.rot += half.vrot * simDt;
      half.life -= dt;
      if (half.life <= 0 || half.y > h + 80) halves.splice(i, 1);
    }
  }

  // ---- 绘制 ----
  /** 把 #rrggbb 变深/变浅(amt 为 -255..255) */
  function shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawBomb(f: Flying, big: boolean): void {
    ctx.fillStyle = big ? "#4a4258" : "#5c6b8a";
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    if (big) {
      // 大炸弹:红色警戒条纹
      ctx.strokeStyle = "#e05a7a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, f.r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#e05a7a";
      ctx.font = `bold ${f.r * 0.7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, f.r * 0.05);
    }
    ctx.strokeStyle = "#3a4258";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -f.r);
    ctx.quadraticCurveTo(f.r * 0.4, -f.r * 1.4, f.r * 0.7, -f.r * 1.2);
    ctx.stroke();
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.arc(f.r * 0.7, -f.r * 1.2, 5 + Math.sin(time * 20) * 2, 0, Math.PI * 2);
    ctx.fill();
    if (!big) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
      ctx.arc(f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, f.r * 0.3, f.r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBanana(f: Flying): void {
    ctx.shadowColor = "#ffe66b";
    ctx.shadowBlur = 18 + Math.sin(time * 8) * 6;
    ctx.fillStyle = "#ffe66b";
    ctx.beginPath();
    ctx.moveTo(-f.r, -f.r * 0.1);
    ctx.quadraticCurveTo(0, f.r * 0.9, f.r, -f.r * 0.1);
    ctx.quadraticCurveTo(f.r * 0.85, f.r * 0.45, 0, f.r * 0.55);
    ctx.quadraticCurveTo(-f.r * 0.85, f.r * 0.45, -f.r, -f.r * 0.1);
    ctx.fill();
    ctx.shadowBlur = 0;
    const bands = ["#ff9eb5", "#8fd8c8", "#c9b6f2"];
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = bands[i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -f.r * 0.15, f.r * (0.45 + i * 0.16), Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = "#c8a838";
    ctx.beginPath();
    ctx.arc(-f.r * 0.95, -f.r * 0.1, f.r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawIce(f: Flying): void {
    ctx.shadowColor = "#bfe9ff";
    ctx.shadowBlur = 14 + Math.sin(time * 6) * 5;
    ctx.fillStyle = "#bfe9ff";
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 雪花
    ctx.strokeStyle = "#5a8ac9";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * f.r * 0.65, Math.sin(a) * f.r * 0.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * f.r * 0.4, Math.sin(a) * f.r * 0.4);
      ctx.lineTo(Math.cos(a + 0.4) * f.r * 0.58, Math.sin(a + 0.4) * f.r * 0.58);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoomFruit(f: Flying): void {
    ctx.shadowColor = "#ffb84d";
    ctx.shadowBlur = 12 + Math.sin(time * 10) * 6;
    ctx.fillStyle = "#ff8f5e";
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 星星裂纹
    ctx.strokeStyle = "#e05a2a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * f.r * 0.2, Math.sin(a) * f.r * 0.2);
      ctx.lineTo(Math.cos(a) * f.r * 0.75, Math.sin(a) * f.r * 0.75);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffe0a3";
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // 小叶子
    ctx.fillStyle = "#7ac97a";
    ctx.beginPath();
    ctx.ellipse(f.r * 0.2, -f.r * 1.02, f.r * 0.28, f.r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 硬壳果:木纹外壳 + 已经挨了几刀的裂纹。 */
  function drawShell(f: Flying): void {
    const cracked = (f.hits ?? 0) > 0;
    ctx.fillStyle = "#c9a06a";
    ctx.strokeStyle = "#8a6a3e";
    ctx.lineWidth = Math.max(3, f.r * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#a5824e";
    ctx.lineWidth = Math.max(2, f.r * 0.08);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, f.r * (0.3 + i * 0.22), Math.PI * 0.15, Math.PI * 1.1);
      ctx.stroke();
    }
    if (cracked) {
      // 第一刀之后露出果肉:告诉孩子「再来一刀就开」
      ctx.strokeStyle = "#fff0d0";
      ctx.lineWidth = Math.max(3, f.r * 0.14);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-f.r * 0.8, -f.r * 0.25);
      ctx.lineTo(-f.r * 0.1, f.r * 0.05);
      ctx.lineTo(f.r * 0.35, -f.r * 0.3);
      ctx.lineTo(f.r * 0.85, 0);
      ctx.stroke();
      ctx.fillStyle = "#e05a7a";
      ctx.font = `bold ${Math.round(f.r * 0.5)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("再一刀", 0, f.r * 0.52);
    } else {
      ctx.fillStyle = "#6a4a2a";
      ctx.beginPath();
      ctx.arc(-f.r * 0.26, -f.r * 0.1, f.r * 0.1, 0, Math.PI * 2);
      ctx.arc(f.r * 0.26, -f.r * 0.1, f.r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6a4a2a";
      ctx.lineWidth = Math.max(2, f.r * 0.07);
      ctx.beginPath();
      ctx.moveTo(-f.r * 0.2, f.r * 0.32);
      ctx.lineTo(f.r * 0.2, f.r * 0.32);
      ctx.stroke();
    }
  }

  /** 指令果:挂着号码牌,下一颗该切的会发光。 */
  function drawCommand(f: Flying): void {
    const next = (f.num ?? 1) === cmdNeed;
    if (next) {
      ctx.shadowColor = "#c9a6f2";
      ctx.shadowBlur = 16 + Math.sin(time * 8) * 6;
    }
    ctx.fillStyle = next ? "#e6d0ff" : "#c9a6f2";
    ctx.strokeStyle = "#6a2a9a";
    ctx.lineWidth = Math.max(3, f.r * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#4a1a6a";
    ctx.font = `bold ${Math.round(f.r * 1.05)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(f.num ?? 1), 0, f.r * 0.06);
    if (next) {
      ctx.strokeStyle = "#6a2a9a";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, f.r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** 1.2 双倍果:亮闪闪的金果子,身上刻着 ×2。 */
  function drawDoubleFruit(f: Flying): void {
    const r = f.r;
    const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.5);
    glow.addColorStop(0, "rgba(255,232,150,0.9)");
    glow.addColorStop(1, "rgba(255,216,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    body.addColorStop(0, "#fff3b0");
    body.addColorStop(1, "#ffce4a");
    ctx.fillStyle = body;
    ctx.strokeStyle = "#d99a10";
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-f.rot);
    ctx.fillStyle = "#8a5a10";
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×2", 0, 1);
  }

  /** 1.2 小花朵:这是给鸭梨的礼物,不能切。画得柔和一点,一眼就和果子区分开。 */
  function drawFlower(f: Flying): void {
    const r = f.r;
    ctx.rotate(-f.rot * 0.6);
    ctx.fillStyle = "#ffd6e6";
    ctx.strokeStyle = "#f0a8c8";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + f.rot * 0.4;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.46, r * 0.32, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#ffe89a";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8c460";
    ctx.stroke();
    ctx.fillStyle = "#c86a9a";
    ctx.font = `bold ${Math.round(r * 0.5)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("护", 0, 1);
  }

  /** 1.2 连体果:两颗黏在一起,第一刀分开一半,第二刀才切完。 */
  function drawTwinFruit(f: Flying): void {
    const r = f.r;
    const first = (f.hits ?? 0) >= 1;
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
    body.addColorStop(0, "#ffc3d0");
    body.addColorStop(1, "#f5758f");
    ctx.strokeStyle = "#c8506a";
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.fillStyle = body;
    const lobes: Array<[number, number]> = first ? [[0, 0]] : [[-r * 0.42, 0], [r * 0.42, 0]];
    for (const [ox, oy] of lobes) {
      ctx.beginPath();
      ctx.arc(ox, oy, r * (first ? 0.92 : 0.66), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (!first) {
      // 连着的那根小梗
      ctx.strokeStyle = "#7aa860";
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.5);
      ctx.quadraticCurveTo(0, -r * 0.9, r * 0.2, -r * 0.5);
      ctx.stroke();
    }
  }

  function drawFruit(f: Flying): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.fly === "shell") {
      drawShell(f);
      ctx.restore();
      return;
    }
    if (f.fly === "command") {
      // 号码牌不跟着旋转,不然看不清数字
      ctx.rotate(-f.rot);
      drawCommand(f);
      ctx.restore();
      return;
    }
    if (f.fly === "bomb" || f.fly === "bigbomb") {
      drawBomb(f, f.fly === "bigbomb");
      ctx.restore();
      return;
    }
    if (f.fly === "banana") {
      drawBanana(f);
      ctx.restore();
      return;
    }
    if (f.fly === "ice") {
      drawIce(f);
      ctx.restore();
      return;
    }
    if (f.fly === "boom") {
      drawBoomFruit(f);
      ctx.restore();
      return;
    }
    if (f.fly === "double") {
      drawDoubleFruit(f);
      ctx.restore();
      return;
    }
    if (f.fly === "flower") {
      drawFlower(f);
      ctx.restore();
      return;
    }
    if (f.fly === "twin") {
      drawTwinFruit(f);
      ctx.restore();
      return;
    }
    const k = f.kind as FruitKind;
    // 果身:高光渐变 + 描边
    const bodyGrad = ctx.createRadialGradient(-f.r * 0.35, -f.r * 0.4, f.r * 0.1, 0, 0, f.r * 1.15);
    bodyGrad.addColorStop(0, shade(k.skin, 30));
    bodyGrad.addColorStop(1, k.skin);
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = shade(k.skin, -42);
    ctx.lineWidth = Math.max(1.5, f.r * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 品种细节(裁到果身里画)
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 0.97, 0, Math.PI * 2);
    ctx.clip();
    if (k.name === "瓜瓜") {
      ctx.strokeStyle = "#4e9a4e";
      ctx.lineWidth = f.r * 0.16;
      ctx.lineCap = "round";
      for (const dx of [-0.55, 0, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(dx * f.r, -f.r);
        ctx.quadraticCurveTo(dx * 1.7 * f.r, 0, dx * f.r, f.r);
        ctx.stroke();
      }
    } else if (k.name === "桃桃") {
      ctx.strokeStyle = shade(k.skin, -30);
      ctx.lineWidth = Math.max(1.5, f.r * 0.06);
      ctx.beginPath();
      ctx.moveTo(f.r * 0.05, -f.r * 0.98);
      ctx.quadraticCurveTo(f.r * 0.45, -f.r * 0.3, f.r * 0.15, f.r * 0.6);
      ctx.stroke();
    } else if (k.name === "橙橙") {
      ctx.fillStyle = shade(k.skin, -22);
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI * 2 * i) / 7 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * f.r * 0.62, Math.sin(a) * f.r * 0.62, f.r * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (k.name === "莓莓") {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + 0.7;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * f.r * 0.55, Math.sin(a) * f.r * 0.55, f.r * 0.07, f.r * 0.11, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (k.name === "柠柠") {
      ctx.fillStyle = shade(k.skin, -18);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + 0.2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * f.r * 0.7, Math.sin(a) * f.r * 0.7, f.r * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // 叶子 + 果柄
    ctx.strokeStyle = "#8a6a3e";
    ctx.lineWidth = Math.max(2, f.r * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -f.r * 0.92);
    ctx.lineTo(f.r * 0.06, -f.r * 1.14);
    ctx.stroke();
    ctx.fillStyle = "#7ac97a";
    ctx.strokeStyle = "#55a855";
    ctx.lineWidth = Math.max(1, f.r * 0.04);
    ctx.beginPath();
    ctx.ellipse(f.r * 0.26, -f.r * 1.08, f.r * 0.3, f.r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(-f.r * 0.34, -f.r * 0.36, f.r * 0.2, f.r * 0.13, -0.7, 0, Math.PI * 2);
    ctx.fill();
    // 呆萌表情
    ctx.fillStyle = "rgba(255,140,150,0.4)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.45, f.r * 0.18, f.r * 0.11, 0, Math.PI * 2);
    ctx.arc(f.r * 0.45, f.r * 0.18, f.r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-f.r * 0.28, -f.r * 0.05, f.r * 0.09, 0, Math.PI * 2);
    ctx.arc(f.r * 0.28, -f.r * 0.05, f.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.31, -f.r * 0.08, f.r * 0.03, 0, Math.PI * 2);
    ctx.arc(f.r * 0.25, -f.r * 0.08, f.r * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.5, f.r * 0.07);
    ctx.beginPath();
    ctx.arc(0, f.r * 0.18, f.r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawHalf(half: Half): void {
    const r = half.r;
    ctx.save();
    ctx.translate(half.x, half.y);
    ctx.rotate(half.rot);
    ctx.globalAlpha = Math.min(1, half.life / 0.5);
    // 半球果皮(带渐变和描边)
    const domeGrad = ctx.createLinearGradient(0, 0, 0, r);
    domeGrad.addColorStop(0, half.skin);
    domeGrad.addColorStop(1, shade(half.skin, -24));
    ctx.fillStyle = domeGrad;
    ctx.strokeStyle = shade(half.skin, -42);
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 切面:白瓤圈 + 果肉
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.98, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = half.flesh;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.84, r * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    // 品种切面细节(压扁坐标系里按圆画)
    ctx.save();
    ctx.scale(1, 0.27 / 0.84);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    ctx.clip();
    if (half.name === "瓜瓜") {
      // 西瓜籽
      ctx.fillStyle = "#3a3a4a";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + 0.5;
        const d = r * (i % 2 === 0 ? 0.5 : 0.3);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.05, r * 0.09, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (half.name === "橙橙" || half.name === "柠柠") {
      // 橙瓣 / 柠檬瓣
      ctx.strokeStyle = shade(half.flesh, -36);
      ctx.lineWidth = r * 0.05;
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14);
        ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
        ctx.stroke();
      }
      ctx.fillStyle = shade(half.flesh, -20);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (half.name === "桃桃") {
      // 桃核 + 放射纹
      ctx.strokeStyle = shade(half.flesh, -26);
      ctx.lineWidth = r * 0.04;
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
        ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = "#c47a4a";
      ctx.strokeStyle = "#a05c32";
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // 莓莓:小籽点点
      ctx.fillStyle = shade(half.flesh, -42);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + 0.4;
        const d = r * (i % 2 === 0 ? 0.5 : 0.28);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // 果汁往下滴一滴
    if (half.life < 1) {
      ctx.fillStyle = half.flesh;
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.ellipse(r * 0.2, r * 0.55 + (1 - half.life) * r * 0.7, r * 0.08, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** 果王:大果子本体 + 王冠 + 剩余刀数条。躲起来的时候只留个水影。 */
  function drawKing(k: King): void {
    const down = kingDown(k.spec, k.hits);
    const r = k.spec.r;
    if (!k.out) {
      if (down && k.downTimer <= 0) return;
      ctx.globalAlpha = down ? Math.min(1, k.downTimer / 2.2) * 0.5 : 0.28;
      ctx.fillStyle = down ? "#c8c8d2" : "#b28ae8";
      ctx.beginPath();
      ctx.ellipse(k.x, k.y + r * 0.3, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.translate(k.x, k.y);
    const wob = 1 + Math.sin(k.phase * 3) * 0.03;
    ctx.scale(wob, 2 - wob);
    // 本体
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    grad.addColorStop(0, "#ffd0e4");
    grad.addColorStop(1, "#e07aa8");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#a83a6a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 王冠
    ctx.font = `${Math.round(r * 0.7)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(k.spec.emoji, 0, -r * 1.12);
    // 表情
    ctx.fillStyle = "#4a2a3a";
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.12, r * 0.11, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.12, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a2a3a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.34, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    ctx.restore();
    // 刀数条:还剩几刀一目了然
    const bw = r * 1.8;
    const left = Math.max(0, k.spec.hp - k.hits);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(k.x - bw / 2, k.y + r + 12, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = left <= k.spec.hp / 3 ? "#e05a7a" : "#8fd8c8";
    ctx.beginPath();
    ctx.roundRect(k.x - bw / 2, k.y + r + 12, Math.max(4, (bw * left) / k.spec.hp), 12, 6);
    ctx.fill();
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`还剩 ${left} 刀`, k.x, k.y + r + 34);
  }

  /**
   * 机制小药丸:连刀 / 指令果 / 镜像 / 果王。
   * 375 窄屏一行放不下就换行,最多两行,绝不横着溢出屏幕。
   */
  let mechBadgeRows = 0;
  function drawMechBadges(): void {
    const m = mech();
    const badges: Array<{ text: string; bg: string; fg: string }> = [];
    if (m.chain && strokeCount >= 2) {
      badges.push({ text: `🌀 连刀 ×${chainGain(strokeCount)}`, bg: "#d6f2e4", fg: "#1f7a5e" });
    }
    if (m.command > 0 && cmdTotal > 0) {
      badges.push({ text: `🔖 ${commandLabel(cmdNeed, cmdTotal)}`, bg: "#efe0ff", fg: "#6a2a9a" });
    }
    if (m.mirror) {
      badges.push({
        text: mirrored ? "🪞 镜像中(手反着来)" : "🪞 镜像待命",
        bg: mirrored ? "#ffe0ea" : "#e0f0f6",
        fg: mirrored ? "#a8306a" : "#1f6a8a",
      });
    }
    if (king && !kingDown(king.spec, king.hits)) {
      badges.push({
        text: `${king.spec.emoji} ${king.spec.name} 还剩 ${king.spec.hp - king.hits} 刀`,
        bg: "#ffe4ee",
        fg: "#a83a6a",
      });
    }
    mechBadgeRows = 0;
    if (badges.length === 0) return;

    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const gap = 6;
    const maxW = w - 20;
    const rows: Array<Array<{ text: string; bg: string; fg: string; pw: number }>> = [[]];
    let rowW = 0;
    for (const b of badges) {
      const pw = ctx.measureText(b.text).width + 18;
      if (pw > maxW) continue;
      if (rowW + pw > maxW && rows[rows.length - 1].length > 0) {
        if (rows.length >= 2) break;
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push({ ...b, pw });
      rowW += pw + gap;
    }
    let by = 58;
    for (const row of rows) {
      if (row.length === 0) continue;
      const total = row.reduce((s, b) => s + b.pw, 0) + gap * (row.length - 1);
      let bx = Math.max(10, (w - total) / 2);
      for (const b of row) {
        ctx.fillStyle = b.bg;
        ctx.beginPath();
        ctx.roundRect(bx, by, b.pw, 22, 11);
        ctx.fill();
        ctx.fillStyle = b.fg;
        ctx.fillText(b.text, bx + 9, by + 12);
        bx += b.pw + gap;
      }
      by += 26;
      mechBadgeRows++;
    }
  }

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i++) {
      const age = time - trail[i].t;
      const alpha = Math.max(0, 1 - age / TRAIL_SEC);
      // 刀光加宽到最粗 24px(白芯)+32px(粉晕),和判定走廊一致,孩子看得清切到哪
      const width = 18 * (i / trail.length) + 6;
      ctx.globalAlpha = alpha * 0.45;
      // 彩虹刀余辉:整条刀光换成彩虹渐变(1.2 的一划切 ≥4 颗奖励演出)
      // 减弱动效时彩虹刀不再逐帧刷色相(那是闪烁),换成沿刀身的一段固定渐变
      ctx.strokeStyle = rainbowBlade > 0
        ? `hsl(${(((reducedMotion ? 0 : time * 200) + i * 26) % 360).toFixed(0)}, 85%, 68%)`
        : "#ff9eb5";
      ctx.lineWidth = width + 8;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function panelBox(pw: number, ph: number): { x: number; y: number } {
    const x = (w - pw) / 2;
    const y = h / 2 - ph / 2;
    ctx.fillStyle = "rgba(255,248,240,0.87)";
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

  function drawMenu(): void {
    ctx.fillStyle = "rgba(255,248,240,0.94)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍑 水果切切乐", w / 2, h * 0.14);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#8a7a5e";
    ctx.fillText("手指划过水果,唰!连切有爆击,炸弹别碰!", w / 2, h * 0.14 + 34);

    menuRects.length = 0;
    const bw = Math.min(380, w - 60);
    const configs: Array<{ mode: Mode; title: string; sub: string; color: string }> = [
      {
        mode: "classic",
        title: "🏅 经典战役",
        sub: `九大果园 ${ROUNDS.length} 回合 · ⭐ ${totalStars(progress)}/${ROUNDS.length * 3}`,
        color: "#ffb84d",
      },
      {
        mode: "zen",
        title: "🧘 禅宗模式",
        sub: `${ZEN_SECONDS} 秒没有炸弹,安心切 · 最好 ${best.zen} 分`,
        color: "#8fd8c8",
      },
      {
        mode: "arcade",
        title: "🎪 街机无尽",
        sub: `越切越快,挑战最高分 · 最好 ${best.arcade} 分`,
        color: "#b28ae8",
      },
      {
        mode: "storm",
        title: "🌪 水果暴风",
        sub: `一波接一波,漏 ${STORM_MISS_LIMIT} 个就收摊 · 最好 ${stormBest} 分`,
        color: "#6fc7a8",
      },
    ];
    const cardH = Math.min(88, (h * 0.66) / configs.length - 12);
    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      const rect: Rect = { x: (w - bw) / 2, y: h * 0.26 + i * (cardH + 16), w: bw, h: cardH };
      menuRects.push({ mode: c.mode, rect });
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "bold 21px sans-serif";
      ctx.fillText(c.title, w / 2, rect.y + cardH * 0.36);
      // 副标题 13→14px、加深颜色,360 窄屏也够看清且对比度 ≥4.5:1
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#7a7a8c";
      ctx.fillText(c.sub, w / 2, rect.y + cardH * 0.7);
    }
  }

  function drawThemes(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#fdf3e0");
    grad.addColorStop(1, "#ffd9e5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🍑 经典战役 · ${ORCHARD_ORDER.length} 座果园`, w / 2, 26);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#8a7a5e";
    ctx.fillText(
      `共 ${ROUNDS.length} 回合 · ⭐ ${totalStars(progress)}/${ROUNDS.length * 3} · 先选果园,再选回合`,
      w / 2,
      52,
    );

    btnBack = { x: 8, y: 8, w: 70, h: 32 };
    drawButton(btnBack, "◀ 菜单", "rgba(255,255,255,0.9)", "#5a5a6e");

    themeCards.length = 0;
    const cols = w > h * 1.15 ? 3 : 2;
    const rows = Math.ceil(ORCHARD_ORDER.length / cols);
    const pad = 10;
    const x0 = Math.max(10, w * 0.06);
    const y0 = 70;
    const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
    const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
    for (let i = 0; i < ORCHARD_ORDER.length; i++) {
      const st = ORCHARD_STYLE[ORCHARD_ORDER[i]];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rect: Rect = { x: x0 + col * (cw + pad), y: y0 + row * (ch + pad), w: cw, h: ch };
      themeCards.push({ idx: i, rect });
      const unlocked = isThemeUnlocked(progress, i);
      const cleared = themeCleared(progress, i);
      ctx.fillStyle = unlocked ? st.bgTop : "#e8e8ee";
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
      ctx.fillStyle = unlocked ? (isDarkOrchard(i) ? "#f0e8da" : "#5a5a6e") : "#a8a8b4";
      ctx.fillText(unlocked ? st.blurb : "通关上一个果园解锁", rect.x + 10, rect.y + ch * 0.6);
      const size = themeSize(i);
      ctx.fillText(
        unlocked ? `${cleared}/${size} 回合 · ⭐${themeStars(progress, i)}/${size * 3}` : "",
        rect.x + 10,
        rect.y + ch * 0.82,
      );
    }
  }

  function drawMap(): void {
    const st = ORCHARD_STYLE[ORCHARD_ORDER[chapterIdx]];
    const dark = isDarkOrchard(chapterIdx);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.bgTop);
    grad.addColorStop(1, st.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    btnBack = { x: 8, y: 8, w: 70, h: 32 };
    drawButton(btnBack, "◀ 果园", "rgba(255,255,255,0.9)", "#5a5a6e");

    ctx.fillStyle = dark ? "#ffe8c2" : st.accent;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, w / 2, 28);
    const size = themeSize(chapterIdx);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `⭐ ${themeStars(progress, chapterIdx)}/${size * 3} · 不掉心通关 3 星,回放可刷星`,
      w / 2,
      54,
    );

    mapNodes.length = 0;
    const base = themeStart(chapterIdx);
    const layout = mapLayout(w, h, size);
    const nr = layout.r;
    for (const spot of layout.spots) {
      mapNodes.push({ idx: base + spot.i, x: spot.x, y: spot.y, r: spot.r });
    }
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
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
      const def = ROUNDS[n.idx];
      const unlocked = isLevelUnlocked(progress, n.idx);
      const got = progress[n.idx] ?? 0;
      const isFinal = n.idx - base === size - 1;
      const r = isFinal ? n.r * 1.25 : n.r;
      ctx.fillStyle = unlocked ? (got > 0 ? "#ffe8c2" : "#ffffff") : "rgba(230,230,236,0.92)";
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
        if (def.king) {
          ctx.font = `${Math.round(r * 0.7)}px sans-serif`;
          ctx.fillText(chapterIdx === ORCHARD_ORDER.length - 1 ? "🏆" : "👑", n.x, n.y - r * 0.95);
        } else if (isFinal) {
          ctx.font = `${Math.round(r * 0.6)}px sans-serif`;
          ctx.fillText("🚩", n.x, n.y - r * 0.95);
        } else if (def.gen) {
          ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
          ctx.fillText("🍲", n.x, n.y - r * 0.95);
        }
        ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
        let starTxt = "";
        for (let s = 0; s < 3; s++) starTxt += s < got ? "⭐" : "▫";
        ctx.fillText(starTxt, n.x, n.y + r * 1.45);
      }
    }
  }

  /** 居中折行:新果园的提示和机制标签比 1.0 长,窄屏要能换行。 */
  function wrapText(text: string, cx: number, top: number, maxW: number, lh: number): number {
    const words = text.split("");
    let line = "";
    let y = top;
    for (const chargram of words) {
      const test = line + chargram;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        ctx.fillText(line, cx, y);
        y += lh;
        line = chargram;
      } else {
        line = test;
      }
    }
    if (line.length > 0) {
      ctx.fillText(line, cx, y);
      y += lh;
    }
    return y;
  }

  function drawIntroPanel(): void {
    const { y } = panelBox(Math.min(460, w - 40), mode === "classic" ? 252 : 210);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (mode === "classic") {
      const r = round();
      const st = ORCHARD_STYLE[r.orchard];
      const rel = roundIdx - themeStart(chapterIdx) + 1;
      ctx.fillStyle = st.accent;
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 第${rel}回合 · ${r.name}`, w / 2, y + 40);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "15px sans-serif";
      wrapText(r.hint, w / 2, y + 78, Math.min(w - 72, 400), 20);
      const tags: string[] = [];
      if (st.wind > 0) tags.push("💨 侧风向右");
      if (st.wind < 0) tags.push("💨 侧风向左");
      if (st.gravityMult < 1) tags.push("🎈 低重力飘");
      if (st.gravityMult > 1) tags.push("⚡ 急坠快落");
      if (st.fruitScale < 1) tags.push("🔍 小果考精准");
      if (st.fruitScale > 1) tags.push("🍉 大瓜好切");
      if (r.chain) tags.push("🌀 连刀加倍");
      if (r.command) tags.push(`🔖 指令果 1→${r.command}`);
      if (r.shellChance) tags.push("🥥 硬壳要两刀");
      if (r.mirror) tags.push("🪞 镜像会翻");
      if (tags.length > 0) {
        ctx.fillStyle = "#8a7a5e";
        ctx.font = "13px sans-serif";
        wrapText(tags.join(" · "), w / 2, y + 122, Math.min(w - 60, 420), 18);
      }
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      const kingSpec = r.king ? KING_INFO[r.king] : null;
      ctx.fillText(
        kingSpec
          ? `🎯 ${r.time} 秒内切到 ${r.target} 分,还要砍倒${kingSpec.name}`
          : `🎯 ${r.time} 秒内切到 ${r.target} 分`,
        w / 2,
        y + 168,
      );
    } else if (mode === "zen") {
      ctx.fillStyle = "#8fd8c8";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("🧘 禅宗模式", w / 2, y + 42);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${ZEN_SECONDS} 秒里没有炸弹,安安心心切个够!`, w / 2, y + 86);
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🎯 冲 40/80/130 分拿 1/2/3 星", w / 2, y + 122);
    } else if (mode === "storm") {
      ctx.fillStyle = "#3f9a80";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("🌪 水果暴风", w / 2, y + 42);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "15px sans-serif";
      wrapText(
        `一波接一波越来越密。漏掉 ${STORM_MISS_LIMIT} 个果子、或者切错 ${STORM_MISTAKE_LIMIT} 次(炸弹、花朵)就收摊。`,
        w / 2,
        y + 82,
        Math.min(w - 60, 400),
        20,
      );
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🎯 冲 45/95/160 分拿 1/2/3 星", w / 2, y + 132);
    } else {
      ctx.fillStyle = "#b28ae8";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("🎪 街机无尽", w / 2, y + 42);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText("没有时间限制,3 颗心用完为止,越切越快!", w / 2, y + 86);
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🎯 冲 40/90/150 分拿 1/2/3 星", w / 2, y + 122);
    }
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText("点一下开始,唰唰唰!", w / 2, y + (mode === "classic" ? 208 : 162));
  }

  function drawClearPanel(): void {
    const r = round();
    const { y } = panelBox(Math.min(450, w - 40), 240);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${r.name} 完成!`, w / 2, y + 40);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 86);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`本回合 ${roundScore} 分 · 掉心 ${heartsLost} · 最高 ${bestCombo} 连切`, w / 2, y + 124);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 164, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (roundIdx < ROUNDS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 164, w: bw2, h: 44 };
      drawButton(btnNext, "下一回合 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  function drawRetryPanel(): void {
    const { y } = panelBox(Math.min(450, w - 40), 210);
    // 深紫替代浅紫:白底大字对比 4.8:1(原 #b28ae8 只有 2.7:1,不达 AA)
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("差一点点……", w / 2, y + 44);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText("没关系!重切这一回合就好", w / 2, y + 84);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 128, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 128, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再切一次", "#ffd868", "#7a5a1a");
  }

  function drawEndPanel(): void {
    const { y } = panelBox(Math.min(450, w - 40), 250);
    ctx.fillStyle = mode === "zen" ? "#4a9a8a" : "#8a5ac9";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      mode === "zen" ? "禅宗时间到!" : mode === "storm" ? "水果暴风停啦!" : "街机挑战结束!",
      w / 2,
      y + 40,
    );
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < endStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 86);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    if (mode === "storm") {
      wrapText(endMsg, w / 2, y + 118, Math.min(w - 60, 400), 20);
    } else {
      const bestScore = mode === "zen" ? best.zen : best.arcade;
      ctx.fillText(`本局 ${totalScore} 分 · 最好 ${bestScore} 分 · 最高 ${bestCombo} 连切`, w / 2, y + 124);
    }
    const bw2 = 132;
    btnMenu = { x: w / 2 - bw2 - 10, y: y + 168, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 168, w: bw2, h: 44 };
    drawButton(btnMenu, "回菜单", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再来一局", "#ffd868", "#7a5a1a");
  }

  function draw(): void {
    if (phase === "menu") {
      drawMenu();
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

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);

    const st = orchardStyle();
    const dark = mode === "classic" && isDarkOrchard(chapterIdx);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (freezeTimer > 0) {
      grad.addColorStop(0, "#e0f2ff");
      grad.addColorStop(1, "#cfe6ff");
    } else if (frenzyTimer > 0) {
      grad.addColorStop(0, "#fff3d6");
      grad.addColorStop(1, "#ffe0ee");
    } else {
      grad.addColorStop(0, st.bgTop);
      grad.addColorStop(1, st.bgBottom);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(-24, -24, w + 48, h + 48);

    ctx.fillStyle =
      freezeTimer > 0
        ? "rgba(140,190,240,0.22)"
        : dark
          ? "rgba(255,255,255,0.10)"
          : "rgba(255,180,200,0.18)";
    for (let y = 30; y < h; y += 70) {
      for (let x = ((y / 70) % 2) * 35 + 20; x < w; x += 70) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (freezeTimer > 0) {
      // 飘雪
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 97) % 100) / 100 * w;
        const sy = (((i * 53) % 100) / 100 * h + time * 40) % h;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (mirrored) {
      // 镜像中:湖面加一层冷色 + 中线,提醒左右已经翻过来了
      ctx.fillStyle = "rgba(150,190,230,0.16)";
      ctx.fillRect(-24, -24, w + 48, h + 48);
      ctx.strokeStyle = `rgba(120,170,220,${0.35 + Math.sin(time * 4) * 0.15})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (mirrorFlash > 0) {
      ctx.globalAlpha = Math.min(1, mirrorFlash / 0.7);
      ctx.fillStyle = "#1f6a8a";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mirrored ? "🪞 左右翻过来啦!" : "🪞 恢复正常!", w / 2, h * 0.42);
      ctx.globalAlpha = 1;
    }
    if (st.wind !== 0 && freezeTimer <= 0) {
      // 侧风线条:提示水果会横向漂移
      ctx.strokeStyle = dark ? "rgba(255,220,180,0.35)" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const dir = Math.sign(st.wind);
      for (let i = 0; i < 8; i++) {
        const wy = (((i * 131) % 100) / 100) * h * 0.8 + h * 0.06;
        const phaseX = ((time * Math.abs(st.wind) * 1.6 + i * 160) % (w + 200)) - 100;
        const wx = dir > 0 ? phaseX : w - phaseX;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 18 * dir, wy - 4, wx + 40 * dir, wy);
        ctx.stroke();
      }
    }

    if (king) drawKing(king);
    for (const half of halves) drawHalf(half);
    for (const f of flying) drawFruit(f);

    for (const s of splashes) {
      ctx.globalAlpha = Math.max(0, s.life) * 0.9;
      ctx.fillStyle = s.color;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        const d = (0.8 - s.life) * 70;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (const r of rings) {
      // 涟漪的寿命有长有短(最长的是果王倒下那一圈),半径要夹住别变负数
      ctx.globalAlpha = Math.min(1, Math.max(0, r.life / 0.7));
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(2, (1 - Math.max(0, r.life) / 0.7) * r.maxR + 10), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawTrail();

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 24px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    // 窄屏修复:左侧药丸按实测文字宽度伸缩(原固定 290/w*0.52 在 360 宽会被文字撑破)
    ctx.font = "bold 16px sans-serif";
    // 375 窄屏放不下横时间条,就把秒数并进左侧药丸,别让它压到机制条上
    const timeBarW = Math.min(240, w - 340);
    const inlineTime = (mode === "classic" || mode === "zen") && phase === "play" && timeBarW <= 60;
    let hudText: string;
    if (mode === "classic") {
      const rel = roundIdx - themeStart(chapterIdx) + 1;
      hudText = `第${chapterIdx + 1}章 ${rel}/${themeSize(chapterIdx)} · 🍑 ${roundScore}/${round().target}`;
    } else if (mode === "zen") {
      hudText = `禅宗 · 分 ${totalScore}`;
    } else if (mode === "storm") {
      hudText = `暴风 · 分 ${totalScore} · 漏 ${stormMissed}/${STORM_MISS_LIMIT} · 错 ${stormMistakes}/${STORM_MISTAKE_LIMIT}`;
    } else {
      hudText = `街机 · 分 ${totalScore}`;
    }
    if (inlineTime) hudText += ` · ⏱${Math.max(0, Math.ceil(roundTime))}s`;
    const hudW = Math.min(w - 90, ctx.measureText(hudText).width + 28);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.roundRect(10, 10, hudW, 40, 17);
    ctx.fill();
    ctx.fillStyle = "#c47a2a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(hudText, 24, 30);
    if (mode !== "zen") {
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_ROUND - hearts)),
        w - 12,
        30,
      );
    }

    // 时间条(经典与禅宗);窄屏时秒数已经并进左侧药丸了
    if ((mode === "classic" || mode === "zen") && phase === "play" && !inlineTime) {
      const full = mode === "classic" ? round().time : ZEN_SECONDS;
      const tx = (w - timeBarW) / 2 + 30;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.roundRect(tx, 16, timeBarW, 12, 6);
      ctx.fill();
      const frac = Math.max(0, roundTime / full);
      ctx.fillStyle = frac < 0.25 ? "#e05a7a" : "#8fd8c8";
      ctx.beginPath();
      ctx.roundRect(tx, 16, Math.max(12, timeBarW * frac), 12, 6);
      ctx.fill();
    }

    // 1.1 机制条:一行小药丸,窄屏放不下就自动少放几个
    if (phase === "play") drawMechBadges();

    let bannerY = phase === "play" && mechBadgeRows > 0 ? 62 + mechBadgeRows * 26 : 70;
    if (frenzyTimer > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e0a030";
      ctx.font = `bold ${20 + Math.sin(time * 10) * 3}px sans-serif`;
      ctx.fillText(`🍌 水果雨 ×${FRENZY_MULTIPLIER} ${Math.ceil(frenzyTimer)}s`, w / 2, bannerY);
      bannerY += 26;
    }
    if (freezeTimer > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#5a8ac9";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`❄ 慢动作 ${Math.ceil(freezeTimer)}s`, w / 2, bannerY);
      bannerY += 26;
    }
    if (doubleTimer > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#c48a1a";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`✨ 双倍果 ×2 ${Math.ceil(doubleTimer)}s`, w / 2, bannerY);
      bannerY += 26;
    }
    if (bladeStreak >= 2 && phase === "play") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#1f7a5e";
      ctx.font = "bold 17px sans-serif";
      ctx.fillText(`🔗 连击 ×${bladeStreak}`, w / 2, bannerY);
    }

    // ---- 覆盖层 ----
    if (phase === "intro") drawIntroPanel();
    else if (phase === "clear") drawClearPanel();
    else if (phase === "retry") drawRetryPanel();
    else if (phase === "end") drawEndPanel();
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

  // 拆卸清单统一记在袋子里,destroy 一把倒干净(监听 / rAF / 朗读一个都不剩)
  const bag = new BladeBag();
  canvas.addEventListener("pointerdown", onPointerDown);
  bag.add(() => canvas.removeEventListener("pointerdown", onPointerDown));
  canvas.addEventListener("pointermove", onPointerMove);
  bag.add(() => canvas.removeEventListener("pointermove", onPointerMove));
  window.addEventListener("pointerup", onPointerUp);
  bag.add(() => window.removeEventListener("pointerup", onPointerUp));
  raf = requestAnimationFrame(frame);
  bag.add(() => cancelAnimationFrame(raf));
  bag.add(() => stopSpeaking());
  bag.add(() => canvas.remove());

  return {
    destroy(): void {
      destroyed = true;
      bag.clear();
    },
  };
}
