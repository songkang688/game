/**
 * W8R1-02 · 识字小花园配图贴纸化的钉子（窗口 8 第 1 轮监督修复员）。
 *
 * A 档报告：看图认字 / 认字选图 / 数一数 / 给字组词四处配图裸 emoji 直出。
 * 修法：绘制层贴纸镜像（picArt.ts），字库与题目数据零改动。这里钉五件事：
 *   1. promptPicPlan 只认「空格分隔、贴纸 emoji + 普通文字」的题面，尺寸分档正确；
 *   2. 188 关全量扫：每一处带 emoji 的题面/选项都换得上贴纸，无漏网；
 *   3. 渲染输出是纯 SVG 贴纸（sr-only 原文除外），不再有可见裸 emoji；
 *   4. attachPicArt 端到端：题卡收进 sr-only、镜像卡亮起、选项换里子、destroy 摘干净；
 *   5. 新样式一律 wgd- 前缀（沿 shell.test.ts 的纪律）。
 */
import { describe, expect, it } from "vitest";
import { hasSticker } from "../../art/kit/stickers";
import { buildQuestions } from "./levels";
import {
  attachPicArt,
  PIC_BIG_PX,
  PIC_CHOICE_PX,
  PIC_CSS,
  PIC_MIX_PX,
  PIC_ROW_PX,
  promptPicPlan,
  renderPicChoice,
  renderPicPrompt,
} from "./picArt";

const PICTO = /\p{Extended_Pictographic}/u;
const stripTags = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("W8R1-02 · promptPicPlan 题面解析", () => {
  it("孤身一张大图（看图认字）→ 1 枚大贴纸", () => {
    const plan = promptPicPlan("🌸");
    expect(plan).not.toBeNull();
    expect(plan!.stickerCount).toBe(1);
    expect(plan!.px).toBe(PIC_BIG_PX);
  });

  it("数一数行 → 每枚行内尺寸", () => {
    const plan = promptPicPlan("🌸 🌸 🌸 🌸");
    expect(plan!.stickerCount).toBe(4);
    expect(plan!.px).toBe(PIC_ROW_PX);
  });

  it("emoji + 字混排（给字组词）→ 混排尺寸，文字 token 原样保留", () => {
    const plan = promptPicPlan("🍼 宝");
    expect(plan!.stickerCount).toBe(1);
    expect(plan!.px).toBe(PIC_MIX_PX);
    expect(plan!.tokens).toEqual([
      { kind: "sticker", value: "🍼" },
      { kind: "text", value: "宝" },
    ]);
  });

  it("拼音 / 句子 / 空串 / 没画过的 emoji，一律 null 原样放行", () => {
    expect(promptPicPlan("shān")).toBeNull();
    expect(promptPicPlan("小鸟在天上飞")).toBeNull();
    expect(promptPicPlan("")).toBeNull();
    expect(promptPicPlan("🦖")).toBeNull();
    expect(promptPicPlan("🦖 🦖")).toBeNull();
  });
});

describe("W8R1-02 · 188 关全量扫（题面与选项无漏网）", () => {
  it("每一处带 emoji 的题面都换得上贴纸", () => {
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        const text = stripTags(q.promptHTML);
        if (!PICTO.test(text)) continue;
        const plan = promptPicPlan(text);
        expect(plan, `第 ${level + 1} 关题面漏网：${text}`).not.toBeNull();
      }
    }
  });

  it("每一个带 emoji 的选项都有贴纸", () => {
    for (let level = 0; level < 188; level++) {
      for (const q of buildQuestions(level)) {
        for (const c of q.choices) {
          const text = stripTags(c);
          if (!PICTO.test(text) && !/[\u2460-\u24FF\u20E3]/.test(text)) continue;
          expect(/\s/.test(text), `第 ${level + 1} 关选项不是孤身 emoji：${text}`).toBe(false);
          expect(hasSticker(text), `第 ${level + 1} 关选项漏网：${text}`).toBe(true);
        }
      }
    }
  });
});

