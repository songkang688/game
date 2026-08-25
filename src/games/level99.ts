/**
 * 「一朵一星」99 关通用框架（休闲 / 对战 / 学习游戏共用）。
 *
 * 提供四件事：
 *  1. 章节定义与工具：≥6 个主题章节，章节大小之和恒等于 99；
 *  2. 每关星级进度存档（localStorage，独立于平台钱包存档）；
 *  3. 选关地图 UI：章节页签 + 关卡格子（星级 / 当前关 / 锁定）；
 *  4. 胜负结算：过关最多 3 星、失败温柔鼓励并可"重试本关"。
 *
 * 各游戏只需提供 chapters 与 playLevel(stage, ctx)，其余交给框架。
 * 本文件不在游戏子目录内，不会被 loader 的 import.meta.glob 收集。
 */

export type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

/** 每个游戏固定 99 关 */
export const TOTAL_LEVELS = 99;

export interface Chapter {
  /** 主题章节名，例如「冰雪山谷」 */
  name: string;
  emoji: string;
  /** 章节主色（粉彩），用于地图与关卡头部 */
  color: string;
  /** 一句话介绍本章的主题 / 新玩法 */
  desc: string;
  /** 本章包含的关卡数，所有章节之和必须是 99 */
  size: number;
}

// ---------------------------------------------------------------------------
// 章节工具（纯函数，可测试）
// ---------------------------------------------------------------------------

/** 全部章节的关卡总数 */
export function totalSize(chapters: Chapter[]): number {
  return chapters.reduce((s, c) => s + c.size, 0);
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
}

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      const probe = "yiduo-yixing.l99.probe";
      ls.setItem(probe, "1");
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

/** 读取某游戏 99 关的星级数组（每项 0..3，0 表示未通过） */
export function loadStars(gameId: string, storage?: StorageLike | null): number[] {
  const store = storage === undefined ? defaultStorage() : storage;
  const out = new Array<number>(TOTAL_LEVELS).fill(0);
  let raw: string | null = null;
  try {
    raw = store ? store.getItem(storageKey(gameId)) : memoryFallback.get(storageKey(gameId)) ?? null;
  } catch {
    raw = null;
  }
  if (!raw) return out;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (let i = 0; i < TOTAL_LEVELS && i < parsed.length; i++) {
        const v = parsed[i];
        if (typeof v === "number" && Number.isFinite(v)) {
          out[i] = Math.max(0, Math.min(3, Math.round(v)));
        }
      }
    }
  } catch {
    // 数据坏了就当作全新进度
  }
  return out;
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
  if (level >= 0 && level < TOTAL_LEVELS) {
    arr[level] = Math.max(arr[level], Math.max(0, Math.min(3, Math.round(stars))));
  }
  const raw = JSON.stringify(arr);
  try {
    if (store) store.setItem(storageKey(gameId), raw);
    else memoryFallback.set(storageKey(gameId), raw);
  } catch {
    // 存不进去也不影响继续玩
  }
  return arr;
}

/** 已通关数 */
export function clearedCount(stars: number[]): number {
  return stars.filter((s) => s > 0).length;
}

/** 全部关卡累计星数（满分 297） */
export function totalStars(stars: number[]): number {
  return stars.reduce((a, b) => a + b, 0);
}

/** 当前可以玩到的最远关卡（0 基）：第一个未通过的关；全通则是最后一关 */
export function furthestPlayable(stars: number[]): number {
  for (let i = 0; i < TOTAL_LEVELS; i++) {
    if (stars[i] <= 0) return i;
  }
  return TOTAL_LEVELS - 1;
}

// ---------------------------------------------------------------------------
// 选关地图 + 结算 UI
// ---------------------------------------------------------------------------

export interface PlayCtx {
  /** 当前关（0 基，0..98） */
  level: number;
  chapter: Chapter;
  chapterIndex: number;
  /** 本关在章节内的序号（0 基） */
  indexInChapter: number;
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
  /** 全部 99 关通关后的庆祝语（走平台 onWin） */
  grandMessage?: string;
}

const WIN_WORDS = ["太棒啦！", "好厉害！", "真会动脑筋！", "漂亮！", "你做到啦！"];
const LOSE_WORDS = [
  "差一点点啦，再来一次一定行！",
  "没关系，慢慢来，你可以的！",
  "就快成功了，深呼吸再试试～",
  "小挫折不算什么，加油！"
];

function starRowHTML(stars: number): string {
  let s = "";
  for (let i = 0; i < 3; i++) {
    s += `<span class="l99-star${i < stars ? " l99-star-on" : ""}">★</span>`;
  }
  return s;
}

