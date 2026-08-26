/**
 * 弹弹小鸟 —— 拉开大弹弓,把捣蛋的绿绿豆全都弹走!
 *
 * - 99 关、6 个主题世界选关地图,通关解锁,可回放刷 3 星
 * - 4 种原创小鸟技能:糯糯(直球)/ 云云(分裂)/ 墩墩(下砸)/ 闪闪(加速钻)
 * - 自写 2D 弹弓 + 重力 + 方块破坏物理,不用任何物理引擎
 */
import { meta } from "./meta";
export { meta };

import {
  BALLOON_ROPE,
  CHAPTERS,
  LEVELS,
  chapterStartId,
  levelsOfChapter,
  type BirdKind,
  type BlockKind,
  type LevelDef,
  type PlatformDef,
  type SlopeDef,
  type WindDef
} from "./levels";
import {
  GRAVITY,
  GROUND_Y,
  MAX_DRAG,
  SLING_X,
  SLING_Y,
  WORLD_H,
  WORLD_W,
  calcStars,
  circleRectHit,
  circleSlopeHit,
  clamp,
  impactDamage,
  launchVelocity,
  simulateTrajectory,
  slopeSurfaceY
} from "./physics";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---------------- 小鸟资料(原创角色) ---------------- */

interface BirdInfo {
  name: string;
  skill: string;
  color: string;
  belly: string;
  dark: string;
  r: number;
  power: number;
  gfactor: number;
  hint: string;
}

const BIRD_INFO: Record<BirdKind, BirdInfo> = {
  straight: {
    name: "糯糯",
    skill: "直球",
    color: "#FFD9E6",
    belly: "#FFF1F6",
    dark: "#B36B85",
    r: 10,
    power: 1.25,
    gfactor: 0.75,
    hint: "糯糯又稳又结实:瞄准了直接弹出去!"
  },
  split: {
    name: "云云",
    skill: "分裂",
    color: "#D9CCF7",
    belly: "#F0EAFD",
    dark: "#7B68A8",
    r: 9,
    power: 0.95,
    gfactor: 1,
    hint: "飞行时点一下屏幕,云云会分裂成三朵小云!"
  },
  slam: {
    name: "墩墩",
    skill: "下砸",
    color: "#B5DDF9",
    belly: "#E3F3FE",
    dark: "#4E7FA6",
    r: 10,
    power: 1.05,
    gfactor: 1,
    hint: "飞行时点一下屏幕,墩墩会咚——地砸下来!"
  },
  drill: {
    name: "闪闪",
    skill: "加速钻",
    color: "#FFE0B0",
    belly: "#FFF2DC",
    dark: "#A87840",
    r: 8,
    power: 0.95,
    gfactor: 1,
    hint: "飞行时点一下屏幕,闪闪会加速往前钻!"
  }
};

/* ---------------- 方块材质 ---------------- */

interface MatInfo {
  hp: number;
  vuln: number;
  push: number;
  fill: string;
  edge: string;
}

const MAT: Record<BlockKind, MatInfo> = {
  wood: { hp: 40, vuln: 1, push: 0.55, fill: "#E8C08E", edge: "#C79A66" },
  stone: { hp: 90, vuln: 0.5, push: 0.28, fill: "#CDD2DC", edge: "#A6ADBC" },
  ice: { hp: 26, vuln: 1.5, push: 0.6, fill: "rgba(190,230,255,0.88)", edge: "#8FC6E8" },
  glass: { hp: 14, vuln: 2.6, push: 0.7, fill: "rgba(226,245,255,0.72)", edge: "#A5D8F0" },
  tnt: { hp: 10, vuln: 2.2, push: 0.5, fill: "#FFB3B9", edge: "#E2848D" }
};

const EXPLODE_R = 88;

/* ---------------- 本地进度(独立存档,不动平台存档) ---------------- */

const STORE_KEY = "yiduo-yixing.sling-birds.v2";

interface Progress {
  stars: Record<string, number>;
  resume: number | null;
  chapter: number;
}

function loadProgress(): Progress {
  const fallback: Progress = { stars: {}, resume: null, chapter: 0 };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
    const obj = JSON.parse(raw) as Partial<Progress>;
    const stars: Record<string, number> = {};
    if (obj.stars && typeof obj.stars === "object") {
      for (const [k, v] of Object.entries(obj.stars)) {
        const n = Number(v);
        if (Number.isFinite(n)) stars[k] = clamp(Math.round(n), 0, 3);
      }
    }
    return {
      stars,
      resume: typeof obj.resume === "number" ? obj.resume : null,
      chapter:
        typeof obj.chapter === "number"
          ? clamp(Math.round(obj.chapter), 0, CHAPTERS.length - 1)
          : 0
    };
  } catch {
    return fallback;
  }
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // 隐私模式等场景静默失败,进度只在本次会话内有效
  }
}

/* ---------------- 运行时实体 ---------------- */

interface RtBird {
  kind: BirdKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  power: number;
  gfactor: number;
  flying: boolean;
  dead: boolean;
  skillUsed: boolean;
  pierce: boolean;
  restT: number;
  age: number;
}

interface RtBlock {
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  supported: boolean;
}

interface RtBalloon {
  x: number;
  y: number;
  baseY: number;
  r: number;
  phase: number;
  popped: boolean;
  bean: RtBean;
}

interface RtBean {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  dead: boolean;
  held: RtBalloon | null;
}

interface RtBoulder {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
}

