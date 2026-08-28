import { meta } from "./meta";
export { meta };

// 飞机小队 1.2:188 关八片天空 + 无尽「云海远征」+ 双人合作 + 双人同屏。
//
// 这是一场**纸飞机和棉花糖弹的卡通空中冒险**,不是战争:
// 敌弹是暖色大圆点(而且八种图案八种形状),我们打出去的是冷色小箭头;
// 被碰到只是打个转、闪一下、掉一级火力,换一架备用小飞机接着飞。
//
// 1.2 的四条主线:声明式弹幕语法 / 判定核心看得见 / 四条火力成长线 /
// Boss 三阶段带预告。运行时这一层还负责对象池、擦弹反馈与平台接线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import { stopSpeaking } from "../speech";
import {
  CORE_DOT_R,
  PLAYER_HIT_R,
  PLAYER_ROW,
  SKY_H,
  SKY_W,
  bossX,
  buildVolley,
  bulletTouch,
  compileDecl,
  cueOf,
  type BossSpec,
  type BulletShape,
  type PatternSpec,
} from "./bullets";
import { BOSSES, CHAPTERS, buildEndlessWave, buildSortie, formationSlot, type FoeWave, type SortieDef } from "./levels";
import { expeditionLine, expeditionScore, legAt, type Leg } from "./expedition";
import { makeBulletPool, makePuffPool, makeShotPool, spawnPooled, type PooledPuff } from "./pool";
import { LINK_DIST, POWER_MAX, TRACK_INFO, coopLink, powerLevel, shotPlan, steer, type PowerTrack } from "./power";
import GUIDE from "./guide";
import {
  CLOUD_BASE_SPEED,
  CLOUD_PARALLAX,
  CLOUD_WRAP,
  FLAME,
  LAYER_ORDER,
  LOW_CLOUD_ALPHA,
  SHADOW,
  SKS_DECOR,
  SKS_PALETTE,
  SPARKLE_LIFE_S,
  SPARKLE_MAX,
  SPIN_SMOKE_MS,
  TILT,
  TRAIL_FADE_FRAMES,
  TRAIL_STEP_S,
  WINGMAN_SCALE,
  PICKUP_BADGE,
  bossBadgeArt,
  cueGlowAlpha,
  easeOutQuad,
  foeArt,
  pickupArt,
  planePath,
  shadowScaleAt,
  tiltScaleX,
  tracePath,
  wingLights,
  type LayerName,
} from "./art";
import { shade, withAlpha } from "../../art/kit/palette";
import { ballGradient, softShadow } from "../../art/kit/volume";
import { strokeOutline } from "../../art/kit/outline";
import { makeParallax } from "../../art/kit/parallax";
import {
  FOE_INFO,
  PICKUP_INFO,
  TOUCH_LIFT,
  WEAPONS,
  applyPickup,
  canvasBoxHeight,
  circlesTouch,
  clampPlane,
  damageFoe,
  dragTarget,
  escapeLimit,
  glideAway,
  isPauseKey,
  keyToAction,
  makePlane,
  playerShots,
  skyFit,
  sortieCleared,
  sortieMessage,
  starsForSortie,
  touchPlane,
  useBomb,
  wingmanOffsets,
  wingmanShots,
  type Foe,
  type FoeKind,
  type PickupKind,
  type PlaneState,
  type SkyAction,
} from "./logic";

// ---------------------------------------------------------------------------
// 样式(全部 sks- 前缀,局部 <style>,不碰 src/styles.css)
// ---------------------------------------------------------------------------

export const CSS = `
.sks-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.sks-hud{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;margin-bottom:6px;
  padding-bottom:2px;scrollbar-width:none;}
.sks-hud::-webkit-scrollbar{display:none;}
.sks-hud .sks-back{flex:none;white-space:nowrap;}
/* 1.3:HUD 卡片化 —— 圆角 12px、白 72% 底、1.5px 描边,双人 / 分数各自一张小卡 */
.sks-chip{background:rgba(255,255,255,.72);border-radius:12px;border:1.5px solid rgba(120,150,200,.4);
  padding:4px 10px;font-size:14px;font-weight:800;color:#3F6BA8;
  box-shadow:0 2px 6px rgba(120,150,200,.24);white-space:nowrap;flex:none;}
.sks-chip-duo{background:rgba(255,230,240,.72);border-color:rgba(196,110,150,.4);color:#B44F84;}
.sks-chip-star{background:rgba(228,238,255,.72);border-color:rgba(90,130,190,.4);color:#39699F;}
.sks-chip-boss{background:rgba(244,231,251,.72);border-color:rgba(150,110,190,.4);color:#7A4EA3;}
.sks-chip-score{background:rgba(233,247,236,.72);border-color:rgba(90,160,120,.4);color:#3C7A55;}
.sks-box{position:relative;border-radius:16px;overflow:hidden;background:#EAF2FF;
  box-shadow:0 4px 12px rgba(120,150,200,.26);}
.sks-cv{display:block;width:100%;height:360px;touch-action:none;}
.sks-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(240,246,255,.94);}
.sks-veil-title{font-size:20px;font-weight:900;color:#3F6BA8;}
.sks-veil-sub{font-size:15px;font-weight:700;color:#5E769C;line-height:1.6;max-width:330px;}
.sks-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.sks-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#7FB2FF,#5A8ADD);box-shadow:0 4px 0 #4570B8;
  min-height:44px;display:inline-flex;align-items:center;}
.sks-veil-btn.sks-ghost{background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.sks-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #4570B8;}
.sks-toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:14px;font-weight:800;color:#3F6BA8;box-shadow:0 3px 8px rgba(110,140,190,.28);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.sks-toast.sks-on{opacity:1;}
.sks-opt{border:none;border-radius:999px;padding:8px 12px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#5A7BA8;box-shadow:0 2px 0 rgba(120,150,200,.3);
  white-space:nowrap;flex:none;min-height:44px;}
.sks-opt[aria-pressed="true"]{background:#DCEBFF;color:#2F5E9B;}
/* 键盘图例只是提示:一行塞不下就省略,不许把整条 HUD 顶出屏(1024 平板上量过) */
.sks-legend{align-self:center;font-size:14px;font-weight:700;color:#63799C;white-space:nowrap;
  flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;}
/* 方向盘排成一横条:纵版飞行最缺的就是竖着的地方,九宫格那一坨会把飞机顶出屏幕 */
.sks-pads{display:flex;justify-content:center;gap:10px;margin-top:6px;--k:42px;flex-wrap:wrap;}
.sks-pads[data-players="2"]{--k:44px;}
.sks-pad{display:flex;align-items:center;gap:4px;}
.sks-pad-name{font-size:14px;font-weight:800;white-space:nowrap;}
.sks-key{width:var(--k);height:var(--k);flex:none;}
.sks-key{border:none;border-radius:13px;font-size:17px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#3F6BA8;box-shadow:0 3px 0 rgba(120,150,200,.34);touch-action:none;padding:0;}
.sks-key:active,.sks-key.sks-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,150,200,.34);background:#E3EFFF;}
.sks-key-fire{background:#D8ECFF;color:#2F6BA8;}
.sks-key-bomb{background:#FFE0EC;color:#B04B7C;}
.sks-key:focus-visible,.sks-veil-btn:focus-visible,.sks-mode:focus-visible,.sks-back:focus-visible,
.sks-opt:focus-visible{outline:3px solid #24456F;outline-offset:2px;}
.sks-tip{margin-top:6px;text-align:center;font-size:14px;font-weight:700;color:#63799C;line-height:1.45;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.sks-modebar{display:flex;gap:6px;justify-content:safe center;flex-wrap:nowrap;overflow-x:auto;margin:0 0 8px;
  scrollbar-width:none;}
.sks-modebar::-webkit-scrollbar{display:none;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},进关时这条得自己收 */
.sks-modebar[hidden]{display:none;}
.sks-mode{border:none;border-radius:999px;padding:8px 13px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#7FB2FF,#5A8ADD);box-shadow:0 4px 0 #4570B8;
  white-space:nowrap;flex:none;min-height:44px;display:inline-flex;align-items:center;}
.sks-mode.sks-mode-duo{background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.sks-mode.sks-mode-vs{background:linear-gradient(180deg,#FFC46B,#E79B36);box-shadow:0 4px 0 #C07C1F;}
.sks-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #4570B8;}
.sks-topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.sks-back{border:none;border-radius:999px;padding:8px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#3F6BA8;box-shadow:0 3px 0 rgba(120,150,200,.3);min-height:44px;}
.sks-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#35608F;}
@media (max-width:420px){
  .sks-pads{--k:38px;gap:6px;}
  .sks-pads[data-players="2"]{--k:44px;}
  /* 手机上是拖着飞的,键盘说明先让位给天空 */
  .sks-legend{display:none;}
  /* 390px 手机上 HUD/模式栏改为换行:画布是固定高的,多一行只多占滚动页,
     换来「暂停」「判定点」这些按钮永远看得见 —— 藏在横滑里孩子根本发现不了 */
  .sks-hud{flex-wrap:wrap;overflow-x:visible;justify-content:center;}
  .sks-modebar{flex-wrap:wrap;overflow-x:visible;}
}
@media (prefers-reduced-motion:reduce){
  .sks-toast{transition:none;}
}
`;

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

function reducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

// ---------------------------------------------------------------------------
// 运行时数据
// ---------------------------------------------------------------------------

/** 冒烟迫降中的敌机:摇摇晃晃拖着白烟滑出画面,不炸不碎 */
interface Glider {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  life: number;
  color: string;
}

interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  vy: number;
  phase: number;
}

interface Pilot {
  index: number;
  name: string;
  ink: string;
  x: number;
  y: number;
  /** 拖动时的目标点(飞机平滑追过去,不瞬移) */
  tx: number;
  ty: number;
  dragging: boolean;
  plane: PlaneState;
  hold: Record<"left" | "right" | "up" | "down", boolean>;
  firing: boolean;
  fireCd: number;
  touched: number;
  bombsUsed: number;
  downed: number;
  /** 擦弹次数:贴着弹边过去而没被碰到 */
  grazes: number;
  /** 被碰到之后打转的剩余秒数 */
  spin: number;
  grounded: boolean;
  /** 侧倾量 -1..1(纯绘制状态:压坡度转弯的 2.5D 观感,world 坐标不掺和) */
  tilt: number;
}

const PILOT_INK = ["#B44F84", "#39699F"];
const PILOT_NAME = ["朵朵", "星星"];

function makePilot(index: number, x: number): Pilot {
  return {
    index,
    name: PILOT_NAME[index] ?? `${index + 1} 号`,
    ink: PILOT_INK[index] ?? "#5A6A90",
    x,
    y: PLAYER_ROW,
    tx: x,
    ty: PLAYER_ROW,
    dragging: false,
    plane: makePlane(index === 1 ? "wave" : "star"),
    hold: { left: false, right: false, up: false, down: false },
    firing: false,
    fireCd: 0,
    touched: 0,
    bombsUsed: 0,
    downed: 0,
    grazes: 0,
    spin: 0,
    grounded: false,
    tilt: 0,
  };
}

interface BossRuntime {
  spec: BossSpec;
  hp: number;
  phase: number;
  x: number;
  y: number;
  clock: number;
  /** 每套弹幕下一次齐射的时刻 */
  nextVolley: number[];
  volley: number[];
  hurt: number;
  /** 预告动作剩余秒数(> 0 时完全停火) */
  cueLeft: number;
  cueTotal: number;
  cueMove: "inhale" | "bloom" | "spin";
  /** 预告结束后要切到第几阶段(-1 表示只是出场预告) */
  cueTo: number;
}

