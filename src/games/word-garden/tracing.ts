/**
 * 识字小花园 1.2：笔顺描红台（纯 2D）。1.3 视觉升级：只换皮，不动骨。
 *
 * 宣纸米字格里摆一个淡红的模字，下一笔用红虚线亮出来、起笔处一个呼吸圆点，
 * 蓝色小箭头先沿这一笔的**笔顺数据路径**预演一遍（600ms 渐隐；reduced 静止常显）；
 * 孩子顺着描一道，`strokes.ts` 的纯函数判定这一笔算不算描出来了：
 *  - 描对：这一笔用毛笔变宽笔迹落成沉稳墨色（慢粗快细、起笔顿点、撇捺出锋）；
 *  - 顺序反了：只说「那一笔留到后面写」，笔迹变灰轻抖一下就收走，**不扣分、不判失败**；
 *  - 描歪了：提示顺着虚线从圆点起笔。
 * 每写成一个字，格子上方开出一朵五瓣花（5 帧展开），落进底部花园横条——
 * 写过几个字就有几朵花，点一点还能弹出那个字的小字卡。
 * 整关描完必定 `ctx.win`，最差也是一颗星 —— 写字这件事上不该有「输」。
 *
 * 视觉红线：判定轨迹点集、容差、热区换算（padPoint）一个像素都没动；
 * 毛笔笔锋只是渲染层（art/kit/brush.ts 纯函数），花朵是 art/kit/flower.ts。
 * 样式一律 `wgd-` 前缀，只往后贴，不动 `qz-` / `l99-` 任何既有规则。
 */
import { brushSvg, brushWidths, resamplePoints, strokeKindOf } from "../../art/kit/brush";
import { BLOOM_FRAMES, FLOWER_TRIO, flowerSvg } from "../../art/kit/flower";
import { shadeFlower } from "./flowerShade";
import { rateBelow, type PlayCtx, type PlayHandle } from "../level99";
import type { QuizTheme } from "../quiz99";
import { speak, speechReady, stopSpeaking, whenSpeechReady } from "../speech";
import { fitQuizHost } from "./fit";
import {
  ARROW_POINTS,
  easeInOutQuad,
  gardenCardLabel,
  gardenFlowers,
  gardenStage,
  guideDotAt,
  INK_BASE_W,
  INK_RESAMPLE_STEP,
  paperGridSvg,
  pointAlong,
  previewPath,
  WG_TOKENS,
} from "./inkArt";
import {
  GRID,
  judgeTrace,
  strokeNames,
  traceDoneLine,
  traceHint,
  type Point,
  type StrokeChar,
} from "./strokes";

/** 手机 360px 上描红区的最小边长（规格底线） */
export const MIN_PAD_PX = 240;

export const TRACE_INTRO = "米字格里按顺序描一描，描错顺序也没关系，我们再来一次～";

/** 预演箭头走完一遍的时长（纯视觉） */
export const PREVIEW_MS = 600;

/** 五瓣花展开总时长（5 帧）与花落入花园的时长（纯视觉） */
export const BLOOM_MS = 450;
export const FALL_MS = 400;

