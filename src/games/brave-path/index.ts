export { meta } from "./meta";

// 勇者小路 —— 轻 RPG 闯关 + 装备成长。
// 三种玩法共用一套战斗界面：
//   · 闯关：188 关八章战役，每关一条小路，路上有小怪、宝箱、小摊、岔路，章末是 Boss；
//   · 无尽：无尽深渊，越往下越难，走不动了就「探险结束 · 回城休息」；
//   · 对战：我的三人小队和星星的队伍自动接力，改配装再来一场。
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
import { mountLevelGame, type GameApi } from "../level99";

/* ------------------------------------------------------------------ */
/* 样式                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.bp-root{--bp-ink:#4b3a6e;--bp-soft:#7b6aa0;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  max-width:640px;margin:0 auto;color:var(--bp-ink);user-select:none;-webkit-user-select:none;}
.bp-root *{box-sizing:border-box;}
.bp-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.bp-btn{border:none;border-radius:14px;padding:9px 15px;font-size:15px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#fff;color:#6b56a0;box-shadow:0 3px 0 rgba(120,95,170,.28);white-space:nowrap;}
.bp-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.28);}
.bp-btn[disabled]{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.bp-btn-go{background:linear-gradient(180deg,#c078d8,#a55cc0);color:#fff;box-shadow:0 4px 0 #8a479f;}
.bp-btn-go:active{box-shadow:0 1px 0 #8a479f;}
.bp-btn-on{outline:3px solid #ffb2d8;}
.bp-btn-sm{padding:6px 11px;font-size:13px;border-radius:11px;}
.bp-chip{background:#ffffffcc;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#6b56a0;}
.bp-card{background:linear-gradient(180deg,#fffdff,#f4f0ff);border-radius:18px;padding:14px;
  box-shadow:0 4px 14px rgba(140,120,190,.16);margin-bottom:12px;}
.bp-h{font-size:17px;font-weight:900;margin:0 0 8px;display:flex;align-items:center;gap:6px;}
.bp-sub{font-size:13px;font-weight:700;color:var(--bp-soft);line-height:1.65;}
.bp-modes{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:560px){.bp-modes{grid-template-columns:1fr 1fr;}}
.bp-mode{border:none;border-radius:18px;padding:15px;text-align:left;cursor:pointer;font-family:inherit;
  display:flex;gap:12px;align-items:flex-start;box-shadow:0 4px 12px rgba(140,120,190,.18);color:var(--bp-ink);}
.bp-mode:active{transform:translateY(2px);}
.bp-mode-em{font-size:34px;line-height:1;flex:0 0 auto;}
.bp-mode-t{font-size:17px;font-weight:900;display:block;margin-bottom:3px;}
.bp-mode-d{font-size:13px;font-weight:700;color:var(--bp-soft);line-height:1.55;display:block;}
.bp-hero-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;font-weight:800;color:var(--bp-soft);}
.bp-fighter{background:#fff;border-radius:16px;padding:11px 12px;box-shadow:0 3px 10px rgba(140,120,190,.16);margin-bottom:9px;}
.bp-fighter-top{display:flex;align-items:center;gap:9px;margin-bottom:7px;}
.bp-face{font-size:30px;line-height:1;}
.bp-name{font-size:15px;font-weight:900;flex:1;min-width:0;}
.bp-tag{font-size:11px;font-weight:800;border-radius:999px;padding:3px 8px;background:#f0ebff;color:#6b56a0;white-space:nowrap;}
.bp-tag-boss{background:#ffe0ec;color:#b4457c;}
.bp-tag-weak{background:#fff0d4;color:#a4700f;}
.bp-hpbar{height:13px;border-radius:999px;background:#eee6f8;overflow:hidden;position:relative;}
.bp-hpfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#7fd39a,#4fb87c);transition:width .28s ease;}
.bp-hpfill.bp-low{background:linear-gradient(90deg,#ffb877,#f18b4c);}
.bp-shbar{height:8px;border-radius:999px;background:#e7eefb;overflow:hidden;margin-top:4px;}
.bp-shfill{height:100%;border-radius:999px;background:linear-gradient(90deg,#8fc2ff,#5f9be8);transition:width .28s ease;}
.bp-nums{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--bp-soft);margin-top:4px;gap:6px;flex-wrap:wrap;}
.bp-warn{background:#fff2d8;border-radius:12px;padding:8px 10px;font-size:13px;font-weight:800;color:#9a6a12;margin:8px 0;}
.bp-log{background:#fbf8ff;border-radius:14px;padding:10px 12px;min-height:86px;max-height:150px;overflow-y:auto;
  font-size:13px;font-weight:700;color:#5b4b82;line-height:1.75;margin-bottom:10px;}
.bp-log p{margin:0 0 3px;}
.bp-log p:last-child{color:#3f2f66;}
.bp-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
@media(min-width:480px){.bp-acts{grid-template-columns:1fr 1fr 1fr;}}
.bp-act{border:none;border-radius:14px;padding:11px 8px;font-family:inherit;cursor:pointer;text-align:center;
  background:#fff;box-shadow:0 3px 0 rgba(120,95,170,.24);color:var(--bp-ink);}
.bp-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.24);}
.bp-act[disabled]{opacity:.42;cursor:default;transform:none;box-shadow:none;}
.bp-act-t{display:block;font-size:14px;font-weight:900;}
.bp-act-d{display:block;font-size:11px;font-weight:700;color:var(--bp-soft);margin-top:2px;}
.bp-path{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}
.bp-dot{width:26px;height:26px;border-radius:50%;background:#ece5fb;display:flex;align-items:center;
  justify-content:center;font-size:13px;color:#8d7bb5;font-weight:900;}
.bp-dot-done{background:#cfeedd;color:#3c7a58;}
.bp-dot-now{background:#ffd6ea;color:#a83a72;outline:3px solid #fff;}
.bp-opts{display:grid;grid-template-columns:1fr;gap:9px;}
@media(min-width:520px){.bp-opts.bp-opts-2{grid-template-columns:1fr 1fr;}}
.bp-opt{border:none;border-radius:16px;padding:13px;cursor:pointer;font-family:inherit;text-align:left;
  background:#fff;box-shadow:0 3px 10px rgba(140,120,190,.18);color:var(--bp-ink);display:flex;gap:10px;align-items:center;}
.bp-opt:active{transform:translateY(2px);}
.bp-opt-em{font-size:27px;line-height:1;}
.bp-opt-t{font-size:14px;font-weight:900;display:block;}
.bp-opt-d{font-size:12px;font-weight:700;color:var(--bp-soft);display:block;margin-top:2px;}
.bp-list{display:flex;flex-direction:column;gap:8px;}
.bp-row{display:flex;align-items:center;gap:9px;background:#fff;border-radius:13px;padding:9px 11px;
  box-shadow:0 2px 7px rgba(140,120,190,.13);}
.bp-row-main{flex:1;min-width:0;}
.bp-row-t{font-size:14px;font-weight:900;}
.bp-row-d{font-size:12px;font-weight:700;color:var(--bp-soft);line-height:1.5;}
.bp-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;}
.bp-tabs::-webkit-scrollbar{display:none;}
.bp-note{text-align:center;font-size:13px;font-weight:800;color:#a06a9a;margin:8px 0;min-height:18px;}
.bp-team{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.bp-vs{text-align:center;font-size:15px;font-weight:900;color:#a05c9c;margin:6px 0;}
.bp-mini{font-size:12px;font-weight:800;color:var(--bp-soft);}
.bp-btn:focus-visible,.bp-act:focus-visible,.bp-opt:focus-visible,.bp-mode:focus-visible{
  outline:3px solid #3c2a6b;outline-offset:2px;}
@media (prefers-reduced-motion:reduce){.bp-hpfill,.bp-shfill{transition:none;}}
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

function button(label: string, className = "bp-btn", onClick?: () => void): HTMLButtonElement {
  const b = el("button", className);
  b.type = "button";
  b.innerHTML = label;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function elementTag(f: { element: keyof typeof ELEMENT_LABEL }): string {
  return `${ELEMENT_EMOJI[f.element]}${ELEMENT_LABEL[f.element]}系`;
}

/** 定时器与事件监听的统一管理，destroy 时一次清干净 */
class Cleanup {
  private timers = new Set<number>();
  private offs: Array<() => void> = [];
  dead = false;

