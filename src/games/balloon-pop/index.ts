/**
 * 气球砰砰 balloon-pop
 * 彩色气球从下往上飘,点一下就"砰"地爆开:普通 +1,金星气球 +3。
 * 小心灰色乌云球,点到会 -2。30 秒结束按得分给星星。
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
  blurb: "彩色气球飘起来,砰砰砰全点爆!金星气球加大分!",
};

const ROUND_MS = 30_000;

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
.bp-hud{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;gap:8px;
  padding:10px 14px;pointer-events:none;}
.bp-pill{background:#fffd;border-radius:999px;padding:8px 16px;font-size:17px;font-weight:900;
  color:#1d5b80;box-shadow:0 3px 8px #0002;}
.bp-score{margin-left:auto;}
.bp-field{position:absolute;inset:0;overflow:hidden;}
.bp-cloud{position:absolute;font-size:44px;opacity:.8;pointer-events:none;}
.bp-balloon{position:absolute;bottom:-110px;display:flex;align-items:center;justify-content:center;
  border-radius:50% 50% 48% 48%;cursor:pointer;box-shadow:inset -6px -8px 0 #0002;
  will-change:transform;touch-action:manipulation;font-size:24px;}
.bp-balloon::after{content:"";position:absolute;bottom:-15px;left:50%;width:2px;height:15px;
  background:#8888;transform:translateX(-50%);}
.bp-gold{box-shadow:inset -6px -8px 0 #0003,0 0 18px #ffd43bcc;}
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
.bp-cover-title{font-size:30px;font-weight:900;color:#1d5b80;}
.bp-cover-sub{font-size:18px;font-weight:800;color:#4a7a95;line-height:1.7;}
.bp-start{border:none;border-radius:24px;padding:16px 48px;font-size:22px;font-weight:900;color:#fff;
  background:#f06595;cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;}
.bp-start:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.bp-result-big{font-size:56px;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let running = false;
  let score = 0;
  let timeLeft = ROUND_MS;
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
    kind: "normal" | "gold" | "cloud";
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
    <div class="bp-hud">
      <div class="bp-pill bp-time">⏰ 30</div>
      <div class="bp-pill bp-score">得分 0</div>
    </div>
    <div class="bp-cover">
      <div class="bp-cover-title">🎈 气球砰砰</div>
      <div class="bp-cover-sub">点爆气球 +1 分<br>⭐ 金星气球 +3 分<br>🌩️ 乌云球不要点,会 -2 分!</div>
      <button class="bp-start">开始!</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const field = q<HTMLElement>(".bp-field");
  const timeEl = q<HTMLElement>(".bp-time");
  const scoreEl = q<HTMLElement>(".bp-score");
  const cover = q<HTMLElement>(".bp-cover");

  function setScore(n: number): void {
    score = Math.max(0, n);
    scoreEl.textContent = `得分 ${score}`;
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

  function spawn(): void {
    const r = Math.random();
    const kind: Balloon["kind"] = r < 0.1 ? "gold" : r < 0.24 ? "cloud" : "normal";
    const el = document.createElement("div");
    el.className = "bp-balloon";
    const size = kind === "gold" ? 60 : 56 + Math.random() * 26;
    el.style.width = `${size}px`;
    el.style.height = `${size * 1.22}px`;
    if (kind === "gold") {
      el.classList.add("bp-gold");
      el.style.background = "radial-gradient(circle at 35% 30%,#fff3bf,#ffd43b)";
      el.textContent = "⭐";
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
      speed: (kind === "gold" ? 130 : 85) + Math.random() * 55 + elapsed / 600,
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
        play("coin");
        setScore(score + 3);
        floatText(fx, fy, "+3", "#e8590c");
        burst(fx, fy, "✨");
      } else if (b.kind === "cloud") {
        play("oops");
        setScore(score - 2);
        floatText(fx, fy, "-2", "#e03131");
        wrap.classList.remove("bp-shake");
        void wrap.offsetWidth;
        wrap.classList.add("bp-shake");
      } else {
        play("pop");
        setScore(score + 1);
        floatText(fx, fy, "+1", "#2b8a3e");
        burst(fx, fy, "💥");
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
      endRound();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function endRound(): void {
    running = false;
    cancelAnimationFrame(raf);
    balloons.forEach((b) => b.el.remove());
    balloons.length = 0;
    const result = document.createElement("div");
    result.className = "bp-cover";
    const stars: 0 | 1 | 2 | 3 =
      score >= 22 ? 3 : score >= 14 ? 2 : score >= 7 ? 1 : 0;
    result.innerHTML = `
      <div class="bp-result-big">${stars > 0 ? "🎊" : "💪"}</div>
      <div class="bp-cover-title">砰砰砰!得了 ${score} 分</div>
      <div class="bp-cover-sub">${"⭐".repeat(stars) || "再来一次,一定更棒"}</div>`;
    wrap.appendChild(result);
    after(1000, () => {
      if (stars !== 0) onWin(stars, `${score} 分,气球小猎手!`);
      else onLose("手再快一点点就赢啦!");
    });
  }

  q<HTMLButtonElement>(".bp-start").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (running) return;
    play("jump");
    cover.style.display = "none";
    running = true;
    lastTs = 0;
    raf = requestAnimationFrame(tick);
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
