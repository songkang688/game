import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  MASK_FACE,
  anyMove,
  applyGravity,
  createBoard,
  fairShuffle,
  maskKey,
  pickMasked,
  removePair,
  rotateBoard,
  tilesLeft,
  type BoardSpec,
  type BoardState,
  type Pt,
  type TileMove
} from "./board";
import { CHAPTERS, LEVELS, THEME_EMOJIS, turnsOf, type LlkLevel } from "./levels";
import {
  HINT_MAX,
  Janitor,
  SHAKE_MS,
  beginCollapse,
  bgOf,
  boardCleared,
  clearMs,
  collapseMs,
  endlessInit,
  endlessNext,
  endlessPair,
  endlessSeconds,
  endlessSpec,
  endlessStepWord,
  endlessTimeUp,
  endlessWord,
  gridTemplate,
  hintPair,
  hintsLeft,
  selfHelp,
  linkHoldMs,
  linkInit,
  settle,
  shapeClass,
  starsFor,
  tapCell,
  timeUpWord,
  winWord,
  type EndlessState,
  type LinkState,
  type Sfx
} from "./logic";

const CSS = `
.llk-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF2E4, #FDEBF3); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.llk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: nowrap; }
.llk-badge { background: #fff; border-radius: 14px; padding: 5px 9px; font-weight: 700; color: #D98548; box-shadow: 0 2px 6px rgba(220,160,100,.25); font-size: 14px; white-space: nowrap; }
.llk-badge.llk-hurry { color: #E8590C; animation: llkBlink 1s infinite; }
.llk-badge.llk-rule { color: #7A5AA8; background: #F3ECFF; }
@keyframes llkBlink { 50% { opacity: .5; } }
.llk-tools { display: flex; gap: 8px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
.llk-tool { border: none; border-radius: 14px; min-height: 44px; min-width: 118px; padding: 6px 14px; font-weight: 700; background: #FFD9A8; color: #8A5A20; cursor: pointer; box-shadow: 0 3px 0 #EFBC82; font-size: 15px; font-family: inherit; }
.llk-tool.llk-hintbtn { background: #D9ECFF; color: #2F6DA8; box-shadow: 0 3px 0 #A8CDEF; }
.llk-tool:active { transform: translateY(2px); box-shadow: 0 1px 0 #EFBC82; }
.llk-tool:disabled { opacity: .5; }
.llk-boardbox { position: relative; }
.llk-board { display: grid; gap: 3px; transition: transform .3s ease; }
.llk-board.llk-spin { transform: rotate(90deg) scale(.86); }
.llk-cell { aspect-ratio: 1; border: none; border-radius: 10px; font-size: clamp(13px, 4vw, 24px); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 4px rgba(200,140,90,.18); transition: transform .12s, opacity .2s, box-shadow .12s; }
.llk-cell.llk-edge { aspect-ratio: auto; background: transparent !important; box-shadow: none; pointer-events: none; }
.llk-cell.llk-gone { background: transparent !important; box-shadow: none; cursor: default; }
.llk-cell.llk-sel { box-shadow: 0 0 0 3px #FF9E5E; transform: scale(1.08); }
.llk-cell.llk-hint { box-shadow: 0 0 0 3px #4C9BE8; animation: llkHint .6s ease-in-out 2; }
.llk-cell.llk-mask { background: #E7E0F5 !important; color: #8B7BB8; }
.llk-cell.llk-linking { box-shadow: 0 0 0 3px #FFB347, 0 0 12px 3px rgba(255,160,70,.6); }
.llk-cell.llk-clear { animation: llkClear .18s ease forwards; }
.llk-cell.llk-shake { animation: llkShake ${SHAKE_MS}ms ease; }
.llk-cell:active { transform: scale(.92); }
/* 同色系靠轮廓区分，色觉不敏感也认得出 */
.llk-shape0 { border-radius: 50%; }
.llk-shape1 { border-radius: 6px; }
.llk-shape2 { border-radius: 50% 12% 50% 12%; }
.llk-shape3 { border-radius: 26%; transform: rotate(45deg); }
.llk-shape3 > span { display: block; transform: rotate(-45deg); }
.llk-shape4 { border-radius: 46% 46% 40% 40%; }
.llk-cell.llk-shape3.llk-sel { transform: rotate(45deg) scale(1.08); }
@keyframes llkClear { to { transform: scale(.2); opacity: 0; } }
@keyframes llkShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
@keyframes llkHint { 50% { opacity: .55; } }
.llk-line { position: absolute; inset: 0; pointer-events: none; }
.llk-msg { text-align: center; min-height: 22px; color: #D98548; font-weight: 700; margin-top: 8px; font-size: 15px; line-height: 1.45; }
.llk-modebar { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
.llk-open { border: none; border-radius: 14px; min-height: 44px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #FFE0B8; color: #A05C1E; cursor: pointer; box-shadow: 0 3px 0 #EFC291; }
.llk-open:active { transform: translateY(2px); box-shadow: 0 1px 0 #EFC291; }
.llk-back { border: none; border-radius: 14px; min-height: 44px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #E7E1FA; color: #5B4B8A; cursor: pointer; }
.llk-over { text-align: center; padding: 14px 8px; }
.llk-over h3 { margin: 0 0 6px; font-size: 19px; color: #A05C1E; }
.llk-over p { margin: 4px 0; font-size: 14px; color: #6B5B4A; line-height: 1.5; }
.llk-again { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) {
  .llk-board, .llk-cell { transition: none; }
  .llk-badge.llk-hurry, .llk-cell.llk-hint { animation: none; }
}
`;

