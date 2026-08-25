// 泡泡瞄准手 —— 泡泡龙玩法 + 关卡战役：
// 选关地图、进度存档、石泡/彩虹泡/黑洞/云挡板/下落新行五种机关。
// 瞄准虚线和真实飞行用同一个 simulateShot，保证指哪打哪。
import {
  type Grid,
  type Obstacles,
  type ShotResult,
  DEADLINE_ROW,
  H,
  HOLE_R,
  R,
  RAINBOW,
  ROW_H,
  STONE,
  STONE_CRACKED,
  TOP,
  W,
  cellCenter,
  colorsInGrid,
  countBubbles,
  crossedDeadline,
  damageStone,
  descend,
  isStone,
  nearDeadline,
  parseLayout,
  releaseLoneRainbows,
  rowLength,
  settleShot,
  simulateShot,
  starsForShotsLeft,
} from "./logic";
import { LEVELS, MECH_INFO, THEMES, THEME_SIZES, levelMechanisms, themeOfLevel, themeStart } from "./levels";

export const meta = {
  id: "bubble-aim",
  title: "泡泡瞄准手",
  emoji: "🫧",
  category: "casual" as const,
  color: "#D9EFFF",
  blurb: "99 关 6 大主题世界：石泡、彩虹、黑洞、云挡板、泡泡雨，拖一拖瞄准线全爆掉！",
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
const SAVE_KEY = "yiduo.bubble-aim.campaign.v2";

const COLOR_FILL: Record<string, [string, string]> = {
  R: ["#FFA7BD", "#F26D93"],
  Y: ["#FFE38A", "#F0BE3E"],
  B: ["#A6D9FA", "#5BA7E0"],
  G: ["#BCE8A5", "#7CBE5F"],
  P: ["#DCC2FA", "#A87FDE"],
  [STONE]: ["#C9CBD4", "#8B8FA0"],
  [STONE_CRACKED]: ["#C9CBD4", "#7C8093"],
  [RAINBOW]: ["#FFFFFF", "#C9A7F5"],
};

interface Progress {
  /** 每关最佳星数 0-3（0=未通过） */
  stars: number[];
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { stars?: unknown };
      if (Array.isArray(data.stars)) {
        const arr = data.stars as unknown[];
        return {
          stars: LEVELS.map((_, i) => {
            const v = arr[i];
            return typeof v === "number" && v >= 0 && v <= 3 ? Math.floor(v) : 0;
          }),
        };
      }
    }
  } catch {
    // 读不到就当新档
  }
  return { stars: LEVELS.map(() => 0) };
}

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    // 存不了也不影响本次游玩
  }
}

interface PopAnim {
  x: number;
  y: number;
  color: string;
  t: number;
}

interface FallAnim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  t: number;
}

