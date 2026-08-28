import { meta } from "./meta";
export { meta };

// 圆圆大作战:俯视竞技场。188 关战役 + 本地混战 + 缩圈无尽 + 同屏双人。
// 所有「其他玩家」都是本机 AI,全程离线,不开任何网络连接。
import { fitPanesToStage, mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { prefersReducedMotion } from "../../engine/view25d";
import { makeCollectBurst, type CollectBurst } from "../../art/kit";
import {
  CREST_COLORS,
  drawArenaBackground,
  drawJellyOrb,
  drawNameTag,
  drawPellet,
  drawResultArt,
  drawSpikeBall,
  drawSplitStretch,
  drawSpore,
  drawZone,
  makePelletSprites,
  pelletStyle,
  themeFor
} from "./art";
import { aiSteer, AI_TIER_LABELS, type AiTier } from "./ai";
import { CHAPTERS, endlessConfig, goalLine, levelConfig, starsFor, type OrbLevel } from "./levels";
import {
  EAT_RATIO,
  MAX_CELLS,
  MIN_MASS,
  PELLET_MASS,
  VIRUS_MASS,
  canEat,
  canMerge,
  clampToMap,
  decayMass,
  dist,
  eatVirus,
  ejectSpore,
  feedVirus,
  isSpent,
  leaderboard,
  massToRadius,
  massToSpeed,
  mergeCells,
  rankOf,
  runLine,
  shrinkZone,
  splitCell,
  totalMass,
  zoneDrain,
  type Cell,
  type Pellet,
  type Spore,
  type Vec,
  type Virus,
  type Zone
} from "./logic";

/** 本作原创的圆圆名字,只用自家角色和拟声词 */
const BOT_NAMES = ["糯糯", "云云", "墩墩", "闪闪", "绿绿豆", "啾啾", "团团", "圆圆 3 号", "圆圆 7 号", "泡泡", "咕咕"];
const BOT_COLORS = ["#F6B8D0", "#B8D8F6", "#CDEFC0", "#F8DFA8", "#D9C6F5", "#A9E5DE", "#F5C2A8", "#C9D6F7", "#EEC9E8", "#BFE7B0", "#F2D6B8"];

/**
 * 按住不放时系统会一秒发三十来个 `keydown`。方向键该跟着连发(松手才停),
 * 但分裂和吐球是「按一下算一下」—— 手指在分裂键上多停半秒,
 * 一整颗圆圆会当场炸成 16 瓣,谁都来不及合回去。这里只放行方向键。
 */
const REPEATABLE_KEYS = new Set(["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export function acceptsRepeat(key: string): boolean {
  return REPEATABLE_KEYS.has(key.length === 1 ? key.toLowerCase() : key);
}

export const OA_CSS = `
.oa-wrap{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#F3EEFF,#FBF6FF);
  border-radius:16px;padding:10px;user-select:none;position:relative;}
.oa-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;margin-bottom:6px;}
.oa-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#6b53a8;
  box-shadow:0 2px 6px rgba(150,130,200,.25);}
.oa-canvas{width:100%;border-radius:14px;display:block;background:#F7F3FF;touch-action:none;}
.oa-panes{display:flex;flex-direction:column;gap:6px;}
.oa-pad{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.oa-btn{min-width:88px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;background:#DCCEF7;color:#4b3a75;box-shadow:0 3px 0 #B9A5E3;padding:0 14px;}
.oa-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #B9A5E3;}
.oa-btn.oa-star{background:#CFE3FA;color:#2f4a75;box-shadow:0 3px 0 #A6C4E8;}
.oa-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.oa-board{position:absolute;top:44px;right:14px;background:#ffffffdb;border-radius:12px;padding:6px 9px;
  font-size:16px;font-weight:800;color:#5b4a86;line-height:1.5;max-width:44%;}
.oa-board summary{cursor:pointer;font-size:16px;}
.oa-row{display:flex;align-items:center;gap:5px;}
.oa-row canvas{flex:0 0 auto;border-radius:50%;}
.oa-rname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:8em;}
.oa-rmass{margin-left:auto;padding-left:8px;color:#7a67ab;font-variant-numeric:tabular-nums;}
.oa-over-art{display:block;margin:0 auto 10px;max-width:100%;}
.oa-me{color:#a8347a;}
.oa-msg{text-align:center;min-height:20px;color:#6b53a8;font-weight:800;margin-top:6px;font-size:16px;line-height:1.45;
  overflow-wrap:anywhere;}
.oa-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会把浏览器自带的 [hidden]{display:none} 顶掉,进关收条全靠这一句 */
.oa-modebar[hidden]{display:none;}
.oa-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#6b53a8;text-align:center;overflow-wrap:anywhere;}
.oa-open{border:none;border-radius:999px;padding:9px 18px;min-height:44px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#9b7ede,#7b5cc4);box-shadow:0 4px 0 #62479f;}
.oa-open:active{transform:translateY(2px);box-shadow:0 2px 0 #62479f;}
.oa-mode{max-width:720px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.oa-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.oa-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#7b5cc4;box-shadow:0 3px 0 rgba(120,90,180,.3);}
.oa-over{text-align:center;padding:24px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(150,130,200,.25);}
.oa-over-t{font-size:21px;font-weight:900;color:#6b53a8;margin-bottom:8px;}
.oa-over-s{font-size:16px;font-weight:700;color:#7a67ab;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
@media (max-width:360px){
  .oa-badge{padding:4px 8px;}
  .oa-board{max-width:52%;}
  .oa-btn{min-width:72px;font-size:14px;}
}
/* N-60:闯关技能键复用双人底栏;双人 paneH 仍 200,零回归 */
@media (max-height:500px){
  .oa-pad{position:sticky;bottom:0;z-index:6;margin-top:4px;padding:6px 0 2px;
    background:linear-gradient(180deg,rgba(243,238,255,.2),#F3EEFF 40%);}
  .oa-msg{min-height:0;max-height:1.5em;overflow:hidden;margin-top:4px;}
  .oa-board{max-width:36%;}
}
`;

/** 双人同屏画布逻辑高:915 横屏四键在屏,勿改 */
export const OA_DUO_PANE_H = 200;
/** 闯关默认画布逻辑高(高屏) */
export const OA_SOLO_PANE_H = 360;
/** 矮横屏闯关改走双人那档,技能键才能落在 412 内 */
export const OA_SHORT_PANE_H = 200;

function shortLandscapeH(): boolean {
  try {
    return Boolean(globalThis.matchMedia?.("(max-height: 500px)")?.matches);
  } catch {
    return false;
  }
}

export function orbPaneH(humanCount: number, shortH = shortLandscapeH()): number {
  if (humanCount > 1) return OA_DUO_PANE_H;
  return shortH ? OA_SHORT_PANE_H : OA_SOLO_PANE_H;
}

export interface Owner {
  id: string;
  name: string;
  color: string;
  /** 人类玩家:朵朵用 WASD+F/G,星星用方向键 +L/K */
  human?: "duo" | "star";
  tier?: AiTier;
  /** 队友(第 8 章):不能吃掉他最后一颗圆 */
  ally?: boolean;
}

export interface RunResult {
  won: boolean;
  mass: number;
  rank: number;
  usedSec: number;
  reason: "target" | "time" | "spent" | "ally";
  /** 本局质量成长采样(约每秒一点),给结算曲线小图用;纯展示字段 */
  massCurve?: number[];
}

export interface RunOpts {
  cfg: OrbLevel;
  owners: Owner[];
  banner?: string;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onDone: (r: RunResult) => void;
  /** 双人同屏时给两块画面 */
  split?: boolean;
}

export function createRun(stage: HTMLElement, opts: RunOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  const owners = opts.owners;
  const humans = owners.filter((o) => o.human);
  const names: Record<string, string> = {};
  for (const o of owners) names[o.id] = o.name;
  const soft = prefersReducedMotion();

  let destroyed = false;
  let ended = false;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let seq = 0;
  let paused = false;

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

  const cells: Cell[] = [];
  const pellets: Pellet[] = [];
  const viruses: Virus[] = [];
  const spores: Spore[] = [];
  let zone: Zone | null =
    cfg.shrink > 0
      ? { cx: cfg.mapW / 2, cy: cfg.mapH / 2, radius: Math.min(cfg.mapW, cfg.mapH) * 0.52 }
      : null;

  const rand = (): number => Math.random();
  const nextId = (p: string): string => `${p}${++seq}`;

  // ---- 视觉层状态(只影响演出,不碰胜负数值) ----
  const theme = themeFor(cfg.level);
  const pelletSprites = makePelletSprites();
  const ownerById = new Map(owners.map((o) => [o.id, o]));
  /** 吞吃/被吞的表情窗口:ownerId → 截止秒 */
  const eatFaceUntil = new Map<string, number>();
  const oopsFaceUntil = new Map<string, number>();
  /** 分身拉丝:分裂后 0.3s 内两球之间画果冻拉伸带 */
  const stretches: Array<{ a: string; b: string; until: number }> = [];
  const STRETCH_SEC = 0.3;
  /** 吞吃爆星(kit 共享粒子;soft 时 kit 自动降级为淡出光圈) */
  const bursts: CollectBurst[] = [];
  /** 本局质量曲线采样(结算小图用) */
  const massSamples: number[] = [30];
  let sampleAt = 0;

  /** 人类头饰:P1 金星 / P2 银月(形状 + 颜色双通道);AI 不戴 */
  function crestOf(o?: Owner): { crest: "star" | "moon"; color: string } | null {
    if (o?.human === "duo") return { crest: "star", color: CREST_COLORS.star };
    if (o?.human === "star") return { crest: "moon", color: CREST_COLORS.moon };
    return null;
  }

  owners.forEach((o, i) => {
    const ang = (Math.PI * 2 * i) / owners.length;
    cells.push({
      id: nextId("c"),
      owner: o.id,
      mass: 30,
      x: cfg.mapW / 2 + Math.cos(ang) * cfg.mapW * 0.3,
      y: cfg.mapH / 2 + Math.sin(ang) * cfg.mapH * 0.3,
      vx: 0,
      vy: 0,
      bornAt: 0
    });
  });
  for (let i = 0; i < cfg.pellets; i++) {
    pellets.push({ id: nextId("p"), x: rand() * cfg.mapW, y: rand() * cfg.mapH });
  }
  for (let i = 0; i < cfg.viruses; i++) {
    viruses.push({ id: nextId("v"), x: rand() * cfg.mapW, y: rand() * cfg.mapH, mass: VIRUS_MASS, fed: 0 });
  }

  // ---- DOM ----
  const wrap = document.createElement("div");
  wrap.className = "oa-wrap";
  wrap.innerHTML = `
    <style>${OA_CSS}</style>
    <div class="oa-top">
      <span class="oa-badge oa-mass">⚪ 质量 30</span>
      <span class="oa-badge oa-goal">${goalLine(cfg)}</span>
      ${cfg.timeSec > 0 ? `<span class="oa-badge oa-time">⏱️ ${cfg.timeSec}</span>` : ""}
      ${opts.banner ? `<span class="oa-badge">${opts.banner}</span>` : ""}
    </div>
    <div class="oa-panes"></div>
    <details class="oa-board" open><summary>🏅 排行榜</summary><div class="oa-board-rows"></div></details>
    <div class="oa-pad"></div>
    <div class="oa-msg"></div>
  `;
  stage.appendChild(wrap);

  const panes = wrap.querySelector(".oa-panes") as HTMLElement;
  const massEl = wrap.querySelector(".oa-mass") as HTMLElement;
  const timeEl = wrap.querySelector(".oa-time") as HTMLElement | null;
  const boardEl = wrap.querySelector(".oa-board-rows") as HTMLElement;
  const padEl = wrap.querySelector(".oa-pad") as HTMLElement;
  const msgEl = wrap.querySelector(".oa-msg") as HTMLElement;
  msgEl.textContent = "吃彩豆长大,别贴着比你大的圆圆走。";

  const canvases: HTMLCanvasElement[] = [];
  const paneW = 640;
  const paneH = orbPaneH(humans.length);
  for (let i = 0; i < Math.max(1, humans.length); i++) {
    const c = document.createElement("canvas");
    c.className = "oa-canvas";
    c.width = paneW;
    c.height = paneH;
    c.setAttribute("aria-label", `${humans[i]?.name ?? "圆圆"} 的竞技场画面`);
    panes.appendChild(c);
    canvases.push(c);
  }

  /** 每个人类玩家的准星(世界坐标) */
  const aims = new Map<string, Vec>();
  for (const h of humans) aims.set(h.id, { x: cfg.mapW / 2, y: cfg.mapH / 2 });
  /** 键盘方向 */
  const keyDir = new Map<string, Vec>();
  for (const h of humans) keyDir.set(h.id, { x: 0, y: 0 });

  function ownCells(id: string): Cell[] {
    return cells.filter((c) => c.owner === id);
  }

  function doSplit(ownerId: string): void {
    const mine = ownCells(ownerId);
    if (mine.length === 0) return;
    const aim = aims.get(ownerId) ?? { x: cfg.mapW / 2, y: cfg.mapH / 2 };
    const biggest = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
    const out = splitCell(biggest, aim, mine.length, elapsed, nextId("s"));
    if (out.length < 2) return;
    const idx = cells.indexOf(biggest);
    cells.splice(idx, 1, out[0], out[1]);
    if (!soft) stretches.push({ a: out[0].id, b: out[1].id, until: elapsed + STRETCH_SEC });
    opts.sfx("pop");
  }

  function doSpit(ownerId: string): void {
    const mine = ownCells(ownerId);
    if (mine.length === 0) return;
    const aim = aims.get(ownerId) ?? { x: cfg.mapW / 2, y: cfg.mapH / 2 };
    let any = false;
    for (const c of mine) {
      const out = ejectSpore(c, aim, nextId("sp"));
      if (!out) continue;
      c.mass = out.cell.mass;
      spores.push(out.spore);
      any = true;
    }
    if (any) opts.sfx("tap");
  }

  // ---- 触屏 / 键盘 ----
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

  for (const h of humans) {
    const row = document.createElement("div");
    row.style.display = "contents";
    const sp = document.createElement("button");
    sp.type = "button";
    sp.className = `oa-btn${h.human === "star" ? " oa-star" : ""}`;
    sp.textContent = `${h.name} ✂️ 分身`;
    sp.addEventListener("click", () => doSplit(h.id));
    const ej = document.createElement("button");
    ej.type = "button";
    ej.className = `oa-btn${h.human === "star" ? " oa-star" : ""}`;
    ej.textContent = `${h.name} 💧 吐孢子`;
    ej.addEventListener("click", () => doSpit(h.id));
    padEl.append(row, sp, ej);
  }

  // 卡底留白(trio-r4 遗留):按钮/提示都建齐后量一次壳卡缺口,把画布加高,竖屏不再露一大截白底
  fitPanesToStage(wrap, canvases, paneW, paneH);

  const DUO_KEYS: Record<string, Vec> = { w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };
  const STAR_KEYS: Record<string, Vec> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
  };

  function applyKey(ownerId: string, v: Vec, down: boolean): void {
    const cur = keyDir.get(ownerId) ?? { x: 0, y: 0 };
    const next = down
      ? { x: v.x !== 0 ? v.x : cur.x, y: v.y !== 0 ? v.y : cur.y }
      : { x: v.x !== 0 ? 0 : cur.x, y: v.y !== 0 ? 0 : cur.y };
    keyDir.set(ownerId, next);
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
    if (e.repeat && !acceptsRepeat(e.key)) {
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo) {
      if (DUO_KEYS[k]) {
        applyKey(duo.id, DUO_KEYS[k], true);
        e.preventDefault();
      }
      if (k === "f") doSplit(duo.id);
      if (k === "g") doSpit(duo.id);
    }
    const target = star ?? duo;
    if (target && STAR_KEYS[e.key]) {
      applyKey(target.id, STAR_KEYS[e.key], true);
      e.preventDefault();
    }
    if (star) {
      if (k === "l") doSplit(star.id);
      if (k === "k") doSpit(star.id);
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo && DUO_KEYS[k]) applyKey(duo.id, DUO_KEYS[k], false);
    const target = star ?? duo;
    if (target && STAR_KEYS[e.key]) applyKey(target.id, STAR_KEYS[e.key], false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  interface Camera {
    x: number;
    y: number;
    zoom: number;
  }

  function cameraFor(ownerId: string, canvas: HTMLCanvasElement): Camera {
    const mine = ownCells(ownerId);
    if (mine.length === 0) return { x: cfg.mapW / 2, y: cfg.mapH / 2, zoom: canvas.width / cfg.mapW };
    const big = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
    const span = Math.max(360, massToRadius(totalMass(cells, ownerId)) * (cfg.fog ? 9 : 14));
    return { x: big.x, y: big.y, zoom: Math.min(1.6, canvas.width / span) };
  }

  function update(dt: number): void {
    elapsed += dt;

    // 视觉:质量曲线约每秒采一点;过期的分身拉丝顺手收掉
    if (humans[0] && elapsed - sampleAt >= 1 && massSamples.length < 300) {
      sampleAt = elapsed;
      massSamples.push(totalMass(cells, humans[0].id));
    }
    while (stretches.length && stretches[0].until <= elapsed) stretches.shift();

    // 人类:键盘方向优先,没按键就朝准星走
    for (const h of humans) {
      const dir = keyDir.get(h.id) ?? { x: 0, y: 0 };
      const mine = ownCells(h.id);
      if (mine.length === 0) continue;
      if (dir.x !== 0 || dir.y !== 0) {
        const big = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
        aims.set(h.id, { x: big.x + dir.x * 300, y: big.y + dir.y * 300 });
      }
    }

    // AI:每个 owner 用最大的那颗做决策
    for (const o of owners) {
      if (o.human) continue;
      const mine = ownCells(o.id);
      if (mine.length === 0) continue;
      const big = mine.reduce((a, b) => (a.mass >= b.mass ? a : b));
      const move = aiSteer(
        { self: big, pellets, others: cells.filter((c) => c.owner !== o.id), viruses, mapW: cfg.mapW, mapH: cfg.mapH },
        o.tier ?? "normal",
        rand
      );
      aims.set(o.id, move.aim);
      if (move.split) {
        const out = splitCell(big, move.aim, mine.length, elapsed, nextId("s"));
        if (out.length === 2) {
          cells.splice(cells.indexOf(big), 1, out[0], out[1]);
          if (!soft) stretches.push({ a: out[0].id, b: out[1].id, until: elapsed + STRETCH_SEC });
        }
      }
      if (move.spit) {
        const out = ejectSpore(big, move.aim, nextId("sp"));
        if (out) {
          big.mass = out.cell.mass;
          spores.push(out.spore);
        }
      }
    }

    // 移动
    for (const c of cells) {
      const aim = aims.get(c.owner) ?? { x: c.x, y: c.y };
      const dx = aim.x - c.x;
      const dy = aim.y - c.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const sp = massToSpeed(c.mass);
        c.x += (dx / len) * sp * dt;
        c.y += (dy / len) * sp * dt;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= Math.max(0, 1 - 4 * dt);
      c.vy *= Math.max(0, 1 - 4 * dt);
      c.mass = decayMass(c.mass, dt);
      if (zone) c.mass = zoneDrain(c, zone, dt);
      const clamped = clampToMap(c, cfg.mapW, cfg.mapH);
      c.x = clamped.x;
      c.y = clamped.y;
    }
    if (zone) zone = shrinkZone(zone, dt, cfg.shrink);

    // 吃彩豆
    for (const c of cells) {
      const r = massToRadius(c.mass);
      for (let i = 0; i < pellets.length; i++) {
        if (dist(c, pellets[i]) < r + 4) {
          c.mass += PELLET_MASS;
          pellets[i] = { id: nextId("p"), x: rand() * cfg.mapW, y: rand() * cfg.mapH };
          if (humans.some((h) => h.id === c.owner)) opts.sfx("coin");
        }
      }
    }

    // 孢子
    for (let i = spores.length - 1; i >= 0; i--) {
      const s = spores[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.max(0, 1 - 3.4 * dt);
      s.vy *= Math.max(0, 1 - 3.4 * dt);
      let gone = false;
      for (const v of viruses) {
        if (dist(s, v) < massToRadius(v.mass)) {
          const fed = feedVirus(v, s, nextId("v"));
          v.x = fed.virus.x;
          v.y = fed.virus.y;
          v.mass = fed.virus.mass;
          v.fed = fed.virus.fed;
          if (fed.spawned) viruses.push(fed.spawned);
          gone = true;
          break;
        }
      }
      if (!gone) {
        for (const c of cells) {
          if (dist(s, c) < massToRadius(c.mass) && c.owner !== s.owner) {
            c.mass += s.mass;
            gone = true;
            break;
          }
        }
      }
      if (gone) spores.splice(i, 1);
    }

    // 刺球
    for (const c of [...cells]) {
      for (let i = viruses.length - 1; i >= 0; i--) {
        const v = viruses[i];
        if (dist(c, v) > massToRadius(c.mass)) continue;
        const res = eatVirus(c, v, ownCells(c.owner).length, elapsed);
        if (res.popped || res.cells[0].mass !== c.mass) {
          viruses.splice(i, 1);
          cells.splice(cells.indexOf(c), 1, ...res.cells);
          if (res.popped) {
            opts.sfx("pop");
            if (bursts.length < 24) bursts.push(makeCollectBurst({ x: v.x, y: v.y, reduced: soft, color: "#8fd48f", count: 6 }));
          }
          viruses.push({ id: nextId("v"), x: rand() * cfg.mapW, y: rand() * cfg.mapH, mass: VIRUS_MASS, fed: 0 });
        }
        break;
      }
    }

    // 合并与吞噬
    for (let i = cells.length - 1; i >= 0; i--) {
      for (let j = cells.length - 1; j >= 0; j--) {
        if (i === j || i >= cells.length || j >= cells.length) continue;
        const a = cells[i];
        const b = cells[j];
        if (!a || !b) continue;
        if (a.owner === b.owner) {
          if (canMerge(a, elapsed) && canMerge(b, elapsed) && dist(a, b) < massToRadius(a.mass)) {
            cells.splice(i, 1, mergeCells(a, b));
            cells.splice(j, 1);
          }
          continue;
        }
        if (canEat(a, b, elapsed)) {
          const victim = owners.find((o) => o.id === b.owner);
          const eater = owners.find((o) => o.id === a.owner);
          if (victim?.ally && eater?.human && ownCells(b.owner).length <= 1) {
            finish(false, "ally");
            return;
          }
          // 视觉:吞吃演出(弹走 + 星星,无血腥)——吃到 ≥ 自身 1/3 质量才爆星
          const bigBite = b.mass * 3 >= a.mass;
          eatFaceUntil.set(a.owner, elapsed + 0.25);
          oopsFaceUntil.set(b.owner, elapsed + 0.2);
          if (bigBite && bursts.length < 24) {
            bursts.push(makeCollectBurst({ x: b.x, y: b.y, reduced: soft, color: victim?.color ?? "#f7c6de", count: 8 }));
          }
          a.mass += b.mass;
          cells.splice(j, 1);
          if (humans.some((h) => h.id === a.owner)) opts.sfx("pop");
        }
      }
    }

    // 掉到下限就先去休息
    for (let i = cells.length - 1; i >= 0; i--) {
      if (isSpent(cells[i].mass)) cells.splice(i, 1);
    }

    for (const h of humans) {
      if (ownCells(h.id).length === 0) {
        finish(false, "spent");
        return;
      }
      if (totalMass(cells, h.id) >= cfg.targetMass) {
        finish(true, "target");
        return;
      }
    }
    if (cfg.timeSec > 0 && elapsed >= cfg.timeSec) {
      const me = humans[0];
      const mass = me ? totalMass(cells, me.id) : 0;
      finish(mass >= cfg.targetMass, "time");
    }
  }

  function drawPane(canvas: HTMLCanvasElement, ownerId: string): void {
    const g = canvas.getContext("2d");
    if (!g) return;
    const cam = cameraFor(ownerId, canvas);
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);

    // 糖果竞技场:渐变底 + 6% 网格 + 视差圆斑 + 世界边缘条纹墙(主题按关卡分段换色)
    drawArenaBackground(g, { w, h, camX: cam.x, camY: cam.y, zoom: cam.zoom, mapW: cfg.mapW, mapH: cfg.mapH, theme });

    const toX = (x: number): number => w / 2 + (x - cam.x) * cam.zoom;
    const toY = (y: number): number => h / 2 + (y - cam.y) * cam.zoom;

    // 安全区 → 风暴光环:双层描边 + 圈外罩 + 绕行光点(soft 关光点)
    if (zone) {
      drawZone(g, {
        x: toX(zone.cx),
        y: toY(zone.cy),
        r: zone.radius * cam.zoom,
        w,
        h,
        t: elapsed,
        soft,
        shrinking: cfg.shrink > 0
      });
    }

    // 彩豆 → 星光糖:确定性哈希选型,预渲染贴图,矢量兜底
    for (const p of pellets) {
      const x = toX(p.x);
      const y = toY(p.y);
      if (x < -12 || y < -12 || x > w + 12 || y > h + 12) continue;
      const st = pelletStyle(p.x, p.y);
      drawPellet(g, pelletSprites, x, y, Math.max(2.4, 4 * cam.zoom), st.kind, st.phase, elapsed, soft);
    }

    // 孢子:带高光的小水珠,颜色跟吐它的圆圆走
    for (const s of spores) {
      drawSpore(g, toX(s.x), toY(s.y), Math.max(2, massToRadius(s.mass) * cam.zoom), ownerById.get(s.owner)?.color);
    }

    // 刺球 → 危险仙人掌球:渐变内芯 + 逐根尖刺 + 凶脸 + 呼吸(soft 停呼吸)
    for (const v of viruses) {
      const x = toX(v.x);
      const y = toY(v.y);
      const r = massToRadius(v.mass) * cam.zoom;
      if (x < -r * 1.5 || y < -r * 1.5 || x > w + r * 1.5 || y > h + r * 1.5) continue;
      drawSpikeBall(g, x, y, r, elapsed + v.x * 0.013 + v.y * 0.007, soft);
    }

    // 分身拉丝:分裂后 0.3s 两球之间的果冻拉伸带
    for (const st of stretches) {
      const a = cells.find((c) => c.id === st.a);
      const b = cells.find((c) => c.id === st.b);
      if (!a || !b) continue;
      drawSplitStretch(g, {
        x1: toX(a.x),
        y1: toY(a.y),
        r1: massToRadius(a.mass) * cam.zoom,
        x2: toX(b.x),
        y2: toY(b.y),
        r2: massToRadius(b.mass) * cam.zoom,
        color: ownerById.get(a.owner)?.color ?? "#d9c6f5",
        k: Math.max(0, Math.min(1, (st.until - elapsed) / STRETCH_SEC))
      });
    }

    // 圆圆 → 有脸的果冻球:渐变 + rim + 高光三件套,瞳孔朝移动方向,人类戴头饰
    const sorted = [...cells].sort((a, b) => a.mass - b.mass);
    for (const c of sorted) {
      const o = ownerById.get(c.owner);
      const x = toX(c.x);
      const y = toY(c.y);
      const r = Math.max(3, massToRadius(c.mass) * cam.zoom);
      if (x < -r - 40 || y < -r - 40 || x > w + r + 40 || y > h + r + 40) continue;
      const aim = aims.get(c.owner);
      let lookX = 0;
      let lookY = 0;
      if (aim) {
        const dx = aim.x - c.x;
        const dy = aim.y - c.y;
        const len = Math.hypot(dx, dy);
        if (len > 4) {
          lookX = dx / len;
          lookY = dy / len;
        }
      }
      const mouth =
        (eatFaceUntil.get(c.owner) ?? 0) > elapsed ? "eat" : (oopsFaceUntil.get(c.owner) ?? 0) > elapsed ? "oops" : "smile";
      const cr = crestOf(o);
      drawJellyOrb(g, {
        x,
        y,
        r,
        color: o?.color ?? "#D9C6F5",
        lookX,
        lookY,
        mouth,
        crest: cr?.crest ?? null,
        crestColor: cr?.color,
        soft
      });
      if (r > 14 && o) drawNameTag(g, x, y + r + 11, o.name);
    }

    // 吞吃爆星:世界坐标 → 相机变换后统一画(soft 时 kit 降级为淡出光圈)
    if (bursts.length > 0) {
      g.save();
      g.translate(w / 2 - cam.x * cam.zoom, h / 2 - cam.y * cam.zoom);
      g.scale(cam.zoom, cam.zoom);
      for (const b of bursts) b.draw(g);
      g.restore();
    }
  }

  /** 排行榜重建的节流状态:名单没变就每 0.25s 刷一次数字,别每帧重建 DOM */
  let boardSig = "";
  let boardAt = -1;

  function renderHud(): void {
    const me = humans[0];
    if (!me) return;
    massEl.textContent = `⚪ 质量 ${Math.round(totalMass(cells, me.id))} / ${cfg.targetMass}`;
    if (timeEl) timeEl.textContent = `⏱️ ${Math.max(0, Math.ceil(cfg.timeSec - elapsed))}`;
    const rows = leaderboard(cells, names, 10);
    const myRank = rankOf(cells, names, me.id);
    const sig = rows.map((r) => r.id).join("|") + (myRank > 10 ? `#${myRank}` : "");
    if (boardAt >= 0 && sig === boardSig && elapsed - boardAt < 0.25) return;
    boardSig = sig;
    boardAt = elapsed;
    boardEl.innerHTML =
      rows
        .map(
          (r, i) =>
            `<div class="oa-row${r.id === me.id ? " oa-me" : ""}"><canvas class="oa-ava" width="22" height="22" aria-hidden="true"></canvas><span class="oa-rname">${i + 1}. ${r.name}</span><span class="oa-rmass">${Math.round(r.mass)}</span></div>`
        )
        .join("") +
      (myRank > 10 ? `<div class="oa-me">第 ${myRank} 名 · 质量 ${Math.round(totalMass(cells, me.id))}</div>` : "");
    // 头像小圆:直接复用果冻球绘制函数的 22px 版
    const avas = boardEl.querySelectorAll("canvas");
    rows.forEach((r, i) => {
      const cv = avas[i] as HTMLCanvasElement | undefined;
      const ag = cv?.getContext?.("2d");
      if (!ag) return;
      ag.clearRect(0, 0, 22, 22);
      const o = ownerById.get(r.id);
      const cr = crestOf(o);
      drawJellyOrb(ag, {
        x: 11,
        y: 13,
        r: 6.5,
        color: o?.color ?? "#d9c6f5",
        avatar: true,
        soft,
        crest: cr?.crest ?? null,
        crestColor: cr?.color
      });
    });
  }

  function finish(won: boolean, reason: RunResult["reason"]): void {
    if (ended) return;
    ended = true;
    const me = humans[0];
    const mass = me ? totalMass(cells, me.id) : 0;
    const rank = me ? Math.max(1, rankOf(cells, names, me.id)) : 1;
    opts.sfx(won ? "win" : "oops");
    const result: RunResult = {
      won,
      mass,
      rank,
      usedSec: elapsed,
      reason,
      massCurve: me ? [...massSamples, mass] : undefined
    };
    later(() => opts.onDone(result), 320);
  }

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!ended && !paused) update(dt);
    // 爆星粒子只是演出:暂停时冻结,结束后让它播完
    if (!paused) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        bursts[i].step(dt);
        if (bursts[i].done()) bursts.splice(i, 1);
      }
    }
    canvases.forEach((c, i) => drawPane(c, humans[i]?.id ?? humans[0]?.id ?? owners[0].id));
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
      wrap.remove();
    }
  };
}