describe("W8R1-02 · 渲染输出", () => {
  it("镜像卡：贴纸是 SVG + data-pic 中文名，可见层 0 裸 emoji", () => {
    const html = renderPicPrompt(promptPicPlan("🍼 宝")!);
    expect((html.match(/<svg/g) ?? []).length).toBe(1);
    expect(html).toContain('data-pic="');
    expect(html).toContain('<span class="wgd-pic-text">宝</span>');
    expect(PICTO.test(html)).toBe(false);
  });

  it("选项里子：sr-only 原文（读屏照念）+ aria-hidden 贴纸", () => {
    const html = renderPicChoice("🌸");
    expect(html).toContain('<span class="wgd-pic-sr">🌸</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(`width="${PIC_CHOICE_PX}"`);
    // 唯一的 emoji 在 sr-only 里，摘掉它就不剩了
    expect(PICTO.test(html.replace('<span class="wgd-pic-sr">🌸</span>', ""))).toBe(false);
  });

  it("新样式一律 wgd- 前缀，含 sr-only 与窄屏收缩", () => {
    const classes = [...PIC_CSS.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(3);
    for (const cls of classes) {
      expect(cls.startsWith("wgd-"), `新样式类名要 wgd- 前缀：${cls}`).toBe(true);
    }
    expect(PIC_CSS).toContain("clip:rect(0 0 0 0) !important");
    expect(PIC_CSS).toContain("@media (max-width:400px)");
  });
});

// ---------------------------------------------------------------------------
// attachPicArt 端到端（极简本地桩：建元素 / 按类查 / classList / children）
// ---------------------------------------------------------------------------

class PicStub {
  readonly tagName: string;
  textContent = "";
  innerHTML = "";
  hidden = false;
  className = "";
  readonly children: PicStub[] = [];
  parentElement: PicStub | null = null;
  private readonly attrs = new Map<string, string>();
  ownerDocument = {
    createElement: (tag: string) => new PicStub(tag),
  };

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  readonly classList = {
    add: (n: string): void => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean));
      set.add(n);
      this.className = [...set].join(" ");
    },
    remove: (n: string): void => {
      this.className = this.className
        .split(/\s+/)
        .filter((c) => c && c !== n)
        .join(" ");
    },
    contains: (n: string): boolean => this.className.split(/\s+/).includes(n),
  };

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? (this.attrs.get(name) as string) : null;
  }

  appendChild(child: PicStub): PicStub {
    child.remove();
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child: PicStub, ref: PicStub | null): PicStub {
    child.remove();
    child.parentElement = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at >= 0) this.children.splice(at, 0, child);
    else this.children.push(child);
    return child;
  }

  remove(): void {
    const p = this.parentElement;
    if (!p) return;
    const at = p.children.indexOf(this);
    if (at >= 0) p.children.splice(at, 1);
    this.parentElement = null;
  }

  querySelector(sel: string): PicStub | null {
    const cls = sel.replace(/^\./, "");
    const walk = (el: PicStub): PicStub | null => {
      for (const kid of el.children) {
        if (kid.classList.contains(cls)) return kid;
        const hit = walk(kid);
        if (hit) return hit;
      }
      return null;
    };
    return walk(this);
  }
}

function withStubDom(fn: () => void): void {
  const g = globalThis as Record<string, unknown>;
  const before = g.HTMLElement;
  const had = "HTMLElement" in g;
  g.HTMLElement = PicStub;
  try {
    fn();
  } finally {
    if (had) g.HTMLElement = before;
    else delete g.HTMLElement;
  }
}

function mountQuiz(promptText: string, choiceTexts: string[]) {
  const host = new PicStub("div");
  const wrap = new PicStub("div");
  wrap.className = "qz-wrap";
  const prompt = new PicStub("div");
  prompt.className = "qz-prompt";
  prompt.textContent = promptText;
  const choices = new PicStub("div");
  choices.className = "qz-choices";
  for (const t of choiceTexts) {
    const btn = new PicStub("button");
    btn.className = "qz-choice";
    btn.textContent = t;
    choices.appendChild(btn);
  }
  wrap.appendChild(prompt);
  wrap.appendChild(choices);
  host.appendChild(wrap);
  return { host, wrap, prompt, choices };
}

describe("W8R1-02 · attachPicArt 端到端", () => {
  it("看图认字：题卡收进 sr-only，镜像卡亮贴纸；emoji 选项换里子，汉字选项不动", () => {
    withStubDom(() => {
      const { host, wrap, prompt, choices } = mountQuiz("🌸", ["山", "🌸", "花"]);
      let changed = 0;
      const handle = attachPicArt(host as unknown as HTMLElement, { onChanged: () => changed++ });

      expect(changed).toBe(1);
      expect(prompt.classList.contains("wgd-pic-sr")).toBe(true);
      const mirror = wrap.querySelector(".wgd-pic-card")!;
      // 镜像卡插在题卡的下一个位置
      expect(wrap.children.indexOf(mirror)).toBe(wrap.children.indexOf(prompt) + 1);
      expect(mirror.hidden).toBe(false);
      expect(mirror.innerHTML).toContain("<svg");
      expect(PICTO.test(mirror.innerHTML)).toBe(false);
      // 只有孤身 emoji 的选项换里子
      expect(choices.children[0].getAttribute("data-wgd-pic")).toBeNull();
      expect(choices.children[1].getAttribute("data-wgd-pic")).not.toBeNull();
      expect(choices.children[1].innerHTML).toContain("<svg");
      expect(choices.children[2].getAttribute("data-wgd-pic")).toBeNull();

      handle.destroy();
    });
  });

  it("切到拼音题（无 emoji）：sr-only 摘掉、镜像卡熄灭；destroy 全收干净", () => {
    withStubDom(() => {
      const { host, wrap, prompt } = mountQuiz("🍼 宝", ["宝贝", "水果", "青菜"]);
      const handle = attachPicArt(host as unknown as HTMLElement, {});
      const mirror = wrap.querySelector(".wgd-pic-card")!;
      expect(mirror.hidden).toBe(false);
      expect(mirror.innerHTML).toContain("wgd-pic-text");

      prompt.textContent = "shān";
      handle.refresh();
      expect(prompt.classList.contains("wgd-pic-sr")).toBe(false);
      expect(mirror.hidden).toBe(true);
      expect(mirror.innerHTML).toBe("");

      prompt.textContent = "🌸 🌸 🌸";
      handle.refresh();
      expect(mirror.hidden).toBe(false);
      expect((mirror.innerHTML.match(/<svg/g) ?? []).length).toBe(3);

      handle.destroy();
      expect(prompt.classList.contains("wgd-pic-sr")).toBe(false);
      expect(wrap.querySelector(".wgd-pic-card")).toBeNull();
      // 注入的样式也一起收走
      expect(host.children.some((c) => c.tagName === "style")).toBe(false);
    });
  });
});
