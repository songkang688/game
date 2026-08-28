/**
 * 拼音小火车 · 火车舞台（1.3 第 24 步 C 档，纯视觉模块）。
 *
 * 本文件只画画，不判题：天空远山隧道 + 透视双轨 + 站台喇叭 + 一列 SVG 小火车。
 * 每答对一个音节 = 一节车厢从站台滑入挂上列车（220ms + 挂钩「咔」一顿），
 * 车头烟囱喷白烟、车灯亮一下；拼错车厢轻晃不脱钩 + 站牌「再听一遍」；
 * 整轮拼完鸣笛发车驶向隧道 + 站台小人挥手 + 彩纸 16 粒，下一轮新列车进站。
 * 列车本身就是进度条：已挂车厢数 / 目标节数。
 *
 * `prefers-reduced-motion`：滑入 / 白烟 / 发车 / 汽笛圈全停（瞬挂、淡出换车），
 * 三色助记与静态列车原样保留。
 *
 * 玩法侧只拿到 SceneHandle 这几个动词，判定 / 题库 / TTS 接线一概不经过这里。
 */
import {
  TRAIN_COLORS,
  carriage,
  loco,
  railway,
  steamPuff,
  ticketZigzag,
  type CarriageKind,
} from "../../art/kit/train";
import type { PlayCtx } from "../level99";
import { INITIALS, VOWELS } from "./logic";
import { isWholeRead, removeToneMarks } from "./pinyin";

// ---------------------------------------------------------------------------
// 纯函数（不碰 DOM，单测直接调）
// ---------------------------------------------------------------------------

/** 动效时序表（4.3）：全部毫秒 */
export const HOOK_MS = 220;
export const CLACK_MS = 60;
export const STEAM_MS = 500;
export const WOBBLE_MS = 320;
export const DEPART_MS = 600;
export const CONFETTI_MS = 800;
export const IDLE_MS = 1600;
/** 发车彩纸粒数 */
export const CONFETTI_COUNT = 16;
/** 站牌上那句话：拼错只是「再听一遍」，不批评 */
export const SIGN_LINE = "再听一遍";

/**
 * 声韵调三色助记的分类器：只看文字长什么样，不碰题库与判定。
 * 整体认读 → 紫；声母 → 橙；韵母（含戴调号的单韵母）→ 青绿；
 * 认不出的（整音节 / 汉字词）→ 中性灰蓝。
 */
export function classifyToken(text: string): CarriageKind {
  const t = removeToneMarks(String(text ?? "").trim().toLowerCase());
  if (!t) return "plain";
  if (isWholeRead(t)) return "whole";
  if ((INITIALS as readonly string[]).includes(t)) return "initial";
  if ((VOWELS as readonly string[]).includes(t)) return "final";
  return "plain";
}

/**
 * 让「当前待拼（最新挂上）的车厢」滚到滚动口正中：
 * 返回该写的 scrollLeft（夹在 [0, maxScroll] 里；量不出来一律 0，不平白写 DOM）。
 */
export function centerScrollLeft(itemLeft: number, itemWidth: number, viewWidth: number, maxScroll: number): number {
  if (![itemLeft, itemWidth, viewWidth, maxScroll].every((n) => Number.isFinite(n))) return 0;
  if (viewWidth <= 0 || maxScroll <= 0) return 0;
  const want = itemLeft - (viewWidth - itemWidth) / 2;
  return Math.max(0, Math.min(maxScroll, Math.round(want)));
}

