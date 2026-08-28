/**
 * 形状王国 · 问答关城堡氛围帽（1.3 第 3 轮终验 · B 档修订清单第 7 条）。
 *
 * 王国的题材信物「城堡剪影」此前只在作图关出现（`castleSvg` 全库唯一调用点是
 * draw.ts 的描金进度条），问答关首屏只剩天空渐变 + 远山——同一款游戏两种关型
 * 的首屏丰满度分裂。修法按 B 档规格：问答关顶部复用 `castleSvg(0)` 剪影紫
 * 静态版当氛围帽——**一处 innerHTML、无动效、无新工序**，静态装饰不进答题区
 * 包围盒，判定与公共答题器一个字不碰。
 *
 * 这里钉住的全是「静态装饰」的边界：帽子确实是 castleSvg(0) 原样复用（零段
 * 描金、无新亮段动画类、无升旗）、挂在提示条面板里而不在答题器宿主里、
 * aria-hidden 不进读屏、CSS 不接指针、矮屏沿作图关同一门槛整顶藏掉、
 * destroy 时跟着面板一起拆干净。
 */
import { afterEach, describe, expect, it } from "vitest";
import type { PlayCtx, PlayHandle } from "../level99";
import type { QuizOptions } from "../quiz99";
import { SHORT_SCREEN_PX } from "./draw";
import { castleSvg } from "./kingdom";
import type { ShapeQ } from "./levels";
import { runQuizWithReview } from "./review";
import { findOne, installDom, StubEl } from "./domStub";

let restoreDom: (() => void) | null = null;
afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function stubCtx(): PlayCtx {
  return {
    level: 0,
    chapterIndex: 0,
    indexInChapter: 0,
    sfx: () => {},
    bonusStars: () => {},
    win: () => {},
    lose: () => {},
  } as PlayCtx;
}

const QUESTIONS: ShapeQ[] = [
  { kind: "sides", promptHTML: "▲", ask: "这是几边形？", choices: ["三", "四"], correct: 0, answer: "三" },
];

/** 起一屏问答关（答题器换成桩，不碰公共 quiz99），把关键节点找出来 */
function mountQuiz(): {
  stage: StubEl;
  handle: PlayHandle;
  panel: StubEl;
  hat: StubEl;
  quizHost: StubEl;
  css: string;
} {
  const dom = installDom();
  restoreDom = dom.restore;
  const stage = new StubEl("div");
  const handle = runQuizWithReview(
    {
      stage: stage as unknown as HTMLElement,
      ctx: stubCtx(),
      theme: { bg: "#fff", accent: "#5f4a8a" },
      level: 3,
      questions: QUESTIONS,
    },
    { storage: null, runner: (_o: QuizOptions) => ({ destroy: () => {} }) }
  );
  const panel = findOne(stage, "shk-round");
  const hat = findOne(stage, "shk-quiz-castle");
  const quizHost = findOne(stage, "shk-quizhost");
  expect(panel && hat && quizHost, "问答关三件套（面板/氛围帽/答题宿主）都得在").toBeTruthy();
  const css = panel!.children.find((c) => c.tagName === "style")?.textContent ?? "";
  return { stage, handle, panel: panel!, hat: hat!, quizHost: quizHost!, css };
}

describe("shape-kingdom · 问答关城堡氛围帽（castleSvg(0) 静态复用）", () => {
  it("氛围帽就是 castleSvg(0) 原样：六段全剪影紫、零描金、无新亮动画、不升旗", () => {
    const { hat, handle } = mountQuiz();
    const html = (hat as unknown as { innerHTML?: string }).innerHTML ?? "";
    // 一处 innerHTML、静态复用：字符串级等于 castleSvg(0)，没有夹带任何新工序
    expect(html).toBe(castleSvg(0));
    expect(html).toContain('data-lit="0"');
    expect(html).toContain('data-segs="6"');
    expect((html.match(/data-on="0"/g) ?? []).length).toBe(6);
    // 剪影紫在、描金黄不在（lit=0 一段都没点亮）
    expect(html).toContain('fill="#b7a6cf"');
    expect(html).not.toContain('fill="#ffd93d"');
    // 天生静态：没有描金过渡类，也没有「王国建成」的升旗
    expect(html).not.toContain("shk-seg-new");
    expect(html).not.toContain("data-banner");
    handle.destroy();
  });

  it("纯装饰边界：aria-hidden 不进读屏、CSS 不接指针、SVG 自带 aria-hidden", () => {
    const { hat, css, handle } = mountQuiz();
    expect(hat.getAttribute("aria-hidden")).toBe("true");
    const html = (hat as unknown as { innerHTML?: string }).innerHTML ?? "";
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(css).toContain(".shk-quiz-castle{display:flex;justify-content:center;pointer-events:none;");
    handle.destroy();
  });

  it("不进答题区包围盒：帽子挂在提示条面板顶部，答题器宿主里没有它", () => {
    const { panel, hat, quizHost, handle } = mountQuiz();
    // 帽子的祖先是面板，不是答题器宿主
    expect(hat.parent).toBe(panel);
    expect(findOne(quizHost, "shk-quiz-castle")).toBeNull();
    // 「问答关顶部」：面板里除了 style 它排第一，横幅和提示条都在它后面
    const kids = panel.children.filter((c) => c.tagName !== "style");
    expect(kids[0]).toBe(hat);
    expect(kids.map((c) => c.className)).toEqual(["shk-quiz-castle", "shk-banner", "shk-hintbar"]);
    handle.destroy();
  });

  it("矮屏沿作图关同一门槛整顶藏掉，竖向空间还给题面", () => {
    const { css, handle } = mountQuiz();
    expect(css).toContain(`@media (max-height:${SHORT_SCREEN_PX}px){.shk-quiz-castle{display:none;}}`);
    handle.destroy();
  });

  it("destroy 时帽子跟着面板一起拆干净，不留孤儿节点", () => {
    const { stage, handle } = mountQuiz();
    handle.destroy();
    expect(findOne(stage, "shk-quiz-castle")).toBeNull();
    expect(findOne(stage, "shk-round")).toBeNull();
    expect(findOne(stage, "shk-quizhost")).toBeNull();
  });
});
