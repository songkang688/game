/**
 * 首页:标题、星星余额、分类页签、游戏卡片网格、家长入口。
 */
import type { GameCategory, GameModule } from "../engine/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../engine/types";
import { save } from "../engine/save";
import { playSound, toggleSound } from "../engine/audio";
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

  actions.append(starChip, soundBtn, parentBtn);
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
  heroBubble.innerHTML = `<strong>朵朵和星星请你来玩!</strong><span>今天想玩什么呀?挑一张卡片吧 🌈</span>`;
  const heroXingxing = createAvatarImg("xingxingRun", {
    round: false,
    className: "hero-figure hero-figure--xingxing"
  });
  hero.append(heroDuoduo, heroBubble, heroXingxing);
  screen.appendChild(hero);

  // ---- 分类页签 ----
  const tabs = document.createElement("nav");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "游戏分类");
  screen.appendChild(tabs);

  // ---- 卡片网格 ----
  const grid = document.createElement("main");
  grid.className = "grid";
  screen.appendChild(grid);

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

  function renderGrid(): void {
    grid.innerHTML = "";
    const shown =
      activeTab === "all" ? games : games.filter((g) => g.meta.category === activeTab);

    if (shown.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `<div class="empty-emoji" aria-hidden="true">🌱</div><p>${
        games.length === 0 ? "小游戏正在路上,很快就到啦!" : "这个分类还没有游戏,去别的分类看看吧!"
      }</p>`;
      grid.appendChild(empty);
      return;
    }

    for (const game of shown) {
      const { meta } = game;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "game-card";
      card.style.setProperty("--card-color", meta.color);

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

      const best = document.createElement("span");
      best.className = "card-best";
      const progress = save.getGameProgress(meta.id);
      best.textContent =
        progress.bestStars > 0
          ? "⭐".repeat(progress.bestStars) + "☆".repeat(3 - progress.bestStars)
          : "☆☆☆";

      card.append(emoji, titleEl, blurb, best);
      card.addEventListener("click", () => {
        playSound("pop");
        location.hash = `#/game/${encodeURIComponent(meta.id)}`;
      });
      grid.appendChild(card);
    }
  }

  renderTabs();
  renderGrid();

  return () => {
    unsubscribe();
    screen.remove();
  };
}
