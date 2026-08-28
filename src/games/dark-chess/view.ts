/**
 * 翻翻暗棋 · 棋盘视图。
 *
 * 32 个格子就是 32 个按钮，点一下翻子，再点一下走子；
 * 键盘朵朵用 WASD + F / G，星星用方向键 + L / K，各管各的一个光标。
 * 单人局里方向键与 L / K 是朵朵的别名，老键位一条都不丢。
 * 翻子和吃子都有动画，不许瞬变。
 *
 * 1.3 视觉升级（画皮不动骨，规则与回调时序一根手指都不碰）：
 *  - 每格画面是 `innerHTML` 写入的 SVG 面板层（见 `setCellContent`），文字口径统一走
 *    `refresh()` 里逐格重设的 `aria-label`（空格 / 还盖着 / 红蓝 + 兵种）——既是读屏正文，
 *    也是测试契约（r3 起替代早年被 innerHTML 覆盖的 textContent 桩层）；
 *  - 牌背 / 棋面 / 花瓣等绘制资产全部来自 `./art` 的纯函数。
 */
import { COLS, KINDS, RANK, ROWS, colOf, indexOf, labelOf, rowOf, type Color, type Kind } from "./board";
import { backSVG, hourglassSVG, miniPieceSVG, petalSVG, pieceFaceSVG, svgUri } from "./art";
import {
  applyAction,
  coveredCount,
  legalActions,
  movesFrom,
  mustFlip,
  remainingUnknown,
  status,
  type Action,
  type GameState,
  type Side,
} from "./rules";

/** 两枚倒数 chip 前的小沙漏，颜色跟各自的字色走，双色区分不丢 */
const QUIET_HOURGLASS = svgUri(hourglassSVG("#5b46a8"));
const CAP_HOURGLASS = svgUri(hourglassSVG("#95651a"));

