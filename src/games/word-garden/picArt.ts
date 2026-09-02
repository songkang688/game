/**
 * 识字小花园 1.3 · 字卡配图贴纸层（W8R1-02，只画不判）。
 *
 * A 档实测：看图认字（56px）、认字选图选项（34px）、数一数行（26px）、
 * 给字组词题面（emoji + 字混排）四处的配图都是裸 emoji 直出。
 * 字库与题目数据一个字节不动（前 99 关题目 JSON 被用例钉死），这一层只做
 * 「渲染层 emoji → kit 贴纸」的视觉替换：
 *
 *  - 题面：`.qz-prompt` 原样保留但收进 sr-only（读屏还念得到），旁边立一张
 *    `.wgd-pic-card` 镜像卡，emoji 换成 `art/kit/stickers` 的自绘贴纸、
 *    汉字原字号照排。镜像卡是题卡的**兄弟**节点——运行器的错题监听与本层
 *    自己都盯着题卡的 childList，绝不能往题卡里塞孩子。
 *  - 选项：`.qz-choice` 里孤身一个 emoji 的按钮，把内容换成
 *    「sr-only 原文 + aria-hidden 贴纸」。按钮的监听挂在按钮自己身上、
 *    错题监听用 closest 找按钮，换里子不惊动任何判定。
 *
 * 解析不出的题面（拼音 / 句子 / 没画过的 emoji）一律原样放行。
 * `destroy` 把镜像卡、样式、观察器、题卡上的类一起收干净。
 */
import { hasSticker, sticker, stickerName } from "../../art/kit/stickers";

/** 题面孤身一张大图的贴纸边长（原裸 emoji 字号 56px） */
export const PIC_BIG_PX = 58;
/** 数一数行里单枚贴纸的边长（原 26px 字号行） */
export const PIC_ROW_PX = 30;
/** 「emoji + 字」混排题面里贴纸的边长（同行汉字 42px） */
export const PIC_MIX_PX = 44;
/** 选项按钮里贴纸的边长（原 34px 字号） */
export const PIC_CHOICE_PX = 38;

/** 本层全部样式（wgd- 前缀，只往后贴，不动 qz- / l99- 任何既有规则） */
export const PIC_CSS = `
.wgd-pic-card{background:#fff;border-radius:18px;padding:12px 14px;min-height:78px;
  display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 8px;
  text-align:center;line-height:1.2;box-shadow:0 3px 10px rgba(120,120,160,.15);}
.wgd-pic-card[hidden]{display:none;}
.wgd-pic-item{display:inline-flex;}
.wgd-pic-item svg{display:block;}
.wgd-pic-text{font-size:42px;font-weight:900;}
.wgd-pic-sr{position:absolute !important;width:1px !important;height:1px !important;
  min-height:0 !important;padding:0 !important;margin:-1px !important;overflow:hidden !important;
  clip:rect(0 0 0 0) !important;white-space:nowrap !important;border:0 !important;box-shadow:none !important;}
@media (max-width:400px){
  .wgd-pic-card{padding:10px 10px;gap:4px 6px;}
  .wgd-pic-text{font-size:34px;}
}
`;

export interface PicToken {
  kind: "sticker" | "text";
  value: string;
}

export interface PicPlan {
  tokens: PicToken[];
  stickerCount: number;
  /** 这块题面里贴纸统一用的边长 */
  px: number;
}

/** token 里混着画不出来的 emoji（图集没收录）就整题放行，绝不半旧半新 */
const PICTO = /\p{Extended_Pictographic}/u;

/**
 * 题面纯文本 → 贴纸计划。只认「空格分隔、每个 token 要么是有贴纸的 emoji
 * 要么是普通文字」的题面；一枚贴纸都换不上、或有画不出的 emoji，返回 null。
 */
export function promptPicPlan(text: string): PicPlan | null {
  const tokens = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 14) return null;
  const out: PicToken[] = [];
  let stickers = 0;
  for (const t of tokens) {
    if (hasSticker(t)) {
      out.push({ kind: "sticker", value: t });
      stickers++;
    } else if (PICTO.test(t)) {
      return null;
    } else {
      out.push({ kind: "text", value: t });
    }
  }
  if (stickers === 0) return null;
  const allStickers = stickers === out.length;
  const px = allStickers ? (stickers === 1 ? PIC_BIG_PX : PIC_ROW_PX) : PIC_MIX_PX;
  return { tokens: out, stickerCount: stickers, px };
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

