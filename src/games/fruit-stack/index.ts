import { meta } from "./meta";
export { meta };

import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { TIER_LABELS, fillRatio, pickDrop, type Tier } from "./ai";
import guide from "./guide";
import { CHAPTERS, endlessPlan, goalText, planFor, rateLevel, type LevelPlan } from "./levels";
import { CHAIN, MAX_LEVEL, chainMerges, nextFruit, totalScore, type MergeEvent } from "./merge";
import {
  addCircle,
  allSettled,
  makeWorld,
  nearLine,
  overLine,
  stepPhysics,
  type Box,
  type Circle,
  type World,
} from "./physics";

const CSS = `
.fst-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFF3EF,#FDF0FA);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.fst-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.fst-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#a8563f;
  box-shadow:0 2px 6px rgba(200,140,120,.25);white-space:nowrap;}
.fst-chip.fst-warn{color:#c23c3c;background:#ffe9e6;}
.fst-canvas{display:block;width:100%;height:auto;max-height:64vh;border-radius:14px;background:#FFF9F4;touch-action:none;
  box-shadow:inset 0 2px 8px rgba(180,140,120,.18);}
.fst-note{text-align:center;min-height:20px;font-size:13px;font-weight:700;color:#8a6a70;margin-top:8px;}
.fst-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.fst-btn{border:none;border-radius:999px;padding:9px 15px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#a05a48;box-shadow:0 3px 0 rgba(190,130,110,.25);min-height:44px;}
.fst-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(190,130,110,.25);}
.fst-menu{display:flex;flex-direction:column;gap:10px;align-items:center;padding:8px 4px 4px;}
.fst-title{font-size:19px;font-weight:900;color:#b1563f;text-align:center;}
.fst-sub{font-size:13px;font-weight:700;color:#9a7068;text-align:center;line-height:1.6;max-width:330px;}
.fst-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;width:100%;max-width:420px;}
.fst-mode{border:none;border-radius:16px;padding:14px 10px;font-size:16px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#e0785e,#c65f47);box-shadow:0 4px 0 #a44b36;}
.fst-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #a44b36;}
.fst-mode.fst-b{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a;}
.fst-mode.fst-c{background:linear-gradient(180deg,#4fa77c,#3d8c66);box-shadow:0 4px 0 #2e6d4f;}
.fst-mode.fst-d{background:linear-gradient(180deg,#a765c0,#8d51a5);box-shadow:0 4px 0 #6f3f83;}
.fst-tip{font-size:12px;font-weight:700;color:#a08890;text-align:center;line-height:1.6;}
@media (prefers-reduced-motion:reduce){ .fst-btn:active,.fst-mode:active{transform:none;} }
`;

function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

/** 合成动画：先吸合、再弹出 */
interface Puff {
  x: number;
  y: number;
  level: number;
  age: number;
  life: number;
}

export interface StageResult {
  won: boolean;
  score: number;
  used: number;
  highest: number;
  bestChain: number;
}

export interface StageOptions {
  plan: LevelPlan;
  /** 右侧对手容器：null 表示单人 */
  rival: "none" | "ai" | "human";
  rivalTier: Tier;
  label: string;
  onEnd: (r: StageResult) => void;
}

const BOARD_W = 360;
const BOARD_H = 500;

