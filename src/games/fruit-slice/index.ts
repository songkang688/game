// 水果切切乐:唰唰唰!经典三回合闯关 + 街机无尽模式。
// 刀光拖尾、连切爆击慢动作、小炸弹、彩虹香蕉召唤水果雨!
import {
  BANANA_CHANCE,
  COMBO_WINDOW,
  FRENZY_MULTIPLIER,
  FRENZY_SECONDS,
  HEARTS_PER_ROUND,
  ROUNDS,
  arcadePace,
  arcadeStars,
  comboBonus,
  comboLabel,
  gravityFor,
  makeLaunch,
  segCircleHit,
  starsForClassic,
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
  blurb: "唰!连切爆击、躲炸弹、切彩虹香蕉召唤水果雨!",
};

type Mode = "classic" | "arcade";
type Phase = "menu" | "intro" | "play" | "clear" | "retry" | "done";

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

type FlyKind = "fruit" | "bomb" | "banana";

interface Flying {
  fly: FlyKind;
  kind: FruitKind | null;
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
  let mode: Mode = "classic";
  let phase: Phase = "menu";
  let roundIdx = 0;
  let roundScore = 0;
  let totalScore = 0;
  let roundTime = 0;
  let hearts = HEARTS_PER_ROUND;
  let retries = 0;
  let bombsHitTotal = 0;
  let bestCombo = 0;
  let over = false;

  const flying: Flying[] = [];
  const halves: Half[] = [];
  const trail: TrailPoint[] = [];
  const splashes: Splash[] = [];
  const floats: Floaty[] = [];

  let time = 0;
  let launchTimer = 0.8;
  let slicing = false;
  let lastX = 0;
  let lastY = 0;
  let shake = 0;
  let hitStop = 0;
  let frenzyTimer = 0;
  let frenzyLaunch = 0;

  // 连击窗口
  let comboCount = 0;
  let comboClock = 0;
  let comboX = 0;
  let comboY = 0;

  const menuRects: Array<{ mode: Mode; rect: Rect }> = [];

  function addFloat(x: number, y: number, text: string, color: string, big = false): void {
    floats.push({ x, y, text, color, life: big ? 1.2 : 0.85, big });
  }

  function resetRound(): void {
    flying.length = 0;
    halves.length = 0;
    splashes.length = 0;
    roundScore = 0;
    roundTime = mode === "classic" ? ROUNDS[roundIdx].time : 0;
    hearts = HEARTS_PER_ROUND;
    launchTimer = 0.8;
    frenzyTimer = 0;
    comboCount = 0;
    comboClock = 0;
  }

  function finishClassicWin(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("win");
    api.onWin(
      starsForClassic(retries, bombsHitTotal),
      `三回合大丰收!总分 ${totalScore},最高 ${bestCombo} 连切!`,
    );
  }

  function finishArcade(): void {
    if (over) return;
    over = true;
    phase = "done";
    const stars = arcadeStars(totalScore);
    if (stars === 0) {
      api.play("oops");
      api.onLose(`切到 ${totalScore} 分,再来一盘冲 40 分!`);
    } else {
      api.play("win");
      api.onWin(stars, `街机模式切到 ${totalScore} 分,最高 ${bestCombo} 连切!`);
    }
  }

  function failFinalRound(): void {
    if (over) return;
    over = true;
    phase = "done";
    api.play("oops");
    api.onLose("最后一回合好可惜,再来切一盘!");
  }

  function roundFail(): void {
    if (mode === "arcade") {
      finishArcade();
      return;
    }
    if (roundIdx >= ROUNDS.length - 1) {
      failFinalRound();
    } else {
      phase = "retry";
      api.play("oops");
    }
  }

  // ---- 抛射 ----
  function launchOne(fly: FlyKind): void {
    const l = makeLaunch(w, h, Math.random(), Math.random(), Math.random());
    if (fly === "fruit") {
      const kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      flying.push({
        fly,
        kind,
        x: l.x,
        y: l.y,
        vx: l.vx,
        vy: l.vy,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 4,
        r: kind.r,
      });
    } else {
      flying.push({
        fly,
        kind: null,
        x: l.x,
        y: l.y,
        vx: l.vx,
        vy: l.vy,
        rot: fly === "banana" ? Math.random() * Math.PI : 0,
        vrot: (Math.random() - 0.5) * (fly === "banana" ? 5 : 2),
        r: fly === "banana" ? 30 : 26,
      });
    }
  }

