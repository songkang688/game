import { meta } from "./meta";
export { meta };

// 星星射击场:188 关十大靶场 + 无尽靶潮 + 双人分屏比命中率。
// 靶子全是同心圆靶 / 气球 / 飞碟 / 铁皮机器人 / 举旗子的好人靶,
// 打中只有「啵一声变彩纸」「摊手坐下」这类卡通反馈,没有任何受伤表现。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import { CHAPTERS, buildDuelTargets, buildLevel, buildTide, type LevelDef } from "./levels";
import {
  AIM_BOUNDS,
  FIELD_H,
  FIELD_W,
  MUZZLE_X,
  MUZZLE_Y,
  NUDGE_STEP,
  accuracy,
  accuracyGrade,
  aimToVelocity,
  canFire,
  comboMultiplier,
  duelResult,
  fireGun,
  isOrderViolation,
  isPauseKey,
  keyToAction,
  makeGun,
  nextOrder,
  nudgeAim,
  roundMessage,
  scoreForHit,
  shotPoint,
  startReload,
  starsForRound,
  stepGun,
  stepTarget,
  tideScore,
  tideWave,
  traceShot,
  type Aim,
  type Block,
  type Gun,
  type RangeAction,
  type Target,
  type TargetKind,
} from "./logic";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.sr-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.sr-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.sr-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#A2557C;
  box-shadow:0 2px 6px rgba(190,130,165,.24);white-space:nowrap;}
