/**
 * 星星消消乐 · 会下落的棋盘（DOM + 时间线）。
 *
 * 闯关的 8×8、对战与无尽的 6×6 用的都是这一个组件：
 * 它只管「怎么演」，「消什么、算什么」由调用方通过 `StageOpts` 的回调给。
 *
 * 演的顺序写死在 `beginSwap` 一路排下去的段落里，一段都不能跳：
 *   swap → (revert | boom → fall → land → 连锁回 boom) → belt → settle
 * 每一段的时长来自 `timings(reduced)`。`prefers-reduced-motion` 只是把数字压到 1 帧，
 * 段落一个不少——所以不存在「只在动画模式才复现」的 bug。
 *
 * 下落期间棋子的**视觉坐标**由 `tweenPos` 算，**逻辑坐标**早已是终值：
 * `visualRowOf(i) !== rowOf(i)` 这句话在 `fall` 段里恒成立，单测就是拿它当验收铁则的。
 */
import type { SoundName } from "../level99";
import {
  asSlide,
  planEndMs,
  planGravity,
  planRefill,
  planSwap,
  planBelt,
  prefersReducedMotion,
  timings,
  tweenPos,
  Runner,
  type FallTween,
  type Phase,
  type SlideTween,
  type Step,
  type Timings,
} from "./anim";
import {
  EMPTY,
  RAINBOW,
  refillOn,
  settleOn,
  SPECIAL_ICON,
  type Cellset,
  type RoundPlan,
} from "./board";

export type { RoundPlan };

export interface TokenSkin {
  emoji: string;
  bg: string;
}

export interface BeltMove {
  slots: number[];
  dir: 1 | -1;
}

/** 一次出手的战果（和引擎的 `CascadeInfo` 同形） */
export interface StageCascade {
  steps: number;
  total: number;
  best: number;
}

export interface StageOpts {
  cell: Cellset;
  tokens: TokenSkin[];
  /** 强制指定「减少动态效果」（不给就读系统偏好） */
  reduced?: boolean;
  sfx?: (n: SoundName) => void;
  /** 这一格点不动（冰块 / 藤蔓 / 挡板） */
  locked?: (i: number) => boolean;
  /** 点这一格的提示语（点不动时说一句） */
  lockedSay?: (i: number) => string;
  /** 能不能试着换（false 就连交换动画都不播） */
  canSwap?: (a: number, b: number) => boolean;
  /** 换过去之后：给出第一轮要清的格子，或者要求原路弹回来 */
  afterSwap: (a: number, b: number) => RoundPlan | "revert";
  /** 连锁：稳定了就返回 null */
  round: () => RoundPlan | null;
  /** 把一轮消除真正落到盘面上（写 EMPTY、结算目标 / 冰块 / 订单…） */
  applyRound: (plan: RoundPlan, chain: number) => void;
  /** 特殊块引爆的下一波；没有就别给（返回 null 表示炸完了） */
  blast?: () => RoundPlan | null;
  /** 补一个新图案 */
  spawn: () => number;
  /** 这一步真的算数了（计步） */
  onMove?: (a: number, b: number) => void;
  /** 换不动，原路弹回来了 */
  onRevert?: (a: number, b: number) => void;
  /** 每一轮消除开始时说一句 */
  onRound?: (plan: RoundPlan, chain: number) => void;
  /** 稳定之后要转的传送带 */
  belts?: () => BeltMove[];
  applyBelt?: (b: BeltMove) => void;
  /** 全稳了：结算订单 / 胜负。整局里这是唯一允许结算的地方 */
  onSettled?: (info: StageCascade) => void;
  /** 每帧画完调一次（刷新面板） */
  onPaint?: () => void;
}

// ---------------------------------------------------------------------------
// 布局（纯函数，单测直接查）
// ---------------------------------------------------------------------------

/** 每格的像素步距：`gap` 是 0，所以整格都是热区 */
export function cellPitch(boardWidth: number, cols: number): number {
  if (!Number.isFinite(boardWidth) || boardWidth <= 0 || cols <= 0) return 44;
  return boardWidth / cols;
}