  function launchVolley(): void {
    const pace = mode === "arcade" ? arcadePace(totalScore) : null;
    const round = ROUNDS[Math.min(roundIdx, ROUNDS.length - 1)];
    const min = mode === "arcade" ? 1 : round.volleyMin;
    const max = mode === "arcade" ? 3 : round.volleyMax;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < n; i++) launchOne("fruit");
    const bombChance = pace ? pace.bombChance : round.bombChance;
    if (time > 4 && Math.random() < bombChance) launchOne("bomb");
    if (Math.random() < BANANA_CHANCE) launchOne("banana");
    api.play("jump");
  }

  // ---- 连击结算 ----
  function settleCombo(): void {
    if (comboCount >= 2) {
      const bonus = comboBonus(comboCount);
      roundScore += bonus;
      totalScore += bonus;
      bestCombo = Math.max(bestCombo, comboCount);
      const label = comboLabel(comboCount);
      if (label) addFloat(comboX, comboY - 30, `${label} +${bonus}`, "#b28ae8", true);
      api.play("coin");
      if (comboCount >= 3) {
        hitStop = 0.28;
        shake = Math.min(0.35, 0.1 + comboCount * 0.05);
      }
    }
    comboCount = 0;
    comboClock = 0;
  }

  function onFruitSliced(f: Flying, x1: number, y1: number, x2: number, y2: number): void {
    const kind = f.kind as FruitKind;
    const mult = frenzyTimer > 0 ? FRENZY_MULTIPLIER : 1;
    const gain = 1 * mult;
    roundScore += gain;
    totalScore += gain;
    comboCount++;
    comboClock = COMBO_WINDOW;
    comboX = f.x;
    comboY = f.y;
    api.play("pop");
    addFloat(f.x, f.y - 10, `+${gain}`, "#c47a2a");
    splashes.push({ x: f.x, y: f.y, life: 0.5, color: kind.flesh });
    const angle = Math.atan2(y2 - y1, x2 - x1);
    for (const side of [-1, 1]) {
      halves.push({
        x: f.x,
        y: f.y,
        vx: f.vx + Math.cos(angle + (Math.PI / 2) * side) * 130,
        vy: f.vy * 0.3 + Math.sin(angle + (Math.PI / 2) * side) * 130 - 60,
        rot: angle,
        vrot: side * 3,
        r: f.r,
        skin: kind.skin,
        flesh: kind.flesh,
        life: 1.2,
      });
    }
  }

  function onBombSliced(f: Flying): void {
    bombsHitTotal++;
    hearts--;
    shake = 0.6;
    comboCount = 0;
    comboClock = 0;
    api.play("oops");
    splashes.push({ x: f.x, y: f.y, life: 0.8, color: "#8a93a8" });
    addFloat(f.x, f.y - 20, "哎呀,是小炸弹!", "#5c6b8a", true);
    if (hearts <= 0) roundFail();
  }

  function onBananaSliced(f: Flying): void {
    frenzyTimer = FRENZY_SECONDS;
    frenzyLaunch = 0;
    shake = 0.3;
    api.play("win");
    addFloat(w / 2, h * 0.3, "彩虹香蕉!水果雨来啦!!", "#e0a030", true);
    splashes.push({ x: f.x, y: f.y, life: 0.6, color: "#ffe66b" });
  }

  function slice(x1: number, y1: number, x2: number, y2: number): void {
    if (phase !== "play") return;
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      if (!segCircleHit(x1, y1, x2, y2, f.x, f.y, f.r + 6)) continue;
      flying.splice(i, 1);
      if (f.fly === "bomb") {
        onBombSliced(f);
        if (over || phase !== "play") return;
      } else if (f.fly === "banana") {
        onBananaSliced(f);
      } else {
        onFruitSliced(f, x1, y1, x2, y2);
        if (mode === "classic" && roundScore >= ROUNDS[roundIdx].target) {
          settleCombo();
          if (roundIdx >= ROUNDS.length - 1) {
            finishClassicWin();
          } else {
            phase = "clear";
            api.play("win");
          }
          return;
        }
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

    if (phase === "menu") {
      for (const m of menuRects) {
        if (inRect(x, y, m.rect)) {
          mode = m.mode;
          roundIdx = 0;
          totalScore = 0;
          retries = 0;
          bombsHitTotal = 0;
          bestCombo = 0;
          time = 0;
          resetRound();
          phase = "intro";
          api.play("tap");
          return;
        }
      }
      return;
    }
    if (phase === "intro") {
      api.play("tap");
      phase = "play";
      return;
    }
    if (phase === "clear") {
      api.play("tap");
      roundIdx++;
      resetRound();
      phase = "intro";
      return;
    }
    if (phase === "retry") {
      api.play("tap");
      retries++;
      resetRound();
      phase = "play";
      return;
    }

    slicing = true;
    lastX = x;
    lastY = y;
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
    if (trail.length > 16) trail.shift();
  }

  function onPointerUp(): void {
    slicing = false;
  }

  // ---- 更新 ----
  function update(rawDt: number): void {
    const scale = hitStop > 0 ? 0.3 : 1;
    hitStop = Math.max(0, hitStop - rawDt);
    const dt = rawDt * scale;
    time += dt;
    shake = Math.max(0, shake - rawDt);

    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= rawDt;
      floats[i].y -= rawDt * 32;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    while (trail.length > 0 && time - trail[0].t > 0.18) trail.shift();
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].life -= dt;
      if (splashes[i].life <= 0) splashes.splice(i, 1);
    }

    if (phase !== "play") return;

    // 连击窗口计时
    if (comboClock > 0) {
      comboClock -= rawDt;
      if (comboClock <= 0) settleCombo();
    }

    // 回合倒计时(经典)
    if (mode === "classic") {
      roundTime -= dt;
      if (roundTime <= 0) {
        settleCombo();
        if (roundScore >= ROUNDS[roundIdx].target) {
          if (roundIdx >= ROUNDS.length - 1) finishClassicWin();
          else {
            phase = "clear";
            api.play("win");
          }
        } else {
          roundFail();
        }
        return;
      }
    }

    // 水果雨
    if (frenzyTimer > 0) {
      frenzyTimer -= dt;
      frenzyLaunch -= dt;
      if (frenzyLaunch <= 0 && flying.length < 12) {
        frenzyLaunch = 0.3;
        launchOne("fruit");
        if (Math.random() < 0.4) launchOne("fruit");
      }
    } else {
      launchTimer -= dt;
      const maxOn = mode === "arcade" ? 8 : ROUNDS[roundIdx].maxOnScreen;
      if (launchTimer <= 0 && flying.length < maxOn) {
        launchTimer = mode === "arcade" ? arcadePace(totalScore).interval : 1.4;
        launchVolley();
      }
    }

    const g = gravityFor(h);
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
  }

  // ---- 绘制 ----
  function drawBomb(f: Flying): void {
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
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
    ctx.arc(f.r * 0.3, -f.r * 0.15, f.r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, f.r * 0.3, f.r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBanana(f: Flying): void {
    // 弯弯的彩虹香蕉,微微发光
    ctx.shadowColor = "#ffe66b";
    ctx.shadowBlur = 18 + Math.sin(time * 8) * 6;
    ctx.fillStyle = "#ffe66b";
    ctx.beginPath();
    ctx.moveTo(-f.r, -f.r * 0.1);
    ctx.quadraticCurveTo(0, f.r * 0.9, f.r, -f.r * 0.1);
    ctx.quadraticCurveTo(f.r * 0.85, f.r * 0.45, 0, f.r * 0.55);
    ctx.quadraticCurveTo(-f.r * 0.85, f.r * 0.45, -f.r, -f.r * 0.1);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 彩虹小弧
    const bands = ["#ff9eb5", "#8fd8c8", "#c9b6f2"];
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = bands[i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -f.r * 0.15, f.r * (0.45 + i * 0.16), Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.fillStyle = "#c8a838";
    ctx.beginPath();
    ctx.arc(-f.r * 0.95, -f.r * 0.1, f.r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFruit(f: Flying): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    if (f.fly === "bomb") {
      drawBomb(f);
      ctx.restore();
      return;
    }
    if (f.fly === "banana") {
      drawBanana(f);
      ctx.restore();
      return;
    }
    const k = f.kind as FruitKind;
    ctx.fillStyle = k.skin;
    ctx.beginPath();
    ctx.arc(0, 0, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7ac97a";
    ctx.beginPath();
    ctx.ellipse(f.r * 0.2, -f.r * 1.02, f.r * 0.3, f.r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(-f.r * 0.3, -f.r * 0.3, f.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
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

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i++) {
      const age = time - trail[i].t;
      const alpha = Math.max(0, 1 - age / 0.18);
      const width = 10 * (i / trail.length) + 2;
      // 外层粉色光晕
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = "#ff9eb5";
      ctx.lineWidth = width + 6;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
      // 内层白色刀光
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function overlayPanel(title: string, sub: string, accent: string, hint = "点一下屏幕继续"): void {
    ctx.fillStyle = "rgba(255,248,240,0.85)";
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
    ctx.fillText(hint, w / 2, h / 2 + 48);
  }

  function drawMenu(): void {
    ctx.fillStyle = "rgba(255,248,240,0.9)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c47a2a";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍑 水果切切乐", w / 2, h * 0.2);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#8a7a5e";
    ctx.fillText("手指划过水果,唰!连切有爆击,小炸弹别碰!", w / 2, h * 0.2 + 34);

    menuRects.length = 0;
    const bw = Math.min(360, w - 60);
    const configs: Array<{ mode: Mode; title: string; sub: string; color: string }> = [
      { mode: "classic", title: "🏅 经典闯关", sub: "三回合,目标分越来越高", color: "#ffb84d" },
      { mode: "arcade", title: "🎪 街机无尽", sub: "越切越快,挑战最高分!", color: "#b28ae8" },
    ];
    for (let i = 0; i < configs.length; i++) {
      const c = configs[i];
      const rect: Rect = { x: (w - bw) / 2, y: h * 0.36 + i * 108, w: bw, h: 88 };
      menuRects.push({ mode: c.mode, rect });
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(c.title, w / 2, rect.y + 32);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#9a9aa8";
      ctx.fillText(c.sub, w / 2, rect.y + 60);
    }
  }

  function draw(): void {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (frenzyTimer > 0) {
      grad.addColorStop(0, "#fff3d6");
      grad.addColorStop(1, "#ffe0ee");
    } else {
      grad.addColorStop(0, "#fdf3e0");
      grad.addColorStop(1, "#ffe6ee");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(-24, -24, w + 48, h + 48);

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

    drawTrail();

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
      ctx.fillStyle = f.color;
      ctx.font = f.big ? "bold 24px sans-serif" : "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ---- HUD ----
    if (phase !== "menu") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.roundRect(10, 10, Math.min(280, w * 0.5), 40, 17);
      ctx.fill();
      ctx.fillStyle = "#c47a2a";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      if (mode === "classic") {
        ctx.fillText(
          `回合 ${roundIdx + 1}/${ROUNDS.length} · 🍑 ${roundScore}/${ROUNDS[roundIdx].target}`,
          24,
          30,
        );
      } else {
        ctx.fillText(`街机模式 · 分 ${totalScore}`, 24, 30);
      }
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a5a6e";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        "💗".repeat(Math.max(0, hearts)) + "🤍".repeat(Math.max(0, HEARTS_PER_ROUND - hearts)),
        w - 12,
        30,
      );

      // 经典模式时间条
      if (mode === "classic" && phase === "play") {
        const tw = Math.min(240, w - 320);
        if (tw > 60) {
          const tx = (w - tw) / 2 + 30;
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.beginPath();
          ctx.roundRect(tx, 16, tw, 12, 6);
          ctx.fill();
          const frac = Math.max(0, roundTime / ROUNDS[roundIdx].time);
          ctx.fillStyle = frac < 0.25 ? "#e05a7a" : "#8fd8c8";
          ctx.beginPath();
          ctx.roundRect(tx, 16, Math.max(12, tw * frac), 12, 6);
          ctx.fill();
        } else {
          ctx.textAlign = "center";
          ctx.fillStyle = roundTime < 10 ? "#e05a7a" : "#5a5a6e";
          ctx.fillText(`${Math.ceil(roundTime)}s`, w / 2, 54);
        }
      }

      if (frenzyTimer > 0) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#e0a030";
        ctx.font = `bold ${20 + Math.sin(time * 10) * 3}px sans-serif`;
        ctx.fillText(`🍌 水果雨 ×${FRENZY_MULTIPLIER} ${Math.ceil(frenzyTimer)}s`, w / 2, 70);
      }
    }

    // ---- 覆盖层 ----
    if (phase === "menu") {
      drawMenu();
    } else if (phase === "intro") {
      if (mode === "classic") {
        const r = ROUNDS[roundIdx];
        overlayPanel(
          `第 ${roundIdx + 1} 回合 · ${r.name}`,
          `${r.time} 秒内切到 ${r.target} 分!连切有爆击加分`,
          "#ffb84d",
          "点一下开始,唰唰唰!",
        );
      } else {
        overlayPanel(
          "街机无尽模式",
          "没有时间限制,3 颗心用完为止,冲高分!",
          "#b28ae8",
          "点一下开始,唰唰唰!",
        );
      }
    } else if (phase === "clear") {
      overlayPanel(
        `${ROUNDS[roundIdx].name} 完成!`,
        `本回合 ${roundScore} 分 · 总分 ${totalScore}`,
        "#4a9a5a",
      );
    } else if (phase === "retry") {
      overlayPanel("差一点点……", "没关系!点一下重切这一回合", "#b28ae8");
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
