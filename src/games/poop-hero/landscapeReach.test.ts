/**
 * 便便超人 · 横过来拿的时候六颗方向键一颗都点不着
 * （1.2 窗口5 · 第 3 轮 · 档C，**W5R3-C-03，严重**）。
 *
 * 真机复现（`npm run build` 产物 → `vite preview` → Chrome `--headless=new` + CDP，
 * 点击一律 `Input.dispatchTouchEvent`，命中只认 `document.elementFromPoint(键心)`）：
 *
 * | 视口 | `.ph-wrap` 可视段 | 整块玩法 | 写进去的 `max-height` | 方向键静止 | 真手指慢拖八趟之后 |
 * | --- | --- | --- | --- | --- | --- |
 * | 640×360 L117 | **190px** | 381px | **240px** | 0 / 6 | **0 / 6** |
 * | 844×390 L117 | **220px** | 381px | **240px** | 0 / 6 | **0 / 6** |
 * | 320×568 L117 | 330px | 392px | 330px | 6 / 6 | 6 / 6 |
 *
 * 第 3 轮 `W5R3-C-01` 那一修（画布收到底仍装不下就让 `.ph-wrap` 自己滚）方向是对的，
 * 竖屏五档也确实全好了；错在**它把 240px 当成了下限**：`Math.max(240, 可视段)`。
 * 横屏上可视段只有 190px，钳出来的滚动口却写了 240px——
 * **多出来的那 50px 连同排在最后的六颗方向键一起停在裁切线以下**。
 * 滚动口自己有一截在屏外，`scrollTop` 推到底也露不出来，慢拖八趟一颗都救不回来。
 *
 * 两件事一起做：
 *   ① 钳出来的高度**绝不许超过可视段**（下限只能比可视段矮）；
 *   ② 钳完顺手把手柄送进眼里——不然也只是「有得滚」，五六岁的孩子不会先把屏幕往上推。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MIN_HOT, WRAP_MIN_ROOM, scrollToShowPx, showPad, wrapRoomPx } from "./runtime";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("钳出来的滚动口绝不许高过可视段（W5R3-C-03）", () => {
  it("640×360 那一幕：可视段 190、整块 381 —— 钳到 190，不是 240", () => {
    expect(wrapRoomPx(381, 190), "钳成 240 就等于把口子的下半截钉在屏幕外面").toBe(190);
  });

  it("844×390 那一幕：可视段 220 —— 钳到 220", () => {
    expect(wrapRoomPx(381, 220)).toBe(220);
  });

  it("任何一档都不许钳出比可视段还高的口子（横屏区间逐档扫一遍）", () => {
    // 起点写死 44 而不是 WRAP_MIN_ROOM：下限自己变了这一条也得照样把 44–239 那一段扫到
    for (let room = 44; room <= 400; room += 1) {
      if (room < WRAP_MIN_ROOM) {
        expect(wrapRoomPx(600, room), `可视段 ${room} 比下限还矮，不该钳`).toBeNull();
        continue;
      }
      const clamp = wrapRoomPx(600, room);
      expect(clamp, `可视段 ${room} 上钳出了 ${clamp}`).not.toBeNull();
      expect(clamp!, `可视段 ${room} 上钳出了 ${clamp}`).toBeLessThanOrEqual(room);
    }
  });

  it("竖屏那几档一个像素都没变：320×568 仍旧钳到 332", () => {
    expect(wrapRoomPx(392, 332)).toBe(332);
    expect(wrapRoomPx(392, 330)).toBe(330);
  });

  it("装得下就一个字都不改，高屏上绝不凭空多出一个滚动容器", () => {
    expect(wrapRoomPx(392, 392)).toBeNull();
    expect(wrapRoomPx(392, 500)).toBeNull();
    expect(wrapRoomPx(393, 392)).toBeNull();
  });

  it("矮到连一颗键的中心点都塞不进去才真的不值得钳", () => {
    expect(wrapRoomPx(392, 40)).toBeNull();
    expect(wrapRoomPx(392, WRAP_MIN_ROOM - 1)).toBeNull();
    expect(wrapRoomPx(392, WRAP_MIN_ROOM)).toBe(WRAP_MIN_ROOM);
    // 下限本身得放得下一颗按得准的键
    expect(WRAP_MIN_ROOM).toBeGreaterThanOrEqual(MIN_HOT);
  });

  it("量不出来的一律不钳，绝不写出 NaN / 负数", () => {
    expect(wrapRoomPx(392, Number.NaN)).toBeNull();
    expect(wrapRoomPx(392, 0)).toBeNull();
    expect(wrapRoomPx(392, -10)).toBeNull();
    expect(wrapRoomPx(Number.NaN, 332)).toBeNull();
    expect(wrapRoomPx(0, 332)).toBeNull();
  });
});

describe("钳完顺手把手柄送进眼里 · scrollToShowPx", () => {
  it("滚最小的那一段：手柄下沿一进来就收手，画面尽量留在屏上", () => {
    // 手柄在内容里 257..381，滚动口 190 高 → 滚到 191 正好让下沿贴着口子下沿
    expect(scrollToShowPx(257, 381, 190, 191)).toBe(191);
  });

  it("这一段自己比滚动口还高就从上沿开始露，先看得见头", () => {
    expect(scrollToShowPx(100, 500, 190, 400)).toBe(100);
  });

  it("本来就在眼里就一格都不滚", () => {
    expect(scrollToShowPx(0, 120, 190, 191)).toBe(0);
  });

  it("不许滚过头，也不许滚成负的；量不出数就返回 0", () => {
    expect(scrollToShowPx(257, 381, 190, 60)).toBe(60);
    expect(scrollToShowPx(257, 381, 190, 0)).toBe(0);
    expect(scrollToShowPx(257, 381, 0, 191)).toBe(0);
    expect(scrollToShowPx(Number.NaN, 381, 190, 191)).toBe(0);
  });
});

// --- DOM 桩：只给这几条用例用 ---

class FakeRow {
  constructor(readonly top: number, readonly height: number) {}
  getBoundingClientRect(): { top: number; height: number } {
    return { top: this.top, height: this.height };
  }
}

class FakeWrap {
  scrollTop = 0;
  clientHeight = 190;
  scrollHeight = 381;
  top = 158;
  private readonly kids = new Map<string, FakeRow>();
  put(sel: string, row: FakeRow): void {
    this.kids.set(sel, row);
  }
  querySelector(sel: string): FakeRow | null {
    return this.kids.get(sel) ?? null;
  }
  getBoundingClientRect(): { top: number } {
    return { top: this.top };
  }
}

const as = (w: FakeWrap): HTMLElement => w as unknown as HTMLElement;

describe("showPad：横屏落地那一帧手柄就得在屏上", () => {
  it("640×360 那一幕：手柄排在最底下，滚一次就进眼里", () => {
    const wrap = new FakeWrap();
    // 屏上 y=415..539 = 内容里 257..381（宿主顶 158、scrollTop 0）
    wrap.put(".ph-pads", new FakeRow(415, 124));
    const moved = showPad(as(wrap));
    expect(moved).toBeGreaterThan(0);
    expect(wrap.scrollTop).toBe(moved);
    expect(381 - wrap.scrollTop, "滚完手柄下沿还在口子外面").toBeLessThanOrEqual(wrap.clientHeight);
  });

  it("手柄本来就在眼里就一格都不滚——别把手指底下的键挪走", () => {
    const wrap = new FakeWrap();
    wrap.put(".ph-pads", new FakeRow(200, 124));
    expect(showPad(as(wrap))).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });

  it("没得滚（高屏、没挂滚动条）就返回 0", () => {
    const wrap = new FakeWrap();
    wrap.scrollHeight = wrap.clientHeight;
    wrap.put(".ph-pads", new FakeRow(415, 124));
    expect(showPad(as(wrap))).toBe(0);
  });

  it("找不到手柄 / 裸节点都不抛", () => {
    expect(showPad(as(new FakeWrap()))).toBe(0);
    expect(showPad({} as HTMLElement)).toBe(0);
  });
});

describe("接线与样式", () => {
  it("index.ts 挂上滚动条那一路真的叫了 showPad，而且排在写 overflow 之后", () => {
    const fit = SRC.slice(SRC.indexOf("function fitCanvas()"), SRC.indexOf("fitCanvas();\n"));
    expect(fit).toContain("showPad(wrap)");
    expect(fit.indexOf('wrap.style.overflowY = "auto"')).toBeLessThan(fit.indexOf("showPad(wrap)"));
    // 上一轮那两步一步都不许退回去
    expect(fit).toContain("canvasRoomPx(");
    expect(fit).toContain("wrapRoomPx(");
  });

  it("横过来拿的时候键盘说明行也该藏起来——那一档最挤，白占 18px", () => {
    expect(SRC).toContain("@media (hover:none) and (max-height:480px){ .ph-pad-name{display:none;} }");
    // 原来那条按宽度的仍在，竖屏窄机一个字没变
    expect(SRC).toContain("@media (hover:none) and (max-width:420px){ .ph-pad-name{display:none;} }");
  });

  it("一个像素都没往热区上要：键仍旧不小于 44", () => {
    expect(SRC).toContain("min-width:${HUD_BTN_MIN_W}px;min-height:${HUD_BTN_MIN_H}px;");
    expect(MIN_HOT).toBe(44);
  });
});
