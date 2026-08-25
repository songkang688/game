// 花园守卫:五关塔防。三种蘑菇塔可升级可卖,拦住一路软软怪,最后打倒大软软 BOSS!
import {
  GRID_COLS,
  GRID_ROWS,
  LEVELS,
  MAX_TOWER_LEVEL,
  MONSTER_INFO,
  MonsterKind,
  TOWER_INFO,
  TOWER_KINDS,
  TowerKind,
  buildWaypoints,
  canPlace,
  combineSlow,
  comboPetalBonus,
  dewSlowFactor,
  monsterHp,
  pathCellSet,
  pathLength,
  pickTarget,
  pointAlongPath,
  sellRefund,
  starsForRun,
  towerCooldown,
  towerDamage,
  towerRange,
  upgradeCost,
  waveSpawnTimes,
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
  blurb: "五关塔防!放蘑菇塔、升级卖塔,打倒大软软 BOSS!",
};

const HUD_H = 44;
const TOOLBAR_H = 58;
const HEARTS_PER_LEVEL = 3;

type Phase = "intro" | "prewave" | "wave" | "clear" | "retry" | "done";

interface Monster {
  kind: MonsterKind;
  dist: number;
  baseSpeed: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  wob: number;
  slowed: boolean;
}

interface Tower {
  kind: TowerKind;
  col: number;
  row: number;
  level: number;
  cd: number;
  firedAnim: number;
}

interface Bullet {
  x: number;
  y: number;
  target: Monster | null;
  life: number;
  dmg: number;
  speed: number;
  needle: boolean;
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
  let levelIdx = 0;
  let phase: Phase = "intro";
  let phaseTimer = 0;
  let waveIdx = 0;
  let petals = LEVELS[0].startPetals;
  let hearts = HEARTS_PER_LEVEL;
  let score = 0;
  let combo = 0;
  let comboTimer = 0;
  let retries = 0;
  let heartsLostTotal = 0;
  let over = false;
  let petalFlash = 0;
  let shake = 0;
  let time = 0;

  let waypoints = buildWaypoints(LEVELS[0].corners);
  let totalLen = pathLength(waypoints);
  let blocked = pathCellSet(LEVELS[0].corners);
  const occupied = new Map<string, Tower>();

  const monsters: Monster[] = [];
  const towers: Tower[] = [];
  const bullets: Bullet[] = [];
  const particles: Particle[] = [];
  const floats: Floaty[] = [];

  let spawnList: Array<{ kind: MonsterKind; time: number }> = [];
  let spawnIdx = 0;
  let spawnClock = 0;

  let selectedCard: TowerKind = "bubble";
  let selectedTower: Tower | null = null;
  let panelUpgrade: Rect | null = null;
  let panelSell: Rect | null = null;
  const cardRects: Array<{ kind: TowerKind; rect: Rect }> = [];

