import { meta } from "./meta";
export { meta };

// 音符下落 —— 四条轨的下落式点击。
//
// 判定、谱面、关卡、假人全在 judge.ts / chart.ts / run.ts / levels.ts / ai.ts 里,
// 这个文件只负责把它们摆到屏幕上:Canvas 画四列和判定线,音符压到线上就点,
// 长按条要按住到尾,命中会碎成往上飘的小音符。
// 四种玩法都在这儿:188 关闯关、同谱对战、无尽加速、双人分轨。
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { TIER_NAMES, aiRun, tierLine, type AiTier } from "./ai";
import { createToneKit, type ToneKit } from "./audio";
import { LANE_COUNT, type Chart } from "./chart";
import guideBook from "./guide";
import { CAMPAIGN_MAX_MISS, MISS_LINE, approachMs, endlessSpeedAt } from "./judge";
import {
  CHAPTERS,
  buildLevel,
  endlessWave,
  levelBrief,
  levelChart,
  levelRules,
  levelStars,
  loseLine,
  matchChart,
  winLine,
} from "./levels";
import {
  ENDLESS_RULES,
  advanceTo,
  createRun,
  releaseLane,
  tapLane,
  type RunEvent,
  type RunRules,
  type RunState,
} from "./run";

// ---------------------------------------------------------------------------
// 尺寸与配色
// ---------------------------------------------------------------------------

/** 判定线放在画布 80% 高度处 */
export const JUDGE_LINE_RATIO = 0.8;
/** 每一列的最小宽度:360px 屏也要留得住手指 */
export const MIN_LANE_PX = 80;

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

function reduceMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches === true : false;
  } catch {
    return false;
  }
}

/** 画布宽度:窄屏占满,宽屏封顶,永远保证四列各自 ≥ 80px */
export function stageWidth(viewport: number): number {
  const w = Number.isFinite(viewport) && viewport > 0 ? viewport : 480;
  return Math.max(MIN_LANE_PX * LANE_COUNT, Math.min(460, Math.round(w - 24)));
}

/** 每一列有多宽 */
export function laneWidthAt(viewport: number): number {
  return stageWidth(viewport) / LANE_COUNT;
}

/** 画布高度:比宽度略高一点,给下落留出距离 */
export function stageHeight(width: number): number {
  return Math.max(380, Math.min(540, Math.round(width * 1.24)));
}

const LANE_COLORS = ["#B79CF0", "#7FB6EC", "#F09BC0", "#7ED3A8"];
const LANE_SOFT = ["#F1EAFF", "#E8F2FD", "#FDEAF2", "#E7F8EF"];
const PERFECT_COLOR = "#FFBE4D";
const GOOD_COLOR = "#7FC9F5";
const NOTE_GLYPHS = ["♪", "♫", "♬", "♩"];

/** 四轨键位:单人 D F J K */
export const KEYS_SOLO = ["d", "f", "j", "k"];
/** 双人分轨:朵朵 A S 管左两轨,星星 K L 管右两轨 */
export const KEYS_DUO = ["a", "s", "k", "l"];

/** 一个键对应哪条轨;不是本款的键返回 -1 */
export function laneForKey(key: string, split: boolean): number {
  const k = (key ?? "").toLowerCase();
  return (split ? KEYS_DUO : KEYS_SOLO).indexOf(k);
}

/** 点在画布上的横坐标落在第几列 */
export function laneForX(x: number, width: number): number {
  if (!(width > 0)) return -1;
  const lane = Math.floor((x / width) * LANE_COUNT);
  return Math.max(0, Math.min(LANE_COUNT - 1, lane));
}

