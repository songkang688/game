import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import { CHAPTERS, buildCoop, buildEndless, buildLevel, type LevelDef } from "./levels";
import {
  BEAM_BOTTOM,
  BEAM_TOP,
  CROUCH_H,
  JUNK_R,
  MONSTER_H,
  MONSTER_W,
  PLAYER_H,
  PLAYER_W,
  cleanRatio,
  createWorld,
  doorOpen,
  drainEvents,
  emptyInput,
  endlessScore,
  isPauseKey,
  keyToAction,
  metersOf,
  remainingForDoor,
  starsForRun,
  stepWorld,
  summarize,
  winMessage,
  type Input,
  type InputName,
  type World,
  type WorldEvent,
} from "./logic";

// ---------------------------------------------------------------------------
// 配色:一章一套粉彩,统一走「可爱棕 + 粉彩」的干净路子
// ---------------------------------------------------------------------------

interface Palette {
  sky0: string;
  sky1: string;
  far: string;
  /** 地面表层的一条彩色边 */
  ground: string;
  /** 地面主体(一律用很浅的粉彩,不要大片深色) */
  groundDark: string;
  deco: string;
}

const PALETTES: Palette[] = [
  { sky0: "#FFF3E8", sky1: "#FFE4EF", far: "#FBDCC9", ground: "#F6C79E", groundDark: "#FAEADB", deco: "#FFB9CE" },
  { sky0: "#E9F8FF", sky1: "#F1FCE7", far: "#CDEBC4", ground: "#A9D98F", groundDark: "#E9F6DC", deco: "#6FBF7A" },
  { sky0: "#E1EBF9", sky1: "#EEF4FC", far: "#C3D2E7", ground: "#9FB8D6", groundDark: "#E2EAF4", deco: "#7FA8D4" },
  { sky0: "#FCF3E0", sky1: "#F9EDD8", far: "#E4D3B4", ground: "#D8BE8C", groundDark: "#F4EBD8", deco: "#C9A46A" },
  { sky0: "#FFEAF3", sky1: "#FFF5E8", far: "#F8CFDF", ground: "#F0A9C2", groundDark: "#FCE4EC", deco: "#F07FAA" },
  { sky0: "#E8F6FE", sky1: "#F6FCFF", far: "#C6E6F5", ground: "#8FC9E8", groundDark: "#E4F3FB", deco: "#5FBCE0" },
  { sky0: "#FFF9E4", sky1: "#FFF3D2", far: "#F5E4A9", ground: "#F5CE5E", groundDark: "#FDF3D2", deco: "#EFAE2E" },
  { sky0: "#F0EBFC", sky1: "#F9F5FF", far: "#D8CEF2", ground: "#B79CE8", groundDark: "#EFE8FB", deco: "#9B7ADC" },
];

/** 两位小主角的配色:朵朵粉披风,星星蓝披风 */
const HERO_COLORS = [
  { body: "#FFD9A8", cape: "#FF8FB8", capeDark: "#E4699A", mask: "#7B4DA8", name: "朵朵" },
  { body: "#FFE2BE", cape: "#7FB2FF", capeDark: "#5A8ADD", mask: "#2F6BAE", name: "星星" },
];

const FLOWERS = ["🌸", "🌼", "🌷", "🌻", "💐"];

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.ph-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.ph-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.ph-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#8A5A3C;
  box-shadow:0 2px 6px rgba(170,130,100,.22);white-space:nowrap;}
.ph-bar{position:relative;flex:1;min-width:110px;height:20px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(150,120,90,.25);}
.ph-bar-fill{height:100%;width:0%;border-radius:999px;transition:width .16s linear;
  background:linear-gradient(90deg,#FFC79A,#9BD98F);}
.ph-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;color:#6B4A32;}
.ph-btn{border:none;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#8A5A3C;box-shadow:0 3px 0 rgba(170,130,100,.3);}
.ph-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,130,100,.3);}
.ph-btn:focus-visible,.ph-key:focus-visible{outline:3px solid #6B4A32;outline-offset:2px;}
.ph-stagebox{position:relative;border-radius:16px;overflow:hidden;background:#FFF6EC;
  box-shadow:0 4px 12px rgba(170,140,110,.24);}
.ph-cv{display:block;width:100%;height:300px;}
.ph-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,250,244,.93);}
.ph-veil-title{font-size:20px;font-weight:900;color:#8A5A3C;}
.ph-veil-sub{font-size:14px;font-weight:700;color:#9A7A5E;line-height:1.6;max-width:320px;}
.ph-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ph-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.ph-veil-btn.ph-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.ph-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #C25A80;}
.ph-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#8A5A3C;box-shadow:0 3px 8px rgba(160,120,90,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:90%;text-align:center;}
.ph-toast.ph-on{opacity:1;}
.ph-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:52px;}
.ph-pads[data-players="2"]{--k:40px;}
.ph-pad{display:grid;grid-template-columns:repeat(4,var(--k));grid-auto-rows:var(--k);gap:4px;
  justify-content:center;}
.ph-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;color:#8A5A3C;text-align:center;
  height:auto;line-height:1.3;}