  // ---- 布局 ----
  let w = 640;
  let h = 480;
  let cell = 48;
  let ox = 0;
  let oy = HUD_H + TOOLBAR_H;

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
    const top = HUD_H + TOOLBAR_H;
    cell = Math.min(w / GRID_COLS, (h - top) / GRID_ROWS);
    ox = (w - cell * GRID_COLS) / 2;
    oy = top + (h - top - cell * GRID_ROWS) / 2;
  }

  const px = (cx: number) => ox + cx * cell;
  const py = (cy: number) => oy + cy * cell;

  function burst(x: number, y: number, color: string, n = 8, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random();
      particles.push({
        x,
        y,
        vx: Math.cos(a) * (40 + Math.random() * 60) * power,
        vy: Math.sin(a) * (40 + Math.random() * 60) * power,
        life: 0.5,
        color,
        r: 3 + Math.random() * 3,
      });
    }
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  // ---- 关卡流程 ----
  function loadLevel(idx: number): void {
    levelIdx = idx;
    const def = LEVELS[idx];
    waypoints = buildWaypoints(def.corners);
    totalLen = pathLength(waypoints);
    blocked = pathCellSet(def.corners);
    resetLevel();
    phase = "intro";
  }

  function resetLevel(): void {
    const def = LEVELS[levelIdx];
    monsters.length = 0;
    bullets.length = 0;
    towers.length = 0;
    occupied.clear();
    petals = def.startPetals;
    hearts = HEARTS_PER_LEVEL;
    waveIdx = 0;
    combo = 0;
    selectedTower = null;
    spawnList = [];
    spawnIdx = 0;
    spawnClock = 0;
  }

  function startWave(): void {
    spawnList = waveSpawnTimes(LEVELS[levelIdx].waves[waveIdx]);
    spawnIdx = 0;
    spawnClock = -0.3;
    phase = "wave";
  }

  function finishRun(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("win");
    api.onWin(
      starsForRun(retries, heartsLostTotal),
      `五关全部守住,大软软也被请回家啦!得分 ${score}`,
    );
  }

  function failFinalLevel(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("oops");
    api.onLose("最后一关好险呀,再来挑战一次大软软!");
  }

  // ---- 输入 ----
  function inRect(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function onPointerDown(e: PointerEvent): void {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (phase === "intro") {
      api.play("tap");
      phase = "prewave";
      phaseTimer = 1.6;
      return;
    }
    if (phase === "clear") {
      api.play("tap");
      loadLevel(levelIdx + 1);
      return;
    }
    if (phase === "retry") {
      api.play("tap");
      retries++;
      resetLevel();
      phase = "prewave";
      phaseTimer = 1.6;
      return;
    }

    // 工具栏选卡
    for (const c of cardRects) {
      if (inRect(x, y, c.rect)) {
        selectedCard = c.kind;
        selectedTower = null;
        api.play("tap");
        return;
      }
    }

    // 塔操作面板
    if (selectedTower) {
      const t = selectedTower;
      if (panelUpgrade && inRect(x, y, panelUpgrade) && t.level < MAX_TOWER_LEVEL) {
        const cost = upgradeCost(t.kind, t.level);
        if (petals >= cost) {
          petals -= cost;
          t.level++;
          api.play("coin");
          burst(px(t.col + 0.5), py(t.row + 0.5), "#ffe387", 12);
          addFloat(px(t.col + 0.5), py(t.row), `升到 ${t.level} 级!`, "#c47a2a");
        } else {
          petalFlash = 0.8;
          api.play("tap");
        }
        return;
      }
      if (panelSell && inRect(x, y, panelSell)) {
        const refund = sellRefund(t.kind, t.level);
        petals += refund;
        occupied.delete(`${t.col},${t.row}`);
        const ti = towers.indexOf(t);
        if (ti >= 0) towers.splice(ti, 1);
        selectedTower = null;
        api.play("coin");
        addFloat(px(t.col + 0.5), py(t.row + 0.5), `+${refund} 🌸`, "#e05a7a");
        return;
      }
    }

    const col = Math.floor((x - ox) / cell);
    const row = Math.floor((y - oy) / cell);
    const key = `${col},${row}`;

    // 点已有塔 → 打开升级/卖塔面板
    const existing = occupied.get(key);
    if (existing) {
      selectedTower = selectedTower === existing ? null : existing;
      api.play("tap");
      return;
    }
    selectedTower = null;

    if (!canPlace(col, row, blocked, new Set(occupied.keys()))) {
      api.play("tap");
      return;
    }
    const cost = TOWER_INFO[selectedCard].cost;
    if (petals < cost) {
      petalFlash = 0.8;
      api.play("tap");
      return;
    }
    petals -= cost;
    const tw: Tower = { kind: selectedCard, col, row, level: 1, cd: 0.2, firedAnim: 0 };
    occupied.set(key, tw);
    towers.push(tw);
    api.play("pop");
    burst(px(col + 0.5), py(row + 0.5), "#ffd6e7", 10);
  }

  // ---- 更新 ----
  function onMonsterKilled(m: Monster): void {
    const reward = MONSTER_INFO[m.kind].reward;
    petals += reward;
    combo++;
    comboTimer = 2.2;
    const gain = 10 + (Math.min(combo, 8) - 1) * 5;
    score += gain;
    const bonus = comboPetalBonus(combo);
    if (bonus > 0) {
      petals += bonus;
      addFloat(px(m.x), py(m.y) - 22, `连击 ×${combo} +${bonus}🌸`, "#b28ae8", true);
      api.play("coin");
    } else {
      api.play(m.kind === "boss" ? "win" : "coin");
    }
    addFloat(px(m.x), py(m.y), `+${gain}`, "#c47a2a");
    burst(px(m.x), py(m.y), "#c9b6f2", m.kind === "boss" ? 26 : 12, m.kind === "boss" ? 1.8 : 1);
    if (m.kind === "boss") {
      addFloat(px(m.x), py(m.y) - 40, "BOSS 打倒啦!", "#e05a7a", true);
      shake = 0.5;
    }
  }

  function update(dt: number): void {
    time += dt;
    petalFlash = Math.max(0, petalFlash - dt);
    shake = Math.max(0, shake - dt);
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    if (phase === "prewave") {
      phaseTimer -= dt;
      if (phaseTimer <= 0) startWave();
    } else if (phase === "wave") {
      spawnClock += dt;
      while (spawnIdx < spawnList.length && spawnList[spawnIdx].time <= spawnClock) {
        const s = spawnList[spawnIdx++];
        const spec = MONSTER_INFO[s.kind];
        monsters.push({
          kind: s.kind,
          dist: 0,
          baseSpeed: spec.speed,
          hp: monsterHp(s.kind, levelIdx + 1),
          maxHp: monsterHp(s.kind, levelIdx + 1),
          x: waypoints[0].x,
          y: waypoints[0].y,
          wob: Math.random() * Math.PI * 2,
          slowed: false,
        });
      }
      if (spawnIdx >= spawnList.length && monsters.length === 0) {
        petals += 3;
        addFloat(w / 2, oy + 40, "波次奖励 +3 🌸", "#e05a7a", true);
        if (waveIdx >= LEVELS[levelIdx].waves.length - 1) {
          if (levelIdx >= LEVELS.length - 1) {
            finishRun();
          } else {
            phase = "clear";
            api.play("win");
          }
        } else {
          waveIdx++;
          phase = "prewave";
          phaseTimer = 2.4;
          api.play("jump");
        }
        return;
      }
    }

    if (phase !== "wave" && phase !== "prewave") return;

    // 露珠塔光环
    for (const m of monsters) {
      const factors: number[] = [];
      for (const t of towers) {
        if (t.kind !== "dew") continue;
        const d = Math.hypot(m.x - (t.col + 0.5), m.y - (t.row + 0.5));
        if (d <= towerRange("dew", t.level)) factors.push(dewSlowFactor(t.level));
      }
      const factor = combineSlow(factors);
      m.slowed = factor < 1;
      m.dist += m.baseSpeed * factor * dt;
      m.wob += dt * 7;
      const p = pointAlongPath(waypoints, m.dist);
      m.x = p.x;
      m.y = p.y;
      if (p.done || m.dist >= totalLen) {
        const mi = monsters.indexOf(m);
        if (mi >= 0) monsters.splice(mi, 1);
        hearts--;
        heartsLostTotal++;
        shake = 0.35;
        api.play("oops");
        burst(px(m.x), py(m.y), "#ff9eb5", 14);
        if (hearts <= 0) {
          if (levelIdx >= LEVELS.length - 1) {
            failFinalLevel();
          } else {
            phase = "retry";
            api.play("oops");
          }
          return;
        }
      }
    }

    // 攻击塔开火
    for (const t of towers) {
      if (t.kind === "dew") continue;
      t.cd -= dt;
      t.firedAnim = Math.max(0, t.firedAnim - dt * 4);
      if (t.cd <= 0) {
        const idx = pickTarget(monsters, t.col + 0.5, t.row + 0.5, towerRange(t.kind, t.level));
        if (idx >= 0) {
          t.cd = towerCooldown(t.kind, t.level);
          t.firedAnim = 1;
          bullets.push({
            x: t.col + 0.5,
            y: t.row + 0.5,
            target: monsters[idx],
            life: 2,
            dmg: towerDamage(t.kind, t.level),
            speed: t.kind === "needle" ? 12 : 6,
            needle: t.kind === "needle",
          });
        }
      }
    }

    // 子弹飞行
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
      const step = b.speed * dt;
      if (d <= Math.max(0.22, step)) {
        tgt.hp -= b.dmg;
        bullets.splice(i, 1);
        burst(px(tgt.x), py(tgt.y), b.needle ? "#c8f2d8" : "#bfe9ff", 6);
        if (tgt.hp <= 0) {
          const mi = monsters.indexOf(tgt);
          if (mi >= 0) monsters.splice(mi, 1);
          onMonsterKilled(tgt);
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
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y -= dt * 34;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  // ---- 绘制 ----
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

  function drawTowerIcon(kind: TowerKind, tx: number, ty: number, r: number, level = 1, anim = 0): void {
    if (kind === "bubble") {
      const squish = 1 + anim * 0.15;
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
    } else if (kind === "needle") {
      // 仙人掌小塔
      ctx.fillStyle = "#8fd8a8";
      ctx.beginPath();
      ctx.ellipse(tx, ty, r * 0.62, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#5aa878";
      ctx.lineWidth = Math.max(1.5, r * 0.09);
      const spikes = 6;
      for (let i = 0; i < spikes; i++) {
        const a = (Math.PI * 2 * i) / spikes + anim * 0.5;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(a) * r * 0.62, ty + Math.sin(a) * r * 0.8);
        ctx.lineTo(tx + Math.cos(a) * r * (0.85 + anim * 0.2), ty + Math.sin(a) * r * (1.05 + anim * 0.2));
        ctx.stroke();
      }
      ctx.fillStyle = "#ffb3c8";
      ctx.beginPath();
      ctx.arc(tx, ty - r * 0.85, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      drawFace(tx, ty, r * 0.55);
    } else {
      // 露珠塔
      ctx.fillStyle = "#9fd8f5";
      ctx.beginPath();
      ctx.moveTo(tx, ty - r * 0.95);
      ctx.quadraticCurveTo(tx + r * 0.75, ty - r * 0.05, tx + r * 0.6, ty + r * 0.4);
      ctx.arc(tx, ty + r * 0.28, r * 0.62, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.quadraticCurveTo(tx - r * 0.75, ty - r * 0.05, tx, ty - r * 0.95);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(tx - r * 0.22, ty - r * 0.05, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      drawFace(tx, ty + r * 0.25, r * 0.5);
    }
    // 等级小星星
    for (let i = 1; i < level; i++) {
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.arc(tx - r * 0.5 + (i - 1) * r * 0.45, ty - r * 1.15, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMonster(m: Monster): void {
    const mx = px(m.x);
    const my = py(m.y);
    const spec = MONSTER_INFO[m.kind];
    const r = cell * spec.size;
    const sq = 1 + Math.sin(m.wob) * 0.08;
    const colors: Record<MonsterKind, string> = {
      softy: "#c9b6f2",
      fasty: "#9fd8f5",
      tanky: "#ffc09b",
      boss: "#ff9eb5",
    };
    ctx.fillStyle = colors[m.kind];
    ctx.beginPath();
    ctx.ellipse(mx, my, r * sq, r / sq, 0, 0, Math.PI * 2);
    ctx.fill();
    if (m.kind === "fasty") {
      // 小翅膀
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const flap = Math.sin(m.wob * 2) * r * 0.3;
      ctx.beginPath();
      ctx.ellipse(mx - r * 0.9, my - r * 0.3 - flap, r * 0.45, r * 0.22, -0.5, 0, Math.PI * 2);
      ctx.ellipse(mx + r * 0.9, my - r * 0.3 + flap, r * 0.45, r * 0.22, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m.kind === "tanky") {
      // 小头盔
      ctx.fillStyle = "#e8a878";
      ctx.beginPath();
      ctx.arc(mx, my - r * 0.55, r * 0.6, Math.PI, 0);
      ctx.fill();
    }
    if (m.kind === "boss") {
      // 小皇冠
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.moveTo(mx - r * 0.4, my - r * 0.95);
      ctx.lineTo(mx - r * 0.2, my - r * 1.35);
      ctx.lineTo(mx, my - r * 1.0);
      ctx.lineTo(mx + r * 0.2, my - r * 1.35);
      ctx.lineTo(mx + r * 0.4, my - r * 0.95);
      ctx.closePath();
      ctx.fill();
    }
    if (m.slowed) {
      ctx.fillStyle = "rgba(160,220,255,0.5)";
      ctx.beginPath();
      ctx.arc(mx + r * 0.7, my - r * 0.8, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(58,58,74,0.35)";
    ctx.beginPath();
    ctx.arc(mx - r * 0.4, my + r * 0.9, r * 0.16, 0, Math.PI * 2);
    ctx.arc(mx + r * 0.4, my + r * 0.9, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    drawFace(mx, my, r);
    // 血条
    const bw = r * 2.2;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.roundRect(mx - bw / 2, my - r * 1.55, bw, Math.max(3, r * 0.16), 3);
    ctx.fill();
    ctx.fillStyle = m.kind === "boss" ? "#e05a7a" : "#7ac97a";
    ctx.beginPath();
    ctx.roundRect(mx - bw / 2, my - r * 1.55, (bw * m.hp) / m.maxHp, Math.max(3, r * 0.16), 3);
    ctx.fill();
  }

  function overlayPanel(title: string, sub: string, accent: string): void {
    ctx.fillStyle = "rgba(255,245,250,0.82)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    const pw = Math.min(430, w - 40);
    ctx.beginPath();
    ctx.roundRect((w - pw) / 2, h / 2 - 76, pw, 152, 22);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, w / 2, h / 2 - 26);
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "17px sans-serif";
    ctx.fillText(sub, w / 2, h / 2 + 16);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#a0a0b2";
    ctx.fillText("点一下屏幕继续", w / 2, h / 2 + 50);
  }

  function draw(): void {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    }

    // 草地
    ctx.fillStyle = "#e3f7dc";
    ctx.fillRect(-20, -20, w + 40, h + 40);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#d5f2ca" : "#def5d5";
        ctx.fillRect(px(c), py(r), cell + 0.5, cell + 0.5);
      }
    }
    for (const key of blocked) {
      const [c, r] = key.split(",").map(Number);
      ctx.fillStyle = "#f9e9bd";
      ctx.fillRect(px(c), py(r), cell + 0.5, cell + 0.5);
    }

    // 起点小门
    const start = waypoints[0];
    ctx.fillStyle = "#c9b6f2";
    ctx.beginPath();
    ctx.arc(px(start.x), py(start.y), cell * 0.32, Math.PI, 0);
    ctx.fill();

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

    // 露珠塔光环
    for (const t of towers) {
      if (t.kind !== "dew") continue;
      const rr = towerRange("dew", t.level) * cell;
      ctx.fillStyle = `rgba(160,220,255,${0.12 + Math.sin(time * 3) * 0.04})`;
      ctx.beginPath();
      ctx.arc(px(t.col + 0.5), py(t.row + 0.5), rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 选中塔的射程圈
    if (selectedTower) {
      const t = selectedTower;
      ctx.strokeStyle = "rgba(224,90,122,0.5)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(t.col + 0.5), py(t.row + 0.5), towerRange(t.kind, t.level) * cell, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const t of towers) {
      drawTowerIcon(t.kind, px(t.col + 0.5), py(t.row + 0.5), cell * 0.3, t.level, t.firedAnim);
    }

    for (const m of monsters) drawMonster(m);

    // 子弹
    for (const b of bullets) {
      const bx = px(b.x);
      const by = py(b.y);
      if (b.needle) {
        const tgt = b.target;
        const a = tgt ? Math.atan2(tgt.y - b.y, tgt.x - b.x) : 0;
        ctx.strokeStyle = "#5aa878";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a) * cell * 0.14, by - Math.sin(a) * cell * 0.14);
        ctx.lineTo(bx + Math.cos(a) * cell * 0.14, by + Math.sin(a) * cell * 0.14);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(160,220,255,0.85)";
        ctx.beginPath();
        ctx.arc(bx, by, cell * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(bx - cell * 0.03, by - cell * 0.04, cell * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 塔操作面板
    panelUpgrade = null;
    panelSell = null;
    if (selectedTower && !over && (phase === "wave" || phase === "prewave")) {
      const t = selectedTower;
      const cxp = px(t.col + 0.5);
      const topY = py(t.row) - 46;
      const bw2 = 92;
      const gap = 6;
      const x0 = Math.max(6, Math.min(w - bw2 * 2 - gap - 6, cxp - bw2 - gap / 2));
      const yy = Math.max(HUD_H + TOOLBAR_H + 4, topY);
      panelUpgrade = { x: x0, y: yy, w: bw2, h: 36 };
      panelSell = { x: x0 + bw2 + gap, y: yy, w: bw2, h: 36 };
      const canUp = t.level < MAX_TOWER_LEVEL;
      ctx.fillStyle = canUp ? "#fff1c9" : "#eeeef2";
      ctx.strokeStyle = canUp ? "#ffb84d" : "#c8c8d2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(panelUpgrade.x, panelUpgrade.y, panelUpgrade.w, panelUpgrade.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = canUp ? "#c47a2a" : "#9a9aa8";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        canUp ? `⬆升级 ${upgradeCost(t.kind, t.level)}🌸` : "已满级",
        panelUpgrade.x + bw2 / 2,
        panelUpgrade.y + 18,
      );
      ctx.fillStyle = "#ffe3ec";
      ctx.strokeStyle = "#ff9eb5";
      ctx.beginPath();
      ctx.roundRect(panelSell.x, panelSell.y, panelSell.w, panelSell.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e05a7a";
      ctx.fillText(`卖 +${sellRefund(t.kind, t.level)}🌸`, panelSell.x + bw2 / 2, panelSell.y + 18);
    }

    // 飘字
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 22px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(0, 0, w, HUD_H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "17px sans-serif";
    ctx.fillStyle = petalFlash > 0 && Math.floor(petalFlash * 8) % 2 === 0 ? "#e05a7a" : "#5a5a6e";
    ctx.fillText(`🌸 ${petals}`, 12, HUD_H / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "#5a5a6e";
    ctx.fillText(
      `第 ${levelIdx + 1}/${LEVELS.length} 关 · 波 ${waveIdx + 1}/${LEVELS[levelIdx].waves.length}`,
      w / 2 - 40,
      HUD_H / 2,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_LEVEL - hearts)) + `  分 ${score}`,
      w - 12,
      HUD_H / 2,
    );

    // 连击提示
    if (combo >= 2 && comboTimer > 0) {
      ctx.fillStyle = "#b28ae8";
      ctx.font = `bold ${20 + Math.min(combo, 8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`连击 ×${combo}`, w / 2, HUD_H + TOOLBAR_H + 22);
    }

    // ---- 工具栏 ----
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, HUD_H, w, TOOLBAR_H);
    cardRects.length = 0;
    const cw = Math.min(150, (w - 24) / TOWER_KINDS.length);
    for (let i = 0; i < TOWER_KINDS.length; i++) {
      const kind = TOWER_KINDS[i];
      const rect: Rect = { x: 8 + i * (cw + 6), y: HUD_H + 6, w: cw, h: TOOLBAR_H - 12 };
      cardRects.push({ kind, rect });
      const afford = petals >= TOWER_INFO[kind].cost;
      ctx.fillStyle = selectedCard === kind ? "#fff1c9" : afford ? "#f6f6fa" : "#efeff3";
      ctx.strokeStyle = selectedCard === kind ? "#ffb84d" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = afford ? 1 : 0.45;
      drawTowerIcon(kind, rect.x + 22, rect.y + rect.h / 2 + 2, 13);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${TOWER_INFO[kind].name} ${TOWER_INFO[kind].cost}🌸`, rect.x + 42, rect.y + rect.h / 2 - 8);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#9a9aa8";
      ctx.fillText(TOWER_INFO[kind].desc, rect.x + 42, rect.y + rect.h / 2 + 9);
      ctx.globalAlpha = 1;
    }

    // ---- 覆盖层 ----
    if (phase === "intro") {
      const def = LEVELS[levelIdx];
      overlayPanel(
        `第 ${levelIdx + 1} 关 · ${def.name}`,
        levelIdx === 0
          ? "选一张塔卡,点绿草地放塔,守住小花朵!"
          : levelIdx === LEVELS.length - 1
            ? "大软软 BOSS 要来啦!多放塔、记得升级!"
            : `${def.waves.length} 波怪要来,点塔可以升级或卖掉`,
        "#e05a7a",
      );
    } else if (phase === "clear") {
      overlayPanel(`第 ${levelIdx + 1} 关完成!`, `得分 ${score} · 下一关小路会变哦`, "#4a9a5a");
    } else if (phase === "retry") {
      overlayPanel("哎呀,花朵蔫了……", "没关系!点一下重新挑战这一关", "#b28ae8");
    } else if (phase === "prewave" && !over) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(0, h / 2 - 30, w, 60);
      ctx.fillStyle = "#e05a7a";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`第 ${waveIdx + 1} 波软软怪要来啦!`, w / 2, h / 2);
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
  loadLevel(0);
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