export interface SortieOptions {
  host: HTMLElement;
  players: 1 | 2;
  tint: string;
  hint: string;
  waves: FoeWave[];
  boss: BossSpec | null;
  pickups: PickupKind[];
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  onFinish: (
    pilots: Pilot[],
    result: { cleared: boolean; downed: number; total: number; escaped: number; waves: number; bossDown: boolean; grazes: number }
  ) => void;
  /** 无尽 / 远征:清完一波续下一波 */
  nextWave?: (waveIndex: number) => { wave: FoeWave; pickup: PickupKind | null; tint?: string; call?: string } | null;
  pauseNote?: string;
  /** 双人合作:两机靠近时火力合流(同屏比拼模式关掉) */
  link?: boolean;
}

/** 一局的运行时切片。只读,给测试看内部状态,玩法代码不依赖它 */
export interface SortieSnapshot {
  pilots: Array<{
    x: number;
    y: number;
    power: number;
    spare: number;
    grazes: number;
    touched: number;
    spin: number;
    grounded: boolean;
  }>;
  bullets: number;
  shots: number;
  /** 场上有几发合流波 */
  merges: number;
  puffs: number;
  foes: number;
  wave: number;
  finished: boolean;
  /** 三个池子一共占着多少对象(池不膨胀断言用) */
  footprint: number;
  created: { bullets: number; shots: number; puffs: number };
  boss: { phase: number; hp: number; cueLeft: number; firing: boolean } | null;
  /** 屏震还剩多久(减少动态时恒为 0) */
  shake: number;
  /** 减少动态是不是生效了 */
  calm: boolean;
  /** 1.3 纯视觉层的家底:云层滚动量 / 装饰星屑 / 打转烟圈(destroy 归零断言用) */
  deco: { cloudScroll: number; sparkles: number; rings: number };
}

export interface SortieHandle {
  destroy: () => void;
  veil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
  snapshot: () => SortieSnapshot;
}

/** 一发合流波的冷却(秒) */
const LINK_CD = 0.5;

