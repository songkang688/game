/**
 * 守门：答题屏必须钳进「舞台真正看得见的那一段」（第 2 轮档A 监督修复员 W5R2-F-A-02，阻断）。
 *
 * 真机实测（Chrome 148 headless + CDP，命中一律 `document.elementFromPoint(键心)`，
 * 全程没有用过 `el.click()`）——320×568：
 *   `.game-stage` 看得见 458px、下沿 y=554；第三个选项的键心落在 y=587..593，
 *   第 41 关是「笔」、第 91 关是「蛋」、第 141 关是「冷清」，`elementFromPoint` 一律拿回 null；
 *   这条祖先链上 overflow 是 auto/scroll 的一个都没有，手指划不动。
 * 三选一的题少一个选项 = 那道题可能答不了 = 这一关过不去，按阻断记。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fitQuizHost, visibleRoomPx } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const runnerSource = readFileSync(`${dir}runner.ts`, "utf8");

class FakeView {
  readonly listeners = new Map<string, Array<() => void>>();
  getComputedStyle(el: FakeEl): { overflowY: string } {
    return { overflowY: el.overflowY };
  }
  addEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  get resizeListenerCount(): number {
    return this.listeners.get("resize")?.length ?? 0;
  }
}

class FakeEl {
  readonly style: Record<string, string> = {
    maxHeight: "",
    minHeight: "",
    overflowY: "",
    overscrollBehavior: "",
  };
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  top = 0;
  content = 0;
  constructor(readonly name: string, readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  get scrollHeight(): number {
    return this.content;
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    const capped = Number.parseFloat(this.style.maxHeight);
    const h = Number.isFinite(capped) ? Math.min(this.content, capped) : this.content;
    return { top: this.top, bottom: this.top + h, height: h };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

/** 复刻真机那条链：`.game-stage`(hidden，定高) → `.l99-stage-wrap`(hidden，auto 高) → `.l99-stage` → 宿主 */
function makeChain(o: { stageTop: number; stageBottom: number; selfTop: number; selfContent: number }) {
  const view = new FakeView();
  const stage = new FakeEl(".game-stage", view);
  stage.overflowY = "hidden";
  stage.top = o.stageTop;
  stage.content = o.stageBottom - o.stageTop;

  const wrap = new FakeEl(".l99-stage-wrap", view);
  wrap.overflowY = "hidden";
  wrap.top = o.stageTop + 4;
  wrap.content = 4000; // 内容撑出来的 auto 高：`max-height:100%` 钳不住就是因为它
  wrap.parentElement = stage;

  const inner = new FakeEl(".l99-stage", view);
  inner.top = o.selfTop - 10;
  inner.content = 4000;
  inner.parentElement = wrap;

  const host = new FakeEl(".wgd-quizhost", view);
  host.top = o.selfTop;
  host.content = o.selfContent;
  host.parentElement = inner;
  return { view, stage, host };
}