export const CSS = `
.dc-board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;width:100%;max-width:520px;margin:0 auto;
  position:relative;padding:7px;border:6px solid #9a6a3a;border-radius:16px;
  background:linear-gradient(180deg,#f3e3c6,#e7d2ae);box-shadow:0 3px 0 #7c5227,inset 0 1px 0 #fff3dd;}
/* 格尺寸完全跟随轨道（r2-1 回归修复）：实测 Chrome 会把 min-height 经 aspect-ratio 传导成
   44px 固定宽，收缩轨道上相邻格互叠 10–14px、末列出棋盘框——格子本身不再写最小尺寸，
   方格边长由 aspect-ratio 从轨道宽得出，360/320 一行八格永远排得下 */
.dc-cell{position:relative;aspect-ratio:1/1;min-width:0;min-height:0;border:none;border-radius:10px;cursor:pointer;padding:0;
  font-family:inherit;font-size:20px;font-weight:900;line-height:1;background:#EBD9BD;color:#7a5a34;
  box-shadow:0 2px 0 rgba(150,120,80,.35);transition:transform .16s ease,opacity .18s ease;}
/* 44px 触控红线改由零视觉扩展点击区保住：格宽不足 44 时 inset 取负值把热区补到 44×44，
   格宽 ≥44 时被 min() 钳回 0 不缩热区；伪元素命中仍算按钮本体，热区中心一格不挪。
   空格是禁用按钮，不给扩展区——免得它盖住邻格边缘吞掉点击 */
.dc-cell:not(.dc-empty)::before{content:"";position:absolute;inset:min(0px,calc((100% - 44px)/2));}
/* 石板格：斜向交替 2% 左右的明度差，8 列在眼里就不糊成一片 */
.dc-cell.dc-alt{background:#E4D2B2;}
.dc-cell:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.dc-cell.dc-empty{background:#F7EEDF;box-shadow:none;cursor:default;}
.dc-cell.dc-empty.dc-alt{background:#F1E6D2;}
.dc-cell.dc-red{background:#FFF3F1;color:#c03a2b;}
.dc-cell.dc-blue{background:#EFF4FD;color:#245ba8;}
.dc-cell.dc-sel{outline:3px solid #ff9a3c;outline-offset:1px;}
.dc-cell.dc-can{box-shadow:0 0 0 3px #8fd3a8 inset;}
/* 可吃提示：绿色高亮的目标格角落再落一枚朝下的小箭头（进得了 movesFrom 的才算可吃） */
.dc-cell.dc-eat::after{content:"";position:absolute;top:2px;right:3px;border:5px solid transparent;
  border-top:8px solid #2c9a5b;filter:drop-shadow(0 1px 0 #fff);}
.dc-cell.dc-cursor{outline:3px dashed #7f6bd0;outline-offset:1px;}
/* 翻面两段式：前半段把牌背旋到 90°，JS 在中点换面，后半段用 dcFlipIn 从 -90° 转回来——正反两张脸 */
.dc-cell.dc-flip1{transform:rotateY(90deg) scale(.92);transition:transform .1s ease-in;}
.dc-cell.dc-flip2{animation:dcFlipIn .1s ease-out;}
@keyframes dcFlipIn{from{transform:rotateY(-90deg) scale(.92);}to{transform:rotateY(0) scale(1);}}
/* 走子 / 吃子：棋子滑过去（120ms），不再原地闪现 */
.dc-cell.dc-slide{transition:transform .12s ease-in;z-index:2;}
.dc-cell.dc-gone{opacity:0;transform:scale(.5);}
.dc-face{position:absolute;inset:0;pointer-events:none;}
.dc-face svg{display:block;width:100%;height:100%;}
/* 吃子=花瓣退场：三片粉花瓣往三个方向飘 */
.dc-petal{position:absolute;left:50%;top:50%;width:13px;height:13px;margin:-6px 0 0 -6px;pointer-events:none;opacity:.95;}
.dc-petal svg{display:block;width:100%;height:100%;}
.dc-petal.dc-p1{animation:dcPetalA .5s ease-out forwards;}
.dc-petal.dc-p2{animation:dcPetalB .55s ease-out forwards;}
.dc-petal.dc-p3{animation:dcPetalC .6s ease-out forwards;}
@keyframes dcPetalA{to{transform:translate(-20px,-24px) rotate(-150deg);opacity:0;}}
@keyframes dcPetalB{to{transform:translate(2px,-30px) rotate(120deg);opacity:0;}}
@keyframes dcPetalC{to{transform:translate(20px,-20px) rotate(200deg);opacity:0;}}
/* 炮的跳吃路径：一条虚线弧，只画 movesFrom 已经给出的落点，纯视觉提示 */
.dc-arcs{position:absolute;inset:0;pointer-events:none;}
.dc-arcs svg{display:block;width:100%;height:100%;}
.dc-boardwrap{position:relative;}
/* 胜利花瓣雨（≤12 片，弱动效整层不放） */
.dc-rain{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:16px;}
.dc-rain .dc-petal{top:-16px;margin:0;animation:dcRain 1.5s ease-in forwards;}
@keyframes dcRain{to{transform:translateY(560px) rotate(220deg);opacity:.1;}}
/* 结算演出：输方整排变灰鞠躬，赢方列队小跳，和棋两枚棋子相对碰杯 */
.dc-cell.dc-bow{filter:grayscale(1);opacity:.72;transform:rotate(15deg);}
.dc-cell.dc-parade{animation:dcHop .55s ease-in-out 2;}
@keyframes dcHop{50%{transform:translateY(-5px) scale(1.04);}}
.dc-cell.dc-cheer-l{transform:rotate(-15deg);}
.dc-cell.dc-cheer-r{transform:rotate(15deg);}
.dc-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.dc-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#7a5a34;
  box-shadow:0 2px 6px rgba(160,130,90,.25);white-space:nowrap;}
.dc-chip.dc-hot{background:#FFE9DC;color:#b4501f;}
/* 和棋倒数:摆出来就说明快判和了,配色比普通提示更抢眼一点 */
.dc-chip.dc-quiet{background:#EDE7FF;color:#5b46a8;}
/* 手数上限倒数:另一条也会收场的线,配色和和棋倒数分开,一眼看得出说的是哪一条 */
.dc-chip.dc-cap{background:#FFF0D6;color:#95651a;}
/* 两枚倒数 chip 前各摆一粒小沙漏（绘制资产，不用字符占位），颜色各随其字 */
.dc-chip.dc-quiet::before,.dc-chip.dc-cap::before{content:"";display:inline-block;width:12px;height:12px;
  margin:0 4px -1px 0;background:url("${QUIET_HOURGLASS}") center/contain no-repeat;}
.dc-chip.dc-cap::before{background:url("${CAP_HOURGLASS}") center/contain no-repeat;}
.dc-note{text-align:center;min-height:20px;font-size:14px;font-weight:700;color:#795b3a;margin-top:8px;line-height:1.5;}
.dc-count{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.dc-count span{font-size:14px;font-weight:800;border-radius:999px;padding:3px 8px;background:#fff8ec;color:#8a6a40;
  display:inline-flex;align-items:center;gap:3px;}
.dc-count .dc-ct{font-weight:900;margin-right:2px;}
.dc-count .dc-ck{position:relative;display:inline-flex;align-items:center;gap:1px;}
.dc-count .dc-ck svg{width:15px;height:15px;display:block;}
.dc-count .dc-ck.dc-off{opacity:.55;}
.dc-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.dc-btn{border:none;border-radius:999px;padding:9px 15px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7a5a34;box-shadow:0 3px 0 rgba(160,130,90,.3);min-height:44px;}
.dc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(160,130,90,.3);}
/* 窄屏把格间距收一点:8 列摊在 360px 上,每省 1px 间距就还给格子 0.875px 宽 */
@media (max-width:400px){ .dc-cell{font-size:18px;} .dc-board{gap:3px;}
  .dc-board{padding:3px;border-width:4px;}
  /* 最小格里点数行自动收起，只留汉字，别挤糊了 */
  .dc-face g.dcd{display:none;} }
/* N-65:8 列大方格把取消/暂停顶到 518。矮宽屏收盘钉工具 */
@media (min-width:640px) and (max-height:500px){
  .dc-board{max-width:min(280px,62dvh);}
  .dc-row{position:sticky;bottom:0;z-index:4;margin-top:4px;padding:4px 0 2px;
    background:linear-gradient(180deg,rgba(255,248,236,.35),#fff8ec);}
}
@media (prefers-reduced-motion:reduce){ .dc-cell{transition-duration:.06s;} .dc-btn:active{transform:none;}
  .dc-cell.dc-flip2,.dc-petal,.dc-cell.dc-parade{animation-duration:.05s;}
  .dc-rain .dc-petal{animation:none;opacity:0;} }
/* N-65:dc-duoplay board width; 8-col landscape pushed cancel/pause off 412 */
@media (max-height:500px){
  .dc-duoplay .dc-board{max-width:min(280px,56dvh);}
  .dc-duoplay .dc-row{position:sticky;bottom:0;z-index:6;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(255,248,236,.3),#fff8ec 40%);}
  .dc-duoplay .dc-note{min-height:0;max-height:1.4em;overflow:hidden;margin-top:4px;}
  .dc-duoplay .dc-count{max-height:2.2em;overflow:hidden;}
}
@media (max-height:840px){
  .dc-duoplay .dc-row{position:sticky;bottom:0;z-index:6;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(255,248,236,.3),#fff8ec 40%);}
  .dc-duoplay .dc-board{max-width:min(360px,62dvh);}
}
`;

