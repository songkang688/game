import { meta } from "./meta";
export { meta };

// 糖果秋千 —— 划绳物理益智：划断绳子，把糖果送进小怪物"啾啾"的嘴巴。
// 188 关 10 大主题：草地 / 夜空 / 工厂 / 云朵 / 冰雪 / 彩虹 / 钟楼 / 浮岛 / 星糖 / 月夜，
// 14 种机关（1.1 新增发条伸缩绳、风扇气流、糖霜磁铁、捣蛋鬼咕噜噜、多段高台），
// 带选关地图与进度存档。
import {
  type Link,
  type Particle,
  applyAcceleration,
  applyImpulse,
  attachedToAnchor,
  boardPosition,
  buildRope,
  circleRectOverlap,
  circlesOverlap,
  collideCircleRect,
  cutLinksNear,
  deactivateConnectedLinks,
  fanForceAt,
  fanOn,
  integrate,
  magnetForceAt,
  makeParticle,
  moveToward,
  nearestAnchoredLink,
  patrolPosition,
  retuneLinks,
  segmentsWithinDistance,
  snipOccurred,
  solveLinks,
  starsForCollected,
  teleport,
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
/** 糖果落出画面后先给 0.5s 缓冲(可能被风口吹回/荡回)再判失败 */
const FALL_GRACE = 0.5;

const SAVE_KEY = "yiduo.candy-swing.campaign.v2";

interface Progress {
  /** 每关最佳星数 0-3（0=未通过） */
  stars: number[];
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(data.stars)) {
        const arr = data.stars as unknown[];
        const stars = LEVELS.map((_, i) => {
          const v = arr[i];
          return typeof v === "number" ? Math.max(0, Math.min(3, Math.round(v))) : 0;
        });
        return { stars };
      }
    }
  } catch {
    // 隐私模式等读不到就当新档
  }
  return { stars: LEVELS.map(() => 0) };
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    // 存不了也不影响本次游玩
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

