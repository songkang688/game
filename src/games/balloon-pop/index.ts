import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import { CHAPTERS, LEVELS, mathExprFor, type BalloonLevel } from "./levels";
import {
  CHAIN_MIN,
  ESCAPE_Y,
  aboutToEscape,
  FAR_SCALE,
  FEST_MISS_LIMIT,
  GIFT_RISE_MUL,
  GOAL_LABELS,
  Janitor,
  KINDS,
  SKY_H,
  blastGroup,
  canSpawnGift,
  chainDelays,
  chainGroup,
  chainScore,
  FEST_CHUNK,
  FEST_LOOKAHEAD,
  festExtend,
  festInit,
  festGift,
  festMiss,
  festPlan,
  festPop,
  festRiseSpeed,
  floatAt,
  giftGuarded,
  goalFailure,
  goalReached,
  isTargetBalloon,
  levelGoal,
  rainbowTargets,
  starsFor,
  tapBalloon,
  twinPartner,
  windSign,
  type AirCfg,
  type BalloonKind,
  type ChainNode,
  type FestState,
  type GoalState
} from "./logic";
// 1.3 视觉层:只管「怎么画」,一个玩法数都不带(见 visual.ts 顶部红线)
import {
  BALLOON_COLORS,
  BLP_TIMINGS,
  FAR_BLUR_PX,
  FAR_SWAY_RATIO,
  LABEL_PLATE_ALPHA,
  LABEL_TOP_PCT,
  SKY_DAY,
  SKY_NIGHT,
  STAR_CLIP,
  SWELL_SCALE,
  GIFT_SWAY_DEG,
  TWIN_BUDDY_SCALE,
  balloonKey,
  colorSkin,
  giftBoxSvg,
  ironSkin,
  kindBadgeSvg,
  kindSkin,
  knotColor,
  shardCount,
  shardVectors,
  skyDecorHtml,
  stringSvg,
  timingsCss,
  tokensCss,
  twinRibbonSvg
} from "./visual";
import { touchUpliftCss } from "../../art/kit/uiTouch";

interface Balloon {
  id: number;
  el: HTMLButtonElement;
  /** 出生时的横向百分比与高度 */
  x0: number;
  y0: number;
  born: number;
  phase: number;
  /** 当前位置（每帧算出来的，连锁与命中都读它） */
  x: number;
  y: number;
  kind: BalloonKind;
  color: number;
  num: number;
  /** 已经挨过几下（护盾铁气球要两下） */
  taps: number;
  /** 礼物气球被摇下去的累计像素 */
  push: number;
  /** 远层气球（小一点、分高一点） */
  far: boolean;
  /**
   * 出场时是第几个（气球节专用）。上升速度按它算，不按「现在已经出到第几个」算：
   * 后者会让天上所有气球在每次出新球时整体往上跳一截。
   */
  wave: number;
  gone: boolean;
}