const CSS = `
.tt-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;
  align-items:center;background:linear-gradient(180deg,#F7F1FF,#EDF3FF);border-radius:18px;padding:10px;
  position:relative;overflow:hidden;}
.tt-banner{text-align:center;font-size:14px;font-weight:800;color:#6b4fa0;line-height:1.5;}
.tt-hud{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%;}
.tt-stat{background:#ffffffdd;border-radius:999px;padding:4px 12px;font-size:16px;font-weight:900;color:#5f4a8a;
  box-shadow:0 2px 6px rgba(150,130,200,.2);}
.tt-stat-combo{color:#b8446f;}
.tt-stat-life{color:#7a6a3f;background:#fff6dd;}
.tt-canvas{border-radius:16px;background:#FBF7FF;box-shadow:0 4px 14px rgba(150,130,200,.22);display:block;
  touch-action:none;}
.tt-say{font-size:14px;font-weight:800;color:#7a6aa6;text-align:center;min-height:20px;line-height:1.4;}
.tt-say-miss{color:#8b7fae;}
.tt-keys{font-size:13px;font-weight:700;color:#8b7ead;text-align:center;line-height:1.6;}
.tt-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.tt-btn{border:none;border-radius:14px;min-height:44px;padding:8px 16px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#5b4a7a;background:#efe9ff;box-shadow:0 3px 0 rgba(140,120,190,.4);}
.tt-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.4);}
.tt-btn-go{background:linear-gradient(180deg,#a98bea,#8a6ad6);color:#fff;box-shadow:0 3px 0 #6d51b4;}
.tt-btn-go:active{box-shadow:0 1px 0 #6d51b4;}
.tt-btn:focus-visible,.tt-open:focus-visible,.tt-goback:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.tt-cover{position:absolute;inset:0;background:rgba(252,248,255,.97);border-radius:18px;z-index:20;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:18px;}
.tt-cover-t{font-size:20px;font-weight:900;color:#6b4fa0;}
.tt-cover-s{font-size:15px;font-weight:700;color:#7a6aa6;line-height:1.6;max-width:320px;}
.tt-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
.tt-open{border:none;border-radius:999px;padding:10px 16px;min-height:44px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;background:linear-gradient(180deg,#a98bea,#8a6ad6);
  box-shadow:0 4px 0 #6d51b4;}
.tt-open.tt-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.tt-open.tt-open-duo{background:linear-gradient(180deg,#7fc7a4,#4fa37c);box-shadow:0 4px 0 #3b7f60;}
.tt-open:active{transform:translateY(2px);box-shadow:0 2px 0 #6d51b4;}
.tt-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#F6F2FF,#FFF4FA);display:flex;flex-direction:column;gap:8px;}
.tt-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tt-goback{border:none;border-radius:999px;padding:8px 13px;min-height:44px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.tt-goback:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.tt-chip{background:#ffffffdd;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#6a5892;
  box-shadow:0 2px 5px rgba(150,140,190,.18);}
.tt-over{border-radius:16px;background:#fffdfa;padding:14px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.tt-over-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.tt-over-s{font-size:15px;font-weight:700;color:#6f6390;line-height:1.6;}
@media (max-width:420px){
  .tt-wrap{padding:8px;gap:6px;}
  .tt-banner{font-size:13px;}
  .tt-keys{font-size:13px;}
}
@media (prefers-reduced-motion:reduce){
  .tt-btn:active,.tt-open:active,.tt-goback:active{transform:none;}
}
`;

// ---------------------------------------------------------------------------
// 舞台:Canvas 四列 + 判定线
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  glyph: string;
  color: string;
}

export interface StageDone {
  state: RunState;
  /** 对战时假人的分数;没有假人就是 0 */
  rivalScore: number;
}

export interface StageOpts {
  chart: Chart;
  rules: RunRules;
  /** 顶上的两行说明 */
  banner: string;
  /** 双人分轨:左两轨给朵朵、右两轨给星星 */
  split?: boolean;
  /** 对战对手 */
  rival?: AiTier | null;
  sfx: (name: SoundName) => void;
  tones: ToneKit;
  onDone: (r: StageDone) => void;
}

