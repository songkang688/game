export { meta } from "./meta";

// 勇者小路 —— 轻 RPG 闯关 + 装备成长。
// 三种玩法共用一套战斗界面：
//   · 闯关：188 关八章战役，每关一条小路，路上有小怪、宝箱、小摊、岔路，章末是 Boss；
//   · 无尽：无尽深渊，越往下越难，走不动了就「探险结束 · 回城休息」；
//   · 对战：我的三人小队和康康的队伍自动接力，改配装再来一场。
import { meta } from "./meta";
import {
  BAG_SLOTS,
  ELEMENT_EMOJI,
  ELEMENT_LABEL,
  ITEMS,
  MAX_SKILL_RANK,
  SKILLS,
  type Action,
  type CombatEvent,
  type CombatState,
  type Fighter,
  type SoundName,
  actionAllowed,
  affinityHint,
  cloneFighter,
  effectiveAtk,
  hpRatio,
  makeFighter,
  mulberry32,
  resolveRound,
  skillPowerAtRank,
  startCombat
} from "./combat";
import {
  BOSSES,
  CHAPTERS,
  type LevelPlan,
  type PathNode,
  buildLevel,
  chapterHint,
  rateByHp
} from "./levels";
import {
  COMPANIONS,
  GEARS,
  HERO_NAME,
  LOADOUT_SLOTS,
  MAX_HERO_LEVEL,
  SKILL_UNLOCKS,
  type GearSlot,
  type HeroSave,
  addToStash,
  applyArena,
  applyBlessing,
  bagUsedSlots,
  buildHero,
  buildMyTeam,
  buildRivalTeam,
  buyGear,
  carryItem,
  companionById,
  endlessCoins,
  endlessEndText,
  endlessExp,
  endlessFoeSpec,
  endlessStarReward,
  equipGear,
  expToNext,
  gainCoins,
  gainExp,
  gearById,
  gearFactor,
  gearsOfSlot,
  heroStats,
  isBlessingFloor,
  isEndlessGuardian,
  learnSkill,
  loadSave,
  powerScore,
  rankUpCost,
  rollBlessings,
  runArena,
  setPartyMember,
  stashCount,
  syncBagAfterRun,
  toggleLoadout,
  unpackItem,
  writeSave
} from "./logic";
import {
  TOTAL_LEVELS,
  chapterOf,
  clearedCount,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  type GameApi
} from "../level99";
import { Cleanup } from "./cleanup";
import {
  REST_EVERY,
  applySupply,
  fullRoute,
  ghostIndexAt,
  ghostPace,
  ghostTotalMs,
  isRestFloor,
  judgeRace,
  roadMaze,
  rollSupplies,
  validateMaze,
  type Maze,
  type Pt,
  type Supply
} from "./maze";
import {
  FORECAST_EMOJI,
  FORECAST_HINTS,
  FORECAST_LABELS,
  GROWTH_LINE_DESC,
  collectionMultipliers,
  describeCollectionLine,
  forecastFight
} from "./power";
import { collectionEffects } from "../../engine/collection";
import { save as wallet } from "../../engine/save";

/* ------------------------------------------------------------------ */
/* 样式                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.bvp-root{--bvp-ink:#4b3a6e;--bvp-soft:#7b6aa0;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  max-width:640px;margin:0 auto;color:var(--bvp-ink);user-select:none;-webkit-user-select:none;}
.bvp-root *{box-sizing:border-box;}
.bvp-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.bvp-btn{border:none;border-radius:14px;padding:9px 15px;font-size:15px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#fff;color:#6b56a0;box-shadow:0 3px 0 rgba(120,95,170,.28);white-space:nowrap;}
.bvp-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.28);}
.bvp-btn[disabled]{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.bvp-btn-go{background:linear-gradient(180deg,#c078d8,#a55cc0);color:#fff;box-shadow:0 4px 0 #8a479f;}
.bvp-btn-go:active{box-shadow:0 1px 0 #8a479f;}
.bvp-btn-on{outline:3px solid #ffb2d8;}
.bvp-btn-sm{padding:6px 11px;font-size:13px;border-radius:11px;}
.bvp-chip{background:#ffffffcc;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#6b56a0;}
.bvp-card{background:linear-gradient(180deg,#fffdff,#f4f0ff);border-radius:18px;padding:14px;
  box-shadow:0 4px 14px rgba(140,120,190,.16);margin-bottom:12px;}
.bvp-h{font-size:17px;font-weight:900;margin:0 0 8px;display:flex;align-items:center;gap:6px;}
.bvp-sub{font-size:13px;font-weight:700;color:var(--bvp-soft);line-height:1.65;}
.bvp-modes{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:560px){.bvp-modes{grid-template-columns:1fr 1fr;}}
.bvp-mode{border:none;border-radius:18px;padding:15px;text-align:left;cursor:pointer;font-family:inherit;
  display:flex;gap:12px;align-items:flex-start;box-shadow:0 4px 12px rgba(140,120,190,.18);color:var(--bvp-ink);}
.bvp-mode:active{transform:translateY(2px);}
.bvp-mode-em{font-size:34px;line-height:1;flex:0 0 auto;}
.bvp-mode-t{font-size:17px;font-weight:900;display:block;margin-bottom:3px;}
.bvp-mode-d{font-size:13px;font-weight:700;color:var(--bvp-soft);line-height:1.55;display:block;}
.bvp-hero-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;font-weight:800;color:var(--bvp-soft);}
.bvp-fighter{background:#fff;border-radius:16px;padding:11px 12px;box-shadow:0 3px 10px rgba(140,120,190,.16);margin-bottom:9px;}
.bvp-fighter-top{display:flex;align-items:center;gap:9px;margin-bottom:7px;}
.bvp-face{font-size:30px;line-height:1;}
.bvp-name{font-size:15px;font-weight:900;flex:1;min-width:0;}
.bvp-tag{font-size:11px;font-weight:800;border-radius:999px;padding:3px 8px;background:#f0ebff;color:#6b56a0;white-space:nowrap;}
.bvp-tag-boss{background:#ffe0ec;color:#b4457c;}
.bvp-tag-weak{background:#fff0d4;color:#a4700f;}
.bvp-hpbar{height:13px;border-radius:999px;background:#eee6f8;overflow:hidden;position:relative;}
.bvp-hpfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#7fd39a,#4fb87c);transition:width .28s ease;}
.bvp-hpfill.bvp-low{background:linear-gradient(90deg,#ffb877,#f18b4c);}
.bvp-shbar{height:8px;border-radius:999px;background:#e7eefb;overflow:hidden;margin-top:4px;}
.bvp-shfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#8fc2ff,#5f9be8);transition:width .28s ease;}
.bvp-nums{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--bvp-soft);margin-top:4px;gap:6px;flex-wrap:wrap;}
.bvp-warn{background:#fff2d8;border-radius:12px;padding:8px 10px;font-size:13px;font-weight:800;color:#9a6a12;margin:8px 0;}
.bvp-log{background:#fbf8ff;border-radius:14px;padding:10px 12px;min-height:86px;max-height:150px;overflow-y:auto;
  font-size:13px;font-weight:700;color:#5b4b82;line-height:1.75;margin-bottom:10px;}
.bvp-log p{margin:0 0 3px;}
.bvp-log p:last-child{color:#3f2f66;}
.bvp-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
@media(min-width:480px){.bvp-acts{grid-template-columns:1fr 1fr 1fr;}}
.bvp-act{border:none;border-radius:14px;padding:11px 8px;font-family:inherit;cursor:pointer;text-align:center;
  background:#fff;box-shadow:0 3px 0 rgba(120,95,170,.24);color:var(--bvp-ink);}
.bvp-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.24);}
.bvp-act[disabled]{opacity:.42;cursor:default;transform:none;box-shadow:none;}
.bvp-act-t{display:block;font-size:14px;font-weight:900;}
.bvp-act-d{display:block;font-size:11px;font-weight:700;color:var(--bvp-soft);margin-top:2px;}
.bvp-path{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}
.bvp-dot{width:26px;height:26px;border-radius:50%;background:#ece5fb;display:flex;align-items:center;
  justify-content:center;font-size:13px;color:#8d7bb5;font-weight:900;}
.bvp-dot-done{background:#cfeedd;color:#3c7a58;}
.bvp-dot-now{background:#ffd6ea;color:#a83a72;outline:3px solid #fff;}
.bvp-opts{display:grid;grid-template-columns:1fr;gap:9px;}
@media(min-width:520px){.bvp-opts.bvp-opts-2{grid-template-columns:1fr 1fr;}}
.bvp-opt{border:none;border-radius:16px;padding:13px;cursor:pointer;font-family:inherit;text-align:left;
  background:#fff;box-shadow:0 3px 10px rgba(140,120,190,.18);color:var(--bvp-ink);display:flex;gap:10px;align-items:center;}
.bvp-opt:active{transform:translateY(2px);}
.bvp-opt-em{font-size:27px;line-height:1;}
.bvp-opt-t{font-size:14px;font-weight:900;display:block;}
.bvp-opt-d{font-size:12px;font-weight:700;color:var(--bvp-soft);display:block;margin-top:2px;}
.bvp-list{display:flex;flex-direction:column;gap:8px;}
.bvp-row{display:flex;align-items:center;gap:9px;background:#fff;border-radius:13px;padding:9px 11px;
  box-shadow:0 2px 7px rgba(140,120,190,.13);}
.bvp-row-main{flex:1;min-width:0;}
.bvp-row-t{font-size:14px;font-weight:900;}
.bvp-row-d{font-size:12px;font-weight:700;color:var(--bvp-soft);line-height:1.5;}
.bvp-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;}
.bvp-tabs::-webkit-scrollbar{display:none;}
.bvp-note{text-align:center;font-size:13px;font-weight:800;color:#a06a9a;margin:8px 0;min-height:18px;}
.bvp-team{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.bvp-vs{text-align:center;font-size:15px;font-weight:900;color:#a05c9c;margin:6px 0;}
.bvp-mini{font-size:12px;font-weight:800;color:var(--bvp-soft);}
.bvp-btn:focus-visible,.bvp-act:focus-visible,.bvp-opt:focus-visible,.bvp-mode:focus-visible,
.bvp-pad:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
.bvp-fore-easy{background:#dff5e4;color:#2f7a4c;}
.bvp-fore-risky{background:#fff1d6;color:#94670e;}
.bvp-fore-hard{background:#ffe2e8;color:#a83f60;}
.bvp-maze{display:grid;gap:2px;margin:10px auto;max-width:320px;}
.bvp-mz{aspect-ratio:1;border-radius:4px;background:#fbf8ff;display:flex;align-items:center;
  justify-content:center;font-size:12px;line-height:1;}
.bvp-mz-wall{background:#c8bde4;border-radius:3px;}
.bvp-mz-been{background:#eee6ff;}
.bvp-mz-me{background:#ffd6ea;font-size:14px;}
.bvp-mz-ghost{background:#dbe8ff;}
.bvp-pads{display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,52px);
  gap:8px;justify-content:center;margin-top:8px;}
.bvp-pad{border:none;border-radius:14px;font-size:20px;font-family:inherit;cursor:pointer;
  background:#fff;color:#6b56a0;box-shadow:0 3px 0 rgba(120,95,170,.26);min-width:56px;min-height:52px;}
.bvp-pad:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.26);}
.bvp-pad-void{visibility:hidden;}
@media (prefers-reduced-motion:reduce){.bvp-hpfill,.bvp-shfill{transition:none;}}
`;

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function button(label: string, className = "bvp-btn", onClick?: () => void): HTMLButtonElement {
  const b = el("button", className);
  b.type = "button";
  b.innerHTML = label;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

/**
 * 成长第三线：把收藏册的跨游戏加成折进勇者的战斗数值。
 * 收藏册是**只读**的，本文件只负责乘一下；上限由 `power.ts` 硬夹在 +35% 以内。
 */