function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

/**
 * 记牌面板的一行字。
 *
 * 暗棋真正要学的是「大子翻出来没有」：还剩一枚帅没露面，谁都不敢把士往前送。
 * `remainingUnknown()` 一直是按兵种数的（函数注释写的就是「还有哪些兵种没露过面」），
 * 以前屏幕上只落下一个总数，最要紧的那半截被丢掉了。
 * 现在按相克次序从大到小列出来，翻光了的兵种自动不占位置，一行还是一行。
 * 1.3 之后这行字仍是读屏与降级环境的正文，图形面板见 `counterIconsHTML`。
 */
export function counterLine(color: Color, left: Record<Kind, number>): string {
  const head = `${color === "red" ? "红" : "蓝"}还盖着 ${KINDS.reduce((a, k) => a + left[k], 0)}`;
  const kinds = KINDS.slice()
    .sort((a, b) => RANK[b] - RANK[a])
    .filter((k) => left[k] > 0)
    .map((k) => `${labelOf(color, k)}${left[k]}`);
  return kinds.length > 0 ? `${head} · ${kinds.join(" ")}` : `${head} · 都翻出来啦`;
}

/**
 * 记牌面板的图形行：每兵种一枚迷你棋子 + 数字，排序沿用 `counterLine` 的相克次序；
 * 翻光了的兵种不再消失，而是灰下来划一道线——「已经没有了」也是要紧信息。
 */
