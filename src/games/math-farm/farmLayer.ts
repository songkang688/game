/**
 * 算数小农场 1.3 · 视觉层编排（只画不判：判定、计分、TTS 一个字不碰）。
 *
 * `createFarmLayer` 往舞台上铺四层：农场舞台背景（z0）、菜畦占格进度（z1，一畦 = 一题）、
 * 题卡里的实物插图（挂在 `.qz-wrap` 里、`.qz-prompt` 之后，题面文本原样保留）、
 * 动画层（z3，浇水 / 蜜蜂 / 彩纸 / 收成板，pointer-events: none）。
 *
 * 运行器的辅助层（`attachFarmHelper`）只在三个时刻喊一声：换题 / 答对 / 答错，
 * 这里听到之后各画各的——答对种下作物三阶段长大 + 浇水，答错歪头 + 「再想想」木牌
 * （绝不拔苗、绝不批评），全部答完收获仪式。`prefers-reduced-motion` 时风车 / 蜜蜂 /
 * 成长动画全停，直接给静态阶段图。`destroy` 把节点和计时器一个不剩收干净。
 */
import { FARM_PALETTE, basket, crop, cropAt } from "../../art/kit/crops";
import {
  BEE_EVERY,
  BEE_MS,
  CONFETTI_N,
  FARM_CSS,
  GROW_STEP_MS,
  GROW_TOTAL_MS,
  HARVEST_MS,
  RETHINK_MS,
  RETHINK_TEXT,
  WATER_MS,
  WOBBLE_MS,
  beeSvg,
  farmSceneSvg,
  wateringCanSvg,
} from "./farmScene";
import {
  countPlan,
  illustrationPlan,
  renderCountIllustration,
  renderIllustration,
  type IllusSource,
} from "./illustrate";

/** 运行器辅助层往视觉层喊话的三个口子 */
export interface FarmVisualHooks {
  onQuestion(index: number): void;
  onCorrect(index: number): void;
  onWrong(index: number): void;
}

export interface FarmLayer extends FarmVisualHooks {
  destroy(): void;
}

export interface FarmLayerOpts {
  /** 强制打开 / 关闭动效降级（不传就问系统的 prefers-reduced-motion） */
  reduced?: boolean;
}

/** 菜畦格里作物贴纸的边长（viewBox 坐标之外的展示尺寸由 CSS 收口） */
export const PLOT_CROP_PX = 23;

/** 彩纸的配色轮换（全部来自农场色板） */
export const CONFETTI_COLORS: readonly string[] = [
  FARM_PALETTE.carrotOrange,
  FARM_PALETTE.tomatoRed,
  FARM_PALETTE.cornYellow,
  FARM_PALETTE.leafGreen,
  FARM_PALETTE.skyTop,
];

/** 系统是否要求减少动效（问不到就当没有，绝不因此抛错） */
export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** `ref` 的下一个兄弟之前插入（真 DOM 与测试桩都只用 children + insertBefore） */
function insertAfter(parent: HTMLElement, node: HTMLElement, ref: HTMLElement): void {
  const at = Array.prototype.indexOf.call(parent.children, ref);
  const next = (parent.children[at + 1] as HTMLElement | undefined) ?? null;
  parent.insertBefore(node, next);
}

