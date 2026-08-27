/**
 * 攻略侧栏(1.1 新增)。
 *
 * 提供三件事:
 *  1. 纯逻辑:按当前关挑出该看的攻略条目(命中区间 / 最近一条兜底);
 *  2. 抽屉 UI:`mountGuide` —— 契约 `LevelExtras.mountGuide` 的实现;
 *  3. 攻略数据加载器:按游戏 id 懒加载 `src/games/<id>/guide.ts`,没有就返回 null。
 *
 * 铁律:**攻略只讲方法,不给答案**。算数 / 识字 / 拼音 / 时钟 / 形状这类学习游戏
 * 的攻略如果写出了现成答案,会在这里被过滤掉,只留下思路与检查方法。
 */
import type { GuideBook, GuideEntry } from "./level188Contract";
import { playSound } from "../engine/audio";

/** 窄屏改成底部半屏抽屉的断点 */
export const GUIDE_SHEET_QUERY = "(max-width: 640px)";

/** 命中不到当前关区间时的提示语(必须原样出现在面板里) */
export const GUIDE_NO_ENTRY_NOTE = "这一章还没写细则";

/** 每关星级存档的 key 前缀(只读,不写;与 level99 框架共用同一份数据) */
const L99_KEY_PREFIX = "yiduo-yixing.l99.";

// ---------------------------------------------------------------------------
// 「只讲方法不给答案」过滤(纯函数)
// ---------------------------------------------------------------------------

const ANSWER_LEAK_PATTERNS: RegExp[] = [
  /(标准|正确)?答案\s*(是|为|就是)?\s*[:：]?\s*\S/,
  /正确选项/,
  /答\s*[:：]\s*\S/,
  // 写死的算式结果:12 × 3 = 36、7+8=15 …… 思路可以讲,得数不能给
  /\d\s*[+\-×÷*/]\s*\d+\s*=\s*\d/
];

/** 这条攻略是不是把答案直接写出来了 */
export function isAnswerLeak(tip: string): boolean {
  return ANSWER_LEAK_PATTERNS.some((re) => re.test(tip));
}

