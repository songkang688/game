import { meta } from "./meta";
export { meta };

// 星星消消乐 —— 换两颗相邻的星星,凑三连消掉。
//
// 1.2 最要紧的改动在 view.ts:消除不再是「原地换个图案」,而是
// 爆开 → 每列独立下落 → 新块从棋盘顶外落进来 → 落地 → 连锁,一段一段演给你看。
// 这个文件只负责把三种玩法接到那条时间线上:
// 188 关闯关 / 对战清订单(人机三档 + 双人同屏) / 无尽订单。
import { save } from "../../engine/save";
import {
  chapterOf,
  chapterStart,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  mulberry32,
  TOTAL_LEVELS,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { prefersReducedMotion } from "./anim";
import {
  legalSwapsOn,
  RAINBOW,
  rotateSlots,
  shuffleLine,
  shuffleOn,
  stuckHintLine,
  type Cellset,
} from "./board";
import {
  applyPlan,
  creditOrder,
  detonatePlan,
  DUEL_COLORS,
  DUEL_COLS,
  DUEL_ROWS,
  DUEL_TARGET,
  ENDLESS_START_MOVES,
  endlessLine,
  endlessScore,
  duelWinner,
  makeDuelBoard,
  makeOrder,
  orderText,
  pickAiSwap,
  planRound,
  TIER_FACES,
  TIER_NAMES,
  TIER_THINK_MS,
  tierBlurb,
  type AiTier,
  type DuelOrder,
} from "./duel";
import {
  beltSlots,
  bossRoar,
  clearCells,
  createState,
  creditOrders,
  findMatches,
  goalsMet,
  legalSwaps,
  rainbowTargets,
  spawnToken,
  SIZE,
  type CascadeInfo,
  type MatchState,
} from "./engine";
import guideBook from "./guide";
import { CHAPTERS, LEVELS, orderLabel, type MatchLevel } from "./levels";
import { createStage, CSS, type Stage, type TokenSkin } from "./view";

const TOKENS: TokenSkin[] = [
  { emoji: "⭐", bg: "#FFF3C4" },
  { emoji: "💖", bg: "#FFDDE8" },
  { emoji: "🍀", bg: "#D8F5D8" },
  { emoji: "🌙", bg: "#DCE9FF" },
  { emoji: "🍊", bg: "#FFE8D1" },
];

const emojiOf = (t: number): string => (TOKENS[t] ?? TOKENS[0]).emoji;

/** 连着换错这么多次才开口指路：头两次留给孩子自己找 */
const STUCK_MISSES = 3;

/** 一串可以一起清掉的定时器 */
function makeTimers(): { later: (fn: () => void, ms: number) => void; clear: () => void } {
  const set = new Set<ReturnType<typeof setTimeout>>();
  let dead = false;
  return {
    later(fn, ms) {
      if (dead) return;
      const t = setTimeout(() => {
        set.delete(t);
        if (!dead) fn();
      }, ms);
      set.add(t);
    },
    clear() {
      dead = true;
      set.forEach((t) => clearTimeout(t));
      set.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// 直开第 N 关：壳层给了 initialLevel / ?level=N 就别卡在章节封面
// ---------------------------------------------------------------------------

/** 把壳层给的关号整理成 0 基下标；给不出就返回 -1（照常回地图） */
export function initialLevelOf(
  hint: unknown,
  search: string,
  total: number = TOTAL_LEVELS
): number {
  let raw: number | null = null;
  if (typeof hint === "number" && Number.isFinite(hint)) raw = hint;
  const m = /[?&]level=(\d+)/.exec(search ?? "");
  if (raw === null && m) raw = Number(m[1]);
  if (raw === null) return -1;
  // 壳层与地址栏都是 1 基的关号，越界一律 clamp
  return Math.max(0, Math.min(total - 1, Math.round(raw) - 1));
}

/** 在已经挂好的 188 关地图上，替玩家点开第 N 关（锁着的关就停在能玩的最远那一关） */
export function openCampaignLevel(host: HTMLElement, level: number): boolean {
  const stars = loadStars(meta.id);
  const skips = loadSkips(meta.id);
  const want = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  const target = Math.min(want, furthestPlayable(stars, skips, TOTAL_LEVELS));
  const ci = chapterOf(CHAPTERS, target);
  const tabs = host.querySelectorAll?.(".l99-tab");
  const tab = tabs?.[ci] as HTMLButtonElement | undefined;
  tab?.click?.();
  const nodes = host.querySelectorAll?.(".l99-node");
  const node = nodes?.[target - chapterStart(CHAPTERS, ci)] as HTMLButtonElement | undefined;
  if (!node || node.disabled) return false;
  node.click();
  return true;
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

function playLevel(host: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MatchLevel = LEVELS[ctx.level];
  const timers = makeTimers();
  let moves = cfg.moves;
  let levelDone = false;
  /** 连着换错几次了（换成了一步真的消除就归零） */
  let misses = 0;
  const state: MatchState = createState(cfg, Math.random as () => number);
  const beltRows = new Set((cfg.belts ?? []).map((b) => ((b.row % SIZE) + SIZE) % SIZE));
  const frostTotal = state.frostLeft;
  const blockerTotal = state.blockerLeft;

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mst-top">
      <span class="mst-badge mst-moves">👣 ${moves} 步</span>
      ${cfg.rainbow ? '<span class="mst-badge">🌈 会出现彩虹星</span>' : ""}
      ${cfg.belts?.length ? '<span class="mst-badge">🏭 虚线行会平移</span>' : ""}
      ${cfg.blockers ? '<span class="mst-badge">🧱 挡板挡着下落</span>' : ""}
    </div>
    <div class="mst-goals"></div>
    <div class="mst-bar"><div class="mst-fill"></div></div>
    <div class="mst-msg">点一颗星星，再点它旁边的，交换位置吧！</div>
  `;
  host.appendChild(wrap);

  const movesEl = wrap.querySelector(".mst-moves") as HTMLElement;
  const goalsEl = wrap.querySelector(".mst-goals") as HTMLElement;
  const fillEl = wrap.querySelector(".mst-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-msg") as HTMLElement;

  function renderGoals(): void {
    const parts: string[] = cfg.goals.map((g, gi) => {
      const done = state.collected[gi] >= g.count;
      return `<span class="mst-goal${done ? " mst-done" : ""}">${emojiOf(g.token)} ${Math.min(state.collected[gi], g.count)}/${g.count}</span>`;
    });
    if (cfg.ice > 0) parts.push(`<span class="mst-goal${state.iceLeft <= 0 ? " mst-done" : ""}">🧊 ${cfg.ice - state.iceLeft}/${cfg.ice}</span>`);
    if (cfg.vine > 0) parts.push(`<span class="mst-goal${state.vineLeft <= 0 ? " mst-done" : ""}">🌿 ${cfg.vine - state.vineLeft}/${cfg.vine}</span>`);
    if (frostTotal > 0) parts.push(`<span class="mst-goal${state.frostLeft <= 0 ? " mst-done" : ""}">🍥 糖霜 ${frostTotal - state.frostLeft}/${frostTotal} 层</span>`);
    if (blockerTotal > 0) parts.push(`<span class="mst-goal${state.blockerLeft <= 0 ? " mst-done" : ""}">🧱 挡板 ${blockerTotal - state.blockerLeft}/${blockerTotal}</span>`);
    (cfg.orders ?? []).forEach((order, oi) => {
      const done = state.orders[oi] >= order.count;
      parts.push(`<span class="mst-goal mst-order${done ? " mst-done" : ""}">🧾 ${orderLabel(order)}（${Math.min(state.orders[oi], order.count)}/${order.count}）</span>`);
    });
    if (cfg.boss) {
      parts.push(`<span class="mst-goal mst-boss${state.armor <= 0 ? " mst-done" : ""}">🗿 护甲 ${state.armor}/${cfg.boss.armor}</span>`);
    }
    goalsEl.innerHTML = parts.join("");

    let total = 0, got = 0;
    cfg.goals.forEach((g, gi) => { total += g.count; got += Math.min(state.collected[gi], g.count); });
    total += cfg.ice + cfg.vine;
    got += cfg.ice - state.iceLeft + (cfg.vine - state.vineLeft);
    total += frostTotal;
    got += Math.max(0, frostTotal - state.frostLeft);
    (cfg.orders ?? []).forEach((order, oi) => { total += order.count; got += Math.min(state.orders[oi], order.count); });
    if (cfg.boss) { total += cfg.boss.armor; got += cfg.boss.armor - state.armor; }
    fillEl.style.width = `${total > 0 ? Math.min(100, (got / total) * 100) : 0}%`;
  }

  function openingHint(): string {
    if (cfg.blockers) return "🧱 挡板挡着下落，上面的星星掉不下来——先在挡板旁边消一次！";
    if (cfg.boss) return `石巨人怕 ${emojiOf(cfg.boss.token)}，多消它就能敲掉护甲！`;
    if (cfg.frost) return "粉色格子盖着糖霜，在上面消一次刮一层！";
    if (cfg.belts?.length) return "虚线那几行是传送带，每走一步就整排挪一格。";
    if (cfg.orders?.length) return "看看订单：要一次消得多，或者连着消好几轮！";
    if (cfg.vine > 0 && cfg.ice > 0) return "冰块旁边消、藤蔓上面消，机关全清才过关！";
    if (cfg.vine > 0) return "藤蔓格必须在它上面消除才剪得断，旁边消没用！";
    if (cfg.ice > 0) return "在冰块上或旁边消除才敲得开，从边缘往里推！";
    if (cfg.rainbow) return "彩虹星🌈和谁交换就清掉全场那种图案，挑最多的那种！";
    return "从盘面下方消起容易连锁，步数是最贵的资源～";
  }

  function checkEnd(): void {
    if (levelDone) return;
    if (goalsMet(state, cfg)) {
      levelDone = true;
      stage.setEnabled(false);
      const got = moves >= cfg.three ? 3 : moves >= cfg.two ? 2 : 1;
      timers.later(() => ctx.win(got as 1 | 2 | 3, `还剩 ${moves} 步没用完，这一局的规划很省！`), 420);
    } else if (moves <= 0) {
      levelDone = true;
      stage.setEnabled(false);
      timers.later(() => ctx.lose("步数用完啦～下一局先扫一遍全盘，挑能连锁的那一步再出手，省得下来！"), 420);
    }
  }

  const stage: Stage = createStage(wrap, {
    cell: state,
    tokens: TOKENS,
    sfx: (n) => ctx.sfx(n),
    locked: (i) => state.ice[i] || state.vine[i] || state.solid[i],
    canSwap: (a, b) => !state.ice[a] && !state.vine[a] && !state.solid[a] && !state.ice[b] && !state.vine[b] && !state.solid[b],
    afterSwap: (a, b) => {
      if (cfg.rainbow && (state.grid[a] === RAINBOW || state.grid[b] === RAINBOW)) {
        const set = rainbowTargets(state, a, b, cfg.colors, Math.random as () => number);
        const other = state.grid[a] === RAINBOW ? state.grid[b] : state.grid[a];
        if (other >= 0) msgEl.textContent = `彩虹星把 ${emojiOf(other)} 全都变没啦！`;
        return { cells: Array.from(set) };
      }
      const matched = findMatches(state.grid);
      if (matched.size === 0) return "revert";
      return { cells: Array.from(matched) };
    },
    round: () => {
      const matched = findMatches(state.grid);
      return matched.size > 0 ? { cells: Array.from(matched) } : null;
    },
    applyRound: (plan) => {
      clearCells(state, cfg, new Set(plan.cells));
      renderGoals();
    },
    onRound: (plan, chain) => {
      if (plan.cells.length >= 5) {
        ctx.bonusStars(1);
        msgEl.textContent = `一步消掉 ${plan.cells.length} 颗，奖励一颗小星星！`;
      } else if (chain > 1) {
        msgEl.textContent = `${chain} 连锁！连锁产生的消除不花步数～`;
      }
    },
    spawn: () => spawnToken(cfg, Math.random as () => number),
    onMove: () => {
      moves--;
      misses = 0;
      movesEl.textContent = `👣 ${moves} 步`;
    },
    onRevert: (a, b) => {
      if (a === b) {
        msgEl.textContent = state.solid[a]
          ? "这是挡板，换不动～在它旁边消一次就能敲掉它！"
          : state.ice[a]
            ? "这颗被冰冻住啦，在它旁边消除就能敲开！"
            : "这颗被藤蔓缠住啦，在它上面消除才能剪断！";
        return;
      }
      misses++;
      // 连着换错三次才指路:头两次留给孩子自己找,第三次再说盘面哪一片有戏。
      // 只说方位不报行列号,和五子棋的提示一个口径。
      const hint = misses >= STUCK_MISSES ? stuckHintLine(state) : "";
      msgEl.textContent = hint || "这样换消不掉，不算步数～换个方向再试～";
    },
    belts: () =>
      (cfg.belts ?? []).map((b) => ({ slots: beltSlots(state, b), dir: b.dir })),
    applyBelt: (b) => rotateSlots(state.grid, state.special, b.slots, b.dir),
    onSettled: (info: CascadeInfo) => {
      const gained = creditOrders(state, cfg, info);
      if (gained > 0) {
        ctx.sfx("coin");
        msgEl.textContent = "🧾 订单完成一笔，继续攒大消除！";
      }
      state.used++;
      if (cfg.boss && cfg.boss.roarEvery > 0 && state.used % cfg.boss.roarEvery === 0 && state.armor > 0) {
        const at = bossRoar(state, cfg, Math.random as () => number);
        if (at >= 0) {
          ctx.sfx("oops");
          msgEl.textContent = "🗿 石巨人吼了一声，冻住了一颗星星！";
        }
      }
      renderGoals();
      stage.paint();
      checkEnd();
    },
    reshuffle: () => {
      if (levelDone || legalSwaps(state, cfg).length > 0) return false;
      const ok = shuffleOn(state, Math.random as () => number);
      msgEl.textContent = shuffleLine(ok);
      return ok;
    },
    onPaint: () => {
      movesEl.textContent = `👣 ${moves} 步`;
    },
  });

  // 传送带那几行画虚线框
  for (const row of beltRows) {
    for (let c = 0; c < SIZE; c++) {
      stage.board.children[row * SIZE + c]?.classList.add("mst-belt");
    }
  }

  renderGoals();
  msgEl.textContent = openingHint();

  return {
    destroy() {
      levelDone = true;
      timers.clear();
      stage.destroy();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽共用的一个「座位」
// ---------------------------------------------------------------------------

interface SeatOpts {
  host: HTMLElement;
  name: string;
  seed: number;
  /** 订单队列（对战两边共用同一条） */
  order: (n: number) => DuelOrder;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump") => void;
  /** 每清完一张订单 */
  onOrderDone: (total: number) => void;
  /** 每走一步（无尽拿它扣步数） */
  onMove?: () => void;
  /** 稳定之后（无尽拿它判死活） */
  onStable?: () => void;
  reduced?: boolean;
}

interface Seat {
  cell: Cellset;
  stage: Stage;
  order: DuelOrder;
  cleared: number;
  cursor: number;
  refreshHud: () => void;
  destroy: () => void;
}

function makeSeat(opts: SeatOpts): Seat {
  const rand = mulberry32(opts.seed);
  const cell = makeDuelBoard(rand);
  let orderIdx = 0;
  const seat: Seat = {
    cell,
    order: opts.order(0),
    cleared: 0,
    cursor: DUEL_COLS * (DUEL_ROWS - 1),
    stage: null as unknown as Stage,
    refreshHud: () => undefined,
    destroy: () => undefined,
  };

  const box = document.createElement("div");
  box.className = "mst-seat";
  const nameEl = document.createElement("div");
  nameEl.className = "mst-seat-name";
  const goals = document.createElement("div");
  goals.className = "mst-goals";
  box.append(nameEl, goals);
  opts.host.appendChild(box);

  function refreshHud(): void {
    nameEl.textContent = `${opts.name} · 已清 ${seat.cleared} 张`;
    goals.innerHTML = `<span class="mst-goal mst-order">🧾 ${orderText(seat.order, emojiOf)}</span>`;
  }

  /** 这一步清掉的图案，稳定之后一起结算订单 */
  let clearedTokens: number[] = [];
  let pendingBlast = new Set<number>();
  let doneCells = new Set<number>();

  const stage = createStage(box, {
    cell,
    tokens: TOKENS,
    reduced: opts.reduced,
    sfx: opts.sfx,
    afterSwap: (a, b) => {
      const boom = detonatePlan(cell, a, b);
      if (boom) return boom;
      if (cell.grid[a] === RAINBOW || cell.grid[b] === RAINBOW) {
        const target = cell.grid[a] === RAINBOW ? cell.grid[b] : cell.grid[a];
        const cells = new Set<number>([a, b]);
        for (let i = 0; i < cell.grid.length; i++) if (cell.grid[i] === target) cells.add(i);
        return { cells: Array.from(cells) };
      }
      return planRound(cell, b) ?? "revert";
    },
    round: () => planRound(cell, -1),
    applyRound: (plan) => {
      const res = applyPlan(cell, plan, doneCells);
      pendingBlast = res.blast;
      clearedTokens.push(...res.cleared);
    },
    blast: () => {
      if (pendingBlast.size === 0) return null;
      const cells = Array.from(pendingBlast);
      pendingBlast = new Set();
      return { cells };
    },
    spawn: () => Math.floor(rand() * DUEL_COLORS),
    onMove: () => {
      clearedTokens = [];
      doneCells = new Set();
      pendingBlast = new Set();
      opts.onMove?.();
    },
    onSettled: (info) => {
      if (creditOrder(seat.order, info, clearedTokens)) {
        seat.cleared++;
        orderIdx++;
        seat.order = opts.order(orderIdx);
        opts.sfx("coin");
        opts.onOrderDone(seat.cleared);
      }
      refreshHud();
      opts.onStable?.();
    },
    reshuffle: () => legalSwapsOn(cell).length === 0 && shuffleOn(cell, rand),
    onPaint: () => undefined,
  });

  seat.stage = stage;
  seat.refreshHud = refreshHud;
  seat.destroy = () => {
    stage.destroy();
    box.remove();
  };
  refreshHud();
  return seat;
}

// ---------------------------------------------------------------------------
// 外壳
// ---------------------------------------------------------------------------

interface Shell {
  wrap: HTMLElement;
  chip: HTMLElement;
  body: HTMLElement;
  say: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const top = document.createElement("div");
  top.className = "mst-top";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mst-btn mst-btn-ghost";
  back.textContent = "← 返回";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "mst-badge";
  chip.textContent = title;
  top.append(back, chip);
  const body = document.createElement("div");
  const say = document.createElement("div");
  say.className = "mst-msg";
  wrap.append(style, top, body, say);
  host.appendChild(wrap);
  return {
    wrap,
    chip,
    body,
    say,
    destroy() {
      wrap.remove();
    },
  };
}

function overPanel(host: HTMLElement, title: string, sub: string, label: string, again: () => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "mst-over";
  const t = document.createElement("div");
  t.className = "mst-over-t";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "mst-over-s";
  s.textContent = sub;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mst-btn";
  btn.textContent = label;
  btn.addEventListener("click", again);
  box.append(t, s, btn);
  host.appendChild(box);
  return box;
}

// ---------------------------------------------------------------------------
// 对战：双人清订单，先完成 3 张的赢
// ---------------------------------------------------------------------------

/** 座位的键位：鸭梨 WASD + F，康康 方向键 + L */
export const SEAT_KEYS: Array<{ up: string; down: string; left: string; right: string; go: string }> = [
  { up: "w", down: "s", left: "a", right: "d", go: "f" },
  { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", go: "l" },
];

/** 光标按方向键走一格，走到边就停住 */
export function moveCursor(i: number, dir: "up" | "down" | "left" | "right", cols: number, rows: number): number {
  const r = Math.floor(i / cols), c = i % cols;
  if (dir === "up") return r > 0 ? i - cols : i;
  if (dir === "down") return r < rows - 1 ? i + cols : i;
  if (dir === "left") return c > 0 ? i - 1 : i;
  return c < cols - 1 ? i + 1 : i;
}

function mountDuel(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  aiTier: AiTier | null
): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, aiTier ? "⚔️ 人机对战" : "👫 双人同屏");
  const timers = makeTimers();
  const reduced = prefersReducedMotion();
  let tier: AiTier = aiTier ?? "normal";
  let round = 1;
  const wins = [0, 0];
  let seats: Seat[] = [];
  let panel: HTMLElement | null = null;
  let over = false;
  let aiTimer = 0;

  function pickPanel(): void {
    stop();
    shell.body.innerHTML = "";
    shell.chip.textContent = "⚔️ 挑一个对手";
    shell.say.textContent = `谁先清完 ${DUEL_TARGET} 张订单谁赢。左边是你，右边是对手。`;
    const row = document.createElement("div");
    row.className = "mst-bar-row";
    for (const t of ["rookie", "normal", "expert"] as AiTier[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mst-btn${tier === t ? "" : " mst-btn-vs"}`;
      b.textContent = `${TIER_FACES[t]} ${TIER_NAMES[t]}`;
      b.addEventListener("click", () => {
        api.play("tap");
        tier = t;
        pickPanel();
      });
      row.appendChild(b);
    }
    const tip = document.createElement("div");
    tip.className = "mst-msg";
    tip.textContent = `${TIER_FACES[tier]} ${TIER_NAMES[tier]}：${tierBlurb(tier)}`;
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mst-btn";
    go.textContent = "开消 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      startRound();
    });
    shell.body.append(row, tip, go);
  }

  function stop(): void {
    for (const s of seats) s.destroy();
    seats = [];
    panel?.remove();
    panel = null;
    if (aiTimer) {
      clearInterval(aiTimer);
      aiTimer = 0;
    }
  }

  function startRound(): void {
    stop();
    over = false;
    shell.body.innerHTML = "";
    const seed = round * 7919 + 31;
    const orderRand = mulberry32(seed + 101);
    const queue: DuelOrder[] = [];
    const orderAt = (n: number): DuelOrder => {
      while (queue.length <= n) queue.push(makeOrder(queue.length, orderRand));
      // 两边各拿一份自己的副本，进度互不干扰
      const src = queue[n];
      return { ...src };
    };

    const names = aiTier
      ? ["🍐 你", `${TIER_FACES[tier]} ${TIER_NAMES[tier]}`]
      : ["🍐 鸭梨 · WASD + F", "👓 康康 · 方向键 + L"];
    shell.chip.textContent = `⚔️ 第 ${round} 局 · ${wins[0]} : ${wins[1]}`;
    shell.say.textContent = aiTier
      ? `先清完 ${DUEL_TARGET} 张订单就赢。点两颗相邻的星星交换。`
      : `上下（窄屏）或左右各一块盘，先清完 ${DUEL_TARGET} 张订单的赢。`;

    const seatsBox = document.createElement("div");
    seatsBox.className = "mst-seats";
    shell.body.appendChild(seatsBox);

    const made: Seat[] = [];
    for (let k = 0; k < 2; k++) {
      const seat = makeSeat({
        host: seatsBox,
        name: names[k],
        seed: seed + k * 977,
        order: orderAt,
        reduced,
        sfx: (n) => api.play(n),
        onOrderDone: (total) => settleIfWon(k, total),
      });
      made.push(seat);
    }
    seats = made;
    if (aiTier) {
      seats[1].stage.setEnabled(false);
      aiTimer = setInterval(aiStep, TIER_THINK_MS[tier]) as unknown as number;
    } else {
      seats.forEach((s) => s.stage.setCursor(s.cursor));
    }
  }

  function aiStep(): void {
    if (over || seats.length < 2) return;
    const foe = seats[1];
    if (foe.stage.busy()) return;
    const pick = pickAiSwap(foe.cell, foe.order, tier, Math.random as () => number);
    if (!pick) return;
    foe.stage.setEnabled(true);
    foe.stage.swap(pick[0], pick[1]);
    foe.stage.setEnabled(false);
  }

  function settleIfWon(who: number, total: number): void {
    if (over) return;
    const left = who === 0 ? total : seats[0]?.cleared ?? 0;
    const right = who === 1 ? total : seats[1]?.cleared ?? 0;
    const w = duelWinner(left, right);
    if (w === 0) return;
    over = true;
    if (aiTimer) {
      clearInterval(aiTimer);
      aiTimer = 0;
    }
    for (const s of seats) s.stage.setEnabled(false);
    wins[w - 1]++;
    api.play("win");
    if (w === 1) api.addStars(1);
    const title = aiTier
      ? w === 1 ? "🏆 你赢啦！" : "🤝 对手先清完了"
      : w === 1 ? "🏆 鸭梨赢啦！" : "🏆 康康赢啦！";
    panel = overPanel(
      shell.wrap,
      title,
      `${DUEL_TARGET} 张订单先清完就赢。总比分 ${wins[0]} : ${wins[1]}。`,
      "🔁 再来一局",
      () => {
        api.play("tap");
        round++;
        startRound();
      }
    );
  }

  const onKey = (ev: { key?: string; preventDefault?: () => void }): void => {
    if (aiTier || over || seats.length < 2) return;
    const k = (ev.key ?? "").toLowerCase();
    for (let s = 0; s < 2; s++) {
      const keys = SEAT_KEYS[s];
      const seat = seats[s];
      if (!seat) continue;
      let dir: "up" | "down" | "left" | "right" | null = null;
      if (k === keys.up) dir = "up";
      else if (k === keys.down) dir = "down";
      else if (k === keys.left) dir = "left";
      else if (k === keys.right) dir = "right";
      if (dir) {
        ev.preventDefault?.();
        seat.cursor = moveCursor(seat.cursor, dir, DUEL_COLS, DUEL_ROWS);
        seat.stage.setCursor(seat.cursor);
        return;
      }
      if (k === keys.go) {
        ev.preventDefault?.();
        seat.stage.tap(seat.cursor);
        return;
      }
    }
  };
  const win = globalThis as unknown as {
    addEventListener?: (t: string, f: unknown) => void;
    removeEventListener?: (t: string, f: unknown) => void;
  };
  win.addEventListener?.("keydown", onKey);

  if (aiTier) pickPanel();
  else startRound();

  return {
    destroy() {
      timers.clear();
      stop();
      win.removeEventListener?.("keydown", onKey);
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽：订单队列无限，每清 1 张 +1 步
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽订单");
  const timers = makeTimers();
  const reduced = prefersReducedMotion();
  let best = save.getGameProgress(meta.id).endlessBest;
  let seat: Seat | null = null;
  let panel: HTMLElement | null = null;
  let moves = ENDLESS_START_MOVES;
  let over = false;

  function refresh(): void {
    shell.chip.textContent = `♾️ 剩 ${moves} 步 · 已清 ${seat?.cleared ?? 0} 张 · 最好 ${best} 张`;
  }

  function start(): void {
    seat?.destroy();
    panel?.remove();
    panel = null;
    over = false;
    moves = ENDLESS_START_MOVES;
    shell.body.innerHTML = "";
    shell.say.textContent = "订单一张接一张，每清完一张就还你 1 步。慢慢挑，没有倒计时。";
    const orderRand = mulberry32((Date.now() % 1_000_000) + 3);
    const queue: DuelOrder[] = [];
    seat = makeSeat({
      host: shell.body,
      name: "🧾 订单",
      seed: (Date.now() % 1_000_000) + 17,
      reduced,
      order: (n) => {
        while (queue.length <= n) queue.push(makeOrder(queue.length, orderRand));
        return { ...queue[n] };
      },
      sfx: (n) => api.play(n),
      onMove: () => {
        moves--;
        refresh();
      },
      onOrderDone: (total) => {
        // 每清 1 张 +1 步:难度来自订单更苛刻,不是逼着你手忙脚乱
        moves++;
        if (total % 3 === 0) api.addStars(1);
        shell.say.textContent = `第 ${total} 张订单完成，还你 1 步！`;
        refresh();
      },
      onStable: () => {
        refresh();
        if (over || moves > 0) return;
        over = true;
        seat?.stage.setEnabled(false);
        const score = endlessScore(seat?.cleared ?? 0);
        best = save.recordEndlessBest(meta.id, score);
        api.play("oops");
        panel = overPanel(
          shell.wrap,
          "🧾 步数用完啦",
          endlessLine(score, best),
          "🔁 再来一次",
          () => {
            api.play("tap");
            start();
          }
        );
      },
    });
    refresh();
  }

  start();
  return {
    destroy() {
      timers.clear();
      seat?.destroy();
      seat = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "mst-bar-row";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "mst-btn";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "mst-btn mst-btn-vs";
  vsBtn.textContent = "⚔️ 人机对战";
  const duoBtn = document.createElement("button");
  duoBtn.type = "button";
  duoBtn.className = "mst-btn mst-btn-duo";
  duoBtn.textContent = "👫 双人同屏";
  bar.append(endlessBtn, vsBtn, duoBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const b = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = b > 0 ? `♾️ 无尽订单 · 最好 ${b} 张` : "♾️ 无尽订单 · 点我开始！";
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
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, "normal")));
  duoBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, null)));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "步数剩得越多星星越多，机关全清才能过关～",
      grandMessage: "188 关全部消除完毕，你的盘面规划和连锁意识都很到位！",
      guide: guideBook,
      guideTitle: "星星消消乐 · 连锁手记",
    }
  );

  // 壳层给了 initialLevel（或者地址栏带 ?level=N）就直接开打那一关，不卡在章节封面
  const hint = (api as unknown as { initialLevel?: number }).initialLevel;
  const search = (globalThis as { location?: { search?: string } }).location?.search ?? "";
  const want = initialLevelOf(hint, search);
  if (want >= 0) openCampaignLevel(levelHost, want);

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}

/** 给壳层用：直接开打第 n 关（1 基），越界 clamp */
export function openLevel(host: HTMLElement, n: number): boolean {
  return openCampaignLevel(host, Math.max(0, Math.round(n) - 1));
}
