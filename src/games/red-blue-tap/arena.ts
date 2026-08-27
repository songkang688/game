/**
 * 红蓝点点 · 1.2 对战场与「点到手软」无尽。
 *
 * 这一份只管画面与接线,判分一律走 `rounds.ts` 的纯函数:
 *  · `versus` 同屏两侧:左朵朵、右星星,一轮只生成**一份** `RoundPlan`,
 *    左侧位序 p 与右侧位序 n-1-p 指向同一个逻辑格子,所以两边难度严格镜像;
 *  · 抢点判定的时间戳全部由 `createDuel(plan, now)` 里那一个 `now()` 盖,
 *    界面拿不到、也塞不进自己的时钟;
 *  · 每一下点击都先过 `createTapGate`(60ms 去抖 + 手掌拍连坐),再谈得分;
 *  · 一个人玩时右侧交给小电脑,四档反应 600 / 420 / 300 / 220ms,每一档都会失手;
 *  · 无尽「点到手软」四种回合随机、窗口越来越短,失误三次结束,成绩记**撑过的回合数**。
 *
 * 样式全部 `rbt-` 前缀(拔河那款用的是 rbg 前缀,不会撞),只追加不改老规则。
 */
import { save } from "../../engine/save";
import { AVATAR_URLS } from "../../ui/avatars";
import type { GameApi } from "../level99";
import { isNewRecord } from "./logic";
import { meta } from "./meta";
import {
  AI_TIERS,
  COLOR_FACE,
  ENDLESS_MISS_LIMIT,
  PALM_WINDOW_MS,
  ROUND_KINDS,
  SLOT_COUNT,
  aiMisses,
  aiReactionMs,
  buildRound,
  createDuel,
  endlessAiTier,
  endlessGapMs,
  endlessLiveMs,
  endlessRoundKind,
  isMirrored,
  logicalSlot,
  roundBrief,
  slotPos,
  type Duel,
  type RoundKind,
  type RoundPlan,
  type Side
} from "./rounds";

/** 两侧热区之间的隔离带:手机上也不许小于这个数,避免一只手误触另一边 */
export const SIDE_GUTTER_PX = 24;
/** 按钮边长下限 */
export const KEY_MIN_PX = 72;
/** 矮屏上收一档的按钮边长：仍然高出 44px 的触屏底线 */
export const KEY_TIGHT_PX = 56;
/** 按钮之间的间隙 */
export const PAD_GAP_PX = 8;
/** 矮屏上的间隙 */
export const PAD_TIGHT_GAP_PX = 6;
/** 「矮屏」的门槛：640 高的老安卓机上，一竖排四颗 72px 的键塞不进去 */
export const SHORT_SCREEN_PX = 700;
/**
 * 对战面板里键盘上面那一截（返回条 + 比分 + 回合说明 + 分工名）实测占的高度。
 * 测试员在 320×640 上量到第 4 颗键的盒子是 top 607 / bottom 677，
 * 一竖排的前三颗键占 3×(72+8)=240，倒推出上面这一截约 367px。
 */
export const VERSUS_CHROME_PX = 367;

export interface PadLayout {
  columns: number;
  keyPx: number;
  gap: number;
}

/**
 * 一侧键盘怎么排。宽屏与窄高屏维持原样（键不缩水），
 * 只有**又窄又矮**的机器收回 2×2 并把键降一档——那种机器上竖排根本摆不下四颗，
 * 而且全链路没有可滚容器，够不着就是真的够不着（测试员 W5-B-02，判阻断）。
 */
export function padLayout(viewportWidth: number, viewportHeight: number): PadLayout {
  const vw = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 360;
  const vh = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 720;
  if (vw > 420) return { columns: 2, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX };
  if (vh > SHORT_SCREEN_PX) return { columns: 1, keyPx: KEY_MIN_PX, gap: PAD_GAP_PX };
  return { columns: 2, keyPx: KEY_TIGHT_PX, gap: PAD_TIGHT_GAP_PX };
}

/** 一侧键盘占多高 */
export function padHeightPx(layout: PadLayout, slots = SLOT_COUNT): number {
  const rows = Math.ceil(Math.max(1, slots) / Math.max(1, layout.columns));
  return rows * layout.keyPx + (rows - 1) * layout.gap;
}

