import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { TOTAL_LEVELS } from "./level99";
import {
  ROOT_TTL_MS,
  clearRootSession,
  resetRoot12Extras,
  writeRootSession
} from "../ui/root12Contract";
import { quizJumpIndex, quizJumpVisible } from "./quiz99";
import {
  CHEERS,
  FAIL_LINE,
  MAX_QUESTIONS,
  PRAISES,
  SKIP_NOTE,
  bonusStreakStep,
  clampQuestions,
  defaultMaxWrong,
  quizFinishLine,
  quizProgressText,
  quizStars,
  shouldHint
} from "./quiz99";

describe("quiz99 悄悄提示规则", () => {
  it("同一道题连错 2 次就给提示", () => {
    expect(shouldHint(1, 1, 3)).toBe(false);
    expect(shouldHint(2, 2, 3)).toBe(true);
    expect(shouldHint(3, 3, 3)).toBe(true);
  });

  it("总错数到上限（再错就失败）时,哪怕本题才错 1 次也给提示", () => {
    // 前两题各错 1 次 + 本题错 1 次 = 总 3 次(maxWrong=3):最后机会必须点亮答案
    expect(shouldHint(1, 3, 3)).toBe(true);
    // 总错数没到上限、本题也才错 1 次:先让孩子自己想
    expect(shouldHint(1, 2, 3)).toBe(false);
  });

  it("maxWrong 更宽松时按同样规则推迟提示", () => {
    expect(shouldHint(1, 4, 6)).toBe(false);
    expect(shouldHint(1, 6, 6)).toBe(true);
    expect(shouldHint(2, 2, 6)).toBe(true);
  });
});

describe("quiz99 题量上限跟随 188", () => {
  it("一关最多 188 道题", () => {
    expect(MAX_QUESTIONS).toBe(TOTAL_LEVELS);
    expect(MAX_QUESTIONS).toBe(188);
  });

  it("clampQuestions 截断超长题组、短题组原样返回", () => {
    const many = Array.from({ length: 300 }, (_, i) => i);
    expect(clampQuestions(many)).toHaveLength(188);
    expect(clampQuestions(many)[187]).toBe(187);
    const few = [1, 2, 3];
    expect(clampQuestions(few)).toEqual(few);
    expect(clampQuestions([])).toEqual([]);
  });

  it("defaultMaxWrong：短题组维持 1.0 的 3 次容错", () => {
    expect(defaultMaxWrong(5)).toBe(3);
    expect(defaultMaxWrong(12)).toBe(3);
    expect(defaultMaxWrong(24)).toBe(3);
    expect(defaultMaxWrong(0)).toBe(3);
  });

  it("defaultMaxWrong：题量越大容错越宽松", () => {
    expect(defaultMaxWrong(40)).toBe(5);
    expect(defaultMaxWrong(188)).toBe(24);
    expect(defaultMaxWrong(188)).toBeGreaterThan(defaultMaxWrong(24));
  });

  it("quizStars：短题组的评星与 1.0 完全一致", () => {
    expect(quizStars(0, 10)).toBe(3);
    expect(quizStars(1, 10)).toBe(2);
    expect(quizStars(2, 10)).toBe(2);
    expect(quizStars(3, 10)).toBe(1);
  });

  it("quizStars：188 题的 2 星阈值按一成放宽", () => {
    expect(quizStars(0, 188)).toBe(3);
    expect(quizStars(19, 188)).toBe(2);
    expect(quizStars(20, 188)).toBe(1);
  });

  it("bonusStreakStep：长题组把连对奖励节奏放慢", () => {
    expect(bonusStreakStep(10)).toBe(4);
    expect(bonusStreakStep(24)).toBe(4);
    expect(bonusStreakStep(25)).toBe(8);
    expect(bonusStreakStep(188)).toBe(8);
  });

  it("quizProgressText：长题组额外报还剩多少题", () => {
    expect(quizProgressText(0, 10)).toBe("第 1 / 10 题");
    expect(quizProgressText(0, 188)).toBe("第 1 / 188 题 · 还剩 187");
    expect(quizProgressText(187, 188)).toBe("第 188 / 188 题 · 还剩 0");
  });
});

describe("quiz99 文案只鼓励不批评", () => {
  it("答错与收尾文案里没有任何批评措辞", () => {
    const all = [...CHEERS, FAIL_LINE, quizFinishLine(3, 188), quizFinishLine(0, 188)].join("");
    expect(all).not.toMatch(/笨|蠢|差劲|不行|失败|真糟/);
  });

  it("答对夸奖不空、也不肉麻低幼", () => {
    expect(PRAISES.length).toBeGreaterThan(0);
    expect(PRAISES.join("")).not.toMatch(/宝宝|乖乖|小笨蛋/);
  });

  it("跳过提示是「回来拿下」的口气，不指责孩子", () => {
    expect(SKIP_NOTE).toContain("跳过");
    expect(SKIP_NOTE).not.toMatch(/偷懒|不该|逃避/);
  });

  it("收尾文案按是否全对给不同的肯定", () => {
    expect(quizFinishLine(0, 188)).toBe("全部一次答对，太了不起啦！");
    expect(quizFinishLine(2, 188)).toBe("188 道题全部完成！");
  });
});

// ---------------------------------------------------------------------------
// 1.2 新增：管理员权限「直达第 N 题」
// ---------------------------------------------------------------------------