export const WGD_CSS = `
.wgd-trace{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:10px;min-height:380px;user-select:none;-webkit-user-select:none;}
.wgd-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}
.wgd-badge{background:#ffffffd9;border-radius:999px;padding:5px 12px;font-weight:800;font-size:14px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.wgd-card{display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;
  background:#fffdf7f2;border:2px solid #f0e3cc;border-radius:16px;padding:6px 14px;
  box-shadow:0 3px 10px rgba(140,110,70,.14);}
.wgd-peek{text-align:center;font-size:17px;font-weight:900;line-height:1.5;min-height:26px;}
.wgd-padwrap{display:flex;justify-content:center;}
.wgd-desk{padding:10px 14px 14px;border-radius:16px;
  background:linear-gradient(#e8bd85,#d9a066 60%,#c98f55);
  box-shadow:inset 0 2px 5px rgba(255,255,255,.35),0 4px 12px rgba(120,90,50,.28);}
.wgd-pad{width:min(72vw,300px);min-width:${MIN_PAD_PX}px;height:auto;touch-action:none;border-radius:12px;
  display:block;box-shadow:0 3px 10px rgba(120,100,70,.25);}
.wgd-fiber{stroke:rgba(190,158,110,.18);stroke-width:.8;fill:none;}
.wgd-grid-edge{stroke:#d94f4f;stroke-width:2;fill:none;}
.wgd-grid-line{stroke:rgba(217,79,79,.35);stroke-width:1;stroke-dasharray:4 4;}
.wgd-ghost{font-size:78px;font-weight:900;fill:rgba(217,79,79,.14);}
.wgd-todo{stroke:rgba(217,79,79,.22);stroke-width:6;stroke-dasharray:7 7;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.wgd-next{stroke:rgba(217,79,79,.55);stroke-width:8;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.wgd-done{opacity:.95;}
.wgd-ink{opacity:.9;}
.wgd-ink-oops line{stroke:#a7abb3;}
.wgd-guide,.wgd-bloomlayer{pointer-events:none;}
.wgd-startdot{fill:#6db3f2;}
.wgd-arrowhead{fill:#6db3f2;stroke:#fff;stroke-width:.7;}
.wgd-arrow-fade{opacity:0;transition:opacity .25s ease-out;}
.wgd-say{border:none;border-radius:999px;background:#ffffffe6;cursor:pointer;font-family:inherit;font-weight:900;
  font-size:16px;padding:10px 22px;min-height:44px;box-shadow:0 3px 0 rgba(120,120,160,.3);}
.wgd-say:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.wgd-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
.wgd-msg{min-height:26px;text-align:center;font-size:15px;font-weight:800;line-height:1.5;}
/* 钳出滚动条那一档：描法提示粘到可视区下沿（W5R3-TA-03） */
.wgd-trace.wgd-scroll .wgd-msg{position:sticky;bottom:0;z-index:3;background:#fffffff2;
  border-radius:12px;padding:3px 8px;box-shadow:0 -2px 8px rgba(120,120,160,.14);}
.wgd-garden{position:relative;border-radius:14px;min-height:44px;max-height:15vh;padding:6px 10px;
  background:linear-gradient(#d7f2b4,#b8e986 55%,#9fd671);
  box-shadow:inset 0 2px 4px rgba(255,255,255,.5),0 2px 8px rgba(110,150,80,.25);}
.wgd-garden[data-stage="soil"]{background:linear-gradient(#efe3c8,#e2cfa8);}
.wgd-garden[data-stage="sprout"]{background:linear-gradient(#e4f0c0,#cfe89e);}
.wgd-garden-row{display:flex;justify-content:flex-start;align-items:center;gap:6px;min-height:34px;flex-wrap:wrap;}
.wgd-garden[data-stage="soil"] .wgd-garden-row::before{content:"写好一个字，这里就开一朵花～";
  font-size:13px;font-weight:800;color:#a08652;}
.wgd-garden[data-stage="sprout"] .wgd-garden-row::after{content:"🌱";font-size:16px;}
.wgd-garden[data-stage="meadow"] .wgd-garden-row::after{content:"🌿";font-size:16px;}
.wgd-garden-flower{border:none;background:none;padding:0;width:34px;height:34px;cursor:pointer;}
.wgd-garden-flower svg{width:100%;height:100%;display:block;filter:drop-shadow(0 1px 1px rgba(110,90,50,.35));}
.wgd-gardencard{position:absolute;right:8px;top:-16px;background:#fffdf7;border:2px solid #ffd93d;
  border-radius:12px;padding:4px 10px;font-size:16px;font-weight:900;color:#5c4a2d;
  box-shadow:0 3px 8px rgba(140,110,60,.25);}
.wgd-pad:focus-visible,.wgd-say:focus-visible,.wgd-garden-flower:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@media (max-width:400px){
  .wgd-pad{width:min(86vw,300px);}
  .wgd-peek{font-size:16px;}
}
@media (prefers-reduced-motion:reduce){
  .wgd-next,.wgd-startdot,.wgd-bloom,.wgd-fall,.wgd-ink-oops{animation:none;}
  .wgd-arrow-fade{transition:none;opacity:1;}
}
@media not (prefers-reduced-motion:reduce){
  .wgd-next{animation:wgdBreathe 1.6s ease-in-out infinite;}
  .wgd-startdot{animation:wgdPulse 1.2s ease-in-out infinite;}
  .wgd-ink-oops{animation:wgdOops .3s ease-out;}
  .wgd-fall{animation:wgdFall .4s ease-out;}
}
@keyframes wgdBreathe{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes wgdPulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes wgdOops{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,0)}60%{transform:translate(2px,1px)}}
@keyframes wgdFall{from{transform:translateY(-46px);opacity:.4}to{transform:translateY(0);opacity:1}}
`;