function heroWithCollection(s: HeroSave, hp?: number): Fighter {
  const base = buildHero(s, hp);
  const mul = collectionMultipliers(collectionEffects());
  const maxHp = Math.max(1, Math.round(base.maxHp * mul.hpMul));
  return {
    ...base,
    maxHp,
    hp: Math.max(1, Math.min(maxHp, hp === undefined ? maxHp : Math.round(base.hp * mul.hpMul))),
    atk: Math.max(1, Math.round(base.atk * mul.atkMul)),
    def: Math.max(0, Math.round(base.def * mul.defMul)),
    crit: Math.min(1, base.crit + mul.critAdd)
  };
}

function elementTag(f: { element: keyof typeof ELEMENT_LABEL }): string {
  return `${ELEMENT_EMOJI[f.element]}${ELEMENT_LABEL[f.element]}系`;
}

/** 定时器与事件监听的统一管理，destroy 时一次清干净 */
/* ------------------------------------------------------------------ */
/* 角色卡片（星芒条 / 护盾 / 读条警告）                                    */
/* ------------------------------------------------------------------ */

interface FighterCard {
  root: HTMLElement;
  update: (f: Fighter, note?: string) => void;
}

function fighterCard(f: Fighter, showStats: boolean): FighterCard {
  const root = el("div", "bvp-fighter");
  const top = el("div", "bvp-fighter-top");
  const face = el("div", "bvp-face", f.emoji);
  const name = el("div", "bvp-name");
  const tags = el("div");
  tags.style.display = "flex";
  tags.style.gap = "4px";
  tags.style.flexWrap = "wrap";
  top.append(face, name, tags);

  const hpbar = el("div", "bvp-hpbar");
  const hpfill = el("div", "bvp-hpfill");
  hpbar.appendChild(hpfill);
  const shbar = el("div", "bvp-shbar");
  const shfill = el("div", "bvp-shfill");
  shbar.appendChild(shfill);
  const nums = el("div", "bvp-nums");
  const warn = el("div", "bvp-warn");
  warn.hidden = true;

  root.append(top, hpbar, shbar, nums, warn);

  const update = (cur: Fighter, note?: string): void => {
    face.textContent = cur.emoji;
    name.textContent = cur.name;
    tags.innerHTML = "";
    const tEl = el("span", "bvp-tag", elementTag(cur));
    tags.appendChild(tEl);
    if (cur.isBoss) tags.appendChild(el("span", "bvp-tag bvp-tag-boss", "首领"));
    if (cur.weakness) {
      tags.appendChild(
        el("span", "bvp-tag bvp-tag-weak", `弱点 ${ELEMENT_EMOJI[cur.weakness]}${ELEMENT_LABEL[cur.weakness]}`)
      );
    }
    const ratio = hpRatio(cur);
    hpfill.style.width = `${Math.round(ratio * 100)}%`;
    hpfill.classList.toggle("bvp-low", ratio <= 0.35);
    const shRatio = cur.maxHp > 0 ? Math.min(1, cur.shield / cur.maxHp) : 0;
    shbar.hidden = cur.shield <= 0;
    shfill.style.width = `${Math.round(shRatio * 100)}%`;

    const bits = [`星芒 ${Math.max(0, Math.round(cur.hp))}/${cur.maxHp}`];
    if (cur.shield > 0) bits.push(`护盾 ${cur.shield}`);
    if (showStats) bits.push(`攻 ${effectiveAtk(cur)} · 防 ${cur.def} · 速 ${cur.spd}`);
    if (cur.powerTurns > 0) bits.push(`劲头 ${cur.powerTurns} 回合`);
    if (cur.stun > 0) bits.push("转圈圈中");
    nums.innerHTML = bits.map((b) => `<span>${b}</span>`).join("");

    const warnText =
      note ??
      (cur.charge ? `⚠️ 正在蓄力「${cur.charge.name}」，下个回合就放出来——按防御！` : "");
    warn.hidden = warnText === "";
    warn.textContent = warnText;
  };

  update(f);
  return { root, update };
}

/* ------------------------------------------------------------------ */
/* 迷宫小路：走图 + 幽灵竞速                                             */
/* ------------------------------------------------------------------ */

interface MazeRaceOptions {
  maze: Maze;
  /** 幽灵的脚程；不给就是一个人溜达（练习用） */
  pace?: { stepMs: number; hesitateEvery: number };
  sfx: (n: SoundName) => void;
  onEnd: (r: { result: "win" | "lose" | "tie"; playerMs: number; ghostMs: number }) => void;
}

