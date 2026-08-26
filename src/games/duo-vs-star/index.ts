import { meta } from "./meta";
export { meta };

/**
 * 朵朵大战星星 —— 全明星弹飞式派对混战。
 *
 * 五种模式共用同一个「擂台」组件：canvas 画场地、键盘 / 触屏出招、
 * 逻辑全部交给 battle.ts 的确定性状态机。
 *  · 双人对战：同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K
 *  · 人机混战：最多 4 人，小电脑三档
 *  · 团队赛：2v2，和队友一起把对面请出场
 *  · 无尽车轮战：赢一场换一个更强的对手
 *  · 闯关 188 关：走 level99 通用框架，十个主题章节
 */
import { AI_TIERS, emptyInput, type AiTier, type Input } from "./ai";
import { isPauseKey, isWatchedKey, readKeys } from "./keys";
import {
  ACTOR_R,
  createMatch,
  safeZone,
  stepMatch,
  teamStats,
  type Actor,
  type FighterSlot,
  type MatchConfig,
  type MatchState,
} from "./battle";
import { bumpLabel, bumpTier, BUMP_MAX } from "./knockback";
import { itemById } from "./items";
import {
  CHAPTERS,
  LEVELS,
  endlessBonusStars,
  endlessFoe,
  endlessStage,
  levelAt,
  rateLevel,
} from "./levels";
import { ROSTER, TEAM_COLORS, TEAM_NAMES, fighterById } from "./roster";
import { STAGES, WORLD_H, WORLD_W, platformAt, stageById, syrupLevel } from "./stages";
import GUIDE from "./guide";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function reduceMotion(): boolean {
  try {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

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

function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** 玩家这一局挑的角色（换了之后本次进入游戏一直记着） */
let pickP1 = "duoduo";
let pickP2 = "xingxing";

/* ------------------------------------------------------------------ */
/* 样式                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.dvs-wrap{max-width:720px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  user-select:none;-webkit-user-select:none;position:relative;}
.dvs-menu{border-radius:20px;padding:14px;background:linear-gradient(180deg,#fff2f8,#eef2ff);}
.dvs-title{text-align:center;font-size:19px;font-weight:900;color:#b0538c;margin:2px 0 4px;}
.dvs-sub{text-align:center;font-size:13.5px;font-weight:700;color:#7b6aa0;line-height:1.6;margin:0 0 10px;}
.dvs-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;}
.dvs-mode{border:none;border-radius:16px;padding:13px 10px;cursor:pointer;font-family:inherit;text-align:left;
  background:#fff;box-shadow:0 4px 10px rgba(150,120,190,.18);}
.dvs-mode:active{transform:translateY(2px);}
.dvs-mode b{display:block;font-size:15.5px;color:#6b4a94;margin-bottom:3px;}
.dvs-mode span{display:block;font-size:12.5px;color:#8a7aa6;line-height:1.5;}
.dvs-keys{margin-top:12px;border-radius:14px;background:#ffffffcc;padding:10px 12px;font-size:12.5px;
  color:#7b6aa0;font-weight:700;line-height:1.8;}
.dvs-keys b{color:#b0538c;}
.dvs-pickrow{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0 2px;}
.dvs-pick{border:none;border-radius:999px;padding:6px 11px;font-size:13px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#6b5a90;box-shadow:0 2px 5px rgba(140,120,190,.2);}
.dvs-pick.on{outline:3px solid #ff9ec4;color:#b0538c;}
.dvs-picklabel{text-align:center;font-size:12.5px;font-weight:800;color:#8a7aa6;margin-top:8px;}
.dvs-tierrow{display:flex;gap:6px;justify-content:center;margin:4px 0;flex-wrap:wrap;}
.dvs-go{display:block;width:100%;margin-top:12px;border:none;border-radius:18px;padding:13px;font-size:17px;
  font-weight:900;color:#fff;cursor:pointer;font-family:inherit;
  background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 5px 0 #8f2c5c;}
.dvs-go:active{transform:translateY(3px);box-shadow:0 2px 0 #8f2c5c;}
.dvs-back{border:none;border-radius:999px;padding:7px 13px;font-size:13.5px;font-weight:900;cursor:pointer;
  background:#ffffffd9;color:#7a5aa0;box-shadow:0 3px 0 rgba(120,90,160,.25);font-family:inherit;white-space:nowrap;}
.dvs-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}

.dvs-arena{border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(150,130,200,.18);}
.dvs-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#ffe8f2;flex-wrap:wrap;}
.dvs-bartitle{flex:1;text-align:center;font-size:14px;font-weight:900;color:#5c4a7d;min-width:110px;}
.dvs-canvas{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#dff0ff;touch-action:none;}
.dvs-cards{display:flex;gap:6px;padding:8px;flex-wrap:wrap;justify-content:center;}
.dvs-card{flex:1 1 120px;min-width:112px;border-radius:14px;padding:7px 9px;background:#fff;
  box-shadow:0 2px 7px rgba(140,120,190,.2);}
.dvs-card-head{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:900;color:#5c4a7d;}
.dvs-card-head .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;}
.dvs-card-head .who{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dvs-meter{height:8px;border-radius:99px;background:#eee6f5;overflow:hidden;margin:5px 0 3px;}
.dvs-meter i{display:block;height:100%;width:0;border-radius:99px;background:#8fd6a4;transition:width .12s linear;}
.dvs-card-foot{display:flex;justify-content:space-between;font-size:11.5px;font-weight:800;color:#8a7aa6;}
.dvs-hint{text-align:center;font-size:12.5px;font-weight:700;color:#8a7aa6;padding:0 8px 8px;min-height:18px;}

.dvs-pads{display:flex;justify-content:space-between;gap:8px;padding:0 8px 10px;}
.dvs-pad{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.dvs-pad button{border:none;border-radius:14px;min-width:46px;min-height:46px;font-size:18px;font-weight:900;
  font-family:inherit;background:#ffffffe6;color:#6b5a90;box-shadow:0 3px 0 rgba(120,90,160,.22);cursor:pointer;
  touch-action:none;}
.dvs-pad button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.22);}
.dvs-pad .hit{background:#ffd9e8;color:#b0538c;}
.dvs-pad .big{background:#ffc7dd;color:#95356d;}
.dvs-padname{font-size:11.5px;font-weight:900;color:#8a7aa6;width:100%;text-align:center;}

.dvs-over{position:absolute;inset:0;background:rgba(255,250,253,.95);border-radius:20px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;text-align:center;padding:18px;}
.dvs-over .big{font-size:46px;line-height:1;}
.dvs-over .ttl{font-size:21px;font-weight:900;color:#8a5aa8;}
.dvs-over .sub{font-size:14.5px;font-weight:700;color:#77619b;line-height:1.6;max-width:330px;}
.dvs-over .row{display:flex;gap:9px;flex-wrap:wrap;justify-content:center;}
.dvs-over button{border:none;border-radius:16px;padding:11px 22px;font-size:15.5px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 4px 0 #8f2c5c;}
.dvs-over button.ghost{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a;}
.dvs-over button:active{transform:translateY(2px);}
.dvs-hidden{display:none;}
@media (max-width:420px){
  .dvs-title{font-size:17px;}
  .dvs-card{min-width:96px;padding:6px;}
  .dvs-pad button{min-width:42px;min-height:42px;font-size:16px;}
}
@media (prefers-reduced-motion:reduce){
  .dvs-meter i{transition:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 擂台组件                                                            */
/* ------------------------------------------------------------------ */

interface ArenaOptions {
  config: MatchConfig;
  /** 顶部标题 */
  title: string;
  /** 底部一句话提示 */
  hint?: string;
  /** 玩家操作的槽位：{ p1: 0 } / { p1: 0, p2: 1 } */
  human: { p1?: number; p2?: number };
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  /** 一局结束（含胜负）时回调 */
  onEnd: (state: MatchState) => void;
  /** 顶部返回按钮；不给就不显示 */
  onExit?: () => void;
}

interface Burst {
  x: number;
  y: number;
  t: number;
  text: string;
  color: string;
}

interface Arena {
  root: HTMLElement;
  destroy: () => void;
  pause: () => void;
}

function mountArena(opts: ArenaOptions): Arena {
  const soft = reduceMotion();
  let state = createMatch(opts.config);
  let raf = 0;
  let last = 0;
  let destroyed = false;
  let paused = false;
  let ended = false;
  const bursts: Burst[] = [];
  const timers = new Set<number>();

  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  const root = el("div", "dvs-arena");
  const bar = el("div", "dvs-bar");
  if (opts.onExit) bar.appendChild(button("dvs-back", "◀ 返回", () => opts.onExit?.()));
  const title = el("div", "dvs-bartitle", opts.title);
  bar.appendChild(title);
  bar.appendChild(button("dvs-back", "⏸ 暂停", () => togglePause()));
  root.appendChild(bar);

  const canvas = el("canvas", "dvs-canvas");
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const cards = el("div", "dvs-cards");
  root.appendChild(cards);
  const hint = el("div", "dvs-hint", opts.hint ?? "");
  root.appendChild(hint);

  const cardEls = state.actors.map((a) => {
    const card = el("div", "dvs-card");
    const head = el("div", "dvs-card-head");
    const dot = el("span", "dot");
    dot.style.background = TEAM_COLORS[a.team % TEAM_COLORS.length];
    const who = el("span", "who", `${a.char.emoji} ${a.char.name}`);
    head.append(dot, who);
    const meter = el("div", "dvs-meter");
    const fill = el("i");
    meter.appendChild(fill);
    const foot = el("div", "dvs-card-foot");
    const left = el("span", undefined, "");
    const right = el("span", undefined, "");
    foot.append(left, right);
    card.append(head, meter, foot);
    cards.appendChild(card);
    return { fill, left, right, who };
  });

  /* ---- 输入 ---- */
  const pressed = new Set<string>();
  const padP1 = emptyInput();
  const padP2 = emptyInput();

  function inputFor(which: "p1" | "p2"): Input {
    return readKeys(pressed, which, which === "p1" ? padP1 : padP2);
  }

  function collectInputs(): Record<number, Input> {
    const out: Record<number, Input> = {};
    if (opts.human.p1 !== undefined) out[opts.human.p1] = inputFor("p1");
    if (opts.human.p2 !== undefined) out[opts.human.p2] = inputFor("p2");
    return out;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (isPauseKey(e.key)) {
      // 接住 Esc 并 preventDefault：壳层看到就不会再弹一次它自己的暂停面板
      e.preventDefault();
      togglePause();
      return;
    }
    if (!isWatchedKey(e.code)) return;
    // 方向键会滚动页面，空格键会点到按钮，这里统统拦下来
    e.preventDefault();
    pressed.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (isWatchedKey(e.code)) pressed.delete(e.code);
  }
  function onBlur(): void {
    pressed.clear();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  /* ---- 触屏按键 ---- */
  const pads = el("div", "dvs-pads");
  root.appendChild(pads);

  function makePad(which: "p1" | "p2", name: string): HTMLElement {
    const pad = el("div", "dvs-pad");
    const label = el("div", "dvs-padname", name);
    pad.appendChild(label);
    const target = which === "p1" ? padP1 : padP2;
    const keys: Array<[string, keyof Input, string]> = [
      ["◀", "left", ""],
      ["▲", "up", ""],
      ["▶", "right", ""],
      ["✋", "light", "hit"],
      ["💥", "heavy", "big"],
    ];
    for (const [label2, key, extra] of keys) {
      const b = el("button", extra || undefined, label2);
      b.type = "button";
      b.setAttribute(
        "aria-label",
        key === "light" ? `${name} 挥击` : key === "heavy" ? `${name} 重击` : `${name} ${label2}`
      );
      const on = (e: Event): void => {
        e.preventDefault();
        target[key] = true;
      };
      const off = (): void => {
        target[key] = false;
      };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointerleave", off);
      b.addEventListener("pointercancel", off);
      pad.appendChild(b);
    }
    return pad;
  }

  if (opts.human.p1 !== undefined) {
    pads.appendChild(makePad("p1", `${state.actors[opts.human.p1].char.name} 1P`));
  }
  if (opts.human.p2 !== undefined) {
    pads.appendChild(makePad("p2", `${state.actors[opts.human.p2].char.name} 2P`));
  }

  /* ---- 暂停 / 结算浮层 ---- */
  let overlay: HTMLElement | null = null;

  function clearOverlay(): void {
    overlay?.remove();
    overlay = null;
  }

  function showOverlay(
    big: string,
    ttl: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    clearOverlay();
    const ov = el("div", "dvs-over");
    ov.append(el("div", "big", big), el("div", "ttl", ttl), el("div", "sub", sub));
    const row = el("div", "row");
    for (const b of buttons) {
      const btn = button(b.ghost ? "ghost" : "", b.label, b.onClick);
      row.appendChild(btn);
    }
    ov.appendChild(row);
    root.appendChild(ov);
    overlay = ov;
    ov.querySelector("button")?.focus?.();
  }

  function togglePause(): void {
    if (ended || destroyed) return;
    paused = !paused;
    if (paused) {
      opts.sfx("tap");
      showOverlay("⏸️", "先歇一会儿", "喘口气再来！键盘按 Esc 也可以继续。", [
        { label: "继续 ▶", onClick: () => togglePause() },
        { label: "🔁 重来一局", ghost: true, onClick: () => restart() },
        ...(opts.onExit ? [{ label: "🚪 退出", ghost: true, onClick: () => opts.onExit?.() }] : []),
      ]);
    } else {
      clearOverlay();
      last = 0;
    }
  }

  function restart(): void {
    clearOverlay();
    paused = false;
    ended = false;
    bursts.length = 0;
    state = createMatch({ ...opts.config, seed: (opts.config.seed + 1013) >>> 0 });
    last = 0;
    opts.sfx("jump");
  }

  /* ---- 事件转成看得见的反馈 ---- */
  function drainEvents(): void {
    for (const e of state.events) {
      if (e.kind === "hit") {
        bursts.push({ x: e.x, y: e.y, t: 0, text: e.heavy ? "💥" : "✨", color: "#ffb937" });
        opts.sfx(e.heavy ? "pop" : "tap");
      } else if (e.kind === "block") {
        bursts.push({ x: e.x, y: e.y, t: 0, text: "🫧", color: "#7fb2ff" });
      } else if (e.kind === "pop") {
        opts.sfx("oops");
      } else if (e.kind === "ko") {
        const who = state.actors[e.actor];
        bursts.push({ x: e.x, y: e.y, t: 0, text: `${who.char.emoji}💫`, color: "#ff8fbe" });
        opts.sfx("oops");
      } else if (e.kind === "item") {
        const def = itemById(e.item);
        bursts.push({ x: e.x, y: e.y, t: 0, text: def?.emoji ?? "🎁", color: "#8fd6a4" });
        opts.sfx("coin");
      } else if (e.kind === "respawn") {
        opts.sfx("jump");
      } else if (e.kind === "syrup") {
        opts.sfx("meow");
      } else if (e.kind === "end") {
        onMatchEnd();
      }
    }
  }

  function onMatchEnd(): void {
    if (ended) return;
    ended = true;
    later(() => opts.onEnd(state), 700);
  }

  /* ---- HUD ---- */
  function paintCards(): void {
    state.actors.forEach((a, i) => {
      const c = cardEls[i];
      const pct = Math.round((a.bump / BUMP_MAX) * 100);
      c.fill.style.width = `${Math.min(100, pct)}%`;
      const tier = bumpTier(a.bump);
      c.fill.style.background = tier === 0 ? "#8fd6a4" : tier === 1 ? "#ffd166" : "#ff8fbe";
      c.left.textContent = a.retired ? "场边加油中" : `${bumpLabel(a.bump)} ${Math.round(a.bump)}`;
      const chances = a.retired ? "" : "☁️".repeat(Math.min(4, a.stocks));
      c.right.textContent = `${chances}${a.shield > 0 ? " 🫧" : ""}${a.buffs.hammer > 0 ? " 🔨" : ""}`;
    });
  }

  /* ---- 绘制 ---- */
  let cssW = 0;
  let cssH = 0;

  function resize(): void {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, rect.width || 320);
    const h = w * (WORLD_H / WORLD_W);
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function draw(): void {
    if (!ctx) return;
    if (cssW <= 0) resize();
    const scale = (canvas.width / WORLD_W) || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);

    // 屏幕轻微抖动（弱化动效时不抖）
    if (!soft && state.shake > 0.02) {
      const s = state.shake * 6;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const stage = state.stage;
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    sky.addColorStop(0, stage.sky[0]);
    sky.addColorStop(1, stage.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(-30, -30, WORLD_W + 60, WORLD_H + 60);

    // 咕嘟糖浆池
    const syrup = syrupLevel(stage, state.t);
    if (Number.isFinite(syrup)) {
      ctx.fillStyle = "#ffcf8f";
      ctx.fillRect(-30, syrup, WORLD_W + 60, WORLD_H + 60 - syrup);
      ctx.fillStyle = "#ffe1b5";
      for (let x = -20; x < WORLD_W + 30; x += 46) {
        ctx.beginPath();
        ctx.arc(x + Math.sin(state.t * 1.6 + x) * 6, syrup, 13, Math.PI, 0);
        ctx.fill();
      }
    }

    // 平台
    stage.platforms.forEach((p, i) => {
      const st = state.plats[i];
      if (st.hidden) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, st.x, st.y, p.w, p.h, 8);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
      const wobble = p.collapse ? Math.max(0, st.standT / p.collapse) : 0;
      ctx.save();
      if (wobble > 0.5 && !soft) ctx.translate(Math.sin(state.t * 30) * wobble * 2, 0);
      ctx.fillStyle = p.color ?? "#ffe3f0";
      roundRect(ctx, st.x, st.y, p.w, p.h, Math.min(10, p.h / 2));
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (p.drift) {
        ctx.fillStyle = "rgba(120,120,190,.35)";
        ctx.font = "bold 13px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const arrow = p.drift > 0 ? "▶▶▶" : "◀◀◀";
        ctx.fillText(arrow, st.x + p.w / 2, st.y + p.h / 2);
      }
      if (p.bounce) {
        ctx.strokeStyle = "rgba(210,90,150,.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = st.x + 8; x < st.x + p.w - 6; x += 12) {
          ctx.moveTo(x, st.y + p.h - 3);
          ctx.lineTo(x + 6, st.y + 3);
        }
        ctx.stroke();
      }
      if (p.ice) {
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fillRect(st.x + 6, st.y + 2, p.w - 12, 2);
      }
      ctx.restore();
    });

    // 道具
    ctx.font = "26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const it of state.items) {
      const bob = soft ? 0 : Math.sin(state.t * 5 + it.id) * 3;
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(it.x, it.y + bob, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(it.def.emoji, it.x, it.y + bob + 1);
    }

    // 角色
    for (const a of state.actors) {
      if (!a.onStage) {
        if (!a.retired) drawWaiting(ctx, a);
        continue;
      }
      drawActor(ctx, a);
    }

    // 特效
    for (const b of bursts) {
      const k = 1 - b.t / 0.7;
      if (k <= 0) continue;
      ctx.globalAlpha = k;
      ctx.font = `${Math.round(22 + (1 - k) * 14)}px system-ui`;
      ctx.fillText(b.text, b.x, b.y - (1 - k) * 26);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawWaiting(c: CanvasRenderingContext2D, a: Actor): void {
    const zone = safeZone(state.stage);
    const x = (zone.min + zone.max) / 2;
    const y = 60;
    c.font = "22px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "rgba(255,255,255,.9)";
    c.beginPath();
    c.arc(x, y, 22, 0, Math.PI * 2);
    c.fill();
    c.fillText("☁️", x, y + 2);
    c.font = "bold 13px system-ui";
    c.fillStyle = "#7b6aa0";
    c.fillText(`${a.char.name} 马上回来`, x, y + 32);
  }

  function drawActor(c: CanvasRenderingContext2D, a: Actor): void {
    const r = a.buffs.mini > 0 ? ACTOR_R * 0.7 : ACTOR_R;
    c.save();
    if (a.safe > 0 && !soft && Math.floor(state.t * 10) % 2 === 0) c.globalAlpha = 0.55;
    else if (a.safe > 0 && soft) c.globalAlpha = 0.7;

    // 队伍光圈
    c.fillStyle = TEAM_COLORS[a.team % TEAM_COLORS.length];
    c.beginPath();
    c.arc(a.x, a.y, r + 4, 0, Math.PI * 2);
    c.fill();
    // 身体
    c.fillStyle = a.char.color;
    c.beginPath();
    c.arc(a.x, a.y, r, 0, Math.PI * 2);
    c.fill();
    // 脸
    c.font = `${Math.round(r * 1.25)}px system-ui`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(a.buffs.dizzy > 0 ? "💫" : a.char.emoji, a.x, a.y + 1);

    // 挥击的小手
    if (a.attack) {
      const heavy = a.attack.kind === "heavy";
      c.fillStyle = heavy ? "rgba(255,150,190,.75)" : "rgba(255,220,140,.8)";
      c.beginPath();
      c.arc(a.x + a.facing * (r + 16), a.y, heavy ? 17 : 12, 0, Math.PI * 2);
      c.fill();
    }
    // 护盾泡泡
    if (a.shield > 0) {
      c.strokeStyle = "rgba(130,190,255,.85)";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(a.x, a.y, r + 9, 0, Math.PI * 2);
      c.stroke();
    }
    // 击退值
    const tier = bumpTier(a.bump);
    c.font = "bold 13px system-ui";
    c.fillStyle = tier === 0 ? "#4b7a5c" : tier === 1 ? "#9a7020" : "#c2497e";
    c.fillText(`${Math.round(a.bump)}`, a.x, a.y - r - 12);
    c.restore();
  }

  /* ---- 主循环 ---- */
  function frame(now: number): void {
    if (destroyed) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!paused && !state.over) {
      stepMatch(state, dt, collectInputs());
      drainEvents();
    }
    for (const b of bursts) b.t += dt;
    while (bursts.length && bursts[0].t > 0.7) bursts.shift();
    paintCards();
    draw();
    raf = requestAnimationFrame(frame);
  }

  const onResize = (): void => resize();
  window.addEventListener("resize", onResize);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    root,
    pause: () => {
      if (!paused) togglePause();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      clearOverlay();
      root.remove();
    },
  };
}

/** 结算浮层：谁赢了 */
function winnerText(state: MatchState): { big: string; ttl: string; sub: string } {
  if (state.winnerTeam === null) {
    return { big: "🤝", ttl: "打成平手！", sub: "两边都很厉害，再来一局分个高下？" };
  }
  const team = state.winnerTeam;
  const members = state.actors.filter((a) => a.team === team);
  const names = members.map((a) => `${a.char.emoji}${a.char.name}`).join(" + ");
  const stats = teamStats(state).find((t) => t.team === team);
  const sub =
    state.endReason === "time"
      ? `时间到，${TEAM_NAMES[team % TEAM_NAMES.length]}的上场机会剩得最多！`
      : `还剩 ${stats?.stocks ?? 0} 次上场机会，撞飞对手 ${stats?.kos ?? 0} 次。`;
  return { big: "🏆", ttl: `${names} 赢啦！`, sub };
}

/* ------------------------------------------------------------------ */
/* 各个模式                                                            */
/* ------------------------------------------------------------------ */

type Sfx = (name: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;

/** 角色选择行 */
function pickerRow(
  label: string,
  current: () => string,
  onPick: (id: string) => void,
  sfx: Sfx
): HTMLElement {
  const box = el("div");
  box.appendChild(el("div", "dvs-picklabel", label));
  const row = el("div", "dvs-pickrow");
  const buttons: HTMLButtonElement[] = [];
  for (const f of ROSTER) {
    const b = button("dvs-pick", `${f.emoji}${f.name}`, () => {
      sfx("tap");
      onPick(f.id);
      refresh();
    });
    b.title = f.tip;
    buttons.push(b);
    row.appendChild(b);
  }
  function refresh(): void {
    buttons.forEach((b, i) => b.classList.toggle("on", ROSTER[i].id === current()));
  }
  refresh();
  box.appendChild(row);
  return box;
}

/** 难度选择行 */
function tierRow(current: () => AiTier, onPick: (t: AiTier) => void, sfx: Sfx): HTMLElement {
  const box = el("div");
  box.appendChild(el("div", "dvs-picklabel", "小电脑的档次"));
  const row = el("div", "dvs-tierrow");
  const tiers: AiTier[] = ["easy", "normal", "hard"];
  const buttons = tiers.map((t) =>
    button("dvs-pick", `${AI_TIERS[t].label}`, () => {
      sfx("tap");
      onPick(t);
      refresh();
    })
  );
  function refresh(): void {
    buttons.forEach((b, i) => b.classList.toggle("on", tiers[i] === current()));
  }
  refresh();
  for (const b of buttons) row.appendChild(b);
  box.appendChild(row);
  return box;
}

/** 场地选择行 */
function stageRow(current: () => string, onPick: (id: string) => void, sfx: Sfx): HTMLElement {
  const box = el("div");
  box.appendChild(el("div", "dvs-picklabel", "挑一张场地"));
  const row = el("div", "dvs-pickrow");
  const buttons = STAGES.map((s) =>
    button("dvs-pick", `${s.emoji}${s.name}`, () => {
      sfx("tap");
      onPick(s.id);
      refresh();
    })
  );
  function refresh(): void {
    buttons.forEach((b, i) => b.classList.toggle("on", STAGES[i].id === current()));
  }
  refresh();
  for (const b of buttons) row.appendChild(b);
  box.appendChild(row);
  return box;
}

/* ------------------------------------------------------------------ */
/* 挂载                                                                */
/* ------------------------------------------------------------------ */

export function mount(api: GameApi): { destroy: () => void } {
  const sfx: Sfx = (name) => api.play(name);
  const wrap = el("div", "dvs-wrap");
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);
  const view = el("div");
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  let arena: Arena | null = null;
  let level: { destroy: () => void } | null = null;
  let destroyed = false;

  function clearView(): void {
    arena?.destroy();
    arena = null;
    level?.destroy();
    level = null;
    view.innerHTML = "";
  }

  /* ---------------- 首屏：模式菜单 ---------------- */

  function showMenu(): void {
    clearView();
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "💥 朵朵大战星星 · 全明星弹飞混战"));
    menu.appendChild(
      el(
        "div",
        "dvs-sub",
        "挨一下不会怎么样，只会让「击退值」越涨越高——值越高被撞飞得越远，把对手送出场地四周的弹飞线就得一分。掉出去的人会坐着小云朵回来，上场机会用完就到场边加油。"
      )
    );

    const modes = el("div", "dvs-modes");
    const list: Array<[string, string, () => void]> = [
      ["👫 双人对战", "同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K", () => showVersus()],
      ["🤖 人机混战", "最多 4 人一起打，小电脑有轻松 / 正常 / 高手三档", () => showBrawl()],
      ["🤝 团队赛 2v2", "你和队友一队，配合把对面两位请出场", () => showTeam()],
      ["♾️ 无尽车轮战", "赢一场换一个更强的对手，看你能连胜几场", () => showEndless()],
      ["🗺️ 闯关 188 关", "十个主题章节，每关有指定场地、对手和特别规则", () => showCampaign()],
    ];
    for (const [name, desc, go] of list) {
      const b = el("button", "dvs-mode");
      b.type = "button";
      b.append(el("b", undefined, name), el("span", undefined, desc));
      b.addEventListener("click", () => {
        sfx("jump");
        go();
      });
      modes.appendChild(b);
    }
    menu.appendChild(modes);

    const keys = el("div", "dvs-keys");
    keys.innerHTML =
      "<b>键盘</b>：朵朵 <b>W A S D</b> 走动 + <b>F</b> 挥击 + <b>G</b> 重击；" +
      "星星 <b>↑ ← ↓ →</b> 走动 + <b>L</b> 挥击 + <b>K</b> 重击；<b>Esc</b> 暂停。<br>" +
      "<b>手机 / 平板</b>：屏幕下方每人一组按键，和键盘完全一样。<br>" +
      "<b>小技巧</b>：轻击攒击退值，等对方的数字变红了再来一记重击，一下就能送出场外。";
    menu.appendChild(keys);
    view.appendChild(menu);
  }

  /* ---------------- 通用：开一局 ---------------- */

  function playMatch(
    config: MatchConfig,
    title: string,
    human: { p1?: number; p2?: number },
    hint: string,
    onDone: (state: MatchState) => void,
    onExit: () => void
  ): void {
    clearView();
    arena = mountArena({
      config,
      title,
      hint,
      human,
      sfx,
      onExit,
      onEnd: (state) => onDone(state),
    });
    view.appendChild(arena.root);
  }

  /** 一局打完后的通用结算浮层（闯关模式不用它，交给 level99） */
  function showResult(
    state: MatchState,
    playerTeam: number,
    onAgain: () => void,
    onBack: () => void
  ): void {
    const w = winnerText(state);
    const won = state.winnerTeam === playerTeam;
    sfx(won ? "win" : "oops");
    const ov = el("div", "dvs-over");
    ov.append(
      el("div", "big", w.big),
      el("div", "ttl", w.ttl),
      el("div", "sub", won ? w.sub : `${w.sub} 下一局换个打法试试！`)
    );
    const row = el("div", "row");
    row.append(
      button("", "🔁 再来一局", () => {
        sfx("tap");
        onAgain();
      }),
      button("ghost", "🚪 换个模式", () => {
        sfx("tap");
        onBack();
      })
    );
    ov.appendChild(row);
    wrap.appendChild(ov);
    ov.querySelector("button")?.focus?.();
    const clean = (): void => ov.remove();
    row.addEventListener("click", clean, { once: true });
  }

  /* ---------------- 双人对战 ---------------- */

  function showVersus(): void {
    clearView();
    let stage = STAGES[0].id;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "👫 双人对战 · 同屏键盘"));
    menu.appendChild(
      el("div", "dvs-sub", "1P 用 W A S D + F / G，2P 用方向键 + L / K，两套键位各按各的，互不打扰。")
    );
    menu.appendChild(pickerRow("1P 选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(pickerRow("2P 选谁（方向键）", () => pickP2, (id) => (pickP2 = id), sfx));
    menu.appendChild(stageRow(() => stage, (id) => (stage = id), sfx));
    menu.appendChild(
      button("dvs-go", "两人就位，开打 ▶", () => {
        sfx("jump");
        startVersus(stage);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startVersus(stageId: string): void {
    const config: MatchConfig = {
      stageId,
      slots: [
        { charId: pickP1, team: 0, control: "p1" },
        { charId: pickP2, team: 1, control: "p2" },
      ],
      stocks: 3,
      timeLimit: 150,
      itemEvery: 6,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `${fighterById(pickP1).name} vs ${fighterById(pickP2).name}`,
      { p1: 0, p2: 1 },
      "每人 3 次上场机会，把对手撞出场外就赢一分！",
      (state) => showResult(state, state.winnerTeam ?? 0, () => startVersus(stageId), showVersus),
      showVersus
    );
  }

  /* ---------------- 人机混战 ---------------- */

  function showBrawl(): void {
    clearView();
    let stage = STAGES[0].id;
    let tier: AiTier = "normal";
    let foes = 1;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "🤖 人机混战 · 最多 4 人"));
    menu.appendChild(el("div", "dvs-sub", "你一个人对上 1～3 台小电脑，谁都可以打谁，最后站住的人赢。"));
    menu.appendChild(pickerRow("你选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(tierRow(() => tier, (t) => (tier = t), sfx));

    const countBox = el("div");
    countBox.appendChild(el("div", "dvs-picklabel", "几台小电脑"));
    const countRow = el("div", "dvs-tierrow");
    const countBtns = [1, 2, 3].map((n) =>
      button("dvs-pick", `${n} 台`, () => {
        sfx("tap");
        foes = n;
        countBtns.forEach((b, i) => b.classList.toggle("on", i + 1 === foes));
      })
    );
    countBtns.forEach((b, i) => b.classList.toggle("on", i + 1 === foes));
    for (const b of countBtns) countRow.appendChild(b);
    countBox.appendChild(countRow);
    menu.appendChild(countBox);

    menu.appendChild(stageRow(() => stage, (id) => (stage = id), sfx));
    menu.appendChild(
      button("dvs-go", "开打 ▶", () => {
        sfx("jump");
        startBrawl(stage, tier, foes);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startBrawl(stageId: string, tier: AiTier, foes: number): void {
    const others = ROSTER.filter((f) => f.id !== pickP1);
    const slots: FighterSlot[] = [{ charId: pickP1, team: 0, control: "p1" }];
    for (let i = 0; i < foes; i++) {
      slots.push({
        charId: others[(i * 4 + 1) % others.length].id,
        team: i + 1,
        control: "ai",
        aiTier: tier,
      });
    }
    const config: MatchConfig = {
      stageId,
      slots,
      stocks: 3,
      timeLimit: 150,
      itemEvery: 5.5,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `混战 · ${AI_TIERS[tier].label}档 ${foes} 台小电脑`,
      { p1: 0 },
      "每个人各打各的，抢到道具就是优势！",
      (state) => showResult(state, 0, () => startBrawl(stageId, tier, foes), showBrawl),
      showBrawl
    );
  }

  /* ---------------- 团队赛 2v2 ---------------- */

  function showTeam(): void {
    clearView();
    let stage = STAGES[0].id;
    let tier: AiTier = "normal";
    let twoHumans = false;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "🤝 团队赛 · 2 对 2"));
    menu.appendChild(
      el("div", "dvs-sub", "两人一队，队友之间打不到彼此。把对面两位的上场机会都用完，这一队就赢了。")
    );
    menu.appendChild(pickerRow("1P 选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));

    const modeBox = el("div");
    modeBox.appendChild(el("div", "dvs-picklabel", "队友是谁来操作"));
    const modeRow = el("div", "dvs-tierrow");
    const modeBtns = [
      button("dvs-pick", "小电脑队友", () => {
        sfx("tap");
        twoHumans = false;
        sync();
      }),
      button("dvs-pick", "2P 一起玩（方向键）", () => {
        sfx("tap");
        twoHumans = true;
        sync();
      }),
    ];
    function sync(): void {
      modeBtns[0].classList.toggle("on", !twoHumans);
      modeBtns[1].classList.toggle("on", twoHumans);
    }
    sync();
    for (const b of modeBtns) modeRow.appendChild(b);
    modeBox.appendChild(modeRow);
    menu.appendChild(modeBox);

    menu.appendChild(pickerRow("队友选谁", () => pickP2, (id) => (pickP2 = id), sfx));
    menu.appendChild(tierRow(() => tier, (t) => (tier = t), sfx));
    menu.appendChild(stageRow(() => stage, (id) => (stage = id), sfx));
    menu.appendChild(
      button("dvs-go", "组队出发 ▶", () => {
        sfx("jump");
        startTeam(stage, tier, twoHumans);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function startTeam(stageId: string, tier: AiTier, twoHumans: boolean): void {
    const used = new Set([pickP1, pickP2]);
    const rest = ROSTER.filter((f) => !used.has(f.id));
    const config: MatchConfig = {
      stageId,
      slots: [
        { charId: pickP1, team: 0, control: "p1" },
        { charId: pickP2, team: 0, control: twoHumans ? "p2" : "ai", aiTier: tier },
        { charId: rest[0].id, team: 1, control: "ai", aiTier: tier },
        { charId: rest[3 % rest.length].id, team: 1, control: "ai", aiTier: tier },
      ],
      stocks: 2,
      timeLimit: 150,
      itemEvery: 5,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `团队赛 · ${TEAM_NAMES[0]} vs ${TEAM_NAMES[1]}`,
      twoHumans ? { p1: 0, p2: 1 } : { p1: 0 },
      "队友之间打不到彼此，放心站在一起夹击！",
      (state) => showResult(state, 0, () => startTeam(stageId, tier, twoHumans), showTeam),
      showTeam
    );
  }

  /* ---------------- 无尽车轮战 ---------------- */

  function showEndless(): void {
    clearView();
    const best = save.getGameProgress(meta.id).endlessBest;
    const menu = el("div", "dvs-menu");
    menu.appendChild(el("div", "dvs-title", "♾️ 无尽车轮战"));
    menu.appendChild(
      el(
        "div",
        "dvs-sub",
        `一位接一位地上，赢一场就换一个更强的对手，场地也跟着换。你只有 1 次上场机会，被撞出去就结束。${
          best > 0 ? `目前最好成绩：连胜 ${best} 场。` : ""
        }`
      )
    );
    menu.appendChild(pickerRow("你选谁（键盘 WASD）", () => pickP1, (id) => (pickP1 = id), sfx));
    menu.appendChild(
      button("dvs-go", "上擂台 ▶", () => {
        sfx("jump");
        runEndless(0);
      })
    );
    const back = el("div", "dvs-pickrow");
    back.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    menu.appendChild(back);
    view.appendChild(menu);
  }

  function runEndless(round: number): void {
    const foe = endlessFoe(round);
    const config: MatchConfig = {
      stageId: endlessStage(round),
      slots: [
        { charId: pickP1, team: 0, control: "p1", stocks: 1 },
        {
          charId: foe.charId,
          team: 1,
          control: "ai",
          aiTier: foe.tier,
          powerBonus: foe.powerBonus,
          stocks: 1,
        },
      ],
      stocks: 1,
      timeLimit: 90,
      itemEvery: 6,
      seed: (Math.random() * 0xffffffff) >>> 0,
    };
    playMatch(
      config,
      `第 ${round + 1} 场 · 对手 ${fighterById(foe.charId).name}（${AI_TIERS[foe.tier].label}）`,
      { p1: 0 },
      round === 0 ? "只有 1 次上场机会，稳一点！" : `已经连胜 ${round} 场，越往后对手越厉害。`,
      (state) => {
        if (state.winnerTeam === 0) {
          sfx("win");
          runEndless(round + 1);
          return;
        }
        const prevBest = save.getGameProgress(meta.id).endlessBest;
        const best = save.recordEndlessBest(meta.id, round);
        // 车轮战奖励：每连胜 2 场给 1 颗小星星，最多 6 颗，别把闯关的星星比下去
        const bonus = endlessBonusStars(round);
        if (bonus > 0) api.addStars(bonus);
        sfx("oops");
        const ov = el("div", "dvs-over");
        ov.append(
          el("div", "big", round >= 5 ? "🎉" : "☁️"),
          el("div", "ttl", `连胜 ${round} 场！`),
          el(
            "div",
            "sub",
            `${
              round > prevBest
                ? `刷新了自己的最好成绩，历史最佳 ${best} 场！`
                : `历史最佳是 ${best} 场，再来一次一定能超过！`
            }${bonus > 0 ? `本轮拿到 ${bonus} 颗小星星。` : ""}`
          )
        );
        const row = el("div", "row");
        row.append(
          button("", "🔁 再来一轮", () => {
            sfx("tap");
            ov.remove();
            runEndless(0);
          }),
          button("ghost", "🚪 换个模式", () => {
            sfx("tap");
            ov.remove();
            showEndless();
          })
        );
        ov.appendChild(row);
        wrap.appendChild(ov);
        ov.querySelector("button")?.focus?.();
      },
      showEndless
    );
  }

  /* ---------------- 闯关 188 关 ---------------- */

  function showCampaign(): void {
    clearView();
    const host = el("div");
    view.appendChild(host);
    const topRow = el("div", "dvs-pickrow");
    topRow.appendChild(button("dvs-back", "◀ 回模式选择", () => showMenu()));
    topRow.appendChild(
      button("dvs-back", `🙋 我用 ${fighterById(pickP1).emoji}${fighterById(pickP1).name}`, () => {
        sfx("tap");
        const i = ROSTER.findIndex((f) => f.id === pickP1);
        pickP1 = ROSTER[(i + 1) % ROSTER.length].id;
        showCampaign();
      })
    );
    host.appendChild(topRow);

    const levelHost = el("div");
    host.appendChild(levelHost);

    level = mountLevelGame(
      { ...api, root: levelHost },
      {
        id: meta.id,
        chapters: CHAPTERS,
        playLevel,
        mapHint: "十张场地、十种花样，越往后的对手越会抓你落地那一下。",
        grandMessage: "188 关全部通关，全明星混战的冠军就是你！",
        guideTitle: GUIDE.title,
        guide: GUIDE,
      }
    );
  }

  function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
    const lv = levelAt(ctx.level);
    const slots: FighterSlot[] = [
      { charId: pickP1, team: 0, control: "p1", stocks: lv.playerStocks },
    ];
    for (const ally of lv.allies) {
      slots.push({
        charId: ally.charId,
        team: 0,
        control: "ai",
        aiTier: ally.tier,
        stocks: ally.stocks ?? lv.playerStocks,
      });
    }
    lv.foes.forEach((foe, i) => {
      slots.push({
        charId: foe.charId,
        team: lv.allies.length > 0 ? 1 : 1 + i,
        control: "ai",
        aiTier: foe.tier,
        powerBonus: foe.powerBonus,
        stocks: foe.stocks,
      });
    });

    const config: MatchConfig = {
      stageId: lv.stageId,
      slots,
      stocks: lv.playerStocks,
      timeLimit: lv.timeLimit,
      itemEvery: lv.itemEvery,
      itemPool: lv.itemPool,
      seed: (ctx.level + 1) * 7919,
    };

    const box = el("div");
    const head = el(
      "div",
      "dvs-hint",
      `${stageById(lv.stageId).emoji} ${stageById(lv.stageId).name} · ${lv.ruleTag}：${lv.rule}`
    );
    box.appendChild(head);
    const a = mountArena({
      config,
      title: `第 ${ctx.level + 1} 关 · ${lv.ruleTag}`,
      hint: `你有 ${lv.playerStocks} 次上场机会，${lv.timeLimit > 0 ? `限时 ${lv.timeLimit} 秒` : "不限时"}。`,
      human: { p1: 0 },
      sfx: (name) => ctx.sfx(name),
      onEnd: (state) => {
        const me = state.actors[0];
        if (state.winnerTeam === 0) {
          ctx.win(rateLevel(me.outs), me.outs === 0 ? "一次都没被撞出去，太稳啦！" : undefined);
        } else {
          ctx.lose("对手站得更稳一点点，换个节奏再来一次！");
        }
      },
    });
    box.appendChild(a.root);
    stage.appendChild(box);
    arena = a;
    return {
      destroy() {
        a.destroy();
        if (arena === a) arena = null;
        box.remove();
      },
    };
  }

  showMenu();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearView();
      wrap.remove();
    },
  };
}
