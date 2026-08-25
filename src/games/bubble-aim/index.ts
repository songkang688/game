// 泡泡瞄准 —— 经典泡泡龙玩法：虚线瞄准、碰墙反弹、三个同色连消、悬空掉落。
import {
  type Color,
  type Grid,
  COLS,
  DEADLINE_ROW,
  H,
  R,
  ROW_H,
  TOP,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  crossedDeadline,
  parseLayout,
  rowLength,
  settleShot,
  simulateShot,
  starsForShotsLeft,
} from "./logic";
import { LEVELS } from "./levels";

export const meta = {
  id: "bubble-aim",
  title: "泡泡瞄准手",
  emoji: "🫧",
  category: "casual" as const,
  color: "#D9EFFF",
  blurb: "拖一拖瞄准线，同色泡泡碰三个，啵啵啵全爆掉！",
};

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const SHOOTER_X = W / 2;
const SHOOTER_Y = 444;
const FLY_SPEED = 820;

const COLOR_FILL: Record<Color, [string, string]> = {
  R: ["#FFA7BD", "#F26D93"],
  Y: ["#FFE38A", "#F0BE3E"],
  B: ["#A6D9FA", "#5BA7E0"],
  G: ["#BCE8A5", "#7CBE5F"],
  P: ["#DCC2FA", "#A87FDE"],
};

interface PopAnim {
  x: number;
  y: number;
  color: Color;
  t: number;
}