/** 一侧键盘占多宽 */
export function padWidthPx(layout: PadLayout): number {
  return layout.columns * layout.keyPx + (layout.columns - 1) * layout.gap;
}
/** 触屏可点元素的最小边长 */
export const TOUCH_MIN_PX = 44;

/** 一局对战先到几分 */
export const VERSUS_TARGET = 7;

/** 两套键位:左手 A S D F、右手 J K L ;,`destroy` 时两套一起卸 */
export const KEYS_LEFT = ["a", "s", "d", "f"];
export const KEYS_RIGHT = ["j", "k", "l", ";"];

export const ARENA_CSS = `
.rbt-vs { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E7F1FF, #FFEAF2); border-radius: 16px; padding: 12px; user-select: none; touch-action: manipulation; position: relative; }
.rbt-vs-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
/* 触屏底线 ${TOUCH_MIN_PX}px：这两颗原来只有 34px 高，是本款仅有的两处不到底线的热区。
   只抬高不动配色圆角；inline-flex 居中，免得文字贴着上边。 */
.rbt-vs-back, .rbt-vs-mode { border: none; border-radius: 999px; padding: 8px 14px; font-size: 15px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffdd; color: #3F5C9A; box-shadow: 0 3px 0 rgba(90,110,170,.28); min-height: ${TOUCH_MIN_PX}px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; }
.rbt-vs-back:active, .rbt-vs-mode:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(90,110,170,.28); }
.rbt-vs-back:focus-visible, .rbt-vs-mode:focus-visible { outline: 3px solid #2F4E86; outline-offset: 3px; }
.rbt-vs-tag { background: #ffffffd6; border-radius: 999px; padding: 5px 12px; font-size: 14px; font-weight: 800; color: #5B7FC9; }
.rbt-vs-score { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 18px; font-weight: 900; color: #3F5C9A; margin-bottom: 6px; }
.rbt-vs-ava { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; }
.rbt-vs-brief { text-align: center; min-height: 46px; font-size: 16px; font-weight: 800; color: #3F5C9A; line-height: 1.5; margin-bottom: 8px; }
.rbt-vs-brief-hint { display: block; font-size: 13px; font-weight: 700; color: #7286AE; }
.rbt-vs-body { display: flex; align-items: stretch; justify-content: center; }
.rbt-vs-gap { flex: 0 0 ${SIDE_GUTTER_PX}px; min-width: ${SIDE_GUTTER_PX}px; align-self: stretch; }
.rbt-vs-side { flex: 1 1 0; min-width: 0; background: #ffffffa8; border-radius: 16px; padding: 8px; }
.rbt-vs-name { text-align: center; font-size: 14px; font-weight: 900; color: #5B7FC9; margin-bottom: 6px; }
.rbt-pad { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.rbt-key { position: relative; min-width: ${KEY_MIN_PX}px; min-height: ${KEY_MIN_PX}px; border: 3px solid #ffffff; border-radius: 18px; background: #E7EBF3; color: #9AA6BE; font-size: 30px; font-weight: 900; font-family: inherit; cursor: pointer; padding: 0; transition: background .18s ease, color .18s ease, transform .1s ease; }
.rbt-key:focus-visible { outline: 3px solid #2F4E86; outline-offset: 3px; }
.rbt-key-lit { color: #fff; box-shadow: 0 5px 0 rgba(70,90,150,.28); }
.rbt-key-lit:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(70,90,150,.28); }
.rbt-key-hit { filter: saturate(.4) brightness(1.12); }
.rbt-key-hit::after { content: "✓"; position: absolute; right: 4px; top: 2px; font-size: 16px; color: #ffffff; }
.rbt-key-bad { background: #FFE1E6 !important; color: #C24545 !important; }
.rbt-key-num { position: absolute; left: 4px; bottom: 2px; font-size: 15px; font-weight: 900; color: #ffffffe8; }
.rbt-key-cap { position: absolute; right: 6px; bottom: 3px; font-size: 13px; font-weight: 900; color: currentColor; opacity: .8; letter-spacing: .04em; }
.rbt-vs-foot { text-align: center; font-size: 13px; font-weight: 700; color: #7286AE; margin-top: 8px; line-height: 1.6; }
.rbt-vs-cloud { text-align: center; min-height: 20px; font-size: 14px; font-weight: 800; color: #8C7FBF; }
.rbt-vs-over { position: absolute; inset: 0; border-radius: 16px; background: rgba(248,251,255,.96); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 20px; }
.rbt-vs-over-title { font-size: 22px; font-weight: 900; color: #3F5C9A; }
.rbt-vs-over-sub { font-size: 15px; font-weight: 700; color: #5E729B; line-height: 1.6; max-width: 320px; }
.rbt-vs-btn { border: none; border-radius: 18px; padding: 12px 24px; font-size: 16px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #7FA8FF, #5577E8); box-shadow: 0 5px 0 #3B55C2; }
.rbt-vs-btn.rbt-vs-ghost { background: linear-gradient(180deg, #F0A0C0, #DB6E9B); box-shadow: 0 5px 0 #B14E79; }
.rbt-vs-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #3B55C2; }
.rbt-ready .rbt-key { animation: rbtBreath 1s ease-in-out infinite; }
@keyframes rbtBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(.97); } }
@media (max-width: 420px) {
  .rbt-vs { padding: 10px 6px; }
  /* 360px 上塞不下两侧各两列 72px 的按钮，改成每侧一竖排：
     按钮不缩水，中间那条 ${SIDE_GUTTER_PX}px 的隔离带也保得住 */
  .rbt-pad { grid-template-columns: 1fr; gap: 8px; }
  .rbt-vs-side { padding: 6px; }
  .rbt-key { min-width: ${KEY_MIN_PX}px; min-height: ${KEY_MIN_PX}px; font-size: 26px; }
  .rbt-vs-gap { flex-basis: ${SIDE_GUTTER_PX}px; }
  .rbt-vs-brief { font-size: 16px; }
}
@media (max-width: 420px) and (max-height: ${SHORT_SCREEN_PX}px) {
  /* 又窄又矮的老机器（320×640 这种）：一竖排四颗 72px 的键要 ${KEY_MIN_PX * 4 + PAD_GAP_PX * 3}px 高，
     第 4 颗整个掉到屏幕外，而且全链路没有可滚容器，那一侧玩家等于少一颗键。
     收回每侧 2×2 并把边长降到 ${KEY_TIGHT_PX}px——仍然高出 44px 的触屏底线，
     中间那条 ${SIDE_GUTTER_PX}px 的隔离带一分不动。 */
  .rbt-pad { grid-template-columns: repeat(2, 1fr); gap: ${PAD_TIGHT_GAP_PX}px; }
  .rbt-key { min-width: ${KEY_TIGHT_PX}px; min-height: ${KEY_TIGHT_PX}px; font-size: 22px; }
  .rbt-vs { padding: 8px 6px; }
  .rbt-vs-brief { min-height: 38px; font-size: 15px; }
  .rbt-vs-foot { margin-top: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .rbt-key { transition: background .3s linear, color .3s linear; }
  .rbt-ready .rbt-key { animation: none; }
}
`;

