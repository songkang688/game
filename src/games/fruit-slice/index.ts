// 切切乐:水果飞上来,手指一划切开它!小心圆滚滚的小炸弹哦。
import {
  TARGET_SCORE,
  comboBonus,
  gravityFor,
  makeLaunch,
  segCircleHit,
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
  id: "fruit-slice",
  title: "水果切切乐",
  emoji: "🍑",
  category: "action" as const,
  color: "#ffe0a3",
  blurb: "水果飞起来,手指划一划切开它,别碰小炸弹!",
};

interface FruitKind {
  name: string;
  skin: string;
  flesh: string;
  r: number;
}

const FRUITS: FruitKind[] = [
  { name: "桃桃", skin: "#ffb3c1", flesh: "#fff0f3", r: 30 },
  { name: "橙橙", skin: "#ffc46b", flesh: "#ffe8c2", r: 28 },
  { name: "瓜瓜", skin: "#8fd47a", flesh: "#ff8fa3", r: 36 },
  { name: "莓莓", skin: "#91a7ff", flesh: "#e0e7ff", r: 22 },
  { name: "柠柠", skin: "#ffe66b", flesh: "#fff9d6", r: 26 },
];

interface Flying {
  kind: FruitKind | null; // null = 炸弹
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
}

interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  r: number;
  skin: string;
  flesh: string;
  life: number;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

interface Splash {
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

  const flying: Flying[] = [];
  const halves: Half[] = [];
  const trail: TrailPoint[] = [];
  const splashes: Splash[] = [];

  let time = 0;
  let score = 0;
  let launchTimer = 0.8;
  let over = false;
  let slicing = false;
  let lastX = 0;
  let lastY = 0;
  let gestureCount = 0;

  function finish(win: boolean): void {
    if (over) return;
    over = true;
    if (win) {
      api.play("win");
      api.onWin(starsForTime(time), "切了满满一果盘,真厉害!");
    } else {
      api.play("oops");
      api.onLose("哎呀,切到小炸弹啦,再来一盘!");
    }
  }

