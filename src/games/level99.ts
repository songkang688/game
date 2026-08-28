/**
 * 「一朵一星」188 关通用框架（休闲 / 对战 / 学习游戏共用）。
 *
 * 1.1 起总关卡数从 99 提升到 188，文件名与存档 key 一律保持 `l99` 不变，
 * 老玩家的长度 99 存档读出来会自动补 0 到 188，前 99 位原样保留。
 *
 * 提供六件事：
 *  1. 章节定义与工具：≥6 个主题章节，章节大小之和恒等于 188（`assertTotal`）；
 *  2. 每关星级进度存档（localStorage，独立于平台钱包存档）；
 *  3. 家长授权后的「跳关」标记（并存的小数组 `yiduo-yixing.l99skip.<id>`）；
 *  4. 选关地图 UI：章节分页 + 跳到当前关 + 窄屏自适应 + 键盘可达；
 *  5. 攻略 / 跳关入口：来自 `src/ui/level188Contract.ts` 的运行时注册表，没注册就自动隐藏；
 *  6. 胜负结算：过关最多 3 星、失败温柔鼓励并可"重试本关"。
 *
 * 各游戏只需提供 chapters 与 playLevel(stage, ctx)，其余交给框架。
 * 本文件不在游戏子目录内，不会被 loader 的 import.meta.glob 收集。
 */
import { AVATAR_URLS } from "../ui/avatars";
import { isGuardedClick } from "../ui/dialogs";
import { getLevelExtras, type GuideBook } from "../ui/level188Contract";
// 契约文件只有常量与纯逻辑,没有弹窗 UI,静态 import 不会把 dialog 代码拖进游戏 chunk
import { clampJumpTarget, isRootOpen, isRootPermanent, rootRemainMinutes, rootRemainMs, rootStatusLine } from "../ui/root12Contract";
import { speak, stopSpeaking } from "./speech";

export type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/** 每个游戏固定 188 关（1.1 起） */
export const TOTAL_LEVELS = 188;

/** 1.0 时代的关卡总数：只用于存档迁移与回归测试，不要拿它当上限 */
export const LEGACY_TOTAL_LEVELS = 99;

/** 188 关全三星的满星数 */
export const MAX_TOTAL_STARS = TOTAL_LEVELS * 3;

export interface Chapter {
  /** 主题章节名，例如「冰雪山谷」 */
  name: string;
  emoji: string;
  /** 章节主色（粉彩），用于地图与关卡头部 */
  color: string;
  /** 一句话介绍本章的主题 / 新玩法 */
  desc: string;
  /** 本章包含的关卡数，所有章节之和必须是 188 */
  size: number;
}

// ---------------------------------------------------------------------------
// 章节工具（纯函数，可测试）
// ---------------------------------------------------------------------------

/** 全部章节的关卡总数 */
export function totalSize(chapters: Chapter[]): number {
  return chapters.reduce((s, c) => s + c.size, 0);
}

/**
 * 校验章节切分：和不等于 expected 时在控制台报错并返回 false（不抛异常）。
 * 各游戏的 levels.test.ts 直接 `expect(assertTotal(CHAPTERS, 188)).toBe(true)` 即可。
 */
export function assertTotal(chapters: Chapter[], expected: number = TOTAL_LEVELS, label = "chapters"): boolean {
  const got = totalSize(chapters);
  if (got === expected) return true;
  console.error(`[一朵一星] ${label} 章节大小之和是 ${got}，应为 ${expected}；已降级到实际总数继续运行。`);
  return false;
}

/** 章节和异常时框架实际使用的总关数（至少 1 关，保证不白屏） */
export function effectiveTotal(chapters: Chapter[]): number {
  return Math.max(1, totalSize(chapters));
}

/** level（0 基）所属章节的下标 */
export function chapterOf(chapters: Chapter[], level: number): number {
  let acc = 0;
  for (let i = 0; i < chapters.length; i++) {
    acc += chapters[i].size;
    if (level < acc) return i;
  }
  return chapters.length - 1;
}

/** 章节 ci 的第一关（0 基） */
export function chapterStart(chapters: Chapter[], ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += chapters[i].size;
  return acc;
}

/** level 在其章节内的序号（0 基） */
export function indexInChapter(chapters: Chapter[], level: number): number {
  return level - chapterStart(chapters, chapterOf(chapters, level));
}

/** 章节 ci 覆盖的关卡区间（1 基，含两端），给地图分页页眉用 */
export function chapterRange(chapters: Chapter[], ci: number): { from: number; to: number } {
  const start = chapterStart(chapters, ci);
  return { from: start + 1, to: start + Math.max(0, chapters[ci]?.size ?? 0) };
}

/** 选关地图每行格子数：窄屏少放几个，免得 188 个格子挤成一坨 */
export function mapColumns(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 5;
  if (width <= 320) return 4;
  if (width <= 420) return 5;
  if (width <= 560) return 6;
  if (width <= 760) return 7;
  return 8;
}

/**
 * 竞技场画布逻辑高按壳卡缺口等比补足(trio-r4 遗留的 orb-arena / snake-royale 卡底留白)。
 * 画布显示宽被容器定死(width:100%),只能改逻辑高来消化竖向缺口;
 * gapPx<0(矮横屏内容溢出)时也允许收一点。钳在 [min(原高,240), 960]:
 * 下限不许把并排/分屏原本更矮的画布反向抬高,上限防止竖屏拉成一根面条。
 */
export function fitPaneH(paneH: number, paneW: number, displayW: number, gapPx: number, rows: number): number {
  if (!(displayW > 0) || !(rows > 0) || !Number.isFinite(gapPx)) return paneH;
  const delta = (gapPx / rows) * (paneW / displayW);
  const lo = Math.min(paneH, 240);
  return Math.max(lo, Math.min(960, Math.round(paneH + delta)));
}

