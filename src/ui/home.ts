/**
 * 首页:标题、星星余额、收藏区、最近玩过、分类页签 + 玩法芯片 + 搜索、游戏卡片网格、家长入口。
 *
 * 「怎么筛、怎么搜、怎么排、徽章写什么」全在 homeFilters.ts 里(纯函数、有单测),
 * 这个文件只管把结果画出来、接事件。
 */
import type { GameCategory, GameModule } from "../engine/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../engine/types";
import { save } from "../engine/save";
import { isBgmOn, playSound, toggleBgm, toggleSound } from "../engine/audio";
import { showParentGate } from "./parentGate";
import { createAvatarImg } from "./avatars";
import { RECENT_SHOWN, loadRecentIds } from "./recent";
import { applyMobileTextVars } from "./mobileText";
import {
  MODE_CHIPS,
  PLATFORM_CHIPS,
  emptyStateText,
  favoriteGames,
  filterGames,
  heroSubtitle,
  windowTitle,
  isFav,
  isFiltering,
  levelTotalOf,
  loadFavIds,
  progressBadgeText,
  saveFavIds,
  toggleFavIds,
  type ModeChip,
  type PlatformChip,
  type Tab
} from "./homeFilters";

const TAB_EMOJI: Record<Tab, string> = {
  all: "🌈",
  action: "🚀",
  casual: "🍭",
  party: "🤝",
  edu: "📚",
  create: "🎨"
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "全部" },
  ...CATEGORY_ORDER.map((c) => ({ key: c as Tab, label: CATEGORY_LABELS[c] }))
];

/**
 * 第 6 步的「收藏册」是另一个窗口在做的,可能还没进仓库。
 * 用 glob 探一眼:文件不在就连按钮都不出现,绝不因为缺模块把首页打崩。
 */
const COLLECTION_MODULES = import.meta.glob("./collection.ts");
const COLLECTION_PATH = "./collection.ts";

function hasCollection(): boolean {
  return typeof COLLECTION_MODULES[COLLECTION_PATH] === "function";
}

/**
 * 「管理员权限」入口(1.2):`rootGate.ts` 可能还没进仓库,
 * 同样用 glob 探一眼,模块不在就连按钮都不出现,首页绝不因此崩。
 */
const ROOT_GATE_MODULES = import.meta.glob("./rootGate.ts");
const ROOT_GATE_PATH = "./rootGate.ts";

function hasRootGate(): boolean {
  return typeof ROOT_GATE_MODULES[ROOT_GATE_PATH] === "function";
}

async function openRootGateSafely(): Promise<void> {
  const loader = ROOT_GATE_MODULES[ROOT_GATE_PATH];
  if (typeof loader !== "function") return;
  try {
    const mod = (await loader()) as { requestRootOpen?: (reason: string) => Promise<boolean> };
    await mod.requestRootOpen?.("管理员要打开直达关卡");
  } catch {
    // 密码门加载失败就当没这个按钮,首页照常玩
  }
}

async function openCollectionSafely(): Promise<void> {
  const loader = COLLECTION_MODULES[COLLECTION_PATH];
  if (typeof loader !== "function") return;
  try {
    const mod = (await loader()) as { openCollection?: () => void };
    mod.openCollection?.();
  } catch {
    // 收藏册加载失败就当没这个按钮,首页照常玩
  }
}

