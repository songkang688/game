// 彩虹跑跑:跑过草地、天空、糖果三大主题五个赛段!捡金币在补给站买护盾磁铁,冲向彩虹终点!
import {
  MAGNET_SECONDS,
  MAX_HEARTS,
  ObstacleKind,
  PATTERNS,
  PatternRow,
  PlayerAction,
  SECTIONS,
  SHOP_ITEMS,
  THEME_STYLE,
  TOTAL_LEN,
  canBuy,
  clampLane,
  detectSwipe,
  sectionAt,
  sectionStart,
  starsForRun,
  wouldHit,
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
  id: "rainbow-run",
  title: "彩虹跑跑",
  emoji: "🌈",
  category: "action" as const,
  color: "#e5d4ff",
  blurb: "跑过草地天空糖果谷!金币买护盾磁铁,冲向彩虹终点!",
};

type Phase = "intro" | "run" | "shop" | "retry" | "done";

interface Obstacle {
  lane: number;
  kind: ObstacleKind;
  y: number;
}

interface Pickup {
  kind: "star" | "coin";
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

  // ---- 局状态 ----
  let phase: Phase = "intro";
  let lane = 1;
  let laneFloat = 1;
  let action: PlayerAction = "run";
  let actionTimer = 0;
  let hearts = MAX_HEARTS;
  let heartsLostTotal = 0;
  let retries = 0;
  let invincible = 0;
  let time = 0;
  let dist = 0;
  let sectionIdx = 0;
  let shopForSection = -1;
  let score = 0;
  let coins = 0;
  let starsEaten = 0;
  let speed = SECTIONS[0].speed;
  let over = false;
  let scrollPhase = 0;
  let shake = 0;
  let shieldOn = false;
  let magnetTimer = 0;
  let sectionFlash = 0;

  const obstacles: Obstacle[] = [];
  const pickups: Pickup[] = [];
  const puffs: Puff[] = [];
  const floats: Floaty[] = [];

  let pendingRows: PatternRow[] = [];
  let rowDist = 0;

  const shopRects: Array<{ id: "shield" | "magnet" | "go"; rect: Rect }> = [];

