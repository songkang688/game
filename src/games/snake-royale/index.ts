import { meta } from "./meta";
export { meta };

// 长蛇争霸:开阔原野上的本地竞技。188 关战役 + 本机混战 + 缩圈无尽 + 同屏双人。
// 场上所有「其他玩家」都是本机 AI,全程离线,不开任何网络连接。
import { loadStars, mountLevelGame, totalStars, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
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
import { CHAPTERS, endlessConfig, goalLine, goalTarget, levelConfig, levelWon, starsFor, type SnakeLevel } from "./levels";
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
.sr-board{position:absolute;top:46px;right:14px;background:#ffffffdb;border-radius:12px;padding:6px 9px;
  font-size:16px;font-weight:800;color:#3f7a52;line-height:1.5;max-width:44%;}
.sr-board summary{cursor:pointer;font-size:16px;}
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
.sr-open{border:none;border-radius:999px;padding:9px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#6fc48b,#4f9e6b);box-shadow:0 4px 0 #3d7d54;}
.sr-open:active{transform:translateY(2px);box-shadow:0 2px 0 #3d7d54;}
.sr-mode{max-width:760px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.sr-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.sr-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#4f9e6b;box-shadow:0 3px 0 rgba(90,150,110,.3);}
.sr-over{text-align:center;padding:24px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(120,170,130,.25);}
.sr-over-t{font-size:21px;font-weight:900;color:#3f7a52;margin-bottom:8px;}
.sr-over-s{font-size:16px;font-weight:700;color:#54886a;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
.sr-skins{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:8px 0 0;}
.sr-skin{border:2px solid transparent;border-radius:12px;padding:5px 9px;font-size:14px;font-weight:800;
  font-family:inherit;cursor:pointer;background:#ffffffd9;color:#3f7a52;min-height:36px;}
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
`;

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
  for (let i = 0; i < paneCount; i++) {
    const c = document.createElement("canvas");
    c.className = "sr-canvas";
    c.width = 640;
    c.height = paneCount > 1 ? 224 : 372;
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
    const toX = (x: number): number => w / 2 + (x - cam.x) * cam.zoom;
    const toY = (y: number): number => h / 2 + (y - cam.y) * cam.zoom;

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#F1FAEC";
    g.fillRect(0, 0, w, h);

    // 糖果原野的花纹背景
    g.strokeStyle = "#DCF0D2";
    g.lineWidth = 1;
    const step = 90 * cam.zoom;
    if (step > 6) {
      for (let x = (((-cam.x * cam.zoom + w / 2) % step) + step) % step; x < w; x += step) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      for (let y = (((-cam.y * cam.zoom + h / 2) % step) + step) % step; y < h; y += step) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
    }

    // 发光围栏
    g.strokeStyle = "#8FD9A8";
    g.lineWidth = 4;
    g.beginPath();
    g.arc(toX(0), toY(0), cfg.mapR * cam.zoom, 0, Math.PI * 2);
    g.stroke();

    if (zone) {
      g.strokeStyle = "#7FC7D9";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(toX(zone.cx), toY(zone.cy), Math.max(2, zone.radius * cam.zoom), 0, Math.PI * 2);
      g.stroke();
    }

    // 星光豆
    g.fillStyle = "#F7D98C";
    for (const f of foods) {
      const x = toX(f.x);
      const y = toY(f.y);
      if (x < -8 || y < -8 || x > w + 8 || y > h + 8) continue;
      g.beginPath();
      g.arc(x, y, Math.max(2, 3.6 * cam.zoom), 0, Math.PI * 2);
      g.fill();
    }
    // 掉落光点(更亮更大)
    g.fillStyle = "#FFB8D6";
    for (const o of orbs) {
      const x = toX(o.x);
      const y = toY(o.y);
      if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
      g.beginPath();
      g.arc(x, y, Math.max(2.5, (3.5 + o.value) * cam.zoom), 0, Math.PI * 2);
      g.fill();
    }

    // 蛇:从短到长画,自己最后画在最上面
    const order = [...runners].sort((a, b) => a.shown - b.shown);
    for (const r of order) {
      if (!r.alive && r.fade <= 0) continue;
      const alpha = r.alive ? 1 : Math.max(0, r.fade / FADE_SEC);
      const rad = Math.max(2, lenToRadius(r.shown) * cam.zoom);
      g.globalAlpha = alpha;
      for (let i = r.nodes.length - 1; i >= 0; i--) {
        const nd = r.nodes[i];
        const x = toX(nd.x);
        const y = toY(nd.y);
        if (x < -30 || y < -30 || x > w + 30 || y > h + 30) continue;
        const taper = 0.55 + 0.45 * (1 - i / Math.max(1, r.nodes.length));
        g.fillStyle = nodeColor(r.skin, i);
        g.beginPath();
        g.arc(x, y, rad * taper, 0, Math.PI * 2);
        g.fill();
      }
      // 头 + 小眼睛
      const hx = toX(r.x);
      const hy = toY(r.y);
      g.fillStyle = r.color;
      g.beginPath();
      g.arc(hx, hy, rad * 1.08, 0, Math.PI * 2);
      g.fill();
      if (rad > 4) {
        const ex = Math.cos(r.angle + 0.6) * rad * 0.5;
        const ey = Math.sin(r.angle + 0.6) * rad * 0.5;
        const fx = Math.cos(r.angle - 0.6) * rad * 0.5;
        const fy = Math.sin(r.angle - 0.6) * rad * 0.5;
        g.fillStyle = "#ffffff";
        g.beginPath();
        g.arc(hx + ex, hy + ey, rad * 0.32, 0, Math.PI * 2);
        g.arc(hx + fx, hy + fy, rad * 0.32, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#3a5c46";
        g.beginPath();
        g.arc(hx + ex, hy + ey, rad * 0.15, 0, Math.PI * 2);
        g.arc(hx + fx, hy + fy, rad * 0.15, 0, Math.PI * 2);
        g.fill();
      }
      if (rad > 5) {
        g.fillStyle = "#3f6b4f";
        g.font = "700 12px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "bottom";
        g.fillText(r.name, hx, hy - rad * 1.6);
      }
      // 加速尾焰(关掉动效时不画)
      if (r.alive && r.boosting && !soft) {
        const tail = r.nodes[Math.min(r.nodes.length - 1, 4)];
        if (tail) {
          g.globalAlpha = alpha * 0.5;
          g.fillStyle = "#FFE7A8";
          g.beginPath();
          g.arc(toX(tail.x), toY(tail.y), rad * 1.5, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }

    // 夜色迷雾里的小地图雷达
    if (cfg.fog) {
      const size = 74;
      const ox = w - size - 10;
      const oy = h - size - 10;
      g.fillStyle = "#ffffffcc";
      g.fillRect(ox, oy, size, size);
      g.strokeStyle = "#8FD9A8";
      g.lineWidth = 2;
      g.strokeRect(ox, oy, size, size);
      const mini = (p: Pt): Pt => ({
        x: ox + size / 2 + (p.x / cfg.mapR) * (size / 2 - 3),
        y: oy + size / 2 + (p.y / cfg.mapR) * (size / 2 - 3)
      });
      for (const r of runners) {
        if (!r.alive) continue;
        const m = mini({ x: r.x, y: r.y });
        g.fillStyle = r.id === id ? "#E0508C" : r.color;
        g.beginPath();
        g.arc(m.x, m.y, r.id === id ? 4 : 3, 0, Math.PI * 2);
        g.fill();
      }
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
      alive: Boolean(me?.alive)
    };
    later(() => opts.onDone(result), 340);
  }

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!ended && !paused) update(dt);
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

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string, again: string): void {
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "sr-over";
    box.innerHTML = `<div class="sr-over-t">${title}</div><div class="sr-over-s">${sub}</div>`;
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
          if (r.won) {
            api.addStars(1);
            wave += 1;
            start();
          } else {
            showOver(
              "长蛇打了个盹",
              `第 ${wave} 波结束,这一局长到 ${Math.round(r.length)},最长纪录 ${bestLen}。下一次早点往圈里挪！`,
              "🔁 再来一局"
            );
          }
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
            "🔁 再打一场"
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
      onDone: () => {
        showOver("这一局结束啦", "两个人一起玩,谁绕得漂亮谁就赢一半。再来一局吧！", "🔁 再来一局");
      }
    });
  }

  start();

  return {
    destroy() {
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

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = SR_CSS;
  const bar = document.createElement("div");
  bar.className = "sr-modebar";
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

  (["versus", "endless", "duo"] as ExtraMode[]).forEach((m) => {
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
      playLevel,
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
