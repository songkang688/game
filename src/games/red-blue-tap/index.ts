/**
 * 红蓝点点 red-blue-tap
 * 红蓝气球从天上飘下来,只点指定颜色:点对 +1,点错 -1。
 * 30 秒倒计时结束后按得分结算星星。
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
  id: "red-blue-tap",
  title: "红蓝点点",
  emoji: "🎈",
  category: "party" as const,
  color: "#4dabf7",
  blurb: "红蓝气球飘下来,只点对的颜色!眼明手快得高分!",
};

const ROUND_MS = 30_000;

const STYLE = `
.rbt-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#c5f0ff,#e8f9ff);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.rbt-hud{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;align-items:center;
  gap:8px;padding:10px 14px;pointer-events:none;}
.rbt-pill{background:#fffd;border-radius:999px;padding:8px 16px;font-size:17px;font-weight:900;
  color:#1d5b80;box-shadow:0 3px 8px #0002;}
.rbt-target{margin-left:auto;}
.rbt-field{position:absolute;inset:0;overflow:hidden;}
.rbt-balloon{position:absolute;top:-90px;width:64px;height:78px;border-radius:50% 50% 48% 48%;
  display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;
  box-shadow:inset -6px -8px 0 #0002;will-change:transform;touch-action:manipulation;}
.rbt-balloon::after{content:"";position:absolute;bottom:-16px;left:50%;width:2px;height:16px;
  background:#8888;transform:translateX(-50%);}
.rbt-balloon-red{background:radial-gradient(circle at 35% 30%,#ffa8a8,#fa5252);}
.rbt-balloon-blue{background:radial-gradient(circle at 35% 30%,#a5d8ff,#339af0);}
.rbt-pop{animation:rbtPop .25s ease forwards;}
@keyframes rbtPop{0%{transform:scale(1)}60%{transform:scale(1.35)}100%{transform:scale(0);opacity:0}}
.rbt-bad{animation:rbtBad .3s ease forwards;}
@keyframes rbtBad{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}
  75%{transform:translateX(8px)}100%{transform:scale(.6);opacity:0}}
.rbt-float{position:absolute;z-index:9;font-size:24px;font-weight:900;pointer-events:none;
  animation:rbtFloat .7s ease forwards;}
@keyframes rbtFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-46px)}}
.rbt-cover{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;background:#e8f9ffee;text-align:center;padding:20px;}
.rbt-cover-title{font-size:30px;font-weight:900;color:#1d5b80;}
.rbt-cover-sub{font-size:19px;font-weight:800;color:#4a7a95;line-height:1.6;}
.rbt-demo{font-size:52px;}
.rbt-start{border:none;border-radius:24px;padding:16px 48px;font-size:22px;font-weight:900;color:#fff;
  background:#ff922b;cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;}
.rbt-start:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.rbt-result-big{font-size:56px;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let running = false;
  let score = 0;
  let timeLeft = ROUND_MS;
  const target: "red" | "blue" = Math.random() < 0.5 ? "red" : "blue";
  let raf = 0;
  let lastTs = 0;
  let spawnCooldown = 0;
  let elapsed = 0;

  interface Balloon {
    el: HTMLElement;
    y: number;
    speed: number;
    color: "red" | "blue";
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

  const targetName = (): string => (target === "red" ? "红色" : "蓝色");

  const wrap = document.createElement("div");
  wrap.className = "rbt-wrap";
  wrap.innerHTML = `
    <style>${STYLE}</style>
    <div class="rbt-field"></div>
    <div class="rbt-hud">
      <div class="rbt-pill rbt-time">⏰ 30</div>
      <div class="rbt-pill rbt-score">得分 0</div>
      <div class="rbt-pill rbt-target"></div>
    </div>
    <div class="rbt-cover">
      <div class="rbt-cover-title">🎈 红蓝点点</div>
      <div class="rbt-demo">${target === "red" ? "🔴" : "🔵"}</div>
      <div class="rbt-cover-sub">这一局只点 <b>${targetName()}</b> 气球!<br>点对 +1 分,点错 -1 分哦</div>
      <button class="rbt-start">开始!</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const field = q<HTMLElement>(".rbt-field");
  const timeEl = q<HTMLElement>(".rbt-time");
  const scoreEl = q<HTMLElement>(".rbt-score");
  const targetEl = q<HTMLElement>(".rbt-target");
  const cover = q<HTMLElement>(".rbt-cover");
  targetEl.textContent = `只点${targetName()} ${target === "red" ? "🔴" : "🔵"}`;

  function setScore(n: number): void {
    score = Math.max(0, n);
    scoreEl.textContent = `得分 ${score}`;
  }

  function floatText(x: number, y: number, text: string, color: string): void {
    const f = document.createElement("div");
    f.className = "rbt-float";
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.style.color = color;
    field.appendChild(f);
    after(700, () => f.remove());
  }

  function spawn(): void {
    const color: "red" | "blue" = Math.random() < 0.5 ? "red" : "blue";
    const el = document.createElement("div");
    el.className = `rbt-balloon rbt-balloon-${color}`;
    el.textContent = color === "red" ? "🐹" : "🐧";
    const x = 6 + Math.random() * 78;
    el.style.left = `${x}%`;
    const b: Balloon = {
      el,
      y: -90,
      speed: 90 + Math.random() * 55 + elapsed / 700,
      color,
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
      if (b.color === target) {
        play("pop");
        setScore(score + 1);
        el.classList.add("rbt-pop");
        floatText(fx, fy, "+1", "#2b8a3e");
      } else {
        play("oops");
        setScore(score - 1);
        el.classList.add("rbt-bad");
        floatText(fx, fy, "-1", "#e03131");
      }
      after(300, () => el.remove());
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
      // 越到后面出球越快:750ms → 420ms
      spawnCooldown = Math.max(420, 750 - elapsed / 60) + Math.random() * 120;
    }

    const fieldH = field.clientHeight || 600;
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.dead) {
        balloons.splice(i, 1);
        continue;
      }
      b.y += (b.speed * dt) / 1000;
      b.el.style.transform = `translateY(${b.y}px)`;
      if (b.y > fieldH + 40) {
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
    result.className = "rbt-cover";
    const stars: 0 | 1 | 2 | 3 =
      score >= 16 ? 3 : score >= 10 ? 2 : score >= 5 ? 1 : 0;
    result.innerHTML = `
      <div class="rbt-result-big">${stars > 0 ? "🎉" : "💪"}</div>
      <div class="rbt-cover-title">得了 ${score} 分!</div>
      <div class="rbt-cover-sub">${"⭐".repeat(stars) || "还差一点点"}</div>`;
    wrap.appendChild(result);
    after(1000, () => {
      if (stars !== 0) onWin(stars, `${score} 分,${targetName()}小达人!`);
      else onLose("再练一练,下次一定行!");
    });
  }

  q<HTMLButtonElement>(".rbt-start").addEventListener("pointerdown", (e) => {
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
