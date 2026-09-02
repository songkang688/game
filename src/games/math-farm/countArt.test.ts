/**
 * W8R1-01 · 数一数题贴纸化的钉子（窗口 8 第 1 轮监督修复员）。
 *
 * A 档报告：math-farm 数一数题的核心计数物是 30px 裸 emoji 直出。
 * 修法：绘制层解析题面（只读不改题目数据），把可见层换成 kit 贴纸行，
 * 原 emoji 行收进 sr-only。这里钉四件事：
 *   1. countPlan 只认「同一 emoji 重复 n 次」的题面，n 与题目 answer 一致；
 *   2. 真关卡（1–34 关全量）里每一道数一数题都配得上贴纸，无漏网；
 *   3. renderCountIllustration 输出纯 SVG 贴纸行，不含任何裸 emoji；
 *   4. farmLayer 端到端：数一数题挂 sr-only 类 + 贴纸卡，算式题走老路，destroy 摘干净。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasSticker } from "../../art/kit/stickers";
import { createFarmLayer } from "./farmLayer";
import { COUNT_PX, FARM_CSS, MIN_COUNT_PX } from "./farmScene";
import {
  COUNT_ILLUS_MAX,
  countPlan,
  renderCountIllustration,
  type IllusSource,
} from "./illustrate";
import { buildQuestions, CHAPTERS } from "./levels";
import { StubEl, installDom } from "./domStub";

/** 照 qCount 的输出造一个数一数题面（字号 / 字距与 levels.ts 完全一致） */
function countPrompt(emoji: string, n: number): string {
  const row = Array.from({ length: n }, () => emoji).join(" ");
  return `<span style="font-size:30px;letter-spacing:2px;line-height:1.5">${row}</span>`;
}

/** 六章数一数用过的全部 emoji（照 levels.ts 的 COUNT_EMOJIS 抄，一个不落） */
const ALL_COUNT_EMOJIS = [
  "🐮", "🐑", "🐷",
  "🍎", "🍐", "🍊",
  "🦆", "🐸", "🐟",
  "🌾", "🌻", "🐝",
  "⭐", "🌟", "✨",
  "🌙", "🦉", "🍄",
];

