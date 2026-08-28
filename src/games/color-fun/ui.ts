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
import { blobLayers } from "../../art/kit/paintBlob";
import type { Picture } from "./levels";

/** 颜料漫开的时长：不是瞬间变色，看得见颜色从笔尖化开 */
export const SPREAD_MS = 120;

/** 调色锅搅拌一圈的时长 */
export const STIR_MS = 640;

/** 手机上色块的最小热区 */
export const SWATCH_MIN_PX = 44;

/** 画布至少占屏高的比例（够高的机器上照旧留这么大一块给画） */
export const CANVAS_MIN_VH = 55;

/**
 * 画布框最矮收到这个像素高度。
 * 再往下收线稿里的小块就点不准了，宁可让整块自己滚，也不把画压成一条缝。
 */
export const CANVAS_MIN_PX = 180;

export const CLF_CSS = `
.clf-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px;box-sizing:border-box;
  border-radius:16px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;width:100%;}
/* 这一屏也是竖着的弹性盒：一旦被 fitColoringStage 钳出一个天花板，子项就会被压扁
   （实测调色板整排从 81px 压成 6px，画布框直接归零）——一律不许收缩，装不下就让整屏自己滚。
   跟画室那条 .clf-sheet>* 是同一条规矩。没有天花板时这一行不改变任何布局。 */
.clf-wrap>*{flex:0 0 auto;}
.clf-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.clf-badge{font-size:14px;font-weight:800;color:#7a5a20;background:#ffffffd9;border-radius:999px;padding:5px 12px;
  box-shadow:0 2px 6px rgba(150,130,80,.2);white-space:nowrap;}
.clf-msg{min-height:22px;font-size:15px;font-weight:800;color:#8a5a1c;text-align:center;line-height:1.5;
  max-width:400px;word-break:break-word;}
/* z-index：画布会跟着滚动往下挪（见 pinCanvas），得压在后面那些控件上面 */
.clf-stage{position:relative;z-index:2;width:100%;max-width:400px;overflow:hidden;border-radius:14px;
  min-height:${CANVAS_MIN_VH}vh;display:flex;align-items:center;justify-content:center;background:#fff;
  box-shadow:0 4px 0 #0001;touch-action:none;}
/* 这一屏真的挂上滚动条那一档（见 fitColoringStage）：画布得把竖向手势让出去。
   pinCanvas 把画布按滚动量往下钉，它恒占滚动视口的上半张，而涂色时手指本来就
   落在画布上——画布还锁着 touch-action:none 的话一步都划不动，底下的调色板整排
   就仍旧够不着（窗口5 第2轮 W5R2-F-A-05）。让的是手势不是尺寸，热区一分没动；
   双指捏合缩放走的是 pointer 事件，两根手指下去照样认。 */
.clf-wrap.clf-scrolly .clf-stage{touch-action:pan-y;}
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
/* 操作排（色票/撤销/调色锅/色盘）单独成列：矮横屏双栏时钉在画布右侧，
   不要跟画布一起卷进 .clf-scrolly。竖屏仍是画布下面那一叠，gap 跟外壳对齐。 */
.clf-ops{display:flex;flex-direction:column;align-items:center;gap:inherit;width:100%;min-width:0;}
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
/* 「挤一挤」这一档不是媒体查询能判的：真机上舞台（平台那层 game-stage）比视口矮一大截——
   390×844 的机器上舞台只看得见 730px，而这一屏的内容能长到 1093px。
   按 vh 判会得出「屏幕很高，不用收」的错误结论，所以这一档由 fitColoringStage()
   在运行期量完舞台真实可视高之后挂上来。
   **热区一个都不动**：.clf-tool / .clf-swatch / .clf-primary / .clf-zoom 的 44px
   全部不在这一档里，收的只有留白、字号和几条装饰行的高度。 */
.clf-wrap.clf-tight{gap:6px;padding:6px;}
.clf-wrap.clf-tight .clf-badge{font-size:13px;padding:4px 10px;}
.clf-wrap.clf-tight .clf-chips{max-height:62px;gap:4px;}
.clf-wrap.clf-tight .clf-chip{padding:4px 8px;line-height:1.3;}
.clf-wrap.clf-tight .clf-legend{gap:4px;}
.clf-wrap.clf-tight .clf-mixer{padding:4px 8px;gap:6px;}
.clf-wrap.clf-tight .clf-primary-dot{width:28px;height:28px;}
.clf-wrap.clf-tight .clf-palette{padding:2px 2px 4px;gap:6px;}
.clf-wrap.clf-tight .clf-swatch-name{font-size:12px;}
.clf-wrap.clf-tight .clf-msg{min-height:18px;font-size:13px;line-height:1.35;}
.clf-wrap.clf-tight .clf-preview{padding:4px 10px;font-size:14px;}
@media (prefers-reduced-motion:reduce){
  .clf-canvas .clf-region{transition:none;}
  .clf-canvas{transition:none;}
  .clf-pot.clf-stirring .clf-pot-soup{animation:none;}
  .clf-pot-star{animation:none;}
  .clf-swatch.clf-fresh .clf-swatch-dot{animation:none;}
  .clf-flake{animation:none;display:none;}
}
/* 「再挤挤」这一档（W5R3-TA-02）——它治的不是「够不着」，是**来回滚**。
   真机 320×568 第 181 关：这一屏 701px 塞进 282px 的窗口，每一颗按钮慢拖都够得着，
   可画布 180px + 调色锅那一排 105px = 285px > 282px，canPinCanvas() 判「钉不住」，
   于是画布不再跟着滚——孩子滚下去选色、滚上来涂、再滚下去，一块颜色两趟。
   这一档只收调色锅那一排与几条装饰行的**留白、字号、色点直径**，
   把最高那一排压回「钉得住」的高度；画布一钉住，选色→涂色就在同一屏里完成。
   **热区一个都不动**：.clf-tool / .clf-swatch-dot / .clf-primary / .clf-zoom 的 44px
   一条都不在这一档里，字号也不许收到基准样式自己的 12px 下限以下。
   排在 reduced-motion 后面是为了让它稳稳盖住「挤一挤」那一档的同名声明。 */
.clf-wrap.clf-tighter{gap:4px;padding:5px;}
.clf-wrap.clf-tighter .clf-badge{font-size:12px;padding:3px 8px;}
.clf-wrap.clf-tighter .clf-legend{gap:3px;}
.clf-wrap.clf-tighter .clf-chip{font-size:12px;padding:3px 7px;gap:4px;line-height:1.3;}
.clf-wrap.clf-tighter .clf-chip-dot{width:12px;height:12px;border-width:1px;}
.clf-wrap.clf-tighter .clf-chips{max-height:48px;gap:3px;}
.clf-wrap.clf-tighter .clf-mixer{padding:3px 7px;gap:5px;}
.clf-wrap.clf-tighter .clf-mix-label{font-size:12px;}
.clf-wrap.clf-tighter .clf-pot{width:46px;height:36px;font-size:12px;border-width:2px;}
/* 只收看得见的那颗圆点和名字，按得着的那个盒子（.clf-primary 的 44×44）一分没动 */
.clf-wrap.clf-tighter .clf-primary-dot{width:24px;height:24px;border-width:2px;}
.clf-wrap.clf-tighter .clf-primary-name{font-size:12px;line-height:1.1;}
.clf-wrap.clf-tighter .clf-preview{font-size:13px;padding:4px 10px;}
.clf-wrap.clf-tighter .clf-palette{padding:2px 2px 3px;gap:6px;}
.clf-wrap.clf-tighter .clf-swatch-name{font-size:12px;line-height:1.1;}
.clf-wrap.clf-tighter .clf-msg{min-height:16px;font-size:13px;line-height:1.3;}
/* N-43(trio-r11):915×412 七关型色盘/调色锅整排掉进 .clf-scrolly 线下。
   矮横屏改双栏——画布左、操作排右 sticky；画布放开 55vh 下限。竖屏与高屏零变化。 */
@media (max-height:500px){
  .clf-wrap{min-height:0;}
  .clf-stage{min-height:0;}
}
@media (max-height:500px) and (min-width:640px){
  .clf-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,38%);
    grid-template-areas:"top top" "preview preview" "legend legend" "stage ops";
    align-items:stretch;gap:6px 10px;padding:6px 8px;}
  .clf-wrap>.clf-studio{grid-area:1 / 1 / -1 / -1;}
  .clf-wrap>.clf-top{grid-area:top;}
  .clf-wrap>.clf-preview{grid-area:preview;}
  .clf-wrap>.clf-legend{grid-area:legend;}
  .clf-wrap>.clf-stage{grid-area:stage;min-height:0;max-width:none;width:100%;
    max-height:min(260px,calc(100dvh - 88px));align-self:stretch;}
  .clf-wrap>.clf-ops{grid-area:ops;position:sticky;top:0;align-self:start;gap:6px;
    width:100%;max-width:100%;}
  .clf-wrap.clf-scrolly{overflow:hidden;}
  .clf-wrap .clf-chips{max-height:44px;}
  .clf-wrap .clf-mixer{max-width:100%;}
  .clf-wrap .clf-palette{max-width:100%;justify-content:center;}
}
@media (max-height:840px) and (min-height:501px) and (min-width:640px){
  .clf-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,38%);
    grid-template-areas:"top top" "preview preview" "legend legend" "stage ops";
    align-items:stretch;gap:8px 12px;}
  .clf-wrap>.clf-studio{grid-area:1 / 1 / -1 / -1;}
  .clf-wrap>.clf-top{grid-area:top;}
  .clf-wrap>.clf-preview{grid-area:preview;}
  .clf-wrap>.clf-legend{grid-area:legend;}
  .clf-wrap>.clf-stage{grid-area:stage;min-height:0;max-width:none;width:100%;
    max-height:min(360px,calc(100dvh - 120px));align-self:stretch;}
  .clf-wrap>.clf-ops{grid-area:ops;position:sticky;top:0;align-self:start;gap:6px;
    width:100%;max-width:100%;}
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
 * 一层裁切祖先真正的那条裁切线：**padding box 的下沿**，不是 border box 的。
 *
 * 滚动口是 padding box，下边框那几像素照不进内容；`getBoundingClientRect().bottom`
 * 给的却是 border box 的下沿，而 `.game-stage` 写着 `border:4px solid #fff`。
 * `W5R3-TA-05` 已经把本档四份 `fit.ts` 改成了 `clientHeight` 口径，
 * 这一款的收紧器是第五份、当时漏在外面：真机复量 320×568 上真可视段 278px，
 * 它却钳出 282px；矮横屏 568×320 上可视段总共才 44px，多算的 4px 将近一成（W5R3-AF-01）。
 *
 * 优先走 `clientHeight` 口径（`rect.top + clientTop + clientHeight`，横向滚动条也一并算掉）；
 * 量不出来（用例里的桩节点 / SSR）才退回「减掉下边框宽度」，再不行就照原样返回。
 * 那圈 4px 边框本身在 `src/styles.css`（禁改），交窗口1；这里改的只是自己量的那把尺子。
 */