const L99_CSS = `
.l99-wrap{max-width:480px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  user-select:none;-webkit-user-select:none;position:relative;}
.l99-map{border-radius:20px;padding:14px;background:linear-gradient(180deg,#FFF7FB,#F0F4FF);}
.l99-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.l99-chip{background:#fff;border-radius:999px;padding:6px 12px;font-weight:800;font-size:14px;color:#8a6fb8;
  box-shadow:0 2px 6px rgba(150,130,200,.2);}
.l99-continue{border:none;border-radius:999px;padding:8px 16px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#ffa8cf,#f26fae);box-shadow:0 4px 0 #d1548f;font-family:inherit;}
.l99-continue:active{transform:translateY(2px);box-shadow:0 2px 0 #d1548f;}
.l99-tabs{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:none;}
.l99-tabs::-webkit-scrollbar{display:none;}
.l99-tab{flex:0 0 auto;border:none;border-radius:14px;padding:8px 12px;font-size:14px;font-weight:800;cursor:pointer;
  background:#ffffffb0;color:#7a7a8c;box-shadow:0 2px 5px rgba(140,130,180,.15);font-family:inherit;white-space:nowrap;}
.l99-tab.l99-tab-on{color:#5a4a80;outline:3px solid #ffffff;box-shadow:0 3px 8px rgba(140,120,200,.3);}
.l99-tab.l99-tab-lock{opacity:.55;}
.l99-chapdesc{font-size:13px;font-weight:700;color:#9a86b8;text-align:center;margin:2px 0 10px;min-height:18px;}
.l99-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
.l99-node{aspect-ratio:1;border:none;border-radius:16px;cursor:pointer;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;background:#fff;box-shadow:0 3px 8px rgba(140,130,190,.18);
  font-family:inherit;padding:0;}
.l99-node:active{transform:scale(.94);}
.l99-node-num{font-size:17px;font-weight:900;color:#6b5a90;line-height:1;}
.l99-node-stars{font-size:11px;line-height:1;letter-spacing:1px;}
.l99-star{color:#e3ddef;}
.l99-star-on{color:#ffb937;text-shadow:0 1px 2px rgba(200,120,0,.35);}
.l99-node-cur{outline:3px solid #ff8fc0;animation:l99pulse 1.4s ease infinite;}
.l99-node-cur .l99-node-num{color:#e4589a;}
@keyframes l99pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.l99-node-lock{background:#f2eef8;box-shadow:none;cursor:default;}
.l99-node-lock .l99-node-num{color:#c8bedd;font-size:14px;}
.l99-maphint{margin-top:12px;text-align:center;font-size:13px;font-weight:700;color:#a894c4;}
.l99-stage-wrap{border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(150,130,200,.18);}
.l99-stagebar{display:flex;align-items:center;gap:8px;padding:10px 12px;}
.l99-back{border:none;border-radius:999px;padding:7px 12px;font-size:14px;font-weight:900;cursor:pointer;
  background:#ffffffd9;color:#7a5aa0;box-shadow:0 3px 0 rgba(120,90,160,.25);font-family:inherit;white-space:nowrap;}
.l99-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}
.l99-stagetitle{flex:1;text-align:center;font-size:15px;font-weight:900;color:#5c4a7d;}
.l99-beststars{font-size:12px;letter-spacing:1px;}
.l99-stage{padding:10px;}
.l99-overlay{position:absolute;inset:0;background:rgba(255,250,253,.96);border-radius:20px;z-index:8;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;}
.l99-ov-big{font-size:56px;line-height:1;}
.l99-ov-stars{font-size:34px;letter-spacing:6px;}
.l99-ov-title{font-size:23px;font-weight:900;color:#8a5aa8;}
.l99-ov-sub{font-size:16px;font-weight:700;color:#a687c0;line-height:1.6;max-width:320px;}
.l99-ov-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.l99-ov-btn{border:none;border-radius:18px;padding:12px 26px;font-size:17px;font-weight:900;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#ffa8cf,#f26fae);box-shadow:0 5px 0 #d1548f;font-family:inherit;}
.l99-ov-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #d1548f;}
.l99-ov-btn.l99-ov-ghost{background:linear-gradient(180deg,#b8c8f8,#8fa3ec);box-shadow:0 5px 0 #6f83cc;}
.l99-ov-btn.l99-ov-ghost:active{box-shadow:0 2px 0 #6f83cc;}
`;