interface CrackFx {
  x: number;
  y: number;
  t: number;
}

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let animTime = 0;

  const progress = loadProgress();
  let allDoneReported = false;

  let screen: "map" | "play" = "map";
  let levelIndex = 0;
  let phase: "play" | "won" | "failed" = "play";
  let phaseTime = 0;
  let bannerTime = 0;
  let failReason = "";
  let wonStars: 1 | 2 | 3 = 1;

  let grid: Grid = parseLayout(LEVELS[0].layout);
  let obstacles: Obstacles = {};
  let dropQueue: string[] = [];
  let dropEvery = 0;
  let shotsTotal = LEVELS[0].shots;
  let shotsLeft = shotsTotal;
  let shotsFired = 0;
  let currentColor = "R";
  let nextColor = "B";

  let aiming = false;
  let aimDx = 0;
  let aimDy = -1;
  let flight: {
    result: ShotResult;
    seg: number;
    segPos: number;
    color: string;
  } | null = null;

  const pops: PopAnim[] = [];
  const falls: FallAnim[] = [];
  const cracks: CrackFx[] = [];

  const wrap = document.createElement("div");
  wrap.className = "ba-wrap";
  wrap.innerHTML = `
    <style>
      .ba-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E8F4FF, #FFEFF7); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; }
      .ba-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; }
      .ba-badge { background: #fff; border-radius: 14px; padding: 6px 8px; font-weight: 700; color: #3E7CB8; box-shadow: 0 2px 6px rgba(90,140,200,.2); font-size: 12px; white-space: nowrap; }
      .ba-btn { border: none; border-radius: 14px; padding: 6px 10px; font-size: 12px; font-weight: 700; background: #CDE6FF; color: #2A6099; cursor: pointer; box-shadow: 0 3px 0 #A9CCEE; }
      .ba-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #A9CCEE; }
      .ba-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .ba-msg { text-align: center; min-height: 20px; color: #4E8AC2; font-weight: 700; margin-top: 8px; font-size: 13px; }
      .ba-map { background: rgba(255,255,255,0.7); border-radius: 16px; padding: 12px; max-height: 520px; overflow-y: auto; }
      .ba-map-title { text-align: center; font-weight: 800; color: #2A6099; font-size: 17px; margin-bottom: 4px; }
      .ba-map-sub { text-align: center; color: #5E86B0; font-size: 12px; margin-bottom: 10px; }
      .ba-theme { border-radius: 14px; padding: 10px; margin-bottom: 10px; }
      .ba-th-head { font-weight: 800; font-size: 14px; margin-bottom: 2px; }
      .ba-th-blurb { font-size: 11px; opacity: 0.85; margin-bottom: 8px; }
      .ba-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .ba-lv { border: none; border-radius: 14px; padding: 8px 2px 6px; background: #fff; box-shadow: 0 3px 0 #C7DEF2; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .ba-lv:active { transform: translateY(2px); box-shadow: 0 1px 0 #C7DEF2; }
      .ba-lv .num { font-weight: 800; font-size: 15px; color: #2A6099; }
      .ba-lv .stars { font-size: 10px; letter-spacing: -1px; }
      .ba-lv .mech { font-size: 10px; min-height: 13px; }
      .ba-lv.locked { background: #E3EAF2; box-shadow: 0 3px 0 #CBD6E2; cursor: not-allowed; }
      .ba-lv.locked .num { color: #9AA9BC; }
    </style>
    <div class="ba-top">
      <button class="ba-btn ba-back" type="button">🗺️ 地图</button>
      <span class="ba-badge ba-level">第 1 关</span>
      <span class="ba-badge ba-count">🫧 0</span>
      <span class="ba-badge ba-shots">🎯 0</span>
      <button class="ba-btn ba-retry" type="button">🔄</button>
    </div>
    <div class="ba-map">
      <div class="ba-map-title">🫧 泡泡瞄准手 · 99 关主题地图</div>
      <div class="ba-map-sub"></div>
      <div class="ba-themes"></div>
    </div>
    <canvas class="ba-canvas" width="${W}" height="${H}"></canvas>
    <div class="ba-msg"></div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".ba-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const topBar = wrap.querySelector(".ba-top") as HTMLElement;
  const mapEl = wrap.querySelector(".ba-map") as HTMLElement;
  const mapSubEl = wrap.querySelector(".ba-map-sub") as HTMLElement;
  const themesEl = wrap.querySelector(".ba-themes") as HTMLElement;
  const levelEl = wrap.querySelector(".ba-level") as HTMLElement;
  const countEl = wrap.querySelector(".ba-count") as HTMLElement;
  const shotsEl = wrap.querySelector(".ba-shots") as HTMLElement;
  const msgEl = wrap.querySelector(".ba-msg") as HTMLElement;
  const retryBtn = wrap.querySelector(".ba-retry") as HTMLButtonElement;
  const backBtn = wrap.querySelector(".ba-back") as HTMLButtonElement;

  function unlocked(i: number): boolean {
    return i === 0 || progress.stars[i - 1] > 0;
  }

  function allCleared(): boolean {
    return progress.stars.every((s) => s > 0);
  }

  function totalStars(): number {
    return progress.stars.reduce((a, b) => a + b, 0);
  }

  // ---------- 地图 ----------

  function showMap(): void {
    screen = "map";
    flight = null;
    aiming = false;
    topBar.style.display = "none";
    canvas.style.display = "none";
    mapEl.style.display = "";
    mapSubEl.textContent = `⭐ ${totalStars()}/${LEVELS.length * 3} · 通关 ${progress.stars.filter((s) => s > 0).length}/${LEVELS.length}`;
    themesEl.innerHTML = "";
    THEMES.forEach((th, t) => {
      const start = themeStart(t);
      const size = THEME_SIZES[t];
      const cleared = progress.stars.slice(start, start + size).filter((s) => s > 0).length;
      const box = document.createElement("div");
      box.className = "ba-theme";
      box.style.background = th.tint;
      const head = document.createElement("div");
      head.className = "ba-th-head";
      head.style.color = th.ink;
      head.textContent = `${th.icon} ${th.name} · ${cleared}/${size}`;
      const blurb = document.createElement("div");
      blurb.className = "ba-th-blurb";
      blurb.style.color = th.ink;
      blurb.textContent = th.blurb;
      const grid = document.createElement("div");
      grid.className = "ba-grid";
      for (let k = 0; k < size; k++) {
        const i = start + k;
        const def = LEVELS[i];
        const btn = document.createElement("button");
        btn.type = "button";
        const open = unlocked(i);
        btn.className = open ? "ba-lv" : "ba-lv locked";
        const s = progress.stars[i];
        const icons = levelMechanisms(def).map((m) => MECH_INFO[m].icon).join("");
        btn.innerHTML = `
          <span class="num">${open ? i + 1 : "🔒"}</span>
          <span class="stars">${s > 0 ? "⭐".repeat(s) + "☆".repeat(3 - s) : open ? "☆☆☆" : ""}</span>
          <span class="mech">${icons}</span>
        `;
        btn.title = def.name;
        if (open) {
          btn.addEventListener("click", () => {
            api.play("tap");
            startLevel(i);
          });
        }
        grid.appendChild(btn);
      }
      box.append(head, blurb, grid);
      themesEl.appendChild(box);
    });
    msgEl.textContent = allCleared()
      ? "全部通关！还可以回去刷三星哦！"
      : "点亮的关卡都能玩，一路打到风暴嘉年华！";
  }

  // ---------- 关卡 ----------

  function updateHud(): void {
    const def = LEVELS[levelIndex];
    levelEl.textContent = `${levelIndex + 1}. ${def.name}`;
    countEl.textContent = `🫧 ${countBubbles(grid)}`;
    let shotsText = `🎯 ${shotsLeft}`;
    if (dropQueue.length > 0 && dropEvery > 0) {
      const untilDrop = dropEvery - (shotsFired % dropEvery);
      shotsText += ` ⬇️${untilDrop}`;
    }
    shotsEl.textContent = shotsText;
  }

  function randomColor(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)] ?? "R";
  }

  function refreshQueue(): void {
    const pool = colorsInGrid(grid);
    if (pool.length === 0) return;
    if (!pool.includes(currentColor)) currentColor = randomColor(pool);
    if (!pool.includes(nextColor)) nextColor = randomColor(pool);
  }

  function startLevel(index: number): void {
    screen = "play";
    topBar.style.display = "";
    canvas.style.display = "";
    mapEl.style.display = "none";
    levelIndex = index;
    const def = LEVELS[index];
    grid = parseLayout(def.layout);
    obstacles = { clouds: def.clouds, holes: def.holes };
    dropQueue = [...(def.dropRows ?? [])];
    dropEvery = def.dropEvery ?? 0;
    shotsTotal = def.shots;
    shotsLeft = def.shots;
    shotsFired = 0;
    phase = "play";
    phaseTime = 0;
    bannerTime = 1.6;
    flight = null;
    aiming = false;
    pops.length = 0;
    falls.length = 0;
    cracks.length = 0;
    const pool = colorsInGrid(grid);
    currentColor = randomColor(pool);
    nextColor = randomColor(pool);
    msgEl.textContent = def.tip;
    updateHud();
  }

  function retryLevel(): void {
    if (screen !== "play") return;
    api.play("tap");
    startLevel(levelIndex);
  }

  function failLevel(reason: string): void {
    if (phase !== "play") return;
    phase = "failed";
    phaseTime = 0;
    failReason = reason;
    api.play("oops");
    msgEl.textContent = "没关系，点画面再来一次！";
  }

  function winLevel(): void {
    if (phase !== "play") return;
    phase = "won";
    phaseTime = 0;
    wonStars = starsForShotsLeft(shotsLeft, shotsTotal);
    const wasAllCleared = allCleared();
    progress.stars[levelIndex] = Math.max(progress.stars[levelIndex], wonStars);
    saveProgress(progress);
    api.play("win");
    msgEl.textContent = "全部清光，太棒啦！";
    // 剩下的石泡开心地掉下去
    for (let r = 0; r < grid.rows.length; r++) {
      for (let c = 0; c < rowLength(grid, r); c++) {
        const cell = grid.rows[r][c];
        if (cell && isStone(cell)) {
          const cc = cellCenter(grid, r, c);
          falls.push({
            x: cc.x, y: cc.y,
            vx: (Math.random() - 0.5) * 100,
            vy: -50 - Math.random() * 50,
            color: cell, t: 0,
          });
          grid.rows[r][c] = null;
        }
      }
    }
    if (!wasAllCleared && allCleared() && !allDoneReported) {
      allDoneReported = true;
      const sum = totalStars();
      const max = LEVELS.length * 3;
      const rating: 1 | 2 | 3 = sum / max >= 0.8 ? 3 : sum / max >= 0.5 ? 2 : 1;
      api.onWin(rating, `${LEVELS.length} 关泡泡战役全部通过，共 ${sum} 颗星！`);
    }
  }

  function pushPop(r: number, c: number, color: string): void {
    const cc = cellCenter(grid, r, c);
    pops.push({ x: cc.x, y: cc.y, color, t: 0 });
  }

  function pushFall(r: number, c: number, color: string): void {
    const cc = cellCenter(grid, r, c);
    falls.push({
      x: cc.x, y: cc.y,
      vx: (Math.random() - 0.5) * 120,
      vy: -60 - Math.random() * 60,
      color, t: 0,
    });
  }

  function fire(): void {
    if (phase !== "play" || flight || shotsLeft <= 0) return;
    const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, aimDx, aimDy, obstacles);
    shotsLeft--;
    flight = { result, seg: 0, segPos: 0, color: currentColor };
    currentColor = nextColor;
    nextColor = randomColor(colorsInGrid(grid));
    api.play("jump");
    updateHud();
  }

  function landFlight(): void {
    if (!flight) return;
    const { result, color } = flight;
    flight = null;
    if (result.swallowed) {
      // 被黑洞吞掉：这发就没了
      api.play("oops");
      afterShot();
      return;
    }
    if (result.hitCell && isStone(grid.rows[result.hitCell.r]?.[result.hitCell.c] ?? null)) {
      const { r, c } = result.hitCell;
      const cc = cellCenter(grid, r, c);
      const hit = damageStone(grid, r, c);
      if (hit.result === "cracked") {
        api.play("tap");
        cracks.push({ x: cc.x, y: cc.y, t: 0 });
      } else if (hit.result === "broken") {
        api.play("pop");
        pops.push({ x: cc.x, y: cc.y, color: STONE, t: 0 });
        for (const f of hit.dropped) pushFall(f.r, f.c, f.color);
        if (hit.dropped.length > 0) api.play("coin");
      }
      afterShot();
      return;
    }
    if (!result.landing) {
      afterShot();
      return;
    }
    const { r, c } = result.landing;
    grid.rows[r][c] = color;
    const settle = settleShot(grid, r, c);
    if (settle.popped.length > 0) {
      api.play("pop");
      for (const p of settle.popped) pushPop(p.r, p.c, p.color);
      for (const f of settle.dropped) pushFall(f.r, f.c, f.color);
      if (settle.dropped.length > 0) api.play("coin");
    } else {
      api.play("tap");
    }
    afterShot();
  }

  function afterShot(): void {
    shotsFired++;
    // 孤零零的彩虹泡自己飞走
    for (const p of releaseLoneRainbows(grid)) pushPop(p.r, p.c, p.color);
    if (countBubbles(grid) === 0) {
      refreshQueue();
      updateHud();
      winLevel();
      return;
    }
    // 下落新行
    if (dropEvery > 0 && dropQueue.length > 0 && shotsFired % dropEvery === 0) {
      descend(grid, dropQueue.shift()!);
      api.play("jump");
      msgEl.textContent = "⬇️ 新的一排泡泡压下来啦！";
    }
    refreshQueue();
    updateHud();
    if (crossedDeadline(grid)) {
      failLevel("泡泡越过警戒线啦！");
      return;
    }
    if (shotsLeft <= 0) {
      failLevel("子弹用完了！");
    }
  }

  // ---------- 绘制 ----------

  function drawStoneAt(x: number, y: number, cracked: boolean, radius = R, alpha = 1): void {
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.15, x, y, radius);
    grad.addColorStop(0, "#EDEFF4");
    grad.addColorStop(0.4, "#C9CBD4");
    grad.addColorStop(1, "#8B8FA0");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    // 石头斑点
    ctx.fillStyle = "rgba(110,115,132,0.5)";
    ctx.beginPath();
    ctx.arc(x + radius * 0.3, y + radius * 0.2, radius * 0.16, 0, Math.PI * 2);
    ctx.arc(x - radius * 0.25, y + radius * 0.35, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();
    if (cracked) {
      ctx.strokeStyle = "#5A5E70";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - radius * 0.5, y - radius * 0.3);
      ctx.lineTo(x - radius * 0.1, y);
      ctx.lineTo(x - radius * 0.35, y + radius * 0.45);
      ctx.moveTo(x - radius * 0.1, y);
      ctx.lineTo(x + radius * 0.45, y - radius * 0.15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawRainbowAt(x: number, y: number, radius = R, alpha = 1): void {
    ctx.globalAlpha = alpha;
    const spin = animTime * 0.8;
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `hsl(${k * 60 + animTime * 40}, 85%, 72%)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, radius, spin + (k * Math.PI) / 3, spin + ((k + 1) * Math.PI) / 3);
      ctx.closePath();
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.1, x, y, radius);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** 色弱友好:每种颜色配一个专属白色小图案,不靠颜色也能分清 */
  function drawColorMark(x: number, y: number, color: string, radius: number): void {
    const s = radius * 0.34;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = Math.max(1.5, radius * 0.12);
    ctx.beginPath();
    if (color === "R") {
      // 红:实心三角
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y + s * 0.8);
      ctx.lineTo(x - s, y + s * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (color === "Y") {
      // 黄:实心菱形
      ctx.moveTo(x, y - s * 1.15);
      ctx.lineTo(x + s * 1.15, y);
      ctx.lineTo(x, y + s * 1.15);
      ctx.lineTo(x - s * 1.15, y);
      ctx.closePath();
      ctx.fill();
    } else if (color === "B") {
      // 蓝:空心圆环
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.stroke();
    } else if (color === "G") {
      // 绿:实心方块
      ctx.fillRect(x - s * 0.85, y - s * 0.85, s * 1.7, s * 1.7);
    } else if (color === "P") {
      // 紫:十字
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
      ctx.stroke();
    }
  }

  function drawBubbleAt(x: number, y: number, color: string, radius = R, alpha = 1): void {
    if (color === STONE || color === STONE_CRACKED) {
      drawStoneAt(x, y, color === STONE_CRACKED, radius, alpha);
      return;
    }
    if (color === RAINBOW) {
      drawRainbowAt(x, y, radius, alpha);
      return;
    }
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
    drawColorMark(x, y + radius * 0.08, color, radius);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.32, y - radius * 0.4, radius * 0.24, radius * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(): void {
    const th = THEMES[themeOfLevel(levelIndex)];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (th.dark) {
      // 夜空主题:一闪一闪的小星星
      for (let k = 0; k < 26; k++) {
        const sx = (k * 73.7 + 11) % W;
        const sy = (k * 137.3 + 23) % (H - 130);
        ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(animTime * 2 + k * 1.7));
        ctx.fillStyle = "#FFF6D8";
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // 警戒线:泡泡压到上一行时提前闪烁预警
    const dy = TOP + R + DEADLINE_ROW * ROW_H - R - 4;
    const danger = phase === "play" && nearDeadline(grid);
    const blink = danger ? 0.55 + 0.45 * Math.sin(animTime * 9) : 0;
    ctx.strokeStyle = danger
      ? `rgba(255, 70, 100, ${0.55 + blink * 0.45})`
      : th.dark ? "rgba(255, 170, 190, 0.85)" : "rgba(255, 130, 150, 0.55)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = danger ? 3 + blink * 1.5 : 2;
    ctx.beginPath();
    ctx.moveTo(8, dy);
    ctx.lineTo(W - 8, dy);
    ctx.stroke();
    ctx.setLineDash([]);
    if (danger) {
      ctx.fillStyle = `rgba(255, 70, 100, ${0.6 + blink * 0.4})`;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ 快到警戒线啦!", W / 2, dy + 16);
      ctx.textAlign = "left";
    }
  }

  function drawObstacles(): void {
    for (const hole of obstacles.holes ?? []) {
      const grad = ctx.createRadialGradient(hole.x, hole.y, 2, hole.x, hole.y, HOLE_R);
      grad.addColorStop(0, "#1B1433");
      grad.addColorStop(0.6, "#3A2C66");
      grad.addColorStop(1, "rgba(90, 70, 150, 0.15)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, HOLE_R, 0, Math.PI * 2);
      ctx.fill();
      // 旋转的吸入弧线
      ctx.strokeStyle = "rgba(190, 170, 255, 0.8)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const a = animTime * 2.4 + k * Math.PI;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, HOLE_R * 0.62, a, a + 1.6);
        ctx.stroke();
      }
    }
    for (const cl of obstacles.clouds ?? []) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.beginPath();
      ctx.roundRect(cl.x, cl.y, cl.w, cl.h, cl.h / 2);
      ctx.fill();
      // 云朵鼓包
      const bumps = 3;
      for (let k = 0; k < bumps; k++) {
        const bx = cl.x + (cl.w * (k + 0.5)) / bumps;
        ctx.beginPath();
        ctx.arc(bx, cl.y + 2, cl.h * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(150, 180, 215, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cl.x, cl.y, cl.w, cl.h, cl.h / 2);
      ctx.stroke();
    }
  }

  function drawGrid(): void {
    for (let r = 0; r < grid.rows.length; r++) {
      for (let c = 0; c < rowLength(grid, r); c++) {
        const color = grid.rows[r][c];
        if (!color) continue;
        const cc = cellCenter(grid, r, c);
        drawBubbleAt(cc.x, cc.y, color);
      }
    }
  }

  function drawAim(): void {
    if (!aiming || phase !== "play" || flight) return;
    // 和 fire() 完全一样的调用 → 预览即实弹
    const result = simulateShot(grid, SHOOTER_X, SHOOTER_Y, aimDx, aimDy, obstacles);
    ctx.strokeStyle = result.swallowed ? "rgba(120, 90, 200, 0.75)" : "rgba(90, 150, 220, 0.75)";
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
      const cc = cellCenter(grid, result.landing.r, result.landing.c);
      ctx.strokeStyle = "rgba(90, 150, 220, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(cc.x, cc.y, R - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (result.hitCell) {
      // 会砸到石泡：画个小炸花
      const cc = cellCenter(grid, result.hitCell.r, result.hitCell.c);
      ctx.strokeStyle = "rgba(240, 160, 90, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        ctx.moveTo(cc.x + Math.cos(a) * (R - 6), cc.y + Math.sin(a) * (R - 6));
        ctx.lineTo(cc.x + Math.cos(a) * (R + 4), cc.y + Math.sin(a) * (R + 4));
      }
      ctx.stroke();
    }
  }

  function drawShooter(): void {
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
    ctx.fillStyle = THEMES[themeOfLevel(levelIndex)].dark ? "rgba(255,255,255,0.85)" : "#5E86B0";
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
    const path = flight.result.path;
    const seg = path[flight.seg];
    const next = path[flight.seg + 1];
    if (!next) return;
    const segLen = Math.hypot(next.x - seg.x, next.y - seg.y) || 1;
    const t = flight.segPos / segLen;
    const x = seg.x + (next.x - seg.x) * t;
    const y = seg.y + (next.y - seg.y) * t;
    // 被黑洞吞时越飞越小
    let radius = R;
    if (flight.result.swallowed && flight.seg >= path.length - 2) {
      radius = R * Math.max(0.15, 1 - t);
    }
    drawBubbleAt(x, y, flight.color, radius);
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
    for (let i = cracks.length - 1; i >= 0; i--) {
      const cfx = cracks[i];
      cfx.t += dt;
      if (cfx.t > 0.4) {
        cracks.splice(i, 1);
        continue;
      }
      const k = cfx.t / 0.4;
      ctx.strokeStyle = `rgba(255, 200, 90, ${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cfx.x, cfx.y, R + k * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawOverlays(): void {
    if (bannerTime > 0 && phase === "play") {
      const a = Math.min(1, bannerTime / 0.4);
      const def = LEVELS[levelIndex];
      const th = THEMES[themeOfLevel(levelIndex)];
      const mechs = levelMechanisms(def);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * a})`;
      ctx.beginPath();
      ctx.roundRect(30, 168, 300, mechs.length > 0 ? 120 : 100, 18);
      ctx.fill();
      ctx.fillStyle = `rgba(62, 124, 184, ${a})`;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${th.icon} ${th.name}`, W / 2, 192);
      ctx.font = "bold 21px sans-serif";
      ctx.fillText(`第 ${levelIndex + 1} 关 · ${def.name}`, W / 2, 220);
      ctx.font = "12px sans-serif";
      ctx.fillText(def.tip, W / 2, 248);
      if (mechs.length > 0) {
        ctx.fillText(
          "机关：" + mechs.map((m) => MECH_INFO[m].icon + MECH_INFO[m].name).join(" "),
          W / 2, 272
        );
      }
      ctx.textAlign = "left";
    }
    if (phase === "won") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.roundRect(60, 170, 240, 120, 20);
      ctx.fill();
      ctx.fillStyle = "#3E7CB8";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("清空啦！", W / 2, 210);
      ctx.font = "26px sans-serif";
      ctx.fillText("⭐".repeat(wonStars) + "☆".repeat(3 - wonStars), W / 2, 248);
      ctx.font = "13px sans-serif";
      ctx.fillText(
        levelIndex + 1 < LEVELS.length ? "马上进入下一关…" : "最后一关通关！",
        W / 2, 276
      );
      ctx.textAlign = "left";
    }
    if (phase === "failed") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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
    drawObstacles();
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

    if (screen === "play") {
      // 飞行推进
      if (flight) {
        let travel = FLY_SPEED * dt;
        while (travel > 0 && flight) {
          const path = flight.result.path;
          const seg = path[flight.seg];
          const next = path[flight.seg + 1];
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
            if (flight.seg >= path.length - 1) {
              landFlight();
              break;
            }
          } else {
            flight.segPos += travel;
            travel = 0;
          }
        }
      }

      if (phase === "won" && phaseTime > 1.8) {
        if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
        else showMap();
      }

      draw(dt);
    }
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

  let pressing = false;
  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (screen !== "play") return;
    if (phase === "failed") {
      retryLevel();
      return;
    }
    if (phase !== "play" || flight) return;
    pressing = true;
    aiming = setAim(toCanvas(e));
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!pressing || phase !== "play" || flight) return;
    // 按住期间持续更新：从发射台往上拖也能获得有效瞄准
    aiming = setAim(toCanvas(e)) || aiming;
  };
  const onPointerUp = (): void => {
    if (pressing && aiming && phase === "play" && !flight) fire();
    pressing = false;
    aiming = false;
  };
  const onPointerCancel = (): void => {
    // 系统手势打断:收起瞄准线但不发射,子弹不浪费
    pressing = false;
    aiming = false;
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  retryBtn.addEventListener("click", retryLevel);
  backBtn.addEventListener("click", () => {
    api.play("tap");
    showMap();
  });

  showMap();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      wrap.remove();
    },
  };
}