  // ---- 手势 ----
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swiping = false;
  let swipeDone = false;

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.8, big });
  }

  function doAction(dir: "left" | "right" | "up" | "down"): void {
    if (over || phase !== "run") return;
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
        api.play("jump");
      }
    } else if (action !== "slide") {
      action = "slide";
      actionTimer = SLIDE_TIME;
      api.play("tap");
    }
  }

  function resetToSectionStart(): void {
    dist = sectionStart(sectionIdx);
    obstacles.length = 0;
    pickups.length = 0;
    pendingRows = [];
    rowDist = 0;
    hearts = MAX_HEARTS;
    invincible = 2;
    lane = 1;
    laneFloat = 1;
    action = "run";
    magnetTimer = 0;
  }

  function finishWin(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("win");
    api.onWin(
      starsForRun(retries, heartsLostTotal),
      `跑完整条彩虹路!吃到 ${starsEaten} 颗星星,得分 ${score}`,
    );
  }

  function failFinal(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("oops");
    api.onLose("彩虹大道好快呀,再冲一次终点!");
  }

  function onHit(): void {
    if (invincible > 0) return;
    if (shieldOn) {
      shieldOn = false;
      invincible = 1.5;
      api.play("pop");
      addFloat(laneX(lane), playerY() - 60, "护盾帮你挡住啦!", "#5a8ac9", true);
      return;
    }
    hearts--;
    heartsLostTotal++;
    invincible = 1.5;
    shake = 0.4;
    api.play("oops");
    for (let k = 0; k < 8; k++) {
      puffs.push({
        x: laneX(lane) + (Math.random() - 0.5) * 50,
        y: playerY() + (Math.random() - 0.5) * 50,
        life: 0.5,
        color: "#ffffff",
      });
    }
    if (hearts <= 0) {
      if (sectionIdx >= SECTIONS.length - 1) {
        failFinal();
      } else {
        phase = "retry";
      }
    }
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
      phase = "run";
      invincible = 1.5;
      return;
    }
    if (phase === "retry") {
      api.play("tap");
      retries++;
      resetToSectionStart();
      phase = "run";
      return;
    }
    if (phase === "shop") {
      for (const b of shopRects) {
        if (!inRect(x, y, b.rect)) continue;
        if (b.id === "go") {
          api.play("tap");
          phase = "run";
          invincible = 1.2;
          return;
        }
        const item = SHOP_ITEMS.find((it) => it.id === b.id);
        if (!item) return;
        const already = b.id === "shield" ? shieldOn : magnetTimer > 0;
        if (already || !canBuy(coins, item)) {
          api.play("tap");
          return;
        }
        coins -= item.cost;
        if (b.id === "shield") {
          shieldOn = true;
          addFloat(w / 2, h / 2, "买到泡泡护盾!", "#5a8ac9", true);
        } else {
          magnetTimer = MAGNET_SECONDS;
          addFloat(w / 2, h / 2, "买到星星磁铁!", "#b28ae8", true);
        }
        api.play("coin");
        return;
      }
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
      obstacles.push({ lane: o.lane, kind: o.kind, y: -50 });
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
    sectionFlash = Math.max(0, sectionFlash - dt);
    invincible = Math.max(0, invincible - dt);
    magnetTimer = Math.max(0, magnetTimer - dt);
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

    const sec = SECTIONS[sectionIdx];
    const fracInSection = Math.min(1, (dist - sectionStart(sectionIdx)) / sec.len);
    speed = sec.speed * (1 + fracInSection * 0.12);
    dist += speed * dt;
    scrollPhase += speed * dt;

    // 赛段切换
    const nowSection = sectionAt(dist);
    if (nowSection !== sectionIdx) {
      sectionIdx = nowSection;
      sectionFlash = 2;
      api.play("win");
      addFloat(w / 2, h * 0.3, `进入 ${SECTIONS[sectionIdx].name}!`, "#8a5ac9", true);
      if (shopForSection < sectionIdx) {
        shopForSection = sectionIdx;
        phase = "shop";
        return;
      }
    }
    if (dist >= TOTAL_LEN) {
      finishWin();
      return;
    }

    laneFloat += (lane - laneFloat) * Math.min(1, dt * 10);
    if (actionTimer > 0) {
      actionTimer -= dt;
      if (actionTimer <= 0) action = "run";
    }

    // 按花样刷行
    rowDist += speed * dt;
    if (rowDist >= ROW_GAP) {
      rowDist = 0;
      if (pendingRows.length === 0) {
        const pat = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
        pendingRows = pat.map((r) => ({
          obstacles: r.obstacles.map((o) => ({ ...o })),
          stars: [...r.stars],
          coins: [...r.coins],
        }));
      }
      const row = pendingRows.shift();
      if (row) spawnRow(row);
    }

    const py = playerY();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.y += speed * dt;
      if (o.y > h + 60) {
        obstacles.splice(i, 1);
        score += 1;
        continue;
      }
      if (
        invincible <= 0 &&
        o.lane === lane &&
        Math.abs(o.y - py) < HIT_WINDOW &&
        wouldHit(o.kind, action)
      ) {
        obstacles.splice(i, 1);
        onHit();
        if (over || phase !== "run") return;
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += speed * dt;
      // 磁铁吸附
      if (magnetTimer > 0 && !p.taken) {
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
      if (!p.taken && near && (magnetTimer > 0 || action !== "slide" || p.kind === "coin")) {
        p.taken = true;
        pickups.splice(i, 1);
        if (p.kind === "star") {
          starsEaten++;
          score += 10;
          api.play("coin");
          if (starsEaten <= 15) api.addStars(1);
          addFloat(p.x, p.y - 20, "+10", "#c47a2a");
          puffs.push({ x: p.x, y: p.y, life: 0.5, color: "#ffe387" });
        } else {
          coins++;
          score += 5;
          api.play("pop");
          addFloat(p.x, p.y - 20, "+1🍬", "#e05a7a");
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
    const x = laneX(o.lane);
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
    } else {
      ctx.fillStyle = "#9adcf0";
      ctx.fillRect(x - laneW * 0.36, o.y - 26, 8, 30);
      ctx.fillRect(x + laneW * 0.36 - 8, o.y - 26, 8, 30);
      const bands = ["#ff9eb5", "#ffd868", "#8fd8c8"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = bands[i];
        ctx.fillRect(x - laneW * 0.36, o.y - 26 + i * 6, laneW * 0.72, 6);
      }
    }
  }

  function drawPlayer(): void {
    const pxx = laneX(laneFloat);
    const py = playerY();
    const blink = invincible > 0 && Math.floor(invincible * 8) % 2 === 0;
    if (blink) return;
    const jumping = action === "jump";
    const sliding = action === "slide";
    const lift = jumping ? Math.sin((1 - actionTimer / JUMP_TIME) * Math.PI) * 70 : 0;
    const r = 30;
    ctx.fillStyle = "rgba(90,90,110,0.18)";
    ctx.beginPath();
    ctx.ellipse(pxx, py + r * 0.85, r * (jumping ? 0.55 : 0.85), r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    const bodyY = py - lift;
    const sx = sliding ? 1.25 : 1;
    const sy = sliding ? 0.6 : 1;
    if (shieldOn) {
      ctx.strokeStyle = `rgba(120,180,255,${0.55 + Math.sin(time * 6) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pxx, bodyY, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffb3c8";
    ctx.beginPath();
    ctx.ellipse(pxx, bodyY, r * sx, r * sy, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!jumping && !sliding) {
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

  function drawShop(): void {
    ctx.fillStyle = "rgba(255,248,252,0.88)";
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(460, w - 32);
    const ph = 260;
    const px0 = (w - pw) / 2;
    const py0 = (h - ph) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(px0, py0, pw, ph, 22);
    ctx.fill();
    ctx.strokeStyle = "#b28ae8";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#8a5ac9";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`补给小站 · 🍬 ${coins}`, w / 2, py0 + 30);

    shopRects.length = 0;
    const cw = (pw - 48) / 2;
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
      const item = SHOP_ITEMS[i];
      const rect: Rect = { x: px0 + 16 + i * (cw + 16), y: py0 + 56, w: cw, h: 118 };
      shopRects.push({ id: item.id, rect });
      const owned = item.id === "shield" ? shieldOn : magnetTimer > 0;
      const affordable = canBuy(coins, item);
      ctx.fillStyle = owned ? "#e8f6e8" : affordable ? "#fff7fb" : "#f3f3f6";
      ctx.strokeStyle = owned ? "#7ac97a" : affordable ? "#ff9eb5" : "#d8d8e0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.font = "30px sans-serif";
      ctx.fillText(item.id === "shield" ? "🛡" : "🧲", rect.x + rect.w / 2, rect.y + 30);
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(item.name, rect.x + rect.w / 2, rect.y + 60);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#9a9aa8";
      ctx.fillText(item.desc, rect.x + rect.w / 2, rect.y + 80);
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = owned ? "#4a9a5a" : affordable ? "#e05a7a" : "#b0b0be";
      ctx.fillText(owned ? "已装备!" : `🍬 ${item.cost}`, rect.x + rect.w / 2, rect.y + 101);
    }
    const goRect: Rect = { x: w / 2 - 90, y: py0 + ph - 56, w: 180, h: 42 };
    shopRects.push({ id: "go", rect: goRect });
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.roundRect(goRect.x, goRect.y, goRect.w, goRect.h, 21);
    ctx.fill();
    ctx.fillStyle = "#7a5a1a";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("继续跑!", w / 2, goRect.y + 21);
  }

  function overlayPanel(title: string, sub: string, accent: string): void {
    ctx.fillStyle = "rgba(255,248,252,0.85)";
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
    ctx.font = "bold 24px sans-serif";
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
    const theme = THEME_STYLE[SECTIONS[sectionIdx].theme];
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

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

    // 主题小装饰:两侧滚动的小图案
    const decoOffset = scrollPhase % 160;
    for (let y = -160 + decoOffset; y < h; y += 160) {
      const lx = laneX(0) - laneW / 2 - 26;
      const rx = laneX(2) + laneW / 2 + 26;
      for (const x of [lx, rx]) {
        if (x < 10 || x > w - 10) continue;
        if (SECTIONS[sectionIdx].theme === "grass") {
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
        } else if (SECTIONS[sectionIdx].theme === "sky") {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc(x - 8, y, 10, 0, Math.PI * 2);
          ctx.arc(x + 6, y - 4, 12, 0, Math.PI * 2);
          ctx.arc(x + 16, y + 3, 8, 0, Math.PI * 2);
          ctx.fill();
        } else {
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
        }
      }
    }

    // 终点线(最后一段快到头时出现)
    const toFinish = TOTAL_LEN - dist;
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
      else {
        ctx.fillStyle = "#ffb84d";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.stroke();
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

    // ---- HUD:分段进度条 ----
    const bw = Math.min(320, w - 210);
    const bx = (w - bw) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.roundRect(bx, 12, bw, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#b28ae8";
    ctx.beginPath();
    ctx.roundRect(bx, 12, Math.max(16, (bw * Math.min(dist, TOTAL_LEN)) / TOTAL_LEN), 16, 8);
    ctx.fill();
    // 分段刻度
    ctx.fillStyle = "rgba(90,90,110,0.5)";
    for (let i = 1; i < SECTIONS.length; i++) {
      const mx = bx + (bw * sectionStart(i)) / TOTAL_LEN;
      ctx.fillRect(mx - 1, 12, 2, 16);
    }
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "15px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`⭐${starsEaten} 🍬${coins} 分${score}`, 10, 20);
    ctx.textAlign = "right";
    ctx.fillText("💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, MAX_HEARTS - hearts)), w - 10, 20);
    ctx.textAlign = "center";
    ctx.font = "13px sans-serif";
    ctx.fillStyle = sectionFlash > 0 ? "#8a5ac9" : "#7a7a8e";
    ctx.fillText(
      `第 ${sectionIdx + 1}/${SECTIONS.length} 段 · ${SECTIONS[sectionIdx].name}`,
      w / 2,
      40,
    );
    if (magnetTimer > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#8a5ac9";
      ctx.fillText(`🧲 ${Math.ceil(magnetTimer)}s`, w - 10, 40);
    }

    // ---- 覆盖层 ----
    if (phase === "intro") {
      overlayPanel(
        "彩虹跑跑 · 五段大冒险",
        "左右滑换道 · 上滑跳 · 下滑趴,捡🍬到补给站买道具!",
        "#8a5ac9",
      );
    } else if (phase === "retry") {
      overlayPanel(
        `在${SECTIONS[sectionIdx].name}摔了一跤……`,
        "没关系!点一下从这一段重新出发",
        "#b28ae8",
      );
    } else if (phase === "shop") {
      drawShop();
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
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      canvas.remove();
    },
  };
}
