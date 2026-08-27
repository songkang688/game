/**
 * 钓鱼小达人 · 钳完之后把「唯一那颗操作键」送到孩子眼前
 * （1.2 窗口5 · 第 3 轮 · 档B 学习优化员，`W5R3-BT-01` 严重 / `W5R3-BT-02` 一般）。
 *
 * `W5R2-FB-01` 那四手把「滚不动」修好了——横屏三档 `.fs-wrap` 现在真挂得上滚动条、
 * 真手指也真推得动（测试员 B3.1：十一格 11/11 划得进来）。缺的是**最后一步**。
 *
 * 我自己在真机上复量到的落地那一帧（CDP，`elementFromPoint` 定案，不认 `el.click()`）：
 *
 * ```
 * 640×360 / 740×360 L12/63/117   .fs-act 428.3–472.3（高 44）
 *                                .fs-wrap 可视段下沿 344，maxHeight 186px，能滚 128
 *                                elementFromPoint(键心) = null      ← 键整颗在口子外面
 * 844×390 L12/63/117             同上，wrap 下沿 374，能滚 98，命中 null
 * 320×568 上鱼那一下（show 相位） .fs-act 531.6–575.6，wrap 下沿 546，能滚 30
 *                                被裁 29.6px，命中拿回 .game-stage  ← W5R3-BT-02
 * ```
 *
 * 两条是同一件事的两面：**滚得动 ≠ 落地就在眼前**。
 * 落地的 `scrollTop` 是 0，而这颗键排在这一屏最后一行；
 * 第一屏上没有任何「下面还有东西」的提示，孩子横过来看到的是水面和一条张力条，
 * **不会想到要先把屏幕往上推**。而这是这一款唯一的操作键，看不见就等于开不了局。
 *
 * 修法照搬本窗口另外几份壳层收紧器的最后一步（`poop-hero` 的 `showPad`、
 * `shape-kingdom` 的 `showBoard`、`kitty-care` 的 `showPlayRow`）：
 * **钳完顺手把键滚进可视段，滚最小的那一段**。
 *
 * 三条自我约束，下面每一条都有用例钉着：
 *  1. **键已经整颗在可视段里就一个字节都不写**——不许每帧把孩子的滚动位置抢回来；
 *  2. 只在**布局事件**上滚（钳位值变了 / 换相位 / 转屏），不在普通帧里滚；
 *  3. `.game-stage{overflow:hidden}` 与 44px 热区一个字节不动。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scrollToShowPx, showAct } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");
const fitSource = readFileSync(`${dir}fit.ts`, "utf8");

/** 一个够用的假盒子：只提供 `showAct()` 真的会去问的那几样 */
function fakeWrap(opts: {
  top: number;
  client: number;
  content: number;
  scrollTop?: number;
  actTop: number;
  actH?: number;
}): { wrap: HTMLElement; act: HTMLElement } {
  const actH = opts.actH ?? 44;
  const state = { scrollTop: opts.scrollTop ?? 0 };
  const wrap = {
    getBoundingClientRect: () => ({ top: opts.top, height: opts.client }),
    clientHeight: opts.client,
    scrollHeight: opts.content,
    get scrollTop(): number {
      return state.scrollTop;
    },
    set scrollTop(v: number) {
      state.scrollTop = Math.max(0, Math.min(opts.content - opts.client, v));
    },
  } as unknown as HTMLElement;
  const act = {
    // 键在**屏幕坐标**里的位置 = 内容坐标 − 当前滚动量 + 盒子顶沿
    getBoundingClientRect: () => ({
      top: opts.top + opts.actTop - state.scrollTop,
      height: actH,
    }),
  } as unknown as HTMLElement;
  return { wrap, act };
}

