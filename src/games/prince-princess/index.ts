import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import type { GuideBook } from "../../ui/level188Contract";
import GUIDE from "./guide";
import {
  BOSSES,
  CHAPTERS,
  buildEndless,
  buildLevel,
  bossSlotOf,
  type LevelDef,
} from "./levels";
import {
  BOSS_H,
  BOSS_W,
  ENEMY_STATS,
  HERO_H,
  HERO_NAMES,
  HERO_W,
  SHOT_R,
  botInput,
  counterFor,
  createWorld,
  doorOpen,
  drainEvents,
  emptyInput,
  endlessScore,
  isPauseKey,
  isSwapKey,
  keyToAction,
  killRatio,
  metersOf,
  remainingForDoor,
  starsForRun,
  stepWorld,
  summarize,
  swapActive,
  winMessage,
  type Input,
  type InputName,
  type World,
  type WorldEvent,
} from "./logic";

// ---------------------------------------------------------------------------
// 配色:一章一套粉彩
// ---------------------------------------------------------------------------

interface Palette {
  sky0: string;
  sky1: string;
  far: string;
  ground: string;
  groundDark: string;
  deco: string;
}

const PALETTES: Palette[] = [
  { sky0: "#FFF1F7", sky1: "#FFE3EF", far: "#F8CFE0", ground: "#F0A9C2", groundDark: "#FBDCE7", deco: "#E37FA8" },
  { sky0: "#F1FBEA", sky1: "#E3F3DC", far: "#C8E3BC", ground: "#9FCE86", groundDark: "#DCEECF", deco: "#6FAA5C" },
  { sky0: "#EDF5FD", sky1: "#DDEBF9", far: "#BFD6EC", ground: "#8FB4D8", groundDark: "#D3E3F2", deco: "#5F8CBE" },
  { sky0: "#F7FBFF", sky1: "#EAF2FC", far: "#D2E4F5", ground: "#A9CBEB", groundDark: "#E0EDF9", deco: "#7FAFDA" },
  { sky0: "#FFF2E6", sky1: "#FFE0CE", far: "#F5C6A6", ground: "#EE9E6E", groundDark: "#FBD9C1", deco: "#D3703C" },
  { sky0: "#F2FAFE", sky1: "#E4F2FA", far: "#C9E4F2", ground: "#A2CFE6", groundDark: "#DCEEF7", deco: "#6EAFCE" },
  { sky0: "#F4F0FC", sky1: "#EBE4F7", far: "#D6CBEE", ground: "#AC98DC", groundDark: "#E1D8F2", deco: "#7C66B8" },
];

/** 两位主角的配色 */
const HERO_COLORS = [
  { cloak: "#6FA8E8", cloakDark: "#4B7FC0", skin: "#FFE0BE", hair: "#6B4A32", trim: "#FFD75E", name: "王子" },
  { cloak: "#F58BB6", cloakDark: "#D66593", skin: "#FFE4C6", hair: "#C97C3A", trim: "#FFF0A8", name: "公主" },
];

const ENEMY_FACE: Record<string, string> = {
  slime: "🟢",
  bat: "🦇",
  armor: "🛡️",
  ghost: "👻",
  turret: "🔮",
};

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.pp-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.pp-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.pp-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#7B4A72;
  box-shadow:0 2px 6px rgba(170,120,160,.22);white-space:nowrap;}
