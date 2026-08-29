import { meta } from "./meta";
export { meta };

// 果果合成:连续坐标下的圆形物理堆叠 + 同级相碰合成。
//
// 一颗果子就是一个圆,靠自写的 2D 冲量碰撞往下落、往两边挤;两颗同级的碰在一起
// 先吸合再弹出更大的一颗,连锁会一节一节往上响。已经停稳的果子越过警戒线就结束,
// 刚落下的那一颗有宽限期,不会被冤枉。
//
// 四种玩法共用同一套容器运行时 `createBowl`:
//  - 闯关:188 关八大主题,容器、警戒线、弹性与目标逐章变化(走 level99 框架);
//  - 对战:左右两个容器同一串果子序列,比谁先合成目标级;
//  - 双人同屏:两人各一个容器,朵朵 A/D + F,星星 方向键 + L;
//  - 无尽:全链条开放,记最高分与最大的那颗果。
import { save } from "../../engine/save";
import { stagePlayRoom } from "../../engine/stageRoom";
import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { AI_LABEL, chooseDropX, type AiLevel } from "./ai";
import { SPRITE_PAD, blinkAlpha, createFx, fruitSprite } from "./art";
import GUIDE from "./guide";
import {
  CHAPTERS,
  buildEndless,
  buildLevel,
  buildVersus,
  goalMet,
  goalText,
  type StackLevel,
} from "./levels";
import {
  CHAIN,
  DROP_Y,
  TOP_LEVEL,
  clampDropX,
  dropFruit,
  nextFruit,
  popScale,
  previewFruits,
  pullProgress,
  radiusOf,
  stepMerges,
  tryMerge,
} from "./merge";
import { allSettled, clamp, createWorld, nearLine, overLine, stepPhysics, type World } from "./physics";
import { createRuntime, type Runtime } from "./runtime";

const P_NAME = ["朵朵", "星星"];
const P_EMOJI = ["🌸", "⭐"];

/** 两次投放之间的冷却:防止连点把一整串果子糊在同一个点上 */
const DROP_CD = 460;

