// 花园守卫:简易塔防。点空地放蘑菇泡泡塔,别让软软怪碰到终点的花朵!
import {
  GRID_COLS,
  GRID_ROWS,
  buildWaypoints,
  canPlace,
  pathCellSet,
  pathLength,
  pickTarget,
  pointAlongPath,
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
  id: "garden-guard",
  title: "花园守卫",
  emoji: "🌼",
  category: "action" as const,
  color: "#ffd6e7",
  blurb: "点空地放蘑菇塔,别让软软怪碰到小花朵!",
};

const HUD_H = 52;
const TOWER_COST = 3;
const TOWER_RANGE = 2.3; // 单位:格
const TOWER_COOLDOWN = 0.75;
const BULLET_SPEED = 6; // 格/秒

interface Wave {
  count: number;
  hp: number;
  speed: number;
  gap: number;
}

const WAVES: Wave[] = [
  { count: 5, hp: 2, speed: 0.8, gap: 1.7 },
  { count: 7, hp: 3, speed: 0.95, gap: 1.35 },
  { count: 8, hp: 5, speed: 1.05, gap: 1.1 },
];

interface Monster {
  dist: number;
  speed: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  wob: number;
}

interface Tower {
  col: number;
  row: number;
  cd: number;
  firedAnim: number;
}

interface Bullet {
  x: number;
  y: number;
  target: Monster | null;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  r: number;
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

  const waypoints = buildWaypoints();
  const totalLen = pathLength(waypoints);
  const blocked = pathCellSet();
  const occupied = new Set<string>();

  const monsters: Monster[] = [];
  const towers: Tower[] = [];
  const bullets: Bullet[] = [];
  const particles: Particle[] = [];

  let petals = 6;
  let hearts = 3;
  let waveIdx = 0;
  let phase: "prewave" | "wave" | "done" = "prewave";
  let phaseTimer = 2.2;
  let spawned = 0;
  let spawnTimer = 0;
  let over = false;
  let petalFlash = 0;
  let time = 0;

