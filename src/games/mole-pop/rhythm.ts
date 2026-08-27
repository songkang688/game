/**
 * 地鼠嘭嘭 · 1.2 打击判定与节奏层。
 *
 * 1.1 的地鼠是「随机间隔冒头、点到洞就算命中」；1.2 把两件事拆清楚：
 *  1. 时间线与判定窗口：钻出 120ms 内 = Perfect、停留期 = Good、缩回中 60ms 内 = 擦边；
 *  2. 谱面：每一关的出洞时间表 / 洞位 / 类型都由 seed 生成，可复现、可测试，
 *     后段靠节奏型（切分、连打、假动作）变化，而不是单纯把速度拧快。
 *
 * 这里全是纯函数与纯数据，不碰 DOM；index.ts 与单测共用同一份规则。
 * 关卡参数（levels.ts）一个字都没动，前 99 关的难度维持 1.1 的手感。
 */
import { mulberry32 } from "../level99";
import type { MoleLevel } from "./levels";

// ---------------------------------------------------------------------------
// 一只地鼠的时间线
// ---------------------------------------------------------------------------

/** 钻出的那一小段：这段时间里打中算 Perfect */
export const RISE_MS = 120;
/** 缩回过程：这段时间里还能擦边打到 */
export const DROP_MS = 60;

export type Judge = "perfect" | "good" | "graze" | "miss";

export interface MoleTimeline {
  /** 冒头的时刻（相对本关开始，毫秒） */
  riseAt: number;
  /** 钻出结束、进入停留期 */
  stayAt: number;
  /** 开始往回缩 */
  dropAt: number;
  /** 完全缩回去，之后再点就点空 */
  goneAt: number;
}

/** 一只地鼠从冒头到缩回的完整时间线（upMs = 停留期长度） */
export function moleTimeline(riseAt: number, upMs: number): MoleTimeline {
  const stay = Math.max(0, upMs);
  return {
    riseAt,
    stayAt: riseAt + RISE_MS,
    dropAt: riseAt + RISE_MS + stay,
    goneAt: riseAt + RISE_MS + stay + DROP_MS,
  };
}

/**
 * 打下去这一下算哪一档。
 * elapsed = 从地鼠冒头算起过了多少毫秒；upMs = 这只地鼠的停留期。
 * 早于 0（还没冒头）与晚于「缩回完」都算 miss。
 */
export function judgeHit(elapsed: number, upMs: number): Judge {
  if (!Number.isFinite(elapsed) || elapsed < 0) return "miss";
  const t = moleTimeline(0, upMs);
  if (elapsed < t.stayAt) return "perfect";
  if (elapsed < t.dropAt) return "good";
  if (elapsed < t.goneAt) return "graze";
  return "miss";
}

/** 三档判定各自的分数倍率（无尽记分用） */
export const JUDGE_SCORE: Record<Judge, number> = { perfect: 3, good: 2, graze: 1, miss: 0 };

/** 判定档的中文名，给提示条用 */
export const JUDGE_LABEL: Record<Judge, string> = {
  perfect: "Perfect 出洞就中",
  good: "Good 稳稳一锤",
  graze: "擦边够到了",
  miss: "这一下点空了",
};

/** 无尽的分数：底分 × 判定倍率 */
export function hitScore(judge: Judge, base: number): number {
  return Math.max(0, Math.round(base)) * JUDGE_SCORE[judge];
}

/**
 * 闯关的计数：只要打中就按底分算，和 1.1 一样。
 * 判定档只影响演出、连击与无尽分数，不动 188 关的过关线。
 */
export function hitPoints(judge: Judge, base: number): number {
  return judge === "miss" ? 0 : Math.max(0, Math.round(base));
}

// ---------------------------------------------------------------------------
// 角色体系
// ---------------------------------------------------------------------------

export type MoleKind = "normal" | "sleepy" | "gold" | "bunny" | "shield" | "quiz" | "hat" | "flash" | "swarm";

export interface MoleSpec {
  emoji: string;
  /** 给孩子看的名字（全是本作原创角色） */
  name: string;
  /** 要敲几下才倒 */
  hits: number;
  /** 打中的底分 */
  base: number;
  /** 停留期相对本关基准的倍率 */
  stayScale: number;
  /** 能不能打（花花兔不能） */
  hittable: boolean;
}

