// 绿芽保卫战:五关植物守家!四种小植物 + 铲子,拦住爬爬虫、壳壳虫和会飞的飘飘虫!
import {
  BUG_INFO,
  BugKind,
  BugSpawn,
  HOME_X,
  LANES,
  LEVEL_COUNT,
  PLANT_COLS,
  PLANT_INFO,
  PLANT_KINDS,
  PlantKind,
  applyDamage,
  bubbleHitsBug,
  bugHp,
  bugReachesPlant,
  buildLevelSchedule,
  canAfford,
  projectileCanHit,
  shovelRefund,
  starsForRun,
  wavesInLevel,
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
  blurb: "五关守家!四种小植物摆阵,连会飞的虫虫都来啦!",
};

const TOOLBAR_H = 64;
const HOME_W_CELLS = 1.2;
const BUBBLE_SPEED = 3.5;
const STAR_SPEED = 4.2;
const SHOOT_CD = 1.3;
const CHEW_INTERVAL = 0.9;
const PASSIVE_DEW_EVERY = 3.5;
const SPARKLE_DEW_EVERY = 4.5;

type Phase = "intro" | "play" | "clear" | "retry" | "done";
type Tool = PlantKind | "shovel";

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
}

interface Shot {
  x: number;
  lane: number;
  proj: "bubble" | "star";
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

export function mount(api: GameAPI): { destroy: () => void } {
  const { root } = api;
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  // ---- 局状态 ----
  let level = 1;
  let phase: Phase = "intro";
  let schedule: BugSpawn[] = buildLevelSchedule(1);
  const plants = new Map<string, Plant>();
  const bugs: Bug[] = [];
  const shots: Shot[] = [];
  const sparkles: Sparkle[] = [];
  const floats: Floaty[] = [];

  let dew = 4;
  let selected: Tool = "bubble";
  let time = 0;
  let spawnIdx = 0;
  let passiveTimer = PASSIVE_DEW_EVERY;
  let plantsLost = 0;
  let plantsLostTotal = 0;
  let score = 0;
  let retries = 0;
  let over = false;
  let dewFlash = 0;
  let waveBanner = 0;
  let currentWave = -1;
  let shake = 0;

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

  const tools: Tool[] = [...PLANT_KINDS, "shovel"];

  function cardRect(i: number): { x: number; y: number; w: number; h: number } {
    const cw = Math.min(108, (w - 90) / tools.length);
    return { x: 8 + i * (cw + 5), y: 8, w: cw, h: TOOLBAR_H - 16 };
  }

  function addSparkle(x: number, y: number, color: string): void {
    sparkles.push({ x, y, life: 0.6, color });
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  function resetLevel(): void {
    schedule = buildLevelSchedule(level);
    plants.clear();
    bugs.length = 0;
    shots.length = 0;
    dew = 3 + level;
    time = 0;
    spawnIdx = 0;
    passiveTimer = PASSIVE_DEW_EVERY;
    plantsLost = 0;
    currentWave = -1;
    waveBanner = 0;
  }

  function finishWin(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("win");
    api.onWin(
      starsForRun(retries, plantsLostTotal),
      `五关全部守住,虫虫都回森林啦!得分 ${score}`,
    );
  }

  function failFinal(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("oops");
    api.onLose("最后一关好险呀,换个阵型再试试!");
  }

  function breach(): void {
    shake = 0.5;
    api.play("oops");
    if (level >= LEVEL_COUNT) {
      failFinal();
    } else {
      phase = "retry";
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (phase === "intro") {
      api.play("tap");
      phase = "play";
      return;
    }
    if (phase === "clear") {
      api.play("tap");
      level++;
      resetLevel();
      phase = "intro";
      return;
    }
    if (phase === "retry") {
      api.play("tap");
      retries++;
      resetLevel();
      phase = "play";
      return;
    }

    // 工具栏
    for (let i = 0; i < tools.length; i++) {
      const r = cardRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
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

    if (selected === "shovel") {
      if (existing) {
        const refund = shovelRefund(existing.kind);
        dew += refund;
        plants.delete(key);
        api.play("pop");
        addSparkle(px(col + 0.5), laneCenterY(lane), "#d5c9a8");
        addFloat(px(col + 0.5), laneCenterY(lane) - 14, `+${refund}💧`, "#5a8ac9");
      } else {
        api.play("tap");
      }
      return;
    }

    if (existing) {
      api.play("tap");
      return;
    }
    if (!canAfford(dew, selected)) {
      dewFlash = 0.8;
      api.play("tap");
      return;
    }
    dew -= PLANT_INFO[selected].cost;
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
    const gain = 10 * (currentWave + 1);
    score += gain;
    api.play("coin");
    addSparkle(px(bug.x), laneCenterY(bug.lane), "#c9b6f2");
    addFloat(px(bug.x), laneCenterY(bug.lane) - 16, `+${gain}`, "#c47a2a");
  }

  function update(dt: number): void {
    if (phase !== "play") {
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
      return;
    }

    time += dt;
    dewFlash = Math.max(0, dewFlash - dt);
    waveBanner = Math.max(0, waveBanner - dt);
    shake = Math.max(0, shake - dt);

    // 出虫
    while (spawnIdx < schedule.length && schedule[spawnIdx].time <= time) {
      const s = schedule[spawnIdx++];
      if (s.wave !== currentWave) {
        currentWave = s.wave;
        waveBanner = 1.8;
        api.play("jump");
      }
      const info = BUG_INFO[s.kind];
      bugs.push({
        kind: s.kind,
        x: PLANT_COLS + 0.7,
        lane: s.lane,
        hp: bugHp(s.kind, level),
        maxHp: bugHp(s.kind, level),
        armor: info.armor,
        maxArmor: info.armor,
        speed: info.speed,
        flying: info.flying,
        chewTimer: 0,
        wob: Math.random() * Math.PI * 2,
      });
    }

    // 露珠
    passiveTimer -= dt;
    if (passiveTimer <= 0) {
      passiveTimer = PASSIVE_DEW_EVERY;
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
      } else if (p.kind === "bubble" || p.kind === "star") {
        p.cd -= dt;
        if (p.cd <= 0) {
          const proj = p.kind === "bubble" ? "bubble" : "star";
          const hasTarget = bugs.some(
            (b) =>
              b.lane === p.lane &&
              b.x > p.col + 0.3 &&
              projectileCanHit(proj, b.flying),
          );
          if (hasTarget) {
            p.cd = SHOOT_CD;
            p.anim = 1;
            shots.push({ x: p.col + 0.7, lane: p.lane, proj });
          }
        }
      }
    }

    // 泡泡/星星飞行
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += (s.proj === "star" ? STAR_SPEED : BUBBLE_SPEED) * dt;
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
          shots.splice(i, 1);
          if (res.brokeArmor) {
            api.play("meow");
            addSparkle(px(bug.x), laneCenterY(bug.lane) - cell * 0.3, "#e8d8a8");
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

    // 虫子:啃植物、前进、进家门
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      bug.wob += dt * 6;
      if (bug.hp <= 0) {
        killBug(i);
        continue;
      }
      const p = bug.flying ? undefined : plantInLaneCell(bug.lane, bug.x - 0.3);
      if (p && bugReachesPlant(bug.x, p.col)) {
        bug.chewTimer -= dt;
        if (bug.chewTimer <= 0) {
          bug.chewTimer = CHEW_INTERVAL;
          p.hp--;
          p.anim = 1;
          if (p.hp <= 0) {
            plants.delete(`${p.col},${p.lane}`);
            plantsLost++;
            plantsLostTotal++;
            api.play("oops");
            addSparkle(px(p.col + 0.5), laneCenterY(p.lane), "#e9d8dd");
          }
        }
      } else {
        bug.x -= bug.speed * dt;
      }
      if (bug.x <= HOME_X) {
        breach();
        return;
      }
    }

    if (spawnIdx >= schedule.length && bugs.length === 0) {
      if (level >= LEVEL_COUNT) {
        finishWin();
      } else {
        phase = "clear";
        api.play("win");
      }
      return;
    }

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
    } else {
      // 星星芽
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
    }
    ctx.fillStyle = "rgba(170,130,90,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.75, r * 0.55, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
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

  function drawBug(bug: Bug): void {
    const hover = bug.flying ? -cell * 0.22 + Math.sin(bug.wob * 1.4) * cell * 0.06 : 0;
    const x = px(bug.x);
    const y = laneCenterY(bug.lane) + Math.sin(bug.wob) * cell * 0.03 + hover;
    const r = cell * 0.26;
    const color = bug.kind === "walker" ? "#ffcf8a" : bug.kind === "armor" ? "#c9b6f2" : "#9fd8f5";
    // 飞虫翅膀
    if (bug.flying) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const flap = Math.sin(bug.wob * 4) * r * 0.4;
      ctx.beginPath();
      ctx.ellipse(x + r * 0.2, y - r * 0.9 - flap, r * 0.55, r * 0.25, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + r * 0.2, y - r * 0.9 + flap, r * 0.55, r * 0.25, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    for (let s = 2; s >= 0; s--) {
      const sx = x + s * r * 0.9;
      const sr = r * (1 - s * 0.15);
      ctx.beginPath();
      ctx.arc(sx, y + Math.sin(bug.wob + s) * r * 0.12, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    // 壳壳虫的护甲壳
    if (bug.maxArmor > 0 && bug.armor > 0) {
      ctx.fillStyle = "rgba(216,196,150,0.95)";
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r * 0.25, r * 1.05, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#b8a070";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r * 0.25, r * 1.05, Math.PI, 0);
      ctx.stroke();
      // 护甲裂纹随掉甲增多
      const cracks = bug.maxArmor - bug.armor;
      ctx.strokeStyle = "rgba(120,95,60,0.7)";
      ctx.lineWidth = 1.5;
      for (let c = 0; c < cracks; c++) {
        ctx.beginPath();
        ctx.moveTo(x + r * (0.1 + c * 0.4), y - r * 0.9);
        ctx.lineTo(x + r * (0.3 + c * 0.4), y - r * 0.45);
        ctx.stroke();
      }
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
    // 血量点点
    const dots = bug.maxHp + bug.maxArmor;
    for (let i = 0; i < dots; i++) {
      const filled = i < bug.hp + bug.armor;
      const isArmor = i >= bug.maxHp;
      ctx.fillStyle = filled ? (isArmor ? "#c8a858" : "#7ac97a") : "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.arc(x - ((dots - 1) * r * 0.2) / 2 + i * r * 0.2, y - r * 1.6 + (bug.flying ? -r * 0.4 : 0), r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function overlayPanel(title: string, sub: string, accent: string): void {
    ctx.fillStyle = "rgba(250,255,246,0.82)";
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(440, w - 40);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect((w - pw) / 2, h / 2 - 76, pw, 152, 22);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "bold 25px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, w / 2, h / 2 - 26);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.fillText(sub, w / 2, h / 2 + 14);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText("点一下屏幕继续", w / 2, h / 2 + 48);
  }

  function draw(): void {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    ctx.fillStyle = "#eafbe0";
    ctx.fillRect(-20, -20, w + 40, h + 40);

    for (let lane = 0; lane < LANES; lane++) {
      ctx.fillStyle = lane % 2 === 0 ? "#d5f2ca" : "#def5d5";
      ctx.fillRect(ox - cell * HOME_W_CELLS, oy + lane * cell, cell * (PLANT_COLS + HOME_W_CELLS), cell);
      for (let c = 0; c < PLANT_COLS; c++) {
        ctx.strokeStyle = "rgba(120,160,110,0.18)";
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

    // 植物
    for (const p of plants.values()) {
      const x = px(p.col + 0.5);
      const y = laneCenterY(p.lane);
      ctx.globalAlpha = p.hp <= 1 ? 0.65 : 1;
      drawPlantIcon(x, y, cell * 0.42, p.kind, p.anim);
      // 果果墩血量小条
      if (p.kind === "nut") {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x - cell * 0.28, y - cell * 0.48, cell * 0.56, 4);
        ctx.fillStyle = "#7ac97a";
        ctx.fillRect(x - cell * 0.28, y - cell * 0.48, (cell * 0.56 * p.hp) / PLANT_INFO.nut.hp, 4);
      }
      ctx.globalAlpha = 1;
    }

    // 泡泡与星星
    for (const s of shots) {
      const x = px(s.x);
      const y = laneCenterY(s.lane) - cell * (s.proj === "star" ? 0.2 : 0.08);
      if (s.proj === "bubble") {
        ctx.fillStyle = "rgba(160,220,255,0.85)";
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(x - cell * 0.04, y - cell * 0.04, cell * 0.04, 0, Math.PI * 2);
        ctx.fill();
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
        drawShovelIcon(r.x + 22, r.y + r.h / 2, 16);
        ctx.fillStyle = "#5a5a6e";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("铲子", r.x + 42, r.y + r.h / 2 - 8);
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#9a9aa8";
        ctx.fillText("铲掉退半价", r.x + 42, r.y + r.h / 2 + 9);
      } else {
        drawPlantIcon(r.x + 22, r.y + r.h / 2, 15, tool);
        ctx.fillStyle = "#5a5a6e";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${PLANT_INFO[tool].name} 💧${PLANT_INFO[tool].cost}`, r.x + 42, r.y + r.h / 2 - 8);
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#9a9aa8";
        ctx.fillText(PLANT_INFO[tool].desc, r.x + 42, r.y + r.h / 2 + 9);
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "right";
    ctx.font = "16px sans-serif";
    ctx.fillStyle = dewFlash > 0 && Math.floor(dewFlash * 8) % 2 === 0 ? "#e05a7a" : "#5a5a6e";
    ctx.textBaseline = "middle";
    ctx.fillText(`💧 ${dew}`, w - 10, TOOLBAR_H / 2 - 12);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      `第${level}/${LEVEL_COUNT}关 波${Math.max(1, currentWave + 1)}/${wavesInLevel(level)} 分${score}`,
      w - 10,
      TOOLBAR_H / 2 + 10,
    );

    // 波次横幅
    if (waveBanner > 0 && phase === "play") {
      ctx.globalAlpha = Math.min(1, waveBanner);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(0, h / 2 - 28, w, 56);
      ctx.fillStyle = "#e05a7a";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`第 ${currentWave + 1} 波虫虫来啦!`, w / 2, h / 2);
      ctx.globalAlpha = 1;
    }

    // ---- 覆盖层 ----
    if (phase === "intro") {
      overlayPanel(
        `第 ${level} 关`,
        level === 1
          ? "先选卡再点格子种植物,别让虫虫进小屋!"
          : level === 2
            ? "飘飘虫会飞,泡泡打不到,快种星星芽!"
            : level === 3
              ? "壳壳虫有硬壳,要先敲碎再打!"
              : `${wavesInLevel(level)} 波虫虫,摆好阵再开战!`,
        "#4a9a5a",
      );
    } else if (phase === "clear") {
      overlayPanel(`第 ${level} 关守住啦!`, `得分 ${score} · 损失植物 ${plantsLost} 棵`, "#4a9a5a");
    } else if (phase === "retry") {
      overlayPanel("虫虫溜进小屋啦……", "没关系!点一下重新布阵这一关", "#b28ae8");
    }
  }

  let raf = 0;
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    syncSize();
    if (!over) update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  syncSize();
  resetLevel();
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
