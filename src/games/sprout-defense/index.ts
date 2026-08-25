// 绿芽保卫战:在草地上种闪光芽攒露珠、种泡泡芽吹泡泡,拦住一路爬来的贪吃虫!
import {
  BugSpawn,
  HOME_X,
  LANES,
  PLANT_COLS,
  PLANT_INFO,
  PlantKind,
  bubbleHitsBug,
  bugReachesPlant,
  buildWaveSchedule,
  canAfford,
  starsForPlantsLost,
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
  blurb: "种下小绿芽吹泡泡,别让贪吃虫爬进小屋!",
};

const TOOLBAR_H = 64;
const HOME_W_CELLS = 1.2;
const BUBBLE_SPEED = 3.5; // 格/秒
const BUBBLE_CD = 1.3;
const CHEW_INTERVAL = 0.9;
const PASSIVE_DEW_EVERY = 3.5;
const SPARKLE_DEW_EVERY = 4.5;

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
  x: number;
  lane: number;
  hp: number;
  maxHp: number;
  speed: number;
  chewTimer: number;
  wob: number;
}

interface Bub {
  x: number;
  lane: number;
}

interface Sparkle {
  x: number;
  y: number;
  life: number;
  color: string;
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

  const schedule: BugSpawn[] = buildWaveSchedule();
  const plants = new Map<string, Plant>();
  const bugs: Bug[] = [];
  const bubs: Bub[] = [];
  const sparkles: Sparkle[] = [];

  let dew = 3;
  let selected: PlantKind = "bubble";
  let time = 0;
  let spawnIdx = 0;
  let passiveTimer = PASSIVE_DEW_EVERY;
  let plantsLost = 0;
  let over = false;
  let dewFlash = 0;

  let w = 640;
  let h = 480;
  let cell = 48;
  let ox = 0; // 种植区第 0 列左边缘
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

  function cardRect(i: number): { x: number; y: number; w: number; h: number } {
    return { x: 10 + i * 128, y: 8, w: 120, h: TOOLBAR_H - 16 };
  }

  function addSparkle(x: number, y: number, color: string): void {
    sparkles.push({ x, y, life: 0.6, color });
  }