export const MOLE_SPECS: Record<MoleKind, MoleSpec> = {
  normal: { emoji: "🐹", name: "普通鼠", hits: 1, base: 1, stayScale: 1, hittable: true },
  sleepy: { emoji: "😴", name: "瞌睡鼠", hits: 1, base: 1, stayScale: 1.8, hittable: true },
  gold: { emoji: "🌟", name: "金地鼠", hits: 1, base: 2, stayScale: 1, hittable: true },
  bunny: { emoji: "🌷", name: "花花兔", hits: 0, base: 0, stayScale: 1.4, hittable: false },
  shield: { emoji: "🪖", name: "铁盔鼠", hits: 2, base: 2, stayScale: 1.9, hittable: true },
  quiz: { emoji: "🧮", name: "算式鼠", hits: 1, base: 1, stayScale: 1.15, hittable: true },
  hat: { emoji: "🎩", name: "帽子鼠", hits: 2, base: 2, stayScale: 1.6, hittable: true },
  flash: { emoji: "✨", name: "闪光鼠", hits: 1, base: 3, stayScale: 0.55, hittable: true },
  swarm: { emoji: "🐹", name: "群鼠", hits: 1, base: 1, stayScale: 0.9, hittable: true },
};

/** 打到花花兔时的处理：扣一分（不会扣成负数）＋一句温和的话 */
export const BUNNY_TEXT = "哎呀，那是花花兔，它不参加游戏～";

export function bunnyPenalty(score: number): number {
  return Math.max(0, Math.round(score) - 1);
}

/** 闪光鼠只在自己的短停留期里算高分，缩回后就飞走了 */
export function flashStayMs(baseUpMs: number): number {
  return Math.max(260, Math.round(baseUpMs * MOLE_SPECS.flash.stayScale));
}

// ---------------------------------------------------------------------------
// 连击
// ---------------------------------------------------------------------------

/** 连击倍率封顶（再连也不会超过这个数，免得后段一发入魂） */
export const COMBO_CAP = 4;
/** 每连中几只涨一级倍率 */
export const COMBO_STEP = 3;

/** 连击倍率：连中越多越高，但有封顶；打错 / 漏打后 streak 归零自然回到 1 倍 */
export function comboMultiplier(streak: number, cap: number = COMBO_CAP): number {
  const s = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  return Math.min(Math.max(1, cap), 1 + Math.floor(s / COMBO_STEP));
}

/** 连击断掉：打错、漏打都归零 */
export function breakCombo(): number {
  return 0;
}

// ---------------------------------------------------------------------------
// 谱面
// ---------------------------------------------------------------------------

export interface ChartNote {
  /** 冒头时刻（相对本关开始，毫秒） */
  at: number;
  /** 第几个洞（0..8） */
  hole: number;
  kind: MoleKind;
  /** 停留期（毫秒，已经乘过角色的 stayScale） */
  upMs: number;
}

export interface RhythmPattern {
  key: string;
  name: string;
  /** 一小节里各只地鼠的出洞时刻，单位是「一个基准间隔」 */
  offsets: readonly number[];
  /** 这一小节占几个基准间隔 */
  span: number;
}

/**
 * 四种节奏型。后段章节靠它们变花样：
 * 平稳 → 切分（错开半拍）→ 连打（挤在一起）→ 假动作（先来一只不能打的，再补真的）。
 */
export const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  { key: "steady", name: "平稳", offsets: [0, 1, 2, 3], span: 4 },
  { key: "syncopa", name: "切分", offsets: [0, 0.75, 1.75, 2.5], span: 4 },
  { key: "burst", name: "连打", offsets: [0, 0.28, 0.56, 2], span: 4 },
  { key: "fake", name: "假动作", offsets: [0, 0.9, 1.1, 2.4], span: 4 },
];

/** 第 index 关（0 基）能用到的节奏型：越靠后花样越多，第 1 关只有平稳 */
export function patternsFor(index: number): RhythmPattern[] {
  const n = Math.max(0, Math.round(index));
  if (n < 8) return RHYTHM_PATTERNS.slice(0, 1);
  if (n < 30) return RHYTHM_PATTERNS.slice(0, 2);
  if (n < 70) return RHYTHM_PATTERNS.slice(0, 3);
  return RHYTHM_PATTERNS.slice();
}

