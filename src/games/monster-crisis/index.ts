import { meta } from "./meta";
export { meta };

// 小怪物危机 1.2 —— 玩家角色亲自上场的动作防守。
//
// 家摆在场地正中间,小怪物从四面八方围上来想把元气罐抱走。
// 你就是场上那个小人:摇杆走位、技能钮出手,每 3 波从三张成长卡里挑一张
// (长手刷 / 快手腕 / 多彩喷 / 吸吸糖 / 护盾泡),越打越顺手。
//
// 被撞到只是「转个圈、晕一下」,小怪物被涂满就「变成小云朵飘走」——
// 全程没有一点伤害描写,守不住也只说下一次怎么办。
//
// 四种玩法:188 关八大章节闯关、无尽波次(每 5 波小 boss、每 10 波换场景)、
// 双人合作(共享波次、各自成长)、一人一半的对战(先失守的那边输)。
//
// 世界怎么动全在 `arena.ts`(纯逻辑、可无头回放);这里只负责画出来、
// 收手指和键盘、把引擎吐出来的事件翻译成 `api.play` 的音效与一句飘字。
import {
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
  chapterOf,
  chapterStart,
  loadStars,
  mountLevelGame,
  saveStar,
} from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import {
  ARENA_H,
  ARENA_W,
  type ArenaEvent,
  type ArenaInput,
  type ArenaResult,
  type ArenaState,
  BEHAVIOR_INFO,
  COOP_WAVES,
  SCENE_COUNT,
  VERSUS_WAVES,
  arenaEndlessWave,
  chooseGrowth,
  createArena,
  createCampaignArena,
  disposeArena,
  stepArena,
  waveLabel,
} from "./arena";
import {
  GROWTH_CARDS,
  type GrowthState,
  growthBadges,
} from "./growth";
import { deviceTier, particleBudget } from "./pool";
import {
  arenaCoopLine,
  arenaEndlessLine,
  arenaLoseLine,
  arenaVersusLine,
  arenaWinLine,
  draftTitle,
} from "./copy";
import { MONSTER_INFO, campaignStars, formatClock } from "./logic";
import { CHAPTERS, LEVELS, TOTAL, buildCoopWave, endlessLevelIndex } from "./levels";
import {
  FAREWELL_TIME,
  type Farewell,
  HERO_SKINS,
  drawBullet,
  drawCrumb,
  drawFarewell,
  drawHero,
  drawHome,
  drawMonster,
  drawParticle,
  drawScenery,
  drawSky,
} from "./art";

/* ------------------------------------------------------------------ */
/* 配色与样式(类名一律 mcr- 前缀,样式只挂在自己这棵树上)                 */
/* ------------------------------------------------------------------ */

/** 双人识别色 = 皮肤表里的身体主色(1.2 的 P_COLOR 数值原样)。 */
const P_COLOR = [HERO_SKINS[0].body, HERO_SKINS[1].body];
const P_NAME = ["朵朵", "星星"];

/** 八套场景皮:无尽每 10 波换一套,闯关按章节取。 */
const SCENE_SKY = ["#fff3f8", "#fff6ec", "#f4fbea", "#eef7ff", "#f2eeff", "#fff0fa", "#eef6f6", "#f8f0ff"];
const SCENE_GROUND = ["#dcefd0", "#ffdfb8", "#d6ecbf", "#cbe4fb", "#dad2f5", "#ffd4ee", "#cfe5e3", "#e4d2ff"];
const SCENE_NAME = [
  "自家小院",
  "彩虹街区",
  "叮咚学校",
  "咕噜游乐园",
  "月光工厂",
  "云朵糖果城",
  "星星电影院",
  "彩虹总部",
];