export function mountStage(host: HTMLElement, opts: StageOptions): { destroy: () => void } {
  const soft = reducedMotion();
  const twoBoards = opts.rival !== "none";
  const plan = opts.plan;

  const wrap = document.createElement("div");
  wrap.className = "fst-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="fst-top">
      <span class="fst-chip fst-score">🍬 0</span>
      <span class="fst-chip fst-next">下一个 …</span>
      <span class="fst-chip fst-goal">${goalText(plan)}</span>
      <span class="fst-chip fst-label">${opts.label}</span>
    </div>
    <canvas class="fst-canvas"></canvas>
    <div class="fst-note"></div>
    <div class="fst-row">
      <button type="button" class="fst-btn fst-left">◀ 左移</button>
      <button type="button" class="fst-btn fst-drop">⬇ 放下</button>
      <button type="button" class="fst-btn fst-right">右移 ▶</button>
    </div>`;
  host.appendChild(wrap);

  const canvas = wrap.querySelector(".fst-canvas") as HTMLCanvasElement;
  const scoreEl = wrap.querySelector(".fst-score") as HTMLElement;
  const nextEl = wrap.querySelector(".fst-next") as HTMLElement;
  const noteEl = wrap.querySelector(".fst-note") as HTMLElement;
  const labelEl = wrap.querySelector(".fst-label") as HTMLElement;

  const boardW = twoBoards ? BOARD_W / 2 - 6 : BOARD_W;
  canvas.width = BOARD_W;
  canvas.height = BOARD_H;
  const ctx = canvas.getContext("2d");

  function boxFor(index: number): Box {
    const left = index === 0 ? 8 : BOARD_W / 2 + 4;
    return {
      left,
      right: left + boardW - 16,
      floor: BOARD_H - 12,
      line: plan.lineFromTop + 24,
    };
  }

  interface Side {
    world: World;
    score: number;
    used: number;
    highest: number;
    bestChain: number;
    dropX: number;
    cooldown: number;
    lost: boolean;
    puffs: Puff[];
  }

  function makeSide(index: number): Side {
    const box = boxFor(index);
    return {
      world: makeWorld(box, { restitution: plan.restitution }),
      score: 0,
      used: 0,
      highest: -1,
      bestChain: 0,
      dropX: (box.left + box.right) / 2,
      cooldown: 0,
      lost: false,
      puffs: [],
    };
  }

  const sides: Side[] = twoBoards ? [makeSide(0), makeSide(1)] : [makeSide(0)];
  const me = sides[0];

  let raf = 0;
  let last = 0;
  let paused = false;
  let finished = false;
  let destroyed = false;

  function upcoming(side: Side): number {
    return nextFruit(plan.seed, side.used, plan.maxSpawn);
  }

  function preview(side: Side, n: number): number {
    return nextFruit(plan.seed, side.used + n, plan.maxSpawn);
  }

  function drop(side: Side): void {
    if (finished || side.lost || side.cooldown > 0) return;
    if (side.used >= plan.drops) return;
    const level = upcoming(side);
    const r = CHAIN[level].r;
    const box = side.world.box;
    const x = Math.max(box.left + r + 1, Math.min(box.right - r - 1, side.dropX));
    const c = addCircle(side.world, level, x, box.line - r - 10, r);
    c.vy = 40;
    side.used += 1;
    side.cooldown = 420;
  }

  function moveDrop(side: Side, dx: number): void {
    const box = side.world.box;
    side.dropX = Math.max(box.left + 14, Math.min(box.right - 14, side.dropX + dx));
  }

  function settle(side: Side, dt: number): void {
    stepPhysics(side.world, dt);
    const rounds = chainMerges(side.world);
    if (rounds.length > 0) {
      side.score += totalScore(rounds);
      side.bestChain = Math.max(side.bestChain, rounds.length);
      for (const round of rounds) {
        for (const e of round) {
          side.puffs.push({ x: e.x, y: e.y, level: e.level, age: 0, life: soft ? 120 : 220 });
          side.highest = Math.max(side.highest, e.level);
        }
      }
    }
    for (const c of side.world.circles) side.highest = Math.max(side.highest, c.level);
    side.puffs = side.puffs.filter((p) => {
      p.age += dt;
      return p.age < p.life;
    });
    if (overLine(side.world).length > 0) side.lost = true;
  }

  function goalMet(side: Side): boolean {
    if (side.highest < plan.targetLevel) return false;
    if (plan.targetScore > 0 && side.score < plan.targetScore) return false;
    if (plan.minChain > 0 && side.bestChain < plan.minChain) return false;
    return true;
  }

  function finish(won: boolean): void {
    if (finished) return;
    finished = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    opts.onEnd({ won, score: me.score, used: me.used, highest: me.highest, bestChain: me.bestChain });
  }

  function aiTurn(side: Side, dt: number): void {
    if (opts.rival !== "ai" || side === me) return;
    side.cooldown -= dt;
    if (side.cooldown > 0 || side.lost) return;
    if (!allSettled(side.world)) return;
    const level = upcoming(side);
    side.dropX = pickDrop(side.world, opts.rivalTier, level, plan.seed + 17, side.used);
    drop(side);
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    sides.forEach((side, i) => drawSide(side, i));
  }

  function drawSide(side: Side, index: number): void {
    if (!ctx) return;
    const box = side.world.box;
    ctx.fillStyle = "#FFF9F4";
    ctx.fillRect(box.left - 6, 8, box.right - box.left + 12, BOARD_H - 16);
    ctx.strokeStyle = "#E7C7B8";
    ctx.lineWidth = 3;
    ctx.strokeRect(box.left - 6, 8, box.right - box.left + 12, BOARD_H - 16);

    // 警戒线
    const warn = nearLine(side.world, 26);
    ctx.strokeStyle = warn && (soft || Math.floor(Date.now() / 260) % 2 === 0) ? "#E24B4B" : "#F3B6A6";
    ctx.lineWidth = warn && soft ? 4 : 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(box.left - 6, box.line);
    ctx.lineTo(box.right + 6, box.line);
    ctx.stroke();
    ctx.setLineDash([]);

    // 瞄准线与影子
    if (!side.lost && side !== undefined && (index === 0 || opts.rival === "human")) {
      const level = upcoming(side);
      const r = CHAIN[level].r;
      const x = Math.max(box.left + r + 1, Math.min(box.right - r - 1, side.dropX));
      ctx.strokeStyle = "rgba(200,140,120,.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, box.line);
      ctx.lineTo(x, box.floor);
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      drawFruit(x, box.floor - 4, r * 0.8, level);
      ctx.globalAlpha = 1;
      drawFruit(x, box.line - r - 10, r, level);
    }

    for (const c of side.world.circles) drawFruit(c.x, c.y, c.r, c.level, c);
    for (const p of side.puffs) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t;
      drawFruit(p.x, p.y, CHAIN[p.level].r * (0.6 + t * 0.7), p.level);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#A8563F";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    const who = index === 0 ? "朵朵" : opts.rival === "ai" ? "小对手" : "星星";
    ctx.fillText(`${who} ${side.score}`, (box.left + box.right) / 2, BOARD_H - 2);
  }

  function drawFruit(x: number, y: number, r: number, level: number, c?: Circle): void {
    if (!ctx) return;
    const def = CHAIN[Math.max(0, Math.min(MAX_LEVEL, level))];
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,80,60,.22)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.36, Math.max(1.6, r * 0.2), 0, Math.PI * 2);
    ctx.fill();
    // 小叶子
    ctx.fillStyle = "#7FBF7F";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.16, y - r * 0.92, Math.max(1.6, r * 0.2), Math.max(1, r * 0.1), -0.5, 0, Math.PI * 2);
    ctx.fill();
    if (r >= 16) {
      ctx.fillStyle = "#6b4432";
      ctx.font = `bold ${Math.round(r * 0.52)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.name, x, y + 1);
    }
    if (c && c.graceMs > 0 && !soft) {
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function renderHud(): void {
    scoreEl.textContent = twoBoards ? `🍬 朵朵 ${me.score} · 对手 ${sides[1].score}` : `🍬 ${me.score}`;
    nextEl.textContent = `下一个 ${CHAIN[upcoming(me)].name} → ${CHAIN[preview(me, 1)].name}`;
    labelEl.textContent = `${opts.label} · 已投 ${me.used}`;
    const ratio = fillRatio(me.world);
    if (paused) noteEl.textContent = "已暂停，按 Esc 继续。";
    else if (ratio > 0.82) noteEl.textContent = "快到警戒线啦，先找个能合掉的位置。";
    else noteEl.textContent = "";
  }

  function frame(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(48, now - last);
    last = now;
    if (paused || finished) {
      draw();
      return;
    }
    for (const side of sides) {
      side.cooldown = Math.max(0, side.cooldown - dt);
      settle(side, dt);
      aiTurn(side, dt);
    }
    draw();
    renderHud();

    if (goalMet(me)) {
      finish(true);
      return;
    }
    if (twoBoards && goalMet(sides[1])) {
      finish(false);
      return;
    }
    if (me.lost) {
      finish(false);
      return;
    }
    if (me.used >= plan.drops && allSettled(me.world)) finish(goalMet(me));
  }

  function onKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === "escape") {
      paused = !paused;
      renderHud();
      e.preventDefault();
      return;
    }
    if (k === "a") moveDrop(me, -14);
    else if (k === "d") moveDrop(me, 14);
    else if (k === "f" || k === " ") drop(me);
    else if (opts.rival === "human" && sides[1]) {
      if (k === "arrowleft") moveDrop(sides[1], -14);
      else if (k === "arrowright") moveDrop(sides[1], 14);
      else if (k === "l") drop(sides[1]);
      else return;
    } else return;
    e.preventDefault();
  }

  function pointerSide(clientX: number): Side {
    if (!twoBoards) return me;
    const rect = canvas.getBoundingClientRect();
    const rel = ((clientX - rect.left) / rect.width) * BOARD_W;
    return rel > BOARD_W / 2 && opts.rival === "human" ? sides[1] : me;
  }

  function onPointerMove(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * BOARD_W;
    const side = pointerSide(e.clientX);
    side.dropX = x;
  }
  function onPointerUp(e: PointerEvent): void {
    onPointerMove(e);
    drop(pointerSide(e.clientX));
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKey);

  const leftBtn = wrap.querySelector(".fst-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".fst-right") as HTMLButtonElement;
  const dropBtn = wrap.querySelector(".fst-drop") as HTMLButtonElement;
  const onLeft = (): void => moveDrop(me, -18);
  const onRight = (): void => moveDrop(me, 18);
  const onDrop = (): void => drop(me);
  leftBtn.addEventListener("click", onLeft);
  rightBtn.addEventListener("click", onRight);
  dropBtn.addEventListener("click", onDrop);

  renderHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      leftBtn.removeEventListener("click", onLeft);
      rightBtn.removeEventListener("click", onRight);
      dropBtn.removeEventListener("click", onDrop);
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const plan = planFor(ctx.level);
  const handle = mountStage(stage, {
    plan,
    rival: plan.duel ? "ai" : "none",
    rivalTier: "normal",
    label: `第 ${ctx.level + 1} 关`,
    onEnd: ({ won, used, score }) => {
      if (won) ctx.win(rateLevel(used, plan.drops), `目标达成，拿到 ${score} 分！`);
      else ctx.lose("果子堆太高啦，下一次先把小的放低处。");
    },
  });
  return { destroy: () => handle.destroy() };
}

