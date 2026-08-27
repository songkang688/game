/**
 * 时钟小屋 · 钟面读屏标签的守门用例（窗口5 第1轮学习优化员补）。
 *
 * 测试员在档A 记了 W5-A-01：题面那张钟面的 `aria-label` 直接就是答案
 * （`read` 413 道 + `readMin` 33 道，共 446 道），读屏的孩子和随手看一眼 DOM 的人
 * 都不用读钟就知道答案。修完还得有人钉着，否则以后加题型会长回来——就是这一份。
 *
 * 口径：188 关每一道题，题面与选项里出现的每一个 `aria-label`
 *  1. 一个数字都不许有（时刻一定带数字，这条最简单也最难绕过）；
 *  2. 不许包含这道题的答案文字。
 * 拨一拨那个练手钟面是例外中的例外——它的标签由 `dial.ts` 在拖动时实时改写，
 * 静态 HTML 里给的是「可以拖动的钟面」，同样不含数字，照样过这条线。
 */
import { describe, expect, it } from "vitest";
import { FACE_LABEL, faceSVG } from "./clockface";
import { answerTextOf, buildQuestions, clockSVG, LEVELS } from "./levels";

/** 扒出一段 HTML 里所有的 aria-label */
function labelsIn(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
}

describe("时钟小屋 · 钟面的读屏标签不许把答案念出来", () => {
  it("188 关题面与选项的每一个 aria-label 都不含数字", () => {
    let seen = 0;
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const q of buildQuestions(lv)) {
        for (const html of [q.promptHTML, ...q.choices]) {
          for (const label of labelsIn(html)) {
            seen++;
            expect(/\d/.test(label), `第 ${lv + 1} 关 ${q.kind} 的标签带数字：${label}`).toBe(false);
          }
        }
      }
    }
    // 自检有效性：188 关里确实有大量钟面，不是因为一个标签都没扫到才「全过」
    expect(seen).toBeGreaterThan(400);
  });

  it("188 关题面与选项的每一个 aria-label 都不包含这道题的答案", () => {
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const q of buildQuestions(lv)) {
        const answer = answerTextOf(q);
        for (const html of [q.promptHTML, ...q.choices]) {
          for (const label of labelsIn(html)) {
            expect(label.includes(answer), `第 ${lv + 1} 关 ${q.kind} 的标签泄答案：${label}`).toBe(false);
          }
        }
      }
    }
  });

  it("两个钟面渲染器的默认标签都是不含时刻的说明", () => {
    expect(FACE_LABEL).not.toMatch(/\d/);
    expect(clockSVG(4, 0, 120)).toContain(`aria-label="${FACE_LABEL}"`);
    expect(clockSVG(4, 0, 120)).not.toContain('aria-label="4 点"');
    expect(faceSVG(4 * 60 + 35, 150)).toContain(`aria-label="${FACE_LABEL}"`);
    expect(faceSVG(4 * 60 + 35, 150)).not.toContain('aria-label="4 点 35 分"');
    // 要念时刻的地方仍然可以自己传（拨一拨的练手钟面就靠这条）
    expect(faceSVG(0, 150, { label: "可以拖动的钟面" })).toContain('aria-label="可以拖动的钟面"');
    expect(clockSVG(4, 0, 82, "钟面")).toContain('aria-label="钟面"');
  });

  it("钟面都标了 role=img，读屏不会把它当成一堆无意义的线条", () => {
    expect(clockSVG(9, 2, 82)).toContain('role="img"');
    expect(faceSVG(9 * 60 + 30, 84)).toContain('role="img"');
  });
});
