/**
 * 算数小农场 1.3 视觉升级的验收用例（只增不减）。
 *
 * 五段：题目实物化插图（纯函数）/ 换肤前后题面与出题零改动（回归钉死）/
 * 农场舞台与 CSS 契约 / 农场视觉层跑起来 / 整关接线。
 * 最要紧的两条钉死在第二段：`renderSpec` 的题面一字不差、种子固定的出题分布不变——
 * 换的只是皮肤，出题的骨头一根没动。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayCtx } from "../level99";
import type { QuizOptions } from "../quiz99";
import { CROP_KINDS, CROP_NAMES, basket, crop } from "../../art/kit/crops";
import { renderSpec, strip, type MathQ, type MathSpec } from "./gen";
import { tableKinds } from "./kinds";
import { buildQuestions } from "./levels";
import {
  BEE_EVERY,
  BEE_MS,
  CONFETTI_N,
  CROP_PX,
  FARM_CSS,
  GROW_STEP_MS,
  GROW_TOTAL_MS,
  HARVEST_MS,
  MILL_SPIN_S,
  MIN_CROP_PX,
  RETHINK_MS,
  RETHINK_TEXT,
  SIGN_MIN_H,
  WATER_MS,
  WOBBLE_MS,
  beeSvg,
  farmSceneSvg,
  wateringCanSvg,
} from "./farmScene";
import {
  ILLUS_MAX_OPERAND,
  basketLegend,
  illustrationPlan,
  operandsOf,
  renderIllustration,
  splitCount,
} from "./illustrate";
import { createFarmLayer } from "./farmLayer";
import { playFarmLevel } from "./runner";
import {
  StubEl,
  clickOn,
  findAll,
  findOne,
  installDom,
  installMutationObserver,
  installSpeech,
} from "./domStub";

/** 数一段 HTML 字符串里某个记号出现了几次 */
function countOf(html: string, token: string): number {
  return html.split(token).length - 1;
}

// ---------------------------------------------------------------------------
// 一、题目实物化插图（纯函数，题目数据只读）
// ---------------------------------------------------------------------------