.sr-chip-warn{background:#FFF0D6;color:#A9761F;}
.sr-chip-duo{background:#FFE6F0;color:#B44F84;}
.sr-chip-star{background:#E4EEFF;color:#39699F;}
.sr-mag{display:inline-flex;gap:3px;align-items:center;vertical-align:middle;}
.sr-bullet{width:7px;height:13px;border-radius:4px;background:#F5B8CE;display:inline-block;}
.sr-bullet-off{background:#EDE6EE;}
.sr-box{position:relative;border-radius:16px;overflow:hidden;background:#FFF6FA;
  box-shadow:0 4px 12px rgba(190,150,175,.24);}
.sr-cv{display:block;width:100%;height:240px;cursor:crosshair;}
.sr-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,247,251,.94);}
.sr-veil-title{font-size:20px;font-weight:900;color:#A2557C;}
.sr-veil-sub{font-size:14px;font-weight:700;color:#9C7A90;line-height:1.6;max-width:330px;}
.sr-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.sr-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.sr-veil-btn.sr-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.sr-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #C25A80;}
.sr-toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#A2557C;box-shadow:0 3px 8px rgba(180,130,160,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.sr-toast.sr-on{opacity:1;}
.sr-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:46px;flex-wrap:wrap;}
.sr-pads[data-players="2"]{--k:38px;}
.sr-pad{display:grid;grid-template-columns:repeat(3,var(--k));grid-auto-rows:var(--k);gap:4px;justify-content:center;}
.sr-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;text-align:center;line-height:1.3;}
.sr-key{border:none;border-radius:13px;font-size:17px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#A2557C;box-shadow:0 3px 0 rgba(190,140,170,.34);touch-action:none;padding:0;}
.sr-key:active,.sr-key.sr-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(190,140,170,.34);background:#FFE7F0;}
.sr-key-fire{background:#FFD3E2;color:#B04B7C;}
.sr-key-reload{background:#DFEDFF;color:#3F72A8;}
.sr-key:focus-visible,.sr-veil-btn:focus-visible,.sr-mode:focus-visible,.sr-back:focus-visible{
  outline:3px solid #6B3A56;outline-offset:2px;}
.sr-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#9C7A90;line-height:1.5;}
.sr-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.sr-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.sr-mode.sr-mode-duo{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.sr-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #C25A80;}
.sr-topbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.sr-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#A2557C;box-shadow:0 3px 0 rgba(190,140,170,.3);}
.sr-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#8F4E71;}
@media (max-width:420px){
  .sr-chip{font-size:12px;padding:3px 8px;}
  .sr-pads{--k:42px;}
}
@media (prefers-reduced-motion:reduce){
  .sr-toast{transition:none;}
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

// ---------------------------------------------------------------------------
// 靶场运行时
// ---------------------------------------------------------------------------

interface Tracer {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  g: number;
  /** 命中时刻,超过就画到这里为止 */
  hitT: number;
  life: number;
}

interface Burst {
  x: number;
  y: number;
  life: number;
  max: number;
  colors: string[];
  kind: TargetKind | "miss";
}

/** 被打中后慢慢飘走的靶(气球变彩纸、机器人摊手坐下、飞碟晃着滑走) */
interface Fallen {
  kind: TargetKind;
  x: number;
  y: number;
  r: number;
  vy: number;
  rot: number;
  life: number;
}

interface Pane {
  index: number;
  name: string;
  ink: string;
  targets: Target[];
  blocks: Block[];
  aim: Aim;
  gun: Gun;
  hold: Record<"left" | "right" | "up" | "down", boolean>;
  shots: number;
  hits: number;
  friendHits: number;
  orderMistakes: number;
  combo: number;
  bestCombo: number;
  score: number;
  cleared: number;
  tracers: Tracer[];
  bursts: Burst[];
  fallen: Fallen[];
  /** 画布上属于这个玩家的区域(设备像素) */
  rect: { x: number; y: number; w: number; h: number };
  /** 换弹提示闪一下 */
  flash: number;
}

const PANE_INK = ["#B44F84", "#39699F"];
const PANE_NAME = ["朵朵", "星星"];

function makePane(index: number, targets: Target[], blocks: Block[], magSize: number, reloadTime: number): Pane {
  return {
    index,
    name: PANE_NAME[index] ?? `${index + 1} 号`,
    ink: PANE_INK[index] ?? "#7A5A90",
    targets,
    blocks,
    aim: { x: FIELD_W / 2, y: FIELD_H * 0.45 },
    gun: makeGun(magSize, reloadTime),
    hold: { left: false, right: false, up: false, down: false },
    shots: 0,
    hits: 0,
    friendHits: 0,
    orderMistakes: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    cleared: 0,
    tracers: [],
    bursts: [],
    fallen: [],
    rect: { x: 0, y: 0, w: 1, h: 1 },
    flash: 0,
  };
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
  /** 每人的弹药总量,0 表示不限 */
  shotBudget: number;
  magSize: number;
  reloadTime: number;
  /** 每个玩家一份靶阵(双人时两边一样) */
  makeTargets: (playerIndex: number) => Target[];
  blocks: Block[];
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  /** 一个玩家清完场 / 时间到 / 子弹打完时调用 */
  onFinish: (panes: Pane[], reason: "cleared" | "timeup" | "empty") => void;
  /** 靶潮模式:清完一波后要不要续下一波,返回 null 表示不续 */
  nextWave?: (pane: Pane) => { targets: Target[]; seconds: number } | null;
  /** 暂停面板里的额外说明 */
  pauseNote?: string;
}

interface FieldHandle {
  destroy: () => void;
  /** 把结算浮层盖上去 */
  veil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
}

const SKY_TOP = "#FFF7FB";

function createField(opts: FieldOptions): FieldHandle {
  const reduce = reducedMotion();
  const wrap = el("div", "sr-wrap");
  const style = el("style");
  style.textContent = CSS;
  const hud = el("div", "sr-hud");
  const box = el("div", "sr-box");
  const canvas = el("canvas", "sr-cv");
  const toast = el("div", "sr-toast");
  box.append(canvas, toast);
  const pads = el("div", "sr-pads");
  pads.dataset.players = String(opts.players);
  const tip = el("div", "sr-tip");
  tip.textContent = opts.hint;
  wrap.append(style, hud, box, pads, tip);
  opts.host.appendChild(wrap);

  const g = canvas.getContext("2d");
  const panes: Pane[] = [];
  for (let i = 0; i < opts.players; i++) {
    panes.push(makePane(i, opts.makeTargets(i), opts.blocks, opts.magSize, opts.reloadTime));
  }

  let timeLeft = opts.seconds;
  let shotsLeft = opts.shotBudget;
  let running = true;
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let toastTimer = 0;
  let veilNode: HTMLElement | null = null;

  // HUD 元素
  const chipTargets = el("span", "sr-chip");
  const chipTime = el("span", "sr-chip sr-chip-warn");
  const chipAmmo = el("span", "sr-chip");
  const chipCombo = el("span", "sr-chip");
  const chipAcc = el("span", "sr-chip");
  const chipDuoA = el("span", "sr-chip sr-chip-duo");
  const chipDuoB = el("span", "sr-chip sr-chip-star");
  const pauseBtn = el("button", "sr-back", "⏸️ 暂停");
  pauseBtn.type = "button";
  if (opts.players === 2) hud.append(chipDuoA, chipDuoB, chipTime, pauseBtn);
  else hud.append(chipTargets, chipAmmo, chipCombo, chipAcc, chipTime, pauseBtn);

  function magHTML(gun: Gun): string {
    let s = '<span class="sr-mag">';
    for (let i = 0; i < gun.magSize; i++) {
      s += `<i class="sr-bullet${i < gun.mag ? "" : " sr-bullet-off"}"></i>`;
    }
    return `${s}</span>`;
  }

  function aliveNeed(pane: Pane): number {
    return pane.targets.filter((t) => t.alive && t.kind !== "friend").length;
  }

  function refreshHud(): void {
    if (opts.players === 2) {
      for (const [chip, pane] of [
        [chipDuoA, panes[0]],
        [chipDuoB, panes[1]],
      ] as Array<[HTMLElement, Pane]>) {
        const acc = Math.round(accuracy(pane.hits, pane.shots) * 100);
        chip.textContent = `${pane.name} 命中 ${pane.hits}/${pane.shots} · ${acc}%`;
      }
    } else {
      const p = panes[0];
      chipTargets.textContent = `🎯 剩 ${aliveNeed(p)} 个`;
      chipAmmo.innerHTML = p.gun.reloadLeft > 0 ? "🔄 换弹中…" : magHTML(p.gun);
      chipCombo.textContent = `🔥 连击 ${p.combo}（×${comboMultiplier(p.combo).toFixed(1)}）`;
      const acc = Math.round(accuracy(p.hits, p.shots) * 100);
      chipAcc.textContent = `🎖️ 命中率 ${acc}%`;
    }
    const bits: string[] = [];
    if (opts.seconds > 0) bits.push(`⏱️ ${Math.max(0, Math.ceil(timeLeft))} 秒`);
    if (opts.shotBudget > 0) bits.push(`🌟 还剩 ${Math.max(0, shotsLeft)} 发`);
    chipTime.textContent = bits.join(" · ");
    chipTime.hidden = bits.length === 0;
  }

  function say(text: string): void {
    toast.textContent = text;
    toast.classList.add("sr-on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("sr-on"), 1100);
  }

  // -------------------------------------------------------------------------
  // 开火
  // -------------------------------------------------------------------------

  function shoot(pane: Pane): void {
    if (!running || paused || finished) return;
    if (opts.shotBudget > 0 && shotsLeft <= 0) return;
    const res = fireGun(pane.gun);
    if (!res.fired) {
      if (pane.gun.reloadLeft > 0) say("正在换弹,稍等一下～");
      return;
    }
    pane.gun = res.gun;
    pane.shots++;
    if (opts.shotBudget > 0) shotsLeft--;
    opts.sfx("tap");

    const shot = aimToVelocity(MUZZLE_X, MUZZLE_Y, pane.aim.x, pane.aim.y);
    const hit = traceShot(shot, pane.targets, pane.blocks);
    pane.tracers.push({ x0: shot.x0, y0: shot.y0, vx: shot.vx, vy: shot.vy, g: shot.g, hitT: hit.t, life: 0.22 });

    const target = hit.targetId === null ? null : pane.targets.find((t) => t.id === hit.targetId) ?? null;
    if (!target) {
      pane.combo = 0;
      pane.bursts.push({ x: hit.x, y: hit.y, life: 0.3, max: 0.3, colors: ["#D8CFE0"], kind: "miss" });
      if (hit.blocked) say("被木板挡住啦,换个角度试试。");
      return;
    }

    if (target.kind === "friend") {
      pane.friendHits++;
      pane.combo = 0;
      pane.score += scoreForHit("friend", hit.offset, target.r, 0);
      pane.bursts.push({ x: target.x, y: target.y - target.r - 8, life: 0.7, max: 0.7, colors: ["#FFD27F"], kind: "friend" });
      opts.sfx("oops");
      say("那是好人靶呀,它在跟你打招呼呢。");
      refreshHud();
      return;
    }

    // 顺序打错了照样把靶打倒——不然万一它正好挡在下一个号码前面,这一关就走不下去了。
    // 代价是断连击、记一次失误,三星线过不去。
    const outOfOrder = isOrderViolation(pane.targets, target);
    if (outOfOrder) {
      pane.orderMistakes++;
      pane.combo = 0;
      say(`该打 ${nextOrder(pane.targets)} 号的,顺序乱了要掉星哦。`);
      opts.sfx("oops");
    }

    target.alive = false;
    pane.hits++;
    pane.cleared++;
    pane.score += scoreForHit(target.kind, hit.offset, target.r, pane.combo);
    pane.combo++;
    pane.bestCombo = Math.max(pane.bestCombo, pane.combo);
    pane.bursts.push({
      x: target.x,
      y: target.y,
      life: 0.55,
      max: 0.55,
      colors: burstColors(target.kind),
      kind: target.kind,
    });
    if (target.kind === "robot" || target.kind === "ufo") {
      pane.fallen.push({ kind: target.kind, x: target.x, y: target.y, r: target.r, vy: 40, rot: 0, life: 1.4 });
    }
    opts.sfx(target.kind === "balloon" ? "pop" : target.kind === "bull" ? "coin" : "jump");
    if (pane.combo >= 3 && pane.combo % 3 === 0) say(`${pane.combo} 连击!倍率 ×${comboMultiplier(pane.combo).toFixed(1)}`);
    refreshHud();

    if (aliveNeed(pane) === 0) {
      const more = opts.nextWave?.(pane);
      if (more) {
        pane.targets = more.targets;
        timeLeft = more.seconds;
        say("新的一波来啦!");
        refreshHud();
      } else {
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
      default:
        return ["#FFE6B8"];
    }
  }

  function doReload(pane: Pane): void {
    if (!running || paused || finished) return;
    const before = pane.gun.reloadLeft;
    pane.gun = startReload(pane.gun);
    if (pane.gun.reloadLeft > 0 && before <= 0) {
      opts.sfx("meow");
      pane.flash = 0.4;
      refreshHud();
    }
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  function applyAction(player: number, action: RangeAction, down: boolean): void {
    const pane = panes[player];
    if (!pane) return;
    if (action === "fire") {
      if (down) shoot(pane);
      return;
    }
    if (action === "reload") {
      if (down) doReload(pane);
      return;
    }
    pane.hold[action] = down;
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

  /** 画布坐标 → 场地坐标(找到指针落在哪个分屏里) */
  function pickPane(clientX: number, clientY: number): { pane: Pane; x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    for (const pane of panes) {
      const r = pane.rect;
      if (py >= r.y && py <= r.y + r.h) {
        const scale = r.w / FIELD_W;
        const offX = r.x;
        const offY = r.y + (r.h - FIELD_H * scale) / 2;
        return {
          pane,
          x: Math.max(AIM_BOUNDS.x0, Math.min(AIM_BOUNDS.x1, (px - offX) / scale)),
          y: Math.max(AIM_BOUNDS.y0, Math.min(AIM_BOUNDS.y1, (py - offY) / scale)),
        };
      }
    }
    return null;
  }

  let dragId = -1;
  let dragMoved = false;
  let dragPane: Pane | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    const hit = pickPane(e.clientX, e.clientY);
    if (!hit) return;
    dragId = e.pointerId;
    dragMoved = false;
    dragPane = hit.pane;
    hit.pane.aim = { x: hit.x, y: hit.y };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => {
    const hit = pickPane(e.clientX, e.clientY);
    if (!hit) return;
    if (e.pointerId === dragId && dragPane) {
      if (Math.hypot(hit.x - dragPane.aim.x, hit.y - dragPane.aim.y) > 10) dragMoved = true;
      dragPane.aim = { x: hit.x, y: hit.y };
    } else if (e.pointerType === "mouse" && dragId === -1) {
      hit.pane.aim = { x: hit.x, y: hit.y };
    }
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== dragId) return;
    const pane = dragPane;
    dragId = -1;
    dragPane = null;
    canvas.releasePointerCapture?.(e.pointerId);
    // 点一下就是「瞄这里并且开火」,拖动只瞄不打(方便触屏慢慢挪准星)
    if (pane && !dragMoved) shoot(pane);
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // 触屏等价按钮:每人一套「上下左右微调 + 开火 + 换弹」
  function buildPad(pane: Pane): HTMLElement {
    const pad = el("div", "sr-pad");
    const name = el("div", "sr-pad-name");
    name.style.color = pane.ink;
    name.textContent =
      opts.players === 2
        ? pane.index === 0
          ? "朵朵 WASD 微调 · F 开火 · G 换弹"
          : "星星 方向键微调 · L 开火 · K 换弹"
        : "WASD / 方向键微调 · F/L 开火 · G/K 换弹";
    pad.appendChild(name);

    const layout: Array<{ label: string; action: RangeAction | null; cls?: string; aria: string }> = [
      { label: "", action: null, aria: "" },
      { label: "▲", action: "up", aria: "准星上移" },
      { label: "🔄", action: "reload", cls: "sr-key-reload", aria: "换弹" },
      { label: "◀", action: "left", aria: "准星左移" },
      { label: "▼", action: "down", aria: "准星下移" },
      { label: "▶", action: "right", aria: "准星右移" },
      { label: "", action: null, aria: "" },
      { label: "💥", action: "fire", cls: "sr-key-fire", aria: "开火" },
      { label: "", action: null, aria: "" },
    ];
    for (const item of layout) {
      if (!item.action) {
        pad.appendChild(el("div"));
        continue;
      }
      const btn = el("button", `sr-key${item.cls ? ` ${item.cls}` : ""}`, item.label);
      btn.type = "button";
      btn.setAttribute("aria-label", `${pane.name}${item.aria}`);
      const action = item.action;
      const press = (e: Event): void => {
        e.preventDefault();
        btn.classList.add("sr-down");
        applyAction(pane.index, action, true);
      };
      const release = (e: Event): void => {
        e.preventDefault();
        btn.classList.remove("sr-down");
        applyAction(pane.index, action, false);
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
      pad.appendChild(btn);
    }
    return pad;
  }
  for (const pane of panes) pads.appendChild(buildPad(pane));

  // -------------------------------------------------------------------------
  // 暂停 / 结算
  // -------------------------------------------------------------------------

  function veil(
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    veilNode?.remove();
    const node = el("div", "sr-veil");
    node.append(el("div", "sr-veil-title", title), el("div", "sr-veil-sub", sub));
    const row = el("div", "sr-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `sr-veil-btn${b.ghost ? " sr-ghost" : ""}`, b.label);
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
      veil("休息一下 ⏸️", opts.pauseNote ?? "准星和弹匣都给你留着,随时回来继续。", [
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

  function finish(reason: "cleared" | "timeup" | "empty"): void {
    if (finished) return;
    finished = true;
    running = false;
    opts.onFinish(panes, reason);
  }

  // -------------------------------------------------------------------------
  // 主循环
  // -------------------------------------------------------------------------

  function step(dt: number): void {
    for (const pane of panes) {
      pane.gun = stepGun(pane.gun, dt);
      pane.flash = Math.max(0, pane.flash - dt);
      let dx = 0;
      let dy = 0;
      if (pane.hold.left) dx -= NUDGE_STEP;
      if (pane.hold.right) dx += NUDGE_STEP;
      if (pane.hold.up) dy -= NUDGE_STEP;
      if (pane.hold.down) dy += NUDGE_STEP;
      if (dx !== 0 || dy !== 0) pane.aim = nudgeAim(pane.aim, dx * dt * 12, dy * dt * 12);
      pane.targets = pane.targets.map((t) => stepTarget(t, dt));
      pane.tracers = pane.tracers.filter((tr) => (tr.life -= dt) > 0);
      pane.bursts = pane.bursts.filter((b) => (b.life -= dt) > 0);
      for (const f of pane.fallen) {
        f.life -= dt;
        f.y += f.vy * dt;
        f.vy += 90 * dt;
        f.rot += dt * (f.kind === "ufo" ? 1.2 : 2.2);
      }
      pane.fallen = pane.fallen.filter((f) => f.life > 0);
    }
    if (opts.seconds > 0 && !finished) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        finish("timeup");
      }
    }
    if (opts.shotBudget > 0 && !finished && shotsLeft <= 0) {
      const idle = panes.every((p) => p.tracers.length === 0);
      if (idle) finish("empty");
    }
    refreshHud();
  }

  // -------------------------------------------------------------------------
  // 绘制
  // -------------------------------------------------------------------------

  function resize(): void {
    const cssW = Math.max(240, box.clientWidth || wrap.clientWidth || 320);
    const perPaneH = Math.min(opts.players === 2 ? 210 : 300, Math.round((cssW / FIELD_W) * FIELD_H));
    const cssH = perPaneH * opts.players;
    canvas.style.height = `${cssH}px`;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    for (let i = 0; i < panes.length; i++) {
      panes[i].rect = {
        x: 0,
        y: Math.round((canvas.height / opts.players) * i),
        w: canvas.width,
        h: Math.round(canvas.height / opts.players),
      };
    }
  }

  function drawTarget(ctx: CanvasRenderingContext2D, t: Target, wobble: number): void {
    const { x, y, r } = t;
    ctx.save();
    ctx.translate(x, y);
    switch (t.kind) {
      case "bull": {
        const rings = ["#FFFFFF", "#FFC9DC", "#FFFFFF", "#F4859F"];
        for (let i = 0; i < rings.length; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, r * (1 - i * 0.24), 0, Math.PI * 2);
          ctx.fillStyle = rings[i];
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = "#D95C82";
        ctx.fill();
        ctx.strokeStyle = "#E7A9BE";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#C9A98F";
        ctx.fillRect(-4, r * 0.9, 8, r * 0.7);
        break;
      }
      case "balloon": {
        ctx.strokeStyle = "#D7C9DE";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.quadraticCurveTo(6, r * 1.6, 0, r * 2.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.86, r, 0, 0, Math.PI * 2);
        const hue = ["#FF9FC4", "#9BD9F5", "#C7ED9E", "#FFD48A"][t.id % 4];
        ctx.fillStyle = hue;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.2, r * 0.28, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fill();
        break;
      }
      case "ufo": {
        ctx.beginPath();
        ctx.ellipse(0, r * 0.15, r, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#B9CFE8";
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.2, r * 0.5, r * 0.45, 0, Math.PI, 0);
        ctx.fillStyle = "#DCEBFB";
        ctx.fill();
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(i * r * 0.34, r * 0.2, r * 0.09, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? "#FFD98A" : "#9FD0F5";
          ctx.fill();
        }
        break;
      }
      case "robot": {
        const bob = Math.sin(wobble * 4 + t.phase) * (reduce ? 0 : 2);
        ctx.translate(0, bob);
        ctx.strokeStyle = "#A9BCCB";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.75);
        ctx.lineTo(0, -r * 1.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 1.12, r * 0.11, 0, Math.PI * 2);
        ctx.fillStyle = "#FFB3C8";
        ctx.fill();
        roundRect(ctx, -r * 0.7, -r * 0.75, r * 1.4, r * 1.5, r * 0.3);
        ctx.fillStyle = "#D7E3ED";
        ctx.fill();
        ctx.strokeStyle = "#AFC2D2";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#5B7386";
        ctx.beginPath();
        ctx.arc(-r * 0.24, -r * 0.18, r * 0.11, 0, Math.PI * 2);
        ctx.arc(r * 0.24, -r * 0.18, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#8FA6B8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, r * 0.28);
        ctx.lineTo(r * 0.22, r * 0.28);
        ctx.stroke();
        break;
      }
      case "number": {
        roundRect(ctx, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.28);
        ctx.fillStyle = "#EAF1FB";
        ctx.fill();
        ctx.strokeStyle = "#9FB7D4";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#3F6B9E";
        ctx.font = `900 ${Math.round(r * 1.05)}px "PingFang SC",system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(t.order), 0, r * 0.04);
        break;
      }
      case "friend": {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = "#FFF2CE";
        ctx.fill();
        ctx.strokeStyle = "#F0C367";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#9C7433";
        ctx.beginPath();
        ctx.arc(-r * 0.28, -r * 0.16, r * 0.1, 0, Math.PI * 2);
        ctx.arc(r * 0.28, -r * 0.16, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#9C7433";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, r * 0.08, r * 0.36, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke();
        // 手里的小旗子:一眼认出「这是好人靶」
        ctx.strokeStyle = "#B08A4E";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r * 0.95, -r * 0.2);
        ctx.lineTo(r * 0.95, -r * 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.95, -r * 1.1);
        ctx.lineTo(r * 1.75, -r * 0.86);
        ctx.lineTo(r * 0.95, -r * 0.62);
        ctx.closePath();
        ctx.fillStyle = "#8FD9A8";
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function drawPane(ctx: CanvasRenderingContext2D, pane: Pane, now: number): void {
    const r = pane.rect;
    const scale = r.w / FIELD_W;
    const offY = r.y + (r.h - FIELD_H * scale) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    // 天空 + 地面
    const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(1, opts.tint);
    ctx.fillStyle = grad;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    ctx.translate(r.x, offY);
    ctx.scale(scale, scale);

    // 远处的小山与草地,纯装饰
    ctx.fillStyle = "rgba(255,255,255,.5)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(120 + i * 250, 520, 130, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = "#DCEFCF";
    ctx.fillRect(0, 520, FIELD_W, FIELD_H - 520);
    ctx.fillStyle = "#C7E4B4";
    ctx.fillRect(0, 520, FIELD_W, 10);

    // 遮挡木板
    for (const b of pane.blocks) {
      roundRect(ctx, b.x, b.y, b.w, b.h, 8);
      ctx.fillStyle = "#D9B892";
      ctx.fill();
      ctx.strokeStyle = "#BE9A72";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 打掉之后飘走的靶
    for (const f of pane.fallen) {
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
        // 摊手坐下:两条小胳膊摊开,配一个「>_<」的表情
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

    // 靶子
    for (const t of pane.targets) {
      if (!t.alive) continue;
      drawTarget(ctx, t, now);
    }

    // 命中特效
    for (const b of pane.bursts) {
      const k = 1 - b.life / b.max;
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

    // 弹道拖影
    for (const tr of pane.tracers) {
      const end = Math.min(tr.hitT, 1.2);
      ctx.beginPath();
      for (let s = 0; s <= 16; s++) {
        const t = (end * s) / 16;
        const p = shotPoint({ x0: tr.x0, y0: tr.y0, vx: tr.vx, vy: tr.vy, g: tr.g, flight: end }, t);
        if (s === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = `rgba(255,214,120,${Math.max(0, tr.life / 0.22) * 0.9})`;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // 发射台
    ctx.fillStyle = "#F4C7DA";
    roundRect(ctx, MUZZLE_X - 46, FIELD_H - 34, 92, 40, 14);
    ctx.fill();
    ctx.fillStyle = "#E094B4";
    ctx.font = '900 22px "PingFang SC",system-ui,sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("★", MUZZLE_X, FIELD_H - 8);

    // 准星
    const aim = pane.aim;
    ctx.strokeStyle = pane.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aim.x - 30, aim.y);
    ctx.lineTo(aim.x - 8, aim.y);
    ctx.moveTo(aim.x + 8, aim.y);
    ctx.lineTo(aim.x + 30, aim.y);
    ctx.moveTo(aim.x, aim.y - 30);
    ctx.lineTo(aim.x, aim.y - 8);
    ctx.moveTo(aim.x, aim.y + 8);
    ctx.lineTo(aim.x, aim.y + 30);
    ctx.stroke();

    // 换弹提示
    if (pane.gun.reloadLeft > 0) {
      const pct = 1 - pane.gun.reloadLeft / pane.gun.reloadTime;
      roundRect(ctx, MUZZLE_X - 90, FIELD_H - 78, 180, 20, 10);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fill();
      roundRect(ctx, MUZZLE_X - 88, FIELD_H - 76, 176 * pct, 16, 8);
      ctx.fillStyle = "#F79BB8";
      ctx.fill();
      ctx.fillStyle = "#A2557C";
      ctx.font = '800 14px "PingFang SC",system-ui,sans-serif';
      ctx.fillText("换弹中…", MUZZLE_X, FIELD_H - 63);
    }

    // 分屏时给每个人标个名字
    if (opts.players === 2) {
      ctx.fillStyle = pane.ink;
      ctx.font = '900 26px "PingFang SC",system-ui,sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(pane.name, 18, 44);
    }
    ctx.restore();

    if (opts.players === 2 && pane.index === 0) {
      ctx.fillStyle = "rgba(180,140,170,.45)";
      ctx.fillRect(r.x, r.y + r.h - 2, r.w, 4);
    }
  }

  function draw(now: number): void {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const pane of panes) drawPane(g, pane, now / 1000);
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (running && !paused && !finished) step(dt);
    draw(now);
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
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
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
    makeTargets: () => buildLevel(ctx.level).targets,
    blocks: def.blocks,
    sfx: ctx.sfx,
    pauseNote: def.hint,
    onFinish: (panes, reason) => {
      const p = panes[0];
      const stat = {
        shots: p.shots,
        hits: p.hits,
        remaining: p.targets.filter((t) => t.alive && t.kind !== "friend").length,
        friendHits: p.friendHits,
        orderMistakes: p.orderMistakes,
      };
      if (reason === "cleared") {
        ctx.win(starsForRound(stat), roundMessage(stat));
      } else {
        ctx.lose(
          reason === "timeup"
            ? `时间到,还剩 ${stat.remaining} 个靶。下次先挑好打的开手,连击起来就快了。`
            : `子弹用完啦,还剩 ${stat.remaining} 个靶。瞄准多花半秒,能省下好几发。`
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
// 无尽靶潮
// ---------------------------------------------------------------------------

function mountTide(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sr-topbar");
  const back = el("button", "sr-back", "← 返回");
  back.type = "button";
  const title = el("div", "sr-title", "♾️ 无尽靶潮");
  bar.append(back, title);
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let field: FieldHandle | null = null;
  let wave = 1;

  function start(): void {
    field?.destroy();
    stage.innerHTML = "";
    wave = 1;
    const first = tideWave(1);
    field = createField({
      host: stage,
      players: 1,
      tint: "#FFE9F2",
      hint: "一波接一波,清完就续下一波。漏掉的时间不会还给你,稳一点更划算。",
      seconds: first.seconds,
      shotBudget: 0,
      magSize: 7,
      reloadTime: 1,
      makeTargets: () => buildTide(1, first.kinds, first.count, first.speed, first.friendChance),
      blocks: [],
      sfx: api.play,
      pauseNote: "靶潮会在这里等你,回来接着打。",
      nextWave: () => {
        wave++;
        const spec = tideWave(wave);
        return {
          targets: buildTide(wave, spec.kinds, spec.count, spec.speed, spec.friendChance),
          seconds: spec.seconds,
        };
      },
      onFinish: (panes) => {
        const p = panes[0];
        const acc = accuracy(p.hits, p.shots);
        const score = tideScore(p.cleared, wave, acc);
        const best = save.recordEndlessBest(meta.id, score);
        api.play(score >= best ? "win" : "oops");
        field?.veil(
          `第 ${wave} 波结束`,
          `清掉 ${p.cleared} 个靶,命中率 ${Math.round(acc * 100)}%,评级 ${accuracyGrade(acc)}。` +
            `本次 ${score} 分,历史最好 ${best} 分。`,
          [
            { label: "🔁 再来一轮", onClick: () => start() },
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
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人分屏对战
// ---------------------------------------------------------------------------

function mountDuel(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sr-topbar");
  const back = el("button", "sr-back", "← 返回");
  back.type = "button";
  const title = el("div", "sr-title", "👫 双人分屏 · 比命中率");
  bar.append(back, title);
  const stage = el("div");
  root.append(style, bar, stage);
  host.appendChild(root);

  let field: FieldHandle | null = null;
  let round = 1;

  function start(): void {
    field?.destroy();
    stage.innerHTML = "";
    field = createField({
      host: stage,
      players: 2,
      tint: "#F2ECFB",
      hint: "上半屏朵朵、下半屏星星,靶子一模一样。60 秒内比谁的命中率高。",
      seconds: 60,
      shotBudget: 0,
      magSize: 6,
      reloadTime: 1,
      makeTargets: () => buildDuelTargets(round).map((t) => ({ ...t })),
      blocks: [],
      sfx: api.play,
      pauseNote: "两个人的成绩都留着,喘口气再继续。",
      onFinish: (panes) => {
        const res = duelResult(
          { name: panes[0].name, hits: panes[0].hits, shots: panes[0].shots, friendHits: panes[0].friendHits },
          { name: panes[1].name, hits: panes[1].hits, shots: panes[1].shots, friendHits: panes[1].friendHits }
        );
        api.play(res.winner === -1 ? "pop" : "win");
        round++;
        field?.veil(res.winner === -1 ? "打成平手 🤝" : `${res.winner === 0 ? "朵朵" : "星星"}赢啦 🏆`, res.line, [
          { label: "🔁 换一批靶再来", onClick: () => start() },
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
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口:模式选择 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "sr-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const tideBtn = el("button", "sr-mode");
  tideBtn.type = "button";
  const duoBtn = el("button", "sr-mode sr-mode-duo", "👫 双人分屏对战");
  duoBtn.type = "button";
  bar.append(tideBtn, duoBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    tideBtn.textContent = best > 0 ? `♾️ 无尽靶潮 · 最好 ${best} 分` : "♾️ 无尽靶潮 · 来一轮!";
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

  tideBtn.addEventListener("click", () => openMode(mountTide));
  duoBtn.addEventListener("click", () => openMode(mountDuel));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "清完全部靶子就过关,命中率越高星星越多。好人靶碰一下就掉星。",
      grandMessage: "188 关靶场全部打通,你就是名副其实的星星神射手!",
      guideTitle: "靶场小攻略",
      guide: {
        gameId: meta.id,
        title: "靶场小攻略",
        general: [
          "先扫一眼全场,把「会跑的」和「站着不动的」分开:先打会跑的,站着的什么时候打都行。",
          "连击断了不心疼,乱开一发才是真亏——命中率是评星的大头。",
          "弹匣打空会自动换弹,与其被迫等,不如在打完一波的空当主动按换弹。",
          "移动靶在掉头的一瞬间几乎是静止的,那一下最好打。",
        ],
        entries: CHAPTERS.map((ch, ci) => {
          let from = 1;
          for (let i = 0; i < ci; i++) from += CHAPTERS[i].size;
          return {
            from,
            to: from + ch.size - 1,
            title: `${ch.emoji} ${ch.name}`,
            tips: [
              ch.desc,
              ci === 4
                ? "木板挡住的靶不是打不到,是要换个角度:靶子会动,等它露出来再打。"
                : ci === 5
                  ? "编号靶先在心里数一遍 1234,再动手,打错顺序只会白费一发。"
                  : ci === 6
                    ? "看到举小旗子的笑脸就把准星移开,它是好人靶。"
                    : "越往后靶子越小,准星停稳半秒再扣扳机比抢时间划算。",
            ],
          };
        }),
      },
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
