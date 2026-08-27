/**
 * 钓鱼小达人 · 上鱼那一刻这一屏就得重排，不能等下一个 REFIT_MS
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5-B-08 的残留）。
 *
 * 学习优化员把水桶那一行改成浮层（`W5R2-LB-01`）之后，「钓上鱼 → 整屏长高」这条路
 * 确实被切断了一半：`.fss-show` 现在 `position:absolute`，对高度的贡献是 0。
 * 但它复量的四档视口是 390×844 / 360×720 / 360×640 / **320×568**——
 * 把测试员用的 **320×640** 换掉了。我在 320×640 上连做 6 轮「上鱼 → 再抛竿」，
 * 第 4 轮当场复现：
 *
 * ```
 * aim   sea 221  chrome 182  wrapH 403  按钮中心 y=599  裁切线 626  命中 ✅
 * 上鱼  sea 219  chrome 224  wrapH 443  按钮中心 y=642  裁切线 626  命中 ❌ null
 * +120  同上（还是 null）
 * +400  sea 180  chrome 224  wrapH 404  按钮中心 y=600  命中 ✅
 * ```
 *
 * 长高的不只是提示行（18→33px），HUD 那排小药丸在 320px 宽上也多折一行，
 * `chrome` 一共涨了 **42px**。而这一屏的排版每 `REFIT_MS`（300ms）才重量一次，
 * 于是「上鱼之后的头 300ms 里，唯一的操作键掉在裁切线以下、`elementFromPoint`
 * 返回 `null`、`.fs-wrap` 只能滚 3px 等于滚不动」。
 *
 * 关键在于**重量一次就救得回来**：`seaHeightPx(221, 408, 224) = 180`，
 * 底边正好落回裁切线以内。缺的不是算法，是「什么时候算」。
 * 所以这一份钉的是：**这一屏的高度一变，就在当帧重排，别等下一个 REFIT_MS。**
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIT_SLACK_PX, needsImmediateRefit, overshootPx, seaHeightPx } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");

/** 真机 320×640 第 40 关第 4 轮量到的那一组数（见文件头） */
const REAL = { room: 408, seaAtAim: 221, chromeAtAim: 182, chromeAfterCatch: 224, wrapTop: 218, stageBottom: 626 };

describe("钓场 · overshootPx：底边到底掉出去多少", () => {
  it("上鱼那一刻不重排就是掉出去的（真机那一组：219 + 224 − 408 = 35px）", () => {
    expect(overshootPx(REAL.seaAtAim - 2, REAL.chromeAfterCatch, REAL.room)).toBe(35);
    expect(overshootPx(REAL.seaAtAim - 2, REAL.chromeAfterCatch, REAL.room)).toBeGreaterThan(0);
  });

  it("重量一次就落回裁切线以内——缺的不是算法，是「什么时候算」", () => {
    const sea = seaHeightPx(REAL.seaAtAim, REAL.room, REAL.chromeAfterCatch);
    expect(sea).toBe(REAL.room - REAL.chromeAfterCatch - FIT_SLACK_PX);
    expect(sea).toBe(180);
    expect(overshootPx(sea, REAL.chromeAfterCatch, REAL.room)).toBeLessThanOrEqual(0);
  });

  it("上鱼之前本来就是够的（不是这一屏一直都超，是上鱼那一下才超）", () => {
    expect(overshootPx(REAL.seaAtAim, REAL.chromeAtAim, REAL.room)).toBeLessThanOrEqual(0);
  });

  it("没有裁切祖先（room=Infinity）时永远不算掉出去", () => {
    expect(overshootPx(354, 232, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("按钮 44px 高时，掉出去 23px 以上中心就出线——这正是 320×640 上量到的", () => {
    // 中心出线 = 掉出去的量 > 按钮的一半；真机那一组掉 35px、按钮 44px
    const over = overshootPx(REAL.seaAtAim - 2, REAL.chromeAfterCatch, REAL.room);
    expect(over).toBeGreaterThan(44 / 2);
  });
});

describe("钓场 · needsImmediateRefit：高度一变就当帧重排", () => {
  it("上鱼那一下 403 → 443，要重排", () => {
    expect(needsImmediateRefit(403, 443)).toBe(true);
  });

  it("回到 aim 又缩回去，同样要重排（不然水面回不来）", () => {
    expect(needsImmediateRefit(443, 404)).toBe(true);
  });

  it("没变就不重排——每帧都重排等于每帧强制回流", () => {
    expect(needsImmediateRefit(403, 403)).toBe(false);
  });

  it("亚像素抖动（≤1px）不算变，免得因为一个小数点每帧都重排", () => {
    expect(needsImmediateRefit(403, 403.4)).toBe(false);
    expect(needsImmediateRefit(403, 404.4)).toBe(true);
  });

  it("第一帧（上一次是 0）要量一次", () => {
    expect(needsImmediateRefit(0, 403)).toBe(true);
  });

  it("量不出来的时候（NaN / 0）不硬来", () => {
    expect(needsImmediateRefit(403, Number.NaN)).toBe(false);
    expect(needsImmediateRefit(403, 0)).toBe(false);
  });
});

describe("钓场 · 主循环真的接上了这一条", () => {
  it("frame() 里量这一屏的高度，变了就当帧 layout()", () => {
    const at = shell.indexOf("function frame(");
    expect(at, "frame() 不见了，这条断言得跟着改").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("needsImmediateRefit(");
    expect(body).toContain("layout();");
  });

  it("重排之后要再画一次——layout() 会重设画布尺寸，等于把画面擦了", () => {
    const at = shell.indexOf("needsImmediateRefit(");
    expect(at).toBeGreaterThan(0);
    const after = shell.slice(at, at + 400);
    expect(after.indexOf("layout();")).toBeLessThan(after.indexOf("render();"));
  });

  it("REFIT_MS 那条周期性兜底还在（转屏 / 字体加载不改文字也会变高）", () => {
    expect(shell).toContain("if (sinceFit >= REFIT_MS)");
  });

  it("还是不给这一屏挂滚动条：按住蓄力的玩法能滚就会「想按却滑走了」", () => {
    const fitSource = readFileSync(`${dir}fit.ts`, "utf8");
    expect(fitSource).not.toContain("overflowY =");
    expect(fitSource).not.toContain("maxHeight =");
  });
});