export function createSortie(opts: SortieOptions): SortieHandle {
  const reduce = reducedMotion();
  const wrap = el("div", "sks-wrap");
  const style = el("style");
  style.textContent = CSS;
  const hud = el("div", "sks-hud");
  const box = el("div", "sks-box");
  const canvas = el("canvas", "sks-cv");
  const toast = el("div", "sks-toast");
  box.append(canvas, toast);
  const pads = el("div", "sks-pads");
  pads.dataset.players = String(opts.players);
  const tip = el("div", "sks-tip", opts.hint);
  wrap.append(style, hud, box, pads, tip);
  opts.host.appendChild(wrap);

  const g = canvas.getContext("2d");
  const pilots: Pilot[] = [];
  for (let i = 0; i < opts.players; i++) {
    pilots.push(makePilot(i, opts.players === 1 ? SKY_W / 2 : SKY_W * (i === 0 ? 0.36 : 0.64)));
  }

  // 三个池子:敌弹 / 我方弹 / 粒子。全程复用,不在帧里新建数组
  const bullets = makeBulletPool(760);
  const shots = makeShotPool(420);
  const puffs = makePuffPool(240);

  let foes: Foe[] = [];
  let foeSeq = 0;
  let gliders: Glider[] = [];
  let pickups: Pickup[] = [];
  let boss: BossRuntime | null = null;
  let waveIndex = 0;
  let spawnedTotal = 0;
  let downedTotal = 0;
  let escapedTotal = 0;
  let bossSpawned = false;
  let bossDown = false;
  let tint = opts.tint;
  /** 打完最后一架后留一点时间放冒烟迫降的动画,别一秒切结算 */
  let endDelay = 0;
  let pendingPickups = opts.pickups.slice();
  let running = true;
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let veilNode: HTMLElement | null = null;
  let clock = 0;
  let shake = 0;
  /** 提示条什么时候收起来(走主时钟,不用 setTimeout) */
  let toastUntil = 0;
  let grazeSay = 0;
  let linkCd = 0;
  let linkGlow = 0;
  /** 判定核心默认显示;手指偏移默认开 */
  let showCore = true;
  let liftOn = true;

  // ---- 1.3 纯视觉状态(只被绘制层读写,destroy 一并归零) --------------------
  /** 三层云海的视差滚动器:高空 0.2× / 中层 0.5× / 低层 0.9× */
  const clouds = makeParallax([CLOUD_PARALLAX.hi, CLOUD_PARALLAX.mid, CLOUD_PARALLAX.low], CLOUD_WRAP);
  /** 翼尖拖出的装饰星屑(reduced 一颗不出) */
  const sparkles: Array<{ x: number; y: number; life: number }> = [];
  /** 敌机被击的打转烟圈(reduced 用一帧白闪替代) */
  const rings: Array<{ x: number; y: number; r: number; age: number }> = [];
  let sparkleGap = 0;

  const chipWave = el("span", "sks-chip");
  const chipGear = el("span", "sks-chip");
  const chipScore = el("span", "sks-chip sks-chip-score");
  const chipBoss = el("span", "sks-chip sks-chip-boss");
  const chipDuoA = el("span", "sks-chip sks-chip-duo");
  const chipDuoB = el("span", "sks-chip sks-chip-star");
  const pauseBtn = el("button", "sks-back", "⏸️ 暂停");
  pauseBtn.type = "button";
  if (opts.players === 2) hud.append(chipDuoA, chipDuoB, chipWave, chipBoss, pauseBtn);
  else hud.append(chipGear, chipScore, chipWave, chipBoss, pauseBtn);

  function coreBtnLabel(): string {
    return showCore ? "🎯 判定点:开" : "🎯 判定点:关";
  }
  function liftBtnLabel(): string {
    return liftOn ? `☝️ 手指上方 ${TOUCH_LIFT}px:开` : "☝️ 手指上方:关";
  }
  const coreBtn = el("button", "sks-opt", coreBtnLabel());
  coreBtn.type = "button";
  coreBtn.setAttribute("aria-pressed", "true");
  coreBtn.addEventListener("click", () => {
    showCore = !showCore;
    coreBtn.textContent = coreBtnLabel();
    coreBtn.setAttribute("aria-pressed", showCore ? "true" : "false");
    opts.sfx("tap");
  });
  const liftBtn = el("button", "sks-opt", liftBtnLabel());
  liftBtn.type = "button";
  liftBtn.setAttribute("aria-pressed", "true");
  liftBtn.addEventListener("click", () => {
    liftOn = !liftOn;
    liftBtn.textContent = liftBtnLabel();
    liftBtn.setAttribute("aria-pressed", liftOn ? "true" : "false");
    opts.sfx("tap");
  });
  // 两个开关和键位说明都塞进 HUD 那条横条:宽屏一行放得下就一行放。
  // ≤420px 手机上这条横条改为换行(见 CSS 媒体查询):画布是固定高的,
  // 多一行只多占滚动页,换来暂停/判定点按钮永远可见,不再藏进横滑里。
  hud.append(
    coreBtn,
    liftBtn,
    el(
      "span",
      "sks-legend",
      opts.players === 2 ? "⌨️ 朵朵 WASD·F·G / 星星 方向键·L·K" : "⌨️ WASD·方向键 / F 开火 / G 炸弹"
    )
  );

  function gearLine(p: Pilot): string {
    const lv = powerLevel(p.plane.levels);
    return `⚡Lv${lv}/${POWER_MAX} · ✈️×${p.plane.spare} · 🫧${p.plane.shield} · 💣${p.plane.bombs}`;
  }

  function totalGrazes(): number {
    return pilots.reduce((n, p) => n + p.grazes, 0);
  }

  function refreshHud(): void {
    chipWave.textContent = boss ? `🎯 剩 ${foes.length} 架` : `🌊 第 ${waveIndex} 波 · 剩 ${foes.length} 架`;
    if (opts.players === 2) {
      chipDuoA.textContent = `${pilots[0].name} ${gearLine(pilots[0])}`;
      chipDuoB.textContent = `${pilots[1].name} ${gearLine(pilots[1])}`;
    } else {
      chipGear.textContent = gearLine(pilots[0]);
      chipScore.textContent = `✨ ${downedTotal} 架 · 好险 ${totalGrazes()}`;
    }
    if (boss) {
      const pct = Math.max(0, Math.round((boss.hp / boss.spec.hp) * 100));
      const seg = boss.cueLeft > 0 ? "预告中" : boss.spec.phases[boss.phase].name;
      chipBoss.textContent = `${boss.spec.emoji} ${boss.spec.name} ${pct}% · ${seg}`;
      chipBoss.hidden = false;
    } else {
      chipBoss.hidden = true;
    }
  }

  function say(text: string, seconds = 1.4): void {
    toast.textContent = text;
    toast.classList.add("sks-on");
    toastUntil = clock + seconds;
  }

  // -------------------------------------------------------------------------
  // 发弹
  // -------------------------------------------------------------------------

  function emit(spec: PatternSpec, index: number, origin: { x: number; y: number }, aim?: { x: number; y: number }): void {
    for (const b of buildVolley(spec, index, origin, aim ? { aim } : {})) spawnPooled(bullets, b);
  }

  function puff(x: number, y: number, r: number, life: number, tone: PooledPuff["tone"], vx = 0, vy = -18): void {
    const p = puffs.acquire();
    if (!p) return;
    p.x = x;
    p.y = y;
    p.r = r;
    p.life = life;
    p.max = life;
    p.tone = tone;
    p.vx = vx;
    p.vy = vy;
  }

  function nearestPilot(x: number, y: number): Pilot | null {
    let best: Pilot | null = null;
    let bestD = Infinity;
    for (const p of pilots) {
      if (p.grounded) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // 出场
  // -------------------------------------------------------------------------

  let currentWave: FoeWave | null = null;

  function spawnWave(wave: FoeWave): void {
    currentWave = wave;
    for (let i = 0; i < wave.count; i++) {
      const kind = wave.kinds[i] ?? "scout";
      const info = FOE_INFO[kind];
      const slot = formationSlot(wave.formation, i, wave.count, SKY_W);
      foes.push({
        id: foeSeq++,
        kind,
        x: slot.x,
        y: slot.y,
        vx: 0,
        vy: info.speed * wave.speed,
        hp: info.hp,
        fireIn: wave.fireGap * (0.6 + (i / Math.max(1, wave.count)) * 0.9),
        phase: i * 0.7,
      });
    }
    spawnedTotal += wave.count;
    waveIndex++;
    refreshHud();
  }

  function spawnBoss(spec: BossSpec): void {
    const cue = cueOf(spec.phases[0]);
    boss = {
      spec,
      hp: spec.hp,
      phase: 0,
      x: SKY_W / 2,
      y: -80,
      clock: 0,
      nextVolley: spec.phases[0].patterns.map((p) => p.delay + cue.seconds + 0.6),
      volley: spec.phases[0].patterns.map(() => 0),
      hurt: 0,
      cueLeft: cue.seconds,
      cueTotal: cue.seconds,
      cueMove: cue.move,
      cueTo: -1,
    };
    say(`${spec.emoji} ${spec.name} 来啦!${cue.call}`, 2.2);
    opts.sfx("meow");
    refreshHud();
  }

  function dropPickup(x: number, y: number, kind: PickupKind): void {
    pickups.push({ kind, x, y, vy: 90, phase: 0 });
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  function fireBomb(p: Pilot): void {
    const res = useBomb(p.plane, []);
    if (!res.used) {
      say("炸弹用光啦,吃到 💣 才能补。");
      return;
    }
    p.plane = res.plane;
    p.bombsUsed++;
    const cleared = bullets.size;
    bullets.clear();
    // 炸弹让在场的小飞机统统冒烟迫降,不是炸碎
    for (const f of foes) sendHome(f, p);
    foes = [];
    if (boss) {
      boss.hp = Math.max(1, boss.hp - 6);
      boss.hurt = 0.3;
    }
    opts.sfx("win");
    if (!reduce) shake = 0.3;
    say(`炸弹!${cleared} 发棉花糖弹全变成小星星～`);
    refreshHud();
  }

  function applyAction(player: number, action: SkyAction, down: boolean): void {
    const p = pilots[player];
    if (!p || p.grounded) return;
    if (action === "fire") {
      p.firing = down;
      return;
    }
    if (action === "bomb") {
      if (down && running && !paused && !finished) fireBomb(p);
      return;
    }
    p.hold[action] = down;
  }

  function onKey(e: KeyboardEvent, down: boolean): void {
    if (isPauseKey(e.code)) {
      if (down) {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    const hit = keyToAction(e.code, opts.players);
    if (!hit) return;
    e.preventDefault();
    applyAction(hit.player, hit.action, down);
  }
  const keyDown = (e: KeyboardEvent): void => onKey(e, true);
  const keyUp = (e: KeyboardEvent): void => onKey(e, false);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  // 触屏:直接拖着自己的小飞机走。飞机停在手指**上方** 40px,
  // 免得手指正好盖住那个判定核心(单人全屏可拖,双人各拖各的)
  const drags = new Map<number, Pilot>();

  function toField(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const fit = skyFit(rect.width, rect.height);
    if (fit.scale <= 0) return null;
    return { x: (clientX - rect.left - fit.offX) / fit.scale, y: (clientY - rect.top - fit.offY) / fit.scale };
  }

  function aimDrag(p: Pilot, pt: { x: number; y: number }): void {
    const want = dragTarget(pt.x, pt.y, liftOn ? TOUCH_LIFT : 0);
    p.tx = want.x;
    p.ty = want.y;
    p.dragging = true;
  }

  const onPointerDown = (e: PointerEvent): void => {
    const pt = toField(e.clientX, e.clientY);
    if (!pt) return;
    let best: Pilot | null = null;
    let bestDist = Infinity;
    for (const p of pilots) {
      if (p.grounded) continue;
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (!best) return;
    drags.set(e.pointerId, best);
    aimDrag(best, pt);
    best.firing = true;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => {
    const pilot = drags.get(e.pointerId);
    if (!pilot) return;
    const pt = toField(e.clientX, e.clientY);
    if (!pt) return;
    aimDrag(pilot, pt);
  };
  const onPointerUp = (e: PointerEvent): void => {
    const pilot = drags.get(e.pointerId);
    if (!pilot) return;
    pilot.firing = false;
    pilot.dragging = false;
    drags.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  function buildPad(p: Pilot): HTMLElement {
    const pad = el("div", "sks-pad");
    const name = el("div", "sks-pad-name");
    name.style.color = p.ink;
    name.textContent = opts.players === 2 ? (p.index === 0 ? "朵朵" : "星星") : "拖着飞";
    pad.appendChild(name);
    const layout: Array<{ label: string; action: SkyAction; cls?: string; aria: string }> = [
      { label: "◀", action: "left", aria: "向左飞" },
      { label: "▲", action: "up", aria: "向上飞" },
      { label: "▼", action: "down", aria: "向下飞" },
      { label: "▶", action: "right", aria: "向右飞" },
      { label: "💠", action: "fire", cls: "sks-key-fire", aria: "开火" },
      { label: "💣", action: "bomb", cls: "sks-key-bomb", aria: "放炸弹" },
    ];
    for (const item of layout) {
      const btn = el("button", `sks-key${item.cls ? ` ${item.cls}` : ""}`, item.label);
      btn.type = "button";
      btn.setAttribute("aria-label", `${p.name}${item.aria}`);
      const action = item.action;
      const press = (e: Event): void => {
        e.preventDefault();
        btn.classList.add("sks-down");
        applyAction(p.index, action, true);
      };
      const release = (e: Event): void => {
        e.preventDefault();
        btn.classList.remove("sks-down");
        applyAction(p.index, action, false);
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
      pad.appendChild(btn);
    }
    return pad;
  }
  for (const p of pilots) pads.appendChild(buildPad(p));

  // -------------------------------------------------------------------------
  // 浮层
  // -------------------------------------------------------------------------

  function veil(
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    veilNode?.remove();
    const node = el("div", "sks-veil");
    node.append(el("div", "sks-veil-title", title), el("div", "sks-veil-sub", sub));
    const row = el("div", "sks-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `sks-veil-btn${b.ghost ? " sks-ghost" : ""}`, b.label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        opts.sfx("tap");
        b.onClick();
      });
      row.appendChild(btn);
    }
    node.appendChild(row);
    box.appendChild(node);
    veilNode = node;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    if (paused) {
      veil("休息一下 ⏸️", opts.pauseNote ?? "小飞机在空中盘旋等你,随时回来。", [
        { label: "继续 ▶", onClick: () => togglePause() },
      ]);
    } else {
      veilNode?.remove();
      veilNode = null;
      last = performance.now();
    }
  }
  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  function finish(cleared: boolean): void {
    if (finished) return;
    finished = true;
    running = false;
    opts.onFinish(pilots, {
      cleared,
      downed: downedTotal,
      total: spawnedTotal,
      escaped: escapedTotal,
      waves: waveIndex,
      bossDown,
      grazes: totalGrazes(),
    });
  }

  // -------------------------------------------------------------------------
  // 命中处理
  // -------------------------------------------------------------------------

  /** 敌机冒烟迫降:摇摇晃晃拖着白烟滑出画面 */
  function sendHome(foe: Foe, by: Pilot | null): void {
    const info = FOE_INFO[foe.kind];
    const away = glideAway(foe);
    gliders.push({ x: foe.x, y: foe.y, vx: away.vx, vy: away.vy, r: info.r, spin: 0, life: 2, color: info.color });
    puff(foe.x, foe.y, info.r * 0.7, 0.6, "smoke");
    // 打转烟圈(纯视觉):360ms 白圈荡开;reduced 只闪一帧
    rings.push({ x: foe.x, y: foe.y, r: info.r, age: 0 });
    downedTotal++;
    if (by) by.downed++;
    opts.sfx("pop");
    if (pendingPickups.length > 0 && Math.random() < 0.5) {
      const kind = pendingPickups.shift();
      if (kind) dropPickup(foe.x, foe.y, kind);
    }
  }

  function hurtPilot(p: Pilot): void {
    const res = touchPlane(p.plane);
    p.plane = res.plane;
    if (res.outcome === "ignored") return;
    p.touched++;
    p.spin = Math.max(p.spin, res.spin);
    if (res.outcome === "grounded") {
      p.grounded = true;
      p.firing = false;
      opts.sfx("oops");
      say(`${p.name}的${res.line}`, 1.8);
      if (pilots.every((q) => q.grounded)) finish(false);
      return;
    }
    puff(p.x, p.y, 20, 0.7, "smoke");
    opts.sfx("oops");
    if (!reduce) shake = 0.2;
    const lost = res.lost ? `(掉了一级${TRACK_INFO[res.lost].name})` : "";
    say(`${p.name}:${res.line}${lost}`, 1.8);
    refreshHud();
  }

  // -------------------------------------------------------------------------
  // 一帧
  // -------------------------------------------------------------------------

  function firePilot(p: Pilot): void {
    const plan = shotPlan(p.plane.levels);
    const weapon = WEAPONS[p.plane.weapon];
    // 单发模板取自 1.1 的三把主武器(决定弹体大小 / 速度 / 伤害),
    // 发数、拐弯与穿透则来自四条成长线
    const base = playerShots(p.plane.weapon, 1, p.x, p.y - 18)[0];
    const speed = Math.abs(base.vy);
    for (const lane of plan.lanes) {
      const s = shots.acquire();
      if (!s) break;
      s.x = base.x + lane.dx;
      s.y = base.y;
      s.vx = Math.sin(lane.angle) * speed;
      s.vy = -Math.cos(lane.angle) * speed;
      s.r = base.r;
      s.damage = base.damage;
      s.pierce = plan.pierce;
      s.homing = plan.homing;
      s.color = weapon.color;
      s.shape = plan.shape;
      s.hitIds.length = 0;
      s.dead = false;
    }
    for (const off of wingmanOffsets(plan.wingmen)) {
      const w = wingmanShots(p.plane.weapon, p.x + off.dx, p.y + off.dy - 10)[0];
      const s = shots.acquire();
      if (!s) break;
      s.x = w.x;
      s.y = w.y;
      s.vx = w.vx;
      s.vy = w.vy;
      s.r = w.r;
      s.damage = w.damage;
      s.pierce = 1;
      s.homing = plan.homing;
      s.color = weapon.color;
      s.shape = "arrow";
      s.hitIds.length = 0;
      s.dead = false;
    }
  }

  /** 双人合作的配合价值:两机靠到一起,火力拧成一道又宽又厚的彩虹合流波 */
  function fireLink(dt: number): void {
    linkCd -= dt;
    linkGlow = Math.max(0, linkGlow - dt);
    if (!opts.link || pilots.length < 2) return;
    const [a, b] = pilots;
    if (a.grounded || b.grounded) return;
    const link = coopLink(
      { x: a.x, y: a.y, levels: a.plane.levels },
      { x: b.x, y: b.y, levels: b.plane.levels }
    );
    if (!link.linked) return;
    linkGlow = 0.2;
    if (linkCd > 0) return;
    linkCd = LINK_CD;
    const s = shots.acquire();
    if (!s) return;
    s.x = link.x;
    s.y = link.y - 22;
    s.vx = 0;
    s.vy = -420;
    s.r = link.width / 2;
    s.damage = link.damage;
    s.pierce = 99;
    s.homing = 0;
    s.color = "#9BE7FF";
    s.shape = "merge";
    s.hitIds.length = 0;
    s.dead = false;
    opts.sfx("coin");
  }

  function stepPilots(dt: number): void {
    for (const p of pilots) {
      if (p.grounded) continue;
      p.plane = { ...p.plane, invuln: Math.max(0, p.plane.invuln - dt) };
      p.spin = Math.max(0, p.spin - dt);
      const speed = 250;
      let dx = 0;
      let dy = 0;
      if (p.hold.left) dx -= 1;
      if (p.hold.right) dx += 1;
      if (p.hold.up) dy -= 1;
      if (p.hold.down) dy += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        const next = clampPlane(p.x + (dx / len) * speed * dt, p.y + (dy / len) * speed * dt);
        p.x = next.x;
        p.y = next.y;
        p.tx = p.x;
        p.ty = p.y;
      } else if (p.dragging) {
        // 拖动时平滑追向手指上方那个点,不瞬移(瞬移会让判定点跟丢)
        const follow = Math.min(1, dt * 18);
        const next = clampPlane(p.x + (p.tx - p.x) * follow, p.y + (p.ty - p.y) * follow);
        p.x = next.x;
        p.y = next.y;
      }
      p.fireCd -= dt;
      // 平时自动射击(免得小朋友手忙脚乱),按住开火键只是打得更密
      if (p.fireCd <= 0) {
        p.fireCd = shotPlan(p.plane.levels).cooldown * (p.firing ? 0.62 : 1);
        firePilot(p);
      }
    }
    fireLink(dt);
  }

  function stepFoes(dt: number): void {
    const gap = currentWave?.fireGap ?? 2;
    const spec = currentWave?.fire;
    for (const f of foes) {
      f.phase += dt;
      f.y += f.vy * dt;
      f.x += Math.sin(f.phase * 1.1) * 34 * dt;
      f.fireIn -= dt;
      if (f.fireIn <= 0 && spec && f.y > 30 && f.y < SKY_H * 0.62) {
        f.fireIn = gap;
        // 锁定弹瞄真人:预警足够长,侧身一步就能让开(aimedDodgeable 有断言)
        const target = spec.kind === "aimed" ? nearestPilot(f.x, f.y) : null;
        emit(
          { ...spec, count: Math.min(spec.count, 4) },
          Math.floor(clock * 2),
          { x: f.x, y: f.y },
          target ? { x: target.x, y: target.y } : undefined
        );
      }
    }
    const escaped = foes.filter((f) => f.hp > 0 && f.y > SKY_H + 60);
    if (escaped.length > 0) {
      escapedTotal += escaped.length;
      for (const f of escaped) {
        f.hp = 0;
        puff(f.x, SKY_H - 10, 14, 0.4, "smoke");
      }
      say("有小飞机从底下溜走啦,让它们再靠近点儿。");
    }
    foes = foes.filter((f) => f.hp > 0);
  }

  function stepBoss(dt: number): void {
    if (!boss) return;
    boss.clock += dt;
    boss.hurt = Math.max(0, boss.hurt - dt);
    boss.y = boss.y < 130 ? Math.min(130, boss.y + 90 * dt) : 130;
    const ph = boss.spec.phases[boss.phase];
    boss.x = bossX(boss.clock, ph.swing);

    // 预告窗口:完全停火,场上也没有残弹 —— 一段绝对安全的读题时间
    if (boss.cueLeft > 0) {
      boss.cueLeft -= dt;
      if (boss.cueLeft <= 0) {
        boss.cueLeft = 0;
        if (boss.cueTo >= 0) {
          boss.phase = boss.cueTo;
          boss.cueTo = -1;
          const next = boss.spec.phases[boss.phase];
          boss.nextVolley = next.patterns.map((p) => boss!.clock + p.delay + 0.4);
          boss.volley = next.patterns.map(() => 0);
          say(next.shout, 2);
        }
        refreshHud();
      }
      return;
    }
    if (boss.y < 130) return;

    const now = boss.spec.phases[boss.phase];
    for (let i = 0; i < now.patterns.length; i++) {
      while (boss.clock >= boss.nextVolley[i]) {
        emit(now.patterns[i], boss.volley[i], { x: bossX(boss.nextVolley[i], now.swing), y: boss.y });
        boss.volley[i]++;
        boss.nextVolley[i] += Math.max(0.05, now.patterns[i].interval);
      }
    }
  }

  function advanceBossPhase(): void {
    if (!boss || boss.cueLeft > 0) return;
    const ratio = boss.hp / boss.spec.hp;
    const ph = boss.spec.phases[boss.phase];
    if (boss.phase < boss.spec.phases.length - 1 && ratio <= ph.until) {
      const next = boss.spec.phases[boss.phase + 1];
      const cue = cueOf(next);
      boss.cueTo = boss.phase + 1;
      boss.cueLeft = cue.seconds;
      boss.cueTotal = cue.seconds;
      boss.cueMove = cue.move;
      // 换段时把满屏的弹清掉一次,给孩子一个绝对安全的喘息
      bullets.clear();
      opts.sfx("meow");
      say(`⚠️ ${cue.call}`, cue.seconds);
      refreshHud();
    }
  }

  function bossDefeated(): void {
    if (!boss) return;
    gliders.push({
      x: boss.x,
      y: boss.y,
      vx: boss.x < SKY_W / 2 ? -60 : 60,
      vy: 110,
      r: 54,
      spin: 0,
      life: 2.6,
      color: boss.spec.phases[boss.spec.phases.length - 1].color,
    });
    for (let i = 0; i < 6; i++) puff(boss.x + (i - 3) * 18, boss.y + (i % 2) * 16, 22, 0.9, "spark");
    boss = null;
    bossDown = true;
    bullets.clear();
    opts.sfx("win");
    say("大家伙冒着白烟回机库啦!", 2);
    refreshHud();
  }

  function stepShots(dt: number): void {
    for (const s of shots.live) {
      if (s.homing > 0) {
        let tx = s.x;
        let ty = s.y - 100;
        let bestD = Infinity;
        for (const f of foes) {
          const d = (f.x - s.x) ** 2 + (f.y - s.y) ** 2;
          if (d < bestD) {
            bestD = d;
            tx = f.x;
            ty = f.y;
          }
        }
        if (boss && boss.y >= 120) {
          const d = (boss.x - s.x) ** 2 + (boss.y - s.y) ** 2;
          if (d < bestD) {
            tx = boss.x;
            ty = boss.y;
          }
        }
        const turned = steer(s.vx, s.vy, tx, ty, s.x, s.y, s.homing, dt);
        s.vx = turned.vx;
        s.vy = turned.vy;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -40 || s.y > SKY_H + 40 || s.x < -40 || s.x > SKY_W + 40) {
        s.dead = true;
        continue;
      }
      for (const f of foes) {
        if (f.hp <= 0 || s.hitIds.includes(f.id)) continue;
        if (!circlesTouch(s.x, s.y, s.r, f.x, f.y, FOE_INFO[f.kind].r)) continue;
        const res = damageFoe(f, s.damage);
        f.hp = res.foe.hp;
        s.hitIds.push(f.id);
        if (res.downed) {
          f.hp = 0;
          sendHome(f, pilots[0]);
        } else {
          puff(s.x, s.y, 8, 0.2, "spark");
        }
        if (s.hitIds.length >= s.pierce) {
          s.dead = true;
          break;
        }
      }
      if (!s.dead && boss && boss.y >= 120 && !s.hitIds.includes(-1) && circlesTouch(s.x, s.y, s.r, boss.x, boss.y, 54)) {
        boss.hp -= s.damage;
        boss.hurt = 0.12;
        s.hitIds.push(-1);
        opts.sfx("coin");
        if (s.hitIds.length >= s.pierce) s.dead = true;
        advanceBossPhase();
      }
    }
    shots.sweep((s) => !s.dead);
    foes = foes.filter((f) => f.hp > 0);
    if (boss && boss.hp <= 0) bossDefeated();
  }

  function stepPickups(dt: number): void {
    const keep: Pickup[] = [];
    for (const it of pickups) {
      it.y += it.vy * dt;
      it.phase += dt;
      if (it.y > SKY_H + 30) continue;
      let taken = false;
      for (const p of pilots) {
        if (p.grounded) continue;
        if (!circlesTouch(it.x, it.y, 16, p.x, p.y, 18)) continue;
        p.plane = applyPickup(p.plane, it.kind);
        opts.sfx("coin");
        say(`${PICKUP_INFO[it.kind].emoji} ${PICKUP_INFO[it.kind].label}!`);
        refreshHud();
        taken = true;
        break;
      }
      if (!taken) keep.push(it);
    }
    pickups = keep;
  }

  function stepBullets(dt: number): void {
    for (const b of bullets.live) {
      if (b.warn > 0) {
        b.warn -= dt;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -60 || b.x > SKY_W + 60 || b.y < -80 || b.y > SKY_H + 80) b.dead = true;
    }
    bullets.sweep((b) => !b.dead);
  }

  function stepHits(): void {
    for (const b of bullets.live) {
      if (b.warn > 0) continue;
      for (const p of pilots) {
        if (p.grounded) continue;
        const level = bulletTouch(b.x - p.x, b.y - p.y, b.r);
        if (level === "clear") continue;
        if (level === "graze") {
          const bit = 1 << p.index;
          if ((b.grazed & bit) !== 0) continue;
          b.grazed |= bit;
          p.grazes++;
          puff(p.x, p.y - 4, 16, 0.35, "graze");
          if (clock >= grazeSay) {
            grazeSay = clock + 0.9;
            say("好险!擦过去啦 ✨", 0.7);
            opts.sfx("jump");
          }
          refreshHud();
          continue;
        }
        if (p.plane.invuln > 0) continue;
        b.dead = true;
        hurtPilot(p);
        break;
      }
    }
    bullets.sweep((b) => !b.dead);

    // 撞机也只是打个转,不是「坠毁」
    for (const p of pilots) {
      if (p.grounded || p.plane.invuln > 0) continue;
      for (const f of foes) {
        if (!circlesTouch(f.x, f.y, FOE_INFO[f.kind].r, p.x, p.y, PLAYER_HIT_R + 4)) continue;
        f.hp = 0;
        sendHome(f, null);
        hurtPilot(p);
        break;
      }
      foes = foes.filter((f) => f.hp > 0);
    }
  }

  function step(dt: number): void {
    clock += dt;
    shake = Math.max(0, shake - dt);
    if (toastUntil > 0 && clock >= toastUntil) {
      toast.classList.remove("sks-on");
      toastUntil = 0;
    }
    stepPilots(dt);
    stepFoes(dt);
    stepBoss(dt);
    stepBullets(dt);
    stepShots(dt);
    stepPickups(dt);
    stepHits();

    for (const gl of gliders) {
      gl.life -= dt;
      gl.x += gl.vx * dt;
      gl.y += gl.vy * dt;
      gl.vy += 40 * dt;
      gl.spin += dt * 2;
      if (Math.random() < 0.4) puff(gl.x, gl.y, 9, 0.5, "smoke");
    }
    gliders = gliders.filter((gl) => gl.life > 0);

    for (const pf of puffs.live) {
      pf.life -= dt;
      pf.x += pf.vx * dt;
      pf.y += pf.vy * dt;
    }
    puffs.sweep((pf) => pf.life > 0);

    if (!finished && foes.length === 0 && !boss) {
      if (waveIndex < opts.waves.length) {
        spawnWave(opts.waves[waveIndex]);
      } else if (opts.boss && !bossSpawned) {
        bossSpawned = true;
        spawnBoss(opts.boss);
      } else {
        const more = opts.nextWave?.(waveIndex);
        if (more) {
          pendingPickups = more.pickup ? [more.pickup] : [];
          if (more.tint) tint = more.tint;
          if (more.call) say(more.call, 2);
          spawnWave(more.wave);
        } else {
          endDelay += dt;
          if (endDelay > 1.1) finish(true);
        }
      }
    }
    refreshHud();
  }

  /**
   * 纯视觉层的一帧:云海滚动、侧倾跟随、星屑与烟圈的寿命。
   * 只动绘制状态,一个玩法数值都不碰;reduced 时视差与星屑全部停摆。
   */
  function stepVisual(dt: number): void {
    clouds.step(dt, reduce ? 0 : CLOUD_BASE_SPEED);
    const follow = Math.min(1, (dt * 1000) / TILT.followMs);
    for (const p of pilots) {
      let dir = 0;
      if (!reduce && !p.grounded) {
        if (p.hold.left) dir -= 1;
        if (p.hold.right) dir += 1;
        if (dir === 0 && p.dragging && Math.abs(p.tx - p.x) > 4) dir = p.tx > p.x ? 1 : -1;
      }
      p.tilt += (dir - p.tilt) * follow;
      // 星屑:飞行中翼尖零星洒一点,上限封死,reduced 一颗不出
      if (!reduce && !p.grounded && (dir !== 0 || p.dragging)) {
        sparkleGap -= dt;
        if (sparkleGap <= 0 && sparkles.length < SPARKLE_MAX) {
          sparkleGap = 0.05;
          const side = Math.random() < 0.5 ? -1 : 1;
          sparkles.push({ x: p.x + side * (24 + Math.random() * 10), y: p.y + 12 + Math.random() * 8, life: SPARKLE_LIFE_S });
        }
      }
    }
    for (const s of sparkles) s.life -= dt;
    for (let i = sparkles.length - 1; i >= 0; i--) if (sparkles[i].life <= 0) sparkles.splice(i, 1);
    const ringLife = reduce ? 1 / 60 : SPIN_SMOKE_MS / 1000;
    for (const w of rings) w.age += dt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].age >= ringLife) rings.splice(i, 1);
  }

  // -------------------------------------------------------------------------
  // 绘制
  // -------------------------------------------------------------------------

  /**
   * 画布下沿最远能到哪一行。
   *
   * 外壳的 `.game-stage` 是 `overflow:hidden` 的一屏,越过它下沿的东西看不见也点不着;
   * 窗口下沿只是最后一道保险。挨个往上问一遍谁在裁剪,取最靠上的那条线。
   */
  function limitBottom(): number {
    let limit = globalThis.innerHeight || 667;
    for (let node = wrap.parentElement; node; node = node.parentElement) {
      const style = globalThis.getComputedStyle?.(node);
      if (style && style.overflowY !== "visible") {
        const bottom = node.getBoundingClientRect().bottom;
        if (bottom > 0) limit = Math.min(limit, bottom);
      }
    }
    return limit;
  }

  /** 画布底下那些按钮(开关 / 方向盘 / 提示)一共占多高 */
  function chromeBelow(): number {
    return Math.max(0, wrap.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom);
  }

  let layoutTick = 0;
  /** 当前世界 → 画布像素的比例:判定核心按屏幕像素兜底时要用 */
  let viewScale = 1;

  function resize(): void {
    const cssW = Math.max(240, box.clientWidth || wrap.clientWidth || 320);
    const room = limitBottom() - box.getBoundingClientRect().top - chromeBelow() - 6;
    const cssH = canvasBoxHeight(cssW, room);
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.round(cssW * dpr);
    const hh = Math.round(cssH * dpr);
    if (canvas.width === w && canvas.height === hh) return;
    canvas.style.height = `${cssH}px`;
    canvas.width = w;
    canvas.height = hh;
  }

  /** 敌弹八种形状:只靠颜色区分是不够的,形状也必须不一样 */
  function drawEnemyShape(ctx: CanvasRenderingContext2D, shape: BulletShape, r: number): void {
    switch (shape) {
      case "star":
      case "petal": {
        const tips = shape === "star" ? 5 : 6;
        ctx.beginPath();
        for (let i = 0; i < tips * 2; i++) {
          const rad = i % 2 === 0 ? r : r * (shape === "star" ? 0.45 : 0.62);
          const ang = (i / (tips * 2)) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(ang) * rad;
          const y = Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      case "candy":
        roundRect(ctx, -r, -r * 0.6, r * 2, r * 1.2, r * 0.5);
        break;
      case "cloud":
        ctx.beginPath();
        ctx.arc(-r * 0.5, 0, r * 0.62, 0, Math.PI * 2);
        ctx.arc(r * 0.5, 0, r * 0.62, 0, Math.PI * 2);
        ctx.arc(0, -r * 0.3, r * 0.7, 0, Math.PI * 2);
        ctx.closePath();
        break;
      case "drop":
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.25);
        ctx.quadraticCurveTo(r, 0, 0, r);
        ctx.quadraticCurveTo(-r, 0, 0, -r * 1.25);
        ctx.closePath();
        break;
      case "diamond":
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.1);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r * 1.1);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
        break;
      case "plus": {
        const t = r * 0.42;
        ctx.beginPath();
        ctx.rect(-t, -r, t * 2, r * 2);
        ctx.rect(-r, -t, r * 2, t * 2);
        break;
      }
      case "bubble":
      default:
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;
    }
  }

  function drawBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of bullets.live) {
      if (b.warn > 0) {
        // 预警:先亮一圈,再画一小段「它要往哪飞」的虚线
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.strokeStyle = "rgba(255,168,110,.95)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.r + 5, 0, Math.PI * 2);
        ctx.stroke();
        const len = Math.hypot(b.vx, b.vy) || 1;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo((b.vx / len) * (b.r + 6), (b.vy / len) * (b.r + 6));
        ctx.lineTo((b.vx / len) * (b.r + 34), (b.vy / len) * (b.r + 34));
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const ang = Math.atan2(b.vy, b.vx) - Math.PI / 2;
      // 拖尾:沿速度反方向回放 3 帧渐隐(reduced 也保留 —— 拖尾是弹道可读性)
      for (let i = TRAIL_FADE_FRAMES; i >= 1; i--) {
        ctx.save();
        ctx.translate(b.x - b.vx * TRAIL_STEP_S * i, b.y - b.vy * TRAIL_STEP_S * i);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.3 * (1 - i / (TRAIL_FADE_FRAMES + 1));
        ctx.fillStyle = SKS_DECOR.bulletFill;
        drawEnemyShape(ctx, b.shape, b.r * (1 - 0.1 * i));
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.fillStyle = SKS_DECOR.bulletFill;
      drawEnemyShape(ctx, b.shape, b.r);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(-b.r * 0.28, -b.r * 0.3, b.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShots(ctx: CanvasRenderingContext2D): void {
    for (const s of shots.live) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = s.color;
      switch (s.shape) {
        case "merge":
          ctx.globalAlpha = 0.8;
          roundRect(ctx, -s.r, -26, s.r * 2, 52, 18);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3;
          ctx.stroke();
          break;
        case "beam": {
          // 光带尾:身后一截渐隐的光,速度感全靠它
          ctx.fillStyle = withAlpha(s.color, 0.32);
          roundRect(ctx, -s.r * 0.8, 10, s.r * 1.6, 22, s.r * 0.8);
          ctx.fill();
          ctx.fillStyle = s.color;
          roundRect(ctx, -s.r, -16, s.r * 2, 32, s.r);
          ctx.fill();
          break;
        }
        case "ring":
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, s.r + 1.5, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "arrow":
        default: {
          // 光带尾:从弹身往后渐隐
          const tail = ctx.createLinearGradient(0, -s.r * 0.5, 0, s.r * 1.6 + 14);
          tail.addColorStop(0, withAlpha(s.color, 0.5));
          tail.addColorStop(1, withAlpha(s.color, 0));
          ctx.fillStyle = tail;
          roundRect(ctx, -s.r * 0.45, -s.r * 0.5, s.r * 0.9, s.r * 1.6 + 14, s.r * 0.45);
          ctx.fill();
          // 星星头:五角小星 + 亮心
          ctx.fillStyle = s.color;
          ctx.beginPath();
          const R = s.r * 1.5;
          for (let i = 0; i < 10; i++) {
            const rad = i % 2 === 0 ? R : R * 0.45;
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const px = Math.cos(a) * rad;
            const py = Math.sin(a) * rad - s.r * 0.4;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.85)";
          ctx.beginPath();
          ctx.arc(0, -s.r * 0.4, s.r * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  /**
   * 主机 / 僚机共用的机体绘制(七道工序里的 ②–⑥):
   * 后掠机翼 → 尾翼 → 三停渐变机身 + 1.5px 描边 → 玻璃舱盖斜高光 → 翼尖小灯,
   * 尾焰双层垫底。`k` 是缩放(僚机 0.55 复用同一份 `planePath`)。
   */
  function drawShip(ctx: CanvasRenderingContext2D, k: number, variant: 0 | 1, body: string, tilt: number): void {
    const path = planePath(k, variant);
    const inkLine = shade(body, -30);
    const fillPart = (segs: Parameters<typeof tracePath>[1], fill: string | CanvasGradient): void => {
      tracePath(ctx, segs);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = inkLine;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    // 工序 6 · 双层尾焰:外焰沿用 1.2 的抖动参数,内焰 0.6 倍同步缩放
    const jit = reduce ? 0 : Math.sin(clock * FLAME.jitterHz) * FLAME.jitterAmp;
    const flameY = 20 * k;
    ctx.fillStyle = SKS_PALETTE.sksFlameOut;
    ctx.beginPath();
    ctx.moveTo(-5.5 * k, flameY);
    ctx.lineTo(0, flameY + (FLAME.baseLen + jit) * k);
    ctx.lineTo(5.5 * k, flameY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SKS_PALETTE.sksFlameIn;
    ctx.beginPath();
    ctx.moveTo(-5.5 * k * FLAME.innerScale, flameY);
    ctx.lineTo(0, flameY + (FLAME.baseLen + jit) * k * FLAME.innerScale);
    ctx.lineTo(5.5 * k * FLAME.innerScale, flameY);
    ctx.closePath();
    ctx.fill();

    // 工序 2 · 后掠机翼(贝塞尔前缘):压坡度时内侧机翼抬 3px
    const liftL = tilt < 0 ? TILT.wingLiftPx * Math.min(1, -tilt) : 0;
    const liftR = tilt > 0 ? TILT.wingLiftPx * Math.min(1, tilt) : 0;
    const wingFill = shade(body, 14);
    ctx.save();
    ctx.translate(0, -liftL);
    fillPart(path.wingL, wingFill);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -liftR);
    fillPart(path.wingR, wingFill);
    ctx.restore();
    fillPart(path.finL, shade(body, -8));
    fillPart(path.finR, shade(body, -8));

    // 工序 3 · 机身三停线性渐变(顶光 +25% → 主体 → 腹部 -15%)+ 1.5px 描边
    const grad = ctx.createLinearGradient(0, -24 * k, 0, 20 * k);
    grad.addColorStop(0, shade(body, 25));
    grad.addColorStop(0.55, body);
    grad.addColorStop(1, shade(body, -15));
    fillPart(path.body, grad);

    // 工序 4 · 驾驶舱玻璃 + 斜向高光条(宽 0.3 舱宽、45°,裁在舱里)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -8 * k, 5.5 * k, 7.5 * k, 0, 0, Math.PI * 2);
    const glass = ctx.createLinearGradient(-4 * k, -15 * k, 4 * k, -1 * k);
    glass.addColorStop(0, SKS_DECOR.canopyTop);
    glass.addColorStop(1, SKS_DECOR.canopyBottom);
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = inkLine;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.clip();
    ctx.save();
    ctx.translate(0, -8 * k);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.fillRect(-1.65 * k, -9 * k, 3.3 * k, 18 * k);
    ctx.restore();
    ctx.restore();

    // 工序 5 · 翼尖小灯:左红右绿交替闪(周期 800ms,reduced 常亮)
    const lights = wingLights(clock * 1000, reduce);
    const lamp = (x: number, y: number, color: string, on: boolean): void => {
      ctx.save();
      if (on) {
        ctx.globalAlpha = ctx.globalAlpha * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 3.8 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      if (!on) ctx.globalAlpha = ctx.globalAlpha * 0.25;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 1.9 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    lamp(-33.5 * k, 10 * k - liftL, SKS_DECOR.wingLightL, lights.left);
    lamp(33.5 * k, 10 * k - liftR, SKS_DECOR.wingLightR, lights.right);
  }

  function drawPlane(ctx: CanvasRenderingContext2D, p: Pilot): void {
    const variant = (p.index === 0 ? 0 : 1) as 0 | 1;
    const body = p.index === 0 ? SKS_PALETTE.sksPlanePink : SKS_PALETTE.sksPlaneBlue;

    // 僚机:同一份剪影按 0.55 缩放复用 + 半透明牵引光索连到主机(一眼看出编队)
    for (const off of wingmanOffsets(shotPlan(p.plane.levels).wingmen)) {
      const wx = p.x + off.dx;
      const wy = p.y + off.dy;
      ctx.save();
      ctx.strokeStyle = SKS_DECOR.tether;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 8);
      ctx.quadraticCurveTo((p.x + wx) / 2, (p.y + wy) / 2 + 7, wx, wy - 8);
      ctx.stroke();
      ctx.translate(wx, wy);
      drawShip(ctx, WINGMAN_SCALE, variant, shade(body, 22), 0);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    // 被碰到 = 打个转(不是坠毁),转完就正过来
    if (p.spin > 0) ctx.rotate(p.spin * (reduce ? 2 : 9));
    if (p.plane.invuln > 0) ctx.globalAlpha = reduce ? 0.7 : 0.45 + 0.4 * Math.sin(clock * 14);
    // 工序 7 · 侧倾:scaleX 0.82–1.0 只包在这对 save/restore 里,world 坐标不动
    ctx.save();
    ctx.scale(tiltScaleX(p.tilt), 1);
    drawShip(ctx, 1, variant, body, p.tilt);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (p.plane.shield > 0) {
      ctx.strokeStyle = "rgba(140,220,255,.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 判定核心:白环 + 亮心,默认就开着 —— 孩子必须看得见「只有这一点会被碰到」。
   * 手机上天空会缩得很小,所以核心按**屏幕像素**兜底:再怎么缩也有 5px 半径。
   * 画在 planes 层最顶(所有机体之后),皮肤再华丽也盖不住它。
   */
  function drawCore(ctx: CanvasRenderingContext2D, p: Pilot): void {
    if (!showCore) return;
    const r = Math.max(CORE_DOT_R, 5 / viewScale);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = Math.max(2.4, 2 / viewScale);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = p.plane.invuln > 0 ? "#9FE3FF" : "#FF6FA8";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 四种敌机新剪影(几何在 art.ts 的 foeArt,全部落在原 info.r 判定半径内):
   * scout=纸飞机 / puff=气球飞艇 / kite=风筝 / tanker=胖运输艇。
   * 受光面统一左上,基底剪影配 1.5px 统一描边。
   */
  function drawFoe(ctx: CanvasRenderingContext2D, f: Foe): void {
    const info = FOE_INFO[f.kind];
    ctx.save();
    ctx.translate(f.x, f.y);
    const roleFill: Record<"base" | "light" | "dark" | "white", string> = {
      base: info.color,
      light: shade(info.color, 18),
      dark: shade(info.color, -26),
      white: "rgba(255,255,255,.88)",
    };
    for (const part of foeArt(f.kind, info.r)) {
      tracePath(ctx, part.segs);
      if (part.mode === "fill") {
        ctx.fillStyle = roleFill[part.role];
        ctx.fill();
        if (part.role === "base") strokeOutline(ctx, info.color, 1.5);
      } else {
        ctx.strokeStyle = roleFill[part.role];
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // 定位眼保留:它们是卡通小飞机,不是武器
    ctx.fillStyle = "#5A4A62";
    ctx.beginPath();
    ctx.arc(-info.r * 0.28, -info.r * 0.05, 2.6, 0, Math.PI * 2);
    ctx.arc(info.r * 0.28, -info.r * 0.05, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** BOSS 机体分层:蓄力红晕 → 底盘暗色 → 主体三停渐变 → 顶部炮台小剪影 → 脸 */
  function drawBoss(ctx: CanvasRenderingContext2D, b: BossRuntime): void {
    const ph = b.spec.phases[b.phase];
    const cueF = b.cueTotal > 0 ? Math.max(0, b.cueLeft) / b.cueTotal : 0;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.hurt > 0 && !reduce) ctx.translate(Math.sin(clock * 60) * 3, 0);
    // 预告动作:吸气缩一下 / 花瓣张开 / 原地转身。三种都是看得懂的大动作
    if (b.cueLeft > 0) {
      if (b.cueMove === "inhale") ctx.scale(1 - 0.18 * Math.sin((1 - cueF) * Math.PI), 1 - 0.18 * Math.sin((1 - cueF) * Math.PI));
      else if (b.cueMove === "bloom") ctx.scale(1 + 0.22 * (1 - cueF), 1 + 0.22 * (1 - cueF));
      else ctx.rotate((reduce ? 0.6 : 2.4) * (1 - cueF) * Math.PI);
    }
    // 蓄力红晕:cueLeft 越接近 0 越亮(功能提示画法升级,reduced 也保留)
    const glow = cueGlowAlpha(b.cueLeft, b.cueTotal);
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = glow;
      ctx.strokeStyle = SKS_DECOR.bossGlow;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 72, 54, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 66, 48, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // ① 底盘暗色
    ctx.fillStyle = shade(ph.color, -26);
    ctx.beginPath();
    ctx.ellipse(0, 10, 60, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    // ② 主体三停渐变 + 描边
    const grad = ctx.createLinearGradient(0, -44, 0, 44);
    grad.addColorStop(0, shade(ph.color, 25));
    grad.addColorStop(0.55, ph.color);
    grad.addColorStop(1, shade(ph.color, -15));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(ph.color, -30);
    ctx.lineWidth = 2;
    ctx.stroke();
    // ③ 顶部炮台独立小剪影:圆顶 + 天线球(可爱风,不写实)
    ctx.fillStyle = shade(ph.color, -32);
    ctx.beginPath();
    ctx.ellipse(0, -42, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(ph.color, -32);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(0, -55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -57, 3, 0, Math.PI * 2);
    ctx.fill();
    // 白肚皮 + 眼睛 + 名牌(分级风格保留:它是大家伙,不是怪物)
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.ellipse(0, -12, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5A4A62";
    ctx.beginPath();
    ctx.arc(-13, -12, 4.4, 0, Math.PI * 2);
    ctx.arc(13, -12, 4.4, 0, Math.PI * 2);
    ctx.fill();
    // 修复员 G1:肚皮名牌从 26px emoji 字形换成矢量小徽章(圆底 2 停 + 该章符号)
    const badgeBase = shade(ph.color, -12);
    const badgeGrad = ctx.createLinearGradient(0, 17, 0, 43);
    badgeGrad.addColorStop(0, shade(badgeBase, 14));
    badgeGrad.addColorStop(1, badgeBase);
    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.arc(0, 30, 13, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, badgeBase, 1.5);
    ctx.save();
    ctx.translate(0, 30);
    const badgeRole: Record<"base" | "light" | "dark" | "white", string> = {
      base: badgeBase,
      light: shade(ph.color, 26),
      dark: shade(ph.color, -44),
      white: "rgba(255,255,255,.95)",
    };
    for (const part of bossBadgeArt(b.spec.id, 9)) {
      tracePath(ctx, part.segs);
      if (part.mode === "fill") {
        ctx.fillStyle = badgeRole[part.role];
        ctx.fill();
      } else {
        ctx.strokeStyle = badgeRole[part.role];
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.lineCap = "butt";
      }
    }
    ctx.restore();
    ctx.restore();
  }

  /** BOSS 元气条(圆角壳 + 分段刻度)与预告倒计时:画布内 HUD,永远在最顶层 */
  function drawBossHud(ctx: CanvasRenderingContext2D, b: BossRuntime): void {
    const cueF = b.cueTotal > 0 ? Math.max(0, b.cueLeft) / b.cueTotal : 0;
    // 元气条 + 三段刻度(看得见「还有几段」)。本作没有血,掉光只是迫降滑走
    const w = 200;
    const pct = Math.max(0, b.hp / b.spec.hp);
    roundRect(ctx, SKY_W / 2 - w / 2, 18, w, 14, 7);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,150,200,.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    roundRect(ctx, SKY_W / 2 - w / 2 + 2, 20, (w - 4) * pct, 10, 5);
    const fillGrad = ctx.createLinearGradient(0, 20, 0, 30);
    fillGrad.addColorStop(0, shade("#F5A3C4", 18));
    fillGrad.addColorStop(1, "#F5A3C4");
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(120,150,200,.55)";
    ctx.lineWidth = 2;
    for (const ph2 of b.spec.phases) {
      if (ph2.until <= 0) continue;
      const x = SKY_W / 2 - w / 2 + w * ph2.until;
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, 32);
      ctx.stroke();
    }

    // 预告倒计时条(同一套圆角壳语言)
    if (b.cueLeft > 0) {
      roundRect(ctx, SKY_W / 2 - 70, 40, 140, 8, 4);
      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(120,150,200,.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      roundRect(ctx, SKY_W / 2 - 68, 42, 136 * (1 - cueF), 4, 2);
      ctx.fillStyle = "#FFB84D";
      ctx.fill();
    }
  }

  /** 一朵三球棉花云 + 它自己的底部投影(中层专用,云才有厚度) */
  function drawCotton(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
    softShadow(ctx, x + 4, y + 13 * k, 30 * k, 8 * k, 0.1);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = SKS_PALETTE.sksCloudMid;
    ctx.beginPath();
    ctx.arc(x - 21 * k, y + 3 * k, 15 * k, 0, Math.PI * 2);
    ctx.arc(x, y - 6 * k, 21 * k, 0, Math.PI * 2);
    ctx.arc(x + 23 * k, y + 4 * k, 14 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(): void {
    if (!g) return;
    const ctx = g;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 天空是 480×720 的定值,画布多矮都得整片装进去:等比缩放 + 居中。
    // 1.1 是按宽度缩放的,画布一矮,玩家那一行(596)就被裁到下沿外面,拖着飞却看不见自己。
    const fit = skyFit(canvas.width, canvas.height);
    const s = fit.scale;
    viewScale = s;
    const jitter = shake > 0 && !reduce ? Math.sin(clock * 70) * shake * 6 : 0;
    // 富余出来的两条边也铺同一片天,只压暗一点点当边界 —— 不留灰条
    if (fit.offX > 0.5 || fit.offY > 0.5) {
      const wide = ctx.createLinearGradient(0, 0, 0, canvas.height);
      wide.addColorStop(0, "#FFFFFF");
      wide.addColorStop(1, tint);
      ctx.fillStyle = wide;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(104,136,186,.16)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.save();
    ctx.translate(fit.offX + jitter * s, fit.offY);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.rect(0, 0, SKY_W, SKY_H);
    ctx.clip();

    // 图层序 ①–⑨ 由 LAYER_ORDER 一锤定音:云永远盖不住弹幕与判定核心
    const painters: Record<LayerName, () => void> = {
      // ① 天空三停渐变:规格顶色 → 规格底色 → 章节 tint 收在地平线
      sky: () => {
        const grad = ctx.createLinearGradient(0, 0, 0, SKY_H);
        grad.addColorStop(0, SKS_PALETTE.sksSkyTop);
        grad.addColorStop(0.6, SKS_PALETTE.sksSkyBottom);
        grad.addColorStop(1, tint);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, SKY_W, SKY_H);
      },
      // ② 高空薄云:0.2× 视差,细长条
      cloudHi: () => {
        ctx.fillStyle = SKS_PALETTE.sksCloudHi;
        for (let i = 0; i < 4; i++) {
          const cx = (i * 163 + 40) % SKY_W;
          const cy = ((i * (CLOUD_WRAP / 4) + clouds.offsets[0]) % CLOUD_WRAP) - 120;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 70, 12, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 46, cy + 8, 44, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      // ③ 中层棉花云:0.5× 视差;飞机的椭圆投影就落在这层云上(纵深靠影子)
      cloudMid: () => {
        for (let i = 0; i < 5; i++) {
          const cx = (i * 149 + 60) % SKY_W;
          const cy = ((i * (CLOUD_WRAP / 5) + 37 + clouds.offsets[1]) % CLOUD_WRAP) - 120;
          drawCotton(ctx, cx, cy, 0.8 + (i % 3) * 0.25);
        }
        for (const p of pilots) {
          if (p.grounded) continue;
          softShadow(ctx, p.x, p.y + SHADOW.offsetY, 26, 8, SHADOW.alpha, shadowScaleAt(p.y));
          for (const off of wingmanOffsets(shotPlan(p.plane.levels).wingmen)) {
            softShadow(
              ctx,
              p.x + off.dx,
              p.y + off.dy + SHADOW.offsetY * WINGMAN_SCALE,
              26 * WINGMAN_SCALE,
              8 * WINGMAN_SCALE,
              SHADOW.alpha,
              shadowScaleAt(p.y + off.dy)
            );
          }
        }
      },
      // ④ 低层大朵云:0.9× 视差,左上受光边,透明度封在 0.5 以下不遮弹幕
      cloudLow: () => {
        for (let i = 0; i < 3; i++) {
          const cx = (i * 211 + 90) % SKY_W;
          const cy = ((i * (CLOUD_WRAP / 3) + 71 + clouds.offsets[2]) % CLOUD_WRAP) - 120;
          ctx.save();
          ctx.globalAlpha = LOW_CLOUD_ALPHA;
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(cx - 35, cy - 13, 27, 0, Math.PI * 2);
          ctx.arc(cx - 3, cy - 21, 35, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = SKS_DECOR.lowCloud;
          ctx.beginPath();
          ctx.arc(cx - 30, cy - 8, 27, 0, Math.PI * 2);
          ctx.arc(cx + 2, cy - 16, 35, 0, Math.PI * 2);
          ctx.arc(cx + 38, cy - 2, 25, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      },
      // ⑤ 敌机(含迫降滑行 / Boss 机体)与敌弹
      foes: () => {
        for (const gl of gliders) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, gl.life));
          ctx.translate(gl.x, gl.y);
          ctx.rotate(reduce ? 0 : Math.sin(gl.spin) * 0.5);
          ctx.fillStyle = gl.color;
          roundRect(ctx, -gl.r * 0.8, -gl.r * 0.5, gl.r * 1.6, gl.r, gl.r * 0.4);
          ctx.fill();
          strokeOutline(ctx, gl.color, 1.5);
          ctx.restore();
        }
        for (const f of foes) drawFoe(ctx, f);
        if (boss) drawBoss(ctx, boss);
        drawBullets(ctx);
      },
      // ⑥ 我方弹与拾取物
      shots: () => {
        // 修复员 S7:平涂白圆 + emoji 字形 → kit 三停渐变专属色圈 + 矢量符号
        // (每类一个底色圈,弹雨里靠色圈 + 图形双通道识别;±3px 浮动与 reduced 分支原样)
        for (const it of pickups) {
          ctx.save();
          ctx.translate(it.x, it.y + (reduce ? 0 : Math.sin(it.phase * 4) * 3));
          const badge = PICKUP_BADGE[it.kind];
          ctx.fillStyle = ballGradient(ctx, 0, 0, 15, badge.ring);
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          strokeOutline(ctx, badge.ring, 2);
          const roleFill: Record<"base" | "light" | "dark" | "white", string> = {
            base: badge.color,
            light: shade(badge.color, 20),
            dark: shade(badge.color, -24),
            white: "rgba(255,255,255,.92)",
          };
          for (const part of pickupArt(it.kind, 8.5)) {
            tracePath(ctx, part.segs);
            if (part.mode === "fill") {
              ctx.fillStyle = roleFill[part.role];
              ctx.fill();
              if (part.role === "base") strokeOutline(ctx, badge.color, 1.5);
            } else {
              ctx.strokeStyle = roleFill[part.role];
              ctx.lineWidth = 1.6;
              ctx.lineCap = "round";
              ctx.stroke();
              ctx.lineCap = "butt";
            }
          }
          ctx.restore();
        }
        drawShots(ctx);
      },
      // ⑦ 主机 + 僚机;判定核心画在这层最顶,谁都盖不住
      planes: () => {
        // 合流提示:两机靠近时拉一条彩虹带,告诉两个人「再近一点就合体」
        if (opts.link && pilots.length === 2 && !pilots[0].grounded && !pilots[1].grounded) {
          const d = Math.hypot(pilots[0].x - pilots[1].x, pilots[0].y - pilots[1].y);
          if (d < LINK_DIST * 1.5) {
            ctx.save();
            ctx.globalAlpha = linkGlow > 0 ? 0.85 : 0.3;
            ctx.strokeStyle = linkGlow > 0 ? "#9BE7FF" : "#C9DCF5";
            ctx.lineWidth = linkGlow > 0 ? 7 : 3;
            ctx.beginPath();
            ctx.moveTo(pilots[0].x, pilots[0].y);
            ctx.lineTo(pilots[1].x, pilots[1].y);
            ctx.stroke();
            ctx.restore();
          }
        }
        for (const p of pilots) {
          if (!p.grounded) drawPlane(ctx, p);
        }
        for (const p of pilots) {
          if (!p.grounded) drawCore(ctx, p);
        }
      },
      // ⑧ 粒子:烟 / 火花 / 擦弹环 + 星屑 + 打转烟圈
      puffs: () => {
        for (const pf of puffs.live) {
          const f = Math.max(0, pf.life / pf.max);
          ctx.globalAlpha = f * 0.85;
          if (pf.tone === "graze") {
            ctx.strokeStyle = "#7FE7C4";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(pf.x, pf.y, pf.r * (1.8 - f), 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = pf.tone === "spark" ? "#FFE8A3" : "#FFFFFF";
            ctx.beginPath();
            ctx.arc(pf.x, pf.y, pf.r * (1.4 - f), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        for (const sp of sparkles) {
          const t = 1 - sp.life / SPARKLE_LIFE_S;
          ctx.globalAlpha = 0.7 * Math.max(0, 1 - t);
          ctx.fillStyle = SKS_DECOR.sparkle;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 2.6 * (1 - t * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // 打转烟圈:360ms easeOutQuad 荡开;reduced 是一帧白闪
        const dur = reduce ? 1 / 60 : SPIN_SMOKE_MS / 1000;
        for (const w of rings) {
          const t = easeOutQuad(w.age / dur);
          ctx.globalAlpha = 0.8 * (1 - t);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(w.x, w.y, w.r * (0.55 + 0.9 * t), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
      // ⑨ 画布内 HUD:Boss 元气条与预告倒计时(DOM 的 HUD 天然更上层)
      hud: () => {
        if (boss) drawBossHud(ctx, boss);
      },
    };
    for (const layer of LAYER_ORDER) painters[layer]();
    ctx.restore();

    // 能飞的那一片有多大,给条细边框标出来(留白也是天,不标就看不出边)
    if (fit.offX > 0.5 || fit.offY > 0.5) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.strokeRect(fit.offX, fit.offY, SKY_W * s, SKY_H * s);
      ctx.restore();
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (running && !paused && !finished) {
      step(dt);
      stepVisual(dt);
    }
    // 上面那条选关工具条会随着提示语变高变矮,窗口却没 resize 事件。
    // 半秒量一次,发现地方变了再改画布 —— 别让飞机悄悄溜到下沿外面。
    if (++layoutTick >= 30) {
      layoutTick = 0;
      resize();
    }
    draw();
  }

  const onResize = (): void => resize();
  window.addEventListener("resize", onResize);
  resize();
  if (opts.waves.length > 0) spawnWave(opts.waves[0]);
  else if (opts.boss) {
    bossSpawned = true;
    spawnBoss(opts.boss);
  }
  refreshHud();
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      finished = true;
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      drags.clear();
      // 状态归零:三个池子连闲置槽一起丢掉,数组清空,浮层摘掉
      bullets.drop();
      shots.drop();
      puffs.drop();
      foes = [];
      gliders = [];
      pickups = [];
      boss = null;
      // 1.3 纯视觉层一并归零:云层滚动器 / 星屑 / 烟圈
      clouds.reset();
      sparkles.length = 0;
      rings.length = 0;
      veilNode?.remove();
      veilNode = null;
      wrap.remove();
    },
    veil,
    snapshot: () => ({
      pilots: pilots.map((p) => ({
        x: p.x,
        y: p.y,
        power: powerLevel(p.plane.levels),
        spare: p.plane.spare,
        grazes: p.grazes,
        touched: p.touched,
        spin: p.spin,
        grounded: p.grounded,
      })),
      bullets: bullets.size,
      shots: shots.size,
      merges: shots.live.filter((s) => s.shape === "merge").length,
      puffs: puffs.size,
      foes: foes.length,
      wave: waveIndex,
      finished,
      footprint: bullets.footprint + shots.footprint + puffs.footprint,
      created: {
        bullets: bullets.stats().created,
        shots: shots.stats().created,
        puffs: puffs.stats().created,
      },
      boss: boss
        ? { phase: boss.phase, hp: boss.hp, cueLeft: boss.cueLeft, firing: boss.cueLeft <= 0 && boss.y >= 130 }
        : null,
      shake,
      calm: reduce,
      deco: { cloudScroll: clouds.total(), sparkles: sparkles.length, rings: rings.length },
    }),
  };
}

// ---------------------------------------------------------------------------
// 188 关闯关
// ---------------------------------------------------------------------------

function startSortie(
  stage: HTMLElement,
  def: SortieDef,
  sfx: SortieOptions["sfx"],
  done: (won: boolean, stars: 1 | 2 | 3, message: string) => void
): SortieHandle {
  let handle: SortieHandle | null = null;
  handle = createSortie({
    host: stage,
    players: 1,
    tint: CHAPTERS[def.chapter].color,
    hint: def.hint,
    waves: def.waves,
    boss: def.boss,
    pickups: def.pickups,
    sfx,
    pauseNote: def.hint,
    onFinish: (pilots, result) => {
      const p = pilots[0];
      const stat = {
        downed: result.downed,
        total: result.total,
        touched: p.touched,
        bombs: p.bombsUsed,
        escaped: result.escaped,
        bossDown: result.bossDown,
      };
      if (result.cleared && sortieCleared(stat, def.boss !== null)) {
        const extra = result.grazes > 0 ? `擦弹 ${result.grazes} 次,胆子很稳!` : "";
        done(true, starsForSortie(stat), `${sortieMessage(stat)}${extra}`);
        return;
      }
      if (!result.cleared) {
        done(
          false,
          1,
          def.boss
            ? `${def.boss.name}还剩一口气。留一颗炸弹给它的最后一段,下次一定行。`
            : "小飞机都去检修啦。记住机身判定点只有中间那一小点,别急着往缝里冲。"
        );
        return;
      }
      done(
        false,
        1,
        `放跑了 ${result.escaped} 架,超过 ${escapeLimit(result.total)} 架就得重飞一趟。别等它们贴到底才开火。`
      );
    },
  });
  return handle;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def: SortieDef = buildSortie(ctx.level);
  const sortie = startSortie(stage, def, ctx.sfx, (won, stars, message) => {
    if (won) ctx.win(stars, message);
    else ctx.lose(message);
  });
  return {
    destroy() {
      sortie.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「云海远征」
// ---------------------------------------------------------------------------

function mountExpedition(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sks-topbar");
  const back = el("button", "sks-back", "← 返回");
  back.type = "button";
  bar.append(back, el("div", "sks-title", "♾️ 云海远征"));
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let sortie: SortieHandle | null = null;
  let seed = 1;
  let legIndex = 0;
  let waveInLeg = 0;
  let leg: Leg = legAt(1, 0);

  function legWave(current: Leg, waveNo: number): FoeWave {
    const base = buildEndlessWave(
      current.index * 7 + waveNo + 1,
      current.segment.kinds,
      current.foesPerWave,
      current.difficulty
    );
    return { ...base, fire: compileDecl(current.segment.fire), fireGap: current.fireGap };
  }

  function start(): void {
    sortie?.destroy();
    stage.innerHTML = "";
    // 每趟换一颗种子;同一颗种子拼出来的航线永远一模一样
    seed = (Math.floor(Math.random() * 0xffff) + 1) >>> 0;
    legIndex = 0;
    waveInLeg = 0;
    leg = legAt(seed, 0);
    sortie = createSortie({
      host: stage,
      players: 1,
      tint: leg.segment.tint,
      hint: `云海远征:一段一段往前飞,每 ${4} 段有一朵🎁补给云。${leg.segment.call}`,
      waves: [legWave(leg, 0)],
      boss: null,
      pickups: [],
      sfx: api.play,
      pauseNote: "云海会在这里等你,回来接着飞。",
      nextWave: () => {
        waveInLeg++;
        if (waveInLeg >= leg.waves) {
          const reward = leg.reward;
          legIndex++;
          waveInLeg = 0;
          leg = legAt(seed, legIndex);
          return {
            wave: legWave(leg, 0),
            pickup: reward ? rewardPickup(reward) : null,
            tint: leg.segment.tint,
            call: `${leg.segment.emoji} 第 ${legIndex + 1} 段「${leg.segment.name}」—— ${leg.segment.call}`,
          };
        }
        return { wave: legWave(leg, waveInLeg), pickup: null };
      },
      onFinish: (pilots, result) => {
        const legs = legIndex + 1;
        const score = expeditionScore(legs, result.downed, result.grazes);
        const best = save.recordEndlessBest(meta.id, score);
        api.play(score >= best ? "win" : "oops");
        sortie?.veil(
          "这趟飞到这里 ✈️",
          `${expeditionLine(legs, result.downed, result.grazes)} 本次 ${score} 分,历史最好 ${best} 分。` +
            `(被碰到 ${pilots[0].touched} 次,航线种子 ${seed})`,
          [
            { label: "🔁 再飞一趟", onClick: () => start() },
            { label: "← 返回", ghost: true, onClick: () => onExit() },
          ]
        );
      },
    });
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });
  start();

  return {
    destroy() {
      sortie?.destroy();
      sortie = null;
      root.remove();
    },
  };
}

/** 补给云白送的那条成长线 → 关内道具 */
function rewardPickup(track: PowerTrack): PickupKind {
  switch (track) {
    case "spread":
      return "power";
    case "homing":
      return "homing";
    case "pierce":
      return "pierce";
    case "wing":
    default:
      return "wing";
  }
}

// ---------------------------------------------------------------------------
// 双人合作:靠在一起就合流
// ---------------------------------------------------------------------------

function mountCoop(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sks-topbar");
  const back = el("button", "sks-back", "← 返回");
  back.type = "button";
  bar.append(back, el("div", "sks-title", "👫 双人合作 · 合流波"));
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let sortie: SortieHandle | null = null;
  let round = 0;

  function start(): void {
    sortie?.destroy();
    stage.innerHTML = "";
    const boss = BOSSES[round % BOSSES.length];
    const leg = legAt(7, round + 1);
    sortie = createSortie({
      host: stage,
      players: 2,
      tint: "#F1ECFC",
      hint: `一起打${boss.emoji} ${boss.name}。两架飞机靠到 ${LINK_DIST} 以内会拧成一道彩虹合流波,比各打各的强得多。`,
      waves: [
        {
          ...buildEndlessWave(round + 3, leg.segment.kinds, leg.foesPerWave, leg.difficulty),
          fire: compileDecl(leg.segment.fire),
          fireGap: leg.fireGap,
        },
      ],
      boss,
      pickups: ["shield", "power", "wing"],
      sfx: api.play,
      link: true,
      pauseNote: "两个人的装备都留着,商量好再继续。",
      onFinish: (pilots, result) => {
        const together = pilots.reduce((s, p) => s + p.downed, 0);
        const won = result.cleared && result.bossDown;
        api.play(won ? "win" : "oops");
        const line = won
          ? `两个人一共请回 ${together} 架小飞机,${boss.name}也回机库啦!朵朵 ${pilots[0].downed} 架,星星 ${pilots[1].downed} 架。`
          : `这次差一点点。下次试试贴在一起飞:合流波一发能顶好几发,一个人吸引弹幕、一个人负责对准。`;
        if (won) round++;
        sortie?.veil(won ? "配合成功 🏆" : "再来一次 💪", line, [
          { label: won ? "下一位 Boss ▶" : "🔁 再试一次", onClick: () => start() },
          { label: "← 返回", ghost: true, onClick: () => onExit() },
        ]);
      },
    });
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });
  start();

  return {
    destroy() {
      sortie?.destroy();
      sortie = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏:同一片天空,各记各的战果(友好比拼,不是对战)
// ---------------------------------------------------------------------------

function mountDuo(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sks-topbar");
  const back = el("button", "sks-back", "← 返回");
  back.type = "button";
  bar.append(back, el("div", "sks-title", "🙌 双人同屏 · 各飞各的"));
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let sortie: SortieHandle | null = null;
  let round = 0;

  function start(): void {
    sortie?.destroy();
    stage.innerHTML = "";
    const waves: FoeWave[] = [];
    for (let i = 0; i < 3; i++) {
      const leg = legAt(21, round * 3 + i);
      waves.push({
        ...buildEndlessWave(round * 3 + i + 2, leg.segment.kinds, leg.foesPerWave, leg.difficulty),
        fire: compileDecl(leg.segment.fire),
        fireGap: leg.fireGap,
      });
    }
    sortie = createSortie({
      host: stage,
      players: 2,
      tint: "#FFF3E4",
      hint: "同一片天空,各飞各的:三波过后看谁请回机库的多。谁先没备用机了,另一个继续飞完。",
      waves,
      boss: null,
      pickups: ["power", "shield", "wing", "homing"],
      sfx: api.play,
      link: false,
      pauseNote: "两个人一起歇会儿,回来接着飞。",
      onFinish: (pilots, result) => {
        const [a, b] = pilots;
        api.play(result.cleared ? "win" : "oops");
        const line =
          a.downed === b.downed
            ? `打成平手!两个人各请回 ${a.downed} 架小飞机,擦弹一共 ${result.grazes} 次。`
            : `${a.downed > b.downed ? a.name : b.name}这一趟多请回了几架:朵朵 ${a.downed} 架,星星 ${b.downed} 架 —— 另一位下次贴着弹走试试,擦弹也算本事。`;
        if (result.cleared) round++;
        sortie?.veil(result.cleared ? "这一趟飞完啦 🎉" : "再来一趟 💪", line, [
          { label: "🔁 再飞一趟", onClick: () => start() },
          { label: "← 返回", ghost: true, onClick: () => onExit() },
        ]);
      },
    });
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });
  start();

  return {
    destroy() {
      sortie?.destroy();
      sortie = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

/** 壳层没传 `initialLevel` 时,也认地址栏上的 `?level=N`(1 基) */
export function levelFromQuery(): number | null {
  try {
    const raw = new URLSearchParams(globalThis.location?.search ?? "").get("level");
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  } catch {
    return null;
  }
}

export interface SkySquadHandle {
  destroy: () => void;
  /** 平台直达第 N 关(1 基),返回真正打开的关号 */
  openCampaignLevel: (n: number) => number;
}

export function mount(api: GameApi): SkySquadHandle {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sks-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  const directHost = el("div");
  directHost.hidden = true;
  root.append(style, bar, levelHost, modeHost, directHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "sks-mode");
  endlessBtn.type = "button";
  const coopBtn = el("button", "sks-mode sks-mode-duo", "👫 双人合作");
  coopBtn.type = "button";
  const duoBtn = el("button", "sks-mode sks-mode-vs", "🙌 双人同屏");
  duoBtn.type = "button";
  bar.append(endlessBtn, coopBtn, duoBtn);

  let current: { destroy: () => void } | null = null;
  let direct: SortieHandle | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 云海远征 · 最好 ${best} 分` : "♾️ 云海远征 · 起飞!";
  }

  function closeMode(): void {
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, onExit: () => void) => { destroy: () => void }): void {
    if (current) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    current = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountExpedition));
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  duoBtn.addEventListener("click", () => openMode(mountDuo));
  refreshBar();

  // 一进关就把模式条收起来:平台的舞台是 overflow:hidden 的一屏,
  // 这一条占掉的高度会直接从天空里扣,飞机那一行就被顶到看不见的地方去。
  const playLevelHere = (stage: HTMLElement, ctx: PlayCtx): PlayHandle => {
    bar.hidden = true;
    const handle = playLevel(stage, ctx);
    return {
      destroy() {
        bar.hidden = current !== null || !directHost.hidden;
        handle.destroy?.();
      },
    };
  };

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: playLevelHere,
      mapHint: "每章最后一关是大 Boss:三段弹幕各有各的躲法,换段之前一定先给预告。",
      grandMessage: "八片天空全部飞完,你就是飞机小队的队长!",
      guideTitle: GUIDE.title,
      guide: GUIDE,
    }
  );

  function closeDirect(): void {
    direct?.destroy();
    direct = null;
    directHost.hidden = true;
    directHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
  }

  /**
   * 平台直达第 N 关(1 基)。本款的选关地图由 188 框架托管,
   * 框架没有对外暴露「直接开第 N 关」的入口,所以这里自己开一个直达视图:
   * 不动战役存档,飞完给一句鼓励和「再飞一次 / 回地图」。锁着的关也允许直达 ——
   * 平台/家长点进来就是要看这一关。
   */
  function openCampaignLevel(n: number): number {
    const idx = Math.max(0, Math.min(187, Math.round(n) - 1));
    closeDirect();
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    stopSpeaking();
    levelHost.hidden = true;
    bar.hidden = true;
    directHost.hidden = false;
    directHost.innerHTML = "";

    const topbar = el("div", "sks-topbar");
    const back = el("button", "sks-back", "🗺️ 回地图");
    back.type = "button";
    back.addEventListener("click", () => {
      api.play("tap");
      closeDirect();
    });
    const def = buildSortie(idx);
    topbar.append(
      back,
      el("div", "sks-title", `${CHAPTERS[def.chapter].emoji} ${CHAPTERS[def.chapter].name} · 第 ${idx + 1} 关`)
    );
    const stage = el("div");
    directHost.append(topbar, stage);

    direct = startSortie(stage, def, api.play, (won, stars, message) => {
      api.play(won ? "win" : "oops");
      direct?.veil(won ? `第 ${idx + 1} 关过关!` : "就差一点点!", message, [
        { label: "🔁 再飞一次", onClick: () => openCampaignLevel(idx + 1) },
        { label: "🗺️ 回地图", ghost: true, onClick: () => closeDirect() },
      ]);
      if (won) api.onWin(stars, message);
    });
    return idx + 1;
  }

  const jumpTo = (api as { initialLevel?: number }).initialLevel ?? levelFromQuery();
  if (jumpTo !== null && jumpTo !== undefined && jumpTo >= 1) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy() {
      direct?.destroy();
      direct = null;
      current?.destroy();
      current = null;
      level.destroy();
      stopSpeaking();
      root.remove();
    },
  };
}