/**
 * 进关时量一次壳卡(.game-stage)底部缺口,把成排画布的逻辑高补足;
 * 拿不到壳卡或量不出宽(单测的 jsdom)就原样返回。rows 按画布 top 去重:
 * 竖排分屏各占一行要平分缺口,横排并排只算一行。
 */
export function fitPanesToStage(
  wrap: HTMLElement,
  canvases: HTMLCanvasElement[],
  paneW: number,
  paneH: number
): number {
  // 单测的 FakeEl/jsdom 没有 closest 或量不出尺寸,这些环境一律原样返回
  if (typeof wrap.closest !== "function") return paneH;
  const card = wrap.closest(".game-stage");
  const first = canvases[0];
  if (!card || !first || typeof first.getBoundingClientRect !== "function") return paneH;
  const displayW = first.getBoundingClientRect().width;
  if (!(displayW > 0)) return paneH;
  // 16px = 壳卡圆角边框 + l99-stage 内边距的呼吸量
  const gap = card.getBoundingClientRect().bottom - 16 - wrap.getBoundingClientRect().bottom;
  const rows = new Set(canvases.map((c) => Math.round(c.getBoundingClientRect().top))).size || 1;
  const fitted = fitPaneH(paneH, paneW, displayW, gap, rows);
  if (fitted !== paneH) for (const c of canvases) c.height = fitted;
  return fitted;
}

// ---------------------------------------------------------------------------
// 确定性随机（关卡生成器共用，保证同一关每次布局一致、可测试）
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 按「越小越好」的指标评星：value <= three 得 3 星，<= two 得 2 星，否则 1 星 */
export function rateBelow(value: number, three: number, two: number): 1 | 2 | 3 {
  if (value <= three) return 3;
  if (value <= two) return 2;
  return 1;
}

/** 按「越大越好」的指标评星：value >= three 得 3 星，>= two 得 2 星，否则 1 星 */
export function rateAbove(value: number, three: number, two: number): 1 | 2 | 3 {
  if (value >= three) return 3;
  if (value >= two) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 每关星级进度存档
// ---------------------------------------------------------------------------

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      const probe = "yiduo-yixing.l99.probe";
      ls.setItem(probe, "1");
      // 探测完就删,不在用户存储里留垃圾(也不混进导出的备份)
      ls.removeItem?.(probe);
      return ls;
    }
  } catch {
    // 隐私模式等场景：不持久化，进度只在本次会话内
  }
  return null;
}

const memoryFallback = new Map<string, string>();

function storageKey(gameId: string): string {
  return `yiduo-yixing.l99.${gameId}`;
}

/** 跳关标记 key：与星级存档并存，绝不动原来的 `yiduo-yixing.l99.<id>` */
function skipKey(gameId: string): string {
  return `yiduo-yixing.l99skip.${gameId}`;
}

