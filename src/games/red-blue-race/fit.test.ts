/**
 * 守门：跑动键必须钳进「舞台真正看得见的那一段」（第 2 轮测试员 W5R2-A-02，严重）。
 *
 * 测试员实测 + 本轮 CDP 复量（google-chrome headless，真实坐标 `elementFromPoint`）：
 *   360×720  舞台看得见 610px，这一屏 565px 高但起点在 y=324，底沿掉到 y=889，
 *            超出裁切线 183px ——「🦘 跳」键心 y=784 点不着；
 *   360×640  舞台看得见 530px，超出 263px —— 左脚 / 右脚 / 跳三颗全挂，
 *            触屏玩家在这一档视口上根本跳不了。
 *
 * 平台那一半（`.game-stage{overflow:hidden}` 与 `.l99-stage-wrap`）是禁改文件，交窗口1；
 * 本档这一半是「这一屏太高」，靠两档收：`rbr-tight` 收留白 + 跑动键三颗并成一排，
 * 还高就再上 `rbr-tighter` 收掉抬头条的头像徽章、赛道再矮一点。
 *
 * 这个游戏**不许挂滚动条**：连点玩法里能滚就会「想按却滑走了」。
 *
 * 仓库的 vitest 跑在 node 环境、不引 jsdom，所以纯函数逐条验、
 * 收紧器拿桩节点跑真流程、CSS 与接线用源码巡检钉住。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TIGHTER_CLASS, TIGHT_CLASS, fitRaceStage, pickTier, shouldTighten, visibleRoomPx } from "./fit";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const CSS = INDEX.slice(INDEX.indexOf("const CSS = `"), INDEX.indexOf("const ENDLESS_CSS"));
/** 两档收紧规则那一段（到 reduced-motion 那条媒体查询为止） */
const TIERS = CSS.slice(CSS.indexOf(".rbr-tight {"), CSS.indexOf("@media (prefers-reduced-motion"));

/** 从样式里抠出一条规则的声明块 */
function rule(selector: string): string {
  const i = CSS.indexOf(`${selector} {`);
  if (i < 0) return "";
  return CSS.slice(i + selector.length + 2, CSS.indexOf("}", i));
}

/** 声明块里 `prop` 的像素值 */
function px(block: string, prop: string): number {
  const m = new RegExp(`${prop}:\\s*(\\d+)px`).exec(block);
  return m ? Number(m[1]) : NaN;
}

/**
 * 一个够用的桩节点：只实现收紧器真会碰的那几样。
 * `heights` 是「挂到第 n 档时这一屏有多高」，由调用方按实测数字给。
 */
