/**
 * 涂色小屋 · 界面公共件（1.2 新增）。
 *
 * 关卡和自由涂色沙盒长得很像：一张线稿、一排带色名的色块、一个调色锅、撤销重做。
 * 这一份把两边都要用的样式与小零件收在一起，免得改一处忘一处。
 *
 * 样式类名一律 `clf-` 前缀，全部写在本目录里，不往 `src/styles.css` 追加。
 * 元素上另挂了 `cf-region` / `cf-swatch` / `cf-mix-primary` 三个 1.0 的老类名当别名：
 * `scripts/smoke188.mjs` 靠它们在浏览器里替真人点画布，而 `scripts/` 不在本步的可改范围内。
 */
import { PIGMENT_HEX, PIGMENT_SYMBOL, lightness } from "./mix";
import type { Picture } from "./levels";

/** 颜料漫开的时长：不是瞬间变色，看得见颜色从笔尖化开 */
export const SPREAD_MS = 120;

/** 调色锅搅拌一圈的时长 */
export const STIR_MS = 640;

/** 手机上色块的最小热区 */
export const SWATCH_MIN_PX = 44;

/** 画布至少占屏高的比例 */
export const CANVAS_MIN_VH = 55;

export const CLF_CSS = `
.clf-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px;box-sizing:border-box;
  border-radius:16px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;width:100%;}
.clf-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.clf-badge{font-size:14px;font-weight:800;color:#7a5a20;background:#ffffffd9;border-radius:999px;padding:5px 12px;
  box-shadow:0 2px 6px rgba(150,130,80,.2);white-space:nowrap;}
.clf-msg{min-height:22px;font-size:15px;font-weight:800;color:#8a5a1c;text-align:center;line-height:1.5;
  max-width:400px;word-break:break-word;}
/* z-index：画布会跟着滚动往下挪（见 pinCanvas），得压在后面那些控件上面 */
.clf-stage{position:relative;z-index:2;width:100%;max-width:400px;overflow:hidden;border-radius:14px;
  min-height:${CANVAS_MIN_VH}vh;display:flex;align-items:center;justify-content:center;background:#fff;
  box-shadow:0 4px 0 #0001;touch-action:none;}
.clf-canvas{background:#fff;max-width:100%;height:auto;display:block;transform-origin:center center;
  transition:transform .2s ease;}
.clf-canvas .clf-region{cursor:pointer;stroke:#495057;stroke-width:3;stroke-linejoin:round;
  transition:fill ${SPREAD_MS}ms ease-out;}
.clf-canvas .clf-mark{font-weight:900;pointer-events:none;}
.clf-canvas.clf-done{filter:drop-shadow(0 0 10px #ffd43b);}
.clf-zoom{position:absolute;right:8px;bottom:8px;border:none;border-radius:999px;min-width:44px;min-height:44px;
  font-size:18px;font-weight:900;cursor:pointer;background:#ffffffe6;color:#5c4a30;font-family:inherit;
  box-shadow:0 3px 0 rgba(150,130,80,.28);}
.clf-zoom:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(150,130,80,.28);}
/* 指令多的时候能排到五六行，把画布挤得老远，所以给它一个天花板、自己滚 */
.clf-chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:400px;width:100%;
  max-height:84px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;}
.clf-legend{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:400px;}
.clf-chip{display:flex;align-items:center;gap:5px;background:#ffffffd9;border-radius:999px;padding:5px 10px;
  font-size:14px;font-weight:800;color:#5c4a30;box-shadow:0 2px 5px rgba(150,130,80,.18);line-height:1.4;
  word-break:break-word;}
.clf-chip-done{opacity:.55;text-decoration:line-through;}
.clf-chip-dot{width:15px;height:15px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 2px #0003;flex:0 0 auto;}
.clf-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.clf-tool{border:none;border-radius:999px;min-height:${SWATCH_MIN_PX}px;padding:8px 16px;font-size:15px;
  font-weight:900;cursor:pointer;font-family:inherit;background:#ffffffe0;color:#5c4a30;
  box-shadow:0 3px 0 rgba(150,130,80,.25);}
.clf-tool:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(150,130,80,.25);}
.clf-tool[disabled]{opacity:.42;cursor:default;box-shadow:none;}
.clf-palette{display:flex;gap:8px;justify-content:flex-start;overflow-x:auto;max-width:100%;padding:4px 2px 8px;
  scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.clf-palette::-webkit-scrollbar{display:none;}
.clf-swatch{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:3px;border:none;padding:2px;
  background:transparent;cursor:pointer;font-family:inherit;min-width:${SWATCH_MIN_PX}px;
  min-height:${SWATCH_MIN_PX + 22}px;}
.clf-swatch-dot{width:${SWATCH_MIN_PX}px;height:${SWATCH_MIN_PX}px;border-radius:50%;border:4px solid #fff;
  box-shadow:0 3px 0 #0002;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;
  transition:transform .15s;}
.clf-swatch-name{font-size:13px;font-weight:800;color:#5c4a30;white-space:nowrap;}
.clf-swatch:active .clf-swatch-dot{transform:scale(.92);}
.clf-swatch.clf-picked .clf-swatch-dot{transform:scale(1.14);border-color:#343a40;}
.clf-swatch.clf-picked .clf-swatch-name{color:#212529;text-decoration:underline;}
.clf-swatch.clf-fresh .clf-swatch-dot{animation:clfPop .6s;}
@keyframes clfPop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
.clf-mixer{display:flex;gap:8px;align-items:center;background:#ffffffd9;border-radius:14px;padding:6px 10px;
  flex-wrap:wrap;justify-content:center;max-width:400px;}
.clf-mix-label{font-size:14px;font-weight:800;color:#a15c07;}
.clf-pot{width:52px;height:44px;border-radius:0 0 22px 22px;border:3px solid #b08968;background:#fff;
  display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#7a5a20;
  overflow:hidden;position:relative;}
.clf-pot-soup{position:absolute;inset:4px;border-radius:0 0 18px 18px;}
.clf-pot.clf-stirring .clf-pot-soup{animation:clfStir ${STIR_MS}ms linear;}
@keyframes clfStir{from{transform:rotate(0) scale(.86)}to{transform:rotate(360deg) scale(1)}}
.clf-pot-star{position:absolute;top:-6px;left:50%;font-size:16px;animation:clfStar .7s ease-out;}
@keyframes clfStar{0%{opacity:0;transform:translate(-50%,6px) scale(.4)}
  40%{opacity:1;transform:translate(-50%,-10px) scale(1.15)}100%{opacity:0;transform:translate(-50%,-24px) scale(.8)}}
.clf-primaries{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
.clf-primary{display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:transparent;
  cursor:pointer;font-family:inherit;padding:0;min-width:${SWATCH_MIN_PX}px;min-height:${SWATCH_MIN_PX}px;}
.clf-primary-dot{width:34px;height:34px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 0 #0002;}
.clf-primary-name{font-size:12px;font-weight:800;color:#5c4a30;}
.clf-primary:active .clf-primary-dot{transform:scale(.9);}
.clf-preview{font-size:15px;font-weight:900;color:#6741d9;background:#ffffffd9;border-radius:999px;padding:6px 14px;}
.clf-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:16px;}
.clf-flake{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:clfFall 1.5s linear;}
@keyframes clfFall{to{transform:translateY(360px) rotate(420deg);opacity:.1}}
.clf-sheet{position:absolute;inset:0;z-index:9;background:linear-gradient(#fff8f0,#ffeedd);border-radius:16px;
  display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;overflow-y:auto;align-items:center;}
/* 画室是竖着的弹性盒，装不下时子项会被压扁（线稿那一排一度只剩 4px 高，点都点不着），
   所以一律不许收缩，装不下就让画室自己滚 */
.clf-sheet>*{flex:0 0 auto;}
.clf-sheet-head{display:flex;gap:8px;align-items:center;justify-content:space-between;width:100%;flex-wrap:wrap;}
.clf-sheet-title{font-size:17px;font-weight:900;color:#8a5a1c;}
.clf-picks{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:2px;scrollbar-width:none;}
.clf-picks::-webkit-scrollbar{display:none;}
.clf-pick{flex:0 0 auto;border:none;border-radius:12px;padding:6px 10px;font-size:13px;font-weight:800;
  cursor:pointer;font-family:inherit;background:#ffffffd9;color:#5c4a30;box-shadow:0 2px 5px rgba(150,130,80,.2);
  min-height:${SWATCH_MIN_PX}px;white-space:nowrap;}
.clf-pick.clf-pick-on{outline:3px solid #f08c00;}
.clf-gallery{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;max-width:400px;}
.clf-work{border:none;border-radius:10px;padding:2px;background:#fff;cursor:pointer;font-family:inherit;
  box-shadow:0 2px 6px rgba(150,130,80,.22);}
.clf-work svg{width:100%;height:auto;display:block;}
.clf-work.clf-work-on{outline:3px solid #f08c00;}
.clf-empty{font-size:13px;font-weight:700;color:#96795a;text-align:center;}
@media (max-width:400px){
  .clf-wrap{padding:8px;gap:8px;}
  .clf-controls{gap:8px;}
  .clf-chip{font-size:14px;}
  .clf-msg{font-size:14px;}
  .clf-gallery{grid-template-columns:repeat(3,1fr);}
}
@media (prefers-reduced-motion:reduce){
  .clf-canvas .clf-region{transition:none;}
  .clf-canvas{transition:none;}
  .clf-pot.clf-stirring .clf-pot-soup{animation:none;}
  .clf-pot-star{animation:none;}
  .clf-swatch.clf-fresh .clf-swatch-dot{animation:none;}
  .clf-flake{animation:none;display:none;}
}
`;

