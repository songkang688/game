import { meta } from "./meta";
export { meta };

import {
  TOTAL_LEVELS,
  chapterOf,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { AVATAR_URLS } from "../../ui/avatars";
import { save } from "../../engine/save";
import guide from "./guide";
import { CHAPTERS, LEVELS, type TugLevel } from "./levels";
import { adaptiveAiRate, mechanicsOf } from "./logic";
import { TOGGLE_MIN_H, TUG12, ropeSag, ropeShake } from "./tuning";
import {
  beatHitIndex,
  beatTrack,
  buildBeats,
  comebackStep,
  createComeback,
  createSide,
  lightGreenAt,
  nextBeatFrom,
  sideConfig,
  staminaRatio,
  stepSide,
  type ComebackState,
  type SideConfig,
  type SideState,
} from "./force";
import { AI_TIERS, aiController, type AiTier, type Controller } from "./ai";
import { AI_POWER_SCALE, PLAYER_POWER_SCALE, endlessSetup, levelSetup } from "./duel";
import {
  boundKeys,
  createDisposer,
  keySideOf,
  openLevelOnMap,
  parseLevelParam,
  resolveInitialLevel,
  sideLayout,
} from "./runtime";
import { fitFieldIntoStage } from "./fit";

export const RBG_CSS = `
.rbg-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0E4, #FFE4EC); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbg-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; align-items: center; }
.rbg-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; font-weight: 800; font-size: 15px; box-shadow: 0 2px 6px rgba(200,120,120,.25); }
.rbg-badge.rbg-badge-right { padding: 4px 4px 4px 12px; }
.rbg-ava { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; box-shadow: 0 1px 4px rgba(120,80,120,.3); }
.rbg-puller { width: 42px; height: 42px; border-radius: 50%; border: 3px solid #fff; object-fit: cover; box-shadow: 0 3px 8px rgba(120,80,120,.3); background: #fff; }
.rbg-team-red .rbg-puller { border-color: #FFB3B3; }
.rbg-team-blue .rbg-puller { border-color: #A9C6FF; }
.rbg-light { font-size: 26px; min-width: 34px; text-align: center; }
.rbg-field { position: relative; height: 124px; border-radius: 16px; background: linear-gradient(180deg, #E8F6DA 0 68%, #CFE8B8 68% 100%); overflow: hidden; margin-bottom: 8px; }
.rbg-team { position: absolute; top: 30px; font-size: 34px; }
.rbg-rope { position: absolute; top: 52px; height: 6px; background: linear-gradient(180deg, #D8A968, #B9853F); border-radius: 3px; }
.rbg-flag { position: absolute; top: 24px; font-size: 26px; }
.rbg-zone { position: absolute; top: 0; bottom: 0; width: 3px; background: rgba(200,80,80,.35); }
.rbg-mid { position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; margin-left: -1px; background: rgba(90,60,60,.35); }
.rbg-cushion { position: absolute; bottom: 6px; font-size: 26px; opacity: .55; }
.rbg-beat { position: absolute; top: 30px; font-size: 24px; pointer-events: none; will-change: transform; }
.rbg-beat-hot { filter: drop-shadow(0 0 6px #FFD36A); }
.rbg-supply { position: absolute; border: none; background: none; font-size: 32px; cursor: pointer; padding: 2px; }
.rbg-finale { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: rgba(255,250,244,.9); font-weight: 900; color: #B0555F; font-size: 16px; text-align: center; padding: 8px; }
.rbg-finale-row { font-size: 30px; letter-spacing: 4px; }
.rbg-gear { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; min-height: 22px; }
.rbg-chip { display: inline-flex; align-items: center; gap: 5px; background: #ffffffd9; border-radius: 999px; padding: 3px 11px; font-size: 14px; font-weight: 800; color: #B0555F; box-shadow: 0 2px 5px rgba(190,120,130,.2); }
.rbg-chip-hot { background: linear-gradient(180deg, #FFE0B2, #FFC98A); color: #97551A; }
.rbg-toggle { border: none; border-radius: 999px; padding: 5px 13px; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #7C6A9B; box-shadow: 0 3px 0 rgba(150,130,180,.25); display: inline-flex; align-items: center; justify-content: center; min-height: ${TOGGLE_MIN_H}px; }
.rbg-toggle[aria-pressed="true"] { background: linear-gradient(180deg, #FFD9A6, #FFC17E); color: #8A4E16; }
.rbg-toggle:focus-visible, .rbg-pull:focus-visible { outline: 3px solid #8A2F2F; outline-offset: 3px; }
.rbg-meters { display: flex; gap: 12px; margin-bottom: 8px; }
.rbg-meter-box { flex: 1; min-width: 0; }
.rbg-meter-cap { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: #8A5E66; margin-bottom: 3px; }
.rbg-meter { height: 16px; border-radius: 999px; background: #ffffffc4; overflow: hidden; box-shadow: inset 0 1px 3px rgba(160,110,110,.25); }
.rbg-meter-fill { height: 100%; width: 100%; border-radius: 999px; background: linear-gradient(90deg, #9BD6A0, #5EB877); transition: width .08s linear; }
.rbg-meter-mid .rbg-meter-fill { background: repeating-linear-gradient(45deg, #FFD08A 0 7px, #F5B463 7px 14px); }
.rbg-meter-low .rbg-meter-fill { background: repeating-linear-gradient(45deg, #F5A0A0 0 5px, #E06A6A 5px 10px); }
.rbg-ctrl { display: flex; justify-content: center; align-items: stretch; }
.rbg-pull { border: none; border-radius: 20px; font-size: 19px; font-weight: 900; color: #fff; background: linear-gradient(180deg, #FF8A8A, #E85555); cursor: pointer; box-shadow: 0 5px 0 #C23B3B; font-family: inherit; touch-action: none; line-height: 1.3; padding: 4px; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
.rbg-pull:active, .rbg-pull.rbg-down { transform: translateY(3px); box-shadow: 0 2px 0 #C23B3B; }
.rbg-pull.rbg-blue { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rbg-pull.rbg-blue:active, .rbg-pull.rbg-blue.rbg-down { box-shadow: 0 2px 0 #3B55C2; }
.rbg-pull.rbg-ghost { background: linear-gradient(180deg, #DCD3E8, #C4B8D6); box-shadow: 0 5px 0 #A79ABB; cursor: default; }
.rbg-sub { font-size: 13px; font-weight: 700; opacity: .92; }
.rbg-msg { text-align: center; min-height: 22px; color: #B0555F; font-weight: 700; margin-top: 8px; font-size: 15px; }
/* 拔河场退到底线 76px 还装不下时（320×640 实测差 37px）由 fitFieldIntoStage() 打上。
   只减空隙——外框内边距 12→6、四处块间距 8→4、提示行上边距 8→4，一共让出 32px；
   按钮一格不动，热区还是 44px 以上。剩下的几像素由场地再让一让。 */
.rbg-wrap.rbg-tight { padding: 6px; }
.rbg-wrap.rbg-tight .rbg-top,
.rbg-wrap.rbg-tight .rbg-gear,
.rbg-wrap.rbg-tight .rbg-field,
.rbg-wrap.rbg-tight .rbg-meters { margin-bottom: 4px; }
.rbg-wrap.rbg-tight .rbg-msg { margin-top: 4px; }
/* 空隙减半也不够的那一档（320×568 后段章节：机关胶囊排到三行）。
   真机实测第 188 关：这一屏 403px、可视段只有 332px，.rbg-msg 整条 0px 可见
   （「按住蓄力、松手换气…」孩子看不到就不知道这一关怎么玩），
   两颗大按钮也被切掉 25px，第二行「按住 F / 空格」压没了。W5R3-B-02
   这一档收的是字号与内边距，不是热区：.rbg-toggle 的 44px 一格不动，
   两颗大按钮由 fit.ts 逐档扣到 MIN_PULL_H=56 为止，仍在 44 以上。
   important 标记是必需的：胶囊和提示行的字号是 JS 按视口算完写成内联样式的，
   不加就压不过内联值（--rbg-pull-h 那条同理）。 */
.rbg-wrap.rbg-tighter .rbg-gear { gap: 5px; min-height: 0; margin-bottom: 3px; }
.rbg-wrap.rbg-tighter .rbg-chip { padding: 2px 8px; font-size: 12px !important; gap: 4px; }
.rbg-wrap.rbg-tighter .rbg-msg { font-size: 13px !important; min-height: 16px; line-height: 1.25; margin-top: 3px; }
.rbg-wrap.rbg-tighter .rbg-meter-cap { font-size: 12px; margin-bottom: 2px; }
.rbg-wrap.rbg-tighter .rbg-meter { height: 12px; }
.rbg-wrap.rbg-tighter .rbg-meters { gap: 8px; }
.rbg-wrap.rbg-tighter .rbg-pull { height: var(--rbg-pull-h, auto) !important; font-size: 17px; }
@media (prefers-reduced-motion: reduce) {
  .rbg-beat, .rbg-team, .rbg-rope { transition: none !important; }
}
`;

const SHELL_CSS = `
.rbg-bar { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none}，这里补回来 */
.rbg-bar[hidden] { display: none; }
/* 模式入口那两颗：只靠 padding 撑出来是 40px 高，比手指按得准的下限矮 4px */
.rbg-open { border: none; border-radius: 999px; padding: 10px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #FF9A9A, #E36A6A); box-shadow: 0 4px 0 #BF4A4A; display: inline-flex; align-items: center; justify-content: center; min-height: ${TOGGLE_MIN_H}px; }
.rbg-open.rbg-open-vs { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 4px 0 #3B55C2; }
.rbg-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #BF4A4A; }
.rbg-open:focus-visible { outline: 3px solid #8A2F2F; outline-offset: 3px; }
.rbg-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
/* 侧模式和关卡里都靠它退出去，只靠 padding 撑出来是 31px 高，比手指按得准的下限矮 13px */
.rbg-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #B0555F; box-shadow: 0 3px 0 rgba(190,120,130,.28); display: inline-flex; align-items: center; justify-content: center; min-height: ${TOGGLE_MIN_H}px; }
.rbg-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(190,120,130,.28); }
.rbg-over { position: absolute; inset: 0; border-radius: 16px; background: rgba(255,248,250,.96); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rbg-over-title { font-size: 22px; font-weight: 900; color: #B0555F; }
.rbg-over-sub { font-size: 15px; font-weight: 700; color: #8F6068; line-height: 1.6; max-width: 300px; }
.rbg-btn { border: none; border-radius: 18px; padding: 12px 22px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #FF9A9A, #E36A6A); box-shadow: 0 5px 0 #BF4A4A; }
.rbg-btn.rbg-ghost2 { background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rbg-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #BF4A4A; }
.rbg-picks { display: flex; flex-direction: column; gap: 8px; }
.rbg-pick { border: none; border-radius: 16px; padding: 10px 14px; font-size: 15px; font-weight: 900; cursor: pointer; font-family: inherit; text-align: left; background: #fff; color: #7A4A72; box-shadow: 0 3px 0 rgba(170,130,170,.3); }
.rbg-pick:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(170,130,170,.3); }
.rbg-pick-note { display: block; font-size: 13px; font-weight: 700; color: #8E7A96; margin-top: 2px; }
`;

// ---------------------------------------------------------------------------
// 一局拔河:关卡 / 对战 / 无尽共用同一套手感
// ---------------------------------------------------------------------------

/** 一局的全部参数;三种模式各自拼一份出来 */
interface RunSpec {
  /** 朵朵满力每秒拉多少 */
  playerPower: number;
  /** 对面满力每秒拉多少 */
  rivalPower: number;
  /** 对面是第几档小电脑;null 表示同屏双人 */
  tier: AiTier | null;
  playerStamina: Partial<SideConfig>;
  rivalStamina: Partial<SideConfig>;
  beatGapScale: number;
  redlight: boolean;
  /** 要不要左右手交替(节奏鼓点章) */
  offhand: boolean;
  aiAdapt: number;
  supply: boolean;
  seed: number;
  hint: string;
  chips: string[];
}

interface RunHooks {
  sfx: (name: "tap" | "coin" | "oops" | "win" | "jump" | "pop" | "meow") => void;
  onEnd: (winner: "red" | "blue", seconds: number) => void;
  /** 反拉开关的读写(整台机器共用一份设置) */
  settings: { comeback: boolean };
}

interface TugRun {
  root: HTMLElement;
  destroy: () => void;
}

function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return !!mm?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 380;
}