type Mode = "duo" | "solo";

interface PadHandle {
  root: HTMLElement;
  keys: HTMLButtonElement[];
}

function buildPad(side: Side, caps: string[], showCaps: boolean): PadHandle {
  const root = document.createElement("div");
  root.className = "rbt-pad";
  const keys: HTMLButtonElement[] = [];
  for (let pos = 0; pos < SLOT_COUNT; pos++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rbt-key";
    b.dataset.pos = String(pos);
    b.dataset.side = side;
    if (showCaps) b.dataset.cap = caps[pos].toUpperCase();
    // 第一轮还没开画之前先摆个空位,免得开局那半秒是四个空白框
    const dot = document.createElement("span");
    dot.textContent = "·";
    b.appendChild(dot);
    if (b.dataset.cap) {
      const cap = document.createElement("span");
      cap.className = "rbt-key-cap";
      cap.textContent = b.dataset.cap;
      b.appendChild(cap);
    }
    root.appendChild(b);
    keys.push(b);
  }
  return { root, keys };
}

/** 把一份计划画到某一侧的按钮上:位序 → 逻辑格子走 `logicalSlot`,镜像就在这里成立 */
function paintPad(pad: PadHandle, plan: RoundPlan, lit: boolean): void {
  for (let pos = 0; pos < pad.keys.length; pos++) {
    const side = (pad.keys[pos].dataset.side ?? "left") as Side;
    const slot = logicalSlot(side, pos, plan.slots.length);
    const face = COLOR_FACE[plan.slots[slot]];
    const b = pad.keys[pos];
    b.className = `rbt-key${lit ? " rbt-key-lit" : ""}`;
    b.style.background = lit ? face.hex : "#E7EBF3";
    b.style.color = lit ? "#fff" : "#9AA6BE";
    b.textContent = "";
    const glyph = document.createElement("span");
    glyph.textContent = lit ? face.shape : "·";
    b.appendChild(glyph);
    if (b.dataset.cap) {
      // 键帽每次重画都要补回来:paintPad 会把按钮里的东西全清一遍
      const cap = document.createElement("span");
      cap.className = "rbt-key-cap";
      cap.textContent = b.dataset.cap;
      b.appendChild(cap);
    }
    if (plan.kind === "order" && lit) {
      const at = plan.order.indexOf(slot);
      if (at >= 0) {
        const num = document.createElement("span");
        num.className = "rbt-key-num";
        num.textContent = String(at + 1);
        b.appendChild(num);
      }
    }
    const label = lit
      ? `${face.name}色${face.shape}${plan.kind === "order" && plan.order.includes(slot) ? ` ${plan.order.indexOf(slot) + 1} 号` : ""}`
      : "还没亮";
    b.setAttribute("aria-label", label);
  }
}