describe("识字小花园 · 舞台看得见多少", () => {
  it("取最靠里的那一层裁切祖先算下沿", () => {
    expect(visibleRoomPx(212, [554, 688])).toBe(342);
    expect(visibleRoomPx(212, [688, 554])).toBe(342);
  });

  it("一层裁切祖先都没有（用例里的裸节点）就当不用钳", () => {
    expect(visibleRoomPx(212, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it("已经被裁没了会算出非正数——那种情况一律不钳", () => {
    expect(visibleRoomPx(700, [554])).toBeLessThan(0);
  });
});

describe("识字小花园 · 答题屏钳位器", () => {
  it("320×568：答题屏 455 高、舞台只看得见 342，钳到 342 并且能滚", () => {
    const { host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 455 });
    fitQuizHost(host.asEl());
    expect(host.style.maxHeight).toBe("342px");
    expect(host.style.overflowY).toBe("auto");
    expect(host.style.overscrollBehavior).toBe("contain");
  });

  it("钳住的同时把高度下限一起松开——min-height 赢 max-height，不松等于没钳（W5R3-A-02）", () => {
    const { stage, host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 455 });
    const fit = fitQuizHost(host.asEl());
    expect(host.style.minHeight, "组字工坊的 .bc-wrap 写着 min-height:380px，不松开钳位整条空转").toBe("0");
    // 松回去的那一路要成对还原，不然高屏上被永久按成 0
    stage.content = 830 - 88;
    fit.relayout();
    expect(host.style.minHeight).toBe("");
  });

  it("钳完之后第三个选项真的进得来（这条钉的是缺陷本身）", () => {
    // 真机数字：第三个选项键心在宿主内部 381px 处（y=593 − 宿主顶 212），底沿约 413px
    const { host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 455 });
    fitQuizHost(host.asEl());
    const room = Number.parseFloat(host.style.maxHeight);
    const canScroll = host.scrollHeight - room;
    expect(canScroll).toBeGreaterThan(0);
    expect(413 - canScroll).toBeLessThanOrEqual(room);
  });

  it("反例：不钳的话祖先链上一个能滚的都没有——缺陷不是我编的", () => {
    const { host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 455 });
    expect(host.style.overflowY).toBe("");
    expect(host.scrollHeight).toBeGreaterThan(554 - 212);
    for (let p = host.parentElement; p; p = p.parentElement) {
      expect(["hidden", "visible"]).toContain(p.overflowY);
    }
  });

  it("390×844 这种地方够的屏上一个字节都不写", () => {
    const { host } = makeChain({ stageTop: 92, stageBottom: 830, selfTop: 216, selfContent: 420 });
    fitQuizHost(host.asEl());
    expect(host.style.maxHeight).toBe("");
    expect(host.style.overflowY).toBe("");
  });

  it("量之前先把上一次钳的还原：转屏变宽之后能自己松回去", () => {
    const { stage, host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 455 });
    const fit = fitQuizHost(host.asEl());
    expect(host.style.maxHeight).toBe("342px");
    stage.content = 830 - 88;
    fit.relayout();
    expect(host.style.maxHeight).toBe("");
  });

  it("换一题就重量一次：题面变高之后钳得住，变矮之后放得开", () => {
    const { host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 300 });
    const fit = fitQuizHost(host.asEl());
    expect(host.style.maxHeight).toBe("");
    host.content = 520;
    fit.relayout();
    expect(host.style.maxHeight).toBe("342px");
  });

  it("resize 上挂了监听，dispose 之后收干净", () => {
    const { view, host } = makeChain({ stageTop: 88, stageBottom: 554, selfTop: 212, selfContent: 455 });
    const fit = fitQuizHost(host.asEl());
    expect(view.resizeListenerCount).toBe(1);
    fit.dispose();
    expect(view.resizeListenerCount).toBe(0);
  });

  it("量不了的裸节点既不抛也不写样式", () => {
    const bare = {} as HTMLElement;
    expect(() => fitQuizHost(bare).dispose()).not.toThrow();
  });
});

describe("识字小花园 · 钳位器怎么接进去的（源码巡检）", () => {
  it("答题器挂在本款自己的 .wgd-quizhost 里，而不是直接挂舞台", () => {
    expect(runnerSource).toContain('host.className = "wgd-quizhost"');
    // 正题与复查轮两处都得走宿主，漏一处那一轮就又裁回去了
    expect([...runnerSource.matchAll(/runQuiz\(\{/g)].length).toBe(2);
    expect(runnerSource).not.toMatch(/runQuiz\(\{\s*\n?\s*stage,/);
  });

  it("宿主由 fitQuizHost 钳住，换题时重量，destroy 时拆监听并摘掉宿主", () => {
    expect(runnerSource).toContain("fitQuizHost(host)");
    expect(runnerSource).toContain("fit.relayout()");
    expect(runnerSource).toContain("fit.dispose()");
    expect(runnerSource).toContain("host.remove()");
  });

  it("描红台与组字工坊不走 .wgd-quizhost 这条路（它们不是 quiz99 答题屏）", () => {
    expect(runnerSource).toContain("runTracing({ stage,");
    expect(runnerSource).toContain("runBuildChar({ stage,");
    // 但工坊自己在本款壳里叫了同一个钳位器（W5R3-A-02），守门在 buildCharFit.test.ts
  });

  it("qz- 前缀的既有规则一条都没动（那是公共资产）", () => {
    const css = REVIEW_CSS_OF(runnerSource);
    for (const m of css.matchAll(/(^|[\s,{])\.qz-[\w-]+/g)) {
      throw new Error(`本款样式里不许直接写 qz- 选择器：${m[0].trim()}`);
    }
    expect(css).toContain(".wgd-quizhost");
  });
});

function REVIEW_CSS_OF(src: string): string {
  const i = src.indexOf("export const REVIEW_CSS");
  return src.slice(i, src.indexOf("`;", i));
}