function mountMazeRace(host: HTMLElement, opts: MazeRaceOptions): { destroy: () => void } {
  const cleanup = new Cleanup();
  const m = opts.maze;
  const route = fullRoute(m) ?? [m.start];
  const ghostMs = opts.pace ? ghostTotalMs(route, opts.pace) : Number.POSITIVE_INFINITY;

  const wrap = el("div");
  host.appendChild(wrap);

  const bar = el("div", "bvp-bar");
  const stateChip = el("span", "bvp-chip", "🔑 还没拿到钥匙");
  const timeChip = el("span", "bvp-chip", "⏱️ 0.0 秒");
  bar.append(stateChip, timeChip);
  wrap.appendChild(bar);

  const grid = el("div", "bvp-maze");
  grid.style.gridTemplateColumns = `repeat(${m.cols},1fr)`;
  const cells: HTMLElement[][] = [];
  for (let r = 0; r < m.rows; r++) {
    const row: HTMLElement[] = [];
    for (let c = 0; c < m.cols; c++) {
      const cell = el("div", "bvp-mz");
      grid.appendChild(cell);
      row.push(cell);
    }
    cells.push(row);
  }
  wrap.appendChild(grid);

  const note = el("div", "bvp-note", "方向键 / WASD 或下面的按钮走路。先找到钥匙 🔑，再从门 🚪 过去到出口 🏁。");
  wrap.appendChild(note);

  const pads = el("div", "bvp-pads");
  const padDefs: Array<[string, number, number] | null> = [
    null,
    ["⬆️", -1, 0],
    null,
    ["⬅️", 0, -1],
    ["⬇️", 1, 0],
    ["➡️", 0, 1]
  ];
  for (const def of padDefs) {
    if (!def) {
      pads.appendChild(el("span", "bvp-pad bvp-pad-void"));
      continue;
    }
    const [label, dr, dc] = def;
    const b = button(label, "bvp-pad", () => step(dr, dc));
    b.setAttribute("aria-label", label === "⬆️" ? "往上走" : label === "⬇️" ? "往下走" : label === "⬅️" ? "往左走" : "往右走");
    pads.appendChild(b);
  }
  wrap.appendChild(pads);

  let me: Pt = [m.start[0], m.start[1]];
  let hasKey = false;
  let done = false;
  let startAt = 0;
  let elapsed = 0;
  const been = new Set<string>([`${me[0]},${me[1]}`]);

  function ghostAt(): Pt {
    if (!opts.pace) return m.start;
    return route[ghostIndexAt(route, elapsed, opts.pace)] ?? m.start;
  }

  function paint(): void {
    const g = ghostAt();
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        let cls = "bvp-mz";
        let text = "";
        if (m.walls[r][c]) {
          cls += " bvp-mz-wall";
        } else {
          if (been.has(`${r},${c}`)) cls += " bvp-mz-been";
          if (!hasKey && r === m.key[0] && c === m.key[1]) text = "🔑";
          if (r === m.door[0] && c === m.door[1]) text = hasKey ? "🚪" : "🔒";
          if (r === m.exit[0] && c === m.exit[1]) text = "🏁";
          if (opts.pace && r === g[0] && c === g[1]) {
            cls += " bvp-mz-ghost";
            text = "⭐";
          }
          if (r === me[0] && c === me[1]) {
            cls += " bvp-mz-me";
            text = "🌸";
          }
        }
        const cell = cells[r][c];
        if (cell.className !== cls) cell.className = cls;
        if (cell.textContent !== text) cell.textContent = text;
      }
    }
    stateChip.textContent = hasKey ? "🔑 钥匙到手，去出口！" : "🔑 还没拿到钥匙";
    timeChip.textContent = `⏱️ ${(elapsed / 1000).toFixed(1)} 秒`;
  }

  function finish(result: "win" | "lose" | "tie"): void {
    if (done) return;
    done = true;
    cleanup.killTimers();
    paint();
    opts.sfx(result === "win" ? "win" : "tap");
    opts.onEnd({ result, playerMs: elapsed, ghostMs: Number.isFinite(ghostMs) ? ghostMs : elapsed });
  }

  function step(dr: number, dc: number): void {
    if (done) return;
    const nr = me[0] + dr;
    const nc = me[1] + dc;
    if (nr < 0 || nr >= m.rows || nc < 0 || nc >= m.cols) return;
    if (m.walls[nr][nc]) return;
    if (!hasKey && nr === m.door[0] && nc === m.door[1]) {
      note.textContent = "🔒 这扇门锁着，先去把钥匙 🔑 找到。";
      opts.sfx("oops");
      return;
    }
    me = [nr, nc];
    been.add(`${nr},${nc}`);
    if (!hasKey && nr === m.key[0] && nc === m.key[1]) {
      hasKey = true;
      opts.sfx("coin");
      note.textContent = "🔑 钥匙拿到啦！现在门开得了，冲向 🏁 出口！";
    } else {
      opts.sfx("tap");
    }
    paint();
    if (nr === m.exit[0] && nc === m.exit[1]) {
      finish(opts.pace ? judgeRace(elapsed, ghostMs) : "win");
    }
  }

  const onKey = (ev: KeyboardEvent): void => {
    const map: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      w: [-1, 0],
      s: [1, 0],
      a: [0, -1],
      d: [0, 1],
      W: [-1, 0],
      S: [1, 0],
      A: [0, -1],
      D: [0, 1]
    };
    const dir = map[ev.key];
    if (!dir) return;
    ev.preventDefault();
    step(dir[0], dir[1]);
  };
  cleanup.on(window as unknown as { addEventListener(t: string, f: (e: never) => void): void; removeEventListener(t: string, f: (e: never) => void): void }, "keydown", onKey as (e: never) => void);

  function tick(now: number): void {
    if (cleanup.dead || done) return;
    if (startAt === 0) startAt = now;
    elapsed = now - startAt;
    paint();
    if (opts.pace && elapsed >= ghostMs) {
      finish("lose");
      return;
    }
    cleanup.frame(tick);
  }
  paint();
  cleanup.frame(tick);

  return {
    destroy() {
      done = true;
      cleanup.destroy();
      wrap.remove();
    }
  };
}

/* ------------------------------------------------------------------ */
/* 战斗界面                                                            */
/* ------------------------------------------------------------------ */

interface BattleOptions {
  hero: Fighter;
  foe: Fighter;
  sfx: (n: SoundName) => void;
  /** 这一场的标题，例如「第 3 关 · 第 2 步」 */
  title: string;
  /** 打完之后：win = 勇者赢了；hero 是带着剩余星芒 / 背包的勇者 */
  onEnd: (result: { win: boolean; hero: Fighter }) => void;
  /** 逃跑按钮（无尽模式的「先回城」） */
  onFlee?: () => void;
  fleeLabel?: string;
}

/** 一步一步播事件的节奏（毫秒） */
const EVENT_STEP = 520;

