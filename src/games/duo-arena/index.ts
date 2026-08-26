import { meta } from "./meta";
export { meta };

// 朵星擂台 —— 上下分屏的双人抢元气擂台赛。
//
// 1.2 把 1.1 那个「各点各半场」的连点小游戏做成了真正的对战:
//  · 两个人各自操控一个小人在自己那半场跑位,走到目标身上就收进元气袋,`F`/`L` 出手能多够一点;
//  · 加速 / 护盾泡 / 弹开波三个温和技能,同一个键轮流放,全都有前摇,看得见也躲得开;
//  · 三局两胜赛制,赛点局背景会变色;四张擂台按回合轮换,地块会滑,边界形状还不一样;
//  · 一个人在家也能玩:菜鸟 / 普通 / 高手 / 地狱四档人机,外加无尽守擂;
//  · 大人带小孩玩可以打开让分,给落后方最多 8% 的温和助推,HUD 上一直写着。
//
// 全程没有血、没有伤、没有淘汰:被弹到只是原地转个圈,输了只有鼓励。
import { save } from "../../engine/save";
import { createLifecycle } from "./lifecycle";
import {
  BOMB_STUN_SECONDS,
  DOUBLE_SECONDS,
  FREEZE_SECONDS,
  ROUND_SECONDS,
  SUDDEN_SECONDS,
  type SpawnEvent,
  type TargetKind,
  applyTap,
  buildRoundSchedule,
  tapScore,
} from "./logic";
import {
  AI_LEVELS,
  AI_SPECS,
  type AiBrain,
  type AiLevel,
  type AiTargetView,
  createBrain,
  thinkAi,
} from "./ai";
import {
  type ArenaMode,
  type MatchProgress,
  type RoundResult,
  createMatch,
  handicapLabel,
  handicapRate,
  isMatchPointRound,
  keepSetup,
  levelToSetup,
  parseLevelParam,
  pushRound,
} from "./match";
import {
  DASH_SPEED_SCALE,
  GRAB_BASE_RADIUS,
  SKILLS,
  type SkillState,
  WAVE_SPIN_SECONDS,
  canGrab,
  castSkill,
  cooldownRatio,
  createSkillState,
  grabPhase,
  grabRadius,
  isProtected,
  isSkillActive,
  pushedPosition,
  tickSkills,
  waveJustFired,
} from "./skills";
import {
  type Action,
  PAD_LAYOUT,
  STICK_OFFSET,
  type Seat,
  isPauseKey,
  isWatchedKey,
  moveVector,
  resolveKey,
} from "./keys";
import {
  type Stage,
  blockRect,
  boundaryHalfWidth,
  clampToArena,
  placeTarget,
  spawnPoints,
  stageAt,
} from "./stages";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---------------- 常量 ---------------- */

/** 小人每秒能跑过半场宽度的几成 */
const BASE_SPEED = 0.55;
/** 小人半径(相对半场宽) */
const BODY_R = 0.052;
/** 目标半径 */
const TARGET_R = 0.042;
/** 演出时长上限:比赛节奏比什么都重要 */
const SHOW_MS = 800;
/** 开局倒数 */
const COUNTDOWN = 2.4;

const SEAT_DUO: Seat = 0;
const SEAT_STAR: Seat = 1;

