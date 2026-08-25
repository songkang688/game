// 糖果秋千 —— 割绳子类物理益智：划断绳子，把糖果送进小怪物"啾啾"的嘴巴。
import {
  type Link,
  type Particle,
  boardPosition,
  buildRope,
  circleRectOverlap,
  circlesOverlap,
  collideCircleRect,
  integrate,
  makeParticle,
  segmentsIntersect,
  solveLinks,
  starsForCollected,
} from "./physics";
import { LEVELS, totalStars, type LevelDef } from "./levels";

export const meta = {
  id: "candy-swing",
  title: "糖果秋千",
  emoji: "🍬",
  category: "action" as const,
  color: "#FFE0EE",
  blurb: "划断绳子，让糖果荡进小怪物啾啾的嘴巴里！",
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

const W = 360;
const H = 480;
const CANDY_R = 16;
const GRAVITY = 900;
const STEP = 1 / 120;
const MOUTH_EAT_R = 42;
const STAR_COLLECT_R = 30;
const BUBBLE_CATCH_R = 50;

interface StarState {
  x: number;
  y: number;
  collected: boolean;
  /** 吸入动画进度 0..1 */
  suck: number;
}

interface BubbleState {
  x: number;
  y: number;
  used: boolean;
}

interface HookState {
  x: number;
  y: number;
  radius: number;
  used: boolean;
}

interface BoardState {
  def: NonNullable<LevelDef["boards"]>[number];
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let acc = 0;
  let simTime = 0;

  let levelIndex = 0;
  let phase: "play" | "won" | "failed" | "alldone" = "play";
  let phaseTime = 0;
  let bannerTime = 0;
  let failReason = "";

  let totalCollected = 0;
  /** 本关进入前已拿的总数（重试时回滚用） */
  let collectedBeforeLevel = 0;

  // 物理世界
  let particles: Particle[] = [];
  let links: Link[] = [];
  let stars: StarState[] = [];
  let bubbles: BubbleState[] = [];
  let hooks: HookState[] = [];
  let boards: BoardState[] = [];
  let level: LevelDef = LEVELS[0];
  let inBubble = false;
  let candyEaten = false;
  let candyGone = false;
  let mouthOpenAmount = 0;
  let chew = 0;

  const trail: TrailPoint[] = [];
  const sparkles: Sparkle[] = [];

  const wrap = document.createElement("div");
  wrap.className = "cs-wrap";
  wrap.innerHTML = `
    <style>
      .cs-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F6, #EAF4FF); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; }
      .cs-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
      .cs-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #D65C8B; box-shadow: 0 2px 6px rgba(214,92,139,.2); font-size: 14px; white-space: nowrap; }
      .cs-retry { border: none; border-radius: 14px; padding: 6px 14px; font-size: 14px; font-weight: 700; background: #FFD3E3; color: #B03A6B; cursor: pointer; box-shadow: 0 3px 0 #F2AECB; }
      .cs-retry:active { transform: translateY(2px); box-shadow: 0 1px 0 #F2AECB; }
      .cs-canvas { width: 100%; border-radius: 16px; display: block; touch-action: none; cursor: crosshair; }
      .cs-msg { text-align: center; min-height: 20px; color: #B06AB3; font-weight: 700; margin-top: 8px; font-size: 14px; }
    </style>
    <div class="cs-top">
      <span class="cs-badge cs-level">第 1 关</span>
      <span class="cs-badge cs-stars">⭐ 0/${totalStars()}</span>
      <button class="cs-retry" type="button">🔄 重试</button>
    </div>
    <canvas class="cs-canvas" width="${W}" height="${H}"></canvas>
    <div class="cs-msg"></div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".cs-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const levelEl = wrap.querySelector(".cs-level") as HTMLElement;
  const starsEl = wrap.querySelector(".cs-stars") as HTMLElement;
  const msgEl = wrap.querySelector(".cs-msg") as HTMLElement;
  const retryBtn = wrap.querySelector(".cs-retry") as HTMLButtonElement;

  function candy(): Particle {
    return particles[0];
  }

  function updateHud(): void {
    levelEl.textContent = `第 ${levelIndex + 1}/${LEVELS.length} 关 · ${level.name}`;
    starsEl.textContent = `⭐ ${totalCollected}/${totalStars()}`;
  }

  function addRopeToCandy(ax: number, ay: number, totalLength?: number): void {
    const c = candy();
    const dist = totalLength ?? Math.hypot(c.x - ax, c.y - ay);
    const segments = Math.max(3, Math.min(14, Math.round(dist / 16)));
    const build = buildRope(ax, ay, c.x, c.y, segments, totalLength);
    const base = particles.length;
    for (const p of build.particles) particles.push(p);
    for (const l of build.links) {
      links.push({
        a: base + l.a,
        b: l.b === -1 ? 0 : base + l.b,
        rest: l.rest,
        active: true,
      });
    }
  }

  function loadLevel(index: number): void {
    levelIndex = index;
    level = LEVELS[index];
    collectedBeforeLevel = totalCollected;
    phase = "play";
    phaseTime = 0;
    bannerTime = 1.4;
    simTime = 0;
    inBubble = false;
    candyEaten = false;
    candyGone = false;
    mouthOpenAmount = 0;
    chew = 0;
    trail.length = 0;
    sparkles.length = 0;

    particles = [makeParticle(level.candy.x, level.candy.y, false, 0.3)];
    links = [];
    for (const r of level.ropes) addRopeToCandy(r.x, r.y, r.length);
    stars = level.stars.map((s) => ({ x: s.x, y: s.y, collected: false, suck: 0 }));
    bubbles = (level.bubbles ?? []).map((b) => ({ x: b.x, y: b.y, used: false }));
    hooks = (level.hooks ?? []).map((h) => ({ x: h.x, y: h.y, radius: h.radius, used: false }));
    boards = (level.boards ?? []).map((def) => {
      const pos = boardPosition(def.x1, def.y1, def.x2, def.y2, def.period, 0);
      return { def, x: pos.x, y: pos.y, prevX: pos.x, prevY: pos.y };
    });
    msgEl.textContent = level.tip;
    updateHud();
  }

  function retryLevel(): void {
    if (phase === "alldone") return;
    totalCollected = collectedBeforeLevel;
    api.play("tap");
    loadLevel(levelIndex);
  }

  function burst(x: number, y: number, color: string, count = 8, speed = 120): void {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const v = speed * (0.5 + Math.random() * 0.7);
      sparkles.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, t: 0, color });
    }
  }

  function failLevel(reason: string): void {
    if (phase !== "play") return;
    phase = "failed";
    phaseTime = 0;
    failReason = reason;
    api.play("oops");
    msgEl.textContent = "没关系，点重试再来一次！";
  }

  /** 糖果被吃掉时，把还连在糖果上的绳段一起收走（不然会悬空残留） */
  function removeCandyRopes(): void {
    const visited = new Set<number>([0]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const link of links) {
        if (!link.active) continue;
        if (visited.has(link.a) !== visited.has(link.b)) {
          visited.add(link.a);
          visited.add(link.b);
          changed = true;
        }
      }
    }
    for (const link of links) {
      if (link.active && visited.has(link.a) && visited.has(link.b)) {
        link.active = false;
      }
    }
  }

  function winLevel(): void {
    if (phase !== "play") return;
    phase = "won";
    phaseTime = 0;
    candyEaten = true;
    removeCandyRopes();
    chew = 1;
    api.play("coin");
    api.play("win");
    burst(level.monster.x, level.monster.y - 10, "#FF9DBE", 12, 160);
    msgEl.textContent = "啾啾吃到糖果啦！";
  }

  function finishAll(): void {
    phase = "alldone";
    const rating = starsForCollected(totalCollected, totalStars());
    api.onWin(rating, `全部 ${LEVELS.length} 关通过，收集了 ${totalCollected} 颗星星！`);
  }

  // ---------- 物理与规则 ----------

  function cutAt(x0: number, y0: number, x1: number, y1: number): void {
    if (phase !== "play") return;
    let cutCount = 0;
    for (const link of links) {
      if (!link.active) continue;
      const pa = particles[link.a];
      const pb = particles[link.b];
      if (segmentsIntersect(x0, y0, x1, y1, pa.x, pa.y, pb.x, pb.y)) {
        link.active = false;
        cutCount++;
        // 切断弹出：给两端一点垂直于刀痕的冲量，绳子会"弹"开
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len;
        const ny = (x1 - x0) / len;
        if (!pa.pinned) { pa.px -= nx * 3; pa.py -= ny * 3; }
        if (!pb.pinned) { pb.px += nx * 3; pb.py += ny * 3; }
        burst((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, "#C58A4F", 5, 70);
      }
    }
    if (cutCount > 0) api.play("pop");
  }

  function popBubble(): void {
    if (!inBubble) return;
    inBubble = false;
    const c = candy();
    burst(c.x, c.y, "#9AD4FF", 10, 110);
    api.play("pop");
  }

  function step(dt: number): void {
    simTime += dt;

    // 移动木板
    for (const b of boards) {
      b.prevX = b.x;
      b.prevY = b.y;
      const pos = boardPosition(b.def.x1, b.def.y1, b.def.x2, b.def.y2, b.def.period, simTime);
      b.x = pos.x;
      b.y = pos.y;
    }

    if (phase === "won" || phase === "alldone") return;

    integrate(particles, 0, GRAVITY, dt);
    const c = candy();
    if (inBubble && !candyGone) {
      // 泡泡浮力：抵消重力并向上加速，限制最大上升速度
      c.y += (-260 - GRAVITY) * dt * dt;
      const upSpeed = (c.py - c.y) / dt;
      const maxUp = 95;
      if (upSpeed > maxUp) c.py = c.y + maxUp * dt;
    }
    solveLinks(particles, links, 6);

    // 木板碰撞（糖果被木板带着走）
    if (!candyGone) {
      for (const b of boards) {
        collideCircleRect(
          c, CANDY_R,
          b.x, b.y, b.def.w, b.def.h,
          0.35, b.x - b.prevX, b.y - b.prevY
        );
      }
    }

    if (phase !== "play" || candyGone) return;

    // 挂钩自动抓住
    for (const h of hooks) {
      if (h.used) continue;
      if (circlesOverlap(c.x, c.y, CANDY_R, h.x, h.y, h.radius - CANDY_R)) {
        h.used = true;
        const dist = Math.hypot(c.x - h.x, c.y - h.y);
        addRopeToCandy(h.x, h.y, Math.max(dist * 0.95, 55));
        api.play("jump");
        burst(h.x, h.y, "#B7E29B", 6, 80);
      }
    }

    // 泡泡
    for (const b of bubbles) {
      if (b.used) continue;
      if (circlesOverlap(c.x, c.y, CANDY_R, b.x, b.y, BUBBLE_CATCH_R - CANDY_R)) {
        b.used = true;
        inBubble = true;
        api.play("jump");
      }
    }

    // 星星收集
    for (const s of stars) {
      if (s.collected) continue;
      if (circlesOverlap(c.x, c.y, STAR_COLLECT_R - 14, s.x, s.y, 14)) {
        s.collected = true;
        totalCollected++;
        api.play("coin");
        updateHud();
      }
    }

    // 刺
    for (const sp of level.spikes ?? []) {
      if (circleRectOverlap(c.x, c.y, CANDY_R - 2, sp.x, sp.y, sp.w, sp.h)) {
        candyGone = true;
        inBubble = false;
        burst(c.x, c.y, "#FF8FB1", 12, 150);
        failLevel("糖果碰到刺啦！");
        return;
      }
    }

    // 怪物吃糖
    const mouthX = level.monster.x;
    const mouthY = level.monster.y + 4;
    const dMouth = Math.hypot(c.x - mouthX, c.y - mouthY);
    mouthOpenAmount = Math.max(0, Math.min(1, (130 - dMouth) / 90));
    if (dMouth <= MOUTH_EAT_R) {
      inBubble = false;
      candyGone = true;
      winLevel();
      return;
    }

    // 掉出画面
    if (c.y > H + 60 || c.x < -60 || c.x > W + 60 || c.y < -80) {
      candyGone = true;
      failLevel(c.y < 0 ? "糖果飞走啦！" : "糖果掉出去啦！");
    }
  }

  // ---------- 绘制 ----------

  function drawBackground(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFF7FB");
    g.addColorStop(1, "#E7F3FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 远处的小圆点装饰
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 83 + 40) % W);
      const by = 60 + ((i * 127) % 300);
      ctx.beginPath();
      ctx.arc(bx, by, 20 + (i % 3) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRopes(): void {
    ctx.lineCap = "round";
    for (const link of links) {
      if (!link.active) continue;
      const pa = particles[link.a];
      const pb = particles[link.b];
      ctx.strokeStyle = "#A5713F";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.strokeStyle = "#C99763";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    // 锚点木钉
    for (const p of particles) {
      if (!p.pinned) continue;
      ctx.fillStyle = "#C9915F";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8F5E33";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSpikes(): void {
    for (const sp of level.spikes ?? []) {
      ctx.fillStyle = "#DCE3F5";
      ctx.beginPath();
      ctx.roundRect(sp.x, sp.y, sp.w, sp.h, 4);
      ctx.fill();
      ctx.fillStyle = "#FF7E9A";
      const tooth = 12;
      ctx.beginPath();
      if (sp.dir === "up" || sp.dir === "down") {
        const n = Math.floor(sp.w / tooth);
        const yBase = sp.dir === "up" ? sp.y : sp.y + sp.h;
        const yTip = sp.dir === "up" ? sp.y - 9 : sp.y + sp.h + 9;
        for (let i = 0; i < n; i++) {
          const x0 = sp.x + i * tooth;
          ctx.moveTo(x0, yBase);
          ctx.lineTo(x0 + tooth / 2, yTip);
          ctx.lineTo(x0 + tooth, yBase);
        }
      } else {
        const n = Math.floor(sp.h / tooth);
        const xBase = sp.dir === "left" ? sp.x : sp.x + sp.w;
        const xTip = sp.dir === "left" ? sp.x - 9 : sp.x + sp.w + 9;
        for (let i = 0; i < n; i++) {
          const y0 = sp.y + i * tooth;
          ctx.moveTo(xBase, y0);
          ctx.lineTo(xTip, y0 + tooth / 2);
          ctx.lineTo(xBase, y0 + tooth);
        }
      }
      ctx.fill();
    }
  }

  function drawBoards(): void {
    for (const b of boards) {
      ctx.fillStyle = "#D8A268";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.def.w, b.def.h, 6);
      ctx.fill();
      ctx.strokeStyle = "#B9834C";
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 2; i++) {
        const yy = b.y + (b.def.h * i) / 3;
        ctx.beginPath();
        ctx.moveTo(b.x + 6, yy);
        ctx.lineTo(b.x + b.def.w - 6, yy);
        ctx.stroke();
      }
    }
  }

  function drawStar(x: number, y: number, r: number, rot = 0): void {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = rot - Math.PI / 2 + (Math.PI * i) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawStars(): void {
    const c = candy();
    for (const s of stars) {
      if (s.collected) {
        if (s.suck < 1) {
          // 星星被吸向糖果并缩小
          s.suck = Math.min(1, s.suck + 0.06);
          const tx = candyGone ? s.x : c.x;
          const ty = candyGone ? s.y - 20 : c.y;
          const ix = s.x + (tx - s.x) * s.suck;
          const iy = s.y + (ty - s.y) * s.suck;
          ctx.fillStyle = "rgba(255, 205, 80, " + (1 - s.suck) + ")";
          drawStar(ix, iy, 14 * (1 - s.suck * 0.8), s.suck * 3);
        }
        continue;
      }
      const pulse = 1 + Math.sin(simTime * 4 + s.x) * 0.08;
      ctx.fillStyle = "#FFD75E";
      drawStar(s.x, s.y, 13 * pulse);
      ctx.fillStyle = "#FFF2C4";
      drawStar(s.x, s.y, 6 * pulse);
    }
  }

  function drawHooks(): void {
    for (const h of hooks) {
      if (h.used) continue;
      // 抓取范围提示圈
      ctx.strokeStyle = "rgba(150, 200, 130, 0.4)";
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 挂钩本体
      ctx.fillStyle = "#8CC170";
      ctx.beginPath();
      ctx.arc(h.x, h.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.x, h.y + 2, 5, Math.PI * 0.1, Math.PI * 1.4);
      ctx.stroke();
    }
  }

  function drawBubbles(): void {
    for (const b of bubbles) {
      if (b.used) continue;
      const wob = Math.sin(simTime * 3 + b.x) * 2;
      ctx.fillStyle = "rgba(170, 220, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y + wob, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 200, 250, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y + wob, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(b.x - 9, b.y + wob - 9, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCandy(): void {
    if (candyGone && !candyEaten) return;
    if (candyEaten) return;
    const c = candy();
    // 泡泡包着糖果
    if (inBubble) {
      const wob = Math.sin(simTime * 6) * 1.5;
      ctx.fillStyle = "rgba(170, 220, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 27 + wob, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 200, 250, 0.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 27 + wob, 0, Math.PI * 2);
      ctx.stroke();
    }
    const rot = (c.x - c.px) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(rot);
    // 糖纸小翅膀
    ctx.fillStyle = "#FF6FA5";
    ctx.beginPath();
    ctx.moveTo(-CANDY_R - 9, -7);
    ctx.lineTo(-CANDY_R + 2, 0);
    ctx.lineTo(-CANDY_R - 9, 7);
    ctx.closePath();
    ctx.moveTo(CANDY_R + 9, -7);
    ctx.lineTo(CANDY_R - 2, 0);
    ctx.lineTo(CANDY_R + 9, 7);
    ctx.closePath();
    ctx.fill();
    // 糖果本体
    ctx.fillStyle = "#FF8FB1";
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R, 0, Math.PI * 2);
    ctx.fill();
    // 螺旋纹
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R * 0.62, 0.3, Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, CANDY_R * 0.3, Math.PI, Math.PI * 2.1);
    ctx.stroke();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-5, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMonster(): void {
    const mx = level.monster.x;
    const my = level.monster.y;
    const bounce = phase === "won" ? Math.abs(Math.sin(phaseTime * 8)) * 6 : 0;
    const y = my - bounce;
    ctx.save();
    // 耳朵
    ctx.fillStyle = "#B48CE8";
    ctx.beginPath();
    ctx.arc(mx - 20, y - 26, 9, 0, Math.PI * 2);
    ctx.arc(mx + 20, y - 26, 9, 0, Math.PI * 2);
    ctx.fill();
    // 身体（圆滚滚）
    ctx.fillStyle = "#C7A6F2";
    ctx.beginPath();
    ctx.ellipse(mx, y, 32, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#DCC6FA";
    ctx.beginPath();
    ctx.ellipse(mx, y + 12, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛（看向糖果）
    const c = candy();
    const lookX = candyGone ? 0 : Math.max(-3, Math.min(3, (c.x - mx) * 0.03));
    const lookY = candyGone ? 0 : Math.max(-3, Math.min(3, (c.y - y) * 0.03));
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(mx - 11, y - 10, 7.5, 0, Math.PI * 2);
    ctx.arc(mx + 11, y - 10, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3A2B52";
    ctx.beginPath();
    ctx.arc(mx - 11 + lookX, y - 10 + lookY, 3.4, 0, Math.PI * 2);
    ctx.arc(mx + 11 + lookX, y - 10 + lookY, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // 嘴巴：糖果靠近时张大
    const open = phase === "won" ? Math.max(0, 1 - phaseTime * 2) : mouthOpenAmount;
    if (open > 0.15) {
      ctx.fillStyle = "#5A3A6E";
      ctx.beginPath();
      ctx.ellipse(mx, y + 8, 12 + open * 6, 5 + open * 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FF8FA8";
      ctx.beginPath();
      ctx.ellipse(mx, y + 12 + open * 5, 7, 3.5 + open * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#5A3A6E";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mx, y + 6, 8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    // 腮红
    ctx.fillStyle = "rgba(255, 150, 180, 0.5)";
    ctx.beginPath();
    ctx.arc(mx - 22, y + 2, 5, 0, Math.PI * 2);
    ctx.arc(mx + 22, y + 2, 5, 0, Math.PI * 2);
    ctx.fill();
    // 吃到后的爱心
    if (phase === "won" && phaseTime < 1.2) {
      ctx.fillStyle = "rgba(255, 110, 150, " + (1 - phaseTime / 1.2) + ")";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💜", mx + 30, y - 34 - phaseTime * 30);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const age = simTime - p1.t;
      const alpha = Math.max(0, 1 - age / 0.25);
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.lineWidth = 5 * alpha;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    while (trail.length > 0 && simTime - trail[0].t > 0.3) trail.shift();
  }

  function drawSparkles(dt: number): void {
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.t += dt;
      if (s.t > 0.6) {
        sparkles.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 300 * dt;
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 1 - s.t / 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.2 * (1 - s.t / 0.6) + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlays(): void {
    if (bannerTime > 0 && phase === "play") {
      const a = Math.min(1, bannerTime / 0.4);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * a})`;
      ctx.beginPath();
      ctx.roundRect(50, 190, 260, 84, 18);
      ctx.fill();
      ctx.fillStyle = `rgba(214, 92, 139, ${a})`;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`第 ${levelIndex + 1} 关 · ${level.name}`, W / 2, 226);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = `rgba(150, 100, 190, ${a})`;
      ctx.fillText(level.tip, W / 2, 254);
      ctx.textAlign = "left";
    }
    if (phase === "won") {
      const got = stars.filter((s) => s.collected).length;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(60, 170, 240, 120, 20);
      ctx.fill();
      ctx.fillStyle = "#D65C8B";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("过关啦！", W / 2, 210);
      ctx.font = "26px sans-serif";
      const starsStr = "⭐".repeat(got) + "☆".repeat(level.stars.length - got);
      ctx.fillText(starsStr, W / 2, 248);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#9B7BC8";
      ctx.fillText(
        levelIndex + 1 < LEVELS.length ? "马上进入下一关…" : "全部通关！",
        W / 2, 276
      );
      ctx.textAlign = "left";
    }
    if (phase === "failed") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(60, 180, 240, 100, 20);
      ctx.fill();
      ctx.fillStyle = "#E0708C";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(failReason, W / 2, 220);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#9B7BC8";
      ctx.fillText("点击画面重试本关", W / 2, 252);
      ctx.textAlign = "left";
    }
  }

  function draw(dt: number): void {
    drawBackground();
    drawSpikes();
    drawBoards();
    drawHooks();
    drawBubbles();
    drawStars();
    drawMonster();
    drawRopes();
    drawCandy();
    drawSparkles(dt);
    drawTrail();
    drawOverlays();
  }

  // ---------- 主循环 ----------

  function tick(now: number): void {
    if (destroyed) return;
    const frameDt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    acc += frameDt;
    let sub = 0;
    while (acc >= STEP && sub < 6) {
      step(STEP);
      acc -= STEP;
      sub++;
    }
    if (acc > STEP * 6) acc = 0;

    phaseTime += frameDt;
    if (bannerTime > 0) bannerTime -= frameDt;

    if (phase === "won" && phaseTime > 1.6) {
      if (levelIndex + 1 < LEVELS.length) loadLevel(levelIndex + 1);
      else finishAll();
    }

    draw(frameDt);
    raf = requestAnimationFrame(tick);
  }

  // ---------- 输入 ----------

  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let movedDist = 0;

  function toCanvas(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    if (phase === "failed") {
      retryLevel();
      return;
    }
    pointerDown = true;
    const p = toCanvas(e);
    lastX = p.x;
    lastY = p.y;
    movedDist = 0;
    trail.push({ x: p.x, y: p.y, t: simTime });
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pointerDown) return;
    const p = toCanvas(e);
    movedDist += Math.hypot(p.x - lastX, p.y - lastY);
    if (Math.hypot(p.x - lastX, p.y - lastY) > 0.5) {
      cutAt(lastX, lastY, p.x, p.y);
      trail.push({ x: p.x, y: p.y, t: simTime });
    }
    lastX = p.x;
    lastY = p.y;
  };

  const onPointerUp = (): void => {
    if (!pointerDown) return;
    pointerDown = false;
    // 轻点（几乎没移动）＝戳泡泡
    if (movedDist < 12 && phase === "play") popBubble();
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
