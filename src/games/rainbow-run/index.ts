import { meta } from "./meta";
export { meta };

// 彩虹跑跑:99 关九大主题世界跑酷战役!先选世界再选关,每关一个小任务,
// 滚滚球、电光门等七种障碍,喷气鞋/磁铁/滑板道具,还能花星星复活一次!
// 另有「无尽彩虹跑」:一直跑吃金币,每 1600 米换世界,越跑越快,挑战最远纪录!
import {
  BOARD_SECONDS,
  JET_SECONDS,
  LEVELS,
  LevelDef,
  LEVELS_PER_THEME,
  MAGNET_SECONDS,
  MAX_HEARTS,
  Mission,
  ObstacleKind,
  PatternRow,
  PlayerAction,
  PowerKind,
  PROGRESS_KEY,
  REVIVE_COST,
  ROLLER_SPEED_MULT,
  RunStats,
  THEME_ORDER,
  THEME_STYLE,
  clampLane,
  detectSwipe,
  isLevelUnlocked,
  isThemeUnlocked,
  missionDone,
  missionLabel,
  missionProgress,
  parseProgress,
  patternsForKinds,
  serializeProgress,
  starsForLevel,
  themeCleared,
  themeStars,
  totalStars,
  wouldHit,
  zapperActive,
} from "./logic";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameAPI {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

type Phase = "themes" | "map" | "intro" | "run" | "clear" | "retry";

interface Obstacle {
  baseLane: number;
  kind: ObstacleKind;
  y: number;
  phase: number;
}

interface Pickup {
  kind: "star" | "coin" | PowerKind;
  lane: number;
  x: number;
  y: number;
  taken: boolean;
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const JUMP_TIME = 0.55;
const SLIDE_TIME = 0.6;
const HIT_WINDOW = 34;
const ROW_GAP = 250;

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

/* ---- 无尽跑:随距离换世界,速度有封顶,记录最好成绩 ---- */

const ENDLESS_BEST_KEY = "yiduo-yixing.rainbow-run.endless-best.v1";
/** 每跑多少米换一个主题世界。 */
const ENDLESS_STAGE_LEN = 1600;
const ENDLESS_BASE_SPEED = 250;
const ENDLESS_MAX_SPEED = 500;

function endlessSpeedAt(dist: number): number {
  return Math.min(ENDLESS_MAX_SPEED, ENDLESS_BASE_SPEED + dist * 0.02);
}

function loadEndlessBest(): number {
  try {
    const v = Number(localStorage.getItem(ENDLESS_BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function saveEndlessBest(v: number): void {
  try {
    localStorage.setItem(ENDLESS_BEST_KEY, String(Math.floor(v)));
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

  const laneX = (lane: number) => w * (0.5 + (lane - 1) * 0.26);
  const playerY = () => h * 0.78;

  const progress = loadProgress();

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
  let reviveUsed = false;
  let earnedStars: 1 | 2 | 3 = 1;
  let missionOk = false;
  let finaleFired = false;
  let destroyed = false;

  const stats: RunStats = { coins: 0, stars: 0, dodged: 0, heartsLost: 0 };

  const obstacles: Obstacle[] = [];
  const pickups: Pickup[] = [];
  const puffs: Puff[] = [];
  const floats: Floaty[] = [];

  let patternPool: PatternRow[][] = patternsForKinds(LEVELS[0].obstacleKinds);
  let pendingRows: PatternRow[] = [];
  let rowDist = 0;
  let powerTimer = 8;

  // ---- 无尽跑状态 ----
  let endless = false;
  let endlessBest = loadEndlessBest();
  let btnEndless: Rect | null = null;
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

  function doAction(dir: "left" | "right" | "up" | "down"): void {
    if (destroyed || phase !== "run") return;
    if (dir === "left" || dir === "right") {
      const next = clampLane(lane + (dir === "left" ? -1 : 1));
      if (next !== lane) {
        lane = next;
        api.play("tap");
      }
    } else if (dir === "up") {
      if (action !== "jump") {
        action = "jump";
        actionTimer = JUMP_TIME;
        jumpsUsed = 1;
        api.play("jump");
      } else if (boardTimer > 0 && jumpsUsed < 2) {
        // 滑板二段跳
        actionTimer = JUMP_TIME;
        jumpsUsed = 2;
        api.play("jump");
        addFloat(laneX(lane), playerY() - 90, "二段跳!", "#8a5ac9");
      }
    } else if (action !== "slide") {
      action = "slide";
      actionTimer = SLIDE_TIME;
      api.play("tap");
    }
  }

  function loadLevel(idx: number): void {
    endless = false;
    levelIdx = idx;
    chapterIdx = Math.floor(idx / LEVELS_PER_THEME);
    patternPool = patternsForKinds(LEVELS[idx].obstacleKinds);
    resetLevel();
    phase = "intro";
  }

  function startEndless(): void {
    endless = true;
    endlessDef.world = "grass";
    patternPool = patternsForKinds(THEME_STYLE.grass.palette);
    resetLevel();
    phase = "intro";
  }

  /** 无尽跑:根据当前距离切换主题世界(换世界时广播一下)。 */
  function syncEndlessTheme(): void {
    const stage = Math.floor(dist / ENDLESS_STAGE_LEN) % THEME_ORDER.length;
    const world = THEME_ORDER[stage];
    if (endlessDef.world !== world) {
      endlessDef.world = world;
      patternPool = patternsForKinds(THEME_STYLE[world].palette);
      pendingRows = [];
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
    reviveUsed = false;
    stats.coins = 0;
    stats.stars = 0;
    stats.dodged = 0;
    stats.heartsLost = 0;
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
        `99 关九大世界跑酷全部通关!总星 ${totalStars(progress)}/${LEVELS.length * 3}`,
      );
    } else if (gained > 0) {
      api.addStars(gained);
    }
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
    for (let k = 0; k < 8; k++) {
      puffs.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 50,
        life: 0.5,
        color: "#ffffff",
      });
    }
    if (hearts <= 0) {
      if (endless && Math.floor(dist) > endlessBest) {
        endlessBest = Math.floor(dist);
        saveEndlessBest(endlessBest);
      }
      phase = "retry";
    }
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
        if (Math.hypot(x - n.x, y - n.y) <= n.r + 6) {
          if (isLevelUnlocked(progress, n.idx)) {
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
      invincible = 1.5;
      return;
    }
    if (phase === "clear") {
      if (inRect(x, y, btnNext) && levelIdx < LEVELS.length - 1) {
        api.play("tap");
        loadLevel(levelIdx + 1);
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
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
        phase = "run";
        api.play("win");
        addFloat(w / 2, h / 2, "复活啦!继续冲!", "#e0a030", true);
        return;
      }
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        resetLevel();
        phase = "run";
        invincible = 1.5;
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
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
    const dir = detectSwipe(e.clientX - swipeStartX, e.clientY - swipeStartY, 28);
    if (dir) {
      swipeDone = true;
      doAction(dir);
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (swiping && !swipeDone) {
      const dir = detectSwipe(e.clientX - swipeStartX, e.clientY - swipeStartY, 24);
      if (dir) doAction(dir);
    }
    swiping = false;
  }

  function onKeyDown(e: KeyboardEvent): void {
    const map: Record<string, "left" | "right" | "up" | "down"> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const dir = map[e.key];
    if (dir) {
      e.preventDefault();
      doAction(dir);
    }
  }

  // ---- 关卡推进 ----
  function spawnRow(row: PatternRow): void {
    for (const o of row.obstacles) {
      obstacles.push({ baseLane: o.lane, kind: o.kind, y: -50, phase: Math.random() * Math.PI * 2 });
    }
    for (const l of row.stars) {
      pickups.push({ kind: "star", lane: l, x: laneX(l), y: -50, taken: false });
    }
    for (const l of row.coins) {
      pickups.push({ kind: "coin", lane: l, x: laneX(l), y: -50, taken: false });
    }
  }

  function update(dt: number): void {
    time += dt;
    shake = Math.max(0, shake - dt);
    invincible = Math.max(0, invincible - dt);
    magnetTimer = Math.max(0, magnetTimer - dt);
    jetTimer = Math.max(0, jetTimer - dt);
    boardTimer = Math.max(0, boardTimer - dt);
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

    const def = level();
    if (endless) {
      speed = endlessSpeedAt(dist);
      syncEndlessTheme();
    } else {
      const frac = Math.min(1, dist / def.len);
      speed = def.speed * (1 + frac * 0.1);
    }
    dist += speed * dt;
    scrollPhase += speed * dt;

    if (!endless && dist >= def.len) {
      levelCleared();
      return;
    }

    laneFloat += (lane - laneFloat) * Math.min(1, dt * 10);
    if (actionTimer > 0) {
      actionTimer -= dt;
      if (actionTimer <= 0) {
        action = "run";
        jumpsUsed = 0;
      }
    }

    // 按花样刷行
    rowDist += speed * dt;
    if (rowDist >= ROW_GAP) {
      rowDist = 0;
      if (pendingRows.length === 0) {
        const pool = patternPool.length > 0 ? patternPool : [[]];
        const pat = pool[Math.floor(Math.random() * pool.length)];
        pendingRows = pat.map((r) => ({
          obstacles: r.obstacles.map((o) => ({ ...o })),
          stars: [...r.stars],
          coins: [...r.coins],
        }));
      }
      const row = pendingRows.shift();
      if (row) spawnRow(row);
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
        continue;
      }
      if (
        invincible <= 0 &&
        jetTimer <= 0 &&
        obstacleLane(o) === lane &&
        Math.abs(o.y - py) < HIT_WINDOW &&
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
        if (d < 300) {
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
          score += 10;
          api.play("coin");
          addFloat(p.x, p.y - 20, "+⭐", "#e0a030");
          puffs.push({ x: p.x, y: p.y, life: 0.5, color: "#ffe387" });
        } else if (p.kind === "coin") {
          stats.coins++;
          score += 5;
          api.play("pop");
          addFloat(p.x, p.y - 20, "+1🍬", "#e05a7a");
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

  function drawObstacle(o: Obstacle, laneW: number): void {
    const x = laneX(o.kind === "cloudy" ? clampLane(o.baseLane + Math.sin(o.phase) * 1.2) : o.baseLane);
    if (o.kind === "rock") {
      ctx.fillStyle = "#c9a6f2";
      ctx.beginPath();
      ctx.ellipse(x, o.y, laneW * 0.3, laneW * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(x - laneW * 0.1, o.y - laneW * 0.08, laneW * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.kind === "hurdle") {
      ctx.fillStyle = "#f8f8ff";
      ctx.strokeStyle = "#e0a8bc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - laneW * 0.32, o.y - 10, laneW * 0.64, 20, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - laneW * 0.2, o.y - 10);
      ctx.lineTo(x - laneW * 0.2, o.y + 10);
      ctx.moveTo(x + laneW * 0.2, o.y - 10);
      ctx.lineTo(x + laneW * 0.2, o.y + 10);
      ctx.stroke();
    } else if (o.kind === "bar") {
      ctx.fillStyle = "#9adcf0";
      ctx.fillRect(x - laneW * 0.36, o.y - 26, 8, 30);
      ctx.fillRect(x + laneW * 0.36 - 8, o.y - 26, 8, 30);
      const bands = ["#ff9eb5", "#ffd868", "#8fd8c8"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(x - laneW * 0.36, o.y - 26 + i * 6, laneW * 0.72, 6);
      }
    } else if (o.kind === "pit") {
      // 坑洞:深色椭圆 + 裂纹边
      ctx.fillStyle = "rgba(60,55,90,0.85)";
      ctx.beginPath();
      ctx.ellipse(x, o.y, laneW * 0.34, laneW * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, o.y, laneW * 0.34, laneW * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (o.kind === "roller") {
      // 滚滚球:带旋转纹路的大圆球
      const rr = laneW * 0.27;
      const spin = o.y * 0.04;
      ctx.fillStyle = "#e8a05a";
      ctx.beginPath();
      ctx.arc(x, o.y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 3.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, o.y, rr * 0.65, spin + (i * Math.PI * 2) / 3, spin + (i * Math.PI * 2) / 3 + 1.1);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(120,70,30,0.4)";
      ctx.beginPath();
      ctx.ellipse(x, o.y + rr + 5, rr * 0.9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.kind === "zapper") {
      // 电光门:两根柱子,通电时中间闪电
      const active = zapperActive(time, o.phase);
      const half = laneW * 0.36;
      ctx.fillStyle = active ? "#ffd868" : "#9a9ab8";
      ctx.beginPath();
      ctx.roundRect(x - half - 5, o.y - 26, 10, 42, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + half - 5, o.y - 26, 10, 42, 4);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = `rgba(255,238,120,${0.75 + Math.sin(time * 20) * 0.25})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - half + 5, o.y - 6);
        for (let i = 1; i <= 4; i++) {
          const zx = x - half + 5 + ((half * 2 - 10) * i) / 4;
          ctx.lineTo(zx, o.y - 6 + (i % 2 === 0 ? 6 : -8));
        }
        ctx.stroke();
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", x, o.y - 34);
      }
    } else {
      // 云朵怪:飘来飘去的软云
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(x - laneW * 0.16, o.y, laneW * 0.15, 0, Math.PI * 2);
      ctx.arc(x, o.y - laneW * 0.08, laneW * 0.18, 0, Math.PI * 2);
      ctx.arc(x + laneW * 0.16, o.y, laneW * 0.15, 0, Math.PI * 2);
      ctx.arc(x, o.y + laneW * 0.06, laneW * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3a4a";
      ctx.beginPath();
      ctx.arc(x - laneW * 0.06, o.y - laneW * 0.03, 3, 0, Math.PI * 2);
      ctx.arc(x + laneW * 0.06, o.y - laneW * 0.03, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a3a4a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, o.y + laneW * 0.03, 5, 0.15 * Math.PI, 0.85 * Math.PI);
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
    const lift = flying ? 90 + Math.sin(time * 5) * 8 : jumping ? Math.sin((1 - actionTimer / JUMP_TIME) * Math.PI) * 70 : 0;
    const r = 30;
    ctx.fillStyle = "rgba(90,90,110,0.18)";
    ctx.beginPath();
    ctx.ellipse(pxx, py + r * 0.85, r * (jumping || flying ? 0.5 : 0.85), r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    const bodyY = py - lift;
    const sx = sliding ? 1.25 : 1;
    const sy = sliding ? 0.6 : 1;
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
    ctx.fillText("🌈 彩虹跑跑 · 九大世界", w / 2, 26);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#6a5a7e";
    ctx.fillText(
      `共 ${LEVELS.length} 关 · ⭐ ${totalStars(progress)}/${LEVELS.length * 3} · 先选世界,再选关卡`,
      w / 2,
      52,
    );

    // 无尽跑入口:一直跑、吃金币、越跑越快
    const ex = Math.max(10, w * 0.06);
    btnEndless = { x: ex, y: 68, w: w - ex * 2, h: 42 };
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
      `♾️ 无尽彩虹跑 · 一直跑吃金币${endlessBest > 0 ? ` · 最远 ${endlessBest} 米` : " · 点我开跑!"}`,
      w / 2,
      btnEndless.y + btnEndless.h / 2,
    );

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
      const unlocked = isThemeUnlocked(progress, i);
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
      ctx.font = `bold ${Math.min(17, Math.round(ch * 0.22))}px sans-serif`;
      ctx.fillText(`第${i + 1}章 ${st.name}`, rect.x + 10 + ch * 0.42, rect.y + ch * 0.3);
      ctx.font = `${Math.min(12, Math.round(ch * 0.16))}px sans-serif`;
      ctx.fillStyle = unlocked ? "#5a5a6e" : "#a8a8b4";
      ctx.fillText(unlocked ? st.blurb : "通关上一个世界解锁", rect.x + 10, rect.y + ch * 0.6);
      ctx.fillText(
        unlocked
          ? `${cleared}/${LEVELS_PER_THEME} 关 · ⭐${themeStars(progress, i)}/${LEVELS_PER_THEME * 3}`
          : "",
        rect.x + 10,
        rect.y + ch * 0.82,
      );
    }
  }

  function drawMap(): void {
    const st = THEME_STYLE[THEME_ORDER[chapterIdx]];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, st.skyTop);
    grad.addColorStop(1, st.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    btnBack = { x: 6, y: 7, w: 62, h: 30 };
    drawButton(btnBack, "◀ 世界", "rgba(255,255,255,0.85)", "#5a5a6e");

    ctx.fillStyle = st.accent;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, w / 2, 28);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `⭐ ${themeStars(progress, chapterIdx)}/${LEVELS_PER_THEME * 3} · 通关解锁下一关,回放可刷 3 星`,
      w / 2,
      54,
    );

    mapNodes.length = 0;
    const base = chapterIdx * LEVELS_PER_THEME;
    const cols = 4;
    const rows = Math.ceil(LEVELS_PER_THEME / cols);
    const mx0 = w * 0.12;
    const mx1 = w * 0.88;
    const my0 = 96;
    const my1 = h - 40;
    const nr = Math.max(16, Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6));
    for (let i = 0; i < LEVELS_PER_THEME; i++) {
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
      const unlocked = isLevelUnlocked(progress, n.idx);
      const got = progress[n.idx] ?? 0;
      const isFinal = (n.idx - base) === LEVELS_PER_THEME - 1;
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
        if (isFinal) {
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
    ctx.fillStyle = missionOk ? "#4a9a5a" : "#9a9aa8";
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
    const canRevive = !reviveUsed && api.getStars() >= REVIVE_COST;
    const { y } = panelBox(Math.min(450, w - 40), canRevive ? 260 : 210);
    ctx.fillStyle = "#b28ae8";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      endless ? `这次跑了 ${Math.floor(dist)} 米!` : "摔了一跤,晕乎乎……",
      w / 2,
      y + 44,
    );
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    const subText = endless
      ? Math.floor(dist) >= endlessBest && endlessBest > 0
        ? `🎉 新纪录!🍬${stats.coins} ⭐${stats.stars}${canRevive ? ` · 花 ${REVIVE_COST}⭐ 还能接着跑!` : ""}`
        : `最远纪录 ${endlessBest} 米 · 🍬${stats.coins}${canRevive ? ` · 花 ${REVIVE_COST}⭐ 原地复活!` : ""}`
      : canRevive
        ? `看小星星帮帮忙:花 ${REVIVE_COST} 颗⭐原地复活!`
        : "没关系!就从这一关重新出发";
    ctx.fillText(subText, w / 2, y + 84);
    let by = y + 116;
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
        endlessBest > 0 ? `🎯 目标:超过最远纪录 ${endlessBest} 米!` : "🎯 目标:跑得越远越厉害!",
        w / 2,
        y + 122,
      );
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#a0a0b2";
      ctx.fillText("左右滑换道 上滑跳 下滑趴 · 3 颗心 · 点一下开始", w / 2, y + 158);
      return;
    }
    ctx.fillText(
      `第${Math.floor(levelIdx / LEVELS_PER_THEME) + 1}章 第${(levelIdx % LEVELS_PER_THEME) + 1}关 · ${def.name}`,
      w / 2,
      y + 42,
    );
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.fillText(def.hint, w / 2, y + 84);
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`🎯 任务:${missionLabel(def.mission)}`, w / 2, y + 122);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText(`${st.name} · 左右滑换道 上滑跳 下滑趴 · 点一下开始`, w / 2, y + 158);
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

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    if (def.world === "space") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 89) % 100) / 100 * w;
        const sy = ((i * 41) % 100) / 100 * h;
        ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(time * 2 + i));
        ctx.fillRect(sx, sy, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    }

    // 跑道
    const laneW = w * 0.26;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = theme.lanes[i];
      ctx.fillRect(laneX(i) - laneW / 2, 0, laneW, h);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 4;
    for (let i = 0; i <= 3; i++) {
      const x = laneX(0) - laneW / 2 + i * laneW;
      const dashOffset = scrollPhase % 48;
      for (let y = -48 + dashOffset; y < h; y += 48) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 24);
        ctx.stroke();
      }
    }

    // 两侧装饰
    const decoOffset = scrollPhase % 160;
    for (let y = -160 + decoOffset; y < h; y += 160) {
      const lx = laneX(0) - laneW / 2 - 26;
      const rx = laneX(2) + laneW / 2 + 26;
      for (const x of [lx, rx]) {
        if (x < 10 || x > w - 10) continue;
        if (def.world === "grass") {
          ctx.fillStyle = theme.deco;
          for (let p = 0; p < 5; p++) {
            const a = (Math.PI * 2 * p) / 5;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#ffe387";
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (def.world === "sky") {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc(x - 8, y, 10, 0, Math.PI * 2);
          ctx.arc(x + 6, y - 4, 12, 0, Math.PI * 2);
          ctx.arc(x + 16, y + 3, 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (def.world === "candy") {
          ctx.strokeStyle = "#e8a8c8";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x, y + 14);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = theme.deco;
          ctx.beginPath();
          ctx.arc(x, y - 6, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y - 6, 5, 0.3, Math.PI * 1.4);
          ctx.stroke();
        } else if (def.world === "forest") {
          // 小杉树
          ctx.fillStyle = theme.deco;
          ctx.fillRect(x - 3, y + 4, 6, 10);
          ctx.fillStyle = "#4a8a4a";
          ctx.beginPath();
          ctx.moveTo(x - 12, y + 6);
          ctx.lineTo(x, y - 16);
          ctx.lineTo(x + 12, y + 6);
          ctx.closePath();
          ctx.fill();
        } else if (def.world === "beach") {
          // 小贝壳
          ctx.fillStyle = theme.deco;
          ctx.beginPath();
          ctx.arc(x, y, 9, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + i * 5, y - 8);
            ctx.stroke();
          }
        } else if (def.world === "desert") {
          // 小仙人掌
          ctx.fillStyle = theme.deco;
          ctx.beginPath();
          ctx.roundRect(x - 4, y - 14, 8, 26, 4);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(x - 13, y - 6, 8, 5, 3);
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(x + 5, y - 2, 8, 5, 3);
          ctx.fill();
        } else if (def.world === "snow") {
          // 小雪花
          ctx.strokeStyle = theme.deco;
          ctx.lineWidth = 2.5;
          for (let i = 0; i < 3; i++) {
            const a = (Math.PI * i) / 3;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(a) * 9, y - Math.sin(a) * 9);
            ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
            ctx.stroke();
          }
        } else if (def.world === "lava") {
          // 冒火星的小石头
          ctx.fillStyle = "#5a3a35";
          ctx.beginPath();
          ctx.arc(x, y + 4, 8, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = theme.deco;
          ctx.beginPath();
          ctx.arc(x, y - 5 + Math.sin(time * 4 + x) * 3, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(x, y, 8, "#ffe387");
        }
      }
    }

    // 终点线
    const toFinish = def.len - dist;
    if (toFinish < h) {
      const fy = playerY() - toFinish;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(laneX(0) - laneW / 2, fy - 12, laneW * 3, 24);
      ctx.fillStyle = "#3a3a4a";
      for (let i = 0; i < 12; i++) {
        if (i % 2 === 0) ctx.fillRect(laneX(0) - laneW / 2 + i * laneW * 0.25, fy - 12, laneW * 0.25, 12);
        else ctx.fillRect(laneX(0) - laneW / 2 + i * laneW * 0.25, fy, laneW * 0.25, 12);
      }
    }

    for (const o of obstacles) drawObstacle(o, laneW);

    for (const p of pickups) {
      if (p.kind === "star") drawStar(p.x, p.y, 14, "#ffd868");
      else if (p.kind === "coin") {
        ctx.fillStyle = "#ffb84d";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c9a6f2";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.kind === "magnet" ? "🧲" : p.kind === "jet" ? "🚀" : "🛹", p.x, p.y + 1);
      }
    }

    drawPlayer();

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
    const bw = Math.min(300, w - 240);
    const bx = (w - bw) / 2;
    if (endless) {
      // 无尽跑:显示距离与最好成绩
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.roundRect(bx, 10, bw, 38, 12);
      ctx.fill();
      ctx.fillStyle = "#8a5ac9";
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`🏃 ${Math.floor(dist)} 米`, w / 2, 22);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#9a8ab2";
      ctx.fillText(
        Math.floor(dist) > endlessBest && endlessBest > 0
          ? "🎉 新纪录保持中!"
          : `最远纪录 ${Math.max(endlessBest, 0)} 米`,
        w / 2,
        39,
      );
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.roundRect(bx, 10, bw, 14, 7);
      ctx.fill();
      ctx.fillStyle = "#b28ae8";
      ctx.beginPath();
      ctx.roundRect(bx, 10, Math.max(14, (bw * Math.min(dist, def.len)) / def.len), 14, 7);
      ctx.fill();

      // 任务条
      const m: Mission = def.mission;
      const prog = missionProgress(m, stats);
      const done = missionDone(m, stats);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.roundRect(bx, 30, bw, 18, 9);
      ctx.fill();
      ctx.fillStyle = done ? "#7ac97a" : "#ffd868";
      const mfrac = m.type === "noHit" ? (done ? 1 : stats.heartsLost === 0 ? 1 : 0) : prog / m.n;
      ctx.beginPath();
      ctx.roundRect(bx, 30, Math.max(10, bw * Math.min(1, mfrac)), 18, 9);
      ctx.fill();
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `🎯 ${missionLabel(m)}${m.type === "noHit" ? (stats.heartsLost === 0 ? " ✓保持中" : " ✗") : ` ${prog}/${m.n}`}`,
        w / 2,
        39,
      );
    }

    ctx.font = "15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`🍬${stats.coins} ⭐${stats.stars}`, 76, 20);
    ctx.textAlign = "right";
    ctx.fillText("💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, MAX_HEARTS - hearts)), w - 10, 20);
    // 道具倒计时
    let px2 = w - 10;
    ctx.font = "13px sans-serif";
    if (magnetTimer > 0) {
      ctx.fillText(`🧲${Math.ceil(magnetTimer)}s`, px2, 44);
      px2 -= 56;
    }
    if (jetTimer > 0) {
      ctx.fillText(`🚀${Math.ceil(jetTimer)}s`, px2, 44);
      px2 -= 56;
    }
    if (boardTimer > 0) {
      ctx.fillText(`🛹${Math.ceil(boardTimer)}s`, px2, 44);
    }

    btnBack = { x: 6, y: 6, w: 62, h: 28 };
    drawButton(btnBack, endless ? "◀ 回家" : "◀ 地图", "rgba(255,255,255,0.85)", "#5a5a6e");

    // ---- 覆盖层 ----
    if (phase === "intro") {
      drawIntroPanel();
      drawButton(btnBack, endless ? "◀ 回家" : "◀ 地图", "#f0f0f5", "#5a5a6e");
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

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      canvas.remove();
    },
  };
}