/**
 * 往上收集所有会裁掉内容的祖先。
 *
 * 壳层里这样的有两层：`.l99-stage-wrap` 只裁不滚，`.game-stage` 才是真正滚的那个，
 * 所以不能碰到第一个就收手——上边界要按最靠里的那一层算，滚动要每一层都听。
 */
function clippersOf(el: HTMLElement): HTMLElement[] {
  const view = el.ownerDocument.defaultView;
  if (!view) return [];
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = view.getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") out.push(p);
  }
  return out;
}

/**
 * 把画布钉在滚动区顶上，滑到下面选颜色时它也不会被顶出屏幕。
 *
 * 手机上光标题栏加关卡条就吃掉三成屏高，画布再占 55% 就一屏装不下，
 * 底下的调色盘必须滑出来点——滑一下画就没影了，选完颜色还得滑回去找那一块。
 *
 * 本该交给 `position:sticky`，可壳层的滚动区是 `overflow:hidden`，
 * 浏览器不拿它当粘性定位的参照物，画照样滑走，所以这里自己按滚动量挪。
 * 挪的幅度卡在「不超出整块的下沿」，画布不会盖到调色盘上。
 *
 * 返回值是拆监听的函数，`destroy` 时记得叫一声。
 */
export function pinCanvas(wrap: HTMLElement, stage: HTMLElement): () => void {
  const view = wrap.ownerDocument.defaultView;
  const ports = clippersOf(wrap);
  if (!view || ports.length === 0) return () => {};
  let shift = 0;
  const relayout = (): void => {
    // getBoundingClientRect 带着已经挪过的量，先减回去还原成原本的位置
    const raw = stage.getBoundingClientRect().top - shift;
    const room = wrap.getBoundingClientRect().bottom - raw - stage.getBoundingClientRect().height;
    const top = Math.max(...ports.map((p) => p.getBoundingClientRect().top));
    const want = Math.min(Math.max(top - raw, 0), Math.max(room, 0));
    if (Math.abs(want - shift) < 0.5) return;
    shift = want;
    stage.style.transform = shift > 0 ? `translateY(${shift.toFixed(1)}px)` : "";
  };
  for (const p of ports) p.addEventListener("scroll", relayout, { passive: true });
  view.addEventListener("resize", relayout);
  view.addEventListener("scroll", relayout, { passive: true });
  relayout();
  return () => {
    for (const p of ports) p.removeEventListener("scroll", relayout);
    view.removeEventListener("resize", relayout);
    view.removeEventListener("scroll", relayout);
    stage.style.transform = "";
  };
}