  // 布局(每帧根据画布尺寸重新计算)
  let w = 640;
  let h = 480;
  let cell = 48;
  let ox = 0;
  let oy = HUD_H;

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
    cell = Math.min(w / GRID_COLS, (h - HUD_H) / GRID_ROWS);
    ox = (w - cell * GRID_COLS) / 2;
    oy = HUD_H + (h - HUD_H - cell * GRID_ROWS) / 2;
  }

  const px = (cx: number) => ox + cx * cell;
  const py = (cy: number) => oy + cy * cell;

  function burst(x: number, y: number, color: string, n = 8): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random();
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (40 + Math.random() * 60),
        vy: Math.sin(a) * (40 + Math.random() * 60),
        life: 0.5,
        color,
        r: 3 + Math.random() * 3,
      });
    }
  }

  function finish(win: boolean): void {
    if (over) return;
    over = true;
    phase = "done";
    if (win) {
      api.play("win");
      const stars = Math.max(1, Math.min(3, hearts)) as 1 | 2 | 3;
      api.onWin(stars, "花朵保住啦,你是最棒的小园丁!");
    } else {
      api.play("oops");
      api.onLose("花朵被碰到了,再试一次吧!");
    }
  }

  function onPointerDown(e: PointerEvent): void {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor((x - ox) / cell);
    const row = Math.floor((y - oy) / cell);
    if (!canPlace(col, row, blocked, occupied)) {
      api.play("tap");
      return;
    }
    if (petals < TOWER_COST) {
      petalFlash = 0.8;
      api.play("tap");
      return;
    }
    petals -= TOWER_COST;
    occupied.add(`${col},${row}`);
    towers.push({ col, row, cd: 0.2, firedAnim: 0 });
    api.play("pop");
    burst(px(col + 0.5), py(row + 0.5), "#ffd6e7", 10);
  }

  function update(dt: number): void {
    time += dt;
    petalFlash = Math.max(0, petalFlash - dt);

    if (phase === "prewave") {
      phaseTimer -= dt;
      if (phaseTimer <= 0) {
        phase = "wave";
        spawned = 0;
        spawnTimer = 0.3;
      }
    } else if (phase === "wave") {
      const wave = WAVES[waveIdx];
      if (spawned < wave.count) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnTimer = wave.gap;
          spawned++;
          monsters.push({
            dist: 0,
            speed: wave.speed,
            hp: wave.hp,
            maxHp: wave.hp,
            x: waypoints[0].x,
            y: waypoints[0].y,
            wob: Math.random() * Math.PI * 2,
          });
        }
      } else if (monsters.length === 0) {
        if (waveIdx >= WAVES.length - 1) {
          finish(true);
        } else {
          waveIdx++;
          phase = "prewave";
          phaseTimer = 2.5;
        }
      }
    }

    // 怪物前进
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.dist += m.speed * dt;
      m.wob += dt * 7;
      const p = pointAlongPath(waypoints, m.dist);
      m.x = p.x;
      m.y = p.y;
      if (p.done || m.dist >= totalLen) {
        monsters.splice(i, 1);
        hearts--;
        api.play("oops");
        burst(px(m.x), py(m.y), "#ff9eb5", 12);
        if (hearts <= 0) {
          finish(false);
          return;
        }
      }
    }

    // 塔开火
    for (const t of towers) {
      t.cd -= dt;
      t.firedAnim = Math.max(0, t.firedAnim - dt * 4);
      if (t.cd <= 0) {
        const idx = pickTarget(monsters, t.col + 0.5, t.row + 0.5, TOWER_RANGE);
        if (idx >= 0) {
          t.cd = TOWER_COOLDOWN;
          t.firedAnim = 1;
          bullets.push({ x: t.col + 0.5, y: t.row + 0.5, target: monsters[idx], life: 2 });
        }
      }
    }

    // 泡泡子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      const tgt = b.target;
      if (!tgt || tgt.hp <= 0 || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }
      const dx = tgt.x - b.x;
      const dy = tgt.y - b.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const step = BULLET_SPEED * dt;
      if (d <= Math.max(0.22, step)) {
        tgt.hp--;
        bullets.splice(i, 1);
        burst(px(tgt.x), py(tgt.y), "#bfe9ff", 6);
        if (tgt.hp <= 0) {
          const mi = monsters.indexOf(tgt);
          if (mi >= 0) monsters.splice(mi, 1);
          petals++;
          api.play("coin");
          burst(px(tgt.x), py(tgt.y), "#c9b6f2", 12);
        } else {
          api.play("pop");
        }
      } else {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawFace(x: number, y: number, r: number): void {
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(x + r * 0.32, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.15, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  function draw(): void {
    // 草地
    ctx.fillStyle = "#e3f7dc";
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#d5f2ca" : "#def5d5";
        ctx.fillRect(px(c), py(r), cell + 0.5, cell + 0.5);
      }
    }
    // 小路
    for (const key of blocked) {
      const [c, r] = key.split(",").map(Number);
      ctx.fillStyle = "#f9e9bd";
      ctx.fillRect(px(c), py(r), cell + 0.5, cell + 0.5);
    }

    // 终点花朵
    const end = waypoints[waypoints.length - 1];
    const fx = px(end.x);
    const fy = py(end.y);
    const fr = cell * 0.34;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + time * 0.4;
      ctx.fillStyle = i < hearts * 2 ? "#ffb3c8" : "#e9d8dd";
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fr * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffe387";
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 0.8, 0, Math.PI * 2);
    ctx.fill();
    drawFace(fx, fy, fr * 0.8);

    // 蘑菇泡泡塔
    for (const t of towers) {
      const tx = px(t.col + 0.5);
      const ty = py(t.row + 0.5);
      const r = cell * 0.3;
      const squish = 1 + t.firedAnim * 0.15;
      ctx.fillStyle = "#fff7f0";
      ctx.beginPath();
      ctx.ellipse(tx, ty + r * 0.35, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff9eb5";
      ctx.beginPath();
      ctx.ellipse(tx, ty - r * 0.25, r * squish, r * 0.75 * squish, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      for (const [dx2, dy2] of [
        [-0.45, -0.3],
        [0.35, -0.5],
        [0.1, 0.05],
      ]) {
        ctx.beginPath();
        ctx.arc(tx + dx2 * r, ty - r * 0.25 + dy2 * r, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      drawFace(tx, ty + r * 0.4, r * 0.55);
    }

    // 软软怪
    for (const m of monsters) {
      const mx = px(m.x);
      const my = py(m.y);
      const r = cell * 0.3;
      const sq = 1 + Math.sin(m.wob) * 0.08;
      ctx.fillStyle = m.maxHp <= 2 ? "#c9b6f2" : m.maxHp <= 3 ? "#9fd8f5" : "#ffc09b";
      ctx.beginPath();
      ctx.ellipse(mx, my, r * sq, r / sq, 0, 0, Math.PI * 2);
      ctx.fill();
      // 小脚丫
      ctx.fillStyle = "rgba(58,58,74,0.35)";
      ctx.beginPath();
      ctx.arc(mx - r * 0.4, my + r * 0.9, r * 0.16, 0, Math.PI * 2);
      ctx.arc(mx + r * 0.4, my + r * 0.9, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      drawFace(mx, my, r);
      // 血量点点
      for (let i = 0; i < m.maxHp; i++) {
        ctx.fillStyle = i < m.hp ? "#7ac97a" : "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.arc(mx - ((m.maxHp - 1) * r * 0.22) / 2 + i * r * 0.22, my - r * 1.35, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 泡泡子弹
    for (const b of bullets) {
      const bx = px(b.x);
      const by = py(b.y);
      ctx.fillStyle = "rgba(160,220,255,0.85)";
      ctx.beginPath();
      ctx.arc(bx, by, cell * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(bx - cell * 0.03, by - cell * 0.04, cell * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 顶部信息栏
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(0, 0, w, HUD_H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "20px sans-serif";
    ctx.fillStyle = petalFlash > 0 && Math.floor(petalFlash * 8) % 2 === 0 ? "#e05a7a" : "#5a5a6e";
    ctx.fillText(`🌸 × ${petals}  (放塔要 ${TOWER_COST} 朵)`, 12, HUD_H / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(`第 ${waveIdx + 1} / ${WAVES.length} 波`, w / 2, HUD_H / 2);
    ctx.textAlign = "right";
    ctx.fillText("💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, 3 - hearts)), w - 12, HUD_H / 2);

    if (phase === "prewave" && !over) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(0, h / 2 - 34, w, 68);
      ctx.fillStyle = "#e05a7a";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        waveIdx === 0 ? "点绿草地放蘑菇塔,保护小花朵!" : `第 ${waveIdx + 1} 波软软怪要来啦!`,
        w / 2,
        h / 2,
      );
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