export function clipBottomPx(
  rect: { top: number; bottom: number },
  clientTop: number,
  clientHeight: number,
  borderBottomWidth: string
): number {
  if (Number.isFinite(clientTop) && Number.isFinite(clientHeight) && clientHeight > 0) {
    return rect.top + clientTop + clientHeight;
  }
  const w = Number.parseFloat(borderBottomWidth);
  return Number.isFinite(w) && w > 0 ? rect.bottom - w : rect.bottom;
}

/**
 * 从 `selfTop` 往下，舞台真正看得见的还剩多少像素。
 *
 * `clipperBottoms` 是所有会裁掉内容的祖先的下沿——取最小的那个，
 * 只要有一层裁，再往下就看不见了。一层都没有（用例里的裸节点）返回 `Infinity`，表示不用钳。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 画布框到底给多高。
 *
 * `room` 是舞台看得见的那一段，`otherPx` 是这一屏上除了画布框以外所有东西的高度，
 * `wanted` 是 CSS 本来想要的那么高（`55vh`）。地方够就照旧给 `wanted`，
 * 不够就把剩下的都给画布，但不许收到 `CANVAS_MIN_PX` 以下——
 * 再收下去线稿里的小块点不准，那是拿一个毛病换另一个毛病。
 */
export function canvasBoxPx(room: number, otherPx: number, wanted: number): number {
  if (!Number.isFinite(room) || room <= 0) return wanted;
  const left = Math.floor(room - Math.max(0, otherPx));
  return Math.max(CANVAS_MIN_PX, Math.min(wanted, left));
}