describe("算数小农场 1.3 · 题目实物化插图", () => {
  it("实物插图数量 = 题目操作数：3 + 2 摆 3 图 + 2 图，题目数据一个字不动", () => {
    const q = Object.freeze({ promptHTML: "3 + 2 = ?" });
    const before = JSON.stringify(q);
    const plan = illustrationPlan(q, 0);
    expect(plan).not.toBeNull();
    expect(plan?.nums).toEqual([3, 2]);
    expect(plan?.ops).toEqual(["+"]);
    expect(plan?.usesBasket).toBe(false);
    const html = renderIllustration(plan!);
    expect(countOf(html, 'data-unit="one"')).toBe(5);
    expect(html).toContain('data-n="3"');
    expect(html).toContain('data-n="2"');
    // 插图层只读题目数据，绝不反向改动
    expect(JSON.stringify(q)).toBe(before);
    // 减法同样成立：7 - 4 摆 7 图 + 4 图
    const sub = illustrationPlan({ promptHTML: "7 - 4 = ?" }, 0)!;
    expect(sub.ops).toEqual(["−"]);
    expect(countOf(renderIllustration(sub), 'data-unit="one"')).toBe(11);
  });

  it("数量 > 10 换「一筐 = 10」约定：11 → 1 筐 + 1 个、20 → 2 筐，×10 角标与图例都在", () => {
    expect(splitCount(11)).toEqual({ n: 11, baskets: 1, singles: 1 });
    expect(splitCount(20)).toEqual({ n: 20, baskets: 2, singles: 0 });
    expect(splitCount(10)).toEqual({ n: 10, baskets: 0, singles: 10 });
    const p11 = illustrationPlan({ promptHTML: "11 + 3 = ?" }, 0)!;
    const h11 = renderIllustration(p11);
    expect(countOf(h11, 'data-unit="basket"')).toBe(1);
    expect(countOf(h11, 'data-unit="one"')).toBe(4);
    expect(h11).toContain("×10");
    expect(h11).toContain(basketLegend("carrot"));
    const p20 = illustrationPlan({ promptHTML: "20 - 6 = ?" }, 0)!;
    const h20 = renderIllustration(p20);
    expect(countOf(h20, 'data-unit="basket"')).toBe(2);
    expect(countOf(h20, 'data-unit="one"')).toBe(6);
    expect(h20).toContain("mtf-illus-legend");
    expect(basketLegend("carrot")).toContain("一筐 = 10");
  });

  it("插图完全由题目数据驱动：竖式读 spec，其余题型与摆不开的数不硬配图", () => {
    const vert: MathSpec = { kind: "vertical", plus: false, a: 47, b: 38 };
    const got = operandsOf({ promptHTML: "whatever", spec: vert });
    expect(got).toEqual({ nums: [47, 38], ops: ["−"] });
    const plan = illustrationPlan({ promptHTML: "x", spec: vert }, 2)!;
    expect(plan.groups).toEqual([
      { n: 47, baskets: 4, singles: 7 },
      { n: 38, baskets: 3, singles: 8 },
    ]);
    // 乘除 / 分数等其他带参数的题型不硬配图
    expect(illustrationPlan({ promptHTML: "12 × 3 = ?", spec: { kind: "mul", a: 12, b: 3 } }, 0)).toBeNull();
    // 0 摆不出来、三位数摆不下、连加连减照常配
    expect(illustrationPlan({ promptHTML: "0 + 5 = ?" }, 0)).toBeNull();
    expect(ILLUS_MAX_OPERAND).toBe(99);
    expect(
      illustrationPlan({ promptHTML: "x", spec: { kind: "vertical", plus: true, a: 234, b: 88 } }, 0)
    ).toBeNull();
    expect(illustrationPlan({ promptHTML: "3 + 4 - 2 = ?" }, 0)?.nums).toEqual([3, 4, 2]);
    // 比大小 / 填空这类题面解析不出，返回 null 不硬凑
    expect(illustrationPlan({ promptHTML: "3 + 2 ○ 4" }, 0)).toBeNull();
    expect(illustrationPlan({ promptHTML: "3 + ⬜ = 8" }, 0)).toBeNull();
  });

  it("作物插图种类随题号轮换：萝卜→番茄→玉米→南瓜", () => {
    const kinds = [0, 1, 2, 3, 4].map((i) => illustrationPlan({ promptHTML: "2 + 1 = ?" }, i)?.crop);
    expect(kinds).toEqual(["carrot", "tomato", "corn", "pumpkin", "carrot"]);
    for (const [i, kind] of (["carrot", "tomato", "corn", "pumpkin"] as const).entries()) {
      const html = renderIllustration(illustrationPlan({ promptHTML: "2 + 1 = ?" }, i)!);
      expect(html).toContain(`data-crop="${kind}"`);
      expect(basketLegend(kind)).toContain(CROP_NAMES[kind]);
    }
  });
});

// ---------------------------------------------------------------------------
// 二、换肤前后题面与出题零改动（回归钉死）
// ---------------------------------------------------------------------------

