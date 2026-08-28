import { meta } from "./meta";
export { meta };

// 星星射击场:188 关十大靶场 + 无尽「打不完的靶场」+ 双人同屏比一比 / 一起打。
//
// 嘉年华打靶场:靶子是同心圆靶 / 气球 / 飞碟 / 铁皮机器人 / 分裂靶 / 护盾靶 / 彩虹靶,
// 外加两种不许打的——举旗子的好人靶和朵朵的花朵靶。准星是一圈小花瓣加中心星点,
// 不是瞄准镜十字线;打中只有「啵一声变彩纸」「摊手坐下」这类卡通反馈,没有任何受伤表现。
//
// 1.2 的三件事:手感三件套(feel12)、四类新靶(targets12)、
// 连续投放的无尽靶场(endless12)与双人同屏(duo12)。
import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  loadStars,
  mountLevelGame,
  saveStar,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { stopSpeaking } from "../speech";
import { save } from "../../engine/save";
import { CHAPTERS, buildDuelTargets, buildLevel, buildTide, type LevelDef } from "./levels";
import GUIDE from "./guide";
import {
  AIM_BOUNDS,
  FIELD_H,
  FIELD_W,
  MUZZLE_Y,
  NUDGE_STEP,
  aimToVelocity,
  comboMultiplier,
  fireGun,
  isOrderViolation,
  isPauseKey,
  keyToAction,
  makeGun,
  nextOrder,
  nudgeAim,
  roundMessage,
  shotPoint,
  startReload,
  starsForRound,
  stepGun,
  stepTarget,
  tideWave,
  traceShot,
  type Aim,
  type Block,
  type Gun,
  type RangeAction,
  type Target,
  type TargetKind,
} from "./logic";
import {
  RECOIL_KICK,
  WINDUP_S,
  comboHalo,
  crosshairRadius,
  hitStopSeconds,
  recoilAfterShot,
  shakeAmount,
  spreadAfterShot,
  spreadOffset,
  stepHitStop,
  stepRecoil,
  stepSpread,
  windupProgress,
} from "./feel12";
import {
  isLeavingSoon,
  mustClear,
  resolveHit,
  stepLifespan,
  targetDepthMul,
} from "./targets12";
import {
  drawParticles,
  spawnPetals,
  spawnRibbons,
  spawnSparkles,
  stepParticles,
  type Particle,
} from "../../art/kit/sparkle";
import { shade } from "../../art/kit/palette";
import {
  COMBO_RING_MS,
  PETAL_FALL_MS,
  RIBBON_FALL_MS,
  SHR_PALETTE,
  SPARKLE_BURST_MS,
  hitParticleBudget,
} from "./visual13";
import {
  drawBeam,
  drawBunting,
  drawPrizeRack,
  drawCounter,
  drawCrosshairSkin,
  drawFrownCloud,
  drawLauncherSkin,
  drawTargetSkin,
  drawTent,
} from "./paint13";
import {
  ENDLESS_MISS_LIMIT,
  endlessLine,
  endlessPhase,
  endlessScore,
  endlessTarget,
  missLine,
  spawnTimeAt,
} from "./endless12";
import {
  ARENA_SECONDS,
  COOP_SECONDS,
  DUO_INK,
  DUO_NAME,
  arenaResult,
  assignSide,
  coopGoal,
  coopResult,
  makeDuoSide,
  scoreColumn,
} from "./duo12";

// ---------------------------------------------------------------------------
// 样式(全部 shr- 前缀,局部 <style>,不碰 src/styles.css)
// ---------------------------------------------------------------------------

export const CSS = `
.shr-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:none;position:relative;}
/* 顶栏分两块:左边一排 chip 可以横滑,右边的预览 / 暂停固定在屏幕里。
   360px 上 chip 一定放不下,但暂停按钮绝不能被滑出去 */
.shr-bar{display:flex;align-items:center;gap:6px;margin-bottom:6px;}
.shr-hud{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;flex:1 1 auto;min-width:0;
  padding-bottom:2px;scrollbar-width:none;}
.shr-hud::-webkit-scrollbar{display:none;}
.shr-tools{display:flex;align-items:center;gap:4px;flex:0 0 auto;}
/* 1.3:HUD 卡片化——圆角 12px、白 72% 底、1.5px 描边,一行放得下 */
.shr-chip{background:rgba(255,255,255,.72);border:1.5px solid rgba(190,130,165,.4);border-radius:12px;
  padding:5px 9px;font-size:14px;font-weight:800;color:#A2557C;
  box-shadow:0 2px 6px rgba(190,130,165,.18);white-space:nowrap;flex:0 0 auto;}
.shr-chip-warn{background:rgba(255,240,214,.72);border-color:rgba(169,118,31,.4);color:#A9761F;}
.shr-chip-duo{background:rgba(255,230,240,.72);border-color:rgba(180,79,132,.4);color:#B44F84;}
.shr-chip-star{background:rgba(228,238,255,.72);border-color:rgba(57,105,159,.4);color:#39699F;}
.shr-mag{display:inline-flex;gap:2px;align-items:center;vertical-align:middle;}
.shr-star{width:7px;height:7px;border-radius:50%;background:#F5B8CE;display:inline-block;}
.shr-star-off{background:#EDE6EE;}
.shr-box{position:relative;border-radius:16px;overflow:hidden;background:#FFF6FA;
  box-shadow:0 4px 12px rgba(190,150,175,.24);}
.shr-cv{display:block;width:100%;height:240px;cursor:pointer;touch-action:none;}
.shr-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,247,251,.94);}
.shr-veil-title{font-size:20px;font-weight:900;color:#A2557C;}
.shr-veil-sub{font-size:15px;font-weight:700;color:#8A6A7E;line-height:1.6;max-width:330px;}
.shr-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.shr-veil-btn{border:none;border-radius:16px;padding:11px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.shr-veil-btn.shr-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.shr-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #C25A80;}
.shr-toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:14px;font-weight:800;color:#A2557C;box-shadow:0 3px 8px rgba(180,130,160,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.shr-toast.shr-on{opacity:1;}
.shr-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:46px;flex-wrap:wrap;}
.shr-pads[data-players="2"]{--k:44px;}
.shr-pad{display:grid;grid-template-columns:repeat(3,var(--k));grid-auto-rows:var(--k);gap:4px;justify-content:center;}
.shr-pad-name{grid-column:1/-1;font-size:14px;font-weight:800;text-align:center;line-height:1.3;}
.shr-key{border:none;border-radius:13px;font-size:18px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#A2557C;box-shadow:0 3px 0 rgba(190,140,170,.34);touch-action:none;padding:0;}
.shr-key:active,.shr-key.shr-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(190,140,170,.34);background:#FFE7F0;}
.shr-key-fire{background:#FFD3E2;color:#B04B7C;}
.shr-key-reload{background:#DFEDFF;color:#3F72A8;}
.shr-key:focus-visible,.shr-veil-btn:focus-visible,.shr-mode:focus-visible,.shr-back:focus-visible,
.shr-toggle:focus-visible{outline:3px solid #6B3A56;outline-offset:2px;}
.shr-tip{margin-top:6px;text-align:center;font-size:14px;font-weight:700;color:#8A6A7E;line-height:1.5;}
.shr-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.shr-mode{border:none;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.shr-mode.shr-mode-vs{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.shr-mode.shr-mode-co{background:linear-gradient(180deg,#9FD8AE,#6FB98A);box-shadow:0 4px 0 #4E8E67;}
.shr-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #C25A80;}
.shr-topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.shr-back{border:none;border-radius:999px;padding:8px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#A2557C;box-shadow:0 3px 0 rgba(190,140,170,.3);white-space:nowrap;}
/* 5px 竖向内边距量出来才 29px 高,手机上小拇指都嫌挤,垫到 36px 起 */
.shr-toggle{border:none;border-radius:999px;min-height:36px;padding:6px 12px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#FFF0F6;color:#A2557C;box-shadow:0 2px 0 rgba(190,140,170,.3);white-space:nowrap;
  flex:0 0 auto;}
.shr-toggle[aria-pressed="false"]{background:#F0EDF2;color:#8B8291;}
.shr-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#8F4E71;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这几块要单独写一条,
   不然离开选关地图之后模式条还杵在那儿,手机上白占两百多像素 */
.shr-modebar[hidden],.shr-bar[hidden],.shr-hud[hidden],.shr-tools[hidden],.shr-pads[hidden],.shr-pad[hidden]{
  display:none;}
@media (max-width:420px){
  .shr-chip{padding:4px 7px;}
  .shr-pads{--k:44px;}
}
@media (prefers-reduced-motion:reduce){
  .shr-toast{transition:none;}
}
`;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 手指按住时准星画在手指上方多少 CSS 像素(免得手指压住靶子) */
export const TOUCH_LIFT_PX = 24;

