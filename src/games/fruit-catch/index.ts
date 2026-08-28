import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import { CHAPTERS, HEAVY_FRUITS, LEVELS, THEME_SETS, type CatchLevel } from "./levels";
import {
  BASKET_HALF,
  BASKET_MAX_X,
  BASKET_MIN_X,
  BASKET_SPEED,
  CATCH_Y,
  DUO_GOAL,
  FIRST_LAND,
  FREEZE_SECONDS,
  FRUITS,
  H,
  HEAVY_SLOW_S,
  Janitor,
  MAGNET_SECONDS,
  MAX_MISS,
  PLAYERS,
  RAIN_MISS_LIMIT,
  SPAWN_Y,
  W,
  basketSpeedNow,
  beltSpawnX,
  beltX,
  clampBasket,
  duoCatch,
  duoDone,
  duoInit,
  duoMiss,
  duoSide,
  duoWord,
  isCaught,
  isHazard,
  markReachable,
  missCostsLife,
  missReason,
  missWordFor,
  planDrops,
  RAIN_CHUNK,
  RAIN_LOOKAHEAD,
  rainCatch,
  rainExtend,
  rainInit,
  rainMiss,
  rainPlan,
  rainWord,
  scoreFor,
  starsFor,
  steadyMul,
  windOffset,
  type DropPlan,
  type DuoState,
  type FruitKind,
  type Player,
  type RainState
} from "./logic";
import {
  FcFx,
  drawFcBasket,
  drawFcBeltArrow,
  drawFcFlower,
  drawFcItemBody,
  drawFcScene,
  drawFcStarBadge,
  fcSpinAngle,
  fruitColorOf,
  fruitKindOf
} from "./visual";
import type { FruitKitKind } from "../../art/kit/fruit";

/** 1.1 传送果道：传送带的高度与停留时长 */
const BELT_Y = 140;
const BELT_DWELL = 1.3;
/** 1.1 连击星光坡：攒满几连击多算一颗 */
const COMBO_EVERY = 5;
/** 接住时篮子往下压几像素 */
const PRESS_PX = 3;

/** 冒烟脚本才需要逐帧状态镜像，正常游玩不写 DOM 属性 */
const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CSS = `
.frc-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF9E8, #FFEFEF); border-radius: 16px; padding: 12px; user-select: none; touch-action: none; position: relative; }
.frc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: nowrap; }
.frc-badge { background: #fff; border: 1px solid rgba(220,170,100,.35); border-radius: 14px; padding: 5px 9px; font-weight: 700; color: #D08A3E; box-shadow: 0 2px 6px rgba(220,170,100,.25); font-size: 14px; white-space: nowrap; }
.frc-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.frc-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFD26E, #FF9E5E); border-radius: 8px; transition: width .3s; }
.frc-canvas { width: 100%; height: auto; border-radius: 16px; display: block; touch-action: none; }
.frc-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
@media (max-height: 520px) {
  .frc-ctrl { position: sticky; bottom: 0; z-index: 4; background: linear-gradient(180deg, rgba(255,249,232,0), #FFF9E8 10px); padding-top: 8px; }
}
.frc-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFD9A0; color: #8A5A20; cursor: pointer; box-shadow: 0 4px 0 #EBBB77; touch-action: none; }
.frc-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EBBB77; }
.frc-msg { text-align: center; min-height: 20px; color: #D08A3E; font-weight: 700; margin-top: 8px; font-size: 14px; line-height: 1.45; }
.frc-modebar { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.frc-modebar[hidden] { display: none; }
.frc-open { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #FFE0B8; color: #A05C1E; cursor: pointer; box-shadow: 0 3px 0 #EFC291; }
.frc-open:active { transform: translateY(2px); box-shadow: 0 1px 0 #EFC291; }
.frc-back { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #E7E1FA; color: #5B4B8A; cursor: pointer; }
.frc-over { text-align: center; padding: 14px 8px; }
.frc-over h3 { margin: 0 0 6px; font-size: 19px; color: #A05C1E; }
.frc-over p { margin: 4px 0; font-size: 14px; color: #6B5B4A; line-height: 1.5; }
.frc-again { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
.frc-legend { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 8px; font-size: 13px; color: #8A6A44; }
.frc-legend span { background: #fff8ec; border-radius: 10px; padding: 3px 8px; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) {
  .frc-fill { transition: none; }
}
`;


/** 画布显示高下限:再矮篮口和果子叠在一起,低于它宁可交给舞台滚动 */
export const MIN_CANVAS_DISPLAY_PX = 160;