export function counterIconsHTML(color: Color, left: Record<Kind, number>): string {
  const total = KINDS.reduce((a, k) => a + left[k], 0);
  const items = KINDS.slice()
    .sort((a, b) => RANK[b] - RANK[a])
    .map(
      (k) =>
        `<i class="dc-ck${left[k] > 0 ? "" : " dc-off"}">${miniPieceSVG(color, k, left[k] === 0)}<b>${left[k]}</b></i>`
    )
    .join("");
  return `<b class="dc-ct">${color === "red" ? "红" : "蓝"} ${total}</b>${items}`;
}

export interface BoardOptions {
  state: GameState;
  /** 哪几方由真人操作 */
  humans: Side[];
  showCounter: boolean;
  /** 真人走完一手（AI 由外面驱动） */
  onHumanAction: (a: Action) => void;
  onNote: (text: string) => void;
}

export interface BoardHandle {
  refresh: () => void;
  /**
   * 播一段翻子 / 吃子动画，结束后回调。
   * `from` 是走子 / 吃子的出发格（有它棋子才滑得起来），翻子不传。
   * done 的时序与 1.2 完全一致：flip 200ms、capture 180ms、弱动效一律 80ms。
   */
  animate: (kind: "flip" | "capture", at: number, done: () => void, from?: number) => void;
  /** 收回当前这一方选中的子（取消键 / 取消按钮共用） */
  cancel: (side?: Side) => void;
  /** 结算演出：赢棋输方鞠躬 + 金花瓣雨，和棋两枚棋子碰杯。只动画，不碰数据与回调 */
  flourish: (outcome: { kind: "win"; winner: Color } | { kind: "draw" }) => void;
  destroy: () => void;
  /** 单测用：某一方的光标在哪一格（不传就是屏幕上画着的那一个） */
  cursor: (side?: Side) => number;
  /** 单测用：当前选中的是哪一格（没选是 -1） */
  selected: () => number;
}

