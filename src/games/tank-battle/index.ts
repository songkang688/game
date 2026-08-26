import { meta } from "./meta";
export { meta };

// 铁皮坦克大战:俯视格子战场,守住底边的星星堡垒。
// 砖墙打得碎、钢墙打不动、水面绕着走、草丛能藏人;敌人分快速 / 装甲 / 火力 / 会绕后四种。
// 四种玩法:188 关战役(可随时拉第二个人进来合作)、双人对战、无尽敌潮。
// 全程没有血量与淘汰:敌人挨够炮弹冒烟变成花,自己人被打中只是弹飞回出生点转两圈。
import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import {
  CHAPTERS,
  CHAPTER_NEW,
  MAP_H,
  MAP_W,
  buildLevel,
  chapterIndexOf,
  endlessRows,
  scaleForPlayers,
  versusRows,
} from "./levels";
import {
  ACTION_DIR,
  ENEMY_SPECS,
  KEY_MAP,
  PAUSE_KEY,
  TANK_HALF,
  aliveEnemies,
  createWorld,
  endlessMaxAlive,
  endlessWave,
  fortGaps,
  isFortBrick,
  loseLine,
  rateRun,
  stepWorld,
  winLine,
  type Dir,
  type EnemyKind,
  type PlayerInput,
  type Tank,
  type TankMode,
  type World,
} from "./logic";
import { mulberry32 } from "../level99";

const P_NAME = ["朵朵", "星星"];
const P_COLOR = ["#e8558f", "#3f7fd6"];
const P_KEYS = ["WASD 走 · F 开炮 · G 补墙", "方向键 走 · L 开炮 · K 补墙"];

const CSS = `
.tb-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;align-items:center;}
.tb-hud{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%;}
.tb-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#5f5280;
  box-shadow:0 2px 6px rgba(150,140,180,.24);white-space:nowrap;}
.tb-chip-warn{background:#ffe9ef;color:#b8436f;}
.tb-chip-p0{color:#b8356e;background:#ffe6ef;}
.tb-chip-p1{color:#2f5fa8;background:#e2eeff;}
.tb-board{position:relative;line-height:0;}
.tb-canvas{display:block;border-radius:14px;background:#5f5a52;touch-action:none;
  box-shadow:0 4px 14px rgba(90,80,110,.28);}
.tb-over{position:absolute;inset:0;border-radius:14px;background:rgba(255,252,250,.94);display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:14px;}
.tb-over-t{font-size:21px;font-weight:900;color:#7a4f9a;line-height:1.3;}
.tb-over-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;max-width:280px;}
.tb-tip{font-size:12.5px;font-weight:700;color:#6f6390;text-align:center;line-height:1.5;max-width:420px;}
.tb-pads{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;width:100%;}
.tb-pad{display:flex;flex-direction:column;align-items:center;gap:4px;}
.tb-pad-t{font-size:12px;font-weight:900;}
.tb-dpad{display:grid;grid-template-columns:repeat(3,auto);grid-template-rows:repeat(3,auto);gap:4px;}
.tb-btn{border:none;border-radius:12px;min-width:42px;min-height:40px;padding:2px 6px;font-size:16px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#54446f;background:#efe9ff;
  box-shadow:0 3px 0 rgba(140,120,190,.4);}
.tb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.tb-btn:disabled{opacity:.45;cursor:default;}
.tb-btn-fire{background:#ffdbe6;color:#a83a68;box-shadow:0 3px 0 rgba(200,110,150,.42);}
.tb-btn-brick{background:#ffeed8;color:#a06a2c;box-shadow:0 3px 0 rgba(200,150,80,.42);}
.tb-btn:focus-visible,.tb-act:focus-visible,.tb-open:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.tb-padacts{display:flex;gap:6px;}
.tb-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.tb-act{border:none;border-radius:999px;padding:7px 14px;font-size:13.5px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#67529c;box-shadow:0 3px 0 rgba(120,90,160,.26);white-space:nowrap;}
.tb-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.26);}
.tb-act-on{background:#e7dcff;color:#4d3a86;}
.tb-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.tb-open{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7f9a5e,#65803f);box-shadow:0 4px 0 #4d6630;}
.tb-open.tb-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.tb-open:active{transform:translateY(2px);box-shadow:0 2px 0 #4d6630;}
.tb-mode{border-radius:18px;padding:10px;background:linear-gradient(180deg,#f2f6ea,#fff4f8);
  display:flex;flex-direction:column;gap:8px;align-items:center;}
.tb-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;}
.tb-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a7a52;box-shadow:0 3px 0 rgba(110,130,80,.3);}
.tb-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,130,80,.3);}
@media (max-width:420px){
  .tb-btn{min-width:38px;min-height:36px;font-size:15px;}
  .tb-pads{gap:6px;}
  .tb-open{padding:7px 11px;font-size:13px;}
  .tb-bar{gap:6px;margin-bottom:4px;}
  .tb-tip{font-size:11.5px;}
  .tb-chip{padding:4px 9px;font-size:12px;}
}
@media (prefers-reduced-motion:reduce){.tb-btn:active{transform:none;}}
`;