  after(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
  }

  own(off: () => void): void {
    this.offs.push(off);
  }

  killTimers(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }

  destroy(): void {
    this.dead = true;
    this.killTimers();
    while (this.offs.length) {
      try {
        this.offs.pop()?.();
      } catch (err) {
        console.warn("[一朵一星] 勇者小路清理时出错:", err);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 角色卡片（血条 / 护盾 / 读条警告）                                    */
/* ------------------------------------------------------------------ */

interface FighterCard {
  root: HTMLElement;
  update: (f: Fighter, note?: string) => void;
}

function fighterCard(f: Fighter, showStats: boolean): FighterCard {
  const root = el("div", "bp-fighter");
  const top = el("div", "bp-fighter-top");
  const face = el("div", "bp-face", f.emoji);
  const name = el("div", "bp-name");
  const tags = el("div");
  tags.style.display = "flex";
  tags.style.gap = "4px";
  tags.style.flexWrap = "wrap";
  top.append(face, name, tags);

  const hpbar = el("div", "bp-hpbar");
  const hpfill = el("div", "bp-hpfill");
  hpbar.appendChild(hpfill);
  const shbar = el("div", "bp-shbar");
  const shfill = el("div", "bp-shfill");
  shbar.appendChild(shfill);
  const nums = el("div", "bp-nums");
  const warn = el("div", "bp-warn");
  warn.hidden = true;

  root.append(top, hpbar, shbar, nums, warn);

  const update = (cur: Fighter, note?: string): void => {
    face.textContent = cur.emoji;
    name.textContent = cur.name;
    tags.innerHTML = "";
    const tEl = el("span", "bp-tag", elementTag(cur));
    tags.appendChild(tEl);
    if (cur.isBoss) tags.appendChild(el("span", "bp-tag bp-tag-boss", "首领"));
    if (cur.weakness) {
      tags.appendChild(
        el("span", "bp-tag bp-tag-weak", `弱点 ${ELEMENT_EMOJI[cur.weakness]}${ELEMENT_LABEL[cur.weakness]}`)
      );
    }
    const ratio = hpRatio(cur);
    hpfill.style.width = `${Math.round(ratio * 100)}%`;
    hpfill.classList.toggle("bp-low", ratio <= 0.35);
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

  const head = el("div", "bp-bar");
  const title = el("span", "bp-chip", opts.title);
  head.appendChild(title);
  const roundChip = el("span", "bp-chip");
  head.appendChild(roundChip);
  if (opts.onFlee) {
    head.appendChild(
      button(opts.fleeLabel ?? "🏠 先回城", "bp-btn bp-btn-sm", () => {
        if (busy) return;
        opts.sfx("tap");
        opts.onFlee?.();
      })
    );
  }

  const foeCard = fighterCard(state.foe, false);
  const logBox = el("div", "bp-log");
  logBox.setAttribute("role", "log");
  logBox.setAttribute("aria-live", "polite");
  const heroCard = fighterCard(state.hero, true);
  const hint = el("div", "bp-note");
  const acts = el("div", "bp-acts");

  wrap.append(head, foeCard.root, logBox, heroCard.root, hint, acts);

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
      const b = el("button", "bp-act");
      b.type = "button";
      b.innerHTML = `<span class="bp-act-t">${t}</span><span class="bp-act-d">${d}</span>`;
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
    add("🛡️ 防御", "这回合伤害减半", { kind: "guard" });
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

  let hero: Fighter = buildHero(deps.getSave());
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
    const row = el("div", "bp-path");
    plan.steps.forEach((_, i) => {
      const dot = el("div", `bp-dot${i < step ? " bp-dot-done" : i === step ? " bp-dot-now" : ""}`);
      dot.textContent = i < step ? "✓" : String(i + 1);
      row.appendChild(dot);
    });
    row.appendChild(el("div", "bp-dot", "🏁"));
    return row;
  }

  function heroStrip(): HTMLElement {
    const row = el("div", "bp-hero-line");
    row.innerHTML = `<span class="bp-chip">${hero.emoji} 星芒 ${Math.max(0, Math.round(hero.hp))}/${hero.maxHp}</span>
      <span class="bp-chip">${elementTag(hero)}</span>
      <span class="bp-chip">🪙 ${deps.getSave().coins}</span>`;
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

    const head = el("div", "bp-card");
    head.appendChild(el("div", "bp-h", `${CHAPTERS[plan.chapterIndex].emoji} 第 ${plan.level + 1} 关 · 第 ${step + 1} 步`));
    head.appendChild(pathDots());
    head.appendChild(heroStrip());
    wrap.appendChild(head);

    const options = plan.steps[step];
    const note = el("div", "bp-note");
    note.textContent = options.length > 1 ? "前面分岔了，挑一条走吧——选哪条都能往前。" : plan.goalText;
    wrap.appendChild(note);

    const box = el("div", `bp-opts${options.length > 1 ? " bp-opts-2" : ""}`);
    options.forEach((node) => {
      const b = el("button", "bp-opt");
      b.type = "button";
      b.innerHTML = `<span class="bp-opt-em">${node.emoji}</span><span class="bp-row-main">
        <span class="bp-opt-t">${node.label}</span><span class="bp-opt-d">${nodeDesc(node)}</span></span>`;
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
    const card = el("div", "bp-card");
    card.appendChild(el("div", "bp-h", "🏪 糯糯的小摊"));
    card.appendChild(
      el("div", "bp-sub", `买来的东西会先放进仓库，再从仓库塞进背包（背包只有 ${BAG_SLOTS} 格，要挑着带）。`)
    );
    const info = el("div", "bp-note");
    const list = el("div", "bp-list");

    const draw = (): void => {
      const save = deps.getSave();
      info.textContent = `🪙 ${save.coins} 枚金币 · 背包 ${bagUsedSlots(save)}/${BAG_SLOTS} 格`;
      list.innerHTML = "";
      for (const id of node.stock ?? []) {
        const def = ITEMS[id];
        if (!def) continue;
        const row = el("div", "bp-row");
        row.innerHTML = `<span class="bp-face">${def.emoji}</span>
          <span class="bp-row-main"><span class="bp-row-t">${def.name} · ${def.price} 金币</span>
          <span class="bp-row-d">${def.desc}　仓库里有 ${stashCount(save, id)} 个</span></span>`;
        const buy = button("买一个", "bp-btn bp-btn-sm bp-btn-go", () => {
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
        const carry = button("装进背包", "bp-btn bp-btn-sm", () => {
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
    const go = button("继续往前走 ▶", "bp-btn bp-btn-go", () => {
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
  const root = el("div", "bp-root");
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
    const bar = el("div", "bp-bar");
    bar.appendChild(
      button("◀ 换个玩法", "bp-btn bp-btn-sm", () => {
        sfx("tap");
        go("menu");
      })
    );
    bar.appendChild(el("span", "bp-chip", label));
    bar.appendChild(el("span", "bp-chip", `Lv.${save.level}`));
    bar.appendChild(el("span", "bp-chip", `🪙 ${save.coins}`));
    bar.appendChild(
      button("🎒 备战", "bp-btn bp-btn-sm", () => {
        sfx("tap");
        go("prep");
      })
    );
    return bar;
  }

  /* ---------------- 首页：选玩法 ---------------- */

  function renderMenu(): void {
    const s = heroStats(save);
    const card = el("div", "bp-card");
    card.appendChild(el("div", "bp-h", "🗡️ 勇者小路"));
    card.appendChild(
      el(
        "div",
        "bp-sub",
        `${HERO_NAME}背上小包出发啦。路上有小怪、宝箱、小摊和岔路，打赢了就往前走一步。` +
          `每一招都有属性，火克草、草克水、水克火，光和暗互相克——挑对属性，一下顶两下。`
      )
    );
    const line = el("div", "bp-hero-line");
    line.style.marginTop = "10px";
    line.innerHTML = `<span class="bp-chip">Lv.${save.level}</span>
      <span class="bp-chip">${elementTag(s)}</span>
      <span class="bp-chip">星芒 ${s.maxHp}</span>
      <span class="bp-chip">攻 ${s.atk} · 防 ${s.def} · 速 ${s.spd}</span>
      <span class="bp-chip">战力 ${powerScore(s)}</span>
      <span class="bp-chip">🪙 ${save.coins}</span>`;
    card.appendChild(line);
    view.appendChild(card);

    if (flash) {
      const f = el("div", "bp-note", flash);
      view.appendChild(f);
      flash = "";
    }

    const modes = el("div", "bp-modes");
    const addMode = (emoji: string, title: string, desc: string, color: string, target: Screen): void => {
      const b = el("button", "bp-mode");
      b.type = "button";
      b.style.background = color;
      b.innerHTML = `<span class="bp-mode-em">${emoji}</span><span class="bp-row-main">
        <span class="bp-mode-t">${title}</span><span class="bp-mode-d">${desc}</span></span>`;
      b.addEventListener("click", () => {
        sfx("pop");
        go(target);
      });
      modes.appendChild(b);
    };
    addMode(
      "🗺️",
      "闯关 · 188 关",
      `八个主题章节，每章尽头有一位首领。现在在第 ${CHAPTERS[0].name} 那一带起步。`,
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
      "对战 · 星星的队伍",
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

    const tips = el("div", "bp-card");
    tips.appendChild(el("div", "bp-h", "📌 三条要记住的"));
    tips.appendChild(
      el(
        "div",
        "bp-sub",
        "① 对手在蓄力大招时，按「防御」能把伤害挡掉一半；<br>" +
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
    const tip = el("div", "bp-note", text);
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
      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", "🕳️ 无尽深渊"));
      card.appendChild(
        el(
          "div",
          "bp-sub",
          "一层一层往下走，星芒不会自动回满，全靠背包里的东西和路上的祝福撑着。" +
            `每 3 层可以挑一个祝福，每 8 层有一位守门的大家伙。最好成绩：第 ${save.endlessBest} 层。`
        )
      );
      if (message) card.appendChild(el("div", "bp-note", message));
      const info = el("div", "bp-hero-line");
      const s = heroStats(save);
      info.innerHTML = `<span class="bp-chip">Lv.${save.level}</span>
        <span class="bp-chip">${elementTag(s)}</span>
        <span class="bp-chip">星芒 ${s.maxHp}</span>
        <span class="bp-chip">背包 ${bagUsedSlots(save)}/${BAG_SLOTS}</span>`;
      card.appendChild(info);
      const go = button("⬇️ 下到第 1 层", "bp-btn bp-btn-go", () => {
        sfx("jump");
        hero = buildHero(save);
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
      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", `✅ 第 ${depth} 层走完了`));
      card.appendChild(
        el("div", "bp-sub", `捡到 ${coins} 枚金币。现在星芒 ${Math.round(hero.hp)}/${hero.maxHp}。`)
      );
      wrap.appendChild(card);

      if (isBlessingFloor(depth)) {
        const pick = el("div", "bp-card");
        pick.appendChild(el("div", "bp-h", "✨ 挑一个祝福带走"));
        pick.appendChild(el("div", "bp-sub", "只能挑一个。想稳一点就挑防御和回复，想快点下潜就挑攻击。"));
        const box = el("div", "bp-opts bp-opts-2");
        for (const b of rollBlessings(depth)) {
          const btn = el("button", "bp-opt");
          btn.type = "button";
          btn.innerHTML = `<span class="bp-opt-em">${b.emoji}</span><span class="bp-row-main">
            <span class="bp-opt-t">${b.name}</span><span class="bp-opt-d">${b.desc}</span></span>`;
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

      const row = el("div", "bp-bar");
      row.appendChild(
        button(`⬇️ 继续下到第 ${depth + 1} 层`, "bp-btn bp-btn-go", () => {
          sfx("jump");
          nextFloor();
        })
      );
      row.appendChild(
        button("🏠 到此为止，回城", "bp-btn", () => {
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
      if (stars > 0) api.addStars(stars);
      sfx(depth > best ? "win" : "tap");

      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", "🏠 探险结束 · 回城休息"));
      card.appendChild(el("div", "bp-sub", reason ?? endlessEndText(depth, best)));
      card.appendChild(
        el(
          "div",
          "bp-sub",
          `这一趟：走到第 ${depth} 层，攒下 ${earned} 枚金币、${exp} 点经验` +
            `${stars > 0 ? `，还拿到 ${stars} 颗小星星` : ""}。`
        )
      );
      if (depth > best) card.appendChild(el("div", "bp-note", `🎉 新纪录！之前最深是第 ${best} 层。`));
      wrap.appendChild(card);

      const row = el("div", "bp-bar");
      row.appendChild(
        button("🔁 再下一趟", "bp-btn bp-btn-go", () => {
          sfx("tap");
          lobby();
        })
      );
      row.appendChild(
        button("🎒 去备战小屋", "bp-btn", () => {
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

  /* ---------------- 对战：星星的队伍 ---------------- */

  function renderArena(): void {
    view.appendChild(topBar("⚔️ 星星的队伍"));
    const host = el("div");
    view.appendChild(host);
    current = mountArena(host);
  }

  function teamCard(title: string, team: Fighter[], color: string): HTMLElement {
    const card = el("div", "bp-card");
    card.style.background = color;
    card.appendChild(el("div", "bp-h", title));
    for (const f of team) {
      const row = el("div", "bp-row");
      row.innerHTML = `<span class="bp-face">${f.emoji}</span><span class="bp-row-main">
        <span class="bp-row-t">${f.name}　<span class="bp-mini">${elementTag(f)}</span></span>
        <span class="bp-row-d">星芒 ${f.maxHp} · 攻 ${f.atk} · 防 ${f.def} · 速 ${f.spd}</span></span>`;
      card.appendChild(row);
    }
    return card;
  }

  function mountArena(host: HTMLElement): { destroy: () => void } {
    const cleanup = new Cleanup();
    const wrap = el("div");
    host.appendChild(wrap);

    function lobby(message?: string): void {
      cleanup.killTimers();
      wrap.innerHTML = "";
      const intro = el("div", "bp-card");
      intro.appendChild(el("div", "bp-h", "⚔️ 和星星的队伍比一场"));
      intro.appendChild(
        el(
          "div",
          "bp-sub",
          "三对三接力：队首先上，谁先歇下就换后面的人顶上，一整队都歇下的那边算输。" +
            "两边都由队员自己判断出招，你能做的是——出发前把装备、技能和同伴配好。"
        )
      );
      if (message) intro.appendChild(el("div", "bp-note", message));
      wrap.appendChild(intro);

      const mine = buildMyTeam(save);
      const theirs = buildRivalTeam(save.level, save.arenaWins, gearFactor(save));
      const grid = el("div", "bp-team");
      grid.appendChild(teamCard("🌸 我的队伍", mine, "linear-gradient(180deg,#fff4f9,#ffe6f1)"));
      grid.appendChild(teamCard("⭐ 星星的队伍", theirs, "linear-gradient(180deg,#f0f6ff,#e0ecff)"));
      wrap.appendChild(grid);

      const row = el("div", "bp-bar");
      row.appendChild(
        button("开打！", "bp-btn bp-btn-go", () => {
          sfx("jump");
          fight();
        })
      );
      row.appendChild(
        button("🎒 先去调配装", "bp-btn", () => {
          sfx("tap");
          go("prep");
        })
      );
      wrap.appendChild(row);
    }

    function fight(): void {
      cleanup.killTimers();
      wrap.innerHTML = "";
      const seed = (Date.now() ^ (save.arenaPlays * 7919)) >>> 0;
      const outcome = runArena(save, seed);

      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", "⚔️ 比赛进行中"));
      const log = el("div", "bp-log");
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

      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", outcome.win ? "🎉 我们赢啦！" : "🌱 这次差一点"));
      card.appendChild(el("div", "bp-sub", outcome.text));
      card.appendChild(
        el(
          "div",
          "bp-sub",
          `拿到 ${outcome.coins} 枚金币、${outcome.exp} 点经验` +
            `${outcome.stars > 0 ? `，还有 ${outcome.stars} 颗小星星` : ""}。` +
            `累计战绩：${save.arenaWins} 胜 / ${save.arenaPlays} 场。`
        )
      );
      wrap.appendChild(card);

      const row = el("div", "bp-bar");
      row.appendChild(
        button("🔁 再来一场", "bp-btn bp-btn-go", () => {
          sfx("tap");
          lobby();
        })
      );
      row.appendChild(
        button("🎒 换套配装再打", "bp-btn", () => {
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
      const head = el("div", "bp-card");
      head.appendChild(el("div", "bp-h", `${HERO_NAME}的备战小屋`));
      const line = el("div", "bp-hero-line");
      line.innerHTML = `<span class="bp-chip">Lv.${save.level}</span>
        <span class="bp-chip">${elementTag(s)}</span>
        <span class="bp-chip">星芒 ${s.maxHp}</span>
        <span class="bp-chip">攻 ${s.atk}</span>
        <span class="bp-chip">防 ${s.def}</span>
        <span class="bp-chip">速 ${s.spd}</span>
        <span class="bp-chip">暴击 ${Math.round(s.crit * 100)}%</span>
        <span class="bp-chip">战力 ${powerScore(s)}</span>`;
      head.appendChild(line);
      const line2 = el("div", "bp-hero-line");
      line2.style.marginTop = "6px";
      const need = expToNext(save.level);
      line2.innerHTML = `<span class="bp-chip">🪙 ${save.coins}</span>
        <span class="bp-chip">技能点 ${save.skillPoints}</span>
        <span class="bp-chip">${
          save.level >= MAX_HERO_LEVEL ? "已经练到顶啦" : `距下一级 ${Math.max(0, need - save.exp)} 经验`
        }</span>`;
      head.appendChild(line2);
      wrap.appendChild(head);

      const tabs = el("div", "bp-tabs");
      const addTab = (key: PrepTab, label: string): void => {
        const b = button(label, `bp-btn bp-btn-sm${tab === key ? " bp-btn-on" : ""}`, () => {
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

      if (note) wrap.appendChild(el("div", "bp-note", note));

      if (tab === "gear") drawGear();
      else if (tab === "skill") drawSkill();
      else if (tab === "bag") drawBag();
      else drawTeam();

      const back = button("◀ 回到玩法选择", "bp-btn", () => {
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
        const card = el("div", "bp-card");
        card.appendChild(el("div", "bp-h", SLOT_LABEL[slot]));
        if (slot === "badge") {
          card.appendChild(el("div", "bp-sub", "徽章决定你「普通攻击」的属性。技能有自己的属性，不受徽章影响。"));
        }
        const list = el("div", "bp-list");
        for (const g of gearsOfSlot(slot)) {
          const owned = save.owned.includes(g.id);
          const worn = save.gear[slot] === g.id;
          const row = el("div", "bp-row");
          row.innerHTML = `<span class="bp-face">${g.emoji}</span><span class="bp-row-main">
            <span class="bp-row-t">${g.name}${worn ? "　<span class=\"bp-mini\">装备中</span>" : ""}</span>
            <span class="bp-row-d">${g.desc}${owned ? "" : `　需要 ${g.reqLevel} 级 · ${g.price} 金币`}</span></span>`;
          if (worn) {
            const tag = el("span", "bp-tag", "✔");
            row.appendChild(tag);
          } else if (owned) {
            row.appendChild(
              button("换上", "bp-btn bp-btn-sm bp-btn-go", () => {
                sfx("pop");
                setSave(equipGear(save, g.id));
                note = `换上${g.name}啦。`;
                draw();
              })
            );
          } else {
            const buy = button(`买（${g.price}）`, "bp-btn bp-btn-sm", () => {
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
      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", `✨ 技能（最多带 ${LOADOUT_SLOTS} 个上场）`));
      card.appendChild(
        el(
          "div",
          "bp-sub",
          `技能点 ${save.skillPoints} 点，升级一次可以让威力再高一档。` +
            "破盾招专治护盾，穿透招无视护盾，治疗和激励留着关键时刻用。"
        )
      );
      const list = el("div", "bp-list");
      for (const u of SKILL_UNLOCKS) {
        const def = SKILLS[u.id];
        if (!def) continue;
        const rank = save.ranks[u.id] ?? 0;
        const on = save.loadout.includes(u.id);
        const cost = rank === 0 ? u.cost : rankUpCost(rank);
        const row = el("div", "bp-row");
        row.innerHTML = `<span class="bp-face">${def.emoji}</span><span class="bp-row-main">
          <span class="bp-row-t">${def.name}　<span class="bp-mini">${
            rank > 0 ? `${rank}/${MAX_SKILL_RANK} 级` : `${u.reqLevel} 级解锁`
          }${on ? " · 已上阵" : ""}</span></span>
          <span class="bp-row-d">${def.desc}${
            rank > 0 && rank < MAX_SKILL_RANK ? `　升级要 ${cost} 点` : rank === 0 ? `　学会要 ${u.cost} 点` : ""
          }</span></span>`;
        if (rank < MAX_SKILL_RANK) {
          const b = button(rank === 0 ? "学会" : "升级", "bp-btn bp-btn-sm bp-btn-go", () => {
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
            button(on ? "下阵" : "上阵", `bp-btn bp-btn-sm${on ? " bp-btn-on" : ""}`, () => {
              const next = toggleLoadout(save, u.id);
              if (next === save || next.loadout.length === save.loadout.length) {
                note = `上阵位置只有 ${LOADOUT_SLOTS} 个，先把一个换下来。`;
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
      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", `🎒 背包（${bagUsedSlots(save)}/${BAG_SLOTS} 格）`));
      card.appendChild(
        el("div", "bp-sub", `出门只能带 ${BAG_SLOTS} 样东西，剩下的留在仓库里。多带回复还是多带破盾，自己拿主意。`)
      );
      const list = el("div", "bp-list");
      for (const def of Object.values(ITEMS)) {
        const inBag = save.bag.find((x) => x.id === def.id)?.count ?? 0;
        const inStash = stashCount(save, def.id);
        const row = el("div", "bp-row");
        row.innerHTML = `<span class="bp-face">${def.emoji}</span><span class="bp-row-main">
          <span class="bp-row-t">${def.name}　<span class="bp-mini">背包 ${inBag} · 仓库 ${inStash}</span></span>
          <span class="bp-row-d">${def.desc}</span></span>`;
        const buy = button(`买（${def.price}）`, "bp-btn bp-btn-sm", () => {
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
        const take = button("装包", "bp-btn bp-btn-sm bp-btn-go", () => {
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
        const put = button("放回", "bp-btn bp-btn-sm", () => {
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
      const card = el("div", "bp-card");
      card.appendChild(el("div", "bp-h", "🤝 对战小队（只在对战模式里出场）"));
      card.appendChild(
        el("div", "bp-sub", `${HERO_NAME}固定站第一位，后面两位由你挑。耐打的站中间顶住，快的放最后收尾。`)
      );
      for (const idx of [0, 1] as const) {
        const sub = el("div");
        sub.style.marginTop = "8px";
        sub.appendChild(el("div", "bp-mini", `第 ${idx + 2} 位`));
        const list = el("div", "bp-list");
        for (const c of COMPANIONS) {
          const chosen = save.party[idx] === c.id;
          const row = el("div", "bp-row");
          row.innerHTML = `<span class="bp-face">${c.emoji}</span><span class="bp-row-main">
            <span class="bp-row-t">${c.name}　<span class="bp-mini">${ELEMENT_EMOJI[c.element]}${
              ELEMENT_LABEL[c.element]
            }系${chosen ? " · 已上阵" : ""}</span></span>
            <span class="bp-row-d">${c.desc}</span></span>`;
          row.appendChild(
            button(chosen ? "✔" : "选它", `bp-btn bp-btn-sm${chosen ? " bp-btn-on" : ""}`, () => {
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
