export const meta = {
  id: "mole-pop",
  title: "地鼠嘭嘭",
  emoji: "🐹",
  category: "casual" as const,
  color: "#EBDFC8",
  blurb: "小地鼠探出头啦！轻轻点它一下，嘭～变出小星星！",
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

const ROUND_SECONDS = 30;
const WIN_SCORE = 12;
const HOLES = 9;

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let finished = false;
  let score = 0;
  let timeLeft = ROUND_SECONDS;

  // 每个洞的状态: "" 空, "mole" 地鼠, "bunny" 小兔
  const holeState: string[] = new Array(HOLES).fill("");

  const wrap = document.createElement("div");
  wrap.className = "mp-wrap";
  wrap.innerHTML = `
    <style>
      .mp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #F2FBE8, #FBF3DE); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; }
      .mp-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
      .mp-badge { background: #fff; border-radius: 14px; padding: 6px 14px; font-weight: 700; color: #8B9A46; box-shadow: 0 2px 6px rgba(150,170,90,.25); font-size: 15px; }
      .mp-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .mp-hole { aspect-ratio: 1; border: none; border-radius: 50% 50% 42% 42%; background: radial-gradient(circle at 50% 65%, #B8926A 0%, #96714C 60%, #7C5C3D 100%); font-size: clamp(30px, 10vw, 48px); cursor: pointer; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; padding: 0 0 6px; box-shadow: inset 0 6px 10px rgba(60,40,20,.4); }
      .mp-hole span { display: block; transform: translateY(110%); transition: transform .16s ease-out; }
      .mp-hole.mp-up span { transform: translateY(0); }
      .mp-hole:active { filter: brightness(1.08); }
      .mp-msg { text-align: center; min-height: 22px; color: #8B9A46; font-weight: 700; margin-top: 10px; font-size: 15px; }
    </style>
    <div class="mp-top">
      <span class="mp-badge mp-score">⭐ 0 分（目标 ${WIN_SCORE}）</span>
      <span class="mp-badge mp-time">⏰ ${ROUND_SECONDS} 秒</span>
    </div>
    <div class="mp-board"></div>
    <div class="mp-msg">点小地鼠 🐹 得分，小兔子 🐰 不要点哦！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".mp-board") as HTMLElement;
  const scoreEl = wrap.querySelector(".mp-score") as HTMLElement;
  const timeEl = wrap.querySelector(".mp-time") as HTMLElement;
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
      if (!finished) fn();
    }, ms);
    timeouts.add(t);
  }

  function updateTop(): void {
    scoreEl.textContent = `⭐ ${score} 分（目标 ${WIN_SCORE}）`;
    timeEl.textContent = `⏰ ${timeLeft} 秒`;
  }

  function hideHole(i: number): void {
    holeState[i] = "";
    holes[i].classList.remove("mp-up");
  }

  function popSomething(): void {
    if (finished) return;
    const empty: number[] = [];
    for (let i = 0; i < HOLES; i++) if (holeState[i] === "") empty.push(i);
    if (empty.length === 0) return;
    const i = empty[Math.floor(Math.random() * empty.length)];
    const isBunny = Math.random() < 0.22;
    holeState[i] = isBunny ? "bunny" : "mole";
    faces[i].textContent = isBunny ? "🐰" : "🐹";
    holes[i].classList.add("mp-up");
    later(() => {
      if (holeState[i] !== "") hideHole(i);
    }, isBunny ? 1100 : 950);
  }

  function onHole(i: number): void {
    if (finished) return;
    const state = holeState[i];
    if (state === "mole") {
      score++;
      api.play("pop");
      faces[i].textContent = "💫";
      msgEl.textContent = "嘭！拍到小地鼠啦！";
      holeState[i] = "";
      later(() => holes[i].classList.remove("mp-up"), 200);
      updateTop();
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

  function endRound(): void {
    if (finished) return;
    finished = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    if (score >= WIN_SCORE) {
      const stars: 1 | 2 | 3 = score >= 20 ? 3 : score >= 16 ? 2 : 1;
      api.play("win");
      msgEl.textContent = "🎉 你是打地鼠小能手！";
      api.onWin(stars, `拍到了 ${score} 分，手好快呀！`);
    } else {
      api.play("oops");
      msgEl.textContent = "地鼠们跑得太快啦，再来一次！";
      api.onLose(`这次拍到 ${score} 分，差一点点就到 ${WIN_SCORE} 分啦！`);
    }
  }

  const spawnInt = setInterval(popSomething, 650);
  intervals.add(spawnInt);
  const clockInt = setInterval(() => {
    timeLeft--;
    updateTop();
    if (timeLeft <= 0) endRound();
  }, 1000);
  intervals.add(clockInt);

  updateTop();

  return {
    destroy() {
      finished = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      intervals.forEach((t) => clearInterval(t));
      intervals.clear();
      wrap.remove();
    },
  };
}
