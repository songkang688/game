/**
 * 算数小农场 · 横过来拿的时候三颗选项不许掉在裁切线以下
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`W5R2-FB-02` 阻断）。
 *
 * 本档五款里,只有这一款把 `quiz99` **直接渲染进 `.game-stage`**——
 * 另外四款各有一层自己的壳（`.fs-wrap` / `.rbt-wrap` / `.shk-quizhost` / `.mst-wrap`），
 * 前两轮给那四层都补上了「量出真实像素钳死自己、内容一高就在自己身上滚」。
 * 这一款没有那一层，于是超出的部分**直接交给舞台裁**，而舞台是
 * 定高 + `overflow:hidden`（`src/styles.css`，平台文件，交窗口1）。
 *
 * 真机 CDP 实测（第 40 关，从 390×844 转到横屏）：
 *
 * ```
 * 视口       .qz-choice 中心   舞台裁切线   能起手滚的地方
 * 844×390    y=405            y=382       一处都没有
 * 740×360    y=405            y=352       一处都没有
 * 640×360    y=405            y=352       一处都没有
 * ```
 *
 * 三颗选项整排掉在线外，`elementFromPoint` 全返回 `null`；
 * 全场扫一遍找不到任何 `scrollHeight − clientHeight > 4` 的祖先，真手指也救不回来。
 * **这一关一道题都答不了。**
 *
 * 修法照抄 `shape-kingdom` 的 `.shk-quizhost`（`review.ts` + `draw.ts` 的
 * `fitIntoStage()`）：本款自己起一层 `.mtf-quizhost` 把答题壳装进去，
 * 宿主钳进舞台看得见的那一段，内容一高就在宿主身上滚。
 * `quiz99` 一行不动（平台文件），判分、朗读、`.qz-*` 的 DOM 一个字节都没碰。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { capPx, clipBottomPx, fitIntoStage, visibleRoomPx } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const runnerSource = readFileSync(`${dir}runner.ts`, "utf8");

interface StubStyle {
  overflowY: string;
  borderBottomWidth: string;
}

class FakeEl {
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  borderBottom = "0px";
  top = 0;
  height = 0;
  scrollHeight = 0;
  style: Record<string, string> = { maxHeight: "", overflowY: "" };
  constructor(readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    return { top: this.top, bottom: this.top + this.height, height: this.height };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

class FakeView {
  readonly listeners: Array<[string, () => void]> = [];
  getComputedStyle(el: FakeEl): StubStyle {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom };
  }
  addEventListener(type: string, fn: () => void): void {
    this.listeners.push([type, fn]);
  }
  removeEventListener(type: string, fn: () => void): void {
    const at = this.listeners.findIndex(([t, f]) => t === type && f === fn);
    if (at >= 0) this.listeners.splice(at, 1);
  }
}

/** 真机横屏那一组：舞台 80…382（border 4px，overflow:hidden），宿主顶沿 158，内容 314 高 */
function landscape() {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.borderBottom = "4px";
  stage.top = 80;
  stage.height = 382 - 80;

  const host = new FakeEl(view);
  host.parentElement = stage;
  host.top = 158;
  host.height = 314;
  host.scrollHeight = 314;
  return { host, stage, view };
}

describe("农场 · 裁切线取 padding box（和档B 另外四款同一把尺子）", () => {
  it("下边框那几像素照不进内容，不算可用地方", () => {
    expect(clipBottomPx(382, "4px")).toBe(378);
    expect(clipBottomPx(382, "0px")).toBe(382);
  });

  it("量不出边框宽度就当没有，绝不算成 NaN", () => {
    for (const bad of ["", "medium", "-4px", "auto"]) {
      expect(clipBottomPx(382, bad), `borderBottomWidth="${bad}"`).toBe(382);
    }
  });

  it("一层都不裁就是 Infinity——高屏上没有裁切线可掉", () => {
    expect(visibleRoomPx(158, [])).toBe(Number.POSITIVE_INFINITY);
    expect(visibleRoomPx(158, [378, 500])).toBe(220);
  });
});