export const CSS = `
.mcr-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;position:relative;}
.mcr-hud{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;}
.mcr-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:900;color:#5f4e8c;
  box-shadow:0 2px 6px rgba(150,140,180,.22);white-space:nowrap;line-height:1.3;}
.mcr-chip-warn{background:#ffe6f0;color:#b8386e;}
.mcr-chip-p1{color:#b83a6e;}
.mcr-chip-p2{color:#2f5fa8;}
.mcr-hudbtn{border:none;border-radius:999px;min-width:44px;min-height:44px;font-size:18px;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#5f4e8c;box-shadow:0 3px 0 rgba(140,120,190,.3);}
.mcr-hudbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.3);}
.mcr-stage{position:relative;display:flex;justify-content:center;}
.mcr-canvas{display:block;max-width:100%;border-radius:18px;background:#fff6fb;touch-action:none;
  box-shadow:0 3px 12px rgba(160,140,200,.24);}
.mcr-say{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:#ffffffe8;border-radius:999px;
  padding:5px 14px;font-size:14px;font-weight:800;color:#7a4f9c;pointer-events:none;max-width:92%;
  text-align:center;box-shadow:0 2px 8px rgba(150,130,190,.25);}
.mcr-say[hidden]{display:none;}
.mcr-pads{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:96px;}
.mcr-pad{display:flex;align-items:center;gap:10px;}
.mcr-pad-r{flex-direction:row-reverse;}
.mcr-stick{position:relative;width:92px;height:92px;border-radius:50%;background:#f1ecff;
  box-shadow:inset 0 3px 10px rgba(120,100,170,.22);touch-action:none;cursor:pointer;flex:0 0 auto;}
.mcr-knob{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
  background:#fff;box-shadow:0 3px 8px rgba(120,100,170,.35);pointer-events:none;}
.mcr-fire{border:none;border-radius:50%;width:74px;height:74px;min-width:44px;min-height:44px;font-size:28px;
  cursor:pointer;font-family:inherit;color:#a8305f;background:#ffdbe8;box-shadow:0 4px 0 rgba(200,110,150,.45);
  touch-action:none;flex:0 0 auto;}
.mcr-fire:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(200,110,150,.45);}
.mcr-fire-p2{color:#2f5fa8;background:#dbe8ff;box-shadow:0 4px 0 rgba(110,150,200,.45);}
.mcr-fire-p2:active{box-shadow:0 1px 0 rgba(110,150,200,.45);}
.mcr-padname{font-size:14px;font-weight:900;text-align:center;}
.mcr-tip{text-align:center;font-size:14px;font-weight:700;color:#6f6390;line-height:1.5;}
.mcr-layer{position:absolute;inset:0;background:rgba(255,250,253,.96);border-radius:18px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;
  padding:12px;overflow-y:auto;}
.mcr-layer-t{font-size:19px;font-weight:900;color:#6a4fa8;}
.mcr-layer-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.55;max-width:340px;}
.mcr-cards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;max-height:62vh;overflow-y:auto;
  padding:2px;}
.mcr-card{border:none;border-radius:16px;padding:10px 12px;cursor:pointer;font-family:inherit;font-size:14px;background:#fff;
  color:#5b4a7a;box-shadow:0 4px 0 rgba(140,120,190,.3);display:flex;flex-direction:column;align-items:center;
  gap:3px;min-width:132px;min-height:44px;flex:1 1 132px;max-width:190px;}
.mcr-card:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(140,120,190,.3);}
.mcr-card-emoji{font-size:26px;line-height:1.1;}
.mcr-card-name{font-size:16px;font-weight:900;}
.mcr-card-desc{font-size:14px;font-weight:700;color:#7c6f9b;line-height:1.4;}
.mcr-card-lv{font-size:14px;font-weight:800;color:#a08fc0;}
.mcr-btn{border:none;border-radius:999px;padding:11px 20px;font-size:16px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;min-height:44px;background:linear-gradient(180deg,#8f7ae0,#6f57c8);
  box-shadow:0 4px 0 #57429f;}
.mcr-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.mcr-btn-co{background:linear-gradient(180deg,#68c2a0,#48a683);box-shadow:0 4px 0 #35805f;}
.mcr-btn-co:active{box-shadow:0 2px 0 #35805f;}
.mcr-btn-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.mcr-btn-vs:active{box-shadow:0 2px 0 #b04a6c;}
.mcr-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
.mcr-bar[hidden]{display:none;}
.mcr-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.mcr-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.mcr-back{border:none;border-radius:999px;padding:9px 15px;font-size:15px;font-weight:900;cursor:pointer;
  min-height:44px;font-family:inherit;background:#ffffffe0;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.mcr-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.mcr-over{border-radius:16px;background:#fffdfa;padding:16px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.mcr-over-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.mcr-hudbtn:focus-visible,.mcr-fire:focus-visible,.mcr-card:focus-visible,.mcr-btn:focus-visible,
.mcr-back:focus-visible,.mcr-stick:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
/* 手机竖屏 360px:字号一律 ≥14px,摇杆和技能钮的热区一律 ≥44px,谁也不许被挤出屏幕 */
@media (max-width:420px){
  .mcr-wrap{gap:6px;}
  .mcr-chip{font-size:14px;padding:4px 9px;}
  .mcr-hud{gap:4px;}
  .mcr-stick{width:84px;height:84px;}
  .mcr-knob{width:44px;height:44px;margin:-22px 0 0 -22px;}
  .mcr-fire{width:64px;height:64px;font-size:24px;}
  .mcr-pads{min-height:86px;gap:4px;}
  .mcr-pad{gap:6px;}
  .mcr-tip{font-size:14px;line-height:1.4;}
  .mcr-card{min-width:118px;flex:1 1 118px;}
  .mcr-cards{max-height:52vh;}
}
@media (max-height:840px){
  .mcr-pads{position:sticky;bottom:0;z-index:5;padding-top:4px;
    background:linear-gradient(180deg,rgba(255,253,250,0),#fffdfa 16px);}
}
@media (prefers-reduced-motion:reduce){
  .mcr-fire:active,.mcr-btn:active,.mcr-card:active,.mcr-back:active,.mcr-hudbtn:active{transform:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 画布尺寸                                                            */
/* ------------------------------------------------------------------ */

/**
 * 战场画多大:手机竖屏要给底下的摇杆和技能钮留够位置,
 * 所以按屏幕高度切一刀,再按原始长宽比换算宽度(永远不拉变形)。
 */
export function arenaCanvasSize(availW: number, viewportW: number, viewportH: number): { w: number; h: number } {
  const vh = viewportH > 0 ? viewportH : 700;
  const budget = Math.max(150, Math.round(vh * (viewportW >= 700 ? 0.5 : 0.4)));
  const wide = Math.max(220, availW > 0 ? availW : 320);
  const w = Math.min(wide, 720, (budget * ARENA_W) / ARENA_H);
  return { w: Math.round(w), h: Math.round((w * ARENA_H) / ARENA_W) };
}

/* ------------------------------------------------------------------ */
/* 战场视图                                                            */
/* ------------------------------------------------------------------ */

interface ViewOptions {
  state: ArenaState;
  title: string;
  hint: string;
  /** 场景皮下标(闯关按章节,无尽按波数) */
  scene: number;
  sfx: (n: SoundName) => void;
  onDone: (res: ArenaResult) => void;
}

interface ViewHandle {
  destroy: () => void;
}

function createArenaView(host: HTMLElement, opts: ViewOptions): ViewHandle {
  const state = opts.state;
  const doc = host.ownerDocument ?? document;
  const view = doc.defaultView ?? window;
  const players = state.heroes.length;
  const versus = state.mode === "versus";
  const reduced = !!view.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  state.particleCap = particleBudget(
    deviceTier((view.navigator as { hardwareConcurrency?: number } | undefined)?.hardwareConcurrency, view.innerWidth ?? 400),
    reduced
  );

  const wrap = doc.createElement("div");
  wrap.className = "mcr-wrap";

  /* ---- 顶上那一行:波次 / 元气 / 成长图标 ---- */
  const hud = doc.createElement("div");
  hud.className = "mcr-hud";
  const waveChip = doc.createElement("span");
  waveChip.className = "mcr-chip";
  const jarChips: HTMLElement[] = [];
  for (let s = 0; s < state.homes.length; s++) {
    const chip = doc.createElement("span");
    chip.className = "mcr-chip";
    jarChips.push(chip);
  }
  const growthChips: HTMLElement[] = [];
  for (let i = 0; i < players; i++) {
    const chip = doc.createElement("span");
    chip.className = `mcr-chip mcr-chip-p${i + 1}`;
    growthChips.push(chip);
  }
  const pauseBtn = doc.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "mcr-hudbtn";
  pauseBtn.textContent = "⏸";
  pauseBtn.setAttribute("aria-label", "暂停");
  hud.append(waveChip, ...jarChips, ...growthChips, pauseBtn);

  /* ---- 战场 ---- */
  const stage = doc.createElement("div");
  stage.className = "mcr-stage";
  const canvas = doc.createElement("canvas");
  canvas.className = "mcr-canvas";
  canvas.width = ARENA_W * 2;
  canvas.height = ARENA_H * 2;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:家在正中间,小怪物从四面八方围上来`);
  const say = doc.createElement("div");
  say.className = "mcr-say";
  say.hidden = true;
  stage.append(canvas, say);

  /* ---- 摇杆左下、技能钮右下 ---- */
  const pads = doc.createElement("div");
  pads.className = "mcr-pads";
  const tip = doc.createElement("div");
  tip.className = "mcr-tip";
  tip.textContent = opts.hint;

  wrap.append(hud, stage, pads, tip);
  host.appendChild(wrap);

  const c2d = canvas.getContext("2d");

  /* ---------------- 输入 ---------------- */

  const inputs: ArenaInput[] = [];
  for (let i = 0; i < players; i++) inputs.push({ mx: 0, my: 0, fire: false });
  const keyDir: Array<{ up: boolean; down: boolean; left: boolean; right: boolean }> = [
    { up: false, down: false, left: false, right: false },
    { up: false, down: false, left: false, right: false },
  ];
  const keyFire = [false, false];
  const stickDir: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const padFire = [false, false];

  const KEYS: Array<Record<string, "up" | "down" | "left" | "right">> = [
    { w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right" },
    { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  ];
  const FIRE_KEYS = [new Set(["f", "F", " ", "Spacebar"]), new Set(["l", "L", "Enter"])];

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    for (let p = 0; p < 2; p++) {
      const slot = players === 1 ? 0 : p;
      const dir = KEYS[p][e.key];
      if (dir) {
        keyDir[slot][dir] = true;
        e.preventDefault();
        return;
      }
      if (FIRE_KEYS[p].has(e.key)) {
        keyFire[slot] = true;
        e.preventDefault();
        return;
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    for (let p = 0; p < 2; p++) {
      const slot = players === 1 ? 0 : p;
      const dir = KEYS[p][e.key];
      if (dir) keyDir[slot][dir] = false;
      if (FIRE_KEYS[p].has(e.key)) keyFire[slot] = false;
    }
  }

  view.addEventListener("keydown", onKeyDown);
  view.addEventListener("keyup", onKeyUp);

  /**
   * 一套「摇杆 + 技能钮」。单人时摇杆钉在左下角、技能钮钉在右下角(规格第八节);
   * 双人时两人各占一边,自己的摇杆永远在自己那一侧的外角上。
   */
  function buildPad(player: number, split: boolean): void {
    const pad = doc.createElement("div");
    pad.className = `mcr-pad${player === 1 ? " mcr-pad-r" : ""}`;
    const stick = doc.createElement("div");
    stick.className = "mcr-stick";
    stick.setAttribute("role", "button");
    stick.setAttribute("aria-label", `${P_NAME[player]}的摇杆,按住拖着走`);
    stick.tabIndex = 0;
    const knob = doc.createElement("div");
    knob.className = "mcr-knob";
    knob.style.background = player === 1 ? "#e5eeff" : "#fff";
    stick.appendChild(knob);

    const fire = doc.createElement("button");
    fire.type = "button";
    fire.className = `mcr-fire${player === 1 ? " mcr-fire-p2" : ""}`;
    fire.textContent = "🎨";
    fire.setAttribute("aria-label", `${P_NAME[player]}甩颜料弹`);

    let stickId: number | null = null;
    const setKnob = (dx: number, dy: number): void => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const moveStick = (e: PointerEvent): void => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = rect.width / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const max = Math.max(1, rad - 12);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      stickDir[player] = { x: dx / max, y: dy / max };
      setKnob(dx, dy);
    };
    const endStick = (): void => {
      stickId = null;
      stickDir[player] = { x: 0, y: 0 };
      setKnob(0, 0);
    };
    stick.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      moveStick(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (stickId !== e.pointerId) return;
      e.preventDefault();
      moveStick(e);
    });
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);
    stick.addEventListener("lostpointercapture", endStick);

    const fireOn = (e: Event): void => {
      e.preventDefault();
      padFire[player] = true;
    };
    const fireOff = (): void => {
      padFire[player] = false;
    };
    fire.addEventListener("pointerdown", fireOn);
    fire.addEventListener("pointerup", fireOff);
    fire.addEventListener("pointerleave", fireOff);
    fire.addEventListener("pointercancel", fireOff);
    // 键盘 / 读屏用户:回车空格触发 click,给一发单点
    fire.addEventListener("click", () => {
      padFire[player] = true;
      clickFireLeft[player] = 0.12;
    });

    if (split) {
      // 单人:摇杆真的贴左下,技能钮真的贴右下,中间那块留给键盘说明
      const note = doc.createElement("div");
      note.className = "mcr-padname";
      note.style.color = "#7c6f9b";
      note.textContent = "键盘 W A S D 走位 · F 甩";
      pads.append(stick, note, fire);
      return;
    }
    pad.append(stick, fire);
    pads.appendChild(pad);
  }

  const clickFireLeft = [0, 0];
  buildPad(0, players === 1);
  if (players > 1) buildPad(1, false);

  function collectInputs(dt: number): void {
    for (let i = 0; i < players; i++) {
      const k = keyDir[i];
      let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      const s = stickDir[i];
      if (Math.hypot(s.x, s.y) > 0.12) {
        mx = s.x;
        my = s.y;
      }
      if (clickFireLeft[i] > 0) {
        clickFireLeft[i] -= dt;
        if (clickFireLeft[i] <= 0) padFire[i] = false;
      }
      inputs[i] = { mx, my, fire: keyFire[i] || padFire[i] };
    }
  }

  /* ---------------- 覆盖层:三选一 / 暂停 ---------------- */

  let layer: HTMLElement | null = null;
  let paused = false;

  function closeLayer(): void {
    layer?.remove();
    layer = null;
  }

  function openLayer(): HTMLElement {
    closeLayer();
    const el = doc.createElement("div");
    el.className = "mcr-layer";
    wrap.appendChild(el);
    layer = el;
    return el;
  }

  let draftShownFor = -1;

  /** 三选一面板:图标 + 名字 + 一句话,孩子能看懂;竖屏可滚动,按钮不出屏。 */
  function renderDraft(): void {
    const draft = state.drafts[0];
    if (!draft) {
      draftShownFor = -1;
      closeLayer();
      return;
    }
    draftShownFor = draft.hero;
    const el = openLayer();
    const title = doc.createElement("div");
    title.className = "mcr-layer-t";
    title.textContent = players > 1 ? `${draftTitle(state.draftCount)} · ${P_NAME[draft.hero]}` : draftTitle(state.draftCount);
    const sub = doc.createElement("div");
    sub.className = "mcr-layer-s";
    sub.textContent = "挑一样带上场,选好就继续开打。";
    const cards = doc.createElement("div");
    cards.className = "mcr-cards";
    const growth: GrowthState = state.heroes[draft.hero].growth;
    for (const card of draft.cards) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "mcr-card";
      const have = growth[card.id] ?? 0;
      btn.innerHTML = `<span class="mcr-card-emoji">${card.emoji}</span>
        <span class="mcr-card-name">${card.name}</span>
        <span class="mcr-card-desc">${card.desc}</span>
        <span class="mcr-card-lv">${have > 0 ? `已经有 ${have} 层,再加一层` : "第一次拿到"}</span>`;
      btn.setAttribute("aria-label", `${card.name}:${card.desc}`);
      btn.addEventListener("click", () => {
        opts.sfx("coin");
        chooseGrowth(state, draft.hero, card.id);
        refreshHud();
        renderDraft();
      });
      cards.appendChild(btn);
    }
    el.append(title, sub, cards);
    const first = cards.querySelector<HTMLElement>(".mcr-card");
    first?.focus?.();
  }

  function openPause(): void {
    paused = true;
    const el = openLayer();
    const t = doc.createElement("div");
    t.className = "mcr-layer-t";
    t.textContent = "⏸ 先歇一会儿";
    const s = doc.createElement("div");
    s.className = "mcr-layer-s";
    s.textContent = "小怪物在原地等你,喝口水再继续。";
    const go = doc.createElement("button");
    go.type = "button";
    go.className = "mcr-btn";
    go.textContent = "继续守家 ▶";
    go.addEventListener("click", () => {
      opts.sfx("tap");
      paused = false;
      closeLayer();
      if (state.drafts.length > 0) renderDraft();
    });
    el.append(t, s, go);
    go.focus?.();
  }

  function togglePause(): void {
    if (state.phase === "over") return;
    if (paused) {
      paused = false;
      closeLayer();
      if (state.drafts.length > 0) renderDraft();
    } else if (state.drafts.length === 0) {
      openPause();
    }
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  /* ---------------- 事件 → 音效 + 飘字 ---------------- */

  const soundAt = new Map<string, number>();
  let sayLeft = 0;
  let shake = 0;
  /** 涂满离场的开心演出:pop 事件进来排队,画完 FAREWELL_TIME 秒自动出列 */
  const farewells: Farewell[] = [];
  /** 每个英雄上一次出手的时刻:挥击弧痕与刷毛甩开按这个算 */
  const swingAt = [-9, -9];

  function playThrottled(name: SoundName, key: string, gap: number): void {
    const now = state.elapsed;
    const last = soundAt.get(key) ?? -99;
    if (now - last < gap) return;
    soundAt.set(key, now);
    opts.sfx(name);
  }

  function consume(events: ArenaEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "pop":
          playThrottled("pop", "pop", 0.12);
          // 上色完成!小怪物开开心心变彩色离场
          farewells.push({ x: e.x ?? 0, y: e.y ?? 0, start: state.elapsed });
          if (farewells.length > 8) farewells.shift();
          break;
        case "fire":
          swingAt[e.hero ?? 0] = state.elapsed;
          break;
        case "block":
          playThrottled("tap", "block", 0.35);
          break;
        case "shieldPop":
          playThrottled("jump", "shield", 0.2);
          break;
        case "spin":
          playThrottled("oops", "spin", 0.4);
          shake = reduced ? 0 : 0.32;
          break;
        case "steal":
          opts.sfx("oops");
          shake = reduced ? 0 : 0.4;
          break;
        case "jar":
          opts.sfx("coin");
          break;
        case "boss":
          opts.sfx("meow");
          break;
        case "wave":
          playThrottled("coin", "wave", 0.5);
          break;
        default:
          break;
      }
      if (e.text) {
        say.textContent = e.text;
        say.hidden = false;
        sayLeft = 2.4;
      }
    }
  }

  /* ---------------- 渲染 ---------------- */

  let scene = opts.scene % SCENE_COUNT;

  function render(): void {
    if (!c2d) return;
    const t = state.elapsed;
    c2d.setTransform(2, 0, 0, 2, 0, 0);
    if (state.mode === "endless") scene = state.scene % SCENE_COUNT;
    const sky = SCENE_SKY[scene] ?? SCENE_SKY[0];
    const ground = SCENE_GROUND[scene] ?? SCENE_GROUND[0];

    c2d.clearRect(0, 0, ARENA_W, ARENA_H);
    drawSky(c2d, ARENA_W, ARENA_H, sky, t, !reduced);

    c2d.save();
    if (shake > 0 && !reduced) c2d.translate(Math.sin(t * 46) * shake * 5, Math.cos(t * 39) * shake * 3);

    // 庭院草纹 + 场景装饰(对战只画中线),都在 art.ts 查表
    const yard = versus ? 108 : 152;
    drawScenery(c2d, ARENA_W, ARENA_H, { ground, scene, versus, homes: state.homes, yard }, t, !reduced);

    for (let s = 0; s < state.homes.length; s++) {
      drawHome(c2d, state.homes[s].x, state.homes[s].y, state.jars[s], state.maxJars, P_COLOR[s] ?? P_COLOR[0], t, !reduced);
    }

    // 元气糖
    for (const c of state.crumbs) drawCrumb(c2d, c.x, c.y, t, !reduced);

    // 近的画在上面:按 y 排一下序,俯视图也有一点点前后关系
    const actors: Array<{ y: number; draw: () => void }> = [];
    for (const m of state.monsters) actors.push({ y: m.y, draw: () => drawMonster(c2d, m, t, !reduced) });
    for (const h of state.heroes) actors.push({ y: h.y, draw: () => drawHero(c2d, h, t, !reduced, t - swingAt[h.idx]) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    for (const b of state.bullets) drawBullet(c2d, b, t, !reduced);

    for (const p of state.particles) drawParticle(c2d, p);

    // 涂满离场:开心变彩色跳一下(演完自动出列)
    for (let i = farewells.length - 1; i >= 0; i--) {
      if (t - farewells[i].start > FAREWELL_TIME) farewells.splice(i, 1);
    }
    for (const f of farewells) drawFarewell(c2d, f, t, !reduced);

    c2d.restore();
  }

  /* ---------------- HUD ---------------- */

  let lastHud = "";

  function refreshHud(): void {
    const parts: string[] = [];
    const wave = waveLabel(state);
    parts.push(wave);
    for (let s = 0; s < state.homes.length; s++) {
      parts.push(`${state.jars[s]}`);
    }
    for (let i = 0; i < players; i++) parts.push(growthBadges(state.heroes[i].growth).join(""));
    const sig = parts.join("|");
    if (sig === lastHud) return;
    lastHud = sig;
    waveChip.textContent = wave;
    for (let s = 0; s < jarChips.length; s++) {
      const jars = state.jars[s];
      const label = versus ? `${P_NAME[s]} ` : "";
      jarChips[s].textContent = `${label}🫙 ${"●".repeat(Math.max(0, jars))}${"○".repeat(Math.max(0, state.maxJars - jars))}`;
      jarChips[s].className = jars <= 1 ? "mcr-chip mcr-chip-warn" : "mcr-chip";
    }
    for (let i = 0; i < players; i++) {
      const badges = growthBadges(state.heroes[i].growth);
      growthChips[i].textContent = badges.length ? `${players > 1 ? P_NAME[i] : "成长"} ${badges.join(" ")}` : "";
      growthChips[i].hidden = badges.length === 0;
    }
  }

  /* ---------------- 布局 ---------------- */

  function layout(): void {
    const size = arenaCanvasSize(stage.clientWidth || wrap.clientWidth, view.innerWidth, view.innerHeight);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
  }

  layout();
  view.addEventListener("resize", layout);
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => layout());
    ro.observe(stage);
  }

  /* ---------------- 主循环 ---------------- */

  let raf = 0;
  let last = 0;
  let destroyed = false;
  let done = false;

  function frame(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (!paused && state.phase !== "over") {
      collectInputs(dt);
      const events = stepArena(state, dt, inputs);
      consume(events);
    }
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (sayLeft > 0) {
      sayLeft -= dt;
      if (sayLeft <= 0) say.hidden = true;
    }

    if (state.drafts.length > 0 && state.drafts[0].hero !== draftShownFor && !paused) renderDraft();
    if (state.drafts.length === 0 && draftShownFor >= 0 && !paused) {
      draftShownFor = -1;
      closeLayer();
    }

    refreshHud();
    render();

    if (state.result && !done) {
      done = true;
      closeLayer();
      opts.onDone(state.result);
    }
  }

  refreshHud();
  render();
  last = typeof performance === "object" ? performance.now() : 0;
  raf = requestAnimationFrame(frame);
  if (state.drafts.length > 0) renderDraft();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      closeLayer();
      ro?.disconnect();
      ro = null;
      view.removeEventListener("keydown", onKeyDown);
      view.removeEventListener("keyup", onKeyUp);
      view.removeEventListener("resize", layout);
      disposeArena(state);
      wrap.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 闯关:188 关                                                        */
