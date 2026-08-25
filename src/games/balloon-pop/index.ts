/**
 * 气球砰砰 balloon-pop
 * 五个阶段的气球雨!每阶段 25 秒达成目标分数。
 * 连击越高加分越多,🌈 彩虹气球能赶跑全场乌云球!
 */

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (n: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

export const meta = {
  id: "balloon-pop",
  title: "气球砰砰",
  emoji: "🎈",
  category: "casual" as const,
  color: "#ff8fab",
  blurb: "五阶段气球雨！连击加分，彩虹气球赶跑乌云球！",
};

const STAGE_MS = 25_000;

interface StageConfig {
  target: number;
  cloudChance: number;
  goldChance: number;
  rainbowChance: number;
}

const STAGES: StageConfig[] = [
  { target: 12, cloudChance: 0.1, goldChance: 0.1, rainbowChance: 0 },
  { target: 16, cloudChance: 0.14, goldChance: 0.1, rainbowChance: 0.04 },
  { target: 20, cloudChance: 0.16, goldChance: 0.1, rainbowChance: 0.05 },
  { target: 24, cloudChance: 0.18, goldChance: 0.11, rainbowChance: 0.05 },
  { target: 28, cloudChance: 0.2, goldChance: 0.12, rainbowChance: 0.06 },
];

const COLORS = [
  "radial-gradient(circle at 35% 30%,#ffa8a8,#fa5252)",
  "radial-gradient(circle at 35% 30%,#a5d8ff,#339af0)",
  "radial-gradient(circle at 35% 30%,#ffe08a,#fab005)",
  "radial-gradient(circle at 35% 30%,#b2f2bb,#40c057)",
  "radial-gradient(circle at 35% 30%,#fcc2d7,#f06595)",
];

const STYLE = `
.bp-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#bde8ff,#e7f9ff 70%,#d3f9d8);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.bp-hud{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;gap:6px;
  padding:10px 12px;pointer-events:none;flex-wrap:wrap;}
.bp-pill{background:#fffd;border-radius:999px;padding:7px 13px;font-size:15px;font-weight:900;
  color:#1d5b80;box-shadow:0 3px 8px #0002;}
.bp-combo{color:#e8590c;}
.bp-field{position:absolute;inset:0;overflow:hidden;}
.bp-cloud{position:absolute;font-size:44px;opacity:.8;pointer-events:none;}
.bp-balloon{position:absolute;bottom:-110px;display:flex;align-items:center;justify-content:center;
  border-radius:50% 50% 48% 48%;cursor:pointer;box-shadow:inset -6px -8px 0 #0002;
  will-change:transform;touch-action:manipulation;font-size:24px;}
.bp-balloon::after{content:"";position:absolute;bottom:-15px;left:50%;width:2px;height:15px;
  background:#8888;transform:translateX(-50%);}
.bp-gold{box-shadow:inset -6px -8px 0 #0003,0 0 18px #ffd43bcc;}
.bp-rainbow{box-shadow:inset -6px -8px 0 #0003,0 0 20px #b197fccc;animation:bpHue 2s linear infinite;}
@keyframes bpHue{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}
.bp-pop{animation:bpPop .22s ease forwards;}
@keyframes bpPop{0%{transform:scale(1)}55%{transform:scale(1.4)}100%{transform:scale(0);opacity:0}}
.bp-shake{animation:bpShake .3s ease;}
@keyframes bpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}
.bp-bits{position:absolute;z-index:9;pointer-events:none;font-size:20px;animation:bpBits .5s ease forwards;}
@keyframes bpBits{0%{opacity:1;transform:scale(.6)}100%{opacity:0;transform:scale(1.8)}}
.bp-float{position:absolute;z-index:9;font-size:24px;font-weight:900;pointer-events:none;
  animation:bpFloat .7s ease forwards;}
@keyframes bpFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-46px)}}
.bp-cover{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;background:#e7f9ffee;text-align:center;padding:20px;}
.bp-cover-title{font-size:28px;font-weight:900;color:#1d5b80;}
.bp-cover-sub{font-size:17px;font-weight:800;color:#4a7a95;line-height:1.7;}
.bp-start{border:none;border-radius:24px;padding:15px 44px;font-size:21px;font-weight:900;color:#fff;
  background:#f06595;cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;}
.bp-start:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.bp-result-big{font-size:56px;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin } = api;
  let alive = true;
  let running = false;
  let stage = 0;
  let retries = 0;
  let score = 0;
  let combo = 0;
  let timeLeft = STAGE_MS;
  let raf = 0;
  let lastTs = 0;
  let spawnCooldown = 0;
  let elapsed = 0;

  interface Balloon {
    el: HTMLElement;
    y: number;
    speed: number;
    sway: number;
    swaySeed: number;
    kind: "normal" | "gold" | "cloud" | "rainbow";
    dead: boolean;
  }
  const balloons: Balloon[] = [];

  const timers = new Set<number>();
  const after = (ms: number, fn: () => void): number => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const wrap = document.createElement("div");
  wrap.className = "bp-wrap";
  wrap.innerHTML = `
    <style>${STYLE}</style>
    <div class="bp-field">
      <span class="bp-cloud" style="left:8%;top:12%">☁️</span>
      <span class="bp-cloud" style="right:12%;top:22%">☁️</span>
    </div>
    <div class="bp-hud" style="display:none">
      <div class="bp-pill bp-stage">阶段 1/5</div>
      <div class="bp-pill bp-time">⏰ 25</div>
      <div class="bp-pill bp-score">🎯 0 / 12</div>
      <div class="bp-pill bp-combo">🔥 x0</div>
    </div>
    <div class="bp-cover">
      <div class="bp-cover-title">🎈 气球砰砰 · 五阶段挑战</div>
      <div class="bp-cover-sub">每个阶段 25 秒,达到目标分就过关!<br>连击越高加分越多 🔥<br>⭐ 金星 +3 · 🌈 彩虹赶跑乌云 · 🌩️ 乌云 -2 还会断连击</div>
      <button class="bp-start">开始!</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const field = q<HTMLElement>(".bp-field");
  const hud = q<HTMLElement>(".bp-hud");
  const stageEl = q<HTMLElement>(".bp-stage");
  const timeEl = q<HTMLElement>(".bp-time");
  const scoreEl = q<HTMLElement>(".bp-score");
  const comboEl = q<HTMLElement>(".bp-combo");
  const cover = q<HTMLElement>(".bp-cover");

  function cfg(): StageConfig {
    return STAGES[stage];
  }

  function renderHud(): void {
    stageEl.textContent = `阶段 ${stage + 1}/${STAGES.length}`;
    scoreEl.textContent = `🎯 ${score} / ${cfg().target}`;
    comboEl.textContent = `🔥 x${combo}`;
  }

  function setScore(n: number): void {
    score = Math.max(0, n);
    renderHud();
  }

  function floatText(x: number, y: number, text: string, color: string): void {
    const f = document.createElement("div");
    f.className = "bp-float";
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.style.color = color;
    field.appendChild(f);
    after(700, () => f.remove());
  }

  function burst(x: number, y: number, emoji: string): void {
    const b = document.createElement("div");
    b.className = "bp-bits";
    b.textContent = emoji;
    b.style.left = `${x - 10}px`;
    b.style.top = `${y}px`;
    field.appendChild(b);
    after(500, () => b.remove());
  }

  function comboBonus(): number {
    return combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
  }

  function spawn(): void {
    const c = cfg();
    const r = Math.random();
    let kind: Balloon["kind"] = "normal";
    if (r < c.rainbowChance) kind = "rainbow";
    else if (r < c.rainbowChance + c.goldChance) kind = "gold";
    else if (r < c.rainbowChance + c.goldChance + c.cloudChance) kind = "cloud";
    const el = document.createElement("div");
    el.className = "bp-balloon";
    const size = kind === "gold" || kind === "rainbow" ? 60 : 56 + Math.random() * 26;
    el.style.width = `${size}px`;
    el.style.height = `${size * 1.22}px`;
    if (kind === "gold") {
      el.classList.add("bp-gold");
      el.style.background = "radial-gradient(circle at 35% 30%,#fff3bf,#ffd43b)";
      el.textContent = "⭐";
    } else if (kind === "rainbow") {
      el.classList.add("bp-rainbow");
      el.style.background = "conic-gradient(#fa5252,#fab005,#40c057,#339af0,#b197fc,#fa5252)";
      el.textContent = "🌈";
    } else if (kind === "cloud") {
      el.style.background = "radial-gradient(circle at 35% 30%,#ced4da,#868e96)";
      el.textContent = "🌩️";
    } else {
      el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    el.style.left = `${5 + Math.random() * 80}%`;
    const b: Balloon = {
      el,
      y: 0,
      speed: (kind === "gold" || kind === "rainbow" ? 130 : 85) + Math.random() * 55 + elapsed / 600,
      sway: 8 + Math.random() * 14,
      swaySeed: Math.random() * Math.PI * 2,
      kind,
      dead: false,
    };
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!running || b.dead) return;
      b.dead = true;
      const rect = el.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const fx = rect.left - fieldRect.left + rect.width / 2;
      const fy = rect.top - fieldRect.top;
      el.classList.add("bp-pop");
      if (b.kind === "gold") {
        combo++;
        const gain = 3 + comboBonus();
        play("coin");
        setScore(score + gain);
        floatText(fx, fy, `+${gain}`, "#e8590c");
        burst(fx, fy, "✨");
      } else if (b.kind === "rainbow") {
        combo++;
        let cleared = 0;
        for (const other of balloons) {
          if (!other.dead && other.kind === "cloud") {
            other.dead = true;
            other.el.classList.add("bp-pop");
            const oid = other.el;
            after(250, () => oid.remove());
            cleared++;
          }
        }
        const gain = 5 + comboBonus();
        play("coin");
        setScore(score + gain);
        floatText(fx, fy, `+${gain} 🌈`, "#7048e8");
        burst(fx, fy, "🌈");
        if (cleared > 0) floatText(fx, fy + 30, `乌云跑光啦!`, "#4a7a95");
      } else if (b.kind === "cloud") {
        combo = 0;
        play("oops");
        setScore(score - 2);
        floatText(fx, fy, "-2", "#e03131");
        wrap.classList.remove("bp-shake");
        void wrap.offsetWidth;
        wrap.classList.add("bp-shake");
      } else {
        combo++;
        const gain = 1 + comboBonus();
        play("pop");
        setScore(score + gain);
        floatText(fx, fy, `+${gain}`, "#2b8a3e");
        burst(fx, fy, "💥");
        if (combo === 10) {
          api.addStars(1);
          floatText(fx, fy + 30, "🔥 十连击，奖励一颗小星星!", "#e8590c");
        }
      }
      after(250, () => el.remove());
    });
    field.appendChild(el);
    balloons.push(b);
  }

  function tick(ts: number): void {
    if (!alive || !running) return;
    if (lastTs === 0) lastTs = ts;
    const dt = Math.min(50, ts - lastTs);
    lastTs = ts;
    elapsed += dt;
    timeLeft -= dt;
    timeEl.textContent = `⏰ ${Math.max(0, Math.ceil(timeLeft / 1000))}`;

    spawnCooldown -= dt;
    if (spawnCooldown <= 0) {
      spawn();
      spawnCooldown = Math.max(380, 700 - elapsed / 55) + Math.random() * 120;
    }

    const fieldH = field.clientHeight || 600;
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.dead) {
        balloons.splice(i, 1);
        continue;
      }
      b.y += (b.speed * dt) / 1000;
      const swayX = Math.sin(b.swaySeed + elapsed / 500) * b.sway;
      b.el.style.transform = `translate(${swayX}px,${-b.y}px)`;
      if (b.y > fieldH + 130) {
        b.dead = true;
        b.el.remove();
        balloons.splice(i, 1);
      }
    }

    if (timeLeft <= 0) {
      endStage();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function clearField(): void {
    balloons.forEach((b) => b.el.remove());
    balloons.length = 0;
  }

  function endStage(): void {
    running = false;
    cancelAnimationFrame(raf);
    clearField();
    const passed = score >= cfg().target;
    const result = document.createElement("div");
    result.className = "bp-cover";
    if (passed && stage >= STAGES.length - 1) {
      result.innerHTML = `
        <div class="bp-result-big">👑</div>
        <div class="bp-cover-title">五个阶段全部通过!</div>
        <div class="bp-cover-sub">最终得了 ${score} 分,气球小猎手就是你!</div>`;
      wrap.appendChild(result);
      play("win");
      const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
      after(1100, () => onWin(stars, `五阶段气球雨全部达标，砰砰砰太棒啦!`));
    } else if (passed) {
      result.innerHTML = `
        <div class="bp-result-big">🎊</div>
        <div class="bp-cover-title">阶段 ${stage + 1} 达标!得了 ${score} 分</div>
        <div class="bp-cover-sub">下一阶段目标更高、乌云更多,加油!</div>
        <button class="bp-start">下一阶段 ▶</button>`;
      wrap.appendChild(result);
      play("win");
      (result.querySelector(".bp-start") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
        e.preventDefault();
        play("jump");
        result.remove();
        stage++;
        startStage();
      });
    } else {
      result.innerHTML = `
        <div class="bp-result-big">💪</div>
        <div class="bp-cover-title">差一点点!得了 ${score} 分</div>
        <div class="bp-cover-sub">目标是 ${cfg().target} 分,这个阶段再来一次!</div>
        <button class="bp-start">🔁 重试本阶段</button>`;
      wrap.appendChild(result);
      play("oops");
      (result.querySelector(".bp-start") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
        e.preventDefault();
        play("tap");
        result.remove();
        retries++;
        startStage();
      });
    }
  }

  function startStage(): void {
    score = 0;
    combo = 0;
    elapsed = 0;
    timeLeft = STAGE_MS;
    spawnCooldown = 0;
    hud.style.display = "";
    renderHud();
    timeEl.textContent = "⏰ 25";
    running = true;
    lastTs = 0;
    raf = requestAnimationFrame(tick);
  }

  q<HTMLButtonElement>(".bp-start").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (running) return;
    play("jump");
    cover.style.display = "none";
    startStage();
  });

  return {
    destroy() {
      alive = false;
      running = false;
      cancelAnimationFrame(raf);
      timers.forEach((id) => {
        clearTimeout(id);
        clearInterval(id);
      });
      timers.clear();
      wrap.remove();
    },
  };
}
