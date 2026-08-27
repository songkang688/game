/**
 * 识字小花园 1.2：笔顺描红台（纯 2D）。
 *
 * 田字格里摆一个浅灰的大字，下一笔用虚线亮出来、起笔处点一个圆点；
 * 孩子顺着描一道，`strokes.ts` 的纯函数判定这一笔算不算描出来了：
 *  - 描对：这一笔变成实的彩色笔画，旁边开一朵小花；
 *  - 顺序反了：只说「那一笔留到后面写」，**不扣分、不判失败**，随时可以再来；
 *  - 描歪了：提示顺着虚线从圆点起笔。
 * 整关描完必定 `ctx.win`，最差也是一颗星 —— 写字这件事上不该有「输」。
 *
 * 样式一律 `wgd-` 前缀，只往后贴，不动 `qz-` / `l99-` 任何既有规则。
 */
import { rateBelow, type PlayCtx, type PlayHandle } from "../level99";
import type { QuizTheme } from "../quiz99";
import { speak, speechReady, stopSpeaking, whenSpeechReady } from "../speech";
import { fitQuizHost } from "./fit";
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

/** 一笔描完开的小花 */
const FLOWERS = ["🌸", "🌼", "🌺", "🌷", "🌻"];

export const TRACE_INTRO = "田字格里按顺序描一描，描错顺序也没关系，我们再来一次～";

export const WGD_CSS = `
.wgd-trace{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:10px;min-height:380px;user-select:none;-webkit-user-select:none;}
.wgd-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}
.wgd-badge{background:#ffffffd9;border-radius:999px;padding:5px 12px;font-weight:800;font-size:14px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);}
.wgd-peek{text-align:center;font-size:17px;font-weight:900;line-height:1.5;min-height:26px;}
.wgd-padwrap{display:flex;justify-content:center;}
.wgd-pad{width:min(72vw,300px);min-width:${MIN_PAD_PX}px;height:auto;touch-action:none;border-radius:18px;
  background:#fff;box-shadow:0 3px 10px rgba(120,120,160,.2);}
.wgd-grid-line{stroke:#f0c7d8;stroke-width:1;stroke-dasharray:5 5;}
.wgd-grid-edge{stroke:#e6a9c4;stroke-width:2;fill:none;}
.wgd-ghost{font-size:78px;font-weight:900;fill:#efe9f4;}
.wgd-todo{stroke:#c9c2da;stroke-width:6;stroke-dasharray:7 7;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.wgd-next{stroke:#ffb3cd;stroke-width:9;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.wgd-done{stroke-width:9;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.wgd-start{fill:#e64980;}
.wgd-ink{stroke-width:8;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.75;}
.wgd-say{border:none;border-radius:999px;background:#ffffffe6;cursor:pointer;font-family:inherit;font-weight:900;
  font-size:16px;padding:10px 22px;min-height:44px;box-shadow:0 3px 0 rgba(120,120,160,.3);}
.wgd-say:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,120,160,.3);}
.wgd-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
.wgd-msg{min-height:26px;text-align:center;font-size:15px;font-weight:800;line-height:1.5;}
.wgd-flowers{text-align:center;font-size:22px;letter-spacing:2px;min-height:28px;}
.wgd-pad:focus-visible,.wgd-say:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
@media (max-width:400px){
  .wgd-pad{width:min(86vw,300px);}
  .wgd-peek{font-size:16px;}
}
@media (prefers-reduced-motion:reduce){
  .wgd-next{animation:none;}
  .wgd-bloom{animation:none;}
}
@media not (prefers-reduced-motion:reduce){
  .wgd-next{animation:wgdBreathe 1.6s ease-in-out infinite;}
  .wgd-bloom{animation:wgdBloom .45s cubic-bezier(.34,1.56,.64,1);}
}
@keyframes wgdBreathe{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes wgdBloom{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
`;

const NS = "http://www.w3.org/2000/svg";