function runTug(spec: RunSpec, hooks: RunHooks): TugRun {
  const gone = createDisposer();
  const duo = spec.tier === null;
  const reduced = prefersReducedMotion();
  const layout = sideLayout(viewportWidth());
  let ended = false;
  let startAt = 0;
  let lastTime = 0;
  /** -100(星星队赢) .. +100(朵朵队赢) */
  let rope = 0;

  const playerCfg = sideConfig(spec.playerStamina);
  const rivalCfg = sideConfig(spec.rivalStamina);
  let player: SideState = createSide(playerCfg);
  let rival: SideState = createSide(rivalCfg);
  let playerCb: ComebackState = createComeback();
  let rivalCb: ComebackState = createComeback();
  let playerBeatFrom = 0;
  let rivalBeatFrom = 0;
  let playerFactor = 0;
  let rivalFactor = 0;
  let handPenalty = 1;
  let lastHand: "L" | "R" | null = null;
  let buffUntil = -1;
  let rivalBuffUntil = -1;

  const beats = buildBeats(spec.seed, 120_000, spec.beatGapScale);
  const brain: Controller | null = spec.tier ? aiController(spec.tier, spec.seed + 17) : null;

  /** 左右两个按钮此刻按着没有 */
  const down = { L: false, R: false };

  const wrap = document.createElement("div");
  wrap.className = "rbg-wrap";
  const rivalName = duo ? "🔵 星星队 · 玩家 2" : `🔵 星星队 · ${spec.tier?.emoji ?? ""}${spec.tier?.name ?? "小电脑"}`;
  wrap.innerHTML = `
    <style>${RBG_CSS}</style>
    <div class="rbg-top">
      <span class="rbg-badge" style="color:#C24545"><img class="rbg-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />🔴 朵朵队 · 你</span>
      ${spec.redlight ? '<span class="rbg-light" role="img" aria-label="红绿灯">🟢</span>' : ""}
      <span class="rbg-badge rbg-badge-right" style="color:#3576BF">${rivalName}<img class="rbg-ava" src="${AVATAR_URLS.xingxing}" alt="星星" /></span>
    </div>
    <div class="rbg-gear"></div>
    <div class="rbg-field">
      <div class="rbg-zone" style="left:15%"></div>
      <div class="rbg-zone" style="right:15%"></div>
      <div class="rbg-mid"></div>
      <div class="rbg-cushion" style="left:4%">🛋️</div>
      <div class="rbg-cushion" style="right:4%">🛋️</div>
      <div class="rbg-team rbg-red rbg-team-red"><img class="rbg-puller" src="${AVATAR_URLS.duoduo}" alt="朵朵在拔河" /></div>
      <div class="rbg-rope"></div>
      <div class="rbg-flag">🚩</div>
      <div class="rbg-team rbg-blue-team rbg-team-blue"><img class="rbg-puller" src="${AVATAR_URLS.xingxing}" alt="星星在拔河" /></div>
    </div>
    <div class="rbg-meters">
      <div class="rbg-meter-box rbg-box-left">
        <div class="rbg-meter-cap"><span>💪 朵朵体力</span><span class="rbg-pct-left">100%</span></div>
        <div class="rbg-meter rbg-meter-left" role="img" aria-label="朵朵的体力条"><div class="rbg-meter-fill"></div></div>
      </div>
      <div class="rbg-meter-box rbg-box-right">
        <div class="rbg-meter-cap"><span class="rbg-pct-right">100%</span><span>星星体力 💪</span></div>
        <div class="rbg-meter rbg-meter-right" role="img" aria-label="星星的体力条"><div class="rbg-meter-fill"></div></div>
      </div>
    </div>
    <div class="rbg-ctrl"></div>
    <div class="rbg-msg"></div>
  `;

  const fieldEl = wrap.querySelector(".rbg-field") as HTMLElement;
  const flagEl = wrap.querySelector(".rbg-flag") as HTMLElement;
  const ropeEl = wrap.querySelector(".rbg-rope") as HTMLElement;
  const redEl = wrap.querySelector(".rbg-red") as HTMLElement;
  const blueEl = wrap.querySelector(".rbg-blue-team") as HTMLElement;
  const lightEl = wrap.querySelector(".rbg-light") as HTMLElement | null;
  const msgEl = wrap.querySelector(".rbg-msg") as HTMLElement;
  const gearEl = wrap.querySelector(".rbg-gear") as HTMLElement;
  const ctrlEl = wrap.querySelector(".rbg-ctrl") as HTMLElement;
  const meterLeft = wrap.querySelector(".rbg-meter-left") as HTMLElement;
  const meterRight = wrap.querySelector(".rbg-meter-right") as HTMLElement;
  const fillLeft = meterLeft.firstElementChild as HTMLElement;
  const fillRight = meterRight.firstElementChild as HTMLElement;
  const pctLeft = wrap.querySelector(".rbg-pct-left") as HTMLElement;
  const pctRight = wrap.querySelector(".rbg-pct-right") as HTMLElement;

  msgEl.textContent = spec.hint;
  msgEl.style.fontSize = `${layout.fontSize + 1}px`;

  // ---- 机关胶囊 + 反拉开关 ----
  for (const chip of spec.chips) {
    const el = document.createElement("span");
    el.className = "rbg-chip";
    el.textContent = chip;
    el.style.fontSize = `${layout.fontSize}px`;
    gearEl.appendChild(el);
  }
  const cbBtn = document.createElement("button");
  cbBtn.type = "button";
  cbBtn.className = "rbg-toggle";
  cbBtn.style.fontSize = `${layout.fontSize}px`;
  const paintToggle = (): void => {
    cbBtn.setAttribute("aria-pressed", hooks.settings.comeback ? "true" : "false");
    cbBtn.textContent = hooks.settings.comeback ? "🔥 拼一把 开" : "🔥 拼一把 关";
    cbBtn.title = "落后太多时给落后的一方 2 秒加力窗口";
  };
  paintToggle();
  gone.listen(cbBtn, "click", () => {
    hooks.settings.comeback = !hooks.settings.comeback;
    paintToggle();
    hooks.sfx("tap");
  });
  gearEl.appendChild(cbBtn);

  // ---- 两侧大按钮 ----
  function makeButton(hand: "L" | "R"): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `rbg-pull${hand === "R" && duo ? " rbg-blue" : ""}`;
    btn.style.width = `${layout.width}px`;
    btn.style.height = `${layout.height}px`;
    btn.style.fontSize = `${Math.max(layout.fontSize + 3, 17)}px`;
    if (hand === "R") btn.style.marginLeft = `${layout.gap}px`;
    const label = duo
      ? hand === "L"
        ? "朵朵<span class='rbg-sub'>按住 F</span>"
        : "星星<span class='rbg-sub'>按住 K</span>"
      : spec.offhand
        ? hand === "L"
          ? "👈 左手<span class='rbg-sub'>按住蓄力</span>"
          : "右手 👉<span class='rbg-sub'>换手才有劲</span>"
        : hand === "L"
          ? "🪢 用力拉<span class='rbg-sub'>按住 F / 空格</span>"
          : "🪢 用力拉<span class='rbg-sub'>两只手都行</span>";
    btn.innerHTML = label;
    btn.setAttribute("aria-label", duo ? (hand === "L" ? "朵朵拉绳" : "星星拉绳") : "拉绳");
    return btn;
  }
  const btnL = makeButton("L");
  const btnR = makeButton("R");
  ctrlEl.append(btnL, btnR);

  // 转屏 / 改窗口大小时重算两侧按钮,窄屏上也保证 ≥72px 与中间的隔离带
  gone.listen(globalThis as unknown as { addEventListener?: never }, "resize", () => {
    const next = sideLayout(viewportWidth());
    for (const btn of [btnL, btnR]) {
      btn.style.width = `${next.width}px`;
      btn.style.height = `${next.height}px`;
    }
    btnR.style.marginLeft = `${next.gap}px`;
  });

  function setDown(hand: "L" | "R", on: boolean): void {
    if (ended) return;
    if (down[hand] === on) return;
    down[hand] = on;
    const btn = hand === "L" ? btnL : btnR;
    btn.classList.toggle("rbg-down", on);
    if (on && !duo && spec.offhand) {
      // 节奏鼓点章:连着用同一只手只使得出半力
      handPenalty = lastHand === hand ? TUG12.OFFHAND_FACTOR : 1;
      if (handPenalty < 1) msgEl.textContent = "同一只手连着拉使不上劲,左右轮着来!";
      lastHand = hand;
    }
  }

  for (const [hand, btn] of [["L", btnL], ["R", btnR]] as const) {
    gone.listen<PointerEvent>(btn, "pointerdown", (e) => {
      e.preventDefault();
      setDown(hand, true);
      btn.setPointerCapture?.(e.pointerId);
      hooks.sfx("tap");
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
      gone.listen<PointerEvent>(btn, type, () => setDown(hand, false));
    }
  }

  // ---- 两套键位 ----
  const keys = boundKeys(duo);
  const keyTarget = globalThis as unknown as {
    addEventListener?: (t: string, f: EventListener) => void;
    removeEventListener?: (t: string, f: EventListener) => void;
  };
  gone.listen<KeyboardEvent>(keyTarget, "keydown", (e) => {
    if (e.repeat || !keys.includes(e.code)) return;
    const side = keySideOf(e.code, duo);
    if (!side) return;
    e.preventDefault();
    setDown(side === "red" ? "L" : "R", true);
  });
  gone.listen<KeyboardEvent>(keyTarget, "keyup", (e) => {
    const side = keySideOf(e.code, duo);
    if (!side) return;
    setDown(side === "red" ? "L" : "R", false);
  });

  // ---- 加油点的画面 ----
  const beatEls: HTMLElement[] = [];
  for (let i = 0; i < 3; i++) {
    const el = document.createElement("div");
    el.className = "rbg-beat";
    el.textContent = "🎈";
    el.style.display = "none";
    fieldEl.appendChild(el);
    beatEls.push(el);
  }

  function renderBeats(nowMs: number): void {
    let slot = 0;
    const start = nextBeatFrom(beats, nowMs - TUG12.BEAT_TRAVEL_MS);
    if (start >= 0) {
      for (let i = start; i < beats.length && slot < beatEls.length; i++) {
        const track = beatTrack(beats[i], nowMs);
        if (beats[i] - nowMs > TUG12.BEAT_TRAVEL_MS) break;
        const el = beatEls[slot++];
        el.style.display = "";
        el.style.left = `${8 + ((track + 1) / 2) * 84}%`;
        el.classList.toggle("rbg-beat-hot", Math.abs(beats[i] - nowMs) <= TUG12.BEAT_WINDOW_MS);
      }
    }
    for (let i = slot; i < beatEls.length; i++) beatEls[i].style.display = "none";
  }

  // ---- 补给 ----
  if (spec.supply) {
    const spawn = (): void => {
      if (ended) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rbg-supply";
      btn.textContent = "🧤";
      btn.setAttribute("aria-label", "抢防滑粉");
      btn.style.left = `${18 + Math.random() * 60}%`;
      btn.style.top = `${6 + Math.random() * 30}%`;
      let taken = false;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (ended || taken) return;
        taken = true;
        btn.remove();
        hooks.sfx("coin");
        buffUntil = performance.now() + TUG12.SUPPLY_MS;
        msgEl.textContent = "🧤 防滑粉到手!接下来几秒抓得更稳!";
      });
      fieldEl.appendChild(btn);
      gone.timer(
        setTimeout(() => {
          if (!taken) {
            taken = true;
            btn.remove();
            if (ended) return;
            rivalBuffUntil = performance.now() + TUG12.SUPPLY_MS;
            msgEl.textContent = "💧 补给被对面拿走了,稳住自己的节奏!";
          }
        }, 1600) as unknown as number
      );
      gone.timer(setTimeout(spawn, TUG12.SUPPLY_MS + 1200) as unknown as number);
    };
    gone.timer(setTimeout(spawn, 2600) as unknown as number);
  }

  // ---- 画面 ----
  function renderMeter(box: HTMLElement, fill: HTMLElement, pct: HTMLElement, ratio: number, winded: boolean): void {
    fill.style.width = `${Math.round(ratio * 100)}%`;
    box.classList.toggle("rbg-meter-mid", !winded && ratio < 0.55 && ratio >= 0.28);
    box.classList.toggle("rbg-meter-low", winded || ratio < 0.28);
    pct.textContent = winded ? "喘口气 😮‍💨" : `${Math.round(ratio * 100)}%`;
  }

  function render(nowMs: number): void {
    const flagPct = 50 - (rope / TUG12.ROPE_WIN) * 35;
    const shake = ropeShake(playerFactor + rivalFactor, reduced);
    const wobble = shake ? Math.sin(nowMs / 26) * shake : 0;
    flagEl.style.left = `calc(${flagPct}% - 13px)`;
    flagEl.style.top = `${24 + ropeSag(playerFactor + rivalFactor) * 0.4}px`;
    ropeEl.style.left = `calc(${flagPct}% - 92px)`;
    ropeEl.style.width = "184px";
    ropeEl.style.height = `${Math.max(4, 8 - ropeSag(playerFactor + rivalFactor) * 0.3)}px`;
    ropeEl.style.transform = `translateY(${wobble * 0.4}px)`;
    redEl.style.left = `calc(${flagPct}% - 142px)`;
    blueEl.style.left = `calc(${flagPct}% + 68px)`;
    // 力量越大人越往后仰
    redEl.style.transform = `rotate(${-8 * Math.min(1.4, playerFactor)}deg) translateX(${wobble * 0.3}px)`;
    blueEl.style.transform = `rotate(${8 * Math.min(1.4, rivalFactor)}deg) translateX(${-wobble * 0.3}px)`;
    renderMeter(meterLeft, fillLeft, pctLeft, staminaRatio(player, playerCfg), player.winded);
    renderMeter(meterRight, fillRight, pctRight, staminaRatio(rival, rivalCfg), rival.winded);
    renderBeats(nowMs);
  }

  function finish(winner: "red" | "blue"): void {
    if (ended) return;
    ended = true;
    const seconds = (performance.now() - startAt) / 1000;
    down.L = false;
    down.R = false;
    const loser = winner === "red" ? "星星队" : "朵朵队";
    const fin = document.createElement("div");
    fin.className = "rbg-finale";
    fin.innerHTML = `<div class="rbg-finale-row">🛋️ 😄 😄</div><div>${loser}一屁股坐到软垫上,两队都笑成一团!</div>`;
    fieldEl.appendChild(fin);
    hooks.sfx(winner === "red" ? "win" : "pop");
    gone.timer(setTimeout(() => hooks.onEnd(winner, seconds), 900) as unknown as number);
  }

  // ---- 主循环 ----
  function tick(now: number): void {
    if (ended) return;
    const dt = Math.min(0.06, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    const nowMs = now - startAt;
    const green = spec.redlight ? lightGreenAt(nowMs) : true;
    if (lightEl) lightEl.textContent = green ? "🟢" : "🔴";

    const pressPlayer = duo ? down.L : down.L || down.R;
    let pressRival = false;
    if (brain) {
      pressRival = brain({
        nowMs,
        side: rival,
        cfg: rivalCfg,
        rope: -rope,
        green,
        beats,
        nextBeat: nextBeatFrom(beats, nowMs),
      });
    } else {
      pressRival = down.R;
    }

    const stepP = stepSide(player, pressPlayer, dt, playerCfg);
    const stepR = stepSide(rival, pressRival, dt, rivalCfg);
    player = stepP.side;
    rival = stepR.side;
    if (!pressPlayer) handPenalty = 1;

    const cbP = comebackStep(playerCb, rope, 1, nowMs, hooks.settings.comeback);
    const cbR = comebackStep(rivalCb, rope, -1, nowMs, hooks.settings.comeback);
    playerCb = cbP.state;
    rivalCb = cbR.state;
    if (cbP.opened) {
      msgEl.textContent = "🔥 拼一把!这 2 秒你的力气 +15%,一口气拉回来!";
      hooks.sfx("jump");
    }

    let rivalPower = spec.rivalPower;
    if (spec.aiAdapt) {
      rivalPower = adaptiveAiRate({ aiRate: rivalPower, aiAdapt: spec.aiAdapt } as TugLevel, rope);
    }
    if (performance.now() < rivalBuffUntil) rivalPower *= TUG12.SUPPLY_GAIN;

    let delta = 0;
    if (!green && pressPlayer) {
      delta -= TUG12.SLIP_PER_SEC * dt;
      playerFactor = 0;
      msgEl.textContent = "🔴 红灯拉绳会打滑,松手等绿灯!";
    } else {
      const buff = performance.now() < buffUntil ? TUG12.SUPPLY_GAIN : 1;
      playerFactor = stepP.factor * handPenalty * (1 + cbP.gain) * buff;
      delta += playerFactor * spec.playerPower * dt;
    }
    if (!green && pressRival) {
      delta += TUG12.SLIP_PER_SEC * dt;
      rivalFactor = 0;
    } else {
      rivalFactor = stepR.factor * (1 + cbR.gain);
      delta -= rivalFactor * rivalPower * dt;
    }

    if (green && stepP.pressEdge) {
      const hit = beatHitIndex(beats, nowMs, stepP.edgeRestMs, playerBeatFrom);
      if (hit >= 0) {
        playerBeatFrom = hit + 1;
        delta += TUG12.BEAT_IMPULSE;
        hooks.sfx("coin");
        msgEl.textContent = "🎈 加油点踩准了!额外拉一大把!";
      }
    }
    if (green && stepR.pressEdge) {
      const hit = beatHitIndex(beats, nowMs, stepR.edgeRestMs, rivalBeatFrom);
      if (hit >= 0) {
        rivalBeatFrom = hit + 1;
        delta -= TUG12.BEAT_IMPULSE;
      }
    }

    if (player.winded && pressPlayer) msgEl.textContent = "💪 体力见底,力气只剩三成,松手喘两口再发力!";

    rope = Math.max(-TUG12.ROPE_WIN, Math.min(TUG12.ROPE_WIN, rope + delta));
    render(nowMs);
    if (rope >= TUG12.ROPE_WIN) {
      finish("red");
      return;
    }
    if (rope <= -TUG12.ROPE_WIN) {
      finish("blue");
      return;
    }
    gone.raf(requestAnimationFrame(tick));
  }

  startAt = performance.now();
  lastTime = startAt;
  render(0);
  gone.raf(
    requestAnimationFrame((t) => {
      lastTime = t;
      startAt = t;
      gone.raf(requestAnimationFrame(tick));
    })
  );

  return {
    root: wrap,
    destroy() {
      ended = true;
      gone.dispose();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function levelSpec(level: number): RunSpec {
  const cfg = LEVELS[level];
  const setup = levelSetup(level);
  const gears = mechanicsOf(cfg);
  const chips = [`${setup.tier.emoji} 对手 ${setup.tier.name}`, ...gears.map((g) => `🎯 ${g}`)];
  if (cfg.redlight) chips.push("🚦 红灯别拉");
  return {
    playerPower: setup.playerPower * (setup.offhand ? 0.92 : 1),
    rivalPower: setup.aiPower,
    tier: setup.tier,
    playerStamina: setup.stamina,
    rivalStamina: {},
    beatGapScale: setup.beatGapScale,
    redlight: setup.redlight,
    offhand: setup.offhand,
    aiAdapt: setup.aiAdapt,
    supply: !!cfg.supply,
    seed: 31 + level * 7,
    hint: setup.offhand
      ? "左右手轮着按住:蓄力半秒,再狠狠拉一把!"
      : cfg.redlight
        ? "看到 🟢 才按住拉,🔴 时松手歇着攒体力!"
        : "按住蓄力、松手换气,🎈 过中线时按下去额外拉一把!",
    chips,
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx, settings: { comeback: boolean }): PlayHandle {
  let done = false;
  const run = runTug(levelSpec(ctx.level), {
    sfx: (name) => ctx.sfx(name),
    settings,
    onEnd: (winner, secs) => {
      if (done) return;
      done = true;
      if (winner === "red") {
        const got = secs <= 16 ? 3 : secs <= 28 ? 2 : 1;
        ctx.win(got as 1 | 2 | 3, `只用 ${Math.round(secs)} 秒就把小旗拉过线,发力的节奏踩得很准!`);
      } else {
        ctx.lose("这局星星队先过线。下一局试试「歇半秒、拉一秒」的节奏,再把 🎈 加油点踩上,力气就够用了!");
      }
    },
  });
  stage.appendChild(run.root);
  // 360×640 上这一屏比舞台看得见的那一段高 63px、320×640 上高 95px，
  // 掉在裁切线以下的正是 `.rbg-msg`——红绿灯章唯一那句规则说明（W5R2-FC-03）
  const fit = fitFieldIntoStage(run.root);
  return {
    destroy: () => {
      fit.dispose();
      run.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:四档小电脑 + 同屏双人
// ---------------------------------------------------------------------------

type VersusPick = { kind: "ai"; tier: AiTier } | { kind: "duo" };

function versusSpec(pick: VersusPick, seed: number): RunSpec {
  const base = 3.1 * PLAYER_POWER_SCALE;
  if (pick.kind === "duo") {
    return {
      playerPower: base,
      rivalPower: base,
      tier: null,
      playerStamina: {},
      rivalStamina: {},
      beatGapScale: 0.9,
      redlight: false,
      offhand: false,
      aiAdapt: 0,
      supply: false,
      seed,
      hint: "两个人各按一边:朵朵按住 F,星星按住 K,谁先把小旗拉过线谁赢!",
      chips: ["👫 同屏双人", "🎈 加油点双方共用"],
    };
  }
  const idx = AI_TIERS.indexOf(pick.tier);
  return {
    playerPower: base,
    rivalPower: (10 + idx * 2.4) * AI_POWER_SCALE,
    tier: pick.tier,
    playerStamina: {},
    rivalStamina: {},
    beatGapScale: 0.9,
    redlight: false,
    offhand: false,
    aiAdapt: idx >= 3 ? 0.1 : 0,
    supply: false,
    seed,
    hint: `${pick.tier.emoji} ${pick.tier.name}:${pick.tier.blurb}`,
    chips: [`${pick.tier.emoji} 第 ${idx + 1} 档 · ${pick.tier.name}`, "🎈 加油点双方共用"],
  };
}

function mountVersus(
  host: HTMLElement,
  api: GameApi,
  settings: { comeback: boolean },
  onExit: () => void
): { destroy: () => void } {
  const gone = createDisposer();
  let run: TugRun | null = null;
  let fit: { dispose: () => void } | null = null;
  let seed = 101;
  let redWins = 0;
  let blueWins = 0;

  const wrap = document.createElement("div");
  wrap.className = "rbg-wrap";
  wrap.innerHTML = `
    <style>${RBG_CSS}${SHELL_CSS}</style>
    <div class="rbg-head">
      <button class="rbg-back" type="button">🗺️ 回关卡</button>
      <span class="rbg-chip rbg-score"></span>
    </div>
    <div class="rbg-stage"></div>
  `;
  host.appendChild(wrap);
  const stageEl = wrap.querySelector(".rbg-stage") as HTMLElement;
  const scoreEl = wrap.querySelector(".rbg-score") as HTMLElement;

  function paintScore(): void {
    scoreEl.textContent = `🏆 朵朵 ${redWins} : ${blueWins} 星星`;
  }

  function showPicker(): void {
    fit?.dispose();
    fit = null;
    run?.destroy();
    run = null;
    stageEl.innerHTML = "";
    paintScore();
    const box = document.createElement("div");
    box.className = "rbg-picks";
    const title = document.createElement("div");
    title.className = "rbg-over-title";
    title.textContent = "选一个对手";
    box.appendChild(title);
    const picks: Array<{ label: string; note: string; pick: VersusPick }> = AI_TIERS.map((tier, i) => ({
      label: `${tier.emoji} 第 ${i + 1} 档 · ${tier.name}`,
      note: tier.blurb,
      pick: { kind: "ai", tier },
    }));
    picks.push({ label: "👫 同屏双人", note: "朵朵按住 F,星星按住 K,也可以一人按一边屏幕。", pick: { kind: "duo" } });
    for (const p of picks) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rbg-pick";
      btn.innerHTML = `${p.label}<span class="rbg-pick-note">${p.note}</span>`;
      gone.listen(btn, "click", () => {
        api.play("tap");
        startRound(p.pick);
      });
      box.appendChild(btn);
    }
    stageEl.appendChild(box);
  }

  function startRound(pick: VersusPick): void {
    fit?.dispose();
    fit = null;
    run?.destroy();
    stageEl.innerHTML = "";
    seed += 13;
    run = runTug(versusSpec(pick, seed), {
      sfx: (name) => api.play(name),
      settings,
      onEnd: (winner) => {
        if (winner === "red") redWins++;
        else blueWins++;
        paintScore();
        api.play(winner === "red" ? "win" : "pop");
        const ov = document.createElement("div");
        ov.className = "rbg-over";
        ov.innerHTML = `
          <div style="font-size:44px;line-height:1">${winner === "red" ? "🏅" : "🪢"}</div>
          <div class="rbg-over-title">${winner === "red" ? "朵朵队把小旗拉过线啦!" : "星星队这一局更稳!"}</div>
          <div class="rbg-over-sub">${
            winner === "red"
              ? "蓄力—发力—换气的节奏踩得漂亮,再换个更强的对手试试?"
              : "别急,下一局把 🎈 加油点踩上,再把体力条留在一半以上,就能拉回来。"
          }</div>`;
        const btns = document.createElement("div");
        btns.style.display = "flex";
        btns.style.gap = "10px";
        btns.style.flexWrap = "wrap";
        btns.style.justifyContent = "center";
        const again = document.createElement("button");
        again.type = "button";
        again.className = "rbg-btn";
        again.textContent = "🔁 再来一局";
        gone.listen(again, "click", () => {
          api.play("tap");
          ov.remove();
          startRound(pick);
        });
        const other = document.createElement("button");
        other.type = "button";
        other.className = "rbg-btn rbg-ghost2";
        other.textContent = "🔀 换对手";
        gone.listen(other, "click", () => {
          api.play("tap");
          ov.remove();
          showPicker();
        });
        btns.append(again, other);
        ov.appendChild(btns);
        wrap.appendChild(ov);
      },
    });
    stageEl.appendChild(run.root);
    fit = fitFieldIntoStage(run.root);
    paintScore();
  }

  gone.listen(wrap.querySelector(".rbg-back") as HTMLButtonElement, "click", () => {
    api.play("tap");
    onExit();
  });
  showPicker();

  return {
    destroy() {
      fit?.dispose();
      fit = null;
      run?.destroy();
      run = null;
      gone.dispose();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「拉不完的绳」:一局接一局,对手随连胜变强
// ---------------------------------------------------------------------------

function endlessSpec(streak: number, seed: number): RunSpec {
  const setup = endlessSetup(streak);
  return {
    playerPower: setup.playerPower,
    rivalPower: setup.aiPower,
    tier: setup.tier,
    playerStamina: {},
    rivalStamina: {},
    beatGapScale: setup.beatGapScale,
    redlight: setup.redlight,
    offhand: false,
    aiAdapt: 0,
    supply: false,
    seed,
    hint:
      streak === 0
        ? "赢一局就换一个更会拔的对手,看你能连胜几局!"
        : `第 ${streak + 1} 个对手是 ${setup.tier.emoji}${setup.tier.name}${setup.redlight ? ",还带红绿灯裁判" : ""},稳住节奏!`,
    chips: [`${setup.tier.emoji} 对手 ${setup.tier.name}`, `🔥 已连胜 ${streak}`],
  };
}

function mountEndless(
  host: HTMLElement,
  api: GameApi,
  settings: { comeback: boolean },
  onExit: () => void
): { destroy: () => void } {
  const gone = createDisposer();
  let streak = 0;
  let run: TugRun | null = null;
  let fit: { dispose: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  const wrap = document.createElement("div");
  wrap.className = "rbg-wrap";
  wrap.innerHTML = `
    <style>${RBG_CSS}${SHELL_CSS}</style>
    <div class="rbg-head">
      <button class="rbg-back" type="button">🗺️ 回关卡</button>
      <span class="rbg-chip rbg-round"></span>
      <span class="rbg-chip rbg-best"></span>
    </div>
    <div class="rbg-stage"></div>
  `;
  host.appendChild(wrap);
  const stageEl = wrap.querySelector(".rbg-stage") as HTMLElement;
  const roundEl = wrap.querySelector(".rbg-round") as HTMLElement;
  const bestEl = wrap.querySelector(".rbg-best") as HTMLElement;

  function paintHead(): void {
    roundEl.textContent = `🪢 第 ${streak + 1} 局 · 已连胜 ${streak}`;
    bestEl.textContent = best > 0 ? `🏅 最高连胜 ${best}` : "🏅 还没有纪录";
  }

  function gameOver(): void {
    run?.destroy();
    run = null;
    const record = streak > best;
    if (streak > 0) best = save.recordEndlessBest(meta.id, streak);
    const bonus = Math.min(6, Math.floor(streak / 2));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");

    const ov = document.createElement("div");
    ov.className = "rbg-over";
    ov.innerHTML = `
      <div style="font-size:46px;line-height:1">${record ? "🏅" : "🪢"}</div>
      <div class="rbg-over-title">${record ? `新纪录 ${streak} 连胜!` : `这趟连胜 ${streak} 局`}</div>
      <div class="rbg-over-sub">${
        record
          ? `一局比一局难拔,你居然扛住了 ${streak} 个对手!${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`
          : `最高连胜 ${best} 局,换口气再来一趟就有机会追上。${bonus > 0 ? `这趟也拿到 ${bonus} 颗小星星。` : ""}`
      }</div>`;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "rbg-btn";
    again.textContent = "🔁 再拔一趟";
    gone.listen(again, "click", () => {
      api.play("tap");
      ov.remove();
      streak = 0;
      startRound();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "rbg-btn rbg-ghost2";
    back.textContent = "🗺️ 回关卡";
    gone.listen(back, "click", () => {
      api.play("tap");
      onExit();
    });
    btns.append(again, back);
    ov.appendChild(btns);
    wrap.appendChild(ov);
    paintHead();
  }

  function startRound(): void {
    fit?.dispose();
    fit = null;
    run?.destroy();
    stageEl.innerHTML = "";
    paintHead();
    run = runTug(endlessSpec(streak, 61 + streak * 9), {
      sfx: (name) => api.play(name),
      settings,
      onEnd: (winner) => {
        if (winner === "red") {
          streak++;
          api.play("win");
          paintHead();
          gone.timer(setTimeout(startRound, 700) as unknown as number);
        } else {
          gone.timer(setTimeout(gameOver, 300) as unknown as number);
        }
      },
    });
    stageEl.appendChild(run.root);
    fit = fitFieldIntoStage(run.root);
  }

  gone.listen(wrap.querySelector(".rbg-back") as HTMLButtonElement, "click", () => {
    api.play("tap");
    onExit();
  });
  startRound();

  return {
    destroy() {
      fit?.dispose();
      fit = null;
      run?.destroy();
      run = null;
      gone.dispose();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

/** 壳层给的 `initialLevel`(1 基),没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

export function mount(api: GameApi): { destroy: () => void } {
  const settings = { comeback: true };
  const root = document.createElement("div");
  const barStyle = document.createElement("style");
  barStyle.textContent = SHELL_CSS;
  const bar = document.createElement("div");
  bar.className = "rbg-bar";
  const levelHost = document.createElement("div");
  const sideHost = document.createElement("div");
  sideHost.hidden = true;
  root.append(barStyle, bar, levelHost, sideHost);
  api.root.appendChild(root);

  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "rbg-open rbg-open-vs";
  vsBtn.textContent = "⚔️ 对战 · 四档小电脑 / 同屏双人";
  const endBtn = document.createElement("button");
  endBtn.type = "button";
  endBtn.className = "rbg-open";
  bar.append(vsBtn, endBtn);

  let side: { destroy: () => void } | null = null;
  /** 关卡正在跑没有:侧模式的入口靠它挡住,别把关卡层只藏不销毁(W5R2-C-06) */
  let inLevel = false;

  function refreshBtn(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endBtn.textContent = best > 0 ? `♾️ 拉不完的绳 · 最高 ${best} 连胜` : "♾️ 拉不完的绳 · 点我开拔!";
  }

  function closeSide(): void {
    side?.destroy();
    side = null;
    sideHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBtn();
  }

  function openSide(make: () => { destroy: () => void }): void {
    if (side) return;
    // 关卡正在跑就不许再开一层。`bar.hidden` 只是让手指够不着,焦点残留、
    // 壳层补发的 click、自动化脚本照样能把它点响 —— 点响了关卡层就只被 hidden 藏起来,
    // 两条 requestAnimationFrame 与两套定时器一起跑到天荒地老(W5R2-C-06)。
    if (inLevel) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    sideHost.hidden = false;
    side = make();
  }

  vsBtn.addEventListener("click", () => openSide(() => mountVersus(sideHost, api, settings, closeSide)));
  endBtn.addEventListener("click", () => openSide(() => mountEndless(sideHost, api, settings, closeSide)));
  refreshBtn();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 真下到某一关里就把这两个入口收起来：360px 宽上它俩排不下、要折成两行，
      // 连同外边距占掉 106px。舞台一共才看得见 530px，两颗 132×76 的
      // 「🪢 用力拉」整排掉在裁切线以下，触屏一下都拉不动（W5R2-C-05）。
      // 顺带堵上 W5R2-C-06：关卡进行中点得着 ♾️ 的话，关卡层只被 hidden 藏起来，
      // 两条 requestAnimationFrame 会同时跑。回选关地图就放回去。
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        inLevel = true;
        const handle = playLevel(stage, ctx, settings);
        return {
          destroy: () => {
            inLevel = false;
            handle?.destroy?.();
            // 对战场 / 无尽开着的时候这一条本来就该收着，别替它放回来
            if (!side) bar.hidden = false;
          },
        };
      },
      guide,
      mapHint: "按住蓄力、松手换气,踩着 🎈 加油点发力,十大赛场等你称王!",
      grandMessage: "188 场拔河全部拉赢,大力士奖杯归你!",
    }
  );

  // 壳层或地址栏点名了某一关就直接开进去,不用玩家再在地图上找一遍
  const target = resolveInitialLevel(
    wantedLevel(api),
    furthestPlayable(loadStars(meta.id), loadSkips(meta.id), TOTAL_LEVELS),
    TOTAL_LEVELS
  );
  if (target !== null) {
    try {
      openLevelOnMap(levelHost, target, chapterOf(CHAPTERS, target));
    } catch (err) {
      console.warn("[一朵一星] red-blue-tug 直开关卡失败,停在地图上:", err);
    }
  }

  return {
    destroy() {
      side?.destroy();
      side = null;
      level.destroy();
      root.remove();
    },
  };
}
