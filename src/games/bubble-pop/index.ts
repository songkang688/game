import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, type BubbleLevel } from "./levels";

export const meta = {
  id: "bubble-pop",
  title: "泡泡噗噗",
  emoji: "🫧",
  category: "casual" as const,
  color: "#DCF3FF",
  blurb: "99 关六大主题！彩虹、闪电、冰冻泡泡轮番登场，全消更痛快！",
};

const COLS = 8;
const RAINBOW = 99;
const STONE = 98;
const BOLT = 97;
/** 冰冻泡泡 = 颜色值 + FROZEN_OFFSET */
const FROZEN_OFFSET = 10;

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

  const wrap = document.createElement("div");
  wrap.className = "bp-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bp-top">
      <span class="bp-badge bp-left">🫧</span>
      <span class="bp-badge">🎯 剩 ≤${cfg.maxLeft} 过关</span>
    </div>
    <div class="bp-board"></div>
    <div class="bp-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".bp-board") as HTMLElement;
  const leftEl = wrap.querySelector(".bp-left") as HTMLElement;
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
    for (let i = 0; i < cfg.frozen; i++) {
      let guard = 0;
      while (guard++ < 200) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * COLS);
        if (used.has(r * COLS + c)) continue;
        used.add(r * COLS + c);
        grid[r][c] = grid[r][c] % FROZEN_OFFSET + FROZEN_OFFSET;
        break;
      }
    }
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
    if (cfg.rainbow > 0) tips.push("🌈 一点消掉最多的颜色");
    if (cfg.stone > 0) tips.push("🪨 敲不破，绕开它");
    if (cfg.bolt > 0) tips.push("⚡ 清掉整行整列");
    if (cfg.frozen > 0) tips.push("🧊 在旁边消一次才解冻");
    msgEl.textContent = tips.length > 0 ? tips.join("；") : "找到挨在一起的同色泡泡，一起点破它们！";
  }

  function isColor(v: number): boolean {
    return v >= 0 && v < cfg.colors;
  }

  function isFrozen(v: number): boolean {
    return v >= FROZEN_OFFSET && v < FROZEN_OFFSET + 5;
  }

  function countLeft(): number {
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] >= 0) n++;
    return n;
  }

  function render(): void {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = cells[r * COLS + c];
        const v = grid[r][c];
        el.classList.remove("bp-rainbow");
        el.textContent = "";
        el.classList.toggle("bp-empty", v < 0);
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
        } else {
          el.style.background = COLORS[v].bg;
          el.style.boxShadow = `0 2px 5px ${COLORS[v].ring}66`;
        }
      }
    }
    leftEl.textContent = `🫧 剩 ${countLeft()} 个`;
  }

  function group(r: number, c: number): Array<[number, number]> {
    const color = grid[r][c];
    if (!isColor(color)) return [];
    const seen = new Set<number>();
    const stack: Array<[number, number]> = [[r, c]];
    const out: Array<[number, number]> = [];
    while (stack.length) {
      const [cr, cc] = stack.pop() as [number, number];
      const key = cr * COLS + cc;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cr < 0 || cr >= rows || cc < 0 || cc >= COLS || grid[cr][cc] !== color) continue;
      out.push([cr, cc]);
      stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
    }
    return out;
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

  function collapse(): void {
    for (let c = 0; c < COLS; c++) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (grid[r][c] >= 0) {
          grid[write][c] = grid[r][c];
          if (write !== r) grid[r][c] = -1;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) grid[r][c] = -1;
    }
    let writeCol = 0;
    for (let c = 0; c < COLS; c++) {
      const hasAny = grid.some((row) => row[c] >= 0);
      if (hasAny) {
        if (writeCol !== c) {
          for (let r = 0; r < rows; r++) {
            grid[r][writeCol] = grid[r][c];
            grid[r][c] = -1;
          }
        }
        writeCol++;
      }
    }
  }

  function hasMoves(): boolean {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v === RAINBOW || v === BOLT) return true;
        if (!isColor(v)) continue;
        if (r + 1 < rows && grid[r + 1][c] === v) return true;
        if (c + 1 < COLS && grid[r][c + 1] === v) return true;
      }
    }
    return false;
  }

  function checkEnd(): void {
    if (levelDone || hasMoves()) return;
    levelDone = true;
    const left = countLeft();
    if (left <= cfg.maxLeft) {
      const half = Math.max(cfg.stone, Math.floor(cfg.maxLeft / 2));
      const got = left <= cfg.stone ? 3 : left <= half ? 2 : 1;
      if (left <= cfg.stone) ctx.bonusStars(1);
      later(() => ctx.win(got as 1 | 2 | 3, left <= cfg.stone
        ? "泡泡全部清空，太厉害啦！"
        : `只剩 ${left} 个泡泡，达标！`), 400);
    } else {
      later(() => ctx.lose(`还剩 ${left} 个泡泡，先找大团的同色泡泡下手！`), 400);
    }
  }

  function afterPop(): void {
    later(() => {
      collapse();
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
      msgEl.textContent = "石头敲不破哦，先消别的泡泡～";
      return;
    }
    if (isFrozen(v)) {
      ctx.sfx("oops");
      msgEl.textContent = "这颗冻住啦，在它旁边消一组就能解冻！";
      return;
    }
    if (v === RAINBOW) {
      // 消掉数量最多的颜色
      const counts = new Array<number>(cfg.colors).fill(0);
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (isColor(grid[rr][cc])) counts[grid[rr][cc]]++;
      }
      let best = 0;
      for (let i = 1; i < cfg.colors; i++) if (counts[i] > counts[best]) best = i;
      const list: Array<[number, number]> = [[r, c]];
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (grid[rr][cc] === best) list.push([rr, cc]);
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
    const g = group(r, c);
    if (g.length < 2) {
      ctx.sfx("oops");
      msgEl.textContent = "这颗泡泡太孤单了，找挨在一起的同色泡泡！";
      return;
    }
    ctx.sfx("pop");
    if (g.length >= 8) {
      ctx.bonusStars(1);
      msgEl.textContent = `一口气消掉 ${g.length} 个，奖励一颗小星星！`;
    } else {
      msgEl.textContent = `噗噗！消掉 ${g.length} 个泡泡～`;
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
    mapHint: "全部清空 3 星，剩得越少星星越多！",
    grandMessage: "99 关泡泡全部搞定，你是泡泡小英雄！",
  });
}
