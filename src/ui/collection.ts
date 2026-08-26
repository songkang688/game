/**
 * 「小屋 · 收藏」面板(1.1 第 6 步新增)。
 *
 * 卡片式地列出人物 / 宠物 / 装备,标清楚已解锁与还差多少颗星,
 * 左边一块 Canvas 实时画出试穿效果——**小人是现画的,一张外部图片都不用**。
 *
 * 面板不绑死任何一款游戏:`openCollection(scope?)` 谁都能开,
 * `scope` 只影响顶上那一句「这一身现在给谁用」的说明。
 *
 * 样式由本文件自己注入一段带 `collection-` 前缀的 `<style>`
 * (和 `home.ts` 注入 `HOME_EXTRA_CSS` 的做法一致),不去动公共的 `styles.css`。
 *
 * 关掉面板 = 摘掉全部监听:`keydown`、卡片点击所在的整棵 DOM、以及收藏册的订阅,
 * 一个都不留(见 `collection.test.ts` 的监听泄漏用例)。
 */
import type {
  Bonus,
  CollectionItem,
  CollectionStore,
  ItemKind,
  Loadout
} from "../engine/collection";
import {
  MAX_LEVEL,
  SLOT_LABELS,
  STAT_KEYS,
  STAT_LABELS,
  collection,
  describeStats,
  formatPermille,
  itemsOfKind,
  unlockCost,
  upgradeCost
} from "../engine/collection";
import { playSound } from "../engine/audio";

// ---------------------------------------------------------------------------
// 文案(纯函数,好测)
// ---------------------------------------------------------------------------

export const PANEL_TITLE = "🏡 小屋 · 收藏";

/** 已经认识的调用方;认不出的 scope 一律按「这一身到哪儿都能穿」处理 */
export const SCOPE_LABELS: Record<string, string> = {
  "rainbow-run": "彩虹跑跑",
  "duo-rush": "朵星双人冲刺"
};

/** 顶上那句说明:这一身现在给谁用 */
export function scopeNote(scope?: string): string {
  const key = typeof scope === "string" ? scope.trim() : "";
  if (!key) return "这一身在所有游戏里通用,换一次到处都算数。";
  const label = SCOPE_LABELS[key] ?? key;
  return `这一身会带进《${label}》,别的游戏里也照样穿着。`;
}

/** 星星余额显示 */
export function starsLabel(stars: number): string {
  const n = Number.isFinite(stars) ? Math.max(0, Math.floor(stars)) : 0;
  return `⭐ ${n}`;
}

/** 等级显示;还没解锁时给一句「还没解锁」 */
export function levelLabel(level: number): string {
  const lv = Number.isFinite(level) ? Math.floor(level) : 0;
  if (lv <= 0) return "还没解锁";
  return `Lv.${Math.min(MAX_LEVEL, lv)} / ${MAX_LEVEL}`;
}

export type CardState = "locked-poor" | "locked-ready" | "owned" | "equipped" | "max";

export interface CardStatus {
  state: CardState;
  /** 主按钮上的字;null = 这张卡没有主按钮(满级又穿着) */
  action: string | null;
  /** 主按钮要不要禁用(星星不够时仍然显示,但按不动) */
  disabled: boolean;
  /** 卡片右上角那行小字 */
  badge: string;
  /** 读屏软件听到的一句话 */
  aria: string;
}

/**
 * 一张卡片现在长什么样。
 * 没解锁 → 显示要多少星(不够就按不动);解锁了 → 能试穿、能升级;满级穿着 → 只剩一句「已穿戴」。
 */
export function cardStatus(
  item: CollectionItem,
  level: number,
  stars: number,
  equipped: boolean
): CardStatus {
  const lv = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  const purse = Number.isFinite(stars) ? Math.max(0, Math.floor(stars)) : 0;
  if (lv <= 0) {
    const cost = unlockCost(item);
    const ready = purse >= cost;
    return {
      state: ready ? "locked-ready" : "locked-poor",
      action: `解锁 ⭐${cost}`,
      disabled: !ready,
      badge: `需要 ${cost} 颗星`,
      aria: ready
        ? `${item.name},还没解锁,${cost} 颗星星可以解锁`
        : `${item.name},还没解锁,还差 ${cost - purse} 颗星星`
    };
  }
  if (lv >= MAX_LEVEL) {
    return {
      state: equipped ? "equipped" : "max",
      action: equipped ? null : "试穿",
      disabled: false,
      badge: `满级 ${levelLabel(lv)}`,
      aria: `${item.name},已经练到满级${equipped ? ",正穿在身上" : ""}`
    };
  }
  const price = upgradeCost(item, lv);
  const affordable = purse >= price;
  return {
    state: equipped ? "equipped" : "owned",
    action: `升级 ⭐${price}`,
    disabled: !affordable,
    badge: levelLabel(lv),
    aria: `${item.name},${levelLabel(lv)}${equipped ? ",正穿在身上" : ""},升一级要 ${price} 颗星星`
  };
}