function el<T extends HTMLElement = HTMLElement>(tag: string, cls?: string, text?: string): T {
  const node = document.createElement(tag) as T;
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 头部那句规则小贴纸：一眼看出这一关的新花样 */
function ruleChip(cfg: LlkLevel): string {
  if (cfg.rotateMs) return "🌀 棋盘会转";
  if (turnsOf(cfg) <= 1) return "📏 只准拐一次";
  if (cfg.disguise) return "🎭 有面具";
  if (cfg.gravity === "center") return "🧲 往中间挤";
  if (cfg.gravity === "up") return "🧲 往上飘";
  if (cfg.gravity === "right") return "🧲 往右滑";
  return "";
}

function openingHint(cfg: LlkLevel): string {
  if (cfg.rotateMs) return "每过一会儿整块棋盘就转 90°，记图案别记坐标。";
  if (turnsOf(cfg) <= 1) return "这里的线最多只准拐一次弯，先找同一行同一列的。";
  if (cfg.disguise) return "戴面具的图案点一下露真身，先翻一遍摸清盘面再动手。";
  if (cfg.gravity === "center") return "重力向中间：消掉一对后，两边的图案会往中间挤。";
  if (cfg.gravity === "up") return "重力向上：消掉一对后，下面的图案会补上来。";
  if (cfg.gravity === "right") return "重力向右：消掉一对后，左边的图案会挤过来。";
  if (cfg.gravity === "down") return "重力向下：消掉一对后，上面的图案会落下来。";
  if (cfg.gravity === "left") return "重力向左：消掉一对后，右边的图案会挤过来。";
  return `${cfg.rows}×${cfg.cols} 棋盘，${cfg.seconds} 秒内全部连完，先从边角下手！`;
}

// ---------------------------------------------------------------------------
// 一块可复用的棋盘视图：连线状态机、收拢滑动、提示高亮都在这儿
// ---------------------------------------------------------------------------

interface ViewHooks {
  sfx(name: Sfx): void;
  /** 消掉一对之后回调（棋盘已经收拢好） */
  onPair(): void;
  onMessage(text: string): void;
  /** 想画面具就返回 true */
  isHidden(r: number, c: number): boolean;
  onReveal(r: number, c: number): void;
  /** 收拢之后要不要重新洗面具 */
  afterCollapse(): void;
}

class BoardView {
  readonly root: HTMLElement;
  private readonly boardEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly cells: HTMLButtonElement[][] = [];
  private link: LinkState = linkInit();
  private frozen = false;
  private gravityDir: Parameters<typeof applyGravity>[1] = "none";

  constructor(
    private board: BoardState,
    private emojis: readonly string[],
    private maxTurns: number,
    private readonly calm: boolean,
    private readonly jan: Janitor,
    private readonly hooks: ViewHooks
  ) {
    this.root = el("div", "llk-boardbox");
    this.boardEl = el("div", "llk-board");
    this.canvas = el<HTMLCanvasElement>("canvas", "llk-line");
    this.root.append(this.boardEl, this.canvas);
    // 一个委托监听管整块棋盘：无尽补盘时不会越攒越多
    this.jan.on(this.boardEl, "click", (ev: Event) => {
      const hit = (ev.target as HTMLElement | null)?.closest?.(".llk-cell") as HTMLElement | null;
      const rc = hit?.dataset.rc;
      if (!rc) return;
      const [r, c] = rc.split(",").map(Number);
      this.onCell(r, c);
    });
    this.build();
  }

  private build(): void {
    const { R, C, cols, rows } = this.board;
    this.boardEl.style.gridTemplateColumns = gridTemplate(cols);
    this.boardEl.style.gridTemplateRows = gridTemplate(rows);
    this.boardEl.innerHTML = "";
    this.cells.length = 0;
    for (let r = 0; r < R; r++) {
      const row: HTMLButtonElement[] = [];
      for (let c = 0; c < C; c++) {
        const btn = el<HTMLButtonElement>("button", "llk-cell");
        btn.type = "button";
        btn.appendChild(el("span"));
        const edge = r === 0 || c === 0 || r === R - 1 || c === C - 1;
        if (edge) {
          btn.classList.add("llk-edge", "llk-gone");
          btn.tabIndex = -1;
          btn.setAttribute("aria-hidden", "true");
        } else {
          btn.dataset.rc = `${r},${c}`;
        }
        this.boardEl.appendChild(btn);
        row.push(btn);
      }
      this.cells.push(row);
    }
  }

  /** 换一整块新棋盘（无尽补盘用）：规则和图案也一起换 */
  swap(board: BoardState, rules?: { maxTurns?: number; emojis?: readonly string[] }): void {
    this.board = board;
    if (rules?.maxTurns) this.maxTurns = rules.maxTurns;
    if (rules?.emojis) this.emojis = rules.emojis;
    this.link = linkInit();
    this.frozen = false;
    this.clearLine();
    this.build();
    this.render();
  }

  freeze(): void {
    this.frozen = true;
  }

  get state(): BoardState {
    return this.board;
  }

  render(): void {
    const { R, C } = this.board;
    for (let r = 1; r < R - 1; r++) {
      for (let c = 1; c < C - 1; c++) {
        const node = this.cells[r][c];
        const span = node.firstElementChild as HTMLElement;
        const v = this.board.grid[r][c];
        node.className = "llk-cell";
        if (v < 0) {
          node.classList.add("llk-gone");
          span.textContent = "";
          node.style.background = "";
          node.setAttribute("aria-hidden", "true");
          continue;
        }
        node.removeAttribute("aria-hidden");
        const picked = !!this.link.first && this.link.first[0] === r && this.link.first[1] === c;
        const hidden = this.hooks.isHidden(r, c) && !picked;
        node.classList.add(shapeClass(v));
        if (hidden) {
          node.classList.add("llk-mask");
          span.textContent = MASK_FACE;
          node.style.background = "";
          node.setAttribute("aria-label", "戴着面具的图案，点一下看看");
        } else {
          span.textContent = this.emojis[v];
          node.style.background = bgOf(v);
          node.setAttribute("aria-label", `图案 ${this.emojis[v]}`);
        }
        if (picked) node.classList.add("llk-sel");
      }
    }
  }

  /** 提示：把真求解出来的一对高亮一下 */
  highlight(pair: [Pt, Pt]): void {
    for (const [r, c] of pair) {
      const node = this.cells[r][c];
      node.classList.add("llk-hint");
      this.jan.after(1400, () => node.classList.remove("llk-hint"));
    }
  }

  private onCell(r: number, c: number): void {
    if (this.frozen) return;
    const out = tapCell(this.board, this.link, r, c, {
      maxTurns: this.maxTurns,
      hidden: this.hooks.isHidden(r, c)
    });
    this.link = out.state;
    switch (out.kind) {
      case "ignore":
        return;
      case "reveal":
        this.hooks.onReveal(r, c);
        this.hooks.sfx("tap");
        this.render();
        return;
      case "select":
      case "switch":
        this.hooks.sfx("tap");
        this.render();
        return;
      case "deselect":
        this.render();
        return;
      case "reject":
        this.hooks.sfx("oops");
        this.hooks.onMessage(out.reason ?? "");
        this.shake(out.pair as [Pt, Pt]);
        this.render();
        return;
      case "link":
        this.runLink(out.pair as [Pt, Pt], out.path as Pt[]);
        return;
    }
  }

  /** 连错：两块一起抖 120ms，什么都不扣 */
  private shake(pair: [Pt, Pt]): void {
    if (this.calm) return;
    for (const [r, c] of pair) {
      const node = this.cells[r][c];
      node.classList.add("llk-shake");
      this.jan.after(SHAKE_MS + 20, () => node.classList.remove("llk-shake"));
    }
  }

  /** 连上了：画线 → 撑住 → 缩掉 → 收拢滑动 → 回到待命 */
  private runLink(pair: [Pt, Pt], path: Pt[]): void {
    const [a, z] = pair;
    this.hooks.sfx("pop");
    this.render();
    for (const [r, c] of pair) this.cells[r][c].classList.add("llk-linking");
    this.drawPath(path);

    this.jan.after(linkHoldMs(this.calm), () => {
      this.clearLine();
      for (const [r, c] of pair) {
        const node = this.cells[r][c];
        node.classList.remove("llk-linking");
        node.classList.add("llk-clear");
      }
      this.jan.after(clearMs(this.calm), () => {
        for (const [r, c] of pair) this.cells[r][c].classList.remove("llk-clear");
        removePair(this.board, a, z);
        const moves = applyGravity(this.board, this.gravity);
        this.hooks.afterCollapse();
        this.render();
        const slide = this.animate(moves);
        this.jan.after(slide + 10, () => {
          this.link = settle();
          this.render();
          this.hooks.onPair();
        });
      });
      this.link = beginCollapse();
    });
  }

  setGravity(g: Parameters<typeof applyGravity>[1]): void {
    this.gravityDir = g;
  }

  private get gravity(): Parameters<typeof applyGravity>[1] {
    return this.gravityDir;
  }

  /** 收拢：一格一格滑过去，不许瞬移 */
  private animate(moves: readonly TileMove[]): number {
    if (this.calm || moves.length === 0) return 0;
    let longest = 0;
    for (const m of moves) {
      const from = this.cells[m.from[0]][m.from[1]];
      const to = this.cells[m.to[0]][m.to[1]];
      const dx = from.offsetLeft - to.offsetLeft;
      const dy = from.offsetTop - to.offsetTop;
      if (dx === 0 && dy === 0) continue;
      const cells = Math.max(Math.abs(m.from[0] - m.to[0]), Math.abs(m.from[1] - m.to[1]));
      const ms = collapseMs(cells, this.calm);
      longest = Math.max(longest, ms);
      to.style.transition = "none";
      to.style.transform = `translate(${dx}px, ${dy}px)`;
      void to.offsetWidth;
      to.style.transition = `transform ${ms}ms ease-out`;
      to.style.transform = "";
      this.jan.after(ms + 20, () => {
        to.style.transition = "";
        to.style.transform = "";
      });
    }
    return longest;
  }

  /** 画出真实路径（含拐点）的发光折线 */
  private drawPath(path: readonly Pt[]): void {
    const w = this.boardEl.clientWidth;
    const h = this.boardEl.clientHeight;
    if (!w || !h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    const c2d = this.canvas.getContext("2d");
    if (!c2d) return;
    c2d.clearRect(0, 0, w, h);
    const pts = path.map(([r, c]) => {
      const node = this.cells[r][c];
      return [node.offsetLeft + node.offsetWidth / 2, node.offsetTop + node.offsetHeight / 2];
    });
    c2d.lineCap = "round";
    c2d.lineJoin = "round";
    c2d.strokeStyle = "rgba(255,190,120,.55)";
    c2d.lineWidth = 11;
    c2d.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? c2d.moveTo(x, y) : c2d.lineTo(x, y)));
    c2d.stroke();
    c2d.strokeStyle = "#FF8A4C";
    c2d.lineWidth = 4;
    c2d.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? c2d.moveTo(x, y) : c2d.lineTo(x, y)));
    c2d.stroke();
    // 拐点上点一颗小圆点，让「线是怎么绕过去的」一目了然
    c2d.fillStyle = "#FFD8A8";
    for (let i = 1; i < pts.length - 1; i++) {
      c2d.beginPath();
      c2d.arc(pts[i][0], pts[i][1], 5, 0, Math.PI * 2);
      c2d.fill();
    }
  }

  clearLine(): void {
    const c2d = this.canvas.getContext("2d");
    if (c2d) c2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  clearSelection(): void {
    this.link = linkInit();
    this.clearLine();
    this.render();
  }
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: LlkLevel = LEVELS[ctx.level];
  const emojis = THEME_EMOJIS[cfg.theme];
  const maxTurns = turnsOf(cfg);
  const calm = reducedMotion();
  const jan = new Janitor();
  let levelDone = false;
  let timeLeft = cfg.seconds;
  let shufflesLeft = cfg.shuffles;
  let hintsUsed = 0;
  let masked: Set<string> = new Set();
  const revealed = new Set<string>();

  const board: BoardState = createBoard(
    { rows: cfg.rows, cols: cfg.cols, kinds: cfg.kinds, gravity: cfg.gravity, maxTurns },
    Math.random
  );

  const wrap = el("div", "llk-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="llk-top">
      <span class="llk-badge llk-left">🧸 剩 0 对</span>
      <span class="llk-badge llk-time">⏰ 0 秒</span>
      ${ruleChip(cfg) ? `<span class="llk-badge llk-rule">${ruleChip(cfg)}</span>` : ""}
    </div>
    <div class="llk-holder"></div>
    <div class="llk-tools">
      <button class="llk-tool llk-hintbtn" type="button">💡 提示 x${HINT_MAX}</button>
      <button class="llk-tool llk-shuffle" type="button">🔀 洗牌 x${cfg.shuffles}</button>
    </div>
    <div class="llk-msg"></div>
  `;
  stage.appendChild(wrap);

  const holder = wrap.querySelector(".llk-holder") as HTMLElement;
  const leftEl = wrap.querySelector(".llk-left") as HTMLElement;
  const timeEl = wrap.querySelector(".llk-time") as HTMLElement;
  const msgEl = wrap.querySelector(".llk-msg") as HTMLElement;
  const hintBtn = wrap.querySelector(".llk-hintbtn") as HTMLButtonElement;
  const shuffleBtn = wrap.querySelector(".llk-shuffle") as HTMLButtonElement;

  function rerollMasks(): void {
    if (!cfg.disguise) return;
    masked = pickMasked(board, cfg.disguise, Math.random);
    revealed.clear();
  }

  const view = new BoardView(board, emojis, maxTurns, calm, jan, {
    sfx: (n) => ctx.sfx(n),
    onPair: () => afterPair(),
    onMessage: (t) => {
      msgEl.textContent = t;
    },
    isHidden: (r, c) => masked.has(maskKey(r, c)) && !revealed.has(maskKey(r, c)),
    onReveal: (r, c) => revealed.add(maskKey(r, c)),
    afterCollapse: () => {
      if (cfg.gravity !== "none") {
        revealed.clear();
        rerollMasks();
      }
    }
  });
  view.setGravity(cfg.gravity);
  holder.appendChild(view.root);

  function renderTop(): void {
    leftEl.textContent = `🧸 剩 ${tilesLeft(board) / 2} 对`;
    timeEl.textContent = `⏰ ${timeLeft} 秒`;
    timeEl.classList.toggle("llk-hurry", timeLeft <= 15);
    shuffleBtn.textContent = `🔀 洗牌 x${shufflesLeft}`;
    shuffleBtn.disabled = shufflesLeft <= 0 || levelDone;
    // 提示用完之后按钮不灰掉，改成「指个方向」：不给格子，只把搜索范围缩小
    const left = hintsLeft(hintsUsed);
    hintBtn.textContent = left > 0 ? `💡 提示 x${left}` : "🔍 指个方向";
    hintBtn.disabled = levelDone;
  }

  function stop(): void {
    levelDone = true;
    view.freeze();
  }

  function fail(reason: string): void {
    if (levelDone) return;
    stop();
    renderTop();
    jan.after(300, () => ctx.lose(reason));
  }

  function succeed(): void {
    if (levelDone) return;
    stop();
    renderTop();
    jan.after(320, () => ctx.win(starsFor(timeLeft, cfg.seconds, hintsUsed), winWord(timeLeft, hintsUsed)));
  }

  function doShuffle(auto: boolean, free = false): void {
    const noCharge = free || (auto && !!cfg.autoShuffleFree);
    if (!noCharge) {
      if (shufflesLeft <= 0) return;
      shufflesLeft--;
    }
    const rep = fairShuffle(board, Math.random, maxTurns);
    revealed.clear();
    rerollMasks();
    ctx.sfx("meow");
    msgEl.textContent = auto
      ? free
        ? "这盘走进死胡同啦，不算你的——帮你重排一次，接着连！"
        : cfg.autoShuffleFree
          ? "连不动啦，这一关会自动帮你重排，接着找！"
          : `连不动啦，自动洗牌一次（还剩 ${shufflesLeft} 次）`
      : rep.constructed
        ? "洗好啦！这一把是特意摆出来的，保证有得连～"
        : `洗好啦，重新找找看（还剩 ${shufflesLeft} 次）`;
    view.clearSelection();
    renderTop();
  }

  /**
   * 死局救场：没得连了，而且洗牌次数也用光了。
   *
   * 原来这里直接判这一关没过，还捎一句「下一局多留一次洗牌就够翻盘啦」。
   * 可孩子并没有乱花洗牌——是这一手消除顺序刚好把自己堵死了，
   * 这是**没犯错却输了**，还挨了一句不该挨的提点。
   * （全量扫 188 关 × 60 种子：第 36 / 51 / 64 / 86 / 89 / 95 / 98 关都撞得上，
   * 第 89 关连它发出去的那个固定种子都会死。见 W4A-18。）
   *
   * 开局撞上死盘时本来就免费救一次（这个函数下面那句 `rescue()` 就是）；
   * 中途的死局是同一回事，没有理由区别对待。`fairShuffle` 保证重排完一定还走得动，
   * 所以救完接着玩就行，输赢仍旧只由时间决定。
   */
  function rescue(): void {
    doShuffle(true, true);
  }

  function afterPair(): void {
    renderTop();
    if (boardCleared(board)) {
      succeed();
      return;
    }
    if (!anyMove(board, maxTurns)) {
      if (cfg.autoShuffleFree || shufflesLeft > 0) doShuffle(true);
      else rescue();
    }
  }

  function doRotate(): void {
    if (!rotateBoard(board)) return;
    revealed.clear();
    rerollMasks();
    view.clearSelection();
    const boardEl = view.root.querySelector(".llk-board") as HTMLElement;
    boardEl.classList.add("llk-spin");
    jan.after(320, () => boardEl.classList.remove("llk-spin"));
    ctx.sfx("tap");
    msgEl.textContent = "🌀 棋盘转了 90°，先花一秒重新定位再动手！";
    if (!anyMove(board, maxTurns) && tilesLeft(board) > 0) {
      if (cfg.autoShuffleFree || shufflesLeft > 0) doShuffle(true);
      else rescue();
    }
  }

  jan.on(hintBtn, "click", () => {
    if (levelDone) return;
    if (hintsLeft(hintsUsed) <= 0) {
      // 三次都用光了也不把孩子晾在那儿：报个方向，答案仍旧他自己找
      msgEl.textContent = selfHelp(board, maxTurns).word;
      return;
    }
    const pair = hintPair(board, maxTurns);
    if (!pair) {
      msgEl.textContent = "这会儿真的没有能连的了，先洗一次牌吧～";
      return;
    }
    hintsUsed++;
    ctx.sfx("tap");
    view.highlight(pair);
    msgEl.textContent =
      hintsLeft(hintsUsed) > 0
        ? `蓝框这一对连得上！还能再提示 ${hintsLeft(hintsUsed)} 次（用过提示这一关封顶两星）`
        : "最后一次提示用完啦，接下来靠自己扫盘～";
    renderTop();
  });

  jan.on(shuffleBtn, "click", () => {
    if (levelDone || shufflesLeft <= 0) return;
    doShuffle(false);
  });

  if (!anyMove(board, maxTurns)) rescue();
  rerollMasks();
  view.render();
  renderTop();
  msgEl.textContent = openingHint(cfg);

  jan.every(1000, () => {
    if (levelDone) return;
    timeLeft--;
    renderTop();
    if (timeLeft <= 0) fail(timeUpWord());
  });

  if (cfg.rotateMs && cfg.rotateMs > 0) {
    jan.every(Math.max(4000, cfg.rotateMs), () => {
      if (levelDone) return;
      doRotate();
    });
  }
  if (cfg.disguise && cfg.disguiseMs && cfg.disguiseMs > 0) {
    jan.every(Math.max(3500, cfg.disguiseMs), () => {
      if (levelDone) return;
      rerollMasks();
      view.render();
      msgEl.textContent = "🎭 面具换了一批，之前记的失效了，重新翻一遍～";
    });
  }

  return {
    destroy() {
      levelDone = true;
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 无尽「连到底」：清完一盘自动补新盘
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const calm = reducedMotion();
  const jan = new Janitor();
  let st: EndlessState = endlessInit();
  let spec: BoardSpec = endlessSpec(st.round);
  let board: BoardState = createBoard(spec, Math.random);
  let timeLeft = endlessSeconds(st.round);

  const wrap = el("div", "llk-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="llk-modebar">
      <button class="llk-back" type="button">⬅️ 回地图</button>
      <span class="llk-badge llk-best"></span>
    </div>
    <div class="llk-top">
      <span class="llk-badge llk-round">🎪 第 1 盘</span>
      <span class="llk-badge llk-pairs">🔗 0 对</span>
      <span class="llk-badge llk-time">⏰ 不限时</span>
    </div>
    <div class="llk-holder"></div>
    <div class="llk-tools">
      <button class="llk-tool llk-shuffle" type="button">🔀 重排</button>
    </div>
    <div class="llk-msg"></div>
  `;
  host.appendChild(wrap);

  const holder = wrap.querySelector(".llk-holder") as HTMLElement;
  const roundEl = wrap.querySelector(".llk-round") as HTMLElement;
  const pairsEl = wrap.querySelector(".llk-pairs") as HTMLElement;
  const timeEl = wrap.querySelector(".llk-time") as HTMLElement;
  const bestEl = wrap.querySelector(".llk-best") as HTMLElement;
  const msgEl = wrap.querySelector(".llk-msg") as HTMLElement;
  const shuffleBtn = wrap.querySelector(".llk-shuffle") as HTMLButtonElement;

  const view = new BoardView(board, THEME_EMOJIS[0], spec.maxTurns, calm, jan, {
    sfx: (n) => api.play(n),
    onPair: () => afterPair(),
    onMessage: (t) => {
      msgEl.textContent = t;
    },
    isHidden: () => false,
    onReveal: () => undefined,
    afterCollapse: () => undefined
  });
  view.setGravity(spec.gravity);
  holder.appendChild(view.root);

  function renderTop(): void {
    roundEl.textContent = `🎪 第 ${st.round} 盘`;
    pairsEl.textContent = `🔗 ${st.pairs} 对`;
    timeEl.textContent = timeLeft > 0 ? `⏰ ${timeLeft} 秒` : "⏰ 不限时";
    timeEl.classList.toggle("llk-hurry", timeLeft > 0 && timeLeft <= 15);
    bestEl.textContent = (() => {
      const best = save.getGameProgress(meta.id).endlessBest;
      return best > 0 ? `🏅 最好 ${best} 对` : "🏅 还没有最好成绩";
    })();
    shuffleBtn.disabled = st.over;
  }

  function nextBoard(): void {
    st = endlessNext(st);
    spec = endlessSpec(st.round);
    board = createBoard(spec, Math.random);
    if (!anyMove(board, spec.maxTurns)) fairShuffle(board, Math.random, spec.maxTurns);
    timeLeft = endlessSeconds(st.round);
    view.setGravity(spec.gravity);
    view.swap(board);
    msgEl.textContent = `一盘清空！${endlessStepWord(st.round)}`;
    api.play("win");
    renderTop();
  }

  function afterPair(): void {
    st = endlessPair(st);
    renderTop();
    if (boardCleared(board)) {
      nextBoard();
      return;
    }
    if (!anyMove(board, spec.maxTurns)) {
      const rep = fairShuffle(board, Math.random, spec.maxTurns);
      view.clearSelection();
      msgEl.textContent = rep.constructed
        ? "连不动啦，帮你摆了一把保证有得连的～"
        : "连不动啦，自动重排一次，接着连！";
      api.play("meow");
    }
  }

  function finish(): void {
    if (st.over) return;
    st = endlessTimeUp(st);
    view.freeze();
    const before = save.getGameProgress(meta.id).endlessBest;
    save.recordEndlessBest(meta.id, st.pairs);
    api.play(st.pairs > before ? "win" : "tap");
    renderTop();
    const box = el("div", "llk-over");
    box.innerHTML = `<h3>🔗 这一趟连到底结束啦</h3><p>${endlessWord(st, before)}</p>`;
    const again = el("div", "llk-again");
    const retry = el<HTMLButtonElement>("button", "llk-open", "🔁 再连一次");
    retry.type = "button";
    const quit = el<HTMLButtonElement>("button", "llk-back", "⬅️ 回地图");
    quit.type = "button";
    again.append(retry, quit);
    box.appendChild(again);
    wrap.appendChild(box);
    jan.on(retry, "click", () => {
      box.remove();
      st = endlessInit();
      spec = endlessSpec(st.round);
      board = createBoard(spec, Math.random);
      timeLeft = endlessSeconds(st.round);
      view.setGravity(spec.gravity);
      view.swap(board);
      msgEl.textContent = endlessStepWord(1);
      renderTop();
    });
    jan.on(quit, "click", back);
  }

  jan.on(shuffleBtn, "click", () => {
    if (st.over) return;
    fairShuffle(board, Math.random, spec.maxTurns);
    view.clearSelection();
    api.play("meow");
    msgEl.textContent = "重排好啦，重新扫一遍～";
  });
  jan.on(wrap.querySelector(".llk-back") as HTMLButtonElement, "click", back);
  jan.on(window, "keydown", (ev: Event) => {
    if ((ev as KeyboardEvent).key === "Escape") back();
  });

  jan.every(1000, () => {
    if (st.over || timeLeft <= 0) return;
    timeLeft--;
    renderTop();
    if (timeLeft <= 0) finish();
  });

  if (!anyMove(board, spec.maxTurns)) fairShuffle(board, Math.random, spec.maxTurns);
  view.render();
  renderTop();
  msgEl.textContent = `${endlessStepWord(1)} 清空一盘就自动补新的，累计对数就是成绩。`;

  return {
    destroy() {
      st = { ...st, over: true };
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = el("div", "llk-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el<HTMLButtonElement>("button", "llk-open", "♾️ 连到底");
  endlessBtn.type = "button";
  bar.appendChild(endlessBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 连到底 · 最好 ${best} 对` : "♾️ 连到底";
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  const onEndless = () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountEndless(modeHost, api, closeMode);
  };
  endlessBtn.addEventListener("click", onEndless);
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来：360px 竖屏上棋盘要占满整宽
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) bar.hidden = false;
            handle.destroy?.();
          }
        };
      },
      mapHint: "剩的时间越多星星越多，先清边角效率最高；提示每关 3 次，用了就封顶两星！",
      grandMessage: "188 关全部通关，你的扫盘路线已经很有章法了！"
    }
  );

  return {
    destroy() {
      endlessBtn.removeEventListener("click", onEndless);
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}
