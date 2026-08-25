// 绿芽保卫战:18 关守家大战役!白天/黑夜/水池三种场景,七种植物迎战七种虫虫,
// 关卡地图选关,旗帜大波,最终决战大虫王!
import {
  BOOM_DAMAGE,
  BOOM_RANGE,
  BOOM_TRIGGER,
  BUG_INFO,
  BugKind,
  BugSpawn,
  HOME_X,
  ICE_SECONDS,
  ICE_SLOW,
  LANES,
  LEVELS,
  PLANT_COLS,
  PLANT_INFO,
  PROGRESS_KEY,
  PlantKind,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  canPlantOnCell,
  isLevelUnlocked,
  parseProgress,
  passiveDewInterval,
  plantsUnlockedAt,
  projectileCanHit,
  serializeProgress,
  shovelRefund,
  starsForLevel,
  totalStars,
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

export const meta = {
  id: "sprout-defense",
  title: "绿芽保卫战",
  emoji: "🌱",
  category: "action" as const,
  color: "#d5f2ca",
  blurb: "18 关守家战役!七种植物、夜战水战、旗帜大波、大虫王!",
};

const TOOLBAR_H = 64;
const HOME_W_CELLS = 1.2;
const BUBBLE_SPEED = 3.5;
const STAR_SPEED = 4.2;
const ICE_SPEED = 3.8;
const SHOOT_CD = 1.3;
const CHEW_INTERVAL = 0.9;
const BOSS_CHEW_INTERVAL = 0.35;
const SPARKLE_DEW_EVERY = 4.5;

type Phase = "map" | "intro" | "play" | "clear" | "retry";
type Tool = PlantKind | "shovel";
type Proj = "bubble" | "star" | "ice";

interface Plant {
  col: number;
  lane: number;
  kind: PlantKind;
  hp: number;
  cd: number;
  prodTimer: number;
  anim: number;
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

export function mount(api: GameAPI): { destroy: () => void } {
  const { root } = api;
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  const progress = loadProgress();

  // ---- 局状态 ----
  let levelIdx = 0;
  let phase: Phase = "map";
  let schedule: BugSpawn[] = [];
  const plants = new Map<string, Plant>();
  const lilies = new Set<string>();
  const bugs: Bug[] = [];
  const shots: Shot[] = [];
  const sparkles: Sparkle[] = [];
  const floats: Floaty[] = [];

  let dew = 4;
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

  const mapNodes: Array<{ idx: number; x: number; y: number; r: number }> = [];
  let btnNext: Rect | null = null;
  let btnMap: Rect | null = null;
  let btnRetry: Rect | null = null;
  let btnBack: Rect = { x: 0, y: 0, w: 0, h: 0 };

  let w = 640;
  let h = 480;
  let cell = 48;
  let ox = 0;
  let oy = TOOLBAR_H;

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
    cell = Math.min(w / (PLANT_COLS + HOME_W_CELLS + 0.4), (h - TOOLBAR_H) / LANES);
    const totalW = cell * (PLANT_COLS + HOME_W_CELLS);
    ox = (w - totalW) / 2 + cell * HOME_W_CELLS;
    oy = TOOLBAR_H + (h - TOOLBAR_H - cell * LANES) / 2;
  }

  const px = (cx: number) => ox + cx * cell;
  const laneCenterY = (lane: number) => oy + (lane + 0.5) * cell;

  function level() {
    return LEVELS[levelIdx];
  }

  function isWaterLane(lane: number): boolean {
    return level().scene === "pool" && level().waterLanes.includes(lane);
  }

  function cardRect(i: number): Rect {
    const cw = Math.min(96, (w - 80) / tools.length);
    return { x: 6 + i * (cw + 4), y: 8, w: cw, h: TOOLBAR_H - 16 };
  }

  function addSparkle(x: number, y: number, color: string): void {
    sparkles.push({ x, y, life: 0.6, color });
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  function loadLevel(idx: number): void {
    levelIdx = idx;
    unlockedPlants = plantsUnlockedAt(idx, LEVELS);
    tools = [...unlockedPlants, "shovel"];
    if (!tools.includes(selected)) selected = "bubble";
    resetLevel();
    phase = "intro";
  }

  function resetLevel(): void {
    schedule = buildLevelSchedule(levelIdx);
    plants.clear();
    lilies.clear();
    bugs.length = 0;
    shots.length = 0;
    dew = level().startDew;
    time = 0;
    spawnIdx = 0;
    passiveTimer = passiveDewInterval(level().scene);
    plantsLost = 0;
    score = 0;
    currentWave = -1;
    waveBanner = 0;
  }

  function levelCleared(): void {
    earnedStars = starsForLevel(plantsLost);
    const prev = progress[levelIdx] ?? 0;
    const gained = Math.max(0, earnedStars - prev);
    progress[levelIdx] = Math.max(prev, earnedStars);
    saveProgress(progress);
    phase = "clear";
    api.play("win");
    if (levelIdx >= LEVELS.length - 1 && !finaleFired) {
      finaleFired = true;
      api.onWin(earnedStars, `18 关全部守住,大虫王也认输啦!总星 ${totalStars(progress)}/54`);
    } else if (gained > 0) {
      api.addStars(gained);
    }
  }

  function breach(): void {
    shake = 0.5;
    api.play("oops");
    phase = "retry";
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

    if (phase === "map") {
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
        phase = "map";
        return;
      }
      api.play("tap");
      phase = "play";
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
      if (inRect(x, y, btnRetry)) {
        api.play("tap");
        resetLevel();
        phase = "play";
        return;
      }
      if (inRect(x, y, btnMap)) {
        api.play("tap");
        phase = "map";
      }
      return;
    }

    if (inRect(x, y, btnBack)) {
      api.play("tap");
      phase = "map";
      return;
    }

    // 工具栏
    for (let i = 0; i < tools.length; i++) {
      const r = cardRect(i);
      if (inRect(x, y, r)) {
        selected = tools[i];
        api.play("tap");
        return;
      }
    }

    const col = Math.floor((x - ox) / cell);
    const lane = Math.floor((y - oy) / cell);
    if (col < 0 || col >= PLANT_COLS || lane < 0 || lane >= LANES) return;
    const key = `${col},${lane}`;
    const existing = plants.get(key);
    const water = isWaterLane(lane);
    const hasLily = lilies.has(key);

    if (selected === "shovel") {
      if (existing) {
        const refund = shovelRefund(existing.kind);
        dew += refund;
        plants.delete(key);
        api.play("pop");
        addSparkle(px(col + 0.5), laneCenterY(lane), "#d5c9a8");
        addFloat(px(col + 0.5), laneCenterY(lane) - 14, `+${refund}💧`, "#5a8ac9");
      } else if (hasLily) {
        lilies.delete(key);
        dew += shovelRefund("lily");
        api.play("pop");
        addSparkle(px(col + 0.5), laneCenterY(lane), "#bfe9ff");
      } else {
        api.play("tap");
      }
      return;
    }

    if (!canPlantOnCell(selected, water, hasLily, !!existing)) {
      api.play("tap");
      if (water && !hasLily && selected !== "lily") {
        addFloat(px(col + 0.5), laneCenterY(lane) - 10, "先铺荷叶垫!", "#5a8ac9");
      }
      return;
    }
    if (!canAfford(dew, selected)) {
      dewFlash = 0.8;
      api.play("tap");
      return;
    }
    dew -= PLANT_INFO[selected].cost;
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
      prodTimer: SPARKLE_DEW_EVERY,
      anim: 1,
    });
    api.play("pop");
    addSparkle(px(col + 0.5), laneCenterY(lane), "#d5f2ca");
  }

  function plantInLaneCell(lane: number, colFloat: number): Plant | undefined {
    const col = Math.round(colFloat - 0.5);
    return plants.get(`${col},${lane}`);
  }

  function killBug(i: number): void {
    const bug = bugs[i];
    bugs.splice(i, 1);
    dew++;
    const gain = 10 * (currentWave + 1) * (BUG_INFO[bug.kind].boss ? 5 : 1);
    score += gain;
    api.play(BUG_INFO[bug.kind].boss ? "win" : "coin");
    addSparkle(px(bug.x), laneCenterY(bug.lane), "#c9b6f2");
    addFloat(px(bug.x), laneCenterY(bug.lane) - 16, `+${gain}`, "#c47a2a");
    if (BUG_INFO[bug.kind].boss) {
      shake = 0.5;
      addFloat(px(bug.x), laneCenterY(bug.lane) - 40, "大虫王倒下啦!", "#e05a7a", true);
    }
  }

  function boomExplode(p: Plant): void {
    plants.delete(`${p.col},${p.lane}`);
    shake = 0.4;
    api.play("oops");
    addSparkle(px(p.col + 0.5), laneCenterY(p.lane), "#ffc09b");
    addFloat(px(p.col + 0.5), laneCenterY(p.lane) - 20, "轰!!", "#e05a7a", true);
    for (let bi = bugs.length - 1; bi >= 0; bi--) {
      const b = bugs[bi];
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
    if (phase !== "play") return;

    time += dt;
    dewFlash = Math.max(0, dewFlash - dt);
    waveBanner = Math.max(0, waveBanner - dt);
    shake = Math.max(0, shake - dt);

    // 出虫
    while (spawnIdx < schedule.length && schedule[spawnIdx].time <= time) {
      const s = schedule[spawnIdx++];
      if (s.wave !== currentWave) {
        currentWave = s.wave;
        bannerFlag = level().flagWaves.includes(s.wave);
        waveBanner = bannerFlag ? 2.4 : 1.8;
        api.play(bannerFlag ? "oops" : "jump");
      }
      const info = BUG_INFO[s.kind];
      bugs.push({
        kind: s.kind,
        x: PLANT_COLS + 0.7,
        lane: s.lane,
        hp: bugHp(s.kind, levelIdx),
        maxHp: bugHp(s.kind, levelIdx),
        armor: info.armor,
        maxArmor: info.armor,
        speed: info.speed,
        flying: info.flying,
        chewTimer: 0,
        wob: Math.random() * Math.PI * 2,
        freeze: 0,
        jumped: false,
        jumpAnim: 0,
      });
    }

    // 露珠
    passiveTimer -= dt;
    if (passiveTimer <= 0) {
      passiveTimer = passiveDewInterval(level().scene);
      dew++;
      addSparkle(60, TOOLBAR_H + 8, "#bfe9ff");
    }

    // 植物
    for (const p of plants.values()) {
      p.anim = Math.max(0, p.anim - dt * 3);
      if (p.kind === "sparkle") {
        p.prodTimer -= dt;
        if (p.prodTimer <= 0) {
          p.prodTimer = SPARKLE_DEW_EVERY;
          dew++;
          api.play("coin");
          addSparkle(px(p.col + 0.5), laneCenterY(p.lane) - cell * 0.4, "#ffe387");
        }
      } else if (p.kind === "bubble" || p.kind === "star" || p.kind === "ice") {
        p.cd -= dt;
        if (p.cd <= 0) {
          const proj: Proj = p.kind === "bubble" ? "bubble" : p.kind === "star" ? "star" : "ice";
          const hasTarget = bugs.some(
            (b) => b.lane === p.lane && b.x > p.col + 0.3 && projectileCanHit(proj, b.flying),
          );
          if (hasTarget) {
            p.cd = SHOOT_CD;
            p.anim = 1;
            shots.push({ x: p.col + 0.7, lane: p.lane, proj });
          }
        }
      } else if (p.kind === "boom") {
        const near = bugs.some(
          (b) => b.lane === p.lane && Math.abs(b.x - (p.col + 0.5)) <= BOOM_TRIGGER,
        );
        if (near) {
          boomExplode(p);
        }
      }
    }

    // 子弹飞行
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const spd = s.proj === "star" ? STAR_SPEED : s.proj === "ice" ? ICE_SPEED : BUBBLE_SPEED;
      s.x += spd * dt;
      if (s.x > PLANT_COLS + 1.5) {
        shots.splice(i, 1);
        continue;
      }
      for (let bi = 0; bi < bugs.length; bi++) {
        const bug = bugs[bi];
        if (bug.lane !== s.lane || bug.hp <= 0) continue;
        if (!projectileCanHit(s.proj, bug.flying)) continue;
        if (bubbleHitsBug(s.x, bug.x)) {
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
          if (bug.hp <= 0) killBug(bi);
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
      const speedMul = bug.freeze > 0 ? ICE_SLOW : 1;
      const p = bug.flying ? undefined : plantInLaneCell(bug.lane, bug.x - 0.3);
      if (p && bugReachesPlant(bug.x, p.col)) {
        // 钻钻虫第一次遇到植物直接跳过去
        if (BUG_INFO[bug.kind].jumps && !bug.jumped) {
          bug.jumped = true;
          bug.jumpAnim = 1;
          bug.x = p.col - 0.55;
          api.play("jump");
          addFloat(px(bug.x), laneCenterY(bug.lane) - cell * 0.5, "跳过去啦!", "#b28ae8");
          continue;
        }
        bug.chewTimer -= dt;
        if (bug.chewTimer <= 0) {
          bug.chewTimer = BUG_INFO[bug.kind].boss ? BOSS_CHEW_INTERVAL : CHEW_INTERVAL;
          p.hp--;
          p.anim = 1;
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
        breach();
        return;
      }
    }

    if (spawnIdx >= schedule.length && bugs.length === 0) {
      levelCleared();
    }
  }

  // ---- 绘制 ----
  function drawFace(x: number, y: number, r: number, munch = 0): void {
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.12, r * 0.1, 0, Math.PI * 2);
    ctx.arc(x + r * 0.32, y - r * 0.12, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (munch > 0) {
      ctx.beginPath();
      ctx.arc(x, y + r * 0.22, r * (0.12 + 0.14 * munch), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#3a3a4a";
      ctx.lineWidth = Math.max(1.5, r * 0.08);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.12, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  function drawPlantIcon(x: number, y: number, r: number, kind: PlantKind, anim = 0): void {
    if (kind === "sparkle") {
      ctx.fillStyle = "#ffe387";
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.34, r * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      drawFace(x, y, r * 0.55);
    } else if (kind === "bubble") {
      const sq = 1 + anim * 0.2;
      ctx.fillStyle = "#8fd8c8";
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.62 * sq, (r * 0.62) / sq, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6fc4b0";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.15, y - r * 0.62, r * 0.2, r * 0.32, -0.5, 0, Math.PI * 2);
      ctx.fill();
      drawFace(x, y, r * 0.62, anim);
    } else if (kind === "nut") {
      ctx.fillStyle = "#e8c89a";
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.05, r * 0.58, r * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d5b083";
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.35, r * 0.5, r * 0.3, 0, Math.PI, 0);
      ctx.fill();
      drawFace(x, y + r * 0.1, r * 0.55);
    } else if (kind === "star") {
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * i) / 5 - Math.PI / 2 + anim * 0.3;
        const rr = i % 2 === 0 ? r * 0.72 : r * 0.32;
        const sx = x + Math.cos(a) * rr;
        const sy = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      drawFace(x, y + r * 0.08, r * 0.45);
    } else if (kind === "ice") {
      // 冰冰花:淡蓝雪花瓣
      ctx.strokeStyle = "#9fd8f5";
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * i) / 3 + anim * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
        ctx.stroke();
      }
      ctx.fillStyle = "#d4f0ff";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      drawFace(x, y, r * 0.45);
    } else if (kind === "boom") {
      // 爆爆果:红彤彤圆果 + 小引线
      ctx.fillStyle = "#ff9d8a";
      ctx.beginPath();
      ctx.arc(x, y + r * 0.08, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c47a2a";
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.5);
      ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.85, x + r * 0.5, y - r * 0.7);
      ctx.stroke();
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r * 0.7, r * (0.12 + anim * 0.06), 0, Math.PI * 2);
      ctx.fill();
      drawFace(x, y + r * 0.08, r * 0.55);
    } else {
      // 荷叶垫
      ctx.fillStyle = "#7ac97a";
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.2, r * 0.72, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a8e0a0";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.15, y + r * 0.12, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind !== "lily") {
      ctx.fillStyle = "rgba(170,130,90,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.75, r * 0.55, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawShovelIcon(x: number, y: number, r: number): void {
    ctx.strokeStyle = "#b08a5a";
    ctx.lineWidth = Math.max(3, r * 0.22);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - r * 0.6);
    ctx.lineTo(x + r * 0.15, y + 0);
    ctx.stroke();
    ctx.fillStyle = "#9fb8c8";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.05, y - r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.2, x + r * 0.35, y + r * 0.75);
    ctx.quadraticCurveTo(x - r * 0.1, y + r * 0.55, x + r * 0.05, y - r * 0.1);
    ctx.fill();
  }

  const BUG_COLORS: Record<BugKind, string> = {
    walker: "#ffcf8a",
    flyer: "#9fd8f5",
    armor: "#c9b6f2",
    speedy: "#ffd868",
    digger: "#b5e8a8",
    bucket: "#c8c8d8",
    bossbug: "#e88aa5",
  };

  function drawBug(bug: Bug): void {
    const hover = bug.flying ? -cell * 0.22 + Math.sin(bug.wob * 1.4) * cell * 0.06 : 0;
    const hop = bug.jumpAnim > 0 ? -Math.sin(bug.jumpAnim * Math.PI) * cell * 0.5 : 0;
    const x = px(bug.x);
    const y = laneCenterY(bug.lane) + Math.sin(bug.wob) * cell * 0.03 + hover + hop;
    const boss = BUG_INFO[bug.kind].boss;
    const r = cell * (boss ? 0.42 : 0.26);
    const color = BUG_COLORS[bug.kind];
    if (bug.flying) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const flap = Math.sin(bug.wob * 4) * r * 0.4;
      ctx.beginPath();
      ctx.ellipse(x + r * 0.2, y - r * 0.9 - flap, r * 0.55, r * 0.25, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + r * 0.2, y - r * 0.9 + flap, r * 0.55, r * 0.25, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = bug.freeze > 0 ? "#9fd8f5" : color;
    for (let s = 2; s >= 0; s--) {
      const sx = x + s * r * 0.9;
      const sr = r * (1 - s * 0.15);
      ctx.beginPath();
      ctx.arc(sx, y + Math.sin(bug.wob + s) * r * 0.12, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    // 护甲壳(壳壳虫是半圆壳,桶桶虫是铁桶)
    if (bug.maxArmor > 0 && bug.armor > 0) {
      if (bug.kind === "bucket" || bug.kind === "bossbug") {
        ctx.fillStyle = "rgba(140,150,170,0.95)";
        ctx.beginPath();
        ctx.roundRect(x - r * 0.8, y - r * 1.6, r * 1.6, r * 1.0, r * 0.2);
        ctx.fill();
        ctx.strokeStyle = "#6a7488";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(216,196,150,0.95)";
        ctx.beginPath();
        ctx.arc(x + r * 0.5, y - r * 0.25, r * 1.05, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "#b8a070";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + r * 0.5, y - r * 0.25, r * 1.05, Math.PI, 0);
        ctx.stroke();
      }
    }
    if (bug.kind === "digger") {
      // 小小的弹簧腿
      ctx.strokeStyle = "#5aa878";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y + r * 0.8);
      ctx.lineTo(x - r * 0.55, y + r * 1.25);
      ctx.moveTo(x + r * 0.3, y + r * 0.8);
      ctx.lineTo(x + r * 0.55, y + r * 1.25);
      ctx.stroke();
    }
    if (bug.kind === "speedy") {
      ctx.strokeStyle = "rgba(255,216,104,0.8)";
      ctx.lineWidth = 2.5;
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.arc(x + k * r * 1.1, y, r * 0.55, -0.5, 0.5);
        ctx.stroke();
      }
    }
    if (boss) {
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, y - r * 1.35);
      ctx.lineTo(x - r * 0.2, y - r * 1.75);
      ctx.lineTo(x, y - r * 1.4);
      ctx.lineTo(x + r * 0.2, y - r * 1.75);
      ctx.lineTo(x + r * 0.4, y - r * 1.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.2, y - r * 0.8);
    ctx.lineTo(x - r * 0.5, y - r * 1.3);
    ctx.moveTo(x + r * 0.3, y - r * 0.8);
    ctx.lineTo(x + r * 0.6, y - r * 1.3);
    ctx.stroke();
    const munching = bug.chewTimer > 0 ? Math.abs(Math.sin(time * 10)) : 0;
    drawFace(x, y, r, munching);
    if (bug.freeze > 0) {
      ctx.fillStyle = "rgba(190,230,255,0.7)";
      ctx.font = `${Math.round(r * 0.8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("❄", x, y - r * 1.2);
    }
    // 血量点点
    const dots = Math.min(12, bug.maxHp + bug.maxArmor);
    const frac = (bug.hp + bug.armor) / (bug.maxHp + bug.maxArmor);
    for (let i = 0; i < dots; i++) {
      const filled = i < Math.ceil(frac * dots);
      ctx.fillStyle = filled ? "#7ac97a" : "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.arc(x - ((dots - 1) * r * 0.18) / 2 + i * r * 0.18, y - r * 1.6 + (bug.flying ? -r * 0.4 : 0), r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function panelBox(pw: number, ph: number): { x: number; y: number } {
    const x = (w - pw) / 2;
    const y = h / 2 - ph / 2;
    ctx.fillStyle = "rgba(250,255,246,0.85)";
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
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  function drawMap(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#eafbe0");
    grad.addColorStop(0.5, "#e8ecf8");
    grad.addColorStop(1, "#d4f0ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#4a9a5a";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌱 绿芽保卫战 · 战役地图", w / 2, 30);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#7a8a6e";
    ctx.fillText(`⭐ ${totalStars(progress)}/${LEVELS.length * 3} · ☀白天 🌙夜晚 💧水池`, w / 2, 58);

    mapNodes.length = 0;
    const cols: number = 5;
    const rows = Math.ceil(LEVELS.length / cols);
    const mx0 = w * 0.1;
    const mx1 = w * 0.9;
    const my0 = 92;
    const my1 = h - 30;
    const nr = Math.max(16, Math.min(26, (mx1 - mx0) / cols / 2.6, (my1 - my0) / rows / 2.6));
    for (let i = 0; i < LEVELS.length; i++) {
      const row = Math.floor(i / cols);
      const colRaw = i % cols;
      const col = row % 2 === 0 ? colRaw : cols - 1 - colRaw;
      const x = mx0 + ((mx1 - mx0) * (cols === 1 ? 0.5 : col / (cols - 1)));
      const y = my0 + (rows === 1 ? 0 : ((my1 - my0) * row) / (rows - 1));
      mapNodes.push({ idx: i, x, y, r: nr });
    }
    ctx.strokeStyle = "rgba(120,160,110,0.5)";
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
      const isBoss = def.feature.includes("BOSS");
      const r = isBoss ? n.r * 1.25 : n.r;
      const accent = def.scene === "night" ? "#8a5ac9" : def.scene === "pool" ? "#5a8ac9" : "#4a9a5a";
      ctx.fillStyle = unlocked ? (got > 0 ? "#e8f6e0" : "#ffffff") : "#e4e4ea";
      ctx.strokeStyle = unlocked ? accent : "#b8b8c2";
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
        ctx.fillStyle = accent;
        ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
        ctx.fillText(String(n.idx + 1), n.x, n.y);
        ctx.font = `${Math.round(r * 0.5)}px sans-serif`;
        const sceneIcon = def.scene === "night" ? "🌙" : def.scene === "pool" ? "💧" : "☀";
        ctx.fillText(isBoss ? "👑" : sceneIcon, n.x, n.y - r * 1.0);
        let starTxt = "";
        for (let s = 0; s < 3; s++) starTxt += s < got ? "⭐" : "▫";
        ctx.fillText(starTxt, n.x, n.y + r * 1.45);
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
    ctx.fillText(`第 ${levelIdx + 1} 关 · ${def.name} 守住啦!`, w / 2, y + 42);
    ctx.font = "34px sans-serif";
    let starTxt = "";
    for (let s = 0; s < 3; s++) starTxt += s < earnedStars ? "⭐" : "☆";
    ctx.fillText(starTxt, w / 2, y + 90);
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

  function drawRetryPanel(): void {
    const { y } = panelBox(Math.min(440, w - 40), 210);
    ctx.fillStyle = "#b28ae8";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("虫虫溜进小屋啦……", w / 2, y + 46);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText("没关系!就在这一关重新布阵", w / 2, y + 88);
    const bw2 = 132;
    btnMap = { x: w / 2 - bw2 - 10, y: y + 130, w: bw2, h: 44 };
    btnRetry = { x: w / 2 + 10, y: y + 130, w: bw2, h: 44 };
    drawButton(btnMap, "回地图", "#f0f0f5", "#5a5a6e");
    drawButton(btnRetry, "再试一次", "#ffd868", "#7a5a1a");
  }

  function drawIntroPanel(): void {
    const def = level();
    const { y } = panelBox(Math.min(450, w - 40), 200);
    const accent = def.scene === "night" ? "#8a5ac9" : def.scene === "pool" ? "#5a8ac9" : "#4a9a5a";
    ctx.fillStyle = accent;
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`第 ${levelIdx + 1} 关 · ${def.name}`, w / 2, y + 44);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.fillText(def.hint, w / 2, y + 90);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    const sceneName = def.scene === "night" ? "夜晚" : def.scene === "pool" ? "水池" : "白天";
    ctx.fillText(`${sceneName} · ${def.waves.length} 波 · 点一下屏幕开始`, w / 2, y + 130);
    ctx.fillText("(左上角 ◀ 可回地图)", w / 2, y + 158);
  }

  function draw(): void {
    if (phase === "map") {
      drawMap();
      return;
    }

    const def = level();
    const night = def.scene === "night";
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    ctx.fillStyle = night ? "#3e4468" : "#eafbe0";
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
    }

    for (let lane = 0; lane < LANES; lane++) {
      const water = isWaterLane(lane);
      if (water) {
        ctx.fillStyle = "#9fd8f5";
        ctx.fillRect(ox - cell * HOME_W_CELLS, oy + lane * cell, cell * (PLANT_COLS + HOME_W_CELLS), cell);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 2;
        for (let c = 0; c < PLANT_COLS; c++) {
          ctx.beginPath();
          const wy = oy + lane * cell + cell * 0.5 + Math.sin(time * 2 + c) * 3;
          ctx.moveTo(px(c) + cell * 0.2, wy);
          ctx.quadraticCurveTo(px(c) + cell * 0.5, wy - 4, px(c) + cell * 0.8, wy);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = night
          ? lane % 2 === 0 ? "#4e5878" : "#576184"
          : lane % 2 === 0 ? "#d5f2ca" : "#def5d5";
        ctx.fillRect(ox - cell * HOME_W_CELLS, oy + lane * cell, cell * (PLANT_COLS + HOME_W_CELLS), cell);
      }
      for (let c = 0; c < PLANT_COLS; c++) {
        ctx.strokeStyle = night ? "rgba(255,255,255,0.1)" : "rgba(120,160,110,0.18)";
        ctx.strokeRect(px(c), oy + lane * cell, cell, cell);
      }
    }

    // 小屋
    const hx = ox - cell * HOME_W_CELLS * 0.5;
    for (let lane = 0; lane < LANES; lane++) {
      const hy = laneCenterY(lane);
      ctx.fillStyle = "#ffd6e7";
      ctx.beginPath();
      ctx.roundRect(hx - cell * 0.38, hy - cell * 0.25, cell * 0.76, cell * 0.55, 6);
      ctx.fill();
      ctx.fillStyle = "#ff9eb5";
      ctx.beginPath();
      ctx.moveTo(hx - cell * 0.46, hy - cell * 0.22);
      ctx.lineTo(hx, hy - cell * 0.52);
      ctx.lineTo(hx + cell * 0.46, hy - cell * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e05a7a";
      ctx.font = `${Math.round(cell * 0.24)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💗", hx, hy + cell * 0.04);
    }

    // 荷叶
    for (const key of lilies) {
      const [c, lane] = key.split(",").map(Number);
      drawPlantIcon(px(c + 0.5), laneCenterY(lane) + cell * 0.12, cell * 0.42, "lily");
    }

    // 植物
    for (const p of plants.values()) {
      const x = px(p.col + 0.5);
      const y = laneCenterY(p.lane);
      ctx.globalAlpha = p.hp <= 1 ? 0.65 : 1;
      drawPlantIcon(x, y, cell * 0.42, p.kind, p.anim);
      if (p.kind === "nut") {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x - cell * 0.28, y - cell * 0.48, cell * 0.56, 4);
        ctx.fillStyle = "#7ac97a";
        ctx.fillRect(x - cell * 0.28, y - cell * 0.48, (cell * 0.56 * p.hp) / PLANT_INFO.nut.hp, 4);
      }
      ctx.globalAlpha = 1;
    }

    // 子弹
    for (const s of shots) {
      const x = px(s.x);
      const y = laneCenterY(s.lane) - cell * (s.proj === "bubble" ? 0.08 : 0.2);
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
      } else {
        ctx.fillStyle = "#ffd868";
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

    ctx.restore();

    // ---- 工具栏 ----
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, w, TOOLBAR_H);
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const r = cardRect(i);
      const afford = tool === "shovel" || canAfford(dew, tool);
      ctx.fillStyle = selected === tool ? "#fff1c9" : "#f3f3f7";
      ctx.strokeStyle = selected === tool ? "#ffb84d" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = afford ? 1 : 0.45;
      if (tool === "shovel") {
        drawShovelIcon(r.x + 18, r.y + r.h / 2, 14);
        ctx.fillStyle = "#5a5a6e";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("铲子", r.x + 36, r.y + r.h / 2 - 8);
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#9a9aa8";
        ctx.fillText("退半价", r.x + 36, r.y + r.h / 2 + 8);
      } else {
        drawPlantIcon(r.x + 18, r.y + r.h / 2, 13, tool);
        ctx.fillStyle = "#5a5a6e";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${PLANT_INFO[tool].name}💧${PLANT_INFO[tool].cost}`, r.x + 36, r.y + r.h / 2 - 8);
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "#9a9aa8";
        ctx.fillText(PLANT_INFO[tool].desc, r.x + 36, r.y + r.h / 2 + 8);
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "right";
    ctx.font = "15px sans-serif";
    ctx.fillStyle = dewFlash > 0 && Math.floor(dewFlash * 8) % 2 === 0 ? "#e05a7a" : "#5a5a6e";
    ctx.textBaseline = "middle";
    ctx.fillText(`💧 ${dew}`, w - 8, TOOLBAR_H / 2 - 12);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "11px sans-serif";
    ctx.fillText(
      `第${levelIdx + 1}/${LEVELS.length}关 波${Math.max(1, currentWave + 1)}/${level().waves.length}`,
      w - 8,
      TOOLBAR_H / 2 + 10,
    );

    // 回地图按钮(叠在工具栏下方左侧)
    btnBack = { x: 6, y: TOOLBAR_H + 4, w: 62, h: 28 };
    drawButton(btnBack, "◀ 地图", "rgba(255,255,255,0.85)", "#5a5a6e");

    // 波次横幅
    if (waveBanner > 0 && phase === "play") {
      ctx.globalAlpha = Math.min(1, waveBanner);
      ctx.fillStyle = bannerFlag ? "rgba(255,225,225,0.92)" : "rgba(255,255,255,0.85)";
      ctx.fillRect(0, h / 2 - 28, w, 56);
      ctx.fillStyle = "#e05a7a";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        bannerFlag ? "🚩 旗帜大波!!超多虫虫!" : `第 ${currentWave + 1} 波虫虫来啦!`,
        w / 2,
        h / 2,
      );
      ctx.globalAlpha = 1;
    }

    // ---- 覆盖层 ----
    if (phase === "intro") {
      drawIntroPanel();
      drawButton(btnBack, "◀ 地图", "#f0f0f5", "#5a5a6e");
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
  syncSize();
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
