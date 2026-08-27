import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import { CHAPTERS, LEVELS, mathExprFor, type BalloonLevel } from "./levels";
import {
  CHAIN_MIN,
  ESCAPE_Y,
  FAR_SCALE,
  FEST_MISS_LIMIT,
  GIFT_RISE_MUL,
  GOAL_LABELS,
  Janitor,
  KINDS,
  SKY_H,
  blastGroup,
  canSpawnGift,
  chainDelays,
  chainGroup,
  chainScore,
  FEST_CHUNK,
  FEST_LOOKAHEAD,
  festExtend,
  festInit,
  festGift,
  festMiss,
  festPlan,
  festPop,
  festRiseSpeed,
  floatAt,
  giftGuarded,
  goalFailure,
  goalReached,
  isTargetBalloon,
  levelGoal,
  rainbowTargets,
  starsFor,
  tapBalloon,
  twinPartner,
  type AirCfg,
  type BalloonKind,
  type ChainNode,
  type FestState,
  type GoalState
} from "./logic";

const BALLOON_COLORS = [
  { name: "红", css: "radial-gradient(circle at 35% 30%, #FFB3B3, #F0605F)", key: "#F0605F" },
  { name: "黄", css: "radial-gradient(circle at 35% 30%, #FFF0B3, #F5C142)", key: "#F5C142" },
  { name: "蓝", css: "radial-gradient(circle at 35% 30%, #B3D9FF, #4F94E8)", key: "#4F94E8" },
  { name: "绿", css: "radial-gradient(circle at 35% 30%, #C9F0B3, #6BBB4E)", key: "#6BBB4E" },
  { name: "紫", css: "radial-gradient(circle at 35% 30%, #E3CCFF, #9E6BD9)", key: "#9E6BD9" },
];

const KIND_BG: Partial<Record<BalloonKind, string>> = {
  cloud: "radial-gradient(circle at 35% 30%, #E8E8EE, #9A9AAE)",
  rainbow: "conic-gradient(#F0605F, #F5C142, #6BBB4E, #4F94E8, #9E6BD9, #F0605F)",
  chain: "radial-gradient(circle at 35% 30%, #FFD8A8, #F08C42)",
  gift: "radial-gradient(circle at 35% 30%, #FFE7B0, #E8A33D)"
};

interface Balloon {
  id: number;
  el: HTMLButtonElement;
  /** 出生时的横向百分比与高度 */
  x0: number;
  y0: number;
  born: number;
  phase: number;
  /** 当前位置（每帧算出来的，连锁与命中都读它） */
  x: number;
  y: number;
  kind: BalloonKind;
  color: number;
  num: number;
  /** 已经挨过几下（护盾铁气球要两下） */
  taps: number;
  /** 礼物气球被摇下去的累计像素 */
  push: number;
  /** 远层气球（小一点、分高一点） */
  far: boolean;
  /**
   * 出场时是第几个（气球节专用）。上升速度按它算，不按「现在已经出到第几个」算：
   * 后者会让天上所有气球在每次出新球时整体往上跳一截。
   */
  wave: number;
  gone: boolean;
}