/** 试穿预览下面那行字:现在这一身都有谁 */
export function outfitLine(loadout: Loadout): string {
  const parts = [loadout.hero.name];
  if (loadout.pet) parts.push(`${loadout.pet.name}(宠物)`);
  for (const gear of loadout.gear) parts.push(gear.name);
  return parts.join(" · ");
}

/** 加成清单;什么加成都没有时给一句好听的兜底 */
export function bonusLines(bonus: Bonus): string[] {
  const out: string[] = [];
  for (const key of STAT_KEYS) {
    const value = bonus[key] ?? 0;
    if (value > 0) out.push(`${STAT_LABELS[key]} +${formatPermille(value)}`);
  }
  return out.length > 0 ? out : ["还没有加成,先挑一件试试看"];
}

export interface TabDef {
  kind: ItemKind;
  label: string;
}

export const TABS: readonly TabDef[] = [
  { kind: "hero", label: "人物" },
  { kind: "pet", label: "宠物" },
  { kind: "gear", label: "装备" }
];

/** 装备卡上标一下是穿哪个部位的;人物和宠物卡不用重复标 */
export function slotTag(item: CollectionItem): string {
  return item.kind === "gear" ? SLOT_LABELS[item.slot] : "";
}

// ---------------------------------------------------------------------------
// 试穿预览:纯 Canvas 画一个原创小人(没有任何外部图片)
// ---------------------------------------------------------------------------

export interface FigurePalette {
  /** 衣服主色(跟着人物走) */
  body: string;
  /** 浅色底(脸和高光) */
  light: string;
  /** 披风颜色;没披风就是 null */
  cape: string | null;
  hat: string | null;
  goggles: string | null;
  shoes: string | null;
  gloves: string | null;
  scarf: string | null;
  /** 宠物颜色;没宠物就是 null */
  pet: string | null;
}

/** 从这一身推出画小人要用的颜色 */
export function figurePalette(loadout: Loadout): FigurePalette {
  const bySlot = new Map(loadout.gear.map((g) => [g.slot, g.color] as const));
  return {
    body: loadout.hero.color,
    light: loadout.hero.color2,
    cape: bySlot.get("cape") ?? null,
    hat: bySlot.get("hat") ?? null,
    goggles: bySlot.get("goggles") ?? null,
    shoes: bySlot.get("shoes") ?? null,
    gloves: bySlot.get("gloves") ?? null,
    scarf: bySlot.get("scarf") ?? null,
    pet: loadout.pet?.color ?? null
  };
}

/** 读屏软件听到的试穿描述(画面之外的另一条路) */
export function figureAlt(loadout: Loadout): string {
  const worn = loadout.gear.map((g) => `${SLOT_LABELS[g.slot]}是${g.name}`);
  const pet = loadout.pet ? `,${loadout.pet.name}跟在旁边` : "";
  const gear = worn.length > 0 ? `,${worn.join(",")}` : ",还没换装备";
  return `试穿预览:${loadout.hero.name}${gear}${pet}`;
}

/** Canvas 2D 里真正需要的那几笔,拆出来方便在没有 canvas 的环境里跳过 */
type Ctx2D = {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (x: number, y: number, r: number, a0: number, a1: number) => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  fill: () => void;
  fillStyle: string;
};

