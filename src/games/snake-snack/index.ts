import { meta } from "./meta";
export { meta };

// 贪吃毛毛虫:188 关十座花园 + 无尽花园。
// 1.1 新机制:双身位(两条镜像同走)、传送星门、会移动的小刺猬、限定长度过窄门(剪刀果)。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  CHAPTERS,
  endlessGarden,
  endlessGardenName,
  endlessLine,
  GRID,
  LEVELS,
  type SnakeLevel,
} from "./levels";
import {
  cellKey,
  cellXY,
  gateOpenFor,
  gateSet,
  loseLine,
  mirrorDir,
  moverCells,
  openingLine,
  portalMap,
  reachableCells,
  snackKind,
  spawnA,
  spawnB,
  starsFor,
  wallSet,
  winLine,
} from "./logic";

const CELL = 26;
const SIZE = GRID * CELL;
const SNACKS = ["🍓", "🍎", "🍇", "🍪", "🧁"];
const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

const CSS = `
.sn-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAFBE4, #FDF7E2); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.sn-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.sn-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #67A05B; box-shadow: 0 2px 6px rgba(120,180,110,.25); font-size: 14px; }
.sn-badge.sn-shut { color: #C2456F; }
.sn-canvas { width: 100%; border-radius: 16px; display: block; background: #F4FBEF; }
.sn-pad { display: grid; grid-template-columns: 60px 60px 60px; grid-template-rows: 48px 48px; gap: 6px; justify-content: center; margin-top: 10px; }
.sn-btn { border: none; border-radius: 14px; font-size: 22px; background: #BEE8B0; color: #3F6B36; cursor: pointer; box-shadow: 0 3px 0 #9CCC8E; touch-action: none; padding: 0; }
.sn-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #9CCC8E; }
.sn-up { grid-column: 2; grid-row: 1; }
.sn-left { grid-column: 1; grid-row: 2; }
.sn-down { grid-column: 2; grid-row: 2; }
.sn-right { grid-column: 3; grid-row: 2; }
.sn-msg { text-align: center; min-height: 20px; color: #67A05B; font-weight: 700; margin-top: 8px; font-size: 14px; }
.sn-bar-modes { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 0 0 10px; }
.sn-open { border: none; border-radius: 999px; padding: 9px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #7FC468, #5E9E4A); box-shadow: 0 4px 0 #487A38; }
.sn-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #487A38; }
.sn-mode { max-width: 680px; margin: 0 auto; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.sn-mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
.sn-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #5E9E4A; box-shadow: 0 3px 0 rgba(100,150,70,.3); }
.sn-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(100,150,70,.3); }
.sn-chip { background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 800; font-size: 14px; color: #5E9E4A; box-shadow: 0 2px 6px rgba(120,180,110,.25); }
.sn-over { text-align: center; padding: 26px 16px; background: #fff; border-radius: 18px; box-shadow: 0 4px 14px rgba(120,180,110,.25); }
.sn-over-t { font-size: 22px; font-weight: 900; color: #5E9E4A; margin-bottom: 8px; }
.sn-over-s { font-size: 15px; font-weight: 700; color: #67A05B; line-height: 1.6; margin-bottom: 14px; }
`;

interface Worm {
  cells: Array<[number, number]>;
  dir: [number, number];
  nextDir: [number, number];
  /** 第二条毛毛虫：玩家按左右时它反着走 */
  mirror: boolean;
  colors: [string, string, string];
}

/** 一局结束时交给外面的战报 */
export interface RunResult {
  won: boolean;
  eaten: number;
  starsGot: number;
  reason: "fence" | "wall" | "self" | "twin" | "mover" | null;
}

interface RunOpts {
  cfg: SnakeLevel;
  banner?: string;
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onDone: (result: RunResult) => void;
}

/**
 * 一座花园：闯关关卡和无尽花园共用这一套引擎。
 * 点心永远只放在「这会儿真的够得着」的格子上，所以不会出现走不到的死局。
 */
