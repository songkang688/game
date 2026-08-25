// 朵星双人冲刺 —— 双人同屏竞技无尽跑：
// 上下两条赛道（同种子同赛道，绝对公平），三车道 + 金币 + 障碍 + 加速带 + 跳跃，
// 速度随距离上升。无尽对战比谁跑得远，金币赛先抢 30 枚金币。
import {
  BOOST_MULT,
  BOOST_SECONDS,
  COIN_RACE_TARGET,
  HIT_SAFE_SECONDS,
  JUMP_SECONDS,
  MAX_HEARTS,
  type Entity,
  type RaceMode,
  type TrackGen,
  createTrackGen,
  endlessWinner,
  isObstacle,
  speedAt,
  survives,
} from "./logic";

export const meta = {
  id: "duo-rush",
  title: "朵星双人冲刺",
  emoji: "🏃",
  category: "party" as const,
  color: "#CDE9FF",
  blurb: "朵朵星星同屏开跑！三条车道躲石头跳木栏，吃金币踩加速带，看谁跑得远！",
};

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

function avatarHTML(who: "duoduo" | "xingxing", size = 30): string {
  const url = AVATAR_URLS[`../../assets/avatars/${who === "duoduo" ? "duoduo-q.png" : "xingxing-q.png"}`];
  if (url) {
    return `<img src="${url}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle">`;
  }
  const emoji = who === "duoduo" ? "🌸" : "⭐";
  const bg = who === "duoduo" ? "#FFD9E8" : "#D9E6FF";
  return `<span style="display:inline-flex;width:${size}px;height:${size}px;border-radius:50%;background:${bg};align-items:center;justify-content:center;font-size:${Math.round(size * 0.58)}px;vertical-align:middle">${emoji}</span>`;
}

const CW = 396;
const CH = 148;
const LANE_Y = [34, 76, 118]; // 三车道中心
const RUNNER_X = 64;
const PX_PER_M = 4;

const ENTITY_EMOJI: Record<string, string> = {
  rock: "🪨",
  hurdle: "🚧",
  coin: "🪙",
  boost: "⚡",
};

interface PlayerState {
  name: string;
  emoji: string;
  gen: TrackGen;
  resolved: number; // 已处理到的实体下标
  dist: number;
  lane: number;
  laneFloat: number;
  jumpUntil: number;
  hearts: number;
  coins: number;
  safeUntil: number;
  boostUntil: number;
  stunUntil: number;
  crashed: boolean;
  bump: number; // 撞击晃动动画
}