/**
 * 收完第一档、画布也退到底线了，**画布还是钉不住**吗——钉不住就得再收一档（W5R3-TA-02）。
 *
 * 「钉不住」的后果不是够不着（每一颗按钮慢拖都够得着），是**来回滚**：
 * 画布不跟着滚，孩子滚下去选色、滚上来涂、再滚下去，一块颜色两趟。
 * 320×568 第 181 关上我的通关机器人为此开锅 14 次一次没配出目标色。
 *
 * 判据就是 {@link canPinCanvas} 的反面，外加两道闸：量不出来不动、地方够就不动——
 * 高屏上（360×640 / 390×844 实测 `canPin` 本来就成立）这一档一次都不会挂。
 */
export function needsTighter(portPx: number, canvasPx: number, tailPx: number): boolean {
  if (!Number.isFinite(portPx) || portPx <= 0) return false;
  if (!Number.isFinite(canvasPx) || canvasPx <= 0) return false;
  if (!Number.isFinite(tailPx) || tailPx <= 0) return false;
  return !canPinCanvas(portPx, canvasPx, tailPx);
}

/**
 * 收完第二档之后，画布框还得再让一让才钉得住的话，让到哪儿为止。
 *
 * 上限是「滚动视口减掉后面最高那一排」，下限仍旧是 `CANVAS_MIN_PX`——
 * 再往下收线稿里的小块就点不准了，那是拿一个毛病换另一个毛病。
 * 本来就比这还矮就照原样返回，不平白把画放大。
 */
