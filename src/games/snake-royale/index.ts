import { meta } from "./meta";
export { meta };

// 长蛇争霸:开阔原野上的本地竞技。188 关战役 + 本机混战 + 缩圈无尽 + 同屏双人。
// 场上所有「其他玩家」都是本机 AI,全程离线,不开任何网络连接。
import { fitPanesToStage, loadStars, mountLevelGame, totalStars, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import {
  SPACING,
  TURN_RATE,
  START_LEN,
  dist,
  lenToRadius,
  lenToSpeed,
  nodeCount,
  normAngle,
  sampleBody,
  steer,
  wallSlide,
  type Pt
} from "./body";
import {
  BOOST_MUL,
  FOOD_GAIN,
  ZONE_PERIOD,
  boostStep,
  dropOrbs,
  headHitsBody,
  headOnHeadOut,
  insideZone,
  isSpent,
  leaderboard,
  multiKillBonus,
  rankOf,
  runLine,
  selfLine,
  shrinkZone,
  tweenLength,
  zoneDrain,
  type BodyView,
  type Orb,
  type Zone
} from "./logic";
import { AI_TIER_LABELS, aiSteer, type AiRival, type AiTier } from "./ai";
import {
  CHAPTERS,
  chapterIndexOf,
  endlessConfig,
  goalLine,
  goalTarget,
  levelConfig,
  levelWon,
  starsFor,
  type SnakeLevel
} from "./levels";
import {
  FENCE_WARN_PX,
  accessoryFor,
  beanPhase,
  drawBodyNode,
  drawCompassRadar,
  drawFence,
  drawFieldBackground,
  drawGemDrop,
  drawNameTag,
  drawShrinkZone,
  drawSnakeHead,
  drawStarBeanFast,
  drawSummary,
  fieldTheme,
  makeBeanSprites,
  makeStardustPool,
  patternFamily,
  type FieldThemeKind,
  type RadarDot
} from "./art";
import { tint } from "../../art/kit";
import {
  BOT_COLORS,
  SKINS,
  SKIN_KEY,
  nextSkinHint,
  nodeColor,
  parseSkinChoice,
  serializeSkinChoice,
  unlockedSkins,
  type Skin
} from "./skins";

/** 本作原创的名字,只用自家角色和拟声词 */
const BOT_NAMES = ["糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾", "团团", "小青 7 号", "小青 9 号"];

export const SR_CSS = `
.sr-wrap{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#EAF7E4,#F7FCF3);
  border-radius:16px;padding:10px;user-select:none;position:relative;}
.sr-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;margin-bottom:6px;}
.sr-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#3f7a52;
  box-shadow:0 2px 6px rgba(120,170,130,.25);overflow-wrap:anywhere;}
.sr-panes{display:flex;flex-direction:column;gap:6px;}
.sr-panes.sr-split{flex-direction:column;}
.sr-canvas{width:100%;border-radius:14px;display:block;background:#F1FAEC;touch-action:none;}
.sr-board{position:absolute;top:46px;right:14px;background:linear-gradient(180deg,#ffffffe8,#f3fbf1e0);
  border:1px solid #d4ecd4;border-radius:12px;padding:6px 9px;box-shadow:0 3px 10px rgba(90,150,110,.18);
  font-size:16px;font-weight:800;color:#3f7a52;line-height:1.5;max-width:44%;}
.sr-board summary{cursor:pointer;font-size:16px;min-height:44px;display:flex;align-items:center;box-sizing:border-box;}
.sr-me{color:#b85a2a;}
.sr-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.sr-btn{min-width:88px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;background:#BFE7B0;color:#2f5c3c;box-shadow:0 3px 0 #97CC88;padding:0 14px;}
.sr-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #97CC88;}
.sr-btn.sr-star{background:#CFE3FA;color:#2f4a75;box-shadow:0 3px 0 #A6C4E8;}
.sr-btn:focus-visible{outline:3px solid #245c38;outline-offset:3px;}
.sr-msg{text-align:center;min-height:20px;color:#3f7a52;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;}
.sr-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会把浏览器自带的 [hidden]{display:none} 顶掉,进关收条全靠这一句 */
.sr-modebar[hidden]{display:none;}
.sr-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#3f7a52;text-align:center;overflow-wrap:anywhere;}
.sr-open{border:none;border-radius:999px;padding:9px 18px;min-height:44px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#6fc48b,#4f9e6b);box-shadow:0 4px 0 #3d7d54;}
.sr-open:active{transform:translateY(2px);box-shadow:0 2px 0 #3d7d54;}
.sr-mode{max-width:760px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.sr-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.sr-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#4f9e6b;box-shadow:0 3px 0 rgba(90,150,110,.3);min-height:44px;}
.sr-over{text-align:center;padding:24px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(120,170,130,.25);}
.sr-over-t{font-size:21px;font-weight:900;color:#3f7a52;margin-bottom:8px;}
.sr-over-s{font-size:16px;font-weight:700;color:#54886a;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
.sr-sumcv{display:block;width:min(320px,94%);margin:0 auto 12px;}
.sr-skins{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 0 0;}
.sr-skin{border:2px solid transparent;border-radius:12px;padding:5px 9px;font-size:14px;font-weight:800;
  font-family:inherit;cursor:pointer;background:#ffffffd9;color:#3f7a52;min-height:44px;}
.sr-skin[aria-pressed="true"]{border-color:#4f9e6b;}
.sr-skin[disabled]{opacity:.5;cursor:default;}
@media (min-width:720px){
  .sr-panes.sr-split{flex-direction:row;}
  .sr-panes.sr-split .sr-canvas{width:50%;}
}
@media (max-width:360px){
  .sr-badge{padding:4px 8px;}
  .sr-board{max-width:54%;top:60px;}
  .sr-btn{min-width:74px;font-size:14px;padding:0 10px;}
}
/* N-61:闯关加速/急停复用双人底栏 */
@media (max-height:500px){
  .sr-pad{position:sticky;bottom:0;z-index:6;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(234,247,228,.25),#EAF7E4 40%);}
  .sr-msg{min-height:0;max-height:1.5em;overflow:hidden;margin-top:4px;}
}
@media (max-height:840px) and (min-height:501px){
  .sr-pad{position:sticky;bottom:0;z-index:6;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(234,247,228,.25),#EAF7E4 40%);}
}
`;

export const SR_DUO_PANE_H = 224;
export const SR_SOLO_PANE_H = 372;
export const SR_SHORT_PANE_H = 200;

function shortLandscapeH(): boolean {
  try {
    return Boolean(globalThis.matchMedia?.("(max-height: 500px)")?.matches);
  } catch {
    return false;
  }
}

export function snakePaneH(paneCount: number, shortH = shortLandscapeH()): number {
  if (paneCount > 1) return SR_DUO_PANE_H;
  return shortH ? SR_SHORT_PANE_H : SR_SOLO_PANE_H;
}

export interface Owner {
  id: string;
  name: string;
  color: string;
  skin?: Skin;
  /** 人类玩家:朵朵用 WASD+F/G,星星用方向键 +L/K */
  human?: "duo" | "star";
  tier?: AiTier;
}

export interface RunResult {
  won: boolean;
  length: number;
  rank: number;
  stops: number;
  usedSec: number;
  alive: boolean;
  /** 本局长度采样(每 0.5s 一点),结算画长度曲线用 */
  curve: number[];
}

export interface RunOpts {
  cfg: SnakeLevel;
  owners: Owner[];
  banner?: string;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onDone: (r: RunResult) => void;
  /** 双人同屏时给两块画面 */
  split?: boolean;
}

interface Runner {
  id: string;
  name: string;
  color: string;
  skin: Skin;
  human?: "duo" | "star";
  tier?: AiTier;
  x: number;
  y: number;
  angle: number;
  /** 真实长度 */
  length: number;
  /** 画面上跟过去的长度,挡住「长度瞬跳」 */
  shown: number;
  alive: boolean;
  path: Pt[];
  nodes: Pt[];
  boostAcc: number;
  boosting: boolean;
  braking: boolean;
  stops: number;
  /** 淘汰动画剩余秒数 */
  fade: number;
}

function reducedMotion(): boolean {
  try {
    return Boolean(
      (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches
    );
  } catch {
    return false;
  }
}

/** 淘汰动画时长(秒):250–400ms,不允许瞬间消失 */
export const FADE_SEC = 0.34;

export function createRun(stage: HTMLElement, opts: RunOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  const soft = reducedMotion();
  const humans = opts.owners.filter((o) => o.human);

  let destroyed = false;
  let ended = false;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let paused = false;
  let zoneWarned = 0;
  let seq = 0;
  const nextId = (p: string): string => `${p}${++seq}`;

  /** destroy 要收的东西:结算定时器与画布上的指针监听 */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const offs: Array<() => void> = [];
  function later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  const runners: Runner[] = opts.owners.map((o, i) => {
    const ang = (Math.PI * 2 * i) / Math.max(1, opts.owners.length);
    const x = Math.cos(ang) * cfg.mapR * 0.55;
    const y = Math.sin(ang) * cfg.mapR * 0.55;
    const heading = normAngle(ang + Math.PI);
    const path: Pt[] = [];
    for (let k = 0; k < 90; k++) path.push({ x: x - Math.cos(heading) * k * 4, y: y - Math.sin(heading) * k * 4 });
    return {
      id: o.id,
      name: o.name,
      color: o.color,
      skin: o.skin ?? SKINS[0],
      human: o.human,
      tier: o.tier,
      x,
      y,
      angle: heading,
      length: START_LEN,
      shown: START_LEN,
      alive: true,
      path,
      nodes: [],
      boostAcc: 0,
      boosting: false,
      braking: false,
      stops: 0,
      fade: 0
    };
  });

  const foods: Pt[] = [];
  const orbs: Orb[] = [];
  const rand = (): number => Math.random();
  const spawnFood = (): Pt => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * cfg.mapR * 0.94;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  };
  for (let i = 0; i < cfg.food; i++) foods.push(spawnFood());

  let zone: Zone | null = cfg.shrink > 0 ? { cx: 0, cy: 0, radius: cfg.mapR * 0.96 } : null;

  // ---- 1.3 视觉状态(只影响画面,不碰任何玩法数值) ----
  /** 关卡段换色:白天原野 → 黄昏 → 迷雾夜(fog 关自动夜色调) */
  const themeKind: FieldThemeKind = cfg.fog ? "night" : chapterIndexOf(cfg.level) >= 4 ? "dusk" : "day";
  const theme = fieldTheme(themeKind);
  /** 星光豆预渲染 sprite;拿不到离屏画布时为 null,画豆时自动退回直绘 */
  const beanSprites = makeBeanSprites(soft);
  /** 加速星屑拖尾对象池(上限 40,soft 全关) */
  const stardust = makeStardustPool();
  let dustSeed = 0;
  /** 每颗掉落宝石的出生时刻(落地弹性用);宝石被捡走后自动回收 */
  const orbBorn = new WeakMap<Orb, number>();
  /** 本局长度采样(每 0.5s 一点),结算画长度曲线 */
  const lenLog: number[] = [];
  let nextLenSample = 0;

  // ---- DOM ----
  const wrap = document.createElement("div");
  wrap.className = "sr-wrap";
  wrap.innerHTML = `
    <style>${SR_CSS}</style>
    <div class="sr-top">
      <span class="sr-badge sr-len">🐍 长度 ${START_LEN}</span>
      <span class="sr-badge sr-goal">${goalLine(cfg)}</span>
      ${cfg.timeSec > 0 ? `<span class="sr-badge sr-time">⏱️ ${cfg.timeSec}</span>` : ""}
      ${opts.banner ? `<span class="sr-badge">${opts.banner}</span>` : ""}
    </div>
    <div class="sr-panes"></div>
    <details class="sr-board" open><summary>🏅 排行榜</summary><div class="sr-board-rows"></div></details>
    <div class="sr-pad"></div>
    <div class="sr-msg"></div>
  `;
  stage.appendChild(wrap);

  const panes = wrap.querySelector(".sr-panes") as HTMLElement;
  const lenEl = wrap.querySelector(".sr-len") as HTMLElement;
  const timeEl = wrap.querySelector(".sr-time") as HTMLElement | null;
  const boardEl = wrap.querySelector(".sr-board-rows") as HTMLElement;
  const padEl = wrap.querySelector(".sr-pad") as HTMLElement;
  const msgEl = wrap.querySelector(".sr-msg") as HTMLElement;
  msgEl.textContent = "拖着屏幕带路,头别碰到别人的身体。自己的身体是安全的。";

  if (opts.split) panes.classList.add("sr-split");

  const canvases: HTMLCanvasElement[] = [];
  const paneCount = Math.max(1, humans.length);
  const paneW = 640;
  const paneH = snakePaneH(paneCount);
  for (let i = 0; i < paneCount; i++) {
    const c = document.createElement("canvas");
    c.className = "sr-canvas";
    c.width = paneW;
    c.height = paneH;
    c.setAttribute("aria-label", `${humans[i]?.name ?? "长蛇"} 的原野画面`);
    panes.appendChild(c);
    canvases.push(c);
  }

  /** 人类玩家的准星(世界坐标),手指拖到哪头就朝哪 */
  const aims = new Map<string, Pt | null>();
  /** 键盘方向,0 表示没按 */
  const keyDir = new Map<string, Pt>();
  for (const h of humans) {
    aims.set(h.id, null);
    keyDir.set(h.id, { x: 0, y: 0 });
  }
  const boostHeld = new Set<string>();
  const brakeHeld = new Set<string>();

  function runnerById(id: string): Runner | undefined {
    return runners.find((r) => r.id === id);
  }

  interface Camera {
    x: number;
    y: number;
    zoom: number;
  }

  function cameraFor(id: string, canvas: HTMLCanvasElement): Camera {
    const me = runnerById(id);
    const span = Math.max(420, 420 + (me ? me.shown * 3.2 : 0)) * (cfg.fog ? 0.62 : 1);
    return {
      x: me?.x ?? 0,
      y: me?.y ?? 0,
      zoom: Math.min(1.5, canvas.width / span)
    };
  }

  canvases.forEach((canvas, i) => {
    const owner = humans[i] ?? humans[0];
    if (!owner) return;
    const onPointer = (e: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      const cam = cameraFor(owner.id, canvas);
      aims.set(owner.id, { x: cam.x + (px - canvas.width / 2) / cam.zoom, y: cam.y + (py - canvas.height / 2) / cam.zoom });
      keyDir.set(owner.id, { x: 0, y: 0 });
      e.preventDefault();
    };
    const onMove = (e: PointerEvent): void => {
      if (e.buttons > 0 || e.pointerType === "touch") onPointer(e);
    };
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("pointermove", onMove);
    offs.push(() => {
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onMove);
    });
  });

  // 手机等价操作:每个人类玩家一颗加速大钮 + 一颗急停钮,热区都 ≥ 44px
  for (const h of humans) {
    const mk = (label: string, set: Set<string>): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `sr-btn${h.human === "star" ? " sr-star" : ""}`;
      b.textContent = label;
      const on = (e: Event): void => {
        set.add(h.id);
        e.preventDefault();
      };
      const off = (): void => {
        set.delete(h.id);
      };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off);
      b.addEventListener("pointercancel", off);
      return b;
    };
    padEl.append(mk(`${h.name} 💨 加速`, boostHeld), mk(`${h.name} 🛑 急停`, brakeHeld));
  }

  // 卡底留白(trio-r4 遗留):按钮/提示都建齐后量一次壳卡缺口,把画布加高,竖屏不再露一大截白底
  fitPanesToStage(wrap, canvases, paneW, paneH);

  const DUO_KEYS: Record<string, Pt> = { w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
  const STAR_KEYS: Record<string, Pt> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
  };

  function applyKey(id: string, v: Pt, down: boolean): void {
    const cur = keyDir.get(id) ?? { x: 0, y: 0 };
    keyDir.set(
      id,
      down
        ? { x: v.x !== 0 ? v.x : cur.x, y: v.y !== 0 ? v.y : cur.y }
        : { x: v.x !== 0 ? 0 : cur.x, y: v.y !== 0 ? 0 : cur.y }
    );
    if (down) aims.set(id, null);
  }

  const duo = humans.find((h) => h.human === "duo");
  const star = humans.find((h) => h.human === "star");

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      paused = !paused;
      msgEl.textContent = paused ? "⏸️ 暂停中,再按 Esc 继续。" : "继续!";
      // 这一下归自己了:不拦住,游戏壳还会再弹一次统一暂停面板,
      // 之后的 Esc 只关面板,场上却一直停着
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo) {
      if (DUO_KEYS[k]) {
        applyKey(duo.id, DUO_KEYS[k], true);
        e.preventDefault();
      }
      if (k === "f") boostHeld.add(duo.id);
      if (k === "g") brakeHeld.add(duo.id);
    }
    const arrowTarget = star ?? duo;
    if (arrowTarget && STAR_KEYS[e.key]) {
      applyKey(arrowTarget.id, STAR_KEYS[e.key], true);
      e.preventDefault();
    }
    if (star) {
      if (k === "l") boostHeld.add(star.id);
      if (k === "k") brakeHeld.add(star.id);
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo) {
      if (DUO_KEYS[k]) applyKey(duo.id, DUO_KEYS[k], false);
      if (k === "f") boostHeld.delete(duo.id);
      if (k === "g") brakeHeld.delete(duo.id);
    }
    const arrowTarget = star ?? duo;
    if (arrowTarget && STAR_KEYS[e.key]) applyKey(arrowTarget.id, STAR_KEYS[e.key], false);
    if (star) {
      if (k === "l") boostHeld.delete(star.id);
      if (k === "k") brakeHeld.delete(star.id);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function bodyViews(): BodyView[] {
    return runners.map((r) => ({ id: r.id, alive: r.alive, nodes: r.nodes, radius: lenToRadius(r.shown) }));
  }

  function rivalViews(): AiRival[] {
    return runners.map((r) => ({
      id: r.id,
      alive: r.alive,
      nodes: r.nodes,
      radius: lenToRadius(r.shown),
      head: { x: r.x, y: r.y },
      angle: r.angle,
      length: r.length,
      speed: lenToSpeed(r.length)
    }));
  }

  function retire(r: Runner): void {
    if (!r.alive) return;
    r.alive = false;
    r.fade = FADE_SEC;
    // 身体化成一串光点,谁先捡到谁赚
    for (const o of dropOrbs(r.nodes, r.length, nextId("o"))) orbs.push(o);
    if (r.human) opts.sfx("oops");
    else opts.sfx("pop");
  }

  function update(dt: number): void {
    elapsed += dt;
    const views = bodyViews();
    const rivals = rivalViews();

    // 结算曲线采样(纯视觉,不参与任何判定)
    const sampleMe = humans[0] ? runnerById(humans[0].id) : undefined;
    if (sampleMe && elapsed >= nextLenSample && lenLog.length < 240) {
      lenLog.push(Math.round(sampleMe.shown));
      nextLenSample += 0.5;
    }

    // 1) 先按同一份帧初快照决定每条蛇朝哪
    const wants = new Map<string, { target: number; boost: boolean }>();
    for (const r of runners) {
      if (!r.alive) continue;
      if (r.human) {
        const dir = keyDir.get(r.id) ?? { x: 0, y: 0 };
        const aim = aims.get(r.id) ?? null;
        let target = r.angle;
        if (dir.x !== 0 || dir.y !== 0) target = Math.atan2(dir.y, dir.x);
        else if (aim && dist(aim, { x: r.x, y: r.y }) > 6) target = Math.atan2(aim.y - r.y, aim.x - r.x);
        wants.set(r.id, { target, boost: boostHeld.has(r.id) });
      } else {
        const move = aiSteer(
          {
            self: { id: r.id, x: r.x, y: r.y, angle: r.angle, length: r.length, radius: lenToRadius(r.shown) },
            foods,
            orbs,
            others: rivals.filter((v) => v.id !== r.id),
            zone,
            mapR: cfg.mapR,
            cx: 0,
            cy: 0
          },
          r.tier ?? "normal",
          rand
        );
        wants.set(r.id, move);
      }
    }

    // 2) 一起动
    for (const r of runners) {
      if (!r.alive) {
        r.fade = Math.max(0, r.fade - dt);
        continue;
      }
      const want = wants.get(r.id) ?? { target: r.angle, boost: false };
      r.angle = steer(r.angle, want.target, dt, TURN_RATE);

      const bs = boostStep(r.length, r.boostAcc, dt * 1000, want.boost);
      if (bs.drop) orbs.push({ id: nextId("o"), x: r.nodes[r.nodes.length - 1]?.x ?? r.x, y: r.nodes[r.nodes.length - 1]?.y ?? r.y, value: 0.8 });
      r.length = bs.length;
      r.boostAcc = bs.acc;
      r.boosting = bs.boosting;
      r.braking = brakeHeld.has(r.id);

      let speed = lenToSpeed(r.length) * (bs.boosting ? BOOST_MUL : 1);
      if (r.braking) speed *= 0.45;
      r.x += Math.cos(r.angle) * speed * dt;
      r.y += Math.sin(r.angle) * speed * dt;

      const slide = wallSlide({ x: r.x, y: r.y }, r.angle, cfg.mapR);
      if (slide.hit) {
        r.x = slide.x;
        r.y = slide.y;
        r.angle = slide.angle;
      }

      r.length = zoneDrain(r.length, { x: r.x, y: r.y }, zone, dt);
      r.shown = tweenLength(r.shown, r.length, dt);
      r.path.unshift({ x: r.x, y: r.y });
      const keep = Math.min(900, nodeCount(r.shown) * 3 + 40);
      if (r.path.length > keep) r.path.length = keep;
      r.nodes = sampleBody(r.path, SPACING, nodeCount(r.shown));

      if (isSpent(r.length, { x: r.x, y: r.y }, zone)) retire(r);
    }

    if (zone) {
      zone = shrinkZone(zone, dt, cfg.shrink);
      // 安全区是连续收的,所以每隔一个周期口头提醒一次,别让孩子突然发现自己在圈外
      if (Math.floor(elapsed / ZONE_PERIOD) > zoneWarned) {
        zoneWarned = Math.floor(elapsed / ZONE_PERIOD);
        const me = humans[0] ? runnerById(humans[0].id) : undefined;
        if (me && !insideZone({ x: me.x, y: me.y }, zone)) msgEl.textContent = "你在安全区外面啦,快往圈里挪！";
        else msgEl.textContent = "安全区又小了一点,记得往中间靠。";
      }
    }

    // 3) 吃豆和捡光点(按同一份快照,谁先动都不占便宜)
    for (let i = 0; i < foods.length; i++) {
      let taken = false;
      for (const r of runners) {
        if (!r.alive) continue;
        if (dist(foods[i], { x: r.x, y: r.y }) < lenToRadius(r.shown) + 7) {
          r.length += FOOD_GAIN;
          taken = true;
          if (r.human) opts.sfx("coin");
        }
      }
      if (taken) foods[i] = spawnFood();
    }
    for (let i = orbs.length - 1; i >= 0; i--) {
      for (const r of runners) {
        if (!r.alive) continue;
        if (dist(orbs[i], { x: r.x, y: r.y }) < lenToRadius(r.shown) + 9) {
          r.length += orbs[i].value;
          orbs.splice(i, 1);
          if (r.human) opts.sfx("coin");
          break;
        }
      }
    }

    // 4) 头对头:两条一起先去休息
    for (let i = 0; i < runners.length; i++) {
      for (let j = i + 1; j < runners.length; j++) {
        const a = runners[i];
        const b = runners[j];
        if (!a.alive || !b.alive) continue;
        const out = headOnHeadOut(
          { id: a.id, x: a.x, y: a.y, radius: lenToRadius(a.shown) },
          { id: b.id, x: b.x, y: b.y, radius: lenToRadius(b.shown) }
        );
        if (out.length === 2) {
          retire(a);
          retire(b);
        }
      }
    }

    // 5) 头撞身体:唯一的淘汰方式,自己的身体不算
    const stopsThisFrame = new Map<string, number>();
    const outs: Runner[] = [];
    for (const r of runners) {
      if (!r.alive) continue;
      const hit = headHitsBody({ id: r.id, x: r.x, y: r.y, radius: lenToRadius(r.shown) }, views);
      if (hit) {
        outs.push(r);
        stopsThisFrame.set(hit, (stopsThisFrame.get(hit) ?? 0) + 1);
      }
    }
    for (const r of outs) retire(r);
    for (const [ownerId, n] of stopsThisFrame) {
      const owner = runnerById(ownerId);
      if (!owner) continue;
      owner.stops += n;
      const bonus = multiKillBonus(n);
      if (bonus.bonus > 0) {
        owner.length += bonus.bonus;
        if (owner.human) {
          msgEl.textContent = bonus.text;
          opts.sfx("win");
        }
      } else if (owner.human) {
        msgEl.textContent = "拦下一条,光点归你啦！";
        opts.sfx("pop");
      }
    }

    // 6) 结算
    const me = humans[0] ? runnerById(humans[0].id) : undefined;
    if (me) {
      if (!me.alive && me.fade <= 0) {
        finish(false);
        return;
      }
      const state = { alive: me.alive, length: me.length, rank: rankOf(rankInputs(), me.id), stops: me.stops };
      if (me.alive && levelWon(cfg, state)) {
        finish(true);
        return;
      }
    }
    const aliveBots = runners.filter((r) => r.alive && !r.human).length;
    if (aliveBots === 0 && me?.alive && cfg.goal !== "length") {
      finish(true);
      return;
    }
    if (cfg.timeSec > 0 && elapsed >= cfg.timeSec && me) {
      const state = { alive: me.alive, length: me.length, rank: rankOf(rankInputs(), me.id), stops: me.stops };
      finish(levelWon(cfg, state));
    }
  }

  function rankInputs(): { id: string; name: string; length: number; alive: boolean }[] {
    return runners.map((r) => ({ id: r.id, name: r.name, length: r.length, alive: r.alive }));
  }

  function drawPane(canvas: HTMLCanvasElement, id: string): void {
    const g = canvas.getContext("2d");
    if (!g) return;
    const cam = cameraFor(id, canvas);
    const w = canvas.width;
    const h = canvas.height;
    const z = cam.zoom;
    const toX = (x: number): number => w / 2 + (x - cam.x) * z;
    const toY = (y: number): number => h / 2 + (y - cam.y) * z;

    g.clearRect(0, 0, w, h);
    // 糖果原野:渐变底 + 低透明网格 + 视差装饰贴片(关卡段换色)
    drawFieldBackground(g, { w, h, camX: cam.x, camY: cam.y, zoom: z, theme });

    // 发光围栏:三层描边 + 灯珠;本画面的蛇头逼近 80px 内红色警示脉动(仅视觉)
    const paneMe = runnerById(id);
    let warn = 0;
    let warnAngle = 0;
    if (paneMe?.alive) {
      const gap = cfg.mapR - Math.hypot(paneMe.x, paneMe.y);
      if (gap < FENCE_WARN_PX) {
        warn = Math.min(1, Math.max(0, 1 - gap / FENCE_WARN_PX));
        warnAngle = Math.atan2(paneMe.y, paneMe.x);
      }
    }
    drawFence(g, { cx: toX(0), cy: toY(0), r: cfg.mapR * z, w, h, t: elapsed, theme, warn, warnAngle, soft });

    // 星光豆:预渲染 sprite + 哈希相位闪烁(soft 关光晕与闪烁)
    for (const f of foods) {
      const x = toX(f.x);
      const y = toY(f.y);
      if (x < -12 || y < -12 || x > w + 12 || y > h + 12) continue;
      drawStarBeanFast(g, beanSprites, { x, y, r: Math.max(2, 3.6 * z), t: beanPhase(f.x, f.y, elapsed), soft });
    }
    // 掉落糖果宝石:按价值分档配色,落地 0.5s 弹性缩放
    for (const o of orbs) {
      const x = toX(o.x);
      const y = toY(o.y);
      if (x < -14 || y < -14 || x > w + 14 || y > h + 14) continue;
      let born = orbBorn.get(o);
      if (born === undefined) {
        born = elapsed;
        orbBorn.set(o, born);
      }
      drawGemDrop(g, { x, y, r: Math.max(2.5, (3.2 + o.value) * z), value: o.value, age: elapsed - born, soft });
    }

    // 加速星屑拖尾(soft 全关)
    if (!soft) stardust.draw(g, toX, toY, z);

    // 蛇:从短到长画,自己最后画在最上面
    const order = [...runners].sort((a, b) => a.shown - b.shown);
    for (const r of order) {
      if (!r.alive && r.fade <= 0) continue;
      const alpha = r.alive ? 1 : Math.max(0, r.fade / FADE_SEC);
      const rad = Math.max(2, lenToRadius(r.shown) * z);
      const family = patternFamily(r.skin.pattern);
      const nodes = r.nodes;
      const lastIdx = Math.max(1, nodes.length - 1);
      g.globalAlpha = alpha;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const nd = nodes[i];
        const x = toX(nd.x);
        const y = toY(nd.y);
        if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
        const taper = 0.55 + 0.45 * (1 - i / Math.max(1, nodes.length));
        const baseColor = nodeColor(r.skin, i);
        // 渐变尾族:越靠尾越浅,整条蛇是一段渐变
        const color = family === "gradient" ? tint(baseColor, (0.38 * i) / lastIdx) : baseColor;
        // 节间填缝:相邻节中点补一个圆,高速转弯不断珠
        if (i < nodes.length - 1) {
          const nb = nodes[i + 1];
          const bx = toX(nb.x);
          const by = toY(nb.y);
          if (!(bx < -30 || by < -30 || bx > w + 30 || by > h + 30)) {
            const taper2 = 0.55 + 0.45 * (1 - (i + 1) / Math.max(1, nodes.length));
            drawBodyNode(g, {
              x: (x + bx) / 2,
              y: (y + by) / 2,
              r: rad * ((taper + taper2) / 2) * 0.9,
              color,
              plain: true
            });
          }
        }
        // 行进法线:背脊高光带往这边偏
        const ahead = i > 0 ? nodes[i - 1] : { x: r.x, y: r.y };
        const behind = nodes[Math.min(nodes.length - 1, i + 1)];
        const dx = ahead.x - behind.x;
        const dy = ahead.y - behind.y;
        const dl = Math.hypot(dx, dy) || 1;
        drawBodyNode(g, { x, y, r: rad * taper, color, nx: -dy / dl, ny: dx / dl, pattern: family, index: i });
      }
      // 头:椭圆 + 表情(boost 眯眼 / 死亡 X 眼) + 双人头饰
      const hx = toX(r.x);
      const hy = toY(r.y);
      drawSnakeHead(g, {
        x: hx,
        y: hy,
        r: rad * 1.08,
        angle: r.angle,
        color: r.color,
        boosting: r.alive && r.boosting,
        dead: !r.alive,
        accessory: rad > 3 ? accessoryFor(r.human) : null,
        soft
      });
      if (rad > 5) drawNameTag(g, { x: hx, y: hy - rad * 1.5 - 13, text: r.name, color: r.color });
      g.globalAlpha = 1;
    }

    // 缩圈:圈外青灰罩 + 双层光带,画在场上东西之上才有「罩」的感觉
    if (zone) {
      drawShrinkZone(g, { cx: toX(zone.cx), cy: toY(zone.cy), r: Math.max(2, zone.radius * z), w, h, t: elapsed, soft });
    }

    // 夜色迷雾里的罗盘小地图(默认位不遮蛇头)
    if (cfg.fog) {
      const rr = 40;
      const dots: RadarDot[] = [];
      for (const r of runners) {
        if (!r.alive) continue;
        dots.push({ x: r.x / cfg.mapR, y: r.y / cfg.mapR, color: r.color, me: r.id === id });
      }
      drawCompassRadar(g, { cx: w - rr - 10, cy: h - rr - 10, r: rr, t: elapsed, soft, dots });
    }
  }

  function renderHud(): void {
    const me = humans[0] ? runnerById(humans[0].id) : undefined;
    if (!me) return;
    lenEl.textContent = `🐍 长度 ${Math.round(me.shown)}${cfg.goal === "intercept" ? ` · 已拦 ${me.stops}/${cfg.targetStops}` : ""}`;
    if (timeEl) timeEl.textContent = `⏱️ ${Math.max(0, Math.ceil(cfg.timeSec - elapsed))}`;
    const rows = leaderboard(rankInputs(), 10);
    const myRank = rankOf(rankInputs(), me.id);
    boardEl.innerHTML =
      rows
        .map((r, i) => `<div class="${r.id === me.id ? "sr-me" : ""}">${i + 1}. ${r.name} ${Math.round(r.length)}</div>`)
        .join("") + (myRank > 10 ? `<div class="sr-me">${selfLine(myRank, me.length)}</div>` : "");
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    const me = humans[0] ? runnerById(humans[0].id) : undefined;
    opts.sfx(won ? "win" : "oops");
    const result: RunResult = {
      won,
      length: me?.length ?? 0,
      rank: me ? Math.max(1, rankOf(rankInputs(), me.id) || runners.length) : 1,
      stops: me?.stops ?? 0,
      usedSec: elapsed,
      alive: Boolean(me?.alive),
      curve: me ? [...lenLog, Math.round(me.shown)] : [...lenLog]
    };
    later(() => opts.onDone(result), 340);
  }

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!ended && !paused) update(dt);
    // 加速星屑拖尾:纯视觉,boost 的每帧在尾节后方撒 2 颗(soft 全关)
    if (!soft && !paused) {
      stardust.step(dt);
      if (!ended) {
        for (const r of runners) {
          if (!r.alive || !r.boosting) continue;
          const tail = r.nodes[r.nodes.length - 1];
          if (!tail) continue;
          stardust.spawn(tail.x, tail.y, r.angle, ++dustSeed);
          stardust.spawn(tail.x, tail.y, r.angle, ++dustSeed);
        }
      }
    }
    canvases.forEach((c, i) => drawPane(c, humans[i]?.id ?? runners[0].id));
    renderHud();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      while (offs.length) offs.pop()?.();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      boostHeld.clear();
      brakeHeld.clear();
      wrap.remove();
    }
  };
}