/**
 * 指针落点 → 场地坐标。触屏时把准星抬高 `TOUCH_LIFT_PX`,
 * 抬多少要按画布缩放折算成逻辑单位,不然大屏小屏抬的距离不一样。
 */
export function aimFromPointer(
  px: number,
  py: number,
  scale: number,
  offX: number,
  offY: number,
  touch: boolean
): Aim {
  const lift = touch ? TOUCH_LIFT_PX / Math.max(0.0001, scale) : 0;
  return {
    x: clamp((px - offX) / Math.max(0.0001, scale), AIM_BOUNDS.x0, AIM_BOUNDS.x1),
    y: clamp((py - offY) / Math.max(0.0001, scale) - lift, AIM_BOUNDS.y0, AIM_BOUNDS.y1),
  };
}

// ---------------------------------------------------------------------------
// 靶场运行时
// ---------------------------------------------------------------------------

interface Tracer {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  g: number;
  hitT: number;
  life: number;
  ink: string;
}

interface Burst {
  x: number;
  y: number;
  life: number;
  max: number;
  colors: string[];
  kind: TargetKind | "miss";
}

/** 飘起来的分数字 */
interface Float {
  x: number;
  y: number;
  life: number;
  text: string;
  ink: string;
}

/** 被打中后慢慢飘走的靶(机器人摊手坐下、飞碟晃着滑走) */
interface Fallen {
  kind: TargetKind;
  x: number;
  y: number;
  r: number;
  vy: number;
  rot: number;
  life: number;
}

/** 一个射手:同屏双人时两个射手共用一套靶,各有各的准星、星星篮与分数 */
interface Shooter {
  index: number;
  name: string;
  ink: string;
  /** 自己的发射台横坐标 */
  muzzleX: number;
  aim: Aim;
  gun: Gun;
  hold: Record<"left" | "right" | "up" | "down", boolean>;
  /** 出手前摇:按下之后星星弹还在台子上蓄着 */
  windup: { left: number; x: number; y: number } | null;
  /** 准星散布半径 */
  spread: number;
  /** 距离上一发过了多久 */
  sinceShot: number;
  /** 准星被弹上去多少(本作的后坐力) */
  recoil: number;
  shots: number;
  hits: number;
  cleared: number;
  friendHits: number;
  flowerHits: number;
  orderMistakes: number;
  combo: number;
  bestCombo: number;
  score: number;
  tracers: Tracer[];
  /** 换弹提示闪一下 */
  flash: number;
}

function makeShooter(index: number, players: number, magSize: number, reloadTime: number): Shooter {
  const spread = players === 2 ? 0.3 : 0.5;
  return {
    index,
    name: DUO_NAME[index] ?? `${index + 1} 号`,
    ink: DUO_INK[index] ?? "#7A5A90",
    muzzleX: players === 2 ? FIELD_W * (index === 0 ? spread : 1 - spread) : FIELD_W / 2,
    aim: { x: FIELD_W * (players === 2 ? (index === 0 ? 0.34 : 0.66) : 0.5), y: FIELD_H * 0.45 },
    gun: makeGun(magSize, reloadTime),
    hold: { left: false, right: false, up: false, down: false },
    windup: null,
    spread: 0,
    sinceShot: 9,
    recoil: 0,
    shots: 0,
    hits: 0,
    cleared: 0,
    friendHits: 0,
    flowerHits: 0,
    orderMistakes: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    tracers: [],
    flash: 0,
  };
}

export type FinishReason = "cleared" | "timeup" | "empty" | "escaped" | "goal";

export interface FieldSummary {
  shooters: Shooter[];
  targets: Target[];
  elapsed: number;
  missed: number;
  round: number;
}

export interface FieldOptions {
  host: HTMLElement;
  players: 1 | 2;
  /** 章节主色,决定天空配色 */
  tint: string;
  /** 顶部提示 */
  hint: string;
  /** 倒计时秒数,0 表示不限时 */
  seconds: number;
  /** 每局的星星弹总量,0 表示不限 */
  shotBudget: number;
  magSize: number;
  reloadTime: number;
  targets: Target[];
  blocks: Block[];
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  onFinish: (summary: FieldSummary, reason: FinishReason) => void;
  /** 清完场时补一批(返回 null 表示这一局就到此为止) */
  refill?: (round: number) => Target[] | null;
  /** 连续投放:每帧问一次这一刻该不该放新靶 */
  spawner?: (elapsed: number, alive: number) => Target[];
  /** 靶子自己走掉了:返回 true 表示这一局收工 */
  onEscape?: (missed: number) => boolean;
  /** 每次得分变化后回调,合作模式拿它判断有没有够到目标分 */
  onScore?: (total: number) => boolean;
  /** 暂停面板里的额外说明 */
  pauseNote?: string;
  /** HUD 上多显示一条(合作模式的目标分) */
  goalLabel?: () => string;
}

interface FieldHandle {
  destroy: () => void;
  veil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
}

const SKY_TOP = "#FFF7FB";