describe("算数小农场 1.3 · 出题零改动回归", () => {
  it("renderSpec 的题面与引导语换肤前后一字不差（钉死）", () => {
    expect(renderSpec({ kind: "mul", a: 12, b: 3 })).toEqual({
      promptHTML: "12 × 3 = ?",
      ask: "算一算，积是多少？",
    });
    expect(renderSpec({ kind: "vertical", plus: true, a: 47, b: 38 })).toEqual({
      promptHTML:
        '<span class="mtf-vert"><span class="mtf-vert-row">47</span>' +
        '<span class="mtf-vert-row">+ 38</span><span class="mtf-vert-rule"></span>' +
        '<span class="mtf-vert-row">?</span></span>',
      ask: "个位满十要进一～",
    });
    expect(renderSpec({ kind: "word", form: "rows", n1: 5, n2: 6, n3: 8, item: 0, bag: 0 })).toEqual({
      promptHTML: '<span class="mtf-word">🧑‍🌾 农场种了 5 排南瓜，每排 6 个，送走 8 个，还剩几个？</span>',
      ask: "分两步想，先算什么？",
    });
    expect(renderSpec({ kind: "percent", form: "discount", base: 80, rate: 80, item: 4 })).toEqual({
      promptHTML: '<span class="mtf-word">🧑‍🌾 一箱鸡蛋原价 80 元，现在打八折，要付多少元？</span>',
      ask: "打折是按原价的几成算～",
    });
    expect(renderSpec({ kind: "frac", form: "compare", an: 3, ad: 5, bn: 2, bd: 3 })).toEqual({
      promptHTML: '3/5 <span class="mtf-slot">○</span> 2/3',
      ask: "○ 里应该填哪个符号？",
    });
    expect(renderSpec({ kind: "pattern", rule: "arith", terms: [3, 7, 11, 15, 19] })).toEqual({
      promptHTML: '3，7，11，15，19，<span class="mtf-slot">⬜</span>',
      ask: "找出规律，下一个是几？",
    });
  });

  it("种子固定的出题分布换肤前后一致（题型序列、题面、选项全钉死）", () => {
    expect(buildQuestions(105).map((q) => q.kind)).toEqual([
      "mul", "paren", "vertical", "vertical", "div", "div", "mul",
    ]);
    expect(strip(buildQuestions(105)[0].promptHTML)).toBe("6 × 6 = ?");
    expect(buildQuestions(105)[0].choices).toEqual(["12", "36", "6"]);
    expect(buildQuestions(141).map((q) => q.kind)).toEqual([
      "divmod", "pattern", "divmod", "div", "pattern", "divmod", "word", "paren", "word", "paren",
    ]);
    expect(strip(buildQuestions(141)[0].promptHTML)).toBe("94 ÷ 4 = ?");
    expect(buildQuestions(170).map((q) => q.kind)).toEqual([
      "word", "equation", "paren", "ratio", "paren", "percent",
    ]);
    expect(strip(buildQuestions(170)[0].promptHTML)).toBe(
      "🧑‍🌾 摘了 69 个苹果，先送走 13 个，剩下的每筐放 8 个，能装满几筐？"
    );
    expect(tableKinds(120, 8)).toEqual(["mul", "div", "vertical", "vertical", "paren", "paren", "word", "pattern"]);
    // 前 99 关老路径也没被碰
    expect(buildQuestions(2).map((q) => q.kind)).toEqual(["count", "count", "count", "count"]);
  });
});

// ---------------------------------------------------------------------------
// 三、农场舞台与 CSS 契约
// ---------------------------------------------------------------------------

