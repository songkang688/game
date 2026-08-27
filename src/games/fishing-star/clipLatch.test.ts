/**
 * 钓鱼小达人 · 裁切线认下了就不许再「忘掉」
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，W5-B-08 的第二处残留）。
 *
 * 学习优化员的 `W5R2-LB-01/02` 把水桶行改成浮层、把水面改成按可视高算，
 * 同档另一条 `312b6ae` 又补上「高度一变就当帧重排」。可我在 320×640 与 360×640 上
 * 连做 6 轮「上鱼 → 再抛竿」，逐帧问 `document.elementFromPoint(抛竿键中心)`，
 * 仍旧抓到成片的坏帧（360×640 共 56 帧 / 320×640 共 80 帧）。逐帧回放是这样的：
 *
 * ```
 * t=9317  show  sea 180  chrome 224  wrapH 404  键心 600  舞台下沿 626  ✅
 * t=9737  aim   sea 230  chrome 209  wrapH 439  键心 638  舞台下沿 626  ❌ 出界 12px
 * t=10051 aim   sea 194  chrome 209  wrapH 403  键心 599  舞台下沿 626  ✅（周期性重排把它拉回来，晚了 314ms）
 * ```
 *
 * 注意水面是**长回去**的：180 → 230。230 正是 `layout()` 拿 `innerHeight` 猜出来的那个
 * 没钳过的值。也就是说这一次 `layout()` 根本没找到裁切线——`stageRoomPx()` 返回了
 * `Infinity`，钳位整条被跳过，水面一口气弹回去 50px，把唯一的操作键顶出舞台 12px。
 *
 * 根子在 `isRealClipper()` 的判据 `|scrollHeight − clientHeight| > 1` 上。
 * `.game-stage` 是**定高**的：内容比它高时 `scrollHeight` 才大于 `clientHeight`；
 * 一旦我把水面收到刚好装得下，浏览器就把 `scrollHeight` 夹回 `clientHeight`
 * （定高盒子的 `scrollHeight` 恒 ≥ `clientHeight`），两者相等，
 * 于是「它到底裁不裁人」这个问题当场回答成「不裁」——**可它明明还是那条边界**。
 * 结果就是：收 → 装得下 → 判它不裁 → 不钳了 → 弹回去 → 又装不下 → 再收…
 * 每弹一次，孩子就有一个重排周期按不着「🎣 按住抛竿」。
 *
 * 修法不是把 `isRealClipper` 放宽（放宽就会把 `.l99-stage-wrap` 那种
 * 「高度被内容撑出来、下沿跟着我自己走」的缩包盒也认成裁切线，那是 `W5R2-LB-02`
 * 踩过的另一个坑，会变成自己追自己的死循环）。修法是**认下就记住**：
 * 一条边界只要被看见真的裁过一次，之后哪怕内容暂时装得下，它也仍然是边界。
 * 缩包盒永远满足 `scrollHeight === clientHeight`，所以一次都不会被记住。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createClipWatch, isRealClipper, seaHeightPx, staysClipLine } from "./fit";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");

// ---------------------------------------------------------------------------
// 够用的假节点：定高盒子照浏览器的规矩，scrollHeight 恒 ≥ clientHeight
// ---------------------------------------------------------------------------

class FakeEl {
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  top = 0;
  height = 0;
  scrollHeight = 0;
  clientHeight = 0;

  constructor(readonly name: string) {}

  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    return { top: this.top, bottom: this.top + this.height, height: this.height };
  }

  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

const view = {
  getComputedStyle: (el: Element) => ({ overflowY: (el as unknown as FakeEl).overflowY }),
};

/**
 * 复刻真机 320×640 第 40 关那条祖先链（数字全部来自本轮 CDP 逐帧回放）：
 * `.game-stage` 定高 530、下沿 626 → `.l99-stage-wrap` 缩包 → `.fs-wrap`。
 *
 * `contentH` 是舞台里这一整套界面有多高。定高盒子的 `scrollHeight`
 * 恒 ≥ `clientHeight`，所以内容装得下时两者相等——这正是把裁切线弄丢的那一刻。
 */
function makeChain(contentH: number) {
  const stageTop = 96;
  const stage = new FakeEl(".game-stage");
  stage.overflowY = "hidden";
  stage.top = stageTop;
  stage.height = 530;
  stage.clientHeight = 530;
  stage.scrollHeight = Math.max(stage.clientHeight, contentH);

  const l99wrap = new FakeEl(".l99-stage-wrap");
  l99wrap.overflowY = "hidden";
  l99wrap.parentElement = stage;
  l99wrap.top = stageTop;
  // 缩包：内容有多高它就有多高，下沿跟着我自己走
  l99wrap.height = contentH;
  l99wrap.clientHeight = contentH;
  l99wrap.scrollHeight = contentH;

  const wrap = new FakeEl(".fs-wrap");
  wrap.parentElement = l99wrap;
  wrap.top = 218;
  wrap.height = contentH - (218 - stageTop);
  wrap.clientHeight = wrap.height;
  wrap.scrollHeight = wrap.height;

  return { stage, l99wrap, wrap };
}

/** 舞台下沿 626 − `.fs-wrap` 顶沿 218 */
const REAL_ROOM = 626 - 218;

