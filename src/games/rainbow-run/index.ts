// 彩虹跑跑:三条彩虹跑道,上滑跳、下滑趴、左右滑换道,吃星星坚持 60 秒!
import {
  MAX_HEARTS,
  ObstacleKind,
  PlayerAction,
  RUN_SECONDS,
  clampLane,
  detectSwipe,
  starsForHearts,
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
  blurb: "上滑跳一跳,下滑趴一趴,吃星星跑过彩虹桥!",
};

interface Obstacle {
  lane: number;
  kind: ObstacleKind;
  y: number;
}

interface StarPickup {
  lane: number;
  y: number;
  taken: boolean;
}

interface Puff {
  x: number;
  y: number;
  life: number;
  color: string;
}

const LANE_COLORS = ["#ffd6e7", "#fff1c9", "#d4f0ff"];
const JUMP_TIME = 0.55;
const SLIDE_TIME = 0.6;
const HIT_WINDOW = 34; // 像素:障碍与玩家的碰撞判定带

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

  let lane = 1;
  let laneFloat = 1;
  let action: PlayerAction = "run";
  let actionTimer = 0;
  let hearts = MAX_HEARTS;
  let invincible = 0;
  let time = 0;
  let score = 0;
  let starsEaten = 0;
  let speed = 240;
  let spawnTimer = 1;
  let over = false;
  let scrollPhase = 0;

  const obstacles: Obstacle[] = [];
  const starPickups: StarPickup[] = [];
  const puffs: Puff[] = [];

  // 滑动手势
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swiping = false;
  let swipeDone = false;

  function doAction(dir: "left" | "right" | "up" | "down"): void {
    if (over) return;
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

  function onPointerDown(e: PointerEvent): void {
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

  function finish(win: boolean): void {
    if (over) return;
    over = true;
    if (win) {
      api.play("win");
      api.onWin(starsForHearts(hearts), `跑完彩虹桥,吃到 ${starsEaten} 颗星星!`);
    } else {
      api.play("oops");
      api.onLose("摔了个屁股蹲儿,再跑一次吧!");
    }
  }

  function spawnRow(): void {
    const roll = Math.random();
    if (roll < 0.2) {
      // 一排星星
      const starLane = Math.floor(Math.random() * 3);
      for (let i = 0; i < 3; i++) {
        starPickups.push({ lane: starLane, y: -40 - i * 70, taken: false });
      }
      return;
    }
    const kinds: ObstacleKind[] = ["rock", "hurdle", "bar"];
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const count = roll < 0.72 ? 1 : 2; // 最多占两条道,永远留活路
    for (let i = 0; i < count; i++) {
      obstacles.push({
        lane: lanes[i],
        kind: kinds[Math.floor(Math.random() * kinds.length)],
        y: -40,
      });
    }
    // 空道上偶尔放一颗星星
    if (Math.random() < 0.5) {
      starPickups.push({ lane: lanes[2], y: -40, taken: false });
    }
  }

  function update(dt: number): void {
    time += dt;
    scrollPhase += speed * dt;
    speed = 240 + (time / RUN_SECONDS) * 180;
    invincible = Math.max(0, invincible - dt);

    laneFloat += (lane - laneFloat) * Math.min(1, dt * 10);

    if (actionTimer > 0) {
      actionTimer -= dt;
      if (actionTimer <= 0) action = "run";
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.55, 1.15 - time * 0.008);
      spawnRow();
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
        hearts--;
        invincible = 1.5;
        api.play("oops");
        for (let k = 0; k < 8; k++) {
          puffs.push({
            x: laneX(lane) + (Math.random() - 0.5) * 50,
            y: py + (Math.random() - 0.5) * 50,
            life: 0.5,
            color: "#ffffff",
          });
        }
        if (hearts <= 0) {
          finish(false);
          return;
        }
      }
    }

    for (let i = starPickups.length - 1; i >= 0; i--) {
      const s = starPickups[i];
      s.y += speed * dt;
      if (s.y > h + 40) {
        starPickups.splice(i, 1);
        continue;
      }
      if (!s.taken && s.lane === lane && Math.abs(s.y - py) < 40 && action !== "slide") {
        s.taken = true;
        starPickups.splice(i, 1);
        starsEaten++;
        score += 2;
        api.play("coin");
        if (starsEaten <= 15) api.addStars(1);
        puffs.push({ x: laneX(lane), y: py - 40, life: 0.5, color: "#ffe387" });
      }
    }

    for (let i = puffs.length - 1; i >= 0; i--) {
      puffs[i].life -= dt;
      puffs[i].y -= dt * 40;
      if (puffs[i].life <= 0) puffs.splice(i, 1);
    }

    if (time >= RUN_SECONDS) finish(true);
  }

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

  function draw(): void {
    // 天空
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#dff1ff");
    grad.addColorStop(1, "#fdeff5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 三条跑道
    const laneW = w * 0.26;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = LANE_COLORS[i];
      ctx.fillRect(laneX(i) - laneW / 2, 0, laneW, h);
    }
    // 滚动虚线,制造奔跑感
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

    // 障碍
    for (const o of obstacles) {
      const x = laneX(o.lane);
      if (o.kind === "rock") {
        // 大软糖
        ctx.fillStyle = "#c9a6f2";
        ctx.beginPath();
        ctx.ellipse(x, o.y, laneW * 0.3, laneW * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(x - laneW * 0.1, o.y - laneW * 0.08, laneW * 0.07, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === "hurdle") {
        // 小栅栏(跳过去)
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
        // 彩虹横杆(趴下钻过去)
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

    // 星星
    for (const s of starPickups) {
      drawStar(laneX(s.lane), s.y, 14, "#ffd868");
    }

    // 玩家:圆滚滚的跑跑糖
    const px = laneX(laneFloat);
    const py = playerY();
    const blink = invincible > 0 && Math.floor(invincible * 8) % 2 === 0;
    if (!blink) {
      const jumping = action === "jump";
      const sliding = action === "slide";
      const lift = jumping ? Math.sin((1 - actionTimer / JUMP_TIME) * Math.PI) * 70 : 0;
      const r = 30;
      // 影子
      ctx.fillStyle = "rgba(90,90,110,0.18)";
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.85, r * (jumping ? 0.55 : 0.85), r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      const bodyY = py - lift;
      const sx = sliding ? 1.25 : 1;
      const sy = sliding ? 0.6 : 1;
      ctx.fillStyle = "#ffb3c8";
      ctx.beginPath();
      ctx.ellipse(px, bodyY, r * sx, r * sy, 0, 0, Math.PI * 2);
      ctx.fill();
      // 小脚跑动
      if (!jumping && !sliding) {
        const step = Math.sin(scrollPhase * 0.05) * 8;
        ctx.fillStyle = "#e88aa5";
        ctx.beginPath();
        ctx.arc(px - 12, bodyY + r * 0.8 + step * 0.4, 7, 0, Math.PI * 2);
        ctx.arc(px + 12, bodyY + r * 0.8 - step * 0.4, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      // 脸
      ctx.fillStyle = "#3a3a4a";
      ctx.beginPath();
      ctx.arc(px - 10, bodyY - 5 * sy, 3.5, 0, Math.PI * 2);
      ctx.arc(px + 10, bodyY - 5 * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3a3a4a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, bodyY + 5 * sy, 9, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      // 腮红
      ctx.fillStyle = "rgba(255,120,150,0.4)";
      ctx.beginPath();
      ctx.arc(px - 18, bodyY + 2, 5, 0, Math.PI * 2);
      ctx.arc(px + 18, bodyY + 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of puffs) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 顶部:时间进度 + 得分 + 生命
    const bw = Math.min(300, w - 200);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.roundRect((w - bw) / 2, 12, bw, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#b28ae8";
    ctx.beginPath();
    ctx.roundRect((w - bw) / 2, 12, Math.max(16, (bw * Math.min(time, RUN_SECONDS)) / RUN_SECONDS), 16, 8);
    ctx.fill();
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "16px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`⭐ ${starsEaten}  分 ${score}`, 12, 20);
    ctx.textAlign = "right";
    ctx.fillText("💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, MAX_HEARTS - hearts)), w - 12, 20);

    if (time < 4.5 && !over) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(0, h * 0.35, w, 56);
      ctx.fillStyle = "#8a5ac9";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("左右滑换道 · 上滑跳 · 下滑趴,坚持 60 秒!", w / 2, h * 0.35 + 28);
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
