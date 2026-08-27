/**
 * 红蓝点点 · 横过来拿的时候点还得按得着
 * （1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`W5R2-FB-04` 阻断）。
 *
 * `W5R2-LB-03` 与 `1b13a26` 把**竖屏**三档收干净了：本轮 CDP 连采 14 轮 × 逐颗
 * `elementFromPoint`，360×640 / 320×640 / 390×844 一共 67 颗点 **0 漏**。
 * 可把手机横过来，同一把尺子量出来是这样：
 *
 * ```
 * 视口       竞技场          舞台裁切线   14 轮里够不着的点
 * 844×390   243…459（216）   378         10/10
 * 740×360   243…459（216）   348         11/11
 * 640×360   243…459（216）   348          6/11
 * ```
 *
 * 这一款**故意不给滚动条**（连点游戏，能滚就会「想点却滚走了」，
 * `fitArena()` 的注释里写着），所以够不着就是真的够不着——整局作废。
 *
 * 两处都得改：
 *
 * ① `arenaHeightPx()` 守着 `ARENA_MIN_PX = 216` 的下限（「低于它三行点摆不开」）。
 *    这条策略在竖屏上是对的，横屏上却是**宁可让它掉出屏幕也要 216**：
 *    可视段只有 105…135px，硬撑 216 等于把下面一半点摆到裁切线外面。
 *    摆得小一点还能玩，摆到屏幕外面就没得玩了——退到「装得下就行」，
 *    底线改成**装得下一整颗点**。
 *
 * ② `placeDot()` 把 `top` 写成 `6% + random × 72%`，这两个数是按
 *    「场地 300px 上下」定的。场地一收到 105px，78% 就是 82px，
 *    再加 72px 的点整颗探出场外 22px（真机量到 `worstBelowArena` 最大 +24px），
 *    而 `.rbt-arena{overflow:hidden}` 会把它裁掉半颗。
 *    改成按真实像素倒推百分比：整颗点（含热区）必须留在场内。
 *
 * 热区一分没动：点仍旧 72px。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ARENA_FLOOR_PX,
  ARENA_MIN_PX,
  DOT_EDGE_PX,
  DOT_PX,
  arenaBoxPx,
  arenaHeightPx,
  dotBandPct,
  fitArena,
} from "./index";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}index.ts`, "utf8");

class FakeView {
  readonly listeners: Array<() => void> = [];
  getComputedStyle(el: FakeEl): { overflowY: string; borderBottomWidth: string } {
    return { overflowY: el.overflowY, borderBottomWidth: el.borderBottom };
  }
  addEventListener(_t: string, fn: () => void): void {
    this.listeners.push(fn);
  }
  removeEventListener(_t: string, fn: () => void): void {
    const i = this.listeners.indexOf(fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }
}

class FakeEl {
  readonly style: Record<string, string> = { height: "" };
  parentElement: FakeEl | null = null;
  nextElementSibling: FakeEl | null = null;
  overflowY = "visible";
  borderBottom = "0px";
  top = 0;
  cssHeight = 0;
  /** 跟着别人的下沿走（那一行提示排在竞技场后面） */
  follows: FakeEl | null = null;
  constructor(readonly view: FakeView) {}
  get ownerDocument(): { defaultView: FakeView } {
    return { defaultView: this.view };
  }
  get height(): number {
    const h = Number.parseFloat(this.style.height);
    return Number.isFinite(h) && this.style.height ? h : this.cssHeight;
  }
  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    const top = this.follows ? this.follows.getBoundingClientRect().bottom : this.top;
    return { top, bottom: top + this.height, height: this.height };
  }
  asEl(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

/**
 * 真机横屏那一组：舞台 80…382（border 4px → 裁切线 378），
 * `.rbt-wrap` 包着竞技场，竞技场 `arenaTop` 起、CSS 给 `cssHeight`，
 * 后面紧跟着一行 `.rbt-msg`（高 `belowPx`，跟着竞技场的下沿走）。
 */
function landscape(clipBottom: number, arenaTop: number, cssHeight: number, belowPx: number) {
  const view = new FakeView();
  const stage = new FakeEl(view);
  stage.overflowY = "hidden";
  stage.borderBottom = "4px";
  stage.top = 80;
  stage.cssHeight = clipBottom + 4 - 80;

  const wrap = new FakeEl(view);
  wrap.parentElement = stage;
  wrap.top = arenaTop - 35;

  const arena = new FakeEl(view);
  arena.parentElement = wrap;
  arena.top = arenaTop;
  arena.cssHeight = cssHeight;

  const msg = new FakeEl(view);
  msg.parentElement = wrap;
  msg.follows = arena;
  msg.cssHeight = belowPx;
  arena.nextElementSibling = msg;
  return { view, stage, wrap, arena, msg };
}

describe("红蓝点点 · arenaBoxPx：装不下 216 就别硬撑（W5R2-FB-04）", () => {
  it("竖屏那几档一个字没变——三行点的策略原样保留", () => {
    expect(arenaBoxPx(320, 500)).toBe(320);
    expect(arenaBoxPx(280, 280)).toBe(280);
    expect(arenaBoxPx(320, 240.9)).toBe(240);
    expect(arenaBoxPx(320, 240.9)).toBe(arenaHeightPx(320, 240.9));
  });

  it("横屏那三档退到「装得下就行」，不再硬撑 216 把点摆到屏幕外", () => {
    // 844×390：可视段 135 → 场地 135（原来是 216，超出 81px）
    expect(arenaHeightPx(320, 135)).toBe(ARENA_MIN_PX);
    expect(arenaBoxPx(320, 135)).toBe(135);
    // 640×360：可视段 105 → 场地 105（原来是 216，超出 111px）
    expect(arenaBoxPx(320, 105)).toBe(105);
  });

  it("底线是装得下一整颗点——再挤也不许摆出一个塞不下点的场地", () => {
    expect(ARENA_FLOOR_PX).toBe(DOT_PX + DOT_EDGE_PX * 2);
    expect(ARENA_FLOOR_PX).toBe(80);
    expect(arenaBoxPx(320, 40)).toBe(ARENA_FLOOR_PX);
    expect(arenaBoxPx(320, 1)).toBe(ARENA_FLOOR_PX);
    // 底线比原来的 216 低,但仍旧摆得下整颗 72px 的点(热区一分没动)
    expect(ARENA_FLOOR_PX).toBeLessThan(ARENA_MIN_PX);
    expect(ARENA_FLOOR_PX).toBeGreaterThanOrEqual(DOT_PX);
  });

  it("量不到可视高度就原样返回，不瞎收", () => {
    expect(arenaBoxPx(320, Number.POSITIVE_INFINITY)).toBe(320);
    expect(arenaBoxPx(320, Number.NaN)).toBe(320);
    expect(arenaBoxPx(320, 0)).toBe(320);
    expect(arenaBoxPx(320, -40)).toBe(320);
  });
});

describe("红蓝点点 · dotBandPct：整颗点必须留在场内", () => {
  it("300px 上下的场地和原来那对魔法数字几乎一样", () => {
    const b = dotBandPct(320);
    // 原来写死的是 6% + random × 72%
    expect(b.min).toBeCloseTo(1.25, 2);
    expect(b.span).toBeCloseTo(75, 2);
    // 最低的那一颗:下沿正好卡在场地里
    expect((b.min + b.span) / 100 * 320 + DOT_PX).toBeLessThanOrEqual(320);
  });

  it("矮场地上收得住——这正是原来探出场外那 24px", () => {
    for (const box of [135, 105, 90, 80]) {
      const b = dotBandPct(box);
      const lowest = ((b.min + b.span) / 100) * box + DOT_PX;
      expect(lowest, `${box}px 的场地上最低那颗探出去了`).toBeLessThanOrEqual(box);
      expect(b.min, `${box}px 的场地上最高那颗探到场外了`).toBeGreaterThanOrEqual(0);
    }
    // 反例：老算法在 105px 的场地上确实探出去
    expect((6 + 72) / 100 * 105 + DOT_PX).toBeGreaterThan(105);
  });

  it("场地比一颗点还矮就贴边摆，至少整颗在场内", () => {
    const b = dotBandPct(DOT_PX);
    expect(b.span).toBe(0);
    expect(b.min).toBe(0);
  });

  it("量不到场地（还没挂上 DOM / 测试桩）就退回原来那对数字，不摆到左上角去", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(dotBandPct(bad), `boxPx=${bad}`).toEqual({ min: 6, span: 72 });
    }
  });
});