function makeBots(n: number, tier: AiTier, ally: boolean): Owner[] {
  const out: Owner[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `bot${i}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      color: BOT_COLORS[i % BOT_COLORS.length],
      tier,
      ally: ally && i === 0
    });
  }
  return out;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  const owners: Owner[] = [
    { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" },
    ...makeBots(cfg.bots, cfg.botTier, cfg.ally)
  ];
  const run = createRun(stage, {
    cfg,
    owners,
    sfx: ctx.sfx,
    onDone: (r) => {
      if (r.won) ctx.win(starsFor(r.mass, cfg.targetMass, r.usedSec, cfg.timeSec), runLine(true, r.rank, r.mass));
      else if (r.reason === "ally") ctx.lose("队友的最后一颗圆要留住呀,下一次绕开它！");
      else ctx.lose(runLine(false, r.rank, r.mass));
    }
  });
  return { destroy: () => run.destroy() };
}

// ---------------------------------------------------------------------------
// 混战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 圆圆混战",
  endless: "♾️ 缩圈无尽",
  duo: "👫 双人同屏"
};

/** 无尽两波之间的过场停顿(毫秒) */
export const WAVE_BREAK_MS = 1400;

/**
 * 一波打完之后该干什么。
 *
 * 原先赢下一波是 `wave++; start();` 一气呵成:场面「唰」地重置,孩子只看见
 * 角上的波次数字从 1 变成 2,不知道自己刚才过了。抽成纯函数之后,过场那句话
 * 和「下一波是第几波」都能单独钉住,DOM 那边只负责照着做。
 */
export function afterWave(
  won: boolean,
  wave: number,
  total: number,
  best: number
): { kind: "next" | "over"; nextWave: number; title: string; sub: string } {
  const mass = Math.round(Math.max(0, Number.isFinite(total) ? total : 0));
  const w = Math.max(1, Math.round(Number.isFinite(wave) ? wave : 1));
  if (won) {
    return {
      kind: "next",
      nextWave: w + 1,
      title: `🎉 第 ${w} 波达成！`,
      sub: `累计长到 ${mass} 质量,第 ${w + 1} 波马上来。`
    };
  }
  return {
    kind: "over",
    nextWave: 1,
    title: "圆圆先去休息啦",
    sub: `一共长到 ${mass} 质量,最好成绩 ${Math.round(Math.max(0, Number.isFinite(best) ? best : 0))}。下一次早点往圈里挪！`
  };
}

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "oa-mode";
  wrap.innerHTML = `<style>${OA_CSS}</style>`;
  const head = document.createElement("div");
  head.className = "oa-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "oa-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "oa-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let run: { destroy: () => void } | null = null;
  let wave = 1;
  let total = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
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
    box.className = "oa-over";
    box.innerHTML = `<div class="oa-over-t">${title}</div><div class="oa-over-s">${sub}</div>`;
    stage.appendChild(box);
    clearWaveTimer();
    waveTimer = setTimeout(() => {
      waveTimer = 0;
      start();
    }, WAVE_BREAK_MS) as unknown as number;
  }

  function showOver(title: string, sub: string, again: string, extra?: { rank: number; curve?: number[] }): void {
    clearWaveTimer();
    run?.destroy();
    run = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "oa-over";
    box.innerHTML = `<div class="oa-over-t">${title}</div><div class="oa-over-s">${sub}</div>`;
    // 名次奖杯(前三名金银铜,Canvas 画)+ 本局质量曲线小图
    if (extra) {
      const art = document.createElement("canvas");
      art.className = "oa-over-art";
      art.width = 260;
      art.height = 96;
      const ag = art.getContext("2d");
      if (ag) drawResultArt(ag, 260, 96, extra.rank, extra.curve ?? []);
      box.appendChild(art);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "oa-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      wave = 1;
      total = 0;
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function start(): void {
    clearWaveTimer();
    run?.destroy();
    stage.innerHTML = "";
    if (mode === "endless") {
      const cfg = endlessConfig(wave);
      chip.textContent = `♾️ 第 ${wave} 波 · 累计 ${Math.round(total)} · 最好 ${best}`;
      run = createRun(stage, {
        cfg,
        owners: [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" }, ...makeBots(cfg.bots, cfg.botTier, false)],
        banner: `${AI_TIER_LABELS[cfg.botTier]}对手`,
        sfx: (n) => api.play(n),
        onDone: (r) => {
          total += r.mass;
          best = save.recordEndlessBest(meta.id, Math.round(total));
          const step = afterWave(r.won, wave, total, best);
          if (step.kind === "over") {
            showOver(step.title, step.sub, "🔁 再来一局", { rank: r.rank, curve: r.massCurve });
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
      const cfg = { ...endlessConfig(3), shrink: 0, timeSec: 100, targetMass: 320, mapW: 1800, mapH: 1800 };
      run = createRun(stage, {
        cfg,
        owners: [{ id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" }, ...makeBots(7, "pro", false)],
        banner: "🤝 限时混战",
        sfx: (n) => api.play(n),
        onDone: (r) => {
          if (r.won) api.addStars(2);
          showOver(
            r.won ? "混战赢下来啦！" : "这一局到此为止",
            `${runLine(r.won, r.rank, r.mass)} 用时 ${Math.round(r.usedSec)} 秒。`,
            "🔁 再打一场",
            { rank: r.rank, curve: r.massCurve }
          );
        }
      });
      return;
    }
    const cfg = { ...endlessConfig(2), shrink: 0, timeSec: 90, targetMass: 260, mapW: 1600, mapH: 1600 };
    run = createRun(stage, {
      cfg,
      owners: [
        { id: "me", name: "朵朵", color: "#F5A9C8", human: "duo" },
        { id: "star", name: "星星", color: "#A9C8F5", human: "star" },
        ...makeBots(3, "normal", false)
      ],
      banner: "👫 朵朵 WASD+F/G · 星星 方向键+L/K",
      split: true,
      sfx: (n) => api.play(n),
      onDone: (r) => {
        showOver("这一局结束啦", "两个人一起玩,谁的圆圆更大都算赢一半。再来一局吧！", "🔁 再来一局", {
          rank: r.rank,
          curve: r.massCurve
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
  style.textContent = OA_CSS;
  const bar = document.createElement("div");
  bar.className = "oa-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "oa-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "oa-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 进关先收模式条并把竞技场滚到眼前:手机上开局画面不再停在顶上的
      // 模式按钮那里(1.3 UX 走查修复;回地图时 destroy 里再放出来)
      playLevel: (stage, ctx) => {
        bar.hidden = true;
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
          }
        };
      },
      mapHint: "越大越慢:追不上就先回头把彩豆捡干净。",
      grandMessage: "188 关全部拿下,圆圆杯冠军就是你！",
      guideTitle: "圆圆大作战 · 竞技场笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试用:一局能不能算数,靠这几个常量钉住 */
export const ARENA_CONSTS = { MAX_CELLS, MIN_MASS, EAT_RATIO };