export function createFarmLayer(
  stage: HTMLElement,
  questions: readonly IllusSource[],
  opts: FarmLayerOpts = {}
): FarmLayer {
  const doc = stage.ownerDocument;
  const reduced = opts.reduced ?? prefersReducedMotion();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let dead = false;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
  }

  function el(tag: string, className: string): HTMLElement {
    const node = doc.createElement(tag);
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  // ---- 样式与四层节点 -------------------------------------------------------
  const style = doc.createElement("style");
  style.textContent = FARM_CSS;
  stage.appendChild(style);

  const scene = el("div", "mtf-scene");
  scene.innerHTML = farmSceneSvg();
  stage.appendChild(scene);

  const plots = el("div", "mtf-plots");
  const cells: HTMLElement[] = questions.map((_, i) => {
    const cell = el("span", "mtf-plot mtf-plot-todo");
    cell.setAttribute("data-plot", String(i));
    plots.appendChild(cell);
    return cell;
  });
  stage.appendChild(plots);

  const fx = el("div", "mtf-fx");
  stage.appendChild(fx);

  // 答题壳的宿主抬到舞台背景之上
  const host = stage.querySelector(".mtf-quizhost");
  if (host instanceof HTMLElement) host.classList.add("mtf-farm-host");

  // 实物插图卡：挂在题面卡片正下方，题面文本一个字不动
  const wrap = stage.querySelector(".qz-wrap");
  const prompt = wrap?.querySelector(".qz-prompt");
  let illus: HTMLElement | null = null;
  if (wrap instanceof HTMLElement && prompt instanceof HTMLElement) {
    illus = el("div", "mtf-illus");
    illus.hidden = true;
    insertAfter(wrap, illus, prompt);
  }

  // ---- 状态 ----------------------------------------------------------------
  const planted: boolean[] = questions.map(() => false);
  let current = -1;
  let streak = 0;
  let harvested = false;

  function setStage(index: number, stage3: "sprout" | "leaf" | "fruit"): void {
    const cell = cells[index];
    if (!cell) return;
    cell.setAttribute("data-stage", stage3);
    cell.innerHTML = crop(cropAt(index), stage3, PLOT_CROP_PX);
  }

  function onQuestion(index: number): void {
    if (dead) return;
    const i = Math.max(0, Math.min(index, cells.length - 1));
    if (cells[current]) cells[current].classList.remove("mtf-plot-now");
    current = i;
    const cell = cells[i];
    if (cell) {
      cell.classList.add("mtf-plot-now");
      cell.classList.remove("mtf-plot-todo");
      if (!planted[i] && cell.getAttribute("data-stage") === null) setStage(i, "sprout");
    }
    if (illus) {
      const q = questions[i];
      // 数一数题：题面那行裸 emoji 收进 sr-only（读屏还念得到），可见层换成
      // 贴纸行顶上当题卡。只改 class（属性变更），不动 .qz-prompt 的孩子，
      // 辅助层盯 childList 的 MutationObserver 毫发无伤。
      const counting = q ? countPlan(q) : null;
      if (prompt instanceof HTMLElement) {
        if (counting) prompt.classList.add("mtf-count-sr");
        else prompt.classList.remove("mtf-count-sr");
      }
      if (counting) illus.classList.add("mtf-illus-count");
      else illus.classList.remove("mtf-illus-count");
      const plan = !counting && q ? illustrationPlan(q, i) : null;
      if (counting) {
        illus.innerHTML = renderCountIllustration(counting);
        illus.hidden = false;
      } else if (plan) {
        illus.innerHTML = renderIllustration(plan);
        illus.hidden = false;
      } else {
        illus.innerHTML = "";
        illus.hidden = true;
      }
    }
  }

  function spawnWater(): void {
    const can = el("div", "mtf-water");
    can.innerHTML = wateringCanSvg();
    fx.appendChild(can);
    later(() => can.remove(), WATER_MS + 120);
  }

  function spawnBee(): void {
    const bee = el("div", reduced ? "mtf-bee mtf-bee-still" : "mtf-bee");
    bee.innerHTML = beeSvg();
    fx.appendChild(bee);
    later(() => bee.remove(), BEE_MS);
  }

  function spawnConfetti(): void {
    for (let i = 0; i < CONFETTI_N; i++) {
      const bit = el("span", "mtf-confetti");
      bit.setAttribute(
        "style",
        `left:${4 + ((i * 17) % 92)}%;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};animation-delay:${(i % 5) * 60}ms`
      );
      fx.appendChild(bit);
    }
    later(() => {
      for (const bit of Array.from(fx.children)) {
        if (bit instanceof HTMLElement && bit.classList.contains("mtf-confetti")) bit.remove();
      }
    }, HARVEST_MS + 400);
  }

  function harvest(): void {
    if (harvested) return;
    harvested = true;
    const box = el("div", "mtf-harvest");
    const pail = el("div", "mtf-harvest-basket");
    pail.innerHTML = basket(68, false);
    const board = el("div", "mtf-harvest-board");
    board.textContent = `🧺 今日收获 ${cells.length} 棵！`;
    box.appendChild(pail);
    box.appendChild(board);
    fx.appendChild(box);
    if (reduced) return; // 静态收成画面：篮子 + 计数板留着，跳跃与彩纸全免
    for (let i = 0; i < Math.min(5, cells.length); i++) {
      const jump = el("span", "mtf-harvest-jump");
      jump.innerHTML = crop(cropAt(i), "fruit", 26);
      jump.setAttribute("style", `left:${34 + i * 8}%;top:42%;--mtf-jx:${(i - 2) * 26}px`);
      box.appendChild(jump);
      later(() => jump.remove(), HARVEST_MS);
    }
    spawnConfetti();
  }

  function onCorrect(index: number): void {
    if (dead) return;
    const i = Math.max(0, Math.min(index, cells.length - 1));
    const cell = cells[i];
    planted[i] = true;
    streak++;
    if (cell) {
      cell.classList.remove("mtf-plot-wobble", "mtf-plot-todo");
      cell.classList.add("mtf-plot-done");
      if (reduced) {
        setStage(i, "fruit");
      } else {
        cell.classList.add("mtf-plot-grow");
        setStage(i, "sprout");
        later(() => setStage(i, "leaf"), GROW_STEP_MS);
        later(() => setStage(i, "fruit"), GROW_STEP_MS * 2);
        later(() => cell.classList.remove("mtf-plot-grow"), GROW_TOTAL_MS);
        spawnWater();
      }
    }
    if (streak > 0 && streak % BEE_EVERY === 0) spawnBee();
    if (planted.length > 0 && planted.every(Boolean)) harvest();
  }

  function onWrong(index: number): void {
    if (dead) return;
    streak = 0;
    const cell = cells[Math.max(0, Math.min(index, cells.length - 1))];
    if (cell) {
      // 歪头与成长两个分支互斥；苗永远留在畦里（不拔苗、不打叉）
      cell.classList.remove("mtf-plot-grow");
      cell.classList.add("mtf-plot-wobble");
      later(() => cell.classList.remove("mtf-plot-wobble"), WOBBLE_MS);
    }
    const old = fx.querySelector(".mtf-rethink");
    if (old instanceof HTMLElement) old.remove();
    const sign = el("div", "mtf-rethink");
    sign.textContent = RETHINK_TEXT;
    fx.appendChild(sign);
    later(() => sign.remove(), RETHINK_MS);
  }

  onQuestion(0);

  return {
    onQuestion,
    onCorrect,
    onWrong,
    destroy() {
      dead = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      if (host instanceof HTMLElement) host.classList.remove("mtf-farm-host");
      if (prompt instanceof HTMLElement) prompt.classList.remove("mtf-count-sr");
      illus?.remove();
      fx.remove();
      plots.remove();
      scene.remove();
      style.remove();
    },
  };
}