export function pinnableCanvasPx(portPx: number, tailPx: number, boxPx: number): number {
  if (!Number.isFinite(portPx) || portPx <= 0) return boxPx;
  if (!Number.isFinite(tailPx) || tailPx <= 0) return boxPx;
  if (!Number.isFinite(boxPx) || boxPx <= 0) return boxPx;
  return Math.max(CANVAS_MIN_PX, Math.min(boxPx, Math.floor(portPx - tailPx)));
}

/**
 * 把这一屏钳进「舞台看得见的那一段」：先收画布框，还装不下就让这一屏自己滚。
 *
 * 为什么必须在运行期量、不能写成媒体查询：舞台（`.game-stage`，平台文件，交窗口1）
 * 比视口矮一大截——390×844 的机器上舞台只看得见 730px，而这一屏能长到 1093px。
 * 按 `vh` 判会得出「屏幕很高，不用收」的错误结论，正是第 2 轮测试员 W5R2-A-01 里
 * 「390×844 起调色板整排点不着」的直接原因。
 *
 * 也不能只写 `max-height:100%`：百分比要有定高父级，而壳层这条链上
 * `.l99-stage` / `.l99-stage-wrap` 都是内容撑出来的 auto 高，那行钳不住任何东西
 * （档B 第 1 轮监督修复员真机复核过，`scrollHeight === clientHeight`，滚动条一次都没出现）。
 * 这里写的是**像素值**，所以真的钳得住，用户也真的滑得动。
 *
 * 顺序：① 挂 `clf-tight` 收留白与字号（热区一个不动）；② 收画布框；③ 还高就自己滚。
 * 装得下就把三样一起还回去，高屏上不会凭空多出一个滚动容器。
 */