/** 1.1 新增控件的样式:styles.css 归别的窗口管,这里只补自己新加的那几个类 */
const HOME_EXTRA_CSS = `
.home-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0 18px}
/* min-width 缺省是 auto,搜索框会被自动最小尺寸撑到 370px,
   360px 手机上「清空」的 ✕ 会被屏幕裁掉一半;夹成 0 才会跟着容器缩 */
.home-search{flex:1 1 190px;min-width:0;display:flex;align-items:center;gap:8px;min-height:50px;
  padding:0 12px 0 16px;
  border:3px solid #fff;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:var(--shadow-soft)}
.home-search-input{flex:1;min-width:0;border:0;outline:0;background:transparent;
  font-family:inherit;font-size:17px;font-weight:700;color:var(--ink)}
.home-search-input::placeholder{color:var(--ink-soft);opacity:.7;font-weight:600}
.home-search-clear{display:grid;place-items:center;flex:0 0 auto;min-width:44px;min-height:44px;
  border:0;background:transparent;font-size:19px;line-height:1;color:var(--ink-soft)}
.tabs.cat-tabs{margin-bottom:2px}
.tabs.mode-chips{margin:0;padding-top:0;gap:10px}
.mode-chips .tab{min-height:46px;padding:0 18px;font-size:17px}
.mode-chips .tab-emoji{font-size:19px}
.tabs.platform-chips{margin:0 0 4px;padding-top:0;gap:10px}
.platform-chips .tab{min-height:46px;padding:0 18px;font-size:17px}
.platform-chips .tab-emoji{font-size:19px}
/* 管理员入口:大人才用,做得不显眼,但热区仍是 44×44 */
.icon-btn--admin{opacity:.55;font-size:17px}
.icon-btn--admin:hover,.icon-btn--admin:focus-visible{opacity:1}
/* 心形是卡片的兄弟节点(按钮不能套按钮),浮在卡片右上角,热区 44×44 */
.fav-slot{position:relative;display:flex}
.fav-slot>.game-card,.fav-slot>.recent-card{flex:1;min-width:0}
.fav-btn{position:absolute;top:2px;right:2px;display:grid;place-items:center;
  min-width:44px;min-height:44px;border:0;background:transparent;font-size:22px;line-height:1;
  filter:grayscale(1) opacity(.5);transition:transform .14s ease,filter .14s ease}
.fav-btn:hover{transform:scale(1.16)}
.fav-btn[aria-pressed="true"]{filter:none}
.fav-slot:hover>.fav-btn{transform:translateY(-5px)}
.fav-slot:hover>.fav-btn:hover{transform:translateY(-5px) scale(1.16)}
/* 收藏区的小卡:心形浮角不占宽度,游戏名才不会被挤成省略号 */
.fav-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.fav-grid .recent-info{flex:1 1 auto;min-width:0;padding-right:18px}
.fav-grid .fav-btn{top:-4px;right:-4px;font-size:17px}
/* 窄屏两列。1fr 的下限是 min-content,320px 上第二张卡会顶出屏幕,这里夹成 minmax(0,1fr) */
@media (max-width:380px){
  .recent-grid,.fav-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (prefers-reduced-motion:reduce){
  .fav-btn,.fav-btn:hover,.fav-slot:hover>.fav-btn,.fav-slot:hover>.fav-btn:hover{transform:none}
}
.home-count{font-size:16px;line-height:1.45;font-weight:700;color:var(--ink-soft);margin:0 0 10px}
`;

const EXTRA_STYLE_ID = "home-extra-style";

function ensureExtraStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(EXTRA_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = EXTRA_STYLE_ID;
  style.textContent = HOME_EXTRA_CSS;
  document.head.appendChild(style);
}

