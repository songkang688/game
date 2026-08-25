/**
 * 红蓝点点 red-blue-tap —— 红蓝运动会第二项
 * 和小电脑比赛点气球,三局两胜(BO3)!
 * 每回合 20 秒,只点目标颜色:点对 +1,点错 -1。
 * 小电脑有简单/普通两档,回合结束比分高的拿下一局。
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
  blurb: "红蓝运动会·点点!和小电脑三局两胜比手速!",
};

const ROUND_MS = 20_000;
const TOTAL_ROUNDS = 3;

const STYLE = `
.rbt-wrap{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;
  background:linear-gradient(#c5f0ff,#e8f9ff);font-family:"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.rbt-hud{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;align-items:center;
  gap:6px;padding:10px 12px;pointer-events:none;flex-wrap:wrap;}
.rbt-pill{background:#fffd;border-radius:999px;padding:7px 13px;font-size:15px;font-weight:900;
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
.rbt-cover{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;gap:13px;
  align-items:center;justify-content:center;background:#e8f9ffee;text-align:center;padding:20px;}
.rbt-cover-title{font-size:28px;font-weight:900;color:#1d5b80;}
.rbt-cover-sub{font-size:17px;font-weight:800;color:#4a7a95;line-height:1.6;}
.rbt-demo{font-size:48px;}
.rbt-start{border:none;border-radius:24px;padding:14px 40px;font-size:20px;font-weight:900;color:#fff;
  cursor:pointer;box-shadow:0 6px 0 #0003;font-family:inherit;touch-action:manipulation;min-width:240px;}
.rbt-start:active{transform:translateY(4px);box-shadow:0 2px 0 #0003;}
.rbt-start-easy{background:#51cf66;}
.rbt-start-normal{background:#ff922b;}
.rbt-result-big{font-size:56px;}
`;

type Difficulty = "easy" | "normal";

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin, onLose } = api;
  let alive = true;
  let running = false;
  let difficulty: Difficulty = "easy";
  let round = 1;
  let myWins = 0;
  let aiWins = 0;
  let score = 0;
  let aiScore = 0;
  let aiCarry = 0;
  let timeLeft = ROUND_MS;
  let target: "red" | "blue" = Math.random() < 0.5 ? "red" : "blue";
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
    <div class="rbt-hud" style="display:none">
      <div class="rbt-pill rbt-round">第 1 局</div>
      <div class="rbt-pill rbt-time">⏰ 20</div>
      <div class="rbt-pill rbt-score">我 0 : 0 🤖</div>
      <div class="rbt-pill rbt-target"></div>
    </div>
    <div class="rbt-cover">
      <div class="rbt-cover-title">🎈 红蓝点点 · 三局两胜</div>
      <div class="rbt-demo">🎈🆚🤖</div>
      <div class="rbt-cover-sub">每局 20 秒,只点目标颜色的气球!<br>点对 +1,点错 -1,比小电脑分高就赢一局</div>
      <button class="rbt-start rbt-start-easy">🤖 小电脑 · 简单</button>
      <button class="rbt-start rbt-start-normal">🤖 小电脑 · 普通</button>
    </div>`;
  root.appendChild(wrap);

  const q = <T extends Element>(sel: string): T => wrap.querySelector(sel) as T;
  const field = q<HTMLElement>(".rbt-field");
  const hud = q<HTMLElement>(".rbt-hud");
  const roundEl = q<HTMLElement>(".rbt-round");
  const timeEl = q<HTMLElement>(".rbt-time");
  const scoreEl = q<HTMLElement>(".rbt-score");
  const targetEl = q<HTMLElement>(".rbt-target");
  const cover = q<HTMLElement>(".rbt-cover");

  function renderHud(): void {
    roundEl.textContent = `第 ${round} 局(${myWins}胜${aiWins}负)`;
    scoreEl.textContent = `我 ${score} : ${aiScore} 🤖`;
    targetEl.textContent = `只点${targetName()} ${target === "red" ? "🔴" : "🔵"}`;
  }

  function setScore(n: number): void {
    score = Math.max(0, n);
    renderHud();
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

    // 小电脑得分:简单约 6 分/局,普通约 11 分/局
    const rate = difficulty === "easy" ? 0.3 : 0.55;
    aiCarry += (rate * dt) / 1000;
    if (aiCarry >= 1) {
      const gain = Math.floor(aiCarry);
      aiCarry -= gain;
      aiScore += gain;
      renderHud();
    }

    spawnCooldown -= dt;
    if (spawnCooldown <= 0) {
      spawn();
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

  function clearField(): void {
    balloons.forEach((b) => b.el.remove());
    balloons.length = 0;
  }

  function endRound(): void {
    running = false;
    cancelAnimationFrame(raf);
    clearField();

    const result = document.createElement("div");
    result.className = "rbt-cover";
    if (score > aiScore) myWins++;
    else if (aiScore > score) aiWins++;

    const matchOver = myWins >= 2 || aiWins >= 2 || round >= TOTAL_ROUNDS;
    if (!matchOver) {
      const title = score > aiScore ? "这一局你赢啦!" : score < aiScore ? "这局小电脑快了一步" : "平局!不分胜负";
      result.innerHTML = `
        <div class="rbt-result-big">${score > aiScore ? "🎉" : score < aiScore ? "🤖" : "🤝"}</div>
        <div class="rbt-cover-title">${title}</div>
        <div class="rbt-cover-sub">本局 ${score} : ${aiScore}<br>大比分 我 ${myWins} : ${aiWins} 🤖</div>
        <button class="rbt-start rbt-start-normal">下一局!</button>`;
      wrap.appendChild(result);
      play(score > aiScore ? "win" : "oops");
      (result.querySelector(".rbt-start") as HTMLButtonElement).addEventListener("pointerdown", (e) => {
        e.preventDefault();
        play("jump");
        result.remove();
        round++;
        startRound();
      });
    } else {
      const iWon = myWins > aiWins;
      result.innerHTML = `
        <div class="rbt-result-big">${iWon ? "🏆" : "💪"}</div>
        <div class="rbt-cover-title">${iWon ? "你赢得点点比赛!" : "小电脑这次赢了"}</div>
        <div class="rbt-cover-sub">大比分 我 ${myWins} : ${aiWins} 🤖</div>`;
      wrap.appendChild(result);
      play(iWon ? "win" : "oops");
      after(1100, () => {
        if (iWon) {
          const stars: 1 | 2 | 3 = difficulty === "normal" ? 3 : aiWins === 0 ? 3 : 2;
          onWin(stars, `${myWins}:${aiWins} 战胜小电脑，点点小冠军!`);
        } else {
          onLose(`${myWins}:${aiWins} 惜败，换个颜色再来挑战!`);
        }
      });
    }
  }

  function startRound(): void {
    score = 0;
    aiScore = 0;
    aiCarry = 0;
    elapsed = 0;
    timeLeft = ROUND_MS;
    spawnCooldown = 0;
    target = Math.random() < 0.5 ? "red" : "blue";
    hud.style.display = "";
    renderHud();
    timeEl.textContent = "⏰ 20";
    running = true;
    lastTs = 0;
    raf = requestAnimationFrame(tick);
  }

  function pickMode(d: Difficulty): void {
    difficulty = d;
    myWins = aiWins = 0;
    round = 1;
    play("jump");
    cover.style.display = "none";
    startRound();
  }

  q<HTMLButtonElement>(".rbt-start-easy").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (running) return;
    pickMode("easy");
  });
  q<HTMLButtonElement>(".rbt-start-normal").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (running) return;
    pickMode("normal");
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