const NS = "http://www.w3.org/2000/svg";

function polyline(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** 一条理想笔画的毛笔渲染（重采样只为画得顺滑，数据点集原样只读） */
function brushStrokeSvg(points: readonly Point[], name: string, color: string): string {
  const dense = resamplePoints(points, INK_RESAMPLE_STEP);
  return brushSvg(dense, brushWidths(dense, INK_BASE_W, strokeKindOf(name)), color);
}

export interface TraceOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  chars: StrokeChar[];
  theme: QuizTheme;
}

export function runTracing(opts: TraceOptions): PlayHandle {
  const { stage, ctx, chars, theme } = opts;
  const doc = stage.ownerDocument;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let charIdx = 0;
  let done = 0;
  let retries = 0;
  let drawing = false;
  let path: Point[] = [];
  /** 已写成的字数 = 花园里的花数（纯视觉计数，不参与判定） */
  let bloomed = 0;
  /** 预演箭头的 rAF 句柄（destroy 归零） */
  let previewRaf = 0;

  /** 减弱动效：预演 / 展开帧 / 磁吸全停，保留静态引导与花朵结果 */
  const reduced =
    typeof matchMedia === "function" && !!matchMedia("(prefers-reduced-motion: reduce)").matches;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  function settle(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = doc.createElement("div");
  wrap.className = "wgd-trace";
  wrap.style.background = theme.bg;
  wrap.innerHTML = `
    <style>${WGD_CSS}</style>
    <div class="wgd-top">
      <span class="wgd-badge wgd-progress" style="color:${theme.accent}"></span>
      <span class="wgd-badge wgd-count" style="color:#b84708"></span>
    </div>
    <div class="wgd-card">
      <div class="wgd-peek" style="color:${theme.accent}"></div>
      <div class="wgd-row"><button type="button" class="wgd-say" style="color:${theme.accent}" hidden>🔈 读一读</button></div>
    </div>
    <div class="wgd-padwrap">
      <div class="wgd-desk">
        <svg class="wgd-pad" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="米字格描红区"></svg>
      </div>
    </div>
    <div class="wgd-garden" data-stage="soil" aria-label="识字小花园：写过的字都开成花">
      <div class="wgd-garden-row"></div>
      <div class="wgd-gardencard" hidden></div>
    </div>
    <div class="wgd-msg" style="color:${theme.accent}"></div>
  `;
  stage.appendChild(wrap);
  // 描红台是本款第三条入口（答题屏 W5R2-F-A-02、组字工坊 W5R3-A-02 都接过了，这条漏着）。
  // 真机 320×568 / 360×640 第 117 关实测：`.wgd-msg`「田字格里按顺序描一描，描错顺序也没关系～」
  // 45px 高、**0px 可见**，田字格自己也被切掉 18px；这条链上一个能滚的祖先都没有。
  // 那句话是描红的规则说明，看不见就不知道笔顺要按顺序来（W5R3-A-03）。
  //
  // 第 3 轮复测（W5R3-TA-03）：钳位接上了，`.wgd-msg` 却仍旧 **26px 露 0px**——
  // 缺的不是滚动条，是「钳完之后把该看的送进眼里」那一步。本款答题屏与组字工坊早就做了，
  // 描红台漏着。两件事一起补：`fit.ts` 认得 `.wgd-padwrap` 了，钳住时会把田字格送进
  // 「减掉粘住那一行之后的净空间」；这句提示则由 `.wgd-scroll` 那条规则粘到可视区下沿。
  // 为什么不干脆滚到底：滚到底就把顶上「正在描第 N 笔」那行顶出去了，两句都要。
  // `.wgd-pad` 写着 `touch-action:none`，落在格子上的手指只描红、不带着壳一起滚。
  const fit = fitQuizHost(wrap);

  const progressEl = wrap.querySelector(".wgd-progress") as HTMLElement;
  const countEl = wrap.querySelector(".wgd-count") as HTMLElement;
  const peekEl = wrap.querySelector(".wgd-peek") as HTMLElement;
  const pad = wrap.querySelector(".wgd-pad") as SVGSVGElement;
  const gardenEl = wrap.querySelector(".wgd-garden") as HTMLElement;
  const gardenRowEl = wrap.querySelector(".wgd-garden-row") as HTMLElement;
  const gardenCardEl = wrap.querySelector(".wgd-gardencard") as HTMLElement;
  const msgEl = wrap.querySelector(".wgd-msg") as HTMLElement;
  const sayBtn = wrap.querySelector(".wgd-say") as HTMLButtonElement;

  /** 没有中文语音包时按钮一直藏着，做题一点不受影响 */
  const unwatchSpeech = whenSpeechReady(() => {
    sayBtn.hidden = false;
  });
  if (speechReady()) sayBtn.hidden = false;
  sayBtn.addEventListener("click", () => speak(sayLine()));

  function current(): StrokeChar {
    return chars[Math.min(charIdx, chars.length - 1)];
  }

  function sayLine(): string {
    const c = current();
    const names = strokeNames(c.char);
    const at = Math.min(done, names.length - 1);
    return `${c.char}，${c.pinyin}。第 ${at + 1} 笔，${names[at]}。`;
  }

  function el(tag: string, attrs: Record<string, string>): SVGElement {
    const node = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  /** 宣纸米字格（纯字符串，inkArt.ts 出的图层） */
  function drawGrid(): string {
    return paperGridSvg();
  }

  /** 笔顺引导层：呼吸点 + 预演箭头（位置与路径都取自笔顺数据，只读） */
  function guideLayerSvg(c: StrokeChar): string {
    if (done >= c.strokes.length) return `<g class="wgd-guide"></g>`;
    const s = c.strokes[done];
    const [sx, sy] = guideDotAt(s);
    const at = pointAlong(previewPath(s), 0);
    return (
      `<g class="wgd-guide">` +
      `<circle class="wgd-startdot" cx="${sx}" cy="${sy}" r="6" opacity=".8"/>` +
      `<g class="wgd-arrowg" transform="translate(${at.x} ${at.y}) rotate(${at.angle})">` +
      `<polygon class="wgd-arrowhead" points="${ARROW_POINTS}"/>` +
      `</g></g>`
    );
  }

  /** 预演：箭头沿笔顺数据路径走一遍（600ms 缓入缓出）后渐隐；reduced 静止常显 */
  function playPreview(c: StrokeChar): void {
    if (done >= c.strokes.length) return;
    const arrow = pad.querySelector(".wgd-arrowg") as SVGGElement | null;
    if (!arrow) return;
    if (reduced || typeof requestAnimationFrame !== "function") return;
    const pts = previewPath(c.strokes[done]);
    const t0 = Date.now();
    const step = (): void => {
      previewRaf = 0;
      if (destroyed || ended) return;
      const k = Math.min(1, (Date.now() - t0) / PREVIEW_MS);
      const p = pointAlong(pts, easeInOutQuad(k));
      arrow.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${p.angle})`);
      if (k < 1) {
        previewRaf = requestAnimationFrame(step);
      } else {
        arrow.classList.add("wgd-arrow-fade");
      }
    };
    previewRaf = requestAnimationFrame(step);
  }

  /** 花园横条：写过几个字就有几朵花，点一点弹出那个字的小字卡 */
  function renderGarden(withFall: boolean): void {
    const flowers = gardenFlowers(chars, bloomed);
    gardenEl.setAttribute("data-stage", gardenStage(bloomed, chars.length));
    gardenRowEl.innerHTML = flowers
      .map((f, i) => {
        const label = gardenCardLabel(f.char, f.pinyin);
        const fall = withFall && i === flowers.length - 1 && !reduced ? " wgd-fall" : "";
        return (
          `<button type="button" class="wgd-garden-flower${fall}" data-char="${f.char}" data-pinyin="${f.pinyin}"` +
          ` title="${label}" aria-label="花园里的字：${label}">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true">` +
          // W8R1-06：花瓣挂 2 停径向渐变（瓣根深→瓣尖亮），kit 件只读所以在消费端装饰
          shadeFlower(flowerSvg({ cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[f.colorIndex] }), {
            cx: 12, cy: 12, r: 10, petal: FLOWER_TRIO[f.colorIndex], idPrefix: `wgdgf${i}`,
          }) +
          `</svg></button>`
        );
      })
      .join("");
  }

  /** 点按花朵：弹出小字卡（该字 + 拼音），过一会儿自己收起 */
  function onGardenTap(ev: Event): void {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest(".wgd-garden-flower");
    if (!btn) return;
    const char = btn.getAttribute("data-char") ?? "";
    const pinyin = btn.getAttribute("data-pinyin") ?? "";
    if (!char) return;
    gardenCardEl.textContent = gardenCardLabel(char, pinyin);
    gardenCardEl.hidden = false;
    settle(() => {
      gardenCardEl.hidden = true;
    }, 1800);
  }
  gardenEl.addEventListener("click", onGardenTap);

  /** 写成一个字：五瓣花在格子上方展开 5 帧，随后落进花园横条（reduced 一帧直达 + 瞬移落位） */
  function bloomChar(): void {
    if (bloomed !== charIdx) return; // 一个字只开一朵（纯视觉守卫）
    bloomed++;
    const layer = pad.querySelector(".wgd-bloomlayer") as SVGGElement | null;
    const list = gardenFlowers(chars, bloomed);
    const petal = FLOWER_TRIO[list[list.length - 1]?.colorIndex ?? 0];
    const frameSvg = (frame: number): string =>
      // W8R1-06：展开动画的每一帧同样挂花瓣渐变，帧序与几何一字不动
      shadeFlower(flowerSvg({ cx: GRID / 2, cy: 24, r: 13, petal, frame, className: "wgd-bloom" }), {
        cx: GRID / 2, cy: 24, r: 13, petal, idPrefix: "wgdbloom",
      });
    if (reduced || !layer) {
      if (layer) layer.innerHTML = frameSvg(BLOOM_FRAMES.length - 1);
      renderGarden(false);
      return;
    }
    layer.innerHTML = frameSvg(0);
    const stepMs = BLOOM_MS / BLOOM_FRAMES.length;
    for (let f = 1; f < BLOOM_FRAMES.length; f++) {
      later(() => {
        layer.innerHTML = frameSvg(f);
      }, Math.round(f * stepMs));
    }
    later(() => {
      layer.innerHTML = "";
      renderGarden(true);
    }, BLOOM_MS);
  }

  function render(): void {
    const c = current();
    const names = strokeNames(c.char);
    progressEl.textContent = `✍️ 第 ${Math.min(charIdx + 1, chars.length)}/${chars.length} 个字`;
    countEl.textContent = `🌸 ${bloomed} 朵 · 🖌️ ${done}/${c.strokes.length} 笔`;
    // 手指会挡住字，所以正在描哪一笔永远写在最上面
    peekEl.textContent =
      done < c.strokes.length
        ? `${c.char}（${c.pinyin}）· 正在描第 ${done + 1} 笔：${names[done]}`
        : `${c.char}（${c.pinyin}）· ${c.strokes.length} 笔全描完啦`;
    const parts: string[] = [drawGrid()];
    parts.push(
      `<text x="${GRID / 2}" y="${GRID / 2}" text-anchor="middle" dominant-baseline="central" class="wgd-ghost">${c.char}</text>`
    );
    c.strokes.forEach((s, i) => {
      if (i < done) {
        // 已写完：沉稳墨色的毛笔笔迹（渲染层，数据只读）
        parts.push(`<g class="wgd-done">${brushStrokeSvg(s.points, s.name, WG_TOKENS.inkDone)}</g>`);
      } else if (i === done) {
        parts.push(`<polyline points="${polyline(s.points)}" class="wgd-next"/>`);
      } else {
        parts.push(`<polyline points="${polyline(s.points)}" class="wgd-todo"/>`);
      }
    });
    parts.push(guideLayerSvg(c));
    parts.push(`<g class="wgd-bloomlayer"></g>`);
    pad.innerHTML = parts.join("");
    playPreview(c);
    renderGarden(false);
    fit.relayout();
  }

  function padPoint(ev: PointerEvent): Point {
    const box = pad.getBoundingClientRect();
    const w = box.width || 1;
    const h = box.height || 1;
    return [((ev.clientX - box.left) / w) * GRID, ((ev.clientY - box.top) / h) * GRID];
  }

  const inkLine = (): SVGElement | null => pad.querySelector(".wgd-ink");

  /** 当前笔迹的毛笔渲染：读一遍 path 算宽度，判定用的还是同一份 path 原数组 */
  function paintInk(): void {
    const g = inkLine();
    if (!g) return;
    const c = current();
    const name = c.strokes[Math.min(done, c.strokes.length - 1)]?.name ?? "";
    g.innerHTML = brushSvg(path, brushWidths(path, INK_BASE_W, strokeKindOf(name)), WG_TOKENS.inkActive);
  }

  function onDown(ev: PointerEvent): void {
    if (ended || destroyed) return;
    drawing = true;
    path = [padPoint(ev)];
    pad.setPointerCapture?.(ev.pointerId);
    inkLine()?.remove();
    pad.appendChild(el("g", { class: "wgd-ink" }));
    ev.preventDefault();
  }

  function onMove(ev: PointerEvent): void {
    if (!drawing || ended || destroyed) return;
    path.push(padPoint(ev));
    paintInk();
    ev.preventDefault();
  }

  function onUp(ev: PointerEvent): void {
    if (!drawing || ended || destroyed) return;
    drawing = false;
    pad.releasePointerCapture?.(ev.pointerId);
    const drawn = path;
    path = [];
    finishStroke(drawn);
  }

  function finishStroke(drawn: Point[]): void {
    const c = current();
    const verdict = judgeTrace(c.char, done, drawn);
    const ink = inkLine();
    if (verdict.kind !== "right") {
      // 顺序错了 / 描歪了都只是再来一次：不扣分、不判失败、不打叉
      // 笔迹变灰轻抖一下就收走（reduced 只变灰），写错不批评
      retries++;
      ctx.sfx("tap");
      if (ink) {
        ink.setAttribute("class", "wgd-ink wgd-ink-oops");
        later(() => ink.remove(), 300);
      }
      const line = traceHint(verdict, c.char);
      msgEl.textContent = line;
      speak(line);
      return;
    }
    ink?.remove();
    done++;
    ctx.sfx("coin");
    const line = traceHint(verdict, c.char);
    msgEl.textContent = line;
    speak(line);
    render();
    if (done < c.strokes.length) return;
    const doneLine = traceDoneLine(c.char);
    msgEl.textContent = doneLine;
    speak(doneLine);
    bloomChar();
    later(() => {
      charIdx++;
      done = 0;
      if (charIdx >= chars.length) {
        ended = true;
        // 写字这件事上没有「输」：最差也是一颗星，描得顺就是三颗
        const got = rateBelow(retries, 0, chars.length * 2);
        settle(
          () => ctx.win(got, retries === 0 ? "每一笔的顺序都对，字写得真漂亮！" : "全部描完啦，花园又多开了几朵花！"),
          420
        );
        return;
      }
      render();
    }, 900);
  }

  pad.addEventListener("pointerdown", onDown);
  pad.addEventListener("pointermove", onMove);
  pad.addEventListener("pointerup", onUp);
  pad.addEventListener("pointercancel", onUp);

  render();
  msgEl.textContent = TRACE_INTRO;
  speak(TRACE_INTRO);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      drawing = false;
      path = [];
      unwatchSpeech();
      stopSpeaking();
      pad.removeEventListener("pointerdown", onDown);
      pad.removeEventListener("pointermove", onMove);
      pad.removeEventListener("pointerup", onUp);
      pad.removeEventListener("pointercancel", onUp);
      gardenEl.removeEventListener("click", onGardenTap);
      if (previewRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(previewRaf);
      previewRaf = 0;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      fit.dispose();
      wrap.remove();
    },
  };
}
