import { meta } from "./meta";
export { meta };

// 飞机小队:188 关八片天空 + 无尽波次 + 双人合作。
// 全部是原创卡通小飞机,被击中只是冒烟迫降滑出画面;
// 敌弹低速大弹、暖色,我方的星星弹冷色,一眼分得清谁是谁。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  PLAYER_HIT_R,
  PLAYER_ROW,
  SKY_H,
  SKY_W,
  bossX,
  buildVolley,
  stepBullets,
  type Bullet,
  type BossSpec,
  type PatternSpec,
  type PhaseSpec,
} from "./bullets";
import { BOSSES, CHAPTERS, buildEndlessWave, buildSortie, formationSlot, type FoeWave, type SortieDef } from "./levels";
import GUIDE from "./guide";
import {
  FOE_INFO,
  PICKUP_INFO,
  WEAPONS,
  applyPickup,
  circlesTouch,
  clampPlane,
  damageFoe,
  endlessScore,
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
  waveSpec,
  wingmanOffsets,
  wingmanShots,
  type Foe,
  type FoeKind,
  type PickupKind,
  type PlaneState,
  type PlayerShot,
  type SkyAction,
} from "./logic";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.ss-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.ss-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.ss-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#3F6BA8;
  box-shadow:0 2px 6px rgba(120,150,200,.24);white-space:nowrap;}