  function launchVolley(): void {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      const l = makeLaunch(w, h, Math.random(), Math.random(), Math.random());
      flying.push({
        kind,
        x: l.x,
        y: l.y,
        vx: l.vx,
        vy: l.vy,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 4,
        r: kind.r,
      });
    }
    // 开局 6 秒后才可能出现小炸弹
    if (time > 6 && Math.random() < 0.35) {
      const l = makeLaunch(w, h, Math.random(), Math.random(), Math.random());
      flying.push({
        kind: null,
        x: l.x,
        y: l.y,
        vx: l.vx,
        vy: l.vy,
        rot: 0,
        vrot: (Math.random() - 0.5) * 2,
        r: 26,
      });
    }
    api.play("jump");
  }

  function slice(x1: number, y1: number, x2: number, y2: number): void {
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      if (!segCircleHit(x1, y1, x2, y2, f.x, f.y, f.r + 6)) continue;
      flying.splice(i, 1);
      if (f.kind === null) {
        // 切到炸弹
        splashes.push({ x: f.x, y: f.y, life: 0.8, color: "#8a93a8" });
        finish(false);
        return;
      }
      score++;
      gestureCount++;
      api.play("pop");
      const bonus = gestureCount === 3 ? comboBonus(gestureCount) : 0;
      if (bonus > 0) {
        score += bonus;
        api.play("coin");
      }
      splashes.push({ x: f.x, y: f.y, life: 0.5, color: f.kind.flesh });
      const angle = Math.atan2(y2 - y1, x2 - x1);
      for (const side of [-1, 1]) {
        halves.push({
          x: f.x,
          y: f.y,
          vx: f.vx + Math.cos(angle + (Math.PI / 2) * side) * 120,
          vy: f.vy * 0.3 + Math.sin(angle + (Math.PI / 2) * side) * 120 - 60,
          rot: angle,
          vrot: side * 3,
          r: f.r,
          skin: f.kind.skin,
          flesh: f.kind.flesh,
          life: 1.2,
        });
      }
      if (score >= TARGET_SCORE) {
        finish(true);
        return;
      }
    }
  }

  function onPointerDown(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    slicing = true;
    gestureCount = 0;
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    trail.push({ x: lastX, y: lastY, t: time });
  }

  function onPointerMove(e: PointerEvent): void {
    if (!slicing || over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    slice(lastX, lastY, x, y);
    lastX = x;
    lastY = y;
    trail.push({ x, y, t: time });
    if (trail.length > 14) trail.shift();
  }

  function onPointerUp(): void {
    slicing = false;
    gestureCount = 0;
  }

  function update(dt: number): void {
    time += dt;
    const g = gravityFor(h);

    launchTimer -= dt;
    if (launchTimer <= 0 && flying.length < 7) {
      launchTimer = 1.4;
      launchVolley();
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.vy += g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vrot * dt;
      if (f.y > h + 80 && f.vy > 0) flying.splice(i, 1);
    }

    for (let i = halves.length - 1; i >= 0; i--) {
      const half = halves[i];
      half.vy += g * dt;
      half.x += half.vx * dt;
      half.y += half.vy * dt;
      half.rot += half.vrot * dt;
      half.life -= dt;
      if (half.life <= 0 || half.y > h + 80) halves.splice(i, 1);
    }

    while (trail.length > 0 && time - trail[0].t > 0.18) trail.shift();

    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].life -= dt;
      if (splashes[i].life <= 0) splashes.splice(i, 1);
    }
  }

  function drawFruit(f: Flying): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.kind === null) {
      // 小炸弹:灰蓝色圆球 + 惊讶表情 + 小火花
      ctx.fillStyle = "#5c6b8a";
      ctx.beginPath();
      ctx.arc(0, 0, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a4258";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -f.r);
      ctx.quadraticCurveTo(f.r * 0.4, -f.r * 1.4, f.r * 0.7, -f.r * 1.2);
      ctx.stroke();
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.arc(f.r * 0.7, -f.r * 1.2, 5 + Math.sin(time * 20) * 2, 0, Math.PI * 2);
      ctx.fill();
      // 惊讶脸(圆眼睛 + O 嘴巴)
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
      ctx.arc(f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, f.r * 0.3, f.r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const k = f.kind;
    ctx.fillStyle = k.skin;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    // 小叶子
    ctx.fillStyle = "#7ac97a";
    ctx.beginPath();
    ctx.ellipse(f.r * 0.2, -f.r * 1.02, f.r * 0.3, f.r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // 笑脸
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-f.r * 0.28, -f.r * 0.05, f.r * 0.09, 0, Math.PI * 2);
    ctx.arc(f.r * 0.28, -f.r * 0.05, f.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.5, f.r * 0.07);
    ctx.beginPath();
    ctx.arc(0, f.r * 0.18, f.r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawHalf(half: Half): void {
    ctx.save();
    ctx.translate(half.x, half.y);
    ctx.rotate(half.rot);
    ctx.globalAlpha = Math.min(1, half.life / 0.5);
    ctx.fillStyle = half.skin;
    ctx.beginPath();
    ctx.arc(0, 0, half.r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = half.flesh;
    ctx.beginPath();
    ctx.ellipse(0, 0, half.r, half.r * 0.32, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#fdf3e0");
    grad.addColorStop(1, "#ffe6ee");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 桌布圆点
    ctx.fillStyle = "rgba(255,180,200,0.18)";
    for (let y = 30; y < h; y += 70) {
      for (let x = ((y / 70) % 2) * 35 + 20; x < w; x += 70) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const half of halves) drawHalf(half);
    for (const f of flying) drawFruit(f);

    for (const s of splashes) {
      ctx.globalAlpha = Math.max(0, s.life) * 0.9;
      ctx.fillStyle = s.color;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        const d = (0.8 - s.life) * 70;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 刀光
    if (trail.length >= 2) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const age = time - trail[i].t;
        ctx.globalAlpha = Math.max(0, 1 - age / 0.18);
        ctx.lineWidth = 6 * (i / trail.length) + 2;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // 计分
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 190, 34, 17);
    ctx.fill();
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`🍑 ${score} / ${TARGET_SCORE}`, 24, 27);

    if (time < 4 && !over) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(0, h / 2 - 30, w, 60);
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("手指划过水果就能切开,小炸弹别碰!", w / 2, h / 2);
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
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.remove();
    },
  };
}
