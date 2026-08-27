/**
 * 窗口 1 那 12 款的「360px 上正文不许小于 16px」巡检。
 *
 * 第 1 轮走查 W1-R1-02：这 12 款各自注入的 CSS 里，`@media (max-width:360px)` 块
 * 原本是**往下压字号**的（正文压到 12–13px），正好跟第 1 步 B 档定的手机文字硬指标反着来：
 *
 * - 正文（说明文字、目标、战报、座位信息）≥ **16px**
 * - 按钮文字、棋盘格子里的数字可以到 **14px**，再低不行
 *
 * 修法是把字号交给 `styles.css` 里 `:root` 上那两个变量兜底（`--mt-body` / `--mt-control`，
 * 由 `src/ui/mobileText.ts` 的 `MIN_BODY_PX` / `MIN_CONTROL_PX` 定义），
 * 窄屏只准压内边距和宽度。这份巡检就守着这条：**游戏 CSS 里不许再出现写死的小字号**。
 *
 * 只看本窗口这 12 款，不越界扫别人的目录。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIN_BODY_PX, MIN_CONTROL_PX } from "../ui/mobileText";

const WINDOW1_IDS = [
  "orb-arena",
  "snake-royale",
  "block-drop",
  "combo-clash",
  "mahjong-bloom",
  "star-estate",
  "hero-cards",
  "weiqi-garden",
  "flight-chess",
  "merge-2048",
  "mine-garden",
  "sudoku-petal"
] as const;

const sourceOf = (id: string): string =>
  readFileSync(new URL(`./${id}/index.ts`, import.meta.url), "utf8");

/** 源码里所有写死的 `font-size:Npx`（不含 `var()` / `clamp()` / `max()` 这些兜底写法） */
function hardCodedSizes(src: string): number[] {
  return [...src.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => Number(m[1]));
}

/** 把 `@media (max-width:NNNpx)` 块的内容切出来，NNN ≤ 420 的都算窄屏块 */
function narrowBlocks(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/@media \(max-width:\s*(\d+)px\)\s*\{/g)) {
    if (Number(m[1]) > 420) continue;
    const from = (m.index ?? 0) + m[0].length;
    // 块里还嵌着一层层的 `选择器{...}`，数括号找配对的收尾
    let depth = 1;
    let i = from;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
    }
    out.push(src.slice(from, i - 1));
  }
  return out;
}

describe("窗口 1 · 360px 手机文字下限", () => {
  it("下限就是 mobileText 那两个常量,别处不许另立一套", () => {
    expect(MIN_BODY_PX).toBe(16);
    expect(MIN_CONTROL_PX).toBe(14);
  });

  it("12 款都读得到,而且都自带一份注入的 CSS", () => {
    for (const id of WINDOW1_IDS) {
      const src = sourceOf(id);
      expect(src.length, id).toBeGreaterThan(1000);
      expect(src, id).toContain("font-size:");
    }
  });

  it("没有一处写死的字号低于控件下限 14px", () => {
    const bad: string[] = [];
    for (const id of WINDOW1_IDS) {
      for (const px of hardCodedSizes(sourceOf(id))) {
        if (px < MIN_CONTROL_PX) bad.push(`${id}:${px}px`);
      }
    }
    expect(bad, `这些地方的字号比 ${MIN_CONTROL_PX}px 还小: ${bad.join(", ")}`).toEqual([]);
  });

  /**
   * 正文那一档的字号:写死 ≥16px 也行,走 `var(--mt-body,16px)` 也行,
   * 要的是**结果**——360px 上说明文字不小于 16px,不是非得用哪种写法。
   * 本窗口两批修复各用了一种写法(一批写死 16px,一批走变量),两种都认。
   */
  it("正文那一档的选择器一律 ≥16px(写死或走变量都算)", () => {
    const BODY_HINT = /-(msg|note|goal|log|info|tip|badge|seat|deed|keys|rows|side|fan|reveal|pile|preview|minitip|label|drawer-h|over-s|paper|board|mini)$/;
    const bad: string[] = [];
    for (const id of WINDOW1_IDS) {
      for (const m of sourceOf(id).matchAll(/\.([\w-]+)\s*\{([^{}]*font-size:\s*([^;}]+))/g)) {
        if (!BODY_HINT.test(`-${m[1].split(".").pop() ?? ""}`) && !BODY_HINT.test(`-${m[1]}`)) continue;
        const value = m[3].trim();
        if (value.includes("--mt-body")) continue;
        const px = /^([0-9.]+)px$/.exec(value);
        if (px && Number(px[1]) >= MIN_BODY_PX) continue;
        if (/^(inherit|max\(|clamp\()/.test(value)) continue;
        bad.push(`${id} .${m[1]} → ${value}`);
      }
    }
    expect(bad, `这些正文没到 ${MIN_BODY_PX}px: ${bad.join(" | ")}`).toEqual([]);
  });

  it("窄屏块里不许再出现写死的字号——那是往下压正文的老毛病", () => {
    const bad: string[] = [];
    for (const id of WINDOW1_IDS) {
      for (const block of narrowBlocks(sourceOf(id))) {
        for (const m of block.matchAll(/([.#][\w-]+[^{}]*)\{([^{}]*font-size:\s*([0-9.]+)px[^{}]*)\}/g)) {
          const px = Number(m[3]);
          // 按钮那一档写死 14–15px 是允许的,正文那一档必须走变量
          if (px < MIN_BODY_PX && !/-btn|-open|-back|-tool|-pick|-key|-dice/.test(m[1])) {
            bad.push(`${id} ${m[1].trim()} ${px}px`);
          }
        }
      }
    }
    expect(bad, `窄屏块里这些还在压正文字号: ${bad.join(" | ")}`).toEqual([]);
  });

  it("窄屏块留了下来——腾地方改成压内边距/宽度,不是整块删掉", () => {
    for (const id of WINDOW1_IDS) {
      const blocks = narrowBlocks(sourceOf(id));
      expect(blocks.length, `${id} 没有窄屏适配块`).toBeGreaterThan(0);
      const joined = blocks.join("\n");
      expect(/padding|width|min-width|max-width|gap|flex/.test(joined), `${id} 的窄屏块什么都没做`).toBe(true);
    }
  });

  it("长文案都能断行,360px 上不横着撑出去", () => {
    for (const id of WINDOW1_IDS) {
      const src = sourceOf(id);
      expect(src, `${id} 没有任何 overflow-wrap`).toContain("overflow-wrap:anywhere");
    }
  });

  it("正文不许用 nowrap 挤成一条(按钮短标签除外)", () => {
    const bad: string[] = [];
    for (const id of WINDOW1_IDS) {
      for (const m of sourceOf(id).matchAll(/([.#][\w-]+[^{}]*)\{([^{}]*white-space:\s*nowrap[^{}]*)\}/g)) {
        if (/-msg|-note|-goal|-log|-info|-tip|-chip|-badge/.test(m[1])) bad.push(`${id} ${m[1].trim()}`);
      }
    }
    expect(bad, `这些正文还锁着 nowrap: ${bad.join(" | ")}`).toEqual([]);
  });
});