describe("钓场 · scrollToShowPx：滚最小的那一段，够得着就一格不动", () => {
  it("键掉在口子下面：滚到它的下沿刚好贴住可视段下沿（640×360 那一幕）", () => {
    // 真机：wrap 顶 158、可视段 186、内容 314；键在内容坐标 270…314
    expect(scrollToShowPx(270, 314, 186, 128, 0)).toBe(128);
  });

  it("844×390 那一幕：能滚 98，滚到 98 键就整颗进来了", () => {
    expect(scrollToShowPx(216, 260, 216, 98, 0)).toBe(44);
  });

  it("320×568 上鱼那一幕：只差 30px，滚 30 就够（W5R3-BT-02）", () => {
    // wrap 可视段 326、内容 356；键在内容坐标 312…356
    expect(scrollToShowPx(312, 356, 326, 30, 0)).toBe(30);
  });

  it("**键已经整颗在可视段里就一格都不动**——不许把孩子的滚动位置抢回来", () => {
    // 可视段 186、已经滚到 128，键在 270…314 → 屏幕上 142…186，整颗在里面
    expect(scrollToShowPx(270, 314, 186, 128, 128)).toBe(128);
    // 滚到中间某处、键仍旧整颗看得见：原样返回
    expect(scrollToShowPx(100, 144, 186, 128, 20)).toBe(20);
  });

  it("孩子往下滚过头（键跑到口子上面去了）就往回滚到刚好露全", () => {
    expect(scrollToShowPx(20, 64, 186, 128, 40)).toBe(20);
  });

  it("键比口子还高就从它的上沿开始露——露上半截总比一点都不露强", () => {
    expect(scrollToShowPx(100, 300, 120, 300, 0)).toBe(100);
  });

  it("没得滚 / 量不出来的一律原样返回，绝不写一个假值", () => {
    expect(scrollToShowPx(270, 314, 186, 0, 0)).toBe(0);
    expect(scrollToShowPx(270, 314, 0, 128, 7)).toBe(7);
    expect(scrollToShowPx(Number.NaN, 314, 186, 128, 7)).toBe(7);
    expect(scrollToShowPx(270, Number.NaN, 186, 128, 7)).toBe(7);
  });

  it("算出来的位置永远夹在 [0, max] 里", () => {
    expect(scrollToShowPx(-500, -456, 186, 128, 0)).toBe(0);
    expect(scrollToShowPx(9000, 9044, 186, 128, 0)).toBe(128);
  });
});

describe("钓场 · showAct：真的把键送进可视段（横屏三档 + 上鱼那一下）", () => {
  it("640×360 落地那一帧：滚 128，键从口子外面回到里面", () => {
    const { wrap, act } = fakeWrap({ top: 158, client: 186, content: 314, actTop: 270 });
    expect(showAct(wrap, act)).toBe(128);
    expect(wrap.scrollTop).toBe(128);
    // 送进来之后键的下沿正好贴住可视段下沿（158 + 186 = 344）
    expect(act.getBoundingClientRect().top + 44).toBe(344);
  });

  it("844×390 落地那一帧：能滚 98，滚到 44 就够，不多滚一格", () => {
    const { wrap, act } = fakeWrap({ top: 158, client: 216, content: 314, actTop: 216 });
    expect(showAct(wrap, act)).toBe(44);
  });

  it("320×568 上鱼那一下：滚 30，「👀 看看它」整颗回来（W5R3-BT-02）", () => {
    const { wrap, act } = fakeWrap({ top: 220, client: 326, content: 356, actTop: 312 });
    expect(showAct(wrap, act)).toBe(30);
    expect(act.getBoundingClientRect().top + 44).toBe(220 + 326);
  });

  it("竖屏那几档本来就装得下（没得滚）——一个字节都不写", () => {
    const { wrap, act } = fakeWrap({ top: 220, client: 326, content: 326, actTop: 282 });
    expect(showAct(wrap, act)).toBe(0);
    expect(wrap.scrollTop).toBe(0);
  });

  it("键已经在眼前就不抢孩子的滚动位置（这一条是「不许每帧拽回来」的守门）", () => {
    const { wrap, act } = fakeWrap({ top: 158, client: 186, content: 314, scrollTop: 128, actTop: 270 });
    expect(showAct(wrap, act)).toBe(128);
    expect(wrap.scrollTop).toBe(128);
  });

  it("量不出来的（没有 rect / 没有键）安静返回，不抛错", () => {
    const { wrap } = fakeWrap({ top: 158, client: 186, content: 314, actTop: 270 });
    expect(showAct(wrap, null)).toBe(0);
    expect(showAct({} as unknown as HTMLElement, {} as unknown as HTMLElement)).toBe(0);
  });
});