/** 系统里开了「减弱动效」吗；取不到就当没开 */
export function prefersReducedMotion(): boolean {
  const mq = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mq ? mq("(prefers-reduced-motion: reduce)").matches === true : false;
  } catch {
    return false;
  }
}

/** 把一幅线稿铺成可点的 SVG 内容（每块挂上 `data-id`，初始全白） */
export function pictureSvgBody(pic: Picture): string {
  return pic.regions
    .map((r) => r.svg.replace(/\/>\s*$/, ` class="clf-region cf-region" data-id="${r.id}" fill="#ffffff"/>`))
    .join("");
}

/** 缩略图：把一幅涂好的画缩成画廊里的小格子（纯字符串，没有图片文件） */
export function thumbnailSvg(pic: Picture, fills: Record<string, string>): string {
  const body = pic.regions
    .map((r) => r.svg.replace(/\/>\s*$/, ` fill="${PIGMENT_HEX[fills[r.id]] ?? "#ffffff"}"/>`))
    .join("");
  return `<svg viewBox="0 0 400 300" role="img" aria-label="${pic.name}的作品" style="stroke:#868e96;stroke-width:4">${body}</svg>`;
}

/** 深色底上写白字、浅色底上写深字，色块里的符号才看得清 */
export function inkOn(colorName: string): string {
  const hex = PIGMENT_HEX[colorName];
  return hex !== undefined && lightness(hex) < 62 ? "#ffffff" : "#343a40";
}