/** 只读 188 关框架的存档(yiduo-yixing.l99.<id>),返回已通关数;没有存档返回 null */
function l99ClearedCount(id: string): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(`yiduo-yixing.l99.${id}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    let cleared = 0;
    for (const v of parsed) {
      if (typeof v === "number" && v > 0) cleared++;
    }
    return cleared;
  } catch {
    return null;
  }
}

/** 按时段变的问候语(可爱度加分项) */
function greetingText(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深啦!";
  if (h < 12) return "早上好!";
  if (h < 18) return "下午好!";
  return "晚上好!";
}

export function renderHome(container: HTMLElement, games: GameModule[]): () => void {
  ensureExtraStyle();

  const screen = document.createElement("div");
  screen.className = "screen home-screen";
  container.appendChild(screen);

  // ---- 顶部 ----
  const header = document.createElement("header");
  header.className = "home-header";

  const logo = document.createElement("div");
  logo.className = "logo";
  const logoDuoduo = createAvatarImg("duoduo", { className: "logo-avatar logo-avatar--duoduo" });
  const logoTitle = document.createElement("h1");
  logoTitle.innerHTML = `<span class="logo-emoji logo-emoji--flower" aria-hidden="true">🌸</span>一朵一星<span class="logo-emoji logo-emoji--star" aria-hidden="true">⭐</span>`;
  const logoXingxing = createAvatarImg("xingxing", {
    className: "logo-avatar logo-avatar--xingxing"
  });
  logo.append(logoDuoduo, logoTitle, logoXingxing);
  header.appendChild(logo);

  const actions = document.createElement("div");
  actions.className = "header-actions";

  const starChip = document.createElement("div");
  starChip.className = "chip star-chip";
  starChip.title = "我的星星";
  const renderStars = (): void => {
    starChip.textContent = `⭐ ${save.getStars()}`;
  };
  renderStars();
  const unsubscribe = save.onChange(renderStars);

  const soundBtn = document.createElement("button");
  soundBtn.type = "button";
  soundBtn.className = "icon-btn";
  soundBtn.title = "音效开关";
  const renderSound = (): void => {
    soundBtn.textContent = save.isSoundOn() ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-label", save.isSoundOn() ? "关闭音效" : "打开音效");
  };
  renderSound();
  soundBtn.addEventListener("click", () => {
    toggleSound();
    renderSound();
  });

  const bgmBtn = document.createElement("button");
  bgmBtn.type = "button";
  bgmBtn.className = "icon-btn";
  bgmBtn.title = "背景音乐";
  const renderBgm = (): void => {
    const on = isBgmOn();
    bgmBtn.textContent = "🎵";
    bgmBtn.style.opacity = on ? "1" : "0.4";
    bgmBtn.setAttribute("aria-pressed", String(on));
    bgmBtn.setAttribute("aria-label", on ? "关闭背景音乐" : "打开背景音乐");
  };
  renderBgm();
  bgmBtn.addEventListener("click", () => {
    toggleBgm();
    renderBgm();
  });

  const parentBtn = document.createElement("button");
  parentBtn.type = "button";
  parentBtn.className = "icon-btn";
  parentBtn.title = "家长说明";
  parentBtn.setAttribute("aria-label", "家长说明");
  parentBtn.textContent = "👪";
  parentBtn.addEventListener("click", () => {
    playSound("tap");
    showParentGate();
  });

  actions.append(starChip, soundBtn, bgmBtn, parentBtn);

  // 管理员权限入口:密码门模块进仓库了才出现,文案不写「root」
  if (hasRootGate()) {
    const adminBtn = document.createElement("button");
    adminBtn.type = "button";
    adminBtn.className = "icon-btn icon-btn--admin";
    adminBtn.title = "管理员权限";
    adminBtn.setAttribute("aria-label", "管理员权限");
    adminBtn.textContent = "🔑";
    adminBtn.addEventListener("click", () => {
      playSound("tap");
      void openRootGateSafely();
    });
    actions.appendChild(adminBtn);
  }

  // 收藏册入口:第 6 步的模块进仓库了才出现
  if (hasCollection()) {
    const collectionBtn = document.createElement("button");
    collectionBtn.type = "button";
    collectionBtn.className = "icon-btn";
    collectionBtn.title = "我的收藏册";
    collectionBtn.setAttribute("aria-label", "我的收藏册");
    collectionBtn.textContent = "🎁";
    collectionBtn.addEventListener("click", () => {
      playSound("tap");
      void openCollectionSafely();
    });
    actions.appendChild(collectionBtn);
  }

  header.appendChild(actions);
  screen.appendChild(header);

  // ---- 问候语:朵朵和星星的欢迎气泡 ----
  const hero = document.createElement("div");
  hero.className = "home-hero";
  const heroDuoduo = createAvatarImg("duoduoCheer", {
    round: false,
    className: "hero-figure hero-figure--duoduo"
  });
  const heroBubble = document.createElement("div");
  heroBubble.className = "hero-bubble";
  // 款数和关数都当场数,别写死:每加一批新游戏都要回来改数字的话,迟早会忘。
  // 具体那句话怎么组由 `heroSubtitle` 拼(它连 0 款 / NaN 这些脏值也有兜底,单测盯着)。
  const heroStrong = document.createElement("strong");
  heroStrong.textContent = `${greetingText()}朵朵和星星请你来玩!`;
  const heroSpan = document.createElement("span");
  heroSpan.textContent = heroSubtitle(
    games.length,
    games.reduce((m, g) => Math.max(m, levelTotalOf(g.meta)), 0)
  );
  document.title = windowTitle(games.length);
  heroBubble.append(heroStrong, heroSpan);
  const heroXingxing = createAvatarImg("xingxingRun", {
    round: false,
    className: "hero-figure hero-figure--xingxing"
  });
  hero.append(heroDuoduo, heroBubble, heroXingxing);
  screen.appendChild(hero);

  // ---- 收藏区(置顶,空则整个分区不显示) ----
  const favSection = document.createElement("section");
  favSection.className = "recent-section";
  favSection.setAttribute("aria-label", "我的最爱");
  screen.appendChild(favSection);

  // ---- 最近玩过(空则整个分区不显示) ----
  const recentSection = document.createElement("section");
  recentSection.className = "recent-section";
  recentSection.setAttribute("aria-label", "最近玩过");
  screen.appendChild(recentSection);

  // ---- 分类页签 ----
  const tabs = document.createElement("nav");
  tabs.className = "tabs cat-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "游戏分类");
  screen.appendChild(tabs);

  // ---- 玩法筛选芯片(与分类页签叠加) ----
  const modeBar = document.createElement("nav");
  modeBar.className = "tabs mode-chips";
  modeBar.setAttribute("role", "tablist");
  modeBar.setAttribute("aria-label", "玩法筛选");
  screen.appendChild(modeBar);

  // ---- 平台筛选芯片(手游 / 端游,与前两排叠加) ----
  const platformBar = document.createElement("nav");
  platformBar.className = "tabs platform-chips";
  platformBar.setAttribute("role", "tablist");
  platformBar.setAttribute("aria-label", "设备筛选");
  screen.appendChild(platformBar);

  // ---- 搜索框 ----
  const toolbar = document.createElement("div");
  toolbar.className = "home-toolbar";
  const searchBox = document.createElement("div");
  searchBox.className = "home-search";
  const searchIcon = document.createElement("span");
  searchIcon.setAttribute("aria-hidden", "true");
  searchIcon.textContent = "🔍";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "home-search-input";
  searchInput.placeholder = "找游戏:打名字或拼音首字母";
  searchInput.setAttribute("aria-label", "搜索游戏,可以打名字或者拼音首字母");
  searchInput.autocomplete = "off";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "home-search-clear";
  clearBtn.textContent = "✖";
  clearBtn.title = "清空";
  clearBtn.setAttribute("aria-label", "清空搜索");
  clearBtn.hidden = true;
  searchBox.append(searchIcon, searchInput, clearBtn);
  toolbar.appendChild(searchBox);
  screen.appendChild(toolbar);

  // ---- 卡片区(不筛不搜时按分类分节,否则一整片结果) ----
  const main = document.createElement("main");
  main.className = "home-main";
  screen.appendChild(main);

  const footer = document.createElement("footer");
  footer.className = "home-footer";
  footer.textContent = "🌱 无广告 · 不联网 · 进度只存在这台设备上";
  screen.appendChild(footer);

  let activeTab: Tab = "all";
  let activeMode: ModeChip = "all";
  let activePlatform: PlatformChip = "all";
  let query = "";
  let favIds = loadFavIds(globalThis.localStorage);

  function renderTabs(): void {
    tabs.innerHTML = "";
    for (const { key, label } of TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tab ${key === activeTab ? "tab--active" : ""}`.trim();
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(key === activeTab));
      const tabEmoji = document.createElement("span");
      tabEmoji.className = "tab-emoji";
      tabEmoji.setAttribute("aria-hidden", "true");
      tabEmoji.textContent = TAB_EMOJI[key];
      const tabLabel = document.createElement("span");
      tabLabel.textContent = label;
      btn.append(tabEmoji, tabLabel);
      btn.addEventListener("click", () => {
        if (activeTab === key) return;
        activeTab = key;
        playSound("tap");
        renderTabs();
        renderGrid();
      });
      tabs.appendChild(btn);
    }
  }

  function renderModeChips(): void {
    modeBar.innerHTML = "";
    for (const { key, emoji, label } of MODE_CHIPS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tab ${key === activeMode ? "tab--active" : ""}`.trim();
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(key === activeMode));
      const em = document.createElement("span");
      em.className = "tab-emoji";
      em.setAttribute("aria-hidden", "true");
      em.textContent = emoji;
      const text = document.createElement("span");
      text.textContent = label;
      btn.append(em, text);
      btn.addEventListener("click", () => {
        if (activeMode === key) return;
        activeMode = key;
        playSound("tap");
        renderModeChips();
        renderGrid();
      });
      modeBar.appendChild(btn);
    }
  }

  function renderPlatformChips(): void {
    platformBar.innerHTML = "";
    for (const { key, emoji, label } of PLATFORM_CHIPS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `tab ${key === activePlatform ? "tab--active" : ""}`.trim();
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(key === activePlatform));
      btn.setAttribute("aria-pressed", String(key === activePlatform));
      const em = document.createElement("span");
      em.className = "tab-emoji";
      em.setAttribute("aria-hidden", "true");
      em.textContent = emoji;
      const text = document.createElement("span");
      text.textContent = label;
      btn.append(em, text);
      btn.addEventListener("click", () => {
        if (activePlatform === key) return;
        activePlatform = key;
        playSound("tap");
        renderPlatformChips();
        renderGrid();
      });
      platformBar.appendChild(btn);
    }
  }

  function openGame(id: string): void {
    playSound("pop");
    // 「最近玩过」由游戏壳在真正进入游戏时记录(深链进入也算),这里只负责跳转
    location.hash = `#/game/${encodeURIComponent(id)}`;
  }

  function toggleFav(id: string): void {
    favIds = toggleFavIds(id, favIds);
    saveFavIds(favIds, globalThis.localStorage);
    playSound(isFav(id, favIds) ? "coin" : "tap");
    renderFavorites();
    renderRecent();
    renderGrid();
  }

  /**
   * 把卡片和收藏心形并排放进一个定位容器:
   * 心形绝对定位浮在卡片右上角,既不套在卡片按钮里(按钮不能嵌按钮),也不占走标题的宽度。
   */
  function withFavHeart(card: HTMLElement, id: string, title: string, extraClass = ""): HTMLElement {
    const slot = document.createElement("div");
    slot.className = `fav-slot ${extraClass}`.trim();
    const on = isFav(id, favIds);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-btn";
    btn.textContent = on ? "💖" : "🤍";
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? `把 ${title} 移出最爱` : `把 ${title} 加进最爱`);
    btn.title = on ? "移出最爱" : "加进最爱";
    btn.addEventListener("click", () => toggleFav(id));
    slot.append(card, btn);
    return slot;
  }

  function makeSectionTitle(emoji: string, text: string): HTMLElement {
    const h = document.createElement("h2");
    h.className = "section-title";
    const em = document.createElement("span");
    em.className = "section-emoji";
    em.setAttribute("aria-hidden", "true");
    em.textContent = emoji;
    const label = document.createElement("span");
    label.textContent = text;
    h.append(em, label);
    return h;
  }

  /** 收藏区与最近玩过共用的小卡片(收藏区多一颗心形) */
  function createSmallCard(game: GameModule, withFav: boolean): HTMLElement {
    const { meta } = game;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "recent-card";
    card.style.setProperty("--card-color", meta.color);
    card.setAttribute("aria-label", `继续玩 ${meta.title}`);

    const emoji = document.createElement("span");
    emoji.className = "recent-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = meta.emoji;

    const info = document.createElement("span");
    info.className = "recent-info";
    const name = document.createElement("span");
    name.className = "recent-name";
    name.textContent = meta.title;
    const sub = document.createElement("span");
    sub.className = "recent-sub";
    const badge = progressBadgeText(l99ClearedCount(meta.id), meta);
    if (badge) {
      sub.textContent = `${badge} 关`;
    } else {
      const progress = save.getGameProgress(meta.id);
      sub.textContent =
        progress.bestStars > 0
          ? "⭐".repeat(progress.bestStars) + "☆".repeat(3 - progress.bestStars)
          : "继续玩 ▶";
    }
    info.append(name, sub);

    card.append(emoji, info);
    card.addEventListener("click", () => openGame(meta.id));
    return withFav ? withFavHeart(card, meta.id, meta.title) : card;
  }

  function renderFavorites(): void {
    favSection.innerHTML = "";
    const favs = favoriteGames(games, favIds);
    if (favs.length === 0) {
      favSection.hidden = true;
      return;
    }
    favSection.hidden = false;
    favSection.appendChild(makeSectionTitle("💖", "我的最爱"));
    const row = document.createElement("div");
    row.className = "recent-grid fav-grid";
    for (const game of favs) row.appendChild(createSmallCard(game, true));
    favSection.appendChild(row);
  }

  function renderRecent(): void {
    recentSection.innerHTML = "";
    const recent = loadRecentIds()
      .map((id) => games.find((g) => g.meta.id === id))
      .filter((g): g is GameModule => Boolean(g))
      .slice(0, RECENT_SHOWN);
    if (recent.length === 0) {
      recentSection.hidden = true;
      return;
    }
    recentSection.hidden = false;
    recentSection.appendChild(makeSectionTitle("⏰", "最近玩过"));

    const row = document.createElement("div");
    row.className = "recent-grid";
    for (const game of recent) row.appendChild(createSmallCard(game, false));
    recentSection.appendChild(row);
  }

  function createGameCard(game: GameModule, index: number): HTMLElement {
    const { meta } = game;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "game-card";
    card.style.setProperty("--card-color", meta.color);
    // 错峰浮现动画的序号(封顶,后面的卡片不再继续拖延)
    card.style.setProperty("--card-i", String(Math.min(index, 11)));

    const emoji = document.createElement("span");
    emoji.className = "card-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = meta.emoji;

    const titleEl = document.createElement("span");
    titleEl.className = "card-title";
    titleEl.textContent = meta.title;

    const blurb = document.createElement("span");
    blurb.className = "card-blurb";
    blurb.textContent = meta.blurb;

    const metaRow = document.createElement("span");
    metaRow.className = "card-meta";

    const best = document.createElement("span");
    best.className = "card-best";
    const progress = save.getGameProgress(meta.id);
    best.textContent =
      progress.bestStars > 0
        ? "⭐".repeat(progress.bestStars) + "☆".repeat(3 - progress.bestStars)
        : "☆☆☆";
    metaRow.appendChild(best);

    // 闯关进度徽章:只读 yiduo-yixing.l99.<id>,有进度才显示,分母取 meta.levels
    const badge = progressBadgeText(l99ClearedCount(meta.id), meta);
    if (badge) {
      const badgeEl = document.createElement("span");
      badgeEl.className = "card-progress";
      badgeEl.textContent = badge;
      badgeEl.title = `已闯过 ${badge.replace("🚩 ", "")} 关`;
      metaRow.appendChild(badgeEl);
    }

    card.append(emoji, titleEl, blurb, metaRow);
    card.addEventListener("click", () => openGame(meta.id));
    return withFavHeart(card, meta.id, meta.title);
  }

  function makeEmptyState(): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const em = document.createElement("div");
    em.className = "empty-emoji";
    em.setAttribute("aria-hidden", "true");
    em.textContent = "🌱";
    const p = document.createElement("p");
    p.textContent = emptyStateText({
      tab: activeTab,
      mode: activeMode,
      platform: activePlatform,
      query
    });
    empty.append(em, p);
    return empty;
  }

  function renderGrid(): void {
    main.innerHTML = "";

    if (games.length === 0) {
      main.appendChild(makeEmptyState());
      return;
    }

    const filtering = isFiltering({ mode: activeMode, platform: activePlatform, query });

    // 不筛玩法也不搜索时,「全部」页签仍旧按分类分小节,孩子滚动时有方位感
    if (!filtering && activeTab === "all") {
      for (const category of CATEGORY_ORDER) {
        const inCategory = games.filter((g) => g.meta.category === category);
        if (inCategory.length === 0) continue;
        const section = document.createElement("section");
        section.className = "category-section";
        section.setAttribute("aria-label", CATEGORY_LABELS[category]);
        section.appendChild(makeSectionTitle(TAB_EMOJI[category], CATEGORY_LABELS[category]));
        const grid = document.createElement("div");
        grid.className = "grid";
        inCategory.forEach((game, i) => grid.appendChild(createGameCard(game, i)));
        section.appendChild(grid);
        main.appendChild(section);
      }
      return;
    }

    const shown = filterGames(games, {
      tab: activeTab,
      mode: activeMode,
      platform: activePlatform,
      query
    });
    if (filtering && shown.length > 0) {
      const count = document.createElement("p");
      count.className = "home-count";
      count.setAttribute("role", "status");
      count.textContent = `找到 ${shown.length} 个游戏 🎉`;
      main.appendChild(count);
    }

    const grid = document.createElement("div");
    grid.className = "grid";
    if (shown.length === 0) {
      grid.appendChild(makeEmptyState());
    } else {
      shown.forEach((game, i) => grid.appendChild(createGameCard(game, i)));
    }
    main.appendChild(grid);
  }

  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    clearBtn.hidden = query.trim() === "";
    renderGrid();
  });
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    query = "";
    clearBtn.hidden = true;
    playSound("tap");
    renderGrid();
    searchInput.focus();
  });

  applyMobileTextVars(screen);
  renderTabs();
  renderModeChips();
  renderPlatformChips();
  renderFavorites();
  renderRecent();
  renderGrid();

  return () => {
    unsubscribe();
    screen.remove();
  };
}
