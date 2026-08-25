// 海底大胃王:五关海底冒险!从浅海吃到深海,躲水母、避河豚,捡护盾泡泡,最后咬赢鲸鲸 BOSS!
import {
  BOSS_HP,
  BOSS_R,
  LEVELS,
  SHIELD_SECONDS,
  START_RADIUS,
  ZONE_STYLE,
  bossBiteReady,
  canEat,
  circlesOverlap,
  eatScore,
  grow,
  isDanger,
  spawnRadius,
  starsForRun,
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
  blurb: "五片海域大冒险!躲水母捡护盾,最后咬赢鲸鲸 BOSS!",
};

type Phase = "intro" | "play" | "clear" | "retry" | "done";
type NpcKind = "fish" | "jelly" | "puffer";

interface Npc {
  kind: NpcKind;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  color: string;
  /** 河豚:>0 表示鼓起(带刺,不能吃) */
  inflated: number;
  inflateClock: number;
}

interface Pickup {
  kind: "shield" | "star";
  x: number;
  y: number;
  vy: number;
  phase: number;
}

interface Boss {
  x: number;
  y: number;
  r: number;
  hp: number;
  vx: number;
  vy: number;
  dashTimer: number;
  hurt: number;
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

interface Floaty {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  big: boolean;
}

const HEARTS_PER_LEVEL = 3;

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

  // ---- 局状态 ----
  let levelIdx = 0;
  let phase: Phase = "intro";
  let hearts = HEARTS_PER_LEVEL;
  let score = 0;
  let streak = 0;
  let streakTimer = 0;
  let retries = 0;
  let heartsLostTotal = 0;
  let eaten = 0;
  let over = false;
  let time = 0;
  let shake = 0;

  const player = { x: 320, y: 240, r: START_RADIUS, facing: 1 };
  let targetX = player.x;
  let targetY = player.y;
  let invincible = 0;
  let shield = 0;

  const npcs: Npc[] = [];
  const pickups: Pickup[] = [];
  const bubbles: Bubble[] = [];
  const pops: Pop[] = [];
  const floats: Floaty[] = [];
  let boss: Boss | null = null;
  let bossActive = false;

  let spawnTimer = 0.4;
  let shieldTimer = 9;
  let starTimer = 6;

  const SMALL_COLORS = ["#a8e6c9", "#ffe0a3", "#ffc4d6", "#c4e5ff"];
  const BIG_COLORS = ["#b8a9f5", "#8fc8e8", "#f5b8c9"];