describe("W8R1-01 · countPlan 只认数一数题面", () => {
  it("同一 emoji 重复 n 次 → { emoji, n }，emoji 原样不改写", () => {
    const plan = countPlan({ promptHTML: countPrompt("🐮", 4) });
    expect(plan).not.toBeNull();
    expect(plan!.emoji).toBe("🐮");
    expect(plan!.n).toBe(4);
    expect(plan!.name.length).toBeGreaterThan(0);
  });

  it("算式 / 混排 / 单个 / 带 spec / 图集没画过的，一律返回 null 走老路", () => {
    expect(countPlan({ promptHTML: "3 + 2 = ?" })).toBeNull();
    expect(countPlan({ promptHTML: "<span>🐮 🐑 🐮</span>" })).toBeNull();
    expect(countPlan({ promptHTML: "<span>🐮</span>" })).toBeNull();
    expect(
      countPlan({ promptHTML: countPrompt("🐮", 3), spec: { kind: "vertical", a: 12, b: 3, plus: true } } as IllusSource)
    ).toBeNull();
    expect(countPlan({ promptHTML: "<span>🦖 🦖 🦖</span>" })).toBeNull();
    expect(countPlan({ promptHTML: "" })).toBeNull();
    // 超出上限（关卡出题上限 10，冗余 12）不硬摆
    expect(countPlan({ promptHTML: countPrompt("🐮", COUNT_ILLUS_MAX + 1) })).toBeNull();
  });

  it("六章数一数的 18 个 emoji 每一个都有贴纸、都解析得出", () => {
    for (const emoji of ALL_COUNT_EMOJIS) {
      expect(hasSticker(emoji), `${emoji} 缺贴纸`).toBe(true);
      const plan = countPlan({ promptHTML: countPrompt(emoji, 3) });
      expect(plan?.emoji, `${emoji} 解析失败`).toBe(emoji);
    }
  });

  it("真关卡全量扫：1–34 关每道数一数题都配得上贴纸，n 与答案一致", () => {
    const lastCountLevel = CHAPTERS[0].size + CHAPTERS[1].size; // 前两章才出数一数
    let seen = 0;
    for (let level = 0; level < lastCountLevel; level++) {
      for (const q of buildQuestions(level)) {
        if (q.kind !== "count") continue;
        seen++;
        const plan = countPlan(q);
        expect(plan, `第 ${level + 1} 关数一数题漏网：${q.promptHTML}`).not.toBeNull();
        expect(plan!.n, `第 ${level + 1} 关贴纸数量与答案不符`).toBe(q.answer);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });
});

describe("W8R1-01 · 贴纸行渲染", () => {
  it("n 个 data-unit=one 贴纸单元 + data-n 组标记，全是内联 SVG", () => {
    const html = renderCountIllustration({ emoji: "🍎", n: 5, name: "红苹果" });
    expect(html).toContain('data-n="5"');
    expect((html.match(/data-unit="one"/g) ?? []).length).toBe(5);
    expect((html.match(/<svg/g) ?? []).length).toBe(5);
    expect(html).toContain("mtf-illus-count-unit");
  });

  it("输出里没有任何裸 emoji（这是本条修复的靶心）", () => {
    for (const emoji of ALL_COUNT_EMOJIS) {
      const html = renderCountIllustration({ emoji, n: 3, name: "" });
      expect(/\p{Extended_Pictographic}/u.test(html), `${emoji} 的贴纸行还漏 emoji`).toBe(false);
    }
  });

  it("贴纸尺寸走 farmScene 常量，窄屏媒体查询收到最小尺寸", () => {
    expect(COUNT_PX).toBeGreaterThanOrEqual(28);
    expect(MIN_COUNT_PX).toBeGreaterThanOrEqual(20);
    const html = renderCountIllustration({ emoji: "🐮", n: 2, name: "奶牛" });
    expect(html).toContain(`width="${COUNT_PX}"`);
    const media = FARM_CSS.slice(FARM_CSS.indexOf("@media (max-width: 400px)"));
    expect(media).toContain(`.mtf-illus-count-unit { width: ${MIN_COUNT_PX}px; height: ${MIN_COUNT_PX}px; }`);
  });

  it("sr-only 类与贴纸卡样式钉在 FARM_CSS 里", () => {
    expect(FARM_CSS).toContain(".mtf-count-sr");
    expect(FARM_CSS).toContain("clip: rect(0 0 0 0) !important");
    expect(FARM_CSS).toContain(".mtf-illus-count {");
    expect(FARM_CSS).toContain(".mtf-illus-count-unit {");
  });
});

describe("W8R1-01 · farmLayer 端到端（数一数题贴纸卡顶上，题面收进 sr-only）", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installDom();
  });

  afterEach(() => {
    restoreDom();
  });

  function mount(questions: IllusSource[]) {
    const stage = new StubEl("div");
    const wrap = new StubEl("div");
    wrap.className = "qz-wrap";
    const prompt = new StubEl("div");
    prompt.className = "qz-prompt";
    wrap.appendChild(prompt);
    stage.appendChild(wrap);
    const layer = createFarmLayer(stage as unknown as HTMLElement, questions, { reduced: true });
    return { stage, wrap, prompt, layer };
  }

  it("数一数题：题卡挂 mtf-count-sr，插图卡换贴纸装束；切到算式题两样全摘", () => {
    const questions: IllusSource[] = [
      { promptHTML: countPrompt("🐑", 3) },
      { promptHTML: "4 + 2 = ?" },
    ];
    const { wrap, prompt, layer } = mount(questions);
    const illus = wrap.children.find((c) => c.classList.contains("mtf-illus"))!;

    // 第 0 题（数一数）：sr-only + 贴纸卡
    expect(prompt.classList.contains("mtf-count-sr")).toBe(true);
    expect(illus.classList.contains("mtf-illus-count")).toBe(true);
    expect(illus.hidden).toBe(false);
    const html0 = String((illus as unknown as { innerHTML: string }).innerHTML);
    expect((html0.match(/data-unit="one"/g) ?? []).length).toBe(3);
    expect(/\p{Extended_Pictographic}/u.test(html0)).toBe(false);

    // 第 1 题（算式）：老路照走，数一数的装束全摘
    layer.onQuestion(1);
    expect(prompt.classList.contains("mtf-count-sr")).toBe(false);
    expect(illus.classList.contains("mtf-illus-count")).toBe(false);
    const html1 = String((illus as unknown as { innerHTML: string }).innerHTML);
    expect(html1).toContain('data-crop=');

    layer.destroy();
  });

  it("destroy 把题卡上的 sr-only 类也摘掉", () => {
    const { prompt, layer } = mount([{ promptHTML: countPrompt("🦆", 2) }]);
    expect(prompt.classList.contains("mtf-count-sr")).toBe(true);
    layer.destroy();
    expect(prompt.classList.contains("mtf-count-sr")).toBe(false);
  });
});