const CSS = `
.blp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; border-radius: 16px; padding: 12px; user-select: none; position: relative; ${tokensCss()} ${timingsCss()} }
.blp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.blp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #C75A82; box-shadow: 0 2px 6px rgba(210,120,160,.25); font-size: 14px; white-space: nowrap; }
.blp-order { border: 2px solid #FFD6E6; background: linear-gradient(180deg, #FFFFFF, #FFF4FA); }
.blp-sky { position: relative; height: ${SKY_H}px; border-radius: 16px; overflow: hidden; }
.blp-balloon { position: absolute; width: 56px; height: 68px; border: none; border-radius: 50% 50% 46% 46%; cursor: pointer; font-size: 22px; font-weight: 900; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.3); padding: 0; background-color: rgba(0,0,0,0); }
.blp-balloon > * { pointer-events: none; }
/* 椭圆光泽条:白 35%、blur 1px、旋 -20°——体积感的第二笔 */
.blp-balloon::before { content: ""; position: absolute; left: 15%; top: 9%; width: 18%; height: 42%; border-radius: 50%; background: rgba(255,255,255,.35); filter: blur(1px); transform: rotate(-20deg); }
.blp-balloon:active { transform: scale(.9); }
/* 气球结:clip-path 三角贴在底缘中点,颜色随主色压暗一档(内联) */
.blp-knot { position: absolute; left: 50%; bottom: -5px; width: 10px; height: 6px; transform: translateX(-50%); clip-path: polygon(50% 0, 100% 100%, 0 100%); }
/* 气球线:内联 SVG 二次贝塞尔垂坠弧(控制点偏移见 visual.stringControlOffsetPx) */
.blp-string { position: absolute; left: 50%; top: 100%; margin-top: 4px; transform: translateX(-50%); overflow: visible; }
.blp-expr { font-size: 15px; letter-spacing: -0.5px; }
/* 数字/算式衬牌:躲开 22% 高度的主高光,白底圆角保可读 */
.blp-tag { position: absolute; left: 50%; top: ${LABEL_TOP_PCT}%; transform: translate(-50%, -50%); background: rgba(255,255,255,${LABEL_PLATE_ALPHA}); border-radius: 8px; padding: 0 5px; color: #A8386A; text-shadow: none; line-height: 1.3; white-space: nowrap; }
/* 特殊球徽记(W6R1-12):与衬牌同一挂点,同样躲开主高光;形状见 visual.kindBadgeSvg */
.blp-kbadge { position: absolute; left: 50%; top: ${LABEL_TOP_PCT}%; transform: translate(-50%, -50%); filter: drop-shadow(0 1px 1px rgba(90,74,60,.22)); }
.blp-shielded { box-shadow: 0 0 0 4px #C9D8E8, 0 0 0 6px rgba(160,190,220,.5); }
.blp-twin { box-shadow: 0 0 0 3px #FFE1F0, 0 0 0 5px rgba(240,150,200,.6); }
.blp-far { filter: saturate(.8) brightness(1.06) blur(${FAR_BLUR_PX}px); }
.blp-gift { box-shadow: 0 0 0 3px #FFF0C4, 0 0 0 6px rgba(230,180,90,.45); }
/* 双子副球:主球 100% + 副球 ${Math.round(TWIN_BUDDY_SCALE * 100)}% 缩放右上相贴,丝带另有 SVG */
.blp-buddy { position: absolute; right: -24%; top: -12%; width: ${TWIN_BUDDY_SCALE * 100}%; height: ${TWIN_BUDDY_SCALE * 100}%; border-radius: 50% 50% 46% 46%; opacity: .95; }
.blp-ribbon { position: absolute; right: -14%; top: -10%; }
/* 礼物气球下挂的小礼盒:挂在气球线末端,常驻 ±${GIFT_SWAY_DEG}° 摆动 */
.blp-giftbox { position: absolute; left: 50%; top: 100%; margin-top: 20px; transform-origin: 50% -20px; transform: translateX(-50%); animation: blpGiftSway var(--blp-gift-sway-ms, 1.1s) ease-in-out infinite alternate; }
.blp-gift-drop { animation: blpGiftDrop var(--blp-gift-drop-ms, .5s) ease-in forwards; }
/* 快飘出画面的气球：虚线圈 + 上挑的小箭头，形状说话，不只靠颜色 */
.blp-leaving { outline: 3px dashed rgba(232,89,12,.85); outline-offset: 2px; }
.blp-leaving::after { content: "⬆"; position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 13px; color: #E8590C; }
/* 爆炸三阶段①:鼓胀 ${SWELL_SCALE} 倍(前 ${BLP_TIMINGS.swellMs}ms)再放大消失 */
.blp-pop { animation: blpPop .22s ease-out forwards; pointer-events: none; }
.blp-shake { animation: blpShake .34s ease; }
@keyframes blpPop { 0% { transform: scale(1); opacity: 1; } ${Math.round((BLP_TIMINGS.swellMs / 220) * 100)}% { transform: scale(${SWELL_SCALE}); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
@keyframes blpShake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
/* 爆炸三阶段②:白闪一帧(step,鼓胀结束时亮起;reduced 也保留) */
.blp-flash { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.95), rgba(255,255,255,0) 70%); pointer-events: none; opacity: 0; animation: blpFlash var(--blp-flash-ms, 16ms) steps(1, end) var(--blp-swell-ms, 60ms) forwards; }
@keyframes blpFlash { from { opacity: 1; } to { opacity: 0; } }
/* 爆炸三阶段③:5 片同色橡皮裂片,月牙形放射旋转渐隐 */
.blp-shard { position: absolute; width: 10px; height: 14px; margin: -7px 0 0 -5px; border-radius: 0 100% 0 100%; background: var(--blp-shard, #F0605F); box-shadow: inset -1px -2px 0 rgba(0,0,0,.14); pointer-events: none; transition: transform var(--blp-shard-ms, 320ms) ease-out var(--blp-swell-ms, 60ms), opacity var(--blp-shard-ms, 320ms) ease-out var(--blp-swell-ms, 60ms); }
.blp-bit { position: absolute; width: 8px; height: 8px; border-radius: 2px; pointer-events: none; }
.blp-bit-star { border-radius: 0; clip-path: ${STAR_CLIP}; }
.blp-bit-dot { border-radius: 50%; }
/* 天空装饰:两层软云 0.1×/0.2× 视差;夜关月亮与星子 */
.blp-decor { position: absolute; inset: 0; pointer-events: none; }
.blp-cloudpuff { position: absolute; border-radius: 50%; background: radial-gradient(ellipse at 50% 55%, var(--blp-cloud), rgba(255,255,255,0) 72%); }
.blp-cloud-a { width: 46%; height: 24%; left: -6%; top: 5%; animation: blpDrift var(--blp-cloud-slow-ms, 52s) linear infinite alternate; }
.blp-cloud-b { width: 34%; height: 18%; right: -4%; top: 26%; animation: blpDrift var(--blp-cloud-fast-ms, 26s) linear infinite alternate-reverse; }
@keyframes blpDrift { from { transform: translateX(-6%); } to { transform: translateX(28%); } }
.blp-moon { position: absolute; right: 7%; top: 9%; width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 35% 32%, #FFFBE6, var(--blp-moon) 55%, #EFD98F); box-shadow: 0 0 18px 4px rgba(255,243,201,.35); }
.blp-starlet { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #FFF7D9; box-shadow: 0 0 6px 1px rgba(255,247,217,.8); }
@keyframes blpGiftSway { from { transform: translateX(-50%) rotate(-${GIFT_SWAY_DEG}deg); } to { transform: translateX(-50%) rotate(${GIFT_SWAY_DEG}deg); } }
@keyframes blpGiftDrop { to { transform: translateX(-50%) translateY(46px) rotate(8deg); opacity: 0; } }
.blp-msg { text-align: center; min-height: 20px; color: #C75A82; font-weight: 700; margin-top: 8px; font-size: 14px; line-height: 1.4; }
.blp-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.blp-bar[hidden] { display: none; }
.blp-open { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #FFD6E6; color: #A8386A; cursor: pointer; box-shadow: 0 3px 0 #F0AFC8; }
.blp-open:active { transform: translateY(2px); box-shadow: 0 1px 0 #F0AFC8; }
.blp-back { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #E7E1FA; color: #5B4B8A; cursor: pointer; min-height: 44px; }
.blp-over { text-align: center; padding: 14px 8px; }
.blp-over h3 { margin: 0 0 6px; font-size: 19px; color: #A8386A; }
.blp-over p { margin: 4px 0; font-size: 14px; color: #6B5B7A; line-height: 1.5; }
.blp-again { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
/* C-8:矮横屏只钳天空的「显示高」,SKY_H=420 的世界常量与上升时间一个字不动。
   气球顶锚定(style.top=y),钳高后可见窗口仍是逃逸线附近那段,大小与修前被视口
   裁出的窗口一致;收益是 HUD/播报/气球全部回到首屏,线下不再有够不着的气球 */
@media (max-height:500px) {
  .blp-wrap { padding: 8px; }
  .blp-top { margin-bottom: 4px; }
  .blp-badge { padding: 3px 8px; }
  .blp-sky { max-height: max(96px, calc(100dvh - 200px)); }
  .l99-stage-wrap .blp-sky { max-height: max(96px, calc(100dvh - 300px)); }
  .blp-msg { margin-top: 4px; }
}
@media (prefers-reduced-motion: reduce) {
  .blp-pop, .blp-shake { animation-duration: .01s; }
  .blp-open:active, .blp-balloon:active { transform: none; }
  /* 摆动、云移、裂片全停;静态渐变体积与白闪保留 */
  .blp-cloudpuff, .blp-giftbox { animation: none; }
  .blp-shard { transition: none; opacity: 0; }
  .blp-gift-drop { animation-duration: .01s; }
}
${touchUpliftCss([".blp-open", ".blp-back"])}
`;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 把气球做成一颗按钮：颜色 + 图案两条通道，色觉不一样的孩子也分得清。
 * 1.3 只换皮：三层渐变体积 + 气球结 + 贝塞尔气球线 + 特殊气球本体差异件；
 * 按钮热区（56×68 与 far 缩放）、aria-label 语义、dataset 镜像一个字不动。
 * （export 只为视觉冒烟测试；游戏加载器仍只用 meta / mount。）
 */