export function fitColoringStage(
  wrap: HTMLElement,
  stageBox: HTMLElement
): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const measurable = typeof wrap.getBoundingClientRect === "function" && !!view;
  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先把上一次钳出来的都还原，不然量到的是钳完的高度，越量越小
    wrap.classList.remove("clf-tight");
    wrap.classList.remove("clf-tighter");
    wrap.classList.remove("clf-scrolly");
    wrap.style.maxHeight = "";
    wrap.style.overflowY = "";
    wrap.style.overscrollBehavior = "";
    stageBox.style.height = "";
    stageBox.style.minHeight = "";
    const bottoms: number[] = [];
    for (const p of clippersOf(wrap)) {
      bottoms.push(clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, view.getComputedStyle(p).borderBottomWidth));
    }
    const room = visibleRoomPx(wrap.getBoundingClientRect().top, bottoms);
    if (!Number.isFinite(room) || room <= 0) return;
    if (wrap.scrollHeight <= room + 1) return;
    wrap.classList.add("clf-tight");
    const wanted = stageBox.getBoundingClientRect().height;
    const box = canvasBoxPx(room, wrap.scrollHeight - wanted, wanted);
    if (box < wanted) {
      stageBox.style.minHeight = "0";
      stageBox.style.height = `${box}px`;
    }
    // 收完第一档、画布也退到底线了，画布仍旧钉不住（320×568 与两档横屏就是这样）：
    // 再收一档，把后面最高那一排压回「钉得住」的高度，选色 → 涂色才在同一屏里完成。
    // 收完之后重量一次：那一排矮了，画布框能不能长回来由 canvasBoxPx 自己算，
    // 但绝不许长到又把自己顶得钉不住（pinnableCanvasPx 那道上限）。W5R3-TA-02
    if (needsTighter(room, stageBox.getBoundingClientRect().height, tallestTailPx(wrap, stageBox))) {
      wrap.classList.add("clf-tighter");
      stageBox.style.height = "";
      stageBox.style.minHeight = "";
      const wanted2 = stageBox.getBoundingClientRect().height;
      const box2 = pinnableCanvasPx(
        room,
        tallestTailPx(wrap, stageBox),
        canvasBoxPx(room, wrap.scrollHeight - wanted2, wanted2)
      );
      if (box2 < wanted2) {
        stageBox.style.minHeight = "0";
        stageBox.style.height = `${box2}px`;
      }
    }
    if (wrap.scrollHeight > room + 1) {
      wrap.style.maxHeight = `${Math.floor(room)}px`;
      wrap.style.overflowY = "auto";
      wrap.style.overscrollBehavior = "contain";
      // 真的滚起来了才让画布放开竖向手势——「挤一挤」那一档挂了不代表在滚
      wrap.classList.add("clf-scrolly");
    }
  };
  relayout();
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
    },
  };
}

/**
 * 画布钉得住吗：滚动视口在画布底下，还剩不剩得下**后面最高的那一排**。
 *
 * 钉住画布是白赚的好处，前提是别把底下的控件挤没了。390×844 上滚动视口 556px、
 * 画布 180px，钉住之后还剩 376px，调锅那一排（105px）整整齐齐露在外面；
 * 可 320×568 上滚动视口只剩 284px，钉住只留 104px——比调锅那一排还矮 1px，
 * 于是孩子照最自然的那一下「一甩到底」，落在 `scrollTop` 最大值上，
 * 调锅整排正好躺在画布底下，倒入红 / 黄 / 蓝 / 白 / 黑 五颗一颗都点不着
 * （CDP 实测 `elementFromPoint(键心)` 拿回来的是线稿里的 `<rect>`）。
 * 而这一款的调色关就是靠这五颗兑色，够不着 = 过不了关。
 *
 * 剩不下就这一档不钉，让画布跟着滚出去。矮屏上「看得见画」和「够得着调锅」
 * 只能二选一时，够得着才是能不能玩下去的那一个。
 *
 * 量不到（后面一排都没有、视口算不出来）一律返回 `true` 照旧钉，
 * 不拿一个量不准的数去改高屏上本来就对的行为。
 */