export function mountLevelGame(api: GameApi, opts: LevelGameOptions): { destroy: () => void } {
  if (totalSize(opts.chapters) !== TOTAL_LEVELS) {
    console.warn(`[一朵一星] ${opts.id} 章节大小之和不是 ${TOTAL_LEVELS}`);
  }

  let destroyed = false;
  let stars = loadStars(opts.id);
  let handle: PlayHandle | void = undefined;
  let currentLevel = -1;
  let settled = false;
  let viewChapter = chapterOf(opts.chapters, furthestPlayable(stars));

  const wrap = document.createElement("div");
  wrap.className = "l99-wrap";
  const style = document.createElement("style");
  style.textContent = L99_CSS;
  wrap.appendChild(style);
  const view = document.createElement("div");
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  function cleanupLevel(): void {
    try {
      if (handle && typeof handle.destroy === "function") handle.destroy();
    } catch (err) {
      console.warn(`[一朵一星] ${opts.id} 关卡清理出错:`, err);
    }
    handle = undefined;
  }

  function showMap(): void {
    cleanupLevel();
    currentLevel = -1;
    view.innerHTML = "";

    const furthest = furthestPlayable(stars);
    const map = document.createElement("div");
    map.className = "l99-map";

    const head = document.createElement("div");
    head.className = "l99-head";
    head.innerHTML = `
      <span class="l99-chip">🚩 ${clearedCount(stars)}/${TOTAL_LEVELS} 关</span>
      <span class="l99-chip">⭐ ${totalStars(stars)}/${TOTAL_LEVELS * 3}</span>`;
    const cont = document.createElement("button");
    cont.type = "button";
    cont.className = "l99-continue";
    cont.textContent = clearedCount(stars) === 0 ? "开始冒险 ▶" : `继续 第${furthest + 1}关 ▶`;
    cont.addEventListener("click", () => {
      api.play("tap");
      startLevel(furthest);
    });
    head.appendChild(cont);
    map.appendChild(head);

    const tabs = document.createElement("div");
    tabs.className = "l99-tabs";
    const desc = document.createElement("div");
    desc.className = "l99-chapdesc";
    const grid = document.createElement("div");
    grid.className = "l99-grid";
    const furthestChapter = chapterOf(opts.chapters, furthest);

    opts.chapters.forEach((ch, ci) => {
      const tab = document.createElement("button");
      tab.type = "button";
      const locked = ci > furthestChapter;
      tab.className = `l99-tab${ci === viewChapter ? " l99-tab-on" : ""}${locked ? " l99-tab-lock" : ""}`;
      tab.style.background = ci === viewChapter ? ch.color : "";
      tab.textContent = `${ch.emoji} ${ch.name}${locked ? " 🔒" : ""}`;
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

    const start = chapterStart(opts.chapters, viewChapter);
    for (let i = 0; i < ch.size; i++) {
      const level = start + i;
      const node = document.createElement("button");
      node.type = "button";
      const locked = level > furthest;
      const isCurrent = level === furthest;
      node.className = `l99-node${locked ? " l99-node-lock" : ""}${isCurrent ? " l99-node-cur" : ""}`;
      if (!locked) node.style.background = ch.color;
      node.innerHTML = locked
        ? `<span class="l99-node-num">🔒</span>`
        : `<span class="l99-node-num">${level + 1}</span><span class="l99-node-stars">${starRowHTML(stars[level])}</span>`;
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
  }

  function showOverlay(html: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>): void {
    const ov = document.createElement("div");
    ov.className = "l99-overlay";
    ov.innerHTML = html;
    const btns = document.createElement("div");
    btns.className = "l99-ov-btns";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `l99-ov-btn${b.ghost ? " l99-ov-ghost" : ""}`;
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
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

    const allCleared = clearedCount(stars) >= TOTAL_LEVELS;
    const isLast = level >= TOTAL_LEVELS - 1;
    const word = WIN_WORDS[Math.floor(Math.random() * WIN_WORDS.length)];
    const buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }> = [];
    if (!isLast) {
      buttons.push({ label: "下一关 ▶", onClick: () => startLevel(level + 1) });
    }
    buttons.push({ label: "🔁 再玩一次", ghost: true, onClick: () => startLevel(level) });
    buttons.push({ label: "🗺️ 回地图", ghost: true, onClick: () => showMap() });

    showOverlay(
      `<div class="l99-ov-big">🎉</div>
       <div class="l99-ov-stars">${starRowHTML(got)}</div>
       <div class="l99-ov-title">第 ${level + 1} 关过关！</div>
       <div class="l99-ov-sub">${msg ?? word}</div>`,
      buttons
    );

    if (isLast && allCleared) {
      api.onWin(3, opts.grandMessage ?? "99 关全部通关，你就是本游戏的小冠军！");
    }
  }

  function onLevelLose(level: number, msg?: string): void {
    if (settled || destroyed) return;
    settled = true;
    api.play("oops");
    const word = msg ?? LOSE_WORDS[Math.floor(Math.random() * LOSE_WORDS.length)];
    showOverlay(
      `<div class="l99-ov-big">🌈</div>
       <div class="l99-ov-title">就差一点点！</div>
       <div class="l99-ov-sub">${word}</div>`,
      [
        { label: "🔁 再试本关", onClick: () => startLevel(level) },
        { label: "🗺️ 回地图", ghost: true, onClick: () => showMap() }
      ]
    );
  }

  function startLevel(level: number): void {
    if (destroyed) return;
    cleanupLevel();
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
      wrap.remove();
    }
  };
}