/** 键盘一次移动多少像素 */
const KEY_STEP = 9;

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.fs-wrap{--fs-ink:#5a4664;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--fs-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  /* 1.3 手机端修复:壳只留 pan-y——舞台竖着能滚,手指落在壳上得划得动;
     吃拖动手势的果盆 canvas 与按住不放的 ◀ ▶ 键各自挂 touch-action:none */
  touch-action:pan-y;position:relative;width:100%;
  /* B 档 r2 一致性②:粉白壳卡(与 canvas 内天空渐变同族)。侧内衬收敛为 0:
     双盆画布宽取自 host.clientWidth(卡外容器),侧内衬会让双盆行溢出卡外——上下留卡即可 */
  background:linear-gradient(180deg,#FFF4F8,#FBF0FF);border-radius:16px;padding:10px 0;box-sizing:border-box;}
.fs-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.fs-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(150,120,140,.18);}
.fs-chip-goal{color:#a8456a;background:#ffe9f0;}
.fs-chip-p0{color:#a8306a;background:#ffeaf3;}
.fs-chip-p1{color:#28568f;background:#e6f0ff;}
.fs-btn{border:none;border-radius:999px;padding:6px 13px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f08aa8,#d0608a);box-shadow:0 3px 0 #a8496d;}
.fs-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #a8496d;}
.fs-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-btn--ghost{background:linear-gradient(180deg,#a6bfdc,#8099c0);box-shadow:0 3px 0 #667f9f;}
.fs-btn--ghost:active{box-shadow:0 1px 0 #667f9f;}
.fs-bowls{display:flex;justify-content:center;gap:10px;flex-wrap:nowrap;width:100%;}
.fs-bowl{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;}
.fs-bowlname{font-size:14px;font-weight:900;white-space:nowrap;}
.fs-canvaswrap{border-radius:16px;overflow:hidden;line-height:0;background:#fff7fa;
  box-shadow:0 5px 14px rgba(150,120,160,.2);}
.fs-canvaswrap canvas{display:block;touch-action:none;}
.fs-next{display:flex;gap:5px;align-items:center;font-size:14px;font-weight:800;color:#7a6288;}
.fs-basket{display:inline-flex;gap:5px;padding:4px 5px;border-radius:11px;background:linear-gradient(180deg,#e2a968,#c8894a);
  box-shadow:inset 0 0 0 2px #a97140,inset 0 2px 3px rgba(255,235,200,.55),0 2px 5px rgba(130,85,45,.3);}
.fs-basket-cell{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;
  border-radius:8px;background:linear-gradient(180deg,#fffdf6,#fdeede);box-shadow:inset 0 0 0 1px rgba(170,115,65,.35);}
.fs-basket-cell--next{opacity:.55;}
.fs-stamp{display:inline-block;flex:none;}
.fs-result{display:flex;gap:16px;justify-content:center;align-items:flex-end;flex-wrap:wrap;}
.fs-result-slot{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:14px;font-weight:800;color:#7a6288;}
.fs-result-big{display:inline-flex;align-items:center;justify-content:center;width:76px;height:76px;border-radius:50%;
  background:radial-gradient(circle at 50% 42%,#fff6f9,#ffe7f0);box-shadow:0 3px 8px rgba(170,110,150,.25);}
.fs-tree{display:flex;gap:4px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:6px;}
.fs-tree-dot{width:11px;height:11px;border-radius:50%;background:#eadfe8;box-shadow:inset 0 0 0 1.5px rgba(140,105,130,.28);}
.fs-tree-dot--on{box-shadow:inset 0 0 0 1.5px rgba(90,70,90,.35),0 1px 3px rgba(150,100,140,.4);}
.fs-tip{font-size:14px;font-weight:700;line-height:1.55;text-align:center;max-width:620px;color:#6f5f88;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
.fs-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
.fs-key{border:none;border-radius:14px;min-width:56px;height:44px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f5a3bd,#e0759b);box-shadow:0 3px 0 #b8557a;
  touch-action:none;}
.fs-key--p1{background:linear-gradient(180deg,#96bced,#5f8fce);box-shadow:0 3px 0 #46709f;}
.fs-key:active{transform:translateY(2px);}
.fs-key:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-veil{position:absolute;inset:0;background:rgba(255,251,253,.95);border-radius:18px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.fs-veil-t{font-size:20px;font-weight:900;color:#a8456a;}
.fs-veil-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;max-width:340px;}
.fs-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fs-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#fff4f6,#f4f6ff);display:flex;flex-direction:column;gap:8px;}
.fs-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.fs-back{border:none;border-radius:999px;padding:6px 12px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;background:#ffffffdd;color:#a8456a;box-shadow:0 3px 0 rgba(180,100,140,.28);}
.fs-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(180,100,140,.28);}
.fs-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
.fs-bar[hidden],.fs-picks[hidden]{display:none;}
.fs-open{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f08aa8,#d0608a);box-shadow:0 4px 0 #a8496d;}
.fs-open:active{transform:translateY(2px);box-shadow:0 2px 0 #a8496d;}
.fs-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.fs-open--two{background:linear-gradient(180deg,#8f9ae0,#6f79c8);box-shadow:0 4px 0 #57619f;}
.fs-open--en{background:linear-gradient(180deg,#e0a45c,#c4853c);box-shadow:0 4px 0 #9c672c;}
.fs-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.fs-pick{border:none;border-radius:14px;padding:7px 13px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;background:#ffffffe0;color:#6a4f7a;box-shadow:0 3px 0 rgba(160,120,180,.35);}
.fs-pick[aria-pressed="true"]{background:linear-gradient(180deg,#f08aa8,#d0608a);color:#fff;box-shadow:0 3px 0 #a8496d;}
.fs-pick:active{transform:translateY(2px);}
.fs-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
@media (max-width:420px){
  .fs-chip{font-size:14px;padding:3px 8px;}
  .fs-tip{font-size:14px;padding:4px 8px;}
  .fs-bowls{gap:6px;}
  .fs-key{min-width:50px;height:44px;font-size:14px;}
}
/* U-x(#107):501–840 中间档 sticky 兜底,写在前面不抢下面已验收档位 */
@media (max-height:840px) and (min-height:501px){
  .fs-pad{position:sticky;bottom:0;z-index:5;padding-top:4px;
    background:linear-gradient(180deg,rgba(255,247,250,0),#fff7fa 16px);}
}
/* N-107:双人同屏六键 .fs-key 522~566 整排被 .l99-host(overflow:hidden)排线下。
   矮横屏键排 fixed 钉视口底(44px 底线),提示条让位,双盆画布在 layout() 里按实测余量让高。
   合成判定/先赢局数零触碰。 */
@media (max-height:500px) and (min-width:640px){
  .fs-tip{display:none;}
  .fs-wrap{padding-bottom:60px;}
  /* 外层键排整条钉底;每座位的内层 .fs-pad 分组留在流里横排 */
  .fs-wrap>.fs-pad{position:fixed;left:10px;right:10px;bottom:6px;z-index:25;
    background:linear-gradient(180deg,rgba(255,244,248,0),rgba(255,244,248,.92) 10px,#fff4f8);
    padding:4px 2px 2px;border-radius:0 0 14px 14px;}
  .fs-wrap>.fs-pad .fs-pad{position:static;background:none;padding:0;}
}
/* 以下三档是 r21-B 的 sticky 兜底,选择器特异度低于上面的 .fs-wrap>.fs-pad,
   所以 915×412 仍走 N-107 的 fixed 钉底,不会互相打架。 */
@media (max-height:500px){
  .fs-pad{position:sticky;bottom:0;z-index:5;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(255,244,248,.35),#FFF4F8 40%);}
}
/* N-124 模式:768 不命中 500;粗指针中间档钉投放键。玩法/物理零改 */
@media (max-height:820px) and (pointer:coarse){
  .fs-pad{position:sticky;bottom:0;z-index:5;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(255,244,248,.35),#FFF4F8 40%);}
}
/* N-122 模式:390×844 不命中 500/820;竖屏钉投放键,舞台可滚到底 */
@media (max-width:430px) and (min-height:700px){
  .fs-pad{position:sticky;bottom:0;z-index:5;margin-top:4px;padding:8px 0 4px;
    background:linear-gradient(180deg,rgba(255,244,248,.2),#FFF4F8 32%);}
}
@media (prefers-reduced-motion:reduce){
  .fs-btn:active,.fs-key:active,.fs-pick:active{transform:none;}
}
`;

const STYLE_ID = "fs-style";
/** 现在有几处正用着这份样式:进出多少次都只注一份,最后一个走的人负责带走 */
let cssUsers = 0;

/** 注一次样式并占一份引用,返回「这一份用完了」的回调（重复调用无害） */
function acquireCss(host: HTMLElement): () => void {
  cssUsers++;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head ?? host).appendChild(style);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cssUsers = Math.max(0, cssUsers - 1);
    if (cssUsers === 0) document.getElementById(STYLE_ID)?.remove();
  };
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

/**
 * 把果卡贴图盖成一枚 DOM 图章:span + dataURL 背景。
 * 用 span 而不是再造一个 canvas,是因为盆的画布靠 `tagName === "canvas"` 被冒烟脚本点名,
 * 预览与结算不许混进去。测试桩没有 toDataURL 时退化为主色圆点。
 */
function fruitStamp(level: number, sizePx: number, cls = "fs-stamp"): HTMLElement {
  const lvl = clamp(Math.round(level), 0, TOP_LEVEL);
  const kind = CHAIN[lvl];
  const node = el("span", cls);
  node.style.width = `${sizePx}px`;
  node.style.height = `${sizePx}px`;
  node.title = kind.name;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  // 贴图含叶梗留白(SPRITE_PAD),让果身正好塞满图章
  const show = (sizePx / 2 / SPRITE_PAD) * 0.96;
  const sp = fruitSprite(lvl, (show / kind.r) * dpr, "smile");
  const url = typeof sp.canvas.toDataURL === "function" ? sp.canvas.toDataURL() : "";
  if (url) {
    node.style.backgroundImage = `url(${url})`;
    node.style.backgroundSize = "contain";
    node.style.backgroundRepeat = "no-repeat";
    node.style.backgroundPosition = "center";
  } else {
    node.style.background = kind.color;
    node.style.borderRadius = "50%";
  }
  return node;
}

// ---------------------------------------------------------------------------
// 一个容器(盆)
// ---------------------------------------------------------------------------

interface BowlOptions {
  lv: StackLevel;
  seed: number;
  seat: 0 | 1;
  /** 这个盆归电脑操作时的档位 */
  ai: AiLevel | null;
  /** 有没有投放数量上限 */
  limited: boolean;
  sfx: (name: SoundName) => void;
  runtime: Runtime;
  reduced: boolean;
  /** 外面是不是暂停了：暂停期间拖盆、挪落点、投果、归位一概不接 */
  isPaused?: () => boolean;
}

interface Bowl {
  root: HTMLElement;
  world: World;
  readonly done: boolean;
  readonly won: boolean;
  readonly lost: boolean;
  /** 剩余可投数量;无限制时是 Infinity */
  readonly left: number;
  update: (dtMs: number) => void;
  render: () => void;
  layout: (widthPx: number) => void;
  moveAim: (dx: number) => void;
  /** 取消这一次瞄准:落点收回盆正中央 */
  centerAim: () => void;
  requestDrop: () => void;
  aimTo: (clientX: number) => void;
  /** 把这一盆的状态写成读屏文字挂到画布上 */
  describe: (paused: boolean) => void;
  destroy: () => void;
}

function createBowl(host: HTMLElement, opts: BowlOptions): Bowl {
  const lv = opts.lv;
  const world = createWorld({
    box: lv.box,
    lineY: lv.lineY,
    seed: opts.seed,
    tuning: lv.tuning,
    pullMs: opts.reduced ? 55 : 130,
    popMs: opts.reduced ? 35 : 80,
    side: opts.seat,
  });

  const root = el("div", "fs-bowl");
  const name = el("div", "fs-bowlname", `${P_EMOJI[opts.seat]} ${opts.ai ? `电脑 · ${AI_LABEL[opts.ai]}` : P_NAME[opts.seat]}`);
  name.style.color = opts.seat === 0 ? "#a8306a" : "#28568f";
  const wrap = el("div", "fs-canvaswrap");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  wrap.appendChild(canvas);
  const nextRow = el("div", "fs-next");
  root.append(name, wrap, nextRow);
  host.appendChild(root);

  const g = canvas.getContext("2d");
  let scale = 1;
  /** 世界单位 → 设备像素的比例,果卡贴图按它预渲染才不糊 */
  let renderScale = 1;
  let dropIndex = 0;
  let aimX = lv.box.w / 2;
  let cooldown = 0;
  let done = false;
  let won = false;
  let lost = false;
  let warnT = 0;
  // 合并演出(果汁 / 扩散环 / 金星 / 飘字 / 顶级震屏);reduced 时一颗粒子都不出
  const fx = createFx(opts.reduced, opts.seed + opts.seat * 97);

  function currentLevel(): number {
    return nextFruit(opts.seed, dropIndex, lv.maxDrop, lv.minDrop);
  }

  function left(): number {
    return opts.limited ? Math.max(0, lv.drops - world.drops) : Infinity;
  }

  // 果篮窗口:木篮框里两格,左格是当前要投的,右格半透明是再下一颗,用的都是同一套果卡贴图
  function refreshNext(): void {
    nextRow.innerHTML = "";
    nextRow.appendChild(el("span", undefined, "下一个"));
    const basket = el("span", "fs-basket");
    const preview = previewFruits(opts.seed, dropIndex, 2, lv.maxDrop, lv.minDrop);
    preview.forEach((lvl, i) => {
      const cell = el("span", `fs-basket-cell${i === 1 ? " fs-basket-cell--next" : ""}`);
      // 下限 15px:次格再打 0.82 折也不低于 12px,360px 上仍认得出种类
      const size = Math.round(clamp(CHAIN[lvl].r * 0.7, 15, 28) * (i === 0 ? 1 : 0.82));
      cell.appendChild(fruitStamp(lvl, size));
      basket.appendChild(cell);
    });
    nextRow.appendChild(basket);
    if (opts.limited) nextRow.appendChild(el("span", undefined, `· 还剩 ${left()} 颗`));
  }

  function layout(widthPx: number): void {
    const w = Math.max(120, widthPx);
    scale = w / lv.box.w;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(lv.box.w * scale);
    const chh = Math.round(lv.box.h * scale);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${chh}px`;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(chh * dpr);
    renderScale = scale * dpr;
    g?.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }

  function canDrop(): boolean {
    if (opts.isPaused?.()) return false;
    return !done && cooldown <= 0 && left() > 0 && world.merges.length === 0;
  }

  function requestDrop(): void {
    if (!canDrop()) return;
    const lvl = currentLevel();
    dropFruit(world, lvl, clampDropX(lv.box.w, lvl, aimX));
    dropIndex++;
    cooldown = DROP_CD;
    opts.sfx("tap");
    refreshNext();
  }

  function moveAim(dx: number): void {
    if (opts.isPaused?.()) return;
    const lvl = currentLevel();
    aimX = clampDropX(lv.box.w, lvl, aimX + dx);
  }

  /** 取消键:把落点收回盆正中央,不用一路按着 A / D 挪回来 */
  function centerAim(): void {
    if (opts.isPaused?.()) return;
    aimX = clampDropX(lv.box.w, currentLevel(), lv.box.w / 2);
  }

  function aimTo(clientX: number): void {
    if (opts.isPaused?.()) return;
    const box = canvas.getBoundingClientRect();
    const x = (clientX - box.left) / Math.max(1, scale);
    const lvl = currentLevel();
    aimX = clampDropX(lv.box.w, lvl, x);
  }

  // 触屏:在盆上拖动瞄准,松手投下
  let pointerId = -1;
  opts.runtime.on<PointerEvent>(canvas, "pointerdown", (ev) => {
    if (opts.ai || opts.isPaused?.()) return;
    pointerId = ev.pointerId;
    canvas.setPointerCapture?.(ev.pointerId);
    aimTo(ev.clientX);
    ev.preventDefault();
  });
  opts.runtime.on<PointerEvent>(canvas, "pointermove", (ev) => {
    if (ev.pointerId !== pointerId) return;
    aimTo(ev.clientX);
    ev.preventDefault();
  });
  const release = (ev: PointerEvent): void => {
    if (ev.pointerId !== pointerId) return;
    pointerId = -1;
    requestDrop();
  };
  opts.runtime.on<PointerEvent>(canvas, "pointerup", release);
  opts.runtime.on<PointerEvent>(canvas, "pointercancel", (ev) => {
    if (ev.pointerId === pointerId) pointerId = -1;
  });

  // 电脑座位:等场上停稳再想,想好了慢慢把投放点挪过去
  let aiTarget: number | null = null;
  let aiWait = 0;

  function stepAi(dt: number): void {
    if (!opts.ai || done) return;
    aiWait -= dt;
    if (aiTarget === null) {
      if (!allSettled(world) || aiWait > 0) return;
      aiTarget = chooseDropX(world, currentLevel(), opts.ai, dropIndex + opts.seat * 13);
    }
    const gap = aiTarget - aimX;
    const step = Math.min(Math.abs(gap), (dt / 1000) * lv.box.w * 1.6);
    aimX += Math.sign(gap) * step;
    if (Math.abs(gap) <= 1.5 && canDrop()) {
      aimX = aiTarget;
      requestDrop();
      aiTarget = null;
      aiWait = 260;
    }
  }

  function consumeEvents(): void {
    for (const ev of world.events) {
      if (ev.kind === "merge") {
        opts.sfx(ev.level >= 6 ? "coin" : "pop");
        fx.burst(ev.x, ev.y, ev.level, ev.score, false);
      } else if (ev.kind === "top") {
        opts.sfx("win");
        fx.burst(ev.x, ev.y, ev.level, ev.score, true);
      }
    }
    world.events.length = 0;
  }

  function update(dtMs: number): void {
    fx.update(dtMs);
    if (done) return;
    cooldown = Math.max(0, cooldown - dtMs);
    warnT += dtMs;
    stepPhysics(world, dtMs);
    stepMerges(world, dtMs);
    tryMerge(world);
    consumeEvents();
    stepAi(dtMs);

    if (goalMet(lv.goal, world)) {
      done = true;
      won = true;
      return;
    }
    if (overLine(world)) {
      done = true;
      lost = true;
      opts.sfx("oops");
      return;
    }
    if (opts.limited && left() <= 0 && allSettled(world)) {
      done = true;
      lost = true;
    }
  }

  // ---- 画面 ----------------------------------------------------------------

  // 一颗果子 = 一次 drawImage:11 级果卡(纹理 + 脸)都在 art.ts 里预渲染成贴图,
  // 这里只按目标半径缩放贴图;合并动画的 scaleK、担忧脸都走同一条路。
  function drawFruit(x: number, y: number, r: number, level: number, alpha = 1, scaleK = 1, worried = false): void {
    if (!g) return;
    const sp = fruitSprite(level, renderScale, worried ? "worry" : "smile");
    const half = Math.max(1, r * scaleK) * SPRITE_PAD;
    g.globalAlpha = alpha;
    g.drawImage(sp.canvas, x - half, y - half, half * 2, half * 2);
    g.globalAlpha = 1;
  }

  /** 一朵软绵绵的白云:三个椭圆叠一起,当盆上方的中景装饰 */
  function drawCloud(cx: number, cy: number, s: number): void {
    if (!g) return;
    g.fillStyle = "rgba(255,255,255,.6)";
    g.beginPath();
    g.ellipse(cx, cy, s * 2.1, s, 0, 0, Math.PI * 2);
    g.ellipse(cx - s * 1.5, cy + s * 0.35, s * 1.25, s * 0.65, 0, 0, Math.PI * 2);
    g.ellipse(cx + s * 1.5, cy + s * 0.4, s * 1.15, s * 0.6, 0, 0, Math.PI * 2);
    g.fill();
  }

  /** 陶瓷盆沿:6px 厚边最后画在最上层,果子贴墙时看起来是收在盆里的 */
  function drawRim(): void {
    if (!g) return;
    const b = lv.box;
    const RIM = 6;
    const rimGrad = g.createLinearGradient(0, 0, 0, b.h);
    rimGrad.addColorStop(0, "#f8c7da");
    rimGrad.addColorStop(1, "#e19ab8");
    g.fillStyle = rimGrad;
    g.fillRect(0, 0, RIM, b.h);
    g.fillRect(b.w - RIM, 0, RIM, b.h);
    g.fillRect(0, b.h - RIM, b.w, RIM);
    // 盆沿顶面:圆头 + 亮粉高光条
    g.fillStyle = "#ffd9e8";
    g.beginPath();
    g.arc(RIM * 0.9, 4, RIM * 0.75, 0, Math.PI * 2);
    g.arc(b.w - RIM * 0.9, 4, RIM * 0.75, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,240,247,.9)";
    g.fillRect(0, 0, RIM, 3);
    g.fillRect(b.w - RIM, 0, RIM, 3);
    // 内壁描一道薄边,厚度才读得出来
    g.strokeStyle = "rgba(201,120,158,.55)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(RIM, 0);
    g.lineTo(RIM, b.h - RIM);
    g.lineTo(b.w - RIM, b.h - RIM);
    g.lineTo(b.w - RIM, 0);
    g.stroke();
    // 座位色内衬(B 档 #9):盆口两侧内沿各一道 3px 色带(上 60% 高),
    // 与座位条字色同源——双盆同款时余光也认得出哪盆是自己的;纯视觉,碰撞盒不变
    g.fillStyle = opts.seat === 0 ? "#a8306a" : "#28568f";
    g.fillRect(RIM, 0, 3, b.h * 0.6);
    g.fillRect(b.w - RIM - 3, 0, 3, b.h * 0.6);
  }

  function render(): void {
    if (!g) return;
    const b = lv.box;
    g.clearRect(0, 0, b.w, b.h);
    g.save();
    const shake = fx.shakeOffset();
    g.translate(shake.x, shake.y);

    // 盆底背景:粉白渐变保留,顶上加两朵淡云
    const grad = g.createLinearGradient(0, 0, 0, b.h);
    grad.addColorStop(0, "#fffafc");
    grad.addColorStop(1, "#ffeef4");
    g.fillStyle = grad;
    g.fillRect(0, 0, b.w, b.h);
    drawCloud(b.w * 0.24, 24, 7);
    drawCloud(b.w * 0.72, 40, 5.5);

    // 内壁两侧的渐变阴影:盆是有深度的,不是三根线
    const wallW = 10;
    const shadeL = g.createLinearGradient(0, 0, wallW, 0);
    shadeL.addColorStop(0, "rgba(190,120,160,.2)");
    shadeL.addColorStop(1, "rgba(190,120,160,0)");
    g.fillStyle = shadeL;
    g.fillRect(0, 0, wallW, b.h);
    const shadeR = g.createLinearGradient(b.w - wallW, 0, b.w, 0);
    shadeR.addColorStop(0, "rgba(190,120,160,0)");
    shadeR.addColorStop(1, "rgba(190,120,160,.2)");
    g.fillStyle = shadeR;
    g.fillRect(b.w - wallW, 0, wallW, b.h);

    // 盆底内凹弧线:底部一弯浅影
    g.fillStyle = "rgba(214,150,180,.2)";
    g.beginPath();
    g.moveTo(0, b.h);
    g.quadraticCurveTo(b.w / 2, b.h - 15, b.w, b.h);
    g.closePath();
    g.fill();

    // 警戒线:快碰到的时候先闪一闪(reduced 恒定不闪)
    const danger = nearLine(world, lv.lineY, 20);
    const blink = blinkAlpha(warnT, opts.reduced);
    g.strokeStyle = danger ? `rgba(226,86,110,${blink.toFixed(3)})` : "rgba(200,150,175,.75)";
    g.lineWidth = danger ? 3 : 2;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(0, lv.lineY);
    g.lineTo(b.w, lv.lineY);
    g.stroke();
    g.setLineDash([]);
    // 左端小警示灯:红点 + 光晕,危险时跟着呼吸
    const lampA = danger ? blink : 0.5;
    g.fillStyle = `rgba(226,86,110,${(lampA * 0.3).toFixed(3)})`;
    g.beginPath();
    g.arc(11, lv.lineY, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = danger ? `rgba(226,86,110,${lampA.toFixed(3)})` : "rgba(196,140,168,.9)";
    g.beginPath();
    g.arc(11, lv.lineY, 3.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = danger ? "#d2426a" : "#b48aa0";
    g.font = "600 12px system-ui,sans-serif";
    g.textAlign = "left";
    g.textBaseline = "bottom";
    g.fillText("警戒线", 20, lv.lineY - 4);

    // 瞄准线与影子
    if (!done) {
      const lvl = currentLevel();
      const r = radiusOf(lvl);
      const x = clampDropX(b.w, lvl, aimX);
      g.strokeStyle = "rgba(160,120,170,.35)";
      g.lineWidth = 1.5;
      g.setLineDash([4, 6]);
      g.beginPath();
      g.moveTo(x, DROP_Y + r);
      g.lineTo(x, b.h - 2);
      g.stroke();
      g.setLineDash([]);
      let shadowY = b.h - 2;
      for (const f of world.fruits) {
        if (Math.abs(f.x - x) < f.r + r) shadowY = Math.min(shadowY, f.y - f.r);
      }
      g.fillStyle = "rgba(150,110,160,.16)";
      g.beginPath();
      g.ellipse(x, shadowY - 3, r * 0.92, r * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      drawFruit(x, Math.max(DROP_Y, r + 4), r, lvl, 0.85);
    }

    // 堆到警戒线附近时,全体果子换成睁眼担忧脸:警戒反馈做到角色身上
    for (const f of world.fruits) {
      drawFruit(f.x, f.y, f.r, f.level, 1, popScale(f.popMs, world.popMs), danger);
    }

    // 吸合动画:两颗一边靠拢一边缩小
    for (const anim of world.merges) {
      const p = pullProgress(anim);
      const k = 1 - 0.45 * p;
      const r = radiusOf(anim.fromLevel);
      drawFruit(anim.ax + (anim.x - anim.ax) * p, anim.ay + (anim.y - anim.ay) * p, r, anim.fromLevel, 1 - 0.15 * p, k);
      drawFruit(anim.bx + (anim.x - anim.bx) * p, anim.by + (anim.y - anim.by) * p, r, anim.fromLevel, 1 - 0.15 * p, k);
    }

    // 合并演出:果汁 / 扩散环 / 金星 / 飘字
    fx.draw(g);

    // 陶瓷盆沿压最上层
    drawRim();
    g.restore();
  }

  // 画布上的果子读屏读不出来,所以把这一盆的状态写成一句话挂上去;
  // 手动冒烟脚本也靠它读盘面,不用去猜像素。
  let lastLabel = "";
  function describe(paused: boolean): void {
    const who = opts.ai ? "电脑" : P_NAME[opts.seat];
    const big = CHAIN[clamp(world.bestLevel, 0, TOP_LEVEL)].name;
    const rest = opts.limited ? `剩${left()}颗` : "不限";
    const text = `${who}的果盆，${world.score}分，最大「${big}」，盆里${world.fruits.length}颗，${rest}${paused ? "，已暂停" : ""}`;
    canvas.setAttribute("data-aim", aimX.toFixed(1));
    if (text === lastLabel) return;
    lastLabel = text;
    canvas.setAttribute("aria-label", text);
    canvas.setAttribute("data-drops", String(world.drops));
  }

  refreshNext();
  layout(lv.box.w);
  describe(false);
  render();

  return {
    root,
    world,
    get done() {
      return done;
    },
    get won() {
      return won;
    },
    get lost() {
      return lost;
    },
    get left() {
      return left();
    },
    update,
    render,
    layout,
    moveAim,
    centerAim,
    requestDrop,
    aimTo,
    describe,
    destroy() {
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 一桌对局(1 个盆或者 2 个盆)
// ---------------------------------------------------------------------------

export interface TableResult {
  /** 赢的是几号座位;没分出来是 -1 */
  winner: number;
  cleared: boolean;
  score: number;
  bestLevel: number;
  bestChain: number;
  dropsUsed: number;
  reason: "goal" | "over" | "empty";
  /** 每个座位盆里出现过的最高等级(纯展示字段,结算画最大果对比用,不参与判定) */
  bestLevels?: number[];
}

/** 判一局输赢只要知道每一座「达标了没 / 收摊了没 / 还剩几颗」 */
export interface BowlEnd {
  won: boolean;
  lost: boolean;
  left: number;
}

/** 一局的结论：没到收场时机就回 null */
export type RoundVerdict = Pick<TableResult, "winner" | "cleared" | "reason">;

/**
 * 一局到底判给谁。
 *
 * 两座并排的时候按「同一帧同时发生就是平局」处理：原先四个分支挨个问，
 * 两边同帧达标永远算 0 号赢，`roundOver()` 里那句「这一局打平」根本走不到（`R3-PA-FS-3`）。
 * 顺带把「1 号收摊」的口径改成跟着输的那一边走 —— 星星把盆堆爆了不该记成朵朵达标过关。
 */
export function decideRound(bowls: readonly BowlEnd[]): RoundVerdict | null {
  const why = (b: BowlEnd): "over" | "empty" => (b.left <= 0 ? "empty" : "over");
  if (bowls.length === 0) return null;
  if (bowls.length === 1) {
    if (bowls[0].won) return { winner: 0, cleared: true, reason: "goal" };
    if (bowls[0].lost) return { winner: -1, cleared: false, reason: why(bowls[0]) };
    return null;
  }
  const [a, b] = bowls;
  if (a.won && b.won) return { winner: -1, cleared: true, reason: "goal" };
  if (a.won) return { winner: 0, cleared: true, reason: "goal" };
  if (b.won) return { winner: 1, cleared: false, reason: "goal" };
  if (a.lost && b.lost) return { winner: -1, cleared: false, reason: why(a) };
  if (a.lost) return { winner: 1, cleared: false, reason: why(a) };
  if (b.lost) return { winner: 0, cleared: false, reason: why(b) };
  return null;
}

interface TableOptions {
  lv: StackLevel;
  /** 1 = 单盆,2 = 左右两盆 */
  seats: 1 | 2;
  /** 1 号座位交给电脑时的档位 */
  ai: AiLevel | null;
  limited: boolean;
  banner: string;
  tip: string;
  sfx: (name: SoundName) => void;
  onDone: (res: TableResult) => void;
}

interface Table {
  destroy: () => void;
}

function createTable(host: HTMLElement, opts: TableOptions): Table {
  const releaseCss = acquireCss(host);
  const runtime = createRuntime();
  const reduced = prefersReducedMotion();
  const lv = opts.lv;

  const wrap = el("div", "fs-wrap");
  const hud = el("div", "fs-hud");
  const chipBanner = el("span", "fs-chip", opts.banner);
  const chipGoal = el("span", "fs-chip fs-chip-goal", `🎯 ${goalText(lv.goal)}`);
  const chipScore: HTMLElement[] = [];
  for (let i = 0; i < opts.seats; i++) chipScore.push(el("span", `fs-chip fs-chip-p${i}`, ""));
  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "fs-btn fs-btn--ghost";
  pauseBtn.textContent = "⏸ 暂停";
  hud.append(chipBanner, chipGoal, ...chipScore, pauseBtn);

  const bowlRow = el("div", "fs-bowls");
  const tip = el("div", "fs-tip", opts.tip);
  const pad = el("div", "fs-pad");
  wrap.append(hud, bowlRow, tip, pad);
  host.appendChild(wrap);

  // 触屏「◀ ▶」按住不放时每帧再挪一点
  const holdChecks: Array<() => void> = [];

  // 遮罩挡得住手指，挡不住程序：这两个状态得先立起来，果盆自己也要问一句「现在是不是暂停」
  let paused = false;
  let finished = false;

  const bowls: Bowl[] = [];
  for (let i = 0; i < opts.seats; i++) {
    bowls.push(
      createBowl(bowlRow, {
        lv,
        // 对战两边同一串序列,拼的是摆法不是运气
        seed: lv.seed,
        seat: i as 0 | 1,
        ai: i === 1 ? opts.ai : null,
        limited: opts.limited,
        sfx: opts.sfx,
        runtime,
        reduced,
        isPaused: () => paused,
      })
    );
  }

  // 触屏按钮:每个真人座位一组「◀ ▶ 放下」
  for (let i = 0; i < opts.seats; i++) {
    if (i === 1 && opts.ai) continue;
    const seat = i as 0 | 1;
    const group = el("div", "fs-pad");
    const mk = (label: string, onHold: () => void, once = false): HTMLButtonElement => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `fs-key${seat === 1 ? " fs-key--p1" : ""}`;
      btn.textContent = label;
      btn.setAttribute("aria-label", `${P_NAME[seat]}${label}`);
      if (once) {
        runtime.on(btn, "click", () => onHold());
      } else {
        let held = false;
        runtime.on<PointerEvent>(btn, "pointerdown", (ev) => {
          held = true;
          onHold();
          ev.preventDefault();
        });
        const stop = (): void => {
          held = false;
        };
        runtime.on(btn, "pointerup", stop);
        runtime.on(btn, "pointerleave", stop);
        runtime.on(btn, "pointercancel", stop);
        holdChecks.push(() => {
          if (held) onHold();
        });
      }
      group.appendChild(btn);
      return btn;
    };
    mk("◀", () => bowls[seat].moveAim(-KEY_STEP));
    mk("▶", () => bowls[seat].moveAim(KEY_STEP));
    mk("放下", () => bowls[seat].requestDrop(), true);
    pad.appendChild(group);
  }

  // ---- 键盘 ------------------------------------------------------------------
  const held = new Set<string>();
  runtime.on<KeyboardEvent>(window, "keydown", (ev) => {
    if (ev.code === "Escape") {
      ev.preventDefault();
      togglePause();
      return;
    }
    if (!KEY_CODES.has(ev.code)) return;
    ev.preventDefault();
    // 暂停期间除了 Esc 一个键都不接:遮罩盖着的时候果子不该偷偷掉下去
    if (paused || finished) return;
    held.add(ev.code);
    if (ev.code === "KeyF") bowls[0]?.requestDrop();
    if (ev.code === "KeyL" && opts.seats > 1 && !opts.ai) bowls[1]?.requestDrop();
    // 取消键:朵朵 G、星星 K,把落点收回盆正中央(单盆时两个键都归朵朵)
    if (ev.code === "KeyG") bowls[0]?.centerAim();
    if (ev.code === "KeyK") bowls[opts.seats > 1 && !opts.ai ? 1 : 0]?.centerAim();
  });
  runtime.on<KeyboardEvent>(window, "keyup", (ev) => held.delete(ev.code));
  runtime.on(window, "blur", () => held.clear());

  function applyKeys(dt: number): void {
    const step = (dt / 1000) * 320;
    if (held.has("KeyA")) bowls[0]?.moveAim(-step);
    if (held.has("KeyD")) bowls[0]?.moveAim(step);
    if (opts.seats > 1 && !opts.ai) {
      if (held.has("ArrowLeft")) bowls[1]?.moveAim(-step);
      if (held.has("ArrowRight")) bowls[1]?.moveAim(step);
    } else if (opts.seats === 1) {
      // 单盆时方向键也照样能用,免得孩子非得记住是 A / D
      if (held.has("ArrowLeft")) bowls[0]?.moveAim(-step);
      if (held.has("ArrowRight")) bowls[0]?.moveAim(step);
      if (held.has("KeyL")) bowls[0]?.requestDrop();
    }
  }

  // ---- 布局 ------------------------------------------------------------------
  function layout(): void {
    const avail = Math.max(240, Math.min(host.clientWidth || 360, 720));
    const gap = opts.seats > 1 ? 10 : 0;
    const per = (avail - gap) / opts.seats;
    const guessed = Math.max(220, (window.innerHeight || 720) - 300);
    const view = host.closest?.(".l99-view") as HTMLElement | null;
    const viewH = view && view.clientHeight > 0 ? view.clientHeight : 0;
    const vhCap = Math.max(180, (window.innerHeight || 720) - 96);
    const stageH = Math.max(
      180,
      Math.min(stagePlayRoom(host, { w: avail, h: guessed }).h, viewH > 0 ? viewH : vhCap, vhCap),
    );
    const chrome = Math.max(
      92,
      (hud.offsetHeight || 0) + (tip.offsetHeight || 0) + (pad.offsetHeight || 0) + 12,
    );
    let roomH = Math.max(140, stageH - chrome);
    // N-107:矮横屏键排 fixed 钉底(CSS 同名媒体档),果盆显示高按「键排顶 − 果盆顶」的
    // 实测余量重钳,双盆让高、键排不再盖住果堆。物理世界与合成判定一个数不动。
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    if (vh > 0 && vh <= 500 && vw >= 640) {
      const top = Math.round(bowlRow.getBoundingClientRect?.()?.top ?? 0);
      const padBudget = 56;
      if (top > 0) roomH = Math.max(110, Math.min(roomH, vh - padBudget - top - 34));
    }
    const byH = (roomH / lv.box.h) * lv.box.w;
    const widthPx = Math.max(120, Math.min(per, byH));
    for (const b of bowls) b.layout(widthPx);
  }
  layout();
  runtime.on(window, "resize", () => {
    layout();
    for (const b of bowls) b.render();
  });

  // ---- 遮罩 ------------------------------------------------------------------
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>): void {
    clearVeil();
    const box = el("div", "fs-veil");
    box.append(el("div", "fs-veil-t", title), el("div", "fs-veil-s", sub));
    const row = el("div", "fs-veil-btns");
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `fs-btn${b.ghost ? " fs-btn--ghost" : ""}`;
      btn.textContent = b.label;
      runtime.on(btn, "click", () => {
        opts.sfx("tap");
        b.onClick();
      });
      row.appendChild(btn);
    }
    box.appendChild(row);
    wrap.appendChild(box);
    veil = box;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    if (paused) {
      held.clear();
      showVeil("⏸ 歇一会儿", "按 Esc 或点「继续」接着摆。朵朵:A / D 移动,F 放下,G 落点归位;星星:方向键 + L / K;手机直接在盆上拖动,松手就落。", [
        { label: "▶ 继续", onClick: () => togglePause() },
      ]);
    } else {
      clearVeil();
    }
    refreshHud();
  }
  runtime.on(pauseBtn, "click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- HUD -------------------------------------------------------------------
  function refreshHud(): void {
    for (let i = 0; i < bowls.length; i++) {
      const w = bowls[i].world;
      const who = i === 1 && opts.ai ? `电脑` : P_NAME[i];
      const big = CHAIN[clamp(w.bestLevel, 0, TOP_LEVEL)].name;
      chipScore[i].textContent = `${P_EMOJI[i]}${who} ${w.score}分 · 最大「${big}」${
        opts.limited ? ` · 余 ${bowls[i].left}` : ""
      }`;
      bowls[i].describe(paused);
    }
  }

  // ---- 主循环 -----------------------------------------------------------------
  function settle(res: TableResult): void {
    if (finished) return;
    finished = true;
    loop.stop();
    held.clear();
    opts.onDone(res);
  }

  function checkEnd(): void {
    const w0 = bowls[0].world;
    const verdict = decideRound(bowls);
    if (!verdict) return;
    settle({
      ...verdict,
      score: w0.score,
      bestLevel: w0.bestLevel,
      bestChain: w0.bestChain,
      dropsUsed: w0.drops,
      bestLevels: bowls.map((b) => b.world.bestLevel),
    });
  }

  const loop = runtime.loop((dtMs) => {
    const dt = clamp(dtMs, 0, 48);
    if (paused || finished) {
      for (const b of bowls) b.render();
      return;
    }
    for (const check of holdChecks) check();
    applyKeys(dt);
    for (const b of bowls) b.update(dt);
    refreshHud();
    for (const b of bowls) b.render();
    checkEnd();
  });

  refreshHud();
  loop.start();

  return {
    destroy() {
      finished = true;
      clearVeil();
      for (const b of bowls) b.destroy();
      runtime.destroy();
      wrap.remove();
      releaseCss();
    },
  };
}

// 这一款只有左右:朵朵 A / D 移动、F 放下、G 落点归位;星星 方向键 + L / K。
// 上下(W / S 与 ↑ / ↓)在这一款里没有对应动作,攻略里写明了不用记。
const KEY_CODES = new Set(["KeyA", "KeyD", "KeyF", "KeyG", "KeyK", "KeyL", "ArrowLeft", "ArrowRight"]);

// ---------------------------------------------------------------------------
// 文案
// ---------------------------------------------------------------------------

export function winLine(res: TableResult, lv: StackLevel): string {
  if (res.bestChain >= 3) return `${res.bestChain} 连合成!这一手摆得真讲究。`;
  if (res.dropsUsed <= lv.drops * 0.5) return "才用了一半的果子就做到了,眼力很准。";
  return `${goalText(lv.goal)}完成,盆里还留着位置,漂亮。`;
}

export function loseLine(reason: TableResult["reason"], beaten = false): string {
  if (beaten) return "对面先合成出来啦,下一盆早一点把同级的凑到一起。";
  if (reason === "empty") return "果子用完啦,下一次先把两颗一样的凑近一点再放。";
  return "果子堆太高啦,下一次先把小的放低处。";
}

export function endlessLine(score: number, best: number, biggest: number): string {
  const big = CHAIN[clamp(biggest, 0, TOP_LEVEL)].name;
  if (score >= best) return `${score} 分,最大合成到「${big}」,这是你的新纪录!`;
  return `${score} 分,最大合成到「${big}」。最好成绩是 ${best} 分,再来一盆就追上了。`;
}

export function versusLine(scores: number[]): string {
  return `${P_NAME[0]} ${scores[0]} : ${scores[1]} ${P_NAME[1]}`;
}

/** 三星标准:用掉的果子越少星越多 */
export function rateRun(dropsUsed: number, budget: number): 1 | 2 | 3 {
  return rateBelow(dropsUsed, Math.round(budget * 0.5), Math.round(budget * 0.78));
}

// ---------------------------------------------------------------------------
// 闯关(188 关)
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const lv = buildLevel(ctx.level);
  const table = createTable(stage, {
    lv,
    seats: lv.split ? 2 : 1,
    ai: lv.split ? 2 : null,
    limited: true,
    banner: `第 ${ctx.level + 1} 关`,
    tip: lv.hint,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.cleared) ctx.win(rateRun(res.dropsUsed, lv.drops), winLine(res, lv));
      else ctx.lose(loseLine(res.reason, res.winner === 1 && res.reason === "goal"));
    },
  });
  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 模式外壳
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  const releaseCss = acquireCss(host);
  const wrap = el("div", "fs-mode");
  const head = el("div", "fs-mhead");
  const back = document.createElement("button");
  back.type = "button";
  back.className = "fs-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "fs-chip", title);
  head.append(back, chip);
  const stage = el("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return {
    stage,
    chip,
    destroy: () => {
      wrap.remove();
      releaseCss();
    },
  };
}

/**
 * 结算插画:每一盆的最大果画成大号果卡(同一套贴图),下面一条 11 级合成树,
 * 点亮到本局到过的最高级。双人 / 对战给两个格,一眼比出谁的果更大。
 */
export function resultArt(bestLevels: number[], names: string[]): HTMLElement {
  const box = el("div");
  const row = el("div", "fs-result");
  bestLevels.forEach((lvl, i) => {
    const safe = clamp(Math.round(lvl), 0, TOP_LEVEL);
    const kind = CHAIN[safe];
    const slot = el("div", "fs-result-slot");
    const big = el("span", "fs-result-big");
    big.appendChild(fruitStamp(safe, 62));
    slot.appendChild(big);
    slot.appendChild(el("span", undefined, `${names[i] ?? ""}最大「${kind.name}」`));
    row.appendChild(slot);
  });
  box.appendChild(row);
  const top = clamp(Math.round(Math.max(0, ...bestLevels)), 0, TOP_LEVEL);
  const tree = el("div", "fs-tree");
  tree.setAttribute("aria-label", `合成树:${CHAIN.length} 级点亮到第 ${top + 1} 级「${CHAIN[top].name}」`);
  CHAIN.forEach((kind, i) => {
    const dot = el("span", `fs-tree-dot${i <= top ? " fs-tree-dot--on" : ""}`);
    if (i <= top) dot.style.background = kind.color;
    dot.title = kind.name;
    tree.appendChild(dot);
  });
  box.appendChild(tree);
  return box;
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>,
  art?: HTMLElement
): void {
  stage.innerHTML = "";
  const box = el("div", "fs-veil");
  box.style.position = "static";
  box.append(el("div", "fs-veil-t", title));
  if (art) box.appendChild(art);
  box.append(el("div", "fs-veil-s", sub));
  const row = el("div", "fs-veil-btns");
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `fs-btn${b.ghost ? " fs-btn--ghost" : ""}`;
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 对战 / 双人同屏:先赢 3 局
// ---------------------------------------------------------------------------

const WIN_TARGET = 3;

function mountDuel(host: HTMLElement, api: GameApi, onBack: () => void, aiSkill: AiLevel | null): { destroy: () => void } {
  const label = aiSkill ? `🤖 人机对战 · ${AI_LABEL[aiSkill]}` : "👫 双人同屏";
  const shell = makeShell(host, api, onBack, `${label} · 先赢 ${WIN_TARGET} 局`);
  let table: Table | null = null;
  let round = 1;
  const scores = [0, 0];
  /** 最近一局两盆各自的最大果等级(结算插画用) */
  let lastBest: number[] = [0, 0];
  const duelNames = [P_NAME[0], aiSkill ? "电脑" : P_NAME[1]];

  function refreshChip(): void {
    shell.chip.textContent = `${label} · ${versusLine(scores)} · 先赢 ${WIN_TARGET} 局`;
  }

  function finishMatch(winner: number): void {
    table?.destroy();
    table = null;
    api.play("win");
    api.addStars(2);
    overBox(shell.stage, `🏆 ${winner === 1 && aiSkill ? "电脑" : P_NAME[winner]}拿下整场!`, `${versusLine(scores)}。换一盆再来,果子序列会变,摆法也得跟着变。`, [
      {
        label: "🔁 再来一场",
        onClick: () => {
          api.play("tap");
          scores[0] = 0;
          scores[1] = 0;
          round = 1;
          startRound();
        },
      },
      { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
    ], resultArt(lastBest, duelNames));
  }

  function roundOver(winner: number): void {
    table?.destroy();
    table = null;
    if (winner >= 0) scores[winner]++;
    refreshChip();
    if (scores[0] >= WIN_TARGET || scores[1] >= WIN_TARGET) {
      finishMatch(scores[0] >= WIN_TARGET ? 0 : 1);
      return;
    }
    const who = winner < 0 ? "这一局打平" : `${winner === 1 && aiSkill ? "电脑" : P_NAME[winner]}赢下第 ${round} 局`;
    overBox(shell.stage, `🍇 ${who}!`, `${versusLine(scores)}。下一局的盆会窄一点,目标也高一级。`, [
      {
        label: "▶ 下一局",
        onClick: () => {
          api.play("tap");
          round++;
          startRound();
        },
      },
      { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
    ], resultArt(lastBest, duelNames));
  }

  function startRound(): void {
    table?.destroy();
    shell.stage.innerHTML = "";
    refreshChip();
    const lv = buildVersus(round);
    table = createTable(shell.stage, {
      lv,
      seats: 2,
      ai: aiSkill,
      limited: false,
      banner: `第 ${round} 局`,
      tip: aiSkill
        ? `${lv.hint} 朵朵:A / D 移动,F 放下,G 落点归位;手机直接在盆上拖。`
        : `${lv.hint} 朵朵:A / D + F,G 归位;星星:方向键 + L,K 归位。`,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        lastBest = res.bestLevels ?? [res.bestLevel, res.bestLevel];
        roundOver(res.winner);
      },
    });
  }

  startRound();

  return {
    destroy() {
      table?.destroy();
      table = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽果盆");
  let table: Table | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  function start(): void {
    table?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `♾️ 无尽果盆 · 最好 ${best} 分`;
    const lv = buildEndless();
    table = createTable(shell.stage, {
      // 无尽没有关底目标:把目标级抬到链条之上,只有越线才会结束
      lv: { ...lv, goal: { kind: "level", value: TOP_LEVEL + 1 } },
      seats: 1,
      ai: null,
      limited: false,
      banner: "♾️ 无尽",
      tip: lv.hint,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        best = save.recordEndlessBest(meta.id, res.score);
        if (res.score > 0) api.addStars(1);
        table?.destroy();
        table = null;
        overBox(shell.stage, "🍑 盆装满啦", endlessLine(res.score, best, res.bestLevel), [
          { label: "🔁 再来一盆", onClick: () => { api.play("tap"); start(); } },
          { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
        ], resultArt([res.bestLevel], [P_NAME[0]]));
      },
    });
  }

  start();

  return {
    destroy() {
      table?.destroy();
      table = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const releaseCss = acquireCss(api.root);
  const root = el("div");
  const bar = el("div", "fs-bar");
  const picks = el("div", "fs-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let aiSkill: AiLevel = 2;

  const aiBtn = document.createElement("button");
  aiBtn.type = "button";
  aiBtn.className = "fs-open fs-open--ai";
  const twoBtn = document.createElement("button");
  twoBtn.type = "button";
  twoBtn.className = "fs-open fs-open--two";
  twoBtn.textContent = "👫 双人同屏";
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "fs-open fs-open--en";
  bar.append(aiBtn, twoBtn, endlessBtn);

  const pickBtns: HTMLButtonElement[] = [];
  ([1, 2, 3, 4] as AiLevel[]).forEach((skill) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fs-pick";
    btn.textContent = `🤖 ${AI_LABEL[skill]}`;
    btn.setAttribute("aria-label", `电脑难度:${AI_LABEL[skill]}`);
    btn.addEventListener("click", () => {
      api.play("tap");
      aiSkill = skill;
      refreshBar();
    });
    pickBtns.push(btn);
    picks.appendChild(btn);
  });

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽果盆 · 最好 ${best} 分` : "♾️ 无尽果盆";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[aiSkill]}`;
    pickBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i + 1 === aiSkill)));
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    picks.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    picks.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, aiSkill)));
  twoBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, null)));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        picks.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) {
              bar.hidden = false;
              picks.hidden = false;
            }
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "小的放两边、大的放中间,盆里就一直有位置。",
      grandMessage: "188 关全部通关,团圆瓜都被你摆出来了,你就是这盆果子的总管!",
      guideTitle: "果果合成 · 摆果手册",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
      releaseCss();
    },
  };
}
