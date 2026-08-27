/**
 * 钓鱼小达人 · 上鱼之后还抛得了竿吗（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 这一份钉三件事，每一件都对着测试员第 2 轮量出来的一条：
 *
 *  1. **W5-B-08（阻断）**：钓上第一条鱼之后，`.fss-show`「水桶」那一行显形，
 *     占掉 48–73px 的**常规文档流**高度，把「🎣 按住抛竿」顶出 `.game-stage`
 *     （定高 + `overflow:hidden`，平台文件，交窗口1）。四档视口 × 三关 12 组全中，
 *     每关要 4–6 条鱼，实际永远卡在 1 条。修法是让水桶那一行**浮在水面上**，
 *     彻底退出常规流——钓第几条鱼都不会再改变这一屏的高度。
 *  2. **本档侧的可视高**：水面高度改成量真实可视高再倒推，不再拿 `innerHeight` 猜。
 *     这里最要紧的一条是 `isRealClipper`：舞台这条链上 `.l99-stage-wrap` 也写着
 *     `overflow:hidden`，但它的高度是**内容撑出来的**——把它当裁切线会变成
 *     「我收一点它就矮一点」的死循环，真机上量到的就是水面被收到下限附近。
 *  3. **W5-B-09（严重）**：地图上「🎯 跳到当前关」留下的 `scrollTop` 不许带进关内。
 *
 * 仓库的 vitest 跑在 node 环境、没有 jsdom，所以纯几何一律直接喂数字，
 * 需要 DOM 的地方用本文件自带的假节点（只实现 `fitIntoStage` 那几样能力）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FIT_SLACK_PX,
  MIN_SEA_PX,
  clipperBottoms,
  isRealClipper,
  resetClippedScroll,
  seaHeightPx,
  visibleRoomPx,
} from "./fit";
import { REFIT_MS, TOUCH_MIN_PX } from "./index";

const dir = fileURLToPath(new URL(".", import.meta.url));
const shell = readFileSync(`${dir}index.ts`, "utf8");
const css = shell.slice(shell.indexOf("const CSS = `"), shell.indexOf("\n`;\n"));

/** 把样式里的模板占位符换成真值，规则体才切得干净（`${TOUCH_MIN_PX}` 自带一个 `}`） */
const cssResolved = css.split("${TOUCH_MIN_PX}").join(String(TOUCH_MIN_PX));

/** 取一条 CSS 规则的规则体（`.类名{...}`） */
function rule(name: string): string {
  const at = cssResolved.indexOf(`${name}{`);
  expect(at, `样式里没有 ${name}`).toBeGreaterThan(-1);
  return cssResolved.slice(at, cssResolved.indexOf("}", at));
}

/** 这条规则的 min-height 是不是写成了共用常量，而不是又抄一个数字 */
function usesTouchConst(name: string): boolean {
  const at = css.indexOf(`${name}{`);
  return css.slice(at, at + 400).includes("min-height:${TOUCH_MIN_PX}px");
}

// ---------------------------------------------------------------------------
// 只够 clipperBottoms / resetClippedScroll 用的假节点
// ---------------------------------------------------------------------------