/** 贴纸计划 → 镜像卡的 HTML（贴纸 aria-hidden，原文由 sr-only 的题卡负责朗读） */
export function renderPicPrompt(plan: PicPlan): string {
  return plan.tokens
    .map((t) =>
      t.kind === "sticker"
        ? `<span class="wgd-pic-item" data-pic="${esc(stickerName(t.value) ?? "")}">${sticker(t.value, plan.px)}</span>`
        : `<span class="wgd-pic-text">${esc(t.value)}</span>`
    )
    .join("");
}

/** 选项按钮的新里子：sr-only 原文（读屏照念）+ aria-hidden 贴纸 */
export function renderPicChoice(emoji: string): string {
  return (
    `<span class="wgd-pic-sr">${esc(emoji)}</span>` +
    `<span class="wgd-pic-item" aria-hidden="true" data-pic="${esc(stickerName(emoji) ?? "")}">` +
    `${sticker(emoji, PIC_CHOICE_PX)}</span>`
  );
}

export interface PicArtHandle {
  /** 手动刷一遍（没有 MutationObserver 的环境给用例用） */
  refresh(): void;
  destroy(): void;
}

export interface PicArtOpts {
  /** 镜像卡换装后喊一声（宿主钳位要重新量高度） */
  onChanged?: () => void;
}

/** `ref` 的下一个兄弟之前插入（真 DOM 与测试桩都只用 children + insertBefore） */
function insertAfter(parent: HTMLElement, node: HTMLElement, ref: HTMLElement): void {
  const at = Array.prototype.indexOf.call(parent.children, ref);
  const next = (parent.children[at + 1] as HTMLElement | undefined) ?? null;
  parent.insertBefore(node, next);
}

/**
 * 往答题壳上挂配图贴纸层。全程只做三种安全动作：
 * 题卡加/摘类（属性变更，childList 观察器无感）、镜像卡增删自己的内容、
 * 选项按钮换里子（监听在按钮自己身上，不受影响）。
 */
export function attachPicArt(host: HTMLElement, opts: PicArtOpts = {}): PicArtHandle {
  const doc = host.ownerDocument;
  const prompt = host.querySelector(".qz-prompt");
  const wrap = prompt instanceof HTMLElement ? prompt.parentElement : null;
  const style = doc.createElement("style");
  style.textContent = PIC_CSS;
  host.appendChild(style);

  let mirror: HTMLElement | null = null;
  if (wrap instanceof HTMLElement && prompt instanceof HTMLElement) {
    mirror = doc.createElement("div");
    mirror.className = "wgd-pic-card";
    mirror.setAttribute("aria-hidden", "true");
    mirror.hidden = true;
    insertAfter(wrap, mirror, prompt);
  }

  function refreshPrompt(): void {
    if (!(prompt instanceof HTMLElement) || !mirror) return;
    const plan = promptPicPlan(prompt.textContent ?? "");
    if (plan) {
      mirror.innerHTML = renderPicPrompt(plan);
      mirror.hidden = false;
      prompt.classList.add("wgd-pic-sr");
    } else {
      mirror.innerHTML = "";
      mirror.hidden = true;
      prompt.classList.remove("wgd-pic-sr");
    }
  }

  function refreshChoices(): void {
    const row = host.querySelector(".qz-choices");
    if (!(row instanceof HTMLElement)) return;
    for (const btn of Array.from(row.children)) {
      if (!(btn instanceof HTMLElement)) continue;
      if (btn.getAttribute("data-wgd-pic") !== null) continue;
      const text = (btn.textContent ?? "").trim();
      if (!text || /\s/.test(text) || !hasSticker(text)) continue;
      btn.innerHTML = renderPicChoice(text);
      btn.setAttribute("data-wgd-pic", stickerName(text) ?? "");
    }
  }

  function refresh(): void {
    refreshPrompt();
    refreshChoices();
    opts.onChanged?.();
  }

  let observer: MutationObserver | null = null;
  if (prompt && typeof MutationObserver === "function") {
    observer = new MutationObserver(() => refresh());
    observer.observe(prompt, { childList: true });
  }
  refresh();

  return {
    refresh,
    destroy() {
      observer?.disconnect();
      observer = null;
      if (prompt instanceof HTMLElement) prompt.classList.remove("wgd-pic-sr");
      mirror?.remove();
      mirror = null;
      style.remove();
    },
  };
}