/** 造一批本机 AI 对手 */
export function makeBots(n: number, tier: AiTier): Owner[] {
  const out: Owner[] = [];
  const count = Math.max(0, Math.round(n));
  for (let i = 0; i < count; i++) {
    out.push({
      id: `bot${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      color: BOT_COLORS[i % BOT_COLORS.length],
      skin: SKINS[(i + 1) % SKINS.length],
      tier
    });
  }
  return out;
}

/** 战役一共拿了多少颗星,皮肤解锁看这个 */
function campaignStars(): number {
  try {
    return totalStars(loadStars(meta.id));
  } catch {
    return 0;
  }
}

/** 玩家当前选中的皮肤,存在本游戏自己的 key 里,不动平台 key 的语义 */
function currentSkin(): Skin {
  try {
    return parseSkinChoice(localStorage.getItem(SKIN_KEY), campaignStars());
  } catch {
    return SKINS[0];
  }
}

function chooseSkin(skin: Skin): void {
  try {
    localStorage.setItem(SKIN_KEY, serializeSkinChoice(skin));
  } catch {
    // 隐私模式下写不进去也不影响这一局的玩法
  }
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  const owners: Owner[] = [
    { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin: currentSkin() },
    ...makeBots(cfg.bots, cfg.botTier)
  ];
  const run = createRun(stage, {
    cfg,
    owners,
    sfx: ctx.sfx,
    onDone: (r) => {
      const value = cfg.goal === "intercept" ? r.stops : r.length;
      if (r.won) ctx.win(starsFor(value, goalTarget(cfg), r.usedSec, cfg.timeSec), runLine(true, r.rank, r.length));
      else ctx.lose(runLine(false, r.rank, r.length));
    }
  });
  return { destroy: () => run.destroy() };
}

// ---------------------------------------------------------------------------
// 混战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 原野混战",
  endless: "♾️ 缩圈无尽",
  duo: "👫 双人同屏"
};

/** 无尽两波之间的过场停顿(毫秒) */
export const WAVE_BREAK_MS = 1400;

/**
 * 一波打完之后该干什么。
 *
 * 原先赢下一波是 `wave += 1; start();` 一气呵成:原野「唰」地重置,孩子只看见
 * 角上的波次数字加了一,不知道自己刚才过了。抽成纯函数之后,过场那句话
 * 和「下一波是第几波」都能单独钉住,DOM 那边只负责照着做。
 */
export function afterWave(
  won: boolean,
  wave: number,
  length: number,
  bestLen: number
): { kind: "next" | "over"; nextWave: number; title: string; sub: string } {
  const len = Math.round(Math.max(0, Number.isFinite(length) ? length : 0));
  const w = Math.max(1, Math.round(Number.isFinite(wave) ? wave : 1));
  if (won) {
    return {
      kind: "next",
      nextWave: w + 1,
      title: `🎉 第 ${w} 波达成！`,
      sub: `这一波长到 ${len},第 ${w + 1} 波马上来。`
    };
  }
  return {
    kind: "over",
    nextWave: 1,
    title: "长蛇打了个盹",
    sub: `第 ${w} 波结束,这一局长到 ${len},最长纪录 ${Math.round(Math.max(0, Number.isFinite(bestLen) ? bestLen : 0))}。下一次早点往圈里挪！`
  };
}

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "sr-mode";
  wrap.innerHTML = `<style>${SR_CSS}</style>`;
  const head = document.createElement("div");
  head.className = "sr-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "sr-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "sr-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let run: { destroy: () => void } | null = null;
  let wave = 1;
  let bestLen = save.getGameProgress(meta.id).endlessBest;
  let waveTimer = 0;

  function clearWaveTimer(): void {
    if (waveTimer) clearTimeout(waveTimer);
    waveTimer = 0;
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  /** 过场:把上一波收干净,亮一句「第 N 波达成」,停一下再开下一波 */
  function showWaveBreak(title: string, sub: string): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "sr-over";
    box.innerHTML = `<div class="sr-over-t">${title}</div><div class="sr-over-s">${sub}</div>`;
    stage.appendChild(box);
    clearWaveTimer();
    waveTimer = setTimeout(() => {
      waveTimer = 0;
      start();
    }, WAVE_BREAK_MS) as unknown as number;
  }

  function showOver(title: string, sub: string, again: string, deco?: { rank: number; stops: number; curve: number[] }): void {
    clearWaveTimer();
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "sr-over";
    box.innerHTML = `<div class="sr-over-t">${title}</div><div class="sr-over-s">${sub}</div>`;
    // 1.3 结算装饰:名次奖杯 + 本局长度曲线,拦下过人再亮盾徽
    if (deco) {
      const cv = document.createElement("canvas") as HTMLCanvasElement;
      cv.className = "sr-sumcv";
      cv.width = 320;
      cv.height = 130;
      cv.setAttribute("aria-hidden", "true");
      const sg = cv.getContext?.("2d");
      if (sg) drawSummary(sg, { w: 320, h: 130, rank: deco.rank, stops: deco.stops, curve: deco.curve });
      box.appendChild(cv);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sr-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      wave = 1;
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function start(): void {
    clearWaveTimer();
    run?.destroy();
    stage.innerHTML = "";
    const skin = currentSkin();
    if (mode === "endless") {
      const cfg = endlessConfig(wave);
      chip.textContent = `♾️ 第 ${wave} 波 · 最长 ${bestLen}`;
      run = createRun(stage, {
        cfg,
        owners: [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin }, ...makeBots(cfg.bots, cfg.botTier)],
        banner: `${AI_TIER_LABELS[cfg.botTier]}对手`,
        sfx: (n) => api.play(n),
        onDone: (r) => {
          bestLen = save.recordEndlessBest(meta.id, Math.round(r.length));
          const step = afterWave(r.won, wave, r.length, bestLen);
          if (step.kind === "over") {
            showOver(step.title, step.sub, "🔁 再来一局", { rank: r.rank, stops: r.stops, curve: r.curve });
            return;
          }
          api.addStars(1);
          wave = step.nextWave;
          showWaveBreak(step.title, step.sub);
        }
      });
      return;
    }
    if (mode === "versus") {
      const cfg: SnakeLevel = { ...endlessConfig(3), goal: "length", targetLen: 120, timeSec: 110, shrink: 0, mapR: 1300, fog: false };
      run = createRun(stage, {
        cfg,
        owners: [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin }, ...makeBots(7, "pro")],
        banner: "🤝 限时混战",
        sfx: (n) => api.play(n),
        onDone: (r) => {
          if (r.won) api.addStars(2);
          showOver(
            r.won ? "混战赢下来啦！" : "这一局到此为止",
            `${runLine(r.won, r.rank, r.length)} 用时 ${Math.round(r.usedSec)} 秒,拦下 ${r.stops} 条。`,
            "🔁 再打一场",
            { rank: r.rank, stops: r.stops, curve: r.curve }
          );
        }
      });
      return;
    }
    const cfg: SnakeLevel = { ...endlessConfig(2), goal: "length", targetLen: 100, timeSec: 100, shrink: 0, mapR: 1200, fog: false };
    run = createRun(stage, {
      cfg,
      owners: [
        { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo", skin },
        { id: "star", name: "星星", color: "#A9C8F5", human: "star", skin: SKINS[3] },
        ...makeBots(3, "normal")
      ],
      banner: "👫 朵朵 WASD+F/G · 星星 方向键+L/K",
      split: true,
      sfx: (n) => api.play(n),
      onDone: (r) => {
        showOver("这一局结束啦", "两个人一起玩,谁绕得漂亮谁就赢一半。再来一局吧！", "🔁 再来一局", {
          rank: r.rank,
          stops: r.stops,
          curve: r.curve
        });
      }
    });
  }

  start();

  return {
    destroy() {
      clearWaveTimer();
      run?.destroy();
      run = null;
      wrap.remove();
    }
  };
}

/** 皮肤选择条:只写进本游戏自己的进度字段 */
function mountSkinBar(host: HTMLElement, api: GameApi): { destroy: () => void } {
  const bar = document.createElement("div");
  bar.className = "sr-skins";
  const hint = document.createElement("div");
  hint.className = "sr-msg";

  function render(): void {
    const stars = campaignStars();
    const open = unlockedSkins(stars);
    const cur = currentSkin();
    bar.innerHTML = "";
    for (const s of SKINS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sr-skin";
      const got = open.some((k) => k.id === s.id);
      btn.textContent = got ? s.name : `${s.name} · ${s.needStars}⭐`;
      btn.setAttribute("aria-pressed", String(cur.id === s.id));
      btn.title = s.desc;
      if (!got) btn.disabled = true;
      btn.addEventListener("click", () => {
        api.play("tap");
        chooseSkin(s);
        render();
      });
      bar.appendChild(btn);
    }
    hint.textContent = nextSkinHint(stars);
  }
  render();
  host.append(bar, hint);
  return {
    destroy() {
      bar.remove();
      hint.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = SR_CSS;
  const bar = document.createElement("div");
  bar.className = "sr-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "sr-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const skinHost = document.createElement("div");
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, skinHost, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    skinHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sr-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      skinHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const skins = mountSkinBar(skinHost, api);

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 进关先把模式条与皮肤架收起来并把战场滚到眼前:手机上选关格子在页面
      // 下半段,不收的话开局画面还停在顶上的模式按钮那里,孩子以为没反应
      // (1.3 UX 走查修复;回地图时 destroy 里再放出来)
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        skinHost.hidden = true;
        try {
          stage.scrollIntoView?.({ block: "start" });
        } catch {
          // 老浏览器不支持 options 就算了,不影响开局
        }
        const handle = playLevel(stage, ctx);
        return {
          destroy() {
            handle.destroy?.();
            bar.hidden = false;
            skinHost.hidden = false;
          }
        };
      },
      mapHint: "只有头碰到别人的身体才会先去休息,自己的身体永远安全。",
      grandMessage: "188 关全部拿下,长蛇杯冠军就是你！",
      guideTitle: "长蛇争霸 · 原野笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      skins.destroy();
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const ROYALE_CONSTS = { BOOST_MUL, SPACING, TURN_RATE, ZONE_PERIOD, FADE_SEC, START_LEN };