export function canvasDisplayCapPx(
  nativeH: number,
  roomPx: number,
  min = MIN_CANVAS_DISPLAY_PX
): number | null {
  if (!Number.isFinite(nativeH) || nativeH <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const cap = Math.floor(roomPx);
  if (nativeH <= cap + 1) return null;
  return Math.max(min, cap);
}

function stageClipBottom(from: HTMLElement): number {
  let node: HTMLElement | null = from.parentElement;
  for (let i = 0; node && i < 10; i++) {
    if (typeof node.className === "string" && node.className.includes("game-stage")) {
      if (typeof node.getBoundingClientRect !== "function") break;
      const r = node.getBoundingClientRect();
      const inner =
        typeof node.clientHeight === "number" && node.clientHeight > 0
          ? (node.clientTop || 0) + node.clientHeight
          : r.height;
      if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
      break;
    }
    node = node.parentElement;
  }
  return Number.NaN;
}

function bindCanvasFit(canvas: HTMLCanvasElement, wrap: HTMLElement, jan: Janitor): void {
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;
  const fit = (): void => {
    if (!canvas.style || typeof canvas.getBoundingClientRect !== "function") return;
    if (typeof wrap.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom(wrap);
    if (!Number.isFinite(clip)) return;
    canvas.style.maxHeight = "";
    const canvasRect = canvas.getBoundingClientRect();
    if (!Number.isFinite(canvasRect.top)) return;
    const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(canvasRect));
    const px = canvasDisplayCapPx(canvasRect.height, clip - canvasRect.top - below - 4);
    canvas.style.maxHeight = px === null ? "" : `${px}px`;
  };
  jan.on(window, "resize", fit);
  fit();
}

function el<T extends HTMLElement = HTMLElement>(tag: string, cls?: string, text?: string): T {
  const node = document.createElement(tag) as T;
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// 画水果：全部自绘（六剪影 + 三停渐变），emoji 只当「主题选果」的钥匙用
// ---------------------------------------------------------------------------

interface Drawable {
  x: number;
  y: number;
  kind: FruitKind;
  emoji: string;
  bonus: boolean;
  /** 风摆方向，顺带当慢旋相位用（纯视觉） */
  swing?: number;
}

function drawItem(c2d: CanvasRenderingContext2D, it: Drawable, t: number, calm: boolean): void {
  c2d.save();
  c2d.translate(it.x, it.y);

  if (it.kind === "freeze") {
    c2d.fillStyle = "rgba(150,215,255,.5)";
    c2d.beginPath();
    c2d.roundRect(-19, -27, 38, 38, 10);
    c2d.fill();
  } else if (it.kind === "magnet") {
    c2d.strokeStyle = "rgba(150,110,220,.75)";
    c2d.lineWidth = 3;
    c2d.beginPath();
    c2d.arc(0, -8, 20, 0, Math.PI * 2);
    c2d.stroke();
  } else if (it.bonus && !FRUITS[it.kind].warn) {
    // 奖励果：淡淡一圈，告诉孩子「接到算白赚，漏了不扣爱心」
    c2d.strokeStyle = "rgba(120,190,140,.6)";
    c2d.lineWidth = 2;
    c2d.setLineDash([3, 4]);
    c2d.beginPath();
    c2d.arc(0, -8, 19, 0, Math.PI * 2);
    c2d.stroke();
    c2d.setLineDash([]);
  }

  // 下落慢旋只给会滚的果子（±8°，reduced 停）；警告物的红圈在火花层上面单独画
  const rot = it.kind === "fruit" || it.kind === "heavy" ? fcSpinAngle(t, (it.swing ?? 1) * 1.7, calm) : 0;
  drawFcItemBody(c2d, it.kind, it.emoji, 15, rot);
  c2d.restore();
}

/**
 * 警告红圈（功能件，图层序 ⑦）：脉动参数与 1.2 一字不差——
 * sin(t*6)*0.08、半径 21、线宽 3、虚线 [5,4]；reduced 下停脉动但圈保留。
 */
function drawWarnRing(c2d: CanvasRenderingContext2D, x: number, y: number, t: number, calm: boolean): void {
  const pulse = calm ? 1 : 1 + Math.sin(t * 6) * 0.08;
  c2d.save();
  c2d.translate(x, y);
  c2d.strokeStyle = "rgba(226,86,86,.85)";
  c2d.lineWidth = 3;
  c2d.setLineDash([5, 4]);
  c2d.beginPath();
  c2d.arc(0, -8, 21 * pulse, 0, Math.PI * 2);
  c2d.stroke();
  c2d.setLineDash([]);
  c2d.restore();
}

interface BasketFx {
  magnet?: boolean;
  frozen?: boolean;
  recent?: readonly FruitKitKind[];
  calm?: boolean;
}

/** 自绘编织藤篮：篮身压扁回弹沿用 press 变量，道具状态只读映射 */
function drawBasket(c2d: CanvasRenderingContext2D, x: number, press: number, tint?: string, fx?: BasketFx): void {
  drawFcBasket(c2d, {
    x,
    h: H,
    press,
    reduced: fx?.calm ?? false,
    tint,
    magnet: fx?.magnet,
    frozen: fx?.frozen,
    recent: fx?.recent
  });
}

// ---------------------------------------------------------------------------
// 场上的一颗水果：位置全靠「关卡时钟」算，冰冻时钟一停它就停在半空
// ---------------------------------------------------------------------------

interface Live {
  plan: DropPlan;
  emoji: string;
  /** 出生时刻（传送带关比落点表提早一个滑行时长） */
  spawnAt: number;
  /** 出生时的横坐标（传送带关是传送带入口） */
  fromX: number;
  /** 风摆的方向 */
  swing: number;
  x: number;
  y: number;
  gone: boolean;
}

function themeEmoji(cfg: CatchLevel, kind: FruitKind, r: number): string {
  const theme = THEME_SETS[cfg.theme];
  if (kind === "bad") return theme.bad;
  if (kind === "gold") return theme.gold;
  if (kind === "heavy") return HEAVY_FRUITS[Math.floor(r * HEAVY_FRUITS.length) % HEAVY_FRUITS.length];
  if (kind === "fruit") return theme.fruits[Math.floor(r * theme.fruits.length) % theme.fruits.length];
  return FRUITS[kind].emoji;
}

/** 按关卡时钟摆好一颗水果的位置 */
function placeItem(it: Live, clock: number, cfg: CatchLevel, conveyor: number): void {
  const p = it.plan;
  const tau = clock - it.spawnAt;
  const fall1 = (BELT_Y - SPAWN_Y) / p.vy;
  let x = p.x;
  let y: number;
  if (conveyor !== 0) {
    if (tau < fall1) {
      y = SPAWN_Y + p.vy * tau;
      x = it.fromX;
    } else if (tau < fall1 + BELT_DWELL) {
      y = BELT_Y;
      x = beltX(it.fromX, p.x, (tau - fall1) / BELT_DWELL);
    } else {
      y = BELT_Y + p.vy * (tau - fall1 - BELT_DWELL);
    }
  } else {
    y = SPAWN_Y + p.vy * tau;
  }
  if (cfg.wind > 0) x += windOffset(clock, p.landAt, cfg.wind, it.swing);
  it.x = Math.max(14, Math.min(W - 14, x));
  it.y = y;
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: CatchLevel = LEVELS[ctx.level];
  const theme = THEME_SETS[cfg.theme];
  const basketCount = cfg.baskets ?? 1;
  const conveyor = cfg.conveyor ?? 0;
  const calm = reducedMotion();
  const jan = new Janitor();

  const seed = (Math.floor(Math.random() * 0x7fffffff) ^ (ctx.level * 2654435761)) >>> 0;
  const plan = markReachable(
    planDrops(cfg, seed, {
      count: 260,
      firstLand: FIRST_LAND + (conveyor !== 0 ? BELT_DWELL : 0),
      twinChance: ctx.level >= 99 ? 0.14 : 0.08
    })
  );
  let planAt = 0;

  let destroyed = false;
  let ended = false;
  let raf = 0;
  let lastTime = 0;
  /** 关卡时钟：冰冻时它不走，所以所有水果都停在半空 */
  let clock = 0;
  let caught = 0;
  let missed = 0;
  let combo = 0;
  let dir = 0;
  let basketX = W / 2;
  let slowLeft = 0;
  let freezeLeft = 0;
  let magnetLeft = 0;
  let press = 0;
  const items: Live[] = [];
  /** 纯视觉：星屑 / 飘分 / 彩虹 / 落空弹地的粒子池（destroy 时 clear 归零） */
  const fx = new FcFx(calm);
  /** 纯视觉：最近接住的果子，摆进篮口裁剪层（最多显示 3 个） */
  const recentCatch: FruitKitKind[] = [];

  const wrap = el("div", "frc-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="frc-top">
      <span class="frc-badge frc-score">🧺 0 / ${cfg.target}</span>
      ${cfg.combo ? `<span class="frc-badge frc-combo">🔥 0</span>` : ""}
      <span class="frc-badge frc-power" hidden></span>
      <span class="frc-badge frc-miss">💗💗💗</span>
    </div>
    <div class="frc-bar"><div class="frc-fill"></div></div>
    <canvas class="frc-canvas fc-canvas" width="${W}" height="${H}"></canvas>
    <div class="frc-ctrl">
      <button class="frc-btn frc-left" type="button" aria-label="篮子往左">⬅️</button>
      <button class="frc-btn frc-right" type="button" aria-label="篮子往右">➡️</button>
    </div>
    <div class="frc-msg"></div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".frc-canvas") as HTMLCanvasElement;
  canvas.style.background = theme.bg;
  bindCanvasFit(canvas, wrap, jan);
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".frc-score") as HTMLElement;
  const comboEl = wrap.querySelector(".frc-combo") as HTMLElement | null;
  const powerEl = wrap.querySelector(".frc-power") as HTMLElement;
  const missEl = wrap.querySelector(".frc-miss") as HTMLElement;
  const fillEl = wrap.querySelector(".frc-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".frc-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".frc-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".frc-right") as HTMLButtonElement;

  const tips: string[] = [];
  if (basketCount > 1) tips.push("左右两只篮子镜像动");
  if ((cfg.heavyChance ?? 0) > 0) tips.push("沉水果顶两颗但会压慢篮子");
  if (conveyor !== 0) tips.push("水果会先在传送带上滑一段");
  if (cfg.combo) tips.push(`连续接住攒连击，满 ${COMBO_EVERY} 连多算一颗`);
  if (cfg.badChance > 0) tips.push("皱眉的小捣蛋云别接，看到红圈就绕开");
  if ((cfg.chiliChance ?? 0) > 0) tips.push("红圈里的小辣椒掉得最慢，绕开它");
  if ((cfg.freezeChance ?? 0) > 0) tips.push("冰冻果一接，全场定住 2 秒");
  if ((cfg.magnetChance ?? 0) > 0) tips.push("磁铁果一接，3 秒里篮口变大");
  if (cfg.goldChance >= 0.1) tips.push(`${theme.gold} 一颗顶${cfg.theme === 5 ? "三" : "两"}颗`);
  if (cfg.wind > 0) tips.push("有风，水果会摇，落地那一下才是真落点");
  msgEl.textContent =
    tips.length > 0 ? `本关要点：${tips.join("，")}！` : "眼睛看屏幕上方，提前挪到落点下面等！";

  function basketXs(): number[] {
    return basketCount > 1 ? [basketX, W - basketX] : [basketX];
  }

  function updateTop(): void {
    scoreEl.textContent = `🧺 ${caught} / ${cfg.target}`;
    missEl.textContent =
      "💗".repeat(Math.max(0, MAX_MISS - missed)) + "🤍".repeat(Math.min(MAX_MISS, missed));
    fillEl.style.width = `${Math.min(100, (caught / cfg.target) * 100)}%`;
    if (comboEl) comboEl.textContent = `🔥 ${combo}`;
    const bits: string[] = [];
    if (freezeLeft > 0) bits.push(`🧊 ${freezeLeft.toFixed(1)}s`);
    if (magnetLeft > 0) bits.push(`🧲 ${magnetLeft.toFixed(1)}s`);
    powerEl.hidden = bits.length === 0;
    powerEl.textContent = bits.join(" ");
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    // 图层序（FC_LAYERS）：① 天空日月 ② 程序云 ③ 果树枝草地
    drawFcScene(c2d, { w: W, h: H, theme: cfg.theme, t: clock, reduced: calm });
    if (conveyor !== 0) {
      c2d.fillStyle = "rgba(140,120,160,.35)";
      c2d.beginPath();
      c2d.roundRect(16, BELT_Y + 8, W - 32, 8, 4);
      c2d.fill();
      c2d.fillStyle = "rgba(90,70,120,.75)";
      for (let x = 40; x < W - 30; x += 60) drawFcBeltArrow(c2d, x, BELT_Y, conveyor > 0 ? 1 : -1);
    }
    if (magnetLeft > 0) {
      c2d.strokeStyle = "rgba(150,110,220,.35)";
      c2d.lineWidth = 2;
      for (const bx of basketXs()) {
        c2d.beginPath();
        c2d.arc(bx, H - 26, BASKET_HALF + 26, Math.PI, Math.PI * 2);
        c2d.stroke();
      }
    }
    // ④ 下落物 → ⑤ 篮子（含篮内裁剪层）→ ⑥ 火花/彩虹/飘分 → ⑦ 警告红圈
    for (const it of items) if (!it.gone) drawItem(c2d, { ...it, kind: it.plan.kind, bonus: it.plan.bonus }, clock, calm);
    for (const bx of basketXs())
      drawBasket(c2d, bx, press, undefined, {
        magnet: magnetLeft > 0,
        frozen: freezeLeft > 0,
        recent: recentCatch,
        calm
      });
    fx.draw(c2d, H - 10);
    for (const it of items)
      if (!it.gone && FRUITS[it.plan.kind].warn) drawWarnRing(c2d, it.x, it.y, clock, calm);
    if (freezeLeft > 0) {
      c2d.fillStyle = "rgba(170,225,255,.18)";
      c2d.fillRect(0, 0, W, H);
    }
    c2d.textAlign = "left";
    if (SMOKE) {
      canvas.dataset.items = JSON.stringify(
        items
          .filter((it) => !it.gone && !it.plan.bonus)
          .map((it) => [Math.round(it.x), Math.round(it.y), isHazard(it.plan.kind) ? "bad" : it.plan.kind])
      );
      canvas.dataset.basket = String(Math.round(basketX));
    }
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    draw();
    if (won) {
      ctx.win(
        starsFor(missed),
        missed === 0 ? "一颗爱心都没掉，落点预判得很准！" : `装满 ${cfg.target} 个，篮子沉甸甸！`
      );
    } else {
      ctx.lose(`这一轮接到 ${caught} 个～视线往屏幕上方抬一点，提前挪到落点下面等，再来一次！`);
    }
  }

  function onGoodCatch(gain: number, note?: string): void {
    caught += gain;
    combo++;
    // 连接 5 个不落地：篮上方小彩虹一闪（纯视觉，reduced 关闭）
    if (combo % COMBO_EVERY === 0) fx.flashRainbow(basketX);
    if (cfg.combo && combo > 0 && combo % COMBO_EVERY === 0) {
      caught += 1;
      ctx.sfx("coin");
      msgEl.textContent = `🔥 ${combo} 连击！多算一颗！`;
    } else if (note) {
      msgEl.textContent = note;
    }
    updateTop();
    if (caught >= cfg.target) finish(true);
  }

  function spawnDue(): void {
    while (planAt < plan.length && plan[planAt].at <= clock) {
      const p = plan[planAt++];
      const spawnAt = p.at - (conveyor !== 0 ? BELT_DWELL : 0);
      const it: Live = {
        plan: p,
        emoji: themeEmoji(cfg, p.kind, Math.random()),
        spawnAt,
        fromX: conveyor !== 0 ? beltSpawnX(p.x, conveyor, BELT_DWELL) : p.x,
        swing: Math.random() < 0.5 ? -1 : 1,
        x: p.x,
        y: SPAWN_Y,
        gone: false
      };
      placeItem(it, clock, cfg, conveyor);
      items.push(it);
    }
  }

  function resolve(it: Live): void {
    const p = it.plan;
    const info = FRUITS[p.kind];
    it.gone = true;
    if (isHazard(p.kind)) {
      missed++;
      combo = 0;
      ctx.sfx("oops");
      fx.hazardPuff(it.x, CATCH_Y - 10);
      msgEl.textContent =
        p.kind === "chili"
          ? "🌶️ 小辣椒不能接～它掉得最慢，看到红圈就提前让开！"
          : "小捣蛋云不能接～先规划一条避开它的路线再考虑接水果！";
      updateTop();
      if (missed >= MAX_MISS) finish(false);
      return;
    }
    press = PRESS_PX;
    fx.catchBurst(it.x, CATCH_Y - 6, p.kind === "gold" ? "#FFC94D" : "#FF9E5E");
    const gainShown = p.kind === "gold" ? (cfg.theme === 5 ? 3 : 2) : p.kind === "heavy" ? 2 : 1;
    fx.scoreFloat(it.x, CATCH_Y - 30, `+${gainShown}`);
    if (p.kind === "fruit" || p.kind === "heavy") {
      recentCatch.push(fruitKindOf(it.emoji));
      if (recentCatch.length > 6) recentCatch.shift();
    }
    if (p.kind === "gold") {
      ctx.sfx("coin");
      onGoodCatch(cfg.theme === 5 ? 3 : 2, cfg.theme === 5 ? "✨ 萤火虫一只顶三个！" : "🌟 亮的一颗顶两颗！");
    } else if (p.kind === "heavy") {
      ctx.sfx("coin");
      slowLeft = HEAVY_SLOW_S;
      onGoodCatch(2, info.hint);
    } else if (p.kind === "freeze") {
      ctx.sfx("pop");
      freezeLeft = FREEZE_SECONDS;
      onGoodCatch(1, "🧊 全场定住 2 秒，慢慢挑！");
    } else if (p.kind === "magnet") {
      ctx.sfx("pop");
      magnetLeft = MAGNET_SECONDS;
      onGoodCatch(1, "🧲 篮口变大 3 秒，靠近就吸进来！");
    } else {
      ctx.sfx("pop");
      onGoodCatch(1);
    }
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    // 篮子走的是真实时间：冰冻时孩子照样能从容挪位置
    slowLeft = Math.max(0, slowLeft - dt);
    basketX = clampBasket(basketX + dir * basketSpeedNow(slowLeft) * dt);
    press = Math.max(0, press - dt * 24);
    fx.step(dt);

    const wasFrozen = freezeLeft > 0;
    freezeLeft = Math.max(0, freezeLeft - dt);
    magnetLeft = Math.max(0, magnetLeft - dt);
    if (!wasFrozen) clock += dt;
    if (wasFrozen && freezeLeft === 0) msgEl.textContent = "冰化开啦，接着接！";

    spawnDue();

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      placeItem(it, clock, cfg, conveyor);
      if (it.y < CATCH_Y - 14) continue;
      const grabbed = basketXs().some((bx) => isCaught(it.x, it.y, bx, { magnet: magnetLeft > 0 }));
      if (grabbed) {
        items.splice(i, 1);
        resolve(it);
        if (ended) return;
      } else if (it.y > CATCH_Y + 16) {
        items.splice(i, 1);
        // 落空的果子在草地上弹一下渐隐（纯视觉，不改扣分逻辑）
        if (!isHazard(it.plan.kind)) fx.missFade(it.x, fruitKindOf(it.emoji), fruitColorOf(it.emoji));
        if (!it.plan.bonus && missCostsLife(it.plan.kind)) {
          missed++;
          combo = 0;
          ctx.sfx("oops");
          // 说清是「起步晚了」「这颗快」「差半个篮子」还是「刚被压慢」，
          // 四种原因对应四种做法，孩子才改得到点子上
          const nearest = basketXs().reduce((a, b) => (Math.abs(b - it.x) < Math.abs(a - it.x) ? b : a));
          msgEl.textContent = missWordFor(missReason(it.x, nearest, it.plan.vy, slowLeft), missed);
          updateTop();
          if (missed >= MAX_MISS) {
            finish(false);
            return;
          }
        }
      }
    }

    if (freezeLeft > 0 || magnetLeft > 0 || !powerEl.hidden) updateTop();
    draw();
    raf = requestAnimationFrame(tick);
  }

  function hold(btn: HTMLButtonElement, d: number): void {
    jan.on(btn, "pointerdown", (ev: Event) => {
      ev.preventDefault();
      dir = d;
      ctx.sfx("tap");
    });
    const stop = () => {
      if (dir === d) dir = 0;
    };
    jan.on(btn, "pointerup", stop);
    jan.on(btn, "pointerleave", stop);
    jan.on(btn, "pointercancel", stop);
  }
  hold(leftBtn, -1);
  hold(rightBtn, 1);

  // 触屏：手指按在篮口上就保持相对偏移（不遮住篮口），按在半空就直接跟手
  let dragging = false;
  let grab = 0;
  function canvasPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }
  jan.on(canvas, "pointerdown", (ev: Event) => {
    const e = ev as PointerEvent;
    const pos = canvasPos(e);
    dragging = true;
    grab = pos.y > CATCH_Y - 60 ? Math.max(-70, Math.min(70, basketX - pos.x)) : 0;
    basketX = clampBasket(pos.x + grab);
  });
  jan.on(canvas, "pointermove", (ev: Event) => {
    if (!dragging) return;
    basketX = clampBasket(canvasPos(ev as PointerEvent).x + grab);
  });
  jan.on(window, "pointerup", () => {
    dragging = false;
  });

  jan.on(window, "keydown", (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      dir = -1;
      e.preventDefault();
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      dir = 1;
      e.preventDefault();
    }
  });
  jan.on(window, "keyup", (ev: Event) => {
    const e = ev as KeyboardEvent;
    const left = e.key === "ArrowLeft" || e.key === "a" || e.key === "A";
    const right = e.key === "ArrowRight" || e.key === "d" || e.key === "D";
    if ((left && dir === -1) || (right && dir === 1)) dir = 0;
  });

  updateTop();
  draw();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      // 粒子与篮内小果全清零，离场一件不剩
      fx.clear();
      items.length = 0;
      recentCatch.length = 0;
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 双人同屏：朵朵 A/D、星星 ←/→，左右半屏各接各的
// ---------------------------------------------------------------------------