describe("钓场 · index.ts 真的接上了最后这一步", () => {
  it("capWrap() 会告诉调用方「钳位值变没变」——布局事件才是滚的时机", () => {
    const at = shell.indexOf("function capWrap(");
    expect(at, "capWrap() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body, "capWrap() 还是 void，调用方没法知道这一帧钳位换了没有").toContain("boolean");
  });

  it("refitNow() 在钳位值变了的那一帧把键送进眼里，而且排在还原 scrollTop 之后", () => {
    const at = shell.indexOf("function refitNow(");
    expect(at, "refitNow() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("sendActIntoView()");
    expect(
      body.indexOf("sendActIntoView("),
      "先滚过去再把旧位置还回来，等于白滚"
    ).toBeGreaterThan(body.lastIndexOf("wrap.scrollTop = keepScroll"));
  });

  it("换相位那一下也送一次——上鱼那一帧这一屏会长高（W5R3-BT-02）", () => {
    const at = shell.indexOf("function frame(");
    expect(at, "frame() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }\n  raf =", at));
    expect(body).toContain("sendActIntoView()");
    expect(body, "得先记住上一帧是什么相位，不然换相位这一下认不出来").toContain("lastActPhase");
  });

  it("转屏之后也送一次：横过来拿是这一条最要紧的入口", () => {
    const at = shell.indexOf("const onResize = (");
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("sendActIntoView()");
  });

  it("**内容长高也算一次布局事件**：上鱼那一屏不是一帧长完的（W5R3-BT-02）", () => {
    const frame = shell.slice(shell.indexOf("function frame("), shell.indexOf("\n  }\n  raf ="));
    expect(
      frame,
      "钳过之后 wrap 自己的高度被 maxHeight 焊死，只有 scrollHeight 说得出「还在长」"
    ).toContain("wrap.scrollHeight");
    expect(frame).toContain("lastContentH");
    // 高度没变的普通帧一格都不许动
    const guard = /if \(phase !== lastActPhase \|\| needsImmediateRefit\(lastContentH, nowContentH\)\)/;
    expect(guard.test(frame), "普通帧也在滚 = 每帧把孩子的滚动位置抢回来").toBe(true);
  });

  it("**不在渲染函数里滚**：refreshHud() 每帧都跑，滚在那里等于每帧把孩子拽回来", () => {
    const hud = shell.slice(shell.indexOf("function refreshHud("), shell.indexOf("function say("));
    expect(hud).not.toContain("showAct(");
    expect(hud).not.toContain("sendActIntoView(");
  });

  it("fit.ts 仍旧只算数 + 只碰滚动位置，不写任何人的样式", () => {
    expect(fitSource).toContain("export function scrollToShowPx(");
    expect(fitSource).toContain("export function showAct(");
    expect(fitSource).not.toContain("overflowY =");
    expect(fitSource).not.toContain("maxHeight =");
  });

  it("热区一分没动：大按钮仍旧 64px，`.game-stage` 一个字节没碰", () => {
    expect(shell).toContain(".fss-act{min-height:64px");
    expect(shell).not.toContain(".game-stage{");
    for (const m of shell.matchAll(/min-height:(\d+)px/g)) {
      const n = Number(m[1]);
      expect(n === 64 || n >= 44 || n < 30, `出现了 ${n}px 的 min-height`).toBe(true);
    }
  });
});