/** 按本关的占比表抽一只地鼠的类型（假动作小节固定先来一只花花兔） */
export function rollKind(cfg: MoleLevel, rand: () => number, allowBunny = true): MoleKind {
  if (cfg.quizChance && rand() < cfg.quizChance) return "quiz";
  const bunny = allowBunny ? cfg.bunnyChance : 0;
  const gold = cfg.goldChance;
  const sleepy = cfg.sleepyChance;
  const shield = cfg.shieldChance ?? 0;
  const r = rand();
  if (r < bunny) return "bunny";
  if (r < bunny + gold) return "gold";
  if (r < bunny + gold + sleepy) return "sleepy";
  if (r < bunny + gold + sleepy + shield) return "shield";
  // 1.2 新角色：帽子鼠与闪光鼠从中后段开始零星出现，占比很小，不动老关卡的过关线
  if (r < bunny + gold + sleepy + shield + 0.06) return "hat";
  if (r < bunny + gold + sleepy + shield + 0.1) return "flash";
  return "normal";
}

/** 一只地鼠的停留期：本关基准 × 角色倍率 */
export function stayMsFor(cfg: MoleLevel, kind: MoleKind, rand: () => number): number {
  const lo = Math.max(200, cfg.upMsMin);
  const hi = Math.max(lo + 60, cfg.upMsMax);
  const base = lo + rand() * (hi - lo);
  return Math.round(base * MOLE_SPECS[kind].stayScale);
}

/**
 * 生成一关的谱面：出洞时间表 + 洞位 + 类型。
 * 同一个 (cfg, seed) 一定得到同一张谱面，单测直接比对。
 */
export function buildChart(cfg: MoleLevel, seed: number, index = 0): ChartNote[] {
  const rand = mulberry32(seed >>> 0);
  const patterns = patternsFor(index);
  const gap = Math.max(240, cfg.gapMs);
  const totalMs = Math.max(1000, cfg.duration * 1000);
  const notes: ChartNote[] = [];
  let cursor = 320;
  let lastHole = -1;
  let guard = 0;

  while (cursor < totalMs && guard++ < 400) {
    const pattern = patterns[Math.floor(rand() * patterns.length) % patterns.length];
    for (let i = 0; i < pattern.offsets.length; i++) {
      const at = Math.round(cursor + pattern.offsets[i] * gap);
      if (at >= totalMs - 200) break;
      // 假动作：这一小节的第一只固定是花花兔（有花花兔的关才用得上）
      const fake = pattern.key === "fake" && i === 0 && cfg.bunnyChance > 0;
      const kind = fake ? "bunny" : rollKind(cfg, rand, !fake);
      let hole = Math.floor(rand() * 9);
      if (hole === lastHole) hole = (hole + 1 + Math.floor(rand() * 8)) % 9;
      lastHole = hole;
      notes.push({ at, hole, kind, upMs: stayMsFor(cfg, kind, rand) });
    }
    cursor += pattern.span * gap;
  }

  notes.sort((a, b) => a.at - b.at || a.hole - b.hole);
  return capConcurrency(notes, cfg.maxConcurrent);
}

/**
 * 谱面限流：同一时刻最多允许 max 只地鼠在台面上，多出来的那些直接不排。
 * 这样谱面自己就守住了 1.1 的 `maxConcurrent`，不用等运行时再丢。
 */
export function capConcurrency(chart: readonly ChartNote[], max: number): ChartNote[] {
  const limit = Math.max(1, Math.round(max) || 1);
  const kept: ChartNote[] = [];
  for (const note of [...chart].sort((a, b) => a.at - b.at || a.hole - b.hole)) {
    const mine = moleTimeline(note.at, note.upMs);
    const overlapping = kept.filter((k) => {
      const other = moleTimeline(k.at, k.upMs);
      return k.at < mine.goneAt && other.goneAt > note.at;
    });
    if (overlapping.length >= limit) continue;
    // 同一个洞不能同时站两只
    if (overlapping.some((k) => k.hole === note.hole)) continue;
    kept.push(note);
  }
  return kept;
}

/** 一次「群鼠」同刻冒几只 */
export const SWARM_SIZE = 3;

/**
 * 把「群鼠」展开成同一时刻的三只（洞位互不重叠）。
 * 分开写是为了让谱面本身保持简洁，也方便单测直接验展开结果。
 */