/* ---- 头像:PNG 到位后自动使用,暂时用可爱占位 ---- */
const AVATAR_URLS = import.meta.glob("../../assets/avatars/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function avatarHTML(who: "duoduo" | "xingxing", size = 22): string {
  const url = AVATAR_URLS[`../../assets/avatars/${who === "duoduo" ? "duoduo-q.png" : "xingxing-q.png"}`];
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : "⭐";
  const bg = who === "duoduo" ? "#FFD9E8" : "#D9E6FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(size * 0.58)}px;vertical-align:middle">${emoji}</span>`;
}

interface LiveTarget {
  id: number;
  kind: TargetKind;
  effect?: SpawnEvent["effect"];
  x: number;
  y: number;
  born: number;
  die: number;
}

interface FloatText {
  text: string;
  color: string;
  x: number;
  y: number;
  until: number;
}

interface Fighter {
  seat: Seat;
  name: string;
  emoji: string;
  color: string;
  x: number;
  y: number;
  score: number;
  held: Partial<Record<Action, boolean>>;
  grabStart: number | null;
  skills: SkillState;
  /** 转圈到什么时候(被弹开或碰到迷糊泡) */
  spinUntil: number;
  frozenUntil: number;
  doubleUntil: number;
  /** 时间表指针 */
  next: number;
  targets: LiveTarget[];
  floats: FloatText[];
  brain: AiBrain | null;
  aiLevel: AiLevel | null;
  /** 本回合让分助推(0 = 没有) */
  boost: number;
  scoreEl: HTMLElement;
  winsEl: HTMLElement;
  courtEl: HTMLElement;
  canvas: HTMLCanvasElement;
}

const CSS = `
.dua-wrap{--dua-ink:#4A4266;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--dua-ink);
  background:linear-gradient(180deg,#E4EFFF,#FFE9F2);border-radius:20px;padding:10px;max-width:440px;margin:0 auto;
  user-select:none;-webkit-user-select:none;position:relative;box-sizing:border-box;}
.dua-wrap *{box-sizing:border-box;}
.dua-wrap.mp{background:linear-gradient(180deg,#FFF0D6,#FFE1EC);}
.dua-hidden{display:none !important;}
.dua-panel{display:flex;flex-direction:column;gap:10px;padding:6px 2px;}
.dua-title{text-align:center;font-weight:900;color:#B06AB3;font-size:17px;line-height:1.5;}
.dua-lead{text-align:center;color:#7A6A90;font-size:14px;line-height:1.6;}
.dua-group{background:rgba(255,255,255,.72);border-radius:16px;padding:9px 10px;}
.dua-group h4{margin:0 0 7px;font-size:14px;color:#8A5AA8;font-weight:800;}
.dua-chips{display:flex;flex-wrap:wrap;gap:6px;}
.dua-chip{flex:1 1 46%;min-height:44px;border:2px solid transparent;border-radius:14px;padding:8px 6px;font-size:14px;
  font-weight:800;font-family:inherit;cursor:pointer;background:#FFF;color:#6A5A80;box-shadow:0 2px 0 rgba(0,0,0,.08);}
.dua-chip.on{border-color:#F5A0C0;background:#FFEFF6;color:#C2497E;}
.dua-chip small{display:block;font-weight:600;font-size:11.5px;color:#8A7AA0;margin-top:2px;line-height:1.35;}
.dua-start{border:none;border-radius:18px;padding:15px;font-size:19px;font-weight:800;background:#FFB37E;color:#7A3A10;
  cursor:pointer;box-shadow:0 5px 0 #E08F55;width:100%;font-family:inherit;min-height:52px;}
.dua-start:active{transform:translateY(3px);box-shadow:0 2px 0 #E08F55;}
.dua-rulesbtn{border:none;border-radius:16px;padding:12px;font-size:15px;font-weight:800;background:#D9F2C4;color:#3F6B22;
  cursor:pointer;box-shadow:0 4px 0 #ADD68E;width:100%;font-family:inherit;min-height:46px;}
.dua-top{display:flex;align-items:center;justify-content:space-between;gap:5px;padding:3px 2px 5px;}
.dua-sc{display:flex;align-items:center;gap:4px;background:#fff;border-radius:13px;padding:4px 8px;font-weight:900;
  font-size:15px;box-shadow:0 2px 6px rgba(120,120,180,.2);white-space:nowrap;}
.dua-sc .wins{color:#E8A93C;font-size:12px;letter-spacing:1px;font-style:normal;}
.dua-sc-x{color:#3A6BB0;}
.dua-sc-d{color:#C2497E;}
.dua-clock{text-align:center;font-weight:900;color:#7A5AA8;line-height:1.15;}
.dua-clock b{font-size:20px;}
.dua-clock small{display:block;font-size:12px;font-weight:700;}
.dua-tags{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;padding-bottom:5px;}
.dua-tag{background:rgba(255,255,255,.8);border-radius:11px;padding:3px 8px;font-size:14px;font-weight:700;color:#7A6A90;}
.dua-tag.hot{background:#FFE0B8;color:#9A5A10;}
.dua-court{position:relative;border-radius:16px;overflow:hidden;height:186px;touch-action:none;margin-bottom:7px;}
.dua-court canvas{display:block;width:100%;height:100%;}
.dua-pad{position:absolute;inset:0;pointer-events:none;}
.dua-pad button{position:absolute;pointer-events:auto;border:none;border-radius:50%;width:44px;height:44px;font-size:17px;
  font-weight:900;font-family:inherit;background:rgba(255,255,255,.62);color:#5A4A70;box-shadow:0 2px 5px rgba(80,80,140,.25);
  cursor:pointer;padding:0;line-height:1;touch-action:none;}
.dua-pad button:active{background:rgba(255,255,255,.95);transform:scale(.94);}
.dua-pad .act{width:48px;height:48px;font-size:19px;}
.dua-pad .act.skill{background:rgba(214,236,255,.72);}
.dua-btns{display:flex;gap:7px;}
.dua-btns button{flex:1;border:none;border-radius:14px;padding:11px 4px;font-size:14px;font-weight:700;cursor:pointer;
  box-shadow:0 3px 0 rgba(0,0,0,.12);font-family:inherit;min-height:44px;}
.dua-pause{background:#DCE6FF;color:#3A5AA0;}
.dua-help{background:#D9F2C4;color:#3F6B22;}
.dua-back{background:#FFE0C2;color:#8A4A14;}
.dua-msg{text-align:center;min-height:20px;color:#8A5AA8;font-weight:700;margin-top:6px;font-size:14px;line-height:1.5;}
.dua-splash{position:absolute;left:8px;right:8px;top:50%;transform:translateY(-50%);background:rgba(255,250,244,.97);
  border-radius:18px;z-index:5;font-weight:900;color:#B06AB3;font-size:19px;text-align:center;padding:14px 12px;
  box-shadow:0 6px 20px rgba(120,100,160,.28);line-height:1.6;}
.dua-splash .sub{font-size:14px;color:#7A6A90;font-weight:700;margin-top:4px;}
.dua-splash .row{display:flex;gap:8px;margin-top:10px;}
.dua-splash .row button{flex:1;border:none;border-radius:14px;padding:11px 6px;font-size:15px;font-weight:800;
  font-family:inherit;cursor:pointer;background:#FFB37E;color:#7A3A10;box-shadow:0 3px 0 #E08F55;min-height:44px;}
.dua-splash .row button.ghost{background:#E6E1F5;color:#5A4A80;box-shadow:0 3px 0 #C6BEE0;}
.dua-rules{position:absolute;inset:0;background:#FFF7F0;border-radius:20px;padding:14px;overflow-y:auto;z-index:6;}
.dua-rules h3{color:#C2497E;margin:12px 0 4px;font-size:16px;}
.dua-rules p{color:#6A5A4A;font-size:14px;line-height:1.75;margin:6px 0;}
.dua-rules-close{position:sticky;top:0;float:right;border:none;border-radius:14px;background:#FFB37E;color:#7A3A10;
  font-size:15px;font-weight:800;padding:9px 16px;cursor:pointer;box-shadow:0 3px 0 #E08F55;font-family:inherit;min-height:44px;}
@media (max-width:380px){
  .dua-court{height:168px;}
  .dua-sc{font-size:14px;padding:4px 6px;}
  .dua-clock b{font-size:18px;}
}
@media (prefers-reduced-motion:reduce){
  .dua-start:active,.dua-pad button:active{transform:none;}
}
`;

export function mount(api: GameApi): { destroy: () => void } {
  // 监听、timer、帧循环全部记在账本上,destroy 时一句话归零
  const life = createLifecycle({
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    requestAnimationFrame: (cb) => window.requestAnimationFrame(cb),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
    addEventListener: (type, fn) => window.addEventListener(type, fn as EventListener),
    removeEventListener: (type, fn) => window.removeEventListener(type, fn as EventListener),
  });
  let destroyed = false;
  const reduceMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  function later(fn: () => void, ms: number): number {
    return life.later(fn, ms);
  }

  /* ---------------- 局面状态 ---------------- */

  let mode: ArenaMode = "duo";
  let aiLevel: AiLevel = "normal";
  let handicapOn = false;
  let stageIndex = 0;

  let playing = false;
  let paused = false;
  let roundTime = 0;
  let roundDuration = ROUND_SECONDS;
  let prevTime = 0;
  let matchSeed = 0;
  let progress: MatchProgress = createMatch();
  let roundIdx = 0;
  let stage: Stage = stageAt(0);
  let schedule: SpawnEvent[] = [];
  let keepBout = 1;
  let keepWins = 0;
  let targetId = 1;
  let skipShow: (() => void) | null = null;

  const wrap = document.createElement("div");
  wrap.className = "dua-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="dua-panel dua-setup">
      <div class="dua-title">🥊 朵星擂台<br><span style="font-size:14px;font-weight:700;color:#7A6A90">走位抢元气 · 三局两胜 · 四张擂台轮换</span></div>
      <div class="dua-group">
        <h4>① 选个玩法</h4>
        <div class="dua-chips dua-modes">
          <button class="dua-chip on" type="button" data-mode="duo">👫 双人同屏<small>两个人一台设备,各守半场</small></button>
          <button class="dua-chip" type="button" data-mode="solo">🤖 单人挑战<small>一个人也能打,人机四档</small></button>
          <button class="dua-chip" type="button" data-mode="keep" style="flex:1 1 100%">🏰 无尽守擂<small>连着接招,对手一场比一场强</small></button>
        </div>
      </div>
      <div class="dua-group dua-ai-group">
        <h4>② 人机难度</h4>
        <div class="dua-chips dua-ais"></div>
      </div>
      <div class="dua-group">
        <h4>③ 让分开关(大人带小孩玩)</h4>
        <div class="dua-chips">
          <button class="dua-chip dua-hcap-btn" type="button">🤝 让分:关<small>打开后落后方最多 +8% 的温和助推</small></button>
        </div>
      </div>
      <div class="dua-lead dua-best"></div>
      <button class="dua-rulesbtn" type="button">📖 怎么玩(点我看规则与键位)</button>
      <button class="dua-start" type="button">开擂 ▶</button>
    </div>
    <div class="dua-game dua-hidden">
      <div class="dua-top">
        <span class="dua-sc dua-sc-x">${avatarHTML("xingxing")} <span class="pts">0</span> <i class="wins"></i></span>
        <span class="dua-clock"><b class="t">25</b><small class="r">第 1 回合</small></span>
        <span class="dua-sc dua-sc-d">${avatarHTML("duoduo")} <span class="pts">0</span> <i class="wins"></i></span>
      </div>
      <div class="dua-tags">
        <span class="dua-tag dua-stage-tag"></span>
        <span class="dua-tag dua-hcap-tag"></span>
        <span class="dua-tag dua-mp-tag dua-hidden">🔥 赛点局</span>
      </div>
      <div class="dua-court dua-court-x"><canvas></canvas><div class="dua-pad dua-pad-x"></div></div>
      <div class="dua-court dua-court-d"><canvas></canvas><div class="dua-pad dua-pad-d"></div></div>
      <div class="dua-btns">
        <button class="dua-pause" type="button">⏸ 暂停</button>
        <button class="dua-help" type="button">📖 规则</button>
        <button class="dua-back" type="button">🔧 退出擂台</button>
      </div>
      <div class="dua-msg"></div>
      <div class="dua-splash dua-hidden"></div>
    </div>
    <div class="dua-rules dua-hidden">
      <button class="dua-rules-close" type="button">✖ 关闭</button>
      <h3 style="margin-top:2px">📖 朵星擂台 · 规则</h3>
      <div class="dua-rules-body"></div>
    </div>
  `;
  api.root.appendChild(wrap);

  const q = <T extends HTMLElement>(sel: string): T => wrap.querySelector(sel) as T;

  const setupEl = q(".dua-setup");
  const gameEl = q(".dua-game");
  const rulesEl = q(".dua-rules");
  const splashEl = q(".dua-splash");
  const msgEl = q(".dua-msg");
  const clockTEl = q(".dua-clock .t");
  const clockREl = q(".dua-clock .r");
  const stageTagEl = q(".dua-stage-tag");
  const hcapTagEl = q(".dua-hcap-tag");
  const mpTagEl = q(".dua-mp-tag");
  const bestEl = q(".dua-best");
  const aiGroupEl = q(".dua-ai-group");
  const hcapBtn = q<HTMLButtonElement>(".dua-hcap-btn");

  /* ---------------- 选手 ---------------- */

  function makeFighter(seat: Seat, courtSel: string, scoreSel: string): Fighter {
    const court = q<HTMLElement>(courtSel);
    return {
      seat,
      name: seat === SEAT_DUO ? "朵朵" : "星星",
      emoji: seat === SEAT_DUO ? "🌸" : "⭐",
      color: seat === SEAT_DUO ? "#E8558F" : "#3F7FD6",
      x: 0.3,
      y: 0.5,
      score: 0,
      held: {},
      grabStart: null,
      skills: createSkillState(0),
      spinUntil: -1,
      frozenUntil: -1,
      doubleUntil: -1,
      next: 0,
      targets: [],
      floats: [],
      brain: null,
      aiLevel: null,
      boost: 0,
      scoreEl: q(`${scoreSel} .pts`),
      winsEl: q(`${scoreSel} .wins`),
      courtEl: court,
      canvas: court.querySelector("canvas") as HTMLCanvasElement,
    };
  }

  const duo = makeFighter(SEAT_DUO, ".dua-court-d", ".dua-sc-d");
  const star = makeFighter(SEAT_STAR, ".dua-court-x", ".dua-sc-x");
  const fighters: [Fighter, Fighter] = [duo, star];

  function other(f: Fighter): Fighter {
    return f === duo ? star : duo;
  }

  /* ---------------- 触屏控件 ---------------- */

  function buildPad(f: Fighter): void {
    const pad = f.courtEl.querySelector(".dua-pad") as HTMLElement;
    const dirs: Array<{ act: Action; label: string; dx: number; dy: number }> = [
      { act: "up", label: "▲", dx: 0, dy: -1 },
      { act: "down", label: "▼", dx: 0, dy: 1 },
      { act: "left", label: "◀", dx: -1, dy: 0 },
      { act: "right", label: "▶", dx: 1, dy: 0 },
    ];
    const html: string[] = [];
    for (const d of dirs) {
      const cx = (PAD_LAYOUT.stick.x + d.dx * STICK_OFFSET.x) * 100;
      const cy = (PAD_LAYOUT.stick.y + d.dy * STICK_OFFSET.y) * 100;
      html.push(
        `<button type="button" data-act="${d.act}" aria-label="${f.name}向${d.act}" style="left:${cx}%;top:${cy}%;transform:translate(-50%,-50%)">${d.label}</button>`,
      );
    }
    html.push(
      `<button type="button" class="act grab" data-act="grab" aria-label="${f.name}出手" style="left:${PAD_LAYOUT.grab.x * 100}%;top:${PAD_LAYOUT.grab.y * 100}%;transform:translate(-50%,-50%)">✋</button>`,
    );
    html.push(
      `<button type="button" class="act skill" data-act="skill" aria-label="${f.name}技能" style="left:${PAD_LAYOUT.skill.x * 100}%;top:${PAD_LAYOUT.skill.y * 100}%;transform:translate(-50%,-50%)">💨</button>`,
    );
    pad.innerHTML = html.join("");

    for (const btn of Array.from(pad.querySelectorAll("button"))) {
      const act = btn.getAttribute("data-act") as Action;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        press(f, act);
      });
      const up = (e: Event) => {
        e.preventDefault();
        release(f, act);
      };
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("pointerleave", up);
    }
  }

  function press(f: Fighter, act: Action): void {
    if (f.brain) return; // 人机的半场不接受手动操作
    if (act === "grab") {
      tryGrab(f);
      return;
    }
    if (act === "skill") {
      trySkill(f);
      return;
    }
    f.held[act] = true;
  }

  function release(f: Fighter, act: Action): void {
    if (act === "grab" || act === "skill") return;
    f.held[act] = false;
  }

  function tryGrab(f: Fighter): void {
    if (!playing || paused || roundTime < 0) return;
    if (roundTime < f.spinUntil || roundTime < f.frozenUntil) return;
    if (!canGrab(f.grabStart, roundTime)) return;
    f.grabStart = roundTime;
    api.play("tap");
  }

  function trySkill(f: Fighter): void {
    if (!playing || paused || roundTime < 0) return;
    if (roundTime < f.spinUntil || roundTime < f.frozenUntil) return;
    const res = castSkill(f.skills, roundTime);
    if (!res.started) return;
    f.skills = res.state;
    const spec = SKILLS[res.id];
    pushFloat(f, `${spec.emoji} ${spec.name}!`, "#8A5AA8");
    api.play(res.id === "wave" ? "jump" : "meow");
  }

  /* ---------------- 键盘 ---------------- */

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (isPauseKey(e.key)) {
      if (!gameEl.classList.contains("dua-hidden")) {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (rulesEl.classList.contains("dua-hidden") === false) return;
    const hit = resolveKey(e.code);
    if (!hit) return;
    if (isWatchedKey(e.code)) e.preventDefault();
    if (e.repeat && (hit.action === "grab" || hit.action === "skill")) return;
    press(fighters[hit.seat], hit.action);
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (destroyed) return;
    const hit = resolveKey(e.code);
    if (!hit) return;
    release(fighters[hit.seat], hit.action);
  }

  life.listen("keydown", onKeyDown as never);
  life.listen("keyup", onKeyUp as never);

  /* ---------------- 画布尺寸 ---------------- */

  function sizeCanvas(f: Fighter): void {
    const w = f.courtEl.clientWidth || 336;
    const h = f.courtEl.clientHeight || 186;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    f.canvas.width = Math.max(1, Math.round(w * dpr));
    f.canvas.height = Math.max(1, Math.round(h * dpr));
  }

  function onResize(): void {
    for (const f of fighters) sizeCanvas(f);
  }
  life.listen("resize", onResize as never);

  /* ---------------- 选项面板 ---------------- */

  function renderAiChips(): void {
    const box = q(".dua-ais");
    box.innerHTML = AI_LEVELS.map((lv) => {
      const s = AI_SPECS[lv];
      return `<button class="dua-chip${lv === aiLevel ? " on" : ""}" type="button" data-ai="${lv}">${s.emoji} ${s.label}<small>${s.blurb}</small></button>`;
    }).join("");
    for (const btn of Array.from(box.querySelectorAll("button"))) {
      btn.addEventListener("click", () => {
        aiLevel = btn.getAttribute("data-ai") as AiLevel;
        api.play("tap");
        renderAiChips();
      });
    }
  }

  function renderSetup(): void {
    for (const btn of Array.from(wrap.querySelectorAll(".dua-modes button"))) {
      btn.classList.toggle("on", btn.getAttribute("data-mode") === mode);
    }
    aiGroupEl.classList.toggle("dua-hidden", mode === "duo");
    hcapBtn.classList.toggle("on", handicapOn);
    hcapBtn.innerHTML = `🤝 ${handicapLabel(handicapOn)}<small>打开后落后方最多 +8% 的温和助推</small>`;
    const best = save.getGameProgress(meta.id).endlessBest;
    bestEl.textContent = best > 0 ? `🏰 守擂最高连胜:${best} 场` : "🏰 守擂还没有纪录,去挂个第一笔吧";
  }

  for (const btn of Array.from(wrap.querySelectorAll(".dua-modes button"))) {
    btn.addEventListener("click", () => {
      mode = btn.getAttribute("data-mode") as ArenaMode;
      api.play("tap");
      renderSetup();
    });
  }
  hcapBtn.addEventListener("click", () => {
    handicapOn = !handicapOn;
    api.play("tap");
    renderSetup();
  });

  /* ---------------- 规则文字 ---------------- */

  function rulesHTML(): string {
    const skillLines = (["dash", "shield", "wave"] as const)
      .map((id) => {
        const s = SKILLS[id];
        return `${s.emoji} <b>${s.name}</b>:${s.blurb}(前摇 ${s.windup} 秒,冷却 ${s.cooldown} 秒)`;
      })
      .join("<br>");
    return `
      <h3>🎯 怎么赢</h3>
      <p>一场 <b>三局两胜</b>,每回合 ${ROUND_SECONDS} 秒。回合结束时<b>元气多的人拿下这回合</b>,先拿两个回合赢下整场;
      三个回合还不分,就加打 ${SUDDEN_SECONDS} 秒的决胜回合。谁站上赛点,顶上会亮起「🔥 赛点局」,背景也会变色。</p>
      <h3>🕹️ 键位</h3>
      <p>🌸 朵朵(下半场):<b>W A S D</b> 走位 · <b>F</b> 出手 · <b>G</b> 技能<br>
      ⭐ 星星(上半场):<b>↑ ← ↓ →</b> 走位 · <b>L</b> 出手 · <b>K</b> 技能<br>
      <b>Esc</b> 暂停。手机上每个半场自带摇杆和两个按钮,和键盘完全一样。</p>
      <h3>🎈 元气怎么来</h3>
      <p>走到目标身上就收进元气袋:🌸/⭐ 小标志 <b>+1</b>、🪙 金币 <b>+2</b>、🎁 礼物盒有惊喜(<b>+3</b>、
      <b>❄️ 冰住对手 ${FREEZE_SECONDS} 秒</b>、<b>✨ 双倍星光 ${DOUBLE_SECONDS} 秒</b>)。
      💫 迷糊泡千万别踩,踩到 <b>-2</b> 还要原地转 ${BOMB_STUN_SECONDS} 秒圈。元气最低是 0,不会变成负数。</p>
      <h3>✋ 出手与技能</h3>
      <p><b>出手</b>分前摇、生效、后摇三段,只有中间那一下手能够得更远,所以狂按没有用,看准了再按才划算。<br>${skillLines}<br>
      技能键是<b>轮着放</b>的:加速 → 护盾泡 → 弹开波 → 再回到加速,放完自动轮到下一招。</p>
      <h3>🏟️ 擂台与模式</h3>
      <p>四张擂台按回合轮换:方台、圆台、会滑的星桥、收腰的沙漏,地块挡路但撞上去只是停一下。<br>
      一个人在家就选<b>单人挑战</b>(菜鸟 / 普通 / 高手 / 地狱四档),想挑战纪录就选<b>无尽守擂</b>,
      对手一场比一场强,输了这一轮就结束,最高连胜会记进存档。</p>
      <h3>🤝 让分</h3>
      <p>大人带小孩玩可以在开始前打开<b>让分</b>:落后的一方最多得到 8% 的温和助推(跑得快一点点、目标多留一会儿),
      默认是关着的,比赛过程中顶上一直写着当前状态。</p>
    `;
  }

  q(".dua-rules-body").innerHTML = rulesHTML();

  /* ---------------- 开局 ---------------- */

  function startMatch(): void {
    matchSeed = (Math.random() * 0xffffffff) >>> 0;
    progress = createMatch();
    roundIdx = 0;
    keepBout = 1;
    keepWins = 0;
    setupEl.classList.add("dua-hidden");
    gameEl.classList.remove("dua-hidden");
    for (const f of fighters) sizeCanvas(f);
    startRound(false);
  }

  function resolveSetupForRound(): { level: AiLevel | null; stageIdx: number } {
    if (mode === "keep") {
      const s = keepSetup(keepBout);
      return { level: s.ai, stageIdx: s.stageIndex };
    }
    if (mode === "solo") return { level: aiLevel, stageIdx: stageIndex + roundIdx };
    return { level: null, stageIdx: stageIndex + roundIdx };
  }

  function startRound(sudden: boolean): void {
    const setup = resolveSetupForRound();
    stage = stageAt(setup.stageIdx);
    roundDuration = sudden ? SUDDEN_SECONDS : ROUND_SECONDS;
    const intensity = sudden ? 3 : Math.min(3, (mode === "keep" ? keepBout : roundIdx + 1));
    schedule = buildRoundSchedule(matchSeed + roundIdx * 1000 + keepBout * 97, intensity, roundDuration);
    roundTime = -COUNTDOWN;
    prevTime = roundTime;
    playing = true;
    paused = false;
    targetId = 1;

    const spots = spawnPoints(stage);
    for (const f of fighters) {
      const spot = f.seat === SEAT_DUO ? spots.self : spots.mirror;
      const home = clampToArena(stage, spot.x, spot.y, BODY_R, 0);
      f.x = home.x;
      f.y = home.y;
      f.score = 0;
      f.next = 0;
      f.targets = [];
      f.floats = [];
      f.held = {};
      f.grabStart = null;
      f.skills = createSkillState(-COUNTDOWN);
      f.spinUntil = -1;
      f.frozenUntil = -1;
      f.doubleUntil = -1;
      const myWins = progress.wins[f.seat];
      const oppWins = progress.wins[f.seat === 0 ? 1 : 0];
      f.boost = handicapRate(handicapOn, myWins, oppWins);
      f.aiLevel = null;
      f.brain = null;
    }
    if (setup.level) {
      star.aiLevel = setup.level;
      star.brain = createBrain(setup.level, (matchSeed ^ (roundIdx * 7919)) >>> 0, -COUNTDOWN);
    }
    // 人机那半场不需要摇杆,让出全部场地
    for (const f of fighters) {
      (f.courtEl.querySelector(".dua-pad") as HTMLElement).classList.toggle("dua-hidden", f.brain !== null);
    }

    const hot = isMatchPointRound(progress) && mode !== "keep";
    wrap.classList.toggle("mp", hot && !reduceMotion);
    mpTagEl.classList.toggle("dua-hidden", !hot);
    clockREl.textContent = roundLabel(sudden);
    stageTagEl.textContent = `${stage.emoji} ${stage.name}`;
    hcapTagEl.textContent = handicapLabel(handicapOn);
    hcapTagEl.classList.toggle("hot", handicapOn);
    msgEl.textContent = hot
      ? "赛点局!赢下这一回合就拿下整场,深呼吸,稳住节奏。"
      : mode === "keep"
        ? `守擂第 ${keepBout} 场:对手是${AI_SPECS[star.aiLevel ?? "rookie"].label},守住就继续。`
        : "准备——走到目标身上就收元气,出手能够得更远!";
    splashEl.classList.add("dua-hidden");
    skipShow = null;
    updateHud();
    api.play("tap");
  }

  function roundLabel(sudden: boolean): string {
    if (mode === "keep") return `守擂第 ${keepBout} 场`;
    return sudden ? "⚡ 决胜回合" : `第 ${roundIdx + 1} 回合`;
  }

  /* ---------------- HUD ---------------- */

  function updateHud(): void {
    for (const f of fighters) {
      f.scoreEl.textContent = String(f.score);
      f.winsEl.textContent = mode === "keep" ? "" : "★".repeat(progress.wins[f.seat]);
    }
    if (mode === "keep") {
      stageTagEl.textContent = `${stage.emoji} ${stage.name} · 连胜 ${keepWins}`;
    }
  }

  /* ---------------- 目标 ---------------- */

  function spawnFor(f: Fighter, ev: SpawnEvent): void {
    const spot = placeTarget(stage, ev.x, ev.y, TARGET_R, roundTime);
    const ttl = ev.ttl * (1 + f.boost) * stage.paceScale;
    f.targets.push({
      id: targetId++,
      kind: ev.kind,
      effect: ev.effect,
      x: spot.x,
      y: spot.y,
      born: ev.t,
      die: ev.t + ttl,
    });
  }

  function pushFloat(f: Fighter, text: string, color: string): void {
    f.floats.push({ text, color, x: f.x, y: f.y, until: roundTime + 0.8 });
    if (f.floats.length > 6) f.floats.shift();
  }

  function collect(f: Fighter, t: LiveTarget): void {
    const doubled = roundTime < f.doubleUntil;
    if (t.kind === "bomb") {
      f.score = applyTap(f.score, "bomb", doubled);
      if (isProtected(f.skills, roundTime)) {
        pushFloat(f, "🫧 泡泡挡住啦", "#4A90D9");
      } else {
        f.spinUntil = roundTime + BOMB_STUN_SECONDS;
        pushFloat(f, "💫 转晕了 -2", "#B06AB3");
      }
      api.play("oops");
      updateHud();
      return;
    }
    if (t.kind === "gift") {
      const effect = t.effect ?? "plus3";
      if (effect === "plus3") {
        f.score += 3;
        pushFloat(f, "🎉 +3", "#E8A93C");
        api.play("coin");
      } else if (effect === "freeze") {
        const o = other(f);
        if (isProtected(o.skills, roundTime)) {
          pushFloat(f, "🫧 对手有护盾", "#7A6A90");
        } else {
          o.frozenUntil = roundTime + FREEZE_SECONDS;
          pushFloat(f, "❄️ 冰住对手", "#4A90D9");
        }
        api.play("meow");
      } else {
        f.doubleUntil = roundTime + DOUBLE_SECONDS;
        pushFloat(f, "✨ 双倍星光", "#B06AB3");
        api.play("jump");
      }
      updateHud();
      return;
    }
    const delta = tapScore(t.kind, doubled);
    f.score = applyTap(f.score, t.kind, doubled);
    pushFloat(f, `+${delta}`, t.kind === "coin" ? "#E8A93C" : "#58B368");
    api.play(t.kind === "coin" ? "coin" : "pop");
    updateHud();
  }

  /* ---------------- 每帧推进 ---------------- */

  function stepFighter(f: Fighter, dt: number): void {
    f.skills = tickSkills(f.skills, roundTime);

    // 人机:大脑给指令
    if (f.brain) {
      const view: AiTargetView[] = f.targets.map((t) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        kind: t.kind,
        bornAt: t.born,
        dieAt: t.die,
      }));
      const cmd = thinkAi(f.brain, roundTime, { x: f.x, y: f.y }, view);
      if (cmd.skill) trySkillForAi(f);
      if (cmd.grab) grabForAi(f);
      moveBy(f, cmd.dx, cmd.dy, dt);
    } else {
      const v = moveVector(f.held);
      moveBy(f, v.x, v.y, dt);
    }

    // 弹开波:前摇跨过去的那一帧推对手一把
    if (waveJustFired(f.skills, prevTime, roundTime)) {
      const o = other(f);
      if (isProtected(o.skills, roundTime)) {
        pushFloat(o, "🫧 挡下来了", "#4A90D9");
      } else {
        const p = pushedPosition({ x: o.x, y: o.y }, { x: f.x, y: f.y });
        const c = clampToArena(stage, p.x, p.y, BODY_R, roundTime);
        o.x = c.x;
        o.y = c.y;
        o.spinUntil = roundTime + WAVE_SPIN_SECONDS;
        pushFloat(o, "🌀 被弹开,转个圈", "#8A5AA8");
        api.play("pop");
      }
    }

    // 目标出现 / 谢幕 / 被收走
    while (f.next < schedule.length && schedule[f.next].t <= roundTime) {
      spawnFor(f, schedule[f.next]);
      f.next++;
    }
    // 转圈或者被冰住的时候收不了东西,不然「站在目标上被冻住反而白捡」
    const busy = roundTime < f.spinUntil || roundTime < f.frozenUntil;
    const reach = grabRadius(f.grabStart, roundTime);
    const alive: LiveTarget[] = [];
    for (const t of f.targets) {
      if (roundTime > t.die) continue;
      if (busy) {
        alive.push(t);
        continue;
      }
      // 迷糊泡只按身位判定,出手够不到它(不会被「远程吸」到)
      const r = t.kind === "bomb" ? GRAB_BASE_RADIUS : reach;
      if (Math.hypot(t.x - f.x, t.y - f.y) <= r + TARGET_R * 0.5) {
        collect(f, t);
        continue;
      }
      alive.push(t);
    }
    f.targets = alive;
    f.floats = f.floats.filter((fl) => fl.until > roundTime);
  }

  function trySkillForAi(f: Fighter): void {
    if (roundTime < f.spinUntil || roundTime < f.frozenUntil) return;
    const res = castSkill(f.skills, roundTime);
    if (!res.started) return;
    f.skills = res.state;
    pushFloat(f, `${SKILLS[res.id].emoji} ${SKILLS[res.id].name}`, "#5A6AA8");
  }

  function grabForAi(f: Fighter): void {
    if (roundTime < f.spinUntil || roundTime < f.frozenUntil) return;
    if (!canGrab(f.grabStart, roundTime)) return;
    f.grabStart = roundTime;
  }

  function moveBy(f: Fighter, dx: number, dy: number, dt: number): void {
    if (roundTime < f.spinUntil || roundTime < f.frozenUntil) return;
    if (grabPhase(f.grabStart, roundTime) === "windup") return; // 前摇要站定,这是给对手的窗口
    const dash = isSkillActive(f.skills, "dash", roundTime) ? DASH_SPEED_SCALE : 1;
    const speed = BASE_SPEED * dash * (1 + f.boost);
    const w = f.courtEl.clientWidth || 336;
    const h = f.courtEl.clientHeight || 186;
    const aspect = h > 0 ? w / h : 1.8;
    const nx = f.x + dx * speed * dt;
    const ny = f.y + dy * speed * dt * aspect;
    const c = clampToArena(stage, nx, ny, BODY_R, roundTime);
    f.x = c.x;
    f.y = c.y;
  }

  /* ---------------- 回合结算 ---------------- */

  function endRound(): void {
    playing = false;
    const r: RoundResult = duo.score > star.score ? 0 : star.score > duo.score ? 1 : -1;
    if (mode === "keep") return endKeepBout(r);

    progress = pushRound(progress, r);
    updateHud();
    const line =
      r === -1
        ? `平局!${duo.score} : ${star.score}`
        : r === 0
          ? `🌸 朵朵拿下这回合 ${duo.score} : ${star.score}`
          : `⭐ 星星拿下这回合 ${star.score} : ${duo.score}`;
    api.play(r === -1 ? "pop" : "win");

    if (progress.done) {
      const champ = progress.winner === 0 ? duo : star;
      showSplash(
        `<div>${line}</div><div>🏆 ${champ.emoji} ${champ.name}赢下擂台赛!</div><div class="sub">回合比分 ${progress.wins[0]} : ${progress.wins[1]}</div>`,
        () => finishMatch(champ),
      );
      return;
    }
    roundIdx++;
    const nextSudden = progress.sudden;
    const tip = isMatchPointRound(progress) ? "下一回合就是赛点局,准备好!" : "换一张擂台,下一回合马上开始…";
    showSplash(`<div>${line}</div><div class="sub">${nextSudden ? "不分胜负,进入决胜回合!" : tip}</div>`, () =>
      startRound(nextSudden),
    );
  }

  function finishMatch(champ: Fighter): void {
    if (mode === "solo") {
      const spec = AI_SPECS[aiLevel];
      if (champ === duo) {
        const stars: 1 | 2 | 3 = aiLevel === "master" ? 3 : aiLevel === "pro" ? 3 : aiLevel === "normal" ? 2 : 1;
        api.onWin(stars, `你赢了${spec.label}档的对手!回合比分 ${progress.wins[0]} : ${progress.wins[1]}。`);
      } else {
        api.onLose(`${spec.label}档确实难缠,你已经逼到 ${progress.wins[0]} : ${progress.wins[1]} 了,换张擂台再来一场!`);
      }
      backToSetup();
      return;
    }
    api.onWin(1, `${champ.emoji} ${champ.name}赢下擂台赛!比分 ${progress.wins[0]} : ${progress.wins[1]},换个半场再来一场?`);
    backToSetup();
  }

  function endKeepBout(r: RoundResult): void {
    const held = r === 0; // 平局也算没守住,守擂要赢才算
    if (held) {
      keepWins++;
      keepBout++;
      updateHud();
      api.play("win");
      const nextAi = AI_SPECS[keepSetup(keepBout).ai];
      showSplash(
        `<div>🏰 守住了!这是第 ${keepWins} 场</div><div class="sub">下一位挑战者:${nextAi.emoji} ${nextAi.label}</div>`,
        () => startRound(false),
      );
      return;
    }
    api.play("oops");
    const best = save.recordEndlessBest(meta.id, keepWins);
    const fresh = keepWins > 0 && keepWins >= best;
    showSplash(
      `<div>🏰 守擂结束,连胜 ${keepWins} 场</div><div class="sub">${
        fresh ? `新纪录!最高连胜 ${best} 场` : `最高纪录还是 ${best} 场,再来一次就有机会`
      }</div>`,
      () => {
        api.onLose(
          keepWins > 0
            ? `守了 ${keepWins} 场,后面那几位是真的快!歇口气,换张擂台再守一次。`
            : "第一次守擂先摸清节奏就好,记住迷糊泡的位置,下一轮一定能守住。",
        );
        backToSetup();
      },
    );
  }

  function showSplash(html: string, next: () => void): void {
    splashEl.innerHTML = `${html}<div class="sub" style="margin-top:6px">(点一下可以跳过)</div>`;
    splashEl.classList.remove("dua-hidden");
    let done = false;
    const run = () => {
      if (done || destroyed) return;
      done = true;
      skipShow = null;
      splashEl.classList.add("dua-hidden");
      next();
    };
    skipShow = run;
    later(run, SHOW_MS);
  }

  function backToSetup(): void {
    playing = false;
    paused = false;
    life.clearTimers();
    skipShow = null;
    wrap.classList.remove("mp");
    splashEl.classList.add("dua-hidden");
    gameEl.classList.add("dua-hidden");
    setupEl.classList.remove("dua-hidden");
    renderSetup();
  }

  /* ---------------- 暂停 ---------------- */

  function togglePause(): void {
    if (!playing) return;
    paused = !paused;
    if (paused) {
      for (const f of fighters) f.held = {};
      splashEl.innerHTML = `<div>⏸ 暂停</div><div class="sub">Esc 或下面的按钮都能继续</div>
        <div class="row"><button type="button" class="dua-resume">继续 ▶</button>
        <button type="button" class="ghost dua-quit">退出擂台</button></div>`;
      splashEl.classList.remove("dua-hidden");
      (splashEl.querySelector(".dua-resume") as HTMLButtonElement).addEventListener("click", () => togglePause());
      (splashEl.querySelector(".dua-quit") as HTMLButtonElement).addEventListener("click", () => backToSetup());
    } else {
      splashEl.classList.add("dua-hidden");
    }
    api.play("tap");
  }

  /* ---------------- 画面 ---------------- */

  function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const a = (Math.PI * 2 * i) / 6;
      ctx.ellipse(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.46, r * 0.34, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#FFF3B0";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStarShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.46;
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dizzy: boolean): void {
    ctx.fillStyle = "#4A4266";
    if (dizzy) {
      ctx.font = `${Math.round(r * 0.8)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("@ @", x, y);
      return;
    }
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.08, Math.max(1, r * 0.11), 0, Math.PI * 2);
    ctx.arc(x + r * 0.28, y - r * 0.08, Math.max(1, r * 0.11), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#E07A9A";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.16, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  function drawCourt(f: Fighter): void {
    const ctx = f.canvas.getContext ? f.canvas.getContext("2d") : null;
    if (!ctx) return;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const w = f.canvas.width / dpr;
    const h = f.canvas.height / dpr;
    if (w <= 0 || h <= 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 底色与边界
    ctx.fillStyle = f.seat === SEAT_DUO ? "#FFE6F0" : "#E3EDFF";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stage.tint;
    ctx.beginPath();
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const ny = i / steps;
      const half = boundaryHalfWidth(stage, ny);
      const px = (0.5 - half) * w;
      const py = ny * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const ny = i / steps;
      const half = boundaryHalfWidth(stage, ny);
      ctx.lineTo((0.5 + half) * w, ny * h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(150,140,200,.45)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 地块
    for (const b of stage.blocks) {
      const r = blockRect(b, Math.max(0, roundTime));
      ctx.fillStyle = "rgba(170,160,215,.42)";
      const bx = r.x0 * w;
      const by = r.y0 * h;
      const bw = (r.x1 - r.x0) * w;
      const bh = (r.y1 - r.y0) * h;
      const rad = Math.min(8, bw / 2, bh / 2);
      ctx.beginPath();
      ctx.moveTo(bx + rad, by);
      ctx.lineTo(bx + bw - rad, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rad);
      ctx.lineTo(bx + bw, by + bh - rad);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rad, by + bh);
      ctx.lineTo(bx + rad, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rad);
      ctx.lineTo(bx, by + rad);
      ctx.quadraticCurveTo(bx, by, bx + rad, by);
      ctx.closePath();
      ctx.fill();
    }

    // 目标
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of f.targets) {
      const px = t.x * w;
      const py = t.y * h;
      const left = t.die - roundTime;
      ctx.globalAlpha = left < 0.5 && !reduceMotion ? 0.45 + 0.55 * (left / 0.5) : 1;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.arc(px, py, TARGET_R * w, 0, Math.PI * 2);
      ctx.fill();
      const icon = t.kind === "bloom" ? f.emoji : t.kind === "coin" ? "🪙" : t.kind === "bomb" ? "💫" : "🎁";
      ctx.font = `${Math.round(TARGET_R * w * 1.25)}px system-ui`;
      ctx.fillStyle = "#4A4266";
      ctx.fillText(icon, px, py + 1);
      ctx.globalAlpha = 1;
    }

    // 小人
    const bx = f.x * w;
    const by = f.y * h;
    const br = BODY_R * w;
    const dizzy = roundTime < f.spinUntil;
    const frozen = roundTime < f.frozenUntil;
    ctx.fillStyle = "rgba(90,80,140,.18)";
    ctx.beginPath();
    ctx.ellipse(bx, by + br * 0.9, br * 0.8, br * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (f.seat === SEAT_DUO) drawFlower(ctx, bx, by, br, f.color);
    else drawStarShape(ctx, bx, by, br * 1.12, f.color);
    drawFace(ctx, bx, by, br, dizzy);

    // 出手圈:生效那一段能够得更远,一眼看得出来
    const phase = grabPhase(f.grabStart, roundTime);
    if (phase !== "idle") {
      ctx.strokeStyle = phase === "active" ? "rgba(255,180,90,.95)" : "rgba(255,210,150,.6)";
      ctx.lineWidth = phase === "active" ? 3 : 2;
      ctx.beginPath();
      ctx.arc(bx, by, grabRadius(f.grabStart, roundTime) * w, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isProtected(f.skills, roundTime)) {
      ctx.strokeStyle = "rgba(120,200,255,.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by, br * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (frozen) {
      ctx.fillStyle = "rgba(160,220,255,.42)";
      ctx.beginPath();
      ctx.arc(bx, by, br * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (roundTime < f.doubleUntil) {
      ctx.font = `${Math.round(br * 0.9)}px system-ui`;
      ctx.fillText("✨", bx + br * 1.3, by - br * 1.1);
    }

    // 飘字
    for (const fl of f.floats) {
      const life = Math.max(0, fl.until - roundTime) / 0.8;
      ctx.globalAlpha = life;
      ctx.fillStyle = fl.color;
      ctx.font = `900 ${Math.max(12, Math.round(w * 0.042))}px system-ui`;
      ctx.fillText(fl.text, fl.x * w, fl.y * h - br * 1.6 - (1 - life) * 18);
      ctx.globalAlpha = 1;
    }

    // 左上角:下一招是什么、冷却走到哪了
    const skillId = f.skills.casting ? f.skills.casting.id : f.skills.current;
    const spec = SKILLS[skillId];
    const cd = cooldownRatio(f.skills, skillId, roundTime);
    ctx.font = `700 13px system-ui`;
    ctx.textAlign = "left";
    ctx.fillStyle = cd > 0 ? "rgba(120,110,160,.75)" : "#5A4A80";
    ctx.fillText(`${spec.emoji}${spec.name}${cd > 0 ? " 冷却中" : " 就绪"}`, 8, 14);
    if (f.aiLevel) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(90,80,130,.8)";
      ctx.fillText(`${AI_SPECS[f.aiLevel].emoji} ${AI_SPECS[f.aiLevel].label}人机`, w - 8, 14);
    }
    if (f.boost > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#B07A20";
      ctx.fillText(`🤝 让分 +${Math.round(f.boost * 100)}%`, 8, 30);
    }
    ctx.textAlign = "center";
  }

  /* ---------------- 主循环 ---------------- */

  let lastFrame = 0;
  let firstFrame = true;
  function frame(now: number): void {
    if (destroyed) return;
    if (firstFrame) {
      firstFrame = false;
      lastFrame = now;
      return;
    }
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    if (playing && !paused) {
      prevTime = roundTime;
      roundTime += dt;
      if (roundTime < 0) {
        clockTEl.textContent = String(Math.ceil(-roundTime));
      } else {
        clockTEl.textContent = String(Math.ceil(Math.max(0, roundDuration - roundTime)));
        for (const f of fighters) stepFighter(f, dt);
        if (roundTime >= roundDuration) endRound();
      }
      for (const f of fighters) drawCourt(f);
    }
  }

  /* ---------------- 按钮接线 ---------------- */

  q<HTMLButtonElement>(".dua-start").addEventListener("click", () => {
    api.play("jump");
    startMatch();
  });
  q<HTMLButtonElement>(".dua-pause").addEventListener("click", () => togglePause());
  q<HTMLButtonElement>(".dua-back").addEventListener("click", () => {
    api.play("tap");
    backToSetup();
  });
  q<HTMLButtonElement>(".dua-rulesbtn").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("dua-hidden");
  });
  q<HTMLButtonElement>(".dua-help").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("dua-hidden");
  });
  q<HTMLButtonElement>(".dua-rules-close").addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("dua-hidden");
  });
  splashEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    if (skipShow) skipShow();
  });

  for (const f of fighters) buildPad(f);
  renderAiChips();

  // 平台的 ?level=N 直达:擂台没有 188 关战役,就把关号映射成「人机档 + 场地」
  const level = parseLevelParam(typeof location !== "undefined" ? location.search : "");
  if (level !== null) {
    const setup = levelToSetup(level);
    mode = "solo";
    aiLevel = setup.ai;
    stageIndex = setup.stageIndex;
    renderAiChips();
    msgEl.textContent = setup.label;
  }
  renderSetup();

  life.loop(frame);

  return {
    destroy() {
      destroyed = true;
      playing = false;
      life.dispose();
      for (const f of fighters) {
        f.targets = [];
        f.floats = [];
        f.brain = null;
      }
      wrap.remove();
    },
  };
}