.ss-chip-duo{background:#FFE6F0;color:#B44F84;}
.ss-chip-star{background:#E4EEFF;color:#39699F;}
.ss-chip-boss{background:#F4E7FB;color:#7A4EA3;}
.ss-box{position:relative;border-radius:16px;overflow:hidden;background:#EAF2FF;
  box-shadow:0 4px 12px rgba(120,150,200,.26);}
.ss-cv{display:block;width:100%;height:360px;touch-action:none;}
.ss-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(240,246,255,.94);}
.ss-veil-title{font-size:20px;font-weight:900;color:#3F6BA8;}
.ss-veil-sub{font-size:14px;font-weight:700;color:#6F86A8;line-height:1.6;max-width:330px;}
.ss-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ss-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#7FB2FF,#5A8ADD);box-shadow:0 4px 0 #4570B8;}
.ss-veil-btn.ss-ghost{background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.ss-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #4570B8;}
.ss-toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#3F6BA8;box-shadow:0 3px 8px rgba(110,140,190,.28);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.ss-toast.ss-on{opacity:1;}
.ss-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:46px;flex-wrap:wrap;}
.ss-pads[data-players="2"]{--k:38px;}
.ss-pad{display:grid;grid-template-columns:repeat(3,var(--k));grid-auto-rows:var(--k);gap:4px;justify-content:center;}
.ss-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;text-align:center;line-height:1.3;}
.ss-key{border:none;border-radius:13px;font-size:17px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#3F6BA8;box-shadow:0 3px 0 rgba(120,150,200,.34);touch-action:none;padding:0;}
.ss-key:active,.ss-key.ss-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,150,200,.34);background:#E3EFFF;}
.ss-key-fire{background:#D8ECFF;color:#2F6BA8;}
.ss-key-bomb{background:#FFE0EC;color:#B04B7C;}
.ss-key:focus-visible,.ss-veil-btn:focus-visible,.ss-mode:focus-visible,.ss-back:focus-visible{
  outline:3px solid #24456F;outline-offset:2px;}
.ss-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#6F86A8;line-height:1.5;}
.ss-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.ss-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#7FB2FF,#5A8ADD);box-shadow:0 4px 0 #4570B8;}
.ss-mode.ss-mode-duo{background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.ss-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #4570B8;}
.ss-topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.ss-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#3F6BA8;box-shadow:0 3px 0 rgba(120,150,200,.3);}
.ss-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#35608F;}
@media (max-width:420px){
  .ss-chip{font-size:12px;padding:3px 8px;}
  .ss-pads{--k:42px;}
}
@media (prefers-reduced-motion:reduce){
  .ss-toast{transition:none;}
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

/** 冒烟迫降中的小飞机:摇摇晃晃拖着白烟滑出画面,不炸不碎 */
interface Glider {
  kind: FoeKind | "boss";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  life: number;
  color: string;
}

interface Puff {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
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
  plane: PlaneState;
  hold: Record<"left" | "right" | "up" | "down", boolean>;
  firing: boolean;
  fireCd: number;
  touched: number;
  bombsUsed: number;
  downed: number;
  /** 已经没有备用机了 */
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
    plane: makePlane(index === 1 ? "wave" : "star"),
    hold: { left: false, right: false, up: false, down: false },
    firing: false,
    fireCd: 0,
    touched: 0,
    bombsUsed: 0,
    downed: 0,
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
  /** 换阶段时的短暂停火 */
  breathe: number;
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
    result: { cleared: boolean; downed: number; total: number; escaped: number; waves: number; bossDown: boolean }
  ) => void;
  /** 无尽模式:清完一波续下一波 */
  nextWave?: (waveIndex: number) => { wave: FoeWave; pickup: PickupKind | null } | null;
  pauseNote?: string;
}

interface SortieHandle {
  destroy: () => void;
  veil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
}

function createSortie(opts: SortieOptions): SortieHandle {
  const reduce = reducedMotion();
  const wrap = el("div", "ss-wrap");
  const style = el("style");
  style.textContent = CSS;
  const hud = el("div", "ss-hud");
  const box = el("div", "ss-box");
  const canvas = el("canvas", "ss-cv");
  const toast = el("div", "ss-toast");
  box.append(canvas, toast);
  const pads = el("div", "ss-pads");
  pads.dataset.players = String(opts.players);
  const tip = el("div", "ss-tip", opts.hint);
  wrap.append(style, hud, box, pads, tip);
  opts.host.appendChild(wrap);

  const g = canvas.getContext("2d");
  const pilots: Pilot[] = [];
  for (let i = 0; i < opts.players; i++) {
    pilots.push(makePilot(i, opts.players === 1 ? SKY_W / 2 : SKY_W * (i === 0 ? 0.36 : 0.64)));
  }

  let foes: Foe[] = [];
  let foeSeq = 0;
  let enemyBullets: Bullet[] = [];
  let myShots: PlayerShot[] = [];
  let gliders: Glider[] = [];
  let puffs: Puff[] = [];
  let pickups: Pickup[] = [];
  let boss: BossRuntime | null = null;
  let waveIndex = 0;
  let spawnedTotal = 0;
  let downedTotal = 0;
  let escapedTotal = 0;
  let bossSpawned = false;
  let bossDown = false;
  /** 打完最后一架后留一点时间放冒烟迫降的动画,别一秒切结算 */
  let endDelay = 0;
  let pendingPickups = opts.pickups.slice();
  let running = true;
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let toastTimer = 0;
  let veilNode: HTMLElement | null = null;
  let clock = 0;
  let shake = 0;

  const chipWave = el("span", "ss-chip");
  const chipGear = el("span", "ss-chip");
  const chipBoss = el("span", "ss-chip ss-chip-boss");
  const chipDuoA = el("span", "ss-chip ss-chip-duo");
  const chipDuoB = el("span", "ss-chip ss-chip-star");
  const pauseBtn = el("button", "ss-back", "⏸️ 暂停");
  pauseBtn.type = "button";
  if (opts.players === 2) hud.append(chipDuoA, chipDuoB, chipWave, chipBoss, pauseBtn);
  else hud.append(chipWave, chipGear, chipBoss, pauseBtn);

  function gearLine(p: Pilot): string {
    const w = WEAPONS[p.plane.weapon];
    return `${w.emoji}${w.name} Lv${p.plane.power} · 🫧${p.plane.shield} · 💣${p.plane.bombs} · ✈️×${p.plane.spare}`;
  }

  function refreshHud(): void {
    chipWave.textContent = boss
      ? `🎯 剩 ${foes.length} 架`
      : `🌊 第 ${waveIndex} 波 · 剩 ${foes.length} 架`;
    if (opts.players === 2) {
      chipDuoA.textContent = `${pilots[0].name} ${gearLine(pilots[0])}`;
      chipDuoB.textContent = `${pilots[1].name} ${gearLine(pilots[1])}`;
    } else {
      chipGear.textContent = gearLine(pilots[0]);
    }
    if (boss) {
      const pct = Math.max(0, Math.round((boss.hp / boss.spec.hp) * 100));
      chipBoss.textContent = `${boss.spec.emoji} ${boss.spec.name} ${pct}% · ${boss.spec.phases[boss.phase].name}`;
      chipBoss.hidden = false;
    } else {
      chipBoss.hidden = true;
    }
  }

  function say(text: string): void {
    toast.textContent = text;
    toast.classList.add("ss-on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("ss-on"), 1300);
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
    boss = {
      spec,
      hp: spec.hp,
      phase: 0,
      x: SKY_W / 2,
      y: -80,
      clock: 0,
      nextVolley: spec.phases[0].patterns.map((p) => p.delay + 1.6),
      volley: spec.phases[0].patterns.map(() => 0),
      hurt: 0,
      breathe: 1.6,
    };
    say(`${spec.emoji} ${spec.name} 来啦!`);
    refreshHud();
  }

  function dropPickup(x: number, y: number, kind: PickupKind): void {
    pickups.push({ kind, x, y, vy: 90, phase: 0 });
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  function fireBomb(p: Pilot): void {
    const res = useBomb(p.plane, enemyBullets);
    if (!res.used) {
      say("炸弹用光啦,吃到 💣 才能补。");
      return;
    }
    p.plane = res.plane;
    p.bombsUsed++;
    enemyBullets = res.bullets;
    // 炸弹让在场的小飞机统统冒烟迫降,不是炸碎
    for (const f of foes) sendHome(f, p);
    foes = [];
    if (boss) {
      boss.hp = Math.max(1, boss.hp - 6);
      boss.hurt = 0.3;
    }
    opts.sfx("win");
    if (!reduce) shake = 0.35;
    say("炸弹!全场敌机冒烟迫降～");
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

  // 触屏:直接拖着自己的小飞机走,松手就停(单人时全屏可拖,双人时各管半边)
  const drags = new Map<number, { pilot: Pilot; dx: number; dy: number }>();

  function toField(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scale = canvas.width / rect.width;
    const px = (clientX - rect.left) * scale;
    const py = (clientY - rect.top) * scale;
    const s = canvas.width / SKY_W;
    return { x: px / s, y: py / s };
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
    drags.set(e.pointerId, { pilot: best, dx: best.x - pt.x, dy: best.y - pt.y });
    best.firing = true;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => {
    const drag = drags.get(e.pointerId);
    if (!drag) return;
    const pt = toField(e.clientX, e.clientY);
    if (!pt) return;
    const next = clampPlane(pt.x + drag.dx, pt.y + drag.dy);
    drag.pilot.x = next.x;
    drag.pilot.y = next.y;
  };
  const onPointerUp = (e: PointerEvent): void => {
    const drag = drags.get(e.pointerId);
    if (!drag) return;
    drag.pilot.firing = false;
    drags.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  function buildPad(p: Pilot): HTMLElement {
    const pad = el("div", "ss-pad");
    const name = el("div", "ss-pad-name");
    name.style.color = p.ink;
    name.textContent =
      opts.players === 2
        ? p.index === 0
          ? "朵朵 WASD · F 开火 · G 炸弹"
          : "星星 方向键 · L 开火 · K 炸弹"
        : "WASD / 方向键 · F/L 开火 · G/K 炸弹";
    pad.appendChild(name);
    const layout: Array<{ label: string; action: SkyAction | null; cls?: string; aria: string }> = [
      { label: "💣", action: "bomb", cls: "ss-key-bomb", aria: "放炸弹" },
      { label: "▲", action: "up", aria: "向上飞" },
      { label: "💠", action: "fire", cls: "ss-key-fire", aria: "开火" },
      { label: "◀", action: "left", aria: "向左飞" },
      { label: "▼", action: "down", aria: "向下飞" },
      { label: "▶", action: "right", aria: "向右飞" },
    ];
    for (const item of layout) {
      if (!item.action) {
        pad.appendChild(el("div"));
        continue;
      }
      const btn = el("button", `ss-key${item.cls ? ` ${item.cls}` : ""}`, item.label);
      btn.type = "button";
      btn.setAttribute("aria-label", `${p.name}${item.aria}`);
      const action = item.action;
      const press = (e: Event): void => {
        e.preventDefault();
        btn.classList.add("ss-down");
        applyAction(p.index, action, true);
      };
      const release = (e: Event): void => {
        e.preventDefault();
        btn.classList.remove("ss-down");
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
    const node = el("div", "ss-veil");
    node.append(el("div", "ss-veil-title", title), el("div", "ss-veil-sub", sub));
    const row = el("div", "ss-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `ss-veil-btn${b.ghost ? " ss-ghost" : ""}`, b.label);
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
    });
  }

  // -------------------------------------------------------------------------
  // 命中处理
  // -------------------------------------------------------------------------

  /** 敌机冒烟迫降:摇摇晃晃拖着白烟滑出画面 */
  function sendHome(foe: Foe, by: Pilot | null): void {
    const info = FOE_INFO[foe.kind];
    const away = glideAway(foe);
    gliders.push({
      kind: foe.kind,
      x: foe.x,
      y: foe.y,
      vx: away.vx,
      vy: away.vy,
      r: info.r,
      spin: 0,
      life: 2,
      color: info.color,
    });
    puffs.push({ x: foe.x, y: foe.y, r: info.r * 0.7, life: 0.6, max: 0.6 });
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
    if (res.outcome === "grounded") {
      p.grounded = true;
      p.firing = false;
      opts.sfx("oops");
      say(`${p.name}的${res.line}`);
      if (pilots.every((q) => q.grounded)) finish(false);
      return;
    }
    puffs.push({ x: p.x, y: p.y, r: 20, life: 0.7, max: 0.7 });
    opts.sfx("oops");
    if (!reduce) shake = 0.22;
    say(`${p.name}:${res.line}`);
    refreshHud();
  }

  // -------------------------------------------------------------------------
  // 一帧
  // -------------------------------------------------------------------------

  function stepPilots(dt: number): void {
    for (const p of pilots) {
      if (p.grounded) continue;
      p.plane = { ...p.plane, invuln: Math.max(0, p.plane.invuln - dt) };
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
      }
      p.fireCd -= dt;
      // 平时自动射击(免得小朋友手忙脚乱),按住开火键只是打得更密
      if (p.fireCd <= 0) {
        p.fireCd = WEAPONS[p.plane.weapon].cooldown * (p.firing ? 0.6 : 1);
        myShots = myShots.concat(playerShots(p.plane.weapon, p.plane.power, p.x, p.y - 18));
        for (const off of wingmanOffsets(p.plane.wingmen)) {
          myShots = myShots.concat(wingmanShots(p.plane.weapon, p.x + off.dx, p.y + off.dy - 10));
        }
      }
    }
  }

  function stepFoes(dt: number): void {
    const gap = currentWave?.fireGap ?? 2;
    const spec = currentWave?.fire;
    for (const f of foes) {
      f.phase += dt;
      f.y += f.vy * dt;
      f.x += Math.sin(f.phase * 1.1) * 34 * dt;
      if (f.y > SKY_H + 60) {
        // 飞过头就自己回家,不算被打下来
        f.hp = 0;
      }
      f.fireIn -= dt;
      if (f.fireIn <= 0 && spec && f.y > 30 && f.y < SKY_H * 0.62) {
        f.fireIn = gap;
        enemyBullets = enemyBullets.concat(
          buildVolley({ ...spec, count: Math.min(spec.count, 4) }, Math.floor(clock * 2), { x: f.x, y: f.y })
        );
      }
    }
    // 从底下溜过去的不算战果,而且会记在账上:放跑太多这一趟就不算完成
    const escaped = foes.filter((f) => f.hp > 0 && f.y > SKY_H + 60);
    if (escaped.length > 0) {
      escapedTotal += escaped.length;
      for (const f of escaped) {
        f.hp = 0;
        puffs.push({ x: f.x, y: SKY_H - 10, r: 14, life: 0.4, max: 0.4 });
      }
      say("有小飞机从底下溜走啦,让它们再靠近点儿。");
    }
    foes = foes.filter((f) => f.hp > 0);
  }

  function stepBoss(dt: number): void {
    if (!boss) return;
    boss.clock += dt;
    boss.hurt = Math.max(0, boss.hurt - dt);
    boss.breathe = Math.max(0, boss.breathe - dt);
    // 出场:先慢慢飞进来
    boss.y = boss.y < 130 ? Math.min(130, boss.y + 90 * dt) : 130;
    const ph = boss.spec.phases[boss.phase];
    boss.x = bossX(boss.clock, ph.swing);
    if (boss.y < 130 || boss.breathe > 0) return;

    for (let i = 0; i < ph.patterns.length; i++) {
      while (boss.clock >= boss.nextVolley[i]) {
        enemyBullets = enemyBullets.concat(
          buildVolley(ph.patterns[i], boss.volley[i], { x: bossX(boss.nextVolley[i], ph.swing), y: boss.y })
        );
        boss.volley[i]++;
        boss.nextVolley[i] += Math.max(0.05, ph.patterns[i].interval);
      }
    }
  }

  function advanceBossPhase(): void {
    if (!boss) return;
    const ratio = boss.hp / boss.spec.hp;
    const ph = boss.spec.phases[boss.phase];
    if (boss.phase < boss.spec.phases.length - 1 && ratio <= ph.until) {
      boss.phase++;
      const next = boss.spec.phases[boss.phase];
      boss.nextVolley = next.patterns.map((p) => boss!.clock + p.delay + 1.2);
      boss.volley = next.patterns.map(() => 0);
      boss.breathe = 1.2;
      // 换段时把满屏的弹清掉一次,给孩子一个喘息
      enemyBullets = [];
      opts.sfx("meow");
      say(next.shout);
      refreshHud();
    }
  }

  function stepShots(dt: number): void {
    const alive: PlayerShot[] = [];
    for (const s of myShots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -30 || s.x < -30 || s.x > SKY_W + 30) continue;
      let consumed = false;
      for (const f of foes) {
        if (f.hp <= 0) continue;
        if (!circlesTouch(s.x, s.y, s.r, f.x, f.y, FOE_INFO[f.kind].r)) continue;
        const res = damageFoe(f, s.damage);
        f.hp = res.foe.hp;
        if (res.downed) {
          f.hp = 0;
          sendHome(f, pilots[0]);
        } else {
          puffs.push({ x: s.x, y: s.y, r: 8, life: 0.2, max: 0.2 });
        }
        if (!s.pierce) {
          consumed = true;
          break;
        }
      }
      if (!consumed && boss && boss.y >= 120 && circlesTouch(s.x, s.y, s.r, boss.x, boss.y, 54)) {
        boss.hp -= s.damage;
        boss.hurt = 0.12;
        opts.sfx("coin");
        if (!s.pierce) consumed = true;
        advanceBossPhase();
      }
      if (!consumed) alive.push(s);
    }
    myShots = alive;
    foes = foes.filter((f) => f.hp > 0);

    if (boss && boss.hp <= 0) {
      const info = { ...boss };
      gliders.push({
        kind: "boss",
        x: info.x,
        y: info.y,
        vx: info.x < SKY_W / 2 ? -60 : 60,
        vy: 110,
        r: 54,
        spin: 0,
        life: 2.6,
        color: info.spec.phases[info.spec.phases.length - 1].color,
      });
      for (let i = 0; i < 6; i++) {
        puffs.push({ x: info.x + (i - 3) * 18, y: info.y + (i % 2) * 16, r: 22, life: 0.9, max: 0.9 });
      }
      boss = null;
      bossDown = true;
      enemyBullets = [];
      opts.sfx("win");
      say("大家伙冒着白烟回机库啦!");
      refreshHud();
    }
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

  function stepHits(): void {
    const keep: Bullet[] = [];
    for (const b of enemyBullets) {
      if (b.warn > 0) {
        keep.push(b);
        continue;
      }
      let hit = false;
      for (const p of pilots) {
        if (p.grounded || p.plane.invuln > 0) continue;
        if (!circlesTouch(b.x, b.y, b.r, p.x, p.y, PLAYER_HIT_R)) continue;
        hurtPilot(p);
        hit = true;
        break;
      }
      if (!hit) keep.push(b);
    }
    enemyBullets = keep;

    // 撞机也只是冒烟迫降,不是「死亡」
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
    stepPilots(dt);
    stepFoes(dt);
    stepBoss(dt);
    enemyBullets = stepBullets(enemyBullets, dt);
    stepShots(dt);
    stepPickups(dt);
    stepHits();

    for (const gl of gliders) {
      gl.life -= dt;
      gl.x += gl.vx * dt;
      gl.y += gl.vy * dt;
      gl.vy += 40 * dt;
      gl.spin += dt * 2;
      if (Math.random() < 0.4) puffs.push({ x: gl.x, y: gl.y, r: 9, life: 0.5, max: 0.5 });
    }
    gliders = gliders.filter((gl) => gl.life > 0);
    for (const pf of puffs) {
      pf.life -= dt;
      pf.y -= 18 * dt;
    }
    puffs = puffs.filter((pf) => pf.life > 0);

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
          spawnWave(more.wave);
        } else {
          // 让冒烟迫降的小飞机先滑出画面,再弹结算
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
    // 纵版:高度按战场比例来,但别高过一屏
    const cssH = Math.max(260, Math.min(460, Math.round((cssW / SKY_W) * SKY_H)));
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function drawPlane(ctx: CanvasRenderingContext2D, p: Pilot): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.plane.invuln > 0 && !reduce) ctx.globalAlpha = 0.45 + 0.4 * Math.sin(clock * 22);
    // 机身:圆头小飞机,两片圆翅膀,尾巴一撮小星星
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
    // 尾焰
    ctx.fillStyle = "rgba(255,214,120,.85)";
    ctx.beginPath();
    ctx.moveTo(-6, 20);
    ctx.lineTo(0, 20 + 12 + (reduce ? 0 : Math.sin(clock * 24) * 4));
    ctx.lineTo(6, 20);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 护盾泡泡
    if (p.plane.shield > 0) {
      ctx.strokeStyle = "rgba(140,220,255,.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 判定点:告诉小朋友「只有这一小块会被碰到」
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_HIT_R * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 僚机
    for (const off of wingmanOffsets(p.plane.wingmen)) {
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
    // 一对笑眼,提醒这是卡通飞机不是什么可怕的东西
    ctx.fillStyle = "#5A4A62";
    ctx.beginPath();
    ctx.arc(-info.r * 0.28, -info.r * 0.05, 2.6, 0, Math.PI * 2);
    ctx.arc(info.r * 0.28, -info.r * 0.05, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBoss(ctx: CanvasRenderingContext2D, b: BossRuntime): void {
    const ph = b.spec.phases[b.phase];
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.hurt > 0 && !reduce) ctx.translate(Math.sin(clock * 60) * 3, 0);
    ctx.fillStyle = ph.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 4;
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

    // 血条
    const w = 200;
    const pct = Math.max(0, b.hp / b.spec.hp);
    roundRect(ctx, SKY_W / 2 - w / 2, 18, w, 14, 7);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fill();
    roundRect(ctx, SKY_W / 2 - w / 2 + 2, 20, (w - 4) * pct, 10, 5);
    ctx.fillStyle = "#F5A3C4";
    ctx.fill();
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
    grad.addColorStop(1, opts.tint);
    g.fillStyle = grad;
    g.fillRect(0, 0, SKY_W, canvas.height / s);

    // 背景云朵:慢慢往下飘,给纵版一点速度感
    g.fillStyle = "rgba(255,255,255,.6)";
    for (let i = 0; i < 6; i++) {
      const cy = ((clock * 26 + i * 150) % (canvas.height / s + 160)) - 80;
      const cx = ((i * 137) % SKY_W) + 30;
      g.beginPath();
      g.ellipse(cx, cy, 44, 20, 0, 0, Math.PI * 2);
      g.ellipse(cx + 30, cy + 6, 30, 15, 0, 0, Math.PI * 2);
      g.fill();
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

    for (const pf of puffs) {
      g.globalAlpha = Math.max(0, pf.life / pf.max) * 0.8;
      g.fillStyle = "#FFFFFF";
      g.beginPath();
      g.arc(pf.x, pf.y, pf.r * (1.4 - pf.life / pf.max), 0, Math.PI * 2);
      g.fill();
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

    // 我方打出去的:冷色
    for (const s2 of myShots) {
      g.fillStyle = WEAPONS[s2.kind].color;
      g.beginPath();
      if (s2.kind === "wave") g.ellipse(s2.x, s2.y, s2.r, s2.r * 0.5, 0, 0, Math.PI * 2);
      else g.arc(s2.x, s2.y, s2.r, 0, Math.PI * 2);
      g.fill();
    }

    // 敌弹:暖色 + 白边,预警阶段先亮一圈
    for (const b of enemyBullets) {
      if (b.warn > 0) {
        g.strokeStyle = "rgba(255,170,120,.9)";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
        g.stroke();
        continue;
      }
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fillStyle = "#FFB067";
      g.fill();
      g.strokeStyle = "#FFFFFF";
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
      g.fillStyle = "rgba(255,255,255,.9)";
      g.fill();
    }

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
      clearTimeout(toastTimer);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      drags.clear();
      wrap.remove();
    },
    veil,
  };
}

// ---------------------------------------------------------------------------
// 188 关闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def: SortieDef = buildSortie(ctx.level);
  let sortie: SortieHandle | null = null;

  sortie = createSortie({
    host: stage,
    players: 1,
    tint: CHAPTERS[def.chapter].color,
    hint: def.hint,
    waves: def.waves,
    boss: def.boss,
    pickups: def.pickups,
    sfx: ctx.sfx,
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
        ctx.win(starsForSortie(stat), sortieMessage(stat));
        return;
      }
      if (!result.cleared) {
        ctx.lose(
          def.boss
            ? `${def.boss.name}还剩一口气。留一颗炸弹给它的最后一段,下次一定行。`
            : "小飞机都去检修啦。记住机身判定点只有中间那一小块,别急着往缝里冲。"
        );
        return;
      }
      ctx.lose(`放跑了 ${result.escaped} 架,超过 ${escapeLimit(result.total)} 架就得重飞一趟。别等它们贴到底才开火。`);
    },
  });

  return {
    destroy() {
      sortie?.destroy();
      sortie = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽波次
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "ss-topbar");
  const back = el("button", "ss-back", "← 返回");
  back.type = "button";
  bar.append(back, el("div", "ss-title", "♾️ 无尽波次"));
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let sortie: SortieHandle | null = null;
  let reached = 1;

  function start(): void {
    sortie?.destroy();
    stage.innerHTML = "";
    reached = 1;
    const first = waveSpec(1);
    sortie = createSortie({
      host: stage,
      players: 1,
      tint: "#E7F0FF",
      hint: "一波接一波,越往后敌机越多。吃到 ⬆️🫧💣🛩️ 会越打越顺手。",
      waves: [buildEndlessWave(1, first.kinds, first.foes, first.speed)],
      boss: null,
      pickups: first.pickup ? [first.pickup] : [],
      sfx: api.play,
      pauseNote: "波次会在这里等你,回来接着飞。",
      nextWave: (index) => {
        const spec = waveSpec(index + 1);
        reached = index + 1;
        return { wave: buildEndlessWave(index + 1, spec.kinds, spec.foes, spec.speed), pickup: spec.pickup };
      },
      onFinish: (pilots, result) => {
        const score = endlessScore(reached, result.downed);
        const best = save.recordEndlessBest(meta.id, score);
        api.play(score >= best ? "win" : "oops");
        sortie?.veil(
          "这趟飞到这里 ✈️",
          `飞到第 ${reached} 波,一共请回机库 ${result.downed} 架小飞机,被碰到 ${pilots[0].touched} 次。` +
            `本次 ${score} 分,历史最好 ${best} 分。`,
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

// ---------------------------------------------------------------------------
// 双人合作
// ---------------------------------------------------------------------------

function mountCoop(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "ss-topbar");
  const back = el("button", "ss-back", "← 返回");
  back.type = "button";
  bar.append(back, el("div", "ss-title", "👫 双人合作 · 同屏两机"));
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let sortie: SortieHandle | null = null;
  let round = 0;

  function start(): void {
    sortie?.destroy();
    stage.innerHTML = "";
    // 合作模式打「一章的 Boss」:每次换一位,打完接着换下一位
    const boss = BOSSES[round % BOSSES.length];
    const spec = waveSpec(3 + round);
    sortie = createSortie({
      host: stage,
      players: 2,
      tint: "#F1ECFC",
      hint: `一起打${boss.emoji} ${boss.name}。朵朵 WASD + F/G,星星 方向键 + L/K,谁的备用机都能顶上。`,
      waves: [buildEndlessWave(3 + round, spec.kinds, spec.foes, spec.speed)],
      boss,
      pickups: ["shield", "power", "wing"],
      sfx: api.play,
      pauseNote: "两个人的装备都留着,商量好再继续。",
      onFinish: (pilots, result) => {
        const together = pilots.reduce((s, p) => s + p.downed, 0);
        const won = result.cleared && result.bossDown;
        api.play(won ? "win" : "oops");
        const line = won
          ? `两个人一共请回 ${together} 架小飞机,${boss.name}也回机库啦!朵朵 ${pilots[0].downed} 架,星星 ${pilots[1].downed} 架。`
          : `这次差一点点。${boss.name}还剩一口气,下次一个人吸引弹幕、一个人专心输出试试。`;
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
// 入口
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "ss-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "ss-mode");
  endlessBtn.type = "button";
  const coopBtn = el("button", "ss-mode ss-mode-duo", "👫 双人合作");
  coopBtn.type = "button";
  bar.append(endlessBtn, coopBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽波次 · 最好 ${best} 分` : "♾️ 无尽波次 · 起飞!";
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

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "每章最后一关是大 Boss,三段弹幕各有各的躲法。一下都不挨碰才是三星。",
      grandMessage: "八片天空全部飞完,你就是飞机小队的队长!",
      guideTitle: GUIDE.title,
      guide: GUIDE,
    }
  );

  return {
    destroy() {
      current?.destroy();
      current = null;
      level.destroy();
      root.remove();
    },
  };
}