// ---------------------------------------------------------------------------
// 画面:全部程序化绘制,一张外部图片都不用
// ---------------------------------------------------------------------------

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawBrick(c: CanvasRenderingContext2D, x: number, y: number, s: number, hp: number): void {
  c.fillStyle = hp >= 2 ? "#c1714a" : "#d79a78";
  roundRect(c, x + 1, y + 1, s - 2, s - 2, 3);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,.5)";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + 2, y + s / 2);
  c.lineTo(x + s - 2, y + s / 2);
  c.moveTo(x + s / 2, y + 2);
  c.lineTo(x + s / 2, y + s / 2);
  c.moveTo(x + s / 4, y + s / 2);
  c.lineTo(x + s / 4, y + s - 2);
  c.moveTo(x + (s * 3) / 4, y + s / 2);
  c.lineTo(x + (s * 3) / 4, y + s - 2);
  c.stroke();
}

function drawSteel(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.fillStyle = "#b9bfc9";
  roundRect(c, x + 1, y + 1, s - 2, s - 2, 4);
  c.fill();
  c.fillStyle = "#8f97a3";
  const r = Math.max(1.2, s * 0.07);
  for (const [dx, dy] of [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ]) {
    c.beginPath();
    c.arc(x + s * dx, y + s * dy, r, 0, Math.PI * 2);
    c.fill();
  }
}

function drawWater(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  c.fillStyle = "#6fb6dd";
  c.fillRect(x, y, s, s);
  c.strokeStyle = "rgba(255,255,255,.55)";
  c.lineWidth = Math.max(1, s * 0.06);
  for (let k = 0; k < 2; k++) {
    const yy = y + s * (0.34 + k * 0.34) + Math.sin(t * 2 + x + k) * s * 0.05;
    c.beginPath();
    c.moveTo(x + s * 0.14, yy);
    c.quadraticCurveTo(x + s * 0.5, yy - s * 0.12, x + s * 0.86, yy);
    c.stroke();
  }
}