describe("红蓝点点 · fitArena 把竞技场连同下面那行提示一起装进裁切线", () => {
  it("844×390：可视段 135、下面那行占 44 → 场地收到 91", () => {
    const { arena } = landscape(378, 243, 216, 44);
    fitArena(arena.asEl());
    expect(arena.style.height).toBe("91px");
    expect(arena.getBoundingClientRect().bottom + 44).toBeLessThanOrEqual(378);
  });

  it("反例：不给下面那行留地方的话，提示整行掉在裁切线以下——这条用例不是空转", () => {
    const { arena } = landscape(378, 243, 216, 44);
    expect(arena.getBoundingClientRect().bottom + 44).toBeGreaterThan(378);
  });

  it("640×360：留完提示只剩 61，退到装得下一整颗点的底线 80", () => {
    const { arena } = landscape(348, 243, 216, 44);
    fitArena(arena.asEl());
    expect(arena.style.height).toBe(`${ARENA_FLOOR_PX}px`);
  });

  it("屏够高就一个字都不写，竞技场保持 CSS 给的高度", () => {
    const { arena } = landscape(826, 358, 280, 44);
    fitArena(arena.asEl());
    expect(arena.style.height).toBe("");
  });

  it("转屏会重排，拆监听之后不再留", () => {
    const { arena, view } = landscape(378, 243, 216, 44);
    const off = fitArena(arena.asEl());
    expect(view.listeners).toHaveLength(1);
    off();
    expect(view.listeners).toHaveLength(0);
  });
});

describe("红蓝点点 · index.ts 真的接上了这两手", () => {
  it("摆点时按真实场地算区间，不再用写死的 6 / 72", () => {
    const at = source.indexOf("function placeDot(");
    expect(at, "placeDot 不见了").toBeGreaterThan(0);
    const body = source.slice(at, source.indexOf("\n}", at));
    expect(body).not.toMatch(/6 \+ Math\.random\(\) \* 72/);
    expect(body).toContain("band.");
  });

  it("每摆一颗都按当下的场地量一次——转屏之后场地就不是原来那个了", () => {
    const at = source.indexOf("function makeDot(");
    const body = source.slice(at, source.indexOf("\n  }", at));
    expect(body).toContain("arenaBand(arenaEl)");
  });

  it("fitArena 走的是 arenaBoxPx，不是只认 216 下限的 arenaHeightPx", () => {
    const at = source.indexOf("export function fitArena(");
    const body = source.slice(at, source.indexOf("\n}", at));
    expect(body).toContain("arenaBoxPx(");
    expect(body).toContain("belowPx(");
  });

  it("热区一分没动：点仍旧 72px", () => {
    expect(DOT_PX).toBe(72);
    expect(source).toContain(".rbt-arena .rbt-dot { width: 72px; height: 72px;");
    expect(DOT_PX).toBeGreaterThanOrEqual(44);
  });
});
