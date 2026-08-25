import { meta } from "./meta";
export { meta };

// 海底大胃王:99 关九大海域战役!先选海域再选关,每片海域专属配色、障碍组合
// 和区域 BOSS(共 9 位),吃过见过的生物都会记进生物图鉴!
import {
  BOSS_INFO,
  BossKind,
  DARK_SIGHT,
  DEX,
  DEX_KEY,
  HEARTS_PER_LEVEL,
  LEVELS,
  LEVELS_PER_THEME,
  PROGRESS_KEY,
  SHIELD_SECONDS,
  START_RADIUS,
  VORTEX_RADIUS,
  ZONE_ORDER,
  ZONE_STYLE,
  bossBiteReady,
  canEat,
  circlesOverlap,
  dexIdForFish,
  eatScore,
  eelActive,
  grow,
  hazardTier,
  inBubbleGap,
  isDanger,
  isLevelUnlocked,
  isThemeUnlocked,
  parseDex,
  parseProgress,
  serializeDex,
  serializeProgress,
  spawnRadius,
  starsForLevel,
  themeCleared,
  themeStars,
  totalStars,
  vortexPull,
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

type Phase = "themes" | "map" | "dex" | "intro" | "play" | "clear" | "retry";
type NpcKind = "fish" | "jelly" | "puffer" | "urchin" | "squid";

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
  kind: "shield" | "star";
  x: number;
  y: number;
  vy: number;
  phase: number;
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
  const dexSeen = loadDex();

  // ---- 局状态 ----
  let levelIdx = 0;
  let chapterIdx = 0;
  let phase: Phase = "themes";
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
  let boss: Boss | null = null;
  let bossActive = false;

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

  const SMALL_COLORS = ["#a8e6c9", "#ffe0a3", "#ffc4d6", "#c4e5ff"];
  const BIG_COLORS = ["#b8a9f5", "#8fc8e8", "#f5b8c9"];

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
    return level().targetR + 10;
  }

  function resetLevel(): void {
    const def = level();
    npcs.length = 0;
    pickups.length = 0;
    pops.length = 0;
    inks.length = 0;
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
      eels.push({ fx: 0.28, offset: 0 });
      eels.push({ fx: 0.55, offset: 1.3 });
      eels.push({ fx: 0.82, offset: 2.5 });
      if (tier >= 2) eels.push({ fx: 0.12, offset: 1.9 });
      if (tier >= 3) eels.push({ fx: 0.68, offset: 0.7 });
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
        `99 关九大海域全部通关,海龙王都服气啦!图鉴 ${dexSeen.size}/${DEX.length} · 总星 ${totalStars(progress)}/${LEVELS.length * 3}`,
      );
    } else if (gained > 0) {
      api.addStars(gained);
      addFloat(w / 2, h / 2 - 110, `+${gained} ⭐`, "#e0a030", true);
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
    if (hearts <= 0) phase = "retry";
  }

  // ---- 输入 ----
  function inRect(x: number, y: number, r: Rect | null): boolean {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  }

  function onPointerDown(e: PointerEvent): void {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (phase === "themes") {
      if (inRect(px, py, btnDex)) {
        api.play("tap");
        phase = "dex";
        return;
      }
      for (const c of themeCards) {
        if (inRect(px, py, c.rect)) {
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
      if (inRect(px, py, btnBack)) {
        api.play("tap");
        phase = "themes";
        return;
      }
      for (const n of mapNodes) {
        if (Math.hypot(px - n.x, py - n.y) <= n.r + 8) {
          if (isLevelUnlocked(progress, n.idx)) {
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
      phase = "themes";
      return;
    }
    if (phase === "intro") {
      api.play("tap");
      phase = "play";
      invincible = 2;
      return;
    }
    if (phase === "clear") {
      if (inRect(px, py, btnNext)) {
        api.play("tap");
        levelIdx++;
        chapterIdx = Math.floor(levelIdx / LEVELS_PER_THEME);
        resetLevel();
        phase = "intro";
      } else if (inRect(px, py, btnMap)) {
        api.play("tap");
        phase = "map";
      }
      return;
    }
    if (phase === "retry") {
      if (inRect(px, py, btnRetry)) {
        api.play("tap");
        resetLevel();
        phase = "play";
      } else if (inRect(px, py, btnMap)) {
        api.play("tap");
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
      hurt: 0,
    };
    markDex(def.boss);
    addFloat(w / 2, h * 0.3, `${spec.name}出现啦!`, "#e05a7a", true);
    api.play("jump");
    shake = 0.5;
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

    if (Math.random() < dt * 3) {
      bubbles.push({ x: Math.random() * w, y: h + 10, r: 3 + Math.random() * 6, vy: 30 + Math.random() * 40 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].y -= bubbles[i].vy * dt;
      if (bubbles[i].y < -12) bubbles.splice(i, 1);
    }
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

    if (phase !== "play") return;

    const def = level();

    // 玩家跟随指针
    const k = Math.min(1, dt * 5.5);
    const dx = targetX - player.x;
    player.x += dx * k;
    player.y += (targetY - player.y) * k;
    if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1;

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
      if (eelActive(time, e.offset) && Math.abs(player.x - ex) < player.r + 13) {
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
  function drawFish(x: number, y: number, r: number, facing: number, color: string, isPlayer: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.5, -r * 0.55);
    ctx.lineTo(-r * 1.5, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.7, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 0.18, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.18, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.beginPath();
    ctx.arc(r * 0.45, r * 0.15, r * 0.18, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
    if (isPlayer) {
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.moveTo(-r * 0.35, -r * 0.62);
      ctx.lineTo(-r * 0.15, -r * 1.02);
      ctx.lineTo(0.05 * r, -r * 0.68);
      ctx.lineTo(r * 0.25, -r * 1.02);
      ctx.lineTo(r * 0.45, -r * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawJelly(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, Math.PI, 0);
    const squig = Math.sin(f.phase * 2) * f.r * 0.12;
    ctx.quadraticCurveTo(f.r * 0.6, f.r * 0.3 + squig, 0, f.r * 0.28);
    ctx.quadraticCurveTo(-f.r * 0.6, f.r * 0.3 - squig, -f.r, 0);
    ctx.fill();
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
    const r = f.inflated > 0 ? f.r * 1.5 : f.r;
    if (f.inflated > 0) {
      ctx.strokeStyle = "#e8a878";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
        ctx.stroke();
      }
    }
    ctx.fillStyle = f.color;
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
    ctx.strokeStyle = "#7a5a98";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * f.r * 0.6, Math.sin(a) * f.r * 0.6);
      ctx.lineTo(Math.cos(a) * f.r * 1.25, Math.sin(a) * f.r * 1.25);
      ctx.stroke();
    }
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(0, 0, f.r * 0.8, 0, Math.PI * 2);
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

  function drawBoss(b: Boss): void {
    const spec = BOSS_INFO[b.kind];
    ctx.save();
    ctx.translate(b.x, b.y);
    const facing = player.x < b.x ? -1 : 1;
    ctx.scale(facing, 1);
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
    // 通用眼睛嘴巴
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(b.r * 0.4, -b.r * 0.15, b.r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(2, b.r * 0.05);
    ctx.beginPath();
    ctx.arc(b.r * 0.4, b.r * 0.12, b.r * 0.16, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
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
        const wob = Math.sin(time * 4 + y) * 4;
        ctx.fillStyle = "rgba(200,235,255,0.75)";
        ctx.beginPath();
        ctx.arc(wall.x + wob, y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
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
    } else {
      // 冰海:漂浮小冰山
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 4; i++) {
        const x = ((i * 173) % 100) / 100 * w;
        const bob = Math.sin(time * 0.8 + i * 2) * 5;
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

    btnDex = { x: w - 118, y: 8, w: 110, h: 30 };
    drawButton(btnDex, `📖 图鉴 ${dexSeen.size}/${DEX.length}`, "#fff1c9", "#7a5a1a");

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
      const unlocked = isThemeUnlocked(progress, i);
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
          ? `${cleared}/${LEVELS_PER_THEME} 关 · ⭐${themeStars(progress, i)}/${LEVELS_PER_THEME * 3} · BOSS ${BOSS_INFO[st.boss].name}`
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

    btnBack = { x: 6, y: 7, w: 62, h: 30 };
    drawButton(btnBack, "◀ 海域", "rgba(255,255,255,0.85)", "#5a5a6e");

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
    btnBack = { x: 12, y: 12, w: 80, h: 34 };
    drawButton(btnBack, "◀ 返回", "#fff", "#5a5a6e");
  }

  function drawClearPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(450, w - 40), 240);
    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${def.name} 通过啦!`, w / 2, y + 40);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 86);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`吃了 ${eaten} 条鱼 · 掉心 ${heartsLost} · 得分 ${score}`, w / 2, y + 124);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 164, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    if (levelIdx < LEVELS.length - 1) {
      btnNext = { x: w / 2 + 10, y: y + 164, w: bw2, h: 44 };
      drawButton(btnNext, "下一关 ▶", "#ffd868", "#7a5a1a");
    } else {
      btnNext = null;
    }
  }

  function drawRetryPanel(): void {
    const { y } = panelBox(Math.min(450, w - 40), 210);
    ctx.fillStyle = "#b28ae8";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("小鱼晕乎乎……", w / 2, y + 44);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText("没关系!这片海再游一次就好", w / 2, y + 84);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 128, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 128, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再游一次", "#ffd868", "#7a5a1a");
  }

  function drawIntroPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(460, w - 40), 210);
    ctx.fillStyle = "#e05a7a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `第${Math.floor(levelIdx / LEVELS_PER_THEME) + 1}章 第${(levelIdx % LEVELS_PER_THEME) + 1}关 · ${def.name}`,
      w / 2,
      y + 42,
    );
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.fillText(def.hint, w / 2, y + 88);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText(`${ZONE_STYLE[def.zone].name} · 点一下屏幕开始`, w / 2, y + 148);
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
    if (phase === "dex") {
      drawDex();
      return;
    }

    const def = level();
    const zone = ZONE_STYLE[def.zone];
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, zone.top);
    grad.addColorStop(1, zone.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    drawZoneDecor();
    drawHazards();

    for (const b of bubbles) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const p of pickups) {
      if (p.kind === "shield") {
        ctx.strokeStyle = "rgba(120,180,255,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(190,225,255,0.5)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5a8ac9";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛡", p.x, p.y);
      } else {
        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⭐", p.x, p.y);
      }
    }

    for (const f of npcs) {
      if (f.kind === "jelly") drawJelly(f);
      else if (f.kind === "puffer") drawPuffer(f);
      else if (f.kind === "urchin") drawUrchin(f);
      else if (f.kind === "squid") drawSquid(f);
      else drawFish(f.x, f.y, f.r, f.vx >= 0 ? 1 : -1, f.color, false);
    }

    if (boss) drawBoss(boss);

    const blink = invincible > 0 && Math.floor(time * 8) % 2 === 0;
    if (!blink) {
      drawFish(player.x, player.y, player.r, player.facing, "#ff9eb5", true);
      if (shield > 0) {
        ctx.strokeStyle = `rgba(120,180,255,${0.5 + Math.sin(time * 6) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r * 1.5 + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
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

    ctx.restore();

    // ---- HUD ----
    const bw = Math.min(280, w - 250);
    const bx = (w - bw) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.roundRect(bx, 12, bw, 18, 9);
    ctx.fill();
    const prog = bossActive
      ? 1
      : Math.max(0, Math.min(1, (player.r - START_RADIUS) / (def.targetR - START_RADIUS)));
    ctx.fillStyle = "#ff9eb5";
    ctx.beginPath();
    ctx.roundRect(bx, 12, Math.max(18, bw * prog), 18, 9);
    ctx.fill();
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      bossActive && def.boss
        ? `去咬${BOSS_INFO[def.boss].name}!`
        : `长大进度 ${Math.round(prog * 100)}%`,
      w / 2,
      21,
    );
    ctx.textAlign = "left";
    ctx.font = "15px sans-serif";
    ctx.fillText(
      `第${Math.floor(levelIdx / LEVELS_PER_THEME) + 1}章 ${(levelIdx % LEVELS_PER_THEME) + 1}/${LEVELS_PER_THEME} · ${zone.name}`,
      12,
      21,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_LEVEL - hearts)) + `  分 ${score}`,
      w - 12,
      21,
    );
    if (shield > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a8ac9";
      ctx.fillText(`🛡 ${Math.ceil(shield)}s`, w - 12, 44);
    }
    if (streak >= 3 && streakTimer > 0) {
      ctx.fillStyle = "#b28ae8";
      ctx.font = `bold ${18 + Math.min(streak, 8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`连吃 ×${streak}`, w / 2, 52);
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
  resetLevel();
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