function createRun(stage: HTMLElement, opts: RunOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  let destroyed = false;
  let ended = false;
  let stepTimer: ReturnType<typeof setInterval> | null = null;

  const walls = wallSet(cfg);
  const gates = gateSet(cfg);
  const portals = portalMap(cfg);
  const worms: Worm[] = [
    { cells: spawnA(), dir: [1, 0], nextDir: [1, 0], mirror: false, colors: ["#6BBB4E", "#8FD070", "#A5DB8A"] },
  ];
  if (cfg.twin) {
    worms.push({ cells: spawnB(), dir: [-1, 0], nextDir: [-1, 0], mirror: true, colors: ["#C86FA8", "#E094C4", "#EEB4D8"] });
  }

  let tick = 0;
  let eaten = 0;
  let starsGot = 0;
  let snack: [number, number] = [9, 1];
  let snackEmoji = SNACKS[0];
  let snackIsStar = false;
  let snackIsTrim = false;
  let starTicks = 0;

  const wrap = document.createElement("div");
  wrap.className = "sn-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="sn-top">
      <span class="sn-badge sn-score">🍓 0 / ${cfg.target}</span>
      <span class="sn-badge sn-star">⭐ 0</span>
      ${cfg.gate ? '<span class="sn-badge sn-gate">🚪 窄门开着</span>' : ""}
      ${opts.banner ? `<span class="sn-badge sn-banner">${opts.banner}</span>` : ""}
    </div>
    <canvas class="sn-canvas" width="${SIZE}" height="${SIZE}"></canvas>
    <div class="sn-pad">
      <button class="sn-btn sn-up" type="button">⬆️</button>
      <button class="sn-btn sn-left" type="button">⬅️</button>
      <button class="sn-btn sn-down" type="button">⬇️</button>
      <button class="sn-btn sn-right" type="button">➡️</button>
    </div>
    <div class="sn-msg"></div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".sn-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".sn-score") as HTMLElement;
  const starEl = wrap.querySelector(".sn-star") as HTMLElement;
  const gateEl = wrap.querySelector(".sn-gate") as HTMLElement | null;
  const msgEl = wrap.querySelector(".sn-msg") as HTMLElement;
  msgEl.textContent = openingLine(cfg);

  function bodyLength(): number {
    return worms[0].cells.length;
  }

  function gateOpen(): boolean {
    return gateOpenFor(cfg, bodyLength());
  }

  function occupied(x: number, y: number): boolean {
    return worms.some((w) => w.cells.some(([sx, sy]) => sx === x && sy === y));
  }

  function hedgehogs(): Set<number> {
    return moverCells(cfg, Math.floor(tick / 2));
  }

  function placeSnack(): void {
    const kind = snackKind(cfg, eaten, bodyLength());
    snackIsStar = kind === "star";
    snackIsTrim = kind === "trim";
    starTicks = 0;
    snackEmoji = snackIsTrim ? "✂️" : snackIsStar ? "⭐" : SNACKS[Math.floor(Math.random() * SNACKS.length)];
    // 只在「这会儿真的走得到」的格子里放点心：窄门关着就放在这一侧
    const head = worms[0].cells[0];
    const reach = reachableCells(cfg, cellKey(head[0], head[1]), gateOpen());
    const beasts = hedgehogs();
    const pool: number[] = [];
    reach.forEach((k) => {
      const [x, y] = cellXY(k);
      if (gates.has(k) || beasts.has(k) || occupied(x, y)) return;
      pool.push(k);
    });
    if (pool.length === 0) {
      // 极端情况下退回到任意空地，绝不让点心消失
      reach.forEach((k) => pool.push(k));
    }
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? cellKey(head[0], head[1]);
    snack = cellXY(pick);
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, SIZE, SIZE);
    c2d.font = `${CELL - 4}px serif`;
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.fillStyle = "#A9C79A";
    walls.forEach((key) => {
      const [x, y] = cellXY(key);
      c2d.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    });
    walls.forEach((key) => {
      const [x, y] = cellXY(key);
      c2d.fillText("🌿", x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
    });
    // 星门
    portals.forEach((_, key) => {
      const [x, y] = cellXY(key);
      c2d.fillStyle = "#D8E4FB";
      c2d.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      c2d.fillText("🌀", x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
    });
    // 窄门
    const open = gateOpen();
    gates.forEach((key) => {
      const [x, y] = cellXY(key);
      c2d.fillStyle = open ? "#E7F3DC" : "#F3DCE8";
      c2d.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      c2d.fillText(open ? "🚪" : "🔒", x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
    });
    // 小刺猬
    hedgehogs().forEach((key) => {
      const [x, y] = cellXY(key);
      c2d.fillText("🦔", x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
    });
    // 点心
    c2d.fillText(snackEmoji, snack[0] * CELL + CELL / 2, snack[1] * CELL + CELL / 2 + 1);
    // 毛毛虫
    for (const w of worms) {
      w.cells.forEach(([x, y], i) => {
        c2d.fillStyle = i === 0 ? w.colors[0] : i % 2 === 0 ? w.colors[1] : w.colors[2];
        c2d.beginPath();
        c2d.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
        c2d.fill();
        if (i === 0) {
          c2d.fillStyle = "#2F4F2A";
          const [dx, dy] = w.dir;
          c2d.beginPath();
          c2d.arc(x * CELL + CELL / 2 + dx * 5 - dy * 4, y * CELL + CELL / 2 + dy * 5 - dx * 4, 2.4, 0, Math.PI * 2);
          c2d.arc(x * CELL + CELL / 2 + dx * 5 + dy * 4, y * CELL + CELL / 2 + dy * 5 + dx * 4, 2.4, 0, Math.PI * 2);
          c2d.fill();
        }
      });
    }
    if (SMOKE) mirrorState();
  }

  /** 冒烟脚本用的状态镜像：真人看画面，自动玩家看这几个 dataset */
  function mirrorState(): void {
    canvas.dataset.walls = Array.from(walls).join(",");
    canvas.dataset.gate = Array.from(gates).join(",");
    canvas.dataset.gateopen = gateOpen() ? "1" : "0";
    canvas.dataset.portals = Array.from(portals.entries()).map(([a, b]) => `${a}>${b}`).join(",");
    canvas.dataset.movers = Array.from(hedgehogs()).join(",");
    canvas.dataset.worms = worms.map((w) => w.cells.map(([x, y]) => cellKey(x, y)).join(";")).join("|");
    canvas.dataset.snack = String(cellKey(snack[0], snack[1]));
    canvas.dataset.eaten = String(eaten);
  }

  function renderTop(): void {
    scoreEl.textContent = `🍓 ${eaten} / ${cfg.target}`;
    starEl.textContent = `⭐ ${starsGot}`;
    if (gateEl) {
      const open = gateOpen();
      gateEl.classList.toggle("sn-shut", !open);
      gateEl.textContent = open ? "🚪 窄门开着" : `🔒 窄门要 ${cfg.gateMax ?? 8} 节以内`;
    }
  }

  function finish(won: boolean, reason: RunResult["reason"]): void {
    if (ended) return;
    ended = true;
    if (stepTimer) clearInterval(stepTimer);
    const result: RunResult = { won, eaten, starsGot, reason };
    setTimeout(() => { if (!destroyed) opts.onDone(result); }, 350);
  }

  function eatAt(w: Worm): void {
    eaten++;
    if (snackIsTrim) {
      for (const worm of worms) {
        while (worm.cells.length > 3) worm.cells.pop();
      }
      opts.sfx("coin");
      msgEl.textContent = "✂️ 剪短啦！这下窄门挤得过去了～";
    } else if (snackIsStar) {
      starsGot++;
      opts.sfx("coin");
      msgEl.textContent = "⭐ 追到星星果啦！";
    } else {
      opts.sfx("pop");
      if (w.mirror) msgEl.textContent = "粉毛毛虫也吃到啦！";
    }
    renderTop();
  }

  function step(): void {
    if (ended || destroyed) return;
    tick++;
    const beasts = moverCells(cfg, Math.floor(tick / 2));
    const open = gateOpen();
    const moved: Array<{ w: Worm; head: [number, number] }> = [];

    for (const w of worms) {
      w.dir = w.nextDir;
      const [hx, hy] = w.cells[0];
      let nx = hx + w.dir[0];
      let ny = hy + w.dir[1];
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
        opts.sfx("oops");
        finish(false, "fence");
        return;
      }
      let k = cellKey(nx, ny);
      if (gates.has(k) && !open) {
        // 门框挡一下不算撞车：这一拍原地不动，等孩子吃了剪刀果再过
        msgEl.textContent = `身子有点长啦，先去吃把剪刀果，短到 ${cfg.gateMax ?? 8} 节就挤得过去！`;
        continue;
      }
      if (walls.has(k)) {
        opts.sfx("oops");
        finish(false, "wall");
        return;
      }
      const hop = portals.get(k);
      if (hop !== undefined) {
        [nx, ny] = cellXY(hop);
        k = hop;
        opts.sfx("tap");
      }
      moved.push({ w, head: [nx, ny] });
    }

    // 先把所有头挪好再判碰撞，两条毛毛虫才不会因为先后顺序吃亏
    for (const { w, head } of moved) {
      const [nx, ny] = head;
      const hitSelf = w.cells.some(([sx, sy], i) => i > 0 && i < w.cells.length - 1 && sx === nx && sy === ny);
      if (hitSelf) {
        opts.sfx("oops");
        finish(false, "self");
        return;
      }
      const other = worms.find((o) => o !== w);
      if (other && other.cells.some(([sx, sy]) => sx === nx && sy === ny)) {
        opts.sfx("oops");
        finish(false, "twin");
        return;
      }
      if (beasts.has(cellKey(nx, ny))) {
        opts.sfx("oops");
        finish(false, "mover");
        return;
      }
    }
    if (moved.length > 1) {
      const [a, b] = moved;
      if (a.head[0] === b.head[0] && a.head[1] === b.head[1]) {
        opts.sfx("oops");
        finish(false, "twin");
        return;
      }
    }

    let ate = false;
    for (const { w, head } of moved) {
      w.cells.unshift([head[0], head[1]]);
      if (!ate && head[0] === snack[0] && head[1] === snack[1]) {
        ate = true;
        eatAt(w);
      } else {
        w.cells.pop();
      }
    }
    if (ate) {
      if (eaten >= cfg.target) {
        draw();
        opts.sfx("win");
        finish(true, null);
        return;
      }
      placeSnack();
    } else if (snackIsStar) {
      starTicks++;
      if (starTicks > 30) {
        snackIsStar = false;
        snackEmoji = SNACKS[Math.floor(Math.random() * SNACKS.length)];
        msgEl.textContent = "星星果溜走了，下次快一点！";
      }
    }
    draw();
    renderTop();
  }

  function turn(d: [number, number]): void {
    if (ended) return;
    let changed = false;
    for (const w of worms) {
      const want = w.mirror ? mirrorDir(d) : d;
      if (want[0] === -w.dir[0] && want[1] === -w.dir[1]) continue;
      w.nextDir = want;
      changed = true;
    }
    if (changed) opts.sfx("tap");
  }

  (wrap.querySelector(".sn-up") as HTMLButtonElement).addEventListener("click", () => turn([0, -1]));
  (wrap.querySelector(".sn-down") as HTMLButtonElement).addEventListener("click", () => turn([0, 1]));
  (wrap.querySelector(".sn-left") as HTMLButtonElement).addEventListener("click", () => turn([-1, 0]));
  (wrap.querySelector(".sn-right") as HTMLButtonElement).addEventListener("click", () => turn([1, 0]));

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") { turn([0, -1]); e.preventDefault(); }
    if (e.key === "ArrowDown") { turn([0, 1]); e.preventDefault(); }
    if (e.key === "ArrowLeft") { turn([-1, 0]); e.preventDefault(); }
    if (e.key === "ArrowRight") { turn([1, 0]); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  placeSnack();
  renderTop();
  draw();
  stepTimer = setInterval(step, cfg.tickMs);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      if (stepTimer) clearInterval(stepTimer);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: SnakeLevel = LEVELS[ctx.level];
  const run = createRun(stage, {
    cfg,
    sfx: ctx.sfx,
    onDone: (result) => {
      if (result.won) ctx.win(starsFor(result.starsGot), winLine(cfg, cfg.target, result.starsGot));
      else ctx.lose(loseLine(result.reason ?? "wall"));
    },
  });
  return { destroy: () => run.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽花园
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "sn-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "sn-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "sn-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "sn-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let garden = 1;
  let total = 0;
  let run: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(sub: string): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "sn-over";
    box.innerHTML = `<div class="sn-over-t">毛毛虫吃饱回家啦</div><div class="sn-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "sn-open";
    again.textContent = "🔁 从第 1 座花园再来";
    again.addEventListener("click", () => {
      api.play("tap");
      garden = 1;
      total = 0;
      startGarden();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startGarden(): void {
    run?.destroy();
    stage.innerHTML = "";
    chip.textContent = `♾️ ${endlessGardenName(garden)} · 累计 ${total} 口 · 最好 ${best} 口`;
    run = createRun(stage, {
      cfg: endlessGarden(garden),
      banner: `♾️ 第 ${garden} 座`,
      sfx: (n) => api.play(n),
      onDone: (result) => {
        total += result.eaten;
        if (result.won) {
          best = save.recordEndlessBest(meta.id, total);
          api.addStars(1);
          garden++;
          startGarden();
        } else {
          best = save.recordEndlessBest(meta.id, total);
          showOver(endlessLine(total, best));
        }
      },
    });
  }

  startGarden();

  return {
    destroy() {
      run?.destroy();
      run = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "sn-bar-modes";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "sn-open";
  bar.appendChild(endlessBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽花园 · 最好 ${best} 口` : "♾️ 无尽花园 · 点我开吃！";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  endlessBtn.addEventListener("click", () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "追到 2 颗限时星星果就能拿 3 星！",
      grandMessage: "188 座花园全部吃遍，毛毛虫长成大明星！",
      guideTitle: "贪吃毛毛虫 · 花园笔记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
