import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  adjacent,
  applyGravity,
  bossRoar,
  clearCells,
  createState,
  creditOrders,
  findMatches,
  goalsMet,
  rainbowTargets,
  runBelts,
  RAINBOW,
  SIZE,
  type CascadeInfo,
  type MatchState
} from "./engine";
import { CHAPTERS, LEVELS, orderLabel, type MatchLevel } from "./levels";

const TOKENS = [
  { emoji: "⭐", bg: "#FFF3C4" },
  { emoji: "💖", bg: "#FFDDE8" },
  { emoji: "🍀", bg: "#D8F5D8" },
  { emoji: "🌙", bg: "#DCE9FF" },
  { emoji: "🍊", bg: "#FFE8D1" },
];

const CSS = `
.mst-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F7, #F3F0FF); border-radius: 16px; padding: 10px; user-select: none; position: relative; }
.mst-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.mst-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #A66BBE; box-shadow: 0 2px 6px rgba(180,140,220,.25); font-size: 14px; }
.mst-goals { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; justify-content: center; }
.mst-goal { background: #fff; border-radius: 12px; padding: 4px 10px; font-weight: 700; color: #8B6BAE; font-size: 14px; box-shadow: 0 2px 5px rgba(180,140,220,.2); }
.mst-goal.mst-done { background: #E4F9E0; color: #57A05B; }
.mst-goal.mst-order { background: #FFF1DC; color: #A8762F; }
.mst-goal.mst-order.mst-done { background: #E4F9E0; color: #57A05B; }
.mst-goal.mst-boss { background: #EDEFE8; color: #6B7360; }
.mst-bar { height: 12px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
.mst-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFB6D9, #C9A7F5); border-radius: 8px; transition: width .3s; }
.mst-board { display: grid; grid-template-columns: repeat(${SIZE}, 1fr); gap: 4px; }
.mst-cell { aspect-ratio: 1; border: none; border-radius: 12px; font-size: clamp(16px, 4.5vw, 26px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .12s, box-shadow .12s; padding: 0; position: relative; }
.mst-cell:active { transform: scale(.9); }
.mst-cell.mst-sel { box-shadow: 0 0 0 3px #FF8FC7; transform: scale(1.08); }
.mst-cell.mst-boom { animation: mstBoom .25s ease; }
.mst-cell.mst-ice::after { content: "🧊"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.15em; background: rgba(200,235,255,.55); border-radius: 12px; }
.mst-cell.mst-vine::after { content: "🌿"; position: absolute; right: -2px; top: -2px; font-size: .8em; }
.mst-cell.mst-vine { box-shadow: inset 0 0 0 3px #8FD08A; }
.mst-cell.mst-frost1::before { content: ""; position: absolute; inset: 0; border-radius: 12px; background: rgba(255,224,240,.62); box-shadow: inset 0 0 0 2px #F7B8D6; pointer-events: none; }
.mst-cell.mst-frost2::before { content: ""; position: absolute; inset: 0; border-radius: 12px; background: rgba(255,203,232,.85); box-shadow: inset 0 0 0 3px #EE8FBF; pointer-events: none; }
.mst-cell.mst-frost1::after, .mst-cell.mst-frost2::after { content: "🍥"; position: absolute; right: -1px; bottom: -1px; font-size: .72em; }
.mst-cell.mst-belt { outline: 2px dashed #7FB7D8; outline-offset: -3px; }
@keyframes mstBoom { 0% { transform: scale(1.25); opacity: .4; } 100% { transform: scale(1); opacity: 1; } }
.mst-msg { text-align: center; min-height: 22px; color: #B06BC0; font-weight: 700; margin-top: 8px; font-size: 15px; }
@media (prefers-reduced-motion: reduce) {
  .mst-cell.mst-boom { animation: none; }
}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: MatchLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let busy = false;
  let levelDone = false;
  let moves = cfg.moves;
  let selected = -1;
  const state: MatchState = createState(cfg, Math.random as () => number);
  const beltRows = new Set((cfg.belts ?? []).map((b) => ((b.row % SIZE) + SIZE) % SIZE));
  /** 开局铺了多少层糖霜（进度条按它算） */
  const frostTotal = state.frostLeft;

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="mst-top">
      <span class="mst-badge mst-moves">👣 ${moves} 步</span>
      ${cfg.rainbow ? '<span class="mst-badge">🌈 会出现彩虹星</span>' : ""}
      ${cfg.belts?.length ? '<span class="mst-badge">🏭 虚线行会平移</span>' : ""}
    </div>
    <div class="mst-goals"></div>
    <div class="mst-bar"><div class="mst-fill"></div></div>
    <div class="mst-board"></div>
    <div class="mst-msg">点一颗星星，再点它旁边的，交换位置吧！</div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".mst-board") as HTMLElement;
  const movesEl = wrap.querySelector(".mst-moves") as HTMLElement;
  const goalsEl = wrap.querySelector(".mst-goals") as HTMLElement;
  const fillEl = wrap.querySelector(".mst-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-msg") as HTMLElement;

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const btn = document.createElement("button");
    btn.className = "mst-cell";
    btn.type = "button";
    btn.addEventListener("click", () => onCell(i));
    boardEl.appendChild(btn);
    cells.push(btn);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function openingHint(): string {
    if (cfg.boss) return `石巨人怕 ${TOKENS[cfg.boss.token].emoji}，多消它就能敲掉护甲！`;
    if (cfg.frost) return "粉色格子盖着糖霜，在上面消一次刮一层！";
    if (cfg.belts?.length) return "虚线那几行是传送带，每走一步就整排挪一格。";
    if (cfg.orders?.length) return "看看订单：要一次消得多，或者连着消好几轮！";
    if (cfg.vine > 0 && cfg.ice > 0) return "冰块旁边消、藤蔓上面消，机关全清才过关！";
    if (cfg.vine > 0) return "在藤蔓格子上消除，才能剪断藤蔓哦！";
    if (cfg.ice > 0) return "在冰块上或旁边消除，就能敲开冰块哦！";
    if (cfg.rainbow) return "彩虹星🌈和谁交换，就消掉全场那种图案！";
    return "收集目标里的图案，步数要省着用～";
  }

  function renderGoals(): void {
    const parts: string[] = cfg.goals.map((g, gi) => {
      const done = state.collected[gi] >= g.count;
      return `<span class="mst-goal${done ? " mst-done" : ""}">${TOKENS[g.token].emoji} ${Math.min(state.collected[gi], g.count)}/${g.count}</span>`;
    });
    if (cfg.ice > 0) parts.push(`<span class="mst-goal${state.iceLeft <= 0 ? " mst-done" : ""}">🧊 ${cfg.ice - state.iceLeft}/${cfg.ice}</span>`);
    if (cfg.vine > 0) parts.push(`<span class="mst-goal${state.vineLeft <= 0 ? " mst-done" : ""}">🌿 ${cfg.vine - state.vineLeft}/${cfg.vine}</span>`);
    if (frostTotal > 0) parts.push(`<span class="mst-goal${state.frostLeft <= 0 ? " mst-done" : ""}">🍥 糖霜 ${frostTotal - state.frostLeft}/${frostTotal} 层</span>`);
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

  function render(boomSet?: Set<number>): void {
    for (let i = 0; i < state.grid.length; i++) {
      const cell = cells[i];
      const v = state.grid[i];
      if (v === RAINBOW) {
        cell.textContent = "🌈";
        cell.style.background = "#fff";
      } else if (v < 0) {
        cell.textContent = "";
        cell.style.background = "rgba(255,255,255,.4)";
      } else {
        cell.textContent = TOKENS[v].emoji;
        cell.style.background = TOKENS[v].bg;
      }
      cell.classList.toggle("mst-ice", state.ice[i]);
      cell.classList.toggle("mst-vine", state.vine[i]);
      cell.classList.toggle("mst-frost1", state.frost[i] === 1);
      cell.classList.toggle("mst-frost2", state.frost[i] >= 2);
      cell.classList.toggle("mst-belt", beltRows.has(Math.floor(i / SIZE)));
      cell.classList.toggle("mst-sel", i === selected);
      cell.classList.toggle("mst-boom", !!boomSet && boomSet.has(i));
    }
    movesEl.textContent = `👣 ${moves} 步`;
  }

  function checkEnd(): void {
    if (levelDone) return;
    if (goalsMet(state, cfg)) {
      levelDone = true;
      const got = moves >= cfg.three ? 3 : moves >= cfg.two ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `还剩 ${moves} 步没用完，真会计划！`), 450);
    } else if (moves <= 0) {
      levelDone = true;
      later(() => ctx.lose("步数用完了，差一点点就成功啦！"), 450);
    }
  }

  /** 这一步走完的收尾：结算订单、转传送带、石巨人捣乱 */
  function finishMove(info: CascadeInfo): void {
    const gained = creditOrders(state, cfg, info);
    if (gained > 0) {
      ctx.sfx("coin");
      msgEl.textContent = "🧾 订单完成一笔，客人笑开花啦！";
    }
    state.used++;
    if (cfg.belts?.length) {
      runBelts(state, cfg);
      render();
    }
    if (cfg.boss && cfg.boss.roarEvery > 0 && state.used % cfg.boss.roarEvery === 0 && state.armor > 0) {
      const at = bossRoar(state, cfg, Math.random as () => number);
      if (at >= 0) {
        ctx.sfx("oops");
        msgEl.textContent = "🗿 石巨人吼了一声，冻住了一颗星星！";
      }
    }
    renderGoals();
    render();
    // 传送带挪完可能又凑出三连，让它自然连锁掉
    if (cfg.belts?.length && findMatches(state.grid).size > 0) {
      busy = true;
      later(() => resolveCascade(1, { steps: 0, total: 0, best: 0 }, false), 200);
      return;
    }
    busy = false;
    checkEnd();
  }

  function resolveCascade(chain: number, acc: CascadeInfo, settle: boolean): void {
    const matched = findMatches(state.grid);
    if (matched.size === 0) {
      if (settle) {
        finishMove(acc);
      } else {
        busy = false;
        checkEnd();
      }
      return;
    }
    ctx.sfx("pop");
    if (matched.size >= 5) {
      ctx.bonusStars(1);
      msgEl.textContent = `哇！一下消掉 ${matched.size} 颗，奖励一颗小星星！`;
    } else if (chain > 1) {
      msgEl.textContent = `连着消了 ${chain} 次，太棒啦！`;
    }
    const next: CascadeInfo = {
      steps: acc.steps + 1,
      total: acc.total + matched.size,
      best: Math.max(acc.best, matched.size)
    };
    clearCells(state, cfg, matched);
    renderGoals();
    render(matched);
    later(() => {
      applyGravity(state, cfg, Math.random as () => number);
      render();
      later(() => resolveCascade(chain + 1, next, settle), 180);
    }, 220);
  }

  /** 彩虹星交换：清掉全场某种图案 */
  function rainbowSwap(a: number, b: number): void {
    const set = rainbowTargets(state, a, b, cfg.colors, Math.random as () => number);
    const target = state.grid[a] === RAINBOW ? state.grid[b] : state.grid[a];
    ctx.sfx("coin");
    if (target >= 0) msgEl.textContent = `彩虹星把 ${TOKENS[target].emoji} 全都变没啦！`;
    moves--;
    busy = true;
    clearCells(state, cfg, set);
    renderGoals();
    render(set);
    later(() => {
      applyGravity(state, cfg, Math.random as () => number);
      render();
      later(() => resolveCascade(1, { steps: 1, total: set.size, best: set.size }, true), 180);
    }, 260);
  }

  function onCell(i: number): void {
    if (levelDone || busy) return;
    if (state.ice[i] || state.vine[i]) {
      ctx.sfx("oops");
      msgEl.textContent = state.ice[i]
        ? "这颗被冰冻住啦，在它旁边消除就能敲开！"
        : "这颗被藤蔓缠住啦，在它上面消除才能剪断！";
      return;
    }
    if (selected === -1) {
      selected = i;
      ctx.sfx("tap");
      render();
      return;
    }
    if (selected === i) {
      selected = -1;
      render();
      return;
    }
    if (!adjacent(selected, i)) {
      selected = i;
      ctx.sfx("tap");
      render();
      return;
    }
    const a = selected, b = i;
    selected = -1;
    if (state.grid[a] === RAINBOW || state.grid[b] === RAINBOW) {
      rainbowSwap(a, b);
      return;
    }
    [state.grid[a], state.grid[b]] = [state.grid[b], state.grid[a]];
    if (findMatches(state.grid).size === 0) {
      [state.grid[a], state.grid[b]] = [state.grid[b], state.grid[a]];
      ctx.sfx("oops");
      msgEl.textContent = "这样换不能消除哦，换个方向试试～";
      render();
      return;
    }
    moves--;
    busy = true;
    render();
    later(() => resolveCascade(1, { steps: 0, total: 0, best: 0 }, true), 120);
  }

  renderGoals();
  render();
  msgEl.textContent = openingHint();

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "步数剩得越多，星星越多！机关全清才能过关～",
    grandMessage: "188 关全部消除完毕，你是真正的消除大师！",
  });
}
