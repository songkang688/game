/**
 * 首页:标题、星星余额、分类页签、游戏卡片网格、家长入口。
 */
import type { GameCategory, GameModule } from "../engine/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../engine/types";
import { save } from "../engine/save";
import { isBgmOn, playSound, toggleBgm, toggleSound } from "../engine/audio";
import { showParentGate } from "./parentGate";
import { createAvatarImg } from "./avatars";

type Tab = "all" | GameCategory;

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

// ---------------------------------------------------------------------------
// 最近玩过:独立 localStorage key,只在 home.ts 里读写,不动 save.ts 的存档结构
// ---------------------------------------------------------------------------

const RECENT_KEY = "yiduo-yixing.recent.v1";
const RECENT_SHOWN = 4;

function loadRecentIds(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function recordRecent(id: string): void {
  try {
    const next = [id, ...loadRecentIds().filter((x) => x !== id)].slice(0, 8);
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 存不进去(隐私模式等)就算了,不影响游玩
  }
}

/** 只读 99 关框架的存档(yiduo-yixing.l99.<id>),返回已通关数;没有存档返回 null */
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
  heroBubble.innerHTML = `<strong>${greetingText()}朵朵和星星请你来玩!</strong><span>今天想玩什么呀?挑一张卡片吧 🌈</span>`;
  const heroXingxing = createAvatarImg("xingxingRun", {
    round: false,
    className: "hero-figure hero-figure--xingxing"
  });
  hero.append(heroDuoduo, heroBubble, heroXingxing);
  screen.appendChild(hero);

  // ---- 最近玩过(空则整个分区不显示) ----
  const recentSection = document.createElement("section");
  recentSection.className = "recent-section";
  recentSection.setAttribute("aria-label", "最近玩过");
  screen.appendChild(recentSection);

  // ---- 分类页签 ----
  const tabs = document.createElement("nav");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "游戏分类");
  screen.appendChild(tabs);

  // ---- 卡片区(全部页签按分类分节,其余页签单个网格) ----
  const main = document.createElement("main");
  main.className = "home-main";
  screen.appendChild(main);

  const footer = document.createElement("footer");
  footer.className = "home-footer";
  footer.textContent = "🌱 无广告 · 不联网 · 进度只存在这台设备上";
  screen.appendChild(footer);

  let activeTab: Tab = "all";

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

  function openGame(id: string): void {
    playSound("pop");
    recordRecent(id);
    location.hash = `#/game/${encodeURIComponent(id)}`;
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
    for (const game of recent) {
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
      const cleared = l99ClearedCount(meta.id);
      if (cleared !== null && cleared > 0) {
        sub.textContent = `🚩 ${cleared}/99 关`;
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
      row.appendChild(card);
    }
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

    // 99 关进度徽章:只读 yiduo-yixing.l99.<id>,有进度才显示
    const cleared = l99ClearedCount(meta.id);
    if (cleared !== null && cleared > 0) {
      const badge = document.createElement("span");
      badge.className = "card-progress";
      badge.textContent = `🚩 ${cleared}/99`;
      badge.title = `已闯过 ${cleared} 关`;
      metaRow.appendChild(badge);
    }

    card.append(emoji, titleEl, blurb, metaRow);
    card.addEventListener("click", () => openGame(meta.id));
    return card;
  }

  function renderGrid(): void {
    main.innerHTML = "";

    if (games.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-emoji" aria-hidden="true">🌱</div><p>小游戏正在路上,很快就到啦!</p>`;
      main.appendChild(empty);
      return;
    }

    if (activeTab === "all") {
      // 全部页签:按分类分小节,孩子滚动时有方位感
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

    const shown = games.filter((g) => g.meta.category === activeTab);
    const grid = document.createElement("div");
    grid.className = "grid";
    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-emoji" aria-hidden="true">🌱</div><p>这个分类还没有游戏,去别的分类看看吧!</p>`;
      grid.appendChild(empty);
    } else {
      shown.forEach((game, i) => grid.appendChild(createGameCard(game, i)));
    }
    main.appendChild(grid);
  }

  renderTabs();
  renderRecent();
  renderGrid();

  return () => {
    unsubscribe();
    screen.remove();
  };
}