export interface SwatchOptions {
  /** 色块中央要不要压一个记号（数字涂色的编号、图例的符号） */
  mark?: string;
  /** 无障碍标签，不给就用色名 */
  label?: string;
}

/**
 * 一个色块：**永远是「色块 + 中文色名」两件套**。
 * 色盲的孩子看不出色块的差别，但读得出「浅蓝」和「深蓝」。
 */
export function makeSwatch(doc: Document, name: string, opts: SwatchOptions = {}): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = "clf-swatch cf-swatch";
  btn.title = name;
  btn.setAttribute("aria-label", opts.label ?? name);
  btn.dataset.color = name;
  const dot = doc.createElement("span");
  dot.className = "clf-swatch-dot";
  dot.style.background = PIGMENT_HEX[name] ?? "#ffffff";
  if (opts.mark) {
    dot.textContent = opts.mark;
    dot.style.color = inkOn(name);
  }
  const label = doc.createElement("span");
  label.className = "clf-swatch-name";
  label.textContent = name;
  btn.append(dot, label);
  return btn;
}

/** 调色锅边上那一排原料按钮，同样是「色块 + 色名」 */
export function makePrimary(doc: Document, name: string): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = "clf-primary cf-mix-primary";
  btn.title = `倒入${name}`;
  btn.setAttribute("aria-label", `倒入${name}`);
  btn.dataset.color = name;
  const dot = doc.createElement("span");
  dot.className = "clf-primary-dot";
  dot.style.background = PIGMENT_HEX[name] ?? "#ffffff";
  const label = doc.createElement("span");
  label.className = "clf-primary-name";
  label.textContent = name;
  btn.append(dot, label);
  return btn;
}

/** 指令小条：色块 + 色名 + 这一块的名字 */
export function makeChip(doc: Document, text: string, colorName?: string): HTMLElement {
  const chip = doc.createElement("span");
  chip.className = "clf-chip";
  if (colorName) {
    const dot = doc.createElement("span");
    dot.className = "clf-chip-dot";
    dot.style.background = PIGMENT_HEX[colorName] ?? "#ffffff";
    chip.appendChild(dot);
  }
  chip.appendChild(doc.createTextNode(text));
  return chip;
}

/** 这一关的颜色配的符号（限色章的额外图例） */
export function symbolOf(name: string): string {
  return PIGMENT_SYMBOL[name] ?? "◇";
}

/** 撒一把彩纸，`ms` 后自己收干净；减弱动效时什么都不做 */
export function confetti(host: HTMLElement, done: (fn: () => void, ms: number) => void): void {
  if (prefersReducedMotion()) return;
  const layer = host.ownerDocument.createElement("div");
  layer.className = "clf-confetti";
  const colors = ["#ff6b6b", "#ffd43b", "#69db7c", "#74c0fc", "#b197fc", "#ffa94d"];
  for (let i = 0; i < 24; i++) {
    const flake = host.ownerDocument.createElement("span");
    flake.className = "clf-flake";
    flake.style.left = `${(i * 97) % 100}%`;
    flake.style.background = colors[i % colors.length];
    flake.style.animationDelay = `${(i % 6) * 0.09}s`;
    layer.appendChild(flake);
  }
  host.appendChild(layer);
  done(() => layer.remove(), 1900);
}