/* ------------------------------------------------------------------ */

const CAMPAIGN_HINT =
  "左下摇杆走位,右下 🎨 按住不放一直甩;小怪物碰到你只会转个圈,别怕。电脑上用 W A S D 走、F 甩。";

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const state = createCampaignArena(ctx.level);
  const view = createArenaView(stage, {
    state,
    title: `${ctx.chapter.emoji} 第 ${ctx.level + 1} 关`,
    hint: CAMPAIGN_HINT,
    scene: ctx.chapterIndex,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.win) {
        ctx.win(campaignStars(res.jars[0], res.maxJars), arenaWinLine(res.jars[0], res.maxJars, res.popped));
      } else {
        ctx.lose(arenaLoseLine(res.wavesCleared, res.waveTotal, res.weakSide));
      }
    },
  });
  return { destroy: () => view.destroy() };
}

/* ------------------------------------------------------------------ */
/* 三个附加模式共用的外壳                                               */
/* ------------------------------------------------------------------ */

function modeShell(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  chipText: string
): { root: HTMLElement; stage: HTMLElement; chip: HTMLElement; destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "mcr-mode";
  const head = document.createElement("div");
  head.className = "mcr-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mcr-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "mcr-chip";
  chip.textContent = chipText;
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return { root: wrap, stage, chip, destroy: () => wrap.remove() };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; cls?: string; onClick: () => void }>
): void {
  stage.innerHTML = "";
  const box = document.createElement("div");
  box.className = "mcr-over";
  const t = document.createElement("div");
  t.className = "mcr-layer-t";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "mcr-layer-s";
  s.textContent = sub;
  const row = document.createElement("div");
  row.className = "mcr-over-btns";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mcr-btn${b.cls ? ` ${b.cls}` : ""}`;
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.append(t, s, row);
  stage.appendChild(box);
}

/* ------------------------------------------------------------------ */
/* 无尽:每 5 波小 boss,每 10 波换场景                                   */
/* ------------------------------------------------------------------ */

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, "");
  let view: ViewHandle | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  function start(): void {
    view?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = best > 0 ? `♾️ 无尽守家 · 最好 第 ${best} 波` : "♾️ 无尽守家 · 挡到第几波?";
    const state = createArena({
      mode: "endless",
      makeWave: arenaEndlessWave,
      levelIdxFor: (wave) => endlessLevelIndex(wave),
      seed: 20250813,
      jars: 5,
      openingDraft: true,
    });
    view = createArenaView(shell.stage, {
      state,
      title: "无尽守家",
      hint: "波次没有尽头。每 5 波来一只小 boss,每 10 波换一个场景;记得捡地上的元气糖补家里的罐子。",
      scene: 0,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const reached = res.wavesCleared;
        best = save.recordEndlessBest(meta.id, reached);
        if (reached > 0) api.addStars(Math.min(3, Math.ceil(reached / 4)));
        overBox(
          shell.stage,
          reached >= best && reached > 0 ? "🏅 新纪录!" : "🏠 元气被抱完啦",
          arenaEndlessLine(reached, best),
          [{ label: "🔁 从第 1 波再来", onClick: () => {
            api.play("tap");
            start();
          } }]
        );
      },
    });
  }

  start();
  return {
    destroy() {
      view?.destroy();
      view = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 双人合作:共享波次,各自成长                                           */
/* ------------------------------------------------------------------ */

function mountCoop(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, `🤝 双人合作 · 一起挡满 ${COOP_WAVES} 波`);
  let view: ViewHandle | null = null;

  function start(): void {
    view?.destroy();
    shell.stage.innerHTML = "";
    const waves = [];
    for (let w = 1; w <= COOP_WAVES; w++) waves.push(buildCoopWave(w));
    const state = createArena({
      mode: "coop",
      waves,
      heroes: 2,
      jars: 5,
      levelIdxFor: (wave) => endlessLevelIndex(wave),
      seed: 424242,
      openingDraft: true,
    });
    view = createArenaView(shell.stage, {
      state,
      title: "双人合作守家",
      hint: "两个人守同一个家:朵朵用左边摇杆 + 🎨,星星用右边摇杆 + 🎨;键盘是 W A S D / F 和 ↑←↓→ / L。成长卡两个人分开挑!",
      scene: 3,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        if (res.win) api.addStars(3);
        else if (res.wavesCleared >= 3) api.addStars(1);
        overBox(
          shell.stage,
          res.win ? "🎉 一起守住啦!" : "🏠 元气被抱完啦",
          arenaCoopLine(res.wavesCleared, COOP_WAVES, res.popped),
          [{ label: "🔁 再来一局", cls: "mcr-btn-co", onClick: () => {
            api.play("tap");
            start();
          } }]
        );
      },
    });
  }

  start();
  return {
    destroy() {
      view?.destroy();
      view = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 对战:两人各守一半,先失守者输                                          */
/* ------------------------------------------------------------------ */

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, `⚔️ 各守一半 · ${VERSUS_WAVES} 波,先失守的那边输`);
  let view: ViewHandle | null = null;

  function start(): void {
    view?.destroy();
    shell.stage.innerHTML = "";
    const waves = [];
    for (let w = 1; w <= VERSUS_WAVES; w++) waves.push(buildCoopWave(w));
    const state = createArena({
      mode: "versus",
      waves,
      heroes: 2,
      jars: 5,
      levelIdxFor: (wave) => endlessLevelIndex(wave),
      seed: 987654,
      openingDraft: true,
    });
    view = createArenaView(shell.stage, {
      state,
      title: "各守一半",
      hint: "左边是朵朵的家,右边是星星的家,两边来的小怪物一模一样。谁先被抱光元气谁就输,撑到最后元气多的那边赢!",
      scene: 7,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        api.addStars(1);
        const title =
          res.winner < 0 ? "🤝 平手!" : res.winner === 0 ? "🎀 朵朵这边守住啦!" : "⭐ 星星这边守住啦!";
        overBox(shell.stage, title, arenaVersusLine(res.winner, res.jars, P_NAME), [
          { label: "🔁 换边再来", cls: "mcr-btn-vs", onClick: () => {
            api.play("tap");
            start();
          } },
        ]);
      },
    });
  }

  start();
  return {
    destroy() {
      view?.destroy();
      view = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 挂载:模式条 + 188 关地图 + 直达第 N 关                                */
/* ------------------------------------------------------------------ */

export interface MonsterCrisisHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

/** 地址栏上的 `?level=N`(壳层没给 `initialLevel` 时的兜底,和 gold-hook 同一套约定)。 */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function mount(api: GameApi): MonsterCrisisHandle {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "mcr-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "mcr-btn";
  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "mcr-btn mcr-btn-co";
  coopBtn.textContent = "🤝 双人合作";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "mcr-btn mcr-btn-vs";
  vsBtn.textContent = "⚔️ 各守一半";
  bar.append(endlessBtn, coopBtn, vsBtn);

  let mode: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽守家 · 最好 第 ${best} 波` : "♾️ 无尽守家 · 点我开始!";
  }

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
   * 直达第 N 关:平台的 188 关框架只吐一个 `destroy`,没有「从第 N 关开始」的入口,
   * 所以按规格第九节自己开一条通道 —— 星级照样按框架那套 key 存,回得去选关地图。
   */
  function openDirectLevel(index: number): void {
    const i = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
    closeDirect(false);
    mode?.destroy();
    mode = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    modeHost.innerHTML = "";

    const ci = chapterOf(CHAPTERS, i);
    const ch: Chapter = CHAPTERS[ci];
    const shell = modeShell(modeHost, api, () => closeDirect(true), `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`);
    let handle: PlayHandle | undefined;
    let settled = false;

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      overBox(
        shell.stage,
        title,
        msg,
        buttons.map((b) => ({
          label: b.label,
          onClick: () => {
            api.play("tap");
            b.go();
          },
        }))
      );
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
        if (i + 1 < TOTAL) buttons.push({ label: "下一关 ▶", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 选关地图", go: () => closeDirect(true) });
        settle(`⭐ 第 ${i + 1} 关过关!`, msg ?? "守得漂亮!", buttons);
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
    const i = Math.max(0, Math.min(TOTAL - 1, Math.round(n) - 1));
    openDirectLevel(i);
    return i + 1;
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
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
      mapHint: "自己上场跑位出手:每 3 波挑一张成长卡,越打越顺手。被撞到只会转个圈,一点也不要紧!",
      grandMessage: "188 关全部守住!彩虹总部的小怪物全变成了小云朵,你是最棒的守家小队长!",
      guide,
      guideTitle: "小怪物危机 · 守家手册",
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

/** 图例:五种行为各是什么(攻略面板与无障碍说明共用)。 */
export function behaviorLegend(): string[] {
  return (Object.keys(BEHAVIOR_INFO) as Array<keyof typeof BEHAVIOR_INFO>).map(
    (k) => `${BEHAVIOR_INFO[k].emoji} ${BEHAVIOR_INFO[k].name}:${BEHAVIOR_INFO[k].tip}`
  );
}

/** 关卡小标题:哪一章、什么场景(直达第 N 关与攻略共用)。 */
export function levelSceneName(levelIdx: number): string {
  const ci = chapterOf(CHAPTERS, Math.max(0, Math.min(LEVELS.length - 1, levelIdx)));
  return SCENE_NAME[ci % SCENE_NAME.length];
}

/** 一局打了多久,给结算用。 */
export function runClock(seconds: number): string {
  return formatClock(seconds);
}

/** 图鉴:这一关会来哪些怪(按行为归类,给攻略面板)。 */
export function levelBehaviors(levelIdx: number): string[] {
  const def = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIdx))];
  const seen = new Set<string>();
  for (const w of def.waves) {
    for (const s of w.spawns) {
      const info = MONSTER_INFO[s.kind];
      seen.add(info.name);
    }
  }
  return [...seen];
}
