import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, type BubbleLevel } from "./levels";
import {
  BOLT,
  CHAMELEON_BASE,
  collapseGrid,
  colorOf,
  countLeftOn,
  cycleChameleons,
  FROZEN_OFFSET,
  groupAt,
  hasMovesOn,
  HIDDEN_OFFSET,
  isChameleon,
  isFrozen,
  isHidden,
  RAINBOW,
  revealHidden,
  STONE,
} from "./logic";

const COLS = 8;

const COLORS = [
  { bg: "radial-gradient(circle at 35% 30%, #FFE1EE, #FF9EC8)", ring: "#FF9EC8" },
  { bg: "radial-gradient(circle at 35% 30%, #DFF3FF, #8FCBFF)", ring: "#8FCBFF" },
  { bg: "radial-gradient(circle at 35% 30%, #E6FBDF, #9FE08D)", ring: "#9FE08D" },
  { bg: "radial-gradient(circle at 35% 30%, #FFF6DA, #FFD26E)", ring: "#FFD26E" },
  { bg: "radial-gradient(circle at 35% 30%, #F0E2FF, #C9A0F0)", ring: "#C9A0F0" },
];

const CSS = `
.bp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4F6FF, #F2EDFF); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.bp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.bp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #4FA3C7; box-shadow: 0 2px 6px rgba(100,170,210,.25); font-size: 14px; }
.bp-board { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 4px; }
.bp-cell { aspect-ratio: 1; border: none; border-radius: 50%; cursor: pointer; transition: transform .12s, opacity .2s; padding: 0; font-size: clamp(12px, 3.6vw, 20px); display: flex; align-items: center; justify-content: center; }
.bp-cell:active { transform: scale(.85); }
.bp-cell.bp-empty { background: transparent !important; box-shadow: none !important; cursor: default; }
.bp-cell.bp-rainbow { animation: bpSpin 2.5s linear infinite; }
@keyframes bpSpin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
.bp-msg { text-align: center; min-height: 22px; color: #4FA3C7; font-weight: 700; margin-top: 10px; font-size: 15px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BubbleLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let levelDone = false;
  const rows = cfg.rows;
  const grid: number[][] = [];
  const cells: HTMLButtonElement[] = [];
  /** 1.1 倒影天湖：当前重力是否朝上 */
  let gravityUp = false;
  /** 1.1 步数栈桥：剩余步数（0 = 不限步） */
  let movesLeft = cfg.moveLimit ?? 0;

  const wrap = document.createElement("div");
  wrap.className = "bp-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bp-top">
      <span class="bp-badge bp-left">🫧</span>
      ${cfg.flipGravity ? `<span class="bp-badge bp-grav"></span>` : ""}
      ${cfg.moveLimit ? `<span class="bp-badge bp-moves"></span>` : ""}
      <span class="bp-badge">🎯 剩 ≤${cfg.maxLeft} 过关</span>
    </div>
    <div class="bp-board"></div>
    <div class="bp-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".bp-board") as HTMLElement;
  const leftEl = wrap.querySelector(".bp-left") as HTMLElement;
  const gravEl = wrap.querySelector(".bp-grav") as HTMLElement | null;
  const movesEl = wrap.querySelector(".bp-moves") as HTMLElement | null;
  const msgEl = wrap.querySelector(".bp-msg") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function setup(): void {
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < COLS; c++) row.push(Math.floor(Math.random() * cfg.colors));
      grid.push(row);
    }
    // 撒特殊泡泡（互不覆盖）
    const specials: number[] = [];
    for (let i = 0; i < cfg.rainbow; i++) specials.push(RAINBOW);
    for (let i = 0; i < cfg.stone; i++) specials.push(STONE);
    for (let i = 0; i < cfg.bolt; i++) specials.push(BOLT);
    const used = new Set<number>();
    for (const sp of specials) {
      let guard = 0;
      while (guard++ < 200) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * COLS);
        if (used.has(r * COLS + c)) continue;
        used.add(r * COLS + c);
        grid[r][c] = sp;
        break;
      }
    }
    const wrapValue = (offset: number) => {
      let guard = 0;
      while (guard++ < 200) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * COLS);
        if (used.has(r * COLS + c)) continue;
        used.add(r * COLS + c);
        grid[r][c] = (grid[r][c] % cfg.colors) + offset;
        break;
      }
    };
    for (let i = 0; i < cfg.frozen; i++) wrapValue(FROZEN_OFFSET);
    for (let i = 0; i < (cfg.hidden ?? 0); i++) wrapValue(HIDDEN_OFFSET);
    for (let i = 0; i < (cfg.chameleon ?? 0); i++) wrapValue(CHAMELEON_BASE);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const btn = document.createElement("button");
        btn.className = "bp-cell";
        btn.type = "button";
        const rr = r, cc = c;
        btn.addEventListener("click", () => onCell(rr, cc));
        boardEl.appendChild(btn);
        cells.push(btn);
      }
    }
    render();
    const tips: string[] = [];
    if (cfg.flipGravity) tips.push("🙃 每消一组，重力就翻个面");
    if ((cfg.chameleon ?? 0) > 0) tips.push("🦎 变色泡泡每步换一种颜色");
    if (cfg.moveLimit) tips.push("🌉 步数有限，先数一数再出手");
    if ((cfg.hidden ?? 0) > 0) tips.push("🏮 黑泡泡先点亮再消");
    if (cfg.rainbow > 0) tips.push("🌈 一点消掉最多的颜色");
    if (cfg.stone > 0) tips.push("🪨 敲不破，绕开它");
    if (cfg.bolt > 0) tips.push("⚡ 清掉整行整列");
    if (cfg.frozen > 0) tips.push("🧊 在旁边消一次才解冻");
    msgEl.textContent = tips.length > 0 ? tips.join("；") : "先扫一眼全场，从最大的一团同色泡泡下手！";
  }

  function render(): void {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = cells[r * COLS + c];
        const v = grid[r][c];
        el.classList.remove("bp-rainbow");
        el.textContent = "";
        el.classList.toggle("bp-empty", v < 0);
        // dataset 只是给自动冒烟脚本读的状态镜像，不参与玩法
        el.dataset.v = String(v);
        if (v < 0) {
          el.style.background = "";
          el.style.boxShadow = "";
        } else if (v === RAINBOW) {
          el.classList.add("bp-rainbow");
          el.style.background = "conic-gradient(#FF9EC8, #FFD26E, #9FE08D, #8FCBFF, #C9A0F0, #FF9EC8)";
          el.style.boxShadow = "0 2px 8px rgba(150,120,220,.5)";
          el.textContent = "🌈";
        } else if (v === STONE) {
          el.style.background = "radial-gradient(circle at 35% 30%, #DCD8CC, #A8A296)";
          el.style.boxShadow = "0 2px 5px rgba(120,110,100,.4)";
          el.textContent = "🪨";
        } else if (v === BOLT) {
          el.style.background = "radial-gradient(circle at 35% 30%, #FFF9DA, #FFD84D)";
          el.style.boxShadow = "0 2px 8px rgba(230,180,40,.5)";
          el.textContent = "⚡";
        } else if (isFrozen(v)) {
          el.style.background = COLORS[v - FROZEN_OFFSET].bg;
          el.style.boxShadow = "inset 0 0 0 3px #9FD6FF, 0 2px 5px rgba(120,180,230,.4)";
          el.textContent = "🧊";
        } else if (isHidden(v)) {
          el.style.background = "radial-gradient(circle at 35% 30%, #6B6580, #3E3A4E)";
          el.style.boxShadow = "0 2px 6px rgba(60,50,80,.5)";
          el.textContent = "🏮";
        } else if (isChameleon(v)) {
          el.style.background = COLORS[v - CHAMELEON_BASE].bg;
          el.style.boxShadow = `inset 0 0 0 3px #7FCF95, 0 2px 5px ${COLORS[v - CHAMELEON_BASE].ring}66`;
          el.textContent = "🦎";
        } else {
          el.style.background = COLORS[v].bg;
          el.style.boxShadow = `0 2px 5px ${COLORS[v].ring}66`;
        }
      }
    }
    leftEl.textContent = `🫧 剩 ${countLeftOn(grid)} 个`;
    if (gravEl) gravEl.textContent = gravityUp ? "🙃 重力 ⬆️" : "🙂 重力 ⬇️";
    if (movesEl) movesEl.textContent = `👣 剩 ${movesLeft} 步`;
  }

  /** 消掉一组格子，并解冻它们旁边的冰冻泡泡 */
  function popCells(list: Array<[number, number]>): void {
    for (const [r, c] of list) grid[r][c] = -1;
    for (const [r, c] of list) {
      const near: Array<[number, number]> = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]];
      for (const [nr, nc] of near) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS) continue;
        if (isFrozen(grid[nr][nc])) grid[nr][nc] -= FROZEN_OFFSET;
      }
    }
  }

  function checkEnd(): void {
    if (levelDone) return;
    const outOfMoves = cfg.moveLimit ? movesLeft <= 0 : false;
    if (!outOfMoves && hasMovesOn(grid, COLS, cfg.colors)) return;
    levelDone = true;
    const left = countLeftOn(grid);
    if (left <= cfg.maxLeft) {
      const half = Math.max(cfg.stone, Math.floor(cfg.maxLeft / 2));
      const got = left <= cfg.stone ? 3 : left <= half ? 2 : 1;
      if (left <= cfg.stone) ctx.bonusStars(1);
      later(() => ctx.win(got as 1 | 2 | 3, left <= cfg.stone
        ? "泡泡全部清空，这一局的顺序排得很漂亮！"
        : `只剩 ${left} 个泡泡，达标通过！`), 400);
    } else if (outOfMoves) {
      later(() => ctx.lose(`步数用完还剩 ${left} 个～下一局先在心里排一遍顺序，从最大的一团开始，收益会高很多！`), 400);
    } else {
      later(() => ctx.lose(`还剩 ${left} 个泡泡～从盘面下方消起，上面掉下来常常会自己连锁，再来一次！`), 400);
    }
  }

  /** 每成功消一步之后的收尾：变色泡泡换色、重力方向结算、塌落、判定 */
  function afterPop(): void {
    if (cfg.moveLimit) movesLeft = Math.max(0, movesLeft - 1);
    if ((cfg.chameleon ?? 0) > 0) cycleChameleons(grid, cfg.colors);
    if (cfg.flipGravity) {
      gravityUp = !gravityUp;
      msgEl.textContent = gravityUp ? "🙃 重力翻面，泡泡飘上去啦！" : "🙂 重力回来了，泡泡落下来～";
    }
    later(() => {
      collapseGrid(grid, COLS, gravityUp);
      render();
      checkEnd();
    }, 200);
  }

  function onCell(r: number, c: number): void {
    if (levelDone) return;
    const v = grid[r][c];
    if (v < 0) return;
    if (v === STONE) {
      ctx.sfx("oops");
      msgEl.textContent = "石头敲不破，把它当地形绕开就好～";
      return;
    }
    if (isHidden(v)) {
      grid[r][c] = revealHidden(v);
      ctx.sfx("tap");
      msgEl.textContent = "🏮 点亮了！记住它的颜色，别回头再点一次～";
      render();
      return;
    }
    if (isFrozen(v)) {
      ctx.sfx("oops");
      msgEl.textContent = "这颗冻住啦，在它旁边消一组就能解冻！";
      return;
    }
    if (v === RAINBOW) {
      // 消掉数量最多的颜色（变色泡泡按当前颜色一起算）
      const counts = new Array<number>(cfg.colors).fill(0);
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < COLS; cc++) {
        const color = colorOf(grid[rr][cc], cfg.colors);
        if (color >= 0) counts[color]++;
      }
      let best = 0;
      for (let i = 1; i < cfg.colors; i++) if (counts[i] > counts[best]) best = i;
      const list: Array<[number, number]> = [[r, c]];
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (colorOf(grid[rr][cc], cfg.colors) === best) list.push([rr, cc]);
      }
      ctx.sfx("coin");
      msgEl.textContent = `🌈 彩虹泡泡消掉了 ${list.length - 1} 个泡泡！`;
      popCells(list);
      render();
      afterPop();
      return;
    }
    if (v === BOLT) {
      const list: Array<[number, number]> = [];
      for (let cc = 0; cc < COLS; cc++) {
        const gv = grid[r][cc];
        if (gv >= 0 && gv !== STONE) list.push([r, cc]);
      }
      for (let rr = 0; rr < rows; rr++) {
        if (rr === r) continue;
        const gv = grid[rr][c];
        if (gv >= 0 && gv !== STONE) list.push([rr, c]);
      }
      ctx.sfx("coin");
      msgEl.textContent = `⚡ 咔嚓！清掉一行一列共 ${list.length} 个！`;
      for (const [rr, cc] of list) {
        if (isFrozen(grid[rr][cc])) grid[rr][cc] -= FROZEN_OFFSET;
      }
      popCells(list);
      render();
      afterPop();
      return;
    }
    const g = groupAt(grid, COLS, r, c, cfg.colors);
    if (g.length < 2) {
      ctx.sfx("oops");
      msgEl.textContent = "这颗是单个的，消不掉～找相邻成团的同色泡泡！";
      return;
    }
    ctx.sfx("pop");
    if (g.length >= 8) {
      ctx.bonusStars(1);
      msgEl.textContent = `一口气消掉 ${g.length} 个，奖励一颗小星星！`;
    } else {
      msgEl.textContent = `消掉 ${g.length} 个～再攒大一点收益更高！`;
    }
    popCells(g);
    render();
    afterPop();
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
    mapHint: "全部清空 3 星，剩得越少星星越多，先规划再出手！",
    grandMessage: "188 关泡泡全部搞定，你的盘面规划能力已经很强了！",
  });
}