/** 窄屏把棋盘往两边撑出去，好让 8 列在 360px 上每格还有 44px 以上 */
export function boardBleed(viewportWidth: number): number {
  return viewportWidth <= 420 ? 16 : 0;
}

/** 360px 上棋盘实际能用到的宽度（壳层 10px + 本游戏 6px 的内边距都撑掉） */
export function boardWidthAt(viewportWidth: number): number {
  const pad = viewportWidth <= 420 ? 6 : 10;
  return viewportWidth - 2 * 10 - 2 * pad + 2 * boardBleed(viewportWidth);
}

export const CSS = `
.mst-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFF0F7,#F3F0FF);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.mst-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;}
.mst-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;color:#A66BBE;
  box-shadow:0 2px 6px rgba(180,140,220,.25);font-size:16px;white-space:nowrap;}
/* 目标条:一行可横滑的芯片,绝不换行——换行了最底行就要滚动才点得到 */
.mst-goals{display:flex;gap:6px;margin-bottom:6px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;
  scrollbar-width:none;padding-bottom:2px;}
.mst-goals::-webkit-scrollbar{display:none;}
.mst-goal{flex:0 0 auto;background:#fff;border-radius:12px;padding:4px 10px;font-weight:800;color:#8B6BAE;font-size:14px;
  box-shadow:0 2px 5px rgba(180,140,220,.2);white-space:nowrap;}
.mst-goal.mst-done{background:#E4F9E0;color:#57A05B;}
.mst-goal.mst-order{background:#FFF1DC;color:#A8762F;}
.mst-goal.mst-order.mst-done{background:#E4F9E0;color:#57A05B;}
.mst-goal.mst-boss{background:#EDEFE8;color:#6B7360;}
.mst-bar{height:10px;background:#fff;border-radius:8px;overflow:hidden;margin-bottom:6px;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.08);}
.mst-fill{height:100%;width:0%;background:linear-gradient(90deg,#FFB6D9,#C9A7F5);border-radius:8px;transition:width .3s;}
.mst-boardwrap{position:relative;overflow:hidden;border-radius:14px;background:rgba(255,255,255,.35);
  margin-inline:calc(-1 * var(--mst-bleed, 0px));}
/* gap 为 0:整格都是热区,360px 上 8 列每格 45px */
.mst-board{display:grid;gap:0;}
.mst-cell{position:relative;aspect-ratio:1;border:none;background:transparent;padding:0;margin:0;cursor:pointer;
  display:block;font-family:inherit;-webkit-tap-highlight-color:transparent;}
.mst-tile{position:absolute;inset:2px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  font-size:clamp(17px,4.6vw,26px);line-height:1;overflow:hidden;}
/* 轻微高光:唯一允许的立体感,不做透视 */
.mst-tile::before{content:"";position:absolute;left:12%;top:8%;width:34%;height:26%;border-radius:50%;
  background:rgba(255,255,255,.55);pointer-events:none;}
.mst-cell.mst-sel .mst-tile{box-shadow:0 0 0 3px #FF8FC7;}
.mst-cell.mst-cursor .mst-tile{box-shadow:0 0 0 3px #6FA8DC;}
.mst-cell.mst-ice .mst-tile::after{content:"🧊";position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-size:1.1em;background:rgba(200,235,255,.5);}
.mst-cell.mst-vine .mst-tile{box-shadow:inset 0 0 0 3px #8FD08A;}
.mst-cell.mst-vine .mst-tile::after{content:"🌿";position:absolute;right:1px;top:0;font-size:.72em;}
.mst-cell.mst-frost1 .mst-tile{background-image:linear-gradient(135deg,rgba(255,224,240,.66),rgba(255,224,240,.66));}
.mst-cell.mst-frost2 .mst-tile{background-image:linear-gradient(135deg,rgba(255,203,232,.88),rgba(255,203,232,.88));}
.mst-cell.mst-frost1 .mst-tile::after,.mst-cell.mst-frost2 .mst-tile::after{content:"🍥";position:absolute;
  right:1px;bottom:0;font-size:.7em;}
.mst-cell.mst-solid .mst-tile{background:repeating-linear-gradient(45deg,#B9A88F,#B9A88F 6px,#A5937A 6px,#A5937A 12px);
  box-shadow:inset 0 0 0 3px #8C7B63;}
.mst-cell.mst-solid .mst-tile::after{content:"🧱";position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-size:1.05em;}
.mst-cell.mst-belt .mst-tile{outline:2px dashed #7FB7D8;outline-offset:-4px;}
.mst-spec{position:absolute;right:1px;bottom:0;font-size:.66em;}
.mst-msg{text-align:center;min-height:22px;color:#B06BC0;font-weight:800;margin-top:6px;font-size:15px;line-height:1.4;}
.mst-btn{border:none;border-radius:16px;min-height:44px;padding:10px 16px;font-size:16px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#D882B6,#BD6497);box-shadow:0 4px 0 #994B79;}
.mst-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #994B79;}
.mst-btn-vs{background:linear-gradient(180deg,#7FA7EA,#5A82C9);box-shadow:0 4px 0 #446299;}
.mst-btn-vs:active{box-shadow:0 2px 0 #446299;}
.mst-btn-duo{background:linear-gradient(180deg,#8AC79C,#65A87A);box-shadow:0 4px 0 #4C8B60;}
.mst-btn-duo:active{box-shadow:0 2px 0 #4C8B60;}
.mst-btn-ghost{background:#ffffffd9;color:#7A5AA0;box-shadow:0 3px 0 rgba(120,90,160,.25);}
.mst-btn-ghost:active{box-shadow:0 1px 0 rgba(120,90,160,.25);}
.mst-bar-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.mst-seats{display:flex;gap:10px;align-items:stretch;justify-content:center;flex-wrap:wrap;}
.mst-seat{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:4px;}
.mst-seat-name{font-size:15px;font-weight:900;color:#7A5AA0;text-align:center;}
.mst-over{position:absolute;inset:0;background:rgba(255,250,253,.95);border-radius:16px;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;z-index:6;}
.mst-over-t{font-size:22px;font-weight:900;color:#A24E86;}
.mst-over-s{font-size:16px;font-weight:700;color:#7C6390;line-height:1.6;max-width:300px;}
@media (max-width:420px){
  .mst-wrap{padding:6px;--mst-bleed:16px;}
  .mst-seats{flex-direction:column;}
}
@media (prefers-reduced-motion:reduce){
  .mst-fill{transition:none;}
}
`;