.pp-bar{position:relative;flex:1;min-width:110px;height:20px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(150,110,140,.25);}
.pp-bar-fill{height:100%;width:0%;border-radius:999px;transition:width .16s linear;
  background:linear-gradient(90deg,#F7A8C8,#9FD48C);}
.pp-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;color:#6B3A62;}
.pp-btn{border:none;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7B4A72;box-shadow:0 3px 0 rgba(170,120,160,.3);}
.pp-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,160,.3);}
.pp-btn:focus-visible,.pp-key:focus-visible,.pp-mode:focus-visible{outline:3px solid #5A2E52;outline-offset:2px;}
.pp-stagebox{position:relative;border-radius:16px;overflow:hidden;background:#FFF5FA;
  box-shadow:0 4px 12px rgba(170,130,160,.24);}
.pp-cv{display:block;width:100%;height:300px;}
.pp-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,248,252,.93);}
.pp-veil-title{font-size:20px;font-weight:900;color:#7B4A72;}
.pp-veil-sub{font-size:14px;font-weight:700;color:#96658C;line-height:1.6;max-width:330px;}
.pp-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.pp-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#E784AE,#C85E8C);box-shadow:0 4px 0 #A6486F;}
.pp-veil-btn.pp-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.pp-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #A6486F;}
.pp-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#7B4A72;box-shadow:0 3px 8px rgba(160,110,150,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.pp-toast.pp-on{opacity:1;}
.pp-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:52px;}
.pp-pads[data-players="2"]{--k:42px;}
.pp-pad{display:grid;grid-template-columns:repeat(4,var(--k));grid-auto-rows:var(--k);gap:4px;justify-content:center;}
.pp-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;color:#7B4A72;text-align:center;line-height:1.3;}
.pp-key{border:none;border-radius:14px;font-size:19px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#7B4A72;box-shadow:0 3px 0 rgba(170,120,160,.34);touch-action:none;padding:0;}
.pp-key:active,.pp-key.pp-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,160,.34);background:#FFE3F0;}
.pp-key-atk{background:#FFD9E6;color:#B3527C;}
.pp-key-swap{background:#DFF0FF;color:#3F72A8;}
.pp-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#96658C;line-height:1.5;}
.pp-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.pp-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#E784AE,#C85E8C);box-shadow:0 4px 0 #A6486F;}
.pp-mode.pp-mode-duo{background:linear-gradient(180deg,#9BC7F2,#6E9FD4);box-shadow:0 4px 0 #55799F;}
.pp-mode.pp-mode-off{background:linear-gradient(180deg,#D9CEDA,#BCAFBD);box-shadow:0 4px 0 #9C8E9D;}
.pp-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #A6486F;}
.pp-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.pp-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#7B4A72;}
@media (max-width:420px){
  .pp-cv{height:180px;}
  .pp-wrap[data-players="2"] .pp-cv{height:270px;}
  .pp-pads{--k:46px;margin-top:6px;}
  .pp-pads[data-players="2"]{--k:37px;}
  .pp-chip{font-size:12px;padding:3px 7px;}
  .pp-hud{gap:4px;margin-bottom:4px;}
  .pp-bar{min-width:78px;height:18px;}
  .pp-btn{padding:5px 9px;}
  .pp-lbl{display:none;}
  .pp-tip{font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .pp-pad-name{font-size:10px;}
}
@media (hover:none) and (max-width:420px){ .pp-pad-name{display:none;} }
@media (max-height:620px){
  .pp-cv{height:142px;}
  .pp-wrap[data-players="2"] .pp-cv{height:216px;}
  .pp-pads{--k:42px;margin-top:4px;}
  .pp-pads[data-players="2"]{--k:34px;}
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

function emoji(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number): void {
  g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, x, y);
}

// ---------------------------------------------------------------------------
// 场地
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  size: number;
}

interface FieldOpts {
  def: LevelDef;
  players: 1 | 2;
  sfx: (name: SoundName) => void;
  title: string;
  tip: string;
  showTimer: boolean;
  extraChip?: (w: World) => string;
  onEnd: (win: boolean, w: World) => void;
  onQuit?: () => void;
  ready?: boolean;
}

interface Field {
  destroy: () => void;
  world: World;
  swap: (def: LevelDef, keep: { hearts: number }) => void;
  showVeil: (
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ) => void;
  toast: (text: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<WorldEvent["kind"], SoundName>> = {
  jump: "jump",
  double: "jump",
  slash: "tap",
  shoot: "pop",
  hit: "pop",
  block: "tap",
  defeat: "coin",
  gem: "coin",
  hurt: "oops",
  guard: "meow",
  bossHit: "pop",
  bossDown: "win",
  slam: "oops",
  door: "coin",
  win: "win",
  lose: "oops",
};

const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], string>> = {
  defeat: "✨",
  gem: "💎",
  hurt: "💫",
  block: "🚫",
  bossHit: "💥",
  bossDown: "🎉",
  slam: "💨",
  double: "🪽",
};

function createField(host: HTMLElement, opts: FieldOpts): Field {
  let world = createWorld(opts.def, opts.players);
  let destroyed = false;
  let ended = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let readyT = opts.ready === false ? 0 : 1.6;
  let toastT = 0;
  const particles: Particle[] = [];
  const inputs: Input[] = [emptyInput(), emptyInput()];
  const sfxAt = new Map<SoundName, number>();

  const wrap = el("div", "pp-wrap");
  wrap.dataset.players = String(opts.players);
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  // ---- HUD ----
  const hud = el("div", "pp-hud");
  const hearts = el("span", "pp-chip");
  const bar = el("div", "pp-bar");
  const barFill = el("div", "pp-bar-fill");
  const barTxt = el("span", "pp-bar-txt");
  bar.append(barFill, barTxt);
  const gemChip = el("span", "pp-chip");
  const timerChip = el("span", "pp-chip");
  const extraChip = el("span", "pp-chip");
  const whoChip = el("span", "pp-chip");
  const pauseBtn = el("button", "pp-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="pp-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  hud.append(hearts, bar, gemChip);
  if (opts.showTimer) hud.appendChild(timerChip);
  if (opts.extraChip) hud.appendChild(extraChip);
  if (opts.players === 1) hud.appendChild(whoChip);
  hud.appendChild(pauseBtn);
  wrap.appendChild(hud);

  // ---- 画布 ----
  const box = el("div", "pp-stagebox");
  const canvas = el("canvas", "pp-cv");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:王子和公主正在闯关`);
  const toastEl = el("div", "pp-toast");
  box.append(canvas, toastEl);
  wrap.appendChild(box);

  // ---- 触屏按键 ----
  const pads = el("div", "pp-pads");
  pads.dataset.players = String(opts.players);
  const PAD_KEYS: Array<{ act: InputName; label: string; cls?: string; aria: string; col: number; row: number }> = [
    { act: "up", label: "⬆", aria: "跳", col: 2, row: 2 },
    { act: "atk", label: "⚔️", cls: "pp-key-atk", aria: "攻击", col: 4, row: 2 },
    { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
    { act: "down", label: "⬇", aria: "蹲下", col: 2, row: 3 },
    { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
  ];
  const padButtons: Array<{ btn: HTMLButtonElement; player: number; act: InputName }> = [];
  let swapBtn: HTMLButtonElement | null = null;
  for (let pi = 0; pi < opts.players; pi++) {
    const pad = el("div", "pp-pad");
    pad.appendChild(
      el(
        "div",
        "pp-pad-name",
        opts.players === 1
          ? "WASD / 方向键移动 · F 或 L 攻击 · Tab 换人"
          : pi === 0
            ? "王子 · W A S D · F 挥剑"
            : "公主 · ↑←↓→ · L 放星星"
      )
    );
    for (const k of PAD_KEYS) {
      const btn = el("button", `pp-key${k.cls ? ` ${k.cls}` : ""}`, k.label);
      btn.type = "button";
      btn.style.gridColumn = String(k.col);
      btn.style.gridRow = String(k.row);
      btn.setAttribute("aria-label", `${opts.players === 2 ? HERO_COLORS[pi].name : ""}${k.aria}`);
      pad.appendChild(btn);
      padButtons.push({ btn, player: pi, act: k.act });
    }
    if (opts.players === 1) {
      // 一个人玩:多一颗「换人」键,顶替键盘的 Tab
      const sw = el("button", "pp-key pp-key-swap", "🔁");
      sw.type = "button";
      sw.style.gridColumn = "4";
      sw.style.gridRow = "3";
      sw.setAttribute("aria-label", "换人(也可以按 Tab)");
      pad.appendChild(sw);
      swapBtn = sw;
    }
    pads.appendChild(pad);
  }
  wrap.appendChild(pads);

  const tip = el("div", "pp-tip", opts.tip);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ----
  function setKey(player: number, act: InputName, down: boolean): void {
    const slot = inputs[player];
    if (!slot) return;
    slot[act] = down;
  }

  function releaseAll(): void {
    for (const { btn, player, act } of padButtons) {
      btn.classList.remove("pp-down");
      setKey(player, act, false);
    }
    inputs[0] = emptyInput();
    inputs[1] = emptyInput();
  }

  for (const { btn, player, act } of padButtons) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("pp-down");
      setKey(opts.players === 1 ? world.active : player, act, true);
    });
    const up = (): void => {
      btn.classList.remove("pp-down");
      // 单人模式下换人可能发生在按住期间,两位都松一遍才不会卡键
      setKey(0, act, false);
      setKey(1, act, false);
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  function doSwap(): void {
    if (opts.players !== 1 || ended || destroyed) return;
    releaseAll();
    const next = swapActive(world);
    opts.sfx("tap");
    toast(`换 ${HERO_NAMES[world.heroes[next].kind]} 上场!`);
  }
  swapBtn?.addEventListener("click", doSwap);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (isSwapKey(e.code) && opts.players === 1) {
      e.preventDefault();
      doSwap();
      return;
    }
    const hit = keyToAction(e.code, opts.players, world.active);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.players, world.active);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, false);
    if (opts.players === 1) setKey(1 - hit.player, hit.action, false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerup", releaseAll);
  window.addEventListener("blur", releaseAll);

  // ---- 遮罩 ----
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    clearVeil();
    const v = el("div", "pp-veil");
    v.append(el("div", "pp-veil-title", title), el("div", "pp-veil-sub", sub));
    const row = el("div", "pp-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `pp-veil-btn${b.ghost ? " pp-ghost" : ""}`, b.label);
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
  }

  function togglePause(): void {
    if (ended || destroyed) return;
    paused = !paused;
    releaseAll();
    if (paused) {
      const buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }> = [
        { label: "▶ 继续", onClick: () => togglePause() },
      ];
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
    toastEl.classList.add("pp-on");
    toastT = 2.2;
  }

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
        if (particles.length > 42) particles.shift();
      }
      if (ev.kind === "guard") {
        toast(ev.text === "melee" ? "护甲变红了!换王子的剑" : "护甲变蓝了!换公主的星星");
      }
      if (ev.kind === "door") toast("城门开啦!快跑过去");
    }
  }

  // ---- 渲染 ----
  let pal = PALETTES[world.def.chapterIndex % PALETTES.length];

  function drawHero(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number, hi: number): void {
    const h = world.heroes[hi];
    const c = HERO_COLORS[hi % HERO_COLORS.length];
    const hh = HERO_H * scale;
    const hw = HERO_W * scale;
    const blink = world.invuln > 0 && Math.floor(world.invuln * 12) % 2 === 0;
    const headR = Math.max(4, hw * 0.4);
    const headCY = -hh + headR * 0.95;
    const bodyTop = headCY + headR * 0.72;

    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.translate(sx, sy);
    ctx.scale(h.facing, 1);

    // 披风 / 裙摆
    ctx.fillStyle = c.cloakDark;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.05, bodyTop);
    ctx.quadraticCurveTo(-hw * 0.95, -hh * 0.4, -hw * 0.5, -hh * 0.02);
    ctx.quadraticCurveTo(-hw * 0.2, -hh * 0.22, -hw * 0.05, bodyTop + hh * 0.1);
    ctx.closePath();
    ctx.fill();

    // 身体
    ctx.fillStyle = c.cloak;
    if (h.kind === "princess") {
      ctx.beginPath();
      ctx.moveTo(-hw * 0.22, bodyTop);
      ctx.lineTo(hw * 0.22, bodyTop);
      ctx.lineTo(hw * 0.44, -hh * 0.02);
      ctx.lineTo(-hw * 0.44, -hh * 0.02);
      ctx.closePath();
      ctx.fill();
    } else {
      roundRect(ctx, -hw * 0.32, bodyTop, hw * 0.64, -bodyTop - hh * 0.02, hw * 0.2);
      ctx.fill();
    }

    // 脑袋
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx.fill();
    // 头发
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(0, headCY - headR * 0.22, headR * 0.96, Math.PI * 1.05, Math.PI * 2.05);
    ctx.fill();
    // 王冠 / 头饰
    ctx.fillStyle = c.trim;
    ctx.beginPath();
    if (h.kind === "prince") {
      ctx.moveTo(-headR * 0.8, headCY - headR * 0.78);
      ctx.lineTo(-headR * 0.4, headCY - headR * 1.3);
      ctx.lineTo(0, headCY - headR * 0.82);
      ctx.lineTo(headR * 0.4, headCY - headR * 1.3);
      ctx.lineTo(headR * 0.8, headCY - headR * 0.78);
      ctx.closePath();
    } else {
      ctx.arc(headR * 0.55, headCY - headR * 0.72, headR * 0.3, 0, Math.PI * 2);
    }
    ctx.fill();
    // 眼睛与笑脸
    ctx.fillStyle = "#4A3020";
    ctx.beginPath();
    ctx.arc(headR * 0.34, headCY + headR * 0.06, Math.max(1.1, headR * 0.13), 0, Math.PI * 2);
    ctx.arc(-headR * 0.16, headCY + headR * 0.06, Math.max(1.1, headR * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#C87E7E";
    ctx.lineWidth = Math.max(1, headR * 0.13);
    ctx.beginPath();
    ctx.arc(headR * 0.1, headCY + headR * 0.3, headR * 0.22, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();

    // 手上的家伙:剑 / 魔杖
    const swing = h.attackT > 0;
    if (h.kind === "prince") {
      ctx.save();
      ctx.translate(hw * 0.34, -hh * 0.48);
      ctx.rotate(swing ? -0.75 : -0.15);
      ctx.fillStyle = "#DCE6F2";
      roundRect(ctx, 0, -hw * 0.09, hw * (swing ? 1.5 : 1.1), hw * 0.18, hw * 0.08);
      ctx.fill();
      ctx.fillStyle = c.trim;
      roundRect(ctx, -hw * 0.12, -hw * 0.16, hw * 0.16, hw * 0.32, hw * 0.06);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(hw * 0.36, -hh * 0.5);
      ctx.rotate(swing ? -0.6 : -0.2);
      ctx.strokeStyle = "#E8D4A8";
      ctx.lineWidth = Math.max(1.4, hw * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(hw * 0.7, -hw * 0.2);
      ctx.stroke();
      ctx.restore();
      if (swing) emoji(ctx, "⭐", hw * 1.1, -hh * 0.62, 14 * Math.max(0.7, scale));
    }
    ctx.restore();

    // 二段跳的小翅膀
    if (h.kind === "princess" && !h.onGround && h.airJumps === 0) {
      ctx.globalAlpha = 0.6;
      emoji(ctx, "🪽", sx - h.facing * hw * 0.7, sy - hh * 0.55, 13 * Math.max(0.7, scale));
      ctx.globalAlpha = 1;
    }

    // 单人模式给正在操作的那位加个小箭头
    if (opts.players === 1 && hi === world.active) {
      ctx.fillStyle = "#C85E8C";
      ctx.beginPath();
      ctx.moveTo(sx, sy - hh - 10 * scale);
      ctx.lineTo(sx - 7 * scale, sy - hh - 22 * scale);
      ctx.lineTo(sx + 7 * scale, sy - hh - 22 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  function render(): void {
    if (!g) return;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    const cssW = Math.max(240, canvas.clientWidth || 360);
    const cssH = Math.max(150, canvas.clientHeight || 260);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const def = world.def;
    const scale = Math.max(0.5, Math.min(1.1, cssW / 560));
    const viewW = cssW / scale;
    const groundY = cssH - Math.max(40, cssH * 0.2);
    const focus = world.heroes.reduce((s, h) => s + h.x, 0) / world.heroes.length;
    const camX = Math.max(0, Math.min(Math.max(0, def.len - viewW), focus - viewW / 2));
    const sx = (wx: number): number => (wx - camX) * scale;
    const sy = (wy: number): number => groundY + wy * scale;

    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, cssH);

    // 远景:一排软软的小塔
    g.globalAlpha = 0.4;
    g.fillStyle = pal.far;
    for (let i = 0; i < 14; i++) {
      const bx = ((i * 250 - camX * 0.3) % (viewW + 500)) - 200;
      const bh = 54 + ((i * 41) % 66);
      const bw = 62 + ((i * 19) % 40);
      roundRect(g, bx * scale, groundY - bh * scale, bw * scale, bh * scale, 10 * scale);
      g.fill();
      g.beginPath();
      g.moveTo(bx * scale, groundY - bh * scale);
      g.lineTo((bx + bw / 2) * scale, groundY - (bh + 26) * scale);
      g.lineTo((bx + bw) * scale, groundY - bh * scale);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;

    // 地面(断口留空)
    const segs: Array<[number, number]> = [];
    let cursor = 0;
    for (const gap of def.gaps) {
      segs.push([cursor, gap.x0]);
      cursor = gap.x1;
    }
    segs.push([cursor, def.len]);
    for (const [a, b] of segs) {
      const x0 = sx(a);
      const x1 = sx(b);
      if (x1 < -40 || x0 > cssW + 40) continue;
      g.fillStyle = pal.groundDark;
      g.fillRect(x0, groundY, x1 - x0, cssH - groundY);
      g.fillStyle = pal.ground;
      g.fillRect(x0, groundY, x1 - x0, 9 * scale);
      g.fillStyle = pal.deco;
      for (let d = Math.ceil(a / 92) * 92; d < b; d += 92) g.fillRect(sx(d), groundY + 15 * scale, 5 * scale, 5 * scale);
    }

    // 尖刺
    g.fillStyle = "#B85C55";
    for (const s of world.spikes) {
      const x0 = sx(s.x);
      const x1 = sx(s.x + s.w);
      if (x1 < -20 || x0 > cssW + 20) continue;
      const teeth = Math.max(2, Math.round(s.w / 16));
      for (let i = 0; i < teeth; i++) {
        const tx = x0 + ((x1 - x0) * i) / teeth;
        const tw = (x1 - x0) / teeth;
        g.beginPath();
        g.moveTo(tx, groundY);
        g.lineTo(tx + tw / 2, groundY - 16 * scale);
        g.lineTo(tx + tw, groundY);
        g.closePath();
        g.fill();
      }
    }

    // 平台
    for (const pl of world.platforms) {
      const x0 = sx(pl.x);
      if (x0 > cssW + 40 || x0 + pl.w * scale < -40) continue;
      g.fillStyle = pl.moving ? "#F3D9E6" : "#FBEAD5";
      roundRect(g, x0, sy(pl.y), pl.w * scale, 13 * scale, 6 * scale);
      g.fill();
      g.fillStyle = pal.deco;
      g.fillRect(x0, sy(pl.y), pl.w * scale, 3.5 * scale);
    }

    // 城门
    const gx = sx(def.goalX);
    if (gx > -70 && gx < cssW + 70) {
      const open = doorOpen(world);
      g.fillStyle = open ? "#F6D77E" : "#C3AEC8";
      roundRect(g, gx - 26 * scale, groundY - 82 * scale, 52 * scale, 82 * scale, 22 * scale);
      g.fill();
      emoji(g, open ? "🚪" : "🔒", gx, groundY - 44 * scale, 26 * scale);
    }

    // 宝石
    for (const gem of world.gems) {
      if (gem.taken) continue;
      const x0 = sx(gem.x);
      if (x0 < -30 || x0 > cssW + 30) continue;
      const bob = Math.sin(world.time * 3 + gem.x * 0.02) * 3 * scale;
      emoji(g, "💎", x0, sy(gem.y) + bob, 18 * scale);
    }

    // 小怪
    for (const e of world.enemies) {
      const x0 = sx(e.x);
      if (x0 < -50 || x0 > cssW + 50) continue;
      const stat = ENEMY_STATS[e.kind];
      if (!e.alive) {
        if (e.fade > 0) {
          g.globalAlpha = e.fade;
          emoji(g, "✨", x0, sy(e.y) - stat.h * 0.5 * scale, 20 * scale);
          g.globalAlpha = 1;
        }
        continue;
      }
      const cy = e.baseY < 0 ? sy(e.y) : sy(e.y) - stat.h * 0.5 * scale;
      if (e.hurtT > 0) {
        g.globalAlpha = 0.55;
      }
      emoji(g, ENEMY_FACE[e.kind] ?? "❓", x0, cy, stat.h * 1.1 * scale);
      g.globalAlpha = 1;
      // 只吃某一种攻击的怪,头顶挂一个小提示
      const counter = counterFor(e.kind);
      if (counter) {
        emoji(g, counter === "prince" ? "⚔️" : "⭐", x0, cy - stat.h * 0.78 * scale, 12 * scale);
      }
      // 血条
      if (e.hp < e.maxHp) {
        const bw = stat.w * scale;
        g.fillStyle = "#00000022";
        roundRect(g, x0 - bw / 2, cy - stat.h * 0.68 * scale, bw, 4 * scale, 2 * scale);
        g.fill();
        g.fillStyle = "#7BC96F";
        roundRect(g, x0 - bw / 2, cy - stat.h * 0.68 * scale, (bw * e.hp) / e.maxHp, 4 * scale, 2 * scale);
        g.fill();
      }
    }

    // 首领
    const boss = world.boss;
    if (boss && boss.alive) {
      const info = BOSSES[boss.kind % BOSSES.length];
      const bx = sx(boss.x);
      const by = sy(boss.y);
      const guardColor = boss.guard === "melee" ? "#E4635F" : "#5B8FD6";
      g.fillStyle = guardColor;
      g.globalAlpha = boss.hurtT > 0 ? 0.45 : 0.28;
      roundRect(g, bx - (BOSS_W / 2 + 8) * scale, by - (BOSS_H + 10) * scale, (BOSS_W + 16) * scale, (BOSS_H + 12) * scale, 20 * scale);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = info.color;
      roundRect(g, bx - (BOSS_W / 2) * scale, by - BOSS_H * scale, BOSS_W * scale, BOSS_H * scale, 22 * scale);
      g.fill();
      emoji(g, info.emoji, bx, by - BOSS_H * 0.52 * scale, BOSS_H * 0.6 * scale);
      // 护甲提示
      emoji(g, boss.guard === "melee" ? "⚔️" : "⭐", bx, by - (BOSS_H + 22) * scale, 20 * scale);
    }

    // 弹幕
    for (const s of world.shots) {
      if (!s.alive) continue;
      const x0 = sx(s.x);
      if (x0 < -20 || x0 > cssW + 20) continue;
      emoji(g, s.friendly ? "⭐" : "🔴", x0, sy(s.y), SHOT_R * 2 * scale);
    }

    // 主角
    for (let i = 0; i < world.heroes.length; i++) {
      const h = world.heroes[i];
      drawHero(g, sx(h.x), sy(h.y), scale, i);
    }

    // 特效
    for (const p of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      emoji(g, p.text, sx(p.x), sy(p.y), p.size * scale);
    }
    g.globalAlpha = 1;

    // 开场横幅
    if (readyT > 0) {
      g.fillStyle = "rgba(255,248,252,.86)";
      g.fillRect(0, cssH * 0.3, cssW, cssH * 0.4);
      g.fillStyle = "#7B4A72";
      g.font = `900 ${Math.round(20 * Math.max(0.8, scale))}px "PingFang SC",system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(def.name, cssW / 2, cssH * 0.44);
      g.font = `700 ${Math.round(13 * Math.max(0.8, scale))}px "PingFang SC",system-ui,sans-serif`;
      g.fillText(def.feature, cssW / 2, cssH * 0.58);
    }

    // 首领血条画在画布顶上
    if (boss && boss.alive) {
      const info = BOSSES[boss.kind % BOSSES.length];
      const w = cssW * 0.62;
      const x0 = (cssW - w) / 2;
      g.fillStyle = "#ffffffcc";
      roundRect(g, x0, 8, w, 16, 8);
      g.fill();
      g.fillStyle = boss.guard === "melee" ? "#E4635F" : "#5B8FD6";
      roundRect(g, x0, 8, (w * boss.hp) / boss.maxHp, 16, 8);
      g.fill();
      g.fillStyle = "#5A2E52";
      g.font = `900 11px "PingFang SC",system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(`${info.emoji} ${info.name} · ${boss.guard === "melee" ? "只吃剑" : "只吃星星"}`, cssW / 2, 16);
    }
  }

  function updateHud(): void {
    const def = world.def;
    hearts.textContent = `${"❤️".repeat(Math.max(0, world.hearts))}${world.hearts <= 0 ? "💔" : ""}`;
    hearts.setAttribute("aria-label", `两人共有 ${Math.max(0, world.hearts)} 颗心`);
    if (world.boss) {
      const pct = world.boss.alive ? Math.round((world.boss.hp / world.boss.maxHp) * 100) : 0;
      barFill.style.width = `${100 - pct}%`;
      barTxt.textContent = world.boss.alive ? `首领 ${pct}%` : "首领倒下!";
    } else {
      const pct = Math.round(killRatio(world) * 100);
      barFill.style.width = `${pct}%`;
      const left = remainingForDoor(world);
      barTxt.textContent = left > 0 ? `还差 ${left} 只开门` : `城门已开 ${pct}%`;
    }
    gemChip.textContent = `💎 ${world.gemsTaken}/${def.gemGoal}`;
    if (opts.showTimer) {
      timerChip.textContent =
        def.timeLimit > 0
          ? `⏱ ${Math.max(0, Math.ceil(def.timeLimit - world.time))}s`
          : `⏱ ${Math.round(world.time)}s`;
    }
    if (opts.extraChip) extraChip.textContent = opts.extraChip(world);
    if (opts.players === 1) {
      const who = world.heroes[world.active];
      whoChip.textContent = `${who.kind === "prince" ? "🤴" : "👸"} ${HERO_NAMES[who.kind]}`;
    }
  }

  function frame(now: number): void {
    if (destroyed) return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;

    if (!paused && !ended) {
      if (readyT > 0) {
        readyT = Math.max(0, readyT - dt);
      } else {
        // 单人模式:没被操作的那位交给小伙伴 AI 托管
        const feed: Input[] = world.heroes.map((_, i) => {
          if (opts.players === 2 || i === world.active) return inputs[i] ?? emptyInput();
          return botInput(world, i, dt);
        });
        stepWorld(world, dt, feed);
      }
      consumeEvents(now);
      for (const p of particles) {
        p.life -= dt;
        p.y += p.vy * dt;
      }
      while (particles.length > 0 && particles[0].life <= 0) particles.shift();
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) toastEl.classList.remove("pp-on");
      }
    }

    updateHud();
    render();

    if (!ended && world.status !== "playing") {
      ended = true;
      opts.onEnd(world.status === "won", world);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    get world() {
      return world;
    },
    swap(def, keep) {
      world = createWorld(def, opts.players);
      world.hearts = Math.max(1, Math.min(def.hearts, keep.hearts));
      pal = PALETTES[def.chapterIndex % PALETTES.length];
      ended = false;
      readyT = 1.2;
      particles.length = 0;
      releaseAll();
      clearVeil();
    },
    showVeil,
    toast,
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("blur", releaseAll);
      clearVeil();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 玩家人数:整局记住,回地图再进来还是上次那个模式
// ---------------------------------------------------------------------------

let preferredPlayers: 1 | 2 = 1;

/** 单人时给的开场提示;双人时提示两套键位 */
export function tipFor(def: LevelDef, players: 1 | 2): string {
  if (players === 2) return `${def.hint} 王子 WASD+F,公主 方向键+L。`;
  return `${def.hint} 按 Tab 或点 🔁 换人,另一位会自己跟上来帮忙。`;
}

// ---------------------------------------------------------------------------
// 闯关模式
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = buildLevel(ctx.level);
  const field = createField(stage, {
    def,
    players: preferredPlayers,
    sfx: ctx.sfx,
    title: def.name,
    tip: tipFor(def, preferredPlayers),
    showTimer: true,
    onEnd: (win, w) => {
      const summary = summarize(w);
      if (win) ctx.win(starsForRun(def, summary), winMessage(def, summary));
      else ctx.lose(w.message || "再来一次!这回先想好谁打哪一只。");
    },
  });
  return { destroy: () => field.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式:王国远征
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pp-head");
  const back = el("button", "pp-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "pp-head-title", "♾️ 王国远征");
  const bestChip = el("span", "pp-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let round = 0;
  let scoreBase = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = best > 0 ? `🏅 最好 ${best} 分` : "🏅 还没有纪录";

  const liveScore = (w: World): number =>
    scoreBase + endlessScore(w.kills, w.gemsTaken, metersOf(Math.max(...w.heroes.map((h) => h.x))));

  let field: Field | null = null;

  function startRound(def: LevelDef, hearts: number): void {
    field?.destroy();
    field = createField(fieldHost, {
      def,
      players: preferredPlayers,
      sfx: (n) => api.play(n),
      title: def.name,
      tip: "一路向前!打倒的怪越多、宝石捡得越多,分数越高。",
      showTimer: false,
      extraChip: (w) => `🏆 ${liveScore(w)} 分`,
      onQuit: onExit,
      onEnd: (win, w) => {
        if (win) {
          scoreBase = liveScore(w);
          round++;
          const hp = Math.min(def.hearts, w.hearts + (w.def.boss ? 2 : 1));
          const next = buildEndless(round);
          field?.swap(next, { hearts: hp });
          field?.toast(
            w.def.boss ? `首领倒下!补两颗心,继续远征!` : `第 ${round} 段走完啦!补一颗心,继续!`
          );
          api.play("win");
          return;
        }
        finish(liveScore(w), w);
      },
    });
  }

  function finish(score: number, w: World): void {
    const record = score > best;
    if (record) best = save.recordEndlessBest(meta.id, score);
    bestChip.textContent = `🏅 最好 ${best} 分`;
    const bonus = Math.min(6, Math.floor(score / 130));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    const why = w.message || "心用完啦,这趟远征先到这儿。";
    field?.showVeil(
      record ? `新纪录 ${score} 分!` : `这趟走了 ${round} 段 · ${score} 分`,
      `${why}${record ? "这已经是你们走得最远的一趟了!" : `最好成绩 ${best} 分,再来一趟就能追上它。`}${
        bonus > 0 ? `送你们 ${bonus} 颗小星星。` : ""
      }`,
      [
        {
          label: "🔁 再走一趟",
          onClick: () => {
            round = 0;
            scoreBase = 0;
            startRound(buildEndless(0), 6);
          },
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  startRound(buildEndless(0), 6);

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 攻略
// ---------------------------------------------------------------------------

// 攻略正文统一放在 ./guide.ts,关卡里翻到的和攻略抽屉里翻到的是同一份。
function buildGuide(): GuideBook {
  return GUIDE;
}

// ---------------------------------------------------------------------------
// 入口:模式选择 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "pp-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const soloBtn = el("button", "pp-mode");
  soloBtn.type = "button";
  const duoBtn = el("button", "pp-mode pp-mode-duo");
  duoBtn.type = "button";
  const endlessBtn = el("button", "pp-mode pp-mode-duo");
  endlessBtn.type = "button";
  endlessBtn.style.background = "linear-gradient(180deg,#F0B45E,#D68F35)";
  endlessBtn.style.boxShadow = "0 4px 0 #B0722A";
  bar.append(soloBtn, duoBtn, endlessBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    soloBtn.textContent = "🧍 一个人玩(Tab 换人)";
    duoBtn.textContent = "👫 两人一起";
    soloBtn.className = `pp-mode${preferredPlayers === 1 ? "" : " pp-mode-off"}`;
    duoBtn.className = `pp-mode pp-mode-duo${preferredPlayers === 2 ? "" : " pp-mode-off"}`;
    soloBtn.setAttribute("aria-pressed", preferredPlayers === 1 ? "true" : "false");
    duoBtn.setAttribute("aria-pressed", preferredPlayers === 2 ? "true" : "false");
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 王国远征 · 最好 ${best} 分` : "♾️ 王国远征 · 来一趟!";
  }

  function setPlayers(n: 1 | 2): void {
    preferredPlayers = n;
    api.play("tap");
    refreshBar();
  }

  function closeMode(): void {
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  soloBtn.addEventListener("click", () => setPlayers(1));
  duoBtn.addEventListener("click", () => setPlayers(2));
  endlessBtn.addEventListener("click", () => {
    if (current) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    current = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "清怪、用时、宝石三样都做到就是三颗星!每章中间和结尾各有一场首领战。",
      grandMessage: "188 关全部通关,王子和公主一起坐上了王座,你就是王国的小英雄!",
      guide: buildGuide(),
      guideTitle: "冒险小攻略",
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

/** 给测试与攻略用:某一关是不是首领关 */
export function isBossLevel(level: number): boolean {
  return bossSlotOf(level) !== null;
}