  function level() {
    return LEVELS[levelIdx];
  }

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.1 : 0.85, big });
  }

  function resetLevel(): void {
    npcs.length = 0;
    pickups.length = 0;
    pops.length = 0;
    boss = null;
    bossActive = false;
    player.x = w / 2;
    player.y = h / 2;
    player.r = START_RADIUS;
    targetX = player.x;
    targetY = player.y;
    hearts = HEARTS_PER_LEVEL;
    streak = 0;
    invincible = 2;
    shield = 0;
    spawnTimer = 0.4;
    shieldTimer = 9;
    starTimer = 6;
  }

  function finishWin(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("win");
    api.onWin(
      starsForRun(retries, heartsLostTotal),
      `五片海域全通关,鲸鲸 BOSS 都服气啦!得分 ${score}`,
    );
  }

  function failFinal(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("oops");
    api.onLose("鲸鲸城堡好难呀,再来挑战一次!");
  }

  function loseHeart(x: number, y: number): void {
    if (invincible > 0) return;
    if (shield > 0) {
      shield = 0;
      invincible = 1.2;
      api.play("pop");
      pops.push({ x, y, life: 0.5, color: "#bfe9ff" });
      addFloat(x, y - 20, "护盾碎啦!", "#5a8ac9");
      return;
    }
    hearts--;
    heartsLostTotal++;
    invincible = 2;
    streak = 0;
    shake = 0.4;
    api.play("oops");
    pops.push({ x, y, life: 0.6, color: "#ff9eb5" });
    if (hearts <= 0) {
      if (levelIdx >= LEVELS.length - 1) {
        failFinal();
      } else {
        phase = "retry";
      }
    }
  }

  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  }

  function onPointerDown(e: PointerEvent): void {
    if (over) return;
    if (phase === "intro") {
      api.play("tap");
      phase = "play";
      invincible = 2;
      return;
    }
    if (phase === "clear") {
      api.play("tap");
      levelIdx++;
      resetLevel();
      phase = "intro";
      return;
    }
    if (phase === "retry") {
      api.play("tap");
      retries++;
      resetLevel();
      phase = "play";
      return;
    }
    onPointerMove(e);
  }

  function spawnNpc(): void {
    const def = level();
    const fromLeft = Math.random() < 0.5;
    const roll = Math.random();
    // 河豚有一定概率替换普通鱼
    if (def.puffers && roll < 0.16) {
      const r = 16 + Math.random() * 8;
      npcs.push({
        kind: "puffer",
        x: fromLeft ? -r - 10 : w + r + 10,
        y: 60 + Math.random() * Math.max(60, h - 160),
        r,
        vx: (fromLeft ? 1 : -1) * (30 + Math.random() * 25),
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        color: "#ffd6a8",
        inflated: 0,
        inflateClock: 1 + Math.random() * 2,
      });
      return;
    }
    const r = spawnRadius(player.r, Math.random(), def.bigFishBias);
    const speed = 40 + Math.random() * 55 + (r < player.r ? 15 : 0);
    npcs.push({
      kind: "fish",
      x: fromLeft ? -r - 10 : w + r + 10,
      y: 40 + Math.random() * Math.max(40, h - 120),
      r,
      vx: fromLeft ? speed : -speed,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      color: canEat(player.r, r)
        ? SMALL_COLORS[Math.floor(Math.random() * SMALL_COLORS.length)]
        : BIG_COLORS[Math.floor(Math.random() * BIG_COLORS.length)],
      inflated: 0,
      inflateClock: 0,
    });
  }

  function ensureJellies(): void {
    const want = level().jellies;
    const have = npcs.filter((n) => n.kind === "jelly").length;
    for (let i = have; i < want; i++) {
      npcs.push({
        kind: "jelly",
        x: 60 + Math.random() * (w - 120),
        y: -30 - Math.random() * 80,
        r: 20 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 24,
        vy: 26 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        color: "#e5c4f2",
        inflated: 0,
        inflateClock: 0,
      });
    }
  }

  function spawnBoss(): void {
    bossActive = true;
    boss = {
      x: w + BOSS_R + 20,
      y: h * 0.4,
      r: BOSS_R,
      hp: BOSS_HP,
      vx: -50,
      vy: 0,
      dashTimer: 2.5,
      hurt: 0,
    };
    addFloat(w / 2, h * 0.3, "鲸鲸 BOSS 出现啦!", "#e05a7a", true);
    api.play("jump");
    shake = 0.5;
  }

  function update(dt: number): void {
    time += dt;
    shake = Math.max(0, shake - dt);
    invincible = Math.max(0, invincible - dt);
    shield = Math.max(0, shield - dt);
    if (streakTimer > 0) {
      streakTimer -= dt;
      if (streakTimer <= 0) streak = 0;
    }

    // 背景泡泡
    if (Math.random() < dt * 3) {
      bubbles.push({ x: Math.random() * w, y: h + 10, r: 3 + Math.random() * 6, vy: 30 + Math.random() * 40 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].y -= bubbles[i].vy * dt;
      if (bubbles[i].y < -12) bubbles.splice(i, 1);
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].life -= dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= dt * 30;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }

    if (phase !== "play") return;

    const def = level();

    // 玩家跟随指针
    const k = Math.min(1, dt * 5.5);
    const dx = targetX - player.x;
    player.x += dx * k;
    player.y += (targetY - player.y) * k;
    if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1;
    player.x = Math.max(player.r, Math.min(w - player.r, player.x));
    player.y = Math.max(player.r, Math.min(h - player.r, player.y));

    // 生成
    spawnTimer -= dt;
    if (spawnTimer <= 0 && npcs.filter((n) => n.kind !== "jelly").length < 10) {
      spawnTimer = 0.8;
      spawnNpc();
    }
    ensureJellies();
    shieldTimer -= dt;
    if (shieldTimer <= 0) {
      shieldTimer = 11 + Math.random() * 5;
      pickups.push({ kind: "shield", x: 40 + Math.random() * (w - 80), y: h + 20, vy: -36, phase: 0 });
    }
    starTimer -= dt;
    if (starTimer <= 0) {
      starTimer = 7 + Math.random() * 4;
      pickups.push({ kind: "star", x: 40 + Math.random() * (w - 80), y: h + 20, vy: -46, phase: 0 });
    }

    // 道具
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy * dt;
      p.phase += dt * 4;
      p.x += Math.sin(p.phase) * 14 * dt;
      if (p.y < -30) {
        pickups.splice(i, 1);
        continue;
      }
      if (circlesOverlap(player.x, player.y, player.r, p.x, p.y, 16, 1)) {
        pickups.splice(i, 1);
        if (p.kind === "shield") {
          shield = SHIELD_SECONDS;
          api.play("jump");
          addFloat(p.x, p.y, "护盾泡泡!", "#5a8ac9", true);
        } else {
          score += 20;
          api.play("coin");
          addFloat(p.x, p.y, "+20", "#c47a2a");
        }
        pops.push({ x: p.x, y: p.y, life: 0.4, color: "#bfe9ff" });
      }
    }

    // NPC 移动 + 碰撞
    for (let i = npcs.length - 1; i >= 0; i--) {
      const f = npcs[i];
      f.phase += dt * 3;
      if (f.kind === "jelly") {
        f.x += f.vx * dt + Math.sin(f.phase) * 10 * dt;
        f.y += f.vy * dt;
        if (f.x < 30 || f.x > w - 30) f.vx = -f.vx;
        if (f.y > h + 40) {
          f.y = -30;
          f.x = 60 + Math.random() * (w - 120);
        }
      } else {
        f.x += f.vx * dt;
        f.y += Math.sin(f.phase) * 12 * dt;
        if (f.kind === "puffer") {
          f.inflateClock -= dt;
          if (f.inflateClock <= 0) {
            f.inflated = f.inflated > 0 ? 0 : 1;
            f.inflateClock = f.inflated > 0 ? 1.6 : 2.2;
          }
        }
        if ((f.vx > 0 && f.x > w + f.r + 30) || (f.vx < 0 && f.x < -f.r - 30)) {
          npcs.splice(i, 1);
          continue;
        }
      }

      const effR = f.kind === "puffer" && f.inflated > 0 ? f.r * 1.5 : f.r;
      if (!circlesOverlap(player.x, player.y, player.r, f.x, f.y, effR)) continue;

      if (f.kind === "jelly") {
        loseHeart(f.x, f.y);
        if (over || phase !== "play") return;
        continue;
      }
      if (f.kind === "puffer" && f.inflated > 0) {
        loseHeart(f.x, f.y);
        if (over || phase !== "play") return;
        continue;
      }
      if (canEat(player.r, f.r)) {
        npcs.splice(i, 1);
        player.r = grow(player.r, f.r, def.targetR + 6);
        eaten++;
        streak++;
        streakTimer = 3;
        const gain = eatScore(streak);
        score += gain;
        addFloat(f.x, f.y, streak >= 3 ? `连吃×${streak} +${gain}` : `+${gain}`, streak >= 3 ? "#b28ae8" : "#c47a2a", streak >= 3);
        pops.push({ x: f.x, y: f.y, life: 0.4, color: f.color });
        api.play(streak % 5 === 0 ? "coin" : "pop");
        if (player.r >= def.targetR) {
          if (def.boss) {
            if (!bossActive) spawnBoss();
          } else if (levelIdx >= LEVELS.length - 1) {
            finishWin();
            return;
          } else {
            phase = "clear";
            api.play("win");
            return;
          }
        }
      } else if (isDanger(player.r, f.r)) {
        loseHeart(f.x, f.y);
        if (over || phase !== "play") return;
      }
    }

    // BOSS 行为
    if (boss) {
      const b = boss;
      b.hurt = Math.max(0, b.hurt - dt);
      b.dashTimer -= dt;
      if (b.dashTimer <= 0) {
        b.dashTimer = 2.2 + Math.random() * 1.4;
        const d = Math.hypot(player.x - b.x, player.y - b.y) || 1;
        b.vx = ((player.x - b.x) / d) * 130;
        b.vy = ((player.y - b.y) / d) * 130;
        api.play("meow");
      }
      b.vx *= 1 - Math.min(1, dt * 0.7);
      b.vy *= 1 - Math.min(1, dt * 0.7);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = Math.max(-40, Math.min(w + 40, b.x));
      b.y = Math.max(60, Math.min(h - 60, b.y));

      if (circlesOverlap(player.x, player.y, player.r, b.x, b.y, b.r, 0.7)) {
        if (bossBiteReady(player.r, b.r)) {
          if (b.hurt <= 0) {
            b.hp--;
            b.hurt = 1;
            score += 50;
            shake = 0.4;
            api.play("coin");
            addFloat(b.x, b.y - b.r, `咬到 BOSS!还剩 ${Math.max(0, b.hp)} 口`, "#e05a7a", true);
            pops.push({ x: b.x, y: b.y, life: 0.6, color: "#ff9eb5" });
            // 玩家被弹开一点
            const d = Math.hypot(player.x - b.x, player.y - b.y) || 1;
            targetX = player.x + ((player.x - b.x) / d) * 120;
            targetY = player.y + ((player.y - b.y) / d) * 120;
            if (b.hp <= 0) {
              boss = null;
              finishWin();
              return;
            }
          }
        } else {
          loseHeart(player.x, player.y);
          if (over || phase !== "play") return;
        }
      }
    }
  }

  // ---- 绘制 ----
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
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.5, -r * 0.55);
    ctx.lineTo(-r * 1.5, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.7, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 0.18, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.18, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.2, r * 0.07);
    ctx.beginPath();
    ctx.arc(r * 0.45, r * 0.15, r * 0.18, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
    if (isPlayer) {
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

  function drawJelly(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, Math.PI, 0);
    const squig = Math.sin(f.phase * 2) * f.r * 0.12;
    ctx.quadraticCurveTo(f.r * 0.6, f.r * 0.3 + squig, 0, f.r * 0.28);
    ctx.quadraticCurveTo(-f.r * 0.6, f.r * 0.3 - squig, -f.r, 0);
    ctx.fill();
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * f.r * 0.4, f.r * 0.25);
      ctx.quadraticCurveTo(
        i * f.r * 0.4 + Math.sin(f.phase * 3 + i) * 6,
        f.r * 0.8,
        i * f.r * 0.4 + Math.sin(f.phase * 3 + i + 1) * 8,
        f.r * 1.25,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-f.r * 0.28, -f.r * 0.2, f.r * 0.09, 0, Math.PI * 2);
    ctx.arc(f.r * 0.28, -f.r * 0.2, f.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPuffer(f: Npc): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.vx >= 0 ? 1 : -1, 1);
    const r = f.inflated > 0 ? f.r * 1.5 : f.r;
    if (f.inflated > 0) {
      ctx.strokeStyle = "#e8a878";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
        ctx.stroke();
      }
    }
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.15, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.15, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.2, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBoss(b: Boss): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    const facing = player.x < b.x ? -1 : 1;
    ctx.scale(facing, 1);
    if (b.hurt > 0.6) ctx.globalAlpha = 0.6;
    // 鲸鲸身体
    ctx.fillStyle = "#8fc8e8";
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r, b.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // 尾巴
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.85, 0);
    ctx.quadraticCurveTo(-b.r * 1.4, -b.r * 0.1, -b.r * 1.5, -b.r * 0.6);
    ctx.quadraticCurveTo(-b.r * 1.25, -b.r * 0.1, -b.r * 1.1, 0);
    ctx.quadraticCurveTo(-b.r * 1.25, b.r * 0.1, -b.r * 1.5, b.r * 0.6);
    ctx.quadraticCurveTo(-b.r * 1.4, b.r * 0.1, -b.r * 0.85, 0);
    ctx.fill();
    // 肚皮
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, b.r * 0.3, b.r * 0.75, b.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // 水花喷泉
    ctx.strokeStyle = "#bfe9ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -b.r * 0.7);
    ctx.quadraticCurveTo(-b.r * 0.15, -b.r * 1.1, -b.r * 0.3, -b.r * 1.2);
    ctx.moveTo(0, -b.r * 0.7);
    ctx.quadraticCurveTo(b.r * 0.15, -b.r * 1.1, b.r * 0.3, -b.r * 1.2);
    ctx.stroke();
    // 眼睛嘴巴
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(b.r * 0.4, -b.r * 0.15, b.r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(2, b.r * 0.05);
    ctx.beginPath();
    ctx.arc(b.r * 0.4, b.r * 0.12, b.r * 0.16, 0.1 * Math.PI, 0.7 * Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    // BOSS 血量爱心
    for (let i = 0; i < BOSS_HP; i++) {
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i < b.hp ? "💗" : "🤍", b.x - (BOSS_HP - 1) * 11 + i * 22, b.y - b.r - 22);
    }
  }

  function drawZoneDecor(): void {
    const def = level();
    if (def.zone === "shallow") {
      ctx.fillStyle = ZONE_STYLE.shallow.accent;
      ctx.beginPath();
      ctx.ellipse(w / 2, h + 24, w * 0.75, 56, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (def.zone === "coral") {
      for (let i = 0; i < 5; i++) {
        const x = (w / 5) * i + w / 10;
        ctx.fillStyle = i % 2 === 0 ? "#ff9eb5" : "#c9b6f2";
        ctx.globalAlpha = 0.5;
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.ellipse(x + j * 14, h - 20 - Math.abs(j) * 8, 9, 26 + (j === 0 ? 10 : 0), j * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    } else {
      // 深海:柔柔的光柱
      for (let i = 0; i < 3; i++) {
        const x = w * (0.25 + i * 0.25) + Math.sin(time * 0.5 + i) * 20;
        const g = ctx.createLinearGradient(x, 0, x + 60, h);
        g.addColorStop(0, "rgba(255,255,255,0.18)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 20, 0);
        ctx.lineTo(x + 40, 0);
        ctx.lineTo(x + 90, h);
        ctx.lineTo(x - 60, h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function overlayPanel(title: string, sub: string, accent: string): void {
    ctx.fillStyle = "rgba(255,250,252,0.8)";
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
    ctx.font = "bold 25px sans-serif";
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
    const def = level();
    const zone = ZONE_STYLE[def.zone];
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, zone.top);
    grad.addColorStop(1, zone.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    drawZoneDecor();

    for (const b of bubbles) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 道具
    for (const p of pickups) {
      if (p.kind === "shield") {
        ctx.strokeStyle = "rgba(120,180,255,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(190,225,255,0.5)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5a8ac9";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛡", p.x, p.y);
      } else {
        ctx.font = "22px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⭐", p.x, p.y);
      }
    }

    for (const f of npcs) {
      if (f.kind === "jelly") drawJelly(f);
      else if (f.kind === "puffer") drawPuffer(f);
      else drawFish(f.x, f.y, f.r, f.vx >= 0 ? 1 : -1, f.color, false);
    }

    if (boss) drawBoss(boss);

    const blink = invincible > 0 && Math.floor(time * 8) % 2 === 0;
    if (!blink) {
      drawFish(player.x, player.y, player.r, player.facing, "#ff9eb5", true);
      if (shield > 0) {
        ctx.strokeStyle = `rgba(120,180,255,${0.5 + Math.sin(time * 6) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r * 1.5 + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.5 - Math.min(0.5, p.life)) * 90 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 21px sans-serif" : "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    const bw = Math.min(280, w - 250);
    const bx = (w - bw) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.roundRect(bx, 12, bw, 18, 9);
    ctx.fill();
    const prog = boss
      ? 1
      : Math.max(0, Math.min(1, (player.r - START_RADIUS) / (def.targetR - START_RADIUS)));
    ctx.fillStyle = "#ff9eb5";
    ctx.beginPath();
    ctx.roundRect(bx, 12, Math.max(18, bw * prog), 18, 9);
    ctx.fill();
    ctx.fillStyle = "#5a5a6e";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      bossActive ? "去咬鲸鲸 BOSS!" : `长大进度 ${Math.round(prog * 100)}%`,
      w / 2,
      21,
    );
    ctx.textAlign = "left";
    ctx.font = "15px sans-serif";
    ctx.fillText(`第 ${levelIdx + 1}/${LEVELS.length} 关 · ${zone.name}`, 12, 21);
    ctx.textAlign = "right";
    ctx.fillText(
      "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_LEVEL - hearts)) + `  分 ${score}`,
      w - 12,
      21,
    );
    if (shield > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a8ac9";
      ctx.fillText(`🛡 ${Math.ceil(shield)}s`, w - 12, 44);
    }
    if (streak >= 3 && streakTimer > 0) {
      ctx.fillStyle = "#b28ae8";
      ctx.font = `bold ${18 + Math.min(streak, 8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`连吃 ×${streak}`, w / 2, 52);
    }

    // ---- 覆盖层 ----
    if (phase === "intro") {
      overlayPanel(
        `第 ${levelIdx + 1} 关 · ${def.name}`,
        levelIdx === 0
          ? "移动手指或鼠标,吃比你小的鱼,躲开大鱼!"
          : def.boss
            ? "先吃小鱼长大,再咬鲸鲸 BOSS 五口!"
            : def.jellies > 0
              ? "小心飘来飘去的水母,碰到会痛痛!"
              : "鼓起来的鼓鼓鱼有刺,等它瘪了再吃!",
        "#e05a7a",
      );
    } else if (phase === "clear") {
      overlayPanel(`${def.name} 通过啦!`, `已吃 ${eaten} 条鱼 · 得分 ${score}`, "#4a9a5a");
    } else if (phase === "retry") {
      overlayPanel("小鱼晕乎乎……", "没关系!点一下再游一次这片海", "#b28ae8");
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
  canvas.addEventListener("pointerdown", onPointerDown);
  resetLevel();
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