const RULES_HTML = `
  <h3>🎯 怎么赢</h3>
  <p><b>♾️ 无尽对战</b>：两个人同时开跑，赛道一模一样。心用完就停下，<b>谁跑得远谁赢</b>（一样远就比金币）。<br><b>🪙 抢金币赛</b>：不掉心，<b>先吃到 ${COIN_RACE_TARGET} 枚金币</b>的人马上获胜！</p>
  <h3>🖐️ 怎么操作</h3>
  <p>每人有三个大按钮：<b>⬆ 上一道、⬇ 下一道、🦘 跳</b>。<br>⌨️ 用键盘也行——朵朵：<b>W / S</b> 换道，<b>D</b> 跳；星星：<b>↑ / ↓</b> 换道，<b>→</b> 跳。</p>
  <h3>💥 三种障碍</h3>
  <p>🪨 <b>大石头</b>：跳不过去！提前换到别的车道。<br>🚧 <b>小木栏</b>：按「跳」轻轻跃过去。<br>🕳️ <b>泥坑</b>：也要跳，不然会踩进去。</p>
  <h3>❤️ 生命与道具</h3>
  <p>无尽对战每人 <b>3 颗心</b>，撞一下掉一颗，掉心后有一小段无敌时间。抢金币赛撞了不掉心，但会<b>绊倒 1 秒</b>，很吃亏哦！<br>🪙 金币：吃一枚加 1。⚡ <b>加速带</b>：踩上去咻——冲刺 ${BOOST_SECONDS} 秒！</p>
  <h3>📈 小提醒</h3>
  <p>跑得越远速度越快（有上限，不会快到反应不过来）。输了别灰心，点「再来一局」马上再战！</p>
`;

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let endTimer = 0;
  let countTimer = 0;

  let mode: RaceMode = "endless";
  let racing = false;
  let finished = false;
  let simTime = 0;

  let p1: PlayerState | null = null;
  let p2: PlayerState | null = null;

  const wrap = document.createElement("div");
  wrap.className = "dr-wrap";
  wrap.innerHTML = `
    <style>
      .dr-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4F3FF, #FFEAF4); border-radius: 20px; padding: 12px; max-width: 440px; margin: 0 auto; user-select: none; position: relative; }
      .dr-panel { display: flex; flex-direction: column; gap: 14px; padding: 10px 6px; }
      .dr-label { font-weight: 800; color: #4A7AA8; font-size: 15px; margin-bottom: 6px; }
      .dr-seg { display: flex; gap: 8px; flex-wrap: wrap; }
      .dr-seg button { flex: 1; min-width: 120px; border: 3px solid #BFDDF2; background: #FDFEFF; border-radius: 16px; padding: 12px 8px; font-size: 15px; font-weight: 700; color: #4A7AA8; cursor: pointer; font-family: inherit; }
      .dr-seg button.on { border-color: #F2A0C0; background: #FFE4EF; color: #C2497E; }
      .dr-start { border: none; border-radius: 18px; padding: 15px; font-size: 20px; font-weight: 800; background: #8FD3FF; color: #14496E; cursor: pointer; box-shadow: 0 5px 0 #64AEE0; width: 100%; font-family: inherit; }
      .dr-start:active { transform: translateY(3px); box-shadow: 0 2px 0 #64AEE0; }
      .dr-rulesbtn { border: none; border-radius: 16px; padding: 12px; font-size: 16px; font-weight: 800; background: #D9F2C4; color: #4A7A2A; cursor: pointer; box-shadow: 0 4px 0 #ADD68E; width: 100%; font-family: inherit; }
      .dr-rulesbtn:active { transform: translateY(2px); box-shadow: 0 2px 0 #ADD68E; }
      .dr-hud { display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 13.5px; padding: 3px 2px; }
      .dr-hud .name { display: flex; align-items: center; gap: 4px; }
      .dr-hud .stat { background: #fff; border-radius: 12px; padding: 3px 8px; box-shadow: 0 2px 5px rgba(90,140,190,.2); }
      .dr-hud-1 { color: #C2497E; }
      .dr-hud-2 { color: #3A6BB0; }
      .dr-canvas { width: 100%; border-radius: 14px; display: block; touch-action: none; }
      .dr-ctrl { display: flex; gap: 8px; margin: 6px 0 2px; }
      .dr-ctrl button { flex: 1; border: none; border-radius: 14px; padding: 13px 4px; font-size: 18px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 0 rgba(0,0,0,.15); font-family: inherit; touch-action: manipulation; }
      .dr-ctrl .lane1 { background: #FFE0EC; color: #C2497E; }
      .dr-ctrl .jump1 { background: #FFB3CD; color: #86285A; flex: 1.4; }
      .dr-ctrl .lane2 { background: #DCE9FF; color: #3A6BB0; }
      .dr-ctrl .jump2 { background: #9DC6FF; color: #1D4E8F; flex: 1.4; }
      .dr-ctrl button:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,.15); }
      .dr-vs { text-align: center; font-weight: 900; color: #B06AB3; font-size: 14px; margin: 4px 0; letter-spacing: 2px; }
      .dr-msg { text-align: center; min-height: 20px; color: #B06AB3; font-weight: 700; margin-top: 6px; font-size: 14px; }
      .dr-btns { display: flex; gap: 8px; margin-top: 8px; }
      .dr-btns button { flex: 1; border: none; border-radius: 14px; padding: 11px 4px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.12); font-family: inherit; }
      .dr-again { background: #D9F2C4; color: #4A7A2A; }
      .dr-back { background: #FFE0C2; color: #9A5A20; }
      .dr-hidden { display: none; }
      .dr-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 84px; font-weight: 900; color: #FF7EA8; text-shadow: 0 4px 0 rgba(255,255,255,.8); z-index: 4; pointer-events: none; }
      .dr-rules { position: absolute; inset: 0; background: #F4FAFF; border-radius: 20px; padding: 14px; overflow-y: auto; z-index: 6; }
      .dr-rules h3 { color: #C2497E; margin: 12px 0 4px; font-size: 17px; }
      .dr-rules p { color: #4A6A8A; font-size: 14.5px; line-height: 1.7; margin: 6px 0; }
      .dr-rules-close { position: sticky; top: 0; float: right; border: none; border-radius: 14px; background: #8FD3FF; color: #14496E; font-size: 15px; font-weight: 800; padding: 9px 16px; cursor: pointer; box-shadow: 0 3px 0 #64AEE0; font-family: inherit; }
    </style>
    <div class="dr-panel dr-setup">
      <div>
        <div class="dr-label">🏁 选比赛方式</div>
        <div class="dr-seg dr-mode">
          <button type="button" data-v="endless" class="on">♾️ 无尽对战 · 比谁远</button>
          <button type="button" data-v="coins">🪙 抢金币赛 · 先到 ${COIN_RACE_TARGET}</button>
        </div>
      </div>
      <button class="dr-rulesbtn" type="button">📖 怎么玩（点我看规则）</button>
      <button class="dr-start" type="button">两人准备好，开跑 ▶</button>
    </div>
    <div class="dr-game dr-hidden">
      <div class="dr-hud dr-hud-1">
        <span class="name">${avatarHTML("duoduo", 26)} 朵朵</span>
        <span class="stat dr-d1">0 米</span>
        <span class="stat dr-c1">🪙 0</span>
        <span class="stat dr-h1">❤️❤️❤️</span>
      </div>
      <canvas class="dr-canvas dr-cv1" width="${CW}" height="${CH}"></canvas>
      <div class="dr-ctrl">
        <button class="lane1 dr-up1" type="button">⬆ 上道</button>
        <button class="lane1 dr-dn1" type="button">⬇ 下道</button>
        <button class="jump1 dr-jp1" type="button">🦘 跳！</button>
      </div>
      <div class="dr-vs">⚡ V S ⚡</div>
      <div class="dr-hud dr-hud-2">
        <span class="name">${avatarHTML("xingxing", 26)} 星星</span>
        <span class="stat dr-d2">0 米</span>
        <span class="stat dr-c2">🪙 0</span>
        <span class="stat dr-h2">❤️❤️❤️</span>
      </div>
      <canvas class="dr-canvas dr-cv2" width="${CW}" height="${CH}"></canvas>
      <div class="dr-ctrl">
        <button class="lane2 dr-up2" type="button">⬆ 上道</button>
        <button class="lane2 dr-dn2" type="button">⬇ 下道</button>
        <button class="jump2 dr-jp2" type="button">🦘 跳！</button>
      </div>
      <div class="dr-btns">
        <button class="dr-again" type="button">🔄 再来一局</button>
        <button class="dr-back" type="button">🔧 换玩法</button>
      </div>
      <div class="dr-msg"></div>
      <div class="dr-count dr-hidden"></div>
    </div>
    <div class="dr-rules dr-hidden">
      <button class="dr-rules-close" type="button">✖ 关闭</button>
      <h3 style="margin-top:2px">📖 朵星双人冲刺 · 规则</h3>
      ${RULES_HTML}
    </div>
  `;
  api.root.appendChild(wrap);

  const setupEl = wrap.querySelector(".dr-setup") as HTMLElement;
  const gameEl = wrap.querySelector(".dr-game") as HTMLElement;
  const rulesEl = wrap.querySelector(".dr-rules") as HTMLElement;
  const countEl = wrap.querySelector(".dr-count") as HTMLElement;
  const msgEl = wrap.querySelector(".dr-msg") as HTMLElement;
  const cv1 = wrap.querySelector(".dr-cv1") as HTMLCanvasElement;
  const cv2 = wrap.querySelector(".dr-cv2") as HTMLCanvasElement;
  const ctx1 = cv1.getContext("2d")!;
  const ctx2 = cv2.getContext("2d")!;
  const d1El = wrap.querySelector(".dr-d1") as HTMLElement;
  const d2El = wrap.querySelector(".dr-d2") as HTMLElement;
  const c1El = wrap.querySelector(".dr-c1") as HTMLElement;
  const c2El = wrap.querySelector(".dr-c2") as HTMLElement;
  const h1El = wrap.querySelector(".dr-h1") as HTMLElement;
  const h2El = wrap.querySelector(".dr-h2") as HTMLElement;

  (wrap.querySelector(".dr-mode") as HTMLElement).addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    for (const b of Array.from(wrap.querySelectorAll(".dr-mode button"))) b.classList.remove("on");
    btn.classList.add("on");
    api.play("tap");
    mode = btn.dataset.v as RaceMode;
  });

  function makePlayer(name: string, emoji: string, seed: number): PlayerState {
    return {
      name,
      emoji,
      gen: createTrackGen(seed),
      resolved: 0,
      dist: 0,
      lane: 1,
      laneFloat: 1,
      jumpUntil: -1,
      hearts: MAX_HEARTS,
      coins: 0,
      safeUntil: -1,
      boostUntil: -1,
      stunUntil: -1,
      crashed: false,
      bump: 0,
    };
  }

  function startRace(): void {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    p1 = makePlayer("朵朵", "🌸", seed);
    p2 = makePlayer("星星", "⭐", seed);
    finished = false;
    racing = false;
    simTime = 0;
    setupEl.classList.add("dr-hidden");
    gameEl.classList.remove("dr-hidden");
    msgEl.textContent = mode === "endless" ? "赛道一模一样，比的就是本事！" : `先吃到 ${COIN_RACE_TARGET} 枚金币就赢！`;
    updateHud();
    // 3-2-1 倒计时
    let n = 3;
    countEl.classList.remove("dr-hidden");
    countEl.textContent = "3";
    api.play("tap");
    const step = (): void => {
      if (destroyed) return;
      n--;
      if (n <= 0) {
        countEl.classList.add("dr-hidden");
        racing = true;
        api.play("jump");
        return;
      }
      countEl.textContent = String(n);
      api.play("tap");
      countTimer = window.setTimeout(step, 700);
    };
    countTimer = window.setTimeout(step, 700);
  }

  function heartsText(p: PlayerState): string {
    if (mode === "coins") return "🌟";
    return "❤️".repeat(p.hearts) + "🤍".repeat(MAX_HEARTS - p.hearts);
  }

  function updateHud(): void {
    if (!p1 || !p2) return;
    d1El.textContent = `${Math.floor(p1.dist)} 米`;
    d2El.textContent = `${Math.floor(p2.dist)} 米`;
    c1El.textContent = `🪙 ${p1.coins}`;
    c2El.textContent = `🪙 ${p2.coins}`;
    h1El.textContent = heartsText(p1);
    h2El.textContent = heartsText(p2);
  }

  function finishRace(): void {
    if (finished || !p1 || !p2) return;
    finished = true;
    racing = false;
    let text: string;
    let winnerIdx: 0 | 1 | -1;
    if (mode === "coins") {
      winnerIdx = p1.coins >= COIN_RACE_TARGET ? 0 : 1;
      const w = winnerIdx === 0 ? p1 : p2;
      text = `${w.emoji} ${w.name}先抢到 ${COIN_RACE_TARGET} 枚金币，获胜！`;
    } else {
      winnerIdx = endlessWinner(
        { dist: p1.dist, coins: p1.coins, crashed: p1.crashed },
        { dist: p2.dist, coins: p2.coins, crashed: p2.crashed },
      );
      if (winnerIdx === -1) {
        text = `不分胜负！两人都跑了 ${Math.floor(p1.dist)} 米，再来一局分高下！`;
      } else {
        const w = winnerIdx === 0 ? p1 : p2;
        const l = winnerIdx === 0 ? p2 : p1;
        text = `${w.emoji} ${w.name}赢啦！跑了 ${Math.floor(w.dist)} 米（对手 ${Math.floor(l.dist)} 米）`;
      }
    }
    msgEl.textContent = text;
    api.play("win");
    clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (destroyed) return;
      api.onWin(1, text);
    }, 1500);
  }

  /* ---------------- 模拟 ---------------- */

  function stepPlayer(p: PlayerState, dt: number): void {
    if (p.crashed) return;
    if (simTime < p.stunUntil) {
      p.bump = Math.max(0, p.bump - dt * 3);
      return;
    }
    let speed = speedAt(p.dist);
    if (simTime < p.boostUntil) speed *= BOOST_MULT;
    p.dist += speed * dt;
    // 车道插值动画
    p.laneFloat += (p.lane - p.laneFloat) * Math.min(1, dt * 14);
    p.bump = Math.max(0, p.bump - dt * 3);
    // 处理跑过的实体
    const entities = p.gen.ensure(p.dist + 400);
    while (p.resolved < entities.length && entities[p.resolved].at <= p.dist) {
      const e = entities[p.resolved];
      p.resolved++;
      resolveEntity(p, e);
    }
  }

  function resolveEntity(p: PlayerState, e: Entity): void {
    if (e.lane !== p.lane) return;
    const jumping = simTime < p.jumpUntil;
    if (e.kind === "coin") {
      p.coins++;
      api.play("coin");
      if (mode === "coins" && p.coins >= COIN_RACE_TARGET) finishRace();
      return;
    }
    if (e.kind === "boost") {
      if (jumping) return;
      p.boostUntil = simTime + BOOST_SECONDS;
      api.play("jump");
      return;
    }
    if (isObstacle(e.kind)) {
      if (survives(e.kind, jumping)) return; // 跳过去了
      if (simTime < p.safeUntil) return; // 无敌时间
      p.bump = 1;
      api.play("oops");
      if (mode === "coins") {
        p.stunUntil = simTime + 1.0;
        return;
      }
      p.hearts--;
      p.safeUntil = simTime + HIT_SAFE_SECONDS;
      if (p.hearts <= 0) {
        p.crashed = true;
        msgEl.textContent = `${p.emoji} ${p.name}的心用完啦，成绩定格在 ${Math.floor(p.dist)} 米！`;
      }
    }
  }

  function tickSim(dt: number): void {
    if (!racing || finished || !p1 || !p2) return;
    simTime += dt;
    stepPlayer(p1, dt);
    stepPlayer(p2, dt);
    updateHud();
    if (mode === "endless" && p1.crashed && p2.crashed) finishRace();
  }

  /* ---------------- 绘制 ---------------- */

  function drawTrack(ctx: CanvasRenderingContext2D, p: PlayerState, tint: [string, string]): void {
    // 天空与地面
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, tint[0]);
    g.addColorStop(1, tint[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    // 车道分隔虚线（跟着滚动）
    const scroll = (p.dist * PX_PER_M) % 28;
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 14]);
    for (const border of [(LANE_Y[0] + LANE_Y[1]) / 2, (LANE_Y[1] + LANE_Y[2]) / 2]) {
      ctx.beginPath();
      ctx.moveTo(-scroll, border);
      ctx.lineTo(CW + 28, border);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // 实体
    const entities = p.gen.ensure(p.dist + 400);
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = p.resolved; i < entities.length; i++) {
      const e = entities[i];
      const x = RUNNER_X + (e.at - p.dist) * PX_PER_M;
      if (x < -30) continue;
      if (x > CW + 30) break;
      const y = LANE_Y[e.lane];
      if (e.kind === "pit") {
        ctx.fillStyle = "rgba(80, 55, 30, .8)";
        ctx.beginPath();
        ctx.ellipse(x, y + 6, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "boost") {
        ctx.fillStyle = "rgba(120, 220, 130, .5)";
        ctx.beginPath();
        ctx.roundRect(x - 18, y - 8, 36, 18, 6);
        ctx.fill();
        ctx.fillText("⚡", x, y);
      } else {
        ctx.fillText(ENTITY_EMOJI[e.kind] ?? "❓", x, y);
      }
    }
    // 跑者
    const jumping = simTime < p.jumpUntil;
    const jumpT = jumping ? 1 - Math.abs((p.jumpUntil - simTime) / JUMP_SECONDS * 2 - 1) : 0;
    const lift = jumpT * 26;
    const ry = LANE_Y[0] + (LANE_Y[2] - LANE_Y[0]) * (p.laneFloat / 2);
    const bounce = p.crashed ? 0 : Math.abs(Math.sin(simTime * 10)) * 3;
    // 影子
    ctx.fillStyle = "rgba(60,60,90,.22)";
    ctx.beginPath();
    ctx.ellipse(RUNNER_X, ry + 14, 14 - jumpT * 5, 5 - jumpT * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const blink = simTime < p.safeUntil && Math.floor(simTime * 8) % 2 === 0;
    if (!blink) {
      const shake = p.bump > 0 ? Math.sin(simTime * 40) * 3 * p.bump : 0;
      ctx.font = "30px sans-serif";
      ctx.fillText(p.crashed ? "😵" : p.emoji, RUNNER_X + shake, ry - lift - bounce - 4);
    }
    // 加速特效
    if (simTime < p.boostUntil && !p.crashed) {
      ctx.fillStyle = "rgba(255, 220, 90, .8)";
      ctx.font = "16px sans-serif";
      ctx.fillText("💨", RUNNER_X - 22, ry - 4);
    }
    if (p.crashed) {
      ctx.fillStyle = "rgba(60,60,90,.55)";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#fff";
      ctx.font = "700 18px sans-serif";
      ctx.fillText(`${Math.floor(p.dist)} 米 · 等对手…`, CW / 2, CH / 2);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  let lastFrame = 0;
  function frame(now: number): void {
    if (destroyed) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    if (!gameEl.classList.contains("dr-hidden") && p1 && p2) {
      tickSim(dt);
      drawTrack(ctx1, p1, ["#FFE9F2", "#FFD9E8"]);
      drawTrack(ctx2, p2, ["#E4EFFF", "#D2E4FF"]);
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------------- 输入 ---------------- */

  function laneUp(p: PlayerState | null): void {
    if (!p || !racing || finished || p.crashed) return;
    p.lane = Math.max(0, p.lane - 1);
    api.play("tap");
  }
  function laneDown(p: PlayerState | null): void {
    if (!p || !racing || finished || p.crashed) return;
    p.lane = Math.min(2, p.lane + 1);
    api.play("tap");
  }
  function jump(p: PlayerState | null): void {
    if (!p || !racing || finished || p.crashed) return;
    if (simTime < p.jumpUntil) return;
    p.jumpUntil = simTime + JUMP_SECONDS;
    api.play("jump");
  }

  function bindHold(selector: string, fn: () => void): void {
    const btn = wrap.querySelector(selector) as HTMLButtonElement;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      fn();
    });
  }
  bindHold(".dr-up1", () => laneUp(p1));
  bindHold(".dr-dn1", () => laneDown(p1));
  bindHold(".dr-jp1", () => jump(p1));
  bindHold(".dr-up2", () => laneUp(p2));
  bindHold(".dr-dn2", () => laneDown(p2));
  bindHold(".dr-jp2", () => jump(p2));

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key;
    if (k === "w" || k === "W") { laneUp(p1); e.preventDefault(); }
    else if (k === "s" || k === "S") { laneDown(p1); e.preventDefault(); }
    else if (k === "d" || k === "D") { jump(p1); e.preventDefault(); }
    else if (k === "ArrowUp") { laneUp(p2); e.preventDefault(); }
    else if (k === "ArrowDown") { laneDown(p2); e.preventDefault(); }
    else if (k === "ArrowRight") { jump(p2); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  (wrap.querySelector(".dr-start") as HTMLButtonElement).addEventListener("click", () => {
    api.play("jump");
    startRace();
  });
  (wrap.querySelector(".dr-again") as HTMLButtonElement).addEventListener("click", () => {
    if (!racing || finished) {
      clearTimeout(endTimer);
      clearTimeout(countTimer);
      api.play("tap");
      startRace();
    }
  });
  (wrap.querySelector(".dr-back") as HTMLButtonElement).addEventListener("click", () => {
    clearTimeout(endTimer);
    clearTimeout(countTimer);
    racing = false;
    finished = false;
    gameEl.classList.add("dr-hidden");
    setupEl.classList.remove("dr-hidden");
    api.play("tap");
  });
  (wrap.querySelector(".dr-rulesbtn") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.remove("dr-hidden");
  });
  (wrap.querySelector(".dr-rules-close") as HTMLButtonElement).addEventListener("click", () => {
    api.play("tap");
    rulesEl.classList.add("dr-hidden");
  });

  raf = requestAnimationFrame((t) => {
    lastFrame = t;
    raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(endTimer);
      clearTimeout(countTimer);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}
