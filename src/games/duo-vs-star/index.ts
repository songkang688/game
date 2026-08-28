import { meta } from "./meta";
export { meta };

/**
 * 朵朵大战星星 —— 全明星弹飞式派对混战。
 *
 * 五种模式共用同一个「擂台」组件：canvas 画场地、键盘 / 触屏出招、
 * 逻辑全部交给 battle.ts 的确定性状态机。
 *  · 双人对战：同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K
 *  · 人机混战：最多 4 人，小电脑三档
 *  · 团队赛：2v2，和队友一起把对面请出场
 *  · 无尽车轮战：赢一场换一个更强的对手
 *  · 闯关 188 关：走 level99 通用框架，十个主题章节
 */
import { AI_TIERS, STYLE_LABELS, emptyInput, type AiTier, type Input } from "./ai";
import { isPauseKey, isWatchedKey, readKeys } from "./keys";
import {
  ACTOR_R,
  RESPAWN_DELAY,
  coopTally,
  createMatch,
  leadIdle,
  safeZone,
  stepMatch,
  teamStats,
  type Actor,
  type FighterSlot,
  type MatchConfig,
  type MatchState,
} from "./battle";
import {
  animT,
  drawBelt,
  drawCharBody,
  drawCharFace,
  drawCracks,
  drawFluffyCloud,
  drawGoldStar,
  drawHiddenPlatform,
  drawIceDetail,
  drawItem,
  drawItemIcon,
  drawPlatformBase,
  drawSparkle,
  drawSprings,
  drawMidgroundBand,
  drawStageDecor,
  drawSyrupBubbles,
  drawTeamRing,
  tiltAngle,
  type FaceMood,
} from "./art";
import {
  bumpTier,
  hitStopFrames,
  hitStopSeconds,
  vigorLabel,
  vigorOf,
} from "./knockback";
import {
  COOP_LESSONS,
  lessonCleared,
  lessonProgress,
  rateLesson,
  type CoopLesson,
} from "./coop";
import { itemById } from "./items";
import {
  CHAPTERS,
  LEVELS,
  endlessBonusStars,
  endlessFoe,
  endlessStage,
  levelAt,
  rateLevel,
} from "./levels";
import { ROSTER, TEAM_COLORS, TEAM_NAMES, fighterById, shortName } from "./roster";
import { STAGES, WORLD_H, WORLD_W, platformAt, stageById, syrupLevel } from "./stages";
import GUIDE from "./guide";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function reduceMotion(): boolean {
  try {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** 玩家这一局挑的角色（换了之后本次进入游戏一直记着） */
let pickP1 = "duoduo";
let pickP2 = "xingxing";

/**
 * 合作特训通过了哪几课。1.2 新增的 key，老存档没有它读出来就是空集合，
 * 既有的 key 一个都没动。
 */
export const COOP_DONE_KEY = "yiduo-yixing.duo-vs-star.coop.v1";

function readCoopDone(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(COOP_DONE_KEY);
    if (!raw) return new Set();
    const list: unknown = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function markCoopDone(id: string): void {
  try {
    const done = readCoopDone();
    if (done.has(id)) return;
    done.add(id);
    globalThis.localStorage?.setItem(COOP_DONE_KEY, JSON.stringify(Array.from(done)));
  } catch {
    // 隐私模式下写不进去就算了，课程照样能上
  }
}

/* ------------------------------------------------------------------ */
/* 样式                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.dvs-wrap{max-width:720px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  user-select:none;-webkit-user-select:none;position:relative;}
.dvs-menu{border-radius:20px;padding:14px;background:linear-gradient(180deg,#fff2f8,#eef2ff);}
.dvs-title{text-align:center;font-size:19px;font-weight:900;color:#b0538c;margin:2px 0 4px;}
.dvs-sub{text-align:center;font-size:13.5px;font-weight:700;color:#7b6aa0;line-height:1.6;margin:0 0 10px;}
.dvs-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;}
.dvs-mode{border:none;border-radius:16px;padding:13px 10px;cursor:pointer;font-family:inherit;text-align:left;
  background:#fff;box-shadow:0 4px 10px rgba(150,120,190,.18);}
.dvs-mode:active{transform:translateY(2px);}
.dvs-mode b{display:block;font-size:15.5px;color:#6b4a94;margin-bottom:3px;}
.dvs-mode span{display:block;font-size:12.5px;color:#8a7aa6;line-height:1.5;}
.dvs-keys{margin-top:12px;border-radius:14px;background:#ffffffcc;padding:10px 12px;font-size:12.5px;
  color:#7b6aa0;font-weight:700;line-height:1.8;}
.dvs-keys b{color:#b0538c;}
.dvs-pickrow{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0 2px;}
.dvs-pick{border:none;border-radius:999px;padding:6px 11px;font-size:13px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#6b5a90;box-shadow:0 2px 5px rgba(140,120,190,.2);}
.dvs-pick.on{outline:3px solid #ff9ec4;color:#b0538c;}
.dvs-picklabel{text-align:center;font-size:12.5px;font-weight:800;color:#8a7aa6;margin-top:8px;}
.dvs-tierrow{display:flex;gap:6px;justify-content:center;margin:4px 0;flex-wrap:wrap;}
.dvs-go{display:block;width:100%;margin-top:12px;border:none;border-radius:18px;padding:13px;font-size:17px;
  font-weight:900;color:#fff;cursor:pointer;font-family:inherit;
  background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 5px 0 #8f2c5c;}
.dvs-go:active{transform:translateY(3px);box-shadow:0 2px 0 #8f2c5c;}
.dvs-back{border:none;border-radius:999px;padding:7px 13px;font-size:13.5px;font-weight:900;cursor:pointer;
  background:#ffffffd9;color:#7a5aa0;box-shadow:0 3px 0 rgba(120,90,160,.25);font-family:inherit;white-space:nowrap;}
.dvs-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}

.dvs-arena{border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(150,130,200,.18);}
.dvs-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#ffe8f2;flex-wrap:wrap;}
.dvs-bartitle{flex:1;text-align:center;font-size:14px;font-weight:900;color:#5c4a7d;min-width:110px;}
.dvs-canvas{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#dff0ff;touch-action:none;}
.dvs-cards{display:flex;gap:6px;padding:8px;flex-wrap:wrap;justify-content:center;}
.dvs-card{flex:1 1 120px;min-width:112px;border-radius:14px;padding:7px 9px;background:#fff;
  box-shadow:0 2px 7px rgba(140,120,190,.2);}
.dvs-card-head{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:900;color:#5c4a7d;}
.dvs-card-head .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;}
.dvs-card-head .who{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dvs-meter{height:8px;border-radius:99px;background:#eee6f5;overflow:hidden;margin:5px 0 3px;}
.dvs-meter i{display:block;height:100%;width:0;border-radius:99px;background:#8fd6a4;transition:width .12s linear;}
.dvs-card-foot{display:flex;justify-content:space-between;gap:4px;font-size:11.5px;font-weight:800;color:#8a7aa6;}
.dvs-card-foot .vg{white-space:nowrap;}
.dvs-card-foot .vg b{font-variant-numeric:tabular-nums;}
.dvs-hint{text-align:center;font-size:12.5px;font-weight:700;color:#8a7aa6;padding:0 8px 8px;min-height:18px;}

.dvs-pads{display:flex;justify-content:space-between;gap:8px;padding:0 8px 10px;}
.dvs-pad{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.dvs-pad button{border:none;border-radius:14px;min-width:46px;min-height:46px;font-size:18px;font-weight:900;
  font-family:inherit;background:#ffffffe6;color:#6b5a90;box-shadow:0 3px 0 rgba(120,90,160,.22);cursor:pointer;
  touch-action:none;}
.dvs-pad button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.22);}
.dvs-pad .hit{background:#ffd9e8;color:#b0538c;}
.dvs-pad .big{background:#ffc7dd;color:#95356d;}
.dvs-pad .duo{background:#d8f0dd;color:#3f7a55;}
.dvs-padname{font-size:11.5px;font-weight:900;color:#8a7aa6;width:100%;text-align:center;}
.dvs-lesson{display:grid;gap:8px;margin-top:6px;}
.dvs-lessonbtn{border:none;border-radius:16px;padding:11px 12px;cursor:pointer;font-family:inherit;text-align:left;
  background:#fff;box-shadow:0 4px 10px rgba(150,120,190,.18);}
.dvs-lessonbtn b{display:block;font-size:15px;color:#6b4a94;margin-bottom:3px;}
.dvs-lessonbtn span{display:block;font-size:12.5px;color:#8a7aa6;line-height:1.5;}
.dvs-lessonbtn:active{transform:translateY(2px);}

.dvs-over{position:absolute;inset:0;background:rgba(255,250,253,.95);border-radius:20px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;text-align:center;padding:18px;}
.dvs-over .big{font-size:46px;line-height:1;}
.dvs-over .ttl{font-size:21px;font-weight:900;color:#8a5aa8;}
.dvs-over .sub{font-size:14.5px;font-weight:700;color:#77619b;line-height:1.6;max-width:330px;}
.dvs-over .row{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;}
.dvs-over button{border:none;border-radius:16px;padding:11px 22px;font-size:15.5px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 4px 0 #8f2c5c;}
.dvs-over button.ghost{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a;}
.dvs-over button:active{transform:translateY(2px);}
.dvs-hidden{display:none;}
@media (max-width:420px){
  .dvs-title{font-size:17px;}
  .dvs-card{min-width:96px;padding:6px;}
  .dvs-pad button{min-width:42px;min-height:42px;font-size:16px;}
}
/* 360px 的小屏：HUD 折成两行、两个人的触屏键上下摞着放，一个像素都不许溢出 */
@media (max-width:380px){
  .dvs-wrap{max-width:100%;}
  .dvs-menu{padding:10px;}
  .dvs-sub{font-size:12.5px;}
  .dvs-modes{grid-template-columns:1fr;}
  .dvs-card{flex:1 1 calc(50% - 6px);min-width:0;}
  .dvs-card-head{font-size:12px;}
  .dvs-card-foot{font-size:10.5px;}
  .dvs-pads{flex-direction:column;gap:6px;padding:0 6px 8px;}
  /* r2 修复 W4R2-05:触控键回到 40px 触区底线;改收 gap(6→4)保住零溢出——
     360px 下 7 键一行 7×40+6×4=304px,加两侧 6px 内边距 316px<360;320px 下 304≤308 也放得下 */
  .dvs-pad{justify-content:center;gap:4px;}
  .dvs-pad button{min-width:40px;min-height:40px;font-size:15px;border-radius:12px;}
  .dvs-pick{padding:5px 9px;font-size:12px;}
}
@media (prefers-reduced-motion:reduce){
  .dvs-meter i{transition:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 擂台组件                                                            */
/* ------------------------------------------------------------------ */

interface ArenaOptions {
  config: MatchConfig;
  /** 顶部标题 */
  title: string;
  /** 底部一句话提示 */
  hint?: string;
  /** 玩家操作的槽位：{ p1: 0 } / { p1: 0, p2: 1 } */
  human: { p1?: number; p2?: number };
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  /** 一局结束（含胜负）时回调 */
  onEnd: (state: MatchState) => void;
  /** 顶部返回按钮；不给就不显示 */
  onExit?: () => void;
  /**
   * 额外的过关条件（合作特训用）：返回 true 就当这一局圆满结束。
   * 不给就只按「把对手请出场 / 时间到」判。
   */
  goal?: (state: MatchState) => boolean;
  /** 每帧刷新的一句话进度（合作特训显示「顶举 1/3」） */
  progress?: (state: MatchState) => string;
}

interface Burst {
  x: number;
  y: number;
  t: number;
  /** 命中星屑 / 重击冲击圈 / 护盾水圈 / 配合喝彩底板 / 出界底板 / 道具图标 */
  kind: "hit" | "heavy" | "block" | "cheer" | "ko" | "item";
  /** 圆角底板上的短句（全部是文字，不再用 emoji 字符占位） */
  text?: string;
  color: string;
  /** kind = "item" 时画哪种道具的图标 */
  itemId?: string;
}

/** 落地压扁演出多长（秒），只影响画法不影响判定 */
const SQUASH_TIME = 0.15;

/** 画布显示高的下限:比这更矮台子和四个人就看不清了,低于它宁可交给舞台滚动 */
export const MIN_CANVAS_DISPLAY_PX = 150;

/**
 * 画布该「显示」多高(null = 原生高度就装得下,一个样式都不用写)。
 *
 * 画布是 `width:100%; height:auto` 的 16:9 replaced 元素——横屏 640×360 上
 * 显示高 ~356px,而 `.game-stage` 的可视高只剩 ~280px:画布下半截连同
 * 触屏按钮排(纯触屏唯一的输入)一起掉在裁切线以下。
 * 量出真实余量后钳一条 `max-height`:浏览器按内在比例连宽一起等比收,不变形;
 * 判定都在世界坐标里,显示缩放一个数都不碰。
 */
export function canvasDisplayCapPx(
  nativeH: number,
  roomPx: number,
  min = MIN_CANVAS_DISPLAY_PX
): number | null {
  if (!Number.isFinite(nativeH) || nativeH <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const cap = Math.floor(roomPx);
  // 差一个像素以内不算超:亚像素抖动不值得为它改样式
  if (nativeH <= cap + 1) return null;
  return Math.max(min, cap);
}

/** 出界演出的小星星：从出界那一点朝四周飞散开 */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

/** 出界演出撒几颗小星星 */
const STARBURST_COUNT = 9;
/** 小星星飞多久（秒） */
const STARBURST_LIFE = 0.75;

interface Arena {
  root: HTMLElement;
  destroy: () => void;
  pause: () => void;
}

function mountArena(opts: ArenaOptions): Arena {
  const soft = reduceMotion();
  let state = createMatch(opts.config);
  let raf = 0;
  let last = 0;
  let destroyed = false;
  let paused = false;
  let ended = false;
  let cleared = false;
  /** 命中顿帧还剩多少秒（弱化动效下永远是 0） */
  let hitStop = 0;
  const bursts: Burst[] = [];
  const sparks: Spark[] = [];
  /** 每位角色落地压扁演出的剩余秒数（纯演出，soft 时不用） */
  const landSquash: number[] = state.actors.map(() => 0);
  const wasGround: boolean[] = state.actors.map(() => false);
  const timers = new Set<number>();

  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  const root = el("div", "dvs-arena");
  const bar = el("div", "dvs-bar");
  if (opts.onExit) bar.appendChild(button("dvs-back", "◀ 返回", () => opts.onExit?.()));
  const title = el("div", "dvs-bartitle", opts.title);
  bar.appendChild(title);
  bar.appendChild(button("dvs-back", "⏸ 暂停", () => togglePause()));
  root.appendChild(bar);

  const canvas = el("canvas", "dvs-canvas");
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const cards = el("div", "dvs-cards");
  root.appendChild(cards);
  const hint = el("div", "dvs-hint", opts.hint ?? "");
  root.appendChild(hint);

  const cardEls = state.actors.map((a) => {
    const card = el("div", "dvs-card");
    const head = el("div", "dvs-card-head");
    const dot = el("span", "dot");
    dot.style.background = TEAM_COLORS[a.team % TEAM_COLORS.length];
    // 360px 上四张名牌要并排放得下，长名字先缩写
    const who = el("span", "who", `${a.char.emoji} ${shortName(a.char.name)}`);
    who.title = a.char.name;
    head.append(dot, who);
    const meter = el("div", "dvs-meter");
    const fill = el("i");
    meter.appendChild(fill);
    const foot = el("div", "dvs-card-foot");
    const left = el("span", "vg");
    const num = el("b");
    const word = el("span");
    left.append(num, word);
    const right = el("span", undefined, "");
    foot.append(left, right);
    card.append(head, meter, foot);
    cards.appendChild(card);
    return { fill, num, word, right, who };
  });

  /* ---- 输入 ---- */
  const pressed = new Set<string>();
  const padP1 = emptyInput();
  const padP2 = emptyInput();

  function inputFor(which: "p1" | "p2"): Input {
    return readKeys(pressed, which, which === "p1" ? padP1 : padP2);
  }

  function collectInputs(): Record<number, Input> {
    const out: Record<number, Input> = {};
    if (opts.human.p1 !== undefined) out[opts.human.p1] = inputFor("p1");
    if (opts.human.p2 !== undefined) out[opts.human.p2] = inputFor("p2");
    return out;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (isPauseKey(e.key)) {
      // 接住 Esc 并 preventDefault：壳层看到就不会再弹一次它自己的暂停面板
      e.preventDefault();
      togglePause();
      return;
    }
    if (!isWatchedKey(e.code)) return;
    // 方向键会滚动页面，空格键会点到按钮，这里统统拦下来
    e.preventDefault();
    pressed.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (isWatchedKey(e.code)) pressed.delete(e.code);
  }
  function onBlur(): void {
    pressed.clear();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  /* ---- 触屏按键 ---- */
  const pads = el("div", "dvs-pads");
  root.appendChild(pads);

  function makePad(which: "p1" | "p2", name: string): HTMLElement {
    const pad = el("div", "dvs-pad");
    const label = el("div", "dvs-padname", name);
    pad.appendChild(label);
    const target = which === "p1" ? padP1 : padP2;
    // 每个按键管住哪几个方向：🤝 一个键同时按下「下 + 重击」，
    // 手机上就不用两根手指去凑接应那一下了
    const keys: Array<{ face: string; keys: Array<keyof Input>; cls?: string; label: string }> = [
      { face: "◀", keys: ["left"], label: "往左走" },
      { face: "▲", keys: ["up"], label: "跳（头顶有队友就是顶举）" },
      { face: "▼", keys: ["down"], label: "蹲下 / 从软平台落下去" },
      { face: "▶", keys: ["right"], label: "往右走" },
      { face: "✋", keys: ["light"], cls: "hit", label: "挥击" },
      { face: "💥", keys: ["heavy"], cls: "big", label: "重击" },
      { face: "🤝", keys: ["down", "heavy"], cls: "duo", label: "接应队友" },
    ];
    // 🤝 和 ▼ / 💥 共用按键位，按住数记个数，松开一个不会把另一个也松掉
    const held = new Map<keyof Input, number>();
    const sync = (k: keyof Input): void => {
      target[k] = (held.get(k) ?? 0) > 0;
    };
    for (const spec of keys) {
      const b = el("button", spec.cls, spec.face);
      b.type = "button";
      b.setAttribute("aria-label", `${name} ${spec.label}`);
      let down = false;
      const on = (e: Event): void => {
        e.preventDefault();
        if (down) return;
        down = true;
        for (const k of spec.keys) {
          held.set(k, (held.get(k) ?? 0) + 1);
          sync(k);
        }
      };
      const off = (): void => {
        if (!down) return;
        down = false;
        for (const k of spec.keys) {
          held.set(k, Math.max(0, (held.get(k) ?? 0) - 1));
          sync(k);
        }
      };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off);
      b.addEventListener("pointercancel", off);
      pad.appendChild(b);
    }
    return pad;
  }

  if (opts.human.p1 !== undefined) {
    pads.appendChild(makePad("p1", `${state.actors[opts.human.p1].char.name} 1P`));
  }
  if (opts.human.p2 !== undefined) {
    pads.appendChild(makePad("p2", `${state.actors[opts.human.p2].char.name} 2P`));
  }

  /* ---- 暂停 / 结算浮层 ---- */
  let overlay: HTMLElement | null = null;

  function clearOverlay(): void {
    overlay?.remove();
    overlay = null;
  }

  function showOverlay(
    big: string,
    ttl: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    clearOverlay();
    const ov = el("div", "dvs-over");
    ov.append(el("div", "big", big), el("div", "ttl", ttl), el("div", "sub", sub));
    const row = el("div", "row");
    for (const b of buttons) {
      const btn = button(b.ghost ? "ghost" : "", b.label, b.onClick);
      row.appendChild(btn);
    }
    ov.appendChild(row);
    root.appendChild(ov);
    overlay = ov;
    ov.querySelector("button")?.focus?.();
  }

  function togglePause(): void {
    if (ended || destroyed) return;
    paused = !paused;
    if (paused) {
      opts.sfx("tap");
      showOverlay("⏸️", "先歇一会儿", "喘口气再来！键盘按 Esc 也可以继续。", [
        { label: "继续 ▶", onClick: () => togglePause() },
        { label: "🔁 重来一局", ghost: true, onClick: () => restart() },
        ...(opts.onExit ? [{ label: "🚪 退出", ghost: true, onClick: () => opts.onExit?.() }] : []),
      ]);
    } else {
      clearOverlay();
      last = 0;
    }
  }

  function restart(): void {
    clearOverlay();
    paused = false;
    ended = false;
    cleared = false;
    hitStop = 0;
    bursts.length = 0;
    sparks.length = 0;
    landSquash.fill(0);
    wasGround.fill(false);
    state = createMatch({ ...opts.config, seed: (opts.config.seed + 1013) >>> 0 });
    last = 0;
    opts.sfx("jump");
  }

  /** 出界演出：从出界那一点撒一圈五角星飞走（弱化动效时数量减半） */
  function starburst(x: number, y: number): void {
    const n = soft ? Math.ceil(STARBURST_COUNT / 2) : STARBURST_COUNT;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n;
      const speed = 180 + (i % 3) * 45;
      sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, t: 0 });
    }
  }

  /* ---- 事件转成看得见的反馈（全部绘制粒子 / 底板字，不再飘 emoji） ---- */
  function drainEvents(): void {
    for (const e of state.events) {
      if (e.kind === "hit") {
        bursts.push({ x: e.x, y: e.y, t: 0, kind: e.heavy ? "heavy" : "hit", color: "#ffb937" });
        // 打中那一下卡几帧，重击更沉手；弱化动效时 hitStopFrames 恒返回 0
        const speed = Math.hypot(state.actors[e.actor].vx, state.actors[e.actor].vy);
        hitStop = Math.max(hitStop, hitStopSeconds(hitStopFrames(speed, e.heavy, soft)));
        opts.sfx(e.heavy ? "pop" : "tap");
      } else if (e.kind === "block") {
        bursts.push({ x: e.x, y: e.y, t: 0, kind: "block", color: "#7fb2ff" });
      } else if (e.kind === "pop") {
        opts.sfx("oops");
      } else if (e.kind === "struggle") {
        bursts.push({ x: e.x, y: e.y, t: 0, kind: "cheer", text: "挣脱！", color: "#3f7a55" });
        opts.sfx("jump");
      } else if (e.kind === "lift") {
        bursts.push({ x: e.x, y: e.y, t: 0, kind: "cheer", text: "顶举！", color: "#3f7a55" });
        opts.sfx("coin");
      } else if (e.kind === "catch") {
        bursts.push({ x: e.x, y: e.y, t: 0, kind: "cheer", text: "接住！", color: "#3f7a55" });
        opts.sfx("coin");
      } else if (e.kind === "ko") {
        const who = state.actors[e.actor];
        bursts.push({ x: e.x, y: e.y, t: 0, kind: "ko", text: `${who.char.name}出界啦`, color: "#c2497e" });
        starburst(e.x, e.y);
        opts.sfx("oops");
      } else if (e.kind === "item") {
        const def = itemById(e.item);
        bursts.push({
          x: e.x,
          y: e.y,
          t: 0,
          kind: "item",
          itemId: e.item,
          text: def?.name,
          color: "#3f7a55",
        });
        opts.sfx("coin");
      } else if (e.kind === "respawn") {
        opts.sfx("jump");
      } else if (e.kind === "syrup") {
        opts.sfx("meow");
      } else if (e.kind === "end") {
        onMatchEnd();
      }
    }
  }

  function onMatchEnd(): void {
    if (ended) return;
    ended = true;
    later(() => opts.onEnd(state), 700);
  }

  /** 合作特训：配合动作做够了就当这一局圆满结束 */
  function checkGoal(): void {
    if (cleared || ended || !opts.goal) return;
    if (!opts.goal(state)) return;
    cleared = true;
    state.over = true;
    state.winnerTeam = 0;
    state.endReason = "ko";
    opts.sfx("win");
    onMatchEnd();
  }

  /* ---- HUD ---- */
  function paintCards(): void {
    state.actors.forEach((a, i) => {
      const c = cardEls[i];
      // 元气一条数据两条通道：进度条的长度与颜色给一眼看，数字给看得准
      const vigor = Math.round(vigorOf(a.bump));
      c.fill.style.width = `${Math.max(0, Math.min(100, vigor))}%`;
      const tier = bumpTier(a.bump);
      c.fill.style.background = tier === 0 ? "#8fd6a4" : tier === 1 ? "#ffd166" : "#ff8fbe";
      if (a.retired) {
        c.num.textContent = "";
        c.word.textContent = "场边加油中";
      } else {
        c.num.textContent = `元气 ${vigor}`;
        c.word.textContent = ` ${vigorLabel(vigor)}`;
      }
      const chances = a.retired ? "" : "☁️".repeat(Math.min(4, a.stocks));
      const hammer = a.buffs.hammer > 0 ? (a.buffs.hammerCharge > 0 ? " 🔨…" : " 🔨") : "";
      c.right.textContent = `${chances}${a.shield > 0 ? " 🫧" : ""}${hammer}`;
    });
  }

  /* ---- 绘制 ---- */
  let cssW = 0;
  let cssH = 0;

  /** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;

  /** 往上找平台舞台(.game-stage,定高会裁内容)的下沿;量不到返回 NaN */
  function stageClipBottom(): number {
    let node: HTMLElement | null = root.parentElement ?? null;
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
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  /** 画布显示高按可视余量钳一刀(见 canvasDisplayCapPx 的注释) */
  function fitDisplay(): void {
    if (!canvas.style) return;
    if (typeof canvas.getBoundingClientRect !== "function" || typeof root.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom();
    if (!Number.isFinite(clip)) return;
    // 先摘掉上一次的钳位再量:量到的必须是「本来要多高」
    canvas.style.maxHeight = "";
    canvas.style.maxWidth = "";
    const canvasRect = canvas.getBoundingClientRect();
    if (!Number.isFinite(canvasRect.top)) return;
    // 画布下面的家当(名牌 / 提示 / 触屏按钮排):高度不随画布显示高变,量一次就是稳的
    const below = Math.max(0, rectBottom(root.getBoundingClientRect()) - rectBottom(canvasRect));
    const px = canvasDisplayCapPx(canvasRect.height, clip - canvasRect.top - below - 4);
    if (px !== null) {
      // CSS 里画布是 width:100%,只钳高会压扁画面;宽也按 16:9 一起钳才是等比
      canvas.style.maxHeight = `${px}px`;
      canvas.style.maxWidth = `${Math.round((px * WORLD_W) / WORLD_H)}px`;
      // 等比收窄后画布居中,别贴在左边
      canvas.style.marginLeft = "auto";
      canvas.style.marginRight = "auto";
    }
  }

  function resize(): void {
    if (!ctx) return;
    // 先钳显示高,再按钳完的显示宽定 backing,比例才对得上
    fitDisplay();
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, rect.width || 320);
    const h = w * (WORLD_H / WORLD_W);
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function draw(): void {
    if (!ctx) return;
    if (cssW <= 0) resize();
    const scale = (canvas.width / WORLD_W) || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);

    // 屏幕轻微抖动（弱化动效时不抖）
    if (!soft && state.shake > 0.02) {
      const s = state.shake * 6;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const stage = state.stage;
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    sky.addColorStop(0, stage.sky[0]);
    sky.addColorStop(1, stage.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(-30, -30, WORLD_W + 60, WORLD_H + 60);

    // 中景剪影带(r2 · B档TOP4):平台不再悬在「一张纸」前面
    drawMidgroundBand(ctx, stage.id, WORLD_W, WORLD_H, stage.sky[1]);
    // 场地主题装饰层（云朵 / 齿轮 / 风车 / 月牙……soft 时全部定格）
    drawStageDecor(ctx, stage.id, WORLD_W, WORLD_H, animT(state.t, soft), stage.sky[0]);

    // 咕嘟糖浆池：保留 1.2 的波浪，再加几粒上浮的小气泡
    const syrup = syrupLevel(stage, state.t);
    if (Number.isFinite(syrup)) {
      ctx.fillStyle = "#ffcf8f";
      ctx.fillRect(-30, syrup, WORLD_W + 60, WORLD_H + 60 - syrup);
      ctx.fillStyle = "#ffe1b5";
      for (let x = -20; x < WORLD_W + 30; x += 46) {
        ctx.beginPath();
        ctx.arc(x + Math.sin(state.t * 1.6 + x) * 6, syrup, 13, Math.PI, 0);
        ctx.fill();
      }
      drawSyrupBubbles(ctx, syrup, WORLD_H, animT(state.t, soft));
    }

    // 平台：顶面高光 + 底面投影，机制各有专属画法（数据一个都没动）
    stage.platforms.forEach((p, i) => {
      const st = state.plats[i];
      if (st.hidden) {
        drawHiddenPlatform(ctx, st.x, st.y, p.w, p.h);
        return;
      }
      const wobble = p.collapse ? Math.max(0, st.standT / p.collapse) : 0;
      ctx.save();
      if (wobble > 0.5 && !soft) ctx.translate(Math.sin(state.t * 30) * wobble * 2, 0);
      drawPlatformBase(ctx, st.x, st.y, p.w, p.h, p.color ?? "#ffe3f0");
      if (p.drift) drawBelt(ctx, st.x, st.y, p.w, p.h, p.drift, animT(state.t, soft));
      if (p.bounce) drawSprings(ctx, st.x, st.y, p.w, p.h);
      if (p.ice) drawIceDetail(ctx, st.x, st.y, p.w, p.h);
      // 会塌的台子：站得越久裂纹越多
      if (wobble > 0.15) drawCracks(ctx, st.x, st.y, p.w, p.h, Math.ceil(wobble * 3));
      ctx.restore();
    });

    // 道具：泡壳 + 绘制图标（漂浮节奏与 1.2 相同）
    for (const it of state.items) {
      const bob = soft ? 0 : Math.sin(state.t * 5 + it.id) * 3;
      drawItem(ctx, it.def.id, it.x, it.y + bob, 17);
    }

    // 角色
    for (const a of state.actors) {
      if (!a.onStage) {
        if (!a.retired) drawWaiting(ctx, a);
        continue;
      }
      drawActor(ctx, a);
    }

    // 出界演出：金渐变五角星旋转着飞散（不再是 "⭐" 字符）
    for (const p of sparks) {
      const k = 1 - p.t / STARBURST_LIFE;
      if (k <= 0) continue;
      ctx.globalAlpha = k;
      drawGoldStar(ctx, p.x, p.y, 5 + k * 6, animT(p.t, soft) * 7 + p.vx * 0.01);
      ctx.globalAlpha = 1;
    }

    // 特效：星屑爆点 / 冲击圈 / 圆角底板短句
    for (const b of bursts) {
      const k = 1 - b.t / 0.7;
      if (k <= 0) continue;
      const rise = (1 - k) * 26;
      ctx.globalAlpha = k;
      if (b.kind === "hit" || b.kind === "heavy") {
        // 轻击 3 粒星屑、重击 5 粒 + 白色冲击圈
        const n = b.kind === "heavy" ? 5 : 3;
        const spread = 10 + (1 - k) * 26;
        for (let i = 0; i < n; i++) {
          const a2 = (Math.PI * 2 * i) / n + 0.7;
          drawGoldStar(
            ctx,
            b.x + Math.cos(a2) * spread,
            b.y + Math.sin(a2) * spread * 0.8,
            4 + k * 3,
            a2 + (1 - k) * 2
          );
        }
        if (b.kind === "heavy") {
          ctx.strokeStyle = "rgba(255,255,255,.9)";
          ctx.lineWidth = Math.max(1, 3 * k);
          ctx.beginPath();
          ctx.arc(b.x, b.y, 8 + (1 - k) * 34, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (b.kind === "block") {
        // 护盾荡开的双层水圈
        ctx.strokeStyle = "rgba(130,190,255,.9)";
        ctx.lineWidth = Math.max(1, 3 * k);
        ctx.beginPath();
        ctx.arc(b.x, b.y, 12 + (1 - k) * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8 + (1 - k) * 14, 0, Math.PI * 2);
        ctx.stroke();
      } else if (b.kind === "item" && b.itemId) {
        drawItemIcon(ctx, b.itemId, b.x, b.y - rise, 10 + (1 - k) * 4);
      }
      if (b.text) {
        // 圆角底板 + 彩字（挣脱 / 顶举 / 接住 / 出界 / 道具名）
        const w = b.text.length * 14 + 12;
        const plateY = b.y - rise - (b.kind === "item" ? 36 : 10);
        ctx.fillStyle = "rgba(255,255,255,.92)";
        roundRect(ctx, b.x - w / 2, plateY, w, 20, 9);
        ctx.fill();
        ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, b.x, plateY + 10);
      }
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawWaiting(c: CanvasRenderingContext2D, a: Actor): void {
    const zone = safeZone(state.stage);
    const x = (zone.min + zone.max) / 2;
    const y = 60;
    // 蓬蓬云（绘制的，不是 ☁️ 字符）+ 坐在云上的小头像 + 倒计时进度弧
    drawFluffyCloud(c, x, y + 14, 64);
    drawCharBody(c, a.char.color, x, y - 8, 13);
    drawCharFace(c, a.char.id, x, y - 8, 13, "happy", 0);
    const wait = Math.max(0, Math.min(1, 1 - a.respawn / RESPAWN_DELAY));
    c.strokeStyle = TEAM_COLORS[a.team % TEAM_COLORS.length];
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    c.arc(x, y - 2, 27, -Math.PI / 2, -Math.PI / 2 + wait * Math.PI * 2);
    c.stroke();
    c.font = "bold 13px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#7b6aa0";
    c.fillText(`${a.char.name} 马上回来`, x, y + 36);
  }

  /** 角色脚下最近的平台顶（画投影用；没有就不画） */
  function groundYBelow(a: Actor): number | null {
    let best: number | null = null;
    for (let i = 0; i < state.stage.platforms.length; i++) {
      const p = state.stage.platforms[i];
      const st = state.plats[i];
      if (st.hidden) continue;
      if (a.x < st.x - 6 || a.x > st.x + p.w + 6) continue;
      if (st.y >= a.y && (best === null || st.y < best)) best = st.y;
    }
    return best;
  }

  function drawActor(c: CanvasRenderingContext2D, a: Actor): void {
    const r = a.buffs.mini > 0 ? ACTOR_R * 0.7 : ACTOR_R;
    c.save();
    if (a.safe > 0 && !soft && Math.floor(state.t * 10) % 2 === 0) c.globalAlpha = 0.55;
    else if (a.safe > 0 && soft) c.globalAlpha = 0.7;

    // 脚下投影：椭圆随离地高度缩小变淡（2D 里的层次感来源之一）
    const gy = groundYBelow(a);
    if (gy !== null) {
      const k = Math.max(0, 1 - (gy - a.y - r) / 240);
      if (k > 0.05) {
        c.fillStyle = `rgba(90,70,120,${(0.16 * k).toFixed(3)})`;
        c.beginPath();
        c.ellipse(a.x, gy + 2, r * (0.45 + 0.45 * k), 4, 0, 0, Math.PI * 2);
        c.fill();
      }
    }

    // 身体随速度微倾斜（≤8°）+ 落地压扁 0.15s（soft 全关）
    const squash = soft ? 0 : Math.min(1, landSquash[a.index] / SQUASH_TIME);
    const tilt = tiltAngle(a.vx, soft);
    if (tilt !== 0 || squash > 0) {
      c.translate(a.x, a.y + r);
      c.rotate(tilt);
      c.scale(1 + squash * 0.08, 1 - squash * 0.15);
      c.translate(-a.x, -(a.y + r));
    }

    // 队伍外环：颜色 + 线型双通道（色弱也分得开）
    drawTeamRing(c, TEAM_COLORS[a.team % TEAM_COLORS.length], a.team, a.x, a.y, r + 4);
    // 身体三层：径向渐变 + 底部阴影弧 + 描边
    drawCharBody(c, a.char.color, a.x, a.y, r);
    // 脸谱按状态查表（不再贴 emoji）；soft 时 t=0 就不眨眼
    const mood: FaceMood =
      a.buffs.dizzy > 0
        ? "dizzy"
        : a.stun > 0.05 || a.struggle > 0
          ? "hurt"
          : a.attack
            ? "attack"
            : "idle";
    drawCharFace(c, a.char.id, a.x, a.y, r, mood, soft ? 0 : state.t);

    // 眩晕：螺旋眼 + 头顶两颗小星公转（替代 💫 字符；soft 时定格）
    if (a.buffs.dizzy > 0) {
      const th = animT(state.t, soft) * 4;
      for (const off of [0, Math.PI]) {
        const sx = a.x + Math.cos(th + off) * (r * 0.9);
        const sy = a.y - r - 6 + Math.sin(th + off) * 4;
        drawGoldStar(c, sx, sy, 5, th + off);
      }
    }

    // 挥击「拳套弧线」：判定口径（圆心 / 半径）与 1.2 完全一致，只加装饰层
    if (a.attack) {
      const heavy = a.attack.kind === "heavy";
      const fx = a.x + a.facing * (r + 16);
      const fr = heavy ? 17 : 12;
      // 3 根弧形拖影线沿挥击方向展开
      c.strokeStyle = heavy ? "rgba(255,150,190,.55)" : "rgba(255,220,140,.6)";
      c.lineCap = "round";
      const mid = a.facing > 0 ? 0 : Math.PI;
      for (let i = 0; i < 3; i++) {
        c.lineWidth = 3 - i * 0.7;
        c.beginPath();
        c.arc(a.x, a.y, r + 10 + i * 7, mid - 0.55, mid + 0.55);
        c.stroke();
      }
      // 实心拳头（带体积的渐变球 + 指缝小弧）
      const g = c.createRadialGradient(fx - fr * 0.3, a.y - fr * 0.3, fr * 0.2, fx, a.y, fr);
      g.addColorStop(0, heavy ? "#ffd3e4" : "#fff3cf");
      g.addColorStop(1, heavy ? "rgba(255,150,190,.9)" : "rgba(255,220,140,.92)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(fx, a.y, fr, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(200,120,90,.45)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(fx - a.facing * fr * 0.3, a.y - fr * 0.2, fr * 0.4, Math.PI * 0.2, Math.PI * 0.9);
      c.stroke();
      // 重击附 4 芒冲击星
      if (heavy) drawSparkle(c, fx + a.facing * fr * 0.9, a.y - fr * 0.8, 7, "#ffffff");
    }
    // 护盾泡泡：双层圈 + 高光弧
    if (a.shield > 0) {
      c.strokeStyle = "rgba(130,190,255,.85)";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(a.x, a.y, r + 9, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,.6)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(a.x, a.y, r + 6, Math.PI * 1.1, Math.PI * 1.6);
      c.stroke();
    }
    // 挣扎窗口：白色圆角底板 + ←→（提示口径与 1.2 相同，只是更醒目）
    if (a.struggle > 0) {
      c.fillStyle = "rgba(255,255,255,.92)";
      roundRect(c, a.x - 22, a.y - r - 39, 44, 20, 9);
      c.fill();
      c.font = "bold 15px system-ui";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#3f7a55";
      c.fillText("←→", a.x, a.y - r - 29);
    }
    // 元气：颜色 + 数字两条通道，只看数字也不会误判（原样保留）
    const tier = bumpTier(a.bump);
    c.font = "bold 13px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = tier === 0 ? "#4b7a5c" : tier === 1 ? "#9a7020" : "#c2497e";
    c.fillText(`${Math.round(vigorOf(a.bump))}`, a.x, a.y - r - 12);
    c.restore();
  }

  /* ---- 主循环 ---- */
  function frame(now: number): void {
    if (destroyed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (hitStop > 0) {
      // 顿帧期间只冻结物理，特效和 HUD 照常走，画面不会看起来像卡住了
      hitStop = Math.max(0, hitStop - dt);
    } else if (!paused && !state.over) {
      stepMatch(state, dt, collectInputs());
      drainEvents();
      checkGoal();
      if (opts.progress) hint.textContent = opts.progress(state);
    }
    // 落地那一下的压扁演出：只记「刚踩到地」的时刻，判定完全不掺和
    state.actors.forEach((a, i) => {
      if (a.onStage && a.onGround && !wasGround[i]) landSquash[i] = SQUASH_TIME;
      wasGround[i] = a.onStage && a.onGround;
      landSquash[i] = Math.max(0, landSquash[i] - dt);
    });
    for (const b of bursts) b.t += dt;
    while (bursts.length && bursts[0].t > 0.7) bursts.shift();
    for (const p of sparks) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
    }
    while (sparks.length && sparks[0].t > STARBURST_LIFE) sparks.shift();
    paintCards();
    draw();
    raf = requestAnimationFrame(frame);
  }

  const onResize = (): void => resize();
  window.addEventListener("resize", onResize);
  resize();
  // 挂载那一刻可能还没排好版,量不准舞台余量;抽空补量一次
  later(() => resize(), 0);
  raf = requestAnimationFrame(frame);

  return {
    root,
    pause: () => {
      if (!paused) togglePause();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      // later() 排的是 window.setTimeout,清也要走 window 这本账(测试桩分开记)
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      clearOverlay();
      root.remove();
    },
  };
}

/** 结算浮层：谁赢了 */
function winnerText(state: MatchState): { big: string; ttl: string; sub: string } {
  if (state.winnerTeam === null) {
    return { big: "🤝", ttl: "打成平手！", sub: "两边都很厉害，再来一局分个高下？" };
  }
  const team = state.winnerTeam;
  const members = state.actors.filter((a) => a.team === team);
  const names = members.map((a) => `${a.char.emoji}${a.char.name}`).join(" + ");
  const stats = teamStats(state).find((t) => t.team === team);
  const sub =
    state.endReason === "time"
      ? `时间到，${TEAM_NAMES[team % TEAM_NAMES.length]}的上场机会剩得最多！`
      : `还剩 ${stats?.stocks ?? 0} 次上场机会，撞飞对手 ${stats?.kos ?? 0} 次。`;
  return { big: "🏆", ttl: `${names} 赢啦！`, sub };
}

/* ------------------------------------------------------------------ */
/* 各个模式                                                            */
/* ------------------------------------------------------------------ */

type Sfx = (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;

/** 角色选择行 */
function pickerRow(
  label: string,
  current: () => string,
  onPick: (id: string) => void,
  sfx: Sfx
): HTMLElement {
  const box = el("div");
  box.appendChild(el("div", "dvs-picklabel", label));
  const row = el("div", "dvs-pickrow");
  const buttons: HTMLButtonElement[] = [];
  for (const f of ROSTER) {
    const b = button("dvs-pick", `${f.emoji}${f.name}`, () => {
      sfx("tap");
      onPick(f.id);
      refresh();
    });
    b.title = f.tip;
    buttons.push(b);
    row.appendChild(b);
  }
  function refresh(): void {
    buttons.forEach((b, i) => b.classList.toggle("on", ROSTER[i].id === current()));
  }
  refresh();
  box.appendChild(row);
  return box;
}

/** 难度选择行 */
function tierRow(current: () => AiTier, onPick: (t: AiTier) => void, sfx: Sfx): HTMLElement {
  const box = el("div");
  box.appendChild(el("div", "dvs-picklabel", "小电脑的档次"));
  const row = el("div", "dvs-tierrow");
  const tiers: AiTier[] = ["easy", "normal", "hard"];
  const buttons = tiers.map((t) =>
    button("dvs-pick", `${AI_TIERS[t].label}`, () => {
      sfx("tap");
      onPick(t);
      refresh();
    })
  );
  function refresh(): void {
    buttons.forEach((b, i) => b.classList.toggle("on", tiers[i] === current()));
  }
  refresh();
  for (const b of buttons) row.appendChild(b);
  box.appendChild(row);
  return box;
}

/** 场地选择行 */
function stageRow(current: () => string, onPick: (id: string) => void, sfx: Sfx): HTMLElement {
  const box = el("div");
  box.appendChild(el("div", "dvs-picklabel", "挑一张场地"));
  const row = el("div", "dvs-pickrow");
  const buttons = STAGES.map((s) =>
    button("dvs-pick", `${s.emoji}${s.name}`, () => {
      sfx("tap");
      onPick(s.id);
      refresh();
    })
  );
  function refresh(): void {
    buttons.forEach((b, i) => b.classList.toggle("on", STAGES[i].id === current()));
  }
  refresh();
  for (const b of buttons) row.appendChild(b);
  box.appendChild(row);
  return box;
}

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

export function mount(api: GameApi): { destroy: () => void } {
  const sfx: Sfx = (name) => api.play(name);
  const wrap = el("div", "dvs-wrap");
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);
  const view = el("div");
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  let arena: Arena | null = null;
  let level: { destroy: () => void } | null = null;
  let destroyed = false;

  function clearView(): void {
    arena?.destroy();
    arena = null;
    level?.destroy();
    level = null;
    view.innerHTML = "";
  }

  /* ---------------- 首屏：模式菜单 ---------------- */

  function showMenu(): void {
    clearView();
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "💥 朵朵大战星星 · 全明星弹飞混战"));
    menu.appendChild(
      el(
        "div",
        "dvs-sub",
        "挨一下不会怎么样，只会让「击退值」越涨越高——值越高被撞飞得越远，把对手送出场地四周的弹飞线就得一分。掉出去的人会坐着小云朵回来，上场机会用完就到场边加油。"
      )
    );

    const modes = el("div", "dvs-modes");
    const list: Array<[string, string, () => void]> = [
      ["👫 双人对战", "同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K", () => showVersus()],
      ["🤖 人机混战", "最多 4 人一起打，小电脑有轻松 / 正常 / 高手三档", () => showBrawl()],
      ["🤝 团队赛 2v2", "你和队友一队，配合把对面两位请出场", () => showTeam()],
      ["🙌 合作特训 3 课", "顶举和接应，两个人一起才做得到，一个人怎么按都过不了", () => showCoop()],
      ["♾️ 无尽车轮战", "赢一场换一个更强的对手，看你能连胜几场", () => showEndless()],
      ["🗺️ 闯关 188 关", "十个主题章节，每关有指定场地、对手和特别规则", () => showCampaign()],
    ];
    for (const [name, desc, go] of list) {
      const b = el("button", "dvs-mode");
      b.type = "button";
      b.append(el("b", undefined, name), el("span", undefined, desc));
      b.addEventListener("click", () => {
        sfx("jump");
        go();
      });
      modes.appendChild(b);
    }
    menu.appendChild(modes);

    const keys = el("div", "dvs-keys");
    keys.innerHTML =
      "<b>键盘</b>：朵朵 <b>W A S D</b> 走动 + <b>F</b> 挥击 + <b>G</b> 重击；" +
      "星星 <b>↑ ← ↓ →</b> 走动 + <b>L</b> 挥击 + <b>K</b> 重击；<b>Esc</b> 暂停。<br>" +
      "<b>手机 / 平板</b>：屏幕下方每人一组按键，和键盘完全一样，<b>🤝</b> 一个键就是接应。<br>" +
      "<b>配合</b>：队友踩在你头顶时按「上」把他<b>顶举</b>上去；队友飘到场边外面，按「下 + 重击」<b>接应</b>他回来。<br>" +
      "<b>小技巧</b>：轻击把对方的元气磨下去，等数字变红了再来一记重击；" +
      "自己元气见底被打飞时，头顶会亮起 ←→，这 0.4 秒里朝场地里按方向键就能挣回来大半。";
    menu.appendChild(keys);
    view.appendChild(menu);
  }

  /* ---------------- 通用：开一局 ---------------- */

  function playMatch(
    config: MatchConfig,
    title: string,
    human: { p1?: number; p2?: number },
    hint: string,
    onDone: (state: MatchState) => void,
    onExit: () => void
  ): void {
    clearView();
    arena = mountArena({
      config,
      title,
      hint,
      human,
      sfx,
      onExit,
      onEnd: (state) => onDone(state),
    });
    view.appendChild(arena.root);
  }

  /** 结算头像画布的动画帧句柄（浮层收掉 / 游戏销毁时要取消） */
  let ovRaf = 0;

  /**
   * 胜利结算画布：胜者头像放大入场 + 主题色粒子雨 + 比分数字滚动。
   * 弱化动效时只画一帧静态（头像满尺寸、粒子定格、数字直接到位）。
   */
  function victoryCanvas(state: MatchState): HTMLCanvasElement {
    const canvas = el("canvas");
    const W = 320;
    const H = 150;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = "min(320px, 86%)";
    const c = canvas.getContext("2d");
    const soft = reduceMotion();
    const team = state.winnerTeam;
    const members = (
      team === null ? state.actors.slice(0, 2) : state.actors.filter((a) => a.team === team)
    ).slice(0, 2);
    const stats = team === null ? null : teamStats(state).find((t) => t.team === team);
    const TOTAL = 96;
    let f = soft ? TOTAL : 0;

    const drawFrame = (): void => {
      if (!c) return;
      c.clearRect(0, 0, W, H);
      const k = Math.min(1, f / 24);
      // 主题色粒子雨：花瓣圆点 + 小金星（位置由下标决定，soft 定格一帧）
      for (let i = 0; i < 14; i++) {
        const px = (i * 53 + 20) % W;
        const py = ((f * 1.8 + i * 37) % (H + 30)) - 15;
        c.globalAlpha = 0.75;
        if (i % 3 === 0) drawGoldStar(c, px, py, 5, i + f * 0.05);
        else {
          const m = members[i % Math.max(1, members.length)];
          c.fillStyle = m ? m.char.color : "#ff9ec4";
          c.beginPath();
          c.ellipse(px, py, 4.5, 3, i, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      // 胜者头像放大入场（脸谱复用，开心表情）
      members.forEach((m, i) => {
        const mx = W / 2 + (members.length === 1 ? 0 : i === 0 ? -56 : 56);
        const r = 30 * (0.55 + 0.45 * k);
        drawTeamRing(c, TEAM_COLORS[m.team % TEAM_COLORS.length], m.team, mx, 62, r + 5);
        drawCharBody(c, m.char.color, mx, 62, r);
        drawCharFace(c, m.char.id, mx, 62, r, "happy", 0);
      });
      // 比分数字滚动（soft 直接到位）
      if (stats) {
        const roll = Math.min(1, f / 45);
        c.font = "bold 15px system-ui";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = "#8a5aa8";
        c.fillText(
          `剩 ${Math.round(stats.stocks * roll)} 次上场 · 撞飞对手 ${Math.round(stats.kos * roll)} 次`,
          W / 2,
          H - 22
        );
      }
    };

    drawFrame();
    if (!soft && c) {
      const step = (): void => {
        f++;
        drawFrame();
        if (f < TOTAL) ovRaf = requestAnimationFrame(step);
      };
      ovRaf = requestAnimationFrame(step);
    }
    return canvas;
  }

  /** 一局打完后的通用结算浮层（闯关模式不用它，交给 level99） */
  function showResult(
    state: MatchState,
    playerTeam: number,
    onAgain: () => void,
    onBack: () => void
  ): void {
    const w = winnerText(state);
    const won = state.winnerTeam === playerTeam;
    sfx(won ? "win" : "oops");
    const ov = el("div", "dvs-over");
    ov.append(
      victoryCanvas(state),
      el("div", "ttl", w.ttl),
      el("div", "sub", won ? w.sub : `${w.sub} 下一局换个打法试试！`)
    );
    const row = el("div", "row");
    row.append(
      button("", "🔁 再来一局", () => {
        sfx("tap");
        onAgain();
      }),
      button("ghost", "🚪 换个模式", () => {
        sfx("tap");
        onBack();
      })
    );
    ov.appendChild(row);
    wrap.appendChild(ov);
    ov.querySelector("button")?.focus?.();
    const clean = (): void => {
      cancelAnimationFrame(ovRaf);
      ov.remove();
    };
    row.addEventListener("click", clean, { once: true });
  }

  /* ---------------- 双人对战 ---------------- */

  function showVersus(): void {
    clearView();
    let stage = STAGES[0].id;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "👫 双人对战 · 同屏键盘"));
    menu.appendChild(
      el("div", "dvs-sub", "1P 用 W A S D + F / G，2P 用方向键 + L / K，两套键位各按各的，互不打扰。")
    );
    menu.appendChild(pickerRow("1P 选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(pickerRow("2P 选谁（方向键）", () => pickP2, (id) => (pickP2 = id), sfx));
    menu.appendChild(stageRow(() => stage, (id) => (stage = id), sfx));
    menu.appendChild(
      button("dvs-go", "两人就位，开打 ▶", () => {
        sfx("jump");
        startVersus(stage);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startVersus(stageId: string): void {
    const config: MatchConfig = {
      stageId,
      slots: [
        { charId: pickP1, team: 0, control: "p1" },
        { charId: pickP2, team: 1, control: "p2" },
      ],
      stocks: 3,
      timeLimit: 150,
      itemEvery: 6,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `${fighterById(pickP1).name} vs ${fighterById(pickP2).name}`,
      { p1: 0, p2: 1 },
      "每人 3 次上场机会，把对手撞出场外就赢一分！",
      (state) => showResult(state, state.winnerTeam ?? 0, () => startVersus(stageId), showVersus),
      showVersus
    );
  }

  /* ---------------- 人机混战 ---------------- */

  function showBrawl(): void {
    clearView();
    let stage = STAGES[0].id;
    let tier: AiTier = "normal";
    let foes = 1;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "🤖 人机混战 · 最多 4 人"));
    menu.appendChild(el("div", "dvs-sub", "你一个人对上 1～3 台小电脑，谁都可以打谁，最后站住的人赢。"));
    menu.appendChild(pickerRow("你选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(tierRow(() => tier, (t) => (tier = t), sfx));

    const countBox = el("div");
    countBox.appendChild(el("div", "dvs-picklabel", "几台小电脑"));
    const countRow = el("div", "dvs-tierrow");
    const countBtns = [1, 2, 3].map((n) =>
      button("dvs-pick", `${n} 台`, () => {
        sfx("tap");
        foes = n;
        countBtns.forEach((b, i) => b.classList.toggle("on", i + 1 === foes));
      })
    );
    countBtns.forEach((b, i) => b.classList.toggle("on", i + 1 === foes));
    for (const b of countBtns) countRow.appendChild(b);
    countBox.appendChild(countRow);
    menu.appendChild(countBox);

    menu.appendChild(stageRow(() => stage, (id) => (stage = id), sfx));
    menu.appendChild(
      button("dvs-go", "开打 ▶", () => {
        sfx("jump");
        startBrawl(stage, tier, foes);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startBrawl(stageId: string, tier: AiTier, foes: number): void {
    const others = ROSTER.filter((f) => f.id !== pickP1);
    const slots: FighterSlot[] = [{ charId: pickP1, team: 0, control: "p1" }];
    for (let i = 0; i < foes; i++) {
      slots.push({
        charId: others[(i * 4 + 1) % others.length].id,
        team: i + 1,
        control: "ai",
        aiTier: tier,
      });
    }
    const config: MatchConfig = {
      stageId,
      slots,
      stocks: 3,
      timeLimit: 150,
      itemEvery: 5.5,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `混战 · ${AI_TIERS[tier].label}档 ${foes} 台小电脑`,
      { p1: 0 },
      "每个人各打各的，抢到道具就是优势！",
      (state) => showResult(state, 0, () => startBrawl(stageId, tier, foes), showBrawl),
      showBrawl
    );
  }

  /* ---------------- 团队赛 2v2 ---------------- */

  function showTeam(): void {
    clearView();
    let stage = STAGES[0].id;
    let tier: AiTier = "normal";
    let twoHumans = false;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "🤝 团队赛 · 2 对 2"));
    menu.appendChild(
      el("div", "dvs-sub", "两人一队，队友之间打不到彼此。把对面两位的上场机会都用完，这一队就赢了。")
    );
    menu.appendChild(pickerRow("1P 选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));

    const modeBox = el("div");
    modeBox.appendChild(el("div", "dvs-picklabel", "队友是谁来操作"));
    const modeRow = el("div", "dvs-tierrow");
    const modeBtns = [
      button("dvs-pick", "小电脑队友", () => {
        sfx("tap");
        twoHumans = false;
        sync();
      }),
      button("dvs-pick", "2P 一起玩（方向键）", () => {
        sfx("tap");
        twoHumans = true;
        sync();
      }),
    ];
    function sync(): void {
      modeBtns[0].classList.toggle("on", !twoHumans);
      modeBtns[1].classList.toggle("on", twoHumans);
    }
    sync();
    for (const b of modeBtns) modeRow.appendChild(b);
    modeBox.appendChild(modeRow);
    menu.appendChild(modeBox);

    menu.appendChild(pickerRow("队友选谁", () => pickP2, (id) => (pickP2 = id), sfx));
    menu.appendChild(tierRow(() => tier, (t) => (tier = t), sfx));
    menu.appendChild(stageRow(() => stage, (id) => (stage = id), sfx));
    menu.appendChild(
      button("dvs-go", "组队出发 ▶", () => {
        sfx("jump");
        startTeam(stage, tier, twoHumans);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startTeam(stageId: string, tier: AiTier, twoHumans: boolean): void {
    const used = new Set([pickP1, pickP2]);
    const rest = ROSTER.filter((f) => !used.has(f.id));
    const config: MatchConfig = {
      stageId,
      slots: [
        { charId: pickP1, team: 0, control: "p1" },
        { charId: pickP2, team: 0, control: twoHumans ? "p2" : "ai", aiTier: tier },
        { charId: rest[0].id, team: 1, control: "ai", aiTier: tier },
        { charId: rest[3 % rest.length].id, team: 1, control: "ai", aiTier: tier },
      ],
      stocks: 2,
      timeLimit: 150,
      itemEvery: 5,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `团队赛 · ${TEAM_NAMES[0]} vs ${TEAM_NAMES[1]}`,
      twoHumans ? { p1: 0, p2: 1 } : { p1: 0 },
      "队友之间打不到彼此，放心站在一起夹击！",
      (state) => showResult(state, 0, () => startTeam(stageId, tier, twoHumans), showTeam),
      showTeam
    );
  }

  /* ---------------- 合作特训 3 课 ---------------- */

  function showCoop(): void {
    clearView();
    const done = readCoopDone();
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "🙌 合作特训 · 两个人才做得到"));
    menu.appendChild(
      el(
        "div",
        "dvs-sub",
        "这三课教的两个动作都要两个人：顶举是队友踩上你头顶时你按「上」，把他送到高处；" +
          "接应是队友飘到场边外面时你按「下 + 重击」，甩一条星星绳把他拉回来。" +
          "过关只数这两个动作的次数，所以一个人怎么按都过不去——去叫上一个小伙伴吧！"
      )
    );
    menu.appendChild(pickerRow("1P 选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(pickerRow("2P 选谁（方向键）", () => pickP2, (id) => (pickP2 = id), sfx));

    const list = el("div", "dvs-lesson");
    COOP_LESSONS.forEach((lesson, i) => {
      const b = el("button", "dvs-lessonbtn");
      b.type = "button";
      b.append(
        el("b", undefined, `第 ${i + 1} 课 ${lesson.emoji} ${lesson.name}${done.has(lesson.id) ? " ✅" : ""}`),
        el("span", undefined, `${lesson.brief}${lesson.howto}`)
      );
      b.addEventListener("click", () => {
        sfx("jump");
        startLesson(i);
      });
      list.appendChild(b);
    });
    menu.appendChild(list);

    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startLesson(index: number): void {
    const lesson = COOP_LESSONS[Math.max(0, Math.min(COOP_LESSONS.length - 1, index))];
    const used = new Set([pickP1, pickP2]);
    const slots: FighterSlot[] = [
      { charId: pickP1, team: 0, control: "p1", stocks: 4 },
      { charId: pickP2, team: 0, control: "p2", stocks: 4 },
    ];
    if (lesson.sparring > 0) {
      const rest = ROSTER.filter((f) => !used.has(f.id));
      for (let i = 0; i < lesson.sparring; i++) {
        slots.push({
          charId: rest[(i * 3) % rest.length].id,
          team: 1,
          control: "ai",
          aiTier: "easy",
          aiStyle: "patient",
          stocks: 99,
        });
      }
    }
    const config: MatchConfig = {
      stageId: lesson.stageId,
      slots,
      stocks: 4,
      timeLimit: lesson.timeLimit,
      itemEvery: lesson.itemEvery,
      seed: 4649 + index * 131,
    };
    clearView();
    const a = mountArena({
      config,
      title: `${lesson.emoji} ${lesson.name}`,
      hint: lesson.howto,
      human: { p1: 0, p2: 1 },
      sfx,
      onExit: showCoop,
      goal: (s) => lessonCleared(coopTally(s, 0), lesson),
      progress: (s) => `${lessonProgress(coopTally(s, 0), lesson)} · ${lesson.howto}`,
      onEnd: (s) => {
        const tally = coopTally(s, 0);
        const ok = lessonCleared(tally, lesson);
        if (ok) {
          markCoopDone(lesson.id);
          const outs = s.actors.filter((x) => x.team === 0).reduce((n, x) => n + x.outs, 0);
          api.addStars(rateLesson(outs));
        }
        sfx(ok ? "win" : "oops");
        const ov = el("div", "dvs-over");
        ov.append(
          el("div", "big", ok ? "🎉" : "🌱"),
          el("div", "ttl", ok ? "配合成功！" : "再配合一次就成了"),
          el(
            "div",
            "sub",
            ok
              ? `${lessonProgress(tally, lesson)}，这一课学会啦——两个人一起才做得到的动作，你们做到了！`
              : `已经做到 ${lessonProgress(tally, lesson)}。${lesson.howto}慢慢来，多试两次就顺了。`
          )
        );
        const row = el("div", "row");
        row.append(
          button("", "🔁 再来一次", () => {
            sfx("tap");
            ov.remove();
            startLesson(index);
          }),
          button("ghost", "📚 回课程表", () => {
            sfx("tap");
            ov.remove();
            showCoop();
          })
        );
        ov.appendChild(row);
        wrap.appendChild(ov);
        ov.querySelector("button")?.focus?.();
      },
    });
    arena = a;
    view.appendChild(a.root);
  }

  /* ---------------- 无尽车轮战 ---------------- */

  function showEndless(): void {
    clearView();
    const best = save.getGameProgress(meta.id).endlessBest;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "♾️ 无尽车轮战"));
    menu.appendChild(
      el(
        "div",
        "dvs-sub",
        `一位接一位地上，赢一场就换一个更强的对手，场地也跟着换。你只有 1 次上场机会，被撞出去就结束。${
          best > 0 ? `目前最好成绩：连胜 ${best} 场。` : ""
        }`
      )
    );
    menu.appendChild(pickerRow("你选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(
      button("dvs-go", "上擂台 ▶", () => {
        sfx("jump");
        runEndless(0);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function runEndless(round: number): void {
    const foe = endlessFoe(round);
    const config: MatchConfig = {
      stageId: endlessStage(round),
      slots: [
        { charId: pickP1, team: 0, control: "p1", stocks: 1 },
        {
          charId: foe.charId,
          team: 1,
          control: "ai",
          aiTier: foe.tier,
          aiStyle: foe.style,
          powerBonus: foe.powerBonus,
          stocks: 1,
        },
      ],
      stocks: 1,
      timeLimit: 90,
      itemEvery: 6,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `第 ${round + 1} 场 · 对手 ${fighterById(foe.charId).name}（${AI_TIERS[foe.tier].label}·${
        STYLE_LABELS[foe.style ?? "plain"]
      }）`,
      { p1: 0 },
      round === 0 ? "只有 1 次上场机会，稳一点！" : `已经连胜 ${round} 场，越往后对手越厉害。`,
      (state) => {
        if (state.winnerTeam === 0) {
          sfx("win");
          runEndless(round + 1);
          return;
        }
        const prevBest = save.getGameProgress(meta.id).endlessBest;
        const best = save.recordEndlessBest(meta.id, round);
        // 车轮战奖励：每连胜 2 场给 1 颗小星星，最多 6 颗，别把闯关的星星比下去
        const bonus = endlessBonusStars(round);
        if (bonus > 0) api.addStars(bonus);
        sfx("oops");
        const ov = el("div", "dvs-over");
        ov.append(
          el("div", "big", round >= 5 ? "🎉" : "☁️"),
          el("div", "ttl", `连胜 ${round} 场！`),
          el(
            "div",
            "sub",
            `${
              round > prevBest
                ? `刷新了自己的最好成绩，历史最佳 ${best} 场！`
                : `历史最佳是 ${best} 场，再来一次一定能超过！`
            }${bonus > 0 ? `本轮拿到 ${bonus} 颗小星星。` : ""}`
          )
        );
        const row = el("div", "row");
        row.append(
          button("", "🔁 再来一轮", () => {
            sfx("tap");
            ov.remove();
            runEndless(0);
          }),
          button("ghost", "🚪 换个模式", () => {
            sfx("tap");
            ov.remove();
            showEndless();
          })
        );
        ov.appendChild(row);
        wrap.appendChild(ov);
        ov.querySelector("button")?.focus?.();
      },
      showEndless
    );
  }

  /* ---------------- 闯关 188 关 ---------------- */

  function showCampaign(): void {
    clearView();
    const host = el("div");
    view.appendChild(host);
    const topRow = el("div", "dvs-pickrow");
    topRow.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    topRow.appendChild(
      button("dvs-back", `🙋 我用 ${fighterById(pickP1).emoji}${fighterById(pickP1).name}`, () => {
        sfx("tap");
        const i = ROSTER.findIndex((f) => f.id === pickP1);
        pickP1 = ROSTER[(i + 1) % ROSTER.length].id;
        showCampaign();
      })
    );
    host.appendChild(topRow);

    const levelHost = el("div");
    host.appendChild(levelHost);

    level = mountLevelGame(
      { ...api, root: levelHost },
      {
        id: meta.id,
        chapters: CHAPTERS,
        playLevel,
        mapHint: "十张场地、十种花样，越往后的对手越会抓你落地那一下。",
        grandMessage: "188 关全部通关，全明星混战的冠军就是你！",
        guideTitle: GUIDE.title,
        guide: GUIDE,
      }
    );
  }

  function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const lv = levelAt(ctx.level);
    const slots: FighterSlot[] = [
      { charId: pickP1, team: 0, control: "p1", stocks: lv.playerStocks },
    ];
    for (const ally of lv.allies) {
      slots.push({
        charId: ally.charId,
        team: 0,
        control: "ai",
        aiTier: ally.tier,
        stocks: ally.stocks ?? lv.playerStocks,
      });
    }
    lv.foes.forEach((foe, i) => {
      slots.push({
        charId: foe.charId,
        team: lv.allies.length > 0 ? 1 : 1 + i,
        control: "ai",
        aiTier: foe.tier,
        aiStyle: foe.style,
        powerBonus: foe.powerBonus,
        stocks: foe.stocks,
      });
    });

    const config: MatchConfig = {
      stageId: lv.stageId,
      slots,
      stocks: lv.playerStocks,
      timeLimit: lv.timeLimit,
      itemEvery: lv.itemEvery,
      itemPool: lv.itemPool,
      seed: (ctx.level + 1) * 7919,
      // 闯关的主角就是 0 号槽：他出局这一关就结束，他一个键都没按就不给判胜
      lead: 0,
    };

    const box = el("div");
    // 后段的难度是「打法变了」，不是「力气变大了」，所以把对手的打法直接写出来
    const styles = Array.from(new Set(lv.foes.map((f) => f.style ?? "plain"))).filter(
      (s) => s !== "plain"
    );
    const styleTip = styles.length > 0 ? ` · 对手${styles.map((s) => STYLE_LABELS[s]).join("、")}` : "";
    const head = el(
      "div",
      "dvs-hint",
      `${stageById(lv.stageId).emoji} ${stageById(lv.stageId).name} · ${lv.ruleTag}：${lv.rule}${styleTip}`
    );
    box.appendChild(head);
    const a = mountArena({
      config,
      title: `第 ${ctx.level + 1} 关 · ${lv.ruleTag}`,
      hint: `你有 ${lv.playerStocks} 次上场机会，${lv.timeLimit > 0 ? `限时 ${lv.timeLimit} 秒` : "不限时"}。`,
      human: { p1: 0 },
      sfx: (name) => ctx.sfx(name),
      onEnd: (state) => {
        const me = state.actors[0];
        if (state.winnerTeam === 0) {
          // 结算只夸玩家自己做到的事：一下都没打中过的话，那一局是对手自己
          // 掉下去、或者时间到按上场机会判的，别写成「你太稳啦」
          const note =
            me.hits === 0
              ? "这一局你一下都没出手，对手是自己站不住掉下去的。下次主动迎上去，把他撞出场外试试！"
              : me.outs === 0
                ? "一次都没被撞出去，太稳啦！"
                : undefined;
          ctx.win(rateLevel(me.outs, me.hits), note);
        } else if (leadIdle(state)) {
          ctx.lose("这一局你一个键都没按呀。星星要自己动手才拿得到，来试试跳一下、挥一拳！");
        } else if (me.retired) {
          ctx.lose(`你被撞出去 ${me.outs} 次，上场机会用完啦。少往场边站一点，再来一次！`);
        } else {
          ctx.lose("对手站得更稳一点点，换个节奏再来一次！");
        }
      },
    });
    box.appendChild(a.root);
    stage.appendChild(box);
    arena = a;
    return {
      destroy() {
        a.destroy();
        if (arena === a) arena = null;
        box.remove();
      },
    };
  }

  showMenu();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(ovRaf);
      clearView();
      wrap.remove();
    },
  };
}