interface RtPlatform {
  def: PlatformDef;
  x: number;
  y: number;
  dxm: number;
  dym: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  square: boolean;
}

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;

  const progress = loadProgress();

  /* ---------------- DOM ---------------- */

  const wrap = document.createElement("div");
  wrap.className = "slb-wrap";
  wrap.innerHTML = `
    <style>
      /* 竖屏时画布只占舞台上部留大片空白(R2 观察项):撑满舞台高度,把地图/关卡视图垂直居中;
         矮屏内容超高时 auto margin 归零 + 纵向滚动,不裁顶部 */
      .slb-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAF6FF, #FFF4F9); border-radius: 20px; padding: 12px; max-width: 640px; margin: 0 auto; user-select: none; -webkit-user-select: none; height: 100%; display: flex; flex-direction: column; overflow-y: auto; }
      .slb-map, .slb-play { margin-top: auto; margin-bottom: auto; }
      .slb-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #5A82B0; box-shadow: 0 2px 6px rgba(120,160,220,.25); font-size: 13px; white-space: nowrap; }
      .slb-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
      .slb-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .slb-ctrl { display: flex; justify-content: center; gap: 12px; margin-top: 10px; }
      .slb-btn { border: none; border-radius: 16px; font-size: 15px; font-weight: 700; padding: 10px 18px; background: #BFE0FB; color: #2F5D8A; cursor: pointer; box-shadow: 0 4px 0 #97C4EC; touch-action: manipulation; }
      .slb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #97C4EC; }
      .slb-msg { text-align: center; min-height: 20px; color: #7A6FB0; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .slb-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin: 0 1px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.9); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
      .slb-map-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
      .slb-map-title { font-size: 20px; font-weight: 900; color: #4C7DB3; }
      .slb-tabs { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
      .slb-tab { flex: 1; min-width: 110px; border: none; border-radius: 16px; padding: 10px 6px; font-size: 14px; font-weight: 800; cursor: pointer; color: #56637F; background: #fff; box-shadow: 0 3px 0 rgba(150,170,210,.35); }
      .slb-tab.slb-on { color: #fff; background: linear-gradient(135deg, #7FB6F2, #A08BE8); box-shadow: 0 3px 0 #7A98D8; }
      .slb-tab:disabled { opacity: .55; cursor: not-allowed; }
      .slb-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
      .slb-cell { position: relative; border: none; border-radius: 14px; aspect-ratio: 1; font-size: 17px; font-weight: 900; cursor: pointer; background: #fff; color: #4C7DB3; box-shadow: 0 3px 0 rgba(150,170,210,.35); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 2px; }
      .slb-cell:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(150,170,210,.35); }
      .slb-cell.slb-lock { background: #E9EDF5; color: #A9B4C8; cursor: not-allowed; }
      .slb-cell.slb-next { background: linear-gradient(135deg, #FFE9A8, #FFC9DC); color: #8A5B2F; }
      .slb-cell .slb-stars { font-size: 9px; letter-spacing: -1px; line-height: 1; }
      .slb-map-tip { text-align: center; color: #8B94AE; font-weight: 700; font-size: 13px; margin-top: 12px; }
      .slb-crew { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
      .slb-crew span { background: #fff; border-radius: 12px; padding: 5px 9px; font-size: 12px; font-weight: 700; color: #56637F; box-shadow: 0 2px 5px rgba(120,160,220,.2); }
    </style>
    <div class="slb-map">
      <div class="slb-map-head">
        <span class="slb-map-title">🐦 弹弹小鸟</span>
        <span class="slb-badge slb-total">⭐ 0/180</span>
      </div>
      <div class="slb-tabs"></div>
      <div class="slb-grid"></div>
      <div class="slb-map-tip">打赢一关就解锁下一关,集满 3 星可以随时回来再挑战!</div>
      <div class="slb-crew">
        <span style="color:#B36B85">🩷 糯糯·直球</span>
        <span style="color:#7B68A8">💜 云云·分裂</span>
        <span style="color:#4E7FA6">💙 墩墩·下砸</span>
        <span style="color:#A87840">🧡 闪闪·加速钻</span>
      </div>
    </div>
    <div class="slb-play" style="display:none">
      <div class="slb-top">
        <span class="slb-badge slb-lvl"></span>
        <span class="slb-badge slb-birds"></span>
        <span class="slb-badge slb-beans"></span>
      </div>
      <canvas class="slb-canvas" width="${WORLD_W}" height="${WORLD_H}"></canvas>
      <div class="slb-ctrl">
        <button class="slb-btn slb-retry" type="button">↺ 重来</button>
        <button class="slb-btn slb-back" type="button">🗺️ 选关</button>
      </div>
      <div class="slb-msg"></div>
    </div>
  `;
  api.root.appendChild(wrap);

  const mapView = wrap.querySelector(".slb-map") as HTMLElement;
  const playView = wrap.querySelector(".slb-play") as HTMLElement;
  const tabsEl = wrap.querySelector(".slb-tabs") as HTMLElement;
  const gridEl = wrap.querySelector(".slb-grid") as HTMLElement;
  const totalEl = wrap.querySelector(".slb-total") as HTMLElement;
  const canvas = wrap.querySelector(".slb-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const lvlEl = wrap.querySelector(".slb-lvl") as HTMLElement;
  const birdsEl = wrap.querySelector(".slb-birds") as HTMLElement;
  const beansEl = wrap.querySelector(".slb-beans") as HTMLElement;
  const msgEl = wrap.querySelector(".slb-msg") as HTMLElement;
  const retryBtn = wrap.querySelector(".slb-retry") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".slb-back") as HTMLButtonElement;

  /* ---------------- 进度辅助 ---------------- */

  function starsOf(id: number): number {
    return progress.stars[String(id)] ?? 0;
  }

  function isUnlocked(id: number): boolean {
    return id === 1 || starsOf(id - 1) > 0;
  }

  function chapterUnlocked(c: number): boolean {
    return isUnlocked(chapterStartId(c));
  }

  /* ---------------- 选关地图 ---------------- */

  function renderMap(): void {
    const total = LEVELS.reduce((s, l) => s + starsOf(l.id), 0);
    totalEl.textContent = `⭐ ${total}/${LEVELS.length * 3}`;

    tabsEl.innerHTML = "";
    for (let c = 0; c < CHAPTERS.length; c++) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "slb-tab" + (c === progress.chapter ? " slb-on" : "");
      const open = chapterUnlocked(c);
      tab.textContent = `${CHAPTERS[c].emoji} ${CHAPTERS[c].name}${open ? "" : " 🔒"}`;
      tab.disabled = !open;
      tab.addEventListener("click", () => {
        api.play("tap");
        progress.chapter = c;
        saveProgress(progress);
        renderMap();
      });
      tabsEl.appendChild(tab);
    }

    gridEl.innerHTML = "";
    for (const l of levelsOfChapter(progress.chapter)) {
      const cell = document.createElement("button");
      cell.type = "button";
      const open = isUnlocked(l.id);
      const st = starsOf(l.id);
      cell.className =
        "slb-cell" + (!open ? " slb-lock" : st === 0 ? " slb-next" : "");
      cell.innerHTML = open
        ? `<span>${l.id}</span><span class="slb-stars">${"★".repeat(st)}${"☆".repeat(3 - st)}</span>`
        : `<span>🔒</span>`;
      cell.title = l.name;
      cell.disabled = !open;
      cell.addEventListener("click", () => {
        if (!isUnlocked(l.id)) return;
        api.play("tap");
        openLevel(l.id);
      });
      gridEl.appendChild(cell);
    }
  }

  function showMap(): void {
    progress.resume = null;
    saveProgress(progress);
    level = null;
    playView.style.display = "none";
    mapView.style.display = "";
    renderMap();
  }

  /* ---------------- 关卡运行时状态 ---------------- */

  let level: LevelDef | null = null;
  let blocks: RtBlock[] = [];
  let beans: RtBean[] = [];
  let boulders: RtBoulder[] = [];
  let balloons: RtBalloon[] = [];
  let platforms: RtPlatform[] = [];
  let slopes: SlopeDef[] = [];
  let winds: WindDef[] = [];
  let particles: Particle[] = [];
  let queue: BirdKind[] = [];
  let loadedBird: RtBird | null = null;
  let activeBirds: RtBird[] = [];
  let pendingBooms: Array<{ x: number; y: number }> = [];

  let phase: "aim" | "fly" | "won" | "lost" = "aim";
  let simT = 0;
  let shake = 0;
  let introT = 0;
  let endT = 0;
  let nextBirdT = 0;
  let loseWaitT = 0;
  let finishSent = false;
  let totalDestructible = 0;
  let destroyedCount = 0;
  let lastSound: Record<string, number> = {};

  let aiming = false;
  let aimPointer = -1;
  let dragX = 0;
  let dragY = 0;

  function playThrottled(name: SoundName, gap = 0.07): void {
    if (simT - (lastSound[name] ?? -1) < gap) return;
    lastSound[name] = simT;
    api.play(name);
  }

  function makeBird(kind: BirdKind): RtBird {
    const info = BIRD_INFO[kind];
    return {
      kind,
      x: SLING_X,
      y: SLING_Y,
      vx: 0,
      vy: 0,
      r: info.r,
      power: info.power,
      gfactor: info.gfactor,
      flying: false,
      dead: false,
      skillUsed: false,
      pierce: false,
      restT: 0,
      age: 0
    };
  }

  function openLevel(id: number): void {
    const def = LEVELS.find((l) => l.id === id);
    if (!def) {
      showMap();
      return;
    }
    level = def;
    progress.resume = id;
    progress.chapter = def.chapter;
    saveProgress(progress);

    blocks = def.blocks.map((b) => ({
      kind: b.kind,
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      vx: 0,
      vy: 0,
      hp: MAT[b.kind].hp,
      maxHp: MAT[b.kind].hp,
      dead: false,
      supported: false
    }));
    beans = def.beans.map((b) => ({ x: b.x, y: b.y, r: 10, vx: 0, vy: 0, dead: false, held: null }));
    balloons = (def.balloons ?? []).map((b, i) => {
      const bean: RtBean = { x: b.x, y: b.y + BALLOON_ROPE, r: 10, vx: 0, vy: 0, dead: false, held: null };
      const bal: RtBalloon = { x: b.x, y: b.y, baseY: b.y, r: 13, phase: i * 1.7, popped: false, bean };
      bean.held = bal;
      beans.push(bean);
      return bal;
    });
    boulders = (def.boulders ?? []).map((b) => ({ x: b.x, y: b.y, r: b.r, vx: 0, vy: 0, rot: 0 }));
    platforms = (def.platforms ?? []).map((p) => ({ def: p, x: p.x, y: p.y, dxm: 0, dym: 0 }));
    slopes = def.slopes ?? [];
    winds = def.winds ?? [];
    particles = [];
    pendingBooms = [];
    queue = [...def.birds];
    activeBirds = [];
    loadedBird = null;

    phase = "aim";
    simT = 0;
    shake = 0;
    introT = 2;
    endT = 0;
    nextBirdT = 0;
    loseWaitT = 0;
    finishSent = false;
    destroyedCount = 0;
    totalDestructible = blocks.length + balloons.length;
    lastSound = {};
    aiming = false;

    loadNextBird(false);
    mapView.style.display = "none";
    playView.style.display = "";
    updateHud();
  }

  function loadNextBird(chirp: boolean): void {
    const kind = queue.shift();
    if (!kind) {
      loadedBird = null;
      return;
    }
    loadedBird = makeBird(kind);
    phase = "aim";
    if (chirp) playThrottled("meow", 0.3);
    msgEl.textContent = `${BIRD_INFO[kind].name}(${BIRD_INFO[kind].skill}):${BIRD_INFO[kind].hint}`;
    updateHud();
  }

  /* ---------------- HUD ---------------- */

  function beansAlive(): number {
    return beans.filter((b) => !b.dead).length;
  }

  function updateHud(): void {
    if (!level) return;
    lvlEl.textContent = `${CHAPTERS[level.chapter].emoji} 第${level.id}关 ${level.name}`;
    const kinds: BirdKind[] = [];
    if (loadedBird && !loadedBird.flying) kinds.push(loadedBird.kind);
    kinds.push(...queue);
    birdsEl.innerHTML =
      "🐦 " +
      (kinds.length === 0
        ? "—"
        : kinds.map((k) => `<i class="slb-dot" style="background:${BIRD_INFO[k].color}"></i>`).join(""));
    beansEl.textContent = `🟢 剩 ${beansAlive()} 颗`;
  }

  /* ---------------- 粒子与特效 ---------------- */

  function burst(x: number, y: number, colors: string[], count: number, speed: number, square: boolean): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.35,
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
        size: square ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        square
      });
    }
  }

  function popBean(bean: RtBean): void {
    if (bean.dead) return;
    bean.dead = true;
    if (bean.held) bean.held.bean = bean;
    burst(bean.x, bean.y, ["#A5D96C", "#7FBF4D", "#D3F0A8", "#FFFFFF"], 14, 150, false);
    playThrottled("coin", 0.03);
    updateHud();
  }

  function popBalloon(bal: RtBalloon): void {
    if (bal.popped) return;
    bal.popped = true;
    destroyedCount++;
    if (!bal.bean.dead && bal.bean.held === bal) bal.bean.held = null;
    burst(bal.x, bal.y, ["#FFC1D8", "#FFE3A9", "#C9E8FF"], 12, 130, false);
    playThrottled("pop", 0.03);
  }

  function destroyBlock(block: RtBlock): void {
    if (block.dead) return;
    block.dead = true;
    destroyedCount++;
    const m = MAT[block.kind];
    burst(block.x + block.w / 2, block.y + block.h / 2, [m.fill, m.edge, "#FFFFFF"], 12, 140, true);
    if (block.kind === "tnt") {
      pendingBooms.push({ x: block.x + block.w / 2, y: block.y + block.h / 2 });
    } else {
      playThrottled("pop", 0.05);
    }
  }

  function explode(cx: number, cy: number): void {
    shake = Math.max(shake, 0.5);
    burst(cx, cy, ["#FFB864", "#FF8FA0", "#FFE9A8", "#FFFFFF"], 26, 260, false);
    playThrottled("pop", 0);
    playThrottled("oops", 0.02);
    for (const bl of blocks) {
      if (bl.dead) continue;
      const bx = bl.x + bl.w / 2;
      const by = bl.y + bl.h / 2;
      const d = Math.hypot(bx - cx, by - cy);
      if (d > EXPLODE_R + Math.max(bl.w, bl.h) / 2) continue;
      const fall = 1 - clamp(d / (EXPLODE_R + 20), 0, 1);
      bl.hp -= 110 * fall * (0.6 + MAT[bl.kind].vuln * 0.4);
      const dn = Math.max(d, 8);
      bl.vx += ((bx - cx) / dn) * 340 * fall;
      bl.vy += ((by - cy) / dn) * 300 * fall - 90 * fall;
      if (bl.hp <= 0) destroyBlock(bl);
    }
    for (const bean of beans) {
      if (!bean.dead && Math.hypot(bean.x - cx, bean.y - cy) < EXPLODE_R + bean.r) popBean(bean);
    }
    for (const bal of balloons) {
      if (!bal.popped && Math.hypot(bal.x - cx, bal.y - cy) < EXPLODE_R + bal.r) popBalloon(bal);
    }
    for (const bo of boulders) {
      const d = Math.hypot(bo.x - cx, bo.y - cy);
      if (d < EXPLODE_R + bo.r) {
        const dn = Math.max(d, 8);
        bo.vx += ((bo.x - cx) / dn) * 240;
        bo.vy += ((bo.y - cy) / dn) * 200 - 60;
      }
    }
    for (const bird of activeBirds) {
      if (bird.dead) continue;
      const d = Math.hypot(bird.x - cx, bird.y - cy);
      if (d < EXPLODE_R + bird.r) {
        const dn = Math.max(d, 8);
        bird.vx += ((bird.x - cx) / dn) * 180;
        bird.vy += ((bird.y - cy) / dn) * 160 - 40;
      }
    }
  }

  /* ---------------- 技能 ---------------- */

  function triggerSkill(): void {
    const bird = activeBirds.find((b) => !b.dead && b.flying && !b.skillUsed && b.kind !== "straight");
    if (!bird) return;
    bird.skillUsed = true;
    if (bird.kind === "split") {
      bird.r = 7;
      bird.power = 0.6;
      const sp = Math.hypot(bird.vx, bird.vy);
      const a = Math.atan2(bird.vy, bird.vx);
      for (const off of [-0.3, 0.3]) {
        const clone = makeBird("split");
        clone.flying = true;
        clone.skillUsed = true;
        clone.r = 7;
        clone.power = 0.6;
        clone.x = bird.x;
        clone.y = bird.y + (off < 0 ? -6 : 6);
        clone.vx = Math.cos(a + off) * sp;
        clone.vy = Math.sin(a + off) * sp;
        activeBirds.push(clone);
      }
      burst(bird.x, bird.y, ["#D9CCF7", "#FFFFFF", "#B9A8ED"], 12, 120, false);
      msgEl.textContent = "云云分裂!三朵小云一起冲!";
    } else if (bird.kind === "slam") {
      bird.vx *= 0.2;
      bird.vy = Math.max(bird.vy, 0) + 520;
      bird.power *= 1.75;
      burst(bird.x, bird.y, ["#B5DDF9", "#FFFFFF"], 10, 110, false);
      msgEl.textContent = "墩墩下砸!咚——!";
    } else if (bird.kind === "drill") {
      const sp = Math.max(Math.hypot(bird.vx, bird.vy), 60);
      const scale = Math.min(900, sp * 1.75) / sp;
      bird.vx *= scale;
      bird.vy *= scale;
      bird.pierce = true;
      bird.power *= 1.45;
      burst(bird.x, bird.y, ["#FFE0B0", "#FFC978", "#FFFFFF"], 10, 110, false);
      msgEl.textContent = "闪闪加速钻!嗖——!";
    }
    playThrottled("tap", 0);
  }

  /* ---------------- 物理 ---------------- */

  function stepPlatforms(h: number): void {
    for (const p of platforms) {
      const t = (simT * Math.PI * 2) / p.def.period;
      const nx = p.def.x + p.def.dx * Math.sin(t);
      const ny = p.def.y + p.def.dy * Math.sin(t);
      p.dxm = nx - p.x;
      p.dym = ny - p.y;
      p.x = nx;
      p.y = ny;
    }
    void h;
  }

  function stepBlocks(h: number): void {
    for (const bl of blocks) {
      if (bl.dead) continue;
      bl.vy += GRAVITY * h;
      bl.x += bl.vx * h;
      bl.y += bl.vy * h;
      bl.supported = false;

      // 地面(摩擦按时间衰减,与子步频率无关)
      if (bl.y + bl.h > GROUND_Y) {
        const impact = bl.vy;
        bl.y = GROUND_Y - bl.h;
        bl.vy = 0;
        bl.vx *= Math.exp((bl.kind === "ice" ? -0.9 : -6) * h);
        bl.supported = true;
        if (impact > 240) {
          bl.hp -= (impact - 240) * 0.18 * MAT[bl.kind].vuln;
          if (bl.hp <= 0) destroyBlock(bl);
        }
      }
      // 斜坡(近似:块底中心贴着坡面)
      for (const s of slopes) {
        const cx = bl.x + bl.w / 2;
        if (cx < s.x || cx > s.x + s.w) continue;
        const sy = slopeSurfaceY(s, cx);
        if (bl.y + bl.h > sy && bl.y + bl.h < sy + 26) {
          bl.y = sy - bl.h;
          bl.vy = 0;
          bl.vx += (s.dir === "up-right" ? -1 : 1) * 60 * h;
          bl.supported = true;
        }
      }
      // 移动平台:站上去就跟着走
      for (const p of platforms) {
        if (bl.vy >= -1 && bl.x + bl.w > p.x + 4 && bl.x < p.x + p.def.w - 4) {
          const bottom = bl.y + bl.h;
          if (bottom > p.y - 2 && bottom < p.y + p.def.h + 8) {
            bl.y = p.y - bl.h;
            bl.vy = 0;
            bl.x += p.dxm;
            bl.supported = true;
          }
        }
      }
    }

    // 方块互相堆叠(两轮迭代,轴向最小分离)
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < blocks.length; i++) {
        const a = blocks[i];
        if (a.dead) continue;
        for (let j = i + 1; j < blocks.length; j++) {
          const b = blocks[j];
          if (b.dead) continue;
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (ox <= 0 || oy <= 0) continue;
          const relV = Math.hypot(a.vx - b.vx, a.vy - b.vy);
          if (relV > 260) {
            const dmg = (relV - 260) * 0.12;
            a.hp -= dmg * MAT[a.kind].vuln;
            b.hp -= dmg * MAT[b.kind].vuln;
            if (a.hp <= 0) destroyBlock(a);
            if (b.hp <= 0) destroyBlock(b);
            if (a.dead || b.dead) continue;
          }
          if (oy <= ox) {
            const top = a.y < b.y ? a : b;
            const bot = top === a ? b : a;
            if (bot.supported || bot.vy === 0) {
              top.y -= oy;
              top.vy = Math.min(top.vy, 0);
              top.vy = 0;
              top.supported = true;
              top.vx = top.vx * 0.6 + bot.vx * 0.4;
            } else {
              top.y -= oy / 2;
              bot.y += oy / 2;
              const avg = (top.vy + bot.vy) / 2;
              top.vy = avg;
              bot.vy = avg;
            }
          } else {
            const push = ox / 2;
            if (a.x < b.x) {
              a.x -= push;
              b.x += push;
            } else {
              a.x += push;
              b.x -= push;
            }
            const avg = (a.vx + b.vx) / 2;
            a.vx = avg;
            b.vx = avg;
          }
        }
      }
    }
  }

  function stepBoulders(h: number): void {
    for (const bo of boulders) {
      bo.vy += GRAVITY * h;
      bo.x += bo.vx * h;
      bo.y += bo.vy * h;
      bo.rot += (bo.vx / bo.r) * h;

      if (bo.y + bo.r > GROUND_Y) {
        bo.y = GROUND_Y - bo.r;
        bo.vy = bo.vy > 90 ? -bo.vy * 0.2 : 0;
        bo.vx *= Math.exp(-0.5 * h);
      }
      if (bo.x < bo.r + 4) {
        bo.x = bo.r + 4;
        bo.vx = Math.abs(bo.vx) * 0.4;
      }
      if (bo.x > WORLD_W - bo.r - 4) {
        bo.x = WORLD_W - bo.r - 4;
        bo.vx = -Math.abs(bo.vx) * 0.4;
      }
      for (const s of slopes) {
        const hit = circleSlopeHit(bo.x, bo.y, bo.r, s);
        if (hit) {
          bo.x += hit.nx * hit.depth;
          bo.y += hit.ny * hit.depth;
          const vn = bo.vx * hit.nx + bo.vy * hit.ny;
          if (vn < 0) {
            bo.vx -= hit.nx * vn;
            bo.vy -= hit.ny * vn;
          }
        }
      }
      for (const bl of blocks) {
        if (bl.dead) continue;
        const hit = circleRectHit(bo.x, bo.y, bo.r, bl.x, bl.y, bl.w, bl.h);
        if (!hit) continue;
        const relVx = bo.vx - bl.vx;
        const relVy = bo.vy - bl.vy;
        const rel = relVx * hit.nx + relVy * hit.ny;
        bo.x += hit.nx * hit.depth;
        bo.y += hit.ny * hit.depth;
        if (rel < 0) {
          const speed = -rel;
          if (speed > 110) {
            bl.hp -= impactDamage(speed, 1.5, MAT[bl.kind].vuln);
            bl.vx -= hit.nx * speed * 0.6;
            bl.vy -= hit.ny * speed * 0.4;
            if (bl.hp <= 0) destroyBlock(bl);
            playThrottled("tap", 0.1);
          }
          bo.vx -= hit.nx * rel * 1.25;
          bo.vy -= hit.ny * rel * 1.25;
          bo.vx *= 0.9;
          bo.vy *= 0.9;
        }
      }
      for (const bean of beans) {
        if (bean.dead || bean.held) continue;
        if (Math.hypot(bean.x - bo.x, bean.y - bo.y) < bean.r + bo.r) {
          const rel = Math.hypot(bo.vx - bean.vx, bo.vy - bean.vy);
          if (rel > 55) popBean(bean);
        }
      }
    }
  }

  function stepBalloons(): void {
    for (const bal of balloons) {
      if (bal.popped) continue;
      bal.y = bal.baseY + Math.sin(simT * 2 + bal.phase) * 3;
      if (!bal.bean.dead && bal.bean.held === bal) {
        bal.bean.x = bal.x + Math.sin(simT * 1.6 + bal.phase) * 2;
        bal.bean.y = bal.y + BALLOON_ROPE;
      }
      for (const bird of activeBirds) {
        if (!bird.dead && bird.flying && Math.hypot(bird.x - bal.x, bird.y - bal.y) < bird.r + bal.r) {
          popBalloon(bal);
          break;
        }
      }
      if (bal.popped) continue;
      for (const bl of blocks) {
        if (bl.dead) continue;
        if (
          Math.hypot(bl.vx, bl.vy) > 90 &&
          circleRectHit(bal.x, bal.y, bal.r, bl.x, bl.y, bl.w, bl.h)
        ) {
          popBalloon(bal);
          break;
        }
      }
    }
  }

  function stepBeans(h: number): void {
    for (const bean of beans) {
      if (bean.dead || bean.held) continue;
      bean.vy += GRAVITY * h;
      bean.x += bean.vx * h;
      bean.y += bean.vy * h;

      if (bean.x < -20 || bean.x > WORLD_W + 20 || bean.y > WORLD_H + 30) {
        popBean(bean);
        continue;
      }
      if (bean.y + bean.r > GROUND_Y) {
        if (bean.vy > 300) {
          popBean(bean);
          continue;
        }
        bean.y = GROUND_Y - bean.r;
        bean.vy = bean.vy > 70 ? -bean.vy * 0.25 : 0;
        bean.vx *= Math.exp(-4 * h);
      }
      for (const s of slopes) {
        const hit = circleSlopeHit(bean.x, bean.y, bean.r, s);
        if (hit) {
          bean.x += hit.nx * hit.depth;
          bean.y += hit.ny * hit.depth;
          const vn = bean.vx * hit.nx + bean.vy * hit.ny;
          if (vn < 0) {
            bean.vx -= hit.nx * vn;
            bean.vy -= hit.ny * vn;
          }
        }
      }
      for (const p of platforms) {
        const hit = circleRectHit(bean.x, bean.y, bean.r, p.x, p.y, p.def.w, p.def.h);
        if (hit && hit.ny < -0.5 && bean.vy >= 0) {
          bean.y = p.y - bean.r;
          bean.vy = 0;
          bean.x += p.dxm;
          if (p.dym > 0) bean.y += p.dym;
        }
      }
      for (const bl of blocks) {
        if (bl.dead) continue;
        const hit = circleRectHit(bean.x, bean.y, bean.r, bl.x, bl.y, bl.w, bl.h);
        if (!hit) continue;
        const rel = Math.hypot(bean.vx - bl.vx, bean.vy - bl.vy);
        if (rel > 95 || hit.depth > 7) {
          popBean(bean);
          break;
        }
        bean.x += hit.nx * hit.depth;
        bean.y += hit.ny * hit.depth;
        const vn = (bean.vx - bl.vx) * hit.nx + (bean.vy - bl.vy) * hit.ny;
        if (vn < 0) {
          bean.vx -= hit.nx * vn;
          bean.vy -= hit.ny * vn;
        }
      }
    }
  }

  function stepBirds(h: number): void {
    for (const bird of activeBirds) {
      if (bird.dead || !bird.flying) continue;
      bird.age += h;

      for (const w of winds) {
        if (bird.x > w.x && bird.x < w.x + w.w && bird.y > w.y && bird.y < w.y + w.h) {
          bird.vx += w.fx * h;
          bird.vy += w.fy * h;
        }
      }
      bird.vy += GRAVITY * bird.gfactor * h;
      bird.x += bird.vx * h;
      bird.y += bird.vy * h;

      if (bird.pierce && Math.hypot(bird.vx, bird.vy) < 150) bird.pierce = false;

      // 地面
      let onGround = false;
      if (bird.y + bird.r > GROUND_Y) {
        bird.y = GROUND_Y - bird.r;
        if (bird.vy > 70) {
          bird.vy = -bird.vy * 0.36;
          bird.vx *= 0.82;
          playThrottled("tap", 0.12);
          burst(bird.x, GROUND_Y, ["#FFFFFF", "#EFE6D8"], 4, 60, false);
        } else {
          bird.vy = 0;
          // 落地后继续往前滚,慢慢停下
          bird.vx *= Math.exp(-1.9 * h);
        }
        onGround = true;
      }
      if (bird.x < bird.r && bird.vx < 0) {
        bird.x = bird.r;
        bird.vx = Math.abs(bird.vx) * 0.4;
      }
      // 斜坡
      for (const s of slopes) {
        const hit = circleSlopeHit(bird.x, bird.y, bird.r, s);
        if (hit) {
          bird.x += hit.nx * hit.depth;
          bird.y += hit.ny * hit.depth;
          const vn = bird.vx * hit.nx + bird.vy * hit.ny;
          if (vn < 0) {
            bird.vx -= hit.nx * vn * 1.3;
            bird.vy -= hit.ny * vn * 1.3;
            bird.vx *= 0.94;
            bird.vy *= 0.94;
          }
          onGround = true;
        }
      }
      // 移动平台
      for (const p of platforms) {
        const hit = circleRectHit(bird.x, bird.y, bird.r, p.x, p.y, p.def.w, p.def.h);
        if (hit) {
          bird.x += hit.nx * hit.depth;
          bird.y += hit.ny * hit.depth;
          const vn = bird.vx * hit.nx + bird.vy * hit.ny;
          if (vn < 0) {
            bird.vx -= hit.nx * vn * 1.4;
            bird.vy -= hit.ny * vn * 1.4;
            playThrottled("tap", 0.12);
          }
        }
      }
      // 方块
      for (const bl of blocks) {
        if (bl.dead) continue;
        const hit = circleRectHit(bird.x, bird.y, bird.r, bl.x, bl.y, bl.w, bl.h);
        if (!hit) continue;
        const relVx = bird.vx - bl.vx;
        const relVy = bird.vy - bl.vy;
        const rel = relVx * hit.nx + relVy * hit.ny;
        bird.x += hit.nx * hit.depth;
        bird.y += hit.ny * hit.depth;
        if (rel < 0) {
          const speed = -rel;
          const m = MAT[bl.kind];
          bl.hp -= impactDamage(speed, bird.power, m.vuln);
          bl.vx -= hit.nx * speed * m.push;
          bl.vy -= hit.ny * speed * m.push * 0.7;
          const died = bl.hp <= 0;
          if (died) destroyBlock(bl);
          if (died) {
            // 打碎方块:损失一点速度,继续往前冲(钻头模式几乎不减速)
            const keep = bird.pierce ? 0.9 : 0.72;
            bird.vx *= keep;
            bird.vy *= keep;
          } else {
            bird.vx -= hit.nx * rel * 1.34;
            bird.vy -= hit.ny * rel * 1.34;
            bird.vx *= 0.94;
            bird.vy *= 0.94;
          }
          if (speed > 60) playThrottled(bl.kind === "glass" || bl.kind === "ice" ? "pop" : "tap", 0.08);
        }
      }
      // 滚石
      for (const bo of boulders) {
        const d = Math.hypot(bird.x - bo.x, bird.y - bo.y);
        if (d < bird.r + bo.r && d > 0.01) {
          const nx = (bird.x - bo.x) / d;
          const ny = (bird.y - bo.y) / d;
          const depth = bird.r + bo.r - d;
          bird.x += nx * depth;
          bird.y += ny * depth;
          const rel = (bird.vx - bo.vx) * nx + (bird.vy - bo.vy) * ny;
          if (rel < 0) {
            bo.vx += nx * rel * 0.7;
            bo.vy += ny * rel * 0.4;
            bird.vx -= nx * rel * 1.2;
            bird.vy -= ny * rel * 1.2;
            playThrottled("tap", 0.1);
          }
        }
      }
      // 绿绿豆
      for (const bean of beans) {
        if (bean.dead) continue;
        if (Math.hypot(bird.x - bean.x, bird.y - bean.y) < bird.r + bean.r) {
          if (Math.hypot(bird.vx, bird.vy) > 26) popBean(bean);
        }
      }

      // 停下 / 出界 → 这只小鸟退场
      const sp = Math.hypot(bird.vx, bird.vy);
      if (onGround && sp < 26) bird.restT += h;
      else bird.restT = 0;
      if (bird.restT > 0.85 || bird.age > 12 || bird.x > WORLD_W + 40 || bird.y > WORLD_H + 60) {
        bird.dead = true;
        if (bird.x < WORLD_W + 20 && bird.y < WORLD_H + 20) {
          burst(bird.x, bird.y, ["#FFFFFF", BIRD_INFO[bird.kind].color], 8, 90, false);
        }
      }
    }
  }

  function stepWorld(h: number): void {
    simT += h;
    stepPlatforms(h);
    stepBlocks(h);
    stepBoulders(h);
    stepBalloons();
    stepBeans(h);
    stepBirds(h);
    while (pendingBooms.length > 0) {
      const boom = pendingBooms.shift();
      if (boom) explode(boom.x, boom.y);
    }
  }

  function worldCalm(): boolean {
    for (const bl of blocks) {
      if (!bl.dead && Math.hypot(bl.vx, bl.vy) > 26) return false;
    }
    for (const bean of beans) {
      if (!bean.dead && !bean.held && Math.hypot(bean.vx, bean.vy) > 26) return false;
    }
    // 滚石还在滚就可能撞倒方块/压到豆子,先别急着判负
    for (const bo of boulders) {
      if (Math.hypot(bo.vx, bo.vy) > 26) return false;
    }
    return true;
  }

  function birdsRemaining(): number {
    return queue.length + (loadedBird && !loadedBird.flying ? 1 : 0);
  }

  function finishWin(): void {
    if (finishSent || !level) return;
    finishSent = true;
    const left = birdsRemaining();
    const ratio = totalDestructible > 0 ? destroyedCount / totalDestructible : 1;
    const stars = calcStars(left, ratio);
    const key = String(level.id);
    progress.stars[key] = Math.max(progress.stars[key] ?? 0, stars);
    const next = LEVELS.find((l) => l.id === level!.id + 1);
    progress.resume = next ? next.id : null;
    saveProgress(progress);
    msgEl.textContent = "🎉 绿绿豆全被弹走啦!";
    const detail =
      left >= 2
        ? `还省下 ${left} 只小鸟,真是神射手!`
        : left === 1
          ? "还留了一只小鸟,好厉害!"
          : `破坏率 ${Math.round(ratio * 100)}%,拆得真彻底!`;
    api.onWin(stars, `第 ${level.id} 关「${level.name}」通关!${detail}`);
  }

  function finishLose(): void {
    if (finishSent || !level) return;
    finishSent = true;
    msgEl.textContent = "小鸟用完啦,再试一次!";
    api.onLose(`还剩 ${beansAlive()} 颗绿绿豆,换个角度、试试技能,再来一次一定行!`);
  }

  function updateFlow(dt: number): void {
    if (!level || finishSent) return;

    if (phase !== "won" && phase !== "lost" && beansAlive() === 0) {
      phase = "won";
      endT = 0;
      shake = Math.max(shake, 0.25);
    }

    if (phase === "won") {
      endT += dt;
      if (endT > 0.8) finishWin();
      return;
    }
    if (phase === "lost") {
      endT += dt;
      if (endT > 0.6) finishLose();
      return;
    }

    if (phase === "fly") {
      const allDone = activeBirds.every((b) => b.dead);
      if (!allDone) {
        nextBirdT = 0;
        loseWaitT = 0;
        return;
      }
      if (queue.length > 0) {
        nextBirdT += dt;
        if (nextBirdT > 0.55) {
          nextBirdT = 0;
          loadNextBird(true);
        }
      } else {
        // 小鸟用完但场上还在动:等一切静止再判负(至少缓冲 0.6s,最长 3s 超时)
        loseWaitT += dt;
        if ((loseWaitT > 0.6 && worldCalm()) || loseWaitT > 3) {
          phase = "lost";
          endT = 0;
          playThrottled("oops", 0);
        }
      }
    }
  }

  /* ---------------- 输入 ---------------- */

  function canvasPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WORLD_W,
      y: ((e.clientY - rect.top) / rect.height) * WORLD_H
    };
  }

  function onPointerDown(e: PointerEvent): void {
    if (!level || finishSent) return;
    e.preventDefault();
    if (phase === "aim" && loadedBird && !loadedBird.flying && !aiming) {
      aiming = true;
      aimPointer = e.pointerId;
      // 捕获指针:手指拖出画布甚至拖出窗口都保持拉弓状态
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // 部分旧浏览器不支持,拖出画布时靠 window 监听兜底
      }
      const p = canvasPos(e);
      setDrag(p.x, p.y);
    } else if (phase === "fly") {
      triggerSkill();
    }
  }

  function setDrag(px: number, py: number): void {
    let dx = px - SLING_X;
    let dy = py - SLING_Y;
    const d = Math.hypot(dx, dy);
    if (d > MAX_DRAG) {
      dx = (dx / d) * MAX_DRAG;
      dy = (dy / d) * MAX_DRAG;
    }
    dragX = dx;
    dragY = dy;
    if (loadedBird) {
      loadedBird.x = SLING_X + dx;
      loadedBird.y = SLING_Y + dy;
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!aiming || e.pointerId !== aimPointer) return;
    const p = canvasPos(e);
    setDrag(p.x, p.y);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!aiming || e.pointerId !== aimPointer) return;
    aiming = false;
    aimPointer = -1;
    if (!loadedBird || finishSent) return;
    if (Math.hypot(dragX, dragY) < 13) {
      loadedBird.x = SLING_X;
      loadedBird.y = SLING_Y;
      return;
    }
    const v = launchVelocity(dragX, dragY);
    loadedBird.vx = v.vx;
    loadedBird.vy = v.vy;
    loadedBird.flying = true;
    activeBirds.push(loadedBird);
    loadedBird = null;
    phase = "fly";
    api.play("jump");
    msgEl.textContent =
      activeBirds[activeBirds.length - 1].kind === "straight"
        ? "糯糯出发!笔直冲——"
        : "小鸟出发!飞行中点一下屏幕发动技能!";
    dragX = 0;
    dragY = 0;
    updateHud();
  }

  function onPointerCancel(e: PointerEvent): void {
    // 系统手势打断(来电、通知栏下拉等):小鸟放回弹弓,拉弓状态不丢
    if (!aiming || e.pointerId !== aimPointer) return;
    aiming = false;
    aimPointer = -1;
    dragX = 0;
    dragY = 0;
    if (loadedBird) {
      loadedBird.x = SLING_X;
      loadedBird.y = SLING_Y;
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === " " || e.key === "Enter") {
      if (phase === "fly" && !finishSent) {
        triggerSkill();
        e.preventDefault();
      }
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKeyDown);

  retryBtn.addEventListener("click", () => {
    if (!level) return;
    api.play("tap");
    openLevel(level.id);
  });
  backBtn.addEventListener("click", () => {
    api.play("tap");
    showMap();
  });

  /* ---------------- 渲染 ---------------- */

  /** 把 #rrggbb 变深/变浅(amt 为 -255..255) */
  function shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  const CH_STYLE = [
    { skyTop: "#D8F3FF", skyBot: "#F2FFE3", ground: "#B7E39B", groundEdge: "#96CE7A", hill: "#CBEDB0" },
    { skyTop: "#CFF0FF", skyBot: "#FFF6DC", ground: "#F6E0A8", groundEdge: "#E3C685", hill: "#BDE8F2" },
    { skyTop: "#DCE9FB", skyBot: "#FFFFFF", ground: "#EEF4FB", groundEdge: "#CFDFF0", hill: "#E4EEF9" },
    { skyTop: "#3B4879", skyBot: "#7D89C4", ground: "#8F97CE", groundEdge: "#737DB8", hill: "#5E6AA6" },
    { skyTop: "#57334A", skyBot: "#E08356", ground: "#8A5148", groundEdge: "#6E3E38", hill: "#B05548" },
    { skyTop: "#BFE3FF", skyBot: "#FFE9F4", ground: "#F0E9FF", groundEdge: "#D7C7F2", hill: "#E6F4FF" }
  ];

  function drawBg(c: CanvasRenderingContext2D, chapter: number): void {
    const st = CH_STYLE[chapter];
    const grad = c.createLinearGradient(0, 0, 0, WORLD_H);
    grad.addColorStop(0, st.skyTop);
    grad.addColorStop(1, st.skyBot);
    c.fillStyle = grad;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    if (chapter === 0) {
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(120, GROUND_Y + 24, 180, 60, 0, Math.PI, 0);
      c.ellipse(420, GROUND_Y + 30, 220, 74, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "#FFE9A8";
      c.beginPath();
      c.arc(490, 44, 24, 0, Math.PI * 2);
      c.fill();
    } else if (chapter === 1) {
      c.fillStyle = "#FFDE8A";
      c.beginPath();
      c.arc(478, 48, 26, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(60, GROUND_Y - 4, 130, 26, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "rgba(255,255,255,.7)";
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(90 + i * 160, 60 + (i % 2) * 26, 30, 11, 0, 0, Math.PI * 2);
        c.fill();
      }
    } else if (chapter === 2) {
      c.fillStyle = st.hill;
      c.beginPath();
      c.ellipse(140, GROUND_Y + 20, 200, 66, 0, Math.PI, 0);
      c.ellipse(440, GROUND_Y + 26, 200, 80, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 22; i++) {
        const sx = ((i * 97) % WORLD_W) + Math.sin(simT * 0.7 + i) * 8;
        const sy = ((i * 53 + simT * 26) % (GROUND_Y + 20));
        c.beginPath();
        c.arc(sx, sy, i % 3 === 0 ? 2.4 : 1.6, 0, Math.PI * 2);
        c.fill();
      }
    } else if (chapter === 3) {
      c.fillStyle = "#FFF3B8";
      c.beginPath();
      c.arc(480, 52, 24, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = st.skyTop;
      c.beginPath();
      c.arc(470, 46, 20, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,240,.9)";
      for (let i = 0; i < 26; i++) {
        const tw = 0.5 + 0.5 * Math.sin(simT * 2 + i * 1.3);
        c.globalAlpha = 0.35 + tw * 0.6;
        c.beginPath();
        c.arc(((i * 83) % WORLD_W), (i * 37) % 190, i % 4 === 0 ? 2 : 1.3, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    } else if (chapter === 4) {
      // 火山峡谷:远处火山口 + 飘升的火星
      c.fillStyle = st.hill;
      c.beginPath();
      c.moveTo(360, GROUND_Y);
      c.lineTo(440, 90);
      c.lineTo(468, 90);
      c.lineTo(540, GROUND_Y);
      c.closePath();
      c.fill();
      c.fillStyle = "#FFB65C";
      c.beginPath();
      c.ellipse(454, 90, 20, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,150,70,.85)";
      for (let i = 0; i < 12; i++) {
        const t = (simT * 30 + i * 47) % 140;
        const ex = 454 + Math.sin(simT * 1.4 + i * 2.1) * (10 + i * 3);
        c.globalAlpha = 0.75 - (t / 140) * 0.7;
        c.beginPath();
        c.arc(ex, 86 - t, i % 3 === 0 ? 3 : 2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    } else {
      // 彩虹云端:大彩虹拱 + 飘飘白云
      const arc = ["#FF9E9E", "#FFCE8A", "#FFF3A8", "#B4E8A5", "#A5D4F5", "#CBB2F0"];
      c.lineWidth = 10;
      for (let i = 0; i < arc.length; i++) {
        c.strokeStyle = arc[i];
        c.globalAlpha = 0.55;
        c.beginPath();
        c.arc(WORLD_W / 2, GROUND_Y + 210, 330 - i * 11, Math.PI * 1.2, Math.PI * 1.8);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 4; i++) {
        const drift = ((simT * 9 + i * 150) % (WORLD_W + 120)) - 60;
        const cy = 46 + i * 58;
        c.beginPath();
        c.arc(drift, cy, 16, 0, Math.PI * 2);
        c.arc(drift + 19, cy - 7, 12, 0, Math.PI * 2);
        c.arc(drift + 37, cy, 14, 0, Math.PI * 2);
        c.fill();
      }
    }

    // 地面
    c.fillStyle = st.ground;
    c.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
    c.fillStyle = st.groundEdge;
    c.fillRect(0, GROUND_Y, WORLD_W, 5);
  }

  function drawWinds(c: CanvasRenderingContext2D): void {
    for (const w of winds) {
      c.fillStyle = "rgba(180,225,255,0.20)";
      c.beginPath();
      c.roundRect(w.x, w.y, w.w, w.h, 14);
      c.fill();
      c.strokeStyle = "rgba(140,200,245,0.8)";
      c.lineWidth = 2;
      const ang = Math.atan2(w.fy, w.fx);
      const speed = 42;
      for (let i = 0; i < 7; i++) {
        const t = (simT * speed + i * 31) % 60;
        const bx = w.x + ((i * 67) % Math.max(w.w - 20, 10)) + 10;
        const by = w.y + ((i * 41) % Math.max(w.h - 20, 10)) + 10;
        const px = bx + Math.cos(ang) * t;
        const py = by + Math.sin(ang) * t;
        c.globalAlpha = 0.7 - (t / 60) * 0.6;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px - Math.cos(ang) * 13, py - Math.sin(ang) * 13);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  function drawSlopes(c: CanvasRenderingContext2D, chapter: number): void {
    const st = CH_STYLE[chapter];
    for (const s of slopes) {
      c.fillStyle = st.ground;
      c.beginPath();
      if (s.dir === "up-right") {
        c.moveTo(s.x, s.y + s.h);
        c.lineTo(s.x + s.w, s.y);
        c.lineTo(s.x + s.w, s.y + s.h);
      } else {
        c.moveTo(s.x, s.y);
        c.lineTo(s.x + s.w, s.y + s.h);
        c.lineTo(s.x, s.y + s.h);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = st.groundEdge;
      c.lineWidth = 4;
      c.beginPath();
      if (s.dir === "up-right") {
        c.moveTo(s.x, s.y + s.h);
        c.lineTo(s.x + s.w, s.y);
      } else {
        c.moveTo(s.x, s.y);
        c.lineTo(s.x + s.w, s.y + s.h);
      }
      c.stroke();
    }
  }

  function drawPlatforms(c: CanvasRenderingContext2D): void {
    for (const p of platforms) {
      c.strokeStyle = "rgba(150,160,220,0.5)";
      c.lineWidth = 2;
      c.setLineDash([4, 5]);
      c.beginPath();
      c.moveTo(p.def.x - p.def.dx + p.def.w / 2, p.def.y - p.def.dy + p.def.h / 2);
      c.lineTo(p.def.x + p.def.dx + p.def.w / 2, p.def.y + p.def.dy + p.def.h / 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "#C9BCF2";
      c.strokeStyle = "#A393DD";
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(p.x, p.y, p.def.w, p.def.h, 6);
      c.fill();
      c.stroke();
    }
  }

  function drawBlocks(c: CanvasRenderingContext2D): void {
    for (const bl of blocks) {
      if (bl.dead) continue;
      const m = MAT[bl.kind];
      if (bl.kind === "wood") {
        const g = c.createLinearGradient(bl.x, bl.y, bl.w >= bl.h ? bl.x : bl.x + bl.w, bl.w >= bl.h ? bl.y + bl.h : bl.y);
        g.addColorStop(0, "#F2CFA0");
        g.addColorStop(0.5, m.fill);
        g.addColorStop(1, "#D8AC76");
        c.fillStyle = g;
      } else if (bl.kind === "stone") {
        const g = c.createLinearGradient(bl.x, bl.y, bl.x, bl.y + bl.h);
        g.addColorStop(0, "#E0E4EC");
        g.addColorStop(1, "#BCC2CF");
        c.fillStyle = g;
      } else {
        c.fillStyle = m.fill;
      }
      c.strokeStyle = m.edge;
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(bl.x, bl.y, bl.w, bl.h, 4);
      c.fill();
      c.stroke();
      if (bl.kind === "wood") {
        // 木板纹理:板缝 + 短木纹
        c.strokeStyle = "rgba(160,110,60,0.4)";
        c.lineWidth = 1.5;
        c.beginPath();
        if (bl.w >= bl.h) {
          c.moveTo(bl.x + 4, bl.y + bl.h / 2);
          c.lineTo(bl.x + bl.w - 4, bl.y + bl.h / 2);
        } else {
          c.moveTo(bl.x + bl.w / 2, bl.y + 4);
          c.lineTo(bl.x + bl.w / 2, bl.y + bl.h - 4);
        }
        c.stroke();
        c.strokeStyle = "rgba(160,110,60,0.22)";
        c.lineWidth = 1;
        c.beginPath();
        if (bl.w >= bl.h) {
          c.moveTo(bl.x + bl.w * 0.22, bl.y + bl.h * 0.26);
          c.lineTo(bl.x + bl.w * 0.42, bl.y + bl.h * 0.26);
          c.moveTo(bl.x + bl.w * 0.55, bl.y + bl.h * 0.74);
          c.lineTo(bl.x + bl.w * 0.8, bl.y + bl.h * 0.74);
        } else {
          c.moveTo(bl.x + bl.w * 0.26, bl.y + bl.h * 0.22);
          c.lineTo(bl.x + bl.w * 0.26, bl.y + bl.h * 0.42);
          c.moveTo(bl.x + bl.w * 0.74, bl.y + bl.h * 0.55);
          c.lineTo(bl.x + bl.w * 0.74, bl.y + bl.h * 0.8);
        }
        c.stroke();
      } else if (bl.kind === "stone") {
        // 砖缝
        c.strokeStyle = "rgba(140,148,165,0.5)";
        c.lineWidth = 1.2;
        c.beginPath();
        if (bl.w >= bl.h) {
          c.moveTo(bl.x + 3, bl.y + bl.h / 2);
          c.lineTo(bl.x + bl.w - 3, bl.y + bl.h / 2);
          c.moveTo(bl.x + bl.w * 0.33, bl.y + 2);
          c.lineTo(bl.x + bl.w * 0.33, bl.y + bl.h / 2);
          c.moveTo(bl.x + bl.w * 0.66, bl.y + bl.h / 2);
          c.lineTo(bl.x + bl.w * 0.66, bl.y + bl.h - 2);
        } else {
          c.moveTo(bl.x + 2, bl.y + bl.h * 0.33);
          c.lineTo(bl.x + bl.w - 2, bl.y + bl.h * 0.33);
          c.moveTo(bl.x + 2, bl.y + bl.h * 0.66);
          c.lineTo(bl.x + bl.w - 2, bl.y + bl.h * 0.66);
        }
        c.stroke();
      } else if (bl.kind === "ice" || bl.kind === "glass") {
        // 斜向闪光
        c.strokeStyle = "rgba(255,255,255,0.9)";
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(bl.x + 3, bl.y + bl.h * 0.4);
        c.lineTo(bl.x + bl.w * 0.42, bl.y + 3);
        c.stroke();
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(bl.x + bl.w * 0.3, bl.y + bl.h - 4);
        c.lineTo(bl.x + bl.w - 4, bl.y + bl.h * 0.25);
        c.stroke();
      } else if (bl.kind === "tnt") {
        // 警示斜纹 + 内框 + 「爆」字
        c.save();
        c.beginPath();
        c.roundRect(bl.x, bl.y, bl.w, bl.h, 4);
        c.clip();
        c.strokeStyle = "rgba(226,132,141,0.4)";
        c.lineWidth = 3;
        for (let sx = bl.x - bl.h; sx < bl.x + bl.w; sx += 10) {
          c.beginPath();
          c.moveTo(sx, bl.y + bl.h);
          c.lineTo(sx + bl.h, bl.y);
          c.stroke();
        }
        c.restore();
        c.strokeStyle = "#E2848D";
        c.lineWidth = 2;
        c.strokeRect(bl.x + 3.5, bl.y + 3.5, bl.w - 7, bl.h - 7);
        c.fillStyle = "#FFE9EB";
        c.beginPath();
        c.arc(bl.x + bl.w / 2, bl.y + bl.h / 2, Math.min(bl.w, bl.h) * 0.32, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#C0392B";
        c.font = "bold 9px sans-serif";
        c.textAlign = "center";
        c.fillText("爆", bl.x + bl.w / 2, bl.y + bl.h / 2 + 3.5);
        c.textAlign = "left";
      }
      // 顶部受光条
      if (bl.kind !== "tnt") {
        c.fillStyle = "rgba(255,255,255,0.3)";
        c.beginPath();
        c.roundRect(bl.x + 2, bl.y + 2, bl.w - 4, Math.min(4, bl.h * 0.2), 2);
        c.fill();
      }
      // 裂纹
      const ratio = bl.hp / bl.maxHp;
      if (ratio < 0.66) {
        c.strokeStyle = "rgba(90,70,60,0.45)";
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(bl.x + bl.w * 0.25, bl.y + 2);
        c.lineTo(bl.x + bl.w * 0.45, bl.y + bl.h * 0.5);
        c.lineTo(bl.x + bl.w * 0.3, bl.y + bl.h - 2);
        c.stroke();
      }
      if (ratio < 0.33) {
        c.strokeStyle = "rgba(90,70,60,0.5)";
        c.beginPath();
        c.moveTo(bl.x + bl.w - 2, bl.y + bl.h * 0.3);
        c.lineTo(bl.x + bl.w * 0.55, bl.y + bl.h * 0.55);
        c.lineTo(bl.x + bl.w - 4, bl.y + bl.h * 0.8);
        c.stroke();
      }
    }
  }

  function drawBoulders(c: CanvasRenderingContext2D): void {
    for (const bo of boulders) {
      const g = c.createRadialGradient(bo.x - bo.r * 0.35, bo.y - bo.r * 0.4, bo.r * 0.2, bo.x, bo.y, bo.r * 1.1);
      g.addColorStop(0, "#D2CCC3");
      g.addColorStop(1, "#A29B91");
      c.fillStyle = g;
      c.strokeStyle = "#948D84";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(bo.x, bo.y, bo.r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = "rgba(120,112,102,0.6)";
      c.beginPath();
      c.moveTo(bo.x, bo.y);
      c.lineTo(bo.x + Math.cos(bo.rot) * bo.r * 0.7, bo.y + Math.sin(bo.rot) * bo.r * 0.7);
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.beginPath();
      c.ellipse(bo.x - bo.r * 0.32, bo.y - bo.r * 0.4, bo.r * 0.26, bo.r * 0.15, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBalloons(c: CanvasRenderingContext2D): void {
    for (const bal of balloons) {
      if (bal.popped) continue;
      if (!bal.bean.dead) {
        c.strokeStyle = "rgba(150,140,120,0.8)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(bal.x, bal.y + bal.r);
        c.lineTo(bal.bean.x, bal.bean.y - bal.bean.r);
        c.stroke();
      }
      const g = c.createRadialGradient(bal.x - bal.r * 0.3, bal.y - bal.r * 0.4, bal.r * 0.2, bal.x, bal.y, bal.r * 1.25);
      g.addColorStop(0, "#FFDCEA");
      g.addColorStop(1, "#FFAECB");
      c.fillStyle = g;
      c.strokeStyle = "#EE9BBB";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(bal.x, bal.y, bal.r, bal.r * 1.15, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // 气球结
      c.fillStyle = "#EE9BBB";
      c.beginPath();
      c.moveTo(bal.x - 3, bal.y + bal.r * 1.15 + 3);
      c.lineTo(bal.x + 3, bal.y + bal.r * 1.15 + 3);
      c.lineTo(bal.x, bal.y + bal.r * 1.15 - 2);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.beginPath();
      c.ellipse(bal.x - 4, bal.y - 5, 3.4, 5, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBeans(c: CanvasRenderingContext2D): void {
    for (const bean of beans) {
      if (bean.dead) continue;
      const wob = Math.sin(simT * 4 + bean.x * 0.13) * 1.2;
      const g = c.createRadialGradient(bean.x - bean.r * 0.35, bean.y - bean.r * 0.4, bean.r * 0.2, bean.x, bean.y, bean.r * 1.15);
      g.addColorStop(0, "#C4EA92");
      g.addColorStop(1, "#8FC957");
      c.fillStyle = g;
      c.strokeStyle = "#7FB84B";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(bean.x, bean.y, bean.r + wob * 0.3, bean.r - wob * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // 小叶子
      c.fillStyle = "#6FAE45";
      c.beginPath();
      c.ellipse(bean.x + 3, bean.y - bean.r - 3, 4.5, 2.6, -0.6, 0, Math.PI * 2);
      c.fill();
      // 脸
      c.fillStyle = "#3E6B24";
      c.beginPath();
      c.arc(bean.x - 3.4, bean.y - 2, 1.5, 0, Math.PI * 2);
      c.arc(bean.x + 3.4, bean.y - 2, 1.5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#3E6B24";
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(bean.x, bean.y + 2.5, 3, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      c.fillStyle = "rgba(255,140,160,0.4)";
      c.beginPath();
      c.arc(bean.x - 6, bean.y + 2, 1.8, 0, Math.PI * 2);
      c.arc(bean.x + 6, bean.y + 2, 1.8, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBird(c: CanvasRenderingContext2D, bird: RtBird): void {
    const info = BIRD_INFO[bird.kind];
    const ang = bird.flying ? Math.atan2(bird.vy, bird.vx) * 0.25 : 0;
    const flap = bird.flying ? Math.sin(bird.age * 18) * 0.35 : Math.sin(simT * 3 + bird.x) * 0.08;
    c.save();
    c.translate(bird.x, bird.y);
    c.rotate(ang);
    // 尾羽(三根小羽毛)
    c.fillStyle = shade(info.color, -26);
    for (const [dy, len] of [[-0.28, 0.9], [0, 1.05], [0.28, 0.9]] as const) {
      c.beginPath();
      c.ellipse(-bird.r * (0.75 + len * 0.25), bird.r * dy, bird.r * 0.42 * len, bird.r * 0.16, dy * 0.7, 0, Math.PI * 2);
      c.fill();
    }
    // 身体:径向渐变 + 描边
    const bodyGrad = c.createRadialGradient(-bird.r * 0.35, -bird.r * 0.4, bird.r * 0.2, 0, 0, bird.r * 1.15);
    bodyGrad.addColorStop(0, shade(info.color, 26));
    bodyGrad.addColorStop(1, shade(info.color, -14));
    c.fillStyle = bodyGrad;
    c.strokeStyle = info.dark;
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(0, 0, bird.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = info.belly;
    c.beginPath();
    c.arc(0, bird.r * 0.35, bird.r * 0.55, 0, Math.PI * 2);
    c.fill();
    // 小翅膀(飞行时扑动)
    c.save();
    c.translate(-bird.r * 0.25, bird.r * 0.05);
    c.rotate(flap);
    c.fillStyle = shade(info.color, -20);
    c.strokeStyle = info.dark;
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(0, 0, bird.r * 0.5, bird.r * 0.3, -0.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    // 高光
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.ellipse(-bird.r * 0.32, -bird.r * 0.45, bird.r * 0.28, bird.r * 0.16, -0.5, 0, Math.PI * 2);
    c.fill();
    // 眼睛(白底 + 瞳孔 + 高光)+ 腮红
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.arc(bird.r * 0.25, -bird.r * 0.25, bird.r * 0.24, 0, Math.PI * 2);
    c.arc(bird.r * 0.68, -bird.r * 0.25, bird.r * 0.24, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4A3B45";
    c.beginPath();
    c.arc(bird.r * 0.3, -bird.r * 0.23, bird.r * 0.14, 0, Math.PI * 2);
    c.arc(bird.r * 0.73, -bird.r * 0.23, bird.r * 0.14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.arc(bird.r * 0.34, -bird.r * 0.28, bird.r * 0.05, 0, Math.PI * 2);
    c.arc(bird.r * 0.77, -bird.r * 0.28, bird.r * 0.05, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,120,140,0.45)";
    c.beginPath();
    c.arc(-bird.r * 0.3, bird.r * 0.1, bird.r * 0.2, 0, Math.PI * 2);
    c.fill();
    // 小嘴巴(上下两瓣)
    c.fillStyle = "#F7B267";
    c.strokeStyle = "#D98E3F";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bird.r * 0.95, -bird.r * 0.08);
    c.lineTo(bird.r * 1.35, bird.r * 0.06);
    c.lineTo(bird.r * 0.92, bird.r * 0.12);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#EFA050";
    c.beginPath();
    c.moveTo(bird.r * 0.92, bird.r * 0.14);
    c.lineTo(bird.r * 1.28, bird.r * 0.14);
    c.lineTo(bird.r * 0.9, bird.r * 0.3);
    c.closePath();
    c.fill();
    // 角色标记
    c.fillStyle = info.dark;
    if (bird.kind === "straight") {
      c.beginPath();
      c.moveTo(-bird.r * 0.1, -bird.r * 0.95);
      c.quadraticCurveTo(bird.r * 0.15, -bird.r * 1.5, bird.r * 0.4, -bird.r * 1.0);
      c.quadraticCurveTo(bird.r * 0.15, -bird.r * 1.1, -bird.r * 0.1, -bird.r * 0.95);
      c.fill();
    } else if (bird.kind === "split") {
      c.beginPath();
      c.arc(-bird.r * 0.35, -bird.r * 0.65, bird.r * 0.14, 0, Math.PI * 2);
      c.arc(0, -bird.r * 0.8, bird.r * 0.14, 0, Math.PI * 2);
      c.arc(bird.r * 0.35, -bird.r * 0.65, bird.r * 0.14, 0, Math.PI * 2);
      c.fill();
    } else if (bird.kind === "slam") {
      c.beginPath();
      c.roundRect(-bird.r * 0.6, -bird.r * 1.1, bird.r * 1.2, bird.r * 0.32, 2);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(-bird.r * 0.2, -bird.r * 0.8);
      c.lineTo(bird.r * 0.45, -bird.r * 0.95);
      c.lineTo(bird.r * 0.15, -bird.r * 0.55);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawSlingshot(c: CanvasRenderingContext2D): void {
    // 地面阴影
    c.fillStyle = "rgba(80,90,60,0.18)";
    c.beginPath();
    c.ellipse(SLING_X, GROUND_Y, 16, 4, 0, 0, Math.PI * 2);
    c.fill();
    // 大弹弓:粗木叉(深色描边 + 木色内芯,更立体)
    c.lineCap = "round";
    c.strokeStyle = "#96683F";
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(SLING_X, GROUND_Y);
    c.lineTo(SLING_X, SLING_Y + 26);
    c.stroke();
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(SLING_X, SLING_Y + 26);
    c.lineTo(SLING_X - 15, SLING_Y - 12);
    c.moveTo(SLING_X, SLING_Y + 26);
    c.lineTo(SLING_X + 15, SLING_Y - 12);
    c.stroke();
    c.strokeStyle = "#C99A6B";
    c.lineWidth = 6.5;
    c.beginPath();
    c.moveTo(SLING_X, GROUND_Y - 1);
    c.lineTo(SLING_X, SLING_Y + 26);
    c.stroke();
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(SLING_X, SLING_Y + 26);
    c.lineTo(SLING_X - 15, SLING_Y - 12);
    c.moveTo(SLING_X, SLING_Y + 26);
    c.lineTo(SLING_X + 15, SLING_Y - 12);
    c.stroke();
    // 缠绕的绑带
    c.strokeStyle = "#E2698A";
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(SLING_X - 5, SLING_Y + 30 + i * 4);
      c.lineTo(SLING_X + 5, SLING_Y + 32 + i * 4);
      c.stroke();
    }

    // 皮筋
    c.strokeStyle = "#E2698A";
    c.lineWidth = 4;
    if (loadedBird && !loadedBird.flying) {
      c.beginPath();
      c.moveTo(SLING_X - 15, SLING_Y - 12);
      c.lineTo(loadedBird.x, loadedBird.y);
      c.lineTo(SLING_X + 15, SLING_Y - 12);
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(SLING_X - 15, SLING_Y - 12);
      c.quadraticCurveTo(SLING_X, SLING_Y - 2, SLING_X + 15, SLING_Y - 12);
      c.stroke();
    }
  }

  function drawTrajectory(c: CanvasRenderingContext2D): void {
    if (!aiming || !loadedBird || Math.hypot(dragX, dragY) < 13) return;
    const v = launchVelocity(dragX, dragY);
    // 与 stepBirds 同一套积分(含风区与小鸟重力系数),预览即实弹
    const pts = simulateTrajectory(loadedBird.x, loadedBird.y, v.vx, v.vy, loadedBird.gfactor, winds, 13, 0.07);
    for (let i = 0; i < pts.length; i++) {
      c.globalAlpha = 0.85 - (i / pts.length) * 0.7;
      c.fillStyle = "#FFFFFF";
      c.strokeStyle = "rgba(120,140,190,0.6)";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(pts[i].x, pts[i].y, i % 2 === 0 ? 3.4 : 2.4, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  function drawQueue(c: CanvasRenderingContext2D): void {
    // 排队等候的小鸟站在弹弓后面
    let qx = SLING_X - 34;
    for (const kind of queue) {
      const info = BIRD_INFO[kind];
      const fake: RtBird = {
        kind,
        x: qx,
        y: GROUND_Y - info.r,
        vx: 0,
        vy: 0,
        r: info.r * 0.82,
        power: 0,
        gfactor: 1,
        flying: false,
        dead: false,
        skillUsed: false,
        pierce: false,
        restT: 0,
        age: 0
      };
      drawBird(c, fake);
      qx -= 24;
      if (qx < 14) break;
    }
  }

  function drawParticles(c: CanvasRenderingContext2D): void {
    for (const p of particles) {
      c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      c.fillStyle = p.color;
      if (p.square) {
        c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  function drawBanner(c: CanvasRenderingContext2D): void {
    if (!level || introT <= 0) return;
    const a = clamp(introT > 1.6 ? (2 - introT) * 2.5 : introT / 0.5, 0, 1);
    c.globalAlpha = a;
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.beginPath();
    c.roundRect(WORLD_W / 2 - 120, 24, 240, 46, 16);
    c.fill();
    c.fillStyle = "#4C7DB3";
    c.font = "bold 17px sans-serif";
    c.textAlign = "center";
    c.fillText(`${CHAPTERS[level.chapter].emoji} 第${level.id}关 ${level.name}`, WORLD_W / 2, 53);
    c.textAlign = "left";
    c.globalAlpha = 1;
  }

  function draw(): void {
    if (!ctx || !level) return;
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    ctx.save();
    if (shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    }
    drawBg(ctx, level.chapter);
    drawWinds(ctx);
    drawSlopes(ctx, level.chapter);
    drawPlatforms(ctx);
    drawBlocks(ctx);
    drawBoulders(ctx);
    drawBalloons(ctx);
    drawBeans(ctx);
    drawQueue(ctx);
    drawSlingshot(ctx);
    for (const bird of activeBirds) {
      if (!bird.dead) drawBird(ctx, bird);
    }
    if (loadedBird) drawBird(ctx, loadedBird);
    drawTrajectory(ctx);
    drawParticles(ctx);
    drawBanner(ctx);
    ctx.restore();
  }

  /* ---------------- 主循环 ---------------- */

  function tick(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    if (level) {
      if (!finishSent) {
        const sub = 3;
        for (let i = 0; i < sub; i++) stepWorld(dt / sub);
        updateFlow(dt);
      }
      shake = Math.max(0, shake - dt * 1.6);
      introT = Math.max(0, introT - dt);
      for (const p of particles) {
        p.life -= dt;
        p.vy += GRAVITY * 0.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      particles = particles.filter((p) => p.life > 0);
      draw();
    }
    raf = requestAnimationFrame(tick);
  }

  /* ---------------- 启动 ---------------- */

  const resume = progress.resume;
  if (resume !== null && LEVELS.some((l) => l.id === resume) && isUnlocked(resume)) {
    openLevel(resume);
  } else {
    showMap();
  }

  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    }
  };
}
