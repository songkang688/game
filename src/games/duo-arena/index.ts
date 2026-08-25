import { meta } from "./meta";
export { meta };

// 朵星擂台 —— 双人同屏抢分擂台赛：
// 上半场星星、下半场朵朵，两边目标完全相同（同一份时间表），
// 3 回合制 + 决胜回合，金币、炸弹、礼物道具（+3 / 冰冻对手 / 双倍星光）。
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
  score: number;
  next: number; // 时间表指针
  active: ActiveTarget[];
  frozenUntil: number;
  stunUntil: number;
  doubleUntil: number;
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
      <button class="da-rulesbtn" type="button">📖 怎么玩（点我看规则）</button>
      <button class="da-start" type="button">两人就位，开擂 ▶</button>
    </div>
    <div class="da-game da-hidden">
      <div class="da-zone da-zone-x">
        <div class="da-fx da-fx-x"></div>
      </div>
      <div class="da-mid">
        <span class="da-score da-score-x">${avatarHTML("xingxing")} <span class="pts">0</span> <span class="wins"></span></span>
        <span class="da-clock"><div class="t">25</div><div class="r">第 1 回合</div></span>
        <span class="da-score da-score-d">${avatarHTML("duoduo")} <span class="pts">0</span> <span class="wins"></span></span>
      </div>
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

  const px: ArenaPlayer = {
    name: "星星",
    emoji: "⭐",
    zone: wrap.querySelector(".da-zone-x") as HTMLElement,
    fx: wrap.querySelector(".da-fx-x") as HTMLElement,
    scoreEl: wrap.querySelector(".da-score-x .pts") as HTMLElement,
    score: 0,
    next: 0,
    active: [],
    frozenUntil: -1,
    stunUntil: -1,
    doubleUntil: -1,
  };
  const pd: ArenaPlayer = {
    name: "朵朵",
    emoji: "🌸",
    zone: wrap.querySelector(".da-zone-d") as HTMLElement,
    fx: wrap.querySelector(".da-fx-d") as HTMLElement,
    scoreEl: wrap.querySelector(".da-score-d .pts") as HTMLElement,
    score: 0,
    next: 0,
    active: [],
    frozenUntil: -1,
    stunUntil: -1,
    doubleUntil: -1,
  };
  const winsXEl = wrap.querySelector(".da-score-x .wins") as HTMLElement;
  const winsDEl = wrap.querySelector(".da-score-d .wins") as HTMLElement;

  function opponent(p: ArenaPlayer): ArenaPlayer {
    return p === px ? pd : px;
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
    const delta = tapScore(kind, doubled);
    p.score = applyTap(p.score, kind, doubled);
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
    updateScores();
    startRound(false);
  }

  function startRound(sudden: boolean): void {
    px.score = 0;
    pd.score = 0;
    px.next = 0;
    pd.next = 0;
    px.frozenUntil = px.stunUntil = px.doubleUntil = -1;
    pd.frozenUntil = pd.stunUntil = pd.doubleUntil = -1;
    clearTargets(px);
    clearTargets(pd);
    roundDuration = sudden ? SUDDEN_SECONDS : ROUND_SECONDS;
    const intensity = sudden ? 3 : Math.min(3, roundIdx + 1);
    schedule = buildRoundSchedule(matchSeed + roundIdx * 1000, intensity, roundDuration);
    roundTime = -2.2; // 负数时段用来倒数
    playing = true;
    updateScores();
    clockREl.textContent = sudden ? "⚡ 决胜回合" : `第 ${roundIdx + 1} 回合`;
    msgEl.textContent = sudden ? "决胜回合！谁先领先谁称王！" : "准备——各点各的半场！";
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
    const roundText = r === -1
      ? `平局！${pd.score} : ${px.score}`
      : r === 0
        ? `🌸 朵朵拿下这回合！${pd.score} : ${px.score}`
        : `⭐ 星星拿下这回合！${px.score} : ${pd.score}`;
    api.play(r === -1 ? "pop" : "win");
    if (st.done) {
      const winner = st.winner === 0 ? pd : px;
      const finalText = `${winner.emoji} ${winner.name}赢得擂台赛！`;
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
          // 过期目标消失
          const alive: ActiveTarget[] = [];
          for (const t of p.active) {
            if (roundTime > t.ev.t + t.ev.ttl) t.el.remove();
            else alive.push(t);
          }
          p.active = alive;
        }
        if (roundTime >= roundDuration) endRound();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  (wrap.querySelector(".da-start") as HTMLButtonElement).addEventListener("click", () => {
    api.play("jump");
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
      wrap.remove();
    },
  };
}