function circle(ctx: Ctx2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function box(ctx: Ctx2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * 画一个 Q 版小人:圆脑袋 + 圆身子 + 两条小短腿,按 palette 加帽子 / 披风 / 护目镜 / 鞋。
 * 全部是几何图形,任何尺寸都画得出来,不依赖图片资源。
 */
export function drawFigure(ctx: Ctx2D, width: number, height: number, palette: FigurePalette): void {
  const w = Math.max(40, width);
  const h = Math.max(60, height);
  const cx = w / 2;
  const unit = Math.min(w, h) / 10;
  const headR = unit * 1.6;
  const headY = h * 0.3;
  const bodyTop = headY + headR * 0.7;
  const bodyH = unit * 3.2;
  const bodyW = unit * 2.6;

  ctx.clearRect(0, 0, w, h);

  // 脚下压一道扁扁的影子(不用椭圆 API,一条圆角似的矮条就够意思)
  box(ctx, cx - unit * 1.7, bodyTop + bodyH + unit * 1.35, unit * 3.4, unit * 0.34, "rgba(90,70,110,0.10)");

  // 披风在身子后面
  if (palette.cape) {
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.55, bodyTop);
    ctx.lineTo(cx + bodyW * 0.55, bodyTop);
    ctx.lineTo(cx + bodyW * 0.95, bodyTop + bodyH * 1.15);
    ctx.lineTo(cx - bodyW * 0.95, bodyTop + bodyH * 1.15);
    ctx.closePath();
    ctx.fillStyle = palette.cape;
    ctx.fill();
  }

  // 身子:方角上圆一点,看起来像件小外套
  box(ctx, cx - bodyW / 2, bodyTop, bodyW, bodyH, palette.body);
  circle(ctx, cx, bodyTop + bodyH, bodyW / 2, palette.body);
  // 前襟用浅色分一道,身子才不是一整坨
  box(ctx, cx - bodyW * 0.2, bodyTop + bodyH * 0.22, bodyW * 0.4, bodyH * 0.66, palette.light);
  // 胳膊
  const armY = bodyTop + bodyH * 0.26;
  box(ctx, cx - bodyW * 0.74, armY, bodyW * 0.24, bodyH * 0.46, palette.body);
  box(ctx, cx + bodyW * 0.5, armY, bodyW * 0.24, bodyH * 0.46, palette.body);
  // 两条腿
  box(ctx, cx - bodyW * 0.34, bodyTop + bodyH, unit * 0.6, unit * 0.9, palette.body);
  box(ctx, cx + bodyW * 0.1, bodyTop + bodyH, unit * 0.6, unit * 0.9, palette.body);
  // 鞋
  const shoeColor = palette.shoes ?? palette.light;
  box(ctx, cx - bodyW * 0.42, bodyTop + bodyH + unit * 0.9, unit * 0.9, unit * 0.45, shoeColor);
  box(ctx, cx + bodyW * 0.05, bodyTop + bodyH + unit * 0.9, unit * 0.9, unit * 0.45, shoeColor);
  // 手套套在手上
  if (palette.gloves) {
    circle(ctx, cx - bodyW * 0.62, armY + bodyH * 0.46, unit * 0.4, palette.gloves);
    circle(ctx, cx + bodyW * 0.62, armY + bodyH * 0.46, unit * 0.4, palette.gloves);
  }
  // 围巾
  if (palette.scarf) {
    box(ctx, cx - bodyW * 0.6, bodyTop - unit * 0.3, bodyW * 1.2, unit * 0.55, palette.scarf);
  }

  // 脑袋与脸
  circle(ctx, cx, headY, headR, palette.light);
  // 头发:半个圆盖在脑袋上,颜色跟着人物走,六位主角一眼分得开
  ctx.beginPath();
  ctx.arc(cx, headY, headR, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = palette.body;
  ctx.fill();
  box(ctx, cx - headR, headY - headR * 0.1, headR * 2, headR * 0.16, palette.body);
  circle(ctx, cx - headR * 0.35, headY + headR * 0.22, unit * 0.19, "#5b5470");
  circle(ctx, cx + headR * 0.35, headY + headR * 0.22, unit * 0.19, "#5b5470");
  circle(ctx, cx - headR * 0.66, headY + headR * 0.5, unit * 0.26, "rgba(255,150,180,0.45)");
  circle(ctx, cx + headR * 0.66, headY + headR * 0.5, unit * 0.26, "rgba(255,150,180,0.45)");
  // 一张小小的笑嘴
  box(ctx, cx - unit * 0.22, headY + headR * 0.58, unit * 0.44, unit * 0.12, "#c98aa0");

  // 护目镜盖在眼睛上
  if (palette.goggles) {
    box(ctx, cx - headR * 0.9, headY + headR * 0.02, headR * 1.8, unit * 0.62, palette.goggles);
  }

  // 帽子
  if (palette.hat) {
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.15, headY - headR * 0.45);
    ctx.lineTo(cx + headR * 1.15, headY - headR * 0.45);
    ctx.lineTo(cx, headY - headR * 1.7);
    ctx.closePath();
    ctx.fillStyle = palette.hat;
    ctx.fill();
  }

  // 宠物蹲在旁边
  if (palette.pet) {
    const px = cx + bodyW * 1.5;
    const py = bodyTop + bodyH * 0.9;
    circle(ctx, px, py, unit * 0.95, palette.pet);
    circle(ctx, px - unit * 0.55, py - unit * 0.75, unit * 0.32, palette.pet);
    circle(ctx, px + unit * 0.55, py - unit * 0.75, unit * 0.32, palette.pet);
    circle(ctx, px - unit * 0.3, py - unit * 0.1, unit * 0.14, "#5b5470");
    circle(ctx, px + unit * 0.3, py - unit * 0.1, unit * 0.14, "#5b5470");
  }
}

// ---------------------------------------------------------------------------
// 样式(自己注入,不动公共 styles.css)
// ---------------------------------------------------------------------------

export const COLLECTION_STYLE_ID = "collection-style";

const COLLECTION_CSS = `
.collection-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:16px;background:rgba(60,40,70,.42);backdrop-filter:blur(2px)}
.collection-panel{display:flex;flex-direction:column;width:min(960px,100%);max-height:min(92vh,760px);
  border-radius:26px;border:4px solid #fff;background:linear-gradient(180deg,#fff7fb 0%,#f3f7ff 100%);
  box-shadow:0 18px 46px rgba(120,90,140,.28);overflow:hidden}
.collection-head{display:flex;align-items:center;gap:10px;padding:14px 18px;background:rgba(255,255,255,.75)}
.collection-title{flex:1 1 auto;margin:0;font-size:20px;color:#6b4d72}
.collection-stars{flex:0 0 auto;padding:4px 12px;border-radius:999px;background:#fff3c4;color:#8a6a1f;font-weight:700}
.collection-close{flex:0 0 auto;width:40px;height:40px;border:none;border-radius:50%;
  background:#ffe0ec;color:#a4557a;font-size:18px;cursor:pointer}
.collection-note{margin:0;padding:6px 18px 0;font-size:13px;color:#8a7a93}
.collection-body{display:flex;flex:1 1 auto;gap:14px;padding:12px 18px;overflow:hidden}
.collection-preview{flex:0 0 232px;display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:12px;border-radius:20px;background:rgba(255,255,255,.72)}
.collection-canvas{flex:0 0 auto;width:200px;height:230px;border-radius:16px;
  background:linear-gradient(180deg,#fdfbff,#eef4ff)}
.collection-meta{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
.collection-outfit{margin:0;font-size:13px;color:#6b4d72;text-align:center;line-height:1.5}
.collection-bonus{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.collection-bonus li{padding:3px 9px;border-radius:999px;background:#eaf6ff;color:#3f6d99;font-size:12px}
.collection-main{flex:1 1 auto;display:flex;flex-direction:column;min-width:0}
.collection-tabs{display:flex;gap:8px;padding-bottom:10px}
.collection-tab{padding:8px 18px;border:none;border-radius:999px;background:rgba(255,255,255,.8);
  color:#7a6a86;font-size:15px;cursor:pointer}
.collection-tab[aria-selected="true"]{background:#ffb3d1;color:#fff;font-weight:700}
.collection-grid{flex:1 1 auto;display:grid;gap:10px;overflow-y:auto;padding:2px 2px 8px;
  grid-template-columns:repeat(auto-fill,minmax(158px,1fr))}
.collection-card{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:18px;
  border:3px solid #fff;background:rgba(255,255,255,.85);box-shadow:0 6px 14px rgba(150,120,170,.14)}
.collection-card--locked{opacity:.78}
.collection-card--equipped{border-color:#ffb3d1}
.card-chip{height:52px;border-radius:14px}
.card-name{margin:0;font-size:15px;color:#5f4a6b}
.card-slot{font-size:11px;color:#a08fae;margin-left:6px}
.card-blurb{margin:0;font-size:12px;color:#8a7a93;line-height:1.45}
.card-stats{margin:0;font-size:12px;color:#3f6d99}
.card-badge{margin:0;font-size:12px;color:#a4557a}
.card-actions{display:flex;gap:6px;margin-top:auto;flex-wrap:wrap}
.card-btn{flex:1 1 auto;min-height:36px;padding:0 10px;border:none;border-radius:999px;
  background:#ffd6e7;color:#a4557a;font-size:13px;cursor:pointer}
.card-btn--try{background:#d8ecff;color:#3f6d99}
.card-btn[disabled]{opacity:.5;cursor:not-allowed}
.collection-foot{display:flex;align-items:center;gap:10px;padding:10px 18px 14px}
.collection-tip{flex:1 1 auto;margin:0;font-size:12px;color:#8a7a93}
.collection-done{min-height:42px;padding:0 22px;border:none;border-radius:999px;
  background:#ffb3d1;color:#fff;font-size:15px;font-weight:700;cursor:pointer}
@media (max-width:640px){
  .collection-overlay{padding:0}
  .collection-panel{width:100%;max-height:100%;height:100%;border-radius:0;border-width:0}
  .collection-body{flex-direction:column;overflow-y:auto}
  .collection-preview{flex:0 0 auto;flex-direction:row;align-items:center;gap:12px}
  .collection-canvas{width:112px;height:132px}
  .collection-meta{flex:1 1 auto;align-items:flex-start}
  .collection-outfit{text-align:left}
  .collection-bonus{justify-content:flex-start}
  .collection-grid{overflow:visible;grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
}
`;

/** 已经注入过样式的 document(极简 DOM 没有 getElementById,靠这张表兜底) */
const styledDocs = new WeakSet<Document>();

/** 样式只注入一次;`<head>` 还没准备好就静默跳过(面板照样能用,只是素一点) */
export function ensureStyles(doc: Document): void {
  try {
    if (styledDocs.has(doc)) return;
    if (doc.getElementById?.(COLLECTION_STYLE_ID)) return;
    const head = doc.head ?? doc.body;
    if (!head) return;
    styledDocs.add(doc);
    const style = doc.createElement("style");
    style.id = COLLECTION_STYLE_ID;
    style.textContent = COLLECTION_CSS;
    head.appendChild(style);
  } catch {
    // 样式注入失败不影响面板本身
  }
}

// ---------------------------------------------------------------------------
// 面板
// ---------------------------------------------------------------------------

export interface CollectionHandle {
  /** 面板根节点(role=dialog 的那一层) */
  el: HTMLElement;
  /** 关掉面板并摘掉全部监听 */
  close: () => void;
  /** `close` 的别名,和各游戏的 destroy 习惯对齐 */
  destroy: () => void;
}

export interface OpenCollectionOptions {
  /** 测试或多窗口时可以塞一个别的 document 进来 */
  doc?: Document;
  /** 测试时塞一本临时收藏册,默认用全局单例 */
  store?: CollectionStore;
  /** 关掉后焦点还给谁 */
  returnFocusTo?: HTMLElement | null;
  onClose?: () => void;
}

/** 同一时间只开一个面板,重复点开就把上一个收掉 */
let currentHandle: CollectionHandle | null = null;

/** 现在有没有开着的收藏面板(首页 / 游戏壳都可以拿去判断) */
export function isCollectionOpen(): boolean {
  return currentHandle !== null;
}

/** 关掉当前面板(没开就什么也不做) */
export function closeCollection(): void {
  currentHandle?.close();
}

function docOf(opts?: OpenCollectionOptions): Document {
  return opts?.doc ?? (globalThis as unknown as { document: Document }).document;
}

/**
 * 打开「小屋 · 收藏」面板。
 *
 * @param scope 谁开的(游戏 id);只影响顶上那句说明,收藏本身全游戏通用。
 */
export function openCollection(scope?: string, opts?: OpenCollectionOptions): CollectionHandle {
  currentHandle?.close();

  const doc = docOf(opts);
  const store = opts?.store ?? collection;
  ensureStyles(doc);

  const trigger =
    opts?.returnFocusTo !== undefined
      ? opts.returnFocusTo
      : ((doc.activeElement as HTMLElement | null) ?? null);

  let activeTab: ItemKind = "hero";
  let closed = false;

  const overlay = doc.createElement("div");
  overlay.className = "collection-overlay";

  const panel = doc.createElement("div");
  panel.className = "collection-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "小屋收藏");

  // ---- 顶栏 ----
  const head = doc.createElement("header");
  head.className = "collection-head";
  const title = doc.createElement("h2");
  title.className = "collection-title";
  title.textContent = PANEL_TITLE;
  const starsChip = doc.createElement("span");
  starsChip.className = "collection-stars";
  const closeBtn = doc.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "collection-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "关闭收藏面板");
  head.append(title, starsChip, closeBtn);

  const note = doc.createElement("p");
  note.className = "collection-note";
  note.textContent = scopeNote(scope);

  // ---- 试穿预览 ----
  const body = doc.createElement("div");
  body.className = "collection-body";

  const preview = doc.createElement("section");
  preview.className = "collection-preview";
  const canvas = doc.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "collection-canvas";
  canvas.width = 200;
  canvas.height = 230;
  canvas.setAttribute("role", "img");
  const outfit = doc.createElement("p");
  outfit.className = "collection-outfit";
  const bonusList = doc.createElement("ul");
  bonusList.className = "collection-bonus";
  // 窄屏时小人在左、文字在右,这一层包住文字才不会被挤成一列单字
  const meta = doc.createElement("div");
  meta.className = "collection-meta";
  meta.append(outfit, bonusList);
  preview.append(canvas, meta);

  // ---- 卡片区 ----
  const main = doc.createElement("div");
  main.className = "collection-main";
  const tabRow = doc.createElement("div");
  tabRow.className = "collection-tabs";
  tabRow.setAttribute("role", "tablist");
  const grid = doc.createElement("div");
  grid.className = "collection-grid";
  main.append(tabRow, grid);
  body.append(preview, main);

  // ---- 底栏 ----
  const foot = doc.createElement("footer");
  foot.className = "collection-foot";
  const tip = doc.createElement("p");
  tip.className = "collection-tip";
  tip.textContent = "星星都是玩游戏攒来的,这里不用花钱。";
  const doneBtn = doc.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "collection-done";
  doneBtn.textContent = "知道啦";
  foot.append(tip, doneBtn);

  // ---- 播报区(读屏软件听解锁结果) ----
  const live = doc.createElement("p");
  live.className = "collection-live sr-only";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");

  panel.append(head, note, body, foot, live);
  overlay.appendChild(panel);

  function say(message: string): void {
    live.textContent = live.textContent === message ? `${message}\u00a0` : message;
  }

  function renderPreview(): void {
    const loadout = store.loadout();
    outfit.textContent = outfitLine(loadout);
    canvas.setAttribute("aria-label", figureAlt(loadout));
    bonusList.textContent = "";
    for (const line of bonusLines(store.bonus())) {
      const li = doc.createElement("li");
      li.textContent = line;
      bonusList.appendChild(li);
    }
    // 没有 canvas 能力的环境(单测的极简 DOM、老浏览器)直接跳过,文字信息已经全了
    const ctx = (canvas as unknown as { getContext?: (id: string) => Ctx2D | null }).getContext?.(
      "2d"
    );
    if (ctx) drawFigure(ctx, canvas.width, canvas.height, figurePalette(loadout));
  }

  function makeCard(item: CollectionItem): HTMLElement {
    const level = store.getLevel(item.id);
    const equipped = store.isEquipped(item.id);
    const status = cardStatus(item, level, store.stars(), equipped);

    const card = doc.createElement("article");
    card.className = `collection-card${level <= 0 ? " collection-card--locked" : ""}${
      equipped ? " collection-card--equipped" : ""
    }`;
    card.setAttribute("data-item", item.id);
    card.setAttribute("aria-label", status.aria);

    const chip = doc.createElement("div");
    chip.className = "card-chip";
    chip.setAttribute("aria-hidden", "true");
    chip.style.background = `linear-gradient(135deg, ${item.color}, ${item.color2})`;

    const name = doc.createElement("h3");
    name.className = "card-name";
    name.textContent = item.name;
    const slot = doc.createElement("span");
    slot.className = "card-slot";
    slot.textContent = slotTag(item);
    name.appendChild(slot);

    const blurb = doc.createElement("p");
    blurb.className = "card-blurb";
    blurb.textContent = item.blurb;

    const stats = doc.createElement("p");
    stats.className = "card-stats";
    stats.textContent = describeStats(item, Math.max(1, level));

    const badge = doc.createElement("p");
    badge.className = "card-badge";
    badge.textContent = status.badge;

    const actions = doc.createElement("div");
    actions.className = "card-actions";

    if (status.action) {
      const actionBtn = doc.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "card-btn";
      actionBtn.textContent = status.action;
      if (status.disabled) actionBtn.disabled = true;
      actionBtn.addEventListener("click", () => {
        if (status.disabled) return;
        if (level <= 0) {
          const res = store.unlock(item.id);
          if (res.ok) {
            playSound("coin");
            store.equip(item.id);
            say(`${item.name}解锁啦,已经帮你穿上了`);
          } else {
            say(`星星还不太够,${item.name}再等等`);
          }
        } else if (level < MAX_LEVEL) {
          const res = store.upgrade(item.id);
          if (res.ok) {
            playSound("coin");
            say(`${item.name}升到 ${levelLabel(res.level)}`);
          } else {
            say(`星星还不太够,${item.name}这次升不了`);
          }
        } else {
          playSound("tap");
          store.equip(item.id);
          say(`换上${item.name}`);
        }
        render();
      });
      actions.appendChild(actionBtn);
    }

    if (level > 0) {
      const tryBtn = doc.createElement("button");
      tryBtn.type = "button";
      tryBtn.className = "card-btn card-btn--try";
      if (equipped && item.slot !== "hero") {
        tryBtn.textContent = "换下";
        tryBtn.addEventListener("click", () => {
          playSound("tap");
          store.unequip(item.slot);
          say(`把${item.name}收起来了`);
          render();
        });
        actions.appendChild(tryBtn);
      } else if (!equipped) {
        tryBtn.textContent = "试穿";
        tryBtn.addEventListener("click", () => {
          playSound("tap");
          store.equip(item.id);
          say(`换上${item.name}`);
          render();
        });
        actions.appendChild(tryBtn);
      }
    }

    card.append(chip, name, blurb, stats, badge, actions);
    return card;
  }

  function renderTabs(): void {
    tabRow.textContent = "";
    for (const tab of TABS) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "collection-tab";
      btn.textContent = tab.label;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.kind === activeTab));
      btn.addEventListener("click", () => {
        if (activeTab === tab.kind) return;
        activeTab = tab.kind;
        playSound("tap");
        render();
      });
      tabRow.appendChild(btn);
    }
  }

  function renderGrid(): void {
    grid.textContent = "";
    for (const item of itemsOfKind(activeTab)) grid.appendChild(makeCard(item));
  }

  function render(): void {
    if (closed) return;
    starsChip.textContent = starsLabel(store.stars());
    renderTabs();
    renderGrid();
    renderPreview();
  }

  // ---- 键盘:Esc 关掉,Tab 只在面板里打转 ----
  function focusables(): HTMLElement[] {
    const found = panel.querySelectorAll?.("button:not([disabled])");
    return found ? (Array.from(found) as HTMLElement[]) : [closeBtn, doneBtn];
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (closed) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const list = focusables();
    if (list.length === 0) return;
    const active = doc.activeElement as HTMLElement | null;
    const at = active ? list.indexOf(active) : -1;
    const step = e.shiftKey ? -1 : 1;
    const from = at === -1 ? (e.shiftKey ? 0 : list.length - 1) : at;
    e.preventDefault();
    list[(from + step + list.length) % list.length]?.focus?.();
  }

  let offStore: () => void = () => {};

  function close(): void {
    if (closed) return;
    closed = true;
    doc.removeEventListener("keydown", onKeyDown, true);
    offStore();
    overlay.remove();
    if (currentHandle === handle) currentHandle = null;
    try {
      trigger?.focus?.();
    } catch {
      // 打开面板的那个按钮已经没了就算了
    }
    opts?.onClose?.();
  }

  closeBtn.addEventListener("click", () => {
    playSound("tap");
    close();
  });
  doneBtn.addEventListener("click", () => {
    playSound("tap");
    close();
  });
  overlay.addEventListener("click", (e) => {
    // 只有点在面板外的遮罩上才关,点卡片不关
    if (e.target === overlay) close();
  });

  (doc.body ?? doc.documentElement)?.appendChild(overlay);
  doc.addEventListener("keydown", onKeyDown, true);
  // 星星是在别处(玩游戏)赚的,余额变了要跟着刷新
  offStore = store.onChange(() => {
    if (!closed) starsChip.textContent = starsLabel(store.stars());
  });

  render();
  closeBtn.focus?.();

  const handle: CollectionHandle = { el: panel, close, destroy: close };
  currentHandle = handle;
  return handle;
}
