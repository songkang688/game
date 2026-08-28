/**
 * 萌猫小屋 · 相册那一格连 44px 都挤不出来时，退一步让整块相册板自己滚
 * （窗口5 第3轮 档C 监督修复员 · `W5R3-CF-01` 严重）。
 *
 * `W5R3-C-04` 那一修把 `LIST_MIN_ROOM` 从 160 改判成 44，横屏 640×360 / 844×390
 * 上确实修好了（真机复算：兑换钮逐档滚动累计 24/24）。可它只是把那道悬崖从 160
 * 挪到了 44，**没有把悬崖填掉**：把手机横过来拿得再矮一点（568×320，也就是把
 * 320×568 那台机器转 90°），舞台看得见 170px，而卡片格上面还压着
 * 「◀ 回选关」+ 四个摆放位置 + 一行说明——`.ktc-grid` 自己的可视段只剩 40 来 px，
 * `< 44` 于是这条早退照旧生效：
 *
 *   相册兑换钮 568×320：落地 0/24，真手指慢拖 30 趟逐档累计 **0/24**，
 *   `.ktc-grid` `max-height:none / overflow:visible`、**一个可滚祖先都没有**，
 *   `.game-stage` 下**裁死的有字叶子 93 个**（24 张卡片的名字 / 说明 / 兑换钮全在里面）。
 *
 * 星星兑换是相册唯一的主动玩法，一颗都点不着＝这一屏白摆，与 `W5R2-C-03`
 * 当初记成阻断的是同一件事，只是换了一档视口。
 *
 * 修法仍旧小而准，收官轮不动玩法：卡片格自己挤不出 44px 时**往外退一层**，
 * 把整块 `.ktc-album` 钳进可视段并挂上滚动条——退路（「◀ 回选关」）跟着一起滚，
 * 但「翻得到全部」比「退路永远钉在眼前、卡片一张都够不着」值钱。
 * 卡片格自己有地方的时候行为**一个字节不变**（`who === "list"`，只钳那一格）。
 */
import { describe, expect, it } from "vitest";

import { LIST_MIN_ROOM, listOrShellRoom, scrollIntoStage } from "./runtime";
import { KTC_CSS } from "./styles";

function ruleOf(selector: string): string {
  const at = KTC_CSS.indexOf(`\n${selector}{`);
  expect(at, `CSS 里没有 ${selector} 这条规则`).toBeGreaterThanOrEqual(0);
  const from = KTC_CSS.indexOf("{", at) + 1;
  return KTC_CSS.slice(from, KTC_CSS.indexOf("}", from)).replace(/\s+/g, "");
}

