import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import {
  ARENA_H,
  ARENA_W,
  CEILING_Y,
  CHAPTERS,
  FLOOR_H,
  FLOOR_Y,
  VERSUS_ROUND_TARGET,
  WALL,
  buildLevel,
  buildVersusArena,
  buildWave,
  type ArenaDef,
} from "./arena";
import {
  BOT_LEVELS,
  BOT_PROFILES,
  BUBBLE_R,
  MONSTER_H,
  MONSTER_W,
  PLAYER_H,
  PLAYER_W,
  ROUNDS_TO_WIN,
  applyRound,
  comboBonus,
  createWorld,
  drainEvents,
  emptyInput,
  endlessScore,
  isMatchOver,
  isPauseKey,
  keyToAction,
  matchWinner,
  newMatch,
  scoreLine,
  starsForRun,
  stepWorld,
  summarize,
  versusBotInput,
  winMessage,
  type BotLevel,
  type Input,
  type InputName,
  type MatchState,
  type World,
  type WorldEvent,
} from "./logic";

// ---------------------------------------------------------------------------
// 配色:一章一套粉彩,统一走「泡泡糖 + 奶油色」的干净路子
// ---------------------------------------------------------------------------

interface Palette {
  sky0: string;
  sky1: string;
  far: string;
  /** 地板 / 浮台的表层色 */
  deck: string;
  /** 地板主体(一律很浅的粉彩,不要大片深色) */
  deckSoft: string;
  deco: string;
}

const PALETTES: Palette[] = [
  { sky0: "#EAF6FF", sky1: "#FDF2FA", far: "#CFE6F7", deck: "#8FC3E8", deckSoft: "#DCEEFB", deco: "#63A9DA" },
  { sky0: "#F1FBE8", sky1: "#FBFFF2", far: "#D3EDBE", deck: "#9AD07C", deckSoft: "#E3F5D5", deco: "#6FB552" },
  { sky0: "#EFF3FE", sky1: "#FAFBFF", far: "#D5DDF4", deck: "#A5B4E4", deckSoft: "#E4E9FA", deco: "#7C8DD1" },
  { sky0: "#E8F7F8", sky1: "#F6FEFF", far: "#C4E7EB", deck: "#7FC9D2", deckSoft: "#D8F1F4", deco: "#4FADB9" },
  { sky0: "#FFF0F6", sky1: "#FFF9FB", far: "#FAD3E3", deck: "#F3A5C4", deckSoft: "#FCE0EC", deco: "#E27CA5" },
  { sky0: "#FFF8E6", sky1: "#FFFDF4", far: "#F7E4AF", deck: "#F2C75E", deckSoft: "#FBEDC6", deco: "#DCA82E" },
  { sky0: "#F5EEFF", sky1: "#FCF8FF", far: "#DFCFF6", deck: "#B79AE6", deckSoft: "#EADFFA", deco: "#8E6BD0" },
  { sky0: "#FFF1E8", sky1: "#FFF9F4", far: "#FAD6BE", deck: "#F0A87C", deckSoft: "#FBE2D0", deco: "#D4814F" },
];

/** 两位噗噗兄弟的配色:朵朵粉,星星蓝 */
const BROS = [
  { body: "#FF9EC4", dark: "#E2749F", belly: "#FFE3EE", eye: "#5A3350", name: "朵朵" },
  { body: "#8FBEF5", dark: "#6693CE", belly: "#E1EDFC", eye: "#2F4A73", name: "星星" },
];

/** 三种咕噜怪的配色 */
const GOO = {
  walker: { body: "#7ED8C3", dark: "#4FB6A0", face: "#2F6D60", label: "咕噜怪" },
  hopper: { body: "#FFD36E", dark: "#E0AE3C", face: "#7A5410", label: "蹦蹦怪" },
  chaser: { body: "#FF9A8B", dark: "#DE6E5E", face: "#7C3225", label: "追追怪" },
};

const CANDY_ART = ["🍬", "🍭", "🧁", "🍡"];

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.pb-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.pb-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.pb-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#3F5C77;
  box-shadow:0 2px 6px rgba(110,140,175,.24);white-space:nowrap;}