function markKey(pad: PadHandle, pos: number, cls: "rbt-key-hit" | "rbt-key-bad"): void {
  pad.keys[pos]?.classList.add(cls);
}

// ---------------------------------------------------------------------------
// 同屏两侧对战
// ---------------------------------------------------------------------------

export function mountVersus(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const offs: Array<() => void> = [];
  let destroyed = false;
  let over = false;
  let mode: Mode = "duo";
  let aiLevel = 1;
  let score: Record<Side, number> = { left: 0, right: 0 };
  let round = 0;
  let duel: Duel | null = null;

  const wrap = document.createElement("div");
  wrap.className = "rbt-vs";
  wrap.innerHTML = `
    <style>${ARENA_CSS}</style>
    <div class="rbt-vs-head">
      <button class="rbt-vs-back" type="button">🗺️ 回关卡</button>
      <button class="rbt-vs-mode" type="button"></button>
      <span class="rbt-vs-tag">先到 ${VERSUS_TARGET} 分</span>
    </div>
    <div class="rbt-vs-score">
      <img class="rbt-vs-ava" src="${AVATAR_URLS.duoduo}" alt="朵朵" />
      <span class="rbt-vs-left">0</span>
      <span>:</span>
      <span class="rbt-vs-right">0</span>
      <img class="rbt-vs-ava" src="${AVATAR_URLS.xingxing}" alt="星星" />
    </div>
    <div class="rbt-vs-brief"></div>
    <div class="rbt-vs-body">
      <div class="rbt-vs-side rbt-vs-side-left"><div class="rbt-vs-name">朵朵 · A S D F</div></div>
      <div class="rbt-vs-gap" aria-hidden="true"></div>
      <div class="rbt-vs-side rbt-vs-side-right"><div class="rbt-vs-name rbt-vs-name-right">星星 · J K L ;</div></div>
    </div>
    <div class="rbt-vs-cloud"></div>
    <div class="rbt-vs-foot">两边的题目是镜像的：同样的颜色、同样的号码，只是左右翻过来，谁也不吃亏。</div>
  `;
  host.appendChild(wrap);

  const leftSide = wrap.querySelector(".rbt-vs-side-left") as HTMLElement;
  const rightSide = wrap.querySelector(".rbt-vs-side-right") as HTMLElement;
  const briefEl = wrap.querySelector(".rbt-vs-brief") as HTMLElement;
  const cloudEl = wrap.querySelector(".rbt-vs-cloud") as HTMLElement;
  const leftScoreEl = wrap.querySelector(".rbt-vs-left") as HTMLElement;
  const rightScoreEl = wrap.querySelector(".rbt-vs-right") as HTMLElement;
  const modeBtn = wrap.querySelector(".rbt-vs-mode") as HTMLButtonElement;
  const rightNameEl = wrap.querySelector(".rbt-vs-name-right") as HTMLElement;
  const bodyEl = wrap.querySelector(".rbt-vs-body") as HTMLElement;

  const pads: Record<Side, PadHandle> = {
    left: buildPad("left", KEYS_LEFT, true),
    right: buildPad("right", KEYS_RIGHT, true)
  };
  leftSide.appendChild(pads.left.root);
  rightSide.appendChild(pads.right.root);

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function clearTimers(): void {
    timeouts.forEach((t) => clearTimeout(t));
    timeouts.clear();
  }

  function renderScore(): void {
    leftScoreEl.textContent = String(score.left);
    rightScoreEl.textContent = String(score.right);
    modeBtn.textContent = mode === "duo" ? "👫 两个人玩" : `🤖 挑战星星 · ${AI_TIERS[aiLevel].name}`;
    rightNameEl.textContent = mode === "duo" ? "星星 · J K L ;" : `小电脑 · ${AI_TIERS[aiLevel].name}`;
  }

  /** 同一个时钟源:两侧的抢点判定都从这里取时间 */
  function now(): number {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function tapFrom(side: Side, pos: number): void {
    if (!duel || over) return;
    if (mode === "solo" && side === "right") return;
    const d = duel;
    const plan = d.plan;
    const res = d.tap(side, pos);
    const pad = pads[side];
    if (res.outcome === "debounce") return;
    if (res.outcome === "palm") {
      for (const k of pad.keys) k.classList.remove("rbt-key-hit");
      cloudEl.textContent = "☁️ 一整只手拍上去啦，小云朵把这一轮收走了——一个一个点才算数";
      api.play("oops");
      settleIfDone();
      return;
    }
    if (res.outcome === "early") {
      markKey(pad, pos, "rbt-key-bad");
      cloudEl.textContent = "☁️ 亮之前先点啦，小云朵挡了一下，下一轮等一等";
      api.play("oops");
      settleIfDone();
      return;
    }
    if (res.outcome === "wrong") {
      markKey(pad, pos, "rbt-key-bad");
      cloudEl.textContent = "这一个不该点，下一轮再来～";
      api.play("oops");
      settleIfDone();
      return;
    }
    if (res.outcome === "good" || res.outcome === "win") {
      markKey(pad, pos, "rbt-key-hit");
      api.play("pop");
      if (res.outcome !== "win") return;
      settleIfDone();
      // 抢点回合一分定胜负，没必要干等窗口走完；
      // 但要多留一个「手掌拍」的窗口，好让一巴掌拍出来的胜利还来得及撤回。
      if (duel === d && plan.kind !== "count") {
        later(() => {
          if (duel === d) endRound();
        }, PALM_WINDOW_MS + 40);
      }
    }
  }

  function settleIfDone(): void {
    if (!duel || over) return;
    if (!duel.settled()) return;
    endRound();
  }

  function endRound(): void {
    if (!duel || over) return;
    const r = duel.finish();
    duel = null;
    bodyEl.classList.remove("rbt-ready");
    // 这一轮翻篇了就把「亮啦！」收掉，免得下一轮的预备还挂着上一轮的招牌
    briefEl.textContent = "这一轮结束，下一轮马上来……";
    score = {
      left: Math.max(0, score.left + r.delta.left),
      right: Math.max(0, score.right + r.delta.right)
    };
    renderScore();
    if (r.winner) cloudEl.textContent = r.winner === "left" ? "朵朵这轮又快又准！" : "星星这轮拿下！";
    else if (r.delta.left > 0 || r.delta.right > 0) cloudEl.textContent = "点得刚刚好，两边都有分！";
    if (score.left >= VERSUS_TARGET || score.right >= VERSUS_TARGET) {
      finish();
      return;
    }
    later(nextRound, 780);
  }

  function scheduleAi(plan: RoundPlan, d: Duel): void {
    if (mode !== "solo") return;
    if (aiMisses(aiLevel, Math.random)) {
      // 这一轮小电脑看漏了:一档也不给完美反应
      return;
    }
    const react = aiReactionMs(aiLevel, Math.random);
    const seq = plan.kind === "order" ? plan.order.slice() : plan.targets.slice();
    const wanted = plan.kind === "count" ? seq.slice(0, plan.need) : seq;
    const step = Math.max(170, Math.round(react * 0.6));
    wanted.forEach((slot, i) => {
      later(() => {
        if (over || duel !== d) return;
        d.tap("right", slotPos("right", slot, plan.slots.length));
        settleIfDone();
      }, plan.readyMs + react + i * step);
    });
  }

  function nextRound(): void {
    if (over || destroyed) return;
    round++;
    const kind: RoundKind = ROUND_KINDS[(round - 1) % ROUND_KINDS.length];
    const plan = buildRound(kind, Math.random, { liveMs: Math.max(900, 1900 - round * 40) });
    // 两侧共用这一份计划,镜像不成立就直接不开这一轮(界面再怎么改也破不了公平)
    if (!isMirrored(plan)) {
      later(nextRound, 60);
      return;
    }
    const brief = roundBrief(plan);
    briefEl.innerHTML = `${brief.icon} ${brief.text}<span class="rbt-vs-brief-hint">预备……${brief.hint}</span>`;
    paintPad(pads.left, plan, false);
    paintPad(pads.right, plan, false);
    bodyEl.classList.add("rbt-ready");
    cloudEl.textContent = "";

    const d = createDuel(plan, now, ["left", "right"]);
    duel = d;

    later(() => {
      if (over || duel !== d) return;
      bodyEl.classList.remove("rbt-ready");
      paintPad(pads.left, plan, true);
      paintPad(pads.right, plan, true);
      briefEl.innerHTML = `${brief.icon} ${brief.text}<span class="rbt-vs-brief-hint">亮啦！${brief.hint}</span>`;
      api.play("tap");
    }, plan.readyMs);

    later(() => {
      if (over || duel !== d) return;
      endRound();
    }, plan.readyMs + plan.liveMs + 60);

    scheduleAi(plan, d);
  }

  function finish(): void {
    if (over) return;
    over = true;
    duel = null;
    clearTimers();
    const leftWon = score.left >= score.right;
    api.play("win");
    const ov = document.createElement("div");
    ov.className = "rbt-vs-over";
    const who = mode === "duo" ? (leftWon ? "朵朵这边" : "星星这边") : leftWon ? "你" : "小电脑";
    ov.innerHTML = `
      <div style="font-size:44px;line-height:1">${leftWon ? "🎉" : "💫"}</div>
      <div class="rbt-vs-over-title">${score.left} : ${score.right}　${who}赢下这一场</div>
      <div class="rbt-vs-over-sub">${
        leftWon
          ? "又准又稳，这才是红蓝点点的赢法——手快不算数，点对才算数。"
          : "这场差一点点，下一场先把指令读完再出手，稳住就追得上！"
      }</div>
    `;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "rbt-vs-btn";
    again.textContent = "🔁 再来一场";
    again.addEventListener("click", () => {
      api.play("tap");
      ov.remove();
      restart();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "rbt-vs-btn rbt-vs-ghost";
    back.textContent = "🗺️ 回关卡";
    back.addEventListener("click", () => {
      api.play("tap");
      onExit();
    });
    btns.append(again, back);
    ov.appendChild(btns);
    wrap.appendChild(ov);
  }

  function restart(): void {
    over = false;
    round = 0;
    score = { left: 0, right: 0 };
    duel = null;
    clearTimers();
    renderScore();
    briefEl.textContent = "预备……看清楚这一轮要做什么再出手";
    cloudEl.textContent = "";
    later(nextRound, 700);
  }

  // --- 两套键位:左手一套、右手一套,destroy 时两套都要卸 ---------------------
  const onKeyLeft = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const pos = KEYS_LEFT.indexOf(e.key.toLowerCase());
    if (pos < 0) return;
    e.preventDefault();
    tapFrom("left", pos);
  };
  const onKeyRight = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const pos = KEYS_RIGHT.indexOf(e.key.toLowerCase());
    if (pos < 0) return;
    e.preventDefault();
    tapFrom("right", pos);
  };
  window.addEventListener("keydown", onKeyLeft);
  window.addEventListener("keydown", onKeyRight);
  offs.push(() => window.removeEventListener("keydown", onKeyLeft));
  offs.push(() => window.removeEventListener("keydown", onKeyRight));

  for (const side of ["left", "right"] as Side[]) {
    for (const b of pads[side].keys) {
      const handler = (e: Event) => {
        e.preventDefault();
        tapFrom(side, Number(b.dataset.pos ?? 0));
      };
      b.addEventListener("pointerdown", handler);
      offs.push(() => b.removeEventListener("pointerdown", handler));
    }
  }

  modeBtn.addEventListener("click", () => {
    api.play("tap");
    if (mode === "duo") {
      mode = "solo";
      aiLevel = 0;
    } else if (aiLevel < AI_TIERS.length - 1) {
      aiLevel++;
    } else {
      mode = "duo";
    }
    restart();
  });
  (wrap.querySelector(".rbt-vs-back") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  renderScore();
  restart();

  return {
    destroy() {
      destroyed = true;
      over = true;
      duel = null;
      clearTimers();
      offs.forEach((off) => off());
      offs.length = 0;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 无尽「点到手软」:四种回合随机、窗口越来越短、失误三次结束
// ---------------------------------------------------------------------------

export function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const offs: Array<() => void> = [];
  let destroyed = false;
  let over = false;
  let round = 0;
  let cleared = 0;
  let misses = 0;
  let duel: Duel | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  const wrap = document.createElement("div");
  wrap.className = "rbt-vs";
  wrap.innerHTML = `
    <style>${ARENA_CSS}</style>
    <div class="rbt-vs-head">
      <button class="rbt-vs-back" type="button">🗺️ 回关卡</button>
      <span class="rbt-vs-tag rbt-e-round">第 1 轮</span>
      <span class="rbt-vs-tag rbt-e-life"></span>
      <span class="rbt-vs-tag rbt-e-best"></span>
    </div>
    <div class="rbt-vs-brief"></div>
    <div class="rbt-vs-body">
      <div class="rbt-vs-side rbt-e-side"><div class="rbt-vs-name">朵朵 · A S D F</div></div>
    </div>
    <div class="rbt-vs-cloud"></div>
    <div class="rbt-vs-foot">四种回合轮着来，节奏一轮比一轮快。失误三次就收工，撑过的轮数就是成绩。</div>
  `;
  host.appendChild(wrap);

  const sideEl = wrap.querySelector(".rbt-e-side") as HTMLElement;
  const briefEl = wrap.querySelector(".rbt-vs-brief") as HTMLElement;
  const cloudEl = wrap.querySelector(".rbt-vs-cloud") as HTMLElement;
  const roundEl = wrap.querySelector(".rbt-e-round") as HTMLElement;
  const lifeEl = wrap.querySelector(".rbt-e-life") as HTMLElement;
  const bestEl = wrap.querySelector(".rbt-e-best") as HTMLElement;
  const bodyEl = wrap.querySelector(".rbt-vs-body") as HTMLElement;

  const pad = buildPad("left", KEYS_LEFT, true);
  sideEl.appendChild(pad.root);

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function clearTimers(): void {
    timeouts.forEach((t) => clearTimeout(t));
    timeouts.clear();
  }

  function now(): number {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function renderTop(): void {
    const pace = AI_TIERS[endlessAiTier(Math.max(1, round))].name;
    roundEl.textContent = `第 ${Math.max(1, round)} 轮 · 过了 ${cleared} · 节奏「${pace}」`;
    lifeEl.textContent = "❤️".repeat(Math.max(0, ENDLESS_MISS_LIMIT - misses)) || "💛";
    bestEl.textContent = best > 0 ? `🏅 最好 ${best} 轮` : "🏅 还没有纪录";
  }

  function tapAt(pos: number): void {
    if (!duel || over) return;
    const res = duel.tap("left", pos);
    if (res.outcome === "debounce") return;
    if (res.outcome === "palm") {
      for (const k of pad.keys) k.classList.remove("rbt-key-hit");
      api.play("oops");
      endRound("☁️ 一整只手拍上去不算分哦，一个一个点");
      return;
    }
    if (res.outcome === "early" || res.outcome === "wrong") {
      markKey(pad, pos, "rbt-key-bad");
      api.play("oops");
      endRound(res.outcome === "early" ? "☁️ 亮之前就点啦，等一等更稳" : "这一个不该点，下一轮看清楚～");
      return;
    }
    if (res.outcome === "good" || res.outcome === "win") {
      markKey(pad, pos, "rbt-key-hit");
      api.play("pop");
      if (duel.settled()) endRound();
    }
  }

  function endRound(note?: string): void {
    if (!duel || over) return;
    const r = duel.finish();
    duel = null;
    bodyEl.classList.remove("rbt-ready");
    briefEl.textContent = "这一轮结束，下一轮马上来……";
    if (r.delta.left > 0) {
      cleared++;
      cloudEl.textContent = note ?? "漂亮，这一轮过啦！";
      api.play("coin");
    } else {
      misses++;
      cloudEl.textContent = note ?? "这一轮没做完，还有机会！";
    }
    renderTop();
    if (misses >= ENDLESS_MISS_LIMIT) {
      finish();
      return;
    }
    later(nextRound, endlessGapMs(round));
  }

  function nextRound(): void {
    if (over || destroyed) return;
    round++;
    const kind = endlessRoundKind(round, Math.random);
    const plan = buildRound(kind, Math.random, { liveMs: endlessLiveMs(round) });
    const brief = roundBrief(plan, true);
    briefEl.innerHTML = `${brief.icon} ${brief.text}<span class="rbt-vs-brief-hint">预备……${brief.hint}</span>`;
    paintPad(pad, plan, false);
    bodyEl.classList.add("rbt-ready");
    renderTop();

    const d = createDuel(plan, now, ["left"]);
    duel = d;

    later(() => {
      if (over || duel !== d) return;
      bodyEl.classList.remove("rbt-ready");
      paintPad(pad, plan, true);
      briefEl.innerHTML = `${brief.icon} ${brief.text}<span class="rbt-vs-brief-hint">亮啦！${brief.hint}</span>`;
      api.play("tap");
    }, plan.readyMs);

    later(() => {
      if (over || duel !== d) return;
      endRound();
    }, plan.readyMs + plan.liveMs + 60);
  }

  function finish(): void {
    if (over) return;
    over = true;
    duel = null;
    clearTimers();
    const record = isNewRecord(cleared, best);
    if (record) best = save.recordEndlessBest(meta.id, cleared);
    const bonus = Math.min(6, Math.floor(cleared / 6));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");

    const ov = document.createElement("div");
    ov.className = "rbt-vs-over";
    ov.innerHTML = `
      <div style="font-size:44px;line-height:1">${record ? "🏅" : "💫"}</div>
      <div class="rbt-vs-over-title">${record ? `新纪录 ${cleared} 轮！` : `这次撑过 ${cleared} 轮`}</div>
      <div class="rbt-vs-over-sub">${
        record
          ? `四种回合全接住了，眼睛和手都很稳。${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`
          : `最好成绩 ${best} 轮，慢半拍看清指令反而撑得更久。${bonus > 0 ? `这次也拿到 ${bonus} 颗小星星。` : ""}`
      }</div>
    `;
    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = "10px";
    btns.style.flexWrap = "wrap";
    btns.style.justifyContent = "center";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "rbt-vs-btn";
    again.textContent = "🔁 再来一轮";
    again.addEventListener("click", () => {
      api.play("tap");
      ov.remove();
      restart();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.className = "rbt-vs-btn rbt-vs-ghost";
    back.textContent = "🗺️ 回关卡";
    back.addEventListener("click", () => {
      api.play("tap");
      onExit();
    });
    btns.append(again, back);
    ov.appendChild(btns);
    wrap.appendChild(ov);
  }

  function restart(): void {
    over = false;
    round = 0;
    cleared = 0;
    misses = 0;
    duel = null;
    clearTimers();
    renderTop();
    cloudEl.textContent = "";
    briefEl.textContent = "预备……四种回合轮着来，看清指令再出手";
    later(nextRound, 700);
  }

  const onKeyPad = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const pos = KEYS_LEFT.indexOf(e.key.toLowerCase());
    if (pos < 0) return;
    e.preventDefault();
    tapAt(pos);
  };
  window.addEventListener("keydown", onKeyPad);
  offs.push(() => window.removeEventListener("keydown", onKeyPad));

  for (const b of pad.keys) {
    const handler = (e: Event) => {
      e.preventDefault();
      tapAt(Number(b.dataset.pos ?? 0));
    };
    b.addEventListener("pointerdown", handler);
    offs.push(() => b.removeEventListener("pointerdown", handler));
  }

  (wrap.querySelector(".rbt-vs-back") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  restart();

  return {
    destroy() {
      destroyed = true;
      over = true;
      duel = null;
      clearTimers();
      offs.forEach((off) => off());
      offs.length = 0;
      wrap.remove();
    }
  };
}