describe("算数小农场 1.3 · 农场舞台与 CSS 契约", () => {
  it("整屏农场景配齐：太阳 + 云两朵、谷仓 + 风车、菜畦三块、木栅栏，全程无位图", () => {
    const svg = farmSceneSvg();
    expect(countOf(svg, 'data-part="sun"')).toBe(1);
    expect(countOf(svg, 'data-part="cloud"')).toBe(2);
    expect(countOf(svg, 'data-part="barn"')).toBe(1);
    expect(countOf(svg, 'data-part="windmill"')).toBe(1);
    expect(countOf(svg, 'class="mtf-mill-blades"')).toBe(1);
    expect(countOf(svg, 'data-part="bed"')).toBe(3);
    expect(countOf(svg, 'data-part="fence"')).toBe(1);
    // 天空渐变 + 栅栏贴底裁天不裁地
    expect(svg).toContain("mtfSkyGrad");
    expect(svg).toContain('preserveAspectRatio="xMidYMax slice"');
    for (const art of [svg, wateringCanSvg(), beeSvg()]) {
      expect(art).not.toMatch(/<image|data:image|\.png|\.jpg|\.webp/);
      expect(art).toContain('aria-hidden="true"');
    }
  });

  it("新样式全部 mtf- 前缀；.qz- 只在 .mtf-quizhost 作用域里换肤；动画层不挡点击", () => {
    const classes = FARM_CSS.match(/\.[a-zA-Z][\w-]*/g) ?? [];
    for (const c of classes) {
      expect(c.startsWith(".mtf-") || c.startsWith(".qz-"), `${c} 前缀不合规`).toBe(true);
    }
    for (const line of FARM_CSS.split("\n")) {
      if (line.includes(".qz-")) expect(line, `裸改壳样式：${line}`).toContain(".mtf-quizhost");
    }
    expect(FARM_CSS).not.toContain(".l99-");
    // 动画 / 特效层 pointer-events: none，永远不挡答题
    for (const cls of [".mtf-scene {", ".mtf-fx {", ".mtf-plots {"]) {
      const rule = FARM_CSS.slice(FARM_CSS.indexOf(cls));
      expect(rule.slice(0, rule.indexOf("}"))).toContain("pointer-events: none");
    }
  });

  it("360px：插图自动换行、单作物 ≥ 16px、木牌高度 ≥ 44px、风车云 8s 待机循环", () => {
    expect(FARM_CSS).toContain("flex-wrap: wrap");
    expect(MIN_CROP_PX).toBeGreaterThanOrEqual(16);
    expect(CROP_PX).toBeGreaterThanOrEqual(MIN_CROP_PX);
    const media = FARM_CSS.slice(FARM_CSS.indexOf("@media (max-width: 400px)"));
    expect(media).toContain(`width: ${MIN_CROP_PX}px; height: ${MIN_CROP_PX}px;`);
    expect(SIGN_MIN_H).toBeGreaterThanOrEqual(44);
    expect(FARM_CSS).toContain(`min-height: ${SIGN_MIN_H}px`);
    expect(MILL_SPIN_S).toBe(8);
    expect(FARM_CSS).toContain(`animation: mtfMillSpin ${MILL_SPIN_S}s linear infinite`);
    expect(FARM_CSS).toContain("mtfCloudDrift");
  });

  it("prefers-reduced-motion：风车 / 云 / 蜜蜂 / 成长 / 歪头动画全停，彩纸不出，反馈色仍在", () => {
    const reduced = FARM_CSS.slice(FARM_CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const cls of [".mtf-mill-blades", ".mtf-cloud", ".mtf-bee", ".mtf-plot-grow svg", ".mtf-plot-wobble svg"]) {
      expect(reduced, `${cls} 在 reduced 下没停`).toContain(cls);
    }
    expect(reduced).toContain("animation: none");
    expect(reduced).toContain(".mtf-confetti { display: none; }");
    // 答对的亮绿描边、答错的灰化是反馈色不是动画，留在 reduced 块之外
    const before = FARM_CSS.slice(0, FARM_CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(before).toContain(".mtf-quizhost .qz-choice.qz-right");
    expect(before).toContain(".mtf-quizhost .qz-choice.qz-wrong { filter: grayscale(.75); }");
  });
});

// ---------------------------------------------------------------------------
// 四、农场视觉层跑起来（stub DOM + 假时钟）
// ---------------------------------------------------------------------------

describe("算数小农场 1.3 · 农场视觉层", () => {
  let restoreDom = installDom();

  beforeEach(() => {
    restoreDom = installDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreDom();
  });

  /** 搭一个带 .qz-wrap / .qz-prompt 的舞台（照 quiz99 渲染出来的骨架） */
  function mount(count: number, reduced?: boolean) {
    const stage = new StubEl("div");
    const wrap = new StubEl("div");
    wrap.className = "qz-wrap";
    const prompt = new StubEl("div");
    prompt.className = "qz-prompt";
    wrap.appendChild(prompt);
    stage.appendChild(wrap);
    const questions = Array.from({ length: count }, (_, i) => ({ promptHTML: `${i + 2} + 1 = ?` }));
    const layer = createFarmLayer(stage as unknown as HTMLElement, questions, { reduced });
    return { stage, wrap, layer };
  }

  it("菜畦进度格数 = 题目总数，当前 / 已答 / 未答格类名区分，插图挂在题面卡正下方", () => {
    const { stage, wrap, layer } = mount(5);
    const cells = findAll(stage, "mtf-plot");
    expect(cells).toHaveLength(5);
    expect(cells[0].classList.contains("mtf-plot-now")).toBe(true);
    expect(cells[0].classList.contains("mtf-plot-todo")).toBe(false);
    for (const cell of cells.slice(1)) expect(cell.classList.contains("mtf-plot-todo")).toBe(true);
    layer.onCorrect(0);
    expect(cells[0].classList.contains("mtf-plot-done")).toBe(true);
    layer.onQuestion(1);
    expect(cells[0].classList.contains("mtf-plot-now")).toBe(false);
    expect(cells[1].classList.contains("mtf-plot-now")).toBe(true);
    // 插图卡插在 .qz-prompt 的下一个位置，题面本身一个字没动
    const at = wrap.children.findIndex((c) => c.classList.contains("qz-prompt"));
    expect(wrap.children[at + 1]?.classList.contains("mtf-illus")).toBe(true);
    // 菜畦格与插图的作物随题号轮换（第 0 格萝卜、第 1 格番茄）
    expect(String(cells[0].innerHTML)).toContain('data-crop="carrot"');
    expect(String(cells[1].innerHTML)).toContain('data-crop="tomato"');
    layer.destroy();
  });

  it("答对走三阶段成长 + 浇水两滴，答错走歪头 + 再想想木牌，两分支互斥且不拔苗", () => {
    const { stage, layer } = mount(3);
    const cell = findAll(stage, "mtf-plot")[0];
    expect(cell.getAttribute("data-stage")).toBe("sprout");

    // 答错：歪头 + 木牌，苗还在畦里
    layer.onWrong(0);
    expect(cell.classList.contains("mtf-plot-wobble")).toBe(true);
    expect(cell.classList.contains("mtf-plot-grow")).toBe(false);
    expect(cell.getAttribute("data-stage")).toBe("sprout");
    const sign = findOne(stage, "mtf-rethink");
    expect(sign?.textContent).toBe(RETHINK_TEXT);
    expect(sign?.textContent).not.toMatch(/错|笨|差|不行/);
    vi.advanceTimersByTime(WOBBLE_MS + 5);
    expect(cell.classList.contains("mtf-plot-wobble")).toBe(false);
    vi.advanceTimersByTime(RETHINK_MS);
    expect(findOne(stage, "mtf-rethink")).toBeNull();

    // 答对：发芽 → 长叶 → 结果，450ms 收尾，配一把浇水壶
    layer.onCorrect(0);
    expect(cell.classList.contains("mtf-plot-grow")).toBe(true);
    expect(cell.classList.contains("mtf-plot-wobble")).toBe(false);
    expect(cell.getAttribute("data-stage")).toBe("sprout");
    expect(findOne(stage, "mtf-water")).not.toBeNull();
    vi.advanceTimersByTime(GROW_STEP_MS + 2);
    expect(cell.getAttribute("data-stage")).toBe("leaf");
    vi.advanceTimersByTime(GROW_STEP_MS);
    expect(cell.getAttribute("data-stage")).toBe("fruit");
    vi.advanceTimersByTime(GROW_TOTAL_MS);
    expect(cell.classList.contains("mtf-plot-grow")).toBe(false);
    vi.advanceTimersByTime(WATER_MS);
    expect(findOne(stage, "mtf-water")).toBeNull();
    expect(GROW_STEP_MS * 3).toBe(GROW_TOTAL_MS);
    layer.destroy();
  });

  it("连对三题小蜜蜂绕场一圈；一轮全对收获仪式：计数板 + 彩纸 20 粒 + 作物跳篮", () => {
    const { stage, layer } = mount(3);
    layer.onCorrect(0);
    layer.onQuestion(1);
    layer.onCorrect(1);
    expect(findOne(stage, "mtf-bee")).toBeNull();
    layer.onQuestion(2);
    layer.onCorrect(2);
    expect(BEE_EVERY).toBe(3);
    const bee = findOne(stage, "mtf-bee");
    expect(bee).not.toBeNull();
    expect(bee?.classList.contains("mtf-bee-still")).toBe(false);
    // 全部种完：收获仪式
    expect(findOne(stage, "mtf-harvest-board")?.textContent).toContain("今日收获 3 棵");
    expect(findAll(stage, "mtf-confetti")).toHaveLength(CONFETTI_N);
    expect(findAll(stage, "mtf-harvest-jump").length).toBeGreaterThan(0);
    vi.advanceTimersByTime(Math.max(BEE_MS, HARVEST_MS + 500));
    expect(findOne(stage, "mtf-bee")).toBeNull();
    expect(findAll(stage, "mtf-confetti")).toHaveLength(0);
    // 计数板留着给孩子看，直到这一轮收工
    expect(findOne(stage, "mtf-harvest-board")).not.toBeNull();
    layer.destroy();
  });

  it("reduced：答对直接结果阶段、无浇水无彩纸、蜜蜂静止贴花、静态收成画面仍在", () => {
    const { stage, layer } = mount(3, true);
    layer.onCorrect(0);
    const cell = findAll(stage, "mtf-plot")[0];
    expect(cell.getAttribute("data-stage")).toBe("fruit");
    expect(cell.classList.contains("mtf-plot-grow")).toBe(false);
    expect(findOne(stage, "mtf-water")).toBeNull();
    layer.onQuestion(1);
    layer.onCorrect(1);
    layer.onQuestion(2);
    layer.onCorrect(2);
    const bee = findOne(stage, "mtf-bee");
    expect(bee?.classList.contains("mtf-bee-still")).toBe(true);
    expect(findOne(stage, "mtf-harvest-board")?.textContent).toContain("今日收获 3 棵");
    expect(findAll(stage, "mtf-confetti")).toHaveLength(0);
    expect(findAll(stage, "mtf-harvest-jump")).toHaveLength(0);
    layer.destroy();
  });

  it("destroy 后风车 / 蜜蜂 / 彩纸计时器归零，视觉节点一个不剩", () => {
    const { stage, layer } = mount(3);
    layer.onWrong(0);
    layer.onCorrect(0);
    layer.onQuestion(1);
    layer.onCorrect(1);
    layer.onQuestion(2);
    layer.onCorrect(2); // 蜜蜂 + 收获 + 彩纸全在飞
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    layer.destroy();
    expect(vi.getTimerCount()).toBe(0);
    for (const cls of ["mtf-scene", "mtf-plots", "mtf-plot", "mtf-fx", "mtf-illus", "mtf-confetti", "mtf-bee"]) {
      expect(findAll(stage, cls), `${cls} 没收干净`).toHaveLength(0);
    }
    expect(stage.children.filter((c) => c.tagName === "style")).toHaveLength(0);
    // 风车是纯 CSS 动画，本来就没有 JS 计时器可漏
    expect(farmSceneSvg()).not.toMatch(/setInterval|setTimeout/);
    expect(() => layer.destroy()).not.toThrow();
  });

  it("作物贴纸抽查：四种结果阶段两两不同、发芽长叶共骨架（kit 契约在皮肤侧再钉一次）", () => {
    const fruits = CROP_KINDS.map((k) => crop(k, "fruit", CROP_PX));
    expect(new Set(fruits).size).toBe(CROP_KINDS.length);
    for (const k of CROP_KINDS) {
      expect(new Set([crop(k, "sprout"), crop(k, "leaf"), crop(k, "fruit")]).size).toBe(3);
    }
    expect(basket(CROP_PX)).toContain("×10");
  });
});

// ---------------------------------------------------------------------------
// 五、整关接线：换肤层挂进一关，判定与朗读原样
// ---------------------------------------------------------------------------

describe("算数小农场 1.3 · 整关接线", () => {
  let restoreDom = installDom();
  let restoreObserver = installMutationObserver();

  beforeEach(() => {
    restoreDom = installDom();
    restoreObserver = installMutationObserver();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreObserver();
    restoreDom();
  });

  /** 照 quiz99 骨架搭替身（比 upgrade12 的多一颗 .qz-say，验 TTS 接线原样） */
  function paintRound(stage: StubEl, opts: QuizOptions): { paint: (i: number) => void; say: StubEl } {
    const wrap = new StubEl("div");
    wrap.className = "qz-wrap";
    const prompt = new StubEl("div");
    prompt.className = "qz-prompt";
    const say = new StubEl("button");
    say.className = "qz-say";
    say.addEventListener("click", () => {});
    const choices = new StubEl("div");
    choices.className = "qz-choices";
    const msg = new StubEl("div");
    msg.className = "qz-msg";
    wrap.appendChild(prompt);
    wrap.appendChild(say);
    wrap.appendChild(choices);
    wrap.appendChild(msg);
    stage.appendChild(wrap);
    const paint = (index: number): void => {
      const q = opts.questions[index];
      while (prompt.children.length) prompt.children[0].remove();
      const line = new StubEl("span");
      line.textContent = q.promptHTML;
      prompt.appendChild(line);
      while (choices.children.length) choices.children[0].remove();
      for (const c of q.choices) {
        const btn = new StubEl("button");
        btn.className = "qz-choice";
        btn.textContent = c;
        choices.appendChild(btn);
      }
    };
    return { paint, say };
  }

  function run(level = 170) {
    const stage = new StubEl("div");
    const rounds: Array<{ opts: QuizOptions; paint: (i: number) => void; say: StubEl }> = [];
    const ctx: PlayCtx = {
      level,
      chapter: { name: "括号谷仓", emoji: "🧺", color: "#e3f0ff", desc: "", size: 22 },
      chapterIndex: 9,
      indexInChapter: 3,
      win: () => {},
      lose: () => {},
      sfx: () => {},
      bonusStars: () => {},
    };
    const handle = playFarmLevel(stage as unknown as HTMLElement, ctx, {
      storage: null,
      runner: (opts) => {
        const { paint, say } = paintRound(stage, opts);
        paint(0);
        rounds.push({ opts, paint, say });
        return { destroy: () => {} };
      },
    });
    return { stage, rounds, handle };
  }

  it("舞台 / 菜畦 / 插图随一关挂上：格数 = 题量，答对答错走视觉分支，destroy 全收", () => {
    const h = run();
    const questions = h.rounds[0].opts.questions as MathQ[];
    expect(findAll(h.stage, "mtf-scene")).toHaveLength(1);
    expect(findAll(h.stage, "mtf-plot")).toHaveLength(questions.length);
    expect(findAll(h.stage, "mtf-illus")).toHaveLength(1);

    const btns = findAll(h.stage, "qz-choice");
    const q0 = questions[0];
    clickOn(h.stage, btns.filter((_, i) => i !== q0.correct)[0]);
    const cell0 = findAll(h.stage, "mtf-plot")[0];
    expect(cell0.classList.contains("mtf-plot-wobble")).toBe(true);
    expect(findOne(h.stage, "mtf-rethink")?.textContent).toBe(RETHINK_TEXT);
    clickOn(h.stage, btns[q0.correct]);
    expect(cell0.classList.contains("mtf-plot-grow")).toBe(true);
    expect(cell0.classList.contains("mtf-plot-wobble")).toBe(false);
    // 壳换题 → 菜畦当前格跟着走（stub 的观察者替身一次换题连发两条通知，
    // 真浏览器按批回调只走一步；这里只钉「离开第 0 格、当前格唯一」这条两边都成立的账）
    h.rounds[0].paint(1);
    const cells = findAll(h.stage, "mtf-plot");
    expect(cells[0].classList.contains("mtf-plot-now")).toBe(false);
    expect(cells.filter((c) => c.classList.contains("mtf-plot-now"))).toHaveLength(1);

    h.handle.destroy();
    expect(vi.getTimerCount()).toBe(0);
    for (const cls of ["mtf-scene", "mtf-plots", "mtf-fx", "mtf-illus"]) {
      expect(findAll(h.stage, cls)).toHaveLength(0);
    }
  });

  it("TTS 朗读按钮接线换肤后原样：皮肤不摸 .qz-say、不插嘴朗读", () => {
    const speech = installSpeech();
    try {
      const h = run();
      const say = h.rounds[0].say;
      // 换肤层挂上后按钮还在原处、监听一个没少也一个没多
      expect(say.parentElement?.classList.contains("qz-wrap")).toBe(true);
      expect(say.listenerCount).toBe(1);
      // 第一次答错皮肤只画歪头，不发一声（朗读仍归壳与提示层管）
      const q0 = h.rounds[0].opts.questions[0] as MathQ;
      clickOn(h.stage, findAll(h.stage, "qz-choice").filter((_, i) => i !== q0.correct)[0]);
      vi.advanceTimersByTime(5);
      expect(speech.spoken).toHaveLength(0);
      expect(say.listenerCount).toBe(1);
      h.handle.destroy();
      expect(say.listenerCount, "皮肤不许动喇叭按钮的监听").toBe(1);
    } finally {
      speech.restore();
    }
  });
});