export function mount(api: GameApi): { destroy: () => void } {
  let child: { destroy: () => void } | null = null;
  const wrap = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  wrap.appendChild(style);
  const view = document.createElement("div");
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  function clear(): void {
    child?.destroy();
    child = null;
    view.innerHTML = "";
  }

  function backBar(label: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "fst-row";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "fst-btn";
    back.textContent = "◀ 换个玩法";
    back.addEventListener("click", () => {
      api.play("tap");
      showMenu();
    });
    const tag = document.createElement("span");
    tag.className = "fst-chip";
    tag.textContent = label;
    row.append(back, tag);
    return row;
  }

  function showMenu(): void {
    clear();
    const menu = document.createElement("div");
    menu.className = "fst-menu";
    menu.innerHTML = `
      <div class="fst-title">🍉 果果合成</div>
      <div class="fst-sub">籽 → 莓 → 柑 → 桃 → 梨 → 苹 → 橙 → 柚 → 瓜 → 玉瓜 → 团圆瓜，一共十一级。同级碰在一起就会变大。</div>`;
    const grid = document.createElement("div");
    grid.className = "fst-modes";
    const modes: Array<{ label: string; cls: string; run: () => void }> = [
      { label: "🚩 闯关 188", cls: "", run: startCampaign },
      { label: "♾️ 无尽堆果", cls: "fst-b", run: startEndless },
      { label: "⚔️ 对盆挑战", cls: "fst-c", run: startVersus },
      { label: "👫 双人对盆", cls: "fst-d", run: startTwoPlayer },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `fst-mode ${m.cls}`;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        api.play("tap");
        m.run();
      });
      grid.appendChild(btn);
    }
    menu.appendChild(grid);
    const tip = document.createElement("div");
    tip.className = "fst-tip";
    tip.textContent = `朵朵：A / D 移动，F 放下｜星星：方向键 + L｜手机拖动松手即投。无尽最高分：${
      save.getGameProgress(meta.id).endlessBest
    }`;
    menu.appendChild(tip);
    view.appendChild(menu);
  }

  function startCampaign(): void {
    clear();
    view.appendChild(backBar("闯关 188"));
    const host = document.createElement("div");
    view.appendChild(host);
    child = mountLevelGame({ ...api, root: host }, {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      guide,
      mapHint: "同级贴同级，连锁才是分数大头。",
      grandMessage: "188 关全部合成成功，团圆瓜都堆成一排啦！",
    });
  }

  function startRun(label: string, rival: "none" | "ai" | "human", tier: Tier, campaignLevel: number | null): void {
    clear();
    view.appendChild(backBar(label));
    const host = document.createElement("div");
    view.appendChild(host);
    const plan = campaignLevel === null ? endlessPlan() : planFor(campaignLevel);
    child = mountStage(host, {
      plan,
      rival,
      rivalTier: tier,
      label,
      onEnd: ({ won, score, highest }) => {
        api.play(won ? "win" : "oops");
        if (campaignLevel === null) {
          const best = save.recordEndlessBest(meta.id, score);
          api.onLose(`这一盆拿到 ${score} 分，最高合到「${CHAIN[Math.max(0, highest)].name}」，历史最好 ${best} 分。`);
        } else if (won) {
          api.onWin(2, `这一盆赢了，拿到 ${score} 分！`);
        } else {
          api.onLose("果子堆太高啦，下一次先把小的放低处。");
        }
        startRun(label, rival, tier, campaignLevel);
      },
    });
  }

  function startEndless(): void {
    startRun("无尽", "none", "normal", null);
  }
  function startVersus(): void {
    startRun(`对盆 · ${TIER_LABELS.pro}`, "ai", "pro", 150);
  }
  function startTwoPlayer(): void {
    startRun("双人对盆", "human", "normal", 140);
  }

  showMenu();

  return {
    destroy() {
      clear();
      wrap.remove();
    },
  };
}