function mountBattle(host: HTMLElement, opts: BattleOptions): { destroy: () => void } {
  const cleanup = new Cleanup();
  const wrap = el("div");
  host.appendChild(wrap);

  let state: CombatState = startCombat(opts.hero, opts.foe);
  let busy = false;

  const head = el("div", "bvp-bar");
  const title = el("span", "bvp-chip", opts.title);
  head.appendChild(title);
  const roundChip = el("span", "bvp-chip");
  head.appendChild(roundChip);
  if (opts.onFlee) {
    head.appendChild(
      button(opts.fleeLabel ?? "🏠 先回城", "bvp-btn bvp-btn-sm", () => {
        if (busy) return;
        opts.sfx("tap");
        opts.onFlee?.();
      })
    );
  }

  // 1.2 三档预判：只给「打得过 / 有点悬 / 打不过」，不报任何数字，探索感留给孩子自己
  const guess = forecastFight(state.hero, state.foe);
  const foreChip = el("span", `bvp-chip bvp-fore bvp-fore-${guess}`, `${FORECAST_EMOJI[guess]} ${FORECAST_LABELS[guess]}`);
  head.appendChild(foreChip);

  const foeCard = fighterCard(state.foe, false);
  const foreNote = el("div", "bvp-note", FORECAST_HINTS[guess]);
  const logBox = el("div", "bvp-log");
  logBox.setAttribute("role", "log");
  logBox.setAttribute("aria-live", "polite");
  const heroCard = fighterCard(state.hero, true);
  const hint = el("div", "bvp-note");
  const acts = el("div", "bvp-acts");

  wrap.append(head, foeCard.root, foreNote, logBox, heroCard.root, hint, acts);

  function say(text: string): void {
    const p = el("p", undefined, text);
    logBox.appendChild(p);
    while (logBox.childElementCount > 24) logBox.removeChild(logBox.firstChild as ChildNode);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function refresh(): void {
    roundChip.textContent = `第 ${state.round} 回合`;
    foeCard.update(state.foe);
    heroCard.update(state.hero);
    hint.textContent = state.over ? "" : affinityHint(state.hero.element, state.foe.element);
    renderActions();
  }

  function renderActions(): void {
    acts.innerHTML = "";
    if (state.over) return;
    const add = (t: string, d: string, action: Action, extraOk = true): void => {
      const b = el("button", "bvp-act");
      b.type = "button";
      b.innerHTML = `<span class="bvp-act-t">${t}</span><span class="bvp-act-d">${d}</span>`;
      const ok = extraOk && actionAllowed(state.hero, action) && !busy;
      b.disabled = !ok;
      if (ok) b.addEventListener("click", () => take(action));
      acts.appendChild(b);
    };

    add("👊 攻击", `${elementTag(state.hero)} · 稳稳一下`, { kind: "attack" });
    for (const s of state.hero.skills) {
      const def = SKILLS[s.id];
      if (!def) continue;
      const cd = state.hero.cooldowns[s.id] ?? 0;
      const power = skillPowerAtRank(def, s.rank);
      const desc =
        cd > 0
          ? `还要凉 ${cd} 回合`
          : def.kind === "heal"
            ? `回 ${Math.round(power * 100)}% 星芒`
            : def.kind === "buff"
              ? "提升攻击力"
              : `${ELEMENT_EMOJI[def.element]} ${power.toFixed(2)} 倍${def.kind === "breaker" ? " · 破盾" : def.kind === "pierce" ? " · 穿透" : ""}`;
      add(`${def.emoji} ${def.name}`, desc, { kind: "skill", skillId: s.id }, cd <= 0);
    }
    add("🛡️ 防御", "这回合少掉一半星芒", { kind: "guard" });
    for (const slot of state.hero.bag) {
      const def = ITEMS[slot.id];
      if (!def || slot.count <= 0) continue;
      add(`${def.emoji} ${def.name}`, `还有 ${slot.count} 个`, { kind: "item", itemId: slot.id });
    }
  }

  function playEvents(events: CombatEvent[], done: () => void): void {
    let i = 0;
    const step = (): void => {
      if (cleanup.dead) return;
      if (i >= events.length) {
        done();
        return;
      }
      const ev = events[i++];
      say(ev.text);
      if (ev.sound) opts.sfx(ev.sound);
      foeCard.update(state.foe);
      heroCard.update(state.hero);
      cleanup.after(EVENT_STEP, step);
    };
    step();
  }

  function take(action: Action): void {
    if (busy || state.over || cleanup.dead) return;
    busy = true;
    opts.sfx("tap");
    renderActions();
    const seed = (state.round * 7919 + Math.floor(Math.random() * 100000)) >>> 0;
    const res = resolveRound(state, action, mulberry32(seed));
    state = res.state;
    playEvents(res.events, () => {
      busy = false;
      refresh();
      if (state.over) {
        cleanup.after(420, () => {
          if (cleanup.dead) return;
          opts.onEnd({ win: state.winner === "hero", hero: cloneFighter(state.hero) });
        });
      }
    });
  }

  say(`${state.foe.emoji} ${state.foe.name} 挡在前面！${affinityHint(state.hero.element, state.foe.element)}`);
  if (state.foe.weakness) {
    say(`看它的样子，${ELEMENT_EMOJI[state.foe.weakness]}${ELEMENT_LABEL[state.foe.weakness]}系的招式对它特别管用。`);
  }
  refresh();

  return {
    destroy() {
      cleanup.destroy();
      wrap.remove();
    }
  };
}

/* ------------------------------------------------------------------ */
/* 闯关模式的一关：沿着小路往前走                                        */
/* ------------------------------------------------------------------ */

interface LevelCtxLike {
  level: number;
  chapterIndex: number;
  win: (stars: 1 | 2 | 3, msg?: string) => void;
  lose: (msg?: string) => void;
  sfx: (n: SoundName) => void;
}

interface RunDeps {
  getSave: () => HeroSave;
  setSave: (s: HeroSave) => void;
  toast: (text: string) => void;
}

function playPathLevel(stage: HTMLElement, ctx: LevelCtxLike, deps: RunDeps): { destroy: () => void } {
  const cleanup = new Cleanup();
  const plan: LevelPlan = buildLevel(ctx.level);
  const wrap = el("div");
  stage.appendChild(wrap);

  let hero: Fighter = heroWithCollection(deps.getSave());
  let step = 0;
  let child: { destroy: () => void } | null = null;
  let settled = false;

  function dropChild(): void {
    try {
      child?.destroy();
    } catch (err) {
      console.warn("[一朵一星] 勇者小路关卡子界面清理出错:", err);
    }
    child = null;
  }

  function persistBag(): void {
    deps.setSave(syncBagAfterRun(deps.getSave(), hero.bag));
  }

  function finishLevel(win: boolean): void {
    if (settled || cleanup.dead) return;
    settled = true;
    persistBag();
    if (!win) {
      ctx.lose("这一趟走得有点吃力，回去把装备和技能理一理，下次一定顺。");
      return;
    }
    const reward = plan.reward;
    let save = gainCoins(deps.getSave(), reward.coins);
    const grown = gainExp(save, reward.exp);
    save = grown.save;
    deps.setSave(save);
    const stars = rateByHp(hpRatio(hero));
    const extra = grown.levelsGained > 0 ? `升到 ${save.level} 级啦！` : "";
    ctx.win(stars, `走通啦！拿到 ${reward.coins} 枚金币、${reward.exp} 点经验。${extra}`);
  }

  function pathDots(): HTMLElement {
    const row = el("div", "bvp-path");
    plan.steps.forEach((_, i) => {
      const dot = el("div", `bvp-dot${i < step ? " bvp-dot-done" : i === step ? " bvp-dot-now" : ""}`);
      dot.textContent = i < step ? "✓" : String(i + 1);
      row.appendChild(dot);
    });
    row.appendChild(el("div", "bvp-dot", "🏁"));
    return row;
  }

  function heroStrip(): HTMLElement {
    const row = el("div", "bvp-hero-line");
    row.innerHTML = `<span class="bvp-chip">${hero.emoji} 星芒 ${Math.max(0, Math.round(hero.hp))}/${hero.maxHp}</span>
      <span class="bvp-chip">${elementTag(hero)}</span>
      <span class="bvp-chip">🪙 ${deps.getSave().coins}</span>`;
    return row;
  }

  function nodeDesc(node: PathNode): string {
    switch (node.kind) {
      case "chest":
        return `打开看看，大概有 ${node.coins} 枚金币${node.itemId ? `，说不定还有${ITEMS[node.itemId]?.name}` : ""}。`;
      case "shop":
        return `糯糯在这儿摆了个小摊，卖 ${(node.stock ?? []).map((id) => ITEMS[id]?.name ?? id).join("、")}。`;
      case "rest":
        return `坐一会儿，回 ${Math.round((node.healRatio ?? 0) * 100)}% 星芒。`;
      case "boss":
        return node.foe ? `${BOSSES[plan.chapterIndex].tip}` : "小路尽头的大家伙。";
      default: {
        const f = node.foe;
        if (!f) return "打一架。";
        return `${elementTag(f)} · 星芒 ${f.maxHp} · 攻 ${f.atk}｜${affinityHint(hero.element, f.element)}`;
      }
    }
  }

  function showStep(): void {
    dropChild();
    cleanup.killTimers();
    wrap.innerHTML = "";
    if (settled) return;

    if (step >= plan.steps.length) {
      finishLevel(true);
      return;
    }
    if (hero.hp <= 0) {
      finishLevel(false);
      return;
    }

    const head = el("div", "bvp-card");
    head.appendChild(el("div", "bvp-h", `${CHAPTERS[plan.chapterIndex].emoji} 第 ${plan.level + 1} 关 · 第 ${step + 1} 步`));
    head.appendChild(pathDots());
    head.appendChild(heroStrip());
    wrap.appendChild(head);

    const options = plan.steps[step];
    const note = el("div", "bvp-note");
    note.textContent = options.length > 1 ? "前面分岔了，挑一条走吧——选哪条都能往前。" : plan.goalText;
    wrap.appendChild(note);

    const box = el("div", `bvp-opts${options.length > 1 ? " bvp-opts-2" : ""}`);
    options.forEach((node) => {
      const b = el("button", "bvp-opt");
      b.type = "button";
      b.innerHTML = `<span class="bvp-opt-em">${node.emoji}</span><span class="bvp-row-main">
        <span class="bvp-opt-t">${node.label}</span><span class="bvp-opt-d">${nodeDesc(node)}</span></span>`;
      b.addEventListener("click", () => {
        ctx.sfx("tap");
        enter(node);
      });
      box.appendChild(b);
    });
    wrap.appendChild(box);
  }

  function advance(): void {
    step += 1;
    persistBag();
    showStep();
  }

  function enter(node: PathNode): void {
    if (node.kind === "chest") {
      let save = gainCoins(deps.getSave(), node.coins ?? 0);
      if (node.itemId) save = addToStash(save, node.itemId, 1);
      deps.setSave(save);
      ctx.sfx("coin");
      deps.toast(
        `🎁 宝箱里有 ${node.coins} 枚金币${node.itemId ? `，还有一个${ITEMS[node.itemId]?.name}（已放进仓库）` : ""}。`
      );
      advance();
      return;
    }
    if (node.kind === "rest") {
      const back = Math.round(hero.maxHp * (node.healRatio ?? 0.3));
      hero = { ...hero, hp: Math.min(hero.maxHp, hero.hp + back) };
      ctx.sfx("meow");
      deps.toast(`🪵 靠着歇脚石坐了一会儿，星芒 +${back}。`);
      advance();
      return;
    }
    if (node.kind === "shop") {
      showShop(node);
      return;
    }
    const spec = node.foe;
    if (!spec) {
      advance();
      return;
    }
    dropChild();
    wrap.innerHTML = "";
    child = mountBattle(wrap, {
      hero,
      foe: makeFighter(spec),
      sfx: ctx.sfx,
      title: `第 ${plan.level + 1} 关 · 第 ${step + 1} 步`,
      onEnd: ({ win, hero: after }) => {
        hero = after;
        if (!win) {
          finishLevel(false);
          return;
        }
        advance();
      }
    });
  }

  function showShop(node: PathNode): void {
    dropChild();
    wrap.innerHTML = "";
    const card = el("div", "bvp-card");
    card.appendChild(el("div", "bvp-h", "🏪 糯糯的小摊"));
    card.appendChild(
      el("div", "bvp-sub", `买来的东西会先放进仓库，再从仓库塞进背包（背包只有 ${BAG_SLOTS} 格，要挑着带）。`)
    );
    const info = el("div", "bvp-note");
    const list = el("div", "bvp-list");

    const draw = (): void => {
      const save = deps.getSave();
      info.textContent = `🪙 ${save.coins} 枚金币 · 背包 ${bagUsedSlots(save)}/${BAG_SLOTS} 格`;
      list.innerHTML = "";
      for (const id of node.stock ?? []) {
        const def = ITEMS[id];
        if (!def) continue;
        const row = el("div", "bvp-row");
        row.innerHTML = `<span class="bvp-face">${def.emoji}</span>
          <span class="bvp-row-main"><span class="bvp-row-t">${def.name} · ${def.price} 金币</span>
          <span class="bvp-row-d">${def.desc}　仓库里有 ${stashCount(save, id)} 个</span></span>`;
        const buy = button("买一个", "bvp-btn bvp-btn-sm bvp-btn-go", () => {
          const cur = deps.getSave();
          if (cur.coins < def.price) {
            info.textContent = `还差 ${def.price - cur.coins} 枚金币，先去打几只小怪吧。`;
            ctx.sfx("oops");
            return;
          }
          ctx.sfx("coin");
          deps.setSave(addToStash(gainCoins(cur, -def.price), id, 1));
          draw();
        });
        buy.disabled = deps.getSave().coins < def.price;
        const carry = button("装进背包", "bvp-btn bvp-btn-sm", () => {
          const r = carryItem(deps.getSave(), id);
          if (!r.ok) {
            info.textContent = r.reason;
            ctx.sfx("oops");
            return;
          }
          ctx.sfx("pop");
          deps.setSave(r.save);
          // 背包变了，正在路上的勇者也要跟着更新
          hero = { ...hero, bag: r.save.bag.map((s) => ({ ...s })) };
          draw();
        });
        carry.disabled = stashCount(save, id) <= 0;
        row.append(buy, carry);
        list.appendChild(row);
      }
    };
    draw();

    card.append(info, list);
    const go = button("继续往前走 ▶", "bvp-btn bvp-btn-go", () => {
      ctx.sfx("tap");
      advance();
    });
    go.style.marginTop = "10px";
    card.appendChild(go);
    wrap.appendChild(card);
  }

  showStep();

  return {
    destroy() {
      cleanup.destroy();
      dropChild();
      wrap.remove();
    }
  };
}

/* ------------------------------------------------------------------ */
/* 主界面                                                              */
/* ------------------------------------------------------------------ */

type Screen = "menu" | "campaign" | "endless" | "arena" | "prep";

export function mount(api: GameApi): { destroy: () => void } {
  const outer = new Cleanup();
  const root = el("div", "bvp-root");
  const style = el("style");
  style.textContent = CSS;
  root.appendChild(style);
  const view = el("div");
  root.appendChild(view);
  api.root.appendChild(root);

  let save: HeroSave = loadSave();
  let screen: Screen = "menu";
  let current: { destroy: () => void } | null = null;
  let flash = "";

  const getSave = (): HeroSave => save;
  const setSave = (next: HeroSave): void => {
    save = next;
    writeSave(save);
  };
  const toast = (text: string): void => {
    flash = text;
  };
  const sfx = (n: SoundName): void => api.play(n);

  function dropCurrent(): void {
    try {
      current?.destroy();
    } catch (err) {
      console.warn("[一朵一星] 勇者小路界面清理出错:", err);
    }
    current = null;
  }

  function go(next: Screen): void {
    screen = next;
    render();
  }

  function topBar(label: string): HTMLElement {
    const bar = el("div", "bvp-bar");
    bar.appendChild(
      button("◀ 换个玩法", "bvp-btn bvp-btn-sm", () => {
        sfx("tap");
        go("menu");
      })
    );
    bar.appendChild(el("span", "bvp-chip", label));
    bar.appendChild(el("span", "bvp-chip", `Lv.${save.level}`));
    bar.appendChild(el("span", "bvp-chip", `🪙 ${save.coins}`));
    bar.appendChild(
      button("🎒 备战", "bvp-btn bvp-btn-sm", () => {
        sfx("tap");
        go("prep");
      })
    );
    return bar;
  }

  /* ---------------- 首页：选玩法 ---------------- */

  /** 读 188 关框架的存档，说清楚现在走到哪一章了 */
  function campaignProgressText(): string {
    const stars = loadStars(meta.id);
    const skips = loadSkips(meta.id);
    const at = furthestPlayable(stars, skips, TOTAL_LEVELS);
    const cleared = clearedCount(stars);
    const ch = CHAPTERS[chapterOf(CHAPTERS, at)];
    if (cleared <= 0) return `从${CHAPTERS[0].emoji}${CHAPTERS[0].name}的第 1 关起步。`;
    if (cleared >= TOTAL_LEVELS) return "188 关全部走通，随时可以回去刷三星。";
    return `已经走通 ${cleared} 关，眼下在${ch.emoji}${ch.name}的第 ${at + 1} 关。`;
  }

  function renderMenu(): void {
    const s = heroStats(save);
    const card = el("div", "bvp-card");
    card.appendChild(el("div", "bvp-h", "🗡️ 勇者小路"));
    card.appendChild(
      el(
        "div",
        "bvp-sub",
        `${HERO_NAME}背上小包出发啦。路上有小怪、宝箱、小摊和岔路，打赢了就往前走一步。` +
          `每一招都有属性，火克草、草克水、水克火，光和暗互相克——挑对属性，一下顶两下。`
      )
    );
    const line = el("div", "bvp-hero-line");
    line.style.marginTop = "10px";
    line.innerHTML = `<span class="bvp-chip">Lv.${save.level}</span>
      <span class="bvp-chip">${elementTag(s)}</span>
      <span class="bvp-chip">星芒 ${s.maxHp}</span>
      <span class="bvp-chip">攻 ${s.atk} · 防 ${s.def} · 速 ${s.spd}</span>
      <span class="bvp-chip">战力 ${powerScore(s)}</span>
      <span class="bvp-chip">🪙 ${save.coins}</span>`;
    card.appendChild(line);
    view.appendChild(card);

    if (flash) {
      const f = el("div", "bvp-note", flash);
      view.appendChild(f);
      flash = "";
    }

    const modes = el("div", "bvp-modes");
    const addMode = (emoji: string, title: string, desc: string, color: string, target: Screen): void => {
      const b = el("button", "bvp-mode");
      b.type = "button";
      b.style.background = color;
      b.innerHTML = `<span class="bvp-mode-em">${emoji}</span><span class="bvp-row-main">
        <span class="bvp-mode-t">${title}</span><span class="bvp-mode-d">${desc}</span></span>`;
      b.addEventListener("click", () => {
        sfx("pop");
        go(target);
      });
      modes.appendChild(b);
    };
    addMode(
      "🗺️",
      "闯关 · 188 关",
      `八个主题章节，每章尽头有一位首领。${campaignProgressText()}`,
      "linear-gradient(180deg,#fff2f8,#ffe3ef)",
      "campaign"
    );
    addMode(
      "🕳️",
      "无尽深渊",
      `一层一层往下走，越走越难，随时可以回城。最好成绩：第 ${save.endlessBest} 层。`,
      "linear-gradient(180deg,#f2f0ff,#e6e2fb)",
      "endless"
    );
    addMode(
      "⚔️",
      "对战 · 康康的队伍",
      `三对三接力，双方自动比拼。已挑战 ${save.arenaPlays} 次，赢了 ${save.arenaWins} 次。`,
      "linear-gradient(180deg,#eef7ff,#dcecff)",
      "arena"
    );
    addMode(
      "🎒",
      "备战小屋",
      "换装备、点技能、整理背包、挑同伴。出发前多花一分钟，路上少走十步弯路。",
      "linear-gradient(180deg,#f3fff0,#e2f6dd)",
      "prep"
    );
    view.appendChild(modes);

    const lines = el("div", "bvp-card");
    lines.appendChild(el("div", "bvp-h", "🌱 三条成长线"));
    lines.appendChild(
      el(
        "div",
        "bvp-sub",
        `① <b>等级</b>：${GROWTH_LINE_DESC.level}现在 Lv.${save.level}／满级 ${MAX_HERO_LEVEL}。<br>` +
          `② <b>装备</b>：${GROWTH_LINE_DESC.gear}<br>` +
          `③ <b>收藏册</b>：${GROWTH_LINE_DESC.collection}眼下是 ${describeCollectionLine(collectionEffects())}`
      )
    );
    view.appendChild(lines);

    const tips = el("div", "bvp-card");
    tips.appendChild(el("div", "bvp-h", "📌 三条要记住的"));
    tips.appendChild(
      el(
        "div",
        "bvp-sub",
        "① 对手在蓄力大招时，按「防御」能把这一下挡掉一半；<br>" +
          "② 对手张开护盾时，普通招式几乎打不动，得用破盾或穿透的招；<br>" +
          `③ 背包只有 ${BAG_SLOTS} 格，带什么出门是要想一想的。`
      )
    );
    view.appendChild(tips);
  }

  /* ---------------- 闯关 ---------------- */

  function renderCampaign(): void {
    view.appendChild(topBar("🗺️ 188 关战役"));
    const host = el("div");
    view.appendChild(host);
    const subApi: GameApi = {
      root: host,
      play: api.play,
      addStars: api.addStars,
      getStars: api.getStars,
      onWin: api.onWin,
      onLose: api.onLose
    };
    current = mountLevelGame(subApi, {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: (stage, ctx) =>
        playPathLevel(
          stage,
          {
            level: ctx.level,
            chapterIndex: ctx.chapterIndex,
            win: ctx.win,
            lose: ctx.lose,
            sfx: ctx.sfx
          },
          { getSave, setSave, toast: (t) => showInline(stage, t) }
        ),
      mapHint: "开局前先去「备战」看看：徽章决定你普通攻击的属性，选对了整章都好打。",
      grandMessage: "188 关全部走通！小路的尽头是星辉之巅，你就是这条路上最勇敢的小勇者。"
    });
  }

  /** 关卡里的即时提示（宝箱 / 休息点），两秒后自己消失 */
  function showInline(stage: HTMLElement, text: string): void {
    const tip = el("div", "bvp-note", text);
    stage.appendChild(tip);
    outer.after(2400, () => tip.remove());
  }

  /* ---------------- 无尽深渊 ---------------- */

  function renderEndless(): void {
    view.appendChild(topBar("🕳️ 无尽深渊"));
    const host = el("div");
    view.appendChild(host);
    current = mountEndless(host);
  }

  function mountEndless(host: HTMLElement): { destroy: () => void } {
    const cleanup = new Cleanup();
    const wrap = el("div");
    host.appendChild(wrap);

    let hero: Fighter | null = null;
    let depth = 0;
    let child: { destroy: () => void } | null = null;
    let earned = 0;

    const dropChild = (): void => {
      try {
        child?.destroy();
      } catch (err) {
        console.warn("[一朵一星] 深渊子界面清理出错:", err);
      }
      child = null;
    };

    function lobby(message?: string): void {
      dropChild();
      wrap.innerHTML = "";
      hero = null;
      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", "🕳️ 无尽深渊"));
      card.appendChild(
        el(
          "div",
          "bvp-sub",
          "一层一层往下走，星芒不会自动回满，全靠背包里的东西和路上的祝福撑着。" +
            `每 3 层可以挑一个祝福，每 8 层有一位守门的大家伙。最好成绩：第 ${save.endlessBest} 层。`
        )
      );
      if (message) card.appendChild(el("div", "bvp-note", message));
      const info = el("div", "bvp-hero-line");
      const s = heroStats(save);
      info.innerHTML = `<span class="bvp-chip">Lv.${save.level}</span>
        <span class="bvp-chip">${elementTag(s)}</span>
        <span class="bvp-chip">星芒 ${s.maxHp}</span>
        <span class="bvp-chip">背包 ${bagUsedSlots(save)}/${BAG_SLOTS}</span>`;
      card.appendChild(info);
      const go = button("⬇️ 下到第 1 层", "bvp-btn bvp-btn-go", () => {
        sfx("jump");
        hero = heroWithCollection(save);
        depth = 0;
        earned = 0;
        nextFloor();
      });
      go.style.marginTop = "10px";
      card.appendChild(go);
      wrap.appendChild(card);
    }

    function nextFloor(): void {
      dropChild();
      wrap.innerHTML = "";
      if (!hero) return;
      const floor = depth + 1;
      child = mountBattle(wrap, {
        hero,
        foe: makeFighter(endlessFoeSpec(floor)),
        sfx,
        title: `第 ${floor} 层${isEndlessGuardian(floor) ? " · 守门的" : ""}`,
        fleeLabel: "🏠 到此为止",
        onFlee: () => settle("你收好背包，顺着来路慢慢爬了上去。"),
        onEnd: ({ win, hero: after }) => {
          hero = after;
          if (!win) {
            settle();
            return;
          }
          depth = floor;
          const coins = endlessCoins(floor);
          earned += coins;
          setSave(gainCoins(save, coins));
          betweenFloors(coins);
        }
      });
    }

    function betweenFloors(coins: number): void {
      dropChild();
      wrap.innerHTML = "";
      if (!hero) return;

      // 1.2 无尽之路：每 5 层歇一次脚，三选一带走一样小补给（都很温和，没有「拿到就赢」）
      if (isRestFloor(depth)) {
        const rest = el("div", "bvp-card");
        rest.appendChild(el("div", "bvp-h", `⛺ 第 ${depth} 层 · 休息点`));
        rest.appendChild(el("div", "bvp-sub", "路边有块平地，坐下歇一会儿。三样里挑一样带走。"));
        const box = el("div", "bvp-opts bvp-opts-2");
        for (const s of rollSupplies(depth)) {
          const btn = el("button", "bvp-opt");
          btn.type = "button";
          btn.innerHTML = `<span class="bvp-opt-em">${s.emoji}</span><span class="bvp-row-main">
            <span class="bvp-opt-t">${s.name}</span><span class="bvp-opt-d">${s.desc}</span></span>`;
          btn.addEventListener("click", () => {
            sfx("coin");
            if (!hero) return;
            hero = applySupply(hero, s);
            if (s.kind === "coins") setSave(gainCoins(save, s.amount));
            afterRest(coins);
          });
          box.appendChild(btn);
        }
        rest.appendChild(box);
        wrap.appendChild(rest);
        return;
      }

      afterRest(coins);
    }

    /** 补给挑完（或这一层没有休息点）之后：该给祝福给祝福，否则问要不要继续 */
    function afterRest(coins: number): void {
      dropChild();
      wrap.innerHTML = "";
      if (!hero) return;
      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", `✅ 第 ${depth} 层走完了`));
      card.appendChild(
        el(
          "div",
          "bvp-sub",
          `捡到 ${coins} 枚金币，现在星芒 ${Math.round(hero.hp)}/${hero.maxHp}。` +
            `再走 ${REST_EVERY - (depth % REST_EVERY)} 层就到下一个休息点。`
        )
      );
      wrap.appendChild(card);

      if (isBlessingFloor(depth)) {
        const pick = el("div", "bvp-card");
        pick.appendChild(el("div", "bvp-h", "✨ 挑一个祝福带走"));
        pick.appendChild(el("div", "bvp-sub", "只能挑一个。想稳一点就挑防御和回复，想快点下潜就挑攻击。"));
        const box = el("div", "bvp-opts bvp-opts-2");
        for (const b of rollBlessings(depth, hero.maxHp > 0 ? hero.hp / hero.maxHp : 1)) {
          const btn = el("button", "bvp-opt");
          btn.type = "button";
          btn.innerHTML = `<span class="bvp-opt-em">${b.emoji}</span><span class="bvp-row-main">
            <span class="bvp-opt-t">${b.name}</span><span class="bvp-opt-d">${b.desc}</span></span>`;
          btn.addEventListener("click", () => {
            sfx("coin");
            if (!hero) return;
            hero = applyBlessing(hero, b);
            if (b.kind === "coins") setSave(gainCoins(save, b.amount));
            nextFloor();
          });
          box.appendChild(btn);
        }
        pick.appendChild(box);
        wrap.appendChild(pick);
        return;
      }

      const row = el("div", "bvp-bar");
      row.appendChild(
        button(`⬇️ 继续下到第 ${depth + 1} 层`, "bvp-btn bvp-btn-go", () => {
          sfx("jump");
          nextFloor();
        })
      );
      row.appendChild(
        button("🏠 到此为止，回城", "bvp-btn", () => {
          sfx("tap");
          settle("你带着满满一兜金币，顺着来路慢慢爬了上去。");
        })
      );
      wrap.appendChild(row);
    }

    function settle(reason?: string): void {
      dropChild();
      wrap.innerHTML = "";
      const best = save.endlessBest;
      const stars = endlessStarReward(depth, best);
      const exp = endlessExp(depth);
      let next = gainExp(save, exp).save;
      if (depth > best) next = { ...next, endlessBest: depth };
      if (hero) next = syncBagAfterRun(next, hero.bag);
      setSave(next);
      // 1.2：无尽成绩也记进平台存档，首页的「无尽最好成绩」才看得到
      try {
        wallet.recordEndlessBest(meta.id, depth);
      } catch (err) {
        console.warn("[一朵一星] 勇者小路无尽成绩没记上:", err);
      }
      if (stars > 0) api.addStars(stars);
      sfx(depth > best ? "win" : "tap");

      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", "🏠 探险结束 · 回城休息"));
      card.appendChild(el("div", "bvp-sub", reason ?? endlessEndText(depth, best)));
      card.appendChild(
        el(
          "div",
          "bvp-sub",
          `这一趟：走到第 ${depth} 层，攒下 ${earned} 枚金币、${exp} 点经验` +
            `${stars > 0 ? `，还拿到 ${stars} 颗小星星` : ""}。`
        )
      );
      if (depth > best) card.appendChild(el("div", "bvp-note", `🎉 新纪录！之前最深是第 ${best} 层。`));
      wrap.appendChild(card);

      const row = el("div", "bvp-bar");
      row.appendChild(
        button("🔁 再下一趟", "bvp-btn bvp-btn-go", () => {
          sfx("tap");
          lobby();
        })
      );
      row.appendChild(
        button("🎒 去备战小屋", "bvp-btn", () => {
          sfx("tap");
          go("prep");
        })
      );
      wrap.appendChild(row);
    }

    lobby();

    return {
      destroy() {
        cleanup.destroy();
        dropChild();
        wrap.remove();
      }
    };
  }

  /* ---------------- 对战：康康的队伍 ---------------- */

  function renderArena(): void {
    view.appendChild(topBar("⚔️ 康康的队伍"));
    const host = el("div");
    view.appendChild(host);
    current = mountArena(host);
  }

  function teamCard(title: string, team: Fighter[], color: string): HTMLElement {
    const card = el("div", "bvp-card");
    card.style.background = color;
    card.appendChild(el("div", "bvp-h", title));
    for (const f of team) {
      const row = el("div", "bvp-row");
      row.innerHTML = `<span class="bvp-face">${f.emoji}</span><span class="bvp-row-main">
        <span class="bvp-row-t">${f.name}　<span class="bvp-mini">${elementTag(f)}</span></span>
        <span class="bvp-row-d">星芒 ${f.maxHp} · 攻 ${f.atk} · 防 ${f.def} · 速 ${f.spd}</span></span>`;
      card.appendChild(row);
    }
    return card;
  }

  function mountArena(host: HTMLElement): { destroy: () => void } {
    const cleanup = new Cleanup();
    const wrap = el("div");
    host.appendChild(wrap);
    let raceHandle: { destroy: () => void } | null = null;

    const dropRace = (): void => {
      try {
        raceHandle?.destroy();
      } catch (err) {
        console.warn("[一朵一星] 竞速界面清理出错:", err);
      }
      raceHandle = null;
    };

    function lobby(message?: string): void {
      cleanup.killTimers();
      dropRace();
      wrap.innerHTML = "";
      const intro = el("div", "bvp-card");
      intro.appendChild(el("div", "bvp-h", "⚔️ 和康康的队伍比一场"));
      intro.appendChild(
        el(
          "div",
          "bvp-sub",
          "三对三接力：队首先上，谁先歇下就换后面的人顶上，一整队都歇下的那边算输。" +
            "两边都由队员自己判断出招，你能做的是——出发前把装备、技能和同伴配好。"
        )
      );
      if (message) intro.appendChild(el("div", "bvp-note", message));
      wrap.appendChild(intro);

      const mine = buildMyTeam(save);
      const theirs = buildRivalTeam(save.level, save.arenaWins, gearFactor(save));
      const grid = el("div", "bvp-team");
      grid.appendChild(teamCard("🌸 我的队伍", mine, "linear-gradient(180deg,#fff4f9,#ffe6f1)"));
      grid.appendChild(teamCard("⭐ 康康的队伍", theirs, "linear-gradient(180deg,#f0f6ff,#e0ecff)"));
      wrap.appendChild(grid);

      const row = el("div", "bvp-bar");
      row.appendChild(
        button("开打！", "bvp-btn bvp-btn-go", () => {
          sfx("jump");
          fight();
        })
      );
      row.appendChild(
        button("🧭 同图竞速", "bvp-btn", () => {
          sfx("jump");
          race();
        })
      );
      row.appendChild(
        button("🎒 先去调配装", "bvp-btn", () => {
          sfx("tap");
          go("prep");
        })
      );
      wrap.appendChild(row);

      const raceCard = el("div", "bvp-card");
      raceCard.appendChild(el("div", "bvp-h", "🧭 同图竞速：谁先跑到出口"));
      raceCard.appendChild(
        el(
          "div",
          "bvp-sub",
          "同一张迷宫，你和康康留下的影子各跑各的：先找到钥匙 🔑，再穿过门 🚪 冲到 🏁。" +
            "影子跑的是最短路，但它会时不时犹豫一下——你只要不绕远路，就追得上。"
        )
      );
      wrap.appendChild(raceCard);
    }

    /** 1.2 对战新形态：同一张迷宫，和对手的影子比谁先到终点 */
    function race(): void {
      cleanup.killTimers();
      dropRace();
      wrap.innerHTML = "";
      const seed = (Date.now() ^ ((save.arenaPlays + 1) * 7919)) >>> 0;
      const maze = roadMaze(seed, 4 + Math.min(6, Math.floor(save.arenaWins / 2)));
      const check = validateMaze(maze);
      if (!check.ok) {
        // 生成器有兜底，真出岔子也不白屏：换回三对三
        lobby("这张图没长好，先来一场三对三吧！");
        return;
      }
      const head = el("div", "bvp-card");
      head.appendChild(el("div", "bvp-h", "🧭 同图竞速"));
      head.appendChild(
        el("div", "bvp-sub", `这张图最短要走 ${check.steps} 步。影子已经出发了，别愣着！`)
      );
      wrap.appendChild(head);
      const host = el("div");
      wrap.appendChild(host);
      raceHandle = mountMazeRace(host, {
        maze,
        pace: ghostPace(save.arenaWins),
        sfx,
        onEnd: ({ result, playerMs, ghostMs }) => {
          const coins = result === "win" ? 40 : result === "tie" ? 20 : 12;
          setSave(gainCoins(save, coins));
          const line =
            result === "win"
              ? `🎉 你先到！用了 ${(playerMs / 1000).toFixed(1)} 秒，影子要 ${(ghostMs / 1000).toFixed(1)} 秒。`
              : result === "tie"
                ? "⏱️ 一模一样的时间，握个手！"
                : `影子先到了一步——它走的是最短路，下次先在心里画一遍再迈腿。捡到 ${coins} 枚金币。`;
          cleanup.after(400, () => lobby(`${line}（这一趟 +${coins} 金币）`));
        }
      });
    }

    function fight(): void {
      cleanup.killTimers();
      dropRace();
      wrap.innerHTML = "";
      const seed = (Date.now() ^ (save.arenaPlays * 7919)) >>> 0;
      const outcome = runArena(save, seed);

      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", "⚔️ 比赛进行中"));
      const log = el("div", "bvp-log");
      log.setAttribute("role", "log");
      log.setAttribute("aria-live", "polite");
      card.appendChild(log);
      wrap.appendChild(card);

      const lines = outcome.result.bouts.map((b, i) => {
        const who = b.winner === "hero" ? b.a : b.winner === "foe" ? b.b : "两边都";
        return `第 ${i + 1} 场：${b.a} 对上 ${b.b}，打了 ${b.rounds} 个回合，${who}${
          b.winner === null ? "打得难分难解" : "笑到了最后"
        }。`;
      });

      let i = 0;
      const step = (): void => {
        if (cleanup.dead) return;
        if (i < lines.length) {
          log.appendChild(el("p", undefined, lines[i++]));
          log.scrollTop = log.scrollHeight;
          sfx("tap");
          cleanup.after(680, step);
          return;
        }
        finish(outcome);
      };
      cleanup.after(420, step);
    }

    function finish(outcome: ReturnType<typeof runArena>): void {
      setSave(applyArena(save, outcome));
      if (outcome.stars > 0) api.addStars(outcome.stars);
      sfx(outcome.win ? "win" : "oops");

      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", outcome.win ? "🎉 我们赢啦！" : "🌱 这次差一点"));
      card.appendChild(el("div", "bvp-sub", outcome.text));
      card.appendChild(
        el(
          "div",
          "bvp-sub",
          `拿到 ${outcome.coins} 枚金币、${outcome.exp} 点经验` +
            `${outcome.stars > 0 ? `，还有 ${outcome.stars} 颗小星星` : ""}。` +
            `累计战绩：${save.arenaWins} 胜 / ${save.arenaPlays} 场。`
        )
      );
      wrap.appendChild(card);

      const row = el("div", "bvp-bar");
      row.appendChild(
        button("🔁 再来一场", "bvp-btn bvp-btn-go", () => {
          sfx("tap");
          lobby();
        })
      );
      row.appendChild(
        button("🎒 换套配装再打", "bvp-btn", () => {
          sfx("tap");
          go("prep");
        })
      );
      wrap.appendChild(row);
    }

    lobby();

    return {
      destroy() {
        cleanup.destroy();
        dropRace();
        wrap.remove();
      }
    };
  }

  /* ---------------- 备战小屋 ---------------- */

  type PrepTab = "gear" | "skill" | "bag" | "team";

  function renderPrep(): void {
    view.appendChild(topBar("🎒 备战小屋"));
    const host = el("div");
    view.appendChild(host);
    current = mountPrep(host);
  }

  function mountPrep(host: HTMLElement): { destroy: () => void } {
    const cleanup = new Cleanup();
    const wrap = el("div");
    host.appendChild(wrap);
    let tab: PrepTab = "gear";
    let note = "";

    function draw(): void {
      wrap.innerHTML = "";
      const s = heroStats(save);
      const head = el("div", "bvp-card");
      head.appendChild(el("div", "bvp-h", `${HERO_NAME}的备战小屋`));
      const line = el("div", "bvp-hero-line");
      line.innerHTML = `<span class="bvp-chip">Lv.${save.level}</span>
        <span class="bvp-chip">${elementTag(s)}</span>
        <span class="bvp-chip">星芒 ${s.maxHp}</span>
        <span class="bvp-chip">攻 ${s.atk}</span>
        <span class="bvp-chip">防 ${s.def}</span>
        <span class="bvp-chip">速 ${s.spd}</span>
        <span class="bvp-chip">暴击 ${Math.round(s.crit * 100)}%</span>
        <span class="bvp-chip">战力 ${powerScore(s)}</span>`;
      head.appendChild(line);
      const line2 = el("div", "bvp-hero-line");
      line2.style.marginTop = "6px";
      const need = expToNext(save.level);
      line2.innerHTML = `<span class="bvp-chip">🪙 ${save.coins}</span>
        <span class="bvp-chip">技能点 ${save.skillPoints}</span>
        <span class="bvp-chip">${
          save.level >= MAX_HERO_LEVEL ? "已经练到顶啦" : `距下一级 ${Math.max(0, need - save.exp)} 经验`
        }</span>`;
      head.appendChild(line2);
      wrap.appendChild(head);

      const tabs = el("div", "bvp-tabs");
      const addTab = (key: PrepTab, label: string): void => {
        const b = button(label, `bvp-btn bvp-btn-sm${tab === key ? " bvp-btn-on" : ""}`, () => {
          sfx("tap");
          tab = key;
          note = "";
          draw();
        });
        tabs.appendChild(b);
      };
      addTab("gear", "🗡️ 装备");
      addTab("skill", "✨ 技能");
      addTab("bag", "🎒 背包");
      addTab("team", "🤝 同伴");
      wrap.appendChild(tabs);

      if (note) wrap.appendChild(el("div", "bvp-note", note));

      if (tab === "gear") drawGear();
      else if (tab === "skill") drawSkill();
      else if (tab === "bag") drawBag();
      else drawTeam();

      const back = button("◀ 回到玩法选择", "bvp-btn", () => {
        sfx("tap");
        go("menu");
      });
      back.style.marginTop = "10px";
      wrap.appendChild(back);
    }

    const SLOT_LABEL: Record<GearSlot, string> = {
      weapon: "🗡️ 武器",
      armor: "🛡️ 护甲",
      charm: "🍀 挂饰",
      badge: "🎫 属性徽章"
    };

    function drawGear(): void {
      for (const slot of ["weapon", "armor", "charm", "badge"] as GearSlot[]) {
        const card = el("div", "bvp-card");
        card.appendChild(el("div", "bvp-h", SLOT_LABEL[slot]));
        if (slot === "badge") {
          card.appendChild(el("div", "bvp-sub", "徽章决定你「普通攻击」的属性。技能有自己的属性，不受徽章影响。"));
        }
        const list = el("div", "bvp-list");
        for (const g of gearsOfSlot(slot)) {
          const owned = save.owned.includes(g.id);
          const worn = save.gear[slot] === g.id;
          const row = el("div", "bvp-row");
          row.innerHTML = `<span class="bvp-face">${g.emoji}</span><span class="bvp-row-main">
            <span class="bvp-row-t">${g.name}${worn ? "　<span class=\"bvp-mini\">装备中</span>" : ""}</span>
            <span class="bvp-row-d">${g.desc}${owned ? "" : `　需要 ${g.reqLevel} 级 · ${g.price} 金币`}</span></span>`;
          if (worn) {
            const tag = el("span", "bvp-tag", "✔");
            row.appendChild(tag);
          } else if (owned) {
            row.appendChild(
              button("换上", "bvp-btn bvp-btn-sm bvp-btn-go", () => {
                sfx("pop");
                setSave(equipGear(save, g.id));
                note = `换上${g.name}啦。`;
                draw();
              })
            );
          } else {
            const buy = button(`买（${g.price}）`, "bvp-btn bvp-btn-sm", () => {
              const r = buyGear(save, g.id);
              if (!r.ok) {
                note = r.reason;
                sfx("oops");
                draw();
                return;
              }
              sfx("coin");
              setSave(equipGear(r.save, g.id));
              note = `买下${g.name}并换上了。`;
              draw();
            });
            buy.disabled = save.level < g.reqLevel || save.coins < g.price;
            row.appendChild(buy);
          }
          list.appendChild(row);
        }
        card.appendChild(list);
        wrap.appendChild(card);
      }
    }

    function drawSkill(): void {
      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", `✨ 技能（最多带 ${LOADOUT_SLOTS} 个上场）`));
      card.appendChild(
        el(
          "div",
          "bvp-sub",
          `技能点 ${save.skillPoints} 点，升级一次可以让威力再高一档。` +
            "破盾招专治护盾，穿透招无视护盾，治疗和激励留着关键时刻用。"
        )
      );
      const list = el("div", "bvp-list");
      for (const u of SKILL_UNLOCKS) {
        const def = SKILLS[u.id];
        if (!def) continue;
        const rank = save.ranks[u.id] ?? 0;
        const on = save.loadout.includes(u.id);
        const cost = rank === 0 ? u.cost : rankUpCost(rank);
        const row = el("div", "bvp-row");
        row.innerHTML = `<span class="bvp-face">${def.emoji}</span><span class="bvp-row-main">
          <span class="bvp-row-t">${def.name}　<span class="bvp-mini">${
            rank > 0 ? `${rank}/${MAX_SKILL_RANK} 级` : `${u.reqLevel} 级解锁`
          }${on ? " · 已上阵" : ""}</span></span>
          <span class="bvp-row-d">${def.desc}${
            rank > 0 && rank < MAX_SKILL_RANK ? `　升级要 ${cost} 点` : rank === 0 ? `　学会要 ${u.cost} 点` : ""
          }</span></span>`;
        if (rank < MAX_SKILL_RANK) {
          const b = button(rank === 0 ? "学会" : "升级", "bvp-btn bvp-btn-sm bvp-btn-go", () => {
            const r = learnSkill(save, u.id);
            if (!r.ok) {
              note = r.reason;
              sfx("oops");
              draw();
              return;
            }
            sfx("jump");
            setSave(r.save);
            note = rank === 0 ? `学会了${def.name}！` : `${def.name}练到 ${rank + 1} 级。`;
            draw();
          });
          b.disabled = save.level < u.reqLevel || save.skillPoints < cost;
          row.appendChild(b);
        }
        if (rank > 0) {
          row.appendChild(
            button(on ? "下阵" : "上阵", `bvp-btn bvp-btn-sm${on ? " bvp-btn-on" : ""}`, () => {
              const next = toggleLoadout(save, u.id);
              if (next === save || next.loadout.length === save.loadout.length) {
                note = on
                  ? "身上至少留一招呀，空着手上擂台可打不过星星。"
                  : `上阵位置只有 ${LOADOUT_SLOTS} 个，先把一个换下来。`;
                sfx("oops");
                draw();
                return;
              }
              sfx("tap");
              setSave(next);
              note = "";
              draw();
            })
          );
        }
        list.appendChild(row);
      }
      card.appendChild(list);
      wrap.appendChild(card);
    }

    function drawBag(): void {
      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", `🎒 背包（${bagUsedSlots(save)}/${BAG_SLOTS} 格）`));
      card.appendChild(
        el("div", "bvp-sub", `出门只能带 ${BAG_SLOTS} 样东西，剩下的留在仓库里。多带回复还是多带破盾，自己拿主意。`)
      );
      const list = el("div", "bvp-list");
      for (const def of Object.values(ITEMS)) {
        const inBag = save.bag.find((x) => x.id === def.id)?.count ?? 0;
        const inStash = stashCount(save, def.id);
        const row = el("div", "bvp-row");
        row.innerHTML = `<span class="bvp-face">${def.emoji}</span><span class="bvp-row-main">
          <span class="bvp-row-t">${def.name}　<span class="bvp-mini">背包 ${inBag} · 仓库 ${inStash}</span></span>
          <span class="bvp-row-d">${def.desc}</span></span>`;
        const buy = button(`买（${def.price}）`, "bvp-btn bvp-btn-sm", () => {
          if (save.coins < def.price) {
            note = `还差 ${def.price - save.coins} 枚金币。`;
            sfx("oops");
            draw();
            return;
          }
          sfx("coin");
          setSave(addToStash(gainCoins(save, -def.price), def.id, 1));
          note = `买了一个${def.name}，放进仓库了。`;
          draw();
        });
        buy.disabled = save.coins < def.price;
        const take = button("装包", "bvp-btn bvp-btn-sm bvp-btn-go", () => {
          const r = carryItem(save, def.id);
          if (!r.ok) {
            note = r.reason;
            sfx("oops");
            draw();
            return;
          }
          sfx("pop");
          setSave(r.save);
          note = "";
          draw();
        });
        take.disabled = inStash <= 0;
        const put = button("放回", "bvp-btn bvp-btn-sm", () => {
          sfx("tap");
          setSave(unpackItem(save, def.id));
          note = "";
          draw();
        });
        put.disabled = inBag <= 0;
        row.append(buy, take, put);
        list.appendChild(row);
      }
      card.appendChild(list);
      wrap.appendChild(card);
    }

    function drawTeam(): void {
      const card = el("div", "bvp-card");
      card.appendChild(el("div", "bvp-h", "🤝 对战小队（只在对战模式里出场）"));
      card.appendChild(
        el("div", "bvp-sub", `${HERO_NAME}固定站第一位，后面两位由你挑。耐打的站中间顶住，快的放最后收尾。`)
      );
      for (const idx of [0, 1] as const) {
        const sub = el("div");
        sub.style.marginTop = "8px";
        sub.appendChild(el("div", "bvp-mini", `第 ${idx + 2} 位`));
        const list = el("div", "bvp-list");
        for (const c of COMPANIONS) {
          const chosen = save.party[idx] === c.id;
          const row = el("div", "bvp-row");
          row.innerHTML = `<span class="bvp-face">${c.emoji}</span><span class="bvp-row-main">
            <span class="bvp-row-t">${c.name}　<span class="bvp-mini">${ELEMENT_EMOJI[c.element]}${
              ELEMENT_LABEL[c.element]
            }系${chosen ? " · 已上阵" : ""}</span></span>
            <span class="bvp-row-d">${c.desc}</span></span>`;
          row.appendChild(
            button(chosen ? "✔" : "选它", `bvp-btn bvp-btn-sm${chosen ? " bvp-btn-on" : ""}`, () => {
              sfx("pop");
              setSave(setPartyMember(save, idx, c.id));
              note = `${c.name}上阵啦。`;
              draw();
            })
          );
          list.appendChild(row);
        }
        sub.appendChild(list);
        card.appendChild(sub);
      }
      wrap.appendChild(card);
    }

    draw();

    return {
      destroy() {
        cleanup.destroy();
        wrap.remove();
      }
    };
  }

  /* ---------------- 渲染分发 ---------------- */

  function render(): void {
    if (outer.dead) return;
    dropCurrent();
    outer.killTimers();
    view.innerHTML = "";
    if (screen === "menu") renderMenu();
    else if (screen === "campaign") renderCampaign();
    else if (screen === "endless") renderEndless();
    else if (screen === "arena") renderArena();
    else renderPrep();
  }

  render();

  return {
    destroy() {
      outer.destroy();
      dropCurrent();
      root.remove();
    }
  };
}