interface FallAnim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: Color;
  t: number;
}

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let animTime = 0;

  let levelIndex = 0;
  let phase: "play" | "won" | "failed" | "alldone" = "play";
  let phaseTime = 0;
  let bannerTime = 0;
  let failReason = "";

  let grid: Grid = parseLayout(LEVELS[0].layout);
  let shotsTotal = LEVELS[0].shots;
  let shotsLeft = shotsTotal;
  let currentColor: Color = "R";
  let nextColor: Color = "B";
  const earnedStars: number[] = [];

  let aiming = false;
  let aimDx = 0;
  let aimDy = -1;
  let flight: {
    path: Array<{ x: number; y: number }>;
    seg: number;
    segPos: number;
    landing: { r: number; c: number } | null;
    color: Color;
  } | null = null;

  const pops: PopAnim[] = [];
  const falls: FallAnim[] = [];

  const wrap = document.createElement("div");
  wrap.className = "ba-wrap";
  wrap.innerHTML = `
    <style>
      .ba-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E8F4FF, #FFEFF7); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; }
      .ba-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
      .ba-badge { background: #fff; border-radius: 14px; padding: 6px 10px; font-weight: 700; color: #3E7CB8; box-shadow: 0 2px 6px rgba(90,140,200,.2); font-size: 13px; white-space: nowrap; }
      .ba-retry { border: none; border-radius: 14px; padding: 6px 12px; font-size: 13px; font-weight: 700; background: #CDE6FF; color: #2A6099; cursor: pointer; box-shadow: 0 3px 0 #A9CCEE; }
      .ba-retry:active { transform: translateY(2px); box-shadow: 0 1px 0 #A9CCEE; }
      .ba-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .ba-msg { text-align: center; min-height: 20px; color: #4E8AC2; font-weight: 700; margin-top: 8px; font-size: 14px; }
    </style>
    <div class="ba-top">
      <span class="ba-badge ba-level">第 1 关</span>
      <span class="ba-badge ba-count">🫧 0</span>
      <span class="ba-badge ba-shots">🎯 0</span>
      <button class="ba-retry" type="button">🔄 重试</button>
    </div>
    <canvas class="ba-canvas" width="${W}" height="${H}"></canvas>
    <div class="ba-msg"></div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".ba-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const levelEl = wrap.querySelector(".ba-level") as HTMLElement;
  const countEl = wrap.querySelector(".ba-count") as HTMLElement;
  const shotsEl = wrap.querySelector(".ba-shots") as HTMLElement;
  const msgEl = wrap.querySelector(".ba-msg") as HTMLElement;
  const retryBtn = wrap.querySelector(".ba-retry") as HTMLButtonElement;

  function updateHud(): void {
    levelEl.textContent = `第 ${levelIndex + 1}/${LEVELS.length} 关`;
    countEl.textContent = `🫧 剩 ${countBubbles(grid)}`;
    shotsEl.textContent = `🎯 子弹 ${shotsLeft}`;
  }

  function randomColor(pool: Color[]): Color {
    return pool[Math.floor(Math.random() * pool.length)] ?? "R";
  }

  function refreshQueue(): void {
    const pool = colorsInGrid(grid);
    if (pool.length === 0) return;
    if (!pool.includes(currentColor)) currentColor = randomColor(pool);
    if (!pool.includes(nextColor)) nextColor = randomColor(pool);
  }

  function loadLevel(index: number): void {
    levelIndex = index;
    const def = LEVELS[index];
    grid = parseLayout(def.layout);
    shotsTotal = def.shots;
    shotsLeft = def.shots;
    phase = "play";
    phaseTime = 0;
    bannerTime = 1.4;
    flight = null;
    aiming = false;
    pops.length = 0;
    falls.length = 0;
    const pool = colorsInGrid(grid);
    currentColor = randomColor(pool);
    nextColor = randomColor(pool);
    msgEl.textContent = def.tip;
    updateHud();
  }

  function retryLevel(): void {
    if (phase === "alldone") return;
    api.play("tap");
    loadLevel(levelIndex);
  }

  function failLevel(reason: string): void {
    if (phase !== "play") return;
    phase = "failed";
    phaseTime = 0;
    failReason = reason;
    api.play("oops");
    msgEl.textContent = "没关系，点重试再来一次！";
  }

  function winLevel(): void {
    if (phase !== "play") return;
    phase = "won";
    phaseTime = 0;
    earnedStars.push(starsForShotsLeft(shotsLeft, shotsTotal));
    api.play("win");
    msgEl.textContent = "全部清光，太棒啦！";
  }

  function finishAll(): void {
    phase = "alldone";
    const sum = earnedStars.reduce((a, b) => a + b, 0);
    const max = LEVELS.length * 3;
    const rating: 1 | 2 | 3 = sum / max >= 0.8 ? 3 : sum / max >= 0.5 ? 2 : 1;
    api.onWin(rating, `${LEVELS.length} 关全部通过，共拿到 ${sum} 颗关卡星！`);
  }

  function fire(): void {
    if (phase !== "play" || flight || shotsLeft <= 0) return;
    const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, aimDx, aimDy);
    shotsLeft--;
    flight = { path: result.path, seg: 0, segPos: 0, landing: result.landing, color: currentColor };
    currentColor = nextColor;
    const pool = colorsInGrid(grid);
    nextColor = randomColor(pool);
    api.play("jump");
    updateHud();
  }

  function landFlight(): void {
    if (!flight) return;
    const { landing, color } = flight;
    flight = null;
    if (!landing) {
      checkAfterShot();
      return;
    }
    grid[landing.r][landing.c] = color;
    const result = settleShot(grid, landing.r, landing.c);
    if (result.popped.length > 0) {
      api.play("pop");
      for (const p of result.popped) {
        const cc = cellCenter(p.r, p.c);
        pops.push({ x: cc.x, y: cc.y, color: p.color, t: 0 });
      }
      for (const f of result.dropped) {
        const cc = cellCenter(f.r, f.c);
        falls.push({
          x: cc.x,
          y: cc.y,
          vx: (Math.random() - 0.5) * 120,
          vy: -60 - Math.random() * 60,
          color: f.color,
          t: 0,
        });
      }
      if (result.dropped.length > 0) api.play("coin");
    } else {
      api.play("tap");
    }
    refreshQueue();
    updateHud();
    checkAfterShot();
  }

  function checkAfterShot(): void {
    if (countBubbles(grid) === 0) {
      winLevel();
      return;
    }
    if (crossedDeadline(grid)) {
      failLevel("泡泡越过警戒线啦！");
      return;
    }
    if (shotsLeft <= 0) {
      failLevel("子弹用完了！");
    }
  }

  // ---------- 绘制 ----------

  function drawBubbleAt(x: number, y: number, color: Color, radius = R, alpha = 1): void {
    const [light, dark] = COLOR_FILL[color] ?? COLOR_FILL.R;
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius);
    grad.addColorStop(0, "#FFFFFF");
    grad.addColorStop(0.35, light);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.32, y - radius * 0.4, radius * 0.24, radius * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#EDF7FF");
    g.addColorStop(1, "#FFF2F8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 警戒线
    const dy = TOP + R + DEADLINE_ROW * ROW_H - R - 4;
    ctx.strokeStyle = "rgba(255, 130, 150, 0.55)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, dy);
    ctx.lineTo(W - 8, dy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGrid(): void {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < rowLength(r); c++) {
        const color = grid[r][c];
        if (!color) continue;
        const cc = cellCenter(r, c);
        drawBubbleAt(cc.x, cc.y, color);
      }
    }
  }

  function drawAim(): void {
    if (!aiming || phase !== "play" || flight) return;
    const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, aimDx, aimDy);
    ctx.strokeStyle = "rgba(90, 150, 220, 0.75)";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 9]);
    ctx.lineDashOffset = -animTime * 40;
    ctx.beginPath();
    result.path.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    if (result.landing) {
      const cc = cellCenter(result.landing.r, result.landing.c);
      ctx.strokeStyle = "rgba(90, 150, 220, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(cc.x, cc.y, R - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawShooter(): void {
    // 发射台
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, R + 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#BFD9F2";
    ctx.lineWidth = 3;
    ctx.stroke();
    if (phase === "play" && shotsLeft > 0) {
      drawBubbleAt(SHOOTER_X, SHOOTER_Y, currentColor);
    }
    // 下一个
    ctx.fillStyle = "#5E86B0";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("下一个", W - 46, SHOOTER_Y - 24);
    ctx.textAlign = "left";
    if (phase === "play" && shotsLeft > 1) {
      drawBubbleAt(W - 46, SHOOTER_Y + 2, nextColor, R * 0.7);
    }
  }

  function drawFlight(): void {
    if (!flight) return;
    const seg = flight.path[flight.seg];
    const next = flight.path[flight.seg + 1];
    if (!next) return;
    const segLen = Math.hypot(next.x - seg.x, next.y - seg.y) || 1;
    const t = flight.segPos / segLen;
    const x = seg.x + (next.x - seg.x) * t;
    const y = seg.y + (next.y - seg.y) * t;
    drawBubbleAt(x, y, flight.color);
  }

  function drawAnims(dt: number): void {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += dt;
      if (p.t > 0.32) {
        pops.splice(i, 1);
        continue;
      }
      const k = p.t / 0.32;
      drawBubbleAt(p.x, p.y, p.color, R * (1 + k * 0.5), 1 - k);
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1 + k), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i];
      f.t += dt;
      f.vy += 900 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y > H + R) {
        falls.splice(i, 1);
        continue;
      }
      drawBubbleAt(f.x, f.y, f.color, R, Math.max(0.3, 1 - f.t * 0.6));
    }
  }

  function drawOverlays(): void {
    if (bannerTime > 0 && phase === "play") {
      const a = Math.min(1, bannerTime / 0.4);
      const def = LEVELS[levelIndex];
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * a})`;
      ctx.beginPath();
      ctx.roundRect(40, 190, 280, 84, 18);
      ctx.fill();
      ctx.fillStyle = `rgba(62, 124, 184, ${a})`;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`第 ${levelIndex + 1} 关 · ${def.name}`, W / 2, 226);
      ctx.font = "13px sans-serif";
      ctx.fillText(def.tip, W / 2, 254);
      ctx.textAlign = "left";
    }
    if (phase === "won") {
      const got = earnedStars[earnedStars.length - 1] ?? 1;
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.beginPath();
      ctx.roundRect(60, 170, 240, 120, 20);
      ctx.fill();
      ctx.fillStyle = "#3E7CB8";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("清空啦！", W / 2, 210);
      ctx.font = "26px sans-serif";
      ctx.fillText("⭐".repeat(got) + "☆".repeat(3 - got), W / 2, 248);
      ctx.font = "13px sans-serif";
      ctx.fillText(
        levelIndex + 1 < LEVELS.length ? "马上进入下一关…" : "全部通关！",
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
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(failReason, W / 2, 220);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#5E86B0";
      ctx.fillText("点击画面重试本关", W / 2, 252);
      ctx.textAlign = "left";
    }
  }

  function draw(dt: number): void {
    drawBackground();
    drawGrid();
    drawAim();
    drawFlight();
    drawShooter();
    drawAnims(dt);
    drawOverlays();
  }

  // ---------- 主循环 ----------

  function tick(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    animTime += dt;
    phaseTime += dt;
    if (bannerTime > 0) bannerTime -= dt;

    // 飞行推进
    if (flight) {
      let travel = FLY_SPEED * dt;
      while (travel > 0 && flight) {
        const seg = flight.path[flight.seg];
        const next = flight.path[flight.seg + 1];
        if (!next) {
          landFlight();
          break;
        }
        const segLen = Math.hypot(next.x - seg.x, next.y - seg.y);
        const remain = segLen - flight.segPos;
        if (travel >= remain) {
          travel -= remain;
          flight.seg++;
          flight.segPos = 0;
          if (flight.seg >= flight.path.length - 1) {
            landFlight();
            break;
          }
        } else {
          flight.segPos += travel;
          travel = 0;
        }
      }
    }

    if (phase === "won" && phaseTime > 1.7) {
      if (levelIndex + 1 < LEVELS.length) loadLevel(levelIndex + 1);
      else finishAll();
    }

    draw(dt);
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------

  function toCanvas(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function setAim(p: { x: number; y: number }): boolean {
    const dx = p.x - SHOOTER_X;
    const dy = p.y - SHOOTER_Y;
    if (dy > -24) return false; // 只能向上瞄准
    const len = Math.hypot(dx, dy);
    aimDx = dx / len;
    aimDy = dy / len;
    return true;
  }

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (phase === "failed") {
      retryLevel();
      return;
    }
    if (phase !== "play" || flight) return;
    aiming = setAim(toCanvas(e));
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (phase !== "play" || flight) return;
    if (!aiming) return;
    setAim(toCanvas(e));
  };
  const onPointerUp = (): void => {
    if (aiming && phase === "play" && !flight) fire();
    aiming = false;
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  retryBtn.addEventListener("click", retryLevel);

  loadLevel(0);
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", onPointerUp);
      wrap.remove();
    },
  };
}
