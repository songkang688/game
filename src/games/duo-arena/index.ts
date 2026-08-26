import { meta } from "./meta";
export { meta };

// 朵星擂台 —— 双人同屏抢分擂台赛：
// 上半场星星、下半场朵朵，两边目标完全相同（同一份时间表），
// 3 回合制 + 决胜回合，金币、炸弹、礼物道具（+3 / 冰冻对手 / 双倍星光）。
import { save } from "../../engine/save";
import {
  ARENA_AI_HINTS,
  ARENA_AI_LABELS,
  ARENA_AI_LEVELS,
  SKILLS,
  SKILL_KINDS,
  STAGES,
  type AiTapPlan,
  type ArenaAiLevel,
  type SkillKind,
  type SkillState,
  type StageSpec,
  applyStage,
  arenaHandicap,
  arenaHandicapBadge,
  createArenaAi,
  createDefense,
  createSkill,
  defenseAiLevel,
  defenseNext,
  defenseStage,
  matchPointLine,
  planArenaTaps,
  pressSkill,
  shieldAbsorb,
  sparkleActive,
  tickSkill,
} from "./arena12";
import {
  BOMB_STUN_SECONDS,
  DOUBLE_SECONDS,
  FREEZE_SECONDS,
  ROUND_SECONDS,
  SUDDEN_SECONDS,
  type SpawnEvent,
  applyTap,
  buildRoundSchedule,
  matchState,
  roundWinner,
  tapScore,
} from "./logic";

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/* ---- 头像：PNG 到位后自动使用，暂时用可爱占位 ---- */
const AVATAR_URLS = import.meta.glob("../../assets/avatars/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function avatarHTML(who: "duoduo" | "xingxing", size = 26): string {
  const url = AVATAR_URLS[`../../assets/avatars/${who === "duoduo" ? "duoduo-q.png" : "xingxing-q.png"}`];
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : "⭐";
  const bg = who === "duoduo" ? "#FFD9E8" : "#D9E6FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(size * 0.58)}px;vertical-align:middle">${emoji}</span>`;
}

interface ActiveTarget {
  el: HTMLButtonElement;
  ev: SpawnEvent;
}

interface ArenaPlayer {
  name: string;
  emoji: string;
  zone: HTMLElement;
  fx: HTMLElement;
  scoreEl: HTMLElement;
  skillBar: HTMLElement;
  score: number;
  next: number; // 时间表指针
  active: ActiveTarget[];
  frozenUntil: number;
  stunUntil: number;
  doubleUntil: number;
  /** 1.2:三个技能各自的状态机 */
  skills: Record<SkillKind, SkillState>;
  /** 1.2:这一半场是电脑在打时的出手计划（按 at 升序），null 表示真人 */
  aiPlan: AiTapPlan[] | null;
  /** 计划执行到第几条 */
  aiCursor: number;
}

const RULES_HTML = `
  <h3>🎯 怎么赢</h3>
  <p>一共 <b>3 个回合</b>，每回合 ${ROUND_SECONDS} 秒。回合结束时<b>分数高的人拿下这回合</b>；<b>先拿下 2 个回合</b>就赢得整场比赛！如果 3 回合打完还不分胜负，就再打 ${SUDDEN_SECONDS} 秒的<b>决胜回合</b>，直到分出冠军。</p>
  <h3>🖐️ 怎么操作</h3>
  <p>屏幕分成上下两个半场：<b>上半场是星星的、下半场是朵朵的</b>，只能点自己半场里冒出来的目标！两边冒出来的东西<b>一模一样</b>，拼的就是眼快手快。</p>
  <h3>🎈 目标得分表</h3>
  <p>🌸 / ⭐ 自己的小标志：<b>+1 分</b><br>🪙 金币：<b>+2 分</b><br>💣 炸弹：<b>千万别点！扣 2 分</b>还会晕 ${BOMB_STUN_SECONDS} 秒（不点它就自己消失）<br>🎁 礼物盒：点开有惊喜——<b>+3 分</b>、<b>❄️ 冰冻对手 ${FREEZE_SECONDS} 秒</b>（他点不了）、或 <b>✨ 双倍星光 ${DOUBLE_SECONDS} 秒</b>（你的得分翻倍）</p>
  <h3>📌 小规则</h3>
  <p>分数最低是 0，不会点成负数。目标一会儿就消失，犹豫就没啦！输了的半场别灰心，下回合马上翻盘！</p>
`;

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  const timers = new Set<number>();

  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }
  function clearTimers(): void {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  }

  let playing = false;
  let roundIdx = 0; // 0 起
  let results: Array<0 | 1 | -1> = [];
  let schedule: SpawnEvent[] = [];
  let roundTime = 0;
  let roundDuration = ROUND_SECONDS;
  let matchSeed = 0;
  /** 1.2:赛制 —— 三局两胜 / 守擂无尽 */
  let arenaMode: "bo3" | "defense" = "bo3";
  /** 1.2:星星那半场交给电脑时的档位,null 表示两个真人 */
  let aiLevel: ArenaAiLevel | null = null;
  let stage: StageSpec = STAGES[0];
  let handicapOn = false;
  let defense = createDefense();
  let endlessBest = 0;

  const wrap = document.createElement("div");
  wrap.className = "da-wrap";
  wrap.innerHTML = `
    <style>
      .da-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4EFFF, #FFE9F2); border-radius: 20px; padding: 12px; max-width: 440px; margin: 0 auto; user-select: none; position: relative; }
      .da-panel { display: flex; flex-direction: column; gap: 14px; padding: 10px 6px; }
      .da-title { text-align: center; font-weight: 900; color: #B06AB3; font-size: 17px; }
      .da-start { border: none; border-radius: 18px; padding: 15px; font-size: 20px; font-weight: 800; background: #FFB37E; color: #7A3A10; cursor: pointer; box-shadow: 0 5px 0 #E08F55; width: 100%; font-family: inherit; }
      .da-start:active { transform: translateY(3px); box-shadow: 0 2px 0 #E08F55; }
      .da-rulesbtn { border: none; border-radius: 16px; padding: 12px; font-size: 16px; font-weight: 800; background: #D9F2C4; color: #4A7A2A; cursor: pointer; box-shadow: 0 4px 0 #ADD68E; width: 100%; font-family: inherit; }
      .da-rulesbtn:active { transform: translateY(2px); box-shadow: 0 2px 0 #ADD68E; }
      .da-zone { position: relative; height: 196px; border-radius: 16px; overflow: hidden; touch-action: manipulation; }
      .da-zone-x { background: linear-gradient(180deg, #DCEBFF, #C9DEFF); }
      .da-zone-d { background: linear-gradient(180deg, #FFE0EC, #FFD1E3); }
      .da-fx { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 52px; pointer-events: none; z-index: 3; opacity: 0; transition: opacity .2s; }
      .da-fx.on { opacity: 1; }
      .da-mid { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 7px 4px; }
      .da-score { display: flex; align-items: center; gap: 5px; background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 900; font-size: 15px; box-shadow: 0 2px 6px rgba(120,120,180,.2); }
      .da-score .wins { color: #E8A93C; font-size: 13px; letter-spacing: 1px; }
      .da-score-x { color: #3A6BB0; }
      .da-score-d { color: #C2497E; }
      .da-clock { text-align: center; font-weight: 900; color: #7A5AA8; }
      .da-clock .t { font-size: 21px; }
      .da-clock .r { font-size: 12px; }
      .da-target { position: absolute; width: 56px; height: 56px; border: none; border-radius: 50%; font-size: 30px; cursor: pointer; background: rgba(255,255,255,.92); box-shadow: 0 3px 8px rgba(80,80,140,.3); font-family: inherit; animation: daPop .22s ease; padding: 0; line-height: 1; touch-action: manipulation; z-index: 2; }
      .da-target:active { transform: scale(.9); }
      @keyframes daPop { from { transform: scale(.2); } to { transform: scale(1); } }
      .da-float { position: absolute; font-weight: 900; font-size: 17px; pointer-events: none; animation: daFloat .8s ease forwards; z-index: 4; }
      @keyframes daFloat { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-30px); } }
      .da-msg { text-align: center; min-height: 20px; color: #B06AB3; font-weight: 700; margin-top: 6px; font-size: 14px; }
      .da-btns { display: flex; gap: 8px; margin-top: 8px; }
      .da-btns button { flex: 1; border: none; border-radius: 14px; padding: 11px 4px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); font-family: inherit; }
      .da-help { background: #D9F2C4; color: #4A7A2A; }
      .da-back { background: #FFE0C2; color: #9A5A20; }
      .da-label { font-weight: 800; color: #7A5AA8; font-size: 14.5px; }
      .da-seg { display: flex; flex-wrap: wrap; gap: 6px; }
      .da-seg button { flex: 1 1 44%; min-height: 44px; border: none; border-radius: 14px; padding: 9px 6px; font-size: 14px; font-weight: 800; background: #FFF3E6; color: #9A5A20; cursor: pointer; font-family: inherit; line-height: 1.35; }
      .da-seg button.on { background: #FFB37E; color: #5B2A08; box-shadow: inset 0 0 0 2px #E08F55; }
      .da-hint { color: #7A5A4A; font-size: 14px; line-height: 1.5; margin: 0; min-height: 21px; }
      .da-handicap { display: flex; align-items: center; gap: 8px; color: #7A5A4A; font-size: 14px; line-height: 1.5; cursor: pointer; }
      .da-handicap input { width: 20px; height: 20px; accent-color: #FFB37E; flex: none; }
      .da-skills { display: flex; gap: 6px; padding: 5px 2px; }
      .da-skills button { flex: 1; min-height: 44px; border: none; border-radius: 13px; font-size: 13px; font-weight: 800; background: #EFE6FF; color: #6A4A9A; cursor: pointer; font-family: inherit; padding: 4px 2px; line-height: 1.3; }
      .da-skills button:disabled { opacity: .45; cursor: default; }
      .da-skills.da-ai button { visibility: hidden; }
      /* 赛点局的氛围:背景换成暖金色 + 顶上一行提示,不闪不抖 */
      .da-wrap.da-matchpoint { background: linear-gradient(180deg, #FFF1D6, #FFE3EE); }
      .da-wrap.da-matchpoint .da-clock { color: #C2701A; }
      .da-hidden { display: none; }
      .da-splash { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: rgba(255,250,244,.94); border-radius: 20px; z-index: 5; font-weight: 900; color: #B06AB3; font-size: 22px; text-align: center; padding: 12px; }
      .da-splash .sub { font-size: 15px; color: #8A7AA0; font-weight: 700; }
      .da-rules { position: absolute; inset: 0; background: #FFF7F0; border-radius: 20px; padding: 14px; overflow-y: auto; z-index: 6; }
      .da-rules h3 { color: #C2497E; margin: 12px 0 4px; font-size: 17px; }
      .da-rules p { color: #7A5A4A; font-size: 14.5px; line-height: 1.7; margin: 6px 0; }
      .da-rules-close { position: sticky; top: 0; float: right; border: none; border-radius: 14px; background: #FFB37E; color: #7A3A10; font-size: 15px; font-weight: 800; padding: 9px 16px; cursor: pointer; box-shadow: 0 3px 0 #E08F55; font-family: inherit; }
    </style>
    <div class="da-panel da-setup">
      <div class="da-title">🥊 上半场 ⭐星星 · 下半场 🌸朵朵<br>两边目标一模一样，拼手速！</div>
      <div class="da-label">🏁 选赛制</div>
      <div class="da-seg da-mode">
        <button type="button" data-v="bo3" class="on">🏆 三局两胜</button>
        <button type="button" data-v="defense">♾️ 守擂无尽 · 连赢几场</button>
      </div>
      <div class="da-label">🙋 选对手</div>
      <div class="da-seg da-rival">
        <button type="button" data-v="human" class="on">${avatarHTML("duoduo", 20)} 两个人一起玩</button>
        ${ARENA_AI_LEVELS.map((lv) => `<button type="button" data-v="${lv}">🤖 ${ARENA_AI_LABELS[lv]}</button>`).join("")}
      </div>
      <div class="da-label">🏟 选擂台</div>
      <div class="da-seg da-stage">
        ${STAGES.map((st, i) => `<button type="button" data-v="${st.id}"${i === 0 ? ' class="on"' : ""}>${st.emoji} ${st.label}</button>`).join("")}
      </div>
      <p class="da-hint"></p>
      <label class="da-handicap">
        <input type="checkbox" class="da-handicap-box">
        <span>🤝 让分：落后的人目标多留一点点（最多 8%）</span>
      </label>
      <button class="da-rulesbtn" type="button">📖 怎么玩（点我看规则）</button>
      <button class="da-start" type="button">就位，开擂 ▶</button>
    </div>
    <div class="da-game da-hidden">
      <div class="da-zone da-zone-x">
        <div class="da-fx da-fx-x"></div>
      </div>
      <div class="da-skills da-skills-x"></div>
      <div class="da-mid">
        <span class="da-score da-score-x">${avatarHTML("xingxing")} <span class="pts">0</span> <span class="wins"></span></span>
        <span class="da-clock"><div class="t">25</div><div class="r">第 1 回合</div></span>
        <span class="da-score da-score-d">${avatarHTML("duoduo")} <span class="pts">0</span> <span class="wins"></span></span>
      </div>
      <div class="da-skills da-skills-d"></div>
      <div class="da-zone da-zone-d">
        <div class="da-fx da-fx-d"></div>
      </div>
      <div class="da-btns">
        <button class="da-help" type="button">📖 规则</button>
        <button class="da-back" type="button">🔧 退出擂台</button>
      </div>
      <div class="da-msg"></div>
      <div class="da-splash da-hidden"></div>
    </div>
    <div class="da-rules da-hidden">
      <button class="da-rules-close" type="button">✖ 关闭</button>
      <h3 style="margin-top:2px">📖 朵星擂台 · 规则</h3>
      ${RULES_HTML}
    </div>
  `;
  api.root.appendChild(wrap);

  const setupEl = wrap.querySelector(".da-setup") as HTMLElement;
  const gameEl = wrap.querySelector(".da-game") as HTMLElement;
  const rulesEl = wrap.querySelector(".da-rules") as HTMLElement;
  const splashEl = wrap.querySelector(".da-splash") as HTMLElement;
  const msgEl = wrap.querySelector(".da-msg") as HTMLElement;
  const clockTEl = wrap.querySelector(".da-clock .t") as HTMLElement;
  const clockREl = wrap.querySelector(".da-clock .r") as HTMLElement;

  function freshSkills(): Record<SkillKind, SkillState> {
    return {
      shieldBubble: createSkill("shieldBubble"),
      pushWave: createSkill("pushWave"),
      sparkle: createSkill("sparkle"),
    };
  }

  const px: ArenaPlayer = {
    name: "星星",
    emoji: "⭐",
    zone: wrap.querySelector(".da-zone-x") as HTMLElement,
    fx: wrap.querySelector(".da-fx-x") as HTMLElement,
    scoreEl: wrap.querySelector(".da-score-x .pts") as HTMLElement,
    skillBar: wrap.querySelector(".da-skills-x") as HTMLElement,
    score: 0,
    next: 0,
    active: [],
    frozenUntil: -1,
    stunUntil: -1,
    doubleUntil: -1,
    skills: freshSkills(),
    aiPlan: null,
    aiCursor: 0,
  };
  const pd: ArenaPlayer = {
    name: "朵朵",
    emoji: "🌸",
    zone: wrap.querySelector(".da-zone-d") as HTMLElement,
    fx: wrap.querySelector(".da-fx-d") as HTMLElement,
    scoreEl: wrap.querySelector(".da-score-d .pts") as HTMLElement,
    skillBar: wrap.querySelector(".da-skills-d") as HTMLElement,
    score: 0,
    next: 0,
    active: [],
    frozenUntil: -1,
    stunUntil: -1,
    doubleUntil: -1,
    skills: freshSkills(),
    aiPlan: null,
    aiCursor: 0,
  };
  const winsXEl = wrap.querySelector(".da-score-x .wins") as HTMLElement;
  const winsDEl = wrap.querySelector(".da-score-d .wins") as HTMLElement;

  function opponent(p: ArenaPlayer): ArenaPlayer {
    return p === px ? pd : px;
  }

  /* ---------------- 1.2:技能 ---------------- */

  function skillLabel(p: ArenaPlayer, kind: SkillKind): string {
    const st = p.skills[kind];
    const spec = SKILLS[kind];
    if (st.phase === "ready") return `${spec.emoji} ${spec.label}`;
    if (st.phase === "windup") return `${spec.emoji} 蓄力…`;
    if (st.phase === "active") return `${spec.emoji} 生效 ${Math.ceil(st.remain)}s`;
    return `${spec.emoji} ${Math.ceil(st.remain)}s`;
  }

  function buildSkillBar(p: ArenaPlayer): void {
    p.skillBar.textContent = "";
    for (const kind of SKILL_KINDS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.skill = kind;
      btn.title = SKILLS[kind].hint;
      btn.textContent = skillLabel(p, kind);
      btn.addEventListener("click", () => useSkill(p, kind));
      p.skillBar.appendChild(btn);
    }
  }

  function refreshSkillBar(p: ArenaPlayer): void {
    for (const btn of Array.from(p.skillBar.querySelectorAll("button"))) {
      const kind = btn.dataset.skill as SkillKind;
      btn.textContent = skillLabel(p, kind);
      btn.disabled = !playing || p.skills[kind].phase !== "ready";
    }
  }

  function useSkill(p: ArenaPlayer, kind: SkillKind): void {
    if (!playing || roundTime < 0) return;
    if (p.aiPlan) return; // 电脑那半场不给点
    const before = p.skills[kind];
    const after = pressSkill(before);
    if (after === before) return;
    p.skills[kind] = after;
    api.play("pop");
    refreshSkillBar(p);
  }

  /** 弹开波生效：把对手场上最值钱的一个目标轻轻弹走。 */
  function firePushWave(p: ArenaPlayer): void {
    const o = opponent(p);
    if (o.active.length === 0) return;
    const worth = (k: SpawnEvent["kind"]): number =>
      k === "gift" ? 3 : k === "coin" ? 2 : k === "bloom" ? 1 : -1;
    let best = o.active[0];
    for (const t of o.active) if (worth(t.ev.kind) > worth(best.ev.kind)) best = t;
    o.active = o.active.filter((t) => t !== best);
    best.el.remove();
    o.fx.textContent = "🌀";
    o.fx.classList.add("on");
    later(() => o.fx.classList.remove("on"), 400);
    api.play("meow");
  }

  function updateScores(): void {
    px.scoreEl.textContent = String(px.score);
    pd.scoreEl.textContent = String(pd.score);
    // results 里 0=朵朵胜(玩家1) 1=星星胜 —— 约定朵朵是玩家1
    let wd = 0;
    let wx = 0;
    for (const r of results) {
      if (r === 0) wd++;
      else if (r === 1) wx++;
    }
    winsDEl.textContent = "★".repeat(wd);
    winsXEl.textContent = "★".repeat(wx);
  }

  function clearTargets(p: ArenaPlayer): void {
    for (const t of p.active) t.el.remove();
    p.active = [];
  }

  function floatText(p: ArenaPlayer, x: number, y: number, text: string, color: string): void {
    const el = document.createElement("span");
    el.className = "da-float";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    p.zone.appendChild(el);
    later(() => el.remove(), 800);
  }

  function targetEmoji(p: ArenaPlayer, ev: SpawnEvent): string {
    if (ev.kind === "bloom") return p.emoji;
    if (ev.kind === "coin") return "🪙";
    if (ev.kind === "bomb") return "💣";
    return "🎁";
  }

  function spawnTarget(p: ArenaPlayer, ev: SpawnEvent): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "da-target";
    btn.textContent = targetEmoji(p, ev);
    const zw = p.zone.clientWidth || 380;
    const zh = p.zone.clientHeight || 196;
    const tx = 6 + ev.x * (zw - 68);
    const ty = 6 + ev.y * (zh - 68);
    btn.style.left = `${tx}px`;
    btn.style.top = `${ty}px`;
    const entry: ActiveTarget = { el: btn, ev };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onTap(p, entry, tx, ty);
    });
    p.zone.appendChild(btn);
    p.active.push(entry);
  }

  function onTap(p: ArenaPlayer, entry: ActiveTarget, tx: number, ty: number): void {
    if (!playing) return;
    if (roundTime < 0) return;
    if (p.active.indexOf(entry) < 0) return;
    if (roundTime < p.frozenUntil || roundTime < p.stunUntil) {
      api.play("oops");
      return;
    }
    // 命中：从活动列表移除
    p.active = p.active.filter((t) => t !== entry);
    entry.el.remove();
    const doubled = roundTime < p.doubleUntil;
    const kind = entry.ev.kind;
    if (kind === "bomb") {
      // 1.2:护盾泡先挡一次,挡下来只是啵一声,不扣点数也不晕
      const guard = shieldAbsorb(p.skills.shieldBubble);
      if (guard.blocked) {
        p.skills.shieldBubble = guard.state;
        floatText(p, tx, ty, "🫧 挡下啦", "#4A90D9");
        api.play("pop");
        refreshSkillBar(p);
        return;
      }
    }
    const delta = tapScore(kind, doubled);
    p.score = applyTap(p.score, kind, doubled);
    // 1.2:星光冲刺让每个好东西多算 1 点
    if (sparkleActive(p.skills.sparkle) && (kind === "bloom" || kind === "coin")) {
      p.score += 1;
    }
    if (kind === "bomb") {
      p.stunUntil = roundTime + BOMB_STUN_SECONDS;
      p.fx.textContent = "💫";
      p.fx.classList.add("on");
      later(() => p.fx.classList.remove("on"), BOMB_STUN_SECONDS * 1000);
      floatText(p, tx, ty, "-2 晕了！", "#D9534F");
      api.play("oops");
    } else if (kind === "gift") {
      const effect = entry.ev.effect ?? "plus3";
      if (effect === "plus3") {
        p.score += 3;
        floatText(p, tx, ty, "🎉 +3", "#E8A93C");
        api.play("coin");
      } else if (effect === "freeze") {
        const o = opponent(p);
        o.frozenUntil = roundTime + FREEZE_SECONDS;
        o.fx.textContent = "❄️";
        o.fx.classList.add("on");
        later(() => o.fx.classList.remove("on"), FREEZE_SECONDS * 1000);
        floatText(p, tx, ty, "❄️ 冰住对手！", "#4A90D9");
        api.play("meow");
      } else {
        p.doubleUntil = roundTime + DOUBLE_SECONDS;
        floatText(p, tx, ty, "✨ 双倍星光！", "#B06AB3");
        api.play("jump");
      }
    } else {
      floatText(p, tx, ty, `+${delta}`, kind === "coin" ? "#E8A93C" : "#58B368");
      api.play(kind === "coin" ? "coin" : "pop");
    }
    updateScores();
  }

  /* ---------------- 回合流程 ---------------- */

  function startMatch(): void {
    matchSeed = (Math.random() * 0xffffffff) >>> 0;
    results = [];
    roundIdx = 0;
    setupEl.classList.add("da-hidden");
    gameEl.classList.remove("da-hidden");
    px.skillBar.classList.toggle("da-ai", aiLevel !== null);
    buildSkillBar(px);
    buildSkillBar(pd);
    updateScores();
    startRound(false);
  }

  /** 守擂无尽：一场打完接着打下一场，对手越来越强、擂台轮换。 */
  function startDefenseMatch(): void {
    aiLevel = defenseAiLevel(defense.round);
    stage = defenseStage(defense.round);
    startMatch();
  }

  /** 这一场的实际对手档位（守擂时由场次决定）。 */
  function currentAiLevel(): ArenaAiLevel | null {
    return aiLevel;
  }

  function startRound(sudden: boolean): void {
    px.score = 0;
    pd.score = 0;
    px.next = 0;
    pd.next = 0;
    px.frozenUntil = px.stunUntil = px.doubleUntil = -1;
    pd.frozenUntil = pd.stunUntil = pd.doubleUntil = -1;
    px.skills = freshSkills();
    pd.skills = freshSkills();
    px.aiCursor = 0;
    pd.aiCursor = 0;
    clearTargets(px);
    clearTargets(pd);
    roundDuration = sudden ? SUDDEN_SECONDS : ROUND_SECONDS;
    const intensity = sudden ? 3 : Math.min(3, roundIdx + 1);
    // 1.2:同一份时间表先按擂台改写,两边仍然完全相同 —— 公平性不变
    schedule = applyStage(
      buildRoundSchedule(matchSeed + roundIdx * 1000, intensity, roundDuration),
      stage,
    );
    const lv = currentAiLevel();
    px.aiPlan =
      lv === null
        ? null
        : planArenaTaps(createArenaAi(lv, matchSeed + roundIdx * 7919), schedule);
    roundTime = -2.2; // 负数时段用来倒数
    playing = true;
    updateScores();
    refreshSkillBar(px);
    refreshSkillBar(pd);
    const wd = results.filter((r) => r === 0).length;
    const wx = results.filter((r) => r === 1).length;
    const point = sudden ? null : matchPointLine(wd, wx, ["朵朵", "星星"]);
    wrap.classList.toggle("da-matchpoint", point !== null);
    clockREl.textContent = sudden ? "⚡ 决胜回合" : `第 ${roundIdx + 1} 回合`;
    const badge = arenaHandicapBadge(handicapOn);
    const base = sudden
      ? "决胜回合！谁先领先谁称王！"
      : (point ?? `${stage.emoji} ${stage.label}：${stage.hint}`);
    msgEl.textContent = badge ? `${badge}｜${base}` : base;
    splashEl.classList.add("da-hidden");
    api.play("tap");
  }

  function endRound(): void {
    playing = false;
    clearTargets(px);
    clearTargets(pd);
    // 朵朵是玩家 1（返回 0 表示朵朵胜）
    const r = roundWinner(pd.score, px.score);
    results.push(r);
    updateScores();
    const st = matchState(results);
    wrap.classList.remove("da-matchpoint");
    const roundText = r === -1
      ? `平局！${pd.score} : ${px.score}`
      : r === 0
        ? `🌸 朵朵拿下这回合！${pd.score} : ${px.score}`
        : `⭐ 星星拿下这回合！${px.score} : ${pd.score}`;
    api.play(r === -1 ? "pop" : "win");
    if (st.done) {
      const winner = st.winner === 0 ? pd : px;
      const finalText = `${winner.emoji} ${winner.name}赢得擂台赛！`;
      if (arenaMode === "defense") {
        // 守擂：朵朵赢了就接着打下一场，输了整条连胜结束
        const won = st.winner === 0;
        defense = defenseNext(defense, won);
        if (won) {
          endlessBest = save.recordEndlessBest(meta.id, defense.streak);
          splashEl.innerHTML =
            `<div>🏆 守擂成功！第 ${defense.streak} 场</div>` +
            `<div class="sub">下一位挑战者：${ARENA_AI_LABELS[defenseAiLevel(defense.round)]} · ${defenseStage(defense.round).label}<br>最高连胜 ${endlessBest} 场</div>`;
          splashEl.classList.remove("da-hidden");
          later(() => startDefenseMatch(), 2200);
          return;
        }
        endlessBest = save.recordEndlessBest(meta.id, defense.streak);
        splashEl.innerHTML =
          `<div>${roundText}</div><div class="sub">这次守住了 ${defense.streak} 场，最高连胜 ${endlessBest} 场</div>`;
        splashEl.classList.remove("da-hidden");
        later(() => {
          api.onLose(`守住了 ${defense.streak} 场，已经很厉害啦！歇一口气再来守一次。`);
        }, 1600);
        return;
      }
      splashEl.innerHTML = `<div>${roundText}</div><div>🏆 ${finalText}</div>`;
      splashEl.classList.remove("da-hidden");
      later(() => {
        api.onWin(1, `${finalText}回合比分 ${results.filter((x) => x === (st.winner === 0 ? 0 : 1)).length} 胜，再来一场！`);
      }, 1600);
      return;
    }
    const nextSudden = st.sudden;
    splashEl.innerHTML = `<div>${roundText}</div><div class="sub">${nextSudden ? "不分胜负，进入决胜回合！" : "下一回合马上开始…"}</div>`;
    splashEl.classList.remove("da-hidden");
    roundIdx++;
    later(() => startRound(nextSudden), 2200);
  }

  /* ---------------- 主循环 ---------------- */

  let lastFrame = 0;
  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    if (playing) {
      roundTime += dt;
      if (roundTime < 0) {
        clockTEl.textContent = String(Math.ceil(-roundTime));
      } else {
        const remain = Math.max(0, roundDuration - roundTime);
        clockTEl.textContent = String(Math.ceil(remain));
        for (const p of [px, pd]) {
          // 出现新目标
          while (p.next < schedule.length && schedule[p.next].t <= roundTime) {
            spawnTarget(p, schedule[p.next]);
            p.next++;
          }
          // 1.2 让分：落后一方的目标多留一点点（封顶 8%）
          const ttlMult = arenaHandicap(handicapOn, p.score, opponent(p).score);
          // 过期目标消失
          const alive: ActiveTarget[] = [];
          for (const t of p.active) {
            if (roundTime > t.ev.t + t.ev.ttl * ttlMult) t.el.remove();
            else alive.push(t);
          }
          p.active = alive;
          // 1.2 技能状态机
          let skillChanged = false;
          for (const kind of SKILL_KINDS) {
            const before = p.skills[kind];
            const after = tickSkill(before, dt);
            if (after.phase !== before.phase || after.charges !== before.charges) {
              skillChanged = true;
              if (kind === "pushWave" && before.phase === "windup" && after.phase !== "windup") {
                firePushWave(p);
              }
            }
            p.skills[kind] = after;
          }
          if (skillChanged) refreshSkillBar(p);
          // 1.2 电脑那半场：按计划出手
          if (p.aiPlan) {
            while (p.aiCursor < p.aiPlan.length && p.aiPlan[p.aiCursor].at <= roundTime) {
              const plan = p.aiPlan[p.aiCursor];
              p.aiCursor++;
              const hit = p.active.find((t) => t.ev === schedule[plan.index]);
              if (!hit) continue;
              if (roundTime < p.frozenUntil || roundTime < p.stunUntil) continue;
              const left = Number.parseFloat(hit.el.style.left) || 0;
              const top = Number.parseFloat(hit.el.style.top) || 0;
              onTap(p, hit, left, top);
            }
          }
        }
        if (roundTime >= roundDuration) endRound();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  const hintEl = wrap.querySelector(".da-hint") as HTMLElement;
  const handicapBox = wrap.querySelector(".da-handicap-box") as HTMLInputElement;

  function refreshSetupHint(): void {
    if (arenaMode === "defense") {
      hintEl.textContent = "守擂：一场接一场，对手越来越强、擂台轮着换。输一场就结束，看能守住几场。";
      return;
    }
    hintEl.textContent =
      aiLevel === null
        ? "两个人一起玩：上半场星星、下半场朵朵，两边目标一模一样。"
        : `🤖 ${ARENA_AI_LABELS[aiLevel]}：${ARENA_AI_HINTS[aiLevel]}`;
  }

  function bindSeg(sel: string, onPick: (v: string) => void): void {
    (wrap.querySelector(sel) as HTMLElement).addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn || btn.disabled) return;
      for (const b of Array.from(wrap.querySelectorAll(`${sel} button`))) b.classList.remove("on");
      btn.classList.add("on");
      api.play("tap");
      onPick(btn.dataset.v ?? "");
    });
  }

  bindSeg(".da-mode", (v) => {
    arenaMode = v === "defense" ? "defense" : "bo3";
    const rivalBox = wrap.querySelector(".da-rival") as HTMLElement;
    const stageBox = wrap.querySelector(".da-stage") as HTMLElement;
    const locked = arenaMode === "defense";
    rivalBox.style.opacity = locked ? "0.45" : "1";
    stageBox.style.opacity = locked ? "0.45" : "1";
    for (const b of Array.from(wrap.querySelectorAll<HTMLButtonElement>(".da-rival button, .da-stage button"))) {
      b.disabled = locked;
    }
    refreshSetupHint();
  });
  bindSeg(".da-rival", (v) => {
    aiLevel = v === "human" ? null : (Number(v) as ArenaAiLevel);
    refreshSetupHint();
  });
  bindSeg(".da-stage", (v) => {
    stage = STAGES.find((st) => st.id === v) ?? STAGES[0];
    refreshSetupHint();
  });
  const onHandicap = (): void => {
    handicapOn = handicapBox.checked;
    api.play("tap");
  };
  handicapBox.addEventListener("change", onHandicap);
  refreshSetupHint();

  (wrap.querySelector(".da-start") as HTMLButtonElement).addEventListener("click", () => {
    api.play("jump");
    if (arenaMode === "defense") {
      defense = createDefense();
      startDefenseMatch();
      return;
    }
    startMatch();
  });
  (wrap.querySelector(".da-back") as HTMLButtonElement).addEventListener("click", () => {
    playing = false;
    clearTimers();
    clearTargets(px);
    clearTargets(pd);
    splashEl.classList.add("da-hidden");
    gameEl.classList.add("da-hidden");
    setupEl.classList.remove("da-hidden");
    api.play("tap");
  });
  (wrap.querySelector(".da-rulesbtn") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("da-hidden");
  });
  (wrap.querySelector(".da-help") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("da-hidden");
  });
  (wrap.querySelector(".da-rules-close") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("da-hidden");
  });

  raf = requestAnimationFrame((t) => {
    lastFrame = t;
    raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimers();
      handicapBox.removeEventListener("change", onHandicap);
      clearTargets(px);
      clearTargets(pd);
      wrap.remove();
    },
  };
}