const CSS = `
.blp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.blp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.blp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #C75A82; box-shadow: 0 2px 6px rgba(210,120,160,.25); font-size: 14px; white-space: nowrap; }
.blp-sky { position: relative; height: ${SKY_H}px; border-radius: 16px; overflow: hidden; }
.blp-balloon { position: absolute; width: 56px; height: 68px; border: none; border-radius: 50% 50% 46% 46%; cursor: pointer; font-size: 22px; font-weight: 900; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.3); padding: 0; }
.blp-balloon::after { content: ""; position: absolute; left: 50%; bottom: -12px; width: 2px; height: 12px; background: rgba(120,100,90,.5); }
.blp-balloon:active { transform: scale(.9); }
.blp-expr { font-size: 15px; letter-spacing: -0.5px; }
.blp-shielded { box-shadow: 0 0 0 4px #C9D8E8, 0 0 0 6px rgba(160,190,220,.5); }
.blp-twin { box-shadow: 0 0 0 3px #FFE1F0, 0 0 0 5px rgba(240,150,200,.6); }
.blp-far { filter: saturate(.8) brightness(1.06); }
.blp-gift { box-shadow: 0 0 0 3px #FFF0C4, 0 0 0 6px rgba(230,180,90,.45); }
.blp-pop { animation: blpPop .22s ease forwards; pointer-events: none; }
.blp-shake { animation: blpShake .34s ease; }
@keyframes blpPop { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes blpShake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
.blp-bit { position: absolute; width: 8px; height: 8px; border-radius: 2px; pointer-events: none; }
.blp-msg { text-align: center; min-height: 20px; color: #C75A82; font-weight: 700; margin-top: 8px; font-size: 14px; line-height: 1.4; }
.blp-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
.blp-open { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #FFD6E6; color: #A8386A; cursor: pointer; box-shadow: 0 3px 0 #F0AFC8; }
.blp-open:active { transform: translateY(2px); box-shadow: 0 1px 0 #F0AFC8; }
.blp-back { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #E7E1FA; color: #5B4B8A; cursor: pointer; }
.blp-over { text-align: center; padding: 14px 8px; }
.blp-over h3 { margin: 0 0 6px; font-size: 19px; color: #A8386A; }
.blp-over p { margin: 4px 0; font-size: 14px; color: #6B5B7A; line-height: 1.5; }
.blp-again { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) {
  .blp-pop, .blp-shake { animation-duration: .01s; }
  .blp-open:active, .blp-balloon:active { transform: none; }
}
`;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 把气球做成一颗按钮：颜色 + 图案两条通道，色觉不一样的孩子也分得清 */
function paintBalloon(b: Balloon, mode: BalloonLevel["mode"], rand: () => number): void {
  const node = b.el;
  node.className = "blp-balloon";
  if (b.far) node.classList.add("blp-far");
  const bg = KIND_BG[b.kind];
  if (bg) {
    node.style.background = bg;
    node.textContent = KINDS[b.kind].emoji;
    if (b.kind === "gift") node.classList.add("blp-gift");
  } else {
    node.style.background = BALLOON_COLORS[b.color].css;
    if (b.kind === "iron") node.classList.add("blp-shielded");
    if (b.kind === "twin") node.classList.add("blp-twin");
    if (mode === "math") {
      node.classList.add("blp-expr");
      node.textContent = mathExprFor(b.num, rand);
    } else if (mode === "number") {
      node.textContent = String(b.num);
    } else {
      node.textContent = b.kind === "twin" ? KINDS.twin.emoji : b.kind === "iron" ? KINDS.iron.emoji : "";
    }
  }
  if (b.far) {
    node.style.width = `${Math.round(56 * FAR_SCALE)}px`;
    node.style.height = `${Math.round(68 * FAR_SCALE)}px`;
    node.style.fontSize = "16px";
  }
  node.setAttribute("aria-label", `${BALLOON_COLORS[b.color].name}色${KINDS[b.kind].name}`);
  // dataset 只是给自动冒烟脚本读的状态镜像，不参与玩法
  node.dataset.kind = b.kind;
  node.dataset.num = String(b.num);
  node.dataset.color = String(b.color);
  node.dataset.shield = b.kind === "iron" ? "1" : "0";
}