export function createStage(host: HTMLElement, opts: StageOpts): { destroy: () => void } {
  const split = opts.split === true;
  const state = createRun(opts.chart, opts.rules);
  const rivalScore = opts.rival ? aiRun(opts.chart, opts.rival, opts.chart.seed + 5).score : 0;
  const approach = approachMs(opts.chart.speed);

  let destroyed = false;
  let paused = false;
  let over = false;
  let raf = 0;
  let startWall = 0;
  let pauseWall = 0;
  let pausedTotal = 0;
  let lastFrame = 0;
  const particles: Particle[] = [];
  /** 每条轨最近一次命中 / miss 的时刻,用来画底部亮起与温柔的变暗 */
  const laneHit = new Array<number>(LANE_COUNT).fill(-9999);
  const laneDim = new Array<number>(LANE_COUNT).fill(-9999);
  const held = new Set<number>();
  const pressedKeys = new Set<string>();

  const wrap = document.createElement("div");
  wrap.className = "tt-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  const banner = document.createElement("div");
  banner.className = "tt-banner";
  banner.innerHTML = opts.banner;
  const hud = document.createElement("div");
  hud.className = "tt-hud";
  const canvas = document.createElement("canvas");
  canvas.className = "tt-canvas";
  const say = document.createElement("div");
  say.className = "tt-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  const keys = document.createElement("div");
  keys.className = "tt-keys";
  const btns = document.createElement("div");
  btns.className = "tt-btns";
  wrap.append(style, banner, hud, canvas, say, keys, btns);
  host.appendChild(wrap);

  let width = stageWidth(viewportWidth());
  let height = stageHeight(width);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `四条轨道的下落谱面,判定线在下方,一共 ${opts.chart.notes.length} 个音符`
  );

  const ctx2d = (canvas.getContext("2d") ?? null) as CanvasRenderingContext2D | null;

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "tt-btn";
  pauseBtn.textContent = "⏸ 暂停";
  pauseBtn.addEventListener("click", () => togglePause());
  btns.appendChild(pauseBtn);

  keys.innerHTML = split
    ? "朵朵 A / S 管左两轨 · 星星 K / L 管右两轨<br>手机直接点对应的那一列 · Esc 暂停"
    : "键盘 D F J K 对四条轨 · 手机直接点对应的那一列 · Esc 暂停";

  function judgeY(): number {
    return Math.round(height * JUDGE_LINE_RATIO);
  }

  function nowMs(): number {
    const p = (globalThis as { performance?: { now: () => number } }).performance;
    const wall = p ? p.now() : 0;
    if (startWall === 0) startWall = wall;
    if (paused) return pauseWall - startWall - pausedTotal;
    return wall - startWall - pausedTotal;
  }

  function renderHud(): void {
    const lives = Number.isFinite(state.rules.maxMiss)
      ? `<span class="tt-stat tt-stat-life">💗 还能漏 ${Math.max(0, state.rules.maxMiss - state.miss)} 个</span>`
      : "";
    const rival = opts.rival
      ? `<span class="tt-stat">🤖 ${TIER_NAMES[opts.rival]} ${rivalScore} 分</span>`
      : "";
    hud.innerHTML = `<span class="tt-stat">🎼 ${state.score} 分</span>
      <span class="tt-stat tt-stat-combo">🔥 ${state.combo} 连</span>${lives}${rival}`;
  }

  function tell(text: string, missish = false): void {
    say.className = `tt-say${missish ? " tt-say-miss" : ""}`;
    say.textContent = text;
  }

  // -------------------------------------------------------------------------
  // 命中反馈:碎成往上飘的小音符,禁止瞬删
  // -------------------------------------------------------------------------

  function spawnParticles(lane: number, color: string, strong: boolean): void {
    const n = reduceMotion() ? 3 : strong ? 10 : 6;
    const cx = (lane + 0.5) * (width / LANE_COUNT);
    const cy = judgeY();
    for (let i = 0; i < n; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * (width / LANE_COUNT) * 0.7,
        y: cy,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(0.08 + Math.random() * 0.1),
        life: 0,
        max: reduceMotion() ? 320 : 620,
        glyph: NOTE_GLYPHS[Math.floor(Math.random() * NOTE_GLYPHS.length)],
        color,
      });
    }
  }

  function handleEvents(): void {
    if (state.events.length === 0) return;
    for (const ev of state.events as RunEvent[]) {
      if (ev.kind === "perfect" || ev.kind === "good") {
        const perfect = ev.kind === "perfect";
        laneHit[ev.lane] = state.timeMs;
        spawnParticles(ev.lane, perfect ? PERFECT_COLOR : GOOD_COLOR, perfect);
        opts.tones.hit(ev.kind, ev.lane, state.combo);
        if (state.combo > 0 && state.combo % 10 === 0) opts.sfx("coin");
        tell(perfect ? `完美!${state.combo} 连` : `良好 · ${state.combo} 连`);
      } else if (ev.kind === "hold") {
        held.add(ev.lane);
        opts.tones.holdStart(ev.lane, state.combo);
        tell("按住别松,亮到尾端再抬手。");
      } else if (ev.kind === "miss") {
        laneDim[ev.lane] = state.timeMs;
        opts.tones.miss();
        tell(MISS_LINE, true);
      } else {
        laneDim[ev.lane] = state.timeMs;
        opts.tones.miss();
        tell(state.message, true);
      }
    }
    state.events.length = 0;
    renderHud();
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  function pressLane(lane: number): void {
    if (over || paused || destroyed || lane < 0) return;
    // 这一关没启用的轨上什么都没有,点下去自然按「点空白」算,规则不打折
    tapLane(state, lane, nowMs());
    handleEvents();
    checkOver();
  }

  function liftLane(lane: number): void {
    if (over || paused || destroyed || lane < 0) return;
    held.delete(lane);
    releaseLane(state, lane, nowMs());
    handleEvents();
    checkOver();
  }

  function onKeyDown(ev: KeyboardEvent): void {
    if (destroyed) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      togglePause();
      return;
    }
    const key = (ev.key ?? "").toLowerCase();
    const lane = laneForKey(key, split);
    if (lane < 0) return;
    ev.preventDefault();
    if (pressedKeys.has(key)) return;
    pressedKeys.add(key);
    pressLane(lane);
  }

  function onKeyUp(ev: KeyboardEvent): void {
    if (destroyed) return;
    const key = (ev.key ?? "").toLowerCase();
    const lane = laneForKey(key, split);
    if (lane < 0) return;
    pressedKeys.delete(key);
    liftLane(lane);
  }

  function pointerLane(ev: { clientX?: number }): number {
    const rect = canvas.getBoundingClientRect?.();
    const left = rect ? rect.left : 0;
    const shown = rect && rect.width > 0 ? rect.width : width;
    const x = ((ev.clientX ?? 0) - left) * (width / shown);
    return laneForX(x, width);
  }

  function onPointerDown(ev: PointerEvent): void {
    if (destroyed) return;
    ev.preventDefault?.();
    pressLane(pointerLane(ev));
  }

  function onPointerUp(ev: PointerEvent): void {
    if (destroyed) return;
    liftLane(pointerLane(ev));
  }

  // -------------------------------------------------------------------------
  // 暂停与收尾
  // -------------------------------------------------------------------------

  function togglePause(): void {
    if (over || destroyed) return;
    const p = (globalThis as { performance?: { now: () => number } }).performance;
    const wall = p ? p.now() : 0;
    paused = !paused;
    if (paused) {
      pauseWall = wall;
      pauseBtn.textContent = "▶️ 继续";
      showCover("⏸ 先歇一会儿", "谱面停在这里等你,回来接着弹。", "▶️ 继续玩", () => togglePause());
    } else {
      pausedTotal += wall - pauseWall;
      pauseBtn.textContent = "⏸ 暂停";
      hideCover();
    }
    opts.sfx("tap");
  }

  function showCover(title: string, sub: string, label: string, onClick: () => void): void {
    hideCover();
    const cover = document.createElement("div");
    cover.className = "tt-cover";
    cover.innerHTML = `<div class="tt-cover-t">${title}</div><div class="tt-cover-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tt-btn tt-btn-go";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    cover.appendChild(btn);
    wrap.appendChild(cover);
  }

  function hideCover(): void {
    wrap.querySelector(".tt-cover")?.remove();
  }

  function checkOver(): void {
    if (over || !state.over) return;
    over = true;
    renderHud();
    opts.sfx(state.cleared ? "win" : "oops");
    if (!state.cleared) tell(state.ended === "empty" ? state.message : MISS_LINE, true);
    opts.onDone({ state, rivalScore });
  }

  // -------------------------------------------------------------------------
  // 绘制
  // -------------------------------------------------------------------------

  function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.lineTo(x + w - rr, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rr);
    c.lineTo(x + w, y + h - rr);
    c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    c.lineTo(x + rr, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rr);
    c.lineTo(x, y + rr);
    c.quadraticCurveTo(x, y, x, y + rr);
    c.closePath();
    c.fill();
  }

  function draw(t: number): void {
    const c = ctx2d;
    if (!c) return;
    const lane = width / LANE_COUNT;
    const line = judgeY();
    const pxPerMs = line / approach;

    c.clearRect(0, 0, width, height);
    // 四列底色 + 分隔线
    for (let i = 0; i < LANE_COUNT; i++) {
      const on = opts.chart.lanes.includes(i);
      c.fillStyle = on ? LANE_SOFT[i] : "#F4F1F8";
      c.fillRect(i * lane, 0, lane, height);
      const dim = t - laneDim[i];
      if (dim >= 0 && dim < 700) {
        // miss 的温柔提示:轨道整体轻微变暗,不闪红
        c.fillStyle = `rgba(120,108,150,${0.16 * (1 - dim / 700)})`;
        c.fillRect(i * lane, 0, lane, height);
      }
      c.fillStyle = "rgba(150,135,190,.18)";
      c.fillRect(i * lane - 0.5, 0, 1, height);
    }

    // 音符
    for (const ns of state.notes) {
      if (ns.status === "done" || ns.status === "missed") continue;
      const note = ns.note;
      const headY = line - (note.time - t) * pxPerMs;
      const tailY = line - (note.time + note.hold - t) * pxPerMs;
      if (headY < -80 || tailY > height + 80) continue;
      const x = note.lane * lane + lane * 0.14;
      const w = lane * 0.72;
      c.fillStyle = LANE_COLORS[note.lane];
      if (note.hold > 0) {
        const top = Math.min(headY, tailY);
        const h = Math.max(18, Math.abs(headY - tailY));
        roundRect(c, x, top, w, h, w * 0.45);
        // 按住时条身有一段流动的亮块
        if (ns.status === "holding") {
          const flow = (t / 6) % Math.max(1, h);
          c.fillStyle = "rgba(255,255,255,.55)";
          roundRect(c, x + w * 0.2, top + h - flow, w * 0.6, Math.min(22, h), w * 0.3);
        }
      } else {
        roundRect(c, x, headY - 13, w, 26, 9);
      }
    }

    // 判定线 + 命中时轨道底部亮一下
    for (let i = 0; i < LANE_COUNT; i++) {
      const since = t - laneHit[i];
      if (since >= 0 && since < 320) {
        const a = 1 - since / 320;
        c.fillStyle = `rgba(255,220,150,${0.5 * a})`;
        c.fillRect(i * lane, line - 26, lane, height - line + 26);
      }
    }
    c.fillStyle = "#8A6AD6";
    c.fillRect(0, line - 2, width, 4);
    c.fillStyle = "rgba(138,106,214,.22)";
    c.fillRect(0, line - 9, width, 7);

    // 命中粒子:小音符往上飘着淡出
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const p of particles) {
      const a = Math.max(0, 1 - p.life / p.max);
      c.globalAlpha = a;
      c.fillStyle = p.color;
      c.font = `${Math.round(14 + 8 * a)}px "PingFang SC",system-ui,sans-serif`;
      c.fillText(p.glyph, p.x, p.y);
    }
    c.globalAlpha = 1;

    if (t < 0) {
      c.fillStyle = "#8A6AD6";
      c.font = '900 22px "PingFang SC",system-ui,sans-serif';
      c.fillText("预备…", width / 2, height * 0.4);
    }
  }

  function step(dt: number, t: number): void {
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life >= particles[i].max) particles.splice(i, 1);
    }
    draw(t);
  }

  function frame(): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const t = nowMs();
    const dt = Math.max(0, Math.min(64, t - lastFrame));
    lastFrame = t;
    if (!paused && !over) {
      advanceTo(state, t);
      handleEvents();
      checkOver();
    }
    step(dt, t);
  }

  const onResize = (): void => {
    if (destroyed) return;
    width = stageWidth(viewportWidth());
    height = stageHeight(width);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  };

  canvas.addEventListener("pointerdown", onPointerDown as EventListener);
  canvas.addEventListener("pointerup", onPointerUp as EventListener);
  canvas.addEventListener("pointercancel", onPointerUp as EventListener);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);

  renderHud();
  tell(opts.rival ? tierLine(opts.rival) : "音符压到判定线就点,空白格别碰。");
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("pointerdown", onPointerDown as EventListener);
      canvas.removeEventListener("pointerup", onPointerUp as EventListener);
      canvas.removeEventListener("pointercancel", onPointerUp as EventListener);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      particles.length = 0;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关:188 关
// ---------------------------------------------------------------------------

function playLevelWith(tones: ToneKit) {
  return function playLevel(host: HTMLElement, ctx: PlayCtx): PlayHandle {
    const lv = buildLevel(ctx.level);
    const chart = levelChart(lv);
    const ch = CHAPTERS[lv.chapter];
    let stage: { destroy: () => void } | null = null;

    stage = createStage(host, {
      chart,
      rules: levelRules(lv),
      banner: `${ch.emoji} 第 ${ctx.level + 1} 关 · ${levelBrief(lv)}<br>${lv.hint}`,
      split: lv.split,
      sfx: ctx.sfx,
      tones,
      onDone: ({ state }) => {
        if (state.cleared) {
          const stars = levelStars(state);
          ctx.win(stars, winLine(stars, state.maxCombo));
        } else {
          ctx.lose(loseLine(state.ended));
        }
      },
    });

    return {
      destroy() {
        stage?.destroy();
        stage = null;
      },
    };
  };
}

// ---------------------------------------------------------------------------
// 模式外壳
// ---------------------------------------------------------------------------

interface ModeShell {
  wrap: HTMLElement;
  chip: HTMLElement;
  stage: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void): ModeShell {
  const wrap = document.createElement("div");
  wrap.className = "tt-mode";
  const style = document.createElement("style");
  style.textContent = CSS;
  const head = document.createElement("div");
  head.className = "tt-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "tt-goback";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "tt-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);
  return { wrap, chip, stage, destroy: () => wrap.remove() };
}

function overPanel(
  host: HTMLElement,
  title: string,
  sub: string,
  label: string,
  onAgain: () => void
): void {
  host.innerHTML = "";
  const box = document.createElement("div");
  box.className = "tt-over";
  box.innerHTML = `<div class="tt-over-t">${title}</div><div class="tt-over-s">${sub}</div>`;
  const again = document.createElement("button");
  again.type = "button";
  again.className = "tt-open";
  again.textContent = label;
  again.addEventListener("click", onAgain);
  box.appendChild(again);
  host.appendChild(box);
}

// ---------------------------------------------------------------------------
// 无尽:速度一路往上加,0 容错
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, tones: ToneKit, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let wave = 0;
  let total = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let stage: { destroy: () => void } | null = null;

  function startWave(): void {
    stage?.destroy();
    shell.stage.innerHTML = "";
    const chart = endlessWave(wave);
    shell.chip.textContent = `♾️ 第 ${wave + 1} 段 · 速度 ${endlessSpeedAt(wave * 8000).toFixed(2)} · 累计 ${total} 分 · 最好 ${best}`;
    stage = createStage(shell.stage, {
      chart,
      rules: ENDLESS_RULES,
      banner: `♾️ 无尽加速 · 第 ${wave + 1} 段<br>一个音符都不能漏,速度会一直往上加`,
      sfx: (n) => api.play(n),
      tones,
      onDone: ({ state }) => {
        total += state.score;
        if (state.cleared) {
          wave++;
          api.addStars(1);
          startWave();
          return;
        }
        best = save.recordEndlessBest(meta.id, total);
        overPanel(
          shell.stage,
          state.ended === "empty" ? "点到空白格啦" : "有个音符溜走啦",
          `撑到了第 ${wave + 1} 段,一共 ${total} 分,最好成绩 ${best} 分。再来一次一定能更远!`,
          "🔁 从第 1 段再来",
          () => {
            api.play("tap");
            wave = 0;
            total = 0;
            startWave();
          }
        );
      },
    });
  }

  startWave();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:同一张谱,和假人比分
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, tones: ToneKit, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let tier: AiTier = "normal";
  let round = 1;
  const wins = [0, 0];
  let stage: { destroy: () => void } | null = null;

  function pickPanel(): void {
    stage?.destroy();
    stage = null;
    shell.chip.textContent = "⚔️ 对战 · 挑一个对手";
    shell.stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "tt-over";
    box.innerHTML = `<div class="tt-over-t">⚔️ 同一张谱,比谁分高</div>
      <div class="tt-over-s">对手会照着同一张谱弹,档位越高手越准。</div>`;
    const row = document.createElement("div");
    row.className = "tt-btns";
    for (const t of ["rookie", "normal", "expert", "hell"] as AiTier[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `tt-btn${tier === t ? " tt-btn-go" : ""}`;
      b.textContent = TIER_NAMES[t];
      b.addEventListener("click", () => {
        api.play("tap");
        tier = t;
        pickPanel();
      });
      row.appendChild(b);
    }
    const go = document.createElement("button");
    go.type = "button";
    go.className = "tt-open tt-open-vs";
    go.textContent = "开始 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      startRound();
    });
    box.append(row, go);
    shell.stage.appendChild(box);
  }

  function startRound(): void {
    stage?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `⚔️ 第 ${round} 局 · 你 ${wins[0]} : ${wins[1]} ${TIER_NAMES[tier]}`;
    stage = createStage(shell.stage, {
      chart: matchChart(round),
      rules: { emptyRule: "combo", maxMiss: CAMPAIGN_MAX_MISS },
      banner: `⚔️ 第 ${round} 局 · 对手「${TIER_NAMES[tier]}」<br>同一张谱,分高的那个赢`,
      rival: tier,
      sfx: (n) => api.play(n),
      tones,
      onDone: ({ state, rivalScore }) => {
        const youWin = state.score > rivalScore;
        if (youWin) {
          wins[0]++;
          api.addStars(1);
        } else {
          wins[1]++;
        }
        overPanel(
          shell.stage,
          youWin ? "🏆 你赢下这一局!" : "🤖 这局对手分高一点",
          `你 ${state.score} 分 · 对手 ${rivalScore} 分。最高 ${state.maxCombo} 连,${
            youWin ? "手感正好,趁热再来一局。" : "再稳一点连击就追回来了。"
          }`,
          "🔁 再来一局",
          () => {
            api.play("tap");
            round++;
            startRound();
          }
        );
      },
    });
  }

  pickPanel();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人同屏:朵朵管左两轨,星星管右两轨,合作打同一张谱
// ---------------------------------------------------------------------------

function mountTwoPlayer(host: HTMLElement, api: GameApi, tones: ToneKit, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack);
  let round = 1;
  let bestTogether = 0;
  let stage: { destroy: () => void } | null = null;

  function startRound(): void {
    stage?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `👫 第 ${round} 局 · 两人最好 ${bestTogether} 分`;
    stage = createStage(shell.stage, {
      chart: matchChart(round + 40),
      rules: { emptyRule: "combo", maxMiss: 5 },
      banner: "👫 一张谱两个人打<br>朵朵管左边两轨(A / S),星星管右边两轨(K / L)",
      split: true,
      sfx: (n) => api.play(n),
      tones,
      onDone: ({ state }) => {
        bestTogether = Math.max(bestTogether, state.score);
        api.addStars(1);
        overPanel(
          shell.stage,
          state.cleared ? "🎉 两个人一起弹完啦!" : "这一段先到这儿",
          `合力 ${state.score} 分,最高 ${state.maxCombo} 连,漏了 ${state.miss} 个。配合越熟,连击越长。`,
          "🔁 再来一局",
          () => {
            api.play("tap");
            round++;
            startRound();
          }
        );
      },
    });
  }

  startRound();
  return {
    destroy() {
      stage?.destroy();
      stage = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const tones = createToneKit();
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "tt-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "tt-open";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "tt-open tt-open-vs";
  vsBtn.textContent = "⚔️ 同谱对战";
  const duoBtn = document.createElement("button");
  duoBtn.type = "button";
  duoBtn.className = "tt-open tt-open-duo";
  // 章节页签里也有「双人分轨」四个字,模式入口用「双人同屏」区分开
  duoBtn.textContent = "👫 双人同屏";
  bar.append(endlessBtn, vsBtn, duoBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽加速 · 最好 ${best} 分` : "♾️ 无尽加速 · 点我开始!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(
    make: (host: HTMLElement, api: GameApi, tones: ToneKit, back: () => void) => { destroy: () => void }
  ): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, tones, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  duoBtn.addEventListener("click", () => openMode(mountTwoPlayer));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel: playLevelWith(tones),
      mapHint: "音符压到判定线就点,空白格千万别碰;长按条要按住到尾。",
      grandMessage: "188 关全部弹完,四条轨都成了你的琴键!",
      guide: guideBook,
      guideTitle: "音符下落 · 手感手记",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      tones.close();
      root.remove();
    },
  };
}