export function expandSwarms(chart: readonly ChartNote[]): ChartNote[] {
  const out: ChartNote[] = [];
  for (const note of chart) {
    if (note.kind !== "swarm") {
      out.push(note);
      continue;
    }
    for (let k = 0; k < SWARM_SIZE; k++) {
      out.push({ ...note, kind: "normal", hole: (note.hole + k * 3) % 9 });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.hole - b.hole);
}

/** 每隔几小节塞一次群鼠：波数越大越常见，但至少隔两小节 */
export function withSwarms(chart: readonly ChartNote[], every: number): ChartNote[] {
  const step = Math.max(2, Math.round(every));
  const out = chart.map((n, i) => (i > 0 && i % step === 0 && n.kind === "normal" ? { ...n, kind: "swarm" as MoleKind } : n));
  return expandSwarms(out);
}

/** 这张谱面最多能打出多少分（闯关计数口径：花花兔不算） */
export function chartMaxPoints(chart: readonly ChartNote[]): number {
  return chart.reduce((n, note) => n + (MOLE_SPECS[note.kind].hittable ? MOLE_SPECS[note.kind].base : 0), 0);
}

/** 同一时刻最多同时冒出几只（扫描线，校验谱面别把洞挤爆） */
export function maxConcurrentOf(chart: readonly ChartNote[]): number {
  const events: Array<{ t: number; d: number }> = [];
  for (const note of chart) {
    const t = moleTimeline(note.at, note.upMs);
    events.push({ t: note.at, d: 1 }, { t: t.goneAt, d: -1 });
  }
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  let cur = 0;
  let most = 0;
  for (const e of events) {
    cur += e.d;
    most = Math.max(most, cur);
  }
  return most;
}

// ---------------------------------------------------------------------------
// 无尽「地鼠夜市」
// ---------------------------------------------------------------------------

/** 夜市第 wave 波的摊位名（越逛越热闹） */
export const NIGHT_MARKET_STALLS = ["糖画摊", "灯笼摊", "面人摊", "陶哨摊", "星糖摊"];

export function nightMarketStall(wave: number): string {
  const n = Math.max(1, Math.round(wave) || 1);
  return NIGHT_MARKET_STALLS[Math.floor((n - 1) / 3) % NIGHT_MARKET_STALLS.length];
}

/**
 * 夜市第 wave 波的谱面：密度与节奏型都随波次渐进，群鼠越来越常来。
 * seeded，同一 (wave, seed) 可复现。
 */
export function nightMarketChart(cfg: MoleLevel, wave: number, seed: number): ChartNote[] {
  const n = Math.max(1, Math.round(wave) || 1);
  const chart = buildChart(cfg, seed >>> 0, 40 + n * 6);
  // 群鼠是同刻三只：台面预算不到三只的早期波次先不塞，
  // 否则生成出来也会被运行时按 maxConcurrent 丢掉，等于白排。
  const swarmed =
    cfg.maxConcurrent >= SWARM_SIZE ? withSwarms(chart, Math.max(3, 10 - Math.floor(n / 2))) : chart;
  // 展开完再限一次流：谱面写成什么样，台上就演什么样；同一个洞也不会挤两只。
  return capConcurrency(swarmed, cfg.maxConcurrent);
}

/** 夜市收摊时的一句话（只鼓励） */
export function nightMarketLine(wave: number, best: number): string {
  if (wave <= 0) return "夜市才刚开张，热热身再逛一趟，节奏很快就跟上了！";
  if (wave > best) return `新纪录！你在地鼠夜市连守了 ${wave} 摊！`;
  return `这趟守住 ${wave} 摊，最好纪录是 ${best} 摊。跟着鼓点走，下一趟准能追上！`;
}

// ---------------------------------------------------------------------------
// 定时器口袋：这类游戏最容易漏掉 setTimeout，统一登记统一收
// ---------------------------------------------------------------------------

export interface TimerHost {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

/** 默认用全局定时器；单测传一个假的进来就能数「还剩几个没清」 */
export function globalTimerHost(): TimerHost {
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>),
    setInterval: (fn, ms) => setInterval(fn, ms) as unknown as number,
    clearInterval: (id) => clearInterval(id as unknown as ReturnType<typeof setInterval>),
  };
}

/** 所有 setTimeout / setInterval 都从这里过一手，destroy 时一次收干净 */
export class TimerBag {
  private timeouts = new Set<number>();
  private intervals = new Set<number>();

  constructor(private host: TimerHost = globalTimerHost()) {}

  after(fn: () => void, ms: number): number {
    const id = this.host.setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, ms);
    this.timeouts.add(id);
    return id;
  }

  every(fn: () => void, ms: number): number {
    const id = this.host.setInterval(fn, ms);
    this.intervals.add(id);
    return id;
  }

  /** 还挂着几个定时器（destroy 后必须是 0） */
  get size(): number {
    return this.timeouts.size + this.intervals.size;
  }

  clearAll(): void {
    for (const id of this.timeouts) this.host.clearTimeout(id);
    for (const id of this.intervals) this.host.clearInterval(id);
    this.timeouts.clear();
    this.intervals.clear();
  }
}