function stubWrap(top: number, clipBottom: number, heights: [number, number, number]) {
  const worn = new Set<string>();
  const wrap = {
    classList: {
      toggle(name: string, on: boolean): void {
        if (on) worn.add(name);
        else worn.delete(name);
      },
      contains: (name: string) => worn.has(name),
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

describe("红蓝跑道 · 舞台看得见多少", () => {
  it("取最靠里的那一层裁切祖先算下沿", () => {
    // 测试员那台 360×640：这一屏从 y=324 起，舞台裁在 y=626
    expect(visibleRoomPx(324, [626, 899])).toBe(302);
    expect(visibleRoomPx(324, [706, 899])).toBe(382);
  });

  it("一层裁切祖先都没有（用例里的裸节点）就当不用收", () => {
    expect(visibleRoomPx(324, [])).toBe(Number.POSITIVE_INFINITY);
    expect(shouldTighten(Number.POSITIVE_INFINITY, 9999)).toBe(false);
  });

  it("量不到 / 已经被裁没了就不收，别把好好的一屏凭空压扁", () => {
    expect(shouldTighten(0, 565)).toBe(false);
    expect(shouldTighten(-40, 565)).toBe(false);
  });

  it("差一两个像素不算装不下（避免边界上反复横跳）", () => {
    expect(shouldTighten(302, 303)).toBe(false);
    expect(shouldTighten(302, 304)).toBe(true);
  });
});

describe("红蓝跑道 · 该收到第几档", () => {
  // 本轮 CDP 实测的三组高度：原样 565 / 挤一挤 364 / 再挤挤 292
  const measured = (tier: 0 | 1 | 2): number => [565, 364, 292][tier];

  it("390×844：舞台看得见 730、这一屏从 y=390 起，收一档就够", () => {
    expect(pickTier(440, measured)).toBe(1);
  });

  it("360×720：原样超 183px，挤一挤之后 364 装得进 382", () => {
    expect(pickTier(382, measured)).toBe(1);
  });

  it("360×640：只剩 302px，挤一挤还差 62px，得上第二档", () => {
    expect(pickTier(302, measured)).toBe(2);
  });

  it("地方本来就够就一档都不挂（宽屏上不许平白变小）", () => {
    expect(pickTier(900, measured)).toBe(0);
    expect(pickTier(Number.POSITIVE_INFINITY, measured)).toBe(0);
  });

  it("反例：没有第二档的话，360×640 收完仍旧装不下", () => {
    // 这条钉的就是「一档不够」——364 塞进 302 还差 62px，跳键照样在裁切线外
    expect(shouldTighten(302, measured(1))).toBe(true);
    expect(shouldTighten(302, measured(2))).toBe(false);
  });
});

describe("红蓝跑道 · 收紧器跑起来是什么样", () => {
  it("360×640 上真的会挂到第二档", () => {
    const { wrap, worn } = stubWrap(324, 626, [565, 364, 292]);
    fitRaceStage(wrap);
    expect(worn.has(TIGHT_CLASS)).toBe(true);
    expect(worn.has(TIGHTER_CLASS)).toBe(true);
  });

  it("360×720 只挂第一档，不多收", () => {
    const { wrap, worn } = stubWrap(324, 706, [565, 364, 292]);
    fitRaceStage(wrap);
    expect(worn.has(TIGHT_CLASS)).toBe(true);
    expect(worn.has(TIGHTER_CLASS)).toBe(false);
  });

  it("地方够就一档都不挂", () => {
    const { wrap, worn } = stubWrap(100, 900, [565, 364, 292]);
    fitRaceStage(wrap);
    expect(worn.size).toBe(0);
  });

  it("量之前先把上一次收的都摘干净，不然越量越松", () => {
    // 舞台从 626 长回 900（转屏 / 收起壳顶栏）之后必须能自己松回去
    let clip = 626;
    const { wrap, worn } = stubWrap(324, 626, [565, 364, 292]);
    const grow = wrap as unknown as { parentElement: { getBoundingClientRect: () => { bottom: number } } };
    grow.parentElement.getBoundingClientRect = () => ({ bottom: clip });
    const fit = fitRaceStage(wrap);
    expect(worn.has(TIGHTER_CLASS)).toBe(true);
    clip = 900;
    fit.relayout();
    expect(worn.size).toBe(0);
  });

  it("dispose 之后这一屏恢复原样，不留半档在身上", () => {
    const { wrap, worn } = stubWrap(324, 626, [565, 364, 292]);
    fitRaceStage(wrap).dispose();
    expect(worn.size).toBe(0);
  });
});

describe("红蓝跑道 · 两档收紧不许动热区", () => {
  it("最狠那一档里跑动键仍在触屏口径之上", () => {
    expect(px(rule(".rbr-tighter .rbr-step, .rbr-tighter .rbr-jump-btn"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(px(rule(".rbr-tight .rbr-step, .rbr-tight .rbr-jump-btn"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(px(rule(".rbr-tighter .rbr-side .rbr-step"), "min-height")).toBeGreaterThanOrEqual(44);
    expect(px(rule(".rbr-tight .rbr-side .rbr-step"), "min-height")).toBeGreaterThanOrEqual(44);
  });

  it("让分开关那颗 44px 两档都没碰", () => {
    expect(px(rule(".rbr-chip-btn"), "min-height")).toBe(44);
    expect(TIERS).not.toContain(".rbr-chip-btn");
  });

  it("省下的一整行来自「跳键独占一行」改成三颗并排", () => {
    const pads = rule(".rbr-tight .rbr-pads:not(.rbr-pads-duo)");
    expect(pads).toContain("grid-template-columns: 1fr 1fr 1fr");
    expect(TIERS).toContain(".rbr-tight .rbr-pads:not(.rbr-pads-duo) .rbr-jump-btn { grid-column: auto");
    // 两人场那一排结构不一样（左右各一套),不能被并排规则扫到
    expect(rule(".rbr-jump-btn")).toContain("grid-column: 1 / -1");
  });

  it("三颗并排之后每颗还是很宽:360px 的机器上一颗 100px 出头", () => {
    const padding = px(rule(".rbr-tight"), "padding");
    const gap = px(rule(".rbr-tight .rbr-pads:not(.rbr-pads-duo)"), "gap");
    expect(Math.floor((360 - padding * 2 - gap * 2) / 3)).toBeGreaterThanOrEqual(44);
  });

  it("收掉的键盘提示只对触屏没用——键位本身还在，键盘照样能玩", () => {
    expect(rule(".rbr-tight .rbr-keyhint")).toContain("display: none");
    expect(INDEX).toContain("bindRaceKeys");
  });

  it("第二档收起抬头条的头像徽章，但名字在赛道条上还有一份", () => {
    expect(rule(".rbr-tighter .rbr-badge")).toContain("display: none");
    expect(TIERS).not.toContain(".rbr-meters { display: none");
    expect(INDEX).toContain('tagEl.className = "rbr-lane-tag"');
  });

  it("字号最低 11px，再小就不是给一年级看的了", () => {
    for (const m of TIERS.matchAll(/font-size:\s*(\d+)px/g)) {
      expect(Number(m[1]), "收得比 11px 还小了").toBeGreaterThanOrEqual(11);
    }
  });

  it("赛道条还留得住一个跑步的小人（头像 28px，赛道 44px）", () => {
    expect(px(rule(".rbr-tighter .rbr-lane"), "height")).toBeGreaterThan(
      px(rule(".rbr-tighter .rbr-runner-img"), "width")
    );
  });
});

describe("红蓝跑道 · 收紧器怎么接进去的（源码巡检）", () => {
  it("三个模式都接了：关卡 / 对战场 / 跑不完的跑道", () => {
    expect([...INDEX.matchAll(/fitRaceStage\(wrap\)/g)]).toHaveLength(3);
    expect([...INDEX.matchAll(/fit\.dispose\(\)/g)]).toHaveLength(3);
  });

  it("关卡场等仪表盘的芯片都挂完了才量（量早了会漏掉体力条那一行）", () => {
    expect(INDEX.indexOf("buildHandicapChip(() => {")).toBeLessThan(INDEX.indexOf("const fit = fitRaceStage(wrap)"));
  });

  it("对战场每回合重搭赛台之后重量一次（两人场比单人场多一整排键）", () => {
    const start = INDEX.indexOf("function startRound(): void {");
    expect(INDEX.slice(start, INDEX.indexOf("renderFoes();", start))).toContain("fit.relayout()");
  });

  it("说到底不许给它挂滚动条：连点游戏能滚就会「想按却滑走了」", () => {
    const FIT = readFileSync(fileURLToPath(new URL("./fit.ts", import.meta.url)), "utf8");
    // 读祖先的 overflowY 是找裁切线用的；自己一个字节都不许往 style 上写
    expect(FIT).not.toMatch(/\.style\.(overflow|maxHeight|height)/);
    expect(TIERS).not.toMatch(/overflow-y:\s*(auto|scroll)/);
  });
});
