/**
 * 守门：这一桌必须钳进「舞台真正看得见的那一段」（第 2 轮测试员 W5R2-A-05）。
 *
 * 测试员实测 + 本轮 CDP 复量（google-chrome headless，真实坐标 `elementFromPoint`）：
 *   360×640  舞台看得见 530px、裁在 y=626；这一桌从 y=270 起、467px 高，底沿掉到 y=737。
 *            「⏸ 暂停」键心 y=669 落在裁切线以下 43px —— 想暂停只能退出重来。
 *   320×568  更狠：叫地主那一排「不叫 / 1 分 / 2 分 / 3 分」四颗连同暂停一起挂掉。
 *
 * 平台那一半（`.game-stage{overflow:hidden}`）是禁改文件，交窗口1；
 * 本档这一半是「这一桌太高」，靠两档收：`ldc-tight` 收留白与字号，
 * 还高就再上 `ldc-tighter` 把对家面板上的装饰小牌背收起来（「还剩几张」那行字说的是同一件事）。
 *
 * 出牌那一排 48px、底下那一排 44px、手牌本身，一分不动——
 * 为了「装得下」把热区收到 44 以下，等于换一种点不着。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以纯函数逐条验、
 * 收紧器拿桩节点跑真流程、CSS 与接线用源码巡检钉住。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TIGHTER_CLASS, TIGHT_CLASS, fitTableStage, pickTier, shouldTighten, visibleRoomPx } from "./fit";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const CSS = INDEX.slice(INDEX.indexOf("const CSS = `"), INDEX.indexOf("\n`;\n", INDEX.indexOf("const CSS = `")));
/** 两档收紧规则那一段 */
const TIERS = CSS.slice(CSS.indexOf(".ldc-tight{"), CSS.indexOf("@media (prefers-reduced-motion:reduce){\n  .ldc-card-move"));

/** 从样式里抠出一条规则的声明块（本款的 CSS 不留空格） */
function rule(selector: string): string {
  const i = CSS.indexOf(`${selector}{`);
  if (i < 0) return "";
  return CSS.slice(i + selector.length + 1, CSS.indexOf("}", i));
}

function px(block: string, prop: string): number {
  const m = new RegExp(`${prop}:\\s*(\\d+)px`).exec(block);
  return m ? Number(m[1]) : NaN;
}

function stubWrap(top: number, clipBottom: number, heights: [number, number, number]) {
  const worn = new Set<string>();
  const wrap = {
    classList: {
      toggle(name: string, on: boolean): void {
        if (on) worn.add(name);
        else worn.delete(name);
      },
    },
    getBoundingClientRect: () => ({
      top,
      height: heights[worn.has(TIGHTER_CLASS) ? 2 : worn.has(TIGHT_CLASS) ? 1 : 0],
    }),
    parentElement: {
      getBoundingClientRect: () => ({ bottom: clipBottom }),
      parentElement: null,
    },
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({ overflowY: "hidden" }),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    },
  };
  return { wrap: wrap as unknown as HTMLElement, worn };
}

describe("鸭梨抢地主 · 舞台看得见多少", () => {
  it("取最靠里的那一层裁切祖先算下沿", () => {
    // 测试员那台 360×640：这一桌从 y=270 起，舞台裁在 y=626
    expect(visibleRoomPx(270, [626, 899])).toBe(356);
    expect(visibleRoomPx(322, [554, 861])).toBe(232);
  });

  it("一层裁切祖先都没有（用例里的裸节点）就当不用收", () => {
    expect(visibleRoomPx(270, [])).toBe(Number.POSITIVE_INFINITY);
    expect(shouldTighten(Number.POSITIVE_INFINITY, 9999)).toBe(false);
  });

  it("量不到 / 已经被裁没了就不收", () => {
    expect(shouldTighten(0, 467)).toBe(false);
    expect(shouldTighten(-30, 467)).toBe(false);
  });

  it("差一两个像素不算装不下（避免边界上反复横跳）", () => {
    expect(shouldTighten(356, 357)).toBe(false);
    expect(shouldTighten(356, 358)).toBe(true);
  });
});

describe("鸭梨抢地主 · 该收到第几档", () => {
  // 本轮 CDP 实测的三组高度：原样 467 / 挤一挤 383 / 再挤挤 340
  const measured = (tier: 0 | 1 | 2): number => [467, 383, 340][tier];

  it("360×640：只剩 356px，挤一挤还差 27px，得上第二档", () => {
    expect(pickTier(356, measured)).toBe(2);
  });

  it("390×844 那种高屏地方够，一档都不挂", () => {
    expect(pickTier(556, measured)).toBe(0);
    expect(pickTier(Number.POSITIVE_INFINITY, measured)).toBe(0);
  });

  it("只差一点点就只收第一档，不多收", () => {
    expect(pickTier(400, measured)).toBe(1);
  });

  it("反例：没有第二档的话，360×640 收完仍旧装不下,暂停键照样在裁切线外", () => {
    expect(shouldTighten(356, measured(1))).toBe(true);
    expect(shouldTighten(356, measured(2))).toBe(false);
  });
});

