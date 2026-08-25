import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, type MatchLevel } from "./levels";

export const meta = {
  id: "match-stars",
  title: "星星消消乐",
  emoji: "⭐",
  category: "casual" as const,
  color: "#FFE3F1",
  blurb: "99 关七大主题！冰块、藤蔓、彩虹星，一路消到流星圣殿！",
};

const SIZE = 8;

const TOKENS = [
  { emoji: "⭐", bg: "#FFF3C4" },
  { emoji: "💖", bg: "#FFDDE8" },
  { emoji: "🍀", bg: "#D8F5D8" },
  { emoji: "🌙", bg: "#DCE9FF" },
  { emoji: "🍊", bg: "#FFE8D1" },
];

const RAINBOW = -2;

const CSS = `
.mst-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F7, #F3F0FF); border-radius: 16px; padding: 10px; user-select: none; position: relative; }
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
.mst-cell.mst-vine::after { content: "🌿"; position: absolute; right: -2px; top: -2px; font-size: .8em; }
.mst-cell.mst-vine { box-shadow: inset 0 0 0 3px #8FD08A; }
@keyframes mstBoom { 0% { transform: scale(1.25); opacity: .4; } 100% { transform: scale(1); opacity: 1; } }
.mst-msg { text-align: center; min-height: 22px; color: #B06BC0; font-weight: 700; margin-top: 8px; font-size: 15px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MatchLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let busy = false;
  let levelDone = false;
  let moves = cfg.moves;
  let selected = -1;
  let collected: number[] = cfg.goals.map(() => 0);
  let iceLeft = 0;
  let vineLeft = 0;

  const grid: number[] = new Array(SIZE * SIZE).fill(0);
  const ice: boolean[] = new Array(SIZE * SIZE).fill(false);
  const vine: boolean[] = new Array(SIZE * SIZE).fill(false);

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mst-top">
      <span class="mst-badge mst-moves">👣 ${moves} 步</span>
      ${cfg.rainbow ? '<span class="mst-badge">🌈 会出现彩虹星</span>' : ""}
    </div>
    <div class="mst-goals"></div>
    <div class="mst-bar"><div class="mst-fill"></div></div>
    <div class="mst-board"></div>
    <div class="mst-msg">点一颗星星，再点它旁边的，交换位置吧！</div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".mst-board") as HTMLElement;
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

  function randToken(): number {
    return Math.floor(Math.random() * cfg.colors);
  }

  function refillToken(): number {
    if (cfg.rainbow && Math.random() < 0.06) return RAINBOW;
    return randToken();
  }

  /** 把 n 个机关放在中间区域且互不相邻 */
  function placeMarks(marks: boolean[], n: number, avoid: boolean[]): number {
    const candidates: number[] = [];
    for (let r = 2; r < SIZE - 2; r++) for (let c = 1; c < SIZE - 1; c++) candidates.push(r * SIZE + c);
    let placed = 0;
    let guard = 0;
    while (placed < n && guard < 600) {
      guard++;
      const i = candidates[Math.floor(Math.random() * candidates.length)];
      if (marks[i] || avoid[i]) continue;
      const r = Math.floor(i / SIZE), c = i % SIZE;
      const near =
        (r > 0 && (marks[i - SIZE] || avoid[i - SIZE])) || (r < SIZE - 1 && (marks[i + SIZE] || avoid[i + SIZE])) ||
        (c > 0 && (marks[i - 1] || avoid[i - 1])) || (c < SIZE - 1 && (marks[i + 1] || avoid[i + 1]));
      if (near) continue;
      marks[i] = true;
      placed++;
    }
    return placed;
  }

  function setup(): void {
    iceLeft = placeMarks(ice, cfg.ice, vine);
    vineLeft = placeMarks(vine, cfg.vine, ice);
    for (let i = 0; i < grid.length; i++) {
      let v = randToken();
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      while (
        (c >= 2 && grid[i - 1] === v && grid[i - 2] === v) ||
        (r >= 2 && grid[i - SIZE] === v && grid[i - 2 * SIZE] === v)
      ) {
        v = randToken();
      }
      grid[i] = v;
    }
    renderGoals();
    render();
    if (cfg.vine > 0 && cfg.ice > 0) msgEl.textContent = "冰块旁边消、藤蔓上面消，机关全清才过关！";
    else if (cfg.vine > 0) msgEl.textContent = "在藤蔓格子上消除，才能剪断藤蔓哦！";
    else if (cfg.ice > 0) msgEl.textContent = "在冰块上或旁边消除，就能敲开冰块哦！";
    else if (cfg.rainbow) msgEl.textContent = "彩虹星🌈和谁交换，就消掉全场那种图案！";
    else msgEl.textContent = "收集目标里的图案，步数要省着用～";
  }

  function renderGoals(): void {
    const parts: string[] = cfg.goals.map((g, gi) => {
      const done = collected[gi] >= g.count;
      return `<span class="mst-goal${done ? " mst-done" : ""}">${TOKENS[g.token].emoji} ${Math.min(collected[gi], g.count)}/${g.count}</span>`;
    });
    if (cfg.ice > 0) parts.push(`<span class="mst-goal${iceLeft <= 0 ? " mst-done" : ""}">🧊 ${cfg.ice - iceLeft}/${cfg.ice}</span>`);
    if (cfg.vine > 0) parts.push(`<span class="mst-goal${vineLeft <= 0 ? " mst-done" : ""}">🌿 ${cfg.vine - vineLeft}/${cfg.vine}</span>`);
    goalsEl.innerHTML = parts.join("");
    let total = 0, got = 0;
    cfg.goals.forEach((g, gi) => { total += g.count; got += Math.min(collected[gi], g.count); });
    total += cfg.ice + cfg.vine;
    got += cfg.ice - iceLeft + (cfg.vine - vineLeft);
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
      if (v === RAINBOW) {
        cell.textContent = "🌈";
        cell.style.background = "#fff";
      } else if (v < 0) {
        cell.textContent = "";
        cell.style.background = "rgba(255,255,255,.4)";
      } else {
        cell.textContent = TOKENS[v].emoji;
        cell.style.background = TOKENS[v].bg;
      }
      cell.classList.toggle("mst-ice", ice[i]);
      cell.classList.toggle("mst-vine", vine[i]);
      cell.classList.toggle("mst-sel", i === selected);
      cell.classList.toggle("mst-boom", !!boomSet && boomSet.has(i));
    }
    movesEl.textContent = `👣 ${moves} 步`;
  }

  function applyGravity(): void {
    for (let c = 0; c < SIZE; c++) {
      const vals: number[] = [];
      for (let r = SIZE - 1; r >= 0; r--) {
        const i = r * SIZE + c;
        if (!ice[i] && !vine[i] && grid[i] >= 0) vals.push(grid[i]);
      }
      let vi = 0;
      for (let r = SIZE - 1; r >= 0; r--) {
        const i = r * SIZE + c;
        if (ice[i] || vine[i]) continue;
        grid[i] = vi < vals.length ? vals[vi++] : refillToken();
      }
    }
  }

  function goalsMet(): boolean {
    return cfg.goals.every((g, gi) => collected[gi] >= g.count) && iceLeft <= 0 && vineLeft <= 0;
  }

  function checkEnd(): void {
    if (levelDone) return;
    if (goalsMet()) {
      levelDone = true;
      const got = moves >= cfg.three ? 3 : moves >= cfg.two ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `还剩 ${moves} 步没用完，真会计划！`), 450);
    } else if (moves <= 0) {
      levelDone = true;
      later(() => ctx.lose("步数用完了，差一点点就成功啦！"), 450);
    }
  }

  /** 消除一组格子：计目标、敲冰、剪藤 */
  function clearCells(set: Set<number>): void {
    set.forEach((i) => {
      const v = grid[i];
      cfg.goals.forEach((g, gi) => {
        if (g.token === v) collected[gi]++;
      });
      if (vine[i]) { vine[i] = false; vineLeft--; }
      if (ice[i]) { ice[i] = false; iceLeft--; }
      const r = Math.floor(i / SIZE), c = i % SIZE;
      const neighbors = [
        r > 0 ? i - SIZE : -1, r < SIZE - 1 ? i + SIZE : -1,
        c > 0 ? i - 1 : -1, c < SIZE - 1 ? i + 1 : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && ice[n]) { ice[n] = false; iceLeft--; }
      }
      grid[i] = -1;
    });
  }

  function resolveCascade(chain: number): void {
    const matched = findMatches(grid);
    if (matched.size === 0) {
      busy = false;
      checkEnd();
      return;
    }
    ctx.sfx("pop");
    if (matched.size >= 5) {
      ctx.bonusStars(1);
      msgEl.textContent = `哇！一下消掉 ${matched.size} 颗，奖励一颗小星星！`;
    } else if (chain > 1) {
      msgEl.textContent = `连锁反应 x${chain}，太棒啦！`;
    }
    clearCells(matched);
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

  /** 彩虹星交换：清掉全场目标图案 */
  function rainbowSwap(a: number, b: number): void {
    const other = grid[a] === RAINBOW ? grid[b] : grid[a];
    const target = other === RAINBOW ? Math.floor(Math.random() * cfg.colors) : other;
    const set = new Set<number>([a, b]);
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === target) set.add(i);
    }
    ctx.sfx("coin");
    msgEl.textContent = `彩虹星把 ${TOKENS[target].emoji} 全都变没啦！`;
    moves--;
    busy = true;
    clearCells(set);
    renderGoals();
    render(set);
    later(() => {
      applyGravity();
      render();
      later(() => resolveCascade(1), 180);
    }, 260);
  }

  function onCell(i: number): void {
    if (levelDone || busy) return;
    if (ice[i] || vine[i]) {
      ctx.sfx("oops");
      msgEl.textContent = ice[i]
        ? "这颗被冰冻住啦，在它旁边消除就能敲开！"
        : "这颗被藤蔓缠住啦，在它上面消除才能剪断！";
      return;
    }
    if (selected === -1) {
      selected = i;
      ctx.sfx("tap");
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
      ctx.sfx("tap");
      render();
      return;
    }
    const a = selected, b = i;
    selected = -1;
    if (grid[a] === RAINBOW || grid[b] === RAINBOW) {
      rainbowSwap(a, b);
      return;
    }
    [grid[a], grid[b]] = [grid[b], grid[a]];
    if (findMatches(grid).size === 0) {
      [grid[a], grid[b]] = [grid[b], grid[a]];
      ctx.sfx("oops");
      msgEl.textContent = "这样换不能消除哦，换个方向试试～";
      render();
      return;
    }
    moves--;
    busy = true;
    render();
    later(() => resolveCascade(1), 120);
  }

  setup();

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

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "步数剩得越多，星星越多！机关全清才能过关～",
    grandMessage: "99 关全部消除完毕，你是真正的消除大师！",
  });
}