/** 一块能被 scrollIntoStage 量的假节点（`clipBottom` 就是那条裁切线） */
function fakeBox(opts: { top: number; clipBottom: number | null; content: number }) {
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

const fit = (list: unknown, shell?: unknown) =>
  scrollIntoStage(list as unknown as HTMLElement, LIST_MIN_ROOM, (shell ?? null) as HTMLElement | null);

describe("相册板兜底：卡片格挤不出 44px 就退一层（W5R3-CF-01）", () => {
  describe("listOrShellRoom 这把尺子", () => {
    it("卡片格自己有地方就只认卡片格——高屏行为一个字节不变", () => {
      expect(listOrShellRoom(217, 300)).toEqual({ who: "list", room: 217 });
      expect(listOrShellRoom(44, 300)).toEqual({ who: "list", room: 44 });
    });

    it("真机 568×320 那一幕：卡片格只剩 40px，整块相册板还有 162px —— 退一层", () => {
      expect(listOrShellRoom(40, 162)).toEqual({ who: "shell", room: 162 });
    });

    it("两层都矮到放不下一颗兑换钮的中心点，那就真的别钳（钳了也是一条缝）", () => {
      expect(listOrShellRoom(22, 30)).toEqual({ who: "none", room: 0 });
    });

    it("量不到裁切线（高屏 / 没有裁切祖先）一律不管，绝不凭空多出滚动容器", () => {
      expect(listOrShellRoom(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY).who).toBe("none");
      expect(listOrShellRoom(Number.NaN, Number.NaN).who).toBe("none");
      // 没传外层壳时 shellRoom 是 NaN，行为必须和改判前一模一样
      expect(listOrShellRoom(20, Number.NaN).who).toBe("none");
    });

    it("小数一律往下取整——写进 max-height 的数绝不许比可视段大", () => {
      expect(listOrShellRoom(30, 159.8).room).toBe(159);
      expect(listOrShellRoom(217.9, 400).room).toBe(217);
    });
  });

  describe("scrollIntoStage 接上这一层之后", () => {
    it("568×320 那一幕：卡片格一格没钳，改钳整块相册板并挂上滚动条", () => {
      // 真机量到：舞台裁切线 308，卡片格顶边 268（自己只剩 40px），相册板顶边 146
      const grid = fakeBox({ top: 268, clipBottom: 308, content: 1724 });
      const album = fakeBox({ top: 146, clipBottom: 308, content: 1886 });
      fit(grid, album);
      expect(grid.style.maxHeight, "卡片格自己挤不出 44px，不该由它来滚").toBe("");
      expect(album.style.maxHeight, "整块相册板得钳进可视段，不然 24 颗兑换钮一颗都点不着").toBe("162px");
      expect(album.style.overflowY, "光钳不挂滚动条等于把后面 22 件直接删掉").toBe("auto");
    });

    it("640×360 / 844×390 那两档照旧只钳卡片格，退路仍旧钉在眼前", () => {
      const grid = fakeBox({ top: 219, clipBottom: 349, content: 1724 });
      const album = fakeBox({ top: 90, clipBottom: 349, content: 1886 });
      fit(grid, album);
      expect(grid.style.maxHeight).toBe("130px");
      expect(grid.style.overflowY).toBe("auto");
      expect(album.style.maxHeight, "卡片格自己够得着的时候，外层壳一个字都不许写").toBe("");
      expect(album.style.overflowY).toBe("");
    });

    it("两层都装得下就谁都不写（高屏 390×844）", () => {
      const grid = fakeBox({ top: 200, clipBottom: 900, content: 400 });
      const album = fakeBox({ top: 90, clipBottom: 900, content: 520 });
      fit(grid, album);
      expect(grid.style.maxHeight).toBe("");
      expect(album.style.maxHeight).toBe("");
    });

    it("退一层之后，内容本来就不比可视段高的话照样不写（别凭空多出滚动条）", () => {
      const grid = fakeBox({ top: 268, clipBottom: 308, content: 30 });
      const album = fakeBox({ top: 146, clipBottom: 308, content: 150 });
      fit(grid, album);
      expect(album.style.maxHeight).toBe("");
      expect(album.style.overflowY).toBe("");
    });

    it("重排先还原两层再量，不然转一次屏就越量越小", () => {
      const grid = fakeBox({ top: 268, clipBottom: 308, content: 1724 });
      const album = fakeBox({ top: 146, clipBottom: 308, content: 1886 });
      const handle = fit(grid, album);
      handle.relayout();
      handle.relayout();
      expect(album.style.maxHeight, "反复 relayout 得稳在同一个数").toBe("162px");
      expect(grid.style.maxHeight).toBe("");
    });

    it("dispose 之后两层的样式都还回去，监听也拆干净", () => {
      const grid = fakeBox({ top: 268, clipBottom: 308, content: 1724 });
      const album = fakeBox({ top: 146, clipBottom: 308, content: 1886 });
      const handle = fit(grid, album);
      expect(grid.resizeListeners()).toBe(1);
      handle.dispose();
      expect(grid.resizeListeners()).toBe(0);
      expect(album.style.maxHeight).toBe("");
      expect(album.style.overflowY).toBe("");
    });

    it("不传外层壳时行为与改判前一模一样（既有调用方一个字节不受影响）", () => {
      const grid = fakeBox({ top: 268, clipBottom: 308, content: 1724 });
      scrollIntoStage(grid as unknown as HTMLElement);
      expect(grid.style.maxHeight).toBe("");
      const roomy = fakeBox({ top: 405, clipBottom: 622, content: 2592 });
      scrollIntoStage(roomy as unknown as HTMLElement);
      expect(roomy.style.maxHeight).toBe("217px");
    });
  });

  describe("接线与样式", () => {
    it("相册那一处真的把整块板子传进去了，不然这一档兜底永远不会触发", async () => {
      const src = await import("node:fs").then((fs) =>
        fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8"));
      expect(src, "scrollIntoStage 还是只传了卡片格").toContain("scrollIntoStage(grid, LIST_MIN_ROOM, wrap)");
    });

    it("相册板一旦变成滚动口，手指竖划得归它，翻到底也不许把外面那层带着走", () => {
      const rule = ruleOf(".ktc-album");
      expect(rule).toContain("overscroll-behavior:contain");
      expect(rule).toContain("touch-action:pan-y");
    });

    it("这一修一分热区都没缩：兑换钮仍是 44px", () => {
      expect(ruleOf(".ktc-mini")).toContain("min-height:44px");
      expect(LIST_MIN_ROOM).toBeGreaterThanOrEqual(44);
    });
  });

  it("动物福利红线：这一修一格没踩，生产代码零 ctx.lose / 零 onLose", async () => {
    const fs = await import("node:fs");
    const dir = new URL("./", import.meta.url);
    const hits: string[] = [];
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const text = fs.readFileSync(new URL(name, dir), "utf8");
      if (/ctx\.lose|onLose/.test(text)) hits.push(name);
    }
    expect(hits, "萌猫小屋永远不判负，失败只鼓励").toEqual([]);
  });
});