function drawGrass(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.fillStyle = "rgba(96,166,88,.92)";
  roundRect(c, x, y, s, s, 3);
  c.fill();
  c.fillStyle = "rgba(140,200,120,.85)";
  for (const [dx, dy] of [
    [0.25, 0.7],
    [0.5, 0.45],
    [0.75, 0.72],
  ]) {
    c.beginPath();
    c.ellipse(x + s * dx, y + s * dy, s * 0.16, s * 0.26, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function drawBase(c: CanvasRenderingContext2D, x: number, y: number, s: number, shielded: boolean, t: number): void {
  c.fillStyle = "#f7e7b8";
  roundRect(c, x + 1, y + 1, s - 2, s - 2, 5);
  c.fill();
  c.fillStyle = "#ffb937";
  c.beginPath();
  const cx = x + s / 2;
  const cy = y + s / 2;
  const R = s * 0.36;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? R : R * 0.45;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  if (shielded) {
    c.strokeStyle = `rgba(120,200,255,${0.55 + Math.sin(t * 4) * 0.2})`;
    c.lineWidth = Math.max(1.5, s * 0.09);
    c.beginPath();
    c.arc(cx, cy, s * 0.46, 0, Math.PI * 2);
    c.stroke();
  }
}

const KIND_FACE: Record<string, string> = {
  swift: "💨",
  armor: "🛡",
  power: "💥",
  smart: "🕵",
};

function drawTank(c: CanvasRenderingContext2D, tk: Tank, s: number, t: number): void {
  const px = tk.x * s;
  const py = tk.y * s;
  const half = TANK_HALF * s;
  const body =
    tk.side === "player" ? P_COLOR[tk.player] ?? P_COLOR[0] : ENEMY_SPECS[tk.kind as EnemyKind]?.color ?? "#9a9fb5";
  c.save();
  c.translate(px, py);
  c.rotate((tk.dir * Math.PI) / 2);
  // 履带
  c.fillStyle = "rgba(60,55,70,.85)";
  roundRect(c, -half, -half * 0.95, half * 0.42, half * 1.9, 2);
  c.fill();
  roundRect(c, half * 0.58, -half * 0.95, half * 0.42, half * 1.9, 2);
  c.fill();
  // 车身
  c.fillStyle = body;
  roundRect(c, -half * 0.62, -half * 0.85, half * 1.24, half * 1.7, half * 0.35);
  c.fill();
  // 炮管
  c.fillStyle = "rgba(50,45,60,.9)";
  roundRect(c, -half * 0.14, -half * 1.25, half * 0.28, half * 0.62, 1.5);
  c.fill();
  c.restore();

  // 车顶标记:自己人画颗小星星,敌人画它的脾气
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `${Math.round(s * 0.34)}px system-ui`;
  if (tk.side === "player") {
    c.fillStyle = "#fff";
    c.fillText(tk.player === 0 ? "🌸" : "⭐", px, py);
  } else {
    c.fillText(KIND_FACE[tk.kind] ?? "🚜", px, py);
  }

  if (tk.armorMax > 1 && tk.armor < tk.armorMax) {
    // 装甲车挨过一发:冒一小股烟
    c.fillStyle = "rgba(230,230,240,.8)";
    c.beginPath();
    c.arc(px + half * 0.6, py - half * 0.7, s * 0.12, 0, Math.PI * 2);
    c.fill();
  }
  if (tk.shield > 0) {
    c.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 12) * 0.25})`;
    c.lineWidth = Math.max(1.5, s * 0.07);
    c.beginPath();
    c.arc(px, py, half * 1.15, 0, Math.PI * 2);
    c.stroke();
  }
  if (tk.spin > 0) {
    c.fillStyle = "#ffd166";
    c.font = `${Math.round(s * 0.4)}px system-ui`;
    c.fillText("💫", px, py - s * 0.5);
  }
}

function drawWorld(c: CanvasRenderingContext2D, w: World, s: number, t: number): void {
  const map = w.map;
  c.clearRect(0, 0, map.w * s, map.h * s);
  c.fillStyle = "#6b675e";
  c.fillRect(0, 0, map.w * s, map.h * s);

  // 地面 + 除草丛以外的地形
  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      const i = cy * map.w + cx;
      const tile = map.tiles[i];
      const x = cx * s;
      const y = cy * s;
      if (tile !== "~") {
        c.fillStyle = (cx + cy) % 2 === 0 ? "#75705f" : "#6d6959";
        c.fillRect(x, y, s, s);
      }
      if (tile === "#") {
        drawBrick(c, x, y, s, map.brickHp[i]);
        if (isFortBrick(map, cx, cy)) {
          c.strokeStyle = "rgba(255,208,90,.75)";
          c.lineWidth = 1.5;
          c.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
        }
      } else if (tile === "S") {
        drawSteel(c, x, y, s);
      } else if (tile === "~") {
        drawWater(c, x, y, s, t);
      } else if (tile === "B") {
        drawBase(c, x, y, s, w.baseShield, t);
      }
    }
  }

  for (const b of w.bullets) {
    c.fillStyle = b.side === "player" ? "#fff3c4" : "#ffd0d0";
    c.beginPath();
    c.arc(b.x * s, b.y * s, Math.max(2, s * 0.1), 0, Math.PI * 2);
    c.fill();
  }

  for (const tk of w.tanks) drawTank(c, tk, s, t);

  // 草丛画在坦克上面:开进去就看不见了
  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      if (map.tiles[cy * map.w + cx] === "*") drawGrass(c, cx * s, cy * s, s);
    }
  }

  for (const e of w.effects) {
    const k = 1 - e.t / e.life;
    c.globalAlpha = Math.max(0, Math.min(1, k));
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `${Math.round(s * (e.kind === "flower" ? 0.7 : 0.45))}px system-ui`;
    const face =
      e.kind === "flower" ? "🌼" : e.kind === "smoke" ? "💨" : e.kind === "shield" ? "✨" : e.kind === "crumb" ? "🧱" : "✳️";
    c.fillText(face, e.x * s, e.y * s - (1 - k) * s * 0.3);
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// 一局的运行器:画布 + HUD + 键盘 + 触屏摇杆 + 暂停
// ---------------------------------------------------------------------------

interface RunOptions {
  world: World;
  players: 1 | 2;
  hint: string;
  /** 顶部想额外显示的信息(无尽的波次等) */
  extraChips?: () => string[];
  onEnd: (w: World) => void;
  /** 无尽模式:一波清完了要补下一波 */
  onWaveClear?: (w: World) => void;
}

interface Runner {
  destroy: () => void;
}

function mountRun(host: HTMLElement, sfx: (n: SoundName) => void, opts: RunOptions): Runner {
  const w = opts.world;
  const wrap = document.createElement("div");
  wrap.className = "tb-wrap";

  const hud = document.createElement("div");
  hud.className = "tb-hud";
  const board = document.createElement("div");
  board.className = "tb-board";
  const canvas = document.createElement("canvas");
  canvas.className = "tb-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "铁皮坦克战场");
  board.appendChild(canvas);
  const tip = document.createElement("div");
  tip.className = "tb-tip";
  tip.textContent = opts.hint;
  const acts = document.createElement("div");
  acts.className = "tb-acts";
  const pads = document.createElement("div");
  pads.className = "tb-pads";
  wrap.append(hud, board, tip, acts, pads);
  host.appendChild(wrap);

  const held = new Set<string>();
  const tapped = new Set<string>();
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let cell = 26;

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "tb-act";
  pauseBtn.textContent = "⏸️ 暂停 (Esc)";
  acts.appendChild(pauseBtn);

  function layout(): void {
    const availW = Math.max(220, (host.clientWidth || 340) - 8);
    const availH = Math.max(220, Math.min(430, (globalThis.innerHeight || 700) - 300));
    cell = Math.max(16, Math.floor(Math.min(availW / MAP_W, availH / MAP_H, 34)));
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(MAP_W * cell * dpr);
    canvas.height = Math.round(MAP_H * cell * dpr);
    canvas.style.width = `${MAP_W * cell}px`;
    canvas.style.height = `${MAP_H * cell}px`;
    const c = canvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function refreshHud(): void {
    const left = w.queue.length + aliveEnemies(w).length;
    const gaps = fortGaps(w).length;
    const chips: string[] = [];
    if (w.mode === "versus") {
      chips.push(`🌸 朵朵 ${w.scores[0]}`, `⭐ 星星 ${w.scores[1]}`, `🎯 先弹飞 ${w.target} 次赢`);
    } else {
      chips.push(`🚜 还剩 ${left} 辆`, `🌼 已变花 ${w.defeated}`);
      if (w.map.base) chips.push(w.baseShield ? "🛡️ 护罩还在" : "⚠️ 护罩没了");
      if (gaps > 0) chips.push(`🧱 护墙缺 ${gaps} 块`);
    }
    chips.push(`⏱️ ${Math.max(0, Math.ceil(w.limit - w.time))} 秒`);
    for (const tk of w.tanks) {
      if (tk.side !== "player") continue;
      chips.push(`${tk.player === 0 ? "🌸" : "⭐"} 砖 ${tk.bricks}`);
    }
    for (const extra of opts.extraChips?.() ?? []) chips.push(extra);
    hud.innerHTML = "";
    for (const [i, text] of chips.entries()) {
      const el = document.createElement("span");
      const warn = text.includes("⚠️") || text.includes("护墙缺");
      el.className = `tb-chip${warn ? " tb-chip-warn" : ""}`;
      el.textContent = text;
      el.setAttribute("aria-live", i === 0 ? "polite" : "off");
      hud.appendChild(el);
    }
  }

  function inputFor(player: number): PlayerInput {
    let dir: Dir | -1 = -1;
    for (const action of ["up", "right", "down", "left"] as const) {
      if (held.has(`${player}:${action}`)) dir = ACTION_DIR[action];
    }
    return {
      dir,
      fire: held.has(`${player}:fire`) || tapped.has(`${player}:fire`),
      brick: tapped.has(`${player}:brick`),
    };
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused && !finished) {
      clock += dt;
      const before = { defeated: w.defeated, bounced: w.bounced, shield: w.baseShield };
      stepWorld(w, dt, [inputFor(0), inputFor(1)]);
      tapped.clear();
      if (w.defeated > before.defeated) sfx("coin");
      if (w.bounced > before.bounced) sfx("oops");
      if (before.shield && !w.baseShield) sfx("oops");
      if (w.status !== "playing") {
        finished = true;
        window.setTimeout(() => opts.onEnd(w), 260);
      } else if (opts.onWaveClear && w.queue.length === 0 && aliveEnemies(w).length === 0) {
        opts.onWaveClear(w);
      }
      refreshHud();
    }
    const c = canvas.getContext("2d");
    if (c) drawWorld(c, w, cell, clock);
  }

  // ---- 键盘 ---------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent): void {
    if (e.code === PAUSE_KEY) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    if (bind.player >= opts.players) return;
    e.preventDefault();
    if (bind.action === "brick") {
      tapped.add(`${bind.player}:brick`);
      sfx("tap");
      return;
    }
    if (bind.action === "fire" && !held.has(`${bind.player}:fire`)) sfx("pop");
    held.add(`${bind.player}:${bind.action}`);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    held.delete(`${bind.player}:${bind.action}`);
  }

  function onBlur(): void {
    held.clear();
  }

  // ---- 触屏摇杆(和键盘完全等价) ------------------------------------------
  function bindHold(btn: HTMLButtonElement, key: string): void {
    const on = (e: Event): void => {
      e.preventDefault();
      held.add(key);
    };
    const off = (): void => {
      held.delete(key);
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        held.add(key);
      }
    });
    btn.addEventListener("keyup", off);
    btn.addEventListener("blur", off);
  }

  function makePad(player: 0 | 1): HTMLElement {
    const box = document.createElement("div");
    box.className = "tb-pad";
    const name = document.createElement("div");
    name.className = "tb-pad-t";
    name.style.color = P_COLOR[player];
    name.textContent = `${player === 0 ? "🌸" : "⭐"} ${P_NAME[player]} · ${P_KEYS[player]}`;
    const grid = document.createElement("div");
    grid.className = "tb-dpad";
    const cells: Array<{ label: string; action: "up" | "down" | "left" | "right" | "" }> = [
      { label: "", action: "" },
      { label: "▲", action: "up" },
      { label: "", action: "" },
      { label: "◀", action: "left" },
      { label: "", action: "" },
      { label: "▶", action: "right" },
      { label: "", action: "" },
      { label: "▼", action: "down" },
      { label: "", action: "" },
    ];
    for (const item of cells) {
      if (!item.action) {
        const gap = document.createElement("span");
        grid.appendChild(gap);
        continue;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tb-btn";
      b.textContent = item.label;
      b.setAttribute("aria-label", `${P_NAME[player]}向${dirWord(item.action)}开`);
      bindHold(b, `${player}:${item.action}`);
      grid.appendChild(b);
    }
    const row = document.createElement("div");
    row.className = "tb-padacts";
    const fireBtn = document.createElement("button");
    fireBtn.type = "button";
    fireBtn.className = "tb-btn tb-btn-fire";
    fireBtn.textContent = "💥 开炮";
    fireBtn.setAttribute("aria-label", `${P_NAME[player]}开炮`);
    bindHold(fireBtn, `${player}:fire`);
    const brickBtn = document.createElement("button");
    brickBtn.type = "button";
    brickBtn.className = "tb-btn tb-btn-brick";
    brickBtn.textContent = "🧱 补墙";
    brickBtn.setAttribute("aria-label", `${P_NAME[player]}在车头前面补一块砖`);
    brickBtn.addEventListener("click", () => {
      tapped.add(`${player}:brick`);
      sfx("tap");
    });
    row.append(fireBtn, brickBtn);
    box.append(name, grid, row);
    return box;
  }

  function dirWord(a: string): string {
    return a === "up" ? "上" : a === "down" ? "下" : a === "left" ? "左" : "右";
  }

  for (let p = 0; p < opts.players; p++) pads.appendChild(makePad(p as 0 | 1));

  function setPaused(next: boolean): void {
    if (finished) return;
    paused = next;
    held.clear();
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    const old = board.querySelector(".tb-over");
    old?.remove();
    if (paused) {
      const ov = document.createElement("div");
      ov.className = "tb-over";
      ov.innerHTML = `<div class="tb-over-t">⏸️ 先歇一会儿</div>
        <div class="tb-over-s">按 Esc 或点「继续」回到战场。<br>朵朵:WASD 走、F 开炮、G 补墙。<br>星星:方向键走、L 开炮、K 补墙。</div>`;
      board.appendChild(ov);
    }
  }

  pauseBtn.addEventListener("click", () => {
    sfx("tap");
    setPaused(!paused);
  });

  const onResize = (): void => layout();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);

  layout();
  refreshHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      held.clear();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 188 关战役
// ---------------------------------------------------------------------------

function makePlayLevel(getPlayers: () => 1 | 2) {
  return function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const players = getPlayers();
    const lv = buildLevel(ctx.level);
    const ci = chapterIndexOf(ctx.level);
    const world = createWorld({
      rows: lv.rows,
      mode: players === 2 ? "coop" : "campaign",
      queue: lv.waves,
      limit: lv.limit,
      players,
      seed: 1000 + ctx.level,
      ...scaleForPlayers(lv, players),
    });
    let runner: Runner | null = null;
    runner = mountRun(stage, ctx.sfx, {
      world,
      players,
      hint: `${CHAPTER_NEW[ci] ?? ""} 一共 ${lv.waves.length} 辆铁皮车,守住底下的星星堡垒。`,
      onEnd(w) {
        if (w.status === "win") {
          ctx.win(rateRun(w.time, w.limit, w.bounced), winLine(rateRun(w.time, w.limit, w.bounced), w.defeated, w.bounced));
        } else {
          ctx.lose(loseLine(w.reason, w.defeated));
        }
      },
    });
    return {
      destroy() {
        runner?.destroy();
        runner = null;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// 无尽敌潮
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const box = document.createElement("div");
  box.className = "tb-mode";
  const head = document.createElement("div");
  head.className = "tb-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "tb-back";
  backBtn.textContent = "← 回选关";
  const title = document.createElement("span");
  title.className = "tb-chip";
  title.textContent = "♾️ 无尽敌潮 · 一波比一波多";
  head.append(backBtn, title);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);

  const rand = mulberry32(Date.now() % 100000);
  const world = createWorld({
    rows: endlessRows(),
    mode: "endless",
    queue: endlessWave(1, rand),
    maxAlive: endlessMaxAlive(1),
    limit: 99999,
    players: 2,
    bricks: 6,
  });
  world.wave = 1;

  let runner: Runner | null = null;
  let over = false;

  function finish(w: World): void {
    if (over) return;
    over = true;
    const best = save.recordEndlessBest(meta.id, w.wave);
    runner?.destroy();
    runner = null;
    const ov = document.createElement("div");
    ov.className = "tb-mode";
    ov.innerHTML = `<div class="tb-over-t">🌼 第 ${w.wave} 波结束</div>
      <div class="tb-over-s">这一轮清掉 ${w.defeated} 辆铁皮车,拿到 ${w.score} 分。<br>
      历史最好成绩:第 ${best} 波。下次记得先补护墙再出门。</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "tb-open";
    again.textContent = "🔁 再来一轮";
    again.addEventListener("click", () => {
      api.play("tap");
      box.remove();
      mountEndless(host, api, back);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "tb-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "tb-acts";
    row.append(again, home);
    ov.appendChild(row);
    stage.appendChild(ov);
  }

  runner = mountRun(stage, (n) => api.play(n), {
    world,
    players: 2,
    hint: "堡垒被砸中这一轮就结束。两个人分头守,别都挤在一边。",
    extraChips: () => [`🌊 第 ${world.wave} 波`, `🏅 ${world.score} 分`],
    onEnd: finish,
    onWaveClear(w) {
      w.wave += 1;
      w.queue = endlessWave(w.wave, rand);
      w.maxAlive = endlessMaxAlive(w.wave);
      w.spawnTimer = 1.2;
      api.play("win");
      for (const tk of w.tanks) {
        if (tk.side === "player") tk.bricks += 1;
      }
    },
  });

  backBtn.addEventListener("click", () => {
    api.play("tap");
    back();
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const box = document.createElement("div");
  box.className = "tb-mode";
  const head = document.createElement("div");
  head.className = "tb-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "tb-back";
  backBtn.textContent = "← 回选关";
  const title = document.createElement("span");
  title.className = "tb-chip";
  title.textContent = "⚔️ 双人对战 · 先弹飞对方 3 次";
  head.append(backBtn, title);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);

  const world = createWorld({
    rows: versusRows(),
    mode: "versus",
    players: 2,
    limit: 120,
    target: 3,
    bricks: 5,
  });

  let runner: Runner | null = null;
  let over = false;

  function finish(w: World): void {
    if (over) return;
    over = true;
    runner?.destroy();
    runner = null;
    const who = w.winner < 0 ? "两个人打成平手" : `${P_NAME[w.winner]}赢啦`;
    const ov = document.createElement("div");
    ov.className = "tb-mode";
    ov.innerHTML = `<div class="tb-over-t">🎉 ${who}</div>
      <div class="tb-over-s">朵朵 ${w.scores[0]} : ${w.scores[1]} 星星。<br>
      被弹飞不疼,转两圈就能接着开。下一局换个方向包抄试试。</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "tb-open tb-open-vs";
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      box.remove();
      mountVersus(host, api, back);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "tb-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "tb-acts";
    row.append(again, home);
    ov.appendChild(row);
    stage.appendChild(ov);
  }

  runner = mountRun(stage, (n) => api.play(n), {
    world,
    players: 2,
    hint: "地图左右对称,谁都不吃亏。躲在钢墙后面等对方露头最划算。",
    onEnd: finish,
  });

  backBtn.addEventListener("click", () => {
    api.play("tap");
    back();
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "tb-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let players: 1 | 2 = 1;

  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "tb-open";
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "tb-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "tb-open tb-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  bar.append(coopBtn, endlessBtn, vsBtn);

  function refreshBar(): void {
    coopBtn.textContent = players === 2 ? "👫 双人合作:开(点我关)" : "👤 单人闯关(点我拉星星一起)";
    coopBtn.setAttribute("aria-pressed", players === 2 ? "true" : "false");
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽敌潮 · 最好 第 ${best} 波` : "♾️ 无尽敌潮 · 点我开始!";
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  coopBtn.addEventListener("click", () => {
    api.play("tap");
    players = players === 2 ? 1 : 2;
    refreshBar();
  });
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: makePlayLevel(() => players),
      mapHint: "先补上堡垒周围的砖再出门;钢墙打不动,拿它当盾牌用。",
      grandMessage: "188 关全部守住,星星堡垒一次都没被砸中,你就是铁皮战场的总指挥!",
      guide,
      guideTitle: "铁皮坦克大战 · 阵地手记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}

/** 给首页玩法说明用:这一款到底有哪几种玩法 */
export const MODE_LABELS: readonly string[] = ["188 关战役", "双人合作", "双人对战", "无尽敌潮"];

/** 评一评无尽成绩(波次越高越好),给结算面板用 */
export function rateEndless(wave: number): 1 | 2 | 3 {
  return rateBelow(-wave, -8, -4);
}