.ph-key{border:none;border-radius:14px;font-size:19px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#7A5238;box-shadow:0 3px 0 rgba(170,130,100,.34);touch-action:none;padding:0;}
.ph-key:active,.ph-key.ph-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,130,100,.34);
  background:#FFE7D2;}
.ph-key-act{background:#FFD9E6;color:#B3527C;}
.ph-key-sub{background:#DFF0FF;color:#3F72A8;}
.ph-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#9A7A5E;line-height:1.5;}
.ph-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.ph-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F0A87C,#D9834F);box-shadow:0 4px 0 #B4693C;}
.ph-mode.ph-mode-duo{background:linear-gradient(180deg,#9BC7F2,#6E9FD4);box-shadow:0 4px 0 #55799F;}
.ph-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #B4693C;}
.ph-mode:focus-visible{outline:3px solid #6B4A32;outline-offset:3px;}
.ph-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.ph-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#8A5A3C;}
@media (max-width:420px){
  .ph-cv{height:178px;}
  .ph-pads{--k:46px;margin-top:6px;}
  .ph-pads[data-players="2"]{--k:36px;}
  .ph-chip{font-size:12px;padding:3px 7px;}
  .ph-hud{gap:4px;margin-bottom:4px;}
  .ph-bar{min-width:76px;height:18px;}
  .ph-btn{padding:5px 9px;}
  .ph-lbl{display:none;}
  .ph-tip{font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ph-pad-name{font-size:10px;}
}
/* 触屏设备用不上键盘提示,省下的高度留给画面 */
@media (hover:none) and (max-width:420px){ .ph-pad-name{display:none;} }
@media (max-height:620px){ .ph-cv{height:158px;} }
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
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
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

interface FieldOpts {
  def: LevelDef;
  players: 1 | 2;
  sfx: (name: SoundName) => void;
  title: string;
  tip: string;
  /** HUD 右侧要不要显示计时 */
  showTimer: boolean;
  /** 每帧给 HUD 补一段自定义文字(无尽的分数) */
  extraChip?: (w: World) => string;
  onEnd: (win: boolean, w: World) => void;
  /** 暂停面板里的「退出」按钮;不给就不显示 */
  onQuit?: () => void;
  /** 开场准备横幅要不要显示 */
  ready?: boolean;
}

interface Field {
  destroy: () => void;
  world: World;
  /** 换一张图接着玩(无尽用) */
  swap: (def: LevelDef, keep: { hearts: number }) => void;
  showVeil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
  toast: (text: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<WorldEvent["kind"], SoundName>> = {
  jump: "jump",
  dash: "pop",
  sweep: "tap",
  flower: "coin",
  wipe: "pop",
  sparkle: "coin",
  hurt: "oops",
  spring: "jump",
  smash: "pop",
  win: "win",
  lose: "oops",
};

const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], string>> = {
  flower: "🌸",
  wipe: "✨",
  sparkle: "⭐",
  hurt: "💫",
  smash: "💨",
  spring: "🍄",
};

function createField(host: HTMLElement, opts: FieldOpts): Field {
  let world = createWorld(opts.def, opts.players);
  let destroyed = false;
  let ended = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let readyT = opts.ready === false ? 0 : 1.5;
  let toastT = 0;
  const particles: Particle[] = [];
  const inputs: Input[] = [emptyInput(), emptyInput()];
  const sfxAt = new Map<SoundName, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const wrap = el("div", "ph-wrap");
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  // ---- HUD ----
  const hud = el("div", "ph-hud");
  const hearts = el("span", "ph-chip");
  const bar = el("div", "ph-bar");
  const barFill = el("div", "ph-bar-fill");
  const barTxt = el("span", "ph-bar-txt");
  bar.append(barFill, barTxt);
  const sparkChip = el("span", "ph-chip");
  const timerChip = el("span", "ph-chip");
  const extraChip = el("span", "ph-chip");
  const pauseBtn = el("button", "ph-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="ph-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  hud.append(hearts, bar, sparkChip);
  if (opts.showTimer) hud.appendChild(timerChip);
  if (opts.extraChip) hud.appendChild(extraChip);
  hud.appendChild(pauseBtn);
  wrap.appendChild(hud);

  // ---- 画布 ----
  const box = el("div", "ph-stagebox");
  const canvas = el("canvas", "ph-cv");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:噗噗超人正在清洁这条路`);
  const toastEl = el("div", "ph-toast");
  box.append(canvas, toastEl);
  wrap.appendChild(box);

  // ---- 触屏按键 ----
  const pads = el("div", "ph-pads");
  pads.dataset.players = String(opts.players);
  const PAD_KEYS: Array<{ act: InputName; label: string; cls?: string; aria: string; col: number; row: number }> = [
    { act: "up", label: "⬆", aria: "跳", col: 2, row: 2 },
    { act: "act", label: "💨", cls: "ph-key-act", aria: "冲刺清扫", col: 4, row: 2 },
    { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
    { act: "down", label: "⬇", aria: "蹲下", col: 2, row: 3 },
    { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
    { act: "sub", label: "🧹", cls: "ph-key-sub", aria: "扫一扫", col: 4, row: 3 },
  ];
  const padButtons: Array<{ btn: HTMLButtonElement; player: number; act: InputName }> = [];
  for (let pi = 0; pi < opts.players; pi++) {
    const pad = el("div", "ph-pad");
    const name = el(
      "div",
      "ph-pad-name",
      opts.players === 1
        ? "WASD / 方向键移动 · F 或 L 冲刺 · G 或 K 扫一扫"
        : pi === 0
          ? "朵朵 · W A S D · F 冲刺 · G 扫"
          : "星星 · ↑←↓→ · L 冲刺 · K 扫"
    );
    pad.appendChild(name);
    for (const k of PAD_KEYS) {
      const btn = el("button", `ph-key${k.cls ? ` ${k.cls}` : ""}`, k.label);
      btn.type = "button";
      btn.style.gridColumn = String(k.col);
      btn.style.gridRow = String(k.row);
      btn.setAttribute("aria-label", `${opts.players === 2 ? HERO_COLORS[pi].name : ""}${k.aria}`);
      pad.appendChild(btn);
      padButtons.push({ btn, player: pi, act: k.act });
    }
    pads.appendChild(pad);
  }
  wrap.appendChild(pads);

  const tip = el("div", "ph-tip", opts.tip);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入绑定 ----
  function setKey(player: number, act: InputName, down: boolean): void {
    const slot = inputs[player];
    if (!slot) return;
    slot[act] = down;
  }

  for (const { btn, player, act } of padButtons) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("ph-down");
      setKey(player, act, true);
    });
    const up = (): void => {
      btn.classList.remove("ph-down");
      setKey(player, act, false);
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  const releaseAll = (): void => {
    for (const { btn, player, act } of padButtons) {
      btn.classList.remove("ph-down");
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
    const hit = keyToAction(e.code, opts.players);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.players);
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

  function showVeil(
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    clearVeil();
    const v = el("div", "ph-veil");
    v.append(el("div", "ph-veil-title", title), el("div", "ph-veil-sub", sub));
    const row = el("div", "ph-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `ph-veil-btn${b.ghost ? " ph-ghost" : ""}`, b.label);
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
      if (opts.onQuit) {
        buttons.push({ label: "🚪 退出", ghost: true, onClick: () => opts.onQuit?.() });
      }
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
    toastEl.classList.add("ph-on");
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
  const pal = PALETTES[world.def.chapterIndex % PALETTES.length];

  function drawHero(
    ctx2: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    scale: number,
    pi: number,
    p: World["players"][number]
  ): void {
    const colors = HERO_COLORS[pi % HERO_COLORS.length];
    const h = (p.crouch ? CROUCH_H : PLAYER_H) * scale;
    const w = PLAYER_W * scale;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    const headR = Math.max(4, w * 0.38);
    const headCY = -h + headR * 0.95;
    const bodyTop = headCY + headR * 0.7;
    ctx2.save();
    ctx2.globalAlpha = blink ? 0.45 : 1;
    ctx2.translate(sx, sy);
    ctx2.scale(p.facing, 1);

    // 披风(在身后飘)
    const flap = p.onGround ? 0 : 0.22;
    ctx2.fillStyle = colors.capeDark;
    ctx2.beginPath();
    ctx2.moveTo(-w * 0.05, bodyTop - headR * 0.1);
    ctx2.quadraticCurveTo(-w * (1.05 + flap), -h * 0.42, -w * (0.5 + flap), -h * 0.02);
    ctx2.quadraticCurveTo(-w * 0.22, -h * 0.24, -w * 0.05, bodyTop + h * 0.1);
    ctx2.closePath();
    ctx2.fill();
    ctx2.fillStyle = colors.cape;
    ctx2.beginPath();
    ctx2.moveTo(0, bodyTop - headR * 0.1);
    ctx2.quadraticCurveTo(-w * (0.82 + flap), -h * 0.4, -w * (0.34 + flap), -h * 0.06);
    ctx2.quadraticCurveTo(-w * 0.14, -h * 0.26, 0, bodyTop + h * 0.08);
    ctx2.closePath();
    ctx2.fill();

    // 小脚
    ctx2.fillStyle = colors.capeDark;
    ctx2.beginPath();
    ctx2.ellipse(-w * 0.17, -h * 0.02, w * 0.16, h * 0.055, 0, 0, Math.PI * 2);
    ctx2.ellipse(w * 0.17, -h * 0.02, w * 0.16, h * 0.055, 0, 0, Math.PI * 2);
    ctx2.fill();

    // 身体(套着披风领的连身衣)
    ctx2.fillStyle = colors.cape;
    roundRect(ctx2, -w * 0.36, bodyTop, w * 0.72, -bodyTop - h * 0.02, w * 0.26);
    ctx2.fill();
    // 胸口小花徽章
    ctx2.fillStyle = "#FFF6DC";
    ctx2.beginPath();
    ctx2.arc(0, bodyTop + (-bodyTop) * 0.42, Math.max(2, w * 0.15), 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = colors.mask;
    ctx2.beginPath();
    ctx2.arc(0, bodyTop + (-bodyTop) * 0.42, Math.max(1, w * 0.07), 0, Math.PI * 2);
    ctx2.fill();

    // 脑袋
    ctx2.fillStyle = colors.body;
    ctx2.beginPath();
    ctx2.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx2.fill();
    // 眼罩
    ctx2.fillStyle = colors.mask;
    roundRect(ctx2, -headR * 0.98, headCY - headR * 0.38, headR * 1.96, headR * 0.6, headR * 0.26);
    ctx2.fill();
    ctx2.fillStyle = "#FFFFFF";
    ctx2.beginPath();
    ctx2.arc(headR * 0.34, headCY - headR * 0.08, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx2.arc(-headR * 0.24, headCY - headR * 0.08, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx2.fill();
    // 腮红与笑脸
    ctx2.fillStyle = "#F9B6C6";
    ctx2.globalAlpha = blink ? 0.3 : 0.7;
    ctx2.beginPath();
    ctx2.ellipse(headR * 0.62, headCY + headR * 0.4, headR * 0.2, headR * 0.14, 0, 0, Math.PI * 2);
    ctx2.ellipse(-headR * 0.62, headCY + headR * 0.4, headR * 0.2, headR * 0.14, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = blink ? 0.45 : 1;
    ctx2.strokeStyle = "#A9713F";
    ctx2.lineWidth = Math.max(1, headR * 0.14);
    ctx2.beginPath();
    ctx2.arc(headR * 0.06, headCY + headR * 0.34, headR * 0.24, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx2.stroke();

    // 手里的小扫帚
    if (p.sweepT > 0 || p.dashT > 0) {
      ctx2.strokeStyle = "#B98A5E";
      ctx2.lineWidth = Math.max(1.5, w * 0.09);
      ctx2.beginPath();
      ctx2.moveTo(w * 0.3, -h * 0.55);
      ctx2.lineTo(w * 0.85, -h * 0.18);
      ctx2.stroke();
      ctx2.fillStyle = "#F6D08A";
      roundRect(ctx2, w * 0.76, -h * 0.3, w * 0.36, h * 0.26, w * 0.1);
      ctx2.fill();
    }
    ctx2.restore();

    // 冲刺时的小气流
    if (p.dashT > 0) {
      ctx2.globalAlpha = 0.5;
      emoji(ctx2, "💨", sx - p.facing * w * 1.1, sy - h * 0.5, 16 * Math.max(0.7, scale));
      ctx2.globalAlpha = 1;
    }
  }

  function drawMonster(
    ctx2: CanvasRenderingContext2D,
    sx: number,
    groundY: number,
    scale: number,
    m: World["monsters"][number],
    idx: number
  ): void {
    if (m.clean) {
      const pop = m.bloom > 0 ? 1 + m.bloom : 1;
      emoji(ctx2, FLOWERS[idx % FLOWERS.length], sx, groundY - MONSTER_H * 0.45 * scale, 24 * scale * pop);
      return;
    }
    // 「臭臭怪」画成一朵横着的奶茶色小云:宽大于高、顶上三个一样高的圆边、
    // 底下两只小短脚、头顶一个粉蝴蝶结 —— 一眼是小怪兽,不是别的什么东西。
    const w = MONSTER_W * 1.2 * scale;
    const h = MONSTER_H * 0.82 * scale;
    const cy = groundY - h * 0.62 - 3 * scale;
    const bob = Math.sin(world.time * 4 + idx) * 1.6 * scale;
    ctx2.save();
    ctx2.translate(0, bob);

    // 小短脚
    ctx2.fillStyle = "#C9A583";
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.2, groundY - 3 * scale, w * 0.14, 4 * scale, 0, 0, Math.PI * 2);
    ctx2.ellipse(sx + w * 0.2, groundY - 3 * scale, w * 0.14, 4 * scale, 0, 0, Math.PI * 2);
    ctx2.fill();

    // 云朵身体
    ctx2.fillStyle = "#E4C6A7";
    ctx2.beginPath();
    ctx2.arc(sx - w * 0.3, cy - h * 0.04, h * 0.4, 0, Math.PI * 2);
    ctx2.arc(sx, cy - h * 0.1, h * 0.44, 0, Math.PI * 2);
    ctx2.arc(sx + w * 0.3, cy - h * 0.04, h * 0.4, 0, Math.PI * 2);
    ctx2.ellipse(sx, cy + h * 0.2, w * 0.52, h * 0.38, 0, 0, Math.PI * 2);
    ctx2.fill();
    // 高光
    ctx2.fillStyle = "#F2DCC6";
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.22, cy - h * 0.24, w * 0.16, h * 0.14, -0.4, 0, Math.PI * 2);
    ctx2.fill();

    // 头顶小蝴蝶结
    ctx2.fillStyle = "#F79BC0";
    ctx2.beginPath();
    ctx2.ellipse(sx - h * 0.2, cy - h * 0.56, h * 0.16, h * 0.11, -0.5, 0, Math.PI * 2);
    ctx2.ellipse(sx + h * 0.2, cy - h * 0.56, h * 0.16, h * 0.11, 0.5, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = "#FFD3E4";
    ctx2.beginPath();
    ctx2.arc(sx, cy - h * 0.56, h * 0.08, 0, Math.PI * 2);
    ctx2.fill();

    // 腮红 + 眼睛 + 微笑
    ctx2.fillStyle = "#F7B9C4";
    ctx2.globalAlpha = 0.75;
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.34, cy + h * 0.12, w * 0.09, h * 0.09, 0, 0, Math.PI * 2);
    ctx2.ellipse(sx + w * 0.34, cy + h * 0.12, w * 0.09, h * 0.09, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = 1;
    ctx2.fillStyle = "#FFFFFF";
    ctx2.beginPath();
    ctx2.arc(sx - w * 0.17, cy - h * 0.06, h * 0.17, 0, Math.PI * 2);
    ctx2.arc(sx + w * 0.17, cy - h * 0.06, h * 0.17, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = "#6B4A32";
    ctx2.beginPath();
    ctx2.arc(sx - w * 0.15 + m.dir * h * 0.04, cy - h * 0.04, h * 0.08, 0, Math.PI * 2);
    ctx2.arc(sx + w * 0.19 + m.dir * h * 0.04, cy - h * 0.04, h * 0.08, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = "#B08A66";
    ctx2.lineWidth = Math.max(1, scale * 1.5);
    ctx2.beginPath();
    ctx2.arc(sx, cy + h * 0.16, h * 0.13, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx2.stroke();
    ctx2.restore();
  }

  function render(): void {
    if (!g) return;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    const cssW = Math.max(240, canvas.clientWidth || 360);
    const cssH = Math.max(160, canvas.clientHeight || 260);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const def = world.def;
    const scale = Math.max(0.5, Math.min(1.1, cssW / 560));
    const viewW = cssW / scale;
    const groundY = cssH - Math.max(42, cssH * 0.2);
    const focus =
      world.players.reduce((s, p) => s + p.x, 0) / world.players.length;
    const camX = Math.max(0, Math.min(Math.max(0, def.len - viewW), focus - viewW / 2));
    const sx = (wx: number): number => (wx - camX) * scale;
    const sy = (wy: number): number => groundY + wy * scale;

    // 天空
    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, cssH);

    // 远景:软软的小房子和云
    g.globalAlpha = 0.45;
    for (let i = 0; i < 16; i++) {
      const bx = ((i * 260 - camX * 0.32) % (viewW + 520)) - 200;
      const bh = 46 + ((i * 37) % 62);
      const bw = 88 + ((i * 23) % 46);
      g.fillStyle = pal.far;
      roundRect(g, bx * scale, groundY - bh * scale, bw * scale, bh * scale, 14 * scale);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.globalAlpha = 0.26;
      const top = groundY - bh * scale;
      for (let r = 0; r * 26 + 36 < bh; r++) {
        for (let c = 0; c * 28 + 28 < bw; c++) {
          roundRect(g, bx * scale + (15 + c * 28) * scale, top + (15 + r * 26) * scale, 8 * scale, 8 * scale, 3 * scale);
          g.fill();
        }
      }
      g.globalAlpha = 0.45;
    }
    g.globalAlpha = 1;
    g.globalAlpha = 0.75;
    g.fillStyle = "#FFFFFF";
    for (let i = 0; i < 10; i++) {
      const cx = ((i * 330 - camX * 0.18) % (viewW + 660)) - 240;
      const cy = 22 + ((i * 53) % 46);
      g.beginPath();
      g.arc(cx * scale, cy, 16 * scale, 0, Math.PI * 2);
      g.arc(cx * scale + 18 * scale, cy + 4, 12 * scale, 0, Math.PI * 2);
      g.arc(cx * scale - 17 * scale, cy + 5, 11 * scale, 0, Math.PI * 2);
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
      for (let d = Math.ceil(a / 90) * 90; d < b; d += 90) {
        g.fillRect(sx(d), groundY + 14 * scale, 5 * scale, 5 * scale);
      }
    }

    // 泥洼与污渍
    world.sludges.forEach((s, i) => {
      const x0 = sx(s.x);
      const x1 = sx(s.x + s.w);
      if (x1 < -30 || x0 > cssW + 30) return;
      if (s.clean) {
        for (let k = 0; k * 46 < s.w; k++) {
          emoji(g, FLOWERS[(i + k) % FLOWERS.length], sx(s.x + 22 + k * 46), groundY - 9 * scale, 15 * scale);
        }
        return;
      }
      // 黏答答的泥洼:浅奶茶色 + 一串小泡泡,离「脏」远一点、离「该擦干净」近一点
      g.fillStyle = "#E0C8AC";
      roundRect(g, x0, groundY - 7 * scale, x1 - x0, 10 * scale, 5 * scale);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.globalAlpha = 0.7;
      for (let k = 0; k * 30 < s.w; k++) {
        g.beginPath();
        g.arc(sx(s.x + 14 + k * 30), groundY - 4 * scale, 2.8 * scale, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    });
    world.stains.forEach((s, i) => {
      const x = sx(s.x);
      if (x < -30 || x > cssW + 30) return;
      if (s.clean) {
        emoji(g, FLOWERS[i % FLOWERS.length], x, groundY - 10 * scale, 15 * scale);
        return;
      }
      // 小污渍:一小片浅浅的灰尘印,扫一下就变成花
      g.fillStyle = "#E5D2BB";
      g.beginPath();
      g.ellipse(x, groundY - 3 * scale, 14 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#F3E6D6";
      g.beginPath();
      g.ellipse(x + 6 * scale, groundY - 6 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.55;
      emoji(g, "💫", x - 8 * scale, groundY - 12 * scale, 10 * scale);
      g.globalAlpha = 1;
    });

    // 弹簧蘑菇
    for (const sp of world.springs) {
      const x = sx(sp.x);
      if (x < -40 || x > cssW + 40) continue;
      const squash = sp.squash > 0 ? 0.6 : 1;
      g.fillStyle = "#FFF3E4";
      roundRect(g, x - 6 * scale, groundY - 14 * scale * squash, 12 * scale, 14 * scale * squash, 4 * scale);
      g.fill();
      g.fillStyle = "#F58FB0";
      g.beginPath();
      g.ellipse(x, groundY - 14 * scale * squash, 17 * scale, 10 * scale, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#FFE3EC";
      g.beginPath();
      g.arc(x - 6 * scale, groundY - 17 * scale * squash, 2.6 * scale, 0, Math.PI * 2);
      g.arc(x + 6 * scale, groundY - 19 * scale * squash, 2.2 * scale, 0, Math.PI * 2);
      g.fill();
    }

    // 平台
    for (const pl of world.platforms) {
      const x = sx(pl.x);
      if (x + pl.w * scale < -40 || x > cssW + 40) continue;
      g.fillStyle = pl.moving ? "#BFE3F7" : pal.ground;
      roundRect(g, x, sy(pl.y), pl.w * scale, 12 * scale, 6 * scale);
      g.fill();
      g.fillStyle = pl.moving ? "#8CC7E8" : pal.groundDark;
      roundRect(g, x, sy(pl.y) + 8 * scale, pl.w * scale, 5 * scale, 3 * scale);
      g.fill();
      if (pl.moving) emoji(g, "🫧", x + pl.w * scale * 0.5, sy(pl.y) - 9 * scale, 13 * scale);
    }

    // 低矮管道
    for (const b of world.beams) {
      const x = sx(b.x);
      if (x + b.w * scale < -40 || x > cssW + 40) continue;
      g.fillStyle = "#A9BBD0";
      roundRect(g, x, sy(BEAM_TOP), b.w * scale, (BEAM_BOTTOM - BEAM_TOP) * scale, 8 * scale);
      g.fill();
      g.fillStyle = "#C4D3E4";
      roundRect(g, x + 4 * scale, sy(BEAM_TOP) + 4 * scale, b.w * scale - 8 * scale, 8 * scale, 4 * scale);
      g.fill();
      g.fillStyle = "#8FA3BC";
      for (let k = 0; k * 40 < b.w; k++) {
        g.beginPath();
        g.arc(x + (16 + k * 40) * scale, sy(BEAM_BOTTOM) - 8 * scale, 2.6 * scale, 0, Math.PI * 2);
        g.fill();
      }
    }

    // 香香星
    world.sparkles.forEach((s) => {
      if (s.taken) return;
      const x = sx(s.x);
      if (x < -30 || x > cssW + 30) return;
      const bob = Math.sin(world.time * 3 + s.x * 0.02) * 3 * scale;
      emoji(g, "✨", x, sy(s.y) + bob, 19 * scale);
    });

    // 臭臭怪 / 小花
    world.monsters.forEach((m, i) => {
      const x = sx(m.x);
      if (x < -60 || x > cssW + 60) return;
      drawMonster(g, x, groundY, scale, m, i);
    });

    // 废纸团
    for (const j of world.junks) {
      if (!j.alive) continue;
      const x = sx(j.x);
      if (x < -40 || x > cssW + 40) continue;
      g.fillStyle = "#D8D2C6";
      g.beginPath();
      g.arc(x, groundY - JUNK_R * scale, JUNK_R * scale, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#B3AB9C";
      g.lineWidth = Math.max(1, 1.6 * scale);
      g.beginPath();
      g.moveTo(x - 9 * scale, groundY - 22 * scale);
      g.lineTo(x + 6 * scale, groundY - 12 * scale);
      g.moveTo(x - 5 * scale, groundY - 8 * scale);
      g.lineTo(x + 9 * scale, groundY - 20 * scale);
      g.stroke();
    }

    // 净化门
    const doorX = sx(def.goalX);
    if (doorX > -90 && doorX < cssW + 90) {
      const open = doorOpen(world);
      g.fillStyle = open ? "#BFE9C6" : "#E3D9CE";
      roundRect(g, doorX - 28 * scale, groundY - 92 * scale, 56 * scale, 92 * scale, 22 * scale);
      g.fill();
      g.fillStyle = open ? "#8FD69C" : "#CBBFB1";
      roundRect(g, doorX - 20 * scale, groundY - 82 * scale, 40 * scale, 82 * scale, 16 * scale);
      g.fill();
      emoji(g, open ? "🧼" : "🔒", doorX, groundY - 52 * scale, 24 * scale);
      g.fillStyle = "#6B4A32";
      g.font = `900 ${Math.round(11 * Math.max(0.85, scale))}px system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(open ? "香喷喷!" : `还差 ${remainingForDoor(world)} 处`, doorX, groundY - 22 * scale);
    }

    // 臭味潮
    if (world.chaserX !== null) {
      const cx = sx(world.chaserX);
      if (cx > -140) {
        const grad = g.createLinearGradient(cx - 150 * scale, 0, cx, 0);
        grad.addColorStop(0, "rgba(196,164,196,0)");
        grad.addColorStop(1, "rgba(178,140,178,.72)");
        g.fillStyle = grad;
        g.fillRect(cx - 150 * scale, 0, 150 * scale, cssH);
        g.fillStyle = "rgba(178,140,178,.72)";
        g.fillRect(0, 0, Math.max(0, cx - 150 * scale), cssH);
        for (let k = 0; k < 4; k++) {
          emoji(g, "💨", cx - (12 + k * 26) * scale, groundY - (18 + ((k * 37) % 60)) * scale, 15 * scale);
        }
      }
    }

    // 角色
    world.players.forEach((p, i) => {
      const x = sx(p.x);
      if (x < -30 || x > cssW + 30) {
        // 队友跑出画面:边上给个小箭头
        if (opts.players > 1) {
          const edge = x < 0 ? 14 : cssW - 14;
          g.fillStyle = HERO_COLORS[i].cape;
          g.beginPath();
          g.arc(edge, groundY - 60, 11, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#FFFFFF";
          g.font = "900 12px system-ui,sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(x < 0 ? "◀" : "▶", edge, groundY - 60);
        }
        return;
      }
      drawHero(g, x, sy(p.y), scale, i, p);
    });

    // 小特效
    for (const pt of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, pt.life));
      emoji(g, pt.text, sx(pt.x), sy(pt.y), pt.size * scale);
    }
    g.globalAlpha = 1;

    // 开场横幅
    if (readyT > 0) {
      g.fillStyle = "rgba(255,250,244,.82)";
      g.fillRect(0, cssH * 0.3, cssW, cssH * 0.4);
      g.fillStyle = "#8A5A3C";
      g.font = `900 ${Math.round(19 * Math.max(0.85, scale))}px system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(def.name, cssW / 2, cssH * 0.44);
      g.font = `800 ${Math.round(13 * Math.max(0.85, scale))}px system-ui,sans-serif`;
      g.fillStyle = "#9A7A5E";
      g.fillText(def.hint.slice(0, 24), cssW / 2, cssH * 0.56);
    }
  }

  function renderHud(): void {
    hearts.textContent = `${"❤️".repeat(Math.max(0, world.hearts))}${"🤍".repeat(
      Math.max(0, world.def.hearts - Math.max(0, world.hearts))
    )}`;
    const pct = Math.round(cleanRatio(world) * 100);
    barFill.style.width = `${pct}%`;
    barTxt.textContent = `清洁度 ${pct}%`;
    sparkChip.textContent = `✨ ${world.sparklesTaken}/${world.sparkles.length}`;
    if (opts.showTimer) timerChip.textContent = `⏱ ${Math.floor(world.time)}″`;
    if (opts.extraChip) extraChip.textContent = opts.extraChip(world);
  }

  // ---- 主循环 ----
  function frame(now: number): void {
    if (destroyed) return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;

    if (!paused && !ended) {
      if (readyT > 0) {
        readyT = Math.max(0, readyT - dt);
      } else {
        stepWorld(world, dt, inputs);
        consumeEvents(now);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) toastEl.classList.remove("ph-on");
    }

    render();
    renderHud();

    if (!ended && world.status !== "playing") {
      ended = true;
      const win = world.status === "won";
      opts.onEnd(win, world);
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
      ended = false;
      readyT = 1.1;
      particles.length = 0;
      clearVeil();
    },
    showVeil,
    toast,
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
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
// 闯关模式:交给 level99 通用框架
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = buildLevel(ctx.level);
  const field = createField(stage, {
    def,
    players: 1,
    sfx: ctx.sfx,
    title: def.name,
    tip: def.hint,
    showTimer: true,
    onEnd: (win, w) => {
      const summary = summarize(w);
      if (win) {
        ctx.win(starsForRun(def, summary), winMessage(def, summary));
      } else {
        ctx.lose(w.message || "再来一次,这次先把近处的清干净!");
      }
    },
  });
  return { destroy: () => field.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式:清洁马拉松
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "ph-head");
  const back = el("button", "ph-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "ph-head-title", "♾️ 清洁马拉松");
  const bestChip = el("span", "ph-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let round = 0;
  let scoreBase = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = best > 0 ? `🏅 最好 ${best} 分` : "🏅 还没有纪录";

  const liveScore = (w: World): number =>
    scoreBase + endlessScore(w.cleaned, w.sparklesTaken, metersOf(Math.max(...w.players.map((p) => p.x))));

  let field: Field | null = null;

  function startRound(def: LevelDef, hearts: number): void {
    field?.destroy();
    field = createField(fieldHost, {
      def,
      players: 1,
      sfx: (n) => api.play(n),
      title: def.name,
      tip: "一路清一路跑!身后的臭味潮越追越快,心用完就结算。",
      showTimer: false,
      extraChip: (w) => `🧽 ${liveScore(w)} 分`,
      onQuit: onExit,
      onEnd: (win, w) => {
        if (win) {
          // 街区清完啦,接着跑下一段
          scoreBase = liveScore(w);
          round++;
          const hp = Math.min(3, w.hearts + 1);
          const next = buildEndless(round);
          field?.swap(next, { hearts: hp });
          field?.toast(`第 ${round} 段街区变香啦!补一颗心,继续冲!`);
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
    const bonus = Math.min(6, Math.floor(score / 120));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    field?.showVeil(
      record ? `新纪录 ${score} 分!` : `这趟拿了 ${score} 分`,
      `${record ? "你把最长的一条街清干净了,太厉害啦!" : `最好成绩 ${best} 分,再来一趟就能追上它。`}${
        bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""
      }`,
      [
        {
          label: "🔁 再跑一趟",
          onClick: () => {
            round = 0;
            scoreBase = 0;
            startRound(buildEndless(0), 3);
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

  startRound(buildEndless(0), 3);

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人合作模式
// ---------------------------------------------------------------------------

function mountCoop(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "ph-head");
  const back = el("button", "ph-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "ph-head-title", "👫 双人合作 · 清洁大作战");
  const roundChip = el("span", "ph-chip");
  head.append(back, title, roundChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let round = 0;
  let field: Field | null = null;

  function startRound(): void {
    const def = buildCoop(round);
    roundChip.textContent = `第 ${round + 1} 关`;
    field?.destroy();
    field = createField(fieldHost, {
      def,
      players: 2,
      sfx: (n) => api.play(n),
      title: def.name,
      tip: "分头行动!全部清干净以后,两个人一起站到净化门前才算成功。",
      showTimer: true,
      onQuit: onExit,
      onEnd: (win, w) => {
        if (win) {
          api.play("win");
          const a = w.players[0].cleaned;
          const b = w.players[1].cleaned;
          api.addStars(2);
          field?.showVeil(
            "整条街都香喷喷啦!",
            `用了 ${Math.round(w.time)} 秒。朵朵清了 ${a} 处,星星清了 ${b} 处,${
              a === b ? "配合得一样棒!" : "两个人加起来才是最快的!"
            }送你们 2 颗小星星。`,
            [
              {
                label: "▶ 下一关",
                onClick: () => {
                  round++;
                  startRound();
                },
              },
              {
                label: "🔁 再来一次",
                ghost: true,
                onClick: () => startRound(),
              },
              { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
            ]
          );
        } else {
          api.play("oops");
          field?.showVeil("差一点点就干净啦", w.message || "两个人分头清会快很多,再来一次!", [
            { label: "🔁 再来一次", onClick: () => startRound() },
            { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
          ]);
        }
      },
    });
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  startRound();

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
  const bar = el("div", "ph-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "ph-mode");
  endlessBtn.type = "button";
  const duoBtn = el("button", "ph-mode ph-mode-duo", "👫 双人合作");
  duoBtn.type = "button";
  bar.append(endlessBtn, duoBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 清洁马拉松 · 最好 ${best} 分` : "♾️ 清洁马拉松 · 来一趟!";
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
  duoBtn.addEventListener("click", () => openMode(mountCoop));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "清洁度、用时、香香星,三样都做到就是三颗星!",
      grandMessage: "188 段路全部变香喷喷,你就是货真价实的便便超人!",
      guideTitle: "清洁小攻略",
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