class FakeEl {
  parentElement: FakeEl | null = null;
  overflowY = "visible";
  top = 0;
  height = 0;
  scrollHeight = 0;
  clientHeight = 0;
  scrollTop = 0;
  scrollLeft = 0;

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
 * 复刻真机上那条祖先链（数字来自本轮 CDP 实测，390×844 第 40 关）：
 * `.game-stage`（定高 738、`overflow:hidden`、下沿 830）→
 * `.l99-stage-wrap`（`overflow:hidden`，**高度是内容撑出来的**，下沿跟着我走）→
 * `.l99-stage`（visible）→ `.fs-wrap`。
 */
function makeChain(opts: { wrapTop: number; wrapHeight: number; stageBottom: number; stageTop?: number }) {
  const stageTop = opts.stageTop ?? 92;
  const stage = new FakeEl(".game-stage");
  stage.overflowY = "hidden";
  stage.top = stageTop;
  stage.height = opts.stageBottom - stageTop;
  stage.clientHeight = stage.height;
  // 舞台里装的是整套 l99 界面：内容下沿 = 我的下沿 + 10
  stage.scrollHeight = opts.wrapTop + opts.wrapHeight + 10 - stageTop;

  const l99wrap = new FakeEl(".l99-stage-wrap");
  l99wrap.overflowY = "hidden";
  l99wrap.parentElement = stage;
  l99wrap.top = stageTop + 4;
  l99wrap.height = opts.wrapTop + opts.wrapHeight + 10 - l99wrap.top;
  // 缩包：内容有多高它就有多高
  l99wrap.clientHeight = l99wrap.height;
  l99wrap.scrollHeight = l99wrap.height;

  const l99 = new FakeEl(".l99-stage");
  l99.parentElement = l99wrap;
  l99.top = opts.wrapTop - 10;
  l99.height = opts.wrapHeight + 20;

  const wrap = new FakeEl(".fs-wrap");
  wrap.parentElement = l99;
  wrap.top = opts.wrapTop;
  wrap.height = opts.wrapHeight;

  return { stage, l99wrap, l99, wrap };
}

// ---------------------------------------------------------------------------

describe("钓场 · visibleRoomPx", () => {
  it("多层都在裁就听最靠上的那一层——只要有一层裁，再往下就看不见了", () => {
    expect(visibleRoomPx(222, [830, 900])).toBe(608);
    expect(visibleRoomPx(222, [900, 830])).toBe(608);
  });

  it("一层都不裁就返回 Infinity，表示这一屏压根不用收", () => {
    expect(visibleRoomPx(222, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it("自己已经整个在裁切线以下时算出来是负数，调用方据此放弃收缩", () => {
    expect(visibleRoomPx(900, [830])).toBe(-70);
  });
});

describe("钓场 · isRealClipper：缩包的祖先不算裁切线", () => {
  it("高度被内容撑出来的（scrollHeight === clientHeight）不算——它的下沿跟着我自己走", () => {
    expect(isRealClipper({ scrollHeight: 554, clientHeight: 554 })).toBe(false);
  });

  it("正在裁东西的算（clientHeight < scrollHeight）", () => {
    expect(isRealClipper({ scrollHeight: 700, clientHeight: 538 })).toBe(true);
  });

  it("比内容高的也算——正是这一档告诉我们「还能长多高」", () => {
    expect(isRealClipper({ scrollHeight: 554, clientHeight: 738 })).toBe(true);
  });

  it("差 1px 之内当缩包处理，免得因为一个小数点来回抖", () => {
    expect(isRealClipper({ scrollHeight: 554, clientHeight: 554.6 })).toBe(false);
  });

  it("没有布局能力的节点（用例桩、还没进文档）一律不算", () => {
    expect(isRealClipper({})).toBe(false);
  });
});

describe("钓场 · clipperBottoms 把缩包的那一层挑出去", () => {
  it("真机那条链上只认 .game-stage，不认 .l99-stage-wrap", () => {
    const { wrap, stage } = makeChain({ wrapTop: 222, wrapHeight: 418, stageBottom: 830 });
    expect(clipperBottoms(wrap.asEl(), view)).toEqual([stage.top + stage.height]);
    expect(visibleRoomPx(222, clipperBottoms(wrap.asEl(), view))).toBe(608);
  });

  it("**先红后绿的红**：把缩包那一层也算进来，量出来的可视高会跟着自己走", () => {
    const { wrap, l99wrap } = makeChain({ wrapTop: 222, wrapHeight: 418, stageBottom: 830 });
    // 老口径 = 只看 overflow，不看是不是缩包
    const naive = [l99wrap.top + l99wrap.height, 830];
    expect(visibleRoomPx(222, naive)).toBe(428);
    // 428 比真值 608 少 180px：水面就是这样被一路收到下限的
    expect(visibleRoomPx(222, naive)).toBeLessThan(visibleRoomPx(222, clipperBottoms(wrap.asEl(), view)));
  });

  it("overflow 是 visible 的祖先一个都不算", () => {
    const { wrap, l99 } = makeChain({ wrapTop: 222, wrapHeight: 418, stageBottom: 830 });
    l99.clientHeight = 100;
    l99.scrollHeight = 900;
    expect(clipperBottoms(wrap.asEl(), view)).toEqual([830]);
  });
});

describe("钓场 · seaHeightPx", () => {
  it("装得下就按原来的比例来，一个像素都不收", () => {
    expect(seaHeightPx(354, 608, 232)).toBe(354);
  });

  it("装不下就收到刚好够（留 FIT_SLACK_PX 的余量）", () => {
    // 360×640 实测：可视 407、水面以外占 182 → 水面 221
    expect(seaHeightPx(230, 407, 182)).toBe(407 - 182 - FIT_SLACK_PX);
    expect(seaHeightPx(230, 407, 182)).toBe(221);
  });

  it("再挤也不把水面压没：收到 MIN_SEA_PX 就不再往下", () => {
    expect(seaHeightPx(354, 300, 280)).toBe(MIN_SEA_PX);
    expect(MIN_SEA_PX).toBeGreaterThanOrEqual(120);
  });

  it("没有裁切祖先（room=Infinity）时原样返回，高屏上不会凭空变矮", () => {
    expect(seaHeightPx(354, Number.POSITIVE_INFINITY, 232)).toBe(354);
  });

  it("自己已经整个在裁切线以下（room ≤ 0）时也原样返回，不写出负数", () => {
    expect(seaHeightPx(354, -70, 232)).toBe(354);
  });
});

describe("钓场 · resetClippedScroll 把 🎯 留下的位移还回去（W5-B-09）", () => {
  it("自己和祖先上还滚着的位移一律归 0", () => {
    const { wrap, stage } = makeChain({ wrapTop: 222, wrapHeight: 418, stageBottom: 830 });
    stage.scrollTop = 102;
    expect(resetClippedScroll(wrap.asEl())).toBe(1);
    expect(stage.scrollTop).toBe(0);
  });

  it("横向的位移一样还回去", () => {
    const { wrap, stage } = makeChain({ wrapTop: 222, wrapHeight: 418, stageBottom: 830 });
    stage.scrollTop = 60;
    stage.scrollLeft = 24;
    expect(resetClippedScroll(wrap.asEl())).toBe(2);
    expect(stage.scrollLeft).toBe(0);
  });

  it("本来就是 0 的一个都不碰（返回 0，说明没有多余的写）", () => {
    const { wrap } = makeChain({ wrapTop: 222, wrapHeight: 418, stageBottom: 830 });
    expect(resetClippedScroll(wrap.asEl())).toBe(0);
  });

  it("没有节点 / 没有布局能力的桩都不抛", () => {
    expect(resetClippedScroll(null)).toBe(0);
    expect(resetClippedScroll({ parentElement: null } as unknown as HTMLElement)).toBe(0);
  });
});

describe("钓场 · 水桶那一行浮在水面上，不占常规流高度（W5-B-08）", () => {
  it("`.fss-show` 是绝对定位的浮层，贴着水面下边", () => {
    const show = rule(".fss-show");
    expect(show).toContain("position:absolute");
    expect(show).toContain("bottom:6px");
    // 浮层就不该再自己撑宽度：max-width 那条老写法必须去掉
    expect(show).not.toContain("max-width:620px");
  });

  it("水面盒子是它的定位参照（不写这一句浮层会跑到整屏左上角）", () => {
    expect(rule(".fs-sea")).toContain("position:relative");
  });

  it("它挂在水面盒子里，而不是挂在 .fs-wrap 上——挂错地方就还是会把这一屏顶高", () => {
    expect(shell).toContain("seaBox.appendChild(showRow)");
    const append = shell.slice(shell.indexOf("wrap.append(hud"), shell.indexOf("wrap.append(hud") + 120);
    expect(append, "showRow 又回到常规流里了").not.toContain("showRow");
    expect(append).toContain("actBtn");
  });

  it("水面盒子 overflow:hidden 还在，浮层不会漏到圆角外面", () => {
    expect(rule(".fs-sea")).toContain("overflow:hidden");
  });

  it("放生键抬到 44px 触屏底线（原来 36px）", () => {
    const let_ = rule(".fss-let");
    expect(let_).toContain(`min-height:${TOUCH_MIN_PX}px`);
    expect(usesTouchConst(".fss-let"), "又抄了一个数字，没走共用常量").toBe(true);
    expect(let_).toContain("box-sizing:border-box");
    expect(let_).toContain("align-items:center");
  });
});

describe("钓场 · 水面按真实可视高排版", () => {
  it("layout 是幂等的：算出来和现在一样就一个字节都不写", () => {
    expect(shell).toContain("if (next.w === W && next.h === H && canvas.width > 0) return;");
  });

  it("主循环隔一会儿重新量一次——挂进 DOM 那一瞬间壳层还没落位", () => {
    expect(REFIT_MS).toBeGreaterThan(0);
    expect(REFIT_MS).toBeLessThanOrEqual(500);
    expect(shell).toContain("sinceFit += dt;");
    expect(shell).toContain("if (sinceFit >= REFIT_MS)");
  });

  it("量的是 stageRoomPx，不是只拿 innerHeight 猜", () => {
    expect(shell).toContain("const room = stageRoomPx(wrap);");
    expect(shell).toContain("seaHeightPx(want, room, chrome)");
  });

  it("进关那一刻先把别人滚过的位置还回去", () => {
    expect(shell).toContain("resetClippedScroll(wrap);");
  });

  it("这个文件不许给自己挂滚动条——按住蓄力的玩法能滚就会「想按却滑走了」", () => {
    const fitSource = readFileSync(`${dir}fit.ts`, "utf8");
    expect(fitSource).not.toContain("overflowY =");
    expect(fitSource).not.toContain("maxHeight =");
  });
});

describe("钓场 · 地图页那三颗入口的热区（W5-B-11）", () => {
  it("🌙 钓到天黑 / 📖 鱼类图鉴 / 🎒 我的装备 抬到 44px（原来 34px）", () => {
    const open = rule(".fs-open");
    expect(open).toContain(`min-height:${TOUCH_MIN_PX}px`);
    expect(usesTouchConst(".fs-open"), "又抄了一个数字，没走共用常量").toBe(true);
    expect(open).toContain("box-sizing:border-box");
    expect(open).toContain("align-items:center");
  });

  it("图鉴的两个页签也抬到 44px（原来 34px）", () => {
    expect(rule(".fss-tab")).toContain(`min-height:${TOUCH_MIN_PX}px`);
    expect(usesTouchConst(".fss-tab")).toBe(true);
  });

  it("装备页的升级键也抬到 44px（原来 40px）", () => {
    expect(rule(".fss-gbuy")).toContain(`min-height:${TOUCH_MIN_PX}px`);
    expect(usesTouchConst(".fss-gbuy")).toBe(true);
  });

  it("整份样式里再没有低于 44px 的 min-height（大按钮那 64px 除外）", () => {
    const mins = [...css.matchAll(/min-height:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    for (const v of mins) {
      // 只读的行（提示条、读数条、抬头）不是热区，热区一律走 ${TOUCH_MIN_PX}
      expect(v === 64 || v < 30 || v >= TOUCH_MIN_PX, `还有一个 ${v}px 的 min-height`).toBe(true);
    }
  });

  it("矮屏那两档不许把这几颗又收回 44px 以下", () => {
    for (const q of ["@media (max-height:720px)", "@media (max-height:660px)"]) {
      const at = css.indexOf(q);
      const block = css.slice(at, css.indexOf("@media", at + 10));
      for (const sel of [".fs-open", ".fss-let", ".fss-tab", ".fss-gbuy"]) {
        expect(block, `${q} 里把 ${sel} 的高度又收回去了`).not.toMatch(
          new RegExp(`\\${sel}\\{[^}]*min-height`)
        );
      }
    }
  });
});