describe("鸭梨抢地主 · 收紧器跑起来是什么样", () => {
  it("360×640 上真的会挂到第二档", () => {
    const { wrap, worn } = stubWrap(270, 626, [467, 383, 340]);
    fitTableStage(wrap);
    expect(worn.has(TIGHT_CLASS)).toBe(true);
    expect(worn.has(TIGHTER_CLASS)).toBe(true);
  });

  it("地方够就一档都不挂", () => {
    const { wrap, worn } = stubWrap(120, 830, [467, 383, 340]);
    fitTableStage(wrap);
    expect(worn.size).toBe(0);
  });

  it("档位真的换了才回头重摆手牌扇——不换档不许白重画", () => {
    const seen: Array<0 | 1 | 2> = [];
    const { wrap } = stubWrap(270, 626, [467, 383, 340]);
    const fit = fitTableStage(wrap, (t) => seen.push(t));
    expect(seen).toEqual([2]);
    fit.relayout();
    fit.relayout();
    expect(seen).toEqual([2]);
  });

  it("舞台长回来了要能自己松回去（转屏 / 壳顶栏收起来）", () => {
    let clip = 626;
    const seen: Array<0 | 1 | 2> = [];
    const { wrap, worn } = stubWrap(270, 626, [467, 383, 340]);
    const grow = wrap as unknown as { parentElement: { getBoundingClientRect: () => { bottom: number } } };
    grow.parentElement.getBoundingClientRect = () => ({ bottom: clip });
    const fit = fitTableStage(wrap, (t) => seen.push(t));
    clip = 900;
    fit.relayout();
    expect(worn.size).toBe(0);
    expect(seen).toEqual([2, 0]);
  });

  it("dispose 之后这一桌恢复原样", () => {
    const { wrap, worn } = stubWrap(270, 626, [467, 383, 340]);
    fitTableStage(wrap).dispose();
    expect(worn.size).toBe(0);
  });
});