describe("农场 · capPx：装得下就一个字节都不写", () => {
  it("横屏那一组算得出 220px 的钳位，钳完能滚 94px", () => {
    expect(capPx(220, 314)).toBe(220);
    expect(314 - 220).toBe(94);
  });

  it("装得下（含亚像素抖动那 1px）一律返回 null", () => {
    expect(capPx(220, 219)).toBeNull();
    expect(capPx(220, 220)).toBeNull();
    expect(capPx(220, 221)).toBeNull();
    expect(capPx(220, 222)).toBe(220);
  });

  it("量不到的（Infinity / 0 / 负 / NaN）一律不写", () => {
    expect(capPx(Number.POSITIVE_INFINITY, 999)).toBeNull();
    expect(capPx(0, 314)).toBeNull();
    expect(capPx(-10, 314)).toBeNull();
    expect(capPx(Number.NaN, 314)).toBeNull();
  });
});

describe("农场 · fitIntoStage：宿主自己钳，舞台不许再裁", () => {
  it("横屏上钳到 220px 并挂上滚动条", () => {
    const { host } = landscape();
    fitIntoStage(host.asEl());
    expect(host.style.maxHeight).toBe("220px");
    expect(host.style.overflowY).toBe("auto");
  });

  it("装得下的那几档一个字节都不写", () => {
    const { host } = landscape();
    host.height = 180;
    host.scrollHeight = 180;
    fitIntoStage(host.asEl());
    expect(host.style.maxHeight).toBe("");
    expect(host.style.overflowY).toBe("");
  });

  it("relayout() 量之前先摘掉上一次钳出来的高度，不然越量越小", () => {
    const { host } = landscape();
    const fit = fitIntoStage(host.asEl());
    expect(host.style.maxHeight).toBe("220px");
    // 换一道矮题：钳位得跟着松开，不能被上一次的 220 卡住
    host.height = 150;
    host.scrollHeight = 150;
    fit.relayout();
    expect(host.style.maxHeight).toBe("");
    expect(host.style.overflowY).toBe("");
  });

  it("转屏会重排，dispose() 之后不再留监听", () => {
    const { host, view } = landscape();
    const fit = fitIntoStage(host.asEl());
    expect(view.listeners.map(([t]) => t)).toContain("resize");
    fit.dispose();
    expect(view.listeners).toHaveLength(0);
  });

  it("量不了的环境（没有 defaultView / 没有 rect）不抛，静静地什么都不做", () => {
    const bare = { style: {} as Record<string, string> } as unknown as HTMLElement;
    expect(() => fitIntoStage(bare).relayout()).not.toThrow();
  });
});

describe("农场 · runner.ts 真的把答题壳装进了自己的宿主", () => {
  it("起了一层 .mtf-quizhost，答题壳挂在它里面而不是直接挂舞台", () => {
    expect(runnerSource).toContain('"mtf-quizhost"');
    // 两轮（正题 + 错题回顾）都得走宿主，漏一轮回顾轮就照旧被裁
    const calls = [...runnerSource.matchAll(/runRound\(\{\s*\n?\s*stage:\s*(\w+)/g)].map((m) => m[1]);
    expect(calls.length, "runRound 的调用点少了").toBe(2);
    for (const s of calls) expect(s, "这一轮还挂在裸舞台上").toBe("quizHost");
  });

  it("宿主装完就钳一次，换题 / 转屏都跟着重算", () => {
    expect(runnerSource).toContain("fitIntoStage(quizHost)");
    expect(runnerSource).toContain("fit.relayout()");
    expect(runnerSource).toContain("fit.dispose()");
  });

  it("回顾横幅留在宿主外面——孩子滑题面时那句话一直看得见", () => {
    expect(runnerSource).toContain("insertBefore(banner, quizHost)");
  });

  it("辅助层仍旧挂在整个舞台上：提示行、欢呼、点击捕获一个都没挪窝", () => {
    // attachFarmHelper 读的是 .qz-prompt / .qz-msg / .qz-wrap，宿主是舞台的后代，
    // 挂在舞台上照旧找得到；挪进宿主反而会漏掉横幅那一块。
    for (const m of runnerSource.matchAll(/attachFarmHelper\((\w+)/g)) {
      expect(m[1], "辅助层被挪进宿主了").toBe("stage");
    }
  });

  it("quiz99 一行不动：本款只加 mtf- 前缀的样式", () => {
    const css = runnerSource.slice(runnerSource.indexOf("export const MTF_CSS"));
    for (const m of css.matchAll(/^\.([a-z0-9-]+)/gm)) {
      expect(m[1].startsWith("mtf-"), `MTF_CSS 里出现了非本款前缀 .${m[1]}`).toBe(true);
    }
    expect(css).toContain(".mtf-quizhost");
  });
});
