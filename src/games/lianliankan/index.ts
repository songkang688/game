import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
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
  CELL_GAP_PX,
  HINT_MAX,
  Janitor,
  RING_FRAC,
  SHAKE_MS,
  beginCollapse,
  bgOf,
  boardCleared,
  cellSizePx,
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
import {
  HINT_GLOW_MS,
  SHUFFLE_FX_MS,
  hudGlyphSvg,
  maskFaceSvg,
  meteorPoints,
  meteorSvg,
  slimTile,
  tileFaceSvg,
  tileIconName,
  type HudGlyph
} from "./art";

const CSS = `
.llk-wrap {
  --llk-desk: #E8D5BC;
  --llk-tile-top: #FFFDF6;
  --llk-tile-top2: #F4EDE0;
  --llk-tile-side: #D8CBB4;
  --llk-select: #F4859F;
  --llk-trail: #FFD678;
  --llk-hint: rgba(255,214,120,.28);
  --llk-hurry: #F0955A;
  --llk-ms-hover: 120ms;
  --llk-ms-trail: 240ms;
  --llk-ms-clear: 200ms;
  --llk-ms-hint: 2s;
  --llk-ms-shuffle: 180ms;
  --llk-ms-heart: 900ms;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  background:
    repeating-linear-gradient(93deg, rgba(150,104,58,.05) 0 2px, rgba(150,104,58,0) 2px 9px),
    repeating-linear-gradient(88deg, rgba(120,84,48,.045) 0 13px, rgba(120,84,48,0) 13px 31px),
    linear-gradient(180deg, #F2E2C8, var(--llk-desk));
  border-radius: 16px; padding: 12px; user-select: none; position: relative; z-index: 0; overflow: hidden;
}
/* 茶室四角的茶点小装饰:俯视茶杯(环 + 心)与茶点(小圆点),低饱和不抢牌面 */
.llk-wrap::before {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(circle at calc(100% - 22px) 22px, rgba(196,150,96,.22) 0 7px, rgba(196,150,96,0) 8px),
    radial-gradient(circle at calc(100% - 22px) 22px, rgba(146,106,66,0) 0 11px, rgba(146,106,66,.20) 11px 14px, rgba(146,106,66,0) 15px),
    radial-gradient(circle at 20px calc(100% - 20px), rgba(196,150,96,.18) 0 6px, rgba(196,150,96,0) 7px),
    radial-gradient(circle at 20px calc(100% - 20px), rgba(146,106,66,0) 0 9px, rgba(146,106,66,.16) 9px 12px, rgba(146,106,66,0) 13px),
    radial-gradient(circle at 14px 18px, rgba(146,106,66,.12) 0 4px, rgba(146,106,66,0) 5px),
    radial-gradient(circle at 27px 12px, rgba(146,106,66,.10) 0 3.5px, rgba(146,106,66,0) 4.5px),
    radial-gradient(circle at calc(100% - 16px) calc(100% - 14px), rgba(146,106,66,.12) 0 4px, rgba(146,106,66,0) 5px),
    radial-gradient(circle at calc(100% - 29px) calc(100% - 20px), rgba(146,106,66,.10) 0 3.5px, rgba(146,106,66,0) 4.5px);
}
.llk-top { display: flex; justify-content: center; align-items: stretch; margin-bottom: 8px; gap: 5px; flex-wrap: wrap; }
.llk-badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: linear-gradient(180deg, #FFFEFA, #FFF3E2); border-radius: 12px; padding: 5px 7px; font-weight: 700; color: #8A6238; box-shadow: 0 2px 0 #E2CFB2, 0 3px 7px rgba(160,120,70,.16); font-size: 14px; white-space: nowrap; }
.llk-glyph { width: 14px; height: 14px; flex: none; }
.llk-bico { display: inline-flex; width: 14px; height: 14px; flex: none; }
.llk-bico .llk-glyph { width: 100%; height: 100%; }
.llk-badge.llk-hurry { background: linear-gradient(180deg, #FFAF7E, var(--llk-hurry)); color: #FFF9F2; box-shadow: 0 2px 0 #D07A42, 0 3px 9px rgba(240,149,90,.4); animation: llkHeart var(--llk-ms-heart) ease-in-out infinite; }
.llk-badge.llk-rule { color: #7A5AA8; background: #F3ECFF; }
@keyframes llkHeart { 50% { transform: scale(1.03); } }
.llk-tools { display: flex; gap: 8px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
.llk-tool { display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: none; border-radius: 12px; min-height: 44px; min-width: 74px; padding: 4px 8px; font-weight: 700; background: linear-gradient(180deg, #FFE3B8, #FFD199); color: #8A5A20; cursor: pointer; box-shadow: 0 3px 0 #E5B276, 0 4px 8px rgba(180,130,70,.2); font-size: 14px; font-family: inherit; }
.llk-tool.llk-hintbtn { background: linear-gradient(180deg, #E2F1FF, #CBE4FB); color: #2F6DA8; box-shadow: 0 3px 0 #9FC6E8, 0 4px 8px rgba(90,140,190,.2); }
.llk-tool:active { transform: translateY(1px); box-shadow: 0 2px 0 #E5B276; }
.llk-tool.llk-hintbtn:active { box-shadow: 0 2px 0 #9FC6E8; }
.llk-tool:disabled { opacity: .5; }
.llk-boardbox { position: relative; }
.llk-board { display: grid; gap: 3px; transition: transform .3s ease; }
/* N-72:915 上按宽摊方格,4×4 一格 ~200 盘面 crop 496。收的是盘,洗牌/提示勿挤 */
@media (max-height: 500px) {
  .llk-board { max-width: min(420px, 78dvh); margin-inline: auto; width: 100%; }
  .llk-msg { min-height: 0; margin-top: 4px; }
}
@media (max-height: 840px) and (min-height:501px) {
  .llk-board { max-width: min(520px, 70dvh); margin-inline: auto; width: 100%; }
  .llk-tools { position: sticky; bottom: 0; z-index: 4; padding: 4px 0 2px;
    background: linear-gradient(180deg, rgba(255,248,236,0), #FFF8EC 40%); }
}
.llk-board.llk-spin { transform: rotate(90deg) scale(.86); }
/* 麻将砖三层:顶面米白渐变(圆角 10px)+ 底部 3px 暖灰立面 + 1px 软影 */
.llk-cell { aspect-ratio: 1; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; position: relative; background-color: var(--llk-tile-top); background-image: linear-gradient(160deg, var(--llk-tile-top), rgba(255,253,246,.24) 46%, rgba(216,203,180,.34) 100%); box-shadow: 0 3px 0 var(--llk-tile-side), 0 4px 5px rgba(140,105,66,.2); transition: transform var(--llk-ms-hover) ease-out, box-shadow var(--llk-ms-hover) ease-out, opacity .2s; }
/* 图标绘制区 = 牌面 68% */
.llk-cell > span { width: 68%; height: 68%; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.llk-cell .llk-face { width: 100%; height: 100%; display: block; filter: drop-shadow(0 1px 1px rgba(120,90,50,.22)); }
.llk-cell.llk-edge { aspect-ratio: auto; background: transparent !important; box-shadow: none; pointer-events: none; }
.llk-cell.llk-gone { background: transparent !important; box-shadow: none; cursor: default; }
/* 已消除的格位留一道极浅凹槽痕迹:伪元素画的,不新增节点、不挡任何点击 */
.llk-cell.llk-gone:not(.llk-edge)::after { content: ""; position: absolute; inset: 8%; border-radius: 9px; background: rgba(120,90,54,.05); box-shadow: inset 0 1.5px 3px rgba(120,90,54,.1), inset 0 -1px 1.5px rgba(255,253,246,.5); pointer-events: none; }
@media (hover: hover) and (pointer: fine) {
  .llk-cell:not(.llk-gone):not(.llk-edge):hover { transform: translateY(-2px); box-shadow: 0 5px 0 var(--llk-tile-side), 0 8px 10px rgba(140,105,66,.24); }
  .llk-cell.llk-shape3:not(.llk-gone):hover { transform: translateY(-2px) rotate(45deg); }
}
.llk-cell.llk-sel { transform: translateY(-4px); box-shadow: 0 0 0 3px var(--llk-select), 0 6px 0 var(--llk-tile-side), 0 9px 14px rgba(244,133,159,.42); }
.llk-cell.llk-hint { box-shadow: 0 0 0 3px var(--llk-hint), 0 0 16px 7px var(--llk-hint), 0 3px 0 var(--llk-tile-side); animation: llkHintBreath calc(var(--llk-ms-hint) / 2) ease-in-out 2; }
.llk-cell.llk-mask { background-color: #E7E0F5 !important; }
.llk-cell.llk-linking { box-shadow: 0 0 0 3px var(--llk-trail), 0 0 14px 4px rgba(255,214,120,.65), 0 3px 0 var(--llk-tile-side); }
.llk-cell.llk-clear { animation: llkClear var(--llk-ms-clear) ease-in forwards; }
.llk-cell.llk-shake { animation: llkShake ${SHAKE_MS}ms ease; }
.llk-cell.llk-shuf { animation: llkShufHop var(--llk-ms-shuffle) ease-in-out both; }
.llk-cell:active { transform: scale(.94); }
/* 同色系靠轮廓区分，色觉不敏感也认得出 */
.llk-shape0 { border-radius: 50%; }
.llk-shape1 { border-radius: 6px; }
.llk-shape2 { border-radius: 50% 12% 50% 12%; }
.llk-shape3 { border-radius: 26%; transform: rotate(45deg); }
.llk-shape3 > span { transform: rotate(-45deg); }
.llk-shape4 { border-radius: 46% 46% 40% 40%; }
.llk-cell.llk-shape3.llk-sel { transform: translateY(-4px) rotate(45deg); }
/* 360px 兜底:牌面量出来不足 34px 时省略侧沿,只留顶面 + 描边 */
.llk-board.llk-slim .llk-cell { box-shadow: 0 0 0 1px var(--llk-tile-side); }
.llk-board.llk-slim .llk-cell.llk-gone, .llk-board.llk-slim .llk-cell.llk-edge { box-shadow: none; }
.llk-board.llk-slim .llk-cell.llk-sel { box-shadow: 0 0 0 3px var(--llk-select); }
.llk-board.llk-slim .llk-cell.llk-linking { box-shadow: 0 0 0 3px var(--llk-trail); }
.llk-board.llk-slim .llk-cell.llk-hint { box-shadow: 0 0 0 3px var(--llk-hint), 0 0 12px 5px var(--llk-hint); }
@keyframes llkClear { 45% { transform: perspective(320px) rotateY(78deg) scale(.86); opacity: .95; } 100% { transform: perspective(320px) rotateY(96deg) scale(.18); opacity: 0; } }
@keyframes llkShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
@keyframes llkHintBreath { 50% { box-shadow: 0 0 0 5px var(--llk-hint), 0 0 26px 13px var(--llk-hint), 0 3px 0 var(--llk-tile-side); } }
@keyframes llkShufHop { 45% { transform: translateY(-7px) rotate(2deg) scale(.96); } }
@keyframes llkTrailFade { to { opacity: 0; } }
/* 流星覆盖层:独立 SVG 挂在盘面容器最后,pointer-events: none 绝不挡点击 */
.llk-fx { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.llk-line { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: block; animation: llkTrailFade 200ms ease-out var(--llk-ms-trail) both; }
.llk-line.llk-line-calm { animation: none; }
.llk-line .llk-dust { filter: drop-shadow(0 0 3px rgba(255,214,120,.8)); }
.llk-msg { text-align: center; min-height: 22px; color: #8A5A30; font-weight: 700; margin-top: 8px; font-size: 15px; line-height: 1.45; }
.llk-modebar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 0 0 10px; }
/* display:flex 会压过 hidden 属性的 UA display:none,进关时模式条要真的让位 */
.llk-modebar[hidden] { display: none; }
.llk-open { border: none; border-radius: 14px; min-height: 44px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #FFE0B8; color: #A05C1E; cursor: pointer; box-shadow: 0 3px 0 #EFC291; }
.llk-open:active { transform: translateY(1px); box-shadow: 0 2px 0 #EFC291; }
.llk-back { border: none; border-radius: 14px; min-height: 44px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #E7E1FA; color: #5B4B8A; cursor: pointer; }
.llk-over { text-align: center; padding: 14px 8px; }
.llk-over h3 { margin: 0 0 6px; font-size: 19px; color: #A05C1E; }
.llk-over p { margin: 4px 0; font-size: 14px; color: #6B5B4A; line-height: 1.5; }
.llk-again { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) {
  .llk-board, .llk-cell { transition: none; }
  /* hurry 只变色不缩放;洗牌瞬换;流星不滑动;翻转消散改淡出 */
  .llk-badge.llk-hurry, .llk-cell.llk-shuf, .llk-line { animation: none; }
  .llk-cell.llk-hint { animation: none; }
  .llk-cell.llk-clear { animation: llkFadeOut 120ms ease forwards; }
  .llk-cell:hover, .llk-cell.llk-sel { transform: none; }
  .llk-cell.llk-shape3:hover, .llk-cell.llk-shape3.llk-sel { transform: rotate(45deg); }
  .llk-cell:not(.llk-gone):not(.llk-edge):hover { box-shadow: 0 0 0 2px var(--llk-select), 0 3px 0 var(--llk-tile-side); }
}
@keyframes llkFadeOut { to { opacity: 0; } }
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
  /** 流星覆盖层的宿主:里面挂独立的 <svg class="llk-line">,永远在盘面容器最后 */
  private readonly fx: HTMLElement;
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
    this.fx = el("div", "llk-fx");
    this.root.append(this.boardEl, this.fx);
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
    this.fit();
  }

  freeze(): void {
    this.frozen = true;
  }

  /** 收摊：冻结输入、整体拆掉流星覆盖层（计时归零由 Janitor 统一管） */
  dispose(): void {
    this.freeze();
    this.clearLine();
  }

  get state(): BoardState {
    return this.board;
  }

  /** 这套主题的键：图标映射按它转起点，v 相同必同款 */
  private get themeKey(): string {
    return this.emojis[0] ?? "";
  }

  /** 360px 兜底：量出真实牌宽，低于 34px 就切成「顶面 + 描边」的轻量画法 */
  fit(): void {
    const w = this.boardEl.clientWidth;
    const px =
      w > 0
        ? (w - CELL_GAP_PX * (this.board.cols + 1)) / (this.board.cols + RING_FRAC * 2)
        : cellSizePx(this.board.cols);
    this.boardEl.classList.toggle("llk-slim", slimTile(px));
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
          this.setFace(span, "", "");
          node.style.backgroundColor = "";
          node.setAttribute("aria-hidden", "true");
          continue;
        }
        node.removeAttribute("aria-hidden");
        const picked = !!this.link.first && this.link.first[0] === r && this.link.first[1] === c;
        const hidden = this.hooks.isHidden(r, c) && !picked;
        node.classList.add(shapeClass(v));
        if (hidden) {
          node.classList.add("llk-mask");
          this.setFace(span, "mask", maskFaceSvg());
          node.style.backgroundColor = "";
          node.setAttribute("aria-label", "戴着面具的图案，点一下看看");
        } else {
          this.setFace(span, `${this.themeKey}#${v}`, tileFaceSvg(this.themeKey, v));
          node.style.backgroundColor = bgOf(v);
          node.setAttribute("aria-label", `图案 ${tileIconName(this.themeKey, v)}`);
        }
        if (picked) node.classList.add("llk-sel");
      }
    }
  }

  /** 牌面只在真的换款时才重写 innerHTML，render 频繁跑也不抖 */
  private setFace(span: HTMLElement, key: string, svg: string): void {
    if (span.dataset.face === key) return;
    span.dataset.face = key;
    span.innerHTML = svg;
  }

  /** 提示：判定真求解出来的那一对泛柔光（呼吸两次共 2s） */
  highlight(pair: [Pt, Pt]): void {
    for (const [r, c] of pair) {
      const node = this.cells[r][c];
      node.classList.add("llk-hint");
      this.jan.after(HINT_GLOW_MS, () => node.classList.remove("llk-hint"));
    }
  }

  /** 洗牌：全部牌小幅腾空转位（180ms 交错）；安静模式瞬换不动 */
  shuffleFx(): void {
    if (this.calm) return;
    const { R, C } = this.board;
    for (let r = 1; r < R - 1; r++) {
      for (let c = 1; c < C - 1; c++) {
        if (this.board.grid[r][c] < 0) continue;
        const node = this.cells[r][c];
        node.style.animationDelay = `${((r + c) % 5) * 14}ms`;
        node.classList.add("llk-shuf");
      }
    }
    this.jan.after(SHUFFLE_FX_MS + 90, () => {
      for (const row of this.cells) {
        for (const node of row) {
          node.classList.remove("llk-shuf");
          node.style.animationDelay = "";
        }
      }
    });
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

  /** 连上了：流星滑过 → 到达 → 两张牌翻转消散 → 收拢滑动 → 回到待命 */
  private runLink(pair: [Pt, Pt], path: Pt[]): void {
    const [a, z] = pair;
    this.hooks.sfx("pop");
    this.render();
    for (const [r, c] of pair) this.cells[r][c].classList.add("llk-linking");
    this.drawPath(path);

    this.jan.after(linkHoldMs(this.calm), () => {
      for (const [r, c] of pair) {
        const node = this.cells[r][c];
        node.classList.remove("llk-linking");
        node.classList.add("llk-clear");
      }
      this.jan.after(clearMs(this.calm), () => {
        for (const [r, c] of pair) this.cells[r][c].classList.remove("llk-clear");
        // 流星焰尾陪着翻转淡完（CSS 那头在褪），这里才整体收走
        this.clearLine();
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

  /**
   * 画出真实路径（含拐点）的流星光带。
   * 折线坐标是 `meteorPoints` 把判定算出的拐点一比一映射成格子中心——
   * 一个点都不自己算、不加、不减；「线是怎么绕过去的」全由判定说了算。
   */
  private drawPath(path: readonly Pt[]): void {
    const w = this.boardEl.clientWidth;
    const h = this.boardEl.clientHeight;
    if (!w || !h) return;
    const pts = meteorPoints(path, (r, c) => {
      const node = this.cells[r][c];
      return [node.offsetLeft + node.offsetWidth / 2, node.offsetTop + node.offsetHeight / 2];
    });
    this.fx.innerHTML = meteorSvg(pts, w, h, { calm: this.calm });
  }

  clearLine(): void {
    this.fx.innerHTML = "";
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
  // 顶栏卡片化:剩余对数 / 计时 / 洗牌 / 提示四枚圆角卡片一行(360px 也放得下)
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="llk-top">
      <span class="llk-badge llk-left">${hudGlyphSvg("pairs")}<b class="llk-btext">剩0对</b></span>
      <span class="llk-badge llk-time">${hudGlyphSvg("clock")}<b class="llk-btext">0秒</b></span>
      <button class="llk-tool llk-shuffle" type="button">${hudGlyphSvg("shuffle")}<b class="llk-btext">洗牌×${cfg.shuffles}</b></button>
      <button class="llk-tool llk-hintbtn" type="button"><span class="llk-bico">${hudGlyphSvg("bulb")}</span><b class="llk-btext">提示×${HINT_MAX}</b></button>
      ${ruleChip(cfg) ? `<span class="llk-badge llk-rule">${ruleChip(cfg)}</span>` : ""}
    </div>
    <div class="llk-holder"></div>
    <div class="llk-msg"></div>
  `;
  stage.appendChild(wrap);

  const holder = wrap.querySelector(".llk-holder") as HTMLElement;
  const leftText = wrap.querySelector(".llk-left .llk-btext") as HTMLElement;
  const timeEl = wrap.querySelector(".llk-time") as HTMLElement;
  const timeText = wrap.querySelector(".llk-time .llk-btext") as HTMLElement;
  const msgEl = wrap.querySelector(".llk-msg") as HTMLElement;
  const hintBtn = wrap.querySelector(".llk-hintbtn") as HTMLButtonElement;
  const hintIco = wrap.querySelector(".llk-hintbtn .llk-bico") as HTMLElement;
  const hintText = wrap.querySelector(".llk-hintbtn .llk-btext") as HTMLElement;
  const shuffleBtn = wrap.querySelector(".llk-shuffle") as HTMLButtonElement;
  const shuffleText = wrap.querySelector(".llk-shuffle .llk-btext") as HTMLElement;

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
  jan.after(0, () => view.fit());
  jan.on(window, "resize", () => view.fit());

  function renderTop(): void {
    leftText.textContent = `剩${tilesLeft(board) / 2}对`;
    timeText.textContent = `${timeLeft}秒`;
    timeEl.classList.toggle("llk-hurry", timeLeft <= 15);
    shuffleText.textContent = `洗牌×${shufflesLeft}`;
    shuffleBtn.disabled = shufflesLeft <= 0 || levelDone;
    // 提示用完之后按钮不灰掉，改成「指个方向」：不给格子，只把搜索范围缩小
    const left = hintsLeft(hintsUsed);
    hintText.textContent = left > 0 ? `提示×${left}` : "指个方向";
    const glyph: HudGlyph = left > 0 ? "bulb" : "compass";
    if (hintIco.dataset.g !== glyph) {
      hintIco.dataset.g = glyph;
      hintIco.innerHTML = hudGlyphSvg(glyph);
    }
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
    view.shuffleFx();
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
      view.dispose();
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
      <span class="llk-badge llk-best">${hudGlyphSvg("medal")}<b class="llk-btext"></b></span>
    </div>
    <div class="llk-top">
      <span class="llk-badge llk-round">${hudGlyphSvg("round")}<b class="llk-btext">第 1 盘</b></span>
      <span class="llk-badge llk-pairs">${hudGlyphSvg("chain")}<b class="llk-btext">0 对</b></span>
      <span class="llk-badge llk-time">${hudGlyphSvg("clock")}<b class="llk-btext">不限时</b></span>
    </div>
    <div class="llk-holder"></div>
    <div class="llk-tools">
      <button class="llk-tool llk-shuffle" type="button">${hudGlyphSvg("shuffle")}<b class="llk-btext">重排</b></button>
    </div>
    <div class="llk-msg"></div>
  `;
  host.appendChild(wrap);

  const holder = wrap.querySelector(".llk-holder") as HTMLElement;
  const roundText = wrap.querySelector(".llk-round .llk-btext") as HTMLElement;
  const pairsText = wrap.querySelector(".llk-pairs .llk-btext") as HTMLElement;
  const timeEl = wrap.querySelector(".llk-time") as HTMLElement;
  const timeText = wrap.querySelector(".llk-time .llk-btext") as HTMLElement;
  const bestText = wrap.querySelector(".llk-best .llk-btext") as HTMLElement;
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
  jan.after(0, () => view.fit());
  jan.on(window, "resize", () => view.fit());

  function renderTop(): void {
    roundText.textContent = `第 ${st.round} 盘`;
    pairsText.textContent = `${st.pairs} 对`;
    timeText.textContent = timeLeft > 0 ? `${timeLeft} 秒` : "不限时";
    timeEl.classList.toggle("llk-hurry", timeLeft > 0 && timeLeft <= 15);
    bestText.textContent = (() => {
      const best = save.getGameProgress(meta.id).endlessBest;
      return best > 0 ? `最好 ${best} 对` : "还没有最好成绩";
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
      view.shuffleFx();
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
    view.shuffleFx();
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
      view.dispose();
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