export function paintBalloon(b: Balloon, mode: BalloonLevel["mode"], rand: () => number, windDir = 0): void {
  const node = b.el;
  node.className = "blp-balloon";
  if (b.far) node.classList.add("blp-far");
  const scale = b.far ? FAR_SCALE : 1;
  const special = kindSkin(b.kind);
  let label = "";
  let plate = false;
  // 特殊球身份改挂 12px 白底描边 SVG 徽记(W6R1-12),不再贴系统 emoji
  let badge = "";
  if (special) {
    node.style.background = special;
    badge = kindBadgeSvg(b.kind, b.color, scale);
    if (b.kind === "gift") node.classList.add("blp-gift");
  } else {
    node.style.background =
      b.kind === "iron" ? ironSkin(BALLOON_COLORS[b.color].key, scale) : colorSkin(b.color);
    if (b.kind === "iron") node.classList.add("blp-shielded");
    if (b.kind === "twin") node.classList.add("blp-twin");
    if (mode === "math") {
      node.classList.add("blp-expr");
      label = mathExprFor(b.num, rand);
      plate = true;
    } else if (mode === "number") {
      label = String(b.num);
      plate = true;
    } else if (b.kind === "twin" || b.kind === "iron") {
      badge = kindBadgeSvg(b.kind, b.color, scale);
    }
  }
  node.textContent = "";
  if (label) node.appendChild(el("span", plate ? "blp-tag" : "blp-label", label));
  if (badge) node.insertAdjacentHTML("beforeend", badge);
  const knot = el("span", "blp-knot");
  knot.style.background = knotColor(balloonKey(b.kind, b.color));
  node.appendChild(knot);
  node.insertAdjacentHTML("beforeend", stringSvg(windDir));
  if (b.kind === "twin") {
    const buddy = el("span", "blp-buddy");
    buddy.style.background = colorSkin(b.color);
    node.appendChild(buddy);
    node.insertAdjacentHTML("beforeend", twinRibbonSvg(BALLOON_COLORS[b.color].key, scale));
  }
  if (b.kind === "gift") node.insertAdjacentHTML("beforeend", giftBoxSvg(scale));
  if (b.far) {
    node.style.width = `${Math.round(56 * FAR_SCALE)}px`;
    node.style.height = `${Math.round(68 * FAR_SCALE)}px`;
    node.style.fontSize = "16px";
  }
  node.setAttribute("aria-label", `${BALLOON_COLORS[b.color].name}色${KINDS[b.kind].name}`);
  // dataset 只是给自动冒烟脚本读的状态镜像，不参与玩法
  node.dataset.kind = b.kind;
  node.dataset.num = String(b.num);
  node.dataset.color = String(b.color);
  node.dataset.shield = b.kind === "iron" ? "1" : "0";
}

/**
 * 爆炸三阶段的后两段（鼓胀在 .blp-pop 的关键帧里）：
 * 白闪一帧（reduced 也保留，是「点中了」的功能反馈）→ 5 片同色橡皮裂片
 * 放射抛物线 + 旋转渐隐（reduced 不生成）。总时长见 visual.burstTotalMs() ≤ 400ms。
 */
function burstFx(sky: HTMLElement, x: number, y: number, color: string, reduce: boolean, jan: Janitor): void {
  const flash = el("div", "blp-flash");
  flash.style.left = `${x}px`;
  flash.style.top = `${y}px`;
  sky.appendChild(flash);
  jan.after(BLP_TIMINGS.swellMs + BLP_TIMINGS.flashMs + 60, () => flash.remove());
  const vecs = shardVectors(shardCount(reduce));
  for (const v of vecs) {
    const s = el("div", "blp-shard");
    s.style.setProperty("--blp-shard", color);
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    sky.appendChild(s);
    jan.after(16, () => {
      s.style.transform = `translate(${v.dx}px, ${v.dy}px) rotate(${v.rot}deg)`;
      s.style.opacity = "0";
    });
    jan.after(BLP_TIMINGS.swellMs + BLP_TIMINGS.shardMs + 40, () => s.remove());
  }
}