export function createBoard(host: HTMLElement, opts: BoardOptions): BoardHandle {
  const soft = reducedMotion();
  const state = opts.state;
  const wrap = document.createElement("div");
  wrap.className = "dc-boardwrap";
  const grid = document.createElement("div");
  grid.className = "dc-board";
  const counter = document.createElement("div");
  counter.className = "dc-count";
  counter.hidden = !opts.showCounter;
  wrap.append(grid, counter);
  host.appendChild(wrap);

  const cells: HTMLButtonElement[] = [];
  let selected = -1;
  /** 一人一个光标：朵朵从左上角起，星星从右下角起，谁也拨不走谁的 */
  const cursors: Record<Side, number> = { duo: 0, star: ROWS * COLS - 1 };
  let targets: number[] = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let destroyed = false;

  /**
   * 每格现在画的是什么（empty / back / 色:兵种）。
   * 光标动一下就要 refresh 一次，SVG 层只在这把钥匙变了才重写，其余时候只换 class。
   */
  const contentKeys: string[] = new Array(ROWS * COLS).fill("");
  /** 每格手动挂上去的元素（面板层、花瓣），换内容时先摘干净，别在测试桩里越积越多 */
  const extras: HTMLElement[][] = Array.from({ length: ROWS * COLS }, () => []);

  /** 单人局里星星那一套键（方向键 + L / K）也归朵朵，老键位一条都不丢 */
  const starSeat: Side = opts.humans.includes("star") ? "star" : "duo";

  function humanTurn(): boolean {
    return opts.humans.includes(state.turn);
  }

  /** 屏幕上只画一个光标：轮到谁就画谁的；电脑回合里画留在原地的那位真人的 */
  function activeSeat(): Side {
    return humanTurn() ? state.turn : (opts.humans[0] ?? "duo");
  }

  function clickCell(i: number, side: Side = activeSeat()): void {
    if (destroyed || status(state).kind !== "playing" || !humanTurn()) return;
    // 双人同屏：不是你的回合，你的确认键连光标都挪不动，更别说替对方落子
    if (side !== state.turn) return;
    cursors[side] = i;
    const c = state.cells[i];
    if (selected >= 0 && targets.includes(i)) {
      const from = selected;
      selected = -1;
      targets = [];
      opts.onHumanAction({ type: "move", from, to: i });
      return;
    }
    if (c && c.covered) {
      selected = -1;
      targets = [];
      opts.onHumanAction({ type: "flip", at: i });
      return;
    }
    if (mustFlip(state)) {
      opts.onNote("第一手只能翻一枚盖着的棋子。");
      refresh();
      return;
    }
    const mine = state.colors[state.turn];
    if (c && !c.covered && mine && c.color === mine) {
      selected = i;
      targets = movesFrom(state.cells, i);
      if (targets.length === 0) opts.onNote("这一枚暂时没地方去，换一枚试试。");
      refresh();
      return;
    }
    selected = -1;
    targets = [];
    refresh();
  }

  for (let i = 0; i < ROWS * COLS; i++) {
    const b = document.createElement("button") as HTMLButtonElement;
    b.type = "button";
    b.className = "dc-cell";
    b.addEventListener("click", () => clickCell(i));
    grid.appendChild(b);
    cells.push(b);
  }

  /** 炮的跳吃虚线弧画在这一层，盖在格子上但不接事件 */
  const arcs = document.createElement("div");
  arcs.className = "dc-arcs";
  arcs.hidden = true;
  grid.appendChild(arcs);

  function moveCursor(dr: number, dc: number, side: Side = activeSeat()): void {
    if (destroyed) return;
    const from = cursors[side];
    const r = Math.max(0, Math.min(ROWS - 1, rowOf(from) + dr));
    const c = Math.max(0, Math.min(COLS - 1, colOf(from) + dc));
    cursors[side] = indexOf(r, c);
    refresh();
  }

  function cancel(side: Side = activeSeat()): void {
    if (destroyed) return;
    // 选中的那一枚归当前该走的那一方，别人的取消键碰不着
    if (side !== activeSeat()) return;
    selected = -1;
    targets = [];
    refresh();
  }

  // 两套键位各管各的座位：朵朵 WASD + F / G，星星 方向键 + L / K
  const DUO_MOVE: Record<string, [number, number]> = {
    w: [-1, 0],
    s: [1, 0],
    a: [0, -1],
    d: [0, 1],
  };
  const STAR_MOVE: Record<string, [number, number]> = {
    arrowup: [-1, 0],
    arrowdown: [1, 0],
    arrowleft: [0, -1],
    arrowright: [0, 1],
  };

  function onKey(e: KeyboardEvent): void {
    if (destroyed) return;
    const k = e.key.toLowerCase();
    let handled = true;
    if (DUO_MOVE[k]) moveCursor(DUO_MOVE[k][0], DUO_MOVE[k][1], "duo");
    else if (STAR_MOVE[k]) moveCursor(STAR_MOVE[k][0], STAR_MOVE[k][1], starSeat);
    else if (k === "f") clickCell(cursors.duo, "duo");
    else if (k === "l") clickCell(cursors[starSeat], starSeat);
    else if (k === "g") cancel("duo");
    else if (k === "k") cancel(starSeat);
    else handled = false;
    if (handled) e.preventDefault();
  }

  window.addEventListener("keydown", onKey);

  /**
   * 重写某一格的 SVG 面板层。
   *
   * 文字口径不在这儿：`refresh()` 每轮都会按三态重设 `aria-label`（读屏正文兼测试契约）。
   * 1.2 时代的 textContent 降级桩在真实 DOM 里总被紧随的 innerHTML 整体抹掉、
   * 零渲染零读屏价值，r3 终验清理掉（r1 遗留 1 / r2 fixer 移交 / A 档 r3 对账 #12）。
   * 钥匙没变就一个字节都不写——光标每动一下都要 refresh，别让 32 格白白重画。
   */
  function setCellContent(i: number): void {
    const b = cells[i];
    const c = state.cells[i];
    const key = !c ? "empty" : c.covered ? "back" : `${c.color}:${c.kind}`;
    if (contentKeys[i] === key) return;
    contentKeys[i] = key;
    for (const e of extras[i]) e.remove();
    extras[i] = [];
    if (!c) {
      b.innerHTML = "";
      return;
    }
    if (c.covered) {
      b.innerHTML = `<span class="dc-face">${backSVG(i)}</span>`;
      return;
    }
    // 渐变 id 拼上格号：同兵种开出多枚时，同文档内联也不会重复 id
    b.innerHTML = `<span class="dc-face">${pieceFaceSVG(c.color, c.kind, i)}</span>`;
  }

  /** 选中炮时把每条跳吃路径画成虚线弧；没选炮或没得跳就整层收起 */
  function refreshArcs(): void {
    const sel = selected >= 0 ? state.cells[selected] : null;
    const jumps =
      sel && !sel.covered && sel.kind === "cannon" ? targets.filter((t) => state.cells[t] !== null) : [];
    if (jumps.length === 0) {
      arcs.innerHTML = "";
      arcs.hidden = true;
      return;
    }
    const rg = arcs.getBoundingClientRect();
    const w = Math.max(1, Math.round(rg.width));
    const h = Math.max(1, Math.round(rg.height));
    const center = (idx: number): [number, number] => {
      const r = cells[idx].getBoundingClientRect();
      return [r.left + r.width / 2 - rg.left, r.top + r.height / 2 - rg.top];
    };
    const [x1, y1] = center(selected);
    const paths = jumps
      .map((t) => {
        const [x2, y2] = center(t);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const d = Math.max(1, Math.hypot(dx, dy));
        const lift = Math.min(28, d * 0.25);
        const cx = (x1 + x2) / 2 + (dy / d) * lift;
        const cy = (y1 + y2) / 2 - (dx / d) * lift;
        return (
          `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" ` +
          `fill="none" stroke="#7f6bd0" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round" opacity=".85"/>` +
          `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3.2" fill="#7f6bd0" opacity=".85"/>`
        );
      })
      .join("");
    arcs.hidden = false;
    arcs.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
  }

  function refresh(): void {
    if (destroyed) return;
    for (let i = 0; i < cells.length; i++) {
      const b = cells[i];
      const c = state.cells[i];
      setCellContent(i);
      const classes = ["dc-cell"];
      if ((rowOf(i) + colOf(i)) % 2 === 1) classes.push("dc-alt");
      if (!c) {
        classes.push("dc-empty");
        b.disabled = true;
        b.setAttribute("aria-label", `第 ${rowOf(i) + 1} 行第 ${colOf(i) + 1} 列 空格`);
      } else if (c.covered) {
        b.disabled = false;
        b.setAttribute("aria-label", `第 ${rowOf(i) + 1} 行第 ${colOf(i) + 1} 列 还盖着`);
      } else {
        classes.push(c.color === "red" ? "dc-red" : "dc-blue");
        b.disabled = false;
        b.setAttribute(
          "aria-label",
          `第 ${rowOf(i) + 1} 行第 ${colOf(i) + 1} 列 ${c.color === "red" ? "红" : "蓝"}${labelOf(c.color, c.kind)}`
        );
      }
      if (i === selected) classes.push("dc-sel");
      if (targets.includes(i)) {
        classes.push("dc-can");
        // 目标格上有子就一定是吃得动的（走不动的根本进不了 movesFrom）——角落给一枚小箭头
        if (c) classes.push("dc-eat");
      }
      if (i === cursors[activeSeat()]) classes.push("dc-cursor");
      if (b.style.transform) b.style.transform = "";
      b.className = classes.join(" ");
    }
    refreshArcs();
    if (opts.showCounter) {
      const left = remainingUnknown(state);
      counter.innerHTML = "";
      for (const color of ["red", "blue"] as Color[]) {
        const s = document.createElement("span");
        const line = counterLine(color, left[color]);
        // 文本层是既有契约与读屏正文，图标层随后在真实 DOM 里接管画面
        s.textContent = line;
        s.setAttribute("aria-label", line);
        s.innerHTML = counterIconsHTML(color, left[color]);
        counter.appendChild(s);
      }
    }
  }

  /** 走子 / 吃子的出发格滑向落点（120ms），距离按两格的真实位置算，炮的远吃也滑得对 */
  function slideFrom(from: number, to: number): void {
    const a = cells[from];
    const t = cells[to];
    if (!a || !t) return;
    const ra = a.getBoundingClientRect();
    const rt = t.getBoundingClientRect();
    a.className = `${a.className} dc-slide`;
    a.style.transform = `translate(${rt.left - ra.left}px,${rt.top - ra.top}px)`;
  }

  /** 吃子=花瓣退场：三片粉花瓣从被吃的格子里飘出去；弱动效只留缩小淡出 */
  function spawnPetals(at: number): void {
    if (soft) return;
    const b = cells[at];
    if (!b) return;
    for (let k = 0; k < 3; k++) {
      const p = document.createElement("span");
      p.className = `dc-petal dc-p${k + 1}`;
      p.innerHTML = petalSVG("pink");
      b.appendChild(p);
      extras[at].push(p);
    }
  }

  function animate(kind: "flip" | "capture", at: number, done: () => void, from?: number): void {
    const b = cells[at];
    // 时长与 done 的时序沿用 1.2：外面靠这个回调串行动作，一毫秒都不挪
    const ms = soft ? 80 : kind === "flip" ? 200 : 180;
    if (b && kind === "capture") {
      b.className = `${b.className} dc-gone`;
      spawnPetals(at);
    } else if (b && from === undefined) {
      // 真翻子：前半段还是牌背，中点把面换成棋面，后半段从 -90° 转回来——两面感在这
      b.className = `${b.className} dc-flip1`;
      const half = setTimeout(() => {
        if (destroyed) return;
        setCellContent(at);
        b.className = `${b.className.replace(" dc-flip1", "")} dc-flip2`;
      }, ms / 2);
      timers.push(half);
    }
    if (from !== undefined) slideFrom(from, at);
    const t = setTimeout(() => {
      if (destroyed) return;
      refresh();
      done();
    }, ms);
    timers.push(t);
  }

  /**
   * 结算演出（只动画不动数据，onEnd 的时序在外面一如既往）：
   *  - 赢棋：输方翻开的棋子整排变灰鞠躬，赢方列队小跳，再下一场金花瓣雨（≤12 片，弱动效不放）；
   *  - 和棋：双方各留一枚翻开的棋子相对一歪，碰个杯。
   * 盖着的子不参加谢幕——亮谁的相就泄谁的底。
   */
  function flourish(outcome: { kind: "win"; winner: Color } | { kind: "draw" }): void {
    if (destroyed) return;
    if (outcome.kind === "win") {
      for (let i = 0; i < cells.length; i++) {
        const c = state.cells[i];
        if (!c || c.covered) continue;
        cells[i].className += c.color === outcome.winner ? " dc-parade" : " dc-bow";
      }
      if (!soft) {
        const rain = document.createElement("div");
        rain.className = "dc-rain";
        let html = "";
        for (let k = 0; k < 12; k++) {
          html += `<span class="dc-petal" style="left:${4 + k * 8}%;animation-delay:${(k * 87) % 600}ms">${petalSVG("gold")}</span>`;
        }
        rain.innerHTML = html;
        wrap.appendChild(rain);
      }
      return;
    }
    const first: Partial<Record<Color, number>> = {};
    for (let i = 0; i < cells.length; i++) {
      const c = state.cells[i];
      if (c && !c.covered && first[c.color] === undefined) first[c.color] = i;
    }
    if (first.red !== undefined) cells[first.red].className += " dc-cheer-l";
    if (first.blue !== undefined) cells[first.blue].className += " dc-cheer-r";
  }

  refresh();

  return {
    refresh,
    animate,
    cancel,
    flourish,
    cursor: (side: Side = activeSeat()) => cursors[side],
    selected: () => selected,
    destroy() {
      destroyed = true;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      window.removeEventListener("keydown", onKey);
      for (const b of cells) b.remove();
      wrap.remove();
    },
  };
}

/** 供上层做提示用：这一方现在有几手可走 */
export function actionCount(state: GameState, side: Side): number {
  return legalActions(state, side).length;
}

export { applyAction, coveredCount };
