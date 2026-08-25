export const meta = {
  id: "mole-pop",
  title: "地鼠嘭嘭",
  emoji: "🐹",
  category: "casual" as const,
  color: "#EBDFC8",
  blurb: "五关打地鼠！金地鼠加大分，瞌睡地鼠慢慢拍，小兔子别碰哦！",
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

const HOLES = 9;

interface LevelConfig {
  seconds: number;
  target: number;
  spawnMs: number;
  /** 出金地鼠概率 */
  gold: number;
  /** 出瞌睡地鼠概率 */
  sleepy: number;
  /** 出小兔子概率 */
  bunny: number;
}

const LEVELS: LevelConfig[] = [
  { seconds: 25, target: 8, spawnMs: 750, gold: 0, sleepy: 0, bunny: 0.15 },
  { seconds: 25, target: 11, spawnMs: 700, gold: 0.08, sleepy: 0, bunny: 0.18 },
  { seconds: 28, target: 14, spawnMs: 650, gold: 0.1, sleepy: 0.12, bunny: 0.2 },
  { seconds: 28, target: 17, spawnMs: 600, gold: 0.1, sleepy: 0.12, bunny: 0.22 },
  { seconds: 30, target: 20, spawnMs: 540, gold: 0.12, sleepy: 0.14, bunny: 0.24 },
];

type HoleState = "" | "mole" | "gold" | "sleepy" | "bunny";

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let destroyed = false;
  let running = false;

  let level = 0;
  let retries = 0;
  let score = 0;
  let timeLeft = 0;

  const holeState: HoleState[] = new Array(HOLES).fill("");

  const wrap = document.createElement("div");
  wrap.className = "mp-wrap";
  wrap.innerHTML = `
    <style>
      .mp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #F2FBE8, #FBF3DE); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; position: relative; }
      .mp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
      .mp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #8B9A46; box-shadow: 0 2px 6px rgba(150,170,90,.25); font-size: 14px; }
      .mp-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
      .mp-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #C9E28A, #8FCB5E); border-radius: 8px; transition: width .3s; }
      .mp-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .mp-hole { aspect-ratio: 1; border: none; border-radius: 50% 50% 42% 42%; background: radial-gradient(circle at 50% 65%, #B8926A 0%, #96714C 60%, #7C5C3D 100%); font-size: clamp(30px, 10vw, 48px); cursor: pointer; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; padding: 0 0 6px; box-shadow: inset 0 6px 10px rgba(60,40,20,.4); }
      .mp-hole span { display: block; transform: translateY(110%); transition: transform .16s ease-out; }
      .mp-hole.mp-up span { transform: translateY(0); }
      .mp-hole:active { filter: brightness(1.08); }
      .mp-msg { text-align: center; min-height: 22px; color: #8B9A46; font-weight: 700; margin-top: 10px; font-size: 15px; }
      .mp-overlay { position: absolute; inset: 0; background: rgba(250,252,238,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .mp-ov-big { font-size: 52px; }
      .mp-ov-title { font-size: 24px; font-weight: 900; color: #8B9A46; }
      .mp-ov-sub { font-size: 16px; font-weight: 700; color: #A3B060; line-height: 1.6; }
      .mp-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#B3D96E,#8CBB43); cursor: pointer; box-shadow: 0 5px 0 #6D9630; font-family: inherit; }
      .mp-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #6D9630; }
    </style>
    <div class="mp-top">
      <span class="mp-badge mp-level">🚩 第 1 关</span>
      <span class="mp-badge mp-score">⭐ 0 / 8</span>
      <span class="mp-badge mp-time">⏰ 25 秒</span>
    </div>
    <div class="mp-bar"><div class="mp-fill"></div></div>
    <div class="mp-board"></div>
    <div class="mp-msg">点小地鼠 🐹 得分，小兔子 🐰 不要点哦！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".mp-board") as HTMLElement;
  const levelEl = wrap.querySelector(".mp-level") as HTMLElement;
  const scoreEl = wrap.querySelector(".mp-score") as HTMLElement;
  const timeEl = wrap.querySelector(".mp-time") as HTMLElement;
  const fillEl = wrap.querySelector(".mp-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mp-msg") as HTMLElement;

  const holes: HTMLButtonElement[] = [];
  const faces: HTMLElement[] = [];
  for (let i = 0; i < HOLES; i++) {
    const btn = document.createElement("button");
    btn.className = "mp-hole";
    btn.type = "button";
    const span = document.createElement("span");
    btn.appendChild(span);
    btn.addEventListener("click", () => onHole(i));
    boardEl.appendChild(btn);
    holes.push(btn);
    faces.push(span);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function cfg(): LevelConfig {
    return LEVELS[level];
  }

  function stopTimers(): void {
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
  }

  function updateTop(): void {
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
    scoreEl.textContent = `⭐ ${score} / ${cfg().target}`;
    timeEl.textContent = `⏰ ${timeLeft} 秒`;
    fillEl.style.width = `${Math.min(100, (score / cfg().target) * 100)}%`;
  }

  function hideHole(i: number): void {
    holeState[i] = "";
    holes[i].classList.remove("mp-up");
  }

  function popSomething(): void {
    if (!running) return;
    const empty: number[] = [];
    for (let i = 0; i < HOLES; i++) if (holeState[i] === "") empty.push(i);
    if (empty.length === 0) return;
    const i = empty[Math.floor(Math.random() * empty.length)];
    const c = cfg();
    const r = Math.random();
    let kind: HoleState = "mole";
    if (r < c.bunny) kind = "bunny";
    else if (r < c.bunny + c.gold) kind = "gold";
    else if (r < c.bunny + c.gold + c.sleepy) kind = "sleepy";
    holeState[i] = kind;
    faces[i].textContent =
      kind === "bunny" ? "🐰" : kind === "gold" ? "🌟" : kind === "sleepy" ? "😴" : "🐹";
    holes[i].classList.add("mp-up");
    const stay =
      kind === "bunny" ? 1100 : kind === "gold" ? 620 : kind === "sleepy" ? 1600 : 950;
    later(() => {
      if (holeState[i] === kind) hideHole(i);
    }, stay);
  }

  function onHole(i: number): void {
    if (!running) return;
    const state = holeState[i];
    if (state === "mole" || state === "gold" || state === "sleepy") {
      const gain = state === "gold" ? 3 : state === "sleepy" ? 2 : 1;
      score += gain;
      api.play(state === "gold" ? "coin" : "pop");
      faces[i].textContent = "💫";
      msgEl.textContent =
        state === "gold" ? "🌟 金地鼠！一下加 3 分！" :
        state === "sleepy" ? "😴 瞌睡地鼠被轻轻叫醒，加 2 分～" :
        "嘭！拍到小地鼠啦！";
      holeState[i] = "";
      later(() => holes[i].classList.remove("mp-up"), 200);
      updateTop();
      if (score >= cfg().target) levelClear();
    } else if (state === "bunny") {
      score = Math.max(0, score - 1);
      api.play("oops");
      faces[i].textContent = "💧";
      msgEl.textContent = "呀，小兔子被吓了一跳，扣 1 分！";
      holeState[i] = "";
      later(() => holes[i].classList.remove("mp-up"), 200);
      updateTop();
    } else {
      api.play("tap");
    }
  }

  function clearBoard(): void {
    for (let i = 0; i < HOLES; i++) hideHole(i);
  }

  function showOverlay(kind: "next" | "retry"): void {
    const ov = document.createElement("div");
    ov.className = "mp-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="mp-ov-big">🎉</div>
        <div class="mp-ov-title">第 ${level + 1} 关过啦！</div>
        <div class="mp-ov-sub">下一关地鼠更快更调皮，加油！</div>
        <button class="mp-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".mp-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        startLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="mp-ov-big">🌧️</div>
        <div class="mp-ov-title">时间到啦</div>
        <div class="mp-ov-sub">拍到 ${score} 分，差一点点就到 ${cfg().target} 分，再来！</div>
        <button class="mp-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".mp-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        startLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function levelClear(): void {
    if (!running) return;
    running = false;
    stopTimers();
    clearBoard();
    api.play("win");
    if (level >= LEVELS.length - 1) {
      msgEl.textContent = "🎉 五关全部通过，打地鼠小能手！";
      const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
      later(() => api.onWin(stars, `五关地鼠都被你拍晕啦，手速惊人！`), 400);
    } else {
      msgEl.textContent = "🎉 目标达成！";
      later(() => showOverlay("next"), 400);
    }
  }

  function levelFail(): void {
    if (!running) return;
    running = false;
    stopTimers();
    clearBoard();
    api.play("oops");
    later(() => showOverlay("retry"), 300);
  }

  function startLevel(): void {
    const c = cfg();
    score = 0;
    timeLeft = c.seconds;
    running = true;
    clearBoard();
    updateTop();
    msgEl.textContent = c.gold > 0
      ? "🌟 金地鼠 +3 分，😴 瞌睡地鼠 +2 分，🐰 小兔子别点！"
      : "点小地鼠 🐹 得分，小兔子 🐰 不要点哦！";
    const spawnInt = setInterval(popSomething, c.spawnMs);
    intervals.add(spawnInt);
    const clockInt = setInterval(() => {
      if (!running) return;
      timeLeft--;
      updateTop();
      if (timeLeft <= 0) {
        if (score >= cfg().target) levelClear();
        else levelFail();
      }
    }, 1000);
    intervals.add(clockInt);
  }

  startLevel();

  return {
    destroy() {
      destroyed = true;
      running = false;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      stopTimers();
      wrap.remove();
    },
  };
}
