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
  FOE_INFO,
  PICKUP_INFO,
  TOUCH_LIFT,
  WEAPONS,
  applyPickup,
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

const CSS = `
.sks-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.sks-hud{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow-x:auto;margin-bottom:6px;
  padding-bottom:2px;scrollbar-width:none;}
.sks-hud::-webkit-scrollbar{display:none;}
.sks-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;color:#3F6BA8;
  box-shadow:0 2px 6px rgba(120,150,200,.24);white-space:nowrap;flex:none;}
.sks-chip-duo{background:#FFE6F0;color:#B44F84;}
.sks-chip-star{background:#E4EEFF;color:#39699F;}
.sks-chip-boss{background:#F4E7FB;color:#7A4EA3;}
.sks-chip-score{background:#E9F7EC;color:#3C7A55;}
.sks-box{position:relative;border-radius:16px;overflow:hidden;background:#EAF2FF;
  box-shadow:0 4px 12px rgba(120,150,200,.26);}
.sks-cv{display:block;width:100%;height:360px;touch-action:none;}
.sks-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(240,246,255,.94);}
.sks-veil-title{font-size:20px;font-weight:900;color:#3F6BA8;}
.sks-veil-sub{font-size:15px;font-weight:700;color:#5E769C;line-height:1.6;max-width:330px;}
.sks-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.sks-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#7FB2FF,#5A8ADD);box-shadow:0 4px 0 #4570B8;}
.sks-veil-btn.sks-ghost{background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.sks-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #4570B8;}
.sks-toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:14px;font-weight:800;color:#3F6BA8;box-shadow:0 3px 8px rgba(110,140,190,.28);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.sks-toast.sks-on{opacity:1;}
.sks-opts{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.sks-opt{border:none;border-radius:999px;padding:6px 12px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#5A7BA8;box-shadow:0 2px 0 rgba(120,150,200,.3);}
.sks-opt[aria-pressed="true"]{background:#DCEBFF;color:#2F5E9B;}
.sks-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:46px;flex-wrap:wrap;}
.sks-pads[data-players="2"]{--k:38px;}
.sks-pad{display:grid;grid-template-columns:repeat(3,var(--k));grid-auto-rows:var(--k);gap:4px;justify-content:center;}
.sks-pad-name{grid-column:1/-1;font-size:14px;font-weight:800;text-align:center;line-height:1.3;}
.sks-key{border:none;border-radius:13px;font-size:17px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#3F6BA8;box-shadow:0 3px 0 rgba(120,150,200,.34);touch-action:none;padding:0;}
.sks-key:active,.sks-key.sks-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,150,200,.34);background:#E3EFFF;}
.sks-key-fire{background:#D8ECFF;color:#2F6BA8;}
.sks-key-bomb{background:#FFE0EC;color:#B04B7C;}
.sks-key:focus-visible,.sks-veil-btn:focus-visible,.sks-mode:focus-visible,.sks-back:focus-visible,
.sks-opt:focus-visible{outline:3px solid #24456F;outline-offset:2px;}
.sks-tip{margin-top:6px;text-align:center;font-size:14px;font-weight:700;color:#63799C;line-height:1.5;}
.sks-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.sks-mode{border:none;border-radius:999px;padding:9px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#7FB2FF,#5A8ADD);box-shadow:0 4px 0 #4570B8;}
.sks-mode.sks-mode-duo{background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.sks-mode.sks-mode-vs{background:linear-gradient(180deg,#FFC46B,#E79B36);box-shadow:0 4px 0 #C07C1F;}
.sks-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #4570B8;}
.sks-topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.sks-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#3F6BA8;box-shadow:0 3px 0 rgba(120,150,200,.3);}
.sks-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#35608F;}
@media (max-width:420px){
  .sks-pads{--k:42px;}
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

interface SortieHandle {
  destroy: () => void;
  veil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
}

/** 一发合流波的冷却(秒) */
const LINK_CD = 0.5;

function createSortie(opts: SortieOptions): SortieHandle {
  const reduce = reducedMotion();
  const wrap = el("div", "sks-wrap");
  const style = el("style");
  style.textContent = CSS;
  const hud = el("div", "sks-hud");
  const box = el("div", "sks-box");
  const canvas = el("canvas", "sks-cv");
  const toast = el("div", "sks-toast");
  box.append(canvas, toast);
  const optRow = el("div", "sks-opts");
  const pads = el("div", "sks-pads");
  pads.dataset.players = String(opts.players);
  const tip = el("div", "sks-tip", opts.hint);
  wrap.append(style, hud, box, optRow, pads, tip);
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
  optRow.append(coreBtn, liftBtn);

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
    const s = rect.width / SKY_W;
    if (s <= 0) return null;
    return { x: (clientX - rect.left) / s, y: (clientY - rect.top) / s };
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
    name.textContent =
      opts.players === 2
        ? p.index === 0
          ? "朵朵 WASD · F 开火 · G 炸弹"
          : "星星 方向键 · L 开火 · K 炸弹"
        : "WASD / 方向键 · F/L 开火 · G/K 炸弹";
    pad.appendChild(name);
    const layout: Array<{ label: string; action: SkyAction | null; cls?: string; aria: string }> = [
      { label: "💣", action: "bomb", cls: "sks-key-bomb", aria: "放炸弹" },
      { label: "▲", action: "up", aria: "向上飞" },
      { label: "💠", action: "fire", cls: "sks-key-fire", aria: "开火" },
      { label: "◀", action: "left", aria: "向左飞" },
      { label: "▼", action: "down", aria: "向下飞" },
      { label: "▶", action: "right", aria: "向右飞" },
    ];
    for (const item of layout) {
      if (!item.action) {
        pad.appendChild(el("div"));
        continue;
      }
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
      if (f.y > SKY_H + 60) f.hp = 0;
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

  // -------------------------------------------------------------------------
  // 绘制
  // -------------------------------------------------------------------------

  function resize(): void {
    const cssW = Math.max(240, box.clientWidth || wrap.clientWidth || 320);
    const cssH = Math.max(260, Math.min(460, Math.round((cssW / SKY_W) * SKY_H)));
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
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
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.warn > 0) {
        // 预警:先亮一圈,再画一小段「它要往哪飞」的虚线
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
      ctx.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
      ctx.fillStyle = "#FFAF62";
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
        case "beam":
          roundRect(ctx, -s.r, -16, s.r * 2, 32, s.r);
          ctx.fill();
          break;
        case "ring":
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, s.r + 1.5, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "arrow":
        default:
          ctx.beginPath();
          ctx.moveTo(0, -s.r * 1.8);
          ctx.lineTo(s.r, s.r);
          ctx.lineTo(-s.r, s.r);
          ctx.closePath();
          ctx.fill();
          break;
      }
      ctx.restore();
    }
  }

  function drawPlane(ctx: CanvasRenderingContext2D, p: Pilot): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    // 被碰到 = 打个转(不是坠毁),转完就正过来
    if (p.spin > 0) ctx.rotate(p.spin * (reduce ? 2 : 9));
    if (p.plane.invuln > 0) ctx.globalAlpha = reduce ? 0.7 : 0.45 + 0.4 * Math.sin(clock * 14);
    ctx.fillStyle = p.index === 0 ? "#FFC2D8" : "#B9D6FF";
    ctx.beginPath();
    ctx.ellipse(-22, 6, 14, 8, -0.3, 0, Math.PI * 2);
    ctx.ellipse(22, 6, 14, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.index === 0 ? "#F58BB4" : "#7FB2FF";
    roundRect(ctx, -11, -22, 22, 42, 11);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(0, -8, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(0, -8, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,214,120,.85)";
    ctx.beginPath();
    ctx.moveTo(-6, 20);
    ctx.lineTo(0, 20 + 12 + (reduce ? 0 : Math.sin(clock * 24) * 4));
    ctx.lineTo(6, 20);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    if (p.plane.shield > 0) {
      ctx.strokeStyle = "rgba(140,220,255,.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 判定核心:白环 + 亮心,默认就开着 —— 孩子必须看得见「只有这一点会被碰到」
    if (showCore) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, CORE_DOT_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.plane.invuln > 0 ? "#9FE3FF" : "#FF6FA8";
      ctx.beginPath();
      ctx.arc(0, 0, CORE_DOT_R * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const off of wingmanOffsets(shotPlan(p.plane.levels).wingmen)) {
      ctx.save();
      ctx.translate(p.x + off.dx, p.y + off.dy);
      ctx.fillStyle = p.index === 0 ? "#FFD9E6" : "#D5E6FF";
      roundRect(ctx, -8, -12, 16, 24, 8);
      ctx.fill();
      ctx.fillStyle = p.ink;
      ctx.beginPath();
      ctx.arc(0, -3, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFoe(ctx: CanvasRenderingContext2D, f: Foe): void {
    const info = FOE_INFO[f.kind];
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.fillStyle = info.color;
    switch (f.kind) {
      case "scout":
        ctx.beginPath();
        ctx.moveTo(0, info.r);
        ctx.lineTo(-info.r, -info.r * 0.7);
        ctx.lineTo(info.r, -info.r * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case "puff":
        ctx.beginPath();
        ctx.arc(0, 0, info.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-info.r * 0.7, 2, info.r * 0.5, 0, Math.PI * 2);
        ctx.arc(info.r * 0.7, 2, info.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "kite":
        ctx.beginPath();
        ctx.moveTo(0, info.r);
        ctx.lineTo(-info.r * 0.8, 0);
        ctx.lineTo(0, -info.r);
        ctx.lineTo(info.r * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "tanker":
        roundRect(ctx, -info.r, -info.r * 0.66, info.r * 2, info.r * 1.32, info.r * 0.5);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.6)";
        roundRect(ctx, -info.r * 0.55, -info.r * 0.3, info.r * 1.1, info.r * 0.5, info.r * 0.24);
        ctx.fill();
        break;
    }
    ctx.fillStyle = "#5A4A62";
    ctx.beginPath();
    ctx.arc(-info.r * 0.28, -info.r * 0.05, 2.6, 0, Math.PI * 2);
    ctx.arc(info.r * 0.28, -info.r * 0.05, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

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
    ctx.fillStyle = ph.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.cueLeft > 0 ? "#FFD27A" : "rgba(255,255,255,.85)";
    ctx.lineWidth = b.cueLeft > 0 ? 6 : 4;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.ellipse(0, -12, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5A4A62";
    ctx.beginPath();
    ctx.arc(-13, -12, 4.4, 0, Math.PI * 2);
    ctx.arc(13, -12, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 26px "PingFang SC",system-ui,sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(b.spec.emoji, 0, 30);
    ctx.restore();

    // 血条 + 三段刻度(看得见「还有几段」)
    const w = 200;
    const pct = Math.max(0, b.hp / b.spec.hp);
    roundRect(ctx, SKY_W / 2 - w / 2, 18, w, 14, 7);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fill();
    roundRect(ctx, SKY_W / 2 - w / 2 + 2, 20, (w - 4) * pct, 10, 5);
    ctx.fillStyle = "#F5A3C4";
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

    // 预告倒计时条
    if (b.cueLeft > 0) {
      roundRect(ctx, SKY_W / 2 - 70, 40, 140, 8, 4);
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fill();
      roundRect(ctx, SKY_W / 2 - 68, 42, 136 * (1 - cueF), 4, 2);
      ctx.fillStyle = "#FFB84D";
      ctx.fill();
    }
  }

  function draw(): void {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width / SKY_W;
    const jitter = shake > 0 && !reduce ? Math.sin(clock * 70) * shake * 6 : 0;
    g.save();
    g.translate(jitter * s, 0);
    g.scale(s, s);

    const grad = g.createLinearGradient(0, 0, 0, canvas.height / s);
    grad.addColorStop(0, "#FFFFFF");
    grad.addColorStop(1, tint);
    g.fillStyle = grad;
    g.fillRect(0, 0, SKY_W, canvas.height / s);

    // 云层视差:两层不同速度往下飘,纵版的速度感就出来了(仍然是 2D)
    for (const layer of [
      { speed: 16, alpha: 0.35, scale: 1.4, seed: 0 },
      { speed: 30, alpha: 0.62, scale: 1, seed: 71 },
    ]) {
      g.fillStyle = `rgba(255,255,255,${layer.alpha})`;
      for (let i = 0; i < 5; i++) {
        const cy = ((clock * layer.speed + i * 170 + layer.seed) % (canvas.height / s + 200)) - 100;
        const cx = ((i * 149 + layer.seed) % SKY_W) + 24;
        g.beginPath();
        g.ellipse(cx, cy, 44 * layer.scale, 20 * layer.scale, 0, 0, Math.PI * 2);
        g.ellipse(cx + 30 * layer.scale, cy + 6, 30 * layer.scale, 15 * layer.scale, 0, 0, Math.PI * 2);
        g.fill();
      }
    }

    for (const gl of gliders) {
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, gl.life));
      g.translate(gl.x, gl.y);
      g.rotate(reduce ? 0 : Math.sin(gl.spin) * 0.5);
      g.fillStyle = gl.color;
      roundRect(g, -gl.r * 0.8, -gl.r * 0.5, gl.r * 1.6, gl.r, gl.r * 0.4);
      g.fill();
      g.restore();
    }

    for (const pf of puffs.live) {
      const f = Math.max(0, pf.life / pf.max);
      g.globalAlpha = f * 0.85;
      if (pf.tone === "graze") {
        g.strokeStyle = "#7FE7C4";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(pf.x, pf.y, pf.r * (1.8 - f), 0, Math.PI * 2);
        g.stroke();
      } else {
        g.fillStyle = pf.tone === "spark" ? "#FFE8A3" : "#FFFFFF";
        g.beginPath();
        g.arc(pf.x, pf.y, pf.r * (1.4 - f), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    for (const f of foes) drawFoe(g, f);
    if (boss) drawBoss(g, boss);

    for (const it of pickups) {
      g.save();
      g.translate(it.x, it.y + (reduce ? 0 : Math.sin(it.phase * 4) * 3));
      g.fillStyle = "#FFFFFF";
      g.beginPath();
      g.arc(0, 0, 15, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#8FD0FF";
      g.lineWidth = 3;
      g.stroke();
      g.font = '700 17px "PingFang SC",system-ui,sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#3F6BA8";
      g.fillText(PICKUP_INFO[it.kind].emoji, 0, 1);
      g.restore();
    }

    // 合流提示:两机靠近时拉一条彩虹带,告诉两个人「再近一点就合体」
    if (opts.link && pilots.length === 2 && !pilots[0].grounded && !pilots[1].grounded) {
      const d = Math.hypot(pilots[0].x - pilots[1].x, pilots[0].y - pilots[1].y);
      if (d < LINK_DIST * 1.5) {
        g.save();
        g.globalAlpha = linkGlow > 0 ? 0.85 : 0.3;
        g.strokeStyle = linkGlow > 0 ? "#9BE7FF" : "#C9DCF5";
        g.lineWidth = linkGlow > 0 ? 7 : 3;
        g.beginPath();
        g.moveTo(pilots[0].x, pilots[0].y);
        g.lineTo(pilots[1].x, pilots[1].y);
        g.stroke();
        g.restore();
      }
    }

    drawShots(g);
    drawBullets(g);

    for (const p of pilots) {
      if (p.grounded) continue;
      drawPlane(g, p);
    }
    g.restore();
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (running && !paused && !finished) step(dt);
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
      veilNode?.remove();
      veilNode = null;
      wrap.remove();
    },
    veil,
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
function levelFromQuery(): number | null {
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

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
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