describe("鸭梨抢地主 · 两档收紧不许动热区", () => {
  it("出牌那一排、底下那一排、模式入口,两档里一个都没被碰", () => {
    expect(px(rule(".ldc-mainbar .ld-btn"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(px(rule(".ldc-subbar .ld-btn"), "min-height")).toBe(44);
    expect(px(rule(".ld-btn"), "min-height")).toBeGreaterThanOrEqual(42);
    for (const sel of [".ld-btn", ".ldc-mainbar", ".ldc-subbar", ".ld-open"]) {
      expect(TIERS.includes(sel), `收紧那两档动了热区 ${sel}`).toBe(false);
    }
  });

  it("手牌本身一分不动:牌大小是 fan.ts 按宽度算的，收紧只碰高度方向的留白", () => {
    expect(TIERS).not.toContain(".ld-fanbox");
    expect(TIERS).not.toContain(".ld-card");
  });

  it("收掉的键盘那一行只对触屏没用——键位本身还在", () => {
    expect(rule(".ldc-tight .ld-keys")).toContain("display:none");
    expect(INDEX).toContain("function onKeyDown");
  });

  it("第二档收起对家的装饰小牌背，「还剩几张」那行字留着", () => {
    expect(rule(".ldc-tighter .ld-mini")).toContain("display:none");
    expect(TIERS).not.toContain(".ld-count{display:none");
    expect(rule(".ldc-tight .ld-count")).toContain("font-size");
  });

  it("要读的字最低 10px:再小一年级的孩子认不出来", () => {
    // 对家面板上那一叠小牌背是装饰(第二档整个收起来),它缩到 8px 不算「要读的字」
    const readable = TIERS.split("\n").filter((line) => !line.startsWith(".ldc-tight .ld-mini-c{"));
    for (const m of readable.join("\n").matchAll(/font-size:\s*(\d+)px/g)) {
      expect(Number(m[1]), "收得比 10px 还小了").toBeGreaterThanOrEqual(10);
    }
    expect(rule(".ldc-tighter .ld-mini")).toContain("display:none");
  });

  it("桌面上那一手牌、教练那一行提示，两档都还在（只是瘦了）", () => {
    expect(rule(".ldc-tighter .ldc-table")).toContain("min-height");
    expect(TIERS).not.toContain(".ldc-table{display:none");
    expect(TIERS).not.toContain(".ldc-hintline{display:none");
  });
});

describe("鸭梨抢地主 · 收紧器怎么接进去的（源码巡检）", () => {
  it("整桌摆完才量（量早了对家面板和手牌扇都还是空的）", () => {
    expect(INDEX.indexOf("  render();\n  // 整桌都摆好了才量")).toBeGreaterThan(0);
    expect(INDEX.indexOf("fit = fitTableStage(wrap")).toBeGreaterThan(INDEX.indexOf("wrap.append(style, banner"));
  });

  it("每次重画都重量:叫分那一排换成出牌那一排,这一桌会长高一截", () => {
    const body = INDEX.slice(INDEX.indexOf("function render(): void {"));
    expect(body.slice(0, body.indexOf("\n  }\n"))).toContain("fit?.relayout()");
  });

  it("destroy 里把 resize 监听拆干净", () => {
    const destroy = INDEX.slice(INDEX.indexOf("    destroy() {\n      destroyed = true;"));
    expect(destroy.slice(0, 600)).toContain("fit?.dispose()");
  });

  it("说到底不许给它挂滚动条:手牌是拖着框选的,能滚就框不成", () => {
    const FIT = readFileSync(fileURLToPath(new URL("./fit.ts", import.meta.url)), "utf8");
    expect(FIT).not.toMatch(/\.style\.(overflow|maxHeight|height)/);
    expect(TIERS).not.toMatch(/overflow-y:\s*(auto|scroll)/);
  });
});

/**
 * 第 2 轮监督修复员 W5R2-F-A-04（W5R2-L-14 收口）。
 *
 * 两档收完在 320×568 上还差 107px，学习优化员那一轮把这 107px 挂了起来。
 * 本轮 CDP 复量把这 107px 找着了，不在这一桌身上：
 *
 *   舞台看得见 458px，`.ld-bar`（♾️ 无尽连胜 / ⚔️ 双人对战）却从关卡地图一路
 *   跟进关内常驻，两颗 44px 的键在 320px 宽上排不下、折成两行占掉 96px，
 *   连同外边距一共 104px —— 这一桌真正分到的只剩 232px。
 *   叫地主那一排四颗与「⏸ 暂停」全部掉在裁切线以下，真实坐标点不着。
 *
 * 两处都得补，缺一条都不成：
 *   ① `bar.hidden = true` 在这一款身上是空转 —— `.ld-bar{display:flex}` 是作者样式，
 *      压过浏览器自带的 `[hidden]{display:none}`。所以「开无尽 / 开对战时收起模式条」
 *      这件本来就该成立的事，一直没真的发生过。
 *   ② 关内根本不需要这两个入口（回地图就有），进关收起来、离关放回去。
 *
 * 收的是本款自己的壳，热区一分没动：两颗入口键仍是 44px，回到地图照样露面。
 * 仓内已有七款同样的做法（钓鱼星星 / 泡泡兄弟 / 怪兽危机 / 黄金矿工 / 碰碰车 / 炸弹伙伴 / 保龄球道）。
 */
describe("鸭梨抢地主 · 模式条只在选关地图上露面", () => {
  it("[hidden] 得压得住 display:flex,不然「收起模式条」全是空转", () => {
    // 这一条同时钉住一个一直在的老毛病:开无尽 / 开对战时 bar.hidden 没起过作用
    expect(rule(".ld-bar")).toContain("display:flex");
    expect(CSS).toContain(".ld-bar[hidden]");
    expect(rule(".ld-bar[hidden]")).toContain("display:none");
  });

  it("进关收起来、离关放回去", () => {
    const wired = INDEX.slice(INDEX.indexOf("      playLevel: ("), INDEX.indexOf("      mapHint:"));
    expect(wired, "playLevel 没接成收模式条的那一版").toContain("bar.hidden = true");
    expect(wired, "离开这一关得把模式条放回去,不然回地图就没入口了").toContain("bar.hidden = false");
    // 关卡框架允许 playLevel 什么都不返回,包一层的时候别把这种情况漏了
    expect(wired).toContain("handle?.destroy?.()");
    // 侧模式开着时这一条本来就该收着,离关时别替它放回来
    expect(wired).toContain("if (!mode) bar.hidden = false;");
  });

  it("得先收再摆:收紧器是在 playLevel 里量的,量早了这 104px 白让", () => {
    const wired = INDEX.slice(INDEX.indexOf("      playLevel: ("), INDEX.indexOf("      mapHint:"));
    expect(wired.indexOf("bar.hidden = true")).toBeLessThan(wired.indexOf("playLevel(stage, ctx)"));
  });

  it("热区没动:两颗入口键回到地图上仍是 44px", () => {
    expect(px(rule(".ld-open"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(rule(".ld-bar[hidden]")).not.toContain("min-height");
  });
});