.pb-chip-a{background:#FFE4EF;color:#A33C6C;}
.pb-chip-b{background:#DEEBFC;color:#2F5A8C;}
.pb-bar{position:relative;flex:1;min-width:104px;height:20px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(100,130,165,.28);}
.pb-bar-fill{height:100%;width:0%;border-radius:999px;transition:width .16s linear;
  background:linear-gradient(90deg,#9BD9F5,#F7A8CC);}
.pb-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;color:#33526E;}
.pb-btn{border:none;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#3F5C77;box-shadow:0 3px 0 rgba(110,140,175,.32);}
.pb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,175,.32);}
.pb-btn:focus-visible,.pb-key:focus-visible,.pb-mode:focus-visible,.pb-veil-btn:focus-visible,
.pb-pick:focus-visible{outline:3px solid #274766;outline-offset:2px;}
.pb-stagebox{position:relative;border-radius:16px;overflow:hidden;background:#EEF7FF;
  box-shadow:0 4px 12px rgba(110,140,175,.26);}
.pb-cv{display:block;width:100%;height:320px;}
.pb-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(246,252,255,.94);}
.pb-veil-title{font-size:20px;font-weight:900;color:#2F5A8C;}
.pb-veil-sub{font-size:14px;font-weight:700;color:#4E7295;line-height:1.6;max-width:340px;}
.pb-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.pb-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F79BB8,#DE6E97);box-shadow:0 4px 0 #B95278;}
.pb-veil-btn.pb-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.pb-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #B95278;}
.pb-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#2F5A8C;box-shadow:0 3px 8px rgba(110,140,175,.3);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:90%;text-align:center;}
.pb-toast.pb-on{opacity:1;}
.pb-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:52px;}
.pb-pads[data-pads="2"]{--k:40px;}
.pb-pad{display:grid;grid-template-columns:repeat(4,var(--k));grid-auto-rows:var(--k);gap:4px;
  justify-content:center;}
.pb-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;color:#3F5C77;text-align:center;line-height:1.3;}
.pb-key{border:none;border-radius:14px;font-size:19px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#3F5C77;box-shadow:0 3px 0 rgba(110,140,175,.34);touch-action:none;padding:0;}
.pb-key:active,.pb-key.pb-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,175,.34);
  background:#DCEEFB;}
.pb-key-act{background:#FFE0EC;color:#A33C6C;}
.pb-key-sub{background:#E2F3E0;color:#3B7A46;}
.pb-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#5B7C9C;line-height:1.5;}
.pb-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.pb-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#7FC4E8,#5AA0CB);box-shadow:0 4px 0 #46809F;}
.pb-mode.pb-mode-duel{background:linear-gradient(180deg,#F79BB8,#DE6E97);box-shadow:0 4px 0 #B95278;}
.pb-mode.pb-mode-bot{background:linear-gradient(180deg,#B79AE6,#9375CD);box-shadow:0 4px 0 #7256A6;}
.pb-mode.pb-mode-coop{background:linear-gradient(180deg,#9AD07C,#78B45B);box-shadow:0 4px 0 #5E9146;}
.pb-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #46809F;}
.pb-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.pb-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#2F5A8C;}
.pb-picker{display:flex;flex-direction:column;gap:10px;align-items:center;padding:14px 10px;}
.pb-picker-title{font-size:17px;font-weight:900;color:#2F5A8C;}
.pb-picks{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.pb-pick{border:none;border-radius:18px;padding:12px 16px;min-width:132px;cursor:pointer;font-family:inherit;
  background:#ffffffee;box-shadow:0 4px 0 rgba(110,140,175,.3);text-align:center;}
.pb-pick:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(110,140,175,.3);}
.pb-pick-name{font-size:16px;font-weight:900;color:#2F5A8C;}
.pb-pick-sub{margin-top:4px;font-size:12px;font-weight:700;color:#5B7C9C;line-height:1.4;}
@media (max-width:420px){
  .pb-cv{height:210px;}
  .pb-wrap[data-pads="2"] .pb-cv{height:186px;}
  .pb-pads{--k:46px;margin-top:6px;}
  .pb-pads[data-pads="2"]{--k:36px;}
  .pb-chip{font-size:12px;padding:3px 7px;}
  .pb-hud{gap:4px;margin-bottom:4px;}
  .pb-bar{min-width:74px;height:18px;}
  .pb-btn{padding:5px 9px;}
  .pb-lbl{display:none;}
  .pb-tip{font-size:11px;margin-top:4px;}
  .pb-pad-name{font-size:10px;}
}
/* 触屏设备用不上键盘提示,省下的高度留给画面 */
@media (hover:none) and (max-width:420px){ .pb-pad-name{display:none;} }
@media (max-height:620px){
  .pb-cv{height:170px;}
  .pb-wrap[data-pads="2"] .pb-cv{height:158px;}
  .pb-pads{--k:42px;margin-top:4px;}
  .pb-pads[data-pads="2"]{--k:34px;}
  .pb-tip{margin-top:4px;font-size:11px;}
}
@media (prefers-reduced-motion:reduce){ .pb-toast{transition:none;} }
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

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

function emojiAt(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number): void {
  g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, x, y);
}

// ---------------------------------------------------------------------------
// 场地:一块画布 + 一套操作 + 一个世界
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  size: number;
}

interface VeilButton {
  label: string;
  ghost?: boolean;
  onClick: () => void;
}

interface FieldOpts {
  def: ArenaDef;
  /** 场上有几个角色 */
  players: 1 | 2;
  /** 其中几个是真人(剩下的交给人机) */
  humans: 1 | 2;
  /** 人机档位(humans < players 时才用得上) */
  botLevel?: BotLevel;
  sfx: (name: SoundName) => void;
  title: string;
  tip: string;
  showTimer: boolean;
  extraChip?: (w: World) => string;
  onEnd: (w: World) => void;
  onQuit?: () => void;
}

interface Field {
  destroy: () => void;
  world: () => World;
  /** 换一张图接着玩(无尽 / 对战下一局用) */
  swap: (def: ArenaDef, keep?: { hearts?: number }) => void;
  showVeil: (title: string, sub: string, buttons: VeilButton[]) => void;
  toast: (text: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<WorldEvent["kind"], SoundName>> = {
  jump: "jump",
  blow: "pop",
  catch: "coin",
  pop: "pop",
  burst: "oops",
  candy: "coin",
  hurt: "oops",
  escape: "tap",
  combo: "meow",
  win: "win",
  lose: "oops",
};

const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], string>> = {
  catch: "🫧",
  pop: "✨",
  burst: "💨",
  candy: "🍬",
  hurt: "💫",
  escape: "😵",
  combo: "🌟",
};

const PAD_KEYS: Array<{ act: InputName; label: string; cls?: string; aria: string; col: number; row: number }> = [
  { act: "up", label: "⬆", aria: "跳", col: 2, row: 2 },
  { act: "act", label: "💨", cls: "pb-key-act", aria: "吹泡泡糖气流", col: 4, row: 2 },
  { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
  { act: "down", label: "⬇", aria: "蹲下(配合跳可以穿过浮台)", col: 2, row: 3 },
  { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
  { act: "sub", label: "👉", cls: "pb-key-sub", aria: "噗一下戳破泡泡", col: 4, row: 3 },
];

function createField(host: HTMLElement, opts: FieldOpts): Field {
  let world = createWorld(opts.def, { players: opts.players });
  let destroyed = false;
  let ended = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let toastT = 0;
  const particles: Particle[] = [];
  const inputs: Input[] = [emptyInput(), emptyInput()];
  const sfxAt = new Map<SoundName, number>();
  const padCount = opts.humans;

  const wrap = el("div", "pb-wrap");
  wrap.dataset.pads = String(padCount);
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  // ---- HUD ----
  const hud = el("div", "pb-hud");
  const leftChip = el("span", "pb-chip");
  const bar = el("div", "pb-bar");
  const barFill = el("div", "pb-bar-fill");
  const barTxt = el("span", "pb-bar-txt");
  bar.append(barFill, barTxt);
  const rightChip = el("span", "pb-chip");
  const timerChip = el("span", "pb-chip");
  const extraChip = el("span", "pb-chip");
  const pauseBtn = el("button", "pb-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="pb-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  hud.append(leftChip, bar, rightChip);
  if (opts.showTimer) hud.appendChild(timerChip);
  if (opts.extraChip) hud.appendChild(extraChip);
  hud.appendChild(pauseBtn);
  wrap.appendChild(hud);

  // ---- 画布 ----
  const box = el("div", "pb-stagebox");
  const canvas = el("canvas", "pb-cv");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:噗噗兄弟正在吹泡泡糖气流`);
  const toastEl = el("div", "pb-toast");
  box.append(canvas, toastEl);
  wrap.appendChild(box);

  // ---- 触屏按键 ----
  const pads = el("div", "pb-pads");
  pads.dataset.pads = String(padCount);
  const padButtons: Array<{ btn: HTMLButtonElement; player: number; act: InputName }> = [];
  for (let pi = 0; pi < padCount; pi++) {
    const pad = el("div", "pb-pad");
    pad.appendChild(
      el(
        "div",
        "pb-pad-name",
        padCount === 1
          ? "WASD / 方向键移动 · F 或 L 吹气流 · G 或 K 噗一下"
          : pi === 0
            ? "朵朵 · W A S D · F 吹 · G 噗"
            : "星星 · ↑←↓→ · L 吹 · K 噗"
      )
    );
    for (const k of PAD_KEYS) {
      const btn = el("button", `pb-key${k.cls ? ` ${k.cls}` : ""}`, k.label);
      btn.type = "button";
      btn.style.gridColumn = String(k.col);
      btn.style.gridRow = String(k.row);
      btn.setAttribute("aria-label", `${padCount === 2 ? BROS[pi].name : ""}${k.aria}`);
      pad.appendChild(btn);
      padButtons.push({ btn, player: pi, act: k.act });
    }
    pads.appendChild(pad);
  }
  wrap.appendChild(pads);

  const tip = el("div", "pb-tip", opts.tip);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ----
  function setKey(player: number, act: InputName, down: boolean): void {
    const slot = inputs[player];
    if (!slot) return;
    slot[act] = down;
  }

  for (const { btn, player, act } of padButtons) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("pb-down");
      setKey(player, act, true);
    });
    const up = (): void => {
      btn.classList.remove("pb-down");
      setKey(player, act, false);
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  const releaseAll = (): void => {
    for (const { btn, player, act } of padButtons) {
      btn.classList.remove("pb-down");
      setKey(player, act, false);
    }
  };
  window.addEventListener("pointerup", releaseAll);
  window.addEventListener("blur", releaseAll);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(e.code, opts.players, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.players, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---- 遮罩(暂停 / 结算) ----
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(title: string, sub: string, buttons: VeilButton[]): void {
    clearVeil();
    const v = el("div", "pb-veil");
    v.append(el("div", "pb-veil-title", title), el("div", "pb-veil-sub", sub));
    const row = el("div", "pb-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `pb-veil-btn${b.ghost ? " pb-ghost" : ""}`, b.label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        opts.sfx("tap");
        b.onClick();
      });
      row.appendChild(btn);
    }
    v.appendChild(row);
    box.appendChild(v);
    veil = v;
    const first = v.querySelector("button");
    if (first instanceof HTMLElement) first.focus();
  }

  function togglePause(): void {
    if (ended || destroyed) return;
    paused = !paused;
    releaseAll();
    if (paused) {
      const buttons: VeilButton[] = [{ label: "▶ 继续", onClick: () => togglePause() }];
      if (opts.onQuit) buttons.push({ label: "🚪 退出", ghost: true, onClick: () => opts.onQuit?.() });
      showVeil("休息一下", "按 Esc 或点「继续」接着玩。", buttons);
    } else {
      clearVeil();
      lastTime = 0;
    }
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  function toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add("pb-on");
    toastT = 2.2;
  }

  // ---- 音效与特效 ----
  function playThrottled(name: SoundName, now: number): void {
    const last = sfxAt.get(name) ?? -1;
    if (now - last < 90) return;
    sfxAt.set(name, now);
    opts.sfx(name);
  }

  function consumeEvents(now: number): void {
    for (const ev of drainEvents(world)) {
      const sound = SFX_FOR_EVENT[ev.kind];
      if (sound) playThrottled(sound, now);
      const art = PARTICLE_FOR_EVENT[ev.kind];
      if (art) {
        particles.push({ x: ev.x, y: ev.y, vy: -34, life: 0.9, text: art, size: 18 });
        if (particles.length > 40) particles.shift();
      }
    }
  }

  // ---- 渲染 ----
  function drawBro(ctx: CanvasRenderingContext2D, p: World["players"][number], pi: number): void {
    const c = BROS[pi % BROS.length];
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    const w = PLAYER_W;
    const h = PLAYER_H;
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.translate(p.x, p.y);

    // 小脚
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(-w * 0.24, -2, w * 0.19, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.24, -2, w * 0.19, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 圆滚滚的身体
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.5, w * 0.52, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.4, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛与腮红
    ctx.fillStyle = c.eye;
    ctx.beginPath();
    ctx.arc(p.facing * 3 - 5, -h * 0.66, 2.6, 0, Math.PI * 2);
    ctx.arc(p.facing * 3 + 5, -h * 0.66, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(p.facing * 3 - 5.8, -h * 0.69, 0.9, 0, Math.PI * 2);
    ctx.arc(p.facing * 3 + 4.2, -h * 0.69, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,150,180,.55)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.32, -h * 0.5, 3.4, 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.32, -h * 0.5, 3.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 正在吹气流:嘴边鼓一个小泡
    if (p.blowCd > 0.24) {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(p.facing * (w * 0.55), -h * 0.5, 5 + (p.blowCd - 0.24) * 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = c.eye;
      ctx.beginPath();
      ctx.ellipse(p.facing * 3, -h * 0.46, 2.6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGoo(ctx: CanvasRenderingContext2D, m: World["monsters"][number]): void {
    const c = GOO[m.kind];
    const w = MONSTER_W;
    const h = MONSTER_H;
    ctx.save();
    ctx.translate(m.x, m.y);
    // 蹦蹦怪有一对弹簧脚
    if (m.kind === "hopper") {
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-5, -6);
      ctx.moveTo(5, 0);
      ctx.lineTo(5, -6);
      ctx.stroke();
    }
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.42, w * 0.5, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.48, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // 追追怪头上一对小角
    if (m.kind === "chaser") {
      ctx.fillStyle = c.dark;
      ctx.beginPath();
      ctx.moveTo(-7, -h * 0.82);
      ctx.lineTo(-3, -h * 1.06);
      ctx.lineTo(-1, -h * 0.8);
      ctx.moveTo(7, -h * 0.82);
      ctx.lineTo(3, -h * 1.06);
      ctx.lineTo(1, -h * 0.8);
      ctx.fill();
    }
    ctx.fillStyle = c.face;
    if (m.dizzy > 0) {
      ctx.font = "10px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("××", 0, -h * 0.5);
    } else {
      ctx.beginPath();
      ctx.arc(m.dir * 2 - 4, -h * 0.56, 2.2, 0, Math.PI * 2);
      ctx.arc(m.dir * 2 + 4, -h * 0.56, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.dir * 2, -h * 0.36, 2.6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBubble(ctx: CanvasRenderingContext2D, b: World["bubbles"][number]): void {
    const fade = b.popped ? Math.max(0, 1 + b.life / 0.35) : 1;
    if (fade <= 0) return;
    const r = BUBBLE_R * (b.popped ? 1 + (1 - fade) * 0.6 : 1);
    ctx.save();
    ctx.globalAlpha = fade;
    const grad = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, r * 0.2, b.x, b.y, r);
    grad.addColorStop(0, "rgba(255,255,255,.95)");
    grad.addColorStop(1, b.hold ? "rgba(255,196,224,.62)" : "rgba(178,226,250,.55)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.hold ? "rgba(226,116,159,.9)" : "rgba(120,180,220,.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.arc(b.x - r * 0.36, b.y - r * 0.4, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render(now: number): void {
    if (!g) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const pal = PALETTES[world.def.chapterIndex % PALETTES.length];
    const scale = Math.min(cw / ARENA_W, ch / ARENA_H);
    const offX = (cw - ARENA_W * scale) / 2;
    const offY = (ch - ARENA_H * scale) / 2;

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = pal.sky1;
    g.fillRect(0, 0, cw, ch);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    const sky = g.createLinearGradient(0, 0, 0, ARENA_H);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    g.fillStyle = sky;
    g.fillRect(0, 0, ARENA_W, ARENA_H);

    // 远景:几朵不动的糖云
    g.fillStyle = pal.far;
    g.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const cx = 60 + i * 130;
      const cy = 54 + ((i * 37) % 50);
      g.beginPath();
      g.ellipse(cx, cy, 42, 17, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // 天花板与左右墙
    g.fillStyle = pal.deckSoft;
    g.fillRect(0, 0, ARENA_W, CEILING_Y);
    g.fillRect(0, 0, WALL, ARENA_H);
    g.fillRect(ARENA_W - WALL, 0, WALL, ARENA_H);
    g.fillStyle = pal.deck;
    g.fillRect(0, CEILING_Y - 3, ARENA_W, 3);

    // 地板
    g.fillStyle = pal.deckSoft;
    g.fillRect(0, FLOOR_Y, ARENA_W, FLOOR_H);
    g.fillStyle = pal.deck;
    g.fillRect(0, FLOOR_Y, ARENA_W, 5);

    // 浮台
    for (const pl of world.def.platforms) {
      g.fillStyle = pal.deckSoft;
      roundRect(g, pl.x, pl.y, pl.w, 13, 6);
      g.fill();
      g.fillStyle = pal.deck;
      roundRect(g, pl.x, pl.y, pl.w, 5, 3);
      g.fill();
    }

    for (let i = 0; i < world.candies.length; i++) {
      const c = world.candies[i];
      if (c.taken) continue;
      emojiAt(g, CANDY_ART[i % CANDY_ART.length], c.x, c.y, 17);
    }

    for (const m of world.monsters) {
      if (m.state === "gone" || m.state === "bubbled") continue;
      drawGoo(g, m);
    }

    for (let i = 0; i < world.players.length; i++) {
      const p = world.players[i];
      if (p.respawnT > 0) continue;
      if (p.trapped) continue;
      drawBro(g, p, i);
    }

    // 泡泡最后画,裹着的东西画在里面
    for (const b of world.bubbles) {
      drawBubble(g, b);
      if (b.popped || !b.hold) continue;
      if (b.hold.kind === "monster") {
        const m = world.monsters[b.hold.id];
        if (m) drawGoo(g, m);
      } else {
        const p = world.players[b.hold.id];
        if (p) drawBro(g, p, b.hold.id);
      }
    }

    for (const pt of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, pt.life));
      emojiAt(g, pt.text, pt.x, pt.y, pt.size);
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function refreshHud(): void {
    if (world.rivalry) {
      leftChip.className = "pb-chip pb-chip-a";
      leftChip.textContent = `🌸 朵朵 ${world.players[0]?.pops ?? 0}`;
      rightChip.className = "pb-chip pb-chip-b";
      rightChip.textContent = `⭐ 星星 ${world.players[1]?.pops ?? 0}`;
      const target = Math.max(1, world.def.roundTarget);
      const lead = Math.max(world.players[0]?.pops ?? 0, world.players[1]?.pops ?? 0);
      barFill.style.width = `${Math.min(100, (lead / target) * 100)}%`;
      barTxt.textContent = `先到 ${target} 分赢下这一局`;
    } else {
      leftChip.className = "pb-chip";
      leftChip.textContent = `❤️ ${"♥".repeat(Math.max(0, world.hearts))}`;
      rightChip.className = "pb-chip";
      rightChip.textContent = `🍬 ${world.candiesTaken}`;
      const done = world.monsterTotal > 0 ? world.cleared / world.monsterTotal : 1;
      barFill.style.width = `${Math.round(done * 100)}%`;
      barTxt.textContent = `咕噜怪 ${world.cleared}/${world.monsterTotal}`;
    }
    if (opts.showTimer) {
      const left = world.def.timeLimit > 0 ? Math.max(0, world.def.timeLimit - world.time) : world.time;
      timerChip.textContent = `⏱ ${Math.ceil(left)}`;
    }
    if (opts.extraChip) extraChip.textContent = opts.extraChip(world);
  }

  function frame(ts: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = lastTime ? Math.min(0.05, (ts - lastTime) / 1000) : 0;
    lastTime = ts;
    if (!paused && !ended && dt > 0) {
      const list: Input[] = [];
      for (let i = 0; i < world.players.length; i++) {
        list.push(i < opts.humans ? inputs[i] : versusBotInput(world, i, opts.botLevel ?? "normal"));
      }
      stepWorld(world, dt, list);
      consumeEvents(ts);
      for (const pt of particles) {
        pt.y += pt.vy * dt;
        pt.life -= dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) toastEl.classList.remove("pb-on");
      }
      if (world.status !== "playing") {
        ended = true;
        releaseAll();
        opts.onEnd(world);
      }
    }
    refreshHud();
    render(ts);
  }

  refreshHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("blur", releaseAll);
      wrap.remove();
    },
    world: () => world,
    swap(def, keep) {
      world = createWorld(def, { players: opts.players, hearts: keep?.hearts });
      particles.length = 0;
      ended = false;
      paused = false;
      clearVeil();
      lastTime = 0;
      refreshHud();
    },
    showVeil,
    toast,
  };
}

// ---------------------------------------------------------------------------
// 188 关合作闯关
// ---------------------------------------------------------------------------

/** 闯关是一个人玩还是两个人一起玩(留在模块里,回地图再进来还记得) */
let coopPlayers: 1 | 2 = 1;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = buildLevel(ctx.level);
  const field = createField(stage, {
    def,
    players: coopPlayers,
    humans: coopPlayers,
    sfx: ctx.sfx,
    title: def.name,
    tip: def.hint,
    showTimer: true,
    onEnd: (w) => {
      const summary = summarize(w);
      if (summary.win) ctx.win(starsForRun(def, summary), winMessage(def, summary));
      else ctx.lose(w.message || "再来一次,先把离自己最近的那只裹起来!");
    },
  });
  return { destroy: () => field.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式:噗噗不停
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pb-head");
  const back = el("button", "pb-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "pb-head-title", "♾️ 噗噗不停");
  const bestChip = el("span", "pb-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let wave = 0;
  let scoreBase = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = best > 0 ? `🏅 最好 ${best} 分` : "🏅 还没有纪录";

  const liveScore = (w: World): number =>
    scoreBase + endlessScore(w.cleared, w.candiesTaken, 0) + comboBonus(w.players[0]?.combo ?? 0);

  let field: Field | null = null;

  function finish(score: number, w: World): void {
    const record = score > best;
    if (record) best = save.recordEndlessBest(meta.id, score);
    bestChip.textContent = `🏅 最好 ${best} 分`;
    const bonus = Math.min(6, Math.floor(score / 140));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    field?.showVeil(
      record ? `新纪录 ${score} 分!` : `这一趟拿了 ${score} 分`,
      `${w.message || "心用完啦,这趟噗噗不停先到这儿。"}${
        record ? "这已经是你清得最多的一趟了!" : `最好成绩 ${best} 分,再来一趟就能追上它。`
      }${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`,
      [
        {
          label: "🔁 再来一趟",
          onClick: () => {
            wave = 0;
            scoreBase = 0;
            field?.swap(buildWave(0), { hearts: 3 });
          },
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  field = createField(fieldHost, {
    def: buildWave(0),
    players: 1,
    humans: 1,
    sfx: (n) => api.play(n),
    title: "噗噗不停",
    tip: "一波接一波!清空这一波就进下一波,心用完才结束。",
    showTimer: false,
    extraChip: (w) => `🫧 ${liveScore(w)} 分`,
    onQuit: onExit,
    onEnd: (w) => {
      if (w.status === "won") {
        scoreBase = liveScore(w) + 40;
        wave++;
        const hp = Math.min(3, w.hearts + (wave % 3 === 0 ? 1 : 0));
        field?.swap(buildWave(wave), { hearts: hp });
        field?.toast(`第 ${wave} 波清空啦!${wave % 3 === 0 ? "补一颗心," : ""}继续!`);
        api.play("win");
        return;
      }
      finish(liveScore(w), w);
    },
  });

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:三局两胜(双人 / 人机三档)
// ---------------------------------------------------------------------------

function mountVersus(
  host: HTMLElement,
  api: GameApi,
  onExit: () => void,
  botLevel: BotLevel | null
): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pb-head");
  const back = el("button", "pb-btn", "🗺️ 回关卡");
  back.type = "button";
  const rivalName = botLevel ? BOT_PROFILES[botLevel].name : BROS[1].name;
  const title = el(
    "div",
    "pb-head-title",
    botLevel ? `🤖 人机对战 · ${rivalName}` : "⚔️ 双人对战 · 三局两胜"
  );
  const scoreChip = el("span", "pb-chip");
  head.append(back, title, scoreChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  const names: [string, string] = [BROS[0].name, rivalName];
  let match: MatchState = newMatch();
  let field: Field | null = null;
  let awarded = false;

  function refreshScore(): void {
    scoreChip.textContent = `🏆 ${scoreLine(match, names)}`;
  }

  function endMatch(): void {
    const winner = matchWinner(match);
    const champion = winner < 0 ? null : names[winner];
    if (!awarded) {
      awarded = true;
      // 人机对战里赢了才给星星,双人对战两个人都给一颗,别为了星星吵架
      const gain = botLevel ? (winner === 0 ? (botLevel === "hard" ? 3 : botLevel === "normal" ? 2 : 1) : 0) : 1;
      if (gain > 0) api.addStars(gain);
    }
    api.play(winner === 0 || !botLevel ? "win" : "oops");
    field?.showVeil(
      champion ? `${champion} 拿下这一场!` : "打成平手啦!",
      `最终 ${scoreLine(match, names)}。${
        champion === names[0] && botLevel
          ? `${rivalName} 也很努力,要不要换个更难的档位试试?`
          : "换个场地再来一场吧!"
      }`,
      [
        {
          label: "🔁 再来一场",
          onClick: () => {
            match = newMatch();
            awarded = false;
            refreshScore();
            field?.swap(buildVersusArena(0));
          },
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  function onRoundEnd(w: World): void {
    const points: [number, number] = [w.players[0]?.pops ?? 0, w.players[1]?.pops ?? 0];
    match = applyRound(match, w.roundWinner, points);
    refreshScore();
    if (isMatchOver(match)) {
      endMatch();
      return;
    }
    const who = w.roundWinner < 0 ? null : names[w.roundWinner];
    api.play(w.roundWinner === 0 || !botLevel ? "win" : "oops");
    field?.showVeil(
      who ? `${who} 赢下第 ${match.played} 局!` : `第 ${match.played} 局打平`,
      `${scoreLine(match, names)} · 先赢 ${ROUNDS_TO_WIN} 局拿下整场。`,
      [
        {
          label: `▶ 第 ${match.played + 1} 局`,
          onClick: () => field?.swap(buildVersusArena(match.played)),
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  field = createField(fieldHost, {
    def: buildVersusArena(0),
    players: 2,
    humans: botLevel ? 1 : 2,
    botLevel: botLevel ?? "normal",
    sfx: (n) => api.play(n),
    title: "噗噗擂台",
    tip: `把对手裹进泡泡里再噗一下就得 1 分,先拿 ${VERSUS_ROUND_TARGET} 分赢下这一局。被裹住了就猛按方向键挣扎!`,
    showTimer: true,
    onQuit: onExit,
    onEnd: onRoundEnd,
  });

  refreshScore();
  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

/** 人机对战之前先选档位 */
function mountBotPicker(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pb-head");
  const back = el("button", "pb-btn", "🗺️ 回关卡");
  back.type = "button";
  head.append(back, el("div", "pb-head-title", "🤖 人机对战 · 挑一个对手"));
  const picker = el("div", "pb-picker");
  picker.appendChild(el("div", "pb-picker-title", "想跟谁打三局两胜?"));
  const picks = el("div", "pb-picks");
  picker.appendChild(picks);
  picker.appendChild(
    el("div", "pb-tip", "你用 W A S D 移动、F 吹气流、G 噗一下;方向键那一套交给电脑。")
  );
  const stage = el("div");
  root.append(style, head, picker, stage);
  host.appendChild(root);

  let inner: { destroy: () => void } | null = null;

  for (const key of BOT_LEVELS) {
    const prof = BOT_PROFILES[key];
    const btn = el("button", "pb-pick");
    btn.type = "button";
    btn.append(
      el("div", "pb-pick-name", `${key === "easy" ? "🌱" : key === "normal" ? "🫧" : "👑"} ${prof.name}`),
      el("div", "pb-pick-sub", prof.blurb)
    );
    btn.addEventListener("click", () => {
      if (inner) return;
      api.play("tap");
      picker.hidden = true;
      inner = mountVersus(stage, api, onExit, key);
    });
    picks.appendChild(btn);
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      inner?.destroy();
      inner = null;
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
  const bar = el("div", "pb-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const coopBtn = el("button", "pb-mode pb-mode-coop");
  coopBtn.type = "button";
  const duelBtn = el("button", "pb-mode pb-mode-duel", "⚔️ 双人对战");
  duelBtn.type = "button";
  const botBtn = el("button", "pb-mode pb-mode-bot", "🤖 人机三档");
  botBtn.type = "button";
  const endlessBtn = el("button", "pb-mode");
  endlessBtn.type = "button";
  bar.append(coopBtn, duelBtn, botBtn, endlessBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 噗噗不停 · 最好 ${best} 分` : "♾️ 噗噗不停 · 来一趟!";
    coopBtn.textContent = coopPlayers === 1 ? "👤 闯关:一个人" : "👫 闯关:两个人";
    coopBtn.setAttribute("aria-label", `188 关闯关目前是${coopPlayers === 1 ? "一个人" : "两个人一起"}玩,点一下切换`);
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

  coopBtn.addEventListener("click", () => {
    api.play("tap");
    coopPlayers = coopPlayers === 1 ? 2 : 1;
    refreshBar();
  });
  duelBtn.addEventListener("click", () => openMode((h, a, x) => mountVersus(h, a, x, null)));
  botBtn.addEventListener("click", () => openMode(mountBotPicker));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "吹一口气流裹住咕噜怪,再噗一下把它变成糖果!用时、糖果、不丢心,三样都做到就是三颗星。",
      grandMessage: "188 关全部清空,噗噗兄弟就是泡泡糖工坊的大冠军!",
      guide: GUIDE,
      guideTitle: "噗噗小攻略",
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