interface TrailPoint {
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

export function mount(api: GameApi): { destroy: () => void } {
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
  /** 第 i 根绳对应的发条（没挂发条就是 undefined），画发条盘时用 */
  let winchOfRope: Array<WinchState | undefined> = [];
  let level: LevelDef = LEVELS[0];
  let theme: ThemePalette = THEMES.meadow;
  let inBubble = false;
  let candyEaten = false;
  let candyGone = false;
  let mouthOpenAmount = 0;
  let portalCooldown = 0;
  let wonStars = 0;
  let fallGraceT = 0;

  const trail: TrailPoint[] = [];
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
      .cs-lv { border: none; border-radius: 14px; padding: 7px 2px 5px; background: #FFFFFF; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); display: flex; flex-direction: column; align-items: center; gap: 1px; }
      .cs-lv:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,.12); }
      .cs-lv .n { font-size: 16px; font-weight: 800; color: #B03A6B; }
      .cs-lv .s { font-size: 10px; letter-spacing: 1px; }
      .cs-lv.locked { background: rgba(255,255,255,.45); cursor: default; box-shadow: none; }
      .cs-lv.locked .n { color: #A99DB5; }
      .cs-chapter.night .cs-lv { background: rgba(255,255,255,.92); }
      .cs-chapter.night .cs-lv.locked { background: rgba(255,255,255,.22); }
      .cs-chapter.moonfair .cs-lv { background: rgba(255,255,255,.92); }
      .cs-chapter.moonfair .cs-lv.locked { background: rgba(255,255,255,.22); }
    </style>
    <div class="cs-map">
      <div class="cs-map-title">🍬 糖果秋千</div>
      <div class="cs-map-total"></div>
      <div class="cs-chapters"></div>
    </div>
    <div class="cs-game cs-hidden">
      <div class="cs-top">
        <span class="cs-badge cs-level">第 1 关</span>
        <span class="cs-badge cs-stars">⭐ 0/3</span>
        <button class="cs-btn cs-retry" type="button">🔄 重试</button>
        <button class="cs-btn cs-back" type="button">🗺️ 选关</button>
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

  function candy(): Particle {
    return particles[0];
  }

  function levelUnlocked(i: number): boolean {
    return i === 0 || progress.stars[i - 1] > 0;
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
        btn.className = unlocked ? "cs-lv" : "cs-lv locked";
        const got = progress.stars[i];
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
  }

  function showMap(): void {
    screen = "map";
    stopSpeaking();
    renderMap();
    gameEl.classList.add("cs-hidden");
    mapEl.classList.remove("cs-hidden");
  }

  // ---------- 关卡装载 ----------

  function updateHud(): void {
    const got = stars.filter((s) => s.collected).length;
    levelEl.textContent = `第 ${levelIndex + 1}/${LEVELS.length} 关 · ${level.name}`;
    starsEl.textContent = `⭐ ${got}/${level.stars.length}`;
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

  function startLevel(index: number): void {
    screen = "play";
    mapEl.classList.add("cs-hidden");
    gameEl.classList.remove("cs-hidden");
    levelIndex = index;
    level = LEVELS[index];
    theme = THEMES[CHAPTERS[chapterOf(index)].theme];
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
    trail.length = 0;
    sparkles.length = 0;

    particles = [makeParticle(level.candy.x, level.candy.y, false, 0.3)];
    links = [];
    winches = [];
    winchOfRope = [];
    for (const r of level.ropes) {
      const before = winches.length;
      addRopeToCandy(r.x, r.y, r.length, r.winch);
      winchOfRope.push(winches.length > before ? winches[winches.length - 1] : undefined);
    }
    stars = level.stars.map((s) => ({ x: s.x, y: s.y, collected: false, suck: 0 }));
    bubbles = (level.bubbles ?? []).map((b) => ({ x: b.x, y: b.y, used: false }));
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
    gremlins = (level.gremlins ?? []).map((def) => {
      const pos = patrolPosition(def.x1, def.y1, def.x2, def.y2, def.period, 0, def.offset ?? 0);
      return { def, x: pos.x, y: pos.y, prevX: pos.x };
    });
    msgEl.textContent = level.tip;
    updateHud();
  }

  function retryLevel(): void {
    if (screen !== "play") return;
    api.play("tap");
    stopSpeaking();
    startLevel(levelIndex);
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
    api.play("oops");
    msgEl.textContent = "没关系，点击画面再来一次！";
    // 结算自动朗读：识字量有限的孩子靠听（无中文语音包时静默）
    speak(failedSpeechLine(reason));
  }

  function winLevel(): void {
    if (phase !== "play") return;
    phase = "won";
    phaseTime = 0;
    candyEaten = true;
    // 吃掉时把还连在糖果上的绳段一起收走（不然会悬空残留）
    deactivateConnectedLinks(links, 0);
    api.play("coin");
    api.play("win");
    burst(level.monster.x, level.monster.y - 10, "#FF9DBE", 12, 160);

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

  function cutAt(x0: number, y0: number, x1: number, y1: number): void {
    if (phase !== "play") return;
    let cutCount = 0;
    for (const link of links) {
      if (!link.active) continue;
      const pa = particles[link.a];
      const pb = particles[link.b];
      if (segmentsWithinDistance(x0, y0, x1, y1, pa.x, pa.y, pb.x, pb.y, CUT_HALF_WIDTH)) {
        link.active = false;
        cutCount++;
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len;
        const ny = (x1 - x0) / len;
        if (!pa.pinned) { pa.px -= nx * 3; pa.py -= ny * 3; }
        if (!pb.pinned) { pb.px += nx * 3; pb.py += ny * 3; }
        burst((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, "#C58A4F", 5, 70);
      }
    }
    if (cutCount > 0) api.play("pop");
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
        inBubble = true;
        c.px = c.x - (c.x - c.px) * 0.25;
        c.py = c.y - (c.y - c.py) * 0.25;
        api.play("jump");
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
      }
    } else {
      fallGraceT = 0;
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
      const main = pull ? "#F05B7A" : "#4F84E8";
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
      // 马蹄形磁铁本体
      ctx.save();
      ctx.translate(mg.x, mg.y);
      ctx.strokeStyle = main;
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
    for (const link of links) {
      if (!link.active) continue;
      const pa = particles[link.a];
      const pb = particles[link.b];
      ctx.strokeStyle = "#A5713F";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.strokeStyle = "#C99763";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
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
      ctx.fillStyle = "#C9A96A";
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.fillStyle = "#FF7E9A";
      const tooth = 12;
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
        }
      }
      ctx.fill();
    }
  }

  function drawBoards(): void {
    for (const b of boards) {
      ctx.fillStyle = "#D8A268";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.def.w, b.def.h, 6);
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
    for (const p of level.portals ?? []) {
      // 入口：紫色漩涡
      ctx.save();
      ctx.translate(p.ax, p.ay);
      ctx.rotate(simTime * 2);
      ctx.strokeStyle = "#B06AF0";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, PORTAL_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(176, 106, 240, 0.65)";
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
      ctx.restore();
      // 出口：青色圆环
      ctx.save();
      ctx.translate(p.bx, p.by);
      ctx.rotate(-simTime * 2);
      ctx.strokeStyle = "#4FC7E8";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, PORTAL_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = "rgba(79, 199, 232, 0.25)";
      ctx.beginPath();
      ctx.arc(p.bx, p.by, PORTAL_R - 6, 0, Math.PI * 2);
      ctx.fill();
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
      const justSnipped = simTime - s.lastSnipAt < 0.18;
      const open = justSnipped ? 0.06 : Math.min(0.55, 0.15 + (1 - Math.min(1, until / period)) * 0.5);
      ctx.save();
      ctx.translate(x, y);
      for (const side of [-1, 1]) {
        ctx.rotate(0);
        ctx.strokeStyle = "#9AA7C4";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(side * open) * 17, Math.sin(side * open) * 17 - 6);
        ctx.stroke();
        ctx.fillStyle = "#F08282";
        ctx.beginPath();
        ctx.arc(-Math.cos(side * open) * 8, -Math.sin(side * open) * 8 + 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
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

  function drawStar(x: number, y: number, r: number, rot = 0): void {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = rot - Math.PI / 2 + (Math.PI * i) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
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
          ctx.fillStyle = "rgba(255, 205, 80, " + (1 - s.suck) + ")";
          drawStar(ix, iy, 14 * (1 - s.suck * 0.8), s.suck * 3);
        }
        continue;
      }
      const pulse = 1 + Math.sin(simTime * 4 + s.x) * 0.08;
      ctx.fillStyle = "#FFD75E";
      drawStar(s.x, s.y, 13 * pulse);
      ctx.fillStyle = "#FFF2C4";
      drawStar(s.x, s.y, 6 * pulse);
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
      ctx.fillStyle = "rgba(170, 220, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y + wob, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 200, 250, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y + wob, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(b.x - 9, b.y + wob - 9, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCandy(): void {
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
    }
    const rot = (c.x - c.px) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(rot);
    ctx.fillStyle = "#FF6FA5";
    ctx.beginPath();
    ctx.moveTo(-CANDY_R - 9, -7);
    ctx.lineTo(-CANDY_R + 2, 0);
    ctx.lineTo(-CANDY_R - 9, 7);
    ctx.closePath();
    ctx.moveTo(CANDY_R + 9, -7);
    ctx.lineTo(CANDY_R - 2, 0);
    ctx.lineTo(CANDY_R + 9, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FF8FB1";
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R * 0.62, 0.3, Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R * 0.3, Math.PI, Math.PI * 2.1);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-5, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMonster(): void {
    const mx = level.monster.x;
    const my = level.monster.y;
    const bounce = phase === "won" ? Math.abs(Math.sin(phaseTime * 8)) * 6 : 0;
    const y = my - bounce;
    ctx.save();
    ctx.fillStyle = "#B48CE8";
    ctx.beginPath();
    ctx.arc(mx - 20, y - 26, 9, 0, Math.PI * 2);
    ctx.arc(mx + 20, y - 26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C7A6F2";
    ctx.beginPath();
    ctx.ellipse(mx, y, 32, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#DCC6FA";
    ctx.beginPath();
    ctx.ellipse(mx, y + 12, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    const c = candy();
    const lookX = candyGone ? 0 : Math.max(-3, Math.min(3, (c.x - mx) * 0.03));
    const lookY = candyGone ? 0 : Math.max(-3, Math.min(3, (c.y - y) * 0.03));
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
    const open = phase === "won" ? Math.max(0, 1 - phaseTime * 2) : mouthOpenAmount;
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
    ctx.fillStyle = "rgba(255, 150, 180, 0.5)";
    ctx.beginPath();
    ctx.arc(mx - 22, y + 2, 5, 0, Math.PI * 2);
    ctx.arc(mx + 22, y + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    if (phase === "won" && phaseTime < 1.2) {
      ctx.fillStyle = "rgba(255, 110, 150, " + (1 - phaseTime / 1.2) + ")";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💜", mx + 30, y - 34 - phaseTime * 30);
      ctx.textAlign = "left";
    }
    ctx.restore();
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
    if (phase === "won") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.roundRect(60, 170, 240, 120, 20);
      ctx.fill();
      ctx.fillStyle = overlayTextColor();
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("过关啦！", W / 2, 210);
      ctx.font = "26px sans-serif";
      const got = stars.filter((s) => s.collected).length;
      ctx.fillText("⭐".repeat(Math.max(1, got)) + "☆".repeat(3 - Math.max(1, got)), W / 2, 248);
      // 14px 深紫：小字对比 5.5:1（原 13px #9B7BC8 只有 3.5:1，不达 AA）
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#7a5aa8";
      ctx.fillText(
        levelIndex + 1 < LEVELS.length ? "马上进入下一关…" : "最后一关通过！",
        W / 2, 276
      );
      ctx.textAlign = "left";
    }
    if (phase === "failed") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.roundRect(50, 180, 260, 100, 20);
      ctx.fill();
      ctx.fillStyle = "#E0708C";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(failReason, W / 2, 220);
      ctx.font = "14px sans-serif";
      // 深紫：小字对比 5.5:1（原 #9B7BC8 只有 3.5:1，不达 AA）
      ctx.fillStyle = "#7a5aa8";
      ctx.fillText("点击画面重试本关", W / 2, 252);
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
    drawBalloons();
    drawStars();
    drawMonster();
    drawRopes();
    drawWinchAnchors();
    drawScissors();
    drawMoths();
    drawGremlins();
    drawCandy();
    drawSparkles(dt);
    drawTrail();
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

      if (phase === "won" && phaseTime > 1.8) {
        if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
        else showMap();
      }

      draw(frameDt);
    }
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------

  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let movedDist = 0;
  let downX = 0;
  let downY = 0;

  function toCanvas(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (screen !== "play") return;
    e.preventDefault();
    if (phase === "failed") {
      retryLevel();
      return;
    }
    pointerDown = true;
    const p = toCanvas(e);
    lastX = p.x;
    lastY = p.y;
    downX = p.x;
    downY = p.y;
    movedDist = 0;
    trail.push({ x: p.x, y: p.y, t: simTime });
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pointerDown || screen !== "play") return;
    const p = toCanvas(e);
    movedDist += Math.hypot(p.x - lastX, p.y - lastY);
    if (Math.hypot(p.x - lastX, p.y - lastY) > 0.5) {
      cutAt(lastX, lastY, p.x, p.y);
      trail.push({ x: p.x, y: p.y, t: simTime });
    }
    lastX = p.x;
    lastY = p.y;
  };

  const onPointerUp = (): void => {
    if (!pointerDown) return;
    pointerDown = false;
    if (movedDist < 12 && phase === "play") {
      // 轻点：先看是不是点了气球，否则试着戳破泡泡
      if (!tryPuff(downX, downY)) popBubble();
    }
  };

  const onPointerCancel = (): void => {
    // 系统手势打断:只收起划痕,不触发轻点动作
    pointerDown = false;
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

  showMap();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      stopSpeaking();
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      wrap.remove();
    },
  };
}
