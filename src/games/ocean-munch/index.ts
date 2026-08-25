// 海底大胃王:手指/鼠标带着小鱼游,吃掉比自己小的鱼慢慢长大!
import {
  START_RADIUS,
  TARGET_RADIUS,
  canEat,
  circlesOverlap,
  grow,
  isDanger,
  spawnRadius,
  starsForTime,
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
  id: "ocean-munch",
  title: "海底大胃王",
  emoji: "🐟",
  category: "action" as const,
  color: "#bfe9ff",
  blurb: "带着小粉鱼吃掉更小的鱼,长成海底大明星!",
};

interface Npc {
  x: number;
  y: number;
  r: number;
  vx: number;
  phase: number;
  color: string;
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

const GRACE_SECONDS = 1.8;

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

  const player = { x: w / 2, y: h / 2, r: START_RADIUS, facing: 1 };
  let targetX = player.x;
  let targetY = player.y;
  const npcs: Npc[] = [];
  const bubbles: Bubble[] = [];
  const pops: Pop[] = [];
  let time = 0;
  let spawnTimer = 0.4;
  let eaten = 0;
  let over = false;

  const SMALL_COLORS = ["#a8e6c9", "#ffe0a3", "#ffc4d6", "#c4e5ff"];
  const BIG_COLORS = ["#b8a9f5", "#8fc8e8", "#f5b8c9"];

  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  }

  function finish(win: boolean): void {
    if (over) return;
    over = true;
    if (win) {
      api.play("win");
      api.onWin(starsForTime(time), "小鱼长成大明星啦!");
    } else {
      api.play("oops");
      api.onLose("被大鱼碰了一下,再游一次吧!");
    }
  }

  function spawnNpc(): void {
    const fromLeft = Math.random() < 0.5;
    const r = spawnRadius(player.r, Math.random());
    const speed = 40 + Math.random() * 55 + (r < player.r ? 15 : 0);
    npcs.push({
      x: fromLeft ? -r - 10 : w + r + 10,
      y: 40 + Math.random() * Math.max(40, h - 120),
      r,
      vx: fromLeft ? speed : -speed,
      phase: Math.random() * Math.PI * 2,
      color: canEat(player.r, r)
        ? SMALL_COLORS[Math.floor(Math.random() * SMALL_COLORS.length)]
        : BIG_COLORS[Math.floor(Math.random() * BIG_COLORS.length)],
    });
  }

  function update(dt: number): void {
    time += dt;

    // 玩家跟随指针
    const k = Math.min(1, dt * 5.5);
    const dx = targetX - player.x;
    player.x += dx * k;
    player.y += (targetY - player.y) * k;
    if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1;
    player.x = Math.max(player.r, Math.min(w - player.r, player.x));
    player.y = Math.max(player.r, Math.min(h - player.r, player.y));

    // 生成小鱼
    spawnTimer -= dt;
    if (spawnTimer <= 0 && npcs.length < 10) {
      spawnTimer = 0.85;
      spawnNpc();
    }

    // 背景泡泡
    if (Math.random() < dt * 3) {
      bubbles.push({ x: Math.random() * w, y: h + 10, r: 3 + Math.random() * 6, vy: 30 + Math.random() * 40 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].y -= bubbles[i].vy * dt;
      if (bubbles[i].y < -12) bubbles.splice(i, 1);
    }

    // NPC 移动 + 碰撞
    for (let i = npcs.length - 1; i >= 0; i--) {
      const f = npcs[i];
      f.x += f.vx * dt;
      f.phase += dt * 3;
      f.y += Math.sin(f.phase) * 12 * dt;
      if ((f.vx > 0 && f.x > w + f.r + 20) || (f.vx < 0 && f.x < -f.r - 20)) {
        npcs.splice(i, 1);
        continue;
      }
      if (!circlesOverlap(player.x, player.y, player.r, f.x, f.y, f.r)) continue;
      if (canEat(player.r, f.r)) {
        npcs.splice(i, 1);
        player.r = grow(player.r, f.r);
        eaten++;
        pops.push({ x: f.x, y: f.y, life: 0.4, color: f.color });
        api.play(eaten % 5 === 0 ? "coin" : "pop");
        if (player.r >= TARGET_RADIUS) {
          finish(true);
          return;
        }
      } else if (isDanger(player.r, f.r) && time > GRACE_SECONDS) {
        finish(false);
        return;
      }
      // 差不多大:什么也不发生,擦身而过
    }

    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
  }

  function drawFish(
    x: number,
    y: number,
    r: number,
    facing: number,
    color: string,
    isPlayer: boolean,
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    // 尾巴
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.5, -r * 0.55);
    ctx.lineTo(-r * 1.5, r * 0.55);
    ctx.closePath();
    ctx.fill();
    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    // 肚皮
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.7, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 0.18, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.18, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // 微笑
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.beginPath();
    ctx.arc(r * 0.45, r * 0.15, r * 0.18, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
    if (isPlayer) {
      // 小皇冠,表示这是自己
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

  function draw(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#c9edff");
    grad.addColorStop(1, "#8fd0f0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 沙滩
    ctx.fillStyle = "#ffeeba";
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 24, w * 0.75, 56, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    for (const b of bubbles) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const f of npcs) {
      drawFish(f.x, f.y, f.r, f.vx >= 0 ? 1 : -1, f.color, false);
    }

    const blink = time < GRACE_SECONDS && Math.floor(time * 6) % 2 === 0;
    if (!blink) drawFish(player.x, player.y, player.r, player.facing, "#ff9eb5", true);

    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.4 - p.life) * 90 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 成长进度条
    const bw = Math.min(320, w - 40);
    const bx = (w - bw) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.roundRect(bx, 14, bw, 18, 9);
    ctx.fill();
    const prog = Math.max(0, Math.min(1, (player.r - START_RADIUS) / (TARGET_RADIUS - START_RADIUS)));
    ctx.fillStyle = "#ff9eb5";
    ctx.beginPath();
    ctx.roundRect(bx, 14, Math.max(18, bw * prog), 18, 9);
    ctx.fill();
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`长大进度 ${Math.round(prog * 100)}%  🐟 已吃 ${eaten} 条`, w / 2, 23);

    if (time < 4) {
      ctx.fillStyle = "rgba(90,90,110,0.85)";
      ctx.font = "18px sans-serif";
      ctx.fillText("移动手指或鼠标,吃掉比你小的鱼!", w / 2, 52);
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

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerMove);
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerMove);
      canvas.remove();
    },
  };
}
