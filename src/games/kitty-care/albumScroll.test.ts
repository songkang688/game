/**
 * 萌猫小屋 · 小屋相册翻得动（窗口5 第2轮 档C · W5R2-C-03 阻断）。
 *
 * 测试员量到：`📷 小屋相册` 里 24 件收藏一共 **2809px 高**，`.game-stage` 只给
 * 530–730px，裁掉 2183–2383px，而 `.ktc-album` 是 `overflow:visible / max-height:none`、
 * **一个可滚祖先都没有**——真手指往上甩三次 `scrollTop` 一格没动。
 * 24 颗 `⭐N 换回来` 里 **20（390×844）/ 22（360×640）颗点不着**，
 * 够得着的只有最上面那 2–4 件。星星兑换是相册唯一的主动玩法，等于这一半玩不了。
 *
 * 改法：给**卡片那一格**（`.ktc-grid`）量一次舞台可视高，钳成 `max-height` 并挂上
 * 自己的 `overflow-y:auto`。只钳这一格是有讲究的——上面的「◀ 回选关」、四个摆放位置、
 * 说明行钉着不动，翻的只有卡片；要是钳整块 `.ktc-album`，一滚下去连退路都看不见了。
 *
 * 这一份不复用 `fitIntoStage()`：那一份是「先收猫、收不下才滚」，为的是让**闯关**不用滚
 * （拖食物的手指一动就连带滚屏）；相册本来就该翻着看，两种诉求不该合成一个函数。
 */
import { describe, expect, it } from "vitest";

import { LIST_MIN_ROOM, scrollIntoStage, visibleRoomPx } from "./runtime";
import { KTC_CSS } from "./styles";

function ruleOf(selector: string): string {
  const at = KTC_CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = KTC_CSS.indexOf("{", at) + 1;
  return KTC_CSS.slice(from, KTC_CSS.indexOf("}", from)).replace(/\s+/g, "");
}

/** 一块能被 scrollIntoStage 量的假清单 */
function fakeList(opts: { top: number; clipBottom: number | null; content: number }) {
  const style: Record<string, string> = { maxHeight: "", overflowY: "" };
  const listeners = new Map<string, Array<() => void>>();
  const view = {
    getComputedStyle: () => ({ overflowY: "hidden" }),
    addEventListener(type: string, fn: () => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    }
  };
  return {
    style,
    ownerDocument: { defaultView: view },
    parentElement:
      opts.clipBottom === null
        ? null
        : { parentElement: null, getBoundingClientRect: () => ({ bottom: opts.clipBottom }) },
    getBoundingClientRect: () => ({ top: opts.top }),
    scrollHeight: opts.content,
    resizeListeners: () => (listeners.get("resize") ?? []).length
  };
}

const fitIt = (el: unknown) => scrollIntoStage(el as unknown as HTMLElement);

describe("萌猫小屋 · 相册那一格自己挂滚动条（W5R2-C-03）", () => {
  it("真机那两组数字：装不下就钳成可视高并挂 overflow-y:auto", () => {
    // 360×640：卡片格顶边 405，舞台裁切线 622，内容 2592
    const low = fakeList({ top: 405, clipBottom: 622, content: 2592 });
    fitIt(low);
    expect(low.style.maxHeight, "钳成裁切线以内那一段").toBe("217px");
    expect(low.style.overflowY, "光钳不挂滚动条等于把后 22 件直接删掉").toBe("auto");

    // 390×844：同一块内容，舞台高一点，仍旧装不下
    const tall = fakeList({ top: 405, clipBottom: 822, content: 2592 });
    fitIt(tall);
    expect(tall.style.maxHeight).toBe("417px");
    expect(tall.style.overflowY).toBe("auto");
  });

  it("装得下就一个字都不写，高屏上不许凭空多出一个滚动容器", () => {
    const roomy = fakeList({ top: 100, clipBottom: 900, content: 400 });
    fitIt(roomy);
    expect(roomy.style.maxHeight).toBe("");
    expect(roomy.style.overflowY).toBe("");
  });

  it("量不到裁切线（没有裁切祖先）就不管", () => {
    const free = fakeList({ top: 100, clipBottom: null, content: 4000 });
    fitIt(free);
    expect(free.style.maxHeight).toBe("");
    expect(visibleRoomPx(100, [])).toBe(Number.POSITIVE_INFINITY);
  });

  /**
   * 这一条原先钉的是「可视段矮于 160px 就别钳」，而那条早退恰恰是 W5R3-C-04 的病灶本身：
   * 横屏 640×360 上 `.ktc-grid` 的可视段只有 130px，于是一格都没钳，
   * 2809px 的卡片墙压在一个 `overflow:visible` 的盒子里，24 颗兑换钮 0/24 够得着。
   * 收官轮据实改判：矮到连一颗兑换钮的中心点都塞不进去（44px）才真的不值得钳。
   */
  it("矮到连一颗兑换钮都塞不下才不许钳；130px 那一档照样得钳（W5R3-C-04 据实改判）", () => {
    const squashed = fakeList({ top: 600, clipBottom: 622, content: 2592 });
    fitIt(squashed);
    expect(squashed.style.maxHeight, "只剩 22px，钳了也是一条缝").toBe("");
    // 兑换钮自己就是 44px 热区，滚动口至少得放得下它的中心点
    expect(LIST_MIN_ROOM).toBeGreaterThanOrEqual(44);
    // 横屏那一档：130px 一次只看得见半张卡片，但翻得到全部——比一颗都点不着强
    const landscape = fakeList({ top: 219, clipBottom: 349, content: 1724 });
    fitIt(landscape);
    expect(landscape.style.maxHeight).toBe("130px");
    expect(landscape.style.overflowY).toBe("auto");
  });

  it("重排会先还原再量，不然越量越小", () => {
    const el = fakeList({ top: 405, clipBottom: 622, content: 2592 });
    const fit = fitIt(el);
    fit.relayout();
    fit.relayout();
    expect(el.style.maxHeight, "反复 relayout 得稳在同一个数").toBe("217px");
  });

  it("dispose 之后监听拆干净、样式还回去", () => {
    const el = fakeList({ top: 405, clipBottom: 622, content: 2592 });
    const fit = fitIt(el);
    expect(el.resizeListeners()).toBe(1);
    fit.dispose();
    expect(el.resizeListeners()).toBe(0);
    expect(el.style.maxHeight).toBe("");
    expect(el.style.overflowY).toBe("");
  });

  it("CSS 这一头也得配合：手指竖划归卡片格，别把整页也带着走", () => {
    const rule = ruleOf(".ktc-grid");
    expect(rule, "翻到底之后不许把外面那层也带着滚").toContain("overscroll-behavior:contain");
    expect(rule, "竖划得落到这一格身上").toContain("touch-action:pan-y");
    // 卡片本身一分没缩，兑换钮仍是 44px 热区
    expect(ruleOf(".ktc-mini")).toContain("min-height:44px");
  });
});