/** 去掉空白条目与「直接给答案」的条目 */
export function stripAnswerLeaks(tips: readonly string[]): string[] {
  const out: string[] = [];
  for (const tip of tips) {
    const text = typeof tip === "string" ? tip.trim() : "";
    if (!text) continue;
    if (isAnswerLeak(text)) {
      console.warn(`[鸭梨康康] 攻略里出现了现成答案,已隐藏:${text}`);
      continue;
    }
    out.push(text);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 按当前关挑攻略(纯函数)
// ---------------------------------------------------------------------------

export interface GuideSelection {
  /** 任何关都适用的通用思路(已过滤) */
  general: string[];
  /** 要展示的章节条目;命中不到时里面是最近的一条 */
  entries: GuideEntry[];
  /** true = 没命中当前关区间,展示的是最近的一条 */
  fallback: boolean;
}

function byRange(a: GuideEntry, b: GuideEntry): number {
  return a.from - b.from || a.to - b.to;
}

/** 条目按区间起点排好序(不改原数组) */
export function sortedEntries(entries: readonly GuideEntry[]): GuideEntry[] {
  return entries.filter(isGuideEntry).slice().sort(byRange);
}

/** 命中当前关的全部条目(from <= level <= to) */
export function matchEntries(entries: readonly GuideEntry[], level: number): GuideEntry[] {
  return sortedEntries(entries).filter((e) => e.from <= level && level <= e.to);
}

/** level 到某条目区间的距离(区间内为 0) */
export function distanceTo(entry: GuideEntry, level: number): number {
  if (level < entry.from) return entry.from - level;
  if (level > entry.to) return level - entry.to;
  return 0;
}

/** 离当前关最近的一条(并列时取靠前的那一章);没有条目返回 null */
export function nearestEntry(entries: readonly GuideEntry[], level: number): GuideEntry | null {
  const list = sortedEntries(entries);
  let best: GuideEntry | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const e of list) {
    const d = distanceTo(e, level);
    if (d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

/** 抽屉里到底显示哪些内容 */
export function selectGuide(book: GuideBook, level: number): GuideSelection {
  const general = stripAnswerLeaks(book.general ?? []);
  const hit = matchEntries(book.entries ?? [], level);
  if (hit.length > 0) return { general, entries: hit, fallback: false };
  const near = nearestEntry(book.entries ?? [], level);
  return { general, entries: near ? [near] : [], fallback: true };
}

// ---------------------------------------------------------------------------
// 攻略数据校验与加载
// ---------------------------------------------------------------------------

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

export function isGuideEntry(v: unknown): v is GuideEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Partial<GuideEntry>;
  return (
    Number.isFinite(e.from) &&
    Number.isFinite(e.to) &&
    (e.from as number) <= (e.to as number) &&
    typeof e.title === "string" &&
    isStringArray(e.tips)
  );
}

export function isGuideBook(v: unknown): v is GuideBook {
  if (!v || typeof v !== "object") return false;
  const b = v as Partial<GuideBook>;
  return (
    typeof b.gameId === "string" &&
    typeof b.title === "string" &&
    isStringArray(b.general) &&
    Array.isArray(b.entries) &&
    b.entries.every(isGuideEntry)
  );
}

/** 从模块导出里取出攻略书(支持 `guide` / `default` 两种写法),形状不对返回 null */
export function pickGuideBook(mod: unknown): GuideBook | null {
  if (!mod || typeof mod !== "object") return null;
  const m = mod as Record<string, unknown>;
  for (const key of ["guide", "default", "book"]) {
    const candidate = m[key];
    if (isGuideBook(candidate)) return candidate;
  }
  return isGuideBook(mod) ? mod : null;
}

// 攻略数据文件由第 12 步逐款补齐;这里用 glob 收集,一个都没有时返回空表,
// 不会让 vite 在构建期因为找不到模块而报错。
const guideModules = import.meta.glob("../games/*/guide.ts") as Record<
  string,
  () => Promise<unknown>
>;

/** 该游戏有没有攻略数据文件 */
export function hasGuideModule(gameId: string): boolean {
  return `../games/${gameId}/guide.ts` in guideModules;
}

/** 懒加载某游戏的攻略;模块不存在或数据坏掉都静默返回 null(壳层据此不显示按钮) */
export async function loadGuideBook(gameId: string): Promise<GuideBook | null> {
  const loader = guideModules[`../games/${gameId}/guide.ts`];
  if (!loader) return null;
  try {
    return pickGuideBook(await loader());
  } catch (err) {
    console.warn(`[鸭梨康康] ${gameId} 的攻略加载失败,先不显示攻略按钮:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 当前关推断(只读存档,绝不写)
// ---------------------------------------------------------------------------

/** 从存档原文推断「现在打到第几关」(1 基);存档缺失或损坏一律当作第 1 关 */
export function currentLevelFromSave(raw: string | null | undefined): number {
  if (!raw) return 1;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return 1;
    for (let i = 0; i < parsed.length; i++) {
      const v = parsed[i];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return i + 1;
    }
    return parsed.length;
  } catch {
    return 1;
  }
}

interface ReadOnlyStorage {
  getItem(key: string): string | null;
}

/** 读某游戏当前关(1 基)。只读 `yiduo-yixing.l99.<id>`,不改 key、不写回 */
export function readCurrentLevel(gameId: string, storage?: ReadOnlyStorage | null): number {
  const store =
    storage === undefined
      ? (globalThis as { localStorage?: ReadOnlyStorage }).localStorage ?? null
      : storage;
  if (!store) return 1;
  try {
    return currentLevelFromSave(store.getItem(`${L99_KEY_PREFIX}${gameId}`));
  } catch {
    return 1;
  }
}

// ---------------------------------------------------------------------------
// 抽屉 UI
// ---------------------------------------------------------------------------

function docOf(host: HTMLElement): Document {
  return host.ownerDocument ?? (globalThis as unknown as { document: Document }).document;
}

/** 窄屏(手机竖屏)时抽屉从底部升起,占半屏 */
export function prefersSheetLayout(): boolean {
  const mm = (globalThis as unknown as {
    matchMedia?: (q: string) => { matches: boolean } | null;
  }).matchMedia;
  if (typeof mm !== "function") return false;
  try {
    return mm(GUIDE_SHEET_QUERY)?.matches === true;
  } catch {
    return false;
  }
}

function safeLevel(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 1;
  return n < 1 ? 1 : n;
}

function rangeLabel(entry: GuideEntry): string {
  return entry.from === entry.to
    ? `第 ${entry.from} 关`
    : `第 ${entry.from}–${entry.to} 关`;
}

/**
 * 在 host 里挂一个「📖 攻略」按钮,点开右侧抽屉(窄屏为底部半屏抽屉)。
 * 返回清理函数:关掉抽屉、摘掉全局监听、移除按钮。
 */
export function mountGuide(
  host: HTMLElement,
  book: GuideBook,
  getLevel: () => number
): () => void {
  const doc = docOf(host);

  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = "guide-btn";
  btn.textContent = "📖 攻略";
  btn.setAttribute("aria-label", `打开《${book.title}》的攻略`);
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");

  let overlay: HTMLElement | null = null;
  let focusables: HTMLElement[] = [];
  let disposed = false;

  function currentLevel(): number {
    try {
      return safeLevel(getLevel());
    } catch {
      return 1;
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!overlay) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
      return;
    }
    if (e.key !== "Tab" || focusables.length === 0) return;
    // 焦点陷阱:Tab / Shift+Tab 只在抽屉里的按钮之间打转
    const active = doc.activeElement as HTMLElement | null;
    const at = active ? focusables.indexOf(active) : -1;
    const step = e.shiftKey ? -1 : 1;
    const from = at === -1 ? (e.shiftKey ? 0 : focusables.length - 1) : at;
    const next = focusables[(from + step + focusables.length) % focusables.length];
    e.preventDefault();
    next.focus();
  }

  function closeDrawer(): void {
    if (!overlay) return;
    doc.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    overlay = null;
    focusables = [];
    btn.setAttribute("aria-expanded", "false");
    if (!disposed) btn.focus();
  }

  function section(titleText: string): HTMLElement {
    const box = doc.createElement("section");
    box.className = "guide-section";
    const h = doc.createElement("h3");
    h.className = "guide-section-title";
    h.textContent = titleText;
    box.appendChild(h);
    return box;
  }

  function tipList(tips: readonly string[]): HTMLElement {
    const ul = doc.createElement("ul");
    ul.className = "guide-tips";
    for (const tip of stripAnswerLeaks(tips)) {
      const li = doc.createElement("li");
      li.className = "guide-tip";
      li.textContent = tip;
      ul.appendChild(li);
    }
    return ul;
  }

  function openDrawer(): void {
    if (overlay || disposed) return;
    const level = currentLevel();
    const sel = selectGuide(book, level);

    const ov = doc.createElement("div");
    ov.className = "guide-overlay";
    overlay = ov;

    const panel = doc.createElement("div");
    panel.className = prefersSheetLayout() ? "guide-drawer guide-drawer--sheet" : "guide-drawer";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `${book.title}攻略`);

    const head = doc.createElement("header");
    head.className = "guide-head";
    const title = doc.createElement("h2");
    title.className = "guide-title";
    title.textContent = `📖 ${book.title}`;
    const levelChip = doc.createElement("span");
    levelChip.className = "guide-level";
    levelChip.textContent = `第 ${level} 关`;
    const closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "guide-close";
    closeBtn.textContent = "✕";
    closeBtn.setAttribute("aria-label", "关闭攻略");
    closeBtn.addEventListener("click", () => {
      playSound("tap");
      closeDrawer();
    });
    head.append(title, levelChip, closeBtn);
    panel.appendChild(head);

    const body = doc.createElement("div");
    body.className = "guide-body";

    if (sel.general.length > 0) {
      const box = section("通用思路");
      box.appendChild(tipList(sel.general));
      body.appendChild(box);
    }

    if (sel.fallback) {
      const note = doc.createElement("p");
      note.className = "guide-note";
      note.textContent = sel.entries.length
        ? `${GUIDE_NO_ENTRY_NOTE},先看看最接近的这一章。`
        : `${GUIDE_NO_ENTRY_NOTE},先照着通用思路自己推一推。`;
      body.appendChild(note);
    }

    for (const entry of sel.entries) {
      const box = section(`${entry.title} · ${rangeLabel(entry)}`);
      box.appendChild(tipList(entry.tips));
      body.appendChild(box);
    }

    const foot = doc.createElement("footer");
    foot.className = "guide-foot";
    const tail = doc.createElement("p");
    tail.className = "guide-tail";
    tail.textContent = "攻略只给思路和检查方法,答案要靠自己算出来才算数。";
    const doneBtn = doc.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "guide-done";
    doneBtn.textContent = "知道啦";
    doneBtn.addEventListener("click", () => {
      playSound("tap");
      closeDrawer();
    });
    foot.append(tail, doneBtn);

    panel.append(body, foot);
    ov.appendChild(panel);
    ov.addEventListener("click", (e) => {
      // 只有点在抽屉外的遮罩上才关,点内容不关
      if (e.target === ov) closeDrawer();
    });
    (doc.body ?? host).appendChild(ov);

    focusables = [closeBtn, doneBtn];
    btn.setAttribute("aria-expanded", "true");
    doc.addEventListener("keydown", onKeyDown);
    closeBtn.focus();
  }

  btn.addEventListener("click", () => {
    playSound("tap");
    if (overlay) closeDrawer();
    else openDrawer();
  });
  host.appendChild(btn);

  return () => {
    disposed = true;
    closeDrawer();
    btn.remove();
  };
}