describe("quiz99 直达第 N 题（管理员权限）", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    resetRoot12Extras();
    clearRootSession(null);
  });

  it("管理员权限关着时，直达控件根本不该出现", () => {
    expect(quizJumpVisible(NOW)).toBe(false);
  });

  it("管理员权限开着时才出现，一小时后又消失", () => {
    writeRootSession(NOW + ROOT_TTL_MS, null);
    expect(quizJumpVisible(NOW)).toBe(true);
    expect(quizJumpVisible(NOW + ROOT_TTL_MS)).toBe(false);
  });

  it("能直达题组里的最后一题（内部是 0 基题号）", () => {
    expect(quizJumpIndex("12", 12)).toBe(11);
    expect(quizJumpIndex("1", 12)).toBe(0);
  });

  it("越界与坏输入都不炸：夹到题组范围内或原地不动", () => {
    expect(quizJumpIndex("0", 12)).toBe(0);
    expect(quizJumpIndex("99", 12)).toBe(11);
    expect(quizJumpIndex("1e9", 12)).toBe(11);
    expect(quizJumpIndex("abc", 12)).toBeNull();
    expect(quizJumpIndex("", 12)).toBeNull();
    expect(() => quizJumpIndex("abc", 0)).not.toThrow();
  });

  it("直达不会把题量上限撑破（最多 188 题）", () => {
    expect(quizJumpIndex("500", 999)).toBe(MAX_QUESTIONS - 1);
    expect(MAX_QUESTIONS).toBe(TOTAL_LEVELS);
  });

  it("直达不改评星口径：错题数怎么算还是怎么算", () => {
    expect(quizStars(0, 12)).toBe(3);
    quizJumpIndex("6", 12);
    expect(quizStars(0, 12)).toBe(3);
    expect(quizStars(9, 12)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 三办 R5 · 测试员 A(L-1):横屏矮屏(915×412 一族)答题器整块比舞台可视段高,
// 选项钮掉到折叠线下。修法是 @media (max-height:500px) 里只收空隙与展示字号。
// 这里钉住:紧凑档在场、热区与字号红线没被顺手压穿、题面插图有 max-height 兜底。
// ---------------------------------------------------------------------------

describe("quiz99 横屏矮屏紧凑档(三办 R5-A L-1)", () => {
  const src = readFileSync(new URL("./quiz99.ts", import.meta.url), "utf8");
  const start = src.indexOf("@media (max-height: 500px)");
  const block = src.slice(start, src.indexOf("`;", start));

  it("紧凑档媒体查询在场,且只认 500px 以下的矮屏", () => {
    expect(start).toBeGreaterThan(0);
    expect(block).toContain(".qz-wrap { min-height: 0;");
  });

  it("选项与朗读钮热区 ≥44px,所有写死字号 ≥14px", () => {
    // 只有按得着的控件吃 44px 红线;.qz-msg/.qz-ask 是文本行,不在此列
    for (const m of block.matchAll(/\.qz-(?:choice|say)[^{]*\{([^}]*)\}/g)) {
      const h = /min-height:\s*(\d+)px/.exec(m[1]);
      if (h) expect(Number(h[1]), `紧凑档 ${m[0].slice(0, 30)}`).toBeGreaterThanOrEqual(44);
    }
    for (const m of block.matchAll(/font-size:\s*(\d+)px/g)) {
      expect(Number(m[1]), `紧凑档 font-size ${m[0]}`).toBeGreaterThanOrEqual(14);
    }
  });

  it("题面插图按配方收高:svg/img 有 max-height 兜底,选项行才能进屏", () => {
    expect(block).toMatch(/\.qz-prompt svg, \.qz-prompt img \{ max-height: \d+px/);
    expect(block).toContain(".qz-prompt .mtf-vert");
    expect(block).toContain(".qz-wrap > .mtf-illus");
  });

  it("正文红线不动:.qz-ask 的 17px 基准字号还在(紧凑档只收 min-height)", () => {
    expect(src).toContain(".qz-ask { text-align: center; font-size: 17px;");
  });

  // L-1 补账(trio-r7):紧凑档收完 915×412 仍差 43px(题面 76 + 选项 46 + 消息 18
  // 纵排 > 202px 可视窗,选项钮下缘裁 11、答后反馈整行线下),再切「题面左 / 作答右」双栏。
  // 真机复测 shape-kingdom / clock-house / word-garden / math-farm 四款 915×412 全裁 0。
  describe("矮横屏双栏(trio-r7 补账)", () => {
    it("紧凑档里 .qz-wrap 切成 grid 双栏", () => {
      expect(block).toContain(".qz-wrap { display: grid; grid-template-columns: minmax(0,1fr) minmax(300px,55%);");
    });

    it("题面进左栏且 span 恰好 4 行(跨空行 Chrome 会把题面高摊进去凭空长高)", () => {
      expect(block).toContain(".qz-prompt { grid-column: 1; grid-row: span 4;");
      expect(block).toContain(".qz-ask, .qz-say-row, .qz-choices, .qz-msg { grid-column: 2; }");
    });

    it("可选行(进度/进度条/跳关说明/直达)整行横跨,在不在都不错位", () => {
      expect(block).toContain(".qz-top, .qz-bar, .qz-skip, .qz-jump { grid-column: 1/-1; }");
    });
  });
});

describe("S-4 扩容:quiz 直达输入框热区 ≥44px", () => {
  it(".qz-jump-input min-height 提到 44", () => {
    const src = readFileSync(new URL("./quiz99.ts", import.meta.url), "utf8");
    const m = /\.qz-jump-input \{[^}]*min-height: (\d+)px/.exec(src);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(44);
  });
});