/** 这台设备是不是「减弱动效」（量不到 matchMedia 就当不减） */
export function prefersReduced(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return mm ? !!mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 车票样式（三色助记的选项皮肤，供 spell / pickAll / quiz 三处共用）
// ---------------------------------------------------------------------------

const C = TRAIN_COLORS;
const TICKET_CLIP = ticketZigzag(7, 4);

/** 车票的两层背景：左侧圆孔（打孔的暗点）+ 类别色边条 */
function ticketBg(band: string): string {
  // B 档 TOP10（第 1 轮移交）：类别色边条 5px→8px（17–25px），360px 下三色类别更好认；
  // 25px 仍在 padding-left 28/30px 文字起点之内，圆孔（11px±3.5）也碰不到，热区零改动
  return (
    `background-image:radial-gradient(circle 3.5px at 11px 50%,rgba(74,68,96,.28) 3.4px,transparent 3.6px),` +
    `linear-gradient(90deg,transparent 0 17px,${band} 17px 25px,transparent 25px);`
  );
}

/**
 * 车票选项皮肤：锯齿边 + 左侧圆孔 + 类别色边条 + 声调红。
 * 故意**不写** min-height / font-size：热区与字号的下限由各玩法自己的既有规则守着
 * （拼读车厢 CHIP_MIN_PX=48 / PINYIN_FONT_MIN=20，quiz99 选项 64–80px），车票只换皮不缩格。
 * 调号靠 overflow:visible 保证不裁切。
 */
export const TICKET_CSS = `
.pyt-ticket{clip-path:${TICKET_CLIP};background-color:#fffdf6;overflow:visible;
  ${ticketBg(C.railGray)}background-repeat:no-repeat;padding-left:28px;}
.pyt-tk-initial{${ticketBg(C.initialOrange)}}
.pyt-tk-final{${ticketBg(C.finalTeal)}}
.pyt-tk-whole{${ticketBg(C.wholePurple)}}
.pyt-tk-tone{${ticketBg(C.toneRed)}color:${C.toneRed};}
.pyt-tk-plain{${ticketBg(C.railGray)}}
.pyt-tonechar{color:${C.toneRed};font-weight:900;}
.pyt-horn{background:linear-gradient(180deg,#fff7e8,#ffe9c2);
  box-shadow:0 3px 0 rgba(160,107,58,.45),inset 0 0 0 2px rgba(160,107,58,.33);}
`;

/**
 * 答题关（quiz99 渲的 .qz-choice / .qz-say）的车票化覆盖：
 * quiz99 的样式表在 DOM 里排得更靠后，所以这里全部用更高特异度的选择器压过去，
 * 同时留一条 .qz-right 规则把「答对变绿」的原生反馈让回去——反馈永远大于装饰。
 */
export const QUIZ_SKIN_CSS = `
.pyt-quizskin .qz-choice.pyt-ticket{clip-path:${TICKET_CLIP};background-color:#fffdf6;overflow:visible;
  ${ticketBg(C.railGray)}background-repeat:no-repeat;padding-left:30px;border-radius:10px;}
.pyt-quizskin .qz-choice.pyt-ticket.pyt-tk-initial{${ticketBg(C.initialOrange)}}
.pyt-quizskin .qz-choice.pyt-ticket.pyt-tk-final{${ticketBg(C.finalTeal)}}
.pyt-quizskin .qz-choice.pyt-ticket.pyt-tk-whole{${ticketBg(C.wholePurple)}}
.pyt-quizskin .qz-choice.pyt-ticket.pyt-tk-plain{${ticketBg(C.railGray)}}
.pyt-quizskin .qz-choice.pyt-ticket.qz-right{background-color:#E4F9E0;}
.pyt-quizskin .qz-say.pyt-horn{background:linear-gradient(180deg,#fff7e8,#ffe9c2);
  box-shadow:0 3px 0 rgba(160,107,58,.45),inset 0 0 0 2px rgba(160,107,58,.33);}
`;

// ---------------------------------------------------------------------------
// 舞台 CSS（图层序见 4.1：天空远山隧道 → 铁轨 → 站台喇叭 → 列车 → 白烟汽笛 → 彩纸）
// ---------------------------------------------------------------------------

export const SCENE_CSS = `
.pyt-scene{position:relative;height:132px;border-radius:16px;overflow:hidden;flex:none;
  box-shadow:0 3px 10px rgba(120,120,160,.18);}
.pyt-scene-back{position:absolute;inset:0;pointer-events:none;}
.pyt-scene-back svg{display:block;width:100%;height:100%;}
.pyt-scene-count{position:absolute;top:6px;right:8px;z-index:6;background:#ffffffd9;border-radius:999px;
  padding:3px 10px;font-size:12px;font-weight:800;color:#4a4460;box-shadow:0 2px 6px rgba(120,120,160,.25);
  pointer-events:none;}
.pyt-sign{position:absolute;top:8px;left:8px;z-index:6;background:#fffdf6;border:2px solid ${C.sleeperBrown};
  border-radius:10px;padding:4px 10px;font-size:13px;font-weight:900;color:${C.sleeperBrown};
  box-shadow:0 2px 0 ${C.sleeperBrown}66;pointer-events:none;transition:opacity .2s;}
.pyt-sign-hide{opacity:0;}
.pyt-train-scroll{position:absolute;left:0;right:0;bottom:6px;z-index:3;overflow-x:auto;overflow-y:hidden;
  display:flex;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.pyt-train-scroll::-webkit-scrollbar{display:none;}
.pyt-train{display:flex;flex-direction:row-reverse;align-items:flex-end;width:max-content;
  margin-left:auto;padding:0 10px;gap:2px;}
.pyt-train-arrive{animation:pytArrive .45s ease-out;}
.pyt-train-depart{animation:pytDepart ${DEPART_MS}ms ease-in forwards;}
.pyt-train-fadeout{opacity:0;transition:opacity .24s ease-out;}
.pyt-train-shake{animation:pytShake ${WOBBLE_MS}ms ease-out;}
.pyt-loco-wrap{position:relative;flex:none;}
.pyt-loco-art svg{display:block;animation:pytIdle ${IDLE_MS}ms ease-in-out infinite;}
.pyt-lamp-on .kit-train-lamp{animation:pytLamp ${STEAM_MS}ms ease-out;}
.pyt-car{flex:none;width:76px;}
.pyt-car svg{display:block;}
.pyt-car-in{animation:pytCarIn ${HOOK_MS + CLACK_MS}ms ease-out;}
.pyt-flag{flex:none;width:16px;align-self:flex-start;margin-top:26px;}
.pyt-fx{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;}
.pyt-steam{position:absolute;right:24px;bottom:64px;width:34px;height:40px;pointer-events:none;
  animation:pytSteam ${STEAM_MS}ms ease-out forwards;}
.pyt-ring{position:absolute;right:16px;bottom:44px;width:18px;height:18px;border:3px solid #ffd166;
  border-radius:50%;opacity:0;animation:pytRing .6s ease-out;}
.pyt-ring2{animation-delay:.15s;}
.pyt-confetti{position:absolute;top:-8px;width:7px;height:11px;border-radius:2px;
  animation:pytConfetti ${CONFETTI_MS}ms ease-in forwards;}
.pyt-scene-depart .pyt-waver-arm{animation:pytWaveArm .8s ease-in-out;}
.pyt-scene-depart-soft .pyt-waver-arm{transform:rotate(-40deg);}
.pyt-waver-arm{transform-box:fill-box;transform-origin:15% 85%;}
@keyframes pytCarIn{0%{transform:translateX(-46px);opacity:.4}
  79%{transform:translateX(3px);opacity:1}93%{transform:translateX(3px)}100%{transform:translateX(0)}}
@keyframes pytShake{0%,100%{transform:translateX(0)}30%{transform:translateX(-3px)}70%{transform:translateX(3px)}}
@keyframes pytDepart{0%{transform:translateX(0);opacity:1}100%{transform:translateX(130%);opacity:0}}
@keyframes pytArrive{0%{transform:translateX(-52px);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes pytIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}
@keyframes pytLamp{0%{filter:none}30%{filter:drop-shadow(0 0 7px #ffd166) brightness(1.35)}100%{filter:none}}
@keyframes pytSteam{0%{transform:translate(0,0) scale(.55);opacity:.9}
  60%{transform:translate(-8px,-16px) scale(1.05);opacity:.6}
  100%{transform:translate(-4px,-30px) scale(1.5);opacity:0}}
@keyframes pytRing{0%{transform:scale(.4);opacity:.95}100%{transform:scale(2.4);opacity:0}}
@keyframes pytConfetti{0%{transform:translateY(0) rotate(0deg);opacity:1}
  100%{transform:translateY(140px) rotate(300deg);opacity:.15}}
@keyframes pytWaveArm{0%,100%{transform:rotate(0)}25%,75%{transform:rotate(-46deg)}50%{transform:rotate(-18deg)}}
@media (max-width:420px){.pyt-scene{height:118px;}.pyt-car{width:68px;}}
@media (max-height:500px){.pyt-scene{height:72px;}}
@media (prefers-reduced-motion:reduce){
  .pyt-car-in,.pyt-train-shake,.pyt-train-depart,.pyt-train-arrive{animation:none;}
  .pyt-loco-art svg{animation:none;}
  .pyt-lamp-on .kit-train-lamp{animation:none;}
  .pyt-steam,.pyt-ring,.pyt-confetti{animation:none;display:none;}
  .pyt-scene-depart .pyt-waver-arm{animation:none;transform:rotate(-40deg);}
}
`;

/** 站台背景（天空 + 远山 + 云两朵 + 隧道口 + 透视双轨 + 站台一角 + 广播喇叭 + 挥手小人） */
export function backdropSvg(): string {
  const W = 360;
  const H = 132;
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<defs><linearGradient id="pytSky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#cdeefb"/><stop offset="1" stop-color="#f2fbff"/></linearGradient></defs>` +
    // 天空 + 远山
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#pytSky)"/>` +
    `<path class="pyt-mount" d="M0 96 Q60 46 132 92 Q170 66 216 90 L216 ${H} L0 ${H} Z" fill="#b7d9c9"/>` +
    `<path class="pyt-mount" d="M150 98 Q230 40 330 94 L330 ${H} L150 ${H} Z" fill="#9cc8b4"/>` +
    // 云两朵
    `<g class="pyt-cloud" fill="#ffffff" opacity=".9"><ellipse cx="76" cy="26" rx="20" ry="9"/><ellipse cx="94" cy="22" rx="13" ry="7"/></g>` +
    `<g class="pyt-cloud" fill="#ffffff" opacity=".75"><ellipse cx="236" cy="38" rx="16" ry="7"/><ellipse cx="250" cy="34" rx="10" ry="5"/></g>` +
    // 隧道口（灭点）：石拱 + 洞口
    `<g class="pyt-tunnel"><path d="M306 108 L306 66 Q331 40 356 66 L356 108 Z" fill="#8a7a66"/>` +
    `<path d="M312 108 L312 70 Q331 48 350 70 L350 108 Z" fill="#3f3a48"/>` +
    `<path d="M306 66 Q331 40 356 66" fill="none" stroke="#6e6152" stroke-width="4"/></g>` +
    // 铁轨：双线向隧道口收窄，枕木 0.85 等比变密变短
    railway({ width: W, height: H, vanishX: 331, vanishY: 100, sleepers: 10 }) +
    // 站台一角
    `<g class="pyt-platform"><rect x="0" y="104" width="96" height="10" rx="3" fill="#e7d9bf"/>` +
    `<rect x="0" y="112" width="88" height="20" fill="#cfb794"/>` +
    `<rect x="0" y="104" width="96" height="3.4" rx="1.7" fill="#f7ecd7"/></g>` +
    // 广播喇叭（站台立柱 + 大喇叭）
    `<g class="pyt-horn-art"><rect x="10" y="58" width="4" height="48" rx="2" fill="#8a7a66"/>` +
    `<path d="M14 60 L30 52 L30 72 L14 64 Z" fill="#ffd166" stroke="#c69104" stroke-width="1.6"/>` +
    `<circle cx="12" cy="60" r="3.4" fill="#8a7a66"/></g>` +
    // 挥手小人（发车时挥手；reduced 静态挥手帧）
    `<g class="pyt-waver"><circle cx="58" cy="82" r="7" fill="#f2c09a"/>` +
    `<path d="M58 89 Q52 96 53 104 L63 104 Q64 96 58 89 Z" fill="#74c0fc"/>` +
    `<path class="pyt-waver-arm" d="M62 92 Q68 88 71 82" fill="none" stroke="#f2c09a" stroke-width="3.4" stroke-linecap="round"/>` +
    `<circle cx="60.5" cy="80.5" r="1.1" fill="#4a4460"/><path d="M58 84.6 q2 1.6 4 0" fill="none" stroke="#4a4460" stroke-width="1.1" stroke-linecap="round"/></g>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// 舞台本体
// ---------------------------------------------------------------------------

export interface SceneOptions {
  /** 这一轮要挂满几节车厢（列车本身就是进度条） */
  target: number;
  /** 减弱动效（不传就查 matchMedia） */
  reduced?: boolean;
}

export interface SceneHandle {
  el: HTMLElement;
  /** 答对一个音节：一节写着它的车厢滑入挂上（超出目标节数就只亮车灯） */
  hook(syllable: string, kind?: CarriageKind): void;
  /** 拼错：车厢轻晃不脱钩 + 站牌「再听一遍」 */
  wobble(): void;
  /** 整轮拼完：鸣笛发车驶向隧道 + 挥手 + 彩纸，之后新列车进站 */
  depart(): void;
  /** 现在挂着几节车厢 */
  hookedCount(): number;
  destroy(): void;
}

export function buildScene(opts: SceneOptions): SceneHandle {
  const doc = document;
  const target = Math.max(0, Math.floor(opts.target));
  const reduced = opts.reduced ?? prefersReduced();
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let hooked = 0;
  let carSeq = 0;
  let departing = false;
  const cars: HTMLElement[] = [];
  let flagEl: HTMLElement | null = null;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const root = doc.createElement("div");
  root.className = "pyt-scene";
  root.setAttribute("role", "img");

  const style = doc.createElement("style");
  style.textContent = SCENE_CSS;
  root.appendChild(style);

  const back = doc.createElement("div");
  back.className = "pyt-scene-back";
  back.innerHTML = backdropSvg();
  root.appendChild(back);

  const sign = doc.createElement("div");
  sign.className = "pyt-sign pyt-sign-hide";
  sign.textContent = SIGN_LINE;
  root.appendChild(sign);

  const strip = doc.createElement("div");
  strip.className = "pyt-train-scroll";
  const train = doc.createElement("div");
  train.className = "pyt-train";
  // 车头在右（row-reverse 的第一个孩子），车厢向左依次挂
  const locoWrap = doc.createElement("div");
  locoWrap.className = "pyt-loco-wrap";
  const locoArt = doc.createElement("div");
  locoArt.className = "pyt-loco-art";
  locoArt.innerHTML = loco(92, "pytLoco");
  locoWrap.appendChild(locoArt);
  train.appendChild(locoWrap);
  strip.appendChild(train);
  root.appendChild(strip);

  const fx = doc.createElement("div");
  fx.className = "pyt-fx";
  root.appendChild(fx);

  const count = doc.createElement("div");
  count.className = "pyt-scene-count";
  root.appendChild(count);

  function updateCount(): void {
    count.textContent = `🚃 已挂 ${hooked} / ${target} 节`;
    root.setAttribute("data-hooked", String(hooked));
    root.setAttribute("aria-label", `拼音小火车：已挂 ${hooked} / ${target} 节车厢`);
  }
  updateCount();

  function lampBlink(): void {
    locoWrap.classList.add("pyt-lamp-on");
    later(() => locoWrap.classList.remove("pyt-lamp-on"), STEAM_MS + 40);
  }

  function puffSteam(): void {
    if (reduced) return;
    const puff = doc.createElement("div");
    puff.className = "pyt-steam";
    puff.innerHTML = `<svg viewBox="-16 -30 34 40" width="34" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${steamPuff()}</svg>`;
    fx.appendChild(puff);
    later(() => puff.remove(), STEAM_MS + 60);
  }

  function centerNewestCar(car: HTMLElement): void {
    const view = strip.clientWidth ?? 0;
    const max = (strip.scrollWidth ?? 0) - view;
    if (!(view > 0) || !(max > 0)) return;
    const stripRect = strip.getBoundingClientRect?.();
    const carRect = car.getBoundingClientRect?.();
    if (!stripRect || !carRect) return;
    const left = carRect.left - stripRect.left + (strip.scrollLeft || 0);
    strip.scrollLeft = centerScrollLeft(left, carRect.width || 76, view, max);
  }

  function hook(syllable: string, kind?: CarriageKind): void {
    if (destroyed) return;
    lampBlink();
    if (hooked >= target && target > 0) return; // 回顾加练轮只亮灯，不再加车厢
    const car = doc.createElement("div");
    car.className = reduced ? "pyt-car" : "pyt-car pyt-car-in";
    car.setAttribute("data-syll", String(syllable ?? ""));
    car.setAttribute("aria-hidden", "true");
    carSeq++;
    car.innerHTML = carriage(syllable, kind ?? classifyToken(syllable), 76, `pytCar${carSeq}`);
    // row-reverse：追加到末尾 = 挂到列车最左（车尾）
    train.appendChild(car);
    cars.push(car);
    hooked++;
    updateCount();
    puffSteam();
    if (!reduced) later(() => car.classList.remove("pyt-car-in"), HOOK_MS + CLACK_MS + 40);
    centerNewestCar(car);
  }

  function wobble(): void {
    if (destroyed) return;
    // 车厢轻晃 ±3px，不脱钩：车厢一节都不摘
    train.classList.add("pyt-train-shake");
    later(() => train.classList.remove("pyt-train-shake"), WOBBLE_MS + 40);
    sign.classList.remove("pyt-sign-hide");
    later(() => sign.classList.add("pyt-sign-hide"), 1600);
  }

  function resetTrain(): void {
    for (const car of cars.splice(0)) car.remove();
    flagEl?.remove();
    flagEl = null;
    hooked = 0;
    departing = false;
    train.classList.remove("pyt-train-depart", "pyt-train-fadeout");
    root.classList.remove("pyt-scene-depart", "pyt-scene-depart-soft");
    updateCount();
    if (!reduced) {
      train.classList.add("pyt-train-arrive");
      later(() => train.classList.remove("pyt-train-arrive"), 500);
    }
  }

  function depart(): void {
    if (destroyed || departing) return;
    departing = true;
    if (reduced) {
      // 减弱动效：淡出换新列车 + 静态挥手帧
      root.classList.add("pyt-scene-depart-soft");
      train.classList.add("pyt-train-fadeout");
      later(resetTrain, 280);
      return;
    }
    // 鸣笛：汽笛圈两圈
    for (const extra of ["", "pyt-ring2"]) {
      const ring = doc.createElement("div");
      ring.className = extra ? `pyt-ring ${extra}` : "pyt-ring";
      fx.appendChild(ring);
      later(() => ring.remove(), 820);
    }
    lampBlink();
    // 车尾小旗（row-reverse 追加到末尾 = 车尾）
    const flag = doc.createElement("div");
    flag.className = "pyt-flag";
    flag.innerHTML =
      `<svg viewBox="0 0 16 40" width="16" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<line x1="3" y1="4" x2="3" y2="38" stroke="#8a7a66" stroke-width="2"/>` +
      `<path d="M4 5 L15 9 L4 13 Z" fill="${C.toneRed}"/></svg>`;
    train.appendChild(flag);
    flagEl = flag;
    // 站台小人挥手 + 彩纸 16 粒
    root.classList.add("pyt-scene-depart");
    const palette = [C.initialOrange, C.finalTeal, C.wholePurple, "#ffd166"];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const bit = doc.createElement("div");
      bit.className = "pyt-confetti";
      bit.style.left = `${(7 + i * 61) % 100}%`;
      bit.style.background = palette[i % palette.length];
      bit.style.animationDelay = `${(i % 5) * 45}ms`;
      fx.appendChild(bit);
      later(() => bit.remove(), CONFETTI_MS + 260);
    }
    // 发车驶向隧道，之后新列车进站
    train.classList.add("pyt-train-depart");
    later(resetTrain, DEPART_MS + 80);
  }

  return {
    el: root,
    hook,
    wobble,
    depart,
    hookedCount: () => hooked,
    destroy() {
      destroyed = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 答题关（quiz99 渲染，禁改）的纯视觉观察层
// ---------------------------------------------------------------------------

/**
 * 给答题关套一层「只看不改」的 ctx：
 * 公共答题器答对响一声 coin、答错响一声 oops（错题回顾同款回声通道），
 * 听到 coin 就挂一节写着该题答案的车厢，听到 oops 就轻晃 + 站牌；
 * 整关赢下来才发车。所有回调**原样透传**，判定与计分一个字不碰。
 */
export function trainWatchCtx(ctx: PlayCtx, scene: SceneHandle, answers: readonly string[]): PlayCtx {
  let cleared = 0;
  return {
    ...ctx,
    sfx: (name) => {
      if (name === "coin") {
        const syll = answers[cleared];
        if (syll !== undefined) scene.hook(syll, classifyToken(syll));
        cleared++;
      } else if (name === "oops") {
        scene.wobble();
      }
      ctx.sfx(name);
    },
    win: (stars, msg) => {
      scene.depart();
      ctx.win(stars, msg);
    },
  };
}

/**
 * 把 quiz99 渲出来的选项钉上车票三色助记（只加类名，不动文字、不动事件）：
 * 朗读按钮同时钉上「站台广播喇叭」皮肤类。换题时 quiz99 会整排重建按钮，
 * 所以靠 MutationObserver 每次重建后补钉；环境不支持就静默不装（观感降级不炸）。
 */
export function decorateQuizTickets(host: HTMLElement): { dispose: () => void } {
  const apply = (): void => {
    if (typeof host.querySelectorAll !== "function") return;
    host.querySelectorAll(".qz-choice").forEach((el) => {
      if (el.classList.contains("pyt-ticket")) return;
      el.classList.add("pyt-ticket", `pyt-tk-${classifyToken(el.textContent ?? "")}`);
    });
    host.querySelectorAll(".qz-say").forEach((el) => el.classList.add("pyt-horn"));
  };
  apply();
  const view = host.ownerDocument?.defaultView as (Window & { MutationObserver?: typeof MutationObserver }) | null;
  const Obs = view?.MutationObserver;
  const watcher = typeof Obs === "function" ? new Obs(apply) : null;
  watcher?.observe(host, { childList: true, subtree: true });
  return {
    dispose() {
      watcher?.disconnect();
    },
  };
}