  function finish(win: boolean): void {
    if (over) return;
    over = true;
    if (win) {
      api.play("win");
      api.onWin(starsForPlantsLost(plantsLost), "把贪吃虫都请回森林啦!");
    } else {
      api.play("oops");
      api.onLose("贪吃虫溜进小屋啦,再试一次!");
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 工具栏选卡
    const kinds: PlantKind[] = ["sparkle", "bubble"];
    for (let i = 0; i < kinds.length; i++) {
      const r = cardRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        selected = kinds[i];
        api.play("tap");
        return;
      }
    }

    // 点格子种植物
    const col = Math.floor((x - ox) / cell);
    const lane = Math.floor((y - oy) / cell);
    if (col < 0 || col >= PLANT_COLS || lane < 0 || lane >= LANES) return;
    const key = `${col},${lane}`;
    if (plants.has(key)) {
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

  function update(dt: number): void {
    time += dt;
    dewFlash = Math.max(0, dewFlash - dt);

    // 出虫
    while (spawnIdx < schedule.length && schedule[spawnIdx].time <= time) {
      const s = schedule[spawnIdx++];
      bugs.push({
        x: PLANT_COLS + 0.7,
        lane: s.lane,
        hp: s.hp,
        maxHp: s.hp,
        speed: s.speed,
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
      } else {
        p.cd -= dt;
        if (p.cd <= 0) {
          const hasTarget = bugs.some((b) => b.lane === p.lane && b.x > p.col + 0.3);
          if (hasTarget) {
            p.cd = BUBBLE_CD;
            p.anim = 1;
            bubs.push({ x: p.col + 0.7, lane: p.lane });
          }
        }
      }
    }

    // 泡泡飞行
    for (let i = bubs.length - 1; i >= 0; i--) {
      const b = bubs[i];
      b.x += BUBBLE_SPEED * dt;
      if (b.x > PLANT_COLS + 1.5) {
        bubs.splice(i, 1);
        continue;
      }
      for (const bug of bugs) {
        if (bug.lane !== b.lane || bug.hp <= 0) continue;
        if (bubbleHitsBug(b.x, bug.x)) {
          bug.hp--;
          bubs.splice(i, 1);
          addSparkle(px(bug.x), laneCenterY(bug.lane), "#bfe9ff");
          api.play("pop");
          break;
        }
      }
    }

    // 虫子:被打倒、啃植物、前进、进家门
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      bug.wob += dt * 6;
      if (bug.hp <= 0) {
        bugs.splice(i, 1);
        dew++;
        api.play("coin");
        addSparkle(px(bug.x), laneCenterY(bug.lane), "#c9b6f2");
        continue;
      }
      const p = plantInLaneCell(bug.lane, bug.x - 0.3);
      if (p && bugReachesPlant(bug.x, p.col)) {
        bug.chewTimer -= dt;
        if (bug.chewTimer <= 0) {
          bug.chewTimer = CHEW_INTERVAL;
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
        bug.x -= bug.speed * dt;
      }
      if (bug.x <= HOME_X) {
        finish(false);
        return;
      }
    }

    if (spawnIdx >= schedule.length && bugs.length === 0) {
      finish(true);
      return;
    }

    for (let i = sparkles.length - 1; i >= 0; i--) {
      sparkles[i].life -= dt;
      sparkles[i].y -= dt * 30;
      if (sparkles[i].life <= 0) sparkles.splice(i, 1);
    }
  }

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
      // 闪光芽:黄色小星花
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
    } else {
      // 泡泡芽:蓝绿色圆芽,嘴巴会鼓起来
      const sq = 1 + anim * 0.2;
      ctx.fillStyle = "#8fd8c8";
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.62 * sq, r * 0.62 / sq, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6fc4b0";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.15, y - r * 0.62, r * 0.2, r * 0.32, -0.5, 0, Math.PI * 2);
      ctx.fill();
      drawFace(x, y, r * 0.62, anim);
    }
    // 小土壤
    ctx.fillStyle = "rgba(170,130,90,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.75, r * 0.55, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(): void {
    ctx.fillStyle = "#eafbe0";
    ctx.fillRect(0, 0, w, h);

    // 车道条纹
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
      ctx.globalAlpha = 1;
    }

    // 泡泡
    for (const b of bubs) {
      const x = px(b.x);
      const y = laneCenterY(b.lane) - cell * 0.08;
      ctx.fillStyle = "rgba(160,220,255,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x - cell * 0.04, y - cell * 0.04, cell * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // 贪吃虫(圆滚滚毛毛虫)
    for (const bug of bugs) {
      const x = px(bug.x);
      const y = laneCenterY(bug.lane) + Math.sin(bug.wob) * cell * 0.03;
      const r = cell * 0.26;
      const color =
        bug.maxHp <= 3 ? "#ffcf8a" : bug.maxHp <= 4 ? "#9fd8f5" : bug.maxHp <= 5 ? "#c9b6f2" : "#ff9eb5";
      ctx.fillStyle = color;
      for (let s = 2; s >= 0; s--) {
        const sx = x + s * r * 0.9;
        const sr = r * (1 - s * 0.15);
        ctx.beginPath();
        ctx.arc(sx, y + Math.sin(bug.wob + s) * r * 0.12, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      // 触角
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
      for (let i = 0; i < bug.maxHp; i++) {
        ctx.fillStyle = i < bug.hp ? "#7ac97a" : "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.arc(x - ((bug.maxHp - 1) * r * 0.2) / 2 + i * r * 0.2, y - r * 1.6, r * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const s of sparkles) {
      ctx.globalAlpha = Math.max(0, s.life / 0.6);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 工具栏
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, w, TOOLBAR_H);
    const kinds: PlantKind[] = ["sparkle", "bubble"];
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i];
      const r = cardRect(i);
      ctx.fillStyle = selected === kind ? "#fff1c9" : "#f3f3f7";
      ctx.strokeStyle = selected === kind ? "#ffb84d" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.stroke();
      drawPlantIcon(r.x + 26, r.y + r.h / 2, 18, kind);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(PLANT_INFO[kind].name, r.x + 48, r.y + r.h / 2 - 9);
      ctx.fillText(`💧×${PLANT_INFO[kind].cost}`, r.x + 48, r.y + r.h / 2 + 10);
    }
    ctx.textAlign = "right";
    ctx.font = "18px sans-serif";
    ctx.fillStyle = dewFlash > 0 && Math.floor(dewFlash * 8) % 2 === 0 ? "#e05a7a" : "#5a5a6e";
    ctx.fillText(`💧 ${dew}`, w - 12, TOOLBAR_H / 2 - 10);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "14px sans-serif";
    ctx.fillText(`虫虫 ${spawnIdx}/${schedule.length}`, w - 12, TOOLBAR_H / 2 + 12);

    if (time < 4 && !over) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(0, h / 2 - 30, w, 60);
      ctx.fillStyle = "#4a9a5a";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("先选一张卡,再点格子种下小绿芽!", w / 2, h / 2);
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
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