export interface Stage {
  root: HTMLElement;
  board: HTMLElement;
  /** 逻辑盘面（调用方和它共享同一份引用） */
  cell: Cellset;
  /** 当前处在时间线的哪一段 */
  phase: () => Phase;
  /** 时间线还在跑吗（跑着的时候不接受输入） */
  busy: () => boolean;
  /** 走过的段落轨迹：单测拿它证明 reduced-motion 走的是同一条路 */
  trace: () => Phase[];
  /** 逻辑行 */
  rowOf: (i: number) => number;
  /** 视觉行（浮点）：下落没走完时它不等于逻辑行 */
  visualRowOf: (i: number) => number;
  visualColOf: (i: number) => number;
  /** 有没有方块此刻正飘在半空 */
  movingCount: () => number;
  /** 模拟点一格（真人点击走的也是这条） */
  tap: (i: number) => void;
  /** 直接发起一次交换（键盘 / 人机用） */
  swap: (a: number, b: number) => void;
  selected: () => number;
  setCursor: (i: number) => void;
  setEnabled: (v: boolean) => void;
  /** 重画一次（面板变了、盘面被外部改了都调它） */
  paint: () => void;
  /** 单帧推进：单测用虚拟时钟一帧一帧走 */
  frame: (now: number) => void;
  timings: Timings;
  destroy: () => void;
}

