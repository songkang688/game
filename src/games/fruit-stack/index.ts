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
import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { AI_LABEL, chooseDropX, type AiLevel } from "./ai";
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
  touch-action:none;position:relative;width:100%;}
.fs-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.fs-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(150,120,140,.18);}
.fs-chip-goal{color:#a8456a;background:#ffe9f0;}
.fs-chip-p0{color:#a8306a;background:#ffeaf3;}
.fs-chip-p1{color:#28568f;background:#e6f0ff;}
.fs-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f08aa8,#d0608a);box-shadow:0 3px 0 #a8496d;}
.fs-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #a8496d;}
.fs-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-btn--ghost{background:linear-gradient(180deg,#a6bfdc,#8099c0);box-shadow:0 3px 0 #667f9f;}
.fs-btn--ghost:active{box-shadow:0 1px 0 #667f9f;}
.fs-bowls{display:flex;justify-content:center;gap:10px;flex-wrap:nowrap;width:100%;}
.fs-bowl{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;}
.fs-bowlname{font-size:12.5px;font-weight:900;white-space:nowrap;}
.fs-canvaswrap{border-radius:16px;overflow:hidden;line-height:0;background:#fff7fa;
  box-shadow:0 5px 14px rgba(150,120,160,.2);}
.fs-canvaswrap canvas{display:block;touch-action:none;}
.fs-next{display:flex;gap:5px;align-items:center;font-size:12.5px;font-weight:800;color:#7a6288;}
.fs-dot{display:inline-block;border-radius:50%;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(120,90,140,.3);}
.fs-tip{font-size:13px;font-weight:700;line-height:1.55;text-align:center;max-width:620px;color:#6f5f88;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
.fs-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
.fs-key{border:none;border-radius:14px;min-width:56px;height:44px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f5a3bd,#e0759b);box-shadow:0 3px 0 #b8557a;}
.fs-key--p1{background:linear-gradient(180deg,#96bced,#5f8fce);box-shadow:0 3px 0 #46709f;}
.fs-key:active{transform:translateY(2px);}
.fs-key:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-veil{position:absolute;inset:0;background:rgba(255,251,253,.95);border-radius:18px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.fs-veil-t{font-size:20px;font-weight:900;color:#a8456a;}
.fs-veil-s{font-size:13.5px;font-weight:700;color:#6f6390;line-height:1.6;max-width:340px;}
.fs-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fs-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#fff4f6,#f4f6ff);display:flex;flex-direction:column;gap:8px;}
.fs-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.fs-back{border:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#a8456a;box-shadow:0 3px 0 rgba(180,100,140,.28);}
.fs-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(180,100,140,.28);}
.fs-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
.fs-bar[hidden],.fs-picks[hidden]{display:none;}
.fs-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f08aa8,#d0608a);box-shadow:0 4px 0 #a8496d;}
.fs-open:active{transform:translateY(2px);box-shadow:0 2px 0 #a8496d;}
.fs-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.fs-open--two{background:linear-gradient(180deg,#8f9ae0,#6f79c8);box-shadow:0 4px 0 #57619f;}
.fs-open--en{background:linear-gradient(180deg,#e0a45c,#c4853c);box-shadow:0 4px 0 #9c672c;}
.fs-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
.fs-pick{border:none;border-radius:14px;padding:7px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#6a4f7a;box-shadow:0 3px 0 rgba(160,120,180,.35);}
.fs-pick[aria-pressed="true"]{background:linear-gradient(180deg,#f08aa8,#d0608a);color:#fff;box-shadow:0 3px 0 #a8496d;}
.fs-pick:active{transform:translateY(2px);}
.fs-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
@media (max-width:420px){
  .fs-chip{font-size:12px;padding:3px 8px;}
  .fs-tip{font-size:12.5px;padding:4px 8px;}
  .fs-bowls{gap:6px;}
  .fs-key{min-width:50px;height:42px;font-size:14px;}
}
@media (prefers-reduced-motion:reduce){
  .fs-btn:active,.fs-key:active,.fs-pick:active{transform:none;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("fs-style")) return;
  const style = document.createElement("style");
  style.id = "fs-style";
  style.textContent = CSS;
  (document.head ?? host).appendChild(style);
  cssInjected = true;
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
  let dropIndex = 0;
  let aimX = lv.box.w / 2;
  let cooldown = 0;
  let done = false;
  let won = false;
  let lost = false;
  let warnT = 0;

  function currentLevel(): number {
    return nextFruit(opts.seed, dropIndex, lv.maxDrop, lv.minDrop);
  }

  function left(): number {
    return opts.limited ? Math.max(0, lv.drops - world.drops) : Infinity;
  }

  function refreshNext(): void {
    nextRow.innerHTML = "";
    nextRow.appendChild(el("span", undefined, "下一个"));
    const preview = previewFruits(opts.seed, dropIndex, 2, lv.maxDrop, lv.minDrop);
    preview.forEach((lvl, i) => {
      const kind = CHAIN[lvl];
      const dot = el("span", "fs-dot");
      const size = Math.round(clamp(kind.r * 0.7, 12, 26)) * (i === 0 ? 1 : 0.78);
      dot.style.width = `${Math.round(size)}px`;
      dot.style.height = `${Math.round(size)}px`;
      dot.style.background = kind.color;
      dot.title = kind.name;
      nextRow.appendChild(dot);
    });
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
    g?.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }

  function canDrop(): boolean {
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
    const lvl = currentLevel();
    aimX = clampDropX(lv.box.w, lvl, aimX + dx);
  }

  function aimTo(clientX: number): void {
    const box = canvas.getBoundingClientRect();
    const x = (clientX - box.left) / Math.max(1, scale);
    const lvl = currentLevel();
    aimX = clampDropX(lv.box.w, lvl, x);
  }

  // 触屏:在盆上拖动瞄准,松手投下
  let pointerId = -1;
  opts.runtime.on<PointerEvent>(canvas, "pointerdown", (ev) => {
    if (opts.ai) return;
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
      if (ev.kind === "merge") opts.sfx(ev.level >= 6 ? "coin" : "pop");
      else if (ev.kind === "top") opts.sfx("win");
    }
    world.events.length = 0;
  }

  function update(dtMs: number): void {
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

  function drawFruit(x: number, y: number, r: number, level: number, alpha = 1, scaleK = 1): void {
    if (!g) return;
    const kind = CHAIN[clamp(level, 0, TOP_LEVEL)];
    const rr = Math.max(1, r * scaleK);
    g.globalAlpha = alpha;
    g.fillStyle = kind.color;
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = kind.edge;
    g.lineWidth = Math.max(1, rr * 0.09);
    g.stroke();
    // 高光
    g.fillStyle = "rgba(255,255,255,.55)";
    g.beginPath();
    g.arc(x - rr * 0.3, y - rr * 0.34, rr * 0.28, 0, Math.PI * 2);
    g.fill();
    // 小叶子:全部原创造型,一片叶子加一根短梗
    g.strokeStyle = "#6ea86b";
    g.lineWidth = Math.max(1, rr * 0.1);
    g.beginPath();
    g.moveTo(x, y - rr);
    g.lineTo(x, y - rr * 1.24);
    g.stroke();
    g.fillStyle = "#8fc98a";
    g.beginPath();
    g.ellipse(x + rr * 0.24, y - rr * 1.18, rr * 0.26, rr * 0.14, -0.5, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  function render(): void {
    if (!g) return;
    const b = lv.box;
    g.clearRect(0, 0, b.w, b.h);

    // 盆底与盆壁
    const grad = g.createLinearGradient(0, 0, 0, b.h);
    grad.addColorStop(0, "#fffafc");
    grad.addColorStop(1, "#ffeef4");
    g.fillStyle = grad;
    g.fillRect(0, 0, b.w, b.h);
    g.strokeStyle = "#f0c6d6";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(1.5, 0);
    g.lineTo(1.5, b.h - 1.5);
    g.lineTo(b.w - 1.5, b.h - 1.5);
    g.lineTo(b.w - 1.5, 0);
    g.stroke();

    // 警戒线:快碰到的时候先闪一闪
    const danger = nearLine(world, lv.lineY, 20);
    const blink = opts.reduced ? 1 : 0.45 + 0.55 * Math.abs(Math.sin(warnT / 260));
    g.strokeStyle = danger ? `rgba(226,86,110,${blink.toFixed(3)})` : "rgba(200,150,175,.75)";
    g.lineWidth = danger ? 3 : 2;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(0, lv.lineY);
    g.lineTo(b.w, lv.lineY);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = danger ? "#d2426a" : "#b48aa0";
    g.font = "600 12px system-ui,sans-serif";
    g.textAlign = "left";
    g.textBaseline = "bottom";
    g.fillText("警戒线", 6, lv.lineY - 4);

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

    for (const f of world.fruits) {
      drawFruit(f.x, f.y, f.r, f.level, 1, popScale(f.popMs, world.popMs));
    }

    // 吸合动画:两颗一边靠拢一边缩小
    for (const anim of world.merges) {
      const p = pullProgress(anim);
      const k = 1 - 0.45 * p;
      const r = radiusOf(anim.fromLevel);
      drawFruit(anim.ax + (anim.x - anim.ax) * p, anim.ay + (anim.y - anim.ay) * p, r, anim.fromLevel, 1 - 0.15 * p, k);
      drawFruit(anim.bx + (anim.x - anim.bx) * p, anim.by + (anim.y - anim.by) * p, r, anim.fromLevel, 1 - 0.15 * p, k);
    }
  }

  // 画布上的果子读屏读不出来,所以把这一盆的状态写成一句话挂上去;
  // 手动冒烟脚本也靠它读盘面,不用去猜像素。
  let lastLabel = "";
  function describe(paused: boolean): void {
    const who = opts.ai ? "电脑" : P_NAME[opts.seat];
    const big = CHAIN[clamp(world.bestLevel, 0, TOP_LEVEL)].name;
    const rest = opts.limited ? `剩${left()}颗` : "不限";
    const text = `${who}的果盆，${world.score}分，最大「${big}」，盆里${world.fruits.length}颗，${rest}${paused ? "，已暂停" : ""}`;
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
  ensureCss(host);
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
    held.add(ev.code);
    if (ev.code === "KeyF") bowls[0]?.requestDrop();
    if (ev.code === "KeyL" && opts.seats > 1 && !opts.ai) bowls[1]?.requestDrop();
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
    const roomH = Math.max(220, (window.innerHeight || 720) - 300);
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
  let paused = false;
  let finished = false;

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
      showVeil("⏸ 歇一会儿", "按 Esc 或点「继续」接着摆。朵朵:A / D 移动,F 放下;星星:方向键移动,L 放下;手机直接在盆上拖动,松手就落。", [
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
    const base: TableResult = {
      winner: -1,
      cleared: false,
      score: w0.score,
      bestLevel: w0.bestLevel,
      bestChain: w0.bestChain,
      dropsUsed: w0.drops,
      reason: "goal",
    };
    if (bowls.length === 1) {
      if (bowls[0].won) settle({ ...base, winner: 0, cleared: true, reason: "goal" });
      else if (bowls[0].lost) settle({ ...base, reason: bowls[0].left <= 0 ? "empty" : "over" });
      return;
    }
    if (bowls[0].won) settle({ ...base, winner: 0, cleared: true, reason: "goal" });
    else if (bowls[1].won) settle({ ...base, winner: 1, reason: "goal" });
    else if (bowls[0].lost) settle({ ...base, winner: 1, reason: bowls[0].left <= 0 ? "empty" : "over" });
    else if (bowls[1].lost) settle({ ...base, winner: 0, cleared: true, reason: "goal" });
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
    },
  };
}

const KEY_CODES = new Set(["KeyA", "KeyD", "KeyF", "KeyL", "ArrowLeft", "ArrowRight"]);

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
  ensureCss(host);
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
  return { stage, chip, destroy: () => wrap.remove() };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
): void {
  stage.innerHTML = "";
  const box = el("div", "fs-veil");
  box.style.position = "static";
  box.append(el("div", "fs-veil-t", title), el("div", "fs-veil-s", sub));
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
    ]);
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
    ]);
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
        ? `${lv.hint} 朵朵:A / D 移动,F 放下;手机直接在盆上拖。`
        : `${lv.hint} 朵朵:A / D + F;星星:方向键 + L。`,
      sfx: (n) => api.play(n),
      onDone: (res) => roundOver(res.winner),
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
        ]);
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
  ensureCss(api.root);
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
    },
  };
}