function createField(opts: FieldOptions): FieldHandle {
  const reduce = reducedMotion();
  const wrap = el("div", "shr-wrap");
  const style = el("style");
  style.textContent = CSS;
  const topbar = el("div", "shr-bar");
  const hud = el("div", "shr-hud");
  const tools = el("div", "shr-tools");
  topbar.append(hud, tools);
  const box = el("div", "shr-box");
  const canvas = el("canvas", "shr-cv");
  const toast = el("div", "shr-toast");
  box.append(canvas, toast);
  const pads = el("div", "shr-pads");
  pads.dataset.players = String(opts.players);
  const tip = el("div", "shr-tip");
  tip.textContent = opts.hint;
  wrap.append(style, topbar, box, pads, tip);
  opts.host.appendChild(wrap);

  const g = canvas.getContext("2d");
  const shooters: Shooter[] = [];
  for (let i = 0; i < opts.players; i++) shooters.push(makeShooter(i, opts.players, opts.magSize, opts.reloadTime));

  let targets: Target[] = opts.targets.map((t) => ({ ...t }));
  let bursts: Burst[] = [];
  let floats: Float[] = [];
  let fallen: Fallen[] = [];
  /** 星屑 / 丝带 / 花瓣(纯视觉,destroy 时清空;reduced 下根本不生成) */
  let particles: Particle[] = [];
  /** 连击金环的扩散计时:倍率一变就从 0 重新弹开(纯视觉) */
  const haloPulse = shooters.map(() => ({ mul: comboMultiplier(0), t: COMBO_RING_MS / 1000 }));
  let hitStop = 0;
  let timeLeft = opts.seconds;
  let shotsLeft = opts.shotBudget;
  let elapsed = 0;
  let missed = 0;
  let round = 1;
  let splitSeq = 0;
  let nextSpawnIndex = 0;
  let running = true;
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let toastTimer = 0;
  let veilNode: HTMLElement | null = null;
  /** 触屏默认「按下预览 + 抬起发射」:手指按住只挪准星,抬手才打 */
  let previewOn = true;
  /** 画布缩放与偏移(指针换算与绘制共用) */
  let scale = 1;
  let offX = 0;
  let offY = 0;

  // ---- HUD -----------------------------------------------------------------

  const chipLeft = el("span", "shr-chip shr-chip-duo");
  const chipRight = el("span", "shr-chip shr-chip-star");
  const chipScore = el("span", "shr-chip");
  const chipAmmo = el("span", "shr-chip");
  const chipTargets = el("span", "shr-chip");
  const chipTime = el("span", "shr-chip shr-chip-warn");
  const chipGoal = el("span", "shr-chip");
  const previewBtn = el("button", "shr-toggle", "👆 预览");
  previewBtn.type = "button";
  previewBtn.setAttribute("aria-pressed", "true");
  previewBtn.setAttribute("aria-label", "按下预览、抬手发射");
  const pauseBtn = el("button", "shr-toggle", "⏸️");
  pauseBtn.type = "button";
  pauseBtn.setAttribute("aria-label", "暂停");
  // 360px 上 chip 一定放不下,所以按「打的时候要看哪个」排:
  // 篮子里还剩几颗星星 → 还剩几个靶 / 几秒 / 几发 → 分数与连击。
  // 分数排最后不亏:打中那一下画面上会飘一个 +N 出来,比 HUD 还显眼。
  if (opts.players === 2) hud.append(chipLeft, chipRight, chipGoal, chipTime);
  else hud.append(chipAmmo, chipTargets, chipTime, chipScore);
  tools.append(previewBtn, pauseBtn);
  if (!opts.goalLabel) chipGoal.hidden = true;

  function magHTML(gun: Gun): string {
    let s = '<span class="shr-mag">';
    for (let i = 0; i < gun.magSize; i++) s += `<i class="shr-star${i < gun.mag ? "" : " shr-star-off"}"></i>`;
    return `${s}</span>`;
  }

  function aliveNeed(): number {
    return targets.filter((t) => t.alive && mustClear(t.kind)).length;
  }

  function totalScore(): number {
    return shooters.reduce((n, s) => n + s.score, 0);
  }

  function refreshHud(): void {
    if (opts.players === 2) {
      chipLeft.textContent = scoreColumn({ ...makeDuoSide(0), ...pick(shooters[0]) });
      chipRight.textContent = scoreColumn({ ...makeDuoSide(1), ...pick(shooters[1]) });
      if (opts.goalLabel) chipGoal.textContent = opts.goalLabel();
    } else {
      const s = shooters[0];
      chipScore.textContent = `🌟 ${s.score} 分 · 🔥 ${s.combo} 连 ×${comboMultiplier(s.combo).toFixed(1)}`;
      chipAmmo.innerHTML = s.gun.reloadLeft > 0 ? "🧺 装星星…" : magHTML(s.gun);
      chipTargets.textContent = `🎯 剩 ${aliveNeed()} 个`;
    }
    const bits: string[] = [];
    if (opts.seconds > 0) bits.push(`⏱️ ${Math.max(0, Math.ceil(timeLeft))} 秒`);
    if (opts.shotBudget > 0) bits.push(`🌠 还剩 ${Math.max(0, shotsLeft)} 发`);
    if (opts.onEscape) bits.push(`🎈 跑掉 ${missed}/${ENDLESS_MISS_LIMIT}`);
    chipTime.textContent = bits.join(" · ");
    chipTime.hidden = bits.length === 0;
  }

  /** 把射手的成绩摘成 duo12 认识的形状 */
  function pick(s: Shooter): { name: string; score: number; hits: number; shots: number; friendHits: number; flowerHits: number } {
    return {
      name: s.name,
      score: s.score,
      hits: s.hits,
      shots: s.shots,
      friendHits: s.friendHits,
      flowerHits: s.flowerHits,
    };
  }

  function say(text: string): void {
    if (!text) return;
    toast.textContent = text;
    toast.classList.add("shr-on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("shr-on"), 1100);
  }

  // ---- 开火 ---------------------------------------------------------------

  /** 准星实际在哪:自己瞄的位置减去还没落回来的后坐力 */
  function liveAim(s: Shooter): Aim {
    return { x: s.aim.x, y: clamp(s.aim.y - s.recoil, AIM_BOUNDS.y0, AIM_BOUNDS.y1) };
  }

  /** 扣下扳机:先进前摇,`WINDUP_S` 之后星星弹才真的飞出去 */
  function pullTrigger(s: Shooter): void {
    if (!running || paused || finished) return;
    if (s.windup) return;
    if (opts.shotBudget > 0 && shotsLeft <= 0) return;
    const res = fireGun(s.gun);
    if (!res.fired) {
      if (s.gun.reloadLeft > 0) say("正在装星星,稍等一下～");
      return;
    }
    s.gun = res.gun;
    s.shots++;
    if (opts.shotBudget > 0) shotsLeft--;
    const aim = liveAim(s);
    s.windup = { left: WINDUP_S, x: aim.x, y: aim.y };
    // 前摇期间弹夹与余弹已经扣掉了,HUD 当场跟上,不然按下去要等一帧才看到反应
    refreshHud();
    opts.sfx("tap");
  }

  /** 前摇走完:这一发按当时的准星 + 散布飞出去 */
  function releaseShot(s: Shooter): void {
    const shotAim = s.windup;
    s.windup = null;
    if (!shotAim) return;
    const off = spreadOffset(s.spread, Math.random);
    const tx = clamp(shotAim.x + off.dx, AIM_BOUNDS.x0, AIM_BOUNDS.x1);
    const ty = clamp(shotAim.y + off.dy, AIM_BOUNDS.y0, AIM_BOUNDS.y1);
    s.spread = spreadAfterShot(s.spread);
    s.sinceShot = 0;
    s.recoil = recoilAfterShot(s.recoil);

    const shot = aimToVelocity(s.muzzleX, MUZZLE_Y, tx, ty);
    const hit = traceShot(shot, targets, opts.blocks);
    s.tracers.push({ x0: shot.x0, y0: shot.y0, vx: shot.vx, vy: shot.vy, g: shot.g, hitT: hit.t, life: 0.22, ink: s.ink });

    const target = hit.targetId === null ? null : targets.find((t) => t.id === hit.targetId) ?? null;
    if (!target) {
      s.combo = 0;
      bursts.push({ x: hit.x, y: hit.y, life: 0.3, max: 0.3, colors: ["#D8CFE0"], kind: "miss" });
      if (hit.blocked) say("被木板挡住啦,换个角度试试。");
      refreshHud();
      return;
    }

    const out = resolveHit(target, hit.offset, s.combo, splitSeq++);
    if (out.foul) {
      if (target.kind === "friend") s.friendHits++;
      else s.flowerHits++;
      s.combo = 0;
      s.score += out.score;
      // 误击花朵:花瓣飘落 + 皱眉小云,不批评(reduced 下不生成花瓣)
      const foulBudget = hitParticleBudget(target.kind, { destroyed: false, foul: true, reduced: reduce });
      if (foulBudget.petals > 0) {
        particles.push(
          ...spawnPetals(target.x, target.y, { count: foulBudget.petals, lifeMs: PETAL_FALL_MS })
        );
      }
      bursts.push({ x: target.x, y: target.y - target.r - 8, life: 0.7, max: 0.7, colors: ["#FFD27F"], kind: target.kind });
      floats.push({ x: target.x, y: target.y - target.r, life: 0.9, text: `${out.score}`, ink: "#B98A2E" });
      opts.sfx("oops");
      say(out.say);
      refreshHud();
      return;
    }

    // 顺序打错了照样把靶打倒——不然万一它正好挡在下一个号码前面,这一关就走不下去了。
    // 代价是断连击、记一次失误,三星线过不去。
    if (isOrderViolation(targets, target)) {
      s.orderMistakes++;
      s.combo = 0;
      say(`该打 ${nextOrder(targets)} 号的,顺序乱了要掉星哦。`);
      opts.sfx("oops");
    }

    target.alive = out.target.alive;
    target.hp = out.target.hp;
    s.hits++;
    s.score += out.score;
    if (out.destroyed) s.cleared++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    hitStop = Math.max(hitStop, hitStopSeconds(out.stop));
    floats.push({
      x: target.x,
      y: target.y - target.r * 0.6,
      life: 0.9,
      text: `+${out.score}${targetDepthMul(target) > 1 ? " 远排" : ""}`,
      ink: s.ink,
    });
    if (out.destroyed) {
      // 1.3:彩纸方块升级为「星屑 + 丝带」双粒子;reduced 下预算全零,不生成
      const budget = hitParticleBudget(target.kind, { destroyed: true, foul: false, reduced: reduce });
      if (budget.sparkles > 0) {
        particles.push(
          ...spawnSparkles(target.x, target.y, {
            colors: [SHR_PALETTE.shrGold, ...burstColors(target.kind)],
            lifeMs: SPARKLE_BURST_MS,
          })
        );
      }
      if (budget.ribbons > 0) {
        particles.push(
          ...spawnRibbons(target.x, target.y, {
            count: budget.ribbons,
            colors: burstColors(target.kind),
            lifeMs: RIBBON_FALL_MS,
          })
        );
      }
      if (target.kind === "robot" || target.kind === "ufo") {
        fallen.push({ kind: target.kind, x: target.x, y: target.y, r: target.r, vy: 40, rot: 0, life: 1.4 });
      }
    }
    for (const kid of out.spawns) targets.push(kid);
    say(out.say);
    opts.sfx(
      target.kind === "balloon" || target.kind === "split"
        ? "pop"
        : target.kind === "rainbow"
          ? "win"
          : target.kind === "bull" || target.kind === "shield"
            ? "coin"
            : "jump"
    );
    if (s.combo >= 3 && s.combo % 3 === 0) say(`${s.combo} 连击!倍率 ×${comboMultiplier(s.combo).toFixed(1)}`);
    refreshHud();

    if (opts.onScore?.(totalScore()) === true) {
      finish("goal");
      return;
    }
    if (aliveNeed() === 0) {
      const more = opts.refill?.(++round);
      if (more && more.length) {
        targets = more.map((t) => ({ ...t }));
        say("新的一批靶上场啦!");
        refreshHud();
      } else if (!opts.spawner) {
        finish("cleared");
      }
    }
  }

  function burstColors(kind: TargetKind): string[] {
    switch (kind) {
      case "balloon":
        return ["#FF9FC4", "#FFD48A", "#9BD9F5", "#C7ED9E"];
      case "bull":
        return ["#FFD9E6", "#F79BB8", "#FFF0C9"];
      case "ufo":
        return ["#BFE3FF", "#9FD0F5", "#E4D8FF"];
      case "robot":
        return ["#D9E4EC", "#B8CBDA", "#FFE0A8"];
      case "number":
        return ["#CFE0F7", "#EAF1FB"];
      case "split":
        return ["#CFF3FF", "#A8E6FF", "#E8FBFF"];
      case "shield":
        return ["#E4E0FA", "#C9C0F2", "#FFF0C9"];
      case "rainbow":
        return ["#FF9FC4", "#FFD48A", "#C7ED9E", "#9BD9F5", "#D3B8F5"];
      default:
        return ["#FFE6B8"];
    }
  }

  function doReload(s: Shooter): void {
    if (!running || paused || finished) return;
    const before = s.gun.reloadLeft;
    s.gun = startReload(s.gun);
    if (s.gun.reloadLeft > 0 && before <= 0) {
      opts.sfx("meow");
      s.flash = 0.4;
      refreshHud();
    }
  }

  // ---- 输入 ---------------------------------------------------------------

  function applyAction(player: number, action: RangeAction, down: boolean): void {
    const s = shooters[player];
    if (!s) return;
    if (action === "fire") {
      if (down) pullTrigger(s);
      return;
    }
    if (action === "reload") {
      if (down) doReload(s);
      return;
    }
    s.hold[action] = down;
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

  /** 指针在画布上的位置(设备像素) */
  function canvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  /** 同时最多两根手指:哪根手指属于哪个射手,在按下的那一刻定下来 */
  const pointerOwner = new Map<number, number>();

  const onPointerDown = (e: PointerEvent): void => {
    const p = canvasPoint(e.clientX, e.clientY);
    if (!p) return;
    const touch = e.pointerType !== "mouse";
    const side = assignSide(p.x, canvas.width, opts.players);
    const s = shooters[side];
    if (!s) return;
    pointerOwner.set(e.pointerId, side);
    s.aim = aimFromPointer(p.x, p.y, scale, offX, offY, touch);
    canvas.setPointerCapture?.(e.pointerId);
    // 关掉预览就是「按下即发射」;开着预览则按住只挪准星,抬手才打
    if (!previewOn) pullTrigger(s);
  };

  const onPointerMove = (e: PointerEvent): void => {
    const p = canvasPoint(e.clientX, e.clientY);
    if (!p) return;
    const owned = pointerOwner.get(e.pointerId);
    if (owned !== undefined) {
      const s = shooters[owned];
      if (s) s.aim = aimFromPointer(p.x, p.y, scale, offX, offY, e.pointerType !== "mouse");
      return;
    }
    // 鼠标没按住时也跟着走:桌面端「指哪打哪」
    if (e.pointerType === "mouse" && pointerOwner.size === 0) {
      const s = shooters[assignSide(p.x, canvas.width, opts.players)];
      if (s) s.aim = aimFromPointer(p.x, p.y, scale, offX, offY, false);
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    const owned = pointerOwner.get(e.pointerId);
    if (owned === undefined) return;
    pointerOwner.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
    const s = shooters[owned];
    if (s && previewOn) pullTrigger(s);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  previewBtn.addEventListener("click", () => {
    previewOn = !previewOn;
    previewBtn.setAttribute("aria-pressed", String(previewOn));
    previewBtn.textContent = previewOn ? "👆 预览" : "👆 直发";
    previewBtn.setAttribute("aria-label", previewOn ? "按下预览、抬手发射" : "按下就直接发射");
    opts.sfx("tap");
    say(previewOn ? "按住挪准星,抬手才发射。" : "按下去就直接发射。");
  });

  // 触屏等价按钮:每人一套「上下左右微调 + 发射 + 装星星」
  function buildPad(s: Shooter): HTMLElement {
    const pad = el("div", "shr-pad");
    const name = el("div", "shr-pad-name");
    name.style.color = s.ink;
    name.textContent =
      opts.players === 2
        ? s.index === 0
          ? "朵朵 WASD · F 发射 · G 装星星"
          : "星星 方向键 · L 发射 · K 装星星"
        : "WASD / 方向键微调 · F/L 发射 · G/K 装星星";
    pad.appendChild(name);

    const layout: Array<{ label: string; action: RangeAction | null; cls?: string; aria: string }> = [
      { label: "", action: null, aria: "" },
      { label: "▲", action: "up", aria: "准星上移" },
      { label: "🧺", action: "reload", cls: "shr-key-reload", aria: "装星星" },
      { label: "◀", action: "left", aria: "准星左移" },
      { label: "▼", action: "down", aria: "准星下移" },
      { label: "▶", action: "right", aria: "准星右移" },
      { label: "", action: null, aria: "" },
      { label: "🌟", action: "fire", cls: "shr-key-fire", aria: "发射星星弹" },
      { label: "", action: null, aria: "" },
    ];
    for (const item of layout) {
      if (!item.action) {
        pad.appendChild(el("div"));
        continue;
      }
      const btn = el("button", `shr-key${item.cls ? ` ${item.cls}` : ""}`, item.label);
      btn.type = "button";
      btn.setAttribute("aria-label", `${s.name}${item.aria}`);
      const action = item.action;
      const press = (e: Event): void => {
        e.preventDefault();
        btn.classList.add("shr-down");
        applyAction(s.index, action, true);
      };
      const release = (e: Event): void => {
        e.preventDefault();
        btn.classList.remove("shr-down");
        applyAction(s.index, action, false);
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
      pad.appendChild(btn);
    }
    return pad;
  }
  for (const s of shooters) pads.appendChild(buildPad(s));

  // ---- 暂停 / 结算 ---------------------------------------------------------

  function veil(
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    veilNode?.remove();
    const node = el("div", "shr-veil");
    node.append(el("div", "shr-veil-title", title), el("div", "shr-veil-sub", sub));
    const row = el("div", "shr-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `shr-veil-btn${b.ghost ? " shr-ghost" : ""}`, b.label);
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

  function closeVeil(): void {
    veilNode?.remove();
    veilNode = null;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    if (paused) {
      veil("休息一下 ⏸️", opts.pauseNote ?? "准星和星星弹都给你留着,随时回来继续。", [
        { label: "继续 ▶", onClick: () => togglePause() },
      ]);
    } else {
      closeVeil();
      last = performance.now();
    }
  }
  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  function finish(reason: FinishReason): void {
    if (finished) return;
    finished = true;
    running = false;
    opts.onFinish({ shooters, targets, elapsed, missed, round }, reason);
  }

  // ---- 主循环 --------------------------------------------------------------

  function step(dt: number): void {
    // 命中顿感:整个场面停 4–6 帧,只有特效继续跑
    if (hitStop > 0) {
      hitStop = stepHitStop(hitStop, dt);
      stepEffects(dt);
      return;
    }
    elapsed += dt;

    for (const s of shooters) {
      s.gun = stepGun(s.gun, dt);
      s.flash = Math.max(0, s.flash - dt);
      s.sinceShot += dt;
      s.spread = stepSpread(s.spread, dt, s.sinceShot);
      s.recoil = stepRecoil(s.recoil, dt);
      let dx = 0;
      let dy = 0;
      if (s.hold.left) dx -= NUDGE_STEP;
      if (s.hold.right) dx += NUDGE_STEP;
      if (s.hold.up) dy -= NUDGE_STEP;
      if (s.hold.down) dy += NUDGE_STEP;
      if (dx !== 0 || dy !== 0) s.aim = nudgeAim(s.aim, dx * dt * 12, dy * dt * 12);
      if (s.windup) {
        s.windup.left -= dt;
        if (s.windup.left <= 0) releaseShot(s);
      }
    }

    // 靶子走一步,再看有没有到点自己走掉的
    let escapedNow = 0;
    targets = targets.map((t) => {
      const moved = stepTarget(t, dt);
      const life = stepLifespan(moved, dt);
      if (life.gone && mustClear(moved.kind)) escapedNow++;
      return life.target;
    });
    if (escapedNow > 0) {
      missed += escapedNow;
      say(missLine(missed));
      opts.sfx("oops");
      refreshHud();
      if (opts.onEscape?.(missed) === true) {
        finish("escaped");
        return;
      }
    }

    if (opts.spawner) {
      const fresh = opts.spawner(elapsed, targets.filter((t) => t.alive).length);
      for (const t of fresh) targets.push(t);
    }
    // 已经打掉又没有特效在跑的靶子清出去,列表不会无限长
    if (targets.length > 60) targets = targets.filter((t) => t.alive);

    stepEffects(dt);

    if (opts.seconds > 0 && !finished) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        finish("timeup");
        return;
      }
    }
    if (opts.shotBudget > 0 && !finished && shotsLeft <= 0) {
      const idle = shooters.every((s) => s.tracers.length === 0 && !s.windup);
      if (idle) finish("empty");
    }
    refreshHud();
  }

  function stepEffects(dt: number): void {
    for (const s of shooters) s.tracers = s.tracers.filter((tr) => (tr.life -= dt) > 0);
    bursts = bursts.filter((b) => (b.life -= dt) > 0);
    floats = floats.filter((f) => (f.life -= dt) > 0);
    particles = stepParticles(particles, dt);
    // 金环扩散计时:倍率一变就重新弹开一圈(只读 comboMultiplier,不改连击)
    for (const s of shooters) {
      const pulse = haloPulse[s.index];
      const mul = comboMultiplier(s.combo);
      if (mul !== pulse.mul) {
        pulse.mul = mul;
        pulse.t = 0;
      } else {
        pulse.t += dt;
      }
    }
    for (const f of fallen) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 90 * dt;
      f.rot += dt * (f.kind === "ufo" ? 1.2 : 2.2);
    }
    fallen = fallen.filter((f) => f.life > 0);
  }

  // ---- 绘制 ----------------------------------------------------------------

  function resize(): void {
    const cssW = Math.max(240, box.clientWidth || wrap.clientWidth || 320);
    const cssH = Math.min(320, Math.round((cssW / FIELD_W) * FIELD_H));
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = canvas.width / FIELD_W;
    offX = 0;
    offY = (canvas.height - FIELD_H * scale) / 2;
  }

  /**
   * 1.3:靶子七道工序在 paint13 总装(落影 / 支架 / 木框 / 三停色环 / 靶心亮点 /
   * 靶种剪影 / 离场倒计时)。判定半径与远近排口径原样,只换皮肤;
   * 远排的白雾圈退役,「远」由中景横梁 + 一根侧视支架来说。
   */
  function drawTarget(ctx: CanvasRenderingContext2D, t: Target, now: number): void {
    drawTargetSkin(ctx, t, now, reduce, isLeavingSoon(t));
  }

  /** 嘉年华准星:朵朵粉四爪 / 星星蓝三角爪 + 呼吸外圈 + 连击金环双通道 */
  function drawCrosshair(ctx: CanvasRenderingContext2D, s: Shooter, now: number): void {
    const aim = liveAim(s);
    const pulse = haloPulse[s.index];
    drawCrosshairSkin(ctx, aim.x, aim.y, {
      player: s.index,
      ink: s.ink,
      radius: crosshairRadius(s.spread, now, reduce),
      spread: s.spread,
      halo: comboHalo(s.combo),
      haloPulse: pulse.t / (COMBO_RING_MS / 1000),
      nowS: now,
      reduce,
      ...(opts.players === 2 ? { label: s.name } : {}),
    });
  }

  /** 发射台:前摇的时候压下去一点,出手那一下弹回来(皮肤在 paint13) */
  function drawLauncher(ctx: CanvasRenderingContext2D, s: Shooter): void {
    const squash = s.windup ? 1 - windupProgress(s.windup.left) : 0;
    // 台子整个要留在画布里,压下去那 6 像素也算进来,不然底边会被切掉一条
    drawLauncherSkin(ctx, s.muzzleX, FIELD_H - 28, s.ink, squash);
  }

  function drawField(ctx: CanvasRenderingContext2D, now: number): void {
    const shake = shakeAmount(hitStop, reduce);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(1, opts.tint);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(offX + (shake ? (Math.random() - 0.5) * shake : 0), offY);
    ctx.scale(scale, scale);

    // 图层序(visual13.SHR_LAYERS):① 天幕条纹 → ② 彩旗串
    drawTent(ctx, FIELD_W);
    drawBunting(ctx, FIELD_W);

    // ②½ 中景奖品架剪影(修复员装饰件:静态单色 2 阶,填天幕与横梁之间的空档)
    drawPrizeRack(ctx, FIELD_W);

    // ③ 中景横梁 + 远排靶(白雾圈退役,「远」由横梁与侧视支架来说)
    drawBeam(ctx, FIELD_W);
    for (const t of targets) {
      if (t.alive && targetDepthMul(t) > 1) drawTarget(ctx, t, now);
    }

    // ④ 近景柜台 + 木板障碍 + 倒下的靶 + 近排靶
    drawCounter(ctx, FIELD_W, FIELD_H);

    for (const b of opts.blocks) {
      roundRect(ctx, b.x, b.y, b.w, b.h, 8);
      ctx.fillStyle = shade(SHR_PALETTE.shrWood, 10);
      ctx.fill();
      ctx.strokeStyle = SHR_PALETTE.shrWoodDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      // 顶亮边:和横梁 / 柜台同一套受光
      ctx.fillStyle = shade(SHR_PALETTE.shrWood, 30);
      ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 3);
    }

    for (const f of fallen) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.translate(f.x, f.y);
      ctx.rotate(reduce ? 0 : Math.sin(f.rot) * 0.4);
      if (f.kind === "robot") {
        roundRect(ctx, -f.r * 0.7, -f.r * 0.4, f.r * 1.4, f.r * 1.1, f.r * 0.3);
        ctx.fillStyle = "#D7E3ED";
        ctx.fill();
        ctx.strokeStyle = "#AFC2D2";
        ctx.lineWidth = 2;
        ctx.stroke();
        // 摊手坐下:两条小胳膊摊开
        ctx.strokeStyle = "#8FA6B8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-f.r * 0.7, 0);
        ctx.lineTo(-f.r * 1.1, f.r * 0.25);
        ctx.moveTo(f.r * 0.7, 0);
        ctx.lineTo(f.r * 1.1, f.r * 0.25);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, f.r, f.r * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#C7D9EC";
        ctx.fill();
      }
      ctx.restore();
    }

    for (const t of targets) {
      if (t.alive && targetDepthMul(t) <= 1) drawTarget(ctx, t, now);
    }

    // ⑤ 弹道与粒子
    for (const b of bursts) {
      const k = 1 - b.life / b.max;
      if (b.kind === "flower") {
        // 误击花朵:皱眉小云 + (releaseShot 里生成的)花瓣飘落,不批评
        drawFrownCloud(ctx, b.x, b.y, k);
        continue;
      }
      if (b.kind === "friend") {
        ctx.fillStyle = "#B98A2E";
        ctx.font = '900 26px "PingFang SC",system-ui,sans-serif';
        ctx.textAlign = "center";
        ctx.globalAlpha = Math.max(0, b.life / b.max);
        ctx.fillText("哎呀～", b.x, b.y - k * 30);
        ctx.globalAlpha = 1;
        continue;
      }
      const n = b.kind === "miss" ? 4 : 10;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + b.x;
        const dist = k * (b.kind === "miss" ? 22 : 60);
        ctx.save();
        ctx.globalAlpha = Math.max(0, b.life / b.max);
        ctx.translate(b.x + Math.cos(ang) * dist, b.y + Math.sin(ang) * dist);
        ctx.rotate(ang + k * 3);
        ctx.fillStyle = b.colors[i % b.colors.length];
        ctx.fillRect(-5, -3, 10, 6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    drawParticles(ctx, particles);

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.ink;
      ctx.font = '900 24px "PingFang SC",system-ui,sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - (0.9 - f.life) * 42);
      ctx.globalAlpha = 1;
    }

    for (const s of shooters) {
      for (const tr of s.tracers) {
        const end = Math.min(tr.hitT, 1.2);
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const p = shotPoint({ x0: tr.x0, y0: tr.y0, vx: tr.vx, vy: tr.vy, g: tr.g, flight: end }, (end * i) / 16);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = `rgba(255,214,120,${Math.max(0, tr.life / 0.22) * 0.9})`;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    for (const s of shooters) drawLauncher(ctx, s);

    // ⑥ 准星
    for (const s of shooters) drawCrosshair(ctx, s, now);

    // ⑦ 画布内 HUD:装填进度条
    for (const s of shooters) {
      if (s.gun.reloadLeft <= 0) continue;
      const pct = 1 - s.gun.reloadLeft / s.gun.reloadTime;
      roundRect(ctx, s.muzzleX - 80, FIELD_H - 78, 160, 20, 10);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fill();
      roundRect(ctx, s.muzzleX - 78, FIELD_H - 76, 156 * pct, 16, 8);
      ctx.fillStyle = s.ink;
      ctx.fill();
      ctx.fillStyle = "#A2557C";
      ctx.font = '800 14px "PingFang SC",system-ui,sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("装星星…", s.muzzleX, FIELD_H - 63);
    }

    ctx.restore();
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (running && !paused && !finished) step(dt);
    if (g) drawField(g, now / 1000);
  }

  const onResize = (): void => resize();
  window.addEventListener("resize", onResize);
  resize();
  refreshHud();
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      stopSpeaking();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      pointerOwner.clear();
      running = false;
      finished = true;
      targets = [];
      bursts = [];
      floats = [];
      fallen = [];
      particles = [];
      for (const s of shooters) {
        s.tracers = [];
        s.windup = null;
      }
      closeVeil();
      wrap.remove();
    },
    veil,
  };
}

// ---------------------------------------------------------------------------
// 188 关闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def: LevelDef = buildLevel(ctx.level);
  let field: FieldHandle | null = null;

  field = createField({
    host: stage,
    players: 1,
    tint: CHAPTERS[def.chapter].color,
    hint: def.hint,
    seconds: def.seconds,
    shotBudget: def.shotBudget,
    magSize: def.magSize,
    reloadTime: def.reloadTime,
    targets: def.targets,
    blocks: def.blocks,
    sfx: ctx.sfx,
    pauseNote: def.hint,
    onFinish: (sum, reason) => {
      const s = sum.shooters[0];
      const stat = {
        shots: s.shots,
        hits: s.hits,
        remaining: sum.targets.filter((t) => t.alive && mustClear(t.kind)).length,
        friendHits: s.friendHits,
        orderMistakes: s.orderMistakes,
        flowerHits: s.flowerHits,
      };
      if (reason === "cleared") {
        ctx.win(starsForRound(stat), `${roundMessage(stat)}本关 ${s.score} 分,最高连击 ${s.bestCombo}。`);
      } else {
        ctx.lose(
          reason === "timeup"
            ? `时间到,还剩 ${stat.remaining} 个靶。下次先挑好打的开手,连击起来就快了。`
            : `星星弹用完啦,还剩 ${stat.remaining} 个靶。瞄准多花半秒,能省下好几发。`
        );
      }
    },
  });

  return {
    destroy() {
      field?.destroy();
      field = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「打不完的靶场」
// ---------------------------------------------------------------------------

function modeShell(host: HTMLElement, title: string, onBack: () => void): { stage: HTMLElement; destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "shr-topbar");
  const back = el("button", "shr-back", "← 返回");
  back.type = "button";
  back.addEventListener("click", onBack);
  bar.append(back, el("div", "shr-title", title));
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);
  return {
    stage,
    destroy() {
      root.remove();
    },
  };
}

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const shell = modeShell(host, "♾️ 打不完的靶场", () => {
    api.play("tap");
    onExit();
  });
  let field: FieldHandle | null = null;

  function start(): void {
    field?.destroy();
    shell.stage.innerHTML = "";
    // 投放表是纯函数:第几个靶什么时候出、长什么样,重开一局完全一样
    let nextIndex = 0;
    field = createField({
      host: shell.stage,
      players: 1,
      tint: "#FFE9F2",
      hint: "靶子一个接一个上场,越来越快也越来越挤。跑掉 5 个就收工,成绩自动记下来。",
      seconds: 0,
      shotBudget: 0,
      magSize: 7,
      reloadTime: 1,
      targets: [],
      blocks: [],
      sfx: api.play,
      pauseNote: "靶场在这儿等你,回来接着打。",
      spawner: (elapsed, alive) => {
        const phase = endlessPhase(elapsed);
        const out: Target[] = [];
        while (spawnTimeAt(nextIndex) <= elapsed) {
          const t = endlessTarget(nextIndex, phase);
          nextIndex++;
          if (alive + out.length < phase.maxAlive) out.push(t);
        }
        return out;
      },
      onEscape: (missed) => missed >= ENDLESS_MISS_LIMIT,
      onFinish: (sum) => {
        const s = sum.shooters[0];
        const stat = {
          cleared: s.cleared,
          points: s.score,
          elapsed: sum.elapsed,
          hits: s.hits,
          shots: s.shots,
          bestCombo: s.bestCombo,
          missed: sum.missed,
        };
        const score = endlessScore(stat);
        const best = save.recordEndlessBest(meta.id, score);
        api.play(score >= best ? "win" : "oops");
        field?.veil("这一轮到这儿 🎪", endlessLine(stat, score, best), [
          { label: "🔁 再来一轮", onClick: () => start() },
          { label: "← 返回", ghost: true, onClick: () => onExit() },
        ]);
      },
    });
  }

  start();
  return {
    destroy() {
      field?.destroy();
      field = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏:比一比 / 一起打
// ---------------------------------------------------------------------------

function mountArena(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const shell = modeShell(host, "👫 双人同屏 · 比一比", () => {
    api.play("tap");
    onExit();
  });
  let field: FieldHandle | null = null;
  let round = 1;

  function start(): void {
    field?.destroy();
    shell.stage.innerHTML = "";
    field = createField({
      host: shell.stage,
      players: 2,
      tint: "#F2ECFB",
      hint: `同一片靶场,两套准星:朵朵按左半边、星星按右半边(或者一人键盘一人手指)。${ARENA_SECONDS} 秒比分数。`,
      seconds: ARENA_SECONDS,
      shotBudget: 0,
      magSize: 6,
      reloadTime: 1,
      targets: buildDuelTargets(round),
      blocks: [],
      sfx: api.play,
      pauseNote: "两个人的分都留着,喘口气再继续。",
      refill: (n) => buildDuelTargets(round + n),
      onFinish: (sum) => {
        const [a, b] = sum.shooters;
        const res = arenaResult(
          { ...makeDuoSide(0), name: a.name, score: a.score, hits: a.hits, shots: a.shots, friendHits: a.friendHits, flowerHits: a.flowerHits },
          { ...makeDuoSide(1), name: b.name, score: b.score, hits: b.hits, shots: b.shots, friendHits: b.friendHits, flowerHits: b.flowerHits }
        );
        api.play(res.winner === -1 ? "pop" : "win");
        round++;
        field?.veil(res.winner === -1 ? "打成平手 🤝" : `${DUO_NAME[res.winner]}赢啦 🏆`, res.line, [
          { label: "🔁 换一批靶再来", onClick: () => start() },
          { label: "← 返回", ghost: true, onClick: () => onExit() },
        ]);
      },
    });
  }

  start();
  return {
    destroy() {
      field?.destroy();
      field = null;
      shell.destroy();
    },
  };
}

function mountCoop(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const shell = modeShell(host, "🤝 双人同屏 · 一起打", () => {
    api.play("tap");
    onExit();
  });
  let field: FieldHandle | null = null;
  let round = 1;

  function start(): void {
    field?.destroy();
    shell.stage.innerHTML = "";
    const goal = coopGoal(round);
    let reached = false;
    // 一起打用 1.1 那套「一波一批」的靶阵:清完一批立刻补下一批,两个人抢着清
    const batch = (n: number): Target[] => {
      const spec = tideWave(n);
      return buildTide(n, spec.kinds, spec.count, spec.speed, spec.friendChance);
    };
    field = createField({
      host: shell.stage,
      players: 2,
      tint: "#EAF6EC",
      hint: `两个人的分合起来算,${COOP_SECONDS} 秒内一起够到 ${goal} 分就双赢。谁也不用输。`,
      seconds: COOP_SECONDS,
      shotBudget: 0,
      magSize: 6,
      reloadTime: 1,
      targets: batch(1),
      blocks: [],
      sfx: api.play,
      pauseNote: "分数都记着呢,歇好了再一起上。",
      goalLabel: () => `🎯 目标 ${goal} 分`,
      refill: (n) => batch(n),
      onScore: (total) => {
        if (total < goal || reached) return false;
        reached = true;
        return true;
      },
      onFinish: (sum) => {
        const [a, b] = sum.shooters;
        const res = coopResult(
          { ...makeDuoSide(0), name: a.name, score: a.score, hits: a.hits, shots: a.shots, friendHits: a.friendHits, flowerHits: a.flowerHits },
          { ...makeDuoSide(1), name: b.name, score: b.score, hits: b.hits, shots: b.shots, friendHits: b.friendHits, flowerHits: b.flowerHits },
          round
        );
        api.play(res.win ? "win" : "pop");
        if (res.win) round++;
        field?.veil(res.win ? "一起做到啦 🎉" : "差一点点 💪", res.line, [
          { label: res.win ? "⬆️ 下一档目标" : "🔁 再试一次", onClick: () => start() },
          { label: "← 返回", ghost: true, onClick: () => onExit() },
        ]);
      },
    });
  }

  start();
  return {
    destroy() {
      field?.destroy();
      field = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口:模式条 + 188 关地图 + 直达第 N 关
// ---------------------------------------------------------------------------

export interface ShootRangeHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

/** 地址栏上的 `?level=N`(壳层没给 `initialLevel` 时的兜底) */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function mount(api: GameApi): ShootRangeHandle {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "shr-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "shr-mode");
  endlessBtn.type = "button";
  const vsBtn = el("button", "shr-mode shr-mode-vs", "👫 双人同屏 · 比一比");
  vsBtn.type = "button";
  const coBtn = el("button", "shr-mode shr-mode-co", "🤝 双人同屏 · 一起打");
  coBtn.type = "button";
  bar.append(endlessBtn, vsBtn, coBtn);

  let mode: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 打不完的靶场 · 最好 ${best} 分` : "♾️ 打不完的靶场 · 来一轮!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, onExit: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    closeDirect(false);
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  function closeDirect(showMap: boolean): void {
    direct?.destroy();
    direct = null;
    modeHost.innerHTML = "";
    if (showMap) {
      modeHost.hidden = true;
      levelHost.hidden = false;
      bar.hidden = false;
    }
  }

  /**
   * 直达第 N 关:188 关框架只吐一个 `destroy`,没有「从第 N 关开始」的口子,
   * 所以按规格第九节自己开一条通道——星级照样存在框架那套 key 上,也回得去选关地图。
   */
  function openDirectLevel(index: number): void {
    const i = clamp(Math.round(index), 0, TOTAL_LEVELS - 1);
    closeDirect(false);
    mode?.destroy();
    mode = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    modeHost.innerHTML = "";

    const ci = chapterOf(CHAPTERS, i);
    const ch: Chapter = CHAPTERS[ci];
    const shell = modeShell(modeHost, `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`, () => closeDirect(true));
    let handle: PlayHandle | undefined;
    let settled = false;

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      const over = el("div", "shr-veil");
      over.append(el("div", "shr-veil-title", title), el("div", "shr-veil-sub", msg));
      const row = el("div", "shr-veil-btns");
      for (const b of buttons) {
        const btn = el("button", "shr-veil-btn", b.label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          api.play("tap");
          b.go();
        });
        row.appendChild(btn);
      }
      over.appendChild(row);
      over.style.position = "static";
      over.style.background = "transparent";
      shell.stage.appendChild(over);
    }

    const ctx: PlayCtx = {
      level: i,
      chapter: ch,
      chapterIndex: ci,
      indexInChapter: i - chapterStart(CHAPTERS, ci),
      win: (stars, msg) => {
        if (settled) return;
        settled = true;
        const prev = loadStars(meta.id)[i] ?? 0;
        saveStar(meta.id, i, stars);
        if (stars > prev) api.addStars(stars - prev);
        api.play("win");
        const buttons: Array<{ label: string; go: () => void }> = [];
        if (i + 1 < TOTAL_LEVELS) buttons.push({ label: "下一关 ▶", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 选关地图", go: () => closeDirect(true) });
        settle(`⭐ 第 ${i + 1} 关过关!`, msg ?? "打得漂亮!", buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        settle("💪 就差一点点", msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 选关地图", go: () => closeDirect(true) },
        ]);
      },
      sfx: (n) => api.play(n),
      bonusStars: (n) => api.addStars(n),
    };

    handle = playLevel(shell.stage, ctx);
    direct = {
      destroy() {
        handle?.destroy?.();
        handle = undefined;
        shell.destroy();
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = clamp(Math.round(n) - 1, 0, TOTAL_LEVELS - 1);
    openDirectLevel(i);
    return i + 1;
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode(mountArena));
  coBtn.addEventListener("click", () => openMode(mountCoop));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关卡里那一屏得省着用,三颗模式按钮只在选关地图上露面
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy() {
            handle.destroy?.();
            if (!mode && !direct) bar.hidden = false;
          },
        };
      },
      mapHint: "清完全部靶子就过关,命中率越高星星越多。笑脸靶和花朵靶碰一下就掉星。",
      grandMessage: "188 关靶场全部打通,你就是名副其实的星星神射手!",
      guideTitle: GUIDE.title,
      guide: GUIDE,
    }
  );

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy() {
      mode?.destroy();
      mode = null;
      direct?.destroy();
      direct = null;
      level.destroy();
      root.remove();
    },
  };
}

/** 图鉴:场上会出现哪些靶,各是什么规矩(攻略面板与无障碍说明共用) */
export function targetLegend(): string[] {
  return [
    "🎯 同心圆靶:越靠圆心分越高。",
    "🎈 彩色气球:一路往上飘,打中变彩纸。",
    "🛸 小飞碟 / 🤖 铁皮机器人:横着走,掉头那一下最好打。",
    "🫧 分裂靶:打中分成两个小的,记得补掉。",
    "🛡️ 护盾靶:先敲开壳,第二发才倒。",
    "🌈 彩虹靶:只待几秒,越早打分越高。",
    "🙂 好人靶 / 🌸 花朵靶:都不能打,碰一下扣分。",
    "上面那一排是远排:靶小一点,分数 1.5 倍。",
  ];
}

/** 手感三件套的一句话说明(暂停面板与攻略共用) */
export function feelNote(): string {
  return `按下去有一点点蓄力,打中会顿一下;连着打准星会撒开(最多 ${RECOIL_KICK * 2} 像素上下),停手半秒自己收回来。`;
}