export function createStage(host: HTMLElement, opts: StageOpts): Stage {
  const cell = opts.cell;
  const { cols, rows } = cell;
  const reduced = opts.reduced ?? prefersReducedMotion();
  const T = timings(reduced);
  const runner = new Runner();

  const root = document.createElement("div");
  root.className = "mst-boardwrap";
  const board = document.createElement("div");
  board.className = "mst-board";
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  root.appendChild(board);
  host.appendChild(root);

  const cells: HTMLButtonElement[] = [];
  const tiles: HTMLElement[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mst-cell";
    const tile = document.createElement("span");
    tile.className = "mst-tile";
    btn.appendChild(tile);
    btn.addEventListener("click", () => tap(i));
    board.appendChild(btn);
    cells.push(btn);
    tiles.push(tile);
  }

  /** 正飘在半空的方块：key 是它最终落进的格子 */
  let moving = new Map<number, SlideTween>();
  let boomSet = new Set<number>();
  let landSet = new Set<number>();
  let selected = -1;
  let cursor = -1;
  let enabled = true;
  let destroyed = false;
  let raf = 0;
  let acc: StageCascade = { steps: 0, total: 0, best: 0 };
  let beltsDone = false;

  const rowOf = (i: number): number => Math.floor(i / cols);
  const colOf = (i: number): number => i % cols;

  function pitch(): number {
    const w = board.clientWidth || root.clientWidth || 0;
    return cellPitch(w, cols);
  }

  function setMoving(list: SlideTween[]): void {
    moving = new Map();
    for (const tw of list) moving.set(tw.cell, tw);
  }

  function visualRowOf(i: number): number {
    const tw = moving.get(i);
    return tw ? tweenPos(tw, runner.elapsed).row : rowOf(i);
  }

  function visualColOf(i: number): number {
    const tw = moving.get(i);
    return tw ? tweenPos(tw, runner.elapsed).col : colOf(i);
  }

  function paint(): void {
    const px = pitch();
    const boom = runner.phase === "boom" ? runner.progress : 0;
    const land = runner.phase === "land" ? runner.progress : 0;
    for (let i = 0; i < cells.length; i++) {
      const btn = cells[i];
      const tile = tiles[i];
      const v = cell.grid[i];
      const sp = cell.special[i];
      if (cell.solid[i]) {
        tile.textContent = "";
        tile.style.background = "";
      } else if (v === RAINBOW) {
        tile.textContent = "🌈";
        tile.style.background = "#fff";
      } else if (v === EMPTY) {
        tile.textContent = "";
        tile.style.background = "rgba(255,255,255,.28)";
      } else {
        const skin = opts.tokens[v] ?? opts.tokens[0];
        tile.textContent = sp ? `${skin.emoji}${SPECIAL_ICON[sp] ?? ""}` : skin.emoji;
        tile.style.background = skin.bg;
      }
      btn.classList.toggle("mst-ice", !!cell.fixed[i] && !!(cell as { ice?: boolean[] }).ice?.[i]);
      btn.classList.toggle("mst-vine", !!(cell as { vine?: boolean[] }).vine?.[i]);
      const frost = (cell as { frost?: number[] }).frost?.[i] ?? 0;
      btn.classList.toggle("mst-frost1", frost === 1);
      btn.classList.toggle("mst-frost2", frost >= 2);
      btn.classList.toggle("mst-solid", !!cell.solid[i]);
      btn.classList.toggle("mst-sel", i === selected);
      btn.classList.toggle("mst-cursor", i === cursor);

      const tw = moving.get(i);
      let dx = 0;
      let dy = 0;
      if (tw) {
        const pos = tweenPos(tw, runner.elapsed);
        dx = (pos.col - colOf(i)) * px;
        dy = (pos.row - rowOf(i)) * px;
      }
      let scale = 1;
      let opacity = 1;
      if (boomSet.has(i)) {
        scale = 1 + 0.3 * boom;
        opacity = 1 - boom;
      } else if (landSet.has(i) && !reduced) {
        // 落地压扁 8%,一次回弹。reduced-motion 下这一段照走,只是不形变
        scale = 1 - 0.08 * Math.sin(Math.PI * land);
      }
      btn.style.transform = dx || dy ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` : "";
      tile.style.transform = scale === 1 ? "" : `scale(${scale.toFixed(3)})`;
      tile.style.opacity = opacity === 1 ? "" : opacity.toFixed(3);
      const locked = opts.locked?.(i) ?? false;
      btn.disabled = !enabled;
      btn.setAttribute("aria-label", describe(i, locked));
    }
    opts.onPaint?.();
  }

  function describe(i: number, locked: boolean): string {
    const r = rowOf(i) + 1;
    const c = colOf(i) + 1;
    if (cell.solid[i]) return `第 ${r} 行第 ${c} 列，挡板`;
    const v = cell.grid[i];
    const name = v === RAINBOW ? "彩虹星" : v === EMPTY ? "空格" : (opts.tokens[v] ?? opts.tokens[0]).emoji;
    return `第 ${r} 行第 ${c} 列，${name}${locked ? "，被机关卡住" : ""}`;
  }

  // -------------------------------------------------------------------------
  // 时间线
  // -------------------------------------------------------------------------

  function pushStep(step: Step): void {
    runner.push(step);
  }

  /** 第 3 段：匹配格爆开 */
  function boomStep(plan: RoundPlan, chain: number): void {
    pushStep({
      phase: "boom",
      durMs: T.boomMs,
      enter: () => {
        boomSet = new Set(plan.cells);
        acc = {
          steps: acc.steps + 1,
          total: acc.total + plan.cells.length,
          best: Math.max(acc.best, plan.cells.length),
        };
        opts.sfx?.("pop");
        opts.onRound?.(plan, chain);
      },
      done: () => {
        boomSet = new Set();
        opts.applyRound(plan, chain);
        // 特殊块引爆:再炸一波,依旧排进同一条时间线,绝不一次清盘
        const wave = opts.blast?.();
        if (wave && wave.cells.length > 0) {
          boomStep(wave, chain);
          return;
        }
        fallStep(chain);
      },
    });
  }

  /** 第 4/5 段：重力 + 补块。逻辑先到位，视觉从旧格滑过来 */
  function fallStep(chain: number): void {
    const step: Step = {
      phase: "fall",
      durMs: 1,
      enter: () => {
        const before = cell.grid.slice();
        settleOn(cell.grid, cols, rows, cell);
        const settled = cell.grid.slice();
        const planOpts = {
          fixed: cell.fixed,
          solid: cell.solid,
          perCellMs: T.perCellMs,
          staggerMs: T.staggerMs,
        };
        const spawns = planRefill(settled, cols, planOpts);
        refillOn(cell.grid, cols, rows, opts.spawn, cell);
        const falls: FallTween[] = planGravity(before, cell.grid, cols, planOpts);
        // 新块的图案要等补完才知道
        for (const sp of spawns) sp.cell = cell.grid[sp.toRow * cols + sp.col];
        const all = [...falls, ...spawns];
        const slides = all.map((f) => asSlide(f, cols));
        setMoving(slides);
        landSet = new Set(slides.map((s) => s.cell));
        step.durMs = Math.max(1, planEndMs(all));
      },
      done: () => {
        setMoving([]);
        landStep(chain);
      },
    };
    pushStep(step);
  }

  /** 第 6 段：落地压扁回弹，稳定之后才检测连锁 */
  function landStep(chain: number): void {
    pushStep({
      phase: "land",
      durMs: T.landMs,
      done: () => {
        landSet = new Set();
        const next = opts.round();
        if (next && next.cells.length > 0) {
          // 连锁不耗步:这里不再调 onMove
          boomStep(next, chain + 1);
          return;
        }
        beltStep(chain);
      },
    });
  }

  /** 第 7 段：传送带滑移（同样不许瞬跳），转完可能又连锁 */
  function beltStep(chain: number): void {
    const moves = beltsDone ? [] : opts.belts?.() ?? [];
    beltsDone = true;
    for (const b of moves) {
      if (b.slots.length < 2) continue;
      pushStep({
        phase: "belt",
        durMs: T.beltMs,
        enter: () => {
          opts.applyBelt?.(b);
          setMoving(planBelt(b.slots, b.dir, cols, T.beltMs));
        },
        done: () => setMoving([]),
      });
    }
    pushStep({
      phase: "settle",
      durMs: T.settleMs,
      done: () => {
        const next = opts.round();
        if (next && next.cells.length > 0) {
          boomStep(next, chain + 1);
          return;
        }
        const info = acc;
        acc = { steps: 0, total: 0, best: 0 };
        beltsDone = false;
        opts.onSettled?.(info);
      },
    });
  }

  /** 第 1/2 段：交换 → 没匹配就原路弹回来 */
  /** 发起一次交换。`enabled` 只挡真人的手指，人机与键盘走这条不受影响 */
  function beginSwap(a: number, b: number): void {
    if (runner.busy || destroyed) return;
    if (opts.canSwap && !opts.canSwap(a, b)) {
      opts.sfx?.("oops");
      opts.onRevert?.(a, b);
      paint();
      return;
    }
    selected = -1;
    pushStep({
      phase: "swap",
      durMs: T.swapMs,
      enter: () => {
        [cell.grid[a], cell.grid[b]] = [cell.grid[b], cell.grid[a]];
        [cell.special[a], cell.special[b]] = [cell.special[b], cell.special[a]];
        setMoving(planSwap(a, b, cols, T.swapMs));
        opts.sfx?.("tap");
      },
      done: () => {
        setMoving([]);
        const verdict = opts.afterSwap(a, b);
        if (verdict === "revert") {
          pushStep({
            phase: "revert",
            durMs: T.swapMs,
            enter: () => {
              [cell.grid[a], cell.grid[b]] = [cell.grid[b], cell.grid[a]];
              [cell.special[a], cell.special[b]] = [cell.special[b], cell.special[a]];
              setMoving(planSwap(a, b, cols, T.swapMs));
              opts.sfx?.("oops");
            },
            done: () => {
              setMoving([]);
              opts.onRevert?.(a, b);
            },
          });
          return;
        }
        opts.onMove?.(a, b);
        acc = { steps: 0, total: 0, best: 0 };
        beltsDone = false;
        boomStep(verdict, 1);
      },
    });
  }

  function tap(i: number): void {
    if (!enabled || runner.busy || destroyed) return;
    if (opts.locked?.(i)) {
      opts.sfx?.("oops");
      opts.onRevert?.(i, i);
      paint();
      return;
    }
    if (selected === -1 || selected === i) {
      selected = selected === i ? -1 : i;
      if (selected >= 0) opts.sfx?.("tap");
      paint();
      return;
    }
    const ra = rowOf(selected), ca = colOf(selected);
    const rb = rowOf(i), cb = colOf(i);
    if (Math.abs(ra - rb) + Math.abs(ca - cb) !== 1) {
      selected = i;
      opts.sfx?.("tap");
      paint();
      return;
    }
    const a = selected;
    beginSwap(a, i);
  }

  function frame(now: number): void {
    if (destroyed) return;
    runner.tick(now);
    paint();
  }

  const loop = (now: number): void => {
    if (destroyed) return;
    frame(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  paint();

  return {
    root,
    board,
    cell,
    phase: () => runner.phase,
    busy: () => runner.busy,
    trace: () => runner.trace,
    rowOf,
    visualRowOf,
    visualColOf,
    movingCount: () => moving.size,
    tap,
    swap: beginSwap,
    selected: () => selected,
    setCursor: (i: number) => {
      cursor = i;
      paint();
    },
    setEnabled: (v: boolean) => {
      enabled = v;
      paint();
    },
    paint,
    frame,
    timings: T,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      runner.clear();
      root.remove();
    },
  };
}