function readRaw(key: string, store: StorageLike | null): string | null {
  try {
    return store ? store.getItem(key) : memoryFallback.get(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string, store: StorageLike | null): void {
  try {
    if (store) store.setItem(key, raw);
    else memoryFallback.set(key, raw);
  } catch {
    // 存不进去也不影响继续玩
  }
}

/**
 * 把任意来源的存档值整理成长度 188 的星级数组（纯函数，便于测试）：
 * 老的长度 99 数组后面补 0、前 99 位原样保留；超长截断；非数组 / 非数字一律当 0。
 */
export function migrateStars(parsed: unknown): number[] {
  const out = new Array<number>(TOTAL_LEVELS).fill(0);
  if (!Array.isArray(parsed)) return out;
  for (let i = 0; i < TOTAL_LEVELS && i < parsed.length; i++) {
    const v: unknown = parsed[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[i] = Math.max(0, Math.min(3, Math.round(v)));
    }
  }
  return out;
}

/** 读取某游戏 188 关的星级数组（每项 0..3，0 表示未通过） */
export function loadStars(gameId: string, storage?: StorageLike | null): number[] {
  const store = storage === undefined ? defaultStorage() : storage;
  const raw = readRaw(storageKey(gameId), store);
  if (!raw) return new Array<number>(TOTAL_LEVELS).fill(0);
  try {
    return migrateStars(JSON.parse(raw) as unknown);
  } catch {
    // 数据坏了就当作全新进度
    return new Array<number>(TOTAL_LEVELS).fill(0);
  }
}

/** 记录某关星级（保留历史最好成绩），返回最新的星级数组 */
export function saveStar(
  gameId: string,
  level: number,
  stars: number,
  storage?: StorageLike | null
): number[] {
  const store = storage === undefined ? defaultStorage() : storage;
  const arr = loadStars(gameId, store);
  if (Number.isFinite(level) && level >= 0 && level < TOTAL_LEVELS) {
    const idx = Math.round(level);
    arr[idx] = Math.max(arr[idx], Math.max(0, Math.min(3, Math.round(stars))));
  }
  writeRaw(storageKey(gameId), JSON.stringify(arr), store);
  return arr;
}

// ---------------------------------------------------------------------------
// 跳关标记（家长授权后才会写；星级仍记 0，只负责解锁后面的关）
// ---------------------------------------------------------------------------

/** 把任意来源的跳关值整理成「升序去重的 0 基关号数组」（纯函数，便于测试） */
export function migrateSkips(parsed: unknown): number[] {
  if (!Array.isArray(parsed)) return [];
  const set = new Set<number>();
  for (const v of parsed as unknown[]) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const idx = Math.round(v);
    if (idx >= 0 && idx < TOTAL_LEVELS) set.add(idx);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** 读取某游戏被跳过的关号（0 基，升序） */
export function loadSkips(gameId: string, storage?: StorageLike | null): number[] {
  const store = storage === undefined ? defaultStorage() : storage;
  const raw = readRaw(skipKey(gameId), store);
  if (!raw) return [];
  try {
    return migrateSkips(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** 标记某关「已跳过」（幂等），返回最新的跳关数组 */
export function markSkipped(gameId: string, level: number, storage?: StorageLike | null): number[] {
  const store = storage === undefined ? defaultStorage() : storage;
  const next = migrateSkips([...loadSkips(gameId, store), level]);
  writeRaw(skipKey(gameId), JSON.stringify(next), store);
  return next;
}

/** 清空某游戏的跳关记录（家长面板用） */
export function clearSkips(gameId: string, storage?: StorageLike | null): void {
  const store = storage === undefined ? defaultStorage() : storage;
  writeRaw(skipKey(gameId), "[]", store);
}

/** 某关是否被跳过 */
export function isSkipped(skips: readonly number[], level: number): boolean {
  return skips.includes(level);
}

/** 已通关数（真打过的，跳过的不算） */
export function clearedCount(stars: number[]): number {
  return stars.filter((s) => s > 0).length;
}

/** 已推进的关数：真通关 + 家长授权跳过的 */
export function reachedCount(stars: number[], skips: readonly number[] = []): number {
  let n = 0;
  for (let i = 0; i < stars.length; i++) {
    if (stars[i] > 0 || isSkipped(skips, i)) n++;
  }
  return n;
}

/** 全部关卡累计星数（满分 564） */
export function totalStars(stars: number[]): number {
  return stars.reduce((a, b) => a + b, 0);
}

/**
 * 当前可以玩到的最远关卡（0 基）：第一个既没通过、也没被跳过的关；
 * 全部推进完就停在最后一关。total 允许传入实际总关数（章节和异常时的降级值）。
 */
export function furthestPlayable(
  stars: number[],
  skips: readonly number[] = [],
  total: number = TOTAL_LEVELS
): number {
  const max = Math.max(1, Math.min(total, TOTAL_LEVELS));
  for (let i = 0; i < max; i++) {
    if (stars[i] <= 0 && !isSkipped(skips, i)) return i;
  }
  return max - 1;
}

// ---------------------------------------------------------------------------
// 选关地图 + 结算 UI
// ---------------------------------------------------------------------------

export interface PlayCtx {
  /** 当前关（0 基，0..187） */
  level: number;
  chapter: Chapter;
  chapterIndex: number;
  /** 本关在章节内的序号（0 基） */
  indexInChapter: number;
  /** 本关此前被家长授权跳过过（重玩时给个温柔的提示，不批评） */
  skipped?: boolean;
  /** 过关：报告 1..3 星与一句夸奖 */
  win: (stars: 1 | 2 | 3, msg?: string) => void;
  /** 失败：报告一句温柔的话，框架会给「再试本关」按钮 */
  lose: (msg?: string) => void;
  sfx: (name: SoundName) => void;
  /** 给平台钱包加小星星（连击奖励等，少量使用） */
  bonusStars: (n: number) => void;
}

export interface PlayHandle {
  destroy?: () => void;
}

export interface LevelGameOptions {
  /** 游戏 id（存档 key 用，必须与 meta.id 一致） */
  id: string;
  chapters: Chapter[];
  /** 挂载并开始某一关。返回的 destroy 会在离开该关时调用 */
  playLevel: (stage: HTMLElement, ctx: PlayCtx) => PlayHandle | void;
  /** 地图底部的一句话提示 */
  mapHint?: string;
  /** 全部 188 关通关后的庆祝语（走平台 onWin） */
  grandMessage?: string;
  /** 攻略数据；不给就按章节自动生成一份「只讲方法」的通用攻略 */
  guide?: GuideBook;
  /** 攻略面板标题（不给 guide 时用来生成兜底攻略） */
  guideTitle?: string;
}

const WIN_WORDS = ["太棒啦！", "好厉害！", "真会动脑筋！", "漂亮！", "你做到啦！"];
const LOSE_WORDS = [
  "差一点点啦，再来一次一定行！",
  "没关系，慢慢来，你可以的！",
  "就快成功了，深呼吸再试试～",
  "小挫折不算什么，加油！"
];

/**
 * 结算浮层要朗读的整句话（鼓励语靠听，识字量不够时也能懂）。
 * 纯函数便于测试；朗读本身走 speech.ts，无语音包时静默降级。
 */
export function settleSpeechLine(kind: "win" | "lose", level: number, msg: string): string {
  return kind === "win" ? `第 ${level + 1} 关过关！${msg}` : `就差一点点！${msg}`;
}

// ---------------------------------------------------------------------------
// 管理员权限：直达第 N 关（纯判定，便于测试；DOM 由 attachRootJump 照着画）
// ---------------------------------------------------------------------------

/** 直达控件该不该出现：管理员权限开着才出现，关着 / 过期时连 DOM 都不生成 */
export function rootJumpVisible(nowMs: number = Date.now()): boolean {
  return isRootOpen(nowMs);
}

/** 跳关还要不要做算术题：管理员权限开着就免了，关着时仍旧走 1.1 的家长门 */
export function skipNeedsParentAuth(nowMs: number = Date.now()): boolean {
  return !isRootOpen(nowMs);
}

/**
 * 输入框里的「第 N 关」→ 框架内部的 0 基关号。
 * 越界夹到 1..total，读不出数字返回 null（调用方原地不动，绝不抛异常、绝不白屏）。
 */
export function jumpTargetLevel(raw: string, total: number = TOTAL_LEVELS): number | null {
  const max = Number.isFinite(total) && total >= 1 ? Math.min(Math.floor(total), TOTAL_LEVELS) : 1;
  const n = clampJumpTarget(raw, max);
  return n === null ? null : n - 1;
}

/**
 * 直达控件旁边那行小字（N-38）。
 * 永久开启走 rootStatusLine，不再把远未来时间戳换算成「4193047370 分钟」。
 * 限时态仍报剩余分钟，文案格式与修前一致。
 */
export function rootJumpNote(remainMs: number, nowMs: number = Date.now()): string {
  if (isRootPermanent(nowMs)) return rootStatusLine(nowMs);
  return `管理员权限还剩 ${rootRemainMinutes(remainMs)} 分钟`;
}

/** 选关格子的无障碍标签（读屏与键盘用户靠它区分状态） */
export function nodeAriaLabel(level: number, stars: number, state: "locked" | "skipped" | "open"): string {
  const n = level + 1;
  if (state === "locked") return `第 ${n} 关，还没解锁`;
  if (state === "skipped") return `第 ${n} 关，已跳过，可以回来挑战`;
  if (stars > 0) return `第 ${n} 关，已通关 ${stars} 星`;
  return `第 ${n} 关，还没通关`;
}

/**
 * 没有专属攻略数据时，按章节自动拼一份「只讲方法、不给答案」的攻略。
 * 纯函数便于测试；具体游戏的细则由后续步骤补 `guide` 字段覆盖。
 */
export function buildFallbackGuide(gameId: string, chapters: Chapter[], title?: string): GuideBook {
  return {
    gameId,
    title: title ?? "闯关小攻略",
    general: [
      "先看清这一关要达成什么目标，再动手，别急着乱点。",
      "卡住的时候把关卡拆成两三个小步骤，一步一步过。",
      "同一关可以重玩，多试几种顺序，找到最省步数的那条路。",
      "手感类关卡先慢后快：稳住节奏，命中率上来了速度自然就快。"
    ],
    entries: chapters.map((ch, ci) => {
      const { from, to } = chapterRange(chapters, ci);
      return {
        from,
        to,
        title: `${ch.emoji} ${ch.name}`,
        tips: [ch.desc || "这一章的重点是熟悉新机制，先摸清规则再冲成绩。", `本章覆盖第 ${from}–${to} 关，难度是逐关往上走的。`]
      };
    })
  };
}

/**
 * 12×12 内联 SVG 星形(S-2):以前是 ★ 字符,10–12px 时只剩一团糊点。
 * 宽高用 1em 跟着容器 font-size 走,节点格 12px、关内顶栏 14px、结算页 34px 三处共用;
 * fill 走 currentColor,亮灭仍由 .l99-star / .l99-star-on 的 color 决定,双态对比不变。
 */
const STAR_SVG =
  `<svg viewBox="0 0 12 12" width="1em" height="1em" aria-hidden="true" focusable="false">` +
  `<path fill="currentColor" d="M6 .6 7.5 4l3.9.3-3 2.6.9 3.9L6 8.7l-3.3 2.1.9-3.9-3-2.6L4.5 4Z"/></svg>`;

export function starRowHTML(stars: number): string {
  let s = "";
  for (let i = 0; i < 3; i++) {
    s += `<span class="l99-star${i < stars ? " l99-star-on" : ""}" aria-hidden="true">${STAR_SVG}</span>`;
  }
  return s;
}

const L99_CSS = `
.l99-wrap{max-width:680px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  user-select:none;-webkit-user-select:none;position:relative;width:100%;height:100%;min-height:0;
  display:flex;flex-direction:column;box-sizing:border-box;}
.l99-view{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;
  overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.l99-map{border-radius:20px;padding:14px;background:linear-gradient(180deg,#FFF7FB,#F0F4FF);
  flex:0 0 auto;box-sizing:border-box;max-width:100%;}
.l99-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
/* 「🚩 0/188 关」「⭐ 0/564」是孩子要读的进度,不是按钮也不是格子数字,按正文 16px 走 */
.l99-chip{background:#fff;border-radius:999px;padding:6px 12px;font-weight:800;font-size:16px;
  line-height:1.4;color:#7a5da8;box-shadow:0 2px 6px rgba(150,130,200,.2);}
.l99-chip-skip{color:#6d6580;background:#efedf5;}
.l99-continue{border:none;border-radius:999px;padding:8px 16px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 4px 0 #8f2c5c;font-family:inherit;}
.l99-continue:active{transform:translateY(2px);box-shadow:0 2px 0 #8f2c5c;}
.l99-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;margin:0 0 8px;}
.l99-tool{border:none;border-radius:999px;padding:7px 14px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#5f4a8a;box-shadow:0 3px 0 rgba(120,90,160,.22);white-space:nowrap;}
.l99-tool:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.22);}
.l99-tool-skip{background:#efe9fb;color:#665390;}
.l99-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:4px 2px 8px;max-width:100%;}
.l99-tab{flex:0 0 auto;border:none;border-radius:14px;padding:8px 12px;font-size:14px;font-weight:800;cursor:pointer;
  background:#ffffffb0;color:#6b6b7e;box-shadow:0 2px 5px rgba(140,130,180,.15);font-family:inherit;white-space:nowrap;}
.l99-tab.l99-tab-on{color:#5a4a80;outline:3px solid #ffffff;box-shadow:0 3px 8px rgba(140,120,200,.3);}
.l99-tab.l99-tab-lock{opacity:.55;}
/* 下面几行都是讲给孩子听的说明文字,按 mobileText.MIN_BODY_PX 走 16px:
   360px 手机上量过,13px / 12px 的小字在选关地图里根本看不清。 */
.l99-chapdesc{font-size:16px;line-height:1.45;font-weight:700;color:#77619b;text-align:center;
  margin:2px 0 4px;min-height:22px;overflow-wrap:anywhere;word-break:break-word;}
.l99-pagehint{font-size:16px;line-height:1.45;font-weight:700;color:#8d7bab;text-align:center;margin:0 0 10px;}
.l99-flash{font-size:16px;line-height:1.45;font-weight:800;color:#5f6f9b;text-align:center;margin:0 0 8px;}
.l99-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.l99-node{aspect-ratio:1;border:none;border-radius:16px;cursor:pointer;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;background:#fff;box-shadow:0 3px 8px rgba(140,130,190,.18);
  font-family:inherit;padding:0;}
.l99-node:active{transform:scale(.94);}
.l99-node-num{font-size:17px;font-weight:900;color:#6b5a90;line-height:1;}
/* 星是 1em 的 SVG(见 STAR_SVG):这里的 font-size 就是星的边长,12px 起步别再往下压 */
.l99-node-stars{font-size:12px;line-height:1;display:inline-flex;gap:2px;}
.l99-star{color:#e3ddef;display:inline-flex;}
.l99-star svg{display:block;}
.l99-star-on{color:#ffb937;filter:drop-shadow(0 1px 1px rgba(200,120,0,.35));}
.l99-node-cur{outline:3px solid #ff8fc0;animation:l99pulse 1.4s ease infinite;}
.l99-node-cur .l99-node-num{color:#b52e72;}
@keyframes l99pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.l99-node-lock{background:#f2eef8;box-shadow:none;cursor:default;}
.l99-node-lock .l99-node-num{color:#c8bedd;font-size:14px;}
.l99-node-skip{background:#ecebf1;box-shadow:none;}
.l99-node-skip .l99-node-num{color:#8d85a3;}
.l99-node-flag{font-size:15px;line-height:1;filter:grayscale(1);opacity:.75;}
.l99-node:focus-visible,.l99-tab:focus-visible,.l99-tool:focus-visible,.l99-continue:focus-visible,
.l99-back:focus-visible,.l99-ov-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.l99-jump{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;}
.l99-jump-input{width:76px;min-height:44px;border:2px solid #e0d6f2;border-radius:12px;padding:0 8px;
  font-family:inherit;font-size:15px;font-weight:800;color:#5f4a8a;background:#fff;}
.l99-jump-note{font-size:16px;line-height:1.45;font-weight:700;color:#8d7bab;}
.l99-jump-input:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.l99-maphint{margin-top:12px;text-align:center;font-size:16px;line-height:1.45;font-weight:700;
  color:#77619b;overflow-wrap:anywhere;word-break:break-word;}
.l99-stage-wrap{border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(150,130,200,.18);
  flex:1 1 auto;min-height:0;display:flex;flex-direction:column;width:100%;}
.l99-stagebar{display:flex;align-items:center;gap:8px;padding:10px 12px;flex-wrap:wrap;flex:0 0 auto;}
.l99-back{border:none;border-radius:999px;padding:7px 12px;font-size:14px;font-weight:900;cursor:pointer;
  background:#ffffffd9;color:#7a5aa0;box-shadow:0 3px 0 rgba(120,90,160,.25);font-family:inherit;white-space:nowrap;}
.l99-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}
.l99-stagetitle{flex:1;text-align:center;font-size:15px;font-weight:900;color:#5c4a7d;}
.l99-beststars{font-size:14px;display:inline-flex;gap:2px;}
.l99-stage{padding:10px;flex:1 1 auto;min-height:0;overflow:hidden;display:flex;flex-direction:column;}
.l99-overlay{position:absolute;inset:0;background:rgba(255,250,253,.96);border-radius:20px;z-index:8;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;}
.l99-ov-big{font-size:56px;line-height:1;}
.l99-ov-buddy{width:104px;height:104px;object-fit:contain;pointer-events:none;
  filter:drop-shadow(0 6px 10px rgba(180,120,180,.28));animation:l99buddy .5s cubic-bezier(.34,1.56,.64,1);}
.l99-ov-buddy-round{border-radius:50%;border:3px solid #fff;object-fit:cover;width:84px;height:84px;
  box-shadow:0 5px 12px rgba(150,120,200,.3);}
@keyframes l99buddy{from{transform:scale(.3) rotate(-8deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
.l99-ov-stars{font-size:34px;display:flex;justify-content:center;gap:6px;}
.l99-ov-title{font-size:23px;font-weight:900;color:#8a5aa8;}
.l99-ov-sub{font-size:16px;font-weight:700;color:#77619b;line-height:1.6;max-width:320px;}
.l99-ov-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.l99-ov-btn{border:none;border-radius:18px;padding:12px 26px;font-size:17px;font-weight:900;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#c84483,#ad3a72);box-shadow:0 5px 0 #8f2c5c;font-family:inherit;}
.l99-ov-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #8f2c5c;}
.l99-ov-btn.l99-ov-ghost{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 5px 0 #34498a;}
.l99-ov-btn.l99-ov-ghost:active{box-shadow:0 2px 0 #34498a;}
@media (max-width:420px){
  .l99-map{padding:10px;}
  .l99-grid{gap:6px;}
  .l99-node-num{font-size:15px;}
}
@media (max-height:740px){
  .l99-stagebar{padding:6px 8px;gap:6px;}
  .l99-stagetitle{font-size:14px;}
  .l99-stage{padding:6px;}
  /* 矮屏只收外边距,字号不动:说明文字的 16px 红线(mobileText.test)矮屏也算数 */
  .l99-jump-note{font-size:16px;margin:0;}
  .l99-map{padding:10px;}
  .l99-head{margin-bottom:6px;}
}
/* N-37:管理员开启态才出现直达行。矮横屏把跳过/直达收成一行,小字藏起来,
   给 quiz 宿主让出抬头。root 关着没有 .l99-jump,:has 整段不生效,布局与修前一致。 */
@media (max-height:500px){
  .l99-stagebar:has(.l99-jump){padding:4px 8px;gap:4px;}
  .l99-stagebar:has(.l99-jump) .l99-tools{flex-wrap:nowrap;width:100%;justify-content:flex-start;
    overflow-x:auto;gap:6px;margin:0;}
  .l99-stagebar:has(.l99-jump) .l99-jump{flex-wrap:nowrap;gap:4px;}
  .l99-stagebar:has(.l99-jump) .l99-jump-note{display:none;}
  .l99-stagebar:has(.l99-jump) .l99-tool-skip{padding:6px 10px;font-size:13px;}
}
@media (prefers-reduced-motion:reduce){
  .l99-node-cur{animation:none;}
  .l99-ov-buddy{animation:none;}
}
`;

export function mountLevelGame(api: GameApi, opts: LevelGameOptions): { destroy: () => void } {
  // 章节和不等于 188 时只报错、不抛异常：降级到实际总数照常开玩，绝不白屏
  assertTotal(opts.chapters, TOTAL_LEVELS, opts.id);
  const total = effectiveTotal(opts.chapters);

  let destroyed = false;
  let stars = loadStars(opts.id);
  let skips = loadSkips(opts.id);
  let handle: PlayHandle | void = undefined;
  let currentLevel = -1;
  let settled = false;
  let flash = "";
  let viewChapter = chapterOf(opts.chapters, furthestPlayable(stars, skips, total));

  const guideBook = opts.guide ?? buildFallbackGuide(opts.id, opts.chapters, opts.guideTitle);
  const guideCleanups: Array<() => void> = [];

  const wrap = document.createElement("div");
  wrap.className = "l99-wrap";
  const style = document.createElement("style");
  style.textContent = L99_CSS;
  wrap.appendChild(style);
  const view = document.createElement("div");
  view.className = "l99-view";
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  function viewportWidth(): number {
    const w = (globalThis as { innerWidth?: number }).innerWidth;
    return typeof w === "number" && w > 0 ? w : 480;
  }

  const onResize = (): void => {
    const grid = view.querySelector(".l99-grid");
    if (grid && typeof (grid as HTMLElement).style !== "undefined") {
      (grid as HTMLElement).style.gridTemplateColumns = `repeat(${mapColumns(viewportWidth())},1fr)`;
    }
  };
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("resize", onResize);

  function dropGuides(): void {
    while (guideCleanups.length) {
      const fn = guideCleanups.pop();
      try {
        fn?.();
      } catch (err) {
        console.warn(`[一朵一星] ${opts.id} 攻略面板清理出错:`, err);
      }
    }
  }

  /** 攻略入口：壳层没注册 mountGuide 就什么都不挂（单测环境保持干净） */
  function attachGuide(host: HTMLElement, getLevel: () => number): void {
    const mount = getLevelExtras().mountGuide;
    if (!mount) return;
    try {
      const off = mount(host, guideBook, getLevel);
      if (typeof off === "function") guideCleanups.push(off);
    } catch (err) {
      console.warn(`[一朵一星] ${opts.id} 攻略面板挂载失败:`, err);
    }
  }

  /**
   * 跳关入口：壳层没注册 requestSkip 就不显示按钮。
   * 传给授权方的关号与框架内部一致，是 0 基的（家长弹窗自己 +1 后展示）。
   */
  /**
   * 直达第 N 关:只有管理员权限开着时才生成 DOM,关着 / 过期时连控件都不出现。
   * 直达一个没解锁的关允许开打,但星级数组一个字都不动 —— 没打过就是 0 星。
   */
  function attachRootJump(host: HTMLElement, getLevel: () => number): void {
    if (!rootJumpVisible()) return;
    const box = document.createElement("div");
    box.className = "l99-jump";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = String(total);
    input.className = "l99-jump-input";
    input.setAttribute("aria-label", `直达第几关,1 到 ${total}`);
    input.value = String(Math.min(total, getLevel() + 1));
    const go = document.createElement("button");
    go.type = "button";
    go.className = "l99-tool";
    go.textContent = "🎫 直达";
    const note = document.createElement("span");
    note.className = "l99-jump-note";
    note.textContent = rootJumpNote(rootRemainMs());
    const jump = (): void => {
      const target = jumpTargetLevel(input.value, total);
      if (target === null) return;
      input.value = String(target + 1);
      api.play("tap");
      // 只挪当前关，星级数组与跳关标记一个字都不写：没打过就是 0 星
      startLevel(target);
    };
    go.addEventListener("click", jump);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        jump();
      }
    });
    box.append(input, go, note);
    host.appendChild(box);
  }

  function attachSkip(host: HTMLElement, level: number, after: (level: number) => void): void {
    const request = getLevelExtras().requestSkip;
    const rootOn = !skipNeedsParentAuth();
    if ((!request && !rootOn) || level >= total) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "l99-tool l99-tool-skip";
    btn.textContent = rootOn ? `⏭️ 跳过 第${level + 1}关（管理员）` : `⏭️ 跳过 第${level + 1}关`;
    btn.title = rootOn ? "管理员权限开着,可以直接跳过这一关" : "需要家长确认才能跳过这一关";
    btn.addEventListener("click", () => {
      api.play("tap");
      btn.disabled = true;
      // 管理员权限开着就不必再做算术题;关着时仍旧走 1.1 的家长算术门
      const allow: Promise<boolean> = skipNeedsParentAuth()
        ? Promise.resolve(request ? request(opts.id, level) : false)
        : Promise.resolve(true);
      allow
        .then((ok) => {
          if (destroyed) return;
          btn.disabled = false;
          if (!ok) return;
          skips = markSkipped(opts.id, level);
          flash = `已跳过 第 ${level + 1} 关，第 ${Math.min(level + 2, total)} 关解锁啦，随时可以回来挑战它。`;
          after(level);
        })
        .catch((err) => {
          if (destroyed) return;
          btn.disabled = false;
          console.warn(`[一朵一星] ${opts.id} 跳关授权失败:`, err);
        });
    });
    host.appendChild(btn);
  }

  function cleanupLevel(): void {
    try {
      if (handle && typeof handle.destroy === "function") handle.destroy();
    } catch (err) {
      console.warn(`[一朵一星] ${opts.id} 关卡清理出错:`, err);
    }
    handle = undefined;
  }

  function showMap(focusCurrent = false): void {
    cleanupLevel();
    dropGuides();
    stopSpeaking();
    currentLevel = -1;
    view.innerHTML = "";

    const furthest = furthestPlayable(stars, skips, total);
    const map = document.createElement("div");
    map.className = "l99-map";

    const head = document.createElement("div");
    head.className = "l99-head";
    head.innerHTML = `
      <span class="l99-chip">🚩 ${clearedCount(stars)}/${total} 关</span>
      <span class="l99-chip">⭐ ${totalStars(stars)}/${total * 3}</span>
      ${skips.length ? `<span class="l99-chip l99-chip-skip">🏳️ 跳过 ${skips.length}</span>` : ""}`;
    const cont = document.createElement("button");
    cont.type = "button";
    cont.className = "l99-continue";
    cont.textContent = reachedCount(stars, skips) === 0 ? "开始冒险 ▶" : `继续 第${furthest + 1}关 ▶`;
    cont.addEventListener("click", () => {
      api.play("tap");
      startLevel(furthest);
    });
    head.appendChild(cont);
    map.appendChild(head);

    // 工具行：跳到当前关 + 攻略（壳层注册了才有）+ 跳关（壳层注册了才有）
    const tools = document.createElement("div");
    tools.className = "l99-tools";
    const jump = document.createElement("button");
    jump.type = "button";
    jump.className = "l99-tool";
    jump.textContent = "🎯 跳到当前关";
    jump.addEventListener("click", () => {
      api.play("tap");
      viewChapter = chapterOf(opts.chapters, furthestPlayable(stars, skips, total));
      showMap(true);
    });
    tools.appendChild(jump);
    attachGuide(tools, () => furthestPlayable(stars, skips, total) + 1);
    attachSkip(tools, furthest, () => showMap(true));
    attachRootJump(tools, () => furthestPlayable(stars, skips, total));
    map.appendChild(tools);

    const tabs = document.createElement("div");
    tabs.className = "l99-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "章节");
    const desc = document.createElement("div");
    desc.className = "l99-chapdesc";
    const grid = document.createElement("div");
    grid.className = "l99-grid";
    grid.style.gridTemplateColumns = `repeat(${mapColumns(viewportWidth())},1fr)`;
    const furthestChapter = chapterOf(opts.chapters, furthest);

    opts.chapters.forEach((ch, ci) => {
      const tab = document.createElement("button");
      tab.type = "button";
      const locked = ci > furthestChapter;
      tab.className = `l99-tab${ci === viewChapter ? " l99-tab-on" : ""}${locked ? " l99-tab-lock" : ""}`;
      tab.style.background = ci === viewChapter ? ch.color : "";
      tab.textContent = `${ch.emoji} ${ch.name}${locked ? " 🔒" : ""}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", ci === viewChapter ? "true" : "false");
      tab.addEventListener("click", () => {
        api.play("tap");
        viewChapter = ci;
        showMap();
      });
      tabs.appendChild(tab);
    });
    map.appendChild(tabs);

    const ch = opts.chapters[viewChapter];
    desc.textContent = ch.desc;
    map.appendChild(desc);

    const range = chapterRange(opts.chapters, viewChapter);
    const page = document.createElement("div");
    page.className = "l99-pagehint";
    page.textContent = `第 ${viewChapter + 1} / ${opts.chapters.length} 章 · 第 ${range.from}–${range.to} 关`;
    map.appendChild(page);

    if (flash) {
      const flashEl = document.createElement("div");
      flashEl.className = "l99-flash";
      flashEl.textContent = flash;
      map.appendChild(flashEl);
      flash = "";
    }

    grid.setAttribute("role", "tabpanel");
    grid.setAttribute("aria-label", `${ch.name} 关卡`);
    const start = chapterStart(opts.chapters, viewChapter);
    for (let i = 0; i < ch.size; i++) {
      const level = start + i;
      if (level >= total) break;
      const node = document.createElement("button");
      node.type = "button";
      const locked = level > furthest;
      const isCurrent = level === furthest;
      const skipped = !locked && stars[level] <= 0 && isSkipped(skips, level);
      node.className = `l99-node${locked ? " l99-node-lock" : ""}${skipped ? " l99-node-skip" : ""}${
        isCurrent ? " l99-node-cur" : ""
      }`;
      if (!locked && !skipped) node.style.background = ch.color;
      node.setAttribute("aria-label", nodeAriaLabel(level, stars[level], locked ? "locked" : skipped ? "skipped" : "open"));
      if (locked) {
        node.innerHTML = `<span class="l99-node-num">🔒</span>`;
      } else if (skipped) {
        // 灰色小旗子：一眼能和真正的三星区分开
        node.innerHTML = `<span class="l99-node-num">${level + 1}</span><span class="l99-node-flag">🏳️</span>`;
      } else {
        node.innerHTML = `<span class="l99-node-num">${level + 1}</span><span class="l99-node-stars">${starRowHTML(
          stars[level]
        )}</span>`;
      }
      if (!locked) {
        node.addEventListener("click", () => {
          api.play("tap");
          startLevel(level);
        });
      } else {
        node.disabled = true;
      }
      grid.appendChild(node);
    }
    map.appendChild(grid);

    if (opts.mapHint) {
      const hint = document.createElement("div");
      hint.className = "l99-maphint";
      hint.textContent = opts.mapHint;
      map.appendChild(hint);
    }
    view.appendChild(map);

    if (focusCurrent) {
      const cur = grid.querySelector(".l99-node-cur") as {
        scrollIntoView?: (opts: { block: string }) => void;
        focus?: () => void;
      } | null;
      // 认有没有 focus,不写 instanceof HTMLElement:node 单测环境没有这个全局,初次 showMap(true) 会整库红
      if (cur) {
        try {
          cur.scrollIntoView?.({ block: "center" });
        } catch {
          // 老浏览器不支持 options 就算了
        }
        cur.focus?.();
      }
    }
  }

  function showOverlay(html: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>): void {
    const ov = document.createElement("div");
    ov.className = "l99-overlay";
    ov.innerHTML = html;
    const shownAt = performance.now();
    const btns = document.createElement("div");
    btns.className = "l99-ov-btns";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `l99-ov-btn${b.ghost ? " l99-ov-ghost" : ""}`;
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        // 冷静期:狂点型关卡(拔河/点点/地鼠…)胜负一出孩子手还在连点,
        // 结算刚弹出的一小会儿不吃点击,免得「下一关/再玩一次」被误触
        if (isGuardedClick(shownAt, performance.now())) return;
        api.play("tap");
        ov.remove();
        b.onClick();
      });
      btns.appendChild(btn);
    }
    ov.appendChild(btns);
    wrap.appendChild(ov);
  }

  function onLevelWin(level: number, got: 1 | 2 | 3, msg?: string): void {
    if (settled || destroyed) return;
    settled = true;
    const prev = stars[level];
    stars = saveStar(opts.id, level, got);
    // 平台小星星：只奖励比历史最好成绩多出来的部分（最多 3 颗/关）
    const gain = Math.max(0, got - prev);
    if (gain > 0) api.addStars(gain);
    api.play("win");

    const allCleared = clearedCount(stars) >= total;
    const isLast = level >= total - 1;
    const word = WIN_WORDS[Math.floor(Math.random() * WIN_WORDS.length)];
    const buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }> = [];
    if (!isLast) {
      buttons.push({ label: "下一关 ▶", onClick: () => startLevel(level + 1) });
    }
    buttons.push({ label: "🔁 再玩一次", ghost: true, onClick: () => startLevel(level) });
    buttons.push({ label: "🗺️ 回地图", ghost: true, onClick: () => showMap() });

    const buddy = level % 2 === 0 ? AVATAR_URLS.duoduoCheer : AVATAR_URLS.xingxingRun;
    const buddyAlt = level % 2 === 0 ? "朵朵在为你庆祝" : "星星在为你欢呼";
    showOverlay(
      `<img class="l99-ov-buddy" src="${buddy}" alt="${buddyAlt}" />
       <div class="l99-ov-stars">${starRowHTML(got)}</div>
       <div class="l99-ov-title">第 ${level + 1} 关过关！</div>
       <div class="l99-ov-sub">${msg ?? word}</div>`,
      buttons
    );
    speak(settleSpeechLine("win", level, msg ?? word));

    if (isLast && allCleared) {
      api.onWin(3, opts.grandMessage ?? `${total} 关全部通关，你就是本游戏的小冠军！`);
    }
  }

  function onLevelLose(level: number, msg?: string): void {
    if (settled || destroyed) return;
    settled = true;
    api.play("oops");
    const word = msg ?? LOSE_WORDS[Math.floor(Math.random() * LOSE_WORDS.length)];
    const buddy = level % 2 === 0 ? AVATAR_URLS.xingxing : AVATAR_URLS.duoduo;
    const buddyAlt = level % 2 === 0 ? "星星给你打气" : "朵朵给你打气";
    showOverlay(
      `<img class="l99-ov-buddy l99-ov-buddy-round" src="${buddy}" alt="${buddyAlt}" />
       <div class="l99-ov-title">就差一点点！</div>
       <div class="l99-ov-sub">${word}</div>`,
      [
        { label: "🔁 再试本关", onClick: () => startLevel(level) },
        { label: "🗺️ 回地图", ghost: true, onClick: () => showMap() }
      ]
    );
    speak(settleSpeechLine("lose", level, word));
  }

  function startLevel(level: number): void {
    if (destroyed) return;
    cleanupLevel();
    dropGuides();
    stopSpeaking();
    settled = false;
    currentLevel = level;
    const ci = chapterOf(opts.chapters, level);
    viewChapter = ci;
    const ch = opts.chapters[ci];
    view.innerHTML = "";

    const stageWrap = document.createElement("div");
    stageWrap.className = "l99-stage-wrap";
    const bar = document.createElement("div");
    bar.className = "l99-stagebar";
    bar.style.background = ch.color;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "l99-back";
    back.textContent = "🗺️ 选关";
    back.addEventListener("click", () => {
      api.play("tap");
      showMap();
    });
    const title = document.createElement("div");
    title.className = "l99-stagetitle";
    title.textContent = `${ch.emoji} ${ch.name} · 第 ${level + 1} 关`;
    const best = document.createElement("div");
    best.className = "l99-beststars";
    best.innerHTML = starRowHTML(stars[level]);
    bar.append(back, title, best);
    // 关内菜单：攻略 + 跳关，同样是壳层注册了才出现
    const barTools = document.createElement("div");
    barTools.className = "l99-tools";
    barTools.style.margin = "0";
    attachGuide(barTools, () => currentLevel + 1);
    attachSkip(barTools, level, (skipped) => {
      if (skipped + 1 < total) startLevel(skipped + 1);
      else showMap(true);
    });
    attachRootJump(barTools, () => level);
    if (barTools.childElementCount > 0) bar.appendChild(barTools);
    stageWrap.appendChild(bar);

    const stage = document.createElement("div");
    stage.className = "l99-stage";
    stageWrap.appendChild(stage);
    view.appendChild(stageWrap);

    const ctx: PlayCtx = {
      level,
      chapter: ch,
      chapterIndex: ci,
      indexInChapter: level - chapterStart(opts.chapters, ci),
      skipped: isSkipped(skips, level),
      win: (got, msg) => onLevelWin(level, got, msg),
      lose: (msg) => onLevelLose(level, msg),
      sfx: (name) => api.play(name),
      bonusStars: (n) => api.addStars(n)
    };

    try {
      handle = opts.playLevel(stage, ctx);
    } catch (err) {
      console.error(`[一朵一星] ${opts.id} 第 ${level + 1} 关启动失败:`, err);
      stage.innerHTML = `<div style="text-align:center;padding:30px;font-weight:800;color:#a687c0;">这一关出了点小状况，先回地图玩别的关吧！</div>`;
    }
  }

  showMap();

  return {
    destroy() {
      destroyed = true;
      cleanupLevel();
      dropGuides();
      stopSpeaking();
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "resize",
        onResize
      );
      wrap.remove();
    }
  };
}