export function canPinCanvas(portPx: number, canvasPx: number, tallestTailPx: number): boolean {
  if (!Number.isFinite(portPx) || portPx <= 0) return true;
  if (!Number.isFinite(tallestTailPx) || tallestTailPx <= 0) return true;
  return portPx - canvasPx >= tallestTailPx;
}

/** 这一屏里排在画布后面的那些排，最高的一排有多高；量不到就是 0（＝不拦着钉） */
export function tallestTailPx(wrap: HTMLElement, stage: HTMLElement): number {
  const kids = wrap.children as unknown as ArrayLike<Element> | undefined;
  if (!kids || typeof kids.length !== "number") return 0;
  let seen = false;
  let tallest = 0;
  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    if (kid === stage) {
      seen = true;
      continue;
    }
    if (!seen || typeof kid?.getBoundingClientRect !== "function") continue;
    tallest = Math.max(tallest, kid.getBoundingClientRect().height);
  }
  return tallest;
}

/**
 * 把画布钉在滚动区顶上，滑到下面选颜色时它也不会被顶出屏幕。
 *
 * 手机上光标题栏加关卡条就吃掉三成屏高，画布再占 55% 就一屏装不下，
 * 底下的调色盘必须滑出来点——滑一下画就没影了，选完颜色还得滑回去找那一块。
 *
 * 本该交给 `position:sticky`，可壳层的滚动区是 `overflow:hidden`，
 * 浏览器不拿它当粘性定位的参照物，画照样滑走，所以这里自己按滚动量挪。
 * 挪的幅度卡在「不超出整块的下沿」；矮到连后面最高那一排都腾不出来时，
 * 这一档干脆不钉（见 {@link canPinCanvas}）。
 *
 * 返回值是拆监听的函数，`destroy` 时记得叫一声。
 */
export function pinCanvas(wrap: HTMLElement, stage: HTMLElement): () => void {
  const view = wrap.ownerDocument.defaultView;
  // `fitColoringStage` 会在装不下时把 wrap 自己变成滚动容器——那才是矮机器上
  // 用户真的滑得动的那一层，所以它必须也在监听名单里，否则画布不会跟着挪。
  const ports = [wrap, ...clippersOf(wrap)];
  if (!view) return () => {};
  let shift = 0;
  const relayout = (): void => {
    // getBoundingClientRect 带着已经挪过的量，先减回去还原成原本的位置
    const raw = stage.getBoundingClientRect().top - shift;
    const stageH = stage.getBoundingClientRect().height;
    const room = wrap.getBoundingClientRect().bottom - raw - stageH;
    const top = Math.max(...ports.map((p) => p.getBoundingClientRect().top));
    const bottom = Math.min(...ports.map((p) => p.getBoundingClientRect().bottom));
    const want = canPinCanvas(bottom - top, stageH, tallestTailPx(wrap, stage))
      ? Math.min(Math.max(top - raw, 0), Math.max(room, 0))
      : 0;
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
  // 颜料坨质感（1.3 视觉）：底色那行照旧是纯 hex，凸起感全靠叠上去的三层渐变
  dot.style.backgroundImage = blobLayers(PIGMENT_HEX[name] ?? "#ffffff");
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
  // 原料按钮也是一坨颜料（1.3 视觉）：同样只叠不换底
  dot.style.backgroundImage = blobLayers(PIGMENT_HEX[name] ?? "#ffffff");
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
