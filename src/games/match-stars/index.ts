export const meta = {
  id: "match-stars",
  title: "星星消消乐",
  emoji: "⭐",
  category: "casual" as const,
  color: "#FFE3F1",
  blurb: "八大关卡！收集彩色星星、敲开冰块，步数用得越省越棒！",
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

const SIZE = 8;

const TOKENS = [
  { emoji: "⭐", bg: "#FFF3C4" },
  { emoji: "💖", bg: "#FFDDE8" },
  { emoji: "🍀", bg: "#D8F5D8" },
  { emoji: "🌙", bg: "#DCE9FF" },
  { emoji: "🍊", bg: "#FFE8D1" },
];

interface LevelGoal {
  token: number;
  count: number;
}

interface LevelConfig {
  /** 使用几种图案 */
  colors: number;
  moves: number;
  goals: LevelGoal[];
  ice: number;
}

const LEVELS: LevelConfig[] = [
  { colors: 4, moves: 20, goals: [{ token: 0, count: 10 }], ice: 0 },
  { colors: 4, moves: 20, goals: [{ token: 1, count: 12 }], ice: 0 },
  { colors: 5, moves: 22, goals: [{ token: 0, count: 10 }, { token: 2, count: 10 }], ice: 0 },
  { colors: 5, moves: 22, goals: [{ token: 3, count: 12 }], ice: 4 },
  { colors: 5, moves: 24, goals: [{ token: 0, count: 12 }, { token: 4, count: 12 }], ice: 5 },
  { colors: 5, moves: 24, goals: [{ token: 1, count: 14 }, { token: 2, count: 10 }], ice: 6 },
  { colors: 5, moves: 26, goals: [{ token: 0, count: 14 }, { token: 3, count: 14 }], ice: 8 },
  { colors: 5, moves: 26, goals: [{ token: 0, count: 12 }, { token: 1, count: 12 }, { token: 4, count: 12 }], ice: 10 },
];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let busy = false;
  let levelDone = false;

  let level = 0;
  let retries = 0;
  let moves = 0;
  let selected = -1;
  let collected: number[] = [];
  let iceLeft = 0;

  const grid: number[] = new Array(SIZE * SIZE).fill(0);
  const ice: boolean[] = new Array(SIZE * SIZE).fill(false);

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.innerHTML = `
    <style>
      .mst-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F7, #F3F0FF); border-radius: 20px; padding: 12px; max-width: 420px; margin: 0 auto; user-select: none; position: relative; }
      .mst-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
      .mst-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #A66BBE; box-shadow: 0 2px 6px rgba(180,140,220,.25); font-size: 14px; }
      .mst-goals { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; justify-content: center; }
      .mst-goal { background: #fff; border-radius: 12px; padding: 4px 10px; font-weight: 700; color: #8B6BAE; font-size: 14px; box-shadow: 0 2px 5px rgba(180,140,220,.2); }
      .mst-goal.mst-done { background: #E4F9E0; color: #57A05B; }
      .mst-bar { height: 12px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
      .mst-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFB6D9, #C9A7F5); border-radius: 8px; transition: width .3s; }
      .mst-board { display: grid; grid-template-columns: repeat(${SIZE}, 1fr); gap: 4px; }
      .mst-cell { aspect-ratio: 1; border: none; border-radius: 12px; font-size: clamp(16px, 4.5vw, 26px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .12s, box-shadow .12s; padding: 0; position: relative; }
      .mst-cell:active { transform: scale(.9); }
      .mst-cell.mst-sel { box-shadow: 0 0 0 3px #FF8FC7; transform: scale(1.08); }
      .mst-cell.mst-boom { animation: mstBoom .25s ease; }
      .mst-cell.mst-ice::after { content: "🧊"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.15em; background: rgba(200,235,255,.55); border-radius: 12px; }
      @keyframes mstBoom { 0% { transform: scale(1.25); opacity: .4; } 100% { transform: scale(1); opacity: 1; } }
      .mst-msg { text-align: center; min-height: 22px; color: #B06BC0; font-weight: 700; margin-top: 8px; font-size: 15px; }
      .mst-overlay { position: absolute; inset: 0; background: rgba(255,246,252,.95); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .mst-ov-big { font-size: 52px; }
      .mst-ov-title { font-size: 24px; font-weight: 900; color: #A66BBE; }
      .mst-ov-sub { font-size: 16px; font-weight: 700; color: #B98BC9; line-height: 1.6; }
      .mst-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#FF9ECF,#F473B4); cursor: pointer; box-shadow: 0 5px 0 #D65A99; font-family: inherit; }
      .mst-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #D65A99; }
    </style>
    <div class="mst-top">
      <span class="mst-badge mst-level">🚩 第 1 关</span>
      <span class="mst-badge mst-moves">👣 0 步</span>
    </div>
    <div class="mst-goals"></div>
    <div class="mst-bar"><div class="mst-fill"></div></div>
    <div class="mst-board"></div>
    <div class="mst-msg">点一颗星星，再点它旁边的，交换位置吧！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".mst-board") as HTMLElement;
  const levelEl = wrap.querySelector(".mst-level") as HTMLElement;
  const movesEl = wrap.querySelector(".mst-moves") as HTMLElement;
  const goalsEl = wrap.querySelector(".mst-goals") as HTMLElement;
  const fillEl = wrap.querySelector(".mst-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-msg") as HTMLElement;

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const btn = document.createElement("button");
    btn.className = "mst-cell";
    btn.type = "button";
    btn.addEventListener("click", () => onCell(i));
    boardEl.appendChild(btn);
    cells.push(btn);
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

  function randToken(): number {
    return Math.floor(Math.random() * cfg().colors);
  }

  function setupLevel(): void {
    const c = cfg();
    levelDone = false;
    busy = false;
    selected = -1;
    moves = c.moves;
    collected = c.goals.map(() => 0);
    ice.fill(false);
    // 冰块放在中间区域，彼此不相邻，避免卡死
    const candidates: number[] = [];
    for (let r = 2; r < SIZE - 2; r++) for (let col = 1; col < SIZE - 1; col++) candidates.push(r * SIZE + col);
    let placed = 0;
    let guard = 0;
    while (placed < c.ice && guard < 500) {
      guard++;
      const i = candidates[Math.floor(Math.random() * candidates.length)];
      if (ice[i]) continue;
      const r = Math.floor(i / SIZE), col = i % SIZE;
      const near =
        (r > 0 && ice[i - SIZE]) || (r < SIZE - 1 && ice[i + SIZE]) ||
        (col > 0 && ice[i - 1]) || (col < SIZE - 1 && ice[i + 1]);
      if (near) continue;
      ice[i] = true;
      placed++;
    }
    iceLeft = placed;
    for (let i = 0; i < grid.length; i++) {
      let v = randToken();
      const r = Math.floor(i / SIZE);
      const col = i % SIZE;
      while (
        (col >= 2 && grid[i - 1] === v && grid[i - 2] === v) ||
        (r >= 2 && grid[i - SIZE] === v && grid[i - 2 * SIZE] === v)
      ) {
        v = randToken();
      }
      grid[i] = v;
    }
    renderGoals();
    render();
    msgEl.textContent = c.ice > 0
      ? "在冰块上或旁边消除，就能敲开冰块哦！"
      : "收集目标里的图案，步数要省着用～";
  }

  function renderGoals(): void {
    const c = cfg();
    const parts: string[] = c.goals.map((g, gi) => {
      const done = collected[gi] >= g.count;
      return `<span class="mst-goal${done ? " mst-done" : ""}">${TOKENS[g.token].emoji} ${Math.min(collected[gi], g.count)}/${g.count}</span>`;
    });
    if (c.ice > 0) {
      const done = iceLeft <= 0;
      parts.push(`<span class="mst-goal${done ? " mst-done" : ""}">🧊 ${cfg().ice - iceLeft}/${cfg().ice}</span>`);
    }
    goalsEl.innerHTML = parts.join("");
    // 总进度条
    let total = 0, got = 0;
    c.goals.forEach((g, gi) => { total += g.count; got += Math.min(collected[gi], g.count); });
    total += c.ice; got += c.ice - iceLeft;
    fillEl.style.width = `${total > 0 ? Math.min(100, (got / total) * 100) : 0}%`;
  }

  function findMatches(g: number[]): Set<number> {
    const out = new Set<number>();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const i = r * SIZE + c;
        const v = g[i];
        if (v < 0) continue;
        if (c <= SIZE - 3 && g[i + 1] === v && g[i + 2] === v) {
          out.add(i); out.add(i + 1); out.add(i + 2);
        }
        if (r <= SIZE - 3 && g[i + SIZE] === v && g[i + 2 * SIZE] === v) {
          out.add(i); out.add(i + SIZE); out.add(i + 2 * SIZE);
        }
      }
    }
    return out;
  }

  function render(boomSet?: Set<number>): void {
    for (let i = 0; i < grid.length; i++) {
      const cell = cells[i];
      const v = grid[i];
      if (v < 0) {
        cell.textContent = "";
        cell.style.background = "rgba(255,255,255,.4)";
      } else {
        cell.textContent = TOKENS[v].emoji;
        cell.style.background = TOKENS[v].bg;
      }
      cell.classList.toggle("mst-ice", ice[i]);
      cell.classList.toggle("mst-sel", i === selected);
      cell.classList.toggle("mst-boom", !!boomSet && boomSet.has(i));
    }
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
    movesEl.textContent = `👣 ${moves} 步`;
  }

  function applyGravity(): void {
    for (let c = 0; c < SIZE; c++) {
      // 冰格里的图案冻住不动，其余图案往下落
      const vals: number[] = [];
      for (let r = SIZE - 1; r >= 0; r--) {
        const i = r * SIZE + c;
        if (!ice[i] && grid[i] >= 0) vals.push(grid[i]);
      }
      let vi = 0;
      for (let r = SIZE - 1; r >= 0; r--) {
        const i = r * SIZE + c;
        if (ice[i]) continue;
        grid[i] = vi < vals.length ? vals[vi++] : randToken();
      }
    }
  }

  function goalsMet(): boolean {
    const c = cfg();
    return c.goals.every((g, gi) => collected[gi] >= g.count) && iceLeft <= 0;
  }

  function showOverlay(kind: "next" | "retry" | "final"): void {
    const ov = document.createElement("div");
    ov.className = "mst-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="mst-ov-big">🎉</div>
        <div class="mst-ov-title">第 ${level + 1} 关过关啦！</div>
        <div class="mst-ov-sub">还剩 ${moves} 步没用完，真会算！</div>
        <button class="mst-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".mst-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        setupLevel();
      });
    } else if (kind === "retry") {
      ov.innerHTML = `
        <div class="mst-ov-big">🌧️</div>
        <div class="mst-ov-title">步数用完了</div>
        <div class="mst-ov-sub">差一点点就成功啦，这一关再来一次！</div>
        <button class="mst-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".mst-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        setupLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function checkEnd(): void {
    if (levelDone) return;
    if (goalsMet()) {
      levelDone = true;
      api.play("win");
      if (level >= LEVELS.length - 1) {
        msgEl.textContent = "🎉 八关全部通过，消除大师！";
        const stars: 1 | 2 | 3 = retries <= 1 ? 3 : retries <= 3 ? 2 : 1;
        later(() => api.onWin(stars, `闯过全部 ${LEVELS.length} 关，收集了满满的星星！`), 500);
      } else {
        msgEl.textContent = "🎉 目标全部完成！";
        later(() => showOverlay("next"), 450);
      }
    } else if (moves <= 0) {
      levelDone = true;
      api.play("oops");
      later(() => showOverlay("retry"), 450);
    }
  }

  function resolveCascade(chain: number): void {
    const matched = findMatches(grid);
    if (matched.size === 0) {
      busy = false;
      checkEnd();
      return;
    }
    api.play("pop");
    // 收集计数 + 敲冰
    matched.forEach((i) => {
      const v = grid[i];
      cfg().goals.forEach((g, gi) => {
        if (g.token === v) collected[gi]++;
      });
      if (ice[i]) { ice[i] = false; iceLeft--; }
      // 冰块旁边的消除也能敲开冰
      const r = Math.floor(i / SIZE), c = i % SIZE;
      const neighbors = [
        r > 0 ? i - SIZE : -1, r < SIZE - 1 ? i + SIZE : -1,
        c > 0 ? i - 1 : -1, c < SIZE - 1 ? i + 1 : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && ice[n]) { ice[n] = false; iceLeft--; }
      }
    });
    if (matched.size >= 5) {
      api.addStars(1);
      msgEl.textContent = `哇！一下消掉 ${matched.size} 颗，奖励一颗小星星！`;
    } else if (chain > 1) {
      msgEl.textContent = `连锁反应 x${chain}，太棒啦！`;
    }
    matched.forEach((i) => { grid[i] = -1; });
    renderGoals();
    render(matched);
    later(() => {
      applyGravity();
      render();
      later(() => resolveCascade(chain + 1), 180);
    }, 220);
  }

  function adjacent(a: number, b: number): boolean {
    const ra = Math.floor(a / SIZE), ca = a % SIZE;
    const rb = Math.floor(b / SIZE), cb = b % SIZE;
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
  }

  function onCell(i: number): void {
    if (levelDone || busy) return;
    if (ice[i]) {
      api.play("oops");
      msgEl.textContent = "这颗被冰冻住啦，在它旁边消除就能敲开！";
      return;
    }
    if (selected === -1) {
      selected = i;
      api.play("tap");
      render();
      return;
    }
    if (selected === i) {
      selected = -1;
      render();
      return;
    }
    if (!adjacent(selected, i)) {
      selected = i;
      api.play("tap");
      render();
      return;
    }
    const a = selected, b = i;
    selected = -1;
    [grid[a], grid[b]] = [grid[b], grid[a]];
    if (findMatches(grid).size === 0) {
      [grid[a], grid[b]] = [grid[b], grid[a]];
      api.play("oops");
      msgEl.textContent = "这样换不能消除哦，换个方向试试～";
      render();
      return;
    }
    moves--;
    busy = true;
    render();
    later(() => resolveCascade(1), 120);
  }

  setupLevel();

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}