describe("钓场 · staysClipLine：认下的边界不会因为「这一刻装得下」就消失", () => {
  it("装不下的时候本来就认得出来", () => {
    const fits = { scrollHeight: 575, clientHeight: 530 };
    expect(isRealClipper(fits)).toBe(true);
    expect(staysClipLine(false, fits)).toBe(true);
  });

  it("装得下之后 isRealClipper 会翻脸说「不裁」——这就是弄丢裁切线的那一步", () => {
    const snug = { scrollHeight: 530, clientHeight: 530 };
    expect(isRealClipper(snug)).toBe(false);
  });

  it("但只要认下过一次，它就一直是边界", () => {
    const snug = { scrollHeight: 530, clientHeight: 530 };
    expect(staysClipLine(true, snug)).toBe(true);
  });

  it("没认下过、这一刻也不裁的，仍旧不算数（缩包盒走的就是这条）", () => {
    expect(staysClipLine(false, { scrollHeight: 404, clientHeight: 404 })).toBe(false);
  });
});

describe("钓场 · createClipWatch：真机 320×640 那三帧的复现", () => {
  it("装不下的那一帧量得出可视高 408", () => {
    const watch = createClipWatch();
    const { wrap } = makeChain(575);
    expect(watch.roomPx(wrap.asEl(), view)).toBe(REAL_ROOM);
    expect(watch.latched).toBe(1);
  });

  it("收到刚好装得下之后，可视高还是 408，不许变回 Infinity", () => {
    const watch = createClipWatch();
    const over = makeChain(575);
    expect(watch.roomPx(over.wrap.asEl(), view)).toBe(REAL_ROOM);
    // 水面收完，这一整套正好塞进定高的舞台里：scrollHeight 被夹回 clientHeight
    const snug = makeChain(526);
    snug.stage.top = over.stage.top;
    snug.wrap.parentElement!.parentElement = over.stage;
    expect(over.stage.scrollHeight).toBe(575);
    expect(watch.roomPx(snug.wrap.asEl(), view)).toBe(REAL_ROOM);
  });

  it("缩包的 .l99-stage-wrap 一次都不会被认下（认下就是自己追自己的死循环）", () => {
    const watch = createClipWatch();
    const { wrap, l99wrap } = makeChain(575);
    watch.roomPx(wrap.asEl(), view);
    expect(isRealClipper(l99wrap)).toBe(false);
    // 认下的只有舞台那一条
    expect(watch.latched).toBe(1);
  });

  it("一层都不裁的高屏仍旧返回 Infinity——不该钳的别钳", () => {
    const watch = createClipWatch();
    const { wrap, stage } = makeChain(400);
    stage.height = 700;
    stage.clientHeight = 700;
    stage.scrollHeight = 700;
    expect(watch.roomPx(wrap.asEl(), view)).toBe(Number.POSITIVE_INFINITY);
    expect(watch.latched).toBe(0);
  });
});

describe("钓场 · 弄丢裁切线之后水面弹回去多少（真机那一组）", () => {
  /** `layout()` 拿 `innerHeight` 猜出来的水面：640 × 0.36 = 230.4 → 230 */
  const GUESS = 230;
  const CHROME = 209;

  it("认得出裁切线时水面 195，键心留在舞台里", () => {
    const sea = seaHeightPx(GUESS, REAL_ROOM, CHROME);
    expect(sea).toBe(REAL_ROOM - CHROME - 4);
    expect(sea).toBe(195);
    expect(sea + CHROME).toBeLessThanOrEqual(REAL_ROOM);
  });

  it("弄丢裁切线（room=Infinity）水面就弹回 230，整屏超出 31px", () => {
    const sea = seaHeightPx(GUESS, Number.POSITIVE_INFINITY, CHROME);
    expect(sea).toBe(GUESS);
    expect(sea + CHROME - REAL_ROOM).toBe(31);
  });

  it("超出 31px、按钮 44px 高——键心正好掉到舞台下沿以下，真机量到 12px", () => {
    // 键是这一屏最后一行：超出 31px 时它的中心比下沿低 31 − 44/2 ≈ 9…12px
    const over = GUESS + CHROME - REAL_ROOM;
    expect(over - 44 / 2).toBeGreaterThan(0);
  });
});

describe("钓场 · 主循环真的换成了会记事的那把尺子", () => {
  it("index.ts 用 createClipWatch()，不再直接调无状态的 stageRoomPx()", () => {
    expect(shell).toContain("createClipWatch(");
    const at = shell.indexOf("function wantedSize(");
    expect(at, "wantedSize() 不见了，这条断言得跟着改").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("clipWatch.roomPx(");
    expect(body).not.toContain("stageRoomPx(");
  });

  it("重排收敛到不动为止：一趟收完 chrome 也可能跟着变，得再量一次", () => {
    const at = shell.indexOf("function refitNow(");
    expect(at, "refitNow() 不见了").toBeGreaterThan(0);
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("layout();");
    expect(body).toMatch(/for \(|while \(/);
  });

  it("frame() 的两条路（周期性兜底 / 高度一变）都走收敛版", () => {
    const at = shell.indexOf("function frame(");
    const body = shell.slice(at, shell.indexOf("\n  }", at));
    expect(body).toContain("refitNow();");
    expect(body).toContain("needsImmediateRefit(");
    expect(body).toContain("if (sinceFit >= REFIT_MS)");
  });

  it("还是不给这一屏挂滚动条：按住蓄力的玩法能滚就会「想按却滑走了」", () => {
    const fitSource = readFileSync(`${dir}fit.ts`, "utf8");
    expect(fitSource).not.toContain("overflowY =");
    expect(fitSource).not.toContain("maxHeight =");
  });
});
