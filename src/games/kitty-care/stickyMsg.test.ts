/**
 * 萌猫小屋 · 挂了滚动条之后，提示行得跟着屏幕走
 * （窗口5 第2轮 档C 监督修复员 · W5R2-FC-06）。
 *
 * 搓澡关（第 141 关这一档）在矮屏上是**真的装不下**，不是量错了：
 * 搓澡池 `.ktc-wash` 写着 `min-height:240px`（再小画不了圈），
 * 上面还压着计分条 62 + 心情条 22 + 气泡 38 + 猫 120——猫已经被
 * `CAT_FIT_STEPS` 收到最小的 92px 了。360×640 上一屏只有 404px，内容 589px。
 * 所以 `fitIntoStage()` 走到最后一步：挂滚动条。
 *
 * 挂完之后 CDP 实测：`.ktc-msg`「用手指画圈搓，把 90% 的泡泡都搓开～」
 * 在 360×720 / 360×640 / 320×640 上**初始 0 像素可见**，滚到底才露全
 * （`visAfter` 23 / 23 / 45）。可这一行正是「这一关要干什么」——
 * 孩子进关先看到的是一池泡泡，没有任何东西告诉他要画圈搓。
 *
 * 不自动滚：搓澡是按住画圈的玩法，替玩家滚屏会把手指底下的池子挪走。
 * 改成把提示行**粘在滚动口的下沿**：滚到哪儿它都在，池子一格不动。
 * 只在真挂了滚动条时才粘（`ktc-scroll`），高屏上一个像素都不改。
 */
import { describe, expect, it } from "vitest";

import { fitIntoStage } from "./runtime";
import { KTC_CSS } from "./styles";

interface Rect {
  top: number;
  bottom: number;
}

/** 一个够 `fitIntoStage()` 用的最小盒子：高度写死，收猫收不动 */
function makeWrap(scrollHeight: number, roomBottom: number) {
  const classes = new Set<string>();
  const style: Record<string, string> = {};
  const props = new Map<string, string>();
  const stage = {
    parentElement: null as unknown,
    getBoundingClientRect: (): Rect => ({ top: 92, bottom: roomBottom }),
    __style: { overflowY: "hidden", borderBottomWidth: "4px" }
  };
  const view = {
    getComputedStyle: (p: { __style: unknown }) => p.__style,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const wrap = {
    parentElement: stage,
    ownerDocument: { defaultView: view },
    getBoundingClientRect: (): Rect => ({ top: 218, bottom: 218 + scrollHeight }),
    get scrollHeight(): number {
      return scrollHeight;
    },
    classList: {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c)
    },
    style: {
      ...style,
      maxHeight: "",
      overflowY: "",
      minHeight: "",
      setProperty: (k: string, v: string) => props.set(k, v),
      removeProperty: (k: string) => props.delete(k)
    }
  };
  return { wrap, classes };
}

describe("萌猫小屋 · 挂滚动条时提示行粘在下沿（W5R2-FC-06）", () => {
  it("真挂了滚动条才打 ktc-scroll 这个记号", () => {
    // 一屏 404（626 − 4 边框 − 218），内容 589：收猫收不动，只能滚
    const { wrap, classes } = makeWrap(589, 626);
    const fit = fitIntoStage(wrap as unknown as HTMLElement);
    expect(wrap.style.overflowY).toBe("auto");
    expect(classes.has("ktc-scroll"), "挂了滚动条却没打记号，提示行粘不住").toBe(true);
    fit.dispose();
    expect(classes.has("ktc-scroll"), "拆的时候没摘干净").toBe(false);
  });

  it("装得下就不打记号——高屏上不许平白粘一行字", () => {
    const { wrap, classes } = makeWrap(300, 826);
    fitIntoStage(wrap as unknown as HTMLElement);
    expect(wrap.style.overflowY).toBe("");
    expect(classes.has("ktc-scroll")).toBe(false);
  });

  it("样式里那一条粘的规则只认 ktc-scroll", () => {
    expect(KTC_CSS).toContain(".ktc-wrap.ktc-scroll .ktc-msg");
    const rule = KTC_CSS.slice(KTC_CSS.indexOf(".ktc-wrap.ktc-scroll .ktc-msg"));
    const body = rule.slice(0, rule.indexOf("}") + 1);
    expect(body).toContain("position:sticky");
    expect(body).toContain("bottom:0");
    // 粘住之后底下的泡泡会透上来，得有个不透明的底
    expect(body).toMatch(/background:/);
  });
});