function mountDuo(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const jan = new Janitor();
  const calm = reducedMotion();
  const cfg: CatchLevel = {
    target: DUO_GOAL, speed: 1.1, spawnMs: 900, badChance: 0.07, goldChance: 0.1,
    wind: 0, theme: 0, chiliChance: 0.06
  };

  /**
   * 左右两边各排一张只在自己半屏里跑的下落表：
   * 这样两个人各自都「条条够得着」，不会一边忙死一边闲着。
   */
  function duoPlan(): DropPlan[] {
    const seed = (Math.random() * 0x7fffffff) >>> 0;
    const left = planDrops(cfg, seed, {
      count: 110, minX: BASKET_MIN_X, maxX: W / 2 - 6, startX: W * 0.25, twinChance: 0
    });
    const right = planDrops(cfg, (seed ^ 0x5bf03635) >>> 0, {
      count: 110, minX: W / 2 + 6, maxX: BASKET_MAX_X, startX: W * 0.75, twinChance: 0
    });
    return [...left, ...right].sort((a, b) => a.at - b.at);
  }

  let plan: DropPlan[] = duoPlan();
  let planAt = 0;
  let raf = 0;
  let lastTime = 0;
  let clock = 0;
  let over = false;
  let st: DuoState = duoInit();
  const items: Live[] = [];
  const fx = new FcFx(calm);

  const pos: Record<Player, number> = { doudou: W * 0.25, star: W * 0.75 };
  const dirs: Record<Player, number> = { doudou: 0, star: 0 };
  const press: Record<Player, number> = { doudou: 0, star: 0 };

  const wrap = el("div", "frc-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="frc-modebar">
      <button class="frc-back" type="button">⬅️ 回地图</button>
      <span class="frc-badge frc-goal">先接满 ${DUO_GOAL} 颗就赢</span>
    </div>
    <div class="frc-top">
      <span class="frc-badge frc-a">${PLAYERS.doudou.emoji} ${PLAYERS.doudou.name} 0</span>
      <span class="frc-badge frc-b">${PLAYERS.star.emoji} ${PLAYERS.star.name} 0</span>
    </div>
    <canvas class="frc-canvas" width="${W}" height="${H}"></canvas>
    <div class="frc-ctrl">
      <button class="frc-btn frc-al" type="button" aria-label="朵朵往左">🌸⬅️</button>
      <button class="frc-btn frc-ar" type="button" aria-label="朵朵往右">➡️🌸</button>
      <button class="frc-btn frc-bl" type="button" aria-label="星星往左">⭐⬅️</button>
      <button class="frc-btn frc-br" type="button" aria-label="星星往右">➡️⭐</button>
    </div>
    <div class="frc-msg">朵朵按 A / D，星星按 ← / →；手机就按下面四个大按钮，或者各按住自己那半边屏幕拖。</div>
    <div class="frc-legend">
      <span>🍎 一颗算一个</span><span>🌟 一颗顶两个</span><span>🌶️ 和小捣蛋云别接</span>
    </div>
  `;
  host.appendChild(wrap);

  const canvas = wrap.querySelector(".frc-canvas") as HTMLCanvasElement;
  canvas.style.background = "linear-gradient(180deg, #E6F4FF 0%, #FFF3E4 100%)";
  bindCanvasFit(canvas, wrap, jan);
  const c2d = canvas.getContext("2d");
  const aEl = wrap.querySelector(".frc-a") as HTMLElement;
  const bEl = wrap.querySelector(".frc-b") as HTMLElement;
  const msgEl = wrap.querySelector(".frc-msg") as HTMLElement;

  function updateTop(): void {
    aEl.textContent = `${PLAYERS.doudou.emoji} ${PLAYERS.doudou.name} ${st.doudou}`;
    bEl.textContent = `${PLAYERS.star.emoji} ${PLAYERS.star.name} ${st.star}`;
  }

  function limit(who: Player, x: number): number {
    return who === "doudou"
      ? Math.max(BASKET_MIN_X, Math.min(W / 2 - 6, x))
      : Math.max(W / 2 + 6, Math.min(BASKET_MAX_X, x));
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    drawFcScene(c2d, { w: W, h: H, theme: cfg.theme, t: clock, reduced: calm });
    c2d.strokeStyle = "rgba(140,140,170,.35)";
    c2d.setLineDash([6, 6]);
    c2d.beginPath();
    c2d.moveTo(W / 2, 0);
    c2d.lineTo(W / 2, H);
    c2d.stroke();
    c2d.setLineDash([]);
    // 半屏名牌：自绘小花 / 小星标 + 名字文字（不再用 emoji 直出）
    // 窗口 7 R1 修复 A-12:名牌文字提到 14px(功能小字底线)
    c2d.font = "bold 14px sans-serif";
    c2d.textAlign = "center";
    drawFcFlower(c2d, W * 0.25 - 22, 46, 7, PLAYERS.doudou.color);
    c2d.fillStyle = PLAYERS.doudou.color;
    c2d.fillText(PLAYERS.doudou.name, W * 0.25 + 6, 50);
    drawFcStarBadge(c2d, W * 0.75 - 22, 46, 8, PLAYERS.star.color);
    c2d.fillStyle = PLAYERS.star.color;
    c2d.fillText(PLAYERS.star.name, W * 0.75 + 6, 50);
    for (const it of items) if (!it.gone) drawItem(c2d, { ...it, kind: it.plan.kind, bonus: false }, clock, calm);
    drawBasket(c2d, pos.doudou, press.doudou, PLAYERS.doudou.color, { calm });
    drawBasket(c2d, pos.star, press.star, PLAYERS.star.color, { calm });
    fx.draw(c2d, H - 10);
    for (const it of items)
      if (!it.gone && FRUITS[it.plan.kind].warn) drawWarnRing(c2d, it.x, it.y, clock, calm);
    c2d.textAlign = "left";
  }

  function finish(): void {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    api.play("win");
    const box = el("div", "frc-over");
    box.innerHTML = `<h3>🧺 这局接完啦！</h3><p>${duoWord(st)}</p>`;
    const again = el("div", "frc-again");
    const retry = el<HTMLButtonElement>("button", "frc-open", "🔁 再来一局");
    retry.type = "button";
    const quit = el<HTMLButtonElement>("button", "frc-back", "⬅️ 回地图");
    quit.type = "button";
    again.append(retry, quit);
    box.appendChild(again);
    wrap.appendChild(box);
    jan.on(retry, "click", () => {
      box.remove();
      st = duoInit();
      items.length = 0;
      fx.clear();
      plan = duoPlan();
      planAt = 0;
      clock = 0;
      over = false;
      updateTop();
      loop();
    });
    jan.on(quit, "click", back);
  }

  function resolve(it: Live, who: Player): void {
    it.gone = true;
    if (isHazard(it.plan.kind)) {
      st = duoMiss(st, who);
      api.play("oops");
      fx.hazardPuff(it.x, CATCH_Y - 10);
      msgEl.textContent = `${PLAYERS[who].name}接到${FRUITS[it.plan.kind].name}啦，没关系，下一颗躲开就好～`;
      return;
    }
    press[who] = PRESS_PX;
    fx.catchBurst(it.x, CATCH_Y - 6, PLAYERS[who].color);
    fx.scoreFloat(it.x, CATCH_Y - 30, `+${FRUITS[it.plan.kind].gain}`, PLAYERS[who].color);
    st = duoCatch(st, who, FRUITS[it.plan.kind].gain);
    api.play(it.plan.kind === "gold" ? "coin" : "pop");
    updateTop();
    if (duoDone(st)) finish();
  }

  function tick(now: number): void {
    if (over) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    clock += dt;
    for (const who of ["doudou", "star"] as Player[]) {
      pos[who] = limit(who, pos[who] + dirs[who] * BASKET_SPEED * dt);
      press[who] = Math.max(0, press[who] - dt * 24);
    }
    fx.step(dt);

    while (planAt < plan.length && plan[planAt].at <= clock) {
      const p = plan[planAt++];
      const it: Live = {
        plan: p,
        emoji: themeEmoji(cfg, p.kind, Math.random()),
        spawnAt: p.at,
        fromX: p.x,
        swing: 1,
        x: p.x,
        y: SPAWN_Y,
        gone: false
      };
      placeItem(it, clock, cfg, 0);
      items.push(it);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      placeItem(it, clock, cfg, 0);
      if (it.y < CATCH_Y - 14) continue;
      const who = duoSide(it.x);
      if (isCaught(it.x, it.y, pos[who])) {
        items.splice(i, 1);
        resolve(it, who);
        if (over) return;
      } else if (it.y > CATCH_Y + 16) {
        items.splice(i, 1);
        if (!isHazard(it.plan.kind)) fx.missFade(it.x, fruitKindOf(it.emoji), fruitColorOf(it.emoji));
      }
    }

    if (planAt >= plan.length && items.length === 0) {
      finish();
      return;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  function loop(): void {
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  function bind(btn: HTMLButtonElement, who: Player, d: number): void {
    jan.on(btn, "pointerdown", (ev: Event) => {
      ev.preventDefault();
      dirs[who] = d;
    });
    const stop = () => {
      if (dirs[who] === d) dirs[who] = 0;
    };
    jan.on(btn, "pointerup", stop);
    jan.on(btn, "pointerleave", stop);
    jan.on(btn, "pointercancel", stop);
  }
  bind(wrap.querySelector(".frc-al") as HTMLButtonElement, "doudou", -1);
  bind(wrap.querySelector(".frc-ar") as HTMLButtonElement, "doudou", 1);
  bind(wrap.querySelector(".frc-bl") as HTMLButtonElement, "star", -1);
  bind(wrap.querySelector(".frc-br") as HTMLButtonElement, "star", 1);

  // 手机：各按住自己那半边屏幕拖，互不干扰
  const held = new Map<number, Player>();
  function canvasX(e: PointerEvent): number {
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  }
  jan.on(canvas, "pointerdown", (ev: Event) => {
    const e = ev as PointerEvent;
    const x = canvasX(e);
    const who = duoSide(x);
    held.set(e.pointerId, who);
    pos[who] = limit(who, x);
  });
  jan.on(canvas, "pointermove", (ev: Event) => {
    const e = ev as PointerEvent;
    const who = held.get(e.pointerId);
    if (who) pos[who] = limit(who, canvasX(e));
  });
  jan.on(window, "pointerup", (ev: Event) => held.delete((ev as PointerEvent).pointerId));

  jan.on(window, "keydown", (ev: Event) => {
    const e = ev as KeyboardEvent;
    const k = e.key;
    if (k === "a" || k === "A") dirs.doudou = -1;
    else if (k === "d" || k === "D") dirs.doudou = 1;
    else if (k === "ArrowLeft") dirs.star = -1;
    else if (k === "ArrowRight") dirs.star = 1;
    else if (k === "Escape") back();
    else return;
    e.preventDefault();
  });
  jan.on(window, "keyup", (ev: Event) => {
    const k = (ev as KeyboardEvent).key;
    if ((k === "a" || k === "A") && dirs.doudou === -1) dirs.doudou = 0;
    if ((k === "d" || k === "D") && dirs.doudou === 1) dirs.doudou = 0;
    if (k === "ArrowLeft" && dirs.star === -1) dirs.star = 0;
    if (k === "ArrowRight" && dirs.star === 1) dirs.star = 0;
  });
  jan.on(wrap.querySelector(".frc-back") as HTMLButtonElement, "click", back);

  updateTop();
  draw();
  loop();

  return {
    destroy() {
      over = true;
      cancelAnimationFrame(raf);
      fx.clear();
      items.length = 0;
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 无尽「水果雨」：越下越密，掉 3 颗收工
// ---------------------------------------------------------------------------

function mountRain(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const jan = new Janitor();
  const calm = reducedMotion();
  const cfg: CatchLevel = { target: 9999, speed: 1, spawnMs: 900, badChance: 0, goldChance: 0, wind: 0, theme: 0 };
  let plan: DropPlan[] = [];
  let planAt = 0;
  let rainSeed = 0;
  let raf = 0;
  let lastTime = 0;
  let clock = 0;
  let over = false;
  let st: RainState = rainInit();
  let basketX = W / 2;
  let dir = 0;
  let magnetLeft = 0;
  let freezeLeft = 0;
  let press = 0;
  const items: Live[] = [];
  const fx = new FcFx(calm);
  const recentCatch: FruitKitKind[] = [];

  const wrap = el("div", "frc-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="frc-modebar">
      <button class="frc-back" type="button">⬅️ 回地图</button>
      <span class="frc-badge frc-best"></span>
    </div>
    <div class="frc-top">
      <span class="frc-badge frc-score">🍎 0 分</span>
      <span class="frc-badge frc-chain">🔗 0 连</span>
      <span class="frc-badge frc-power" hidden></span>
      <span class="frc-badge frc-miss">💗💗💗</span>
    </div>
    <canvas class="frc-canvas" width="${W}" height="${H}"></canvas>
    <div class="frc-ctrl">
      <button class="frc-btn frc-left" type="button" aria-label="篮子往左">⬅️</button>
      <button class="frc-btn frc-right" type="button" aria-label="篮子往右">➡️</button>
    </div>
    <div class="frc-msg">水果越下越密！🌶️ 别接，🧊 定住 2 秒，🧲 篮口变大 3 秒。</div>
  `;
  host.appendChild(wrap);

  const canvas = wrap.querySelector(".frc-canvas") as HTMLCanvasElement;
  canvas.style.background = "linear-gradient(180deg, #FFE9C9 0%, #FFF6E4 100%)";
  bindCanvasFit(canvas, wrap, jan);
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".frc-score") as HTMLElement;
  const chainEl = wrap.querySelector(".frc-chain") as HTMLElement;
  const powerEl = wrap.querySelector(".frc-power") as HTMLElement;
  const missEl = wrap.querySelector(".frc-miss") as HTMLElement;
  const bestEl = wrap.querySelector(".frc-best") as HTMLElement;
  const msgEl = wrap.querySelector(".frc-msg") as HTMLElement;

  function updateTop(): void {
    scoreEl.textContent = `🍎 ${st.score} 分`;
    chainEl.textContent = `🔗 ${st.combo} 连${steadyMul(st.combo) > 1 ? ` ×${steadyMul(st.combo)}` : ""}`;
    missEl.textContent =
      "💗".repeat(Math.max(0, RAIN_MISS_LIMIT - st.missed)) + "🤍".repeat(Math.min(RAIN_MISS_LIMIT, st.missed));
    const bits: string[] = [];
    if (freezeLeft > 0) bits.push(`🧊 ${freezeLeft.toFixed(1)}s`);
    if (magnetLeft > 0) bits.push(`🧲 ${magnetLeft.toFixed(1)}s`);
    powerEl.hidden = bits.length === 0;
    powerEl.textContent = bits.join(" ");
    const best = save.getGameProgress(meta.id).endlessBest;
    bestEl.textContent = best > 0 ? `🏅 最好 ${best} 分` : "🏅 还没有最好成绩";
  }

  function reset(): void {
    st = rainInit();
    items.length = 0;
    fx.clear();
    recentCatch.length = 0;
    planAt = 0;
    clock = 0;
    basketX = W / 2;
    magnetLeft = 0;
    freezeLeft = 0;
    over = false;
    rainSeed = (Math.random() * 0x7fffffff) >>> 0;
    plan = markReachable(rainPlan(rainSeed, RAIN_CHUNK));
    updateTop();
  }

  /** 出场表快见底就再续一段——水果雨没有「下完」这回事，只有三次机会用完 */
  function topUpPlan(): void {
    if (planAt < plan.length - RAIN_LOOKAHEAD) return;
    rainSeed = (rainSeed * 1664525 + 1013904223) >>> 0;
    plan = plan.concat(rainExtend(plan, rainSeed, plan.length, RAIN_CHUNK));
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    drawFcScene(c2d, { w: W, h: H, theme: cfg.theme, t: clock, reduced: calm });
    if (magnetLeft > 0) {
      c2d.strokeStyle = "rgba(150,110,220,.35)";
      c2d.lineWidth = 2;
      c2d.beginPath();
      c2d.arc(basketX, H - 26, BASKET_HALF + 26, Math.PI, Math.PI * 2);
      c2d.stroke();
    }
    for (const it of items) if (!it.gone) drawItem(c2d, { ...it, kind: it.plan.kind, bonus: it.plan.bonus }, clock, calm);
    drawBasket(c2d, basketX, press, undefined, {
      magnet: magnetLeft > 0,
      frozen: freezeLeft > 0,
      recent: recentCatch,
      calm
    });
    fx.draw(c2d, H - 10);
    for (const it of items)
      if (!it.gone && FRUITS[it.plan.kind].warn) drawWarnRing(c2d, it.x, it.y, clock, calm);
    if (freezeLeft > 0) {
      c2d.fillStyle = "rgba(170,225,255,.18)";
      c2d.fillRect(0, 0, W, H);
    }
    c2d.textAlign = "left";
  }

  function finish(): void {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    const before = save.getGameProgress(meta.id).endlessBest;
    save.recordEndlessBest(meta.id, st.score);
    api.play(st.score > before ? "win" : "tap");
    const box = el("div", "frc-over");
    box.innerHTML = `<h3>🧺 这场水果雨告一段落</h3><p>${rainWord(st, before)}</p>`;
    const again = el("div", "frc-again");
    const retry = el<HTMLButtonElement>("button", "frc-open", "🔁 再下一场");
    retry.type = "button";
    const quit = el<HTMLButtonElement>("button", "frc-back", "⬅️ 回地图");
    quit.type = "button";
    again.append(retry, quit);
    box.appendChild(again);
    wrap.appendChild(box);
    jan.on(retry, "click", () => {
      box.remove();
      reset();
      loop();
    });
    jan.on(quit, "click", back);
  }

  function tick(now: number): void {
    if (over) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    basketX = clampBasket(basketX + dir * BASKET_SPEED * dt);
    press = Math.max(0, press - dt * 24);
    fx.step(dt);
    const wasFrozen = freezeLeft > 0;
    freezeLeft = Math.max(0, freezeLeft - dt);
    magnetLeft = Math.max(0, magnetLeft - dt);
    if (!wasFrozen) clock += dt;

    topUpPlan();
    while (planAt < plan.length && plan[planAt].at <= clock) {
      const p = plan[planAt++];
      const it: Live = {
        plan: p,
        emoji: themeEmoji(cfg, p.kind, Math.random()),
        spawnAt: p.at,
        fromX: p.x,
        swing: 1,
        x: p.x,
        y: SPAWN_Y,
        gone: false
      };
      placeItem(it, clock, cfg, 0);
      items.push(it);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      placeItem(it, clock, cfg, 0);
      if (it.y < CATCH_Y - 14) continue;
      if (isCaught(it.x, it.y, basketX, { magnet: magnetLeft > 0 })) {
        items.splice(i, 1);
        const kind = it.plan.kind;
        st = rainCatch(st, kind);
        if (isHazard(kind)) {
          api.play("oops");
          fx.hazardPuff(it.x, CATCH_Y - 10);
          msgEl.textContent = `接到${FRUITS[kind].name}啦，断了一次连接～看到红圈就绕开！`;
        } else {
          press = PRESS_PX;
          fx.catchBurst(it.x, CATCH_Y - 6, kind === "gold" ? "#FFC94D" : "#FF9E5E");
          fx.scoreFloat(it.x, CATCH_Y - 30, `+${scoreFor(kind, st.combo - 1)}`);
          if (kind === "fruit" || kind === "heavy") {
            recentCatch.push(fruitKindOf(it.emoji));
            if (recentCatch.length > 6) recentCatch.shift();
          }
          if (st.combo > 0 && st.combo % COMBO_EVERY === 0) fx.flashRainbow(basketX);
          if (kind === "freeze") freezeLeft = FREEZE_SECONDS;
          if (kind === "magnet") magnetLeft = MAGNET_SECONDS;
          api.play(kind === "gold" ? "coin" : "pop");
        }
        updateTop();
        if (st.over) {
          finish();
          return;
        }
      } else if (it.y > CATCH_Y + 16) {
        items.splice(i, 1);
        if (!isHazard(it.plan.kind)) fx.missFade(it.x, fruitKindOf(it.emoji), fruitColorOf(it.emoji));
        st = rainMiss(st, it.plan.kind, it.plan.bonus);
        if (!it.plan.bonus && missCostsLife(it.plan.kind)) {
          api.play("oops");
          msgEl.textContent = missWordFor(missReason(it.x, basketX, it.plan.vy), st.missed);
        }
        updateTop();
        if (st.over) {
          finish();
          return;
        }
      }
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

  function loop(): void {
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  function hold(sel: string, d: number): void {
    const btn = wrap.querySelector(sel) as HTMLButtonElement;
    jan.on(btn, "pointerdown", (ev: Event) => {
      ev.preventDefault();
      dir = d;
    });
    const stop = () => {
      if (dir === d) dir = 0;
    };
    jan.on(btn, "pointerup", stop);
    jan.on(btn, "pointerleave", stop);
    jan.on(btn, "pointercancel", stop);
  }
  hold(".frc-left", -1);
  hold(".frc-right", 1);

  let dragging = false;
  jan.on(canvas, "pointerdown", (ev: Event) => {
    const e = ev as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    dragging = true;
    basketX = clampBasket(((e.clientX - rect.left) / rect.width) * W);
  });
  jan.on(canvas, "pointermove", (ev: Event) => {
    if (!dragging) return;
    const e = ev as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    basketX = clampBasket(((e.clientX - rect.left) / rect.width) * W);
  });
  jan.on(window, "pointerup", () => {
    dragging = false;
  });
  jan.on(window, "keydown", (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      dir = -1;
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      dir = 1;
      e.preventDefault();
    } else if (e.key === "Escape") {
      back();
    }
  });
  jan.on(window, "keyup", (ev: Event) => {
    const k = (ev as KeyboardEvent).key;
    const left = k === "ArrowLeft" || k === "a" || k === "A";
    const right = k === "ArrowRight" || k === "d" || k === "D";
    if ((left && dir === -1) || (right && dir === 1)) dir = 0;
  });
  jan.on(wrap.querySelector(".frc-back") as HTMLButtonElement, "click", back);

  reset();
  draw();
  loop();

  return {
    destroy() {
      over = true;
      cancelAnimationFrame(raf);
      fx.clear();
      items.length = 0;
      recentCatch.length = 0;
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
  const bar = el("div", "frc-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const duoBtn = el<HTMLButtonElement>("button", "frc-open", "👫 双人抢果");
  duoBtn.type = "button";
  const rainBtn = el<HTMLButtonElement>("button", "frc-open", "♾️ 无尽水果雨");
  rainBtn.type = "button";
  bar.append(duoBtn, rainBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    rainBtn.textContent = best > 0 ? `♾️ 无尽水果雨 · 最好 ${best} 分` : "♾️ 无尽水果雨";
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

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  const onDuo = () => openMode(mountDuo);
  const onRain = () => openMode(mountRain);
  duoBtn.addEventListener("click", onDuo);
  rainBtn.addEventListener("click", onRain);
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来：360px 竖屏上果园要占满整宽
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
      guideTitle: "接住小水果 · 落点手册",
      mapHint: "一颗爱心都不掉就是 3 星，走最短路线最省时间！",
      grandMessage: "188 场水果雨全部接住，你的落点预判已经相当准了！"
    }
  );

  return {
    destroy() {
      duoBtn.removeEventListener("click", onDuo);
      rainBtn.removeEventListener("click", onRain);
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}