function confetti(sky: HTMLElement, x: number, y: number, color: string, n: number, jan: Janitor): void {
  for (let i = 0; i < n; i++) {
    // 星星 / 圆点混着撒，比 1.2 的一色方块更像「彩纸 + 星星」
    const bit = el("div", i % 2 === 0 ? "blp-bit blp-bit-star" : "blp-bit blp-bit-dot");
    bit.style.background = color;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    const dx = (Math.random() - 0.5) * 90;
    const dy = (Math.random() - 0.5) * 90 - 20;
    bit.style.transition = "transform .42s ease-out, opacity .42s ease-out";
    sky.appendChild(bit);
    jan.after(16, () => {
      bit.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.round(dx * 4)}deg)`;
      bit.style.opacity = "0";
    });
    jan.after(480, () => bit.remove());
  }
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BalloonLevel = LEVELS[ctx.level];
  const goal = levelGoal(cfg);
  const reduce = reducedMotion();
  const jan = new Janitor();
  const air: AirCfg = { riseSpeed: cfg.riseSpeed, wind: cfg.wind, windFlipMs: cfg.windFlipMs };
  const giftAir: AirCfg = { ...air, riseSpeed: cfg.riseSpeed * GIFT_RISE_MUL };
  // 连锁只在「数量 / 指定颜色」两类目标里放开：按顺序戳的关卡不能被连锁打乱
  const chainOk = cfg.mode === "free" || cfg.mode === "color";

  let raf = 0;
  let lastTime = 0;
  let clock = 0;
  let destroyed = false;
  let ended = false;
  let popped = 0;
  let mistakes = 0;
  let escaped = 0;
  let giftLost = 0;
  let nextId = 1;
  let targetColor = Math.floor(Math.random() * BALLOON_COLORS.length);
  let targetNum = 1;
  let sincePops = 0;
  const balloons: Balloon[] = [];
  const twinOf = new Map<number, number>();

  const wrap = el("div", "blp-wrap");
  wrap.style.background = cfg.night
    ? "linear-gradient(180deg, #3E4578, #7A6BA8)"
    : "linear-gradient(180deg, #DFF1FF, #FFE9F3)";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="blp-top">
      <span class="blp-badge blp-score">🎈 0 / ${cfg.target}</span>
      <span class="blp-badge blp-order"></span>
      ${cfg.wind ? `<span class="blp-badge blp-wind"></span>` : ""}
      <span class="blp-badge blp-life">💗💗💗</span>
    </div>
    <div class="blp-sky" style="background:${cfg.night ? SKY_NIGHT : SKY_DAY}"><div class="blp-decor">${skyDecorHtml(cfg.night)}</div></div>
    <div class="blp-msg"></div>
  `;
  stage.appendChild(wrap);

  const skyEl = wrap.querySelector(".blp-sky") as HTMLElement;
  const scoreEl = wrap.querySelector(".blp-score") as HTMLElement;
  const orderEl = wrap.querySelector(".blp-order") as HTMLElement;
  const windEl = wrap.querySelector(".blp-wind") as HTMLElement | null;
  const lifeEl = wrap.querySelector(".blp-life") as HTMLElement;
  const msgEl = wrap.querySelector(".blp-msg") as HTMLElement;

  msgEl.textContent =
    goal === "protect"
      ? "🎁 天上那个礼物气球千万别让它飞走：轻轻点一下就能把它摇下来一点！"
      : cfg.mode === "math"
        ? "算出气球上的得数，按 1→5 的顺序戳！"
        : cfg.mode === "color"
          ? "看清指令颜色再戳！同色挨在一起还会连爆～"
          : cfg.mode === "number"
            ? "按 1→2→3→4→5 的顺序戳气球！"
            : (cfg.chainChance ?? 0) > 0
              ? "🧨 连锁气球一响，波及身边一片！"
              : (cfg.shieldChance ?? 0) > 0
                ? "🛡️ 护盾铁气球要敲两下才破！"
                : cfg.cloudChance > 0
                  ? "乌云球 ☁️ 是陷阱，手指绕开它！"
                  : "手指守在下半屏，气球一冒头就戳！同色挨在一起会连爆～";

  function state(): GoalState {
    return { popped, target: cfg.target, escaped, escapes: cfg.escapes, mistakes, giftLost };
  }

  function renderTop(): void {
    scoreEl.textContent = `🎈 ${popped} / ${cfg.target}`;
    lifeEl.textContent = "💗".repeat(Math.max(0, 3 - mistakes)) + "🤍".repeat(Math.min(3, mistakes));
    if (goal === "protect") {
      orderEl.textContent = "🎁 护住礼物";
      orderEl.style.color = "#B87A2A";
    } else if (cfg.mode === "color") {
      orderEl.textContent = `🎯 戳${BALLOON_COLORS[targetColor].name}色`;
      orderEl.style.color = BALLOON_COLORS[targetColor].key;
    } else if (cfg.mode === "number") {
      orderEl.textContent = `🎯 下一个：${targetNum}`;
    } else if (cfg.mode === "math") {
      orderEl.textContent = `🧮 戳得数 ${targetNum}`;
    } else {
      orderEl.textContent = `🌤️ 可飘走 ${Math.max(0, cfg.escapes - escaped)}`;
    }
    if (windEl) windEl.textContent = windSignNow() > 0 ? "🌬️ 风 →" : "🌬️ ← 风";
  }

  function windSignNow(): number {
    if (!cfg.wind || !cfg.windFlipMs) return 1;
    return Math.floor((clock * 1000) / cfg.windFlipMs) % 2 === 0 ? 1 : -1;
  }

  function finish(won: boolean, reason?: string): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (won) {
      const got = starsFor(mistakes, escaped, giftLost);
      const brag =
        goal === "protect"
          ? `${cfg.target} 个气球全部拿下，礼物也稳稳护住了！`
          : `${cfg.target} 个气球全部拿下，出手又快又准！`;
      jan.after(350, () => {
        if (!destroyed) ctx.win(got, brag);
      });
    } else {
      jan.after(350, () => {
        if (!destroyed) ctx.lose(reason ?? "这一轮飘走得多了些～优先处理最靠上的那几个，再来一次就稳了！");
      });
    }
  }

  function checkGoal(): void {
    if (ended) return;
    const st = state();
    if (goalReached(goal, st)) {
      finish(true);
      return;
    }
    const why = goalFailure(goal, st);
    if (why) finish(false, why);
  }

  function isTarget(b: Balloon): boolean {
    return isTargetBalloon(cfg, b, targetColor, targetNum);
  }

  function nodes(): ChainNode[] {
    const skyW = Math.max(1, skyEl.clientWidth || 336);
    return balloons
      .filter((b) => !b.gone)
      .map((b) => ({ id: b.id, x: (b.x / 100) * skyW, y: b.y, color: b.color, kind: b.kind }));
  }

  function byId(id: number): Balloon | undefined {
    return balloons.find((b) => b.id === id && !b.gone);
  }

  function removeBalloon(b: Balloon, popAnim: boolean): void {
    if (b.gone) return;
    b.gone = true;
    if (popAnim) {
      b.el.classList.add("blp-pop");
      const skyW = Math.max(1, skyEl.clientWidth || 336);
      const px = (b.x / 100) * skyW;
      burstFx(skyEl, px, b.y, balloonKey(b.kind, b.color), reduce, jan);
      if (b.kind === "gift") b.el.querySelector(".blp-giftbox")?.classList.add("blp-gift-drop");
      if (!reduce) {
        confetti(skyEl, px, b.y, BALLOON_COLORS[b.color].key, 4, jan);
      }
      jan.after(240, () => b.el.remove());
    } else {
      b.el.remove();
    }
  }

  /** 真正打爆一颗（含双子连带），返回它算不算目标 */
  function burstOne(b: Balloon): boolean {
    if (b.gone) return false;
    const counted = isTarget(b);
    removeBalloon(b, true);
    if (counted) popped++;
    const mate = twinPartner(nodes(), b.id, twinOf);
    if (mate !== null) {
      const other = byId(mate);
      if (other) {
        const c2 = isTarget(other);
        removeBalloon(other, true);
        if (c2) popped++;
      }
    }
    return counted;
  }

  /** 同色成片：一条链一颗接一颗地爆，40–60ms 一颗，听得出节奏 */
  function popChain(start: Balloon): void {
    const group = chainOk ? chainGroup(nodes(), start.id) : [start.id];
    if (group.length < CHAIN_MIN) {
      burstOne(start);
      ctx.sfx("pop");
      afterPop();
      return;
    }
    const delays = chainDelays(group.length);
    group.forEach((id, i) => {
      const step = () => {
        const b = byId(id);
        if (!b || ended || destroyed) return;
        burstOne(b);
        ctx.sfx("pop");
        renderTop();
        if (i === group.length - 1) {
          msgEl.textContent = `✨ ${group.length} 连爆！+${chainScore(group.length)} 分手感！`;
          if (group.length >= 5) ctx.bonusStars(1);
          afterPop();
        }
      };
      if (delays[i] === 0) step();
      else jan.after(delays[i], step);
    });
  }

  /** 打爆一颗之后要不要换指令、要不要过关 */
  function afterPop(): void {
    sincePops++;
    if (cfg.mode === "number" || cfg.mode === "math") {
      targetNum = targetNum >= 5 ? 1 : targetNum + 1;
    } else if (cfg.mode === "color" && sincePops >= 4) {
      sincePops = 0;
      let next = Math.floor(Math.random() * BALLOON_COLORS.length);
      if (next === targetColor) next = (next + 1) % BALLOON_COLORS.length;
      targetColor = next;
      msgEl.textContent = `指令换啦：现在戳${BALLOON_COLORS[targetColor].name}色！`;
    }
    renderTop();
    checkGoal();
  }

  function onBalloon(b: Balloon): void {
    if (ended || b.gone) return;

    if (b.kind === "gift") {
      const res = tapBalloon("gift");
      b.push += res.pushDown;
      b.el.classList.remove("blp-shake");
      void b.el.offsetWidth;
      b.el.classList.add("blp-shake");
      ctx.sfx("meow");
      msgEl.textContent = res.hint;
      return;
    }

    if (b.kind === "cloud") {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent = "☁️ 乌云球是陷阱，看清楚再落手！";
      removeBalloon(b, true);
      renderTop();
      checkGoal();
      return;
    }

    if (b.kind === "rainbow") {
      ctx.sfx("coin");
      const res = rainbowTargets(nodes());
      let cleared = 0;
      for (const id of res.ids) {
        const other = byId(id);
        if (!other) continue;
        if (cfg.mode === "free" || isTarget(other)) {
          cleared++;
          popped++;
        }
        removeBalloon(other, true);
      }
      removeBalloon(b, true);
      msgEl.textContent =
        res.color >= 0
          ? `🌈 彩虹一挥，${BALLOON_COLORS[res.color].name}色的气球全砰啦！`
          : "🌈 彩虹一挥，可惜天上没别的气球了～";
      if (cleared >= 4) ctx.bonusStars(1);
      renderTop();
      checkGoal();
      return;
    }

    if (b.kind === "chain") {
      ctx.sfx("coin");
      const hit = blastGroup(nodes(), b.id);
      let counted = 0;
      for (const id of hit) {
        const other = byId(id);
        if (!other) continue;
        if (isTarget(other)) {
          counted++;
          popped++;
        }
        removeBalloon(other, true);
      }
      removeBalloon(b, true);
      msgEl.textContent = counted > 0 ? `🧨 连锁爆炸！一口气炸掉 ${counted} 个！` : "🧨 砰！旁边没有气球，下次挑密集的地方引爆～";
      if (counted >= 4) ctx.bonusStars(1);
      renderTop();
      checkGoal();
      return;
    }

    if (!isTarget(b)) {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent =
        cfg.mode === "color"
          ? `现在要戳${BALLOON_COLORS[targetColor].name}色的！`
          : cfg.mode === "math"
            ? `先算一算，现在要戳得数是 ${targetNum} 的！`
            : `要按顺序，下一个是 ${targetNum}！`;
      renderTop();
      checkGoal();
      return;
    }

    const res = tapBalloon(b.kind, b.taps);
    if (!res.popped) {
      b.taps++;
      b.el.classList.remove("blp-shielded");
      ctx.sfx("tap");
      msgEl.textContent = res.hint;
      return;
    }
    popChain(b);
  }

  function liveGifts(): number {
    return balloons.filter((b) => !b.gone && b.kind === "gift").length;
  }

  function spawn(): void {
    if (ended || destroyed) return;
    const r = Math.random();
    const chainChance = cfg.chainChance ?? 0;
    const giftChance = cfg.giftChance ?? 0;
    const twinChance = cfg.twinChance ?? 0;
    let kind: BalloonKind = "normal";
    if (r < cfg.cloudChance) kind = "cloud";
    else if (r < cfg.cloudChance + cfg.rainbowChance) kind = "rainbow";
    else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance) kind = "chain";
    else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance + giftChance) {
      kind = canSpawnGift(liveGifts()) ? "gift" : "normal";
    } else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance + giftChance + twinChance) kind = "twin";
    else if (Math.random() < (cfg.shieldChance ?? 0)) kind = "iron";

    const make = (color: number, num: number, x: number): Balloon => {
      const node = document.createElement("button");
      node.type = "button";
      const b: Balloon = {
        id: nextId++,
        el: node,
        x0: x,
        y0: SKY_H + 40,
        born: clock,
        phase: Math.random() * Math.PI * 2,
        x,
        y: SKY_H + 40,
        kind,
        color,
        num,
        taps: 0,
        push: 0,
        far: false,
        wave: 0,
        gone: false
      };
      // 气球线的弯向只读既有风向做映射（视觉），风力数值一个不改
      paintBalloon(b, cfg.mode, Math.random, cfg.wind ? windSign(clock, cfg.windFlipMs) : 0);
      node.style.left = `${b.x}%`;
      jan.on(node, "pointerdown", (ev: Event) => {
        ev.preventDefault();
        onBalloon(b);
      });
      skyEl.appendChild(node);
      balloons.push(b);
      return b;
    };

    const color = Math.floor(Math.random() * BALLOON_COLORS.length);
    const num = 1 + Math.floor(Math.random() * 5);
    const x = 8 + Math.random() * 76;
    const first = make(color, num, x);
    if (kind === "twin") {
      // 双子：两颗一起来，绑在一起，戳一个另一个跟着砰
      const second = make(color, num, Math.max(4, Math.min(84, x + (x > 46 ? -18 : 18))));
      twinOf.set(first.id, second.id);
      twinOf.set(second.id, first.id);
    }
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    clock += dt;

    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.gone) {
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        continue;
      }
      const pos = floatAt(
        { x0: b.x0, y0: b.y0 + b.push, born: b.born, phase: b.phase },
        b.kind === "gift" ? giftAir : air,
        clock
      );
      b.x = pos.x;
      b.y = pos.y;
      b.el.style.left = `${b.x}%`;
      b.el.style.top = `${b.y}px`;
      // 远景摆幅只有近景的 60%（纯渲染视差；逻辑位置 b.x/b.y 原样）
      b.el.style.marginLeft = `${pos.swayPx * (b.far ? FAR_SWAY_RATIO : 1)}px`;
      // 快飘出画面的标出来：护礼物、按顺序这些关最吃「先处理最靠上的」
      const rise = (b.kind === "gift" ? giftAir : air).riseSpeed;
      b.el.classList.toggle("blp-leaving", b.kind !== "cloud" && aboutToEscape(b.y, rise));
      if (b.y < ESCAPE_Y) {
        const wasTarget = isTarget(b);
        const wasGift = b.kind === "gift";
        removeBalloon(b, false);
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        if (wasGift) {
          // 只有护礼物那类关卡才记账。别的关卡从没让孩子护过它，
          // 结算时按 giftLost × 2 暗扣星，孩子只会看到「明明一个没漏却只有一星」。
          if (giftGuarded(goal)) {
            giftLost++;
            msgEl.textContent = "🎁 礼物飘走啦……没关系，下次早一点把它摇下来！";
          }
        } else if (wasTarget) {
          escaped++;
        }
        renderTop();
        checkGoal();
        if (ended) return;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  jan.every(cfg.spawnMs, () => spawn());
  if (cfg.wind && cfg.windFlipMs) {
    jan.every(cfg.windFlipMs, () => {
      renderTop();
      msgEl.textContent = windSignNow() > 0 ? "🌀 镜风翻面：往右吹！" : "🌀 镜风翻面：往左吹！";
    });
  }
  spawn();
  renderTop();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      jan.destroy();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「气球节」：密度与速度渐进，漏掉 3 个收工
// ---------------------------------------------------------------------------

function mountFestival(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const jan = new Janitor();
  const reduce = reducedMotion();
  let raf = 0;
  let disposed = false;
  let clock = 0;
  let lastTime = 0;
  let festSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
  let plan = festPlan(festSeed, FEST_CHUNK);
  let planAt = 0;
  let st: FestState = festInit();
  let nextId = 1;
  const balloons: Balloon[] = [];
  const twinOf = new Map<number, number>();

  const wrap = el("div", "blp-wrap");
  wrap.style.background = "linear-gradient(180deg, #FFE9F3, #E6F3FF)";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="blp-top">
      <span class="blp-badge blp-score">💯 0</span>
      <span class="blp-badge blp-combo">🔥 0 连</span>
      <span class="blp-badge blp-miss">🎈 还能漏 ${FEST_MISS_LIMIT}</span>
      <span class="blp-badge blp-best"></span>
    </div>
    <div class="blp-sky" style="background:${SKY_DAY}"><div class="blp-decor">${skyDecorHtml(false)}</div></div>
    <div class="blp-msg">气球节开始啦！戳破升上来的气球，🎁 礼物气球别戳、也别让它跑掉～</div>
    <div class="blp-again"><button class="blp-back" type="button">⬅️ 回到关卡地图</button></div>
  `;
  host.appendChild(wrap);

  const skyEl = wrap.querySelector(".blp-sky") as HTMLElement;
  const scoreEl = wrap.querySelector(".blp-score") as HTMLElement;
  const comboEl = wrap.querySelector(".blp-combo") as HTMLElement;
  const missEl = wrap.querySelector(".blp-miss") as HTMLElement;
  const bestEl = wrap.querySelector(".blp-best") as HTMLElement;
  const msgEl = wrap.querySelector(".blp-msg") as HTMLElement;
  const backBtn = wrap.querySelector(".blp-back") as HTMLButtonElement;

  function refreshTop(): void {
    scoreEl.textContent = `💯 ${st.score}`;
    comboEl.textContent = `🔥 ${st.combo} 连`;
    missEl.textContent = `🎈 还能漏 ${Math.max(0, FEST_MISS_LIMIT - st.missed)}`;
    const best = save.getGameProgress(meta.id).endlessBest;
    bestEl.textContent = best > 0 ? `🏅 最好 ${best}` : "🏅 第一次";
  }

  function nodes(): ChainNode[] {
    const skyW = Math.max(1, skyEl.clientWidth || 336);
    return balloons
      .filter((b) => !b.gone)
      .map((b) => ({ id: b.id, x: (b.x / 100) * skyW, y: b.y, color: b.color, kind: b.kind }));
  }

  function byId(id: number): Balloon | undefined {
    return balloons.find((b) => b.id === id && !b.gone);
  }

  function remove(b: Balloon, anim: boolean): void {
    if (b.gone) return;
    b.gone = true;
    if (anim) {
      b.el.classList.add("blp-pop");
      const skyW = Math.max(1, skyEl.clientWidth || 336);
      const px = (b.x / 100) * skyW;
      burstFx(skyEl, px, b.y, balloonKey(b.kind, b.color), reduce, jan);
      if (b.kind === "gift") b.el.querySelector(".blp-giftbox")?.classList.add("blp-gift-drop");
      if (!reduce) {
        confetti(skyEl, px, b.y, BALLOON_COLORS[b.color].key, 4, jan);
      }
      jan.after(240, () => b.el.remove());
    } else {
      b.el.remove();
    }
  }

  function finish(): void {
    if (disposed) return;
    cancelAnimationFrame(raf);
    api.play("oops");
    let best = st.score;
    try {
      best = save.recordEndlessBest(meta.id, st.score);
    } catch (err) {
      console.warn("[一朵一星] 气球砰砰无尽成绩没记上:", err);
    }
    const box = el("div", "blp-over");
    box.append(
      el("h3", undefined, "🎉 气球节散场啦！"),
      el("p", undefined, `这一场拿到 ${st.score} 分，最长连了 ${st.bestCombo} 个。`),
      el("p", undefined, best > st.score ? `你的最好成绩还是 ${best} 分，再来一场说不定就破了～` : `新纪录！${best} 分，好厉害！`),
      el("p", undefined, "小窍门：同色气球挨在一起时先戳中间那颗，一串都会跟着砰。")
    );
    const again = el("div", "blp-again");
    const againBtn = el("button", "blp-open", "🔁 再来一场");
    const backBtn2 = el("button", "blp-back", "⬅️ 回到关卡地图");
    jan.on(againBtn, "click", () => {
      api.play("tap");
      box.remove();
      reset();
      loop();
    });
    jan.on(backBtn2, "click", () => back());
    again.append(againBtn, backBtn2);
    box.appendChild(again);
    msgEl.after(box);
    refreshTop();
  }

  function burstOne(b: Balloon): number {
    if (b.gone) return 0;
    remove(b, true);
    let n = 1;
    const mate = twinPartner(nodes(), b.id, twinOf);
    if (mate !== null) {
      const other = byId(mate);
      if (other) {
        remove(other, true);
        n++;
      }
    }
    return n;
  }

  function score(kind: BalloonKind, chainLen: number, far: boolean): void {
    st = festPop(st, kind, chainLen, far);
    refreshTop();
  }

  function onBalloon(b: Balloon): void {
    if (disposed || st.over || b.gone) return;
    if (b.kind === "gift") {
      const res = tapBalloon("gift");
      b.push += res.pushDown;
      b.el.classList.remove("blp-shake");
      void b.el.offsetWidth;
      b.el.classList.add("blp-shake");
      st = festGift(st);
      api.play("meow");
      msgEl.textContent = res.hint;
      refreshTop();
      return;
    }
    if (b.kind === "cloud") {
      api.play("oops");
      st = { ...st, combo: 0 };
      msgEl.textContent = "☁️ 乌云球不能戳，连击断了一下，接着来！";
      remove(b, true);
      refreshTop();
      return;
    }
    if (b.kind === "rainbow") {
      api.play("coin");
      const res = rainbowTargets(nodes());
      let n = 0;
      for (const id of res.ids) {
        const other = byId(id);
        if (!other) continue;
        remove(other, true);
        n++;
      }
      remove(b, true);
      score("rainbow", Math.max(1, n), b.far);
      msgEl.textContent = res.color >= 0 ? `🌈 ${BALLOON_COLORS[res.color].name}色的气球全砰啦！` : "🌈 彩虹一挥！";
      return;
    }
    if (b.kind === "chain") {
      api.play("coin");
      const hit = blastGroup(nodes(), b.id);
      let n = 0;
      for (const id of hit) {
        const other = byId(id);
        if (!other) continue;
        remove(other, true);
        n++;
      }
      remove(b, true);
      score("chain", Math.max(1, n), b.far);
      msgEl.textContent = `🧨 连锁炸掉 ${n} 个！`;
      return;
    }
    const res = tapBalloon(b.kind, b.taps);
    if (!res.popped) {
      b.taps++;
      b.el.classList.remove("blp-shielded");
      api.play("tap");
      msgEl.textContent = res.hint;
      return;
    }
    const group = chainGroup(nodes(), b.id);
    if (group.length >= CHAIN_MIN) {
      const delays = chainDelays(group.length);
      let count = 0;
      group.forEach((id, i) => {
        const step = () => {
          const other = byId(id);
          if (!other || disposed || st.over) return;
          count += burstOne(other);
          api.play("pop");
          if (i === group.length - 1) {
            score(b.kind, count, b.far);
            msgEl.textContent = `✨ ${count} 连爆！`;
          }
        };
        if (delays[i] === 0) step();
        else jan.after(delays[i], step);
      });
      return;
    }
    api.play("pop");
    const n = burstOne(b);
    score(b.kind, n, b.far);
  }

  /** 出场表快见底就再续一段——气球节没有「出完」这回事，只有三个漏掉 */
  function topUpPlan(): void {
    if (planAt < plan.length - FEST_LOOKAHEAD) return;
    festSeed = (festSeed * 1664525 + 1013904223) >>> 0;
    plan = plan.concat(festExtend(plan, festSeed, FEST_CHUNK));
  }

  function spawnFromPlan(): void {
    topUpPlan();
    while (planAt < plan.length && plan[planAt].at <= clock) {
      const wave = planAt;
      const p = plan[planAt++];
      const kind = p.kind === "gift" && !canSpawnGift(balloons.filter((b) => !b.gone && b.kind === "gift").length)
        ? "normal"
        : p.kind;
      const make = (x: number): Balloon => {
        const node = document.createElement("button");
        node.type = "button";
        const b: Balloon = {
          id: nextId++,
          el: node,
          x0: x,
          y0: SKY_H + 40,
          born: clock,
          phase: Math.random() * Math.PI * 2,
          x,
          y: SKY_H + 40,
          kind,
          color: p.color,
          num: p.num,
          taps: 0,
          push: 0,
          far: p.far,
          wave,
          gone: false
        };
        paintBalloon(b, "free", Math.random);
        node.style.left = `${x}%`;
        jan.on(node, "pointerdown", (ev: Event) => {
          ev.preventDefault();
          onBalloon(b);
        });
        skyEl.appendChild(node);
        balloons.push(b);
        return b;
      };
      const first = make(p.x);
      if (kind === "twin") {
        const second = make(Math.max(4, Math.min(84, p.x + (p.x > 46 ? -18 : 18))));
        twinOf.set(first.id, second.id);
        twinOf.set(second.id, first.id);
      }
    }
  }

  function tick(now: number): void {
    if (disposed || st.over) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    clock += dt;
    spawnFromPlan();

    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.gone) {
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        continue;
      }
      // 用气球自己的出场波次，不用「现在已经出到第几个」：
      // 后者一变，floatAt 就会拿新速度乘老气球的全部年龄，天上整片球会往上跳一截。
      const rise = festRiseSpeed(b.wave) * (b.far ? 0.78 : 1) * (b.kind === "gift" ? GIFT_RISE_MUL : 1);
      const pos = floatAt({ x0: b.x0, y0: b.y0 + b.push, born: b.born, phase: b.phase }, { riseSpeed: rise }, clock);
      b.x = pos.x;
      b.y = pos.y;
      b.el.style.left = `${b.x}%`;
      b.el.style.top = `${b.y}px`;
      // 远景摆幅只有近景的 60%（纯渲染视差；逻辑位置 b.x/b.y 原样）
      b.el.style.marginLeft = `${pos.swayPx * (b.far ? FAR_SWAY_RATIO : 1)}px`;
      // 快飘出画面的标出来：「先打最靠上的」这句话当场看得见
      b.el.classList.toggle("blp-leaving", b.kind !== "cloud" && aboutToEscape(b.y, rise));
      if (b.y < ESCAPE_Y) {
        const kind = b.kind;
        remove(b, false);
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        if (kind !== "cloud" && kind !== "gift") {
          st = festMiss(st);
          msgEl.textContent = st.over ? "" : "🎈 跑掉一个，稳住节奏，先打最靠上的！";
        }
        refreshTop();
        if (st.over) {
          finish();
          return;
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function reset(): void {
    for (const b of balloons) b.el.remove();
    balloons.length = 0;
    twinOf.clear();
    festSeed = (Date.now() ^ (nextId * 2654435761)) >>> 0;
    plan = festPlan(festSeed, FEST_CHUNK);
    planAt = 0;
    clock = 0;
    st = festInit();
    msgEl.textContent = "气球节又开始啦！同色挨在一起先戳中间那颗～";
    refreshTop();
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  jan.on(backBtn, "click", () => back());
  refreshTop();
  loop();

  return {
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
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
  const bar = el("div", "blp-bar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "blp-open", "♾️ 无尽气球节");
  endlessBtn.type = "button";
  bar.appendChild(endlessBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽气球节 · 最好 ${best} 分` : "♾️ 无尽气球节";
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
    mode = mountFestival(modeHost, api, closeMode);
  };
  endlessBtn.addEventListener("click", onEndless);
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
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
      guide: GUIDE,
      guideTitle: "气球砰砰 · 眼手手册",
      mapHint: `不戳错、不放跑气球，命中率满分就是 3 星！（本关目标：${GOAL_LABELS.count} / ${GOAL_LABELS.color} / ${GOAL_LABELS.order} / ${GOAL_LABELS.protect}）`,
      grandMessage: "188 关气球全部拿下，判断和手速都练到位了！",
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