function polyline(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
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
    <div class="wgd-peek" style="color:${theme.accent}"></div>
    <div class="wgd-padwrap">
      <svg class="wgd-pad" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="田字格描红区"></svg>
    </div>
    <div class="wgd-flowers"></div>
    <div class="wgd-row"><button type="button" class="wgd-say" style="color:${theme.accent}" hidden>🔈 读一读</button></div>
    <div class="wgd-msg" style="color:${theme.accent}"></div>
  `;
  stage.appendChild(wrap);
  // 描红台是本款第三条入口（答题屏 W5R2-F-A-02、组字工坊 W5R3-A-02 都接过了，这条漏着）。
  // 真机 320×568 / 360×640 第 117 关实测：`.wgd-msg`「田字格里按顺序描一描，描错顺序也没关系～」
  // 45px 高、**0px 可见**，田字格自己也被切掉 18px；这条链上一个能滚的祖先都没有。
  // 那句话是描红的规则说明，看不见就不知道笔顺要按顺序来（W5R3-A-03）。
  // 不自动滚：描红是按住画的玩法，替孩子滚屏会把手指底下的田字格挪走；
  // `.wgd-pad` 写着 `touch-action:none`，落在格子上的手指不会带着壳一起滚。
  const fit = fitQuizHost(wrap);

  const progressEl = wrap.querySelector(".wgd-progress") as HTMLElement;
  const countEl = wrap.querySelector(".wgd-count") as HTMLElement;
  const peekEl = wrap.querySelector(".wgd-peek") as HTMLElement;
  const pad = wrap.querySelector(".wgd-pad") as SVGSVGElement;
  const flowersEl = wrap.querySelector(".wgd-flowers") as HTMLElement;
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

  function drawGrid(): void {
    pad.appendChild(el("rect", { x: "2", y: "2", width: `${GRID - 4}`, height: `${GRID - 4}`, rx: "6", class: "wgd-grid-edge" }));
    pad.appendChild(el("line", { x1: "2", y1: `${GRID / 2}`, x2: `${GRID - 2}`, y2: `${GRID / 2}`, class: "wgd-grid-line" }));
    pad.appendChild(el("line", { x1: `${GRID / 2}`, y1: "2", x2: `${GRID / 2}`, y2: `${GRID - 2}`, class: "wgd-grid-line" }));
    pad.appendChild(el("line", { x1: "2", y1: "2", x2: `${GRID - 2}`, y2: `${GRID - 2}`, class: "wgd-grid-line" }));
    pad.appendChild(el("line", { x1: `${GRID - 2}`, y1: "2", x2: "2", y2: `${GRID - 2}`, class: "wgd-grid-line" }));
  }

  function render(): void {
    const c = current();
    const names = strokeNames(c.char);
    progressEl.textContent = `✍️ 第 ${Math.min(charIdx + 1, chars.length)}/${chars.length} 个字`;
    countEl.textContent = `🖌️ ${done}/${c.strokes.length} 笔`;
    // 手指会挡住字，所以正在描哪一笔永远写在最上面
    peekEl.textContent =
      done < c.strokes.length
        ? `${c.char}（${c.pinyin}）· 正在描第 ${done + 1} 笔：${names[done]}`
        : `${c.char}（${c.pinyin}）· ${c.strokes.length} 笔全描完啦`;
    pad.innerHTML = "";
    drawGrid();
    const ghost = el("text", {
      x: `${GRID / 2}`, y: `${GRID / 2}`, "text-anchor": "middle",
      "dominant-baseline": "central", class: "wgd-ghost",
    });
    ghost.textContent = c.char;
    pad.appendChild(ghost);
    c.strokes.forEach((s, i) => {
      if (i < done) {
        pad.appendChild(el("polyline", { points: polyline(s.points), class: "wgd-done", stroke: theme.accent }));
      } else if (i === done) {
        pad.appendChild(el("polyline", { points: polyline(s.points), class: "wgd-next" }));
        pad.appendChild(el("circle", { cx: `${s.points[0][0]}`, cy: `${s.points[0][1]}`, r: "4.5", class: "wgd-start" }));
      } else {
        pad.appendChild(el("polyline", { points: polyline(s.points), class: "wgd-todo" }));
      }
    });
    flowersEl.textContent = Array.from({ length: done }, (_, i) => FLOWERS[i % FLOWERS.length]).join("");
    flowersEl.className = "wgd-flowers wgd-bloom";
    // 换一个字、开一朵花，这一屏都会变高，钳位重算一次
    fit.relayout();
  }

  function padPoint(ev: PointerEvent): Point {
    const box = pad.getBoundingClientRect();
    const w = box.width || 1;
    const h = box.height || 1;
    return [((ev.clientX - box.left) / w) * GRID, ((ev.clientY - box.top) / h) * GRID];
  }

  const inkLine = (): SVGElement | null => pad.querySelector(".wgd-ink");

  function onDown(ev: PointerEvent): void {
    if (ended || destroyed) return;
    drawing = true;
    path = [padPoint(ev)];
    pad.setPointerCapture?.(ev.pointerId);
    inkLine()?.remove();
    pad.appendChild(el("polyline", { points: polyline(path), class: "wgd-ink", stroke: "#ff8fc0" }));
    ev.preventDefault();
  }

  function onMove(ev: PointerEvent): void {
    if (!drawing || ended || destroyed) return;
    path.push(padPoint(ev));
    inkLine()?.setAttribute("points", polyline(path));
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
    inkLine()?.remove();
    if (verdict.kind !== "right") {
      // 顺序错了 / 描歪了都只是再来一次：不扣分、不判失败、不打叉
      retries++;
      ctx.sfx("tap");
      const line = traceHint(verdict, c.char);
      msgEl.textContent = line;
      speak(line);
      render();
      return;
    }
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
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      fit.dispose();
      wrap.remove();
    },
  };
}