function confetti(sky: HTMLElement, x: number, y: number, color: string, n: number, jan: Janitor): void {
  for (let i = 0; i < n; i++) {
    const bit = el("div", "blp-bit");
    bit.style.background = color;
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    const dx = (Math.random() - 0.5) * 90;
    const dy = (Math.random() - 0.5) * 90 - 20;
    bit.style.transition = "transform .42s ease-out, opacity .42s ease-out";
    sky.appendChild(bit);
    jan.after(16, () => {
      bit.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.round(dx * 4)}deg)`;
      bit.style.opacity = "0";
    });
    jan.after(480, () => bit.remove());
  }
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BalloonLevel = LEVELS[ctx.level];
  const goal = levelGoal(cfg);
  const reduce = reducedMotion();
  const jan = new Janitor();
  const air: AirCfg = { riseSpeed: cfg.riseSpeed, wind: cfg.wind, windFlipMs: cfg.windFlipMs };
  const giftAir: AirCfg = { ...air, riseSpeed: cfg.riseSpeed * GIFT_RISE_MUL };
  // 连锁只在「数量 / 指定颜色」两类目标里放开：按顺序戳的关卡不能被连锁打乱
  const chainOk = cfg.mode === "free" || cfg.mode === "color";

  let raf = 0;
  let lastTime = 0;
  let clock = 0;
  let destroyed = false;
  let ended = false;
  let popped = 0;
  let mistakes = 0;
  let escaped = 0;
  let giftLost = 0;
  let nextId = 1;
  let targetColor = Math.floor(Math.random() * BALLOON_COLORS.length);
  let targetNum = 1;
  let sincePops = 0;
  const balloons: Balloon[] = [];
  const twinOf = new Map<number, number>();

  const wrap = el("div", "blp-wrap");
  wrap.style.background = cfg.night
    ? "linear-gradient(180deg, #3E4578, #7A6BA8)"
    : "linear-gradient(180deg, #DFF1FF, #FFE9F3)";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="blp-top">
      <span class="blp-badge blp-score">🎈 0 / ${cfg.target}</span>
      <span class="blp-badge blp-order"></span>
      ${cfg.wind ? `<span class="blp-badge blp-wind"></span>` : ""}
      <span class="blp-badge blp-life">💗💗💗</span>
    </div>
    <div class="blp-sky" style="background:${cfg.night ? "linear-gradient(180deg,#2E3560,#5A4E8C)" : "linear-gradient(180deg,#C5E8FF,#F0F8FF)"}"></div>
    <div class="blp-msg"></div>
  `;
  stage.appendChild(wrap);

  const skyEl = wrap.querySelector(".blp-sky") as HTMLElement;
  const scoreEl = wrap.querySelector(".blp-score") as HTMLElement;
  const orderEl = wrap.querySelector(".blp-order") as HTMLElement;
  const windEl = wrap.querySelector(".blp-wind") as HTMLElement | null;
  const lifeEl = wrap.querySelector(".blp-life") as HTMLElement;
  const msgEl = wrap.querySelector(".blp-msg") as HTMLElement;

  msgEl.textContent =
    goal === "protect"
      ? "🎁 天上那个礼物气球千万别让它飞走：轻轻点一下就能把它摇下来一点！"
      : cfg.mode === "math"
        ? "算出气球上的得数，按 1→5 的顺序戳！"
        : cfg.mode === "color"
          ? "看清指令颜色再戳！同色挨在一起还会连爆～"
          : cfg.mode === "number"
            ? "按 1→2→3→4→5 的顺序戳气球！"
            : (cfg.chainChance ?? 0) > 0
              ? "🧨 连锁气球一响，波及身边一片！"
              : (cfg.shieldChance ?? 0) > 0
                ? "🛡️ 护盾铁气球要敲两下才破！"
                : cfg.cloudChance > 0
                  ? "乌云球 ☁️ 是陷阱，手指绕开它！"
                  : "手指守在下半屏，气球一冒头就戳！同色挨在一起会连爆～";

  function state(): GoalState {
    return { popped, target: cfg.target, escaped, escapes: cfg.escapes, mistakes, giftLost };
  }

  function renderTop(): void {
    scoreEl.textContent = `🎈 ${popped} / ${cfg.target}`;
    lifeEl.textContent = "💗".repeat(Math.max(0, 3 - mistakes)) + "🤍".repeat(Math.min(3, mistakes));
    if (goal === "protect") {
      orderEl.textContent = "🎁 护住礼物";
      orderEl.style.color = "#B87A2A";
    } else if (cfg.mode === "color") {
      orderEl.textContent = `🎯 戳${BALLOON_COLORS[targetColor].name}色`;
      orderEl.style.color = BALLOON_COLORS[targetColor].key;
    } else if (cfg.mode === "number") {
      orderEl.textContent = `🎯 下一个：${targetNum}`;
    } else if (cfg.mode === "math") {
      orderEl.textContent = `🧮 戳得数 ${targetNum}`;
    } else {
      orderEl.textContent = `🌤️ 可飘走 ${Math.max(0, cfg.escapes - escaped)}`;
    }
    if (windEl) windEl.textContent = windSignNow() > 0 ? "🌬️ 风 →" : "🌬️ ← 风";
  }

  function windSignNow(): number {
    if (!cfg.wind || !cfg.windFlipMs) return 1;
    return Math.floor((clock * 1000) / cfg.windFlipMs) % 2 === 0 ? 1 : -1;
  }

  function finish(won: boolean, reason?: string): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (won) {
      const got = starsFor(mistakes, escaped, giftLost);
      const brag =
        goal === "protect"
          ? `${cfg.target} 个气球全部拿下，礼物也稳稳护住了！`
          : `${cfg.target} 个气球全部拿下，出手又快又准！`;
      jan.after(350, () => {
        if (!destroyed) ctx.win(got, brag);
      });
    } else {
      jan.after(350, () => {
        if (!destroyed) ctx.lose(reason ?? "这一轮飘走得多了些～优先处理最靠上的那几个，再来一次就稳了！");
      });
    }
  }

  function checkGoal(): void {
    if (ended) return;
    const st = state();
    if (goalReached(goal, st)) {
      finish(true);
      return;
    }
    const why = goalFailure(goal, st);
    if (why) finish(false, why);
  }

  function isTarget(b: Balloon): boolean {
    return isTargetBalloon(cfg, b, targetColor, targetNum);
  }

  function nodes(): ChainNode[] {
    const skyW = Math.max(1, skyEl.clientWidth || 336);
    return balloons
      .filter((b) => !b.gone)
      .map((b) => ({ id: b.id, x: (b.x / 100) * skyW, y: b.y, color: b.color, kind: b.kind }));
  }

  function byId(id: number): Balloon | undefined {
    return balloons.find((b) => b.id === id && !b.gone);
  }

  function removeBalloon(b: Balloon, popAnim: boolean): void {
    if (b.gone) return;
    b.gone = true;
    if (popAnim) {
      b.el.classList.add("blp-pop");
      if (!reduce) {
        const skyW = Math.max(1, skyEl.clientWidth || 336);
        confetti(skyEl, (b.x / 100) * skyW, b.y, BALLOON_COLORS[b.color].key, 4, jan);
      }
      jan.after(240, () => b.el.remove());
    } else {
      b.el.remove();
    }
  }

  /** 真正打爆一颗（含双子连带），返回它算不算目标 */
  function burstOne(b: Balloon): boolean {
    if (b.gone) return false;
    const counted = isTarget(b);
    removeBalloon(b, true);
    if (counted) popped++;
    const mate = twinPartner(nodes(), b.id, twinOf);
    if (mate !== null) {
      const other = byId(mate);
      if (other) {
        const c2 = isTarget(other);
        removeBalloon(other, true);
        if (c2) popped++;
      }
    }
    return counted;
  }

  /** 同色成片：一条链一颗接一颗地爆，40–60ms 一颗，听得出节奏 */
  function popChain(start: Balloon): void {
    const group = chainOk ? chainGroup(nodes(), start.id) : [start.id];
    if (group.length < CHAIN_MIN) {
      burstOne(start);
      ctx.sfx("pop");
      afterPop();
      return;
    }
    const delays = chainDelays(group.length);
    group.forEach((id, i) => {
      const step = () => {
        const b = byId(id);
        if (!b || ended || destroyed) return;
        burstOne(b);
        ctx.sfx("pop");
        renderTop();
        if (i === group.length - 1) {
          msgEl.textContent = `✨ ${group.length} 连爆！+${chainScore(group.length)} 分手感！`;
          if (group.length >= 5) ctx.bonusStars(1);
          afterPop();
        }
      };
      if (delays[i] === 0) step();
      else jan.after(delays[i], step);
    });
  }

  /** 打爆一颗之后要不要换指令、要不要过关 */
  function afterPop(): void {
    sincePops++;
    if (cfg.mode === "number" || cfg.mode === "math") {
      targetNum = targetNum >= 5 ? 1 : targetNum + 1;
    } else if (cfg.mode === "color" && sincePops >= 4) {
      sincePops = 0;
      let next = Math.floor(Math.random() * BALLOON_COLORS.length);
      if (next === targetColor) next = (next + 1) % BALLOON_COLORS.length;
      targetColor = next;
      msgEl.textContent = `指令换啦：现在戳${BALLOON_COLORS[targetColor].name}色！`;
    }
    renderTop();
    checkGoal();
  }

  function onBalloon(b: Balloon): void {
    if (ended || b.gone) return;

    if (b.kind === "gift") {
      const res = tapBalloon("gift");
      b.push += res.pushDown;
      b.el.classList.remove("blp-shake");
      void b.el.offsetWidth;
      b.el.classList.add("blp-shake");
      ctx.sfx("meow");
      msgEl.textContent = res.hint;
      return;
    }

    if (b.kind === "cloud") {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent = "☁️ 乌云球是陷阱，看清楚再落手！";
      removeBalloon(b, true);
      renderTop();
      checkGoal();
      return;
    }

    if (b.kind === "rainbow") {
      ctx.sfx("coin");
      const res = rainbowTargets(nodes());
      let cleared = 0;
      for (const id of res.ids) {
        const other = byId(id);
        if (!other) continue;
        if (cfg.mode === "free" || isTarget(other)) {
          cleared++;
          popped++;
        }
        removeBalloon(other, true);
      }
      removeBalloon(b, true);
      msgEl.textContent =
        res.color >= 0
          ? `🌈 彩虹一挥，${BALLOON_COLORS[res.color].name}色的气球全砰啦！`
          : "🌈 彩虹一挥，可惜天上没别的气球了～";
      if (cleared >= 4) ctx.bonusStars(1);
      renderTop();
      checkGoal();
      return;
    }

    if (b.kind === "chain") {
      ctx.sfx("coin");
      const hit = blastGroup(nodes(), b.id);
      let counted = 0;
      for (const id of hit) {
        const other = byId(id);
        if (!other) continue;
        if (isTarget(other)) {
          counted++;
          popped++;
        }
        removeBalloon(other, true);
      }
      removeBalloon(b, true);
      msgEl.textContent = counted > 0 ? `🧨 连锁爆炸！一口气炸掉 ${counted} 个！` : "🧨 砰！旁边没有气球，下次挑密集的地方引爆～";
      if (counted >= 4) ctx.bonusStars(1);
      renderTop();
      checkGoal();
      return;
    }

    if (!isTarget(b)) {
      mistakes++;
      ctx.sfx("oops");
      msgEl.textContent =
        cfg.mode === "color"
          ? `现在要戳${BALLOON_COLORS[targetColor].name}色的！`
          : cfg.mode === "math"
            ? `先算一算，现在要戳得数是 ${targetNum} 的！`
            : `要按顺序，下一个是 ${targetNum}！`;
      renderTop();
      checkGoal();
      return;
    }

    const res = tapBalloon(b.kind, b.taps);
    if (!res.popped) {
      b.taps++;
      b.el.classList.remove("blp-shielded");
      ctx.sfx("tap");
      msgEl.textContent = res.hint;
      return;
    }
    popChain(b);
  }

  function liveGifts(): number {
    return balloons.filter((b) => !b.gone && b.kind === "gift").length;
  }

  function spawn(): void {
    if (ended || destroyed) return;
    const r = Math.random();
    const chainChance = cfg.chainChance ?? 0;
    const giftChance = cfg.giftChance ?? 0;
    const twinChance = cfg.twinChance ?? 0;
    let kind: BalloonKind = "normal";
    if (r < cfg.cloudChance) kind = "cloud";
    else if (r < cfg.cloudChance + cfg.rainbowChance) kind = "rainbow";
    else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance) kind = "chain";
    else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance + giftChance) {
      kind = canSpawnGift(liveGifts()) ? "gift" : "normal";
    } else if (r < cfg.cloudChance + cfg.rainbowChance + chainChance + giftChance + twinChance) kind = "twin";
    else if (Math.random() < (cfg.shieldChance ?? 0)) kind = "iron";

    const make = (color: number, num: number, x: number): Balloon => {
      const node = document.createElement("button");
      node.type = "button";
      const b: Balloon = {
        id: nextId++,
        el: node,
        x0: x,
        y0: SKY_H + 40,
        born: clock,
        phase: Math.random() * Math.PI * 2,
        x,
        y: SKY_H + 40,
        kind,
        color,
        num,
        taps: 0,
        push: 0,
        far: false,
        wave: 0,
        gone: false
      };
      paintBalloon(b, cfg.mode, Math.random);
      node.style.left = `${b.x}%`;
      jan.on(node, "pointerdown", (ev: Event) => {
        ev.preventDefault();
        onBalloon(b);
      });
      skyEl.appendChild(node);
      balloons.push(b);
      return b;
    };

    const color = Math.floor(Math.random() * BALLOON_COLORS.length);
    const num = 1 + Math.floor(Math.random() * 5);
    const x = 8 + Math.random() * 76;
    const first = make(color, num, x);
    if (kind === "twin") {
      // 双子：两颗一起来，绑在一起，戳一个另一个跟着砰
      const second = make(color, num, Math.max(4, Math.min(84, x + (x > 46 ? -18 : 18))));
      twinOf.set(first.id, second.id);
      twinOf.set(second.id, first.id);
    }
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    clock += dt;

    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.gone) {
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        continue;
      }
      const pos = floatAt(
        { x0: b.x0, y0: b.y0 + b.push, born: b.born, phase: b.phase },
        b.kind === "gift" ? giftAir : air,
        clock
      );
      b.x = pos.x;
      b.y = pos.y;
      b.el.style.left = `${b.x}%`;
      b.el.style.top = `${b.y}px`;
      b.el.style.marginLeft = `${pos.swayPx}px`;
      if (b.y < ESCAPE_Y) {
        const wasTarget = isTarget(b);
        const wasGift = b.kind === "gift";
        removeBalloon(b, false);
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        if (wasGift) {
          // 只有护礼物那类关卡才记账。别的关卡从没让孩子护过它，
          // 结算时按 giftLost × 2 暗扣星，孩子只会看到「明明一个没漏却只有一星」。
          if (giftGuarded(goal)) {
            giftLost++;
            msgEl.textContent = "🎁 礼物飘走啦……没关系，下次早一点把它摇下来！";
          }
        } else if (wasTarget) {
          escaped++;
        }
        renderTop();
        checkGoal();
        if (ended) return;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  jan.every(cfg.spawnMs, () => spawn());
  if (cfg.wind && cfg.windFlipMs) {
    jan.every(cfg.windFlipMs, () => {
      renderTop();
      msgEl.textContent = windSignNow() > 0 ? "🌀 镜风翻面：往右吹！" : "🌀 镜风翻面：往左吹！";
    });
  }
  spawn();
  renderTop();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      jan.destroy();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「气球节」：密度与速度渐进，漏掉 3 个收工
// ---------------------------------------------------------------------------

function mountFestival(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const jan = new Janitor();
  const reduce = reducedMotion();
  let raf = 0;
  let disposed = false;
  let clock = 0;
  let lastTime = 0;
  let festSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
  let plan = festPlan(festSeed, FEST_CHUNK);
  let planAt = 0;
  let st: FestState = festInit();
  let nextId = 1;
  const balloons: Balloon[] = [];
  const twinOf = new Map<number, number>();

  const wrap = el("div", "blp-wrap");
  wrap.style.background = "linear-gradient(180deg, #FFE9F3, #E6F3FF)";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="blp-top">
      <span class="blp-badge blp-score">💯 0</span>
      <span class="blp-badge blp-combo">🔥 0 连</span>
      <span class="blp-badge blp-miss">🎈 还能漏 ${FEST_MISS_LIMIT}</span>
      <span class="blp-badge blp-best"></span>
    </div>
    <div class="blp-sky" style="background:linear-gradient(180deg,#C5E8FF,#FFF4FA)"></div>
    <div class="blp-msg">气球节开始啦！戳破升上来的气球，🎁 礼物气球别戳、也别让它跑掉～</div>
    <div class="blp-again"><button class="blp-back" type="button">⬅️ 回到关卡地图</button></div>
  `;
  host.appendChild(wrap);

  const skyEl = wrap.querySelector(".blp-sky") as HTMLElement;
  const scoreEl = wrap.querySelector(".blp-score") as HTMLElement;
  const comboEl = wrap.querySelector(".blp-combo") as HTMLElement;
  const missEl = wrap.querySelector(".blp-miss") as HTMLElement;
  const bestEl = wrap.querySelector(".blp-best") as HTMLElement;
  const msgEl = wrap.querySelector(".blp-msg") as HTMLElement;
  const backBtn = wrap.querySelector(".blp-back") as HTMLButtonElement;

  function refreshTop(): void {
    scoreEl.textContent = `💯 ${st.score}`;
    comboEl.textContent = `🔥 ${st.combo} 连`;
    missEl.textContent = `🎈 还能漏 ${Math.max(0, FEST_MISS_LIMIT - st.missed)}`;
    const best = save.getGameProgress(meta.id).endlessBest;
    bestEl.textContent = best > 0 ? `🏅 最好 ${best}` : "🏅 第一次";
  }

  function nodes(): ChainNode[] {
    const skyW = Math.max(1, skyEl.clientWidth || 336);
    return balloons
      .filter((b) => !b.gone)
      .map((b) => ({ id: b.id, x: (b.x / 100) * skyW, y: b.y, color: b.color, kind: b.kind }));
  }

  function byId(id: number): Balloon | undefined {
    return balloons.find((b) => b.id === id && !b.gone);
  }

  function remove(b: Balloon, anim: boolean): void {
    if (b.gone) return;
    b.gone = true;
    if (anim) {
      b.el.classList.add("blp-pop");
      if (!reduce) {
        const skyW = Math.max(1, skyEl.clientWidth || 336);
        confetti(skyEl, (b.x / 100) * skyW, b.y, BALLOON_COLORS[b.color].key, 4, jan);
      }
      jan.after(240, () => b.el.remove());
    } else {
      b.el.remove();
    }
  }

  function finish(): void {
    if (disposed) return;
    cancelAnimationFrame(raf);
    api.play("oops");
    let best = st.score;
    try {
      best = save.recordEndlessBest(meta.id, st.score);
    } catch (err) {
      console.warn("[一朵一星] 气球砰砰无尽成绩没记上:", err);
    }
    const box = el("div", "blp-over");
    box.append(
      el("h3", undefined, "🎉 气球节散场啦！"),
      el("p", undefined, `这一场拿到 ${st.score} 分，最长连了 ${st.bestCombo} 个。`),
      el("p", undefined, best > st.score ? `你的最好成绩还是 ${best} 分，再来一场说不定就破了～` : `新纪录！${best} 分，好厉害！`),
      el("p", undefined, "小窍门：同色气球挨在一起时先戳中间那颗，一串都会跟着砰。")
    );
    const again = el("div", "blp-again");
    const againBtn = el("button", "blp-open", "🔁 再来一场");
    const backBtn2 = el("button", "blp-back", "⬅️ 回到关卡地图");
    jan.on(againBtn, "click", () => {
      api.play("tap");
      box.remove();
      reset();
      loop();
    });
    jan.on(backBtn2, "click", () => back());
    again.append(againBtn, backBtn2);
    box.appendChild(again);
    msgEl.after(box);
    refreshTop();
  }

  function burstOne(b: Balloon): number {
    if (b.gone) return 0;
    remove(b, true);
    let n = 1;
    const mate = twinPartner(nodes(), b.id, twinOf);
    if (mate !== null) {
      const other = byId(mate);
      if (other) {
        remove(other, true);
        n++;
      }
    }
    return n;
  }

  function score(kind: BalloonKind, chainLen: number, far: boolean): void {
    st = festPop(st, kind, chainLen, far);
    refreshTop();
  }

  function onBalloon(b: Balloon): void {
    if (disposed || st.over || b.gone) return;
    if (b.kind === "gift") {
      const res = tapBalloon("gift");
      b.push += res.pushDown;
      b.el.classList.remove("blp-shake");
      void b.el.offsetWidth;
      b.el.classList.add("blp-shake");
      st = festGift(st);
      api.play("meow");
      msgEl.textContent = res.hint;
      refreshTop();
      return;
    }
    if (b.kind === "cloud") {
      api.play("oops");
      st = { ...st, combo: 0 };
      msgEl.textContent = "☁️ 乌云球不能戳，连击断了一下，接着来！";
      remove(b, true);
      refreshTop();
      return;
    }
    if (b.kind === "rainbow") {
      api.play("coin");
      const res = rainbowTargets(nodes());
      let n = 0;
      for (const id of res.ids) {
        const other = byId(id);
        if (!other) continue;
        remove(other, true);
        n++;
      }
      remove(b, true);
      score("rainbow", Math.max(1, n), b.far);
      msgEl.textContent = res.color >= 0 ? `🌈 ${BALLOON_COLORS[res.color].name}色的气球全砰啦！` : "🌈 彩虹一挥！";
      return;
    }
    if (b.kind === "chain") {
      api.play("coin");
      const hit = blastGroup(nodes(), b.id);
      let n = 0;
      for (const id of hit) {
        const other = byId(id);
        if (!other) continue;
        remove(other, true);
        n++;
      }
      remove(b, true);
      score("chain", Math.max(1, n), b.far);
      msgEl.textContent = `🧨 连锁炸掉 ${n} 个！`;
      return;
    }
    const res = tapBalloon(b.kind, b.taps);
    if (!res.popped) {
      b.taps++;
      b.el.classList.remove("blp-shielded");
      api.play("tap");
      msgEl.textContent = res.hint;
      return;
    }
    const group = chainGroup(nodes(), b.id);
    if (group.length >= CHAIN_MIN) {
      const delays = chainDelays(group.length);
      let count = 0;
      group.forEach((id, i) => {
        const step = () => {
          const other = byId(id);
          if (!other || disposed || st.over) return;
          count += burstOne(other);
          api.play("pop");
          if (i === group.length - 1) {
            score(b.kind, count, b.far);
            msgEl.textContent = `✨ ${count} 连爆！`;
          }
        };
        if (delays[i] === 0) step();
        else jan.after(delays[i], step);
      });
      return;
    }
    api.play("pop");
    const n = burstOne(b);
    score(b.kind, n, b.far);
  }

  /** 出场表快见底就再续一段——气球节没有「出完」这回事，只有三个漏掉 */
  function topUpPlan(): void {
    if (planAt < plan.length - FEST_LOOKAHEAD) return;
    festSeed = (festSeed * 1664525 + 1013904223) >>> 0;
    plan = plan.concat(festExtend(plan, festSeed, FEST_CHUNK));
  }

  function spawnFromPlan(): void {
    topUpPlan();
    while (planAt < plan.length && plan[planAt].at <= clock) {
      const wave = planAt;
      const p = plan[planAt++];
      const kind = p.kind === "gift" && !canSpawnGift(balloons.filter((b) => !b.gone && b.kind === "gift").length)
        ? "normal"
        : p.kind;
      const make = (x: number): Balloon => {
        const node = document.createElement("button");
        node.type = "button";
        const b: Balloon = {
          id: nextId++,
          el: node,
          x0: x,
          y0: SKY_H + 40,
          born: clock,
          phase: Math.random() * Math.PI * 2,
          x,
          y: SKY_H + 40,
          kind,
          color: p.color,
          num: p.num,
          taps: 0,
          push: 0,
          far: p.far,
          wave,
          gone: false
        };
        paintBalloon(b, "free", Math.random);
        node.style.left = `${x}%`;
        jan.on(node, "pointerdown", (ev: Event) => {
          ev.preventDefault();
          onBalloon(b);
        });
        skyEl.appendChild(node);
        balloons.push(b);
        return b;
      };
      const first = make(p.x);
      if (kind === "twin") {
        const second = make(Math.max(4, Math.min(84, p.x + (p.x > 46 ? -18 : 18))));
        twinOf.set(first.id, second.id);
        twinOf.set(second.id, first.id);
      }
    }
  }

  function tick(now: number): void {
    if (disposed || st.over) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    clock += dt;
    spawnFromPlan();

    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      if (b.gone) {
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        continue;
      }
      // 用气球自己的出场波次，不用「现在已经出到第几个」：
      // 后者一变，floatAt 就会拿新速度乘老气球的全部年龄，天上整片球会往上跳一截。
      const rise = festRiseSpeed(b.wave) * (b.far ? 0.78 : 1) * (b.kind === "gift" ? GIFT_RISE_MUL : 1);
      const pos = floatAt({ x0: b.x0, y0: b.y0 + b.push, born: b.born, phase: b.phase }, { riseSpeed: rise }, clock);
      b.x = pos.x;
      b.y = pos.y;
      b.el.style.left = `${b.x}%`;
      b.el.style.top = `${b.y}px`;
      b.el.style.marginLeft = `${pos.swayPx}px`;
      if (b.y < ESCAPE_Y) {
        const kind = b.kind;
        remove(b, false);
        balloons.splice(i, 1);
        twinOf.delete(b.id);
        if (kind !== "cloud" && kind !== "gift") {
          st = festMiss(st);
          msgEl.textContent = st.over ? "" : "🎈 跑掉一个，稳住节奏，先打最靠上的！";
        }
        refreshTop();
        if (st.over) {
          finish();
          return;
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function reset(): void {
    for (const b of balloons) b.el.remove();
    balloons.length = 0;
    twinOf.clear();
    festSeed = (Date.now() ^ (nextId * 2654435761)) >>> 0;
    plan = festPlan(festSeed, FEST_CHUNK);
    planAt = 0;
    clock = 0;
    st = festInit();
    msgEl.textContent = "气球节又开始啦！同色挨在一起先戳中间那颗～";
    refreshTop();
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  jan.on(backBtn, "click", () => back());
  refreshTop();
  loop();

  return {
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = el("div", "blp-bar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "blp-open", "♾️ 无尽气球节");
  endlessBtn.type = "button";
  bar.appendChild(endlessBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽气球节 · 最好 ${best} 分` : "♾️ 无尽气球节";
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  const onEndless = () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountFestival(modeHost, api, closeMode);
  };
  endlessBtn.addEventListener("click", onEndless);
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) bar.hidden = false;
            handle.destroy?.();
          }
        };
      },
      guide: GUIDE,
      guideTitle: "气球砰砰 · 眼手手册",
      mapHint: `不戳错、不放跑气球，命中率满分就是 3 星！（本关目标：${GOAL_LABELS.count} / ${GOAL_LABELS.color} / ${GOAL_LABELS.order} / ${GOAL_LABELS.protect}）`,
      grandMessage: "188 关气球全部拿下，判断和手速都练到位了！",
    }
  );

  return {
    destroy() {
      endlessBtn.removeEventListener("click", onEndless);
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}
